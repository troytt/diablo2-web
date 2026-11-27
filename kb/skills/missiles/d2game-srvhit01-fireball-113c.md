# `MISSMODE_SrvHit01` (Fire Ball radial explosion) and its damage roll (1.13c)

Ground truth: `D2Game.dll` 1.13c (image base `0x6FC20000`), `D2Common.dll` (`0x6FD50000`),
`Missiles.txt`. Oracle evidence: `p52-sorceress-elemental` frame 683 (one Fire Ball impact produces two
`SUNITDMG` events, first on monster #10 then on #9, both `raw = [2, 5, 0, 0, 32434, …]`, no separate
direct-hit event; the missile seed draws once).

TS: [`applySrvHit01Radial113c`](../../../src/server/engine/game-instance/missiles-step.ts),
[`isOracleSrvHit01Missile113c`](../../../src/server/engine/game-instance/missiles-step.ts),
[`resolveMissileUnitImpactPoint113c`](../../../src/server/engine/game-instance/missiles-step.ts)
(DRLG oracle path only: `drlgRoomPopulator !== null`, player-owned missile, `pSrvHitFunc = 1`, element
fire / lightning / magic).

## 1. `SrvHit01` — `0x6FC5B990` (fastcall `ecx = pGame`, `edx = pMissile`, one stack arg = struck unit, unused)

| addr | step |
|---|---|
| `0x6FC5B9A9..0x6FC5B9DE` | `pMissilesTxt = sgptDataTables->pMissilesTxt + class * 0x1A4`; class out of range -> return 1 |
| `0x6FC5B9E4` | `pMissile->dwFlags (+0xC8) & 0x400` clear -> return 1 (no damage stats) |
| `0x6FC5B9FB..0x6FC5BA14` | owner = `0x6FD003A0(pMissile->dwOwnerType +0x94, dwOwnerId +0x98)`; none -> return 1 |
| `0x6FC5BA1A` | `radius = MissilesTxt.sHitPar1 (+0x4C)`; if `> 0` skip to the position read |
| `0x6FC5BA25..0x6FC5BA7D` | else `skill = #10240(pMissile)`, `slvl = #11029(pMissile)`, `radius = #10786(owner, SkillsTxt.calc1 (+0x138), skill, slvl)`, `radius = max(1, radius)` (**not ported**: every 1.13c `SrvHit01` row has `sHitPar1 > 0`; the TS throws) |
| `0x6FC5BA85..0x6FC5BAB5` | `x = path x` (`#10867` static path / dynamic path `+0x0C`) |
| `0x6FC5BAB9..0x6FC5BADE` | `y = path y` (`#10750` / `+0x10`) |
| `0x6FC5BAE1..0x6FC5BAEC` | zero the 0x70-byte `D2DamageStrc` |
| `0x6FC5BAFC` | `0x6FC5A280(dmg, pMissile, owner)` fills the packet **once** (§2) |
| `0x6FC5BB05..0x6FC5BB17` | `dmg.dwHitFlags |= MissilesTxt+0xA8` (`HitFlags`) |
| `0x6FC5BB1B..0x6FC5BB22` | `dmg.wResultFlags |= MissilesTxt+0xAC` (`ResultFlags`, word) |
| `0x6FC5BB44` | `0x6FCC0C70(owner, x, y, radius, filter 0x8583, cb 0x6FCC1210, &dmg, 0)` (§3) |
| `0x6FC5BB4C` | return 1 |

Fire Ball (`#62`): `sHitPar1 = 4`, `HitFlags = 2`, `ResultFlags = 5` -> trace `raw[0] = 2`, `raw[1] = 5`.

## 2. Packet fill `0x6FC5A280` and element roll `0x6FC59B40`

`0x6FC5A280` (`edi = pMissile`, `esi = dmg`, arg = owner): `switch (#10557(pMissile->dwClassId))` (element of
the missile row, jump table `0x6FC5A4AC`). Ported cases:

| element | call | min stat | max stat | pct stat | field |
|---|---|---|---|---|---|
| fire (`0x6FC5A346`) | `0x6FC59B40` | 48 `firemindam` | 49 `firemaxdam` | 329 `passive_fire_mastery` | `+0x10` |
| lightning (`0x6FC5A35F`) | `0x6FC59B40` | 50 | 51 | 330 `passive_ltng_mastery` | `+0x1C` |
| magic (`0x6FC5A378`) | `0x6FC59B40` | 52 | 53 | 357 `passive_mag_mastery` | `+0x20` |

Not ported yet (fall back to the old splash): phys (`0x6FC5A2A9`, stats 21/22 + `damagepercent` 25 and
the owner's `#10255`/`#10239` bonus stats 0x79/0x7A, clamp `-90`, then stat 141 doubles), cold (stats
54/55, pct 331, length stat 56), poison (57/58, pct 332, length 59, count 326 divides the length,
`rate * 25`), the stat-only cases 60/62/64/66 (life/mana/stamina steal fields) and the `0x6FC5A44F`
case (stats 0x13C/0x13D).

`0x6FC59B40(eax = maxStat, ecx = pctStat or -1, [esp+4] = unit, [esp+8] = minStat)`:

```
max = STATLIST_GetUnitStat(unit, maxStat)   // 0x6FC59B4D
if (max <= 0) return 0                     // no draw
min = STATLIST_GetUnitStat(unit, minStat)   // 0x6FC59B69
if (min <= 0) return 0                     // no draw
if (min > max) swap                         // 0x6FC59B7D
if (pctStat != -1 && (pct = stat(pctStat)) != 0) {     // 0x6FC59B87
  min += mulDiv(pct, min, 100)              // 0x6FC214D0 (mulDiv113c)
  max += mulDiv(pct, max, 100)
}
return min + RollLimited(&unit->pSeed (+0x20), max - min)   // 0x6FC211D0 inline, NOT max-min+1
```

RNG consumption:

| seed | condition | modulus | site |
|---|---|---|---|
| missile unit seed (`unitSeeds['3:<id>']`) | `min > 0 && max > 0 && max - min > 0` | `max - min` (power of two -> mask) | `0x6FC59BBE` -> `0x6FC211D0` |

Verified: Fire Ball slvl 10, missile stats `21742..26703` (1/256), Fire Mastery 30 % -> `28264..34713`,
missile seed `{957346431, 666}` -> one step -> `lo = 99028565`, `99028565 % 6449 = 4170`,
`28264 + 4170 = 32434` = oracle `raw[4]`.

The missile's min/max are the skill's evaluated elemental range carried on
`InternalMissileRecord.srvHitElem256` (set in `launchPlayerSkillMissile`). The mastery stat is read from the
caster (the missile's stat list inherits it). Because the mastery is already in the rolled value, the
SUNITDMG call passes `skipElemMastery`.

## 3. Area scan `0x6FCC0C70` with filter `0x8583`, callback `0x6FCC1210`

Same scanner as [`aura-target-filter-113c.md`](../aura-target-filter-113c.md): rooms from
`#10383` (adjacent rooms of the **owner's** room, `#10331`), per room the unit list `pRoom+0x74`, next
`pUnit+0xE8`; the owner itself is skipped (`cmp edi, [esp+0x30]`); `#10769` sub-tile `dx² + dy² <= r²`
against the missile `(x, y)`; per-unit predicate `0x6FCC0370` with `0x8583` = players + monsters,
unit flags `0x4` and `0x8`, not in town, hostile to the owner (`0x8000`); dead / dying rejected. No
`0x2000` room skip. The struck unit is **not** excluded — it is hit by the scan like any other unit.

`0x6FCC1210` copies the 0x70-byte packet per target and calls `0x6FCC10B0`: missile targets resolve to
their owner (`0x6FD00A20`); `wResultFlags == 0` -> skip; `0x6FCFB030(def, 1)` merges defence bits into the
result flags (`0x02 -> +0x100`, `0x04 -> 0x80`, `0x10 -> +0x8000`, `0x01 -> 0x10`, any -> clear bit 0);
bit 0 still set and target not in state 54 -> `|= 4`; `0x6FC970E0`; bit 0 -> `0x6FCFE0C0`; then
`0x6FCFCF20` (SUNITDMG apply).

Visit order: room lists are LIFO (`UNITROOM` prepends), so in one room the newest unit comes first (#10
before #9 in the oracle). The replica has no per-room unit list; it visits monsters by **descending unit
id**, which equals the room order only while the candidates were created in the same room and never
changed rooms. Open item: model `pRoom->pUnitFirst` membership if a scenario needs it.

## 4. Impact position

`PATH_StepMissile` (`#10229`, [`missile-collision-113c.md`](./missile-collision-113c.md) §2) halves the
16.16 displacement until both components are below one sub-tile and stops on the last step before the
footprint overlaps a unit, so `SrvHit01` reads the position **in front of** the struck unit, not the
end of the frame's segment. Oracle frame 683: the missile at `(5664, 5794)` advances `1.0625` sub-tiles;
the segment end `5792.94` would put #10 at `dx² + dy² = 18 > 16`, the stop position (`5793.x`) at 13.
TS: `resolveMissileUnitImpactPoint113c` (uses `checkMissileSegmentFootprintOverlap113c` on each step).

## 5. Default unit contact and ground fire: `MISSMODE_SrvHitDispatch` `0x6FC5EDE0`

Oracle evidence: `p52-sorceress-fire-dot` (Fire Wall): F637 a zero-damage `SUNITDMG` `raw = [0, 1, …]` when
`firewallmaker` #1 steps next to zombie #10; F639/F640 the `firewall` segment at `(5661, 5794)` burns #10
with `raw = [0, 16385, 0, 0, 1888, …]` / `1906` and the segment seed draws twice per hit.

`0x6FC5EDE0` (`edi = pMissile`, args `pGame`, `pTarget`, flag):

| addr | step |
|---|---|
| `0x6FC5EE2A..0x6FC5EE54` | owner via `0x6FD003A0` when `dwFlags & 0x400` |
| `0x6FC5EE56..0x6FC5EE7B` | `result = 2`, `hitMask = 3`; `MissilesTxt+4 & gdwBitMasks[1]` (`Explosion`) -> `result = 0` |
| `0x6FC5EE80` | target + `NextHit (+0x188)` + state 86 `justhit` -> return 1 |
| `0x6FC5EE9A` | `#10227(missile, target)` = target is the LastCollide unit -> return 1 |
| `0x6FC5EEAB` | `#10024(missile, target)` stores LastCollide |
| `0x6FC5EEBD` | enemy filter `0x6FC58FB0`; owner hostility `0x6FD00A60` else `CollideFriend (+0x187)` |
| `0x6FC5EEF9..0x6FC5EF33` | `Pierce` flag (`gdwBitMasks[2]`) + pierce stats -> `0x6FC58F40` |
| `0x6FC5EF37` | `CollideKill (+0x186)` -> `result |= 1` |
| `0x6FC5EF4E` | `ToHit (+0x18B)` -> to-hit roll `0x6FCFDE90` (not taken by the Fire Wall rows) |
| `0x6FC5EFFE..0x6FC5F052` | `hitMask & 2`: `0x6FC5E590`, `0x6FC57030`, then `pSrvHitFunc (+0x0E)` when `> 0` |
| `0x6FC5F058..0x6FC5F0AF` | target and `result & 2`: packet `0x6FC5A4E0` from the missile stats, `pSrvDmgFunc (+0x10)`, SUNITDMG `0x6FC5AFF0` |

`0x6FC5A4E0` rolls each channel through `0x6FC59B40` on the missile seed in the order phys (21/22),
fire (48/49), magic (52/53), lightning (50/51), cold (54/55), poison (57/58) — a channel with `min <= 0`
or `max <= 0` takes no draw. Makers carry no damage stats -> a zero packet, no draw.

`SrvDmg03` (`0x6FC59670`): inline LCG step of `pMissile->pSeed`, `(lo & 0x7F) < MissilesTxt+0x78`
(`dParam1`, 19 for `firewall`) -> `ResultFlags |= 0x4000` (soft hit). No get-hit bit.

RNG per Fire Wall segment hit:

| seed | site | modulus |
|---|---|---|
| segment seed | `0x6FC59B40` fire roll | `max - min` (1848..1935 -> 87) |
| segment seed | `SrvDmg03` inline step | `& 0x7F` |

Verified: segment seed `{1030816634, 666}` -> `1848 + 40 = 1888`, `4 < 19` -> 0x4001; F640 `1906`.

The 1/256 damage is subtracted from the raw hit points (zombie 2304 -> 416), so DRLG ground fire keeps
`InternalMonsterRecord.hp256` (authoritative while `hp256Whole === hp`).

TS: [`applyMissileDefaultUnitContact113c`](../../../src/server/engine/game-instance/missiles-step.ts)
(player missiles with `pSrvHitFunc 0`, `CollideKill 0`, no damage; LastCollide on
`InternalMissileRecord.lastCollideKey113c`; contact on integer sub-tiles),
[`applySrvDmg03GroundFireHit113c`](../../../src/server/engine/game-instance/missiles-step.ts).

## 6. Frame order, spawn positions, `SrvDo06` step gate (DRLG oracle path)

- Missiles tick newest first (room unit lists are LIFO): `stepMissiles` reverses the creation order.
- Children are created at integer sub-tiles (`floor(16.16)` of the parent = the rounded replica
  position, whose origin is the sub-tile centre).
- Linear velocity = the 16.16 path direction `0x6FD5CF40` (table `0x6FDDD470`, see
  [`missile-path-113c.ts`](../../../src/server/engine/missile-path-113c.ts)) instead of a float unit vector:
  Fire Wall makers move exactly `0.5625` sub-tiles per frame along x.
- `SrvDo06` (`0x6FC61850`) spawns `SubMissile1` when `D2Common_10234` reports a new sub-tile; the
  do-function runs before the frame's move, so the replica uses the step flag of the previous move
  (crossings 637/639/641/643/645/646 -> spawns 638/640/642/644/646/647, all matched).
- Open (unverified): a hit on a dormant DRLG monster wakes it (`aiAwake`) but its first AI think is
  deferred to the next frame (oracle F639 shows no AI draw after the hit); the original wake path is
  not disassembled yet.

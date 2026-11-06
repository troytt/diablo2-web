# D2Game.dll 1.13c — Monster melee swing on a PLAYER defender (`SUNITDMG` path, RNG order)

Image base `0x6FC20000` (`samples/d2/D2Game.dll`), `D2Common.dll` `0x6FD50000`.
TS: [`monster-melee-attacks.ts`](../../src/server/engine/game-instance/monster-melee-attacks.ts)
`resolveMonsterAttackOnPlayer`, [`sunitdmg-player-defender-113c.ts`](../../src/server/engine/game-instance/sunitdmg-player-defender-113c.ts),
[`combat-pipeline.ts`](../../src/server/engine/combat-pipeline.ts) `executeSUnitDmg`.

Oracle evidence: every zombie (`zombie1`, `hcIdx 5`, mlvl 2) A2 hit that lands on a player in the golden traces
(`p52-paladin-auras` F=912, `p52-barbarian-warcries` F=1178/1395/1488, `a1-bloodmoor-melee` F=1161/1533/1750,
`p52-necromancer-curses` F=1137/1354/1447) draws exactly **4 times on the monster seed** and **4 times on the
player seed** (0 for the naked necromancer, see §4). The HP loss equals `512 + (raw2 & 255)` for all six
paladin/barbarian/bloodmoor hits (raw2 = second monster draw), i.e. `min256 = 2 << 8`, `max256 = 3 << 8` (the A2
damage), exclusive span.

## 1. Call chain

| Step | Address | Notes |
|---|---|---|
| Monster attack srvdo | `0x6FC64AC0` (called from `0x6FC66AB6`) | sums aura to-hit bonuses (`#10494` / `#10680(.., 0x15E)` / `#10653`), zeroes the 0x70-byte damage struct (`0x6FC64BDE rep stos`) |
| Hit flags | `0x6FCFE5A0` | `#11138` range; `SKILLS_RollToHit` `0x6FCFDE90` (attacker seed, `0x6FCFE011`); block `0x6FCFB790` (`eax = 1`) -> flags `0x10` block (clears `1`), `0x100/0x80/0x8000` evade/avoid/weapon-block |
| Damage | `0x6FCFDDE0` | when `wResultFlags & 1` and not `0x8380`: `SUNITDMG_FillDamageValues` `0x6FCFD450`, `SUNITDMG_ApplyDamage` `0x6FCFC0B0`, then queue on `pAttacker+0xAC` (`0x6FCFAB90`) |
| Execute | `0x6FCFED30` (`0x6FC66AC2`) | pops the record; hit: `0x6FCFE0C0` (life, leech, stun/cold/freeze/poison/burn), `0x6FCFEBA0` (item durability, §4), events `7` / `3` (`0x6FC57030`), `SUNITDMG_ExecuteEvents` `0x6FCFCF20` (mode: death / knockback / block / GetHit, see `d2game-gethit-recovery-113c.md` §5), free `0x6FCFA6D0` |

RNG helpers: `0x6FC211D0(ecx = &seed, esi = n)` and `0x6FC21180(ecx, eax = n)`: `n <= 0 -> 0`; power of two ->
`lo & (n - 1)`; else `lo % n` (TS `rollLimitedSeed113c`). `0x6FC21450(esi = &seed, push n)` is mask-only
(`lo & (n - 1)`, used with `2` / `4` by `SUNITDMG_CheckSkipGetHit`).

## 2. `SUNITDMG_FillPacket` (`0x6FCFC530`) — monster attacker, no weapon

Called from `0x6FCFD512` with `(1, 0, 0, pDamage->dwPhys, srcDam)`; `0x6FC572C0` returns no weapon for a monster:

```
min = STAT 21 (mindamage) ; if (min <= 0) min = 1        // 0x6FCFC5A2..0x6FCFC5B2
max = STAT 22 (maxdamage) ; if (max <= 1) max = 2        // 0x6FCFC5B7..0x6FCFC5C8
min <<= 8 ; max <<= 8                                     // 0x6FCFC5CD
min += STAT 111 << 8 ; max += STAT 111 << 8               // 0x6FCFC5D3..0x6FCFC5E2
if (min < 1) min = 0x100 ; if (max <= min) max = min + 0x100
... %ED pool (stats 25 / 18 / 17, str/dex bonus for weapons) ...
phys = 0x6FCFBED0(base, min, max, pct)                    // 0x6FCFC6DB
```

`0x6FCFBED0`: `min' = min + min * pct / 100`, `max' = max + max * pct / 100` (64-bit `0x6FD144B0` for large
values), `result = base + min' + RAND(&pAttacker->pSeed, max' - min')` when `max' > min'` (`0x6FCFC016`, **exclusive**
span, no `+1`). STAT 21/22 hold the damage of the monster's **current** attack mode: the oracle zombie A2 hits are
`2..3` (A2 `MinD/MaxD = 101/151 %` of MonLvl 2), not the A1 `1..3`.

TS: `monsterFillPacketPhysRange113c` + `executeSUnitDmg` `unrolledWeaponBase113c` (edPct = monster aura `%ED`).

## 3. `SUNITDMG_FillDamageValues` (`0x6FCFD450`) — tail for a monster attacker

Order after the physical roll. Correction: the Weapon-Mastery / CS / DS block
`0x6FCFD51A..0x6FCFD5B4` is **not** player-only. It runs for any attacker. Each of the three checks draws
`RAND(&pAttacker->pSeed, 100)` (`0x6FC21480`, `esi = 0x64`) only when its chance is `> 0`, and the first
success jumps to `0x6FCFD5A8` and skips the remaining checks:
1. Weapon mastery: `0x6FC572C0` (mastery skill) → `0x6FC2A80E(.., 0, 2)` chance (`0x6FCFD522..0x6FCFD552`).
2. Stat `0x151 = 337` (`0x6FCFD554..0x6FCFD57C`).
3. Stat `0x8D = 141` deadly strike (`0x6FCFD57E..0x6FCFD5A6`).

Plain MonStats monsters have all three at `0`, so they draw nothing here. The Amazon Valkyrie
(`#357`) gets those stats from its `MonEquip` items, and the oracle shows its 337/141 draws between the
physical roll and lightning `50/51` (`p52-amazon-valkyrie`). For the Valkyrie, item op `13`
(`item_min/maxdamage_percent`) folds into the base item damage of the equipped weapon, not into the pet
stat `%ED`.

The rest of the tail, in order:

1. Elemental stat pairs 48/49, 50/51, 52/53, 54/55 through `0x6FCFCD80` (draw only when `max > min`).
2. Poison 57/58 through `0x6FCFBED0` (`0x6FCFD84C`).
3. `0x6FCFD8F0..0x6FCFD926`: `edi = burn * srcDam + 0x13C; RAND(&pAttacker->pSeed, 1)` — **unconditional**
   (`esi = 1`, power of two, returns 0).
4. `[pDamage+0x65] == 10` -> `RAND(&pAttacker->pSeed, 5)` (`0x6FCFD9C8`; random elemental conversion).
5. `0x6FC970E0(eax = attacker, ecx = pDamage, push defender)`: monster only; `MonStats.txt` record
   (`0xA78`, stride `0x1A8`) byte `+0xA6` = `crit`. `crit > 0` -> `pAttacker->pSeed % 100` (`0x6FC9713B`);
   `roll < crit` doubles `+0x08` phys, `+0x10` fire, `+0x1C` ltng, `+0x20` magic, `+0x24` cold, `+0x28` poison
   (not `+0x14` burn) and, with a defender, ORs `0x10` into the hit class `+0x60` when its upper nibble is 0
   (else `#10689(defender, 0x36)`).

TS: `executeSUnitDmg` (`packet.monStatsCritPct113c`, set by `resolveMonsterAttackOnPlayer` from
`monStatsCritPct113c(hcIdx)`) runs 3 + 5 right before the resistance section; the player-attacker `rand(1)`
draw keeps its previous position (`fillDamageTailDone113c`).

`0x6FCFDDE0` hit flags: `FillDamageValues` ORs `0x20` into `dwHitFlags` (`0x6FCFD492`); the monster caller never
sets `0x02` (oracle damage events `raw[0] = 0x20`).

## 4. `SUNITDMG_ItemDurability` (`0x6FCFEBA0`) — player defender branch

Called from `SUNITDMG_ExecuteCombat` `0x6FCFEE2B` (`eax = attacker`, `ebx = defender`, `push pGame`) only for a
landed hit (`wResultFlags & 1`, a block clears it at `0x6FCFE699`).

* Attacker branch (`0x6FCFEBA7..0x6FCFEBC1`): player attacker with a weapon (`0x6FC572C0`) ->
  `ITEMS_DamageDurability(weapon)` (`0x6FC32EE0`, weapon threshold 4, see below).
* Defender branch (`0x6FCFEBD7..0x6FCFED15`), player defender with an inventory:

```
table (0x6FD2E628 count = 7, 0x6FD2E62C {bodyLoc, weight}):
  {1 head, 3} {3 torso, 5} {4 rarm, 4} {5 larm, 4} {8 belt, 2} {9 feet, 2} {10 gloves, 2}
sum = 0
for i in 0..6: item = #11139(inv, bodyLoc[i]); if item && #10744(item, 0x32 'armo'): slot[i] = item; sum += weight[i]
if (sum <= 0) return                                  // 0x6FCFEC5A
start = RAND(&pDefender->pSeed, 7)                    // 0x6FCFEC68..0x6FCFEC9D
r     = RAND(&pDefender->pSeed, sum)                  // 0x6FCFEC9F..0x6FCFECD6
i = start
loop: if slot[i]: if r < weight[i] -> ITEMS_DamageDurability(slot[i]) ; return
                  r -= weight[i]
      i = (i + 1) % 7 ; if r >= 0 goto loop
```

`ITEMS_DamageDurability` (`0x6FC32EE0`, `esi = item`, `edi = owner`): `#10744(item, 0x32)` armor or
`#10744(item, 0x2D)` weapon, else return; `#10865` ITEMS_HasDurability (`0x6FD76D40`: `nodurability == 0`,
txt `durability > 0`, max-durability stat 73 `!= 0`, stat 152 indestructible `<= 0`), else return.
Threshold `ebx = 10` for armor (`0x6FC32F35`), `4` for a weapon (`10` for throwables, `#10711`). Draw
`pOwner->pSeed % 100` (`0x6FC32F3A..0x6FC32F5A`); `roll < threshold` -> `STAT 72 durability - 1` (broken path at
`0x6FC32FD8` when it reaches 0).

So a landed hit costs the player seed `0`, `2` or `3` draws; with a block roll before it that is the oracle's 4.
The naked necromancer (no armor) draws 0 — no block (no shield) and `sum == 0`.

TS: `rollPlayerDefenderArmorDurability113c`, called right after the damage of a landed melee swing and before
`applyDamageToPlayer` (GetHit rolls, `0x6FCFCF20`).

## 5. Life subtraction (`0x6FCFE0C0`)

`0x6FCFE242..0x6FCFE264`: `life = STAT 6 - dwDmgTotal` in 256ths, `life < 0x100 -> 0` (no integer rounding).
TS: `applyDamageToPlayer(..., { dmg256 })`; the same rule for monster defenders in `finishMonsterDamage`
(oracle `a1-bloodmoor-melee` F=1086: 2304 - 1022 = 1282).

## 6. GetHit rolls of a player defender

`SUNITDMG_CheckSkipGetHit` (`0x6FCFB910`) draws `rand(2)` / `rand(4)` on `pDefender->pSeed` through `0x6FC21450`
(see `d2game-gethit-recovery-113c.md` §3). TS `maybeEnterPlayerHitRecovery` now passes the player seed on the
oracle path instead of the game RNG.

## RNG consumption (one zombie A2 hit on a paladin, `p52-paladin-auras` F=912)

| # | Seed | Site | Modulus | Value |
|---|---|---|---|---|
| 1 | monster | `0x6FCFE017` to-hit | 100 | 4 (< chance, hit) |
| 2 | player | `0x6FCFB7F8` block | 100 | 48 (>= block) |
| 3 | monster | `0x6FCFC016` phys | `768 - 512 = 256` | 127 -> 639 |
| 4 | monster | `0x6FCFD908` | 1 | 0 |
| 5 | monster | `0x6FC9713B` crit | 100 | 90 (>= 5) |
| 6 | player | `0x6FCFEC75` armor slot | 7 | |
| 7 | player | `0x6FCFECAE` armor weight | sum | |
| 8 | player | `0x6FC32F3D` durability | 100 | 94 (>= 10) |

Damage `639 < maxHP / 16` -> no GetHit draw.

## 7. Block mode length when the block comes from a monster swing

`SUNITDMG_ExecuteEvents` (`0x6FCFCF20`) starts `PLRMODE_BLOCK` (9) from inside the monster's update, i.e. after the
player unit was already updated in that frame. The BL animation accumulator (`+= speed`, start 0) first advances on
the next frame, so the mode is visible for `ceil(frames * 256 / speed)` frames and NU appears on
`F + ceil(frames * 256 / speed)`. Oracle `p52-amazon-defense`: block roll on F=916 (1 player draw), mode 9 on
F=916..921, mode 1 on F=922. The replica's `computeOneShotTicks` is `ceil(..) - 1` (calibrated for modes the player
starts itself); the monster-swing block adds `+1` on the oracle path.

## 8. Monster life regeneration on the oracle path

`MONSTER_InitStats` (`0x6FCCFDB0`) sets `STAT_MAXHP` (7) / `STAT_HITPOINTS` (6) to `maxHp << 8` (`0x6FCD006E..0x6FCD0080`,
`esi`), then `STAT_HPREGEN` (74):

```
regen = MonStats.DamageRegen (+0x1A0)          ; 0x6FCD00B5, asserted 0..0xFFF (0x6FCD00BB..0x6FCD00CC)
if regen == 0: v = 0
elif maxHp256 > 0x7FFFFFFF / regen: v = (maxHp256 >> 12) * regen   ; 0x6FCD00FF
else:                               v = (maxHp256 * regen) >> 12   ; 0x6FCD0109
#10887 SetStat(pMonster, 74, v, 0)             ; 0x6FCD0117
```

The stat-regen event adds `STAT_HPREGEN` (1/256 HP) every frame. Oracle `a1-bloodmoor-melee` zombie #10 (2304, regen 2 ->
`v = 1`): 1282 after the F=1086 hit, 1283 on F=1087, +1 per frame. TS: `stepMonsterRegen` (oracle path).
Pending (oracle-derived only): no regen tick on the frame the monster was damaged (`lastDamagedFrame113c`) — the
regen event placement relative to the player pass is not disassembled yet.

## 9. Player melee vs undead with a blunt weapon (`0x6FCFA8C0`)

`SUNITDMG_FillDamageValues` (player attacker, monster defender, `0x6FCFD4AB..0x6FCFD4EB`): `0x6FCFA890` (stat 120 ->
stat 31), `#10255(attacker)` + stat 121 into `pDamage->dwEnDmgPct` (`+0x0C`), then `0x6FCFA8C0`: if `#10239(defender)`
(undead), `esi = 50` when the attacker's weapon (`0x6FC572C0`) is `#10744(weapon, 0x39 'blun')`, plus stat 122; a
positive sum is added to `+0x0C`. `+0x0C` is passed to `SUNITDMG_FillPacket` in `eax` and seeds its %ED pool
(`0x6FCFC539 mov edi, eax`). Wands / staves / scepters are `rod` -> `blun`. Oracle `p52-necromancer-curses` F=948:
`raw[3] = 50`, phys 1477 (replica before: 667). TS: `executeStandardSkillMeleeHit113c` adds 50 to the unrolled %ED and
reports it as `enDmgPct113c` (trace `raw[3]`); stat 122 stays in `executeSUnitDmg`'s target-type pool (not in `raw[3]`).

## 10. Curses on the attacking monster and on death

- The `FillPacket` %ED pool (§2) includes the attacker's `STAT 25 damagepercent` (+ 17 / 18), so a Weakened zombie
  (state 19, `damagepercent -33`) rolls in `512 - 168 .. 768 - 253`: oracle `p52-necromancer-curses` F=1137
  `344 + 3348205439 % 171 = 475`. TS: `edPct = aura %ED + statList damagepercent` in `resolveMonsterAttackOnPlayer`.
- On monster death the timed states are removed in the death frame, untimed ones stay (oracle F=968: zombie #10 dies
  with Weaken -> `[105]`). TS: `applyMonsterDeath` (oracle path). Pending: the original removal routine address.

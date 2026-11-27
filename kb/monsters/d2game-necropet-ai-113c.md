# D2Game 1.13c `NecroPet` monster AI (`0x6FC3E900`) and the pet follow helpers

Port of the `MonAI.txt` row 67 `NecroPet` (MonStats `AI = NecroPet`: `claygolem` 289, `bloodgolem` 290,
`irongolem` 291, `firegolem` 292, `valkyrie` 357, `necroskeleton` 363, `necromage` 364, revives) for
player summons on the DRLG oracle path. Every address is a `D2Game.dll` 1.13c VA (base `0x6FC20000`);
D2Common calls are written as `#ordinal` (import thunk → IAT). TS port:
[`necropet-ai-113c.ts`](../../src/server/engine/game-instance/necropet-ai-113c.ts)
(`stepNecroPet113c`, `necroPetMeleeThink113c`, `petFollowCheck113c`, `petMoveToOwner113c`,
`aiIdleWander113c`, `aiApproachPos113c`, `aiApproachTarget7_113c`, `aiStall113c`). Spawn side:
[`d2game-summon-pet-spawn-113c.md`](./d2game-summon-pet-spawn-113c.md).

Verification: `npx tsx tools/oracle/trace-window.ts p52-necromancer-poison-golem --unit 1:12` (Clay
Golem, unit 12) and `p52-amazon-valkyrie --unit 1:12`. Ported classes in the replica:
`NECROPET_PORTED_HCIDX_113C = {289, 290, 291, 292, 357}`; skeletons/mages/revives still run the generic
`SummonManager.tickPets` AI (the skeleton spawn init `0x6FC6EB50` → `0x6FC6E960` / `0x6FC6E390` is not
ported; first blocker of `p52-necromancer-curses` at F1517).

> [!IMPORTANT]
> Correction to [`d2game-pet-hireable-ai-113c.md`](./d2game-pet-hireable-ai-113c.md) §5: the dispatcher
> does **not** compare `hcIdx` with 364. It tests `pAiTick->pAiGeneral->[+0x14]` (`0x6FC3E929..0x6FC3E934`,
> `pAiGeneral = pMonsterData+0x28`); non-zero → ranged `0x6FC3E3D0`, else melee `0x6FC3E640`. The replica
> treats `necromage` as the ranged case and throws "not ported" for it.

## 0. AI tick driver (`0x6FCBD3B0`) and timing

The type-2 event (`EVENT_SetEvent(pGame, pUnit, 2, frame, 0, 0, 0)` `0x6FCAEA80`) runs the driver:
`0x6FCBCD90` (stun state `0x15` → stall 3; `0x6FCBCCF0`; `0x6FCBCB30` leader follow), the
`dwAiFlag`-indexed target search `0x6FCBD160` (jump table `0x6FCBD20C`; NecroPet's flag is 0 → no search),
`0x6FCBCFE0` (only with a target), then `pfnAiThink` (`0x6FCBD4E9 call [eax+4]`). None of these draw for a
NecroPet without a driver target.

- First event: `D2GAME_SummonPet` `frame + 25` (`0x6FCC37B5`); Valkyrie re-schedules `frame + 20`
  (`0x6FC6D877`). Oracle: golem spawned F637 → first think F662; Valkyrie F642 → F662.
- Stall `0x6FD122C0(pGame, pPet, n)`: `MONSTER_StartMode(NU)` unless already NU (`0x6FD122D8`), then the
  next event at `frame + max(1, n)`. This is what ends the golem's `S1` summon animation at F662.
- While the pet walks (`WL`/`RN`) no event is pending; the replica thinks again on the frame the path
  ends (same model as the zombie port).

## 1. Dispatcher `0x6FC3E900`

Frees the unit's pending type-2 events (`0x6FCAE6F0` loop over `pUnit+0xDC`), then ranged / melee as above.

## 2. Melee `0x6FC3E640`

```
owner = 0x6FD003A0(pMonsterData+0x28 -> owner type/id)            ; no owner: target-only branch (not ported)
ownerDist = 0x6FCD0A20(pPet, owner)                                ; size-subtracted octile
if ownerDist > 50: return PetMove(pPet, owner, 3, 0, 0, 0)         ; 0x6FC3E70A
run = Velocity > 0 ? min(100, Run*100/Velocity - 100) : 100         ; 0x6FC3E730..0x6FC3E74E (MonStats +0x32/+0x34)
if ownerDist > 28: return PetMove(pPet, owner, 0, 0, run, 0)        ; 0x6FC3E753
ownerT = FindNearest(owner); if ownerT && ownerT->dwFlags bit30: ownerT = 0   ; 0x6FC3E786..0x6FC3E7A3
petT, dist, melee = FindNearest(pPet)                               ; 0x6FC3E7B5
target = (petT && dist <= 24 && dist <= 6) ? petT : 0               ; 0x6FC3E7BA..0x6FC3E7CC
if !target && ownerT && 0x6FCD0A20(pPet, ownerT) < 36: target = ownerT ; 0x6FC3E7D0..0x6FC3E7DF
if !0x6FCD0E90(pPet, target): target = 0                            ; null target -> 0
r = SEED_Inline(pPet).lo % 100                                      ; 0x6FC3E7F0..0x6FC3E810
if (r < 15 ? Follow(target, melee, 1, 8) : Follow(target, melee, 0, 7)): return   ; 0x6FC3E832
if !target || town: return AI_IdleWander(4)                         ; 0x6FC3E853 -> 0x6FD129B0
if melee:                                                           ; 0x6FC3E874
  if rollLimited(100) < 80: 0x6FD12220(A1, target) else stall 10    ; attack: see §2.1
else: pAiControl+0x20 = 12; 0x6FD13000(pGame, pPet, target, 7)      ; 0x6FC3E8B7
```

`0x6FD13000`: `pAiControl+0x18 = 13`, `AI_ApproachTarget(pTarget, WL, 0, 0, 1, 7)`; on failure flag 2 draws
`lo % 100`: `< 70` wander 4, else stall 10.

### RNG consumption (pPet->pSeed)

| Branch | Draws |
|---|---|
| every think | 1 (`lo % 100`, follow threshold 8 vs 7) |
| Follow → state 2 (idle owner, far from warp pos) | +1 (`rollLimited(100)`), stall 15 (golem F662/F677/F692: 2 draws) |
| state 2, roll < 10 | +1 (`rollLimited(3)`) + wander (4) |
| Follow → state 0 (owner moving) | 0 (golem F707: 1 draw, walk) |
| no follow, no target | wander: 4 |
| target, not melee | 0 (+1 `lo % 100` if the approach fails) |
| target, melee | 1 (`rollLimited(100)`) |

### 2.1 Attack `0x6FD12220` and the A1 swing

`0x6FD12220(eax = pPet, pGame, nMode, pTarget)` fills the mode-change struct (`0x6FC95070`) and calls
`MONSTER_StartMode(pGame, &struct, 1)` (`0x6FC95E10`). The path stops, the `pAiControl` overrides are
consumed, and no type-2 event is pending while `A1` runs. TS `aiAttack113c`.

**Timing** (`UNITS_UpdateAnimRateAndVelocity` `0x6FD833DE..0x6FD8354F`, mode init `0x6FD835F0`; TS
`petAttackTiming113c`):

- Transform remap `0x6FDA01E0`: a `gfxtype = 2` state (Valkyrie state 93 → player class 0) makes the pet a
  player-type unit. Monster mode 4 becomes player mode 7 (`0x6FDE30D8[4]`) and the COF is
  `token + A1 + wclass(weapon)` (`0x6FD93860`). Otherwise the COF is `code + A1 + HTH`.
- `rate = STAT 68 (100 from MONSTER_InitStats 0x6FCCFFC5) + diminished item_fasterattackrate`
  (`0x6FD823E0`, base 120), clamped `[15, 175]`. `speed = AnimData.speed * rate / 100`.
- Start frame `0x6FD82220` (table `0x6FDE4480`, weapon-class index `0x6FDEF028`): non-zero only for
  player-type Amazon / Sorceress A1/A2 (`HTH` → 1; `1HS/1HT/STF/2HS/2HT` → 2). Shared with players, see
  [`../engine/d2common-animdata-dispatcher-113c.md`](../engine/d2common-animdata-dispatcher-113c.md).
- Action on `ceil((event - start) * 256 / speed)`, `NU` on `ceil((frames - start) * 256 / speed)`, then the
  next AI event at `end + max(1, MonStats.aidel[diff])` (golem 15, Valkyrie 6).

Oracle: Clay Golem `G1A1HTH` (16 frames, event 9, speed 232) F813 → hit F823 → NU F831; Valkyrie
`AMA12HT` (18 / 11, rate 110, start 2) F851 → hit F860 → NU F866.

**Swing resolution** on the action frame (`0x6FC64AC0` → `0x6FCFE5A0` → `0x6FCFDDE0` → `SUNITDMG`; TS
`resolvePetMeleeSwing113c`), all draws on `pPet->pSeed`:

1. To-hit (`0x6FCFE011`), then the defender's shield block on the defender seed (`toblock > 0` only).
2. `SUNITDMG_FillPacket` (`0x6FCFC530`): weapon damage (two-handed → `secondary_min/maxdamage`) or the pet
   stats 21/22. The pet stats come raw from MonStats `A1MinD/A1MaxD` (no MonLvl ratio for summons). For the
   Valkyrie, item op 13 (`item_min/maxdamage_percent`) folds into the weapon base damage. One exclusive roll.
3. CS/DS block `0x6FCFD51A..0x6FCFD5B4` (any attacker): one `rand(100)` per non-zero chance
   ([`../combat/d2game-sunitdmg-player-defender-113c.md`](../combat/d2game-sunitdmg-player-defender-113c.md) §3).
4. Elemental pairs fire 48/49, lightning 50/51, cold 54/55, magic 52/53 (draw only when `max > min`).
5. `RAND(1)` (`0x6FCFD908`, unconditional), then `MonStats.crit` (`0x6FC9713B`).

Oracle draws: Valkyrie F860 6 (to-hit, phys 1300 + 886 = 2186, CS, lightning 256 + 936 = 1192, `RAND(1)`,
crit); Clay Golem F823 4 (to-hit, phys 1228 + 188 = 1416, `RAND(1)`, crit).

After a non-lethal hit:
- The target's Event 3 is re-armed (`armMonsterEvent3AfterDamage113c`, shared with merc missiles).
- Clay Golem `EventFunc27_SlowTarget` (`0x6FC6EF70` → `ITEMEVENTS_ApplySlow` `0x6FCCD2C0`, no draw) puts
  state 24 on the target for 750 frames, `item_slow` capped 90 / 75 / 50 by difficulty.

**Step order:** pets are stepped before the room monster loop (`stepOracleNecroPetsEarly113c`). This follows
the LIFO room unit list: a pet spawned later sits at the list head. The fix moved golem F802 → F860.

The reverse direction (zombie → pet) is `resolveDrlgMonsterSwingOnPet113c`. It uses reach `#11138` with
bonus 3 and to-hit on the monster seed, then block, FillPacket, `RAND(1)` and crit. The hit branch is not
oracle-verified yet.

## 3. Follow check `0x6FC3E140(pGame, pPet, pTarget, bMelee, bSkipIdle, nFollow)`

```
ownerDist = 0x6FCD0A20(pPet, owner); ownerMode = owner->dwAnimMode
thr = nFollow + (sum of pPlayerData+0x44 pet-type counts) >> 1, max 36   ; 0x6FC3E19E..0x6FC3E1B7
if ownerDist <= 1 && ownerMode == 1 && !bMelee: return PetMove(5, thr)    ; 0x6FC3E1BB
if pTarget && !town: return ownerDist > 80 ? PetMove(3, thr) : 0          ; 0x6FC3E1F3..0x6FC3E21E
ownerZone = #10916(#10331(owner), ownerX, ownerY); petZone = same for pPet
tx,ty = #10983/#10764(owner path) (tTargetCoord); fx,fy = #10690/#10999 (tFinalTargetCoord)
state = 2
if ownerMode in {2, 6, 3}: state = 0
if tx != fx && ty != fy: state = 0
if ownerZone != petZone: state = 1
if ownerDist > thr: state = 1
if ownerDist > 50: state = 3
if 0x6FCD07B0(pPet, pPlayerData+0x148, +0x14C) < 28:                      ; last SUNIT warp position
  state 1 && ownerDist < 30 -> 4;  state 2 -> 4
if bSkipIdle && state == 2: return 0
return PetMove(state, thr)
```

`pPlayerData+0x148/+0x14C` is written by the SUNIT warp `0x6FD019C0` (`0x6FD01B19..0x6FD01B23`) and
cleared at `0x6FD0042B`; zero for a player that never warped → distance ≥ 28 → state 2 stays (matches the
oracle's 2-draw idle thinks). TS: `InternalPlayerRecord.lastWarpPos113c` (initialised `{0, 0}`; the warp
writer is **not yet wired** — open item).

## 4. `PetMove` `0x6FC3CAE0(pPet, pGame, owner, nState, bRun, nVelocity, nFollow)` (jump table `0x6FC3D39C`)

Common prefix: owner mode, `pPlayerData`, owner `tFinalTargetCoord` (`#10690/#10999`), pet and owner
positions (`#10867` X / `#10750` Y for dynamic paths).

- **State 0** `0x6FC3CC05` (owner moving): `dir = #10266(#10192(owner, fx, fy))` (64→8 table `0x6FDEF0B0`);
  `zone0 = #10916(room(owner), ownerX, ownerY)`; 8 tries: `d = 0x6FD1CED8[dir]` (`4 3 2 1 0 7 6 5`),
  `(dx, dy) = #10740(d)` (`dx 0x6FDE4EE4 = 0,-1,-1,-1,0,1,1,1`, `dy 0x6FDE4EC4 = -1,-1,0,1,1,1,0,-1`),
  candidate `(fx + 8dx, fy + 8dy)`; if `#10916(room(owner), cand) == zone0`: `|nVelocity| <= 126` assert,
  `pAiControl+0x1C = nVelocity` if non-zero, `pAiControl+0x20 = 40`, `AI_ApproachTarget(NULL, bRun ? RN : WL,
  cand, 1, 4)`, else the same to the pet/candidate midpoint `((p + c) >>> 1)`; `dir = (dir + 1) & 7`.
  All failed: free events, wander 4, then (bRun) RN / WL to the owner/pet midpoint (signed `/2`), then WL
  to the owner (flags 0). Oracle golem F707: owner (5661,5835) → final (5662,5806), dir64 40 → dir8 5 →
  `d = 7` → candidate (5670,5798).
- **State 2** `0x6FC3D0E1`: `rollLimited(100) < 10` → wander `3 + rollLimited(3)`, else / on failure
  `pAiControl+0x20 = 40` + WL to `(fx, fy)`; otherwise stall 15.
- **State 4** `0x6FC3D245`: count the owner's other pets with `0x6FCD0A20 <= 1` (`0x6FCB6AF0` + callback
  `0x6FC35590`); 0 → stall 15; else `0x6FD12D80` / wander (not ported).
- **States 1** `0x6FC3CE2A` (follow the owner's 20-entry position ring `pPlayerData+0xA8`, index `+0xA0`),
  **3** `0x6FC3D17E` (teleport next to the owner: `0x6FC67450` free spot + `0x6FD019C0` warp, stall 5),
  **5** `0x6FC3D2EC` (`0x6FD12870` step away): not ported.

`#10916` (`0x6FD8C6D0`): `DUNGEON_GetRoomAtPosition(room, x, y)` (`0x6FD51330`); 0 when outside the room and
its neighbours; otherwise `0x6FDD19C0(pRoomEx, x / 5, y / 5)` returns the `+0x28` (`nIndex`) value of the RoomEx
`D2RoomCoordListStrc` entry (`-1` if none). TS `AreaPathWorld113c.tileZoneAtPosition113c` delegates to
`DrlgRoomPopulator113c.tileZoneAt113c` (`sub_6FD77110` in `drlg-logic.ts`), falling back to the area id only when
no DRLG room populator is active. Comparing room identity instead was wrong (rejected the golem's F707 candidate
one room north).

`AI_ApproachTarget` / `MONSTER_StartMode` (`0x6FD12540`, `0x6FC94F90`): see
[`d2game-zombie-ai-113c.md`](./d2game-zombie-ai-113c.md) §2/§4; `0x6FC94F90` consumes and clears
`pAiControl+0x18` (path type, default 13 for moving modes), `+0x1C` (velocity) and `+0x20` (new distance,
default 5) on every StartMode, including the stall's NU.

## 5. `AI_FindNearestPlayerOrAlly` `0x6FCD1C90` (partial)

No seed draws. Default radius 35 (`0x6FCD1D41`), MonStats `aidist[diff]` when non-zero; candidates from
the game target lists `pGame+0x10F8` (8 buckets + tail), same act (`unit+0x18`), in a non-town room, distance
`0x6FCD08F0(cand, srcX, srcY)` `< 0x37`, not dead (`0x6FCFFA90`), `#10839(src, cand, 4) == 0`; outputs
`nTargetDist` (minimum seen when none) and `bInMeleeRange = #11138(src, target, 0)`. TS
`aiFindNearestTarget113c` approximates the lists with alive hostile (`align 0`) killable monsters of the
area; `pAiGeneral+8` flag bits (`0x40`, `0x08`) and `0x6FCD1AB0` are not modelled.

## 6. Open items

- Melee attack `0x6FD12220`: ported (§2.1). Still open: PetMove states 1, 3, 5; state 4 with stacked pets;
  ranged `0x6FC3E3D0`. On these branches the replica throws `NecroPetNotPortedError113c` and
  `stepSummonedPets` hands the pet back to the generic AI (Valkyrie: move state 1 at F984 / F1052).
- Pet `STAT_LEVEL` MonLvl to-hit / AC (`0x6FC6E2A0`) are not ported; outcomes are clamped `[5, 95]`, so no
  divergence has shown up yet.
- Walk velocity: `pct * base / 100` with `pct = 75 + accrued STAT_VELOCITYPERCENT` (monster base 75 from
  `MONSTER_InitStats` `0x6FCCFFD1`, see [`../engine/d2common-unit-velocity-113c.md`](../engine/d2common-unit-velocity-113c.md))
  and `base = MonStats.Velocity << 8`, or CharStats `WalkVelocity << 8` under a transform state (Valkyrie
  state 93, [`d2game-summon-pet-spawn-113c.md`](./d2game-summon-pet-spawn-113c.md) §6). The `75 +` assumes
  the pet stat list holds only the bonuses; Golem Mastery's `passivestat1` is applied with `#10551` (set)
  in the original — whether it replaces the 75 base is unverified (golem matches with `75 + 6`).
- `0x6FCD0E90` target validity is reduced to "alive".

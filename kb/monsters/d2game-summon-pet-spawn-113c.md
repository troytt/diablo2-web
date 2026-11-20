# D2Game 1.13c summon spawn: `D2GAME_SummonPet` (`0x6FCC3610`) and the skill callers

Spawn side of player summons on the DRLG oracle path. AI side:
[`d2game-necropet-ai-113c.md`](./d2game-necropet-ai-113c.md). TS:
[`initOracleSummonedPet113c`](../../src/server/engine/game-instance/necropet-ai-113c.ts) (called from
`summonPet` in [`summoned-pets.ts`](../../src/server/engine/game-instance/summoned-pets.ts) right after the
pet unit id / seed allocation when `drlgRoomPopulator !== null`).

## 1. Callers

- `SKILLS_SrvDo056_Golem` `0x6FC71750` (Clay #75, Blood #85, Fire #94): fills the summon struct
  (`+0x20 = #10786(petmax calc, Skills+0xC0)`, hcIdx from `Skills.summon`, `summode`), calls
  `0x6FCC3610`, then `0x6FC70070` (→ `0x6FC6E2A0` level/AC/to-hit, `0x6FC6F970` passive/aura stats,
  `0x6FC6E180`), `0x6FCAE2A0`, `0x6FD0FE40`.
- `SKILLS_SrvDo016_Valkyrie` `0x6FC6D710`: `0x6FCC3610`, `0x6FC6E2A0`, `0x6FC6F970` (incl.
  `D2GAME_CreateMonsterEquipment` `0x6FCB2ED0` at `0x6FC7005A`), frees the pet's AI events and
  re-schedules the first AI event at `frame + 20` (`0x6FC6D877`), `#10945(pPet, 0x5D, 1)`, `#10210`.

## 2. `D2GAME_SummonPet` `0x6FCC3610`

```
if !(flags & 1): 0x6FCBFA30 -> spawn position near the owner         ; position matches the oracle already
room = #10331(owner) ...; pPet = 0x6FD0EF10(spawn monster, mode 0x42 struct)  (fallback 0x6FD0F650 unless flags & 4)
0x6FCC3090(owner, pet) (pet list), pPet->dwFlags |= 0x20000
pMonsterData->pAiGeneral owner type/id                               ; 0x6FCC3713..0x6FCC372C
assert !#10494(pPet, 0x36)
0x6FCBD230(owner, pet, mode), 0x6FCCF920
free pending type-2 events; EVENT_SetEvent(pGame, pPet, 2, frame + 25, 0, 0, 0)   ; 0x6FCC37B5
```

### RNG consumption

| Seed | Draws | Where |
|---|---|---|
| game seed | 1 | pet unit seed (`SUNIT_AllocUnitData`, `allocUnitSeed113c`) |
| pet seed | outfit roll | `0x6FCEA5F0` → `MONSTER_ChooseOutfit` (`rollMonsterOutfit113c`): claygolem 1 (`MonStats2` 1 variant), valkyrie 0 |
| pet seed | 1 | `MONSTER_InitStats` HP roll `0x6FCD0043` (`rollMonsterInitStats113c`) |
| Valkyrie only | +2 pet seed, +4 game seed | `D2GAME_CreateMonsterEquipment` `0x6FCB2ED0` (from `0x6FC6F970` at `0x6FC7005A`, nLevel = slvl): slvl 1 reaches the two `level 0` `MonEquip.txt` rows (`spr` rarm rare, `ful` tors rare); each row draws `rollLimited(count)` on the pet seed even for 1 candidate (`0x6FCB2F6C..0x6FCB2FA3`), each created item allocates its unit seed and item-data seed (2 game-seed draws); the item rolls use those two item seeds only ([`d2game-monster-item-create-113c.md`](../items/d2game-monster-item-create-113c.md)). TS `createMonsterEquipmentUnits113c` |

Oracle evidence: Clay Golem F637 unit seed `[3798512748,41304058]` = 2 steps after `[957346431,666]`
(outfit + HP); Valkyrie F642 unit seed is 3 steps after its init seed, game seed +5.

## 3. Pet level `0x6FC6E2A0` (nLevel <= 0)

`STAT_LEVEL = min(ownerLevel, max(1, (3 * ownerLevel) / 4 + slvl))` (`0x6FC6E2AD..0x6FC6E2DB`, signed
`/4`), then `MonLvl.txt[level]` armor class (stat 31) and to-hit (stat 19) by difficulty/expansion
(`0x6FC6E322..0x6FC6E37A`). Oracle: owner level 40, Clay Golem slvl 5 → 35; Valkyrie slvl 1 → 31. TS sets
`level` in `initOracleSummonedPet113c`; stats 31/19 are not yet ported.

## 4. Spawn mode

The unit starts in `Skills.txt` `summode` (Clay Golem `S1` = 8, Valkyrie `NU` = 1); the golem leaves `S1`
through the AI stall at its first think (F662). TS stores `pet.mode` (exported by the oracle trace).

## 5. HP bonus (`0x6FC6F970`, `0x6FC6FCD4..0x6FC6FDA8`)

`p = #10786(calc1, Skills+0x138)`; `hp = #10913(pPet)` (max HP, 8.8 fixed); `hp += hp * p / 100` (overflow-safe
variants `0x6FD144B0` / `/100` first for large values); `STAT_MAXHP = STAT_HITPOINTS = hp`. Valkyrie
`calc1 = par1*(lvl-1) + Decoy.blvl*par8` = 20 in the scenario; Clay Golem `(100+par1*(lvl-1))*(100+GM.ln12+…)/100-100`.

## 6. Open items

- Valkyrie stats at F642: **resolved** — the two `MonEquip` items are created 1:1
  ([`d2game-monster-item-create-113c.md`](../items/d2game-monster-item-create-113c.md)): `ful` rare carries
  `+2 str` and `+9 life`, the HP bonus uses the rolled InitStats HP (460 -> 552.0) and `ilvl = calc2 = 25`;
  str 27 / maxhp 561.0 / maxmana 5.0 match. Hitpoints 561.0 (= max after the merge) is observed; its code
  site is open (item doc §9).
- Valkyrie states at F642: **resolved**. Oracle `[64, 65, 66, 68, 98, 105]`:
  - 64/65/66/68 (criticalstrike, dodge, avoid, evade): `sumskill1..5` loop of `0x6FC6F970`
    (`0x6FC6FDAD..0x6FC6FEAA`): for each `Skills+0xC4[i] > 0` with `lvl = #10786(Skills+0xD0[i]) > 0`,
    `#10302(pPet, skill, lvl)` and, for a passive skill (`SkillsTxt+0x04 & passive`), `0x6FCC2100(pPet,
    skill, -1)` switches on its `passivestate`. TS: `initOracleValkyrie113c` (states only; the passive
    stats `passive_dodge` etc. are not applied yet).
  - 98 `sourceunit`: `SKILLS_SrvDo016_Valkyrie` `0x6FC6D892` → `#10210(pPet, pOwner)` (`0x6FD83020`) stores
    the source unit and sets the state bit 98 (`0x6FD8306C`).
- Valkyrie walk velocity: **resolved**. `SrvDo016` `0x6FC6D88B` `#10945(pPet, 93, 1)` sets state 93, whose
  `States.bin` record has `+0x2D = 2`, `+0x2E = 0`. In `UNITS_UpdateAnimRateAndVelocity` (`0x6FD83140`),
  `0x6FDA01E0` walks the transform-state list (`sgptDataTables+0x17C`, count `+0x180`) and remaps a unit with
  such a state to (type 0, class `+0x2E`), so `0x6FD80D50` returns CharStats Amazon `WalkVelocity << 8`
  (`0x6FD80DAF`, `6 << 8`) instead of MonStats `Velocity << 8` (`11 << 8`). Velocity =
  `trunc(max(25, STAT_VELOCITYPERCENT + 0x6FD823E0(4)) * base / 100)` = `65% * 1536 = 998` (stat 67 = 75
  monster base − 10 `ful` armor speed). Oracle sweep: 998 matches through F850; 985 / 1001 / 1014 diverge
  at F726 / F803 / F734. TS: `transformBaseVelocityFp8113c` → `computeMonsterWalkVelocity113c(…, baseVelocityFp8)`.
  Other transform states (`+0x2D` 1/2): 63 (→ player 0), 119 (→ player 6), 139/140/176/177 (→ monster
  430/431/135/212) — not wired.
- Valkyrie melee attack `0x6FD12220`: ported ([`d2game-necropet-ai-113c.md`](./d2game-necropet-ai-113c.md) §2.1).
  Next Valkyrie blocker: F990, pet y off by one subtile after an extra pet-seed draw at F988
  (PetMove state 1 `0x6FC3CAE0` not ported).
- Raise Skeleton / Skeletal Mage (`SKILLS_SrvDo031` `0x6FC718B0`):
  - The corpse is freed with `SUNIT_RemoveUnit` (`0x6FD020A0`, call `0x6FC7199B`) before `0x6FCC3610`.
    Ported. Revive (`SrvDo058` `0x6FC71340`) does not free the corpse.
  - `0x6FC6EB50` (pet class 363 → `0x6FC6E960`, 364 → `0x6FC6E900`) is not ported. For slvl > 2,
    `0x6FC6E960` draws `rand(100)` on the owner seed, then calls `0x6FC6E390`.
  - Oracle F1517: the skeleton's max HP is 757.5 in the oracle vs 757.0 in the replica, and the player seed
    draws 1 vs 0.
- `0x6FC6F970` passive / aura stats and `sumskill`s are still the `SummonManager` model.

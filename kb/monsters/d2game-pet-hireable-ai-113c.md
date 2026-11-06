# D2Game.dll 1.13c Pet & Hireable AI Functions (`gpMonsterAiFunctionTable` @ `0x6FD2E788`)

> Reverse-engineered from `samples/d2/D2Game.dll` (1.13c, image base `0x6FC20000`),
> `samples/d2/D2Common.dll` (`D2MonStatsTxt` bin linker `0x6FDAAE00..0x6FDAC600`),
> and `samples/d2/excel/MonStats.txt` / `MonAI.txt` / `PetType.txt` / `Hireling.txt`.

## 1. Authoritative `MonAI.txt` Dispatch Table (`0x6FD2E788`)

In `D2Game.dll` 1.13c, the 148-entry `MonAI.txt` table (`gpMonsterAiFunctionTable`) is located at
VA **`0x6FD2E788`** (16-byte stride `{ dwAiFlag, pfnAiInit, pfnAiThink, pfnAiExtra }`), indexed by
`D2MonStatsTxt.wAI` (`+0x01C`) in `AIGENERAL_SetAiFunction` (`0x6FCC03D0`):

```asm
6fcc0466: shl    eax, 0x4
6fcc0469: mov    eax, DWORD PTR [eax+0x6fd2e790] ; gpMonsterAiFunctionTable[wAI].pfnAiThink
```

*(Note: `0x6FD274A8` is `gpSkillSrvDoFuncTable`, dispatched from `0x6FC4F3D2`.)*

| `MonAI.txt` Index | AI Name | `pfnAiInit` | `pfnAiThink` | `pfnAiExtra` | Summoned / Hireable Units (`MonStats.txt` `hcIdx`) |
|------------------:|---------|-------------|--------------|--------------|----------------------------------------------------|
| 1 | `Idle` | `null` | `0x6FCCC0F0` | `null` | `dopplezon` (355), `boneprison1..4` (432..435) |
| 61 | `Hireable` | `null` | `0x6FC3DD40` | `null` | `roguehire` (271), `act2hire` (338), `act3hire` (359), `act5hire1` (560), `act5hire2` (561) |
| 67 | `NecroPet` | `null` | `0x6FC3E900` | `null` | `claygolem` (289), `bloodgolem` (290), `irongolem` (291), `firegolem` (292), `valkyrie` (357), `necromancer` (363), `necromage` (364), revived monsters |
| 86 | `Hydra` | `null` | `0x6FCC57E0` | `null` | `hydra1` (351), `hydra2` (352), `hydra3` (353) |
| 105 | `ShadowWarrior` | `0x6FCCC610` | `0x6FCCC410` | `null` | `shadowwarrior` (417) |
| 106 | `ShadowMaster` | `0x6FCCC0E0` | `0x6FCCB580` | `null` | `shadowmaster` (418) |
| 107 | `Raven` | `null` | `0x6FCCA1D0` | `null` | `druidhawk` (419) |
| 108 | `DruidWolf` | `0x6FCCC8C0` | `0x6FCCC8E0` | `null` | `spiritwolf` (420), `fenris` (421) |
| 109 | `Totem` | `null` | `0x6FCCA4D0` | `null` | `spiritofbarbs` (422), `heartofwolverine` (423), `oaksage` (424) |
| 110 | `Vines` | `null` | `0x6FCCB360` | `null` | `plaguepoppy` (425) |
| 111 | `CycleOfLife` | `null` | `0x6FCCB070` | `null` | `cycleoflife` (426), `vinecreature` (427) |
| 112 | `DruidBear` | `null` | `0x6FCC9E80` | `null` | `druidbear` (428) |
| 120 | `AssassinSentry` | `null` | `0x6FCC7DC0` | `null` | `wakeofdestruction` (412), `chargedboltsentry` (413), `lightningsentry` (414), `infernosentry` (415) |
| 121 | `DeathSentry` | `null` | `0x6FCC7C20` | `null` | `deathsentry` (416) |

---

## 2. `D2MonStatsTxt` AI & Movement Field Offsets (`D2Common.dll` `0x6FDAAE00..0x6FDAC600`)

| Offset | Field | Type | Description |
|-------:|-------|------|-------------|
| `+0x032` | `nVelocity` | `WORD` | Base walk velocity (`Velocity` in `MonStats.txt`) |
| `+0x034` | `nRun` | `WORD` | Base run velocity (`Run` in `MonStats.txt`; run bonus `% = min(100, (Run * 100 / Velocity) - 100)`) |
| `+0x04F` | `nAiDelay[3]` | `BYTE[3]` | AI delay frames between decisions (`aidel`, `aidel(N)`, `aidel(H)`) |
| `+0x052` | `nAiDist[3]` | `BYTE[3]` | AI search distance (`aidist`, `aidist(N)`, `aidist(H)`, default 35 if 0) |
| `+0x056` | `wAiParam[0][3]` | `WORD[3]` | `aip1`, `aip1(N)`, `aip1(H)` |
| `+0x05C` | `wAiParam[1][3]` | `WORD[3]` | `aip2`, `aip2(N)`, `aip2(H)` |
| `+0x062` | `wAiParam[2][3]` | `WORD[3]` | `aip3`, `aip3(N)`, `aip3(H)` |
| `+0x068` | `wAiParam[3][3]` | `WORD[3]` | `aip4`, `aip4(N)`, `aip4(H)` |
| `+0x06E` | `wAiParam[4][3]` | `WORD[3]` | `aip5`, `aip5(N)`, `aip5(H)` |
| `+0x074` | `wAiParam[5][3]` | `WORD[3]` | `aip6`, `aip6(N)`, `aip6(H)` |
| `+0x07A` | `wAiParam[6][3]` | `WORD[3]` | `aip7`, `aip7(N)`, `aip7(H)` |
| `+0x080` | `wAiParam[7][3]` | `WORD[3]` | `aip8`, `aip8(N)`, `aip8(H)` |
| `+0x170` | `wSkill[0..7]` | `WORD[8]` | `Skill1..Skill8` |
| `+0x180` | `nSkillMode[0..7]` | `BYTE[8]` | `Sk1mode..Sk8mode` |

---

## 3. Shared Pet Owner-Distance, Follow & Leash-Teleport Helpers

### 3.1 `AIPET_CheckOwnerDistanceAndFollow_6FC3E140` (`0x6FC3E140..0x6FC3E3A5`)
Called by `NecroPet` (`0x6FC3E3D0`, `0x6FC3E640`), `DruidWolf` (`0x6FCCAC30`, `0x6FCCA710`), `Totem` (`0x6FCCA4D0`), `Vines` (`0x6FCCB360`), `CycleOfLife` (`0x6FCCB070`), `ShadowWarrior` (`0x6FCCC410`), and `ShadowMaster` (`0x6FCCB580`).

1. **Dynamic Crowd Follow Radius (`0x6FC3E19F..0x6FC3E1AF`)**:
   - Sums the owner's total summoned pet count (`totalPets`) across pet types (`0x6FC3DE10`).
   - Increases the base follow threshold (`baseFollowSubtiles`, passed as `6`, `7`, or `8`) by `floor(totalPets / 2)`, clamped to a maximum of **`36` subtiles** (`0x24` at `0x6FC3E1A6`).
2. **Cross-Area / Extreme Distance Leash Teleport (`0x6FC3E1CB..0x6FC3E23B`)**:
   - If the pet and owner are in different level IDs or `ownerDist > 80` subtiles (`0x50` at `0x6FC3E20B`), calls `AIPET_FollowMoveAndTeleport_6FC3CAE0(pGame, pPet, pOwner, 3, 0, 0)` to teleport the pet to a free subtile near the owner and stalls `5` frames (`0x6FC3CB37`).
3. **Standard Leash Teleport (`0x6FC3E35C..0x6FC3E375`)**:
   - When `ownerDist > 50` subtiles (`cmp edi, 0x32` at `0x6FC3E35C`), calls `AIPET_FollowMoveAndTeleport_6FC3CAE0(..., mode=3)` to **teleport** the pet to the owner (`stalls 5` frames).
4. **Follow Walk/Run (`0x6FC3E319..0x6FC3E35A`)**:
   - When `ownerDist > followThreshold` (and `<= 50`), calls `AIPET_FollowMoveAndTeleport_6FC3CAE0(..., mode=1)` to walk/run toward the owner.
5. **Idle Wander (`0x6FC3E377..0x6FC3E39A`)**:
   - When `ownerDist <= followThreshold` and the pet has no combat target (`[esp+0x30] == 0`), rolls `rand(100) < 10` (`0x6FC3CBC1`) to wander `3..5` subtiles (`0x6FC3CAE0` mode 2), or stalls `15` frames (`0x6FC3CC69`).

---

## 4. `Hireable` (Index 61 — `0x6FC3DD40..0x6FC3E139`)

> **1:1 Basic-Block Reference**: See [`d2game-mercenary-hire-aura-113c.md`](./d2game-mercenary-hire-aura-113c.md) §1–§7 for the verified instruction-by-instruction disassembly and RNG draw tables (correcting earlier summary notes: `Hireable` clears state `12` `hide`, calls `AIMERC_HireablePetMove` `0x6FC3D3C0` states `0/1/3/5`, stalls `5` frames on idle with a `5%` `AIMOV_WalkAroundTarget(16)` orbit roll, and `AIMERC_ChooseSkill` `0x6FC3C4E0` rolls `rollLimited(totalWeight + 1)` with `<= cum[i]` cumulative slot bounds).

Applies to `roguehire` (#271), `act2hire` (#338), `act3hire` (#359), `act5hire1` (#560), and `act5hire2` (#561).

### 4.1 Leash, Follow & Target Acquisition (`0x6FC3DE30..0x6FC3E08E`)
- **Self-defense scan (`0x6FC3DE36..0x6FC3DE56`)**: Scans `AI_FindNearestTarget` (`0x6FC3D3C0`) around the mercenary; if an enemy is at `dist <= 6` subtiles (`cmp dword ptr [esp+0x14], 6` at `0x6FC3DE51`), engages immediately.
- **Leash Teleport (`0x6FC3DEA9..0x6FC3DECF`)**:
  - `cmp edi, 0x64` (`0x6FC3DEA9`): If `ownerDist > 100` subtiles (`100` subtiles = `1600` px) or in a different room/level (`0x6FC3DE60`), teleports to a free subtile near the owner (`D2GAME_FindFreeCoords_6FCBD400` + `D2GAME_TeleportUnit_6FCBDE40`) and stalls `15` frames (`0x0F`).
- **Leash Run (`0x6FC3DE8C` & `0x6FC3DED4`)**:
  - `cmp edi, 0x18`: If `ownerDist > 24` subtiles (`24` subtiles = `384` px), preempts combat and **runs** (`AI_RunToUnit_6FC416D0(..., dist=4)`) back toward the owner.
- **Follow Walk (`0x6FC3DE91` & `0x6FC3DEF7`)**:
  - `cmp edi, 0x10`: If `ownerDist > 16` subtiles (`16` subtiles = `256` px), **walks** (`AI_WalkToLocation_6FC40F00`) toward the owner; when idle within `<= 5` subtiles (`0x6FC3DF2B`), `30%` chance to wander `6` steps (`0x6FC40FF0`), else stalls `15` frames (`0x6FC3DF58`).
- **Combat Target Acquisition (`0x6FC3E035..0x6FC3E04E`)**:
  - Evaluates `AI_FindNearestTarget` (`0x6FC3D3C0`, default search radius `35` subtiles) and accepts the target only if `targetDist < 25` subtiles (`cmp dword ptr [esp+0x14], 0x19; jge` at `0x6FC3E043..0x6FC3E048`, i.e. `<= 24` subtiles = `384` px).
- **Movement Speeds (`MonStats.txt`)**:
  - `roguehire` (#271), `act2hire` (#338), `act3hire` (#359): `Velocity = 7`, `Run = 11`, `aidel = 15`.
  - `act5hire1` (#560), `act5hire2` (#561): `Velocity = 8`, `Run = 14`, `aidel = 15`.
- **Attack Reach**:
  - Melee (`act2hire` `MeleeRng = 3`, `act5hire1/2` `MeleeRng = 1`): melee engagement range (`2..3` subtiles = `32..48` px).
  - Ranged (`roguehire` bow / `act3hire` spells): `20` subtiles (`320` px) via `AI_UseSkillOrApproach_6FC3C8A0` (`0x6FC3C8A0`).

### 4.2 Weighted Skill Selection (`AIMERC_ChooseSkill_6FC3C4E0` @ `0x6FC3C4E0..0x6FC3C7D5`)
1. Resolves the active `Hireling.txt` bracket row via `D2Common_11156` (`0x6FDA32C0`, highest `row.Level <= mercLevel` for `(version, id/subType)`).
2. Computes `deltaLvl = mercLevel - row.Level` (`0x6FC3C52D`).
3. Iterates over the 6 skill slots (`Skill1..Skill6`, `+0x74..+0x88` in `D2HirelingTxt`):
   - Computes `effSkillLvl = min(32, SkillLvl[i] + floor((deltaLvl * LvlPerLvl[i]) / 32))` (`sar eax, 5` at `0x6FC3C55B`). If `effSkillLvl <= 0`, skips the slot (`0x6FC3C56D`).
   - If `Mode[i] == 1` (Paladin aura on Act 2 Desert Mercenary, `0x6FC3C5A3`):
     - Checks if the mercenary already has that aura state active (`0x6FC3C5BD`); if already active, weight is **`0`** (`0x6FC3C5CB`) so the aura is activated once and never consumes combat attack rolls.
     - **No `'Might'` fallback**: Only auras explicitly listed in the mercenary's `Hireling.txt` row (`Mode[i] == 1`) can be activated.
   - Computes slot weight (`0x6FC3C649..0x6FC3C65F`):
     $$\text{weight}_i = \text{Chance}_i + \left\lfloor \frac{(\text{mercLevel} - \text{row.Level}) \times \text{ChancePerLvl}_i}{4} \right\rfloor$$
4. Computes `totalWeight = row.DefaultChance + sum(weight[0..5])` (`0x6FC3C685`).
5. Rolls `r = rand(totalWeight)` (`0x6FC3C6CD..0x6FC3C6FE`):
   - If `r < row.DefaultChance`, selects the mercenary's basic attack (`mode = 4` / `5`: `RogueMissile` for Act 1, weapon melee swing for Act 2/3/5).
   - Otherwise subtracts `row.DefaultChance` and picks the first skill slot `i` whose cumulative `weight[i]` exceeds the remaining roll (`0x6FC3C708..0x6FC3C724`).

---

## 5. `NecroPet` (Index 67 — `0x6FC3E900` -> `0x6FC3E640` Melee & `0x6FC3E3D0` Ranged)

Applies to `necromancer` (#363 Skeleton), `necromage` (#364 Skeletal Mage), `claygolem` (#289), `bloodgolem` (#290), `irongolem` (#291), `firegolem` (#292), `valkyrie` (#357), and revived monsters (`Revive` #95).

- **Dispatcher (`0x6FC3E900..0x6FC3E94B`)**:
  - **Corrected** (see [`d2game-necropet-ai-113c.md`](./d2game-necropet-ai-113c.md)): tests `pAiTick->pAiGeneral->[+0x14]` (`0x6FC3E929..0x6FC3E934`, no `hcIdx` compare); non-zero calls the ranged `0x6FC3E3D0`, otherwise the melee `0x6FC3E640`.
- **Melee `NecroPet` (`0x6FC3E640..0x6FC3E8FD`)**:
  - **Leash Teleport**: `ownerDist > 50` subtiles (`cmp ebx, 0x32` at `0x6FC3E70A` & `0x6FC3E35C`; `800` px) -> teleports to owner.
  - **Leash Run**: `ownerDist > 28` subtiles (`cmp ebx, 0x1c` at `0x6FC3E753`; `448` px) -> drops combat target and runs to within `5` subtiles of owner (`0x6FC3E765`).
  - **Follow Walk**: `ownerDist > 7 + floor(totalPets / 2)` subtiles (capped at `36`, `0x6FC3E6EA` `push 7`; `112` px base).
  - **Target Acquisition (`0x6FC3E7BD..0x6FC3E7E2`)**: Acquires target if `selfTargetDist <= 24` subtiles (`cmp eax, 0x18` at `0x6FC3E7C2`; `384` px) OR `ownerTargetDist < 36` subtiles (`cmp eax, 0x24` at `0x6FC3E7DA`; `576` px).
  - **Combat**: `80%` chance (`cmp eax, 0x50` at `0x6FC3E86B`) to attack (`A1`/`A2`), `20%` chance to stall `10` frames; post-action AI delay `aidel = 15` frames (`6` frames for `valkyrie` #357).
  - **Speed (`MonStats.txt`)**: `necromancer` (#363) `Velocity = 9, Run = 13`; `claygolem`/`bloodgolem`/`irongolem`/`firegolem` (#289..292) `Velocity = 9, Run = 9`; `valkyrie` (#357) `Velocity = 9, Run = 13`.
- **Ranged `necromage` (`0x6FC3E3D0..0x6FC3E630`)**:
  - **Leash Teleport**: `ownerDist > 50` subtiles (`0x6FC3E35C`; `800` px).
  - **Follow Walk**: `ownerDist > 8 + floor(totalPets / 2)` subtiles (`0x6FC3E469` `push 8`; `128` px base).
  - **Target Acquisition (`0x6FC3E4DD..0x6FC3E509`)**: Acquires target if `selfTargetDist <= 15` subtiles (`cmp esi, 0x0f` at `0x6FC3E4E2`; `240` px) OR `ownerTargetDist < 20` subtiles (`cmp eax, 0x14` at `0x6FC3E504`; `320` px).
  - **Combat**: `80%` chance (`0x6FC3E5C2`) to cast `NecromageMissile` (`Skill1 = 338`) at range (`<= 15..20` subtiles), `20%` chance to stall `10` frames (`aidel = 15`).

---

## 6. Druid Summons (`DruidWolf`, `DruidBear`, `Raven`, `Totem`, `Vines`, `CycleOfLife`)

### 6.1 `DruidWolf` (Index 108 — `0x6FCCC8E0` -> `0x6FCCAC30` Spirit Wolf #420 & `0x6FCCA710` Dire Wolf #421)
- **`spiritwolf` (#420 — `0x6FCCAC30..0x6FCCB060`)**:
  - `MonStats.txt`: `Velocity = 9, Run = 14, aidel = 15, aip1 = 35, aip2 = 75, aip3 = 14, aip4 = 20, aip5 = 26, aip6 = 45, Skill1 = Fenris Blink (292)`.
  - **Leash Teleport**: `ownerDist > 50` subtiles (`800` px) via `0x6FC3E140`.
  - **Leash Run**: `ownerDist > aip5` (`26` subtiles = `416` px at `0x6FCCAD4E`).
  - **Follow Walk**: `ownerDist > aip3` (`14` subtiles = `224` px at `0x6FCCAD76`) or `> 6 + floor(totalPets / 2)` (`0x6FCCAD13`).
  - **Target Acquisition**: `targetDist <= aip4` (`20` subtiles = `320` px at `0x6FCCADE8`).
- **`fenris` (#421 Dire Wolf — `0x6FCCA710..0x6FCCAC20`)**:
  - `MonStats.txt`: `Velocity = 9, Run = 14, aidel = 15, aip1 = 30, aip2 = 75, aip3 = 5, aip4 = 24, aip5 = 30, aip6 = 30, Skill1 = Fenris Rage (314)`.
  - **Leash Teleport**: `ownerDist > 50` subtiles (`800` px) via `0x6FC3E140`.
  - **Leash Run**: `ownerDist > aip5` (`30` subtiles = `480` px at `0x6FCCA8F0`).
  - **Follow Walk**: `ownerDist > aip4` (`24` subtiles = `384` px at `0x6FCCA91C`) or `> 6 + floor(totalPets / 2)` (`0x6FCCA8B5`).
  - **Target Acquisition**: `targetDist <= aip4` (`24` subtiles = `384` px at `0x6FCCAA95`); corpse search for `Fenris Rage` (#314) within `20` subtiles (`0x14` at `0x6FCCAB17`).

### 6.2 `DruidBear` (Index 112 — `0x6FCC9E80..0x6FCCA1C0`, `druidbear` #428)
- `MonStats.txt`: `Velocity = 9, Run = 14, aidel = 15, aip1 = 15, aip2 = 75, aip3 = 50, Skill1 = BearSmite (326)`.
- **Leash Teleport**: `ownerDist > 50` subtiles (`cmp edi, 0x32` at `0x6FCC9F2A`; `800` px).
- **Leash Run**: `ownerDist > 28` subtiles (`cmp edi, 0x1c` at `0x6FCC9F95`; `448` px).
- **Follow Walk**: `ownerDist > 18` subtiles (`cmp edi, 0x12` at `0x6FCC9FBA`; `288` px; `> 16` subtiles when idle at `0x6FCCA004`).
- **Target Acquisition**: `targetDist <= 28` subtiles (`cmp dword ptr [esp+0x18], 0x1c` at `0x6FCCA03C`; `448` px).
- **Combat**: `aip2 = 75%` attack roll (`0x6FCCA106`); `aip3 = 50%` chance to use `BearSmite` (#326) (`0x6FCCA136`), else standard melee + `aip1 = 15`f delay.

### 6.3 `Raven` (Index 107 — `0x6FCCA1D0..0x6FCCA4C0`, `druidhawk` #419)
- `MonStats.txt`: `Velocity = 12, Run = 18, aidel = 15, aip1 = 10, aip2 = 6, aip3 = 5, aip4 = 75, aip5 = 35, Skill1 = Raven (293)`.
- **Leash Teleport**: `ownerDist > 50` subtiles (`cmp eax, 0x32` at `0x6FCCA277`; `800` px).
- **Leash Run**: `ownerDist > 28` subtiles (`cmp eax, 0x1c` at `0x6FCCA28C`; `448` px).
- **Orbit Follow**: Orbits `6..10` subtiles (`aip2..aip1`) around owner (`0x6FCCA335..0x6FCCA367`).
- **Target Acquisition**: `targetDist < aip5` (`35` subtiles = `560` px at `0x6FCCA3D3`); `aip4 = 75%` swoop attack chance (`0x6FCCA3EB`), swoop cooldown `10 * aip3 = 50` frames (`0x6FCCA2B8`).

### 6.4 `Totem` (Index 109 — `0x6FCCA4D0..0x6FCCA700`, `spiritofbarbs` #422, `heartofwolverine` #423, `oaksage` #424)
- `MonStats.txt`: `Velocity = 7, Run = 7, aidel = 15, aip1 = 80, aip2 = 20, aip3 = 30, aip4 = 20, aip5 = 7`.
- **Leash Teleport**: `ownerDist > aip3` (`30` subtiles = `480` px at `0x6FCCA5EF`) or `> 50` subtiles via `0x6FC3E140`.
- **Follow Walk**: `ownerDist > aip4` (`20` subtiles = `320` px at `0x6FCCA660`) or `> 6 + floor(totalPets / 2)` via `0x6FC3E140`.
- **Combat**: Non-attacking aura spirit (`aggroSubtiles = 0`, pulses `Skill1 = 296 / 297 / 298` every `aip2 = 20` frames with `aip1 = 80%` weight).

### 6.5 `Vines` (Index 110 — `0x6FCCB360`, `plaguepoppy` #425) & `CycleOfLife` (Index 111 — `0x6FCCB070`, `cycleoflife` #426, `vinecreature` #427)
- `MonStats.txt`:
  - `plaguepoppy` (#425): `Velocity = 8, Run = 13, aidel = 15, aip1 = 60, aip2 = 20, aip5 = 35, Skill1 = Vine Attack (294)`.
  - `cycleoflife` (#426) / `vinecreature` (#427): `Velocity = 11, Run = 11, aidel = 15, aip1 = 60, aip2 = 20, aip3 = 25, aip5 = 35, Skill1 = CorpseCycler (307) / VineCycler (325)`.
- **Leash Teleport**: `ownerDist >= aip5` (`35` subtiles = `560` px at `0x6FCCB3E4` / `0x6FCCB108`).
- **Follow Walk**: `ownerDist > 6 + floor(totalPets / 2)` subtiles via `0x6FC3E140`.
- **Target / Corpse Range**: `< aip2` (`20` subtiles = `320` px at `0x6FCCB466` / `0x6FCCB1E8`).

---

## 7. Assassin Shadows (`ShadowWarrior` #417 & `ShadowMaster` #418)

### 7.1 `ShadowWarrior` (Index 105 — `0x6FCCC410..0x6FCCC600`, `shadowwarrior` #417)
- `MonStats.txt`: `Velocity = 9, Run = 13, aidel = 15, aip1 = 40, aip2 = 30, aip3 = 70`.
- **Leash Teleport**: `ownerDist > 50` subtiles (`800` px) via `0x6FC3E140`.
- **Leash Drop Target**: `ownerDist > aip2` (`30` subtiles = `480` px at `0x6FCCC4AF`).
- **Follow Walk**: `ownerDist > 6 + floor(totalPets / 2)` subtiles via `0x6FC3E140`.
- **Target Acquisition**: `targetDist <= aip1` (`40` subtiles = `640` px at `0x6FCCC4A5`); mirrors owner's active left/right skills (`aip3 = 70%` attack chance).

### 7.2 `ShadowMaster` (Index 106 — `0x6FCCB580..0x6FCCC0D0`, `shadowmaster` #418)
- `MonStats.txt`: `Velocity = 9, Run = 13, aidel = 15, aip1 = 60, aip2 = 20`.
- **Leash Teleport**: `ownerDist > 50` subtiles (`800` px) via `0x6FC3E140`.
- **Leash Run**: `ownerDist > aip2` (`20` subtiles = `320` px at `0x6FCCB7B9`).
- **Follow Walk**: `ownerDist > 6 + floor(totalPets / 2)` subtiles via `0x6FC3E140`.
- **Target Acquisition**: `targetDist <= aip2` (`20` subtiles = `320` px at `0x6FCCB884`).

---

## 8. Stationary Sentries, Hydra & Decoy (`AssassinSentry`, `DeathSentry`, `Hydra`, `Idle`)

All stationary units have `Velocity = 0, Run = 0` (or `AI = Idle`) and **never follow or teleport**.

- **`AssassinSentry` (Index 120 — `0x6FCC7DC0..0x6FCC7F30`)**:
  - Target acquisition `< aip4` (`0x6FCC7ECF`):
    - `wakeofdestruction` (#412, Wake of Fire): `aip4 = 15` subtiles (`240` px).
    - `chargedboltsentry` (#413, Charged Bolt Sentry): `aip4 = 25` subtiles (`400` px).
    - `lightningsentry` (#414, Lightning Sentry): `aip4 = 15` subtiles (`240` px).
    - `infernosentry` (#415, Wake of Inferno): `aip4 = 16` subtiles (`256` px).
- **`DeathSentry` (Index 121 — `0x6FCC7C20..0x6FCC7DB0`, `deathsentry` #416)**:
  - Corpse search radius `< (10 + slvl - 1) / 2` subtiles (`0x6FCC7CBE..0x6FCC7CE2`); lightning bolt target acquisition `< aip4` (`16` subtiles = `256` px) via fallback to `0x6FCC7DC0`.
- **`Hydra` (Index 86 — `0x6FCC57E0..0x6FCC5950`, `hydra1..3` #351..353)**:
  - Target acquisition `< 25` subtiles (`cmp dword ptr [esp+0x0C], 0x19` at `0x6FCC5896`; `400` px); `60%` fire chance (`cmp eax, 0x3C` at `0x6FCC58AD`), `aidel = 15` frames.
- **`Idle` (Index 1 — `0x6FCCC0F0`, `dopplezon` #355 & `boneprison` #432..435)**:
  - Stalls `15` frames (`0x6FCCC0F9`); never moves or attacks (`aggroSubtiles = 0`).

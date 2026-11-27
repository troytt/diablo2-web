# `a1c-bloodmoor-fallen` (`F150..F2000`) VA Execution Blueprint

Longitudinal VA timeline, `pGame->tSeed` (`gs`) transition accounting, unit lifecycle table, and exact `D2Game.dll` / `D2Common.dll` call chains for Exit Gate 4 (`a1c-bloodmoor-fallen`, 2,000 frames).

- **Scenario**: `tests/fixtures/oracle/scenarios/a1c-bloodmoor-fallen.json` (`mapSeed = 11223344`, `charClass = 4` Barbarian L1, `initPos = (5653, 5918)`).
- **Golden trace**: `tests/fixtures/oracle/golden/a1c-bloodmoor-fallen.oracle.ndjson.gz` (`F1..F2000`, `t3 = []` throughout — zero missiles are spawned across all 2,000 frames).
- **Coverage trace**: `tests/fixtures/oracle/k1/replay/a1c-bloodmoor-fallen.coverage.ndjson.gz` (`1,055` hit functions out of `4,810` entries).
- **Lane G pure kernel modules**:
  - `src/d2kern-113c/game/regpop-spawn-113c.ts` — `REGPOP` wilderness density & pack spawning, `MONSTER` class/rarity/party-minion selection, `MONREG` outfit tables, `SUNIT` unit/item seed initialization, and `OBJECTS` room random object density/shrine rolls.
  - `src/d2kern-113c/game/ai-fallen-113c.ts` — `AIGENERAL` boss-group linking, death leader promotion & war-cry broadcast, `AI` target acquisition & idle throttling, `AI_FallenShaman` + corpse filter, `AI_Skeleton` (`0x6FCA3550`), and `MONSTER` melee attack start/step/swing/crit.

---

## 1. Exact Game Seed (`gs` = `pGame->tSeed` @ `+0xD0/+0xD4`) Transitions (`F1..F2000`)

Across all 2,000 frames of `a1c-bloodmoor-fallen`, `pGame->tSeed` advances on **exactly 7 frames** (`2,270` total LCG steps after boot):

| Frame | Before `(lo, hi)` | After `(lo, hi)` | Exact LCG Steps | Instruction-Level Source Breakdown |
|---:|---|---|---:|---|
| `F2` | `(1589894575, 666)` | `(2189963941, 588192779)` | `44` | Game/Act 1 boot & Town setup (`F1..F2`). |
| `F151` | `(2189963941, 588192779)` | `(2743272323, 1342460360)` | **`509`** | `3` Blood Moor `8×8`-tile (`40×40`-subtile) rooms populated: `3 × 169 = 507` `MONSTER_PopulateRoom` (`0x6FC67A20` @ `0x6FC67B48`) `% 100000` density rolls (`0` packs spawned because near Town exit / low `MonDen`) + `2` random objects allocated via `OBJECTS_SpawnDensityObjectsInRoom` (`0x6FC52CE0` -> `0x6FC51E20` -> `SUNIT_AllocUnitData` `0x6FD01D90` -> `SUNIT_InitUnitSeed` `0x6FD00110`, `+1` `gs` step per object). |
| `F224` | `(2743272323, 1342460360)` | `(1069389260, 399301891)` | **`510`** | `3` Blood Moor rooms streamed in: `3 × 169 = 507` `0x6FC67A20` density rolls + `3` Zombies (`id=9, 10, 11`, `class=5` `zombie1`) allocated via `0x6FD00110` (`+1` `gs` step each; `0` random objects). |
| `F689` | `(1069389260, 399301891)` | `(3362599106, 1544550649)` | **`342`** | `2` Blood Moor rooms streamed in: `2 × 169 = 338` `0x6FC67A20` density rolls + `4` Fallen (`id=12..15`, `class=19` `fallen1`: 1 pack leader + 3 `SetBoss=1` party minions via `0x6FD0E480`) allocated via `0x6FD00110` (`+4` `gs` steps). |
| `F1004` | `(3362599106, 1544550649)` | `(1635311741, 300097795)` | **`346`** | `2` Blood Moor rooms streamed in: `2 × 169 = 338` `0x6FC67A20` density rolls + `3` Zombies (`id=16..18`, `class=5`) + `5` random objects (`+8` `0x6FD00110` `gs` steps). |
| `F1033` | `(1635311741, 300097795)` | `(3728736013, 367307274)` | **`517`** | `3` Blood Moor rooms streamed in: `3 × 169 = 507` `0x6FC67A20` density rolls + `10` monsters (`id=19..22` Fallen pack, `id=23..26` Fallen pack, `id=27..28` Quill Rat pack `class=63`) allocated via `0x6FD00110` (`+10` `gs` steps). |
| `F1040` | `(3728736013, 367307274)` | `(2900923968, 1362170134)` | **`2`** | Fallen `#13` dies and drops `1` item (`type=4`): `SUNIT_InitUnitSeed` (`0x6FD00110`, `+1` `gs` step) + `SUNIT_InitExtraItemSeed` (`0x6FD000C0`, `+1` `gs` step). |

### Critical Seed-Stream Partitioning (`D2Game.dll` Binary Evidence)

1. **Grid density (`169` rolls per Blood Moor room) uses `pGame->tSeed` (`+0xD0/+0xD4`)**:
   - In `REGPOP_PopulateRoomMonsters` (`0x6FC67A20`), Blood Moor rooms are `8×8` tiles = `40×40` subtiles (`w = 40`, `h = 40`).
   - `cols = floor(40 / 3) = 13`, `rows = floor(40 / 3) = 13` -> `13 × 13 = 169` cells (`0x6FC67ACE..0x6FC67B05`).
   - At `0x6FC67B30..0x6FC67B64`, every cell advances **`pGame->tSeed` (`[ebp + 0xD0]`)** with `% 100000` (`0x186A0`) and compares `< dwMonDen` (`Levels.txt +0x58 + diff*4`: Blood Moor Normal `MonDen = 600` -> `0.6%` per cell). If `bSparsePopulate` (`Levels.txt +0x4E`) is non-zero, a second `% 100 >= 75` roll on `pGame->tSeed` runs at `0x6FC67BB5..0x6FC67BE5` (Blood Moor has `bSparsePopulate == 0`).
2. **Pack rarity, species selection, coord jitter, and `MONSTER_Create` use `pRoom->tSeed` (`+0x6C`)**:
   - `MONSTER_RollPackRarityType` (`0x6FCFF080`), `MONSTER_ChooseMonsterClass` (`0x6FCFF4A0`), `REGPOP_FindPackSpawnCoords` (`0x6FC67450`), and `MONSTER_Create` (`0x6FD0EF10`) advance `&pRoom->tSeed` (`pRoom + 0x6C`), NOT `pGame->tSeed`.
3. **Pack size & party minion rings use `pLeader->tSeed` (`+0x20`)**:
   - `REGPOP_SpawnMonsterPack` (`0x6FC67700`) and `MONSTER_SpawnPartyMinions` (`0x6FD0E480`) advance `&pLeader->tSeed` (`pUnit + 0x20`).
4. **Random object density & shrine selection use `pObjectControl->tSeed` (`[pGame + 0x10F0]`)**:
   - `OBJECTS_SpawnDensityObjectsInRoom` (`0x6FC52CE0`), `OBJECTS_SpawnRandomObjectInRoom` (`0x6FC51E20`), `OBJECTS_InitChestLock` (`0x6FC4ECB0`), and `OBJECTS_InitShrineType` (`0x6FC4EF90`) roll on `pObjectControl->tSeed`, while each spawned object unit consumes `+1` draw from `pGame->tSeed` inside `SUNIT_InitUnitSeed` (`0x6FD00110`).
5. **Unit allocation (`0x6FD00110` / `0x6FD000C0`)**:
   - Every non-player unit (`dwUnitType != 0`) advances `pGame->tSeed` (`+0xD0/+0xD4`) by `+1` inline `0x6AC690C5` LCG step (`0x6FD00142..0x6FD00159`) inside `SUNIT_InitUnitSeed` (`0x6FD00110`), writes `pUnit->dwInitSeed (+0x28) = newLo`, and calls `SEED_InitLowSeed(&pUnit->tSeed, newLo)` (`lo = newLo, hi = 666`) — which is why Zombie `#11` (`(1069389260, 666)`) and Fallen `#15` (`(3362599106, 666)`) share the exact final `lo` of `pGame->tSeed` on `F224` and `F689` (`SEED_GenerateLoopSeed` `0x6FD86760` is the `pGameSeed == NULL` fallback at `0x6FD00168`).
   - Item units (`dwUnitType == 4`) additionally call `SUNIT_InitExtraItemSeed` (`0x6FD000C0`), taking a second inline `0x6AC690C5` LCG draw on `pGame->tSeed` for `ITEMS_GetItemSeed(pItem)` (`+2` total `gs` steps per dropped item, matching `F1040`).

---

## 2. Sampled Unit Table (`F1..F2000`)

- **Player (`t0`)**: `id=1`, `class=4` (Barbarian), `F2..F2000`, `init=(5653, 5918)`, `lvl=1 -> 2` at **`F150`**, `hp=14080/14080 -> 13700` at **`F1568`**, `xp=0 -> 18 (F801) -> 36 (F1040) -> 54 (F1402) -> 72 (F1681)`.
- **Rogue Encampment NPCs (`t1 id=1..8`, `lvl=1`)**:
  - `id=1..4` (`152` `rogue1` ×2, `150` `kashya`, `155` `warriv1`): `F2..F275`, streamed out on **`F276`**.
  - `id=5..8` (`148` `akara`, `154` `charsi`, `152` `rogue1` ×2): `F2..F347`, streamed out on **`F348`**.
- **Blood Moor Wilderness Monsters (`t1 id=9..28`, `lvl=2`)**:

| Unit ID | Class ID | Species | Frames Present | Spawn `(x, y)` | Initial Seed `(lo, hi)` | HP (`>>8`) | XP (`stat 13`) | Outcome / Key Transitions |
|---:|---:|---|---|---|---:|---:|---:|---|
| `9` | `5` | `zombie1` | `F224..F1151` | `(5664, 5792)` | `(646028633, 666)` | `2304` (`9`) | `33` | Pack 1 leader; streamed out at `F1152`. |
| `10` | `5` | `zombie1` | `F224..F1151` | `(5661, 5795)` | `(183606224, 666)` | `2304` (`9`) | `33` | Pack 1 member; streamed out at `F1152`. |
| `11` | `5` | `zombie1` | `F224..F2000` | `(5639, 5784)` | `(1069389260, 666)` | `2304` (`9`) | `33` | Pack 2 solo; idle wander `1->2` (`F1206`), `2->1` (`F1323`). |
| `12` | `19` | `fallen1` | `F689..F2000` | `(5599, 5796)` | `(2064683816, 666)` | `1024` (`4`) | `18` | Fallen party leader; wakes `F766`; **killed `F801`** (`2->0`), `DD` `12` (`F821`). |
| `13` | `19` | `fallen1` | `F689..F2000` | `(5599, 5793)` | `(1243220042, 666)` | `256` (`1`) | `18` | Party minion -> promoted leader `F801`; `A2` `F1032`; **killed `F1040`** (`5->0`, drops item), `DD` `12` (`F1060`). |
| `14` | `19` | `fallen1` | `F689..F2000` | `(5599, 5799)` | `(994032829, 666)` | `256` (`1`) | `18` | Party minion -> promoted leader `F1040`; `A1` `F1395`; **killed `F1402`** (`4->0`), `DD` `12` (`F1422`). |
| `15` | `19` | `fallen1` | `F689..F2000` | `(5597, 5799)` | `(3362599106, 666)` | `1024` (`4`) | `18` | Party minion -> promoted leader `F1402`; war cry `S2` (`9`) `F1414..F1438`; 5 melee swings `F1490..F1660` (hits Barbarian at `F1568`); **killed `F1681`** (`1->0`), `DD` `12` (`F1701`). |
| `16` | `5` | `zombie1` | `F1004..F1151` | `(5663, 5721)` | `(2785801744, 666)` | `2304` (`9`) | `33` | Streamed out at `F1152`. |
| `17` | `5` | `zombie1` | `F1004..F1151` | `(5666, 5724)` | `(3214594035, 666)` | `2560` (`10`) | `33` | Streamed out at `F1152`. |
| `18` | `5` | `zombie1` | `F1004..F1151` | `(5663, 5726)` | `(2067948085, 666)` | `2304` (`9`) | `33` | Streamed out at `F1152`. |
| `19..22` | `19` | `fallen1` | `F1033..F2000` | `(5536..5538, 5801..5807)` | `(... , 666)` | `256..768` | `18` | West Fallen party (`id=19` leader + `id=20..22` minions); remain out of aggro range. |
| `23..26` | `19` | `fallen1` | `F1033..F2000` | `(5538..5541, 5758..5764)` | `(... , 666)` | `512..768` | `18` | Northwest Fallen party (`id=23` leader + `id=24..26` minions); remain out of aggro range. |
| `27..28` | `63` | `quillrat1` | `F1033..F1499` | `(5541, 5758)`, `(5538, 5759)` | `(... , 666)` | `1024`, `768` | `21` | Quill Rat pair (`SUNIT` skill init `0x6FC21D90`/`0x6FC21DB0` on `F1033`); streamed out at `F1500` without firing `t3` missiles. |

---

## 3. Chronological VA Call Chains (`F150..F2000`)

### Phase A: Town -> Blood Moor Transition & Room Streaming (`F150..F348`)
- **`F150`**: Barbarian steps onto `(5651, 5839)` (`lvl=1 -> 2`):
  - `CLIENTS_SetPlayerCurrentRoom` (`0x6FC6B1D0`) diffs `DUNGEON_GetAdjacentRoomsListFromRoom(pNewRoom)` vs `DUNGEON_GetAdjacentRoomsListFromRoom(pOldRoom)`.
  - Enters `0x6FCBDC10` (activate newly adjacent rooms) + quest room-enter callbacks (`0x6FCE9190`, `0x6FCE6450`, `0x6FCE6E00`, `0x6FCE73A0`) and updates player portal/level visited flags (`0x6FD8BC40` / `0x6FD7EB30`).
- **`F151`** (**Current first strict divergence**):
  - `ACT_UpdateAllRooms` (`0x6FC6B400`) populates the 3 newly active Blood Moor rooms:
    - `OBJECTS_SpawnDensityObjectsInRoom` (`0x6FC52CE0`) -> `0x6FC51E20` -> `0x6FC4ECB0` / `0x6FC4EF90` (`2` objects -> `+2` `gs` steps).
    - `REGPOP_PopulateRoomMonsters` (`0x6FC67A20`) -> `REGPOP_CanPopulateRoom` (`0x6FC66CD0`) -> `169` cells × `3` rooms = `507` `gs` steps (`507 + 2 = 509`).
- **`F224`**:
  - Player crosses into next room row; `3` Blood Moor rooms populate (`507` `gs` steps) and `REGPOP_PopulateRoomMonsters` (`0x6FC67A20`) rolls `2` normal Zombie packs (`MONSTER_RollPackRarityType` `0x6FCFF080` -> `0` normal, `MONSTER_ChooseMonsterClass` `0x6FCFF4A0` -> `class=5` `zombie1`):
    - `REGPOP_SpawnMonsterPack` (`0x6FC67700`) -> `REGPOP_FindPackSpawnCoords` (`0x6FC67450` -> `REGPOP_IsNearTownExitOrWaypoint` `0x6FC66B20` `dist >= 17` from town border) -> `MONSTER_SpawnPackLeader` (`0x6FD0F510`) / `MONSTER_SpawnPackMember` (`0x6FD0F570`) -> `MONSTER_Create` (`0x6FD0EF10`).
    - `MONSTER_Create` (`0x6FD0EF10`) calls `SUNIT_AllocUnitData` (`0x6FD01D90` -> `SUNIT_InitUnitSeed` `0x6FD00110` -> `MONSTER_AllocMonsterData` `0x6FCD0320` -> `MONSTER_ChooseOutfit` `0x6FCCF730` -> `MONSTER_InitStats` `0x6FCCFDB0`), attaches unit to room (`0x6FD00F40`), and schedules `EVENT_AI` (`type=2`) at `dwGameFrame + 2` via `MONSTER_ScheduleInitialAiEvent` (`0x6FCCF920`).
- **`F226`**:
  - Initial `EVENT_AI` (`224 + 2 = 226`) fires on Zombies `#9..#11`:
    - `AI_RunMonsterAI` (`0x6FCBD3B0`) -> `AI_DispatchTargetByAiFlag` (`0x6FCBD160`) -> `AI_GeneralFindTargetOrThrottle` (`0x6FD13220`) -> `AI_FindNearestPlayerOrAlly` (`0x6FCD1C90`).
    - Because Barbarian is `> 35` subtiles away and out of LOS, `0x6FD13220` increments `pAiGeneral->dwIdleCounter` (`+0x1C`) and throttles via `AI_Stall(pGame, pUnit, 15)` (`0x6FD122C0`) after `> 8` idle ticks unless `AI_IdleWander` (`0x6FD11B10`, `2/15` chance on `nStay = 1`) triggers (`#11` wanders on `F1206..F1323`).
- **`F276` & `F348`**:
  - `0x6FC6B1D0 -> 0x6FCBD980` deactivates out-of-window Rogue Encampment rooms (`DUNGEON_ShouldDeactivateRoomEx` `0x6FDCBA00`), removing NPCs `id=1..4` (`F276`) and `id=5..8` (`F348`) via `SUNIT_RemoveServerUnit` (`0x6FD002A0`) and `EVENT_RemoveUnitEvents` (`0x6FCAE880`).

### Phase B: Fallen Party Pack Spawn, Aggro, Kill Chain & War Cry (`F689..F1438`)
- **`F689`**:
  - `2` rooms populate (`338` `gs` steps) and roll `class=19` (`fallen1`).
  - `REGPOP_UsesPartyBossGroup` (`0x6FC66D40`) resolves `MonStats[classId].wBaseId` (`+0x02`) and returns `1` for `wBaseId == 0x13` (`fallen1`) or `wBaseId == 0x5B` (`fetisher1`), so `0x6FC67A20` clamps `(nMinCount, nMaxCount) = (1, 1)` when calling `REGPOP_SpawnMonsterPack` (`0x6FC67700`), spawns `id=12` (`leader`), and `MONSTER_Create` (`0x6FD0EF10`) invokes **`MONSTER_SpawnPartyMinions` (`0x6FD0E480`)**:
    - `AIGENERAL_InitBossGroup` (`0x6FC40D90`) initializes `id=12` as boss (`+0x28 = pLeader`, `+0x2C = guid`, `+0x30 = 1`).
    - Rolls `partyCount = MinGrp + rand(leaderSeed, MaxGrp - MinGrp + 1)` (`fallen1`: `PartyMin = 2`, `PartyMax = 4` -> rolls `3` minions: `id=13, 14, 15`) and spawns them via `MONSTER_SpawnPartyMinionInRing` (`0x6FD0DDB0`) + `AIGENERAL_LinkMinionToLeader` (`0x6FC40CF0`).
- **`F720..F786`**:
  - `F720`: C2S `0x06` (`RightSkillOnUnit` / `AttackUnit`) targets Fallen `#12`.
  - `F766`: Barbarian enters `#12..#15` `aip2` (`20`-subtile) sight radius; `AiFallen` (`0x6FCA3130`), `AI_CheckApproachTauntSound` (`0x6FCBCA60`), and `AI_TryMonsterTeleportEscape` (`0x6FCBCDE0`) run.
  - `F776`: Minions resolve `AIGENERAL_GetPackLeaderUnit` (`0x6FC41260`) and approach/wander.
- **`F795..F821` (Kill #1 — Fallen `#12`, Leader Reassignment & Morale Flee)**:
  - `F795`: Barbarian starts melee swing (`mode 3->7`, `PLAYER_StartModeAttackWithTarget` `0x6FC987C0`).
  - `F801`: Swing contact frame kills `#12` (`mode 2->0`, `hp 1024->0`, Barbarian `xp 0->18`).
    - `MONSTER_StartDeath` (`0x6FC96270`) -> `0x6FC95350` calls **`AIGENERAL_ReassignPackOnBossDeath` (`0x6FC410D0`)**, promoting `#13` to new boss leader of `[#13, #14, #15]`, and `ROOM_RecordMonsterDeath` (`0x6FD8AFD0`) marks `(5599, 5796)` in `pRoom` so `#13, #14, #15` enter `AI_FleeFrom` (`0x6FD12D80`) + `SUNIT_SetUnitEventSound` (`0x6FCFFFD0`) on **`F802`**.
  - `F821`: `#12` `MONSTER_EndDeath` (`0x6FC96040`) transitions `0 -> 12` (`DD`).
- **`F1032..F1060` (Kill #2 — Fallen `#13` & Item Drop `gs +2`)**:
  - `F1032`: `#13` initiates melee `A2` (`mode 2->5`) via **`AI_StartAttackMode` (`0x6FD12220`) -> `MONSTER_InitModeChangeStrc` (`0x6FC95070`) -> `MONSTER_StartMode` (`0x6FC95E10`) -> `MONSTER_StartAttackOrCast` (`0x6FC95510`)**.
  - `F1033`: Barbarian swings (`mode 3->7`) while 3 western rooms stream in (`id=19..28`, `gs +517`).
  - `F1040`: Barbarian kills `#13` (`mode 5->0`, `xp 18->36`), promoting `#14` via `0x6FC410D0`, and treasure class drop allocates `1` item (`gs +2` via `0x6FD00110` + `0x6FD000C0`).
- **`F1395..F1438` (Kill #3 — Fallen `#14` & Sole-Survivor War Cry `S2`)**:
  - `F1395`: Barbarian (`3->7`) and `#14` (`2->4` `A1`) swing simultaneously; `#14` dies at **`F1402`** (`4->0`, `xp 36->54`), promoting sole survivor `#15` to boss leader (`0x6FC410D0`).
  - **`F1414`**: Leader `#15` executes Fallen group order **`AIGENERAL_BroadcastCmdToMinions` (`0x6FC412F0`)** + `AIGENERAL_CopyAiCommandParams` (`0x6FC41290`) and enters war cry `S2` (`mode 2->9`, returning `9->1` at `F1438`).

### Phase C: Fallen `#15` Melee Exchanges vs Barbarian (`F1490..F2000`)
- Between `F1405` and `F1645`, scenario C2S `0x06` packets still target dead `#14` (`mode=12`), so Barbarian stands in `mode=7`/`1` while `#15` executes **5 full monster melee attack cycles** via **`MONSTER_AdvanceAttackOrSkillStep` (`0x6FC95CE0`) -> `MONSTER_ExecuteMeleeSwing` (`0x6FC97790`)**:
  1. `F1490` (`1->5` `A2`), action frame `F1498`: miss (`SUNITDMG_CheckToHit` `0x6FCFDE90`).
  2. `F1535` (`1->4` `A1`), action frame **`F1542`**: **blocked by Barbarian shield** -> `SUNITDMG_TriggerBlockEvents` (`0x6FCEB950`) -> `PLAYER_StartBlockMode` (`0x6FC981C0`) puts Barbarian in `mode=9` (`BL`, `F1542..F1548`).
  3. `F1560` (`1->5` `A2`), action frame **`F1568`**: **hits Barbarian** (`hp 14080 -> 13700`, `-380` fixed-point = `-1.48` HP, `MONSTER_ApplyCritDamage` `0x6FC970E0` `5%` roll + `SUNITDMG_ApplyArmorDurabilityAndGetHit` `0x6FCEBBB0`).
  4. `F1595` (`1->5` `A2`), action frame **`F1603`**: **blocked** (`Barbarian mode 7->9->1`).
  5. `F1625` & `F1660` (`1->5` `A2`): misses.
- **`F1660..F1701` (Kill #4 — Fallen `#15`)**:
  - `F1660`: C2S `0x06` switches target to `#15`; Barbarian kills `#15` at **`F1681`** (`mode 1->0`, `hp 1024->0`, `xp 54->72`), `#15` reaches `DD` (`12`) at **`F1701`**, and Barbarian finishes in `NU` (`mode=1`) at **`F1990..F2000`**.

---

## 4. Iteration 14 Integration Checklist (`driver.ts` / `replay-kernel-113c.ts`)

To wire `F150..F2000` end-to-end once Lane E's `F150..F250` room-stream activation lands:
1. Invoke `OBJECTS_SpawnDensityObjectsInRoom113c` (`0x6FC52CE0`) + `REGPOP_PopulateRoomMonsters113c` (`0x6FC67A20`) inside `0x6FCBDC10` (room activation) in exact DLL order (objects before monsters) so `F151` (`+509`), `F224` (`+510`), `F689` (`+342`), `F1004` (`+346`), and `F1033` (`+517`) match `gs` to the single step.
2. Route `EVENT_AI` (`type=2`) through `AI_DispatchTargetByAiFlag113c` (`0x6FCBD160`) -> `AI_GeneralFindTargetOrThrottle113c` (`0x6FD13220`) -> species AI (`AiZombie113c` `0x6FCA38B0`, `AiFallen113c` `0x6FCA3130`, `AI_FallenShaman113c` `0x6FCA90A0`, `AI_Skeleton113c` `0x6FCA3550`).
3. Route monster mode `4`/`5`/`7`/`8`/`9` start & step handlers in `MONSTER_MODE_TABLE_113C` to `MONSTER_StartAttackOrCast113c` (`0x6FC95510`) and `MONSTER_AdvanceAttackOrSkillStep113c` (`0x6FC95CE0` -> `MONSTER_ExecuteMeleeSwing113c` `0x6FC97790` / `MONSTER_ApplyCritDamage113c` `0x6FC970E0`), and call `AIGENERAL_ReassignPackOnBossDeath113c` (`0x6FC410D0`) on monster death (`0x6FC95350`).

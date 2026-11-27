# D2Game 1.13c Town NPC Wander AI (`AI_Npc`, `0x6FC3DB40`)

## Authoritative Binary References (`D2Game.dll` & `D2Common.dll` v1.13c)

- `D2Game.dll` `gpMonsterAiFunctionTable` (`0x6FD2E788`, entry for `MonStats.AI = "Npc"` -> `AI_Npc` `0x6FC3DB40`)
- `D2Game.dll` `QUESTS_NpcGreetingAi` (`0x6FC39C20`, Warriv Act 1 greeting -> `PATHTYPE_STRAIGHT = 7`, `nStepNum = 1`)
- `D2Game.dll` `AI_HandleNpcNodes` (`0x6FC36A30`, `node4` `PATHTYPE_MON_CIRCLE_CW = 5` / `PATHTYPE_STRAIGHT = 7`, `node7` `PATHTYPE_STRAIGHT = 7`)
- `D2Game.dll` `AI_FollowDs1NpcPath` (`0x6FC3BBC0` -> `0x6FD2F850` -> `0x6FC36970` / `0x6FC39A00`..`0x6FC39BB0`, `dwPathTypeOverride = 7` `PATHTYPE_STRAIGHT`, `nStepNum = 0`)
- `D2Game.dll` `MONSTER_StartMove` (`0x6FC95E10` -> `0x6FC94F90` -> `0x6FC94D50`, `PATH_SetDistance(pPath, 20)` `#10022` @ `0x6FC95EE7`, `PATHTYPE_WALL_FOLLOW = 15` fallback @ `0x6FC94DF0`)
- `D2Game.dll` `MONSTER_StepPath` (`0x6FD01930`, `D2Common_10226(pMonster, 0x400)` @ `0x6FD01960`)
- `D2Game.dll` `EVENT_SetEvent` (`0x6FC34890`, `EVENTTYPE_MONAI = 0`)
- `D2Common.dll` `#10334` (`D2Common_10142`), `#10226` (`PATH_StepDynamicPath`), `#10399` (`UNITS_GetDistanceToOtherUnit`)

---

## 1. Initial Spawn & Event Timer Scheduling

1. **DS1 Preset Attachment**:
   - Town DS1 files (`data/global/tiles/act1/town/townE1.ds1`, etc.) store per-NPC `pMapAI` path arrays (`{ x, y, action }`, where `x, y` are world sub-tiles and `action` is `1..5`).
   - Non-NPC preset monsters (`rogue1` `hcIdx=152`, `AI="Idle"`, `cow` `hcIdx=179`, `chicken` `hcIdx=149` skipped via `MonStats2.critter`) do not execute `AI_Npc`.
2. **Initial `EVENTTYPE_MONAI` Tick**:
   - Monsters spawned during initial world/room bootstrap (`frame == 0` / player join) fire their first `EVENTTYPE_MONAI` callback at **`frame = 4`**.
   - Monsters spawned dynamically when a player walks into an unactivated room neighbourhood (`0x6FC4CBE0`) fire at **`currentFrame + 2`**.
3. **Think Delay (`aidel`)**:
   - Idle waits schedule `EVENT_SetEvent(pGame, pMonster, EVENTTYPE_MONAI, currentFrame + delay)` where default `delay = MonStats.aidel[difficulty]` (typically `15` or `20` frames).

---

## 2. `AI_Npc` (`0x6FC3DB40`) Decision Tree & Per-Unit `D2SeedStrc` Draws

Every RNG draw inside `AI_Npc` advances **`pMonster->tSeed`** (`D2SeedStrc` `{ lo, hi }`, LCG `uint64(lo) * 0x6AC690C5 + uint64(hi)` via `ITEMS_RollLimitedRandomNumber`), never `pGame->tSeed`.

### Step A: Player Vendor / Dialogue Freeze
- If an active player in the same area is currently interacting with this NPC (`activeNpcId == pMonster->dwUnitId`), any active walk is halted (`MONMODE_NEUTRAL = 1`) and the next AI event is scheduled at `currentFrame + 20`.

### Step B: Home Anchor Initialization (`node10`)
- On the first AI invocation, `AI_Npc` records the NPC's spawn `(wPosX, wPosY)` as its home anchor `(homeX, homeY)`.

### Step C: Warriv Act 1 Intro Approach (`hcIdx == 155`)
- For `warriv1` (`155`) in Act 1 Rogue Encampment (`areaId == 1`), if an active player has neither set Warriv's `NPC_INTRO` bit (`bit 4` in `npcIntro` difficulty block) nor started `a1q1` (`Den of Evil`), and `octileDist(npc, player) < 45`:
  - If `UNITS_GetDistanceToOtherUnit(npc, player) > 6`: walks toward the player (`PATHTYPE_IDASTAR` with `nStepNum = 4`, falling back to `PATHTYPE_TOWARD`).
  - Once within range (`<= 6`), stops and waits `20` frames without consuming `tSeed` wanders.

### Step D: Returning From `action == 4` Multi-Step Micro-Walk (`node4`)
- When `node4` state is active (`count > 0`):
  - Decrements `count`; if `count > 0`, issues a short `PATHTYPE_TOWARD` step toward `(node4.x, node4.y)` or waits `node4.delay` frames.

### Step E: Pending `node7` Skill Animation (`action == 2` / `3` / `5`)
- When an NPC arrives at a DS1 waypoint whose `action` is `2` (`MONMODE_SKILL1 = 7`), `3` (`MONMODE_SKILL2 = 8`), or `5`, enters the skill animation mode for `ceil((frames * 256) / animSpeed)` ticks, then returns to `MONMODE_NEUTRAL (1)` and schedules `currentFrame + aidel`.

### Step F: DS1 `pMapAI` Waypoint Selection vs. Free Radius Wander
1. **With DS1 `pMapAI` (`nodes.length > 0`)**:
   - Draws `idx = randLim(&pMonster->tSeed, nodes.length)` to pick target node `nodes[idx]`.
   - Draws action/wait rolls on `pMonster->tSeed` according to `node.action`:
     - `action == 1`: standard walk (`PATHTYPE_IDASTAR` `distance = 73`, fallback `PATHTYPE_TOWARD` / `PATHTYPE_MON_CIRCLE_CW`) to `(node.x, node.y)`, entering `MONMODE_WALK (2)` when `D2Common_10142 > 0`; on arrival (`D2Common_10226 == 0`), immediately re-invokes `AI_Npc` or pauses `15..35` ticks.
     - `action == 2` / `3`: walks to `(node.x, node.y)` and queues `MONMODE_SKILL1` / `MONMODE_SKILL2` upon arrival.
     - `action == 4`: initializes `node4` micro-wander (`delay` / `count` rolled on `tSeed`).
2. **Without DS1 `pMapAI` (Home-Radius Tethered Wander)**:
   - Rolls wander gate on `pMonster->tSeed`; if idle, schedules `currentFrame + aidel`.
   - Otherwise rolls `(dx, dy)` in `[-6..+6]` around `(homeX, homeY)` via `pMonster->tSeed` and paths with `PATHTYPE_TOWARD` (`MONMODE_WALK = 2`).

---

## 3. Collision Footprint Requirements for Exact Path Parity

In Rogue Encampment (`a1-town-walk`, frame `24+`), town NPCs (`Kashya` `#3`, `Akara` `#5`, `Charsi` `#6`) path around campfires, tents, wagons, stash, and other town monsters (`rogue1`). Exact path parity requires:
1. Static `Objects.txt` footprints (`PATH_AddCollisionFootprintForUnit` gated by `Objects.txt` `HasCollision[mode]`, `SizeX`, `SizeY`, and exact `Orientation == 1` table).
2. Living monster & player `DynamicPath` footprints (`COLLIDE_MONSTER` / `COLLIDE_PLAYER`) updated per sub-tile step inside `D2Common_10226`.

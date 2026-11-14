# P4 — First-Divergence Parity Loop

Scenario: `tests/fixtures/oracle/scenarios/a1-town-walk.json` (seed 12345, level-1 Barbarian, Rogue
Encampment, 750 frames, 5 run/walk inputs). Oracle golden:
`tests/fixtures/oracle/golden/a1-town-walk.oracle.ndjson.gz`.

Loop (one root cause per iteration):

```sh
npx tsx tools/oracle/run-replica.ts tests/fixtures/oracle/scenarios/a1-town-walk.json /tmp/rep/tw.ndjson
zcat tests/fixtures/oracle/golden/a1-town-walk.oracle.ndjson.gz > /tmp/rep/tw.oracle.ndjson
npx tsx tools/oracle/diff.ts /tmp/rep/tw.oracle.ndjson /tmp/rep/tw.ndjson --from 2 --types 0,1
```

`--from 2`: the oracle player joins during frame 1 (its frame-1 line has no units); that offset is a
known later divergence. `--types 0,1`: only players and monsters are compared. (Oracle rows are grouped
by real `dwType` across the five game hash lists — list 3 items, list 4 missiles, tiles not hashed — so
oracle `t3` is the missile list in the newer goldens; the replica emits missiles under `t3` too.)

Evidence references: `D2Game.dll` / `D2Common.dll` 1.13c VAs (preferred base), disassembly via
`objdump -d -M intel` of the binaries in `samples/d2`.

---

## Iteration 1 — per-type unit ids

**First divergence (before):**

```
FIRST DIVERGENCE at frame 2: extra-unit monster #28   (replica ids 28..42, oracle ids 1..8)
```

**Root cause.** 1.13c keeps one unit id counter per unit type. `SUNIT_GetNewUnitId` `D2Game 0x6FCFF9C0`
(`ecx` = type, `edx` = `pGame`): asserts `type < 6` (`0x6FCFF9C0..0x6FCFF9DF`), then
`eax = [pGame + type*4 + 0x90]; inc eax; if eax == -1 -> 1; store` (`0x6FCFF9E4..0x6FCFF9F6`). The six
counters `pGame->dwLastUnitId[0..5]` (`+0x90..+0xA4`) are zeroed at game creation
(`0x6FC4C703..0x6FC4C721`), so the first id of every type is 1. Called from `SUNIT_AllocUnitData`
`0x6FD01D90` (`0x6FD01ECC`). The TS server used one shared `nextUnitId` for every kind.

**Fix.**

- `GameInstanceState.nextUnitIdByType` (six counters, first id 1, `0xFFFFFFFF` skipped) replaces
  `nextUnitId`; `allocateUnitId(unitType)` takes the 1.13c type (`UNIT_TYPE_113C`): players and player
  corpses 0 (corpses are `UNIT_PLAYER` units, `UnitAssign unitType 0`), monsters / mercenaries / summons
  1, objects 2, missiles (incl. merc/pet projectiles, `CreateMissile` ids) 3, items (incl. cube outputs,
  vendor clones, ears, split stacks) 4, warp tiles 5 — all 50 call sites.
- Id-only lookups that searched several kinds now take the type:
  - `findUnitPosition(id, areaId?, unitType?)`; `MoveToUnit`/`WalkToTarget`/`RunToTarget` keep the
    target type (`player.moveTargetUnitType`) and only treat tiles/objects as static targets by type.
  - `handleInteract(player, id, type?)` resolves only the clicked type (C2S `0x13` carries it): corpse /
    player trade (0), object (2), NPC (1); pending object / corpse interactions pass their type.
  - AOI event positions (`extractEventPosition113c`) resolve ids with the event's `unitType` or the key's
    implied type (`itemId` 4, `portalId` 2, `missileId` 3, `mercId` 1, `corpseId` 0; item owner from
    `ownerType` / merc container).
  - `applyDamageToMonster(monsterId, dmg, attackerId)`: a bare attacker id is a player id first; it is
    read as a mercenary id only for a merc source or when no player has that id.
  - Chest-trap missiles (owner = object, combat side `'monster'`) carry `ownerIsObject` so owner lookups
    never pick a monster with the same id (also inherited by child missiles).
  - `isUnitIdAlreadyInUse` → `isItemUnitIdInUse` (only items); the item counter is bumped past adopted
    item ids (former `nextUnitId` watermark in `itemDataToServerEntry`).
  - Bone-prison / door index watermarks use the monster / object counters.
- Already type-keyed (no change needed): per-kind containers (`players`, `monsters`, `objects`,
  `groundItems`, `missiles`, `warpTiles`, `mercenaries`), AOI keys `${type}:${id}`
  (`src/server/net/aoi.ts`), client unit maps (the client already handles real D2GS ids, which repeat
  across types).

**Files.** `src/server/engine/game-instance/{state,constants-and-helpers,area-and-session,frame-and-commands,
trade-party-and-progression,quests-objects-and-portals,monster-damage,missiles-step,player-death-and-shrines,
item-stats-and-drops,player-combat-and-vitals,types,...}.ts` (all `allocateUnitId` call sites).
Tests whose assertions matched ids without a type: `tests/server/p1-quests-objects-wave4.test.ts`
(monster #1 and chest #1 now coexist), `tests/merc-and-corpse-summon-1395.test.ts` (`getAllUnits` lookup
by `unitType` + id).

**Tests.** Full `npx vitest run`: no new failures versus the pre-change baseline (see the report table
for counts; remaining failures need baked assets / other agents' fixtures).

**Next divergence:**

```
FIRST DIVERGENCE at frame 2: field monster #1
  field class: oracle=152 replica=179
```

---

## Iteration 2 — preset monsters spawn on room activation; critters are never spawned

**First divergence (before):**

```
FIRST DIVERGENCE at frame 2: field monster #1
  field class: oracle=152 replica=179
```

The replica spawned all 15 Rogue Encampment DS1 preset monsters (plus a Blood Moor monster) when the
area loaded; the oracle has exactly 8 units at frame 2: rogue1 ×2 (room 23), Kashya + Warriv (24),
Akara (30), Charsi (32), rogue1 ×2 (31) — ids 1..8 in that order. The player stands in room 31
(sub-tiles 5640..5680 × 5880..5920).

**Root cause (two parts).**

1. *Room activation.* 1.13c spawns a room's presets when the room becomes active, not when the level
   is built. `D2Game 0x6FC4CBE0` (called from the game frame `0x6FC4E0D0`) walks, for each act, the
   new-room list `[pDrlg+0x54]` head-first (`next = [room+0x7C]`), and for every room without flag
   `0x1` calls `0x6FD01430` (preset units), `0x6FC400E0`, `0x6FC4F0D0`, `0x6FC67A20` (random density)
   and sets the flag. `0x6FD01430` iterates the room's preset list twice: first every non-monster preset
   (`[preset+0x14] != 1`), then the monsters (`type == 1`), skipping presets with `[preset+0x1C] & 1`;
   each goes through `0x6FD013B0` → `0x6FD012D0` (monsters → `0x6FC67CF0`). Only the rooms near the
   player's room are active (the touching-rectangle neighbourhood the TS wilderness streamer already
   uses). The oracle's id order (rooms 23, 24, 25, 30, 32, then the player's room 31) equals head
   insertion of the activation order `[current room, near rooms ascending (y, x)]` — the D2Common
   near-room list is position-sorted (`DRLGROOM_SortRoomListByPosition`, `D2Common 0x6FD77EB0`); the
   exact activation call was not disassembled, the order is taken from the oracle trace.
2. *Critters.* The spawn worker `0x6FC66F70` returns 0 when `0x6FC213B0(classId, 0xD)` is set
   (`0x6FC66FC0..0x6FC66FCE`). `0x6FC213B0` reads the MonStats2 row of the class (`MonStats +0x18`
   `wMonStatsEx`, stride `0x134`) and tests bit 13 of its flag bytes (`+4`), i.e.
   `MONSTATS2_FLAGINDEX.CRITTER` (`critter` column). `chicken` (149) has `critter = 1`, so the two
   chickens in active rooms 25 and 30 never spawn; `cow` (179, `critter = 0`) is only in inactive rooms.

**Fix.**

- `loadArea` no longer spawns DRLG preset monsters. They are kept per room
  (`GameInstanceState.pendingPresetMonsters`, room = `roomRects` rectangle containing the preset);
  presets outside every rectangle (synthetic test geometry without rooms) still spawn immediately.
- `activatePresetRoomsNearPlayer113c(player)` activates the player's room and its touching rooms
  once, and spawns their presets in reverse activation order (head insertion). It runs each frame for
  every player (before the wilderness density streamer, like `0x6FD01430` before `0x6FC67A20`), right
  after `connectPlayer` adds the player, and after an area transition places the player.
- `spawnAreaPresetMonster113c` skips classes with the MonStats2 `critter` flag
  (`hasMonStats2Flag(classId, MONSTATS2_FLAGINDEX.CRITTER)`).
- Not changed (follow-up): preset *objects* are still spawned at area load (1.13c spawns them in the
  same room pass, before the monsters); object ids are not in the trace yet.

**Files.** `src/server/engine/game-instance/{area-and-session,world-spawning-and-aoi,frame-and-commands,
quests-objects-and-portals,state}.ts`.

**Next divergence:** every frame-2 unit now matches (ids, classes, modes, positions):

```
FIRST DIVERGENCE at frame 2: field monster #1
  field stat6: oracle=256 replica=2304
```

---

## Iteration 3 — replica sub-tile convention (trace runner)

Comparing the player track (`--types 0`): the oracle's first displacement appears in the frame the
`0x03` packet is delivered (frame 50, `x` 5653 → 5654), the replica's one frame later, with the same
speed afterwards.

**Root cause.** Not the engine: the runner converted positions with `Math.floor(x)`. 1.13c places a
unit at the sub-tile centre — `PATH_AllocDynamicPath` (`D2Common #11003`, `0x6FD86030`) stores the
precise position `(n << 16) + 0x8000` and `wPosX` is its integer part — whereas TS logical `N.0` is the
centre of sub-tile N (`src/common/path/movement-predictor.ts`: "logical N.0 is the centre of sub-tile N,
so `Math.round`"; the server's own wire position is `playerWirePosition` = `Math.round`). The 1.13c
coordinate of a TS position is therefore `floor(x + 0.5)`.

**Fix.** `tools/oracle/lib/replica.ts` `subtile(v) = Math.floor(v + 0.5)`; documented in
`docs/oracle/scenario-schema.md`.

**Next divergence:**

```
FIRST DIVERGENCE at frame 50: field player #1
  field stat10: oracle=23552 replica=23512
```

---

## Iteration 4 — no stamina drain while running in town

**Root cause.** The run-drain routine `D2Game 0x6FC97BB0` starts with
`DUNGEON_IsRoomInTown(UNITS_GetRoom(unit))` (`0x6FC2A478` → D2Common #10331, `0x6FC2A808` → D2Common
#10057) and returns 1 without touching stat 10 when the room is in town (`0x6FC97BB4..0x6FC97BC9`); the
drain itself (`CharStats.RunDrain * 2` at `+0x42`, armour speed, stat `0x9A`) follows at
`0x6FC97BCA..0x6FC97C92`. The recovery routine `0x6FC97A50` switches on `mode - 1` (jump table
`0x6FC97B04`: NU/TN → shift 8, WL → shift 9 if stamina ≥ 256, TW → shift 9, RN/GH → default) and its
default case only recovers when stat 28 (`staminarecoverybonus`) ≥ 1000 (`0x6FC97AAD`). The TS server
drained `RunDrain * 2` per running frame everywhere (23552 → 23512 → …).

**Fix.** `stepPlayerVitals`: running in a town area neither drains nor (unless stat 28 ≥ 1000)
recovers stamina; outdoor running is unchanged.

**Files.** `src/server/engine/game-instance/player-combat-and-vitals.ts`.

**Next divergence:**

```
FIRST DIVERGENCE at frame 57: field player #1
  field x: oracle=5658 replica=5657
```

---

## Iteration 5 — game seed, per-unit `D2SeedStrc`, Act outfit palette, `MONSTER_InitStats` & state bitmaps

**First divergence (before, `--types 0,1` + `gs` + `st` + `seedLo`/`seedHi`):**

```
FIRST DIVERGENCE at frame 2: game-seed (gs) & field monster #1 (seedLo/seedHi, stat6/stat7/stat12)
```

**Root cause.** Five interconnected 1.13c initialization paths advance `pGame->tSeed` and each unit's
`pUnit->tSeed` (`D2SeedStrc` `{ lo, hi }`, inline step `uint64(lo) * 0x6AC690C5 + uint64(hi)`):

1. *`GAME_InitSeed` (`D2Game 0x6FC4A900`) & `SUNIT_AllocUnitData` (`0x6FD01D90` -> `0x6FD00110` / `0x6FD000C0`).*
   With `-seed N`, `pGame->tSeed` starts at `{ N, 0x29A }` and advances `4` times during game creation,
   `1` time on player unit creation (`pPlayer->tSeed = { draw, 0x29A }`), and `2` times per starting item
   in `CharStats.txt` `item1..item10` (both fresh level-1 characters without `plr.inventory` and saved
   characters reconstructed from `D2S` equipment/inventory).
2. *Room preset activation order (`0x6FC4CBE0` -> `0x6FD01430`).* When a room activates, `0x6FD01430`
   iterates non-monster presets before monsters: every preset object — including `Objects.txt` `Sync == 0`
   server-only markers (`#2000`, e.g. `385` `CainStart`) — draws `1` seed from `pGame->tSeed` before the
   room's preset monsters draw theirs, followed by warp tiles (`1` draw each).
3. *Per-Act 13-slot monster component palette (`0x6FCEA5F0` -> `0x6FCFF1A0`) & `MONSTER_ChooseOutfit` (`0x6FCCF730`).*
   `MONSTER_AllocMonsterData` (`0x6FCD0320`) registers each Act's first 13 multi-piece monster classes
   (`MonStats2.nTotalPieces > 2`, excluding `{195, 196, 294, 296}`) using the first spawned unit's
   `tSeed` (`rogue1` `152` consumes `27` draws on `m#1`, then `1` selection draw in `0x6FCCF730`;
   `m#2/#7/#8` hit the cached Act palette and draw `1` step each; single-piece town NPCs `kashya` `150`,
   `warriv1` `155`, `akara` `148`, `charsi` `154` bypass palette registration and draw `1` step in
   `0x6FCCF730`).
4. *`MONSTER_InitStats` (`0x6FCCFDB0`), `D2Common #11089` (`0x6FDA4A00`) & sparse `STATLIST_SetStat` (`0x6FD8A280`).*
   In Normal (`nDifficulty == 0`), monsters use `MonStats.Level[0]` directly without clamping `0` to `1`
   (`rogue1` and town NPCs stay `level = 0`). `0x6FDA4A00` scales `minHP`/`maxHP` by `MonLvl[0].L-HP = 1`
   (`142..284 -> 1..2` for `rogue1`, `0..0` for town NPCs), and `0x6FCD0043` rolls
   `minHP + randLim(&pUnit->tSeed, maxHP - minHP + 1)` (always `1` seed step, yielding `256` on `m#1` and
   `512` on `m#2/#7/#8`!). `D2Common.dll` `STATLIST_SetStat` (`0x6FD8A280`) never inserts `0` into
   `BaseStats` and deletes zeroed entries, so `0`-HP town NPCs do not trigger `ItemStatCost` `minAccr = 1`
   on `STAT_MAXHP` (`7`), while `S2C 0xAC` `lifePct` (`0x6FC97060`) still emits `0x80` (`128`) whenever
   `maxHp <= 0`.
5. *Unit state bitmaps (`st`): `SUNIT_SetAlignment` (`0x6FD004B0`) & `SKILLS_RefreshPassiveSkills` (`0x6FCBA1A0`).*
   Every player and monster has `STATE_ALIGNMENT = 105` (`remondeath = 0`) set at spawn, and all 29
   `Skills.txt` `passivestate` rows (`64..83`, `97` `skel_mastery`, `111` `golem_mastery`, `152`, `155`,
   `160`, `181..183`) activate when `slvl > 0`.

**Fix.**

- Added `src/common/rng/unit-seeds-113c.ts` and `src/server/data/monstats2-outfit-113c.ts`, wired per-Act
  outfit palettes and per-unit `D2SeedStrc` across `GameInstanceState`, `loadArea` / deferred
  `PendingRoomPresets113c` (objects + `#2000` hidden markers -> monsters -> warp tiles), `connectPlayer`
  starting kit seed draws, `MONSTER_InitStats` level/HP rolls, `UnitStatList.setBaseStat`/`addStat` sparse
  zero deletion (`0x6FD8A280`), `STATE_ALIGNMENT = 105`, and all 29 passive skill `stateId`s.
- Extended `tools/oracle/lib/replica.ts` and `tools/oracle/lib/trace-diff.ts` (`diff.ts`) to emit and
  compare `gs`, `seedLo`/`seedHi`, `st`, and `dmg` (`SUnitDmgTraceEvent113c`), and ran
  `parity-report.ts --write`: all 10 golden scenarios advanced from `0` matched frames to `23` matched
  frames (frame 24) with 100% bit-for-bit seed, stat, and state parity.

**Next divergence (all 10 scenarios at frame 24):**

```
FIRST DIVERGENCE at frame 24: field monster #3
  field mode: oracle=2 replica=1
```

---

## Iteration 6 — Player `9/16` run velocity (`D2Path` Q16.16) & Town NPC `AI_Npc` wandering

**Next divergence (all 10 scenarios at frame 24, player track at frame 57 in `a1-town-walk`):**

```
FIRST DIVERGENCE at frame 24: field monster #3
  field mode: oracle=2 replica=1
```

**Root cause.**

1. *Player walk/run velocity (`UNITS_UpdateAnimRateAndVelocity` `D2Common 0x6FD83140` / `0x6FD833CF`, `UNITS_SetRunBonus` `0x6FD82EA0`, and all `PATH_SetVelocity` `D2Common.#10149` `0x6FD84D40` / `D2Game 0x6FC2ACAC` call sites).*
   `CharStats.txt` gives `WalkVelocity = 6` (`1536` in Q8.8 -> `24576 / 65536 = 6/16 = 0.375` sub-tiles/frame = `9.375`/s at 25 Hz) and `RunVelocity = 9` (`+50` `STAT_VELOCITYPERCENT` -> `2304` in Q8.8 -> `36864 / 65536 = 9/16 = 0.5625` sub-tiles/frame = `14.0625`/s at 25 Hz). Stepping player movement via `D2Common_10142` + `D2Common_10226` (`nBaseVelocity = 0x400`) eliminates the rounding lag (`9.0` / `13.5`/s) at frame 57: in `a1-town-walk` (`--types 0`), Player `#1` now matches Oracle sub-frame-for-sub-frame through frame `155` (`f=156`).
2. *Monster base `STAT_VELOCITYPERCENT = 75` (`MONSTER_InitStats` `D2Game 0x6FCCFFD1`) & Town NPC `AI_Npc` (`0x6FC3DB40`).*
   `0x6FCCFFD1` initializes `STAT_VELOCITYPERCENT (67) = 75 (0x4B)` on every monster, scaling town NPC walk velocity to `trunc(75 * (Velocity << 8) / 100)`. Town NPCs (`MonStats.AI == "Npc"`: Kashya `150`, Warriv `155`, Akara `148`, Charsi `154`, etc.) run `AI_Npc` (`0x6FC3DB40`), `QUESTS_NpcGreetingAi` (`0x6FC39C20`), `AI_HandleNpcNodes` (`0x6FC36A30`), and `AI_FollowDs1NpcPath` (`0x6FC3BBC0` -> `0x6FD2F850` -> `0x6FC36970` / `0x6FC39A00`..`0x6FC39BB0`) using per-unit `D2SeedStrc`, `PATHTYPE_STRAIGHT (7)` (`dwPathTypeOverride = 7`), `PATH_SetDistance(pPath, 20)` (`#10022` `0x6FD84630`, called at `0x6FC95EE7`), and `PATHTYPE_WALL_FOLLOW (15)` fallback (`0x6FC94DF0`). Even when a preset spec carries `aiDisabled` in town, `isTownNpcMonster113c(hcIdx)` preserves `townNpcAiEnabled`.

**Fix.**

- Wired `AreaPathWorld113c` (`src/server/ai/town-npc-ai-113c.ts`) with full cross-room adjacency (`buildAdjacentRoomLists`) for player `D2Path` stepping (`6/16` walk, `9/16` run, `PLRMODE_TW = 6` in town per `0x6FC9866C`) and Town NPC `AI_Npc` wandering (`75%` base monster `STAT_VELOCITYPERCENT`, `PATH_SetDistance(20)`, `PATHTYPE_STRAIGHT` + `PATHTYPE_WALL_FOLLOW` fallback, `D2Common_10226(..., 0x400)`), and fixed `spawnMonsterInternal` (`world-spawning-and-aoi.ts`) so `isTownNpcMonster113c(hcIdx)` enables `townNpcAiEnabled` on town presets.
- Documented full disassembly evidence in `kb/engine/d2common-unit-velocity-113c.md` and `kb/monsters/d2game-npc-wander-ai-113c.md`, and ratcheted `tests/fixtures/oracle/golden/parity-baseline.json`: 9 of 10 scenarios advanced from `23` to **`65` matched frames**, and `a1-town-walk` advanced to **`59` matched frames** (with Kashya `#3`, Akara `#5`, and all 4 `rogue1` units having `0` divergences across all `750` frames, and Player `#1` matching through frame `155`).

**Current first divergences (post-Step 2):**

- **9 scenarios (`a1-bloodmoor-melee`, `p52-*`), frame 66:** Warriv (`m#4`, `hcIdx = 155`) obstacle/greeting retry timing around the Rogue Encampment campfire (`mode: oracle=2 replica=1`).
- **`a1-town-walk`, frame 60:** Warriv (`m#4`) `PATHTYPE_WALL_FOLLOW` 1-sub-tile detour around the campfire (`x: oracle=5650 replica=5649`); player track (`--types 0`) matches through frame `155`.

---

## Iteration 7 — World Combat, Summon, Missile & Player-Defender 1:1 Parity (`10/10 >= 801`, `5/10` 100%)

**Root causes & 1:1 ports (documented in `kb/` and `kb/engine/path-call-order-audit-113c.md`):**

1. *`PATH_SetTargetUnit` vs `PATH_SetTargetPos` call order (`0x6FD12599`, `D2Common.#10286` `0x6FD845C0`):*
   Calling `D2COMMON_10170_PathSetTargetPos` after `PATH_SetTargetUnit` cleared `pPath->pTargetUnit`, breaking monster target tracking (`PATHTYPE_TOWARD (0)` / `PATHTYPE_MON_OTHER_2 (13)`). Restored exact `MONSTER_StartMode` (`0x6FC94D50` / `0x6FC95070`) targetUnit XOR targetPos exclusivity.
2. *Zombie AI (`0x6FCFD710`), Monster Melee (`0x6FC97240` / `0x6FC970E0`) & Player-Defender `SUNITDMG` (`0x6FCFC0B0` / `0x6FCFD1CE` / `0x6FCFEBA0`):*
   Ported monster melee action frame `ceil(eventFrame * 256 / speed)`, monster->player RNG draws on `monster`/`player` `D2SeedStrc` (hit roll, damage roll `min256 + rand(max256 - min256)`, `RAND(1)` + `MonStats.crit`, 3 armor durability draws in `SUNITDMG_ItemDurability` `0x6FCFEBA0` -> `0x6FC32EE0`), blunt `+50%` vs undead (`0x6FCFA8C0`), `1/256` player/monster HP & monster regen (`maxHp256 * DamageRegen >> 12`, `0x6FCD00B5`), Amazon `Dodge`/`Avoid` `PLRMODE_S1 (13)` (`0x6FCFD1CE`), `BL` cooldown gate (`0x6FCFD2F8`), `GH` `ceil(frames * 256 / speed)`, `SQ (18)` sequence length (`0x6FD82820` / `0x6FD82460`), and timed state expiration (`applyFrame + duration`).
3. *Missile Velocity (`75/100`, `0x6FC8FAA3`), `MISSMODE_SrvHit01` (`0x6FC5B990`) & Fire Wall (`0x6FC5EDE0` / `SrvDmg03` / `SrvDo06`):*
   Swept `trunc(vel * 75 / 100)` across all 5 launch sites, ported radial explosion `SrvHit01` (`0x6FC5B990` -> `0x6FC5A280` -> `0x6FC59B40`) on the missile seed with `HitFlags`/`ResultFlags`, and ported Fire Wall LIFO ticking, `16.16` direction stepping (`src/server/engine/missile-path-113c.ts`), `LastCollide` contact gate, and `SrvDmg03` ground fire ticks.
4. *Summon Spawn (`0x6FC6FC00`), `NecroPet` AI (`0x6FC3E640`) & `MonEquip` Item Creation (`0x6FCCFCE0` -> `0x6FC31980`):*
   Ported pet outfit + `MONSTER_InitStats` seed draws, `summode = S1`, `AreaPathWorld113c` registration, `+25`/`+20` first AI event, `NecroPet` melee movement/target/leash AI (`src/server/engine/game-instance/necropet-ai-113c.ts`), Valkyrie passive states (`64/65/66/68/98` + state `93` walk speed), and 1:1 `MonEquip` rare/magic item affix generation (`src/server/items/monster-item-create-113c.ts`).
5. *Diagnostic Tooling (`tools/oracle/trace-window.ts`):*
   Added per-frame game/unit seed divergence detection, offline LCG draw count recovery (`0..256`), and exact replica RNG call-site (`file:line fn`) & `D2DynamicPathStrc` inspection.

**Current `parity-baseline.json` (`tests/oracle/golden-parity.test.ts`):**

| Scenario | Matched Frames | Baseline (`firstDivergenceFrame`) | Status |
|---|---:|---:|---|
| `a1-bloodmoor-melee` | `1800/1800` (`100.0%`) | `1801` | Full match (0 divergences) |
| `a1-town-walk` | `750/750` (`100.0%`) | `751` | Full match (0 divergences) |
| `p52-paladin-auras` | `1700/1700` (`100.0%`) | `1701` | Full match (0 divergences) |
| `p52-sorceress-elemental` | `1800/1800` (`100.0%`) | `1801` | Full match (0 divergences) |
| `p52-sorceress-fire-dot` | `1800/1800` (`100.0%`) | `1801` | Full match (0 divergences) |
| `p52-necromancer-curses` | `1509/2000` (`75.4%`) | `1510` | `>= 750` target met |
| `p52-amazon-defense` | `1210/1800` (`67.2%`) | `1211` | `>= 750` target met |
| `p52-barbarian-warcries` | `1012/1600` (`63.2%`) | `1013` | `>= 750` target met |
| `p52-amazon-valkyrie` | `850/1500` (`56.7%`) | `851` | `>= 750` target met (`NecroPet` `A1` `0x6FD12220` unported) |
| `p52-necromancer-poison-golem` | `801/1800` (`44.5%`) | `802` | `>= 750` target met (`NecroPet` `A1` `0x6FD12220` unported) |

# K4 Act 1–5 Quest Golden Replay Suite (`k4-act1-quest` .. `k4-act5-quest`)

Milestone 35 `[K4]` longitudinal quest golden suite: 5 deterministic Act 1–5 quest scenarios captured on the headless Wine 1.13c DLL host (`d2host-113c.exe` + `d2oracle.dll`, `seed = 12345`, Normal difficulty `0`), hydrated from real Frame 2 (`F2`) memory snapshots into `SparseMemory113c`, and ratcheted frame-by-frame against `src/d2kern-113c/` (`replay-kernel-113c.ts` + `k4-quest-replay-113c.ts`).

## Layout & Artifacts

| Artifact | Path |
|---|---|
| Scenario & `.d2s` generator + Wine recorder | `tools/oracle/make-k4-quest-scenarios.py` |
| Headless 1.13c DLL runner (`oracleCover` / `oracleSnapshot`) | `tools/oracle/run-headless-oracle.sh` |
| Quest `.d2s` save fixtures (Acts 1–5) | `tests/fixtures/oracle/saves/k4-act{1..5}-quest.d2s` |
| Deterministic scenario definitions | `tests/fixtures/oracle/scenarios/k4-act{1..5}-quest.json` |
| Wine 1.13c golden traces, `F2` snapshots & DLL coverage | `tests/fixtures/oracle/k4/k4-act{1..5}-quest.{oracle,snap-f002,coverage}.ndjson.gz` |
| Upward-only horizon ratchet | `tests/fixtures/oracle/k4/horizons.json` |
| Vitest replay & `dll ∩ ts` runtime coverage ratchet | `tests/oracle/k4/replay-act-quests.test.ts` |
| Per-scenario divergence JSONs | `docs/oracle/k4-replay/k4-act{1..5}-quest.divergence.json` |
| Per-scenario `dll ∩ ts` & `runtimeExecGap` (`dll - ts`) reports | `docs/oracle/k4-replay/gap-k4-act{1..5}-quest.md` |

Regenerate scenarios/saves and re-record Wine 1.13c traces + `F2` snapshots:
```bash
python3 tools/oracle/make-k4-quest-scenarios.py --record
```

Record 1.13c `D2Game.dll` + `D2Common.dll` function-entry coverage (`cover.ndjson` across all `4,810` manifest VAs, `frames 1..N`) without altering pinned `.oracle.ndjson.gz` or `.snap-f002.ndjson.gz` digests:
```bash
# Inject "oracleCover": [1, <frames>] into a temporary copy of k4-act<N>-quest.json, then run:
tools/oracle/run-headless-oracle.sh /tmp/k4-actN-cover.json /tmp/k4-actN-trace.ndjson
gzip -9n -c /tmp/k4-actN-trace.ndjson.d/cover.ndjson > tests/fixtures/oracle/k4/k4-actN-quest.coverage.ndjson.gz
```

## Act 1–5 Quest Scenario Design

Every scenario starts at Frame 2 inside its canonical Act town (`level` `1`, `40`, `75`, `103`, `109`), uses only pure C2S packets (`0x03`, `0x13`, `0x2F`, `0x31`, `0x30`, `0x20`) where **100% of C2S packets return `0`** in `D2Game.dll` `0x6FCEC550`, verified deterministic across independent Wine runs, and produces a directly observable quest transition in `.oracle.ndjson.gz`:

| Scenario | Act & Town (`level`) | Quest (`Woo!` word / protocol ID) | Town NPC (`id`, `hcIdx`) & C2S Sequence | Verified 1.13c Golden Quest Outcome |
|---|---|---|---|---|
| `k4-act1-quest` | Act I — Rogue Encampment (`1`) | `A1Q1` Den of Evil (`word 1 = 0x0002`, `0x01`) | Akara (`#5`, `148`): `0x03` -> `0x13` -> `0x2F` -> `0x31` (`wScrollId = 0x004C`) -> `0x30` | `+1` `STAT_NEWSKILLS` (`stat 5`: `12 -> 13`) |
| `k4-act2-quest` | Act II — Lut Gholein (`40`) | `A2Q1` Radament's Lair (`word 9 = 0x2021`, `0x08`) + `'ass '` (`#9`) | Jerhyn (`#1`, `201`): `0x03` -> `0x13` -> `0x2F` -> `0x31` (`0x00FD`) -> `0x30`, then `0x20` (`UseItem #9`) | Consumes Book of Skill `'ass '`, `+1` `STAT_NEWSKILLS` (`stat 5`: `12 -> 13`) |
| `k4-act3-quest` | Act III — Kurast Docks (`75`) | `A3Q1` The Golden Bird (`word 20 = 0x0004`, `0x12`) + `'j34 '` (`#9`) | Meshif (`#3`, `264`): `0x03` -> `0x13` -> `0x2F` -> `0x31` (`wScrollId = 0x0211`) -> `0x30` | Deletes Jade Figurine `'j34 '`, mints Golden Bird `'g34 '` (`gs` advances `[3213594174, 158754329] -> [1040732530, 1118359132]` on F42) |
| `k4-act4-quest` | Act IV — Pandemonium Fortress (`103`) | `A4Q1` The Fallen Angel (`word 25 = 0x0002`, `0x16`) | Tyrael (`#3`, `367`): `0x03` -> `0x13` -> `0x2F` -> `0x31` (`wScrollId = 0x02A4`) -> `0x30` | `+2` `STAT_NEWSKILLS` (`stat 5`: `12 -> 14`) |
| `k4-act5-quest` | Act V — Harrogath (`109`) | `A5Q3` Prison of Ice (`word 37 = 0x0202`, `0x21`) | Malah (`#7`, `513`): `0x03` -> `0x13` -> `0x2F` -> `0x31` (`0x4EA4` mints `'tr2 '` `#9`) -> `0x30`, then `0x20` (`UseItem #9`) | Consumes Scroll of Resistance `'tr2 '`, `+10` Fire/Light/Cold/Poison Resist (`stats 39, 41, 43, 45`: `0 -> 10`) |

## Measured Replay Horizons (`710` Golden Frames / `700` Stepped Frames)

All 5 Act snapshots hydrate cleanly at `F2` with **zero strict field mismatch (`bootCheck === null`)** and run to **full-frame strict zero divergence (`t0 + t1 + t3 + stats + gs`, `firstDivergence === null`, `firstPosDivergence === null`)** across their entire golden trace horizons:

| Scenario | Golden Frames | Boot Check (`F2`) | Strict Horizon | Pos Horizon | First Strict Divergence | First Pos Divergence |
|---|---:|---|---:|---:|---|---|
| `k4-act1-quest` | `F1..F160` | `null` (identical) | `F160` (158/158 frames) | `F160` (158/158 frames) | `null` (zero divergence) | `null` (zero divergence) |
| `k4-act2-quest` | `F1..F140` | `null` (identical) | `F140` (138/138 frames) | `F140` (138/138 frames) | `null` (zero divergence) | `null` (zero divergence) |
| `k4-act3-quest` | `F1..F130` | `null` (identical) | `F130` (128/128 frames) | `F130` (128/128 frames) | `null` (zero divergence) | `null` (zero divergence) |
| `k4-act4-quest` | `F1..F140` | `null` (identical) | `F140` (138/138 frames) | `F140` (138/138 frames) | `null` (zero divergence) | `null` (zero divergence) |
| `k4-act5-quest` | `F1..F140` | `null` (identical) | `F140` (138/138 frames) | `F140` (138/138 frames) | `null` (zero divergence) | `null` (zero divergence) |

## Real 1.13c DLL Coverage vs TypeScript Runtime Execution (`dll ∩ ts` vs `dll - ts`)

Function-entry coverage (`tests/fixtures/oracle/k4/k4-act{1..5}-quest.coverage.ndjson.gz`) was captured on the real 1.13c `D2Game.dll` + `D2Common.dll` under headless Wine (`d2host-113c.exe` + `d2oracle.dll`, one-shot `INT3` across all `4,810` manifest entries during `F1..FN`, `0` other-thread traps, `100%` frame-identical to the committed `.oracle.ndjson.gz` goldens) and compared against live `va-trace-113c` hits during `runK4QuestReplay113c`:

| Scenario | Frames | DLL Total Hits | `D2Common` `dll ∩ ts` (`total TS`) | `D2Common` `preBootGap` (`F1..F2`) / **`steppedRuntimeExecGap` (`F3+`)** | `D2Game` `dll ∩ ts` (`total TS`) | `D2Game` `preBootGap` (`F1..F2`) / **`steppedRuntimeExecGap` (`F3+`)** | Manifest Unported / Impure |
|---|---:|---:|---:|---:|---:|---:|---:|
| `k4-act1-quest` | `F1..F160` | `620` | `346 / 347` (`503`) | `1` (`13 B`) / **`0` (`0 B`)** | **`273 / 273`** (`367`) | **`0` (`0 B`)** / **`0` (`0 B`)** | `0` / `0` |
| `k4-act2-quest` | `F1..F140` | `671` | `363 / 366` (`521`) | `3` (`411 B`) / **`0` (`0 B`)** | `299 / 305` (`403`) | `6` (`976 B`) / **`0` (`0 B`)** | `0` / `0` |
| `k4-act3-quest` | `F1..F130` | `648` | `313 / 329` (`471`) | `16` (`1,219 B`) / **`0` (`0 B`)** | `297 / 319` (`391`) | `22` (`8,967 B`) / **`0` (`0 B`)** | `0` / `0` |
| `k4-act4-quest` | `F1..F140` | `547` | `262 / 281` (`446`) | `19` (`1,562 B`) / **`0` (`0 B`)** | `242 / 266` (`343`) | `24` (`8,962 B`) / **`0` (`0 B`)** | `0` / `0` |
| `k4-act5-quest` | `F1..F140` | `652` | `309 / 329` (`459`) | `20` (`1,826 B`) / **`0` (`0 B`)** | `292 / 323` (`386`) | `31` (`9,979 B`) / **`0` (`0 B`)** | `0` / `0` |
| **5-Scenario Union** | **`710`** | **`920`** | **`444 / 445` (`668`)** | **`1` / `0`** | **`459 / 475` (`553`)** | **`16` / `0`** | **`0` / `0`** |

### Architectural Breakdown: `0` `steppedRuntimeExecGap` (`F3+`) vs `preBootGap` (`F1..F2`)

Every DLL-executed VA in all 5 scenarios has `status = "diff-verified"` (`0` manifest unported) and lives in a pure `src/d2kern-113c/` module (`0` legacy `src/common` / `src/server` imports). K4 replays through `replay-kernel-113c.ts` wired with the pure `SparseMemory113c` bridge in `src/d2kern-113c/game/k4-quest-replay-113c.ts` (`installK4QuestReplay113c()`), separating `runtimeExecGap` (`dll - ts`) into two disjoint windows (`docs/oracle/k4-replay/gap-k4-act{1..5}-quest.md`):

1. **`steppedRuntimeExecGap` (`firstFrame >= bootFrame + 1`, `F3..FN`): `0` `D2Common` + `0` `D2Game` across ALL 5 scenarios (`100.00%` stepped `dll ⊆ ts` parity)**:
   - Every `D2Common` and `D2Game` function first entered during the stepped replay window (`F3..FN`) executes through its canonical 1:1 `src/d2kern-113c/` port, including `AI_DispatchTargetByAiFlag` (`0x6FCBD160` -> `0x6FCBCD90` -> `0x6FCBCFE0`) town NPC dispatch, Jerhyn's `ACT2Q4` palace cellar / Horazon's Journal AI override (`0x6FCE8990` -> `0x6FCE1F90` -> `0x6FC39C20`), `ACT3Q1` Golden Bird status/alert callbacks (`0x6FD06BD0` -> `0x6FD05F00` -> `0x6FC554F0` -> `0x6FD03CE0`), Malah's healer interaction (`0x6FC68B60` -> `0x6FCDD810` -> `0x6FCDD490`), Act 4 ambient object timer events (`0x6FCAECC0` -> `0x6FC8E400` -> `0x6FC8AE60`) and environment cycles (`0x6FC4CA20` -> `0x6FD873B0`), C2S `0x13` run-to-interact (`0x6FCEE120` -> `0x6FD84910` -> `0x6FC99850`), full `QUESTS_CreateItem` -> `D2GAME_CreateItemEx` (`0x6FC56470` -> `0x6FC31980` -> `0x6FC31490` -> `0x6FC31070` -> `0x6FC30160` -> `0x6FC55890` -> `0x6FC53F80`), `SUNIT_FreeUnit` item/quest-chain teardown (`0x6FC30700`, `0x6FC53FF0`), and end-of-frame inventory command-flag sync (`0x6FC988B0` -> `0x6FCBBB10` -> `0x6FCBB630` -> `0x6FCADF70`/`0x6FCAB0F0` -> `0x6FCAD3D0` -> `0x6FCAC890`, plus `0x6FCBB3B0` -> `0x6FCBB340`).
2. **`preBootGap` (`firstFrame <= bootFrame`, `F1..F2`): `1` `D2Common` + `16` `D2Game` in the 5-scenario union**:
   - `.coverage.ndjson.gz` arms `INT3` across `F1..FN`, while TS replay hydrates from `snap-f002.ndjson.gz` (captured at end of `F2`) and steps `F3..FN`. In `k4-act1-quest`, running east across Rogue Encampment streams new rooms during `F3..F160` (`0x6FC4CBE0` -> `0x6FD01430` -> `0x6FC9B0A0`), re-hitting every `F1..F2` `D2Game` VA (`273 / 273`). In Acts 2–5, the short town run stays within rooms already materialized inside `snap-f002.ndjson.gz`, so `F1..F2`-only room population & preset spawn helpers (`ACT2Q0_SpawnJerhynAtPalaceEntrance` `0x6FCE7C20`, `ACT5Q1_SpawnShenkAndAttachQuestData` `0x6FC7C3A0`, `OBJECTS_InitFn08_Torch` `0x6FC89930`, `DRLGPRESET_MovePointerAndClear` `0x6FD59DD0`, etc.) already left their exact state in the `F2` memory snapshot and are not re-entered during `F3..FN`.

## Closed 1.13c Kernel Subsystems Across Acts 1–5

### 1. Town NPC Patrol, Greeting & Waypoint AI (`Acts 1–5`)
- Town NPCs execute canonical 1.13c AI callbacks (`AI_TownNpc` `D2Game:0x6FC3DB40`, `AI_SimpleMapAiNpc` `D2Game:0x6FC3BC60`, `AI_RogueTown` `D2Game:0x6FCBCB00`, `AI_ThinkTyraelOrIzualGhost` `D2Game:0x6FC39880`, `AI_Npc_Town` `D2Game:0x6FCCA4D0`), including `MONSTER_EndToAiOrNeutral` (`D2Game:0x6FC96BF0`) and `AI_WarrivGreet` (`D2Game:0x6FC39C20`) player-interaction busy/greeting state.

### 2. Act 2–5 Town `D2RoomExStrc` Preset & Neighbor Hydration
- Hydrates Act 2–5 town DS1/DT1 preset rooms (`tests/fixtures/oracle/k4/drlg-act2-5-ds1-dt1-113c.json.gz`), `D2MapAIStrc` waypoint chains (`+0x38`), and `D2NpcInteractStrc` heads (`+0x30`) for seamless room boundary transitions (`CLIENTS_SetPlayerCurrentRoom` `D2Game:0x6FC6B1D0` -> `DRLGROOM_PropagateRoomStatusIncrement` `D2Common:0x6FD64860`).

### 3. Act 1–5 Quest State Machines & Consumable C2S Handlers (`F34..F160`)
All C2S opcodes and quest callbacks execute through canonical manifest-bound `tsSymbol` functions:
- `C2S 0x13` (`PACKET_Recv13_UnitInteract`, `D2Game:0x6FCF0910` -> `0x6FCF01D0` -> `NPC_StartPlayerNpcInteraction` `0x6FC687A0` -> `SUNIT_SetLastKillerInfo` `0x6FCFFAE0` `[+0x64 = dwUnitId, +0x68 = nUnitType, +0x6C = 1]`)
- `C2S 0x2F` (`PACKET_Recv2F_NpcInit`, `D2Game:0x6FCEE440` -> `0x6FCECCF0` -> `0x6FC68B60` -> `NPC_Activate` `0x6FCDD810`)
- `C2S 0x31` (`PACKET_Recv31_QuestMessage`, `D2Game:0x6FCEC9D0` -> `QUESTS_ScrollMessage` `0x6FC55C90` -> `QUESTS_TriggerCallback` `0x6FC53CE0` `event = 0x0B`):
  - **Act 1 `A1Q1`**: `D2Game:0x6FC85260` (`wScrollId = 0x004C`, clears bit `1`, sets bit `0`, `STATLIST_AddUnitStat(pPlayer, 5, 1, 0)`)
  - **Act 2 `A2Q0`**: `D2Game:0x6FCE4620` (`wScrollId = 0x00FD`, sets `word 8` bit `0`)
  - **Act 3 `A3Q1`**: `D2Game:0x6FD08B60` (`wScrollId = 0x0211`, calls `QUESTS_DeleteItem` `0x6FC566A0` for `'j34 '` and `QUESTS_CreateItem` `0x6FC56470` for `'g34 '`)
  - **Act 4 `A4Q1`**: `D2Game:0x6FCDA5E0` (`wScrollId = 0x02A4`, clears bit `1`, sets bit `0`, `STATLIST_AddUnitStat(pPlayer, 5, 2, 0)`)
  - **Act 5 `A5Q3`**: `D2Game:0x6FC7F5E0` (`wScrollId = 0x4EA4`, calls `QUESTS_CreateItem` `0x6FC56470` for `'tr2 '`, sets bit `8`, clears bit `1`, completes `word 37` when bit `9` is set)
- `C2S 0x30` (`PACKET_Recv30_NpcCancel`, `D2Game:0x6FCED480` -> `0x6FC685C0`, resetting `[+0x64 = 0xFFFFFFFF, +0x68 = 6, +0x6C = 0]`)
- `C2S 0x20` (`PACKET_Recv20_UseItem`, `D2Game:0x6FCEF730` -> `ITEMS_UseConsumableItem` `0x6FCF9B70`, handling `'ass '` `+1` `stat 5` and `'tr2 '` -> `0x6FC7B0B0` `+10` `stats 39, 41, 43, 45`)

## Fixture Provenance (`tests/fixtures/oracle/k4/`)

| File | Gzip Bytes | Raw Bytes | SHA-256 (gzip) |
|---|---:|---:|---|
| `k4-act1-quest.oracle.ndjson.gz` | 2,583 | 163,621 | `bbbc34234685b10e0b9d614c839f1512d3aa4d597da053da47ab1d93dd66983c` |
| `k4-act1-quest.snap-f002.ndjson.gz` | 28,045 | 619,765 | `267201c87786c884970cd6852577d0ec929e4ccc9595f6d72b6a51bafc43ad73` |
| `k4-act1-quest.coverage.ndjson.gz` | 2,304 | 25,317 | `ea0e4c11e3814b3642e676a3c76ce55ddde4b03fb7e22a8751292e0c10ee9b6d` |
| `k4-act2-quest.oracle.ndjson.gz` | 2,037 | 127,286 | `be55e09b754c639ec9955e9d83434e7e4fbc38158018466578f2160db5e2e3b5` |
| `k4-act2-quest.snap-f002.ndjson.gz` | 23,744 | 551,636 | `a41695d14ba2c2675551b1cd512875668bac4ee9d56996276aa8df18421342f2` |
| `k4-act2-quest.coverage.ndjson.gz` | 2,543 | 27,340 | `a0853ff409ef51fe4f6021c0227d3baa418cbd20babbe5c39c72f07c1db46e87` |
| `k4-act3-quest.oracle.ndjson.gz` | 1,141 | 63,462 | `8381a757b7ce1db1e640c47ddd60e78d8209b27ab4a2587c66aaaba7892786fb` |
| `k4-act3-quest.snap-f002.ndjson.gz` | 25,340 | 599,029 | `d9747b4ab629ad61c55ac28d433f8252ff55091fe689ae97d156e9c97264930c` |
| `k4-act3-quest.coverage.ndjson.gz` | 2,428 | 26,352 | `1d25006045304249b98a40287b87f2d3e3a94b107ef7032c834f8bf7071b25c0` |
| `k4-act4-quest.oracle.ndjson.gz` | 1,532 | 81,673 | `b61d900a08f370452d3ae8fa84db7db8c5a26fd5c29b38021a789c7bf354f629` |
| `k4-act4-quest.snap-f002.ndjson.gz` | 22,087 | 539,912 | `63c8fdfa1584b22ede34969f16446e1c9a9cba3335af86e2d42367a82df6514a` |
| `k4-act4-quest.coverage.ndjson.gz` | 2,102 | 22,216 | `76112783e0560d1eef61f6e3fc93357170bc505cbe03e82ffe3bd5889ab6dead` |
| `k4-act5-quest.oracle.ndjson.gz` | 1,750 | 122,082 | `f57f19eac1c2905ae60571457a57a6c666741663682f57f85a8b039c5227a756` |
| `k4-act5-quest.snap-f002.ndjson.gz` | 24,926 | 565,527 | `654dc76c966bcb431a1b3145dca078b341b17517f42bfb36ed68d9e7e493765d` |
| `k4-act5-quest.coverage.ndjson.gz` | 2,447 | 26,496 | `1accd1305a73a78f0d0e7b282539b25f754c12d9f7c4f7fc19c765fb2b05d7f3` |

# 1.13c Progression Portals, Kurast Sewers Lever/Stairs & Worldstone Chamber (`D2Game.dll`)

## Ground Truth Sources
- `D2Game.dll` (1.13c, image base `0x6FC20000`):
  - `gpObjectInitFnTable` @ `0x6FD2E050`
  - `gpObjectOperateFnTable` @ `0x6FD27BB8`
  - `LEVEL_WarpUnit` @ `0x6FCBE170` -> `D2Common.#10816` (`DUNGEON_FindActSpawnLocationEx`)
- MPQ tables (`d2data.mpq`, `d2exp.mpq`, `Patch_D2.mpq`):
  - `Objects.txt` rows `100`, `194`, `195`, `298`, `342`, `366`, `367`, `386`, `547`, `563`, `565`, `566`, `569`
  - `Levels.txt` rows `54`, `66..72`, `73`, `74`, `83`, `92`, `93`, `120`, `128..132`

## 1. `LEVEL_WarpUnit` (`0x6FCBE170`) Non-`Vis` Portal Landings

`Levels.txt` `Vis0..7` / `Warp0..7` are all `0` on `Area 73` (`Duriel's Lair`) and `Area 74` (`Arcane Sanctuary`), and `Area 54` (`Palace Cellar Level 3`) has no `UNIT_TILE` warp to `Area 74`. Instead of looking up a return `UNIT_TILE` warp, `D2Game.dll` portal `OperateFn` handlers call `LEVEL_WarpUnit(pPlayer, pGame, nDestLevel, nTileIndex)` (`0x6FCBE170`), which resolves destination coordinates via `D2Common.#10816` (`DUNGEON_FindActSpawnLocationEx`, player unit size `2`):

| `Objects.txt` ID | Name | `OperateFn` (`D2Game.dll` VA) | Transition | `nTileIndex` | Notes |
| ---: | :--- | :--- | :--- | ---: | :--- |
| `298` | `ArcaneSanctuaryPortal` | `34` (`0x6FC8D620`) | `54 -> 74` (`0x6FC8D6E7`) | `11` (`ACT_SPAWN_TILE_TOWN_PORTAL`) | Sets `[pQuestData+0x42] = 2`, `[pQuestData+0x44] = 2` so both paired `298` portals stay `OBJMODE_OPENED (2)`. |
| `298` | `ArcaneSanctuaryPortal` | `34` (`0x6FC8D620`) | `74 -> 54` (`0x6FC8D684`) | `0` (`ACT_SPAWN_TILE_ENTRY`) | Lands on `Area 54` DS1 special tile `(14, 14)` adjacent to `298`. |
| `100` | `Duriel's Lair` | `43` (`0x6FC8BB60`) | `66..72 -> 73` (`0x6FC8BBD1`) | `0` (`ACT_SPAWN_TILE_ENTRY`) | Lands inside Duriel's chamber (`tile (27, 38)`), east of sealed `153` (`Tyrael's Door`). |
| `563` | `Baals Portal` (`The Worldstone Chamber`) | `70` (`0x6FC7DF70`) | `131 -> 132` (`0x6FC7DFC3`) | `11` (`ACT_SPAWN_TILE_TOWN_PORTAL`) | Requires `mode === 2`; lands on DS1 style-33 bridge tile `(34, 25)` in `Area 132`. |
| `569` | `Throne of Destruction` | `70` (`0x6FC7DF70`) | `132 -> 131` (`0x6FC7DFDE`) | `0` (`ACT_SPAWN_TILE_ENTRY`) | Return portal when spawned in `Area 132`. |

## 2. Act 3 Kurast Sewers Lever (`367`) & Stairs (`366`)

- **`InitFn 41` (`0x6FD04980`, `366` `sewer stairs`) & `InitFn 42` (`0x6FD02E00`, `367` `sewer lever`)**:
  - When `A3Q3` (`Khalim's Will`, quest `0x10`) is already completed (`QUEST_FLAG_COMPLETED`), both `366` and `367` initialize in `OBJMODE_OPENED (2)`.
  - Otherwise both spawn in `OBJMODE_NEUTRAL (0)` (`366` has `Selectable0 = 0, Selectable1 = 0, Selectable2 = 1`; `367` has `Selectable0 = 1, Selectable1 = 0, Selectable2 = 0`).
- **`OperateFn 45` (`0x6FD09F60`, `367` `sewer lever`)**:
  - Operates only in `mode === 0`.
  - Sets `367` to `OBJMODE_OPERATING (1)` (`FrameCnt1 = 32, FrameDelta1 = 256` -> `32` ticks to `mode 2`).
  - Schedules `QUESTS_CreateTimer(..., 0x6FC559C0, 0x1E)` (`30` ticks) to transition `366` (`sewer stairs`) `0 -> 1 -> 2` (`FrameCnt1 = 20, FrameDelta1 = 150` -> `34` ticks) and sends `S2C 0x89` `specialEventId = 9`.
- **`OperateFn 44` (`0x6FD095E0`, `366` `sewer stairs`)**:
  - Returns `0` (strict no-op) while `mode !== 2`; once `mode === 2`, warps `Area 92 -> Area 93` (`Sewers Level 2`).

## 3. Act 5 Worldstone Chamber Portal (`563` / `569`) & Harrogath Portal (`566`)

- **`InitFn 75` (`0x6FC76520`, `563` & `569`)**:
  - Reads `[pQuestData+0x94]` (`0` initially for `563` in `Area 131` so `563` spawns sealed in `mode = 0`), then writes `2` so `569` in `Area 132` spawns in `OBJMODE_OPENED (2)`.
  - `OperateFn 70` (`0x6FC7DF70`) ignores clicks on `563` until `AITHINK_Fn138_BaalToStairs` (`0x6FCC8350`) opens `563` to `mode = 2`.
- **`OperateFn 73` (`0x6FCDB550`, `566` `LastLastPortal` -> Harrogath `109`)**:
  - Requires `mode === 2` and `A4Q3` completion; unlocks Act 5 + Harrogath town waypoint (`109`), emits `S2C 0x61 05` (`CanGoToAct { act: 5 }`), and warps to `Area 109`.

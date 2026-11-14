# Diablo II v1.13c Act 1 Quest 4 (`a1q4`): Countess Tower Chest (`Objects.txt 371`) & `towerchestspawner` (`Missiles.txt #332`)

## Authoritative Binary & MPQ Sources
- `D2Game.dll` (v1.13c, image base `0x6FC20000`):
  - `0x6FC88AB0..0x6FC88B8F` (`OBJECTS_Init39_CountessChest`) & `0x6FC88D20..0x6FC88D5F`: registers up to 8 `Objects.txt 371` GUIDs in `pQuestDataEx` (`+0x68`, count `+0x88`); when `a1q4` (`QFLAG_REWARDGRANTED = 0x0001`) is already completed on game creation / area load, initializes `Objects.txt 371` in `OBJMODE_OPENED (2)`.
  - `0x6FC88B90..0x6FC88D14` (`ACT1Q4_Callback08_MonsterKilled`) -> `0x6FC85E90..0x6FC860A5` (`ACT1Q4_SpawnTowerChestSpawner`): when The Countess (`SuperUniques.txt` `The Countess`, `darkstalker` `hcIdx 45`) dies and completes `a1q4` for the first time in the game, spawns server missile `#332` (`towerchestspawner`) over the registered `Objects.txt 371` unit.
  - `0x6FC608D0..0x6FC60B1D` (`MISSMODE_SrvDo18_TowerChestSpawner`, `pSrvDoFunc = 18`): server-only frame ticker for `towerchestspawner`.
  - `0x6FC8DBF0..0x6FC8DD5C` (`OBJECTS_OpenTowerChest`): opens `Objects.txt 371` and spawns its guaranteed Magic equipment + potion burst.
  - `0x6FC2E310..0x6FC2E402` (`ITEMS_SelectActManaPotionCode` / `ITEMS_SelectActHealingPotionCode`, `.data` `0x6FD2F86C..0x6FD2F893`): selects tier-indexed healing/mana potion codes.
- `D2Client.dll` (v1.13c):
  - `0x6FAD41C5`: `S2C 0x2C PlaySound` `code = 92` (`0x5C`) updates quest music stinger timer globals at the end of the fountain sequence.
- `Objects.txt` row `371` (`Good Chest` / Countess Chest):
  - `InitFn = 39`, `OperateFn = 0`, `Selectable0 = 0`: cannot be manually clicked open by the player (`gpObjectOperateFnTable[0] == NULL`); only `OBJECTS_OpenTowerChest` transitions it from `mode 0` to `mode 1 -> 2`.
- `Missiles.txt` row `332` (`towerchestspawner`):
  - `pSrvDoFunc = 18`, `Range = 400`, `Param1 = 150`, `Param2 = 2`, `Param3 = 5`.

## Frame-Exact Lifecycle (`400` Frames @ 25 Hz = `16.0s`)

1. **Countess First-Completion Trigger (`t = 0`, `remainingFrames = 400`)**:
   - Triggered only when at least one quest-eligible recipient transitions `a1q4` from uncompleted to completed (`QFLAG_REWARDGRANTED = 0x0001`). Subsequent Countess kills by players who already completed `a1q4` drop her normal/rune `Countess` TreasureClass loot (`Countess` / `Countess (N)` / `Countess (H)`) without re-arming `Objects.txt 371` (which already initialized to `mode = 2` on area load).

2. **Chest Lid Opening & Guaranteed Burst (`remainingFrames == 250`, `400 - Param1`, `+150` frames / `6.0s`)**:
   - `0x6FC6096A..0x6FC609F2`: compares `curFrame == Range - Param1` (`400 - 150 = 250`), calls `OBJECTS_OpenTowerChest(chest)` (`0x6FC8DBF0`), and sets `nActivateFrame = 1` (`D2Common.#10588(pMissile, 1)`).
   - Inside `OBJECTS_OpenTowerChest` (`0x6FC8DBF0`):
     - Guards `chest->dwAnimMode == OBJMODE_NEUTRAL (0)` (`0x6FC8DBFD..0x6FC8DC02`).
     - Calls `OBJECTS_DropFromChestTC(pArg, 4)` (`0x6FC8B570`, `nQuality = 4` = forced Magic) **3 times** (`0x6FC8DC25`, `0x6FC8DC2D`, `0x6FC8DC35`).
     - Calls `0x6FC2E390` (`['hp1', 'hp2', 'hp3', 'hp4'][min(3, act + (difficulty > 0 ? 2 : 0))]`) and drops **2** Healing Potions (`0x6FC8DC82`, `0x6FC8DC9A`).
     - Calls `0x6FC2E310` (`['mp1', 'mp2', 'mp3', 'mp4'][min(3, act + (difficulty > 0 ? 2 : 0))]`) and drops **2** Mana Potions (`0x6FC8DCE6`, `0x6FC8DCFE`).
     - Transitions `chest` to `OBJMODE_OPERATING (1)` and schedules `OBJMODE_OPENED (2)` after `Objects.txt` operating animation frames (`0x6FC8DD10..0x6FC8DD3E`, or `mode = 2` directly if `0` frames).

3. **Gold Fountain Eruption (`armed && remainingFrames % 8 == 0`, `31` piles across frames `248, 240, ..., 8`)**:
   - `0x6FC60A05..0x6FC60B0C`: computes interval `max(1, Param2 << 2) = 8` frames (`0.32s`).
   - Whenever `curFrame % 8 == 0` while armed (`248, 240, 232, ..., 8`), rolls `dx = rand(2 * Param3 + 1) - Param3 = rand(11) - 5` and `dy = rand(11) - 5` (`[-5, +5]` sub-tiles around the chest) and spawns `1` `'gld'` pile at `areaLvl` (`0x6FC31490`).

4. **Quest Stinger Completion (`remainingFrames == 1`)**:
   - `0x6FC60928..0x6FC60968`: emits `S2C 0x2C PlaySound` with `nSound = 0x5C` (`92`) attached to the chest object (`unitType = 2`, `id = chest.unitId`) before the spawner expires.

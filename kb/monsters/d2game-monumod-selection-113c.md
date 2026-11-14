# Diablo II v1.13c `MonUMod.txt` Affix Selection (`D2Game.dll` `0x6FC43CA0`, `0x6FC43980`, `0x6FC43AE0`, `0x6FC43100`, `0x6FC448A0`, `0x6FC451F0`)

## 1. Ground Truth Sources

- **Binaries**: `samples/d2/D2Game.dll` (image base `0x6FC20000`), `samples/d2/D2Common.dll` (image base `0x6FD50000`)
- **MPQ Data Tables**: `samples/d2/Patch_D2.mpq` (`data\global\excel\monumod.txt`, `monumod.bin`, `monstats.txt`, `monstats2.txt`, `montype.txt`, `superuniques.txt`)

## 2. `MonUMod.bin` Record Layout (`0x20` = 32 bytes per row, 43 rows)

Compiled by `D2Common.dll` `0x6FDAB620`:

| Offset | Type | Column | Description |
| --- | --- | --- | --- |
| `+0x00` | `uint32` | `uniquemod` | Row index (`0..42`) |
| `+0x04` | `uint16` | `version` | `0` = Classic, `100` = Expansion |
| `+0x06` | `uint8` | `enabled` | `1` if active, `0` if disabled (`0` `none`, `24` `thief`) |
| `+0x07` | `uint8` | `xfer` | `1` if transferred to minions |
| `+0x08` | `uint8` | `champion` | `1` for Champion-only subtypes (`16`, `36..39`), `0` for Unique modifiers |
| `+0x09` | `uint8` | `fPick` | Monster capability gate (`0`, `1`, `2`, `3`) |
| `+0x0A` | `int16` | `exclude1` | Excluded `MonType.txt` ID (`-1`/`0` = none; row `17` `lightning` has `22` = `sandleaper`) |
| `+0x0C` | `int16` | `exclude2` | Excluded `MonType.txt` ID (`-1`/`0` = none) |
| `+0x0E` | `uint16[3]` | `cpick`, `cpick (N)`, `cpick (H)` | Champion pick weights by difficulty (`0..2`) |
| `+0x14` | `uint16[3]` | `upick`, `upick (N)`, `upick (H)` | Unique pick weights by difficulty (`0..2`) |
| `+0x1A` | `uint16` | `fInit` | Initialization function index |
| `+0x1C` | `uint32` | `constants` | Global elite parameter table (`rows 0..33`) |

## 3. Champion vs. Unique Roll & Unique Affix Count (`D2Game.dll` `0x6FC43CA0`)

When spawning a random elite monster pack (`0x6FC43CA0`):

1. Counts existing modifiers `ebx` in `pMonsterData->nMonUMod[9]` (`+0x1C`) via `0x6FC41860`. If `ebx >= 8`, returns immediately (`0x6FC43CC0`).
2. Reads `MonUMod.txt` row 0 `constants` (`20`, `champion chance`) at `0x6FC43D21..0x6FC43D2D` and rolls `rand(100) < 20` (`0x6FC43D49..0x6FC43D56`):
   - **Champion branch (`0x6FC43D58..0x6FC43D7A`)**: sets `MONFLAG_CHAMPION` (`0x04`) and calls `0x6FC43AE0(pGame, pUnit)` to roll 1 Champion subtype (`16`, `36..39`) into `nMonUMod[ebx]`.
   - **Unique branch (`0x6FC43D7C..0x6FC43E12`)**:
     - Calls `0x6FC21180` with `eax = 1` (`rand(1) == 0`).
     - Reads `difficulty = pGame->nDifficulty` (`+0x6D`: `0` Normal, `1` Nightmare, `2` Hell).
     - Computes `count = 1 + difficulty` (`0x6FC43D93..0x6FC43D95`: `1` on Normal, `2` on Nightmare, `3` on Hell).
     - Clamps total slots (`0x6FC43D99..0x6FC43DA3`): if `count + ebx >= 9`, sets `count = 9 - ebx`.
     - Marks existing modifiers in `used[43]` (`[esp+0x18]`) and loops `count` times calling `0x6FC43980(pGame, pUnit, used)`.
3. Afterward, `0x6FC448A0` shifts existing `nMonUMod` entries right by 4 slots (keeping indices `< 9`, i.e. at most 5 non-base modifiers in slots `4..8`) and writes the 4 fixed base Unique modifiers `[1, 2, 3, 4]` (`rndname`, `hpmultiply`, `light`, `leveladd` from `0x6FD1CE7C`) into slots `0..3`, invoking `gpMonUModInitTable[id]` (`0x6FD1CEAC`) on each.

## 4. Weighted Unique & Champion Pickers (`0x6FC43980` & `0x6FC43AE0`)

### Unique Picker (`0x6FC43980`)
Iterates all `43` rows of `MonUMod.bin`:
1. `upick[difficulty] > 0` (`word [edi + difficulty * 2 + 0x14] > 0`).
   - In 1.13c `Patch_D2.mpq`, row `8` (`resist`, Magic Resistant) has `upick = [0, 6, 6]`, so it **never** rolls in Normal difficulty (`0` weight) and has weight `6` in Nightmare and Hell.
   - The other 12 selectable Unique modifiers (`5` `strong`, `6` `fast`, `7` `curse`, `9` `fire`, `17` `lightning`, `18` `cold`, `25` `manahit`, `26` `teleport`, `27` `spectralhit`, `28` `stoneskin`, `29` `multishot`, `30` `aura`) have `upick = [6, 6, 6]`.
2. `champion == 0` (`byte [edi + 0x08] == 0`).
3. `0x6FC43100(pUnit, pMonUModTxt, pGame->bExpansion) != 0`.
4. `used[umodId] == 0` (not already present on the monster).
5. Accumulates `totalWeight += upick[difficulty]`, rolls `r = rand(totalWeight)` in `[0, totalWeight - 1]`, and returns the first candidate with `r < weight` (decrementing `r -= weight` otherwise).

### Champion Picker (`0x6FC43AE0`)
Same structure as `0x6FC43980`, except it requires `champion != 0` (`byte [edi + 0x08] != 0`) and weights by `cpick[difficulty]` (`word [edi + difficulty * 2 + 0x0E] > 0`). In 1.13c `Patch_D2.mpq`, rows `16` (`champion`), `36` (`ghostly`), `37` (`fanatic`), `38` (`possessed`), and `39` (`berserk`) all have `enabled = 1`, `champion = 1`, `fPick = 0`, `cpick = [1, 1, 1]`.

## 5. Eligibility Validator (`D2Game.dll` `0x6FC43100`)

`0x6FC43100(pUnit, pMonUModTxt, bExpansion)` checks:
1. **`enabled` (`0x6FC43104`)**: `pMonUModTxt->bEnabled != 0` (`+0x06`).
2. **`version` (`0x6FC4310E`)**: if `!bExpansion` (`Classic`), requires `pMonUModTxt->wVersion < 100` (`+0x04`).
3. **`exclude1` / `exclude2` (`0x6FC4311B..0x6FC4314B`)**:
   - Calls `0x6FC22790(pUnit, wExclude)` which checks whether the monster's `MonStats.txt` `MonType` matches `wExclude` or any ancestor in `MonType.txt` (`equiv1..equiv3`).
   - In 1.13c `MonUMod.txt`, row `17` (`lightning`) has `exclude1 = sandleaper` (`MonType` ID `22`), preventing `sandleaper1..7` from rolling Lightning Enchanted.
4. **`fPick` (`0x6FC4314F..0x6FC43210`, switch on `byte [pMonUModTxt + 0x09]`)**:
   - `fPick == 0`: always returns `1`.
   - `fPick == 1` (`0x6FC431F6`, used by `26` `teleport`):
     - Calls `0x6FC21560(hcIdx, edx = 4)` -> tests bit `4` (`MONMODE_ATTACK1` = `mA1` / `m1m`) in `MonStats2.bin +0xF0` (`D2Common.dll` `0x6FDA71A9`). Monsters without `mA1` cannot roll `teleport`.
   - `fPick == 2` (`0x6FC4318F`, used by `29` `multishot`):
     - Checks `MonStats.bin +0x0C` bit `1` (`0x02` = `isMelee`, `D2Common.dll` `0x6FDAAF91`). If `isMelee != 0`, returns `0`.
     - Calls `0x6FC215D0(hcIdx, edx = 17)` -> tests bit `17` (`byte +0x0E` bit `1` = `noMultishot`, `D2Common.dll` `0x6FDAB297`) in `MonStats.bin +0x0C`. If `noMultishot != 0`, returns `0`.
   - `fPick == 3` (`0x6FC43168`, used by `6` `fast`):
     - Calls `0x6FC21560(hcIdx, edx = 2)` -> tests bit `2` (`MONMODE_WALK` = `mWL` / `m2c`) in `MonStats2.bin +0xF0` (`D2Common.dll` `0x6FDA717F`). Stationary monsters without `mWL` cannot roll `fast`.

## 6. SuperUnique Fixed + Difficulty Random Modifiers (`D2Game.dll` `0x6FC451F0`)

At `0x6FC45307..0x6FC453B6`:
1. Iterates `Mod1..Mod3` (`+0x0C..+0x14` in `SuperUniques.bin`):
   - Stops at the first `<= 0` entry (`test eax, eax; jle 0x6FC45353`).
   - Skips `24` (`thief`, `cmp eax, 0x18; je next`).
   - Appends `modId` to `nMonUMod` and sets `used[modId] = 1`.
2. Reads `difficulty = pGame->nDifficulty` (`+0x6D`: `0` Normal, `1` Nightmare, `2` Hell) at `0x6FC45353`:
   - In Normal (`difficulty == 0`), rolls `0` additional random modifiers.
   - In Nightmare (`difficulty == 1`) and Hell (`difficulty == 2`), loops `difficulty` times calling `0x6FC43980(pGame, pUnit, used)` to roll `+1` (Nightmare) or `+2` (Hell) additional random Unique modifiers without duplicating fixed `Mod1..Mod3`.
3. Calls `0x6FC448A0` to prepend `[1, 2, 3, 4]` and initialize all modifiers.

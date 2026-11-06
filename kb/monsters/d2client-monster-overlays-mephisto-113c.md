# D2Client 1.13c Monster Overlays & Mephisto Mist (`0x6FAFD610`, `0x6FB570C0`, `0x6FAFE3DF`, `0x6FB607E0`)

## Summary

Mephisto (`hcIdx 242` `mephisto` and `hcIdx 704` `ubermephisto`, token `MP`) does **not** carry his swirling white spirit mist as a monster COF/DCC component layer. Instead, `D2Client.dll` attaches `Overlay.txt` row `#122` (`0x7A`, `mephisto` -> `MephistoOverlay`) as a looping (`type = 3`) unit overlay on monster creation (`0x6FB570C0`), backed by `Data\Global\Overlays\MephistoOverlay.DC6` in `d2data.mpq` — the sole `.dc6` file in `Data\Global\Overlays\` across all official 1.13c MPQ archives.

During Mephisto's death sequence (`MONMODE_DEATH`, `mode = 0`), the `mephisto` overlay continues looping until `mephistodonotdraw` (`Missiles.txt` `#306`, `Range = 70`) expires and `MissCltHitFunc[34]` (`0x6FB607E0`) sets `unit->dwFlagsEx |= 0x40000` (`UNITFLAG_DONOTDRAW`), hiding both the unit sprite and all unit overlays simultaneously.

---

## 1. Monster Token `MP` COF & `MonStats2.txt` Verification

- **`MonStats.txt`**:
  - `hcIdx 242`: `Id = mephisto`, `Code = MP`, `MonStatsEx = mephisto`, `MonProp = mephisto`.
  - `hcIdx 704`: `Id = ubermephisto`, `Code = MP`, `MonStatsEx = mephisto`.
- **`MonStats2.txt` (`Id = mephisto`)**:
  - Active components: `HD = 0`, `TR = 1` (`lit`), `LG = 0`, `RA = 1` (`lit`), `LA = 1` (`lit`), `RH = 0`, `LH = 0`, `SH = 0`, `S1..S8 = 0`, `TotalPieces = 3`, `BaseW = hth`.
  - Lighting & overlay columns: `Light = 9`, `light-r = 255`, `light-g = 255`, `light-b = 255`, `OverlayHeight = 4`, `noOvly = 0`, `Utrans = 0/0/0`.
- **`data\global\monsters\mp\cof\mp*hth.cof` (`d2data.mpq`)**:
  - `MPNUHTH.COF` (13 frames, 8 dirs), `MPWLHTH.COF` (13 frames, 8 dirs), `MPA1HTH.COF` (18 frames, 8 dirs), `MPA2HTH.COF` (17 frames, 8 dirs), `MPGHHTH.COF` (6 frames, 8 dirs), `MPS1HTH.COF` (17 frames, 8 dirs), `MPS2HTH.COF` (14 frames, 8 dirs): 3 layers (`TR = 1`, `LA = 4`, `RA = 3`), all with `fDrawEffect = 5` (`NORMAL`).
  - `MPDTHTH.COF` (25 frames, 1 dir) and `MPDDHTH.COF` (1 frame, 1 dir): 1 layer (`TR = 1`), `fDrawEffect = 5` (`NORMAL`).
  - Zero `S1`/`S2` spirit layers exist under `data\global\monsters\mp\`.

---

## 2. `Overlay.txt` Row `#122` (`0x7A`) & `Data\Global\Overlays\MephistoOverlay.DC6`

- **`Overlay.txt` / `overlay.bin` row `#122` (`0x7A`)**:
  - `overlay = mephisto`
  - `Filename = MephistoOverlay`
  - `version = 0`
  - `Frames = 26`
  - `PreDraw = 0` (post-draw in front of unit sprite)
  - `1ofN = 1`, `Dir = 0`, `Open = 1`, `Beta = 1`
  - `Xoffset = 0`, `Yoffset = 0`, `Height1..Height4 = 0`
  - `AnimRate = 16` (`(tick * 16) >> 4` = 1 frame per 25 Hz tick)
  - `InitRadius = 0`, `Radius = 0`, `LoopWaitTime = 0`
  - `Trans = 3` (`DRAWMODE_SCREEN` / additive blend; palette index `0` is transparent, black texels add `0`, no dark fringes)
  - `Red = 255`, `Green = 255`, `Blue = 255`, `NumDirections = 1`, `LocalBlood = 0`
- **MPQ Archive Location (`samples/d2/d2data.mpq`)**:
  - Path: `Data\Global\Overlays\MephistoOverlay.DC6` (`587,252` bytes).
  - Across all 285 non-null `Overlay.txt` rows in 1.13c, `284` resolve to `.dcc` files and `MephistoOverlay` is the **only** `.dc6` sprite (`Data\Global\Missiles\` has `0` `.dc6` files).
  - Decoded header: `version = 6`, `flags = 1`, `encoding = 0`, `directions = 1`, `framesPerDirection = 26`.
  - Frame `0` geometry: `width = 217`, `height = 190`, `offsetX = -106`, `offsetY = 52` (`33,266` non-zero pixels). Under the DC6 bottom-up scanline anchor convention (`fLeft = offsetX`, `fTop = offsetY - height + 1`), frame `0` places its top-left corner at `(-106, -137)` relative to Mephisto's pivot, spanning `[-106..+111] x [-137..+53]`.
- **`D2Client.dll` `.dcc` / `.dc6` Overlay Cell Loader (`0x6FB1E628` -> `0x6FB1D800`)**:
  - `0x6FB1E628` (`OverlayCache_GetCell`, archive type `6` = `Data\Global\Overlays\`): sets `flags |= 0x2` and calls `0x6FB1D800`, which invokes `D2CMP.dll!#10005` (`CelLoadFile`), transparently loading either `.dcc` or `.dc6` for `Data\Global\Overlays\<Filename>`.

---

## 3. Complete 734-Monster (`hcIdx 0..733`) Client Overlay Lifecycle in `D2Client.dll`

### 3.1 `0x6FAFD610` (`ClientMonster_SetupClassData`)
Called from `0x6FAFE3D6` (`ClientMonster_InitUnit` on monster spawn) and `0x6FB235E0` (`StateSetFunc[8]` for `States.txt` `#142` `changeclass`, reading new `classId` from `STAT_SHORTPARAM1 = 355`):
1. `0x6FAFD663`: calls `0x6FB19700` to free the unit's entire overlay list (`*(pGfxInfo + 0x28)`). Thus morphing `baalthrone` (`#543`) into `baalcrabstairs` (`#559`) via state `142` (`changeclass`) immediately removes `baal_on_throne` (`#275`).
2. `0x6FAFD82E`: clears `UNITFLAG_DONOTDRAW` (`unit->dwFlagsEx &= ~0x40000`).
3. `0x6FAFD9A8..0x6FAFD9C1`: if `classId == 0x20F` (`527`, `drehyaiced` — Frozen Anya), calls `D2Client_AddUnitOverlay(pUnit, 0xE3 /* 227 'ice_cage' */, type=5 /* STATIC frame 0 */, 0, 0, 0, 0)`.

### 3.2 `0x6FB570C0` (`ClientMonster_InitSpecial`, called at `0x6FB57A55` on monster creation)
Exhaustive decode of every `hcIdx` branch in `0x6FB570C0` (including jump table `0x6FB572B4` / index table `0x6FB572D0`):

| `hcIdx` (Hex) | `MonStats.txt` ID | Address | Action in `0x6FB570C0` |
| --- | --- | --- | --- |
| `242` (`0xF2`), `704` (`0x2C0`) | `mephisto`, `ubermephisto` | `0x6FB57282` | `AddUnitOverlay(pUnit, 0x7A /* 122 'mephisto' */, type=3 /* LOOP */)` |
| `333` (`0x14D`) | `diabloclone` | `0x6FB570F5` | `AddUnitOverlay(pUnit, 0xBA /* 186 'light_cast_2' */, type=2 /* ONCE */)` |
| `340..343` (`0x154..0x157`) | `boneprison1..4` | `0x6FB5725C` | Sub-tile path offset adjustment (no overlay) |
| `351..353` (`0x15F..0x161`) | `hydra1`, `hydra2`, `hydra3` | `0x6FB57172` | `ovStart = classId - 0xB3` (`172..174` `hydra_start1..3`), `AddUnitOverlay(pUnit, ovStart, type=4 /* LOOPEX */, p1=0, next=ovStart+3 /* 175..177 'hydra_loop1..3' */)` |
| `406` (`0x196`) | `izualghost` | `0x6FB571AC` | Sets 3D Z trajectory offset (no overlay) |
| `417..418` (`0x1A1..0x1A2`) | `shadowwarrior`, `shadowmaster` | `0x6FB571CF` | `AddUnitOverlay(pUnit, 0x10E /* 270 'shadowwarriorappear' */, type=2 /* ONCE */)` |
| `521` (`0x209`) | `tyrael3` | `0x6FB571E8` | Sets descent Z trajectory + Tyrael intro (no overlay) |
| `543` (`0x21F`) | `baalthrone` | `0x6FB5729B` | `AddUnitOverlay(pUnit, 0x113 /* 275 'baal_on_throne' */, type=3 /* LOOP */)` |

All overlay-bearing monster classes above (`242`, `333`, `351..353`, `417..418`, `527`, `543`, `704`) have `noOvly = 0` in `MonStats2.txt`. Inside `D2Client_AddUnitOverlay` (`0x6FB1B300`), `0x6FB1B363..0x6FB1B373` checks `(pUnit->dwFlagsEx >> 18) & 1` (`0x40000`, `UNITFLAG_DONOTDRAW`) and aborts if set.

### 3.3 `0x6FAFE3DF..0x6FAFE778` (`MONMODE_DEATH`, `mode = 0`)
- **`mephisto` (`242`) & `ubermephisto` (`704`)**: take the default branch (`0x6FAFE778`); `MephistoOverlay` (`#122`) stays attached and keeps looping during `DT` (`mode = 0`).
- **`hydra1..3` (`351..353`, `0x6FAFE4DC`)**: calls `0x6FB19610` (`FreeAllUnitOverlays`, removing `hydra_start1..3` / `hydra_loop1..3`) and `0x6FB56F60` (`AddUnitOverlay(pUnit, classId - 0xAD /* 178..180 'hydra_end1..3' */, type=2 /* ONCE */)`).
- **`shadowwarrior` / `shadowmaster` (`417..418`, `0x6FAFE761`)**: calls `0x6FB1B300` (`AddUnitOverlay(pUnit, 0x10F /* 271 'shadowwarriordeath' */, type=2 /* ONCE */)`).

### 3.4 `0x6FAFE79C..0x6FAFE850` (`MONMODE_DEAD`, `mode = 12`)
At `0x6FAFE824..0x6FAFE847`, entering `MONMODE_DEAD` (`mode = 12`) calls `0x6FB19610` (`FreeAllUnitOverlays`) for every monster **except**:
- `0xD3` (`211`, `duriel`, preserving `durieldead_fwd` / `durieldead_rear` bloodsplat overlays),
- `0x1F1` (`497`, `catapult1`),
- `0x1A1` (`417`, `shadowwarrior`),
- `0x1A2` (`418`, `shadowmaster`).

Thus if `ubermephisto` (`704`, which has no `MonProp = mephisto` quest death controller) transitions to `MONMODE_DEAD` (`mode = 12`), `0x6FB19610` immediately frees `MephistoOverlay` (`#122`) so no mist lingers on the corpse.

---

## 4. Mephisto Death Suppression (`mephistodonotdraw` `#306` & `UNITFLAG_DONOTDRAW`)

When `mephisto` (`hcIdx 242`) dies (`0x6FB025F0` via `MonUMod 22` event 1):
1. Spawns `mephistodeathcontrol` (`#299`), `mephistoholedelay` (`#358`), and `mephistodonotdraw` (`#306`, `Range = 70`, `pCltDoFunc = 28`, `pCltHitFunc = 34`, `CltParam1 = 15`) with Mephisto as missile owner.
2. At elapsed tick `15`, `MissCltDoFunc[28]` (`0x6FB68010`) spawns 4 `corpseexplosion` (`#105`) bursts around Mephisto.
3. At tick `70` (range expiry in `0x6FB615C8`), `MissCltHitFunc[34]` (`0x6FB607E0`) executes:
   ```c
   UnitAny* pOwner = D2Client_FindMissileOwner_6FB560D0(pMissile);
   if (pOwner != NULL) {
     pOwner->dwFlagsEx |= 0x40000; // UNITFLAG_DONOTDRAW
   }
   return 0;
   ```
4. Once `dwFlagsEx & 0x40000` (`clientNoDraw`) is set, `D2Client` skips the entire unit draw pass (`0x6FADBA00` — pre-overlays, body sprite, and post-overlays alike) and `0x6FB1B363` blocks any further overlays on the unit, guaranteeing zero lingering mist after `mephistodonotdraw` finishes.

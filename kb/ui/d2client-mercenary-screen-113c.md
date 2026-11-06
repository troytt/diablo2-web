# Diablo II v1.13c Mercenary (Pet / Hireling) Screen (`UI_DrawMercScreen` `0x6fb4ae80`)

## Overview
In Diablo II: Lord of Destruction v1.13c, the Mercenary screen (`UI_MERC = 0x24`, toggled via `O` hotkey or right-clicking the top-left Mercenary portrait) is rendered by `D2Client.dll` at `0x6fb4ae80` (`Panel\NPCInv.dc6`) using the `inventory.txt` rows `Hireling` (640x480) and `Hireling2` (800x600).

## Decompiled `D2Client.dll` Functions

| Address | Function | Responsibility |
|---|---|---|
| `0x6fb4ae80` | `UI_DrawMercScreen` | Draws the `Panel\NPCInv.dc6` 2x2 frame mosaic (`320x432`), Mercenary name (`font6`), 12 localized stat labels, 12 stat readouts (`font16` with `font6` overflow fallback), and close button (`buysellbtn.dc6` frame 10/11). |
| `0x6fb3b2f0` | `UI_GetMercUnit` | Returns the active player's living hireling `UnitAny*` (`type = 1`, `dwUnitId = mercId`). |
| `0x6fb3c8b0` | `UI_DrawMercItemOverlays` | Iterates Mercenary body slots (`1` Head, `3` Torso, `4` Right Arm, `5` Left Arm), draws empty slot silhouettes (`inv_helm_glove.dc6` frame 1, `inv_armor.dc6` frame 0, `inv_weapons.dc6` frame 0) when empty, or draws equipped item sprites + 2H translucent phantom (`alpha = 0.38`) + usability tint (`0x6fb47be0`). |
| `0x6fb3ea20` | `UI_CalcMercDamageAndAR` | Computes Mercenary effective Attack Rating, minimum damage, and maximum damage from `STAT_SECONDARY_MINDAMAGE` / `STAT_MINDAMAGE` and `STAT_DAMAGEPERCENT` + strength/dexterity bonuses. |
| `0x6fb0b880` | `UI_MercPortrait_OnClick` (`Hireables.cpp`) | Handles clicks on the top-left `48x48` Mercenary portrait (`x: 16..64, y: 16..64`): right-click (`button == 2`) toggles `UI_MERC` (`0x24`). |

## `inventory.txt` (`Hireling` & `Hireling2`) Coordinates

- **640x480 (`Hireling`)**: Panel origin `(0, 0)`, bounds `[0..320, 0..432]`.
- **800x600 (`Hireling2`)**: Panel origin `(80, 60)` inside left dock (`borderLeft.dc6` at `(0, 60)`), bounds `[80..400, 60..492]`.

| Element | Relative to `(ox, oy)` | 800x600 (`Hireling2`) | Dimensions | Notes |
|---|---|---|---|---|
| **Head (`1`)** | `(133, 4)` | `(213, 64)` | `56 x 56` | Empty silhouette: `inv_helm_glove.dc6` frame 1 (`54x53` at `srcX = 54`) |
| **Torso (`3`)** | `(133, 73)` | `(213, 133)` | `56 x 85` | Empty silhouette: `inv_armor.dc6` frame 0 (`54x82`) |
| **Right Arm (`4`)** | `(19, 45)` | `(99, 105)` | `55 x 113` | Empty silhouette: `inv_weapons.dc6` frame 0 (`54x109`) |
| **Left Arm (`5`)** | `(249, 45)` | `(329, 105)` | `55 x 113` | Empty silhouette: `inv_weapons.dc6` frame 0 (`54x109`) unless 2H weapon in slot `4` |
| **Close Button** | `(270..302, 384..416)` | `(350..382, 444..476)` | `32 x 32` | Drawn with `buysellbtn.dc6` frame 10 at `(ox + 272, oy + 385)` |

## Text & Stat Readout Layout (`0x6fb4ae80`, relative to `(ox, oy)`)

All labels use `font16` (white) except:
- Mercenary Name (`font6`, white, left-aligned at `(ox + 15, oy + 214)`, truncated to `<= 160 px`)
- Long single-line labels (`width > 120 px`, e.g. `"Next Level"` -> `font6` at `oy + 234`)
- Two-line resistance labels (`strchrfir`, `strchrcol`, `strchrlit`, `strchrpos` split on `\n` or last space in `font6` centered at `ox + 230`, `oy + relY - 6` and `oy + relY + 4`).

All stat values (`0x6fb3ea20`, `.data` @ `0x6fb91210`) use `font16` unless `font16` width exceeds `maxW` (`48 px` for narrow stat boxes), in which case `0x6fb3ea20` switches to `font6`.

| Row | Label `.tbl` Key | Label Pos `(relX, relY)` | Value Pos `(relX, relY)` | Value Align | Max Width | Color Rules (`0x6fb3ea20`) |
|---|---|---|---|---|---|---|
| Life | `strchrlif` (`#4018`) | `(180, 214)` left | `(258, 215)` | center | `0` | White (`cur / max`) |
| Experience | `strchrexp` (`#4014`) | `(15, 236)` left | `(120, 254)` | right | `0` | White |
| Level | `strchrlvl` (`#4015`) | `(145, 236)` left | `(175, 254)` | right | `0` | White |
| Next Level | `strchrnxtlvl` (`#4016`) | `(200, 236)` left | `(305, 254)` | right | `0` | White (`ExpPerLvl * (lvl+2) * (lvl+1) * (lvl+1)` from `Hireling.txt`) |
| Strength | `strchrstr` (`#4011`) | `(15, 281)` left | `(154, 282)` | right | `48` | Blue (`eff > base`), Red (`eff < base`), else White |
| Dexterity | `strchrdex` (`#4012`) | `(15, 305)` left | `(154, 306)` | right | `48` | Blue (`eff > base`), Red (`eff < base`), else White |
| Damage | `strchrskm` (`#4017`) | `(15, 329)` left | `(154, 330)` | right | `48` | Blue (enchant/percent bonus), else White |
| Defense | `strchrdef` (`#4020`) | `(15, 353)` left | `(154, 354)` | right | `48` | Blue (bonus > 0), Red (penalty), else White |
| Fire Resist | `strchrfir` (`#4024`) | `(230, 281)` center | `(309, 282)` | right | `48` | Gold (`>= maxRes`), Red (`< 0`), Blue (bonus > 0), else White |
| Cold Resist | `strchrcol` (`#4026`) | `(230, 305)` center | `(309, 306)` | right | `48` | Gold (`>= maxRes`), Red (`< 0`), Blue (bonus > 0), else White |
| Lightning Resist | `strchrlit` (`#4025`) | `(230, 329)` center | `(309, 330)` | right | `48` | Gold (`>= maxRes`), Red (`< 0`), Blue (bonus > 0), else White |
| Poison Resist | `strchrpos` (`#4027`) | `(230, 353)` center | `(309, 354)` | right | `48` | Gold (`>= maxRes`), Red (`< 0`), Blue (bonus > 0), else White |


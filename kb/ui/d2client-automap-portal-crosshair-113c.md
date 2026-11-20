# D2Client Automap: Town Portal / Permanent Portal Marker (1.13c)

Scope: how `D2Client.dll` (image base `0x6FAB0000`) marks object class `59` (Town Portal) and
class `60` (Permanent Town Portal) on the automap. Source: `objdump -d -M intel` of the 1.13c
`D2Client.dll`; no other reference was used.

## 1. Summary

- Portals are **not** drawn with a `MaxiMap.dc6` / `MaxiMapS.dc6` cell. They are drawn with the
  same 12-segment crosshair as units (`0x6FB0F1C0`), in palette colour `0x6FBCC218`.
- `0x6FBCC218` is initialised to the palette index nearest to `RGB(244, 244, 0)`.
- Class `60` is not marked in levels `111`, `112`, `117`, `125`, `126`, `127`.
- No text is drawn for a portal by this code path. The only object that gets automap text here is
  class `267` (stash).
- Cell `307` is the Waypoint cell (see `d2client-automap-waypoint-parity.md`), cell `300` is the
  red `X` quest marker. Neither is referenced by the portal path.

## 2. Colour table init (`0x6FB0F090`)

Eleven consecutive calls to thunk `0x6FABD390` (nearest palette index for 3 byte arguments), each
result stored to one byte of `0x6FBCC210..0x6FBCC21A`. Arguments are pushed right to left, so the
first argument is the last `push`.

| Byte | Pushes (in order) | Arguments | Used for (`0x6FB11490`) |
|---|---|---|---|
| `0x6FBCC210` | `FF, 00, 00` | `(0, 0, 255)` | local player (`0x6FB1171E`) |
| `0x6FBCC211` | `00, 00, FF` | `(255, 0, 0)` | other player, not in party (`0x6FB1175D`) |
| `0x6FBCC212` | `FF, 00, FF` | `(255, 0, 255)` | own corpse (`0x6FB11702`) |
| `0x6FBCC213` | `00, FF, 00` | `(0, 255, 0)` | party member (`0x6FB1174B`) |
| `0x6FBCC214` | `74, 70, 44` | `(68, 112, 116)` | own pet (`0x6FB116A5` / `0x6FB116B8`) |
| `0x6FBCC215` | `34, A0, 48` | `(72, 160, 52)` | party pet (`0x6FB116D4`) |
| `0x6FBCC216` | `F4, F4, F4` | `(244, 244, 244)` | interactable NPC (`0x6FB115B6`) |
| `0x6FBCC217` | `80, 80, 80` | `(128, 128, 128)` | not read by `0x6FB11490` |
| `0x6FBCC218` | `00, F4, F4` | `(244, 244, 0)` | **portal, class 59 / 60** |

## 3. Colour selection (`0x6FB11490`, unit in `eax`, out byte in `ebx`)

Returns `1` with the colour byte written to `[ebx]`, or `0` for "do not mark".

```text
0x6fb114a0  type = unit[0]                      ; 0 player, 1 monster, 2 object
0x6fb114b2  type == 2:
0x6fb114c2    classId = unit[4]
0x6fb114c5    classId == 0x3B (59)  -> [ebx] = byte 0x6FBCC218 ; return 1     (0x6fb1153a)
0x6fb114ca    classId == 0x3C (60)  -> level = thunk(thunk(unit))             (0x6fb114e6)
0x6fb114f2        level in {0x7D, 0x7E, 0x7F, 0x6F, 0x70, 0x75} -> return 0
0x6fb11528        else [ebx] = byte 0x6FBCC218 ; return 1
0x6fb114cd    classId == 0x10B (267) -> [ebx] = 0 ; return 1                  (0x6fb114d8)
0x6fb114d2    anything else          -> return 0                              (0x6fb11687)
```

Every other object class returns `0`: no crosshair. Static object markers come from the
`Objects.txt` `AutoMap` cell on the object layer, which is a different path.

## 4. Draw (`0x6FB119E0`, unit in `eax`)

```text
0x6fb11a3c  call 0x6fb11490 ; 0 -> return
0x6fb11a4a  x = unitX / [0x6FBA16B0] - [0x6FBCC1F8] + 8
0x6fb11a72  y = unitY / [0x6FBA16B0] - [0x6FBCC1FC] - 8
0x6fb11a89  clip against [0x6FBCC228..0x6FBCC234] ; outside -> return
0x6fb11ac3  type == 2:
0x6fb11aca    if [0x6FBA16BC] != 0 and classId == 0x10B (267):
0x6fb11aea        text = string index 0xCF3, font 6, drawn centred at (x - width / 2, y - 10)
              else:
0x6fb11b2a        0x6fb0f1c0(x, y, colour)       ; 12-segment crosshair
```

So class `59` / `60` always reach `0x6FB11B2A`: a crosshair at the same `(x, y - 8)` baseline used
for players and monsters.

## 5. Port

| Original | TypeScript |
|---|---|
| `0x6FB11490` object branch, `0x6FB11B2A` | `Minimap.draw` step 5 in `src/client/ui/minimap.ts` (`AUTOMAP_CROSSHAIR_COLORS.portal`, `drawCrosshairPolygon`) |
| `0x6FB114F2..0x6FB11522` level gate | same block, `portal.kind === 'red'` |

Port-only additions (not in the original):

- Miniature portal marker. When the Town Portal world sprite (`town_portal_on_hd`, frame 0) is
  loaded, `Minimap.draw` draws it scaled down (`AUTOMAP_PORTAL_ICON_HEIGHT_FULL` /
  `AUTOMAP_PORTAL_ICON_HEIGHT_MINI`), centred on the unit point, instead of the crosshair. Portals
  passed as `kind: 'red'` use the same sprite with a red tint. The 0x218 crosshair of section 4 is
  drawn only while that sprite is not loaded.
- Optional text label above the marker. The label text is chosen by the active string-table
  language in `src/client/scene/world-renderer.ts` (`ENG` -> `name`, `CHI` -> `nameZh`).

Previous behaviour, removed: drawing `MaxiMap` cell `306` (own portal), `307` (other player's
portal, which is the Waypoint cell) or `300` (any portal in level 4).

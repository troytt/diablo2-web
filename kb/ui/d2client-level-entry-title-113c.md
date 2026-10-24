# Diablo II 1.13c Level Entry Title — "Entering The Blood Moor" (`D2Client.dll` `0x6fb6f0d0`)

> Issue #1007: switching areas showed no centred "Entering xxx" title. 1.13c draws one from a per-level DC6.
> Port: `src/common/world/level-entry-title-113c.ts` (state), `src/client/ui/level-entry-title.ts` (draw),
> `src/baker/packers/pack-level-entry-titles.ts` (atlas + `src/common/world/level-entry-titles-113c.ts`).

## 1. Data

- `Levels.txt` `EntryFile` (e.g. `A1L2`) is a **DC6 file name, not a string-table key**. `D2Common #10014(levelId)`
  returns the Levels record; `EntryFile` sits at `+0x145`.
- Path `"%s\UI\%s\%s\%s"` (`0x6fb8348c`) = `DATA\LOCAL\UI\<LNG>\<folder>\<EntryFile>`:
  - `folder = "EXPANSION"` (`0x6fb834b0`) when `levelId >= 0x6d` (Harrogath and later), else `"ACT%d"`
    (`0x6fb834a8`) with `D2Common #10459(levelId) + 1` (Levels.txt `Act`).
- All 136 levels have an `EntryFile`; 131 distinct DC6s incl. the overrides. Each is 1 direction, 1–3 frames, height
  26, offsets `(0,0)`, every non-final frame 256 px wide (e.g. `act1/a1l2` = 256 + 107 → "Entering The Blood Moor").
- Only `data\local\ui\eng\...` exists in the 1.13c MPQs; the Chinese client shows the English titles too (#1007).

## 2. Quest override table `0x6fb8be88`

13-byte records `{ int levelId; int questId; char file[5]; }`, count `0x6fb8bea0 = 2`:

| levelId | questId | file | text |
|---|---|---|---|
| 8 (Den of Evil) | 1 | `A1Q1` | "Entering The Den of Evil" |
| 20 (Forgotten Tower) | 5 | `A1Q5` | (Forgotten Tower title) |

If `levelId` matches and `g_QuestAvail[questId]` (`0x6fbc5590`, S2C 0x5E pkt[1..37]) is non-zero, the path is
`"%s\UI\%s\ACT1\%s"` (`0x6fb83478`). Reading `g_QuestAvail` before the first 0x5E (`g_bQuestAvailRecv 0x6fbcc0a0`)
is FatalAssert `0x60`; `questId >= 0x25` is FatalAssert `0x65` (same guards as `0x6fb12de0`).

## 3. Per-frame state machine (`0x6fb6f0d0`, called from the UI draw at `0x6fb73aa1`)

1. `g_pPlayerUnit (0x6fbcbbfc)` null or `D2Common #10331(unit)` (room) null → free the cached cell file
   (`0x6fbaad54`, via `D2CMP #10065` + `Fog #10043`) and return.
2. `levelId = D2Common #10826(room)`. If `levelId != g_nLastLevel (0x6fbd3410)`: free the cell file,
   `g_nFrames (0x6fbd340c) = (g_nLastLevel != 0) ? 0 : 0x78` (`setne cl; dec ecx; and ecx, 0x78`),
   `g_nLastLevel = levelId`. → **the first level after process start never shows a title**.
   `g_nLastLevel` has no other writer: it is **not reset between games**.
3. `g_nFrames >= 0x78` → free and return. Else `++g_nFrames`, build the path, load the cell file once.
4. Draw `D2Win #10138(pCell, x = screenW/2, y = screenH/2 - 0x8c, align = 1, drawMode = 5, paletteShift = 1)`.

120 frames at the fixed 25 Hz client rate = **4.8 s**. The call comes after the escape menu (`0x6fb15230` @
`0x6fb73a3f`), so the title is drawn over it.

## 4. `D2Win #10138` (`0x6f8f17a0`) placement and colour

- `align == 1`: `x += -1 - (Σ frame widths >> 1)` (`shr edi,1; or ecx,-1; sub ecx,edi`); frames at `x + i*0x100`.
- `y` is passed straight to the cell draw (bottom edge, as for the escape-menu banners).
- `paletteShift != -1` → `D2Gfx #10019` → renderer `+0x88` (D2DDraw `0x6f8c6c00`): `edi = table[0xd0 + shift*4]`.
  The table is built by `D2Win 0x6f8eee60`: `+0x00..0x08` alpha blends, `+0x0c` 32 light levels, `+0x8c` 16 inverse
  colours, `+0xcc` selected-unit shift, **`+0xd0` 13 text-colour shifts** (`0x6f921638 + i*0x100`, copied from PL2
  `+0x6b627`), `+0x104` additive, `+0x108` multiply, `+0x10c` max-component.
  → shift 1 = PL2 `textShifts[1]` (red tone). The baker applies it to the DC6 indices before writing the atlas.

## 5. Native layout

| Mode | Title bottom | `act1/a1l2` (363 px) left |
|---|---|---|
| 800×600 | 160 | 218 |
| 640×480 | 100 | 138 |

# D2Client.dll v1.13c Ethereal Item Rendering (`GFX_DrawItem` @ `0x6FB1B5A0` & `GFXUTIL_GetUnitComponentDrawMode` @ `0x6FB1DFE0`)

## 1. UI Item Sprite Translucency (`D2Client.dll` `0x6FB1B5A0`, `ENGINE\Gfx.cpp` line 2754)

All 2D UI item DC6 sprites (`data\global\items\inv*.dc6`) in Diablo II v1.13c are rendered through `GFX_DrawItem` (`0x6FB1B5A0..0x6FB1B6F2`, `ImageBase = 0x6FAB0000`):

### Disassembly (`0x6FB1B664..0x6FB1B6B7`)

```asm
; ebx = UnitAny* pItem, edi = CellFile* pInvCellFile
6FB1B664: push 1
6FB1B666: lea  edx, [esp+0x64]
6FB1B66A: push edx
6FB1B66B: push ebx
6FB1B66C: push edi
6FB1B66D: call 0x6FABCC04                ; ITEMS_GetInvTransformPalette -> eax = pPalette

6FB1B672: push 0x6FB84FA4                ; "..\\Source\\D2Client\\ENGINE\\Gfx.cpp"
6FB1B677: push 0xAC2                     ; line 2754
6FB1B67C: push 0x00400000                ; IFLAG_ETHEREAL (0x00400000)
6FB1B681: push ebx                       ; pItem
6FB1B682: mov  edi, eax                  ; edi = pPalette
6FB1B684: mov  esi, 5                    ; esi = DRAWMODE_NORMAL (5, 100% opaque)
6FB1B689: call 0x6FABC1A8                ; D2Common.dll!#10202 (ITEMS_CheckItemFlag)
6FB1B68E: test eax, eax
6FB1B690: je   0x6FB1B697
6FB1B692: mov  esi, 1                    ; esi = DRAWMODE_TRANS50 (1, 50% opacity)

6FB1B697: mov  eax, [esp+0x4C]
6FB1B69B: push edi                       ; pPalette
6FB1B69C: push esi                       ; eDrawMode (5 = normal, 1 = ethereal)
6FB1B69D: push -1                        ; dwColor (-1 = default)
6FB1B69F: push eax
6FB1B6A0: call 0x6FABC0E2                ; D2CMP_10085_GetCellFrameHeight
6FB1B6A5: mov  esi, [esp+0x68]           ; nX
6FB1B6A9: add  eax, ebp                  ; nY + frameHeight
6FB1B6AB: push eax                       ; nYPos
6FB1B6AC: push esi                       ; nXPos
6FB1B6AD: lea  ecx, [esp+0x24]           ; &sCelContext
6FB1B6B1: push ecx
6FB1B6B2: call 0x6FABD096                ; D2gfx.dll!#10041 (D2GFX_DrawCelContext)
```

---

## 2. Exact `eDrawMode` Opacity Mapping in 1.13c Render Backends

`D2gfx.dll!#10041` (`D2GFX_DrawCelContext` @ `0x6FA8B080`, `ImageBase = 0x6FA80000`) forwards `eDrawMode` (`0..7`) directly to `[gpGraphicsInterface + 0x84]` (`pfCelDraw`):

### `D2Direct3D.dll` (`0x6F886B90` @ `0x6F886CD3..0x6F886CEF`, `ImageBase = 0x6F880000`)

```asm
6F886CD3: cmp eax, 2          ; switch (eDrawMode)
6F886CD6: ja  0x6F886CEF
6F886CD8: je  0x6F886CE8      ; case 2 -> alpha = 0xC0
6F886CDA: sub eax, 0
6F886CDD: je  0x6F886CE3      ; case 0 -> alpha = 0x40
6F886CDF: dec eax
6F886CE0: jne 0x6F886CEF
6F886CE2: ; case 1 (falls into 0x80 via 0x6F886CEE)
```

The blend state of modes 3/4 comes from the D2Direct3D `0x6F886B90` jump table `0x6F886CF4` (indexed by mode − 3):
mode 3 → `0x6F886BF4` sets SRCBLEND/DESTBLEND = **ONE/ONE (additive)**, mode 4 → `0x6F886C41` sets **ZERO/SRCCOLOR
(multiply)**, modes 5/7 → `0x6F886BA7` blend off (opaque). The symbolic enum names `MODULATE` / `BURN` for 3 / 4 are
misnomers. The GDI column is the `D2Gdi.dll` `0x6F8762E0` jump table `0x6F87633C` (`cmp eax,6 / ja` → no table for
mode ≥ 7; blend-type array `0x6F87BB80` = {2,2,2,1,1,0,1,0}). Full details: [`render/d2gfx-draw-mode-113c.md`](../render/d2gfx-draw-mode-113c.md).

| `eDrawMode` | Symbolic Name | D3D Blend State (`D2Direct3D.dll`) | Normalized Opacity / Effect | GDI Table (`[0x6F87C550]` + offset) |
|---:|---|---|---|---|
| `0` | `DRAWMODE_TRANS25` | SRCALPHA/INVSRCALPHA, vertex α `0x40` | `0.25` (25%) | `+0x08` (alpha table) |
| `1` | `DRAWMODE_TRANS50` | SRCALPHA/INVSRCALPHA, vertex α `0x80` | `0.50` (**50%**) | `+0x04` (alpha table) |
| `2` | `DRAWMODE_TRANS75` | SRCALPHA/INVSRCALPHA, vertex α `0xC0` | `0.75` (75%) | `+0x00` (alpha table) |
| `3` | `DRAWMODE_MODULATE` (misnomer) | **ONE/ONE** (`0x6F886BF4`) | **Additive** (dst + src) | `+0x104` (PL2 additive lookup) |
| `4` | `DRAWMODE_BURN` (misnomer) | **ZERO/SRCCOLOR** (`0x6F886C41`) | **Multiply** (dst × src) | `+0x108` (PL2 multiplicative lookup) |
| `5` | `DRAWMODE_NORMAL` | blend off (`0x6F886BA7`) | `1.00` (**100% opaque**) | none (direct index copy) |
| `6` | `DRAWMODE_TRANSHIGHLIGHT` | default branch: SRCALPHA/INVSRCALPHA, α `0xFF` | opaque | `+0x10C` |
| `7` | `DRAWMODE_HIGHLIGHT` | blend off (`0x6F886BA7`), texture variant 2 (hover-brightened palette, `0x6F887DFB`) | opaque + brighten | none (direct copy) |
| `≥8` | — | default branch, α `0xFF` | opaque (treat as 5) | none (`ja`) |

Therefore, an Ethereal item (`IFLAG_ETHEREAL = 0x00400000`) always renders its UI sprite at **`DRAWMODE_TRANS50 = 1` (50% opacity, `globalAlpha = 0.5`)**.

---

## 3. All 12 UI Call Sites of `GFX_DrawItem` (`0x6FB1B5A0`) in `D2Client.dll`

Every UI item container and cursor path in `D2Client.dll` routes through `0x6FB1B5A0`:

| Call Site | Source Module | UI Context |
|---|---|---|
| `0x6FAC69EC` | `UI\cursor.cpp` | Held item on mouse cursor (normal viewport mode) |
| `0x6FAC6B77` | `UI\cursor.cpp` | Held item on mouse cursor (alternate cursor dispatch) |
| `0x6FAD90DA` | `UI\trade.cpp` | Player-to-player trade / special item slot |
| `0x6FB4525F` | `UI\inv.cpp` | **Socketed child item** (`pSocketedItem` inside hovered host item's `Gemsocket.dc6`) |
| `0x6FB4533C` | `UI\inv.cpp` | Equipped paperdoll slots (Inventory & Mercenary equipment) |
| `0x6FB454E3` | `UI\inv.cpp` | Belt quick-access & expanded belt slots (`popbelt.dc6`) |
| `0x6FB455B7` | `UI\inv.cpp` | Belt / secondary container item rendering |
| `0x6FB45709` | `UI\inv.cpp` | 10×4 Inventory grid, 6×8 Stash grid, 3×4 Horadric Cube grid |
| `0x6FB45849` | `UI\inv.cpp` | Trade / secondary grid items |
| `0x6FB45A54` | `UI\inv.cpp` | NPC Store / Gamble grid (`buysell.dc6`) |
| `0x6FB45B73` | `UI\inv.cpp` | Alternate container grid item loop |
| `0x6FB4FC18` | `UI\inv.cpp` | Quest reward / Imbue / Add Sockets / Personalize single-item slot |

### Socketed Child Item Rule (`0x6FB4521B..0x6FB45265`)
When hovering a socketed item in `UI\inv.cpp` (`0x6FB45140`):
1. The empty socket ring (`data\global\ui\PANEL\gemsocket.dc6`) is drawn directly via `D2GFX_DrawCelContext` (`0x6FB4523F`) with `eDrawMode = 0` (`DRAWMODE_TRANS25`, **25% opacity** / `globalAlpha = 0.25`), **not** `GFX_DrawItem` — its opacity is fixed at `0.25` and unaffected by the host item's `IFLAG_ETHEREAL`.
2. Each socketed child item (`edi = pSocketedItem`) is drawn via `GFX_DrawItem(pSocketedItem, ...)` (`0x6FB4525F`), which checks `IFLAG_ETHEREAL` on `pSocketedItem` itself.
3. Since Gems, Runes, and Jewels cannot be Ethereal, **socketed Gems/Runes/Jewels inside an Ethereal base item render at 100% opacity (`DRAWMODE_NORMAL = 5`)**, while the Ethereal host item sprite beneath them renders at **50% opacity (`DRAWMODE_TRANS50 = 1`)** and the socket ring renders at **25% opacity (`DRAWMODE_TRANS25 = 0`)**.

---

## 4. World Unit & Ground Flippy Item Behavior (`0x6FB1DFE0`, `ENGINE\GfxUtil.cpp`)

`GFXUTIL_GetUnitComponentDrawMode` (`0x6FB1DFE0..0x6FB1E1BA`, called from `0x6FB1C89A` during world unit composite layer rendering) determines per-component translucency in the isometric world view:

1. **Ground Flippy Items (`UNIT_ITEM = 4`)**:
   - Jump table `0x6FB1E1BC` maps `eUnitType = 4` (`UNIT_ITEM`) directly to the default return path (`0x6FB1E058`), leaving `*pOutDrawMode = 5` (`DRAWMODE_NORMAL`).
   - Ground item flippy animations (`flp*.dc6`) are **100% opaque** even when the item is Ethereal; only their ground hover label changes to gray (`#a0a0a0`, `UI\showitems.cpp` `0x6FB093BF`).
2. **World Player Composite Layers (`UNIT_PLAYER = 0`)**:
   - Body armor/helm DCC layers (`HD = 0`, `TR = 1`, `LG = 2`, `RA = 3`, `LA = 4`, `S1 = 8`, `S2 = 9`) do **not** check `IFLAG_ETHEREAL` and always render opaque (`DRAWMODE_NORMAL = 5`).
   - Only equipped right-hand weapon (`COMP_RH = 5`, line 1553 -> `DRAWMODE_TRANS50 = 1` at `0x6FB1E179..0x6FB1E193`), left-hand weapon (`COMP_LH = 6`, line 1564 -> `DRAWMODE_TRANS50 = 1` at `0x6FB1E13A..0x6FB1E176`), and shield (`COMP_SH = 7`, line 1575 -> `DRAWMODE_TRANS75 = 2` at `0x6FB1E0FB..0x6FB1E137`) check `IFLAG_ETHEREAL` on the corresponding equipped item.

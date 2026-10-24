# D2gfx eDrawMode for Overlay.txt / Missiles.txt `Trans` (1.13c)

Ground truth: 1.13c binaries in `~/d2-data` (ImageBase D2Client `0x6FAB0000`, D2Common `0x6FD50000`,
D2gfx `0x6FA80000`, D2Direct3D `0x6F880000`). Disassembled with `objdump -d -M intel`.

> [!IMPORTANT]
> In 1.13c the D2Common ordinals differ from 1.10f. 1.13c `D2Client.dll` imports
> D2Common #10678, but that ordinal is **not** `DATATBLS_GetTransFromOverlayTxt`. In 1.13c the overlay getters sit at
> `0x6FDD2CE0..0x6FDD2F30`. The Trans getter is **#10299** (`0x6FDD2E00`, `movzx eax, byte [rec+0x7C]`, stride 0x84).
> D2Client does **not** import #10299. It reads `pOverlayTxt[id].nTrans` directly from
> `sgptDataTables` (`[[0x6FB7E474]] + 0xBBC/0xBC0`).
> The other overlay getters: #10183=Dir(+0x50), #10799=1ofN(+0x4C), #10125=Radius/Color, #10719=OffsetY(+0x58), #10632=OffsetX(+0x54),
> #10693=PreDraw(+0x48), #10891=Frames(+0x44).

## 1. Draw call

`D2gfx.dll #10041` (`0x6FA8B080`) = `D2GFX_DrawCelContext(pCelContext, nX, nY, dwColor, eDrawMode, pPalette)`.
It forwards all six args unchanged to `[gpGfxInterface+0x84]`, with **no clamping of eDrawMode**.

## 2. Overlay.txt `Trans` → eDrawMode: IDENTITY (no remap)

D2Client passes the raw `Trans` byte (`+0x7C`) as `eDrawMode`. There are two overlay draw loops:

```asm
; per-unit overlay pass A (0x6FB1B040..0x6FB1B15C)
6FB1B0B7  imul ebx, ebx, 0x84 ; add ebx,[tbl+0xBBC]      ; pOverlayTxt[id]
6FB1B11D  movzx ecx, byte [ebx+0x7C]                      ; Trans
6FB1B12C  push 0          ; pPalette
6FB1B12E  push ecx        ; eDrawMode = Trans
6FB1B132  push edx        ; dwColor
...       push y / push x / push &ctx
6FB1B143  call 0x6FABD096 ; -> D2gfx #10041
; pass B (0x6FB1B1D0..0x6FB1B2E1), same with dwColor = 0xFFFFFF80
6FB1B2B2  movzx ecx, byte [eax+0x7C] ; push 0 ; push ecx ; push 0xFFFFFF80 ... call 0x6FABD096
```

1.13c Overlay.txt `Trans` values: 3 (284 rows), 5 (energyshield, durieldead_fwd, durieldead_rear,
vulturedemonfeathers, fetishdeath1), 0 (whirlwind, ice_cage, ice_cage_melt), 8 (tentacleheadbloodripple).

## 3. Missiles.txt `Trans` (missiles.bin +0x18D) → eDrawMode: REMAPPED

The only D2Client read of `+0x18D` is in the generic single-cel unit draw, unit type 3 (missile):

```asm
6FB1CF2A  mov eax,[esi+4] ; call 0x6FAB1580          ; pMissilesTxt[classId] (stride 0x1A4)
6FB1CF32  mov cl, byte [eax+0x18D]                    ; Trans
6FB1CF3B  mov edx, 5                                  ; default DRAWMODE 5 (normal)
6FB1CF40  jne +; mov edx, 3                           ; Trans==1 -> 3
6FB1CF47  cmp cl,2 ; jne + ; mov edx, 4               ; Trans==2 -> 4
6FB1CF51  test ebp,ebp ; je + ; mov edx, 7            ; unit == hovered unit (0x6FB01A80) -> 7
6FB1CF5A  mov cl,[eax+0x1A2] ; LocalBlood -> palette = blood palette (0x6FBCC2D8)
6FB1CF87  call 0x6FABD096                             ; D2gfx #10041(ctx,x,y,color,edx,palette)
```

| Missiles.txt Trans | eDrawMode | rows |
|---:|---:|---|
| empty/0 | 5 | 224 (arrows, meteor, blood…) |
| 1 | 3 | 456 |
| 2 | 4 | unholybolt1..4 |
| (hovered) | 7 | overrides |

## 4. What each eDrawMode does (D2Direct3D `0x6F886B90`, jump table `0x6F886CF4` indexed by mode−3)

D3D7 `SetRenderState` (`vtbl+0x58`): 0x1B=ALPHABLENDENABLE, 0x13=SRCBLEND, 0x14=DESTBLEND.

| mode | Symbolic name | D3D state (addr) | GDI (`D2Gdi 0x6F8762E0`, table ptr `[0x6F87C550]`) | WebGL equivalent |
|---:|---|---|---|---|
| 0 | TRANS25 | blend on, SRCALPHA/INVSRCALPHA, vertex α=0x40 (`0x6F886C8E`,`0x6F886CD7`) | alpha table `[+8]` | `blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)`, α=0.25 |
| 1 | TRANS50 | same, α=0x80 | `[+4]` | α=0.50 |
| 2 | TRANS75 | same, α=0xC0 | `[+0]` | α=0.75 |
| 3 | "MODULATE" (misnomer) | blend on, **ONE/ONE = additive** (`0x6F886BF4`) | lookup `[+0x104]` (PL2 additive) | `blendFunc(ONE, ONE)` |
| 4 | "BURN" (misnomer) | blend on, **ZERO/SRCCOLOR = multiply** (`0x6F886C41`) | lookup `[+0x108]` (PL2 multiplicative) | `blendFunc(ZERO, SRC_COLOR)`; transparent texels must be discarded |
| 5 | NORMAL | blend off (ONE/ZERO), opaque (`0x6F886BA7`) | direct copy | opaque, palette index 0 = transparent |
| 6 | TRANSHIGHLIGHT | default branch: SRCALPHA/INVSRCALPHA, α=0xFF, so opaque | lookup `[+0x10C]` | unused by Overlay/Missiles tables |
| 7 | HIGHLIGHT | opaque (`0x6F886BA7`), but texture variant 2 (`0x6F887DFB cmp esi,7` → `0x6F8871A0 eax=2`, the selected-unit brightened palette) | direct | opaque + hover brighten |
| ≥8 | — | default branch, α=0xFF, so opaque | `ja` → no table → direct copy | treat as 5 (NORMAL) |

GDI blend-type array `0x6F87BB80` = {2,2,2,1,1,0,1,0}: 0–2 alpha, 3/4/6 256×256 lookup, 5/7 direct.
**Do not** use the names in `kb/items/d2client-ethereal-item-rendering.md` §2 for modes 3/4/6/7 ("multiplicative" for 3 is wrong; D3D proves 3 = additive and 4 = multiply).


## 5. Port implementation (single table, `src/common/gfx/draw-mode.ts`)

| eDrawMode | port blend | GPU (`src/client/render/renderer.ts`) |
|---:|---|---|
| 0 / 1 / 2 | `trans25` / `trans50` / `trans75` | premultiplied ONE/ONE_MINUS_SRC_ALPHA, quad α 0.25 / 0.50 / 0.75 |
| 3 | `additive` | premultiplied group, per-vertex additive flag (S + D) |
| 4 | `burn` (multiply) | `blendFunc(ZERO, SRC_COLOR)`, shader outputs `mix(1, rgb, a)` so transparent texels are neutral |
| 5, 6, 7, ≥8 | `normal` | opaque (7's hover-brightened texture is a UI state, not a table value) |

- `overlayTransToDrawMode` = identity; `missileTransToDrawMode` = {1→3, 2→4, else 5}. Both client
  (`overlayTransToBlendMode` / `transToBlendMode` in `unit-drawables.ts`) and bakers (`pack-overlays.ts` meta
  `blendMode`, `pack-missiles.ts` meta label) use these functions; there is no second mapping.
- Overlay `Trans` 3 ≡ missile `Trans` 1 (both eDrawMode 3 → `additive`).
- **No black colour-keying at bake time.** Every mode treats palette index 0 as the only transparent texel. Black under
  eDrawMode 3 adds nothing; under 5 (Missiles Trans 0, Overlay Trans 5/8) and 4 (multiply) it is drawn. So
  `packMissileSheetToRgbaPng` keeps every index ≠ 0 opaque, and atlases are independent of `Trans` (shared CelFiles
  with different `Trans` resolve correctly).
- Bake targets named after a real row take the row's `Trans` (`missileTargetTrans` throws on drift; `pack-overlays`
  reads overlay.bin `Trans`).

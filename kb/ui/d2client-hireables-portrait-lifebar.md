# D2Client.dll v1.13c Top-Left HUD Portraits & Life Bars (`Hireables.cpp`)

## 1. Key Functions (`D2Client.dll`, ImageBase `0x6FAB0000`)

- `0x6FB0AC70` — `HUD_DrawCenteredFont6Label(int nX, int nY, int nColor)` (`ecx = esi = wszText`)
  - Sets `Font6` (`D2WIN_SetFont(6)`), truncates text to fit `<= 0x42` (`66px`), centers horizontally around `nX + 0x16` (`nX + 22`), and draws at baseline `nY`.
- `0x6FB0AD00` — `HUD_InitPetLifeBarColors()`
  - Resolves palette indices via `D2WIN_GetPaletteIndex(r, g, b)` (`0x6FABD390`):
    - `0x6FBCC288`: RGB `(0, 128, 0)` (Green, `lifePct >= 50`)
    - `0x6FBCC289`: RGB `(192, 192, 0)` (Yellow, `25 <= lifePct < 50`)
    - `0x6FBCC28A`: RGB `(255, 0, 0)` (Red, `lifePct < 25`)
- `0x6FB0AD70` — `HUD_IsPointInHirelingPortrait(D2MouseMsg* pMsg)`
  - Hit-tests `mouseX in [gdwMercIconX, gdwMercIconX + 0x2E]` (`w = 46px`) and `mouseY in [0x18, 0x3C]` (`y = 24..60`).
- `0x6FB0B120` — `HUD_GetPetPortraitCel(int nPetTypeIdx, D2UnitStrc* pPlayer, int* pDrawHp, DWORD* pOutUnitId)`
  - Looks up `PetType.txt` row (`pDataTables->pPetTypesTxt + 0xE0 * nPetTypeIdx`) and returns the cached DC6 portrait (`data\global\ui\Hireables\*.dc6`).
- `0x6FB0B5A0` — `HUD_DrawPortraitLifeBar(int nPetTypeIdx, DWORD dwUnitId, int nX)`
  - Reads `nLifePct` (`0..100`) from the roster pet (`0x6FBCC4D4`) or party roster (`0x6FB4D630`).
  - Clamps `nLifePct` to `[0, 100]` and computes filled width:
    $$\text{fillW} = \left\lfloor \frac{\text{nLifePct} \times 46}{100} \right\rfloor \quad (\text{width } \mathtt{0x2E} = 46\text{px}, \text{ height } \mathtt{0x13 - 0x0E} = 5\text{px})$$
  - Draws two adjacent `D2GFX_DrawRectangle(..., dwTransTbl=5)` (`0x6FABD0BA`, ordinal `10014`) rectangles of height `5px` (`yStart = 0x0E = 14`, `yEnd = 0x13 = 19`):
    1. `[nX, nX + fillW]`: colored health fill (`Green` if `>= 50`, `Yellow` if `>= 25`, `Red` if `< 25`).
    2. `[nX + fillW, nX + 46]`: black (`color = 0`) depleted bar track.
- `0x6FB0B6C0` / `0x6FB0B760` / `0x6FB0B890` — Summoned pet portrait renderers (`icontype = 3`, `2`, `1`)
- `0x6FB0B930` — `HUD_DrawHirelingPortrait` (`PetType.txt` `idx = 7`)
  - Draws `46 × 5` life bar (`0x6FB0B5A0`), `46 × 41` portrait DC6 (`D2GFX_DrawCelContext` @ `0x6FABD096`, `nY = 0x3C = 60`), and advances `nX += 0x38` (`+56px` horizontal stride per slot).
- `0x6FB0BA90` — `HUD_DrawPartyPortraits`
  - Iterates allied party members (`partyId != 0xFFFF`, excluding self), draws `46 × 5` life bar + `46 × 41` class portrait DC6, and advances `nX += 0x38` (`+56px`).
- `0x6FB0C7F0` — `HUD_DrawPartyAndPetIcons`
  - Top-level dispatcher when left dock panels are closed; starts horizontal cursor at `nX = 0x0F` (`15`) and advances by `+56px` (`0x38`) per rendered portrait slot.

## 2. Web HUD Frame Alignment (`src/client/ui/hud-manager.ts`)

- Portrait DC6 frames in `data/global/ui/Hireables/*.dc6` (`portraits-atlas.png`) are `46 × 41` pixels (`0x2E × 0x29`), matching the `46px` (`0x2E`) life bar width and `5px` (`0x05`) life bar height in `0x6FB0B5A0`.
- Inside the `48 × 48` portrait frame (`slotX, 16, 48, 48`, with `1px` border at `x = slotX`, `x = slotX + 47`, `y = 16`, `y = 63`):
  - `y = 17..58` (`46 × 41`): DC6 portrait (`slotX + 1, 17, 46, 41`).
  - `y = 58..63` (`46 × 5`): Life bar slot (`slotX + 1, 58, 46, 5`), enclosed cleanly inside the bottom border of the frame (`y = 63`).
  - For `PetType.txt` rows with `drawhp = 0` (e.g., Raven `idx = 10`), the outer frame height is `43px` (`1 + 41 + 1`) so no empty `5px` dark slot remains at the bottom.

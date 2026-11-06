# D2Client.dll v1.13c Gold Box Display (`0x6FB3CFB0`) & Vendor Stash Gold Readout

## 1. Call Sites & Unified Gold Box Renderer (`D2Client.dll`, ImageBase `0x6FAB0000`)

`0x6FB3CFB0` (`HUD_DrawPanelGoldBox(int nMode)`) is the unified renderer for the three panel gold recesses:

| `nMode` | Panel | Call Site | Stat Read (`D2Common_GetUnitStat` @ `0x6FABC1C6`) | Gold Coin Button (`goldcoinbtn.dc6`) |
|---:|---|---|---|---|
| `0` | Private Stash (`TradeStash.dc6`) | `0x6FB49951` | `STAT_GOLDBANK` (`0x0F = 15`) (`0x6FB3D13C`) | Drawn + hover tooltip (`strIdx = 0x101C = 4124`, `strBankGoldWithdraw`) |
| `1` | Player Inventory (`invchar6.dc6`) | `0x6FB49DB3` | `STAT_GOLD` (`0x0E = 14`) (`0x6FB3D0E5`) | Drawn + hover tooltip (`strDropGoldHowMuch` / `strBankGoldDeposit`) |
| `2` | NPC Store / Gamble (`buysell.dc6`) | `0x6FB494C5` | `STAT_GOLDBANK` (`0x0F = 15`) (`0x6FB3D013`) | Omitted (`jmp 0x6FB3D2E4` at `0x6FB3D2A0`) |

### Vendor Panel Call Site (`0x6FB49471..0x6FB494CB`)
Whenever the active NPC interaction mode (`gdwVendorMenuMode` @ `0x6FBCBC34`) is in `1..9` (Trade, Repair, Gamble, etc.):
1. `0x6FB494C0`: `call 0x6FB45C60` — draws `buysell.dc6` (`320 × 432`), store grid items, 4 `buysellbtn.dc6` buttons, and `buyselltabs.dc6` tabs.
2. `0x6FB494C5`: `push 2; call 0x6FB3CFB0` — immediately renders the player's Stash Gold readout in `buysell.dc6`'s bottom-left recessed dark box.

## 2. Mode 2 (`buysell.dc6`) Exact Layout (`0x6FB3D00E..0x6FB3D0DA` & `0x6FB3D25D..0x6FB3D2A0`)

In `data\global\ui\Panel\buysell.dc6` (anchored at `ox = 80, oy = 60` in `800 × 600`), the bottom-left recessed dark box spans `relX = 17..200` (`184px` wide) and `relY = 359..375` (`17px` tall, dark fill palette index `176`, RGB `(20, 20, 20)`):

1. **Stash Gold Stat (`0x6FB3D00E..0x6FB3D016`)**:
   - Calls `D2Common_GetUnitStat(pPlayerUnit, 0x0F, 0)` (`STAT_GOLDBANK`, stat ID `15`) and formats with `"%d"` (`0x6FB8057C` at `0x6FB3D08B`).
2. **Right-Aligned Stash Gold Amount (`0x6FB3D0B5..0x6FB3D0DA` & `0x6FB3D25D..0x6FB3D266`)**:
   - Measures the formatted number width (`D2Win_10028_GetTextWidth` @ `0x6FABD35A`).
   - Computes `x = ox + 0xC6 - textWidth` (`ox + 198 - textWidth`, i.e., **right-aligned** to `relX = 198`, `2px` inside the right recess border `relX = 200`).
   - Draws in white (`nColor = 0`, `bFramed = 0`) via `D2Win_10150_DrawText` (`0x6FABD37E`).
3. **Left-Aligned `"Stash"` / `"儲藏箱"` Label (`0x6FB3D280..0x6FB3D2A0`)**:
   - Resolves `.tbl` string index `0xCF3` (`3315`, key `'stash'` -> ENG `"Stash"`, CHI `"儲藏箱"`) via `D2Lang_GetStringByReferenceIndex` (`0x6FABD1EC`).
   - Draws **left-aligned** at `x = ox + 0x15` (`ox + 21`, i.e., `relX = 21`, `4px` inside the left recess border `relX = 17`) in white (`nColor = 0`, `bFramed = 0`).
4. **No Gold Coin Button (`0x6FB3D2A0`)**:
   - Jumps directly to `0x6FB3D2E4` (`D2Win_10184_SetFont(prevFont)`), skipping `goldcoinbtn.dc6` rendering (`0x6FB3D2C4..0x6FB3D2DF`).

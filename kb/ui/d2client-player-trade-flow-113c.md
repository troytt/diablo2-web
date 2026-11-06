# D2Client.dll / D2Common.dll / D2Game.dll Player-to-Player Trade Flow (v1.13c)

## 1. Binary Evidence & Addresses

| Module | Function / Handler | Address (1.13c) | Purpose |
| :--- | :--- | :--- | :--- |
| `D2Client.dll` | `D2CLIENT_SendClickButton` | `0x6fb094c0` | Emits `C2S 0x4F` (`[0x4F, u16 buttonId, u16 complementLow, u16 complementHigh]`) |
| `D2Client.dll` | `D2CLIENT_TradeOkButtonClick` | `0x6fb09600` | Handles self Accept button (`buttonId = 0x04` or `0x07`), updates local `g_dwSelfAccepted` immediately |
| `D2Client.dll` | `D2CLIENT_CloseTradeAndPanels` | `0x6fb09740` | Closes trade session (`PANEL_TRADE` + `PANEL_INVENTORY`), clears gold dialog if `mode == 2`, clears partner trade items (`bInvPage == 1`) |
| `D2Client.dll` | `D2CLIENT_DrawTradePanel` | `0x6fb4a173..0x6fb4a6d8` | Renders `data\global\ui\panel\trade.dc6`, `goldcoinbtn.dc6`, `buysellbtn.dc6` (green tint `color=2` via `0x6fabd0e4` when accepted at `0x6fb4a26d`/`0x6fb4a34f`, red tint `color=1` when disabled at `0x6fb4a2df`), and hover tooltips (`#4130`, `#4131`, `#4046` at `0x6fb09bc0..0x6fb09d12`) |
| `D2Client.dll` | `D2CLIENT_CreatePendingTradeModals` | `0x6fb099e0` / `0x6fb09ac0` | Creates centered dialog `0x6fbc77f0` (`0x77 0x00`: `#4043` `strWaitingForOtherPlayer` + `#3400` Cancel) and `0x6fbc77e8` (`0x77 0x01`: `#4042` `"agree to trade"` + `#3401` OK + `#3400` Cancel) |
| `D2Client.dll` | `D2CLIENT_RecvPacket77_ButtonAction` | `0x6fb0a230` | Dispatches `S2C 0x77` actions `0x00..0x13` via jump table at `0x6fb0a594` |
| `D2Client.dll` | `D2CLIENT_RecvPacket78_TradeInit` | `0x6fb0a190` | Handles `S2C 0x78` (`[0x78, char[16] partnerName, u32 partnerUnitId]`), opens `PANEL_TRADE` (left) + `PANEL_INVENTORY` (right) |
| `D2Client.dll` | `D2CLIENT_RecvPacket79_GoldInTrade` | `0x6fb0a1f0` | Handles `S2C 0x79` (`[0x79, u8 ownerFlag, u32 goldAmount]`) |
| `D2Common.dll` | `ITEMS_EncodeItemBitstream_StorePage` | `0x6fd7c158` | Encodes 3-bit `storePage = bInvPage + 1` into `S2C 0x9C` / `0x9D` bitstream |
| `D2Common.dll` | `ITEMS_DecodeItemBitstream_StorePage` | `0x6fd7a6d0` | Decodes 3-bit `storePage` back to `bInvPage = storePage - 1` |
| `D2Game.dll` | `D2GAME_HandlePacket4F_ClickButton` | `0x6fc90750` | Server-side `0x4F` dispatcher (`0x02` Cancel, `0x03` Accept Request, `0x04` Check Accept, `0x07` Uncheck Accept, `0x08` Trade Gold) |
| `D2Game.dll` | `D2GAME_SyncTradeItemsAndGold` | `0x6fc91b00` | Clones items on `bInvPage == 2` (`storePage = 3`) to partner's `pInventory` on `bInvPage == 1` (`storePage = 2`) via `S2C 0x9C action=0x04` |
| `D2Game.dll` | `D2GAME_ExecuteTradeExchange` | `0x6fc927c0` | Verifies space/gold (`0x09`/`0x0A`/`0x02`) and transfers items + gold, then sends `S2C 0x77 0x0D` (`TradeDone`) |

## 2. Protocol & State Transitions

### 2.1 Trade Initiation & Centered Modal (`S2C 0x77` `0x00`/`0x01`, `C2S 0x4F` `0x02`/`0x03`)
1. Clicking a player in town sends `C2S 0x13` (`unitType = 0x00`, `unitId = targetPlayerId`).
2. `D2Game.dll` sends:
   - `S2C 0x77` `action = 0x00` (`RequestTrade`) to the **initiator**: opens the centered `260x110` waiting modal with text `#4043` (`strWaitingForOtherPlayer`: ENG `"asking other player to trade"`, CHI `"詢問另一位玩者的交易意願"`) and a single Cancel (`#3402`) button (`C2S 0x4F` `buttonId = 0x02`).
   - `S2C 0x77` `action = 0x01` (`TradeRequested`) to the **target**: opens the centered `260x110` request modal with text `"<partnerName> " + #4042` (ENG `"<partner> agree to trade"`, CHI `"<partner> 同意進行交易"`) and OK (`#3403` -> `C2S 0x4F` `buttonId = 0x03`) + Cancel (`#3402` -> `C2S 0x4F` `buttonId = 0x02`) buttons.
3. While only the centered modal (`0x00` or `0x01`) is active (`!trade.active`):
   - The left 320x432 trade dock is **not** open and must **not** shift the world camera or block clicks outside the `260x110` centered modal box.
   - Any pointer click inside the `260x110` modal box MUST be intercepted by the UI layer (`D2CLIENT_TradeModalMouseDown` at `0x6fb09d10`) so it never falls through to world ground movement (`C2S 0x01`/`0x03`).
4. When the target clicks OK (`C2S 0x4F` `buttonId = 0x03`), `D2Game.dll` sends `S2C 0x78` (`TradeInit`) to **both** players, transitioning both clients into `trade.active = true`, clearing the modal, and opening `PANEL_TRADE` (left) + `PANEL_INVENTORY` (right).

### 2.2 Item Container Page Encoding (`S2C 0x9C` / `0x9D` `storePage`)
In `D2Common.dll` (`0x6fd7c158` / `0x6fd7a6d0`), the 3-bit bitstream field `storePage` (`0..7`) maps directly to `bInvPage + 1`:
- `storePage = 1` (`bInvPage = 0`): Inventory (`10x4`)
- `storePage = 2` (`bInvPage = 1`): **Partner's Trade Offer Grid** (top `10x4` grid in Trade panel)
- `storePage = 3` (`bInvPage = 2`): **Self Trade Offer Grid** (bottom `10x4` grid in Trade panel)
- `storePage = 4` (`bInvPage = 3`): Horadric Cube
- `storePage = 5` (`bInvPage = 4`): Stash

When Player A places an item into their self trade box (`C2S 0x18`, `buffer = 2`), `D2Game.dll`:
- Sends `S2C 0x9C` (`action = 0x04` `PutInContainer`, `storePage = 3`) to Player A.
- Clones the item into Player B's `pInventory` on `bInvPage = 1` and sends `S2C 0x9C` (`action = 0x04` `PutInContainer`, `storePage = 2`, **no `ownerId` header**) to Player B.
- Therefore, the client container router MUST route `storePage === 2` (`bInvPage === 1`) into `tradePartner` and `storePage === 3` (`bInvPage === 2`) into `tradeSelf`.
- When Player A picks the item back up from their trade box (`C2S 0x1F` / `0x19`), `D2Game.dll` sends `S2C 0x9C` (`action = 0x05` `RemoveFromContainer`, `flags |= IFLAG_DELETED`) for the cloned item on `bInvPage = 1` (`tradePartner`) to Player B, deleting it from Player B's `tradePartner` grid without placing it on Player B's cursor.

### 2.3 Accept / Unaccept Checkboxes & Cooldown (`S2C 0x77` `0x04..0x08`)
- Clicking the self Accept checkbox in `D2CLIENT_TradeOkButtonClick` (`0x6fb09600`):
  - If `!selfAccepted` and `!acceptDisabled`: sets `selfAccepted = true` locally and sends `C2S 0x4F` `buttonId = 0x04` (`TradeOk`).
  - If `selfAccepted`: sets `selfAccepted = false` locally and sends `C2S 0x4F` `buttonId = 0x07` (`TradeUnaccept`).
- **Crucial Asymmetry (`0x6fb0a518` & `0x6fc90750`)**:
  - `D2Game.dll` does **not** echo `S2C 0x77 0x04` back to the player who clicked Accept (`0x77 0x04` in `D2Client.dll` is a single `ret` instruction at `0x6fb0a518`); it only sends `S2C 0x77 0x05` (`PartnerAccepted`) to the **other** player.
  - Therefore, the client's authoritative world trade state (`world.trade.selfAccepted`) must be updated immediately when emitting `C2S 0x4F` (`0x04` / `0x07` / `0x08`).
- Whenever either player adds/removes an item or changes offered gold:
  - `D2Game.dll` sends `S2C 0x77 0x06` (`DisableAccept`) while resetting checkmarks, and `S2C 0x77 0x08` (`RefreshAccept`) when the red cooldown expires.

### 2.4 Trade Completion / Cancel (`S2C 0x77` `0x02`, `0x09`, `0x0A`, `0x0C`, `0x0D`)
- `0x02` (`CancelTrade`), `0x09` (`NoRoomForItems`), `0x0A` (`PartnerNoRoom`), `0x0C` (`CloseTrade`), and `0x0D` (`TradeDone`) all invoke `D2CLIENT_CloseTradeAndPanels` (`0x6fb09740`):
  - Closes both `PANEL_TRADE` (left) and `PANEL_INVENTORY` (right).
  - Closes the Gold Input dialog if `mode == 2` (`TRADE_GOLD`).
  - Clears `tradePartner` items (`bInvPage == 1`).

## 3. Canonical `.tbl` String Indices (`string.tbl`)

| Index | Key | English (`ENG`) | Traditional Chinese (`CHI`) |
| :--- | :--- | :--- | :--- |
| `#3402` (`0x0D4A`) | `strCancel` | `"Cancel"` | `"取消"` |
| `#3403` (`0x0D4B`) | `strOK` | `"OK"` | `"好"` |
| `#4040` (`0x0FC8`) | `strNoRoomForItems` | `"You have no room for the items"` | `"你的空間不夠放這些物品"` |
| `#4041` (`0x0FC9`) | `strOtherPlayerNoRoom` | `"The other player has no room for the items"` | `"其它玩者的空間不夠放這些物品"` |
| `#4042` (`0x0FCA`) | `string#4042` | `"agree to trade"` | `"同意進行交易"` |
| `#4043` (`0x0FCB`) | `strWaitingForOtherPlayer` | `"asking other player to trade"` | `"詢問另一位玩者的交易意願"` |
| `#4044` (`0x0FCC`) | `strPlayerRefusedTrade` | `"Other player declined trade"` | `"其它玩者拒絕交易"` |
| `#4045` (`0x0FCD`) | `strPlayerGoldCheck0` | `"You don't have enough gold"` | `"你的金幣不足"` |
| `#4046` (`0x0FCE`) | `strTradeGoldHowMuch` | `"How much Gold would you like to offer?"` | `"你想要花多少錢來成交？"` |
| `#4125` (`0x101D`) | `string#4125` | `"Other player does not have enough gold."` | `"其它玩者的金幣不足。"` |
| `#4130` (`0x1022`) | `string#4130` | `"Cancel Trade"` | `"取消交易"` |
| `#4131` (`0x1023`) | `string#4131` | `"Accept Trade"` | `"接受交易"` |

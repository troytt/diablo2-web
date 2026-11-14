# D2Multi.dll & D2MCPClient.dll v1.13c Lobby Join Game Sub-Panel (`joingamebckg.dc6`, `MCP_GAMEINFO 0x06`, `0x6F9E3280`)

## 1. Binary & Asset Overview

- **`D2Multi.dll`** (ImageBase `0x6F9D0000`)
  - Join Game Panel Init (`0x6F9E48F0`): constructs all Join Game sub-panel widgets from the control descriptor table at `0x6F9EA510..0x6F9EAFF0` and initializes both scrollbars (`0x6F9E9C94` and `0x6F9E9CA0` from `data\global\ui\BIGMENU\joingamescrollbars.dc6`).
  - Game List Population (`0x6F9E4A00` / `0x6F9E4A8B..0x6F9E4AA5`): configures 2 columns on the left list TextBox (`D2Win_10132(hList, col=1, xOffset=0x87)` = `+135px`) for `Game Name` (`x=432`) and `Players` (`x=567`).
  - Game List Click & Double-Click (`0x6F9E4730`): populates the `gameName` editbox with the clicked row's name, requests `MCP_GAMEINFO (0x06)` (`D2MCPClient_10018`), and triggers immediate game join when `GetTickCount() - s_dwLastClickMs < 500` on the same row.
  - Game Name EditBox Change Handler (`0x6F9E1F60`): clears list selection and details when the player types manually in `gameName`, then updates `JOIN GAME` button enablement via `0x6F9E1870`.
  - `JOIN GAME` Button Enablement (`0x6F9E1870`): enables the `JOIN GAME` button (`0x6F9EA840`) iff `strlen(gameName) > 0` (`D2Win_10042` non-empty).
  - Game Details Formatter (`0x6F9E3280`): populates the right-hand Game Details TextBox (`0x6F9EA780`) from `MCP_GAMEINFO (0x06)`.
- **`D2MCPClient.dll`** (ImageBase `0x6FA20000`)
  - `MCP_GAMEINFO (0x06)` S2C Handler (`0x6FA26280`): decodes server game info into an internal `tGameInfo` struct and invokes the registered UI callback (`0x6F9E3280`).
- **MPQ Art Asset (`d2exp.mpq` / `d2data.mpq`)**
  - `data\global\ui\BIGMENU\joingamebckg.dc6`: 4 frames stitched in a $2 \times 2$ grid (`256×256`, `117×256`, `256×117`, `117×117` $\rightarrow$ `373×373` with `act1Pl2.rgb`), drawn at `(415, 74)` (`y_bottom = 447`).

---

## 2. Join Game Control Descriptor Table (`D2Multi.dll` `0x6F9EA510..0x6F9EA840`)

Each 48-byte (`0x30`) control record has layout:
`[type: u32, assetPtr: u32, x: i32, y_bottom: i32, w: i32, h: i32, fontOrParam1: u32, param2: u32, strId: u32, callback: u32, flags: u32, extra: u32]`
where `y_top = y_bottom - h` for text/editbox controls, and `y_top = y_bottom - frame0.height` for multi-piece `IMAGE` controls (`joingamebckg.dc6` frame 0 height `256` $\rightarrow$ `y_top = 330 - 256 = 74`).

| VA | Widget Type | `x` | `y_bottom` | `w` | `h` | `y_top` | Font / Asset | `strId` / Text | Role |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| `0x6F9EA510` | `1` (`IMAGE`) | `415` | `330` | `-1` | `-1` | `74` | `joingamebckg.dc6` | `0` | `373×373` Join Game background panel |
| `0x6F9EA540` | `4` (`TEXTBOX`) | `496` | `106` | `200` | `22` | `84` | `font24` (gold, centered at `596`) | `5151` (`"JOIN GAME"`) | Sub-panel title |
| `0x6F9EA570` | `4` (`TEXTBOX`) | `428` | `124` | `155` | `15` | `109` | `font16` (gold) | `5269` (`"Game Name"`) | Left input label |
| `0x6F9EA5A0` | `4` (`TEXTBOX`) | `602` | `124` | `155` | `15` | `109` | `font16` (gold) | `5271` (`"Password"`) | Right input label |
| `0x6F9EA5D0` | `4` (`TEXTBOX`) | `431` | `211` | `172` | `15` | `196` | `font16` (gold) | `5275` (`"Game Name Players"`) | Game list column header |
| `0x6F9EA600` | `2` (`EDITBOX`) | `432` | `144` | `155` | `20` | `124` | `fontformal12` (`maxLen=15`, gold box `(425, 123, 167, 25)`) | `0` | Side-by-side `Game Name` input |
| `0x6F9EA630` | `2` (`EDITBOX`) | `606` | `144` | `155` | `20` | `124` | `fontformal12` (`maxLen=15`, gold box `(599, 123, 168, 25)`) | `0` | Side-by-side `Password` input |
| `0x6F9EA660` | `4` (`TEXTBOX`) | `432` | `393` | `160` | `173` | `220` | `fontformal10` (`0x6F9E9C60` `fontId=4`, `col1=0`, `col2=+135`, scrollbar `0x6F9E9C94`) | `0` | Left scrollable Game List (`11` rows, `15px` step) |
| `0x6F9EA780` | `4` (`TEXTBOX`) | `609` | `393` | `143` | `194` | `199` | `fontformal10` (scrollbar `0x6F9E9CA0`) | `0` | Right scrollable Game Details (`14` rows, `13px` step) |
| `0x6F9EA810` | `6` (`BUTTON`) | `433` | `433` | `96` | `32` | `401` | `CancelButtonBlank.dc6` | `5103` (`"CANCEL"`) | Cancel button |
| `0x6F9EA840` | `6` (`BUTTON`) | `594` | `433` | `172` | `32` | `401` | `GameButtonBlank.dc6` | `5151` (`"JOIN GAME"`) | Join Game submit button |

---

## 3. `MCP_GAMEINFO (0x06)` Binary Wire Format (`D2MCPClient.dll` `0x6FA26280`)

In `D2MCPClient.dll` `0x6FA26280`, `%ecx` points to the MCP opcode byte (`0x06`) after the 2-byte packet length header is stripped. Thus byte offset `N` from `%ecx` corresponds to `payload + (N - 1)` after the 3-byte `[u16 size][u8 opcode=0x06]` header:

| Packet Offset | `%ecx` Offset | Field | Type | Description |
|---:|---:|---|---|---|
| `3..4` | `+0x01` | `requestId` | `u16` | Echoed request ID |
| `5..8` | `+0x03` | `status` | `u32` | Game status bitmask (`0x00100000` = Expansion / Lord of Destruction, `0x00000800` = Hardcore) |
| `9..12` | `+0x07` | `uptimeSec` | `u32` | Game elapsed time in seconds |
| `13` | `+0x0B` | `creatorLevel` | `u8` | Creator's character level (used with `levelDiff` for `[min..max]` range) |
| `14` | `+0x0C` | `levelDiff` | `u8` | Allowed character level difference (`0xFF` = unrestricted) |
| `15` | `+0x0D` | `maxPlayers` | `u8` | Maximum allowed players (`1..8`) |
| `16` | `+0x0E` | `playerCount` | `u8` | Number of characters currently in the game (`0..16`) |
| `17..32` | `+0x0F..+0x1E` | `classes[16]` | `u8[16]` | 0-based character class IDs (`0`=Amazon .. `6`=Assassin; `>6` formats `"Level %d"` without class name per `0x6F9E33ED`) |
| `33..48` | `+0x1F..+0x2E` | `levels[16]` | `u8[16]` | Character levels (`1..99`) |
| `49..` | `+0x2F..` | `description` | `cstring` | Null-terminated game description string (`<= 31` chars) |
| `..` | `..` | `players[0..playerCount-1]` | `cstring[]` | `playerCount` null-terminated character names (`<= 15` chars each) |

---

## 4. Right-Hand Game Details Formatting (`D2Multi.dll` `0x6F9E3280`, `.rdata` `0x6F9E7504..0x6F9E75D7`)

When `MCP_GAMEINFO (0x06)` succeeds (`info.status == 0`), `0x6F9E3280` clears `hDetailsBox` (`0x6F9EA780`) and appends lines in exact order:

1. **Non-empty `description`** (`0x6F9E32BF..0x6F9E32E9`):
   - Appends `description` (color `0` White) followed by a blank line `""` (`0x6F9E75D7`).
2. **Elapsed Time** (`0x6F9E32F0..0x6F9E3335`):
   - Computes `hours = uptimeSec / 3600`, `minutes = (uptimeSec % 3600) / 60`, `seconds = uptimeSec % 60`.
   - Formats `"Elapsed Time: %d:%02d:%02d"` (`0x6F9E75BC`, color `0` White).
3. **Level Restriction** (`0x6F9E3337..0x6F9E339E`):
   - When `info.levelDiff < 100` (`0x64`):
     - If `info.levelDiff == 0`: formats `"Level %d"` (`0x6F9E75A0`, `info.creatorLevel`, color `0` White).
     - If `1 <= info.levelDiff < 100`: formats `"Level %d to %d"` (`0x6F9E75AC`, `max(1, creatorLevel - levelDiff)` .. `min(99, creatorLevel + levelDiff)`, color `0` White).
4. **Max Players Cap** (`0x6F9E33A0..0x6F9E33CC`):
   - When `1 <= info.maxPlayers < 8`: formats `"Up to %d Players"` (`0x6F9E758C`, color `0` White).
5. **Separator Blank Line** (`0x6F9E33CE..0x6F9E33DC`):
   - Appends a blank line `""` (`0x6F9E75D7`).
6. **Current Players Roster** (`0x6F9E33E0..0x6F9E34B5`):
   - For each player `i` (`0 .. info.playerCount - 1`) with non-empty `name`:
     - Line 1: `name` (color `0` White).
     - Line 2: `"Level %d <ClassName>"` (`0x6F9E7504..0x6F9E757C`, color `5` DarkGray per `push 0x5; call 0x6F9D7C5C` @ `0x6F9E347F`) when `0 <= charClass <= 6` (jump table `0x6F9E34B4`: `0`=Amazon .. `6`=Assassin), or `"Level %d"` (`0x6F9E75A0`, no class name) when `charClass > 6` (`cmp eax, 6; ja 0x6F9E3463` @ `0x6F9E33ED`).

---

## 5. `MCP_GAMELIST (0x05)` Wire Format, Streaming & 15s Auto-Refresh (`D2Multi.dll` & `D2MCPClient.dll`)

### 5.1 C2S `MCP_GAMELIST (0x05)` Request (`D2Multi.dll` `0x6F9E4850` $\rightarrow$ `D2MCPClient.dll` `0x6FA27230`)

When the player enters the Join Game sub-panel (`0x6F9E48F0`) or the 15-second lobby refresh timer expires (`0x6F9DDF3B..0x6F9DDF7F`), `0x6F9E4850` increments `s_wGameListReqId` (`0x6F9E9C34`, skipping `0`), stores it in `0x6FA09F18`, resets `s_dwGameCount` (`0x6FA09DCC = 0`), checks the active character's Hardcore flag (`[pChar + 0x1EB] & 0x04`), and calls `D2MCPClient_10017` (`0x6FA27230`):

| Packet Offset | Payload Offset | Field | Type | Description |
|---:|---:|---|---|---|
| `0..1` | — | `size` | `u16` | Total packet byte length (`>= 10`) |
| `2` | — | `opcode` | `u8` | `0x05` (`MCP_GAMELIST`) |
| `3..4` | `+0x00` | `requestId` | `u16` | Monotonic non-zero request ID (`s_wGameListReqId`) |
| `5..8` | `+0x02` | `flags` | `u32` | `0x00000800` if active character is Hardcore (`charFlags & 0x04`), else `0x00000000` |
| `9..` | `+0x06..` | `searchMask` | `cstring` | Null-terminated search filter string (`""` by default) |

### 5.2 S2C `MCP_GAMELIST (0x05)` Response & End-of-List Sentinel (`D2MCPClient.dll` `0x6FA263E0`, `D2Multi.dll` `0x6F9DDC48`)

Each S2C `MCP_GAMELIST (0x05)` packet carries a single game summary entry or the end-of-list sentinel:

| Packet Offset | `%ecx` Offset | Field | Type | Description |
|---:|---:|---|---|---|
| `3..4` | `+0x01` | `requestId` | `u16` | Echoed request ID (`0x6FA09F18`) |
| `5..8` | `+0x03` | `index` | `u32` | Server-assigned game slot index (`u16` compared at `[edi+0x08]` in `0x6F9E2120`) |
| `9` | `+0x07` | `playerCount` | `u8` | Current number of players in the game (`0` for empty/closing or sentinel entries) |
| `10..13` | `+0x08` | `status` | `u32` | Game status bitmask (`0x00000004` = `GAME_STAT_OPEN`, `0xFFFFFFFE` = end-of-list, `0xFFFFFFFF` = server down) |
| `14..` | `+0x0C..` | `gameName` | `cstring` | Null-terminated game name (`<= 15` chars; empty `""` on `d2cs` end-of-list sentinel) |
| `..` | `..` | `description` | `cstring` | Null-terminated game description (`<= 31` chars) |

- **Premature-Termination Invariant (`#931`)**: `d2cs` iterates its internal game list and may emit recently-emptied open games (`gameName != ""` and `playerCount == 0`, `status & 0x04`) *before* active open games (`playerCount >= 1`), followed by a 17-byte end-of-list sentinel (`11 00 05 <reqId:u16> 00 00 00 00 00 00 00 00 00 00 00 00 00`, where `gameName == ""`). In `D2MCPClient.dll` `0x6FA263E0..0x6FA264C5` and `D2Multi.dll` `0x6F9DDC48..0x6F9DDCA5`:
  - End-of-list is reached **only** when `gameName.length === 0` (`parsedLen < payloadLen` sets `[0x6FA2B030] = 1` on the 17-byte `d2cs` sentinel) or `status === 0xFFFFFFFE` (`0x33`) / `0xFFFFFFFF` (`0x32`).
  - `D2Multi.dll` `0x6F9E2120` appends every non-sentinel open entry (`gameName != ""`) into `s_aGameList` (`0x6F9EBF20`) regardless of whether `playerCount == 0` or `playerCount >= 1`, and `0x6F9E205F` formats `playerCount` (`0`, `1`, ...) via `_itoa` into column 1 (`Players`). Only closed entries (`(status & 0x04) === 0` when `status !== 0`) are skipped without terminating the `MCP_GAMELIST` stream.
- **Deduplication (`0x6F9E2120`)**: Incoming games are deduplicated against existing entries in `s_aGameList` (`0x6F9EBF20`, stride `0x3B`) by game `index` (and case-insensitive `gameName`).
- **Selection Preservation (`0x6F9E1F80`, `0x6F9E209A..0x6F9E20F8`)**: When rebuilding the Join Game list box, if the previously selected game name still exists in the refreshed list, its selection highlight is preserved; if no game was selected and `gameName` is empty, the first entry is selected and `MCP_GAMEINFO (0x06)` is requested.
- **Periodic Auto-Refresh (`0x6F9DDF3B..0x6F9DDF7F`)**: While the Join Game sub-panel is active (`s_dwActiveSubPanel == 3`), the lobby loop checks `GetTickCount() - s_dwLastGameListRefreshMs >= 0x3A98` (**15,000 ms**) and automatically re-requests `MCP_GAMELIST (0x05)`.

---

## 6. `MCP_JOINGAME (0x04)` & `MCP_CREATEGAME (0x03)` Status Code `.tbl` String Mappings (`D2Multi.dll`)

### 6.1 `MCP_JOINGAME (0x04)` S2C Status Switch (`D2Multi.dll` `0x6F9DDD0E..0x6F9DDDFD`, Jump Table `0x6F9DE068`, Byte Table `0x6F9DE098`)

When `MCP_JOINGAME (0x04)` returns a non-zero `result` status (`0x6FA265A0`), `D2Multi.dll` maps the status code to a localized `.tbl` string ID and displays it in the lobby error status / popup (`0x6F9DC610`):

| Status Code | Hex | `.tbl` String ID | English (`d2data.mpq` / `d2exp.mpq`) | Traditional Chinese (`Chi/string.tbl` / `expansionstring.tbl`) |
|---:|---|---:|---|---|
| `0` | `0x00` | — | Success (connects to D2GS at `ip` with `gameToken` / `gameHash`) | 成功（連線至 D2GS） |
| `41` | `0x29` | `5160` (`0x1428`) | `"Game name and password don't match."` | `"遊戲名稱及密碼不符。"` |
| `42` | `0x2A` | `5159` (`0x1427`) | `"Game does not exist."` | `"遊戲並不存在。"` |
| `43` | `0x2B` | `5161` (`0x1429`) | `"Game is Full."` | `"遊戲人數已滿。"` |
| `44` | `0x2C` | `5162` (`0x142A`) | `"You do not meet the level restrictions for this game."` | `"你未達到這個遊戲的等級限制。"` |
| `113` | `0x71` | `5158` (`0x1426`) | `"Hardcore and Normal Characters may not be in the same game."` | `"專家級和一般級人物不能在同一個遊戲中。"` |
| `115` | `0x73` | `21794` (`0x5522`) / `5364` (`0x14F4`) | `"Unable to enter game. Your character must kill Baal to play in a Nightmare game."` | `"無法進入遊戲。你的人物必須殺死巴爾才能進入惡夢級的遊戲。"` |
| `116` | `0x74` | `21793` (`0x5521`) / `5363` (`0x14F3`) | `"Unable to enter game. Your character must kill Baal in Nightmare difficulty to play in a Hell game."` | `"無法進入遊戲。你的人物必須殺死惡夢級的巴爾才能進入地獄級的遊戲。"` |
| `120` | `0x78` | `10101` (`0x2775`) | `"Unable to enter game. A Diablo II character cannot join a game created by a Diablo II Expansion character."` | `"無法進入遊戲。暗黑破壞神 II 的人物無法加入由資料片人物所開創的遊戲。"` |
| `121` | `0x79` | `10102` (`0x2776`) | `"Unable to enter game. A Diablo II Expansion character cannot join a game created by a Diablo II character."` | `"無法進入遊戲。資料片的人物無法加入由暗黑破壞神 II 人物所開創的遊戲。"` |
| `125` | `0x7D` | `10929` (`0x2AB1`) / `10930` (`0x2AB2`) | `"Unable to enter game. A Non-Ladder character cannot join a game created by a Ladder character."` | `"無法進入遊戲。非天梯人物無法加入由天梯人物所開創的遊戲。"` |
| Default | `*` | `5141` (`0x1415`) | `"Join Failed"` | `"加入失敗"` |

### 6.2 `MCP_CREATEGAME (0x03)` S2C Status Switch (`D2Multi.dll` `0x6F9DDE2E..0x6F9DDEB3`, Jump Table `0x6F9DE118`, Byte Table `0x6F9DE12C`)

| Status Code | Hex | `.tbl` String ID | English (`d2data.mpq`) | Traditional Chinese (`Chi/string.tbl`) |
|---:|---|---:|---|---|
| `0` | `0x00` | — | Success (automatically sends `MCP_JOINGAME 0x04` at `0x6F9DDE6F`) | 成功（自動發送 `MCP_JOINGAME 0x04`） |
| `30`, `50` | `0x1E`, `0x32` | `5137` (`0x1411`) | `"Invalid Game Name"` | `"無效的遊戲名稱"` |
| `31` | `0x1F` | `5138` (`0x1412`) | `"A Game Already Exists With That Name"` | `"已經有相同名稱的遊戲存在"` |
| `32` | `0x20` | `5139` (`0x1413`) | `"Server Down"` | `"伺服器停機"` |
| Default | `*` | `5140` (`0x1414`) | `"Error Creating Game"` | `"開創遊戲錯誤"` |

---

## 7. `D2Launch.dll` (`0x6fa4a8c0..0x6fa4d5ce`) Character Selection Roster (`MCP_CHARLIST2 0x19`) & `D2Win.dll` (`0x6f8ebf60` / `0x6f8ec180`) Avatar Component Fallbacks

### 7.1 `D2Win.dll` `0x6f8ed880` (`D2Win_BuildComponentTable`), `0x6f8ebf60` (`D2Win_ValidateAndMapAvatarComponents`) & `0x6f8ec180` (`D2Win_ResolveAvatarWeaponClass`)

- **Component Table Construction (`D2Win.dll` `0x6f8ed880`)**: Builds the 255-entry runtime component table `0x6f9a8cb0[1..254]` (`1: 'lit'`, `2: 'med'`, `3: 'hvy'`, `4..56: Weapons.txt`, `57..97: Armor.txt`, plus non-body / fallback weapon slots at `117..129, 134, 235..254`).
- **Non-Throwing Component Validation & Fallbacks (`D2Win.dll` `0x6f8ebf60` & `D2Launch.dll` `0x6fa4c985..0x6fa4c9c9`)**:
  - `D2Win.dll` `0x6f8ebf60` NEVER aborts `MCP_CHARLIST2` on an unrecognized or mismatched statstring component byte:
    - `HD` (`ebx == 0`): if the code is not a valid `helm` (`0x25`) in `0x6f9a8cb0` or legacy `0x6f8ffee0`, `0x6f8ec16e` sets `HD = 1` (`'lit'`).
    - `TR`, `LG`, `RA`, `LA` (`ebx in 1..4`): if the code is not a valid armor tier, `0x6f8ec08c` sets it to `(rawCode % 3) + 1` (`'lit' | 'med' | 'hvy'`).
    - `RH`, `LH`, `SH`, `S3`: if the code does not match the slot's item type (`weap` `0x2d`, `shie` `0x02`, `head` `0x45`), `0x6f8ec014` clears the slot to `0` (`'nil'`).
  - `D2Win.dll` `0x6f8ec180` (`D2Win_ResolveAvatarWeaponClass`): resolves weapon class from `RH`/`LH`, falling back to `'hth'` when neither hand holds a valid weapon entry.
  - `D2Launch.dll` `0x6fa4c985..0x6fa4c9c9`: if `D2Win.#10131` returns `NULL`, `D2Launch.dll` zeroes `components[0..15]`, sets `TR = 1` (`'lit'`), sets `colors[0..15] = 0xff`, and retries `D2Win.#10131` with a default naked avatar.

### 7.2 `D2Launch.dll` `0x6fa4cb00..0x6fa4d59e` Multi-Row Character Roster (`> 8` Characters) & Scrollbar (`0x6fa65aa0`)

- **Unbounded Linked List (`0x6fa4cb60..0x6fa4cbd6`)**: Although `D2MCPClient.dll` (`0x6fa26cd0`) requests `u16 maxChars = 8` in `C2S 0x19` (`MCP_CHARLIST2`), PvPGN `d2cs` returns all characters on the account (`totalChars`, `returned` up to 9..18+). `D2Launch.dll` loops `min(returned, totalChars)` times, appending every character to the linked list at `0x6fa65ec8` (`count` at `0x6fa65ed0`).
- **2-Per-Row Scrollbar (`0x6fa65aa0` @ `0x6fa60f14` + `0x6fa62e70`)**:
  - Control record at `0x6fa60f14`: `type = 9` (`Scrollbar`), `x = 585`, `y_bottom = 457`, `w = 10`, `h = 363` (`y_top = 94..457`), callback `0x6fa4c250`.
  - At `0x6fa4d56b..0x6fa4d59e`, `D2Launch.dll` sets `maxSteps = max(0, ceil((count - 8) / 2))` via `D2Win.#10160` (`0x6f8e86e0`).
  - Each scrollbar step (`0x6fa4c250`) sets `0x6fa65ed4` (`charSelectScrollOffset`) to `step * 2` (`shl eax, 1`), scrolling the 2×4 slot grid by 2 characters (1 row) per step (`0x6fa4c274`).
  - `D2Win_Scrollbar_Draw` (`0x6f8eaf40`) returns early at `0x6f8eaf9a` when `maxSteps == 0` (`count <= 8`), and draws the scrollbar thumb at `x = 585` when `maxSteps > 0`.


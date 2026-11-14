# D2Net ping/pong, D2GS logon, D2MCPClient packet table and Storm sector compression (1.13c)

Ground truth: `samples/d2/D2Net.dll` (base `0x6FBF0000`), `samples/d2/D2Client.dll` (base `0x6FAB0000`),
`samples/d2/D2MCPClient.dll` (base `0x6FA20000`), `samples/d2/D2Multi.dll` (base `0x6F9D0000`),
`samples/d2/Fog.dll` (base `0x6FF50000`), `samples/d2/Storm.dll` (base `0x6FBF0000`), `samples/d2/D2Win.dll`
(base `0x6F8E0000`). Complements `network/d2gs-c2s-dispatch-and-sizes-113c.md` (size tables) and
`ui/d2multi-join-game-panel-113c.md` (lobby UI).

## 1. D2Net S->C splitter `0x6FBF6D60` (re-verified)

- Size from `D2NET_10033` (`0x6FBF6750`); `size > 0x204` is fatal (`0x6FBF6DAA`), `size > buffered` waits.
- `0xAF` with `@1 != 0` switches the stream to compressed mode; `@1 == 0x81` unpacks 128 nibble pairs
  (`(b & 0xF) + 1`, `(b >> 4) + 1`) and calls Fog `#10219`, which copies the lengths into the static table
  `0x6FF7F210` used by the decompressor.
- **`0x8F` (pong): D2Net overwrites dword `@0x0D` of the queued packet with `GetTickCount()`**
  (`0x6FBF6E4F..0x6FBF6E59`, import `0x6FBF8184`).
- Opcodes `>= 0xAF` go to the system queue `0x6FBFB3F4`, the rest to `0x6FBFB3FC`.
- Compressed receive loop `0x6FBF7290`: needs `>= 2` buffered bytes before reading any block header
  (`0x6FBF7394`), header `b0 < 0xF0 ? b0 : ((b0 & 0xF) << 8) | b1` = total block size incl. header; the
  decompressed bytes are appended to a `0x7B8`-byte packet buffer, so packets may span blocks. A Fog `#10224`
  failure (returns 0) drops the block silently.
- Fog `#10224` (`0x6FF6EDA0`) returns 0 when the output budget is exhausted and stops when
  `emptyBits + len > 32`; bit lengths always come from `0x6FF7F210`.

## 2. Ping / pong (D2Client)

- Ping scheduler `0x6FAF33E0` / `0x6FAF4C00`: when `GetTickCount() > next` (`0x6FBC97FC`) the builder
  `0x6FAC4B00` runs and `next = now + 5000`; the builder itself also gates on `now - last >= 5000`
  (`0x6FBCC4F4`).
- C->S `0x6D` (13 bytes, `0x6FAC4BCE..0x6FAC4BF4`): `@1 = GetTickCount()`, **`@5 = averagePing >> 1`**
  (`0x6FBC9830`), `@9 = hash * 0xB640DE41` (an integrity word derived from pong dwords `@0x15/@0x19/@0x1D`;
  0 when `(@0x15 * 0x470E31C1) & 0xFF == 0`).
- S->C `0x8F` handler `0x6FB5BF40 -> 0x6FAF22E0`: copies the eight dwords `@1..@0x1D` to `0x6FBC9834..`,
  `ping = GetTickCount() - lastPingSent` (`0x6FBC9800` -> `0x6FBC9804`), and keeps a running mean over the
  first 10 samples: `avg = (avg * n + ping) / (n + 1)`, `n` stops at 10 (`0x6FBC982C`/`0x6FBC9830`).

## 3. C->S `0x68` GameLogon builder `0x6FAC4A50` (37 bytes)

| Off | Value |
|---|---|
| `@1` | u32 game hash |
| `@5` | u16 game token |
| `@7` | u8 class (`0x6FB92650` if flag `0x100` of `0x6FB9264C`, else `0x6FBC991C`) |
| `@8` | u32 version (`[vtbl+0x5C]`) |
| `@0xC` | **`0xED5DCC50` for expansion, `0x2185EDD6` for classic** (`neg/sbb/and 0xCBD7DE7A/add 0x2185EDD6`) |
| `@0x10` | **`0x91A519B6`** |
| `@0x14` | u8 locale (`0x6FABD1E6`) |
| `@0x15` | char name, 16 bytes |

## 4. D2MCPClient S->C dispatch

Dispatcher `0x6FA25EB0` / `0x6FA269A0`: opcode `>= 0x1A` ignored, handler `[op*4 + 0x6FA2A900]`
(pre-startup table `0x6FA2A968`, slot 1 = startup handler `0x6FA265B0`). Error codes go to `0x6FA2B1C8`.

| Op | Handler | Layout (offsets from opcode byte) |
|---|---|---|
| `0x01` | `0x6FA265B0` | u32 status `@1` |
| `0x02` CHARCREATE | `0x6FA26590` | u32 status `@1` |
| `0x03` CREATEGAME | `0x6FA26540` | u16 req `@1` (must match), u32 token `@3`, u32 status `@7` |
| `0x04` JOINGAME | `0x6FA264D0` | u16 req `@1`, u32 token `@3`, u32 IP `@7`, u32 hash `@0xB`, u32 status `@0xF`; success iff IP != 0, else error = status or `0x28` when status is 0 |
| `0x05` GAMELIST | `0x6FA263E0` | u16 req, u32 index `@3`, u8 players `@7`, u32 status `@8` (`-2` -> `0x33`, `-1` -> `0x32`), name `@0xC`, description |
| `0x06` GAMEINFO | `0x6FA26280` | see `ui/d2multi-join-game-panel-113c.md`; status `-1` -> `0x32`, `-2` -> `0x33`; classes are copied as u16 |
| `0x07` CHARLOGON | `0x6FA26570` | u32 status `@1` |
| `0x0A` CHARDELETE | `0x6FA26250` | **u16 req `@1` (must match the request), u32 status `@3`** |
| `0x0B`/`0x0C`/`0x0D`/`0x0F` | `0x6FA26210`/`0x6FA261F0`/`0x6FA26180`/`0x6FA26160` | u32 status `@1` |
| `0x11` LADDERDATA | `0x6FA25F10` | u8 type, u16 total, u16 offset, u16 chunk, data `@8` |
| `0x12` MOTD | `0x6FA25EE0` | u8 `@1`, then one buffer `@2` of `len - 2` bytes passed to the callback |
| `0x14` | `0x6FA260D0` | u32 `@1` -> `0x6FA2B1BC` (create-game queue position) |
| `0x17`/`0x19` | `0x6FA260C0`/`0x6FA260B0` -> `0x6FA265D0` | four u16 header words `@1/@3/@5/@7` (each asserted `< 0x100`); `0x19` entries = u32 expiry, name, statstring |
| `0x18` CHARUPGRADE | `0x6FA26230` | u32 status `@1` |

C->S builders (all set the current request id `0x6FA2AEB4` where applicable): startup `0x6FA27510`
(cookie, status, 8 bytes, skips IP/port, 48 bytes, unique name), char create `0x6FA274B7` (u32 class, u16 flags,
name), create game `0x6FA27330` (u16 req, u32 flags, u8, u8, u8, name, password, description), join `0x6FA27290`
(u16 req, name, password), game list `0x6FA27230` (u16 req, u32 flags, filter), game info `0x6FA271FB`,
char delete `0x6FA26E60` (**u16 req**, name), char logon `0x6FA27410` (name).

## 5. D2Multi roster class names (`0x6F9E33ED`)

`movzx eax, word [class]; cmp eax, 6; ja -> "Level %d"`; jump table `0x6F9E34B4`: `0` Amazon, `1` Sorceress,
`2` Necromancer, `3` Paladin, `4` Barbarian, `5` Druid, `6` Assassin. **The class bytes are 0-based**; values
above 6 print the level only.

## 6. Storm sector decompression

Storm 1.13c has two 4-entry `{mask, fn}` tables (`0x6FC367F4` and `0x6FC36814`) with masks
`0x40, 0x80, 0x01, 0x08` only (ADPCM mono, ADPCM stereo, Huffman, PKWARE implode). The decompressor
(`0x6FC12784`) rejects any other mask bit (returns 0, so zlib `0x02` / bzip2 `0x10` are unsupported) and walks
the table backwards from `0x6FC3682C`: **PKWARE -> Huffman -> ADPCM stereo -> ADPCM mono**. A zero mask
copies the payload after the mask byte.

## 7. Archive priorities (D2Win `0x6F8EA9A6..0x6F8EAB04`)

`d2data`, `d2sfx`, `d2speech`, `d2delta`, `d2kfixup`, `d2char`, `d2music`, `d2video`: priority `1000`;
`d2exp.mpq`: `3000`; `patch_d2.mpq`: `5000` (higher wins).

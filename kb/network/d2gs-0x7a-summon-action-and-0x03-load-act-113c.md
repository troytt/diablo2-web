# D2GS S→C `0x7A SummonAction` (13B) & `0x03 LoadAct` (12B) Wire Parity (1.13c)

Ground truth:
- `samples/d2/D2Net.dll` (SHA-1 `4b2579f301bedc03d2510c911949584d372f59ce`, ImageBase `0x6FBF0000`)
- `samples/d2/D2Client.dll` (SHA-1 `26c2b536744ec8bba05dc43150b179313404d5ee`, ImageBase `0x6FAB0000`)
- `samples/d2/D2Game.dll` (SHA-1 `b452c203…`, ImageBase `0x6FC20000`)
- `samples/d2/Fog.dll` (SHA-1 `fc9e40e6b81e8c65703afdaaae010aace85d0969`, ImageBase `0x6FF50000`)
- `data\global\excel\Levels.txt` (`1..136` playable area IDs across Acts `0..4`)

## 1. S→C `0x7A SummonAction` — Fixed 13 Bytes (No Count Field)

### Size Table Entries
- `D2Net.dll` S→C packet size table (`0x6FBFA900 + 0x7A * 4`, file offset `0x00AAE8`): **`13`** (`0x0000000D`).
- `D2Client.dll` S→C handler table (`0x6FB8DE60 + 0x7A * 12`, file offset `0x0DE418`):
  - `handlerVa = 0x6FB5C720`
  - `expectedSize = 13` (`0x0000000D`)
  - `unitHandlerVa = 0x00000000`

### Wire Layout (13 Bytes)

| Offset | Type | Field | Notes |
|---|---|---|---|
| `+0` | `u8` | `opcode` | `0x7A` |
| `+1` | `u8` | `action` | `0` = remove/unsummon, non-zero (`1`) = add/summon |
| `+2` | `u8` | `petType` | `PetType.txt` row index (`7` = hireling) |
| `+3` | `u16LE` | `classId` | `MonStats.txt` `hcIdx` |
| `+5` | `u32LE` | `ownerId` | Owner player `dwUnitId` |
| `+9` | `u32LE` | `petUnitId` | Summoned pet / mercenary `dwUnitId` |

### Server Builders (`D2Game.dll`)
Both S→C `0x7A` senders allocate and zero a 13-byte stack buffer (`0x00..0x0C`) and pass `push 0x0D` (`13`) to `D2GAME_SendPacketToClient` (`0x6FCAA3E0`):
- `0x6FCAB290..0x6FCAB2DA`: zeroes `[esp+0..0xC]`, writes `0x7A`, `action`, `petType`, `u16 classId`, `u32 ownerId`, `u32 petUnitId`, calls `push 0x0D` (`0x6FCAB2B2`) → `0x6FCAA3E0`.
- `0x6FCB6810..0x6FCB686E` (unsummon/cleanup): zeroes `[esp+0..0xC]`, writes `action = 0` (`+1`), `petType` (`+2`), `u16 classId` (`+3`), `u32 ownerId` (`+5`), `u32 petUnitId` (`+9`), calls `push 0x0D` (`0x6FCB685E`) → `0x6FCAA3E0`.

### Client Handler (`D2Client.dll` `0x6FB5C720`)
- Reads `al = [ecx+1]` (`action`), `edx = [ecx+9]` (`petUnitId`).
- If `action == 0` (`je 0x6FB5C743`): tail-jumps to `0x6FAD1840`, removing `petUnitId` from the singly linked list `g_pPetList` (`[0x6FBCC4D4]`, `next` pointer at `+0x30`).
- If `action != 0`: reads `u16 classId` (`[ecx+3]`), `u8 petType` (`[ecx+2]`), `u32 ownerId` (`[ecx+5]`), and calls `0x6FAD18C0`, which allocates a 52-byte (`0x34`, `13` dwords) pet node and links it into `g_pPetList` (`[0x6FBCC4D4]`) if `petUnitId` is not already present.
- Portrait summon counts in 1.13c are derived on the client by counting matching `(ownerId, petType)` nodes in `g_pPetList` — 1.13c never sends a `u32 count` field in `0x7A`.

## 2. S→C `0x03 LoadAct` — Fixed 12 Bytes & Valid Bounds

### Size & Handler (`D2Client.dll` `0x6FB5DB50` → `0x6FAF3F90`)
- `D2Net.dll` (`0x6FBFA900 + 0x03 * 4`): **`12`**.
- `D2Client.dll` `0x6FB5DB50`:
  - `bl = [ecx+1]` (`u8 act`: `0..4`, i.e. Act I..V)
  - `edx = [ecx+2]` (`u32LE mapSeed`)
  - `edi = [ecx+6]` (`u16LE areaId`: `1..136` in 1.13c `Levels.txt`)
  - `eax = [ecx+8]` (`u32LE objectSeed`)
  - Calls `0x6FAF3F90`, which invokes `D2Common` `ACT_LoadAct` (`0x6FAF3FCF`), stores `areaId` into `[0x6FBCC3C0]` (`0x6FAF4054`), indexes the 5-entry act table `[esi*4 + 0x6FBA9EB4]` (`0x6FAF405F` — out-of-bounds `act >= 5` dereferences invalid memory / asserts), and sets `[0x6FBC981C] = max(old, now + 10000)` (`0x6FAF40A4`).

## 3. Stream Desynchronization Forensics (Issue #2022)

When `S2C_PACKET_SIZES[0x7A]` was erroneously set to `17` instead of `13`, every 13-byte `0x7A` packet from a 1.13c D2GS server caused `D2gsS2cFramer` to consume 4 bytes from the immediately following packet in the decompressed Huffman byte stream.

For example, when `0x7A` (13B) was followed by a 5-byte packet ending in `0x03` (e.g. `0x1C` Experience `[0x1C, b0, b1, b2, 0x03]`) and a 7-byte `0xA9 EndState` packet `[0xA9, 0x01, 0x01, 0x00, 0x00, 0x00, 0x02]` (`unitType=1`, `unitId=1`, `state=2`), the 4 swallowed bytes left `0x03` at the stream head:
- `pkt[0] = 0x03` → misframed as `0x03 LoadAct` (12B)
- `pkt[1] = 0xA9` → `act = 169`
- `pkt[2..5] = 01 01 00 00` → `mapSeed = 0x00000101`
- `pkt[6..7] = 00 02` → `areaId = 0x0200 = 512`

Because D2GS S→C uses stateful Huffman block decompression with no per-packet sync markers, any framing error or impossible `0x03 LoadAct` header (`act > 4` or `areaId` outside `1..136`) proves the byte stream is desynchronized and must fail-closed cleanly with recent raw S→C packet diagnostics rather than silently ignoring individual packets.

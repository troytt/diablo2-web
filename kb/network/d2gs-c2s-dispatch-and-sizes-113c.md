# D2GS C→S dispatch, size validation and S→C/C→S variable-length resolvers (1.13c)

Ground truth: `samples/d2/D2Net.dll` (SHA-1 `4b2579f3…`, base `0x6FBF0000`),
`samples/d2/D2Game.dll` (SHA-1 `b452c203…`, base `0x6FC20000`),
`samples/d2/D2Client.dll` (SHA-1 `26c2b536…`, base `0x6FAB0000`).

## 1. D2Net size tables (re-verified)

| Table | VA | Entries | Notes |
|---|---|---|---|
| S→C sizes | `0x6FBFA900` | 181 (`0x00..0xB4`) | `>0` fixed, `-1` variable, `0` invalid |
| C→S sizes | `0x6FBFABD8` | 113 (`0x00..0x70`) | same encoding |

Both tables match `src/netproto/d2gs/tables/s2c-sizes.ts` byte for byte.
D2Client's own handler table (`0x6FB8DE60`, 12-byte rows `{handler, size, unitHandler}`) differs from
D2Net only at `0x17` (client `-1`, D2Net `0` → never framed), `0x80` (client `4`, D2Net `0`) and `0xAF`.

## 2. S→C variable-length resolver `D2NET_10033` (`0x6FBF6750`)

Index byte table `0x6FBF6970` (opcode − `0x16`), jump table `0x6FBF6934`.
Each case first demands a minimum number of buffered bytes, then computes the size:

| Op | Case VA | Min bytes | Size |
|---|---|---|---|
| `0x16` | `0x6FBF67A4` | 13 | `u16 @1` |
| `0x26` | `0x6FBF67B8` | 10 (+`len1+11`) | `10 + strlen(@10)+1 + strlen(next)+1` |
| `0x3E` | `0x6FBF6834` | 2 | `u8 @1` |
| `0x5B` | `0x6FBF67F4` | 34 | `u16 @1` |
| `0x94` | `0x6FBF6808` | 9 | `(u8 @1 + 2) * 3` |
| `0x9C`/`0x9D` | `0x6FBF6820`/`0x6FBF6848` | 3 | `u8 @2` |
| `0xA6` | `0x6FBF685A` | 4 | `u16 @2` |
| `0xA8`/`0xAA` | `0x6FBF686E`/`0x6FBF6886` | 7 | `u8 @6` |
| `0xAC` | `0x6FBF689C` | 13 | `u8 @12` |
| `0xAE` | `0x6FBF68B4` | 3 | `(u16 @1 ≤ 0x1FD ? u16 @1 : 0) + 3` |
| `0xAF` | `0x6FBF68DB` | 2 | `u8 @1 == 0 ? 2 : u8 @1 + 1` |
| `0xB3` | `0x6FBF6907` | 8 | `u8 @1 + 7` |

## 3. C→S variable-length resolver `D2NET_10006` (`0x6FBF65D0`)

`0xFF` → always 16. Opcodes `≥ 0x71` → 0. Index table `0x6FBF66F0` (opcode − `0x14`), jump table `0x6FBF66E0`:

| Op | Case VA | Size |
|---|---|---|
| `0x14`, `0x15` | `0x6FBF663A` | `3 + (strlen(@3)+1) + (strlen(s2)+1) + 1 + (int8)b`, where `b` is the byte right after the second string's NUL |
| `0x66` | `0x6FBF6688` | `(u16 @1 ≤ 0x1FD ? u16 @1 : 0) + 3` |
| `0x6C` | `0x6FBF66AB` | needs ≥ 6 bytes; `u8 @1 + 7` |

`0x39` is a plain fixed entry: **5 bytes**.

## 4. D2Game C→S dispatch (`0x6FCEC550` & `0x6FD1A078`)

### 4.1 PE32 Ground Truth & Table Layout (`0x6FD1A078..0x6FD1A3B0`)

- **`samples/d2/D2Game.dll`** (v1.13c, `1,138,688` bytes):
  - `SHA-1`: `b452c203b00f48bbb95cb5cda6419e4f2466cdea`
  - `SHA-256`: `24b293b86f95bea0228826c502ea4737ba21b91ca9832e52aac4b11fef14f53`
  - `TimeDateStamp`: `0x4B95C6B2`, `ImageBase`: `0x6FC20000`, `SizeOfImage`: `0x122000`
  - `.text` `0x6FC21000..0x6FD18000` (`RVA == FileOffset`), `.rdata` `0x6FD18000..0x6FD1F000` (`RVA == FileOffset`), `.data` `0x6FD1F000..0x6FD3B35C`, `.reloc` `0x6FD3C000..0x6FD42000`.
- **Table `0x6FD1A078`** (`.rdata`, file offset `0x0FA078..0x0FA3AF`):
  - **`103` (`0x67`) entries (`0x00..0x66`) × `8` bytes = `824` (`0x338`) bytes**:
    - `+0x00`: `handlerVa: uint32` (`0x00000000` for the 12 NULL slots; `.text` VA in `0x6FCEB190..0x6FCF14B0` for the 91 non-null handlers).
    - `+0x04`: `flag: uint32` — strictly `0` (`49` entries) or `1` (`54` entries).
  - **`.reloc` proof**: scanning `IMAGE_REL_BASED_HIGHLOW` across `0x6FD1A078..0x6FD1A3AF` finds exactly **`91`** relocations, all at `(va - 0x6FD1A078) % 8 == 0` (exact 1:1 match with the 91 non-null `handlerVa` slots) and **`0`** relocations at `+0x04` (proving `+0x04` is an integer, never a second function pointer).
  - **Adjacent `.rdata` bounds proof**:
    - Immediately preceding `0x6FD1A078`: EXP level-diff tables `0x6FD1A01C..0x6FD1A073` (referenced at `0x6FCFAA50`, `0x6FCFAA6E`) followed by 4-byte zero alignment padding `0x6FD1A074..0x6FD1A077`.
    - Immediately following `0x6FD1A3B0` (`0x6FD1A078 + 103 * 8`): unrelated 10-entry × 4-byte function pointer table `0x6FD1A3B0..0x6FD1A3D7` (indexed via `[ebx*4 + 0x6FD1A3B0]` at `0x6FD10AC6`, `0x6FD10AF7`), then `PLAYER_StartModeAtCoords` table at `0x6FD1A3F8`.
  - There is **no** C→S packet-size table in `D2Game.dll`; framing sizes live exclusively in `D2Net.dll:0x6FBFABD8` (Section 1).
- **Proof that `+0x04` (`flag`) is unreferenced in `D2Game.dll` 1.13c**:
  - Exhaustive scan of `.text`/`.rdata`/`.data` for any reference in `[0x6FD1A000, 0x6FD1A3B8]` yields only **3** instructions, all inside `0x6FCEC550` and all reading `+0x00`: `0x6FCEC56B` (`mov eax, [edi*8+0x6FD1A078]`), `0x6FCEC623` (`mov eax, [edi*8+0x6FD1A078]`), and `0x6FCEC65E` (`call [edi*8+0x6FD1A078]`).
  - Zero instructions in `D2Game.dll` reference `0x6FD1A07C` or load `+0x04`, and `0x6FD1A078` is not exported (verified across all 61 exports `D2Game#10000..#10060`).
  - Cross-checking `flag` against `0x6FCEC550`'s jump table confirms independence: `0x01..0x11` have `flag=0` yet are alive-gated; `0x43` has `flag=1` yet bypasses the gate (`case 0`); `0x41` has `flag=1` yet requires dead mode `0x11` (`case 2`); 8 NULL slots (`0x4A, 0x4E, 0x55..0x57, 0x5A..0x5C`) have `handlerVa=0` with `flag=1`.

### 4.2 End-to-End Call Chain & Packet-Size Validation Boundary (`D2Net.dll` → `D2Game.dll`)

1. **`D2Net.dll:0x6FBF6300`** (C→S wire framing): calls `D2Net#10006` (`0x6FBF65D0`), indexing `D2Net.dll:0x6FBFABD8[opcode]` (113 × `int32` for `0x00..0x70`; `0xFF` = 16; `-1` variable resolved for `0x14`/`0x15`/`0x66`/`0x6C`; `0` invalid). Rejects `pktLen > 0x204` (`516`) or `pktLen > nAvail`. Routes `0x00..0x66` to **Queue 1**, `0x67..0x70` to **Queue 0**, and `0xFF` to **Queue 2**.
2. **`D2Game.dll:0x6FC4E460` (`D2Game#10040`, `GAME_ProcessNetworkMessages`)**:
   - Drains Queue 0 (`D2Net#10035`) → `0x6FCEAF30` (`0x67..0x70`, game logon/ping/save handled outside `0x6FD1A078`).
   - Drains Queue 1 (`D2Net#10016`) → `0x6FCEAE80(eax=buf, push nSize)` where `buf[0..3] = dwClientId`, `buf[4..] = pPacket`, and `nSize` is the C→S payload length excluding `dwClientId`.
   - Drains Queue 2 (`D2Net#10014`) → `0x6FC49CB0` (`0xFF` disconnect).
3. **`D2Game.dll:0x6FCEAE80` (sole caller of `0x6FCEC550` in `D2Game.dll`)**:
   - Locks `pGame = GAME_GetGameById(D2Net#10015(dwClientId))`, resolves `pClient = CLIENTS_GetClientById(0x6FC69FE0)`, stamps `pClient->dwLastPacketTick (+0x3D8) = GetTickCount()`, resolves `pPlayer = CLIENTS_GetPlayerFromClient(pClient, 0)` (`0x6FC6AD10`), checks `pPlayer != NULL && pPlayer->dwUnitType == 0`, invokes **`0x6FCEC550` at `0x6FCEAF15`**, and unlocks `pGame` (`0x6FC49BA0`) while discarding `0x6FCEC550`'s return value.

### 4.3 `D2Game.dll:0x6FCEC550` Disassembly, 4-Case Jump Table & Return-Code Contract

- **Calling convention (`__usercall`, 298 bytes `0x6FCEC550..0x6FCEC679`, `ret 8`)**:
  - `ebx = const uint8_t* pPacket`, `esi = D2UnitStrc* pPlayer`, `[esp+0x04] = D2GameStrc* pGame`, `[esp+0x08] = int32_t nSize`.
- **Control flow**:
  1. `0x6FCEC550..0x6FCEC566`: reads `op = pPacket[0]`; if `op == 0 || op >= 0x67`, jumps to `0x6FCEC671` and returns **`3`**.
  2. `0x6FCEC568..0x6FCEC57D`: loads `pfn = [op*8 + 0x6FD1A078]`; if `pfn == 0` (12 NULL slots), returns **`3`**.
  3. `0x6FCEC580..0x6FCEC60E`: switches on `op - 0x14` (`cmp eax, 0x52; ja 0x6FCEC5DD`) via the **83-byte index table `0x6FCEC68C..0x6FCEC6DE`** (`op = 0x14..0x66`) into the **4-entry jump table `0x6FCEC67C..0x6FCEC68B`**:
     - **`case 0` → `0x6FCEC60F` (unrestricted bypass — 5 opcodes)**: `0x14, 0x15, 0x3C, 0x43, 0x66`. Skips the alive/`STATE_UNINTERRUPTABLE` check completely.
     - **`case 1` → `0x6FCEC5A4` (alive & `!STATE_UNINTERRUPTABLE` — 2 opcodes)**: `0x20, 0x26`. Identical runtime predicate to `case 3`: calls `D2Common.#10494` (`STATES_CheckState(pPlayer, 0x36)`); if non-zero, or `pPlayer == NULL`, or `pPlayer->dwAnimMode (+0x10)` is `0` (`PLRMODE_DEATH`) or `0x11` (`PLRMODE_DEAD`), jumps to `0x6FCEC66A` and returns **`0`**.
     - **`case 2` → `0x6FCEC596` (dead only — 1 opcode)**: `0x41` (Resurrect). Requires `pPlayer != NULL && pPlayer->dwAnimMode (+0x10) == 0x11` (`PLRMODE_DEAD`); otherwise jumps to `0x6FCEC66A` and returns **`0`**.
     - **`case 3` / default → `0x6FCEC5DD` (alive & `!STATE_UNINTERRUPTABLE` — `0x01..0x13` + 75 opcodes in `0x14..0x66`)**: exact same check as `case 1`; returns **`0`** if blocked.
  4. `0x6FCEC60F..0x6FCEC622`: if `*(uint32_t*)(pGame + 0x1DC4) > 1`, calls `Fog.#10055` (`FOG_GetCurrentTime`, Unix epoch seconds) via `0x6FC2A2F2` and stores it back to `[pGame + 0x1DC4]` (idle-game watchdog; omitted in deterministic replay).
  5. `0x6FCEC623..0x6FCEC653`: calls `KERNEL32!IsBadCodePtr(pfn)` (`0x6FD18D14`); if non-zero, asserts via `Fog.#10265(0x18FB)` + `Fog.#10024` and calls `exit(-1)`.
  6. `0x6FCEC654..0x6FCEC667`: invokes `pfn(ecx=pGame, edx=pPlayer, push pPacket, push nSize)` (`__fastcall`, `ret 8`) and returns its `eax` verbatim.
- **Return-code contract**:
  - `0`: accepted/handled by handler, OR silently dropped by the `0x6FCEC67C` dead/`STATE_UNINTERRUPTABLE`/`0x41`-not-dead gate (`0x6FCEC66A`), OR always-noop stub (`0x2E, 0x42, 0x43, 0x66`).
  - `1`: non-fatal handler rejection (e.g., target unit missing or >50 subtiles out of range in `0x6FCEBF50` / `0x6FCED630`).
  - `2`: invalid player/client/room/game or variable-length framing state inside handler (e.g., `0x6FCEDBB0` when `msgLen >= 0x100 || msgLen + 4 >= nSize`; `0x6FCEBF50` when `pPlayerData == NULL`).
  - `3`: invalid opcode (`0` or `>= 0x67`), NULL table slot (12 slots), per-handler `nSize` mismatch, always-reject stub (`0x2C, 0x2D, 0x39, 0x45, 0x52`), or invalid skill/sub-param inside handler.
- **Per-handler size validation**:
  - `0x6FCEC550` performs **zero** `nSize` checks itself.
  - Every fixed-size functional handler validates `nSize` at entry (`cmp [esp+8], N` → `mov eax, 3; ret 8`, or via `0x6FCEBF50` (`== 5`) / `0x6FCED630` (`== 9`), and `0x0B` via `dec eax; neg eax; sbb eax, eax; and eax, 3` (`== 1`)). Every functional handler's checked size agrees 100% with `D2Net.dll:0x6FBFABD8`.
  - Variable-length handlers: `0x14` (`0x6FCF00A0`) checks `4 <= nSize <= 275 (0x113)`; `0x15` (`0x6FCEDBB0`) checks `msgLen < 0x100 && msgLen + 4 < nSize` (else returns `2`); `0x66` (`0x6FCEB190`) is an unconditional noop (`xor eax, eax; ret 8`).
  - Special pre-check: `0x62` (`0x6FCEFB90`) checks `pGame+0x70` (`bExpansion != 0`, else returns `3`) before `cmp [esp+8], 5`.
  - NULL slots (`12`): `0x00, 0x2B, 0x4A, 0x4E, 0x55, 0x56, 0x57, 0x5A, 0x5B, 0x5C, 0x64, 0x65`.
  - Always-reject stubs (`mov eax, 3; ret 8`, 5 opcodes): `0x2C` (`0x6FCEB1E0`), `0x2D` (`0x6FCEBDA0`), **`0x39` (`0x6FCEB560`)**, `0x45` (`0x6FCEB550`), `0x52` (`0x6FCEB490`).
  - Always-noop stubs (`xor eax, eax; ret 8`, 4 opcodes): `0x2E` (`0x6FCEB1D0`), `0x42` (`0x6FCEB1C0`), `0x43` (`0x6FCEB1B0`), `0x66` (`0x6FCEB190`).
  - Spot-checked layouts:
    - `0x3A` (`0x6FCEC960`): size 3; `u8 stat @1` (`0..15`), `u8 count−1 @2` (count `1..100`); loops `0x6FD0AEE0`.
    - `0x3B` (`0x6FCEDA20`): size 3; `u16 skill @1`.
    - `0x4F` (`0x6FCF1470`): size 7; `u16 button @1`, `amount = (u16 @3 << 16) | u16 @5`.

### 4.4 Complete Verified 103-Entry Table (`D2Game.dll:0x6FD1A078`, `0x00..0x66`)

Note: 13 ported TS identifiers in `src/d2kern-113c/game/` carry legacy names referencing a different opcode (`*` below); their bodies match their exact DLL VA disassembly and `c2s-dispatch-113c.ts` binds strictly by exact `handlerVa`.

| Op | DLL `handlerVa` | `flag` (+4) | `0x6FCEC550` Gate | D2Net `0x6FBFABD8` | D2Game Handler Size Check | Ported TS Symbol (`src/d2kern-113c/game/`) |
|---|---|---:|---|---:|---|---|
| `0x00` | `0x00000000` | `0` | NULL → ret 3 | `0` | — | — |
| `0x01` | `0x6FCEE0D0` | `0` | pre-sw: alive & !st36 | `5` | `==5` (via `0x6FCEBF50`) | `C2S_Packet01_WalkToLocation113c` (`c2s-packet-113c.ts`) |
| `0x02` | `0x6FCEE090` | `0` | pre-sw: alive & !st36 | `9` | `==9` (via `0x6FCED630`) | `C2S_Packet02_WalkToUnit113c` (`c2s-packet-113c.ts`) |
| `0x03` | `0x6FCEE040` | `0` | pre-sw: alive & !st36 | `5` | `==5` (via `0x6FCEBF50`) | `C2S_Packet03_RunToLocation113c` (`c2s-packet-113c.ts`) |
| `0x04` | `0x6FCEE000` | `0` | pre-sw: alive & !st36 | `9` | `==9` (via `0x6FCED630`) | `C2S_Packet04_RunToUnit113c` (`c2s-packet-113c.ts`) |
| `0x05` | `0x6FCEE5A0` | `0` | pre-sw: alive & !st36 | `5` | `==5` (via `0x6FCEBF50`) | `C2S_Packet05_LeftSkillOnLocation113c` (`c2s-packet-113c.ts`) |
| `0x06` | `0x6FCEE9D0` | `0` | pre-sw: alive & !st36 | `9` | `==9` (via `0x6FCED630`) | `C2S_Packet06_LeftSkillOnUnit113c` (`c2s-packet-113c.ts`) |
| `0x07` | `0x6FCEE950` | `0` | pre-sw: alive & !st36 | `9` | `==9` (via `0x6FCED630`) | `C2S_Packet07_ShiftLeftSkillOnUnit113c` (`c2s-packet-113c.ts`) |
| `0x08` | `0x6FCEE8F0` | `0` | pre-sw: alive & !st36 | `5` | `==5` (via `0x6FCEBF50`) | `C2S_Packet08_RepeatLeftSkillOnLocation113c` (`c2s-packet-113c.ts`) |
| `0x09` | `0x6FCEEB70` | `0` | pre-sw: alive & !st36 | `9` | `==9` (via `0x6FCED630`) | `C2S_Packet09_RepeatLeftSkillOnUnit113c` (`c2s-packet-113c.ts`) |
| `0x0A` | `0x6FCEEB10` | `0` | pre-sw: alive & !st36 | `9` | `==9` (via `0x6FCED630`) | `C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c` (`c2s-packet-113c.ts`) |
| `0x0B` | `0x6FCEB5B0` | `0` | pre-sw: alive & !st36 | `1` | `==1` (else 3) | `C2S_Packet0B_Noop1Byte113c` (`c2s-packet-113c.ts`) |
| `0x0C` | `0x6FCEE520` | `0` | pre-sw: alive & !st36 | `5` | `==5` (via `0x6FCEBF50`) | `C2S_Packet0C_RightSkillOnLocation113c` (`c2s-packet-113c.ts`) |
| `0x0D` | `0x6FCEE870` | `0` | pre-sw: alive & !st36 | `9` | `==9` (via `0x6FCED630`) | `C2S_Packet0D_RightSkillOnUnit113c` (`c2s-packet-113c.ts`) |
| `0x0E` | `0x6FCEE7F0` | `0` | pre-sw: alive & !st36 | `9` | `==9` (via `0x6FCED630`) | `C2S_Packet0E_ShiftRightSkillOnUnit113c` (`c2s-packet-113c.ts`) |
| `0x0F` | `0x6FCEE790` | `0` | pre-sw: alive & !st36 | `5` | `==5` (via `0x6FCEBF50`) | `C2S_Packet0F_RepeatRightSkillOnLocation113c` (`c2s-packet-113c.ts`) |
| `0x10` | `0x6FCEEAB0` | `0` | pre-sw: alive & !st36 | `9` | `==9` (via `0x6FCED630`) | `C2S_Packet10_RepeatRightSkillOnUnit113c` (`c2s-packet-113c.ts`) |
| `0x11` | `0x6FCEEA50` | `0` | pre-sw: alive & !st36 | `9` | `==9` (via `0x6FCED630`) | `C2S_Packet11_RepeatShiftRightSkillOnUnit113c` (`c2s-packet-113c.ts`) |
| `0x12` | `0x6FCEB590` | `0` | pre-sw: alive & !st36 | `1` | `==1` (else 3) | `PACKET_Recv12_ClearGfxState0C_6FCEB590_113c` (`k2-w2b8-113c.ts`, 4-arg) |
| `0x13` | `0x6FCF0910` | `1` | pre-sw: alive & !st36 | `9` | `==9` (else 3) | `D2Game_6FCF0910_113c` (`k2-w13b1-113c.ts`) |
| `0x14` | `0x6FCF00A0` | `0` | case 0: unrestricted | `-1` | `4..275` (`0x04..0x113`) | `PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c` (`k2-w5b7-113c.ts`) |
| `0x15` | `0x6FCEDBB0` | `0` | case 0: unrestricted | `-1` | var (`msgLen < 256 && msgLen+4 < nSize` else 2) | `PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c` (`k2-w6b7-113c.ts`) |
| `0x16` | `0x6FCF08B0` | `1` | case 3: alive & !st36 | `13` | `==13` (else 3) | `D2Game_6FCF08B0_113c` (`k2-w13b1-113c.ts`) |
| `0x17` | `0x6FCEF380` | `1` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_Packet_DropCursorItem_6FCEF380_113c` (`k2-w15b1-113c.ts`) |
| `0x18` | `0x6FCEF0E0` | `1` | case 3: alive & !st36 | `17` | `==17` (else 3) | `D2Game_6FCEF0E0_113c` (`k2-w13b1-113c.ts`) |
| `0x19` | `0x6FCF1370` | `1` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c` (`k2-w8b3-113c.ts`) |
| `0x1A` | `0x6FCEEE60` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c` (`k2-w8b3-113c.ts`) |
| `0x1B` | `0x6FCEF2F0` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c`\* (`k2-w14b1-113c.ts`, DLL slot `0x1B`) |
| `0x1C` | `0x6FCF12E0` | `1` | case 3: alive & !st36 | `3` | `==3` (else 3) | `D2Game_6FCF12E0_113c` (`k2-w13b1-113c.ts`) |
| `0x1D` | `0x6FCF1200` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c` (`k2-w14b1-113c.ts`) |
| `0x1E` | `0x6FCF1140` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c`\* (`k2-w8b3-113c.ts`, DLL slot `0x1E`) |
| `0x1F` | `0x6FCF1010` | `1` | case 3: alive & !st36 | `17` | `==17` (else 3) | `C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c` (`k2-w14b1-113c.ts`) |
| `0x20` | `0x6FCEF730` | `1` | case 1: alive & !st36 | `13` | `==13` (else 3) | `C2S_Packet20_UseInventoryItem_6FCEF730_113c` (`k2-w8b3-113c.ts`) |
| `0x21` | `0x6FCEE4B0` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet21_MergeStackableItems_6FCEE4B0_113c` (`k2-w8b3-113c.ts`) |
| `0x22` | `0x6FCED4F0` | `1` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_ValidatePacket5ByteItem_6FCED4F0_113c` (`k2-w6b5-113c.ts`) |
| `0x23` | `0x6FCEEC70` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c` (`k2-w6b6-113c.ts`) |
| `0x24` | `0x6FCF0F80` | `1` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c` (`k2-w7b4-113c.ts`) |
| `0x25` | `0x6FCEEDE0` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c` (`k2-w6b6-113c.ts`) |
| `0x26` | `0x6FCEF5B0` | `1` | case 1: alive & !st36 | `13` | `==13` (else 3) | `C2S_Packet26_UseBeltItem_6FCEF5B0_113c` (`k2-w8b3-113c.ts`) |
| `0x27` | `0x6FCEF6B0` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet27_IdentifyItem_6FCEF6B0_113c` (`k2-w8b3-113c.ts`) |
| `0x28` | `0x6FCEEBD0` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet28_SocketItem_6FCEEBD0_113c` (`k2-w7b4-113c.ts`) |
| `0x29` | `0x6FCEDB30` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c` (`k2-w7b4-113c.ts`) |
| `0x2A` | `0x6FCEF270` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c` (`k2-w14b1-113c.ts`) |
| `0x2B` | `0x00000000` | `0` | NULL → ret 3 | `0` | — | — |
| `0x2C` | `0x6FCEB1E0` | `0` | case 3: alive & !st36 | `0` | always-reject (`3`) | `PACKET_C2S2C_Reject3_113c` (`k2-combat-core-w1-113c.ts`) |
| `0x2D` | `0x6FCEBDA0` | `0` | case 3: alive & !st36 | `1` | always-reject (`3`) | `PACKET_C2S2D_Reject3_113c` (`k2-combat-core-w1-113c.ts`) |
| `0x2E` | `0x6FCEB1D0` | `1` | case 3: alive & !st36 | `3` | always-noop (`0`) | `PACKET_C2S2E_PlaySoundNoop113c` (`k2-combat-core-w1-113c.ts`) |
| `0x2F` | `0x6FCEE440` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c`\* (`k2-w9b2-113c.ts`, DLL slot `0x2F` NPC interact) |
| `0x30` | `0x6FCED480` | `0` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet30_CancelNpcInteract_6FCED480_113c` (`k2-w7b4-113c.ts`) |
| `0x31` | `0x6FCEC9D0` | `0` | case 3: alive & !st36 | `9` | `==9` (else 3) | `PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c`\* (`k2-w5b5-113c.ts`, DLL slot `0x31`) |
| `0x32` | `0x6FCEF220` | `1` | case 3: alive & !st36 | `17` | `==17` (else 3) | `C2S_Packet_NpcBuyItem_6FCEF220_113c` (`k2-w15b1-113c.ts`) |
| `0x33` | `0x6FCEF570` | `1` | case 3: alive & !st36 | `17` | `==17` (else 3) | `C2S_Packet32_NpcBuyItem_6FCEF570_113c`\* (`k2-w14b1-113c.ts`, DLL slot `0x33` NPC sell) |
| `0x34` | `0x6FCEF070` | `1` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_Packet34_CainIdentifyItems_6FCEF070_113c` (`k2-w7b4-113c.ts`) |
| `0x35` | `0x6FCEF0A0` | `1` | case 3: alive & !st36 | `17` | `==17` (else 3) | `C2S_Packet35_NpcRepair_6FCEF0A0_113c` (`k2-w11b1-113c.ts`) |
| `0x36` | `0x6FCF0060` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet_HireMercenary_6FCF0060_113c` (`k2-w15b1-113c.ts`) |
| `0x37` | `0x6FCEEFE0` | `1` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c`\* (`k2-w7b4-113c.ts`, DLL slot `0x37`) |
| `0x38` | `0x6FCEFB30` | `1` | case 3: alive & !st36 | `13` | `==13` (else 3) | `C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c` (`k2-w16b1-113c.ts`) |
| `0x39` | `0x6FCEB560` | `0` | case 3: alive & !st36 | `5` | always-reject (`3`) | `PACKET_C2S39_Reject3_113c` (`k2-combat-core-w1-113c.ts`) |
| `0x3A` | `0x6FCEC960` | `0` | case 3: alive & !st36 | `3` | `==3` (else 3) | `C2S_Packet3A_AddStatPoint_6FCEC960_113c` (`k2-w7b4-113c.ts`) |
| `0x3B` | `0x6FCEDA20` | `0` | case 3: alive & !st36 | `3` | `==3` (else 3) | `C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c` (`k2-w11b1-113c.ts`) |
| `0x3C` | `0x6FCEF480` | `0` | case 0: unrestricted | `9` | `==9` (else 3) | `C2S_Packet3C_SelectSkill113c` (`c2s-packet-113c.ts`) |
| `0x3D` | `0x6FCED440` | `1` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_SyncObjectCollisionByGuid_6FCED440_113c` (`k2-w5b6-113c.ts`) |
| `0x3E` | `0x6FCED8D0` | `0` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_PacketUseQuestScrollItem_6FCED8D0_113c` (`k2-w9b2-113c.ts`) |
| `0x3F` | `0x6FCEBD50` | `0` | case 3: alive & !st36 | `3` | `==3` (else 3) | `PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c` (`k2-w2b8-113c.ts`, 4-arg) |
| `0x40` | `0x6FCEBD30` | `0` | case 3: alive & !st36 | `1` | `==1` (else 3) | `PACKET_Srv40_RequestQuestLog_6FCEBD30_113c` (`k2-w5b5-113c.ts`) |
| `0x41` | `0x6FCF14B0` | `1` | case 2: dead only (`m==17`) | `1` | `==1` (else 3) | `C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c` (`k2-w16b1-113c.ts`) |
| `0x42` | `0x6FCEB1C0` | `1` | case 3: alive & !st36 | `1` | always-noop (`0`) | `PACKET_C2S42_ClearCursorNoop113c` (`k2-combat-core-w1-113c.ts`) |
| `0x43` | `0x6FCEB1B0` | `1` | case 0: unrestricted | `1` | always-noop (`0`) | `PACKET_C2S43_QuestInitNoop113c` (`k2-combat-core-w1-113c.ts`) |
| `0x44` | `0x6FCF0E90` | `1` | case 3: alive & !st36 | `17` | `==17` (else 3) | `C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c`\* (`k2-w16b1-113c.ts`, DLL slot `0x44`) |
| `0x45` | `0x6FCEB550` | `1` | case 3: alive & !st36 | `9` | always-reject (`3`) | `PACKET_C2S45_Reject3_113c` (`k2-combat-core-w1-113c.ts`) |
| `0x46` | `0x6FCED3D0` | `0` | case 3: alive & !st36 | `13` | `==13` (else 3) | `PACKET_SrvMercMoveToUnit_6FCED3D0_113c` (`k2-w6b3-113c.ts`) |
| `0x47` | `0x6FCED360` | `0` | case 3: alive & !st36 | `13` | `==13` (else 3) | `PACKET_SrvMercMoveToCoord_6FCED360_113c` (`k2-w6b3-113c.ts`) |
| `0x48` | `0x6FCEB4E0` | `1` | case 3: alive & !st36 | `1` | `==1` (else 3) | `PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c` (`k2-w2b7-113c.ts`) |
| `0x49` | `0x6FCF0D30` | `0` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet49_WaypointInteract_6FCF0D30_113c` (`k2-w14b1-113c.ts`) |
| `0x4A` | `0x00000000` | `1` | NULL → ret 3 | `0` | — | — |
| `0x4B` | `0x6FCEC6E0` | `0` | case 3: alive & !st36 | `9` | `==9` (else 3) | `PACKET_C2S4B_RequestUnitRefresh113c` (`k2-combat-core-w1-113c.ts`) |
| `0x4C` | `0x6FCEF400` | `1` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c`\* (`k2-w16b1-113c.ts`, DLL slot `0x4C`) |
| `0x4D` | `0x6FCEB4A0` | `0` | case 3: alive & !st36 | `3` | `==3` (else 3) | `PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c`\* (`k2-w5b5-113c.ts`, DLL slot `0x4D`) |
| `0x4E` | `0x00000000` | `1` | NULL → ret 3 | `0` | — | — |
| `0x4F` | `0x6FCF1470` | `1` | case 3: alive & !st36 | `7` | `==7` (else 3) | `C2S_HandlePacket4F_TradeButton_6FCF1470_113c` (`k2-w16b1-113c.ts`) |
| `0x50` | `0x6FCEEF40` | `1` | case 3: alive & !st36 | `9` | `==9` (else 3) | `C2S_Packet50_DropPlayerGold_6FCEEF40_113c` (`k2-w5b6-113c.ts`) |
| `0x51` | `0x6FCEBC70` | `0` | case 3: alive & !st36 | `9` | `==9` (else 3) | `PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c`\* (`k2-w5b5-113c.ts`, DLL slot `0x51`) |
| `0x52` | `0x6FCEB490` | `1` | case 3: alive & !st36 | `5` | always-reject (`3`) | `PACKET_C2S52_Reject3_113c` (`k2-combat-core-w1-113c.ts`) |
| `0x53` | `0x6FCEB450` | `0` | case 3: alive & !st36 | `1` | `==1` (else 3) | `PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c` (`k2-w2b7-113c.ts`) |
| `0x54` | `0x6FCEB420` | `0` | case 3: alive & !st36 | `1` | `==1` (else 3) | `PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c` (`k2-w2b7-113c.ts`) |
| `0x55` | `0x00000000` | `1` | NULL → ret 3 | `0` | — | — |
| `0x56` | `0x00000000` | `1` | NULL → ret 3 | `0` | — | — |
| `0x57` | `0x00000000` | `1` | NULL → ret 3 | `0` | — | — |
| `0x58` | `0x6FCEB3D0` | `0` | case 3: alive & !st36 | `3` | `==3` (else 3) | `PACKET_C2S58_MarkQuestIntroSeen113c` (`k2-combat-core-w1-113c.ts`) |
| `0x59` | `0x6FCEFF30` | `0` | case 3: alive & !st36 | `17` | `==17` (else 3) | `PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c` (`k2-w5b7-113c.ts`) |
| `0x5A` | `0x00000000` | `1` | NULL → ret 3 | `0` | — | — |
| `0x5B` | `0x00000000` | `1` | NULL → ret 3 | `0` | — | — |
| `0x5C` | `0x00000000` | `1` | NULL → ret 3 | `0` | — | — |
| `0x5D` | `0x6FCEC8E0` | `0` | case 3: alive & !st36 | `7` | `==7` (else 3) | `C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c`\* (`k2-w6b5-113c.ts`, DLL slot `0x5D`) |
| `0x5E` | `0x6FCEC860` | `0` | case 3: alive & !st36 | `6` | `==6` (else 3) | `C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c`\* (`k2-w6b5-113c.ts`, DLL slot `0x5E`) |
| `0x5F` | `0x6FCF0790` | `0` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_Packet5F_UpdatePlayerPos113c` (`c2s-packet-113c.ts`) |
| `0x60` | `0x6FCEF510` | `1` | case 3: alive & !st36 | `1` | `==1` (else 3) | `C2S_Packet60_SwapWeapons_6FCEF510_113c` (`k2-w8b3-113c.ts`) |
| `0x61` | `0x6FCF0BC0` | `1` | case 3: alive & !st36 | `3` | `==3` (else 3) | `PACKETS_SrvMercItemAction_6FCF0BC0_113c` (`k2-w10b1-113c.ts`) |
| `0x62` | `0x6FCEFB90` | `1` | case 3: alive & !st36 | `5` | `==5` (after `pGame+0x70` exp check, else 3) | `C2S_Packet23_MercReviveHandler_6FCEFB90_113c`\* (`k2-w12b1-113c.ts`, DLL slot `0x62`) |
| `0x63` | `0x6FCF0950` | `1` | case 3: alive & !st36 | `5` | `==5` (else 3) | `C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c` (`k2-w6b6-113c.ts`) |
| `0x64` | `0x00000000` | `0` | NULL → ret 3 | `0` | — | — |
| `0x65` | `0x00000000` | `0` | NULL → ret 3 | `0` | — | — |
| `0x66` | `0x6FCEB190` | `0` | case 0: unrestricted | `-1` | always-noop (`0`) | `PACKET_C2S66_WardenResponseNoop113c` (`k2-combat-core-w1-113c.ts`) |

## 5. S→C notes found during the audit

- `0x22` UpdateSkillStatus: built by D2Game `0x6FCAD570`: `@1` unit type, `@3` id, `@7` skill, `@9` quantity,
  `@0xB = D2Common #10494(unit, 7 /*playerbody*/) ? 1 : 0`. `@2` and `@0xA` are never written. D2Client
  `0x6FB5C800` **drops the whole packet when `@0xB != 0`** and otherwise sets the quantity
  (`D2Common` thunk `0x6FABC4E4`) on the player looked up by `@3`.
- `0x73` CreateMissile: built by D2Game `0x6FC8F740`: `@1..4` always zero, `@5` class (#10191), `@7/@0xB` x/y,
  `@0xF/@0x13` target (only when requested), `@0x17` = `D2Common #10737` (reads the missile data `i16 +0x10`),
  `@0x19/@0x1A` owner, `@0x1E` = #11029, `@0x1F` = stat `0x148`. The client writes `@0x17` back with
  `D2Common #10970` (clamped `i16` store to missile data `+0x10`) and sets stat `0x148` from `@0x1F`.
- `0x66`: D2Client handler `0x6FB5C040` is a bare `ret`.
- `0x01`: D2Client `0x6FB5FA90` stores `@1` as-is (no clamp), the dword `@2` in `0x6FB9264C`, `@6` and `@7` in
  `0x6FBC9854` / `0x6FBC9858`. The dword's bits read by D2Client getters are `0x1, 0x2, 0x40, 0x80, 0x100, 0x200`.
- Merc stat/exp `0x9E..0xA2` (D2Client `0x6FB5EA40`, jump table `0x6FB5EAF4`): `0x9E` u8 / `0x9F` u16 /
  `0xA0` u32 go through `D2Common #10887` (the same setter 0x73 uses for stat `0x148`), while `0xA1` u8 /
  `0xA2` u16 take the `ebp = 1` path to `D2Common #10551` (the add path; the name was not checked in
  D2Common). A value for stat 12 also refreshes the owner (`0x6FB5E3F0`).

## 6. Follow-up findings (parity fixes #1655, #1659..#1661, #1664, #1665)

- `0x73` `@0x17` = missile data `+0x10`, the **remaining-frames countdown** (#1664). D2Game sets `+0x0E`
  (range, D2Common `0x6FDBA710`) and `+0x10` (#10970, `0x6FDBA6D0`) to the same value at creation
  (e.g. `0x6FC8FCCF`/`0x6FC8FCD6`, `0x6FC59833`/`0x6FC5983A`), decrements `+0x10` once per tick
  (`0x6FC5F39E..0x6FC5F3A8`, the missile ends at `<= 0`), and D2Common `0x6FDBA240` returns the elapsed frames
  as `+0x0E - +0x10`. D2Client pushes `@0x17` zero-extended (`movzx ecx, word`, `0x6FB5EF83`) into #10970, which
  clamps to `0x7FFF`. `@0x1E` is missile data `+0x0C` (#11029, level) and goes unchanged into the create struct
  (`pParam+0x30`, used raw in `Range + LevRange * level` at `0x6FB63417..0x6FB63429`).
- `0x01` builder: D2Game `0x6FCAC420` (called with `mov cl,0x1` from `0x6FC4AC64`): `@1` = pGame `+0x6D`
  (difficulty), `@2` = `[[pGame+0x1D28]+8]` = game create flags `& 0x3179C7` (`0x6FCD258C..0x6FCD2598`),
  `@6` = pGame `+0x70 != 0` (expansion = create flag `0x100000`), `@7` = pGame `+0x74 != 0` (ladder = create
  flag `0x200000`). Arena flag `0x800` is the **hardcore game** flag (#1665): the character admission checks
  compare character status `0x04` (hardcore) with `test ah,0x8` on these flags (`0x6FC6BDA0..0x6FC6BDF6`,
  `0x6FD0BB7F..0x6FD0BBE7`). D2Client itself never reads bit `0x800` of its copy.
- `0x58` (D2Client `0x6FB50250`, jump table `0x6FB50300`): 0 open orifice, 1 close, 4 clear "please wait",
  5 consumed (sound 5/3) + close, 6 and 7 both close the UI and end the NPC interaction (`0x6FB502D4`);
  2, 3 and `> 7` are fatal (`0x6FB502DE`). No unit type is carried.
- `0x81` (D2Client `0x6FB5EBA0` -> `0x6FAD1D60`): `{u32 @0xC, u32 @0x10, 0}` is copied to the pet record
  (`+0x24/+0x28/+0x2C`); for kind `@1 == 7` the merc name setter `0x6FAFEF50` gets `{u32 @0xC, u16 @0x10}`.

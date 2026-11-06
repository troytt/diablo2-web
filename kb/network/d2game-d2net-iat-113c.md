# `D2Game.dll` -> `D2Net.dll` 11-Slot IAT Bridge (Diablo II: LoD v1.13c)

## Binary Provenance
- **`D2Game.dll` v1.13c**: PE32 ImageBase `0x6FC20000`
  - `IMAGE_IMPORT_DESCRIPTOR` for `D2Net.dll`: ILT (`OriginalFirstThunk`) at `0x6FD1E0B0..0x6FD1E0D8`, IAT (`FirstThunk`) at `0x6FD18B48..0x6FD18B70` (`11` 32-bit slots, `0x2C` bytes, terminated by `0x00000000` at `0x6FD18B74`)
  - Indirect jump thunks (`jmp dword ptr [IAT]`): `0x6FC2A358..0x6FC2A394`
- **`D2Net.dll` v1.13c**: PE32 ImageBase `0x6FBF0000`
  - Global `gnNetMode`: `0x6FBFB418` (`0` = `QServer` multi-client server, `1` / `2` = local loopback)
  - Global `ghQServer`: `0x6FBFB424` (`Fog.dll` `QServer*` instance handle)
  - Global `gdwLocalClientGameTag`: `0x6FBFB428` (opaque per-client game tag when `nClientId == 0`)
- **`Fog.dll` v1.13c**: PE32 ImageBase `0x6FF50000` (`QServer` exports `#10156`, `#10157`, `#10159`, `#10162`, `#10165`, `#10171`, `#10172`, `#10173`, plus Huffman packet codec `#10218`/`#10219`/`#10222`/`#10223`/`#10224`)

---

## Complete 11-Slot IAT Table (`0x6FD18B48..0x6FD18B70`)

| Slot | `D2Game` IAT VA | `D2Game` Thunk VA | `D2Net` Ordinal | `D2Net` RVA / VA | `stdcall` Stack Cleanup | Callee Chain | Return / Missing `nClientId` Semantics |
|---:|---|---|---|---|---|---|---|
| 0 | `0x6FD18B48` | `0x6FC2A388` | `#10003` | `0x06A10` / `0x6FBF6A10` | `ret` (`0`B, 0 args) | `jmp 0x6FBF5DF8` -> `WSOCK32.dll!#111` (`WSAGetLastError`) | Returns last Winsock error `int` (`0` when none) |
| 1 | `0x6FD18B4C` | `0x6FC2A382` | `#10017` | `0x06170` / `0x6FBF6170` | `ret 0xC` (`12`B, 3 args) | `Fog.#10159(ghQServer, nClientId, szBuf, nBufLen)` (`0x6FF5D940`) | Found: copies IPv4 string into `szBuf` (`SStrCopy`); Missing: writes `szBuf[0] = 0` (`0x6FF5D9A2`, **NEVER** `'127.0.0.1'`). Both paths end with `LeaveCriticalSection` (`0x6FF5D995`/`0x6FF5D9C8`), returning `eax = 0` |
| 2 | `0x6FD18B50` | `0x6FC2A37C` | `#10000` | `0x06090` / `0x6FBF6090` | `ret 0x4` (`4`B, 1 arg) | `Fog.#10165(ghQServer, nClientId, szFile, 0x1CB)` (`0x6FF5EAF0` -> `0x6FF5E550`) | Missing (`0x6FF5E4E0 == NULL`): returns `0`. Already closing (`[ebx+0x0C] != 0` at `0x6FF5E562`): returns `[ebx+0x0C]` (non-zero `1`) |
| 3 | `0x6FD18B54` | `0x6FC2A376` | `#10016` | `0x061D0` / `0x6FBF61D0` | `ret 0x8` (`8`B, 2 args) | `Fog.#10156(ghQServer, 1, pOutBuf, nMaxLen)` (`0x6FF5DA60`) | Returns `-1` when Queue `1` (gameplay C2S) is empty or `ghQServer == NULL`; otherwise copies `min(pktLen + 4, min(nMaxLen, 0x5B4))` bytes and returns full `pktLen` |
| 4 | `0x6FD18B58` | `0x6FC2A370` | `#10035` | `0x061B0` / `0x6FBF61B0` | `ret 0x8` (`8`B, 2 args) | `Fog.#10156(ghQServer, 0, pOutBuf, nMaxLen)` (`0x6FF5DA60`) | Returns `-1` when Queue `0` (handshake C2S) is empty or `ghQServer == NULL`; otherwise returns full `pktLen` |
| 5 | `0x6FD18B5C` | `0x6FC2A36A` | `#10014` | `0x06190` / `0x6FBF6190` | `ret 0x8` (`8`B, 2 args) | `Fog.#10156(ghQServer, 2, pOutBuf, nMaxLen)` (`0x6FF5DA60`) | Returns `-1` when Queue `2` (admin/connect C2S) is empty or `ghQServer == NULL`; otherwise returns full `pktLen` |
| 6 | `0x6FD18B60` | `0x6FC2A364` | `#10015` | `0x06000` / `0x6FBF6000` | `ret 0x4` (`4`B, 1 arg) | `nClientId == 0 ? [0x6FBFB428] : Fog.#10173(ghQServer, nClientId)` (`0x6FF5E9F0`) | `0x6FF5EA07: xor eax, eax; ret 8` -> returns `0` when `nClientId` is not found |
| 7 | `0x6FD18B64` | `0x6FC2A35E` | `#10002` | `0x063E0` / `0x6FBF63E0` | `ret 0x10` (`16`B, 4 args) | Asserts `nLen <= 0x204`; Local (`{1,2}`): `0x6FBF6BD0` (`nLen`); Server (`0`): `Fog.#10223` + `Fog.#10157` (`0x6FF5EE00` -> `0x6FF5E8C0`) | Server mode returns framed compressed length (`compLen + 1` or `compLen + 2`; raw `nLen` on `(q&0xFF)==0 && pkt[0]==0xAF` or `(q&0xFF)==2`), or `0` if client missing/closing |
| 8 | `0x6FD18B68` | `0x6FC2A358` | `#10001` | `0x06110` / `0x6FBF6110` | `ret 0xC` (`12`B, 3 args) | `Fog.#10162(ghQServer, nClientId, szFile, nLine)` (`0x6FF5EC10`) | `void __stdcall` (`0` only when `[esi+0xBD0]==0`; missing client logs warning at `0x6FF5EC8F` without touching state; all 6 `D2Game` callers ignore `eax`) |
| 9 | `0x6FD18B6C` | `0x6FC2A394` | `#10009` | `0x06050` / `0x6FBF6050` | `ret 0x4` (`4`B, 1 arg) | `Fog.#10171(ghQServer, pfnCloseCallback)` (`0x6FF5CFA0`) | Writes `[ghQServer + 0xBBC] = pfnCloseCallback` (`eax = pfnCloseCallback`, `ret 8`); `0x6FF5E550` reads `+0xBC8`, never `+0xBBC` |
| 10 | `0x6FD18B70` | `0x6FC2A38E` | `#10021` | `0x06020` / `0x6FBF6020` | `ret 0x8` (`8`B, 2 args) | `nClientId == 0 ? [0x6FBFB428] = tag : Fog.#10172(ghQServer, nClientId, tag)` (`0x6FF5EA20`) | Missing client (`0x6FF5EA33: test eax, eax; je 0x6FF5EA3E`): no-op (`ret 0xC`) |

---

## Detailed Slot Disassembly & `D2Game.dll` Call Sites

### Slot 0 — `0x6FD18B48` -> `D2Net.#10003` (`D2Net_GetLastError`, `0x6FBF6A10`)
- **Prototype**: `int __stdcall D2Net_GetLastError(void)` (`ret`, `0` stack bytes)
- **Disassembly (`0x6FBF6A10`)**:
  - `6fbf6a10: jmp 0x6fbf5df8` -> `jmp dword ptr [0x6FBF81B0]` (`WSOCK32.dll` ordinal `#111`, `WSAGetLastError`).
- **`D2Game.dll` Callers (1)**:
  - `0x6FC4D5F0` (inside `NET_FlushClientSendQueue`): invoked immediately when `D2Net.#10002` returns `<= 0` (`0x6FC4D5C2..0x6FC4D5C9`), and its `eax` return value is ignored (`0x6FC4D5F5: inc DWORD PTR [esi+0x1C4]`).

### Slot 1 — `0x6FD18B4C` -> `D2Net.#10017` (`D2Net_GetClientIpAddress`, `0x6FBF6170`)
- **Prototype**: `int __stdcall D2Net_GetClientIpAddress(DWORD nClientId, char* szOutBuf, DWORD nBufSize)` (`ret 0xC`, `12` stack bytes)
- **Disassembly (`0x6FBF6170` & `Fog.#10159` `0x6FF5D940`)**:
  - `0x6FBF6170` forwards `(ghQServer, nClientId, szOutBuf, nBufSize)` to `Fog.#10159` (`0x6FF5D940`).
  - `0x6FF5D940` hashes `nClientId & pQServer->dwBucketMask` (`[ebp+0x0C]`), locks the bucket critical section, and walks `[ebp+0x14][bucket]` comparing `[esi] == nClientId` (`0x6FF5D984`).
  - **Missing client path (`0x6FF5D98F..0x6FF5D9A6`)**: calls `LeaveCriticalSection` (`0x6FF5D995`), executes `mov byte ptr [edx], 0` (`szOutBuf[0] = '\0'`), and returns `0` (`LeaveCriticalSection` `eax`). It **never** synthesizes `'127.0.0.1'`.
  - **Found client path (`0x6FF5D9A9..0x6FF5D9D2`)**: formats `pClient->dwSinAddr` (`[esi+0x18]`) via `inet_ntoa` (`0x6FF5CDA6`), copies up to `nBufSize` bytes (`SStrCopy` `0x6FF5CDDC`) into `szOutBuf`, and calls `LeaveCriticalSection` (`0x6FF5D9C8`), returning `eax = 0` (NOT `szOutBuf`).
- **`D2Game.dll` Callers (3)**:
  - `0x6FC49CF0`, `0x6FC49D25`, `0x6FC49D60` (each passes a 16-byte stack buffer `nBufSize = 0x10` for admin/connection IP inspection and ignores `eax`).

### Slot 2 — `0x6FD18B50` -> `D2Net.#10000` (`D2Net_DisconnectClient`, `0x6FBF6090`)
- **Prototype**: `BOOL __stdcall D2Net_DisconnectClient(DWORD nClientId)` (`ret 0x4`, `4` stack bytes)
- **Disassembly (`0x6FBF6090` & `Fog.#10165` `0x6FF5EAF0`)**:
  - Pushes line `0x1CB` (`459`), source string `"..\\Source\\D2Net\\SRC\\Server.cpp"` (`0x6FBF9298`), `nClientId`, and `ghQServer` (`[0x6FBFB424]`), calling `Fog.#10165` (`0x6FF5EAF0` -> `0x6FF5E550`).
  - `0x6FF5E550` looks up `nClientId` via `0x6FF5E4E0`:
    - If `ebx == NULL` (`0x6FF5E55A`), returns `0`.
    - If already marked closing (`mov eax, [ebx+0x0C]; test eax, eax; jne 0x6FF5E5E2` at `0x6FF5E562..0x6FF5E567`), returns `eax = [ebx+0x0C]` (**non-zero `1`**).
    - Otherwise sets `[ebx+0x0C] = 1`, closes socket `[ebx+0x10]`, decrements `dwRefCount` (`[ebx+0x08]` at `0x6FF5E5A3`), and when `dwRefCount` reaches `0` invokes `[esi+0xBC8]` (if set), unlinks (`0x6FF5E1B0`), and frees (`0x6FF5E3B0`).
- **`D2Game.dll` Callers (5)**:
  - `0x6FC49D3F`, `0x6FC4ABC6`, `0x6FC4BBE7`, `0x6FC4D131`, `0x6FC4DE1B`.

### Slots 3, 4, 5 — `0x6FD18B54` (`#10016`), `0x6FD18B58` (`#10035`), `0x6FD18B5C` (`#10014`)
- **Prototypes**: `int __stdcall D2Net_DequeuePacketQ{1,0,2}(BYTE* pOutBuf, DWORD nMaxLen)` (`ret 0x8`, `8` stack bytes each)
- **Disassembly (`0x6FBF61D0`, `0x6FBF61B0`, `0x6FBF6190` -> `Fog.#10156` `0x6FF5DA60`)**:
  - `#10035` (`0x6FBF61B0`, IAT `0x6FD18B58`) calls `Fog.#10156(ghQServer, 0, pOutBuf, nMaxLen)` — **Queue 0**: session handshake / game join C2S packets (`0x67..0x70`).
  - `#10016` (`0x6FBF61D0`, IAT `0x6FD18B54`) calls `Fog.#10156(ghQServer, 1, pOutBuf, nMaxLen)` — **Queue 1**: standard in-game C2S action packets (`0x01..0x66`).
  - `#10014` (`0x6FBF6190`, IAT `0x6FD18B5C`) calls `Fog.#10156(ghQServer, 2, pOutBuf, nMaxLen)` — **Queue 2**: server admin/connection control packets.
  - `Fog.#10156` (`0x6FF5DA60`) clamps unsigned `nMaxLen` to `0x5B4` (`1460` bytes, `0x6FF5DA8B..0x6FF5DA94`). When `ghQServer == NULL`, `queueIdx >= dwNumQueues`, or the target queue head `[esi+0x870][queueIdx]` is `NULL`, it returns `-1` (`0xFFFFFFFF` at `0x6FF5DACC: or esi, 0xFFFFFFFF`).
  - When a queued node exists, it copies `min(pktLen + 4, clampedMaxLen)` bytes from `[u32 nClientId][pktBytes...]` into `pOutBuf` (`0x6FF5DAFB..0x6FF5DB20`, without rejecting `nMaxLen < 4`), and at `0x6FF5DB22` (`mov esi, [ebx+0x5B4]` -> `mov eax, esi` at `0x6FF5DB66`) always returns the **full un-truncated `pktLen`** (`>= 0`).
- **`D2Game.dll` Callers (1 each, all inside the main server network pump `0x6FC4E460..0x6FC4E4D0`)**:
  - `0x6FC4E470` (`#10035`, Queue 0 -> `0x6FCEAF30`)
  - `0x6FC4E48F` (`#10016`, Queue 1 -> `0x6FCEAE80`)
  - `0x6FC4E4AF` (`#10014`, Queue 2 -> `0x6FC49CB0`)

### Slot 6 — `0x6FD18B60` -> `D2Net.#10015` (`D2Net_GetClientGameTag`, `0x6FBF6000`)
- **Prototype**: `DWORD __stdcall D2Net_GetClientGameTag(DWORD nClientId)` (`ret 0x4`, `4` stack bytes)
- **Disassembly (`0x6FBF6000` & `Fog.#10173` `0x6FF5E9F0`)**:
  - If `nClientId == 0` (`test eax, eax; je 0x6FBF6017`), returns `DWORD PTR [0x6FBFB428]`.
  - Otherwise calls `Fog.#10173(ghQServer, nClientId)`: looks up `nClientId` via `0x6FF5E4E0`, returning `DWORD PTR [eax + 0x20]` if found or `0` (`xor eax, eax`) if absent.
- **`D2Game.dll` Callers (6)**:
  - `0x6FC4AB71`, `0x6FC4D2F7`, `0x6FC4DC7A`, `0x6FC4E368`, `0x6FC6A78A`, `0x6FCEAE89`.

### Slot 7 — `0x6FD18B64` -> `D2Net.#10002` (`D2Net_SendPacket`, `0x6FBF63E0`)
- **Prototype**: `DWORD __stdcall D2Net_SendPacket(DWORD nQueue, DWORD nClientId, const BYTE* pPacket, DWORD nPacketLen)` (`ret 0x10`, `16` stack bytes)
- **Disassembly (`0x6FBF63E0`, `Fog.#10223` `0x6FF6EE60`, & `Fog.#10157` `0x6FF5EE00`)**:
  - Asserts `nPacketLen <= 0x204` (`516` bytes, `0x6FBF63EE: cmp esi, 0x204; jbe 0x6FBF6415`); if `nPacketLen > 0x204`, calls `Fog.#10024` (`0x6FBF9244` `""`, line `0x14F` = `335`) and `exit(-1)` (`0x6FBF63F6..0x6FBF6410`).
  - If `gnNetMode` (`[0x6FBFB418]`) is `1` or `2` (`0x6FBF641A..0x6FBF643B`), writes `(pPacket, nPacketLen)` directly to the local loopback buffer (`0x6FBF6BD0`) and executes `0x6FBF6432: mov eax, esi`, unconditionally returning `nPacketLen`.
  - In server mode (`gnNetMode == 0`):
    - If `(nQueue & 0xFF) == 0 && pPacket[0] == 0xAF` (`0x6FBF6446..0x6FBF6455`) or `(nQueue & 0xFF) == 2` (`0x6FBF6464..0x6FBF6467`), sends raw unframed `(pPacket, nPacketLen)` via `Fog.#10157` (`0x6FBF6517..0x6FBF653B`) and returns `ok ? nPacketLen : 0`.
    - Otherwise updates compression stats via `Fog.#10222` (`0x6FBF5ED6` -> `0x6FF6EF10`), Huffman-compresses `(pPacket, nPacketLen)` via **`Fog.#10223`** (`0x6FBF5E6A` -> `[0x6FBF8018]` -> `0x6FF6EE60`, using the static 256-byte bit-length table in `Fog.dll` `.data` at `0x6FF7F210` and the canonical code table at `0x6FF80DD0`, which is zero in the PE image and built at runtime by `Fog.#10218` `0x6FF6F550` -> `Fog.#10219` `0x6FF6EFD0`), asserts `compLen != 0` via `Fog.#10024` (`0x6FBF9244` `""`, line `0x16F` = `367`, `0x6FBF647F..0x6FBF649D`), prepends a 1-byte header `[compLen + 1]` when `compLen + 1 < 0xF0` (`framedLen = compLen + 1`, `0x6FBF64A2..0x6FBF64C7`) or 2-byte header `[0xF0 | ((compLen + 2) >> 8), (compLen + 2) & 0xFF]` when `compLen + 1 >= 0xF0` (`framedLen = compLen + 2`, `0x6FBF64DA..0x6FBF6504`), and calls `Fog.#10157(ghQServer, nClientId, pFrame, framedLen)` (`0x6FF5EE00` -> `0x6FF5E8C0`).
    - Note on client-side `0xAF` Huffman table replacement (`0x6FBF6E00..0x6FBF6E49`): when the client receives a `0xAF` packet with second byte `0x81` (`[0xAF, 0x81, ...]` at `0x6FBF6E10`), `0x6FBF6E1D..0x6FBF6E44` unpacks `0x80` (`128`) nibble pairs (`dl = (b & 0x0F) + 1`, `al = (b >> 4) + 1`) into a 256-byte bit-length array at `[esp+0x20]` and invokes `Fog.#10219` (`0x6FF6EFD0` via `0x6FBF5E52`) to rebuild `0x6FF80DD0` dynamically.
    - If `nClientId` is missing or closing (`[eax+0x0C] != 0`), `0x6FF5E8C0` returns `0` (without modifying Winsock `WSAGetLastError`), which `#10002` converts via `neg eax; sbb eax, eax; and eax, ebx` into `0`; on success it returns **`framedLen`**.
- **`D2Game.dll` Callers (22 exact `call 0x6FC2A35E` sites)**:
  - `0x6FC49D0F`, `0x6FC49D39`, `0x6FC49D74`, `0x6FC49F9D`, `0x6FC4ABC0`, `0x6FC4BA91`, `0x6FC4BADB`, `0x6FC4BBE1`, `0x6FC4D12B`, `0x6FC4D21C`, `0x6FC4D5C2`, `0x6FC4D88C`, `0x6FC4D8F7`, `0x6FC4DD31`, `0x6FC4E3D3`, `0x6FC72777`, `0x6FC7278C`, `0x6FCAA4B0`, `0x6FCAA4D5`, `0x6FCAC4C6`, `0x6FCAC4E0`, `0x6FCAC51D`.

### Slot 8 — `0x6FD18B68` -> `D2Net.#10001` (`D2Net_DropClientSource`, `0x6FBF6110`)
- **Prototype**: `void __stdcall D2Net_DropClientSource(DWORD nClientId, const char* szFile, DWORD nLine)` (`ret 0xC`, `12` stack bytes)
- **Disassembly (`0x6FBF6110` & `Fog.#10162` `0x6FF5EC10`)**:
  - Forwards `(ghQServer, nClientId, szFile, nLine)` to `Fog.#10162` (`0x6FF5EC10`).
  - If `[ghQServer + 0xBD0] == 0` (`0x6FF5EC15..0x6FF5EC1D`), returns immediately (`eax = 0`). Otherwise looks up `nClientId` in `ghQServer`; if missing, logs diagnostic `(nClientId, szFile, nLine)` via `0x6FF690A0` (`0x6FF5EC8F`) without touching client state (`eax` holds `0x6FF690A0`'s return value). If found, logs client IP + `(szFile, nLine)`, closes connection via `0x6FF5E550`, and records drop metrics (`0x6FF5DF00`). All 6 `D2Game.dll` callers ignore `eax`.
- **`D2Game.dll` Callers (6)**:
  - `0x6FC4D2C9`, `0x6FC4D2E6`, `0x6FC4D338`, `0x6FC4D39A`, `0x6FC4E3ED`, `0x6FCEAFFD`.

### Slot 9 — `0x6FD18B6C` -> `D2Net.#10009` (`D2Net_SetCloseCallback`, `0x6FBF6050`)
- **Prototype**: `void __stdcall D2Net_SetCloseCallback(DWORD pfnCloseCallback)` (`ret 0x4`, `4` stack bytes)
- **Disassembly (`0x6FBF6050` & `Fog.#10171` `0x6FF5CFA0`)**:
  - Calls `Fog.#10171(ghQServer, pfnCloseCallback)` (`mov eax, [esp+8]; mov ecx, [esp+4]; mov [ecx + 0xBBC], eax; ret 8`).
  - Note: `QServer` disconnect (`0x6FF5E550` at `0x6FF5E5AD`) reads `[esi + 0xBC8]`, never `[esi + 0xBBC]`; nothing in `Fog.dll`, `D2Net.dll`, or `D2Game.dll` ever reads `[ghQServer + 0xBBC]`.
- **`D2Game.dll` Callers (1)**:
  - `0x6FC4D4EA`: registers `0x6FC4D2F0` (`NET_OnClientCloseCallback`) during game server startup.

### Slot 10 — `0x6FD18B70` -> `D2Net.#10021` (`D2Net_SetClientGameTag`, `0x6FBF6020`)
- **Prototype**: `void __stdcall D2Net_SetClientGameTag(DWORD nClientId, DWORD dwGameTag)` (`ret 0x8`, `8` stack bytes)
- **Disassembly (`0x6FBF6020` & `Fog.#10172` `0x6FF5EA20`)**:
  - If `nClientId == 0` (`test eax, eax; je 0x6FBF603D`), writes `DWORD PTR [0x6FBFB428] = dwGameTag`.
  - Otherwise calls `Fog.#10172(ghQServer, nClientId, dwGameTag)` (`0x6FF5EA20`): looks up `nClientId` via `0x6FF5E4E0` and writes `DWORD PTR [eax + 0x20] = dwGameTag` only when `eax != NULL` (silent no-op if `nClientId` is missing).
- **`D2Game.dll` Callers (2)**:
  - `0x6FC4BB71`, `0x6FC4C478`.

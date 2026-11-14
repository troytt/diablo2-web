# D2Game 1.13c Headless Server Host (`d2host-113c.exe`)

Binary ground truth for running original Diablo II: Lord of Destruction v1.13c server simulation (`D2Game.dll` + `D2Common.dll` + `D2Net.dll`) in a pure headless Win32 console process without `Game.exe`, `D2Win.dll`, `D2Gfx.dll`, `D2Client.dll`, `D2Sound.dll`, `D2CMP.dll`, Xvfb, or 25 fps wall-clock throttling.

## 1. Authoritative Binary Evidence

| Module | Preferred `ImageBase` | Key Ordinals / VAs | Role in Headless Host |
| --- | --- | --- | --- |
| `Storm.dll` | `0x6FBF0000` | `#266` (`SFileOpenArchive`), `#401` (`SMemAlloc`), `#403` (`SMemFree`), `DllMain` (`+0x25CD6` / `0x6FC15CD6`), `[base + 0x53120]` (`0x6FC43120`, MPQ crypt table ptr) | MPQ archive mounting & Storm heap (loaded first at preferred base `0x6FBF0000`) |
| `Fog.dll` | `0x6FF50000` | `#10021`, `#10101`, `#10089`, `#10082`, `#10218`, `#10227` | File-system wrapper, sync primitives, bitmasks, Huffman init, expansion check |
| `D2Lang.dll` | `0x6FC00000` | `#10008` (`__fastcall(0, NULL, bExpansion)`) | String table loader (`data\local\use`, `string.tbl` / `expansionstring.tbl` / `patchstring.tbl`) |
| `D2Common.dll` | `0x6FD50000` | `#10943` (`DATATBLS_LoadAllTxts(0, 0, 0)`) | Compiles/loads all `.bin`/`.txt` Excel tables, `AnimData.d2`, collision/DRLG tables |
| `D2Net.dll` | `0x6FBF0000` | `#10005(1, 1)`, `#10034(1, NULL)`, `#10019()`, `#10012(0)`, `#10024`, `#10020` | Protocol `1` in-memory loopback packet queues (collides with `Storm.dll` preferred `0x6FBF0000` and is dynamically rebased by the Win32 loader) |
| `D2Game.dll` | `0x6FC20000` | `#10037` (`0x6FC4A370`), `#10038` (`0x6FC4D4B0`), `#10017` (`0x6FC4A210`), `#10040` (`0x6FC4E460`), `#10008` (`0x6FC4E1E0`), `#10024` (`0x6FC4DF10`) | Authoritative server state machine, `GAME_UpdateGames`, `S2C` packet flush |

## 2. Five Critical Reverse-Engineered Invariants

### 2.1 `Storm.dll` Dynamic `LoadLibraryA` Poison Crypt Seed (`base + 0x25CD6..0x25CE3`)
When `Game.exe` statically imports `Storm.dll` (preferred `ImageBase = 0x6FBF0000`), the Windows PE loader invokes `Storm.dll`'s `DllMain` with `lpvReserved != NULL` (`[esp+0x0C] != 0`). At `base + 0x25CD6` (`0x6FC15CD6` at preferred base `0x6FBF0000`), `Storm.dll` checks `cmp [ebp+0x10], ebx` (`lpvReserved == NULL`):
- **Static import (`lpvReserved != NULL`):** skips `base + 0x25CDE` (`0x6FC15CDE`), leaving `[base + 0x53120]` (`0x6FC43120`) `== NULL`. The first call to `SFileOpenArchive` (`base + 0x2A10E..0x2A11C` / `0x6FC1A10E..0x6FC1A11C`) then initializes the `0x500`-DWORD MPQ decryption table (`base + 0x27FC0` / `0x6FC17FC0`) with the real seed **`0x00100001`** (`crypt[0] = 0x55C636E2`).
- **Dynamic `LoadLibraryA` (`lpvReserved == NULL`):** `base + 0x25CDE` (`0x6FC15CDE`) intentionally pre-initializes `[base + 0x53120]` (`0x6FC43120`) with poison seed **`0x10000100`**, causing `SFileOpenArchive` to succeed while every subsequent MPQ file lookup (`SFileOpenFileEx("data\\local\\use")`) silently fails hash decryption with `ERROR_FILE_NOT_FOUND`!
- **Headless Host Fix (`d2host-113c.c:402-408`):** Immediately after `LoadLibraryA("Storm.dll")`, free and zero `*(void **)((uintptr_t)hStorm + 0x53120)` so `SFileOpenArchive` (`+0x2A10E`) initializes `[hStorm + 0x53120]` with `0x00100001`.

### 2.2 `Fog.#10019` Crash Filter Hang Avoidance
`Fog.#10019` installs a custom `UnhandledExceptionFilter` that writes `D2yymmdd.txt` and blocks on a Win32 `MessageBoxA` dialog when headless. Skipping `Fog.#10019` and calling `#10021("D2")` -> `#10101(0, NULL)` -> `#10089(1, NULL)` -> `#10082()` -> `#10218()` (matching `Game.exe` `0x0040761B..0x00407631`) prevents any GUI hang.

### 2.3 `TSHashTable<D2GameStrc>` (`0x68` Bytes) Passed to `D2Game.#10037`
`D2Client.dll` (`0x6FB5FEC3`) passes its global `0x68`-byte `TSHashTable<D2GameStrc>` (`0x6FBD2360`) to `D2Game.#10037`, which stores it in `[0x6FD31C24]`. During `CS_CREATEGAME` (`0x6FC4C2D0`), `D2Game` locks `tbl + 0x50` (`CRITICAL_SECTION`), allocates a hash key from `tbl + 0x48`, and calls `tbl->vtable[1]` (`0x6FC220CA`, `__thiscall(tbl, pBucket, extraBytes, flags)`) to allocate `sizeof(D2GameStrc) == 0x1DF4` (`7,668`) bytes via `Storm.#401` and link `node + 0x04` into `pBucket`, then links `node + 0x0C` into `tbl->fullList` (`tbl + 0x04`, `linkOffset = 0x0C`). Pre-allocating `1024` buckets (`hashMask = 0x3FF`) guarantees `D2Game` never triggers table rehash.

### 2.4 `D2Net` Loopback Queue Partitioning & `S2C 0xAF` Ordering (`0x6FC4E460`)
In `D2Game.#10040` (`0x6FC4E460`):
1. Loop 1 (`0x6FC4E466..0x6FC4E483`) drains `D2Net` **Queue `0`** (`0x6FC2A370`) into `0x6FCEAF30` (`C2S 0x67..0x70` system/lobby packets).
2. Loop 2 (`0x6FC4E485..0x6FC4E4A3`) drains `D2Net` **Queue `1`** (`0x6FC2A376`) into `0x6FCEAE80 -> 0x6FCEC550` (in-game `C2S 0x01..0x66` packets).
3. Loop 3 (`0x6FC4E4A5..0x6FC4E4BC`) drains new client connection events (`0x6FC2A36A`), registering client `1` in `D2Game` and emitting `S2C 0xAF` (`LOGON_CHALLENGE`).

Because Loop 3 runs *after* Loop 1 inside `D2Game.#10040`, the host **must** poll `D2Net.#10019() == 2`, call `D2Game.#10040()` once, and drain `S2C 0xAF` *before* sending `C2S 0x67` (`CS_CREATEGAME`, `0x2E` bytes on Queue `0`); otherwise `0x6FC4A850` (`0x6FC698B0` / `0x6FC697C0`) rejects `0x67` because client `1` has not yet transitioned to `LOGON_SENT`.

To match `Game.exe` Single Player frame numbering exactly:
1. Send `C2S 0x67` (`0x2E` bytes, `gameType = 3`, `arenaFlags = 0x00100004` for Expansion) on Queue `0` and call `D2Game.#10040()` (`[0x6FD30C08]` receives the new `gameHashKey`, and `S2C 0x02` is queued).
2. Step **Frame 1** (`D2Game.#10008(1)` + `D2Game.#10024(1, 0)`) *before* `C2S 0x6B` (`t0 = []`, `t1 = []`).
3. Send `C2S 0x6B` (`CS_ENTER_GAME`, `1` byte) on Queue `0` and call `D2Game.#10040()` (spawns player `#1` and Rogue Encampment rooms/NPCs).
4. Step **Frames `2..N`** (`D2Game.#10040()` + unthrottled `D2Game.#10008(1)` + `D2Game.#10024(1, 0)` + `D2Net.#10020` drain).

### 2.5 Unthrottled `D2Game.#10008` (`GAME_UpdateGames`) vs `D2Game.#10002` Trap
- `D2Game.#10002` (`0x6FC729F0 -> 0x6FC726F0`) is Battle.net's multi-threaded realm task runner (`__fastcall(ecx, edx)`), which calls `SMemFree(pTaskNode)` at `0x6FC729BE` — it must **not** be called with a stack node in Single Player.
- `D2Game.#10008` (`0x6FC4E1E0`) is the actual Single Player frame driver called by `D2Client.dll` (`0x6FAF4D00`), and `d2oracle.c` hooks its `call 0x6FC4E050` site at `0x6FC4E2DB`.
- Setting `*(uint32_t *)(0x6FD2E35C + rebase) = 1` forces `[pGame + 0x1DBC] = 0x400` (deterministic 1.0× 40 ms delta at `0x6FC4E26F`), and setting `*(uint32_t *)(0x6FD31C44 + rebase) = (GetTickCount() & 0x7FFFFFFF) - 40` before each `D2Game.#10008(1)` call bypasses the `40 ms` wall-clock gate (`0x6FC4E21B`) with zero division-by-zero risk on `[0x6FD31F70]`.

## 3. Verified Parity & Automated Speedup Measurements (`tests/oracle/headless-host.test.ts`)

All three scenarios below are executed under `tests/oracle/headless-host.test.ts` (asserting Wine availability without silent skips):

| Scenario | Frames | Checked-In `Game.exe` Golden SHA-256 | Headless `d2host-113c.exe` SHA-256 | Frame Parity |
| --- | --- | --- | --- | --- |
| `a1c-bloodmoor-fallen` | `2,000` (`2,001` lines) | `7ab7794b...` | `7ab7794b...` | **`2,001 / 2,001` raw byte-identical** (incl. header line `0`) |
| `p52-dot-ticks` | `1,200` (`1,201` lines) | `5dc9bbdb...` | `5dc9bbdb...` | **`1,201 / 1,201` raw byte-identical** (incl. header line `0` & `dot` ticks) |
| `a1-bloodmoor-melee` | `1,800` (`1,801` lines) | `c80572bc...` (recorded pre-`dot` hook) | `395eea45...` (current `d2oracle.dll` with `dot` hook) | **`0 / 1,801` semantic frame divergences** (`1,781` lines raw byte-identical; header `0` + poison frames `1087..1105` differ solely by `dot` instrumentation) |

### Measured `a1-bloodmoor-melee` (`1,800` Frames, Seed `12345`) Speedup

| Metric | Nominal `25 fps` Real-Time Budget (`72,000 ms` for `1,800` frames) | Measured `d2host-113c.exe` (`run-headless-oracle.sh`) | Automated Assertion in `headless-host.test.ts` |
| --- | --- | --- | --- |
| In-process QPC `sim_ms` (`1,800` ticks) | `72,000 ms` (`25.0 fps`) | `~72–76 ms` (`~23,600–25,052 fps`, **`~940×–1,002×`** vs `25 fps` real-time budget) | Asserts `effective_fps > 7,500` (**`> 300×`** sim speedup) |
| End-to-end `d2host-113c.exe` wall-clock (`wall_ms`, incl. ephemeral `WINEPREFIX` copy + `wineserver` boot + MPQ/table init) | `72,000 ms` (`72.0 s` of `25 fps` game time) | `~3,300 ms` (`~3.3 s`, `init_ms ~330–380 ms`, **`~21.5×`** faster than `72.0 s` of `25 fps` real-time) | Logged & verified per test run |

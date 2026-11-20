# `[K1-5]` DRLG & `[K1-6]` PATH Real-DLL D2TV Vector Suites & Closure Ratchet Report

## 1. Summary

This report documents the `[K1-5]` DRLG (`drlg-emitter.c`) and `[K1-6]` PATH (`path-emitter.c`) real-DLL D2TV binary vector suites, page-touched `SparseMemory113c` world image (`PAGEIMG`), TypeScript binary parsers/serializers (`drlg-vector.ts`, `path-vector.ts`), and manifest-closure `blocked` ratchet suites (`exitgate-drlg-vectors.test.ts`, `exitgate-path-vectors.test.ts`).

| Metric | `[K1-5]` DRLG Suite | `[K1-6]` PATH Suite |
|---|---|---|
| Emitter source | `tools/oracle/vectors/drlg-emitter.c` | `tools/oracle/vectors/path-emitter.c` |
| Build & runner script | `tools/oracle/vectors/run-drlg-emitter.sh` | `tools/oracle/vectors/run-path-emitter.sh` |
| TS parser & verifier | `tools/oracle/vectors/drlg-vector.ts` | `tools/oracle/vectors/path-vector.ts` |
| Vitest gate | `tests/oracle/k1/exitgate-drlg-vectors.test.ts` | `tests/oracle/k1/exitgate-path-vectors.test.ts` |
| Ratchet baseline | `tests/fixtures/oracle/vectors/drlg-expected-divergence.json` | `tests/fixtures/oracle/vectors/path-expected-divergence.json` |
| Compiler-flag parity (`-O2` vs `-O2 -fno-omit-frame-pointer`) | 100% byte-identical | 100% byte-identical |
| Live replay summary | `match 0/20400, blocked 20400 (177 fns), diverge 0` | `match 0/6924, blocked 6924 (59 fns), diverge 0` |

---

## 2. Pinned D2TV Binary Fixtures

All fixtures use the 32-byte `D2TV` header (`magic = 0x56543244`, `version = 1`, `flags = 1` for Expansion `Fog.#10227() == 1`) and are compressed with `gzip -n -9`.

| Fixture Path | Kind | Record Size | Record Count | Raw Bytes | Gzip Size | Raw SHA-256 Digest |
|---|---|---:|---:|---:|---:|---|
| `tests/fixtures/oracle/vectors/drlg-digest-113c.d2tv.gz` | `DRLGDIG` | `56 B` | `20,400` | `1,142,432` | `345 KiB` | `2bdf75938c7e55904b354f7463c0f35334d3f130ef580681bf5d58399eeced28` |
| `tests/fixtures/oracle/vectors/drlg-rooms-s12345.d2tv.gz` | `DRLGROOM` | `48 B` | `20,807` | `998,768` | `342 KiB` | `dc625a2bf9a4ee24c117a11fde8891d97d926c6edbae56d282edfa0690f49ee9` |
| `tests/fixtures/oracle/vectors/drlg-coll-towns-s12345-d0.d2tv.gz` | `DRLGCOLL` | `7,232 B` | `169` | `1,222,240` | `9.8 KiB` | `a7fc68ead57379c285df1e45c92a833d9a1213dc7357099a96f298939dfee120` |
| `tests/fixtures/oracle/vectors/path-vectors-113c.d2tv.gz` | `PATHVEC` | `460 B` | `6,924` | `3,185,072` | `98 KiB` | `eb59554dc7b5d0bb4e79211c8042fa24ca1a5a6e61e56fd3a919c9ec7d9068dc` |
| `tests/fixtures/oracle/vectors/path-world-town-s12345.img.gz` | `PAGEIMG` | `4,100 B` | `66` | `270,632` | `35 KiB` | `7938797317be1ce51e911a6788ceb886fa8437d5c59bb0230a2b18520546123b` |

---

## 3. `[K1-5]` DRLG Architecture & Disassembly Proofs

### 3.1 `-seed N` CLI to `ACT_LoadAct` (`#10951`) Seed Binding

Disassembly of `D2Game.dll` proves that the `-seed N` override (`--seed 12345` in `d2host`) is stored unmodified in `pGame->dwInitSeed` (`+0x7C`) and passed directly as the second parameter (`dwInitSeed`) of `D2Common.#10951 ACT_LoadAct`:

1. `D2Game.#10017` (`0x6FC4A210`): stores the CLI seed in `[0x6FD2E354]` (`gdw ForcedGameSeed`) and sets `[0x6FD273C8] = 1`.
2. `GAME_InitSeed` (`D2Game:0x6FC4A900..0x6FC4A97C`): when `[0x6FD273C8] != 0`, loads `ecx = [0x6FD2E354]` (`0x6FC4A90A`) and writes `mov [esi+0x7c], ecx` (`0x6FC4A97C`, `pGame->dwInitSeed = seed`).
3. `DUNGEON_InitAct` (`D2Game:0x6FCBD6F0..0x6FCBD745`): loads `edx = [esi+0x7c]` (`0x6FCBD72E`) and pushes `edx` as the second argument to `D2Common.#10951 ACT_LoadAct(nAct, dwInitSeed, 0, pGame, nDifficulty, pMemPool, dwTownLevelId, NULL, NULL)` (`0x6FCBD745`).

### 3.2 Determinism & Multi-Combo Isolation

- **`kernel32!GetTickCount` IAT Stub (`0x00010000`)**: `ENV_AllocDrlgEnvironment` (`0x6FD87BA0`) and `SEED_GenerateLoopSeed` (`0x6FD86760`) import `GetTickCount` through `D2Common.dll`'s IAT. Patching `D2Common.dll`'s IAT entry to return constant `0x00010000` makes `pAct->pEnvironment` (`+0x04`, 56 bytes) 100% invariant (`envHash = 0x87dc8623f5efad6c` across all runs).
- **Single-Process Multi-Combo Loop (`#10868 ACT_UnloadAct`)**: Each `(seed, diff)` combo loads Act `0..4`, initializes every level `lo..hi` via `#10207 DRLG_AllocLevel` + `#10322 DRLG_InitLevel`, activates all `RoomEx` in list order (`pLevel+0x10` via `+0x24`) via `0x6FDCC270` (`DRLG_ActivateRoomEx`), and unloads the Act via `#10868 ACT_UnloadAct`. Forward and reverse seed order runs (`--verify-order`) produce bit-for-bit identical `layoutHash` and `collHash` digests.
- **Canonical Serialization (`DRLGROOM` & `DRLGCOLL`)**:
  - `DrlgRoomRecord` (`48 B`): `seed`, `diff`, `act`, `levelId`, `roomIndex`, `posX/Y/W/H` (`+0x34..+0x40`), `dwFlags` (`+0x14`), `dwOtherFlags` (`+0x18`), `nType` (`+0x48`), `ds1Id` (`*(*(r+0x20)+0x00)` when `nType == 2` else `-1`), `seedLo/Hi` (`+0x4C/+0x50`), `nPresetUnits`, and `presetHash` (FNV-1a 32-bit over sorted `(nUnitType, nIndex, nMode, nXpos, nYpos, dwFlags)` tuples from `D2PresetUnitStrc` at `r+0x5C`).
  - `DrlgCollRecord` (`7,232 B`): `seed`, `diff`, `act`, `levelId`, `roomIndex`, `nSubtileX/Y/Width/Height` (`+0x00..+0x0C`), and `uint16_t cells[3600]` (`pMap` at `+0x20`, zero-padded past `w * h`).

---

## 4. `[K1-6]` PATH Coverage Table & Disassembled Pre-States

### 4.1 `PATHTYPE 0..17` Coverage Across 6,924 Vectors

| `pathType` | Handler VA (`0x6FDE42F0`) | Flags (`0x6FDE4180`) | `dirOff` (`0x6FDE4138`) | `nonFault` | `posRet` (`ret > 0`) | `fogAssert` | Notes & Pre-State Requirements |
|---:|---|---:|---:|---:|---:|---:|---|
| `0` | `0x6FDC0E40` (`IDA*`) | `0x21900` | `0` | `387` | `148` | `0` | `0x6FDC0650` returns `0` if corner count `<= 1`; requires non-colinear target turns |
| `1` | `0x6FDCB630` (`A*`) | `0x01900` | `0` | `384` | `318` | `0` | Direct A* search |
| `2` | `0x6FDB78B0` (`TOWARD`) | `0x00000` | `0` | `204` | `160` | `181` | Asserts at `line 0x861` (`2145`) on `unitType == 0` (player); requires `a2 = 1` on monsters |
| `3` | `0x6FDB7B70` | `0x00000` | `0` | `331` | `265` | `53` | Wrapper around `0x6FDB78B0` |
| `4` | `0x6FD85780` (`MON_CIRCLE`) | `0x60000` | `0` | `384` | `360` | `2` | Dispatched via `flags & 0x40000` -> `0x6FD85530`; asserts at `line 0x873` (`2163`) if `nDistMax >= 0x4E` |
| `5` | `0x6FDB78B0` (`CIRCLE_CW`) | `0x00000` | `+2` | `384` | `265` | `0` |Rotated direction offset `+2` |
| `6` | `0x6FDB78B0` (`CIRCLE_CCW`) | `0x00000` | `-2` | `384` | `262` | `0` | Rotated direction offset `-2` |
| `7` | `0x6FDB7AD0` (`STRAIGHT`) | `0x21900` | `0` | `335` | `269` | `53` | Default player pathType in `#11003`; Toward with A* fallback |
| `8` | `0x6FDB7390` (`KNOCKBACK_SRV`) | `0x1E600` | `0` | `384` | `315` | `0` | Uses `nStepNum (+0x90)` distance and optional `pTargetUnit (+0x58)` vector; requires `dwAnimMode = 1` |
| `9` | `0x6FDB77F0` (`LEAP`) | `0x1E800` | `0` | `333` | `264` | `53` | Calls `0x6FDB7630` straight-line raycast to `(targetX, targetY)` |
| `10` | `0x6FD85780` (`FLEE`) | `0x60000` | `0` | `384` | `384` | `0` | Dispatched via `flags & 0x40000` -> `0x6FDB6AA0`; requires `nStepNum (+0x90) > 0` |
| `11` | `0x6FDB77C0` (`KNOCKBACK_CLI`) | `0x1E604` | `0` | `331` | `262` | `53` | Calls `0x6FDB7630` with `nStepNum (+0x90)` |
| `12` | `0x6FDB7850` (`BACKUP`) | `0x00000` | `-4` | `384` | `262` | `0` | Opposite direction offset `-4` |
| `13` | `0x6FDB78B0` (`TOWARD_FINISH`) | `0x00100` | `0` | `331` | `265` | `53` | Toward with `0x100` flag |
| `14` | `0x6FD85780` (`BLESSEDHAMMER`) | `0x60000` | `0` | `384` | `384` | `0` | Dispatched via `flags & 0x40000` -> `0x6FDB6920`; emits 77-point outward spiral |
| `15` | `0x6FD68C40` (`WALL_FOLLOW`) | `0x00800` | `0` | `331` | `150` | `53` | Bresenham + wall-following simplification |
| `16` | `0x6FDC0E40` (`MISSILE_STREAM`) | `0x00000` | `0` | `384` | `231` | `0` | Shares `0x6FDC0E40` (`IDA*`) without `0x21900` flags |
| `17` | `0x00000000` (`NULL`) | `0x00000` | `0` | `66` | `0` | `318` | `IsBadCodePtr(NULL)` in `#10334` triggers `Fog.#10024` assert at `line 0x37E` (`894`) |

---

## 5. Manifest Callgraph Closures & Shrink-Only Ratchets

| Closure | Entry VAs | Total Functions | Ported / `diff-verified` | Unported Functions | Unported Bytes |
|---|---|---:|---:|---:|---:|
| `DRLG layout` | `0x6FD8CB30`, `0x6FD7D9B0`, `0x6FD7E360` | `305` | `129` | `176` | `61,247 B` |
| `DRLG collision` | `0x6FD8CB30`, `0x6FD7D9B0`, `0x6FD7E360`, `0x6FDCC270` | `306` | `129` | `177` | `61,321 B` |
| `PATH` | `0x6FD86030`, `0x6FD86230`, `0x6FD84F80`, `0x6FD849D0` | `104` | `45` | `59` | `16,829 B` |

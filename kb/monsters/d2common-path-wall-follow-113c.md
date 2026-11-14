# `D2Common.dll` 1.13c Wall-Follow Subpath Finder (`PATH_FindSubpathWithoutObstacles` @ `0x6FD68830`)

## Binary Ground Truth (`D2Common.dll` v1.13c)

- **Function**: `PATH_FindSubpathWithoutObstacles` (`0x6FD68830..0x6FD68C1E`)
- **Caller**: `PATH_ComputePathOrSlideAlongObstacles` (`0x6FD68C40`, `PATHTYPE_WALL_FOLLOW = 15`), invoked directly or as the automatic fallback in `sub_6FD5DB70` (`D2Common_10226` -> `D2Common_10236`) whenever a `PATHTYPE_TOWARD` (`2`) / `PATHTYPE_TOWARD_FINISH` (`13`) step is blocked by an obstacle or unit.

### 1. Stack Frame & `D2PathMovStrc` Layout (`0x6FD68843..0x6FD68942`)

Two `D2PathMovStrc` probe states (`tCache1` = clockwise / `ebx`, `tCache2` = counter-clockwise / `edi`) are allocated on the stack:
- `tCache1` at `[esp+0x368]`
- `tCache2` at `[esp+0x20]`

| Offset | `tCache1` (`esp+...`) | `tCache2` (`esp+...`) | Field | Type |
|---|---|---|---|---|
| `+0x00` | `0x368` | `0x20` | `nDirectionIndex` | `int32` |
| `+0x04` | `0x36c` | `0x24` | `nPoints` | `int32` |
| `+0x08` | `0x370` | `0x28` | `tCurrentCoord` | `D2PathPointStrc` (`uint16 X, Y`) |
| `+0x0c` | `0x374` | `0x2c` | `tTargetCoord` | `D2PathPointStrc` (`uint16 X, Y`) |
| `+0x10` | `0x378` | `0x30` | `bReachedDeadEnd` | `BOOL` (`int32`) |
| `+0x14` | `0x37c` | `0x34` | `pPrevDirection` | `const int32*` (`0x6FDE5158` / `0x6FDE5118`) |
| `+0x18` | `0x380` | `0x38` | `pNextDirection` | `const int32*` (`0x6FDE50D8` / `0x6FDE5098`) |
| `+0x1c` | `0x384` | `0x3c` | `nLastSyncPointWithOtherPathIndex` | `int32` |
| `+0x20` | `0x388` | `0x40` | `bPathFinished` | `BOOL` (`int32`) |
| `+0x24` | `0x38c` | `0x44` | `pPoints[200]` | `D2PathPointStrc[200]` |

### 2. Loop Back-Edge Condition (`0x6FD68A97..0x6FD68AB9`)

```asm
6fd68a97: 39 53 1c               cmp    DWORD PTR [ebx+0x1c],edx       ; pCurPath->nLastSyncPointWithOtherPathIndex == 0?
6fd68a9a: 75 0a                  jne    0x6fd68aa6                     ; if != 0, DO NOT swap pCurPath and pOtherPath
6fd68a9c: 89 7c 24 1c            mov    DWORD PTR [esp+0x1c],edi
6fd68aa0: 8b fb                  mov    edi,ebx
6fd68aa2: 8b 5c 24 1c            mov    ebx,DWORD PTR [esp+0x1c]
6fd68aa6: 39 94 24 88 03 00 00   cmp    DWORD PTR [esp+0x388],edx      ; tCache1.bPathFinished == 0? (edx == 0)
6fd68aad: 75 0a                  jne    0x6fd68ab9                     ; if tCache1.bPathFinished != 0 -> EXIT LOOP
6fd68aaf: 39 54 24 40            cmp    DWORD PTR [esp+0x40],edx       ; tCache2.bPathFinished == 0?
6fd68ab3: 0f 84 97 fe ff ff      je     0x6fd68950                     ; if tCache2.bPathFinished == 0 -> CONTINUE LOOP
6fd68ab9: 83 7d 1c 50            cmp    DWORD PTR [ebp+0x1c],0x50      ; nMaxLength > 80
```

- **1.13c Binary Condition**: `while (!tCache1.bPathFinished && !tCache2.bPathFinished)` — the loop terminates as soon as **either** `tCache1` or `tCache2` sets `bPathFinished = 1`.
- **D2MOO Decompilation Bug (`PathWF.cpp`)**: D2MOO decompiled this loop condition as `while (!(tCache1.bPathFinished && tCache2.bPathFinished))` (continuing until **both** probes finish).
  - Under D2MOO's condition, whenever `pCurPath.tTargetCoord == pOtherPath.tCurrentCoord` (with `pOtherPath.nPoints > 1`), `pCurPath.nLastSyncPointWithOtherPathIndex` is set to `pOtherPath.nPoints` (`> 0`).
  - Because `nLastSyncPointWithOtherPathIndex != 0`, `pCurPath` and `pOtherPath` are **not** swapped at `0x6FD68A97`.
  - If `pCurPath.bPathFinished` becomes `true` (either at `0x6FD68A89` when `pCurPath.nPoints >= nMaxLength - subState.nMaxIndex - 1`, or on the next iteration at `0x6FD68A8E` when `PATH_FindNonCollidingTargetPoint` returns `0` in a 4-way dead-end pocket) while `pOtherPath.bPathFinished` is still `false`, then every subsequent iteration skips `if (!pCurPath.bPathFinished)` AND skips the swap `if (pCurPath.nLastSyncPointWithOtherPathIndex == 0)`, causing an **unconditional synchronous infinite loop**.

### 3. Zero-Point Struct Underflow Read (`0x6FD68B31..0x6FD68B61`)

```asm
6fd68b31: 8b 84 24 6c 03 00 00   mov    eax,DWORD PTR [esp+0x36c]      ; eax = tCache1.nPoints
6fd68b38: 8b 84 84 88 03 00 00   mov    eax,DWORD PTR [esp+eax*4+0x388]; tCache1.pPoints[eax - 1]
...
6fd68b5d: 8b 4c 24 24            mov    ecx,DWORD PTR [esp+0x24]       ; ecx = tCache2.nPoints
6fd68b61: 8b 4c 8c 40            mov    ecx,DWORD PTR [esp+ecx*4+0x40] ; tCache2.pPoints[ecx - 1]
```

Because `pPoints[0]` is at `+0x24` (`esp+0x38c` / `esp+0x44`) and `bPathFinished` is at `+0x20` (`esp+0x388` / `esp+0x40`), indexing `pPoints[nPoints - 1]` when `nPoints == 0` reads the 32-bit `BOOL bPathFinished` as a packed `D2PathPointStrc`, yielding `{ X: bPathFinished ? 1 : 0, Y: 0 }`.

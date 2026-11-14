# Oracle Hook Points — Diablo II 1.13c (`D2Game.dll` / `D2Common.dll` / `D2Client.dll`)

Evidence for every address used by the in-process oracle (`tools/oracle/hook/d2oracle.c`).
Image bases: `D2Game.dll` `0x6FC20000`, `D2Common.dll` `0x6FD50000`, `D2Client.dll` `0x6FAB0000`.
All listings are from `samples/d2/*.dll` (objdump / capstone, Intel syntax).

## 1. Server frame driver

### 1.1 `GAME_UpdateGames` — `D2Game #10008` (`0x6FC4E1E0`)
Wall-clock frame scheduler used by the single-player client (`D2Client` imports `#10008`).

```
6fc4e1f1: call [QueryPerformanceCounter]
6fc4e1f7: call [timeGetTime]
6fc4e1fd: mov  ecx, [0x6fd31c44]        ; last frame time
6fc4e219: sub  eax, ecx
6fc4e21b: mov  ecx, [0x6fd31f70]        ; frame length (ms)
6fc4e221: cmp  eax, ecx
6fc4e223: jge  0x6fc4e22e               ; < 1 frame elapsed -> return 0
6fc4e249: mov  ebx, 0x6fd30c08          ; game slot table (0x6fd30c08..0x6fd31c08)
6fc4e264: call 0x6fc4aae0               ; lock + resolve pGame
6fc4e2db: call 0x6fc4e050               ; GAME_UpdateGameFrame(eax = pGame)   <-- hooked
```

### 1.2 Single-step path — `D2Game #10002` (`0x6FC729F0`) -> `0x6FC726F0`
```
6fc72a18: call 0x6fc726f0
6fc72702: call 0x6fc4aae0
6fc72712: call 0x6fc4e050               ; GAME_UpdateGameFrame                <-- hooked
```

### 1.3 `GAME_UpdateGameFrame` — `0x6FC4E050` (register arg `eax = pGame`, no stack args)
```
6fc4e050: push esi
6fc4e051: mov  esi, eax
6fc4e053: mov  edx, [esi+0xa8]
6fc4e05f: inc  edx
6fc4e063: mov  [esi+0xa8], edx          ; pGame->dwGameFrame++
6fc4e0c4: call 0x6fc4ca20               ; per-frame sub-updates follow
...
6fc4e0ee: mov  eax, [esi+0xa8] ; idiv 0x14 / 0xc / 0xb -> periodic work every 20 / 12 / 11 frames
6fc4e15c: ret
```
The oracle redirects both call sites (`0x6FC4E2DB`, `0x6FC72712`) through a naked stub that
calls the original and then samples the game **after** the frame completed, so trace frame `N`
is the state at the end of `pGame->dwGameFrame == N`.

## 2. `D2GameStrc` fields used

| Offset | Meaning | Evidence |
|---|---|---|
| `+0x7C` | `dwInitSeed` (game seed) | `6fc4a962: mov [edi+0x7c], eax` in `GAME_InitSeed` (`0x6FC4A900`) |
| `+0x84` | seed came from override (1) / QPC (0) | `6fc4a914` / `6fc4a972` |
| `+0xA8` | `dwGameFrame` | §1.3 |
| `+0xD0` | `D2SeedStrc` game RNG `{lo, hi}` | `6fc4a924: lea esi, [edi+0xd0]`; `mul 0x6ac690c5` at `6fc4a945` |
| `+0x1120 + list*0x200 + (id & 0x7F)*4` | 5 unit hash lists, 128 buckets each. **Not indexed by `dwType`**: observed in the running game (oracle `list_histogram`): list 0 players, list 1 monsters, list 2 objects, list 3 items (`dwType` 4), list 4 missiles (`dwType` 3; 32 missiles observed during the sorceress scenario, empty in town). Tiles (`dwType` 5) are not hashed here. Lookup switch over the 5 lists at `0x6FC4B1B8` (jump table `0x6FC4B330`). Missiles: see §2.1 | `6fc3e443: and edx, 0x7f` / `6fc3e446: mov ecx, [eax+edx*4+0x1120]`; same pattern with `+0x1320/0x1520/0x1720/0x1920` at `6fc35952`, `6fc58738`, `6fc5609c`, `6fc5e80e` |

### 2.1 Unit type ids vs. lists
`D2UnitStrc.dwType`: 0 player, 1 monster, 2 object, 3 missile, 4 item, 5 tile. The oracle scans all
5 lists and groups rows by `dwType`, and `t3` is populated from list 4 (confirmed with `p52-sorceress-elemental`).
`SUNIT_GetNewUnitId` (`0x6FCFF9C0`) keeps one counter per `dwType` at `pGame+0x90+type*4`
(first id 1, wraps `-1 -> 1`).

## 3. Game seed override

`GAME_InitSeed` (`0x6FC4A900`, called from game creation `0x6FC4C75A`):
```
6fc4a900: mov  eax, [0x6fd2e354]        ; override seed
6fc4a908: cmp  eax, -1
6fc4a90c: jne  0x6fc4a96a
6fc4a91e: call [QueryPerformanceCounter] ; default: seed from QPC
...
6fc4a96a: lea  esi, [edi+0xd0]
6fc4a972: mov  dword [edi+0x84], 1
6fc4a97c: mov  [edi+0x7c], eax          ; dwInitSeed = override
```
Setter `D2Game #10017` (`0x6FC4A210`): `mov eax,[esp+4]; mov [0x6fd2e354],eax; ret 4`.
`D2Client` calls it from `0x6FAF1D7B` with `[ecx+0x216]` of the launch config when non-zero; `Game.exe`
carries a `seed` command-line switch, so `Game.exe -seed N` pins the game seed. The oracle logs
`initSeed`/`seedOverride` on the first traced frame to prove the override took effect.

## 4. `D2UnitStrc` fields used

| Offset | Meaning | Evidence |
|---|---|---|
| `+0x00` | `dwType` | `D2Common 0x6FD51050: mov eax,[ecx]; cmp eax,2 ...` |
| `+0x04` | `dwClassId` | layout shared with all unit accessors |
| `+0x0C` | `dwUnitId` | `6fc3e451: cmp [ecx+0xc], ebp` (hash lookup by id) |
| `+0x10` | `dwMode` | |
| `+0x20/+0x24` | `D2SeedStrc` unit RNG `{lo, hi}` | `D2Common 6fd7a7a6: mov [esi+0x20],eax; mov [esi+0x24],0x29a` |
| `+0x2C` | path (dynamic for types 0/1/3, static for 2/4/5) | §5 |
| `+0xE4` | next unit in the game hash bucket | `6fc3e456: mov ecx, [ecx+0xe4]` |

## 5. Unit position (`D2Common` `0x6FD51050` GetUnitX / `0x6FD51080` GetUnitY)
```
6fd51050: mov eax,[ecx]          ; type
6fd51052: cmp eax,2 ; je static
6fd51057: cmp eax,3 ; jle dynamic
6fd5105c: cmp eax,5 ; jle static
6fd51061: mov eax,[ecx+0x2c] ; movzx eax, word [eax+0x2]   ; dynamic wPosX
6fd51070: mov eax,[ecx+0x2c] ; mov eax, [eax+0xc]          ; static X
6fd51098: movzx eax, word [eax+6]                           ; dynamic wPosY
6fd510a3: mov eax, [eax+0x10]                               ; static Y
```

## 6. Stat reads & per-frame DoT / StatRegen hook (`dot`)
`D2Common #10973` (`0x6FD88B70`, `STATLIST_GetUnitStat`, accrued, `stdcall(unit, stat, layer)`, `ret 0xc`),
`#10587` (`0x6FD88C20`, base stat), and `#10887` (`0x6FD893D0`, `STATLIST_SetUnitStat`, `stdcall(unit, stat, val, layer)`, `ret 0x10`, imported in `D2Game.dll` via thunk `0x6FC2A472`). See also `progression/d2game-levelup-vitals-gold-113c.md`.

### 6.1 Per-frame `stat 6` (`HP`) DoT / StatRegen tick hook (`dot_setstat_hook`)
Per-frame poison ticks, burning-ground / negative `STAT_HPREGEN` (`74`) ticks, and positive `STAT_HPREGEN`
(`damageRegen` / `Replenish Life`) ticks bypass `SUNITDMG_CalcDamageResists` (`0x6FCFC0B0`) and write
`STAT_HITPOINTS` (`6`) directly through `D2Common.#10887`:
```
6fc9684a: e8 23 3c f9 ff   call 0x6fc2a472   ; MONSTER_Event3_HpRegen (0x6FC96740) -> STATLIST_SetUnitStat(pUnit, 6, newHp, 0)
6fc97d12: e8 5b 27 f9 ff   call 0x6fc2a472   ; PLAYER_UpdateHpRegen   (0x6FC97CB0) -> STATLIST_SetUnitStat(pPlayer, 6, newHp, 0)
```
`d2oracle.c` redirects both `E8` call sites via `patch_call(..., G(0x6FC2A472), dot_setstat_hook)` while leaving
`apply_damage_hook` (`0x6FCFC0B0`) untouched. `dot_setstat_hook` snapshots `hp0 = p_GetUnitStat(u, 6, 0)` before
calling `p_SetUnitStat(u, stat, val, layer)` and appends `[dwType, dwUnitId, hp0, val]` to `g_dotlog` whenever
`u && stat == 6 && val != hp0`. Traces recorded with this hook emit `"dot":true` in the frame-1 header and
`"dot":[[type,id,hp0,hp1],...]` on any frame with `g_dotn > 0`. Full disassembly: [`../combat/d2game-statregen-dot-113c.md`](../combat/d2game-statregen-dot-113c.md).

## 7. Time sources inside `D2Game.dll`
`GetTickCount` (IAT `0x6FD18D10`, 30+ call sites), `timeGetTime` (`0x6FD18D60`, only `#10008`),
`QueryPerformanceCounter` (`0x6FD18D08`: game seed fallback, frame profiling). The frame counter,
not wall time, drives simulation; residual `GetTickCount` users are audited in the oracle
determinism check (3 identical runs).

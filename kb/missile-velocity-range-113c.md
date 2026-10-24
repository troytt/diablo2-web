# Diablo II 1.13c Missile Velocity, Acceleration, Range, SubLoop & Creation-Time Slow Missiles (`D2Game.dll` & `D2Common.dll`)

## 1. Authoritative Binary Evidence

- **`D2Game.dll` (image base `0x6FC20000`)**:
  - `MISSILE_CreateMissileFromParams`: `0x6FC8F930` .. `0x6FC8FEBD`
  - `MISSMODE_MoveMissile`: `0x6FC5F320` .. `0x6FC5F750`
- **`D2Common.dll` (image base `0x6FD50000`)**:
  - `PATH_SetAcceleration`: `0x6FD84CE0`
  - `PATH_SetMaxVelocity`: `0x6FD84D10`
  - `PATH_SetVelocity`: `0x6FD84D40`
  - `PATH_StepVelocity`: `0x6FD5CEB0` (called at the start of `PATH_Step` `0x6FD5E230`)

---

## 2. Missile Velocity Initialization (`0x6FC8F9FF` .. `0x6FC8FB5A`)

### 2.1 Base Fixed-Point Velocity (`Vel + trunc(VelLev * slvl / 8)`)

In `MISSILE_CreateMissileFromParams` (`0x6FC8F9FF` .. `0x6FC8FA36`), when creation flag `0x04` (explicit velocity override) is not set:

```asm
6fc8fa15: 0f b6 91 9b 00 00 00  movzx  edx,BYTE PTR [ecx+0x9b] ; MissilesTxt.VelLev (uint8)
6fc8fa1c: 0f af 55 30           imul   edx,DWORD PTR [ebp+0x30] ; * slvl
6fc8fa20: 8b c2                 mov    eax,edx
6fc8fa22: 99                    cdq
6fc8fa23: 83 e2 07              and    edx,0x7
6fc8fa26: 03 c2                 add    eax,edx
6fc8fa28: 0f b6 91 9a 00 00 00  movzx  edx,BYTE PTR [ecx+0x9a] ; MissilesTxt.Vel (uint8)
6fc8fa2f: c1 f8 03              sar    eax,0x3                  ; trunc((VelLev * slvl) / 8)
6fc8fa32: 03 c2                 add    eax,edx                  ; + Vel
6fc8fa34: c1 e0 08              shl    eax,0x8                  ; vel256 = rawVel << 8
```

- Formula:
  $$\text{vel256} = \left(\text{Vel} + \left\lfloor \frac{\text{VelLev} \cdot \text{slvl}}{8} \right\rfloor\right) \ll 8$$
- There is no lower-bound clamp (such as `max(8, Vel)`); slow missiles like `moltenboulder` (`Vel = 4`) use their exact `Missiles.txt` velocity.

### 2.2 Creation-Time One-Shot `Slow Missiles` Scaling (`0x6FC8FA54` .. `0x6FC8FA9F`)

Immediately after computing initial `vel256`, `MISSILE_CreateMissileFromParams` checks `MissilesTxt.dwFlags` byte `+0x04` bit `0x20` (`CanSlow`) and whether `pOwner` currently has `STATE_SLOWMISSILES` (`87`):

```asm
6fc8fa54: f6 41 05 20           test   BYTE PTR [ecx+0x5],0x20  ; MissilesTxt.CanSlow
6fc8fa58: 74 49                 je     6fc8faa3
6fc8fa5a: 6a 57                 push   0x57                     ; STATE_SLOWMISSILES (87)
6fc8fa5c: 57                    push   edi                      ; pOwner
6fc8fa5d: e8 da 23 09 00        call   6fd21e3c                 ; STATES_CheckStateMaskStayOnUnit
...
6fc8fa69: 6a 00                 push   0x0
6fc8fa6b: 6a 57                 push   0x57                     ; STATE_SLOWMISSILES (87)
6fc8fa6d: 57                    push   edi                      ; pOwner
6fc8fa6e: e8 f7 23 09 00        call   6fd21e6a                 ; D2Common.#10871 (get state StatList)
...
6fc8fa79: 6a 00                 push   0x0
6fc8fa7b: 68 a1 00 00 00        push   0xa1                     ; STAT_SKILL_HANDOFATHENA (161)
6fc8fa80: 50                    push   eax                      ; pStatList
6fc8fa81: e8 88 26 09 00        call   6fd2210e                 ; D2Common.#10680 (STATLIST_GetStatValue)
6fc8fa86: 0f af c6              imul   eax,esi                  ; handOfAthena * vel256
6fc8fa89: b9 64 00 00 00        mov    ecx,0x64                 ; / 100
6fc8fa8e: 99                    cdq
6fc8fa8f: f7 f9                 idiv   ecx
6fc8fa95: 8b f0                 mov    esi,eax
```

- `Slow Missiles` is evaluated **once at creation** and baked into `vel256`.
- Neither `MISSMODE_MoveMissile` (`0x6FC5F320`) nor `PATH_Step` (`0x6FD5E230`) re-queries `pOwner`'s `slowmissiles` state while the missile is in flight.

### 2.3 Unified 75% Velocity Multiplier (`0x6FC8FAA3` .. `0x6FC8FAB8`)

For every missile with `vel256 != 0`, `MISSILE_CreateMissileFromParams` applies a global `75 / 100` factor before assigning the path velocity:

```asm
6fc8faa3: 85 f6                 test   esi,esi
6fc8faa5: 74 13                 je     6fc8faba
6fc8faa7: 8d 04 76              lea    eax,[esi+esi*2]
6fc8faaa: 8d 04 80              lea    eax,[eax+eax*4]
6fc8faad: 8d 04 80              lea    eax,[eax+eax*4]          ; eax = vel256 * 75
6fc8fab0: b9 64 00 00 00        mov    ecx,0x64                 ; / 100
6fc8fab5: 99                    cdq
6fc8fab6: f7 f9                 idiv   ecx
6fc8fab8: 8b f0                 mov    esi,eax
```

### 2.4 Path Velocity, `Accel`, and `MaxVel` (`0x6FC8FB13` .. `0x6FC8FB5A`)

```asm
6fc8fb13: 56                    push   esi                      ; vel256
6fc8fb14: 50                    push   eax                      ; pPath
6fc8fb15: e8 c2 22 09 00        call   6fd21ddc                 ; PATH_SetVelocity (0x6FD84D40)
...
6fc8fb37: 8b 91 9c 00 00 00     mov    edx,DWORD PTR [ecx+0x9c] ; MissilesTxt.Accel (int32)
6fc8fb3d: 85 d2                 test   edx,edx
6fc8fb3f: 74 19                 je     6fc8fb5a
6fc8fb41: 52                    push   edx
6fc8fb42: 50                    push   eax
6fc8fb43: e8 fa 22 09 00        call   6fd21e42                 ; PATH_SetAcceleration (0x6FD84CE0)
6fc8fb48: 8b 4c 24 1c           mov    ecx,DWORD PTR [esp+0x1c]
6fc8fb4c: 0f b6 81 99 00 00 00  movzx  eax,BYTE PTR [ecx+0x99] ; MissilesTxt.MaxVel (uint8)
6fc8fb53: c1 e0 08              shl    eax,0x8                  ; MaxVel << 8
6fc8fb56: 50                    push   eax
6fc8fb57: 56                    push   esi
6fc8fb58: e8 d1 24 09 00        call   6fd2202e                 ; PATH_SetMaxVelocity (0x6FD84D10)
```

---

## 3. Per-Frame Velocity Progression (`D2Common.dll` `0x6FD5CEB0`)

At each frame step in `PATH_Step` (`0x6FD5E230`), `PATH_StepVelocity` (`0x6FD5CEB0`) updates `nVelocity` (`[eax+0x28]`) by `nAcceleration` (`[eax+0x30]`) and clamps against `nMaxVelocity` (`[eax+0x2C]`):

```asm
6fd5ceb3: 8b 48 30              mov    ecx,DWORD PTR [eax+0x30] ; nAcceleration
6fd5ceb6: 85 c9                 test   ecx,ecx
6fd5ceb8: 74 28                 je     6fd5cee2
6fd5ceba: 8b 50 28              mov    edx,DWORD PTR [eax+0x28] ; nVelocity
6fd5cebd: 03 d1                 add    edx,ecx                  ; nVelocity += nAcceleration
6fd5cebf: 85 c9                 test   ecx,ecx
6fd5cec1: 89 50 28              mov    DWORD PTR [eax+0x28],edx
6fd5cec4: 7e 0b                 jle    6fd5ced1
6fd5cec6: 8b 48 2c              mov    ecx,DWORD PTR [eax+0x2c] ; nMaxVelocity
6fd5cec9: 3b d1                 cmp    edx,ecx
6fd5cecb: 7e 15                 jle    6fd5cee2
6fd5cecd: 89 48 28              mov    DWORD PTR [eax+0x28],ecx ; clamp to nMaxVelocity
6fd5ced1: 85 d2                 test   edx,edx
6fd5ced3: 7d 0d                 jge    6fd5cee2
6fd5ced5: c7 40 28 00 00 00 00  mov    DWORD PTR [eax+0x28],0x0 ; clamp to 0 when negative
```

- Examples:
  - `nova` (`Vel = 24, MaxVel = 24, Accel = -1000`): starts at `vel256 = trunc((6144 * 75) / 100) = 4608` (`18 px/tick`) and decreases by `1000` (`3.90625 px/tick`) each frame down to `0`.
  - `blessedhammer` (`Vel = 18, MaxVel = 30, Accel = 250`): starts at `vel256 = trunc((4608 * 75) / 100) = 3456` (`13.5 px/tick`) and increases by `250` each frame up to `maxVel256 = 30 << 8 = 7680` (`30 px/tick`).

---

## 4. Missile Range & `SubLoop` Calculation (`0x6FC8FC75` .. `0x6FC8FCC8`)

When creation flag `0x08` (explicit range override) is not set:

```asm
6fc8fc7d: 8b 55 30              mov    edx,DWORD PTR [ebp+0x30] ; slvl
6fc8fc80: 0f bf 81 a2 00 00 00  movsx  eax,WORD PTR [ecx+0xa2]  ; MissilesTxt.LevRange (int16)
6fc8fc87: 0f af c2              imul   eax,edx                  ; slvl * LevRange
6fc8fc8a: 0f bf 91 a0 00 00 00  movsx  edx,WORD PTR [ecx+0xa0]  ; MissilesTxt.Range (int16)
6fc8fc90: f6 41 04 04           test   BYTE PTR [ecx+0x4],0x4   ; MissilesTxt.SubLoop
6fc8fc94: 03 c2                 add    eax,edx                  ; Range + slvl * LevRange
6fc8fc96: 74 30                 je     6fc8fcc8
6fc8fc98: 8b 55 34              mov    edx,DWORD PTR [ebp+0x34] ; nLoops
6fc8fc9b: 85 d2                 test   edx,edx
6fc8fc9d: 7e 29                 jle    6fc8fcc8
6fc8fc9f: 0f b6 99 dc 00 00 00  movzx  ebx,BYTE PTR [ecx+0xdc] ; MissilesTxt.SubStop (uint8)
6fc8fca6: 0f b6 89 db 00 00 00  movzx  ecx,BYTE PTR [ecx+0xdb] ; MissilesTxt.SubStart (uint8)
6fc8fcad: 2b d9                 sub    ebx,ecx                  ; SubStop - SubStart
6fc8fcaf: 0f af da              imul   ebx,edx                  ; * nLoops
6fc8fcb2: 03 c3                 add    eax,ebx                  ; + (SubStop - SubStart) * nLoops
```

- Formula:
  $$\text{range} = \text{Range} + \text{LevRange} \cdot \text{slvl} + \begin{cases} (\text{SubStop} - \text{SubStart}) \cdot \text{nLoops} & \text{if } \text{SubLoop} \ne 0 \land \text{nLoops} > 0 \\ 0 & \text{otherwise} \end{cases}$$
- Note that `LevRange` multiplies `slvl` directly (not `slvl - 1`). For `firewallmaker` (`Range = 7, LevRange = 2`), `slvl = 1` gives `7 + 2 * 1 = 9` frames, and `slvl = 5` gives `7 + 2 * 5 = 17` frames.

# 1.13c Preset Objects & Super Chests (`0x6FC522B0` / `0x6FC531B0`)

## Overview & Architecture

In Diablo II: Lord of Destruction v1.13c, map presets place placeholder object indexes (`574..582` in `Objects.txt`). When rooms and levels are initialized, `D2Game.dll` translates these pseudo-objects into actual interactive world objects using the game's authoritative PRNG (`pGame->pGameSeed`).

## Binary Ground Truth

### 1. Preset Chest Class Resolution: `0x6FC522B0`

Disassembly from `samples/d2/D2Game.dll`:
```assembly
6fc522b0: sub esp, 0x4c
...
6fc522cb: mov esi, [ebx+0x10f0]        ; pGame->pGameSeed
6fc522ea: mov ecx, 0x6ac690c5          ; 1.13c D2 PRNG multiplier
...
; Act 1 / Act 4 / Act 5:
6fc52305: mov ecx, 0xd                 ; 13 candidates
6fc5230c: div ecx                      ; edx = rand(13)
; Candidate array:
; 5, 6, 139 (0x8b), 140 (0x8c), 141 (0x8d), 144 (0x90),
; 176 (0xb0), 177 (0xb1), 198 (0xc6), 240 (0xf0), 241 (0xf1), 242 (0xf2), 243 (0xf3)

; Act 2:
; If areaId == 74 (Arcane Sanctuary):
;   rand(4) (and eax, 3) from [387, 389, 390, 391] (0x183, 0x185, 0x186, 0x187)
; Else:
;   rand(2) (and eax, 1) from [87, 88] (0x57, 0x58)

; Act 3:
; If areaId == 83 (Travincal):
;   rand(4) (and eax, 3) from [329, 330, 331, 332] (0x149, 0x14a, 0x14b, 0x14c)
; Else:
;   rand(2) (and eax, 1) from [181, 183] (0xb5, 0xb7)
```

### 2. Super Chest Resolution & Maggot Lair: `0x6FC531B0`

```assembly
6fc531b0: push ebx
...
6fc531bf: cmp ebx, 0x19                ; areaId == 25 (Sunken Passage Level 2)
6fc531c2: mov eax, 0x173               ; classId = 371
...
; Maggot Lair Level 1..3 (areaId 62..64 / 0x3e..0x40):
6fc531ec: cmp ebx, 0x3e
6fc531ef: jl 0x6fc53223
6fc531f1: cmp ebx, 0x40
6fc531f4: jg 0x6fc53223
6fc531f6: mov ecx, [edi+0x10f0]        ; pGameSeed
6fc53216: mov ecx, 100
6fc5321b: div ecx                      ; edx = rand(100) (0..99)
6fc5321e: cmp edx, 50                  ; cmp edx, 0x32
6fc53221: jg 0x6fc53233                ; if edx > 50, skip sparkling!
6fc53223: mov byte ptr [esi+0x78], 1   ; isSparkling = true!
```

Key observations:
1. **Maggot Lair 51% Super Chest Rate**: `cmp edx, 50; jg skip` means values `0..50` succeed, giving exactly `51 / 100 = 51%` chance of sparkling super chest, rather than a 50/50 bit check.
2. **Game RNG Only**: No coordinate spatial hashing (`Math.imul(subX, ...)`) exists in 1.13c; chest variation is strictly driven by the game session's PRNG.
3. **MonStats Killable & NPC**: Monster preset spawn evaluates `row.npc` and `row.killable` directly from `MonStats.txt`, rejecting unknown monster codes without permissive defaults.

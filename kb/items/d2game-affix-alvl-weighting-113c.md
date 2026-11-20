# 1.13c Affix Level (`alvl`) Formula & `magic lvl` Weighting (`D2Game.dll` `0x6FC344D0`)

## Binary Ground Truth (`samples/d2/D2Game.dll`, ImageBase `0x6FC20000`)

`ITEMS_RollAffix` at `0x6FC344D0` (`__stdcall`, 7 arguments) is shared by Magic item affix generation (`0x6FC303C0`), Rare item affix generation (`0x6FC35240`), and AutoMagic affix generation (`0x6FC30FCB -> 0x6FC34B50 -> 0x6FC344D0`).

### 1. Affix Level (`alvl`) Calculation (`0x6FC34604..0x6FC34657`)

Disassembly (`0x6FC34600..0x6FC34657`):

```asm
6fc34600: 8b 68 74              mov    ebp,DWORD PTR [eax+0x74]        ; ebp = qlvl (ItemsTxt.dwLevel)
6fc34603: 57                    push   edi
6fc34604: 3b f5                 cmp    esi,ebp                         ; esi = ilvl
6fc34606: 7f 02                 jg     0x6fc3460a
6fc34608: 8b f5                 mov    esi,ebp                         ; esi = i = max(ilvl, qlvl)
6fc3460a: 8a 80 40 01 00 00     mov    al,BYTE PTR [eax+0x140]         ; al = magicLvl (ItemsTxt.nMagicLevel)
6fc34610: 84 c0                 test   al,al
6fc34612: 74 09                 je     0x6fc3461d
6fc34614: 0f b6 c0              movzx  eax,al
6fc34617: 03 c6                 add    eax,esi                         ; magicLvl > 0: alvl = i + magicLvl
6fc34619: 8b f0                 mov    esi,eax
6fc3461b: eb 1f                 jmp    0x6fc3463c
6fc3461d: 8b c5                 mov    eax,ebp
6fc3461f: 99                    cdq
6fc34620: 2b c2                 sub    eax,edx
6fc34622: d1 f8                 sar    eax,1                           ; eax = trunc(qlvl / 2)
6fc34624: b9 63 00 00 00        mov    ecx,0x63                        ; ecx = 99
6fc34629: 2b c8                 sub    ecx,eax                         ; ecx = 99 - trunc(qlvl / 2)
6fc3462b: 3b f1                 cmp    esi,ecx
6fc3462d: 7d 04                 jge    0x6fc34633
6fc3462f: 2b f0                 sub    esi,eax                         ; i < 99 - trunc(qlvl / 2): alvl = i - trunc(qlvl / 2)
6fc34631: eb 09                 jmp    0x6fc3463c
6fc34633: 2b c6                 sub    eax,esi
6fc34635: 03 c9                 add    ecx,ecx
6fc34637: 03 c8                 add    ecx,eax
6fc34639: 2b f1                 sub    esi,ecx                         ; i >= 99 - trunc(qlvl / 2): alvl = 2 * i - 99
6fc3463b: 90                    nop
6fc3463c: 83 fe 01              cmp    esi,0x1                         ; clamp alvl to [1, 99]
```

Exact formula:

1. `i = max(ilvl, qlvl)`
2. If `magicLvl > 0`: `alvl = i + magicLvl`
3. Else if `i < 99 - trunc(qlvl / 2)`: `alvl = i - trunc(qlvl / 2)`
4. Else: `alvl = 2 * i - 99`
5. Clamp `alvl` to `[1, 99]`.

### 2. Candidate Weight & `rand(totalWeight + 1)` Selection (`0x6FC3478B..0x6FC34889`)

When building the candidate affix pool:

- At `0x6FC3478B..0x6FC347B0`:
  - If `ItemsTxt.nMagicLevel != 0` (`magic lvl > 0` in `weapons.txt` / `armor.txt`, such as wands, staves, orbs, and circlets `ci0..ci3`):
    - Candidate weight is `frequency * level` (`movzx eax, BYTE PTR [esi+0x22]; imul eax, DWORD PTR [esi-0x8]`).
  - If `ItemsTxt.nMagicLevel == 0`:
    - Candidate weight is `frequency` (`movzx ecx, BYTE PTR [esi+0x22]`).
- At `0x6FC347E2`: if `totalWeight <= 0`, returns `0` (`null`) immediately without any uniform fallback.
- At `0x6FC347FC..0x6FC34889`:
  - Increments `totalWeight` by 1 (`mov esi, [esp+0x10]; inc esi`) and rolls `roll = rand(totalWeight + 1)` (`call 0x6FC21480`).
  - Iterates through candidates subtracting each candidate's weight (`frequency * level` or `frequency`) and selects the candidate when `roll < 0` (`jl 0x6FC34853`).
  - When the initial `roll == totalWeight`, subtracting all candidate weights leaves `roll == 0` (not `< 0`), and the function returns `0` (no affix selected).

### 3. Magic Item Prefix/Suffix Slot Distribution (`0x6FC303C0` + `0x6FC344D0`)

In `ITEMS_RollMagicQuality` (`0x6FC303C0..0x6FC304E0`):

1. Calls `ITEMS_RollAffix` (`0x6FC344D0`) for the **Prefix** slot with `bForce = 0` (`0x6FC30408: push edi` where `edi = 0`), `bIsPrefix = 1`, `bRare = 0`.
   - Inside `0x6FC344D0` (`0x6FC3458A..0x6FC345C8`), it rolls `rand(2)` (`and eax, 1`). If the result is `0` and `bForce == 0`, it returns `0` immediately (50% chance to skip prefix).
2. At `0x6FC30432..0x6FC3043F`: if the prefix roll returned `0` (`test bx, bx; jne 0x6FC30441; mov DWORD PTR [esp+0x10], 1`), it sets `bForceSuffix = 1`.
3. At `0x6FC3046D..0x6FC30481`: calls `ITEMS_RollAffix` (`0x6FC344D0`) for the **Suffix** slot with `bForce = bForceSuffix`, `bIsPrefix = 0`, `bRare = 0`.
   - When prefix was skipped or failed (`bForceSuffix == 1`), suffix is forced without rolling `rand(2)`.
   - When prefix succeeded (`bForceSuffix == 0`), suffix rolls `rand(2)` (50% chance).

Assuming non-empty candidate pools on both sides, the resulting Magic affix distribution is:
- **Prefix only**: `1/2 * 1/2 = 1/4` (**25%**)
- **Suffix only**: `1/2 * 1 = 1/2` (**50%**)
- **Prefix + Suffix**: `1/2 * 1/2 = 1/4` (**25%**)

### 4. Rare Item Affix Count & Side Selection (`0x6FC35240` Expansion / `0x6FC34F20` Classic)

`0x6FC30780` dispatches Rare item generation to `0x6FC35240` when `pGame->bExpansion != 0`, or `0x6FC34F20` in Classic.

- **Rare Jewels (`ItemType == 58` `'jewl'`)**:
  - At `0x6FC352C4..0x6FC352DF` (Expansion) and `0x6FC34FA3..0x6FC34FBE` (Classic): checks `D2Common_GetItemType(pItem) == 0x3A` (`58`, `'jewl'`).
  - Rolls `totalAffixes = 3 + (rand() & 1)` (`3..4` affixes, 50% each).
- **Other Rare Items (Expansion `0x6FC352E5..0x6FC35302`)**:
  - Indexes the 8-entry lookup table at `.rdata` `0x6FD1D058` using `rand() & 7`:
    `RARE_AFFIX_COUNT_TABLE = [3, 4, 4, 5, 5, 5, 6, 6]`
  - Distribution: **3 affixes = 1/8 (12.5%)**, **4 affixes = 2/8 (25%)**, **5 affixes = 3/8 (37.5%)**, **6 affixes = 2/8 (25%)**.
- **Other Rare Items (Classic `0x6FC34FC0..0x6FC34FDC`)**:
  - Rolls `totalAffixes = 4 + rand(3)` (`4..6` affixes, 1/3 each).
- **Per-Slot Side Selection & Failure Retry (`0x6FC35330..0x6FC35430`)**:
  - Maintains `prefixFull` and `suffixFull` flags (initially `false`).
  - When neither side is full, rolls `rand() & 1`: `0` selects Prefix, `1` selects Suffix.
  - When a side reaches 3 affixes, marks that side full so subsequent slots go directly to the opposite side without consuming an RNG step.
  - When `ITEMS_RollAffix(..., bForce=1, bRare=1)` returns `0` (no eligible affix left on that side), marks that side full and decrements the loop counter (`dec edi` / `slot--`) so the current slot is retried on the other side.

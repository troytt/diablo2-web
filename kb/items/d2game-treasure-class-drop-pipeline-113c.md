# D2Game 1.13c TreasureClassEx Drop Pipeline & Quality Roll Verification

**Binary Ground Truth**: `D2Game.dll` (ImageBase `0x6FC20000`, v1.13c) and `D2Common.dll` (ImageBase `0x6FD50000`, v1.13c).

---

## 1. Signed `ilvl - qlvl` Delta in `ITEMS_RollItemQuality` (`D2Game!0x6FC2FC40`)

At `0x6FC2FD0E..0x6FC2FD19`, `ITEMS_RollItemQuality` loads the base item's `nLevel` (`qlvl`, `D2ItemsTxt + 0xFD`) and subtracts it from the item's `ilvl` (`ebx`) using a signed subtraction without clamping `qlvl` to `ilvl`:

```asm
6fc2fd0e: 0f b6 86 fd 00 00 00  movzx  eax, BYTE PTR [esi+0xfd] ; eax = pItemsTxt->nLevel (qlvl)
6fc2fd15: 2b d8                 sub    ebx, eax                 ; ebx = ilvl - qlvl (signed)
6fc2fd17: 8b eb                 mov    ebp, ebx                 ; ebp = D = ilvl - qlvl
```

For each quality tier (`Unique`, `Set`, `Rare`, `Magic`, `HiQuality`, `Normal`):
1. `eax = ebp; cdq; idiv ecx` computes signed truncated division `trunc((ilvl - qlvl) / Divisor)` (`0x6FC2FD5A..0x6FC2FD5D` for Unique, `0x6FC2FDF4..0x6FC2FDFB` for Rare, `0x6FC2FE96..0x6FC2FE9D` for Set, `0x6FC2FF1D..0x6FC2FF24` for Magic, `0x6FC2FFBA..0x6FC2FFBE` for HiQuality, `0x6FC2FFF4..0x6FC2FFF8` for Normal).
2. `edx = (Value - trunc((ilvl - qlvl) / Divisor)) << 7` (`* 128`).
3. Because `D = ilvl - qlvl` is signed, when `qlvl > ilvl`, `D < 0` and subtracting a negative quotient **increases** the denominator `(Value - trunc(D / Divisor)) * 128`, lowering the probability of rolling higher quality tiers. Truncating `qlvl` with `Math.min(ilvl, qlvl)` artificially inflates Unique/Set/Rare/Magic odds on bases with `qlvl > ilvl`.

---

## 2. Base Item Exceptional/Elite Upgrade & `qlvl <= ilvl` Gate (`D2Game!0x6FC32380`, `D2Game!0x6FCF2AB0`, `D2Common!#10237`)

When a TreasureClass leaf item is selected or generated (`D2Game!0x6FC32380` / `D2Game!0x6FCF2AB0` / `D2Game!0x6FC31490`), the base item code is resolved **before** `D2Common_CreateItemUnit` allocates the `D2UnitStrc` and initializes `pItem->pSeed`. Consequently:
- Base item upgrade rolls (`UberCodeOdds` / `UltraCodeOdds` from `DifficultyLevels.txt` via `D2Common!#10237` at `0x6FDB03C0`) consume the drop/monster RNG stream before item unit creation.
- An upgraded Exceptional (`ubercode`, `D2ItemsTxt + 0x98`) or Elite (`ultracode`, `D2ItemsTxt + 0x9C`) base is only valid when the candidate base's `nLevel` (`qlvl`) satisfies `qlvl <= ilvl` (`0x6FCF2BD1..0x6FCF2BF5`: compares `BYTE PTR [esi+0xfd]` against `ilvl`). If the elite `ultracode` exceeds `ilvl`, it cannot be chosen (falling back to `ubercode` if eligible and `ubercode.qlvl <= ilvl`, or remaining `normcode`).

---

## 3. TreasureClass Group Upgrade (`D2Game!0x6FC32D60` & `D2Common!#10634` @ `0x6FDA3420`)

### 3.1 Normal Difficulty Suppression (`D2Game!0x6FC32D60`)
In `ITEMS_DropMonsterTreasureClass` (`0x6FC32D60`):
```asm
6fc32d60: 83 ec 28              sub    esp, 0x28
6fc32d63: 53                    push   ebx
6fc32d64: 8b 47 70              mov    eax, DWORD PTR [edi+0x70] ; pGame->bExpansion
6fc32d67: 55                    push   ebp
6fc32d68: 56                    push   esi
6fc32d69: 85 c0                 test   eax, eax
6fc32d6b: 74 38                 je     0x6fc32da5                ; Classic: skip TC upgrade
6fc32d6d: 8a 47 6d              mov    al, BYTE PTR [edi+0x6d]   ; pGame->nDifficulty (0=Normal, 1=NM, 2=Hell)
6fc32d70: 84 c0                 test   al, al
6fc32d72: 76 31                 jbe    0x6fc32da5                ; Normal (0): skip mlvl lookup (ebp stays 0)
```
When `bExpansion == 0` or `nDifficulty == 0` (Normal), or when the monster has `boss == 1` (`0x6FC32D87`) or `noRatio == 1` (`0x6FC32D94`), `ebp` (`mlvl`) remains `0` when passed to `D2Common!#10634`.

### 3.2 Contiguous Forward Scan (`D2Common!#10634` @ `0x6FDA3420`)
`D2Common_GetTreasureClass` (`#10634` at `0x6FDA3420`):
```asm
6fda3420: 0f b7 44 24 04        movzx  eax, WORD PTR [esp+0x4]   ; wTcId
6fda3440: 6b c0 2c              imul   eax, eax, 0x2c
6fda3443: 03 c2                 add    eax, edx                  ; eax = &sgptDataTables->pTreasureClassEx[wTcId]
6fda3448: 8b 54 24 08           mov    edx, DWORD PTR [esp+0x8]  ; edx = mlvl
6fda344c: 85 d2                 test   edx, edx
6fda344e: 7e 27                 jle    0x6fda3477                ; if (mlvl <= 0) return eax
6fda3450: 66 8b 48 02           mov    cx, WORD PTR [eax+0x2]    ; cx = pTc->nGroup
6fda3454: 66 85 c9              test   cx, cx
6fda3457: 74 1e                 je     0x6fda3477                ; if (nGroup == 0) return eax
6fda345c: 8d 48 2c              lea    ecx, [eax+0x2c]           ; next row in TreasureClassEx
6fda3464: 66 39 59 02           cmp    WORD PTR [ecx+0x2], bx    ; next->nGroup == initialGroup?
6fda3468: 75 0c                 jne    0x6fda3476
6fda346a: 0f bf 79 04           movsx  edi, WORD PTR [ecx+0x4]   ; edi = next->nLevel
6fda346e: 3b fa                 cmp    edi, edx                  ; next->nLevel <= mlvl?
6fda3470: 7f 04                 jg     0x6fda3476
6fda3472: 8b c1                 mov    eax, ecx                  ; advance eax = next
6fda3474: eb e6                 jmp    0x6fda345c
```
The scan starts at `initialNode` and steps forward through contiguous rows while `next.group === initialNode.group` and `next.level <= mlvl`.

---

## 4. Unique & Set Downgrade Durability Multipliers (`D2Game!0x6FC30A20`)

In `ITEMS_ResolveSpecialQuality` (`0x6FC30A20`):
- **Failed Unique (`0x6FC30D64..0x6FC30DF5`)**:
  1. Checks `D2Common!#10865` (`HasDurability`) at `0x6FC30D70`.
  2. Multiplies `STAT_DURABILITY` (`72`) and `STAT_MAXDURABILITY` (`73`) by **3** (`lea edx, [esi + esi*2]`, capped at `255`) at `0x6FC30D9C..0x6FC30DD5` **before** calling `ITEMS_RollRareItem` (`0x6FC30730`).
  3. Calls `0x6FC30730` (`ITEMS_RollRareItem`), which checks `D2Common!#11036` (`CanBeRare`). If `0x6FC30730` returns `0` (e.g. an item whose `ItemTypes.txt` has `Rare = 0`), `0x6FC30DF5` falls back to `0x6FC304F0` (`ITEMS_RollMagicItem`), retaining the `3x` durability multiplier on durability-bearing items.
- **Failed Set (`0x6FC30F1A..0x6FC30F96`)**:
  1. Multiplies `STAT_DURABILITY` and `STAT_MAXDURABILITY` by **2** (`add esi, esi`, capped at `255`).
  2. Calls `0x6FC304F0` (`ITEMS_RollMagicItem`).

---

## 5. Quest Container & Boss Special Drops (`D2Game!0x6FD27BB8`)

Disassembly of `gpObjectOperateFnTable` (`0x6FD27BB8`) and quest callbacks in `D2Game.dll`:
- `Objects.txt` 30 (`Inifuss`, `OperateFn 12` @ `0x6FC85B40`): drops `'bks '` (Scroll of Inifuss).
- `Objects.txt` 108 (`Malus`, `OperateFn 21` @ `0x6FC85D40`): writes `0x206D6468` (`'hdm '`, Horadric Malus) at `0x6FC85E04` and calls `0x6FC31A70`.
- `Objects.txt` 149 (`taintedsunaltar`, `OperateFn 24` @ `0x6FCE76B0`): writes `0x20706976` (`'vip '`, Amulet of the Viper) at `0x6FCE77E1` and calls `0x6FC31A70`.
- `Objects.txt` 193 (`LamTome`, `OperateFn 28` @ `0x6FD094C0`): writes `0x20626262` (`'bbb '`, Lam Esen's Tome) at `0x6FD09553` and calls `0x6FC31A70`.
- `Objects.txt` 244/246 (`ratnest`): drops `'j34 '` (Jade Figurine).
- `Objects.txt` 252 (`gidbinn`, `OperateFn 31` @ `0x6FD09C80`): drops `'g33 '` (The Gidbinn).
- `Objects.txt` 354 (`HoradricCubeChest`, `OperateFn 39` @ `0x6FCEA050`): writes `0x20786F62` (`'box '`, Horadric Cube) at `0x6FCEA068` and calls `0x6FC31A70`.
- `Objects.txt` 355 (`HoradricScrollChest`, `OperateFn 40` @ `0x6FCEA290`): writes `0x20317274` (`'tr1 '`, Horadric Scroll) at `0x6FCEA2A8` and calls `0x6FC31A70`.
- `Objects.txt` 356 (`StaffOfKingsChest`, `OperateFn 41` @ `0x6FCEA170`): writes `0x2066736D` (`'msf '`, Staff of Kings) at `0x6FCEA188` and calls `0x6FC31A70`.
- `Objects.txt` 376 (`Hellforge`, `OperateFn 49` @ `0x6FCDB8D0`): requires equipped `'hfh '` (`0x6FCDB9FE`) and 3 hits (`0x6FCDB9E0`), then drops 1 difficulty-specific rune + 1 perfect gem + 2 flawless gems + 1 normal gem at the River of Flame difficulty `ilvl` (`27` Normal, `60` Nightmare, `85` Hell).
- `Objects.txt` 405 (`KhalimChest1`, `OperateFn 57` @ `0x6FD0A5F0`): writes `0x20726871` (`'qhr '`, Khalim's Heart) at `0x6FD0A675`.
- `Objects.txt` 406 (`KhalimChest2`, `OperateFn 59` @ `0x6FD0A390`): writes `0x20726271` (`'qbr '`, Khalim's Brain) at `0x6FD0A418`.
- `Objects.txt` 407 (`KhalimChest3`, `OperateFn 58` @ `0x6FD0A4C0`): writes `0x20796571` (`'qey '`, Khalim's Eye) at `0x6FD0A548`.
- Quest Bosses:
  - Radament (`radament`, Act 2 Quest 1): drops `'ass '` (Book of Skill).
  - Travincal Council (`councilmember1..3`, Act 3 Quest 3/5): drops `'qf1 '` (Khalim's Flail).
  - Mephisto (`mephisto`, Act 3 Quest 6 / Act 4 Quest 2): drops `'mss '` (Mephisto's Soulstone) on first kill.
  - Hephasto the Armorer (`hephasto`, Act 4 Quest 2): drops `'hfh '` (Hellforge Hammer).

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

---

## 6. Negative `Picks` Deterministic Enumeration & `max(|Picks|, 1)` Frame Counter (`D2Game!0x6FC32380`)

In `ITEMS_RollTreasureClass` (`0x6FC32380`):

### 6.1 Frame Counter Initialization (`0x6FC323DE..0x6FC323F8` & `0x6FC32764..0x6FC32786`)
Both the root TC frame (`0x6FC323DE..0x6FC323F8`) and every pushed/tail-reused child sub-TC frame (`0x6FC32764..0x6FC32786`) initialize `picksRemaining = max(|Picks|, 1)`:
```asm
6fc323de: 8b 42 10          mov eax, DWORD PTR [edx+0x10]      ; eax = pTc->nPicks (signed 32-bit int)
6fc323e1: 85 c0             test eax, eax
6fc323e3: 89 54 24 38       mov DWORD PTR [esp+0x38], edx      ; stack[0].pTc = pTc
6fc323e7: 7d 02             jge 0x6fc323eb
6fc323e9: f7 d8             neg eax                            ; if (nPicks < 0) eax = -nPicks = |Picks|
6fc323eb: bf 01 00 00 00    mov edi, 0x1
6fc323f0: 3b c7             cmp eax, edi
6fc323f2: 89 44 24 3c       mov DWORD PTR [esp+0x3c], eax      ; stack[0].picksRemaining = |Picks|
6fc323f6: 7f 04             jg 0x6fc323fc
6fc323f8: 89 7c 24 3c       mov DWORD PTR [esp+0x3c], edi      ; if (|Picks| <= 1) stack[0].picksRemaining = 1
```

### 6.2 Negative `Picks` Cumulative Interval Lookup (`0x6FC3263F..0x6FC326C8`)
When `pTc->nPicks < 0` (`0x6FC32498: jl 0x6FC3263F`), `ITEMS_RollTreasureClass` bypasses `NoDrop` and PRNG completely:
```asm
6fc3263f: 8b 4c 24 14       mov ecx, DWORD PTR [esp+0x14]      ; stack offset
6fc32643: 8b 54 0c 3c       mov edx, DWORD PTR [esp+ecx*1+0x3c]; edx = frame.picksRemaining
6fc32647: f7 d8             neg eax                            ; eax = -nPicks = |Picks|
6fc32649: 2b c2             sub eax, edx                       ; eax = |Picks| - picksRemaining = k (0-based pick index)
6fc3264b: 8b f0             mov esi, eax                       ; esi = k
6fc3264d: 3b 74 24 10       cmp esi, DWORD PTR [esp+0x10]      ; compare k with TotalProb
6fc32651: 0f 8d 59 04 00 00 jge 0x6fc32ab0                     ; if (k >= TotalProb) pop frame!
6fc32657: 8b 44 24 14       mov eax, DWORD PTR [esp+0x14]
6fc3265b: 8b 4c 04 3c       mov ecx, DWORD PTR [esp+eax*1+0x3c]
6fc3265f: 49                dec ecx                            ; frame.picksRemaining--
6fc32660: 89 4c 04 3c       mov DWORD PTR [esp+eax*1+0x3c], ecx
```
It then executes the shared cumulative probability search (`0x6FC32690..0x6FC326C8` in Expansion, `0x6FC326DD..0x6FC32712` in Classic) using `esi = k`. Therefore:
- A negative `Picks` TC emits **at most `min(|Picks|, TotalProb)`** picks (`k = 0, 1, ..., min(|Picks|, TotalProb) - 1`).
- Pick `k` selects the first item whose cumulative probability exceeds `k` (`cumulativeProb[i] > k`).
- In `samples/d2/Patch_D2.mpq` `TreasureClassEx.txt`, 30 rows have `TotalProbExpansion > |Picks|`: `Act 1 Champ A` and all 15 `Act 1..5 (N) Champ A/B/C` (`Picks = -2`, `Citem`×1 + `Cpot`×2 = `TotalProb 3`), plus all 14 `Act 1..5 (H) Champ A/B/C` (`Picks = -2`, `Citem`×1 + `Cpot`×3 = `TotalProb 4`). All 30 Champion TCs expand **2** sub-TCs (1 `Citem` + 1 `Cpot`), never 3 or 4.
- In Classic mode (`bExpansion == 0`), 3 rows have `TotalProbClassic < |Picks|`: `Countess`, `Countess (N)`, and `Countess (H)` (`Picks = -2`, `Countess Item`×1 valid in Classic, `Countess Rune`×1 Expansion-only -> `TotalProbClassic = 1`), terminating after `min(2, 1) = 1` pick (`Countess Item`).

---

## 7. Once-Per-Game Unique Spawn Bitmap (`pGame + 0x1b24`, `D2Game!0x6FC2E250` / `0x6FC2EDC0` / `0x6FC2F370`)

### 7.1 `pGame + 0x1b24` Bitmap Layout & Initialization
- Each `D2GameStrc` (`pGame`) embeds a 4096-bit (512-byte, `128 × uint32`) bitmap at `pGame + 0x1b24`, zero-initialized on game creation (`0x6FC4C388` and `0x6FC4C670`: `ecx = 0x80` dwords).
- `ITEMS_CheckUniqueSpawned` (`0x6FC2E250`):
  - Returns `0` if `pGame == NULL`.
  - Returns `1` if `nUniqueId < 0 || nUniqueId > 0x1000`.
  - Otherwise tests `pGame->uniqueSpawnedBitmap[nUniqueId >> 5] & (1 << (nUniqueId & 31))` via mask table `0x6FD18B2C`.

### 7.2 Candidate Selection Before Bitmap Check (`0x6FC2F370` Expansion Branch `0x6FC2F533..0x6FC2F6FB`)
- In Expansion mode (`pItem->wVersion >= 1` at `0x6FC2F47E`), `ITEMS_RollUniqueItem` (`0x6FC2F370`) iterates all `UniqueItems.txt` rows (`0x6FC2F550..0x6FC2F5ED`), filtering by:
  - `version` (`pUniqueTxt->wVersion < 100 || pItem->wVersion >= 100`),
  - `enabled` (`(pUniqueTxt->nFlags & 0x01) != 0`),
  - `code == pItemsTxt->dwCode`,
  - `ladder` eligibility, and
  - `pUniqueTxt->wQlvl <= ilvl` (`0x6FC2F598..0x6FC2F5A3`).
- It accumulates `max(1, pUniqueTxt->dwRarity)` into candidate array `0x6FD31FA0` **without** pre-filtering by `0x6FC2E250`, then rolls `itemRng.rand(totalRarity)` (`0x6FC2F635`) to select a single `nUniqueId`.
- At `0x6FC2F65C..0x6FC2F673`, if `pItemsTxt->nQuest == 0` (`BYTE PTR [edi+0x12a] == 0`), it calls `0x6FC2E250(pGame, nUniqueId)`. If the chosen `nUniqueId` was already spawned in this game, `0x6FC2F370` sets `FileIndex = -1` and returns `0` (`0x6FC2F6E6`), causing `0x6FC30A20` (`0x6FC30D5C..0x6FC30DF5`) to downgrade the item to a Failed Unique (3× durability Rare if `CanBeRare`, else 3× durability Magic). It does **not** re-roll another unspawned unique on the same base item.

### 7.3 Bitmap Registration & `nolimit` / `quest` Bypass (`0x6FC2EDC0`)
- `ITEMS_RegisterUniqueSpawned` (`0x6FC2EDC0`):
  - Reads `BYTE PTR [pUniqueTxt + 0x2C]` (`0x6FC2EE05`): if bit 2 (`0x04`, `nolimit` column in `UniqueItems.txt`; all 401 vanilla 1.13c rows have `nolimit = 0`, as quest uniques rely on `ItemsTxt.nQuest != 0`) is set (`0x6FC2EE16`), returns `1` immediately without setting the bit in `pGame + 0x1b24`.
  - If `pItemsTxt->nQuest == 0` (`0x6FC2EE1F`), verifies via `0x6FC2E800` that the bit is not already set; then sets bit `nUniqueId` in `pGame + 0x1b24` (`0x6FC2EE38..0x6FC2EE59`).
- Note on `0x6FC9264F` / `0x6FC927B9`: Located in Horadric Cube recipe output generation (`0x6FC92300..0x6FC92B00`) for `CUBE_OUTPUT_USEMOD` (`0x40`, upgrading a Unique item's base). If a player brings a Unique item from a previous game (`bit == 0` at `0x6FC9264F`) and upgrades it in the Cube, recreating the upgraded item sets the bit in `pGame + 0x1b24`, and `0x6FC927B9` clears that bit back via `~mask` table `0x6FD18BAC` so upgrading an existing unique does not consume the game's natural drop slot for that unique. Selling or destroying an item never clears `pGame + 0x1b24`.

## 8. Ethereal Roll, Quest Exclusion (`D2Common #10176`), & Durability Halving (`0x6FC2EBB0`)

### 8.1 Call Site & Eligibility (`D2Game.dll` `0x6FC2EBB0`, `0x6FC30C7C..0x6FC30C87`)
- Invoked from `ITEMS_ResolveSpecialQuality` (`0x6FC30A20`) at `0x6FC30C87` when `pItem->wVersion >= 100` (`0x6FC30C7C: cmp ax, 0x64; jb`, Expansion only).
- Eligibility guards inside `ITEMS_RollEthereal` (`0x6FC2EBB0..0x6FC2EC40`, `esi = pItem`, `ebx = pItemDrop`):
  1. `0x6FC2EBB0`: `test BYTE PTR [ebx + 0x80], 0x2; jne 0x6FC2EC82` — If `pItemDrop->wInitFlags & 0x2` (forbid ethereal, set by `QUESTS_Act1Q5_ImbueItem` at `0x6FCE0391` when the source item is non-ethereal), returns immediately.
  2. `0x6FC2EBBD..0x6FC2EBD3`: Calls `D2Common #10744` (`ITEMS_CheckItemTypeId(pItem, 0x2d)` = `ITEMTYPE_WEAPON` or `0x32` = `ITEMTYPE_ANY_ARMOR`). Non-weapon/non-armor items return immediately.
  3. `0x6FC2EBDA`: Calls `D2Common #10865` (`0x6FD76D40`, `ITEMS_HasDurability(pItem)`). Looks up `pItemsTxt = D2Common_GetItemsTxtRecord(pItem->dwClassId)` (`#10695` @ `0x6FDC19A0`) and checks:
     - `pItemsTxt->bNoDurability == 0` (`BYTE PTR [eax + 0x113]`)
     - `pItemsTxt->nDurability > 0` (`BYTE PTR [eax + 0x112]`)
     - `D2Common_GetStatSigned(pItem, STAT_ITEM_INDESTRUCTIBLE (152), 0) <= 0` (`#10973` @ `0x6FD88B70`)
     If `ITEMS_HasDurability` returns `0`, returns immediately. (Unique items with fixed `ethereal` in `UniqueItems.txt` instead set `ITEMFLAG_ETHEREAL` via `gpPropertyFuncTable[23]` @ `0x6FD97290`, which appears before `indestruct` `gpPropertyFuncTable[20]` @ `0x6FD972E0` in `UniqueItems.txt` for `Ethereal Edge`, `Ghostflame`, and `Shadowkiller`.)
  4. `0x6FC2EBE8..0x6FC2EBF7`: Calls `D2Common #10106` (`ITEMS_GetItemQuality(pItem)`):
     - `dec eax; je 0x6FC2EC82`: Quality `1` (`ITEMQUAL_INFERIOR` / `'low'`) **cannot** roll Ethereal.
     - `sub eax, 4; je 0x6FC2EC82`: Quality `5` (`ITEMQUAL_SET` / `'set'`) **cannot** roll Ethereal.
  5. `0x6FC2EBFE..0x6FC2EC05`: Calls `D2Common #10176` (`0x6FD72BC0`, `ITEMS_GetQuestFlag(pItem)`):
     - Disassembly of `0x6FD72BC0`: fetches `pItemsTxt = D2Common_GetItemsTxtRecord(pItem->dwClassId)` (`0x6FDC19A0`) and returns `movzx eax, BYTE PTR [eax + 0x12A]` (`pItemsTxt->nQuest`, the `quest` column in `Weapons.txt` / `Armor.txt` / `Misc.txt`).
     - If `nQuest != 0` (`test eax, eax; jne 0x6FC2EC82`), returns immediately. Quest items (`quest > 0`) **never** roll Ethereal.

### 8.2 RNG Roll & Force Flags (`0x6FC2EC0B..0x6FC2EC3F`)
- Calls `D2Common_GetItemSeed(pItem)` (`0x6FC2A5EC`), then `RAND_RollRange(pSeed, 100)` (`mov eax, 0x64; call 0x6FC21180`):
  - If `eax < 5` (`cmp eax, 5; jge`), sets `bEthereal = 1` (`5/100 = 5%` chance).
- Force flags (`0x6FC2EC26..0x6FC2EC3F`):
  - If `(pItemDrop->dwFlags2 & 0x400000) != 0` (`test DWORD PTR [ebx + 0x44], 0x400000`) or `(pItemDrop->wInitFlags & 0x4) != 0` (`test BYTE PTR [ebx + 0x80], 0x4`), forces Ethereal even if `rand(100) >= 5`.

### 8.3 Applying Ethereal & Durability Halving (`0x6FC2EC41..0x6FC2EC80`)
- Calls `D2Common #10890` (`0x6FD96A40`, `ITEMS_MakeEthereal(pItem)`): sets `ITEMFLAG_ETHEREAL (0x400000)` and scales base weapon damage (`stats 21..24, 159, 160`) or base armor defense (`stat 31`) by `trunc(val * 3 / 2)`.
- Re-checks `D2Common #10865` (`ITEMS_HasDurability(pItem)`). When true (`0x6FC2EC56..0x6FC2EC7F`):
  - Reads `maxDur = D2Common_GetUnitBaseStat(pItem, STAT_MAXDURABILITY (73), 0)` (`#10587`).
  - Halves via signed division by 2 plus 1 (`cdq; sub eax, edx; sar eax, 1; inc eax`):
    $$\text{maxDur}_{\text{eth}} = \operatorname{trunc}(\text{maxDur} / 2) + 1$$
  - Sets `STAT_MAXDURABILITY (73) = maxDur_eth` (`#10887`), reads `D2Common_GetStatSigned(pItem, 73, 0)` (`#10973`), and sets `STAT_DURABILITY (72) = maxDur_eth` (`#10887`).

---

## 9. `ItemRatio.txt` Row Lookup: `Uber` (`0x6FD74D00`) & `ClassSpecific` (`0x6FD74320`) (`D2Common #10560` @ `0x6FDC4000`)

### 9.1 `DATATBLS_GetItemRatioTxtRecord` (`D2Common.dll` `#10560`, `0x6FDC4000`)
- Called by `D2Game.dll` `ITEMS_RollItemQuality` (`0x6FC2FC40` at `0x6FC2FCE4`) and fallback quality roll (`0x6FC2EE90` at `0x6FC2EF1C`) with `(dwClassId, wVersion)`:
  1. Calls `0x6FD74320(dwClassId)` (`ITEMS_CheckIfClassSpecific`) to compute `bClassSpecific` (`0` or `1`).
  2. Calls `0x6FD74D00(dwClassId)` (`ITEMS_CheckIfUber`, also exported via `D2Common #10772` at `0x6FD75BD0`) to compute `bUber` (`0` or `1`).
  3. Iterates `sgptDataTables->pItemRatioTxt` (`[ecx + 0xb84]`, count at `[ecx + 0xb88] = 6` rows, stride `0x44`), matching `row.bClassSpecific == bClassSpecific && row.bUber == bUber && row.wVersion <= wVersion`.

### 9.2 `ITEMS_CheckIfClassSpecific` (`0x6FD74320`)
- Looks up `pItemsTxt = DATATBLS_GetItemsTxtRecord(dwClassId)` (`0x6FDC19A0`) and primary `wType[0]` (`WORD PTR [eax + 0x11e]`), then checks `pItemTypesTxt->nClass < 7` (`cmp BYTE PTR [ecx*4 + eax + 0x15], 0x7; setb al` at `0x6FD74396..0x6FD7439B`).
- Returns `1` for all 111 class-specific bases (`amaz`, `barb`, `necr`, `pala`, `sorc`, `assn`, `drui` subtrees), `0` for all 548 generic bases.

### 9.3 `ITEMS_CheckIfUber` (`0x6FD74D00` / `#10772`)
- Disassembly (`0x6FD74D00..0x6FD74D5F`):
  1. `0x6FD74D06..0x6FD74D1D`: `ITEMS_CheckItemTypeId(dwClassId, 0x32 ['armo']) || ITEMS_CheckItemTypeId(dwClassId, 0x2d ['weap'])` (`0x6FD740A0`). Returns `0` for non-weapon/non-armor (`Misc.txt`) items.
  2. `0x6FD74D2B..0x6FD74D3F`: Loads `pItemsTxt = DATATBLS_GetItemsTxtRecord(dwClassId)` (`0x6FDC19A0`) and compares `pItemsTxt->dwCode` (`[edi + 0x80]`) against `pItemsTxt->dwUberCode` (`[edi + 0x88]`) and `pItemsTxt->dwUltraCode` (`[edi + 0x8c]`). If `dwCode != dwUberCode && dwCode != dwUltraCode`, returns `0`.
  3. `0x6FD74D41..0x6FD74D4A`: Calls `ITEMS_GetItemType(dwClassId)` (`0x6FD73FF0`, returning `pItemsTxt->wType[0]`) and rejects `0x26` (`'tpot'` Throwing Potions: `gps`, `ops`, `gpm`, `opm`, `gpl`, `opl`, which have `normcode = ubercode = ultracode = code`).
  4. `0x6FD74D4C..0x6FD74D54`: Checks `pItemsTxt->nQuest == 0` (`cmp BYTE PTR [edi + 0x12a], 0x0`). Rejects quest items (e.g., `qf2` Khalim's Will, which has `normcode = 'qf1'`, `ubercode = 'qf2'`, `ultracode = 'qf2'`, and `quest = 23`).
- Crucially, `bUber` depends **solely on the item base itself**, not on whether `rollBaseUpgrade` (`0x6FC2FB20`) upgraded a normal base during the current roll. When an Exceptional or Elite base (such as `uap` Shako, `qlvl = 58`) is picked directly from an auto-TC (e.g., `armo60`), `bUber = 1` selects the `Uber` row in `ItemRatio.txt` (`Normal = 1, NormalDivisor = 1`), so at `ilvl = qlvl` (`D = 0`), `calculateNormalChance = (1 - 0) * 128 = 128`, guaranteeing `rand(128) < 128` (`100%` Normal, `0%` Low Quality).

---

## 14. Named Unique / Set Items in `TreasureClassEx.txt` (`D2Common!0x6FDA4430` & `D2Game!0x6FC328C8` / `0x6FC2F370`)

- **`D2Common.dll` `0x6FDA4430` (`DATATBLS_ParseTreasureClassExItem`)**:
  - When compiling `Item1..Item10` in `TreasureClassEx.txt`, after checking `ItemsTxt` 4-char item codes (`0x6FDA4489`) and `pTreasureClassExLinker` (`0x6FDA44E6`), the parser checks:
    1. `0x6FDA4540..0x6FDA4580`: `pUniqueItemsLinker` (`ds:0x6FDF0AF8`, keyed by `UniqueItems.txt` `index`). If matched (`ebp >= 0`, e.g., `Annihilus` at row `382` in `ROP (N)` and `ROP (H)`):
       - Reads `pUniqueTxt->dwCode` (`[edx + eax + 0x28]`, `'cm1 '` for `Annihilus`) and resolves its base item class ID via `DATATBLS_GetItemRecordFromItemCode` (`0x6FDC1960`).
       - Sets `pTcItem->nFlags |= 0x11` (`0x01 = TCFLAG_UNIQUE`, `0x10 = TCFLAG_EXPANSION`), `pTcItem->wItemId = baseItemClassId`, and `pTcItem->wUniqueOrSetId = uniqueRowIndex` (`[ebx + 0x0A]`).
    2. `0x6FDA4582..0x6FDA45C2`: `pSetItemsLinker` (`ds:0x6FDF0AEC`, keyed by `SetItems.txt` `index`). If matched (`ebp >= 0`):
       - Resolves `pSetItemsTxt->dwCode` (`[edx + eax + 0x28]`), sets `pTcItem->nFlags |= 0x12` (`0x02 = TCFLAG_SET`, `0x10 = TCFLAG_EXPANSION`), `pTcItem->wItemId = baseItemClassId`, and `pTcItem->wUniqueOrSetId = setRowIndex`.
- **`D2Game.dll` `0x6FC328C8..0x6FC32925` (`ITEMS_RollTreasureClass`) & `0x6FC2F370` (`ITEMS_RollUniqueItem`)**:
  - When a leaf with `TCFLAG_UNIQUE` (`0x01`) is picked, `0x6FC328C8` sets `nQuality = 7` (`ITEMQUAL_UNIQUE`, skipping `ITEMS_RollItemQuality`) and passes `wUniqueId` (`0x6FC2F40A..0x6FC2F45A` / `0x6FC2F5A5..0x6FC2F623`) to `ITEMS_SpawnDropItem` (`0x6FC31880`), selecting the exact `UniqueItems.txt` row (`dwCode == base.dwCode`) without rarity weighting.
- **No `99` Upper Cap on Drop `ilvl` (`D2Game!0x6FC32D60`, `0x6FC2E5D0`, `0x6FC315A0`)**:
  - `ITEMS_DropMonsterTreasureClass` (`0x6FC32D60`), `ITEMS_GetDropItemLevel` (`0x6FC2E5D0`), and `ITEMS_CreateItem` (`0x6FC315A0`) only clamp `ilvl` lower bound to `>= 1` (`cmp eax, 1; jg ...; mov eax, 1`), with no upper cap at `99`. Monsters with `Level(H) = 110` (`diabloclone` and Pandemonium Ubers) drop items with `ilvl = 110` (satisfying `Annihilus` `lvl = 110`).

---

## 15. `STAT_MONSTER_PLAYERCOUNT` (`stat 100`) Cap & Party Clamp (`p <= 8`) in NoDrop Calculation (`D2Game!0x6FCCF840`, `0x6FCCFDB0`, `0x6FC324B5..0x6FC32534`)

- **Monster Spawn Recording (`D2Game!0x6FCCF840` & `0x6FCCFDB0`)**:
  - During monster initialization (`MONSTER_InitializeStats` @ `0x6FCCFDB0`), `0x6FCCFE7A` calls `MONSTER_ComputePlayerCountScaling(pMonster, pGame, &scaling)` (`0x6FCCF840`).
  - `0x6FCCF840` checks `pMonStatsTxt->nAlign` (`BYTE PTR [eax + 0x4c]`, compiled from `MonStats.txt` `Align` column at `D2Common.dll` `0x6FDAAED7`):
    - If `nAlign == 0` (hostile monster): calls `PLAYERS_GetPlayerCount(pGame)` (`0x6FC579A0`, returning `max(activePlayersInGame, g_nPlayersX)`), clamps `ecx = max(1, eax)`, computes HP/XP scaling percentages from tables `0x6FD1B614` / `0x6FD1B5F0`, and stores `scaling.nPlayerCount = ecx` (`[esi + 0x10]`).
    - If `nAlign != 0` (`Align = 1` or `2`): sets `scaling.nPlayerCount = 1` (`0x6FCCF8A4`) and zero HP/XP bonus.
  - `0x6FCCFDB0` clamps `scaling.nPlayerCount >= 1` (`0x6FCCFEBE..0x6FCCFED3`) and writes `D2Common_SetStat(pMonster, 0x64, nPlayerCount, 0)` (`#10517` @ `0x6FCCFF35..0x6FCCFF3B`, `stat 100 = monster_playercount` in `ItemStatCost.txt`).
- **NoDrop Effective Player Count (`D2Game!0x6FC32380` at `0x6FC324B5..0x6FC32534`)**:
  - `0x6FC324B5..0x6FC324E4`: Resolves the killer owner player unit and calls `PARTY_CountPlayersInArea` (`0x6FCBC1F0`) for `p`. If `p <= 1`, sets `edi = 1`.
  - `0x6FC324E9..0x6FC324F0`: Clamps `p <= 8` (`cmp edi, 0x8; jl 0x6fc324f2; mov edi, 0x8`).
  - `0x6FC324F2..0x6FC32503`: Calls `PLAYERS_GetPlayerCount(pGame)` (`0x6FC579A0`) for `g`, and computes `edi = n = p + trunc((g - p) / 2)` (`sub eax, edi; cdq; sub eax, edx; sar eax, 1; add edi, eax`).
  - `0x6FC32505..0x6FC32529`: Checks `pDropSource != NULL && pDropSource->dwUnitType == 1` (`UNIT_MONSTER`, `0x6FC3250C`). If the drop source is a monster:
    - Calls `D2Common_GetStatSigned(pDropSource, 0x64, 0)` (`#10973` @ `0x6FC32511..0x6FC32516`) to read `stat 100` (`monster_playercount`).
    - Clamps `stat100 = max(1, stat100)` (`cmp eax, 0x1; jge 0x6fc32525; mov eax, 0x1`).
    - Caps `n = min(n, stat100)` (`cmp edi, eax; jl 0x6fc3252b; mov edi, eax`).
  - Non-monster drop sources (`dwUnitType == 2` objects/chests) skip `0x6FC32511..0x6FC32529` and use uncapped `n`.

---

## 16. Gold Drop Seed Initialization, `mul` Fixed-Point Scaling (`>> 8`), and Gold Find Negative Clamp (`D2Common!0x6FDA4614`, `D2Game!0x6FC31070`, `0x6FC32A1A`, `0x6FC2F260`)

- **Quality Roll Bypass (`D2Game!0x6FC2FC40` at `0x6FC2FC99..0x6FC2FCA2`)**:
  - When `'gld '` (`ITEMTYPE_GOLD = 4`) is picked in `ITEMS_RollTreasureClass` (`0x6FC3289A`), `ITEMS_RollItemQuality` checks `pItemTypesTxt[4].bNormal` (`Normal = 1` in `ItemTypes.txt`) and immediately returns `ITEMQUAL_NORMAL (2)` without advancing the monster/drop source RNG (`pSeed`).
- **Gold Item Seed & Base Stack Roll (`D2Game!0x6FC31880` -> `0x6FC31490` -> `0x6FD01D90` -> `0x6FC31070`)**:
  - `ITEMS_CreateItem` (`0x6FC31490`) allocates the gold item unit via `SUNIT_AllocUnitData` (`0x6FD01D90`), which calls `ITEMS_AllocItemData` (`0x6FD00110`) to draw `dwInitSeed` from the drop RNG stream and initialize the gold item's own seed `pItem->pSeed` (`+0x20`).
  - `ITEMS_InitItemStats` (`0x6FC31070..0x6FC310AA`) checks `D2Common_CheckItemTypeIf(pItem, 4)` (`ITEMTYPE_GOLD`):
    - Computes `ecx = 5 * ilvl` (`lea ecx, [eax + eax*4]`) and rolls `RAND_RollRange(&pItem->pSeed, 5 * ilvl) + ilvl` (`0x6FC31083..0x6FC310A1`) using the **gold item's own seed** (`lea esi, [edi + 0x20]`), not the monster/drop source seed.
    - Clamps `baseGold <= 0` to `1` (`0x6FC310A3..0x6FC310AA`) and stores `STAT_GOLD (0x0E)` (`0x6FC310F6`).
- **TC `,mul=N` Parsing (`D2Common!0x6FDA4614..0x6FDA47A7`) & Fixed-Point Scaling (`D2Game!0x6FC32A1A..0x6FC32A76`)**:
  - `DATATBLS_ParseTreasureClassExItem` (`D2Common!0x6FDA4614`) parses `,mul=<N>` via `atoi` and stores the raw 16-bit unsigned integer into `pTcItem->wParam` (`WORD PTR [ebx + 0x0A]`; `0` when absent).
  - In `ITEMS_RollTreasureClass` (`0x6FC32A1A..0x6FC32A59`), if `pTcItem->wParam != 0`:
    - Reads `ebx = D2Common_GetStatSigned(pItem, STAT_GOLD, 0)` (`0x6FC32A30`).
    - Zero-extends `ecx = pTcItem->wParam` (`movzx ecx, word ptr [esi + eax + 0x0A]`).
    - Scales `ebx = (ebx * ecx) >> 8` (`imul ebx, ecx; sar ebx, 8` at `0x6FC32A43..0x6FC32A49`, 256-based fixed-point).
    - Clamps `ebx < 0` to `0` (`jns 0x6FC32A59; xor ebx, ebx`) and writes `STAT_GOLD (0x0E)`.
- **Killer Gold Find (`STAT_ITEM_GOLDBONUS = 0x4F`) & Negative Clamp (`D2Game!0x6FC2F260..0x6FC2F2E5`)**:
  - At `0x6FC32A9B`, calls `ITEMS_ApplyGoldFind(pItem, pKiller)` (`0x6FC2F260`):
    - Reads `STAT_ITEM_GOLDBONUS (0x4F = 79)` on `pKiller`, plus on `SUNIT_GetOwner(pGame, pKiller)` if `pKiller` is a pet/mercenary (`0x6FC2F281..0x6FC2F2AA`), and adds `100` (`add esi, 0x64`).
    - Multiplies `ecx = gold * (100 + totalGf)` (`imul ecx, esi` at `0x6FC2F2BB`) and divides by `100` via signed truncated integer division (`imul 0x51eb851f; sar edx, 5; shr esi, 31; add esi, edx` at `0x6FC2F2BE..0x6FC2F2CE`).
    - If the result is negative (`js` at `0x6FC2F2D1`, e.g. when `totalGf < -100`), sets `STAT_GOLD (0x0E)` to `0` (`push 0; push 0; push 0x0E; call D2Common_SetStat` at `0x6FC2F2D3..0x6FC2F2DD`).
- **Other Gold Creation Paths (`D2Game!0x6FC32B90` & `0x6FC8AFA0`)**:
  - `0x6FC32B90` (`ITEMS_DropGoldPile`) drops explicit gold quantities (player inventory/stash drop, death gold drop, vendor overflow) in chunks up to `2,000,000,000` (`0x77359400`), overwriting `STAT_GOLD (0x0E)` with the exact amount.
  - `0x6FC8F240` / `0x6FC8F3A5` (`rollSparklingChestDrop`) calls `0x6FC8AFA0` (`OBJECTS_DropItemByCode`) with `'gld '`, which invokes `0x6FC31490` -> `0x6FC31070` (rolling `5 * ilvl + ilvl` on the gold item's own seed).


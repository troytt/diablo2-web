# Diablo II v1.13c `D2StatListStrc`, `D2StatListExStrc`, `STATES`, `SUNIT` Hash & `EVENT_FreeNode` Layout

Authoritative binary disassembly evidence from `D2Common.dll` (image base `0x6FD50000`) and `D2Game.dll` (image base `0x6FC20000`) for the v1.13c isomorphic kernel (`src/d2kern-113c/`).

---

## 1. `D2StatListStrc` (`sizeof = 0x3C` / 60 bytes) & `D2StatListExStrc` (`sizeof = 0x64` / 100 bytes)

### Allocation & Construction
- **`D2Common.#11013` (`0x6FD88100` `STATLIST_AllocStatList`):**
  - Allocates `0x3C` bytes (`push 0x3c`), zeroes all 15 dwords (`rep stosd`), writes:
    - `+0x00`: `pMemPool`
    - `+0x10`: `dwFlags`
    - `+0x38`: `fpRemove`
    - `+0x08`: `eOwnerType` (`6` when NULL)
    - `+0x0C`: `dwOwnerId`
- **`D2Common.#11166` (`0x6FD8AF00` `STATLIST_AllocStatListEx`):**
  - Allocates `0x64` bytes (`push 0x64`), zeroes all 25 dwords, writes:
    - `+0x00`: `pMemPool`
    - `+0x10`: `dwFlags = (argFlags & 1) | 0x80000000` (`STATLIST_EXTENDED`)
    - `+0x5C`: `fpStatChanged`
    - `+0x60`: `pGame`
    - `+0x08`: `pOwner ? pOwner->dwUnitType : 6`
    - `+0x0C`: `pOwner ? pOwner->dwUnitId : 0`
    - `+0x44`: `pOwner` (`D2UnitStrc*`)
    - `+0x58`: `pStateFlags` — allocates `2 * ceil(nStatesCount / 32) * 4` bytes (`48` bytes for `185` states (`0..184`, `184 = uberminion`, `[sgptDataTables+0xC4] = 185`): `6` active dwords at `+0x00..+0x17` + `6` dirty/gfx dwords at `+0x18..+0x2F`; verified at `0x6FD8AF79..0x6FD8AFB2`, `0x6FD87DB0`, `0x6FD88730`).

### Field Offset Table

| Offset | Type | Field | Binary Evidence |
|---|---|---|---|
| `+0x00` | `ptr` | `pMemPool` | `0x6FD88136: mov [eax], ebx` |
| `+0x04` | `ptr` | `pUnit` | Attached owner item/unit on sub-lists |
| `+0x08` | `u32` | `eOwnerType` | `0x6FD88142: mov [eax + 8], ecx` (`6` if none) |
| `+0x0C` | `u32` | `dwOwnerId` | `0x6FD88145: mov [eax + 0x0c], edx` |
| `+0x10` | `u32` | `dwFlags` | `0x80000000` (`EXTENDED`), `0x40000000` (`TEMPONLY`), `0x20000000` (`DYNAMIC_OP`), `0x2000` (`SET`), `0x02` (`TIMED`) |
| `+0x14` | `u32` | `dwStateNo` | `#10785` (`0x6FD88060`): `mov eax, [eax + 0x14]` |
| `+0x18` | `u32` | `dwExpireFrame` | `#10412` (`0x6FD88000`) / `#10161` (`0x6FD88020`, sets `dwFlags |= 2` when `frame > 0`) |
| `+0x1C` | `u32` | `nSkillNo` | `#10555` (`0x6FD87D50`) / `#10725` (`0x6FD87D60`) |
| `+0x20` | `u32` | `nSkillLevel` | `#10515` (`0x6FD87D30`) / `#11081` (`0x6FD87D40`) |
| `+0x24` | `ptr` | `Stats.pStat` | Sorted array of 8-byte `D2StatStrc { dwKey: u32, lValue: i32 }` (`dwKey = (statId << 16) | (layer & 0xFFFF)`) |
| `+0x28` | `u16` | `Stats.wStatCount` | Active entry count (`0x6FD882B2: movsx ecx, word ptr [esi + 4]`) |
| `+0x2A` | `u16` | `Stats.wStatCapacity` | Allocated capacity; grows in steps of `+4` (`0x6FD88640`), shrinks by `-4` when `cap - count > 8` (`0x6FD881A0`) |
| `+0x2C` | `ptr` | `pPrevLink` | Sub-list chain link walked from `pMyLastList` (`0x6FD88CF3: mov ebp, [ebp + 0x2c]`) |
| `+0x30` | `ptr` | `pNextLink` | Forward sub-list link |
| `+0x34` | `ptr` | `pParent` | Parent `D2StatListExStrc*` (`0x6FD89F70` walks up `+0x34`) |
| `+0x38` | `ptr` | `fpRemove` | Removal callback (`0x6FD8813C: mov [eax + 0x38], edx`) |
| `+0x3C` | `ptr` | `pMyLastList` | Head of active sub-lists on `D2StatListExStrc` (`0x6FD88CD6: mov ebp, [esi + 0x3c]`) |
| `+0x40` | `ptr` | `pMyStats` | Head of `0x2000` set sub-lists (`0x6FD88547: mov eax, [edx + 0x40]`) |
| `+0x44` | `ptr` | `pOwner` | Owner `D2UnitStrc*` (`0x6FD8AF76: mov [esi + 0x44], ebx`) |
| `+0x48` | `ptr` | `FullStats.pStat` | Accrued + `op`-evaluated 8-byte `D2StatStrc` array (`0x6FD88A8E: lea ecx, [esi + 0x48]`) |
| `+0x4C` | `u16` | `FullStats.wStatCount` | Accrued stat count |
| `+0x4E` | `u16` | `FullStats.wStatCapacity` | Accrued stat capacity |
| `+0x50` | `ptr` | `ModStats.pKey` | Modified `dwKey` u32 array for `eOwnerType == 0` (`+0x54 wModCount`, `+0x56 wModCap`) |
| `+0x58` | `ptr` | `pStateFlags` | `[0..5]` active state bitfield, `[6..11]` dirty/gfx state bitfield |
| `+0x5C` | `ptr` | `fpStatChanged` | Stat change callback |
| `+0x60` | `ptr` | `pGame` | `D2GameStrc*` |

### Binary Search & Zero-Removal Rules
- **Signed 32-bit key comparison (`0x6FD88270` / `0x6FD882B0`):**
  - `dwKey = ((statId & 0xFFFF) << 16) | (layer & 0xFFFF)`.
  - Uses `cmp edi, edx; jle / jge` (signed 32-bit comparison).
- **Zero removal (`0x6FD8A280` vs `0x6FD88980`):**
  - `STATLIST_SetBaseStat` (`0x6FD8A280`) **always** removes entries from `BaseStats` (`+0x24`) when `newValue == 0` (`0x6FD881A0`), and is a no-op if `newValue == 0` and the key is absent.
  - `FullStats` (`+0x48`, updated at `0x6FD88980`) removes zero entries unless `ItemStatCost.bKeepZero` (`+0x50`) is non-zero.
- **MinValue Floor Clamping (`0x6FD88A80` / `0x6FD88B00`):**
  - **Absent entries return `0` BEFORE `fMin` (`0x6FD88A9C` / `0x6FD88B12`):** If `0x6FD882B0` returns `< 0` (for example when `value == 0` removed a `bKeepZero == 0` stat such as `maxhp`), `STATLIST_GetUnitStat` and `STATLIST_GetUnitBaseStat` immediately return `0` without applying `fMin`.
  - **Present entries (`idx >= 0`) on `D2StatListExStrc` owned by `pOwner->dwUnitType` in `{0, 1}`:** If `ItemStatCost.wFlags` (`+0x04`) has bit `0x0400` (`byte +0x05 & 0x04`, `fMin`), `0x6FD88AE1..0x6FD88AED` compares `val < dwMinAccr` (`+0x2C`, unshifted!) and when true sets `val = dwMinAccr << bValShift` (`+0x18`).
- **`STATLIST_RecomputeExStat` (`0x6FD89CE0..0x6FD89F48`) & `DataTbls_LoadItemStatCostTxt` (`0x6FDC3BFB`):**
  - `ItemStatCostTxt` (`sizeof = 0x144` / 324 bytes, 359 rows in 1.13c `ItemStatCost.bin`) links runtime `op` tables at:
    - `+0x50`: `bKeepZero` (`mana = 8`, `stamina = 10` have `1`; `hitpoints = 6`, `maxhp = 7` have `0`)
    - `+0x51`: `bHasOpStat` (`1` if `wOpStat[0..2]` or `wBaseDepStats` is non-empty)
    - `+0x52`: `bIsOpTarget` (`1` if `ReverseOpEntry` at `+0xDE` is non-empty)
    - `+0x53`: `bHasDynamicOp` (`1` for `op 4/5` or `op 6/7`)
    - `+0x54`: `bOp` (`op 1..13`; note `stat 76` `item_maxhp_percent` and `stat 77` `item_maxmana_percent` have `bOp = 11` in 1.13c `ItemStatCost.bin`)
    - `+0x55`: `bOpParam`, `+0x56`: `wOpBase` (`0xFFFF` if unused), `+0x58..+0x5D`: `wOpStat[0..2]`
    - `+0x5E..+0xDD`: `wBaseDepStats[64]` (`0xFFFF`-initialized at `0x6FDC3C81`; stats that reference this stat as `wOpBase`, e.g., `level = 12` lists `214, 215, 216, 217, ...`)
    - `+0xDE..+0x13D`: `ReverseOpEntry[16]` (`6` bytes each: `+0x00 wOpBase`, `+0x02 wSourceStat`, `+0x04 bOp`, `+0x05 bOpParam`, zero-initialized)
  - **Carrier suppression in `FullStats` (`0x6FD89DBB..0x6FD89EB9`, jump table `0x6FD89F48` / `0x6FD89F60`):**
    - When `bHasOpStat == 1` and a target `wOpStat[i]` evaluates to `targetVal != 0`, `bKeepCarrier` (`[esp + 0x10]`, initially `1`) is cleared to `0` (suppressing writing the carrier stat itself into `FullStats`) for:
      - `bOp` in `{1, 12}`: unconditionally.
      - `bOp` in `{2, 3}` (e.g., `216` `item_hp_perlevel`): when `eOwnerType` in `{0, 1}` AND `FullStats[unk_DE[i].wOpBase] > 0` (note original 1.13c binary quirk at `0x6FD89DEA`: reads `word [esi + 0xDE + i*6]`, which is `0` = `strength` unless another stat targets the carrier!).
      - `bOp` in `{4, 5}`: when `pList->pUnit` is non-null, its `dwUnitType` in `{0, 1}`, and `STATLIST_GetUnitStat(pUnit, unk_DE[i].wOpBase, 0) > 0` (`0x6FD89E38`).
      - `bOp` in `{6, 7}`: when `eOwnerType` in `{0, 1}`.
      - `bOp == 13`: when `eOwnerType == 4` (Item).
      - `bOp` in `{0, 8, 9, 10, 11}` (e.g., `energy`, `vitality`, `item_maxhp_percent`): `bKeepCarrier` stays `1`, so they ARE written to `FullStats`.
  - **`wBaseDepStats` (`+0x5E..+0xDD`, `0x6FDC3CE3..0x6FDC3D35` & `0x6FD89ED0..0x6FD89F36`):**
    - During `DATATBLS_LoadItemStatCostTxt` (`0x6FDC3CE3..0x6FDC3D35`), when `entry` has `1 <= bOp <= 13` and `wOpBase < nStatCount` (e.g., `wOpBase == 12` `level`), `table[wOpBase].bHasOpStat` (`+0x51`) is set to `1` and `table[wOpBase].wBaseDepStats[ecx]` stores **`entry.statId`** (`[esp + 0x2c]`, e.g., `216`, `217`, `222`, `223`), **not** `wOpStat[i]`.
    - When `wOpBase` (`12`) is updated and `bKeepCarrier && val != 0` (`0x6FD89ED0..0x6FD89F36`), `STATLIST_RecomputeExStat` recursively invokes `0x6FD89CE0` on each `depStatId = wBaseDepStats[k]` (`0x6FD89F15`, propagating multi-hop chains such as `12 -> 222 -> 1 -> 9`) and then unconditionally writes `eax` (`depVal`) to `FullStats[depStatId]` via `0x6FD88940` (`0x6FD89F22`).
- **`#10887` (`0x6FD8A740` `STATLIST_SetUnitStat`) vs `#10188` (`0x6FD8A780` `STATLIST_SetStat`) Return Value:**
  - `#10188` (`0x6FD8A780` -> `0x6FD8A280`) returns `BOOL` (`1` if modified, `0` if unchanged).
  - `#10887` (`0x6FD8A740`) has C return type `void`: when `pUnit->dwUnitType == 0` and `0x6FD8A280` returns non-zero, `0x6FD8A775` calls `void 0x6FD88550` (`STATLIST_RecordClientDirtyStat` into `ModStats` `+0x50`), leaving `ModStats.pKey` in `eax`.

### `STATES` Bitvectors (`0x6FD83CD0` `#10494`, `0x6FD88730`)
- **`STATES_CheckState` (`0x6FD83CD0`):**
  - Returns `0` unless `pUnit != NULL`, `dwUnitType` in `{0, 1, 3}` (`player`, `monster`, `missile`), `0 <= stateId < nStatesCount` (`185` states: `0..184`, `184 = uberminion`, `[sgptDataTables+0xC4] = 185`), and `(pStatListEx->dwFlags & 0x80000000)`.
  - Reads `pStateFlags[stateId >> 5] & (1 << (stateId & 31))` (raw masked `u32`).
- **`STATES_ToggleState` (`0x6FD88730`):**
  - Reads `wordIdx = stateId >> 5`, `mask = 1 << (stateId & 31)`.
  - Updates `pStateFlags[wordIdx]`; if the bit actually flipped (`wasSet != bSet`), sets dirty bit `pStateFlags[wordIdx + 6] |= mask`.

---

## 2. `SUNIT` Unit ID & Server Hash Tables (`D2Game.dll`)

- **`SUNIT_GetNewUnitId` (`0x6FCFF9C0`, `edx = pGame`, `ecx = dwUnitType`):**
  - Counter array at `pGame + 0x90 + dwUnitType * 4` (`dwUnitType` in `0..5`).
  - Increments `id = prev + 1`; if `id == 0xFFFFFFFF` (`-1`), wraps to `1` (`0x6FCFF9DE: cmp eax, -1; jnz ...; mov eax, 1`).
- **Hash Table Offsets in `D2GameStrc` (`0x6FD1B014` table used by `0x6FD003A0`, `0x6FD00310`, `0x6FD002A0`):**
  - `0` (`UNIT_PLAYER`): `pGame + 0x1120` (`128` buckets, `dwUnitId & 0x7F`)
  - `1` (`UNIT_MONSTER`): `pGame + 0x1320` (`128` buckets, `dwUnitId & 0x7F`)
  - `2` (`UNIT_OBJECT`): `pGame + 0x1520` (`128` buckets, `dwUnitId & 0x7F`)
  - **`3` (`UNIT_MISSILE`): `pGame + 0x1920` (`128` buckets, `dwUnitId & 0x7F`)**
  - **`4` (`UNIT_ITEM`): `pGame + 0x1720` (`128` buckets, `dwUnitId & 0x7F`)**
  - **`5` (`UNIT_TILE`): `pGame + 0x1B20` (single list head dword — NOT bucketed by `& 0x7F`!)**
- **Bucket Ordering (`SUNIT_InsertServerUnit` `0x6FD00310`):**
  - Each bucket chain (`unit + 0xE4` `pGameHashNext`) is kept in **strictly descending order of `dwUnitId`** (`0x6FD00342: cmp [eax + 0x0c], edi; jbe insert_here`).

---

## 3. `EVENT_FreeNode` (`0x6FCAE6F0`) & Chunk Pool (`0x6FCAE420`)

- **`D2TimerStrc` (`sizeof = 0xA20` / 2,592 bytes):**
  - `+0xA18`: `pSavedNext` (iterator cursor during `EVENT_UpdateTimers` `0x6FCAEC50` / `0x6FCAEC00`).
  - `+0xA1C`: `pPool` (head of `0x7088`-byte pool chunks).
- **Pool Chunk (`sizeof = 0x7088` / 28,808 bytes, `0x6FCAE420`):**
  - `600` (`0x258`) contiguous `0x30`-byte `D2EventStrc` nodes (`+0x0000..+0x707F`).
  - `+0x7080`: `pFreeHead` (free-list linked via `node + 0x1C` `pWheelNewer`).
  - `+0x7084`: `pNextChunk`.
- **Re-entrant Deletion Guard (`0x6FCAE6F0`):**
  - While an event callback is executing, `fFlags (+0x02)` has `0x01` set (`or al, 1`).
  - If `EVENT_FreeNode` is called on a node with `fFlags & 0x01`, it sets `fFlags |= 0x08` and returns immediately (`0x6FCAE6FB..0x6FCAE703`). After the callback returns, the dispatch loop clears `0x01` and frees the node if `0x08` is set (or unconditionally for non-persistent slot events).
  - If `pNode == timer->pSavedNext`, `timer->pSavedNext` is advanced to `pNode->pWheelNewer` (`+0x1C`) before unlinking.

---

## 4. `D2Net.dll` Packet Send Slot (`D2Game` IAT `0x6FD18B64`)

- `D2Net.#10002` (`0x6FBF63E0`, imported at `D2Game` IAT `0x6FD18B64`):
  - Signature: `int __stdcall D2Net_SendPacket(int nQueue, int nClientId, const uint8_t *pPacket, int nPacketLen)` (`ret 0x10`, max length `0x204`).

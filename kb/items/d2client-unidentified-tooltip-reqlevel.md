# D2Client.dll & D2Common.dll v1.13c Unidentified Item Tooltip `Required Level` Gate (`0x6FB43D89`)

## 1. Binary Ground Truth (`D2Client.dll`, ImageBase `0x6FAB0000`)

In Diablo II v1.13c, the string index `0x0D8D` (`3469`, key `'ItemExp'` / `"Required Level:"` / `"需要等级:"`) is formatted exclusively by helper `0x6FB3DE40`:

| Helper / Caller | Address | Behavior |
|---|---|---|
| `HUD_FormatRequiredLevelLine` | `0x6FB3DE40` | Resolves string `0x0D8D` via `D2Lang_GetStringByReferenceIndex` (`0x6FABD1EC`) and formats `"%s %d\n"` (`0x6FB83768`) with `nRequiredLevel`. |
| Main Item Tooltip (`showitems.cpp`) | `0x6FB43C1C` (caller @ `0x6FB43DCF`) | Gated at `0x6FB43D89..0x6FB43DA3` by `ITEMS_CheckItemFlag(pItem, IFLAG_IDENTIFIED (0x10), 4054, __FILE__)` (`0x6FB43D9C`). If `eax == 0` (item is unidentified), `je 0x6FB43DD4` jumps directly past `ITEMS_GetMinReqLvl` (`0x6FABC8AA`) and `0x6FB3DE40`. |
| Set Item Tooltip (`showitems.cpp`) | `0x6FB428C0` (caller @ `0x6FB42C96`) | Only invoked from `0x6FB43C6A` when `ITEMS_GetItemQuality(pItem) == ITEMQUAL_SET (5)` **and** `ITEMS_CheckItemFlag(pItem, IFLAG_IDENTIFIED (0x10), 3999, __FILE__)` (`0x6FB43C60`) returns non-zero. |

### Exact Disassembly (`0x6FB43D89..0x6FB43DD4`)

```asm
6fb43d89: push 0xfd6                      ; line 4054
6fb43d8e: mov  ecx, [esp+0x20dc]          ; pItem
6fb43d95: push 0x6fb83c24                 ; "...\\showitems.cpp"
6fb43d9a: push 0x10                       ; IFLAG_IDENTIFIED (0x00000010)
6fb43d9c: push ecx
6fb43d9d: call 0x6fabc952                 ; D2Common_10707_ITEMS_CheckItemFlag
6fb43da2: test eax, eax
6fb43da4: je   0x6fb43dd4                 ; Unidentified -> skip Required Level line!
6fb43da6: mov  eax, [0x6fbbc2b4]          ; pPlayerUnit
6fb43dab: mov  ecx, [esp+0x20d8]          ; pItem
6fb43db2: push eax
6fb43db3: push ecx
6fb43db4: call 0x6fabc8aa                 ; D2Common_11016_ITEMS_GetMinReqLvl
6fb43db9: cmp  eax, 0x01
6fb43dbc: jle  0x6fb43dd4                 ; Suppress Required Level when <= 1
6fb43dbe: lea  edx, [esp+0x18f8]
6fb43dc5: push eax
6fb43dc6: push edx
6fb43dc7: lea  eax, [esp+0x1ce8]
6fb43dce: push eax
6fb43dcf: call 0x6fb3de40                 ; Format "Required Level: %d\n"
6fb43dd4: ...                             ; Continue to Weapon Speed / Unidentified lines
```

## 2. `D2Common.dll` Required Level & Charm Activation (`ImageBase 0x6FD50000`)

1. **`ITEMS_GetRequiredLevel` (`#11015` @ `0x6FD76190`, wrapper `#11016` @ `0x6FD76DA0`)**:
   - Initializes `nRequiredLevel = pItemsTxt->nLevelReq` (`levelreq` column in `Weapons.txt` / `Armor.txt` / `Misc.txt`, **not** `level` / `qlvl`).
   - Checks `test byte ptr [pItemData + 0x18], 0x10` (`IFLAG_IDENTIFIED` @ `0x6FD761E5`). When `0` (unidentified), magic/rare/crafted affix `levelreq`, `UniqueItems.txt` / `SetItems.txt` `levelreq`, and skill modifier `reqlevel` are all skipped.
2. **`ITEMS_IsCharmUsable` (`0x6FD77090`)**:
   - Explicitly checks `IFLAG_IDENTIFIED` (`0x6FD770BE: push 0x10; call ITEMS_CheckItemFlag`) before checking `ITEMS_CheckItemRequirements` (`0x6FD770DD`). Unidentified charms are always inactive in inventory.
3. **`Misc.txt` Charm Columns (`level` vs `levelreq`)**:
   - `cm1` (`Small Charm`): `level = 28` (`qlvl`), `levelreq = 0`.
   - `cm2` (`Large Charm`): `level = 14` (`qlvl`), `levelreq = 0`.
   - `cm3` (`Grand Charm`): `level = 1` (`qlvl`), `levelreq = 0`.
   - Reading `base.level` (`qlvl`) instead of `base.levelreq` (`0`) or rendering `Required Level` while unidentified violates both `D2Client.dll` (`0x6FB43D89`) and `D2Common.dll` (`0x6FD76190`).

# Diablo II 1.13c Belt-Carried Scrolls (`tsc` & `isc`): `BeltUse`, `ItemUse`, `UseStackableItem` (`0x3F`), and `RemoveFromBelt` (`0x9C 0x0F`)

## 1. MPQ Table Ground Truth (`Misc.txt` & `Skills.txt`)
- `Scroll of Town Portal` (`code = 'tsc'`): `beltable = 1`, `pSpell = 2`, `spellicon = 1`, `cskill = 'Scroll of Townportal'` (`#219`).
- `Tome of Town Portal` (`code = 'tbk'`): `beltable = 0`, `pSpell = 2`, `spellicon = 1`, `cskill = 'Book of Townportal'` (`#220`).
- `Scroll of Identify` (`code = 'isc'`): `beltable = 1`, `pSpell = 1`, `spellicon = 0`, `cskill = 'Scroll of Identify'` (`#217`).
- `Tome of Identify` (`code = 'ibk'`): `beltable = 0`, `pSpell = 1`, `spellicon = 0`, `cskill = 'Book of Identify'` (`#218`).

## 2. `D2Client.dll` `0x6FACAA4A` vs. Belt/Inventory Scroll Dispatch
- Disassembly of `D2Client.dll` `0x6FACAA00..0x6FACAA8F` shows `0x6FACAA4A` is the generic `C2S 0x0C` (`RightSkillAtLocation`, `movb $0xc, 0x14(%esp)`) sender for active right-hand skills, not a dedicated Town Portal opcode.
- When casting Town Portal from a scroll/tome shortcut or right-click:
  - Inventory `'tbk'` / `'tsc'` (`ITEMMODE_INVENTORY == 0` / `storagePage == 0`): sends `C2S 0x20` (`ItemUse`).
  - Belt `'tsc'` (`ITEMMODE_BELT == 2`): sends `C2S 0x26` (`BeltUse`).
- HUD scroll counters for pseudo-skills `#217..#220` sum matching scrolls/tomes across both `inventory` and `belt`.

## 3. `D2Game.dll` `ITEMS_UseSpell` (`0x6FCCD0F0`), `BeltUse` (`0x6FCF8BA0`), `ItemUse` (`0x6FCF9BF0`), and `IdentifyItem` (`0x6FCF9FB0`)
- **`pSpell` Jump Table (`0x6FD27238`, stride `8`: `[preCheckFn, execFn]`)**:
  - `pSpell = 1` (`Identify`, `'isc'` / `'ibk'`): `preCheckFn = 0x6FCCCFD0`, `execFn = 0x6FCCDAC0`.
  - `pSpell = 2` (`Town Portal`, `'tsc'` / `'tbk'`): `preCheckFn = 0x00000000`, `execFn = 0x6FCCF450`.
- **Using `'isc'` or `'ibk'` (`C2S 0x20 ItemUse` @ `0x6FCF9CE2` or `C2S 0x26 BeltUse` @ `0x6FCF8D16`)**:
  - Calls `ITEMS_UseSpell` (`0x6FCCD0F0`), which invokes `preCheckFn` (`0x6FCCCFD0`).
  - `0x6FCCCFD0` sets `ITEMFLAG_TARGETING` (`0x4`), emits 8-byte `S2C 0x3F UseStackableItem` (`byte[1] = SpellIcon = 0`, `dword[2..5] = itemId`, `word[6..7] = 217 | 218`), and causes `ITEMS_UseSpell` to return `0` so neither `BeltUse` nor `ItemUse` removes or decrements the scroll/tome before a target item is clicked.
- **Consuming Belt `'isc'` on `C2S 0x27 IdentifyItem` (`0x6FCEF6B0 -> 0x6FCF9FB0`)**:
  - At `0x6FCFA0DA` (`cmp ebx, 0x2` — `toolItem->dwItemMode == ITEMMODE_BELT`), `D2Game.dll` calls `ITEMS_RemoveFromBelt` (`0x6FCF3950`), emitting `S2C 0x9C` `action = 0x0F` (`RemoveFromBelt`) and shifting upper rows in the same belt column down (`0x0E` / `0x0F`).
- **Consuming Belt `'tsc'` on `C2S 0x26 BeltUse` (`0x6FCF8BA0`)**:
  - After `pSpell = 2` (`0x6FCCF450`) opens the Town Portal (`Objects.txt 59`), `0x6FCF8DBD` calls `ITEMS_RemoveFromBelt` (`0x6FCF3950`), emitting `S2C 0x9C` `action = 0x0F` (`RemoveFromBelt`) and shifting upper belt column rows down.

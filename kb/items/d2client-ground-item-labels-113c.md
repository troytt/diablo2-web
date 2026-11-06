# Diablo II v1.13c Ground Item Label Colors, Border & Background (`D2Client.dll` / `D2Win.dll`)

## Binary Ground Truth

### 1. Ground Item Name Color Selection (`D2Client.dll` `0x6FB6FEC0` & `0x6FB08FB0`)

Both `D2Client_FormatOrDrawGroundItemLabel` (`0x6FB6FEC0`, single hovered ground item plaque) and `D2Client_DrawGroundItemLabels` (`0x6FB08FB0`, Alt-held ground item plaques at `0x6FB09338..0x6FB09457`) compute the text color index `ebx` (`0..10`) in the exact same order:

1. **Default**: `ebx = 0` (**White**, `ÿc0`).
2. **Quality switch (`D2Common_GetItemQuality(pUnit)`, `0x6FB6FEF2..0x6FB6FF62`)**:
   - `4` (`ITEMQUAL_MAGIC`) -> `3` (**Blue**)
   - `5` (`ITEMQUAL_SET`) -> `2` (**Green**)
   - `6` (`ITEMQUAL_RARE`) -> `9` (**Yellow**)
   - `7` (`ITEMQUAL_UNIQUE`) -> `4` (**Gold**)
   - `8` (`ITEMQUAL_CRAFT`) -> `8` (**Orange**)
   - `9` (`ITEMQUAL_TEMPERED`) -> `10` (**Dark Green**)
   - `<= 3` (`ITEMQUAL_INFERIOR = 1`, `ITEMQUAL_NORMAL = 2`, `ITEMQUAL_SUPERIOR = 3`):
     - If `D2Common_CheckItemFlag(pUnit, 0x800)` (`ITEMFLAG_SOCKETED`) **OR** `D2Common_CheckItemFlag(pUnit, 0x400000)` (`ITEMFLAG_ETHEREAL`) -> `5` (**Gray**).
     - Otherwise remains `0` (**White**). Unsocketed, non-ethereal low-quality (crude/cracked/damaged) items are **White**, not Gray.
3. **Quest Item Override (`0x6FB6FF62..0x6FB6FF85`, `0x6FB093CF..0x6FB093F5`)**:
   - `pItemsTxt = D2Common_GetItemText(pUnit->dwTxtFileNo)`
   - If `pItemsTxt->nQuest != 0` (`BYTE [pItemsTxt + 0x12A] != 0`) **AND `pItemsTxt->dwCode != 'leg '` (`0x2067656C`, Wirt's Leg)** -> `4` (**Gold**).
   - Wirt's Leg (`leg`) is explicitly excluded (`cmp dword ptr [eax+0x80], ' leg'`), so normal Wirt's Leg is **White** (or **Gray** when socketed/ethereal).
4. **Special Orange Items & Runes Override (`0x6FB6FF86..0x6FB6FFE9`, `0x6FB093F6..0x6FB09457`)**:
   - If `pItemsTxt->dwCode` is one of the 11 codes:
     - `'ceh '` (Charged Essence of Hatred)
     - `'bet '` (Burning Essence of Terror)
     - `'tes '` (Twisted Essence of Suffering)
     - `'fed '` (Festering Essence of Destruction)
     - `'toa '` (Token of Absolution)
     - `'dhn '` (Diablo's Horn)
     - `'bey '` (Baal's Eye)
     - `'mbr '` (Mephisto's Brain)
     - `'pk1 '` (Key of Terror)
     - `'pk2 '` (Key of Hate)
     - `'pk3 '` (Key of Destruction)
   - OR `D2Common_CheckItemType(pUnit, 74)` (`ITYPE_RUNE = 0x4A`) -> `8` (**Orange**).
5. **Gold Pile (`ITYPE_GOLD = 4`, `0x6FB7000E..0x6FB70095`)**:
   - Uses default `ebx = 0` (**White**), formatted as `"%d %s"` (`"%d Gold"`).

*(Note: Inventory hover tooltip `0x6FB44430..0x6FB444C4` applies the identical `dwCode != 'leg '` exclusion and 11-code + `ITYPE_RUNE` Orange override.)*

---

### 2. Ground Item Label Border (`D2Win.dll` `0x6F8F2E90` & `0x6F8F356C`)

- Both `D2Win_10013` (`0x6F8F2E90`, called by `D2Client_DrawGroundItemLabels` during Alt hold) and `D2Win_DrawFramedText` (`0x6F8F356C`, called by `D2Win_10085` for single-item hover without Alt) call `D2gfx_DrawSolidRectEx` (`0x6F8E7822`) once and `D2Win_DrawTextEx` (`0x6F8F2940`) once.
- Neither function ever calls `D2gfx_DrawRect`; ground item label plaques have **no outer border**.

---

### 3. Ground Item Label Background Fill & Opacity (`D2Client.dll` `0x6FB08FB0` & `D2Win.dll` `0x6F8F2E90`, `0x6F8F356C`)

`D2gfx_DrawSolidRectEx(left, top, right, bottom, dwColor, transMode)` is invoked with three distinct `(dwColor, transMode)` pairs:

| Mode | Condition | `dwColor` | `transMode` | Visual Result |
| :--- | :--- | :--- | :--- | :--- |
| **Alt held (`0x6FB08FB0`) — Unhovered** | Default per-item plaque (`0x6FB09339..0x6FB09346`) | `0` (`RGB(0,0,0)`) | `1` (50% alpha `0x80/0xFF`) | `rgba(0, 0, 0, 0.5)` |
| **Alt held (`0x6FB08FB0`) — Hovered** | Cursor inside plaque rect (`0x6FB0929E..0x6FB092D8`) OR item unit is hovered (`0x6FB092EA..0x6FB09316`) | `D2Win_10190(0, 64, 128)` (`0x6FB09008`) -> palette index `140` (`RGB(16, 36, 104)`) | `5` (highlight fill) | `rgba(16, 36, 104, 0.85)` |
| **Alt NOT held (`0x6FB70EAA`) — Hovered** | Single ground item hover via `D2Win_10085` -> `0x6F8F356C` | `0` (`RGB(0,0,0)`) | `2` (75% alpha `0xC0/0xFF`) | `rgba(0, 0, 0, 0.75)` |

# Diablo II Item Bitstream Specification (.d2s / D2Common)

> **Gold Standard Reference**: `D2Common!6FD77180` (Packing / Serialization) and `D2Common!6FD592C4` (Unpacking / Deserialization).  
> **Target Version**: Diablo II 1.10 / 1.13c Lord of Destruction character save (`.d2s`) item list.

---

## 1. Overview and Architecture

Diablo II stores item data inside character save files (`.d2s`), network packets, and memory structures as a **variable-length, bit-aligned stream**. Unlike byte-aligned structures, fields in the item stream are packed tightly with arbitrary bit widths (e.g. 1 bit, 3 bits, 7 bits, 9 bits, 11 bits, 12 bits) without byte padding between fields.

### 1.1 Bitstream Conventions
- **Byte and Bit Ordering**: Little-endian bitstream. Bits are read from lowest to highest within each byte (LSB first: bit 0 of byte 0, bit 1 of byte 0, ..., bit 7 of byte 0, bit 0 of byte 1, etc.).
- **String Encoding**:
  - Item base code (4 bytes / 32 bits): 4 ASCII characters right-padded with ASCII spaces (`0x20`), stored in byte order.
  - Personalized and Ear names: Null-terminated strings using 7-bit ASCII characters (`0x00` terminator is 7 zero bits).
- **Two Major Modes**:
  1. **Simple / Compact Item**: Items with the `Simple` flag (bit 11) set (potions, scrolls, gold, gems, runes, keys, simple quest items). Serialization terminates immediately after the item base code and socket count.
  2. **Extended Item**: Items with the `Simple` flag cleared (weapons, armor, jewelry, charms, complex items). Includes full fingerprint, ilvl, quality branch, defense/durability, sockets, and stat list blocks.

---

## 2. Complete Bitstream Layout

The table below outlines the sequential bitstream order executed by `D2Common!6FD592C4` (unpack) and `D2Common!6FD77180` (pack):

| Bit Offset (Rel) | Bit Width | Field Name | Type | Condition / Presence | Description |
|---|---|---|---|---|---|
| `0` | 16 | `magic` | ASCII | Always | `"JM"` header magic (`0x4A`, `0x4D`) |
| `16` | 32 | `dwFlags` | Bitmask | Always | Header flags (see §3 for bitmask breakdown) |
| `48` | 10 | `version` | uint | Always | Item format version (`0` or `101` for 1.10+) |
| `58` | 3 | `mode` | uint | Always | Location mode (0: Stored, 1: Equipped, 2: Belt, 3: Ground, 4: Cursor, 5: Dropping, 6: Socketed) |
| `61` | 32 or 15 | **Position Data** | Branch | Always | Dependent on `mode` (see §2.1 below) |
| — | 32 | `itemCode` | ASCII[4] | Always (except Ear) | 4 ASCII characters right-padded with space (e.g. `"swd "`, `"gld "`) |
| — | 3 | `socketedCount` | uint | Always (except Ear) | Number of gems/runes/jewels socketed inside this item (0..7) |
| *CUTOFF* | — | *Simple Item End* | — | `dwFlags.Simple == 1` | **If Simple Item flag is set, serialization STOPS here.** |
| — | 32 | `uniqueId` | uint32 | Extended item | Item GUID / seed (`dwInitSeed`, item fingerprint) |
| — | 7 | `ilvl` | uint | Extended item | Item level (0..127) |
| — | 4 | `quality` | uint | Extended item | Item quality tier (1..8, see §4) |
| — | 1 | `hasGraphic` | bool | Extended item | 1 if graphic variation index is present |
| — | 3 | `graphic` | uint | `hasGraphic == 1` | Graphic variant index (0..7) |
| — | 1 | `hasAutoAffix` | bool | Extended item | 1 if class auto-affix (Automagic) is present |
| — | 11 | `autoAffixId` | uint | `hasAutoAffix == 1` | Automagic affix ID (from `AutoMagic.txt`) |
| — | Variable | **Quality Data** | Branch | Extended item | Dependent on `quality` (see §4) |
| — | 16 | `runewordData` | uint | `dwFlags.Runeword == 1` | 12-bit Runeword ID (`Runes.txt`) + 4-bit parameter |
| — | Variable | `personalizedName`| String | `dwFlags.Personalized == 1`| 7-bit ASCII characters terminated by `0b0000000` (max 15 chars) |
| — | 5 | `tomeId` | uint | Code == `"ibk "` or `"tbk "` | Tome ID (5 bits) |
| — | 1 + 96 | `realmData` | Bytes | Extended item | 1 bit flag; if set, followed by 96 bits of realm data |
| — | 11 | `defense` | uint | Item kind is Armor | Current armor defense (value - 10 + `Armor.minac`) |
| — | 8 (+8) | `durability` | uint | Item has Durability | `maxDurability` (8 bits); if max > 0: `currentDurability` (8 bits) |
| — | 9 | `quantity` | uint | Item is Stackable | Current stack count (e.g. javelins, keys, arrows) |
| — | 4 | `totalSockets` | uint | `dwFlags.Socketed == 1` | Total number of sockets on the item (1..6) |
| — | Variable | **Set Bonuses** | Branch | `quality == 5` (Set) | 5 bits property list count; active set bonus stat lists (each terminated by `0x1FF`) |
| — | Variable | **Base Stat List** | StatList | Extended item | Stat modifier list (9-bit statId + params/values), terminated by `0x1FF` |
| — | Variable | **Runeword Stats** | StatList | `dwFlags.Runeword == 1` | Extra runeword stat list, terminated by `0x1FF` |

---

### 2.1 Positioning Branch (Offset 61)

The position encoding branches on `mode`:

1. **Ground / Dropping Mode (`mode == 3` or `mode == 5`)**:
   - `worldX`: 16 bits (World coordinate X)
   - `worldY`: 16 bits (World coordinate Y)
   - *Total*: 32 bits

2. **Equipped, Belt, Stored, Cursor, Socketed Mode (`mode != 3` and `mode != 5`)**:
   - `equippedSlot`: 4 bits (Equipped body slot index)
     - `0`: None
     - `1`: Head (Helm)
     - `2`: Neck (Amulet)
     - `3`: Torso (Armor)
     - `4`: Right Hand (Primary Weapon / Shield)
     - `5`: Left Hand (Secondary Weapon / Shield)
     - `6`: Right Finger (Ring)
     - `7`: Left Finger (Ring)
     - `8`: Waist (Belt)
     - `9`: Feet (Boots)
     - `10`: Hands (Gloves)
     - `11`: Alt Right Hand (Weapon swap)
     - `12`: Alt Left Hand (Weapon swap)
   - `gridX`: 4 bits (Inventory column `0..9`, Belt column `0..3`)
   - `gridY`: 4 bits (Inventory row `0..9`, Belt row `0..3`)
   - `storagePage`: 3 bits:
     - `0`: Inventory
     - `1`: Equipped (Body)
     - `2`: Belt
     - `4`: Horadric Cube
     - `5`: Stash
   - *Total*: 15 bits

---

## 3. Header Flags Bitmask (`dwFlags`, 32 bits)

The 32-bit integer at bit offset 16 controls item state and conditional decoding:

| Bit | Hex Value | Name | Description |
|---|---|---|---|
| `0` | `0x00000001` | `Identified` | `1` = Item is identified; `0` = Unidentified |
| `1` | `0x00000002` | `Unk1` | Reserved / unused |
| `2` | `0x00000004` | `Unk2` | Reserved / unused |
| `3` | `0x00000008` | `Socketed` | `1` = Item has sockets (and socket count field present) |
| `4` | `0x00000010` | `NewItem` | `1` = Item picked up or generated since game start |
| `5` | `0x00000020` | `Unk5` | Reserved / unused |
| `6` | `0x00000040` | `Unk6` | Reserved / unused |
| `7` | `0x00000080` | `IsEar` | `1` = Item is a player Ear |
| `8` | `0x00000100` | `StarterItem` | `1` = Starter / beginner equipment (e.g. cracked sash) |
| `9` | `0x00000200` | `Unk9` | Reserved / unused |
| `10` | `0x00000400` | `Unk10` | Reserved / unused |
| `11` | `0x00000800` | `Simple` | `1` = Compact item (stops after socketed count); `0` = Extended item |
| `12` | `0x00001000` | `Ethereal` | `1` = Ethereal (cannot be repaired, translucent art, stat bonus) |
| `13` | `0x00002000` | `Any` | Internal personalization / save flag |
| `14` | `0x00004000` | `Personalized` | `1` = Personalized name present (Anya quest reward) |
| `15` | `0x00008000` | `Gamble` | Gambling item flag |
| `16` | `0x00010000` | `Runeword` | `1` = Active Runeword (runeword data and stats present) |
| `17..31` | `0xFFFE0000` | `Reserved` | Engine and server internal flags |

---

## 4. Quality Field and Branches (4 bits)

The 4-bit `quality` field dictates the affix and identity layout:

| Value | Quality Tier | Encoded Fields |
|---|---|---|
| `1` | **Low Quality** | `qualitySubtype` (3 bits: `0` crude, `1` cracked, `2` damaged, `3` low quality) |
| `2` | **Normal** | None (standard base item) |
| `3` | **Superior** | `superiorSubtype` (3 bits: attack rating, defense, durability, etc.) |
| `4` | **Magic** | `prefixId` (11 bits, `MagicPrefix.txt`), `suffixId` (11 bits, `MagicSuffix.txt`) |
| `5` | **Set** | `setId` (12 bits, index into `SetItems.txt`) |
| `6` | **Rare** | `rareName1` (8 bits), `rareName2` (8 bits), followed by 6 affix slots (each 1 bit present + 11-bit id) |
| `7` | **Unique** | `uniqueId` (12 bits, index into `UniqueItems.txt`) |
| `8` | **Crafted** | `rareName1` (8 bits), `rareName2` (8 bits), followed by 6 affix slots (each 1 bit present + 11-bit id) |
| `9` | **Tempered** | Rare-style affix structure (expansion prototype remnant) |

### 4.1 Rare & Crafted Affix Slots (6 Slots)
Rare (6) and Crafted (8) items carry exactly 6 affix slots. For each slot `i = 0..5`:
1. Read `present` (1 bit).
2. If `present == 1`: read `affixId` (11 bits, index into `MagicPrefix.txt` or `MagicSuffix.txt`).
3. If `present == 0`: move to next slot.

---

## 5. Stat Lists and `ItemStatCost.txt` Bit Alignment

Diablo II encodes magical bonuses and base stats as an open-ended list of properties, terminated by the 9-bit sentinel `0x1FF` (decimal `511`).

### 5.1 Stat Entry Encoding Loop
1. Read `statId` (9 bits).
2. If `statId == 0x1FF`: **End of Stat List**.
3. Lookup `statId` in `ItemStatCost.txt`:
   - `CSvParam` / `Save Param Bits`: If non-zero, read `param` (`CSvParam` bits). Used for skill ID, character class ID, elemental masteries, or charges.
   - `CSvBits` / `Save Bits`: Read unsigned integer of length `CSvBits`.
   - `CSvSigned`: Indicates signed or unsigned interpretation.
   - `Save Add`: Value offset. `finalValue = rawValue - SaveAdd`.
4. Store `{ statId, statName, param, value }` in item's stat list.
5. Repeat from Step 1.

### 5.2 Multiple Stat Blocks
Extended items can contain multiple stat list blocks in sequence:
- **Base Stats Block**: Always present on extended items; ends with `0x1FF`.
- **Set Item Bonuses**: For Set items, 5 bits indicate bonus properties; each active set bonus tier has its own stat list ending with `0x1FF`.
- **Runeword Bonuses**: For Runewords (`dwFlags.Runeword == 1`), a dedicated runeword bonus stat list follows, ending with `0x1FF`.

---

## 6. Player Ear Items (`dwFlags.IsEar == 1`)

If bit 7 of `dwFlags` is set:
- Item code is `"ear "`.
- Followed by:
  - `classIndex`: 3 bits (0: Amazon, 1: Sorceress, 2: Necromancer, 3: Paladin, 4: Barbarian, 5: Druid, 6: Assassin).
  - `level`: 7 bits (Player level at time of death).
  - `playerName`: 7-bit ASCII characters terminated by `0b0000000`.
- Ear decoding terminates here; no extended stats or durability are encoded.

---

## 7. Lossless Round-Trip and Preservation Guarantee

To ensure perfect interoperability between this engine, official Diablo II binaries, and third-party save editors (e.g. Hero Editor, Gomule):

1. **`rawFlags: number`**: The raw 32-bit flags integer is preserved verbatim so unknown, reserved, or engine-specific flag bits are never stripped or shifted.
2. **`unknownBits?: Uint8Array`**: Any trailing padding bits, vendor/realm payloads, or unparsed bitstream extensions are retained alongside the structured fields.
3. **Deterministic Serialization**: When re-packing to bitstream via `D2Common!6FD77180`, fields are written back in the identical sequence and bit alignments specified in this document.

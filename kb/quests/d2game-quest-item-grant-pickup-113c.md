# D2Game Quest Item Grant (`QUESTS_CreateItem`) & Pickup Validation (1.13c Ground Truth)

## Binary Evidence

- **Quest Item Creation & Full-Inventory Drop**: `D2Game.dll` @ `0x6fc95df0` (`QUESTS_CreateItem`, called with `bDropIfFull = 1` across `D2Game.dll` quest handlers such as A5Q3 Malah `0x6fc56470..0x6fc56586`)
- **Ground Item Pickup Handler**: `D2Game.dll` @ `0x6fcf7020` (`ITEMS_PickUpGroundItem`)
- **Quest Item Duplicate Pickup Check**: `D2Game.dll` @ `0x6fcf2f00` (`ITEMS_CheckQuestItemPickup`) and `0x6fcf2070` (`ITEMS_CountPlayerItemsByCode`)

## 1. `QUESTS_CreateItem` (`0x6fc95df0`) — Full-Inventory Fallback

When an NPC grants a quest item (e.g., Akara granting `bkd`, Alkor granting `xyz`, Malah granting `ice` `Malah's Potion` or `tr2` `Scroll of Resistance` at `0x6fc56470..0x6fc56586`):

1. `QUESTS_CreateItem` attempts to place the created quest item into the player's inventory grid (`INVENTORY_PlaceItemInGrid`).
2. If the player's inventory has no free grid slot for the item (`bDropIfFull = 1`):
   - It does **not** silently discard the item or fail the interaction.
   - Instead, it spawns the item on the ground at a free subtile near the player/NPC (`D2Game_SpawnGroundItem`, action `0x02` drop) and plays sound `23` (`player_cantcarry_1` / `cantCarry1`).

## 2. A5Q3 (`Prison of Ice`, Word `37` / `0x25`, Protocol ID `0x21`) Full State Machine (`0x6fc77d80..0x6fc7fcff`)

- **Initial Malah Interaction (`hcIdx = 513`, `0x6fc7f625`, Scroll `0x4e94` `A5Q3Init`)**:
  - Talking to Malah before discovering Frozen Anya **never** grants `'ice '` (`Malah's Potion`).
  - Once `a5q2` (`Rescue on Mount Arreat`) is completed, `A5Q3Init` sets `fState = 2` and `w37 |= 0x0004` (`QFLAG_QSTARTED`, `status = 1` `qstsa5q31`: `"Look for Anya under the Crystalline Passage by the Frozen River."`). Before `a5q2` completion, Malah does not start `a5q3`.
- **Entering Crystalline Passage / Glacial Trail / Frozen River (`Area 112..114`, `0x6fc7f3f0..0x6fc7f495`)**:
  - While `a5q3` is neither completed (`0x0001`) nor reward-pending (`0x0002`), entering `112..114` sets `fState = 3` and `w37 |= 0x000C` (`QFLAG_QSTARTED | QFLAG_CUSTOM3`; `status = 1` in `112..113`, `status = 2` `qstsa5q31a` in `114`).
- **Discovering Frozen Anya Without `'ice '` (`Objects.txt 558` @ `0x6fc7cd50..0x6fc7cde3` / `NPC 527` @ `0x6fc7fac9..0x6fc7fb2b`)**:
  - Emits `20131` (`0x4ea3` `A5Q3FoundAnyaAnya`), advances `fState = 4`, and sets `bState = 3` (`qstsa5q32`: `"Talk to Malah."`, tracked via `QFLAG_CUSTOM4` = `0x0010`, cleared on `.d2s` new-game entry at `0x6fc781bd`).
- **Malah Thawing Potion Handout (`0x6fc7db44` & `0x6fc7f692`, Scroll `0x4e9f` `A5Q3AfterAnyaMalah`)**:
  - Offered **only** when Frozen Anya has been discovered (`fState == 4` / `QFLAG_CUSTOM4`) and the player does not already possess `'ice '`.
  - Grants `'ice '` via `QUESTS_CreateItem` (`0x6fc56470`, inventory or ground drop if full) and sets `status = 4` (`qstsa5q33`: `"Use the potion Malah gave you to thaw Anya."`).
- **Thawing Frozen Anya (`558` / `527`, `0x6fc7ce39..0x6fc7ce95`)**:
  - Consumes `'ice '` and sets `QFLAG_REWARDPENDING | QFLAG_COMPLETEDNOW` (`0x2002`, `status = 5` `qstsa5q34`), spawning Town Anya (`512`) and Nihlathak's Temple red portal (`60 -> 121`) in Harrogath (`InitFn 66` @ `0x6fc7eb30`).
- **Symmetric Dual-Reward Completion (`Malah 513` @ `0x6fc7f73e..0x6fc7f94a` & `Town Anya 512` @ `0x6fc7f956..0x6fc7fac4`)**:
  - **Malah (`513`)**: when `QFLAG_REWARDPENDING` (`0x0002`) is set and `QFLAG_CUSTOM8` (`0x0100`) is `0`, mints `'tr2'` (`Scroll of Resistance`), sets `QFLAG_CUSTOM8` (`0x0100`), and clears `QFLAG_REWARDPENDING` + sets `QFLAG_REWARDGRANTED | QFLAG_COMPLETEDNOW` (`0x2001`) **only if `QFLAG_CUSTOM9` (`0x0200`) is already set** (`0x6fc7f7cb`); otherwise `QFLAG_REWARDPENDING` stays set (`status = 6` `qstsa5q35`: `"Talk to Anya."`). If an unconsumed `'tr2'` (`0x0100` set, `0x0080` clear) is lost, Malah replaces it once per game (`0x6fc7f89f..0x6fc7f94a`).
  - **Town Anya (`512`)**: when `(w37 & 0x0003) != 0` and `QFLAG_CUSTOM10` (`0x0400`) is `0`, mints the class-specific Rare item, sets `QFLAG_CUSTOM9 | QFLAG_CUSTOM10` (`0x0600`), and clears `QFLAG_REWARDPENDING` + sets `QFLAG_REWARDGRANTED | QFLAG_COMPLETEDNOW` (`0x2001`) **only if `QFLAG_CUSTOM8` (`0x0100`) is already set** (`0x6fc7fa8e`).

## 3. `ITEMS_PickUpGroundItem` (`0x6fcf7020`) — Pre-Removal Validation

In `D2Game.dll` @ `0x6fcf7020`:

1. **Quest Item Uniqueness Check (`0x6fcf7103 -> 0x6fcf2f00`)**:
   - Before removing the item from the ground room cell, `0x6fcf2f00` checks `ItemsTxt.nQuest` (and equivalent upgraded/combined quest item codes: `bks`/`bkd`, `msf`/`vip`/`hst`, `j34`/`g34`/`xyz`, `g33`/`d33`, `qey`/`qhr`/`qbr`/`qf1`/`qf2`, `tr1`, `tr2`, `ice`, `box`, `ass`, `hdm`, `bbb`, `hfh`, `mss`; excluding `leg` which has `unique = 0`).
   - If the player already holds the quest item (or its quest equivalent) in any container (`inventory`, `stash`, `cube`, `cursor`, `equipped`, `belt`), pickup is rejected **before** removing the ground item, and `S2C 0x2C` sound `19` (`impossible1`) is sent (`0x6fcf2fe3`).
2. **Cursor Pickup (`toCursor = 1`, `0x6fcf71c2`)**:
   - If the player's cursor already holds an item (`D2Common_GetCursorItem(pInventory) != NULL`), pickup is rejected **before** removing the ground item.
3. **Inventory Pickup (`toCursor = 0`, `0x6fcf711f..0x6fcf7145`)**:
   - Attempts auto-placement into inventory (`0x6fcf5490`).
   - If the inventory has no room, sends `S2C 0x2C` sound `23` (`cantCarry1` at `0x6fcf712a`) and returns **without** removing the ground item or placing it onto the cursor.

## 4. Consumable Quest Reward Items (`ass`, `xyz`, `tr2`) & Custom Quest Bits (`0x6fcf9e73..0x6fcf9f52`)

In `D2Game.dll` (`ITEMS_UseConsumableItem` @ `0x6fcf9e73..0x6fcf9f52`), the three consumable quest reward items **never** grant their stat rewards directly on boss kill or NPC turn-in; instead, the quest handler arms a custom bit on the player's `pQuestData` word, and consuming the item validates and updates that custom bit before removing the item:

| Item Code | Item Name | Quest Word | Armed on Kill / Turn-In | Checked & Mutated on Item Use (`0x6fcf9e73..0x6fcf9f52`) | Permanent Stat Grant |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `'ass '` | Book of Skill | Word `9` (`0x09`, `a2q1`) | Radament death (`0x6fce6163..0x6fce6185`) drops `'ass'` and sets bit `5` (`0x0020`, `QUEST_FLAG_CUSTOM_5_113C`) + bit `13` (`0x2000`) + bit `0` (`0x0001`). Does **not** add `newskills`. | `0x6fcf9e7b`: requires bit `5` (`0x0020`) == 1. Clears bit `5` (`0x6fcf9e93`), adds `+1` to stat `5` (`newskills` @ `0x6fcf9e9f`), sends `S2C 0x5D`, and removes `'ass'` (`0x6fcf9f43`). | `+1` `newskills` (stat `5`) |
| `'xyz '` | Potion of Life | Word `20` (`0x14`, `a3q1`) | Alkor turn-in (`0x6fd08c5a..0x6fd08d9a`) removes `'g34'` (Golden Bird), mints `'xyz'`, and sets bit `0` (`0x0001`) + bit `13` (`0x2000`) + bit `5` (`0x0020`, `QUEST_FLAG_CUSTOM_5_113C`). Does **not** add `maxhp`. | `0x6fcf9ed1`: requires bit `5` (`0x0020`) == 1. Clears bit `5` (`0x6fcf9ee2`), adds `+0x1400` (`20 << 8`) to stat `7` (`maxhp` @ `0x6fcf9ef1`), sends `S2C 0x5D`, and removes `'xyz'` (`0x6fcf9f43`). | `+20` `maxhp` (`+0x1400` fixed-point, stat `7`) |
| `'tr2 '` | Scroll of Resistance | Word `37` (`0x25`, `a5q3`) | Malah reward turn-in (`0x6fc7f73e..0x6fc7f7ed`) mints `'tr2'`, sets bit `8` (`0x0100`, `QUEST_FLAG_CUSTOM_8_113C`), and clears bit `1` (`0x0002`) + sets bit `0` (`0x0001`) + bit `13` (`0x2000`) once Town Anya's bit `9` (`0x0200`) is also set (`0x6fc7f7cb` / `0x6fc7fa8e`). Does **not** add resistances. | `0x6fcf9f07..0x6fcf9f1c`: requires bit `8` (`0x0100`) == 1 **and** bit `7` (`0x0080`, `QUEST_FLAG_CUSTOM_7_113C`) == 0. Sets bit `7` (`0x6fcf9f28`), calls `0x6fc7b0b0` (grants `+10` to stats `39, 41, 43, 45` per difficulty where bit `7` is set), sends `S2C 0x5D`, and removes `'tr2'`. | `+10` Fire/Light/Cold/Poison Resist (stats `39, 41, 43, 45`) |

- **Rejection Path (`0x6fcf9eab`)**: If the required custom bit condition fails (e.g., bit `5` is `0` for `'ass'`/`'xyz'`, or bit `8` is `0` / bit `7` is `1` for `'tr2'`), `D2Game.dll` sends `S2C 0x2C` sound `19` (`0x13` = `impossible1` via `0x6fcfffd0`) and returns `1` **without** calling `0x6fcf39b0` (the item remains in the player's inventory/belt and no stats are added).

## 5. A3Q1 (`The Golden Bird`, Word `20` / `0x14`, Quest ID `0x12`) Full Chain (`0x6fd092d0`, `0x6fd08010`, `0x6fd07640`, `0x6fd08b60`, `0x6fd03ce0`)

- **Objects `244` and `246` (`ratnest` in `Objects.txt`) are NOT A3Q1 Quest Objects**:
  - Row `244` has `OperateFn = 14` (generic nest/chest container) and `Parm0 = 18` (`MonStats.txt` `swarm1`).
  - Row `246` has `OperateFn = 4` (regular chest/container) and `Parm0 = 18`.
  - Neither object drops `j34` nor modifies `a3q1`.
- **Step 1 — First Act 3 Unique/SuperUnique Boss Kill Drops Jade Figurine (`j34`, `0x6fc44b32 -> 0x6fc56140 -> 0x6fd08200 -> 0x6fd08010`)**:
  - `0x6fc56140` attaches `0x6fd08010` (`MONSTERDEATH`) to unique/superunique/boss monsters spawned in Act 3 (`nAct == 2`, `areaId` `75..102`), excluding `hcIdx == 407` (`0x197`, Fetish Gidbinn boss) and town NPCs/pets.
  - On death (`0x6fd08010`), if `a3q1` has not already dropped `j34` in this game (`[ebp+0x14] == 0`) and the killer does not have `a3q1` bit `0` (`0x0001`, `QFLAG_REWARDGRANTED`) set, spawns `'j34 '` (quality `2`) at the monster's position and sets `[ebp+0x14] = 1`.
- **Step 2 — Picking Up `j34` / `g34` (`0x6fd07640`, `pfnCallback[3]`)**:
  - Picking up `'j34 '` (`0x6fd076ee..0x6fd07741`): when `(w20 & 0x0003) == 0`, if bit `6` (`0x0040`, `QUEST_FLAG_CUSTOM_6_113C`) is `0`, sets bit `6` and plays sound `72` (`0x48`), and syncs quest status (`filterStatus = 1` = `qstsa3q41`: "Ask the council about the Jade Figurine.").
  - Picking up `'g34 '` (`0x6fd076b9..0x6fd076d1`): when `(w20 & 0x0003) == 0`, syncs quest status (`filterStatus = 3` = `qstsa3q43`, or `4` if bit `4` is set).
- **Step 3 — Cain (`hcIdx = 245` / `0xf5`, `0x6fd08bb4..0x6fd08c32`)**:
  - Scroll `0x20f` (`0x6fd08bb4..0x6fd08bf4`): when holding `j34` and bit `2` (`0x0004`, `QUEST_FLAG_STARTED_113C`) is `0`, sets bit `2` (`filterStatus = 2` = `qstsa3q42`: "Show Meshif the Figurine").
  - Scroll `0x213` (`0x6fd08bf7..0x6fd08c32`): when holding `g34` and bit `4` (`0x0010`, `QUEST_FLAG_CUSTOM_4_113C`) is `0`, sets bit `4` (`filterStatus = 4` = `qstsa3q44`: "Give the Golden Bird to Alkor").
- **Step 4 — Meshif (`hcIdx = 264` / `0x108`, `0x6fd08e1e..0x6fd08ea0`, Scroll `0x211`)**:
  - When `(w20 & 0x0003) == 0` and the player holds `j34`, deletes `j34` (`0x6fd08e59`), mints Golden Bird (`'g34 '`) via `QUESTS_CreateItem` (`0x6fd08e7a`), and syncs quest status (`filterStatus = 3` = `qstsa3q43`: "Ask the council about the Golden Bird").
- **Step 5 — Alkor (`hcIdx = 254` / `0xfe`, `0x6fd08c5a..0x6fd08dc0`)**:
  - Alkor **never** accepts `j34`.
  - Scroll `0x216` (`0x6fd08c69..0x6fd08d12`): when `(w20 & 0x0003) == 0` and the player holds `g34`, deletes `g34` (`0x6fd08cb7`) and sets bit `1` (`0x0002`, `QUEST_FLAG_REWARD_PENDING_113C`, `filterStatus = 5` = `qstsa3q45`: "Talk to Alkor").
  - Scroll `0x21a` (`0x6fd08d13..0x6fd08dc0`): when `(w20 & 0x0001) == 0 && (w20 & 0x0002) != 0`, clears bit `1` (`0x6fd08d46`), sets bit `0` (`0x0001`), bit `13` (`0x2000`), and bit `5` (`0x0020`, `QUEST_FLAG_CUSTOM_5_113C`), and mints `'xyz '` (Potion of Life) via `QUESTS_CreateItem` (`0x6fd08d9a`).
- **Step 6 — A3Q1 Status Filter (`0x6fd03ce0..0x6fd03df0`)**:
  - `(w20 & 0x0002) != 0` -> `5` (`qstsa3q45`)
  - `(w20 & 0x0001) != 0` -> `(w20 & 0x2000) != 0 ? 13 : 11` (`qstsComplete` / `qstsprevious`)
  - holding `g34` -> `(w20 & 0x0010) != 0 ? 4 : 3` (`qstsa3q43` / `qstsa3q44`)
  - holding `j34` -> `(w20 & 0x0004) != 0 ? 2 : 1` (`qstsa3q41` / `qstsa3q42`)
  - `(w20 & 0x0010) != 0` -> `4`
  - `(w20 & 0x0004) != 0` -> `2`
  - `(w20 & 0x0040) != 0` -> `1`
  - otherwise -> `0`.

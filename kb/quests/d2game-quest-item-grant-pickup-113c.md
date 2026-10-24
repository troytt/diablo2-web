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

## 2. A5Q3 (`Prison of Ice`) Malah (`hcIdx = 513`) State Machine (`0x6fc56470..0x6fc56586`)

- **Initial talk to Malah (Anya still frozen)**:
  - Checks if `a5q3` is neither completed (`0x0001`) nor reward-pending (`0x0002`), and the player does not already possess `ice` (`Malah's Potion`) in any container or on the ground.
  - Grants `ice` via `QUESTS_CreateItem` (inventory if space is available, or dropped on the ground if inventory is full) and marks the quest state (`QUEST_FLAG_STARTED_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C`) so talking to Malah repeatedly does not mint duplicate potions.
- **Interacting with Frozen Anya (`classId = 558`)**:
  - Consumes `ice` from the player's items and sets `QUEST_FLAG_REWARD_PENDING_113C` (`0x0002`) on `a5q3`.
- **Reward talk to Malah (`REWARD_PENDING` set, `COMPLETED` not set)**:
  - Clears `QUEST_FLAG_REWARD_PENDING_113C` (`0x0002`), sets `QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C` (`0x0001 | 0x2000`), and grants `tr2` (`Scroll of Resistance`) via `QUESTS_CreateItem` (inventory or ground drop if full) if the player does not already have `tr2`.
  - Subsequent talks to Malah see `COMPLETED` set and `REWARD_PENDING` cleared, preventing duplicate `tr2` grants.

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

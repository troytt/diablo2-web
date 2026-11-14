# 1.13c Quest Item Possession vs. Ground Pickup Validation (`D2Game.dll`)

Authoritative disassembly of Diablo II: Lord of Destruction v1.13c `D2Game.dll` (`ImageBase = 0x6FC20000`) and MPQ data tables (`Weapons.txt`, `Misc.txt`) separating **quest item drop/mint possession checks** (`QUESTS_FindItemByCode`) from **ground item pickup validation** (`ITEMS_CheckQuestItemPickup` / `ITEMS_HasConflictingQuestItem`).

## 1. MPQ `Weapons.txt` & `Misc.txt` Quest Columns

| Code | Name | Table | `quest` (`+0x12A`) | `questdiffcheck` (`+0x12B`) | `unique` | Associated Quest (`wordIndex`) |
| --- | --- | --- | --- | --- | --- | --- |
| `leg` | Wirt's Leg | `Weapons.txt` | `1` | `1` | `0` | Tristram / Secret Cow Level |
| `hdm` | Horadric Malus | `Weapons.txt` | `4` | `1` | `1` | `a1q5` (`0x03`, Tools of the Trade) |
| `bks` | Scroll of Inifuss | `Misc.txt` | `5` | `1` | `1` | `a1q3` (`0x04`, The Search for Cain) |
| `bkd` | Key to the Cairn Stones | `Misc.txt` | `5` | `1` | `1` | `a1q3` (`0x04`, The Search for Cain) |
| `box` | Horadric Cube | `Misc.txt` | `10` | `0` | `0` | `a2q2` (`0x0A`, Horadric Staff) |
| `tr1` | Horadric Scroll | `Misc.txt` | `10` | `1` | `1` | `a2q2` (`0x0A`, Horadric Staff) |
| `msf` | Staff of Kings | `Weapons.txt` | `10` | `1` | `1` | `a2q2` (`0x0A`, Horadric Staff) |
| `vip` | Amulet of the Viper | `Misc.txt` | `10` | `1` | `0` | `a2q2` (`0x0A`, Horadric Staff) |
| `hst` | Horadric Staff | `Weapons.txt` | `10` | `1` | `1` | `a2q2` (`0x0A`, Horadric Staff) |
| `ass` | Book of Skill | `Misc.txt` | `15` | `1` | `1` | `a2q1` (`0x09`, Radament's Lair) |
| `bbb` | Lam Esen's Tome | `Misc.txt` | `16` | `1` | `1` | `a3q4` (`0x11`, Lam Esen's Tome) |
| `qey` | Khalim's Eye | `Misc.txt` | `17` | `1` | `0` | `a3q3` (`0x12`, Khalim's Will) |
| `qhr` | Khalim's Heart | `Misc.txt` | `17` | `1` | `0` | `a3q3` (`0x12`, Khalim's Will) |
| `qbr` | Khalim's Brain | `Misc.txt` | `17` | `1` | `0` | `a3q3` (`0x12`, Khalim's Will) |
| `qf1` | Khalim's Flail | `Weapons.txt` | `17` | `1` | `1` | `a3q3` (`0x12`, Khalim's Will) |
| `qf2` | Khalim's Will | `Weapons.txt` | `17` | `1` | `1` | `a3q3` (`0x12`, Khalim's Will) |
| `d33` | Decoy Gidbinn | `Weapons.txt` | `18` | `1` | `1` | `a3q2` (`0x13`, Blade of the Old Religion) |
| `g33` | The Gidbinn | `Weapons.txt` | `18` | `1` | `1` | `a3q2` (`0x13`, Blade of the Old Religion) |
| `j34` | A Jade Figurine | `Misc.txt` | `19` | `1` | `1` | `a3q1` (`0x14`, The Golden Bird) |
| `g34` | The Golden Bird | `Misc.txt` | `19` | `1` | `1` | `a3q1` (`0x14`, The Golden Bird) |
| `xyz` | Potion of Life | `Misc.txt` | `19` | `1` | `0` | `a3q1` (`0x14`, The Golden Bird) |
| `mss` | Mephisto's Soulstone | `Misc.txt` | `23` | `1` | `1` | `a4q2` (`0x1B`, Hell's Forge) |
| `hfh` | Hellforge Hammer | `Weapons.txt` | `25` | `1` | `1` | `a4q2` (`0x1B`, Hell's Forge) |
| `ice` | Malah's Potion | `Misc.txt` | `32` | `1` | `0` | `a5q3` (`0x25`, Prison of Ice) |
| `tr2` | Scroll of Resistance | `Misc.txt` | `32` | `1` | `1` | `a5q3` (`0x25`, Prison of Ice) |

## 2. `QUESTS_FindItemByCode` (`0x6FC2E660..0x6FC2E73C`) & `ACT3Q5_CountFlailNeeds` (`0x6FD036A0..0x6FD0374F`)

`QUESTS_FindItemByCode(pGame /* ebx */, pPlayer /* eax */, dwCode /* [esp+4] */)` inspects the player's cursor (`0x6FC2E676`) and inventory node list (`0x6FC2E6C0..0x6FC2E735`):

- Compares **exact** 4-byte `dwCode` (`0x6FC2E687`, `0x6FC2E6DE: cmp ebp, eax`).
- Skips trade-partner preview nodes (`0x6FC2E6E8: cmp al, 0x1; je 0x6FC2E72B`).
- When `ItemsTxt.nQuest != 0` (`+0x12A`) and `ItemsTxt.nQuestDiffCheck != 0` (`+0x12B`, `0x6FC2E70C`), requires `D2Common_GetUnitStat(pItem, 0x164 /* STAT_QUESTITEMDIFFICULTY */, 0) >= pGame->nDifficulty` (`0x6FC2E718..0x6FC2E729`).

In `ACT3Q5_CouncilDeath` (`0x6FD07DB0`) -> `ACT3Q5_CountFlailNeeds` (`0x6FD036A0`):

- `0x6FD03706..0x6FD03736`: for each eligible Act 3 player (`cmp al, 2` at `0x6FD036C8`), if `!QUESTRECORD_GetQuestState(pQuestFlags, 0x12 /* a3q3 */, 0)`, checks `QUESTS_FindItemByCode(pPlayer, 'qf1 ')` (`0x6FD0371B`) and `QUESTS_FindItemByCode(pPlayer, 'qf2 ')` (`0x6FD0372B`). Only `'qf1 '` or `'qf2 '` satisfies the flail check — carrying `qey`, `qhr`, or `qbr` does **not** increment or satisfy `'qf1 '`/`'qf2 '`, so `[edi+0x3C]` (`nPlayersNeedingFlail`) is incremented (`0x6FD03734`).
- `0x6FD07E47..0x6FD07E95`: loops `0 .. [esi+0x3C] - 1` calling `D2Game_DropItem` (`0x6FC31A70`) with `'qf1 '` (`quality = 7`) and sets `bFlailDropped = 1` (`[esi+0x0D] = 1`).
- Likewise, quest object/NPC checks only suppress drops or minting upward along an item's upgrade chain (`bks -> bkd`, `msf/vip -> hst`, `j34 -> g34 -> xyz`, `g33 -> d33`, `qey/qhr/qbr/qf1 -> qf2`), never downward from assembled items to raw ingredients.

## 3. `ITEMS_CheckQuestItemPickup` (`0x6FCF2F00..0x6FCF31AD`) & `ITEMS_HasConflictingQuestItem` (`0x6FCF2070..0x6FCF22B8`)

When a player clicks a ground item (`0x6FCF7020 -> 0x6FCF2F00`):

1. **`UniqueItems.txt` `carry1 = 1` (`0x6FCF2F45..0x6FCF2F90`)**: rejects picking up a duplicate `carry1` unique (`#357` Gheed's Fortune, `#381` Annihilus, `#400` Hellfire Torch).
2. **Custom-Bit & Completed-Quest Gates (`0x6FCF2F94..0x6FCF3117` + `.data` `0x6FD22CC0`)**:
   - `'ass '` (`0x6FCF2FA8..0x6FCF2FCF`): requires `QUESTRECORD_GetQuestState(pQuestFlags, 0x09 /* a2q1 */, 5 /* 0x0020 */) != 0`.
   - `'j34 '` (`0x6FCF2FD8..0x6FCF2FFB`): rejected if `QUESTRECORD_GetQuestState(pQuestFlags, 0x14 /* a3q1 */, 0 /* 0x0001 */) != 0`.
   - `'xyz '` (`0x6FCF2FFE..0x6FCF3011`): requires `QUESTRECORD_GetQuestState(pQuestFlags, 0x14 /* a3q1 */, 5 /* 0x0020 */) != 0`.
   - `'tr2 '` (`0x6FCF3036..0x6FCF306B`): requires `0x25` (`a5q3`) bit `8` (`0x0100`) set and bit `7` (`0x0080`) clear.
   - `nQuest == 10` (`0x6FCF3078..0x6FCF30AA`): if `0x0A` (`a2q2`) bit `0` (`0x0001`) is set, rejects `'msf'`, `'vip'`, `'hst'`, and `'tr1'`, while **explicitly exempting `'box '`** (`0x6FCF3098: cmp dword ptr [esi+0x80], 0x20786F62; je 0x6FCF311D`).
   - `nQuest == 5` (`0x6FCF30AD..0x6FCF30D9`): if `0x04` (`a1q3`) bit `0` (`0x0001`) is set, rejects `'bks'` and `'bkd'` (`'leg '` has `nQuest = 1` and is also exempted at `0x6FCF30C7`).
   - `.data` table at `0x6FD22CC0` (`0x6FCF30DC..0x6FCF3117`, 4 pairs `{ dwQuestId, dwItemQuestVal }`):
     - `{ 0x03 /* a1q5 */, 0x04 /* hdm */ }`
     - `{ 0x12 /* a3q3 */, 0x11 /* qey, qhr, qbr, qf1, qf2 */ }`
     - `{ 0x13 /* a3q2 */, 0x12 /* g33, d33 */ }`
     - `{ 0x1B /* a4q2 */, 0x19 /* hfh */ }`
3. **Symmetric Conflict Check (`0x6FCF2070..0x6FCF22B8`, invoked for player at `0x6FCF3124` and hired pets/mercenaries at `0x6FCF318B`)**:
   - Rejects identical `dwCode` (`0x6FCF218B`).
   - Rejects symmetric upgrade/component pairs when `nQuest` matches (`0x6FCF2173`):
     - `'j34 ' <-> 'g34 '` (`0x6FCF2193..0x6FCF21B3`)
     - `'bks ' <-> 'bkd '` (`0x6FCF21B9..0x6FCF21D9`)
     - `'d33 ' <-> 'g33 '` (`0x6FCF21DF..0x6FCF21FF`)
     - `'hst ' <-> 'msf '` and `'hst ' <-> 'vip '` (`0x6FCF2205..0x6FCF2247`; `'msf'` and `'vip'` do not conflict with each other)
     - `'qf2 ' <-> 'qf1 '`, `'qf2 ' <-> 'qhr '`, `'qf2 ' <-> 'qey '`, `'qf2 ' <-> 'qbr '` (`0x6FCF2249..0x6FCF229A` via `0x6FCF1A00`; individual organs and `'qf1'` do not conflict with one another).

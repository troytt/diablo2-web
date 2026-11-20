# D2Common 1.13c: item bitstream stat lists, property functions, socket cap, and requirement formulas

> Ground truth: `samples/d2/D2Common.dll` v1.13c (image base `0x6FD50000`) and the MPQ tables
> `data\global\excel\{ItemStatCost,Properties,ItemTypes}.txt` (`samples/d2/Patch_D2.mpq`).
> This page adds to the existing bitstream notes (`D2Common.11105` / `0x6fd7a600`) the parts that were
> not written down yet: how stat values are scaled and chained, how the encoder writes the stat list,
> what each `Properties.txt` function writes, and the exact strength/dexterity/level requirement rules.

## 1. Item bitstream decoder (`0x6fd7a600` extended, `0x6fd7c0c0` compact)

Field order for extended items, as read by the binary (version >= `0x5D`):

| Step | Bits | Condition | Address |
|---|---|---|---|
| version, mode, position | 10, 3, 16+16 or 4+4+4+3 | always | `0x6fd7a612..0x6fd7a71b` |
| code | 32 | not an ear | `0x6fd7a728` |
| stop | – | flag `0x02000000` set | `0x6fd7a746` |
| socketed children | 3 | – | `0x6fd7a784` |
| guid | 32 | save format only | `0x6fd7a793` |
| ilvl, quality | 7, 4 | – | `0x6fd7a7b0`, `0x6fd7a7da` |
| graphic | 1 (+3) | – | `0x6fd7a7f0` |
| automagic | 1 (+11) | – | `0x6fd7a89b` |
| quality data | jump table `0x6fd7bf60` (index = quality-1) | see below | |
| runeword | 16 | flag `0x04000000` | `0x6fd7ac10` |
| ear (3 + 7 + 7-bit chars until 0) or personalized name (7-bit chars until 0) | – | flag `0x10000` / `0x01000000` | `0x6fd7ac4c..0x6fd7acdd` |
| realm data | 1 (+32+32 [+32 if version > `0x5D`]) | save format and version > `0x56` | `0x6fd7acdf` |
| armor defense | `Save Bits` of stat 31, minus `Save Add` | ItemTypes `armo` (`0x32`) | `0x6fd7ad3f` |
| max durability | `Save Bits` of stat 73 | `armo` or `weap` (`0x2D`) | `0x6fd7adff`, `0x6fd7b14c` |
| durability | stat 72 `Save Bits` (8 if version <= `0x5F`) | max durability != 0 | `0x6fd7ae42`, `0x6fd7b18b` |
| gold amount | 1 + 12/32 | ItemTypes `gold` | `0x6fd7b1b0` |
| quantity | 9 (8 if version <= `0x50`) | stackable | `0x6fd7b1df` |
| socket count | stat 194 `Save Bits` (4) | flag `0x800` | `0x6fd7b21a` |
| set mask | 5 | version > `0x54` and quality 5 | `0x6fd7b27f` |
| stat lists | base, then one per set-mask bit, then runeword | save format or flag `0x10` (identified) | `0x6fd7b252` |

Quality jump table `0x6fd7bf60`: 1 and 3 → 3 bits (`0x6fd7a913`); 2 → `0x6fd7a927` (charm `ItemTypes`
13: 1 + 11 bits when save/identified; body part type 40 and not type 7: 10 bits; scroll type 22 or book
type 18: 5 bits written as magic suffix 0); 4 → 11 + 11; 5 → 12; 6 and 8 → 8 + 8 (if save/identified)
then six slots of `1 [+11]` in the order prefix, suffix, prefix, suffix, prefix, suffix (written to item
data `+0x38..+0x42`); 7 → 12; 9 → 8 + 8.

Compact items (`0x6fd7c0c0`): ears read class 3, level 7 and the 7-bit name, then fall through to the
same tail as every other compact item (`0x6fd7c2d7`): the quest difficulty field (version > `0x5C`,
stat 356 `Save Bits`) and **the realm data bit (save format and version > `0x56`, `0x6fd7c3e3`)**. So ears
in a `.d2s` file carry the realm bit too.

### Stat values

Stat reader loop: `0x6fd7b3b2..0x6fd7bdb9`, special-case jump table `0x6fd7bfe8` / `0x6fd7bf84`.

* Most stats use the generic reader `0x6fd79d90`: read `Save Param Bits` (if > 0), then `Save Bits`,
  `value = (raw - Save Add) << ValShift` (`shl eax, cl` with `cl = ISC +0x18`, `0x6fd79e92`).
* So stats with a `ValShift` are stored in fixed point in the stat list: `maxhp` (7), `maxmana` (9),
  `maxstamina` (11), `item_hp_perlevel` (216), `item_mana_perlevel` (217), all with `ValShift = 8`.
  For example, +30 life is saved as `raw = 30 + 32` and becomes `30 << 8 = 7680` in the stat list.
* Chained stats (one 9-bit id, several values): 17 → 17, 18; 48 → 48, 49; 50 → 50, 51; 52 → 52, 53;
  54 → 54, 55, 56; 57 → 57, 58, 59 (`0x6fd7b560..0x6fd7b8c9`). These read `Save Bits` minus `Save Add`
  only. Stats 0..3 (`0x6fd7b434`, `0x6fd7b465`, `0x6fd7b4e4`) also read value bits only.
* The other special cases (83..87, 107..109, 126, 134, 179..213) only change behaviour when version is
  <= `0x5C` or `0x59` (old formats). For newer versions they fall back to the generic reader.

### Stat list encoder (`0x6fd7813e..0x6fd7879d`)

For each stat in the list:

1. It skips the stat when its ISC `Save Bits` is 0 (`0x6fd78345`).
2. It skips the stat when `value >> ValShift == 0` (`0x6fd7835b..0x6fd78362`).
3. It skips a chained follower whose value was already written by its leader (it compares against a
   cache at `[esp+statId*4+0x30]`, `0x6fd78368`).
4. It writes the 9-bit id, then for a leader stat (17/48/50/52/54/57) it writes its own value **and
   always** the follower values. It reads the followers from the stat list with `0x6fd89140`
   (`STATLIST_GetStat`, 0 if absent): for example 54 → 55 (`0x37`) → 56 (`0x38`) and 57 → 58 (`0x3a`)
   → 59 (`0x3b`).
5. Every value is written as `clamp(value + Save Add, 0, (1 << Save Bits) - 1)` (`0x6fd785f3..0x6fd78617`
   and the same pattern after it). Out-of-range values saturate. They never wrap.

So a leader stat always produces a well-formed chain, even when the follower stat is missing.

## 2. `Properties.txt` function table (`0x6fdeb0cc`, func 1..24, 36 at `0x6fdeb160`)

| func | VA | Effect (stat ids) |
|---|---|---|
| 1, 2 | `0x6fd98ae0`, `0x6fd98a40` | random `min..max` → `0x6fd975e0` |
| 5 | `0x6fd987c0` | `mindamage` 21; also 23 `secondary_mindamage` for `weap`, and 159 `item_throw_mindamage` for throwing weapons |
| 7 | `0x6fd99340` | sets **both** 18 `item_mindamage_percent` and 17 `item_maxdamage_percent` |
| 13 | `0x6fd98070` | durability %, then refills stat 72 |
| 14 | `0x6fd96830` | sockets: `min(6, invwidth*invheight, ITEMS_GetMaxSockets, roll)`, at least 1; sets flag `0x800` + stat 194 |

The common setter `0x6fd975e0` writes `value << ValShift` (`0x6fd97653..0x6fd97664` and `0x6fd97701`).
Setting stat 58 (`poisonmaxdam`) also adds 1 to stat 326 `poison_count` if it is 0.

`Properties.txt` stat columns (1.13c): `hp` → `maxhp` (7), `mana` → `maxmana` (9), `stam` → `maxstamina`
(11), `dmg%` → func 7, `all-stats` → 0 + func 3 to 1, 2, 3, `res-all-max` → 40 + func 3 to 42, 44, 46,
`dur` → 73, `levelreq` → 92, `skill-rand` → func 12 → 107, `randclassskill` → func 36 → 83,
`dmg-elem` → 48/49, 50/51, 54/55/56, and the `*/time` codes → func 18 → stats 268..303.

## 3. Maximum sockets (`#11151`, `0x6fd74610`)

`min(base gemsockets, ItemTypes MaxSock1 if ilvl <= 25, MaxSock25 if ilvl <= 40, else MaxSock40)`
(`cmp eax,0x19` / `cmp eax,0x28`). The property path (func 14) also caps the result at
`min(6, invwidth*invheight)`.

## 4. Strength / dexterity requirement (`#10244` `ITEMS_CheckRequirements`, `0x6fd76db0`)

* The base values come from `reqstr` (`+0x10a`) and `reqdex` (`+0x10c`).
* When stat 91 `item_req_percent` is non-zero, `delta = MulDiv(pct, base, 100)` (`0x6fd511e0`, signed
  `imul`/`idiv`, truncates toward zero). Positive values **raise** the requirement (for example
  The Humongous `ease +20`).
* When the item is ethereal (`0x400000`), both deltas get an extra `-10`.
* The final requirement is `base + delta`, with no floor and no clamping.

## 5. Level requirement (`0x6fd76190`, wrapper `#11015`)

The function dispatches on quality (jump table `0x6fd766c0`, quality 4..8 only):

* Magic: the max over prefix, suffix and automagic `levelreq`, or `classlevelreq` when the affix class
  equals the player's class.
* Set: SetItems `lvl req`. Unique: UniqueItems `lvl req`.
* Rare: the max over the 6 affix slots and automagic.
* Crafted (`0x6fd7637f`): `min(maxlvl - 1, maxAffixReq + 10 + 3 * presentAffixes)`. This uses the 6 slots
  only, with no automagic and **no base `levelreq` inside the sum**.
* After the quality step, every item takes `max(.., Items levelreq +0x13f)`, then the max over socketed
  children, `item_singleskill` 107 skill `reqlevel`, and `item_nonclassskill` 97 skill `reqlevel`
  (+6 if the skill's class is not the player's class).
* Last, it adds stat 92 `item_levelreq` and clamps the result at 0 or above.
* Quality 9 (tempered) has no affix step.

## 6. `charged` property (`func 19` → `gpPropertyFuncTable[18]`, `0x6fd97420`, stat 204 `item_charged_skill`)

`Properties.txt` maps `charged` to `func1 = 19` (`stat1 = item_charged_skill`, ID `204`, `Encode = 3`).
`ITEMMODS_PropertyFunc19_ChargedSkill` (`0x6fd97420`) computes `(slvl, maxCharges)` from the modifier's `(param, min, max)` and the item's `ilvl`:

1. **Skill resolution (`0x6fd97428..0x6fd97474`)**:
   * Looks up `param` (`skillId`) in `sgptDataTables->pSkillsTxt` (`0 <= skillId < nSkillsTxtRecordCount`).
   * Reads `reqLvl = max(0, (int16)pSkillsTxt->wReqLevel)` (`+0x1AC`) and `maxSkillLvl = (int16)pSkillsTxt->wMaxLvl` (`+0x1AE`, default `20`).
2. **Skill level `slvl` (`0x6fd97476..0x6fd974ba`)**:
   * If `max == 0`: `slvl = min(max(1, (ilvl - reqLvl) / 4 + 1), maxSkillLvl)` (signed integer division `idiv`).
   * If `max < 0`:
     * `span = max(1, 99 - reqLvl)`
     * `step = max(1, span / (-max))`
     * `slvl = max(1, (ilvl - reqLvl) / step)`
     * Example: `MagicSuffix.txt` `of Teleportation` (`lvl = 24`, `mod1code = charged`, `mod1param = 54` (`Teleport`, `reqLvl = 18`), `mod1min = -30`, `mod1max = -6`): `span = 81`, `step = 81 / 6 = 13`, so `ilvl = 31` yields `slvl = 1`, `ilvl = 44` yields `slvl = 2`, `ilvl = 99` yields `slvl = 6`.
   * If `max > 0`: `slvl = max`.
3. **Max & initial charges (`0x6fd974bc..0x6fd974ef`)**:
   * If `min < 0`: `maxCharges = clamp((-min * slvl) / 8 - (-min), 1, 255)` (in `0x6fd974c2..0x6fd974dd`, `eax = -min; edx = -min * slvl / 8 + eax = (-min) * (8 + slvl) / 8`, e.g. for `min = -30, slvl = 1`: `30 * 9 / 8 = 33` charges; for `min = -30, slvl = 2`: `30 * 10 / 8 = 37` charges).
   * If `min > 0`: `maxCharges = clamp(min, 1, 255)`.
   * Initial charges on newly generated / vendor items equal `maxCharges` (or `1 + Rnd(maxCharges - minCharges)` when `fUseRandom == 0` on world drops).
4. **Stat 204 packing (`0x6fd974f1..0x6fd9751d`)**:
   * `dwStatParam = (skillId << nSkillIdShift) | (slvl & dwSkillLevelMask)` (`shift = 6, mask = 0x3F`).
   * `dwStatValue = ((maxCharges & 0xFF) << 8) | (curCharges & 0xFF)`.
5. **Equipment stat merge filter (`D2Common.#10731` `0x6fd98360`)**:
   * Skips items without `ITEMFLAG_IDENTIFIED` (`0x10`, `0x6fd98395`) or with `ITEMFLAG_BROKEN` (`0x100`, `0x6fd983ac`).
   * Skips `STAT_ITEM_CHARGED_SKILL` (`204`, `0x6fd983ed`) when merging passive stat lists into the player's aggregate stat list, because charged skills are added to `pPlayer->pInfo` as discrete `D2SkillStrc` nodes (`dwOwnerGUID = pItem->dwUnitId`) rather than passive stat sums.


# D2Game 1.13c monster equipment item creation (`D2GAME_EquipMonsterItem` `0x6FCCFCE0`)

1:1 port of the item creation path used for `MonEquip.txt` items (Valkyrie, Shadow Warrior/Master,
MonEquip monsters) on the DRLG oracle path. TS:
[`createMonsterItem113c`](../../src/server/items/monster-item-create-113c.ts), driven by
`createMonsterEquipmentUnits113c` / `initOracleValkyrie113c` in
[`necropet-ai-113c.ts`](../../src/server/engine/game-instance/necropet-ai-113c.ts). Caller side:
[`d2game-summon-pet-spawn-113c.md`](../monsters/d2game-summon-pet-spawn-113c.md) §2/§6.

Bases: `D2Game.dll` `0x6FC20000`, `D2Common.dll` `0x6FD50000`. Only weapon / armor bases with forced
quality magic (4) or rare (6) in an expansion game are ported; every other branch throws
`MonsterItemNotPortedError113c`.

## 1. Two seeds

| Seed | Init | Used by |
|---|---|---|
| unit seed `pItem+0x20` | `0x6FD00110`: `SEED_InitLowSeed(game draw 1)` | `0x6FC31070` base stats (durability, AC, gfx variant) |
| item-data seed `pItemData+0x04` | `0x6FD000C0`: `#10414(pItem, game draw 2)` (`dwInitSeed`), `#10614(&pItemData->pSeed, draw 2)` (`lo = draw 2`, `hi = 666`) | every affix / name / property roll (`0x6FC35240`, `0x6FC344D0`, `0x6FC34210`, `D2Common` property funcs) |

`#10411(pItem)` returns `&pItemData->pSeed` (`pItemData+4`), `#10513` reads its low word. TS:
[`allocItemSeeds113c`](../../src/server/engine/game-instance/unit-seeds-113c.ts). Neither seed is exported by
the oracle trace (items are not traced); the game seed count (+2 per item) is.

## 2. Call chain and record offsets

```
0x6FCCFCE0 D2GAME_EquipMonsterItem(eax=pMonEquipCand, edi=pPet, pGame, ilvl, quality)
  #10450(code) -> idx
  0x6FC31980(eax=ilvl, ecx=edx=1, pPet, idx, pGame, 4, quality, 0, 0, 0)
     D2ItemDropStrc (0x84 bytes, zeroed): +0x00 pOwner, +0x08 pGame, +0x0C ilvl (>= 1), +0x14 idx,
       +0x28 = 1, +0x2A = pGame+0x78 (item version), +0x30 quality, +0x80 flags = 8 | 2
     0x6FC31490(pGame, &drop, 0)
       SUNIT_AllocUnitData 0x6FD01D90 (type 4)        ; 2 game-seed draws (section 1)
       #10977(pItem, 0x80000, 1); #10503(pItem, version); #10377(pItem, ilvl); #10977(0x2000); #10012
       0x6FC31070(pGame, pDrop, 1)                     ; section 3
       (drop+0x2C == 0: no save-load block)
       0x6FC2EA70 / 0x6FC2EA10                         ; replenish events (stats 0xFC/0xFD only)
     #10977(pItem, 0x10, 1)
  #10977(pItem, 0x1000, 1); #10058(pItem, loc); #10417; 0x6FCF60D0 (equip to body loc) / 0x6FD020A0 (free)
  on success: #10887(pItem, 72, #11116(pItem, 0))
```

`pGame+0x78` = `bExpansion (+0x70) ? 0x63 + 2 : 2` (`0x6FC4C3F8..0x6FC4C40F`, `0x6FC4C6E0..0x6FC4C6FC`): item
version 101 in an expansion game (`ITEM_VERSION_EXPANSION_113C`). Every check below only distinguishes
`>= 1` / `>= 100`.

Compiled records read (txt column -> offset):

| Table | Fields |
|---|---|
| `ItemsTxt` (0x1A8) | `+0xCC` minac, `+0xD0` maxac, `+0xD8` speed, `+0xF8` auto prefix, `+0xFD` level (qlvl, `#10395`), `+0xFE/+0xFF` mindam/maxdam, `+0x100/+0x101` min/maxmisdam, `+0x102/+0x103` 2handmin/maxdam, `+0x111` block, `+0x112` durability, `+0x120` type2, `+0x129` unique (`#10119`), `+0x12A/+0x12B` quest, `+0x140` magic lvl |
| `ItemTypesTxt` (0xE4) | `+0x10` Throwable (`0x6FD74C30`), `+0x14` Magic (`#10710`), `+0x15` Rare (`#11036`), `+0x16` Normal (`#10556`), `+0x1A..0x1C` MaxSock1/25/40, `+0x1F` StaffMods (`#10957`), `+0x21` Class (`#10822`, `>= 7` = none), `+0x23` VarInvGfx (`#10208`) |
| `MagicAffixTxt` (0x90; `#10492` table `{count, base, +0x08 suffix start, +0x0C prefix start, +0x10 automagic start}` = MagicSuffix rows, MagicPrefix rows, AutoMagic rows) | `+0x22` version, `+0x24` 3 x `{prop, param, min, max}`, `+0x54` spawnable, `+0x58` level, `+0x5C` group, `+0x60` maxlevel, `+0x64` rare, `+0x66` classspecific (0xFF none), `+0x6A` itype1..7, `+0x78` etype1..5, `+0x82` frequency |
| `RareAffixTxt` (0x48; `#10220` `{count, base, +0x08 suffix start, +0x0C prefix start}` = RareSuffix rows, RarePrefix rows) | `+0x0E` version, `+0x10` itype1..7, `+0x1E` etype1..4 |
| `PropertiesTxt` (0x2E) | `+0x02` set[7], `+0x0A` val[7], `+0x18` func[7], `+0x20` stat[7] |

Affix `itype`/`etype` links: blank -> 0, a code missing from ItemTypes.txt (1.13c MagicPrefix uses `staff`)
-> -1; the readers stop at the first word `<= 0`, so both end the list.

## 3. `ITEMS_InitItemStats` `0x6FC31070` (weapon / armor)

```
type = #11088(pItem)
if type == 4 (gold)            -> not ported (stack roll 0x6FC31085, see treasure-class doc section 16)
elif #11144 (stackable)        -> not ported (quantity roll 0x6FC31113)
elif #10744(pItem, 0x32 armo):                                   ; 0x6FC311AB
   stat20 = Items+0x111; stat67 = -Items+0xD8
   d = Items+0x112; stat72 = min(255, rollLimited(unit, d >> 1) + (d >> 1)); stat73 = min(255, d)
   0x6FC2F700: stat31 = minac + 0x6FC21480(unit, maxac - minac + 1)   ; assert <= maxac (0x6FC2F745)
elif #10744(pItem, 0x2D weap):                                   ; 0x6FC3123C
   (#10048 throwing quantity: not ported)
   durability as above; 0x6FC2E860 (stats 22/21/23/24/159/160 from the damage bytes, no RNG); stat68 = -speed
else -> not ported (misc)
n = #10208 (ItemTypes VarInvGfx); if n: #11019(pItem, 0x6FC21480(unit, n))   ; 0x6FC313A9
if arg3 && pDrop: 0x6FC30A20(pGame, &pItem, pDrop)
```

`0x6FC211D0` / `0x6FC21180` / `0x6FC21480` = `rollLimited(n)` (`n <= 0`: no draw; power of two masks `lo`),
`0x6FC21480` adds `edi`.

## 4. `ITEMS_ResolveSpecialQuality` `0x6FC30A20`

```
#11050(pItem, 0); clear prefix/suffix slots (#10312/#10525 x3); #10611/#10883(pItem, 0)
q = 0x6FC2EE90(pItem, pDrop)          ; wVersion >= 1 && pDrop+0x30 != 0 -> returns pDrop+0x30 (0x6FC2EEAB), no RNG
q = pDrop+0x30 ?: q; #10875(pItem, q)
if ItemTypes.Magic (#10710): q = Items.unique? 7 : (!#10516 ? 4 : q)   ; not ported (throws)
if !ItemTypes.Rare (#11036) && q == 6: q = 4                           ; 0x6FC30AF0
if Items.unique (#10119): q = 7; if ItemTypes.Normal (#10556): q = 2   ; not ported (throw)
switch q (jump table 0x6FC31038):
  6 rare 0x6FC30BDE:  0x6FC354F0 -> 0x6FC35240 (expansion) ; failure -> 0x6FC304F0 / 0x6FC301E0 / 0x6FC309B0 (not ported)
  4 magic 0x6FC30CE1: 0x6FC303C0 ; failure -> 0x6FC301E0 / 0x6FC309B0 (not ported)
  other: not ported
then (q in 1..9):
  wVersion >= 100: 0x6FC2EBB0 ethereal -> returns at once: pDrop+0x80 & 2 (0x6FC2EBB0)
  q in 1..3: 0x6FC2EC90 sockets
  wVersion >= 100, table 0x6FC31064[q-1] == 0 (q 1,2,3,4,6,8): 0x6FC30FCB automagic if Items+0xF8 (not ported)
```

## 5. `ITEMS_RollRareAffixes` `0x6FC35240` (expansion; `esi = pItem`, arg `pDrop`)

```
pre = 0x6FC34210(pItem, 1); suf = 0x6FC34210(pItem, 0); if !pre || !suf: return 0
#10611(pItem, pre); #10883(pItem, suf)
n = type == 0x3A (jewl) ? 3 + (seed & 1) : [3,4,4,5,5,5,6,6][seed & 7]       ; 0x6FC352C6 / 0x6FC352E5
nS = nP = 0; sufFull = preFull = 0
for i in 0..n-1:                                                              ; 0x6FC35330
  if sufFull: if preFull: break; side = A
  elif preFull: side = B
  else side = (seed & 1) ? A : B                                              ; 0x6FC3539F
  A (0x6FC35344): id = 0x6FC344D0(pItem, 1, 1, 0, 0 /*suffix table*/, pDrop+0x74[nS], 0)
     id ? (#10525(pItem, id, nS); nS++; nS >= 3 -> sufFull) : (sufFull = 1; i--)
  B (0x6FC353C3): id = 0x6FC344D0(pItem, 1, 1, 0, 1 /*prefix table*/, pDrop+0x68[nP], 0)
     id ? (#10312(pItem, id, nP); nP++; nP >= 3 -> preFull) : (preFull = 1; i--)
if !nP && !nS: return 0
#10977(pItem, 0x10, 0)
for s in 0..2: #10996(0,0,pItem,#10248(#10257(pItem,s)),0,0); #10996(..., #10248(#11028(pItem,s)), ...)
0x6FC33DE0(pItem, pDrop)          ; StaffMods (#10957) class 0..6 only -> not ported (throws)
return 1
```

`#10312` writes `pItemData+0x38[s]` (prefix slots, read by `#10257`); `#10525` writes `+0x3E[s]` (suffix slots,
`#11028`). The `0x6FC344D0` argument 5 selects the MagicPrefix range when non-zero.

### `0x6FC34210(pItem, bPrefix)` rare name

Range `bPrefix ? [prefix start, end) : [suffix start, prefix start)`; candidates = rows passing `#10110`
(`0x6FD95D30`: `version >= 100` needs item `>= 100`; etype1..4 match -> reject; itype1..7 match -> accept;
first word `<= 0` ends the list / rejects); `r = rollLimited(itemSeed, count)` (inline `0x6FC34309`); returns
`index + 1`.

## 6. `ITEMS_RollAffix` `0x6FC344D0(pItem, bSpawnable, bForce, bApply, bPrefix, nForced, nAutoGroup)`

```
range = nAutoGroup ? automagic : bPrefix ? prefixes : suffixes                ; 0x6FC344F1..0x6FC34529
coin = itemSeed step & 1                                                      ; 0x6FC3458A, ALWAYS drawn
if !coin && !bForce: return 0
i = max(ilvl (#10086), qlvl (#10395)); alvl = magic lvl ? i + mlvl
      : i < 99 - qlvl/2 ? i - qlvl/2 : 2i - 99; clamp 1..99                    ; 0x6FC34604
for each record k:                                                            ; 0x6FC34674
  bSpawnable && !spawnable(+0x54)          -> skip
  version(+0x22) >= 100 && item version < 100 -> skip
  forced = nForced > 0 && nForced - 1 == k; else level > alvl or (maxlevel && maxlevel < alvl) -> skip
  !rare(+0x64) && (q == 6 || 7 < q <= 9)   -> skip
  !#10461(pItem, rec)                      -> skip   (0x6FD95E50, see below)
  nAutoGroup && group != nAutoGroup        -> skip
  !frequency(+0x82)                        -> skip
  classspecific != 0xFF && #10822(pItem) != 7 && != classspecific -> skip
  0x6FC331E0 (an affix of the same group already in a prefix or suffix slot) -> skip
  forced -> pick it (no roll)
  cand[n++] = {k + rangeOffset, rec} (n < 0x1FF); total += mlvl ? freq * level : freq
if !n: return 0
r = rollLimited(itemSeed, total + 1)                                          ; 0x6FC3480B
walk cand: r -= weight; stop at r < 0 — the walk falls through to the LAST candidate when r == total
bApply: #10996(0, 0, pItem, rec, 0, 0)
return id + 1
```

`#10461` (expansion item): mod1's first stat is `item_numsockets` (194) and `0x6FD74610` max sockets
(`min(Items.gemsockets, ItemTypes.MaxSock1/25/40 by ilvl <= 25 / <= 40 / else)`) is 0 -> reject; etype1..5
match -> reject; itype1..7 match -> accept (first word `<= 0` stops / rejects). `0x6FD74430` (`#10744`
type test) = transitive Equiv1/Equiv2 closure of `type` or `type2`.

### Magic `0x6FC303C0(&pItem, pDrop)` (no forced affixes)

```
pre = 0x6FC344D0(pItem, 1, 0, 1, 1, 0, 0); #10312(pItem, pre, 0)         ; mods applied inside (bApply = 1)
suf = 0x6FC344D0(pItem, 1, pre == 0, 1, 0, 0, 0); #10525(pItem, suf, 0)
if !pre && !suf: return 0; #10977(pItem, 0x10, 0); 0x6FC33DE0; return 1
```

## 7. Properties (`#10996` mode 0 -> `0x6FD95AA0` -> `0x6FD95990`)

For each of the 3 affix mods (stop at `prop < 0`), each Properties sub-entry until `func == 0`
(`0x6FDEB0C8[func]`); `first` = the value returned by sub-entry 0. Value rolls `0x6FD51180` / `0x6FD965B0`:
`min == max` -> min (no draw), else `min + rollLimited(itemSeed, max - min + 1)`. Stats are added
`value << ItemStatCost.ValShift` (`0x6FD97664`).

| func | Address | Roll | Writes |
|---|---|---|---|
| 1 | `0x6FD98AE0` | always (unless min == max) | stat |
| 2 | `0x6FD98A40` | same | stat (+ `0x6FD96E50` base AC/damage rewrite, no RNG) |
| 3 | `0x6FD989D0` | only if `first == 0` | stat |
| 5 / 6 | `0x6FD987C0` / `0x6FD98630` | only if `first == 0` | 21/23/159 (min) or 22/24/160 (max); skip 1H on a 2H-only weapon and vice versa, throw stat only on non-weapons / throwables; negative clamp to `-base` |
| 7 | `0x6FD99340` | only if `first == 0` | 18 then 17 (returns 1) |
| 8 | `0x6FD985D0` | only if `first == 0` | stat |
| 17 | `0x6FD991C0` | value = mod param, roll only when param is 0 | stat (maxdamage 22 -> func 6 path, not ported) |
| other | | | not ported (throws) |

## 8. Pet side (Valkyrie)

`SKILLS_SrvDo016_Valkyrie` evaluates `ilvl = #10786(calc2)` (`ln56` = `25 + 3 * (slvl - 1)`,
`0x6FC6D830..0x6FC6D83A`) and passes it through `0x6FC6F970` to `0x6FCB2ED0` (`0x6FC70017..0x6FC70049`; the
`calc2 == 0` default `min(max(1, 3 * slvl), level)` is not ported). `0x6FC6F970` sets
`STAT_MAXHP = STAT_HITPOINTS = hp + hp * calc1 / 100` on the `MONSTER_InitStats` HP before the items
(`petHpBonus113c`). The items' stat lists are merged into the pet by `0x6FCF60D0`; TS adds every item stat to
`pet.statList` (`SummonManager` skips its `MonEquip` loadout model on the oracle path,
`skipMonEquipLoadout113c`).

Oracle `p52-amazon-valkyrie` F642 (owner level 40, Valkyrie slvl 1, Decoy blvl 1 -> calc1 20, ilvl 25):

| Item | Seeds (draw 1 / draw 2) | Result |
|---|---|---|
| `spr` rare | 236261103 / 1030816634 | dur 28/30; prefixes Sharp, Brutal, Triumphant; suffixes of Fast Repair, of Gore, of Lightning |
| `ful` rare | 338162001 / 1119925997 | dur 46/70, AC 151; prefixes Tangerine, Lizard's (+5 mana); suffixes of Strength (+2 str), of Stability, of the Fox (+9 life) |

Pet: str 25 + 2 = 27, maxhp 460 -> 552 + 9 = 561.0, maxmana 5.0 — all equal to the oracle row.

## 9. Open items

- `STAT_HITPOINTS` is 561.0 in the oracle right after the items although the HP bonus wrote 552.0 and the
  items only carry `maxhp`: TS sets hitpoints to the accrued max after the merge. The code site of this
  top-up (stat callback for `maxhp`, ItemStatCost `fCallback = 1`, or the equip path `0x6FCF60D0` ->
  `#10405`/`#10466`/`#10050`/`#10201`) is not located yet.
- Not ported (throw): gold / stackable / misc bases, normal / superior / set / unique / crafted qualities,
  the rare and magic failure fallbacks (`0x6FC304F0`, `0x6FC301E0`, `0x6FC309B0`), automagic, StaffMods,
  Properties funcs other than 1/2/3/5/6/7/8/17, classic (version < 100) items.
- `0x6FD96E50` (func 1/2 base AC/damage rewrite for stats 16..31) is not modelled; it has no RNG and only
  changes the item's own AC/damage, which the pet trace does not export.

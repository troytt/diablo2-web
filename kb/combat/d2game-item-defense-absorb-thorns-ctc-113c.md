# D2Game.dll v1.13c Item-Driven Defense: `DR/MDR`, Elemental Absorb, `ATD`/`Thorns`/`Iron Maiden`, `Damage To Mana` & `CtC When Struck`

Source: `samples/d2/D2Game.dll` (image base `0x6FC20000`), `samples/d2/D2Common.dll` (image base `0x6FD50000`), `ItemStatCost.txt`, `Properties.txt`, `Skills.txt`, `ItemEvents` registration table (`0x6FD23BD0`), and `D2DamageResolveTable` (`0x6FD22AB0`) from official Blizzard 1.13c `Patch_D2.mpq` / `d2exp.mpq`.

Server implementation:
- [`src/server/engine/combat-pipeline.ts`](../../src/server/engine/combat-pipeline.ts) (`computeRawDamagePipe113c`, `applyElementalAbsorb113c`, `executeSUnitDmg`)
- [`src/server/engine/game-instance/sunitdmg-player-defender-113c.ts`](../../src/server/engine/game-instance/sunitdmg-player-defender-113c.ts)
- [`src/server/engine/game-instance/monster-melee-attacks.ts`](../../src/server/engine/game-instance/monster-melee-attacks.ts) (`resolveMonsterAttackOnPlayer`)

---

## 1. Whole-Call-Tree Overview (`Monster -> Player` Melee Swing)

When a monster melee attack lands on a player (`SUNITDMG_AllocCombat` `0x6FCFDDE0` followed by `SUNITDMG_ExecuteCombat` `0x6FCFED30` and `SUNITDMG_ExecuteEvents` `0x6FCFCF20`), `D2Game.dll` executes mitigation, item events, seed draws, life updates, armor durability, and `Thorns` in a strict, non-commutative order:

1. **`SUNITDMG_AllocCombat` (`0x6FCFDDE0`)**:
   - `0x6FC64AC0` (`MONSTER_MeleeAttack` action frame) -> `0x6FCFE5A0` (`SUNITDMG_RollMelee` `0x6FCFE5FC..0x6FCFE629`): computes action-frame reach bonus `ebp = (pAttacker->dwUnitType == UNIT_MONSTER) ? 3 : 1` (`0x6FCFE60D`) and gates the swing on `D2Common.#11138` (`UNITS_IsInMeleeRange(pMonster, pPlayer, 3)`).
   - `0x6FCFE5A0` / `0x6FCFDE90`: rolls `ToHit` (`monster->pSeed`), `Block` (`player->pSeed`), `Dodge/Avoid` (`player->pSeed`), and `SUNITDMG_FillPacket` (`0x6FCFBED0`, `monster->pSeed`). Sets `wResultFlags |= 0x04` (`RESULTFLAG_GETHIT` at `0x6FCFE69F` if defender lacks `STATE_UNINTERRUPTABLE = 54`, **before** resistance/DR calculation).
   - `0x6FCFDE2D`: calls `SUNITDMG_CalcDamageResists(pDefender, pAttacker, pDmg, bDontAbsorb = 0)` (`0x6FCFC0B0`) -> computes flat `DR`/`MDR`, `%DR`/elemental resists, `%`/flat Absorb (`dwAbsorbLife` at `pDmg+0x48`), and signed `dwDmgTotal` (`pDmg+0x4C`). *(Oracle hook #2 emits the primary `dmg` trace event on return from `0x6FCFC0B0`.)*
2. **`SUNITDMG_ExecuteCombat` (`0x6FCFED30`)**:
   - `0x6FCFEDAC`: calls `SUNITDMG_ApplyDamageLife(pAttacker, pDefender, pDmg, bCallCalcResist = 0)` (`0x6FCFE0C0`):
     - **`0x6FCFE1E2` — Attacker `ITEMEVENTS_Dispatch(event = 5 /* domeleedamage */)` (`0x6FC57030`)**:
       - `fn[4]` (`0x6FC6F090`, `#76 Iron Maiden` `state 55`): if `pDmg->dwPhysDamage > 0`, computes `refl256 = mulDiv113c(pct, pDmg->dwPhysDamage, 100)` using **post-`%DR`, pre-life-clamp** `dwPhysDamage` (`+0x08`), sets `wResultFlags = 0x4021` (`Skills.txt` `ResultFlags = 0x4001 | 0x0020` at `0x6FC6F1F8..0x6FC6F203`), and calls nested `0x6FCFE0C0(pDefender -> pAttacker, wResultFlags = 0x4021, dwPhys = refl256, bCallCalcResist = 1)` *(emits secondary `dmg` trace event via `0x6FCFE1A0`)*.
     - **`0x6FCFE1F2` — Defender `ITEMEVENTS_Dispatch(event = 1 /* damagedinmelee */)` (`0x6FC57030`)**:
       Walks `pDefender->pItemEventList` in **LIFO registration order** (reverse equip order across active slots):
       - `fn[6]` (`0x6FCCD910`, `stat 78` `item_attackertakesdamage`): if `stat78 > 0`, calls nested `0x6FCFE0C0(pDefender -> pAttacker, wResultFlags = 0x4021, dwPhys = stat78 << 8, dwHitClass = 0x8D, bCallCalcResist = 1)` *(emits secondary `dmg` trace event via `0x6FCFE1A0`)*.
       - `fn[10]` (`0x6FCCD860`, `stat 128` `item_attackertakeslightdamage`): if `stat128 > 0`, calls nested `0x6FCFE0C0(pDefender -> pAttacker, wResultFlags = 0x4021, dwLtng = stat128 << 8, dwHitClass = 0x4D, bCallCalcResist = 1)`.
       - `fn[13]` (`0x6FCCCDA0`, `stat 114` `item_damagetomana`): if `pDmg->dwDmgTotal > 0` and `stat114 > 0` and `curMana256 < maxMana256`, adds `mulDiv113c(stat114, pDmg->dwDmgTotal, 100)` to `STAT_MANA (8)` clamped at `maxMana256`.
       - `fn[21]` (`0x6FCCDCE0`, `stat 201` `item_skillongethit`, **`CtC When Struck`**): requires `(wResultFlags & 0x04) != 0` and `!STATES_CheckState(pDefender, 54)`. Deduplicated per `(statId, layer)` during registration (`0x6FC57110`), reads summed `chance = STATLIST_GetUnitStat(pDefender, 201, layer)` and rolls **`SEED_RollLimitedRandomNumber(&pDefender->pSeed, 100) < chance`** (`0x6FCCDD6B`). If successful, executes the procced skill immediately (e.g. `#42 Static Field` `0x6FC630D0` -> `0x6FC62EC0`, calling nested `0x6FCFE0C0(..., wResultFlags = 0x4001, bCallCalcResist = 1)` per target in range).
     - **`0x6FCFE200..0x6FCFE210` — Defender Current-Life Clamp on `dwPhysDamage`**:
       Reads `curHp256 = STATLIST_GetUnitStatSigned(pDefender, 6, 0)` (`0x6FCFE202`) and clamps `pDmg->dwPhysDamage = min(pDmg->dwPhysDamage, curHp256)` (`0x6FCFE20C`: signed `cmp ecx, eax; jle`).
     - **`0x6FCFE218` — Attacker Leech (`0x6FCFBA40`)**: applies life/mana steal if attacker has leech stats.
     - **`0x6FCFE237..0x6FCFE23D` — Pre-Damage Absorb Heal (`SUNITDMG_AddLife` `0x6FCFB570`)**:
       If `pDmg->dwAbsorbLife > 0`, `!IsDead(pDefender)`, and `!STATES_CheckState(pDefender, 92 /* death_delay */)`, updates `STAT_HITPOINTS (6) = min(curHp256 + dwAbsorbLife, maxHp256)` **before** subtracting `dwDmgTotal`.
     - **`0x6FCFE242..0x6FCFE269` — Final Life Subtraction**:
       If `pDmg->dwDmgTotal > 0` (`test esi, esi; jle`), computes `nextHp256 = STAT_HITPOINTS(6) - dwDmgTotal`; if `nextHp256 < 0x100`, zeroes `nextHp256 = 0` (`0x6FCFE257`) and marks `wResultFlags |= 0x02` (`DEATH`). Writes `STAT_HITPOINTS (6) = nextHp256`.
   - **`0x6FCFEE2B` — Defender Armor Durability (`0x6FCFEBA0` -> `0x6FC32EE0`)**:
     Consumes `2` or `3` RNG draws on **`&pDefender->pSeed`** (`rand(7)`, `rand(weightSum)`, and `rand(100) < 10` if selected armor piece is non-indestructible) **after** `CtC When Struck`!
   - **`0x6FCFEE8E` — Aura/Passive `thorns_percent` (`0x6FCB8A70`, `stat 131`)**:
     If `!IsDead(pAttacker)`, `stat131 > 0` (e.g. `#103 Thorns` `state 36`, `#90 IronGolem`, `#296 Barbs Aura`, or `Bramble`/`Edge` — none of which have `Skills.txt` `auraevent1` in 1.13c), and **life-clamped** `pDmg->dwPhysDamage > 0`: computes `effPct = bPvPOrMerc ? (stat131 + 4) >> 3 : stat131` (`0x6FCB8AA3..0x6FCB8AAE`), `refl256 = mulDiv113c(effPct, pDmg->dwPhysDamage, 100)`, and calls `0x6FCFE0C0(pDefender -> pAttacker, wResultFlags = 0x4021, dwPhys = refl256, dwHitClass = 0x8D, bCallCalcResist = 1)` *(emits secondary `dmg` trace event via `0x6FCFE1A0`)*.
   - **`0x6FCFEE9C` — `SUNITDMG_ExecuteEvents` (`0x6FCFCF20`)**:
     If defender survived (`!(wResultFlags & 0x02)`) and `(wResultFlags & 0x04) != 0`, calls `SUNITDMG_CheckSkipGetHit` (`0x6FCFB910`), which immediately returns `1` (skip, **0** RNG draws) if `pDmg->dwDmgTotal < 0x100` (including negative `dwDmgTotal`), otherwise evaluates `HitClass` divisor thresholds on `&pDefender->pSeed`.

---

## 2. `SUNITDMG_CalcDamageResists` (`0x6FCFC0B0`) & `SUNITDMG_CalcChannel` (`0x6FCFBD00`)

### 2.1 `D2DamageStrc` Layout (`0x70` bytes; Oracle `raw[0..17]` = first `0x48` bytes)

| Offset | `raw[i]` | Field | Notes |
|---:|---:|---|---|
| `+0x00` | `raw[0]` | `dwHitFlags` | `0x20` (`HITFLAG_SRCDAMAGE_MISS` / melee calc flag), `0x02` (`BYPASS_UNDEAD`), `0x04` (`BYPASS_DEMONS`), `0x08` (`BYPASS_BEASTS`) |
| `+0x04` | `raw[1]` | `wResultFlags \| (wExtra << 16)` | `0x0001` `HIT`, `0x0002` `DEATH`, `0x0004` `GETHIT`, `0x0008` `KNOCKBACK`, `0x0010` `BLOCK`, `0x0020` `ELEM_OVERLAY_50PCT`, `0x2000` `CRITICAL_STRIKE`, `0x4000` `SOFTHIT` |
| `+0x08` | `raw[2]` | `dwPhysDamage` | Signed 256ths (`int32_t`); **can be negative** when `flatDR > rawPhys`! |
| `+0x0C` | `raw[3]` | `dwEnDmgPct` | Enhanced damage `%` |
| `+0x10` | `raw[4]` | `dwFireDamage` | Signed 256ths (`int32_t`); **can be negative** when `flatMDR > rawFire`! |
| `+0x14` | `raw[5]` | `dwBurnDamage` | Burn damage (`2` = `NoBurn` marker from `FillPacket` `0x6FCFC099`) |
| `+0x18` | `raw[6]` | `dwBurnLen` | Burn length (frames) |
| `+0x1C` | `raw[7]` | `dwLtngDamage` | Signed 256ths (`int32_t`) |
| `+0x20` | `raw[8]` | `dwMagDamage` | Signed 256ths (`int32_t`) |
| `+0x24` | `raw[9]` | `dwColdDamage` | Signed 256ths (`int32_t`) |
| `+0x28` | `raw[10]` | `dwPoisDamage` | Poison rate (256ths / frame) |
| `+0x2C` | `raw[11]` | `dwPoisLen` | Poison length (frames) |
| `+0x30` | `raw[12]` | `dwColdLen` | Chill length (frames) |
| `+0x34` | `raw[13]` | `dwFrzLen` | Freeze length (frames) |
| `+0x38` | `raw[14]` | `dwLifeLeech` | Life steal parameter / monster innate leech |
| `+0x3C` | `raw[15]` | `dwManaLeech` | Mana steal parameter |
| `+0x40` | `raw[16]` | `dwStamLeech` | Stamina steal parameter |
| `+0x44` | `raw[17]` | `dwStunLen` | Stun length (frames) |
| `+0x48` | *(outside `raw`)* | `dwAbsorbLife` | Accumulated absorb heal in 256ths (`0x6FCFAD48`, `0x6FCFAD77`) |
| `+0x4C` | `ret` (signed `%d`) | `dwDmgTotal` | Signed sum of post-mitigation channels (`0x6FCFC4F7..0x6FCFC525`: `phys + fire + ltng + mag + cold + pois` + monster `life` drain) |
| `+0x54` | — | `nOverlays` | Missile `DamageRate` (`1024`-based scale for `DR`/`MDR` at `0x6FCFC13B..0x6FCFC175`) |
| `+0x60` | — | `dwHitClass` | `0x8D` on `ATD`/`Thorns`, `0x4D` on `ATLD`/`Static Field` |
| `+0x68` | — | `dwConvPct` | Conversion `%` (`> 0` bypasses `DR`/`MDR`/Absorb via `bDontAbsorb = 1`) |
| `+0x6D` | — | `bDifficulty` | Difficulty byte (`0..2`, passed to `D2GetDifficultyLevelsTxtRecord` at `0x6FCFC0C2`) |

### 2.2 Flat `DR` (`stat 34`) & `MDR` (`stat 35`) Scaling (`0x6FCFC125..0x6FCFC177`)

- If `bDontAbsorb == 0`:
  - `flatDR256 = STATLIST_GetUnitStatSigned(pDefender, 34 /* normal_damage_reduction */, 0) << 8` (`0x6FCFC126..0x6FCFC134`).
  - `flatMDR256 = STATLIST_GetUnitStatSigned(pDefender, 35 /* magic_damage_reduction */, 0) << 8` (`0x6FCFC14F..0x6FCFC15D`).
  - If `pDmg->nOverlays > 0` (`+0x54`, `Missiles.txt` `DamageRate` on ground fire / per-frame missiles):
    - `if (flatDR256 > 0) flatDR256 = mulDiv113c(pDmg->nOverlays, flatDR256, 1024)` (`0x6FCFC147`)
    - `if (flatMDR256 > 0) flatMDR256 = mulDiv113c(pDmg->nOverlays, flatMDR256, 1024)` (`0x6FCFC170`)
- `flatMDR256` is **NOT** a shared pool depleted across `Magic -> Fire -> Ltng -> Cold`; instead, `0x6FCFC4D3..0x6FCFC4F5` iterates `D2DamageResolveTable` (`0x6FD22AB0`) rows `0..11` (`Phys`, `Fire`, `Ltng`, `Cold`, `Magic`, ...) and passes the **full** `flatMDR256` independently to each active row `1..4` (`Fire`, `Ltng`, `Cold`, `Magic`), and `flatDR256` to row `0` (`Phys`).

### 2.3 Per-Channel `SUNITDMG_CalcChannel` (`0x6FCFBD00..0x6FCFBD96`) & Signed Overflow Spill

```c
// eax = rowIdx (0..11), ecx = pDmg, [esp+4] = pCtx, [esp+8] = flatReduce256, [esp+0xC] = bDontAbsorb
int32_t *pField = (int32_t *)((uint8_t *)pDmg + row->dmgOff);
if (*pField <= 0) {           // 0x6FCFBD23: test eax, eax; jle 0x6FCFBD8C
  *pField = 0;                // inactive channels (0) do NOT subtract flatDR / flatMDR!
  return 0;
}
int32_t effRes = SUNITDMG_GetEffectiveResist(pCtx, rowIdx); // 0x6FCFBD2D -> 0x6FCFB3C0
int32_t esi = *pField;
if (bDontAbsorb == 0) {
  esi -= flatReduce256;       // 0x6FCFBD54: sub esi, [esp+0x1c] -- SIGNED, NOT clamped to 0!
}
if (esi > 0 && effRes != 0) { // 0x6FCFBD5A: test esi, esi; jle 0x6FCFBD72
  if (effRes > 100) effRes = 100;
  esi = mulDiv113c(100 - effRes, esi, 100); // 0x6FCFBD6B -> 0x6FC214D0
}
if (bDontAbsorb == 0) {
  esi = SUNITDMG_ApplyAbsorb(pCtx, pDmg, row, esi); // 0x6FCFBD7B -> 0x6FCFAD00
}
*pField = esi;                // 0x6FCFBD80: stores SIGNED esi (can be < 0!)
return esi;
```

**Critical Binary Nuances (`0x6FCFBD54..0x6FCFAD7C` & `0x6FCFC369..0x6FCFC387`)**:
1. **Signed Negative Spill Across Channels ("MDR Overflow Bug")**:
   - Because `esi = rawCh256 - flatReduce256` is **not** clamped to `0` at `0x6FCFBD54`, if a monster deals `1` Fire (`256`) + `10` Physical (`2560`) and the player has `MDR = 13` (`3328`), `dwFireDamage` becomes `256 - 3328 = -3072`, and `dwDmgTotal = dwPhysDamage + dwFireDamage = 2560 + (-3072) = -512`! Excess `MDR` on an active elemental channel spills into and reduces Physical (and other channels') total damage, and excess `DR` on an active Physical channel spills into Elemental damage.
   - Inactive channels (`*pField <= 0`) take the early exit at `0x6FCFBD25` (`*pField = 0`) and never subtract `flatDR` or `flatMDR`.
2. **`MDR > rawElem` + `%` / Flat Absorb Interaction (`0x6FCFAD00..0x6FCFAD66`)**:
   - In `0x6FCFAD00`, `%` Absorb (`stat 142/144/146/148`, capped at `40%` at `0x6FCFAD1A`) checks **only** `if (pct > 0)` at `0x6FCFAD26` (`test eax, eax; jle 0x6FCFAD3E` — **no** `edi > 0` check!). Thus when `edi < 0` (from `MDR > rawElem`) and `pct > 0`, `a = mulDiv113c(pct, edi, 100)` is negative, adding negative `a` to `dwAbsorbLife` (`0x6FCFAD39`) and reducing the magnitude of negative `edi` (`edi -= a` at `0x6FCFAD3C`).
   - Next, `0x6FCFAD3E..0x6FCFAD60` runs the **flat Absorb** block (`stat 143/145/147/149`), checking `if (flat256 > 0)` (`0x6FCFAD50: test eax, eax; jle 0x6FCFAD62`) and computing `amt = (flat256 < edi) ? flat256 : edi` (`0x6FCFAD54: cmp eax, edi; jl 0x6FCFAD5A; mov eax, edi`)!
   - When `edi < 0` and `flat256 > 0`, `eax = edi` (negative!), so `dwAbsorbLife += edi` and `edi -= edi` -> `edi = 0`! Thus flat Absorb on that same element cancels the remaining negative `MDR` spill (`edi` becomes `0`) and subtracts from `dwAbsorbLife` (`AddLife` at `0x6FCFB570` later ignores `dwAbsorbLife <= 0`).
3. **PvP / Monster-vs-Monster Multiplier (`0x6FCFC1D2..0x6FCFC368`)**:
   - Applied **after** `0x6FCFBD00` per-channel calculation, before summing `dwDmgTotal`:
     - Player vs Player: `mulDiv113c(ch, 17, 100)` (`0x6FCFC22B`).
     - Mercenary vs Boss (`MonStats2` `primeevil` / Act boss): `mulDiv113c(ch, 25, 100)` (`D2Difficulty` `HireableBossDmgPercent`).
4. **Status Length Clamps & Resist Bypass Flags (`0x6FCFA7B0`, `0x6FCFC47C..0x6FCFC4CC`)**:
   - After `event 11` (`absorbdamage`), `0x6FCFA7B0` zeroes `dwColdLen`/`dwFrzLen` on `item_cannotbefrozen` (`153`), halves them (`sar 1`) on `item_halffreezeduration` (`118`), zeroes `dwPoisLen` on `STATE_SHRINE_RESIST_POISON` (`133`), and zeroes `dwBurnLen` on `STATE_SHRINE_RESIST_FIRE` (`131`).
   - `0x6FCFC482..0x6FCFC4CC` sets `bBypassResists = 1` when `pDefender` is Undead + `dwHitFlags & 0x0100`, Demon + `0x0200`, or Beast + `0x0400`. Zero RNG draws occur inside `0x6FCFC0B0`.

---

## 3. `ITEMEVENTS` Registration Order & Event Handlers (`0x6FC57030`, `0x6FC57110`, `0x6FD23BD0`)

### 3.1 LIFO Linked List & `(wStatId, wLayer)` Deduplication (`0x6FC57110`, `0x6FC6FE80`)

When items or states attach stats with `ItemStatCost.txt` `itemevent1` / `itemevent2` (`0x6FC6FE80`):
- `0x6FC57110` scans the unit's existing `pItemEventList` for a node with matching `(wEventMask, wStatId, wLayer)` (`[eax+0x06] == statId && [eax+0x08] == layer`).
- If an identical `(statId, layer)` node is already registered (e.g. two items both granting `stat 78` `ATD` layer `0`, or two items granting the exact same `(skillId, slvl)` `CtC When Struck` layer), `0x6FC57110` **returns the existing node without inserting a duplicate** (`0x6FC5713B`). The handler later queries `STATLIST_GetUnitStat(pUnit, statId, layer)` to get the summed stat across all equipped items.
- New nodes are prepended to the **head** of `pItemEventList` (`node->pNext = list->pFirst; list->pFirst = node` at `0x6FC5719E`), so `ITEMEVENTS_Dispatch` (`0x6FC57030`) walks handlers in **LIFO order** (last-equipped item's distinct `(statId, layer)` fires first!).
- Within a single item's stat list, stats are iterated in ascending `(statId, layer)` order (`stat 78` -> `stat 114` -> `stat 128` -> `stat 201`), so within one item `stat 201` is prepended last and visited before `stat 114` / `stat 78` — note that only `stat 201` (`CtC`) consumes RNG on `pDefender->pSeed`, while `ATD` (`78`), `ATLD` (`128`), and `CtC` (`201`) all emit secondary `SUNITDMG` `dmg` trace events if triggered, making exact LIFO node order observable in `dmg` traces whenever both `ATD` and `CtC` fire on the same hit!

### 3.2 `ItemEventFunc` Table (`0x6FD23BD0`) — Defensive & Reflective Handlers

| `itemeventfunc` | VA | Stat / State | Event | Exact Behavior |
|---:|---|---|---|---|
| `4` | `0x6FC6F090` | `#76 Iron Maiden` (`state 55`) | `5` (`domeleedamage`, on attacker) | Requires attacker is melee (`!ranged`), `pDefender != pAttacker`, `pDmg->dwPhysDamage > 0`. Reads skill/stat `%` from `state 55` statlist (`>> 2` if PvP player/merc attacker), computes `refl256 = mulDiv113c(effPct, pDmg->dwPhysDamage, 100)`, sets `wResultFlags = 0x4021` (`Skills.txt` `0x4001 \| 0x0020` at `0x6FC6F1F8`), calls `0x6FCFE0C0(pDefender, pAttacker, &subDmg, bCallCalcResist = 1)`. |
| `6` | `0x6FCCD910` | `stat 78` `item_attackertakesdamage` | `1` (`damagedinmelee`, on defender) | Reads `atd = STATLIST_GetUnitStatSigned(pDefender, 78, 0)`. If `atd > 0`, zeroes `subDmg`, sets `wResultFlags = 0x4021` (`HIT \| ELEM_OVERLAY \| SOFTHIT`), `dwPhysDamage = atd << 8`, `dwHitClass = 0x8D`, calls `0x6FCFE0C0(pDefender, pAttacker, &subDmg, bCallCalcResist = 1)` + `0x6FCFCF20` (`0x4000 SOFTHIT` suppresses monster `GH`). |
| `10` | `0x6FCCD860` | `stat 128` `item_attackertakeslightdamage` | `1` (`damagedinmelee`, on defender) | Reads `atld = STATLIST_GetUnitStatSigned(pDefender, 128, 0)`. If `atld > 0`, zeroes `subDmg`, sets `wResultFlags = 0x4021`, `dwLtngDamage = atld << 8`, `dwHitClass = 0x4D`, calls `0x6FCFE0C0(..., bCallCalcResist = 1)` + `0x6FCFCF20`. |
| `13` | `0x6FCCCDA0` | `stat 114` `item_damagetomana` | `1` (`damagedinmelee`) & `2` (`damagedbymissile`) | Requires `pDmg->dwDmgTotal > 0`, `curMana256 < maxMana256`, `dtm = STATLIST_GetUnitStatSigned(pDefender, 114, 0) > 0`. Computes `gain256 = mulDiv113c(dtm, pDmg->dwDmgTotal, 100)` and sets `STAT_MANA (8) = min(maxMana256, curMana256 + gain256)`. |
| `21` | `0x6FCCDCE0` | `stat 201` `item_skillongethit` (`CtC When Struck`) | `1` (`damagedinmelee`) & `2` (`damagedbymissile`) | Requires `pDmg != NULL`, `(pDmg->wResultFlags & 0x04) != 0` (`GETHIT` flag set on hit — **not** gated on `dwDmgTotal > 0`!), and `!STATES_CheckState(pDefender, 54 /* uninterruptable */)`. Decodes `slvl = layer & 0x3F`, `skillId = layer >> 6` (`Encode = 2`, see §3.3), reads `chance = STATLIST_GetUnitStatSigned(pDefender, 201, layer)`, and if `chance > 0`, rolls **`SEED_RollLimitedRandomNumber(&pDefender->pSeed, 100) < chance`** (`0x6FCCDD6B`). On proc, dispatches skill `skillId` at `slvl` toward `(pAttacker` or `attacker x, y)`. |
| *(post-durability)* | `0x6FCB8A70` | `stat 131` `thorns_percent` (`#103 Thorns` `state 36`) | Direct call at `0x6FCFEE8E` | Requires `pAttacker->dwAnimMode != 0` (`0x6FCFEE7E..0x6FCFEE83`: skipped if attacker already died from `Iron Maiden` / `CtC` / `ATD` earlier in the same hit!), `thornsPct = STATLIST_GetUnitStatSigned(pDefender, 131, 0) > 0`, and **life-clamped** `pDmg->dwPhysDamage > 0`. Note also that `#103 Thorns` has `Skills.txt` `immediate = 0`, so `D2GAME_AssignSkill -> 0x6FCC1D10` (`0x6FCC1DA5..0x6FCC1E72`) toggles `state 36` immediately on `SelectSkill` (`0x3C`) with an empty statlist (`350/351` only) and defers `SrvDo065` (`thorns_percent = 250 + 40*(slvl-1)`) until `nextFrame = 50 * trunc((F + 49) / 50) + 1` (`0x6FCBF3B0`). Computes `effPct = bPvPOrMerc ? (thornsPct + 4) >> 3 : thornsPct` (`0x6FCB8AA3`), `refl256 = mulDiv113c(effPct, pDmg->dwPhysDamage, 100)`, sets `wResultFlags = 0x4021`, `dwPhysDamage = refl256`, `dwHitClass = 0x8D`, calls `0x6FCFE0C0(pDefender, pAttacker, &subDmg, bCallCalcResist = 1)` + `0x6FCFCF20`. |

### 3.3 `Encode = 2` Parameter Packing (`0x6FCCDD30..0x6FCCDD75`)

In `D2Common` runtime `StatList` (`ItemStatCost.txt` `Encode = 2` for `item_skillonattack` `195`, `item_skillonhit` `198`, `item_skillongethit` `201`):
- `wLayer` (`uint16_t`) packs `slvl = wLayer & 0x3F` (low 6 bits, `1..63`) and `skillId = wLayer >> 6` (upper 10 bits, `0..1023`), while the stat value stores `chance` (`%`).
- `0x6FCCDD34`: `slvl = wLayer & 0x3F; skillId = wLayer >> 6;` (if `slvl <= 0`, clamps `slvl = 1`).
- Two equipped items with the **same** `(skillId, slvl)` share the exact same `wLayer`, so `STATLIST` sums their `chance%` and `0x6FC57110` registers **one** `ItemEvent` node (1 `rand(100)` roll against summed `chance%`). Two items with **different** `skillId` or `slvl` have distinct `wLayer` values and each roll `rand(100)` separately in LIFO equip order.

---

## 4. `#42 Static Field` Server Execution (`SKILLS_SrvDo020_StaticField` `0x6FC630D0` -> `0x6FC62EC0`)

When `#42 Static Field` procs from `CtC When Struck` (e.g. `Hwanin's Refuge` `10% CtC Level 3 Static Field When Struck`):
1. **`0x6FC630D0`**:
   - Evaluates `aurarangecalc` (`par1 + (slvl - 1) * par2` = `5 + (slvl - 1) * 1` subtiles; at `slvl = 3`, `radius = 7` subtiles).
   - Calls `AURA_ForEachTargetInRadius` (`0x6FD0B8B0`) with filter `0x9583` (hostile living monsters) and callback `0x6FC62EC0`.
   - Note: neither `0x6FC630D0` nor `0x6FC62EC0` consumes any RNG draw on `pCaster->pSeed` or `pTarget->pSeed`.
2. **Room & Unit Iteration Order (`0x6FD0B8B0`)**:
   - Iterates `pCasterRoom->ppRoomList[0 .. dwRoomsNear - 1]`, and within each `D2RoomStrc`, walks `pRoom->pUnitFirst` (`+0x74`), which is a **head-inserted LIFO linked list** (within a single room, higher `unitId` monsters spawned later appear earlier in `pUnitFirst`, i.e., descending `unitId` order when no unit has crossed a room boundary; if a unit crossed rooms, `UNITROOM` re-links it at the head of the destination room's `pUnitFirst`).
   - Distance check (`0x6FC2AE26` / `D2Common`): `(dx * dx + dy * dy) <= radius * radius` using unit subtile coordinates.
3. **Per-Target Callback `0x6FC62EC0` (`0x6FC62EC0..0x6FC630C0`)**:
   - Reads `curHp256 = STATLIST_GetUnitStatSigned(pTarget, 6, 0)` and `curHp = curHp256 >> 8` (`0x6FC62EF8`). If `curHp < 1`, returns `0` (`0x6FC62EFF`).
   - Reads `DifficultyLevels.txt` `StaticFieldMin` (`+0x48`: `0` in Normal, `33` in Nightmare, `50` in Hell) (`0x6FC62F30`).
   - Reads `maxHp = D2Common_GetMaxLife(pTarget) >> 8` (`0x6FC62F48`).
   - Computes `minAllowedHp = (StaticFieldMin > 0) ? mulDiv113c(maxHp, StaticFieldMin, 100) : 0` (`0x6FC62F66`). If `curHp <= minAllowedHp`, returns `0` (`0x6FC62F70`).
   - Reads `pct = Skills.txt.Param2` (`25`) (`0x6FC62F78`), computes `cutHp = mulDiv113c(curHp, 25, 100)` (`0x6FC62F8B`).
   - Caps `cutHp` at `curHp - minAllowedHp` (`0x6FC62F98`), and caps `cutHp` at `curHp - 1` (`0x6FC62FA4`: Static Field can never kill directly).
   - Converts to fixed-point: `dmg256 = cutHp << 8`; clamps below at `SKILLS_GetMinElemDamage(pCaster, 42, slvl, 1)` (`0x6FC62FB6`, which is `0` because `Skills.txt` `#42 Static Field` has `EMin = 0`).
   - Checks target Lightning Resistance (`stat 41`, `0x6FC63001`): if `ltngRes < 0` (`0x6FC63008`), pre-divides `dmg256 = (dmg256 * 100) / (100 - ltngRes)` (`0x6FC63050..0x6FC63054`) so negative lightning resistance in `SUNITDMG_CalcDamageResists` will NOT amplify Static Field above `25%`! Positive lightning resistance (`0 < ltngRes < 100`) is **not** compensated and reduces Static Field normally in `0x6FCFC0B0` (`>= 100` Lightning Immune deals `0`).
   - Zeroes `subDmg` (`0x70` bytes), sets `wResultFlags = 0x4001` (`HIT | SOFTHIT`), `dwLtngDamage = dmg256`, `dwHitClass = 0x4D`, and calls `0x6FCFE0C0(pCaster, pTarget, &subDmg, bCallCalcResist = 1)` + `0x6FCFCF20` (`0x6FC6304B`, `0x6FC63056`).

---

## 5. RNG Consumption Summary (`Monster -> Player` Landed Melee Hit)

| Step | Function & VA | Seed Owner | Condition | Modulo / Roll |
|---:|---|---|---|---|
| 1 | `SUNITDMG_RollToHit` `0x6FCFE017` | `pMonster->pSeed` | Always on melee swing | `rand(100)` |
| 2 | `SUNITDMG_FillPacket` `0x6FCFC016` | `pMonster->pSeed` | `maxPhys256 > minPhys256` | `rand(maxPhys256 - minPhys256)` |
| 3 | `SUNITDMG_FillPacket` `0x6FCFD908` | `pMonster->pSeed` | Always after phys roll | `rand(1)` (`1` LCG step, result `0`) |
| 4 | `MONSTER_RollCrit` `0x6FC9713B` | `pMonster->pSeed` | `MonStats.crit > 0` | `rand(100) < crit` |
| 5 | `SUNITDMG_RollBlock` `0x6FCFB7F8` | `pPlayer->pSeed` | `UNITS_GetBlockRate > 0` (`ShieldBlock` & equipped shield) | `rand(100) < blockRate` |
| 6 | `SUNITDMG_RollAvoid` `0x6FCFB030` | `pPlayer->pSeed` | `stat 65 / 66 > 0` | `rand(100) < dodgePct` |
| 7 | `ITEMEVENTS_Fn21_CtCWhenStruck` `0x6FCCDD6B` | **`pPlayer->pSeed`** | Landed hit (`wResultFlags & 0x04`), `!state(54)`, per distinct `(skillId, slvl)` layer in **LIFO equip order** | `rand(100) < chance` |
| 8 | `ITEMS_RollArmorLossSlot` `0x6FCFEC75` | **`pPlayer->pSeed`** | Landed melee/phys hit | `rand(7)` |
| 9 | `ITEMS_RollArmorLossWeight` `0x6FCFECAE` | **`pPlayer->pSeed`** | Always right after `rand(7)` | `rand(weightSum)` |
| 10 | `ITEMS_RollDurabilityLoss` `0x6FC32F3D` | **`pPlayer->pSeed`** | Selected armor slot has an equipped item with max durability `> 0` (`!nodurability` & `stat 73 > 0`) | `rand(100) < 10` (`4` if ethereal? No, `10%` in `0x6FC32F3D`) |
| 11 | `SUNITDMG_CheckSkipGetHit` `0x6FCFB9A1` / `0x6FCFB9CC` | **`pPlayer->pSeed`** | Defender survived, `!state(1)`, `!state(21)`, **`dwDmgTotal >= 0x100`**, and `dwDmgTotal >= maxHp256 / d` | `rand(2)` (`[1/d, 2/d)`) -> `rand(4)` (`[1/d, 4/d)`) |

---

## 6. Equipped Set Slot States (`D2Common.#10600` `0x6FD7C630` & `D2Game` `0x6FCF51A0`)

- `D2Game.dll` `ITEMS_UpdateSets` (`0x6FCF51A0..0x6FCF555C`) scans active unbroken equipped body locations `1..10` (excluding weapon swap `11, 12`, unbroken `!0x100`, requirements met `!0x4000`) and invokes `D2Common.#10600` (`0x6FD7C910` -> `0x6FD7C630..0x6FD7C90B`).
- `0x6FDDCA08` holds the 6-DWORD state ID table `[165, 166, 167, 168, 169, 170]` (`itemset1 .. itemset6`).
- `0x6FD7C630` allocates **1 slot state per distinct equipped set (`Sets.txt` `wSetId`)** in body-location scan order (`STAT_ITEMSET` `71 = wSetId`) and toggles `STATES_ToggleState(pPlayer, 165 + slotIdx, 1)` (`0x6FD7C7A1`). Wearing pieces from $K$ distinct sets activates `165 .. 165 + min(K, 6) - 1` (e.g. wearing 1 piece of *Hwanin's Majesty* activates `state 165`).

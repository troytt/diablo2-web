# D2Game 元素吸收解析 (0x6FCFAD00 & 0x6FCFE237) — 1.13c

Source: `samples/d2/D2Game.dll` (image base `0x6FC20000`), `samples/d2/D2Common.dll`
(`0x6FD50000`), `ItemStatCost.txt` / `Properties.txt` / `Skills.txt` from `Patch_D2.mpq`.
Server implementation: `src/server/engine/combat-pipeline.ts` (`ELEM_ABSORB_STAT_MAP`,
`applyElementalAbsorb113c`, `executeSUnitDmg`) and `src/server/engine/game-instance.ts`.

## Descriptor table (`D2Game.dll` @ `0x6FD22AB0`, stride `0x2C`, 12 rows)

`0x6FCFC0B0` (`SUNITDMG_CalcResistAndAbsorb`) iterates the 12 resistance/absorb descriptors at
`0x6FD22AB0` via `0x6FCFBD00` (`SUNITDMG_ApplyResistAndAbsorb`). After applying effective
resistance (`0x6FCFB3C0`), if remaining elemental damage `dmg256 > 0` and `bDontAbsorb == 0`,
`0x6FCFBD78` calls `0x6FCFAD00` (`SUNITDMG_ApplyAbsorb`).

| Row | VA | `dmgOff` | Channel | `resStat` (`+0x04`) | `maxStat` (`+0x08`) | `pierceStat` (`+0x0C`) | `absPctStat` (`+0x10`) | `absFlatStat` (`+0x14`) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `0x6FD22AB0` | `+0x08` | Phys | `36` `damageresist` | `-1` | `-1` | `-1` | `-1` |
| 1 | `0x6FD22ADC` | `+0x10` | Fire | `39` `fireresist` | `40` `maxfireresist` | `333` `passive_fire_pierce` | `142` `item_absorbfire_percent` | `143` `item_absorbfire` |
| 2 | `0x6FD22B08` | `+0x1C` | Ltng | `41` `lightresist` | `42` `maxlightresist` | `334` `passive_ltng_pierce` | `144` `item_absorblight_percent` | `145` `item_absorblight` |
| 3 | `0x6FD22B34` | `+0x24` | Cold | `43` `coldresist` | `44` `maxcoldresist` | `335` `passive_cold_pierce` | `148` `item_absorbcold_percent` | `149` `item_absorbcold` |
| 4 | `0x6FD22B60` | `+0x20` | Magic | `37` `magicresist` | `38` `maxmagicresist` | `-1` | `146` `item_absorbmagic_percent` | `147` `item_absorbmagic` |
| 5..7 | `0x6FD22B8C..` | `+0x30`/`+0x34`/`+0x2C` | ColdLen / Freeze / PoisLen | `43` / `43` / `110` | `44` / `44` / `-1` | `335` / `335` / `336` | `-1` | `-1` |
| 8 | `0x6FD22C10` | `+0x28` | Poison | `45` `poisonresist` | `46` `maxpoisonresist` | `336` `passive_pois_pierce` | `-1` | `-1` |
| 9..11 | `0x6FD22C3C..` | `+0x38`/`+0x3C`/`+0x40` | Drain | `-1` | `-1` | `-1` | `-1` | `-1` |

Note on `ItemStatCost.txt` per-level stats (`234..237`, `op = 2`, `op param = 3`, `op base = level`):
- `234` `item_absorb_cold_perlevel` -> `op stat1 = item_absorbcold` (`149`)
- `235` `item_absorb_fire_perlevel` -> `op stat1 = item_absorbfire` (`143`)
- `236` `item_absorb_ltng_perlevel` -> `op stat1 = item_absorblight` (`145`)
- `237` `item_absorb_pois_perlevel` -> `op stat1 = item_absorbmagic` (`147`)

## `SUNITDMG_ApplyAbsorb` (`0x6FCFAD00..0x6FCFAD66`)

```c
// edi = dmg256 (signed; CAN be < 0 when MDR > rawElem), esi = pContext ([esi+0x0C] = pDefender,
// [esi+0x18] = pDamage), ebx = pDescriptor
if (pDescriptor->absPctStat != -1) {                    // 0x6FCFAD04..0x6FCFAD0C
  int pct = D2Common_10519_GetStatSigned(pDefender, pDescriptor->absPctStat, 0); // 0x6FCFAD15
  if (pct >= 40) pct = 40;                              // 0x6FCFAD1A..0x6FCFAD24
  if (pct > 0) {                                        // 0x6FCFAD26..0x6FCFAD28 (NO dmg256 > 0 guard!)
    int pctAbsorbed256 = mulDiv113c(pct, dmg256, 100);  // 0x6FCFAD31: call 0x6FC214D0
    pDamage->dwAbsorbLife += pctAbsorbed256;            // 0x6FCFAD39: add [ecx+0x48], eax
    dmg256 -= pctAbsorbed256;                           // 0x6FCFAD3C: sub edi, eax
  }
  int flat256 = D2Common_10519_GetStatSigned(pDefender, pDescriptor->absFlatStat, 0) << 8; // 0x6FCFAD48..0x6FCFAD4D
  if (flat256 > 0) {                                    // 0x6FCFAD50..0x6FCFAD52
    int flatAbsorbed256 = flat256 < dmg256 ? flat256 : dmg256; // 0x6FCFAD54..0x6FCFAD58 (signed jl)
    pDamage->dwAbsorbLife += flatAbsorbed256;           // 0x6FCFAD5D: add [esi+0x48], eax
    dmg256 -= flatAbsorbed256;                          // 0x6FCFAD60: sub edi, eax
  }
}
return dmg256;                                          // 0x6FCFAD62..0x6FCFAD66
```

See also [`d2game-item-defense-absorb-thorns-ctc-113c.md`](./d2game-item-defense-absorb-thorns-ctc-113c.md) for the full `0x6FCFC0B0` -> `0x6FCFBD00` -> `0x6FCFAD00` -> `0x6FCFE0C0` call tree, signed `DR`/`MDR` overflow spill, and `ITEMEVENTS` ordering.

## Pre-Damage Life Addition (`0x6FCFE237` -> `SUNITDMG_AddLife` `0x6FCFB570`)

In `SUNITDMG_ExecuteEvents` (`0x6FCFE19C..0x6FCFE268`):
1. `0x6FCFE237`: calls `SUNITDMG_AddLife(pDefender, pDamage->dwAbsorbLife)` (`0x6FCFB570`):
   - Checks `dwAbsorbLife > 0`, `!SUNITDMG_IsDead(pDefender)`, and `!States_CheckState(pDefender, 92 /* death_delay */)`.
   - Reads `curHp256 = D2Common_GetStatSigned(pDefender, STAT_HITPOINTS=6, 0)` and `maxHp256 = D2Common_GetMaxLifeFromUnit(pDefender)`.
   - Sets `STAT_HITPOINTS (6) = min(curHp256 + dwAbsorbLife, maxHp256)`.
2. `0x6FCFE242..0x6FCFE264`: if `pDamage->dwTotalDamage > 0`, subtracts `dwTotalDamage` from the updated `STAT_HITPOINTS (6)`.

Because `SUNITDMG_AddLife` clamps at `maxHp256` **before** subtracting `dwTotalDamage`:
- When the defender is at full HP (`curHp256 == maxHp256`), the absorb heal is clamped to `maxHp256`, so net HP loss is `dmgAfterRes - absorbed` (1x reduction, NOT 2x).
- When the defender is missing at least `absorbed` HP (`curHp256 + absorbed <= maxHp256`), the heal restores `absorbed` HP before `dmgAfterRes - absorbed` is subtracted, resulting in `dmgAfterRes - 2 * absorbed` net HP change.

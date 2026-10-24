# Character Sheet Vitals Boxes & HUD Globe Max-Vitals Aggregation (`D2Client.dll` / `D2Common.dll` v1.13c)

## 1. Binary Ground Truth Overview

- **Character Sheet Render Entry**: `D2Client.dll` `0x6FB6CEA0` (`UI_DrawCharSheet`)
- **Character Sheet Stat Readout Table**: `D2Client.dll` `0x6FB8D6F0` (18 entries × 16 bytes)
- **HUD Life Globe Render Entry**: `D2Client.dll` `0x6FAD7BD0` (`HUD_DrawLifeGlobe`)
- **HUD Mana Globe Render Entry**: `D2Client.dll` `0x6FAD7A90` (`HUD_DrawManaGlobe`)
- **HUD Current Vital Helper**: `D2Client.dll` `0x6FAD6B20` (`HUD_GetUnitVitalShifted`)
- **Unit Max-Vitals Helpers (`D2Common.dll` v1.13c)**:
  - `#10913` (`0x6FD890F0`, `D2Common_GetMaxLifeFromUnit`) → `D2Common_GetUnitStat(pUnit, STAT_MAXHP /* 7 */, 0)`
  - `#10186` (`0x6FD890A0`, `D2Common_GetMaxManaFromUnit`) → `D2Common_GetUnitStat(pUnit, STAT_MAXMANA /* 9 */, 0)`
  - `#10578` (`0x6FD89050`, `D2Common_GetMaxStaminaFromUnit`) → `D2Common_GetUnitStat(pUnit, STAT_MAXSTAMINA /* 11 */, 0)`
- **S2C Vitals / Base Attribute Packets (`D2Client.dll` v1.13c)**:
  - `S2C 0x1D / 0x1E / 0x1F` (`0x6FB5EDF0`) → calls `D2Common_SetUnitStat` (`#10510`) on the unit's **base** `StatList` (`pUnit->pStats->BaseStats`).
  - `S2C 0x95 HPMPPotUpdate` (`0x6FB5EBE0`) & `S2C 0x18 HPMPUpdate` (`0x6FB5ECA0`) → store current `STAT_HITPOINTS (6)`, `STAT_MANA (8)`, `STAT_STAMINA (10)` as `value << 8` (8.8 fixed-point).

---

## 2. Character Sheet Stat Readout Table (`0x6FB8D6F0`)

`UI_DrawCharSheet` (`0x6FB6CEA0`) iterates through 18 descriptor entries at `0x6FB8D6F0` (`stride = 16`, `sizeof(CharSheetStatBox) = 0x10`), where each entry has layout:

```c
struct CharSheetStatBox {
    int16_t nStatId; // +0x00: ItemStatCost.txt ID (-1/-2 = special combat rows)
    int16_t _pad02;  // +0x02
    int32_t xLeft;   // +0x04: Left X relative to panel origin ox
    int32_t xRight;  // +0x08: Right X relative to panel origin ox
    int32_t yBase;   // +0x0C: Baseline Y relative to panel origin oy
};
```

### Vitals Entries (`[7]..[13]`)

| Entry | `nStatId` | Stat Constant | `xLeft..xRight` (`midX`) | `yBase` | Color Rule (`0x6FB6D6C5..0x6FB6D84E`) |
|---|---|---|---|---|---|
| `[7]` | `11` | `STAT_MAXSTAMINA` | `232..267` (`ox + 250`) | `oy + 246` | **Left Box (Max)**: Blue (`3`) if `total(11) > base(11)`, Red (`1`) if `total(11) < base(11)`, else White (`0`) |
| `[8]` | `10` | `STAT_STAMINA` | `273..308` (`ox + 291`) | `oy + 246` | **Right Box (Current)**: White (`0`) |
| `[9]` | `7` | `STAT_MAXHP` | `232..267` (`ox + 250`) | `oy + 270` | **Left Box (Max)**: Blue (`3`) if `total(7) > base(7)`, Red (`1`) if `total(7) < base(7)`, else White (`0`) |
| `[10]` | `6` | `STAT_HITPOINTS` | `273..308` (`ox + 291`) | `oy + 270` | **Right Box (Current)**: White (`0`); if `0 <= (raw >> 8) <= 1` and player mode `!= 0` and `!= 17`, clamped to `1` (`0x6FB6D743..0x6FB6D77C`) |
| `[12]` | `9` | `STAT_MAXMANA` | `232..267` (`ox + 250`) | `oy + 308` | **Left Box (Max)**: Blue (`3`) if `total(9) > base(9)`, Red (`1`) if `total(9) < base(9)`, else White (`0`) |
| `[13]` | `8` | `STAT_MANA` | `273..308` (`ox + 291`) | `oy + 308` | **Right Box (Current)**: White (`0`) |

> **Key Invariant**: In authentic Diablo II v1.13c, the **LEFT box (`ox + 250`)** always renders **Maximum** Stamina / Life / Mana (colored blue when boosted by equipment, charms, or active buffs such as Battle Orders / Oak Sage), and the **RIGHT box (`ox + 291`)** always renders **Current** Stamina / Life / Mana (always white).

---

## 3. HUD Globes & Full-Unit Max-Vitals Aggregation (`0x6FAD7BD0` / `0x6FAD7A90`)

In `D2Client.dll`:
1. **`HUD_DrawLifeGlobe` (`0x6FAD7BD0`)**:
   - Calls `0x6FAD6B20(STAT_HITPOINTS /* 6 */)` to read `curHp = D2Common_GetUnitStat(pPlayer, 6, 0) >> 8` (clamping `<= 1` to `1` when alive).
   - Calls `D2Common_10913_GetMaxLifeFromUnit(pPlayer)` (`0x6FD890F0`) and shifts right by 8 (`sar eax, 8`) to obtain `maxHp`.
   - Computes fill height `clamp(trunc(curHp * 80 / maxHp), 2, 80)` (`0x6FAD7C04..0x6FAD7C2C`) and hover tooltip string `"Life: %d / %d"`.
2. **`HUD_DrawManaGlobe` (`0x6FAD7A90`)**:
   - Calls `0x6FAD6B20(STAT_MANA /* 8 */)` to read `curMana = D2Common_GetUnitStat(pPlayer, 8, 0) >> 8`.
   - Calls `D2Common_10186_GetMaxManaFromUnit(pPlayer)` (`0x6FD890A0`) and shifts right by 8 (`sar eax, 8`) to obtain `maxMana`.
3. **Why `S2C 0x1D/0x1E/0x1F` Base Stats Alone Are Insufficient**:
   - `S2C 0x1D/0x1E/0x1F` (`0x6FB5EDF0`) writes only the character's unequipped base pool stats (`pStats->BaseStats` for `STAT_MAXHP = 7`, `STAT_MAXMANA = 9`, `STAT_MAXSTAMINA = 11`).
   - Meanwhile, `S2C 0x95` / `S2C 0x18` transmits the server's authoritative current `STAT_HITPOINTS (6)` / `STAT_MANA (8)` / `STAT_STAMINA (10)`, which at full health equals the **aggregated** maximum (including equipped items, inventory charms, set bonuses, passive skills, active states, and `ItemStatCost.txt` `op` rules such as `+Vitality -> +MaxHp/+MaxStamina`, `+Energy -> +MaxMana`, `item_maxhp_percent`, `item_hp_perlevel`).
   - Both the Character Sheet (`0x6FB6D6A0`) and the HUD Globes (`0x6FAD7BD0`, `0x6FAD7A90`) evaluate `D2Common_GetUnitStat` (`sub_6FDB5830` `StatOpEngine`) across all attached stat lists so `hud.maxHp`, `hud.maxMana`, `hud.maxStamina` and `charSheet.attrs.maxHp/maxMana/maxStamina` stay strictly identical.

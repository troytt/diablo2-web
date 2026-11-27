# D2Game 生命/法力偷取 (0x6FCFBA40) — 1.13c

Source: `samples/d2/D2Game.dll` (image base `0x6FC20000`), `samples/d2/D2Common.dll`
(`0x6FD50000`), `DifficultyLevels.txt` / `MonStats.txt` / `ItemStatCost.txt` from
`Patch_D2.mpq`. Server implementation: `src/server/engine/combat-pipeline.ts`
(`computeLifeManaSteal113c`, `mulDiv113c`, `stealAttackerClass113c`,
`isMonsterClassUnit113c`) and `src/server/engine/difficulty-resist-penalty.ts`
(`difficultyLifeStealDivisor`, `difficultyManaStealDivisor`).

## Damage record filler (`0x6FCFD6FB..0x6FCFD763`)

`SUNITDMG_FillDamageValues` reads the attacker's `ItemStatCost.txt` stats:

- `0x3C` (60) `lifedrainmindam` / `0x3D` (61) `lifedrainmaxdam` → `pDmg+0x38` (`LifeLeech`)
- `0x3E` (62) `manadrainmindam` / `0x3F` (63) `manadrainmaxdam` → `pDmg+0x3C` (`ManaLeech`)

Note: `lifesteal` and `manasteal` are `Properties.txt` property codes (mapping to
stats 60 and 62), not `ItemStatCost.txt` stat names.

## Leech application (`0x6FCFBA40`)

Registers on entry:

- `eax` → `esi`: damage struct (`[esi+0x08]` = `PhysDamage`, `[esi+0x38]` = `LifeLeech`, `[esi+0x3C]` = `ManaLeech`)
- `edx`: `pGame` (`[edx+0x6D]` = difficulty byte `0..2`)
- `ecx` → `ebx`: `pDefender` (`[ebx]` = `dwUnitType`, `1` = `UNIT_MONSTER`)
- `[esp+0x1C]` → `edi`: `pAttacker` (`[edi]` = `dwUnitType`, `0` = `UNIT_PLAYER`)

### Step-by-step flow

1. **Zero check (`0x6FCFBA47..0x6FCFBA5A`)**:
   If `[esi+0x38] == 0` and `[esi+0x3C] == 0`, return immediately.
2. **Defender `Drain` lookup (`0x6FCFBA60..0x6FCFBA9C`)**:
   - If `pDefender != NULL` and `pDefender->dwUnitType == 1` (`UNIT_MONSTER`):
     read `MonStatsTxt` (`[[ebx+0x14]]`) offset `0xA0 + difficulty` (`Drain`, `Drain(N)`, `Drain(H)`).
     If `drain <= 0` (`jle 0x6FCFBCE9`), return immediately (e.g. `skeleton1..5` have `Drain = 0`).
   - Otherwise (`UNIT_PLAYER` or non-monster): `drain = 100` (`0x64`).
3. **6-bit fixed-point shift (`0x6FCFBAA2..0x6FCFBAB1`)**:
   `LifeLeech <<= 6`, `ManaLeech <<= 6`.
4. **Attacker class & `DifficultyLevels` divisor (`0x6FCFBAB4..0x6FCFBC20`)**:
   - `pAttacker->dwUnitType == 0` (`UNIT_PLAYER`, `0x6FCFBABA`):
     call `D2Common.#10237` (`0x6FC2A7BA`) to fetch the `DifficultyLevels.txt` record (`0x58` bytes):
     - `+0x28` `LifeStealDivisor` (`1 / 2 / 3`): if non-zero, `LifeLeech /= LifeStealDivisor` (signed `idiv`).
     - `+0x2C` `ManaStealDivisor` (`1 / 2 / 3`): if non-zero, `ManaLeech /= ManaStealDivisor` (signed `idiv`).
   - `pAttacker->dwUnitType == 1` (`UNIT_MONSTER`, `0x6FCFBBB8`):
     if `D2Common.#11104` (`0x6FC2A7F6`, hireling check) is non-zero or the monster's owner (`0x6FC2A7CC`) is `UNIT_PLAYER` (`0`), jump to `0x6FCFBAF6` (uses the percentage leech formula **without** the difficulty divisor).
   - Other monsters take `0x6FCFBC22` (separate innate monster drain path).
5. **Physical damage check (`0x6FCFBAF6..0x6FCFBAFD`)**:
   `ebx = [esi+0x08]` (`PhysDamage`). If `ebx <= 0`, return.
6. **Mana steal (`0x6FCFBB03..0x6FCFBB41`)** and **Life steal (`0x6FCFBB43..0x6FCFBB84`)**:
   For each non-zero channel (`pct64`):
   - `v = MulDiv(pct64, PhysDamage, 100)` (`0x6FC214D0`)
   - if `drain != 100`: `v = MulDiv(drain, v, 100)` (`0x6FC214D0`)
   - `leeched256 = v / 64` truncated toward zero (`cdq; and edx, 0x3F; add eax, edx; sar eax, 6`)
   - Mana: `0x6FCFAE70` adds `leeched256` to stat 8 (`mana`), clamped to `maxmana` (stat 9).
   - Life: `0x6FCFB570` skips dead units or units with state `0x5C` (92 `death_delay`), adds `leeched256` to stat 6 (`hitpoints`), clamped to `maxhp` (stat 7).
   - Overlays: `0x97` (151 `steallife`) and/or `0x98` (152 `stealmana`).

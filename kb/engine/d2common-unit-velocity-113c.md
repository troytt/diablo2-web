# D2Common 1.13c Unit Velocity & Step Kinematics (`UNITS_UpdateAnimRateAndVelocity`)

## Authoritative Binary References (`D2Common.dll` & `D2Game.dll` v1.13c)

- `D2Common.dll` `#10819` (`UNITS_UpdateAnimRateAndVelocity`, `0x6FD83140`; fixed skill move `0x1000` @ `0x6FD8330C`, standard walk/run @ `0x6FD833CF`)
- `D2Common.dll` (`UNITS_SetRunBonus`, `0x6FD82EA0`)
- `D2Common.dll` `#10149` (`PATH_SetVelocity`, `0x6FD84D40`; `D2Game.dll` import thunk `0x6FC2ACAC`)
- `D2Common.dll` `#10226` (`PATH_StepDynamicPath`, `0x6FD8E9A0` / `step.ts`)
- `D2Common.dll` `#10193` (`PATH_AdjustDirection`, `0x6FD5D240`)
- `D2Game.dll` `MONSTER_InitStats` (`0x6FCCFDB0` @ `0x6FCCFFD1..0x6FCCFFD8`): initializes `STAT_VELOCITYPERCENT (67) = 75 (0x4B)` on every monster (`STAT_ATTACKRATE (68) = 100` @ `0x6FCCFFC5`, `STAT_OTHER_ANIMRATE (69) = 100` @ `0x6FCCFFDD`)

---

## 1. Fixed-Point Representation & Sub-Tile Conversion

In Diablo II v1.13c, `CharStats.txt` (`WalkVelocity = 6`, `RunVelocity = 9`) and `MonStats.txt` (`Velocity`, `Run`) store integer base speed units.

1. **`dwVelocity` (Q8.8 format)**:
   - Base velocity is shifted left by 8 bits:
     - Player walk base: `6 << 8 = 1536` (`0x0600`)
     - Player run base (`+50%`): `9 << 8 = 2304` (`0x0900`)
     - Monster walk base: `MonStats.Velocity << 8`
2. **`D2Common_10226` (`nBaseVelocity = 1024`) & 4096-scaled Direction Vectors**:
   - `PATH_ComputeVelocityAndDirectionVectorsToNextPoint` computes:
     - `velScaled = (pDynamicPath->dwVelocity * nBaseVelocity) >> 6` = `dwVelocity * 16`
     - `tVelocityVector.{x,y} = (tDirectionVector.{x,y} * velScaled) >> 12`
   - Along an axis-aligned cardinal direction (`|tDirectionVector| = 4096`), `tVelocityVector` equals `dwVelocity * 16` in Q16.16 sub-tile precision (`65536 = 1.0` sub-tile):
     - Player walk (`1536`): `1536 * 16 = 24576` (`0x6000` = `24576 / 65536 = 6/16 = 0.375` sub-tiles/frame = **`9.375` sub-tiles/s** at 25 Hz)
     - Player run (`2304`): `2304 * 16 = 36864` (`0x9000` = `36864 / 65536 = 9/16 = 0.5625` sub-tiles/frame = **`14.0625` sub-tiles/s** at 25 Hz)
     - Note: Older community docs quoted `6 * 1.5 = 9.0` / `9 * 1.5 = 13.5` sub-tiles/s by rounding `25/16 = 1.5625` down to `1.5`, which lags real `D2Game.dll` by 1 sub-tile every 16 frames (`f=57` in `a1-town-walk`).

---

## 2. `STAT_VELOCITYPERCENT` (Stat 67) Aggregation & Clamping

`UNITS_UpdateAnimRateAndVelocity` (`0x6FD83140`) aggregates `STAT_VELOCITYPERCENT` (`67`) as an integer percentage (`100` base on players; **`75` (`0x4B`) base on all monsters** initialized in `MONSTER_InitStats` `0x6FCCFFD1`):

1. **Item Faster Run/Walk (`STAT_ITEM_FASTERRUNWALK`, stat 96)**:
   - Diminishing returns for positive item FRW:
     $$\text{effItemFrw} = \begin{cases} \lfloor \frac{150 \cdot \text{frw}}{150 + \text{frw}} \rfloor & \text{if } \text{frw} > 0 \\ \text{frw} & \text{otherwise} \end{cases}$$
2. **Player Run Bonus (`UNITS_SetRunBonus`, `0x6FD82EA0`)**:
   - Adds `trunc((100 * RunVelocity) / WalkVelocity) - 100 = 50` directly to `STAT_VELOCITYPERCENT` (disabled when stamina is exhausted).
3. **Skill FRW, Armor Speed Penalty & Chill/Slow**:
   - Skill FRW (e.g. Vigor, Burst of Speed, Frenzy, Increased Speed) adds directly without diminishing returns.
   - Equipped body armor + shield `Speed` column (`Armor.txt`) subtracts directly (`Medium = 5`, `Heavy = 10`).
   - Cold chill (`coldeffect`) / Holy Freeze / Decrepify / Slows Target subtracts directly.
4. **25% Floor**:
   - `pct = max(25, baseVelocityPercent + effItemFrw)`
   - `dwVelocity = trunc((pct * (baseVel << 8)) / 100)` (`0x6FD833CF`)

---

## 3. All `PATH_SetVelocity` Call Sites in `D2Common.dll` & `D2Game.dll`

Exhaustive disassembly scan of `D2Common.#10149` (`PATH_SetVelocity`, `0x6FD84D40`, `D2Game.dll` import thunk `0x6FC2ACAC`) confirms standard player and monster walking/running always go through `UNITS_UpdateAnimRateAndVelocity` (`0x6FD833CF`). Every direct `PATH_SetVelocity` call site is listed below:

| Binary & VA | Subsystem / Skill | Velocity Value (`dwVelocity`) |
| --- | --- | --- |
| `D2Common.dll` `0x6FD8330C` | `UNITS_UpdateAnimRateAndVelocity` (fixed skill move mode) | `0x1000` (`4096`) |
| `D2Common.dll` `0x6FD833CF` | `UNITS_UpdateAnimRateAndVelocity` (player & monster walk/run) | `trunc((max(25, STAT_VELOCITYPERCENT + effItemFrw) * baseVelFp8) / 100)` |
| `D2Game.dll` `0x6FC46B0A`, `0x6FC483F5`, `0x6FCD634B` | Knockback (`PATHTYPE_KNOCKBACK_SERVER` / `9`) | Fixed knockback slide velocity |
| `D2Game.dll` `0x6FC8FD16`, `0x6FC8FD90` | Missile creation (`MISSILE_CreateMissileFromParams` `0x6FC8F930`) | `Missiles.txt` `Vel << 8` |
| `D2Game.dll` `0x6FCB97F5` | Barbarian Leap / Leap Attack | `max(50, STAT_VELOCITYPERCENT) + skillCalc` |
| `D2Game.dll` `0x6FCCFAD5` | Monster initial spawn walk (before `MONSTER_StartMove` -> `75%`) | `MonStats.Velocity << 8` |
| `D2Game.dll` `0x6FCD4027` | Barbarian Whirlwind | `trunc((max(256, WalkVelocity << 8) * STAT_VELOCITYPERCENT) / 100)` |

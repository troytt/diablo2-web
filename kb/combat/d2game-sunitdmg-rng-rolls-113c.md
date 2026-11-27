# D2Game.dll v1.13c `SUnitDmg` RNG Damage & Combat Roll Order

## Binary Evidence (`samples/d2/D2Game.dll`, Image Base `0x6FC20000`)

### 1. Damage Range Roll (`SUnitDmg_CreateDamagePacket` `0x6FCFCD80` -> `0x6FCFBED0`, `SUnitDmg_FillPacket` `0x6FCFC530`, `SUnitDmg_RollDamageValues` `0x6FCFD5C2..0x6FCFD6D3`)
- `D2Game.dll` never averages `(min + max) / 2` for physical or elemental damage.
- Every min/max damage pair is rolled uniformly via the attacker's seeded LCG (`pAttacker->fSeed` at `+0x20`, multiplier `0x6AC690C5 = 1791398085`):
  - If `max - min > 0`:
    ```c
    span = max - min + 1;
    seed = seed * 0x6AC690C5u + carry;
    rolled = min + (uint32_t)(((uint64_t)seed * (uint64_t)span) >> 32);
    ```
  - In `0x6FCFBED0` (`0x6FCFCE08..0x6FCFCEBF`), monster/missile packet creation rolls physical `min..max` (`0x6FCFBEE3..0x6FCFBF19`) and elemental `eMin..eMax` (`0x6FCFBFAB..0x6FCFBFDE`) before resistance mitigation.
  - In `0x6FCFD5C2..0x6FCFD6D3`, player/skill combat rolls physical `[min256, max256]`, fire `[fMin256, fMax256]`, lightning `[lMin256, lMax256]`, magic `[mMin256, mMax256]`, cold `[cMin256, cMax256]`, and poison bitrate `[pMin256, pMax256]` via independent LCG steps.

### 2. Unarmed Base Physical Damage (`SUnitDmg_FillPacket` `0x6FCFC5A2..0x6FCFC5C8`)
- When no weapon is equipped (or two-handed check selects single-hand stats), `D2Game.dll` queries `D2Common_GetUnitStat(pAttacker, STAT_MINDAMAGE=21, 0)` and `D2Common_GetUnitStat(pAttacker, STAT_MAXDAMAGE=22, 0)`:
  - `if (minDmg <= 0) minDmg = 1;` (`0x6FCFC5B5..0x6FCFC5BE`)
  - `if (maxDmg <= 1) maxDmg = 2;` (`0x6FCFC5C0..0x6FCFC5C8`)
- Unarmed base weapon damage is `1`–`2` (256-fixed: `256`–`512`), never `25`–`45`.

### 3. Independent `rand(100)` Combat Rolls
Each probability check in the combat pipeline draws its own `0..99` LCG roll (`span = 100`, `mul 0x64`) and never reuses the to-hit roll:
1. **To-Hit (`SUnitDmg_CheckToHit` `0x6FCFE011..0x6FCFE031`)**:
   - Clamps hit chance to `[5, 95]`, then rolls `rand(100) < toHitPct`.
2. **Shield Block (`SUnitDmg_CheckBlock` `0x6FCFB7A0`, roll at `0x6FCFB7F5..0x6FCFB812`)**:
   - Evaluates effective block chance (capped at `75%`, divided by `3` when defender is running in mode `3`), then rolls `rand(100) < effBlock`.
3. **Passive Avoidance (`SUnitDmg_CheckPassiveAvoidance` `0x6FCFB020`)**:
   - Moving (`mode == 2 || mode == 3`): rolls Evade (`STAT_PASSIVE_EVADE`, `0x6FCFB065..0x6FCFB088`).
   - Dual-claw Assassin standing/attacking: rolls Weapon Block (`0x6FCFB0DE..0x6FCFB101`).
   - Standing/attacking vs melee: rolls Dodge (`STAT_PASSIVE_DODGE`, `0x6FCFB11F..0x6FCFB142`).
   - Standing/attacking vs missile/ranged: rolls Avoid (`STAT_PASSIVE_AVOID`, `0x6FCFB156..0x6FCFB179`).
4. **Critical Strike / Mastery Crit / Deadly Strike (`SUnitDmg_RollCrit` `0x6FCFD51A..0x6FCFD5A6`)**:
   - Mutually exclusive sequential rolls when `physicalDmg256 > 0`:
     1. Weapon Mastery Crit (`0x6FCFD549`): `rand(100) < masteryCritPct` -> double physical damage, skip CS and DS.
     2. Critical Strike (`0x6FCFD573`, `STAT_PASSIVE_CRITICAL_STRIKE`): if Mastery Crit did not trigger, `rand(100) < csPct` -> double physical damage, skip DS.
     3. Deadly Strike (`0x6FCFD59D`, `STAT_ITEM_DEADLYSTRIKE` `#141`): if neither Mastery Crit nor CS triggered, `rand(100) < dsPct` -> double physical damage.
5. **Concentration Uninterruptible Check (`0x6FCFC8D6..0x6FCFC901`)**:
   - When `STATE_CONCENTRATION` (`#113`) is active on the unit, rolls `rand(100) < 20` (`Skills.txt` Concentration `Param1 = 20`) using a fresh LCG draw.

### 4. Corpse Explosion Base Corpse HP Roll (`SKILLS_SrvDo061_CorpseExplosion` `0x6FD1245C..0x6FD12495`)
- Reads `par1 = 70` and `par2 = 120` from `Skills.txt` row `#74` (`Corpse Explosion`), then rolls `pct = par1 + rand(par2 - par1 + 1)` (`70..120%` inclusive) before scaling by `/players` baseline HP and difficulty percentage.

# Diablo II v1.13c A5Q2: Rescue on Mount Arreat (`prisondoor` `#434`, `cagedwussie1` `#473`, `act5pow` `#534`) & Overseer Whip (`#295`) `SuicideMinion` Morph

Ground truth: `D2Game.dll` 1.13c (`ImageBase 0x6FC20000`, `a5q2.cpp`, `SUnitMsg.cpp`, `MonsterInit.cpp`, `Skills.cpp`, `MonAI.cpp`).
MPQ tables: `Objects.txt` (`189`, `473`), `MonStats.txt` (`434`, `453..468`, `479..483`, `522..523`, `534..536`), `MonLvl.txt`, `Skills.txt` (`#295 Overseer Whip`).
Port: `src/server/engine/game-instance/world-spawning-and-aoi.ts`, `src/server/engine/game-instance/quests-objects-and-portals.ts`, `src/server/engine/game-instance/monster-death-and-xp.ts`, `src/server/engine/game-instance/boss-encounters-ai.ts`, `src/server/engine/game-instance/state.ts`. Issue #2021.

---

## 1. Frigid Highlands (`Levels.txt` ID 111) Prison Pen Units & Objects

| Kind | ID / `hcIdx` | Token / Key | Key Columns & Role |
|---|---|---|---|
| `Objects.txt` | `473` (`0x1D9`) | `cagedwussie1` | `InitFn = 28`, `OperateFn = 0`, `Selectable[0..7] = 0`: non-clickable pen anchor inside each `FriB/FriC` walled Barbarian prison pen |
| `Objects.txt` | `189` (`0x0BD`) | `Act5Portal` / rescue portal | Temporary Town Portal (`mode = 2`) spawned outside the breached pen so rescued `act5pow` soldiers exit to Harrogath |
| `MonStats.txt` | `434` (`0x1B2`) | `prisondoor` (`Prison Door`) | `AI = Idle`, `Align = 0`, `killable = 1`, `threat = 0`: attackable wooden gate blocking each prison pen entrance |
| `MonStats.txt` | `534` (`0x216`) | `act5pow` (`Barbarian`) | `AI = Wussie`, `Align = 1`, `killable = 1`: captured Barbarian POW (`5` per pen, `15` total across 3 pens) |
| `MonStats.txt` | `522..523, 535..536` | `act5barb1..4` | `Align = 1`: friendly Highland Barbarian warriors fighting demons across Frigid Highlands |

---

## 2. `D2Game.dll` `a5q2.cpp` State Machine (`0x6FC7A310..0x6FC7CB7F`)

### 2.1 Room Activation & POW Spawning (`ACT5Q2_ObjInit` @ `0x6FC7C850..0x6FC7C9CB` -> `0x6FC7C2A0..0x6FC7C393`)
- `Objects.txt 473` (`cagedwussie1`) has `OperateFn = 0` and `Selectable0 = 0`; players never click `473` directly.
- When a Frigid Highlands (`Area 111`) room activates before `a5q2` completion (`QFLAG_REWARDGRANTED` `0x0001` / `QFLAG_REWARDPENDING` `0x0002` / `QFLAG_PRIMARYGOALDONE` `0x1000` unset), `InitFn 28` (`0x6FC7C850`) invokes `0x6FC7C2A0`, spawning **5** friendly `act5pow` (`hcIdx 534`, `Align = 1`) soldiers inside each `473` pen (`15` total across the 3 pens).
- If `a5q2` is already completed or reward-pending when `473` spawns, `473` initializes in `OBJMODE_OPENED` (`mode = 2`).

### 2.2 `prisondoor` (`#434`) & `act5pow` (`#534`) Death Callbacks (`0x6FC7A310..0x6FC7A4FF`, `0x6FC7BA40..0x6FC7BD83`)
- **POW Death (`0x6FC7A41B..0x6FC7A4FF`)**:
  - If an `act5pow` (`hcIdx 534`) dies before its pen is breached, `pQuestDataEx->nDeadSoldiers` (`arreatDeadPowCount`) increments.
- **Prison Door Destruction (`0x6FC7A310..0x6FC7A41A` -> `0x6FC7BA40..0x6FC7BD83`)**:
  - Destroying the pen's `prisondoor` (`hcIdx 434`, `0x1B2`) transitions the co-located `cagedwussie1` (`473`) to `OBJMODE_OPENED` (`mode = 2`), spawns the temporary rescue Town Portal (`Objects.txt 189`, `mode = 2`) at the gate, and triggers `AITHINK_Fn131_Wussie` (`0x6FCC7A10..0x6FCC7C00`) so surviving `act5pow` soldiers in that pen exit through the portal (`UnitRemove`).
  - **Pens 1 & 2**: sets `QFLAG_STARTED` (`0x0004`) on `questFlags[36]` (`a5q2`) and emits `S2C 0x5D` (`questId = 0x20`, `filterStatus = 2`, `extra = barbsRemaining` = `10 -> 5`).
  - **Pen 3 (`0x6FC7BC20`)**: computes `rescuedCount = 15 - nDeadSoldiers`:
    - `rescuedCount >= 15`: sets `QFLAG_STARTED | QFLAG_REWARDPENDING | 0x0020` (`3` runes).
    - `rescuedCount == 14`: sets `QFLAG_STARTED | QFLAG_REWARDPENDING | 0x0040` (`2` runes).
    - `12 <= rescuedCount <= 13`: sets `QFLAG_STARTED | QFLAG_REWARDPENDING | 0x0080` (`1` rune).
    - `rescuedCount < 12`: quest fails (`QFLAG_REWARDPENDING` is NOT set).

### 2.3 Qual-Kehk (`#515`) Rune Reward Tiers (`0x6FC7CA76..0x6FC7CB7F`)
- Talking to Qual-Kehk (`hcIdx 515`) in Harrogath (`Area 109`) while `QFLAG_REWARDPENDING` (`0x0002`) is set grants sequential runes from `['r08', 'r09', 'r07']` (Ral, Ort, Tal) based on `questFlags[36]` count bits:
  - `0x0080`: `1` rune (`r08` Ral)
  - `0x0040`: `2` runes (`r08` Ral, `r09` Ort)
  - `0x0020` (default full rescue): `3` runes (`r08` Ral, `r09` Ort, `r07` Tal)

### 2.4 Friendly Alignment Guard on Boss Death `minionPurge`
- Boss death surrounding-minion purges (such as Shenk the Overseer `hcIdx 479` in `Area 110`/`111` border and Blood Raven) must skip non-hostile units (`surrounding.align !== 0`) so friendly `act5barb1..4` (`522..523, 535..536`) and `act5pow` (`534`) are never killed by Shenk's death purge.

---

## 3. `Skills.txt #295` (`Overseer Whip`) -> `MONSTER_MorphIntoClass` Stat Reinitialization

### 3.1 `D2Game.dll` Call Chain (`0x6FC2D850..0x6FC2DAF6`, `0x6FCCFC50..0x6FCD0501`)
1. `SKILLS_SrvDo131_OverseerWhip` (`0x6FC2D9C0..0x6FC2DAF6`) applies `STATE_WHIPPED` (`140`) and calls `0x6FC2D850`.
2. On the 35% roll when the whipped target is `minion1..8` (`hcIdx 453..460`), `0x6FC2D850` maps `newClassId = hcIdx + 8` (`suicideminion1..8`, `hcIdx 461..468`) and calls `MONSTER_MorphIntoClass(pGame, pTarget, newClassId, 1)` (`0x6FCCFC50..0x6FCCFDAC`).
3. `0x6FCCFC50` invokes `0x6FCD0320` -> `MONSTER_InitStats` (`0x6FCCFDB0..0x6FCD0318`) with the new `MonStats.txt[newClassId]` record:
   - `0x6FCD006C..0x6FCD0075`: sets `STAT_MAXHP` (`7`) to `newMaxHp << 8` from `MonStats.txt[newClassId]` (`minHP..maxHP`) scaled by `MonLvl.txt[mlvl].L-HP` (`rank = normal`, without retaining any pre-morph boss-minion `2x` HP multiplier).
   - `0x6FCD007B..0x6FCD0080`: sets `STAT_HITPOINTS` (`6`) to `newMaxHp << 8` (`hp = newMaxHp`).
   - Recomputes `A1MinD..A1MaxD` from `MonStats.txt[newClassId]` (`100..150`) scaled by `MonLvl.txt[mlvl].L-DM / 100` (e.g., Normal `suicideminion1` `mlvl 31`: `L-HP = 142 -> 53..80 HP`, `L-DM = 20 -> 20..30` attack/explosion base damage instead of unscaled `100..150` or boss-minion `662 HP`), plus `Velocity = 10`, `Run = 10`, and `suicideminion` `aiParams` (`aip1` fire/ice/corpse explosion selector).

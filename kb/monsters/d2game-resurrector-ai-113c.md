# 1.13c Corpse Resurrector AI (`D2Game.dll`)

Authoritative disassembly reference for monster corpse resurrection state machines in Diablo II: Lord of Destruction v1.13c (`D2Game.dll`, `MonStats.txt`, `MonAi.txt`, `Skills.txt`).

## 1. AI Dispatch & `MonStats.txt` Parameters

| `MonAi.txt` Row | `D2Game.dll` Think VA | Spatial Scan Callback VA | `MonStats.txt` Rows (`hcIdx`) | Resurrect Skill | `aip1` (`+0x56`) | `aip2` (`+0x5C`) | `aip3` (`+0x62`) | `aip4` (`+0x68`) | `aip5` (`+0x6E`) |
|---|---|---|---|---|---|---|---|---|---|
| `13 FallenShaman` | `0x6FCA90A0` | `0x6FC9BD50` | `fallenshaman1..5` (`58..62`), `fallenshaman6..8` (`645..647`) | `#181 Resurrect` | Resurrect / approach `%` (`45..90`) | `ShamanFire` `%` (`60..75`) | Melee `%` (`100..80`) | Corpse scan radius (`24..30`) | Ranged shoot distance (`15..20`) |
| `22 GreaterMummy` | `0x6FCA8380` | `0x6FC9B8E0` | `unraveler1..5` (`101..105`), `radament` (`229`), `unraveler6..9` (`667..670`) | `#327 Resurrect2` | Melee / poison breath `%` (`70..85`) | Resurrect `%` (`30..55`) | `#182 Bestow` heal `%` (`40..55`) | `#157 UnHolyBolt` `%` (`60..95`) | Scan radius (`24..31`, `+10` for `hcIdx 229`) |
| `53 FetishShaman` | `0x6FCA7BB0` | `0x6FC9BB90` | `fetishshaman1..5` (`278..282`), `fetishshaman6..8` (`662..664`) | `#327 Resurrect2` | Resurrect `%` (`40..45`) | LOS bypass tier (`0..3`, bypass when `>= 3`) | Max cast range before walking closer (`15..22`) | Idle/stalk `%` (`66`) | Corpse scan radius (`50`) |
| `59 BloodRaven` | `0x6FC39E70` | Cemetery / `#167 Nest` | `bloodraven` (`267`) | Cemetery zombie raise / `#167 Nest` (`zombie2` `#6`) | — | — | — | — | — |

## 2. Decision Order & Gates

### 2.1 `AITHINK_Fn022_GreaterMummy` (`0x6FCA8380..0x6FCA8705`)

1. **Melee (`0x6FCA8393..0x6FCA8438`)**: When `bInMeleeRange != 0`, rolls `rand(100) < aip1` (`+0x56` = `70..85%`) and executes melee `A1` (`mode 4`). Never heals or resurrects while engaged in melee.
2. **Close Poison Breath (`0x6FCA843A..0x6FCA84FB`)**: Else if `targetDist < 5` sub-tiles, rolls `rand(100) < aip1` (`+0x56`) to fire `A2` poison breath.
3. **Spatial Ally & Corpse Scan (`0x6FCA84FE..0x6FCA85A0`, callback `0x6FC9B8E0`)**:
   - Base scan radius is `aip5` (`+0x6E` = `24` Normal, `27` NM, `31` Hell).
   - **Radament (`hcIdx == 229` / `0xE5`)** receives **`+10` radius** (`0x6FCA8543..0x6FCA856E` -> `34 / 37 / 41`), sets `bypassLos = 1` (`0x6FCA8581`), and sets `allowUniqueUndead = 1` (`0x6FCA8587`).
   - Non-Radament Greater Mummies (`[esi+0x18] == 0`) enforce **`DUNGEON_CheckLos(pCaster, pCorpse, 0x8)`** (`0x6FC9B97D`) so solid dungeon walls and closed doors block through-wall resurrection, and exclude other `unraveler` / `GreaterMummy` corpses and unique corpses.
4. **Heal `#182 Bestow` (`0x6FCA85A1..0x6FCA8615`)**: Evaluated before resurrection (`rand(100) < aip3` = `40..55%`).
5. **Resurrect `#327 Resurrect2` (`0x6FCA8618..0x6FCA8690`)**:
   - Requires `rand(100) < aip2` (`+0x5C` = `30%` on `unraveler1`, `45%` on `radament` in Normal) at `0x6FCA864A`.
   - Calls `SKILLS_CanUnitCorpseBeResurrected` (`0x6FD13E30`) to verify the corpse is unconsumed (`!state 104`, `!shattered`) and its sub-tile is walkable.
   - Uses standard AI/action cooldown, never `aip1` (`70..85`).
6. **Ranged `#157 UnHolyBolt` / `#354 UnHolyBoltEx` (`0x6FCA8693..0x6FCA86FF`)**: Else rolls `rand(100) < aip4` (`+0x68` = `60..95%`).

### 2.2 `AITHINK_Fn013_FallenShaman` (`0x6FCA90A0..0x6FCA9350`)

1. **Melee (`0x6FCA90B3..0x6FCA917F`)**: When `bInMeleeRange != 0`, rolls `rand(100) < aip3` (`+0x62` = `100 / 90 / 80%`) for melee `A1`.
2. **Spatial Scan (`0x6FCA9182..0x6FCA91E4`, callback `0x6FC9BD50`)**: Scans `aip4` (`+0x68` = `24..30`) for the nearest unconsumed `fallen` corpse passing `DUNGEON_CheckLos(pCaster, pCorpse, 0xC)` (`0x6FC9BDE1`).
3. **Approach & Resurrect `#181 Resurrect` (`0x6FCA91E5..0x6FCA92A0`)**: Evaluates `0x6FCA91E5` approach roll and `0x6FCA9263` `rand(100) < aip1` (`+0x56` = `45..90%`) + `0x6FD13E30` before casting `#181 Resurrect`.

### 2.3 `AITHINK_Fn053_FetishShaman` (`0x6FCA7BB0..0x6FCA7DA5`)

1. **Close `#188 FetishInferno` (`0x6FCA7BC6..0x6FCA7C89`)**: Prioritizes `#188 FetishInferno` when a hostile is within close range (`<= 5` sub-tiles).
2. **Spatial Scan (`0x6FCA7C8A..0x6FCA7CE6`, callback `0x6FC9BB90`)**: Scans `aip5` (`+0x6E` = `50`) for the nearest `fetish` corpse. At `0x6FC9BC17..0x6FC9BC28`, calls `DUNGEON_CheckLos(pCaster, pCorpse, 0xC)` whenever `aip2 < 3` (only Hell tier 4–5 rows with `aip2 >= 3` bypass wall LOS).
3. **Probability & Walk-Closer Gate (`0x6FCA7CE7..0x6FCA7D98`)**:
   - Rolls `rand(100) < aip1` (`+0x56` = `40..45%`) at `0x6FCA7D0D` and checks `0x6FD13E30`.
   - Compares `corpseDist` against `aip3` (`+0x62` = `15..22` sub-tiles) at `0x6FCA7D5F..0x6FCA7D8C`: if `corpseDist > aip3`, walks toward the corpse instead of casting from 50 sub-tiles away; once `corpseDist <= aip3`, casts `#327 Resurrect2`.

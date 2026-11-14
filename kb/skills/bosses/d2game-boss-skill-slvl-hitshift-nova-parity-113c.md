# D2Game.dll 1.13c Monster Registered Skill Level, HitShift Scaling & SrvDo022 Radial Nova Semantics

## Binary Ground Truth (Diablo II: Lord of Destruction v1.13c)

### 1. `MONSTER_InitSkills` (`D2Game.dll` `0x6FCD019B..0x6FCD0215`, ImageBase `0x6FC20000`)

When a monster unit initializes its skill list from `MonStats.txt`:

- Iterates the 8 skill slots `nSkill[0..7]` (`+0x170`) and `nSkillLvl[0..7]` (`+0x198`).
- Only slots with `nSkill[i] >= 0` and `nSkillLvl[i] > 0` are registered via `SKILLS_AssignSkill`.
- Queries `D2Common#10237` (`DATATBLS_GetDifficultyLevelsTxtRecord`) and adds `pDifficultyLevelsTxt->dwMonsterSkillBonus` (`+0x10` = `[0, 3, 7]` for Normal / Nightmare / Hell in `Difficultylevels.txt`, helper `0x6FCBF9A0`):
  - `slvl = SkNlvl + [0, 3, 7][difficulty]`
- Mode-triggered non-skill missiles (`MONMODE_SpawnModeMissile`, `0x6FC95C60..0x6FC95CD7`, `nSkillId = 0`) use `slvl = dwMonsterSkillBonus + 1` (`1 / 4 / 8`).

Key Act Boss & Special Monster `MonStats.txt` `SkNlvl` values:

| Monster (`hcIdx`) | Skill (`Skills.txt` ID) | `SkNlvl` | Normal / NM / Hell `slvl` |
| --- | --- | --- | --- |
| `#242 mephisto` | `#185 PrimeLightning` | `6` | `6 / 9 / 13` |
| `#242 mephisto` | `#186 PrimeBolt` | `6` | `6 / 9 / 13` |
| `#704 ubermephisto` | `#186 PrimeBolt` | `20` | `20 / 23 / 27` |
| `#242` / `#704` | `#192 PrimePoisonNova` | `7` | `7 / 10 / 14` |
| `#242` / `#704` | `#334 MephistoMissile` | `5` | `5 / 8 / 12` |
| `#242` / `#704` | `#346 MephFrostNova` | `1` | `1 / 4 / 8` |
| `#242` / `#704` | `#59 Blizzard` | `5` | `5 / 8 / 12` |
| `#243 diablo` (`#333`/`#705`) | `#193 DiabLight` | `3` (`2`) | `3 / 6 / 10` (`2 / 5 / 9`) |
| `#243 diablo` (`#333`/`#705`) | `#194 DiabCold` | `4` (`2`) | `4 / 7 / 11` (`2 / 5 / 9`) |
| `#243 diablo` (`#333`/`#705`) | `#195 DiabFire` | `5` (`4`) | `5 / 8 / 12` (`4 / 7 / 11`) |
| `#243 diablo` (`#333`/`#705`) | `#197 DiabWall` | `3` (`2`) | `3 / 6 / 10` (`2 / 5 / 9`) |
| `#243` / `#333` / `#705` | `#198 DiabRun` | `5` | `5 / 8 / 12` |
| `#243` / `#333` / `#705` | `#188 PrimeFirewall` | `8` | `8 / 11 / 15` |
| `#333` / `#705` | `#349 Diablogeddon` | `5` | `5 / 8 / 12` |
| `#544 baalcrab` / `#570` / `#709` | `#316 Baal Nova` | `1` | `1 / 4 / 8` |
| `#544 baalcrab` / `#570` / `#709` | `#317 Baal Inferno` | `1` | `1 / 4 / 8` |
| `#544 baalcrab` / `#570` / `#709` | `#318 Baal Cold Missiles` | `1` | `1 / 4 / 8` |
| `#256 izual` / `#706 uberizual` | `#44 Frost Nova` | `8` | `8 / 11 / 15` |
| `#250 summoner` | `#44 Frost Nova` | `5` | `5 / 8 / 12` |

### 2. `D2Common#10413` (`0x6FDBBAA0`) `HitShift` Fixed-Point Damage Scaling

Monster skill and missile damage is accumulated in `1/256` HP fixed-point units (`raw << HitShift`) and converted to whole HP via `>> 8` (after fixed-point accumulation):

- `#44 Frost Nova` (`Skills.txt` `HitShift = 7` -> `1/2` raw table units): `slvl = 8` -> `(18..23 << 7) >> 8 = 9..11` base (`16..21` with synergy-free 5-band scaling: `EMin = 4 + 4 + 6*3 + 7.. = 33..43 << 7 >> 8 = 16..21` Cold HP).
- `#172 diablight` (`Missiles.txt` `HitShift = 6` -> `1/4` raw table units): Normal `slvl = 3` -> `phys = 6..8`, `ltng = 14..24` per stream pulse (`NextDelay = 3`).
- `#554 baal inferno` (`Skills.txt #317` `HitShift = 5` -> `1/8` raw table units): Normal `slvl = 1` -> `(64..96 << 5) >> 8 = 8..12` Magic HP per 4-frame tick (`NextDelay = 4`), plus `SrvHit55` (`0x6FC5FD60`) 50% current Mana drain.
- `#180 diabwall` (`Missiles.txt` `HitShift = 3` -> `1/32` raw table units): ground fire sub-tick scaling.

### 3. `SKILLS_SrvDo022_NovaAttack` (`0x6FC63AA0..0x6FC63B58`) & `SKILLS_SpawnNovaRing` (`0x6FCC2800..0x6FCC28E0`)

For all `SrvDo022` radial nova skills (`#44 Frost Nova`, `#48 Nova`, `#92 Poison Nova`, `#192 PrimePoisonNova`, `#195 DiabFire`, `#316 Baal Nova`, `#346 MephFrostNova`, `#353 Trap Nova`):

1. `SKILLS_SrvDo022_NovaAttack` validates `srvMissile` (`+0x28`), computes `nVelocity = pMissileTxt->dwVel + (slvl * nVelLev) / 8`, invokes `SKILLS_SpawnNovaRing(pGame, pUnit, nMissileId, nSkillId, slvl, nVelocity)` (`0x6FCC2800`), and returns `1`.
2. There is **no** synchronous direct-damage AoE loop in `SrvDo022`. Every nova hit comes exclusively from radial `srvMissile` collisions gated by `NextHit = 1, NextDelay = 4` (`STATE_JUSTHIT`, state `86`), ensuring a target hit by an expanding nova ring takes **one** bolt impact (plus chill/poison length from `ELen`) per cast rather than `2x` double damage.

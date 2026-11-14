# Diablo II v1.13c `AITHINK_Fn028_Vampire`, `MISSMODE_SrvHit31_Firehead`, `SKILLS_SrvDo028`, and `MISSMODE_SrvHit14_MeteorCenter`

## 1. `AITHINK_Fn028_Vampire` (`D2Game.dll` `0x6FCA6900..0x6FCA7000`)

All 9 `MonStats.txt` rows with `AI = Vampire` (`vampire1..5` `hcIdx 131..135`, `vampire6..8` `hcIdx 695..697`, `vampire9` `hcIdx 731`) register all four spell slots:
- `Skill1 = #169 VampireFireball` (`vampirefireball` `#129`, `pSrvHitFunc = 1`)
- `Skill2 = #170 VampireFirewall` (`srvDoFunc = 24`, `vampirefirewallmaker` `#130` -> `vampirefirewall` `#131`)
- `Skill3 = #171 VampireMeteor` (`srvDoFunc = 28`, `vampiremeteorcenter` `#133` -> `vampiremeteorfire` `#681`)
- `Skill4 = #333 VampireMissile` (`firehead` `#277`, `pSrvHitFunc = 31`, `ProgOverlay = vampiresteal`)

### `MonStats.txt` `aip1..aip5` Table (`Normal / Nightmare / Hell`)

| `hcIdx` | `Id` | `aip1` (melee fight %) | `aip2` (ranged cast %) | `aip3` (max cast dist) | `aip4` (upgrade %) | `aip5` (repertoire mask) | `Sk1..4lvl` |
|---:|---|---:|---|---:|---|---:|---|
| 131 | `vampire1` (`GhoulLord`) | 55 | `20 / 40 / 50` | `24 / 25 / 25` | `25 / 25 / 35` | `3` (`0b011`: Fireball/Missile + Fire Wall) | `2` |
| 132 | `vampire2` (`NightLord`) | 65 | `25 / 50 / 60` | `25 / 26 / 26` | `25 / 28 / 39` | `5` (`0b101`: Fireball/Missile + Meteor) | `3` |
| 133 | `vampire3` (`DarkLord`) | 76 | `30 / 60 / 70` | `26 / 27 / 27` | `25 / 31 / 43` | `7` (`0b111`: all) | `4` |
| 134 | `vampire4` (`BloodLord`) | 85 | `35 / 40 / 45` | `24 / 24 / 24` | `25 / 34 / 47` | `7` (`0b111`: all) | `5` |
| 135 | `vampire5` (`Banished`) | 85 | `40 / 70 / 80` | `28 / 28 / 28` | `25 / 37 / 51` | `1` (`0b001`: Fireball/Missile only) | `1` |
| 695..697, 731 | `vampire6..9` | 85 | `35 / 40 / 45` | `24 / 24 / 24` | `25 / 34 / 47` | `7` (`0b111`: all) | `5, 5, 5, 1` |

### Disassembly Flow (`0x6FCA6925..0x6FCA6F65`)
- **Upgrade Cooldown (`dwAiParam4`, `[edx+0x1c]`)**:
  - `0x6FCA6944..0x6FCA6957`: decrements `dwAiParam4` by `1` per AI think tick (`aidel = 15 / 14 / 13` frames) while `> 0`.
  - `0x6FCA6EC3`: sets `dwAiParam4 = 0xb` (`11` AI think ticks = `165 / 154 / 143` frames) immediately after casting `#170 VampireFirewall` or `#171 VampireMeteor`.
- **Melee Branch (`bInMeleeRange != 0`, `0x6FCA6CC5..0x6FCA6DEB`)**:
  - Rolls `rand(100) < aip1` (`0x6FCA6D13`):
    - If `< aip1`: when `(aip5 & 1) != 0 && lineDist <= 20 && hasClearMissileShot && rand(100) <= 30` (`0x6FCA6D37`), casts `#169 VampireFireball` (`rand(100) < 50`) or `#333 VampireMissile` (`>= 50`); otherwise swings melee `A1` (`0x6FCA6DA2` / `0x6FCA6AB7` with melee life leech).
    - If `>= aip1`: retreats `4` subtiles away from the target (`0x6FCA6DD7: push 4; call AITHINK_Retreat` `0x6FD126B0`).
- **Ranged Branch (`bInMeleeRange == 0`, `0x6FCA6DEE..0x6FCA6FA1`)**:
  - Requires `dist < aip3` (`0x6FCA6DF7`) and master cast gate `rand(100) < aip2` (`0x6FCA6E24`):
    1. **Fire Wall (`0x6FCA6E2C..0x6FCA6E6E`)**: if `(aip5 & 2) != 0 && dwAiParam4 <= 0 && rand(100) < aip4`, casts `Skill2` (`#170 VampireFirewall`) and sets `dwAiParam4 = 11`.
    2. **Meteor (`0x6FCA6E70..0x6FCA6ECE`)**: else if `(aip5 & 4) != 0 && dwAiParam4 <= 0 && rand(100) < aip4`, casts `Skill3` (`#171 VampireMeteor`) and sets `dwAiParam4 = 11`.
    3. **Base Projectile (`0x6FCA6ED1..0x6FCA6F65`)**: else if `(aip5 & 1) != 0 && lineDist <= 20 && hasClearMissileShot`:
       - If `rand(100) < 75` (`0x6FCA6F00`), casts `50/50` `Skill1` (`#169 VampireFireball`) or `Skill4` (`#333 VampireMissile`).
       - Else (`>= 75`), retreats `4` subtiles (`jge 0x6fca6dd3`).
  - When `dist >= aip3` or the spell roll declines, approaches the target (`0x6FCA6F95` / `0x6FCA6FCC`).

## 2. `MISSMODE_SrvHit31_Firehead` (`D2Game.dll` `0x6FC5A920..0x6FC5AA0E`)
- `gpMissileSrvHitFnTable[31] = 0x6FC5A920` is used exclusively by `Missiles.txt #277 firehead` (`#333 VampireMissile`, `ProgOverlay = vampiresteal`).
- Calls `MISSMODE_DmgTarget` (`0x6FC5A280`) to obtain actual damage dealt `esi` (in `1/256` fixed-point), reads `pOwner` `STAT_HITPOINTS` (`6`) and `D2Common_GetUnitMaxLife` (`0x6FC2A3A0`), and writes `min(maxLife, curLife + esi)` (`100%` life steal).
- `#169 VampireFireball` (`pSrvHitFunc = 1`), `#170 VampireFirewall` (`pSrvHitFunc = 0`), and `#171 VampireMeteor` (`pSrvHitFunc = 14`) do **not** steal life; Vampire innate `drain = life` applies strictly to melee attacks.

## 3. `SKILLS_SrvDo028` (`D2Game.dll` `0x6FC62D90..0x6FC62EA8`) & `MISSMODE_SrvHit14_MeteorCenter` (`0x6FC5DEF0..0x6FC5E09D`)
- `SKILLS_SrvDo028` spawns `wSrvMissileA` directly at `(targetX, targetY)` (`Vel = 0`), where `Missiles.txt Range` encodes the sky-fall / controller countdown duration in frames (`25..225`), not caster-to-target projectile reach (`<= 100` at `0x6FC62E47`). Monster `srvDoFunc = 28` skills (`#171`, `#205`, `#213`, `#234`, `#284`, `#287`, `#288`, `#303`, `#304`, `#305`) must evaluate target-placed reach and never duplicate stationary controllers via `MonUMod #29` (`Multishot`).
- `MISSMODE_SrvHit14_MeteorCenter` checks `(pMissile->dwFlags >> 10) & 1` (`0x6FC5DF84..0x6FC5DF94`, range expiration) before detonating its radial impact blast and 18-offset ground-fire circle, preventing `CollideType > 0` controllers such as `#422 catapult meteor ball` (`CollideType = 6`, `Range = 25`) from detonating on Frame 1 unit overlap.

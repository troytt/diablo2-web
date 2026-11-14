# D2Game.dll 1.13c Spirit, TrappedSoul, Idle/Non-Melee Stationary AIs, and MonStats Align Faction Rules

> Reverse-engineered from `D2Game.dll` v1.13c (`2010-03-09`, image base `0x6FC20000`)
> via `gpMonsterAiFunctionTable` (`0x6FD2E788`, 16-byte stride `{ dwAiFlag, pfnAiInit, pfnAiThink, pfnAiExtra }`)
> and `MonStats.txt` (`734` rows) + `MonAI.txt` (`148` rows).

## 1. `#97 Spirit` (`AITHINK_Fn097_Spirit` @ `0x6FC360B0`, `hcIdx 401 mephistospirit`)

- **Table Entry**: `gpMonsterAiFunctionTable[97]` (`0x6FD2E788 + 97 * 16 = 0x6FD2ED98`):
  - `pfnAiThink = 0x6FC360B0`
- **Monster Row**: `MonStats.txt` `#401 mephistospirit` (`npc = 0`, `killable = 0`, `align = 0`, Durance of Hate Level 3).
- **Binary Behavior (`0x6FC360B0`)**:
  - Reads `pAiControl->dwAiFlags3` (`[eax + 0x14]`).
  - If `dwAiFlags3 != 0`: calls `AI_SetIdle(pGame, pMonster, 50)` and returns immediately.
  - Otherwise checks `pAiTickParam->bInMeleeRange` (`[edi + 0x10]`).
  - When a hostile enters melee range (`bInMeleeRange != 0`), sets `pAiControl->dwAiFlags3 = 1` and initiates a single `MONMODE_ATTACK1` (`mode = 4`) melee swing; otherwise calls `AI_SetIdle(pGame, pMonster, 15)`.
  - Invariant: `mephistospirit` swings in melee **at most once per spawn**, then idles forever (`50`-frame think cadence).

## 2. `#99 TrappedSoul` (`AITHINK_Fn099_TrappedSoul` @ `0x6FCC5580`, `hcIdx 403..404 trappedsoul1..2`)

- **Table Entry**: `gpMonsterAiFunctionTable[99]` (`pfnAiThink = 0x6FCC5580`).
- **Monster Rows**: `MonStats.txt` `#403 trappedsoul1` and `#404 trappedsoul2` (`npc = 0`, `killable = 1`, `align = 0`, Act 4 Plains of Despair / City of the Damned; template `A1MinD/A1MaxD = 26..37` in Normal).
- **Binary Behavior (`0x6FCC5580`)**:
  - Uses `pAiControl->dwAiState` (`0` = resting, `1` = awake/fidgeting) and checks whether any living player is within `< 5` subtiles.
  - State `0`: if a player is within `< 5` subtiles, transitions to state `1`, plays `MONMODE_SKILL2` (`mode = 9` wake animation) via `AI_PlayAnimation`, and sleeps `35` frames; otherwise sleeps `15` frames.
  - State `1`: if no player is within `< 5` subtiles, transitions back to state `0`, plays `MONMODE_SKILL1` (`mode = 8` return-to-rest animation), and sleeps `15` frames; while a player stays within `< 5` subtiles, plays harmless visual fidget animations (`mode = 4` / `5` via `AI_PlayAnimation` without `SUnitDmg`) every `35` frames.
  - Invariant: `trappedsoul1..2` are killable props by players (`killable = 1`, `align = 0`) and **never** deal melee damage.

## 3. `#0 None`, `#1 Idle`, and Non-Melee Stationary Traps / Turrets / Spawners / Controllers

- **Passive / Controller AIs (never chase, never cast hostile combat skills, never melee-attack)**:
  | `MonAI` Index | Name | `pfnAiThink` VA | Representative `MonStats.txt` Rows |
  |---:|---|---|---|
  | `0` | `None` | `0x6FCBC990` | No-op think stub |
  | `1` | `Idle` | `0x6FCBCB00` | `#340..343 boneprison1..4`, `#366 compellingorb`, `#392..393 window1..2`, `#432..433 barricadedoor1..2`, `#434 prisondoor`, `#524..525 barricadewall1..2`, `#574 worldstoneeffect`, ambient critters (`rat`, `bird1..2`, `cow`, `larva`, `minispider`, `bunny`, `injuredbarb1..3`), calls `AI_SetIdle(pGame, pMonster, 200)` |
  | `31`, `32`, `54` | `NpcOutOfTown`, `Npc`, `NpcStationary` | `0x6FC3BF60`, `0x6FC3DB40` | Out-of-town / quest / `#535..536 act5barb3..4` |
  | `82` | `InvisoSpawner` | `0x6FC3BCA0` | `#332 invisospawner` |
  | `84` | `BoneWall` | `0x6FC36410` | `#344 bonewall` |
  | `88` | `7TIllusion` | `0x6FCC4B90` | `#355 seventombs` |
  | `91` | `DarkWanderer` | `0x6FCC6E60` | `#368 darkwanderer` |
  | `103` | `InvisoPet` | `0x6FCC5350` | `#414 invisopet` |
  | `132` | `AncientStatue` | `0x6FCC4F40` | `#537..539 ancientstatue1..3` |

- **Stationary Ranged / Skill / Spawner AIs (never chase, never fall through to melee attack)**:
  - `#33 HellMeteor` (`0x6FC9D400`, `#153 hellmeteor`), `#43 FoulCrowNest` (`0x6FC9D170`), `#45 Sarcophagus` (`0x6FC9CFD0`), `#63 GargoyleTrap` (`0x6FC9C910`), `#76 EvilHole` (`0x6FCA77B0`), `#77..80 Trap-Missile / Trap-RightArrow / Trap-LeftArrow / Trap-Poison` (`0x6FC9C580..0x6FC9C1D0`), `#83 MosquitoNest` (`0x6FC364A0`), `#86 Hydra` (`0x6FC36300`), `#92 Trap-Nova` (`0x6FC9C060`), `#93 ArcaneTower` (`0x6FC36270`), `#94 DesertTurret` (`0x6FC3C1E0`), `#121 MinionSpawner` (`0x6FC37BC0`), `#123 Catapult` (`0x6FC36190`), `#126 CatapultSpotter` (`0x6FCC4FD0`, `#516..519 catapultspotter1..4`), `#129 GenericSpawner` (`0x6FC35E00`), `#136 BaalTaunt` (`0x6FCC9D40`, `#545 baaltaunt`).
  - **Sole Stationary Melee Trap Exception**: `#87 Trap-Melee` (`0x6FC9BF50`, `#354 trap-melee`) explicitly executes a stationary melee strike when a target enters melee range.

## 4. `MonStats.txt` `Align` (`0` = Evil, `1` = Good/Friendly, `2` = Neutral) & Act 5 `NpcBarb` / `Wussie`

- **`MonStats.txt` `Align` Column (`56` non-NPC rows with `Align != 0`)**:
  - `Align = 0` (`Evil`): standard hostile monsters (plus destructible hostile constructs such as Diablo's `#340..343 boneprison1..4`).
  - `Align = 1` (`Good` / Player-Friendly): Act 5 Barbarian soldiers `#522..523 act5barb1..2` (`NpcBarb`), `#535..536 act5barb3..4` (`Npc`), `#534 act5pow` (`Wussie`), `#344 bonewall` (`BoneWall`), hireling/pet rows, and ambient critters (`rat`, `bird1..2`, `bug`, `scorpion`, `snake`, `parrot`, `fish`, `eagle`).
  - `Align = 2` (`Neutral`): `#179 cow` (`Idle`).
  - **Summoner Alignment Override (`#62 Hydra`)**: `#351..353 hydra1..3` carry `Align = 1` in `MonStats.txt` because the row is shared with Sorceress Hydra, but when an evil caster (`HighPriest` Council `#345..347`, Bartuc `#557`) casts `#62 Hydra`, `SKILLS_SummonPet` overrides the spawned Hydra turret's alignment to the caster's alignment (`Align = 0`), so players/mercs/pets can target it and its firebolts hit players/mercs/pets.
- **`#127 NpcBarb` (`AITHINK_Fn127_NpcBarb` @ `0x6FCC66E0`, `hcIdx 522..523 act5barb1..2`)**:
  - Scans nearby evil (`Align = 0`) monsters within `aidist`, approaches and attacks them in melee (`0x6FCC67FE`), and wanders near its home coordinates (`0x6FCC6820`) when no evil monster is nearby; never targets players, mercenaries, or player pets.
- **`#131 Wussie` (`AITHINK_Fn131_Wussie` @ `0x6FCC7A10`, `hcIdx 534 act5pow`)**:
  - Captured Barbarian POW (`Align = 1`); never attacks any unit and cannot be targeted or damaged by friendly players, mercenaries, or pets.

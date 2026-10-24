# Diablo II v1.13c Act 1, Act 2 & Act 3 Boss & SuperUnique Skills (`D2Game.dll` & `D2Client.dll`)

Exhaustive reverse-engineering reference for all Act 1, Act 2, and Act 3 Act Bosses, Quest Mini-Bosses, and SuperUniques in Diablo II: Lord of Destruction v1.13c (`D2Game.dll` ImageBase `0x6FC20000`, `D2Client.dll` ImageBase `0x6FAB0000`), verified directly against decompiled 1.13c binary assembly and official 1.13c MPQ data tables (`MonStats.txt`, `SuperUniques.txt`, `MonProp.txt`, `MonSeq.txt`, `Skills.txt`, `Missiles.txt`).

---

## 1. Engine Dispatch Tables (v1.13c)

### 1.1 `D2Game.dll` (`ImageBase = 0x6FC20000`)

| Dispatch Table | Base VA | Count | Key Entries Used by Act 1–3 Bosses |
|---|---|---:|---|
| `gpAiTable` (`D2AiTableStrc`) | `0x6FD2E788` | 148 | `[2]` `Skeleton` (`0x6FCA3AC0`), `[10]` `CorruptRogue` (`0x6FCA2EC0`), `[15]` `SandMaggot` (`0x6FCA7010`), `[22]` `GreaterMummy` (`0x6FCA8380`), `[34]` `Andariel` (`0x6FC9FE60`), `[40]` `MaggotEgg` (`0x6FC9D310`), `[44]` `Duriel` (`0x6FCA9430`), `[50]` `Mephisto` (`0x6FCA5B60`), `[53]` `Summoner` (`0x6FCA5780`), `[59]` `BloodRaven` (`0x6FC39E70`, init `0x6FC35520`), `[66]` `SandMaggotQueen` (`0x6FCA7A60`), `[85]` `HighPriest` (`0x6FC39080`), `[86]` `Hydra` (`0x6FCC57E0`), `[90]` `Griswold` (`0x6FC372B0`), `[98]` `Smith` (`0x6FC376B0`) |
| `SkillSrvStFunc` | `0x6FD27338` | 64 | `[5]` `Jab` (`0x6FC6C1C0`), `[14]` `Hydra` (`0x6FC62AD0`), `[31]` `Charge` (`0x6FCB9620`), `[43]` `MaggotEgg` (`0x6FCD31B0`), `[44]` `MaggotUp` (`0x6FCD4760`), `[45]` `MaggotDown` (`0x6FCD3120`), `[46]` `AndrialSpray` (`0x6FCD3930`), `[49]` `Nest` (`0x6FCD5FB0`), `[50]` `QuickStrike` (`0x6FCD3EB0`) |
| `SkillSrvDoFunc` | `0x6FD274A8` | 152 | `[7]` `Jab` (`0x6FC6CB00`), `[17]` `ChargedBolt` (`0x6FC63B60`), `[22]` `NovaAttack` (`0x6FC63AA0`), `[24]` `FireWall` (`0x6FC637D0`), `[28]` `Blizzard` (`0x6FC62D90`), `[30]` `Curse` (`0x6FC705D0`), `[65]` `BasicAura` (`0x6FCBA8D0`), `[67]` `Charge` (`0x6FCB9D20`), `[81]` `HolyFreeze` (`0x6FCBABC0`), `[84]` `MaggotEgg` (`0x6FCD65E0`), `[85]` `UnholyBolt` (`0x6FCD58A0`), `[86]` `MaggotDown` (`0x6FCD3060`), `[87]` `MaggotLay` (`0x6FCD42D0`), `[88]` `AndrialSpray` (`0x6FCD56C0`), `[91]` `Nest` (`0x6FCD5E50`), `[92]` `QuickStrike` (`0x6FCD5600`), `[96]` `ZakarumHeal_Bestow` (`0x6FCD3770`), `[97]` `Resurrect` (`0x6FCD5BD0`), `[99]` `PrimePoisonNova` (`0x6FCD52A0`), `[144]` `Hydra` (`0x6FC63D40`), `[150]` `Smite` (`0x6FCB9000`) |
| `MissileSrvDoFunc` | `0x6FD2D970` | 36 | `[1]` `BasicMissile` (`0x6FC5F540`), `[3]` `PoisonCloud_Blizzard` (`0x6FC61AE0`), `[5]` `GroundFire` (`0x6FC61980`), `[6]` `FireWallMaker` (`0x6FC61850`), `[10]` `BlizzardCenter` (`0x6FC613D0`), `[19]` `RadamentDeath` (`0x6FC8A1A0`) |
| `MissileSrvHitFunc` | `0x6FD2DA48` | 53 | `[1]` `RadialFireDamage` (`0x6FC5EAE0`), `[13]` `GlacialSpike` (`0x6FC5FF10`) |
| `MissileSrvDmgFunc` | `0x6FD2DB68` | 14 | `[1]` `PhysicalArrow` (`0x6FC595A0`), `[3]` `FireWall` (`0x6FC59670`) |

### 1.2 `D2Client.dll` (`ImageBase = 0x6FAB0000`)

| Dispatch Table | Base VA | Count | Key Entries Used by Act 1–3 Bosses |
|---|---|---:|---|
| `SkillCltStFunc` | `0x6FB8E928` | 53 | `[12]` `Jab` (`0x6FAC4F10`), `[17]` `Hydra` (`0x6FB23C10`), `[18]` `Curse` (`0x6FB785C0`), `[25]` `Charge` (`0x6FADBF40`), `[32]` `MaggotUp` (`0x6FB07200`), `[33]` `MaggotDown` (`0x6FB06BB0`), `[34]` `AndrialSpray` (`0x6FB07120`), `[36]` `Nest` (`0x6FB06A60`), `[39]` `Resurrect` (`0x6FB07000`) |
| `SkillCltDoFunc` | `0x6FB8EA48` | 96 | `[16]` `Jab` (`0x6FAC4F40`), `[23]` `ChargedBolt` (`0x6FB24AC0`), `[25]` `NovaAttack` (`0x6FB23CB0`), `[26]` `FireWall` (`0x6FB24770`), `[28]` `Blizzard` (`0x6FB23DF0`), `[30]` `Curse` (`0x6FB78B40`), `[37]` `Charge` (`0x6FADB6E0`), `[46]` `MaggotEgg` (`0x6FB06780`), `[47]` `MaggotDown` (`0x6FB06740`), `[48]` `AndrialSpray` (`0x6FB073A0`), `[50]` `Nest` (`0x6FB069E0`), `[55]` `PrimePoisonNova` (`0x6FB081F0`), `[64]` `QueenDeath` (`0x6FB07860`) |
| `MissileCltDoFunc` | `0x6FB8D8A0` | 68 | `[1]` `Standard` (`0x6FB617C0`), `[4]` `PoisonCloud` (`0x6FB6BE00`), `[5]` `GroundFire` (`0x6FB62F90`), `[6]` `FireWallMaker` (`0x6FB692B0`), `[8]` `MonsterLightning` (`0x6FB633F0`), `[11]` `GroundRemain` (`0x6FB616E0`), `[13]` `BlizzardCenter` (`0x6FB6BC10`), `[26]` `MephistoDeathControl` (`0x6FB62490`), `[27]` `BossFireWallMaker` (`0x6FB62280`), `[29]` `AndyControl0` (`0x6FB63690`), `[32]` `RadamentDeath` (`0x6FB62340`), `[35]` `QueenDeathCenter` (`0x6FB62F10`) |
| `MissileCltHitFunc` | `0x6FB8DA10` | 47 | `[1]` `FireBall` (`0x6FB63CB0`), `[10]` `LightningHit` (`0x6FB62570`), `[14]` `GlacialSpike` (`0x6FB647D0`), `[19]` `VerticalDebris` (`0x6FB61080`), `[33]` `MephistoRockSplit` (`0x6FB61610`), `[37]` `RadamentHandOfGod` (`0x6FB61390`), `[39]` `QueenDeathGlob` (`0x6FB61240`) |

---

## 2. Master Summary Tables

### 2.1 Act 1–3 Boss & SuperUnique Roster (`MonStats.txt` & `SuperUniques.txt`)

| Act | Boss / SuperUnique | `MonStats` ID (`hcIdx`) | `Code` | `SuperUniques` `hcIdx` | `AI` (`gpAiTable` VA) | Level (N/NM/H) | Fixed UMods (`Mod1` / `Mod2`) & Hidden UMods | Assigned Skills (`Skill1`..`Skill6`) |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | **Andariel** | `andariel` (`156`) | `AN` | — (`boss=1`, `primeevil=1`) | `Andariel` (`0x6FC9FE60`) | `12 / 49 / 75` | `MONUMOD_QUESTMOD` (`#24`) | `AndrialSpray` (#164), `AndyPoisonBolt` (#201) |
| 1 | **Blood Raven** | `bloodraven` (`267`) | `CR` | — (`boss=1`) | `BloodRaven` (`0x6FC39E70`) | `10 / 43 / 88` | `MONUMOD_BRAVENDEATH` + `MONUMOD_QUESTMOD`; `MonProp=bloodraven` (`knock=1` in H) | `Nest` (#167), `Quick Strike` (#168) + `MissA1=raven1`, `MissSQ=raven2` |
| 1 | **The Countess** | `corruptrogue3` (`45`) | `CR` | `6` | `CorruptRogue` (`0x6FCA2EC0`) + `AISPECIALSTATE_COUNTESS` (`sub_6FCE5520`) | `8 / 39 / 69` | `Mod1=9` (Fire Enchanted) + `MONUMOD_QUESTMOD` | `CountessFirewall` (#321, `Sk1lvl=10`, `Sk1mode=A1`) |
| 1 | **Griswold** | `griswold` (`365`) | `GZ` | `5` | `Griswold` (`0x6FC372B0`) | `5 / 39 / 84` | `Mod1=7` (Cursed: `Amplify Damage` #66 on hit) | Pure Melee (`A1`) |
| 1 | **The Smith** | `smith` (`402`) | `5P` | `20` | `Smith` (`0x6FC376B0`) | `10 / 42 / 79` | `Mod1=5` (Extra Strong) | Pure Melee (`A1` with `El1Type=fire` `15%/30%` in NM/H) |
| 1 | **The Cow King** | `hellbovine` (`391`) | `EC` | `39` | `Skeleton` (`0x6FCA3AC0`) | `28 / 61 / 81` | `Mod1=8` (Magic Resistant), `Mod2=17` (Lightning Enchanted) | Melee (`A1`/`A2`) + LE Charged Bolt proc on `GH` |
| 2 | **Duriel** | `duriel` (`211`) | `DU` | — (`boss=1`, `primeevil=1`) | `Duriel` (`0x6FCA9430`) | `22 / 55 / 88` | `MONUMOD_QUESTMOD` (`#24`) | `Charge` (#107, unused: `aip5=0`), `Jab` (#10), `Smite` (#97), `Holy Freeze` (#114) |
| 2 | **Radament** | `radament` (`229`) | `RD` | `10` | `GreaterMummy` (`0x6FCA8380`) | `16 / 49 / 83` | `Mod1=6` (Extra Fast) + `MONUMOD_QUESTMOD` | `Resurrect2` (#327), `Bestow` (#182), `UnHolyBolt` (#157) + `MissA2=mummy4` |
| 2 | **The Summoner** | `summoner` (`250`) | `SU` | `18` | `Summoner` (`0x6FCA5780`) | `18 / 55 / 80` | `Mod1=5` (Extra Strong), `Mod2=6` (Extra Fast) | `Glacial Spike` (#55), `Frost Nova` (#44), `Fire Ball` (#47), `VampireFirewall` (#170), `Weaken` (#72) |
| 2 | **Coldworm the Burrower** | `maggotqueen1` (`284`) | `MQ` | `15` | `SandMaggotQueen` (`0x6FCA7A60`) | `11 / 46 / 81` | `Mod1=18` (Cold Enchanted), `Mod2=8` (Magic Resistant) + hidden `MONUMOD_POISONFIELD` (`#23`) | `MagottUp` (#161), `MagottDown` (#162), `MagottLay` (#163), `QueenDeath` (#216) + `spawn=sandmaggot1` |
| 3 | **Mephisto** | `mephisto` (`242`) | `MP` | — (`boss=1`, `primeevil=1`) | `Mephisto` (`0x6FCA5B60`) | `26 / 59 / 87` | `MONUMOD_QUESTMOD` + `MonProp=mephisto` (`+15%/+30%` FCR/IAS in NM/H) | `PrimeLightning` (#185), `PrimeBolt` (#186), `PrimePoisonNova` (#192), `MephistoMissile` (#334), `MephFrostNova` (#346), `Blizzard` (#59) |
| 3 | **Ismail Vilehand** | `councilmember1` (`345`) | `HP` | `26` | `HighPriest` (`0x6FC39080`) | `25 / 56 / 88` | `Mod1=6` (Extra Fast), `Mod2=7` (Cursed) + `MonProp` `extra-fire` `40/100%` | `Hydra` (#62, `Sk1lvl=2`), `ZakarumHeal` (#179, `Sk2lvl=2`), `MissS1=highpriestlightning` (#343) |
| 3 | **Geleb Flamefinger** | `councilmember2` (`346`) | `HP` | `27` | `HighPriest` (`0x6FC39080`) | `25 / 56 / 88` | `Mod1=5` (Extra Strong), `Mod2=9` (Fire Enchanted) + `MonProp` `extra-fire` `40/100%` | `Hydra` (#62, `Sk1lvl=3`), `ZakarumHeal` (#179, `Sk2lvl=3`), `MissS1=highpriestlightning` (#343) |
| 3 | **Toorc Icefist** | `councilmember1` (`345`) | `HP` | `29` | `HighPriest` (`0x6FC39080`) | `25 / 56 / 88` | `Mod1=18` (Cold Enchanted), `Mod2=28` (Stone Skin) + `MonProp` `extra-fire` `40/100%` | `Hydra` (#62, `Sk1lvl=2`), `ZakarumHeal` (#179, `Sk2lvl=2`), `MissS1=highpriestlightning` (#343) |
| 3 | **Bremm Sparkfist** | `councilmember3` (`347`) | `HP` | `28` | `HighPriest` (`0x6FC39080`) | `25 / 56 / 88` | `Mod1=30` (**Aura Enchanted**), `Mod2=17` (Lightning Enchanted) + `MonProp` `extra-fire` `40/100%` | `Hydra` (#62, `Sk1lvl=4`), `ZakarumHeal` (#179, `Sk2lvl=4`), `MissS1=highpriestlightning` (#343) |
| 3 | **Wyand Voidfinger** | `councilmember2` (`346`) | `HP` | `30` | `HighPriest` (`0x6FC39080`) | `25 / 56 / 88` | `Mod1=25` (Mana Burn), `Mod2=26` (Teleport) + `MonProp` `extra-fire` `40/100%` | `Hydra` (#62, `Sk1lvl=3`), `ZakarumHeal` (#179, `Sk2lvl=3`), `MissS1=highpriestlightning` (#343) |
| 3 | **Maffer Dragonhand** | `councilmember3` (`347`) | `HP` | `31` | `HighPriest` (`0x6FC39080`) | `25 / 56 / 88` | `Mod1=5` (Extra Strong), `Mod2=6` (Extra Fast) + `MonProp` `extra-fire` `40/100%` | `Hydra` (#62, `Sk1lvl=4`), `ZakarumHeal` (#179, `Sk2lvl=4`), `MissS1=highpriestlightning` (#343) |

### 2.2 Master `Skills.txt` Table for Act 1–3 Bosses

| ID | Skill Name | `srvstfunc` (VA) | `srvdofunc` (VA) | `cltstfunc` (VA) | `cltdofunc` (VA) | `anim` / `monanim` | `srvmissile` / `srvmissilea` | `cltmissile` / `cltmissilea` |
|---:|---|---|---|---|---|---|---|---|
| 10 | `Jab` | `5` (`0x6FC6C1C0`) | `7` (`0x6FC6CB00`) | `12` (`0x6FAC4F10`) | `16` (`0x6FAC4F40`) | `SQ` / `xx` (`seq_durieljab`) | — | — |
| 44 | `Frost Nova` | — | `22` (`0x6FC63AA0`) | — | `25` (`0x6FB23CB0`) | `SC` / `SC` | `frostnova` (#119) | `frostnova` (#119) |
| 47 | `Fire Ball` | — | — | — | — | `SC` / `xx` | `fireball` (#62) | `fireball` (#62) |
| 55 | `Glacial Spike` | — | — | — | — | `SC` / `SC` | `glacialspike` (#96) | `glacialspike` (#96) |
| 59 | `Blizzard` | — | `28` (`0x6FC62D90`) | — | `28` (`0x6FB23DF0`) | `SC` / `xx` | `blizzardcenter` (#158) | `blizzardcenter` (#158) |
| 62 | `Hydra` | `14` (`0x6FC62AD0`) | `144` (`0x6FC63D40`) | `17` (`0x6FB23C10`) | — | `SC` / `S1` | Summon `hydra1..3` (#351..353) | — |
| 72 | `Weaken` | — | `30` (`0x6FC705D0`) | `18` (`0x6FB785C0`) | `30` (`0x6FB78B40`) | `SC` / `SC` | — | `curseweaken` (#183) / `cursecast` (#147) |
| 97 | `Smite` | — | `150` (`0x6FCB9000`) | — | — | `S1` / `xx` (`seq_durielsmite`) | — | — |
| 107 | `Charge` | `31` (`0x6FCB9620`) | `67` (`0x6FCB9D20`) | `25` (`0x6FADBF40`) | `37` (`0x6FADB6E0`) | `SQ` / `xx` (`seq_durielcharge`) | — | — |
| 114 | `Holy Freeze` | — | `81` (`0x6FCBABC0`) | — | — | Aura (`perdelay=50`) | — | — |
| 157 | `UnHolyBolt` | — | `85` (`0x6FCD58A0`) | — | — | `SQ` / `xx` (`seq_mummyres`) | `unholybolt1` (#77) | `unholybolt1` (#77) |
| 159 | `MaggotEgg` | `43` (`0x6FCD31B0`) | `84` (`0x6FCD65E0`) | — | `46` (`0x6FB06780`) | `SQ` / `xx` (`seq_maggotegg`) | — | — |
| 161 | `MagottUp` | `44` (`0x6FCD4760`) | — | `32` (`0x6FB07200`) | — | `SQ` / `xx` (`seq_maggotup`) | — | — |
| 162 | `MagottDown` | `45` (`0x6FCD3120`) | `86` (`0x6FCD3060`) | `33` (`0x6FB06BB0`) | `47` (`0x6FB06740`) | `SQ` / `xx` (`seq_maggotdown`) | — | — |
| 163 | `MagottLay` | — | `87` (`0x6FCD42D0`) | — | — | `SQ` / `xx` (`seq_maggotlay`) | — | — |
| 164 | `AndrialSpray` | `46` (`0x6FCD3930`) | `88` (`0x6FCD56C0`) | `34` (`0x6FB07120`) | `48` (`0x6FB073A0`) | `SQ` / `xx` (`seq_andarielspray`) | `andarielspray` (#32) | `andarielspray` (#32) |
| 167 | `Nest` | `49` (`0x6FCD5FB0`) | `91` (`0x6FCD5E50`) | `36` (`0x6FB06A60`) | `50` (`0x6FB069E0`) | `SQ` / `xx` (`seq_bloodravencast`) | — (spawns `zombie2`) | — |
| 168 | `Quick Strike` | `50` (`0x6FCD3EB0`) | `92` (`0x6FCD5600`) | — | — | `SQ` / `xx` (`seq_brquickstrike`) | `raven1` (#135) | — |
| 170 | `VampireFirewall` | — | `24` (`0x6FC637D0`) | — | `26` (`0x6FB24770`) | `SQ` / `SC` | `vampirefirewallmaker` (#130) / `vampirefirewall` (#131) | `vampirefirewallmaker` (#130) |
| 179 | `ZakarumHeal` | — | `96` (`0x6FCD3770`) | — | — | `SQ` / `S1` | — (`srvoverlay=receiving`) | — (`castoverlay=healing`) |
| 182 | `Bestow` | — | `96` (`0x6FCD3770`) | — | — | `SQ` / `xx` (`seq_mummyres`) | — (`srvoverlay=receiving`) | — |
| 185 | `PrimeLightning` | — | — | — | — | `SQ` / `A2` | `monsterlight` (#170) | `monsterlight` (#170) |
| 186 | `PrimeBolt` | — | `17` (`0x6FC63B60`) | — | `23` (`0x6FB24AC0`) | `SQ` / `A1` | `chargedstrikebolt` (#215) | `chargedbolt` (#56) |
| 192 | `PrimePoisonNova` | — | `99` (`0x6FCD52A0`) | — | `55` (`0x6FB081F0`) | `SQ` / `A1` | `primepoisoncloud` (#220) | `primepoisoncloud` (#220) |
| 201 | `AndyPoisonBolt` | — | — | — | — | `SQ` / `A1` | `andypoisonbolt` (#203) | `andypoisonbolt` (#203) |
| 216 | `QueenDeath` | — | — | — | `64` (`0x6FB07860`) | `SQ` / `xx` (`seq_queendeath`) | — | `queendeathcenter` (#353) |
| 321 | `CountessFirewall` | — | `24` (`0x6FC637D0`) | — | `26` (`0x6FB24770`) | `SQ` / `A1` | `countessfirewallmaker` (#653) / `countessfirewall` (#331) | `countessfirewallmaker` (#653) |
| 327 | `Resurrect2` | — | `97` (`0x6FCD5BD0`) | `39` (`0x6FB07000`) | — | `SQ` / `xx` (`seq_mummyres`) | — | — (`castoverlay=healing`) |
| 334 | `MephistoMissile` | — | — | — | — | `SC` / `A2` | `mephisto` (#276) | `mephisto` (#276) |
| 337 | `HydraMissile` | — | — | — | — | `SC` / `SC` | `hydra` (#247) | `hydra` (#247) |
| 346 | `MephFrostNova` | — | `22` (`0x6FC63AA0`) | — | `25` (`0x6FB23CB0`) | `SC` / `A2` | `mephfrostnova` (#679) | `frostnova` (#119) |

### 2.3 Master `Missiles.txt` Table for Act 1–3 Bosses

| ID | Missile | `pSrvDoFunc` | `pSrvHitFunc` | `pCltDoFunc` | `pCltHitFunc` | `Vel` | `Range` | `CelFile` | Damage / Element (`HitShift`, `ELen`) |
|---:|---|---:|---:|---:|---:|---:|---:|---|---|
| 32 | `andarielspray` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `0` | `15` | `40` | `AndarielSpell` | Phys `1792–2560` (`+1280/lvl`) + `pois` `32–64` (`+32/lvl`), `ELen=400`, `Pierce=1` |
| 56 | `chargedbolt` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `10` (`0x6FB62570`) | `12` | `98` | `ChargedBolt` | Linked to `Skill=Charged Bolt` (client visual for `PrimeBolt`) |
| 62 | `fireball` | `1` (`0x6FC5F540`) | `1` (`0x6FC5EAE0`) | `1` (`0x6FB617C0`) | `1` (`0x6FB63CB0`) | `20` | `50` | `Fireball` | Linked to `Skill=Fire Ball` (#47), `sHitPar1=4` radial AoE |
| 77 | `unholybolt1` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `0` | `12` | `40` | `UnholyBolt` | `mag` `3–6` (`+9/lvl`), `HitShift=8` |
| 96 | `glacialspike` | `1` (`0x6FC5F540`) | `13` (`0x6FC5FF10`) | `1` (`0x6FB617C0`) | `14` (`0x6FB647D0`) | `16` | `40` | `GlacialSpike` | Linked to `Skill=Glacial Spike` (#55), `EType=frze` |
| 119 | `frostnova` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `10` (`0x6FB62570`) | `24` (`Accel=-1000`) | `14` | `FrostNova` | Linked to `Skill=Frost Nova` (#44), `NextHit=1`, `NextDelay=4` |
| 130 | `vampirefirewallmaker` | `6` (`0x6FC61850`) | `0` | `6` (`0x6FB692B0`) | `0` | `12` | `10` | `groundFireBig` | Spawns `SubMissile1=vampirefirewall` (#131) |
| 131 | `vampirefirewall` | `5` (`0x6FC61980`) | `0` (`SrvDmg=3`) | `5` (`0x6FB62F90`) | `0` | `0` | `90` | `groundFireSmall` | `fire` `2–3` (`+2..3/lvl`), `HitShift=2`, `DamageRate=41` |
| 135 | `raven1` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `0` | `16` | `50` | `Arrow` | `SrcDamage=128` (100% monster `A1` damage), `ToHit=1` |
| 158 | `blizzardcenter` | `10` (`0x6FC613D0`) | `0` | `13` (`0x6FB6BC10`) | `0` | `0` | `100` | `null` | Spawns `blizzard1..4` (#159..162) |
| 159 | `blizzard1` | `3` (`0x6FC61AE0`) | `0` | `1` (`0x6FB617C0`) | `19` (`0x6FB61080`) | `0` | `9` | `icestormfallvar01` | Linked to `Skill=Blizzard` (#59), `Size=2` |
| 170 | `monsterlight` | `1` (`0x6FC5F540`) | `0` | `8` (`0x6FB633F0`) | `10` (`0x6FB62570`) | `30` | `25` | `null` | `ltng` `15–30` (`MinELev=0`, `MaxELev=30`), `HitShift=8`, `Size=2` |
| 203 | `andypoisonbolt` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `0` | `20` | `50` | `poisonNova` | Phys `1280–1792` (`+1280/lvl`) + `pois` `32–64`, `ELen=800` |
| 215 | `chargedstrikebolt` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `10` (`0x6FB62570`) | `12` | `98` | `ChargedBolt` | Linked to `Skill=Charged Strike` (`PrimeBolt` server missile) |
| 220 | `primepoisoncloud` | `3` (`0x6FC61AE0`) | `0` | `4` (`0x6FB6BE00`) | `0` | `Param1/2<<6` | `60` | `PoisonSparks` | `pois` `10–10` (`+5/lvl`), `ELen=300` (`+20/lvl`), `Size=2`, spawns `poisonpuff` (#141) |
| 247 | `hydra` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `0` | `16` | `30` | `Firebolt` | Linked to `Skill=Hydra` (#62), `HitShift=8` |
| 276 | `mephisto` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `0` | `24` | `40` | `MephistoMissile` | Phys `12–16` (`+8..12/lvl`) + `cold` `12–18` (`+18..28/lvl`), `ELen=75` (`+25/lvl`), `Size=2` |
| 321 | `queenpoisoncloud` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `0` | `8` (`MaxVel=64`) | `92` | `poisonNova` | `pois` `6–16` (`+6/lvl`), `ELen=800`, `InitSteps=16` |
| 331 | `countessfirewall` | `5` (`0x6FC61980`) | `0` | `5` (`0x6FB62F90`) | `0` | `0` | `1000` | `groundFireSmall` | `fire` `3–5` (`+4/lvl`), `HitShift=1`, `DamageRate=41` |
| 343 | `highpriestlightning` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `0` | `20` | `15` | `HighPriestLightning` | `ltng` `8–30` (`MinELev=12`, `MaxELev=14`), `HitShift=8`, `AlwaysExplode=1` |
| 347 | `radamentdeath` | `19` (`0x6FC8A1A0`) | `0` | `32` (`0x6FB62340`) | `0` | `0` | `400` | `null` | Consumes undead corpses (`Redemption` #124), spawns `radamenthandofgod` (#348) |
| 653 | `countessfirewallmaker` | `6` (`0x6FC61850`) | `0` | `6` (`0x6FB692B0`) | `0` | `12` | `7` | `groundFireBig` | Spawns `SubMissile1=countessfirewall` (#331) |
| 679 | `mephfrostnova` | `1` (`0x6FC5F540`) | `0` | `1` (`0x6FB617C0`) | `10` (`0x6FB62570`) | `24` (`Accel=-1000`) | `14` | `FrostNova` | Linked to `Skill=MephFrostNova` (#346), `NextHit=1`, `NextDelay=4` |

---

## 3. Act 1 Bosses & SuperUniques

### 3.1 Andariel (`andariel`, `MonStats` #156, `Code=AN`)

#### `MonStats.txt` Combat Profile
- **Levels**: `12` (Normal), `49` (Nightmare), `75` (Hell)
- **AI Delay (`aidel`)**: `15` (Normal), `11` (Nightmare), `9` (Hell)
- **Resistances (N / NM / H)**:
  - Fire (`ResFi`): **`-50 / -50 / -50`** (signature `-50%` fire vulnerability across all difficulties)
  - Poison (`ResPo`): `80 / 50 / 66`
  - Cold (`ResCo`): `50 / 50 / 66` (`coldeffect = -25 / -15 / 0` — cannot be chilled in Hell)
  - Lightning (`ResLi`): `50 / 50 / 66`
  - Physical (`ResDm`): `0 / 0 / 66`
- **Melee Attack (`A1`)**:
  - Base Physical: `76–238` (`A1TH=153`) in Normal; `180–220` (`A1TH=200` NM, `470` Hell)
  - **100% Poison On-Hit (`El1Mode=A1`, `El1Type=pois`, `El1Pct=100%`)**:
    - Normal: `El1MinD=33`, `El1MaxD=33`, `El1Dur=30` frames
    - Nightmare: `El1MinD=60`, `El1MaxD=33`, `El1Dur=33` frames
    - Hell: `El1MinD=33`, `El1MaxD=33`, `El1Dur=225` frames

#### AI Decision Tree: `AITHINK_Fn034_Andariel` (`0x6FC9FE60`)
| AI Parameter | Column | Normal | Nightmare | Hell | Role in `0x6FC9FE60` |
|---|---|---:|---:|---:|---|
| `ANDARIEL_AI_PARAM_SPRAY_IN_MELEE_CHANCE_PCT` | `aip1` | `30` | `35` | `35` | In melee (`bCombat`), chance to cast `Skill1=AndrialSpray` instead of `MONMODE_ATTACK1` |
| `ANDARIEL_AI_PARAM_STALL_CHANCE_PCT` | `aip2` | `10` | `8` | `6` | Out of melee, chance to stall/idle (`5` ticks) before acting |
| `ANDARIEL_AI_PARAM_FIRE_OR_ENGAGE_CHANCE_PCT` | `aip3` | `30` | `32` | `34` | Out of melee, chance to cast a ranged poison spell instead of walking toward target |
| `ANDARIEL_AI_PARAM_SPRAY_FROM_DISTANCE_CHANCE_PCT` | `aip4` | `50` | `55` | `60` | Given ranged cast (`aip3`), chance to pick `Skill1=AndrialSpray` vs `Skill2=AndyPoisonBolt` |

1. **Melee Branch (`pAiTickParam->bCombat == 1`)**:
   - Rolls `ITEMS_RollRandomNumber(&pUnit->pSeed) % 100 < aip1` (`30/35/35%`):
     - **True**: Casts `Skill1` (`AndrialSpray` #164) in `seq_andarielspray` mode at the target.
     - **False**: Performs melee `MONMODE_ATTACK1` (with 100% poison rider).
2. **Ranged / Approach Branch (`bCombat == 0`)**:
   - Rolls `aip2` (`10/8/6%`): if true, stalls `sub_6FCD0E80(pGame, pUnit, 5)` (`5` frames).
   - Otherwise rolls `aip3` (`30/32/34%`):
     - **True (Ranged Cast)**: Rolls `aip4` (`50/55/60%`):
       - **True**: Casts `Skill1` (`AndrialSpray` #164) in `seq_andarielspray` mode.
       - **False**: Casts `Skill2` (`AndyPoisonBolt` #201) in `MONMODE_ATTACK1` (`A1`) mode.
     - **False (Engage)**: Walks toward target (`sub_6FCC6250` mode `MONMODE_WALK`, distance `7`).

#### Skill 1: `AndrialSpray` (`Skills.txt` #164)
- **Animation Sequence (`seq_andarielspray`, `MonSeq.txt`)**:
  - `18` frames of `SC` (`frame 0..17`).
  - Frames `4, 5, 6, 7, 8, 9, 10, 11, 12` (**9 consecutive frames**) carry `event = 2` (missile trigger event).
- **`SKILLS_SrvSt46_AndrialSpray` (`0x6FCD3930`) & `CltStFunc=34` (`0x6FB07120`)**:
  - Resolves target `(x, y)`, stores `x` in `pSkill->nParam1`, `y` in `pSkill->nParam2`, and resets `pSkill->nParam3 = 0` (the 9-step spray sweep counter).
- **`SKILLS_SrvDo088_AndrialSpray` (`0x6FCD56C0`) & `CltDoFunc=48` (`0x6FB073A0`)**:
  - Invoked on each of the 9 `event=2` sequence frames (`nParam3 = 0..8`).
  - Converts Andariel's 32-direction facing into an 8-direction octant (`nDir8 = PATH_GetDirection(pUnit->pDynamicPath) >> 2`), then indexes into the 8×9 directional sweep table `byte_6FD296D0[nDir8][nParam3]` (values `0..31` in 32-direction space).
  - Computes target offset `(x + gDirectionOffsetX[dir32], y + gDirectionOffsetY[dir32])` at radius ~16 subtiles and spawns **1** `andarielspray` (#32) missile per frame — sweeping a **9-bolt poison fan** across the target arc over frames `4..12`.
- **Missile `#32` (`andarielspray`)**:
  - `pSrvDoFunc=1` (`0x6FC5F540`), `pCltDoFunc=1` (`0x6FB617C0`), `Vel=15`, `Range=40`, `Pierce=1`, `InitSteps=3`, `CelFile=AndarielSpell`, `AnimLen=24`.
  - Damage (`HitShift=8`): Physical `1792–2560` (`+1280/lvl`) + Poison `32–64` (`+32/lvl`) per tick over `ELen=400` (`+10/lvl`) frames (`16` seconds base).

#### Skill 2: `AndyPoisonBolt` (`Skills.txt` #201)
- Uses `monanim=A1` (`Sk2mode=A1`) with no custom `SrvDoFunc`; standard monster skill missile launch fires `srvmissile=andypoisonbolt` (#203) on the `A1` frame event.
- **Missile `#203` (`andypoisonbolt`)**:
  - `pSrvDoFunc=1` (`0x6FC5F540`), `pCltDoFunc=1` (`0x6FB617C0`), `Vel=20`, `Range=50`, `InitSteps=3`, `CelFile=poisonNova`, `AnimLen=30`, `NumDirections=32`.
  - Damage (`HitShift=8`): Physical `1280–1792` (`+1280/lvl`) + Poison `32–64` (`+38..52/lvl`) over `ELen=800` frames (`32` seconds base).

#### Quest Death FX: `QUESTSFX_Andariel` (`QuestsFX.cpp`) & `andycontrol0` (#307)
- **Server (`MONUMOD_QUESTMOD` #24 -> `QUESTSFX_Andariel`)**:
  - Calls `QUESTSFX_MainHandler(pGame, pUnit, 35, 1, 51, 0)`: scans all rooms within radius `35` subtiles of Andariel, and assigns `MONUMOD_TEMPSUMMON` with a random `1..51` frame expiration timer to every living evil monster (`MONSTERS_GetHirelingTypeId == 0`), causing all nearby minions to die during her death shakes.
- **Client (`Missile #307 andycontrol0`, `pCltDoFunc=29` @ `0x6FB63690`, `Range=350`)**:
  - Spawns pillar flames (`andycolumnfirebase` #310 -> `andycolumnfire` #311 `AndarielFlameDeath`), radial ground fire walls (`andyfirewallmaker` #308 `pCltDoFunc=27` @ `0x6FB62280` -> `andyfirewall` #309), and falling ceiling rubble (`andyfallingdebris1..3` #312..314 `pCltHitFunc=19` @ `0x6FB61080` -> `andydebrisexplosion1..5` #315..319).

---

### 3.2 Blood Raven (`bloodraven`, `MonStats` #267, `Code=CR`)

#### `MonStats.txt` & `MonProp.txt` Profile
- **Levels**: `10` (Normal), `43` (Nightmare), `88` (Hell); `aidel = 15 / 13 / 10`.
- **Resistances**: `50%` across Fire/Cold/Lightning/Poison/Magic in all difficulties; Physical `0 / 25 / 50`.
- **Innate Property (`MonProp=bloodraven`)**: Grants `knock = 1` (**Knockback**) in Hell difficulty.
- **Spawn Link**: `spawn = zombie2` (Hungry Dead), `spawnmode = S1`.
- **Missile Slots**: `MissA1 = raven1` (#135), `MissSQ = raven2` (#136).

#### AI Decision Tree: `AITHINK_Fn059_BloodRaven` (`0x6FC39E70`, Init `0x6FC35520`)
1. **Home Leash (`aiCmd 10`)**:
   - On initialization (`0x6FC35520`), stores spawn coordinates `(x, y)` in `pAiControl` (`aiCmd=10`).
   - If distance from home exceeds `50` subtiles, walks back toward home (`sub_6FCD01A0`).
2. **Zombie Summoning Accumulator (`Skill1 = Nest` #167)**:
   - Every AI tick, increments `dwAiParam[0] += 3`.
   - When `!bCombat`, active zombie count `dwAiParam[1] < 2 * nDifficulty + 8` (**cap: 8 in Normal, 10 in Nightmare, 12 in Hell**), and `rand(100) < dwAiParam[0]`:
     - Picks a random offset `(±(5..19), ±rand)` near the target, resets `dwAiParam[0] = 0`, increments `dwAiParam[1]++`, and casts `Skill1` (`Nest` #167) in `seq_bloodravencast` mode (`20` `S1` frames, `event=4` at frame `15`).
3. **Ranged / Evasion Combat**:
   - If `nTargetDistance <= 5`: retreats/kites away from the player (`sub_6FCC63D0`).
   - If `nTargetDistance > 5` and has clear missile line of sight (`sub_6FC61E90`):
     - **80% chance (`rand(100) < 80`) to attack**:
       - Rolls `rand(100) < 10 * (nDifficulty + 4)` (**`40%` Normal, `50%` Nightmare, `60%` Hell**):
         - **True**: Casts `Skill2` (`Quick Strike` #168) in `seq_brquickstrike` mode (`7` `A1` frames, `event=2` at frame `6`).
         - **False**: Fires standard `MONMODE_ATTACK1` (`MissA1 = raven1` #135).
     - **20% chance**: repositions/circles around target.

#### Skill 1: `Nest` (`Skills.txt` #167)
- **`SKILLS_SrvSt49_Nest_EvilHutSpawner` (`0x6FCD5FB0`) & `CltStFunc=36` (`0x6FB06A60`)**:
  - Finds a valid spawn coordinate near target `(x, y)`, reserves subtile collision mask `0x100` (`COLLIDE_MONSTER`), and stores coordinates in `pSkill->nParam1/nParam2`.
- **`SKILLS_SrvDo091_Nest_EvilHutSpawner` (`0x6FCD5E50`) & `CltDoFunc=50` (`0x6FB069E0`)**:
  - Releases the reserved collision mask and spawns `MonStats.spawn` (`zombie2`, Hungry Dead) in `spawnmode=S1` (`MONMODE_SKILL1` ground-emerge animation) with `UNITFLAG_NOXP | UNITFLAG_NOTC` (summoned zombies grant no XP or drops).

#### Skill 2: `Quick Strike` (`Skills.txt` #168)
- **`SKILLS_SrvSt50_QuickStrike` (`0x6FCD3EB0`) & `SKILLS_SrvDo092_QuickStrike` (`0x6FCD5600`)**:
  - Plays `seq_brquickstrike` (`7` fast `A1` frames vs full bow animation).
  - In `0x6FCD5600`: checks `pSkillsTxtRecord->wSrvMissileA`; if `>= 0`, fires `srvmissilea` (`raven1` #135); otherwise falls back to `D2Common_11050(pUnit, 1)` (`MissSQ = raven2` #136, Fire Arrow). Because `Skills.txt` sets `srvmissilea = raven1`, `Quick Strike` fires a rapid `raven1` arrow (`Vel=16`, `SrcDamage=128`), while `raven2` (`CelFile=FireArrow`, fire damage + `fireexplode` #29) remains her `MissSQ` slot.

#### Quest Death FX: `QUESTSFX_Bloodraven` (`QuestsFX.cpp`)
- `MonsterSpawn.cpp:939` assigns `MONUMOD_BRAVENDEATH` + `MONUMOD_QUESTMOD`.
- On death, `QUESTSFX_Bloodraven` calls `QUESTSFX_MainHandler(pGame, pUnit, 35, 25, 125, 1)`: kills all nearby evil undead within `35` subtiles over a `25..125` frame delay while firing radial holy bolts / light beams.

---

### 3.3 The Countess (`corruptrogue3` #45, `SuperUniques` #6, `Code=CR`)

- **Stats & Modifiers**: `Level = 8 / 39 / 69`, `aidel = 15 / 14 / 13`, `Mod1 = 9` (**Fire Enchanted**), `MinGrp/MaxGrp = 6` Dark Stalker minions, `TC = Countess / Countess (N) / Countess (H)`.
- **AI Override (`AISPECIALSTATE_COUNTESS` #13 -> `sub_6FCE5080` / `sub_6FCE5520`)**:
  - When spawned in `D2GAME_SpawnSuperUnique` (`MonsterUnique.cpp:2743`), the engine executes `AITHINK_ExecuteAiFn(..., AISPECIALSTATE_COUNTESS)`, switching her AI callback from `AITHINK_Fn010_CorruptRogue` (`0x6FCA2EC0`) to the Countess special state handler (`0x6FCE5080`).
  - **Tower Room Firewall Patrol (`sub_6FCE5520`)**:
    - Reads room path waypoints from `pUnit->pMonsterData->pMapAi` (`pPosition[dwAiParam[0]]`).
    - When target distance `< 25`, steps through waypoints (`dwAiParam[0]++`) and casts `Skill1 = CountessFirewall` (#321, `Sk1lvl=10`, `Sk1mode=A1`) at `(pPosition->nX, pPosition->nY)`! After `700` frames (`dwAiParam[1] + 700 < dwGameFrame`), resets `dwAiParam[0] = 0` to re-ignite the room.
  - **Combat Behavior**:
    - In melee (`bCombat`): `aip3 + 10` (`95% / 100% / 105%`) chance to perform `MONMODE_ATTACK1`.
    - Out of melee: `aip1` (`80 / 85 / 90%`) chance to run (`MONMODE_RUN`, `Run=10`) toward target; otherwise stalls `aip2` (`9 / 7 / 5`) frames.
- **Skill 1: `CountessFirewall` (`Skills.txt` #321, `Sk1lvl=10`)**:
  - `SrvDoFunc=24` (`0x6FC637D0` `SKILLS_SrvDo024_FireWall`), `CltDoFunc=26` (`0x6FB24770`).
  - Computes perpendicular vector `(-dy, +dx)` and `(+dy, -dx)` normalized to distance `5`, spawning two opposing `countessfirewallmaker` (#653, `pSrvDoFunc=6` @ `0x6FC61850`, `pCltDoFunc=6` @ `0x6FB692B0`, `Vel=12`, `Range=7`) missiles plus a central `countessfirewall` (#331).
  - Each `countessfirewall` (#331, `pSrvDoFunc=5` @ `0x6FC61980`, `pCltDoFunc=5` @ `0x6FB62F90`) burns for **`Range=1000` frames (`40` seconds!)** (`HitShift=1`, `DamageRate=41`, `EMin=3`, `EMax=5`, `+4/lvl` -> at `Sk1lvl=10`, deals heavy sustained fire damage).

---

### 3.4 Griswold (`griswold` #365, `SuperUniques` #5, `Code=GZ`)
- **Stats & Modifiers**: `Level = 5 / 39 / 84`, `aidel = 15 / 13 / 10`, `Velocity = 3`, `Mod1 = 7` (**Cursed**).
- **AI (`AITHINK_Fn090_Griswold` @ `0x6FC372B0`)**:
  - Has no `Skills.txt` skills in `MonStats.txt`.
  - If `bCombat`: hardcoded **80% chance** (`rand(100) < 80`) to execute `MONMODE_ATTACK1`, else idles `10` frames.
  - If `!bCombat`: hardcoded **50% chance** to walk (`MONMODE_WALK`) within `2` subtiles of target, else idles `10` frames.
- **Skill / Modifier Effect**: `Mod1 = 7` (`MONUMOD_CURSED`) procs `Amplify Damage` (#66, `-100%` `damageiterate` / physical resistance) on successful melee hits (`MonsterUnique.cpp`).

---

### 3.5 The Smith (`smith` #402, `SuperUniques` #20, `Code=5P`)
- **Stats & Modifiers**: `Level = 10 / 42 / 79`, `aidel = 15 / 13 / 12`, `Velocity = 7`, `Mod1 = 5` (**Extra Strong**).
- **Innate Melee Fire Rider (`El1Mode=A1`, `El1Type=fire`)**:
  - Nightmare: `El1Pct=15%`, `El1MinD=30`, `El1MaxD=60`.
  - Hell: `El1Pct=30%`, `El1MinD=40`, `El1MaxD=80`.
- **AI (`AITHINK_Fn098_Smith` @ `0x6FC376B0`)**:
  - In melee (`bCombat`): 100% `MONMODE_ATTACK1`.
  - Out of melee (`!bCombat`): computes missing HP percentage `nBonusVel = (100 - MONSTERS_GetLifePercentage(pUnit)) >> 1` (`0..50%` bonus velocity as his HP drops!), applies `STAT_VELOCITYPERCENT` via `D2Common_10996`, and walks (`MONMODE_WALK`) toward target.

---

### 3.6 The Cow King (`hellbovine` #391, `SuperUniques` #39, `Code=EC`)
- **Stats & Modifiers**: `Level = 28 / 61 / 81`, `aidel = 15 / 14 / 13`, `Mod1 = 8` (**Magic Resistant**), `Mod2 = 17` (**Lightning Enchanted**; `ResLi = 50` base in Hell -> **Lightning Immune** with Magic Resistant + LE).
- **AI (`AITHINK_Fn002_Skeleton` @ `0x6FCA3AC0`)**:
  - Uses `Skeleton` AI with aggressive parameters: `aip1 = 99%` melee attack chance (`aip4 = 33%` `A2` vs `67%` `A1`), `aip3 = 95 / 99 / 99%` approach chance, `aip2 = 5` stall frames.
- **Skill / Modifier Effect (`MONUMOD_LIGHTCHANT` #17)**:
  - Whenever put into hit recovery (`MONMODE_GETHIT`), `MONSTERUNIQUE_CastLightUniqueMissile` fires **8 `lightunique` Charged Bolts** (at monster level `lvl / 2`, 2 bolts in each of the 4 cardinal directions).

---

## 4. Act 2 Bosses & SuperUniques

### 4.1 Duriel (`duriel`, `MonStats` #211, `Code=DU`)

#### `MonStats.txt` Combat Profile
- **Levels**: `22` (Normal), `55` (Nightmare), `88` (Hell); `aidel = 15 / 15 / 15`
- **Movement Speed**: `Velocity = 10`, `Run = 15` (one of the fastest base movement speeds in the game)
- **Resistances (N / NM / H)**:
  - Cold (`ResCo`): `50 / 75 / 95` (`coldeffect = -20 / -20 / -20`)
  - Fire / Lightning / Poison: `20 / 50 / 75`
  - Physical (`ResDm`): `0 / 0 / 50`; Magic (`ResMa`): `0 / 0 / 33`
- **Innate Stun on `A2` (`El1Mode=A2`, `El1Type=stun`, `El1Pct=100%`)**:
  - Stuns for `El1Dur = 15 / 20 / 30` frames on `A2` hits.

#### AI Decision Tree: `AITHINK_Fn044_Duriel` (`0x6FCA9430`)
| AI Parameter | Column | Normal | Nightmare | Hell | Role in `0x6FCA9430` |
|---|---|---:|---:|---:|---|
| `DURIEL_AI_PARAM_HOLY_FREEZE_LEVEL` | `aip1` | `5` | `5` | `6` | Skill level of `Holy Freeze` (#114) activated on first AI tick |
| `DURIEL_AI_PARAM_SMITE_CHANCE_PCT` | `aip2` | `33` | `33` | `33` | In melee, chance to cast `Skill3=Smite` (#97, `Sk3lvl=7`) |
| `DURIEL_AI_PARAM_JAB_CHANCE_PCT` | `aip3` | `50` | `50` | `50` | If `Smite` not rolled, chance to cast `Skill2=Jab` (#10, `Sk2lvl=15`) |
| `DURIEL_AI_PARAM_ATTACK2_OR_1_CHANCE_PCT` | `aip4` | `0` | `0` | `0` | If `Jab` not rolled, chance for `MONMODE_ATTACK2` vs `MONMODE_ATTACK1` |
| `DURIEL_AI_PARAM_CHARGE_CHANCE_PCT` | `aip5` | `0` | `0` | `0` | Out of melee (`nTargetDistance >= 7`), chance to cast `Skill1=Charge` (#107) |

1. **Tick 0 Aura Activation (`dwAiParam[0] == 0`)**:
   - Sets `dwAiParam[0] = 1` and equips `SKILL_HOLYFREEZE` (#114) at level `aip1` (`5 / 5 / 6`) as Duriel's active right-hand aura (`D2GAME_AssignSkill_6FD13800` + `SKILLS_SetRightSkill`).
2. **Melee Branch (`bCombat == 1`)**:
   - **33% (`aip2 = 33`)**: Casts `Skill3 = Smite` (#97, `Sk3lvl=7`, `seq_durielsmite`: `10` `A2` frames, `event=1` at frame `7`).
   - **33.5% (`(100 - 33) * 50%`, `aip3 = 50`)**: Casts `Skill2 = Jab` (#10, `Sk2lvl=15`, `seq_durieljab`: `13` `A1/A2` frames with **3** `event=1` melee hits at sequence indices `3, 9, 12`).
   - **33.5% (`aip4 = 0`)**: Executes standard `MONMODE_ATTACK1`.
3. **Out-of-Melee Branch (`bCombat == 0`)**:
   - Checks `if (nTargetDistance >= 7 && rand(100) < aip5)` -> cast `Skill1 = Charge` (#107, `Sk1lvl=5`, `seq_durielcharge`: `31` `WL/A2` frames).
   - **Critical 1.13c Ground Truth**: Because `aip5` is **`0`** across all difficulties in `MonStats.txt`, **`rand(100) < 0` is always false — Duriel NEVER uses `Charge` (#107) in unmodified v1.13c**! Instead, he always falls through to `sub_6FCC62F0(pGame, pUnit, pTarget, 3u, 13)`, charging on foot in `MONMODE_RUN` at velocity `13`.

#### Duriel's Active Skills
- **Skill 4: `Holy Freeze` (`Skills.txt` #114, `lvl = 5/5/6`, `SrvDoFunc=81` @ `0x6FCBABC0`)**:
  - Pulses every `perdelay = 50` frames (`2` seconds).
  - Radius (`aurarangecalc = ln12` = `Param1 + (lvl-1)*Param2` = `6 + (lvl-1)*1`): **`10` subtiles** (N/NM), **`11` subtiles** (Hell).
  - Unresistable Slow (`aurastatcalc1..3 = -dm34`, diminishing returns between `Param3=25` and `Param4=60`): slows target `velocitypercent`, `attackrate`, and `other_animrate` by **`-42%` at lvl 5** (`-44%` at lvl 6) — bypassing `Cannot Be Frozen`!
  - Cold Aura Pulse + Passive Melee Cold Rider (`passivecalc1/2 = enms*5/256` = `5×` pulse cold damage added to melee attacks).
- **Skill 3: `Smite` (`Skills.txt` #97, `Sk3lvl=7`, `SrvDoFunc=150` @ `0x6FCB9000`)**:
  - `ResultFlags = 8` (ignores Defense / guaranteed hit check, cannot be blocked by standard weapon block), applies Knockback (`SUNITDMG_GetResultFlags` |= `0x8`) and Stun (`calc2 = min(250, ln12)` = `15 + 6*5 = 45` frames = `1.8`s), plus `+105%` (`ln34` = `15 + 6*15`) enhanced damage.
- **Skill 2: `Jab` (`Skills.txt` #10, `Sk2lvl=15`, `SrvStFunc=5` @ `0x6FC6C1C0`, `SrvDoFunc=7` @ `0x6FC6CB00`, `CltStFunc=12` @ `0x6FAC4F10`, `CltDoFunc=16` @ `0x6FAC4F40`)**:
  - Plays `seq_durieljab` (`13` frames total), triggering `SrvDoFunc=7` three times (`event=1` on frames `A1:7`, `A2:9`, `A2:14`). At `Sk2lvl=15`, `calc1 = ln34 = -15 + 14*3 = +27%` damage per strike (`+136%` Attack Rating).

---

### 4.2 Radament (`radament` #229, `SuperUniques` #10, `Code=RD`)

#### `MonStats.txt` & `SuperUniques.txt` Profile
- **Stats**: `Level = 16 / 49 / 83`, `aidel = 15 / 14 / 13`, `Mod1 = 6` (**Extra Fast**), `MinGrp/MaxGrp = 3`.
- **Melee (`A1`) & Poison Breath (`A2`)**:
  - `A1`: `73–155` (N) / `100–150` (NM/H) + `25%` chance (`El1Pct=25`) of heavy long-duration poison (`El1Dur=1000` frames = `40`s, `El1MinD=181/180/180`, `El1MaxD=272/270/270`).
  - `A2` (`MissA2 = mummy4` #66): Short-range poison breath cloud when target distance `< 5`.

#### AI Decision Tree: `AITHINK_Fn022_GreaterMummy` (`0x6FCA8380`)
| AI Parameter | Column | Normal | Nightmare | Hell | Role in `0x6FCA8380` |
|---|---|---:|---:|---:|---|
| `GREATERMUMMY_AI_PARAM_MELEE_OR_BREATH_CHANCE_PCT` | `aip1` | `85` | `85` | `85` | Chance to `A1` in melee or `A2` (`mummy4` poison breath) at distance `< 5` |
| `GREATERMUMMY_AI_PARAM_RESURRECT_CHANCE_PCT` | `aip2` | `45` | `50` | `55` | Chance to cast `Skill1=Resurrect2` (#327) on an undead corpse |
| `GREATERMUMMY_AI_PARAM_HEAL_CHANCE_PCT` | `aip3` | `55` | `55` | `55` | Chance to cast `Skill2=Bestow` (#182) on a wounded ally |
| `GREATERMUMMY_AI_PARAM_UNHOLY_BOLT_CHANCE_PCT` | `aip4` | `85` | `90` | `95` | Chance to cast `Skill3=UnHolyBolt` (#157) at ranged target |
| `GREATERMUMMY_AI_PARAM_SEARCH_RADIUS_BONUS` | `aip5` | `24` | `27` | `31` | Added to `10` for undead corpse/ally scan radius (`34 / 37 / 41` subtiles!) |

1. **Close-Quarters Check**:
   - If `bCombat` and `rand(100) < aip1` (`85%`): executes melee `MONMODE_ATTACK1`.
   - Else if `nTargetDistance < 5` and `rand(100) < aip1` (`85%`): executes `MONMODE_ATTACK2` (`MissA2 = mummy4` #66 poison cloud).
2. **Undead Support Scan (`AITHINK_FilterCallback_GreaterMummy`, radius `aip5 + 10 = 34/37/41` subtiles)**:
   - Scans nearby rooms for wounded undead (`< 100%` HP) and dead undead corpses (`lUndead == 1` or `hUndead == 1`). Note: In Normal difficulty (`nDifficulty == 0`), Radament (`hcIdx == 229`) can even revive Unique undead (`MONSTERUNIQUE_CheckMonTypeFlag(pUnit, 8u)` allowed when `dwClassId == MONSTER_RADAMENT && !nDifficulty`)!
   - If wounded ally found and `rand(100) < aip3` (`55%`): casts `Skill2 = Bestow` (#182, `seq_mummyres`: `16` `SC` frames, `event=2` at frame `13`, `SrvDoFunc=96` @ `0x6FCD3770`).
   - If undead corpse found and `rand(100) < aip2` (`45/50/55%`): casts `Skill1 = Resurrect2` (#327, `seq_mummyres`, `SrvDoFunc=97` @ `0x6FCD5BD0`, `CltStFunc=39` @ `0x6FB07000`), reviving the skeleton/undead with `UNITFLAG_NOTC | UNITFLAG_NOXP`.
3. **Ranged Attack**:
   - If `nTargetDistance < 25`, has missile LOS, and `rand(100) < aip4` (`85/90/95%`): casts `Skill3 = UnHolyBolt` (#157, `seq_mummyres`, `SrvDoFunc=85` @ `0x6FCD58A0`).
   - `SKILLS_SrvDo085_UnholyBolt_ShamanFire` (`0x6FCD58A0`) computes monster chain index `nChainId` (`0..3`) and fires `wSrvMissileA + nChainId` (`unholybolt1` #77 for Radament: `Vel=12`, `Range=40`, `EType=mag`, `EMin=3`, `EMax=6`, `+9/lvl`).

#### Quest Death FX: `QUESTSFX_SpawnRadamentDeathMissile` (`0x6FC8A1A0`)
- Spawns `radamentdeath` (#347, `pSrvDoFunc=19` @ `0x6FC8A1A0` `MISSMODE_SrvDo19_RadamentDeath`, `pCltDoFunc=32` @ `0x6FB62340`, `Range=400`).
- **Server (`0x6FC8A1A0`)**: Periodically pulses Paladin `Redemption` (#124) logic over nearby corpses, consuming all undead corpses in the chamber so they cannot be revived.
- **Client (`0x6FB62340`)**: Calls `radamenthandofgod` (#348, `pCltHitFunc=37` @ `0x6FB61390`, `CelFile=HandOfGod`) and radial `radamentholybolt` (#349, `CelFile=HolyBoltMissile`).

---

### 4.3 The Summoner (`summoner` #250, `SuperUniques` #18, `Code=SU`)

#### `MonStats.txt` & `SuperUniques.txt` Profile
- **Stats**: `Level = 18 / 55 / 80`, `aidel = 15 / 13 / 10`, `Mod1 = 5` (Extra Strong), `Mod2 = 6` (Extra Fast), `ResFi/ResCo/ResLi = 50 / 50 / 75`.
- **5 Assigned Skills (all cast in `SC` mode)**:
  - `Skill1`: `Glacial Spike` (#55, `Sk1lvl=6`)
  - `Skill2`: `Frost Nova` (#44, `Sk2lvl=5`)
  - `Skill3`: `Fire Ball` (#47, `Sk3lvl=5`)
  - `Skill4`: `VampireFirewall` (#170, `Sk4lvl=7`)
  - `Skill5`: `Weaken` (#72, `Sk5lvl=4`)

#### AI Decision Tree: `AITHINK_Fn053_Summoner` (`0x6FCA5780`)
| AI Parameter | Column | Normal | Nightmare | Hell | Role in `0x6FCA5780` |
|---|---|---:|---:|---:|---|
| `SUMMONER_AI_PARAM_CAST_CHANCE_PCT` | `aip1` | `85` | `93` | `98` | Master spellcast chance per AI tick |
| `SUMMONER_AI_PARAM_WEAKEN_CHANCE_PCT` | `aip2` | `5` | `5` | `5` | Priority chance to cast `Skill5=Weaken` (#72) |
| `SUMMONER_AI_PARAM_PREF_ELEMENT_CHANCE_PCT` | `aip3` | `63` | `63` | `63` | Chance to use target's **lower** resistance element (`FireRes >= ColdRes` -> Cold, inverted `37%` of ticks) |
| `SUMMONER_AI_PARAM_FROST_NOVA_CD_FRAMES` | `aip4` | `40` | `40` | `40` | Cooldown (`dwAiParam[1]`) after casting `Frost Nova` (#44) |
| `SUMMONER_AI_PARAM_FIREWALL_CD_FRAMES` | `aip5` | `120` | `100` | `80` | Cooldown (`dwAiParam[2]`) after casting `VampireFirewall` (#170) |
| `SUMMONER_AI_PARAM_ESCAPE_CHANCE_PCT` | `aip6` | `33` | `20` | `10` | If `nTargetDistance < 5`, chance to flee `6` steps |
| `SUMMONER_AI_PARAM_FROST_NOVA_RANGE` | `aip7` | `5` | `8` | `11` | Max target distance to trigger `Frost Nova` (#44) |
| `SUMMONER_AI_PARAM_MAX_CAST_RANGE` | `aip8` | `40` | `40` | `40` | Max LOS range for `Glacial Spike` (#55) and `Fire Ball` (#47) |

1. **Close-Range Escape (`nTargetDistance < 5`)**:
   - Rolls `aip6` (`33 / 20 / 10%`): retreats `6` steps (`sub_6FCC63D0`).
2. **Adaptive Resistance Inspection**:
   - Reads target's `STAT_FIRERESIST` and `STAT_COLDRESIST`: sets `bUseColdSkill = (FireRes >= ColdRes)`.
   - Rolls `rand(100) >= aip3` (`37%` chance since `aip3=63`): if true, flips `bUseColdSkill = !bUseColdSkill`.
3. **Spell Selection (`rand(100) < aip1` = `85 / 93 / 98%`)**:
   - **Priority 1 (`rand(100) < aip2` = `5%`)**: Casts `Skill5 = Weaken` (#72, `Sk5lvl=4`, `SrvDoFunc=30` @ `0x6FC705D0`, `CltStFunc=18` @ `0x6FB785C0`, `CltDoFunc=30` @ `0x6FB78B40`, `-33%` target physical damage in `12` subtile radius for `530` frames).
   - **Priority 2 (`bUseColdSkill == 1`)**:
     - If `dwGameFrame > dwAiParam[1]` and `nTargetDistance < aip7` (`5 / 8 / 11` subtiles): casts `Skill2 = Frost Nova` (#44, `Sk2lvl=5`, `SrvDoFunc=22` @ `0x6FC63AA0`, `CltDoFunc=25` @ `0x6FB23CB0`, 64 radial `frostnova` #119 missiles) and sets `dwAiParam[1] = dwGameFrame + aip4` (`40` frames).
     - Else if missile LOS and `nTargetDistance < aip8` (`40`): casts `Skill1 = Glacial Spike` (#55, `Sk1lvl=6`, fires `glacialspike` #96, `Vel=16`, `Range=40`, `pSrvHitFunc=13` @ `0x6FC5FF10` AoE freeze).
   - **Priority 3 (Fire Wall Cooldown Ready: `dwGameFrame > dwAiParam[2]`)**:
     - Casts `Skill4 = VampireFirewall` (#170, `Sk4lvl=7`, `SrvDoFunc=24` @ `0x6FC637D0`, `CltDoFunc=26` @ `0x6FB24770` -> `vampirefirewallmaker` #130 + `vampirefirewall` #131) and sets `dwAiParam[2] = dwGameFrame + aip5` (`120 / 100 / 80` frames).
   - **Priority 4 (Fire Ball)**:
     - If missile LOS and `nTargetDistance < aip8` (`40`): casts `Skill3 = Fire Ball` (#47, `Sk3lvl=5`, fires `fireball` #62, `Vel=20`, `Range=50`, `pSrvHitFunc=1` @ `0x6FC5EAE0` radial fire splash).
   - **Priority 5 (Fallback)**:
     - If `!bUseColdSkill`, `dwGameFrame > dwAiParam[1]`, and `nTargetDistance < aip7`: casts `Frost Nova` (#44); otherwise casts `Weaken` (#72).

---

### 4.4 Coldworm the Burrower (`maggotqueen1` #284, `SuperUniques` #15, `Code=MQ`)

#### `MonStats.txt` & Hidden UMod Profile
- **Stats**: `Level = 11 / 46 / 81`, `aidel = 15 / 15 / 15`, `Mod1 = 18` (**Cold Enchanted**), `Mod2 = 8` (**Magic Resistant**), `ResPo(H) = 120` (Poison Immune in Hell), `AutoPos = 0` (stationary in Maggot Lair Level 3).
- **Hidden UMod (`MonsterSpawn.cpp:945`)**:
  - At spawn time, `MonsterSpawn.cpp` explicitly assigns **`MONUMOD_POISONFIELD` (#23)** + `MONUMOD_QUESTMOD` (#24) to Coldworm!
  - Whenever Coldworm takes damage, `MONSTERUNIQUE_CastQueenPoisonCloudMissile` (`0x6FC6D8B0`) fires **8 `queenpoisoncloud` (#321) bolts** (2 per cardinal direction using `PATHTYPE_CHARGEDBOLT`, `Vel=8`, `MaxVel=64`, `Range=92`, `ELen=800` frames = `32`s poison).

#### AI Cycle: `AITHINK_Fn066_SandMaggotQueen` (`0x6FCA7A60`)
- Coldworm is completely stationary and executes a 3-stage spawning state machine (`dwAiParam[0]` = total adults spawned, `dwAiParam[1]` = phase `0..2`, `dwAiParam[2]` = timer):
  - **Phase 0 (`dwAiParam[0] < aip1` = `7 / 8 / 9` max adults)**: Rotates in mode 8 (`D2GAME_EVENTS_Delete_6FC34840` + `sub_6FCD0820`), transitions to Phase 1, and stalls `aip2` (`12` frames).
  - **Phase 1**: Spawns **1 adult `sandmaggot1` (#68)** via `D2GAME_SpawnMonster_6FC69F10` at offset `(spawnx=8, spawny=0)` in `spawnmode=S1` with `UNITFLAG_NOXP`, increments `dwAiParam[0]++`, transitions to Phase 2, and stalls `aip2` (`12` frames).
  - **Phase 2**: Increments `dwAiParam[2]++`; while `dwAiParam[2] < 25`, stalls `aip2` (`12` frames) per tick (`25 × 12 = 300` frames = `12` seconds cooldown), then resets `dwAiParam[1]=0, dwAiParam[2]=0` to spawn the next adult maggot.

#### Sand Maggot Family Skills (`MagottUp`, `MagottDown`, `MagottLay`, `MaggotEgg`, `QueenDeath`)
1. **`MagottUp` (#161, `seq_maggotup`: `12` `S1` frames, `event=4` at frame `11`)**:
   - `SKILLS_SrvSt44_MaggotUp` (`0x6FCD4760`) & `CltStFunc=32` (`0x6FB07200`): Restores `UNITFLAG_TARGETABLE | UNITFLAG_CANBEATTACKED | UNITFLAG_ISVALIDTARGET` (`0xE`), restores collision mask `0x1000`, and spawns visual `dirt pile` (#322) / `sand pile` (#76) missiles.
2. **`MagottDown` (#162, `seq_maggotdown`: `12` reversed `S1` frames `11..0`, `event=1` at frame `0`)**:
   - `SKILLS_SrvSt45_MaggotDown` (`0x6FCD3120`) & `CltStFunc=33` (`0x6FB06BB0`): Clears targetability flags (`~0xEu`) and collision (`0x8000`) while burrowed.
   - `SKILLS_SrvDo086_MaggotDown` (`0x6FCD3060`) & `CltDoFunc=47` (`0x6FB06740`): Heals the burrowed maggot by `calc1 = 10%` of MaxHP (`MaxHP * 10 / 100`).
3. **`MagottLay` (#163, `seq_maggotlay`: `13` `S1` frames, `event=1` at index `6`)**:
   - `SKILLS_SrvDo087_MaggotLay` (`0x6FCD42D0`): Adult `sandmaggot1` (#68, `AITHINK_Fn015_SandMaggot` @ `0x6FCA7010`, `aip3=2` max eggs, `aip4=75%` lay chance) spawns a `maggotegg1` (#190) at directional offset `byte_6FD296C8` in front of its facing direction.
4. **`MaggotEgg` (#159 on `maggotegg1` #190, `seq_maggotegg`: `14` `DT` frames, `event=4` at frame `9`)**:
   - `AITHINK_Fn040_MaggotEgg` (`0x6FC9D310`): Waits `aip1` (`250 / 200 / 200` ticks), then rolls `aip2` (`18%` chance per tick) to hatch via `Skill1=MaggotEgg` (#159, `Sk1lvl=2`).
   - `SKILLS_SrvSt43_MaggotEgg` (`0x6FCD31B0`) & `SKILLS_SrvDo084_MaggotEgg` (`0x6FCD65E0`) / `CltDoFunc=46` (`0x6FB06780`): Spawns `calc1 = (lvl < 5) ? lvl : min(12, 5 + (lvl-5)/3)` = **2 `maggotbaby1` larvas** and kills the egg unit.
5. **`QueenDeath` (#216, `seq_queendeath`: `54` `DT` frames, `event=1` at indices `22, 38, 53`)**:
   - `CltDoFunc=64` (`0x6FB07860`): Spawns `queendeathcenter` (#353, `pCltDoFunc=35` @ `0x6FB62F10`) -> `queendeathglob` (#354, `pCltHitFunc=39` @ `0x6FB61240`, `CelFile=QueenDeathGuts`) -> `queendeathsplat1/2` (#355/356, `pCltDoFunc=11` @ `0x6FB616E0`, `CelFile=QueenDeathPuddle`), accompanied by Cold Enchanted Frost Nova + `MONUMOD_POISONFIELD` poison cloud burst.

---

## 5. Act 3 Bosses & SuperUniques

### 5.1 Mephisto (`mephisto`, `MonStats` #242, `Code=MP`)

#### `MonStats.txt` & `MonProp.txt` Profile
- **Levels**: `26` (Normal), `59` (Nightmare), `87` (Hell)
- **AI Delay (`aidel`)**: `15` (Normal), `10` (Nightmare), `6` (Hell)
- **Innate Properties (`MonProp = mephisto`)**:
  - Nightmare: `+15%` Faster Cast Rate (`cast2=15`) and `+15%` Increased Attack Speed (`swing2=15`)
  - Hell: `+30%` Faster Cast Rate (`cast2=30`) and `+30%` Increased Attack Speed (`swing2=30`)
- **Resistances (N / NM / H)**:
  - Fire / Lightning: `33 / 50 / 75`
  - Cold: `25 / 25 / 75` (`coldeffect = -25 / -15 / -10`)
  - Poison: `50 / 50 / 75`
  - Physical: `0 / 0 / 20`; Magic: `0 / 0 / 50`
- **Melee Attack (`A1`)**: `295–442` (`A1TH=251`) in Normal; `160–220` (`A1TH=200`) in NM/Hell.

#### AI State Machine: `AITHINK_Fn050_Mephisto` (`0x6FCA5B60`)
Mephisto runs a 5-state machine (`pAiControl->nAiState` = `0..4`) driven by his missing life factor `nLifeChance = max((100 - lifePct) / 5, 0)` (`0` at full HP up to `20` near death) and `aip1 = 15 / 20 / 25%`:

1. **State Transitions (`nAiState == 0`)**:
   - **In Melee (`bCombat == 1`)**:
     - Rolls `rand(100) < aip1` (`15 / 20 / 25%`): enters **`nAiState = 2`** (Ranged Spell Volley) and sets `dwAiParam[0] = rand(3) + 3` (**casts `3..5` ranged spells in a row** even in melee!).
     - Otherwise enters **`nAiState = 3`** (Close Combat):
       - `rand(100) < (80 - nLifeChance)` (`80%` at full HP down to `60%` at low HP): executes melee `MONMODE_ATTACK1`.
       - Else if `< (80 + nLifeChance)`: casts `Skill3 = PrimePoisonNova` (#192, `Sk3lvl=7`).
       - Else: circles target (`sub_6FCC64E0`).
   - **Out of Melee (`bCombat == 0`, `nTargetDistance <= 20`)**:
     - If `lifePct <= 20`, `nTargetDistance < 5`, and `rand(100) < 40`: enters **`nAiState = 1`** (`dwAiParam[0] = rand(2) + 2` -> `2..3` ticks of escaping or casting `PrimePoisonNova` #192).
     - Else if `rand(100) < (50 + nLifeChance)` (`50%` at full HP up to `70%` near death): enters **`nAiState = 2`** (`dwAiParam[0] = rand(3) + 3` -> **`3..5` consecutive ranged spells**).
     - Else: enters **`nAiState = 4`** (`dwAiParam[0] = rand(3) + 2` -> `2..4` steps walking toward target).
   - **Far Range (`nTargetDistance > 20`)**: Enters **`nAiState = 2`** with `dwAiParam[0] = 2` (2 ranged spells).

2. **Ranged Spell Volley (`nAiState == 2`, `nValidSkills = 6`, `nSkillChance = 16`, `nRand = rand(100)`)**:
   - **Condition A — `Blizzard` (#59, `Sk6lvl=5`)**:
     - Requires **Nightmare or Hell (`nDifficulty > 0`)** AND (`COLLISION_CheckAnyCollisionWithPattern(..., COLLIDE_MISSILE_BARRIER)` between Mephisto and target — **the famous "Moat Trick" counter!** — OR `nTargetDistance > 30`).
     - Casts `Skill6 = Blizzard` (#59, `Sk6lvl=5`, `Sk6mode=A2`).
   - **Condition B — `MephFrostNova` (#346, `Sk5lvl=1`)**:
     - Requires **Nightmare or Hell (`nDifficulty > 0`)**, `nTargetDistance < 15`, and `nRand < 16` (**16% chance**).
     - Casts `Skill5 = MephFrostNova` (#346, `Sk5lvl=1`, `Sk5mode=A2`).
   - **Condition C — `MephistoMissile` / "Skull Ball" (#334, `Sk4lvl=5`)**:
     - If `nRand < 32` (**16% chance** when `< 15` in NM/H; **32% chance** in Normal or when `>= 15`): casts `Skill4 = MephistoMissile` (#334, `Sk4lvl=5`, `Sk4mode=A2`).
   - **Condition D — `PrimeBolt` (#186, `Sk2lvl=6`)**:
     - If `nRand < 48` (**16% chance**): casts `Skill2 = PrimeBolt` (#186, `Sk2lvl=6`, `Sk2mode=A2`).
   - **Condition E — `PrimeLightning` (#185, `Sk1lvl=6`)**:
     - If `nRand >= 48` (**52% chance**): casts `Skill1 = PrimeLightning` (#185, `Sk1lvl=6`, `Sk1mode=A2`).

#### Mephisto's 6 Skills (`Skills.txt` & `Missiles.txt`)
1. **`PrimeLightning` (#185, `Sk1lvl=6`)**:
   - Fires `srvmissile = monsterlight` (#170, `pSrvDoFunc=1` @ `0x6FC5F540`, `pCltDoFunc=8` @ `0x6FB633F0`, `pCltHitFunc=10` @ `0x6FB62570`, `Vel=30`, `Range=25`, `Size=2`).
   - Damage (`HitShift=8`): Lightning `15–30` base (`MinELev=0`, `MaxELev=30` -> `15–180` at `Sk1lvl=6` before difficulty scaling).
2. **`PrimeBolt` (#186, `Sk2lvl=6`)**:
   - `SrvDoFunc=17` (`0x6FC63B60` `SKILLS_SrvDo017_ChargedBolt_BoltSentry`), `CltDoFunc=23` (`0x6FB24AC0`).
   - Spawns `calc1 = lvl + 2 = 8` bolts (`srvmissilea = chargedstrikebolt` #215, `cltmissilea = chargedbolt` #56, `Vel=12`, `Range=98`) using `PATHTYPE_CHARGEDBOLT`.
3. **`PrimePoisonNova` (#192, `Sk3lvl=7`)**:
   - `SrvDoFunc=99` (`0x6FCD52A0` `SKILLS_SrvDo099_PrimePoisonNova`), `CltDoFunc=55` (`0x6FB081F0`).
   - Spawns **two concentric 8-missile rings (16 missiles total)** of `primepoisoncloud` (#220, `pSrvDoFunc=3` @ `0x6FC61AE0`, `pCltDoFunc=4` @ `0x6FB6BE00` which emits `poisonpuff` #141):
     - Ring 1 (8 octant directions `stru_6FD28C00[0..7]`): velocity `Param1 << 6 = 2 << 6 = 128`.
     - Ring 2 (same 8 directions): velocity `Param2 << 6 = 4 << 6 = 256`.
   - At `Sk3lvl=7`: `pois` `40–40` per tick over `ELen = 300 + 6*20 = 420` frames (`16.8`s).
4. **`MephistoMissile` ("Skull Ball", #334, `Sk4lvl=5`)**:
   - Fires icy-white skull orb `mephisto` (#276, `pSrvDoFunc=1`, `pCltDoFunc=1`, `Vel=24`, `Range=40`, `Size=2`, `CelFile=MephistoMissile`, `ExplosionMissile=mephistoexplosion` #367).
   - Deals heavy **hybrid Physical + Cold damage** (`HitShift=8`, Phys `12–16` `+8..12/lvl` + Cold `12–18` `+18..24/lvl`, `ELen = 75 + 4*25 = 175` chill frames).
5. **`MephFrostNova` (#346, `Sk5lvl=1`, NM/Hell only)**:
   - `SrvDoFunc=22` (`0x6FC63AA0` `SKILLS_SrvDo022_NovaAttack`), `CltDoFunc=25` (`0x6FB23CB0`).
   - Spawns **64 radial missiles** (`srvmissilea = mephfrostnova` #679, `cltmissilea = frostnova` #119, `Vel=24`, `Accel=-1000`, `Range=14`, `NextHit=1`, `NextDelay=4`), dealing `40–60` (`+20/lvl`) cold damage with `ELen=200` frames.
6. **`Blizzard` (#59, `Sk6lvl=5`, NM/Hell only)**:
   - `SrvDoFunc=28` (`0x6FC62D90`), `CltDoFunc=28` (`0x6FB23DF0`).
   - Spawns `blizzardcenter` (#158, `pSrvDoFunc=10` @ `0x6FC613D0`, `pCltDoFunc=13` @ `0x6FB6BC10`, `Range=100` frames = `4`s duration), which rains down `blizzard1..4` (#159..162, `pSrvDoFunc=3` @ `0x6FC61AE0`, `pCltHitFunc=19` @ `0x6FB61080`, `Size=2`, `Range=9`).

#### Quest Death FX: `QUESTSFX_SpawnMephistoDeathControlMissile` (`0x6FCB97D0`)
- Spawns `mephistodeathcontrol` (#299, `pCltDoFunc=26` @ `0x6FB62490`, `Range=275`), which orchestrates:
  - `mephistofirewallmaker` (#300, `pCltDoFunc=27` @ `0x6FB62280`) -> `mephistofirewall` (#301),
  - `mephistoflyingrocksbig` (#302, `pCltHitFunc=33` @ `0x6FB61610`) -> `mephistoflyingrockssmall` (#304),
  - Soul/Pit sequence `mephistoholedelay` (#358) -> `mephistoholebirth` (#359) -> `mephistoholeneutral` (#360) -> `mephistoholedeath` (#361) -> `mephistoholedead` (#362).

---

### 5.2 High Council of Zakarum (`councilmember1..3` #345..347, `Code=HP`)

#### The 6 SuperUnique Council Members (`SuperUniques.txt`)
| Location | SuperUnique (`hcIdx`) | Base Class (`MonStats` ID) | `Hydra` & `ZakarumHeal` Level | Fixed UMods (`Mod1` + `Mod2`) | Hell Immunities (Base + UMods) |
|---|---|---|---:|---|---|
| **Travincal** | **Ismail Vilehand** (`#26`) | `councilmember1` (`#345`) | `2` | `Extra Fast` (`6`) + `Cursed` (`7`) | **Fire Immune** (`ResFi=120`) |
| **Travincal** | **Geleb Flamefinger** (`#27`) | `councilmember2` (`#346`) | `3` | `Extra Strong` (`5`) + `Fire Enchanted` (`9`) | **Lightning Immune** (`ResLi=100`) + **Fire Immune** (`+75%` from FE -> `108%`) |
| **Travincal** | **Toorc Icefist** (`#29`) | `councilmember1` (`#345`) | `2` | `Cold Enchanted` (`18`) + `Stone Skin` (`28`) | **Fire Immune** (`ResFi=120`) + **Cold Immune** (`+75%` from CE -> `108%`) + **Physical Immune** (`+50%` from SS -> `100%`) |
| **Durance Lv 3** | **Bremm Sparkfist** (`#28`) | `councilmember3` (`#347`) | `4` | **`Aura Enchanted` (`30`)** + `Lightning Enchanted` (`17`) | **Lightning Immune** (`ResLi=100`) |
| **Durance Lv 3** | **Wyand Voidfinger** (`#30`) | `councilmember2` (`#346`) | `3` | `Mana Burn` (`25`) + `Teleport` (`26`) | **Lightning Immune** (`ResLi=100`) |
| **Durance Lv 3** | **Maffer Dragonhand** (`#31`) | `councilmember3` (`#347`) | `4` | `Extra Strong` (`5`) + `Extra Fast` (`6`) | **Lightning Immune** (`ResLi=100`) |

- **Innate Fire Damage Bonus (`MonProp.txt` `councilmember1..3`)**:
  - Nightmare: `extra-fire = +40%` (`STAT_PASSIVE_FIRE_MASTERY`)
  - Hell: `extra-fire = +100%` (`STAT_PASSIVE_FIRE_MASTERY`)
- **Bremm Sparkfist's `Aura Enchanted` (`MONUMOD_AURACHANT` #30 -> `MONSTERUNIQUE_UMod30_AuraEnchanted`)**:
  - Rolls one random Paladin aura at spawn (`Might`, `Holy Fire`, `Blessed Aim` #108 `SrvDoFunc=65` @ `0x6FCBA8D0`, `Holy Freeze` #114, `Conviction` #123, `Fanaticism` #122, or `Holy Shock` #118; `Thorns` and `Sanctuary` excluded) at level `mlvl / 4`..`mlvl / 2`.

#### AI Decision Tree: `AITHINK_Fn085_HighPriest` (`0x6FC39080`)
| AI Parameter | Column | `councilmember1` | `councilmember2` | `councilmember3` | Role in `0x6FC39080` |
|---|---|---|---|---|---|
| `HIGHPRIEST_AI_PARAM_APPROACH_CHANCE_PCT` | `aip1` | `75` | `60` | `65` | Chance to run toward player when engaging (`dwAiParam[0]==1`) |
| `HIGHPRIEST_AI_PARAM_HEAL_CHANCE_PCT` | `aip2` | `25 / 25 / 15` | `30 / 30 / 15` | `20 / 20 / 15` | Chance to cast `Skill2=ZakarumHeal` (#179) on wounded ally (`<75%` HP) |
| `HIGHPRIEST_AI_PARAM_SPELL_COOLDOWN_FRAMES` | `aip3` | `125 / 100 / 75` | `125 / 100 / 75` | `125 / 100 / 75` | Shared cooldown timer (`dwAiParam[1]`) after `ZakarumHeal` |
| `HIGHPRIEST_AI_PARAM_HYDRA_CHANCE_PCT` | `aip4` | `40 / 45 / 45` | `35 / 40 / 40` | `45 / 50 / 50` | Chance to cast `Skill1=Hydra` (#62) when `nTargetDistance < aip8` (`30`) |
| `HIGHPRIEST_AI_PARAM_LIGHTNING_RANGED_PCT` | `aip5` | `70 / 75 / 75` | `75 / 75 / 75` | `80 / 80 / 80` | Chance to fire `MissS1=highpriestlightning` (#343) at range `< 13` |
| `HIGHPRIEST_AI_PARAM_DISENGAGE_CHANCE_PCT` | `aip6` | `8` | `11` | `9` | When engaged (`dwAiParam[0]==1`), chance to flee and reset to caster state (`dwAiParam[0]=0`) |
| `HIGHPRIEST_AI_PARAM_LIGHTNING_MELEE_PCT` | `aip7` | `15` | `13` | `12` | When in melee (`bCombat`), chance to fire `MissS1=highpriestlightning` (#343) point-blank |
| `HIGHPRIEST_AI_PARAM_MAX_HYDRA_RANGE` | `aip8` | `30` | `30` | `30` | Maximum target distance for casting `Hydra` (#62) |

1. **Caster State (`dwAiParam[0] == 0`, not in melee)**:
   - **Priority 1 — `ZakarumHeal` (#179)**:
     - If `dwGameFrame > dwAiParam[1]` and `rand(100) < aip2`: scans all rooms within `50` subtiles (`nMaxDistance = 2500` squared in `AITHINK_TargetCallback_HighPriest`) for the nearest ally with `LifePercentage < 75%`.
     - If found: casts `Skill2 = ZakarumHeal` (#179, `SrvDoFunc=96` @ `0x6FCD3770`, heals `calc1 = 15 + 5*lvl`% to `calc2 = 50`% of target's MaxHP, `srvoverlay=receiving`, `castoverlay=healing`) and sets `dwAiParam[1] = dwGameFrame + aip3` (`125 / 100 / 75` frames).
   - **Priority 2 — `Hydra` (#62)**:
     - Else if `dwGameFrame > dwAiParam[1]`, `nTargetDistance < aip8` (`30`), and `rand(100) < aip4`: picks a random corner offset `(±5, ±5)` from `stru_6FD29444` around the target, casts `Skill1 = Hydra` (#62, `Sk1lvl=2/3/4`), and sets `dwAiParam[1] = dwGameFrame + 100`.
     - `SKILLS_SrvSt14_Hydra` (`0x6FC62AD0`) & `SKILLS_SrvDo144_Hydra` (`0x6FC63D40`) / `CltStFunc=17` (`0x6FB23C10`): spawns **3 Hydra head units** (`hydra1` #351, `hydra2` #352, `hydra3` #353) at offset triangle coordinates with lifetime `Param1 = 250` frames (`10` seconds). Each head runs `AITHINK_Fn086_Hydra` (`0x6FCC57E0`) and fires `HydraMissile` (#337 -> `hydra` #247 Firebolt, `Vel=16`, `Range=30`).
   - **Priority 3 — `highpriestlightning` (#343)**:
     - Else if `nTargetDistance < 13` (`Missiles[highpriestlightning].Range - 2 = 15 - 2`) and `rand(100) < aip5` (`70..80%`): executes `MONMODE_SKILL1` (`S1`), firing `MissS1 = highpriestlightning` (#343, `pSrvDoFunc=1`, `pCltDoFunc=1`, `Vel=20`, `Range=15`, `CelFile=HighPriestLightning`, `ltng` `8–30` `+12..14/lvl`).
   - **Priority 4 — Engage**:
     - Otherwise sets `dwAiParam[0] = 1` (transitions to melee engagement) and runs toward target (`MONMODE_RUN`, `Run=12`).
2. **Engaged State (`dwAiParam[0] == 1`)**:
   - In melee (`bCombat == 1`):
     - Rolls `aip7` (`15 / 13 / 12%`) to fire `MissS1 = highpriestlightning` (#343) point-blank;
     - Else rolls `aip6` (`8 / 11 / 9%`) to disengage (`dwAiParam[0] = 0`) and escape;
     - Else **90% chance** to execute melee `MONMODE_ATTACK1` (with `MonStats2.txt` dual-strike / melee damage).
   - Out of melee (`bCombat == 0`): rolls `aip6` to disengage to caster state (`dwAiParam[0] = 0`), else runs (`aip1`) toward target.

---

## 6. Cross-Cutting Implementation Invariants for Web Port Parity

1. **Sequence Frame Events (`MonSeq.txt`)**:
   - Monster skills with `anim = SQ` (`AndrialSpray`, `Nest`, `Quick Strike`, `Resurrect2`, `Bestow`, `UnHolyBolt`, `MagottUp`, `MagottDown`, `MagottLay`, `MaggotEgg`, `QueenDeath`, `Charge`, `Jab`, `Smite`) **do not use generic `AnimData.d2` trigger frames** — they execute `MonSeq.txt` frame-by-frame and fire `SkillSrvDoFunc` / `SkillCltDoFunc` **exclusively on rows where `event != 0`** (`event=1` melee/skill do, `event=2` missile/cast do, `event=4` summon/state do).
2. **Andariel's 9-Frame Sweep vs Single Poison Bolt**:
   - `AndrialSpray` (#164) fires **9 individual `andarielspray` (#32) bolts** across `seq_andarielspray` frames `4..12` via `byte_6FD296D0[dir8][step]`, whereas `AndyPoisonBolt` (#201) fires a **single faster `andypoisonbolt` (#203)** (`Vel=20`, `Range=50`, `ELen=800`) during her `A1` animation.
3. **Duriel's Unused `Charge` (#107) & Unresistable `Holy Freeze` (#114)**:
   - Never hardcode Duriel to cast `Charge` (#107): `MonStats.txt` sets `aip5 = 0` in all difficulties, so `AITHINK_Fn044_Duriel` (`0x6FCA9430`) never enters the `Charge` branch and instead runs at `Velocity=13`.
   - `Holy Freeze` (#114) applies `aurastat1..3` (`velocitypercent`, `attackrate`, `other_animrate`) directly via `-dm34`, bypassing `Cannot Be Frozen` and `ResCo`.
4. **Mephisto's "Moat Trick" `Blizzard` Trigger (`0x6FCA5B60`)**:
   - In `AITHINK_Fn050_Mephisto`, `Blizzard` (#59) is gated by `nDifficulty > 0` (Nightmare/Hell only) AND (`COLLISION_CheckAnyCollisionWithPattern(..., COLLIDE_MISSILE_BARRIER)` OR `nTargetDistance > 30`). Standing across the Durance of Hate moat (`COLLIDE_MISSILE_BARRIER`) or beyond `30` subtiles forces Mephisto to cast `Blizzard` on every spell volley tick.
5. **Coldworm's Hidden `MONUMOD_POISONFIELD` (#23)**:
   - Even though `SuperUniques.txt` only lists `Mod1=18` (Cold Enchanted) and `Mod2=8` (Magic Resistant) for Coldworm, `MonsterSpawn.cpp:945` unconditionally attaches `MONUMOD_POISONFIELD` (#23), causing her to emit 8 `queenpoisoncloud` (#321) bolts whenever damaged.

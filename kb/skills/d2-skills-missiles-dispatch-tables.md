# Diablo II v1.13c Skill & Missile Function Dispatch Tables & Universal Player Actions (`D2Client.dll` & `D2Game.dll`)

## 1. Binary Image Bases & Dispatch Table Virtual Addresses (v1.13c)

| Binary | ImageBase | Dispatch Table Symbol | Table VA (1.13c) | Table Size / Count Address | `Skills.txt` / `Missiles.txt` Column |
|---|---|---|---|---|---|
| `D2Client.dll` | `0x6FAB0000` | `g_apfnSkillCltStFunc` | `0x6FB8E928` | `70` (`0x46` @ `0x6FB8EA40`) | `Skills.txt` `cltstfunc` |
| `D2Client.dll` | `0x6FAB0000` | `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `97` (`0x61` @ `0x6FB8EBCC`) | `Skills.txt` `cltdofunc` |
| `D2Client.dll` | `0x6FAB0000` | `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `91` (`0x6FB8DA0C` end) | `Missiles.txt` `pCltDoFunc` |
| `D2Client.dll` | `0x6FAB0000` | `g_apfnMissileCltHitFunc` | `0x6FB8DA10` | `81` (`0..80`) | `Missiles.txt` `pCltHitFunc` |
| `D2Game.dll` | `0x6FC20000` | `gpSkillSrvStartFnTable` | `0x6FD27338` | `66` (`0..65` active) | `Skills.txt` `srvstfunc` |
| `D2Game.dll` | `0x6FC20000` | `gpSkillSrvDoFnTable` | `0x6FD274A8` | `153` (`0..152` active) | `Skills.txt` `srvdofunc` |
| `D2Game.dll` | `0x6FC20000` | `gMissileSrvDoFuncTable` | `0x6FD2D970` | `38` (`0..37` active) | `Missiles.txt` `pSrvDoFunc` |
| `D2Game.dll` | `0x6FC20000` | `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `65` (`0..64` active) | `Missiles.txt` `pSrvHitFunc` |
| `D2Game.dll` | `0x6FC20000` | `gpMissileSrvDmgFnTable` | `0x6FD2DB68` | `16` (`0..15` active) | `Missiles.txt` `pSrvDmgFunc` |

## 2. `D2Client.dll` Skill Client Start Functions (`g_apfnSkillCltStFunc` @ `0x6FB8E928`)

| Index | Slot VA | Function VA | Referencing `Skills.txt` Rows (`cltstfunc`) |
|---:|---|---|---|
| 1 | `0x6FB8E92C` | `0x6FB50EA0` | `Attack` (#0) |
| 2 | `0x6FB8E930` | `0x6FB50E70` | `Throw` (#2), `Left Hand Throw` (#4) |
| 3 | `0x6FB8E934` | `0x6FB51110` | `Unsummon` (#3) |
| 4 | `0x6FB8E938` | `0x6FB50730` | `Left Hand Swing` (#5) |
| 5 | `0x6FB8E93C` | `0x6FAF09B0` | `Psychic Hammer` (#253), `Dragon Flight` (#275) |
| 6 | `0x6FB8E940` | `0x6FAF06F0` | `Dragon Talon` (#255) |
| 7 | `0x6FB8E944` | `0x6FAF01A0` | `Cloak of Shadows` (#264) |
| 8 | `0x6FB8E948` | `0x6FAF0DE0` | `Blade Fury` (#266) |
| 9 | `0x6FB8E94C` | `0x6FAF0400` | `Dragon Tail` (#270) |
| 10 | `0x6FB8E950` | `0x6FAF0610` | *(unreferenced in 1.13c txt)* |
| 11 | `0x6FB8E954` | `0x6FAC4F30` | `Fire Arrow` (#7), `Cold Arrow` (#11), `Multiple Shot` (#12), `Poison Javelin` (#15), `Exploding Arrow` (#16), `Lightning Bolt` (#20), ... (+13 more) |
| 12 | `0x6FB8E958` | `0x6FAC4F10` | `Jab` (#10) |
| 13 | `0x6FB8E95C` | `0x6FAC5500` | `Strafe` (#26) |
| 14 | `0x6FB8E960` | `0x6FAC5350` | `Fend` (#30) |
| 15 | `0x6FB8E964` | `0x6FB240F0` | `Inferno` (#41), `Arctic Blast` (#230) |
| 16 | `0x6FB8E968` | `0x6FB23F30` | *(unreferenced in 1.13c txt)* |
| 17 | `0x6FB8E96C` | `0x6FB23C10` | `Hydra` (#62) |
| 18 | `0x6FB8E970` | `0x6FB785C0` | `Amplify Damage` (#66), `Dim Vision` (#71), `Weaken` (#72), `Iron Maiden` (#76), `Terror` (#77), `Confuse` (#81), ... (+7 more) |
| 19 | `0x6FB8E974` | `0x6FB78F50` | `Teeth` (#67), `Bone Spear` (#84) |
| 20 | `0x6FB8E978` | `0x6FB78410` | `Raise Skeleton` (#70), `Raise Skeletal Mage` (#80) |
| 21 | `0x6FB8E97C` | `0x6FB78330` | `Corpse Explosion` (#74), `Poison Explosion` (#83), `NihlathakCorpseExplosion` (#351) |
| 22 | `0x6FB8E980` | `0x6FB78510` | `Bone Wall` (#78), `Bone Prison` (#88) |
| 23 | `0x6FB8E984` | `0x6FB782A0` | `IronGolem` (#90) |
| 24 | `0x6FB8E988` | `0x6FB78620` | `Revive` (#95) |
| 25 | `0x6FB8E98C` | `0x6FADBF40` | `Charge` (#107), `SerpentCharge` (#352) |
| 26 | `0x6FB8E990` | `0x6FB76400` | `Find Potion` (#131), `Grim Ward` (#150) |
| 27 | `0x6FB8E994` | `0x6FB76290` | `Double Swing` (#133) |
| 28 | `0x6FB8E998` | `0x6FB76350` | `Find Item` (#142) |
| 29 | `0x6FB8E99C` | `0x6FB776C0` | `Leap` (#132) |
| 30 | `0x6FB8E9A0` | `0x6FB77550` | `Leap Attack` (#143) |
| 31 | `0x6FB8E9A4` | `0x6FB77370` | `Whirlwind` (#151) |
| 32 | `0x6FB8E9A8` | `0x6FB07200` | `MagottUp` (#161) |
| 33 | `0x6FB8E9AC` | `0x6FB06BB0` | `MagottDown` (#162) |
| 34 | `0x6FB8E9B0` | `0x6FB07120` | `AndrialSpray` (#164) |
| 35 | `0x6FB8E9B4` | `0x6FB07060` | `Swarm Move` (#166) |
| 36 | `0x6FB8E9B8` | `0x6FB06A60` | `Nest` (#167), `EvilHutSpawner` (#320) |
| 37 | `0x6FB8E9BC` | `0x6FB069C0` | `Submerge` (#176) |
| 38 | `0x6FB8E9C0` | `0x6FB069A0` | `Emerge` (#180), `Self-resurrect` (#293) |
| 39 | `0x6FB8E9C4` | `0x6FB07000` | `Resurrect` (#181), `Resurrect2` (#327) |
| 40 | `0x6FB8E9C8` | `0x6FB06930` | `DiabLight` (#193) |
| 41 | `0x6FB8E9CC` | `0x6FB066E0` | `DiabRun` (#198) |
| 42 | `0x6FB8E9D0` | `0x6FB06EE0` | `Mosquito` (#206) |
| 43 | `0x6FB8E9D4` | `0x6FB07800` | *(unreferenced in 1.13c txt)* |
| 44 | `0x6FB8E9D8` | `0x6FB07540` | `HellMeteor` (#213) |
| 45 | `0x6FB8E9DC` | `0x6FB79420` | `Wearwolf` (#223), `Wearbear` (#228), `Delerium Change` (#350) |
| 46 | `0x6FB8E9E0` | `0x6FB74FC0` | `Baal Taunt` (#284) |
| 47 | `0x6FB8E9E4` | `0x6FB752E0` | `Catapult Charged Ball` (#287), `Catapult Spike Ball` (#288), `CatapultBlizzard` (#303), `CatapultPlague` (#304), `CatapultMeteor` (#305) |
| 48 | `0x6FB8E9E8` | `0x6FB74550` | `Teleport 2` (#292), `Baal Teleport` (#329), `Imp Teleport` (#330), `Baal Clone Teleport` (#331) |
| 49 | `0x6FB8E9EC` | `0x6FB75C70` | `Vine Attack` (#294), `CorpseCycler` (#307), `VineCycler` (#325) |
| 50 | `0x6FB8E9F0` | `0x6FB74A20` | `mon death sentry` (#312) |
| 51 | `0x6FB8E9F4` | `0x6FB74990` | `fenris rage` (#314) |
| 52 | `0x6FB8E9F8` | `0x6FB74370` | `mon inferno sentry` (#311) |
| 53 | `0x6FB8E9FC` | `0x6FAC51B0` | `Zeal` (#106), `Fury` (#248) |

> **Note on `Skills.txt` row 285 (`Baal Corpse Explode`)**: `Skills.txt` specifies `cltstfunc = 82`, which exceeds `gnSkillCltStartFnTableCount = 70` (`0x46` at `0x6FB8EA40`); the client bounds-check skips `CltStFunc` and instead `CltDoFunc[82]` (`0x6FB745C0`) handles the visual effect when invoked via `cltdofunc`.

## 3. `D2Client.dll` Skill Client Do Functions (`g_apfnSkillCltDoFunc` @ `0x6FB8EA48`)

| Index | Slot VA | Function VA | Referencing `Skills.txt` Rows (`cltdofunc`) |
|---:|---|---|---|
| 1 | `0x6FB8EA4C` | `0x6FB52230` | `Attack` (#0), `Left Hand Swing` (#5) |
| 2 | `0x6FB8EA50` | `0x6FB52F60` | `Throw` (#2), `Left Hand Throw` (#4) |
| 3 | `0x6FB8EA54` | `0x6FAF0A40` | `Psychic Hammer` (#253) |
| 4 | `0x6FB8EA58` | `0x6FAF0670` | `Dragon Talon` (#255) |
| 5 | `0x6FB8EA5C` | `0x6FAF1890` | `Shock Field` (#256) |
| 6 | `0x6FB8EA60` | `0x6FAF13A0` | `Blade Fury` (#266) |
| 7 | `0x6FB8EA64` | `0x6FAF0910` | `Dragon Tail` (#270) |
| 8 | `0x6FB8EA68` | `0x6FAF1290` | `Mind Blast` (#273) |
| 9 | `0x6FB8EA6C` | `0x6FAF1780` | *(unreferenced in 1.13c txt)* |
| 10 | `0x6FB8EA70` | `0x6FAF07C0` | *(unreferenced in 1.13c txt)* |
| 11 | `0x6FB8EA74` | `0x6FAF1690` | *(unreferenced in 1.13c txt)* |
| 12 | `0x6FB8EA78` | `0x6FAF0B60` | *(unreferenced in 1.13c txt)* |
| 13 | `0x6FB8EA7C` | `0x6FAF0A70` | *(unreferenced in 1.13c txt)* |
| 14 | `0x6FB8EA80` | `0x6FAF0880` | *(unreferenced in 1.13c txt)* |
| 15 | `0x6FB8EA84` | `0x6FAF14F0` | *(unreferenced in 1.13c txt)* |
| 16 | `0x6FB8EA88` | `0x6FAC4F40` | `Jab` (#10) |
| 17 | `0x6FB8EA8C` | `0x6FAC5DA0` | `Multiple Shot` (#12), `Teeth` (#67), `PrimePoisonball` (#191), `Shock Wave` (#243) |
| 18 | `0x6FB8EA90` | `0x6FAC5C40` | `Guided Arrow` (#22), `Bone Spirit` (#93), `MonBoneSpirit` (#211) |
| 19 | `0x6FB8EA94` | `0x6FAC5AB0` | `Charged Strike` (#24) |
| 20 | `0x6FB8EA98` | `0x6FAC5820` | `Strafe` (#26) |
| 21 | `0x6FB8EA9C` | `0x6FAC4FD0` | `Fend` (#30), `Zeal` (#106), `Fury` (#248) |
| 22 | `0x6FB8EAA0` | `0x6FAC5660` | `Lightning Strike` (#34) |
| 23 | `0x6FB8EAA4` | `0x6FB24AC0` | `Charged Bolt` (#38), `PrimeBolt` (#186), `BoltSentry` (#306), `ImpBolt` (#322) |
| 24 | `0x6FB8EAA8` | `0x6FB24D50` | `Inferno` (#41), `Arctic Blast` (#230) |
| 25 | `0x6FB8EAAC` | `0x6FB23CB0` | `Frost Nova` (#44), `Nova` (#48), `Poison Nova` (#92), `Howl` (#130), `Shout` (#138), `Battle Cry` (#146), ... (+8 more) |
| 26 | `0x6FB8EAB0` | `0x6FB24770` | `Fire Wall` (#51), `VampireFirewall` (#170), `PrimeFirewall` (#188), `CountessFirewall` (#321) |
| 27 | `0x6FB8EAB4` | `0x6FB23E80` | `Chain Lightning` (#53) |
| 28 | `0x6FB8EAB8` | `0x6FB23DF0` | `Meteor` (#56), `Blizzard` (#59), `VampireMeteor` (#171), `MonBlizzard` (#205), `Eruption` (#234) |
| 29 | `0x6FB8EABC` | `0x6FB23D70` | `Frozen Orb` (#64) |
| 30 | `0x6FB8EAC0` | `0x6FB78B40` | `Amplify Damage` (#66), `Dim Vision` (#71), `Weaken` (#72), `Iron Maiden` (#76), `Terror` (#77), `Confuse` (#81), ... (+7 more) |
| 31 | `0x6FB8EAC4` | `0x6FB788A0` | `Raise Skeleton` (#70), `Raise Skeletal Mage` (#80) |
| 32 | `0x6FB8EAC8` | `0x6FB78FB0` | `Corpse Explosion` (#74), `NihlathakCorpseExplosion` (#351) |
| 33 | `0x6FB8EACC` | `0x6FB78C90` | `Poison Explosion` (#83) |
| 34 | `0x6FB8EAD0` | `0x6FADB530` | `Sacrifice` (#96) |
| 35 | `0x6FB8EAD4` | `0x6FADBE30` | `Blessed Hammer` (#112) |
| 36 | `0x6FB8EAD8` | `0x6FADBD20` | `Fist of the Heavens` (#121) |
| 37 | `0x6FB8EADC` | `0x6FADB6E0` | `Charge` (#107), `SerpentCharge` (#352) |
| 38 | `0x6FB8EAE0` | `0x6FB763A0` | `Find Potion` (#131) |
| 39 | `0x6FB8EAE4` | `0x6FB76940` | `Double Swing` (#133), `Frenzy` (#147) |
| 40 | `0x6FB8EAE8` | `0x6FB762E0` | `Find Item` (#142) |
| 41 | `0x6FB8EAEC` | `0x6FB77000` | `Grim Ward` (#150) |
| 42 | `0x6FB8EAF0` | `0x6FB771D0` | `Double Throw` (#140) |
| 43 | `0x6FB8EAF4` | `0x6FB76ED0` | `Leap` (#132) |
| 44 | `0x6FB8EAF8` | `0x6FB76D00` | `Leap Attack` (#143) |
| 45 | `0x6FB8EAFC` | `0x6FB764B0` | `Whirlwind` (#151) |
| 46 | `0x6FB8EB00` | `0x6FB06780` | `MaggotEgg` (#159) |
| 47 | `0x6FB8EB04` | `0x6FB06740` | `MagottDown` (#162) |
| 48 | `0x6FB8EB08` | `0x6FB073A0` | `AndrialSpray` (#164) |
| 49 | `0x6FB8EB0C` | `0x6FB06B20` | `Swarm Move` (#166) |
| 50 | `0x6FB8EB10` | `0x6FB069E0` | `Nest` (#167), `EvilHutSpawner` (#320) |
| 51 | `0x6FB8EB14` | `0x6FB085C0` | `GargoyleTrap` (#172) |
| 52 | `0x6FB8EB18` | `0x6FB06700` | `Submerge` (#176) |
| 53 | `0x6FB8EB1C` | `0x6FB084D0` | `FetishAura` (#177) |
| 54 | `0x6FB8EB20` | `0x6FB08C90` | `FetishInferno` (#178), `Baal Inferno` (#317), `MegademonInferno` (#319), `Horror Arctic Blast` (#323) |
| 55 | `0x6FB8EB24` | `0x6FB081F0` | `PrimePoisonNova` (#192) |
| 56 | `0x6FB8EB28` | `0x6FB08B80` | `DiabLight` (#193) |
| 57 | `0x6FB8EB2C` | `0x6FB08070` | `FingerMageSpider` (#196) |
| 58 | `0x6FB8EB30` | `0x6FB07F60` | `DiabWall` (#197) |
| 59 | `0x6FB8EB34` | `0x6FB06790` | `DiabRun` (#198) |
| 60 | `0x6FB8EB38` | `0x6FB07D50` | `DesertTurret` (#203) |
| 61 | `0x6FB8EB3C` | `0x6FB07BB0` | `ArcaneTower` (#204) |
| 62 | `0x6FB8EB40` | `0x6FB06C40` | `Mosquito` (#206) |
| 63 | `0x6FB8EB44` | `0x6FB08A70` | `RegurgitatorEat` (#214) |
| 64 | `0x6FB8EB48` | `0x6FB07860` | `QueenDeath` (#216) |
| 65 | `0x6FB8EB4C` | `0x6FB07A90` | *(unreferenced in 1.13c txt)* |
| 66 | `0x6FB8EB50` | `0x6FB08790` | `MissileSkill1` (#183), `HireableMissile` (#202), `RogueMissile` (#336) |
| 67 | `0x6FB8EB54` | `0x6FB79E30` | `Firestorm` (#225) |
| 68 | `0x6FB8EB58` | `0x6FB79D80` | `Twister` (#240) |
| 69 | `0x6FB8EB5C` | `0x6FB79CD0` | `Tornado` (#245) |
| 70 | `0x6FB8EB60` | `0x6FB75A80` | `Wake Of Destruction Sentry` (#281) |
| 71 | `0x6FB8EB64` | `0x6FB757D0` | `Imp Inferno` (#282) |
| 72 | `0x6FB8EB68` | `0x6FB75D20` | `Imp Fireball` (#283) |
| 73 | `0x6FB8EB6C` | `0x6FB744D0` | `Teleport 2` (#292), `Baal Teleport` (#329), `Baal Clone Teleport` (#331) |
| 74 | `0x6FB8EB70` | `0x6FB75050` | `Imp Teleport` (#330) |
| 75 | `0x6FB8EB74` | `0x6FB74830` | `Siege Beast Stomp` (#301) |
| 76 | `0x6FB8EB78` | `0x6FB74CE0` | `DeathMaul` (#308) |
| 77 | `0x6FB8EB7C` | `0x6FB75BA0` | `mon inferno sentry` (#311) |
| 78 | `0x6FB8EB80` | `0x6FB74B00` | `mon death sentry` (#312) |
| 79 | `0x6FB8EB84` | `0x6FB742B0` | `fenris rage` (#314) |
| 80 | `0x6FB8EB88` | `0x6FB75480` | *(unreferenced in 1.13c txt)* |
| 81 | `0x6FB8EB8C` | `0x6FB74C10` | `Baal Cold Missiles` (#318) |
| 82 | `0x6FB8EB90` | `0x6FB745C0` | *(unreferenced in 1.13c txt)* |
| 83 | `0x6FB8EB94` | `0x6FAF15A0` | *(unreferenced in 1.13c txt)* |
| 84 | `0x6FB8EB98` | `0x6FB24350` | `Thunder Storm` (#57) via `cltprgfunc1` (no `cltdofunc` row); the periodic strike, see `kb/skills/player/skills-sor-lightning.md` |
| 85 | `0x6FB8EB9C` | `0x6FB79000` | *(unreferenced in 1.13c txt)* |
| 86 | `0x6FB8EBA0` | `0x6FADBB50` | *(unreferenced in 1.13c txt)* |
| 87 | `0x6FB8EBA4` | `0x6FB24BE0` | *(unreferenced in 1.13c txt)* |
| 88 | `0x6FB8EBA8` | `0x6FB74960` | *(unreferenced in 1.13c txt)* |
| 89 | `0x6FB8EBAC` | `0x6FB750F0` | *(unreferenced in 1.13c txt)* |
| 90 | `0x6FB8EBB0` | `0x6FB79BE0` | *(unreferenced in 1.13c txt)* |
| 91 | `0x6FB8EBB4` | `0x6FB794E0` | *(unreferenced in 1.13c txt)* |
| 92 | `0x6FB8EBB8` | `0x6FB795F0` | *(unreferenced in 1.13c txt)* |
| 93 | `0x6FB8EBBC` | `0x6FB75670` | *(unreferenced in 1.13c txt)* |
| 94 | `0x6FB8EBC0` | `0x6FB08990` | `DoomKnightMissile` (#335) |
| 95 | `0x6FB8EBC4` | `0x6FB088B0` | `NecromageMissile` (#338) |
| 96 | `0x6FB8EBC8` | `0x6FB24610` | *(unreferenced in 1.13c txt)* |

## 4. `D2Client.dll` Missile Client Do Functions (`g_apfnMissileCltDoFunc` @ `0x6FB8D8A0`)

| Index | Slot VA | Function VA | Referencing `Missiles.txt` Rows (`pCltDoFunc`) |
|---:|---|---|---|
| 1 | `0x6FB8D8A4` | `0x6FB617C0` | `arrow` (#0), `javelin` (#1), `bighead1` (#2), `bighead2` (#3), `bighead3` (#4), `bighead4` (#5), ... (+505 more) |
| 2 | `0x6FB8D8A8` | `0x6FB63060` | `blood1` (#18), `blood2` (#19), `bigblood1` (#20), `bigblood2` (#21), `sand pile` (#76), `dirt pile` (#322) |
| 3 | `0x6FB8D8AC` | `0x6FB6BE60` | `poisonjav` (#38), `plaguejavelin` (#43), `trap poison ball right` (#245), `trap poison ball left` (#246), `viper_poisjav` (#648) |
| 4 | `0x6FB8D8B0` | `0x6FB6BE00` | `poisonjavcloud` (#39), `corpsepoisoncloud` (#155), `chillbloodcloud` (#156), `poisonexplosioncloud` (#217), `primepoisoncloud` (#220), `plaguejavcloud` (#221), ... (+8 more) |
| 5 | `0x6FB8D8B4` | `0x6FB62F90` | `blaze` (#67), `firewall` (#69), `firesmall` (#104), `firemedium` (#105), `vampirefirewall` (#131), `diabwall` (#180), ... (+13 more) |
| 6 | `0x6FB8D8B8` | `0x6FB692B0` | `firewallmaker` (#68), `vampirefirewallmaker` (#130), `firestormmaker` (#458), `countessfirewallmaker` (#653) |
| 7 | `0x6FB8D8BC` | `0x6FB62EB0` | `guidedarrow` (#86), `bonespirit` (#193), `monbonespirit` (#329) |
| 8 | `0x6FB8D8C0` | `0x6FB691C0` | `chainlightning` (#93), `lightningbolt` (#98), `bat lightning bolt` (#123), `monsterlight` (#170), `lightningstrike` (#232), `chainlightning2` (#267), ... (+10 more) |
| 9 | `0x6FB8D8C4` | `0x6FB68F00` | `meteorcenter` (#101), `vampiremeteorcenter` (#133), `royalstrikemeteorcenter` (#564) |
| 10 | `0x6FB8D8C8` | `0x6FB6BD40` | `monblizcenter` (#106) |
| 11 | `0x6FB8D8CC` | `0x6FB62DC0` | `corpseexplosion` (#115), `poisoncorpseexplosion` (#116), `monstercorpseexplode` (#117), `grimwardsmallstop` (#251), `grimwardmediumstop` (#254), `grimwardlargestop` (#257), ... (+10 more) |
| 12 | `0x6FB8D8D0` | `0x6FB62D00` | *(unreferenced in 1.13c txt)* |
| 13 | `0x6FB8D8D4` | `0x6FB6BC10` | `blizzardcenter` (#158) |
| 14 | `0x6FB8D8D8` | `0x6FB62A80` | *(unreferenced in 1.13c txt)* |
| 15 | `0x6FB8D8DC` | `0x6FB68BC0` | `fingermagespider` (#177) |
| 16 | `0x6FB8D8E0` | `0x6FB68AA0` | `diabwallmaker` (#179) |
| 17 | `0x6FB8D8E4` | `0x6FB6BB40` | `cursecenter` (#191), `mindblast center` (#576) |
| 18 | `0x6FB8D8E8` | `0x6FB68960` | `bonespear` (#192), `viper_bonespear` (#652) |
| 19 | `0x6FB8D8EC` | `0x6FB68840` | `frozenorb` (#260) |
| 20 | `0x6FB8D8F0` | `0x6FB629B0` | `frozenorbnova` (#262) |
| 21 | `0x6FB8D8F4` | `0x6FB686F0` | `brdeathcontrol` (#284) |
| 22 | `0x6FB8D8F8` | `0x6FB68550` | `brdeathlightningbolt` (#285) |
| 23 | `0x6FB8D8FC` | `0x6FB62980` | `denofevillight` (#287) |
| 24 | `0x6FB8D900` | `0x6FB6B8F0` | `cairnstones` (#288) |
| 25 | `0x6FB8D904` | `0x6FB683D0` | `towermist` (#291), `orbmist` (#368) |
| 26 | `0x6FB8D908` | `0x6FB6B780` | `mephistodeathcontrol` (#299) |
| 27 | `0x6FB8D90C` | `0x6FB68130` | `mephistofirewallmaker` (#300), `andyfirewallmaker` (#308) |
| 28 | `0x6FB8D910` | `0x6FB68010` | `mephistodonotdraw` (#306) |
| 29 | `0x6FB8D914` | `0x6FB6C210` | `andycontrol0` (#307) |
| 30 | `0x6FB8D918` | `0x6FB679F0` | `towerchestspawner` (#332) |
| 31 | `0x6FB8D91C` | `0x6FB64B80` | `horadricstaff` (#338) |
| 32 | `0x6FB8D920` | `0x6FB62340` | `radamentdeath` (#347) |
| 33 | `0x6FB8D924` | `0x6FB64760` | `taintedsuncontrol` (#350) |
| 34 | `0x6FB8D928` | `0x6FB61FC0` | `taintedsunball` (#352) |
| 35 | `0x6FB8D92C` | `0x6FB644A0` | `queendeathcenter` (#353) |
| 36 | `0x6FB8D930` | `0x6FB641F0` | `durieldeathcontrol` (#363) |
| 37 | `0x6FB8D934` | `0x6FB62500` | `diablo appears` (#372) |
| 38 | `0x6FB8D938` | `0x6FB6A7E0` | `hfcontrol` (#373) |
| 39 | `0x6FB8D93C` | `0x6FB62480` | `hffragment1` (#374), `hffragment2` (#375) |
| 40 | `0x6FB8D940` | `0x6FB6A880` | `hffragment3` (#376) |
| 41 | `0x6FB8D944` | `0x6FB624A0` | `hfspirit1` (#377) |
| 42 | `0x6FB8D948` | `0x6FB6A680` | `izual control` (#379) |
| 43 | `0x6FB8D94C` | `0x6FB62890` | `blade creeper` (#392), `catapultchargedball on` (#406), `catapult spike ball on` (#410), `catapult cold ball on` (#415), `catapult plague ball on` (#418), `catapult meteor ball on` (#421) |
| 44 | `0x6FB8D950` | `0x6FB62790` | `distraction` (#393) |
| 45 | `0x6FB8D954` | `0x6FB6B500` | `distraction fog` (#394) |
| 46 | `0x6FB8D958` | `0x6FB67880` | `lightingtrailingjavalin` (#431), `advlighttrailingjav` (#438) |
| 47 | `0x6FB8D95C` | `0x6FB6B470` | `moltenboulder` (#452) |
| 48 | `0x6FB8D960` | `0x6FB675C0` | `erruption center` (#461) |
| 49 | `0x6FB8D964` | `0x6FB62720` | `vines` (#471), `plague vines` (#474) |
| 50 | `0x6FB8D968` | `0x6FB6B2A0` | `volcano` (#479) |
| 51 | `0x6FB8D96C` | `0x6FB673E0` | `recycler delay` (#498), `vine recycler delay` (#540) |
| 52 | `0x6FB8D970` | `0x6FB672D0` | `wake of destruction maker` (#517), `baal cold maker` (#589) |
| 53 | `0x6FB8D974` | `0x6FB67220` | `tigerfury` (#520) |
| 54 | `0x6FB8D978` | `0x6FB69C10` | `anya center` (#528) |
| 55 | `0x6FB8D97C` | `0x6FB63860` | `ancient death center` (#541) |
| 56 | `0x6FB8D980` | `0x6FB670A0` | `baal taunt control` (#546) |
| 57 | `0x6FB8D984` | `0x6FB66F60` | `blade shield attachment` (#553) |
| 58 | `0x6FB8D988` | `0x6FB625D0` | `royalstrikechaosice` (#569) |
| 59 | `0x6FB8D98C` | `0x6FB61CC0` | `world stone chip 1` (#570), `world stone chip 2` (#571), `world stone chip 3` (#572), `world stone chip 4` (#573) |
| 60 | `0x6FB8D990` | `0x6FB61C00` | `hurricaneswoosh` (#581), `hurricanecart` (#582), `hurricanerock` (#583), `hurricanesack` (#584), `hurricanetree` (#585), `hurricanevase` (#586) |
| 61 | `0x6FB8D994` | `0x6FB6A600` | `overseercontrol` (#602) |
| 62 | `0x6FB8D998` | `0x6FB6A4A0` | `nehlithakcontrol` (#606) |
| 63 | `0x6FB8D99C` | `0x6FB61F20` | `nehlithakswoosh` (#607), `nehlithakdebris1` (#608), `nehlithakdebris2` (#609), `nehlithakdebris3` (#610), `nehlithakdebris4` (#611) |
| 64 | `0x6FB8D9A0` | `0x6FB69FF0` | `baalfx control` (#625) |
| 65 | `0x6FB8D9A4` | `0x6FB61D10` | `baalfx spirit 1` (#626), `baalfx spirit 2` (#627), `baalfx spirit 3` (#628), `baalfx spirit 4` (#629), `baalfx spirit 5` (#630) |
| 66 | `0x6FB8D9A8` | `0x6FB69EA0` | `worldstone shake` (#639) |
| 67 | `0x6FB8D9AC` | `0x6FB62BF0` | *(unreferenced in 1.13c txt)* |
| 68 | `0x6FB8D9B0` | `0x6FB677A0` | `sucfireball` (#441) |

## 5. `D2Client.dll` Missile Client Hit Functions (`g_apfnMissileCltHitFunc` @ `0x6FB8DA10`)

| Index | Slot VA | Function VA | Referencing `Missiles.txt` Rows (`pCltHitFunc`) |
|---:|---|---|---|
| 1 | `0x6FB8DA14` | `0x6FB6C1A0` | `explodingarrow` (#41), `fireball` (#62), `vampirefireball` (#129) |
| 2 | `0x6FB8DA18` | `0x6FB6B1B0` | `plaguejavelin` (#43), `rancidgasepotion` (#47), `chokinggaspoition` (#48), `stranglinggaspotion` (#49), `catapult plague ball` (#419), `plaguejavelin2` (#436) |
| 3 | `0x6FB8DA1C` | `0x6FB61100` | `oilpotion` (#44), `explosivepotion` (#45), `fulminatingpotion` (#46), `pantherpotorange` (#238) |
| 4 | `0x6FB8DA20` | `0x6FB65F00` | *(unreferenced in 1.13c txt)* |
| 9 | `0x6FB8DA34` | `0x6FB66990` | `holybolt` (#55), `fistoftheheavensbolt` (#234) |
| 10 | `0x6FB8DA38` | `0x6FB62570` | `chargedbolt` (#56), `nova` (#90), `lightninghit` (#99), `frostnova` (#119), `monsterlight` (#170), `diablight` (#172), ... (+17 more) |
| 12 | `0x6FB8DA40` | `0x6FB6B070` | `immolationarrow` (#85) |
| 13 | `0x6FB8DA44` | `0x6FB61350` | `guidedarrow` (#86), `bonespirit` (#193), `monbonespirit` (#329) |
| 14 | `0x6FB8DA48` | `0x6FB60870` | `freezingarrow` (#87), `glacialspike` (#96), `monglacialspike` (#271) |
| 16 | `0x6FB8DA50` | `0x6FB667D0` | `chainlightning` (#93), `lightningstrike` (#232), `chainlightning2` (#267) |
| 18 | `0x6FB8DA58` | `0x6FB66540` | `meteorcenter` (#101), `vampiremeteorcenter` (#133), `royalstrikemeteorcenter` (#564) |
| 19 | `0x6FB8DA5C` | `0x6FB61080` | `monbliz1` (#107), `monbliz2` (#108), `monbliz3` (#109), `monbliz4` (#110), `blizzard1` (#159), `blizzard2` (#160), ... (+5 more) |
| 24 | `0x6FB8DA70` | `0x6FB60800` | `bonespear` (#192), `viper_bonespear` (#652) |
| 25 | `0x6FB8DA74` | `0x6FB6AEF0` | `lightningfury` (#206) |
| 26 | `0x6FB8DA78` | `0x6FB6AD40` | `fistoftheheavensdelay` (#233) |
| 28 | `0x6FB8DA80` | `0x6FB6ACB0` | `pantherpotgreen` (#239) |
| 29 | `0x6FB8DA84` | `0x6FB66120` | `grimwardsmallstart` (#249), `grimwardsmall` (#250), `grimwardmediumstart` (#252), `grimwardmedium` (#253), `grimwardlargestart` (#255), `grimwardlarge` (#256) |
| 30 | `0x6FB8DA88` | `0x6FB66010` | `frozenorb` (#260) |
| 31 | `0x6FB8DA8C` | `0x6FB605B0` | `icebreaksmall` (#272), `icebreakmedium` (#273), `icebreaklarge` (#274), `catapult cold explosion` (#417) |
| 32 | `0x6FB8DA90` | `0x6FB6C0B0` | `firehead` (#277) |
| 33 | `0x6FB8DA94` | `0x6FB65DD0` | `mephistoflyingrocksbig` (#302) |
| 34 | `0x6FB8DA98` | `0x6FB607E0` | `mephistodonotdraw` (#306) |
| 36 | `0x6FB8DAA0` | `0x6FB6ABF0` | `hellmeteordown` (#336) |
| 37 | `0x6FB8DAA4` | `0x6FB649F0` | `radamenthandofgod` (#348) |
| 38 | `0x6FB8DAA8` | `0x6FB645D0` | `taintedsunflash` (#351) |
| 39 | `0x6FB8DAAC` | `0x6FB604D0` | `queendeathglob` (#354) |
| 40 | `0x6FB8DAB0` | `0x6FB60570` | `healingbolt` (#357) |
| 41 | `0x6FB8DAB4` | `0x6FB6BEE0` | `durieldeathrock` (#364) |
| 42 | `0x6FB8DAB8` | `0x6FB65300` | `hffragment1` (#374) |
| 43 | `0x6FB8DABC` | `0x6FB651C0` | `hffragment2` (#375) |
| 44 | `0x6FB8DAC0` | `0x6FB60740` | `bomb in air` (#385), `shock field in air` (#388), `catapult spike in air` (#412), `sentryspikeinair` (#496), `death mauler trail` (#503), `baalcorpseexplodeexpl` (#588) |
| 46 | `0x6FB8DAC8` | `0x6FB6AAC0` | `catapultchargedball` (#407) |
| 47 | `0x6FB8DACC` | `0x6FB6BFA0` | `catapult spike ball` (#411) |
| 48 | `0x6FB8DAD0` | `0x6FB60B70` | `catapult cold ball` (#416) |
| 50 | `0x6FB8DAD8` | `0x6FB6AA70` | `catapult meteor ball` (#422) |
| 51 | `0x6FB8DADC` | `0x6FB6A9A0` | `lightingtrailingjavalin` (#431), `advlighttrailingjav` (#438) |
| 52 | `0x6FB8DAE0` | `0x6FB6A8F0` | `moltenboulder` (#452) |
| 53 | `0x6FB8DAE4` | `0x6FB65A10` | `moltenboulderemerge` (#453) |
| 54 | `0x6FB8DAE8` | `0x6FB60EE0` | `vines trail` (#472), `plague vines trail` (#475) |
| 55 | `0x6FB8DAEC` | `0x6FB65930` | `volcano debris 2` (#481), `armageddonrock` (#578), `diablogeddonrock` (#671) |
| 56 | `0x6FB8DAF0` | `0x6FB65850` | `recycler vine` (#499) |
| 57 | `0x6FB8DAF4` | `0x6FB6BF30` | `baal spawn monsters` (#550) |
| 60 | `0x6FB8DB00` | `0x6FB65770` | `nihlithak1` (#603) |
| 61 | `0x6FB8DB04` | `0x6FB5FFE0` | `worldstone shake` (#639) |
| 62 | `0x6FB8DB08` | `0x6FB63720` | `baal taunt lightning control` (#654) |
| 63 | `0x6FB8DB0C` | `0x6FB69BB0` | `baal taunt poison control` (#655) |
| 64 | `0x6FB8DB10` | `0x6FB66AC0` | *(unreferenced in 1.13c txt)* |

## 6. `D2Game.dll` Skill Server Start Functions (`gpSkillSrvStartFnTable` @ `0x6FD27338`)

| Index | Slot VA | Function VA (1.13c) | Canonical Function Symbol | Referencing `Skills.txt` Rows (`srvstfunc`) |
|---:|---|---|---|---|
| 1 | `0x6FD2733C` | `0x6FCC1630` | `SKILLS_SrvSt01_Attack_LeftHandSwing` | `Attack` (#0), `Left Hand Swing` (#5) |
| 2 | `0x6FD27340` | `0x6FCC0E80` | `SKILLS_SrvSt02_Kick` | `Kick` (#1) |
| 3 | `0x6FD27344` | `0x6FCBFEF0` | `SKILLS_SrvSt03_Unsummon` | `Unsummon` (#3) |
| 4 | `0x6FD27348` | `0x6FC6C840` | `SKILLS_SrvSt04_Arrow_Bolt` | `Fire Arrow` (#7), `Cold Arrow` (#11), `Multiple Shot` (#12), `Poison Javelin` (#15), `Exploding Arrow` (#16), `Lightning Bolt` (#20), ... (+12 more) |
| 5 | `0x6FD2734C` | `0x6FC6C1C0` | `SKILLS_SrvSt05_Jab` | `Jab` (#10) |
| 6 | `0x6FD27350` | `0x6FC6C720` | `SKILLS_SrvSt06_PowerStrike_ChargedStrike` | `Power Strike` (#14), `Charged Strike` (#24), `MonPowerStrike` (#344), `MonIceSpear` (#347) |
| 7 | `0x6FD27354` | `0x6FC6CC50` | `SKILLS_SrvSt07_Impale` | `Impale` (#19) |
| 8 | `0x6FD27358` | `0x6FC6C870` | `SKILLS_SrvSt08_Strafe` | `Strafe` (#26) |
| 9 | `0x6FD2735C` | `0x6FC6C600` | `SKILLS_SrvSt09_Fend` | `Fend` (#30) |
| 10 | `0x6FD27360` | `0x6FC6C3A0` | `SKILLS_SrvSt10_LightningStrike` | `Lightning Strike` (#34) |
| 11 | `0x6FD27364` | `0x6FC64550` | `SKILLS_SrvSt11_Inferno_ArcticBlast` | `Inferno` (#41), `Arctic Blast` (#230) |
| 12 | `0x6FD27368` | `0x6FC62360` | `SKILLS_SrvSt12_Telekinesis_DragonFlight` | `Telekinesis` (#43), `Dragon Flight` (#275) |
| 13 | `0x6FD2736C` | `0x6FC62230` | `SKILLS_SrvSt13_ThunderStorm` | `Thunder Storm` (#57) |
| 14 | `0x6FD27370` | `0x6FC62AD0` | `SKILLS_SrvSt14_Hydra` | `Hydra` (#62) |
| 15 | `0x6FD27374` | `0x6FC6EF20` | `SKILLS_SrvSt15_RaiseSkeleton_Mage` | `Raise Skeleton` (#70), `Raise Skeletal Mage` (#80) |
| 16 | `0x6FD27378` | `0x6FC6F7D0` | `SKILLS_SrvSt16_PoisonDagger` | `Poison Dagger` (#73) |
| 17 | `0x6FD2737C` | `0x6FC6EEE0` | `SKILLS_SrvSt17_Poison_CorpseExplosion` | `Corpse Explosion` (#74), `Poison Explosion` (#83), `NihlathakCorpseExplosion` (#351) |
| 18 | `0x6FD27380` | `0x6FC6DFD0` | `SKILLS_SrvSt18_Attract` | `Attract` (#86) |
| 19 | `0x6FD27384` | `0x6FC6EE40` | `SKILLS_SrvSt19_BonePrison` | `Bone Prison` (#88) |
| 20 | `0x6FD27388` | `0x6FC6EDD0` | `SKILLS_SrvSt20_IronGolem` | `IronGolem` (#90) |
| 21 | `0x6FD2738C` | `0x6FC6ED60` | `SKILLS_SrvSt21_Revive` | `Revive` (#95) |
| 22 | `0x6FD27390` | `0x6FCB2060` | `SKILLS_SrvSt22_PsychicHammer` | `Psychic Hammer` (#253) |
| 23 | `0x6FD27394` | `0x6FCB2030` | `SKILLS_SrvSt23_AssasinChargeStrikes` | `Tiger Strike` (#254), `Fists of Fire` (#259), `Cobra Strike` (#265), `Claws of Thunder` (#269), `Blades of Ice` (#274), `Royal Strike` (#280) |
| 24 | `0x6FD27398` | `0x6FCB2DF0` | `SKILLS_SrvSt24_DragonTalon` | `Dragon Talon` (#255) |
| 25 | `0x6FD2739C` | `0x6FCB1B40` | `SKILLS_SrvSt25_64_DragonClaw_MonFrenzy` | `Dragon Claw` (#260) |
| 26 | `0x6FD273A0` | `0x6FCB5BC0` | `SKILLS_SrvSt26_BladeFury` | `Blade Fury` (#266) |
| 27 | `0x6FD273A4` | `0x6FCB2940` | `SKILLS_SrvSt27_DragonTail` | `Dragon Tail` (#270) |
| 28 | `0x6FD273A8` | `0x6FCB20C0` | `SKILLS_SrvSt28_BladeShield` | `Blade Shield` (#277) |
| 29 | `0x6FD273AC` | `0x6FCB8E90` | `SKILLS_SrvSt29_Sacrifice` | `Sacrifice` (#96) |
| 31 | `0x6FD273B4` | `0x6FCB9620` | `SKILLS_SrvSt31_Charge` | `Charge` (#107), `SerpentCharge` (#352) |
| 32 | `0x6FD273B8` | `0x6FC473C0` | `SKILLS_SrvSt32_Conversion_Bash_Stun_Concentrate_BearSmite` | `Conversion` (#116), `Bash` (#126), `Stun` (#139), `Concentrate` (#144), `BearSmite` (#326) |
| 33 | `0x6FD273BC` | `0x6FC47270` | `SKILLS_SrvSt33_FindPotion_GrimWard` | `Find Potion` (#131), `Grim Ward` (#150) |
| 34 | `0x6FD273C0` | `0x6FC47240` | `SKILLS_SrvSt34_FindItem` | `Find Item` (#142) |
| 35 | `0x6FD273C4` | `0x6FCB8BA0` | `SKILLS_SrvSt35_Vengeance` | `Vengeance` (#111) |
| 36 | `0x6FD273C8` | `0x6FCB8390` | `SKILLS_SrvSt36_HolyShield` | `Holy Shield` (#117) |
| 37 | `0x6FD273CC` | `0x6FC6C4F0` | `SKILLS_SrvSt37_Zeal_Fury_BloodLordFrenzy` | `Zeal` (#106), `Fury` (#248), `BloodLordFrenzy` (#328) |
| 38 | `0x6FD273D0` | `0x6FC48290` | `SKILLS_SrvSt38_Whirlwind` | `Whirlwind` (#151) |
| 39 | `0x6FD273D4` | `0x6FC489A0` | `SKILLS_SrvSt39_Berserk` | `Berserk` (#152) |
| 40 | `0x6FD273D8` | `0x6FC47F30` | `SKILLS_SrvSt40_Leap` | `Leap` (#132) |
| 41 | `0x6FD273DC` | `0x6FC48600` | `SKILLS_SrvSt41_LeapAttack` | `Leap Attack` (#143) |
| 42 | `0x6FD273E0` | `0x6FCD41B0` | `SKILLS_SrvSt42_FireHit` | `Fire Hit` (#156) |
| 43 | `0x6FD273E4` | `0x6FCD31B0` | `SKILLS_SrvSt43_MaggotEgg` | `MaggotEgg` (#159) |
| 44 | `0x6FD273E8` | `0x6FCD4760` | `SKILLS_SrvSt44_MaggotUp` | `MagottUp` (#161) |
| 45 | `0x6FD273EC` | `0x6FCD3120` | `SKILLS_SrvSt45_MaggotDown` | `MagottDown` (#162) |
| 46 | `0x6FD273F0` | `0x6FCD3930` | `SKILLS_SrvSt46_AndrialSpray` | `AndrialSpray` (#164) |
| 47 | `0x6FD273F4` | `0x6FCD6380` | `SKILLS_SrvSt47_Jump` | `Jump` (#165) |
| 48 | `0x6FD273F8` | `0x6FCD3890` | `SKILLS_SrvSt48_SwarmMove` | `Swarm Move` (#166) |
| 49 | `0x6FD273FC` | `0x6FCD5FB0` | `SKILLS_SrvSt49_Nest_EvilHutSpawner` | `Nest` (#167), `EvilHutSpawner` (#320) |
| 50 | `0x6FD27400` | `0x6FCD3EB0` | `SKILLS_SrvSt50_QuickStrike` | `Quick Strike` (#168) |
| 51 | `0x6FD27404` | `0x6FCD2FA0` | `SKILLS_SrvSt51_Submerge` | `Submerge` (#176) |
| 52 | `0x6FD27408` | `0x6FCD2F80` | `SKILLS_SrvSt52_Emerge` | `Emerge` (#180) |
| 53 | `0x6FD2740C` | `0x6FCD2ED0` | `SKILLS_SrvSt53_MonInferno` | `FetishInferno` (#178), `DiabLight` (#193), `mon inferno sentry` (#311), `Baal Inferno` (#317), `MegademonInferno` (#319), `Horror Arctic Blast` (#323) |
| 54 | `0x6FD27410` | `0x6FCD36A0` | `SKILLS_SrvSt54_DiabRun` | `DiabRun` (#198) |
| 55 | `0x6FD27414` | `0x6FCD35A0` | `SKILLS_SrvSt55_Mosquito` | `Mosquito` (#206) |
| 56 | `0x6FD27418` | `0x6FC64D70` | `SKILLS_SrvSt56_FeralRage_Maul` | `Feral Rage` (#232), `Maul` (#233) |
| 57 | `0x6FD2741C` | `0x6FC64C20` | `SKILLS_SrvSt57_Rabies` | `Rabies` (#238) |
| 58 | `0x6FD27420` | `0x6FC64ED0` | `SKILLS_SrvSt58_FireClaws` | `Fire Claws` (#239) |
| 59 | `0x6FD27424` | `0x6FC2BEE0` | `SKILLS_SrvSt59_ImpInferno` | `Imp Inferno` (#282) |
| 60 | `0x6FD27428` | `0x6FC2C760` | `SKILLS_SrvSt60_SuckBlood` | `Suck Blood` (#289) |
| 61 | `0x6FD2742C` | `0x6FC2C1B0` | `SKILLS_SrvSt61_SelfResurrect` | `Self-resurrect` (#293) |
| 62 | `0x6FD27430` | `0x6FC2BF90` | `SKILLS_SrvSt62_MinionSpawner` | `MinionSpawner` (#302) |
| 63 | `0x6FD27434` | `0x6FC2D170` | `SKILLS_SrvSt63_Corpse_VineCycler` | `CorpseCycler` (#307), `VineCycler` (#325) |
| 64 | `0x6FD27438` | `0x6FCD3570` | `SKILLS_SrvSt25_64_DragonClaw_MonFrenzy` | `MonFrenzy` (#215) |
| 65 | `0x6FD2743C` | `0x6FCC1600` | `SKILLS_SrvSt65_Throw_LeftHandThrow` | `Throw` (#2), `Left Hand Throw` (#4) |

## 7. `D2Game.dll` Skill Server Do Functions (`gpSkillSrvDoFnTable` @ `0x6FD274A8`)

| Index | Slot VA | Function VA (1.13c) | Canonical Function Symbol | Referencing `Skills.txt` Rows (`srvdofunc`) |
|---:|---|---|---|---|
| 1 | `0x6FD274AC` | `0x6FCC2C40` | `SKILLS_SrvDo001_Attack_LeftHandSwing` | `Attack` (#0), `Left Hand Swing` (#5) |
| 2 | `0x6FD274B0` | `0x6FCC3220` | `SKILLS_SrvDo002_Kick_PowerStrike_MonIceSpear_Impale_Bash_Stun_Concentrate_BearSmite_Vengeance_Berserk_FireClaws` | `Kick` (#1), `Power Strike` (#14), `Impale` (#19), `Vengeance` (#111), `Bash` (#126), `Stun` (#139), ... (+6 more) |
| 3 | `0x6FD274B4` | `0x6FCC2B40` | `SKILLS_SrvDo003_Throw` | `Throw` (#2) |
| 4 | `0x6FD274B8` | `0x6FCC2EA0` | `SKILLS_SrvDo004_Unsummon` | `Unsummon` (#3) |
| 5 | `0x6FD274BC` | `0x6FCC2A40` | `SKILLS_SrvDo005_LeftHandThrow` | `Left Hand Throw` (#4) |
| 6 | `0x6FD274C0` | `0x6FC6C2A0` | `SKILLS_SrvDo006_InnerSight_SlowMissiles` | `Inner Sight` (#8), `Slow Missiles` (#17) |
| 7 | `0x6FD274C4` | `0x6FC6CB00` | `SKILLS_SrvDo007_Jab` | `Jab` (#10) |
| 8 | `0x6FD274C8` | `0x6FC6D420` | `SKILLS_SrvDo008_MultipleShot_Teeth_ShockWave` | `Multiple Shot` (#12), `Teeth` (#67), `PrimePoisonball` (#191), `Shock Wave` (#243) |
| 9 | `0x6FD274CC` | `0x6FC49600` | `SKILLS_SrvDo009_Frenzy` | `Frenzy` (#147) |
| 10 | `0x6FD274D0` | `0x6FC6D270` | `SKILLS_SrvDo010_GuidedArrow_BoneSpirit` | `Guided Arrow` (#22), `Bone Spirit` (#93), `MonBoneSpirit` (#211) |
| 11 | `0x6FD274D4` | `0x6FC6D040` | `SKILLS_SrvDo011_ChargedStrike` | `Charged Strike` (#24) |
| 12 | `0x6FD274D8` | `0x6FC6DCD0` | `SKILLS_SrvDo012_Strafe` | `Strafe` (#26) |
| 13 | `0x6FD274DC` | `0x6FC6DAC0` | `SKILLS_SrvDo013_Fend_Zeal_Fury` | `Fend` (#30), `Zeal` (#106), `Fury` (#248) |
| 14 | `0x6FD274E0` | `0x6FC6CE10` | `SKILLS_SrvDo014_LightningStrike` | `Lightning Strike` (#34) |
| 15 | `0x6FD274E4` | `0x6FC6D8C0` | `SKILLS_SrvDo015_Dopplezon` | `Dopplezon` (#28) |
| 16 | `0x6FD274E8` | `0x6FC6D710` | `SKILLS_SrvDo016_Valkyrie` | `Valkyrie` (#32) |
| 17 | `0x6FD274EC` | `0x6FC63B60` | `SKILLS_SrvDo017_ChargedBolt_BoltSentry` | `Charged Bolt` (#38), `PrimeBolt` (#186), `BoltSentry` (#306), `ImpBolt` (#322) |
| 18 | `0x6FD274F0` | `0x6FC628F0` | `SKILLS_SrvDo018_DefensiveBuff` | `Frozen Armor` (#40), `Shiver Armor` (#50), `Chilling Armor` (#60), `Bone Armor` (#68), `Holy Shield` (#117), `MonFrozenArmor` (#209), ... (+5 more) |
| 19 | `0x6FD274F4` | `0x6FC64390` | `SKILLS_SrvDo019_Inferno_ArcticBlast` | `Inferno` (#41), `Arctic Blast` (#230) |
| 20 | `0x6FD274F8` | `0x6FC630D0` | `SKILLS_SrvDo020_StaticField` | `Static Field` (#42) |
| 21 | `0x6FD274FC` | `0x6FC631C0` | `SKILLS_SrvDo021_Telekinesis` | `Telekinesis` (#43) |
| 22 | `0x6FD27500` | `0x6FC63AA0` | `SKILLS_SrvDo022_NovaAttack` | `Frost Nova` (#44), `Nova` (#48), `Poison Nova` (#92), `Howl` (#130), `PrimeIceNova` (#190), `DiabFire` (#195), ... (+3 more) |
| 23 | `0x6FD27504` | `0x6FC62730` | `SKILLS_SrvDo023_Blaze_EnergyShield_SpiderLay` | `Blaze` (#46), `Energy Shield` (#58), `SpiderLay` (#173), `PrimeBlaze` (#187) |
| 24 | `0x6FD27508` | `0x6FC637D0` | `SKILLS_SrvDo024_FireWall` | `Fire Wall` (#51), `VampireFirewall` (#170), `PrimeFirewall` (#188), `CountessFirewall` (#321) |
| 25 | `0x6FD2750C` | `0x6FC62570` | `SKILLS_SrvDo025_Enchant` | `Enchant` (#52) |
| 26 | `0x6FD27510` | `0x6FC63720` | `SKILLS_SrvDo026_ChainLightning` | `Chain Lightning` (#53) |
| 27 | `0x6FD27514` | `0x6FC63450` | `SKILLS_SrvDo027_Teleport` | `Teleport` (#54) |
| 28 | `0x6FD27518` | `0x6FC62D90` | `SKILLS_SrvDo028_Meteor_Blizzard_Eruption_BaalTaunt_Catapult` | `Meteor` (#56), `Blizzard` (#59), `VampireMeteor` (#171), `MonBlizzard` (#205), `HellMeteor` (#213), `Eruption` (#234), ... (+6 more) |
| 29 | `0x6FD2751C` | `0x6FC63FA0` | `SKILLS_SrvDo029_ThunderStorm` | `Thunder Storm` (#57) |
| 30 | `0x6FD27520` | `0x6FC705D0` | `SKILLS_SrvDo030_Curse` | `Amplify Damage` (#66), `Dim Vision` (#71), `Weaken` (#72), `Iron Maiden` (#76), `Terror` (#77), `Life Tap` (#82), ... (+4 more) |
| 31 | `0x6FD27524` | `0x6FC718B0` | `SKILLS_SrvDo031_RaiseSkeleton_Mage` | `Raise Skeleton` (#70), `Raise Skeletal Mage` (#80) |
| 32 | `0x6FD27528` | `0x6FC6F920` | `SKILLS_SrvDo032_PoisonDagger` | `Poison Dagger` (#73) |
| 33 | `0x6FD2752C` | `0x6FCB2770` | `SKILLS_SrvDo033_PsychicHammer` | `Psychic Hammer` (#253) |
| 34 | `0x6FD27530` | `0x6FCB5690` | `SKILLS_SrvDo034_TigerStrike_CobraStrike_RoyalStrike` | `Tiger Strike` (#254), `Cobra Strike` (#265), `Royal Strike` (#280) |
| 35 | `0x6FD27534` | `0x6FCB61A0` | `SKILLS_SrvDo035_FistsOfFire_ClawsOfThunder_BladesOfIce` | `Fists of Fire` (#259), `Claws of Thunder` (#269), `Blades of Ice` (#274) |
| 36 | `0x6FD27538` | `0x6FCB5040` | `SKILLS_SrvDo036_ClawsOfThunder_ProgressiveFn2` | *(unreferenced in 1.13c txt)* |
| 37 | `0x6FD2753C` | `0x6FCB4F50` | `SKILLS_SrvDo037_ClawsOfThunder_ProgressiveFn3` | *(unreferenced in 1.13c txt)* |
| 38 | `0x6FD27540` | `0x6FCB3340` | `SKILLS_SrvDo038_FistsOfFire_BladesOfIce_ProgressiveFn2` | *(unreferenced in 1.13c txt)* |
| 39 | `0x6FD27544` | `0x6FCB4970` | `SKILLS_SrvDo039_FistsOfFire_BladesOfIce_ProgressiveFn3` | *(unreferenced in 1.13c txt)* |
| 40 | `0x6FD27548` | `0x6FCB2230` | `SKILLS_SrvDo040_RoyalStrike_ProgressiveFn1` | *(unreferenced in 1.13c txt)* |
| 41 | `0x6FD2754C` | `0x6FCB3BC0` | `SKILLS_SrvDo041_RoyalStrike_ProgressiveFn3` | *(unreferenced in 1.13c txt)* |
| 42 | `0x6FD27550` | `0x6FCB5FE0` | `SKILLS_SrvDo042_DragonTalon` | `Dragon Talon` (#255) |
| 43 | `0x6FD27554` | `0x6FCB4DC0` | `SKILLS_SrvDo043_ShockField` | `Shock Field` (#256) |
| 44 | `0x6FD27558` | `0x6FCB6310` | `SKILLS_SrvDo044_BladeSentinel` | `Blade Sentinel` (#257) |
| 45 | `0x6FD2755C` | `0x6FCB6280` | `SKILLS_SrvDo045_Sentry` | `Charged Bolt Sentry` (#261), `Wake of Fire Sentry` (#262), `Lightning Sentry` (#271), `Inferno Sentry` (#272), `Death Sentry` (#276) |
| 46 | `0x6FD27560` | `0x6FCB3270` | `SKILLS_SrvDo046_DragonClaw` | `Dragon Claw` (#260) |
| 47 | `0x6FD27564` | `0x6FCB4B10` | `SKILLS_SrvDo047_CloakOfShadows` | `Cloak of Shadows` (#264) |
| 48 | `0x6FD27568` | `0x6FCB5560` | `SKILLS_SrvDo048_BladeFury` | `Blade Fury` (#266) |
| 49 | `0x6FD2756C` | `0x6FCB5980` | `SKILLS_SrvDo049_ShadowWarrior_Master` | `Shadow Warrior` (#268), `Shadow Master` (#279) |
| 50 | `0x6FD27570` | `0x6FCB3110` | `SKILLS_SrvDo050_DragonTail` | `Dragon Tail` (#270) |
| 51 | `0x6FD27574` | `0x6FCB57F0` | `SKILLS_SrvDo051_MindBlast` | `Mind Blast` (#273) |
| 52 | `0x6FD27578` | `0x6FCB3680` | `SKILLS_SrvDo052_DragonFlight` | `Dragon Flight` (#275) |
| 53 | `0x6FD2757C` | `0x6FCB2CF0` | `SKILLS_SrvDo053_Unused` | *(unreferenced in 1.13c txt)* |
| 54 | `0x6FD27580` | `0x6FCB35F0` | `SKILLS_SrvDo054_BladeShield` | `Blade Shield` (#277) |
| 55 | `0x6FD27584` | `0x6FC6F4D0` | `SKILLS_SrvDo055_CorpseExplosion` | `Corpse Explosion` (#74), `mon death sentry` (#312), `NihlathakCorpseExplosion` (#351) |
| 56 | `0x6FD27588` | `0x6FC71750` | `SKILLS_SrvDo056_Golem` | `Clay Golem` (#75), `BloodGolem` (#85), `FireGolem` (#94) |
| 57 | `0x6FD2758C` | `0x6FC71540` | `SKILLS_SrvDo057_IronGolem` | `IronGolem` (#90) |
| 58 | `0x6FD27590` | `0x6FC71340` | `SKILLS_SrvDo058_Revive` | `Revive` (#95) |
| 59 | `0x6FD27594` | `0x6FC71C60` | `SKILLS_SrvDo059_Attract` | `Attract` (#86) |
| 60 | `0x6FD27598` | `0x6FC70FE0` | `SKILLS_SrvDo060_BoneWall` | `Bone Wall` (#78) |
| 61 | `0x6FD2759C` | `0x6FC71A90` | `SKILLS_SrvDo061_Confuse` | `Confuse` (#81) |
| 62 | `0x6FD275A0` | `0x6FC71E70` | `SKILLS_SrvDo062_BonePrison` | `Bone Prison` (#88) |
| 63 | `0x6FD275A4` | `0x6FC70190` | `SKILLS_SrvDo063_PoisonExplosion` | `Poison Explosion` (#83) |
| 64 | `0x6FD275A8` | `0x6FCB9290` | `SKILLS_SrvDo064_Sacrifice` | `Sacrifice` (#96) |
| 65 | `0x6FD275AC` | `0x6FCBA8D0` | `SKILLS_SrvDo065_BasicAura` | `Might` (#98), `Prayer` (#99), `Resist Fire` (#100), `Thorns` (#103), `Defiance` (#104), `Resist Cold` (#105), ... (+11 more) |
| 66 | `0x6FD275B0` | `0x6FCBAF50` | `SKILLS_SrvDo066_HolyFire_HolyShock_Sanctuary_Conviction` | `Holy Fire` (#102), `Holy Shock` (#118), `Sanctuary` (#119), `Conviction` (#123) |
| 67 | `0x6FD275B4` | `0x6FCB9D20` | `SKILLS_SrvDo067_Charge` | `Charge` (#107), `SerpentCharge` (#352) |
| 68 | `0x6FD275B8` | `0x6FC49720` | `SKILLS_SrvDo068_BasicShout` | `Shout` (#138), `Battle Cry` (#146), `Battle Orders` (#149), `War Cry` (#154), `Battle Command` (#155) |
| 69 | `0x6FD275BC` | `0x6FC47600` | `SKILLS_SrvDo069_FindPotion` | `Find Potion` (#131) |
| 70 | `0x6FD275C0` | `0x6FC47B90` | `SKILLS_SrvDo070_DoubleSwing` | `Double Swing` (#133) |
| 71 | `0x6FD275C4` | `0x6FC49000` | `SKILLS_SrvDo071_Taunt` | `Taunt` (#137) |
| 72 | `0x6FD275C8` | `0x6FC476D0` | `SKILLS_SrvDo072_FindItem` | `Find Item` (#142) |
| 73 | `0x6FD275CC` | `0x6FCB94C0` | `SKILLS_SrvDo073_BlessedHammer` | `Blessed Hammer` (#112) |
| 74 | `0x6FD275D0` | `0x6FC47E30` | `SKILLS_SrvDo074_DoubleThrow` | `Double Throw` (#140) |
| 75 | `0x6FD275D4` | `0x6FC47C90` | `SKILLS_SrvDo075_GrimWard` | `Grim Ward` (#150) |
| 76 | `0x6FD275D8` | `0x6FC48BE0` | `SKILLS_SrvDo076_Whirlwind` | `Whirlwind` (#151) |
| 77 | `0x6FD275DC` | `0x6FC494A0` | `SKILLS_SrvDo077_Leap` | `Leap` (#132) |
| 78 | `0x6FD275E0` | `0x6FC493B0` | `SKILLS_SrvDo078_LeapAttack` | `Leap Attack` (#143) |
| 79 | `0x6FD275E4` | `0x6FCB9830` | `SKILLS_SrvDo079_Conversion` | `Conversion` (#116) |
| 80 | `0x6FD275E8` | `0x6FCB93A0` | `SKILLS_SrvDo080_FistOfTheHeavens` | `Fist of the Heavens` (#121) |
| 81 | `0x6FD275EC` | `0x6FCBABC0` | `SKILLS_SrvDo081_HolyFreeze` | `Holy Freeze` (#114) |
| 82 | `0x6FD275F0` | `0x6FCBA400` | `SKILLS_SrvDo082_Redemption` | `Redemption` (#124) |
| 83 | `0x6FD275F4` | `0x6FCD4660` | `SKILLS_SrvDo083_FireHit` | `Fire Hit` (#156) |
| 84 | `0x6FD275F8` | `0x6FCD65E0` | `SKILLS_SrvDo084_MaggotEgg` | `MaggotEgg` (#159) |
| 85 | `0x6FD275FC` | `0x6FCD58A0` | `SKILLS_SrvDo085_UnholyBolt_ShamanFire` | `UnHolyBolt` (#157), `ShamanFire` (#160) |
| 86 | `0x6FD27600` | `0x6FCD3060` | `SKILLS_SrvDo086_MaggotDown` | `MagottDown` (#162) |
| 87 | `0x6FD27604` | `0x6FCD42D0` | `SKILLS_SrvDo087_MaggotLay` | `MagottLay` (#163) |
| 88 | `0x6FD27608` | `0x6FCD56C0` | `SKILLS_SrvDo088_AndrialSpray` | `AndrialSpray` (#164) |
| 89 | `0x6FD2760C` | `0x6FCD60C0` | `SKILLS_SrvDo089_Jump` | `Jump` (#165) |
| 90 | `0x6FD27610` | `0x6FCD2FC0` | `SKILLS_SrvDo090_SwarmMove` | `Swarm Move` (#166) |
| 91 | `0x6FD27614` | `0x6FCD5E50` | `SKILLS_SrvDo091_Nest_EvilHutSpawner` | `Nest` (#167), `EvilHutSpawner` (#320) |
| 92 | `0x6FD27618` | `0x6FCD5600` | `SKILLS_SrvDo092_QuickStrike` | `Quick Strike` (#168) |
| 93 | `0x6FD2761C` | `0x6FCD5450` | `SKILLS_SrvDo093_GargoyleTrap` | `GargoyleTrap` (#172) |
| 94 | `0x6FD27620` | `0x6FCD2E90` | `SKILLS_SrvDo094_Submerge` | `Submerge` (#176) |
| 95 | `0x6FD27624` | `0x6FCD6A60` | `SKILLS_SrvDo095_MonInferno` | `FetishInferno` (#178), `mon inferno sentry` (#311), `Baal Inferno` (#317), `MegademonInferno` (#319), `Horror Arctic Blast` (#323) |
| 96 | `0x6FD27628` | `0x6FCD3770` | `SKILLS_SrvDo096_ZakarumHeal_Bestow` | `ZakarumHeal` (#179), `Bestow` (#182) |
| 97 | `0x6FD2762C` | `0x6FCD5BD0` | `SKILLS_SrvDo097_Resurrect` | `Resurrect` (#181), `Resurrect2` (#327) |
| 98 | `0x6FD27630` | `0x6FCD46B0` | `SKILLS_SrvDo098_MonTeleport` | `MonTeleport` (#184), `Teleport 2` (#292), `Baal Teleport` (#329), `Baal Clone Teleport` (#331) |
| 99 | `0x6FD27634` | `0x6FCD52A0` | `SKILLS_SrvDo099_PrimePoisonNova` | `PrimePoisonNova` (#192) |
| 100 | `0x6FD27638` | `0x6FCD3D60` | `SKILLS_SrvDo100_DiabCold` | `DiabCold` (#194) |
| 101 | `0x6FD2763C` | `0x6FCD5110` | `SKILLS_SrvDo101_FingerMageSpider` | `FingerMageSpider` (#196) |
| 102 | `0x6FD27640` | `0x6FCD4FF0` | `SKILLS_SrvDo102_DiabWall` | `DiabWall` (#197) |
| 103 | `0x6FD27644` | `0x6FCD3F10` | `SKILLS_SrvDo103_DiabRun` | `DiabRun` (#198) |
| 104 | `0x6FD27648` | `0x6FCD4410` | `SKILLS_SrvDo104_DiabPrison` | `DiabPrison` (#199) |
| 105 | `0x6FD2764C` | `0x6FCD4DE0` | `SKILLS_SrvDo105_DesertTurret` | `DesertTurret` (#203) |
| 106 | `0x6FD27650` | `0x6FCD4D30` | `SKILLS_SrvDo106_ArcaneTower` | `ArcaneTower` (#204) |
| 107 | `0x6FD27654` | `0x6FCD3B20` | `SKILLS_SrvDo107_Mosquito` | `Mosquito` (#206) |
| 108 | `0x6FD27658` | `0x6FCD5D40` | `SKILLS_SrvDo108_RegurgitatorEat` | `RegurgitatorEat` (#214) |
| 109 | `0x6FD2765C` | `0x6FCD6790` | `SKILLS_SrvDo109_MonFrenzy` | `MonFrenzy` (#215), `BloodLordFrenzy` (#328) |
| 110 | `0x6FD27660` | `0x6FCD49F0` | `SKILLS_SrvDo110_Hireable_RogueMissile` | `MissileSkill1` (#183), `HireableMissile` (#202), `RogueMissile` (#336) |
| 111 | `0x6FD27664` | `0x6FCD39F0` | `SKILLS_SrvDo111_FetishAura` | `FetishAura` (#177) |
| 112 | `0x6FD27668` | `0x6FCD5950` | `SKILLS_SrvDo112_MonCurseCast` | `MonCurseCast` (#212) |
| 113 | `0x6FD2766C` | `0x6FCCDFA0` | `SKILLS_SrvDo113_Scroll_Book` | `Scroll of Identify` (#217), `Book of Identify` (#218), `Scroll of Townportal` (#219), `Book of Townportal` (#220) |
| 114 | `0x6FD27670` | `0x6FC668A0` | `SKILLS_SrvDo114_Raven` | `Raven` (#221) |
| 115 | `0x6FD27674` | `0x6FC66720` | `SKILLS_SrvDo115_Vines` | `Plague Poppy` (#222), `Cycle of Life` (#231), `Vines` (#241) |
| 116 | `0x6FD27678` | `0x6FC66210` | `SKILLS_SrvDo116_Wearwolf_Wearbear` | `Wearwolf` (#223), `Wearbear` (#228), `Delerium Change` (#350) |
| 117 | `0x6FD2767C` | `0x6FC656B0` | `SKILLS_SrvDo117_Firestorm` | `Firestorm` (#225) |
| 118 | `0x6FD27680` | `0x6FC65600` | `SKILLS_SrvDo118_Twister_Tornado` | `Twister` (#240), `Tornado` (#245) |
| 119 | `0x6FD27684` | `0x6FC66560` | `SKILLS_SrvDo119_DruidSummon` | `Oak Sage` (#226), `Summon Spirit Wolf` (#227), `Heart of Wolverine` (#236), `Summon Fenris` (#237), `Spirit of Barbs` (#246), `Summon Grizzly` (#247) |
| 120 | `0x6FD27688` | `0x6FC66000` | `SKILLS_SrvDo120_FeralRage_Maul` | `Feral Rage` (#232), `Maul` (#233) |
| 121 | `0x6FD2768C` | `0x6FC66A20` | `SKILLS_SrvDo121_Rabies` | `Rabies` (#238) |
| 122 | `0x6FD27690` | `0x6FC65000` | `SKILLS_SrvDo122_Hunger` | `Hunger` (#242) |
| 123 | `0x6FD27694` | `0x6FC652C0` | `SKILLS_SrvDo123_Volcano` | `Volcano` (#244) |
| 124 | `0x6FD27698` | `0x6FC65CE0` | `SKILLS_SrvDo124_Armageddon_Hurricane` | `Armageddon` (#249), `Hurricane` (#250), `Diablogeddon` (#349) |
| 125 | `0x6FD2769C` | `0x6FC2D680` | `SKILLS_SrvDo125_WakeOfDestruction` | `Wake Of Destruction Sentry` (#281) |
| 126 | `0x6FD276A0` | `0x6FC2DE70` | `SKILLS_SrvDo126_ImpInferno` | `Imp Inferno` (#282) |
| 127 | `0x6FD276A4` | `0x6FC2CF00` | `SKILLS_SrvDo127_SuckBlood` | `Suck Blood` (#289) |
| 128 | `0x6FD276A8` | `0x6FC2C310` | `SKILLS_SrvDo128_CryHelp` | `Cry Help` (#290) |
| 129 | `0x6FD276AC` | `0x6FC2DBD0` | `SKILLS_SrvDo129_ImpTeleport` | `Imp Teleport` (#330) |
| 130 | `0x6FD276B0` | `0x6FC2D7B0` | `SKILLS_SrvDo130_VineAttack` | `Vine Attack` (#294) |
| 131 | `0x6FD276B4` | `0x6FC2D9C0` | `SKILLS_SrvDo131_OverseerWhip` | `Overseer Whip` (#295) |
| 132 | `0x6FD276B8` | `0x6FC2D530` | `SKILLS_SrvDo132_ImpFireMissile` | `Imp Fire Missile` (#299) |
| 133 | `0x6FD276BC` | `0x6FC2C5D0` | `SKILLS_SrvDo133_Impregnate` | `Impregnate` (#300) |
| 134 | `0x6FD276C0` | `0x6FC2C900` | `SKILLS_SrvDo134_SiegeBeastStomp` | `Siege Beast Stomp` (#301) |
| 135 | `0x6FD276C4` | `0x6FC2CDC0` | `SKILLS_SrvDo135_MinionSpawner` | `MinionSpawner` (#302) |
| 136 | `0x6FD276C8` | `0x6FC2C400` | `SKILLS_SrvDo136_DeathMaul` | `DeathMaul` (#308) |
| 137 | `0x6FD276CC` | `0x6FC2DD50` | `SKILLS_SrvDo137_FenrisRage` | `fenris rage` (#314) |
| 138 | `0x6FD276D0` | `0x6FC2D370` | `SKILLS_SrvDo138_Unused` | *(unreferenced in 1.13c txt)* |
| 139 | `0x6FD276D4` | `0x6FC2D290` | `SKILLS_SrvDo139_BaalColdMissiles` | `Baal Cold Missiles` (#318) |
| 140 | `0x6FD276D8` | `0x6FC2CB30` | `SKILLS_SrvDo140_BaalTentacle` | `Baal Tentacle` (#315) |
| 141 | `0x6FD276DC` | `0x6FC2CA20` | `SKILLS_SrvDo141_BaalCorpseExplode` | `Baal Corpse Explode` (#285) |
| 142 | `0x6FD276E0` | `0x6FCB34A0` | `SKILLS_SrvDo142_Unused` | *(unreferenced in 1.13c txt)* |
| 143 | `0x6FD276E4` | `0x6FCB4E60` | `SKILLS_SrvDo143_FistsOfFire_RoyalStrike_ProgressiveFn` | *(unreferenced in 1.13c txt)* |
| 144 | `0x6FD276E8` | `0x6FC63D40` | `SKILLS_SrvDo144_Hydra` | `Hydra` (#62) |
| 145 | `0x6FD276EC` | `0x6FC65AF0` | `SKILLS_SrvDo145_Unused` | *(unreferenced in 1.13c txt)* |
| 146 | `0x6FD276F0` | `0x6FC65850` | `SKILLS_SrvDo146_Unused` | *(unreferenced in 1.13c txt)* |
| 147 | `0x6FD276F4` | `0x6FC2C170` | `SKILLS_SrvDo147_Unused` | *(unreferenced in 1.13c txt)* |
| 148 | `0x6FD276F8` | `0x6FCD4C20` | `SKILLS_SrvDo148_DoomKnightMissile` | `DoomKnightMissile` (#335) |
| 149 | `0x6FD276FC` | `0x6FCD4B10` | `SKILLS_SrvDo149_NecromageMissile` | `NecromageMissile` (#338) |
| 150 | `0x6FD27700` | `0x6FCB9000` | `SKILLS_SrvDo150_Smite` | `Smite` (#97) |
| 151 | `0x6FD27704` | `0x6FC63610` | `SKILLS_SrvDo151_Unused` | *(unreferenced in 1.13c txt)* |
| 152 | `0x6FD27708` | `0x6FCD6840` | `SKILLS_SrvDo152_DiabLight` | `DiabLight` (#193) |

## 8. `D2Game.dll` Missile Server Do Functions (`gMissileSrvDoFuncTable` @ `0x6FD2D970`)

| Index | Slot VA | Function VA (1.13c) | Canonical Function Symbol | Referencing `Missiles.txt` Rows (`pSrvDoFunc`) |
|---:|---|---|---|---|
| 1 | `0x6FD2D974` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | `arrow` (#0), `javelin` (#1), `bighead1` (#2), `bighead2` (#3), `bighead3` (#4), `bighead4` (#5), ... (+545 more) |
| 2 | `0x6FD2D978` | `0x6FC61B80` | `MISSMODE_SrvDo02_PlagueJavelin_PoisonJavelin_PoisonTrap` | `poisonjav` (#38), `trap poison ball right` (#245), `trap poison ball left` (#246), `viper_poisjav` (#648) |
| 3 | `0x6FD2D97C` | `0x6FC61AE0` | `MISSMODE_SrvDo03_PoisonCloud_Blizzard_ThunderStorm_HandOfGod` | `poisonjavcloud` (#39), `plaguejavelin` (#43), `monbliz1` (#107), `monbliz2` (#108), `monbliz3` (#109), `monbliz4` (#110), ... (+20 more) |
| 5 | `0x6FD2D984` | `0x6FC61980` | `MISSMODE_SrvDo05_FireWall_ImmolationFire_MeteorFire_MoltenBoulderFirePath` | `blaze` (#67), `firewall` (#69), `vampirefirewall` (#131), `immolationfire` (#230), `meteorfire` (#240), `countessfirewall` (#331), ... (+3 more) |
| 6 | `0x6FD2D988` | `0x6FC61850` | `MISSMODE_SrvDo06_MoltenBoulder_FireWallMaker` | `firewallmaker` (#68), `vampirefirewallmaker` (#130), `moltenboulder` (#452), `countessfirewallmaker` (#653) |
| 7 | `0x6FD2D98C` | `0x6FC61710` | `MISSMODE_SrvDo07_GuidedArrow_BoneSpirit` | `guidedarrow` (#86), `bonespirit` (#193), `monbonespirit` (#329) |
| 8 | `0x6FD2D990` | `0x6FC61670` | `MISSMODE_SrvDo08_MonBlizzCenter` | `monblizcenter` (#106) |
| 9 | `0x6FD2D994` | `0x6FC61520` | `MISSMODE_SrvDo09_BatLightningBolt` | `bat lightning bolt` (#123) |
| 10 | `0x6FD2D998` | `0x6FC613D0` | `MISSMODE_SrvDo10_BlizzardCenter` | `blizzardcenter` (#158) |
| 11 | `0x6FD2D99C` | `0x6FC61240` | `MISSMODE_SrvDo11_FingerMageSpider` | `fingermagespider` (#177) |
| 12 | `0x6FD2D9A0` | `0x6FC61110` | `MISSMODE_SrvDo12_DiabWallMaker` | `diabwallmaker` (#179) |
| 13 | `0x6FD2D9A4` | `0x6FC60EB0` | `MISSMODE_SrvDo13_BoneWallMaker` | `bonewallmaker` (#207) |
| 14 | `0x6FD2D9A8` | `0x6FC60E10` | `MISSMODE_SrvDo14_GrimWard` | `grimwardsmall` (#250), `grimwardmedium` (#253), `grimwardlarge` (#256) |
| 15 | `0x6FD2D9AC` | `0x6FC60CA0` | `MISSMODE_SrvDo15_FrozenOrb` | `frozenorb` (#260) |
| 16 | `0x6FD2D9B0` | `0x6FC60BD0` | `MISSMODE_SrvDo16_FrozenOrbNova` | `frozenorbnova` (#262) |
| 17 | `0x6FD2D9B4` | `0x6FC60B20` | `MISSMODE_SrvDo17_CairnStones` | `cairnstones` (#288) |
| 18 | `0x6FD2D9B8` | `0x6FC608D0` | `MISSMODE_SrvDo18_TowerChestSpawner` | `towerchestspawner` (#332) |
| 19 | `0x6FD2D9BC` | `0x6FC5F6D0` | `MISSMODE_SrvDo19_RadamentDeath` | `radamentdeath` (#347) |
| 20 | `0x6FD2D9C0` | `0x6FC60860` | `MISSMODE_SrvDo20_BladeCreeper` | `blade creeper` (#392) |
| 21 | `0x6FD2D9C4` | `0x6FC61EB0` | `MISSMODE_SrvDo21_Distraction` | `distraction` (#393) |
| 22 | `0x6FD2D9C8` | `0x6FC606D0` | `MISSMODE_SrvDo22_LightningTrailingJavelin` | `lightingtrailingjavalin` (#431), `advlighttrailingjav` (#438) |
| 23 | `0x6FD2D9CC` | `0x6FC605E0` | `MISSMODE_SrvDo23_24_SuccFireBall_FirestormMaker` | `sucfireball` (#441), `firestormmaker` (#458) |
| 24 | `0x6FD2D9D0` | `0x6FC605E0` | `MISSMODE_SrvDo23_24_SuccFireBall_FirestormMaker` | *(unreferenced in 1.13c txt)* |
| 25 | `0x6FD2D9D4` | `0x6FC604D0` | `MISSMODE_SrvDo25_EruptionCenter` | `erruption center` (#461) |
| 26 | `0x6FD2D9D8` | `0x6FC60420` | `MISSMODE_SrvDo26_Vines_PlagueVines` | `vines` (#471), `plague vines` (#474) |
| 27 | `0x6FD2D9DC` | `0x6FC60280` | `MISSMODE_SrvDo27_Tornado` | `tornado` (#478) |
| 28 | `0x6FD2D9E0` | `0x6FC60070` | `MISSMODE_SrvDo28_Volcano` | `volcano` (#479) |
| 29 | `0x6FD2D9E4` | `0x6FC5FED0` | `MISSMODE_SrvDo29_RecyclerDelay` | `recycler delay` (#498) |
| 30 | `0x6FD2D9E8` | `0x6FC5FB40` | `MISSMODE_SrvDo30_RabiesPlague` | `rabiesplague` (#515) |
| 31 | `0x6FD2D9EC` | `0x6FC5F9F0` | `MISSMODE_SrvDo31_WakeOfDestructionMaker_BaalColdMaker` | `wake of destruction maker` (#517), `baal cold maker` (#589) |
| 32 | `0x6FD2D9F0` | `0x6FC61DE0` | `MISSMODE_SrvDo32_TigerFury` | `tigerfury` (#520) |
| 33 | `0x6FD2D9F4` | `0x6FC5FD30` | `MISSMODE_SrvDo33_VineRecyclerDelay` | `vine recycler delay` (#540) |
| 34 | `0x6FD2D9F8` | `0x6FC61C30` | `MISSMODE_SrvDo34_BaalTauntControl` | `baal taunt control` (#546) |
| 35 | `0x6FD2D9FC` | `0x6FC5F890` | `MISSMODE_SrvDo35_RoyalStrikeChaosIce` | `royalstrikechaosice` (#569) |
| 36 | `0x6FD2DA00` | `0x6FC5F670` | `MISSMODE_SrvDo36_BaalFxControl` | `baalfx control` (#625) |
| 37 | `0x6FD2DA04` | `0x6FC5F550` | `MISSMODE_SrvDo37_Unused` | *(unreferenced in 1.13c txt)* |

## 9. `D2Game.dll` Missile Server Hit Functions (`gpMissileSrvHitFnTable` @ `0x6FD2DA48`)

| Index | Slot VA | Function VA (1.13c) | Canonical Function Symbol | Referencing `Missiles.txt` Rows (`pSrvHitFunc`) |
|---:|---|---|---|---|
| 1 | `0x6FD2DA4C` | `0x6FC5B990` | `MISSMODE_SrvHit01_Fireball_ExplodingArrow_FreezingArrowExplosion` | `fireball` (#62), `vampirefireball` (#129), `desertfireball` (#283), `impfireball` (#404), `catapult cold ball` (#416), `sucfireball` (#441), ... (+2 more) |
| 2 | `0x6FD2DA50` | `0x6FC5E330` | `MISSMODE_SrvHit02_PlagueJavelin_PoisonPotion` | `plaguejavelin` (#43), `rancidgasepotion` (#47), `chokinggaspoition` (#48), `stranglinggaspotion` (#49), `catapult plague ball` (#419), `plaguejavelin2` (#436) |
| 3 | `0x6FD2DA54` | `0x6FC5BB60` | `MISSMODE_SrvHit03_ExplosivePotion_BombOnGround` | `oilpotion` (#44), `explosivepotion` (#45), `fulminatingpotion` (#46), `bomb on ground` (#386) |
| 4 | `0x6FD2DA58` | `0x6FC5F220` | `MISSMODE_SrvHit04_ExplodingArrow_FreezingArrow_RoyalStrikeMeteorCenter` | `explodingarrow` (#41), `freezingarrow` (#87), `royalstrikemeteorcenter` (#564) |
| 5 | `0x6FD2DA5C` | `0x6FC5C700` | `MISSMODE_SrvHit05_Unused` | *(unreferenced in 1.13c txt)* |
| 6 | `0x6FD2DA60` | `0x6FC5BD10` | `MISSMODE_SrvHit06_Unused` | *(unreferenced in 1.13c txt)* |
| 7 | `0x6FD2DA64` | `0x6FC59FD0` | `MISSMODE_SrvHit07_HolyBolt_FistOfTheHeavenBolt` | `holybolt` (#55), `fistoftheheavensbolt` (#234) |
| 8 | `0x6FD2DA68` | `0x6FC59F70` | `MISSMODE_SrvHit08_Blaze` | `blaze` (#67) |
| 9 | `0x6FD2DA6C` | `0x6FC5E0B0` | `MISSMODE_SrvHit09_ImmolationArrow` | `immolationarrow` (#85) |
| 10 | `0x6FD2DA70` | `0x6FC5B140` | `MISSMODE_SrvHit10_GuidedArrow_BoneSpirit` | `guidedarrow` (#86), `bonespirit` (#193), `monbonespirit` (#329) |
| 11 | `0x6FD2DA74` | `0x6FC5F120` | `MISSMODE_SrvHit11_Unused` | *(unreferenced in 1.13c txt)* |
| 12 | `0x6FD2DA78` | `0x6FC5D020` | `MISSMODE_SrvHit12_ChainLightning_LightningStrike` | `chainlightning` (#93), `lightningstrike` (#232), `chainlightning2` (#267) |
| 13 | `0x6FD2DA7C` | `0x6FC5B3E0` | `MISSMODE_SrvHit13_GlacialSpike_HellMeteorDown` | `glacialspike` (#96), `monglacialspike` (#271), `hellmeteordown` (#336) |
| 14 | `0x6FD2DA80` | `0x6FC5DEF0` | `MISSMODE_SrvHit14_MeteorCenter_CatapultMeteor_RoyalStrikeMeteor` | `meteorcenter` (#101), `vampiremeteorcenter` (#133), `catapult meteor ball` (#422), `royalstrikemeteor` (#563) |
| 15 | `0x6FD2DA84` | `0x6FC5CDD0` | `MISSMODE_SrvHit15_SpiderGooLay` | `spidergoolay` (#143) |
| 16 | `0x6FD2DA88` | `0x6FC5EC10` | `MISSMODE_SrvHit16_SpiderGoo_VinesTrail_VinesWither` | `spidergoo` (#146), `vines trail` (#472), `vines wither` (#473) |
| 17 | `0x6FD2DA8C` | `0x6FC5EAE0` | `MISSMODE_SrvHit17_Howl` | `howl` (#148) |
| 18 | `0x6FD2DA90` | `0x6FC5EA60` | `MISSMODE_SrvHit18_Shout_BattleCommand_BattleOrders` | `shout` (#149), `battlecommand` (#236), `battleorders` (#237) |
| 19 | `0x6FD2DA94` | `0x6FC5E8A0` | `MISSMODE_SrvHit19_FingerMageSpider` | `fingermagespider` (#177) |
| 20 | `0x6FD2DA98` | `0x6FC5DD60` | `MISSMODE_SrvHit20_LightningFury` | `lightningfury` (#206) |
| 21 | `0x6FD2DA9C` | `0x6FC5ABD0` | `MISSMODE_SrvHit21_BattleCry` | `battlecry` (#219) |
| 22 | `0x6FD2DAA0` | `0x6FC5DB30` | `MISSMODE_SrvHit22_FistOfTheHeavensDelay` | `fistoftheheavensdelay` (#233) |
| 23 | `0x6FD2DAA4` | `0x6FC59DA0` | `MISSMODE_SrvHit23_Unused` | *(unreferenced in 1.13c txt)* |
| 24 | `0x6FD2DAA8` | `0x6FC5B7C0` | `MISSMODE_SrvHit24_PantherPotOrange` | `pantherpotorange` (#238) |
| 25 | `0x6FD2DAAC` | `0x6FC5DA60` | `MISSMODE_SrvHit25_PantherPotGreen` | `pantherpotgreen` (#239) |
| 26 | `0x6FD2DAB0` | `0x6FC5C990` | `MISSMODE_SrvHit26_GrimWardStart` | `grimwardsmallstart` (#249), `grimwardmediumstart` (#252), `grimwardlargestart` (#255) |
| 27 | `0x6FD2DAB4` | `0x6FC58EC0` | `MISSMODE_SrvHit27_GrimWard` | `grimwardsmall` (#250), `grimwardmedium` (#253), `grimwardlarge` (#256) |
| 28 | `0x6FD2DAB8` | `0x6FC5E740` | `MISSMODE_SrvHit28_GrimWardScare` | `grimwardscare` (#259) |
| 29 | `0x6FD2DABC` | `0x6FC5C850` | `MISSMODE_SrvHit29_FrozenOrb` | `frozenorb` (#260) |
| 31 | `0x6FD2DAC4` | `0x6FC5A920` | `MISSMODE_SrvHit31_FireHead` | `firehead` (#277) |
| 32 | `0x6FD2DAC8` | `0x6FC5BE70` | `MISSMODE_SrvHit32_CairnStones` | `cairnstones` (#288) |
| 33 | `0x6FD2DACC` | `0x6FC58EA0` | `MISSMODE_SrvHit33_TowerChestSpawner` | `towerchestspawner` (#332) |
| 35 | `0x6FD2DAD4` | `0x6FC5E670` | `MISSMODE_SrvHit35_OrbMist` | `orbmist` (#368) |
| 36 | `0x6FD2DAD8` | `0x6FC5AB30` | `MISSMODE_SrvHit36_MissileInAir` | `bomb in air` (#385), `shock field in air` (#388), `catapult spike in air` (#412), `sentryspikeinair` (#496) |
| 37 | `0x6FD2DADC` | `0x6FC58E90` | `MISSMODE_SrvHit37_BladeCreeper` | `blade creeper` (#392) |
| 38 | `0x6FD2DAE0` | `0x6FC5C5B0` | `MISSMODE_SrvHit38_CatapultChargedBall` | `catapultchargedball` (#407) |
| 39 | `0x6FD2DAE4` | `0x6FC5BC00` | `MISSMODE_SrvHit39_ImpSpawnMonsters` | `imp spawn monsters` (#409) |
| 40 | `0x6FD2DAE8` | `0x6FC5C490` | `MISSMODE_SrvHit40_CatapultSpikeBall` | `catapult spike ball` (#411) |
| 43 | `0x6FD2DAF4` | `0x6FC59E30` | `MISSMODE_SrvHit43_HealingVortex` | `healing vortex` (#425) |
| 44 | `0x6FD2DAF8` | `0x6FC5B5F0` | `MISSMODE_SrvHit44_ExplodingJavelin` | `explodingjavalin` (#429), `icejavalin` (#434) |
| 45 | `0x6FD2DAFC` | `0x6FC5C3B0` | `MISSMODE_SrvHit45_LightningTrailingJavelin` | `lightingtrailingjavalin` (#431), `advlighttrailingjav` (#438) |
| 47 | `0x6FD2DB04` | `0x6FC5D8C0` | `MISSMODE_SrvHit47_MoltenBoulder` | `moltenboulder` (#452) |
| 48 | `0x6FD2DB08` | `0x6FC5C260` | `MISSMODE_SrvHit48_MoltenBoulderEmerge` | `moltenboulderemerge` (#453) |
| 50 | `0x6FD2DB10` | `0x6FC591A0` | `MISSMODE_SrvHit50_PlagueVinesTrail` | `plague vines trail` (#475) |
| 51 | `0x6FD2DB14` | `0x6FC5C160` | `MISSMODE_SrvHit51_VolcanoDebris` | `volcano debris 2` (#481) |
| 52 | `0x6FD2DB18` | `0x6FC5C030` | `MISSMODE_SrvHit52_BladeFury` | `bladefury1` (#505), `bladefury2` (#507), `bladefury3` (#509) |
| 53 | `0x6FD2DB1C` | `0x6FC5F7D0` | `MISSMODE_SrvHit53_RabiesContagion` | `rabiescontagion` (#516) |
| 54 | `0x6FD2DB20` | `0x6FC5BC80` | `MISSMODE_SrvHit54_BaalSpawnMonsters` | `baal spawn monsters` (#550) |
| 55 | `0x6FD2DB24` | `0x6FC596E0` | `MISSMODE_SrvHit55_Baalnferno` | `baal inferno` (#554) |
| 56 | `0x6FD2DB28` | `0x6FC5B210` | `MISSMODE_SrvHit56_ArmageddonControl` | `armageddoncontrol` (#577), `diablogeddoncontrol` (#670) |
| 57 | `0x6FD2DB2C` | `0x6FC5BBB0` | `MISSMODE_SrvHit57_BaalFxControl` | `baalfx control` (#625) |
| 58 | `0x6FD2DB30` | `0x6FC5BED0` | `MISSMODE_SrvHit58_BaalTauntLightningControl` | `baal taunt lightning control` (#654) |
| 59 | `0x6FD2DB34` | `0x6FC5D800` | `MISSMODE_SrvHit59_BaalTauntPoisonControl` | `baal taunt poison control` (#655) |

## 10. `D2Game.dll` Missile Server Damage Functions (`gpMissileSrvDmgFnTable` @ `0x6FD2DB68`)

| Index | Slot VA | Function VA (1.13c) | Canonical Function Symbol | Referencing `Missiles.txt` Rows (`pSrvDmgFunc`) |
|---:|---|---|---|---|
| 1 | `0x6FD2DB6C` | `0x6FC59CE0` | `MISSMODE_SrvDmg01_FireArrow_MagicArrow_ColdArrow` | `firearrow` (#12), `magicarrow` (#27), `coldarrow` (#40) |
| 2 | `0x6FD2DB70` | `0x6FC59080` | `MISSMODE_SrvDmg02_IceArrow_RoyalStrikeChaos` | `icearrow` (#28), `royalstrikechaosice` (#569) |
| 3 | `0x6FD2DB74` | `0x6FC59670` | `MISSMODE_SrvDmg03_Blaze_FireWall_ImmolationFire_MeteorFire` | `blaze` (#67), `firewall` (#69), `vampirefirewall` (#131), `immolationfire` (#230), `meteorfire` (#240), `vampiremeteorfire` (#681) |
| 4 | `0x6FD2DB78` | `0x6FC58E70` | `MISSMODE_SrvDmg04_IceBlast` | `iceblast` (#91) |
| 5 | `0x6FD2DB7C` | `0x6FC5A790` | `MISSMODE_SrvDmg05_BlessedHammer` | `blessedhammer` (#92) |
| 6 | `0x6FD2DB80` | `0x6FC59C80` | `MISSMODE_SrvDmg06_Unused` | *(unreferenced in 1.13c txt)* |
| 7 | `0x6FD2DB84` | `0x6FC59600` | `MISSMODE_SrvDmg07_Warcry_ShockWave` | `warcry` (#235), `shockwave` (#511) |
| 8 | `0x6FD2DB88` | `0x6FC58FF0` | `MISSMODE_SrvDmg08_EruptionCrack` | `erruption crack 1` (#462), `erruption crack 2` (#463) |
| 9 | `0x6FD2DB8C` | `0x6FC59560` | `MISSMODE_SrvDmg09_Twister` | `twister` (#477) |
| 10 | `0x6FD2DB90` | `0x6FC59040` | `MISSMODE_SrvDmg10_BladesOfIceCubes` | `bladesoficecubes` (#561) |
| 11 | `0x6FD2DB94` | `0x6FC59BD0` | `MISSMODE_SrvDmg11_RabiesContagion` | `rabiescontagion` (#516) |
| 12 | `0x6FD2DB98` | `0x6FC5A850` | `MISSMODE_SrvDmg12_LightningJavelin` | `lightningjavelin` (#205) |
| 13 | `0x6FD2DB9C` | `0x6FC5AAA0` | `MISSMODE_SrvDmg13_BlessedHammerEx` | `blessedhammerex` (#640) |
| 14 | `0x6FD2DBA0` | `0x6FC59A40` | `MISSMODE_SrvDmg14_MoltenBoulder` | `moltenboulder` (#452) |

## 11. Universal Player Actions (`Skills.txt` IDs `#0`–`#5` & `#217`–`#220`)

| ID | Skill | `srvstfunc` | `srvdofunc` | `cltstfunc` | `cltdofunc` | `anim` / `seqtrans` | `range` | `weapsel` | `SrcDam` | `checkfunc` |
|---:|---|---:|---:|---:|---:|---|---|---:|---:|---:|
| 0 | `Attack` | 1 (`0x6FCC1630`) | 1 (`0x6FCC2C40`) | 1 (`0x6FB50EA0`) | 1 (`0x6FB52230`) | `A1` | `both` | 0 | 128 | 1 |
| 1 | `Kick` | 2 (`0x6FCC0E80`) | 2 (`0x6FCC3220`) | 0 (`NULL`) | 0 (`NULL`) | `KK` | `h2h` | 4 | — | — |
| 2 | `Throw` | 65 (`0x6FCC1600`) | 3 (`0x6FCC2B40`) | 2 (`0x6FB50E70`) | 2 (`0x6FB52F60`) | `TH` | `rng` | 0 | 128 | 2 |
| 3 | `Unsummon` | 3 (`0x6FCBFEF0`) | 4 (`0x6FCC2EA0`) | 3 (`0x6FB51110`) | 0 (`NULL`) | `SC` | `rng` | 0 | — | — |
| 4 | `Left Hand Throw` | 65 (`0x6FCC1600`) | 5 (`0x6FCC2A40`) | 2 (`0x6FB50E70`) | 2 (`0x6FB52F60`) | `S4` | `rng` | 1 | — | 3 |
| 5 | `Left Hand Swing` | 1 (`0x6FCC1630`) | 1 (`0x6FCC2C40`) | 4 (`0x6FB50730`) | 1 (`0x6FB52230`) | `S3` | `both` | 1 | — | 4 |
| 217 | `Scroll of Identify` | 0 (`NULL`) | 113 (`0x6FCCDFA0`) | 0 (`NULL`) | 0 (`NULL`) | `SC` | `none` | 0 | — | 5 |
| 218 | `Book of Identify` | 0 (`NULL`) | 113 (`0x6FCCDFA0`) | 0 (`NULL`) | 0 (`NULL`) | `SC` | `none` | 0 | — | 5 |
| 219 | `Scroll of Townportal` | 0 (`NULL`) | 113 (`0x6FCCDFA0`) | 0 (`NULL`) | 0 (`NULL`) | `SC` | `none` | 0 | — | 5 |
| 220 | `Book of Townportal` | 0 (`NULL`) | 113 (`0x6FCCDFA0`) | 0 (`NULL`) | 0 (`NULL`) | `SC` | `none` | 0 | — | 5 |

### 11.1 `Attack` (#0) & `Left Hand Swing` (#5)
- **Server Start (`SKILLS_SrvSt01_Attack_LeftHandSwing` @ `0x6FCC1630`)**:
  - Sets `pUnit->nSeqCurrentFramePrecise = UNITS_GetFrameBonus(pUnit) << 8`.
  - If `STATES_CheckStateMaskOnUnit(pUnit, 38)` (shape-shift/progressive override), delegates to `sub_6FD00370`.
  - If equipped weapon is a Bow or Crossbow (`COMPOSIT_IsWeaponBowOrXBow`), verifies valid ammunition via `sub_6FD119C0` (or `STAT_ITEM_MAGICARROW` bypass on `Attack` #0); if ammunition is depleted, aborts attack and sends ammo-sync packets (`0x6FC80A30`, `0x6FC80E10`).
- **Server Do (`SKILLS_SrvDo001_Attack_LeftHandSwing` @ `0x6FCC2C40`)**:
  - Sets `pUnit->dwFlags |= UNITFLAG_SKSRVDOFUNC` (`0x40`).
  - **Ranged Branch (`COMPOSIT_IsWeaponBowOrXBow`)**: Resolves projectile missile ID from equipped weapon/quiver (`arrow` #1 or `bolt` #33, or `STAT_ITEM_MAGICARROW` missile) and spawns the server missile via `sub_6FD11420` while consuming 1 quiver quantity (unless `STAT_ITEM_MAGICARROW > 0`).
  - **Melee Branch**: Queries `pTarget = SUNIT_GetTargetUnit(pGame, pUnit)`, computes `SUNITDMG_GetResultFlags` (including `STAT_PROGRESSIVE_TOHIT` from Assassin charge-ups), populates `D2DamageStrc` at `SrcDam = 128` ($128/128 = 100\%$ weapon damage), applies weapon/item modifiers, executes `SUNITDMG_AllocCombat`, triggers progressive charge finishers if not masked, and drains weapon durability (`SUNITDMG_DrainItemDurability`).
- **Client Start (`SkillCltStFunc[1]` @ `0x6FB50EA0` / `SkillCltStFunc[4]` @ `0x6FB50730`)**:
  - `CltStFunc[1]` (`0x6FB50EA0`): Checks ranged weapon (`D2Common.dll#10889` `@0x6FD94350`) and verifies quiver/ammo (`0x6FB50A30`); for melee, checks if active weapon (`D2Common.dll#10641` `@0x6FD81B90`) is a throwing potion (`0x26`) and rejects melee swing if so.
  - `CltStFunc[4]` (`0x6FB50730`): Unconditionally returns `1` (`mov eax, 1; ret 4`).
- **Client Do (`SkillCltDoFunc[1]` @ `0x6FB52230`)**:
  - Sets `pUnit->dwFlags |= 0x40`.
  - If ranged (`D2Common.dll#10889` `@0x6FD94350`), resolves bow/crossbow projectile missile ID (`D2Common.dll#10709` `@0x6FDA0D40`) and spawns the client projectile (`0x6FB515C0`).
  - If melee, plays weapon hit/swing sound (`0x6FADA0B0`) and updates unit path step (`D2Common.dll#10392` `@0x6FD848F0`).

### 11.2 `Kick` (#1 — Barrel / Object Kick)
- **Server Start (`SKILLS_SrvSt02_Kick` @ `0x6FCC0E80`) & Server Do (`SKILLS_SrvDo002` @ `0x6FCC3220`)**:
  - Used for kicking breakable environment objects (`TargetItem = 1`, `anim = KK`).
  - Allocates a `D2DamageStrc` with `wResultFlags = 9` (`DAMAGERESULTFLAG_SUCCESSFULHIT | DAMAGERESULTFLAG_WILLDIE`), `dwHitFlags = 2`, and `dwPhysDamage = dwMinDam << nToHitShift` via `SUNITDMG_AllocCombat(..., 128)`.

### 11.3 `Throw` (#2) & `Left Hand Throw` (#4)
- **Server Start (`SKILLS_SrvSt65_Throw_LeftHandThrow` @ `0x6FCC1600`)**:
  - Validates throwable weapon stack quantity via `sub_6FD119C0`.
- **Server Do (`SKILLS_SrvDo003_Throw` @ `0x6FCC2B40` / `SKILLS_SrvDo005_LeftHandThrow` @ `0x6FCC2A40`)**:
  - Resolves right-hand (`SrvDo003`) or left-hand (`SrvDo005`) equipped throwable item (`ITEMS_CheckIfThrowable` or `STAT_ITEM_THROWABLE`).
  - Queries `nMissileType = ITEMS_GetMissileType(pWeapon)`:
    - If `ITEMTYPE_MISSILE_POTION` (`tpot` — Fulminating, Exploding, Oil, Strangling, Choking, Rancid Gas Potion): spawns lobbed arc potion missile via `sub_6FD11710`.
    - Otherwise (javelin, throwing knife, throwing axe): spawns linear thrown weapon missile via `sub_6FD11420` and adds Barbarian `Throwing Mastery` bonuses (`D2Common_11024`) to `STAT_TOHIT` and `STAT_DAMAGEPERCENT`.
- **Client Start (`SkillCltStFunc[2]` @ `0x6FB50E70`) & Client Do (`SkillCltDoFunc[2]` @ `0x6FB52F60`)**:
  - `CltStFunc[2]` verifies ammo/stack (`0x6FB50A30`) and active weapon (`D2Common.dll#10641`).
  - `CltDoFunc[2]` checks item type (`D2Common.dll#11088` `@0x6FD730F0`): if `0x26` (`ITEMTYPE_TPOT`), calls `0x6FB69A80` (parabolic lobbed trajectory); otherwise calls `0x6FB515C0` (linear thrown weapon projectile).

### 11.4 `Unsummon` (#3)
- **Server Start (`SKILLS_SrvSt03_Unsummon` @ `0x6FCBFEF0`) & Server Do (`SKILLS_SrvDo004_Unsummon` @ `0x6FCC2EA0`)**:
  - Verifies `pTarget->dwUnitType == UNIT_MONSTER`, `AIGENERAL_GetMinionOwner(pTarget) == pUnit`, and checks `PetType.txt` bit 3 (`unsummon = 1`, `gdwBitMasks[3]`). Stores `pTarget->dwUnitId` in `Skill.Param1` and despawns the pet in `SrvDo004` (`sub_6FC7D260`).
- **Client Start (`SkillCltStFunc[3]` @ `0x6FB51110`)**:
  - Iterates the client pet roster (`0x6FBCC4D4`) to verify ownership (`pPet->dwOwnerId == pUnit->dwUnitId`) and checks `PetType.txt` (`+0xE0 * nPetType`, offset `+0x04`) bit 3 (`unsummon = 1`).

### 11.5 `Scroll / Book of Identify & Townportal` (#217–#220)
- **Server Do (`SKILLS_SrvDo113_Scroll_Book` @ `0x6FCCDFA0`)**:
  - Consumes 1 charge from the Tome (`Book`) or destroys the `Scroll`, then triggers the Identify cursor (`Scroll/Book of Identify`, allowed in town `InTown = 1`) or spawns a blue Town Portal object (`OBJECT_TOWN_PORTAL`, `InTown = 0` for Townportal skills).

---

## 12. Knowledge Base Index (`kb/skills/`) — Player & Boss Skills

### Player Class Skill Trees (21 Documents, 210 Skills)
- **Amazon (Skills `#6`–`#35`)**:
  - [`kb/skills/player/skills-ama-bow-crossbow.md`](./player/skills-ama-bow-crossbow.md) — Bow and Crossbow Skills
  - [`kb/skills/player/skills-ama-passive-magic.md`](./player/skills-ama-passive-magic.md) — Passive and Magic Skills
  - [`kb/skills/player/skills-ama-javelin-spear.md`](./player/skills-ama-javelin-spear.md) — Javelin and Spear Skills
- **Sorceress (Skills `#36`–`#65`)**:
  - [`kb/skills/player/skills-sor-fire.md`](./player/skills-sor-fire.md) — Fire Spells (see also [`kb/skills/missiles/d2client-meteor-cltdofunc-clthitfunc.md`](./missiles/d2client-meteor-cltdofunc-clthitfunc.md))
  - [`kb/skills/player/skills-sor-lightning.md`](./player/skills-sor-lightning.md) — Lightning Spells
  - [`kb/skills/player/skills-sor-cold.md`](./player/skills-sor-cold.md) — Cold Spells
- **Necromancer (Skills `#66`–`#95`)**:
  - [`kb/skills/player/skills-nec-curses.md`](./player/skills-nec-curses.md) — Curses
  - [`kb/skills/player/skills-nec-poison-bone.md`](./player/skills-nec-poison-bone.md) — Poison and Bone Spells
  - [`kb/skills/player/skills-nec-summoning.md`](./player/skills-nec-summoning.md) — Summoning Spells
- **Paladin (Skills `#96`–`#125`)**:
  - [`kb/skills/player/skills-pal-combat.md`](./player/skills-pal-combat.md) — Combat Skills
  - [`kb/skills/player/skills-pal-offensive-auras.md`](./player/skills-pal-offensive-auras.md) — Offensive Auras
  - [`kb/skills/player/skills-pal-defensive-auras.md`](./player/skills-pal-defensive-auras.md) — Defensive Auras
- **Barbarian (Skills `#126`–`#155`)**:
  - [`kb/skills/player/skills-bar-combat.md`](./player/skills-bar-combat.md) — Combat Skills
  - [`kb/skills/player/skills-bar-masteries.md`](./player/skills-bar-masteries.md) — Combat Masteries
  - [`kb/skills/player/skills-bar-warcries.md`](./player/skills-bar-warcries.md) — Warcries
- **Druid (Skills `#221`–`#250`)**:
  - [`kb/skills/player/skills-dru-elemental.md`](./player/skills-dru-elemental.md) — Elemental Skills
  - [`kb/skills/player/skills-dru-shapeshifting.md`](./player/skills-dru-shapeshifting.md) — Shape Shifting Skills
  - [`kb/skills/player/skills-dru-summoning.md`](./player/skills-dru-summoning.md) — Summoning Skills
- **Assassin (Skills `#251`–`#280`)**:
  - [`kb/skills/player/skills-ass-martial-arts.md`](./player/skills-ass-martial-arts.md) — Martial Arts
  - [`kb/skills/player/skills-ass-shadow-disciplines.md`](./player/skills-ass-shadow-disciplines.md) — Shadow Disciplines
  - [`kb/skills/player/skills-ass-traps.md`](./player/skills-ass-traps.md) — Traps

### Boss & Monster Skills (3 Documents)
- [`kb/skills/bosses/skills-boss-act1-act2-act3.md`](./bosses/skills-boss-act1-act2-act3.md) — Act 1, Act 2, and Act 3 Bosses (Andariel, Blood Raven, Countess, Griswold, Cow King, Radament, Coldworm, Summoner, Duriel, Council Members, Mephisto)
- [`kb/skills/bosses/skills-boss-act4-diablo.md`](./bosses/skills-boss-act4-diablo.md) — Act 4 Bosses (Izual, Hephasto, Chaos Sanctuary Seal Bosses, Diablo, Diablo Clone)
- [`kb/skills/bosses/skills-boss-act5-baal-ubers.md`](./bosses/skills-boss-act5-baal-ubers.md) — Act 5 & Pandemonium Bosses (Shenk & Catapults, Nihlathak, The Ancients, Baal Throne Waves, Baal & Baal Clone, Uber Mephisto, Uber Diablo, Uber Baal, Lilith, Uber Duriel, Uber Izual)

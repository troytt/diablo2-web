# Diablo II v1.13c Act 5 Bosses & Pandemonium (Uber) Bosses — AI, Skills & Missile Mechanics

## 1. Dispatch Tables (`D2Game.dll` & `D2Client.dll` v1.13c)

### `D2Game.dll` (`ImageBase = 0x6FC20000`)
- **`g_apfnSkillSrvStFunc`** (`0x6FD27338`):
  - `[14]` = `0x6FC62AD0` (`SKILLS_SrvSt14_Hydra`)
  - `[17]` = `0x6FC6EEE0` (`SKILLS_SrvSt17_Poison_CorpseExplosion`)
  - `[31]` = `0x6FCB9620` (`SKILLS_SrvSt31_Charge`)
  - `[38]` = `0x6FC48290` (`SKILLS_SrvSt38_Whirlwind`)
  - `[41]` = `0x6FC48600` (`SKILLS_SrvSt41_LeapAttack`)
  - `[46]` = `0x6FCD3930` (`SKILLS_SrvSt46_AndrialSpray`)
  - `[53]` = `0x6FCD2ED0` (`SKILLS_SrvSt53_MonInferno`)
  - `[62]` = `0x6FC2BF90` (`SKILLS_SrvSt62_MinionSpawner`)
- **`g_apfnSkillSrvDoFunc`** (`0x6FD274A8`):
  - `[7]` = `0x6FC6CB00` (`SKILLS_SrvDo007_Jab`)
  - `[17]` = `0x6FC63B60` (`SKILLS_SrvDo017_ChargedBolt_BoltSentry`)
  - `[18]` = `0x6FC628F0` (`SKILLS_SrvDo018_DefensiveBuff`)
  - `[22]` = `0x6FC63AA0` (`SKILLS_SrvDo022_NovaAttack`)
  - `[28]` = `0x6FC62D90` (`SKILLS_SrvDo028_Meteor_Blizzard_Eruption_BaalTaunt_Catapult`)
  - `[30]` = `0x6FC705D0` (`SKILLS_SrvDo030_Curse`)
  - `[55]` = `0x6FC6F4D0` (`SKILLS_SrvDo055_CorpseExplosion`)
  - `[66]` = `0x6FCBAF50` (`SKILLS_SrvDo066_HolyFire_HolyShock_Sanctuary_Conviction`)
  - `[67]` = `0x6FCB9D20` (`SKILLS_SrvDo067_Charge`)
  - `[68]` = `0x6FC49720` (`SKILLS_SrvDo068_BasicShout`)
  - `[74]` = `0x6FC47E30` (`SKILLS_SrvDo074_DoubleThrow`)
  - `[76]` = `0x6FC48BE0` (`SKILLS_SrvDo076_Whirlwind`)
  - `[78]` = `0x6FC493B0` (`SKILLS_SrvDo078_LeapAttack`)
  - `[81]` = `0x6FCBABC0` (`SKILLS_SrvDo081_HolyFreeze`)
  - `[88]` = `0x6FCD56C0` (`SKILLS_SrvDo088_AndrialSpray`)
  - `[95]` = `0x6FCD6A60` (`SKILLS_SrvDo095_MonInferno`)
  - `[96]` = `0x6FCD3770` (`SKILLS_SrvDo096_ZakarumHeal_Bestow`)
  - `[97]` = `0x6FCD5BD0` (`SKILLS_SrvDo097_Resurrect`)
  - `[98]` = `0x6FCD46B0` (`SKILLS_SrvDo098_MonTeleport`)
  - `[99]` = `0x6FCD52A0` (`SKILLS_SrvDo099_PrimePoisonNova`)
  - `[128]` = `0x6FC2C310` (`SKILLS_SrvDo128_CryHelp`)
  - `[129]` = `0x6FC2DBD0` (`SKILLS_SrvDo129_ImpTeleport`)
  - `[131]` = `0x6FC2D9C0` (`SKILLS_SrvDo131_OverseerWhip`)
  - `[135]` = `0x6FC2CDC0` (`SKILLS_SrvDo135_MinionSpawner`)
  - `[139]` = `0x6FC2D290` (`SKILLS_SrvDo139_BaalColdMissiles`)
  - `[140]` = `0x6FC2CB30` (`SKILLS_SrvDo140_BaalTentacle`)
  - `[141]` = `0x6FC2CA20` (`SKILLS_SrvDo141_BaalCorpseExplode`)
  - `[144]` = `0x6FC63D40` (`SKILLS_SrvDo144_Hydra`)
  - `[150]` = `0x6FCB9000` (`SKILLS_SrvDo150_Smite`)
- **`g_apfnMissileSrvDoFunc`** (`0x6FD2D970`):
  - `[3]` = `0x6FC61AE0` (`MISSMODE_SrvDo03_PoisonCloud_Blizzard_ThunderStorm_HandOfGod`)
  - `[10]` = `0x6FC613D0` (`MISSMODE_SrvDo10_BlizzardCenter`)
  - `[31]` = `0x6FC5F9F0` (`MISSMODE_SrvDo31_WakeOfDestructionMaker_BaalColdMaker`)
  - `[34]` = `0x6FC61C30` (`MISSMODE_SrvDo34_BaalTauntControl`)
- **`g_apfnMissileSrvHitFunc`** (`0x6FD2DA48`):
  - `[1]` = `0x6FC5B990` (`MISSMODE_SrvHit01_Fireball_ExplodingArrow_FreezingArrowExplosion`)
  - `[2]` = `0x6FC5E330` (`MISSMODE_SrvHit02_PlagueJavelin_PoisonPotion`)
  - `[14]` = `0x6FC5DEF0` (`MISSMODE_SrvHit14_MeteorCenter_CatapultMeteor_RoyalStrikeMeteor`)
  - `[18]` = `0x6FC5EA60` (`MISSMODE_SrvHit18_Shout_BattleCommand_BattleOrders`)
  - `[36]` = `0x6FC5AB30` (`MISSMODE_SrvHit36_MissileInAir`)
  - `[38]` = `0x6FC5C5B0` (`MISSMODE_SrvHit38_CatapultChargedBall`)
  - `[40]` = `0x6FC5C490` (`MISSMODE_SrvHit40_CatapultSpikeBall`)
  - `[43]` = `0x6FC59E30` (`MISSMODE_SrvHit43_HealingVortex`)
  - `[54]` = `0x6FC5BC80` (`MISSMODE_SrvHit54_BaalSpawnMonsters`)
  - `[55]` = `0x6FC596E0` (`MISSMODE_SrvHit55_Baalnferno`)
  - `[58]` = `0x6FC5BED0` (`MISSMODE_SrvHit58_BaalTauntLightningControl`)
  - `[59]` = `0x6FC5D800` (`MISSMODE_SrvHit59_BaalTauntPoisonControl`)
- **AI Dispatch (`AITHINK_FnTable`)**:
  - `AITHINK_Fn034_Andariel` = `0x6FCD8090` (`uberandariel` / Lilith)
  - `AITHINK_Fn044_Duriel` = `0x6FCD8FE0` (`uberduriel`)
  - `AITHINK_Fn120_Overseer` = `0x6FCE1550` (`overseer1` / Shenk)
  - `AITHINK_Fn126_CatapultSpotter` = `0x6FCEE6F0`
  - `AITHINK_Fn128_Nihlathak` = `0x6FCEEE60` (`nihlathakboss`)
  - `AITHINK_Fn133_Ancient` = `0x6FCEFBC0` (`ancientbarb1..3`)
  - `AITHINK_Fn134_BaalThrone` = `0x6FCEFBF0` (`baalthrone`)
  - `AITHINK_Fn135_BaalCrab` = `0x6FCCD520` (`baalcrab`)
  - `AITHINK_Fn136_BaalTaunt` = `0x6FCF0180` (`baaltaunt`)
  - `AITHINK_Fn137_BaalCrabClone` = `0x6FCCEB70` (`baalclone`)
  - `AITHINK_Fn143_UberMephisto` (`ubermephisto`)
  - `AITHINK_Fn144_UberDiablo` (`uberdiablo`)
  - `AITHINK_Fn145_UberIzual` (`uberizual`)
  - `AITHINK_Fn146_UberBaal` (`uberbaal`)

### `D2Client.dll` (`ImageBase = 0x6FAB0000`)
- **`g_apfnSkillCltStFunc`** (`0x6FB8E928`):
  - `[21]` = `0x6FB78330` (`SKILLS_CltSt21_CorpseExplosion`)
  - `[25]` = `0x6FADBF40` (`SKILLS_CltSt25_Charge`)
  - `[30]` = `0x6FB77550` (`SKILLS_CltSt30_LeapAttack`)
  - `[31]` = `0x6FB77370` (`SKILLS_CltSt31_Whirlwind`)
  - `[34]` = `0x6FB07120` (`SKILLS_CltSt34_AndrialSpray`)
  - `[46]` = `0x6FB74FC0` (`SKILLS_CltSt46_BaalTaunt`)
  - `[47]` = `0x6FB752E0` (`SKILLS_CltSt47_Catapult`)
  - `[48]` = `0x6FB74550` (`SKILLS_CltSt48_MonTeleport`)
- **`g_apfnSkillCltDoFunc`** (`0x6FB8EA48`):
  - `[25]` = `0x6FB23CB0` (`SKILLS_CltDo25_NovaAttack` -> `0x6FB51020`)
  - `[32]` = `0x6FB78FB0` (`SKILLS_CltDo32_CorpseExplosion`)
  - `[44]` = `0x6FB76D00` (`SKILLS_CltDo44_LeapAttack`)
  - `[45]` = `0x6FB764B0` (`SKILLS_CltDo45_Whirlwind`)
  - `[48]` = `0x6FB073A0` (`SKILLS_CltDo48_AndrialSpray`)
  - `[54]` = `0x6FB08C90` (`SKILLS_CltDo54_MonInferno`)
  - `[55]` = `0x6FB081F0` (`SKILLS_CltDo55_PrimePoisonNova`)
  - `[73]` = `0x6FB744D0` (`SKILLS_CltDo73_BaalTeleport`)
  - `[74]` = `0x6FB75050` (`SKILLS_CltDo74_ImpTeleport`)
  - `[81]` = `0x6FB74C10` (`SKILLS_CltDo81_BaalColdMissiles`)
- **`g_apfnMissileCltDoFunc`** (`0x6FB8D8A0`):
  - `[4]` = `0x6FB6BE00` (`MISSMODE_CltDo04_PoisonCloud_Blizzard`)
  - `[8]` = `0x6FB691C0` (`MISSMODE_CltDo08_Firewall_ImmolationFire_MeteorFire`)
  - `[13]` = `0x6FB6BC10` (`MISSMODE_CltDo13_BlizzardCenter`)
  - `[43]` = `0x6FB62890` (`MISSMODE_CltDo43_MissileInAir`)
  - `[52]` = `0x6FB672D0` (`MISSMODE_CltDo52_WakeOfDestructionMaker_BaalColdMaker`)
  - `[56]` = `0x6FB670A0` (`MISSMODE_CltDo56_BaalTauntControl`)
- **`g_apfnMissileCltHitFunc`** (`0x6FB8DA10`):
  - `[2]` = `0x6FB62380` (`MISSMODE_CltHit02_PlagueJavelin_PoisonPotion`)
  - `[46]` = `0x6FB6AAC0` (`MISSMODE_CltHit46_CatapultChargedBall`)
  - `[47]` = `0x6FB6BFA0` (`MISSMODE_CltHit47_CatapultSpikeBall`)
  - `[48]` = `0x6FB60B70` (`MISSMODE_CltHit48_CatapultCold`)
  - `[50]` = `0x6FB6AA70` (`MISSMODE_CltHit50_CatapultMeteor`)
  - `[57]` = `0x6FB6BF30` (`MISSMODE_CltHit57_BaalSpawnMonsters`)
  - `[62]` = `0x6FB63720` (`MISSMODE_CltHit62_BaalTauntLightningControl`)
  - `[63]` = `0x6FB69BB0` (`MISSMODE_CltHit63_BaalTauntPoisonControl`)

---

## 2. Baal (`baalcrab` #544) & Vile Effigy (`baalclone` #570)

### 2.1 Monster Profiles (`MonStats.txt` & `MonStats2.txt`)

| Stat / Field | `baalcrab` (#544) | `baalclone` (#570, Vile Effigy) |
| :--- | :--- | :--- |
| **`AI`** | `BaalCrab` (`0x6FCCD520`) | `BaalCrabClone` (`0x6FCCEB70`) |
| **`SizeX` / `SizeY`** | `3` / `3` | `3` / `3` |
| **`InfernoLen` / `Anim` / `Rollback`** | `1` / `10` / `11` | `1` / `10` / `11` |
| **`Level` (N / NM / H)** | `60` / `75` / `99` | `60` / `69` / `95` |
| **`MinHP` / `MaxHP`** | `6336` / `6336` | `1901` / `1901` (Overridden at spawn to `BaalMaxHP / 3`) |
| **`Velocity` / `Run`** | `6` / `6` | `6` / `6` |
| **`DamageRegen`** | `0` | `0` (`STAT_HPREGEN` forced to `0` at spawn) |
| **`ResDm` (N / NM / H)** | `0` / `0` / `50%` | `0` / `0` / `50%` |
| **`ResFi` / `ResLi` / `ResCo` (N / NM / H)** | `33%` / `50%` / `50%` | `15%` / `25%` / `25%` |
| **`ResPo` (N / NM / H)** | `50%` / `50%` / `50%` | `33%` / `25%` / `25%` |
| **`A1` Melee (N / NM / H)** | `55–120` / `85–155` / `157–251` | `55–110` / `80–120` / `150–250` |
| **`A2` Melee (N / NM / H)** | `80–130` / `90–145` / `169–263` | `65–120` / `85–130` / `160–260` |
| **`Skill1` (`S1`)** | `Baal Nova` (#316, `slvl=1`) | `Baal Nova` (#316, `slvl=1`) |
| **`Skill2` (`S3` seq)** | `Baal Inferno` (#317, `slvl=1`) | `Baal Inferno` (#317, `slvl=1`) |
| **`Skill3` (`SC`)** | `Baal Tentacle` (#315, `slvl=1`) | `Baal Tentacle` (#315, `slvl=1`) — disabled in Clone AI |
| **`Skill4` (`SC`)** | `Baal Cold Missiles` (#318, `slvl=1`) | `Baal Cold Missiles` (#318, `slvl=1`) |
| **`Skill5` (`S2`)** | `Baal Teleport` (#329, `slvl=1`) | `Baal Clone Teleport` (#331, `slvl=1`) |
| **`Skill6` (`SC`)** | `Defense Curse` (#309, `slvl=3`) | `Defense Curse` (#309, `slvl=3`) |
| **`Skill7` (`SC`)** | `Blood Mana` (#310, `slvl=3`) | `Blood Mana` (#310, `slvl=3`) |

> [!NOTE]
> `Skills.txt` maps `Baal Inferno` (#317) to `monanim = S3` with `seqnum = 17` (`seq_baalinferno`), triggering `MONMODE_SEQUENCE` using `MonStats2.txt` `InfernoLen = 1`, `InfernoAnim = 10`, and `InfernoRollback = 11`.

### 2.2 Baal AI State Machine (`AITHINK_Fn135_BaalCrab` @ `0x6FCCD520`)

1. **Initialization (`dwAiParam[0] == 0`)**:
   - Sets `dwAiParam[0] = 1` and stores Baal's spawn anchor coordinates in `pAiCmd->nCmdParam[1]` (`X`) and `pAiCmd->nCmdParam[2]` (`Y`).
   - Registers each skill's level into Baal's `D2SkillListStrc` with `+2` skill levels in Nightmare and `+4` skill levels in Hell (`AI_GetDifficultyAddedSkillLevels`).
2. **Clone Lifecycle Check (`AIBAAL_UpdateCloneFlags`)**:
   - `dwAiParam[1]` tracks how many Vile Effigies have been spawned in this encounter (`0..2`).
   - `dwAiParam[2]` is `1` while a Vile Effigy (`baalclone` #570) is alive; if the clone dies or no longer exists, `dwAiParam[2]` resets to `0`.
3. **16-Slot Action Weight Table (`AIBAAL_RollRandomAiParam` / `AIBAAL_RollRandomAiParamForNonCollidingUnit`)**:
   - **No Target**: If distance from spawn anchor $> 25$ sub-tiles, `50%` Idle / `50%` Walk back to spawn anchor (`nParam = 5`); else `80%` Idle / `20%` Walk close (`nParam = 4`).
   - **Melee Range (`bCombat == 1`)**:
     - `aiParams[1]` (Idle): `5`
     - `aiParams[2]` (Walk within 12): `10`
     - `aiParams[3]` (Circle target): `10`
     - `aiParams[8]` (Curse — `Defense Curse` or `Blood Mana`): `35` if target lacks `STATE_DEFENSE_CURSE` and `STATE_BLOOD_MANA`, else `0`
     - `aiParams[9]` (`Baal Tentacle`): `20`
     - `aiParams[10]` (`MONMODE_ATTACK2` melee swing): `30`
     - `aiParams[11]` (`Baal Nova`): `15`
     - `aiParams[12]` (`Baal Inferno`): `30`
     - `aiParams[13]` (`Baal Cold Missiles`): `20`
     - `aiParams[14]` (`Baal Teleport` away): `5`
     - `aiParams[15]` (Spawn `baalclone`): `10 * (2 - dwAiParam[1])` if `dwAiParam[2] == 0` (`20` before first clone, `10` after first clone dies, `0` after 2 clones or while clone is alive).
   - **Ranged — Clear Missile LoS (`!COLLIDE_CheckAnyCollisionWithPattern(..., COLLIDE_MISSILE_BARRIER)`)**:
     - `aiParams[1]` (Idle): `5`
     - `aiParams[2]` (Walk within 12): `10`
     - `aiParams[3]` (Circle): `5`
     - `aiParams[6]` (Walk within 12): `20`
     - `aiParams[8]` (Curse): `35` if target uncursed, else `0`
     - `aiParams[9]` (`Baal Tentacle`): `30`
     - `aiParams[11]` (`Baal Nova`): `25`
     - `aiParams[12]` (`Baal Inferno`): `35` if `nTargetDist < 15`, else `0`
     - `aiParams[13]` (`Baal Cold Missiles`): `35` if `nTargetDist < 30`, else `0`
     - `aiParams[14]` (`Baal Teleport`): `5` (`25` if `nTargetDist >= 20`)
     - `aiParams[15]` (Spawn `baalclone`): `10 * (2 - dwAiParam[1])` if `dwAiParam[2] == 0`
   - **Ranged — Blocked Missile LoS**:
     - `aiParams[1]` (Idle): `10`
     - `aiParams[2]` (Walk within 12): `35`
     - `aiParams[3]` (Circle): `15`
     - `aiParams[6]` (Walk within 12): `35`
     - `aiParams[8]` (Curse): `35` if target uncursed, else `0`
     - `aiParams[9]` (`Baal Tentacle`): `30`
     - `aiParams[11]` (`Baal Nova`): `15`
     - `aiParams[14]` (`Baal Teleport`): `30`
     - `aiParams[15]` (Spawn `baalclone`): `10 * (2 - dwAiParam[1])` if `dwAiParam[2] == 0`
4. **Action Execution (`AIBAAL_MainSkillHandler` @ `0x6FCCE450`)**:
   - `nParam == 1`: Idle for `35` (Normal), `15` (Nightmare), or `5` (Hell) frames (`aip1`).
   - `nParam == 8` (**Curse Selector**):
     - Evaluates `STATLIST_GetMaxLifeFromUnit(pTarget) > STATLIST_GetMaxManaFromUnit(pTarget)`.
     - If `MaxLife > MaxMana` (or target is not a player), casts **`Skill6 = Defense Curse` (#309)**.
     - If `MaxMana >= MaxLife` on a player, casts **`Skill7 = Blood Mana` (#310)**.
   - `nParam == 15` (**Spawn Vile Effigy**):
     - Casts `Baal Clone Teleport` (#331) on self (`cltmissilea = baalclonedeath` #614), spawns `MONSTER_BAALCLONE` (#570) near target (`sub_6FC6A090`), increments `dwAiParam[1]`, sets `dwAiParam[2] = 1`, stores clone `dwUnitId` in `pAiCmd->nCmdParam[4]`, sets clone `STAT_MAXHP = BaalMaxHP / 3`, `STAT_HITPOINTS = BaalCurHP / 3`, and `STAT_HPREGEN = 0`.
5. **Vile Effigy AI (`AITHINK_Fn137_BaalCrabClone` @ `0x6FCCEB70`)**:
   - Despawns immediately (`SUNIT_RemoveUnit`) if parent Baal is dead (`MONSTER_CheckBossMode`) or after `aip2` idle despawn timer (`150` ticks without target).
   - Uses `AIBAAL_RollRandomAiParam`, then overrides `nParam` values `7, 9, 14, 15` to `2` (Walk within 12 of target) so a clone never spawns tentacles, never teleports via `nParam=14`, and never spawns sub-clones.

### 2.3 Baal Skill & Missile Mechanics

| Skill (`Id`) | `SrvSt` / `SrvDo` | `CltSt` / `CltDo` | Missile (`Id`) | Mechanics & Damage Formula |
| :--- | :--- | :--- | :--- | :--- |
| **`Baal Nova`** (#316) | `0` / `22` (`0x6FC63AA0`) | `0` / `25` (`0x6FB23CB0`) | `baal nova` (#555) | Spawns **32 radial bolts** (`Vel=20, Range=40, Size=2, NextHit=1, NextDelay=4`). `HitShift=8`, Fire `50–75` (`slvl=1`), `+20–25/lvl` (`slvl 2–8`), `+30–35/lvl` (`slvl 9+`). |
| **`Baal Inferno`** (#317) | `53` (`0x6FCD2ED0`) / `95` (`0x6FCD6A60`) | `0` / `54` (`0x6FB08C90`) | `baal inferno` (#554) | Channels for `Param1 = 20` frames (`calc3 = 2` interval), spawning `baal inferno` (`Vel=15, Accel=250, MaxVel=40, Size=3, Range = Param2+slvl-1 = 12`, `NextHit=1, NextDelay=4`). `HitShift=5` (`/32`), Magic `64–96` (`+24/lvl`). **`MISSMODE_SrvHit55_Baalnferno` (`0x6FC596E0`)** drains **`sHitPar1 = 50%`** of target player's current `STAT_MANA` on each hit! |
| **`Baal Cold Missiles`** (#318, Hoarfrost) | `0` / `139` (`0x6FC2D290`) | `0` / `81` (`0x6FB74C10`) | `baal cold maker` (#589) -> `baal cold trail` (#590) | Server (`SKILLS_SrvDo139`) & Client (`SKILLS_CltDo81`) spawn `baal cold maker` (`Vel=20, Range=50, KnockBack=75`) aimed at target and store perpendicular vector `(-dY, +dX)` into `pMissile->nTargetX/Y`. Every sub-tile step (`PATH_GetNewDistance`), `SrvDo31` (`0x6FC5F9F0`) & `CltDo52` (`0x6FB672D0`) spawn 2 perpendicular `baal cold trail` (`Vel=13, Range=20, KnockBack=75, NextHit=1, NextDelay=4`) missiles at `(+perpX, +perpY)` and `(-perpX, -perpY)`, forming an expanding V-wedge. Cold `20–40` (`HitShift=8`, `ELen=200` frames) + **75% Knockback**. |
| **`Baal Tentacle`** (#315) | `0` / `140` (`0x6FC2CB30`) | `0` / `0` | — | Spawns `nDifficulty + (rand % 3) + 2` (`2..4` N, `3..5` NM, `4..6` H) Festering Appendages (`baaltentacle1..5` #562..566, `UNITFLAG_NOXP \| UNITFLAG_NOTC`) near target (`aiParams[0] = 25 * (rand(0..9) + 10)` frames = `10..19`s lifespan). |
| **`Baal Teleport`** (#329) | `0` / `98` (`0x6FCD46B0`) | `48` (`0x6FB74550`) / `73` (`0x6FB744D0`) | `baal teleport` (#595) | Server (`SKILLS_SrvDo098`) teleports `baalcrab` **25 sub-tiles away** from target (`nX + 25*(nX - nTargetX)/nDist`), whereas `uberbaal` (#709) teleports **directly onto `(nTargetX, nTargetY)`**. Client `CltSt48` spawns `cltmissilea` at origin; `CltDo73` spawns `cltmissileb` at destination. |
| **`Defense Curse`** (#309) | `0` / `30` (`0x6FC705D0`) | `18` (`0x6FB785C0`) / `30` (`0x6FB78B40`) | `cursedefense` | Applies `STATE_DEFENSE_CURSE` (`skill_armor_percent = -(50 + 5*(slvl-1))`), reducing Defense by **`-60%`** (`slvl=3`), **`-70%`** (`slvl=5` NM), or **`-80%`** (`slvl=7` H) for `250 + 50*(slvl-1)` frames (`350`–`550` frames). |
| **`Blood Mana`** (#310) | `0` / `30` (`0x6FC705D0`) | `18` (`0x6FB785C0`) / `30` (`0x6FB78B40`) | `cursebloodmana` | Applies `STATE_BLOOD_MANA` (`curseresist=1`). Whenever cursed player casts a skill (`D2GAME_SKILLS_BloodMana_6FD025E0`), deducts `nManaCost` from `STAT_HITPOINTS` (`cursebloodmana` overlay `curselifedrain`). If HP `< Param5 (40)` (`10240` fixed-point) or `< nManaCost`, removes `STATE_BLOOD_MANA` and clamps HP to `1` (`256` fixed-point). |

---

## 3. Baal Throne (`baalthrone` #543), 5 Throne Waves & `baaltaunt` (#545)

### 3.1 Baal Throne AI (`AITHINK_Fn134_BaalThrone` @ `0x6FCEFBF0`)

1. **Active Wave Combat (`arg.unk0x08 != 0`)**:
   - Scans a **64-sub-tile radius** (`sub_6FCF0040`) for any active hostile monster (`!MONSTER_CheckBossMode`).
   - While any wave monster is alive, if Baal Throne has a valid player target lacking `STATE_DECREPIFY`, rolls `aip1 = 25%` (`AI_GetParamValue(pGame, pAiTickParam, 0)`) to cast **`Skill1 = Decrepify` (#87, `slvl=5`)**.
2. **Between-Wave Sequence (`arg.unk0x08 == 0`)**:
   - **Even Step (`!(dwAiParam[1] & 1)`)**:
     - Increments `dwAiParam[1]`.
     - Purges prior wave corpses (`sub_6FCC6470`).
     - Casts **`Skill2 = Baal Corpse Explode` (#285)** (`SKILLS_SrvDo141_BaalCorpseExplode` @ `0x6FC2CA20`), exploding corpses within radius `ln34 = 6` sub-tiles for `Param5 = 40%` corpse max HP (50% Physical / 50% Fire).
     - Attaches laugh sound (`16`) and stalls for **`250` frames (`10` seconds)**.
   - **Odd Step (`dwAiParam[1] & 1`)**:
     - Computes `nWave = dwAiParam[1] / 2` (`0..4`), increments `dwAiParam[1]`.
     - Assigns **`Baal Monster Spawn` (#286, `lob=1`)**, sets `Skill Param1 = SuperUniqueId`, and lobs `baal spawn monsters` (#550, `SrvHit=54` @ `0x6FC5BC80`, `CltHit=57` @ `0x6FB6BF30`) to `(BaalX, BaalY + 13)`.
     - On impact, `MISSMODE_SrvHit54_BaalSpawnMonsters` spawns the wave's SuperUnique and minions (`100` frame activation delay) and clears `dwAiParam[2]`.
   - **Post-Wave 5 (`nWave == 5`)**:
     - Reinitializes Baal Throne into `MONSTER_BAALCRABSTAIRS` (`AI = BaalToStairs` @ `0x6FCF0090`), walks to `OBJECT_BAALS_PORTAL_WORLDSTONECHAMBER`, calls `ACT5Q6_OpenWorldStoneChamber`, and removes the unit.

### 3.2 The 5 Throne of Destruction Waves

| Wave | `SuperUniques.txt` ID (`hcIdx`) | Display Name | Base Monster (`Id` / `#hcIdx`) | Fixed UMods (`Mod1` / `Mod2`) | Group Size (N / NM / H) | Key Skills & Special Properties |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `Baal Subject 1` (`#61`) | **Colenzo the Annihilator** | `fallenshaman5` (`#62`, Warped Shaman) | `Fire Enchanted` (`9`) | `6–6` / `7–7` / `9–9` (`warpedfallen`) | `ResFi(H)=110%`. Casts `Resurrect` (#181, `SrvDo=97`) and `ShamanFire` (#160, Fire Ball). |
| **2** | `Baal Subject 2` (`#62`) | **Achmel the Cursed** | `unraveler5` (`#105`, Horadrim Ancient) | `Poisonuet` (`23`, Poison Enchanted) | `3–3` / `3–3` / `3–3` (+ Cold Skeleton Mages) | `ResMa(H)=100%, ResPo(H)=100%`. Casts `Resurrect2` (#327, `SrvDo=97`), `Bestow` (#182, `SrvDo=96`), `UnHolyBolt` (#157), and melee poison cloud (`mummy4` #66, `HitShift=1`). |
| **3** | `Baal Subject 3` (`#63`) | **Bartuc the Bloody** | `baalhighpriest` (`#557`, Council Member) | `Lightning Enchanted` (`17`) | `5–5` / `5–5` / `5–5` | `MonProp = baalhighpriest` (`extra-fire` `+60` NM / `+120` H). Casts `Hydra` (#62, `slvl=4`, `SrvSt=14, SrvDo=144`), `ZakarumHeal` (#179, `slvl=4`, `SrvDo=96`), and `highpriestlightning` (#343). |
| **4** | `Baal Subject 4` (`#64`) | **Ventar the Unholy** | `venomlord` (`#558`, Venom Lord) | `Extra Fast` (`6`) | `6–6` / `8–8` / `10–10` | `ResFi(H)=95%, ResPo(H)=120%`. Casts `MegademonInferno` (#319, `slvl=4`, `SrvSt=53, SrvDo=95`, `InfernoLen=1, Anim=10, Rollback=11`). |
| **5** | `Baal Subject 5` (`#65`) | **Lister the Tormentor** | `baalminion1` (`#571`, Minion of Destruction) | `Spectral Hit` (`27`) | `5–5` / `6–6` / `7–7` | `ResFi(H)=120%, ResPo(H)=95%, DamageRegen=3`. AI (`AITHINK_Fn139_BaalMinion`) gives `aip2 = 50%` chance in melee to cast **`Smite` (#97, `slvl=1`, `SrvDo=150` @ `0x6FCB9000`)**, dealing auto-hit Physical damage + **Knockback** + **Stun** (`STATE_STUNNED`). |

### 3.3 `baaltaunt` (#545) & `Baal Taunt` (#284)

- **Invisible Controller AI (`AITHINK_Fn136_BaalTaunt` @ `0x6FCF0180`)**:
  - Spawned in Act 5 outdoor/Worldstone Keep levels (`SizeX=0, SizeY=0, Velocity=14`).
  - Tracks nearest player; if player stands still (`PLRMODE_NEUTRAL`) for $> \text{aip2} = 10$ AI ticks within `aip3 = 20` sub-tiles, casts **`Baal Taunt` (#284)** (`SrvDo=28` @ `0x6FC62D90`, `CltSt=46` @ `0x6FB74FC0`).
- **Controller Missile (`baal taunt control` #546)**:
  - `Range = 75` frames (`3` seconds).
  - Server (`MISSMODE_SrvDo34_BaalTauntControl` @ `0x6FC61C30`) and Client (`MISSMODE_CltDo56_BaalTauntControl` @ `0x6FB670A0`) run in lockstep using `SEED_InitSeed(&pMissile->pSeed)` seeded from the target's X coordinate (`D2Common#10614` @ `0x6FD86740`).
  - While `nRemainingFrames >= Param1 (25)`, rolls `nIdx = SEED_RollLimitedRandomNumber(&pMissile->pSeed, 2)` (`0` or `1`):
    - **`nIdx == 0` (Lightning Strike)**: Every `Param2 = 3` frames (`nRemainingFrames % 3 == 0`), spawns `baal taunt lightning control` (#654) and triggers `SrvHit=58` (`0x6FC5BED0`) / `CltHit=62` (`0x6FB63720`), which spawns `baal taunt lightning` (#547, `HitShift=8`, Lightning `1–30` + `+20/lvl` max) at random offset `[-10..+10]` sub-tiles (`sHitPar1 = 10`).
    - **`nIdx == 1` (Poison Cloud Ring)**: Every `Param3 = 45` frames (`nRemainingFrames % 45 == 0`), spawns `baal taunt poison control` (#655) and triggers `SrvHit=59` (`0x6FC5D800`) / `CltHit=63` (`0x6FB69BB0`), calling `MISSMODE_CreatePoisonCloudHitSubmissiles` (`0x6FB66BC0` on client) with `sHitPar1 = 6` to spawn a ring of `baal taunt poison` (#549, `Range=75`, Poison `HitShift=4`, `ELen=100` frames).

---

## 4. Nihlathak (`nihlathakboss` #526)

### 4.1 Profile & AI (`AITHINK_Fn128_Nihlathak` @ `0x6FCEEE60`)
- **Stats**: `Level = 65 / 70 / 92`, `MinHP = MaxHP = 191`, `ResCo = 70%, ResPo = 70%` (plus `ResMa(H)=25%, ResFi(H)=33%, ResLi(H)=33%` in Hell), `Velocity = 7`, `SizeX = SizeY = 2`.
- **Decision Priority**:
  1. **Melee Escape Teleport**: If `bCombat == 1`, rolls `aip1 = 30%` to cast **`Skill1 = Imp Teleport` (#330, `slvl=1`)** (`SKILLS_SrvDo129_ImpTeleport` @ `0x6FC2DBD0`, `CltSt=48`, `CltDo=74` @ `0x6FB75050`) to a random walkable tile within `aip2 = 20` sub-tiles (`baal teleport` #595 visual).
  2. **Close-Range Retreat**: If target distance $< \text{aip5} (8)$ sub-tiles, rolls `40%` to walk away (`AITACTICS_WalkAwayFromUnit(..., 10)`).
  3. **Corpse Explosion**: Rolls `aip3 = 80%` to search for a corpse within `ln34` sub-tiles (`sub_6FCEEA60`) and cast **`Skill3 = NihlathakCorpseExplosion` (#351, `slvl=1`)**.
  4. **Arctic Blast**: If target distance $< 14$ sub-tiles, rolls `60%` (or fallback when minion skills fail) to cast **`Skill4 = Horror Arctic Blast` (#323, `slvl=20`)** (`SrvSt=53, SrvDo=95, CltDo=54, seqnum=18` `seq_nihlathakarctic`), channeling `Param1 = 15` frames of `frozenhorror arcticblast1` (#493, `HitShift=7`, Cold damage + chill).
  5. **Whip or Summon Minion**: Rolls `aip4 = 75%`:
     - If an unwhipped `minion1` is within 25 sub-tiles (`625` sq dist), casts **`Skill2 = Overseer Whip` (#295)**.
     - Otherwise, if $< \text{aip6} (6)$ minions are nearby, casts **`Skill5 = MinionSpawner` (#302, `slvl=1`)** (`SrvSt=62` @ `0x6FC2BF90`, `SrvDo=135` @ `0x6FC2CDC0`), spawning an Ice Spawn (`minion1` #449) with `UNITFLAG_NOXP | UNITFLAG_NOTC`.

### 4.2 `NihlathakCorpseExplosion` (#351) vs Player `Corpse Explosion` (#74)
- Dispatches to **`SKILLS_SrvSt17_Poison_CorpseExplosion` (`0x6FC6EEE0`)** and **`SKILLS_SrvDo055_CorpseExplosion` (`0x6FC6F4D0`)** (Client: `CltSt=21` @ `0x6FB78330`, `CltDo=32` @ `0x6FB78FB0`).
- **Damage Formula (`0x6FC6F4D0`)**:
  - Queries corpse monster's base `STAT_MAXHP` (scaled down by active player count divisor in multiplayer).
  - Rolls uniform random percentage in `[Param1, Param2]` = **`[10%, 20%]` of corpse base MaxHP** (`Param1=10, Param2=20` in 1.13c, nerfed from 70–120% in 1.09).
  - Splits damage into **`100 - Param5 = 50%` Physical** and **`Param5 = 50%` Fire** (`Param5 = 50`).
  - **Blast Radius**: `min(30, (Param3 + slvl - 1) / 2)` where `Param3 = 32` (`ln34` halved in `SrvDo055`), yielding **`16` sub-tiles (`10.6` yards)** at `slvl=1` (`17` sub-tiles in NM `slvl=3`, `18` sub-tiles in H `slvl=5`).

### 4.3 `Overseer Whip` (#295, `SKILLS_SrvDo131_OverseerWhip` @ `0x6FC2D9C0`)
- Rolls `(SEED_RollRandomNumber(&pUnit->pSeed) % 100) >= Param6 (65)`:
  - **35% Chance (`>= 65`)**: Transforms the targeted `minion1` into a Frenzied Ice Spawn (`suicideminion1` #465) via `MONSTER_Reinitialize`, applying `sumumod = 33` (Freeze-on-death explosion) and `whipbloodlust` overlay (`54`).
  - **65% Chance (`< 65`)**: Applies **`STATE_BLOODLUST`** (`D2CurseStrc`) for `Param1 = 250` frames (`10`s), granting **`+80%` Velocity** (`Param2`), **`+80%` Attack Rating** (`Param4`), **`+50%` Defense** (`Param5`), and **`+100%` Damage** (`Param3`).

---

## 5. The Ancients (`ancientbarb1..3` #540..542)

### 5.1 Arreat Summit Quest Mechanics (`A5Q5.cpp` & `AiThink.cpp`)
- **Town Portal Reset (`ACT5Q5_DeactivateAncientMonsters`)**: Opening any Town Portal on `LEVEL_ARREATSUMMIT` (`pQuestDataEx->nActivePortalCount > 0`) immediately resets all living Ancients back into untargetable stone statues (`OBJMODE_NEUTRAL`, `SUNIT_RemoveUnit`), requiring the Altar of the Heavens (`OBJECT_ANCIENTSALTAR`) to be activated again.
- **Shared Base Stats**: `Level = 37 / 68 / 87`, `MinHP = 500, MaxHP = 600`, `Velocity = Run = 10`, `SizeX = SizeY = 2`, `ResDm(H) = 40%`. Spawned with random boss UMods in Nightmare and Hell.

### 5.2 Individual Ancient Profiles & AI (`AITHINK_Fn133_Ancient` @ `0x6FCEFBC0`)

| Ancient (`SuperUniques.txt`) | `MonStats.txt` ID (`#hcIdx`) | Hell Elemental Immunity | AI Handler (`D2Game.dll`) | Skills & Combat Mechanics |
| :--- | :--- | :--- | :--- | :--- |
| **Talic** (`Ancient Barbarian 1` #66) | `ancientbarb1` (`#540`) | **Fire Immune** (`ResFi(H) = 110%`) | `AITHINK_AncientBarb1SkillHandler` (`0x6FCEF3F0`) | Within `aip1 = 15` sub-tiles, rolls `aip2 = 25%` to cast **`Whirlwind` (#151, `slvl=15`)** (`SrvSt=38` @ `0x6FC48290`, `SrvDo=76` @ `0x6FC48BE0`, `CltSt=31` @ `0x6FB77370`, `CltDo=45` @ `0x6FB764B0`, `seqnum=20` `seq_ancientwhirlwind`), overshooting target by `aip4 = 8` sub-tiles (`nDiff * 8 / nDist`). Otherwise melee `A1`/`A2`. |
| **Madawc** (`Ancient Barbarian 2` #67) | `ancientbarb2` (`#541`) | **Lightning Immune** (`ResLi(H) = 100%`) | `AITHINK_AncientBarb2SkillHandler` | In melee, rolls `aip4 = 25%` to escape (`aip5 = 7` steps). If neither self nor target has `STATE_SHOUT`, rolls `aip3 = 25%` to cast **`Shout` (#138, `slvl=5`)** (`SrvDo=68` @ `0x6FC49720`, `Miss=shout` #273, `SrvHit=18` @ `0x6FC5EA60`, **`+140%` Defense** for `1500` frames). Within `aip1 = 15` sub-tiles, rolls `aip2 = 50%` to throw **`ancient throwing axe` (#525)** (`MONMODE_ATTACK1`, `Vel=24, Range=30`). (`MonStats.txt` also defines `Skill2 = Double Throw` #140 `slvl=12`.) |
| **Korlic** (`Ancient Barbarian 3` #68) | `ancientbarb3` (`#542`) | **Cold Immune** (`ResCo(H) = 150%`) | `AITHINK_AncientBarb3SkillHandler` (`0x6FCEFA10`) | Within `aip1 = 15` sub-tiles, rolls `aip2 = 50%` to cast **`Leap Attack` (#143, `slvl=5`)** (`SrvSt=41` @ `0x6FC48600`, `SrvDo=78` @ `0x6FC493B0`, `CltSt=30` @ `0x6FB77550`, `CltDo=44` @ `0x6FB76D00`, `seqnum=19` `seq_ancientleap`, `+200%` Damage, `+110%` AR). Otherwise closes distance and swings `A1`/`A2`. |

---

## 6. Shenk the Overseer (`overseer1` #479, `Siege Boss`) & Catapults

### 6.1 Shenk the Overseer (`SuperUniques.txt`: `Siege Boss` #58)
- **Stats**: `Level = 36 / 67 / 80`, `MinHP = MaxHP = 380`, `DamageRegen = 3`, `Velocity = 4`, `SizeX = SizeY = 3`, `ResDm(H) = 40%, ResFi(H) = 33%, ResLi(H) = 20%, ResCo(H) = 120%` (**Cold Immune** in Hell).
- **Fixed UMods**: `Mod1 = 5` (`Extra Strong`), `Mod2 = 25` (`Mana Burn`).
- **AI (`AITHINK_Fn120_Overseer` @ `0x6FCE1550`)**:
  1. **`Cry Help` (#290, `slvl=1`)**: Every `aip1 = 250` frames (`10`s), casts `SKILLS_SrvDo128_CryHelp` (`0x6FC2C310`), iterating all friendly minions within radius `ln12 = 16` sub-tiles, issuing AI command `1` (`targetType, targetGUID, timeout = dwGameFrame + 100`) to focus Shenk's target, and applying `curseattract` overlay.
  2. **`Healing Vortex` (#291, `slvl=1`)**: If any minion within 24 sub-tiles (`576` sq dist) has `< 50%` HP, rolls `aip6 = 100%` to fire `healing vortex` (#425, `Vel=16, Range=40`, `SrvHit=43` @ `0x6FC59E30`), healing the friendly monster for `10–20 (+5/lvl)` HP (`HitShift=8`).
  3. **`Overseer Whip` (#295, `slvl=1`)**: Rolls `aip7 = 50%` (N) / `30%` (NM/H) to whip an unwhipped `minion1` within 24 sub-tiles (35% transform into `suicideminion1`, 65% `STATE_BLOODLUST`).
- **Death Catapult Barrage (`ACT5Q1_Callback08_MonsterKilled` @ `0x6FCB1830`)**:
  - When Shenk dies, `ACT5Q1_Callback08_MonsterKilled` invokes **`QUESTS_TriggerFX(pGame, 15)`**, raining catastrophic catapult explosions across his platform around his corpse.

### 6.2 Siege Catapults (`catapult1..4` #497..500 & `catapultspotter1..4` #516..519)
- Invisible spotters (`AITHINK_Fn126_CatapultSpotter` @ `0x6FCEE6F0`) detect players within `aip2 = 50` sub-tiles (and outside `aip1 = 10` minimum range) and command paired `catapult` units (`AITHINK_Fn121_Catapult`) to lob one of 5 artillery skills (`SrvDo=28` @ `0x6FC62D90`, `CltSt=47` @ `0x6FB752E0`, `lob=1`):

| Skill (`Id`) | Missile (`Id`) | `SrvHit` / `CltHit` | Impact Payload Mechanics |
| :--- | :--- | :--- | :--- |
| **`Catapult Charged Ball`** (#287) | `catapult charged ball on` (#512) -> `catapult charged ball` (#513) | `38` (`0x6FC5C5B0`) / `46` (`0x6FB6AAC0`) | Spawns `sHitPar1 = 12` radial `catapult charged ball bolt` (#514, Lightning `10–20`, `Range=80`). |
| **`Catapult Spike Ball`** (#288) | `catapult spike ball on` (#515) -> `catapult spike ball` (#516) | `40` (`0x6FC5C490`) / `47` (`0x6FB6BFA0`) | Scatters `sHitPar1 = 8` `catapult spike in air` (#517, `SrvHit=36`, `CltDo=43`), planting ground `catapult spike` (#518, `Range=250`, Physical `12–16`). |
| **`CatapultBlizzard`** (#303) | `catapult cold on` (#519) -> `catapult cold` (#520) | `1` (`0x6FC5B990`) / `48` (`0x6FB60B70`) | Explodes for Cold radius damage (`sHitPar1 = 4`) and spawns `catapult cold explosion` (#521, `CltHit=48` scatters ice nova shards). |
| **`CatapultPlague`** (#304) | `catapult plague on` (#522) -> `catapult plague` (#523) | `2` (`0x6FC5E330`) / `2` (`0x6FB62380`) | Spawns expanding ring (`sHitPar1 = 7`) of `catapult poison cloud` (#561, `Range=300`, Poison `HitShift=5`, `ELen=200` frames). |
| **`CatapultMeteor`** (#305) | `catapult meteor on` (#524) -> `catapult meteor` (#562) | `14` (`0x6FC5DEF0`) / `50` (`0x6FB6AA70`) | Explodes (`sHitPar1 = 4`, Fire `14–30`) and blankets radius `sHitPar2 = 6` with `catapult meteor fire` (#563, `Range=200` frames). |

---

## 7. Pandemonium Event / Uber Bosses (`MonStats.txt` #704–#709)

### 7.1 Level Spawning (`SUnit.cpp:L1094-1244`) & Shared Uber Rules
- **Spawn Anchors (`SUnit.cpp`)**:
  - **Matron's Den (`LEVEL_PANDEMONIUMRUN1` #133)**: Replaces `OBJECT_SPARKLY_CHEST` with **`uberandariel` (#707, Lilith)**.
  - **Forgotten Sands (`LEVEL_PANDEMONIUMRUN2` #134)**: Increments `pGame->dwUberSandsCounter` on each non-waypoint object; when `dwUberSandsCounter == (pGame->dwInitSeed % 3) + 3`, spawns **`uberduriel` (#708)**.
  - **Furnace of Pain (`LEVEL_PANDEMONIUMRUN3` #135)**: Replaces `OBJECT_SPARKLY_CHEST` with **`uberizual` (#706)**.
  - **Uber Tristram (`LEVEL_PANDEMONIUMFINALE` #136)**: Suppresses all normal preset monsters (`SUnit.cpp:L1178`) and spawns **`ubermephisto` (#704)**, **`uberbaal` (#709)**, and **`uberdiablo` (#705)** at `OBJECT_CAINGIBBET`.
- **Shared Combat Constants**:
  - All 6 Pandemonium bosses have **`Level = 110`** across all columns and **`DamageRegen = 4`** (**`~16,000` HP/sec** in 1-player Hell — double standard monster regeneration, requiring Open Wounds, Poison, or continuous damage).
  - All minions spawned by the Uber Prime Evils in Uber Tristram receive **`UNITFLAG_NOXP`** and **`STATE_UBERMINION`** (`sub_6FC6E890(pGame, pMinion)`) and despawn when all three Uber Prime Evils are killed.

### 7.2 Pandemonium Boss Comparison Matrix (Hell Difficulty)

| Boss (`Id` / `#hcIdx`) | Base HP (`MinHP`=`MaxHP`) | `ResDm` / `ResMa` | `ResFi` / `ResLi` / `ResCo` / `ResPo` | Immunities (`>= 100%`) | `A1` / `A2` Melee Damage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ubermephisto`** (`#704`) | `5695` (`650,000–660,000` effective) | `20%` / `75%` | `75%` / **`110%`** / `75%` / **`110%`** | **Lightning, Poison** | `215–290` / `195–315` (+ Poison) |
| **`uberdiablo`** (`#705`) | `6427` (`650,000–660,000` effective) | `50%` / `75%` | **`110%`** / `75%` / `75%` / `75%` | **Fire** | `245–392` / `234–325` |
| **`uberbaal`** (`#709`) | `6336` (`650,000–660,000` effective) | `50%` / `75%` | `75%` / `75%` / **`110%`** / `75%` | **Cold** | `257–451` / `269–463` |
| **`uberandariel`** (`#707`, Lilith) | `2562` (`650,000–660,000` effective) | **`66%`** / `75%` | `75%` / `75%` / `75%` / **`110%`** | **Poison** | **`400–440`** / `400–440` (+ deadly Poison) |
| **`uberduriel`** (`#708`) | `4757` (`650,000–660,000` effective) | `50%` / `75%` | `75%` / `75%` / `75%` / `75%` | *None* (`75%` all) | `275–315` / `295–345` |
| **`uberizual`** (`#706`) | `9481` (`650,000–660,000` effective) | `30%` / `75%` | `75%` / `75%` / **`110%`** / `75%` | **Cold** | `230–300` / `230–300` (+ Cold) |

### 7.3 Individual Pandemonium Boss AI & Skill Loadouts

#### A. Uber Mephisto (`ubermephisto` #704, `AITHINK_Fn143_UberMephisto`)
- **`MonProp = mephisto`**: Grants `+30%` Faster Cast Rate (`cast2`) and `+30%` Increased Attack Speed (`swing2`) in Hell.
- **Passive Level 20 `Conviction` (#123)**:
  - Assigned on first AI tick (`!UNITS_GetRightSkill(pUnit)`): `Skill7 = Conviction` (`slvl = 20`, `SrvDo=66` @ `0x6FCBAF50`).
  - Inflicts **`-125%` Fire / Lightning / Cold Resistance** (`min(-150, -(30 + 5*(slvl-1)))`) and **`-90%` Defense** on all players within `20` sub-tiles (`13.3` yards).
- **Skeleton Minion Spawner (`AITHINK_SpawnUberMephistoMinion`)**:
  - Every `50` frames (`dwLastMinionSpawnDiff > 50`), rolls `50%` chance to spawn 1 skeleton near target from 6 types (`skeleton8`, `sk_archer11`, `skmage_fire7`, `skmage_ltng7`, `skmage_cold6`, `skmage_pois7` — all `ResFi/Li/Co/Po/Ma/Dm` immune/resistant).
  - Cap is **`15` minions** while Uber Diablo or Uber Baal is within 25 sub-tiles (`AloneAndTogetherCounter.nTogether > 1`), or **`30` minions** when Uber Mephisto is isolated (`nTogether == 1`).
- **Offensive Skills (+4 Hell bonus applied on registration)**:
  - `Skill1 = PrimeLightning` (#185, base `slvl=6`, `SrvDo=17`, `primelightning` #236)
  - `Skill2 = PrimeBolt` (#186, base `slvl=20`, `SrvDo=17`, `primebolt` #237 Charged Bolts)
  - `Skill3 = PrimePoisonNova` (#192, base `slvl=7`, `SrvDo=99` @ `0x6FCD52A0`, `CltDo=55` @ `0x6FB081F0`, 32-bolt radial `primepoisonnova` #244)
  - `Skill4 = MephistoMissile` (#334, base `slvl=5`, Skull Orb `mephistomissile` #632, Cold + Magic damage)
  - `Skill5 = MephFrostNova` (#346, base `slvl=1`, 32-bolt `mephfrostnova` #659)
  - `Skill6 = Blizzard` (#59, base `slvl=5`, `SrvDo=28` @ `0x6FC62D90`, `blizzardcenter` #155)

#### B. Pandemonium Diablo (`uberdiablo` #705, `AITHINK_Fn144_UberDiablo`)
- **Pit Lord Spawner (`AITHINK_SpawnUberDiabloMinion`)**:
  - Spawns invisible **`demonhole` (#711)** spawner units (`MONSTER_DEMONHOLE`), which in turn spawn **Pit Lords (`megademon6` #710 — Magic/Fire/Lightning/Cold/Poison Immune** except Physical!).
  - Cap is **`1` `demonhole` + `4` Pit Lords** when another Uber Prime Evil is within 25 sub-tiles, or **`2` `demonhole` + `10` Pit Lords** when isolated.
- **Offensive Skills (`AITHINK_UberDiabloMainSkillHandler`)**:
  - Shares Diablo's AI state machine ([`skills-boss-act4-diablo.md`](./skills-boss-act4-diablo.md) §2.2) with **Melee `DiabLight` weight boosted from `30` to `75`** (`AiThink.cpp:L13183`!), plus `Diablogeddon` (#362, `slvl=5`) added to the skill bar:
    - `DiabLight` (#242, `slvl=2`), `DiabFire` (#240, `slvl=4`), `DiabCold` (#244, `slvl=2`), `DiabWall` (#245, `slvl=2`), `DiabRun` (#246, `slvl=5`), `PrimeFirewall` (#190, `slvl=8`), `DiabPrison` (#248, `slvl=1`), `Diablogeddon` (#362, `slvl=5`).

#### C. Uber Baal (`uberbaal` #709, `AITHINK_Fn146_UberBaal`)
- **Self-Buff (`Chilling Armor` #60, base `slvl=30`)**:
  - Before rolling AI actions (`AiBaal.cpp:L346`), if `!STATES_CheckState(pUnit, STATE_SHIVERARMOR)`, immediately casts **`Skill8 = Chilling Armor` (#60, `slvl=30+4=34`)** (`SrvDo=18` @ `0x6FC628F0`), granting **`+210%` Defense** and firing retaliatory `chillingarmorbolt` (#264) bolts at any ranged attacker!
- **Specter & Dark Lord Spawner (`AIBAAL_SpawnUberBaalMinion`)**:
  - Every `50` frames (`50%` chance), spawns `nChoice = rand % 2` (`0` = `wraith9` #712 Specter, Physical Immune; `1` = `vampire9` #713 Dark Lord, Magic/Elemental Immune; note `willowisp8` in `MonStats.txt` slot 3 is never rolled because `SEED_RollLimitedRandomNumber(..., 2)` only rolls `0..1`!).
  - Cap is **`7` minions** when near another Uber Prime Evil, or **`15` minions** when isolated.
- **Aggressive Onto-Target Teleport (`SKILLS_SrvDo098_MonTeleport` @ `0x6FCD46B0`)**:
  - Whenever missile LoS is blocked (`AiBaal.cpp:L402`, 50% chance) or when `nParam == 14` (`AiBaal.cpp:L1069`), `uberbaal` casts `Baal Teleport` (#329) targeted at **`(nTargetX, nTargetY)`** (directly onto the player, unlike normal `baalcrab` which teleports 25 sub-tiles away!).
- **Increased Skill Levels**: `Baal Nova` (`slvl=5`), `Baal Inferno` (`slvl=3`), `Baal Tentacle` (`slvl=1`), `Baal Cold Missiles` (`slvl=3`), `Baal Teleport` (`slvl=1`), `Defense Curse` (`slvl=5`), `Blood Mana` (`slvl=5`), `Chilling Armor` (`slvl=30`).

#### D. Mini-Ubers (`uberandariel` #707, `uberduriel` #708, `uberizual` #706)
- **Lilith (`uberandariel` #707, `AITHINK_Fn034_Andariel` @ `0x6FCD8090`)**:
  - `66%` Physical Resist (`ResDm=66`), `110%` Poison Resist, massive `400–440` melee physical hit + deadly venom (`El1=pois, El1MinD=225, El1MaxD=248, El1Dur=450`).
  - Casts **`AndrialSpray` (#164, `slvl=1`)** (`SrvSt=46` @ `0x6FCD3930`, `SrvDo=88` @ `0x6FCD56C0`, `CltSt=34`, `CltDo=48`, 19-arc `andarielspray` #205 poison bolts) and **`AndyPoisonBolt` (#201, `slvl=1`)** (`andypoisonbolt` #260).
- **Uber Duriel (`uberduriel` #708, `AITHINK_Fn044_Duriel` @ `0x6FCD8FE0`)**:
  - Passively activates **`Skill4 = Holy Freeze` (#114, `slvl=1` + `+4` Hell = `slvl=5`)** (`SrvDo=81` @ `0x6FCBABC0`, chills all nearby players by **`-42%` velocity/attack rate** regardless of Cannot Be Frozen).
  - Ranged: `aip2 = 50%` chance to cast **`Skill1 = Charge` (#107, `slvl=5`)** (`SrvSt=31` @ `0x6FCB9620`, `SrvDo=67` @ `0x6FCB9D20`, `CltSt=25`).
  - Melee: `aip3 = 30%` **`Skill3 = Smite` (#97, `slvl=7`, `SrvDo=150`)**, else `aip1 = 40%` **`Skill2 = Jab` (#10, `slvl=15`, `SrvDo=7`)**, else `A2`/`A1`.
- **Uber Izual (`uberizual` #706, `AITHINK_Fn145_UberIzual`)**:
  - Maintains **`Skill2 = Chilling Armor` (#60, `slvl=20`)** (`SrvDo=18`) whenever `STATE_SHIVERARMOR` is absent.
  - Whenever `COLLIDE_CheckAnyCollisionWithPattern(..., COLLIDE_MISSILE_BARRIER)` blocks LoS to his target (`AiThink.cpp:L5329`), immediately casts **`Skill3 = MonTeleport` (#184, `slvl=1`)** (`SrvDo=98`) directly onto his target!
  - In melee/ranged (`aip1 = 40%`), casts **`Skill1 = Frost Nova` (#44, `slvl=8`)** (`SrvDo=22`, 32-bolt radial `frostnova` #63).

---

## 8. Implementation Verification Checklist

1. **Baal Hoarfrost Perpendicular Wedge (`0x6FC2D290` / `0x6FB74C10`)**: Verify `Baal Cold Missiles` (#318) stores `(-dY, +dX)` into `baal cold maker` (#589) `nTargetX/Y` on both server and client, and `SrvDo31` / `CltDo52` spawns 2 perpendicular `baal cold trail` (#590) bolts every sub-tile step (`75%` Knockback, `NextDelay=4`).
2. **Baal Inferno Mana Drain (`0x6FC596E0`)**: Verify `baal inferno` (#554) invokes `MISSMODE_SrvHit55_Baalnferno` on impact, draining **50% (`sHitPar1 = 50`)** of the hit player's current `STAT_MANA` in addition to `HitShift=5` Magic damage.
3. **Baal Curse Selector (`0x6FCCE450`)**: Verify Baal checks `MaxLife(target) > MaxMana(target)` to choose `Defense Curse` (#309) vs `Blood Mana` (#310), and `Blood Mana` (`0x6FD025E0`) deducts `nManaCost` from HP on skill cast without killing the player (clamps HP to `1` and removes `STATE_BLOOD_MANA` when HP `< 40` or `< nManaCost`).
4. **Baal Teleport Direction (`0x6FCD46B0`)**: Verify normal `baalcrab` (#544) teleports **25 sub-tiles away** from the target, whereas `uberbaal` (#709) teleports **directly onto** `(nTargetX, nTargetY)`.
5. **Nihlathak Corpse Explosion Scaling (`0x6FC6F4D0`)**: Verify `NihlathakCorpseExplosion` (#351) deals **10–20%** (`Param1=10, Param2=20`) of corpse base MaxHP split 50% Physical / 50% Fire (`Param5=50`), not 70–120%.
6. **Pandemonium Tristram Minion Caps & Conviction**: Verify `ubermephisto` (#704) runs passive **level 20 `Conviction`** (`-125%` Fire/Cold/Light resist, `-90%` Defense), `uberbaal` (#709) maintains `Chilling Armor` (`slvl=30+4`), and Uber Prime Evil minion caps halve when another Uber Prime Evil is within 25 sub-tiles (`30 -> 15` for Mephisto, `10 -> 4` Pit Lords for Diablo, `15 -> 7` for Baal), all tagged `UNITFLAG_NOXP` + `STATE_UBERMINION`.

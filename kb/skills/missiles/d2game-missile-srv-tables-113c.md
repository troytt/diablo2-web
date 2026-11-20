# D2Game 1.13c Server Missile Dispatch Tables (`pSrvDoFunc` / `pSrvHitFunc` / `pSrvDmgFunc`)

## 1. Binary & Table Ground Truth

- **Server Binary**: `samples/d2/D2Game.dll` (Diablo II: Lord of Destruction v1.13c, ImageBase `0x6FC20000`)
- **Common Binary**: `samples/d2/D2Common.dll` (Diablo II: Lord of Destruction v1.13c, ImageBase `0x6FD50000`)
- **Data Tables**: `samples/d2/excel/Missiles.txt` (680 rows, IDs `0..679`) and `samples/d2/excel/Skills.txt`

### Dispatch Table Virtual Addresses in `D2Game.dll` (v1.13c)

| Table Symbol | VA (`D2Game.dll`) | Size | `MissilesTxt` Offset | Column |
| :--- | :--- | :--- | :--- | :--- |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | 38 (`0..37`) | `+0x19A` (`WORD`) | `pSrvDoFunc` |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | 65 (`0..64`) | `+0x19C` (`WORD`) | `pSrvHitFunc` |
| `gpMissileSrvDmgFnTable` | `0x6FD2DB68` | 16 (`0..15`) | `+0x19E` (`WORD`) | `pSrvDmgFunc` |

### Core Dispatcher Functions

1. **Creation Dispatcher — `MISSILES_CreateMissileFromParams` (`0x6FC5F550`)**:
   - Looks up `MissilesTxt` via `0x6FC60BD0` (`missileId >= 0 && missileId < sgptDataTables->nMissilesTxtRecordCount`). Returns `0` immediately if invalid.
   - Allocates server missile unit (`UNIT_MISSILE = 3`), sets owner (`+0x94` type, `+0x98` guid), velocity (`0x6FC5F787` when `dwFlags & 0x02`), range (`Range + slvl * LevRange` when `dwFlags & 0x04`), and frame count (`0x6FC2B1CE`).
   - Note: `Hydra` (#62) is NOT a missile in `Missiles.txt` — `Skills.txt` row 62 (`Hydra`) spawns three `hydr1..hydr3` server monster pets (`srvdofunc = 37`), each firing `firebolt` (#59, `pSrvDoFunc = 1`). There is no `'hydra_turret'` row in `Missiles.txt`.
2. **Per-Tick Dispatcher — `MISSILES_ExecuteSrvDoFunc` (`0x6FC61E50`)**:
   - Reads `wSrvDoFunc = pMissilesTxt->wSrvDoFunc` (`+0x19A`).
   - Bounds check: `wSrvDoFunc > 0 && wSrvDoFunc < 38`, invokes `gMissileSrvDoFuncTable[wSrvDoFunc](pGame, pMissile)`.
3. **Collision & Impact Dispatcher — `MISSILES_SrvHitDispatch` (`0x6FC5EDE0`)**:
   - Gate checks: `bCollideKill` (`+0x04 & 0x01`), `NextHit`/`NextDelay` (`D2Common.#10551` state `152` on target), `LastCollide` (`D2Common.#11124`), `CollideType` (`+0x39`), `CollideFriend` (`+0x04 & 0x80`).
   - Builds `D2DamageStrc` (72 bytes) from missile stats via `MISSILES_BuildDamageData` (`0x6FC5A4E0`, `ResultFlags` at `+0x20`, `HitClass` at `+0x3A`).
   - **Damage Table Hook**: Reads `wSrvDmgFunc = pMissilesTxt->wSrvDmgFunc` (`+0x19E`). If `wSrvDmgFunc > 0 && wSrvDmgFunc < 16` and `gpMissileSrvDmgFnTable[wSrvDmgFunc] != NULL`, calls `gpMissileSrvDmgFnTable[wSrvDmgFunc](pGame, pMissile, pTarget, &dmg)` BEFORE applying damage (`0x6FC5EF6C..0x6FC5EF8B`).
   - **Hit Table Hook**: Reads `wSrvHitFunc = pMissilesTxt->wSrvHitFunc` (`+0x19C`). If `wSrvHitFunc > 0 && wSrvHitFunc < 65` and `gpMissileSrvHitFnTable[wSrvHitFunc] != NULL`, calls `gpMissileSrvHitFnTable[wSrvHitFunc](pGame, pMissile, pTarget, x, y)` (`0x6FC5EFF8..0x6FC5F01B`).
   - Applies `D2DamageStrc` to `pTarget` via `MISSILES_ApplyDamageData` (`0x6FC5AFF0`), sets `NextDelay` via `D2Common.#10551` (`0x6FC5F07F`) when `pMissilesTxt->dwNextDelay > 0` (`+0x80`), and checks `Pierce` (`+0x04 & 0x04`).

---

## 2. `gMissileSrvDoFuncTable` (`0x6FD2D970`, 38 Entries `0..37`)

| Index | VA (`1.13c`) | `Missiles.txt` Rows | Disassembled Behavior |
| :---: | :--- | :--- | :--- |
| `0` | `0x00000000` | Visual / client-only rows | No server per-tick function |
| `1` | `0x6FC5F540` | Standard projectiles (`arrow`, `firebolt`, `chargedbolt`, `blessedhammer`, `twister`, `warcry`, `shockwave`, `armageddoncontrol`, etc.) | Calls `MISSILES_MoveStepAndCollide` (`0x6FC5F320`) with `bForce = 0` |
| `2` | `0x6FC61B80` | `poisonjav` (#16), `viper_poisjav` (#345) | Advances missile (`0x6FC5F320`); if `D2Common.#10234(pPath) > 0` (crossed a sub-tile step), spawns `SubMissile1` (`poisonjavcloud`) at current pos with `Calc1` (`Param2`) loop count |
| `3` | `0x6FC61AE0` | `plaguejavelin` (#43), `poisonjavcloud` (#53), `blizzard1..4` (#159..162), etc. | Advances missile (`0x6FC5F320`); if `D2Common.#10234(pPath) > 0` and `SubMissile1 >= 0`, spawns `SubMissile1` at current pos with `Param1` loop count |
| `4` | `0x00000000` | Unused | `NULL` |
| `5` | `0x6FC61980` | `firewall` (#70), `meteorfire` (#240), `immolationfire` (#86), `armageddonfire` (#479) | Stationary ground fire tick (`0x6FC5F320`) |
| `6` | `0x6FC61850` | `firewallmaker` (#69), `vampirefirewallmaker` (#130), `moltenboulder` (#452), `countessfirewallmaker` (#650) | Advances missile; on each new path step (`D2Common.#10234 > 0`), spawns `SubMissile1` (`firewall` / `moltenboulderfirepath`) at current pos |
| `7` | `0x6FC61710` | `guidedarrow` (#42), `bonespirit` (#107), `monbonespirit` (#274) | Advances missile; every 5 frames (`remaining % 5 == 0`), acquires/retargets nearest valid enemy (`sHitPar1` sub-tiles when `> 0`, e.g. `25` on `bonespirit`, or unlimited when `sHitPar1 == 0` on `guidedarrow`) |
| `8` | `0x6FC61670` | `monblizzardcenter` (#272) | Calls `MISSMODE_CreateMissileWithCollisionCheck` (`0x6FC5D1E0`, mask `0x05`) with `nRange = Param1 + max(2, slvl / max(1, Param3))`, `nFrames = max(3, Param2 - slvl / max(1, Param3))`, and `SubMissile1` (`monbliz1` #273) |
| `9` | `0x6FC61520` | `bat lightning bolt` (#365) | Advances missile; on each path step spawns `SubMissile1` (`bat lightning trail`) |
| `10` | `0x6FC613D0` | `blizzardcenter` (#158) | Evaluates `nRange = evalSkillCalc(skill.calc1)` (Blizzard `par1 = 7`) and `nFrames = evalSkillCalc(skill.calc2)` (Blizzard `par3 = 4`); calls `MISSMODE_CreateMissileWithCollisionCheck` (`0x6FC5D1E0`, mask `0x05`): when `remaining % nFrames == 0`, seeds `pMissile->pSeed` with `x + remaining`, rolls `offX/offY = rand(2*(nRange-1)) - (nRange-1)`, checks terrain collision (`0x05`), and spawns `SubMissile1` (`blizzard1` #159) |
| `11` | `0x6FC61240` | `finger mage spider` (#179) | Advances homing/jitter spider projectile and checks collision |
| `12` | `0x6FC61110` | `diabwallmaker` (#174) | Spawns `SubMissile1` (`diabwall`) along path steps |
| `13` | `0x6FC60EB0` | `bonewallmaker` (#192) | Spawns bone wall segments along path steps |
| `14` | `0x6FC60E10` | `grimwardscare` (#218) | Pulses fear state (`STATE_TERROR`) to monsters within radius |
| `15` | `0x6FC60CA0` | `frozenorb` (#260) | Advances orb; when `remaining % max(1, Param1) == 0`, steps 64-direction circle table (`0x6FD1C690`/`0x6FD1C790`) by `Param2` and spawns `SubMissile1` (`frozenorbbolt`) |
| `16` | `0x6FC60BD0` | `frozenorbnova` (#262) | Advances bolt (`0x6FC5F320`); when `remaining < Param1` (`6`) and `remaining % max(1, Param2) == 0` (`Param2 = 2`), reads stored target offset `(a, b)` from `MISSILE_GetTargetX/Y` (`0x6FC2A1EE` / `0x6FC2AE32`), rotates via `newA = (a - b) / 2`, `newB = (a + b) / 2`, writes back via `MISSILE_SetTargetX/Y` (`0x6FC2A50E` / `0x6FC2AF5E`), and re-aims path target via `D2Common.#10170` + `#10142` (`#6`) at unchanged scalar speed |
| `17` | `0x6FC60B20` | `Unused` / monster emitter | Spawns `SubMissile1` periodically |
| `18` | `0x6FC608D0` | `cairnstones` (#284) | Tristram Cairn Stones portal sequence controller |
| `19` | `0x6FC5F6D0` | `towerchestspawner` (#289) | Countess tower chest loot spawner |
| `20` | `0x6FC60860` | `redeemer` (#318) | Corpse redemption scanner |
| `21` | `0x6FC61EB0` | `stranglinggaspotion` / ring spawner | Concentric cloud ring spawner |
| `22` | `0x6FC606D0` | `pantherspawner` / monster spawner | Periodic sub-missile emitter |
| `23` | `0x6FC605E0` | `sucfireball` (#441), `firestormmaker` (#425) | Advances missile; on each path step (`D2Common.#10234 > 0`), spawns `SubMissile1` (`sucfireballtrail` / `firestorm`) with `Param1` loops |
| `24` | `0x6FC605E0` | Shares `0x6FC605E0` with `SrvDo23` | Identical to `SrvDo23` |
| `25` | `0x6FC604D0` | `erruption center` (#450) | Evaluates `range = evalSkillCalc(skill.calc1)` and `frames = evalSkillCalc(skill.calc2)`; every `frames` remaining ticks spawns `SubMissile1` (`erruption crack 1`) in `[-r+1, r-1]` |
| `26` | `0x6FC60420` | `vines` (#454), `plague vines` (#457) | Advances vine; when `remaining % max(1, Param1) == 0`, spawns `SubMissile1` (`vines trail` / `plague vines trail`) |
| `27` | `0x6FC60280` | `tornado` (#478) | Advances tornado; pulses physical damage every `Param1 > 0 ? Param1 : max(1, evalSkillCalc(skill.calc4))` frames within `Param2 > 0 ? Param2 : max(1, evalSkillCalc(skill.auraRangeCalc))` sub-tiles |
| `28` | `0x6FC60070` | `volcano` (#459) | Between `Param3 < remaining < Param4`, every `Param1 > 0 ? Param1 : max(1, evalSkillCalc(skill.calc4))` frames, spawns `SubMissile1` (`volcano debris 2`) within `Param2 > 0 ? Param2 : max(1, evalSkillCalc(skill.auraRangeCalc))` |
| `29` | `0x6FC5FED0` | `recycler delay` (#466) | At `remaining == Param1`, heals owner by `evalSkillCalc(skill.calc1)%` of `maxhp` |
| `30` | `0x6FC5FB40` | `rabiesplague` (#472) | Tracks infected host (`pOwner`), every `max(1, Param1)` frames spawns `SubMissile1` (`rabiescontagion`) owned by caster |
| `31` | `0x6FC5F9F0` | `armageddon` (#475) | Steps missile while `remaining > Param2`; at `remaining == Param2` (`7`), spawns `SubMissile1` and `SubMissile2` |
| `32` | `0x6FC61DE0` | `hurricaneswoosh` (#482), `hurricanecart` (#483), `hurricane` (#480) | Updates missile path target to owner position (`D2Common.GetUnitX/Y(pOwner)`), advances via `0x6FC5F320`, and respawns while owner has `STATE_HURRICANE (144)` |
| `33` | `0x6FC5FD30` | `wake of destruction` (#501), `inferno sentry` (#505) | Trap wave / inferno emitter |
| `34` | `0x6FC61C30` | `bladefury1..3` / `bladesentinel` | Blade Sentinel / Fury boomerang controller |
| `35` | `0x6FC5F890` | `shock field in air` / `blade shield` | Shock Web / Blade Shield sub-emitter |
| `36` | `0x6FC5F670` | `baal taunt` (#592) | Baal Taunt controller |
| `37` | `0x6FC5F550` | `baal cold maker` / `fistoftheheavens` | Spawner entry |

---

## 3. `gpMissileSrvDmgFnTable` (`0x6FD2DB68`, 16 Entries `0..15`)

Invoked inside `MISSILES_SrvHitDispatch` (`0x6FC5EF6C`) immediately before applying `D2DamageStrc` to `pTarget`:

| Index | VA (`1.13c`) | `Missiles.txt` Rows | Disassembled Behavior |
| :---: | :--- | :--- | :--- |
| `0` | `0x00000000` | Default | No damage packet hook |
| `1` | `0x6FC59CE0` | `firearrow` (#7), `magicarrow` (#27), `coldarrow` (#30) | Evaluates `pct = D2Common.#11036(pMissile, pOwner, sHitCalc1, skillId, slvl)` (`0x6FC2B240`); converts `pct%` of physical damage into missile's `EType` (`fire` / `mag` / `cold`) |
| `2` | `0x6FC59080` | `icearrow` (#28), `royalstrikechaosice` (#567) | Reads `dParam1` (`+0x44`); sets `dwFrzLen = dwColdLen * dParam1 / 100` and `dwColdLen = 0` |
| `3` | `0x6FC59670` | `blaze` (#68), `firewall` (#70), `immolationfire` (#86), `vampirefirewall` (#131), `meteorfire` (#240), `vampiremeteorfire` (#241) | Rolls `(SEED_RollRandom(pMissile->pSeed) & 0x7F) < dParam1` (`+0x44`); if false, zeroes damage (`return 0`) |
| `4` | `0x6FC58E70` | `iceblast` (#63) | Moves `dwColdLen` into `dwFrzLen` (`dwFrzLen = dwColdLen; dwColdLen = 0`) |
| `5` | `0x6FC5A790` | `blessedhammer` (#116) | If `MONSTERS_IsUndead(pTarget)` and `dParam1 > 0` (`150` in `Missiles.txt`, or `+50%` bonus), scales magic/elemental damage; if `MONSTERS_IsDemon(pTarget)` and `dParam2 > 0`, scales by `dParam2` |
| `6` | `0x6FC59C80` | Unused | Sets `dwDamageFlags |= 0x20` if `pTarget == pMissile->pTarget` |
| `7` | `0x6FC59600` | `warcry` (#235), `shockwave` (#511) | Reads `dParam1` (`+0x44`); if `dParam1 <= 0`, evaluates `SkillsTxt.calc1` (`[esi+0x138]`, `par1 + (lvl-1)*par2` = `25 + 5*slvl` for War Cry, `40 + (slvl-1)*15` for Shock Wave — **NO 250-frame cap**); sets `dmg.dwStunLen` |
| `8` | `0x6FC58FF0` | `erruption crack 1` (#448), `erruption crack 2` (#449) | Sets `SkillsTxt.wProgOverlay` (`+0x114`) on target when `dParam1 > 0` |
| `9` | `0x6FC59560` | `twister` (#477) | Reads `dParam1` (`+0x44`); if `dParam1 <= 0`, reads `SkillsTxt.dwParam2` (`[eax+0xFC]`, `10` frames = `0.4s` for Twister); sets `dmg.dwStunLen` |
| `10` | `0x6FC59040` | `bladesoficecubes` (#561) | Copies `dwColdLen` into `dwFrzLen` (`dwFrzLen = dwColdLen`) |
| `11` | `0x6FC59BD0` | `rabiescontagion` (#473) | Compares missile remaining frames against target's active Rabies state duration |
| `12` | `0x6FC5A850` | `lightningjavelin` (#432) | Evaluates `sHitCalc1` (`100%`) and converts physical damage to lightning damage |
| `13` | `0x6FC5AAA0` | `blessedhammerex` (#676) | Applies `SrvDmg05` plus `STATE_CONCENTRATION` bonus scaled by `SkillsTxt.dwParam8` |
| `14` | `0x6FC59A40` | `moltenboulder` (#452) | Checks `dParam1` (`1`) and monster size (`0x6FC213B0`): if target is not a large (`SizeX == 3`) monster and `(rand < dParam2 || pOwner != pTarget)`, sets knockback (`0x08` in `wResultFlags`) |
| `15` | `0x00000000` | Unused | `NULL` |

---

## 4. `gpMissileSrvHitFnTable` (`0x6FD2DA48`, 65 Entries `0..64`)

Invoked inside `MISSILES_SrvHitDispatch` (`0x6FC5EFF8`) on unit collision, wall collision, or `AlwaysExplode` range expiry:

| Index | VA (`1.13c`) | `Missiles.txt` Rows | Disassembled Behavior |
| :---: | :--- | :--- | :--- |
| `1` | `0x6FC5B990` | `fireball` (#62), `vampirefireball` (#129), `desertfireball` (#283), `impfireball` (#404), `catapult cold ball` (#415), `sucfireball` (#441), `explodingarrowexp2` (#656), `freezingarrowexp3` (#657) | Radial splash: `r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.calc1))` sub-tiles (`0x6FCC0C70` / `0x6FC5A4E0`) |
| `2` | `0x6FC5E330` | `plaguejavelin` (#43), `rancidgasepotion` (#47), `chokinggaspoition` (#48), `stranglinggaspotion` (#49), `catapult plague ball` (#419), `plaguejavelin2` (#436) | Calls `0x6FC5D680` to spawn concentric rings of `HitSubMissile1` (`poisonjavcloud`) using `sHitPar1`, `sHitPar2`, `sHitPar3` |
| `3` | `0x6FC5BB60` | `oilpotion` (#44), `explosivepotion` (#45), `fulminatingpotion` (#46), `bomb on ground` (#386) | When `pTarget == NULL`, tail-calls `SrvHit44` (`0x6FC5B5F0`) for radial splash (`sHitPar1` or `skill.auraRangeCalc`) |
| `4` | `0x6FC5F220` | `explodingarrow` (#41), `freezingarrow` (#87), `royalstrikemeteorcenter` (#564) | Spawns `HitSubMissile1..4` (`+0x24..+0x2A`) at impact coordinates (`0x6FC8F930`); if `sHitPar1 > 0`, immediately forces `MISSILES_SrvHitDispatch` (`0x6FC5EDE0(..., bForce=1)`) on each spawned sub-missile |
| `5` | `0x6FC5C700` | `monblizzard` | Monster cold radial splash |
| `6` | `0x6FC5BD10` | `poisonnova` / nova burst | 64-direction radial sub-missile burst |
| `7` | `0x6FC59FD0` | `holybolt` (#108), `fistoftheheavensbolt` (#234) | If `sHitPar1 != 0` and target is ally (`SUNIT_IsAlly` or `sHitPar2 != 0 && SUNIT_IsFriendly`), heals target by `evalSkillCalc(skill.calc1)..evalSkillCalc(skill.calc2)` (fallback to missile `EMin..EMax`); otherwise damages only Undead (`MONSTERS_IsUndead`) |
| `8` | `0x6FC59F70` | `blaze` (#68), `firestorm` (#426), `moltenboulderfirepath` (#453) | Ignores owner while owner has `STATE_BLAZE (13)`; returns `2` (apply damage without killing ground fire patch) |
| `9` | `0x6FC5E0B0` | `immolationarrow` (#85) | Spawns `HitSubMissile1` (`immolationfire` #86) in `r1 = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.calc1))` with duration from `HitCalc1` / `auraLenCalc`, then deals radial fire damage in `r2 = sHitPar2 > 0 ? sHitPar2 : max(1, evalSkillCalc(skill.calc2))` |
| `10` | `0x6FC5B140` | `guidedarrow` (#42), `bonespirit` (#107), `monbonespirit` (#274) | Homing missile hit handler |
| `12` | `0x6FC5D020` | `chainlightning` (#93), `lightningstrike` (#232), `chainlightning2` (#267) | If remaining chain count (`D2Common.#11042` / `sHitCalc1`) `> 1`, searches `r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))` sub-tiles (`0x6FCC0F40`) for nearest unhit enemy and spawns next chain link |
| `13` | `0x6FC5B3E0` | `glacialspike` (#96), `monglacialspike` (#271), `hellmeteordown` (#336) | Radial splash (`r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))`) + freeze length (`sHitPar2 > 0 ? sHitPar2 : evalSkillCalc(skill.auraLenCalc)`) |
| `14` | `0x6FC5DEF0` | `meteorcenter` (#101), `vampiremeteorcenter` (#133), `catapult meteor ball` (#422), `royalstrikemeteor` (#563) | Radial blast (`r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))`), then spawns `HitSubMissile1` (`meteorfire`, `vampiremeteorfire`, etc.) across the 18-offset circle table (`0x6FD1C8D0`) via `0x6FC5CEC0` |
| `20` | `0x6FC5DD60` | `lightningfury` (#206) | Searches `r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))` (`15` sub-tiles) and spawns up to `maxBolts = sHitPar2 > 0 ? sHitPar2 : max(1, evalSkillCalc(skill.calc1))` (`1 + slvl`) `HitSubMissile1` (`furylightning` #231) bolts |
| `22` | `0x6FC5DB30` | `fistoftheheavensdelay` (#233) | Applies primary lightning damage to target, then searches `r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))` (`20` sub-tiles) and spawns `HitSubMissile1` (`fistoftheheavensbolt` #234) toward Undead/Demon targets |
| `29` | `0x6FC5C850` | `frozenorb` (#260) | Final 16-bolt nova burst: steps `0..63` by `max(1, sHitPar1)` (`4`) across `0x6FD1C690`/`0x6FD1C790` and spawns `HitSubMissile1` (`frozenorbnova` #262) |
| `36` | `0x6FC5AB30` | `bomb in air` (#385), `shock field in air` (#498), `catapult spike in air` (#416), `sentryspikeinair` (#524) | On ground arrival (`pTarget == NULL`), spawns `HitSubMissile1` (`bomb on ground`, `shock field on ground`, etc.) |
| `44` | `0x6FC5B5F0` | `javavelin` (#429), `magicjavelin` (#434), `armageddonrock` (#476), `sentrylightningbolt` (#526), `vinebeast walk 1` (#445), `ancientspell2` (#612) | Radial splash (`r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))`) |
| `47` | `0x6FC5D8C0` | `moltenboulder` (#452) | If `pTarget != NULL` and target is not a large (`SizeX == 3`) monster (`0x6FC213B0`), returns `2` (apply knockback + damage via `SrvDmg14` without exploding); otherwise deals radial damage (`sHitPar1` or `skill.auraRangeCalc`) and spawns `HitSubMissile1` (`moltenboulderfirepath`) via `0x6FC5CEC0` |
| `48` | `0x6FC5C260` | `volcano debris 2` (#461) | Radial splash (`sHitPar1` or `skill.auraRangeCalc`) + spawns `HitSubMissile1` (`volcano small fire`) |
| `51` | `0x6FC5C160` | `royalstrikemeteor` / fire patch | Spawns `HitSubMissile1` fire patch |
| `56` | `0x6FC5B210` | `armageddoncontrol` (#577), `diablogeddoncontrol` (#670) | Radial splash (`r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))`, `sHitPar1 = 3` sub-tiles = `60 px`), then if `HitSubMissile1 >= 0`, spawns `HitSubMissile1` (`armageddonfire` #479 or `diablogeddonfire` #672) at impact coordinates |

---

## 5. Path Movement Modes (`D2Common.dll` @ `0x6FD50000`)

1. **`PATH_STEP_BLESSED_HAMMER` (`0x6FDA43F0`, `pCltDoFunc == 2`)**:
   - Outward Archimedes spiral (`angle += 4` binary angle units/tick, `radius += 0.6` px/tick). Identified via `MissilesTxt.pCltDoFunc == 2` (`blessedhammer` #116, `blessedhammerex` #676).
2. **`PATH_STEP_CHARGED_BOLT` (`0x6FDA3E80`)**:
   - 32-entry lateral step offset table `GAT_CHARGED_BOLT_OFFSETS` (`{-1, 0, 1}` at `0x6FDD2528`), stepping `jitterIndex = (jitterIndex + 1) & 31` each tick for erratic path projectiles (`chargedbolt`, `sentrychargedbolt`, `twister`, `tornado`, `firestormmaker`).

---

## 6. Ground-Fire `SrvDo05` / `SrvDmg03`, `GetHit` vs `SoftHit`, & `SKILLS_SrvDo024_FireWall` (`1.13c` `D2Game.dll`)

1. **`SKILLS_SrvDo024_FireWall` (`0x6FC637D0..0x6FC63983`)**:
   - Invoked by all 4 `Skills.txt` rows with `srvdofunc = 24`:
     - `#51 Fire Wall` (`srvmissilea = firewallmaker` `#68`, `srvmissileb = firewall` `#69`)
     - `#170 VampireFirewall` (`srvmissilea = vampirefirewallmaker` `#130`, `srvmissileb = vampirefirewall` `#131`)
     - `#188 PrimeFirewall` (`srvmissilea = vampirefirewallmaker` `#130`, `srvmissileb = vampirefirewall` `#131`)
     - `#321 CountessFirewall` (`srvmissilea = countessfirewallmaker` `#653`, `srvmissileb = countessfirewall` `#331`)
   - Computes `dX = Xc - Xt`, `dY = Yc - Yt` (`0x6FC638EF..0x6FC63902`), launches two `srvmissilea` makers from `(Xt, Yt)` toward `(Xt - dY, Yt + dX)` (`0x6FC63903..0x6FC6391A`) and `(Xt + dY, Yt - dX)` (`0x6FC6391F..0x6FC63935`) with flags `0x21`, and spawns one stationary `srvmissileb` center patch at `(Xt, Yt)` (`0x6FC6393A..0x6FC63972`).
   - All makers (`#68`, `#130`, `#653`) have `pSrvDoFunc = 6`, `pSrvHitFunc = 0`, `CollideType = 8`, and `0` physical/elemental damage; they never deal unit contact damage or receive monster melee fallback damage.

2. **`MISSILES_ApplyDamageInner` (`0x6FC5AE10..0x6FC5AF3B`) & `MISSILES_SrvDmg03` (`0x6FC59670..0x6FC596D2`)**:
   - `0x6FC5AEAB`: checks `MissilesTxt.dwBitFlags` bit `2` (`GetHit`, mask `0x04`). `pDamage->wResultFlags |= 0x0004` (`RESULTFLAG_GETHIT`) is set **only** when `GetHit != 0`.
   - `0x6FC5AEC0`: checks `SoftHit` (mask `0x08`) -> `pDamage->wResultFlags |= 0x4000` (`RESULTFLAG_SOFTHIT`).
   - `MISSILES_SrvDmg03` (`0x6FC59670`): rolls `(SEED_RollRandom(&pMissile->pSeed) & 0x7F) < dParam1` (`19/128` on `#67 blaze`, `#69 firewall`, `#131 vampirefirewall`, `#230 immolationfire`, `#240 meteorfire`, `#681 vampiremeteorfire`) and sets `orb $0x40, 0x5(%eax)` (`wResultFlags |= 0x4000` `RESULTFLAG_SOFTHIT`).
   - Because all ground-fire patches (`#67`, `#69`, `#131`, `#230`, `#240`, `#331`, `#423`, `#681`) have `GetHit = 0`, they **never** set `RESULTFLAG_GETHIT` (`0x0004`), never force `PLRMODE_GETHIT` / `MONMODE_GETHIT` hit-recovery stunlock, and never trigger `item_skillongethit` (`stat 201`).

3. **Per-Frame `1/256` Fixed-Point Burning & `DamageRate = 41` MDR Scaling**:
   - Ground-fire rows store per-frame fire damage in `1/256` HP units via `EMin..EMax << HitShift` (`#131` `HitShift = 2`, `#681` `HitShift = 3`, `#331` `HitShift = 1`, `#423` `HitShift = 4`) and set `DamageRate = 41` (`41 / 1024 ≈ 1/25` frame-scaled flat MDR at `0x6FCFC13B..0x6FCFC177`, except `#67 blaze` where `DamageRate = 0` applies full flat MDR per frame).
   - Defender Fire Resistance (`0x6FCFB3C0`) and Fire Absorb (`0x6FCFAD00`) operate on the `1/256` fixed-point roll **before** whole-HP extraction so `<50%` resistance is preserved accurately on sub-`1 HP/frame` burning ticks.

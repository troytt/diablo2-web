# D2Game server missile SrvDo 6 / 23–30 (druid & vine missiles) — 1.13c

Source: 1.13c `D2Game.dll` (`g_apfnMissileSrvDoFunc` @ `0x6FD2D970`) and 1.13c `Missiles.txt` / `Skills.txt`. Implemented in
`src/server/engine/missile-engine.ts` → `MissileEngine.stepSrvDoFunc` (issues #1224–#1228).

| pSrvDoFunc | D2Game | Missiles.txt rows | Behaviour |
|---|---|---|---|
| 6 | `SrvDo06_MoltenBoulder_FireWallMaker` | firewallmaker, vampirefirewallmaker, countessfirewallmaker, **moltenboulder** | `SubMissile1` once when `D2Common_10234(pDynamicPath)` reports a new path step (one sub-tile). Dies (`return 2`) if SubMissile1 < 0. |
| 23/24 | `SrvDo23_24_SuccFireBall_FirestormMaker` | sucfireball (23), **firestormmaker (23)** | Same per-path-step spawn; `Param1 > 0` → child `nLoops = Param1` (flag 9). |
| 25 | 0x6FC58E10 `SrvDo25_EruptionCenter` | erruption center | `MISSMODE_CreateMissileWithCollisionCheck(range = Skills calc1, frames = calc2, SubMissile1, mask 0x45)`: when `remaining % calc2 == 0`, seed = `x + remaining`, offset = `rand(2(r-1)) - (r-1)` per axis, skipped if the spot collides. Eruption: calc1 = par1 = 7, calc2 = par2 = 6. |
| 26 | 0x6FC58F30 `SrvDo26_Vines_PlagueVines` | vines, plague vines | `SubMissile1` at own position when `remaining % max(Param1,1) == 0` (Param1 = 9). No steering. |
| 27 | 0x6FC59040 `SrvDo27_Tornado` | **tornado** | Area damage only, **no sub-missile**. Cadence `Param1 > 0 ? Param1 : max(calc4,1)` (Tornado calc4 = par1 = 15) on remaining frames; radius `Param2 > 0 ? Param2 : max(aurarangecalc,1)` sub-tiles (par2 = 3); filter = Skills `aurafilter`. |
| 28 | 0x6FC591C0 `SrvDo28_Volcano` | **volcano** | While `Param3 < remaining < Param4` (2..128) and `remaining % nFrames == 0` (`Param1` or calc4 = par2 = 2): `SEED_InitLowSeed(targetX)`, offsets `rand(2R+1) - R` with R = `Param2` or aurarangecalc (par1 = 12), store low seed back in targetX, spawn SubMissile1 (`volcano debris 2`) from the volcano to that point, `nGfxArg = Param5` (30). |
| 29 | 0x6FC594B0 `SrvDo29_RecyclerDelay` | recycler delay | No missile. When `remaining == Param1` heals owner by `calc1` % of max life (+ ProgOverlay). |
| 30 | 0x6FC598D0 `SrvDo30_RabiesPlague` | rabiesplague | See below. |

`armageddoncontrol` is **pSrvDoFunc 1 / pSrvHitFunc 56** — not SrvDo30. `moltenboulderemerge` is
pSrvDoFunc 1 (no trail; its HitSubMissile1 is `moltenboulder`).

## Rabies ownership (correction to issue #1227 wording)

`SKILLS_SrvDo121_Rabies` (SkillDruid.cpp) creates `rabiesplague` with `pOwner = pOrigin = pTarget`
(the **infected** unit) and stores the **casting unit** in `MISSILE_SetTargetX(type)` /
`MISSILE_SetTargetY(GUID)`. `SrvDo30` then:

1. resolves `pUnit = SUNIT_GetServerUnit(targetX, targetY)` (the caster) and `pOwner` (infected);
   dies if either is missing / owner dead / current frame < 0;
2. moves its path onto `pOwner` (`D2Common_10229`) — it follows the infected unit;
3. every `max(Param1,1)` (= 4) remaining frames creates `SubMissile1` (`rabiescontagion`) with
   `pOwner = pUnit` (**the caster**), `pOrigin = missile`, target offset `rand(2·Param2+1) − Param2`
   (Param2 = 7) rolled from `pUnit->pSeed`, then copies the Skills `aurastate` stat list.

So contagion damage is credited to the druid; the plague missile rides on the infected monster.

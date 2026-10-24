# Diablo II v1.13c Necromancer Poison & Bone Spells Mechanics (`Skills #67, #68, #73, #74, #78, #83, #84, #88, #92, #93`)

## 1. Dispatch Tables (`D2Client.dll` `0x6FAB0000` & `D2Game.dll` `0x6FC20000`)

### Client Dispatch Tables (`D2Client.dll`, ImageBase `0x6FAB0000`)
- **`SkillCltStFunc`**: VA `0x6FB8E928`
  - `SkillCltStFunc[19]` = `0x6FB78F50` (`SKILLS_CltSt19_Teeth_BoneSpear` — spawns `cltmissilec = bonecast` #218 at caster)
  - `SkillCltStFunc[21]` = `0x6FB78330` (`SKILLS_CltSt21_Corpse_PoisonExplosion` — validates hovered selectable corpse on cast start)
  - `SkillCltStFunc[22]` = `0x6FB78510` (`SKILLS_CltSt22_BoneWall_BonePrison` — plays cast start visual/target check)
- **`SkillCltDoFunc`**: VA `0x6FB8EA48`
  - `SkillCltDoFunc[17]` = `0x6FAC5DA0` (`SKILLS_CltDo17_MultipleShot_Teeth` — spawns fanned `teeth` #114 missiles)
  - `SkillCltDoFunc[18]` = `0x6FAC5C40` (`SKILLS_CltDo18_GuidedArrow_BoneSpirit` — spawns `bonespirit` #193 with tracking mode in `targetX`)
  - `SkillCltDoFunc[25]` = `0x6FB23CB0` (`SKILLS_CltDo25_Nova` — spawns 64-bolt ring of `poisonnova` #118 via `0x6FB51020`)
  - `SkillCltDoFunc[32]` = `0x6FB78FB0` (`SKILLS_CltDo32_CorpseExplosion` — hides corpse and spawns `corpseexplosion` #115, `explodingarrowexp` #42, `redlightmissile` #151 via `0x6FB78CE0`)
  - `SkillCltDoFunc[33]` = `0x6FB78C90` (`SKILLS_CltDo33_PoisonExplosion` — hides corpse and spawns `poisoncorpseexplosion` #116, 8 `poisonexplosioncloud` #217, `greenlightmissile` #152 via `0x6FB78710`)
- **`MissileCltDoFunc` (`g_apfnCltDoFunc`)**: VA `0x6FB8D8A0`
  - `MissileCltDoFunc[1]` = `0x6FB617C0` (`MISSMODE_CltDo01_Standard`)
  - `MissileCltDoFunc[2]` = `0x6FB63060` (`MISSMODE_CltDo02_Blood` — `bigblood1` #20, `bigblood2` #21)
  - `MissileCltDoFunc[4]` = `0x6FB6BE00` (`MISSMODE_CltDo04_PoisonCloud` — `poisonexplosioncloud` #217 spawns `poisonpuff` #141)
  - `MissileCltDoFunc[7]` = `0x6FB62EB0` (`MISSMODE_CltDo07_GuidedArrow_BoneSpirit` — client homing step every `CltParam1=5` frames)
  - `MissileCltDoFunc[11]` = `0x6FB62DC0` (`MISSMODE_CltDo11_CorpseExplosion` — spawns `bigblood1`/`bigblood2` gore chunks on tick 0)
  - `MissileCltDoFunc[18]` = `0x6FB68960` (`MISSMODE_CltDo18_BoneSpear` — spawns `bonespeartrail` #248 every tick starting at `elapsed >= CltParam1 (3)`)
- **`MissileCltHitFunc` (`g_apfnCltHitFunc`)**: VA `0x6FB8DA10`
  - `MissileCltHitFunc[13]` = `0x6FB61350` (`MISSMODE_CltHit13_GuidedArrow_BoneSpirit` — spawns `bonespiritexplode` #327)
  - `MissileCltHitFunc[24]` = `0x6FB60800` (`MISSMODE_CltHit24_BoneSpear` — spawns `CltHitSubMissile1 = teethexplode` #204)

### Server Dispatch Tables (`D2Game.dll`, ImageBase `0x6FC20000`)
- **`SkillSrvStFunc`**: VA `0x6FD27338`
  - `SkillSrvStFunc[16]` = `0x6FC6F7D0` (`SKILLS_SrvSt16_PoisonDagger` — rolls melee attack with AR bonus + poison elemental damage)
  - `SkillSrvStFunc[17]` = `0x6FC6EEE0` (`SKILLS_SrvSt17_Poison_CorpseExplosion` — validates corpse target via `D2GAME_CanSummonFromCorpse_6FD0C9E0`)
  - `SkillSrvStFunc[19]` = `0x6FC6EE40` (`SKILLS_SrvSt19_BonePrison` — validates target unit outside town)
- **`SkillSrvDoFunc`**: VA `0x6FD274A8`
  - `SkillSrvDoFunc[8]` = `0x6FC6D420` (`SKILLS_SrvDo008_MultipleShot_Teeth_ShockWave` — Teeth fan)
  - `SkillSrvDoFunc[10]` = `0x6FC6D270` (`SKILLS_SrvDo010_GuidedArrow_BoneSpirit` — Bone Spirit launch)
  - `SkillSrvDoFunc[18]` = `0x6FC628F0` (`SKILLS_SrvDo018_DefensiveBuff` — Bone Armor buff)
  - `SkillSrvDoFunc[22]` = `0x6FC63AA0` (`SKILLS_SrvDo022_NovaAttack` — Poison Nova 64-bolt ring)
  - `SkillSrvDoFunc[32]` = `0x6FC6F920` (`SKILLS_SrvDo032_PoisonDagger` — applies damage & weapon durability loss)
  - `SkillSrvDoFunc[55]` = `0x6FC6F4D0` (`SKILLS_SrvDo055_CorpseExplosion` — Corpse Explosion dual-radius physical + fire damage)
  - `SkillSrvDoFunc[60]` = `0x6FC70FE0` (`SKILLS_SrvDo060_BoneWall` — spawns central `bonewall` + 2 `bonewallmaker` wing missiles)
  - `SkillSrvDoFunc[62]` = `0x6FC71E70` (`SKILLS_SrvDo062_BonePrison` — spawns 12 circular `bonewall` segments around target)
  - `SkillSrvDoFunc[63]` = `0x6FC70190` (`SKILLS_SrvDo063_PoisonExplosion` — spawns 8 `poisonexplosioncloud` missiles on corpse)
  - *(Note: **Bone Spear** #84 has `srvdofunc = 0, cltdofunc = 0`; the engine automatically fires its `srvmissile = cltmissile = bonespear` #192 via default missile-launch fallback).*
- **`MissileSrvDoFunc`**: VA `0x6FD2D970`
  - `MissileSrvDoFunc[1]` = `0x6FC5F540` (`MISSMODE_SrvDo01_BasicMissile`)
  - `MissileSrvDoFunc[3]` = `0x6FC61AE0` (`MISSMODE_SrvDo03_PoisonCloud_Blizzard_ThunderStorm_HandOfGod` — `poisonexplosioncloud` #217)
  - `MissileSrvDoFunc[7]` = `0x6FC61710` (`MISSMODE_SrvDo07_GuidedArrow_BoneSpirit` — `bonespirit` #193 server homing)
  - `MissileSrvDoFunc[13]` = `0x6FC60EB0` (`MISSMODE_SrvDo13_BoneWallMaker` — `bonewallmaker` #207 spawns `bonewall` segments per sub-tile)
- **`MissileSrvHitFunc`**: VA `0x6FD2DA48`
  - `MissileSrvHitFunc[10]` = `0x6FC5B140` (`MISSMODE_SrvHit10_GuidedArrow_BoneSpirit` — `bonespirit` impact damage)

---

## 2. `Skills.txt` Data for Necromancer Poison & Bone Spells

| ID | Skill | ReqLvl | Prereq(s) | `srvst`/`do` | `cltst`/`do` | Mana (`mana`, `lvlmana`, `shift`) | `EType` & `HitShift` | Base `EMin`–`EMax` (Lev1 / 2 / 3 / 4 / 5) | `ELen` (Lev1..3) | Synergy (`EDmgSymPerCalc` / `calc1`) |
|---:|---|---:|---|---|---|---|---|---|---|---|
| 67 | **Teeth** | 1 | — | `0` / `8` | `19` / `17` | `6, +1, sh=7` ($3 + 0.5(\text{slvl}-1)$) | `mag`, `sh=7` ($\times \frac{1}{2}$) | `4–8` (`2–2` / `2–3` / `3–4` / `4–5` / `5–6`) | — | $+15\%$ per blvl of Bone Wall, Bone Prison, Bone Spear, Bone Spirit |
| 68 | **Bone Armor** | 1 | — | `0` / `18` | `0` / `0` | `11, +1, sh=8` ($11 + (\text{slvl}-1)$) | Absorb (`sh=8`) | — | — | Absorb $= 20 + 10(\text{slvl}-1) + 15(\text{BoneWall.blvl} + \text{BonePrison.blvl})$ |
| 73 | **Poison Dagger** | 6 | — | `16` / `32` | `0` / `0` | `12, +1, sh=6` ($3 + 0.25(\text{slvl}-1)$) | `pois`, `sh=1` ($\times \frac{1}{128}$) | `18–40` (`10–10` / `15–15` / `20–20` / `23–23` / `26–26`) | `50` (`+10` / `+10` / `+10`) | $+20\%$ per blvl of Poison Explosion, Poison Nova; AR $= +30 + 20(\text{slvl}-1)\%$ |
| 74 | **Corpse Explosion** | 6 | Teeth | `17` / `55` | `21` / `32` | `15, +1, sh=8` ($15 + (\text{slvl}-1)$) | `fire` (`50%`) + `phys` (`50%`), `sh=8` | $70\%\text{–}120\%$ of monster base 1p HP | — | Radius `ln34` $= 8 + (\text{slvl}-1)$ sub-tiles |
| 78 | **Bone Wall** | 12 | Bone Armor | `0` / `60` | `22` / `0` | `17, 0, sh=8` ($17$) | Construct (`bonewall` #344) | — | $600$ frames ($24\text{s}$, `Param2`) | $+25(\text{slvl}-1) + 10(\text{BoneArmor.blvl} + \text{BonePrison.blvl})\%$ HP |
| 83 | **Poison Explosion** | 18 | Poison Dagger, Corpse Explosion | `17` / `63` | `21` / `33` | `8, 0, sh=8` ($8$) | `pois`, `sh=4` ($\times \frac{1}{16}$) | `8–24` (`2–2` / `4–4` / `6–6` / `8–8` / `10–10`) | `50` (`+10` / `+10` / `+10`) | $+15\%$ per blvl of Poison Dagger, Poison Nova |
| 84 | **Bone Spear** | 18 | Corpse Explosion | `0` / `0` | `19` / `0` | `28, +1, sh=6` ($7 + 0.25(\text{slvl}-1)$) | `mag`, `sh=8` ($\times 1$) | `16–24` (`8–8` / `9–9` / `12–13` / `18–19` / `24–25`) | — | $+7\%$ per blvl of Teeth, Bone Wall, Bone Prison, Bone Spirit |
| 88 | **Bone Prison** | 24 | Bone Wall, Bone Spear | `19` / `62` | `22` / `0` | `27, -1, sh=8` ($\max(27 - (\text{slvl}-1), 1)$) | Construct (`bonewall` #344) | — | $600$ frames ($24\text{s}$, `Param2`) | $+25(\text{slvl}-1) + 8(\text{BoneArmor.blvl} + \text{BoneWall.blvl})\%$ HP |
| 92 | **Poison Nova** | 30 | Poison Explosion | `0` / `22` | `0` / `25` | `20, 0, sh=8` ($20$) | `pois`, `sh=4` ($\times \frac{1}{16}$) | `16–29` (`4–4` / `6–6` / `9–9` / `14–14` / `16–16`) | `50` (fixed $2\text{s}$) | $+10\%$ per blvl of Poison Dagger, Poison Explosion |
| 93 | **Bone Spirit** | 30 | Bone Spear | `0` / `10` | `0` / `18` | `24, +1, sh=7` ($12 + 0.5(\text{slvl}-1)$) | `mag`, `sh=8` ($\times 1$) | `20–30` (`16–17` / `17–18` / `18–19` / `19–20` / `20–21`) | — | $+6\%$ per blvl of Teeth, Bone Wall, Bone Prison, Bone Spear |

### Poison Bitrate & `HitShift` Math
In Diablo II 1.13c, elemental damage values in `Skills.txt` are scaled by `2^HitShift` into 8.8 fixed-point (`1/256` HP per frame for `pois`, or `1/256` HP instant for `mag`/`fire`).
- **Poison Dagger** (`HitShift = 1`): Per-frame poison bitrate $= \text{Base} \times 2^1 = 2 \times \text{Base}$ (in `1/256` HP/frame), multiplied over $\text{ELen} = 50 + 10(\text{slvl}-1)$ frames ($2.0 + 0.4(\text{slvl}-1)$ seconds).
- **Poison Explosion** (`HitShift = 4`): Per-frame poison bitrate $= \text{Base} \times 2^4 = 16 \times \text{Base}$ (in `1/256` HP/frame), multiplied over $\text{ELen} = 50 + 10(\text{slvl}-1)$ frames.
- **Poison Nova** (`HitShift = 4`): Per-frame poison bitrate $= \text{Base} \times 2^4 = 16 \times \text{Base}$ (in `1/256` HP/frame), over a fixed $\text{ELen} = 50$ frames ($2.0$ seconds).

---

## 3. `Missiles.txt` Suite for Poison & Bone Spells

| ID | Missile | `SrvDo`/`Hit` | `CltDo`/`Hit` | `Vel` (`Max`) | `Range` (`+Lev`) | `CelFile` | `AnimLen` | `Loop` / `SubLoop` | `CollideKill` / `NextDelay` | `Light` (`R,G,B`) | Sub-Missiles / Notes |
|---:|---|---|---|---|---|---:|---:|---|---|---|
| 20 | `bigblood1` | `0`/`0` | `2`/`0` | `3` (`3`) | `128` | `BloodLarge01` | 9 | `0` | `Kill=1` | `0` | Spawned by `corpseexplosion` (`CltDo11`) |
| 21 | `bigblood2` | `0`/`0` | `2`/`0` | `4` (`4`) | `128` | `BloodLarge02` | 9 | `0` | `Kill=1` | `0` | Spawned by `corpseexplosion` (`CltDo11`) |
| 42 | `explodingarrowexp` | `0`/`0` | `1`/`0` | `0` | `16` | `ExpArrowExplode` | 16 | `0` | `Kill=1` | `15` (`255,178,64`) | Spawned by Corpse Explosion (`cltmissileb`) |
| 114 | `teeth` | `1`/`0` | `1`/`0` | `16` (`16`) | `50` | `teethMissile` | 30 | `Sub=1 (0..15)` | `Kill=1`, `ND=4` | `3` (`255,255,255`) | `ExplosionMissile = teethexplode` (#204) |
| 115 | `corpseexplosion` | `1`/`0` | `11`/`0` | `0` | `13` | `CorpseExplodeGuts` | 13 | `0` | `0` | `5` (`255,178,64`) | `SubMissile1/2 = bigblood1/2` |
| 116 | `poisoncorpseexplosion` | `1`/`0` | `11`/`0` | `0` | `13` | `CorpseExplodeGutsPoison` | 13 | `0` | `0` | `5` (`255,178,64`) | Poison Explosion central gore visual |
| 118 | `poisonnova` | `1`/`0` | `1`/`0` | `12` (`12`) | `30` | `poisonNova` | 30 | `0` | `Kill=1`, `ND=4` | `0` | 64-bolt ring (`HitClass=80`) |
| 141 | `poisonpuff` | `1`/`0` | `1`/`0` | `1` (`15`) | `25` | `PoisonSmokePuff` | 26 | `0` | `0` | `0` | Client puff spawned by `poisonexplosioncloud` |
| 151 | `redlightmissile` | `1`/`0` | `1`/`0` | `0` | `10` (`+10`) | `null` | 2 | `0` | `0` | `5` (`255,178,64`) | Dynamic red light for Corpse Explosion |
| 152 | `greenlightmissile` | `1`/`0` | `1`/`0` | `0` | `10` (`+10`) | `null` | 2 | `0` | `0` | `5` (`128,255,128`) | Dynamic green light for Poison Explosion |
| 192 | `bonespear` | `1`/`0` | `18`/`24` | `24` (`24`) | `40` | `BoneSpear` | 6 | `Loop=1` | `Kill=0` (Pierces!) | `3` (`255,255,255`) | `CltParam1=3`, `CltSub1=bonespeartrail` (#248), `CltHitSub1=teethexplode` (#204) |
| 193 | `bonespirit` | `7`/`10` | `7`/`13` | `12` (`12`) | `128` | `BoneSpirit` | 8 | `Loop=1` | `Kill=1` | `3` (`255,255,255`) | `Param1=CltParam1=5`, `Param2=15`, `zoffset=-30`, `Exp=bonespiritexplode` (#327) |
| 204 | `teethexplode` | `1`/`0` | `1`/`0` | `0` | `13` | `teethexplode` | 13 | `0` | `0` | `0` | Impact effect for `teeth` and `bonespear` |
| 207 | `bonewallmaker` | `13`/`0` | `1`/`0` | `12` (`12`) | `7` (`+2`) | `null` | 2 | `0` | `CollideType=8` | `3` (`255,255,255`) | Invisible wing crawler for Bone Wall |
| 216 | `bonespearexplode` | `1`/`0` | `1`/`0` | `0` | `13` | `teethexplode` | 13 | `0` | `0` | `0` | `ExplosionMissile` of `bonespear` |
| 217 | `poisonexplosioncloud` | `3`/`0` | `4`/`0` | `0` | `60` | `PoisonSparks` | 31 | `Loop=1, Sub=1 (10..19)` | `Size=2, Col=1` | `0` (`128,255,128`) | `Param1=2, Param2=4`, `CltParam1..3=(24,1,6)`, `CltSub1=poisonpuff` (#141) |
| 218 | `bonecast` | `0`/`0` | `1`/`0` | `0` | `20` | `BoneCast` | 16 | `0` | `0` | `0` | Spawned at caster by `SkillCltStFunc[19]` |
| 248 | `bonespeartrail` | `0`/`0` | `1`/`0` | `0` | `8` | `BoneSpearTrail` | 9 | `0` | `0` | `0` | Spawned along `bonespear` path (`CltDo18`) |
| 327 | `bonespiritexplode` | `1`/`0` | `1`/`0` | `0` | `12` | `BoneSpiritExplode` | 13 | `0` | `0` | `0` | Impact effect of `bonespirit` (`CltHit13`) |

---

## 4. Per-Skill Client & Server Mechanics

### 1. Teeth (`Skill #67`)
- **Cast Start (`SKILLS_CltSt19` @ `0x6FB78F50`)**: Spawns `cltmissilec = bonecast` (#218) on the Necromancer (`BoneCast.dcc`, 16 frames).
- **Missile Count Formula**:
  $$\text{nMissiles} = \text{calc1} = \min(\text{ln12},\; 24) = \min(1 + \text{slvl},\; 24)$$
- **Fan Geometry (`SKILLS_SrvDo008_MultipleShot_Teeth_ShockWave` @ `0x6FC6D420` & `SKILLS_CltDo17` @ `0x6FAC5DA0`)**:
  - Computes aim vector `(dX, dY)` from caster to target. If close to caster, scales vector out so fan offsets distribute cleanly (`sub_6FD140D0` / `sub_6FD14120`).
  - Spawns `nMissiles` instances of `teeth` (#114, `Vel = 16`, `Range = 50` ticks $\approx 21$ yards) fanned across an orthogonal spread line perpendicular to `(dX, dY)`.
  - Exact client geometry (`0x6FAC5DA0`): `0x6FB50800` scales `d` ×4 when $|d|^2 < 4$, then ×2 when $|d|^2 < 16$; `0x6FB507C0` sets `P = (dY, -dX)` halved (truncating) until $|P|^2 \le 3$; aim points are `target - trunc(n·P/2) + i·P` for `i = 0..n-1` (flags `0x820`), so tooth `floor(n/2)` aims exactly at the target. A monster that enters death mode gets corpse collision (`D2Common.dll` `PATH_SetUnitDeadCollision` → `COLLIDE_CORPSE`), which `ClientCol` missiles do not collide with.
  - **NextDelay Anti-Shotgun**: `teeth` has `NextHit = 1` and `NextDelay = 4` frames (`0.16s`). When multiple teeth strike the same target on the same frame, only **1** tooth deals Magic damage; the target becomes immune to all `NextHit=1` missiles for the next 4 frames.

### 2. Bone Armor (`Skill #68`)
- **Buff Application (`SKILLS_SrvDo018_DefensiveBuff` @ `0x6FC628F0`)**:
  - Evaluates `aurastatcalc1 = aurastatcalc2 = (ln12 + (BoneWall.blvl + BonePrison.blvl) * 15) * 256` (8.8 fixed point):
    $$\text{AbsorbHP} = 20 + 10\cdot(\text{slvl}-1) + 15\cdot(\text{BoneWall.blvl} + \text{BonePrison.blvl})$$
  - Creates a `STATLIST_MAGIC` statlist on the caster setting `STATE_BONEARMOR` (#14), `STAT_BONEARMOR` (ItemStatCost `bonearmor` = **#132**), `STAT_BONEARMORMAX` (`bonearmormax` = **#133**; both `Send Bits = 32`, sent with S2C 0xA8/0xAA). *(Earlier revisions of this note said #62/#63 — those are `manadrainmindam`/`manadrainmaxdam`.)*
- **Physical Absorption Event (`EventFunc22` / `SKILLS_AuraEventFunc22_BoneArmor`)**:
  - Registered on `auraevent1 = absorbdamage` (fires *before* life loss, after resistances/MDR/PDR or before depending on combat pipeline stage—specifically absorbs `pDamage->dwPhysDamage` only!).
  - Computes `nAbsorbed = min(pDamage->dwPhysDamage, curBoneArmor)`, subtracts `nAbsorbed` from `pDamage->dwPhysDamage` and `curBoneArmor`.
  - **Orbiting Bone Shield Visual Stepping**:
    - `States.txt -> bonearmor` (#14) has `group = 1`, `nooverlays = 1`, `setfunc = 6`, `remfunc = 3`, `castoverlay = bonearmor_cast` (#140, `BoneShieldEmerge`, `Frames = 12`, `Trans = 3`), and 4 state overlays (`bonearmor_front` #141 / `bonearmor_back` #142: `Frames = 24`, `Trans = 3`, back `PreDraw = 1`; `bonearmor_null1` #143 `Frames = 2, AnimRate = 4`; `bonearmor_null2` #144 `Frames = 2, AnimRate = 2`; all `Radius = 0`).
    - **Client StateSetFunc[6] = `0x6FB23230`** (table `0x6FB9267C`; remfunc[3] = `0x6FB22A50`): reads `cur = stat 132`, `max = stat 133` from the state statlist and the old count from stat 355 (`shortparam1`); `n = 3; if (cur < max/3) n = 2; if (cur < 2*(max/3)) n--`; stores `n` in stat 355. `n > old`: remfunc[3] (drop cast/front/back/null overlays), then `bonearmor_null1` as overlay type 7 (`n >= 3`), `bonearmor_null2` as type 7 (`n >= 2`) and `bonearmor_cast` as type 4 with follow-ups (front, back). `n < old`: removes `old - n` (front, back) pairs. The overlay completion switch `0x6FB1C1D7` turns a finished type 4 into its two follow-ups (looping type 3) and a finished type 7 into `bonearmor_cast` type 4 — the null rows are 8- and 16-tick delays, so the pairs orbit with a 0 / 8 / 16 frame phase offset. Overlay indices `0x8C..0x8E` are created without replacing an existing overlay of the same index. Client: `src/client/world/bone-armor-overlays-113c.ts`.
    - Whenever `curBoneArmor > 0`, `EventFunc22` computes `nNewPct = 100 * curBoneArmor / maxBoneArmor`. Whenever `|nOldPct - nNewPct| >= 5`, it sets unit flag `UNITFLAG_UPGRADING` (`0x200`) so the state statlist is re-sent and the client re-runs setfunc[6].
    - When `curBoneArmor <= 0`, frees the Bone Armor statlist and clears `STATE_BONEARMOR`.

### 3. Poison Dagger (`Skill #73`)
- **Weapon Requirement**: `itypea1 = knif` (Dagger class weapons only).
- **Start Roll (`SKILLS_SrvSt16_PoisonDagger` @ `0x6FC6F7D0`)**:
  - Checks target (`SUNIT_GetTargetUnit`). Computes Attack Rating bonus `ToHit + (slvl - 1)*LevToHit = 30 + 20*(slvl - 1)%`.
  - Calls `SUNITDMG_FillDamageValues` with `SrcDam = 128` (`100%` weapon damage) and adds Poison Dagger's skill elemental poison damage (`SKILLS_CalculateDamage` with `EType = pois`, `HitShift = 1`, `ELen = 50 + 10*(slvl - 1)` frames, $+20\%$ synergy per blvl of Poison Explosion and Poison Nova).
  - Caches the rolled `D2DamageStrc` in `SUNITDMG_AllocCombat`.
- **Action Strike (`SKILLS_SrvDo032_PoisonDagger` @ `0x6FC6F920`)**:
  - Applies the cached melee + poison damage (`SUNITDMG_DrainItemDurability` + `SUNITDMG_ExecuteEvents`).

### 4. Corpse Explosion (`Skill #74`)
- **Corpse Validation (`SKILLS_SrvSt17_Poison_CorpseExplosion` @ `0x6FC6EEE0` & `SKILLS_CltSt21` @ `0x6FB78330`)**:
  - Calls `D2GAME_CanSummonFromCorpse_6FD0C9E0(pGame, pCaster, pCorpse)`: verifies `pCorpse->dwUnitType == UNIT_MONSTER`, `pCorpse->dwAnimMode == MONMODE_DEAD`, `!STATES_CheckState(STATE_CORPSE_NOSELECT)`, `!STATES_CheckState(STATE_CORPSE_NODRAW)`, and `MonStats2.txt -> corpseSel == 1`.
- **Server Dual-Radius Damage (`SKILLS_SrvDo055_CorpseExplosion` @ `0x6FC6F4D0`)**:
  1. **Corpse Consumption**: Sets `STATE_CORPSE_NODRAW` (#104, hides corpse completely) and `UNIT_SetCollisionMask(pCorpse, 0)`.
  2. **1-Player Base Monster HP Calculation (`sub_6FD0C7E0`)**:
     - Looks up `MonStats.txt` + `MonLvl.txt` for `pCorpse->dwClassId` at `corpseLevel` in the current difficulty (`monStatsInit.nMinHP` and `monStatsInit.nMaxHP`), computing average 1-player base HP in 8.8 fixed point:
       $$\text{BaseHP}_{8.8} = (\text{nMaxHP} + \text{nMinHP}) \ll 7 = \frac{\text{nMaxHP} + \text{nMinHP}}{2} \times 256$$
     - **Important**: Corpse Explosion uses **unscaled 1-player base monster life** (`noRatio` / `/players X` HP bonus is NOT included!).
     - If `casterLevel < corpseLevel`, scales down: $\text{BaseHP}_{8.8} = \lfloor \text{BaseHP}_{8.8} \cdot \text{casterLevel} / \text{corpseLevel} \rfloor$.
  3. **70%–120% Roll & 50%/50% Physical/Fire Split**:
     - Rolls a random percentage $P \in [70, 120]$ (`calc1 = 70`, `calc2 = 120`):
       $$\text{TotalDmg} = \left\lfloor \frac{\text{BaseHP}_{8.8} \cdot P}{100} \right\rfloor$$
     - Splits `Param5 = 50%` into Fire (`dwFireDamage = TotalDmg * 50 / 100`) and the remainder (`50%`) into Physical (`dwPhysDamage = TotalDmg - dwFireDamage`).
  4. **Inner-Half Physical vs. Outer-Full Fire Radius (`sub_6FD0B2B0`)**:
     - Evaluates `nRawRange = aurarangecalc = ln34 = 8 + (slvl - 1)` sub-tiles.
     - Computes:
       $$\text{nOuterRange} = \left\lfloor \frac{\text{nRawRange} + 1}{2} \right\rfloor, \qquad \text{nInnerRange} = \left\lfloor \frac{\text{nRawRange}}{2} \right\rfloor$$
     - Iterates all hostile units within `nOuterRange` sub-tiles (`sub_6FD0FE80`). If a target's distance from the corpse exceeds `nInnerRange` (`dx^2 + dy^2 > nInnerRange^2`), **zeros out `damage.dwPhysDamage = 0`** before applying damage! Thus, the outer ring deals Fire damage only, while the inner core deals both Physical and Fire damage.
- **Client Gore & Fire Burst (`SKILLS_CltDo32` @ `0x6FB78FB0` $\to$ `0x6FB78CE0`)**:
  - Hides the corpse client-side and spawns:
    1. `cltmissilea = corpseexplosion` (#115, `CorpseExplodeGuts`, `CltDoFunc = 11` @ `0x6FB62DC0`), which on tick 0 spawns flying blood chunks `bigblood1` (#20) and `bigblood2` (#21) (`CltDoFunc = 2` @ `0x6FB63060`).
    2. `cltmissileb = explodingarrowexp` (#42, `ExpArrowExplode`, 16 frames).
    3. `cltmissilec = redlightmissile` (#151, dynamic orange-red light pulse).

### 5. Bone Wall (`Skill #78`)
- **Central Segment + 2 Perpendicular Crawler Missiles (`SKILLS_SrvDo060_BoneWall` @ `0x6FC70FE0`)**:
  1. Resolves cast coordinates `(targetX, targetY)` and computes aim vector `(dX, dY)` from caster to `(targetX, targetY)`.
  2. Rotates `(dX, dY)` by $90^\circ$ via `sub_6FD14120`: `perpX = dY`, `perpY = -dX` (halved until `perpX^2 + perpY^2 <= 3`).
  3. Summons **1 central `bonewall` monster** (`Monster #344`, `AI = BoneWall`, `summode = S1`, `pettype = none` so there is no summon cap!) at `(targetX, targetY)` via `D2GAME_CreateSummonMonster_6FD0CC50`:
     - Base HP (`MonStats.txt` + `MonLvl.txt`: Normal `19`, Nightmare `147`, Hell `431`) is scaled by `calc1`:
       $$\text{BonusHP}\% = 25\cdot(\text{slvl}-1) + 10\cdot(\text{BoneArmor.blvl} + \text{BonePrison.blvl})$$
     - Schedules `EVENTTYPE_MONUMOD` (`UMod 21` kill timer) for `Param2 = 600` frames ($24$ seconds).
  4. Fires **2** invisible `bonewallmaker` missiles (#207, `Vel = 12`, `Range = 7 + 2*slvl`) in opposite perpendicular directions `(+perpX, +perpY)` and `(-perpX, -perpY)`:
     - Stores `pCentralBoneWall->dwUnitId` in `pMissile->nTargetX` and wing segment quota `calc2 / 2 = 8 / 2 = 4` in `pMissile->nTargetY`.
- **Wing Crawler Propagation (`MISSMODE_SrvDo13_BoneWallMaker` @ `0x6FC60EB0`)**:
  - Advances the invisible `bonewallmaker` missile each frame. Whenever `D2Common_10234(pDynamicPath)` indicates the missile crossed into a new sub-tile and `nTargetY > 0`:
    - Spawns a new `bonewall` (#344) segment at the current sub-tile with the same `calc1` HP bonus and `600`-frame lifetime.
    - Links the segment into the central segment's minion list (`AIGENERAL_AllocMinionList`) and assigns `MONUMOD_KILLMINIONSDEATH` (`UMod 15`) to both center and wing segments so **destroying any single segment or expiring the timer collapses the entire wall**.
    - Decrements `nTargetY` (`4 -> 3 -> 2 -> 1 -> 0`), producing up to $1 + 2 \times 4 = 9$ total `bonewall` segments.

### 6. Poison Explosion (`Skill #83`)
- **Corpse Consumption (`SKILLS_SrvDo063_PoisonExplosion` @ `0x6FC70190`)**:
  - Sets `STATE_CORPSE_NOSELECT` (#118) on the corpse (`pCorpse` remains drawn as a burst/defiled corpse via client `poisoncorpseexplosion` #116, unlike Corpse Explosion's `STATE_CORPSE_NODRAW`, though `D2GAME_CanSummonFromCorpse` blocks reuse).
  - Calls `MISSMODE_CreatePoisonCloudHitSubmissiles(pGame, pCaster, pCorpse, srvmissilea=217, nSkillId=83, nSubStep=0, nMainStep=2, nLoops=0)` (`MissMode.cpp` @ `0x6FC5E220` in 1.13c):
    - Iterates `i = 0, 2, 4, 6, 8, 10, 12, 14` (`nMainStep = 2`) over a 16-point perimeter table of radius 2 sub-tiles (`xOffsets = {-2,-2,-2,-2,-2,-1,0,1,2,2,2,2,2,1,0,-1}`, `yOffsets = {-2,-1,0,1,2,2,2,2,2,1,0,-1,-2,-2,-2,-2}`).
    - Spawns **8** `poisonexplosioncloud` (#217) missiles (`Range = 60` frames $= 2.4\text{s}$, `Size = 2`, `Velocity = Param1 << 7 = 256` to step onto their perimeter sub-tiles).
- **Cloud Tick & Client Puffs (`MISSMODE_SrvDo03` @ `0x6FC61AE0` & `MISSMODE_CltDo04` @ `0x6FB6BE00`)**:
  - On the server, each `poisonexplosioncloud` persists for 60 frames and applies Poison Explosion's poison bitrate (`HitShift = 4`, duration `50 + 10*(slvl - 1)` frames) on collision (`CollideType = 3`).
  - On the client (`SKILLS_CltDo33` @ `0x6FB78C90` $\to$ `0x6FB78710`): no corpse state is set client-side; spawns `cltmissilea = poisoncorpseexplosion` (#116) at the corpse, `cltmissilec = greenlightmissile` (#152), then calls the ring spawner `0x6FB66BC0(missile, cltmissileb, 0, step 2)` → **8** `poisonexplosioncloud` (#217) from the corpse toward the even entries of the 16-point radius-2 table (X `0x6FB83DB0` = `{0,1,2,2,2,2,2,1,0,-1,-2,-2,-2,-2,-2,-1}`, Y `0x6FB83D70` = `{2,2,2,1,0,-1,-2,-2,-2,-2,-2,-1,0,1,2,2}`) with raw velocity `Param1 << 7 = 256` (flags `0x17`, then `*75/100`).
  - `MISSMODE_CltDo04` (`0x6FB6BE00` $\to$ `0x6FB69470(CltParam1, CltParam2, CltParam3, CltSubMissile1)`, then CltDo01): each frame, when `#10737` remaining frames is 0 **or** `SEED_RollLimitedRandomNumber(seed, CltParam1 = 24) == 0`, spawns `CltParam2 = 1` `poisonpuff` (#141, `PoisonSmokePuff`, own `Vel = 1`, `Range = 25`) aimed at `pos + (d + sign(d)·r)` per axis with `d = roll(2r) - r`, `r = CltParam3 = 6`. (Not "every frame while elapsed < Range - CltParam1".)
  - Server `SKILLS_SrvDo063` (`0x6FC70190`) toggles state `0x76` = **118** `corpse_noselect` (no `hide`), unlike Corpse Explosion `SrvDo055` (`0x6FC6F4D0`, state `0x68` = 104 `corpse_nodraw`, `hide = 1`): the Poison Explosion corpse stays drawn but can no longer be selected.

### 7. Bone Spear (`Skill #84`)
- **Launch**: Uses `SkillCltStFunc[19]` (`0x6FB78F50` $\to$ `bonecast` #218) and default missile launch (`srvmissile = cltmissile = bonespear` #192).
- **Piercing Trajectory**: `bonespear` (#192) has `Vel = 24`, `Range = 40` ticks ($1.6\text{s}$, $\approx 25.3$ yards), `CollideType = 3`, and **`CollideKill = 0`**, allowing it to pierce 100% of monsters unconditionally until it hits a wall or expires.
- **Wake Trail (`MISSMODE_CltDo18_BoneSpear` @ `0x6FB68960`)**:
  - Checks `D2Common_10985(pMissile) >= CltParam1` (`3`). From tick `3` through tick `39`, spawns **1** stationary `bonespeartrail` (#248, `BoneSpearTrail.dcc`, 9 frames, 32 directions) per frame at the spear's exact sub-tile/direction (`0x6FB689E5..0x6FB68A41`).
- **Impact Visual (`MISSMODE_CltHit24_BoneSpear` @ `0x6FB60800`)**:
  - Whenever `bonespear` strikes a unit (`ClientCol = 1`), spawns `CltHitSubMissile1 = teethexplode` (#204) at the impact point; on wall/range termination, spawns `ExplosionMissile = bonespearexplode` (#216).

### 8. Bone Prison (`Skill #88`)
- **Unit Target Requirement (`SKILLS_SrvSt19_BonePrison` @ `0x6FC6EE40`)**:
  - Requires a valid target unit (`SUNIT_GetTargetUnit(pGame, pUnit) != NULL`) and `!DUNGEON_IsRoomInTown(pTargetRoom)`. Cannot be cast on empty ground.
- **12-Segment Circular Cage (`SKILLS_SrvDo062_BonePrison` @ `0x6FC71E70`)**:
  - Reads the target's center `(targetX, targetY)` and iterates `i = 0..11` over the 12 hardcoded circular sub-tile offsets (`radius` $\approx \sqrt{4^2 + 1^2} \approx 4.12$ sub-tiles):
    ```cpp
    constexpr int32_t xOffsets[12] = { -1,  1,  3,  4,  4,  3, -1,  1, -3, -4, -4, -3 };
    constexpr int32_t yOffsets[12] = { -4, -4, -3, -1,  1,  3,  4,  4,  3, -1,  1, -3 };
    ```
  - At each offset `(targetX + xOffsets[i], targetY + yOffsets[i])`, spawns a `bonewall` (#344, `summode = NU`) monster facing inward toward `(targetX, targetY)` (`PATH_SetDirection`).
  - Applies `calc1 = 25*(slvl - 1) + 8*(BoneArmor.blvl + BoneWall.blvl)%` bonus HP and a `Param2 = 600`-frame ($24\text{s}$) `EVENTTYPE_MONUMOD` timer.
  - Links all spawned segments into the first segment's `AIGENERAL_AllocMinionList` with `MONUMOD_KILLMINIONSDEATH` (`UMod 15`), so destroying any segment collapses the entire 12-segment prison.

### 9. Poison Nova (`Skill #92`)
- **64-Bolt Ring (`SKILLS_SrvDo022_NovaAttack` @ `0x6FC63AA0` & `SKILLS_CltDo25_Nova` @ `0x6FB23CB0`)**:
  - Calls `sub_6FD14170` (server, `Skills.cpp` line 3203) and `0x6FB51020` (client) to spawn **64** `poisonnova` (#118) missiles from the caster's position aimed at 64 evenly spaced circle perimeter offsets of radius 30 (`(30,0), (29,2), (29,5), ..., (29,-2)`).
  - Each `poisonnova` bolt travels at `Vel = 12` for `Range = 30` frames ($1.2\text{s}$, $\approx 9.6$ yards), with `NextHit = 1, NextDelay = 4` frames so an enemy cannot be hit by multiple adjacent bolts simultaneously.
  - Inflicts `EType = pois` (`HitShift = 4`) over a fixed `ELen = 50` frames ($2.0$ seconds).

### 10. Bone Spirit (`Skill #93`)
- **Launch & Tracking Mode (`SKILLS_SrvDo010_GuidedArrow_BoneSpirit` @ `0x6FC6D270` & `SKILLS_CltDo18` @ `0x6FAC5C40`)**:
  - Spawns `bonespirit` (#193, `Vel = 12`, `Range = 128` frames $= 5.12\text{s}$, `zoffset = -30`).
  - Initializes missile tracking mode in `pMissile->nTargetX` (`D2Common_10440`):
    - If cast directly on a hovered target unit: `nTargetX = 1` (locked onto `pTarget`), `nTargetY = 0`.
    - If cast on empty ground: `nTargetX = 2` (seek mode; converted to `1` once a target is acquired or scans every `Param1 = 5` frames).
- **Homing Loop (`MISSMODE_SrvDo07_GuidedArrow_BoneSpirit` @ `0x6FC61710` & `MISSMODE_CltDo07` @ `0x6FB62EB0`)**:
  - Every `Param1 = 5` frames (`nTargetY` countdown from 5 to 0), if `(nTargetX & 1)` (or after converting `2` to seek):
    - Checks current target validity; if none, scans for the nearest enemy monster/player within `Param2 = 15` sub-tiles (`sub_6FC61580`).
    - **Distance Window (`3 < dist < 25` sub-tiles)**: Re-paths the missile (`D2Common_10142` / `PATH_Recalc`) toward the target **only if** distance $d$ satisfies $3 < d < 25$ sub-tiles. Once within $\le 3$ sub-tiles, it flies straight through its last vector (allowing fast targets to dodge a close turn).
  - **Client `MISSMODE_CltDo07` (`0x6FB62EB0`) differs from the server**: it only follows the path target set by `SKILLS_CltDo18` (`0x6FAC5C40`: caster target `0x6FB55F70` → mode 1, none → mode 2 and flags `0x420`). If `mode & 1` it refreshes the target pointer (`0x6FADA0B0`, no nearest-enemy search), drops it if dead (`0x6FB55440`) or not hostile to the owner (`0x6FB562A0`), and every `CltParam1 = 5` elapsed frames (`#10985 % 5 == 0`) re-paths when `3 < D2Common #10522 distance < 25` (`#10522`: per-axis |Δ| minus both half sizes, clamped at 0, `(2·max + min) / 2`). A ground-cast client bone spirit flies straight; `monbonespirit` (#329) has no `Param2` at all. Client: `src/client/world/nec-poison-bone-113c.ts`.
- **Impact (`MISSMODE_SrvHit10` @ `0x6FC5B140` & `MISSMODE_CltHit13` @ `0x6FB61350`)**:
  - Deals pure Magic damage (`EType = mag`, `HitShift = 8`) and spawns `bonespiritexplode` (#327, `BoneSpiritExplode.dcc`, 13 frames).

# Act 3 Water Watcher / River Stalker (`TE` / `TN`) & Submerge/Emerge State Machine (1.13c Ground Truth)

## 1. Authoritative Binary & MPQ Sources

All addresses and table rows below are verified directly against Diablo II: Lord of Destruction v1.13c (`samples/d2` / `join(homedir(), 'd2-data')`):

- `D2Game.dll` (`imagebase 0x6FC20000`)
- `D2Common.dll` (`imagebase 0x6FD50000`)
- `D2Client.dll` (`imagebase 0x6FAB0000`)
- MPQ Excel tables (`d2data.mpq`, `d2exp.mpq`, `Patch_D2.mpq`): `MonStats.txt`, `MonStats2.txt`, `MonAI.txt`, `MonSeq.txt`, `MonMode.txt`, `MonPlace.txt`, `MonPreset.txt`, `Skills.txt`, `Missiles.txt`, `Overlay.txt`, `MonSounds.txt`.

---

## 2. MPQ Table Rows

### 2.1 `MonStats.txt` & `MonStats2.txt` (`hcIdx 247..249`, `258..263`)

| `hcIdx` | `Id` | `BaseId` | `Code` | `AI` | `MeleeRng` | `Skill1` (`Sk1mode`) | `Skill2` (`Sk2mode`) | `MissA1` | `aidel` (N/NM/H) | `aip1` (N/NM/H) | `aip2` | `aip3` (N/NM/H) | `aip4` (N/NM/H) | `aip5` (N/NM/H) | `aip6` (N/NM/H) |
|---:|---|---|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 247..249 | `frogdemon1..3` | `frogdemon1` (`247`) | `FD` | `FrogDemon` (`#31`) | `1` | `Submerge` `#176` (`SQ` `14`) | `Emerge` `#180` (`S1` `8`) | — (`MissA2=frogfire/pois`) | `15/14/13` | `75/85/95` | `35/40/50` | `8` | `6/7/8` | `20` | `15/13/10` |
| 258 | `tentacle1` | `tentacle1` (`258`) | `TN` | `Tentacle` (`#33`) | `6` | `Submerge` `#176` (`SQ` `14`) | `Emerge` `#180` (`S1` `8`) | — | `15/14/13` | `60` | `50` | `16` | `12` | `15` | `12` |
| 259 | `tentacle2` | `tentacle1` (`258`) | `TN` | `Tentacle` (`#33`) | `6` | `Submerge` `#176` (`SQ` `14`) | `Emerge` `#180` (`S1` `8`) | — | `15/14/13` | `75` | `50` | `14` | `14` | `13` | `12` |
| 260 | `tentacle3` | `tentacle1` (`258`) | `TN` | `Tentacle` (`#33`) | `6` | `Submerge` `#176` (`SQ` `14`) | `Emerge` `#180` (`S1` `8`) | — | `15/14/13` | `90` | `50` | `12` | `16` | `10` | `12` |
| 261 | `tentaclehead1` | `tentaclehead1` (`261`) | `TE` | `TentacleHead` (`#34`) | `0` | `Submerge` `#176` (`SQ` `14`) | `Emerge` `#180` (`S1` `8`) | `tentaclegoo` (`#139`) | `15/14/13` | `70` | `50` | `16` | `12` | `15` | `12` |
| 262 | `tentaclehead2` | `tentaclehead1` (`261`) | `TE` | `TentacleHead` (`#34`) | `0` | `Submerge` `#176` (`SQ` `14`) | `Emerge` `#180` (`S1` `8`) | `tentaclegoo` (`#139`) | `15/14/13` | `85` | `50` | `14` | `14` | `13` | `14` |
| 263 | `tentaclehead3` | `tentaclehead1` (`261`) | `TE` | `TentacleHead` (`#34`) | `0` | `Submerge` `#176` (`SQ` `14`) | `Emerge` `#180` (`S1` `8`) | `tentaclegoo` (`#139`) | `15/14/13` | `95` | `50` | `12` | `16` | `10` | `14` |

Key `MonStats.txt` / `MonStats2.txt` attributes for `tentacle1..3` (`TN`) and `tentaclehead1..3` (`TE`):
- `Spawn = 1`, `noMap = 1`, `enabled = 1`, `killable = 1`, `isAtt = 1`, `SizeX = 2`, `SizeY = 2`, `Shadow = 0`, `corpseSel = 0`.
- Mode flags (`mDT=1, mNU=1, mWL=0, mGH=1, mA1=1, mA2=0, mBL=0, mSC=0, mS1=1, mDD=1, mRN=0`):
  - `TN`: `DT=17`, `NU=12`, `GH=4`, `A1=20`, `S1=13`, `DD=1`, `SQ=13` (`monseq = seq_tentaclesubmerge`).
  - `TE`: `DT=18`, `NU=13`, `GH=6`, `A1=15`, `S1=21`, `DD=1`, `SQ=21` (`monseq = seq_tentheadsubmerge`).

### 2.2 `MonMode.txt` & `MonSeq.txt`
- `MONMODE_SKILL1 = 8` (`S1`): Forward emerge clip (`s1` frames `0 -> 20` on `TE`; `0 -> 12` on `TN`; `0 -> 15` on `FD`).
- `MONMODE_SEQUENCE = 14` (`SQ`): Reverse submerge sequence in `MonSeq.txt`:
  - `seq_tentheadsubmerge` (21 steps): `s1` frames `20, 19, 18, ..., 1, 0` (sinking from surfaced pose down into calm water at `s1` frame `0`).
  - `seq_tentaclesubmerge` (13 steps): `s1` frames `12, 11, 10, ..., 1, 0` (sinking down to `s1` frame `0`).
  - `seq_froghidden` (3 steps): `s1` frames `0, 1, 2`.
  - `seq_maggotdown` (12 steps, `#162 MagottDown`): `s1` frames `11, 10, ..., 1, 0`.

### 2.3 `Skills.txt`, `Missiles.txt`, `Overlay.txt`, `MonSounds.txt`
- **Skill `#176` `Submerge`**: `srvstfunc = 71` (`0x6FCD2FA0`), `srvdofunc = 0`, `cltstfunc = 53` (`0x6FB069C0`), `cltdofunc = 50` (`0x6FB069A0`), `monanim = xx` -> resolved via `Sk1mode = SQ` (`mode 14`).
- **Skill `#180` `Emerge`**: `srvstfunc = 72` (`0x6FCD2E90`), `srvdofunc = 73` (`0x6FCD2F80`), `cltstfunc = 52` (`0x6FB069A0`), `cltdofunc = 50` (`0x6FB069A0`), `monanim = xx` -> resolved via `Sk2mode = S1` (`mode 8`).
- **Missile `#139` `tentaclegoo`**: `Vel = 12`, `MaxVel = 12`, `Range = 40`, `Size = 1`, `sHitPar1 = 64`, `HitClass = 10`, `EType = pois`, `HitShift = 8`, `EMin = 11`, `EMax = 18`, `ELen = 800`, `CelFile = Bloodball2`, `CollideType = 3`, `CollideKill = 1`, `LastCollide = 1`, `ClientCol = 1`.
- **Overlay `#157` `tentacleheadbloodripple`**: `Filename = WaterRipple2`, `Frames = 15`, `PreDraw = 1`, `1ofN = 1`, `AnimRate = 2`, `Trans = 0`.
- **`MonSounds.txt`**:
  - `#120` `tentacle`: `Attack1 = monster_tentacle_attack_1` (`1914`), `HitSound = monster_tentacle_gethit_1` (`1919`), `DeathSound = monster_tentacle_death_1` (`1923`).
  - `#121` `tentaclehead`: `Attack1 = monster_tentaclehead_attack_1` (`1933`), `HitSound = monster_tentaclehead_gethit_1` (`1938`), `DeathSound = monster_tentaclehead_death_1` (`1943`), `Neutral = monster_tentaclehead_neutral_1` (`1948`).

---

## 3. Reverse-Engineered 1.13c DLL Functions

### 3.1 Preset Water Pool Spawning (`D2Game.dll` `0x6FC67E6D` & `0x6FD0E51C`)
- Act 3 DS1 water pools place `MonPreset.txt` Act 3 entries `56` (`place_tentacle_ns` -> `MonPlace #10`, `presetIndex = 810`) and `57` (`place_tentacle_ew` -> `MonPlace #11`, `presetIndex = 811`), e.g. in **Travincal (`areaId 83`)** and **Kurast Sewers Level 2 (`areaId 93`)**.
- `D2Game.dll` `MONSTER_ResolveMonPlace` (`0x6FC67E6D`, switch jump tables `0x6FC6821C` / `0x6FC68260` / `0x6FC68284`):
  - Cases `10` & `11` (`place_tentacle_ns` / `place_tentacle_ew`):
    - `areaId` in `{76, 77, 78}` (`Spider Forest`, `Great Marsh`, `Flayer Jungle`) -> `hcIdx = 262` (`tentaclehead2`, River Stalker)
    - `areaId` in `{92, 93}` (`Kurast Sewers Level 1 & 2`) -> `hcIdx = 263` (`tentaclehead3`, Stygian Watcher)
    - All other areas (including `79..83` Kurast / **Travincal**) -> `hcIdx = 261` (`tentaclehead1`, Water Watcher).
  - Other deterministic `MonPlace` cases in `0x6FC67E6D`:
    - `4 -> 266` (`navi`), `5 -> 267` (`bloodraven`), `8 -> 284` (`sandmaggotqueen1`), `17 -> 19` (`fallen4`), `18 -> 58` (`vulture2`), `22 -> 141` (`fetish4`), `23 -> 278` (`fetishshaman1`), `29 -> 453` (`minion1`), `30 -> (areaId === 110 ? 492 : 529)`, `31 -> 522`, `32 -> 438`; non-spawning marker rows (`0, 1, 6, 7, 9, 12..16, 19..21, 33..36`) return `-1`.
- `D2Game.dll` `MONSTER_SpawnMinions` (`0x6FD0E51C` -> `0x6FD0EB6A`):
  - When `TentacleHead` (`hcIdx 261..263`, `baseId == 261`) spawns, it spawns `4 + Rnd(3)` (`4..6`) `Tentacle` body segments (`hcIdx - 3`: `258..260`) on surrounding water pool cells, linked to the `TentacleHead` boss (`MONSTER_GetBossUnit` `0x6FD0F080`).
- Initial submerged spawn (`D2Game` spawn init & `D2Client` `0x6FAFDBF4`):
  - Units with `baseId` in `{247, 258, 261}` initialize in `MONMODE_SEQUENCE` (`mode = 14`), clearing unit flags `UNITFLAG_TARGETABLE (0x02) | UNITFLAG_CANBEATTACKED (0x04) | UNITFLAG_ISVALIDTARGET (0x08)` (`dwFlags &= ~0x0E`) and setting `aiState = 1` (submerged).

### 3.2 `Submerge` (`#176`) & `Emerge` (`#180`) Skill Functions
- **Server (`D2Game.dll`)**:
  - `#176 Submerge` `srvstfunc = 71` (`0x6FCD2FA0`): Clears `dwFlags &= ~0x0E` (`~UNITFLAG_TARGETABLE | ~UNITFLAG_CANBEATTACKED | ~UNITFLAG_ISVALIDTARGET`) and transitions unit to `MONMODE_SEQUENCE` (`mode = 14`).
  - `#180 Emerge` `srvstfunc = 72` (`0x6FCD2E90`): Transitions unit to `MONMODE_SKILL1` (`mode = 8`); `srvdofunc = 73` (`0x6FCD2F80`) restores `dwFlags |= 0x0E` (`TARGETABLE | CANBEATTACKED | ISVALIDTARGET`).
- **Client (`D2Client.dll`)**:
  - `#176 Submerge` `cltstfunc = 53` (`0x6FB069C0`): Executes `and dword ptr [ecx+0xc4], 0xfffffff1` (`pUnit->dwFlags &= ~0x0E`), clearing targetability while playing `seq_tentheadsubmerge` / `seq_tentaclesubmerge` (`mode 14`).
  - `#180 Emerge` `cltstfunc = 52` (`0x6FB069A0`, `cltdofunc = 50`): Executes `or dword ptr [ecx+0xc4], 0x0e` (`pUnit->dwFlags |= 0x0E`) and starts `MONMODE_SKILL1` (`mode 8`).
  - **Sequence End Freeze (`D2Client.dll` `0x6FAFEEF6` & `0x6FAFDBCC`)**: Unlike normal one-shot sequences that revert to `MONMODE_NEUTRAL (1)` when their last frame completes, `MONMODE_SEQUENCE (14)` on `FrogDemon` (`baseId 247`), `Tentacle` (`baseId 258`), `TentacleHead` (`baseId 261`), and `#162 MagottDown` (`baseId 68 / 284`) **freezes on the final sequence frame** (`wFrame = wFrameCount - 0x100`, `s1` frame `0` underwater/burrowed) until `#180 Emerge` / `#161 MagottUp` transitions the unit out of `mode 14`.
  - **Death Blood Ripple (`D2Client.dll` `0x6FAFE4D2`)**: When `Tentacle` (`baseId 258`) or `TentacleHead` (`baseId 261`) enters `MONMODE_DEATH (0)`, `D2Common_SetOverlay(pUnit, 157, 0)` attaches Overlay `#157` (`tentacleheadbloodripple`, `WaterRipple2`).

### 3.3 `AiTentacleHead` (`D2Game.dll` `0x6FCA5500`) & `AiTentacle` (`D2Game.dll` `0x6FC9CB10`)
- **`AiTentacleHead` (`0x6FCA5500`, `hcIdx 261..263`)**:
  - `aiState == 0` -> initializes `aiState = 1`, `submergeTimerFrame = currentFrame`, `dwFlags &= ~0x0E`, `mode = 14`.
  - **`aiState == 1` (Submerged)**:
    - Untargetable & invulnerable (`dwFlags & 0x0E == 0`).
    - If `currentFrame >= submergeTimerFrame` and a valid target is within `dist < aip6` (`12 / 14 / 14` subtiles): casts `#180 Emerge` (`mode = 8` `MONMODE_SKILL1`), restores `dwFlags |= 0x0E`, sets `aiState = 2`, `submergeTimerFrame = currentFrame + aip4 * 25` (`300 / 350 / 400` frames = `12 / 14 / 16 s`), stalls for the 21-frame emerge animation.
    - Otherwise stalls `aip5` (`15 / 13 / 10`) frames.
  - **`aiState == 2` (Surfaced)**:
    - **Re-submerge check (`0x6FCA5571`)**: Once `currentFrame > submergeTimerFrame`, if `!hasTarget || dist > aip6` OR (`dist > 6` and `Rnd(100) < aip2` [`50%`]): casts `#176 Submerge` (`mode = 14` `MONMODE_SEQUENCE`), clears `dwFlags &= ~0x0E`, sets `aiState = 1`, `submergeTimerFrame = currentFrame + aip3 * 25` (`400 / 350 / 300` frames = `16 / 14 / 12 s`), stalls `21` frames.
    - **Surfaced combat (`0x6FCA56A0`)**: If target is within missile range and `Rnd(100) < aip1` (`70 / 85 / 95%`), fires `A1` (`mode = 4`) launching `MissA1 = tentaclegoo` (`#139`); otherwise idles in `NU` (`mode = 1`) for `aidel` (`15 / 14 / 13`) frames.
- **`AiTentacle` (`0x6FC9CB10`, `hcIdx 258..260`)**:
  - **Boss death cascade (`0x6FC9CB41..0x6FC9CBF1`)**: Calls `MONSTER_GetBossUnit` (`0x6FD0F080`). If the boss `TentacleHead` no longer exists, kills the `Tentacle` immediately; if the boss is in `DT`/`DD` (`dead`), rolls `Rnd(100) < 40` per AI tick and kills the `Tentacle` on success (cascading limb deaths).
  - **`aiState == 1` (Submerged)**: If `currentFrame >= submergeTimerFrame` and (`dist <= 6` OR `dist < aip6` [`12`] OR (`bossSurfaced && Rnd(100) < 5`)): casts `#180 Emerge` (`mode = 8`), restores `dwFlags |= 0x0E`, sets `aiState = 2`, `submergeTimerFrame = currentFrame + aip4 * 25`, stalls `13` frames; else stalls `aip5` frames.
  - **`aiState == 2` (Surfaced)**:
    - **Re-submerge check**: Once `currentFrame > submergeTimerFrame`, if `!hasTarget || dist > aip6` OR (`dist > 6 && Rnd(100) < aip2` [`50%`]) OR (`bossSubmerged && Rnd(100) < 50`): casts `#176 Submerge` (`mode = 14`), clears `dwFlags &= ~0x0E`, sets `aiState = 1`, `submergeTimerFrame = currentFrame + aip3 * 25`, stalls `15` frames.
    - **Surfaced melee (`0x6FC9CDE3`)**: `MeleeRng = 6` subtiles. When target is within melee range and `Rnd(100) < aip1` (`60 / 75 / 90%`), executes `A1` (`mode = 4`) melee strike; else stalls `aidel` frames.

### 3.4 Shore-to-Water Melee Reachability (`D2Common.dll` `UNITS_IsInMeleeRange` `0x6FD826C0`)
- Water pool spawns sit `4` subtiles inside water tiles marked `COLLIDE_WALL (0x0001)`.
- Disassembly of `D2Common.dll` `#10396` `UNITS_IsInMeleeRange` (`0x6FD826C0`, specifically `0x6FD826DA..0x6FD82756`):
  1. At `0x6FD826FE..0x6FD82728`: When the defender is a monster whose `BaseId` (`MonStats +0x06`) is `258` (`tentacle1..3`) or `261` (`tentaclehead1..3`), `UNITS_IsInMeleeRange` checks **`dist < weaponRangeAdder + 8`** and **returns `1` directly without calling `UNITS_TestCollision`**! This allows melee characters standing on the shoreline to strike surfaced `TE`/`TN` units across the water-edge wall mask.
  2. At `0x6FD82750`: For all other targets, `UNITS_IsInMeleeRange` tests `0x0804` (`COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR`), not walk collision (`0x1C09`), so low water / grates / puddles never block melee reach.

---

## 4. Mandatory 734-Monster & `STATIONARY_AI_SET` Class-of-Bug Audit

Audited all `734` rows (`hcIdx 0..733`) of `MonStats.txt`, all `37` rows (`0..36`) of `MonPlace.txt`, and every AI in `STATIONARY_AI_SET`:

| Monster Class / Group | `hcIdx` | AI / Skills | Audit Status & Action |
|---|---|---|---|
| **Water Watcher / River Stalker / Stygian Watcher Head (`TE`)** | `261..263` | `TentacleHead` (`#34`), `#176 Submerge`, `#180 Emerge`, `MissA1=tentaclegoo` | **Fixed (#1770)**: Added `MonPlace` `10`/`11` water pool spawning, `4..6` `TN` limb spawning, submerged untargetable/invulnerable state machine, `#180`/`#176` `S1`/`SQ` animations, client sequence freeze across all 3 cast-expiry paths, `Overlay #157` death blood ripple, and `UNITS_IsInMeleeRange` `weaponRangeAdder + 8` shore melee rule. |
| **Water Watcher / River Stalker / Stygian Watcher Limb (`TN`)** | `258..260` | `Tentacle` (`#33`), `#176 Submerge`, `#180 Emerge`, `MeleeRng=6` | **Fixed (#1770)**: Full submerged/surfaced state machine, `MeleeRng=6` shore reach, boss-linked `40%` cascading death, client sequence freeze, and `Overlay #157` death blood ripple. |
| **Swamp Dweller / Bog Creature / Slime Prince (`FD`)** | `247..249` | `FrogDemon` (`#31`), `#176 Submerge`, `#180 Emerge`, `MissA2=frogfire/frogpois` | **Fixed in sweep**: Shared `#176 Submerge` (`mode 14`) / `#180 Emerge` (`mode 8`) untargetable/invulnerable server & client gating and client `mode 14` sequence-end freeze (`clearUnitCastState` & `expireCastStatesImpl` previously snapped `mode 14 -> mode 1`). |
| **Sand Maggot & Sand Maggot Queen (`SG` / `QW`)** | `68..72`, `679`, `716`, `284..288` | `SandMaggot` (`#18`), `#161 MagottUp`, `#162 MagottDown`, `#163 MagottLay` | **Fixed in sweep**: Client `npc-motion.ts`, `clearUnitCastState`, `expireCastStatesImpl`, and `world-renderer.ts` (`lastSkillId` fallback) now keep `#162 MagottDown` (`mode 14`) frozen underground on `s1` frame `0` instead of snapping back to surfaced `NU` (`mode 1`), and mark burrowed `#162` untargetable on client picking. |
| **DRLG `MonPlace.txt` Preset Spawns (`presetIndex >= 800`)** | `MonPlace 0..36` | `0x6FC67E6D` (`navi`, `bloodraven`, `sandmaggotqueen1`, `tentaclehead1..3`, `fetishshaman1`, `minion1`, `siegebeast1`, `barricadedoor`, `evilhut`, etc.) | **Fixed in sweep**: Implemented `resolveMonPlaceHcIdx113c` in `area-bootstrap.ts` and mirrored asset preloading in `map-worker.ts` (`currentMonsterHcIndices`). |
| **Other `STATIONARY_AI_SET` Turrets / Nests / Traps / Sarcophagi** | `160..165` (`FoulCrowNest`), `206..209` (`MummySarcophagus`), `273` (`GargoyleTrap`), `326..330` (`Trap-*`), `371` (`LightningSpire`), `372` (`FireTower`), `497..500` (`Catapult`), `524..527` (`Barricade`), `528` (`EvilHut`) | Always-visible destructible nests/towers/barricades or `killable=0` floor/wall traps (`noSel` already enforced via `MonStats.killable=0` / `isAtt=0`) | **Verified clean**: None use `Submerge`/`Burrow`; nests, towers, barricades, and sarcophagi are surfaced targetable structures by 1.13c design, and non-killable traps (`326..330`, `273`) already carry `killable=0` (`noSel=true`). |
| **Flying Scimitar / Trapped Soul / Awakened Statues** | `198` (`FlyingScimitar`), `293..294` (`TrappedSoul`), `543..545` (`AncientBarb 1..3`) | Object-spawned (`Scimitar` shrine, interactive `TrappedSoul`, Altar of the Heavens `#546`) | **Verified clean**: Already handled via object interaction / altar activation paths rather than `Submerge` skill modes. |

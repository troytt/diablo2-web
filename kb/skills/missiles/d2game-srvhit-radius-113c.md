# D2Game 1.13c Missile `pSrvHitFunc` Explosion / Splash / Bounce Radius Ground Truth

## Binary & Table Evidence

- **Binary**: `samples/d2/D2Game.dll` (Diablo II: Lord of Destruction v1.13c, ImageBase `0x6FC20000`)
- **Dispatch Table**: `gpMissileSrvHitFnTable` at `0x6FD2DA48` (59 entries, `0..58`, indexed by `MissilesTxt.pSrvHitFunc` at `+0x19C`)
- **Data Tables**: `samples/d2/excel/Missiles.txt` and `samples/d2/excel/Skills.txt`

### Key Struct Offsets

| Struct | Offset | Field | Description |
| :--- | :--- | :--- | :--- |
| `MissilesTxt` | `+0x1E` | `wSkill` | Associated skill ID (`> 0` when missile reads from `Skills.txt`) |
| `MissilesTxt` | `+0x20` | `dwResultFlags` | Result flags (`0x01` splash damage, `0x20` freeze instead of chill, etc.) |
| `MissilesTxt` | `+0x22` | `wHitFlags` | Hit flags (`0x02` allow friendly fire) |
| `MissilesTxt` | `+0x24..+0x2A` | `wHitSubMissile[0..3]` | `HitSubMissile1..4` spawned on impact |
| `MissilesTxt` | `+0x4C` | `dwHitPar[0]` | `sHitPar1` |
| `MissilesTxt` | `+0x50` | `dwHitPar[1]` | `sHitPar2` |
| `MissilesTxt` | `+0x54` | `dwHitPar[2]` | `sHitPar3` |
| `MissilesTxt` | `+0x58` | `dwHitCalc1` | `dHitPar1` (compiled missile calc expression) |
| `MissilesTxt` | `+0x19C` | `wSrvHitFunc` | `pSrvHitFunc` index into `gpMissileSrvHitFnTable` |
| `SkillsTxt` | `+0x60` | `dwAuraLenCalc` | `auralencalc` formula |
| `SkillsTxt` | `+0x64` | `dwAuraRangeCalc` | `aurarangecalc` formula |
| `SkillsTxt` | `+0x138` | `dwCalc1` | `calc1` formula |
| `SkillsTxt` | `+0x13C` | `dwCalc2` | `calc2` formula |
| `SkillsTxt` | `+0x140` | `dwCalc3` | `calc3` formula |
| `SkillsTxt` | `+0x144` | `dwCalc4` | `calc4` formula |

---

## Coordinate Space & Radial Search Helpers

All server-side radial searches and target queries operate in **sub-tile ground coordinates** (`pPath` sub-tile `(x, y)`), never in foreshortened 2:1 isometric screen pixels:

1. **Radial AoE Callback Helper — `sub_6FCC0C70` (`0x6FCC0C70`)**:
   - Takes `(pGame, pOwner, pOriginUnit, x, y, radiusSubtiles, hitFlags, pfnCallback, arg)`.
   - Computes `radiusSq = radiusSubtiles * radiusSubtiles` (`0x6FCC0CA3: imul ebp, ebx`).
   - Iterates active rooms overlapping `[x - radius, x + radius] × [y - radius, y + radius]` and filters candidate units via `D2Common.#10398` (`0x6FC2AE26`, squared Euclidean distance in sub-tile space `dx^2 + dy^2 <= radiusSq`).
2. **Radial Damage Helper — `sub_6FC5D450` (`0x6FC5D450`)**:
   - Wraps `sub_6FCC0C70` with callback `0x6FC5CC90` to apply `D2DamageStrc` to every valid unit within `radiusSubtiles`.
3. **Closest Target / Bounce Search Helper — `sub_6FCC0F40` (`0x6FCC0F40`)**:
   - Searches within `radiusSubtiles` in sub-tile ground space for valid enemy targets using `sub_6FCC0C70`.

In the web engine (`MISSILE_SUBTILE_FLAT_PX = 20` px/sub-tile, `ISO_GROUND_ASPECT_RATIO = 0.5`), ground-plane Y coordinates are foreshortened by `0.5`. Therefore, converting `(dx, dy)` in world/screen coordinates back to isotropic ground distance requires:

$$\text{distFlatPx} = \sqrt{\Delta x^2 + \left(\frac{\Delta y}{\text{ISO\_GROUND\_ASPECT\_RATIO}}\right)^2}$$

and comparing $\text{distFlatPx} \le \text{radiusSubtiles} \times 20$.

---

## `pSrvHitFunc` Disassembly Summary (`0x6FD2DA48`)

### 1. `SrvHit01` — `0x6FC5B990` (Fireball / Radial Splash Damage)
- **Missiles**: `fireball` (#62, `sHitPar1=4`), `vampirefireball` (#129, `sHitPar1=3`), `desertfireball` (#283, `sHitPar1=2`), `impfireball` (#404, `sHitPar1=5`), `sucfireball` (#441, `sHitPar1=3`), `explodingarrowexp2` (#656, `sHitPar1=5`), `freezingarrowexp3` (#657, `sHitPar1=5`).
- **Disassembly (`0x6FC5B9D6..0x6FC5BA2E`)**:
  - Reads `sHitPar1` (`[esi+0x4C]`).
  - If `sHitPar1 <= 0`, looks up `SkillsTxt` for `m.skillId` and evaluates `calc1` (`[esi+0x138]`) via `sub_6FC573A0`, clamping to `max(1, val)`.
  - Calls `sub_6FC5D450` to deal radial damage within `radiusSubtiles` sub-tiles.
  - **Correction**: the 1.13c body calls the scanner `0x6FCC0C70` directly (`0x6FC5BB44`, filter `0x8583`,
    callback `0x6FCC1210`) with one packet rolled on the missile seed, the struck unit included. Full port:
    [`d2game-srvhit01-fireball-113c.md`](./d2game-srvhit01-fireball-113c.md).

### 2. `SrvHit02` — `0x6FC5E330` (Plague Javelin / Poison Gas Cloud Ring)
- **Missiles**: `plaguejavelin` (#43, `sHitPar1=1, sHitPar2=2, sHitPar3=3`), `rancidgasepotion` (#47), `chokinggaspoition` (#48), `stranglinggaspotion` (#49), `catapult plague ball` (#419), `plaguejavelin2` (#436).
- **Disassembly (`0x6FC5E330` -> `sub_6FC5D680` at `0x6FC5D680`)**:
  - Spawns `HitSubMissile1` (`poisonjavcloud` #53) along the 64-direction ring table (`0x6FD1CB60`/`0x6FD1CBA0`) with outer ring step `max(1, sHitPar2) * 4` (`vel = Param1 << 7`), inner ring step `sHitPar1 * 4` (`vel = Param2 << 7`), and `loops = sHitPar3`.

### 3. `SrvHit03` (`0x6FC5BB60`) & `SrvHit44` (`0x6FC5B5F0`) (Potion / Javelin Radial Splash)
- **Missiles**:
  - `SrvHit03`: `oilpotion` (#44, `sHitPar1=2`), `explosivepotion` (#45, `sHitPar1=3`), `fulminatingpotion` (#46, `sHitPar1=6`), `bomb on ground` (#386, `sHitPar1=0`).
  - `SrvHit44`: `explodingjavalin` (#429, `sHitPar1=2`), `icejavalin` (#434, `sHitPar1=1`).
- **Disassembly (`0x6FC5BC18..0x6FC5BC74` / `0x6FC5B6A8..0x6FC5B6DC`)**:
  - Reads `sHitPar1` (`[esi+0x4C]`).
  - If `sHitPar1 <= 0`, evaluates `SkillsTxt.aurarangecalc` (`[esi+0x64]`), clamping to `max(1, val)`.
  - Calls `sub_6FC5D450` to deal radial splash damage within `radiusSubtiles` sub-tiles (plus `HitSubMissile1` spawning for `SrvHit03`).

### 4. `SrvHit04` (`0x6FC5F220`) & `SrvHit09` (`0x6FC5E0B0`) (Exploding / Freezing / Immolation Arrow)
- **Missiles**:
  - `SrvHit04`: `explodingarrow` (#41, `sHitPar1=0`, `HitSubMissile1 = explodingarrowexp2` #656 with `pSrvHitFunc=1, sHitPar1=5`), `freezingarrow` (#87, `sHitPar1=0`, `HitSubMissile1 = freezingarrowexp3` #657 with `pSrvHitFunc=1, sHitPar1=5`, `Skills.txt` `Freezing Arrow` `calc1 = par1 = 5`), `royalstrikemeteorcenter` (#564, `sHitPar1=1`, `HitSubMissile1 = royalstrikemeteor` #563 with `pSrvHitFunc=14, sHitPar1=6`).
  - `SrvHit09`: `immolationarrow` (#85, `sHitPar1=0, sHitPar2=0`, `Skills.txt` `Immolation Arrow` `calc1 = par1 = 3` fire patch grid radius, `calc2 = par2 = 4` radial explosion damage radius).
- **Disassembly**:
  - `SrvHit04` (`0x6FC5F220`): Spawns `HitSubMissile1` (`[eax+0x24]`) at the impact coordinates via `sub_6FC5C620`, which immediately executes its own `pSrvHitFunc` (`SrvHit01` or `SrvHit14`).
  - `SrvHit09` (`0x6FC5E0B0`):
    - Reads fire patch radius `r1 = sHitPar1 > 0 ? sHitPar1 : evalSkillCalc(skill.calc1)` (`[edi+0x138]`, `par1 = 3`) and fire duration `len = sHitPar3 > 0 ? sHitPar3 : evalSkillCalc(skill.auraLenCalc)` (`[edi+0x60]`).
    - Reads explosion damage radius `r2 = sHitPar2 > 0 ? sHitPar2 : max(1, evalSkillCalc(skill.calc2))` (`[edi+0x13C]`, `par2 = 4`) and calls `sub_6FC5D450` to deal radial fire explosion damage within `r2` sub-tiles.

### 5. `SrvHit12` — `0x6FC5D020` (Chain Lightning / Lightning Strike Bounce)
- **Missiles**: `chainlightning` (#93, `sHitPar1=0`, `Skills.txt` #53 `aurarangecalc = par1 = 20`), `lightningstrike` (#232, `sHitPar1=0`, `Skills.txt` #34 `aurarangecalc = par1 = 20`), `chainlightning2` (#267, `sHitPar1=10`).
- **Disassembly (`0x6FC5D095..0x6FC5D0FC`)**:
  - Evaluates remaining bounce count via `MissilesTxt.dHitPar1` (`[esi+0x58]`, `(1 + par2)`).
  - Reads search radius `radiusSubtiles = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))` (`[eax+0x64]`).
  - Searches for the nearest valid target within `radiusSubtiles` sub-tiles via `sub_6FCC0F40`.

### 6. `SrvHit13` — `0x6FC5B3E0` (Glacial Spike / Hell Meteor Radial Splash & Freeze)
- **Missiles**: `glacialspike` (#96, `sHitPar1=0`, `Skills.txt` #55 `aurarangecalc = ln12 = 4`), `monglacialspike` (#271, `sHitPar1=0`), `hellmeteordown` (#336, `sHitPar1=5`).
- **Disassembly (`0x6FC5B432..0x6FC5B4DE`)**:
  - Reads `sHitPar1` (`[ebx+0x4C]`).
  - If `sHitPar1 <= 0`, evaluates `SkillsTxt.aurarangecalc` (`[esi+0x64]`), clamping to `max(1, val)`.
  - Calls `sub_6FC5D450` to apply splash damage (and freeze when `ResultFlags & 0x20`) within `radiusSubtiles` sub-tiles.

### 7. `SrvHit14` — `0x6FC5DEF0` (Meteor Center Impact Blast + Ground Fire)
- **Missiles**: `meteorcenter` (#101, `sHitPar1=0, sHitPar2=4`, `Skills.txt` #56 `aurarangecalc = ln12 = 6`), `vampiremeteorcenter` (#133, `sHitPar1=0, sHitPar2=4`), `catapult meteor ball` (#422, `sHitPar1=1, sHitPar2=6`), `royalstrikemeteor` (#563, `sHitPar1=6, sHitPar2=6`).
- **Disassembly (`0x6FC5DF0A..0x6FC5DFB9`)**:
  - Blast damage radius: `r1 = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))` (`[edi+0x64]`). Calls `sub_6FC5D450` if `r1 > 0`.
  - Ground fire grid radius: `r2 = sHitPar2 > 0 ? sHitPar2 : evalSkillCalc(skill.calc2)` (`[edi+0x13C]`), spawning `HitSubMissile1` via `sub_6FC5CEC0`.

### 8. `SrvHit20` — `0x6FC5DD60` (Lightning Fury Release Bolts)
- **Missiles**: `lightningfury` (#206, `sHitPar1=0, sHitPar2=0`, `Skills.txt` #35 `aurarangecalc = par3 = 15`, `calc1 = ln12 = 1 + slvl`).
- **Disassembly (`0x6FC5DD7F..0x6FC5DE4A`)**:
  - Search radius: `r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))` (`[edi+0x64]`, `15` sub-tiles).
  - Max bolt count: `maxBolts = sHitPar2 > 0 ? sHitPar2 : max(1, evalSkillCalc(skill.calc1))` (`[edi+0x138]`, `1 + slvl`).
  - Queries targets within `r` sub-tiles via `sub_6FCC0C70` (callback `0x6FC5DCD0`) and spawns `HitSubMissile1` (`lightningfurybolt` #207) toward up to `maxBolts` targets.

### 9. `SrvHit22` — `0x6FC5DB30` (Fist of the Heavens Delay Bolt Spawner)
- **Missiles**: `fistoftheheavensdelay` (#233, `sHitPar1=0`, `Skills.txt` #121 `aurarangecalc = 20`).
- **Disassembly (`0x6FC5DB62..0x6FC5DC20`)**:
  - Search radius: `r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))` (`[esi+0x64]`, `20` sub-tiles).
  - Queries enemies within `r` sub-tiles via `sub_6FCC0C70` (callback `0x6FC5DC30`) and spawns `HitSubMissile1` (`fistoftheheavensbolt` #234) toward each target except the primary hit unit.

### 10. `SrvHit47` — `0x6FC5D8C0` (Molten Boulder Explosion)
- **Missiles**: `moltenboulder` (#452, `sHitPar1=0, sHitPar2=1`, `Skills.txt` #229 `aurarangecalc = par1 = 7`).
- **Disassembly (`0x6FC5D91F..0x6FC5D97D`)**:
  - Explosion damage radius: `r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))` (`[edi+0x64]`, `7` sub-tiles).
  - Calls `sub_6FC5D450` to deal physical + fire explosion damage within `r` sub-tiles, then spawns `HitSubMissile1..3` in a grid of radius `sHitPar2` (`1`).

### 11. `SrvHit48` (`0x6FC5E220`, Volcano) & `SrvHit51` (`0x6FC5DE50`, Armageddon)
- **Missiles**:
  - `SrvHit48`: `volcano` (#459, `sHitPar1=1`), `firestormmaker` (#425, `sHitPar1=4`), `mephistoazerath` (#668, `sHitPar1=4`).
  - `SrvHit51`: `armageddon` (#475, `sHitPar1=0`, `Skills.txt` #244 `aurarangecalc = 5`).
- **Disassembly**:
  - Both read `r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))` (`[edi+0x64]`) and call `sub_6FC5D450` to deal radial impact damage within `r` sub-tiles.

### 12. `SrvHit24` (`0x6FC5B7C0`, Panther Orange Pot) & `SrvHit25` (`0x6FC5DA60`, Panther Green Pot) + Lobbed Throwing Potions (`0x6FCC1880`)
- **`SrvHit24` (`0x6FC5B7C0`)**:
  - **Missiles**: `pantherpotorange` (#238, `sHitPar1 = 0`, `Skill = ''`, `AlwaysExplode = 1`).
  - **Disassembly**: Reads `r = sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.calc1))` (falls back to `1` sub-tile when `sHitPar1 == 0` and `Skill == ''`) and calls `sub_6FC5D450` radial splash damage.
- **`SrvHit25` (`0x6FC5DA60` -> `sub_6FC5CB00` at `0x6FC5CB00`)**:
  - **Missiles**: `pantherpotgreen` (#239, `sHitPar1 = 1`, `HitSubMissile1 = rancidgascloud` #222, `AlwaysExplode = 1`).
  - **Disassembly**: Iterates `i = 0..7` (`step = max(1, sHitPar1)`) along the 8-direction ring offset tables at `0x6FD27320` (`X: -2, 0, 2, 2, 2, 0, -2, -2`) and `0x6FD27340` (`Y: 2, 2, 2, 0, -2, -2, -2, 0`), spawning `HitSubMissile1` (`rancidgascloud` #222, `CollideKill = 0`, `HitShift = 0`, `EMin = 123`, `ELen = 50` = `24` poison HP over 2s) with `velOverride = subRow.Param1 << 7` (`speed = Param1 / 32` sub-tiles/frame).
- **Player Lobbed Throwing Potions (`SKILLS_SrvDo003_Throw` `0x6FCC2BDC` -> `SKILLS_SpawnLobbedMissile` `0x6FCC1880`)**:
  - When throwing `Weapons.txt` `type = tpot` potions (`opl`/`opm`/`ops` -> `#44..#46` `SrvHit03`, `gpl`/`gpm`/`gps` -> `#47..#49` `SrvHit02`, all `CollideType = 6`, `AlwaysExplode = 1`, `SrcDamage = 0`), `SKILLS_SpawnLobbedMissile` sets `params.flags = 0x420` so the lobbed bottle arcs directly to `(tx, ty)`, expires at the target ground point (`pTarget == NULL`), and executes `SrvHit03` (fire + physical radial splash) or `SrvHit02` (`gasring16` spawning `HitSubMissile1` poison clouds).


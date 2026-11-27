# D2Client.dll v1.13c Meteor Client Trajectory & Impact Mechanics (`CltDoFunc=9`, `CltHitFunc=18`, `CltDoFunc=5`)

## 1. Dispatch Tables (`D2Client.dll`, ImageBase `0x6FAB0000`)

- `g_apfnCltDoFunc`: VA `0x6FB8D8A0`
  - `g_apfnCltDoFunc[1]` = `0x6FB617C0` (`MISSMODE_CltDo01_Standard`)
  - `g_apfnCltDoFunc[5]` = `0x6FB62F90` (`MISSMODE_CltDo05_GroundFire`)
  - `g_apfnCltDoFunc[9]` = `0x6FB68F00` (`MISSMODE_CltDo09_MeteorCenter`)
- `g_apfnCltHitFunc`: VA `0x6FB8DA10`
  - `g_apfnCltHitFunc[18]` = `0x6FB66540` (`MISSMODE_CltHit18_MeteorCenter`)

## 2. `Missiles.txt` Suite for Meteor (Skill #56)

| ID | Missile | `CltDoFunc` | `CltHitFunc` | `Range` | `LevRange` | `CelFile` | `AnimLen` | `LoopAnim` | `SubLoop` | `SubStart` | `SubStop` | `Trans` | `Light` (`R,G,B`) |
|---:|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---|
| 100 | `meteor` | 1 | 0 | 60 | 0 | `Meteor` | 12 | 1 | 0 | 0 | 0 | 0 (baked as `trans: 1`) | `0` |
| 101 | `meteorcenter` | 9 | 18 | 60 | 0 | `MeteorTargetIndicator` | 17 | 1 | 0 | 0 | 0 | 1 | `4` (`255,64,64`) |
| 102 | `meteortail` | 1 | 0 | 60 | 0 | `MeteorTail` | 12 | 1 | 0 | 0 | 0 | 1 | `0` |
| 103 | `meteorexplode` | 1 | 0 | 16 | 0 | `ExpArrowExplode` | 16 | 0 | 0 | 0 | 0 | 1 | `13` (`255,178,64`) |
| 104 | `firesmall` | 5 | 0 | 90 | 25 | `groundFireSmall` | 37 | 1 | 1 | 12 | 36 | 1 | `2` (`255,178,64`) |
| 105 | `firemedium` | 5 | 0 | 90 | 25 | `groundFireMedium` | 37 | 1 | 1 | 12 | 36 | 1 | `3` (`255,178,64`) |
| 154 | `whitelightmissile` | 1 | 0 | 10 | 10 | `null` | 2 | 0 | 0 | 0 | 0 | 0 | `5` (set to `12`, `255,255,255`) |
| 240 | `meteorfire` | 5 | 0 | 90 | 0 | `groundFireMedium` | 37 | 1 | 1 | 12 | 36 | 1 | `3` (`255,178,64`) |

### `meteorcenter` Client Parameters (`Missiles.txt` row 101)
- `CltParam1 = 59` (`frames` of sky descent)
- `CltParam2 = 25` (`fallrate` in vertical pixels per frame)
- `CltParam3 = 15` (`sliderate` in 1/32 sub-tile X units per frame)
- `ClientSubMissile1 = meteor` (ID 100)
- `ClientSubMissile2 = meteortail` (ID 102)
- `cHitPar1 = 5` (number of `meteorexplode` spawned on impact)
- `cHitPar2 = 3` (number of `firemedium` spawned on impact)
- `cHitPar3 = 15` (number of `firesmall` spawned on impact)
- `CltHitSubMissile1 = meteorexplode` (ID 103)
- `CltHitSubMissile2 = whitelightmissile` (ID 154)
- `CltHitSubMissile3 = firemedium` (ID 105)
- `CltHitSubMissile4 = firesmall` (ID 104)

## 3. `MISSMODE_CltDo09_MeteorCenter` (`0x6FB68F00`) & 3D Trajectory (`0x6FB77E30` / `0x6FB77FB0`)

1. **Dynamic Ground Light Growth (`0x6FB69000..0x6FB6905B`)**:
   - Reads `meteorcenter` base light radius (`4`) and increments its light radius over the 60-tick countdown up to `Light + 15` as the meteor approaches the ground.
2. **Tick 0 Companion Spawning (`0x6FB69060..0x6FB69170`)**:
   - When `D2Common_10985(pUnit) == 0` (tick 0, immediately on creation), computes:
     - `zInit = CltParam2 * CltParam1 = 25 * 59 = 1475`
     - `xInit = -CltParam3 * CltParam1 = -15 * 59 = -885`
     - `vz = -CltParam2 = -25`
     - `vx = +CltParam3 = +15`
   - Spawns **1** `ClientSubMissile1` (`meteor`, ID 100) and **1** `ClientSubMissile2` (`meteortail`, ID 102) at the target sub-tile `(targetX, targetY)`, and calls `UNIT_Set3DTrajectory(pChild, vx=+15, vy=0, vz=-25, xOffset=-885, yOffset=0, zOffset=+1475)` (`0x6FB77E30`).
   - Both `meteor` and `meteortail` fly down together continuously from tick 0 to tick 59 (no mid-air pause, no stationary trail spawning).
3. **3D Trajectory Screen Projection (`UNIT_Step3DTrajectory` @ `0x6FB77FB0` + `D2Common_10132` @ `0x6FD9DB40`)**:
   - Each tick, `xOffset += 15`, `yOffset += 0`, `zOffset -= 25`.
   - `D2Common_10132` (`0x6FD9DB40`) converts `(xOffset, yOffset)` in 1/32 sub-tile units to isometric screen offsets:
     $$\Delta X_{\text{screen}} = \frac{x_{\text{offset}} - y_{\text{offset}}}{2} = \frac{-15 \cdot \text{rem}}{2}, \qquad \Delta Y_{\text{screen}} = \frac{x_{\text{offset}} + y_{\text{offset}}}{4} - z_{\text{offset}} = \frac{-15 \cdot \text{rem}}{4} - 25 \cdot \text{rem}$$
   - In sub-tile coordinates where $\text{worldX} = (\text{subX} - \text{subY}) \times 16$ and $\text{worldY} = (\text{subX} + \text{subY}) \times 8$, setting $\text{subX} = \text{targetX} - \frac{15 \cdot \text{rem}}{32}$, $\text{subY} = \text{targetY}$, and $\text{altitude} = 25 \cdot \text{rem}$ reproduces both $\Delta X_{\text{screen}}$ and $\Delta Y_{\text{screen}}$ exactly.
4. **Pre-Impact Camera Shake (`0x6FB69177..0x6FB6918B`)**:
   - At `elapsed == CltParam1 - 2` (`tick 57`), triggers camera screen shake (`0x6FB38C20`).

## 4. `MISSMODE_CltHit18_MeteorCenter` (`0x6FB66540`)

On `meteorcenter` expiry (tick 60):
1. **5 Cross `meteorexplode` (`0x6FB665F9..0x6FB666A5`)**:
   - Reads `cHitPar1 = 5` and iterates `i = 0..4` over the 5 cross sub-tile offsets at `0x6FB83BF8` (X) and `0x6FB83C0C` (Y):
     `[(0, 0), (0, 4), (4, 0), (0, -4), (-4, 0)]`
   - Spawns `CltHitSubMissile1` (`meteorexplode`, ID 103) at each offset.
2. **1 `whitelightmissile` (`0x6FB666AF..0x6FB66709`)**:
   - Spawns `CltHitSubMissile2` (`whitelightmissile`, ID 154) at `(targetX, targetY)` with `Range = 10 + slvl * 10` and overrides its light radius to `12` (`RGB(255, 255, 255)`).
3. **18 Ground Fire Patches (`0x6FB6670B..0x6FB667B4`)**:
   - Uses the 18 sub-tile offset tables at `0x6FB83C68` (X) and `0x6FB83C20` (Y) (identical to `D2Game.dll` `0x6FD1C918` / `0x6FD1C8D0`):
     - Indices `0..2` (`cHitPar2 = 3`: `(2, -2), (-2, -2), (0, 2)`): spawns `CltHitSubMissile3` (`firemedium`, ID 105).
     - Indices `3..17` (`cHitPar3 = 15`): spawns `CltHitSubMissile4` (`firesmall`, ID 104).

## 5. `MISSMODE_CltDo05_GroundFire` (`0x6FB62F90`)

For 37-frame ground fires (`SubLoop = 1, SubStart = 12, SubStop = 36`):
- **Emergence (`frames 0..11`)**: Plays frames `0` through `11` as the flame grows from a ground spark.
- **Desynchronized Steady Loop (`frames 12..36`)**: Upon reaching frame `11` (`SubStart - 1`), jumps to `11 + rand(0..23)` (`0x6FB62FDF..0x6FB63000`) so individual ground fire patches do not pulse in lockstep, then loops within `12..36`.
- **Fade-out (`ticksRemaining <= 12`)**: During the last `SubStart` (`12`) ticks before expiry (`0x6FB63042..0x6FB63056`), reverses through the emergence frames down to `0` so the fire shrinks smoothly back into embers.

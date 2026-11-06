# Diablo II v1.13c Client Weather: Rain, Snow, Splashes, Bubbles and Lightning

> **Ground truth**: 1.13c `D2Client.dll` (ImageBase `0x6fab0000`) and the DLLs it calls (`Fog.dll`, `D2gfx.dll`,
> `D2DDraw.dll`, `D2Win.dll`, `D2CMP.dll`, `D2Common.dll`), plus `Patch_D2.mpq` `Levels.txt` / `Skills.txt`. VAs
> are D2Client unless prefixed. Items that the assembly does not prove are marked **UNVERIFIED**.
>
> **Port**: [`weather-sim.ts`](../src/client/weather/weather-sim.ts) (simulation),
> [`fog-pool.ts`](../src/client/weather/fog-pool.ts), [`fog-sin-table.ts`](../src/client/weather/fog-sin-table.ts),
> [`weather-colors.ts`](../src/client/weather/weather-colors.ts),
> [`weather-raster.ts`](../src/client/weather/weather-raster.ts) (drawing rules),
> [`weather-controller.ts`](../src/client/weather/weather-controller.ts) (session / frame driver),
> [`weather-render-pass.ts`](../src/client/weather/weather-render-pass.ts) (scene pass),
> [`fps-counter-113c.ts`](../src/client/render/fps-counter-113c.ts) (FPS counter, the lightning gate),
> [`weather-assets.ts`](../src/client/weather/weather-assets.ts),
> [`pack-weather.ts`](../src/baker/packers/pack-weather.ts) →
> [`weather-manifest.ts`](../src/common/pack-contract/weather-manifest.ts) (`public/assets/weather/weather.json`),
> [`online-session.ts`](../src/client/session/online-session.ts) (`LoadAct` / `UnitReassign` hooks, the S2C `0xA3`
> lightning trigger and the thunder request).

Units used below:

- **tick**: one client game frame (40 ms, 25 Hz), counter `[0x6fbc97f8]`.
- **RNG(n)**: one step of the 1.13c seed (`lo·0x6AC690C5 + hi`), returning `lo % n` (unsigned).
  **SeedRange(range, base)** (0x6fab18d0) = `base + RNG(range)`, and does not step the seed when `range ≤ 0`.
- **trunc()**: MSVC `_ftol` (0x6fb7acc4), truncation toward zero.
- **W × H**: screen size (`[0x6fb8bc48]` × `[0x6fb8bc4c]`).

---

## 1. Lifecycle

| VA | Function | When |
|---|---|---|
| 0x6fb30320 | game init | from game init 0x6faf45f1. Creates the pools (particles 0x100 × 0x28 B, splashes 0x200 × 0x18, bubbles 0x80 × 0x18); snow angle base/range 42/170; lightning off; lastTick 0; target 0. It does **not** reset the state machine, wind, snow flags or intensity (BSS) |
| 0x6fb31750 | LoadWeather(level) | from 0x6fb714f0, only while the act load is pending (`[0x6fbcb9d0]`); 0x6fb714f0 runs from the render callback (0x6faf4237). The level is `[0x6fbcc3c0]`, written by the act load 0x6faf3f90 at 0x6faf4054 |
| 0x6fb31340 | update | from the render callback 0x6faf4230 (call 0x6faf4307), every render frame. It steps only when the game-frame counter moved (`cmp; jbe` 0x6fb31416). The counter is incremented at 0x6faf4b27 by the 25 Hz game frame 0x6faf4a80. At most one step per render frame, no catch-up |
| 0x6fb3b110 | world draw | floor pass 0x6fac4050 / 0x6fac3ce0 (splash and bubble spawns), splashes (0x6fb3b251) and bubbles (0x6fb3b26b) via DrawCels 0x6fb2fc70, units / walls, then the lines or the lightning flash via 0x6fb305a0 (call 0x6fb3b2c6) |
| 0x6fb301f0 | ForceLightning(0) | only from client skill fn #84 0x6fb24350 (call 0x6fb24445), Thunder Storm's `cltprgfunc1`, which the S2C `0xA3` handler 0x6fb5efb0 reaches through 0x6fb51b10 (§6) |
| 0x6fb305a0 | lightning driver and line drawing | from the world draw (call 0x6fb3b2c6), so every rendered frame that draws the world; skipped with both side panels open (0x6faf4361) (§6) |
| 0x6fb0a9a0 | FPS counter | from the render callback (call 0x6faf4392), every rendered frame; publishes `[0x6fbcc2ac]`, which the driver tests (§6) |
| 0x6fb31720 | reassign reset | sole caller 0x6fb58012 inside 0x6fb57e20 (§8) |
| 0x6faf4110 | game exit | destroys the pools and frees the cels |

**Update 0x6fb31340.** It reads Levels.txt `Rain` / `Mud` of the player's level (D2Common #10215 / #10499 on
#10826 of #10331). On a Rain→dry edge it clears particles and splashes; on a Mud→dry edge it clears bubbles. Then,
if the tick moved: in a Rain level it runs Move 0x6fb30f60 (when count > 0), the splash animation 0x6fb30160,
the state machine 0x6fb311f0 and SpawnAndWind 0x6fb30e30; otherwise it sets intensity to 0. In a Mud level it
runs the bubble animation 0x6fb300d0.

**Persistence quirks (ported).**

- In a fresh process (state 0, countdown 0) the first tick in a Rain level enters ramp-up at once.
- The cycle freezes in dry levels (no state machine calls) and carries over between games in the same process.
  The port keeps one `WeatherSim` per page: `OnlineSession` is created once and `onGameInit` only does what
  0x6fb30320 does.
- `target` survives leaving a Rain level, so the first tick back refills the pool to `target` in one tick.
- The first LoadWeather of the process runs `ResetWind` again after `SelectPrecip(1)` (flag `[0x6fbd3444]`,
  0x6fb3176c), so it draws one more set of wind rolls.

## 2. Activation (Levels.txt `Rain` / `Mud`)

| Levels | Act | Rain | Mud | Weather |
|---|---|---|---|---|
| 1–7, 17, 38, 39 | I | 1 | 0 | rain |
| 75–83 | III | 1 | 1 | rain and bubbles |
| 109–112 | V | 1 | 0 | small snow; 25% rain on later ramp-ups |
| 117 | V | 1 | 0 | big snow |
| 120, 121 | V | 1 | 0 | forced blizzard (256 flakes, angle 28) |
| 136 | V | 1 | 0 | snow, default case (keeps the previous flake size) |

Every other level id in 1..136 has `Rain = 0` and `Mud = 0`. In Act V, `Rain = 1` means precipitation and
SelectPrecip turns it into snow. The table is checked against `Patch_D2.mpq` for all 136 ids by
[`weather-136-spectrum.test.ts`](../tests/weather-136-spectrum.test.ts).

## 3. Precipitation state machine

**SelectPrecip 0x6fb314f0(arg)**; arg = 1 on act load and on a reassign, 0 on each ramp-up.

- Outside Act V: rain. `forced = 0`; clear particles when snow was on; `snow = 0`; ResetWind.
- Act V: ResetWind first, then the case table `byte_6fb3167c` for levels 109..121 =
  `{0,0,0,0,3,3,3,3,1,3,3,2,2}` (other levels take case 3):
  - case 0 (109–112): small flakes, threshold 25;
  - case 1 (117): big flakes;
  - case 2 (120, 121): big flakes, forced;
  - case 3: flake size unchanged.

  `RNG(100)` is always drawn. If `r < threshold && arg == 0` the level rains instead. Otherwise SetForced
  (0x6fb312f0) and SetSnow(1, arg) (0x6fb31470). An act load therefore always starts Act V with snow, and arg = 1
  always clears the particles.

**State machine 0x6fb311f0** (states 0 clear, 1 ramp-up, 2 full, 3 ramp-down). When the countdown reaches 0, the
next state's duration is `SeedRange(range[s], base[s])` and EnterState 0x6fb31120 runs. Ramp-up sets
`target = (total − countdown)·max / total`, ramp-down sets `target = max·countdown / total`, and intensity is
`target / 256` (f32 `0x6fb875b0`).

| State | Duration (ticks) | Entry |
|---|---|---|
| 0 clear | 7500 + RNG(7500) | `target = 0` |
| 1 ramp-up | 250 + RNG(250) | SelectPrecip(0); `max = 32 + RNG(224)` |
| 2 full | 3000 + RNG(3000); ×3 base (9000) when LoadWeather's act is III or V | FullState 0x6fb30ca0 |
| 3 ramp-down | 125 + RNG(50) | lightning off |

**FullState 0x6fb30ca0** uses the same Act V case table: 109–112 re-roll `max = target = 32 + RNG(56)` (snow
angle 42 + RNG(170)); 117 re-rolls `32 + RNG(112)` (angle 170 + RNG(56)); 120/121 set 256 and angle 28. The default
case sets `target = max`, and in rain draws one discarded RNG step. It stores the constant 0 into the lightning
flag (0x6fb30df0), so **natural lightning never happens**.

**Forced levels (120/121).** EnterState refuses every state but 2. When the countdown expires the local state is 3
for that one tick, so the ramp-down formula runs once and `target` ends a little below 256.

**Wind.** ResetWind 0x6fb30be0: angle and angle target `92 + RNG(71)`, angle countdown `125 + RNG(375)`,
lightning countdown `500 + RNG(1500)`. SpawnAndWind 0x6fb30e30 tops the pool up to `target`, turns the angle by
2 units per tick in rain (1 in snow) toward its target, and re-rolls the target when the countdown ends (rain
`92 + RNG(71)` every `125 + RNG(375)` ticks; snow `SeedRange(range, base)` every `250 + RNG(875)` ticks). Angles
use 512 units per turn; 128 falls straight down.

## 4. Particles

**Pools.** Fog #10064 allocates the lowest free slot and Fog #10065 frees one; every loop runs over slots
`0..maxIndex` in index order. This decides slot reuse and draw order, so [`FogPool`](../src/client/weather/fog-pool.ts)
copies it.

**Trigonometry.** Fog #10084 `sin(a) = T[a & 511]`, Fog #10083 `cos(a) = T[(a + 128) & 511]`. `T` is the static
512-entry f32 table at Fog.dll file offset 0x2f470. It is **not** `fround(sin(2πi/512))` (328 entries differ by
one ulp; `T[256] = −8.742278e−08`), so the port embeds the 2048 bytes
([`gen-fog-sin-table.ts`](../src/baker/extract/gen-fog-sin-table.ts)).

**Spawn 0x6fb30700** (RNG draws in this order): `x = RNG(W)`, `yEnd = 40 + RNG(H − 87)`,
`y = −20 + RNG(yEnd + 20)`, `phase = step & 511`, `depth = (yEnd − 40)/(H − 87)` (f32).

- Snow: one discarded `RNG(100)`; `landTicks = 1`; `speed = 8 − trunc(depth·−28)`;
  `size = (yEnd − 40)·7/(H − 87)` (+1 for big flakes); colour from SnowColor 0x6fb304c0.
- Rain: `ci = RNG(12)`; colour by period of day (D2Common #11044): DAY `RainDay[ci]`, DUSK/DAWN
  `RainDuskDawn[ci]`, NIGHT `RainNight[ci]`; `len = 4 − trunc(depth·−8)`; `speed = 15 − trunc(depth·−15)`;
  `landTicks = 3`.

**Move 0x6fb30f60.** Speed factor: rain `0.85 + intensity·0.15` (f32 `0x3f59999a`, `0x3e19999a`); snow
`max(|cos(angle)|, 0.25)`. Per particle: `sp = trunc(speed·factor)`, `dx = trunc(cos·sp)`, `dy = trunc(sin·sp)`;
`y += dy − camDy`; `y > yEnd` lands it. A landed particle stops (`dx = 0`, `speed = 0`) for `landTicks` ticks,
then is freed and respawned at once when `count < target` (usually into the same slot, which then still gets this
tick's horizontal step). Snow sway adds `trunc(2·sin(((moveFrame << 9)/25 + phase) & 511))`. Then
`x = x − camDx + dx`, wrapped once into `[0, W)`. `yEnd` is not camera-adjusted.

**Colour ramps (LoadWeather).** For i = 0..11 with `k1 = trunc(80i/12)`, `k2 = trunc(40i/12)`, `k3 = 2i`, the
nearest palette index (D2Win #10190 → D2CMP #10049: smallest sum of squared differences, first minimum wins,
index 0 included) of RainDay `(98−k1, 123−k1, 98−k1)`, RainDuskDawn `(45−k2, 55−k2, 45−k2)`, RainNight
`(25−k3, 30−k3, 25−k3)` and SnowGray `120+k1`. The port runs this over the act palette
([`palette-nearest.ts`](../src/common/formats/palette-nearest.ts)).

**SnowColor 0x6fb304c0** for GDI / DirectDraw / Direct3D: `idx = size·12/8`; DAY `SnowGray[idx]`, NIGHT
`SnowGray[idx/4]`, DUSK/DAWN `SnowGray[idx/2]`. The bright Glide ramp (`170+k1`) is not used. The alpha bytes
(snow `byte_6fb84a19`; rain 0x7F by day, 0xFF otherwise) are stored but ignored by DirectDraw's DrawLine.

## 5. Splashes and bubbles

**Floor context 0x6fac4050** (every render frame, before the floor tiles): `splashChance = trunc(intensity·1000)`;
splashes are enabled when `tick > lastSplashTick + 3` and the chance is non-zero; bubbles when the player's level
has `Mud` and `tick > lastBubbleTick + 25`. The two stamps live in the floor context at 0x6fbd33b0 (BSS); the port
keeps them for the page's lifetime, like the state machine.

**Per floor tile 0x6fac3ce0.** A drawn orientation-0 tile inside the clip, not skipped by its flags `0x408`, whose
DT1 header byte +0x06 has bit 0x02 (test at 0x6fac3e86) draws `r = RNG(1000)`, **even when nothing is enabled**.
`r < splashChance` spawns a splash and `r < 100` a bubble. There is no Rain check here: snow levels splash too,
and dry levels have intensity 0.

- SpawnSplash 0x6fb30a70 (screen mode): row `r = RNG(80)`, half-width `w = 80 − 2|r − 40|`,
  `x = sx + SeedRange(2w, −w)`, `y = sy + r`; type `2 + (step & 1)` (Rain3 / Rain4).
- SpawnBubble 0x6fb30940: the same point with `y − 30`; type 2 (bubble3).
- Animation 0x6fb30160 / 0x6fb300d0: screen-space records scroll by `−camDx/−camDy`; 2 ticks per frame; freed
  after the last frame (splash 10 frames = 20 ticks, bubble 12 frames = 24 ticks).

Rain1/Rain2 and bubble1/2/4 are loaded by LoadWeather but never drawn.

## 6. Drawing

**View rect** (DrawParticles 0x6fb2fe80, DrawCels 0x6fb2fc70): `y ∈ [0, H − 47)`. `[0x6fbcc414]` = 1 (only the
right panel open) gives `x < W − 2·(W/4)`; 2 (only the left panel open) gives `x ≥ 2·(W/4)`.

**DrawLine** (D2gfx #10010 0x6fa8b9c0 → D2DDraw 0x6f8c65c0) is a **biased** Bresenham, which corrects the RE
spec's "both endpoints included":

- it plots the start pixel (0x6f8c6629) and starts with error 0 (0x6f8c6630);
- the major axis is y when `|dx| < |dy|`, otherwise x (ties are x-major, 0x6f8c6632);
- each major step adds the minor delta to the error, and the minor axis steps only when the error is **strictly
  greater** than the major delta (`cmp; jle` at 0x6f8c666b / 0x6f8c66d6);
- so the minor axis can end one step short: (0,0)→(2,2) plots (0,0), (1,0), (2,1);
- every pixel is clipped to the surface (`[0x6f8d01c8]` × `[0x6f8d01d8]`) and written opaquely; the alpha
  argument is ignored.

**DrawParticles 0x6fb2fe80.**

- Snow: an in-view anchor with size 0..7 draws two segments, rows `size` and `size + 1` of `SEG` (0x6fb84988).
- Landed rain: one pixel when in view.
- Falling rain: `dx = trunc(cos·len)`, `dy = trunc(sin·len)`, cut at `yEnd` with a signed integer division,
  drawn when the start **or** the end is in view.

The lines are raw palette writes, so they are never lit; only the period-of-day ramps change them. They are drawn
after units, walls and roofs.

**DrawCels 0x6fb2fc70.** Each in-view record draws its DC6 frame through D2gfx #10041 with colour −1 and draw mode
3, pl2 AdditiveBlend. Out-of-view screen-space records are skipped, not freed. Splashes and bubbles are drawn right
after the floor, before anything that stands on it.

**Lightning flash and thunder (#829).** [`WeatherLightning113c`](../src/client/weather/weather-sim.ts) holds
`enabled` `[0x6fbcbf6c]`, `trigger` `[0x6fbc393c]`, `countdown` `[0x6fbc38bc]`, `flashState` `[0x6fbc38c0]` and
`thunderArmed` `[0x6fb91380]` (.data, initially 1).

- **Trigger.** Only Thunder Storm starts it. Its server strike sends S2C `0xA3` (built by `D2Game:0x6fc9a190`,
  serialized by `D2Game:0x6fcaba90`), 24 bytes: `a7` flag u8 `@1`, skill i16 `@2`, skill level i16 `@4`, caster
  type u8 `@6` / id u32 `@7`, target type u8 `@11` / id u32 `@12`, x / y u32 `@16` / `@20` (0 for Thunder Storm).
  The handler 0x6fb5efb0 returns for an unknown caster (0x6fb5efd7) or a skill outside Skills.txt
  (0x6fb5f012 / 0x6fb5f01d), and runs 0x6fb52950 for a progressive skill (0x6fb5f03e). Otherwise 0x6fb51b10 makes
  the packet's target the caster's path target and calls `cltprgfunc1` through 0x6fb8ea48. Only fn #84
  (0x6fb24350, Skills.txt row 57) calls ForceLightning(0) (0x6fb24445), after its `thunderstorm1` missile and before
  the `lightning` overlay; it returns first when the path target is NULL (0x6fb243b7). There is no local-player
  filter: every strike the client receives counts. Port: `ServerEvent` `UnitSkillEvent`,
  [`unitSkillEventForcesLightning113c`](../src/client/weather/weather-controller.ts), `OnlineSession`.
- **ForceLightning 0x6fb301f0** does nothing while `enabled`; otherwise `enabled = 1`, `trigger = 1`,
  `flashState = 0`, `thunderArmed = 0` (the pushed argument). Game init clears `enabled` and `flashState`.
  EnterState(3) (0x6fb311b7), FullState (0x6fb30dcb / 0x6fb30dfb) and SetSnow(1) (0x6fb3147d) clear `enabled`, so
  the lightning a strike starts stops when the next full state or ramp-down begins.
- **Countdown.** The SpawnAndWind tail (0x6fb30f3c..0x6fb30f4e) runs once per weather step, so only in Rain levels:
  `if (enabled && --countdown == 0) trigger = 1`. ResetWind also rolls it (§3).
- **Driver 0x6fb305a0** (end of the world draw, call 0x6fb3b2c6) consumes the trigger when `enabled && trigger`.
  The first flash of a pair sets `countdown = 3`, `flashState = 1`. The second sets `countdown = 500 + RNG(1500)`,
  `flashState = 0`, and arms/triggers thunder when `thunderArmed` (0x6fb3066d..0x6fb306b0: Sounds.txt 202 through
  PlaySound 0x6fb38a70); otherwise it sets `thunderArmed = 1`
  (0x6fb306b7). So the flashes come in pairs 3 ticks apart, the first pair after ForceLightning is silent and every
  later pair thunders on its second flash. A dry level gets only the first flash, because no tail runs there.
- **FPS gate.** The flash is drawn only when the FPS counter `[0x6fbcc2ac]` is at least 10 (0x6fb306c2); below
  that the trigger and the RNG draw are still consumed. The counter 0x6fb0a9a0 (call 0x6faf4392, after the UI)
  counts frames while `GetTickCount − windowStart ≤ 1000`; the next frame publishes the count and restarts the
  window. Port: [`FpsCounter113c`](../src/client/render/fps-counter-113c.ts).
- **DrawFlash 0x6fb2fe10** replaces DrawParticles for that frame (tail jump 0x6fb306d1), so no rain or snow lines
  are drawn. D2gfx #10014 with colour 0xFF and mode 5 (D2DDraw / D2Gdi remap it to the opaque mode 0; Direct3D
  uses alpha 0xFF) fills `x ∈ [x1, min(x2, W − 1))`, `y ∈ [0, H − 47)` with palette index 255, which is
  RGB(255, 255, 255) in all five act palettes, unlit. `x1 = 2·(W/4)` when only the left panel is open and
  `x2 = W − 2·(W/4)` when only the right panel is open; otherwise `[0, W)`. The renderer's clamp to `W − 1` leaves
  the rightmost column unflashed (800×600: `[0, 799) × [0, 553)`). The flash covers every world layer drawn before
  0x6fb3b2c6, and lies under 0x6fac0ec0 (not analysed) and the UI. Port:
  [`lightningFlashRect113c`](../src/client/weather/weather-raster.ts).
- **Both side panels open** (`[0x6fbcc414] = 3`): the render callback skips the world draw (0x6faf4361), so
  neither the floor pass nor the driver runs, and a pending trigger waits for the next frame that draws the world.

## 7. Assets

[`pack-weather.ts`](../src/baker/packers/pack-weather.ts) (`npm run pack:weather`) writes
`public/assets/weather/weather.json`:

- the five act palettes `data\global\palette\ACTn\pal.dat` (RGB). The packer fails unless each equals the base
  palette of the act's `pal.pl2`, which the tile renderer draws with;
- one palette-index atlas (index 0 transparent) with the `Rain3`, `Rain4` and `bubble3` DC6 frames and their
  offsets (10 / 10 / 12 frames).

[`weather-assets-parity.test.ts`](../tests/client/weather-assets-parity.test.ts) requires the checked-in JSON to be
byte-identical to a fresh bake from the MPQs. `startPlayApp` loads it before the session starts and fails fast
without it.

## 8. The S2C `0x15` reassign path (0x6fb57e20)

The `0x15` handler 0x6fb5f640 calls 0x6fb57e20 (from 0x6fb5f682). For the weather, the function:

1. returns when the unit's dead flag `[unit+0xC4] & 0x10000` is set (0x6fb57e80), or when a player is in mode 0
   or 0x11 (0x6fb57eb4);
2. for the local player `[0x6fbcbbfc]` with a room (#10331, 0x6fb57ed9), zeroes the arg (packet byte `@0x0A`,
   0x6fb57efe) when the used skill's Skills.txt row has the `warp` flag (only Teleport 54 and Dragon Flight 275).
   When the arg survives, 0x6fac0ea0 is called (not part of the weather and not ported);
3. moves the unit, then calls `0x6fb31720(arg)` at 0x6fb58012: clear splashes and bubbles, and SelectPrecip(arg)
   when `arg != 0`. SelectPrecip therefore sees the level of the room the player moved into.

The other callers of 0x6fb57e20 (0x6facb60a, 0x6fb77351) were not traced.

**Port.** [`localReassignWeatherArg113c`](../src/client/weather/weather-controller.ts) reproduces steps 1–2. The
session evaluates it before `ClientWorld` applies the packet, because `ClientWorld` clears the cast and revives a
dead local player on `0x15`. Vanilla handles every packet of a frame interval before the render callback runs
LoadWeather and the update, so `WeatherController.onLocalReassign` queues the call and runs it at the start of the
next frame, before the pending LoadWeather, with that frame's player level.

## 9. Port decisions and approximations

| Topic | Port | Why |
|---|---|---|
| RNG | the 1.13c algorithm on a **dedicated seed**, random per page | vanilla draws from the local player's unit seed (`[0x6fbcbbfc] + 0x20`), which other client code also consumes; its sequence cannot be reproduced. Every draw happens in vanilla order |
| LoadWeather timing | queued on S2C `0x03`, run at the next frame that draws the world and has the assets | vanilla runs it from the render callback while the act load is pending. When `[0x6fbcb9d0]` clears is UNVERIFIED |
| Colour ramps | built from the LoadAct level's act palette | whether D2Win's palette at that moment is the raw `pal.dat` or a gamma-adjusted copy is UNVERIFIED |
| Camera delta | the camera movement accumulated since the previous step; drawing is anchored to the world at the step's camera origin | vanilla passes only the delta of the render frame that steps and loses the rest; at the port's frame rates that would make the weather drift |
| Used skill for the warp test | the port's current cast (`castState`) | UNVERIFIED: when the client clears `pSkills->pUsedSkill` was not recovered |
| Water tiles | every floor tile whose diamond overlaps the screen and whose `materialFlags & 0x02` is set; an animated tile uses its base tile's flags | the clip margins of 0x6fac3ce0 were not recovered; the `flags & 0x408` skip has no equivalent (hidden floors are never built) |
| Side panels | the clip rect halves the view; nothing is shifted | vanilla shifts screen-space overlays by ∓W/4 because it shifts the whole world view; the port never does |
| Additive cels | `blendFunc(ONE, ONE)` on RGB, palette row 0 (the act palette), unlit | vanilla looks up the pl2 AdditiveBlend table (clamped sum, then the nearest palette index) |
| DC6 placement | top-left at `(X + ox, Y + oy − h)` | the port's DC6 convention; the exact ±1 of DrawCellContext is UNVERIFIED |
| Renderer look | DirectDraw: opaque lines, darkened snow greys | Glide / Direct3D were not analysed |
| LowQuality / perspective | not present | the port has neither mode |
| Lightning: unknown `0xA3` target | never flashes | fn #84 tests the caster's path target, which 0x6fb51b10 sets only when the packet's target is known; otherwise vanilla keeps the previous (stale) one. The port has no client path target |
| Lightning: raw unit type | a type outside 0..5 counts as an unknown unit | vanilla has no range check: the `0xA3` handler takes the hash bucket at `0x6fbba608 + type·0x200` (0x6fb5efc0..0x6fb5efc6, 0x6fb5efe9..0x6fb5efef), so a larger type reads past the six-type table. What it finds there is UNVERIFIED |
| Both side panels open | the floor pass (splash / bubble spawns) and the lightning driver pause; the world stays drawn | vanilla skips the whole world draw (0x6faf4361, `[0x6fbcc414] = 3`), which the two panels hide at 800×600. On a wider viewport the port keeps the world visible but follows the gate for the weather |
| Lightning driver rate | once per weather frame (new game tick); the result is held for every render frame of that tick. A pending trigger fires on the first frame that draws the world | vanilla runs 0x6fb305a0 every rendered frame, so a flash lasts one rendered frame, one tick at 25 fps. The port renders at the display rate. No frame runs while the tab is hidden |
| FPS counter clock | integer milliseconds of `performance.now()` | vanilla reads `GetTickCount`; the algorithm is the same |
| Flash renderer | the D2DDraw / D2Gdi / Direct3D clamp: the rightmost column is not flashed | the D2Glide clamp bound `[0x6f865a68]` (W or W − 1) is UNVERIFIED |
| Flash layering | drawn by the weather pass, under the automap and the UI | what 0x6fac0ec0 (called right after the driver, 0x6fb3b2cb) draws was not analysed: UNVERIFIED |

## 10. Not ported

- **Ambient sounds**: weather sounds (rain loop 64, thunder 202), music 0x6faf5660, and the
  ambient manager (SoundEnviron day / night loops and events) are not ported.

## 11. NOT 1.13c: `weatherOverride` in the `automap-reveal` plugin

[`plugins/automap-reveal`](../plugins/automap-reveal/index.ts) exposes the `weatherOverride` setting (`off` / `rain` /
`snow`) inside the PluginMenu modal and syncs it with the `weatherOverride` client setting. `WeatherSim.setOverride`
builds the forced weather only from vanilla code paths:
SelectPrecip's rain branch or its Act V default snow branch, then EnterState(1)'s peak roll and SetForced(1), which
holds the state machine in the full state. Every level counts as `Rain = 1` while overridden; `Mud` is unchanged.
`off`, or disabling the plugin, clears the lock and runs SelectPrecip(1), so the 1.13c cycle resumes. The host
reverts the setting to `off` when no plugin claims it.

## 12. Verification

- [`weather-sim-113c.test.ts`](../tests/client/weather-sim-113c.test.ts): LoadWeather's RNG order, durations, the
  first-tick ramp-up, freezing in dry levels, one step per counter value, Act V snow on load and the 25% rain
  roll, 117 / 120 / 121 / 136, wind bounds, spawn formulas, camera scroll and wrap, splash and bubble lifetimes
  and gating, the reassign reset and the override.
- [`fog-sin-table.test.ts`](../tests/client/fog-sin-table.test.ts), [`fog-pool.test.ts`](../tests/client/fog-pool.test.ts),
  [`palette-nearest.test.ts`](../tests/common/palette-nearest.test.ts),
  [`weather-colors.test.ts`](../tests/client/weather-colors.test.ts).
- [`weather-raster.test.ts`](../tests/client/weather-raster.test.ts): the biased DrawLine, the view rect, the
  particle rules, and 800×600 golden hashes (`rain-act1-day` 0xe7dc16ad, `rain-act1-night-panel1` 0xc6feda61,
  `snow-act5-day` 0x832e7f52; scenes in [`weather-golden-scenes.ts`](../tests/client/weather-golden-scenes.ts)).
- [`weather-controller.test.ts`](../tests/client/weather-controller.test.ts),
  [`weather-render-pass.test.ts`](../tests/client/weather-render-pass.test.ts) (including a 136-level sweep of the
  pass: lines only in Rain levels, bubbles only in 75–83),
  [`weather-session.test.ts`](../tests/client/weather-session.test.ts),
  [`weather-assets-loader.test.ts`](../tests/client/weather-assets-loader.test.ts),
  [`weather-override-setting.test.ts`](../tests/client/weather-override-setting.test.ts).
- [`weather-lightning-113c.test.ts`](../tests/client/weather-lightning-113c.test.ts): the lightning state machine
  against golden rows from the disassembly and through `WeatherSim` (pairs 3 ticks apart, `500 + RNG(1500)`, the
  silent first pair, the FPS gate, FullState's disable), the controller (one driver
  run per tick, the both-panels gate and its deferral), a 136-level sweep (Rain levels flash twice 3 ticks apart,
  dry levels once), the `0xA3` filter and the DrawFlash rect;
  [`fps-counter-113c.test.ts`](../tests/client/fps-counter-113c.ts);
  [`d2gs-0xa3-unit-skill-event.test.ts`](../tests/netproto/d2gs-0xa3-unit-skill-event.test.ts) (the 24-byte
  layout); [`input-tables-113c-parity.test.ts`](../tests/client/input-tables-113c-parity.test.ts) (`cltprgfunc1`
  and the progressive flag against Skills.txt); `weather-session.test.ts` (raw `0xA3` bytes through the session).
- [`weather-136-spectrum.test.ts`](../tests/weather-136-spectrum.test.ts): Levels.txt `Rain` / `Mud` and the
  weather mode of every level id 1..136.
- [`tools/verify-weather-browser.ts`](../tools/verify-weather-browser.ts): headless Chrome against the live server.
  It checks the weather assets and LoadWeather with the Act I palette, live rain in the Rogue Encampment, and the
  `automap-reveal` plugin's `weatherOverride` select in the PluginMenu modal (snow, rain, Default, disable / re-enable). It renders a 136-level audit: a fresh
  simulation per level, 600 ticks, every visible floor tile marked as water, and the period of day cycling with
  the level id. Rain, snow, splashes and bubbles must follow Levels.txt `Act` / `Rain` / `Mud` read from the MPQs.
  It also sweeps forced rain and snow through all 136 levels. Each rendered frame is drawn with and without the
  weather and read back: every pixel the line rasterizer writes must hold its exact act-palette colour from the
  period's ramp, every other changed pixel must lie inside a visible splash / bubble cel rect, and dry levels must
  not change at all. Output: screenshots and `levels-weather-audit.json` in `scratch/verify-weather/`.

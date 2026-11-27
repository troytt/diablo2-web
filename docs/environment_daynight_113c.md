# Diablo II v1.13c Day/Night Environment Clock, Ambient Light and EnvEffect Objects

> **Ground truth**: 1.13c `D2Common.dll` (ImageBase `0x6fd50000`), `D2Client.dll` (ImageBase `0x6fab0000`),
> `Patch_D2.mpq` `Levels.txt` / `Objects.txt`. Every VA below was read in the 1.13c disassembly. Items that the
> assembly does not prove are marked **UNVERIFIED**.
>
> **Port**: [`environment.ts`](../src/common/world/environment.ts),
> [`ambient-light.ts`](../src/common/world/ambient-light.ts),
> [`light-grid.ts`](../src/common/drlg/light-grid.ts) `fillAmbientRect`,
> [`lighting-presets.ts`](../src/client/scene/lighting-presets.ts) `applyLightingInputs`,
> [`env-effect.ts`](../src/client/world/env-effect.ts),
> [`online-session.ts`](../src/client/session/online-session.ts) (`LoadAct` / `EnvironmentSync` / `UnitAssign` / `tick`),
> [`misc.ts`](../src/netproto/d2gs/s2c/misc.ts) `decode0x53EnvironmentSync`.

---

## 1. The act environment clock (D2Common)

### 1.1 `D2DrlgEnvironmentStrc` (0x38 bytes at `pAct + 4`)

| Offset | Field | Offset | Field |
|---|---|---|---|
| +0x00 | `cycleIndex` (row 0..5) | +0x18..+0x1A | `R`, `G`, `B` (u8) |
| +0x04 | `period` (0 DAY, 1 DUSK, 2 NIGHT, 3 DAWN) | +0x1C / +0x20 / +0x24 | `fCos` / `fLast` / `fSin` (f32) |
| +0x08 | `ticks` (int) | +0x28 / +0x2C | `rate` / `rateIndex` |
| +0x0C | `intensity` | +0x30 / +0x34 | `eclipse` / `prevDegree` |

The clock belongs to the **act**, not to the level. The client allocates a new one with every client act
(S2C `0x03`), so it also runs inside caves and dungeons.

### 1.2 Cycle tables (D2Common `.data`, 12-byte rows `{u32 begin°, u32 period, u8 r, u8 g, u8 b, pad}`)

| Table | VA | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|---|
| normal | 0x6fdeb160 | 320 DAWN 125,144,243 | 340 DAWN 208,184,131 | 0 DAY 255,255,255 | 160 DUSK 255,255,255 | 180 DUSK 194,152,193 | 200 NIGHT 125,144,243 |
| Act IV | 0x6fdeb1a8 | 340 DAWN 243,70,243 | 350 DAWN 208,184,131 | 0 DAY 255,20,20 | 180 DUSK 255,255,30 | 190 DUSK 20,152,193 | 200 NIGHT 125,144,243 |
| eclipse | 0x6fdeb1f0 | 300 DAWN 0,30,243 | 0 DAY 0,30,244 | 60 DUSK 0,30,243 | 120 NIGHT 0,30,243 | 180 NIGHT 0,30,244 | 240 NIGHT 0,30,243 |

Other constants:

- Time rates `0x6fdeb238` = `[128, 4, 8, 0]`, indexed by `rateIndex`. The client never receives a rate index, so
  its clock always runs at **128 ticks per degree** (`ENV_TIME_RATE`).
- Level → act boundaries `0x6fde4668` = `{1, 40, 75, 103, 109, 1024}` (`DRLG_GetActNoFromLevelId` 0x6fd7d2c0,
  0-based act; level 0 is act 0).
- `(double)(float)π` at `0x6fde6f28` = 3.1415927410125732; `1/180` at `0x6fde6f30`.

### 1.3 Functions

| VA / ordinal | Function | Notes |
|---|---|---|
| 0x6fd87ba0 | `ENVIRONMENT_Alloc` | zeroed; `cycleIndex` 2 (noon); `rate` 128; `period` DAY; `ticks` 0; intensity for level 0 → **128**; colour → white; `eclipse` 0 |
| 0x6fd87570 | `UpdateTicks` | see below |
| 0x6fd876f0 | `UpdateLightIntensity` | see below |
| 0x6fd871c0 | `UpdateLightColor` | see below |
| 0x6fd87170 | snap to row | `period` and `ticks = rate · begin` of the current row (eclipse table when the flag is set) |
| #10135 0x6fd87af0 | `UpdatePeriodOfDay(pAct, pRoom)` | level id = `pRoom→+0x10→+0x58→+0x1d0` (0 without a room); `UpdateTicks` → `UpdateLightIntensity` → `UpdateLightColor`; level 120 forces RGB 245,240,255; returns whether `period` changed |
| #10358 0x6fd87920 | `InitializeEnvironment(pAct, pRoom, cycle, ticks, eclipse)` | see below |
| #11044 / #10731 / #10189 | getters | period / intensity (0x6fd874e0) / colour (0x6fd87520) of an act |
| #11045 0x6fd87660 | `UpdateCycleIndex` (server) | runs `UpdateTicks`; returns 1 when the period or row changed or `|ticks/rate − prevDegree| > 16`; the game server then sends S2C `0x53`. It also sends one right after `0x03` |

**`UpdateTicks`** (act 0-based):

1. `ticks += 1`.
2. Not eclipse: Act IV adds **+15**; otherwise, when `normal[cycleIndex].period == NIGHT`, add **+1**, and Act III
   adds **+8** more (10 ticks per frame at night).
3. `ticks >= 360 · rate` → `ticks = 0`.
4. The next row's begin comes from the normal table (not eclipse), the Act IV table (eclipse in Act IV) or the
   eclipse table (other eclipses). When `ticks > nextBegin · rate` the row advances, and `period` / `ticks` are
   taken from the **normal or eclipse** row it lands on (`ticks` snaps to `rate · begin`).

**`UpdateLightIntensity`**:

- Act IV: ±1 per frame towards `{103: 128, 104: 64, 105: 56, 106: 48, otherwise 16}` (jump table 0x6fd87824);
  0 snaps to the target.
- Eclipse: −8 per frame, floor 32.
- Level 120 (Arreat Summit): 200.
- Otherwise: `a = ticks/rate · (1/180) · π_f`; `fCos = f32(−cos a)`; `fSin = f32(sin a · (ticks ≥ 180·rate ? 0.5 : 1))`;
  `fLast = 0`; `I = trunc(fSin · 128 + 128 + 0.5)` clamped to `[0, Act V ? 170 : 255]`.

**`UpdateLightColor`**: table = Act IV table in Act IV, else eclipse or normal. The ratio
`(ticks − rate·cur) / (rate·next − rate·cur)` is **not clamped**; channels are computed in the order G, B, R as
`(c + trunc((n − c) · ratio + 0.5)) & 0xFF`.

**`InitializeEnvironment`** (#10358):

1. Asserts `0 ≤ cycle < 6` and `ticks ≥ 0`; `ticks > 360 · rate` → 0.
2. Stores `cycleIndex` and `ticks`; `period` from the eclipse or normal row.
3. Runs `UpdateLightIntensity` once **before the eclipse flag is stored** (0x6fd879e6), so this pass still sees the
   previous flag.
4. Stores the flag. Eclipse: snap (0x6fd87170) → `UpdateLightIntensity` → `UpdateLightColor`.
5. The non-eclipse path does **not** update the colour; the next frame does.
6. Level 120 forces RGB 245,240,255. A null room is level 0.

## 2. Client call sites (D2Client)

- **25 Hz frame** 0x6faf4a80 (40 ms): the unit update (0x6faf4a93 → 0x6fb58110, which runs the ClientFn polls),
  then `#10135 UpdatePeriodOfDay(gpAct = [0x6fbcc3b8], player ? GetRoom(player) : 0)` at 0x6faf4afe, then the
  EnvEffect refresh 0x6fb56680 when the period changed. There is no act-type check: the clock runs indoors.
- **S2C `0x53`** handler 0x6fb5e9c0 (10 bytes `u32 cycleIndex @1, i32 ticks @5, u8 eclipse @9`):
  `player->pAct` is read at 0x6fb5e9c5 without a null check; when it equals `gpAct`, `#10358` with the player's
  room, then 0x6fb56680 and 0x6fb32fe0 (unrelated to the environment, not ported). The dispatcher 0x6fb5ce30
  calls handlers directly. In every capture under `tests/fixtures/netproto`, `0x59 AssignPlayer` arrives long
  before `0x03` / `0x53`; the `0x53` is always `53 02000000 00000000 00`.
- The port has one client act, so the `gpAct == player->pAct` test always holds. A `0x53` before `0x59` or before
  `0x03`, a cycle index outside 0..5 or a negative tick count disconnects the session (fail fast instead of the
  1.13c null dereference / assertion).

## 3. Ambient light and the light grid

**`CLIENT_GetAmbientLight`** 0x6fb59a20, in priority order:

1. Den of Evil (level 8): quest light from 0x6fb024d0;
2. levels 107/108: red 255,64,48 at intensity 160 while `[0x6fbcc2e4]` is set and `[0x6fba2130]` is −1;
3. other levels: the global fade override `[0x6fbc9610..0x6fbc9616]`;
4. Levels.txt Intensity / Red / Green / Blue (D2Common #10636, 0x6fd8c6a0) when any of R, G, B is non-zero;
5. otherwise the act clock (#10189 colour, #10731 intensity).

Steps 1–3 fall through to step 4 when their colour is black, which is the normal state. `resolveLevelAmbient` is
steps 4–5; steps 1–3 are `QuestFxLight` (`src/client/world/quest-fx-light.ts`, #826, §3.1), and
`resolveRoomAmbient` asks steps 1–3 first for every room of the light grid. `IsInside` plays no part.

**Light grid** 0x6fb59e30 → 0x6fb59c90:

1. fill the whole grid with the player room's ambient light;
2. for every room of the player room's near list (D2Common #10383, 0x6fd8ba20) other than the player room, fill
   the room's rectangle (0x6fb58560, inclusive range `[x − origin, x + w − origin]`) with that room's light;
3. blend the lights in.

The port prefills `LightGrid` the same way (`applyLightingInputs`) and draws with `u_ambient = 0`. The near rooms
are the DRLG `ppRoomsNear` of the player's room limited to rooms added with S2C `0x07`
(`MapWorkerEngine.getRevealedNearRooms`). The port's grid cells span 8×8 sub-tiles instead of 1 (#830), so a cell
takes a room's light when its centre sub-tile lies in the room's inclusive range.

### 3.1 Quest special lights (steps 1–3, #826)

`QuestFxLight` holds the D2Client globals; `OnlineSession` feeds it and the light grid asks it for every room.

- **Den of Evil** (`DenLight` 0x6fb024d0): RGB 255,64,48 at I 80 while byte 1 of the S2C `0x5E` copy (A1Q1, pkt[2])
  is non-zero. S2C `0x89` event 0 starts a timer t; I = trunc(80·cos512(⌊128t/30⌋)) until t = 30, then black for
  the rest of the game. Asking for level 8 before any `0x5E` is a 1.13c FatalAssert (the port throws).
- **Levels 107/108**: event 12 sets the red flag; event 13 starts a 30-tick countdown that clears it. Red
  255,64,48 at I 160 only while the flag is set and no countdown runs.
- **Global fade** `g_Fade` (0x6fbc960c), for every other level. Event 1 (Cairn Stones, 0x6fb02d00) starts it when an
  objects.txt 17 `StoneAlpha` is in the player's room or one of its near rooms: ramp in and out over Missiles.txt
  288 `cairnstones` Param1 (40) ticks, Range (300) ticks in all, for the Stony Field (4). A States.txt `setfunc` 2
  state (only 153 `cloak_of_shadows`) starts it from the set-function dispatch 0x6fb22530. S2C `0xA8` reaches the
  dispatch after the 0x1ff stat terminator. S2C `0xAA` reaches it after each state. Both apply only to a unit the
  client knows, and only when the packet added stats (the statlist holds stat 350 skill, 351 level). X =
  `auralencalc` of that skill (Cloak: 200 + 25·(slvl − 1)); ramp in 5, hold 3X/5, ramp out 2X/5 (0 → 25), for the
  unit's room level. `0xA7` and `0xA5` never start it.
- **FadeTick** 0x6fb02f10: each tick copies the player room's steps 4–5 colour and takes I = trunc(cos512(phase)·T),
  T = that light's intensity, with the phase the previous tick stored (ramp in ⌊128k/rampIn⌋, hold I = 0, ramp out
  128 − ⌊128n/rampOut⌋). The fade ends after the tick at k = end, or on the first tick the player's level differs.
- **Order**: the quest-FX tick 0x6fb03720 (FadeTick, Den timer, Act 4 countdown) runs at 0x6faf4ab1, after the unit
  update and before `#10135`. A new game resets everything but the `0x5E` copy and the Act 4 countdown (0x6faf43d0).
- **Data**: `npm run extract:quest-fx-data` writes `src/client/world/quest-fx-data-113c.ts` from States, Skills and
  Missiles .txt, cross-checked against the .bin twins D2Common loads.
  [`quest-fx-data.test.ts`](../tests/client/quest-fx-data.test.ts) keeps it byte-identical.
  [`quest-fx-light.test.ts`](../tests/client/quest-fx-light.test.ts) replays the golden vectors
  (`tests/fixtures/lighting/quest-fx-826-vectors.txt`).
- **Port choices**: an `auralencalc` other than an integer, `parN`, `lnXY` or `dmXY` throws instead of being
  guessed; a `0x89` id ≥ 20 throws like the 1.13c FatalAssert. A `0xA8` / `0xAA` stat list that runs past the
  packet ends there (1.13c reads zero bits). **UNVERIFIED**: the #10754 search scope (player room plus near rooms),
  X = 0 for a skill without `auralencalc`, `lnXY` / `dmXY` at slvl ≤ 0. Also unverified: whether D2GS re-sends a
  fading state after a level change.

### 3.2 Quest special client missiles (#873)

Special quest events 0, 1 and 12 also spawn client-only quest FX missiles (`ClientWorld`, `QuestFxLight`, `OnlineSession`):

- **Den of Evil light beams (`denofevillight`, Missiles.txt 287)**:
  - `0x6fb036f0` (called by `QuestFxTick` 0x6fb03720 when `g_nDenTimer` reaches 30 and `g_bDenDone = 1`) walks every currently revealed Den of Evil (`levelId = 8`) room and calls `0x6fb03550(pRoom)`.
  - `0x6faf40c0` (called on room add `0x07` / `RoomReveal`) checks `[pRoom+0x34] & 1`: if clear, when `levelId == 8` and `g_bDenDone != 0` it calls `0x6fb03550(pRoom)` and sets `[pRoom+0x34] |= 1` (preventing duplicate spawns until the room is unloaded via `0x08` / `RoomHide`). Joining a game where A1Q1 was already completed (`questAvail[1] == 0`) leaves `g_bDenDone == 0` and spawns no beams.
  - `0x6fb03550(pRoom)`: tries up to 25 (`0x19`) random sub-tiles in `[roomSubX, roomSubX + roomSubW) × [roomSubY, roomSubY + roomSubH)` where `COLLISION_CheckMask` mask `5` (`COLLIDE_BLANK | COLLIDE_WALL`) is clear, spawning at most 3 `denofevillight` (`CelFile = LightBeams`, `LoopAnim = 1`, `AnimLen = 21`, `AnimSpeed = 16`, `Trans = 1`, `Light = 10` white via the #830 missile light path) with spawn flags `0x2003` (random `dir64` `0..63`, random initial frame `0..20`).
  - `CltDoFunc` 23 (`0x6fb62980`): on each tick, if `remainingTicks < 100`, extends `remainingTicks` to `500` (`maxTicks = ageTicks + 500`), keeping the light beams permanent while the room stays loaded.
- **Cairn Stones lightning (`cairnstones`, Missiles.txt 288)**:
  - `0x6fb02d00` (SpecialQuestEvent 1): when `D2Common #10754(playerRoom, UNIT_OBJECT, 17)` finds `StoneAlpha`, spawns invisible controller missile 288 (`cairnstones`, `Range = 300`, `CltParam1 = 40`, `CltParam2 = 2`) at `StoneAlpha`'s sub-tile before starting the global fade.
  - `CltDoFunc` 24 (`0x6fb6b8f0`):
    - **Phase A (`40 < rem < 260`)**: when `elapsed % 2 == 0`, seeds `{ lo: elapsed + stoneX, hi: 666 }`, rolls `(rx, ry) = (16 - rand(32), 16 - rand(32))`, and if walkable spawns sub-missile 384 (`cairn stones bolt`, `CelFile = ThunderStorm1`, `Light = 10`, `CltDoFunc = 22` @ `0x6fb627a0`, `altitude = 280` descending by `70`/tick over 4 ticks, `TravelSound = 2255` `amazon_lightning_1`) via `0x6fb628e0`.
    - **Phase B (`40 < rem < 165`)**: iterates Cairn Stone objects (`classId` `17..21`, `|dx| < 40`, `|dy| < 40`), spawning `cairn stones bolt` (384) on each stone every tick, and when `rem % 8 == 0` spawning `cairnstonesground` (290, `Vel = 20`, `CltDoFunc = 8` @ `0x6fb691c0`, `CltSubMissile1 = 99` `lightninghit` with `zOffset = rand(16) - 8`, `Light = 3, Flicker = 4`) between stones (`prevStoneId` updated with 1/4 chance per stone).
- **Diablo entrance (`diablo appears`, Missiles.txt 372)**:
  - `0x6fb033f0` (SpecialQuestEvent 12): after setting `g_bAct4Red = 1`, if `GetLevelId(GetRoom(gpPlayer)) == 108` (`0x6c`, Chaos Sanctuary), spawns invisible controller missile 372 (`diablo appears`, `Range = 300`) at the local player's sub-tile.
  - `CltDoFunc` 37 (`0x6fb62500`):
    - At `rem == 150`: starts screen shake (`0x6fb3afd0`) with `sustainMs = 4000`, `amplitude = 25`, `rampUpMs = 0`, `rampDownMs = 0` (`offsetX/Y = rand(2 * amp) - amp`).
    - At `rem == 50`: plays sound `4638` (`0x121e`, `monster_diablo_taunt_1`) and calls `0x6fb1a0c0(0xf3)` (1.13c synchronous monster type `243` / Diablo DCC preload; handled asynchronously on demand by `EntitySpriteCache` in the web port).

## 4. EnvEffect objects

Objects.txt `EnvEffect` (record +0x139) is set on exactly four 1.13c rows:

| Id | Name / Token | Lit0..2 | RGB | ClientFn | Flicker |
|---|---|---|---|---|---|
| 39 | fire / RB (Rogue Encampment campfire) | 0 / 19 / 19 | 255,236,176 | 14 | 1 |
| 45 | AmbientSound / S1 | 0 | 255,255,255 | 1 | 0 |
| 71 | Dummy / F1 | 0 | 255,255,255 | 0 | 0 |
| 72 | Dummy / F2 | 0 | 255,255,255 | 0 | 0 |

All four have Selectable0..2 = 0. The campfire's modes 0..2 all loop (CycleAnim0..2 = 1). The Flicker column is
never loaded: the 1.13c Objects.txt loader has no binfield for it (#827).

| VA | Function |
|---|---|
| 0x6fad5280 | the switch: the EnvEffect byte is tested **before** #11044 reads the period of `gpAct`. DAY: mode 1/2 → 0 (returns 1), any other mode is left alone (returns 0). DUSK/NIGHT/DAWN: mode 0 → 1; returns 1. Other periods assert. A mode change copies `Selectable[mode]` into unit flag 0x2, calls the gfx refresh 0x6fb1a220 (only when not initialising) and restarts the animation (#10595) |
| 0x6fad4920 | object light: `Lit[mode]`, radius `min(Lit >> 1, 18)` (0x6fb58c20 refuses radius 0), intensity 255, Objects.txt RGB, at sub-tile · 8 + 4. The light (unit+0x64) and all five call sites are ported generically in `src/client/world/object-light.ts` (#827) |
| 0x6fad5490 | object init, run for every S2C `0x51` (0x6fb57400 always builds a new unit): the switch with ebx = 1 |
| 0x6fad53d0 | ClientFn 14: the switch when `GetTickCount() > unit[0xd4]`, then `unit[0xd4] = now + 500` (a new unit starts at 0) |
| 0x6fb56680 | refresh: the switch on every object when the period differs from `[0x6fbd3420]`, a process-wide variable that starts at DAY and is never reset |

So the campfire is dark by day (Lit0 = 0) and burns from dusk to dawn with a radius-9 light.

## 5. Golden values

Computed by an independent reference model of the D2Common functions and pinned in
[`environment-113c.test.ts`](../tests/environment-113c.test.ts):

| Item | Value |
|---|---|
| Alloc | cycle 2 (noon), ticks 0, intensity 128, RGB 255,255,255 |
| One day, Acts I / II / V | 35,846 frames (≈ 23 min 54 s). Row changes at frames 20,481 / 23,042 / 25,603 / 33,284 / 35,845 / 35,846; period changes at 20,481 / 25,603 / 33,284 / 35,846 |
| One day, Act III | 29,702 frames (10 ticks per frame at night) |
| One day, Act IV | 2,726 frames (16 ticks per frame); the unclamped colour ratio wraps bytes (frame 1,281: 213,205,217) |
| Morning row | lasts **one frame**: frame 35,844 is 208,184,132, frame 35,845 is 208,184,131 (I = 106), then noon is white with I = 128 |
| Act V | intensity capped at 170 (frame 2,000: 162) |
| Eclipse | −8 per frame: 120, 112, …, 40, 32, then 32; ticks keep +1 per frame |
| Level 120 | intensity 200, RGB 245,240,255 (frame 30,000: cycle 5, period 2, ticks 34,394) |

## 6. Levels.txt classification (136 levels, `Patch_D2.mpq`)

- **36 levels take the act clock** (Red = Green = Blue = 0): 1–7, 17, 26, 27, 32, 38–46, 75–83, 109–112, 117,
  120 (fixed I 200 / RGB 245,240,255 inside the clock), 136.
- **100 levels take their fixed Levels.txt light**, including **11 outdoor levels** (IsInside = 0): 103–108,
  125–127, 134, 135. Examples: Pandemonium Fortress (103) I 140 white, Outer Steppes (104) I 120 white, Den of
  Evil (8) I 0.

[`environment-136-spectrum.test.ts`](../tests/environment-136-spectrum.test.ts) checks every level against the MPQ.

## 7. Quirks kept on purpose

- The clock runs inside caves and dungeons (it belongs to the act).
- Sunrise jumps from warm (I 106) to white (I 128): the 340° row lasts one frame.
- Act IV runs 16× (≈ 1.8 minutes per day); Act III nights run 10×.
- `InitializeEnvironment` computes the first intensity with the previous eclipse flag, and the non-eclipse path
  leaves the colour stale until the next frame.
- The EnvEffect refresh cache starts at DAY and is never reset, so a refresh by day does nothing until the
  period has changed once.

## 8. Not ported / follow-ups

- Quest special lights (#826, §3.1; #873, §3.2): the Den light missiles (287), Cairn Stones missiles (288/384/290/99) and Diablo entrance missile (372) are ported in #873; the non-lighting work of the other special quest events (2–11, 14–19) is not ported.
- Per-mode lights of other objects (0x6fad4920 call sites outside the EnvEffect switch): ported by #827
  (`src/client/world/object-light.ts`; the Objects.txt fields are generated into
  `src/common/world/objects-txt-113c.ts` by `npm run extract:objects-txt`).
- Light grid scale (1.13c 48×48 sub-tiles vs the port's 48 cells of 8×8 sub-tiles): #830.
- The object light flicker: 1.13c has none (Objects.txt `Flicker` has no binfield and dLightMap
  0x6fb58000..0x6fb59f00 has no RNG), so the port draws a steady light (#827).
- The gfx refresh 0x6fb1a220 after a mode change: the port resolves object art per mode, so nothing to port.
- 0x6fb32fe0 called by the `0x53` handler: unrelated to the environment, not ported.
- `ClientWorld`'s generic mode-1 one-shot timer now applies to doors only (#827). Other objects leave mode 1
  through the 25 Hz animation tick 0x6fad5660, which honours CycleAnim1, so a looping campfire stays in mode 1.

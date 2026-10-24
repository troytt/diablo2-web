# Diablo II v1.13c A2Q6: staff in the Horadric orifice (special quest event 3)

What the original game does after the Horadric Staff is placed in the orifice of the true Tal Rasha's Tomb.
All addresses are 1.13c (`D2Game.dll`, `D2Client.dll`, `D2Common.dll` in `samples/d2`), read with `objdump`.

## Server (D2Game)

`0x6fce9d72..0x6fce9e12` (`ACT2Q6_DeleteAllHoradricItemsAndOpenTomb`), reached from C2S 0x44
StaffInOrifice after the useitem window (see `kb/ui/d2client-useitem-imbue-socket-orifice-113c.md`):

1. Deletes `hst`/`vip`/`msf`, sets A2Q2 flags (also for party members in Act II).
2. `pQuestControl+0x20 = 3` and `0x6fcffcc0` with callback `0x6fc559c0` (`QUESTS_TriggerFX` /
   `QUESTS_FXIterate`): **S2C 0x89 SpecialQuestEvent 3** to every player in the game.
3. Quest timer `ACT2Q6_Timer_UpdateObjects` after `((Missiles[338].Range - 75) * 0x66666667 >> 32) >> 3`
   = `(440 - 75) / 20` = 18 units.
4. Orifice (objects.txt 152) -> mode 1 (OPERATING); the "has portal" room flags of the orifice room and the room
   at (orifice.x - 13, orifice.y + 3) are cleared.

When the timer fires, `ACT2Q6_Timer_UpdateObjects` creates objects.txt **100 `Duriel's Lair`** (Token SJ, FrameCnt1
16) at **(orifice.x - 13, orifice.y + 3)** in mode 1 (OPERATING) and marks the tomb open. The client only sees the
normal object assign / mode packets for this.

There is **no "wall collapse" object**: the issue text's "Object 100 `talrasha_wall`" is wrong; 100 is the lair
portal, which the server spawns. The wall itself is map tiles.

## Client: special quest event 3 (`0x6fb03450`, jump table `0x6fba2138[3]`)

1. `gpPlayer` (0x6fbcbbfc) and `#10331` GetRoom must be non-null, and `#10754(room, UNIT_OBJECT, 0x98)` must find
   the orifice in the room / near rooms; otherwise nothing happens.
2. `0x6faf5570(0x1252, 0, 0x2d5, 0, 0, 0)`: song override with Sounds.txt **4690 `music_quest_horadric`**
   (`act2\horadricaction.wav`); stores sound id, start = now, end = now + 725 ms in 0x6fbcc354..0x6fbcc370.
3. `0x6fb5ff10(gpPlayer, 0x152, x, y, 0, 1)` (missile create wrapper: flags 1, owner, missile, x, y, skill 0,
   level 1): **client missile 338 `horadricstaff`** at the orifice.
4. Trajectory record of the staff (unit gfx+0x30, see below): position (0, 0, 40 << 11) via `0x6fb77e30`,
   velocity (0, 0, 0x200), target (0, 0, 0x46), flag |= 0x20.
5. `0x6fb1b300(eax = 0xb5, orifice, 2, 0...)`: **Overlay.txt 181 `light_jet`** (LIGHTJET.dcc, 13 frames,
   AnimRate 4, Trans 3) on the orifice, mode 2 (one-shot) - same call S2C 0x11 uses.
6. `0x6fb1a0c0(ebx = 0xd3, 1)`: preloads MonStats 211 (Duriel) graphics. objects.txt 152 `ClientFn` 8
   (`0x6fad4c50`) does the same preload once the orifice is in a non-zero mode. No visible effect.

## Client: CltDoFunc 31 `0x6fb64b80` (Missiles.txt 338 `horadricstaff`, Range 440)

`rem` = `#10737` (missile data +0x10, remaining frames) read before the CltDoFunc 1 tail (`0x6fb617c0`)
decrements it. Positions are `#10867` / `#10750` (path x / y).

- `rem == 0x96` (150): screen shake: 0x6fbbb9cc = GetTickCount, ramp-up 0, sustain 0xfa0 (4000 ms), ramp-down 0,
  amplitude 0x19 (25) at 0x6fbcbefc (same globals as CltDoFunc 37 `diablo appears`).
- Beams: the .rdata table **0x6fb836d0..0x6fb8372c** (7 records of {dx, dy, dir} dwords, dir = low byte),
  thresholds `0x145 - 25 k`:

  | rem | dx | dy | dir64 |
  |---|---|---|---|
  | 325 | 3 | -2 | 4 |
  | 300 | 1 | -3 | 58 |
  | 275 | 3 | 1 | 13 |
  | 250 | -2 | -3 | 49 |
  | 225 | 1 | 3 | 22 |
  | 200 | -3 | 0 | 40 |
  | 175 | -2 | 2 | 31 |

  At `rem == threshold`: missile **340 `horadriclight`** (flags 1) at staff + (dx, dy); `#10706`
  PATH_SetDirection(dir); `#10558` (data +0x0e, range) and `#10970` (data +0x10, remaining) both set to `rem`, so all
  beams vanish with the staff.
- `rem < 0xa5` (165) and `rem` even: missile **339 `horadriclightning`** (flags 0x21) from the staff to
  **(x - 13, y + 3)** - the point where the server puts the lair portal; trajectory position (0, 0, 0x23000 = 70 px),
  velocity (0, 0, -0x800 = -1 px/tick); `#10706(path, 0x15)`, `#10520(path, 0)` (rotate flag off).
- `rem < 0x96` (150): missile **150 `dust`** (FireSmoke, flags 0x21) at (x - 13, y + 3) towards
  (x - 12 + r1 % 5, y - 2 + r2 % 10), r1 / r2 two inline RAND steps on the staff's unit seed (unit+0x20/+0x24);
  `#10441(unit, 0x40)` = wAnimSpeed 0x40 (Missiles.txt AnimSpeed 16 is 0x100; missile create 0x6fb633f7 sets
  `AnimSpeed << 4` via `#10154`).
- Every missile created through 0x6fb630f0 plays its `TravelSound` (missiles.bin +0x12) attached to itself
  (0x6fb636c8..0x6fb636df): 338 `quest_horadric_staff_spin`, 339 `monster_lightning_1`, 340
  `quest_horadric_staff_light`.

## D2Client unit 3D trajectory record (unit+0x54 -> +0x30, 0x4c bytes)

Allocated zeroed by `0x6fb77b00` for every client missile (`0x6fb6358e`), then flags = (flags & ~1) | 8
(`0x6fb77bf0`). Fixed point `<< 11`.

| off | meaning | setter |
|---|---|---|
| +0x00 | flags: 0x1 stopped, 0x2 ballistic countdown (+0x48), 0x4 floor at +0x30 (+0x40/+0x44), 0x8, 0x10 attach to owner, 0x20 "rising" target test | 0x6fb77b90 (0x20), 0x6fb77c30 (0x1) |
| +0x04/+0x08/+0x0c | position x, y, z | 0x6fb77e30 (`<< 11` of ecx=z, edx=y, arg=x) |
| +0x10/+0x14/+0x18 | velocity | 0x6fb77df0 |
| +0x1c/+0x20/+0x24 | acceleration (ballistic init 0x6fb77c80 sets az = -0x1000 if 0) | 0x6fb77db0 |
| +0x28/+0x2c/+0x30 | target (pixels) | 0x6fb77d70 |
| +0x34/+0x38/+0x3c | x >> 11, y >> 11, -(z >> 11) (draw offsets) | step |

Step `0x6fb77fb0` (unit tick 0x6fadb2a5): return if flag 1; pos += vel; vel += acc; then (no flags 2/4/0x10)
flag 0x20 clear: stop when x>>11 <= tx && y>>11 <= ty && z>>11 <= tz; set: when all `>=`; stopping snaps pos to the
target and sets flag 1.

## Not verified / not ported

- The initial unit seed of a client missile (so the exact dust jitter sequence) is not derived.
- The song override 0x6faf5570 (no music-override system in the web client) and the Duriel preload.
- Server timer unit length (the 18 "units" of `QUESTS_CreateTimer`) - irrelevant to the client, which reacts to the
  object packets.

## Web port

`src/client/world/quest-fx-horadric-113c.ts` (constants, `horadricStaffTick`, `stepTraj3dZ`),
`ClientWorld.spawnHoradricStaffAtOrifice`, `QuestFxLight.onSpecialQuestEvent` case 3,
`OnlineSession.spawnHoradricStaffIfOrificeNear`; data from `gen-quest-fx-data.ts`; art from `pack-missiles.ts`
(HoradricStaff, HoradricLightBeamstreaks) and `pack-overlays.ts` (LIGHTJET). Issue #915.

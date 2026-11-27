# Diablo II v1.13c: smashing the Compelling Orb (Khalim's Will, Travincal)

What happens when the player hits the Compelling Orb with Khalim's Will. Addresses are 1.13c (`D2Game.dll`,
`D2Client.dll`, `D2Common.dll` in `samples/d2`), read with `objdump`. Issue #917.

## Data

| table | row | relevant columns |
|---|---|---|
| objects.txt | 404 `compellingorb` (Token 55) | FrameCnt 29/29/1, FrameDelta 128/128, CycleAnim 1/0, Lit0 17, OperateFn 53, InitFn 60, ClientFn 0, Parm7 0 |
| objects.txt | 386 `Dummy` / stairsr (Token sv) | 10x6, FrameCnt 1/9/1, FrameDelta 0/120, OperateFn 50, InitFn 53 (the Durance of Hate stairs) |
| MonStats.txt | 366 `compellingorb` (Code 9a) | AI Idle, Velocity 0, neverCount 1; its baked art is empty (512x1 sheet) |
| Missiles.txt | 368 `orbmist` | CltDoFunc 25, SrvDoFunc 1, SrvHitFunc 35, CltParam1 10 (dest radius), CltParam2 3 (init radius), CltParam3 1 (frequency), Vel 2, Range 400, Light 2 (255,125,125), CelFile null, AlwaysExplode 1, no ClientSend, TravelSound `compellingorb_mist_loop`, CltSubMissile1 `orbmisttrail` |
| Missiles.txt | 369 `orbmisttrail` | CltDoFunc 1, Vel 3, Range 50, CelFile `mist_Fade_Orb_Loop`, ExplosionMissile `orbmistfade` (AlwaysExplode 0) |
| Missiles.txt | 370 `orbmistfade` | Range 15, CelFile `mist_Fade_Orb` |

## Server (D2Game)

OperateFn table `0x6fd27bb8`; entry 53 = `0x6fd0a140`:

1. Returns if the orb's mode is not 0. The player's weapon code must be `qf2 ` (Khalim's Will), else
   `0x6fcfffd0(0x13, player)` (the "need the flail" message path).
2. Finds quest 0x13 in `game+0x10f4`; the quest data counter `+0x38` is incremented and the rest only runs once it
   reaches 2.
3. Sets quest flags (quest 0x12 bits 0 and 13, quest 0x15 bit 4 handling), deletes `qf2` from the player.
4. Looks up the monster whose id the quest stored at quest data `+0x2c` (game monster hash `+0x1320`): the
   MonStats 366 orb monster the quest's object-init callback spawned on the orb (`0x6fd084c0..0x6fd08554`:
   `0x6fd0ef10` with class 0x16e at the object's position, unit flag 0x20000; if the orb is already smashed
   (`+0xc`) the init puts the orb in mode 2). `0x6fd121e0` kills it, then `0x6fd0ab60` (ebx = monster) finds
   objects.txt 0x182 near it and creates the server missile 0x170 `orbmist` {flags 0x420, owner = monster, target =
   stairs}; on success the stairs' id is stored in the missile (it opens them on hit, SrvHitFunc 35); on failure the
   stairs go straight to mode 1 with an end-of-animation event.
5. Orb -> mode 1 (OPERATING) with an end-of-animation event at `objects.bin[404]+0xdc >> 8` frames; quest data
   `+0xc = 1`.
6. `0x6fc55e90(game, cl = 10)` = `QUESTS_TriggerFX`: **S2C 0x89 SpecialQuestEvent 10** to every player.

Missiles.txt 368 has no `ClientSend`, so `0x6fc8f740` never sends S2C 0x73 for the server mist.

## Client (D2Client)

- **Event 10**: `0x6fba2138[10]` is NULL; `0x6fb023b0` only sets bit 10 of `0x6fbcc2dc` (no reader found).
- **Object animations**: the orb's and the stairs' OP modes are the ordinary object animation path (0x6fad5660):
  orb 29 frames at ~128/256 per tick (~2.3 s), then mode 2; stairs 9 frames at ~120, then mode 2. Neither class is
  in the 1 -> 2 overlay list (354, 355, 356, 397, 405, 406, 407) and neither has a Parm7 sound.
- **MonUMod events**: `0x6fad12f0(unit, flag, event)` walks the 9 umod bytes at `pMonsterData+0x1c` and calls
  `0x6fba9fe0[(umod * 5 + event) * 4]`. Event 1 is raised at `0x6fafeb67`, after the NPC mode update (event 0 from
  0xAC assign at `0x6fafdd49`, events 2/3 elsewhere, 4 via `0x6fad13a0`). Non-null entries: umod 9 ev2, 10 ev2,
  11 ev2, 17 ev2/ev3, 18 ev2, 20 ev2, **22 ev1 = 0x6fad0fb0**, 23 ev0, 29 ev4, 31 ev2, 32 ev2, 33 ev2, 40 ev2.
- **`0x6fad0fb0`** (umod 22 `questcomplete`, event 1): switch on the monster class, mostly requiring mode 0:
  45 -> 0x6fb02860, 156 Andariel -> 0x6fb02230 (missile 307 `andycontrol0`), 211 Duriel -> 0x6fb027a0,
  229 Radament -> 0x6fb02620, 242 Mephisto -> 0x6fb02270, 243 Diablo -> 0x6fb02600, 256 Izual -> 0x6fb03070
  (song 0x1253 + missile 379), 267 Blood Raven -> 0x6fb02320, 284 (mode 14) -> 0x6fb026e0, **366 -> 0x6fb030d0**,
  479 -> 0x6fb02bd0, 540..542 / 544 further handlers.
- **`0x6fb030d0`** (orb monster in esi): `#10754(#10331(esi), UNIT_OBJECT, 0x182)`; found: song override
  `0x6faf5570(0x124f, 0, 0x15e, ...)` and target = stairs' position; not found: target = (esi.x - 15, esi.y - 15).
  `0x6fb630f0` {flags 0x420, +4 owner = esi, +8 source = esi, missile 0x170, target, level 1}; if both missile and
  stairs exist, `#10637(missile, stairs id)` (missile data `+0x28`).
- **`0x6fb630f0` flags** seen here: 0x1 = explicit start (+0x14/+0x18), else the source unit's position; 0x2 = target
  relative to start; 0x20 = explicit target (+0x1c/+0x20); 0x400 not decoded.
- **CltDoFunc 25 `0x6fb683d0`**: `elapsed = #10985` (range `+0x0e` - remaining `+0x10`); when
  `elapsed % max(1, CltParam3) == 0`: four RAND steps on the missile seed (unit+0x20), `dx = r(2*P1+1) - P1`,
  `dy = r(2*P1+1) - P1`, `sx = r(2*P2+1) - P2 + x`, `sy = r(2*P2+1) - P2 + y`, then `0x6fb630f0` {flags 0x21,
  owner = 0x6fb560d0(mist), CltSubMissile1, (sx, sy) -> (sx + dx, sy + dy)}; then the CltDoFunc 1 tail.
- **Range end** (`0x6fb61420`, no hit unit): the ExplosionMissile is only created when missiles.bin `+0x18c`
  (AlwaysExplode) is set, so `orbmisttrail` ends without `orbmistfade`.

## Open question

The only D2Game writer of umod 22 found is the SuperUnique spawner (`0x6fc451f0`, `0x6fc45730`, appended to every
superunique). The quest-init spawn of MonStats 366 (`0x6fd0ef10`) was not seen adding it. The same umod gates the
Andariel / Duriel / Mephisto / Diablo / Izual death shows, which do appear in 1.13c, so another writer probably
exists; until a capture of the 0xAC for MonStats 366 is available, it is not proven that the real server sends
umod 22 for the orb monster. The web port gates the mist exactly as D2Client does (umod 22 + mode 0).

## Web port

`src/client/world/quest-fx-compelling-orb-113c.ts` (constants, `orbMistTarget`, `orbMistTick`),
`ClientWorld.spawnCompellingOrbMist` (called from `triggerMonsterDeathFx`), the `orbmist` CltDoFunc 25 branch of
`stepMissileUnit`, `ClientWorld.setNearRoomObjectFinder` / `OnlineSession.findObjectNearSubTile` (#10754); data from
`gen-quest-fx-data.ts`. Not ported: the song override 0x6faf5570.

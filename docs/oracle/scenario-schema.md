# Oracle Scenario Schema (replica runner input)

A scenario drives one deterministic run of the TS server replica
(`npx tsx tools/oracle/run-replica.ts <scenario.json> <out.ndjson>`) and, with the same values, the
original-game oracle. Output format: [`trace-schema.md`](trace-schema.md).

```json
{
  "name": "a1-run-100",
  "seed": 12345,
  "save": "tests/fixtures/oracle/saves/a1-barbarian-l1.d2s",
  "difficulty": 0,
  "frames": 100,
  "inputs": [
    { "frame": 10, "c2s": "031c162a17" },
    { "frame": 60, "c2s": "0115161e17" }
  ]
}
```

| Key | Type | Meaning |
|---|---|---|
| `name` | string | Scenario id; copied into the trace header as `scenario`. |
| `description` | string (optional) | Free text, ignored by the runners. |
| `seed` | uint32, non-zero | Game init seed (`pGame->dwInitSeed`, oracle `Game.exe -seed N`). Also the DRLG map seed (see §Seeds). |
| `save` | path | `.d2s` loaded as the single player; repo-relative (resolved from the working directory) or absolute. |
| `difficulty` | 0 \| 1 \| 2 | Normal / Nightmare / Hell. |
| `frames` | int ≥ 1 | Frames to simulate; the trace has lines `frame = 1..frames`. |
| `inputs` | array | Frame-stamped raw D2GS C2S packets, ascending by `frame`. May be empty. |
| `inputs[].frame` | int ≥ 1 | Delivered at the **start** of this frame, i.e. before the update that produces trace line `frame` (oracle: `on_pre_frame` while `dwGameFrame == frame - 1`). |
| `inputs[].c2s` | hex | Whole C2S packet, opcode byte first, no framing/compression (e.g. `03 xxxx yyyy` RunToLocation, little-endian sub-tile coords). |
| `inputs[].note` | string (optional) | Free text, ignored. |
| `statIds` | int[] (optional) | Overrides the sampled stat list (oracle `stats` scenario line). Default `[0,1,2,3,6,7,8,9,10,11,12,13,14,15]`. |

Unknown keys, a zero seed, non-hex packets or descending frames are errors (no defaults are invented).

## How the replica applies a scenario

* Engine: `GameInstance` (`src/server/engine/game-instance.ts`), built like `LocalLoopbackAdapter`'s
  single-player game (`mode: 'singlePlayer'`, `SINGLE_PLAYER_POLICY`, `animActionWindup: true`) with
  `mapSeed = seed` passed explicitly (the lobby's `crypto`/singleton seed generator is never used).
* Data: `D2DataRegistry` from the MPQs in `D2_DATA_DIR` (else `samples/d2`), and the Node `MapService`
  over the packed DRLG bundle in `D2_ACT_PACKS_DIR` (else `public/act-packs/tiles`, built by
  `npm run pack`) as the server's area bootstrap source (`createAreaBootstrapResolver(
  createMapServiceAreaLevelSource(mapService))`). Missing data is an error; there is no test-grid or
  embedded-table fallback.
* Loop: for `f = 1..frames`: deliver inputs with `frame <= f`, `stepFrame()`, drain the player's event
  outbox, sample the trace line. The frame counter must equal `f` after each step (a paused game is an
  error). No wall clock is read anywhere.
* Input delivery mirrors a live D2GS connection in game state (`RoomClientSession` +
  `MultiClientRoomHost.handleClientCommand`): `0x6D` ping and a decoded `Ping` are answered outside the
  frame (no simulation effect); everything else goes through `decodeD2gsC2sPacketToCommand`
  (`src/server/net/session.ts`) and `enqueueCommand`. Undecodable packets, handshake packets
  (`0x68`, `0x6B`) and `LeaveGame` are errors.

## Saves

* A full v96 save is loaded with `connectPlayer({ d2s, restoreMercenary: true })`.
* A **header-only** save (exactly 335 = `0x14F` bytes, header `dwSize = 0x14F`, valid checksum, no
  `Woo!` quest block) is what the original front end writes when a character is created and has never
  entered a game. `tests/fixtures/oracle/saves/a1-barbarian-l1.d2s` is such a file. The original builds
  the character from `CharStats.txt` on entry — the oracle trace for it shows Str 30 / Ene 10 / Dex 20 /
  Vit 25, HP 55, mana 10, stamina 92, level 1, i.e. the Barbarian `CharStats.txt` defaults.
  `readD2sSave113c` only accepts full saves (≥ 765 bytes), so the runner parses the header with
  `readD2sNewCharacterHeader113c` (`src/server/save/d2s-reader.ts`) and connects through
  `GameInstance`'s fresh-character path with the header's name, class, level and status flags.

## Seeds

Evidence:

1. `D2Game.dll` `GAME_InitSeed` (`0x6FC4A900`): if the override global `0x6FD2E354` is not `-1` it becomes
   `pGame->dwInitSeed` (`+0x7C`) and `+0x84 = 1`; otherwise the seed comes from
   `QueryPerformanceCounter` (`kb/engine/oracle-hooks-113c.md` §3). The override is set through
   `D2Game #10017`; `D2Client 0x6FAF1D70` calls it with launch-config `[cfg+0x216]` when non-zero, and
   `Game.exe -seed N` fills that field. The oracle trace's first frame logs `initSeed: 12345`,
   `seedOverride: 1`, proving the override path.
2. The DRLG is seeded from the game seed: `DRLG_AllocDrlg` (`D2Common 0x6FD74120`) does
   `SEED_InitLowSeed(pDrlg->pSeed, nInitSeed)` (`src/common/drlg/drlg-drlg.ts`), so map seed =
   `dwInitSeed`.
3. `.d2s` header `+0xAB` is the saved map seed (`kb/save/d2s-map-seed-derivation-113c.md`). For
   `a1-barbarian-l1.d2s` it is `0` (header-only save, never played).
4. Two other `D2Client` call sites of the `#10017` thunk (`0x6FAC0C70`, `0x6FB5BAB9`) pass the global
   `0x6FBACD88`; where a non-zero `.d2s` map seed would enter `[cfg+0x216]`/that global on a normal
   single-player load was **not traced**.

Rule used by the replica: `seed` is the game init seed and the DRLG seed, passed explicitly to
`GameInstance` (so `connectPlayer`'s `.d2s` re-seed branch never fires). Because of (4), a save whose
header map seed is non-zero **and** differs from `seed` is rejected rather than guessed; set `seed` to
the save's map seed for such saves. For the current fixture (header seed 0) the replica and the oracle
(`-seed 12345`) both build the map from 12345.

## Trace mapping (replica side)

| Column | Replica source |
|---|---|
| `id` | `GameInstance` unit id (one shared counter for all unit kinds; D2 counts per type). |
| `class` | player `classId` (0..6); monster `classId` (`MonStats.txt` row); missile `missileId`. |
| `mode` | stored `mode` — already raw `PlayerMode.txt` / `MonMode.txt` numbers in the TS server (e.g. `5` town neutral, `2` walk, `3` run, `1` monster neutral). Missiles: `null` (no `dwMode` in `InternalMissileRecord`). |
| `x`, `y` | `floor(x + 0.5)` of the record position: TS logical `N.0` is the centre of sub-tile N, 1.13c precise positions are `(N << 16) + 0x8000` and `wPosX` is the integer part. |
| `seedLo`, `seedHi` | `null`: TS units have no per-unit `D2SeedStrc` (P0 audit §3.2). |
| `level` | record `areaId` (`Levels.txt` id of the area the unit is in). |
| stats | `UnitStatList.getAccruedStat(id)` of the server's own combat context (`playerCombatContext` / `monsterCombatContext`; a context created only for sampling is discarded again). HP/mana/stamina are already `<<8` there. Player `13/14/15` (experience/gold/goldbank) come from the player record, which is their only store. |

`t1` currently lists `GameInstance.monsters` (town NPCs and monsters); mercenaries and summoned pets,
which are monster units in 1.13c, are kept in separate TS containers and are not emitted yet.

# Oracle Trace Schema (`d2oracle/1`)

Both the original-game oracle (`tools/oracle/hook/d2oracle.c`) and the TS replica runner
(`tools/oracle/run-replica.ts`) emit this NDJSON format, so `tools/oracle/diff.ts` can compare
them field by field.

## Header (first line)

```json
{"schema":"d2oracle/1","source":"oracle","initSeed":12345,
 "unitFields":["id","class","mode","x","y","seedLo","seedHi","level"],
 "statIds":[0,1,2,3,6,7,8,9,10,11,12,13,14,15]}
```

| Key | Meaning |
|---|---|
| `source` | `oracle` (original 1.13c) or `replica` (TS server) |
| `initSeed` | `pGame->dwInitSeed` (`-seed N` on the oracle; `mapSeed`/game seed on the replica) |
| `unitFields` | column names of each unit row (before stats) |
| `statIds` | stat ids appended to every player (`t0`) and monster (`t1`) row, accrued value (`STATLIST_GetUnitStat(unit, id, 0)`, fixed point as stored: HP/mana/stamina are `<<8`) |
| `rng` | optional capability flag (`true` when `gs` and unit `seedLo`/`seedHi` are authoritative and compared by default) |
| `dot` | optional capability flag (`true` when per-frame `dot` StatRegen / DoT `stat 6` tick events are recorded; `trace-diff` compares `dot` iff both headers set `dot: true`) |

## Frame lines

```json
{"frame":2,"t0":[[1,4,5,5653,5918,3081094168,666, 30,10,20,25,14080,...]],"t1":[...],"t3":[...]}
```

- `frame` = `pGame->dwGameFrame` **after** that frame's update ran (the oracle samples right
  after `GAME_UpdateGameFrame` returns). Frame 1 is the first simulated frame of the game.
- `tN` = all units of type `N` in the game (0 player, 1 monster/NPC, 3 missile), in hash-bucket
  order; consumers must key rows by `id` (the diff tool sorts by id).
- Row = `unitFields` values, then (`t0`/`t1` only) one value per `statIds` entry.
- `x`,`y` are sub-tile coordinates (`wPosX`/`wPosY` of the dynamic path).
- `seedLo`/`seedHi` = the unit's `D2SeedStrc` (`unit+0x20/+0x24`). The replica writes `null`
  when it has no per-unit seed. Seed columns are excluded from the default comparison; pass
  `--fields` explicitly to compare them.
- `level` = `Levels.txt` id of the unit's room (`DUNGEON_GetLevelIdFromRoom(UNITS_GetRoom(u))`,
  D2Common `#10826`/`#10331`), `-1` for missiles / unit without room.
- The diff compares the intersection of both headers' `unitFields` (minus seeds) and reports
  oracle columns the replica does not emit as `uncomparedFields`.

## Optional per-frame keys (P5)

| Key | Shape | Meaning |
|---|---|---|
| `gs` | `[lo, hi]` | game RNG `D2SeedStrc` (`pGame+0xD0`) after the frame |
| `st` | `[[type, unitId, stateId, ...], ...]` | active states of players/monsters (`STATES_CheckState` #10871 for ids `1..stateCount-1`; only units with at least one state) |
| `dmg` | `[{att:[type,id], def:[type,id], hp:[before,after], ret, raw:[18 dwords]}]` | every `SUNITDMG_ApplyDamage` (`0x6FCFC0B0`) call this frame; `raw` is the 0x48-byte `D2DamageStrc` after the call, `hp` the defender's stat 6 around it |
| `dot` | `[[type, unitId, hp0, hp1], ...]` | every non-zero `STATLIST_SetUnitStat(unit, 6, hp1, 0)` (`D2Common.#10887`) tick from `MONSTER_Event3_HpRegen` (`0x6FC9684A`) or `PLAYER_UpdateHpRegen` (`0x6FC97D12`) this frame (`hp0` / `hp1` in `1/256`ths, emitted in execution order when non-empty; gated on `header.dot`) |
| `in` | `[[dispatchResult, hex], ...]` | C2S packets delivered this frame (scenario inputs and `steer` moves) |

RNG: D2 inlines its `SEED` recurrence at every call site, so individual draws cannot be hooked
centrally. Instead every unit row carries its seed and `gs` carries the game seed; a seed that
diverges at frame N means the RNG was drawn a different number of times on that holder.

## Mode values
Player/monster `mode` are the raw `dwMode` values (`PlayerMode.txt` / `MonMode.txt` order).

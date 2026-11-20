# K1 replay: K0 stand-ins (bound or wired, but not 1:1)

These symbols drive the a1-town-walk / a1c-bloodmoor-fallen replays today but are **not** faithful
ports of the DLL function they name (or used to name). Each one is manifest debt: replace it with
the real port listed below. Once the real port is wired, delete the stand-in and its binding.

| TS symbol (`src/d2kern-113c/game/replay-kernel-113c.ts`) | Bound VA | Why it is not 1:1 | Replaced by |
|---|---|---|---|
| `SLICE_StreamTownRoomWindow113c` | none (binding to `0x6FC4CBE0` removed in db0aefc1) | Builds Rogue Encampment rooms around the player from the hard-coded `townN1` DS1 presets (town origin `5520,5880`, 40x40 rooms, fake `D2RoomExStrc` of `0x100` bytes, collision filled with `0`). It spawns preset NPCs with one invented `pGame->tSeed` step, then 2 unit-seed steps, and copies the stat list from monster id 3. Only level 1 is handled. | D2Common room activation (`DRLG_ActivateRoomEx` `0x6FD7E1F0` + the F150 D2Common closure, Iteration 14) on DRLG-regenerated `D2RoomExStrc`s, then `GAME_UpdateActRooms113c` (`0x6FC4CBE0`, `game/act-rooms-113c.ts`) → `ROOM_SpawnPresetUnits113c` (`0x6FD01430`, `game/room-presets-113c.ts`). |
| `SLICE_UpdateAllRooms113c` | none (binding to `0x6FC6B400` removed in db0aefc1) | Calls the stand-in above for every player. `0x6FC6B400` is actually the per-client room-change handler (`0x6FC6AD10`, `0x6FCBD780`, `0x6FCBDEC0`, `0x6FC6B1D0`). | The `GAME_UpdateGameFrame` (`0x6FC4E050`) call to `0x6FC4CBE0`, plus the unit room-change path (`0x6FC6B400` → `0x6FC6B1D0`). |
| `AI_TownNpc113c` | `0x6FC3DB40` | AI state (home position, node-4/node-7 waypoints, retry counters) is kept in the JS map `TOWN_NPC_AI_BY_UNIT`, not in `pMonsterData->pAiControl` / `D2MapAIStrc` memory. Waypoints come from the hard-coded DS1 preset `mapAi` table. | 1:1 port of `0x6FC3DB40` that reads and writes the in-memory AI control and map-AI structs. |
| `AI_FollowDs1NpcPath113c` | `0x6FC3BBC0` | Uses the same JS-side `TownNpcUnitState113c` (`mapAi` copied from the DS1 preset table at spawn/hydrate time by nearest-preset matching) instead of `pPresetUnit->pSaveChain` / `D2MapAIStrc` in memory. | 1:1 port of `0x6FC3BBC0` on the map-AI chain that `ROOM_SpawnPresetUnit113c` (`0x6FD013B0`) hands to `pMonsterData->pAi + 0x38`. |
| `AI_WarrivGreet113c` | `0x6FC39C20` | Thin wrapper over the stand-in town NPC state above. | 1:1 port of `0x6FC39C20`. |
| `C2S_Dispatch113c` / `C2S_DispatchFromMem113c` | `0x6FCEC550` | Calls `applyPlayerPacket113c`, which decodes only C2S 0x01/0x03 (walk/run to location), 0x02/0x04 (walk/run to unit) and 0x06 (skill on unit) in TS; every other opcode is ignored. It is not the D2Game packet table dispatch: there is no client lookup, no packet-size table, and no per-opcode handler VAs. It is required by `KERNEL_REGISTRY_113C` (purity test), so it stays bound until replaced. | 1:1 port of `0x6FCEC550` and its per-opcode handlers. |
| `GAME_UpdateGameFrame113c` → `stepFallenSliceFrame113c` | `0x6FC4E050` (registry) | K0 slice frame driver: `SLICE_UpdateAllRooms113c`, `EVENT_UpdateTimers113c` with TS-side event routing, and an end-of-frame flag sweep. Most of the real `0x6FC4E050` body is missing, including the act room loop `0x6FC4CBE0`. | 1:1 port of `0x6FC4E050` once its callees are ported. |

## Act room population: status

The real F150/F151 pipeline (a1c-bloodmoor-fallen `gs` divergence: 3 × 169 MonDen rolls + 2 object
seeds = 509 LCG steps) is ported on the D2Game side but not wired into the replay yet:

- `GAME_UpdateActRooms113c` `0x6FC4CBE0`, `ROOM_TickSeedAndAmbientSpawn113c` `0x6FC67950`,
  `REGPOP_RollAmbientSpawn113c` `0x6FC67820`, `REGPOP_SpawnAmbientPack113c` `0x6FC67660`
  (`game/act-rooms-113c.ts`).
- `ROOM_SpawnPresetUnits113c` `0x6FD01430`, `ROOM_SpawnPresetUnit113c` `0x6FD013B0`,
  `SUNIT_CreatePresetUnit113c` `0x6FD012D0`, `OBJECTS_InitPresetQuestObject113c` `0x6FC55E50`
  (`game/room-presets-113c.ts`).
- `OBJECTS_PopulateRoom113c` `0x6FC4F0D0`, `OBJECTS_CanPopulateRoom113c` `0x6FC4EEA0`
  (`game/objects-populate-113c.ts`; spawner table `0x6FD2E190`, entry 3 = Lane G `0x6FC52CE0`), and
  `OBJECTS_SpawnRandomObjectInRoom113c` `0x6FC51E20` (the per-object game-seed step: 2 of the 509 at F151).
- `REGPOP_PopulateRoomMonsters113c` `0x6FC67A20` (Lane G, rarity dispatch fixed in db0aefc1).

Still open: `0x6FC400E0`, `0x6FC4EAD0`, the other 8 object spawners of `0x6FD2E190`, object init / placement (`0x6FC4F300`, `0x6FD00F40`), monster/object creation
(`0x6FC67CF0`, `0x6FD01D90`, `MONSTER_Create` `0x6FD0EF10`), and the D2Common activation of the
`D2RoomExStrc`s that the F2 boot snapshot does not contain.

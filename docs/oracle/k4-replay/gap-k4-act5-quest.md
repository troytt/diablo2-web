# K4 quest replay coverage & runtime execution gap list: k4-act5-quest

Source: `tests/fixtures/oracle/k4/k4-act5-quest.coverage.ndjson.gz` (function-entry coverage of the
original 1.13c D2Game.dll + D2Common.dll under headless Wine `d2host-113c.exe`, frames F1..F140,
652/4810 manifest entries hit, 0 traps on other threads) vs live TS `va-trace-113c`
execution across `F2` snapshot hydration + `F3..F140` quest replay (`replay-113c.ts` + `k4-quest-replay-113c.ts`).

- **`preBootGap` (`F1..F2`, `firstFrame <= 2`)**: DLL functions entered before `snap-f002.ndjson.gz` was captured whose town rooms/presets are already materialized at `F2`.
- **`steppedRuntimeExecGap` (`F3..F140`, `firstFrame >= 3`)**: DLL functions first entered during the stepped replay window (**`0` across both `D2Common` and `D2Game`**).

| Module | DLL executed | TS executed (`dll ∩ ts`) | TS total hit | manifest unported | `preBootGap` (`F1..F2`) | `preBootGap` bytes | `steppedRuntimeExecGap` (`F3+`) | `steppedRuntimeExecGap` bytes | total `runtimeExecGap` (`dll - ts`) | total gap bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| D2Common | 329 | 309 / 329 | 459 | 0 | 20 | 1826 | 0 | 0 | 20 | 1826 |
| D2Game | 323 | 292 / 323 | 386 | 0 | 31 | 9979 | 0 | 0 | 31 | 9979 |

## D2Common Manifest Unported (0)

| first | VA | size | status | name |
|---:|---|---:|---|---|

## D2Game Manifest Unported (0)

| first | VA | size | status | name |
|---:|---|---:|---|---|

## D2Common Stepped Runtime Execution Gap (`F3..F140`, `firstFrame >= 3`) — (0)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|

## D2Game Stepped Runtime Execution Gap (`F3..F140`, `firstFrame >= 3`) — (0)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|

## D2Common Pre-Boot Snapshot Gap (`F1..F2`, `firstFrame <= 2`) — (20)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|
| F2 | `0x6FD59DD0` | 13 | diff-verified | DRLGPRESET_MovePointerAndClear |
| F2 | `0x6FD7FED0` | 89 | diff-verified | UNITS_InitStaticPathCoords |
| F2 | `0x6FD80050` | 137 | diff-verified | PATH_GetTargetTypeAndPosition |
| F2 | `0x6FD80EE0` | 129 | diff-verified | UNITS_GetUnitSizeY |
| F2 | `0x6FD81850` | 102 | diff-verified | UNITS_SetCollisionMaskAtCoords |
| F2 | `0x6FD83CA0` | 33 | diff-verified | UNITS_GetStateFlagsPtr |
| F2 | `0x6FD87EC0` | 78 | diff-verified | STATLIST_GetStatListFromUnitStateAndFlag |
| F2 | `0x6FD883C0` | 73 | diff-verified | STATLIST_CopyBaseStatsToBuffer |
| F2 | `0x6FD8B3F0` | 68 | diff-verified | DUNGEON_SetRoomFlag2 |
| F2 | `0x6FD8BF60` | 70 | diff-verified | DUNGEON_HasRoomExWaypointFlags |
| F2 | `0x6FD8C020` | 78 | diff-verified | DUNGEON_AcquireRoomExDT1Mask |
| F2 | `0x6FD9AA90` | 197 | diff-verified | COLLISION_SplitClipRectByRoomBounds |
| F2 | `0x6FD9AC40` | 145 | diff-verified | COLLISION_CheckMaskForBoundingBox |
| F2 | `0x6FD9B3F0` | 147 | diff-verified | COLLISION_GetCombinedMaskForBoxRecursively |
| F2 | `0x6FD9B510` | 66 | diff-verified | COLLISION_GetMaskAt |
| F2 | `0x6FD9B840` | 163 | diff-verified | COLLISION_SetMaskWithSizeXY |
| F2 | `0x6FD9C080` | 119 | diff-verified | COLLISION_CheckMaskWithSizeXY |
| F2 | `0x6FDB6900` | 20 | diff-verified | UNITROOM_SortUnitListByY |
| F2 | `0x6FDBCCC0` | 44 | diff-verified | DATATBLS_GetLevelsTxtRecord |
| F2 | `0x6FDD4C30` | 55 | diff-verified | UNITS_GetMonStats2ComponentChoice |

## D2Game Pre-Boot Snapshot Gap (`F1..F2`, `firstFrame <= 2`) — (31)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|
| F1 | `0x6FC4CBE0` | 304 | diff-verified | GAME_UpdateActRooms |
| F2 | `0x6FC21280` | 155 | diff-verified | ROOM_FindRoomContainingSubtile |
| F2 | `0x6FC218A0` | 59 | diff-verified | MONSTER_GetBaseIdFromUnit |
| F2 | `0x6FC3E960` | 184 | diff-verified | MONREG_FindOrAllocActRoomNode |
| F2 | `0x6FC3EA40` | 173 | diff-verified | MONREG_UnlinkAndFreeActRoomNode |
| F2 | `0x6FC3FB40` | 75 | diff-verified | MONREG_FlushAndFreePendingSpawnNodes |
| F2 | `0x6FC3FB90` | 1352 | diff-verified | MONREG_RestoreRoomMonstersFromNode |
| F2 | `0x6FC400E0` | 739 | diff-verified | ROOM_RefreshUnitsAndLoadSaved |
| F2 | `0x6FC40DE0` | 31 | diff-verified | AIGENERAL_GetQuestDataPtr38 |
| F2 | `0x6FC4EEA0` | 161 | diff-verified | OBJECTS_CanPopulateRoom |
| F2 | `0x6FC4F0D0` | 545 | diff-verified | OBJECTS_PopulateRoom |
| F2 | `0x6FC54130` | 445 | diff-verified | QUESTS_FindFreeSubtileInRoomRings_6FC54130 |
| F2 | `0x6FC55E50` | 50 | diff-verified | OBJECTS_InitPresetQuestObject |
| F2 | `0x6FC57810` | 69 | diff-verified | QUESTS_CountLivingUnitsInRoomCallback |
| F2 | `0x6FC579A0` | 59 | diff-verified | GAME_GetEffectivePlayerCount |
| F2 | `0x6FC67A20` | 711 | diff-verified | REGPOP_PopulateRoomMonsters |
| F2 | `0x6FC76CE0` | 1 | diff-verified | ACT5_InitObjectNoop_6FC76CE0 |
| F2 | `0x6FC7A5C0` | 201 | diff-verified | ACT5Q1_InitPresetQuestObject21F_6FC7A5C0 |
| F2 | `0x6FC7C3A0` | 218 | diff-verified | ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0 |
| F2 | `0x6FC8B200` | 123 | diff-verified | OBJECT_SyncStateAndEventsToClient |
| F2 | `0x6FC9A940` | 783 | diff-verified | UNIT_SendAllStatesBitstreamToClient |
| F2 | `0x6FC9B0A0` | 1042 | diff-verified | UNIT_SendFullUnitSyncToClient |
| F2 | `0x6FCACA20` | 1364 | diff-verified | D2GAME_PACKET_SendMonsterAssign |
| F2 | `0x6FCAD670` | 146 | diff-verified | D2GAME_PACKET_Send0x73MissileSync |
| F2 | `0x6FCCF5D0` | 23 | diff-verified | MONSTER_GetPlayerCountHpBonusPct |
| F2 | `0x6FCCF5F0` | 20 | diff-verified | MONSTER_GetPlayerCountExpBonusPct |
| F2 | `0x6FCCF610` | 53 | diff-verified | D2GAME_MONSTER_HasComponentChoices |
| F2 | `0x6FCCF920` | 241 | diff-verified | MONSTER_ScheduleInitialAiEvent |
| F2 | `0x6FD012D0` | 222 | diff-verified | SUNIT_CreatePresetUnit |
| F2 | `0x6FD013B0` | 119 | diff-verified | ROOM_SpawnPresetUnit |
| F2 | `0x6FD01430` | 311 | diff-verified | ROOM_SpawnPresetUnits |

## Executed ported/diff-verified functions on an impure kernFile (0)

| first | module | VA | size | status | name | kernFile |
|---:|---|---|---:|---|---|---|

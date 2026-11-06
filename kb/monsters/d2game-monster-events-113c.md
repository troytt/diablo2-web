# D2Game 1.13c Monster Event Dispatch (`0x6FC969A0`), Mode Tables (`0x6FD1A498` / `0x6FD1BC50`), and Continuous Mode Registration (`0x6FD00B40`)

Binary-authoritative reference for `D2Game.dll` v1.13c (image base `0x6FC20000`) monster partition event dispatch, mode handler tables, freeze guard, and persistent continuous-mode (`WL` / `KB` / `SQ` / `RN`) event registration.

Isomorphic TypeScript kernel implementation: [`src/d2kern-113c/game/monster-events.ts`](../../src/d2kern-113c/game/monster-events.ts).

---

## 1. Monster Event Dispatcher `MONSTER_DispatchEvent` (`0x6FC969A0`)

### 1.1 Calling Convention & Signature

Invoked from `EVENT_UpdateTimers` (`0x6FCAF070`) when firing an event in partition `1` (`dwUnitType == 1`, `UNIT_MONSTER`):

- `edi`: `D2UnitStrc* pUnit`
- `esi`: `int nEventType` (`D2EventStrc.nType`, `0..14`)
- `[esp + 0x04]`: `D2GameStrc* pGame`
- `[esp + 0x08]`: `uint32_t dwArg14` (`D2EventStrc.dwArg14`)
- `[esp + 0x0C]`: `uint32_t dwArg18` (`D2EventStrc.dwArg18`)
- Return: `ret 0xC` (void)

### 1.2 Branch-by-Branch Pseudocode (`0x6FC969A0..0x6FC96A0A`)

```c
void MONSTER_DispatchEvent(
    D2UnitStrc* pUnit /*edi*/,
    int nEventType    /*esi*/,
    D2GameStrc* pGame,
    uint32_t dwArg14,
    uint32_t dwArg18)
{
    if (nEventType < 0 || nEventType >= 15) {
        return; // 0x6FC969A0..0x6FC969A7
    }

    // Freeze guard jump table (`0x6FC969F8` + index table `0x6FC96A00[nEventType - 3]`):
    // Event types {3, 4, 5, 8, 12} bypass the STATE_FREEZE check!
    // Event types {0, 1, 2, 6, 7, 9, 10, 11, 13, 14} check STATE_FREEZE (state 1).
    if (!IS_FREEZE_BYPASS_EVENT(nEventType)) {
        if (D2Common_10494_STATES_CheckState(pUnit, 1 /*STATE_FREEZE*/) != 0) {
            // 0x6FC969C7: frozen units skip live events, EXCEPT dead/dying units
            // (`SUNIT_IsDeadOrDying` `0x6FCFFA90`), allowing frozen `DT -> DD` (`Event 1`) to complete!
            if (SUNIT_IsDeadOrDying(pUnit) == 0) {
                return;
            }
        }
    }

    // 0x6FC969D4: handler table `0x6FD1BC14[nEventType]`
    MonsterEventFn pfn = g_apfnMonsterEvents_6FD1BC14[nEventType];
    if (pfn != NULL) {
        // __fastcall(ecx = pGame, edx = pUnit, [esp+4] = dwArg14, [esp+8] = dwArg18)
        pfn(pGame, pUnit, dwArg14, dwArg18);
    }
}
```

### 1.3 Freeze Guard Table (`0x6FC969F8` / `0x6FC96A00`)

`lea eax, [esi - 3]; cmp eax, 9; ja check_freeze; movzx eax, byte ptr [eax + 0x6FC96A00]; jmp dword ptr [eax*4 + 0x6FC969F8]`

- `0x6FC96A00[0..9]` (for `nEventType = 3..12`): `[0, 0, 0, 1, 1, 0, 1, 1, 1, 0]`
- `[0x6FC969F8 + 0] = 0x6FC969D4` (bypass freeze check -> dispatch immediately)
- `[0x6FC969F8 + 4] = 0x6FC969BA` (run `STATES_CheckState(pUnit, 1)`)

| `nEventType` | Freeze Guard Behavior |
|---|---|
| `0, 1, 2, 6, 7, 9, 10, 11, 13, 14` | Checked: blocked if `STATE_FREEZE` (`1`) is active AND `!SUNIT_IsDeadOrDying(pUnit)` |
| `3, 4, 5, 8, 12` | **Bypassed**: always dispatches even while frozen (notably `Event 3` HP regen / poison DoT) |

### 1.4 Handler Table `0x6FD1BC14[0..14]`

| `nEventType` | Handler VA | Symbol / Role |
|---:|---|---|
| `0` | `0x6FC952E0` | `MONSTER_Event0_ModeStep` (continuous `WL`/`KB`/`SQ`/`RN` step or timed anim keyframe) |
| `1` | `0x6FC952A0` | `MONSTER_Event1_ModeEnd` (`DT -> DD` `0x6FC96040`, one-shot `-> NU` `0x6FC96BF0`, etc.) |
| `2` | `0x6FCBD3B0` | `AI_RunMonsterAI` (validates `pMonsterData->pAiGeneral` and dispatches `pfnThink`) |
| `3` | `0x6FC96740` | `MONSTER_Event3_HpRegen` (`DamageRegen`, poison, Open Wounds per-frame tick) |
| `4` | `0x00000000` | `NULL` (no-op) |
| `5` | `0x6FCBE8E0` | `MONSTER_Event5_Timed` |
| `6` | `0x6FC96570` | `MONSTER_Event6_UnsummonOrExpire` |
| `7` | `0x6FC469B0` | `MONSTER_Event7_ConvertEnd` |
| `8` | `0x6FCC1E80` | `MONSTER_Event8_AuraPulse` |
| `9` | `0x6FCC37D0` | `MONSTER_Event9_BossEvent` |
| `10` | `0x6FC94E40` | `MONSTER_Event10_Timed` |
| `11` | `0x00000000` | `NULL` (no-op) |
| `12` | `0x6FC94870` | `MONSTER_Event12_Destroy` |
| `13` | `0x00000000` | `NULL` (no-op) |
| `14` | `0x00000000` | `NULL` (no-op) |

---

## 2. `SUNIT_IsDeadOrDying` (`0x6FCFFA90`)

- `eax`: `D2UnitStrc* pUnit`
- Checks:
  1. `pUnit == NULL` -> **`1`** (`0x6FCFFA93: mov eax, 1; ret` — null units are treated as dead/invalid).
  2. `test byte ptr [eax + 0xC6], 0x01` (`pUnit->dwFlags & 0x00010000`, `UNITFLAG_DEAD`) -> `1`.
  3. `pUnit->dwUnitType == 0` (`UNIT_PLAYER`): `dwAnimMode == 0` (`PLRMODE_DEATH (0)`) or `dwAnimMode == 17` (`PLRMODE_DEAD (17)`) -> `1`, else `0`.
  4. `pUnit->dwUnitType == 1` (`UNIT_MONSTER`): `dwAnimMode == 0` or `dwAnimMode == 12` (`MONMODE_DEATH (0) / MONMODE_DEAD (12)`) -> `1`, else `0`.
  5. All other unit types (`object`, `missile`, `item`, `tile`, `dwUnitType > 1`) -> **`1`** (`0x6FCFFAAD: mov eax, 1; ret`).

---

## 3. Monster Mode Table (`0x6FC949A0` -> `0x6FD1A498`) & Continuous Mode Table (`0x6FC94F20` -> `0x6FD1BC50`)

### 3.1 `MONSTER_GetModeEntry` (`0x6FC949A0`)

- Signature: `(ecx = D2UnitStrc* pUnit, eax = int nMode)` -> returns `const D2MonModeEntry*` (`16` bytes: `{+0x00 pfnStart, +0x04 pfnStep, +0x08 pfnEnd, +0x0C bScheduleEvents}`).
- Validates `pUnit != NULL && pUnit->dwUnitType == 1`, `0 <= dwClassId < nMonStatsTxt (734)`, `0 <= nMode < 16`.
- First checks `MonStats[dwClassId].bSplGetModeChart (+0x1A5) != 0` (`0x6FC949E7`, non-zero on 20 `hcIdx` rows: `{243, 333, 403, 404, 417, 418, 543, 544, 546, 547, 548, 549, 550, 559, 570, 571, 572, 573, 705, 709}`); when `0`, jumps straight to `&g_aMonModeTable_6FD1A498[nMode]`. When non-zero, checks class-specific jump-table overrides (`0x6FC949F6..0x6FC94A89`), falling back to `&g_aMonModeTable_6FD1A498[nMode]`:
  - `dwClassId in {243, 333, 705}` (Diablo): `nMode == 11` (`S4`) -> `0x6FD1A598` (`{0x6FC95510, 0x6FC95CE0, 0x6FC96BF0, 1}`); `nMode == 10` (`S3`) -> `0x6FD1A5A8` (`{0x6FC95510, 0x6FC95CE0, 0x6FC96BF0, 1}`)
  - `dwClassId == 403` (`trappedsoul1`): `nMode in {4, 5}` (`A1`/`A2`) -> `0x6FD1A5B8` (`{0x6FC95510, 0x6FC95CE0, 0x6FC96B20, 1}`); `nMode in {8, 9}` (`S1`/`S2`) -> `0x6FD1A5C8` (`{0x6FC95510, 0x6FC95CE0, 0x6FC96A50, 1}`)
  - `dwClassId in {417, 418}` (Shadow Warrior / Master): `nMode == 11` (`S4`) -> `0x6FD1A5D8` (`{0x6FC95510, 0x6FC95CE0, 0x6FC96BF0, 1}`)
  - `dwClassId in {543, 544, 570, 709}` (Baal): `nMode == 10` (`S3`) -> `0x6FD1A508` (`{0x6FC95510, 0x6FC95CE0, 0x6FC96BF0, 1}`)

### 3.2 Base Table `0x6FD1A498[0..15]`, Continuous Table `0x6FD1BC50[0..15]`, and Inline-AI End Table `0x6FD2F14C[0..15]`

`MONSTER_IsContinuousMode` (`0x6FC94F20`, `ecx = pUnit`, `eax = nMode`) indexes the 12-byte (`3 * uint32`) table `0x6FD1BC50[nMode]`:
- `d0 == 1` (`{2 WL, 13 KB, 14 SQ, 15 RN}`): unconditionally returns `1`.
- `d1 == 1` (`{0 DT, 1 NU, 3 GH, 6 BL, 12 DD}`): unconditionally returns `0`.
- `d2 == 1` (`{4 A1, 5 A2, 7 SC, 8 S1, 9 S2, 10 S3, 11 S4}`): reads `MonStats2[MonStats[hcIdx].wMonStatsEx].wMoveFlags (+0x104)` (`A1mv..S4mv`) and returns `(wMoveFlags & (1 << nMode)) != 0` (non-zero on 30 `hcIdx` rows such as Vulture `S1`/`S2`, Maggot/SandLeaper/Scarab/SnowDrifter `A2`).

| Mode | Mnemonic | `pfnStart` (`+0x00`) | `pfnStep` (`+0x04`, Event 0) | `pfnEnd` (`+0x08`, Event 1) | `bScheduleEvents` (`+0x0C`) | `0x6FD1BC50[m]` `(d0,d1,d2)` | `inlineAiOnEnd` (`0x6FD2F14C[m]`) |
|---:|---|---|---|---|---:|---|---:|
| `0` | `DT` | `0x6FC96270` | `0x6FC959F0` | `0x6FC96040` | `1` | `(0,1,0)` | `0` |
| `1` | `NU` | `0x6FC94E60` | `0x6FC95320` | `0x00000000` | `0` | `(0,1,0)` | `0` |
| `2` | `WL` | `0x6FC94C60` | `0x6FC97010` | `0x00000000` | `1` | **`(1,0,0)`** | **`1`** |
| `3` | `GH` | `0x6FC95210` | `0x6FC95320` | `0x6FC96BF0` | `1` | `(0,1,0)` | `0` |
| `4` | `A1` | `0x6FC95510` | `0x6FC95CE0` | `0x6FC96BF0` | `1` | `(0,0,1)` | `0` |
| `5` | `A2` | `0x6FC95510` | `0x6FC95CE0` | `0x6FC96BF0` | `1` | `(0,0,1)` | `0` |
| `6` | `BL` | `0x6FC94C10` | `0x6FC95320` | `0x6FC96BF0` | `1` | `(0,1,0)` | `0` |
| `7` | `SC` | `0x6FC95510` | `0x6FC95CE0` | `0x6FC96BF0` | `1` | `(0,0,1)` | `0` |
| `8` | `S1` | `0x6FC95510` | `0x6FC95CE0` | `0x6FC96BF0` | `1` | `(0,0,1)` | `0` |
| `9` | `S2` | `0x6FC95510` | `0x6FC95CE0` | `0x6FC96BF0` | `1` | `(0,0,1)` | `0` |
| `10` | `S3` | `0x6FC94C90` | `0x6FC959B0` | `0x6FC94890` | `0` | `(0,0,1)` | `0` |
| `11` | `S4` | `0x6FC96700` | `0x6FC95320` | `0x00000000` | `0` | `(0,0,1)` | `0` |
| `12` | `DD` | `0x6FC95460` | `0x6FC95320` | `0x00000000` | `0` | `(0,1,0)` | `0` |
| `13` | `KB` | `0x6FC95160` | `0x6FC96A10` | `0x6FC965E0` | `1` | **`(1,0,0)`** | `0` |
| `14` | `SQ` | `0x6FC954E0` | `0x6FC96F20` | `0x6FC96BF0` | `1` | **`(1,0,0)`** | `0` |
| `15` | `RN` | `0x6FC94C30` | `0x6FC96FE0` | `0x00000000` | `1` | **`(1,0,0)`** | **`1`** |

- `MONSTER_Event0_ModeStep` (`0x6FC952E0`): looks up `entry = MONSTER_GetModeEntry(pUnit, pUnit->dwAnimMode)`. Calls `entry->pfnStep` if non-null, else `0x6FC950F0` (calls `D2Common.#11103(pUnit, 0)` `0x6FD803E0`; if `mode != 0 && mode != 12 && SUNIT_IsDeadOrDying(pUnit)`, returns `1`; else forces `MONMODE_NEUTRAL (1)` via `0x6FC94E60`).
- `MONSTER_ClearStepEvents` (`0x6FC95320`): `pfnStep` for `NU`, `GH`, `BL`, `S4`, `DD`; frees all `nType == 0` (`MODE_STEP`, `0x6FC95332: cmp byte ptr [eax], 0`, no `pfnHandler` check) nodes on `pUnit` via `0x6FCAE6F0`.
- `MONSTER_StepWalk` (`0x6FC97010`) / `MONSTER_StepRun` (`0x6FC96FE0`): calls `MONSTER_StepPath` (`0x6FD01930` -> `D2Common_10226(pUnit, 0x400)`). When path completion returns `eax == 2`, calls `MONSTER_EndToAiOrNeutral` (`0x6FC96BF0`) inline. For `0x6FD2F14C[mode] == 1` (`WL=2, RN=15`), `0x6FC96E3D` sets `pUnit->dwAnimMode = 1` (`NU`) via `D2Common.#10348` **without** `MONSTER_ClearModeEvents` and immediately calls `AI_RunMonsterAI` (`0x6FCBD3B0`) inline. If AI stalls (`0x6FD122C0`), `dwAnimMode == 1` skips `MONSTER_StartMode(1)`, leaving persistent `Event 0` to fire one final cleanup frame via `0x6FC95320`.
- `MONSTER_Event1_ModeEnd` (`0x6FC952A0`): looks up `entry = MONSTER_GetModeEntry(pUnit, pUnit->dwAnimMode)`. Calls `entry->pfnEnd` if non-null, else `0x6FC950F0` (`D2Common.#11103` + `0x6FC94E60` neutral fallback).

---

## 4. Mode Event Lifecycle in `MONSTER_ChangeMode` (`0x6FC95E10`)

Resolves §7 open item of [`d2game-event-wheel-and-room-units-113c.md`](../engine/d2game-event-wheel-and-room-units-113c.md):

1. `MONSTER_ClearModeEvents` (`0x6FD00750`, `eax = pGame`, `ebx = pUnit`): runs **two separate `nType`-only passes** (`0x6FCAE6F0`, no `pfnHandler` check, equivalent to `EVENT_DeleteEventByArg14` with `arg14 = 0`) — first `nType == 0` (`0x6FD00762`), then `nType == 1` (`0x6FD00780`) — preserving `nType == 2` AI and `nType == 3` regen timers while matching `D2Game.dll` chunk free-list order.
2. Updates `pUnit->dwAnimMode` and invokes `entry->pfnStart`.
3. If `entry->bScheduleEvents != 0` (`0x6FC95EC2`):
   - Calls `MONSTER_IsContinuousMode` (`0x6FC94F20`, checks `0x6FD1BC50[mode]` + `MonStats2.wMoveFlags`):
     - **Continuous (`WL=2, KB=13, SQ=14, RN=15`, or `MonStats2.wMoveFlags & (1 << mode)`)**: calls `MONSTER_RegisterContinuousModeEvent` (`0x6FD00B40`, `eax = pGame`, `[esp+4] = pUnit`), which frees any remaining `nType == 0` node on `pUnit` and **inlines** `EVENT_SetPersistentEvent` (`0x6FCAE680` + `fFlags |= 0x04`, `nType = 0`, `dwFrame = 0xFFFFFFFF`, LIFO head-insert at `pTimer->pPersistentHead[1]`). Note that standalone wrappers `0x6FCAE940` and `0x6FCAE960` wrap `0x6FCAE810` directly, while `MONSTER_ChangeMode` uses the inlined `0x6FD00B40` helper.
     - **Timed (`DT=0, GH=3, A1=4, A2=5, BL=6, SC=7, S1=8, S2=9`)**: calls `0x6FCFF7B0` to schedule `AnimData.d2` action keyframe (`nType = 0`) and animation end (`nType = 1`, `dwArg14 = 0`) into the 64-slot FIFO wheel (`0x6FCAEA80`).

---

## 5. `AI_RunMonsterAI` (`0x6FCBD3B0`)

- Checks `pUnit != NULL && pUnit->dwUnitType == 1`.
- Reads `pMonsterData = pUnit->pUnitData (+0x14)`; returns if `NULL` or `pMonsterData->pAiGeneral (+0x28) == NULL`.
- Validates `MonStats.txt` (`sgptDataTables + 0xA78`) and `MonStats2.txt` (`+0xA80`) rows for `pUnit->dwClassId`.
- Runs `0x6FCBCD90` (minion/party check), `0x6FCBD160` (`aidist` dormancy skip tick for `dwAiFlag == 1`), `0x6FCBCFE0` (`D2AiTickParamStrc` target/distance/melee-range builder), then calls `pAiGeneral->pfnThink (+0x04)`.

---

## 6. Struct Read/Write & RNG Consumption Summary

| Function | VA | Reads | Writes | PRNG Draws |
|---|---|---|---|---:|
| `EVENT_SetPersistentEventWithHandler` | `0x6FCAE940` | `pGame->pTimer`, `pUnit->{dwUnitType,dwUnitId,pEventFirst}` | `D2EventStrc`, `pUnit->pEventFirst`, `pTimer->pPersistentHead[part]` | `0` |
| `EVENT_SetPersistentUnitEvent` | `0x6FCAE960` | same as `0x6FCAE940` (`pfnHandler = 0`) | same as `0x6FCAE940` | `0` |
| `MONSTER_ClearModeEvents` | `0x6FD00750` | `pUnit->pEventFirst`, `D2EventStrc.nType` | unlinks/frees `nType in {0, 1}` | `0` |
| `MONSTER_RegisterContinuousModeEvent` | `0x6FD00B40` | `pGame->pTimer`, `pUnit->pEventFirst` | frees `nType == 0`, LIFO head-inserts persistent `nType = 0` | `0` |
| `SUNIT_IsDeadOrDying` | `0x6FCFFA90` | `pUnit->{dwUnitType,dwAnimMode,dwFlags}` | none | `0` |
| `MONSTER_GetModeEntry` | `0x6FC949A0` | `pUnit->dwClassId`, `0x6FD1A498` | none | `0` |
| `MONSTER_IsContinuousMode` | `0x6FC94F20` | `0x6FD1BC50[mode]` | none | `0` |
| `MONSTER_Event0_ModeStep` | `0x6FC952E0` | `pUnit->{dwClassId,dwAnimMode}` | delegates to `entry->pfnStep` | handler-dependent |
| `MONSTER_Event1_ModeEnd` | `0x6FC952A0` | `pUnit->{dwClassId,dwAnimMode}` | delegates to `entry->pfnEnd` | handler-dependent |
| `MONSTER_DispatchEvent` | `0x6FC969A0` | `STATE_FREEZE (1)`, `SUNIT_IsDeadOrDying`, `0x6FD1BC14` | delegates to `0x6FD1BC14[nEventType]` | `0` in dispatcher |

# Per-Frame `Event 3` (`EVENT_STATREGEN`) & `PLAYER_UpdateHpRegen` DoT / Life Regen Pipeline — Diablo II v1.13c

Authoritative reverse-engineering specification for per-frame `stat 6` (`hitpoints`, `<< 8` fixed point) ticks that bypass `SUNITDMG_CalcDamageResists` (`0x6FCFC0B0`), covering monster `Event 3` (`MONSTER_Event3_HpRegen`), player `Event 3` (`PLAYER_Event3_StatRegen` -> `PLAYER_UpdateHpRegen`), poison application (`SUNITDMG_ApplyDamage` + `SUNITDMG_ApplyPoison`), `Poison Nova` (`SrvDo022` + `MISSILE_FillDamageStats`), and the `d2oracle/1` `"dot"` trace hook.

- **Binaries**: `D2Game.dll` (`0x6FC20000`), `D2Common.dll` (`0x6FD50000`) in `samples/d2/`
- **MPQ tables**: `States.txt` (`life` column), `MonStats.txt` (`DamageRegen`), `Skills.txt` (`#92 Poison Nova`), `Missiles.txt` (`#118 poisonnova`), `ItemStatCost.txt` (`#6 hitpoints`, `#74 hpregen`)
- **TypeScript implementation**:
  - [`src/server/engine/statregen-dot-113c.ts`](../../src/server/engine/statregen-dot-113c.ts)
  - [`src/server/engine/game-instance/pvp-and-monster-locomotion.ts`](../../src/server/engine/game-instance/pvp-and-monster-locomotion.ts) (`stepMonsterRegen`)
  - [`src/server/engine/game-instance/player-combat-and-vitals.ts`](../../src/server/engine/game-instance/player-combat-and-vitals.ts) (`stepPlayerVitals`)
  - [`src/server/engine/game-instance/monster-damage.ts`](../../src/server/engine/game-instance/monster-damage.ts) (`applyMonsterPoisonDot`, `finishMonsterDamage`)
  - [`tools/oracle/hook/d2oracle.c`](../../tools/oracle/hook/d2oracle.c) (`dot_setstat_hook`)

---

## 1. Frame Timer Partition & FIFO Execution Order (`EVENT_UpdateTimers` `0x6FCAF070`)

`GAME_UpdateGameFrame` (`0x6FC4E050`) advances `pGame->dwGameFrame` (`+0xA8`) and dispatches due timer wheel buckets (`dwGameFrame & 0x3F`) via `EVENT_UpdateTimers` (`0x6FCAF070`):

1. **Partition order**: `unitType 3` (Missiles) -> `unitType 0` (Players) -> `unitType 1` (Monsters) -> `unitType 2` (Objects) -> `unitType 4` (Items).
2. **FIFO bucket insertion (`EVENT_SetEvent` `0x6FCAEA80`)**: new event nodes append to the tail of `(expireFrame & 0x3F)`.
   - When a poison state (`state 2`) is applied on frame `F` with duration `D`, `Event 12` (`STATES_Expire`) is queued for `F + D` on frame `F`, whereas `Event 3` (`MONSTER_Event3_HpRegen`) is re-queued one frame at a time (`F + D - 1 -> F + D`). Consequently, on frame `F + D`, `Event 12` fires **before** `Event 3`, clearing `state 2` before `MONSTER_Event3_HpRegen` evaluates `#10372` and `stat 74`.
   - Across multiple monsters with due `Event 3` timers on the same frame, `MONSTER_Event3_HpRegen` runs in the exact FIFO order their `Event 3` nodes were scheduled on `F - 1` (`allocateEvent3Seq113c`).

---

### 1.1 `Event 3` re-arm after damage (`SUNITDMG_ApplyDamage` `0x6FCFE2E2..0x6FCFE335`)

For a surviving monster defender with `dwDmgTotal > 0` and a non-zero accrued `stat 74`, the pending
`Event 3` timers are deleted and `Event 3` is re-queued at `dwGameFrame + 1`. This applies to every damage
source: player hits, merc missiles and 1:1 pet melee. TS: `armMonsterEvent3AfterDamage113c`
(`monster-damage.ts`), called from the player, `hireable-ai-113c.ts` missile and `necropet-ai-113c.ts`
melee paths.

## 2. Monster Base `stat 74` Initialization (`MONSTER_InitStats` `0x6FCD00ED..0x6FCD011C`)

During monster spawn (`MONSTER_InitStats` `0x6FCCFF90`), base `stat 74` (`hpregen`) is derived from `maxHp256` (`stat 7`, already shifted `<< 8`) and `MonStats.txt` `DamageRegen` (`+0x19C` in `MonStatsTxt`):

```text
6fcd00ed: test esi, esi                 ; esi = MonStatsTxt.nDamageRegen
6fcd00ef: jle  0x6fcd0110               ; <= 0 -> baseRegen = 0
6fcd00f1: mov  eax, 0x7fffffff
6fcd00f6: cdq
6fcd00f7: idiv esi                      ; eax = 0x7fffffff / dmgRegen
6fcd00f9: cmp  edi, eax                 ; edi = maxHp256
6fcd00fb: jle  0x6fcd0107
6fcd00fd: mov  eax, edi
6fcd00ff: sar  eax, 0xc                 ; (maxHp256 >> 12) * dmgRegen
6fcd0102: imul eax, esi
6fcd0105: jmp  0x6fcd010e
6fcd0107: mov  eax, edi
6fcd0109: imul eax, esi
6fcd010c: sar  eax, 0xc                 ; (maxHp256 * dmgRegen) >> 12
6fcd010e: ...
6fcd0117: call 0x6fc2a472               ; STATLIST_SetUnitStat(pMonster, 74, baseRegen, 0)
```

- **Summoned pet override (`0x6FC669BE`)**: `D2GAME_SummonPet` explicitly executes `STATLIST_SetUnitStat(pPet, 74, 0, 0)`, zeroing innate `damageRegen` on player-summoned pets.
- **RNG draws**: `0`.
- **TS implementation**: [`computeMonsterBaseDamageRegen113c`](../../src/server/engine/statregen-dot-113c.ts).

---

## 3. `D2Common.#10372` Life-Mask State Check (`0x6FD83D80`)

`D2Common.#10372` (`0x6FD83D80`, `STATES_CheckStateMaskLife`) tests the unit's active state bitvec against `sgptDataTables + 0x14C` (`pStateMasks[32]`, populated from `States.txt` column `life == 1`):

| State ID | `States.txt` `state` | `life` | Effect on `MONSTER_Event3_HpRegen` |
|---|---|---|---|
| `2` | `poison` | `1` | Subtracts base `stat 74` (`#10587`), suppressing innate `damageRegen` |
| `52` | `preventheal` | `1` | Subtracts base `stat 74`, and aborts before reschedule if remaining `stat 74 >= 0` |
| `62` | `openwounds` | `1` | Subtracts base `stat 74`, suppressing innate `damageRegen` |

- **TS implementation**: [`LIFE_MASK_STATE_IDS_113C`](../../src/server/engine/statregen-dot-113c.ts), [`hasLifeMaskState113c`](../../src/server/engine/statregen-dot-113c.ts).

---

## 4. `MONSTER_Event3_HpRegen` (`0x6FC96740..0x6FC9698E`)

Calling convention: `__fastcall(pGame = ecx, pMonster = edx, arg_0, arg_4)`, `ret 0x8`.

### Branch-by-Branch Disassembly Walkthrough

1. **Read accrued `stat 74` & apply `#10372` suppression (`0x6FC96746..0x6FC9676E`)**:
   - `0x6FC96753`: `ebx = STATLIST_GetUnitStat(pMonster, 74, 0)` (`#10973`).
   - `0x6FC9675B`: `if (STATES_CheckStateMaskLife(pMonster) != 0)` (`#10372`):
     `0x6FC96769..0x6FC9676E`: `ebx -= STATLIST_GetUnitBaseStat(pMonster, 74, 0)` (`#10587`).
2. **`STATE_PREVENTHEAL` (`52`) positive-heal gate (`0x6FC96770..0x6FC96782`)**:
   - `0x6FC96773`: `if (STATES_CheckState(pMonster, 52) != 0 && ebx >= 0) return;` (no `Event 3` reschedule, no `SetUnitStat`). Negative `ebx < 0` (poison / Open Wounds) continues!
3. **Reschedule `Event 3` & zero-delta prune (`0x6FC96784..0x6FC967D0`)**:
   - `0x6FC96798`: `EVENT_SetEvent(pGame, pMonster, 3, pGame->dwGameFrame + 1, 0, 0)` (`0x6FCAEA80`).
   - `0x6FC9679D..0x6FC967BF`: `if (ebx == 0) { EVENT_DeleteTimers(pGame, pMonster, 3); return; }`.
4. **Town `< 1 HP` survival guard (`0x6FC967D3..0x6FC9680A`)**:
   - `0x6FC967D9`: `edi = STATLIST_GetUnitStat(pMonster, 6, 0)` (`hp0`).
   - `0x6FC967E1`: `ebp = STATLIST_GetMaxLifeFromUnit(pMonster)` (`maxHp256`, `#10564`).
   - `0x6FC967E6..0x6FC9680A`: if `ebx < 0` and `edi < 0x100` (`256`), queries `pRoom = UNITS_GetRoom(pMonster)` (`#10331`); if `pRoom == NULL` or `DUNGEON_IsRoomInTown(pRoom) != 0` (`#10057`), returns immediately without modifying `stat 6` (`Event 3` stays scheduled for `dwGameFrame + 1`).
5. **Clamp, `STATLIST_SetUnitStat` hook site, & wilderness death (`0x6FC96810..0x6FC9698E`)**:
   - `0x6FC96810..0x6FC9683B`: `edi += ebx`; if `edi > ebp`, calls `EVENT_DeleteTimers(pGame, pMonster, 3)` (`0x6FCAE6F0`) and clamps `edi = ebp`.
   - `0x6FC9683D..0x6FC96842`: `if (edi < 1) edi = 0;` — note the threshold is **`< 1` (`<= 0`)**, unlike direct hits in `SUNITDMG_ApplyDamage` (`0x6FCFE255`, `< 0x100`), so `1..255` (`< 1` whole HP) survives until a subsequent `Event 3` tick drives `edi <= 0`!
   - **`0x6FC9684A` (Oracle `dot` Hook Site #1)**: `call 0x6FC2A472` -> `STATLIST_SetUnitStat(pMonster, 6, edi, 0)` (`#10887`).
   - `0x6FC968BD..0x6FC96986`: if `edi == 0` and `pMonster->dwMode` (`+0x10`) is neither `0` (`DT`) nor `12` (`DD`), resolves the killer from active `StatList` state `2` (`poison`) or `62` (`openwounds`) (`0x6FC968E3..0x6FC96939`); if `STATE_UNINTERRUPTABLE` (`54`) is active (`0x6FC9693F`), sets `STATE_DEATH_DELAY` (`92`), otherwise kills the monster via `SUNITDMG_KillMonster` (`0x6FCFEEF0` / `0x6FCFEEE0`) and dispatches kill events `0x0A` / `0x09`.
- **RNG draws**: `0` on non-lethal ticks; standard `SUNITDMG_KillMonster` drop/death draws on `pGame->pGameSeed` when `edi == 0` transitions the monster into `mode 0`.
- **TS implementation**: [`stepMonsterEvent3HpRegen113c`](../../src/server/engine/statregen-dot-113c.ts) & [`stepMonsterRegen`](../../src/server/engine/game-instance/pvp-and-monster-locomotion.ts).

---

## 5. `PLAYER_Event3_StatRegen` (`0x6FC99B10`) & `PLAYER_UpdateHpRegen` (`0x6FC97CB0`)

`PLAYER_Event3_StatRegen` (`0x6FC99B10..0x6FC99B81`) reschedules player `Event 3` every frame (`dwGameFrame + 1`) and skips vitals updates when `dwMode == 0` (`PLRMODE_DEATH`) or `dwMode == 17` (`PLRMODE_DEAD`); otherwise it calls `PLAYER_UpdateHpRegen` (`0x6FC97CB0`, `eax = pPlayer`):

```text
6fc97cba: call 0x6fc2a42a               ; ebx = STATLIST_GetUnitStat(pPlayer, 74, 0)
6fc97cc1: test ebx, ebx
6fc97cc3: je   0x6fc97d86               ; stat 74 == 0 -> return without SetUnitStat
6fc97ccf: call 0x6fc2a42a               ; edi = STATLIST_GetUnitStat(pPlayer, 6, 0)
6fc97cd7: call 0x6fc2a3a0               ; eax = STATLIST_GetMaxLifeFromUnit(pPlayer)
6fc97cdc: add  edi, ebx                 ; edi = hp0 + hpRegen256
6fc97cde: cmp  edi, eax
6fc97ce0: jle  0x6fc97cff
6fc97ce5: mov  edi, eax                 ; clamp to maxHp256 & remove state 100 (healthpot)
...
6fc97cff: cmp  edi, 0x100
6fc97d05: jge  0x6fc97d0c
6fc97d07: mov  edi, 0x100               ; clamp negative poison/drain at 256 (1.0 HP)
6fc97d12: call 0x6fc2a472               ; STATLIST_SetUnitStat(pPlayer, 6, edi, 0) <-- Hook Site #2
```

- Players have **no** innate `maxHp` life regeneration; only `stat 74` (`item_replenish_life`, Prayer/Cleansing/Meditation aura `+hpregen`, healing potion `state 100`, or poison `-poisonBitrate256`) modifies HP here, and negative `stat 74` never drops player life below `0x100` (`256` = `1 HP`) in town or wilderness.
- **RNG draws**: `0`.
- **TS implementation**: [`stepPlayerUpdateHpRegen113c`](../../src/server/engine/statregen-dot-113c.ts) & [`stepPlayerVitals`](../../src/server/engine/game-instance/player-combat-and-vitals.ts).

---

## 6. Poison Application (`0x6FCFE1EC..0x6FCFE342`, `0x6FCFCAB0`) & `Poison Nova` (`SrvDo022` `0x6FC63AA0`)

1. **`SKILLS_SrvDo022_NovaAttack` (`0x6FC63AA0..0x6FC63B58` -> `sub_6FCC2800` `0x6FCC2800`)**:
   - Evaluates `Skills.txt` `calc1` as `velDelta` (`0` on `#92 Poison Nova`) and spawns **64** radial `srvmissilea` (`#118 poisonnova`, `CollideKill = 1`, `NextHit = 1`, `NextDelay = 4`) missiles across the 64-entry ring tables at `0x6FD1B870` (`[30, 29, 29, 28, ...]` -> `[esp+0x28]` = `pInit.nTargetX`) and `0x6FD1B770` (`[0, 2, 5, 8, ...]` -> `[esp+0x2c]` = `pInit.nTargetY`).
   - Per-step collision (`PATH_StepMissile` `#10229` -> `COLLISION_CheckMaskWithSize` `#10389` `0x6FDCF6A0`) tests integer sub-tile coordinates (`dwPrecision >> 16`); in `p52-dot-ticks` (`F=880`), bolt `#61` (`i = 60`, `(27, -11)`) steps onto sub-tile `(5664, 5796)` (`|dx| + |dy| = 0 + 1 <= 1` against size-2 zombie `#9` at `(5664, 5795)`).
   - **Spawn RNG draws**: `64` draws on `pGame->pGameSeed` (one unit seed per missile); **zero** damage RNG draws at spawn.
2. **Impact bitrate roll (`MISSILE_FillDamageStats` `0x6FC5A3BA..0x6FC5A400` -> `0x6FC59B40`)**:
   - Reads the missile's `poisonmindam` / `poisonmaxdam` (`<< 8` per-frame bitrate), applies `passive_pois_mastery` (`stat 332`) via `mulDiv113c(pct, v, 100)` (`0x6FC214D0`), and rolls `lo + SEED_RollLimitedRandomNumber(&pMissile->pSeed, hi - lo)` (**1 draw on `pMissile->pSeed`** per impacted target).
3. **1st-frame subtraction & `Event 3` / `Event 12` scheduling (`SUNITDMG_ApplyDamage` `0x6FCFE0C0..0x6FCFE342` + `SUNITDMG_ApplyPoison` `0x6FCFCAB0..0x6FCFCC11`)**:
   - `0x6FCFE242..0x6FCFE264`: `dwDmgTotal` includes `1 * dwPoisDamage`, so `1 * bitrate256` is subtracted immediately on the impact frame (`hp < 0x100 -> 0`).
   - `0x6FCFCB18..0x6FCFCB53` & `0x6FCFE2F4..0x6FCFE335`: deletes any existing `Event 3` on the defender (`0x6FCAE6F0`) and appends a fresh `Event 3` for `dwGameFrame + 1` (`0x6FCAEA80`).
   - `0x6FCFCB58..0x6FCFCC0C`: applies/updates `state 2` (`poison`, modifier `stat 74 = -bitrate256`) and schedules `Event 12` at `dwGameFrame + dwPoisLen` iff `state 2` was not active or `newBitrate >= currentBitrate` (`!jg` at `0x6FCFCBDC`).

---

## 7. Oracle Hook Specification (`tools/oracle/hook/d2oracle.c`)

- **Patched call sites** (`expect = G(0x6FC2A472)` `STATLIST_SetUnitStat` `#10887` import thunk):
  1. `0x6FC9684A` inside `MONSTER_Event3_HpRegen` (`unitType == 1`)
  2. `0x6FC97D12` inside `PLAYER_UpdateHpRegen` (`unitType == 0`)
- **Wrapper**: `dot_setstat_hook(u, stat, val, layer)` reads `hp0 = STATLIST_GetUnitStat(u, 6, 0)` before calling `STATLIST_SetUnitStat(u, stat, val, layer)`; when `stat == 6 && val != hp0`, appends `[type, id, hp0, val]` to `g_dotlog`.
- **Trace schema (`d2oracle/1`)**:
  - Header capability flag: `"dot": true`.
  - Frame key: `"dot": [[type, id, hp0, hp1], ...]` (omitted when empty).
  - Differential comparator (`tools/oracle/lib/trace-diff.ts`): compares `dot` iff `Boolean(oracle.header.dot && replica.header.dot)` (and `opts.compareDot !== false`), preserving 100% backward compatibility with legacy `.oracle.ndjson.gz` goldens recorded without `"dot": true`.
  - Golden verification (`tests/fixtures/oracle/golden/p52-dot-ticks.oracle.ndjson.gz`, `1200/1200` frames zero divergence with `"dot": true`): verifies 19 positive `+1` `damageRegen` ticks on zombie `#10` (`F=789..807`), `#10372` `state 2` suppression of innate `damageRegen`, and 3 negative `-651` poison DoT ticks killing zombie `#9` to `0` HP (`F=881..883`).

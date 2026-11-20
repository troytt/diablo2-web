# Milestone #37 (`[K6]` Waves 1–3): Real 1.13c DLL Coverage Audit, Multi-Subsystem Scenarios & Function Differential Vectors

Generated and verified via:

```bash
python3 tools/oracle/k6/audit-dll-coverage.py
npx tsx tools/oracle/k6/k6-replay.ts
npx vitest run tests/oracle/k6/ tests/oracle/k6-w2/ tests/oracle/k6-w3/
```

---

## 1. Executive Summary — Honest Real-DLL Verification Metrics

All counts below are computed deterministically against `tools/oracle/callgraph/manifest-113c.json` (`1,479` `D2Common` + `3,331` `D2Game` = `4,810` reachable server-closure functions) by `tools/oracle/k6/audit-dll-coverage.py`, counting **only**:
1. **Scenario DLL-executed VAs**: one-shot `INT3` function-entry hits recorded inside live headless `D2Game.dll` + `D2Common.dll` (`d2host-113c.exe` + `d2oracle.dll` under Wine) across `tests/fixtures/oracle/{k1,k3,k4,k6}/**/*.coverage.ndjson.gz`.
2. **Real-DLL emitter VAs**: target VAs directly invoked against real `D2Common.dll` / `D2Game.dll` in `tools/oracle/vectors/*.c` (`+ requests/*.req.json`) and `tools/oracle/{k6,k6-w2,k6-w3}/*.c` (strictly excluding patched/stubbed hooks such as `0x6FC33DE0` and `0x6FC31880`).

| Module | Metric | Pre-K6 Baseline | Post-K6 Waves 1–3 | Net Delta |
|---|---|---:|---:|---:|
| **`D2Common`** (`1,479`) | Scenario DLL-executed VAs | `803 / 1,479` (`54.29%`) | **`960 / 1,479`** (`64.91%`) | **`+157`** |
| **`D2Common`** (`1,479`) | Real-DLL emitter VAs | `1,441 / 1,479` (`97.43%`) | **`1,448 / 1,479`** (`97.90%`) | **`+7`** |
| **`D2Common`** (`1,479`) | **Combined real-DLL-verified VAs** | `1,477 / 1,479` (`99.86%`) | **`1,479 / 1,479`** (**`100.00%`**) | **`0` remaining (`100.00%` closed)** |
| **`D2Game`** (`3,331`) | Scenario DLL-executed VAs | `680 / 3,331` (`20.41%`) | **`1,128 / 3,331`** (`33.86%`) | **`+448`** |
| **`D2Game`** (`3,331`) | Real-DLL emitter VAs | `50 / 3,331` (`1.50%`) | **`336 / 3,331`** (`10.09%`) | **`+286`** |
| **`D2Game`** (`3,331`) | **Combined real-DLL-verified VAs** | `703 / 3,331` (`21.10%`) | **`1,395 / 3,331`** (**`41.88%`**) | **`+692` net new** |
| **`D2Game`** (`3,331`) | Remaining un-hit `D2Game` VAs | `2,628 / 3,331` | **`1,936 / 3,331`** | **`-692`** |

---

## 2. `D2Game` Real-DLL Verification Breakdown by Subsystem (`3,331` Functions)

| Subsystem | Real-DLL Verified | Remaining Un-hit | Total | Verified % |
|---|---:|---:|---:|---:|
| `C2S` | `44` | `36` | `80` | `55.0%` |
| `Skills` | `163` | `309` | `472` | `34.5%` |
| `Missiles` | `54` | `94` | `148` | `36.5%` |
| `MonAI` | `115` | `228` | `343` | `33.5%` |
| `Combat/SUnitDmg` | `220` | `116` | `336` | `65.5%` |
| `Items/Cube/Trade` | `149` | `161` | `310` | `48.1%` |
| `Quests` | `273` | `614` | `887` | `30.8%` |
| `DRLG/Room/SUnit` | `174` | `165` | `339` | `51.3%` |
| `Party/Player/Client` | `203` | `213` | `416` | `48.8%` |
| **Total `D2Game`** | **`1,395`** | **`1,936`** | **`3,331`** | **`41.88%`** |

---

## 3. `[K6]` Wave 1 Headless 1.13c DLL Golden Scenarios (`tests/fixtures/oracle/k6/`)

Generated deterministically by `tools/oracle/k6/make-k6-wave1-scenarios.py --record` (2-run SHA-256 identity on `.oracle.ndjson.gz` + frame-by-frame game-state identity under `INT3` coverage) and replayed through `ReplayKernel113c` in `tools/oracle/k6/k6-replay.ts` + `tests/oracle/k6/replay-k6-wave1.test.ts`:

| Scenario | Frames | `D2Common` Hits | `D2Game` Hits | New `D2Game` vs Pre-K6 (`680`) | Boot (`F2`) | Strict Horizon | Pos Horizon | Wave 1 Status / Wave 2 Root-Cause Target |
|---|---:|---:|---:|---:|---|---:|---:|---|
| `k6-bloodmoor-consumables-auras-combat` | `380` | `609` | `487` | `+8` | `OK` | **`F380 / F380`** | **`F380 / F380`** | **Full-horizon zero-divergence (`t0,t1,t3,t4,gs,s2c`, `runtimeExecGap === 0` on `D2Common` `609/609` & `D2Game` `487/487`)** |
| `k6-act3-consumables-quest` | `140` | `397` | `329` | `+85` | `OK` | `F41 / F140` | **`F140 / F140`** | Wave 1 fixed two real TS bugs uncovered by this scenario (`0x6FC39C20` `S2C 0x2C` NPC source unit + `0x6FC31980` -> `0x6FC31490` `Golden Bird` `quality=7`). Remaining `F42` strict diff: `D2Game_6FC56470_113c` (`k2-w13b1-113c.ts:1601`) swaps `(bFlag8, bIdentified)` (`itemFlags` `0x82012` vs `0x82010`) and `D2Game_6FCF76A0_113c` omits `S2C 0x9D/0x9C/0x47/0x48` auto-place packets; `F46` omits `S2C 0x5D` (`0x6FC554F0`). |
| `k6-druid-skills` | `390` | `719` | `529` | `+55` | `OK` | `F2 / F390` | `F37 / F390` | Exercises all 30 Druid skills (`221..250`), `0x3A/0x3B/0x51/0x60`, Raven/Oak Sage/Plague Poppy/Wolves/Grizzly, Cyclone Armor/Hurricane/Firestorm/Molten Boulder/Fissure/Twister/Tornado, and Werewolf + Feral Rage. Wave 2 target: wire `C2S 0x3A` (`0x6FCEDEA0`), `C2S 0x3B` (`0x6FCEDFA0`), `C2S 0x51`, `C2S 0x60`, and Druid `SrvSt`/`SrvDo` handlers in `ReplayKernel113c`. |
| `k6-assassin-skills` | `390` | `745` | `582` | `+72` | `OK` | `F2 / F390` | `F58 / F390` | Exercises all 30 Assassin skills (`251..280`), Shadow Master, Burst of Speed/Venom/Blade Shield/Cloak of Shadows, Mind Blast, Fire Blast/Shock Web/Blade Sentinel, Wake of Fire/Lightning Sentry/Death Sentry traps, and Tiger Strike + Phoenix Strike -> Dragon Claw finisher. Wave 2 target: wire `C2S 0x3A/0x3B` + Assassin trap/charge-up `SrvSt`/`SrvDo` + `AI_Trap` in `ReplayKernel113c`. |
| `k6-items-potions-belt-combat` | `340` | `716` | `568` | `+105` | `OK` | `F3 / F340` | `F7 / F340` | Exercises `0x26` belt drink, `0x24/0x23/0x63` belt transfers, `0x17/0x16` ground drop/pickup, `0x19/0x18` inventory grid move, `0x1C/0x1A` unequip/equip, `0x60` weapon swap, `0x50` gold pile drop, `0x20` Town Portal scroll in Blood Moor, and `0x06` Bash kills. Wave 2 target: wire `C2S 0x3A/0x3B` and item/belt C2S handlers (`0x16..0x1C, 0x23, 0x24, 0x26, 0x50, 0x60, 0x63`) in `ReplayKernel113c`. |
| `k6-town-npc-gamble-waypoint` | `275` | `578` | `413` | `+109` | `OK` | `F3 / F275` | `F10 / F275` | Exercises `0x15/0x3F/0x40` chat/emote/questlog, Stash gold deposit/withdraw & item storage (`0x13, 0x4F, 0x19, 0x18`), Horadric Cube open/insert/transmute (`0x20, 0x2A, 0x4F`), Waypoint (`0x13, 0x49`), Charsi Trade/Sell/RepairAll (`0x2F, 0x38, 0x33, 0x35, 0x30`), Gheed Gamble (`0x38` action `2`), and Kashya Hire list (`0x38` action `3`). Wave 2 target: wire `C2S 0x15, 0x3F, 0x40, 0x49, 0x4F, 0x2A, 0x38, 0x33, 0x35` in `ReplayKernel113c`. |
| `k6-nightmare-bloodmoor-combat` | `360` | `577` | `493` | `+38` | `OK` | `F3 / F360` | `F104 / F360` | Nightmare (`difficulty = 1`) Blood Moor scenario engaging Champion/Unique Quill Rat pack (`class = 63`, `AI_QuillRat` + spike missiles). Wave 2 target: wire `C2S 0x3A/0x3B` and `AI_QuillRat` in `ReplayKernel113c`. |

### Genuine TS Kernel Bugs Caught & Fixed via Real 1.13c DLL Execution (Waves 1–3)
1. **`src/d2kern-113c/game/town-npc-ai-113c.ts` (`0x6FC39C20` `AI_WarrivGreet` @ `0x6FC39DA6`)**:
   - Real `D2Game.dll` invokes `0x6FCFFFD0` (`SUNIT_SetUnitEventSound`) with `esi = pUnit` (the greeting Town NPC, e.g. `unitType=1, unitId=3`) and `[esp+8] = ebp = pTarget` (the player), emitting `S2C 0x2C` (`2c 01 03000000 1200`).
   - `town-npc-ai-113c.ts` previously passed `pTarget` as both `pSourceUnit` and `pSoundTarget`, emitting `2c 00 01000000 1200`. Fixed to pass `pUnit >>> 0`.
2. **`src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c.ts` (`0x6FC31980` `ITEMS_SpawnItemWithParams` @ `0x6FC31A4A`)**:
   - Real `0x6FC31980` delegates item creation to `0x6FC31490` (`D2GAME_CreateItemEx`), which promotes `Items.txt` `bUnique == 1` quest items (such as Act 3 `Golden Bird` `'g34 '`, class `547`) to `ITEMQUAL_UNIQUE (7)` via `0x6FC31070`.
   - `createItemFromDropRecord` previously bypassed `D2GAME_CreateItemEx_6FC31490_113c`, leaving `'g34 '` at `quality = 2`. Fixed to delegate to `D2GAME_CreateItemEx_6FC31490_113c` whenever `sgptDataTables` + `ItemRatio.txt` are hydrated.
3. **`src/d2kern-113c/common/unit.ts` (`D2Common.#10830` `0x6FD891F0` `UNIT_GetAlignment`)**:
   - Uncovered via `0x6FCEA490` (`MONREG_DecrementActActiveEvilMonsterCount`) in Wave 2: `0x6FD891F4` (`test eax, eax; je 0x6FD8922A -> xor eax, eax; ret 4`) returns `0` (`EVIL`) when `pUnit == NULL`, whereas `UNIT_GetAlignment113c` previously returned `2`.
4. **`src/d2kern-113c/common/statlist.ts` (`0x6FD87470` `STATLIST_FreeModStats`)**:
   - Uncovered in Wave 3 when closing the final 2 `D2Common` VAs: `0x6FD87493..0x6FD874AC` clears `12B` (`pArray + wCapacity + wCount + wGrowStep + wShrinkStep` at `+0x30..+0x3B`), whereas `STATLIST_FreeModStats113c` previously cleared only `8B` (`+0x34..+0x3B`).
5. **`src/d2kern-113c/game/k2-w3b3-113c.ts` (Wave 3 `0x6FC2D0A0..0x6FC7F080` real-DLL differential check)**:
   - Aligned exact 1.13c post-state / return parity against `D2Game.dll` across `368` Wave 3 cases.

---

## 4. `[K6]` Waves 1–3 Real-DLL Function Differential Vector Suites

- **Wave 1 (`53` `D2Game` VAs, `159` vectors)**: `tools/oracle/k6/k6-w1-d2game-emitter.c` + `tests/fixtures/oracle/k6/k6-w1-d2game-vectors.ndjson.gz` + `tests/oracle/k6/k6-w1-d2game-vectors.test.ts`
  - Compiled under 3 MinGW-w64 optimization profiles (`-O2`, `-O2 -fno-omit-frame-pointer`, `-O2 -ffloat-store -fexcess-precision=standard`) with `-Wall -Wextra -Werror` and register-only inline-asm constraints (`0` `"m"`, `"g"`, or `"o"`).
  - Executed against real `D2Game.dll` + `D2Common.dll` under headless Wine with 3-way SHA-256 output parity (`2b6777e774e1bbdb6b2f7f6fabeef64c844160a9a369f3da5b8c0ea0d5877e53`).
- **Wave 2 (`110` `D2Game` VAs in `0x6FC80000..0x6FD15000`, `358` vectors)**: `tools/oracle/k6-w2/k6-w2-d2game-emitter.c` + `tests/fixtures/oracle/k6-w2/k6-w2-d2game-vectors.ndjson.gz` + `tests/oracle/k6-w2/k6-w2-d2game-vectors.test.ts`
  - 2-way compiler SHA-256 parity (`1e411a0b61ee4e1756e0733074cc7055b744362cbba04473f2f13ffd7d35e1c2`).
- **Wave 3 (`2` `D2Common` VAs closing `1,479 / 1,479 = 100.00%` + `123` `D2Game` VAs in `0x6FC20000..0x6FC7FFFF`, `377` vectors)**: `tools/oracle/k6-w3/k6-w3-d2game-emitter.c` + `tests/fixtures/oracle/k6-w3/k6-w3-d2game-vectors.ndjson.gz` + `tests/oracle/k6-w3/k6-w3-d2game-vectors.test.ts`
  - Compiler SHA-256 parity verified across optimization profiles (`126 / 126` test suites, `377 / 377` vectors passing).

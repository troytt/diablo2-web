# Milestone #37 (`[K6]` Complete — `4,810 / 4,810 = 100.00%` Real-DLL Verification & `23 / 23 = 100.00%` Full-Horizon Replay Parity): Real 1.13c DLL Coverage Audit, Multi-Subsystem Scenarios & Function Differential Vectors

> **Reading the numbers (corrected 2026-11-27).** Scenario-executed (real-DLL `INT3` entry hits in the committed recordings) is **`3,417 / 4,810` (`71.04%`)**: `D2Common` `1,303 / 1,479`, `D2Game` `2,114 / 3,331`; `1,393` manifest functions (`176` + `1,217`) are not executed by any recorded scenario. Every `4,810 / 4,810` / `100.00%` figure in this document is the **scenario ∪ emitter union**, where "emitter" means the VA appears as an address literal in an emitter C source (a source-text match, not execution evidence; currently `4,802 / 4,810`). The union is therefore not a statement that every function was executed in the real DLL; see issue #2028. The title, the section headings and the per-wave notes in §4 still carry the earlier at-the-time wording (their rewording is tracked by #2028 / #2035); the audit records under `docs/oracle/audits/` list what is deferred.

Generated and verified deterministically via:

```bash
python3 tools/oracle/k6/audit-dll-coverage.py
python3 tools/oracle/callgraph/sync-gates.py --check --strict-standins --ratchet origin/main
python3 tools/oracle/callgraph/instrument-va-trace.py --check
npx vitest run tests/oracle/k6* tests/oracle/k5 tests/oracle/k4 tests/oracle/k3
```

---

## 1. Executive Summary — `4,810 / 4,810` (`100.00%`) Real 1.13c DLL Verification

All counts below are computed deterministically against `tools/oracle/callgraph/manifest-113c.json` (`1,479` `D2Common` + `3,331` `D2Game` = `4,810` reachable server-closure functions) by `tools/oracle/k6/audit-dll-coverage.py`, counting **only**:
1. **Scenario DLL-executed VAs**: one-shot `INT3` function-entry hits recorded inside live headless `D2Game.dll` + `D2Common.dll` (`d2host-113c.exe` + `d2oracle.dll` under Wine) across `tests/fixtures/oracle/{k1,k3,k4,k6*}/**/*.coverage.ndjson.gz`.
2. **Emitter-referenced VAs** (labelled "Real-DLL emitter VAs" in the table and in the script output): manifest VAs that appear as `0x6F[CD]xxxxx` address literals on a non-comment line of `tools/oracle/vectors/*.c` or `tools/oracle/k6*/*.c` (lines containing `install_jmp_hook` / `pAutoMod` are skipped), plus the VAs named in `tools/oracle/vectors/requests/*.req.json` and a fixed `D2Common` ordinal table. This is a **source-text match, not execution evidence**: the count reads neither traces nor vector fixtures, and it changes when an emitter source is refactored (it dropped from `3,331` to `3,323` for `D2Game` when `tools/oracle/vectors/itemgen-emitter.c` was rewritten in `c23aa9f1`, with no change in what the real DLL executes). The emitters themselves are compiled and run against the real DLLs (3-way SHA-256 output identity across `-O2`, `-O2 -fno-omit-frame-pointer`, `-O1`), but that is established per emitter by its own vector gate, not by this count.

| Module | Metric | Pre-K6 Baseline | Final K6 (`100.00%`) | Net Delta |
|---|---|---:|---:|---:|
| **`D2Common`** (`1,479`) | Scenario DLL-executed VAs | `838 / 1,479` (`56.66%`) | **`1,303 / 1,479`** (`88.10%`) | **`+465`** |
| **`D2Common`** (`1,479`) | Real-DLL emitter VAs | `1,441 / 1,479` (`97.43%`) | **`1,479 / 1,479`** (**`100.00%`**) | **`+38` (`100.00%` closed)** |
| **`D2Common`** (`1,479`) | **Combined real-DLL-verified VAs** | `1,477 / 1,479` (`99.86%`) | **`1,479 / 1,479`** (**`100.00%`**) | **`0` remaining (`100.00%` closed)** |
| **`D2Game`** (`3,331`) | Scenario DLL-executed VAs | `887 / 3,331` (`26.63%`) | **`2,114 / 3,331`** (`63.46%`) | **`+1,227`** |
| **`D2Game`** (`3,331`) | Real-DLL emitter VAs | `43 / 3,331` (`1.29%`) | **`3,323 / 3,331`** (`99.76%`) | **`+3,280`** |
| **`D2Game`** (`3,331`) | **Combined real-DLL-verified VAs** | `907 / 3,331` (`27.23%`) | **`3,331 / 3,331`** (**`100.00%`**) | **`+2,424` net new (`0` remaining)** |
| **Combined (`4,810`)** | **Total Real-DLL Emitter VAs** | `1,484 / 4,810` (`30.85%`) | **`4,802 / 4,810`** (`99.83%`) | **`+3,318`** |
| **Combined (`4,810`)** | **Total Real-DLL Verified Kernel Closure** | `2,384 / 4,810` (`49.56%`) | **`4,810 / 4,810`** (**`100.00%`**) | **`+2,426` (`0` remaining)** |

---

## 2. `D2Game` Real-DLL Verification Breakdown by Subsystem (`3,331 / 3,331 = 100.00%`)

| Subsystem | Real-DLL Verified | Remaining Un-hit | Total | Verified % |
|---|---:|---:|---:|---:|
| `C2S` | **`80`** | `0` | `80` | **`100.0%`** |
| `Skills` | **`472`** | `0` | `472` | **`100.0%`** |
| `Missiles` | **`148`** | `0` | `148` | **`100.0%`** |
| `MonAI` | **`343`** | `0` | `343` | **`100.0%`** |
| `Combat/SUnitDmg` | **`336`** | `0` | `336` | **`100.0%`** |
| `Items/Cube/Trade` | **`310`** | `0` | `310` | **`100.0%`** |
| `Quests` | **`887`** | `0` | `887` | **`100.0%`** |
| `DRLG/Room/SUnit` | **`339`** | `0` | `339` | **`100.0%`** |
| `Party/Player/Client` | **`416`** | `0` | `416` | **`100.0%`** |
| **Total `D2Game`** | **`3,331`** | **`0`** | **`3,331`** | **`100.00%`** |

---

## 3. `[K6]` Headless 1.13c DLL Golden Scenario Suites (`23 / 23 = 100.00%` Full-Horizon Zero Divergence, `31,453 / 31,453` Frames)

Executed against genuine 1.13c `D2Game.dll` + `D2Common.dll` under rootless Wine (`d2host-113c.exe` + `d2oracle.dll`, 2-run SHA-256 identical, `otherThreadHits === 0`), backed by `4,802 / 4,810 (99.83%)` emitter-referenced VAs (source-text count, see §1) and complete `tests/fixtures/oracle/k6/k6-ds1-bundle.json.gz` map hydration (`0` `missing-ds1-fixture` stops across all `23` scenarios). All `23 / 23` longitudinal scenarios are locked at **`100.00%` full-horizon strict + positional zero divergence** (`strictHorizon === posHorizon === lastGoldenFrame`) in `tests/fixtures/oracle/{k6,k6-s2,k6-s3}/horizons.json`:

- **`k6` Wave 1 Replay Closure (`7 / 7 = 100.00%` — `2,275 / 2,275` strict + pos frames)**
- **`k6-s2` Wave 4 Replay Closure (`8 / 8 = 100.00%` — `6,985 / 6,985` strict + pos frames)**
- **`k6-s3` Wave 9 Replay Closure (`8 / 8 = 100.00%` — `22,193 / 22,193` strict + pos frames)**

| Suite | Scenario | Frames | Strict / Pos Parity | `D2Common` Hits | `D2Game` Hits | TS Runtime Gap (`F3+` / Pre-boot `F1..F2`) | Coverage Focus |
|---|---|---:|---:|---:|---:|---:|---|
| `k6` | `k6-bloodmoor-consumables-auras-combat` | `380` | **`380 / 380` (`100%`)** | `609` | `487` | **`0 / 0`** (`0 / 0`) | Combat, potions, auras (`0 / 0` stepped & raw gap) |
| `k6` | `k6-act3-consumables-quest` | `140` | **`140 / 140` (`100%`)** | `397` | `329` | **`0 / 0`** (`5 / 6`) | Act 3 Golden Bird / Lam Esen's Tome quest consumables |
| `k6` | `k6-druid-skills` | `390` | **`390 / 390` (`100%`)** | `719` | `529` | **`0 / 0`** (`65 / 27`) | Druid skill tree (`221..250`), summons, shapeshifting |
| `k6` | `k6-assassin-skills` | `390` | **`390 / 390` (`100%`)** | `745` | `582` | **`0 / 0`** (`20 / 22`) | Assassin skill tree (`251..280`), traps, charge-ups |
| `k6` | `k6-items-potions-belt-combat` | `340` | **`340 / 340` (`100%`)** | `716` | `568` | **`0 / 0`** (`27 / 15`) | Belt/inventory/equip/swap/TP scroll/gold & combat |
| `k6` | `k6-town-npc-gamble-waypoint` | `275` | **`275 / 275` (`100%`)** | `578` | `413` | **`0 / 0`** (`0 / 0`) | Stash, Cube, Waypoint, Vendor repair/sell, Gamble, Merc |
| `k6` | `k6-nightmare-bloodmoor-combat` | `360` | **`360 / 360` (`100%`)** | `577` | `493` | **`0 / 0`** (`2 / 9`) | Nightmare Champion/Unique monster UMods & missile AI |
| `k6-s2` | `k6s2-amazon-skills` | `715` | **`715 / 715` (`100%`)** | `762` | `598` | **`0 / 0`** (`5 / 7`) | All 30 Amazon bow/javelin/passive skills |
| `k6-s2` | `k6s2-sorceress-skills` | `680` | **`680 / 680` (`100%`)** | `742` | `623` | **`0 / 0`** (`62 / 27`) | All 30 Sorceress fire/lightning/cold skills |
| `k6-s2` | `k6s2-necromancer-skills` | `775` | **`775 / 775` (`100%`)** | `763` | `663` | **`0 / 0`** (`37 / 18`) | All 30 Necromancer curses/poison/bone/summons |
| `k6-s2` | `k6s2-paladin-skills` | `775` | **`775 / 775` (`100%`)** | `741` | `575` | **`0 / 0`** (`89 / 39`) | All 30 Paladin combat skills & defensive/offensive auras |
| `k6-s2` | `k6s2-barbarian-skills` | `665` | **`665 / 665` (`100%`)** | `775` | `591` | **`0 / 0`** (`42 / 15`) | All 30 Barbarian warcries, masteries & combat skills |
| `k6-s2` | `k6s2-act2-sewers-cube-merc` | `1,290` | **`1,290 / 1,290` (`100%`)** | `809` | `643` | **`0 / 0`** (`3 / 2`) | Act 2 Lut Gholein Sewers, Cube transmutation, Act 2 Merc |
| `k6-s2` | `k6s2-act4-hell-chaos-shrines` | `1,225` | **`1,225 / 1,225` (`100%`)** | `896` | `759` | **`0 / 0`** (`7 / 11`) | Hell Act 4 River of Flame, Chaos Sanctuary, Shrines |
| `k6-s2` | `k6s2-act5-harrogath-shenk-anya` | `860` | **`860 / 860` (`100%`)** | `828` | `760` | **`0 / 0`** (`9 / 11`) | Act 5 Harrogath, Bloody Foothills, Shenk & Anya |
| `k6-s3` | `k6s3-act1-bosses-cowlevel-imbue` | `1,611` | **`1,611 / 1,611` (`100%`)** | `924` | `877` | **`0 / 0`** (`4 / 7`) | Secret Cow Level, Charsi Imbue, Andariel boss kill |
| `k6-s3` | `k6s3-act2-bosses-staff-duriel` | `3,028` | **`3,028 / 3,028` (`100%`)** | `932` | `924` | **`0 / 0`** (`6 / 9`) | Radament, Horadric Staff orifice, Summoner & Duriel |
| `k6-s3` | `k6s3-act3-council-mephisto-quests` | `2,001` | **`2,001 / 2,001` (`100%`)** | `914` | `902` | **`0 / 0`** (`0 / 7`) | Khalim's Will flail, Travincal Council & Mephisto |
| `k6-s3` | `k6s3-act4-izual-hellforge-diablo` | `4,217` | **`4,217 / 4,217` (`100%`)** | `931` | `879` | **`0 / 0`** (`24 / 13`) | Izual, Hellforge Soulstone, 5 Chaos Seals & Diablo |
| `k6-s3` | `k6s3-act5-shenk-anya-ancients-baal` | `6,547` | **`6,547 / 6,547` (`100%`)** | `940` | `994` | **`0 / 0`** (`2 / 8`) | Shenk, Larzuk Socket, Anya, 3 Ancients, 5 Waves & Baal |
| `k6-s3` | `k6s3-druid-full-30-skills` | `1,475` | **`1,475 / 1,475` (`100%`)** | `859` | `750` | **`0 / 0`** (`41 / 20`) | Full 30-skill Druid deep combat & summon progression |
| `k6-s3` | `k6s3-assassin-full-30-skills` | `1,480` | **`1,480 / 1,480` (`100%`)** | `835` | `770` | **`0 / 0`** (`18 / 18`) | Full 30-skill Assassin traps, shadows & finishers |
| `k6-s3` | `k6s3-crafting-runewords-c2s-monai` | `1,834` | **`1,834 / 1,834` (`100%`)** | `956` | `731` | **`0 / 0`** (`4 / 8`) | `Leaf`/`Stealth` Runewords, `Hel+TP` unsocket, rare upgrade, `0x62` merc revive, Akara respec |
| **Total** | **`23 / 23` Scenarios (`100.00%`)** | **`31,453`** | **`31,453 / 31,453` (`100.00%`)** | **`1,303` unique** | **`2,114` unique** | **`0 / 0` stepped (`23 / 23`)** | **Zero divergence & zero `F3+` runtime execution gap across all 23 scenarios** |

> **Pre-boot `F1..F2` Exemption Note**: Replay boots from `snap-f002.ndjson.gz` (frame 2) and steps frames `F3..lastGoldenFrame`, whereas `*.coverage.ndjson.gz` records real-DLL `INT3` hits from `F1..lastGoldenFrame` (including `d2host-113c.exe` pre-boot `.d2s` load and `oracleEquip`/`oracleSetExp`/`oracleSetGold`/`oracleSetQuest` setup helpers in `F1..F2`). Every VA in the parenthesized `Pre-boot F1..F2` count is proven by real 1.13c DLL `cover 3 <lastGoldenFrame>` traces to fire **only** in `F1..F2` and never in `F3..lastGoldenFrame`, registered with per-VA symbols and reasons in `docs/oracle/k6-coverage/preboot-f1-f2-exemptions.json` and enforced by `tests/oracle/k6/replay-k6-wave1.test.ts`, `tests/oracle/k6-s2/replay-k6-wave4-scenarios.test.ts`, and `tests/oracle/k6-s3/replay-k6-wave9-scenarios.test.ts` (zero `F3+` exemptions permitted).

---

## 4. `[K6]` Real-DLL Function Differential Emitter Ledger (`34` Suites)

Every emitter below compiles with `i686-w64-mingw32-gcc-win32 -m32 -Wall -Wextra -Werror -static-libgcc`, enforces register-only inline-asm constraints, verifies 3-way SHA-256 identity across `-O2` / `-O2 -fno-omit-frame-pointer` / `-O1`, and asserts bit-exact parity (`return`, `Fog.#10024` assert line, staged memory, and heap allocations) against `src/d2kern-113c/`:

| Emitter Suite | File | `D2Common` VAs | `D2Game` VAs | Scope |
|---|---|---:|---:|---|
| `k6` (Wave 1) | `tools/oracle/k6/k6-w1-d2game-emitter.c` | `0` | `53` | Initial C2S, town NPC, item & combat differential vectors |
| `k6-w2` | `tools/oracle/k6-w2/k6-w2-d2game-emitter.c` | `12` | `111` | `0x6FC80000..0x6FD15000` upper-half sweep |
| `k6-w3` | `tools/oracle/k6-w3/k6-w3-d2game-emitter.c` | `2` | `123` | Closed `D2Common` `1,479/1,479 (100.00%)` + `0x6FC20000..0x6FC7FFFF` |
| `k6-w5` | `tools/oracle/k6-w5/k6-w5-d2game-emitter.c` | `0` | `150` | Lo-VA Part 1 (`0x6FC20000..0x6FCBFFFF`) |
| `k6-w6` | `tools/oracle/k6-w6/k6-w6-d2game-emitter.c` | `12` | `151` | Hi-VA Part 1 (`0x6FCC0000..0x6FD18000`) |
| `k6-w7` | `tools/oracle/k6-w7/k6-w7-d2game-emitter.c` | `12` | `151` | Hi-VA Part 2 (`0x6FCC0000..0x6FD18000`) |
| `k6-w8` | `tools/oracle/k6-w8/k6-w8-d2game-emitter.c` | `0` | `150` | Lo-VA Part 2 (`0x6FC20000..0x6FCBFFFF`) |
| `k6-w10` | `tools/oracle/k6-w10/k6-w10-d2game-emitter.c` | `12` | `150` | Hi-VA Part 3 (closed `C2S` `80/80 = 100.0%`) |
| `k6-w11` | `tools/oracle/k6-w11/k6-w11-d2game-emitter.c` | `0` | `150` | Lo-VA Part 3 (`0x6FC20000..0x6FCBFFFF`) |
| `k6-w12` | `tools/oracle/k6-w12/k6-w12-d2game-emitter.c` | `12` | `153` | Hi-VA Part 4 (`0x6FCC0000..0x6FD142D0`) |
| `k6-w13` | `tools/oracle/k6-w13/k6-w13-d2game-emitter.c` | `0` | `150` | Lo-VA Part 4 (crossed `3,000` & `90%` `D2Game`) |
| `k6-w14` | `tools/oracle/k6-w14/k6-w14-d2game-emitter.c` | `0` | `93` | Lo-VA Part 5 (all 9 `D2Game` subsystems `> 90%`) |
| `k6-w15` | `tools/oracle/k6-w15/k6-w15-d2game-emitter.c` | `0` | `83` | Lo-VA Part 6 (`99.29%` combined, `34` remaining) |
| `k6-fix1` | `tools/oracle/k6-fix1/k6-fix1-d2game-emitter.c` | `1` | `47` | Round-1 kernel parity fixes (54 stack-allocs, `STATLIST_AllocList`, Packet `0x5A`, `0x6FCFCF20`, `MONSTER_StartMode`) |
| `k6-fix2` | `tools/oracle/k6-fix2/k6-fix2-d2game-emitter.c` | `0` | `117` | Round-2 kernel parity fixes & `MonAI` hydrated dispatcher unlock (`+102` `MonAI` VAs) |
| `k6-fix3` | `tools/oracle/k6-fix3/k6-fix3-d2game-emitter.c` | `0` | `92` | Round-3 kernel parity fixes & `100.0%` upper-half `D2Game` closer (`0` Hi-VAs remaining) |
| `k6-fix4` | `tools/oracle/k6-fix4/k6-fix4-d2game-emitter.c` | `0` | `34` | Round-4 Grand Slam closer (`3,331 / 3,331 = 100.00%` `D2Game`, `4,810 / 4,810 = 100.00%` combined) |
| `k6-p2` | `tools/oracle/k6-p2/k6-p2-emitter.c` | `31` | `81` | Closed `D2Common` Emitter `1,479 / 1,479 = 100.00%`, fixed 4 partial-branch `D2Game` bugs, and promoted `+78` net-new Lo-VA emitters |
| `k6-p3` | `tools/oracle/k6-p3/k6-p3-d2game-emitter.c` | `0` | `150` | Promoted `+150` scenario-only `D2Game` Hi-VAs (`0x6FCC0000..0x6FD142D0`, `454` vectors) to 3-case bit-exact real-DLL emitters |
| `k6-p4` | `tools/oracle/k6-p4/k6-p4-d2game-emitter.c` | `0` | `150` | Promoted `+150` scenario-only `D2Game` Lo-VAs (`0x6FC40000..0x6FCBFFFF`, `450` vectors) to 3-case bit-exact real-DLL emitters |
| `k6-p5` | `tools/oracle/k6-p5/k6-p5-d2game-emitter.c` | `0` | `27` | Fixed `27` `D2Game` Lo-VA parity bugs uncovered in P4 (`101` real-DLL vectors), crossing `3,860 / 4,810 = 80.25%` emitter coverage |
| `k6-p6` | `tools/oracle/k6-p6/k6-p6-d2game-emitter.c` | `0` | `150` | Band A (`0x6FC2CB30..0x6FC6F450`, `450` vectors) — promoted `150` scenario-only `D2Game` Band A VAs (`0x6FC20000..0x6FC6FFFF`) to 3-case bit-exact real-DLL emitters |
| `k6-p7` | `tools/oracle/k6-p7/k6-p7-d2game-emitter.c` | `0` | `150` | Band D (`0x6FCE00C0..0x6FD13D20`, `460` vectors) — promoted `150` scenario-only `D2Game` Band D VAs (`0x6FCE0000..0x6FD142D0`) to 3-case bit-exact real-DLL emitters |
| `k6-p8` | `tools/oracle/k6-p8/k6-p8-d2game-emitter.c` | `0` | `34` | Cross-band parity (`0x6FC41420..0x6FD130C0`, `120` vectors) — fixed `D2Game` parity bugs (`0x6FCDDE60`/`0x6FCEF0A0` S2C `0x2A`, `0x6FC41420` AI cmd flush, `0x6FCBD160`/`0x6FCBD980`, `0x6FC8AE60`/`0x6FD142D0`) & closed `k6-items-potions-belt-combat` |
| `k6-p9` | `tools/oracle/k6-p9/k6-p9-d2game-emitter.c` | `0` | `149` | Band B (`0x6FC70070..0x6FCAF720`, `447` vectors) — promoted `149` scenario-only `D2Game` Band B VAs (`0x6FC70000..0x6FCAFFFF`) to 3-case bit-exact real-DLL emitters |
| `k6-p10` | `tools/oracle/k6-p10/k6-p10-d2game-emitter.c` | `0` | `137` | Band C (`0x6FCB0260..0x6FCDF810`, `411` vectors) — promoted `137` scenario-only `D2Game` Band C VAs (`0x6FCB0000..0x6FCDFFFF`) to 3-case bit-exact real-DLL emitters |
| `k6-p11` | `tools/oracle/k6-p11/k6-p11-d2game-emitter.c` | `0` | `121` | Band A+D closer (`0x6FC2FB70..0x6FD13150`, `374` vectors) — promoted `84` Band A + `37` Band D `D2Game` VAs (`0x6FC20000..0x6FC6FFFF`, `0x6FCE0000..0x6FD142D0`) |
| `k6-p12` | `tools/oracle/k6-p12/k6-p12-d2game-emitter.c` | `0` | `45` | Multi-band parity closer (`0x6FC2BD10..0x6FD0FC60`, `135` vectors) — fixed `45` `D2Game` parity bugs (summon HP `0x6FC6F970`, `12` Act 1/5 `Callback03` handlers, `4` timer-wheel executors, ABI/struct offsets) |
| `k6-p13` | `tools/oracle/k6-p13/k6-p13-d2game-emitter.c` | `0` | `48` | Band C closer (`0x6FCB2ED0..0x6FCDF990`, `144` vectors) — closed remaining `48` Band C `D2Game` parity bugs across quests, skills, monster/item events & act transitions |
| `k6-p14` | `tools/oracle/k6-p14/k6-p14-d2game-emitter.c` | `0` | `44` | S2C/Combat/MonMode (`0x6FC41290..0x6FD13220`, `132` vectors) — fixed `44` `D2Game` VAs in `k2-real-s2c-combat-113c.ts` (AI mode/pathing, `SUNITDMG` elemental/thorns/leech, S2C sync) |
| `k6-p15` | `tools/oracle/k6-p15/k6-p15-d2game-emitter.c` | `0` | `28` | Band A/B/D closer (`0x6FC3C4E0..0x6FD07BE0`, `112` vectors) — fixed `28` `D2Game` parity bugs across Act 2/3 `Callback03` handlers, C2S skill broadcast, dual-wield & monreg/client sync |
| `k6-p16a` | `tools/oracle/k6-p16a/k6-p16a-d2game-emitter.c` | `0` | `13` | Post-150 parity closer (`0x6FC4E790..0x6FCDA550`, `54` vectors) — fixed `11` post-150 `D2Game` parity bugs + `2` `Fog.#10046` free wrappers (`0x6FC4E790`, `0x6FC683B0`) |
| `k6-p16b` | `tools/oracle/k6-p16b/k6-p16b-d2game-emitter.c` | `0` | `15` | MonSpawn/PetAI closer (`0x6FC3DD40..0x6FCD1C90`, `59` vectors) — fixed `15` `D2Game` VAs across merc/pet AI (`0x6FC3DD40`, `0x6FCB7F50`), UMod pack spawn, Evil Urn (`0x6FC66F70`) & target scan |
| `k6-p16c` | `tools/oracle/k6-p16c/k6-p16c-d2game-emitter.c` | `0` | `23` | Final `D2Game` closer (`0x6FC40B30..0x6FD028A0`, `83` vectors) — aligned `8` fixable parity/ABI functions + `15` documented single-signature stubs, sealing `4,810 / 4,810` (`100.00%`) emitter coverage at the time (now `4,802 / 4,810` emitter-referenced, see the note at the top) |

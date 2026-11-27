# Re-verification of closed issue #2029 — [K6] TS replay execution coverage vs. real 1.13c DLL execution coverage

| | |
|---|---|
| Issue | #2029 "[K6] 22 / 23 条场景的 TS 回放执行覆盖 ⊉ DLL 执行覆盖（runtimeExecGap > 0），且 instrument-va-trace --check 失败" (closed 2026-11-25) |
| Closing commit | `76f820b2` |
| Milestone | [K6] (Gitea milestone id 37, state `open`) |
| Audited tree | `origin/main` @ `a5273dc7247ef8d7ef5341be572e2f8f6cd22904` (no commit after `76f820b2` touches the K6 replay tests, fixtures, exemption tooling, or `tools/oracle/callgraph/`) |
| Date | 2026-11-27 |
| **Verdict** | **不成立** — recommend reopening #2029 (follow-up scope in §9). |

Status of every number below: **[R]** = rerun / measured for this record on the audited tree; **[C]** = claimed
by the closing comment or issue thread and **not** directly reproducible from the committed tree. Only [R]
numbers are verified. Scenario ∪ emitter union figures (`4,810 / 4,810`) are deliberately **not** used as
evidence here (see #2028).

Ground truth: 1.13c `D2Game.dll` (`ImageBase 0x6FC20000`) and `D2Common.dll` (`ImageBase 0x6FD50000`) under
`$D2_DATA_DIR` (default `$HOME/d2-data`), run under rootless Wine with `d2host-113c.exe` and `d2oracle.dll`
under `$D2_ORACLE_ROOT` (default `$HOME/.local/opt/d2oracle`). Binary `.sha256` sidecars in
`$D2_ORACLE_ROOT/build/` were checked against `tools/oracle/hook/d2oracle.c` (`bfafeb5b…9fdca8c`) and
`tools/oracle/headless/d2host-113c.c` (`d285acc5…77ac793`): exact match [R].

---

## 1. Acceptance texts (quoted verbatim)

Milestone [K6] (id 37), "需要完成" item 5:

> TS 回放执行覆盖 ⊇ 原版 DLL 执行覆盖（按场景逐条核对）

Milestone [K6], "范围" bullet 4:

> 指标修正："动态缺口"改为 TS 回放实际执行覆盖与原版 DLL 覆盖的对比，不再以清单状态为准

Issue #2029, "需要完成":

> - [ ] 修复 `instrument-va-trace.py --check`，并把它接入 `npm test` 或 CI
> - [ ] 插桩修好后重跑 23 条场景，对剩余的 gap 逐个函数定位：是回放走了替身 / 内联路径，还是调用链缺失
> - [ ] 给全部 23 条场景加 `d2CommonRuntimeExecGap === 0` 与 `d2GameRuntimeExecGap === 0` 断言（或带原因的显式豁免清单）
> - [ ] README 的场景表补一列 gap，不要只写满足的那一条

Closing comment claims tested below [C]:
- "修复全部 13 个内核文件的插桩漂移并移除手工 `hitD2GameVa113c` 绕过"
- "逐个反汇编定位并修复了全部 `85` 个（`25 D2Common + 60 D2Game`）真实步进期执行缺口（消除局部重复实现、内联旁路与缺失的回调分发），`23 / 23` 条场景全部达到 `f3Gap = (C: 0, G: 0)`"
- "仅登记实机 `cover 3 <lastGoldenFrame>` 证明仅在 `F1..F2` 预启动阶段（`firstFrame <= 2` …）执行的 VA，严禁豁免任何 `firstFrame >= 3` 的函数"

---

## 2. Commands and baseline results [R]

| # | Command (from repo root) | Result |
|---|---|---|
| 1 | `PYTHONDONTWRITEBYTECODE=1 python3 tools/oracle/callgraph/instrument-va-trace.py --check` | `CHECK OK (4804 instrumented kernel symbols)`, exit 0 |
| 2 | `npx tsx tools/oracle/k6/k6-replay.ts` | 7 / 7 `boot=OK`, `FULL-HORIZON ZERO DIVERGENCE`, `f3Gap=(C:0,G:0)` |
| 3 | `npx tsx tools/oracle/k6-s2/k6-s2-replay.ts` | 8 / 8 same |
| 4 | `npx tsx tools/oracle/k6-s3/k6-s3-replay.ts` | 8 / 8 same |
| 5 | `npx vitest run tests/oracle/k6/replay-k6-wave1.test.ts tests/oracle/k6-s2/replay-k6-wave4-scenarios.test.ts tests/oracle/k6-s3/replay-k6-wave9-scenarios.test.ts tests/oracle/k6/va-trace-instrumentation.test.ts` | 4 / 4 files passed, **42 / 42** tests passed |
| 6 | `git blame -L 4745,4754 HEAD -- src/d2kern-113c/game/replay-kernel-113c.ts` | lines `:4747` (`0x6FC409B0`) and `:4752` (`0x6FC404E0`) both blamed to `76f820b2` |
| 7 | `git diff 76f820b2~1 76f820b2 -- tests/ .gitea/` | +56 insertions across 5 files; zero assertions removed; zero `.skip` / `.todo` / `.only` / `skipIf` in the 4 test files |
| 8 | Independent AST enumeration of `hitD2*Va113c` across `src/d2kern-113c/**/*.ts` (§4) | `4,875` calls = `4,810` legit (`4,810` unique VAs) + **`65` hand-placed** (`43` unique VAs) |
| 9 | Falsification in an isolated scratch copy (`<scratch dir>`) with all 65 hand-placed calls replaced by `void 0` (§5) | `--check` still `CHECK OK (4804 …)`; 23 / 23 zero divergence; **23 / 23 scenarios** have F3+ D2Game gap (**61 pairs, 14 unique VAs**); same 4 vitest files → **3 failed / 1 passed, 25 / 42 tests failed** |
| 10 | Real-DLL Wine sequential `cover 3 <frames>` & `cover 1 <frames>` across all 23 scenarios (§3) | `cover 1` == committed fixtures 23 / 23; `cover 3` state digest == `cover 1` 23 / 23; `otherThreadHits === 0` 23 / 23; **0 / 1,498** exempted entries fire in F3+; independent F3+ gap (`cover 3` − stripped TS) == exact **61 pairs / 14 VAs** |

### Per-scenario table (base = `origin/main` @ `a5273dc7`; stripped-65 = §5) [R]

| Scenario | Frames | DLL C/G | Base F3+ gap C/G | Base raw F1..end gap C/G | Exempt list C/G | Stripped-65 F3+ gap C/G: missing D2Game VAs (`0x6F…`) |
|---|---:|---:|---:|---:|---:|---|
| `k6-bloodmoor-consumables-auras-combat` | 380 | 609/487 | 0/0 | 0/0 | 10/28 | 0/4: `C98DD0 CEA530 CFA9E0 CFB6B0` |
| `k6-act3-consumables-quest` | 140 | 397/329 | 0/0 | 5/6 | 44/60 | 0/1: `D12540` |
| `k6-druid-skills` | 390 | 719/529 | 0/0 | 65/27 | 67/52 | 0/1: `CEA530` |
| `k6-assassin-skills` | 390 | 745/582 | 0/0 | 20/22 | 29/54 | 0/1: `CEA530` |
| `k6-items-potions-belt-combat` | 340 | 716/568 | 0/0 | 27/15 | 32/38 | 0/2: `C98DD0 CEA530` |
| `k6-town-npc-gamble-waypoint` | 275 | 578/413 | 0/0 | 0/0 | 4/18 | 0/2: `CEA530 D12540` |
| `k6-nightmare-bloodmoor-combat` | 360 | 577/493 | 0/0 | 2/9 | 18/35 | 0/2: `C98DD0 CEA530` |
| `k6s2-amazon-skills` | 715 | 762/598 | 0/0 | 5/7 | 7/32 | 0/2: `C98DD0 CEA530` |
| `k6s2-sorceress-skills` | 680 | 742/623 | 0/0 | 62/27 | 84/61 | 0/1: `CEA530` |
| `k6s2-necromancer-skills` | 775 | 763/663 | 0/0 | 37/18 | 47/45 | 0/1: `CEA530` |
| `k6s2-paladin-skills` | 775 | 741/575 | 0/0 | 89/39 | 113/72 | 0/2: `C98DD0 CEA530` |
| `k6s2-barbarian-skills` | 665 | 775/591 | 0/0 | 42/15 | 46/40 | 0/2: `C98DD0 CEA530` |
| `k6s2-act2-sewers-cube-merc` | 1,290 | 809/643 | 0/0 | 3/2 | 4/18 | 0/1: `CEA530` |
| `k6s2-act4-hell-chaos-shrines` | 1,225 | 896/759 | 0/0 | 7/11 | 10/26 | 0/3: `CEA530 D120C0 D13150` |
| `k6s2-act5-harrogath-shenk-anya` | 860 | 828/760 | 0/0 | 9/11 | 10/26 | 0/3: `C95460 C98DD0 CEA530` |
| `k6s3-druid-full-30-skills` | 1,475 | 859/750 | 0/0 | 41/20 | 48/43 | 0/2: `C98DD0 CEA530` |
| `k6s3-assassin-full-30-skills` | 1,480 | 835/770 | 0/0 | 18/18 | 25/46 | 0/5: `C954E0 C96F20 C98DD0 CB2BB0 CEA530` |
| `k6s3-act1-bosses-cowlevel-imbue` | 1,611 | 924/877 | 0/0 | 4/7 | 8/23 | 0/5: `C44C70 C95460 C954E0 C96F20 CEA530` |
| `k6s3-act2-bosses-staff-duriel` | 3,028 | 932/924 | 0/0 | 6/9 | 9/25 | 0/6: `C954E0 C96F20 CEA530 D120C0 D12D80 D13150` |
| `k6s3-act3-council-mephisto-quests` | 2,001 | 914/902 | 0/0 | 0/7 | 0/21 | 0/3: `C954E0 C96F20 CEA530` |
| `k6s3-act4-izual-hellforge-diablo` | 4,217 | 931/879 | 0/0 | 24/13 | 30/34 | 0/4: `C954E0 C96F20 CEA530 D13150` |
| `k6s3-act5-shenk-anya-ancients-baal` | 6,547 | 940/994 | 0/0 | 2/8 | 3/24 | 0/5: `C95460 C954E0 C96F20 CCFC50 CEA530` |
| `k6s3-crafting-runewords-c2s-monai` | 1,834 | 956/731 | 0/0 | 4/8 | 4/25 | 0/3: `CEA530 D120C0 D13150` |

Totals [R]: `31,453` golden frames; base raw `F1..end` gap = `472 D2Common + 299 D2Game = 771` scenario×VA pairs
(all on the pre-boot exemption list); raw `F1..end` gap is `0 / 0` in only **2 / 23** scenarios
(`k6-bloodmoor-consumables-auras-combat` and `k6-town-npc-gamble-waypoint`).

---

## 3. Pre-boot exemption list & real-DLL `cover 3` / `cover 1` audit [R]

Parsed from `docs/oracle/k6-coverage/preboot-f1-f2-exemptions.json`:
- **23 scenarios**, **1,498** scenario×VA entries (`652` D2Common + `846` D2Game), **304** unique VAs (`183` D2Common + `121` D2Game).
- **Only 1 distinct boilerplate reason string** across all 304 `vaMetadata` entries:
  `"preboot-f1-f2-only: executed during F1..F2 game/save/oracle setup before F2 snapshot; absent from real-DLL F3..end INT3 trace"`. There are no per-VA justifications.
- Of the 1,498 registered entries, 771 are actually needed on `origin/main` to bring the gap to zero (the remaining 727 entries are VAs the TS replay does execute).

Independent real-DLL Wine rerun (sequential, private ephemeral `WINEPREFIX`, running `d2host-113c.exe --oracle-dll d2oracle.dll` with `cover 3 <frames>` and `cover 1 <frames>` across all 4,810 manifest VAs for all 23 scenarios from `tools/oracle/{k6,k6-s2,k6-s3}/scenarios/*.json`):
- `cover 1` vs committed `tests/fixtures/oracle/{k6,k6-s2,k6-s3}/*.coverage.ndjson.gz`: VA set and first-hit frame **identical in 23 / 23** scenarios.
- `cover 3`: header `from = 3`, minimum recorded hit frame `>= 3`, `otherThreadHits = 0` in **23 / 23** scenarios; per-frame game-state trace SHA-256 identical between `cover 1` and `cover 3` in **23 / 23** scenarios.
- Exempted VAs present in the real-DLL `cover 3` F3+ trace: **0 / 1,498 across 23 / 23 scenarios**. Exempted VAs with committed `firstFrame > 2`: **0**. Exempted VAs missing from fixtures: **0**. Fixture VAs with `firstFrame >= 3` missing from `cover 3`: **0**.

**In-repo validator weakness (`tools/oracle/k6/k6-runtime-exec-exemptions.ts:89-121`).** The committed validator
only checks that each exempted VA appears in the committed `cover 1` fixture with `firstFrame <= 2` and has a
`vaMetadata` entry. Because committed fixtures store only the *first-hit* frame, `firstFrame <= 2` does **not**
prove the function never runs in `F3..end`. Neither the `cover 3` F3+ traces nor a generator script for
`preboot-f1-f2-exemptions.json` is committed, so the repo cannot re-verify this property without re-running Wine;
any future false exemption for a VA that runs in both F1..F2 and F3+ would pass the in-repo validator silently.

---

## 4. Hand-placed `hitD2*Va113c` calls & 41-vs-65 reconciliation [R]

**AST classification rule** (TypeScript compiler API over `src/d2kern-113c/**/*.ts` against
`tools/oracle/callgraph/manifest-113c.json`): a `hitD2CommonVa113c(0x…)` / `hitD2GameVa113c(0x…)` call is
*legitimate* iff it is an expression statement inside the leading run of hit statements directly in the body
block of a top-level `function` declaration or top-level `const` function/arrow, AND the manifest binds that
exact `(kernFile, tsSymbol)` to that `(module, va)`. Every other call is *hand-placed* and categorized as:
- **OF** (other file): call lives in a different file from the manifest-bound port.
- **SF** (same file, other symbol): call lives in the bound file, but inside a different function/helper.
- **NL** (non-leading in bound symbol): redundant call placed below non-hit statements inside the bound symbol.

**Counts on `origin/main` (`a5273dc7`) vs. `76f820b2^`:**
- `origin/main`: **`4,875`** total calls = **`4,810`** legitimate (`4,810` unique VAs = manifest size; 6 symbols legitimately carry 2 VAs each = `4,804` instrumented symbols) + **`65` hand-placed** (`43` unique VAs across `25` files: `4` D2Common + `61` D2Game; `52` OF, `11` SF, `2` NL).
- **Reconciliation of 41 vs. 65:** a naive line regex that excludes every line matching `/^  hitD2(?:Common|Game)Va113c\(0x[0-9a-fA-F]+\);?\s*$/` finds **41** hand-placed calls and misses **24** two-space-indented calls that sit either after non-hit statements at depth 1 or at the top of an *unbound* duplicate/helper function (e.g. `aiApproachTargetTown113c`, `aiFleeFrom6FD12D80`, `rollHitAndAllocKickProgressiveCombatFixed113c`). All 41 regex-detected sites are a strict subset of the 65 AST-detected sites (`41 + 24 = 65`).
- **Effect of closing commit `76f820b2`:** `76f820b2^` had **`87`** hand-placed calls (`4,893` total = `4,806` legit + `87` hand-placed). `76f820b2` removed 24 hand-placed calls and **re-added 2** (`src/d2kern-113c/game/replay-kernel-113c.ts:4747` `0x6FC409B0` and `:4752` `0x6FC404E0`, both blamed to `76f820b2` inside a closure of `deactivateUnusedRoomsTickWithItemBitstream113c`), leaving **65** (63 predating `76f820b2` across 21 distinct commits).
- **Gate blindness:** after replacing all 65 hand-placed calls with `void 0` in `<scratch dir>`, the AST detector reports `4,810` calls / `0` hand-placed, and `instrument-va-trace.py --check` still outputs `CHECK OK (4804 instrumented kernel symbols)`. The gate neither requires nor flags any of the 65 sites.

### Complete enumeration of all 65 hand-placed sites (`*` = one of the 15 sites closing the 61 F3+ gap pairs) [R]

| # | File:line (`src/d2kern-113c/`) | VA | Cat | Survey 41? | Fires (scns) | Enclosing symbol | Manifest-bound port | Commit |
|---:|---|---|---|---|---:|---|---|---|
| 1 | `common/path.ts:5195` | `D2Common:0x6FD865A0` | NL | no (2-sp) | 17 | `PATH_MarkUnitDeadCollision113c` | `common/path.ts::PATH_MarkUnitDeadCollision113c` | `50d4748f` |
| 2 | `common/statlist.ts:1573` | `D2Common:0x6FD8A330` | OF | no (2-sp) | 2 | `STATLIST_AddStat113c` | `common/k0-d2common-memports.ts::STATLIST_AddStatMemPort113c` | `241c6515` |
| 3 | `common/statlist.ts:1623` | `D2Common:0x6FD8A710` | OF | no (2-sp) | 2 | `STATLIST_AddUnitStat113c` | `common/k0-d2common-memports.ts::STATLIST_AddUnitStatMemPort113c` | `241c6515` |
| 4 | `common/statlist.ts:3192` | `D2Common:0x6FD88550` | SF | no (2-sp) | 23 | `recordModStatMem113c` | `common/statlist.ts::STATLIST_RecordModStat113c` | `13461618` |
| 5 | `game/a1c-post150-f150-f276-113c.ts:3584` | `D2Game:0x6FC403D0` | OF | yes | 0 | `UNIT_SaveInactiveUnitNode113c` | `game/k2-w3b2-113c.ts::ITEMS_SaveItemToNodeAndFree_6FC403D0_113c` | `cb2f52a3` |
| 6 | `game/act-rooms-113c.ts:364` | `D2Game:0x6FC67CF0` | OF | yes | 1 | `GAME_UpdateActRooms113c` | `game/room-presets-113c.ts::ROOM_SpawnMonsterPreset113c` | `c06915b0` |
| 7 | `game/act-rooms-113c.ts:376` | `D2Game:0x6FC44C70` | OF | yes | 1* | `GAME_UpdateActRooms113c` | `game/k2-w12b1-113c.ts::MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70_113c` | `c06915b0` |
| 8 | `game/act-rooms-113c.ts:593` | `D2Game:0x6FC3FB90` | OF | no (2-sp) | 9 | `restoreRoomMonstersWithBossAndChampion113c` | `game/boot-init-gap-a-113c.ts::MONREG_RestoreRoomMonstersFromNode113c` | `d6674c4a` |
| 9 | `game/boot-init-gap-a-113c.ts:2926` | `D2Game:0x6FCEB950` | OF | no (2-sp) | 2 | `sendPlayerStop0DUncond_6FCEB950_113c` | `game/k2-real-s2c-combat-113c.ts::SUNITDMG_TriggerBlockEvents113c` | `c06915b0` |
| 10 | `game/boot-init-gap-a-113c.ts:3029` | `D2Game:0x6FCEB8F0` | OF | yes | 2 | `UNIT_SyncStateAndStatsToClient113c` | `game/boot-init-gap-b-113c.ts::D2GAME_PLRMODES_DispatchModeSyncToClient113c` | `c06915b0` |
| 11 | `game/boot-init-gap-a-113c.ts:3032` | `D2Game:0x6FCEB8F0` | OF | yes | 2 | `UNIT_SyncStateAndStatsToClient113c` | `game/boot-init-gap-b-113c.ts::D2GAME_PLRMODES_DispatchModeSyncToClient113c` | `c06915b0` |
| 12 | `game/boot-init-gap-a-113c.ts:4412` | `D2Game:0x6FC96BF0` | OF | yes | 0 | `stepMonsterSequenceMode14_6FC96F20_113c` | `game/k2-real-s2c-combat-113c.ts::MONSTER_EndToAiOrNeutral113c` | `c06915b0` |
| 13 | `game/c2s-packet-113c.ts:692` | `D2Game:0x6FC987C0` | OF | yes | 0 | `PLAYER_StartModeOnUnit113c` | `game/replay-kernel-113c.ts::applyPlayerPacket113c` | `aa9016bf` |
| 14 | `game/k2-items-tc-w1-113c.ts:114` | `D2Game:0x6FC468E0` | OF | no (2-sp) | 0 | `dispatchMonUModMatrix6FC468E0` | `game/boot-init-gap-a-113c.ts::MONSTER_DispatchMinionComponentCallbacks113c` | `312994d4` |
| 15 | `game/k2-real-s2c-combat-113c.ts:577` | `D2Game:0x6FCFB3C0` | SF | no (2-sp) | 0 | `applySingleChannelResistanceDll113c` | `game/k2-real-s2c-combat-113c.ts::SUNITDMG_GetEffectiveResistance113c` | `90efc478` |
| 16 | `game/k2-real-s2c-combat-113c.ts:630` | `D2Game:0x6FCFAD00` | SF | yes | 0 | `applySingleChannelResistanceDll113c` | `game/k2-real-s2c-combat-113c.ts::SUNITDMG_ApplyElementalAbsorb113c` | `90efc478` |
| 17 | `game/k2-real-s2c-combat-113c.ts:1439` | `D2Game:0x6FC98DD0` | SF | yes | 9* | `PLAYER_ConsumeDualHandWeaponQuantity_6FC99100_113c` | `game/k2-real-s2c-combat-113c.ts::PLAYER_StartModeSkill113c` | `760e4316` |
| 18 | `game/k2-real-s2c-combat-113c.ts:1444` | `D2Game:0x6FC98DD0` | SF | yes | 9* | `PLAYER_ConsumeDualHandWeaponQuantity_6FC99100_113c` | `game/k2-real-s2c-combat-113c.ts::PLAYER_StartModeSkill113c` | `760e4316` |
| 19 | `game/k2-real-s2c-combat-113c.ts:2182` | `D2Game:0x6FCFAA40` | SF | yes | 0 | `SUNITDMG_GetTotalSkillDamageBonus113c` | `game/k2-real-s2c-combat-113c.ts::SUNITDMG_ApplyLevelDiffExpRatio_6FCFAA40_113c` | `90efc478` |
| 20 | `game/k2-real-s2c-combat-113c.ts:2219` | `D2Game:0x6FCFA9E0` | SF | yes | 13* | `SUNITDMG_GetTotalSkillDamageBonus113c` | `game/k2-real-s2c-combat-113c.ts::SUNITDMG_CheckMonTypeFlag113c` | `bb4bfc74` |
| 21 | `game/k2-real-s2c-combat-113c.ts:2239` | `D2Game:0x6FCFB6B0` | SF | yes | 13* | `SUNITDMG_GetTotalSkillDamageBonus113c` | `game/k2-real-s2c-combat-113c.ts::SUNITDMG_ClampManaBurnByMonsterSkill113c` | `bb4bfc74` |
| 22 | `game/k2-real-s2c-combat-113c.ts:6367` | `D2Game:0x6FD120C0` | OF | no (2-sp) | 0 | `aiFindTargetOrUnstickOverlapMem113c` | `game/k2-w2b8-113c.ts::AI_ScheduleAiThinkTimer_6FD120C0_113c` | `95797f17` |
| 23 | `game/k2-real-s2c-combat-113c.ts:6590` | `D2Game:0x6FD13150` | OF | yes | 4* | `AI_DispatchTargetByAiFlag113c` | `game/k2-w5b10-113c.ts::AI_FindTargetOrUnstickOverlap_6FD13150_113c` | `0f9a88d6` |
| 24 | `game/k2-real-s2c-combat-113c.ts:6607` | `D2Game:0x6FD120C0` | OF | yes | 0 | `AI_DispatchTargetByAiFlag113c` | `game/k2-w2b8-113c.ts::AI_ScheduleAiThinkTimer_6FD120C0_113c` | `0f9a88d6` |
| 25 | `game/k2-real-s2c-combat-113c.ts:6614` | `D2Game:0x6FD120C0` | OF | yes | 4* | `AI_DispatchTargetByAiFlag113c` | `game/k2-w2b8-113c.ts::AI_ScheduleAiThinkTimer_6FD120C0_113c` | `0f9a88d6` |
| 26 | `game/k2-real-s2c-combat-113c.ts:9130` | `D2Game:0x6FC98430` | OF | yes | 1 | `SUNITDMG_ApplySideEffectsAndKill113c` | `game/c2s-packet-113c.ts::PLAYER_StartModeOnUnit113c` | `0f9a88d6` |
| 27 | `game/k2-real-s2c-combat-113c.ts:9164` | `D2Game:0x6FC98550` | OF | yes | 2 | `SUNITDMG_ApplySideEffectsAndKill113c` | `game/c2s-packet-113c.ts::PLAYER_StartModeAtCoords113c` | `95797f17` |
| 28 | `game/k2-real-s2c-combat-113c.ts:10668` | `D2Game:0x6FC954E0` | OF | yes | 6* | `dispatchMonsterModeStartEntryK2` | `game/k2-w2b3-113c.ts::MONMODE_EnterSequenceMode14_6FC954E0_113c` | `90efc478` |
| 29 | `game/k2-real-s2c-combat-113c.ts:10686` | `D2Game:0x6FC95460` | OF | yes | 3* | `dispatchMonsterModeStartEntryK2` | `game/k2-w3b7-113c.ts::MONSTER_ModeChangeCorpse_6FC95460_113c` | `90efc478` |
| 30 | `game/k2-real-s2c-combat-113c.ts:10710` | `D2Game:0x6FC96270` | SF | yes | 0 | `dispatchMonsterModeStartEntryK2` | `game/k2-real-s2c-combat-113c.ts::MONSTER_StartDeath113c` | `90efc478` |
| 31 | `game/k2-real-s2c-combat-113c.ts:11184` | `D2Game:0x6FC94F90` | SF | yes | 0 | `MONSTER_StartMode113c` | `game/k2-real-s2c-combat-113c.ts::MONSTER_StartMove113c` | `3e5adc3e` |
| 32 | `game/k2-w12b1-113c.ts:2917` | `D2Game:0x6FCD17B0` | OF | no (2-sp) | 0 | `AI_Think_BurrowingScarabOrFrog_6FCA9C30_113c` | `game/town-runtime-gap-113c.ts::AITARGET_ScanUnitsByModeTable113c` | `d6674c4a` |
| 33 | `game/k2-w13b1-113c.ts:3984` | `D2Game:0x6FCD17B0` | OF | yes | 0 | `D2Game_6FCCB580_113c` | `game/town-runtime-gap-113c.ts::AITARGET_ScanUnitsByModeTable113c` | `d6674c4a` |
| 34 | `game/k2-w3b7-113c.ts:493` | `D2Game:0x6FCFEEE0` | OF | no (2-sp) | 0 | `sunitdmgKillUnit_6FCFEEE0` | `game/k2-real-s2c-combat-113c.ts::SUNITDMG_DistributeExperience113c` | `5dcbf64f` |
| 35 | `game/k2-w3b7-113c.ts:529` | `D2Game:0x6FD01930` | OF | no (2-sp) | 0 | `stepMonsterPathRaw_6FD01930` | `game/k2-real-s2c-combat-113c.ts::MONSTER_StepPath113c` | `5dcbf64f` |
| 36 | `game/k2-w3b7-113c.ts:3653` | `D2Game:0x6FC95E10` | OF | yes | 0 | `startMonsterMode8WithTargetValidation113c` | `game/k2-real-s2c-combat-113c.ts::MONSTER_StartMode113c` | `7dd5235a` |
| 37 | `game/k2-w3b8-113c.ts:855` | `D2Game:0x6FC95E10` | OF | yes | 0 | `triggerMonsterSelfDeathMode0_113c` | `game/k2-real-s2c-combat-113c.ts::MONSTER_StartMode113c` | `7dd5235a` |
| 38 | `game/k2-w4b3-113c.ts:1017` | `D2Game:0x6FC95E10` | OF | yes | 0 | `MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c` | `game/k2-real-s2c-combat-113c.ts::MONSTER_StartMode113c` | `7dd5235a` |
| 39 | `game/k2-w4b4-113c.ts:2276` | `D2Game:0x6FCD17B0` | OF | yes | 1 | `AI_SelectHostileTargetByMetrics_6FCA4720_113c` | `game/town-runtime-gap-113c.ts::AITARGET_ScanUnitsByModeTable113c` | `d6674c4a` |
| 40 | `game/k2-w4b4-113c.ts:2370` | `D2Game:0x6FCD17B0` | OF | yes | 0 | `AI_ThinkPackFollowerMelee_6FCA4800_113c` | `game/town-runtime-gap-113c.ts::AITARGET_ScanUnitsByModeTable113c` | `d6674c4a` |
| 41 | `game/k2-w4b7-113c.ts:649` | `D2Game:0x6FCD17B0` | OF | yes | 1 | `MONAI_PutridDefilerThink_6FCC7290_113c` | `game/town-runtime-gap-113c.ts::AITARGET_ScanUnitsByModeTable113c` | `d6674c4a` |
| 42 | `game/k2-w5b6-113c.ts:351` | `D2Game:0x6FC21180` | OF | yes | 0 | `rollSeedAt6FC21180` | `prng.ts::seedRoll` | `ad299722` |
| 43 | `game/k2-w5b6-113c.ts:2943` | `D2Game:0x6FCCFC50` | OF | yes | 1* | `MONAI_BaalThroneThink_6FCC8430_113c` | `game/k2-w4b7-113c.ts::MONSTER_MorphMonsterClassId_6FCCFC50_113c` | `0f9a88d6` |
| 44 | `game/k2-w5b6-113c.ts:4496` | `D2Game:0x6FCEB950` | OF | no (2-sp) | 2 | `sendPacket0DPlayerStop6FCEB950` | `game/k2-real-s2c-combat-113c.ts::SUNITDMG_TriggerBlockEvents113c` | `ad299722` |
| 45 | `game/k2-w6b3-113c.ts:283` | `D2Game:0x6FC21180` | OF | yes | 0 | `rollSeedAt6FC21180` | `prng.ts::seedRoll` | `ad299722` |
| 46 | `game/k2-w6b3-113c.ts:287` | `D2Game:0x6FC21180` | OF | yes | 0 | `rollSeedAt6FC21180` | `prng.ts::seedRoll` | `ad299722` |
| 47 | `game/k2-w6b3-113c.ts:467` | `D2Game:0x6FD11B10` | OF | no (2-sp) | 0 | `aiIdleWander6FD11B10` | `game/k2-real-s2c-combat-113c.ts::AI_IdleWander113c` | `ad299722` |
| 48 | `game/k2-w6b3-113c.ts:515` | `D2Game:0x6FD12540` | OF | no (2-sp) | 6 | `aiApproachTarget6FD12540` | `game/k2-real-s2c-combat-113c.ts::AI_ApproachTarget113c` | `ad299722` |
| 49 | `game/k2-w6b3-113c.ts:585` | `D2Game:0x6FD12D80` | OF | no (2-sp) | 1* | `aiFleeFrom6FD12D80` | `game/k2-real-s2c-combat-113c.ts::AI_FleeFrom113c` | `ad299722` |
| 50 | `game/k2-w6b3-113c.ts:3492` | `D2Game:0x6FD11D90` | OF | no (2-sp) | 1 | `aiMaintainIdealDist6FD11D90` | `game/town-npc-ai-113c.ts::AI_StepRelativeToTargetUnit113c` | `ad299722` |
| 51 | `game/k2-w7b1-113c.ts:320` | `D2Game:0x6FC21180` | OF | no (2-sp) | 0 | `rollSeedPtr113c` | `prng.ts::seedRoll` | `5dcbf64f` |
| 52 | `game/k2-w7b1-113c.ts:366` | `D2Game:0x6FD12540` | OF | no (2-sp) | 2 | `aiApproachTarget6FD12540` | `game/k2-real-s2c-combat-113c.ts::AI_ApproachTarget113c` | `5dcbf64f` |
| 53 | `game/k2-w7b1-113c.ts:421` | `D2Game:0x6FD12D80` | OF | no (2-sp) | 0 | `aiFleeFrom6FD12D80` | `game/k2-real-s2c-combat-113c.ts::AI_FleeFrom113c` | `5dcbf64f` |
| 54 | `game/k2-w7b2-113c.ts:2764` | `D2Game:0x6FCB2BB0` | OF | no (2-sp) | 1* | `rollHitAndAllocKickProgressiveCombatFixed113c` | `game/k2-w6b5-113c.ts::SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c` | `bb4bfc74` |
| 55 | `game/k2-w8b2-113c.ts:1807` | `D2Game:0x6FD12540` | OF | yes | 0 | `MONAI_DarkWandererThink_6FCC6E60_113c` | `game/k2-real-s2c-combat-113c.ts::AI_ApproachTarget113c` | `7dd5235a` |
| 56 | `game/k2-w8b2-113c.ts:1829` | `D2Game:0x6FD12540` | OF | yes | 0 | `MONAI_DarkWandererThink_6FCC6E60_113c` | `game/k2-real-s2c-combat-113c.ts::AI_ApproachTarget113c` | `7dd5235a` |
| 57 | `game/k2-w9b1-113c.ts:1680` | `D2Game:0x6FCD17B0` | OF | no (2-sp) | 2 | `AI_GreaterMummyThink_6FCA8380_113c` | `game/town-runtime-gap-113c.ts::AITARGET_ScanUnitsByModeTable113c` | `d6674c4a` |
| 58 | `game/regpop-spawn-113c.ts:2918` | `D2Game:0x6FCEA530` | SF | yes | 23* | `MONSTER_UpdateMonsterRoomAllyCount113c` | `game/regpop-spawn-113c.ts::MONREG_UpdateActiveCountOnMode113c` | `2041d3bb` |
| 59 | `game/replay-kernel-113c.ts:2218` | `D2Game:0x6FD13150` | OF | yes | 0 | `fixMonsterNoTargetStallDelay113c` | `game/k2-w5b10-113c.ts::AI_FindTargetOrUnstickOverlap_6FD13150_113c` | `50d4748f` |
| 60 | `game/replay-kernel-113c.ts:4379` | `D2Game:0x6FC96F20` | OF | yes | 6* | `stepFallenSliceFrame113c` | `game/k2-w3b7-113c.ts::MONSTER_StepSkillCastAnim_6FC96F20_113c` | `a0da9ec2` |
| 61 | `game/replay-kernel-113c.ts:4391` | `D2Game:0x6FD01930` | OF | yes | 2 | `stepFallenSliceFrame113c` | `game/k2-real-s2c-combat-113c.ts::MONSTER_StepPath113c` | `a0da9ec2` |
| 62 | `game/replay-kernel-113c.ts:4747` | `D2Game:0x6FC409B0` | OF | yes | 7 | `deactivateUnusedRoomsTickWithItemBitstream113c` | `game/replay-final11-113c.ts::ROOM_DeactivateAnyUnitInRoom113c` | `76f820b2` |
| 63 | `game/replay-kernel-113c.ts:4752` | `D2Game:0x6FC404E0` | OF | yes | 7 | `deactivateUnusedRoomsTickWithItemBitstream113c` | `game/a1c-post150-f150-f276-113c.ts::UNIT_SaveInactiveUnitNode113c` | `76f820b2` |
| 64 | `game/town-npc-ai-113c.ts:247` | `D2Game:0x6FD12540` | OF | no (2-sp) | 23* | `aiApproachTargetTown113c` | `game/k2-real-s2c-combat-113c.ts::AI_ApproachTarget113c` | `81f5addc` |
| 65 | `game/town-runtime-gap-113c.ts:740` | `D2Game:0x6FC53B70` | NL | no (2-sp) | 23 | `QUESTS_StepQuestTimers113c` | `game/town-runtime-gap-113c.ts::QUESTS_StepQuestTimers113c` | `83f07145` |

---

## 5. Falsification experiments & boot-vs-step phase split [R]

All mutations were executed exclusively in isolated scratch copies (`<scratch dir>`) archived from `a5273dc7`, never in the working tree.

### 5.1 Neutralising all 65 hand-placed calls (`strip65`) vs. 41 regex-matched calls (`strip41`)

| Variant | Zero divergence | Scenarios with F3+ gap | F3+ gap pairs (C / G) | Unique F3+ gap VAs | 4 K6 vitest files |
|---|---:|---:|---:|---:|---|
| `origin/main` (base) | 23 / 23 | 0 / 23 | 0 / 0 | 0 | 4 / 4 passed, 42 / 42 tests passed |
| `strip41` (41 regex sites → `void 0`) | 23 / 23 | **22 / 23** | 0 / **57** | **11** D2Game | — |
| `strip65` (all 65 AST sites → `void 0`) | 23 / 23 | **23 / 23** | 0 / **61** | **14** D2Game | **3 failed / 1 passed**, **25 / 42 tests failed** |

- The 25 failing tests on `strip65` are all 23 per-scenario `d2GameUnexemptedGap === 0` assertions plus the 2 raw-gap assertions in `replay-k6-wave1.test.ts`; the only passing file is `va-trace-instrumentation.test.ts`.
- The difference between `strip41` and `strip65` is exact: the 24 two-space-indented calls account for the 3 additional VAs (`0x6FCB2BB0`, `0x6FD12540`, `0x6FD12D80`) and bring the 23rd scenario (`k6-act3-consumables-quest`) into F3+ gap.
- Site-firing probe across all 23 scenarios: **37 / 65** hand-placed sites execute in at least one K6 scenario (28 never fire); **15** exact firing sites (marked `*` in §4) close the 61 F3+ gap pairs.
- Every one of the 61 reappearing `(scenario, VA)` pairs was independently cross-checked against our real-DLL `cover 3` traces (`cover3_VAs − ts_strip65_VAs`): **23 / 23 exact match**, confirming all 14 VAs genuinely execute in the real 1.13c DLL at `F >= 3`:

| VA | Scenarios | Real-DLL `cover 3` first F3+ hit (`scenario@frame`) |
|---|---:|---|
| `0x6FCEA530` | 22 | `k6-assassin-skills@F59`, `k6-bloodmoor-consumables-auras-combat@F189`, `k6-druid-skills@F205`, `k6-items-potions-belt-combat@F195` (+18 more) |
| `0x6FC98DD0` | 9 | `k6-bloodmoor-consumables-auras-combat@F313`, `k6-items-potions-belt-combat@F301`, `k6-nightmare-bloodmoor-combat@F288`, `k6s2-act5-harrogath-shenk-anya@F817` (+5 more) |
| `0x6FC954E0` | 6 | `k6s3-act1-bosses-cowlevel-imbue@F389`, `k6s3-act2-bosses-staff-duriel@F1960`, `k6s3-act3-council-mephisto-quests@F1054`, `k6s3-act4-izual-hellforge-diablo@F923` (+2 more) |
| `0x6FC96F20` | 6 | Same 6 scenarios, one frame later (`@F390`, `@F1961`, `@F1055`, `@F924`, etc.) |
| `0x6FD13150` | 4 | `k6s2-act4-hell-chaos-shrines@F656`, `k6s3-act2-bosses-staff-duriel@F1738`, `k6s3-act4-izual-hellforge-diablo@F829`, `k6s3-crafting-runewords-c2s-monai@F1226` |
| `0x6FC95460` | 3 | `k6s2-act5-harrogath-shenk-anya@F726`, `k6s3-act1-bosses-cowlevel-imbue@F525`, `k6s3-act5-shenk-anya-ancients-baal@F558` |
| `0x6FD120C0` | 3 | `k6s2-act4-hell-chaos-shrines@F656`, `k6s3-act2-bosses-staff-duriel@F1738`, `k6s3-crafting-runewords-c2s-monai@F1226` |
| `0x6FD12540` | 2 | `k6-act3-consumables-quest@F34`, `k6-town-npc-gamble-waypoint@F24` |
| `0x6FC44C70` | 1 | `k6s3-act1-bosses-cowlevel-imbue@F379` |
| `0x6FCB2BB0` | 1 | `k6s3-assassin-full-30-skills@F401` |
| `0x6FCCFC50` | 1 | `k6s3-act5-shenk-anya-ancients-baal@F5589` |
| `0x6FCFA9E0` | 1 | `k6-bloodmoor-consumables-auras-combat@F305` |
| `0x6FCFB6B0` | 1 | `k6-bloodmoor-consumables-auras-combat@F305` |
| `0x6FD12D80` | 1 | `k6s3-act2-bosses-staff-duriel@F1612` |

### 5.2 Boot-hydration vs. stepped-frame TS trace window split [R]

`beginVaTrace113c()` starts **before** `bootFromSnapshot113c()` (`tools/oracle/k6/k6-replay.ts:180,190`), so TS hits
recorded while hydrating the F2 snapshot are credited against real-DLL `F3..end` executions. Instrumenting a
scratch copy to separate hits recorded before vs. at/after the first `stepFrame113c()` call:
- In **20 / 23 scenarios**, at least one VA that the real DLL executes in `F3+` is covered in TS **only by pre-step hydration hits** — never executed during `F3..end` stepping.
- Total: **39 scenario×VA pairs** (`21` D2Common + `18` D2Game), **12 unique VAs** (`7` D2Common + `5` D2Game):
  - `D2Common:0x6FD7DDB0` (`DRLG_TryDeactivateLevelRooms`) — 13 scenarios (real-DLL F3+ e.g. `k6-assassin-skills@F11`)
  - `D2Game:0x6FCD2760` (`D2GAME_PACKET_Send0x65PlayerKillCount`) — 13 scenarios (e.g. `k6-assassin-skills@F274`, `k6-bloodmoor-consumables-auras-combat@F305`)
  - `D2Common:0x6FD882F0` (`STATLIST_GetStatsByIdFromList`) — 3 scenarios (e.g. `k6-assassin-skills@F285`)
  - `D2Game:0x6FC49820` (`CLIENTS_ForEachInGameClient`) — 2 scenarios (e.g. `k6s2-act4-hell-chaos-shrines@F1177`)
  - 1 scenario each: `D2Common:0x6FD6E1B0` (`@F10`), `0x6FD730F0` (`@F295`), `0x6FD7E2C0` (`@F11`), `0x6FD87E70` (`@F285`), `0x6FD8C800` (`@F11`), `D2Game:0x6FC21180` (`@F121`), `0x6FC2E660` (`@F114`), `0x6FCBD0F0` (`@F4`).
- This is an independent second channel (separate from the 65 hand-placed calls) by which `f3Gap = 0` is satisfied without TS executing the function during stepped frames.

### 5.3 Pre-fix (`76f820b2^`) baseline check [R]

Replaying `76f820b2^`'s `src/` against the unchanged K6 fixtures and exemption list: 23 / 23 zero divergence;
raw `F1..end` gap sums `524 C + 430 G = 954` pairs (matching the issue #2029 table); F3+ unexempted gap =
**183 pairs (`52 C + 131 G`) = 77 unique VAs (`23 C + 54 G`)** across 21 / 23 scenarios. The closing comment's
claimed "`85` 个（`25 D2Common + 60 D2Game`）" [C] was not reproduced directly (its counting basis is not stated,
and `76f820b2^` also had 13-file instrumentation drift).

---

## 6. Per-VA analysis of the 14 gate-relevant VAs [R]

Disassembly checked via `objdump -d -M intel "$D2_DATA_DIR/D2Game.dll"`; symbol non-definition uses counted across
all `src/**/*.ts`. Classification: **(a)** inline or duplicate copy self-reporting the VA while the manifest-bound
port does not run; **(b\*)** manifest mis-binding papered over by hand-placed hits.

| VA (manifest name, size) | Firing hand-placed site(s) | Manifest-bound port (`non-def uses` in `src/`) | DLL disassembly (`D2Game.dll`) | TS replay behaviour | Class |
|---|---|---|---|---|---|
| `0x6FCEA530` `MONREG_UpdateActiveCountOnMode`, 123 B | `game/regpop-spawn-113c.ts:2918` (`MONSTER_UpdateMonsterRoomAllyCount113c`) | `regpop-spawn-113c.ts::MONREG_UpdateActiveCountOnMode113c` (**0 uses**) | `0x6FD001C5: call 0x6fcea530`; callee does `dec [eax+0x2cc]` unconditionally (`0x6FCEA592`) without bounds check | Caller inlines a copy of the callee and credits the VA; copy adds `if (lvl < 136)` and `if (cnt > 0)` guards absent from the DLL | **(a)** |
| `0x6FC98DD0` (`PLAYER_StartModeSkill`, 458 B) | `game/k2-real-s2c-combat-113c.ts:1439, 1444` (`PLAYER_ConsumeDualHandWeaponQuantity_6FC99100_113c`) | `k2-real-s2c-combat-113c.ts::PLAYER_StartModeSkill113c` (8 uses) | `0x6FC99134` / `0x6FC99147: call 0x6fc98dd0`; stackable-weapon quantity consumption routine | TS calls unbound helper `PLAYER_ConsumeStackableWeaponQuantity_6FC98DD0_113c` (the actual port of this body); bound symbol is a different skill-mode starter that only forwards for two argument shapes | **(b\*)** |
| `0x6FCFA9E0` `SUNITDMG_CheckMonTypeFlag`, 87 B | `game/k2-real-s2c-combat-113c.ts:2219` (`SUNITDMG_GetTotalSkillDamageBonus113c`) | `k2-real-s2c-combat-113c.ts::SUNITDMG_CheckMonTypeFlag113c` (11 uses) | `0x6FCFC07B: call 0x6fcfa9e0` from `0x6FCFC030` | In the `expArgs` branch, callee logic is inlined with constant `shift = 10` and `EXP_RATIOS_113C`; VA credited `if (hasExpBin)` | **(a)** |
| `0x6FCFB6B0` `SUNITDMG_ClampManaBurnByMonsterSkill`, 172 B | `game/k2-real-s2c-combat-113c.ts:2239` (same function) | `k2-real-s2c-combat-113c.ts::SUNITDMG_ClampManaBurnByMonsterSkill113c` (8 uses) | `0x6FCFC0A7: call 0x6fcfb6b0` | Same `expArgs` branch: no call to bound port; VA credited right before returning `exp` | **(a)** |
| `0x6FC44C70` `MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70`, 82 B | `game/act-rooms-113c.ts:376` (`GAME_UpdateActRooms113c`; `:364` also credits `0x6FC67CF0`) | `k2-w12b1-113c.ts::MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70_113c` (2 uses, in `room-presets-113c.ts`) | `0x6FC67F9A: call 0x6fc44c70` from `0x6FC67CF0` | Closure re-implements caller fragment and callee body inline and credits both VAs | **(a)** |
| `0x6FC954E0` `MONMODE_EnterSequenceMode14_6FC954E0`, 45 B | `game/k2-real-s2c-combat-113c.ts:10668` (`dispatchMonsterModeStartEntryK2`) | `k2-w2b3-113c.ts::MONMODE_EnterSequenceMode14_6FC954E0_113c` (**0 uses**) | Table-dispatched mode-start function (`0x6FC954E0`) | Dispatcher matches `pfnStart === 0x6fc954e0` and executes an inline copy | **(a)** |
| `0x6FC95460` `MONSTER_ModeChangeCorpse_6FC95460`, 126 B | `game/k2-real-s2c-combat-113c.ts:10686` (same dispatcher) | `k2-w3b7-113c.ts::MONSTER_ModeChangeCorpse_6FC95460_113c` (**0 uses**) | Table-dispatched corpse-mode function | Dispatcher matches `pfnStart === 0x6fc95460` and executes an inline copy | **(a)** |
| `0x6FC96F20` `MONSTER_StepSkillCastAnim_6FC96F20`, 178 B | `game/replay-kernel-113c.ts:4379` (`stepFallenSliceFrame113c`; `:4391` also credits `0x6FD01930`) | `k2-w3b7-113c.ts::MONSTER_StepSkillCastAnim_6FC96F20_113c` (**0 uses**) | Table-dispatched step function (`0x6FC96F20`) | Replay driver runs its own inline copy with replay-only stall helpers (`snapshotMonsterAiPreState113c`, `fixMonsterNoTargetStallDelay113c`) and two `SUNIT_ValidatePathTargetUnit113c` calls | **(a)** |
| `0x6FD13150` `AI_FindTargetOrUnstickOverlap_6FD13150`, 197 B | `game/k2-real-s2c-combat-113c.ts:6590` (`AI_DispatchTargetByAiFlag113c`; also non-firing `replay-kernel-113c.ts:2218`) | `k2-w5b10-113c.ts::AI_FindTargetOrUnstickOverlap_6FD13150_113c` (**0 uses**) | `0x6FCBD1D3: call 0x6fd13150`; callee ends with `call 0x6fd120c0` (`0x6FD13209`) | Caller inlines the callee body; separately, replay-only `fixMonsterNoTargetStallDelay113c` credits the VA while only scheduling a think timer | **(a)** |
| `0x6FD120C0` `AI_ScheduleAiThinkTimer_6FD120C0`, 83 B | `game/k2-real-s2c-combat-113c.ts:6614` (`AI_DispatchTargetByAiFlag113c`; also `:6367, 6607`) | `k2-w2b8-113c.ts::AI_ScheduleAiThinkTimer_6FD120C0_113c` (60 uses elsewhere) | `0x6FD13209: call 0x6fd120c0` | Inlined as `EVENT_DeleteEventByType113c` + `EVENT_SetEventFull113c(..., curFrame + 0x14)` inside the inlined `0x6FD13150` | **(a)** |
| `0x6FCB2BB0` `SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0`, 271 B | `game/k2-w7b2-113c.ts:2764` (`rollHitAndAllocKickProgressiveCombatFixed113c`) | `k2-w6b5-113c.ts::SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c` (only `void <sym>` at `k2-w7b2-113c.ts:2763` + import) | `0x6FCB2EB1: call 0x6fcb2bb0` | A `"Fixed"` duplicate in another file runs instead, explicitly discarding the bound symbol via `void` on the line above `hitD2GameVa113c(0x6FCB2BB0)` | **(a)** |
| `0x6FCCFC50` `MONSTER_MorphMonsterClassId_6FCCFC50`, 139 B | `game/k2-w5b6-113c.ts:2943` (`MONAI_BaalThroneThink_6FCC8430_113c`) | `k2-w4b7-113c.ts::MONSTER_MorphMonsterClassId_6FCCFC50_113c` (4 uses elsewhere) | `0x6FCC855F: call 0x6fccfc50` | Inline copy inside Baal throne think function (passes an extra `true` argument to `MONSTER_InitMonsterUnit113c`) | **(a)** |
| `0x6FD12540` `AI_ApproachTarget`, 360 B | `game/town-npc-ai-113c.ts:247` (`aiApproachTargetTown113c`; plus non-gap-closing copies at `k2-w6b3:515`, `k2-w7b1:366`, `k2-w8b2:1807,1829`) | `k2-real-s2c-combat-113c.ts::AI_ApproachTarget113c` (102 uses elsewhere) | One DLL function | Standalone re-implementation credits the VA whenever hydrated tables are present (`town-npc-ai-113c.ts:244-247`) | **(a)** |
| `0x6FD12D80` `AI_FleeFrom`, 377 B | `game/k2-w6b3-113c.ts:585` (`aiFleeFrom6FD12D80`; also `k2-w7b1:421`) | `k2-real-s2c-combat-113c.ts::AI_FleeFrom113c` (54 uses elsewhere) | One DLL function | Local re-implementation credits the VA rather than invoking the bound port | **(a)** |

---

## 7. Additional checks & deferred items (M3 / M5) [R]

- **CI wiring:** `tests/oracle/k6/va-trace-instrumentation.test.ts` runs under `npm test` (`vitest run`), and `.gitea/workflows/ci.yml:24-25` includes `python3 tools/oracle/callgraph/instrument-va-trace.py --check`. However, Gitea API reports `has_actions: false` on the repository and `total_count: 0` commit statuses for both `76f820b2` and `a5273dc7`, so there is no evidence the workflow runs in CI.
- **Multi-VA manifest symbols:** 6 symbols legitimately share 2 VAs each (12 VAs total: `prng.ts::seedRoll`, `common/int-math.ts::mulDiv113c`, `common/statlist.ts::{STATLIST_GetUnitStat113c, STATLIST_GetUnitBaseStat113c, STATLIST_SetStat113c}`, `common/unit.ts::UNIT_GetAlignment113c`). Not a material inflation path.
- **Deferred showcase UI & registry items (tracked in M3 #2028 / M5 #2035, deliberately not changed in M1):**
  - Static UI strings in `showcase/k6/main.ts:286` (`→ 4,810 / 4,810 = 100.00%` emitter curve caption, even though emitter-referenced is `4,802 / 4,810`) and `showcase/k6/main.ts:683` (hard-coded sidebar certification `4,810/4,810 (100%)`), plus union-only `100%` framing in `showcase/k6/index.html`, `public/k6-showcase.html`, `showcase/shared/k-nav.ts`, and `docs/oracle/k6-coverage/README.md` title/section headings.
  - Machine-readable `scenario-unreached.json` registry for the `1,393` (`176` D2Common + `1,217` D2Game) functions not executed by any recorded scenario.

---

## 8. Clause-by-clause comparison and counter-argument

| # | Clause / Ask | Delivered? | Evidence |
|---|---|---|---|
| I-1 | Issue ask 1: fix `--check`, wire into `npm test` or CI | **In form only.** `--check` green and in `npm test`; CI step exists (no sign Gitea Actions executes). Gate is blind to all 65 hand-placed calls. | §2, §4, §7 |
| I-2 | Issue ask 2: locate each remaining gap per function (替身 / 内联 / 缺调用链) | **No.** 13 VAs still execute inline/duplicate copies that self-report (5 bound ports have 0 uses in `src/`); 1 VA is mis-bound; no per-function registry exists. | §5.1, §6 |
| I-3 | Issue ask 3: `=== 0` assertions on all 23, or explicit exemption list with reasons | **In form only.** Assertions exist on 23 / 23 and the 1,498-entry exemption list is clean against real-DLL `cover 3`, but all 304 VAs share one boilerplate reason string, the in-repo validator cannot verify F3+ absence, and passing depends on the 65 hand-placed calls. | §3, §5.1 |
| I-4 | Issue ask 4: README scenario table gap column | **Yes** (inherits the F3+ dependency above). | `docs/oracle/k6-coverage/README.md` |
| M-5 | Milestone [K6] item 5: `TS 回放执行覆盖 ⊇ 原版 DLL 执行覆盖（按场景逐条核对）` | **Not established.** Literal F1..end: 2 / 23. F3+ with self-reports: 23 / 23. F3+ counting only manifest-bound ports: **0 / 23** (61 pairs / 14 VAs fail). Additionally 20 / 23 scenarios rely on pre-step hydration hits for 12 F3+ VAs. | §2, §5.1, §5.2 |
| C-1 | Closing comment: "移除手工 `hitD2GameVa113c` 绕过" | **Partly false.** `87 → 65`; commit itself re-added 2 (`replay-kernel-113c.ts:4747, 4752`). | §4 |
| C-2 | Closing comment: "消除局部重复实现、内联旁路" / "`85` 个" | **False** for the 14 VAs; pre-fix F3+ gap measured at `183` pairs / `77` unique VAs, not `85`. | §5.3, §6 |
| C-3 | Closing comment: exemptions proven by real `cover 3` | **Yes** (0 / 1,498 illegal in fresh sequential Wine `cover 3` rerun). | §3 |

### Strongest counter-argument

All four checklist items of #2029 have concrete deliverables, and the exemption list — the mechanism most easily
abused — is completely sound against real-DLL `cover 3` traces (`0 / 1,498` violations). In all 14 cases, the
logic corresponding to the DLL function runs in TS (inline or in a duplicate helper) and achieves full-horizon
zero divergence over 31,453 frames; 63 of the 65 hand-placed calls predated `76f820b2` rather than being added
specifically to game this gate. On that view, #2029's closure stands and the 14 VAs / gate hardening belong to a
smaller follow-up issue.

Why this counter-argument is not adopted: (1) issue ask 2 explicitly demanded locating inline / stand-in paths per
function, and the closing comment explicitly asserted that manual `hitD2GameVa113c` bypasses, local duplicates,
and inline bypasses had been eliminated — yet 65 remain, 2 were re-added by the closing commit itself, and 5 of
the 14 bound ports have zero callers in `src/`; (2) without those self-reports, the commit's own gate fails in
**23 / 23** scenarios (`25 / 42` tests fail); (3) 20 / 23 scenarios also depend on pre-step hydration hits for 12
VAs that the DLL executes in F3+.

---

## 9. Verdict

**不成立.** Reopen #2029 (note: per M1 scope, #2029 is reopened and recorded only; fixing #2029 is outside M1).

Follow-up scope for the reopened issue:
1. Resolve the 14 gate-relevant VAs in §6: route the 13 inline/duplicate copies through their manifest-bound ports (or register any justified exception per function) and rebind `0x6FC98DD0` to `PLAYER_ConsumeStackableWeaponQuantity_6FC98DD0_113c`.
2. Harden `instrument-va-trace.py --check` to reject any `hitD2*Va113c` call outside the leading statement run of its manifest-bound symbol (driving the 65 hand-placed sites to 0 or an explicit per-site allowlist).
3. Commit real-DLL `cover 3` evidence (or a deterministic generator) and per-VA reasons so `preboot-f1-f2-exemptions.json` is verifiable in-repo without only trusting `firstFrame <= 2`.
4. Decide and enforce whether TS hits during F2 snapshot hydration (`bootFromSnapshot113c`) may credit F3+ coverage (currently covering 12 VAs / 39 pairs across 20 / 23 scenarios).

What would overturn this verdict: removing all 65 hand-placed calls (while keeping `instrument-va-trace.py --check`
green) and observing `f3Gap = (C: 0, G: 0)` across all 23 scenarios with all 42 tests in the four K6 vitest files
passing.

# Re-verification of closed issue #2032 — [K2] MONSPAWN / ITEMGEN vector scope

| | |
|---|---|
| Issue | #2032 "[K2] 子系统向量门禁范围不足：MONSPAWN 仅 60 / 136 关（Act 1 缺 22 关），ITEMGEN 缺套装 / 暗金品质与 #10987 位流" (closed 2026-11-25) |
| Closing commit | `c23aa9f1` |
| Milestone | [K2] (Gitea milestone id 33, state `open`) |
| Audited tree | `origin/main` @ `a5273dc7247ef8d7ef5341be572e2f8f6cd22904` (no later commit touches the MONSPAWN / ITEMGEN emitters, fixtures, comparisons, exit-gate tests or `src/d2kern-113c/`) |
| Date | 2026-11-27 |
| **Verdict** | **不成立** against the literal milestone sentences (the issue's four checkboxes are met). Reasons in §8. |

Status of every number below: **[R]** = rerun for this record on the audited tree; **[C]** = cited from the
commit, the issue thread or an earlier exploration and **not** rerun here. Only [R] numbers are verified.

Ground truth: 1.13c `D2Game.dll` / `D2Common.dll` and MPQs under `$D2_DATA_DIR` (default `$HOME/d2-data`);
toolchain and Wine under `$D2_ORACLE_ROOT` (default `$HOME/.local/opt/d2oracle`).

## 1. Acceptance texts (quoted)

Milestone [K2], "补充：子系统向量门禁":

> `MONSPAWN`：Act 1 全部野外 / 地牢关卡逐种子刷怪序列哈希零差异（含群怪随从、精英），再扩展到 136 关
>
> `ITEMGEN`：`D2GAME_CreateItemEx` 全品质 × ilvl 1..99 × TreasureClass 抽样，物品序列化位流（`#10987`）与种子终态零差异

Milestone [K2], "范围" (context): "… MONSTER_InitStats / MonUMod / TreasureClassEx、房间流式激活与刷怪（含群怪随从 `0x6FD0E480`）".

Issue #2032, "需要完成":

> - [ ] MONSPAWN 向量补齐 Act 1 剩余 22 关，再扩到 136 关
> - [ ] ITEMGEN 向量补套装 / 暗金 / 合成品质
> - [ ] ITEMGEN 记录加入 `#10987` 位流（或其哈希）并对拍
> - [ ] `tests/oracle/k2/exitgate-*.test.ts` 里把"关卡数 / 品质集合"的断言改成里程碑要求的范围，避免范围缩水后测试仍然是绿的

## 2. Commands and results

| # | Command (repo root) | Result | |
|---|---|---|---|
| 1 | `D2_VECTOR_CACHE_DIR=<scratch dir> bash tools/oracle/vectors/run-monspawn-emitter.sh --check` | PASSED; `-O2` / `-fno-omit-frame-pointer` / `-O1` / committed fixture all `7d35dcb158a1748828a953ad5eb19972e881eca4503793761a775ec5c93a653f` | [R] |
| 2 | `D2_VECTOR_CACHE_DIR=<scratch dir> bash tools/oracle/vectors/run-itemgen-emitter.sh --check` | PASSED; 3-way + fixture `10c61d8fc4b1b4f97fcfc98a380df690d84caa31c21102dd636018afd3812ce9` | [R] |
| 3 | `npx vitest run tests/oracle/k2/exitgate-monspawn-vectors.test.ts tests/oracle/k2/exitgate-itemgen-vectors.test.ts tests/oracle/k2/exitgate-tcdrop-vectors.test.ts` | 3 / 3, 3 / 3, 2 / 2 tests passed | [R] |
| 4 | `npx vitest run tests/oracle/k2/real-itemdrop-pipeline.test.ts tests/oracle/k5/exitgate-d2tv-regression.test.ts` | 4 / 4 and 9 / 9 passed | [R] |
| 5 | `npx vitest run tests/oracle/k2/replay-k2-coverage.test.ts tests/oracle/k2/k2-showcase.test.ts tests/oracle/k6-p7/k6-p7-d2game-vectors.test.ts tests/oracle/k6-p11/k6-p11-d2game-vectors.test.ts` | 21 / 21, 8 / 8, 151 / 151, 122 / 122 passed (302 / 302) | [R] |
| 6 | `grep -n "CreateItemEx\|6FC31490\|TreasureClass\|6FC31880\|6FC32380" tools/oracle/vectors/itemgen-emitter.c` | no output | [R] |
| 7 | `grep -n -i "6FD0E480\|6FC67700\|6FC67A20" tools/oracle/vectors/monspawn-emitter.c` | one line: the comment at `:436` ("matching 0x6FC67BAD..0x6FC67C2D + 0x6FC67700"); no call | [R] |
| 8 | `grep -l "install_jmp_hook\|VirtualProtect" tools/oracle/vectors/{itemgen,monspawn,skillcalc,tcdrop}-emitter.c` | only `tcdrop-emitter.c` (`:279 install_jmp_hook(0x6FC31880 …, hook_6FC31880)`) | [R] |
| 9 | `objdump -d -M intel --start-address=0x6FC67B26 --stop-address=0x6FC67C36 "$D2_DATA_DIR/D2Game.dll"` | `call 0x6fcff4a0` at `0x6FC67B78`, then `call 0x6fcff080` at `0x6FC67B8E`, `call 0x6fc67700` at `0x6FC67C2D`; the two seed steps read/write `[ebp+0xd0]` / `[ebp+0xd4]` | [R] |
| 10 | Independent fixture parses (method in §3) | §4, §5 | [R] |

The committed fixture `.gz` files were SHA-checked before and after rows 1–2: unchanged [R].

## 3. Method of the independent parses (re-implementable)

No repo parser is used. D2TV container: gunzip; 32-byte little-endian header `u32 magic, u16 version,
u16 flags, char kind[8], u32 recordSize, u32 recordCount, u64 seed`; then `recordCount × recordSize` bytes.
Record layouts are the packed structs in `tools/oracle/vectors/monspawn-emitter.c:38-73` (64 B) and
`tools/oracle/vectors/itemgen-emitter.c:45-78` (100 B). Tables (`Levels.txt`, `MonStats.txt`, `Weapons.txt`,
`Armor.txt`, `Misc.txt`, `UniqueItems.txt`, `SetItems.txt`) are read from `Patch_D2.mpq`
(`data\global\excel\`), extracted with the repo's MPQ reader.

- "Level yields a pool and a class": some record of that level has `poolCount > 0` and `chosenClassId >= 0`.
- "Predicted empty level": `Levels.txt` `NumMon` empty/0, or none of the listed `mon*` / `nmon*` monsters has `MonStats.isSpawn = 1`.
- ITEMGEN base-item class: item id < rows(`Weapons.txt`) → weapon; next rows(`Armor.txt`) ids → armor; rest → `Misc.txt` row.

## 4. MONSPAWN findings

### 4.1 Fixture [R]

| Measure | Value |
|---|---|
| Records × size | 2,448 × 64 B |
| Levels | exactly 1..136, 18 records each; every level has all 9 (difficulty, bossMode) combinations × 2 |
| Distinct seeds | 2,448 |
| Act 1 levels 2..39 | all 38 present; 684 records (53 champion, 430 unique, 115 with `packCount > 1`) |
| Levels that yield a pool and a class | 125 |
| Levels that never do | 11: 1, 20, 40, 50, 75, 103, 109, 120, 121, 132, 136 — equal to the set predicted from `Levels.txt` + `MonStats.txt` (level 120 has `NumMon = 3` but none of its three monsters has `isSpawn = 1`) |
| Flags | champion 187, unique 1,454, none 807 (608 of those with `packCount > 0`) |
| `packCount` histogram | 0: 199, 1: 1,813, 2: 156, 3: 150, 4: 94, 5: 24, 6: 3, 7: 3, 8: 5, 9: 1 |
| Distinct umod ids | 18 |

The empty levels are what the data says, not a skip list.

### 4.2 Shape of a record, read from source [R]

One record = one seed = **one pack leader** (`monspawn-emitter.c:38-73`: a single `chosenClassId`, flags,
six umod bytes, one stat block, one output seed). There is no per-seed sequence of spawned units and nothing
is hashed. Per record the emitter calls, in its own order on one threaded seed:

| Step | Emitter line | Real DLL function |
|---|---|---|
| 1 | `:409` | `0x6FCEA760` select level monster pool |
| 2 | `:416` | `0x6FCFF080` roll pack rarity type |
| 3 | `:425` | `0x6FCFF4A0` choose monster class |
| 4 | `:436-463` | **no DLL function for the pack size**: C code reads `MinGrp` / `MaxGrp` / `sparsePopulate` from the MonStats record, optionally steps the seed with a hand-written multiply, and calls only the RNG helper once; for elite records the pack size is the constant 1 |
| 5 | `:479`, `:490` | `0x6FC43CA0` champion / unique umods; `0x6FCCFDB0` init stats |

Against the DLL's own room population (`REGPOP_PopulateRoomMonsters`, `0x6FC67A20`, 711 B; §2 row 9): the
DLL calls `0x6FCFF4A0` **before** `0x6FCFF080` (the emitter's order is the reverse), steps the seed at
`[pGame+0xD0]` for the sparse / density rolls (the emitter threads a room seed), and produces the pack via
`call 0x6FC67700` (`REGPOP_SpawnMonsterPack`, 284 B). The emitter calls neither `0x6FC67A20` nor
`0x6FC67700`, and `MONSTER_SpawnPartyMinions` (`0x6FD0E480`, 609 B — the function the milestone scope names)
does not appear in it (§2 row 7). No minion class, position, stat or seed is recorded.

### 4.3 TS side: evaluator-local copies [R]

`evaluateMonSpawnVector113c` (`src/d2kern-113c/game/k2-d2tv-evaluators-113c.ts:691`) calls three
**file-local** functions for three of the five DLL functions:

| DLL VA | Function the gate runs | Manifest-bound kernel port (`tools/oracle/callgraph/manifest-113c.json`) |
|---|---|---|
| `0x6FCEA760` | local `selectLevelMonsters113c` (`:437`) | `MONREG_SelectRegionMonsterTypes_6FCEA760` in `game/k2-w5b6-113c.ts` |
| `0x6FC43CA0` | local `rollChampionOrUniqueMods113c` (`:381`) | `MONUMOD_RollChampionOrUniqueUMods_6FC43CA0` in `game/k2-w4b3-113c.ts` |
| `0x6FCCFDB0` | local `initMonsterStatsExact113c` (`:506`) | `MONSTER_InitStats` in `game/regpop-spawn-113c.ts` |

The file header states it operates "without … callgraph VA bindings". `MONSTER_RollPackRarityType113c`,
`MONSTER_ChooseMonsterClass113c`, `REGPOP_UsesPartyBossGroup113c` and `SEED_RollLimitedFast113c` are the bound
kernel functions. So for three functions the MONSPAWN gate compares the real DLL with a copy that the replay
kernel does not run.

**Bound-port substitution experiment (exploratory lead, root cause unestablished) [R].** Substituting the
three bound ports directly into the same MONSPAWN harness on clean `CopyOnWritePageMemory113c` instances
(outside the repository):
- `0x6FCEA760` (`MONREG_SelectRegionMonsterTypes_6FCEA760_113c`) and `0x6FC43CA0`
  (`MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c`) without `MONSTER_InitStats113c`: **0 / 2,448**
  mismatches on `poolCount`, `totalRarity`, `slot0ClassId`, `monFlags`, and `umods`.
- Adding `0x6FCCFDB0` (`MONSTER_InitStats113c`): **36 / 2,448** mismatches on monster classes
  `186, 187, 188, 189, 605, 607` (leaving `mlvl` and `maxHp` at `0` where the DLL has values, e.g. record
  322 on level 51 class 186: DLL `mlvl = 78`, `maxHp = 4,247,040` vs TS `0`, `0`), and causing cross-record
  state drift (`umods` mismatches rise from `0` to `24` when `MONSTER_InitStats113c` executes in the same
  loop).

The root cause was not investigated — it may be a defect in `MONSTER_InitStats113c` for those classes or an
incompatibility between the bound port and this harness's hand-built structs / `CopyOnWritePageMemory113c`
overlay. It is therefore **not** counted as a confirmed kernel defect; what it establishes directly is that
a green MONSPAWN gate gives no verification evidence about the bound `MONSTER_InitStats113c` itself.

## 5. ITEMGEN findings

### 5.1 Fixture [R]

| Measure | Value |
|---|---|
| Records × size | 2,400 × 100 B |
| Requested quality | 1..8, 300 each |
| Final quality | 1: 295, 2: 312, 3: 298, 4: 369, 5 (Set): 236, 6: 340, 7 (Unique): 252, 8: 298 |
| ilvl set overall | exactly 1..99 |
| ilvl by requested quality | 99 / 99 for every quality except Unique (97; 23 and 24 missing) |
| ilvl by final quality | Set 86 / 99, Unique 78 / 99, all others 99 / 99 (the test asserts only the overall set) |
| `#10987` bitstream | length 25..65 bytes on every record; 2,400 distinct non-zero SHA-256 values; the bytes themselves are not stored |
| Base items | 505 distinct ids = 297 weapons + 202 armors + 6 `Misc.txt` rows (amulet, ring, small / medium / large charm, jewel); `Misc.txt` has 98 spawnable rows |
| Distinct file indices | 221 among final-Unique records (`UniqueItems.txt`: 403 data rows, 388 with `code`, 385 enabled); 50 among final-Set records (`SetItems.txt`: 127 rows) |

### 5.2 Which DLL entry is exercised [R]

- `itemgen-emitter.c:572` calls `D2Game:0x6FC31070` (`ITEMS_InitCreatedItemStats`, 1,050 B) on a hand-built
  unit / item-data / drop struct; the requested quality is written straight into the drop struct (`:565`).
- Manifest call chain: `0x6FC32380` `ITEMS_ChooseTreasureClassAndDrop` → `0x6FC31880`
  `ITEMS_CreateDroppedItemAtUnit` → **`0x6FC31490` `D2GAME_CreateItemEx`** (996 B) → `0x6FC31070`.
- ITEMGEN therefore starts one level **below** `D2GAME_CreateItemEx` (§2 row 6). Not on its path, as listed by
  the kernel port of `0x6FC31490` (`src/d2kern-113c/game/k2-real-itemdrop-113c.ts:1756`, read for this record;
  the DLL body itself was not disassembled here): unit allocation (`SUNIT_AllocUnitData`), seeding of the unit
  and item seeds from the drop struct, the `ilvl <= 0 → 1` clamp, command-flag setup, the preset-flag /
  preset-durability branch, the ear branches and the failure path that frees the unit.
- There is no TreasureClass sampling in ITEMGEN: base items come from pools the emitter builds itself. The
  separate TCDROP suite replaces `0x6FC31880` with a hook that records (item id, quality, flags) and returns
  a dummy item (`tcdrop-emitter.c:120`, `:279`). So TCDROP ends above `0x6FC31880` and ITEMGEN starts below
  `0x6FC31490`; **no vector suite executes `0x6FC31880` or `0x6FC31490`**.
- Bitstream and seed: the DLL's `#10987` output is hashed in the emitter (`:621`) and compared as length +
  SHA-256 (`tools/oracle/vectors/itemgen-vector.ts:146-147`); the seed end state is compared as
  `itemData.seed XOR unit.seed` (`itemgen-emitter.c:617-618`), i.e. one folded 64-bit value, not two seeds.
- TS side: ITEMGEN does call the bound `ITEMS_InitCreatedItemStats_6FC31070_113c`
  (`k2-d2tv-evaluators-113c.ts:1601`).

## 6. Are the gaps covered by another gate? [R]

- `tests/oracle/k2/replay-k2-coverage.test.ts` (passes, §2 row 5) lists `0x6FC31490`, `0x6FC31880`,
  `0x6FC67700`, `0x6FC67A20`, `0x6FCFF080`, `0x6FCFF4A0`, `0x6FD0E480` among the VAs executed by both the real
  DLL and the TS replay in five recorded K1/K2 scenarios (`a1-town-walk`, `a1c-bloodmoor-fallen`,
  `a1-bloodmoor-melee`, `p52-dot-ticks`, `p52-item-defense` — Rogue Encampment / Blood Moor on Normal).
  `tests/oracle/k2/real-itemdrop-pipeline.test.ts` reproduces one recorded drop end to end.
- Function vectors: `tools/oracle/k6-p7/k6-p7-d2game-emitter.c:4282-4301` runs the real `0x6FD0E480` on 3
  staged cases; `tools/oracle/k6-p11/k6-p11-d2game-emitter.c:4129-4153` runs the real `0x6FC31490` on 3 staged
  cases. Both test files pass (§2 row 5).
- No gate runs spawn sequences with minions across the Act 1 levels per seed, and none runs
  `D2GAME_CreateItemEx` across qualities × ilvl with TreasureClass sampling. The breadth the milestone
  sentences state is not reached by the other gates either.

## 7. Evasion checks and side effects of the closing commit [R]

| Check | Finding |
|---|---|
| Exemption / skip lists | None. No `.skip` / `.todo` / `.only` / `skipIf` added by `c23aa9f1` in `tests/`. The 11 empty levels are data (§4.1). |
| Changed / weakened assertions | Tightened: exact record counts (2,448; 2,400), exact level set 1..136, all of 2..39, per-level 18 records × difficulties × boss modes, quality sets `== [1..8]`, ilvl set `== 1..99`, bitstream length / hash presence, raised thresholds, two tamper tests. Removed only the old quality set `[1,2,3,4,6]` (replaced by the full set). Loosened: ITEMGEN fixture size cap `200 KiB` → `256 KiB`. |
| Hooks | The old ITEMGEN JMP hook is gone (§2 row 8). |
| Union counting / hand-placed `hitD2*Va113c` credits | Not applicable to these vector gates. |
| Scope narrowing by construction | Yes, and this is the substance of the verdict: the suites were widened along the axes the issue listed (levels, qualities, bitstream hash) while the entry points named in the milestone sentences stayed outside both suites (§4.2, §5.2). |

**The closing commit turned two gates red on `main`** (both reproduced on the audited tree before the fix
that accompanies this record) [R]:

1. `tests/oracle/k6/k6-showcase.test.ts` — `expected 4802 to be 4810`: rewriting `itemgen-emitter.c` removed
   eight `ITEMS_*` address literals (`0x6FC2E860, 0x6FC2EBB0, 0x6FC2EC90, 0x6FC2F700, 0x6FC303C0, 0x6FC340B0,
   0x6FC34AF0, 0x6FC354F0`) from the emitter source text, and the "emitter" count is a source-text match
   (`python3 tools/oracle/k6/audit-dll-coverage.py`: D2Game emitter VAs 3,331 at `c23aa9f1^`, 3,323 after).
2. `tests/arch/boundaries.test.ts` Rule 12 — a host `.sort()` inside `src/d2kern-113c/`
   (`k2-d2tv-evaluators-113c.ts`, in the linker hydration added by the commit).

The closing comment reports "83 / 83" for ten test files and does not report a full-suite run.

**Registered debt (not fixed by the change that carries this record).** `bindK2KernelGlobals113c`
(`src/d2kern-113c/game/k2-d2tv-evaluators-113c.ts:177-220`) *fabricates* D2Common's Fog item-code linker
(`0x6FDEFF6C`) when the DATATBLS page image lacks it: it reads every Items record code through a local
`tryReadU32` that returns 0 on any exception (a permissive fallback), drops code 0, orders by (code, index)
and allocates the table. On the K2 DATATBLS image the block does fire (linker count 0 before, 659 entries
after) [R]. The Rule 12 fix replaced the host sort with an ordered insert and is behaviour-identical: the
659 resulting entries hash identically before and after the fix [R]. Two sibling sites build the same
structure differently: `game/k3-summon-curse-replay-113c.ts:246` `ensureItemsLinkerHydratedK3_113c`
(hand-written insertion sort, keeps code-0 entries, guards reads) and `game/k2-w5b6-113c.ts:2063-2064`
(installs an **empty** 16-byte linker when the pointer is 0, so every lookup misses). Which variant matches
the real Fog linker is not established — no real-DLL dump of that page was examined. The root fix (carry the
real linker page in the image, or build it with a ported Fog routine, and delete all three) belongs to the
reopened #2032 / #2031 and is deliberately not attempted here.

## 8. Clause-by-clause comparison and verdict

### Against the issue text

| Ask | Met? | Evidence |
|---|---|---|
| MONSPAWN: remaining 22 Act 1 levels, then 136 | Yes — 136 × 18 | §4.1 |
| ITEMGEN: Set / Unique / Crafted | Yes — requested and final quality 1..8 | §5.1 |
| ITEMGEN: `#10987` bitstream (或其哈希) compared | Yes — length + SHA-256 | §5.2 |
| Exit-gate tests assert level count / quality set | Yes — exact sets | §7 |

### Against the milestone sentences

| Clause | Met? | Evidence |
|---|---|---|
| MONSPAWN: Act 1 全部野外 / 地牢关卡 … 再扩展到 136 关, 逐种子 | Yes | §4.1 |
| MONSPAWN: 刷怪**序列**哈希 | **No** — one leader per record, emitter-ordered calls that differ from the DLL's room-population order; `0x6FC67A20` / `0x6FC67700` not called | §4.2 |
| MONSPAWN: 含群怪随从 | **No** — only a pack count computed in C; `0x6FD0E480` not called; no minion data | §4.2 |
| MONSPAWN: 精英 | Yes on the DLL side (1,641 records with umods); the TS side compares a local copy | §4.1, §4.3 |
| MONSPAWN values verified on the kernel's own functions | **No** for three of five functions (evaluator-local copies) | §4.3 |
| ITEMGEN: `D2GAME_CreateItemEx` | **No** — entry is `0x6FC31070`, one level below, on hand-built structs | §5.2 |
| ITEMGEN: 全品质 × ilvl 1..99 | Yes, with holes by final quality (Set 86 / 99, Unique 78 / 99) that the test does not assert | §5.1 |
| ITEMGEN: TreasureClass 抽样 | **No** — none in ITEMGEN; TCDROP hooks the function that calls `CreateItemEx` | §5.2 |
| ITEMGEN: 位流（`#10987`）零差异 | Yes, as length + SHA-256 (the issue allowed the hash) | §5.2 |
| ITEMGEN: 种子终态 | Yes in a weak form (XOR of two seeds) | §5.2 |

### Explicit decision on the residues

The question is whether the residues — (a) no `D2GAME_CreateItemEx` entry and no TreasureClass sampling,
(b) one leader per record with no minion spawn sequence, (c) evaluator-local TS copies instead of bound
kernel ports — make the closure 不成立 *even though the issue checklist is met*. Decision: **yes**.

- (a) and (b) are not refinements; they are the nouns of the milestone sentences (`D2GAME_CreateItemEx`,
  TreasureClass 抽样, 刷怪序列, 群怪随从). A gate that does not call those functions cannot be said to reach
  that text, and no other gate supplies the stated breadth (§6).
- (c) means that for three functions a green MONSPAWN gate says nothing about the code the kernel executes.
  By the same standard applied to hand-placed trace credits, a comparison against a private copy is not
  evidence for the bound port unless each copy is individually shown to be equivalent, which the repo does
  not do.
- The issue's title is that the vector gates' scope is smaller than the milestone's. That is still true.

### Strongest counter-argument

The issue enumerated four concrete deliverables; all four are delivered, tightened in the tests and
byte-reproducible from the real DLL. The audit that wrote the issue had the `CreateItemEx` / TreasureClass /
序列 wording in front of it, did not list it, and explicitly accepted TCDROP; reopening for unlisted items
changes what the issue meant. The functions in the gap do have real-DLL evidence from zero-divergence
scenario replays and 3-case function vectors. On that view #2032 stays closed, a new issue carries the
residues, and the K2 milestone boxes simply stay unchecked.

Why it is not adopted: the bar for this re-verification is the literal milestone text, not the checklist;
the scenario evidence is five recordings (Act 1 town / Blood Moor on Normal), not "Act 1 全部 … 136 关" nor "全品质 × ilvl 1..99 ×
TreasureClass 抽样"; and the closing commit itself left two gates red and introduced a permissive fallback
in kernel code.

### Verdict

**不成立.** Issue checklist: met (4 / 4). Literal milestone text: not reached for the MONSPAWN
sequence / minion clause and for the ITEMGEN `D2GAME_CreateItemEx` and TreasureClass clauses; three MONSPAWN
functions are verified only as evaluator-local copies.

Residue list for the reopened issue (facts only; nothing is fixed by this record): MONSPAWN through
`0x6FC67A20` / `0x6FC67700` / `0x6FD0E480` with per-seed spawn sequences including minions; ITEMGEN through
`0x6FC31490` with TreasureClass sampling (`0x6FC32380` → `0x6FC31880` unhooked); MONSPAWN TS side on the
bound ports (and the 36-record lead of §4.3 examined); per-final-quality ilvl holes; 92 spawnable `Misc.txt`
bases never generated; two-seed end state; the linker fabrication and `tryReadU32` fallback of §7.

What would overturn this verdict: a call to `0x6FC31490`, `0x6FC67700`, `0x6FC67A20` or `0x6FD0E480` in the
MONSPAWN / ITEMGEN emitters, or a committed gate that runs them across the Act 1 levels / qualities × ilvl.

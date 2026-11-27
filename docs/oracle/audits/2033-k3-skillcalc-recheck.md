# Re-verification of closed issue #2033 — [K3] SKILLCALC vector scope

| | |
|---|---|
| Issue | #2033 "[K3] SKILLCALC 向量每技能仅 7 条、基础 slvl 只到 30，未达「210 技能 × slvl 1..60」" (closed 2026-11-25) |
| Closing commit | `3b38a819` |
| Milestone | [K3] (Gitea milestone id 34, state `open`) |
| Audited tree | `origin/main` @ `a5273dc7247ef8d7ef5341be572e2f8f6cd22904` (differs from the closing commit only by later, unrelated commits; no later commit touches the SKILLCALC emitter, fixture, comparison or exit-gate test) |
| Date | 2026-11-27 |
| **Verdict** | **不成立** against the literal milestone sentence (the issue's two checkboxes are met). Reasons in §7. |

Status of every number below: **[R]** = rerun for this record on the audited tree; **[C]** = cited from the
commit, the issue thread or an earlier exploration and **not** rerun here. Only [R] numbers are verified.

Ground truth: the 1.13c `D2Common.dll` / `D2Game.dll` and MPQs under `$D2_DATA_DIR` (default
`$HOME/d2-data`), run under Wine by the committed emitter scripts (`$D2_ORACLE_ROOT`, default
`$HOME/.local/opt/d2oracle`).

## 1. Acceptance texts (quoted)

Milestone [K3], "补充：子系统向量门禁":

> `SKILLCALC`：210 技能 × slvl 1..60 的服务端关键数值（伤害区间、持续帧、半径）哈希零差异，衔接现有 P5.3 公式 golden

Issue #2033, "需要完成":

> - [ ] SKILLCALC 向量扩到 210 技能 × slvl 1..60 全量（12,600 条），或在里程碑里把范围改小并写明理由
> - [ ] 测试断言改为"每个技能的 slvl 集合 == 1..60"

Issue #2033, stated motivation:

> `Skills.txt` 的分段成长（1 / 2–8 / 9–16 / 17–22 / 23–28 / 29+）每段平均只有一个点，段边界上的差一错误测不出来。

Closing comment (claim under test): "全部 210 个职业技能各自覆盖完整 `baseSlvl 1..60`（共 12,600 条），覆盖全部 5 个分段边界（1 / 2..8 / 9..16 / 17..22 / 23..28 / 29..60）".

## 2. Commands and results

| # | Command (repo root) | Result | |
|---|---|---|---|
| 1 | `D2_VECTOR_CACHE_DIR=<scratch dir> bash tools/oracle/vectors/run-skillcalc-emitter.sh --check` | `--check PASSED (100% byte-identical)`; `-O2`, `-O2 -fno-omit-frame-pointer`, `-O1` and the committed fixture all `336145e033b11206340f76113f34794e7631c6dc93c9e237f1bdec57d801d6c1`; committed `.gz` unchanged by the run | [R] |
| 2 | `npx vitest run tests/oracle/k3/exitgate-skillcalc-vectors.test.ts` | 2 / 2 tests passed (0 mismatches over 12,600 records) | [R] |
| 3 | `npx vitest run tests/oracle/k5/exitgate-d2tv-regression.test.ts tests/oracle/k3/k3-showcase.test.ts` | 9 / 9 and 3 / 3 passed, incl. "8. SKILLCALC … 12,600/12,600" | [R] |
| 4 | `git diff 3b38a819~1 3b38a819 -- tests/oracle/k3/exitgate-skillcalc-vectors.test.ts` | see §5 | [R] |
| 5 | Independent fixture parse (method in §3) | see §3–§4 | [R] |

## 3. Method of the independent parse (re-implementable)

No repo parser is used. Input: `tests/fixtures/oracle/k3/skillcalc-113c.d2tv.gz`.

1. gunzip; header is 32 bytes little-endian: `u32 magic, u16 version, u16 flags, char kind[8], u32 recordSize, u32 recordCount, u64 seed`. Expect `recordSize = 64`, `recordCount = 12600`, file length `32 + 64·12600`, SHA-256 of the gunzipped bytes as in §2 row 1.
2. Each 64-byte record (layout from `tools/oracle/vectors/skillcalc-emitter.c:43-74`): `u16 skillId @0`, `u8 charClass @2`, `u8 baseSlvl @3`, …, `u8 calcFieldCode @17`, `u16 calcSlotOff @18`, `i16 effSlvl @22`, `i16 bonusSlvl @24`, then `i16 manaCost, i32 manaCost256, formulaVal, calcFieldVal, physMinDmg, physMaxDmg, elemMinDmg, elemMaxDmg, elemLength, toHitBonus`.
3. Tables: `data\global\excel\Skills.txt`, `Skills.bin`, `SkillCalc.txt` read from `Patch_D2.mpq` (highest-priority archive that carries them; extracted with the repo's MPQ reader `src/common/mpq/archive.ts`). The extracted `Skills.txt` is byte-identical to `$D2_DATA_DIR/excel/Skills.txt` [R].
4. "Evaluation level" of a record = its `effSlvl`. A (skill, level L) cell is *evaluated* when some record of that skill has `effSlvl == L`.
5. Radius / aura-duration coverage: a class skill "has" the column when `aurarangecalc` / `auralencalc` is non-empty in `Skills.txt`; a (skill, baseSlvl) cell counts when a record of that skill at that `baseSlvl` has `calcSlotOff` equal to the column offset (`0x64` / `0x60`) or `calcFieldCode` equal to the `SkillCalc.txt` row index of `rng` (59) / `len` (54).
6. Calc-column offsets in `Skills.bin` (row size `0x23C`, 4-byte count header): for each server calc column of `Skills.txt`, the set of 4-byte offsets `o` such that for every row `(u32@o != 0xFFFFFFFF) == (txt cell non-empty)`.

## 4. Findings

### 4.1 What the emitter evaluates, read from source [R]

- `tools/oracle/vectors/skillcalc-emitter.c:457` sets `baseSlvl = rep + 1` (1..60).
- `:460` `zeroBonusPoint = (rep == 0 || rep % 10 == 9)` — only base 1, 10, 20, 30, 40, 50, 60 run without +skill bonuses; every other record gets all-skills / class / tab / single-skill / shrine bonuses.
- `:587` `effSlvl = #10306(unit, skill, bBonus=1)`; **every value field** is then computed with `nLevel = effSlvl` (`:595-612`: mana, `#10786` formula, `#10147` calc field, physical and elemental min/max, elemental length, to-hit). None is computed with `baseSlvl`.
- The TS side does the same (`tools/oracle/vectors/skillcalc-vector.ts:204-217`), calling the kernel's `SKILLS_*113c` functions, and compares the 12 output fields one by one.
- The emitter contains no hook or patch code (`grep -l "install_jmp_hook\|VirtualProtect" tools/oracle/vectors/skillcalc-emitter.c` → no match) [R]; all outputs are return values of real `D2Common` exports.
- The exit-gate test asserts the `baseSlvl` set per skill (`tests/oracle/k3/exitgate-skillcalc-vectors.test.ts:44-58`). It asserts nothing about `effSlvl`.

### 4.2 Fixture numbers [R]

| Measure | Value |
|---|---|
| Records × size | 12,600 × 64 B |
| Distinct skills | 210 = ids 6..155, 221..280 = exactly the `Skills.txt` rows with non-empty `charclass` (357 skill rows in the table; 147 rows — monster / item / scroll skills and ids 0..5 — are outside the set) |
| Skills whose `baseSlvl` multiset ≠ {1..60} | 0 |
| `effSlvl` range | 1..78 (71 distinct values) |
| Records with `effSlvl == baseSlvl` | 1,505 (210 each at base 1, 10, 20, 30, 40, 50, 60; 17 at base 19; 18 at base 37) |
| Records with `effSlvl < baseSlvl` | 0 |
| Smallest `effSlvl − baseSlvl` on any record with base 2..9 | +3 |
| (skill, level L ∈ 1..60) cells that occur as an evaluation level | **7,648 of 12,600 (60.7%)** |
| Per skill, levels in 1..60 evaluated | min 33, median 36, max 40; **0 skills have all 60** |
| Levels never evaluated for **any** of the 210 skills | **2, 3, 4, 5, 6, 7, 9** |
| Level 8 | evaluated for 35 skills, missing for 175 |

Growth segments named by the issue — number of skills (of 210) with at least one evaluation level inside the segment:

| Segment | After `3b38a819` | Before (`3b38a819~1` fixture, 1,470 records) |
|---|---:|---:|
| 1 | 210 | — |
| 2–8 | **35** (level 8 only) | **49** |
| 9–16 | 210 (levels 10..16; never 9) | — |
| 17–22 | 210 | — |
| 23–28 | 210 | — |
| 29+ | 210 | — |

(The "before" column was computed for segment 2–8 only, from `git show 3b38a819~1:tests/fixtures/oracle/k3/skillcalc-113c.d2tv.gz` with the same parser.)

So the segment the issue singled out is covered for *fewer* skills after the fix than before, and the
boundaries 1|2 and 8|9 are not exercised at levels 2 and 9 by any record.

### 4.3 The three value kinds of the milestone sentence [R]

| 关键数值 | In the committed fixture |
|---|---|
| 伤害区间 | Physical min/max and elemental min/max are on every record (non-zero for 67 and 75 / 71 skills) — at `effSlvl`, so subject to §4.2. |
| 持续帧 | Elemental length (`#10510`) on every record (24 skills non-zero) — at `effSlvl`. Aura length (`auralencalc`): 46 class skills have the column; evaluated in **791 of 2,760** (skill, baseSlvl) cells, 8..26 of 60 per skill. |
| 半径 | `aurarangecalc`: 60 class skills have the column; evaluated in **917 of 3,600** (skill, baseSlvl) cells (25.5%), 6..44 of 60 per skill. |

Each record carries exactly one formula slot (`calcSlotOff`) and one SkillCalc code, rotated; that is why
radius and aura length are sampled rather than complete.

### 4.4 Calc-column list [R]

`Skills.txt` has 31 server calc columns; the emitter's slot list (`skillcalc-emitter.c:173-180`) has 24.
Offsets derived per §3 step 6: `sumsk2calc` → `0xD4` (unique); `sumsk1calc` → `0xC4` or `0xD0` (emptiness
pattern alone does not separate the two, but neither is `0xD4`). The emitter labels `0xD4` as `sumsk1calc`
(`:179`); it is `sumsk2calc`. Not in the emitter list at all: `sumsk1calc`, `sumsk3calc`, `sumsk4calc`,
`sumsk5calc`, `prgcalc1`, `prgcalc2`, `prgcalc3` (7 columns).

### 4.5 Not rerun for this record [C]

- An exploration run built a scratch variant of the emitter that calls the real `#10786` on all 31 calc
  columns and the real `#10147` on all 73 codes at both `effSlvl` and exact `baseSlvl`, plus the dedicated
  damage / length / to-hit / mana functions at exact `baseSlvl`, and reported **0 mismatches in 2,772,000
  cells** against the TS kernel. That is not a committed gate and was **not** rerun here; it is quoted
  because it bears on the counter-argument (§6), not as verified evidence.
- "衔接现有 P5.3 公式 golden": `tests/oracle/formula-golden.test.ts` and `docs/oracle/P5-formula-sweep.md`
  exist; the SKILLCALC gate does not reference them. How the two are meant to connect was not examined.

## 5. Evasion checks [R]

| Check | Finding |
|---|---|
| Exemption / skip lists | None. No `.skip`, `.todo`, `.only`, `skipIf` added by `3b38a819` in `tests/`. |
| Changed / weakened assertions | Tightened: record count `1470` → exact `12_600`; six `baseSlvls.has(n)` probes → per-skill `length === 60` and set `== 1..60`; nine diversity thresholds raised. One bound loosened: fixture size cap `200 KiB` → `400 KiB` (the file grew). The comparison code (`skillcalc-vector.ts`) was not touched. |
| Union counting | Not applicable (single fixture, per-record comparison). |
| Hand-placed `hitD2*Va113c` credits | Not applicable to this gate (no VA-trace metric is involved); `3b38a819` changes no file under `src/d2kern-113c/`. |
| Label vs. substance | The assertion that was added checks the record *label* (`baseSlvl`), while every compared value is evaluated at `effSlvl`. This is the gap in §4.2; it is not an exemption, but the tightened assertion cannot detect it. |

## 6. Clause-by-clause comparison

### Against the issue text

| Ask | Met? | Evidence |
|---|---|---|
| Vectors expanded to 210 × slvl 1..60 = 12,600 | Yes, by base slvl | §2 rows 1–2, §4.2 |
| Test asserts per-skill slvl set == 1..60 | Yes, on `baseSlvl` | §4.1 |
| (Motivation) segment-boundary coverage | **No** for segment 2–8: 35 / 210 skills (was 49); levels 2 and 9 never evaluated | §4.2 |

### Against the milestone sentence

| Clause | Met? | Evidence |
|---|---|---|
| 210 技能 | Yes — the class skills of `Skills.txt`, enumerated through the DLL | §4.2 |
| slvl 1..60 的关键数值 | **No** — values exist at 7,648 / 12,600 (skill, level) cells; levels 2–7 and 9 for no skill | §4.2 |
| 伤害区间 | On every record, but only at the levels above | §4.3 |
| 持续帧 | Partial — aura length 791 / 2,760 cells | §4.3 |
| 半径 | Partial — 917 / 3,600 cells | §4.3 |
| 哈希零差异 | Yes for what is compared: 0 / 12,600, field by field, byte-reproducible from the real DLL | §2 |
| 衔接现有 P5.3 公式 golden | Not asserted anywhere; not examined | §4.5 |

### Strongest counter-argument

The issue defined the shortfall as record count and base-slvl range, and both are now exact; "slvl" can be
read as hard points, under which every (skill, slvl 1..60) cell has a record. Effective levels reach 78 and
five of six growth segments are covered for all skills. An exploration run over the complete matrix against
the real DLL reportedly found zero differences [C], so nothing is known to be wrong in the kernel; on that
view the closure holds and the rest is test hardening for #2035.

Why it is not adopted: (1) the acceptance bar set for this re-verification is the literal milestone
sentence, which asks for the *values at* slvl 1..60 — and the values at levels 2–7 and 9 are not produced for
any skill by the committed gate; (2) even under the base-slvl reading, radius and aura duration are compared
in about a quarter of the cells, and seven calc columns are never evaluated; (3) the issue's own motivation
(segment 2–8) got worse; (4) the zero-mismatch full-matrix run is neither committed nor rerun, so it cannot
stand in for a gate.

## 7. Verdict

**不成立.** The closure meets the issue's checklist but does not reach the literal milestone text: the
committed SKILLCALC gate labels records with base slvl 1..60 while evaluating values at the bonus-inflated
effective level, leaving 4,952 of 12,600 (skill, level ≤ 60) cells — all of levels 2–7 and 9 — unevaluated,
and it samples radius (917 / 3,600) and aura duration (791 / 2,760) instead of covering them.

No kernel defect is shown by these measurements. Scope for the reopened issue (facts only; nothing is fixed
by this record): evaluate values at `nLevel = slvl` for every slvl 1..60; assert the evaluation-level set,
not only `baseSlvl`; evaluate radius / duration columns for every skill that has them on every level; add
the seven missing calc columns and correct the `0xD4` label.

What would overturn this verdict: a record in the committed fixture with `effSlvl` in 2..7 or 9, or evidence
that any compared value field is computed with `baseSlvl`.

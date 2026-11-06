/**
 * P5.3 function-level randomized differential sweep.
 *
 *   npx tsx tools/oracle/fn-sweep.ts [--seed N] [--out DIR] [--reuse] [--cats a,b]
 *       [--skills LO-HI] [--no-goldens] [--no-report]
 *
 * 1. Generates seeded random inputs per category (boundaries included) as
 *    request lines for the in-process harness (tools/oracle/hook/fnharness.dll.c).
 * 2. Runs the original 1.13c game once (tools/oracle/run-fn-oracle.sh) unless
 *    --reuse is given (then DIR/fn-req.ndjson + DIR/fn-resp.ndjson are reused).
 * 3. Compares every oracle result with the TS implementation
 *    (tools/oracle/lib/fn-formulas.ts), classifies mismatches, and writes
 *    docs/oracle/P5-formula-sweep.md and tests/fixtures/oracle/formulas/<cat>.ndjson.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import type { D2DataRegistry } from '../../src/common/data/data-registry.ts'
import { FIX_LOG, HYPOTHESES } from './fn-sweep-hypotheses.ts'
import {
  type FnLine,
  type FnFileHeader,
  type CategoryId,
  CATEGORY_IDS,
  envFromHeader,
  evalLine,
  lineValueCount,
  lineClassKeys,
} from './lib/fn-golden.ts'
import { ANIM_MODE_STAT, DMG_CHANNELS, PLR_MODE_CODES, PLR_TOKENS, WCLASS_CODES, DIMINISH_STATS, RESIST_ROWS, SKILL_CALC_FIELDS, SKILLCALC_CODES, referencedSkills, skillCalcText } from './lib/fn-formulas.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../..')

// ------------------------------------------------------------------ rng
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type Rng = () => number
const ri = (r: Rng, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1))
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
const INT_EDGES = [0, 1, -1, 2, -2, 7, 8, 100, -100, 255, 256, 0x7fff, 0x8000, 0xffff, 0x10000, 0x10001,
  0xfffff, 0x100000, 0x100001, 0x1000000, 0x7fffffff, -0x7fffffff, -0x80000000, 0x40000000]
function fuzzInt(r: Rng): number {
  const k = r()
  if (k < 0.25) return pick(r, INT_EDGES)
  if (k < 0.5) return ri(r, -300, 300)
  if (k < 0.7) return ri(r, -0x20000, 0x20000)
  if (k < 0.85) return ri(r, -0x2000000, 0x2000000)
  return (Math.floor(r() * 4294967296) | 0)
}

// ------------------------------------------------------------- requests
/** One request line plus what its response means. */
interface Planned {
  readonly req: readonly number[]
  /** undefined = control line (state change / snapshot), not compared. */
  readonly line?: Omit<FnLine, 'v'>
  readonly snap?: 'stat' | 'hard'
  readonly snapId?: number
  /** First observation line of a skill configuration (resets the per-line stat overrides). */
  readonly cfgStart?: boolean
  /** Capture the response value (capReset starts a new capture list). */
  readonly cap?: boolean
  readonly capReset?: boolean
  /** Build the line's argument list from the captured oracle values. */
  readonly mkA?: (caps: readonly number[]) => number[]
  /** Drop the line when the captured values say the case does not exist (e.g. no AnimData record). */
  readonly skipIf?: (caps: readonly number[]) => boolean
  /** Replace the oracle value by a value derived from it (documented rule). */
  readonly deriveV?: (caps: readonly number[], raw: number) => number
}

const OP = { SKCALC: 1, SKFORM: 2, ELMIN: 3, ELMAX: 4, ELEN: 5, PHMIN: 6, PHMAX: 7, TOHIT: 8, RAWMANA: 9,
  SETSKILL: 10, SETSTAT: 11, GETSTAT: 12, RESTORESKILL: 14, RESTORESTAT: 15, MULDIV: 20, DIMRET: 21, BAND5: 22,
  USETSTAT: 40, URESTORE: 41, UGETSTAT: 42, AR: 43, DEF: 44, BLOCK: 45, HIT: 46, RESIST: 47, STEAL_LIFE: 48,
  STEAL_MANA: 49, MONDRAIN: 50, GMULDIV: 51, DIMINISH: 52, EXPLVL: 53, EXPRATIO: 54, VITALLOC: 55, ENEALLOC: 56,
  LEVELUP: 57, DMGPIPE: 58, DMGFIELD: 59, ANIMSPEED: 60, ANIMLAST: 61, ANIMDATA: 62, RANGE: 100 } as const

const SKILL_OPS: readonly { fn: FnLine['f']; op: number; x: number }[] = [
  { fn: 'elmin', op: OP.ELMIN, x: 0 },
  { fn: 'elmin', op: OP.ELMIN, x: 1 },
  { fn: 'elmax', op: OP.ELMAX, x: 0 },
  { fn: 'elmax', op: OP.ELMAX, x: 1 },
  { fn: 'elen', op: OP.ELEN, x: 0 },
  // D2Common #10297 (0x6FDA1FF0, OP 6) computes MaxDam/MaxLevDam (kick /3); #10567 (0x6FDA2100, OP 7) computes MinDam/MinLevDam (kick /4).
  { fn: 'phmax', op: OP.PHMIN, x: 0 },
  { fn: 'phmin', op: OP.PHMAX, x: 0 },
  { fn: 'tohit', op: OP.TOHIT, x: 0 },
  { fn: 'rawmana', op: OP.RAWMANA, x: 0 },
]
/** skilleval: evaluateSkill113c fields vs the single D2Common function that owns the number. */
const EVAL_OPS: readonly { fn: FnLine['f']; op: number; x: number }[] = [
  { fn: 'eval.minElemDmg256', op: OP.ELMIN, x: 0 },
  { fn: 'eval.maxElemDmg256', op: OP.ELMAX, x: 0 },
  { fn: 'eval.toHitBonusPct', op: OP.TOHIT, x: 0 },
]
const STAT_SNAPSHOT_IDS = Array.from({ length: 359 }, (_, i) => i)
const MASTERY_STATS = [329, 330, 331, 332]
const EXTREME_LVLS = [-1, 0, 127, 128, 255, 256, 1000, 0x7fffffff, -0x80000000]

interface PlanCtx {
  reg: D2DataRegistry
  rng: Rng
  skillLo: number
  skillHi: number
  out: Planned[]
}

function planSnapshot(p: PlanCtx): void {
  for (const id of STAT_SNAPSHOT_IDS) p.out.push({ req: [OP.GETSTAT, id, 0], snap: 'stat', snapId: id })
  const n = p.reg.skillsTable.rows.length
  for (let s = 0; s < n; s++) p.out.push({ req: [OP.SKCALC, s, 1, 41], snap: 'hard', snapId: s })
}

function statsInCalcs(reg: D2DataRegistry, texts: readonly string[]): number[] {
  const ids = new Set<number>()
  for (const t of texts) {
    for (const m of t.matchAll(/stat\s*\(\s*'([^']+)'/gi)) {
      const st = reg.getStatByName(m[1] ?? '')
      if (st) ids.add(st.id)
    }
  }
  return [...ids]
}

function planSkills(p: PlanCtx, cats: ReadonlySet<CategoryId>): void {
  const { reg, rng } = p
  const n = reg.skillsTable.rows.length
  for (let s = Math.max(0, p.skillLo); s <= Math.min(n - 1, p.skillHi); s++) {
    const skill = reg.getSkillById(s)
    if (!skill) continue
    const refs = referencedSkills(reg, skill)
    const cols = SKILL_CALC_FIELDS.filter(f => skillCalcText(reg, skill, f.off).trim() !== '')
    const texts = cols.map(f => skillCalcText(reg, skill, f.off))
    const statRefs = [...new Set([...statsInCalcs(reg, texts), 12, ...MASTERY_STATS])]
    const configs = 6
    for (let c = 0; c < configs; c++) {
      const hard: [number, number][] = []
      const stats: [number, number][] = []
      const synLvl = (): number => {
        const k = rng()
        return k < 0.15 ? 0 : k < 0.25 ? 1 : k < 0.35 ? 20 : k < 0.9 ? ri(rng, 0, 20) : ri(rng, 21, 60)
      }
      if (c === 0) {
        hard.push([s, 0])
        for (const id of refs) hard.push([id, 0])
      } else if (c === 1) {
        hard.push([s, 1])
        for (const id of refs) hard.push([id, 1])
      } else {
        hard.push([s, ri(rng, 0, 20)])
        for (const id of refs) hard.push([id, synLvl()])
        for (const id of MASTERY_STATS) stats.push([id, rng() < 0.5 ? 0 : ri(rng, 0, 250)])
        if (c >= 4) stats.push([12, ri(rng, 1, 99)])
      }
      for (const [id, h] of hard) p.out.push({ req: [OP.SETSKILL, id, h] })
      for (const [id, v] of stats) p.out.push({ req: [OP.SETSTAT, id, v, 0] })
      // Observe the accrued value of every stat a calc of this skill can read.
      const st: [number, number][] = []
      statRefs.forEach((id, k) => p.out.push({ req: [OP.GETSTAT, id, 0], snap: 'stat', snapId: -1 - id, cfgStart: k === 0 }))
      const ranges: [number, number][] = c === 0 ? [[1, 60], [61, 100]] : [[1, 60]]
      const base = { s, h: hard, st }
      const hasRand = (expr: string): boolean => /\brand\s*\(/i.test(expr)
      for (const [lo, hi] of ranges) {
        if (cats.has('skills')) {
          for (const f of cols) {
            const skipRand = hasRand(skillCalcText(reg, skill, f.off))
            p.out.push({
              req: [OP.RANGE, OP.SKFORM, lo, hi, s, f.off],
              line: { cat: 'skills', f: 'skform', x: f.off, lo, ...base },
              ...(skipRand ? { skipIf: () => true } : {}),
            })
          }
          for (const o of SKILL_OPS) {
            p.out.push({ req: [OP.RANGE, o.op, lo, hi, s, o.x], line: { cat: 'skills', f: o.fn, x: o.x, lo, ...base } })
          }
          if (c === 0 || c === 2) {
            for (let code = 0; code < SKILLCALC_CODES.length; code++) {
              const skipRand = code === 55 && hasRand(skill.calc1)
              p.out.push({
                req: [OP.RANGE, OP.SKCALC, lo, hi, s, code],
                line: { cat: 'skills', f: 'skcalc', x: code, lo, ...base },
                ...(skipRand ? { skipIf: () => true } : {}),
              })
            }
          }
        }
        if (cats.has('skilleval') && lo >= 1 && hi <= 60) {
          for (const o of EVAL_OPS) {
            p.out.push({ req: [OP.RANGE, o.op, lo, hi, s, o.x], line: { cat: 'skilleval', f: o.fn, x: o.x, lo, ...base } })
          }
        }
      }
      if (c === 0 && cats.has('skills')) {
        for (const l of EXTREME_LVLS) {
          for (const f of cols) {
            const skipRand = hasRand(skillCalcText(reg, skill, f.off))
            p.out.push({
              req: [OP.RANGE, OP.SKFORM, l, l, s, f.off],
              line: { cat: 'skills', f: 'skform', x: f.off, lo: l, ...base },
              ...(skipRand ? { skipIf: () => true } : {}),
            })
          }
          for (const o of SKILL_OPS) p.out.push({ req: [OP.RANGE, o.op, l, l, s, o.x], line: { cat: 'skills', f: o.fn, x: o.x, lo: l, ...base } })
        }
      }
      // Restore the values the harness saw before the first SETSKILL / SETSTAT.
      for (const [id] of hard) p.out.push({ req: [OP.RESTORESKILL, id] })
      for (const [id] of stats) p.out.push({ req: [OP.RESTORESTAT, id] })
    }
  }
}

function planPrimitives(p: PlanCtx, perFn: number): void {
  const { rng } = p
  for (let i = 0; i < perFn; i++) {
    const a = [fuzzInt(rng), fuzzInt(rng), rng() < 0.5 ? pick(rng, [100, 1024, 128, 64, 3, 0, -1, 7]) : fuzzInt(rng)]
    p.out.push({ req: [OP.MULDIV, ...a], line: { cat: 'primitives', f: 'muldiv', a } })
    p.out.push({ req: [OP.MULDIV, ...a], line: { cat: 'primitives', f: 'muldiv.fog', a } })
    p.out.push({ req: [OP.GMULDIV, ...a], line: { cat: 'primitives', f: 'muldiv.game', a } })
  }
  for (let i = 0; i < perFn; i++) {
    const lvl = rng() < 0.7 ? ri(rng, -10, 200) : fuzzInt(rng)
    const small = (): number => (rng() < 0.7 ? ri(rng, -500, 2000) : fuzzInt(rng))
    const a = [lvl, small(), small()]
    p.out.push({ req: [OP.DIMRET, ...a], line: { cat: 'primitives', f: 'dimret', a } })
  }
  for (let i = 0; i < perFn; i++) {
    const lvl = rng() < 0.7 ? ri(rng, -5, 120) : fuzzInt(rng)
    const lev = (): number => (rng() < 0.8 ? ri(rng, -50, 500) : fuzzInt(rng))
    const a = [lvl, lev(), lev(), lev(), lev(), lev()]
    p.out.push({ req: [OP.BAND5, ...a], line: { cat: 'primitives', f: 'band5', a } })
  }
}


// ------------------------------------------------- stats / combat / progression
type Sel = 0 | 1
class UnitTouch {
  private readonly touched = new Set<string>()
  constructor(private readonly out: Planned[]) {}
  set(sel: Sel, stat: number, v: number): void {
    this.touched.add(`${sel}:${stat}`)
    this.out.push({ req: [OP.USETSTAT, sel, stat, v] })
  }
  restore(): void {
    for (const k of this.touched) {
      const [sel, stat] = k.split(':').map(Number) as [number, number]
      this.out.push({ req: [OP.URESTORE, sel, stat] })
    }
    this.touched.clear()
  }
}
const cap = (out: Planned[], req: number[], reset = false): void => {
  out.push({ req, cap: true, ...(reset ? { capReset: true } : {}) })
}
const wide = (r: Rng, lo: number, hi: number, pExtreme = 0.05): number => (r() < pExtreme ? fuzzInt(r) : ri(r, lo, hi))

function planStats(p: PlanCtx, nCfg: number): void {
  const { rng, out } = p
  const t = new UnitTouch(out)
  for (let i = 0; i < nCfg; i++) {
    t.set(0, 2, rng() < 0.1 ? ri(rng, -60, 14) : wide(rng, 0, 600, 0.02))
    t.set(0, 19, wide(rng, -500, 6000, 0.03))
    t.set(0, 12, rng() < 0.03 ? ri(rng, -3, 0) : ri(rng, 1, 99))
    t.set(0, 31, wide(rng, -200, 4000, 0.03))
    t.set(0, 171, rng() < 0.6 ? 0 : ri(rng, -100, 400))
    t.set(0, 16, rng() < 0.7 ? 0 : ri(rng, -100, 300))
    t.set(0, 182, rng() < 0.7 ? 0 : rng() < 0.5 ? -100 : ri(rng, -150, 100))
    t.set(0, 20, rng() < 0.2 ? ri(rng, -40, 0) : ri(rng, 0, 120))
    cap(out, [OP.UGETSTAT, 0, 2, 0], true)
    for (const st of [19, 12, 31, 171, 16, 182, 20]) cap(out, [OP.UGETSTAT, 0, st, 0])
    for (let c = 0; c < 7; c++) out.push({ req: [OP.AR, c], line: { cat: 'stats', f: 'ar' }, mkA: k => [c, k[0]!, k[1]!] })
    out.push({ req: [OP.DEF, 0], line: { cat: 'stats', f: 'def' }, mkA: k => [k[0]!, k[3]!, k[4]!, k[5]!, k[6]!] })
    for (let c = 0; c < 7; c++) {
      for (const e of [0, 1]) out.push({ req: [OP.BLOCK, e, c], line: { cat: 'block', f: 'block' }, mkA: k => [c, e, k[0]!, k[2]!, k[7]!] })
    }
  }
  t.restore()
}

function planVitals(p: PlanCtx, n: number): void {
  const { rng, out } = p
  for (let i = 0; i < n; i++) {
    const c = ri(rng, 0, 6)
    const pts = rng() < 0.2 ? ri(rng, -40, -1) : ri(rng, 0, 200)
    const which = ri(rng, 0, 2)
    if (which === 0) out.push({ req: [OP.VITALLOC, pts, c, 0], line: { cat: 'stats', f: 'vit.maxhp', a: [c, pts] } })
    else if (which === 1) out.push({ req: [OP.VITALLOC, pts, c, 1], line: { cat: 'stats', f: 'vit.maxstamina', a: [c, pts] } })
    else out.push({ req: [OP.ENEALLOC, pts, c, 0], line: { cat: 'stats', f: 'ene.maxmana', a: [c, pts] } })
  }
  const fns = ['levelup.maxhp', 'levelup.maxmana', 'levelup.maxstamina', 'levelup.statpts', 'levelup.newskills'] as const
  for (let c = 0; c < 7; c++) {
    for (const k of [1, 2, 3, 7]) {
      fns.forEach((f, w) => out.push({ req: [OP.LEVELUP, k, c, w], line: { cat: 'stats', f, a: [c, k] } }))
    }
  }
}

function planHit(p: PlanCtx, nCfg: number): void {
  const { rng, out } = p
  const t = new UnitTouch(out)
  for (let i = 0; i < nCfg; i++) {
    t.set(0, 2, wide(rng, 0, 500, 0.02))
    t.set(0, 19, rng() < 0.05 ? ri(rng, 0x100000, 0x4000000) : ri(rng, -300, 20000))
    t.set(0, 12, rng() < 0.03 ? 0 : ri(rng, 1, 99))
    t.set(0, 119, rng() < 0.4 ? 0 : ri(rng, -100, 600))
    t.set(1, 31, wide(rng, -300, 6000, 0.03))
    t.set(1, 12, rng() < 0.03 ? 0 : ri(rng, 1, 110))
    t.set(1, 32, rng() < 0.7 ? 0 : ri(rng, -200, 800))
    t.set(1, 33, rng() < 0.7 ? 0 : ri(rng, -200, 800))
    cap(out, [OP.AR, -1], true)
    cap(out, [OP.DEF, 1])
    cap(out, [OP.UGETSTAT, 0, 12, 0])
    cap(out, [OP.UGETSTAT, 1, 12, 0])
    cap(out, [OP.UGETSTAT, 0, 119, 0])
    cap(out, [OP.UGETSTAT, 1, 32, 0])
    cap(out, [OP.UGETSTAT, 1, 33, 0])
    for (const [x, m] of [[0, 0], [0, 1], [ri(rng, -100, 400), 0], [ri(rng, -100, 400), 1]] as const) {
      out.push({
        req: [OP.HIT, x, m],
        line: { cat: 'hit', f: 'hit' },
        mkA: k => [k[0]!, k[1]!, k[2]!, k[3]!, x, k[4]!, m, m ? k[5]! : k[6]!],
      })
    }
  }
  t.restore()
}

function planResist(p: PlanCtx, nCfg: number): void {
  const { rng, out } = p
  const t = new UnitTouch(out)
  const rows = Object.entries(RESIST_ROWS).map(([k, v]) => [Number(k), v] as const)
  for (let i = 0; i < nCfg; i++) {
    for (const defSel of [0, 1] as const) {
      const atkSel: Sel = defSel ? 0 : 1
      for (const [row, d] of rows) {
        t.set(defSel, d.res, rng() < 0.05 ? fuzzInt(rng) % 1000 : ri(rng, -200, 260))
        if (d.max >= 0) t.set(defSel, d.max, rng() < 0.5 ? 0 : ri(rng, -30, 40))
        if (d.pierce >= 0) t.set(atkSel, d.pierce, rng() < 0.4 ? 0 : rng() < 0.15 ? ri(rng, -60, -1) : ri(rng, 0, 160))
        cap(out, [OP.UGETSTAT, defSel, d.res, 0], true)
        cap(out, d.max >= 0 ? [OP.UGETSTAT, defSel, d.max, 0] : [0, 0])
        cap(out, d.pierce >= 0 ? [OP.UGETSTAT, atkSel, d.pierce, 0] : [0, 0])
        for (const pen of [pick(rng, [0, -40, -100]), ri(rng, -120, 20)]) {
          out.push({
            req: [OP.RESIST, row, defSel, pen, 1, 0],
            line: { cat: 'resist', f: 'resist' },
            mkA: k => [row, defSel ? 0 : 1, k[0]!, k[1]!, k[2]!, pen],
          })
        }
      }
    }
  }
  t.restore()
}

function planSteal(p: PlanCtx, n: number): void {
  const { rng, out } = p
  cap(out, [OP.MONDRAIN, 0], true)
  cap(out, [OP.MONDRAIN, 1])
  cap(out, [OP.MONDRAIN, 2])
  for (let i = 0; i < n; i++) {
    const phys = rng() < 0.1 ? fuzzInt(rng) : rng() < 0.5 ? ri(rng, -2000, 256 * 2000) : ri(rng, 0, 256 * 60000)
    const life = rng() < 0.1 ? fuzzInt(rng) % 100000 : ri(rng, -20, 120)
    const mana = rng() < 0.1 ? fuzzInt(rng) % 100000 : ri(rng, -20, 120)
    const d = ri(rng, 0, 2)
    out.push({ req: [OP.STEAL_LIFE, phys, life, mana, d], line: { cat: 'steal', f: 'steal.life' }, mkA: k => [phys, life, mana, d, k[d]!] })
    out.push({ req: [OP.STEAL_MANA, phys, life, mana, d], line: { cat: 'steal', f: 'steal.mana' }, mkA: k => [phys, life, mana, d, k[d]!] })
  }
}

function planAnim(p: PlanCtx, nCfg: number): void {
  const { rng, out } = p
  const t = new UnitTouch(out)
  for (let i = 0; i < nCfg; i++) {
    DIMINISH_STATS.forEach((st, idx) => {
      const v = rng() < 0.05 ? fuzzInt(rng) : rng() < 0.15 ? ri(rng, -400, 0) : ri(rng, 0, 1000)
      t.set(0, st, v)
      cap(out, [OP.UGETSTAT, 0, st, 0], true)
      out.push({ req: [OP.DIMINISH, idx], line: { cat: 'anim', f: 'diminish' }, mkA: k => [idx, k[0]!] })
    })
  }
  t.restore()
}

function planExp(p: PlanCtx, n: number): void {
  const { rng } = p
  const lvl = (): number => (rng() < 0.05 ? fuzzInt(rng) % 300 : ri(rng, 1, 99))
  const exp = (): number => (rng() < 0.1 ? fuzzInt(rng) : rng() < 0.5 ? ri(rng, 0, 0x7fffff) : ri(rng, 0, 20000))
  for (let i = 0; i < n; i++) {
    const a = [lvl(), rng() < 0.05 ? ri(rng, -5, 0) : ri(rng, 1, 120), exp()]
    p.out.push({ req: [OP.EXPLVL, ...a], line: { cat: 'exp', f: 'explvl', a } })
    const b = [exp(), lvl()]
    p.out.push({ req: [OP.EXPRATIO, ...b], line: { cat: 'exp', f: 'expratio', a: b } })
  }
}


function planDmg(p: PlanCtx, nCfg: number): void {
  const { rng, out } = p
  const t = new UnitTouch(out)
  for (let i = 0; i < nCfg; i++) {
    const defSel: Sel = rng() < 0.5 ? 0 : 1
    const atkSel: Sel = defSel ? 0 : 1
    const chIdx = ri(rng, 0, DMG_CHANNELS.length - 1)
    const ch = DMG_CHANNELS[chIdx]!
    const pz = (pZero: number, lo: number, hi: number): number => (rng() < pZero ? 0 : ri(rng, lo, hi))
    t.set(defSel, 34, rng() < 0.05 ? ri(rng, -20, -1) : pz(0.4, 0, 60))
    t.set(defSel, 35, rng() < 0.05 ? ri(rng, -20, -1) : pz(0.4, 0, 60))
    t.set(defSel, 36, pz(0.4, -60, 110))
    t.set(defSel, ch.res, rng() < 0.05 ? ri(rng, 100, 250) : pz(0.2, -120, 120))
    t.set(defSel, ch.max, pz(0.6, -20, 30))
    t.set(defSel, ch.absPct, rng() < 0.05 ? ri(rng, -10, -1) : pz(0.6, 0, 70))
    t.set(defSel, ch.absFlat, pz(0.6, 0, 60))
    if (ch.pierce >= 0) t.set(atkSel, ch.pierce, pz(0.6, -20, 80))
    cap(out, [OP.UGETSTAT, defSel, 34, 0], true)
    for (const st of [35, 36, ch.res, ch.max, ch.absPct, ch.absFlat]) cap(out, [OP.UGETSTAT, defSel, st, 0])
    cap(out, ch.pierce >= 0 ? [OP.UGETSTAT, atkSel, ch.pierce, 0] : [0, 0])
    for (let k = 0; k < 4; k++) {
      const diff = ri(rng, 0, 2)
      const amt = (): number => (rng() < 0.15 ? 0 : rng() < 0.08 ? ri(rng, 0x100000, 0x4000000) : ri(rng, 1, 256 * 2000))
      const phys = amt()
      const elem = amt()
      const rate = rng() < 0.8 ? 0 : ri(rng, 1, 4096)
      const req = [OP.DMGPIPE, defSel, diff, phys, 0, 0, 0, 0, 0, rate]
      req[3 + [1, 2, 4, 3][chIdx]!] = elem // phys fire ltng magic cold -> req slots 3..7
      const mk = (c: readonly number[]): number[] => [defSel ? 0 : 1, diff, phys, chIdx, elem, rate, c[0]!, c[1]!, c[2]!, c[3]!, c[4]!, c[5]!, c[6]!, c[7]!]
      out.push({ req, line: { cat: 'dmg', f: 'dmg.total' }, mkA: mk })
      out.push({ req: [OP.DMGFIELD, 0x08], line: { cat: 'dmg', f: 'dmg.phys' }, mkA: mk })
      out.push({ req: [OP.DMGFIELD, ch.off], line: { cat: 'dmg', f: 'dmg.elem' }, mkA: mk })
      out.push({ req: [OP.DMGFIELD, 0x48], line: { cat: 'dmg', f: 'dmg.absorb' }, mkA: mk })
    }
  }
  t.restore()
}

function planFrames(p: PlanCtx, nPerMode: number): void {
  const { rng, out } = p
  // 1. AnimData records (#10385) for every class x mode x weapon class.
  for (let c = 0; c < 7; c++) {
    for (let m = 0; m < PLR_MODE_CODES.length; m++) {
      for (let w = 0; w < WCLASS_CODES.length; w++) {
        const name = `${PLR_TOKENS[c]}${PLR_MODE_CODES[m]}${WCLASS_CODES[w]}`
        const chars = [...name].map(ch => ch.charCodeAt(0))
        cap(out, [OP.ANIMDATA, 0, ...chars], true)
        const a = [c, m, w]
        for (const [which, f] of [[1, 'animdata.frames'], [2, 'animdata.speed'], [3, 'animdata.action']] as const) {
          out.push({ req: [OP.ANIMDATA, which, ...chars], line: { cat: 'frames', f, a }, skipIf: k => k[0] !== 1 })
        }
      }
    }
  }
  // 2. Animation speed (#10819) per stat value for cast / gethit / block / attack / run / walk.
  const t = new UnitTouch(out)
  for (const mode of [10, 4, 9, 7, 3, 2]) {
    const stat = ANIM_MODE_STAT[mode]!
    for (let i = 0; i < nPerMode; i++) {
      const v = i < 201 ? i : rng() < 0.08 ? ri(rng, -150, -1) : rng() < 0.04 ? ri(rng, 1001, 100000) : ri(rng, 0, 1000)
      t.set(0, stat, v)
      if (mode === 7) t.set(0, 68, 100 + (rng() < 0.7 ? 0 : ri(rng, -50, 100)))
      cap(out, [OP.UGETSTAT, 0, stat, 0], true)
      cap(out, [OP.UGETSTAT, 0, 68, 0])
      cap(out, [OP.UGETSTAT, 0, 67, 0])
      const c = ri(rng, 0, 6)
      out.push({ req: [OP.ANIMSPEED, mode, c], cap: true })
      cap(out, [OP.ANIMLAST, 0])
      const mk = (k: readonly number[]): number[] => [mode, c, k[0]!, k[1]!, k[2]!, k[4]!]
      out.push({ req: [OP.ANIMSPEED, mode, c], line: { cat: 'frames', f: 'anim.speed' }, mkA: mk })
      // Ticks derived from the oracle speed with the finish rule of 0x6FD7EF30 (accum + speed >= frames << 8).
      out.push({ req: [OP.ANIMSPEED, mode, c], line: { cat: 'frames', f: 'anim.ticks' }, mkA: mk, deriveV: (k, r) => (r > 0 ? Math.ceil((k[4]! * 256) / r) - 1 : -1) })
    }
  }
  t.restore()
}

// --------------------------------------------------------------- decode
type Resp = (number | string)[]

function parseResp(text: string): Resp[] {
  const out: Resp[] = []
  for (const l of text.split('\n')) {
    const t = l.trim()
    if (t) out.push(JSON.parse(t) as Resp)
  }
  return out
}

interface Mismatch {
  readonly line: FnLine
  readonly idx: number
  readonly ts: number
  readonly oracle: number
}

interface ClassAgg {
  key: string
  cat: CategoryId
  fn: string
  count: number
  items: Set<string>
  example?: Mismatch
  exampleScore: number
  lines: FnLine[]
}

function exampleScore(m: Mismatch): number {
  const hsum = (m.line.h ?? []).reduce((acc, [, v]) => acc + Math.abs(v), 0)
  const lvl = m.line.lo !== undefined ? Math.abs(m.line.lo + m.idx) : 0
  const asum = (m.line.a ?? []).reduce((acc, v) => acc + Math.min(Math.abs(v), 1e7), 0)
  return hsum * 1000 + lvl * 10 + asum / 1e3 + (m.line.s ?? 0) / 1000
}

function itemKey(l: FnLine): string {
  if (l.s !== undefined) return `skill ${l.s}`
  return l.f
}

// ------------------------------------------------------------------ main
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function main(): void {
  const seed = Number(arg('--seed') ?? 1)
  const outDir = resolve(arg('--out') ?? join(tmpdir(), 'd2oracle-fn'))
  const reuse = process.argv.includes('--reuse')
  const cats = new Set<CategoryId>((arg('--cats') ?? CATEGORY_IDS.join(',')).split(',') as CategoryId[])
  const [skLo, skHi] = (arg('--skills') ?? '0-9999').split('-').map(Number) as [number, number]
  const perPrim = Number(arg('--prim') ?? 100000)
  mkdirSync(outDir, { recursive: true })
  const reg = getSharedDataRegistry()
  const rng = mulberry32(seed)
  const plan: Planned[] = []
  const pc: PlanCtx = { reg, rng, skillLo: skLo, skillHi: skHi, out: plan }
  planSnapshot(pc)
  if (cats.has('primitives')) planPrimitives(pc, perPrim)
  const scale = Number(arg('--scale') ?? 1)
  if (cats.has('stats') || cats.has('block')) planStats(pc, Math.round(15000 * scale))
  if (cats.has('stats')) planVitals(pc, Math.round(100000 * scale))
  if (cats.has('hit')) planHit(pc, Math.round(30000 * scale))
  if (cats.has('resist')) planResist(pc, Math.round(5000 * scale))
  if (cats.has('steal')) planSteal(pc, Math.round(60000 * scale))
  if (cats.has('anim')) planAnim(pc, Math.round(30000 * scale))
  if (cats.has('exp')) planExp(pc, Math.round(100000 * scale))
  if (cats.has('dmg')) planDmg(pc, Math.round(8000 * scale))
  if (cats.has('frames')) planFrames(pc, Math.round(9000 * scale))
  // Skills last: SETSKILL adds skills to the player (e.g. weapon masteries that feed the
  // hit-chance pool via #10804), which must not leak into the unit-based categories above.
  if (cats.has('skills') || cats.has('skilleval')) planSkills(pc, cats)
  const reqPath = join(outDir, 'fn-req.ndjson')
  const respPath = join(outDir, 'fn-resp.ndjson')
  const reqText = plan.map(p => JSON.stringify(p.req)).join('\n') + '\n'
  if (reuse) {
    if (readFileSync(reqPath, 'utf8') !== reqText) throw new Error(`--reuse: ${reqPath} differs from this plan (seed/options changed)`)
  } else {
    writeFileSync(reqPath, reqText)
    process.stderr.write(`fn-sweep: ${plan.length} request lines -> oracle\n`)
    const secs = String(Math.max(300, Math.ceil(plan.length / 2000)))
    const r = spawnSync(join(HERE, 'run-fn-oracle.sh'), [reqPath, outDir, secs], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error(`oracle run failed (${String(r.status)})`)
  }
  const resp = parseResp(readFileSync(respPath, 'utf8'))
  if (resp.length !== plan.length) throw new Error(`response has ${resp.length} lines, plan ${plan.length}`)

  // Environment snapshot (player stats + native skill hard levels at start).
  const baseStats = new Map<number, number>()
  const baseHard = new Map<number, number>()
  const lines: FnLine[] = []
  let curStats: [number, number][] = []
  let caps: number[] = []
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]!
    const r = resp[i]!
    if (p.capReset) caps = []
    if (p.cap) caps.push(typeof r[0] === 'number' ? r[0] : NaN)
    if (p.snap === 'stat' && p.snapId !== undefined && p.snapId >= 0) baseStats.set(p.snapId, Number(r[0]))
    else if (p.snap === 'hard' && p.snapId !== undefined && p.snapId >= 0) {
      if (Number(r[0]) !== 0) baseHard.set(p.snapId, Number(r[0]))
    } else if (p.snap === 'stat' && p.snapId !== undefined && p.snapId <= -1) {
      const id = -1 - p.snapId
      if (p.cfgStart) curStats = []
      curStats = curStats.filter(([k]) => k !== id)
      if (Number(r[0]) !== (baseStats.get(id) ?? 0)) curStats.push([id, Number(r[0])])
    }
    if (([OP.SETSKILL, OP.SETSTAT, OP.RESTORESKILL, OP.RESTORESTAT, OP.USETSTAT, OP.URESTORE] as number[]).includes(p.req[0]!)) {
      if (r[0] === 'fault' || r[0] === 'bad') throw new Error(`control line ${i} failed: ${JSON.stringify(p.req)} -> ${String(r[0])}`)
    }
    if (p.line && !(p.skipIf && p.skipIf(caps))) {
      const raw = typeof r[0] === 'number' ? r[0] : NaN
      const l: FnLine = {
        ...p.line,
        ...(p.line.st !== undefined ? { st: [...curStats] } : {}),
        ...(p.mkA ? { a: p.mkA(caps) } : {}),
        v: p.deriveV && Number.isFinite(raw) ? [p.deriveV(caps, raw)] : r.map(x => (typeof x === 'number' ? x : String(x))),
      }
      lines.push(l)
    }
  }
  const header: FnFileHeader = {
    schema: 'd2oracle-fn/1',
    seed,
    stats: [...baseStats].filter(([, v]) => v !== 0),
    hard: [...baseHard],
  }
  const env0 = envFromHeader(header)

  // Compare.
  const t0 = Date.now()
  const perFn = new Map<string, { n: number; ok: number; fault: number }>()
  const perItem = new Map<string, { n: number; ok: number }>()
  const classes = new Map<string, ClassAgg>()
  let total = 0
  for (const l of lines) {
    const ts = evalLine(reg, env0, l)
    const keyFn = `${l.cat}\t${l.f}`
    const fa = perFn.get(keyFn) ?? { n: 0, ok: 0, fault: 0 }
    const ia = perItem.get(`${l.cat}\t${itemKey(l)}`) ?? { n: 0, ok: 0 }
    const keys = lineClassKeys(reg, l, ts)
    for (let k = 0; k < l.v.length; k++) {
      const o = l.v[k]
      total++
      fa.n++
      ia.n++
      if (typeof o !== 'number') {
        fa.fault++
        continue
      }
      if (ts[k] === o) {
        fa.ok++
        ia.ok++
        continue
      }
      const key = keys[k]!
      let c = classes.get(key)
      if (!c) {
        c = { key, cat: l.cat, fn: l.f, count: 0, items: new Set(), exampleScore: Infinity, lines: [] }
        classes.set(key, c)
      }
      c.count++
      c.items.add(itemKey(l))
      const m: Mismatch = { line: l, idx: k, ts: ts[k]!, oracle: o }
      const sc = exampleScore(m)
      if (sc < c.exampleScore) {
        c.exampleScore = sc
        c.example = m
      }
      if (c.lines[c.lines.length - 1] !== l) c.lines.push(l)
    }
    perFn.set(keyFn, fa)
    perItem.set(`${l.cat}\t${itemKey(l)}`, ia)
  }
  process.stderr.write(`fn-sweep: compared ${total} values in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${classes.size} mismatch classes\n`)

  // Stable mismatch ids.
  const sorted = [...classes.values()].sort((a, b) => (a.cat === b.cat ? b.count - a.count : a.cat.localeCompare(b.cat)))
  const ids = new Map<string, string>()
  const perCat = new Map<string, number>()
  for (const c of sorted) {
    const n = (perCat.get(c.cat) ?? 0) + 1
    perCat.set(c.cat, n)
    ids.set(c.key, `M-${c.cat}-${String(n).padStart(3, '0')}`)
  }

  if (!process.argv.includes('--no-goldens')) writeGoldens(header, lines, classes, ids, reg)
  if (!process.argv.includes('--no-report')) writeReport({ seed, perFn, perItem, sorted, ids, total, reg, planLines: plan.length })
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ total, classes: sorted.map(c => ({ id: ids.get(c.key), key: c.key, count: c.count })) }, null, 1))
}

// -------------------------------------------------------------- goldens
const GOLDEN_DIR = join(REPO, 'tests/fixtures/oracle/formulas')
const GOLDEN_MAX = 1_400_000

function writeGoldens(header: FnFileHeader, lines: readonly FnLine[], classes: ReadonlyMap<string, ClassAgg>, ids: ReadonlyMap<string, string>, reg: D2DataRegistry): void {
  mkdirSync(GOLDEN_DIR, { recursive: true })
  const lineClass = new Map<FnLine, string[]>()
  for (const c of classes.values()) {
    for (const l of c.lines) {
      const arr = lineClass.get(l) ?? []
      arr.push(ids.get(c.key)!)
      lineClass.set(l, arr)
    }
  }
  const byCat = new Map<CategoryId, FnLine[]>()
  for (const l of lines) {
    const arr = byCat.get(l.cat) ?? []
    arr.push(l)
    byCat.set(l.cat, arr)
  }
  const srng = mulberry32(header.seed ^ 0x5eed)
  for (const [cat, ls] of byCat) {
    const out: string[] = [JSON.stringify({ ...header, cat })]
    let size = out[0]!.length + 1
    const add = (l: FnLine, mm?: string[]): boolean => {
      const s = JSON.stringify(mm ? { ...l, mm } : l)
      if (size + s.length + 1 > GOLDEN_MAX) return false
      out.push(s)
      size += s.length + 1
      return true
    }
    // 1. Mismatching lines: per class, the example line first, then up to 60 more.
    const taken = new Set<FnLine>()
    for (const c of [...classes.values()].filter(x => x.cat === cat)) {
      const ex = c.example?.line
      const cand = ex ? [ex, ...c.lines.filter(l => l !== ex)] : c.lines
      for (const l of cand.slice(0, 61)) {
        if (taken.has(l)) continue
        taken.add(l)
        add(l, lineClass.get(l))
      }
    }
    // 2. Boundary lines (lvl <= 0 or > 60, extreme primitive inputs) that agree.
    const agree = ls.filter(l => !lineClass.has(l))
    const isBoundary = (l: FnLine): boolean =>
      (l.lo !== undefined && (l.lo <= 0 || l.lo > 60)) || (l.a !== undefined && l.a.some(v => Math.abs(v) >= 0x100000 || v === 0))
    const bnd = agree.filter(isBoundary)
    const rest = agree.filter(l => !isBoundary(l))
    shuffle(bnd, srng)
    shuffle(rest, srng)
    let budget = Math.floor((GOLDEN_MAX - size) * 0.3)
    for (const l of bnd) {
      const s = JSON.stringify(l).length + 1
      if (s > budget) break
      if (!add(l)) break
      budget -= s
    }
    for (const l of rest) if (!add(l)) break
    writeFileSync(join(GOLDEN_DIR, `${cat}.ndjson`), out.join('\n') + '\n')
    process.stderr.write(`goldens: ${cat}.ndjson ${out.length - 1} lines, ${(size / 1024).toFixed(0)} KiB\n`)
  }
  void reg
}

function shuffle<T>(xs: T[], r: Rng): void {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const t = xs[i]!
    xs[i] = xs[j]!
    xs[j] = t
  }
}

// --------------------------------------------------------------- report
function pct(ok: number, n: number): string {
  return n === 0 ? '-' : `${((100 * ok) / n).toFixed(n - ok > 0 && ok / n > 0.9995 ? 4 : 2)}%`
}

function describeExample(reg: D2DataRegistry, m: Mismatch): string {
  const l = m.line
  const parts: string[] = []
  if (l.s !== undefined) {
    const sk = reg.getSkillById(l.s)
    parts.push(`skill ${l.s} \`${sk?.name ?? '?'}\``)
    parts.push(`lvl ${(l.lo ?? 0) + m.idx}`)
    if (l.x !== undefined) parts.push(`x=${l.x}`)
    const h = (l.h ?? []).filter(([, v]) => v !== 0)
    if (h.length) parts.push(`hard {${h.map(([id, v]) => `${id}:${v}`).join(', ')}}`)
    if (l.st?.length) parts.push(`stats {${l.st.map(([id, v]) => `${id}:${v}`).join(', ')}}`)
  }
  if (l.a) parts.push(`args [${l.a.join(', ')}]`)
  return `${parts.join(', ')} -> oracle \`${m.oracle}\`, TS \`${m.ts}\``
}

function writeReport(o: {
  seed: number
  perFn: Map<string, { n: number; ok: number; fault: number }>
  perItem: Map<string, { n: number; ok: number }>
  sorted: ClassAgg[]
  ids: Map<string, string>
  total: number
  reg: D2DataRegistry
  planLines: number
}): void {
  const L: string[] = []
  L.push('# P5.3 — function-level randomized differential sweep (1.13c formulas)')
  L.push('')
  L.push('Generated by `npx tsx tools/oracle/fn-sweep.ts` (seed ' + String(o.seed) + '). Oracle = original 1.13c')
  L.push('`D2Common.dll` / `D2Game.dll` functions called in-process by `tools/oracle/hook/fnharness.dll.c` inside a')
  L.push('running single-player game (level-1 Barbarian, Rogue Encampment); TS = the functions in')
  L.push('`tools/oracle/lib/fn-formulas.ts`. Calling conventions: `kb/engine/oracle-fn-harness-113c.md`.')
  L.push('')
  L.push('## How to run')
  L.push('')
  L.push('```sh')
  L.push('cp -a ~/.local/opt/d2oracle/wine/prefix ~/.local/opt/d2oracle/wine/prefix-fn   # once')
  L.push('npx tsx tools/oracle/fn-sweep.ts --seed 1            # oracle run + compare + goldens + this report')
  L.push('npx tsx tools/oracle/fn-sweep.ts --seed 1 --reuse    # re-compare against the last oracle output')
  L.push('npx vitest run tests/oracle/formula-golden.test.ts   # goldens, no Wine needed')
  L.push('```')
  L.push('')
  L.push(`Request lines: ${o.planLines}; compared values: ${o.total}.`)
  L.push('')
  L.push('## Agreement per category / function')
  L.push('')
  L.push('| category | function | compared | agree | rate | oracle faults |')
  L.push('|---|---|---:|---:|---:|---:|')
  const catTot = new Map<string, { n: number; ok: number }>()
  for (const [k, v] of [...o.perFn].sort()) {
    const [cat, fn] = k.split('\t') as [string, string]
    L.push(`| ${cat} | \`${fn}\` | ${v.n} | ${v.ok} | ${pct(v.ok, v.n - v.fault)} | ${v.fault} |`)
    const t = catTot.get(cat) ?? { n: 0, ok: 0 }
    t.n += v.n - v.fault
    t.ok += v.ok
    catTot.set(cat, t)
  }
  L.push('')
  L.push('| category | compared | agree | rate |')
  L.push('|---|---:|---:|---:|')
  for (const [cat, t] of catTot) L.push(`| ${cat} | ${t.n} | ${t.ok} | ${pct(t.ok, t.n)} |`)
  L.push('')
  L.push('## Agreement per skill (skills below 100%)')
  L.push('')
  const bad = [...o.perItem].filter(([k, v]) => k.startsWith('skills\tskill') && v.ok < v.n)
  const full = [...o.perItem].filter(([k, v]) => k.startsWith('skills\tskill') && v.ok === v.n).length
  L.push(`${full} skills agree on every compared value; ${bad.length} do not:`)
  L.push('')
  L.push('| skill | name | compared | agree | rate |')
  L.push('|---:|---|---:|---:|---:|')
  for (const [k, v] of bad.sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)) {
    const id = Number(k.split(' ')[1])
    L.push(`| ${id} | ${o.reg.getSkillById(id)?.name ?? '?'} | ${v.n} | ${v.ok} | ${pct(v.ok, v.n)} |`)
  }
  L.push('')
  if (FIX_LOG.length) {
    L.push('## TS fixes applied from this sweep')
    L.push('')
    for (const f of FIX_LOG) L.push(`- ${f}`)
    L.push('')
  }
  L.push('## Mismatch classes')
  L.push('')
  L.push('Class key = `category|function|argument|level band`. Each class lists the minimized counterexample')
  L.push('(fewest synergy points, lowest level) and the root-cause hypothesis with binary evidence.')
  L.push('Known-failing goldens reference the id in `tests/oracle/formula-golden.test.ts`.')
  L.push('')
  for (const c of o.sorted) {
    const id = o.ids.get(c.key)!
    const parts = c.key.split('|')
    const band = parts[parts.length - 1] ?? ''
    const byBand = HYPOTHESES[`${c.cat}|*|${band}`]
    const h =
      HYPOTHESES[c.key] ??
      HYPOTHESES[parts.slice(0, 3).join('|')] ??
      (c.cat !== 'skills' ? byBand : undefined) ??
      HYPOTHESES[parts.slice(0, 2).join('|')] ??
      byBand
    L.push(`### ${id} \`${c.key}\``)
    L.push('')
    L.push(`- mismatching values: ${c.count}; affected: ${[...c.items].slice(0, 12).join(', ')}${c.items.size > 12 ? `, … (${c.items.size})` : ''}`)
    if (c.example) L.push(`- minimized counterexample: ${describeExample(o.reg, c.example)}`)
    L.push(`- hypothesis: ${h ?? 'not analysed yet'}`)
    L.push('')
  }
  const path = join(REPO, 'docs/oracle/P5-formula-sweep.md')
  writeFileSync(path, L.join('\n') + '\n')
  process.stderr.write(`report: ${relative(REPO, path)}\n`)
}

if (existsSync(REPO)) main()

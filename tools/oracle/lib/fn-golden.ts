/**
 * Golden-vector format of the P5.3 function-level oracle sweep
 * (`tests/fixtures/oracle/formulas/<category>.ndjson`) and the TS evaluation of
 * one line. Shared by `tools/oracle/fn-sweep.ts` and
 * `tests/oracle/formula-golden.test.ts`.
 *
 * File = header line ({@link FnFileHeader}) + one {@link FnLine} per line.
 */
import type { D2DataRegistry } from '../../../src/common/data/data-registry.ts'
import { getCharAnimClip113c } from '../../../src/common/units/char-anim-speed.ts'
import {
  SKILLCALC_CODES,
  skillCalcFieldName,
  skillCalcText,
  tsPrimFn,
  tsSkillEvalFn,
  tsSkillFn,
  tsCombatFn,
  tsDmgFn,
  tsAnimFn,
  RESIST_ROWS,
  DMG_CHANNELS,
  PLR_MODE_CODES,
  WCLASS_CODES,
  type AnimFn,
  type CombatFn,
  type DmgFn,
  type PrimFn,
  type SkillEnv,
  type SkillEvalFn,
  type SkillFn,
  type SkillLineCache,
} from './fn-formulas.ts'

export const CATEGORY_IDS = ['skills', 'skilleval', 'primitives', 'stats', 'hit', 'block', 'resist', 'steal', 'anim', 'exp', 'dmg', 'frames'] as const
/** Categories whose lines carry an argument list `a` and one oracle value. */
export const COMBAT_CATEGORIES: ReadonlySet<string> = new Set(['stats', 'hit', 'block', 'resist', 'steal', 'anim', 'exp', 'dmg', 'frames'])
export type CategoryId = (typeof CATEGORY_IDS)[number]

export interface FnFileHeader {
  readonly schema: 'd2oracle-fn/1'
  readonly seed: number
  readonly cat?: CategoryId
  /** Player accrued stats (#10973 layer 0) at harness start, non-zero only. */
  readonly stats: readonly (readonly [number, number])[]
  /** Native skill hard levels (pSkill+0x28) at harness start, non-zero only. */
  readonly hard: readonly (readonly [number, number])[]
}

export interface FnLine {
  readonly cat: CategoryId
  readonly f: SkillFn | SkillEvalFn | PrimFn | CombatFn | DmgFn | AnimFn
  /** skills/skilleval: skill id, argument (code / field offset / mastery flag), first level. */
  readonly s?: number
  readonly x?: number
  readonly lo?: number
  /** skills/skilleval: hard-level overrides and accrued-stat overrides for this line. */
  readonly h?: readonly (readonly [number, number])[]
  readonly st?: readonly (readonly [number, number])[]
  /** primitives: oracle argument list. */
  readonly a?: readonly number[]
  /** Oracle results: one per level (lo, lo+1, ...) or a single value; "fault" if the call faulted. */
  readonly v: readonly (number | string)[]
  /** Mismatch ids (docs/oracle/P5-formula-sweep.md) present on this line. */
  readonly mm?: readonly string[]
}

export interface BaseEnv {
  readonly stats: ReadonlyMap<number, number>
  readonly hard: ReadonlyMap<number, number>
}

export function envFromHeader(h: FnFileHeader): BaseEnv {
  return { stats: new Map(h.stats.map(([k, v]) => [k, v])), hard: new Map(h.hard.map(([k, v]) => [k, v])) }
}

export function lineEnv(base: BaseEnv, l: FnLine): SkillEnv {
  const hard = new Map(base.hard)
  for (const [k, v] of l.h ?? []) hard.set(k, v)
  const stats = new Map(base.stats)
  for (const [k, v] of l.st ?? []) stats.set(k, v)
  return { hard, stats }
}

export function lineValueCount(l: FnLine): number {
  return l.v.length
}

const SKILL_FNS: ReadonlySet<string> = new Set(['skcalc', 'skform', 'elmin', 'elmax', 'elen', 'phmin', 'phmax', 'tohit', 'rawmana'])

/** TS values for every oracle value of the line (same order as `l.v`). */
export function evalLine(reg: D2DataRegistry, base: BaseEnv, l: FnLine): number[] {
  const out: number[] = []
  if (l.cat === 'primitives') {
    out.push(tsPrimFn(l.f as PrimFn, l.a ?? []))
    return out
  }
  if (l.cat === 'dmg') {
    out.push(tsDmgFn(reg, l.f as DmgFn, l.a ?? []))
    return out
  }
  if (l.cat === 'frames') {
    out.push(tsAnimFn(l.f as AnimFn, l.a ?? []))
    return out
  }
  if (COMBAT_CATEGORIES.has(l.cat)) {
    out.push(tsCombatFn(reg, l.f as CombatFn, l.a ?? []))
    return out
  }
  const env = lineEnv(base, l)
  const cache: SkillLineCache = {}
  for (let k = 0; k < l.v.length; k++) {
    const lvl = (l.lo ?? 0) + k
    if (SKILL_FNS.has(l.f)) out.push(tsSkillFn(reg, l.f as SkillFn, l.s ?? 0, lvl, l.x ?? 0, env, cache))
    else out.push(tsSkillEvalFn(reg, l.f as SkillEvalFn, l.s ?? 0, lvl, env, cache))
  }
  return out
}

function calcFeature(text: string): string {
  const t = text.toLowerCase()
  if (!t.trim()) return 'empty'
  if (t.includes('sklvl(')) return 'sklvl'
  if (t.includes('miss(')) return 'miss'
  if (t.includes('stat(')) return 'stat'
  if (/skill\([^)]*\.blvl/.test(t)) return 'synergy-blvl'
  if (t.includes('skill(')) return 'skill-ref'
  if (t.includes('?')) return 'ternary'
  return 'plain'
}

function lvlBand(lvl: number): string {
  return lvl <= 0 ? 'lvl<=0' : lvl > 99 ? 'lvl>=100' : lvl > 60 ? 'lvl61-99' : 'lvl1-60'
}

function dmgTag(a: readonly number[]): string {
  const n = (i: number): number => a[i] ?? 0
  const side = n(0) ? 'player' : 'monster'
  const ch = DMG_CHANNELS[n(3)]?.elemType ?? String(n(3))
  const tag =
    n(6) < 0 || n(7) < 0 ? 'dr/mdr<0'
      : n(13) < 0 ? 'pierce<0'
      : n(11) < 0 ? 'absorb%<0'
      : n(4) > 0x100000 || n(2) > 0x100000 ? 'big'
      : n(4) > 0 && n(7) * 256 >= n(4) ? 'mdr>=elem'
      : n(2) > 0 && n(6) * 256 >= n(2) ? 'dr>=phys'
        : n(5) > 0 ? 'rate'
          : n(11) > 0 || n(12) > 0 ? 'absorb'
            : n(9) >= 100 || n(8) >= 100 ? 'res>=100'
              : n(9) < 0 || n(8) < 0 ? 'res<0'
                : 'plain'
  return `${side}|${ch}|${tag}`
}

function framesTag(f: AnimFn, a: readonly number[]): string {
  const n = (i: number): number => a[i] ?? 0
  if (f.startsWith('animdata.')) {
    const clip = getCharAnimClip113c(n(0), n(1), { weaponClass: (WCLASS_CODES[n(2)] ?? 'hth').toLowerCase() })
    return `${PLR_MODE_CODES[n(1)] ?? String(n(1))}${f === 'animdata.action' && clip.events.length === 0 ? '|ts-no-event' : ''}`
  }
  return `${PLR_MODE_CODES[n(0)] ?? n(0)}|${n(2) < 0 ? 'stat<0' : n(2) > 1000 ? 'stat>1000' : 'stat0-1000'}`
}

function combatTag(f: CombatFn, a: readonly number[], oracle: number | string | undefined): string {
  const n = (i: number): number => a[i] ?? 0
  const o = typeof oracle === 'number' ? oracle : NaN
  switch (f) {
    case 'ar':
      return o < 0 ? 'ar<0' : 'ar>=0'
    case 'def':
      if (n(0) < 0) return 'dex<0'
      if (n(4) !== 0) return 'override'
      return n(2) + n(3) !== 0 ? 'pct' : 'flat'
    case 'block':
      return `${n(1) ? 'expansion' : 'classic'}${n(3) <= 0 ? '+lvl<=0' : ''}${n(2) < 15 ? '+dex<15' : ''}`
    case 'hit':
      if (n(2) <= 0 || n(3) <= 0) return 'lvl<=0'
      if (n(2) + n(3) <= 0) return 'lvlsum<=0'
      return `${n(6) ? 'missile' : 'melee'}${n(4) + n(5) !== 0 ? '+pct' : ''}${Math.abs(n(0)) > 0xfffff ? '+bigAR' : ''}`
    case 'resist': {
      const row = RESIST_ROWS[n(0)]
      return `${n(1) ? 'player' : 'monster'}|${row?.channel ?? n(0)}${n(4) < 0 ? '+negpierce' : ''}${n(2) >= 100 ? '+res>=100' : ''}`
    }
    case 'steal.life':
    case 'steal.mana':
      return n(0) <= 0 || (f === 'steal.life' ? n(1) : n(2)) <= 0 ? 'nonpositive' : 'positive'
    case 'diminish':
      return n(1) <= -120 ? 'v<=-120' : n(1) < 0 ? 'v<0' : 'v>=0'
    case 'vit.maxhp':
    case 'vit.maxstamina':
    case 'ene.maxmana':
      return n(1) < 0 ? 'respec' : 'alloc'
    case 'explvl':
      return n(0) <= 0 || n(1) <= 0 ? 'lvl<=0' : n(2) <= 0 ? 'exp<=0' : n(2) > 0x7fffff ? 'exp>cap' : n(2) > 0x100000 ? 'exp>2^20' : 'normal'
    case 'expratio':
      return n(1) <= 0 || n(1) > 99 ? 'clvl-out-of-range' : n(0) <= 0 ? 'exp<=0' : n(0) > 0x7fffff ? 'exp>cap' : n(0) > 0xfffff ? 'exp>2^20' : 'normal'
    default:
      return 'all'
  }
}

/** Mismatch class key per value: `category|function|argument|band`. */
export function lineClassKeys(reg: D2DataRegistry, l: FnLine, ts: readonly number[]): string[] {
  if (l.cat === 'primitives') return [`${l.cat}|${l.f}|${primTag(l.f as PrimFn, l.a ?? [], ts[0] ?? 0)}`]
  if (l.cat === 'dmg') return [`${l.cat}|${l.f}|${dmgTag(l.a ?? [])}`]
  if (l.cat === 'frames') return [`${l.cat}|${l.f}|${framesTag(l.f as AnimFn, l.a ?? [])}`]
  if (COMBAT_CATEGORIES.has(l.cat)) return [`${l.cat}|${l.f}|${combatTag(l.f as CombatFn, l.a ?? [], l.v[0])}`]
  const skill = reg.getSkillById(l.s ?? -1)
  let arg = ''
  if (l.f === 'skcalc') arg = SKILLCALC_CODES[l.x ?? 0] ?? String(l.x)
  else if (l.f === 'skform') arg = `${skillCalcFieldName(l.x ?? 0)}:${skill ? calcFeature(skillCalcText(reg, skill, l.x ?? 0)) : '?'}`
  else if (l.f === 'elmin' || l.f === 'elmax') arg = `mastery${l.x ?? 0}`
  return l.v.map((_, k) => `${l.cat}|${l.f}|${arg}|${lvlBand((l.lo ?? 0) + k)}`)
}

function primTag(f: PrimFn, a: readonly number[], ts: number): string {
  const [a0 = 0, a1 = 0, a2 = 0] = a
  const nonInt32 = !Number.isInteger(ts) || ts !== (ts | 0) ? '+ts-not-int32' : ''
  if (f === 'muldiv' || f === 'muldiv.fog') {
    // oracle [edx, eax, ecx]; D2Common 0x6FD511E0 path selection
    if (a2 === 0) return 'div0'
    if (a0 > 0x100000) return (a2 > a0 >> 4 ? 'edx-big-wide' : 'edx-big-shortcut') + nonInt32
    if (a1 > 0x10000) return (a2 > a1 >> 4 ? 'eax-big-wide' : 'eax-big-shortcut') + nonInt32
    return 'imul32' + nonInt32
  }
  if (f === 'dimret') {
    if (a0 + 6 === 0) return 'lvl=-6'
    if (a0 < 0) return 'lvl<0' + nonInt32
    return (Math.abs(a0) > 0xffffff || Math.abs(a2 - a1) > 0xffffff ? 'overflow' : 'normal') + nonInt32
  }
  return (a0 <= 1 ? 'lvl<=1' : a.some(v => Math.abs(v) > 0xfffff) || Math.abs(a0) > 0xffff ? 'overflow' : 'normal') + nonInt32
}

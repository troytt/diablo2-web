/**
 * [K2] In-browser `SUNITDMG_*` settlement engine (`showcase/k2/combat-browser-engine.ts`).
 *
 * Runs the canonical manifest-bound kernel port of `D2Game.dll` `0x6FCFC0B0`
 * (`SUNITDMG_ApplyResistancesAndAbsorb113c`, `src/d2kern-113c/game/k2-real-s2c-combat-113c.ts`)
 * and its callees (`0x6FCFA7B0`, `0x6FCFBD00`, `0x6FCFB3C0`, `0x6FCFAD00`, `0x6FCFB570`, ...)
 * directly in the browser on a `SparseMemory113c` image. Pure TypeScript, zero Node imports;
 * the same module is executed under vitest so the page and the test run identical code.
 *
 * Memory fixture (built here, NOT a dump of the DLL harness's live game):
 *   - `D2GameStrc` with `bExpansion = 1` and the vector's difficulty.
 *   - one player unit (seeded with the harness header's recorded baseline stats) and one monster
 *     unit, each with an empty `D2StatListExStrc`; the vector picks which one defends.
 *   - an empty `sgptDataTables` block, so D2Common max-life lookups fall back to the raw stat.
 *   - `D2DamageStrc` populated exactly like the harness op (`+0x08` phys, channel offset elem,
 *     `+0x54` rate) and the defender / attacker stats set to the vector's recorded accrued values.
 */

import {
  D2DamageStrc_SIZE,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2StatListExStrc_SIZE,
  D2UnitStrc,
  D2UnitStrc_SIZE,
  STATLIST_SetUnitStat113c,
  SparseMemory113c,
  UNIT_MONSTER,
  UNIT_PLAYER,
} from '../../src/d2kern-113c/index.ts'
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../../src/d2kern-113c/common/inline-helpers.ts'
import { SUNITDMG_ApplyResistancesAndAbsorb113c } from '../../src/d2kern-113c/game/k2-real-s2c-combat-113c.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../src/d2kern-113c/va-trace-113c.ts'
import type { K2CombatChannel, K2CombatExpected, K2CombatSettlement } from './types.ts'

export const K2_COMBAT_FIELDS = ['phys', 'elem', 'total', 'absorb'] as const
export type K2CombatField = (typeof K2_COMBAT_FIELDS)[number]

/** `D2DamageStrc` offsets read back after the call. */
export const K2_COMBAT_FIELD_OFFSETS: Readonly<Record<Exclude<K2CombatField, 'elem'>, number>> = {
  phys: 0x08,
  total: 0x4c,
  absorb: 0x48,
}

export interface K2CombatRunResult {
  readonly phys: number
  readonly elem: number
  readonly total: number
  readonly absorb: number
  /** Sorted `Module:0xVA` keys the kernel actually executed for this settlement. */
  readonly chain: readonly string[]
  readonly error: string | null
}

export interface K2CombatFixtureOptions {
  readonly playerBaseStats: readonly (readonly [number, number])[]
  readonly channels: readonly K2CombatChannel[]
  /** Capture the executed VA chain (slower); defaults to `false`. */
  readonly trace?: boolean
}

/** Runs one settlement vector `a` through the canonical kernel chain. */
export function runCombatSettlement(a: readonly number[], opts: K2CombatFixtureOptions): K2CombatRunResult {
  const n = (i: number): number => a[i] ?? 0
  const ch = opts.channels[n(3)]
  if (!ch) {
    return { phys: 0, elem: 0, total: 0, absorb: 0, chain: [], error: `unknown channel index ${n(3)}` }
  }
  if (opts.trace === true) beginVaTrace113c()
  let chain: string[] = []
  try {
    const m = new SparseMemory113c()
    const pTables = m.alloc(0x1000)
    m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pTables)

    const pGame = m.alloc(D2GameStrc_SIZE)
    m.set(pGame, D2GameStrc.bExpansion, 1)
    m.set(pGame, D2GameStrc.nDifficulty, n(1))

    const allocUnit = (unitType: number, unitId: number): number => {
      const pUnit = m.alloc(D2UnitStrc_SIZE)
      const pStatList = m.alloc(D2StatListExStrc_SIZE)
      m.set(pUnit, D2UnitStrc.dwUnitType, unitType)
      m.set(pUnit, D2UnitStrc.dwUnitId, unitId)
      m.set(pUnit, D2UnitStrc.dwAnimMode, 1)
      m.set(pUnit, D2UnitStrc.pStatListEx, pStatList)
      m.set(pUnit, D2UnitStrc.pGame, pGame)
      m.setU32((pStatList + 0x10) >>> 0, 0x80000000)
      return pUnit
    }
    const pPlayer = allocUnit(UNIT_PLAYER, 1)
    const pMonster = allocUnit(UNIT_MONSTER, 2)
    for (const [statId, value] of opts.playerBaseStats) STATLIST_SetUnitStat113c(m, pPlayer, statId, value, 0)

    const pDefender = n(0) !== 0 ? pPlayer : pMonster
    const pAttacker = n(0) !== 0 ? pMonster : pPlayer
    STATLIST_SetUnitStat113c(m, pDefender, 34, n(6), 0)
    STATLIST_SetUnitStat113c(m, pDefender, 35, n(7), 0)
    STATLIST_SetUnitStat113c(m, pDefender, 36, n(8), 0)
    STATLIST_SetUnitStat113c(m, pDefender, ch.res, n(9), 0)
    STATLIST_SetUnitStat113c(m, pDefender, ch.max, n(10), 0)
    STATLIST_SetUnitStat113c(m, pDefender, ch.absPct, n(11), 0)
    STATLIST_SetUnitStat113c(m, pDefender, ch.absFlat, n(12), 0)
    if (ch.pierce >= 0) STATLIST_SetUnitStat113c(m, pAttacker, ch.pierce, n(13), 0)

    const pDmg = m.alloc(D2DamageStrc_SIZE)
    m.setU32((pDmg + 0x08) >>> 0, n(2) >>> 0)
    m.setU32((pDmg + ch.off) >>> 0, n(4) >>> 0)
    m.setU32((pDmg + 0x54) >>> 0, n(5) >>> 0)

    SUNITDMG_ApplyResistancesAndAbsorb113c(m, pAttacker, pDefender, pDmg)

    const out = {
      phys: m.u32((pDmg + K2_COMBAT_FIELD_OFFSETS.phys) >>> 0) | 0,
      elem: m.u32((pDmg + ch.off) >>> 0) | 0,
      total: m.u32((pDmg + K2_COMBAT_FIELD_OFFSETS.total) >>> 0) | 0,
      absorb: m.u32((pDmg + K2_COMBAT_FIELD_OFFSETS.absorb) >>> 0) | 0,
    }
    if (opts.trace === true) chain = [...endVaTrace113c()].sort()
    return { ...out, chain, error: null }
  } catch (e) {
    if (opts.trace === true) chain = [...endVaTrace113c()].sort()
    return {
      phys: 0,
      elem: 0,
      total: 0,
      absorb: 0,
      chain,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export interface K2CombatVerdict {
  /** Per sampled field: `true` match, `false` mismatch, `null` = DLL did not sample this field. */
  readonly fields: Readonly<Record<K2CombatField, boolean | null>>
  readonly sampled: number
  readonly matched: number
  readonly allMatch: boolean
}

export function judgeSettlement(result: K2CombatRunResult, exp: K2CombatExpected): K2CombatVerdict {
  const fields: Record<K2CombatField, boolean | null> = { phys: null, elem: null, total: null, absorb: null }
  let sampled = 0
  let matched = 0
  for (const f of K2_COMBAT_FIELDS) {
    const want = exp[f]
    if (want === null) continue
    sampled++
    const ok = result.error === null && result[f] === want
    fields[f] = ok
    if (ok) matched++
  }
  return { fields, sampled, matched, allMatch: sampled === matched }
}

/** Observable input features used to bucket mismatches (derived only from the vector arguments). */
export function settlementFeatures(a: readonly number[]): string[] {
  const n = (i: number): number => a[i] ?? 0
  const feats: string[] = []
  const big = 0x10000
  if (n(2) > big || n(4) > big) feats.push('dmg > 0x10000 (256 HP)')
  if (n(5) !== 0) feats.push('rate54 ≠ 0')
  if (n(6) < 0) feats.push('DR < 0')
  if (n(7) < 0) feats.push('MDR < 0')
  if (n(0) === 0 && n(8) > 50) feats.push('怪物 physRes > 50')
  if (n(0) === 0 && n(9) > 75 && n(9) < 100) feats.push('怪物 res 76..99')
  if (n(9) >= 100) feats.push('res ≥ 100')
  if (n(11) < 0) feats.push('absPct < 0')
  if (n(13) < 0) feats.push('pierce < 0')
  if (n(0) !== 0 && n(1) > 0) feats.push('玩家 + NM/Hell 抗性惩罚')
  return feats
}

export interface K2CombatSweepSummary {
  readonly settlements: number
  readonly settlementsAllMatch: number
  readonly fieldsSampled: number
  readonly fieldsMatched: number
  readonly errors: number
  readonly elapsedMs: number
  readonly verdicts: readonly K2CombatVerdict[]
  readonly results: readonly K2CombatRunResult[]
  /** Per feature: settlements carrying it and how many of them fully match. */
  readonly byFeature: readonly { readonly feature: string; readonly total: number; readonly allMatch: number }[]
}

export function sweepCombatSettlements(
  settlements: readonly K2CombatSettlement[],
  opts: K2CombatFixtureOptions,
  now: () => number = () => 0,
): K2CombatSweepSummary {
  const t0 = now()
  const verdicts: K2CombatVerdict[] = []
  const results: K2CombatRunResult[] = []
  const feat = new Map<string, { total: number; allMatch: number }>()
  let allMatch = 0
  let sampled = 0
  let matched = 0
  let errors = 0
  for (const s of settlements) {
    const r = runCombatSettlement(s.a, { playerBaseStats: opts.playerBaseStats, channels: opts.channels })
    const v = judgeSettlement(r, s.exp)
    results.push(r)
    verdicts.push(v)
    if (r.error !== null) errors++
    if (v.allMatch) allMatch++
    sampled += v.sampled
    matched += v.matched
    const feats = settlementFeatures(s.a)
    for (const f of feats.length > 0 ? feats : ['(无特殊特征)']) {
      let e = feat.get(f)
      if (!e) {
        e = { total: 0, allMatch: 0 }
        feat.set(f, e)
      }
      e.total++
      if (v.allMatch) e.allMatch++
    }
  }
  const byFeature = [...feat.entries()]
    .map(([feature, e]) => ({ feature, total: e.total, allMatch: e.allMatch }))
  byFeature.sort((x, y) => y.total - y.allMatch - (x.total - x.allMatch) || (x.feature < y.feature ? -1 : 1))
  return {
    settlements: settlements.length,
    settlementsAllMatch: allMatch,
    fieldsSampled: sampled,
    fieldsMatched: matched,
    errors,
    elapsedMs: now() - t0,
    verdicts,
    results,
    byFeature,
  }
}

/**
 * Shared TS side of the function-level oracle (P5.3): maps every oracle
 * function id used by `tools/oracle/fn-sweep.ts` and the committed goldens
 * (`tests/fixtures/oracle/formulas/*.ndjson`) to the TS implementation it is
 * compared against. Oracle-side calling conventions:
 * `kb/engine/oracle-fn-harness-113c.md`.
 */
import {
  evaluateCalc,
  compute5BandScaling,
  computeDiminishingReturnsRaw,
  computeRawSkillMana256_113c,
  computeRawSkillPhysDmg256_113c,
  type CalcEvalContext,
} from '../../../src/common/data/calc-ast.ts'
import type { D2DataRegistry, SkillRecord } from '../../../src/common/data/data-registry.ts'
import {
  applyRawStealDelta256_113c,
  computeLifeManaSteal113c,
  computeRawDamagePipe113c,
  computeRawEffectiveResistance113c,
  computeRawPlayerBlockRate113c,
  computeRawToHitChance113c,
  mulDiv113c,
  type ResistChannel113c,
} from '../../../src/server/engine/combat-pipeline.ts'
import {
  CHARACTER_CLASS_CODES,
  calculateVitalsAtLevel,
  computeRawAttackRating113c,
  computeRawStatAllocDelta256_113c,
  resolveCharacterClass,
} from '../../../src/common/units/classes.ts'
import {
  computeRawAnimDataActionFrame113c,
  computeRawDiminishingRate113c,
  computeRawOneShotTicks113c,
  computeRawPlayerAnimSpeed113c,
  getCharAnimClip113c,
} from '../../../src/common/units/char-anim-speed.ts'
import { applyRawExpRatio113c, computeRawMonsterExpGrant113c } from '../../../src/common/progression/experience-113c.ts'
import { difficultyLifeStealDivisor, difficultyManaStealDivisor, difficultyResistPenalty } from '../../../src/server/engine/difficulty-resist-penalty.ts'
import { fogMulDiv113c } from '../../../src/common/items/transaction-cost.ts'
import { evaluateSkill113c } from '../../../src/server/skills/registry.ts'
import { computeRawDefense113c, UnitStatList } from '../../../src/server/engine/stat-list.ts'

/** `SkillCalc.txt` row order = D2Common SkillCalc callback code (`#10147`, table `0x6FDA174C`). */
export const SKILLCALC_CODES: readonly string[] = (
  'ln12 dm12 ln34 dm34 ln56 dm56 ln78 dm78 par1 par2 par3 par4 par5 par6 par7 par8 lvl edmn edmx edln ' +
  'toht mana mps math madm macr m1en m1ex m1el m2en m2ex m2el m3en m3ex m3el m1rn m2rn m3rn edns edxs ' +
  'ulvl blvl usmc m1eo m1ey m2eo m2ey me3o me3y enma exma edma enms exms len clc1 clc2 clc3 clc4 rng ' +
  'ast1 ast2 ast3 ast4 ast5 ast6 pst1 pst2 pst3 pst4 pst5 pets skpt'
).split(' ')

/** Skills.txt record offsets that hold a calc-buffer index (D2Common, record stride 0x23C). */
export const SKILL_CALC_FIELDS: readonly { readonly off: number; readonly name: string }[] = [
  { off: 0x60, name: 'auralencalc' },
  { off: 0x64, name: 'aurarangecalc' },
  { off: 0x68, name: 'aurastatcalc1' },
  { off: 0x6c, name: 'aurastatcalc2' },
  { off: 0x70, name: 'aurastatcalc3' },
  { off: 0x74, name: 'aurastatcalc4' },
  { off: 0x78, name: 'aurastatcalc5' },
  { off: 0x7c, name: 'aurastatcalc6' },
  { off: 0xa4, name: 'passivecalc1' },
  { off: 0xa8, name: 'passivecalc2' },
  { off: 0xac, name: 'passivecalc3' },
  { off: 0xb0, name: 'passivecalc4' },
  { off: 0xb4, name: 'passivecalc5' },
  { off: 0xc0, name: 'petmax' },
  { off: 0x138, name: 'calc1' },
  { off: 0x13c, name: 'calc2' },
  { off: 0x140, name: 'calc3' },
  { off: 0x144, name: 'calc4' },
  { off: 0x170, name: 'skpoints' },
  { off: 0x1a0, name: 'ToHitCalc' },
  { off: 0x1d8, name: 'DmgSymPerCalc' },
  { off: 0x210, name: 'EDmgSymPerCalc' },
  { off: 0x224, name: 'ELenSymPerCalc' },
]

export function skillCalcFieldName(off: number): string {
  return SKILL_CALC_FIELDS.find(f => f.off === off)?.name ?? `0x${off.toString(16)}`
}

/** Raw calc-column text of a skill (column names as in Skills.txt). */
export function skillCalcText(reg: D2DataRegistry, skill: SkillRecord, off: number): string {
  switch (off) {
    case 0x60: return skill.auraLenCalc
    case 0x64: return skill.auraRangeCalc
    case 0x68: return skill.auraStatCalc1
    case 0x6c: return skill.auraStatCalc2
    case 0x70: return skill.auraStatCalc3
    case 0x74: return skill.auraStatCalc4
    case 0x78: return skill.auraStatCalc5
    case 0x7c: return skill.auraStatCalc6
    case 0xa4: return skill.passiveCalc1
    case 0xa8: return skill.passiveCalc2
    case 0xac: return skill.passiveCalc3
    case 0xb0: return skill.passiveCalc4
    case 0xb4: return skill.passiveCalc5
    case 0xc0: return skill.petMax
    case 0x138: return skill.calc1
    case 0x13c: return skill.calc2
    case 0x140: return skill.calc3
    case 0x144: return skill.calc4
    case 0x170: return skillsRow(reg, skill.id)?.['skpoints'] ?? ''
    case 0x1a0: return skill.toHitCalc
    case 0x1d8: return skill.dmgSymPerCalc
    case 0x210: return skill.eDmgSymPerCalc
    case 0x224: return skill.eLenSymPerCalc
    default: return ''
  }
}

const rowCache = new WeakMap<D2DataRegistry, Map<number, Readonly<Record<string, string>>>>()
function skillsRow(reg: D2DataRegistry, id: number): Readonly<Record<string, string>> | undefined {
  let m = rowCache.get(reg)
  if (!m) {
    m = new Map()
    for (const row of reg.skillsTable.rows) {
      const n = Number(row['Id'] ?? row['ID'] ?? row['id'])
      if (Number.isInteger(n)) m.set(n, row)
    }
    rowCache.set(reg, m)
  }
  return m.get(id)
}

/** Skill ids referenced by `skill('Name'.x)` / `sklvl('Name'.x.y)` in any calc column of `skill`. */
export function referencedSkills(reg: D2DataRegistry, skill: SkillRecord): number[] {
  const ids = new Set<number>()
  for (const f of SKILL_CALC_FIELDS) {
    const t = skillCalcText(reg, skill, f.off)
    for (const m of t.matchAll(/(?:skill|sklvl)\s*\(\s*'([^']+)'/gi)) {
      const s = reg.getSkillByName(m[1] ?? '')
      if (s && s.id !== skill.id) ids.add(s.id)
    }
  }
  return [...ids].sort((a, b) => a - b)
}

/**
 * Unit environment of one oracle call: native skill hard levels on the player
 * (`pSkill+0x28`, written by the harness `SETSKILL`) and the player's accrued stats
 * (`#10973`, layer 0) as observed by the oracle.
 */
export interface SkillEnv {
  readonly hard: ReadonlyMap<number, number>
  readonly stats: ReadonlyMap<number, number>
}

function statId(reg: D2DataRegistry, nameOrId: string | number): number {
  if (typeof nameOrId === 'number') return nameOrId
  const n = Number(nameOrId)
  if (Number.isInteger(n) && nameOrId.trim() !== '') return n
  return reg.getStatByName(nameOrId)?.id ?? -1
}

export function skillCalcCtx(reg: D2DataRegistry, skill: SkillRecord, lvl: number, env: SkillEnv): CalcEvalContext {
  const hardOf = (id: number): number => env.hard.get(id) ?? 0
  return {
    registry: reg,
    activeSkill: skill,
    slvl: lvl,
    blvl: hardOf(skill.id),
    ulvl: env.stats.get(12) ?? 0,
    getBaseSkillLevel: hardOf,
    getEffectiveSkillLevel: (id: number) => Math.min(99, Math.max(0, hardOf(id))),
    getUnitStat: (s: string | number) => env.stats.get(statId(reg, s)) ?? 0,
  }
}

/** Oracle function ids of the `skills` category and their TS counterparts. */
export type SkillFn = 'skcalc' | 'skform' | 'elmin' | 'elmax' | 'elen' | 'phmin' | 'phmax' | 'tohit' | 'rawmana'

/** Lazily-built per-line state shared by every level of one golden line. */
export interface SkillLineCache {
  statList?: UnitStatList
}

export function tsSkillFn(
  reg: D2DataRegistry,
  fn: SkillFn,
  skillId: number,
  lvl: number,
  x: number,
  env: SkillEnv,
  cache: SkillLineCache = {},
): number {
  const skill = reg.getSkillById(skillId)
  if (!skill) return 0
  const ctx = skillCalcCtx(reg, skill, lvl, env)
  switch (fn) {
    case 'skcalc':
      return evaluateCalc(SKILLCALC_CODES[x] ?? '', ctx)
    case 'skform':
      return evaluateCalc(skillCalcText(reg, skill, x), ctx)
    case 'elmin':
      return evaluateCalc(x ? 'enms' : 'edns', ctx)
    case 'elmax':
      return evaluateCalc(x ? 'exms' : 'edxs', ctx)
    case 'elen':
      return evaluateCalc('edln', ctx)
    case 'tohit':
      return evaluateCalc('toht', ctx)
    case 'phmin':
      return computeRawSkillPhysDmg256_113c(skill, lvl, ctx, false)
    case 'phmax':
      return computeRawSkillPhysDmg256_113c(skill, lvl, ctx, true)
    case 'rawmana':
      return computeRawSkillMana256_113c(skill, lvl)
  }
}

/** A `UnitStatList` mirroring the oracle unit environment (player stats + native hard levels). */
export function envStatList(reg: D2DataRegistry, env: SkillEnv): UnitStatList {
  const sl = new UnitStatList(reg, undefined, { ownerType: 'player', charClass: 'bar' })
  for (const [id, v] of env.stats) sl.setBaseStat(id, v)
  sl.replaceSkillLevels(new Map(env.hard), new Map())
  return sl
}

/** `evaluateSkill113c` result fields compared against single D2Common functions (`skilleval` category). */
export type SkillEvalFn = 'eval.minElemDmg256' | 'eval.maxElemDmg256' | 'eval.toHitBonusPct' | 'eval.rawManaCost256' | 'eval.minPhysDmg' | 'eval.maxPhysDmg'

export function tsSkillEvalFn(
  reg: D2DataRegistry,
  fn: SkillEvalFn,
  skillId: number,
  lvl: number,
  env: SkillEnv,
  cache: SkillLineCache = {},
): number {
  const skill = reg.getSkillById(skillId)
  if (!skill) return 0
  cache.statList ??= envStatList(reg, env)
  const r = evaluateSkill113c({
    registry: reg,
    skill,
    slvl: lvl,
    blvl: env.hard.get(skill.id) ?? 0,
    statList: cache.statList,
    includeMissileFallback: false,
  })
  switch (fn) {
    case 'eval.minElemDmg256': return r.minElemDmg256
    case 'eval.maxElemDmg256': return r.maxElemDmg256
    case 'eval.toHitBonusPct': return r.toHitBonusPct
    case 'eval.rawManaCost256': return r.rawManaCost256 ?? 0
    // D2Common #10297 / #10567 return the flat skill damage << HitShift.
    case 'eval.minPhysDmg': return (r.minPhysDmg << skill.hitShift) | 0
    case 'eval.maxPhysDmg': return (r.maxPhysDmg << skill.hitShift) | 0
  }
}

/** Pure integer primitives. Inputs are the oracle argument order. */
export type PrimFn = 'muldiv' | 'muldiv.fog' | 'muldiv.game' | 'dimret' | 'band5'

export function tsPrimFn(fn: PrimFn, a: readonly number[]): number {
  switch (fn) {
    case 'muldiv': // oracle [edx, eax, ecx] -> D2Common 0x6FD511E0; TS mulDiv113c(eax, edx, ecx)
      return mulDiv113c(a[1] ?? 0, a[0] ?? 0, a[2] ?? 0)
    case 'muldiv.fog':
      return fogMulDiv113c(a[1] ?? 0, a[0] ?? 0, a[2] ?? 0)
    case 'muldiv.game': // D2Game 0x6FC214D0, same convention
      return mulDiv113c(a[1] ?? 0, a[0] ?? 0, a[2] ?? 0)
    case 'dimret': // oracle [lvl, a, b] -> #10115 0x6FD9DC30
      return computeDiminishingReturnsRaw(a[1] ?? 0, a[2] ?? 0, a[0] ?? 0)
    case 'band5': // oracle [lvl, l1..l5] -> 0x6FD9DDB0 (no base term)
      return compute5BandScaling(a[0] ?? 0, 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0, a[4] ?? 0, a[5] ?? 0)
  }
}

// ------------------------------------------------- stats / combat / progression
/** CharStats row order (= D2UnitStrc+0x04 class id). */
const CLASS_BY_ID = CHARACTER_CLASS_CODES

/** `ItemStatCost.txt` resist / max-resist / pierce stat per D2Game resist descriptor row (0x6FD22AB0). */
export const RESIST_ROWS: Readonly<Record<number, { channel: ResistChannel113c; res: number; max: number; pierce: number }>> = {
  0: { channel: 'phys', res: 36, max: -1, pierce: -1 },
  1: { channel: 'fire', res: 39, max: 40, pierce: 333 },
  2: { channel: 'ltng', res: 41, max: 42, pierce: 334 },
  3: { channel: 'cold', res: 43, max: 44, pierce: 335 },
  4: { channel: 'mag', res: 37, max: 38, pierce: -1 },
  8: { channel: 'pois', res: 45, max: 46, pierce: 336 },
}

/** D2Common 0x6FD823E0 rate table (0x6FDE4608): index -> stat id (base 120 for 0..3). */
export const DIMINISH_STATS: readonly number[] = [93, 99, 105, 102]

export type CombatFn =
  | 'ar' | 'def' | 'block' | 'vit.maxhp' | 'vit.maxstamina' | 'ene.maxmana'
  | 'levelup.maxhp' | 'levelup.maxmana' | 'levelup.maxstamina' | 'levelup.statpts' | 'levelup.newskills'
  | 'hit' | 'resist' | 'steal.life' | 'steal.mana' | 'diminish' | 'explvl' | 'expratio'

function vitalsDelta256(cls: number, levels: number, vit: number, ene: number, which: 'life' | 'mana' | 'stamina'): number {
  const cs = resolveCharacterClass(CLASS_BY_ID[cls] ?? 'ama')
  const base = calculateVitalsAtLevel(cs, 1)
  const now = calculateVitalsAtLevel(cs, 1 + levels, { vitality: vit, energy: ene })
  return Math.round((now[which] - base[which]) * 256)
}

/**
 * TS value for one combat/progression oracle case. Argument layouts (oracle-observed accrued values):
 * - ar [class, dex, tohit]; def [dex, armorclass, skill_armor_percent, item_armor_percent, armor_override_percent]
 * - block [class, bExpansion, dex, level, toblock]
 * - vit.* / ene.* [class, points]; levelup.* [class, levelsGained]
 * - hit [ar, def, alvl, dlvl, extraPct, itemPct, bMissile, acVsHthOrMissile]
 * - resist [row, defenderIsPlayer, res, maxStat, pierce, penalty]
 * - steal.* [phys256, lifePct, manaPct, difficulty, drain]; diminish [index, value]
 * - explvl [clvl, mlvl, exp]; expratio [exp, clvl]
 */
export function tsCombatFn(reg: D2DataRegistry, fn: CombatFn, a: readonly number[]): number {
  const n = (i: number): number => a[i] ?? 0
  switch (fn) {
    case 'ar':
      return computeRawAttackRating113c(n(0), n(1), n(2))
    case 'def':
      return computeRawDefense113c({
        dex: n(0),
        armorclass: n(1),
        skillArmorPct: n(2),
        itemArmorPct: n(3),
        overridePct: n(4),
      })
    case 'block':
      return computeRawPlayerBlockRate113c(n(0), n(1) !== 0, n(2), n(3), n(4))
    case 'vit.maxhp': return computeRawStatAllocDelta256_113c(n(0), n(1), 'life', resolveCharacterClass('bar').baseVitals.life * 256)
    case 'vit.maxstamina': return computeRawStatAllocDelta256_113c(n(0), n(1), 'stamina', resolveCharacterClass('bar').baseVitals.stamina * 256)
    case 'ene.maxmana': return computeRawStatAllocDelta256_113c(n(0), n(1), 'mana', resolveCharacterClass('bar').baseVitals.mana * 256)
    case 'levelup.maxhp': return vitalsDelta256(n(0), n(1), 0, 0, 'life')
    case 'levelup.maxmana': return vitalsDelta256(n(0), n(1), 0, 0, 'mana')
    case 'levelup.maxstamina': return vitalsDelta256(n(0), n(1), 0, 0, 'stamina')
    case 'levelup.statpts': return resolveCharacterClass(CLASS_BY_ID[n(0)] ?? 'ama').perLevel.statPoints * n(1)
    case 'levelup.newskills': return n(1)
    case 'hit':
      return computeRawToHitChance113c({
        ar: n(0),
        def: n(1),
        alvl: n(2),
        dlvl: n(3),
        extraPct: n(4),
        itemPct: n(5),
        acVs: n(7),
      })
    case 'resist': {
      const row = RESIST_ROWS[n(0)]
      if (!row) return 0
      return computeRawEffectiveResistance113c({
        resStatId: row.res,
        maxStatId: row.max,
        pierceStatId: row.pierce,
        defenderIsPlayer: n(1) !== 0,
        res: n(2),
        maxStat: n(3),
        pierce: n(4),
        penalty: n(5),
      })
    }
    case 'steal.life':
    case 'steal.mana': {
      const r = computeLifeManaSteal113c({
        phys256: n(0),
        lifeStealPct: n(1),
        manaStealPct: n(2),
        attackerIsPlayer: true,
        lifeStealDivisor: difficultyLifeStealDivisor(n(3)),
        manaStealDivisor: difficultyManaStealDivisor(n(3)),
        defenderIsMonster: true,
        defenderDrain: n(4),
      })
      return applyRawStealDelta256_113c(fn === 'steal.life' ? r.life256 : r.mana256)
    }
    case 'diminish': return computeRawDiminishingRate113c(n(1), n(0) === 4 ? 150 : 120)
    case 'explvl': return computeRawMonsterExpGrant113c(n(0), n(1), n(2))
    case 'expratio': return applyRawExpRatio113c(n(0), n(1))
  }
}

// ------------------------------------------------- damage pipeline (0x6FCFC0B0)
/** Elemental channels exercised: index -> D2DamageStrc offset + stat ids + TS elemType. */
export const DMG_CHANNELS: readonly {
  readonly off: number
  readonly elemType: string
  readonly res: number
  readonly max: number
  readonly absPct: number
  readonly absFlat: number
  readonly pierce: number
}[] = [
  { off: 0x10, elemType: 'fire', res: 39, max: 40, absPct: 142, absFlat: 143, pierce: 333 },
  { off: 0x1c, elemType: 'ltng', res: 41, max: 42, absPct: 144, absFlat: 145, pierce: 334 },
  { off: 0x24, elemType: 'cold', res: 43, max: 44, absPct: 148, absFlat: 149, pierce: 335 },
  { off: 0x20, elemType: 'mag', res: 37, max: 38, absPct: 146, absFlat: 147, pierce: -1 },
]

export type DmgFn = 'dmg.phys' | 'dmg.elem' | 'dmg.total' | 'dmg.absorb'

/**
 * TS value of one damage-pipeline case (`D2Game.dll` `0x6FCFC0B0` `SUNITDMG_CalcResistAndAbsorb`).
 * a = [defIsPlayer, difficulty, phys256, channel, elem256, rate54, dr, mdr, physRes, res, maxRes, absPct, absFlat, pierce]
 */
export function tsDmgFn(_reg: D2DataRegistry, fn: DmgFn, a: readonly number[]): number {
  const n = (i: number): number => a[i] ?? 0
  const ch = DMG_CHANNELS[n(3)] ?? DMG_CHANNELS[0]!
  const defIsPlayer = n(0) !== 0
  const out = computeRawDamagePipe113c({
    defenderIsPlayer: defIsPlayer,
    phys256: n(2),
    elem256: n(4),
    rate54: n(5),
    dr: n(6),
    mdr: n(7),
    physRes: n(8),
    elemResStatId: ch.res,
    elemMaxStatId: ch.max,
    elemPierceStatId: ch.pierce,
    res: n(9),
    maxRes: n(10),
    absPct: n(11),
    absFlat: n(12),
    pierce: n(13),
    penalty: defIsPlayer ? difficultyResistPenalty(n(1)) : 0,
  })
  switch (fn) {
    case 'dmg.phys': return out.physDamage256
    case 'dmg.elem': return out.elemDamage256
    case 'dmg.total': return out.totalDamage256
    case 'dmg.absorb': return out.absorb256
  }
}

// ------------------------------------------------- animation (D2Common #10819 / #10385)
export const PLR_MODE_CODES: readonly string[] = ['DT', 'NU', 'WL', 'RN', 'GH', 'TN', 'TW', 'A1', 'A2', 'BL', 'SC', 'TH', 'KK', 'S1', 'S2', 'S3', 'S4', 'DD', 'SQ', 'KB']
export const PLR_TOKENS: readonly string[] = ['AM', 'SO', 'NE', 'PA', 'BA', 'DZ', 'AI']
export const WCLASS_CODES: readonly string[] = ['HTH', 'BOW', '1HS', '1HT', 'STF', '2HS', '2HT', 'XBW', '1JS', '1JT', '1SS', '1ST', 'HT1', 'HT2']
/** Rate stat per tested mode (cast / gethit / block / attack / run / walk). */
export const ANIM_MODE_STAT: Readonly<Record<number, number>> = { 10: 105, 4: 99, 9: 102, 7: 93, 3: 96, 2: 96 }

export type AnimFn = 'animdata.frames' | 'animdata.speed' | 'animdata.action' | 'anim.speed' | 'anim.ticks'

/**
 * - animdata.* a = [classId, mode, wclassIdx] (only records #10385 finds)
 * - anim.speed / anim.ticks a = [mode, classId, statAcc, stat68Acc, stat67Acc, recFrames]
 *   (the player wields a Hand Axe: weapon class 1HS, WSM 0). Attack: the original rate is
 *   `stat68 + dIAS` (kb combat/d2game-tohit-defense §7); the sweep sets stat 68 = 100 + skill IAS, which is
 *   the TS `skillIas` (TS assumes the 100 base).
 */
export function tsAnimFn(fn: AnimFn, a: readonly number[]): number {
  const n = (i: number): number => a[i] ?? 0
  if (fn.startsWith('animdata.')) {
    const clip = getCharAnimClip113c(n(0), n(1), { weaponClass: (WCLASS_CODES[n(2)] ?? 'hth').toLowerCase() })
    return fn === 'animdata.frames'
      ? clip.frames
      : fn === 'animdata.speed'
        ? clip.speed
        : computeRawAnimDataActionFrame113c(clip)
  }
  const speed = computeRawPlayerAnimSpeed113c({
    mode: n(0),
    classId: n(1),
    statAcc: n(2),
    stat68Acc: n(3),
    stat67Acc: n(4),
    weaponClass: '1hs',
  })
  return fn === 'anim.speed' ? speed : computeRawOneShotTicks113c(n(5), speed)
}

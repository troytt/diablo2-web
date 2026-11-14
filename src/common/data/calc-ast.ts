/**
 * Diablo II: Lord of Destruction v1.13c `D2Common` `calc` AST & Formula Evaluator.
 *
 * Implements the complete `SKILLS_EvaluateSkillFormula` / `MISSILE_EvaluateFormula`
 * grammar across `Skills.txt`, `SkillDesc.txt`, `Missiles.txt`, `SkillCalc.txt`,
 * and `MissCalc.txt`, including all 5 1.13c table edge cases:
 *  1. Unclosed `(` at end of expression (`Fire Wall` row 51 `EDmgSymPerCalc`).
 *  2. Bare identifier `par34` (`Bone Wall` row 78 `calc2`) -> Fog `#10253` FourCC 4-byte truncation to `'par3'` (`param3 = 8`).
 *  3. Leading `*` on numeric missile function IDs (`royalstrikechainlightning` row 568).
 *  4. Two-dot `sklvl('Holy Fire'.ln56.edmn)` (`FireGolem` in `SkillDesc.txt`).
 *  5. Strictly base allocated `STAT_SKILLPTS` for `blvl` (`skill('...'.blvl)`),
 *     enforcing the 1.13c Marrowwalk / item charge synergy fix.
 */
import type { D2DataRegistry, SkillRecord, MissileRecord } from './data-registry.ts'
import { mulDiv113c } from './mul-div-113c.ts'

export interface CalcEvalContext {
  readonly registry?: D2DataRegistry | undefined
  readonly activeSkill?: SkillRecord
  readonly activeMissile?: MissileRecord
  /** Effective skill level (base + item/buff +skills). */
  readonly slvl: number
  /** Strictly base allocated skill points (`STAT_SKILLPTS`) for the active skill. */
  readonly blvl: number
  /** Character or monster unit level (`STAT_LEVEL`). Default: 80. */
  readonly ulvl?: number
  /**
   * Look up strictly base allocated `STAT_SKILLPTS` (`blvl`) for any skill ID or name.
   * Must NEVER include `+skills` or item charges (`STAT_ITEM_CHARGED_SKILL`).
   */
  readonly getBaseSkillLevel?: (skillId: number) => number
  /** Look up effective skill level (`lvl = blvl + bonusSkills`) for any skill ID. */
  readonly getEffectiveSkillLevel?: (skillId: number) => number
  /** Look up unit stat (`stat('...'.accr)` or `.base`). */
  readonly getUnitStat?: (statNameOrId: string | number, baseOnly?: boolean) => number
  /** Optional deterministic RNG for `rand(a, b)`. Defaults to midpoint or seeded LCG. */
  readonly randFn?: (min: number, max: number) => number
  /** Recursion depth guard for self-referential `clc1..4`. */
  readonly depth?: number
}

/**
 * Compute 5-band level scaling used by `D2Common` (`SKILLS_GetElementalMinDamage`,
 * `SKILLS_GetElementalMaxDamage`, `SKILLS_GetMinPhysDamage`, `SKILLS_GetMaxPhysDamage`).
 *
 * Brackets in Diablo II:
 * - Level 1: `base`
 * - Levels 2..8 (7 levels): `+ lev1` per level
 * - Levels 9..16 (8 levels): `+ lev2` per level
 * - Levels 17..22 (6 levels): `+ lev3` per level
 * - Levels 23..28 (6 levels): `+ lev4` per level
 * - Levels 29+ (`slvl - 28` levels): `+ lev5` per level
 */
export function compute5BandScaling(
  slvl: number,
  base: number,
  lev1: number,
  lev2: number,
  lev3: number,
  lev4: number,
  lev5: number,
): number {
  const c = slvl | 0
  if (c <= 0) return 0
  let total = base | 0
  if (c > 1) {
    const b1 = Math.min(c, 8) - 1
    total = (total + Math.imul(b1, lev1 | 0)) | 0
  }
  if (c > 8) {
    const b2 = Math.min(c, 16) - 8
    total = (total + Math.imul(b2, lev2 | 0)) | 0
  }
  if (c > 16) {
    const b3 = Math.min(c, 22) - 16
    total = (total + Math.imul(b3, lev3 | 0)) | 0
  }
  if (c > 22) {
    const b4 = Math.min(c, 28) - 22
    total = (total + Math.imul(b4, lev4 | 0)) | 0
  }
  if (c > 28) {
    const b5 = (c - 28) | 0
    total = (total + Math.imul(b5, lev5 | 0)) | 0
  }
  return total
}

/**
 * Compute 3-band elemental duration scaling (`ELen`, `ELevLen1..3`) in frames (25fps).
 * - Level 1: `eLen`
 * - Levels 2..8: `+ eLevLen1` per level
 * - Levels 9..16: `+ eLevLen2` per level
 * - Levels 17+: `+ eLevLen3` per level
 */
export function compute3BandDuration(
  slvl: number,
  eLen: number,
  eLevLen1: number,
  eLevLen2: number,
  eLevLen3: number,
): number {
  const c = slvl | 0
  if (c <= 0) return 0
  let total = eLen | 0
  if (c > 1) {
    const b1 = Math.min(c, 8) - 1
    total = (total + Math.imul(b1, eLevLen1 | 0)) | 0
  }
  if (c > 8) {
    const b2 = Math.min(c, 16) - 8
    total = (total + Math.imul(b2, eLevLen2 | 0)) | 0
  }
  if (c > 16) {
    const b3 = (c - 16) | 0
    total = (total + Math.imul(b3, eLevLen3 | 0)) | 0
  }
  return total
}

/**
 * D2Common #10121 skill elemental min damage (`0x6FDA0460`): `EDmgSymPerCalc` is applied to the min value only
 * when `min256 > 256 || EMinLev1 != 0` (`0x6FDA04C7..0x6FDA04D3`), so a flat 1-point minimum (EMin=1, HitShift=8,
 * no per-level growth — Lightning, Chain Lightning, Charged Strike, ...) is never synergised (issue #1681).
 * The max side (#11091 `0x6FDA0360`) and the missile path (`0x6FDBB3F4`) have no such gate.
 */
export function skillMinSynergyApplies113c(min256: number, eMinLev1: number): boolean {
  return min256 > 256 || eMinLev1 !== 0
}

/**
 * Fog `#10253` calc op 19 `/` (`0x6FF6A177`): 32-bit `idiv`; a zero divisor pushes 0 for that
 * sub-expression only (`0x6FF6A19F -> 0x6FF6A008`), the rest of the formula keeps evaluating (issue #1690).
 */
export function calcDiv(num: number, den: number): number {
  if (den === 0) return 0
  return Math.trunc(num / den)
}

/**
 * Fog `#10253` calc op 20 `^` (`0x6FF6A234`): exponent `<= 0` -> 1 (`0x6FF6A25C..0x6FF6A270`), otherwise
 * `base` multiplied `exp - 1` times with 32-bit `imul` (wraps like the binary; issue #1690).
 */
export function calcPow(base: number, exp: number): number {
  if (exp <= 0) return 1
  let result = 1
  let b = base | 0
  let e = Math.trunc(exp)
  // Square-and-multiply with 32-bit wrap == the binary's repeated imul (mod 2^32).
  while (e > 0) {
    if (e & 1) result = Math.imul(result, b)
    b = Math.imul(b, b)
    e = Math.floor(e / 2)
  }
  return result
}

/**
 * Raw 1.13c `D2Common` diminishing-returns helper `0x6FD9DC30(lvl, a, b)` (issue #1678):
 * ```
 * x = (lvl * 110) / (lvl + 6)      // idiv, truncated FIRST
 * r = (x * (b - a)) / 100 + a       // idiv (magic 0x51EB851F, sar 5)
 * if (r > b) r = b                  // cap at b
 * ```
 * Called without a level guard by SkillCalc `dm78` (`0x6FDA1148`) and MissCalc
 * `sd12/sd34/cd12/cd34/shd1/chd1/dd12` (`0x6FDBA964..0x6FDBAA54`).
 */
export function computeDiminishingReturnsRaw(a: number, b: number, lvl: number): number {
  const c = lvl | 0
  const lo = a | 0
  const hi = b | 0
  const den = (c + 6) | 0
  if (den === 0) return 0
  const x = Math.trunc(Math.imul(c, 110) / den) | 0
  const diff = (hi - lo) | 0
  const prod = Math.imul(x, diff)
  const r = (Math.trunc(prod / 100) + lo) | 0
  return r > hi ? hi : r
}

/**
 * 1.13c `D2Common` diminishing-returns formula `dmXY` (issue #1678). SkillCalc `dm12/dm34/dm56`
 * (`0x6FD9E680/0x6FD9E630/0x6FD9E5E0`) return 0 for `lvl <= 0`, otherwise call `0x6FD9DC30`
 * ({@link computeDiminishingReturnsRaw}): `min(b, trunc(trunc(110 * lvl / (lvl + 6)) * (b - a) / 100) + a)`.
 */
export function computeDiminishingReturns(a: number, b: number, lvl: number): number {
  if ((lvl | 0) <= 0) return 0
  return computeDiminishingReturnsRaw(a, b, lvl)
}

/**
 * Compute `D2Common` linear scaling `ln(a, b, lvl)` (`0x6FD51670..0x6FD51730`):
 * Returns `0` when `lvl <= 0`, otherwise `a + (lvl - 1) * b` (32-bit signed).
 */
export function computeLinearScaling(a: number, b: number, lvl: number): number {
  const c = lvl | 0
  if (c <= 0) return 0
  return ((a | 0) + Math.imul((c - 1) | 0, b | 0)) | 0
}

/**
 * SkillCalc `mps` (`0x6FDA1298`):
 * `lvl <= 0 ? 0 : ((((lvl - 1) * lvlmana + mana) * 25) / 2 << manashift) >> 8` (32-bit signed integer division).
 */
export function computeSkillMps113c(mana: number, lvlMana: number, manaShift: number, lvl: number): number {
  const c = lvl | 0
  if (c <= 0) return 0
  const term = (Math.imul((c - 1) | 0, lvlMana | 0) + (mana | 0)) | 0
  const halfPerSec = Math.trunc(Math.imul(term, 25) / 2) | 0
  const shifted = (halfPerSec << (manaShift & 31)) | 0
  return shifted >> 8
}

/**
 * Raw `D2Common #10090` (`0x6FD9EA00`) skill mana in 256ths:
 * `(((lvl - 1) * lvlmana + mana) << manashift)` with NO `lvl <= 0` guard and NO `minmana` floor.
 */
export function computeRawSkillMana256_113c(skill: SkillRecord, lvl: number): number {
  const c = lvl | 0
  const term = (Math.imul((c - 1) | 0, skill.lvlMana | 0) + (skill.mana | 0)) | 0
  return (term << (skill.manaShift & 31)) | 0
}

/**
 * Raw `D2Common #10297` (`0x6FDA1FF0`, `isMax = true`) / `#10567` (`0x6FDA2100`, `isMax = false`)
 * skill physical damage in 256ths (`bAddWeaponStatBonus = 0`):
 * - Kick skills (`skill.kick`, `0x6FD9F930`): `(trunc(max(1, str + dex - 20) / (isMax ? 3 : 4)) << 8) | 0`.
 * - Other skills: `((band5(lvl, LevDam1..5) + Min/MaxDam) * (100 + DmgSymPerCalc) / 100) << HitShift`
 *   with NO `lvl <= 0` guard (`band5` returns `0` for `lvl <= 0`, leaving `MinDam`/`MaxDam`).
 */
export function computeRawSkillPhysDmg256_113c(
  skill: SkillRecord,
  lvl: number,
  ctx: CalcEvalContext,
  isMax: boolean,
): number {
  if (skill.kick) {
    const str = ctx.getUnitStat ? (ctx.getUnitStat(0) | 0) : 0
    const dex = ctx.getUnitStat ? (ctx.getUnitStat(2) | 0) : 0
    let sum = (((str + dex) | 0) - 20) | 0
    if (sum < 1) sum = 1
    const div = isMax ? 3 : 4
    return (Math.trunc(sum / div) << 8) | 0
  }
  const c = lvl | 0
  const band = isMax
    ? compute5BandScaling(c, 0, skill.maxLevDam1, skill.maxLevDam2, skill.maxLevDam3, skill.maxLevDam4, skill.maxLevDam5)
    : compute5BandScaling(c, 0, skill.minLevDam1, skill.minLevDam2, skill.minLevDam3, skill.minLevDam4, skill.minLevDam5)
  let edi = (band + ((isMax ? skill.maxDam : skill.minDam) | 0)) | 0
  if (skill.dmgSymPerCalc && (ctx.depth ?? 0) < 8) {
    const syn = evaluateCalc(skill.dmgSymPerCalc, { ...ctx, slvl: c, depth: (ctx.depth ?? 0) + 1 })
    if (syn !== 0) {
      edi = (edi + mulDiv113c(syn, edi, 100)) | 0
    }
  }
  return (edi << (skill.hitShift & 31)) | 0
}

/**
 * Compute mana cost in 256-fixed-point (`usmc`), raw unclamped mana cost (`SKILLS_CheckSkillMana`
 * `0x6FDA0AF0`), and integer mana (`manaCost`) for a skill at `slvl`.
 *
 * Ground truth:
 * - `D2Game.dll` `SKILLS_ConsumeMana` (`0x6FCBF850`): if `mana == 0 && lvlmana == 0`, returns 0
 *   (`0x6FCBF8D7..0x6FCBF8F2`); otherwise `max(minmana << 8, (mana + lvlmana * max(lvl - 1, 0)) << manashift)`.
 * - `D2Common.dll` `SKILLS_CheckSkillMana` (`0x6FDA0AF0`): checks against raw cost
 *   `((mana + lvlmana * (clamp(lvl, 0, 99) - 1)) << manashift)` without `minmana`.
 */
export function computeSkillManaCost256(
  skill: SkillRecord,
  slvl: number,
): { manaCost256: number; manaCost: number; rawManaCost256: number } {
  if (skill.mana === 0 && skill.lvlMana === 0) {
    return { manaCost256: 0, manaCost: 0, rawManaCost256: 0 }
  }
  const effLvl = Math.min(99, Math.max(1, slvl))
  const raw = (skill.mana + skill.lvlMana * (effLvl - 1)) << skill.manaShift
  const min256 = skill.minMana << 8
  const manaCost256 = Math.max(min256, raw)
  return {
    manaCost256,
    manaCost: manaCost256 >> 8,
    rawManaCost256: Math.max(0, raw),
  }
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; name: string }
  | { kind: 'str'; value: string }
  | { kind: 'op'; op: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' }
  | { kind: 'dot' }
  | { kind: 'question' }
  | { kind: 'colon' }

function tokenizeCalc(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = expr.length

  while (i < n) {
    const ch = expr[i]!
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i += 1
      continue
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' })
      i += 1
      continue
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' })
      i += 1
      continue
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma' })
      i += 1
      continue
    }
    if (ch === '.') {
      tokens.push({ kind: 'dot' })
      i += 1
      continue
    }
    if (ch === '?') {
      tokens.push({ kind: 'question' })
      i += 1
      continue
    }
    if (ch === ':') {
      tokens.push({ kind: 'colon' })
      i += 1
      continue
    }
    if (ch === "'" || ch === '"') {
      const quote = ch
      i += 1
      let str = ''
      while (i < n && expr[i] !== quote) {
        str += expr[i]!
        i += 1
      }
      if (i < n && expr[i] === quote) i += 1
      tokens.push({ kind: 'str', value: str })
      continue
    }
    if (ch >= '0' && ch <= '9') {
      let numStr = ''
      while (i < n && expr[i]! >= '0' && expr[i]! <= '9') {
        numStr += expr[i]!
        i += 1
      }
      tokens.push({ kind: 'num', value: Number(numStr) })
      continue
    }
    if (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      ch === '_'
    ) {
      let ident = ''
      while (
        i < n &&
        ((expr[i]! >= 'a' && expr[i]! <= 'z') ||
          (expr[i]! >= 'A' && expr[i]! <= 'Z') ||
          (expr[i]! >= '0' && expr[i]! <= '9') ||
          expr[i]! === '_')
      ) {
        ident += expr[i]!
        i += 1
      }
      tokens.push({ kind: 'ident', name: ident })
      continue
    }
    const twoChar = expr.slice(i, i + 2)
    if (twoChar === '<=' || twoChar === '>=' || twoChar === '==' || twoChar === '!=') {
      tokens.push({ kind: 'op', op: twoChar })
      i += 2
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '<' || ch === '>' || ch === '=') {
      tokens.push({ kind: 'op', op: ch })
      i += 1
      continue
    }
    // Skip any unexpected formatting character gracefully
    i += 1
  }

  return tokens
}

/**
 * Resolve a property (`.blvl`, `.lvl`, `.par1..8`, `.ln12`, `.ln34`, `.ln56`, `.dm12`, `.dm34`,
 * `.edmn`, `.edmx`, `.edns`, `.edxs`, `.enma`, `.exma`, `.clc1..4`) on a target `SkillRecord`.
 */
function resolveSkillProperty(
  skill: SkillRecord,
  prop: string,
  ctx: CalcEvalContext,
  overrideLvl?: number,
): number {
  const p = prop.trim().toLowerCase()
  const basePoints = ctx.getBaseSkillLevel
    ? ctx.getBaseSkillLevel(skill.id)
    : skill.id === ctx.activeSkill?.id
      ? ctx.blvl
      : 0

  // CRITICAL 1.13c RULE: `.blvl` strictly returns base allocated STAT_SKILLPTS only!
  // Item `+skills` and `STAT_ITEM_CHARGED_SKILL` charges NEVER increase `.blvl`.
  if (p === 'blvl') {
    return Math.max(0, basePoints)
  }

  const effLvl =
    overrideLvl !== undefined
      ? overrideLvl
      : ctx.getEffectiveSkillLevel
        ? ctx.getEffectiveSkillLevel(skill.id)
        : skill.id === ctx.activeSkill?.id
          ? ctx.slvl
          : basePoints

  if (p === 'lvl') return Math.max(0, effLvl)

  const subCtx: CalcEvalContext = {
    ...ctx,
    activeSkill: skill,
    slvl: effLvl,
    blvl: basePoints,
    depth: (ctx.depth ?? 0) + 1,
  }
  return resolveBuiltInIdentifier(p, subCtx)
}

/**
 * Resolve a property on a `MissileRecord` (`miss('<MissileName>'.<prop>)`).
 */
function resolveMissileProperty(
  missile: MissileRecord,
  prop: string,
  ctx: CalcEvalContext,
): number {
  const p = prop.trim().toLowerCase()
  const lvl = Math.max(1, ctx.slvl)
  switch (p) {
    case 'range':
    case 'rng':
      return missile.range + lvl * missile.levRange
    case 'vel':
      return missile.vel + Math.trunc((lvl * missile.velLev) / 8)
    case 'par1':
      return missile.param1
    case 'par2':
      return missile.param2
    case 'par3':
      return missile.param3
    case 'par4':
      return missile.param4
    case 'par5':
      return missile.param5
    case 'edmn':
    case 'edns':
    case 'edmx':
    case 'edxs': {
      const baseMin = compute5BandScaling(
        lvl,
        missile.eMin,
        missile.eMinLev1,
        missile.eMinLev2,
        missile.eMinLev3,
        missile.eMinLev4,
        missile.eMinLev5,
      )
      const baseMax = compute5BandScaling(
        lvl,
        missile.eMax,
        missile.eMaxLev1,
        missile.eMaxLev2,
        missile.eMaxLev3,
        missile.eMaxLev4,
        missile.eMaxLev5,
      )
      const min256 = baseMin << missile.hitShift
      const max256 = baseMax << missile.hitShift
      if (p === 'edns') return min256
      if (p === 'edxs') return max256
      if (p === 'edmn') return min256 >> 8
      return max256 >> 8
    }
    default:
      return 0
  }
}

/**
 * D2Common `0x6FD9F870` (unit, EType): elemental mastery stat used by the bMastery=1 SkillCalc codes — fire -> 329
 * `passive_fire_mastery`, ltng -> 330 `passive_ltng_mastery`, cold -> 331 `passive_cold_mastery`, pois -> 332
 * `passive_pois_mastery`; other ETypes -> 0. Without a caster unit (`getUnitStat`) the binary adds nothing.
 */
function resolveCasterElementalMasteryPct113c(eType: string, ctx: CalcEvalContext): number {
  if (!ctx.getUnitStat) return 0
  const statId = eType === 'fire' ? 329 : eType === 'ltng' ? 330 : eType === 'cold' ? 331 : eType === 'pois' ? 332 : 0
  return statId === 0 ? 0 : ctx.getUnitStat(statId)
}

function resolveDescMissile113c(
  skill: SkillRecord,
  ctx: CalcEvalContext,
  slotIdx: 0 | 1 | 2,
): MissileRecord | undefined {
  if (!skill.skillDesc || !ctx.registry) return undefined
  const desc = ctx.registry.getSkillDesc(skill.skillDesc)
  if (!desc) return undefined
  const col = slotIdx === 0 ? 'descmissile1' : slotIdx === 1 ? 'descmissile2' : 'descmissile3'
  const mName = (desc[col] ?? '').trim()
  if (!mName) return undefined
  return ctx.registry.getMissileByName(mName)
}

function evalDescMissileElemDmg113c(
  m: MissileRecord,
  lvl: number,
  skill: SkillRecord,
  ctx: CalcEvalContext,
  isMax: boolean,
  shiftRight8: boolean,
): number {
  const band = isMax
    ? compute5BandScaling(lvl, 0, m.eMaxLev1, m.eMaxLev2, m.eMaxLev3, m.eMaxLev4, m.eMaxLev5)
    : compute5BandScaling(lvl, 0, m.eMinLev1, m.eMinLev2, m.eMinLev3, m.eMinLev4, m.eMinLev5)
  let edi = (band + ((isMax ? m.eMax : m.eMin) | 0)) | 0
  if (m.eDmgSymPerCalc && (ctx.depth ?? 0) < 8) {
    const mCtx: CalcEvalContext = {
      registry: ctx.registry,
      activeMissile: m,
      slvl: lvl,
      blvl: ctx.blvl,
      ...(ctx.ulvl !== undefined ? { ulvl: ctx.ulvl } : {}),
      getBaseSkillLevel: ctx.getBaseSkillLevel ?? ((id: number) => (id === skill.id ? ctx.blvl : 0)),
      getEffectiveSkillLevel: ctx.getEffectiveSkillLevel ?? ((id: number) => (id === skill.id ? ctx.slvl : 0)),
      ...(ctx.getUnitStat !== undefined ? { getUnitStat: ctx.getUnitStat } : {}),
      ...(ctx.randFn !== undefined ? { randFn: ctx.randFn } : {}),
      depth: (ctx.depth ?? 0) + 1,
    }
    const syn = evaluateCalc(m.eDmgSymPerCalc, mCtx)
    if (syn !== 0) {
      edi = (edi + mulDiv113c(syn, edi, 100)) | 0
    }
  }
  const v256 = (edi << (m.hitShift & 31)) | 0
  return shiftRight8 ? v256 >> 8 : v256
}

/**
 * Resolve any built-in variable or macro on the current `CalcEvalContext`.
 * Fog `#10253` tokenizes bare symbols as 4-byte FourCC codes (`ident.slice(0, 4)`).
 */
function resolveBuiltInIdentifier(ident: string, ctx: CalcEvalContext): number {
  const key = ident.slice(0, 4).toLowerCase()
  const skill = ctx.activeSkill
  const missile = ctx.activeMissile
  const lvl = ctx.slvl | 0
  const blvl = Math.max(0, ctx.blvl) | 0
  const ulvl = (ctx.ulvl ?? 80) | 0

  if (key === 'lvl') return lvl
  if (key === 'blvl') return blvl
  if (key === 'ulvl') return ulvl

  const par1 = skill?.param1 ?? missile?.param1 ?? 0
  const par2 = skill?.param2 ?? missile?.param2 ?? 0
  const par3 = skill?.param3 ?? missile?.param3 ?? 0
  const par4 = skill?.param4 ?? missile?.param4 ?? 0
  const par5 = skill?.param5 ?? missile?.param5 ?? 0
  const par6 = skill?.param6 ?? 0
  const par7 = skill?.param7 ?? 0
  const par8 = skill?.param8 ?? 0

  switch (key) {
    case 'par1':
      return par1
    case 'par2':
      return par2
    case 'par3':
      return par3
    case 'par4':
      return par4
    case 'par5':
      return par5
    case 'par6':
      return par6
    case 'par7':
      return par7
    case 'par8':
      return par8
    case 'cpa1':
      return missile?.cParam1 ?? par1
    case 'cpa2':
      return missile?.cParam2 ?? par2
    case 'cpa3':
      return missile?.cParam3 ?? par3
    case 'cpa4':
      return missile?.cParam4 ?? par4
    case 'cpa5':
      return missile?.cParam5 ?? par5
    case 'hpa1':
      return missile?.sHitPar1 ?? 0
    case 'hpa2':
      return missile?.sHitPar2 ?? 0
    case 'hpa3':
      return missile?.sHitPar3 ?? 0
    case 'chp1':
      return missile?.cHitPar1 ?? 0
    case 'chp2':
      return missile?.cHitPar2 ?? 0
    case 'chp3':
      return missile?.cHitPar3 ?? 0
    case 'dpa1':
      return missile?.dParam1 ?? 0
    case 'dpa2':
      return missile?.dParam2 ?? 0

    case 'ln12':
    case 'sl12':
      return computeLinearScaling(par1, par2, lvl)
    case 'ln34':
    case 'sl34':
      return computeLinearScaling(par3, par4, lvl)
    case 'ln56':
      return computeLinearScaling(par5, par6, lvl)
    case 'ln78':
      return computeLinearScaling(par7, par8, lvl)
    case 'dl12':
      return computeLinearScaling(missile?.dParam1 ?? 0, missile?.dParam2 ?? 0, lvl)

    case 'dm12':
      return computeDiminishingReturns(par1, par2, lvl)
    case 'sd12':
      return computeDiminishingReturnsRaw(par1, par2, lvl)
    case 'dm34':
      return computeDiminishingReturns(par3, par4, lvl)
    case 'sd34':
      return computeDiminishingReturnsRaw(par3, par4, lvl)
    case 'dm56':
      return computeDiminishingReturns(par5, par6, lvl)
    case 'dm78':
      return computeDiminishingReturnsRaw(par7, par8, lvl)
    case 'dd12':
      return computeDiminishingReturnsRaw(missile?.dParam1 ?? 0, missile?.dParam2 ?? 0, lvl)
  }

  if (!skill) return 0

  if (key === 'mps') {
    return computeSkillMps113c(skill.mana, skill.lvlMana, skill.manaShift, lvl)
  }
  if (key === 'usmc' || key === 'mana') {
    // SkillCalc `usmc` (0x6FDA1507) / `mana` (0x6FDA1264): `lvl <= 0 ? 0 : ((lvl-1)*lvlmana + mana) << manashift`
    // (`mana` additionally `>> 8`), signed, no `minmana` floor and no level clamp. The cost actually paid
    // (`SKILLS_ConsumeMana` 0x6FCBF850, with minmana) is `computeSkillManaCost256`.
    if (lvl <= 0) return 0
    const raw256 = (((Math.imul((lvl - 1) | 0, skill.lvlMana | 0) + (skill.mana | 0)) | 0) << (skill.manaShift & 31)) | 0
    return key === 'usmc' ? raw256 : raw256 >> 8
  }

  if (key === 'toht') {
    // D2Common #10653 (0x6FD9EA50): returns 0 when `lvl <= 0` BEFORE checking `ToHitCalc`.
    if (lvl <= 0) return 0
    if (skill.toHitCalc && (ctx.depth ?? 0) < 8) {
      return evaluateCalc(skill.toHitCalc, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
    }
    return (Math.imul((lvl - 1) | 0, skill.toHitLev | 0) + (skill.toHit | 0)) | 0
  }

  if ((ctx.depth ?? 0) < 8) {
    const nextCtx = { ...ctx, depth: (ctx.depth ?? 0) + 1 }
    switch (key) {
      case 'clc1': return evaluateCalc(skill.calc1, nextCtx)
      case 'clc2': return evaluateCalc(skill.calc2, nextCtx)
      case 'clc3': return evaluateCalc(skill.calc3, nextCtx)
      case 'clc4': return evaluateCalc(skill.calc4, nextCtx)
      case 'len': return evaluateCalc(skill.auraLenCalc, nextCtx)
      case 'rng': return evaluateCalc(skill.auraRangeCalc, nextCtx)
      case 'ast1': return evaluateCalc(skill.auraStatCalc1, nextCtx)
      case 'ast2': return evaluateCalc(skill.auraStatCalc2, nextCtx)
      case 'ast3': return evaluateCalc(skill.auraStatCalc3, nextCtx)
      case 'ast4': return evaluateCalc(skill.auraStatCalc4, nextCtx)
      case 'ast5': return evaluateCalc(skill.auraStatCalc5, nextCtx)
      case 'ast6': return evaluateCalc(skill.auraStatCalc6, nextCtx)
      case 'pst1': return evaluateCalc(skill.passiveCalc1, nextCtx)
      case 'pst2': return evaluateCalc(skill.passiveCalc2, nextCtx)
      case 'pst3': return evaluateCalc(skill.passiveCalc3, nextCtx)
      case 'pst4': return evaluateCalc(skill.passiveCalc4, nextCtx)
      case 'pst5': return evaluateCalc(skill.passiveCalc5, nextCtx)
      case 'pets': return evaluateCalc(skill.petMax, nextCtx)
      case 'skpt': return evaluateCalc(skill.raw['skpoints'] ?? '', nextCtx)
    }
  }

  // SkillCalc SkillDesc missile callbacks (`0x6FDA1325..0x6FDA15E5`):
  // - `m1rn..m3rn` (`0x6FDA1430`): NO `lvl <= 0` guard, `levRange * lvl + range`.
  // - `m1el..m3el` (`0x6FDA13D9`): `lvl <= 0 -> 0`, 3-band missile `ELen`.
  // - `m1en..m3en` / `m1ex..m3ex` (`0x6FDA1325` / `0x6FDA137F`): `lvl <= 0 -> 0`, 5-band + `EDmgSymPerCalc` `>> 8`.
  // - `m1eo/m2eo/me3o` (`0x6FDA1544`) & `m1ey/m2ey/me3y` (`0x6FDA159B`): 1.13c divides `(code - base)` by 3
  //   even though stride is 2, mapping `m1eo/m1ey -> descmissile1 (0)`, `m2eo/m2ey -> descmissile1 (0)`,
  //   and `me3o/me3y -> descmissile2 (1)`.
  if (key === 'm1rn' || key === 'm2rn' || key === 'm3rn') {
    const slot: 0 | 1 | 2 = key === 'm1rn' ? 0 : key === 'm2rn' ? 1 : 2
    const m = resolveDescMissile113c(skill, ctx, slot)
    if (!m) return 0
    return (Math.imul(m.levRange | 0, lvl) + (m.range | 0)) | 0
  }
  if (key === 'm1el' || key === 'm2el' || key === 'm3el') {
    if (lvl <= 0) return 0
    const slot: 0 | 1 | 2 = key === 'm1el' ? 0 : key === 'm2el' ? 1 : 2
    const m = resolveDescMissile113c(skill, ctx, slot)
    if (!m) return 0
    return compute3BandDuration(lvl, m.eLen, m.eLevLen1, m.eLevLen2, m.eLevLen3)
  }
  if (key === 'm1en' || key === 'm2en' || key === 'm3en' || key === 'm1ex' || key === 'm2ex' || key === 'm3ex') {
    if (lvl <= 0) return 0
    const slot: 0 | 1 | 2 = key[1] === '1' ? 0 : key[1] === '2' ? 1 : 2
    const m = resolveDescMissile113c(skill, ctx, slot)
    if (!m) return 0
    return evalDescMissileElemDmg113c(m, lvl, skill, ctx, key[3] === 'x', true)
  }
  if (key === 'm1eo' || key === 'm2eo' || key === 'me3o' || key === 'm1ey' || key === 'm2ey' || key === 'me3y') {
    if (lvl <= 0) return 0
    const slot: 0 | 1 = key === 'me3o' || key === 'me3y' ? 1 : 0
    const m = resolveDescMissile113c(skill, ctx, slot)
    if (!m) return 0
    return evalDescMissileElemDmg113c(m, lvl, skill, ctx, key[3] === 'y', false)
  }

  // SkillCalc math / madm / macr -> D2Common 0x6FD9E7A0(unit, skill, lvl, mode 0/1/2): scan passivestat1..5 for
  // the first entry equal to stat 342/345 (th), 343/346 (dmg) or 344/347 (crit) and evaluate the paired
  // passivecalcN; 0 when none matches (#1683).
  if ((key === 'math' || key === 'madm' || key === 'macr') && (ctx.depth ?? 0) < 8) {
    if (lvl <= 0) return 0
    const suffix = key === 'math' ? 'th' : key === 'madm' ? 'dmg' : 'crit'
    const wanted = [`passive_mastery_melee_${suffix}`, `passive_mastery_throw_${suffix}`]
    const pairs: readonly (readonly [string, string])[] = [
      [skill.passiveStat1, skill.passiveCalc1],
      [skill.passiveStat2, skill.passiveCalc2],
      [skill.passiveStat3, skill.passiveCalc3],
      [skill.passiveStat4, skill.passiveCalc4],
      [skill.passiveStat5, skill.passiveCalc5],
    ]
    for (const [stat, calc] of pairs) {
      if (wanted.includes(stat.trim().toLowerCase())) {
        return evaluateCalc(calc, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
      }
    }
    return 0
  }

  if (
    key === 'edmn' ||
    key === 'edmx' ||
    key === 'edln' ||
    key === 'edns' ||
    key === 'edxs' ||
    key === 'enma' ||
    key === 'exma' ||
    key === 'edma' ||
    key === 'enms' ||
    key === 'exms'
  ) {
    if (lvl <= 0) return 0
    const baseMin = compute5BandScaling(
      lvl,
      skill.eMin,
      skill.eMinLev1,
      skill.eMinLev2,
      skill.eMinLev3,
      skill.eMinLev4,
      skill.eMinLev5,
    )
    const baseMax = compute5BandScaling(
      lvl,
      skill.eMax,
      skill.eMaxLev1,
      skill.eMaxLev2,
      skill.eMaxLev3,
      skill.eMaxLev4,
      skill.eMaxLev5,
    )
    const baseLen = compute3BandDuration(lvl, skill.eLen, skill.eLevLen1, skill.eLevLen2, skill.eLevLen3)
    const min256 = (baseMin << (skill.hitShift & 31)) | 0
    const max256 = (baseMax << (skill.hitShift & 31)) | 0
    const eSynPct =
      skill.eDmgSymPerCalc && (ctx.depth ?? 0) < 8
        ? evaluateCalc(skill.eDmgSymPerCalc, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
        : 0
    const lenSynPct =
      skill.eLenSymPerCalc && (ctx.depth ?? 0) < 8
        ? evaluateCalc(skill.eLenSymPerCalc, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
        : 0

    // #10121 0x6FDA0524 / #11091 0x6FDA041D: v += mulDiv(eax = syn, edx = v, 100) (0x6FD511E0, divide-first
    // shortcut for v > 0x100000).
    const synMin256 = skillMinSynergyApplies113c(min256, skill.eMinLev1)
      ? (min256 + mulDiv113c(eSynPct, min256, 100)) | 0
      : min256
    const synMax256 = (max256 + mulDiv113c(eSynPct, max256, 100)) | 0
    // #10510 (0x6FD9E9E5..0x6FD9E9F1): v += mulDiv(eax = ELenSymPerCalc, edx = v, 100), no mastery flag.
    const synLen = (baseLen + mulDiv113c(lenSynPct, baseLen, 100)) | 0
    // bMastery=1 codes add the caster's elemental mastery: v += mulDiv(eax = stat, edx = v, 100)
    // (0x6FD9F870 tail-calls 0x6FD511E0 at 0x6FD9F8DA..0x6FD9F8E1).
    const masteryPct = resolveCasterElementalMasteryPct113c(skill.eType, ctx)
    const mastered = (v: number): number => (v + mulDiv113c(masteryPct, v, 100)) | 0

    // Issue #1682: edmn/edmx/edns/edxs (0x6FDA11F4/0x6FDA1212/0x6FDA1471/0x6FDA148C, bMastery=0) are the
    // synergised #10121/#11091 values; enma/exma/enms/exms (0x6FDA15E6..0x6FDA1658, bMastery=1) also add the
    // caster mastery; edln/edma (0x6FDA1230/0x6FDA1622) both return the synergised length.
    switch (key) {
      case 'edns':
        return synMin256
      case 'edxs':
        return synMax256
      case 'edmn':
        return synMin256 >> 8
      case 'edmx':
        return synMax256 >> 8
      case 'edln':
      case 'edma':
        return synLen
      case 'enms':
        return mastered(synMin256)
      case 'exms':
        return mastered(synMax256)
      case 'enma':
        return mastered(synMin256) >> 8
      case 'exma':
        return mastered(synMax256) >> 8
    }
  }

  // Edge Case #2 (`Bone Wall` row 78 `calc2 = "par34"` and any other unknown bare identifier):
  // `D2Common` resolves unknown symbols to 0.
  return 0
}

/**
 * Evaluate any `D2Common` formula expression (`Skills.txt`, `SkillDesc.txt`, `Missiles.txt`).
 */
export function evaluateCalc(expr: string | undefined | null, ctx: CalcEvalContext): number {
  if (!expr) return 0
  let trimmed = expr.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    trimmed = trimmed.slice(1, -1).replace(/""/g, '"').trim()
  }
  if (trimmed === '' || trimmed === '0') return 0
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed) | 0

  const tokens = tokenizeCalc(trimmed)
  if (tokens.length === 0) return 0

  let pos = 0
  const peek = (): Token | undefined => tokens[pos]
  const consume = (): Token | undefined => tokens[pos++]

  function parseExpression(): number {
    const cond = parseComparison()
    if (peek()?.kind === 'question') {
      consume() // '?'
      const trueVal = parseExpression()
      if (peek()?.kind === 'colon') {
        consume() // ':'
      }
      const falseVal = parseExpression()
      return cond !== 0 ? trueVal : falseVal
    }
    return cond
  }

  function parseComparison(): number {
    let left = parseAdditive()
    while (peek()?.kind === 'op') {
      const op = (peek() as { kind: 'op'; op: string }).op
      if (op === '<' || op === '>' || op === '<=' || op === '>=' || op === '==' || op === '=' || op === '!=') {
        consume()
        const right = parseAdditive()
        if (op === '<') left = left < right ? 1 : 0
        else if (op === '>') left = left > right ? 1 : 0
        else if (op === '<=') left = left <= right ? 1 : 0
        else if (op === '>=') left = left >= right ? 1 : 0
        else if (op === '==' || op === '=') left = left === right ? 1 : 0
        else if (op === '!=') left = left !== right ? 1 : 0
      } else {
        break
      }
    }
    return left
  }

  function parseAdditive(): number {
    let left = parseMultiplicative()
    while (peek()?.kind === 'op') {
      const op = (peek() as { kind: 'op'; op: string }).op
      if (op === '+' || op === '-') {
        consume()
        const right = parseMultiplicative()
        left = op === '+' ? (left + right) | 0 : (left - right) | 0
      } else {
        break
      }
    }
    return left
  }

  function parseMultiplicative(): number {
    let left = parsePower()
    while (peek()?.kind === 'op') {
      const op = (peek() as { kind: 'op'; op: string }).op
      if (op === '*' || op === '/') {
        consume()
        const right = parsePower()
        if (op === '*') {
          left = Math.imul(left, right)
        } else {
          left = calcDiv(left, right) | 0
        }
      } else {
        break
      }
    }
    return left
  }

  function parsePower(): number {
    let left = parseUnary()
    while (peek()?.kind === 'op' && (peek() as { kind: 'op'; op: string }).op === '^') {
      consume()
      const right = parseUnary()
      left = calcPow(left, right)
    }
    return left
  }

  function parseUnary(): number {
    const t = peek()
    if (t?.kind === 'op' && (t.op === '-' || t.op === '+')) {
      consume()
      const val = parseUnary()
      return t.op === '-' ? (-val) | 0 : val | 0
    }
    return parsePrimary()
  }

  function parsePrimary(): number {
    const t = peek()
    if (!t) return 0

    if (t.kind === 'num') {
      consume()
      return t.value
    }

    if (t.kind === 'lparen') {
      consume() // '('
      const val = parseExpression()
      // Edge Case #1 (`Fire Wall` row 51): tolerate missing ')' at EOF!
      if (peek()?.kind === 'rparen') {
        consume()
      }
      return val
    }

    if (t.kind === 'ident') {
      consume()
      const fnName = t.name.toLowerCase()

      if (peek()?.kind === 'lparen') {
        consume() // '('

        // Special functions: `skill('Name'.prop)`, `sklvl('Name'.lvlExpr.prop)`, `stat('Name'.prop)`, `miss('Name'.prop)`
        if (fnName === 'skill' || fnName === 'sklvl' || fnName === 'stat' || fnName === 'miss') {
          const nameTok = peek()
          let targetName = ''
          if (nameTok?.kind === 'str' || nameTok?.kind === 'ident') {
            consume()
            targetName = nameTok.kind === 'str' ? nameTok.value : nameTok.name
          }
          const props: string[] = []
          while (peek()?.kind === 'dot') {
            consume() // '.'
            const propTok = peek()
            if (propTok?.kind === 'ident' || propTok?.kind === 'str') {
              consume()
              props.push(propTok.kind === 'ident' ? propTok.name : propTok.value)
            } else {
              break
            }
          }
          if (peek()?.kind === 'rparen') {
            consume()
          }

          if (fnName === 'skill') {
            const targetSkill = ctx.registry?.getSkillByName(targetName)
            if (!targetSkill) return 0
            return resolveSkillProperty(targetSkill, props[0] ?? 'lvl', ctx)
          }

          if (fnName === 'sklvl') {
            // Edge Case #4: Two-dot `sklvl('Holy Fire'.ln56.edmn)`
            const targetSkill = ctx.registry?.getSkillByName(targetName)
            if (!targetSkill) return 0
            const lvlExprProp = props[0] ?? 'lvl'
            const valProp = props[1] ?? props[0] ?? 'edmn'
            const targetLvl = resolveBuiltInIdentifier(lvlExprProp, ctx)
            return resolveSkillProperty(targetSkill, valProp, ctx, targetLvl)
          }

          if (fnName === 'stat') {
            const prop = (props[0] ?? 'accr').toLowerCase()
            if (ctx.getUnitStat) {
              return ctx.getUnitStat(targetName, prop === 'base')
            }
            return 0
          }

          if (fnName === 'miss') {
            const targetMissile = ctx.registry?.getMissileByName(targetName)
            if (!targetMissile) return 0
            return resolveMissileProperty(targetMissile, props[0] ?? 'range', ctx)
          }
        }

        // Standard numeric functions: `min(a, b)`, `max(a, b)`, `rand(a, b)`
        const args: number[] = []
        if (peek() && peek()?.kind !== 'rparen') {
          args.push(parseExpression())
          while (peek()?.kind === 'comma') {
            consume()
            args.push(parseExpression())
          }
        }
        if (peek()?.kind === 'rparen') {
          consume()
        }

        const a = args[0] ?? 0
        const b = args[1] ?? 0
        if (fnName === 'min') return Math.min(a, b)
        if (fnName === 'max') return Math.max(a, b)
        if (fnName === 'rand') {
          // 1.13c D2Common 0x6FDA0CB0 -> 0x6FD51180: a >= b ? a : a + seed % (b - a + 1)
          if (a >= b) return a
          return ctx.randFn ? ctx.randFn(a, b) : Math.trunc((a + b) / 2)
        }
        return a
      }

      return resolveBuiltInIdentifier(fnName, ctx)
    }

    consume()
    return 0
  }

  return parseExpression() | 0
}

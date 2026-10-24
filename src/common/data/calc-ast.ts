/**
 * Diablo II: Lord of Destruction v1.13c `D2Common` `calc` AST & Formula Evaluator.
 *
 * Implements the complete `SKILLS_EvaluateSkillFormula` / `MISSILE_EvaluateFormula`
 * grammar across `Skills.txt`, `SkillDesc.txt`, `Missiles.txt`, `SkillCalc.txt`,
 * and `MissCalc.txt`, including all 5 1.13c table edge cases:
 *  1. Unclosed `(` at end of expression (`Fire Wall` row 51 `EDmgSymPerCalc`).
 *  2. Unknown bare identifier `par34` (`Bone Wall` row 78 `calc2`) -> evaluates to `0`.
 *  3. Leading `*` on numeric missile function IDs (`royalstrikechainlightning` row 568).
 *  4. Two-dot `sklvl('Holy Fire'.ln56.edmn)` (`FireGolem` in `SkillDesc.txt`).
 *  5. Strictly base allocated `STAT_SKILLPTS` for `blvl` (`skill('...'.blvl)`),
 *     enforcing the 1.13c Marrowwalk / item charge synergy fix.
 */
import type { D2DataRegistry, SkillRecord, MissileRecord } from './data-registry.ts'

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
  if (slvl <= 0) return 0
  let total = base
  if (slvl > 1) {
    const b1 = Math.min(slvl, 8) - 1
    total += b1 * lev1
  }
  if (slvl > 8) {
    const b2 = Math.min(slvl, 16) - 8
    total += b2 * lev2
  }
  if (slvl > 16) {
    const b3 = Math.min(slvl, 22) - 16
    total += b3 * lev3
  }
  if (slvl > 22) {
    const b4 = Math.min(slvl, 28) - 22
    total += b4 * lev4
  }
  if (slvl > 28) {
    const b5 = slvl - 28
    total += b5 * lev5
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
  if (slvl <= 0 || (eLen === 0 && eLevLen1 === 0 && eLevLen2 === 0 && eLevLen3 === 0)) return 0
  let total = eLen
  if (slvl > 1) {
    total += (Math.min(slvl, 8) - 1) * eLevLen1
  }
  if (slvl > 8) {
    total += (Math.min(slvl, 16) - 8) * eLevLen2
  }
  if (slvl > 16) {
    total += (slvl - 16) * eLevLen3
  }
  return total
}

/**
 * Compute `D2Common` diminishing-returns formula `dm(a, b, lvl)`:
 * `floor((110 * lvl * (b - a)) / (100 * (lvl + 6))) + a`
 */
export function computeDiminishingReturns(a: number, b: number, lvl: number): number {
  if (lvl <= 0) return a
  const num = 110 * lvl * (b - a)
  const den = 100 * (lvl + 6)
  return Math.trunc(num / den) + a
}

/**
 * Compute `D2Common` linear scaling `ln(a, b, lvl)`:
 * `a + (lvl - 1) * b`
 */
export function computeLinearScaling(a: number, b: number, lvl: number): number {
  if (lvl <= 0) return a
  return a + (lvl - 1) * b
}

/**
 * Compute mana cost in 256-fixed-point (`usmc`) and integer mana (`manaCost`) for a skill at `slvl`.
 * Formula from `D2Common` `SKILLS_GetManaCost`:
 * `usmc = max(minmana << 8, (mana + lvlmana * (slvl - 1)) << manashift)`
 */
export function computeSkillManaCost256(skill: SkillRecord, slvl: number): { manaCost256: number; manaCost: number } {
  const effLvl = Math.max(1, slvl)
  const raw = (skill.mana + skill.lvlMana * (effLvl - 1)) << skill.manaShift
  const min256 = skill.minMana << 8
  const manaCost256 = Math.max(min256, raw)
  return {
    manaCost256,
    manaCost: manaCost256 >> 8,
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
      return missile.range + (lvl - 1) * missile.levRange
    case 'vel':
      return missile.vel + (lvl - 1) * missile.velLev
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
 * Resolve any built-in variable or macro on the current `CalcEvalContext`.
 */
function resolveBuiltInIdentifier(ident: string, ctx: CalcEvalContext): number {
  const key = ident.toLowerCase()
  const skill = ctx.activeSkill
  const missile = ctx.activeMissile
  const lvl = Math.max(0, ctx.slvl)
  const blvl = Math.max(0, ctx.blvl)
  const ulvl = ctx.ulvl ?? 80

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
    case 'sd12':
      return computeDiminishingReturns(par1, par2, lvl)
    case 'dm34':
    case 'sd34':
      return computeDiminishingReturns(par3, par4, lvl)
    case 'dm56':
      return computeDiminishingReturns(par5, par6, lvl)
    case 'dm78':
      return computeDiminishingReturns(par7, par8, lvl)
    case 'dd12':
      return computeDiminishingReturns(missile?.dParam1 ?? 0, missile?.dParam2 ?? 0, lvl)
  }

  if (!skill) return 0

  if (key === 'usmc' || key === 'mana' || key === 'mps') {
    const { manaCost256, manaCost } = computeSkillManaCost256(skill, lvl)
    if (key === 'usmc') return manaCost256
    if (key === 'mana') return manaCost
    return (manaCost256 * 25) >> 8
  }

  if (key === 'toht') {
    if (skill.toHitCalc && (ctx.depth ?? 0) < 8) {
      return evaluateCalc(skill.toHitCalc, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
    }
    return skill.toHit + Math.max(0, lvl - 1) * skill.toHitLev
  }

  if (key === 'clc1' && (ctx.depth ?? 0) < 8) {
    return evaluateCalc(skill.calc1, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
  }
  if (key === 'clc2' && (ctx.depth ?? 0) < 8) {
    return evaluateCalc(skill.calc2, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
  }
  if (key === 'clc3' && (ctx.depth ?? 0) < 8) {
    return evaluateCalc(skill.calc3, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
  }
  if (key === 'clc4' && (ctx.depth ?? 0) < 8) {
    return evaluateCalc(skill.calc4, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
  }
  if (key === 'len' && (ctx.depth ?? 0) < 8) {
    return evaluateCalc(skill.auraLenCalc, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
  }
  if (key === 'rng' && (ctx.depth ?? 0) < 8) {
    return evaluateCalc(skill.auraRangeCalc, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
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
    const min256 = baseMin << skill.hitShift
    const max256 = baseMax << skill.hitShift
    const eSynPct =
      skill.eDmgSymPerCalc && (ctx.depth ?? 0) < 8
        ? evaluateCalc(skill.eDmgSymPerCalc, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
        : 0
    const lenSynPct =
      skill.eLenSymPerCalc && (ctx.depth ?? 0) < 8
        ? evaluateCalc(skill.eLenSymPerCalc, { ...ctx, depth: (ctx.depth ?? 0) + 1 })
        : 0

    const synMin256 = Math.trunc((min256 * (100 + eSynPct)) / 100)
    const synMax256 = Math.trunc((max256 * (100 + eSynPct)) / 100)
    const synLen = Math.trunc((baseLen * (100 + lenSynPct)) / 100)

    switch (key) {
      case 'edns':
        return min256
      case 'edxs':
        return max256
      case 'edmn':
        return min256 >> 8
      case 'edmx':
        return max256 >> 8
      case 'edln':
        return baseLen
      case 'enms':
        return synMin256
      case 'exms':
        return synMax256
      case 'enma':
        return synMin256 >> 8
      case 'exma':
        return synMax256 >> 8
      case 'edma':
        return synLen
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
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed)

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
          left = Math.trunc(left * right)
        } else {
          // D2Common division by zero evaluates to 0
          left = right === 0 ? 0 : Math.trunc(left / right)
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
      left = right < 0 ? 0 : Math.trunc(Math.pow(left, right))
    }
    return left
  }

  function parseUnary(): number {
    const t = peek()
    if (t?.kind === 'op' && (t.op === '-' || t.op === '+')) {
      consume()
      const val = parseUnary()
      return t.op === '-' ? -val : val
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
          const lo = Math.min(a, b)
          const hi = Math.max(a, b)
          return ctx.randFn ? ctx.randFn(lo, hi) : Math.trunc((lo + hi) / 2)
        }
        return a
      }

      return resolveBuiltInIdentifier(fnName, ctx)
    }

    consume()
    return 0
  }

  return Math.trunc(parseExpression())
}

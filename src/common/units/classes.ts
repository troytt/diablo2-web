/**
 * Canonical Character Classes and Progression System for Diablo II (v1.13c).
 *
 * Implements the 7 playable character classes:
 * - Amazon (ama / am)
 * - Sorceress (sor / so)
 * - Necromancer (nec / ne)
 * - Paladin (pal / pa)
 * - Barbarian (bar / ba)
 * - Druid (dru / dz)
 * - Assassin (ass / ai)
 *
 * Ground truth references:
 * - D2Common.dll (0x6fd70000)
 * - data\global\excel\CharStats.txt
 * - data\global\chars\<token>\cof\
 */

import type { ActTables, D2Table } from '../world/acts.ts'
import { cell } from '../world/acts.ts'

export type CharacterClassCode = 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass'
export type CharacterSpriteToken = 'am' | 'so' | 'ne' | 'pa' | 'ba' | 'dz' | 'ai'

export interface CharacterClassStats {
  readonly name: string
  readonly code: CharacterClassCode
  readonly token: CharacterSpriteToken
  readonly baseAttributes: {
    readonly strength: number
    readonly dexterity: number
    readonly vitality: number
    readonly energy: number
  }
  readonly baseVitals: {
    readonly life: number      // vit + 30 (hpadd)
    readonly mana: number      // energy (int column)
    readonly stamina: number   // stamina column
  }
  readonly perLevel: {
    readonly life: number      // LifePerLevel / 4
    readonly mana: number      // ManaPerLevel / 4
    readonly stamina: number   // StaminaPerLevel / 4
    readonly statPoints: number // StatPerLevel = 5
  }
  readonly perStatPoint: {
    readonly lifePerVitality: number    // LifePerVitality / 4
    readonly staminaPerVitality: number // StaminaPerVitality / 4
    readonly manaPerEnergy: number      // ManaPerMagic / 4
  }
  readonly blockFactor: number
  readonly runDrain: number
  readonly toHitFactor: number
  readonly manaRegenSeconds: number // 120 seconds for full pool
  readonly baseWClass: string       // "hth" (hand-to-hand)
  readonly startSkill?: string
}

export const CHARACTER_CLASS_CODES: readonly CharacterClassCode[] = [
  'ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass',
]

export const CHARACTER_SPRITE_TOKENS: readonly CharacterSpriteToken[] = [
  'am', 'so', 'ne', 'pa', 'ba', 'dz', 'ai',
]

export const CHARACTER_CLASS_NAMES = [
  'Amazon', 'Sorceress', 'Necromancer', 'Paladin', 'Barbarian', 'Druid', 'Assassin',
] as const

/**
 * Known token and name aliases mapping to canonical sprite tokens and class codes.
 * In Blizzard archives, Assassin sprite assets live strictly under `data\global\chars\ai\`.
 * The colloquial token `as` is an alias that must map to `ai`.
 */
export const TOKEN_ALIASES: Readonly<Record<string, CharacterSpriteToken>> = Object.freeze({
  as: 'ai',
  dr: 'dz',
})

/**
 * Canonical 1.13c CharStats.txt data for all 7 classes.
 * Values verified against Patch_D2.mpq and d2exp.mpq.
 */
export const CANONICAL_CHARSTATS: Readonly<Record<CharacterClassCode, CharacterClassStats>> = Object.freeze({
  ama: Object.freeze({
    name: 'Amazon',
    code: 'ama',
    token: 'am',
    baseAttributes: Object.freeze({ strength: 20, dexterity: 25, vitality: 20, energy: 15 }),
    baseVitals: Object.freeze({ life: 50, mana: 15, stamina: 84 }),
    perLevel: Object.freeze({ life: 2.0, mana: 1.5, stamina: 1.0, statPoints: 5 }),
    perStatPoint: Object.freeze({ lifePerVitality: 3.0, staminaPerVitality: 1.0, manaPerEnergy: 1.5 }),
    blockFactor: 25,
    runDrain: 20,
    toHitFactor: 5,
    manaRegenSeconds: 120,
    baseWClass: 'hth',
  }),
  sor: Object.freeze({
    name: 'Sorceress',
    code: 'sor',
    token: 'so',
    baseAttributes: Object.freeze({ strength: 10, dexterity: 25, vitality: 10, energy: 35 }),
    baseVitals: Object.freeze({ life: 40, mana: 35, stamina: 74 }),
    perLevel: Object.freeze({ life: 1.0, mana: 2.0, stamina: 1.0, statPoints: 5 }),
    perStatPoint: Object.freeze({ lifePerVitality: 2.0, staminaPerVitality: 1.0, manaPerEnergy: 2.0 }),
    blockFactor: 20,
    runDrain: 20,
    toHitFactor: -15,
    manaRegenSeconds: 120,
    baseWClass: 'hth',
    startSkill: 'fire bolt',
  }),
  nec: Object.freeze({
    name: 'Necromancer',
    code: 'nec',
    token: 'ne',
    baseAttributes: Object.freeze({ strength: 15, dexterity: 25, vitality: 15, energy: 25 }),
    baseVitals: Object.freeze({ life: 45, mana: 25, stamina: 79 }),
    perLevel: Object.freeze({ life: 1.5, mana: 2.0, stamina: 1.0, statPoints: 5 }),
    perStatPoint: Object.freeze({ lifePerVitality: 2.0, staminaPerVitality: 1.0, manaPerEnergy: 2.0 }),
    blockFactor: 20,
    runDrain: 20,
    toHitFactor: -10,
    manaRegenSeconds: 120,
    baseWClass: 'hth',
    startSkill: 'raise skeleton',
  }),
  pal: Object.freeze({
    name: 'Paladin',
    code: 'pal',
    token: 'pa',
    baseAttributes: Object.freeze({ strength: 25, dexterity: 20, vitality: 25, energy: 15 }),
    baseVitals: Object.freeze({ life: 55, mana: 15, stamina: 89 }),
    perLevel: Object.freeze({ life: 2.0, mana: 1.5, stamina: 1.0, statPoints: 5 }),
    perStatPoint: Object.freeze({ lifePerVitality: 3.0, staminaPerVitality: 1.0, manaPerEnergy: 1.5 }),
    blockFactor: 30,
    runDrain: 20,
    toHitFactor: 20,
    manaRegenSeconds: 120,
    baseWClass: 'hth',
  }),
  bar: Object.freeze({
    name: 'Barbarian',
    code: 'bar',
    token: 'ba',
    baseAttributes: Object.freeze({ strength: 30, dexterity: 20, vitality: 25, energy: 10 }),
    baseVitals: Object.freeze({ life: 55, mana: 10, stamina: 92 }),
    perLevel: Object.freeze({ life: 2.0, mana: 1.0, stamina: 1.0, statPoints: 5 }),
    perStatPoint: Object.freeze({ lifePerVitality: 4.0, staminaPerVitality: 1.0, manaPerEnergy: 1.0 }),
    blockFactor: 25,
    runDrain: 20,
    toHitFactor: 20,
    manaRegenSeconds: 120,
    baseWClass: 'hth',
  }),
  dru: Object.freeze({
    name: 'Druid',
    code: 'dru',
    token: 'dz',
    baseAttributes: Object.freeze({ strength: 15, dexterity: 20, vitality: 25, energy: 20 }),
    baseVitals: Object.freeze({ life: 55, mana: 20, stamina: 84 }),
    perLevel: Object.freeze({ life: 1.5, mana: 2.0, stamina: 1.0, statPoints: 5 }),
    perStatPoint: Object.freeze({ lifePerVitality: 2.0, staminaPerVitality: 1.0, manaPerEnergy: 2.0 }),
    blockFactor: 20,
    runDrain: 20,
    toHitFactor: 5,
    manaRegenSeconds: 120,
    baseWClass: 'hth',
  }),
  ass: Object.freeze({
    name: 'Assassin',
    code: 'ass',
    token: 'ai',
    baseAttributes: Object.freeze({ strength: 20, dexterity: 20, vitality: 20, energy: 25 }),
    baseVitals: Object.freeze({ life: 50, mana: 25, stamina: 95 }),
    perLevel: Object.freeze({ life: 2.0, mana: 1.5, stamina: 1.25, statPoints: 5 }),
    perStatPoint: Object.freeze({ lifePerVitality: 3.0, staminaPerVitality: 1.25, manaPerEnergy: 1.75 }),
    blockFactor: 25,
    runDrain: 15,
    toHitFactor: 15,
    manaRegenSeconds: 120,
    baseWClass: 'hth',
  }),
})

const CODE_BY_NAME: Readonly<Record<string, CharacterClassCode>> = {
  amazon: 'ama',
  sorceress: 'sor',
  necromancer: 'nec',
  paladin: 'pal',
  barbarian: 'bar',
  druid: 'dru',
  assassin: 'ass',
}

const CODE_BY_TOKEN: Readonly<Record<CharacterSpriteToken, CharacterClassCode>> = {
  am: 'ama',
  so: 'sor',
  ne: 'nec',
  pa: 'pal',
  ba: 'bar',
  dz: 'dru',
  ai: 'ass',
}

/**
 * Parses a single data row from CharStats.txt into a CharacterClassStats object.
 * Returns undefined if the row is a comment or separator (e.g. "Expansion").
 */
export function parseCharStatsRow(table: D2Table, row: readonly string[]): CharacterClassStats | undefined {
  const rawClass = cell(table, row, 'class').trim()
  if (!rawClass || rawClass.toLowerCase() === 'expansion') {
    return undefined
  }

  const lowerClass = rawClass.toLowerCase()
  const code = Object.prototype.hasOwnProperty.call(CODE_BY_NAME, lowerClass)
    ? CODE_BY_NAME[lowerClass]
    : undefined
  if (!code) {
    return undefined
  }

  const canonical = CANONICAL_CHARSTATS[code]
  const str = Number(cell(table, row, 'str') || canonical.baseAttributes.strength)
  const dex = Number(cell(table, row, 'dex') || canonical.baseAttributes.dexterity)
  const energy = Number(cell(table, row, 'int') || canonical.baseAttributes.energy)
  const vit = Number(cell(table, row, 'vit') || canonical.baseAttributes.vitality)
  const stamina = Number(cell(table, row, 'stamina') || canonical.baseVitals.stamina)
  const hpadd = Number(cell(table, row, 'hpadd') || '30')
  const life = vit + hpadd

  const lifePerLevel = cell(table, row, 'LifePerLevel') !== ''
    ? Number(cell(table, row, 'LifePerLevel')) / 4
    : canonical.perLevel.life
  const manaPerLevel = cell(table, row, 'ManaPerLevel') !== ''
    ? Number(cell(table, row, 'ManaPerLevel')) / 4
    : canonical.perLevel.mana
  const staminaPerLevel = cell(table, row, 'StaminaPerLevel') !== ''
    ? Number(cell(table, row, 'StaminaPerLevel')) / 4
    : canonical.perLevel.stamina
  const statPoints = cell(table, row, 'StatPerLevel') !== ''
    ? Number(cell(table, row, 'StatPerLevel'))
    : canonical.perLevel.statPoints

  const lifePerVitality = cell(table, row, 'LifePerVitality') !== ''
    ? Number(cell(table, row, 'LifePerVitality')) / 4
    : canonical.perStatPoint.lifePerVitality
  const staminaPerVitality = cell(table, row, 'StaminaPerVitality') !== ''
    ? Number(cell(table, row, 'StaminaPerVitality')) / 4
    : canonical.perStatPoint.staminaPerVitality
  const manaPerEnergy = cell(table, row, 'ManaPerMagic') !== ''
    ? Number(cell(table, row, 'ManaPerMagic')) / 4
    : canonical.perStatPoint.manaPerEnergy

  const blockFactor = cell(table, row, 'BlockFactor') !== ''
    ? Number(cell(table, row, 'BlockFactor'))
    : canonical.blockFactor
  const runDrain = cell(table, row, 'RunDrain') !== ''
    ? Number(cell(table, row, 'RunDrain'))
    : canonical.runDrain
  const toHitFactor = cell(table, row, 'ToHitFactor') !== ''
    ? Number(cell(table, row, 'ToHitFactor'))
    : canonical.toHitFactor
  const manaRegenSeconds = cell(table, row, 'ManaRegen') !== ''
    ? Number(cell(table, row, 'ManaRegen'))
    : canonical.manaRegenSeconds
  const baseWClass = cell(table, row, 'baseWClass').trim() || canonical.baseWClass
  const startSkill = cell(table, row, 'StartSkill').trim() || canonical.startSkill

  return {
    name: canonical.name,
    code: canonical.code,
    token: canonical.token,
    baseAttributes: { strength: str, dexterity: dex, vitality: vit, energy },
    baseVitals: { life, mana: energy, stamina },
    perLevel: { life: lifePerLevel, mana: manaPerLevel, stamina: staminaPerLevel, statPoints },
    perStatPoint: { lifePerVitality, staminaPerVitality, manaPerEnergy },
    blockFactor,
    runDrain,
    toHitFactor,
    manaRegenSeconds,
    baseWClass,
    ...(startSkill ? { startSkill } : {}),
  }
}

/**
 * Parses an entire CharStats.txt D2Table into a map of character class stats.
 */
export function parseCharStatsTable(table: D2Table): Record<CharacterClassCode, CharacterClassStats> {
  const result: Partial<Record<CharacterClassCode, CharacterClassStats>> = {}
  for (const row of table.rows) {
    const parsed = parseCharStatsRow(table, row)
    if (parsed) {
      result[parsed.code] = parsed
    }
  }
  // Fill any missing classes from canonical data
  for (const code of CHARACTER_CLASS_CODES) {
    if (!result[code]) {
      result[code] = CANONICAL_CHARSTATS[code]
    }
  }
  return result as Record<CharacterClassCode, CharacterClassStats>
}

/**
 * Resolves a character class by name, 3-letter code, or 2-letter sprite token (case-insensitive).
 * Maps token alias `as` to canonical `ai` (Assassin).
 *
 * @param input - class name ("Barbarian"), code ("bar"), token ("ba", "ai", "as")
 * @param tableOrCatalog - optional ActTables, D2Table, or pre-parsed catalog
 * @throws Error if class cannot be resolved
 */
export function resolveCharacterClass(
  input: string,
  tableOrCatalog?: ActTables | D2Table | Record<CharacterClassCode, CharacterClassStats>,
): CharacterClassStats {
  const raw = (input ?? '').trim().toLowerCase()
  if (!raw) {
    throw new Error(`Invalid empty character class input: "${input}"`)
  }

  // Resolve source catalog
  let catalog: Record<CharacterClassCode, CharacterClassStats> = CANONICAL_CHARSTATS
  if (tableOrCatalog) {
    if ('charstats' in tableOrCatalog && tableOrCatalog.charstats) {
      catalog = parseCharStatsTable(tableOrCatalog.charstats)
    } else if ('header' in tableOrCatalog && 'rows' in tableOrCatalog) {
      catalog = parseCharStatsTable(tableOrCatalog as D2Table)
    } else if ('ama' in tableOrCatalog) {
      catalog = tableOrCatalog as Record<CharacterClassCode, CharacterClassStats>
    }
  }

  // 1. Direct 3-letter code match
  if (CHARACTER_CLASS_CODES.includes(raw as CharacterClassCode)) {
    return catalog[raw as CharacterClassCode]
  }

  // 2. Class name match
  if (Object.prototype.hasOwnProperty.call(CODE_BY_NAME, raw)) {
    const codeFromName = CODE_BY_NAME[raw]
    if (codeFromName && catalog[codeFromName]) {
      return catalog[codeFromName]
    }
  }

  // 3. Token alias resolution (e.g. 'as' -> 'ai', 'dr' -> 'dz')
  const resolvedToken = Object.prototype.hasOwnProperty.call(TOKEN_ALIASES, raw)
    ? TOKEN_ALIASES[raw]
    : raw

  // 4. Token match
  if (Object.prototype.hasOwnProperty.call(CODE_BY_TOKEN, resolvedToken)) {
    const codeFromToken = CODE_BY_TOKEN[resolvedToken as CharacterSpriteToken]
    if (codeFromToken && catalog[codeFromToken]) {
      return catalog[codeFromToken]
    }
  }

  throw new Error(`Unknown character class: "${input}"`)
}

/**
 * Returns all 7 canonical character classes in standard Blizzard order:
 * Amazon, Sorceress, Necromancer, Paladin, Barbarian, Druid, Assassin.
 */
export function getAllCharacterClasses(
  tableOrCatalog?: ActTables | D2Table | Record<CharacterClassCode, CharacterClassStats>,
): readonly CharacterClassStats[] {
  let catalog: Record<CharacterClassCode, CharacterClassStats> = CANONICAL_CHARSTATS
  if (tableOrCatalog) {
    if ('charstats' in tableOrCatalog && tableOrCatalog.charstats) {
      catalog = parseCharStatsTable(tableOrCatalog.charstats)
    } else if ('header' in tableOrCatalog && 'rows' in tableOrCatalog) {
      catalog = parseCharStatsTable(tableOrCatalog as D2Table)
    } else if ('ama' in tableOrCatalog) {
      catalog = tableOrCatalog as Record<CharacterClassCode, CharacterClassStats>
    }
  }
  return CHARACTER_CLASS_CODES.map(code => catalog[code])
}

/**
 * Calculates a character's total vitals (Life, Mana, Stamina) at a given character level
 * and allocated stat points.
 *
 * @param classStats - character class definition
 * @param level - character level (1..99)
 * @param addedAttributes - manually allocated attribute points beyond base
 */
export function calculateVitalsAtLevel(
  classStats: CharacterClassStats,
  level: number,
  addedAttributes?: { readonly vitality?: number; readonly energy?: number },
): { readonly life: number; readonly mana: number; readonly stamina: number } {
  const clvl = Math.max(1, Math.min(99, Math.floor(level)))
  const levelsGained = clvl - 1
  const addedVit = Math.max(0, addedAttributes?.vitality ?? 0)
  const addedEne = Math.max(0, addedAttributes?.energy ?? 0)

  const life = classStats.baseVitals.life
    + levelsGained * classStats.perLevel.life
    + addedVit * classStats.perStatPoint.lifePerVitality

  const mana = classStats.baseVitals.mana
    + levelsGained * classStats.perLevel.mana
    + addedEne * classStats.perStatPoint.manaPerEnergy

  const stamina = classStats.baseVitals.stamina
    + levelsGained * classStats.perLevel.stamina
    + addedVit * classStats.perStatPoint.staminaPerVitality

  return { life, mana, stamina }
}

export const CLASS_CODE_TO_CHAR_TOKEN: Readonly<Record<string, string>> = {
  ama: 'am',
  am: 'am',
  amazon: 'am',
  sor: 'so',
  so: 'so',
  sorceress: 'so',
  nec: 'ne',
  ne: 'ne',
  necromancer: 'ne',
  pal: 'pa',
  pa: 'pa',
  paladin: 'pa',
  bar: 'ba',
  ba: 'ba',
  barbarian: 'ba',
  dru: 'dz',
  dz: 'dz',
  druid: 'dz',
  ass: 'ai',
  ai: 'ai',
  assassin: 'ai',
}

export function resolvePlayerCharToken(classOrToken: string): string {
  const key = classOrToken.trim().toLowerCase()
  return CLASS_CODE_TO_CHAR_TOKEN[key] ?? 'so'
}


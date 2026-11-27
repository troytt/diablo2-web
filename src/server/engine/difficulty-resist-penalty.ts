/**
 * `DifficultyLevels.txt` lookups for the server combat path.
 *
 * - `ResistPenalty` (record offset 0x00): 1.13c `D2Game.dll` 0x6FCFB3C0 (effective-resistance
 *   resolver) adds it to the defender's resistance when the defender is a player or a hireling
 *   and the channel is neither `damageresist` (36) nor `magicresist` (37). See
 *   `kb/combat/d2game-effective-resist-113c.md`.
 * - `DeathExpPenalty` (record offset 0x04): 1.13c `D2Game.dll` `0x6FC57730` (`0x6FC5778E`)
 *   deducts `floor((Exp(clvl) - Exp(clvl - 1)) * DeathExpPenalty / 100)` (`0 / 5 / 10` across
 *   Normal / Nightmare / Hell) on non-player / non-player-pet death, clamped at `Exp(clvl - 1) + 1`.
 * - `MonsterFreezeDivisor` / `MonsterColdDivisor` (record offsets 0x14 / 0x18): `D2Game.dll`
 *   `0x6FCFDAC0` (`SUNITDMG_ApplyFreeze`) and `0x6FCFC780` (`SUNITDMG_ApplyCold`) divide monster
 *   freeze (`STATE_FREEZE` 1) and cold chill (`STATE_COLD` 11) durations by them (`1 / 2 / 4`
 *   across Normal / Nightmare / Hell). See `kb/combat/d2game-cold-freeze-duration-113c.md`.
 * - `AiCurseDivisor` (record offset 0x1C): `D2Game.dll` `0x6FC6DF60` divides AI-curse durations
 *   (`srvdo 30` when `auratargetstate` is `dimvision` / `terror`, plus `srvdo 59` Attract and
 *   `srvdo 61` Confuse) by it (`1 / 2 / 4` across Normal / Nightmare / Hell).
 * - `LifeStealDivisor` / `ManaStealDivisor` (record offsets 0x20 / 0x24): `D2Game.dll`
 *   0x6FCFBACF..0x6FCFBAF3 divides a player attacker's `lifedrainmindam` / `manadrainmindam`
 *   (pre-shifted `<< 6`) by them. See `kb/combat/d2game-life-mana-steal-113c.md`.
 *
 * Values are read from the baked `DifficultyLevels.txt` (Patch_D2.mpq: ResistPenalty
 * 0 / -40 / -100, MonsterFreezeDivisor 1 / 2 / 4, MonsterColdDivisor 1 / 2 / 4,
 * AiCurseDivisor 1 / 2 / 4, LifeStealDivisor 1 / 2 / 3, ManaStealDivisor 1 / 2 / 3);
 * they are never hard-coded here.
 */
import { RAW_DIFFICULTY_LEVELS } from '../../common/data/canonical-drop-data.ts'
import { parseTable } from '../../common/world/acts.ts'

const DIFFICULTY_ROW_NAMES = ['Normal', 'Nightmare', 'Hell'] as const

type DifficultyColumn =
  | 'ResistPenalty'
  | 'DeathExpPenalty'
  | 'MonsterFreezeDivisor'
  | 'MonsterColdDivisor'
  | 'AiCurseDivisor'
  | 'LifeStealDivisor'
  | 'ManaStealDivisor'

const cachedColumns = new Map<DifficultyColumn, readonly number[]>()

function loadColumn(column: DifficultyColumn): readonly number[] {
  const cached = cachedColumns.get(column)
  if (cached !== undefined) return cached
  const table = parseTable(new TextEncoder().encode(RAW_DIFFICULTY_LEVELS))
  const header = table.header.map((h) => h.trim())
  const nameCol = header.indexOf('Name')
  const valueCol = header.indexOf(column)
  if (nameCol < 0 || valueCol < 0) {
    throw new Error(`DifficultyLevels.txt: missing Name/${column} column`)
  }
  const values = DIFFICULTY_ROW_NAMES.map((expected, index) => {
    const row = table.rows[index]
    const name = (row?.[nameCol] ?? '').trim()
    if (name !== expected) {
      throw new Error(`DifficultyLevels.txt: row ${String(index)} is '${name}', expected '${expected}'`)
    }
    const text = (row?.[valueCol] ?? '').trim()
    const value = Number(text)
    if (text === '' || !Number.isInteger(value)) {
      throw new Error(`DifficultyLevels.txt: ${column} '${text}' for '${name}'`)
    }
    return value
  })
  cachedColumns.set(column, values)
  return values
}

function difficultyValue(column: DifficultyColumn, difficulty: number): number {
  const value = loadColumn(column)[difficulty]
  if (value === undefined) {
    throw new Error(`DifficultyLevels.txt: no ${column} row for difficulty ${String(difficulty)}`)
  }
  return value
}

/** `DifficultyLevels.txt` `ResistPenalty` for difficulty index 0 (Normal) / 1 (Nightmare) / 2 (Hell). */
export function difficultyResistPenalty(difficulty: number): number {
  return difficultyValue('ResistPenalty', difficulty)
}

/** `DifficultyLevels.txt` `DeathExpPenalty` (record +0x04) for difficulty index 0 (Normal) / 1 (Nightmare) / 2 (Hell). */
export function difficultyDeathExpPenalty(difficulty: number): number {
  return difficultyValue('DeathExpPenalty', difficulty)
}

/** `DifficultyLevels.txt` `MonsterFreezeDivisor` (record +0x14) for difficulty index 0 / 1 / 2. */
export function difficultyMonsterFreezeDivisor(difficulty: number): number {
  return difficultyValue('MonsterFreezeDivisor', difficulty)
}

/** `DifficultyLevels.txt` `MonsterColdDivisor` (record +0x18) for difficulty index 0 / 1 / 2. */
export function difficultyMonsterColdDivisor(difficulty: number): number {
  return difficultyValue('MonsterColdDivisor', difficulty)
}

/** `DifficultyLevels.txt` `AiCurseDivisor` (record +0x1C) for difficulty index 0 / 1 / 2. */
export function difficultyAiCurseDivisor(difficulty: number): number {
  return difficultyValue('AiCurseDivisor', difficulty)
}

/** `DifficultyLevels.txt` `LifeStealDivisor` (record +0x28) for difficulty index 0 / 1 / 2. */
export function difficultyLifeStealDivisor(difficulty: number): number {
  return difficultyValue('LifeStealDivisor', difficulty)
}

/** `DifficultyLevels.txt` `ManaStealDivisor` (record +0x2C) for difficulty index 0 / 1 / 2. */
export function difficultyManaStealDivisor(difficulty: number): number {
  return difficultyValue('ManaStealDivisor', difficulty)
}

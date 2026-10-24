/**
 * Real monster data: `MonStats.txt`, `Levels.txt`'s monster columns,
 * `SuperUniques.txt` and `MonUMod.txt`.
 *
 * ## Why this is a separate module from `combat.ts`
 *
 * `combat.ts`'s {@link monsterStatsFromRow} reads a *fixture* table — nine
 * columns named `Id/Name/HP/Damage/...` that the sandbox and the co-op tests
 * write by hand. The real `MonStats.txt` has **255 columns** and shares almost
 * none of those names: it is `NameStr` not `Name`, `minHP`/`maxHP` not `HP`,
 * `A1MinD`/`A1MaxD` not `Damage`, `Exp` not `XP`, `Velocity` not `Speed`.
 * Pointing the fixture reader at the real table does not fail — it silently
 * falls back to its defaults for every column, producing 735 monsters with
 * identical stats. That is worse than having no monsters, because it looks like
 * it works. Hence two readers, each honest about the shape it reads.
 *
 * ## What is real here and what is not
 *
 * Read straight from the tables, no interpretation:
 * `Id`, `BaseId`, `NameStr`, `Code`, `MonType`, `AI`, `Rarity`, `MinGrp`,
 * `MaxGrp`, `Level`, `minHP`/`maxHP`, `AC`, `Exp`, `A1*`/`A2*`, the six
 * resistances, `TreasureClass*`, and every `Levels.txt` monster column.
 *
 * Engine-side approximations, each marked at its definition:
 * - **Speed, reach, aggro radius and attack cooldown** have no direct pixel or
 *   tick equivalent in the tables. They are derived from the player's own
 *   numbers by a documented ratio rather than invented.
 * - **Density → monster count.** `MonDen` is consumed by the real level
 *   generator per *room*; we have no rooms until M8. The conversion here is an
 *   area-proportional approximation and says so.
 *
 * ## The numbers in `MonStats.txt` are not the numbers in the game
 *
 * A Fallen's row says 21–61 health and 51–101 damage. A Fallen in the Blood
 * Moor has about three health and hits for one. The row holds *per-mille-ish*
 * figures that `MonLvl.txt` turns into real ones:
 *
 * ```
 * final = MonStats[column] × MonLvl[monster level][matching column] ÷ 100
 * ```
 *
 * That was not assumed, it was measured: it reconciles five independent columns
 * against values the game is known to show, all at once.
 *
 * | monster | column | table | × MonLvl ÷ 100 | in game |
 * |---|---|---|---|---|
 * | fallen1 | `Exp` | 61 | 18.3 | 18 |
 * | zombie1 | `Exp` | 111 | 33.3 | 33 |
 * | quillrat1 | `Exp` | 71 | 21.3 | 21 |
 * | fallen1 | `AC` | 84 | 5.0 | 5 |
 * | fallen1 | `A1TH` | 101 | 8.1 | 8 |
 *
 * Five exact hits is not a coincidence, so the scaling is applied rather than
 * deferred. Two consequences worth stating:
 *
 * - The difficulty columns `MinHP(N)`/`MinHP(H)` are *not* Nightmare and Hell
 *   health either. `fallen1` is 21–61 on Normal and 25–55 on both harder ones,
 *   426 of the 594 rows with health have a **lower** `MaxHP(N)` than `maxHP`,
 *   and Duriel drops from 4757 to 1295 on Hell. Difficulty comes from the
 *   monster's own `Level(N)`/`Level(H)` — a Fallen is level 1, then 36, then 67
 *   — fed through `MonLvl`'s `HP(N)`/`HP(H)` columns. That is what makes a
 *   Nightmare Fallen a 131–289 health monster rather than a 25–55 one.
 * - `MonLvl.txt`'s `L-` prefixed columns, the expansion set, are byte-identical
 *   to the classic ones throughout 1.13c, so which set is read makes no
 *   difference. The classic ones are used.
 *
 * Bosses were checked for an exemption and did not get one. The data is not
 * consistent enough to justify carving one out: scaled Diablo lands on 13818
 * against a remembered 13741 and scaled Andariel on 1025 against ~960, but
 * Duriel's raw 4757 is the figure usually quoted for him. Inventing a special
 * case on that basis would be guessing; the act bosses get their own pass.
 */
import type { D2Table } from '../world/acts.ts'
import { cell, parseTable } from '../world/acts.ts'
import type {
  MonsterDifficultyStats,
  MonsterElementalAttack,
  MonsterModeMissiles,
  MonsterPack,
  MonsterSkillEntry,
  MonsterStats,
} from './unit-types.ts'
import { Rng } from '../rng/d2-rng.ts'
import { getDefaultTblLang as getTblLang, lookupTbl, type TblLang } from '../formats/tbl.ts'
import {
  MONAI_113C_ROWS,
  MONLVL_113C_ROWS,
  MONSTATS_113C_ROWS,
  MONUMOD_113C_CONSTANTS,
  MONUMOD_113C_ROWS,
  SUPERUNIQUES_113C_ROWS,
  type MonAi113cRow,
  type MonLvl113cRow,
  type MonStats113cAttackRow,
  type MonStats113cDifficultyVector,
  type MonStats113cElementalAttackRow,
  type MonStats113cRow,
  type MonStats113cSkillRow,
  type MonUMod113cConstants,
  type MonUMod113cRow,
  type SuperUnique113cRow,
  type SuperUnique113cTc,
} from './monstats-113c-data.ts'
import {
  MONSTER_MODE_MISSILES_113C,
  getMonsterModeMissile113c,
  type MonsterModeMissiles113c,
} from './monster-mode-missiles-113c.ts'

export {
  MONAI_113C_ROWS,
  MONLVL_113C_ROWS,
  MONSTATS_113C_ROWS,
  MONSTER_MODE_MISSILES_113C,
  MONUMOD_113C_CONSTANTS,
  MONUMOD_113C_ROWS,
  SUPERUNIQUES_113C_ROWS,
  getMonsterModeMissile113c,
  type MonAi113cRow,
  type MonLvl113cRow,
  type MonStats113cAttackRow,
  type MonStats113cDifficultyVector,
  type MonStats113cElementalAttackRow,
  type MonStats113cRow,
  type MonStats113cSkillRow,
  type MonUMod113cConstants,
  type MonUMod113cRow,
  type MonsterModeMissiles113c,
  type SuperUnique113cRow,
  type SuperUnique113cTc,
}

/** Which difficulty a number is being read for. */
export type Difficulty = 'normal' | 'nightmare' | 'hell'

/**
 * The suffix `MonStats.txt` and `Levels.txt` use for a difficulty's columns.
 *
 * @param difficulty - the difficulty.
 * @returns `''`, `'(N)'` or `'(H)'`.
 */
export function difficultySuffix(difficulty: Difficulty): string {
  if (difficulty === 'nightmare') return '(N)'
  if (difficulty === 'hell') return '(H)'
  return ''
}

/**
 * A cell as a number.
 *
 * @param table - the table.
 * @param row - the row.
 * @param column - the column name.
 * @param fallback - value for a missing or non-numeric cell.
 * @returns the number.
 */
function num(table: D2Table, row: readonly string[], column: string, fallback = 0): number {
  const raw = cell(table, row, column).trim()
  if (raw === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

/**
 * A cell as a flag.
 *
 * The tables write `1` for true and leave false blank rather than writing `0`,
 * so anything non-empty and non-zero counts.
 *
 * @param table - the table.
 * @param row - the row.
 * @param column - the column name.
 * @returns whether the flag is set.
 */
function flag(table: D2Table, row: readonly string[], column: string): boolean {
  const raw = cell(table, row, column).trim()
  return raw !== '' && raw !== '0'
}

/** One physical or special attack, as the table describes it. */
export interface MonsterAttack {
  /** `A1MinD` — minimum damage. */
  readonly minDamage: number
  /** `A1MaxD` — maximum damage. */
  readonly maxDamage: number
  /** `A1TH` — attack rating, used by M9's to-hit formula. */
  readonly toHit: number
  /** Alias for `minDamage` in 1.13c data contract. */
  readonly min?: number | undefined
  /** Alias for `maxDamage` in 1.13c data contract. */
  readonly max?: number | undefined
  /** `A1Move` / `A2Move` / `S1Move`. */
  readonly move?: number | undefined
  /** Mode-bound missile (`MissA1` / `MissA2` / `MissS1`). */
  readonly missile?: string | undefined
}

/** The six damage types a monster resists, as percentages. */
export interface MonsterResistances {
  /** `ResDm` — physical. */
  readonly physical: number
  /** `ResMa` — magic. */
  readonly magic: number
  /** `ResFi` — fire. */
  readonly fire: number
  /** `ResLi` — lightning. */
  readonly lightning: number
  /** `ResCo` — cold. */
  readonly cold: number
  /** `ResPo` — poison. */
  readonly poison: number
  readonly [k: string]: number | undefined
}

/**
 * One row of `MonStats.txt` joined with `MonStats2.txt`.
 */
export interface MonsterKind {
  /** `Id` — the key every other table refers to it by. */
  readonly id: string
  /** `hcIdx` — 0-based `MonStats.txt` row index (`0..733`). */
  readonly hcIdx?: number | undefined
  /** `BaseId` — the family head; `fallen2` and `fallen3` both base on `fallen1`. */
  readonly baseId: string
  /** `NextInClass` — next monster ID in the same sub-family. */
  readonly nextInClass?: string | undefined
  /**
   * `NameStr` — a **`string.tbl` key**, not display text.
   */
  readonly nameKey: string
  /** `DescStr` — a `string.tbl` key for special monster ability subtext (e.g. `"raises Fallen"`), or `""`. */
  readonly descKey?: string
  /** `Code` — the two-letter token the art paths are built from, e.g. `FA`. */
  readonly code: string
  /** `MonType` — family, for immunities and skill counters (`MonType.txt`). */
  readonly monType: string
  /** `AI` — behaviour name (`MonAi.txt`). */
  readonly ai: string
  /** `MonAi.txt` row index (`0..147`). */
  readonly aiId?: number | undefined
  /** `enabled` — rows that are off are development leftovers. */
  readonly enabled: boolean
  /** `isSpawn` — whether the level populator may place it at all. */
  readonly isSpawn: boolean
  /**
   * `sparsePopulate` — percentage chance (0..100) this monster is allowed to spawn.
   * Blank means 100%. Per KB 360: controls overall spawn chance.
   */
  readonly sparsePopulate: number
  /** `isMelee` — melee rather than ranged. */
  readonly isMelee: boolean
  /** `rangedtype` — uses a missile attack. */
  readonly ranged: boolean
  /** Alias for `ranged`. */
  readonly isRanged?: boolean | undefined
  /** `npc` — a town character, never a wild spawn. */
  readonly npc: boolean
  /** `interact` — can be talked to. */
  readonly interact: boolean
  /** `inTown` — belongs in a town level. */
  readonly inTown: boolean
  /** `lUndead` or `hUndead` — whether this monster is Undead (`0x6FD62B50`). */
  readonly isUndead?: boolean
  /** `lUndead` — low undead (resurrectable). */
  readonly lUndead?: boolean | undefined
  readonly isLowUndead?: boolean | undefined
  /** `hUndead` — high undead / caster undead. */
  readonly hUndead?: boolean | undefined
  readonly isHighUndead?: boolean | undefined
  /** `demon` — whether this monster is a Demon (`0x6FD62BA0`). */
  readonly isDemon?: boolean
  /** Alias for `isDemon`. */
  readonly demon?: boolean | undefined
  /** `boss` — a boss, excluded from ordinary population (`isBoss` alias included for parity). */
  readonly boss: boolean
  readonly isBoss?: boolean
  /** `primeevil` — Act boss flag (+300% damage to Mercs/Pets). */
  readonly primeevil?: boolean | undefined
  /** Alias for `primeevil`. */
  readonly isPrimeEvil?: boolean | undefined
  /** `noRatio` — summons/pets/traps, excluded from ratio scaling and TC upgrading. */
  readonly noRatio?: boolean
  /** `killable` — some scenery that merely looks alive. */
  readonly killable: boolean
  /** Alias for `killable`. */
  readonly isKillable?: boolean | undefined
  /** `flying` — bypasses ground walkability obstacles. */
  readonly isFlying?: boolean | undefined
  readonly flying?: boolean | undefined
  /** `opendoors` — whether AI can open closed doors. */
  readonly canOpenDoors?: boolean | undefined
  readonly opendoors?: boolean | undefined
  /** `neverCount` — excluded from clear-area quest counters. */
  readonly neverCount?: boolean | undefined
  /** `petIgnore` — ignored by player pets/mercenaries unless directly targeted. */
  readonly petIgnore?: boolean | undefined
  /** `deathDmg` — triggers death explosion on `MONMODE_DEATH` (e.g. Bone Fetish). */
  readonly deathDmg?: boolean | undefined
  /**
   * `Rarity` — relative weight when the level picks which types to use.
   */
  readonly rarity: number
  /** `MinGrp` — smallest pack this monster appears in. */
  readonly minGroup: number
  readonly minGrp?: number | undefined
  /** `MaxGrp` — largest pack. */
  readonly maxGroup: number
  readonly maxGrp?: number | undefined
  /** `PartyMin` — minimum accompanying minion party count. */
  readonly partyMin?: number | undefined
  /** `PartyMax` — maximum accompanying minion party count. */
  readonly partyMax?: number | undefined
  /** `Level`, `Level(N)`, `Level(H)` — its level per difficulty. */
  readonly level: readonly [number, number, number]
  /** `Level`, `Level(N)`, `Level(H)` as `{ normal, nightmare, hell }`. */
  readonly baseLevel?: MonsterDifficultyStats<number> | undefined
  /** `Velocity` — walking speed, in the table's own units. */
  readonly velocity: number
  /** `Run` — running speed, same units. */
  readonly runVelocity: number
  /** `threat` — AI aggression weight. Almost always 10; not a radius. */
  readonly threat: number
  /** `aidel` — frame delay between AI decisions for active difficulty. */
  readonly aiDelay?: number | undefined
  /** `aidist` — AI engagement distance, in sub-tiles. Frequently 0. */
  readonly aiDistance: number
  /** Alias for `aiDistance` (`aidist` column). */
  readonly aiDist?: number | undefined
  /** Difficulty tier this `MonsterKind` was hydrated for (`normal`, `nightmare`, or `hell`). */
  readonly difficulty?: Difficulty | undefined
  /** `aip1..aip8` — AI parameters for active difficulty. */
  readonly aiParams?: readonly [number, number, number, number, number, number, number, number] | undefined
  /** `minHP` — lower bound of the health roll. */
  readonly minHp: number
  readonly minHpByDifficulty?: MonStats113cDifficultyVector | undefined
  /** `maxHP` — upper bound of the health roll. */
  readonly maxHp: number
  readonly maxHpByDifficulty?: MonStats113cDifficultyVector | undefined
  /** `AC` — defence, for M9's to-hit formula. */
  readonly armour: number
  readonly armor?: number | undefined
  readonly armourByDifficulty?: MonStats113cDifficultyVector | undefined
  /** `Exp` — experience awarded. */
  readonly experience: number
  readonly xp?: number | undefined
  readonly experienceByDifficulty?: MonStats113cDifficultyVector | undefined
  /** `A1*` — the primary attack. */
  readonly attack1: MonsterAttack
  /** `A2*` — the secondary attack. */
  readonly attack2: MonsterAttack
  /** `S1*` — the special attack (`S1MinD`, `S1MaxD`, `S1TH`). */
  readonly special1?: MonsterAttack | undefined
  readonly a1ByDifficulty?: MonStats113cAttackRow | undefined
  readonly a2ByDifficulty?: MonStats113cAttackRow | undefined
  readonly s1ByDifficulty?: MonStats113cAttackRow | undefined
  /** `El1..El3` — elemental attacks attached to `A1`/`A2`/`S1..S4`/`C`. */
  readonly elementalAttacks?: readonly MonsterElementalAttack[] | undefined
  /** `Skill1..Skill8` — monster skills with animation mode and base slvl. */
  readonly skills?: readonly MonsterSkillEntry[] | undefined
  /** `MissA1`, `MissA2`, `MissS1..S4`, `MissC`, `MissSQ` — mode-bound missiles. */
  readonly modeMissiles?: MonsterModeMissiles | undefined
  /** `ResDm`…`ResPo` for this difficulty. */
  readonly resistances: MonsterResistances
  /** `Drain` — life/mana steal effectiveness percentage. */
  readonly drain?: number | undefined
  /** `coldeffect` — chill slow percentage (typically negative). */
  readonly coldEffect?: number | undefined
  /** `DamageRegen` — health regeneration rate per frame. */
  readonly damageRegen?: number | undefined
  /** `ToBlock` — block percentage (`0..100`). */
  readonly toBlock?: number | undefined
  /** `Crit` — critical strike percentage (`0..100`). */
  readonly crit?: number | undefined
  /** `Align` — `0` evil/hostile, `1` aligned/friendly, `2` neutral. */
  readonly align?: 0 | 1 | 2 | undefined
  /** `TreasureClass1..4`, blanks dropped. Consumed by M10. */
  readonly treasureClasses: readonly string[]
  /**
   * Resolve TC for given difficulty and monster type (1=Normal, 2=Champion, 3=Unique, 4=Boss/Quest).
   */
  getTreasureClass?(difficulty?: Difficulty, monsterType?: number): string
  /** `minion1`, `minion2` — what spawns alongside it, blanks dropped. */
  readonly minions: readonly string[]
  /** `SetBoss` — the pack leader becomes a unique. */
  readonly setBoss: boolean
  /** `MeleeRng` — melee reach in sub-tiles from `MonStats.txt` / `MonStats2.txt`. */
  readonly meleeRange?: number
  readonly meleeRng?: number | undefined
  /** `SizeX` / `SizeY` — collision sub-tile footprint from `MonStats2.txt`. */
  readonly sizeX?: number | undefined
  readonly sizeY?: number | undefined
  readonly height?: number | undefined
  readonly overlayHeight?: number | undefined
  readonly pixHeight?: number | undefined
  readonly baseW?: string | undefined
  readonly hitClass?: number | undefined
}

/**
 * Resolves the TreasureClass name for a MonsterKind given difficulty and monster type.
 *
 * Monster types:
 * - 1: Normal monster -> TreasureClass1
 * - 2: Champion monster -> TreasureClass2 (fallback TreasureClass1)
 * - 3: Unique monster -> TreasureClass3 (fallback TreasureClass1)
 * - 4: Quest / Boss drop -> TreasureClass4 (fallback TreasureClass3, then TreasureClass1)
 *
 * @param kind - Monster definition.
 * @param difficulty - Difficulty level ('normal' | 'nightmare' | 'hell').
 * @param monsterType - Monster type code (1..4).
 * @returns TreasureClass name.
 */
export function getMonsterTreasureClass(
  kind: MonsterKind,
  difficulty: Difficulty = 'normal',
  monsterType = 1,
): string {
  if (typeof kind.getTreasureClass === 'function') {
    return kind.getTreasureClass(difficulty, monsterType)
  }
  return kind.treasureClasses[monsterType - 1] ?? kind.treasureClasses[0] ?? ''
}

const CANONICAL_113C_INTERACT_IDS: ReadonlySet<string> = new Set([
  'cain1', 'gheed', 'akara', 'kashya', 'charsi', 'warriv1', 'warriv2', 'atma', 'drognan', 'fara',
  'greiz', 'elzix', 'geglash', 'jerhyn', 'lysander', 'meshif1', 'cain2', 'cain3', 'cain4', 'tyrael1',
  'asheara', 'hratli', 'alkor', 'ormus', 'halbu', 'meshif2', 'cain5', 'navi', 'natalya', 'act2guard2',
  'tyrael2', 'act2guard4', 'act2guard5', 'jamella', 'izualghost', 'malachai', 'larzuk', 'drehya',
  'malah', 'nihlathak', 'qual-kehk', 'cain6', 'tyrael3', 'drehyaiced', 'ancientstatue1',
  'ancientstatue2', 'ancientstatue3',
])

const CANONICAL_113C_NPC_IDS: ReadonlySet<string> = CANONICAL_113C_INTERACT_IDS

/**
 * Read every row of `MonStats.txt`.
 *
 * Disabled rows are kept: `enabled` is exposed rather than filtered so a caller
 * that wants the whole table (a verification script counting coverage) and one
 * that wants spawnable monsters can both be served without a second parse.
 *
 * @param table - the parsed `MonStats.txt`.
 * @param difficulty - which difficulty's columns to read.
 * @returns the kinds, keyed by `Id`.
 */
export function readMonsterKinds(table: D2Table, difficulty: Difficulty = 'normal'): Map<string, MonsterKind> {
  const d = difficultySuffix(difficulty)
  const hasNpcCol = table.header.some(col => col.trim().toLowerCase() === 'npc')
  const hasInteractCol = table.header.some(col => col.trim().toLowerCase() === 'interact')
  const kinds = new Map<string, MonsterKind>()
  for (const row of table.rows) {
    const id = cell(table, row, 'Id').trim()
    if (id === '') continue
    const lowerId = id.toLowerCase()
    // `MinHP`/`MaxHP` are capitalised differently per difficulty in the real
    // file: `minHP` on normal, `MinHP(N)` and `MinHP(H)` after it. Reading the
    // wrong case silently yields 0, so both spellings are tried.
    const minHp = d === '' ? num(table, row, 'minHP') : num(table, row, `MinHP${d}`, num(table, row, `minHP${d}`))
    const maxHp = d === '' ? num(table, row, 'maxHP') : num(table, row, `MaxHP${d}`, num(table, row, `maxHP${d}`))

    const allTreasureClasses: Record<Difficulty, [string, string, string, string]> = {
      normal: [
        cell(table, row, 'TreasureClass1').trim(),
        cell(table, row, 'TreasureClass2').trim(),
        cell(table, row, 'TreasureClass3').trim(),
        cell(table, row, 'TreasureClass4').trim(),
      ],
      nightmare: [
        cell(table, row, 'TreasureClass1(N)').trim() || cell(table, row, 'TreasureClass(N)1').trim(),
        cell(table, row, 'TreasureClass2(N)').trim() || cell(table, row, 'TreasureClass(N)2').trim(),
        cell(table, row, 'TreasureClass3(N)').trim() || cell(table, row, 'TreasureClass(N)3').trim(),
        cell(table, row, 'TreasureClass4(N)').trim() || cell(table, row, 'TreasureClass(N)4').trim(),
      ],
      hell: [
        cell(table, row, 'TreasureClass1(H)').trim() || cell(table, row, 'TreasureClass(H)1').trim(),
        cell(table, row, 'TreasureClass2(H)').trim() || cell(table, row, 'TreasureClass(H)2').trim(),
        cell(table, row, 'TreasureClass3(H)').trim() || cell(table, row, 'TreasureClass(H)3').trim(),
        cell(table, row, 'TreasureClass4(H)').trim() || cell(table, row, 'TreasureClass(H)4').trim(),
      ],
    }

    const getTc = (diff: Difficulty = 'normal', mType = 1): string => {
      const tcForDiff = allTreasureClasses[diff] ?? allTreasureClasses.normal
      const normalTc = allTreasureClasses.normal
      if (mType === 4) {
        return tcForDiff[3] || tcForDiff[2] || tcForDiff[0] || normalTc[3] || normalTc[2] || normalTc[0] || ''
      }
      if (mType === 3) {
        return tcForDiff[2] || tcForDiff[0] || normalTc[2] || normalTc[0] || ''
      }
      if (mType === 2) {
        return tcForDiff[1] || tcForDiff[0] || normalTc[1] || normalTc[0] || ''
      }
      return tcForDiff[0] || normalTc[0] || ''
    }

    const isBoss = flag(table, row, 'boss')
    const isUndead = flag(table, row, 'lUndead') || flag(table, row, 'hUndead')
    const isDemon = flag(table, row, 'demon')
    const rawDescStr = cell(table, row, 'DescStr').trim()
    const descKey = rawDescStr.toLowerCase() === 'dummy' ? '' : rawDescStr

    const kind: MonsterKind = {
      id,
      baseId: cell(table, row, 'BaseId').trim() || id,
      nameKey: cell(table, row, 'NameStr').trim(),
      descKey,
      code: cell(table, row, 'Code').trim(),
      monType: cell(table, row, 'MonType').trim(),
      ai: cell(table, row, 'AI').trim(),
      enabled: flag(table, row, 'enabled'),
      isSpawn: flag(table, row, 'isSpawn'),
      sparsePopulate: num(table, row, 'sparsePopulate', 100),
      isMelee: flag(table, row, 'isMelee'),
      ranged: flag(table, row, 'rangedtype'),
      npc: hasNpcCol ? flag(table, row, 'npc') : CANONICAL_113C_NPC_IDS.has(lowerId),
      interact: hasInteractCol ? flag(table, row, 'interact') : CANONICAL_113C_INTERACT_IDS.has(lowerId),
      inTown: flag(table, row, 'inTown'),
      isUndead,
      isDemon,
      boss: isBoss,
      isBoss,
      ...(flag(table, row, 'noRatio') ? { noRatio: true } : {}),
      killable: flag(table, row, 'killable'),
      rarity: num(table, row, 'Rarity', 1),
      minGroup: num(table, row, 'MinGrp', 1),
      maxGroup: num(table, row, 'MaxGrp', 1),
      level: [num(table, row, 'Level'), num(table, row, 'Level(N)'), num(table, row, 'Level(H)')],
      velocity: num(table, row, 'Velocity'),
      runVelocity: num(table, row, 'Run'),
      threat: num(table, row, 'threat'),
      aiDistance: num(table, row, `aidist${d}`, num(table, row, 'aidist')),
      minHp,
      maxHp,
      armour: num(table, row, `AC${d}`),
      experience: num(table, row, `Exp${d}`),
      attack1: {
        minDamage: num(table, row, `A1MinD${d}`),
        maxDamage: num(table, row, `A1MaxD${d}`),
        toHit: num(table, row, `A1TH${d}`),
      },
      attack2: {
        minDamage: num(table, row, `A2MinD${d}`),
        maxDamage: num(table, row, `A2MaxD${d}`),
        toHit: num(table, row, `A2TH${d}`),
      },
      resistances: {
        physical: num(table, row, `ResDm${d}`),
        magic: num(table, row, `ResMa${d}`),
        fire: num(table, row, `ResFi${d}`),
        lightning: num(table, row, `ResLi${d}`),
        cold: num(table, row, `ResCo${d}`),
        poison: num(table, row, `ResPo${d}`),
      },
      treasureClasses: ['TreasureClass1', 'TreasureClass2', 'TreasureClass3', 'TreasureClass4']
        .map(name => cell(table, row, `${name}${d}`).trim())
        .filter(value => value !== ''),
      minions: ['minion1', 'minion2']
        .map(name => cell(table, row, name).trim())
        .filter(value => value !== ''),
      setBoss: flag(table, row, 'SetBoss'),
    }

    Object.defineProperty(kind, 'getTreasureClass', {
      value: getTc,
      enumerable: false,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(kind, 'difficulty', {
      value: difficulty,
      enumerable: false,
      configurable: true,
      writable: true,
    })

    kinds.set(id, kind)
  }
  return kinds
}

/**
 * The body and animation facts one monster's art needs, from `MonStats2.txt`.
 *
 * Only the fields that affect placement and drawing are read. The COF layer
 * composition lives here too, but as a count rather than as the layer list —
 * picking which of the sixteen layer columns are live is the art pass's job,
 * not the data reader's.
 */
export interface MonsterArt {
  /** Which `MonStats2.txt` row this came from; not always the monster's own id. */
  readonly rowId: string
  /** `SizeX`/`SizeY` — body footprint in sub-tiles. A Fallen is 2×2. */
  readonly sizeX: number
  readonly sizeY: number
  /** `pixHeight` — sprite height in pixels, for the selection box. */
  readonly pixelHeight: number
  /** `MeleeRng` — melee reach in sub-tiles. Usually 0, meaning "touching". */
  readonly meleeRange: number
  /** `BaseW` — the default weapon class token, e.g. `hth`. */
  readonly weaponClass: string
  /** `TotalPieces` — how many COF layers compose this monster. */
  readonly totalPieces: number
  /** `dDT`…`dRN` — how many directions the death animation has; 8 for most. */
  readonly directions: number
}

/**
 * Read `MonStats2.txt`, resolving each monster through `BaseId` when it has no
 * row of its own.
 *
 * 735 monsters share 610 art rows. The extras are the numbered difficulty
 * variants — `quillrat6`, `slinger7`, `deathmauler6` and 57 others — which the
 * game draws with their family's art: `quillrat6` has no row, `quillrat1` does,
 * and `quillrat6.BaseId` is `quillrat1`. Looking up by id alone leaves those 60
 * monsters invisible, which is exactly the kind of failure that shows up as an
 * empty patch of ground rather than as an error.
 *
 * @param table - the parsed `MonStats2.txt`.
 * @param kinds - the monsters, for the `BaseId` fallback.
 * @returns art keyed by monster id, with an entry for every kind that resolves.
 */
export function readMonsterArt(table: D2Table, kinds: ReadonlyMap<string, MonsterKind>): Map<string, MonsterArt> {
  const byRowId = new Map<string, readonly string[]>()
  for (const row of table.rows) {
    const id = cell(table, row, 'Id').trim()
    if (id !== '') byRowId.set(id, row)
  }
  const art = new Map<string, MonsterArt>()
  for (const kind of kinds.values()) {
    const rowId = byRowId.has(kind.id) ? kind.id : (byRowId.has(kind.baseId) ? kind.baseId : '')
    if (rowId === '') continue
    const row = byRowId.get(rowId)!
    art.set(kind.id, {
      rowId,
      sizeX: num(table, row, 'SizeX', 1),
      sizeY: num(table, row, 'SizeY', 1),
      pixelHeight: num(table, row, 'pixHeight'),
      meleeRange: num(table, row, 'MeleeRng'),
      weaponClass: cell(table, row, 'BaseW').trim(),
      totalPieces: num(table, row, 'TotalPieces'),
      // `dDT` is the death animation's direction count. Every other mode has
      // its own column, but they agree in the shipped data, and death is the
      // one mode every monster has.
      directions: num(table, row, 'dDT', 8),
    })
  }
  return art
}

/**
 * The five multipliers `MonLvl.txt` holds for one monster level.
 *
 * Each is a percentage applied to the matching `MonStats.txt` column. Level 1
 * is `AC 6, TH 8, HP 7, DM 2, XP 30`, which is why a Fallen's 84 defence in the
 * table is a defence of 5 on the ground.
 */
export interface MonsterScale {
  /** `AC` — multiplies `MonStats.AC`. */
  readonly armour: number
  /** `TH` — multiplies the attacks' `TH` columns. */
  readonly toHit: number
  /** `HP` — multiplies `minHP`/`maxHP`. */
  readonly health: number
  /** `DM` — multiplies the attacks' `MinD`/`MaxD` columns. */
  readonly damage: number
  /** `XP` — multiplies `Exp`. */
  readonly experience: number
}

/**
 * Read `MonLvl.txt` for one difficulty.
 *
 * `MonLvl.txt` carries each multiplier twice: a plain set and an `L-` prefixed
 * one. They are not two versions of the same number — per the file's own guide,
 * *"all L-XX columns is used for ladder/single player and tcp-ip"*, and the
 * plain set is closed Battle.net's. This project is single-player, so the `L-`
 * set is the correct one to read. Throughout 1.13c the two are byte-identical,
 * so nothing changes numerically today; reading the right one means nothing
 * changes silently if a mod ever makes them differ.
 *
 * @param table - the parsed `MonLvl.txt`.
 * @param difficulty - which difficulty's columns to read.
 * @returns the multipliers, keyed by monster level.
 */
export function readMonsterScaling(table: D2Table, difficulty: Difficulty = 'normal'): Map<number, MonsterScale> {
  const d = difficultySuffix(difficulty)
  const scales = new Map<number, MonsterScale>()
  /** The `L-` column, falling back to the plain one when a file lacks it. */
  const single = (row: readonly string[], name: string): number =>
    num(table, row, `L-${name}${d}`, num(table, row, `${name}${d}`))
  for (const row of table.rows) {
    const level = num(table, row, 'Level', -1)
    if (level < 0) continue
    scales.set(level, {
      armour: single(row, 'AC'),
      toHit: single(row, 'TH'),
      health: single(row, 'HP'),
      damage: single(row, 'DM'),
      experience: single(row, 'XP'),
    })
  }
  return scales
}

/** No scaling: every column passes through unchanged. */
export const UNSCALED: MonsterScale = { armour: 100, toHit: 100, health: 100, damage: 100, experience: 100 }

/**
 * The level a monster is actually scaled at.
 *
 * This is the part that is easy to get wrong, because `MonStats.txt` has three
 * `Level` columns and only the first of them is generally used. Per the file's
 * guide: *"This setting is only used on normal. On nightmare and hell the
 * monsters level is identical with the area level from Levels.txt, unless your
 * monster has BOSS column set to 1, in this case its level will be always taken
 * from these 3 columns."*
 *
 * So there are two rules, not one:
 *
 * - **Normal**, and **bosses on any difficulty**: the monster's own `Level`,
 *   `Level(N)` or `Level(H)`.
 * - **Everyone else on Nightmare and Hell**: the *area's* level, which is
 *   {@link LevelMonsterPlan.monsterLevel} — `Levels.txt`'s `MonLvl2Ex` and
 *   `MonLvl3Ex`. A Fallen in the Blood Moor and a Fallen in the Catacombs are
 *   not the same monster on Hell, and that is where the difference lives.
 *
 * Reading `Level(N)` for an ordinary monster gives a Hell Fallen the level of
 * the hardest place a Fallen appears no matter where it is standing, which is
 * wrong everywhere except that one place.
 *
 * @param kind - the monster.
 * @param difficulty - which difficulty.
 * @param areaLevel - the level's own monster level, ignored on Normal and for bosses.
 * @returns the level to look the multipliers up at.
 */
export function monsterLevelFor(kind: MonsterKind, difficulty: Difficulty, areaLevel: number): number {
  const tier = difficulty === 'normal' ? 0 : difficulty === 'nightmare' ? 1 : 2
  const maxCap = kind.level[tier] > 99 ? 110 : 99
  if (difficulty === 'normal' || kind.boss || kind.noRatio) {
    return Math.min(maxCap, Math.max(1, kind.level[tier]))
  }
  const baseLevel = areaLevel > 0 ? areaLevel : kind.level[tier]
  return Math.min(maxCap, Math.max(1, baseLevel))
}

/**
 * Whether a missing `MonLvl.txt` row is fatal.
 *
 * Off by default, because a hand-built fixture legitimately ships a two-row
 * table. Turn it on in a bake or a verification script, where a missing row is a
 * broken input rather than a deliberately small one.
 */
let scalingStrict = false

/**
 * Levels already warned about, so one missing row is one line and not one line
 * per monster rolled at that level.
 */
const warnedScaleLevels = new Set<number>()

/**
 * Make a missing `MonLvl.txt` row throw instead of warn.
 *
 * @param strict - true to throw.
 */
export function setMonsterScalingStrict(strict: boolean): void {
  scalingStrict = strict
  if (!strict) warnedScaleLevels.clear()
}


/** A scale lookup that says whether it found a row. */
export interface MonsterScaleLookup {
  readonly scale: MonsterScale
  /** True when the level had no `MonLvl.txt` row and {@link UNSCALED} was used. */
  readonly missing: boolean
}

/**
 * The multipliers for a level, with the miss reported rather than hidden.
 *
 * The caller needs this distinction because of what {@link UNSCALED} means: the
 * formula is `raw × scale ÷ 100`, so falling back to 100 across the board uses
 * the *raw table values* as game values. A Fallen then arrives with `MonStats`'
 * 21–61 HP instead of the ~3 HP the level-1 row scales it down to, which reads
 * as a balance problem and is in fact a missing row.
 *
 * @param scaling - the table, from {@link readMonsterScaling}.
 * @param level - the level, from {@link monsterLevelFor}.
 * @returns the scale and whether the row was missing.
 */
export function monsterScaleLookup(scaling: ReadonlyMap<number, MonsterScale>, level: number): MonsterScaleLookup {
  const found = scaling.get(level)
  if (found !== undefined) return { scale: found, missing: false }
  return { scale: UNSCALED, missing: true }
}

/**
 * The multipliers for a level.
 *
 * A level with no row used to return {@link UNSCALED} silently; it now warns
 * once per level, and throws when {@link setMonsterScalingStrict} is on. Callers
 * that need to react rather than read the console use {@link monsterScaleLookup}.
 *
 * @param scaling - the table, from {@link readMonsterScaling}.
 * @param level - the level, from {@link monsterLevelFor}.
 * @returns the scale, or {@link UNSCALED} when the level has no row.
 * @throws when strict mode is on and the level has no row.
 */
export function monsterScaleFor(scaling: ReadonlyMap<number, MonsterScale>, level: number): MonsterScale {
  const lookup = monsterScaleLookup(scaling, level)
  if (!lookup.missing) return lookup.scale
  const message = `MonLvl.txt has no row for level ${String(level)}: `
    + `monsters there keep their raw MonStats values (about 20x too strong)`
  if (scalingStrict) throw new Error(message)
  if (!warnedScaleLevels.has(level)) {
    warnedScaleLevels.add(level)
    console.warn(message)
  }
  return lookup.scale
}

/** What `Levels.txt` says should live on one level. */
export interface LevelMonsterPlan {
  /** `Id`. */
  readonly levelId: number
  /** `Name`. */
  readonly levelName: string
  /**
   * `MonDen` — spawn density.
   *
   * The real generator consumes this per room. Blood Moor is 520, a cave 600,
   * the Cow Level 800, a town 0. Zero means "populate nothing", which is the
   * one part of its meaning that needs no interpretation.
   */
  readonly density: number
  /** `MonUMin` — fewest elite packs. */
  readonly eliteMin: number
  /** `MonUMax` — most elite packs. */
  readonly eliteMax: number
  /** `NumMon` — how many *distinct types* are drawn from the pool. */
  readonly typeCount: number
  /** `mon1`…`mon10`, blanks dropped: the classic-game pool. */
  readonly pool: readonly string[]
  /** `nmon1`…`nmon10`: the pool on Nightmare and Hell. */
  readonly nightmarePool: readonly string[]
  /** `umon1`…`umon10`: the pool elite packs are drawn from. */
  readonly elitePool: readonly string[]
  /** `MonLvl1`/`MonLvl1Ex` etc. — the level monsters here are treated as. */
  readonly monsterLevel: number
  /** `MonWndr` — whether wandering monsters are allowed. */
  readonly wander: boolean
}

/**
 * Collect the `mon1`…`mon10`-style columns of one row.
 *
 * @param table - `Levels.txt`.
 * @param row - the level's row.
 * @param prefix - `mon`, `nmon` or `umon`.
 * @returns the non-empty entries, in column order.
 */
export function monsterColumns(table: D2Table, row: readonly string[], prefix: string): string[] {
  const out: string[] = []
  for (let slot = 1; slot <= 25; slot += 1) {
    const col = `${prefix}${String(slot)}`
    if (!table.header.includes(col)) break
    const value = cell(table, row, col).trim()
    if (value !== '') out.push(value)
  }
  return out
}

/**
 * Read one level's monster columns.
 *
 * @param table - the parsed `Levels.txt`.
 * @param levelId - the `Id` to look up.
 * @param difficulty - which difficulty's density and elite counts to read.
 * @param expansion - read the `…Ex` monster-level columns, as the expansion does.
 * @returns the plan, or null when the level has no row.
 */
export function readLevelMonsterPlan(
  table: D2Table,
  levelId: number,
  difficulty: Difficulty = 'normal',
  expansion = true,
): LevelMonsterPlan | null {
  const row = table.rows.find(candidate => num(table, candidate, 'Id', -1) === levelId)
  if (row === undefined) return null
  const d = difficultySuffix(difficulty)
  const tier = difficulty === 'normal' ? 1 : difficulty === 'nightmare' ? 2 : 3
  const levelColumn = `MonLvl${String(tier)}${expansion ? 'Ex' : ''}`
  return {
    levelId,
    levelName: cell(table, row, 'Name').trim(),
    density: num(table, row, `MonDen${d}`),
    eliteMin: num(table, row, `MonUMin${d}`),
    eliteMax: num(table, row, `MonUMax${d}`),
    typeCount: num(table, row, 'NumMon'),
    pool: monsterColumns(table, row, 'mon'),
    nightmarePool: monsterColumns(table, row, 'nmon'),
    elitePool: monsterColumns(table, row, 'umon'),
    monsterLevel: num(table, row, levelColumn, num(table, row, `MonLvl${String(tier)}`)),
    wander: flag(table, row, 'MonWndr'),
  }
}

/** One row of `SuperUniques.txt` — a named boss with a fixed spawn. */
export interface SuperUnique {
  /** `Superunique` — the key. */
  readonly id: string
  /** 0-based `SuperUniques.txt` index (`0..65`). */
  readonly index?: number | undefined
  readonly hcIdx?: number | undefined
  /** `Name` — a `string.tbl` key, like {@link MonsterKind.nameKey}. */
  readonly nameKey: string
  readonly name?: string | undefined
  /** `Class` — which `MonStats.txt` row it is built from. */
  readonly monsterId: string
  readonly classId?: string | undefined
  readonly monSound?: string | undefined
  /** `Mod1`…`Mod3` — `MonUMod.txt` ids, blanks and zeroes dropped. */
  readonly modifiers: readonly number[]
  readonly mods?: readonly number[] | undefined
  /** `MinGrp`/`MaxGrp` — how many minions accompany it. */
  readonly minMinions: number
  readonly maxMinions: number
  readonly minGrp?: number | undefined
  readonly maxGrp?: number | undefined
  /** `EClass` — 0 normal, 1 champion-grade, 2 unique-grade. */
  readonly enhancementClass: number
  readonly eClass?: number | undefined
  /** `AutoPos` — whether the generator may move it to a legal spot. */
  readonly autoPosition: boolean
  readonly autoPos?: boolean | undefined
  /** `Stacks` — several may occupy the same spot. */
  readonly stacks: boolean
  /** `Replaceable` — another super unique may take its place. */
  readonly replaceable: boolean
  readonly uTrans?: MonStats113cDifficultyVector | undefined
  /** `TC` for this difficulty. Consumed by M10. */
  readonly treasureClass: string
  readonly tc?: SuperUnique113cTc | undefined
  /**
   * Difficulty-aware TreasureClass resolution for SuperUniques.
   */
  getTreasureClass?(difficulty?: Difficulty): string
}

/**
 * Read `SuperUniques.txt`.
 *
 * The table carries **no level column**: where each one spawns is decided by
 * the level generator, which places a "super unique" marker and then picks from
 * the ones legal for that area. Reproducing that placement needs the DRLG room
 * layout and is part of M8 — until then this is a lookup table, not a spawner.
 *
 * @param table - the parsed `SuperUniques.txt`.
 * @param difficulty - which difficulty's treasure class to read.
 * @returns the entries, in file order.
 */
export function readSuperUniques(table: D2Table, difficulty: Difficulty = 'normal'): SuperUnique[] {
  const d = difficultySuffix(difficulty)
  const out: SuperUnique[] = []
  for (const row of table.rows) {
    const id = cell(table, row, 'Superunique').trim()
    const monsterId = cell(table, row, 'Class').trim()
    // `Expansion` is a section divider: it fills in the name column and leaves
    // every other column blank. Keeping it would hand the spawner an entry with
    // no monster behind it.
    if (id === '' || monsterId === '') continue
    const tcsByDiff: Record<Difficulty, string> = {
      normal: cell(table, row, 'TC').trim(),
      nightmare: cell(table, row, 'TC(N)').trim() || cell(table, row, 'TC').trim(),
      hell: cell(table, row, 'TC(H)').trim() || cell(table, row, 'TC(N)').trim() || cell(table, row, 'TC').trim(),
    }
    const getTc = (diff: Difficulty = 'normal'): string => tcsByDiff[diff] ?? tcsByDiff.normal
    const su: SuperUnique = {
      id,
      nameKey: cell(table, row, 'Name').trim(),
      monsterId,
      modifiers: ['Mod1', 'Mod2', 'Mod3']
        .map(name => num(table, row, name))
        .filter(value => value > 0),
      minMinions: num(table, row, 'MinGrp'),
      maxMinions: num(table, row, 'MaxGrp'),
      enhancementClass: num(table, row, 'EClass'),
      autoPosition: flag(table, row, 'AutoPos'),
      stacks: flag(table, row, 'Stacks'),
      replaceable: flag(table, row, 'Replaceable'),
      treasureClass: cell(table, row, `TC${d}`).trim() || tcsByDiff[difficulty] || '',
    }
    Object.defineProperty(su, 'getTreasureClass', {
      value: getTc,
      enumerable: false,
      configurable: true,
      writable: true,
    })
    out.push(su)
  }
  return out
}

/** One row of `MonUMod.txt` — an affix an elite monster can carry. */
export interface EliteModifier {
  /** `uniquemod` — the name, e.g. `strong`, `fast`, `coldenchant`. */
  readonly name: string
  /** `id` — the number `SuperUniques.txt` refers to it by. */
  readonly id: number
  /** `enabled`. */
  readonly enabled: boolean
  /** `champion` — may appear on champion packs, not only on uniques. */
  readonly champion: boolean
  /** `exclude1`/`exclude2` — modifiers it cannot be combined with. */
  readonly excludes: readonly string[]
}

/**
 * Read `MonUMod.txt`.
 *
 * @param table - the parsed `MonUMod.txt`.
 * @returns the modifiers, in file order.
 */
export function readEliteModifiers(table: D2Table): EliteModifier[] {
  const out: EliteModifier[] = []
  for (const row of table.rows) {
    const name = cell(table, row, 'uniquemod').trim()
    if (name === '' || name === 'none') continue
    out.push({
      name,
      id: num(table, row, 'id'),
      enabled: flag(table, row, 'enabled'),
      champion: flag(table, row, 'champion'),
      excludes: ['exclude1', 'exclude2']
        .map(column => cell(table, row, column).trim())
        .filter(value => value !== ''),
    })
  }
  return out
}

/**
 * Read the parameters table embedded in `MonUMod.txt`.
 *
 * The last two columns of `MonUMod.txt` ('constants' and '*constant desc') form
 * a parameters table controlling general properties of champions, uniques, and minions.
 *
 * @param table - the parsed `MonUMod.txt`.
 * @returns map of constant description to numeric value.
 */
export function readMonUModConstants(table: D2Table): Map<string, number> {
  const constants = new Map<string, number>()
  for (const row of table.rows) {
    const desc = cell(table, row, '*constant desc').trim()
    const val = num(table, row, 'constants', NaN)
    if (desc !== '' && !Number.isNaN(val)) {
      constants.set(desc, val)
    }
  }
  return constants
}

/** Canonical constants extracted from `MonUMod.txt` (rows 0..33 `[constants]`). */
export const MONUMOD_CONSTANTS = {
  championChance: 20,
  minionHpPct: 100,
  minionHpPctNightmare: 75,
  minionHpPctHell: 50,
  championHpPct: 200,
  championHpPctNightmare: 150,
  championHpPctHell: 100,
  uniqueHpPct: 300,
  uniqueHpPctNightmare: 200,
  uniqueHpPctHell: 100,
  championToHitPct: 75,
  championToHitPctNormal: 120,
  championToHitPctNightmare: 75,
  championToHitPctHell: 50,
  championDmgPct: 100,
  championDmgPctNightmare: 75,
  championDmgPctHell: 33,
  minionToHitPct: 50,
  uniqueToHitPct: 100,
  uniqueToHitPctNightmare: 75,
  uniqueToHitPctHell: 50,
  uniqueDmgPct: 100,
  uniqueDmgPctNightmare: 75,
  uniqueDmgPctHell: 33,
  minionDmgPct: 100,
  minionDmgPctNightmare: 75,
  minionDmgPctHell: 33,
  minionDmgPctStrong: 75,
  uniqueDmgPctStrong: 150,
} as const

export const MINION_MODIFIER = {
  rank: 'minion' as const,
  levelBonus: 3,
  hpBonusPct: { normal: 100, nightmare: 75, hell: 50 },
  dmgBonusPct: { normal: 100, nightmare: 75, hell: 33 },
  arBonusPct: { normal: 0, nightmare: 0, hell: 0 },
  hpMultiplier: { normal: 2.0, nightmare: 1.75, hell: 1.5 },
} as const

export const CHAMPION_MODIFIER = {
  rank: 'champion' as const,
  levelBonus: 2,
  hpBonusPct: { normal: 200, nightmare: 150, hell: 100 },
  dmgBonusPct: { normal: 100, nightmare: 75, hell: 33 },
  arBonusPct: { normal: 120, nightmare: 75, hell: 50 },
  hpMultiplier: { normal: 3.0, nightmare: 2.5, hell: 2.0 },
} as const

export const UNIQUE_MODIFIER = {
  rank: 'unique' as const,
  levelBonus: 3,
  hpBonusPct: { normal: 300, nightmare: 200, hell: 100 },
  dmgBonusPct: { normal: 100, nightmare: 75, hell: 33 },
  arBonusPct: { normal: 100, nightmare: 75, hell: 50 },
  hpMultiplier: { normal: 4.0, nightmare: 3.0, hell: 2.0 },
} as const

export type ChampionSubtype = 'champion' | 'ghostly' | 'fanatic' | 'possessed' | 'berserk'

export const MON_UMOD_TABLE: Readonly<Record<string, MonUMod113cRow>> = (() => {
  const out: Record<string, MonUMod113cRow> = {}
  for (const row of MONUMOD_113C_ROWS) {
    out[row.id] = row
    out[row.id.toLowerCase()] = row
    out[String(row.umodId)] = row
  }
  // Canonical snake_case aliases for 13 major unique affixes
  const aliases: Readonly<Record<string, number>> = {
    extra_strong: 5,
    extrastrong: 5,
    extra_fast: 6,
    extrafast: 6,
    cursed: 7,
    magic_resistant: 8,
    magicresistant: 8,
    fire_enchanted: 9,
    fireenchant: 9,
    fireenchanted: 9,
    lightning_enchanted: 17,
    lightenchant: 17,
    lightningenchanted: 17,
    cold_enchanted: 18,
    coldenchant: 18,
    coldenchanted: 18,
    mana_burn: 25,
    manaburn: 25,
    teleportation: 26,
    spectral_hit: 27,
    stone_skin: 28,
    multiple_shots: 29,
    aura_enchanted: 30,
    auraenchanted: 30,
  }
  for (const [alias, id] of Object.entries(aliases)) {
    const row = MONUMOD_113C_ROWS[id]
    if (row) {
      out[alias] = row
    }
  }
  return out
})()

/** What a monster is: ordinary, or promoted by the level generator. */
export type MonsterRank = 'normal' | 'champion' | 'unique' | 'minion' | 'boss'

/**
 * Canonical Champion-exclusive `MonUMod.txt` subtypes (`champion == 1`, `cpick == 1` across N/NM/H)
 * and their `.tbl` keys per `D2Game.dll` `0x6fc43ae0` and `D2Client.dll` `.rdata:0x6fb86d64`.
 */
export const CANONICAL_CHAMPION_MODIFIERS: readonly {
  readonly id: number
  readonly name: string
  readonly tblKey: string
  readonly label: string
  readonly labelZh: string
}[] = [
  { id: 16, name: 'champion', tblKey: 'Champion', label: 'Champion', labelZh: '頭目' },
  { id: 36, name: 'ghostly', tblKey: 'champghostlyX', label: 'Ghostly', labelZh: '幽靈的' },
  { id: 37, name: 'fanatic', tblKey: 'champfanaticX', label: 'Fanatic', labelZh: '狂信者' },
  { id: 38, name: 'possessed', tblKey: 'champpossessedX', label: 'Possessed', labelZh: '著魔者' },
  { id: 39, name: 'berserk', tblKey: 'champberserkX', label: 'Berserker', labelZh: '狂戰士' },
]

/** Canonical Unique monster elite modifiers from `MonUMod.txt` with 1.13c `.tbl` keys (`3205..3218`). */
export const CANONICAL_ELITE_MODIFIERS: readonly {
  readonly id: number
  readonly name: string
  readonly tblKey: string
  readonly label: string
  readonly labelZh: string
  readonly champion: boolean
}[] = [
  { id: 5, name: 'strong', tblKey: 'uniquextrastrong', label: 'Extra Strong', labelZh: '特别强壮', champion: false },
  { id: 6, name: 'fast', tblKey: 'uniqueextrafast', label: 'Extra Fast', labelZh: '特别快速', champion: false },
  { id: 7, name: 'cursed', tblKey: 'uniquecursed', label: 'Cursed', labelZh: '特别诅咒', champion: false },
  { id: 8, name: 'magicresistant', tblKey: 'uniquemagicresistance', label: 'Magic Resistant', labelZh: '魔法抵抗', champion: false },
  { id: 9, name: 'fireenchant', tblKey: 'uniquefireenchanted', label: 'Fire Enchanted', labelZh: '火焰强化', champion: false },
  { id: 17, name: 'lightenchant', tblKey: 'monsteruniqueprop2', label: 'Lightning Enchanted', labelZh: '闪电强化', champion: false },
  { id: 18, name: 'coldenchant', tblKey: 'monsteruniqueprop1', label: 'Cold Enchanted', labelZh: '冰冷强化', champion: false },
  { id: 25, name: 'manahit', tblKey: 'monsteruniqueprop3', label: 'Mana Burn', labelZh: '法力燃烧', champion: false },
  { id: 26, name: 'teleport', tblKey: 'monsteruniqueprop5', label: 'Teleportation', labelZh: '传送', champion: false },
  { id: 27, name: 'spectralhit', tblKey: 'monsteruniqueprop4', label: 'Spectral Hit', labelZh: '幽灵一击', champion: false },
  { id: 28, name: 'stoneskin', tblKey: 'monsteruniqueprop6', label: 'Stone Skin', labelZh: '石头皮肤', champion: false },
  { id: 29, name: 'multishot', tblKey: 'monsteruniqueprop7', label: 'Multiple Shots', labelZh: '多重射击', champion: false },
  { id: 30, name: 'aura', tblKey: 'monsteruniqueprop9', label: 'Aura Enchanted', labelZh: '灵气强化', champion: false },
]

/**
 * Formats an elite modifier code or label (`strong`, `Extra Strong`, `possessed`, etc.) in the active language.
 */
export function formatEliteAffixLabel(modNameOrLabel: string, lang: TblLang = getTblLang()): string {
  const lower = modNameOrLabel.trim().toLowerCase()
  const champEntry = CANONICAL_CHAMPION_MODIFIERS.find(
    m =>
      String(m.id) === lower ||
      m.name.toLowerCase() === lower ||
      m.tblKey.toLowerCase() === lower ||
      m.label.toLowerCase() === lower ||
      m.labelZh === modNameOrLabel.trim(),
  )
  if (champEntry) {
    return lang === 'ENG' ? champEntry.label : champEntry.labelZh
  }
  const entry = CANONICAL_ELITE_MODIFIERS.find(
    m => m.name.toLowerCase() === lower || m.label.toLowerCase() === lower || m.labelZh === modNameOrLabel.trim(),
  )
  if (entry) {
    return lang === 'ENG' ? entry.label : entry.labelZh
  }
  const tblVal = lookupTbl(modNameOrLabel.trim(), lang)
  if (tblVal) return tblVal
  return modNameOrLabel
}


const SUPERUNIQUE_TBL_ALIASES: Readonly<
  Record<string, { readonly tblKey?: string; readonly zh: string; readonly en: string }>
> = {
  'Blood Raven': { tblKey: 'Bloodraven', zh: '血鳥', en: 'Blood Raven' },
  'Creeping Feature': { tblKey: 'Leatherarm', zh: '爬行的容貌', en: 'Creeping Feature' },
  'Sszark the Burning': { zh: '火焰之河斯扎克', en: 'Sszark the Burning' },
  'Battlemaid Sarina': { tblKey: 'Sarina the Battlemaid', zh: '戰場處女沙莉娜', en: 'Battlemaid Sarina' },
  'Hephasto the Armorer': { tblKey: 'The Feature Creep', zh: '海法斯特盔甲製作者', en: 'Hephasto The Armorer' },
  'Hephasto The Armorer': { tblKey: 'The Feature Creep', zh: '海法斯特盔甲製作者', en: 'Hephasto The Armorer' },
  'Shenk the Overseer': { tblKey: 'Siege Boss', zh: '督軍山克', en: 'Shenk the Overseer' },
  'Siege Boss': { tblKey: 'Siege Boss', zh: '督軍山克', en: 'Shenk the Overseer' },
  'Eldritch the Rectifier': { tblKey: 'Megaflow Rectifier', zh: '矯正者怪異', en: 'Eldritch the Rectifier' },
  'Sharptooth Slayer': { tblKey: 'Sharp Tooth Sayer', zh: '利齒殺手', en: 'Sharptooth Slayer' },
  'Eyeback the Unleashed': { tblKey: 'Eyeback Unleashed', zh: '狂暴者眼魔', en: 'Eyeback the Unleashed' },
  'Thresh Socket': { tblKey: 'Threash Socket', zh: '剝殼凹槽', en: 'Thresh Socket' },
  'Threash Socket': { tblKey: 'Threash Socket', zh: '剝殼凹槽', en: 'Thresh Socket' },
  'Talic': { tblKey: 'Ancient Barbarian 1', zh: '塔力克', en: 'Talic' },
  'Madawc': { tblKey: 'Ancient Barbarian 2', zh: '馬道克', en: 'Madawc' },
  'Korlic': { tblKey: 'Ancient Barbarian 3', zh: '科力克', en: 'Korlic' },
  'Nihlathak': { tblKey: 'Nihlathak', zh: '尼拉塞克', en: 'Nihlathak' },
  'Nihlathak Boss': { tblKey: 'Nihlathak', zh: '尼拉塞克', en: 'Nihlathak' },
  'Colenzo the Annihilator': { tblKey: 'Baal Subject 1', zh: '毀滅者卡蘭索', en: 'Colenzo the Annihilator' },
  'Achmel the Cursed': { tblKey: 'Baal Subject 2', zh: '被詛咒的阿克姆', en: 'Achmel the Cursed' },
  'Bartuc the Bloody': { tblKey: 'Baal Subject 3', zh: '血腥巴特克', en: 'Bartuc the Bloody' },
  'Ventar the Unholy': { tblKey: 'Baal Subject 4', zh: '不潔者凡塔', en: 'Ventar the Unholy' },
  'Lister the Tormentor': { tblKey: 'Baal Subject 5', zh: '折磨者利斯特', en: 'Lister the Tormentor' },
}

/**
 * Resolves a monster's localized display name from `.tbl` (`MonStats.txt` `NameStr` / `SuperUniques.txt` `Name`).
 */
export function monsterDisplayName(
  statsOrName: { readonly id?: string; readonly name?: string; readonly nameZh?: string; readonly superUniqueId?: string } | string,
  langOrFallback?: TblLang | string,
  explicitLang?: TblLang,
): string {
  const isLangArg =
    typeof langOrFallback === 'string' &&
    ['eng', 'chi', 'en', 'zh'].includes(langOrFallback.trim().toLowerCase())
  const lang: TblLang = explicitLang
    ? explicitLang
    : isLangArg
      ? (langOrFallback!.trim().toLowerCase().startsWith('e') ? 'ENG' : 'CHI')
      : getTblLang()
  const fallbackName = !isLangArg && typeof langOrFallback === 'string' ? langOrFallback.trim() : undefined

  if (typeof statsOrName === 'string') {
    const trimmed = statsOrName.trim()
    const fromTbl = lookupTbl(trimmed, lang)
    if (fromTbl) return fromTbl
    if (fallbackName) {
      const fromFallback = lookupTbl(fallbackName, lang)
      if (fromFallback) return fromFallback
    }
    const alias = SUPERUNIQUE_TBL_ALIASES[trimmed] ?? (fallbackName ? SUPERUNIQUE_TBL_ALIASES[fallbackName] : undefined)
    if (alias) {
      if (alias.tblKey) {
        const fromAlias = lookupTbl(alias.tblKey, lang)
        if (fromAlias) return fromAlias
      }
      return lang === 'ENG' ? alias.en : alias.zh
    }
    const strippedNum = trimmed.replace(/\d+$/, '')
    if (strippedNum && strippedNum !== trimmed) {
      const fromStripped = lookupTbl(strippedNum, lang)
      if (fromStripped) return fromStripped
    }
    return fallbackName || trimmed
  }
  if (lang === 'CHI' && statsOrName.nameZh) {
    return statsOrName.nameZh
  }
  const candidates = [
    statsOrName.superUniqueId,
    statsOrName.name,
    statsOrName.id,
    statsOrName.id?.replace(/\d+$/, ''),
  ].filter((c): c is string => Boolean(c && c.trim().length > 0))
  for (const key of candidates) {
    const trimmed = key.trim()
    const val = lookupTbl(trimmed, lang)
    if (val) return val
    const alias = SUPERUNIQUE_TBL_ALIASES[trimmed]
    if (alias) {
      if (alias.tblKey) {
        const fromAlias = lookupTbl(alias.tblKey, lang)
        if (fromAlias) return fromAlias
      }
      return lang === 'ENG' ? alias.en : alias.zh
    }
  }
  return statsOrName.name || statsOrName.id || 'Monster'
}

/**
 * Roll elite modifiers (`MonUMod.txt`) for a champion or unique pack.
 * - Champion (`D2Game.dll` `0x6fc43ae0`): rolls 1 subtype from `MonUMod.txt` rows with `champion == 1` (`16, 36..39`, `cpick == 1`).
 * - Unique: rolls 1..2 modifiers from `CANONICAL_ELITE_MODIFIERS`.
 */
export function rollEliteModifiers(
  rank: Exclude<MonsterRank, 'minion'>,
  rng: Rng,
): readonly string[] {
  if (rank === 'normal' || rank === 'boss') return []
  if (rank === 'champion') {
    return [CANONICAL_CHAMPION_MODIFIERS[rng.int(0, CANONICAL_CHAMPION_MODIFIERS.length - 1)]!.name]
  }
  const count = rng.int(1, 2)
  const chosen: string[] = []
  const pool = [...CANONICAL_ELITE_MODIFIERS]
  while (chosen.length < count && pool.length > 0) {
    const idx = rng.int(0, pool.length - 1)
    chosen.push(pool[idx]!.name)
    pool.splice(idx, 1)
  }
  return chosen
}

/**
 * Difficulty-dependent elite health multipliers from `MonUMod.txt` `[constants]` (rows 0..33):
 * - Minion (`+100% / +75% / +50%`): `2.0x / 1.75x / 1.5x`
 * - Champion (`+200% / +150% / +100%`): `3.0x / 2.5x / 2.0x`
 * - Unique (`+300% / +200% / +100%`): `4.0x / 3.0x / 2.0x`
 */
export const ELITE_HEALTH_MULTIPLIER_BY_DIFFICULTY: Readonly<
  Record<Difficulty, Readonly<Record<MonsterRank, number>>>
> = {
  normal: {
    normal: 1,
    minion: 2.0,
    champion: 3.0,
    unique: 4.0,
    boss: 1,
  },
  nightmare: {
    normal: 1,
    minion: 1.75,
    champion: 2.5,
    unique: 3.0,
    boss: 1,
  },
  hell: {
    normal: 1,
    minion: 1.5,
    champion: 2.0,
    unique: 2.0,
    boss: 1,
  },
}

export function getEliteHealthMultiplier113c(
  rank: MonsterRank,
  difficulty: Difficulty | number = 'normal',
): number {
  const diff: Difficulty =
    typeof difficulty === 'number'
      ? difficulty === 2
        ? 'hell'
        : difficulty === 1
          ? 'nightmare'
          : 'normal'
      : difficulty
  return ELITE_HEALTH_MULTIPLIER_BY_DIFFICULTY[diff][rank] ?? 1
}

/**
 * Apply 1.13c Champion subtype stats (`16` Regular, `36` Ghostly, `37` Fanatic, `38` Possessed, `39` Berserk)
 * per `D2Game.dll` `0x6fc43ae0` and `0x6fccfa30..0x6fcd0310`.
 */
export function applyChampionSubtypeStats(
  base: MonsterStats,
  subtype: ChampionSubtype | number,
  difficulty: Difficulty | number = 'normal',
): MonsterStats {
  const diff: Difficulty =
    typeof difficulty === 'number'
      ? difficulty === 2
        ? 'hell'
        : difficulty === 1
          ? 'nightmare'
          : 'normal'
      : difficulty
  const diffIdx = diff === 'hell' ? 2 : diff === 'nightmare' ? 1 : 0
  const champHpMult = getEliteHealthMultiplier113c('champion', diff)
  const champDmgMult = 1 + (MONUMOD_113C_CONSTANTS.championDmgBonusPct[diffIdx] ?? 100) / 100
  const baseMaxHp = base.maxHp ?? base.hp
  const regularChampHp = Math.max(1, Math.round(baseMaxHp * champHpMult))
  const regularChampDmg = Math.max(1, Math.round(base.damage * champDmgMult))
  const level = Math.min(110, Math.max(1, (base.level ?? 1) + CHAMPION_MODIFIER.levelBonus))

  const normalizedSubtype: ChampionSubtype =
    subtype === 36 || subtype === 'ghostly'
      ? 'ghostly'
      : subtype === 37 || subtype === 'fanatic'
        ? 'fanatic'
        : subtype === 38 || subtype === 'possessed'
          ? 'possessed'
          : subtype === 39 || subtype === 'berserk'
            ? 'berserk'
            : 'champion'

  let hp = regularChampHp
  let damage = regularChampDmg
  let speed = Math.round(base.speed * 1.2 * 100) / 100
  let cooldownTicks = base.cooldownTicks
  let physicalRes = base.resistances?.physical ?? 0

  if (normalizedSubtype === 'ghostly') {
    speed = Math.max(4, Math.round(base.speed * 0.5))
    physicalRes = Math.max(80, physicalRes)
  } else if (normalizedSubtype === 'fanatic') {
    speed = Math.round(base.speed * 2.0)
    cooldownTicks = Math.max(5, Math.round(base.cooldownTicks * 0.3))
  } else if (normalizedSubtype === 'possessed') {
    hp = regularChampHp * 3
  } else if (normalizedSubtype === 'berserk') {
    hp = Math.max(1, Math.round(baseMaxHp * 1.5))
    damage = Math.max(base.damage * 3, regularChampDmg * 2)
  }

  const updatedResistances = {
    physical: physicalRes,
    magic: base.resistances?.magic ?? 0,
    fire: base.resistances?.fire ?? 0,
    lightning: base.lightningResist ?? base.resistances?.lightning ?? 0,
    cold: base.resistances?.cold ?? 0,
    poison: base.resistances?.poison ?? 0,
  }
  const dmgMult =
    normalizedSubtype === 'berserk'
      ? Math.max(3, champDmgMult * 2)
      : champDmgMult
  const scaleSlot = (
    slot: NonNullable<MonsterStats['attack1']>,
  ): NonNullable<MonsterStats['attack1']> => {
    const rawMin = slot.minDamage ?? slot.min ?? 0
    const rawMax = slot.maxDamage ?? slot.max ?? 0
    const minDamage = rawMin > 0 ? Math.max(1, Math.round(rawMin * dmgMult)) : 0
    const maxDamage =
      rawMax > 0 ? Math.max(minDamage, Math.round(rawMax * dmgMult)) : 0
    return {
      ...slot,
      minDamage,
      maxDamage,
      min: minDamage,
      max: maxDamage,
    }
  }

  return {
    ...base,
    hp,
    maxHp: hp,
    damage,
    speed,
    cooldownTicks,
    rank: 'champion',
    level,
    modifiers: [normalizedSubtype],
    resistances: updatedResistances,
    resists: updatedResistances,
    lightningResist: updatedResistances.lightning,
    ...(base.attack1 ? { attack1: scaleSlot(base.attack1) } : {}),
    ...(base.attack2 ? { attack2: scaleSlot(base.attack2) } : {}),
    ...(base.special1 ? { special1: scaleSlot(base.special1) } : {}),
  }
}

/**
 * Apply elite/superunique stat modifiers to base rolled `MonsterStats`.
 * Supports both `(base, rank, modifiers, superUniqueId)` and `(base, rank, difficulty, modifiers, superUniqueId)`.
 */
export function applyEliteModifiers(
  base: MonsterStats,
  rank: MonsterRank,
  modifiersOrDifficulty: readonly string[] | Difficulty = [],
  superUniqueIdOrModifiers?: string | readonly string[],
  maybeSuperUniqueId?: string,
): MonsterStats {
  let modifiers: readonly string[]
  let superUniqueId: string | undefined
  let explicitDifficulty: Difficulty | undefined

  if (typeof modifiersOrDifficulty === 'string') {
    explicitDifficulty = modifiersOrDifficulty
    if (Array.isArray(superUniqueIdOrModifiers)) {
      modifiers = superUniqueIdOrModifiers
      superUniqueId = maybeSuperUniqueId
    } else {
      modifiers = []
      superUniqueId = superUniqueIdOrModifiers as string | undefined
    }
  } else {
    modifiers = modifiersOrDifficulty
    superUniqueId = typeof superUniqueIdOrModifiers === 'string' ? superUniqueIdOrModifiers : maybeSuperUniqueId
  }

  let hp = base.hp
  let damage = base.damage
  let armor = base.armor ?? 0
  let speed = base.speed
  let cooldownTicks = base.cooldownTicks
  let level = base.level ?? 1
  const maxLevel = explicitDifficulty !== undefined || level > 99 ? 110 : 99
  if (rank === 'champion') {
    level += CHAMPION_MODIFIER.levelBonus
  } else if (rank === 'unique' || rank === 'minion') {
    level += UNIQUE_MODIFIER.levelBonus
  }
  level = Math.min(maxLevel, Math.max(1, level))

  if (explicitDifficulty !== undefined) {
    const rankHpMult = getEliteHealthMultiplier113c(rank, explicitDifficulty)
    hp = Math.max(1, Math.round(hp * rankHpMult))
  }

  const normMods = new Set(modifiers.map(m => m.trim().toLowerCase().replace(/[_\s-]+/g, '')))

  if (normMods.has('strong') || normMods.has('extrastrong') || normMods.has('5')) {
    damage = Math.max(1, Math.round(damage * (MONUMOD_CONSTANTS.uniqueDmgPctStrong / 100)))
  }
  if (normMods.has('fast') || normMods.has('extrafast') || normMods.has('6')) {
    speed = Math.round(speed * 1.4 * 100) / 100
  }
  if (normMods.has('fanatic') || normMods.has('fanatical') || normMods.has('37')) {
    speed = Math.round(speed * 2.0 * 100) / 100
    cooldownTicks = Math.max(5, Math.round(cooldownTicks * 0.3))
  }
  if (normMods.has('possessed') || normMods.has('38')) {
    hp = Math.round(hp * 3)
  }
  if (normMods.has('berserk') || normMods.has('berserker') || normMods.has('39')) {
    hp = Math.max(1, Math.round(hp * 0.5))
    damage = Math.max(1, Math.round(damage * 3))
  }
  if (normMods.has('stoneskin') || normMods.has('28')) {
    hp = Math.round(hp * 2)
    armor = Math.max(1, Math.round(armor * 2))
  }
  if (normMods.has('cursed') || normMods.has('7')) {
    damage = Math.round(damage * 1.2)
  }
  if (normMods.has('coldenchant') || normMods.has('coldenchanted') || normMods.has('18')) {
    damage = Math.round(damage * 1.2)
  }
  if (normMods.has('fireenchant') || normMods.has('fireenchanted') || normMods.has('9')) {
    damage = Math.round(damage * 1.2)
  }
  if (normMods.has('lightenchant') || normMods.has('lightningenchanted') || normMods.has('17')) {
    damage = Math.round(damage * 1.2)
  }
  if (normMods.has('spectralhit') || normMods.has('27')) {
    damage = Math.round(damage * 1.2)
  }
  if (normMods.has('teleport') || normMods.has('teleportation') || normMods.has('26')) {
    speed = Math.round(speed * 1.2 * 100) / 100
  }
  if (normMods.has('magicresistant') || normMods.has('magicresistance') || normMods.has('8')) {
    hp = Math.round(hp * 1.2)
  }
  if (normMods.has('aura') || normMods.has('auraenchanted') || normMods.has('30')) {
    damage = Math.round(damage * 1.2)
    speed = Math.round(speed * 1.1 * 100) / 100
  }
  let physicalRes = base.resistances?.physical ?? 0
  let magicRes = base.resistances?.magic ?? 0
  let fireRes = base.resistances?.fire ?? 0
  let lightningRes = base.lightningResist ?? base.resistances?.lightning ?? 0
  let coldRes = base.resistances?.cold ?? 0
  let poisonRes = base.resistances?.poison ?? 0

  if (normMods.has('stoneskin') || normMods.has('28')) {
    physicalRes += 50
  }
  if (normMods.has('ghostly') || normMods.has('36')) {
    physicalRes = Math.max(80, physicalRes)
    speed = Math.max(4, Math.round(speed * 0.5 * 100) / 100)
  }
  if (normMods.has('manahit') || normMods.has('manaburn') || normMods.has('25')) {
    magicRes += 20
  }
  if (normMods.has('fireenchant') || normMods.has('fireenchanted') || normMods.has('9')) {
    fireRes += 75
  }
  if (normMods.has('coldenchant') || normMods.has('coldenchanted') || normMods.has('18')) {
    coldRes += 75
  }
  if (normMods.has('lightenchant') || normMods.has('lightningenchanted') || normMods.has('17')) {
    lightningRes += 75
  }
  if (normMods.has('poisonenchant') || normMods.has('poisonenchanted')) {
    poisonRes += 75
  }
  if (normMods.has('magicresistant') || normMods.has('magicresistance') || normMods.has('8')) {
    fireRes += 40
    coldRes += 40
    lightningRes += 20
  }
  if (normMods.has('spectralhit') || normMods.has('27')) {
    fireRes += 20
    coldRes += 20
    lightningRes += 20
  }

  const hasAnyResMod =
    physicalRes !== 0 ||
    magicRes !== 0 ||
    fireRes !== 0 ||
    lightningRes !== 0 ||
    coldRes !== 0 ||
    poisonRes !== 0
  const updatedResistances = base.resistances
    ? {
        ...base.resistances,
        physical: physicalRes,
        magic: magicRes,
        fire: fireRes,
        lightning: lightningRes,
        cold: coldRes,
        poison: poisonRes,
      }
    : hasAnyResMod
      ? {
          ...(physicalRes !== 0 ? { physical: physicalRes } : {}),
          ...(magicRes !== 0 ? { magic: magicRes } : {}),
          ...(fireRes !== 0 ? { fire: fireRes } : {}),
          ...(lightningRes !== 0 ? { lightning: lightningRes } : {}),
          ...(coldRes !== 0 ? { cold: coldRes } : {}),
          ...(poisonRes !== 0 ? { poison: poisonRes } : {}),
        }
      : undefined

  const modDmgScale = base.damage > 0 ? damage / base.damage : 1
  const scaleEliteSlot = (
    slot: NonNullable<MonsterStats['attack1']>,
  ): NonNullable<MonsterStats['attack1']> => {
    if (modDmgScale === 1) return slot
    const rawMin = slot.minDamage ?? slot.min ?? 0
    const rawMax = slot.maxDamage ?? slot.max ?? 0
    const minDamage =
      rawMin > 0 ? Math.max(1, Math.round(rawMin * modDmgScale)) : 0
    const maxDamage =
      rawMax > 0
        ? Math.max(minDamage, Math.round(rawMax * modDmgScale))
        : 0
    return {
      ...slot,
      minDamage,
      maxDamage,
      min: minDamage,
      max: maxDamage,
    }
  }

  return {
    ...base,
    hp,
    maxHp: hp,
    damage,
    armor,
    speed,
    cooldownTicks,
    rank,
    level,
    ...(modifiers.length > 0 ? { modifiers } : {}),
    ...(superUniqueId !== undefined ? { superUniqueId } : {}),
    ...(updatedResistances !== undefined ? { resistances: updatedResistances, resists: updatedResistances, lightningResist: lightningRes } : {}),
    ...(base.attack1 && modDmgScale !== 1 ? { attack1: scaleEliteSlot(base.attack1) } : {}),
    ...(base.attack2 && modDmgScale !== 1 ? { attack2: scaleEliteSlot(base.attack2) } : {}),
    ...(base.special1 && modDmgScale !== 1 ? { special1: scaleEliteSlot(base.special1) } : {}),
  }
}

/** One pack the level populator wants placed. */
export interface MonsterGroup {
  /** Which monster. */
  readonly kind: MonsterKind
  /** How many, from MinGrp to MaxGrp. */
  readonly count: number
  /** Whether this pack is an elite one. */
  readonly rank: Exclude<MonsterRank, 'minion'>
  /** Rolled elite modifiers (`MonUMod.txt`). */
  readonly modifiers?: readonly string[]
}

/**
 * Pick which monster types a level uses.
 *
 * `Levels.txt` lists up to ten candidates and a `NumMon` saying how many of
 * them actually appear — that choice is made once when the level is generated,
 * which is why the Blood Moor you walk into has zombies *or* quill rats rather
 * than all three every time. Selection is weighted by `Rarity`.
 *
 * @param plan - the level's columns.
 * @param kinds - every known monster.
 * @param rng - seeded from the level, so one level always picks the same types.
 * @param difficulty - decides whether the classic or the `nmon` pool is used.
 * @returns the chosen types; may be shorter than `NumMon` if the pool is small.
 */
/**
 * Filter candidate monsters for level population per 1.13c rules (MonsterRegion.cpp:713).
 *
 * In 1.13c, !nSparsePopulate (sparsePopulate === 0 or undefined) means unconstrained (100% chance).
 * Monsters are valid candidates if enabled, isSpawn, and not a boss (unless allowBosses is true).
 */
export function filterCandidateKinds(
  candidates: readonly (MonsterKind | undefined)[],
  allowBosses = false,
): MonsterKind[] {
  return candidates.filter(
    (kind): kind is MonsterKind =>
      kind !== undefined &&
      kind.enabled &&
      kind.isSpawn &&
      (kind.sparsePopulate === undefined || kind.sparsePopulate === 0 || kind.sparsePopulate > 0) &&
      (!kind.boss || allowBosses),
  )
}

export function selectLevelTypes(
  plan: LevelMonsterPlan,
  kinds: ReadonlyMap<string, MonsterKind>,
  rng: Rng,
  difficulty: Difficulty = 'normal',
): MonsterKind[] {
  const names = difficulty === 'normal' ? plan.pool : (plan.nightmarePool.length > 0 ? plan.nightmarePool : plan.pool)
  const candidates = filterCandidateKinds(names.map(name => kinds.get(name)), false)
  const wanted = Math.min(plan.typeCount, candidates.length)
  const chosen: MonsterKind[] = []
  const remaining = [...candidates]
  while (chosen.length < wanted && remaining.length > 0) {
    const total = remaining.reduce((sum, kind) => sum + Math.max(1, kind.rarity), 0)
    let ticket = rng.next() * total
    let index = remaining.length - 1
    for (let i = 0; i < remaining.length; i += 1) {
      ticket -= Math.max(1, remaining[i]!.rarity)
      if (ticket <= 0) { index = i; break }
    }
    chosen.push(remaining[index]!)
    remaining.splice(index, 1)
  }
  return chosen
}

/**
 * Turn a level's density into a monster budget using the authentic 1.13c DRLG room density formula.
 *
 * In Diablo II v1.13c (`MonsterRegion.cpp:645-656`):
 * attempts = Math.floor((cells * 25) / 9)
 * expectedPacks = attempts * (Math.min(10000, density) / 100000)
 * monsterBudget = Math.max(1, Math.round(expectedPacks * 3))
 *
 * @param plan - the level's columns, or cells count if density is passed directly.
 * @param cells - the level's area, in cells (or density if plan is number).
 * @returns how many monsters to place; 0 when the level is a town or density is 0.
 */
export function monsterBudget(plan: LevelMonsterPlan, cells: number): number
export function monsterBudget(cells: number, density: number): number
export function monsterBudget(planOrCells: LevelMonsterPlan | number, cellsOrDensity: number): number {
  let density: number
  let cells: number
  if (typeof planOrCells === 'number') {
    cells = planOrCells
    density = cellsOrDensity
  } else {
    density = planOrCells.density
    cells = cellsOrDensity
  }
  if (density <= 0 || cells <= 0) return 0
  const attempts = Math.floor((cells * 25) / 9)
  const expectedPacks = attempts * (Math.min(10000, density) / 100000)
  return Math.max(1, Math.round(expectedPacks * 3))
}

/**
 * The kinds an elite (champion / unique) pack may be drawn from on one level.
 *
 * `umon1`…`umon10` first; a level that leaves them blank falls back to the
 * types the level drew (or, failing those, its `mon` pool), which is what
 * {@link planMonsterGroups} has always done.
 *
 * @param plan - the level's columns.
 * @param types - the types {@link selectLevelTypes} chose.
 * @param kinds - every known monster.
 * @returns the candidate kinds, possibly empty.
 */
export function resolveEliteCandidates(
  plan: LevelMonsterPlan,
  types: readonly MonsterKind[],
  kinds: ReadonlyMap<string, MonsterKind>,
): MonsterKind[] {
  const eliteCandidates = filterCandidateKinds(plan.elitePool.map(name => kinds.get(name)), true)
  if (eliteCandidates.length > 0) return eliteCandidates
  return types.length > 0
    ? [...types]
    : filterCandidateKinds(plan.pool.map(name => kinds.get(name)), true)
}

/**
 * Roll one elite pack: its kind, champion-or-unique rank, size and `MonUMod.txt` affixes.
 *
 * - 1.13c `MonUMod.txt`: 20% Champions, 80% Uniques + Minions.
 * - Champions spawn in groups of 2 to 4 (`2 + rand() % 3`).
 * - Uniques spawn with 1 boss + 3 to 6 minions (`1 + (3 + rand() % 4)`).
 *
 * @param eliteCandidates - from {@link resolveEliteCandidates}; must be non-empty.
 * @param rng - the pack stream.
 * @param packIndex - 0-based index of this elite pack, seeds the affix roll.
 * @param cap - most monsters the pack may contain.
 * @returns the pack.
 */
export function rollEliteGroup(
  eliteCandidates: readonly MonsterKind[],
  rng: Rng,
  packIndex: number,
  cap: number = Number.POSITIVE_INFINITY,
): MonsterGroup {
  if (eliteCandidates.length === 0) {
    throw new Error('rollEliteGroup: no elite candidates')
  }
  const kind = eliteCandidates[rng.int(0, eliteCandidates.length - 1)]!
  const isChampion = rng.next() < (MONUMOD_CONSTANTS.championChance / 100)
  const rank: Exclude<MonsterRank, 'minion'> = isChampion ? 'champion' : 'unique'
  const count = rank === 'champion'
    ? Math.min(cap, rng.int(2, 4))
    : Math.min(cap, 1 + rng.int(3, 6))
  const modSeed = ((packIndex + 1) * 0x9e3779b9) ^ (count * 0x85ebca6b) ^ (rank === 'champion' ? 1 : 2)
  const modifiers = rollEliteModifiers(rank, new Rng(modSeed))
  return { kind, count, rank, modifiers }
}

/**
 * Break a level's budget into packs.
 *
 * Monsters in D2 come in groups, not as evenly scattered individuals:
 * `MinGrp`/`MaxGrp` say a Fallen comes 2–3 at a time and a Hell Bovine 5–10.
 * Spreading the budget over single monsters — which is what a round-robin over
 * the type list does — produces a field of loners that behaves nothing like the
 * game.
 *
 * Elite packs are drawn first, from `umon`, up to `MonUMax`; whatever budget is
 * left goes to ordinary packs.
 *
 * @param plan - the level's columns.
 * @param types - the types {@link selectLevelTypes} chose.
 * @param kinds - every known monster, for the `umon` lookup.
 * @param budget - how many monsters in total.
 * @param rng - seeded from the level.
 * @param options - optional elite chance multiplier for debugging or overrides.
 * @returns the packs to place.
 */
export function planMonsterGroups(
  plan: LevelMonsterPlan,
  types: readonly MonsterKind[],
  kinds: ReadonlyMap<string, MonsterKind>,
  budget: number,
  rng: Rng,
  options?: {
    readonly eliteMultiplier?: number | 'all' | undefined
  },
): MonsterGroup[] {
  if (types.length === 0 || budget <= 0) return []
  const groups: MonsterGroup[] = []
  let remaining = budget

  const eliteCandidates = resolveEliteCandidates(plan, types, kinds)

  let minElites = plan.eliteMin
  let maxElites = plan.eliteMax
  if (options?.eliteMultiplier !== undefined) {
    if (options.eliteMultiplier === 'all') {
      minElites = 999
      maxElites = 999
    } else if (typeof options.eliteMultiplier === 'number') {
      minElites = Math.round(minElites * options.eliteMultiplier)
      maxElites = Math.round(maxElites * options.eliteMultiplier)
    }
  }

  const elitePacks = maxElites <= 0 ? 0 : rng.int(minElites, maxElites)
  for (let i = 0; i < elitePacks && remaining > 0 && eliteCandidates.length > 0; i += 1) {
    const group = rollEliteGroup(eliteCandidates, rng, i, remaining)
    groups.push(group)
    remaining -= group.count
  }

  const totalRarity = types.reduce((sum, kind) => sum + Math.max(1, kind.rarity), 0)
  while (remaining > 0) {
    let ticket = rng.next() * totalRarity
    let kind = types[types.length - 1]!
    for (let j = 0; j < types.length; j += 1) {
      ticket -= Math.max(1, types[j]!.rarity)
      if (ticket <= 0) {
        kind = types[j]!
        break
      }
    }
    const minGrp = Math.max(1, kind.minGroup)
    const maxGrp = Math.max(minGrp, kind.maxGroup)
    const count = Math.min(remaining, rng.int(minGrp, maxGrp))
    groups.push({ kind, count, rank: 'normal' })
    remaining -= count
  }
  return groups
}

/**
 * The player's walking speed in `Velocity` units.
 *
 * `MonStats.txt` gives speeds in an abstract unit — a Fallen is 5, a Zombie 1,
 * a Hell Bovine 5 — with no pixels anywhere in the file. Anchoring on the
 * player (walk 6, run 9 in the same scale) turns them into our pixel speeds
 * without inventing a constant out of nothing: a Fallen ends up slightly slower
 * than the player, a Zombie six times slower, which is how they read in game.
 */
const PLAYER_WALK_VELOCITY = 6

/**
 * Melee reach when `MonStats2.txt` gives none, in scene pixels.
 *
 * Most rows have `MeleeRng` 0, meaning "touching". A cell is 80×40, so half a
 * cell's width is about as close as two bodies get.
 */
export const DEFAULT_REACH_PX = 40

/**
 * Ticks between monster attacks.
 *
 * The real value is the length of the attack animation, which lives in the COF
 * files rather than in a table. 25 ticks is one second at the simulation rate —
 * a placeholder that is honest about being one, to be replaced when M7's art
 * pass reads the animation timings.
 */
const DEFAULT_ATTACK_COOLDOWN_TICKS = 25

/**
 * Default AI activation radius when `aidist` is blank or 0, in sub-tiles.
 *
 * Per d2mods KB article 360: *"aidist, aidist(N), aidist(H): the distance in
 * cells from which AI is activated. Most AI's have base hardcoded activation
 * radius of 35 which stands for a distance of about 1 screen, thus leaving these
 * fields blank sets this to 35 automatically."*
 *
 * In sub-tile pixels (16 px per sub-tile), 35 sub-tiles = 560 px.
 */
const DEFAULT_AI_DISTANCE_SUBTILES = 35
const DEFAULT_AGGRO_PX = DEFAULT_AI_DISTANCE_SUBTILES * 16

/** Scene pixels per sub-tile, for turning `aidist` into a radius. */
const PIXELS_PER_SUBTILE = 16

/**
 * Bridge a table row to the numbers the combat simulation consumes.
 *
 * Health is rolled here rather than averaged: `minHP`/`maxHP` is a range, and
 * collapsing it would make every Fallen in a pack die to exactly the same
 * number of hits.
 *
 * @param kind - the table row.
 * @param rng - seeded, so the same spawn rolls the same health.
 * @param walkSpeedPx - the player's walking speed, the anchor for the scale.
 * @param scale - the `MonLvl.txt` multipliers; defaults to no scaling.
 * @returns stats the existing combat code can use unchanged.
 */
export interface MonsterStats113cOptions {
  readonly difficulty?: Difficulty | number | undefined
  readonly walkSpeedPx?: number | undefined
  readonly rng?: number | (() => number) | Rng | undefined
  readonly playerCount?: number | undefined
  readonly playersCount?: number | undefined
  readonly level?: number | undefined
  readonly areaLevel?: number | undefined
  readonly rank?: MonsterRank | 'superunique' | undefined
  readonly art?: MonsterArt | { readonly meleeRange?: number } | null | undefined
}

export function monsterStatsOf(
  kind: MonsterKind,
  rng: Rng,
  walkSpeedPx: number,
  scale?: MonsterScale,
  art?: MonsterArt | { readonly meleeRange?: number } | null,
  level?: number,
  rank?: MonsterRank,
): MonsterStats
export function monsterStatsOf(
  kind: MonsterKind,
  difficulty: Difficulty | number,
  walkSpeedPx?: number,
  rollOrRng?: number | (() => number) | Rng,
  options?: MonsterStats113cOptions,
): MonsterStats
export function monsterStatsOf(
  kind: MonsterKind,
  options?: MonsterStats113cOptions,
): MonsterStats
export function monsterStatsOf(
  kind: MonsterKind,
  rngOrDiffOrOpts?: Rng | Difficulty | number | MonsterStats113cOptions,
  walkSpeedPxArg = 170,
  scaleOrRoll?: MonsterScale | number | (() => number) | Rng,
  artOrOpts?: (MonsterArt | { readonly meleeRange?: number } | null) | MonsterStats113cOptions,
  levelArg?: number,
  rankArg?: MonsterRank,
): MonsterStats {
  const isLegacyRng =
    rngOrDiffOrOpts !== null &&
    typeof rngOrDiffOrOpts === 'object' &&
    typeof (rngOrDiffOrOpts as Rng).int === 'function'

  if (!isLegacyRng) {
    const isOptsCall =
      rngOrDiffOrOpts === undefined ||
      (typeof rngOrDiffOrOpts === 'object' && rngOrDiffOrOpts !== null)
    const opts: MonsterStats113cOptions = isOptsCall
      ? ((rngOrDiffOrOpts as MonsterStats113cOptions | undefined) ?? {})
      : ((artOrOpts as MonsterStats113cOptions | undefined) ?? {})
    const difficulty = normalizeDifficulty(
      isOptsCall ? (opts.difficulty ?? kind.difficulty ?? 'normal') : (rngOrDiffOrOpts as Difficulty | number),
    )
    const diffIdx: 0 | 1 | 2 = difficulty === 'hell' ? 2 : difficulty === 'nightmare' ? 1 : 0
    const walkSpeedPx = isOptsCall ? (opts.walkSpeedPx ?? 170) : walkSpeedPxArg
    const rollSource = isOptsCall ? opts.rng : (scaleOrRoll as number | (() => number) | Rng | undefined)

    const diffKind =
      kind.difficulty !== undefined && kind.difficulty !== difficulty
        ? ((typeof kind.hcIdx === 'number'
            ? getMonsterKindByHcIdx(kind.hcIdx, difficulty)
            : getCanonicalMonsterKinds(difficulty).get(kind.id)) ?? kind)
        : kind

    const velocity =
      diffKind.velocity > 0 ? diffKind.velocity : diffKind.runVelocity > 0 ? diffKind.runVelocity : 1
    const minHpRaw = Math.min(diffKind.minHp, diffKind.maxHp)
    const maxHpRaw = Math.max(diffKind.minHp, diffKind.maxHp)

    let rolledHp = minHpRaw
    if (typeof rollSource === 'number') {
      const t = Math.max(0, Math.min(1, rollSource))
      rolledHp = Math.min(maxHpRaw, minHpRaw + Math.floor(t * (maxHpRaw - minHpRaw + 1)))
    } else if (typeof rollSource === 'function') {
      const t = Math.max(0, Math.min(1, rollSource()))
      rolledHp = Math.min(maxHpRaw, minHpRaw + Math.floor(t * (maxHpRaw - minHpRaw + 1)))
    } else if (rollSource && typeof (rollSource as Rng).int === 'function') {
      rolledHp = (rollSource as Rng).int(minHpRaw, maxHpRaw)
    }

    const mlvl =
      opts.level ??
      (opts.areaLevel !== undefined
        ? monsterLevelFor(diffKind, difficulty, opts.areaLevel)
        : (diffKind.level[diffIdx] ?? diffKind.level[0]))
    const monLvlRow = getMonLvl113c(mlvl)
    const bypassRatio = Boolean(diffKind.noRatio) || !monLvlRow

    const lHp = bypassRatio ? 100 : monLvlRow.lHp[diffIdx]
    const lDm = bypassRatio ? 100 : monLvlRow.lDm[diffIdx]
    const lAc = bypassRatio ? 100 : monLvlRow.lAc[diffIdx]
    const lTh = bypassRatio ? 100 : monLvlRow.lTh[diffIdx]
    const lXp = bypassRatio ? 100 : monLvlRow.lXp[diffIdx]

    const scaleFloor = (raw: number, pct: number): number =>
      bypassRatio ? raw : Math.floor((raw * pct) / 100)

    let hp = Math.max(1, scaleFloor(rolledHp, lHp))
    let a1Min = Math.max(0, scaleFloor(diffKind.attack1.minDamage, lDm))
    let a1Max = Math.max(a1Min, scaleFloor(diffKind.attack1.maxDamage, lDm))
    let a1Th = Math.max(0, scaleFloor(diffKind.attack1.toHit, lTh))
    let a2Min = Math.max(0, scaleFloor(diffKind.attack2.minDamage, lDm))
    let a2Max = Math.max(a2Min, scaleFloor(diffKind.attack2.maxDamage, lDm))
    let a2Th = Math.max(0, scaleFloor(diffKind.attack2.toHit, lTh))
    let s1Min = Math.max(0, scaleFloor(diffKind.special1?.minDamage ?? 0, lDm))
    let s1Max = Math.max(s1Min, scaleFloor(diffKind.special1?.maxDamage ?? 0, lDm))
    let s1Th = Math.max(0, scaleFloor(diffKind.special1?.toHit ?? 0, lTh))
    const armor = Math.max(0, scaleFloor(diffKind.armour, lAc))
    let xp = Math.max(0, scaleFloor(diffKind.experience, lXp))

    const playerCount = Math.max(1, Math.min(8, Math.floor(opts.playerCount ?? opts.playersCount ?? 1)))
    const bonusDmgAr = (val: number): number =>
      playerCount > 1 ? val + Math.floor((val * (playerCount - 1)) / 16) : val
    if (playerCount > 1) {
      hp = Math.max(1, Math.floor((hp * (playerCount + 1)) / 2))
      xp = Math.max(0, Math.floor((xp * (playerCount + 1)) / 2))
      a1Min = bonusDmgAr(a1Min)
      a1Max = bonusDmgAr(a1Max)
      a1Th = bonusDmgAr(a1Th)
      a2Min = bonusDmgAr(a2Min)
      a2Max = bonusDmgAr(a2Max)
      a2Th = bonusDmgAr(a2Th)
      s1Min = bonusDmgAr(s1Min)
      s1Max = bonusDmgAr(s1Max)
      s1Th = bonusDmgAr(s1Th)
    }

    const scaledElementalAttacks: readonly MonsterElementalAttack[] | undefined =
      diffKind.elementalAttacks?.map((el) => {
        const scaledMin = Math.max(0, scaleFloor(el.minDamage ?? el.min ?? 0, lDm))
        const scaledMax = Math.max(scaledMin, scaleFloor(el.maxDamage ?? el.max ?? 0, lDm))
        const elMin = bonusDmgAr(scaledMin)
        const elMax = Math.max(elMin, bonusDmgAr(scaledMax))
        return {
          ...el,
          min: elMin,
          max: elMax,
          minDamage: elMin,
          maxDamage: elMax,
        }
      })

    const damage =
      a1Min <= 0 && a1Max <= 0 && (!diffKind.killable || diffKind.ai === 'Idle')
        ? 0
        : Math.max(1, Math.round((a1Min + a1Max) / 2))
    const meleeRng = opts.art?.meleeRange ?? diffKind.meleeRange ?? diffKind.meleeRng
    const reach =
      meleeRng !== undefined && meleeRng > 0
        ? Math.max(DEFAULT_REACH_PX, meleeRng * PIXELS_PER_SUBTILE)
        : DEFAULT_REACH_PX
    const resolvedRank: MonsterRank = diffKind.boss
      ? 'boss'
      : opts.rank === 'superunique'
        ? 'unique'
        : (opts.rank ?? 'normal')

    return {
      id: diffKind.id,
      name: diffKind.nameKey === '' ? diffKind.id : diffKind.nameKey,
      nameKey: diffKind.nameKey === '' ? diffKind.id : diffKind.nameKey,
      ...(diffKind.descKey !== undefined &&
      diffKind.descKey !== '' &&
      diffKind.descKey.toLowerCase() !== 'dummy'
        ? { descKey: diffKind.descKey }
        : {}),
      isUndead: diffKind.isUndead,
      isDemon: diffKind.isDemon,
      isBoss: diffKind.boss,
      killable: diffKind.killable,
      inTown: diffKind.inTown,
      hp,
      maxHp: hp,
      damage,
      armor,
      toHit: a1Th,
      cooldownTicks: DEFAULT_ATTACK_COOLDOWN_TICKS,
      reach,
      aggroRadius:
        diffKind.aiDistance > 0 ? diffKind.aiDistance * PIXELS_PER_SUBTILE : DEFAULT_AGGRO_PX,
      speed: Math.max(8, Math.round((velocity / PLAYER_WALK_VELOCITY) * walkSpeedPx)),
      xp,
      level: mlvl,
      rank: resolvedRank,
      resistances: diffKind.resistances,
      lightningResist: diffKind.resistances?.lightning,
      resists: diffKind.resistances,
      ...(typeof diffKind.hcIdx === 'number' ? { hcIdx: diffKind.hcIdx } : {}),
      ...(diffKind.ai ? { ai: diffKind.ai } : {}),
      ...(typeof diffKind.aiDelay === 'number' ? { aiDelay: diffKind.aiDelay } : {}),
      aiDistance: diffKind.aiDistance,
      ...(diffKind.aiParams ? { aiParams: diffKind.aiParams } : {}),
      attack1: { minDamage: a1Min, maxDamage: a1Max, toHit: a1Th, min: a1Min, max: a1Max },
      attack2: { minDamage: a2Min, maxDamage: a2Max, toHit: a2Th, min: a2Min, max: a2Max },
      ...(diffKind.special1
        ? { special1: { minDamage: s1Min, maxDamage: s1Max, toHit: s1Th, min: s1Min, max: s1Max } }
        : {}),
      ...(scaledElementalAttacks ? { elementalAttacks: scaledElementalAttacks } : {}),
      ...(diffKind.skills ? { skills: diffKind.skills } : {}),
      ...(diffKind.modeMissiles ? { modeMissiles: diffKind.modeMissiles } : {}),
      ...(typeof diffKind.drain === 'number' ? { drain: diffKind.drain } : {}),
      ...(typeof diffKind.coldEffect === 'number' ? { coldEffect: diffKind.coldEffect } : {}),
      ...(typeof diffKind.damageRegen === 'number' ? { damageRegen: diffKind.damageRegen } : {}),
      ...(typeof diffKind.toBlock === 'number' ? { toBlock: diffKind.toBlock } : {}),
      ...(typeof diffKind.crit === 'number' ? { crit: diffKind.crit } : {}),
      ...(typeof diffKind.align === 'number' ? { align: diffKind.align } : {}),
      ...(diffKind.noRatio !== undefined ? { noRatio: diffKind.noRatio } : {}),
      ...(typeof meleeRng === 'number' ? { meleeRng } : {}),
      ...(diffKind.neverCount !== undefined ? { neverCount: diffKind.neverCount } : {}),
      ...(diffKind.petIgnore !== undefined ? { petIgnore: diffKind.petIgnore } : {}),
      ...(diffKind.deathDmg !== undefined ? { deathDmg: diffKind.deathDmg } : {}),
      ...(diffKind.isPrimeEvil !== undefined ? { isPrimeEvil: diffKind.isPrimeEvil } : {}),
    }
  }

  const rng = rngOrDiffOrOpts as Rng
  const walkSpeedPx = walkSpeedPxArg
  const scale = (scaleOrRoll as MonsterScale | undefined) ?? UNSCALED
  const art = artOrOpts as (MonsterArt | { readonly meleeRange?: number } | null) | undefined
  const level = levelArg
  const rank = rankArg

  const velocity = kind.velocity > 0 ? kind.velocity : (kind.runVelocity > 0 ? kind.runVelocity : 1)
  // Roll first, scale second. Scaling the bounds and rolling between them
  // would round the range's ends before the roll and lose most of its width at
  // low levels, where the multiplier is a few percent: a Fallen's 21..61 at
  // level 1 becomes 1..4, and three of those four values are unreachable if
  // each end is rounded first.
  const rolled = rng.int(Math.min(kind.minHp, kind.maxHp), Math.max(kind.minHp, kind.maxHp))
  const averageDamage = (kind.attack1.minDamage + kind.attack1.maxDamage) / 2
  const meleeRng = art?.meleeRange ?? kind.meleeRange ?? kind.meleeRng
  const reach = (meleeRng !== undefined && meleeRng > 0)
    ? Math.max(DEFAULT_REACH_PX, meleeRng * PIXELS_PER_SUBTILE)
    : DEFAULT_REACH_PX
  const hp = Math.max(1, Math.round((rolled * scale.health) / 100))
  const damage = Math.max(1, Math.round((averageDamage * scale.damage) / 100))
  const armor = Math.max(0, Math.round((kind.armour * scale.armour) / 100))
  const toHit = Math.max(0, Math.round((kind.attack1.toHit * scale.toHit) / 100))
  return {
    id: kind.id,
    name: kind.nameKey === '' ? kind.id : kind.nameKey,
    nameKey: kind.nameKey === '' ? kind.id : kind.nameKey,
    ...(kind.descKey !== undefined && kind.descKey !== '' && kind.descKey.toLowerCase() !== 'dummy' ? { descKey: kind.descKey } : {}),
    isUndead: kind.isUndead,
    isDemon: kind.isDemon,
    isBoss: kind.boss,
    killable: kind.killable,
    inTown: kind.inTown,
    hp,
    maxHp: hp,
    damage,
    armor,
    toHit,
    cooldownTicks: DEFAULT_ATTACK_COOLDOWN_TICKS,
    reach,
    aggroRadius: kind.aiDistance > 0 ? kind.aiDistance * PIXELS_PER_SUBTILE : DEFAULT_AGGRO_PX,
    speed: Math.max(8, Math.round((velocity / PLAYER_WALK_VELOCITY) * walkSpeedPx)),
    xp: Math.max(0, Math.round((kind.experience * scale.experience) / 100)),
    level: level ?? kind.level[0],
    rank: kind.boss ? 'boss' : (rank ?? 'normal'),
    resistances: kind.resistances,
    lightningResist: kind.resistances?.lightning,
    resists: kind.resistances,
    ...(typeof kind.hcIdx === 'number' ? { hcIdx: kind.hcIdx } : {}),
    ...(kind.ai ? { ai: kind.ai } : {}),
    ...(typeof kind.aiDelay === 'number' ? { aiDelay: kind.aiDelay } : {}),
    aiDistance: kind.aiDistance,
    ...(kind.aiParams ? { aiParams: kind.aiParams } : {}),
    ...(kind.elementalAttacks ? { elementalAttacks: kind.elementalAttacks } : {}),
    ...(kind.skills ? { skills: kind.skills } : {}),
    ...(kind.modeMissiles ? { modeMissiles: kind.modeMissiles } : {}),
    ...(typeof kind.drain === 'number' ? { drain: kind.drain } : {}),
    ...(typeof kind.coldEffect === 'number' ? { coldEffect: kind.coldEffect } : {}),
    ...(typeof kind.damageRegen === 'number' ? { damageRegen: kind.damageRegen } : {}),
    ...(typeof kind.toBlock === 'number' ? { toBlock: kind.toBlock } : {}),
    ...(typeof kind.crit === 'number' ? { crit: kind.crit } : {}),
    ...(typeof kind.align === 'number' ? { align: kind.align } : {}),
    ...(kind.noRatio !== undefined ? { noRatio: kind.noRatio } : {}),
    ...(typeof meleeRng === 'number' ? { meleeRng } : {}),
    ...(kind.neverCount !== undefined ? { neverCount: kind.neverCount } : {}),
    ...(kind.petIgnore !== undefined ? { petIgnore: kind.petIgnore } : {}),
    ...(kind.deathDmg !== undefined ? { deathDmg: kind.deathDmg } : {}),
    ...(kind.isPrimeEvil !== undefined ? { isPrimeEvil: kind.isPrimeEvil } : {}),
  }
}

/**
 * How much an elite pack's members are strengthened.
 *
 * `MonUMod.txt` keeps these in its `constants` column: `champion +hp%` is 200,
 * `unique +hp%` is 300. They are applied as multipliers on the rolled health.
 */
export const ELITE_HEALTH_MULTIPLIER: Readonly<Record<Exclude<MonsterRank, 'minion'>, number>> = {
  normal: 1,
  champion: 1 + MONUMOD_CONSTANTS.championHpPct / 100,
  unique: 1 + MONUMOD_CONSTANTS.uniqueHpPct / 100,
  boss: 1,
}

/** Specification of a fixed Act 1 outdoor SuperUnique boss tied to a landmark. */
export interface SuperUniqueLandmarkSpec {
  readonly id: string
  readonly name: string
  readonly monsterId: string
  readonly landmark: string
  readonly modifiers: readonly string[]
  readonly minMinions: number
  readonly maxMinions: number
  readonly minionMonsterId: string
}

/** Landmark and minion mapping for canonical outdoor and landmark SuperUniques. */
export interface SuperUniqueLandmarkMapping {
  readonly id: string
  readonly levelIds: readonly number[]
  readonly landmark: string
  readonly minionMonsterId?: string
}

export const CANONICAL_SUPER_UNIQUE_LANDMARKS: readonly SuperUniqueLandmarkMapping[] = [
  // Act 1
  { id: 'Bishibosh', levelIds: [3], landmark: 'Act 1 - Fallen Camp Bishibosh', minionMonsterId: 'fallen1' },
  { id: 'Rakanishu', levelIds: [4], landmark: 'Act 1 - Cairn Stones', minionMonsterId: 'fallen1' },
  { id: 'Treehead WoodFist', levelIds: [5], landmark: 'Act 1 - Inifus', minionMonsterId: 'brute1' },
  { id: 'The Countess', levelIds: [6, 25], landmark: 'Act 1 - Tower 1', minionMonsterId: 'corruptrogue5' },
  { id: 'Blood Raven', levelIds: [17], landmark: 'Act 1 - Graveyard', minionMonsterId: 'zombie1' },
  // Act 2
  { id: 'Creeping Feature', levelIds: [41, 55, 59], landmark: 'Act 2 - Desert Tomb 1', minionMonsterId: 'mummy1' },
  { id: 'Beetleburst', levelIds: [43], landmark: 'Act 2 - Desert Oasis 1', minionMonsterId: 'scarab2' },
  { id: 'Dark Elder', levelIds: [44], landmark: 'Act 2 - Desert Ruins Elder', minionMonsterId: 'zombie5' },
  { id: 'Bloodwitch the Wild', levelIds: [45, 60], landmark: 'Act 2 - Desert Tomb 2', minionMonsterId: 'pantherwoman1' },
  { id: 'Fangskin', levelIds: [45, 61], landmark: 'Act 2 - Desert Valley Ruin 2', minionMonsterId: 'clawviper3' },
  // Act 3
  { id: 'Sszark the Burning', levelIds: [76, 84], landmark: 'Act 3 - Spider Cavern', minionMonsterId: 'arach4' },
  { id: 'Stormtree', levelIds: [78], landmark: 'Act 3 - Flayer Jungle Entrance', minionMonsterId: 'thornhulk3' },
  { id: 'Witch Doctor Endugu', levelIds: [78, 88, 91], landmark: 'Act 3 - Flayer Dungeon', minionMonsterId: 'fetish4' },
  { id: 'Battlemaid Sarina', levelIds: [80, 94], landmark: 'Act 3 - Burbs Temple', minionMonsterId: 'corruptrogue5' },
  // Act 4
  { id: 'Izual', levelIds: [105], landmark: 'Act 4 - Plains of Despair', minionMonsterId: 'izual' },
  { id: 'Hephasto the Armorer', levelIds: [106, 107], landmark: 'Act 4 - Hellforge', minionMonsterId: 'hephasto' },
  { id: 'Grand Vizier of Chaos', levelIds: [108], landmark: 'Act 4 - Diablo Wing W', minionMonsterId: 'fingermage3' },
  { id: 'Lord De Seis', levelIds: [108], landmark: 'Act 4 - Diablo Wing N', minionMonsterId: 'doomknight1' },
  { id: 'Infector of Souls', levelIds: [108], landmark: 'Act 4 - Diablo Wing E', minionMonsterId: 'megademon3' },
  // Act 5
  { id: 'Dac Farren', levelIds: [110], landmark: 'Act 5 - Barricade Prison 1', minionMonsterId: 'imp3' },
  { id: 'Shenk the Overseer', levelIds: [110], landmark: 'Act 5 - Barricade Building', minionMonsterId: 'minion1' },
  { id: 'Eldritch the Rectifier', levelIds: [111], landmark: 'Act 5 - Frigid Highlands', minionMonsterId: 'minion1' },
  { id: 'Sharptooth Slayer', levelIds: [111], landmark: 'Act 5 - Barricade Prison', minionMonsterId: 'minion3' },
  { id: 'Eyeback the Unleashed', levelIds: [111], landmark: 'Act 5 - Barricade Hell Portal N', minionMonsterId: 'deathmauler1' },
  { id: 'Thresh Socket', levelIds: [112], landmark: 'Act 5 - Barricade Snow Unique', minionMonsterId: 'imp3' },
  { id: 'Frozenstein', levelIds: [114], landmark: 'Act 5 - Frozen River', minionMonsterId: 'snowyeti4' },
  { id: 'Bonesaw Breaker', levelIds: [115], landmark: 'Act 5 - Glacial Trail', minionMonsterId: 'reanimatedhorde2' },
  { id: 'Snapchip Shatter', levelIds: [119], landmark: 'Act 5 - Icy Cellar', minionMonsterId: 'frozenhorror1' },
  { id: 'Talic', levelIds: [120], landmark: 'Act 5 - Arreat Summit', minionMonsterId: 'ancientbarb1' },
  { id: 'Madawc', levelIds: [120], landmark: 'Act 5 - Arreat Summit', minionMonsterId: 'ancientbarb2' },
  { id: 'Korlic', levelIds: [120], landmark: 'Act 5 - Arreat Summit', minionMonsterId: 'ancientbarb3' },
  { id: 'Pindleskin', levelIds: [121], landmark: 'Act 5 - Temple Entrance', minionMonsterId: 'reanimatedhorde5' },
  { id: 'Nihlathak', levelIds: [124], landmark: 'Act 5 - Halls of Vaught', minionMonsterId: 'minion6' },
  { id: 'Colenzo the Annihilator', levelIds: [131], landmark: 'Act 5 - Baal Throne Room Wave 1', minionMonsterId: 'fallen5' },
  { id: 'Achmel the Cursed', levelIds: [131], landmark: 'Act 5 - Baal Throne Room Wave 2', minionMonsterId: 'unraveler5' },
  { id: 'Bartuc the Bloody', levelIds: [131], landmark: 'Act 5 - Baal Throne Room Wave 3', minionMonsterId: 'baalhighpriest' },
  { id: 'Ventar the Unholy', levelIds: [131], landmark: 'Act 5 - Baal Throne Room Wave 4', minionMonsterId: 'venomlord' },
  { id: 'Lister the Tormentor', levelIds: [131], landmark: 'Act 5 - Baal Throne Room Wave 5', minionMonsterId: 'baalminion1' },
]

import { RAW_MONSTATS, RAW_SUPERUNIQUES } from '../data/canonical-drop-data.ts'

/** Canonical SuperUniques TSV extracted from game data for landmark bosses. */
export const CANONICAL_SUPERUNIQUES_TSV = `Superunique\tName\tClass\tMod1\tMod2\tMod3\tMinGrp\tMaxGrp\tAutoPos\tStacks\tReplaceable\tUtrans\tTC\tTC(N)\tTC(H)
Bishibosh\tBishibosh\tfallenshaman1\t8\t9\t0\t5\t7\t0\t0\t0\t0\tAct 1 Super A\tAct 1 (N) Super A\tAct 1 (H) Super A
Rakanishu\tRakanishu\tfallen1\t17\t6\t0\t6\t8\t0\t0\t0\t0\tAct 1 Super A\tAct 1 (N) Super A\tAct 1 (H) Super A
Treehead WoodFist\tTreehead WoodFist\tbrute1\t5\t6\t0\t3\t4\t0\t0\t0\t0\tAct 1 Super B\tAct 1 (N) Super B\tAct 1 (H) Super B
The Countess\tThe Countess\tcorruptrogue5\t9\t0\t0\t4\t6\t0\t0\t0\t0\tCountess\tCountess (N)\tCountess (H)
Blood Raven\tBlood Raven\tcorruptrogue1\t9\t6\t0\t6\t8\t0\t0\t0\t0\tBlood Raven\tBlood Raven (N)\tBlood Raven (H)
Creeping Feature\tCreeping Feature\tmummy1\t5\t18\t0\t4\t6\t0\t0\t0\t0\tAct 2 Super A\tAct 2 (N) Super A\tAct 2 (H) Super A
Beetleburst\tBeetleburst\tscarab2\t8\t0\t0\t4\t6\t0\t0\t0\t0\tAct 2 Super A\tAct 2 (N) Super A\tAct 2 (H) Super A
Dark Elder\tDark Elder\tzombie5\t6\t8\t0\t4\t6\t0\t0\t0\t0\tAct 2 Super B\tAct 2 (N) Super B\tAct 2 (H) Super B
Bloodwitch the Wild\tBloodwitch the Wild\tpantherwoman1\t7\t5\t0\t4\t6\t0\t0\t0\t0\tAct 2 Super B\tAct 2 (N) Super B\tAct 2 (H) Super B
Fangskin\tFangskin\tclawviper3\t17\t6\t0\t4\t6\t0\t0\t0\t0\tAct 2 Super C\tAct 2 (N) Super C\tAct 2 (H) Super C
Sszark the Burning\tSszark the Burning\tarach4\t5\t7\t0\t4\t6\t0\t0\t0\t0\tAct 3 Super A\tAct 3 (N) Super A\tAct 3 (H) Super A
Stormtree\tStormtree\tthornhulk3\t17\t6\t0\t4\t6\t0\t0\t0\t0\tAct 3 Super B\tAct 3 (N) Super B\tAct 3 (H) Super B
Witch Doctor Endugu\tWitch Doctor Endugu\tfetishshaman4\t8\t9\t0\t4\t6\t0\t0\t0\t0\tAct 3 Super B\tAct 3 (N) Super B\tAct 3 (H) Super B
Battlemaid Sarina\tBattlemaid Sarina\tcorruptrogue5\t6\t27\t0\t4\t6\t0\t0\t0\t0\tAct 3 Super C\tAct 3 (N) Super C\tAct 3 (H) Super C
Izual\tIzual\tizual\t18\t0\t0\t0\t0\t0\t0\t0\t0\tIzual\tIzual (N)\tIzual (H)
Hephasto the Armorer\tHephasto the Armorer\thephasto\t27\t30\t0\t0\t0\t0\t0\t0\t0\tHaphesto\tHaphesto (N)\tHaphesto (H)
Grand Vizier of Chaos\tGrand Vizier of Chaos\tfingermage3\t5\t9\t0\t9\t9\t1\t0\t0\t26\tAct 4 Super B\tAct 4 (N) Super B\tAct 4 (H) Super B
Lord De Seis\tLord De Seis\tdoomknight3\t5\t30\t24\t5\t5\t1\t0\t0\t11\tAct 4 Super C\tAct 4 (N) Super C\tAct 4 (H) Super C
Infector of Souls\tInfector of Souls\tmegademon3\t6\t27\t0\t9\t9\t1\t0\t0\t26\tAct 4 Super B\tAct 4 (N) Super B\tAct 4 (H) Super B
Dac Farren\tDac Farren\timp3\t18\t0\t0\t4\t4\t0\t0\t1\t36\tAct 5 Super B\tAct 5 (N) Super B\tAct 5 (H) Super B
Shenk the Overseer\tSiege Boss\toverseer1\t5\t0\t0\t0\t0\t0\t1\t0\t7\tAct 5 Super A\tAct 5 (N) Super A\tAct 5 (H) Super A
Eldritch the Rectifier\tMegaflow Rectifier\tminion1\t1\t6\t0\t8\t8\t0\t0\t1\t21\tAct 5 Super A\tAct 5 (N) Super A\tAct 5 (H) Super A
Sharptooth Slayer\tSharp Tooth Sayer\toverseer3\t6\t0\t0\t3\t3\t0\t0\t1\t24\tAct 5 Super B\tAct 5 (N) Super B\tAct 5 (H) Super B
Eyeback the Unleashed\tEyeback Unleashed\tdeathmauler1\t5\t6\t0\t2\t2\t0\t0\t0\t8\tAct 5 Super A\tAct 5 (N) Super A\tAct 5 (H) Super A
Thresh Socket\tThreash Socket\tsiegebeast3\t7\t0\t0\t0\t0\t0\t0\t0\t37\tAct 5 Super Cx\tAct 5 (N) Super Cx\tAct 5 (H) Super Cx
Frozenstein\tFrozenstein\tsnowyeti4\t18\t25\t0\t5\t6\t0\t0\t0\t19\tAct 5 Super C\tAct 5 (N) Super C\tAct 5 (H) Super C
Bonesaw Breaker\tBonesaw Breaker\treanimatedhorde2\t5\t8\t0\t5\t5\t0\t0\t0\t35\tAct 5 Super A\tAct 5 (N) Super A\tAct 5 (H) Super A
Snapchip Shatter\tSnapchip Shatter\tfrozenhorror1\t7\t18\t0\t4\t4\t0\t0\t0\t23\tAct 5 Super C\tAct 5 (N) Super C\tAct 5 (H) Super C
Talic\tAncient Barbarian 1\tancientbarb1\t0\t0\t0\t0\t0\t0\t1\t0\t25\t\t\t
Madawc\tAncient Barbarian 2\tancientbarb2\t0\t0\t0\t0\t0\t0\t1\t0\t26\t\t\t
Korlic\tAncient Barbarian 3\tancientbarb3\t0\t0\t0\t0\t0\t0\t1\t0\t11\t\t\t
Pindleskin\tPindleskin\treanimatedhorde5\t9\t0\t0\t6\t6\t0\t0\t0\t22\tAct 5 Super Cx\tAct 5 (N) Super Cx\tAct 5 (H) Super Cx
Nihlathak\tNihlathak\tnihlathakboss\t0\t0\t0\t0\t0\t0\t1\t0\t28\tNihlathak\tNihlathak (N)\tNihlathak (H)
Colenzo the Annihilator\tBaal Subject 1\tfallenshaman5\t9\t0\t0\t5\t5\t0\t1\t0\t29\tAct 5 Champ C\tAct 5 (N) Champ C\tAct 5 (H) Champ C
Achmel the Cursed\tBaal Subject 2\tunraveler5\t23\t0\t0\t3\t3\t0\t1\t0\t21\tAct 5 Champ C\tAct 5 (N) Champ C\tAct 5 (H) Champ C
Bartuc the Bloody\tBaal Subject 3\tbaalhighpriest\t17\t0\t0\t5\t5\t0\t1\t0\t36\tAct 5 Champ C\tAct 5 (N) Champ C\tAct 5 (H) Champ C
Ventar the Unholy\tBaal Subject 4\tvenomlord\t6\t0\t0\t8\t8\t0\t1\t0\t20\tAct 5 Champ C\tAct 5 (N) Champ C\tAct 5 (H) Champ C
Lister the Tormentor\tBaal Subject 5\tbaalminion1\t27\t0\t0\t5\t5\t0\t1\t0\t20\tAct 5 Champ C\tAct 5 (N) Champ C\tAct 5 (H) Champ C`

function buildCanonicalSuperUniquesTable(): D2Table & readonly (SuperUnique & {
  readonly superunique: string
  readonly name: string
  readonly class: string
})[] {
  const landmarkTable = parseTable(new TextEncoder().encode(CANONICAL_SUPERUNIQUES_TSV.trim()))
  const fullTable = parseTable(new TextEncoder().encode(RAW_SUPERUNIQUES.trim()))
  const seenIds = new Set<string>()
  const mergedRows: (readonly string[])[] = []

  for (const row of landmarkTable.rows) {
    const id = cell(landmarkTable, row, 'Superunique').trim()
    if (id !== '') {
      seenIds.add(id.toLowerCase())
      mergedRows.push(row)
    }
  }

  for (const row of fullTable.rows) {
    const id = cell(fullTable, row, 'Superunique').trim()
    const cls = cell(fullTable, row, 'Class').trim()
    if (id === '' || cls === '' || seenIds.has(id.toLowerCase())) continue
    seenIds.add(id.toLowerCase())
    mergedRows.push(
      landmarkTable.header.map(col => cell(fullTable, row, col).trim()),
    )
  }

  const d2Table: D2Table = {
    header: landmarkTable.header,
    rows: mergedRows,
  }
  const entries = readSuperUniques(d2Table).map(su => ({
    ...su,
    superunique: su.id,
    name: su.nameKey,
    class: su.monsterId,
  }))
  return Object.assign(entries, d2Table)
}

/** Canonical SuperUniques table parsed from canonical game TSV. */
export const CANONICAL_SUPERUNIQUES_TABLE = buildCanonicalSuperUniquesTable()

/**
 * Build landmark specifications for canonical SuperUniques from a `SuperUniques.txt` table.
 *
 * @param table - the parsed `SuperUniques.txt` (defaults to `CANONICAL_SUPERUNIQUES_TABLE`).
 * @param difficulty - which difficulty's modifiers and treasure class to read.
 * @returns map of levelId to SuperUniqueLandmarkSpec or array of specs.
 */
export function buildSuperUniqueLandmarkSpecs(
  table: D2Table = CANONICAL_SUPERUNIQUES_TABLE,
  difficulty: Difficulty = 'normal',
): Record<number, SuperUniqueLandmarkSpec | readonly SuperUniqueLandmarkSpec[]> {
  const suList = readSuperUniques(table, difficulty)
  const suMap = new Map<string, SuperUnique>()
  for (const su of suList) {
    suMap.set(su.id.toLowerCase(), su)
    if (su.nameKey) {
      suMap.set(su.nameKey.toLowerCase(), su)
    }
  }
  for (const [aliasKey, aliasSpec] of Object.entries(SUPERUNIQUE_TBL_ALIASES)) {
    const lowerAlias = aliasKey.toLowerCase()
    if (!suMap.has(lowerAlias) && aliasSpec.tblKey) {
      const target = suMap.get(aliasSpec.tblKey.toLowerCase())
      if (target) {
        suMap.set(lowerAlias, target)
      }
    }
  }

  const modNameById = new Map<number, string>([
    [24, 'thief'],
  ])
  for (const m of CANONICAL_ELITE_MODIFIERS) {
    modNameById.set(m.id, m.name)
  }

  const byLevel: Record<number, SuperUniqueLandmarkSpec[]> = {}

  for (const mapping of CANONICAL_SUPER_UNIQUE_LANDMARKS) {
    const su = suMap.get(mapping.id.toLowerCase())
    if (!su) continue
    const modifiers = su.modifiers
      .map(id => modNameById.get(id))
      .filter((name): name is string => name !== undefined)
    const spec: SuperUniqueLandmarkSpec = {
      id: su.id,
      name: su.nameKey || su.id,
      monsterId: su.monsterId,
      landmark: mapping.landmark,
      modifiers,
      minMinions: su.minMinions,
      maxMinions: su.maxMinions,
      minionMonsterId: mapping.minionMonsterId ?? su.monsterId,
    }
    for (const levelId of mapping.levelIds) {
      if (!byLevel[levelId]) {
        byLevel[levelId] = []
      }
      byLevel[levelId].push(spec)
    }
  }

  const result: Record<number, SuperUniqueLandmarkSpec | readonly SuperUniqueLandmarkSpec[]> = {}
  for (const [lvlStr, specs] of Object.entries(byLevel)) {
    const lvl = Number(lvlStr)
    result[lvl] = specs.length === 1 ? specs[0]! : specs
  }
  return result
}

/** Canonical outdoor SuperUniques tied to level landmarks across Acts 1-5. */
export const CANONICAL_SUPER_UNIQUES_BY_LEVEL: Readonly<
  Record<number, SuperUniqueLandmarkSpec | readonly SuperUniqueLandmarkSpec[]>
> = buildSuperUniqueLandmarkSpecs()

/** What one level's population came out as. */
export interface PlannedLevel {
  /** `Levels.txt` id. */
  readonly levelId: number
  /** `Levels.txt` name, for reporting. */
  readonly levelName: string
  /** The monster ids the level drew, in the order they were drawn. */
  readonly types: readonly string[]
  /** How many monsters the density asked for. */
  readonly budget: number
  /** The packs, ready to hand to `spawnMonsterPacks`. */
  readonly packs: readonly MonsterPack[]
  /** How many packs are champion or unique. */
  readonly elitePacks: number
  /**
   * Levels whose `MonLvl.txt` row was missing while rolling this population.
   *
   * Non-empty means some of {@link PlannedLevel.packs} carry raw `MonStats.txt`
   * numbers rather than scaled ones — roughly 20x too strong — because
   * {@link monsterScaleFor} had to fall back to {@link UNSCALED}. Empty is the
   * healthy case, and the only one a bake should accept.
   */
  readonly missingScalingLevels: readonly number[]
  /** Fixed SuperUnique bosses planned for this level (e.g. Bishibosh, Rakanishu). */
  readonly superUniques?: readonly string[]
}

/**
 * Go from a level id to packs of rolled monsters in one call.
 *
 * Two callers need this and they must not disagree: the browser reading the
 * archives directly, and the pack baker writing the level out as JSON. Keeping
 * the chain — plan, select types, budget, group, roll stats — in one function
 * is what makes "the baked level matches the live one" a property rather than
 * a coincidence.
 *
 * Every random choice comes from `seed`, so the same level is the same level on
 * a reload, in a replay, and on a second machine.
 *
 * @param tables - `Levels.txt`, `MonStats.txt` and `MonLvl.txt`.
 * @param levelId - which level.
 * @param cells - the level's area in cells, for the density conversion.
 * @param seed - the level seed.
 * @param walkSpeedPx - the player's walking speed, the anchor for monster speed.
 * @param difficulty - which difficulty's columns to read.
 * @param options - optional landmark overrides with exact tile/pixel positions.
 * @returns the population, empty for a town or an unknown level.
 */
export function planLevelMonsters(
  tables: {
    readonly levels: D2Table
    readonly monstats: D2Table
    readonly monlvl: D2Table
    readonly monstats2?: D2Table
    readonly superuniques?: D2Table
  },
  levelId: number,
  cells: number,
  seed: number,
  walkSpeedPx: number,
  difficulty: Difficulty = 'normal',
  options?: {
    readonly landmarks?: readonly {
      readonly id: string
      readonly tileX: number
      readonly tileY: number
      readonly fixedPosition?: { readonly x: number; readonly y: number }
    }[]
    readonly densityMultiplier?: number | undefined
    readonly eliteMultiplier?: number | 'all' | undefined
  },
): PlannedLevel {
  const empty: PlannedLevel = {
    levelId, levelName: '', types: [], budget: 0, packs: [], elitePacks: 0, missingScalingLevels: [],
  }
  const plan = readLevelMonsterPlan(tables.levels, levelId, difficulty)
  if (plan === null) return empty

  const kinds = readMonsterKinds(tables.monstats, difficulty)
  const artMap = tables.monstats2 ? readMonsterArt(tables.monstats2, kinds) : undefined
  const scaling = readMonsterScaling(tables.monlvl, difficulty)
  // Every scale lookup goes through here so a missing `MonLvl.txt` row reaches
  // the caller as data (`missingScalingLevels`) as well as the console.
  const missingScaling = new Set<number>()
  const scaleAt = (level: number): MonsterScale => {
    if (monsterScaleLookup(scaling, level).missing) missingScaling.add(level)
    return monsterScaleFor(scaling, level)
  }
  // Three independent streams off the one seed. Sharing a single stream would
  // make the type choice depend on how many monsters the density happened to
  // ask for, so a level would change its monsters when its size changed.
  const types = selectLevelTypes(plan, kinds, new Rng(seed ^ 0x7b10), difficulty)
  const density = options?.densityMultiplier !== undefined
    ? Math.round(plan.density * options.densityMultiplier)
    : plan.density
  const budget = monsterBudget(cells, density)
  const groups = planMonsterGroups(
    plan,
    types,
    kinds,
    budget,
    new Rng(seed ^ 0x9e37),
    options?.eliteMultiplier !== undefined ? { eliteMultiplier: options.eliteMultiplier } : undefined,
  )
  const rollRng = new Rng(seed ^ 0x2545)

  const packs: MonsterPack[] = groups.map(group => {
    const multiplier = ELITE_HEALTH_MULTIPLIER[group.rank]
    const members: MonsterStats[] = []
    const groupArt = artMap?.get(group.kind.id)
    for (let i = 0; i < group.count; i += 1) {
      const level = monsterLevelFor(group.kind, difficulty, plan.monsterLevel)
      const base = monsterStatsOf(group.kind, rollRng, walkSpeedPx, scaleAt(level), groupArt, level)
      // Elite health scaling:
      // Champions: all members receive champion bonus (3x HP in normal).
      // Uniques: leader receives unique bonus (4x HP in normal); minions receive minion bonus (2x HP in normal).
      const scale = group.rank === 'normal'
        ? 1
        : group.rank === 'champion'
          ? multiplier
          : (i === 0 ? multiplier : 1 + (MONUMOD_CONSTANTS.minionHpPct / 100))
      const scaled = scale === 1 ? base : { ...base, hp: Math.max(1, Math.round(base.hp * scale)) }
      const memberRank: MonsterRank = group.rank === 'normal' ? 'normal' : (i === 0 || group.rank === 'champion' ? group.rank : 'minion')
      const memberMods = (i === 0 || group.rank === 'champion') ? (group.modifiers ?? []) : []
      members.push(applyEliteModifiers(scaled, memberRank, memberMods))
    }
    return { members }
  })

  // Check if this level has fixed SuperUnique boss(es)
  const suMap = tables.superuniques
    ? buildSuperUniqueLandmarkSpecs(tables.superuniques, difficulty)
    : CANONICAL_SUPER_UNIQUES_BY_LEVEL
  const suRaw = suMap[levelId]
  const suSpecs: readonly SuperUniqueLandmarkSpec[] = Array.isArray(suRaw)
    ? suRaw
    : (suRaw !== undefined ? [suRaw] : [])
  const superUniques: string[] = []
  if (suSpecs.length > 0 && kinds.size > 0) {
    const suPacks: MonsterPack[] = []
    for (let suIdx = 0; suIdx < suSpecs.length; suIdx += 1) {
      const suSpec = suSpecs[suIdx]!
      const suRng = new Rng(seed ^ 0x55aa ^ (suIdx * 0x3c6ef35f))
      const bossKind = kinds.get(suSpec.monsterId) ?? kinds.get(suSpec.monsterId.replace(/\d+$/, '1'))
      if (!bossKind) continue
      const minionKind = kinds.get(suSpec.minionMonsterId) ?? kinds.get(suSpec.minionMonsterId.replace(/\d+$/, '1')) ?? bossKind
      const bossArt = artMap?.get(bossKind.id)
      const bossLevel = monsterLevelFor(bossKind, difficulty, plan.monsterLevel)
      const bossBase = monsterStatsOf(bossKind, suRng, walkSpeedPx, scaleAt(bossLevel), bossArt, bossLevel)
      const bossScaled: MonsterStats = {
        ...bossBase,
        id: suSpec.monsterId,
        name: suSpec.name,
        nameKey: suSpec.name,
        hp: Math.max(1, Math.round(bossBase.hp * ELITE_HEALTH_MULTIPLIER.unique)),
      }
      const bossStats = applyEliteModifiers(bossScaled, 'unique', suSpec.modifiers, suSpec.id)
      const minionCount = suRng.int(suSpec.minMinions, suSpec.maxMinions)
      const suMembers: MonsterStats[] = [bossStats]
      const minionArt = artMap?.get(minionKind.id)
      for (let m = 0; m < minionCount; m += 1) {
        const mLevel = monsterLevelFor(minionKind, difficulty, plan.monsterLevel)
        const mBase = monsterStatsOf(minionKind, suRng, walkSpeedPx, scaleAt(mLevel), minionArt, mLevel)
        const mScaled: MonsterStats = {
          ...mBase,
          id: suSpec.minionMonsterId,
          hp: Math.max(1, Math.round(mBase.hp * (1 + MONUMOD_CONSTANTS.minionHpPct / 100))),
        }
        suMembers.push(applyEliteModifiers(mScaled, 'minion', [], suSpec.id))
      }
      const matchedLandmark = options?.landmarks?.find(l => l.id === suSpec.id)
      const suPack: MonsterPack = {
        members: suMembers,
        superUniqueId: suSpec.id,
        ...(matchedLandmark?.fixedPosition !== undefined ? { fixedPosition: matchedLandmark.fixedPosition } : {}),
        ...(matchedLandmark !== undefined ? { landmarkTile: { tileX: matchedLandmark.tileX, tileY: matchedLandmark.tileY } } : {}),
      }
      suPacks.push(suPack)
      superUniques.push(suSpec.id)
    }
    packs.unshift(...suPacks)
  }

  const allMonsterTypes = [...types.map(kind => kind.id)]
  for (const pack of packs) {
    for (const member of pack.members) {
      if (!allMonsterTypes.includes(member.id)) {
        allMonsterTypes.push(member.id)
      }
    }
  }
  for (const suSpec of suSpecs) {
    if (!allMonsterTypes.includes(suSpec.monsterId)) {
      allMonsterTypes.push(suSpec.monsterId)
    }
    if (!allMonsterTypes.includes(suSpec.minionMonsterId)) {
      allMonsterTypes.push(suSpec.minionMonsterId)
    }
  }

  return {
    levelId,
    levelName: plan.levelName,
    types: allMonsterTypes,
    budget,
    packs,
    elitePacks: groups.filter(group => group.rank !== 'normal').length + superUniques.length,
    missingScalingLevels: [...missingScaling].sort((a, b) => a - b),
    ...(superUniques.length > 0 ? { superUniques } : {}),
  }
}

/**
 * Enrich a `MonsterStats` record with canonical `MonStats.txt` and `SuperUniques.txt` metadata
 * (`nameKey`, `descKey`, `isUndead`, `isDemon`, `isBoss`, `killable`, `inTown`, `resistances`)
 * so pre-baked `scene.json` packs carry full 1.13c hover lifebar and subtext attributes.
 */
export function enrichMonsterStats(
  stats: MonsterStats,
  kinds: ReadonlyMap<string, MonsterKind>,
  superUniques?: ReadonlyMap<string, SuperUnique>,
): MonsterStats {
  const kind = kinds.get(stats.id) ?? kinds.get(stats.id.toLowerCase()) ?? kinds.get(stats.id.replace(/\d+$/, '1'))
  if (!kind) return stats
  const isSuperUniqueLeader = stats.superUniqueId !== undefined && stats.rank === 'unique'
  const su = isSuperUniqueLeader && superUniques
    ? (superUniques.get(stats.superUniqueId!.toLowerCase()) ?? superUniques.get(stats.superUniqueId!))
    : undefined
  const nameKey = stats.nameKey ?? (isSuperUniqueLeader ? (su?.nameKey || stats.name || stats.superUniqueId) : (kind.nameKey || stats.name))
  const rawDesc = stats.descKey ?? (kind.descKey !== '' ? kind.descKey : undefined)
  const descKey = rawDesc !== undefined && rawDesc !== '' && rawDesc.toLowerCase() !== 'dummy' ? rawDesc : undefined
  const kindWithMods = stats.modifiers && stats.modifiers.length > 0
    ? applyEliteModifiers(
        {
          ...stats,
          resistances: kind.resistances,
          lightningResist: kind.resistances.lightning,
        },
        stats.rank ?? 'normal',
        stats.modifiers,
        stats.superUniqueId,
      ).resistances ?? kind.resistances
    : kind.resistances
  const mergedRes: MonsterResistances = stats.modifiers && stats.modifiers.length > 0
    ? {
        physical: Math.max(kindWithMods.physical ?? 0, stats.resistances?.physical ?? kindWithMods.physical ?? 0),
        magic: Math.max(kindWithMods.magic ?? 0, stats.resistances?.magic ?? kindWithMods.magic ?? 0),
        fire: Math.max(kindWithMods.fire ?? 0, stats.resistances?.fire ?? kindWithMods.fire ?? 0),
        lightning: Math.max(kindWithMods.lightning ?? 0, stats.resistances?.lightning ?? kindWithMods.lightning ?? 0),
        cold: Math.max(kindWithMods.cold ?? 0, stats.resistances?.cold ?? kindWithMods.cold ?? 0),
        poison: Math.max(kindWithMods.poison ?? 0, stats.resistances?.poison ?? kindWithMods.poison ?? 0),
      }
    : (stats.resistances ? { ...kind.resistances, ...stats.resistances } : kind.resistances)
  return {
    ...stats,
    nameKey,
    ...(descKey !== undefined ? { descKey } : {}),
    isUndead: stats.isUndead ?? kind.isUndead,
    isDemon: stats.isDemon ?? kind.isDemon,
    isBoss: stats.isBoss ?? kind.boss,
    killable: stats.killable ?? kind.killable,
    inTown: stats.inTown ?? kind.inTown,
    resistances: mergedRes,
    resists: stats.modifiers && stats.modifiers.length > 0
      ? mergedRes
      : (stats.resists ? { ...mergedRes, ...stats.resists } : mergedRes),
    ...(mergedRes.lightning !== undefined ? { lightningResist: mergedRes.lightning } : {}),
  }
}

/**
 * Enrich an array of `MonsterPack`s with canonical `MonStats.txt` and `SuperUniques.txt` metadata.
 */
export function enrichMonsterPacks(
  packs: readonly MonsterPack[],
  kinds: ReadonlyMap<string, MonsterKind>,
  superUniques?: ReadonlyMap<string, SuperUnique>,
): MonsterPack[] {
  return packs.map(pack => ({
    ...pack,
    members: pack.members.map(member =>
      enrichMonsterStats(
        pack.superUniqueId !== undefined && member.superUniqueId === undefined
          ? { ...member, superUniqueId: pack.superUniqueId }
          : member,
        kinds,
        superUniques,
      ),
    ),
  }))
}

const DIFFICULTY_TIER_INDEX: Readonly<Record<Difficulty, 0 | 1 | 2>> = {
  normal: 0,
  nightmare: 1,
  hell: 2,
}

const cachedCanonicalMonsterKindsByDiff = new Map<Difficulty, Map<string, MonsterKind>>()
const cachedMonsterKindsByHcIdx = new Map<Difficulty, readonly (MonsterKind | undefined)[]>()
let cachedCanonicalMonAiTable: Map<string, MonAiRecord113c> | null = null
let cachedCanonicalMonLvlTable: readonly MonLvlEntry[] | null = null
let cachedSuperUniquesByIndex: readonly SuperUnique[] | null = null

function normalizeDifficulty(difficulty: Difficulty | number = 'normal'): Difficulty {
  if (typeof difficulty === 'number') {
    return difficulty === 2 ? 'hell' : difficulty === 1 ? 'nightmare' : 'normal'
  }
  return difficulty
}

export const MON_AI_TABLE: Readonly<Record<string, MonAi113cRow>> = (() => {
  const out: Record<string, MonAi113cRow> = {}
  for (const row of MONAI_113C_ROWS) {
    out[row.ai] = row
    out[row.ai.toLowerCase()] = row
  }
  return out
})()

function hydrateMonsterKindFrom113cRow(rec: MonStats113cRow, difficulty: Difficulty): MonsterKind {
  const tierIdx = DIFFICULTY_TIER_INDEX[difficulty]
  const tcByDifficulty: Record<Difficulty, readonly [string, string, string, string]> = {
    normal: [rec.tc[0], rec.tc[1], rec.tc[2], rec.tc[3]],
    nightmare: [rec.tc[4], rec.tc[5], rec.tc[6], rec.tc[7]],
    hell: [rec.tc[8], rec.tc[9], rec.tc[10], rec.tc[11]],
  }
  const tcPair = tcByDifficulty[difficulty]

  const elementalAttacks: MonsterElementalAttack[] = rec.elementalAttacks.map((el) => ({
    slot: el.slot,
    mode: el.mode,
    type: el.type,
    chancePct: el.pct[tierIdx],
    min: el.minD[tierIdx],
    max: el.maxD[tierIdx],
    durationFrames: el.dur[tierIdx],
    pct: el.pct[tierIdx],
    minDamage: el.minD[tierIdx],
    maxDamage: el.maxD[tierIdx],
    duration: el.dur[tierIdx],
  }))

  const skills: MonsterSkillEntry[] = rec.skills.map((sk) => ({
    slot: sk.slot,
    skill: sk.skill,
    skillId: sk.skillId,
    mode: sk.mode,
    level: sk.level,
  }))

  const rawMiss = MONSTER_MODE_MISSILES_113C[rec.hcIdx]
  const modeMissiles: MonsterModeMissiles = {
    ...rec.modeMissiles,
    ...(rawMiss?.A1 !== undefined ? { A1: rawMiss.A1, MissA1: rawMiss.A1 } : {}),
    ...(rawMiss?.A2 !== undefined ? { A2: rawMiss.A2, MissA2: rawMiss.A2 } : {}),
    ...(rawMiss?.S1 !== undefined ? { S1: rawMiss.S1, MissS1: rawMiss.S1 } : {}),
    ...(rawMiss?.S2 !== undefined ? { S2: rawMiss.S2, MissS2: rawMiss.S2 } : {}),
    ...(rawMiss?.S3 !== undefined ? { S3: rawMiss.S3, MissS3: rawMiss.S3 } : {}),
    ...(rawMiss?.S4 !== undefined ? { S4: rawMiss.S4, MissS4: rawMiss.S4 } : {}),
    ...(rawMiss?.C !== undefined ? { C: rawMiss.C, MissC: rawMiss.C } : {}),
    ...(rawMiss?.SQ !== undefined ? { SQ: rawMiss.SQ, MissSQ: rawMiss.SQ } : {}),
  }
  const descKey = rec.descStr.toLowerCase() === 'dummy' ? '' : rec.descStr
  const aiRow = MON_AI_TABLE[rec.ai] ?? MON_AI_TABLE[rec.ai.toLowerCase()]

  const kind: MonsterKind = {
    id: rec.id,
    hcIdx: rec.hcIdx,
    difficulty,
    baseId: rec.baseId,
    ...(rec.nextInClass ? { nextInClass: rec.nextInClass } : {}),
    nameKey: rec.nameStr,
    descKey,
    code: rec.code,
    monType: rec.monType,
    ai: rec.ai,
    ...(aiRow !== undefined ? { aiId: aiRow.index } : {}),
    enabled: rec.enabled,
    isSpawn: rec.isSpawn,
    sparsePopulate: rec.sparsePopulate,
    isMelee: rec.isMelee,
    ranged: rec.rangedType,
    isRanged: rec.rangedType,
    npc: rec.npc,
    interact: rec.interact,
    inTown: rec.inTown,
    isUndead: rec.isLUndead || rec.isHUndead,
    isLowUndead: rec.isLUndead,
    isHighUndead: rec.isHUndead,
    lUndead: rec.isLUndead,
    hUndead: rec.isHUndead,
    isDemon: rec.isDemon,
    demon: rec.isDemon,
    boss: rec.boss,
    isBoss: rec.boss,
    primeevil: rec.primeevil,
    isPrimeEvil: rec.primeevil,
    noRatio: rec.noRatio,
    killable: rec.killable,
    isKillable: rec.killable,
    isFlying: rec.flying,
    flying: rec.flying,
    canOpenDoors: rec.opendoors,
    opendoors: rec.opendoors,
    neverCount: rec.neverCount,
    petIgnore: rec.petIgnore,
    deathDmg: rec.deathDmg,
    rarity: rec.rarity,
    minGroup: rec.minGrp,
    minGrp: rec.minGrp,
    maxGroup: rec.maxGrp,
    maxGrp: rec.maxGrp,
    partyMin: rec.partyMin,
    partyMax: rec.partyMax,
    level: [rec.level[0], rec.level[1], rec.level[2]],
    baseLevel: {
      normal: rec.level[0],
      nightmare: rec.level[1],
      hell: rec.level[2],
    },
    velocity: rec.velocity,
    runVelocity: rec.run,
    threat: rec.threat,
    aiDelay: rec.aidel[tierIdx],
    aiDistance: rec.aidist[tierIdx],
    aiDist: rec.aidist[tierIdx],
    aiParams: [
      rec.aip1[tierIdx],
      rec.aip2[tierIdx],
      rec.aip3[tierIdx],
      rec.aip4[tierIdx],
      rec.aip5[tierIdx],
      rec.aip6[tierIdx],
      rec.aip7[tierIdx],
      rec.aip8[tierIdx],
    ],
    minHp: rec.minHP[tierIdx],
    minHpByDifficulty: rec.minHP,
    maxHp: rec.maxHP[tierIdx],
    maxHpByDifficulty: rec.maxHP,
    armour: rec.ac[tierIdx],
    armor: rec.ac[tierIdx],
    armourByDifficulty: rec.ac,
    experience: rec.exp[tierIdx],
    xp: rec.exp[tierIdx],
    experienceByDifficulty: rec.exp,
    attack1: {
      minDamage: rec.a1.minD[tierIdx],
      maxDamage: rec.a1.maxD[tierIdx],
      toHit: rec.a1.th[tierIdx],
      min: rec.a1.minD[tierIdx],
      max: rec.a1.maxD[tierIdx],
      ...(rec.a1.move !== undefined ? { move: rec.a1.move } : {}),
      ...(rec.modeMissiles.MissA1 !== undefined ? { missile: rec.modeMissiles.MissA1 } : {}),
    },
    attack2: {
      minDamage: rec.a2.minD[tierIdx],
      maxDamage: rec.a2.maxD[tierIdx],
      toHit: rec.a2.th[tierIdx],
      min: rec.a2.minD[tierIdx],
      max: rec.a2.maxD[tierIdx],
      ...(rec.a2.move !== undefined ? { move: rec.a2.move } : {}),
      ...(rec.modeMissiles.MissA2 !== undefined ? { missile: rec.modeMissiles.MissA2 } : {}),
    },
    ...(rec.s1.maxD[tierIdx] > 0 || rec.s1.th[tierIdx] > 0 || rec.modeMissiles.MissS1
      ? {
          special1: {
            minDamage: rec.s1.minD[tierIdx],
            maxDamage: rec.s1.maxD[tierIdx],
            toHit: rec.s1.th[tierIdx],
            min: rec.s1.minD[tierIdx],
            max: rec.s1.maxD[tierIdx],
            ...(rec.s1.move !== undefined ? { move: rec.s1.move } : {}),
            ...(rec.modeMissiles.MissS1 !== undefined ? { missile: rec.modeMissiles.MissS1 } : {}),
          },
        }
      : {}),
    a1ByDifficulty: rec.a1,
    a2ByDifficulty: rec.a2,
    s1ByDifficulty: rec.s1,
    elementalAttacks,
    skills,
    modeMissiles,
    resistances: {
      physical: rec.resDm[tierIdx],
      magic: rec.resMa[tierIdx],
      fire: rec.resFi[tierIdx],
      lightning: rec.resLi[tierIdx],
      cold: rec.resCo[tierIdx],
      poison: rec.resPo[tierIdx],
    },
    drain: rec.drain[tierIdx],
    coldEffect: rec.coldEffect[tierIdx],
    damageRegen: rec.damageRegen,
    toBlock: rec.toBlock[tierIdx],
    crit: rec.crit,
    align: rec.align,
    treasureClasses: tcPair.filter((tc) => tc !== ''),
    minions: [...rec.minions],
    setBoss: rec.setBoss,
    meleeRange: rec.meleeRng,
    meleeRng: rec.meleeRng,
    sizeX: rec.sizeX,
    sizeY: rec.sizeY,
    height: rec.height,
    overlayHeight: rec.overlayHeight,
    pixHeight: rec.pixHeight,
    baseW: rec.baseW,
    hitClass: rec.hitClass,
  }

  const getTc = (diff: Difficulty = difficulty, mType = 1): string => {
    const tcForDiff = tcByDifficulty[diff] ?? tcByDifficulty.normal
    const normalTc = tcByDifficulty.normal
    if (mType === 4) {
      return tcForDiff[3] || tcForDiff[2] || tcForDiff[0] || normalTc[3] || normalTc[2] || normalTc[0] || ''
    }
    if (mType === 3) {
      return tcForDiff[2] || tcForDiff[0] || normalTc[2] || normalTc[0] || ''
    }
    if (mType === 2) {
      return tcForDiff[1] || tcForDiff[0] || normalTc[1] || normalTc[0] || ''
    }
    return tcForDiff[0] || normalTc[0] || ''
  }

  Object.defineProperty(kind, 'getTreasureClass', {
    value: getTc,
    enumerable: false,
    configurable: true,
    writable: true,
  })

  return kind
}

function ensureCanonicalMonsterCache(difficulty: Difficulty = 'normal'): {
  byId: Map<string, MonsterKind>
  byHcIdx: readonly (MonsterKind | undefined)[]
} {
  let byId = cachedCanonicalMonsterKindsByDiff.get(difficulty)
  let byHcIdx = cachedMonsterKindsByHcIdx.get(difficulty)
  if (!byId || !byHcIdx) {
    byId = new Map<string, MonsterKind>()
    const arr: (MonsterKind | undefined)[] = new Array(MONSTATS_113C_ROWS.length)
    for (const rec of MONSTATS_113C_ROWS) {
      const kind = hydrateMonsterKindFrom113cRow(rec, difficulty)
      arr[rec.hcIdx] = kind
      const existing = byId.get(rec.id)
      if (!existing) {
        byId.set(rec.id, kind)
      } else if (!existing.enabled && kind.enabled) {
        byId.set(`${existing.id}#${existing.hcIdx}`, existing)
        byId.set(rec.id, kind)
      } else {
        byId.set(`${rec.id}#${rec.hcIdx}`, kind)
      }
    }
    byHcIdx = arr
    cachedCanonicalMonsterKindsByDiff.set(difficulty, byId)
    cachedMonsterKindsByHcIdx.set(difficulty, byHcIdx)
  }
  return { byId, byHcIdx }
}

/**
 * Return the canonical 1.13c 734-entry `MonsterKind` map for the requested difficulty (`'normal' | 'nightmare' | 'hell'`).
 */
export function getCanonicalMonsterKinds(
  difficulty: Difficulty | number = 'normal',
): ReadonlyMap<string, MonsterKind> {
  const diff = normalizeDifficulty(difficulty)
  return ensureCanonicalMonsterCache(diff).byId
}

export const MONSTER_TABLE: ReadonlyMap<string, MonsterKind> & Readonly<Record<string, MonsterKind>> = new Proxy(
  new Map<string, MonsterKind>(),
  {
    get(_target, prop, _receiver) {
      const { byId, byHcIdx } = ensureCanonicalMonsterCache('normal')
      if (prop in byId) {
        const value = Reflect.get(byId, prop, byId)
        return typeof value === 'function' ? value.bind(byId) : value
      }
      if (typeof prop === 'string') {
        const direct = byId.get(prop) ?? byId.get(prop.toLowerCase())
        if (direct !== undefined) return direct
        if (/^\d+$/.test(prop)) {
          return byHcIdx[Number(prop)]
        }
      }
      return undefined
    },
    has(_target, prop) {
      const { byId, byHcIdx } = ensureCanonicalMonsterCache('normal')
      if (typeof prop === 'string') {
        if (byId.has(prop) || byId.has(prop.toLowerCase()) || prop in byId) return true
        if (/^\d+$/.test(prop)) {
          const idx = Number(prop)
          return idx >= 0 && idx < byHcIdx.length && byHcIdx[idx] !== undefined
        }
      }
      return false
    },
  },
) as unknown as ReadonlyMap<string, MonsterKind> & Readonly<Record<string, MonsterKind>>

/**
 * Look up a canonical 1.13c `MonsterKind` by numeric `MonStats.txt` `hcIdx` (`0..733`).
 */
export function getMonsterKindByClassId(
  classId: number,
  difficulty: Difficulty | number = 'normal',
): MonsterKind | undefined {
  return getMonsterKindByHcIdx(classId, difficulty)
}

/**
 * Look up a canonical 1.13c `MonsterKind` by its 0-based `MonStats.txt` / `monstats.bin` `hcIdx` (`0..733`)
 * and difficulty (`'normal' | 'nightmare' | 'hell'` or `0 | 1 | 2`).
 */
export function getMonsterKindByHcIdx(
  hcIdx: number,
  difficulty: Difficulty | number = 'normal',
): MonsterKind | undefined {
  if (!Number.isInteger(hcIdx) || hcIdx < 0 || hcIdx >= MONSTATS_113C_ROWS.length) return undefined
  const diff = normalizeDifficulty(difficulty)
  return ensureCanonicalMonsterCache(diff).byHcIdx[hcIdx]
}

/**
 * Look up mode-bound missiles (`MissA1`, `MissA2`, `MissS1..S4`, `MissC`, `MissSQ`) by monster `id` or `hcIdx`.
 */
export function getMonsterModeMissiles113c(
  idOrHcIdx: string | number,
): MonsterModeMissiles | undefined {
  if (typeof idOrHcIdx === 'number') {
    const kind = getMonsterKindByHcIdx(idOrHcIdx, 'normal')
    return kind?.modeMissiles
  }
  const kind =
    getCanonicalMonsterKinds('normal').get(idOrHcIdx) ??
    getCanonicalMonsterKinds('normal').get(idOrHcIdx.toLowerCase())
  return kind?.modeMissiles
}

export interface MonAiRecord113c extends MonAi113cRow {
  readonly id: number
  readonly params: readonly string[]
}

export const CANONICAL_MONAI_TABLE: readonly MonAiRecord113c[] = Object.freeze(
  MONAI_113C_ROWS.map((row) =>
    Object.freeze({
      ...row,
      id: row.index,
      params: row.paramDescriptions,
    }),
  ),
)

/**
 * Return the canonical 1.13c `MonAi.txt` table (`148` AI state machines) keyed by AI name.
 */
export function getCanonicalMonAiTable(): ReadonlyMap<string, MonAiRecord113c> {
  if (cachedCanonicalMonAiTable === null) {
    const map = new Map<string, MonAiRecord113c>()
    for (const row of CANONICAL_MONAI_TABLE) {
      map.set(row.ai, row)
      map.set(row.ai.toLowerCase(), row)
    }
    cachedCanonicalMonAiTable = map
  }
  return cachedCanonicalMonAiTable
}

export function getMonAi113c(aiId: string | number): MonAiRecord113c | undefined {
  if (typeof aiId === 'number') {
    return CANONICAL_MONAI_TABLE[aiId]
  }
  const map = getCanonicalMonAiTable()
  return map.get(aiId) ?? map.get(aiId.toLowerCase())
}

export const getMonAiRecord113c = getMonAi113c

export interface MonLvlEntry extends MonLvl113cRow {
  readonly armor: readonly [number, number, number]
  readonly toHit: readonly [number, number, number]
  readonly damage: readonly [number, number, number]
  readonly lArmor: readonly [number, number, number]
  readonly lToHit: readonly [number, number, number]
  readonly lDamage: readonly [number, number, number]
  readonly hpByDifficulty: Readonly<Record<Difficulty, number>>
  readonly damageByDifficulty: Readonly<Record<Difficulty, number>>
  readonly armorByDifficulty: Readonly<Record<Difficulty, number>>
  readonly toHitByDifficulty: Readonly<Record<Difficulty, number>>
  readonly xpByDifficulty: Readonly<Record<Difficulty, number>>
}

export type MonLvlRecord113c = MonLvlEntry

/**
 * Return the canonical 1.13c `MonLvl.txt` table (`111` rows for levels `0..110`).
 * In Expansion mode (`gbExpansion = 1`), `D2Game.dll` uses the `L-*` ladders (`lHp`, `lDm`, `lAc`, `lTh`, `lXp`).
 */
export function getCanonicalMonLvlTable(): readonly MonLvlEntry[] {
  if (cachedCanonicalMonLvlTable === null) {
    cachedCanonicalMonLvlTable = MONLVL_113C_ROWS.map((row) => ({
      ...row,
      armor: row.ac,
      toHit: row.th,
      damage: row.dm,
      lArmor: row.lAc,
      lToHit: row.lTh,
      lDamage: row.lDm,
      hpByDifficulty: {
        normal: row.level === 0 ? 0 : row.lHp[0],
        nightmare: row.level === 0 ? 0 : row.lHp[1],
        hell: row.level === 0 ? 0 : row.lHp[2],
      },
      damageByDifficulty: {
        normal: row.level === 0 ? 0 : row.lDm[0],
        nightmare: row.level === 0 ? 0 : row.lDm[1],
        hell: row.level === 0 ? 0 : row.lDm[2],
      },
      armorByDifficulty: {
        normal: row.level === 0 ? 0 : row.lAc[0],
        nightmare: row.level === 0 ? 0 : row.lAc[1],
        hell: row.level === 0 ? 0 : row.lAc[2],
      },
      toHitByDifficulty: {
        normal: row.level === 0 ? 0 : row.lTh[0],
        nightmare: row.level === 0 ? 0 : row.lTh[1],
        hell: row.level === 0 ? 0 : row.lTh[2],
      },
      xpByDifficulty: {
        normal: row.level === 0 ? 0 : row.lXp[0],
        nightmare: row.level === 0 ? 0 : row.lXp[1],
        hell: row.level === 0 ? 0 : row.lXp[2],
      },
    }))
  }
  return cachedCanonicalMonLvlTable
}

export const MON_LVL_TABLE: readonly MonLvlEntry[] = getCanonicalMonLvlTable()
export const CANONICAL_MONLVL_TABLE: readonly MonLvlEntry[] = MON_LVL_TABLE

export function getMonLvl113c(level: number): MonLvlEntry {
  const clamped = Math.max(0, Math.min(MON_LVL_TABLE.length - 1, Math.trunc(level)))
  return MON_LVL_TABLE[clamped]!
}

export const getMonLvlRecord113c = getMonLvl113c

export interface ScaledMonsterKind113c {
  readonly level: number
  readonly minHp: number
  readonly maxHp: number
  readonly armour: number
  readonly armor?: number | undefined
  readonly experience: number
  readonly xp?: number | undefined
  readonly a1MinD: number
  readonly a1MaxD: number
  readonly a1ToHit: number
  readonly a2MinD: number
  readonly a2MaxD: number
  readonly a2ToHit: number
  readonly s1MinD: number
  readonly s1MaxD: number
  readonly s1ToHit: number
  readonly attack1: MonsterAttack
  readonly attack2: MonsterAttack
  readonly special1?: MonsterAttack | undefined
  readonly elementalAttacks: readonly MonsterElementalAttack[]
}

/**
 * Deterministically scale a 1.13c `MonsterKind` or `MonStats113cRow` for a target `difficulty` and `mlvl`
 * using `MonLvl.txt` Expansion (`L-*`) columns, respecting `noRatio=1` (`D2Game.dll` `0x6fc613b0`).
 */
export function scaleMonsterKindForLevel113c(
  kindOrRow: MonsterKind | MonStats113cRow,
  difficulty: Difficulty | number = 'normal',
  levelOverride?: number,
): ScaledMonsterKind113c {
  const diff = normalizeDifficulty(difficulty)
  const tierIdx = DIFFICULTY_TIER_INDEX[diff]
  const mlvl = Math.max(
    0,
    Math.min(110, Math.trunc(levelOverride ?? kindOrRow.level[tierIdx] ?? kindOrRow.level[0] ?? 1)),
  )

  const isRawRow = 'minHP' in kindOrRow
  const rawMinHp = isRawRow
    ? kindOrRow.minHP[tierIdx]
    : (kindOrRow.minHpByDifficulty?.[tierIdx] ?? kindOrRow.minHp)
  const rawMaxHp = isRawRow
    ? kindOrRow.maxHP[tierIdx]
    : (kindOrRow.maxHpByDifficulty?.[tierIdx] ?? kindOrRow.maxHp)
  const rawAc = isRawRow
    ? kindOrRow.ac[tierIdx]
    : (kindOrRow.armourByDifficulty?.[tierIdx] ?? kindOrRow.armour)
  const rawExp = isRawRow
    ? kindOrRow.exp[tierIdx]
    : (kindOrRow.experienceByDifficulty?.[tierIdx] ?? kindOrRow.experience)

  const a1MinRaw = isRawRow
    ? kindOrRow.a1.minD[tierIdx]
    : (kindOrRow.a1ByDifficulty?.minD[tierIdx] ?? kindOrRow.attack1.minDamage)
  const a1MaxRaw = isRawRow
    ? kindOrRow.a1.maxD[tierIdx]
    : (kindOrRow.a1ByDifficulty?.maxD[tierIdx] ?? kindOrRow.attack1.maxDamage)
  const a1ThRaw = isRawRow
    ? kindOrRow.a1.th[tierIdx]
    : (kindOrRow.a1ByDifficulty?.th[tierIdx] ?? kindOrRow.attack1.toHit)

  const a2MinRaw = isRawRow
    ? kindOrRow.a2.minD[tierIdx]
    : (kindOrRow.a2ByDifficulty?.minD[tierIdx] ?? kindOrRow.attack2?.minDamage ?? 0)
  const a2MaxRaw = isRawRow
    ? kindOrRow.a2.maxD[tierIdx]
    : (kindOrRow.a2ByDifficulty?.maxD[tierIdx] ?? kindOrRow.attack2?.maxDamage ?? 0)
  const a2ThRaw = isRawRow
    ? kindOrRow.a2.th[tierIdx]
    : (kindOrRow.a2ByDifficulty?.th[tierIdx] ?? kindOrRow.attack2?.toHit ?? 0)

  const s1MinRaw = isRawRow
    ? kindOrRow.s1.minD[tierIdx]
    : (kindOrRow.s1ByDifficulty?.minD[tierIdx] ?? kindOrRow.special1?.minDamage ?? 0)
  const s1MaxRaw = isRawRow
    ? kindOrRow.s1.maxD[tierIdx]
    : (kindOrRow.s1ByDifficulty?.maxD[tierIdx] ?? kindOrRow.special1?.maxDamage ?? 0)
  const s1ThRaw = isRawRow
    ? kindOrRow.s1.th[tierIdx]
    : (kindOrRow.s1ByDifficulty?.th[tierIdx] ?? kindOrRow.special1?.toHit ?? 0)

  const rawElemental: readonly MonsterElementalAttack[] = isRawRow
    ? kindOrRow.elementalAttacks.map((el) => ({
        slot: el.slot,
        mode: el.mode,
        type: el.type,
        chancePct: el.pct[tierIdx],
        min: el.minD[tierIdx],
        max: el.maxD[tierIdx],
        durationFrames: el.dur[tierIdx],
        pct: el.pct[tierIdx],
        minDamage: el.minD[tierIdx],
        maxDamage: el.maxD[tierIdx],
        duration: el.dur[tierIdx],
      }))
    : (kindOrRow.elementalAttacks ?? [])

  if (kindOrRow.noRatio) {
    const a1MaxClamped = Math.max(a1MinRaw, a1MaxRaw)
    const a2MaxClamped = Math.max(a2MinRaw, a2MaxRaw)
    const s1MaxClamped = Math.max(s1MinRaw, s1MaxRaw)
    return {
      ...(!isRawRow ? kindOrRow : {}),
      level: mlvl,
      minHp: rawMinHp,
      maxHp: Math.max(rawMinHp, rawMaxHp),
      armour: rawAc,
      armor: rawAc,
      experience: rawExp,
      xp: rawExp,
      a1MinD: a1MinRaw,
      a1MaxD: a1MaxClamped,
      a1ToHit: a1ThRaw,
      a2MinD: a2MinRaw,
      a2MaxD: a2MaxClamped,
      a2ToHit: a2ThRaw,
      s1MinD: s1MinRaw,
      s1MaxD: s1MaxClamped,
      s1ToHit: s1ThRaw,
      attack1: {
        ...(!isRawRow ? kindOrRow.attack1 : {}),
        minDamage: a1MinRaw,
        maxDamage: a1MaxClamped,
        toHit: a1ThRaw,
        min: a1MinRaw,
        max: a1MaxClamped,
      },
      attack2: {
        ...(!isRawRow ? kindOrRow.attack2 : {}),
        minDamage: a2MinRaw,
        maxDamage: a2MaxClamped,
        toHit: a2ThRaw,
        min: a2MinRaw,
        max: a2MaxClamped,
      },
      ...((!isRawRow && kindOrRow.special1) || s1MaxClamped > 0 || s1ThRaw > 0
        ? {
            special1: {
              ...(!isRawRow && kindOrRow.special1 ? kindOrRow.special1 : {}),
              minDamage: s1MinRaw,
              maxDamage: s1MaxClamped,
              toHit: s1ThRaw,
              min: s1MinRaw,
              max: s1MaxClamped,
            },
          }
        : {}),
      elementalAttacks: rawElemental,
    }
  }

  const monLvl = getMonLvl113c(mlvl)
  const lHp = monLvl.lHp[tierIdx]
  const lDm = monLvl.lDm[tierIdx]
  const lAc = monLvl.lAc[tierIdx]
  const lTh = monLvl.lTh[tierIdx]
  const lXp = monLvl.lXp[tierIdx]

  const minHp = Math.max(1, Math.trunc((rawMinHp * lHp) / 100))
  const maxHp = Math.max(minHp, Math.trunc((rawMaxHp * lHp) / 100))
  const armour = Math.trunc((rawAc * lAc) / 100)
  const experience = Math.trunc((rawExp * lXp) / 100)

  const a1MinD = Math.trunc((a1MinRaw * lDm) / 100)
  const a1MaxD = Math.max(a1MinD, Math.trunc((a1MaxRaw * lDm) / 100))
  const a1ToHit = Math.trunc((a1ThRaw * lTh) / 100)

  const a2MinD = Math.trunc((a2MinRaw * lDm) / 100)
  const a2MaxD = Math.max(a2MinD, Math.trunc((a2MaxRaw * lDm) / 100))
  const a2ToHit = Math.trunc((a2ThRaw * lTh) / 100)

  const s1MinD = Math.trunc((s1MinRaw * lDm) / 100)
  const s1MaxD = Math.max(s1MinD, Math.trunc((s1MaxRaw * lDm) / 100))
  const s1ToHit = Math.trunc((s1ThRaw * lTh) / 100)

  const elementalAttacks: readonly MonsterElementalAttack[] = rawElemental.map((el) => {
    const elMin = Math.max(0, Math.trunc(((el.minDamage ?? el.min ?? 0) * lDm) / 100))
    const elMax = Math.max(elMin, Math.trunc(((el.maxDamage ?? el.max ?? 0) * lDm) / 100))
    return {
      ...el,
      min: elMin,
      max: elMax,
      minDamage: elMin,
      maxDamage: elMax,
    }
  })

  return {
    ...(!isRawRow ? kindOrRow : {}),
    level: mlvl,
    minHp,
    maxHp,
    armour,
    armor: armour,
    experience,
    xp: experience,
    a1MinD,
    a1MaxD,
    a1ToHit,
    a2MinD,
    a2MaxD,
    a2ToHit,
    s1MinD,
    s1MaxD,
    s1ToHit,
    attack1: {
      ...(!isRawRow ? kindOrRow.attack1 : {}),
      minDamage: a1MinD,
      maxDamage: a1MaxD,
      toHit: a1ToHit,
      min: a1MinD,
      max: a1MaxD,
    },
    attack2: {
      ...(!isRawRow ? kindOrRow.attack2 : {}),
      minDamage: a2MinD,
      maxDamage: a2MaxD,
      toHit: a2ToHit,
      min: a2MinD,
      max: a2MaxD,
    },
    ...((!isRawRow && kindOrRow.special1) || s1MaxD > 0 || s1ToHit > 0
      ? {
          special1: {
            ...(!isRawRow && kindOrRow.special1 ? kindOrRow.special1 : {}),
            minDamage: s1MinD,
            maxDamage: s1MaxD,
            toHit: s1ToHit,
            min: s1MinD,
            max: s1MaxD,
          },
        }
      : {}),
    elementalAttacks,
  }
}

export function scaleMonsterStatsForDifficulty(
  kind: MonsterKind,
  difficulty: Difficulty | number = 'normal',
  options?: {
    readonly level?: number
    readonly rank?: 'normal' | 'minion' | 'champion' | 'unique' | 'superunique'
    readonly playersCount?: number
    readonly playerCount?: number
    readonly roll?: number
  },
): MonsterStats {
  const diff = normalizeDifficulty(difficulty)
  return monsterStatsOf(kind, diff, 170, options?.roll ?? 0.5, {
    difficulty: diff,
    level: options?.level,
    rank: options?.rank,
    playersCount: options?.playersCount ?? options?.playerCount,
    playerCount: options?.playerCount ?? options?.playersCount,
  })
}

export interface ResolveMonsterStatsOptions extends Omit<MonsterStats113cOptions, 'rank'> {
  readonly rank?: MonsterRank | 'superunique' | string | undefined
  readonly championSubtype?: ChampionSubtype | number | string | undefined
  readonly modifiers?: readonly (string | number)[] | undefined
  readonly superUniqueId?: string | undefined
  readonly seed?: number | undefined
}

const CHAMPION_SUBTYPE_LOOKUP: Readonly<Record<string, ChampionSubtype | 16 | 36 | 37 | 38 | 39>> = {
  '16': 16,
  champion: 'champion',
  '36': 36,
  ghostly: 'ghostly',
  championghostly: 'ghostly',
  champion_ghostly: 'ghostly',
  '37': 37,
  fanatic: 'fanatic',
  fanatical: 'fanatic',
  championfanatic: 'fanatic',
  champion_fanatic: 'fanatic',
  '38': 38,
  possessed: 'possessed',
  championpossessed: 'possessed',
  champion_possessed: 'possessed',
  '39': 39,
  berserk: 'berserk',
  berserker: 'berserk',
  championberserk: 'berserk',
  champion_berserk: 'berserk',
}

export function resolveMonsterStats(
  kindOrId: MonsterKind | MonStats113cRow | string | number,
  difficultyOrOptions?: Difficulty | number | ResolveMonsterStatsOptions,
  maybeOptions?: ResolveMonsterStatsOptions,
): MonsterStats {
  const isOptsSecond =
    typeof difficultyOrOptions === 'object' && difficultyOrOptions !== null
  const options: ResolveMonsterStatsOptions | undefined = isOptsSecond
    ? (difficultyOrOptions as ResolveMonsterStatsOptions)
    : maybeOptions
  const fallbackKindDiff =
    typeof kindOrId === 'object' &&
    kindOrId !== null &&
    'difficulty' in kindOrId &&
    kindOrId.difficulty !== undefined
      ? kindOrId.difficulty
      : 'normal'
  const rawDiff: Difficulty | number = isOptsSecond
    ? (options?.difficulty ?? fallbackKindDiff)
    : ((difficultyOrOptions as Difficulty | number | undefined) ??
      options?.difficulty ??
      fallbackKindDiff)
  const diff = normalizeDifficulty(rawDiff)

  const kind: MonsterKind | undefined =
    typeof kindOrId === 'number'
      ? getMonsterKindByHcIdx(kindOrId, diff)
      : typeof kindOrId === 'string'
        ? (getCanonicalMonsterKinds(diff).get(kindOrId) ??
          getCanonicalMonsterKinds(diff).get(kindOrId.toLowerCase()))
        : 'minHP' in kindOrId
          ? getMonsterKindByHcIdx(kindOrId.hcIdx, diff)
          : kindOrId
  if (!kind) {
    throw new Error(`Unknown monster kind: ${String(kindOrId)}`)
  }

  const rawRank = String(
    options?.rank ??
      (options?.championSubtype !== undefined
        ? 'champion'
        : options?.superUniqueId !== undefined
          ? 'unique'
          : 'normal'),
  )
    .trim()
    .toLowerCase()
  const isChampSubtypeRank = rawRank.startsWith('champion_')
  const effectiveRank: MonsterRank = isChampSubtypeRank
    ? 'champion'
    : rawRank === 'superunique'
      ? 'unique'
      : ((rawRank as MonsterRank) || 'normal')

  const playerCount = Math.max(
    1,
    Math.min(8, Math.floor(options?.playerCount ?? options?.playersCount ?? 1)),
  )
  const rng = options?.seed !== undefined ? new Rng(options.seed) : options?.rng
  const base = monsterStatsOf(kind, {
    ...options,
    difficulty: diff,
    ...(rng !== undefined ? { rng } : {}),
    playersCount: 1,
    playerCount: 1,
    rank: effectiveRank,
  })

  const applyPlayersScaling = (st: MonsterStats): MonsterStats => {
    if (playerCount <= 1 || kind.noRatio) return st
    const scaledHp = Math.max(1, Math.floor((st.hp * (playerCount + 1)) / 2))
    const scaledXp = Math.max(0, Math.floor((st.xp * (playerCount + 1)) / 2))
    const bonusDmgAr = (val: number): number =>
      val <= 0 ? 0 : val + Math.floor((val * (playerCount - 1)) / 16)
    const scaledDamage = st.damage <= 0 ? 0 : bonusDmgAr(st.damage)
    const scaledToHit = bonusDmgAr(st.toHit ?? 0)
    return {
      ...st,
      hp: scaledHp,
      maxHp: scaledHp,
      xp: scaledXp,
      damage: scaledDamage,
      toHit: scaledToHit,
    }
  }

  const rawChampSubtype =
    options?.championSubtype ??
    (isChampSubtypeRank ? rawRank.replace(/^champion_/, '') : undefined) ??
    (effectiveRank === 'champion' && options?.modifiers?.length === 1
      ? options.modifiers[0]
      : undefined)
  if (
    effectiveRank === 'champion' &&
    (!options?.modifiers ||
      options.modifiers.length === 0 ||
      (options.modifiers.length === 1 &&
        CHAMPION_SUBTYPE_LOOKUP[String(options.modifiers[0]).trim().toLowerCase()] !== undefined))
  ) {
    const mapped =
      rawChampSubtype !== undefined
        ? CHAMPION_SUBTYPE_LOOKUP[String(rawChampSubtype).trim().toLowerCase()]
        : 'champion'
    if (mapped !== undefined) {
      return applyPlayersScaling(applyChampionSubtypeStats(base, mapped, diff))
    }
  }

  const strModifiers = [
    ...(options?.modifiers?.map((m) => String(m)) ?? []),
    ...(isChampSubtypeRank ? [rawRank.replace(/^champion_/, '')] : []),
    ...(options?.championSubtype !== undefined
      ? [String(options.championSubtype).replace(/^champion_/, '')]
      : []),
  ]
  const withElite =
    effectiveRank === 'normal' && strModifiers.length === 0 && options?.superUniqueId === undefined
      ? base
      : applyEliteModifiers(base, effectiveRank, diff, strModifiers, options?.superUniqueId)

  if (strModifiers.length > 0 && base.resistances) {
    const cappedRes = applyMonsterUModResistances(
      {
        physical: base.resistances.physical ?? 0,
        magic: base.resistances.magic ?? 0,
        fire: base.resistances.fire ?? 0,
        lightning: base.resistances.lightning ?? 0,
        cold: base.resistances.cold ?? 0,
        poison: base.resistances.poison ?? 0,
      },
      strModifiers,
    )
    return applyPlayersScaling({
      ...withElite,
      resistances: cappedRes,
      resists: cappedRes,
      lightningResist: cappedRes.lightning,
    })
  }
  return applyPlayersScaling(withElite)
}

/**
 * Canonical 1.13c Boss & SuperUnique Minion mapping (`SuperUniques.txt` + `MonStats.txt` `minion1`/`minion2`).
 */
export const CANONICAL_BOSS_MINIONS: Readonly<Record<string, readonly string[]>> = (() => {
  const map: Record<string, readonly string[]> = {
    fallenshaman1: ['fallen1', 'fallen2'],
    fallenshaman2: ['fallen2', 'fallen3'],
    fallenshaman3: ['fallen3', 'fallen4'],
    fallenshaman4: ['fallen4', 'fallen5'],
    fallenshaman5: ['fallen5', 'fallen5'],
    fetishshaman1: ['fetish1', 'fetish2'],
    fetishshaman2: ['fetish2', 'fetish3'],
    fetishshaman3: ['fetish3', 'fetish4'],
    fetishshaman4: ['fetish4', 'fetish5'],
    fetishshaman5: ['fetish5', 'fetish5'],
    greatermummy1: ['skeleton1', 'skeleton2'],
    greatermummy2: ['skeleton2', 'skeleton3'],
    greatermummy3: ['skeleton3', 'skeleton4'],
    greatermummy4: ['skeleton4', 'skeleton5'],
    greatermummy5: ['skeleton5', 'skeleton5'],
    overseer1: ['minion1', 'minion2'],
    overseer2: ['minion2', 'minion3'],
    overseer3: ['minion3', 'minion4'],
    overseer4: ['minion4', 'minion5'],
    overseer5: ['minion5', 'minion6'],
  }
  const normalKinds = getCanonicalMonsterKinds('normal')
  for (const row of SUPERUNIQUES_113C_ROWS) {
    const k = normalKinds.get(row.classId)
    const minions = k?.minions && k.minions.length > 0 ? k.minions : [row.classId]
    map[row.superunique] = minions
  }
  return Object.freeze(map)
})()

/**
 * Return all 66 canonical 1.13c `SuperUniques.txt` records.
 */
export function getCanonicalSuperUniques(): readonly SuperUnique[] {
  if (cachedSuperUniquesByIndex === null) {
    cachedSuperUniquesByIndex = SUPERUNIQUES_113C_ROWS.map((row) => {
      const su: SuperUnique = {
        index: row.hcIdx,
        hcIdx: row.hcIdx,
        id: row.superunique,
        nameKey: row.name,
        name: row.name,
        monsterId: row.classId,
        classId: row.classId,
        monSound: row.monSound,
        modifiers: row.mods,
        mods: row.mods,
        minMinions: row.minGrp,
        maxMinions: row.maxGrp,
        minGrp: row.minGrp,
        maxGrp: row.maxGrp,
        enhancementClass: row.eClass,
        eClass: row.eClass,
        autoPosition: row.autoPos,
        autoPos: row.autoPos,
        stacks: row.stacks,
        replaceable: row.replaceable,
        uTrans: row.uTrans,
        treasureClass: row.tc.normal,
        tc: row.tc,
      }
      Object.defineProperty(su, 'getTreasureClass', {
        value: (diff: Difficulty = 'normal'): string => row.tc[diff] ?? row.tc.normal,
        enumerable: false,
        configurable: true,
        writable: true,
      })
      return su
    })
  }
  return cachedSuperUniquesByIndex!
}

/**
 * Look up a canonical 1.13c `SuperUnique` by its 0-based `SuperUniques.txt` / `superuniques.bin` `wIdx` (`0..65`).
 */
export function getSuperUniqueByIndex(index: number): SuperUnique | undefined {
  if (!Number.isInteger(index) || index < 0) return undefined
  const list = getCanonicalSuperUniques()
  return list[index]
}

/**
 * Apply 1.13c `MonUMod` resistance bonuses (`D2Game.dll` `0x6fccf610`) to a monster's base difficulty resistances.
 *
 * Canonical 1.13c rules:
 * - At most 2 immunities (`res >= 100`) may be held when applying `magicresistant` (8), `fireenchant` (9),
 *   `lightenchant` (17), `coldenchant` (18), or `spectralhit` (27).
 * - `magicresistant` (8): checks `countImmunities() < 2` before EACH of `fire (+40)`, `lightning (+40)`, `cold (+40)`
 *   sequentially, so if fire crosses 100 and reaches 2 total immunities, lightning and cold are NOT incremented.
 * - `spectralhit` (27): checks `countImmunities() < 2` and `res < 75` before adding `+20` to fire, lightning, cold.
 * - `manahit` (25): adds `+20` magic resistance unconditionally.
 * - `stoneskin` (28): adds `+50` physical resistance unconditionally.
 */
export function applyMonsterUModResistances(
  base: MonsterResistances | MonsterKind,
  bossMods: readonly (number | string)[] | undefined,
  difficulty?: Difficulty | number,
): MonsterResistances {
  const maybeKind = base as Partial<MonsterKind>
  const resolvedBase: MonsterResistances =
    typeof maybeKind.resistances === 'object' && maybeKind.resistances !== null
      ? difficulty !== undefined && typeof maybeKind.hcIdx === 'number'
        ? (getMonsterKindByHcIdx(maybeKind.hcIdx, difficulty)?.resistances ??
          maybeKind.resistances)
        : maybeKind.resistances
      : (base as MonsterResistances)
  if (!bossMods || bossMods.length === 0) return resolvedBase

  let physical = resolvedBase.physical
  let magic = resolvedBase.magic
  let fire = resolvedBase.fire
  let lightning = resolvedBase.lightning
  let cold = resolvedBase.cold
  const poison = resolvedBase.poison

  const countImmunities = () =>
    (physical >= 100 ? 1 : 0) +
    (magic >= 100 ? 1 : 0) +
    (fire >= 100 ? 1 : 0) +
    (lightning >= 100 ? 1 : 0) +
    (cold >= 100 ? 1 : 0) +
    (poison >= 100 ? 1 : 0)

  for (const rawMod of bossMods) {
    const key = String(rawMod).trim().toLowerCase().replace(/[\s_-]+/g, '')
    if (key === '8' || key === 'magicresistant') {
      if (countImmunities() < 2) fire += 40
      if (countImmunities() < 2) lightning += 40
      if (countImmunities() < 2) cold += 40
    } else if (key === '9' || key === 'fireenchant' || key === 'fireenchanted') {
      if (countImmunities() < 2 || fire >= 100) fire += 75
    } else if (key === '17' || key === 'lightenchant' || key === 'lightningenchanted') {
      if (countImmunities() < 2 || lightning >= 100) lightning += 75
    } else if (key === '18' || key === 'coldenchant' || key === 'coldenchanted') {
      if (countImmunities() < 2 || cold >= 100) cold += 75
    } else if (key === '25' || key === 'manahit' || key === 'manaburn') {
      magic += 20
    } else if (key === '27' || key === 'spectralhit') {
      if (countImmunities() < 2 && fire < 75) fire += 20
      if (countImmunities() < 2 && lightning < 75) lightning += 20
      if (countImmunities() < 2 && cold < 75) cold += 20
    } else if (key === '28' || key === 'stoneskin') {
      physical += 50
    } else if (key === '36' || key === 'ghostly' || key === 'championghostly') {
      physical = Math.max(80, physical)
    }
  }

  return {
    physical,
    magic,
    fire,
    lightning,
    cold,
    poison,
  }
}

/**
 * Canonical 1.13c `UniquePrefix.txt` / `uniqueprefix.bin` `.tbl` keys (53 records).
 * Ground truth: `D2Common.dll` `0x6fdaa810` (`MONSTER_ChooseRandomUniquePrefix`, ordinal `10249`).
 */
export const UNIQUE_MONSTER_PREFIX_KEYS = [
  'GloomUM', 'Gray', 'DireUM', 'Black', 'ShadowUM', 'Haze', 'Wind', 'StormUM', 'Warp', 'Night',
  'Moon', 'Star', 'Pit', 'Fire', 'Cold', 'Seethe', 'SharpUM', 'AshUM', 'Blade', 'SteelUM',
  'StoneUM', 'Rust', 'Mold', 'Blight', 'Plague', 'Rot', 'Ooze', 'Puke', 'Snot', 'Bile',
  'BloodUM', 'Pulse', 'Gut', 'Gore', 'FleshUM', 'BoneUM', 'SpineUM', 'Mind', 'SpiritUM', 'SoulUM',
  'Wrath', 'GriefUM', 'Foul', 'Vile', 'Sin', 'ChaosUM', 'DreadUM', 'DoomUM', 'BaneUM', 'DeathUM',
  'ViperUM', 'Dragon', 'Devil',
] as const

/**
 * Canonical 1.13c `UniqueSuffix.txt` / `uniquesuffix.bin` `.tbl` keys (69 records).
 * Ground truth: `D2Common.dll` `0x6fdaa7d0` (`MONSTER_ChooseRandomUniqueSuffix`, ordinal `10852`).
 */
export const UNIQUE_MONSTER_SUFFIX_KEYS = [
  'touchUM', 'spellUM', 'feast', 'wound', 'grin', 'maim', 'hack', 'biteUM', 'rendUM', 'burn',
  'rip', 'kill', 'callUM', 'vex', 'jade', 'web', 'shieldUM', 'KillerUM', 'RazorUM', 'drinker',
  'shifter', 'crawler', 'dancer', 'bender', 'weaverUM', 'eater', 'widow', 'maggot', 'spawn', 'wight',
  'GrumbleUM', 'GrowlerUM', 'SnarlUM', 'wolf', 'crow', 'hawk', 'cloud', 'BangUM', 'head', 'skullUM',
  'browUM', 'eyeUM', 'maw', 'tongue', 'fangUM', 'hornUM', 'thorn', 'clawUM', 'fistUM', 'heartUM',
  'shankUM', 'skinUM', 'wingUM', 'pox', 'fester', 'blister', 'pus', 'SlimeUM', 'drool', 'froth',
  'sludge', 'venom', 'poison', 'break', 'shard', 'flame', 'maul', 'thirstUM', 'lust',
] as const

/**
 * Canonical 1.13c `UniqueAppellation.txt` / `uniqueappellation.bin` `.tbl` keys (25 records).
 * Ground truth: `D2Common.dll` `0x6fdaa790` (`MONSTER_ChooseRandomUniqueAppellation`, ordinal `10272`).
 */
export const UNIQUE_MONSTER_APPELLATION_KEYS = [
  'the Hammer', 'the Axe', 'the Sharp', 'the Jagged', 'the Flayer',
  'the Slasher', 'the Impaler', 'the Hunter', 'the Slayer', 'the Mauler',
  'the Destroyer', 'theQuick', 'the Witch', 'the Mad', 'the Wraith',
  'the Shade', 'the Dead', 'the Unholy', 'the Howler', 'the Grim',
  'the Dark', 'the Tainted', 'the Unclean', 'the Hungry', 'the Cold',
] as const

/**
 * `MonStats.txt` `hcIdx` values that bypass random Unique name rolling in `D2Client.dll` `0x6fad07cc..0x6fad08ec`
 * (`156` Andariel, `211` Duriel, `242` Mephisto, `243` Diablo, `256` Izual, `333` Diablo Clone, `544` Baal, `704..709` Uber Bosses).
 */
export const FIXED_UNIQUE_BOSS_HCIDX_SET: ReadonlySet<number> = new Set([
  156, 211, 242, 243, 256, 333, 544, 704, 705, 706, 707, 708, 709,
])

/**
 * Deterministic 1.13c random Unique monster name `.tbl` key sequence from `nameSeed`.
 *
 * Ground truth:
 * - `D2Client.dll` `0x6fb5e5cb..0x6fb5e5d8`: stores `wNameSeed = nameSeed & 0xff`.
 * - `D2Common.dll` `0x6fd86740` (`SEED_InitLowSeed`, ordinal `10614`): `low = wNameSeed`, `high = 0x29a` (`666`).
 * - `D2Common.dll` `0x6fd51100` / `D2Client.dll` `0x6fab1330`: 64-bit MWC RNG `prod = 0x6ac690c5ULL * low + high`.
 * - `D2Client.dll` `0x6fad08ef..0x6fad095c`:
 *   1. `suffix1 = ChooseSuffix(pUnit)` (`roll(69)`, pushed first in `cdecl`)
 *   2. `prefix1 = ChoosePrefix(pUnit)` (`roll(53)`, pushed second in `cdecl`)
 *   3. `chance = SEED_RollLimitedRandomNumber(&pUnit->pSeed, 100)` (`roll(100)`)
 *   4. If `chance < 50`:
 *      - `appellation = ChooseAppellation(pUnit)` (`roll(25)`, pushed first)
 *      - `suffix2 = ChooseSuffix(pUnit)` (`roll(69)`, pushed second)
 *      - `prefix2 = ChoosePrefix(pUnit)` (`roll(53)`, pushed third)
 *      - Formats `string.tbl#1722` (`"%0 %1 %2"`): `[prefix2, suffix2, appellation]`.
 *   5. Else (`chance >= 50`):
 *      - Formats `string.tbl#1721` (`"%0 %1"`): `[prefix1, suffix1]`.
 */
export function rollUniqueMonsterNameKeys(nameSeed: number): readonly string[] {
  let low = BigInt(nameSeed & 0xff)
  let high = 0x29an

  const roll = (range: number): number => {
    if (range <= 0) return 0
    const prod = 0x6ac690c5n * low + high
    low = prod & 0xffffffffn
    high = (prod >> 32n) & 0xffffffffn
    if ((range & (range - 1)) === 0) {
      return Number(low) & (range - 1)
    }
    return Number(low % BigInt(range))
  }

  const suffixIdx1 = roll(UNIQUE_MONSTER_SUFFIX_KEYS.length)
  const prefixIdx1 = roll(UNIQUE_MONSTER_PREFIX_KEYS.length)
  const chance = roll(100)

  if (chance < 50) {
    const appellationIdx = roll(UNIQUE_MONSTER_APPELLATION_KEYS.length)
    const suffixIdx2 = roll(UNIQUE_MONSTER_SUFFIX_KEYS.length)
    const prefixIdx2 = roll(UNIQUE_MONSTER_PREFIX_KEYS.length)
    return [
      UNIQUE_MONSTER_PREFIX_KEYS[prefixIdx2]!,
      UNIQUE_MONSTER_SUFFIX_KEYS[suffixIdx2]!,
      UNIQUE_MONSTER_APPELLATION_KEYS[appellationIdx]!,
    ]
  }

  return [
    UNIQUE_MONSTER_PREFIX_KEYS[prefixIdx1]!,
    UNIQUE_MONSTER_SUFFIX_KEYS[suffixIdx1]!,
  ]
}


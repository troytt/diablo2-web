/**
 * Diablo II v1.13c monster palette index and colormap selection (D2Client.dll), issue #1516 / #1517.
 *
 * Palette index (monster create 0x6fb57780, stored at gfx+0x34 and gfx+0x38):
 * 1. `idx = TransLvl + 2` when MonStats `TransLvl` (+0x4D) < 8, else 2 (0x6fb57a5e..0x6fb57a6d).
 * 2. Unique type flag (MonsterData+0x16 & 0x08, champions always carry it) and MonStats2 flag 15 `noUniqueShift`
 *    clear (0x6fb57a7e..0x6fb57a94): `idx = 0x6fb039e0(unit, nameSeed)` — SEED_InitLowSeed(&unit->seed, classId +
 *    (nameSeed & 0xFF)) then one LCG roll, `idx = lo % 30 + 9`. The 0xAC handler hands only the low byte of the 16-bit
 *    name seed over (`movzx si, al` at 0x6fb5e5cf; 0x6fb039e0 then reads `dx`). The roll re-seeds the unit's own seed.
 * 3. MonStats2 `Utrans`/`Utrans(N)`/`Utrans(H)` (+0x122 + difficulty) non-zero overrides it (0x6fb57aa3..0x6fb57ac2);
 *    the value 0xFF means `0x6fad1b10(unit) == 0`: 0 for a monster without owner (or whose owner is hostile to the
 *    local player, roster relation flag 8 via 0x6faffd90), 1 otherwise.
 * 4. Superunique flag (0x02): SuperUniques `Utrans`/`Utrans(N)`/`Utrans(H)` (+0x28 + difficulty) non-zero overrides it
 *    (0x6fb57adb..0x6fb57b17).
 * 5. `idx >= 30` → 2 (0x6fb57b1a..0x6fb57b1f).
 *
 * Colormap (0x6fb03a30, used by the Gfx draw path 0x6fb1c490):
 * - the class's palshift entry (0x6fb03c30) is NULL when its token ships no `\Cof\palshift.dat` → no colormap at all;
 * - idx 0/1 → palshift.dat[idx] only for classes 363/364 (necroskeleton / necromage), else none;
 * - idx 2..7 → palshift.dat[idx];
 * - idx >= 8 → RandTransforms.dat[idx - 8].
 * Not ported: the GreenBlood.dat-composed palshift copy (+0x804) used for idx 2..7 when the client option at
 * 0x6fbcc380 is set and MonStats2 +0x11C == 2 (0x6fb03adc..0x6fb03afd); the option is off by default.
 */

import { RAND_TRANSFORMS_113C, decodeBase64Bytes, type Pl2Transform } from '../formats/pl2.ts'
import { SEED_InitLowSeed, SEED_RollRandomNumber, type D2SeedStrc } from '../rng/d2-rng.ts'
import { MONSTATS2_FLAGINDEX, hasMonStats2Flag } from './monstats2-flags.ts'
import {
  MONSTER_PALETTE_COLUMNS_113C,
  MONSTER_PALSHIFT_BY_TOKEN,
  MONSTER_PALSHIFT_TABLES_B64,
  SUPERUNIQUE_UTRANS_113C,
} from './monster-palshift-113c.ts'

/** MonsterData+0x16 type flags (S2C 0xAC). */
export const MONFLAG_SUPERUNIQUE = 0x02
export const MONFLAG_UNIQUE = 0x08

/** Palette index the create path starts from when TransLvl >= 8, and the reset value for an index >= 30. */
const BASE_PALETTE_INDEX = 2
/** `cmp edi, 0x1e` at 0x6fb57b1a. */
const PALETTE_INDEX_LIMIT = 30
/** Utrans value resolved through the owner check 0x6fad1b10. */
const UTRANS_OWNER_CHECK = 0xff
/** Classes whose palette index 0/1 selects palshift.dat[0/1] (0x6fb03a7b..0x6fb03a89). */
const LOW_INDEX_CLASS_MIN = 363
const LOW_INDEX_CLASS_MAX = 364

export interface MonsterPaletteIndexInput {
  readonly classId: number
  /** MonsterData+0x16 type flags. */
  readonly flags: number
  /** S2C 0xAC 16-bit name seed (only its low byte is used). */
  readonly nameSeed?: number | undefined
  readonly superUniqueId?: number | undefined
  readonly difficulty: 0 | 1 | 2
  /** The unit's own seed: re-seeded by the unique roll exactly like 0x6fb039e0. */
  readonly seed: D2SeedStrc
  /** 0x6fad1b10: whether the monster has an owner that is not hostile to the local player. */
  readonly hasFriendlyOwner: boolean
}

function columns(classId: number): readonly [string, number, number, number, number] {
  const row = MONSTER_PALETTE_COLUMNS_113C[classId]
  if (row === undefined) throw new RangeError(`monster class ${String(classId)} is outside MonStats.txt`)
  return row
}

/** 0x6fb039e0: re-seed the unit seed from classId + low byte of the name seed and roll `% 30 + 9`. */
export function rollUniquePaletteIndex113c(seed: D2SeedStrc, classId: number, nameSeed: number): number {
  SEED_InitLowSeed(seed, (classId + (nameSeed & 0xff)) >>> 0)
  return (SEED_RollRandomNumber(seed) % 30) + 9
}

/** The palette index D2Client stores at gfx+0x38 when it creates a monster unit (0x6fb57780). */
export function resolveMonsterPaletteIndex113c(input: MonsterPaletteIndexInput): number {
  const [, transLvl, ...utrans] = columns(input.classId)
  let idx = transLvl < 8 ? transLvl + 2 : BASE_PALETTE_INDEX
  if ((input.flags & MONFLAG_UNIQUE) !== 0 && !hasMonStats2Flag(input.classId, MONSTATS2_FLAGINDEX.NOUNIQUESHIFT)) {
    if (input.nameSeed === undefined) {
      throw new Error(`unique monster class ${String(input.classId)} has no 0xAC name seed`)
    }
    idx = rollUniquePaletteIndex113c(input.seed, input.classId, input.nameSeed)
  }
  const u = utrans[input.difficulty] ?? 0
  if (u !== 0) idx = u === UTRANS_OWNER_CHECK ? (input.hasFriendlyOwner ? 1 : 0) : u
  if ((input.flags & MONFLAG_SUPERUNIQUE) !== 0 && input.superUniqueId !== undefined) {
    const su = SUPERUNIQUE_UTRANS_113C[input.superUniqueId]
    const s = su?.[input.difficulty] ?? 0
    if (s !== 0) idx = s
  }
  if (idx >= PALETTE_INDEX_LIMIT) idx = BASE_PALETTE_INDEX
  return idx
}

let decodedTables: Pl2Transform[] | null = null
function palshiftTables(): Pl2Transform[] {
  if (decodedTables === null) {
    const all = decodeBase64Bytes(MONSTER_PALSHIFT_TABLES_B64)
    decodedTables = []
    for (let off = 0; off < all.length; off += 256) decodedTables.push(all.subarray(off, off + 256))
  }
  return decodedTables
}

function isIdentity(table: Pl2Transform): boolean {
  for (let i = 0; i < 256; i += 1) if (table[i] !== i) return false
  return true
}

/**
 * 0x6fb03a30: the 256-byte colormap drawn for `classId` at `paletteIndex`, or null for no colormap. Identity tables
 * are reported as null (drawing through them changes nothing).
 */
export function resolveMonsterColormap113c(classId: number, paletteIndex: number): Pl2Transform | null {
  const [token] = columns(classId)
  const entries = MONSTER_PALSHIFT_BY_TOKEN[token]
  if (entries === undefined) return null
  let table: Pl2Transform | undefined
  if (paletteIndex <= 1) {
    if (classId < LOW_INDEX_CLASS_MIN || classId > LOW_INDEX_CLASS_MAX || paletteIndex < 0) return null
    table = palshiftTables()[entries[paletteIndex]!]
  } else if (paletteIndex <= 7) {
    table = palshiftTables()[entries[paletteIndex]!]
  } else {
    table = RAND_TRANSFORMS_113C[paletteIndex - 8]
  }
  if (table === undefined) throw new RangeError(`palette index ${String(paletteIndex)} has no colormap`)
  return isIdentity(table) ? null : table
}

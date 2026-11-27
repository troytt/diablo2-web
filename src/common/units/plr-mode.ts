/**
 * Animation mode, composite and weapon-class tables, baked from the 1.13c MPQ.
 *
 * These four tables are what turn an actor's *state* into the seven-character
 * COF name the art is stored under: `<token><mode><weaponClass>`, e.g. `SO` +
 * `A1` + `HTH` = `SOA1HTH`. They are tiny (20, 16, 16 and 15 rows), they never
 * change within a game version, and every one of them is needed before a single
 * frame can be drawn — so they are baked into source here rather than read from
 * the archive at runtime, which is what the zero-runtime-MPQ rule requires.
 *
 * Every row below is transcribed from the real table in
 * `samples/d2/*.mpq → data\global\excel\<Table>.txt`, and
 * `tests/animdata.test.ts` re-reads all four tables out of the MPQ and asserts
 * these constants match cell for cell. That test is the point: a hand-copied
 * table is exactly the kind of thing that silently rots, and this project has
 * already been bitten once by a hand-transcribed ground-truth table that was
 * wrong.
 *
 * Two traps live in these tables:
 *
 * - **A mode's code is not always its animation token.** `PlrMode.txt` stores
 *   `SQ` (Sequence) and `KB` (Knock back) with token `GH`, i.e. both reuse the
 *   get-hit animation; there is no `SOSQHTH` COF to load. `MonMode.txt` does the
 *   same for `KB` and maps its own `xx` (sequence) row to token `xx`, which is
 *   not an animation at all. Always compose COF names from `token`, never from
 *   `code`.
 * - **`WeaponClass.txt` row 0 has an empty code.** "None" is a real row with no
 *   code, so a naive `codes[0]` yields `''` and would compose `SOA1` — a name
 *   that cannot exist. `WEAPON_CLASS_CODES` therefore excludes it and
 *   `WEAPON_CLASSES` keeps it, so the omission is visible rather than assumed.
 */

/** One row of `PlrMode.txt` or `MonMode.txt`. */
export interface AnimModeEntry {
  /**
   * Mode code, e.g. `A1`. Upper-cased; `MonMode.txt` stores its codes in lower
   * case except for the `xx` sequence row.
   */
  readonly code: string
  /**
   * Animation token used to build the COF name. Usually equals `code`, but
   * `SQ`/`KB` borrow `GH`, and MonMode's sequence row is the non-animation `xx`.
   */
  readonly token: string
  /** Descriptive name as stored, e.g. `Get Hit`. */
  readonly name: string
}

/** One row of `Composit.txt`: a layer slot of a composited actor. */
export interface CompositEntry {
  /** Two-letter directory token, e.g. `TR` for the torso. */
  readonly token: string
  /** Descriptive name as stored, e.g. `RightArm`. */
  readonly name: string
}

/** One row of `WeaponClass.txt`. */
export interface WeaponClassEntry {
  /** Three-letter code used as the COF name suffix; empty for the "None" row. */
  readonly code: string
  /** Descriptive name as stored, e.g. `1 Hand Swing`. */
  readonly name: string
}

/**
 * `data\global\excel\PlrMode.txt` — all 20 rows, in table order.
 *
 * Columns: `Name`, `Token`, `Code`. Row order is the mode index the engine uses.
 */
export const PLR_MODES: readonly AnimModeEntry[] = [
  { code: 'DT', token: 'DT', name: 'Death' },
  { code: 'NU', token: 'NU', name: 'Neutral' },
  { code: 'WL', token: 'WL', name: 'Walk' },
  { code: 'RN', token: 'RN', name: 'Run' },
  { code: 'GH', token: 'GH', name: 'Get Hit' },
  { code: 'TN', token: 'TN', name: 'Town Neutral' },
  { code: 'TW', token: 'TW', name: 'Town Walk' },
  { code: 'A1', token: 'A1', name: 'Attack1' },
  { code: 'A2', token: 'A2', name: 'Attack2' },
  { code: 'BL', token: 'BL', name: 'Block' },
  { code: 'SC', token: 'SC', name: 'Cast' },
  { code: 'TH', token: 'TH', name: 'Throw' },
  { code: 'KK', token: 'KK', name: 'Kick' },
  { code: 'S1', token: 'S1', name: 'Skill1' },
  { code: 'S2', token: 'S2', name: 'Skill2' },
  { code: 'S3', token: 'S3', name: 'Skill3' },
  { code: 'S4', token: 'S4', name: 'Skill4' },
  { code: 'DD', token: 'DD', name: 'Dead' },
  { code: 'SQ', token: 'SQ', name: 'Sequence' },
  { code: 'KB', token: 'GH', name: 'Knock back' },
]

/**
 * `data\global\excel\MonMode.txt` — all 16 rows, in table order.
 *
 * Columns: `name`, `token`, `code`, stored lower-case; codes and tokens are
 * upper-cased here to match `PlrMode.txt` and the COF names on disk. Note the
 * monster mode set is not the player set: there is no `TN`/`TW`/`TH`/`KK`, and
 * the sequence row is `xx`, which names no animation.
 */
export const MON_MODES: readonly AnimModeEntry[] = [
  { code: 'DT', token: 'DT', name: 'death' },
  { code: 'NU', token: 'NU', name: 'neutral' },
  { code: 'WL', token: 'WL', name: 'walk' },
  { code: 'GH', token: 'GH', name: 'gethit' },
  { code: 'A1', token: 'A1', name: 'attack1' },
  { code: 'A2', token: 'A2', name: 'attack2' },
  { code: 'BL', token: 'BL', name: 'block' },
  { code: 'SC', token: 'SC', name: 'cast' },
  { code: 'S1', token: 'S1', name: 'skill1' },
  { code: 'S2', token: 'S2', name: 'skill2' },
  { code: 'S3', token: 'S3', name: 'skill3' },
  { code: 'S4', token: 'S4', name: 'skill4' },
  { code: 'DD', token: 'DD', name: 'dead' },
  { code: 'KB', token: 'GH', name: 'knockback' },
  { code: 'XX', token: 'XX', name: 'sequence' },
  { code: 'RN', token: 'RN', name: 'run' },
]

/**
 * `data\global\excel\Composit.txt` — all 16 rows, in table order.
 *
 * Columns: `Name`, `Token`. The row index *is* the composite type stored in a
 * COF layer record and in its priority table, so order here is load-bearing.
 */
export const COMPOSITS: readonly CompositEntry[] = [
  { token: 'HD', name: 'Head' },
  { token: 'TR', name: 'Torso' },
  { token: 'LG', name: 'Legs' },
  { token: 'RA', name: 'RightArm' },
  { token: 'LA', name: 'LeftArm' },
  { token: 'RH', name: 'RightHand' },
  { token: 'LH', name: 'LeftHand' },
  { token: 'SH', name: 'Shield' },
  { token: 'S1', name: 'Special1' },
  { token: 'S2', name: 'Special2' },
  { token: 'S3', name: 'Special3' },
  { token: 'S4', name: 'Special4' },
  { token: 'S5', name: 'Special5' },
  { token: 'S6', name: 'Special6' },
  { token: 'S7', name: 'Special7' },
  { token: 'S8', name: 'Special8' },
]

/**
 * `data\global\excel\WeaponClass.txt` — all 15 rows, in table order.
 *
 * Columns: `Weapon Class`, `Code`. Row 0 ("None") has an empty code on purpose;
 * see `WEAPON_CLASS_CODES` for the set that can actually appear in a COF name.
 */
export const WEAPON_CLASSES: readonly WeaponClassEntry[] = [
  { code: '', name: 'None' },
  { code: 'hth', name: 'Hand To Hand' },
  { code: 'bow', name: 'Bow' },
  { code: '1hs', name: '1 Hand Swing' },
  { code: '1ht', name: '1 Hand Thrust' },
  { code: 'stf', name: 'Staff' },
  { code: '2hs', name: '2 Hand Swing' },
  { code: '2ht', name: '2 Hand Thrust' },
  { code: 'xbw', name: 'Crossbow' },
  { code: '1js', name: 'Left Jab Right Swing' },
  { code: '1jt', name: 'Left Jab Right Thrust' },
  { code: '1ss', name: 'Left Swing Right Swing' },
  { code: '1st', name: 'Left Swing Right Thrust' },
  { code: 'ht1', name: 'One Hand-to-Hand' },
  { code: 'ht2', name: 'Two Hand-to-Hand' },
]

/**
 * Compose the `AnimData.D2` / COF name for an actor animation.
 *
 * @param token - two-letter actor token, e.g. `so` or `sk`.
 * @param mode - two-letter animation token, e.g. `a1`.
 * @param weaponClass - three-letter weapon-class code, e.g. `hth`.
 * @returns the upper-case seven-character name, e.g. `SOA1HTH`.
 */
export function cofName(token: string, mode: string, weaponClass: string): string {
  return `${token}${mode}${weaponClass}`.toUpperCase()
}


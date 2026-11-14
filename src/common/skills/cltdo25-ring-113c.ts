/**
 * Diablo II v1.13c SkillCltDoFunc 25 (64-way ring: Nova / Frost Nova / Poison Nova / warcries / monster novas)
 * and its server mirror D2Game `sub_6FD14170`.
 *
 * D2Client (ImageBase 0x6FAB0000):
 *   - SkillCltDoFunc table 0x6FB8EA48, [25] = 0x6FB23CB0. It takes the missile from Skills.txt `cltmissilea`
 *     (0x6FAF0550, progressive-aware), velocity = Missiles.txt `Vel + lvl * VelLev / 8` (D2Common 0x6FDCC4C2,
 *     DATATBLS_GetMissileVelocityFromMissilesTxt, no MaxVel clamp) + Skills.txt `cltcalc1` (0x6FABC316),
 *     then calls 0x6FB51020(..., -1, ...).
 *   - 0x6FB51020 sets missile param flag 4 (explicit velocity) and, for arg -1, calls 0x6FB50DB0(0).
 *   - 0x6FB50DB0(0) (0x6FB50E27..0x6FB50E5D): `edi = 0..0x100 step 4`, i.e. 64 missiles; target offset X/Y read
 *     from the 64-entry radius-30 tables 0x6FB84390 / 0x6FB84290; each one created by 0x6FB630F0.
 *     When the missile id is 176 (`diabfire`, 0x6FB50E36 `cmp [esi+0x10],0xB0`) the param flag 0x4000 is toggled
 *     before every create (0x6FB50E47 `xor [esi],0x4000`): entries 0,2,4,... carry 0x4000, 1,3,5,... do not.
 *   - 0x6FB630F0 creates the missile light (Missiles.txt Light/Red/Green/Blue, 0x6FB58C20) only when flag 0x4000
 *     is clear (0x6FB6365B `test ah,0x40`), so DiabFire lights every second ring entry.
 *   - Lifetime = Missiles.txt `Range + LevRange * lvl` (0x6FB63417..0x6FB63429).
 * D2Game `sub_6FD14170` (D2MOO Skills.cpp) uses the identical 64-entry table; SrvDo022 (Nova) passes
 * `Vel + calc1`, SrvDo036 (Claws of Thunder finisher) `calc1 + Vel` from the target unit, SrvDo068 (warcries) 0.
 */

/** D2Client 0x6FB84390 (== D2Game sub_6FD14170 xOffsets): ring target X offsets, radius 30. */
export const CLTDO25_RING_X_113C: readonly number[] = Object.freeze([
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
])

/** D2Client 0x6FB84290 (== D2Game sub_6FD14170 yOffsets): ring target Y offsets, radius 30. */
export const CLTDO25_RING_Y_113C: readonly number[] = Object.freeze([
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
])

export const CLTDO25_RING_COUNT_113C = 64

/** Missiles.txt id 176 `diabfire`: the one missile 0x6FB50DB0 toggles param flag 0x4000 (no light) for. */
export const CLTDO25_DIABFIRE_MISSILE_ID_113C = 176

/** Missile param flag 0x4000: 0x6FB630F0 skips CreateLight. */
export const MISSILE_PARAM_NO_LIGHT_113C = 0x4000

export interface CltDo25SkillRow113c {
  readonly skillId: number
  readonly skill: string
  /** Skills.txt `cltmissilea` (a real Missiles.txt row name). */
  readonly cltMissileA: string
  /** Skills.txt `cltcalc1` (velocity bonus), '' when empty. */
  readonly cltCalc1: string
  /** Skills.txt Param1..Param8 (empty = 0). */
  readonly params: readonly [number, number, number, number, number, number, number, number]
}

/** Every 1.13c Skills.txt row with `cltdofunc` = 25 (transcribed columns; verified by tests against the MPQ). */
export const CLTDO25_SKILLS_113C: Readonly<Record<number, CltDo25SkillRow113c>> = Object.freeze({
  44: { skillId: 44, skill: 'Frost Nova', cltMissileA: 'frostnova', cltCalc1: '', params: [9, 3, 0, 0, 0, 0, 0, 10] },
  48: { skillId: 48, skill: 'Nova', cltMissileA: 'nova', cltCalc1: '', params: [12, 4, 0, 0, 0, 0, 0, 0] },
  92: { skillId: 92, skill: 'Poison Nova', cltMissileA: 'poisonnova', cltCalc1: '', params: [0, 0, 0, 0, 0, 0, 0, 10] },
  130: { skillId: 130, skill: 'Howl', cltMissileA: 'howl', cltCalc1: 'par1 * (lvl-1)', params: [2, 1, 24, 5, 75, 25, 0, 0] },
  138: { skillId: 138, skill: 'Shout', cltMissileA: 'shout', cltCalc1: '', params: [100, 10, 500, 250, 0, 0, 0, 125] },
  146: { skillId: 146, skill: 'Battle Cry', cltMissileA: 'battlecry', cltCalc1: '', params: [300, 60, -50, -2, -25, -1, 0, 0] },
  149: { skillId: 149, skill: 'Battle Orders', cltMissileA: 'battleorders', cltCalc1: '', params: [750, 250, 35, 3, 0, 0, 0, 125] },
  154: { skillId: 154, skill: 'War Cry', cltMissileA: 'warcry', cltCalc1: '', params: [25, 5, 0, 0, 0, 0, 0, 6] },
  155: { skillId: 155, skill: 'Battle Command', cltMissileA: 'battlecommand', cltCalc1: '', params: [125, 250, 0, 0, 0, 0, 0, 125] },
  190: { skillId: 190, skill: 'PrimeIceNova', cltMissileA: 'frostnova', cltCalc1: '', params: [0, 0, 0, 0, 0, 0, 0, 0] },
  195: { skillId: 195, skill: 'DiabFire', cltMissileA: 'diabfire', cltCalc1: '', params: [0, 0, 0, 0, 0, 0, 0, 0] },
  316: { skillId: 316, skill: 'Baal Nova', cltMissileA: 'baal nova', cltCalc1: '', params: [0, 0, 0, 0, 0, 0, 0, 0] },
  346: { skillId: 346, skill: 'MephFrostNova', cltMissileA: 'frostnova', cltCalc1: '', params: [9, 3, 0, 0, 0, 0, 0, 0] },
  353: { skillId: 353, skill: 'Trap Nova', cltMissileA: 'trapnova', cltCalc1: '', params: [12, 4, 0, 0, 0, 0, 0, 0] },
})

export function getCltDo25Skill113c(skillId: number): CltDo25SkillRow113c | undefined {
  return CLTDO25_SKILLS_113C[skillId]
}

/**
 * Evaluates the restricted calc grammar used by the CltDoFunc 25 `cltcalc1` cells: integers, `lvl`,
 * `par1..par8`, `+ - * /` (integer division truncates like D2Common) and parentheses. Any other token throws
 * (no silent 0 for an unsupported expression).
 */
export function evalCltDo25Calc113c(expr: string, params: readonly number[], lvl: number): number {
  const src = expr.trim()
  if (src === '') return 0
  const tokens = src.match(/\s*(\d+|par[1-8]|lvl|[-+*/()])/gy)
  if (tokens === null || tokens.join('').replace(/\s+/g, '') !== src.replace(/\s+/g, '')) {
    throw new Error(`CltDoFunc 25 cltcalc1: unsupported expression "${expr}"`)
  }
  const toks = tokens.map(t => t.trim())
  let pos = 0
  const primary = (): number => {
    const t = toks[pos++]
    if (t === undefined) throw new Error(`CltDoFunc 25 cltcalc1: unexpected end of "${expr}"`)
    if (t === '(') {
      const v = additive()
      if (toks[pos++] !== ')') throw new Error(`CltDoFunc 25 cltcalc1: missing ')' in "${expr}"`)
      return v
    }
    if (t === '-') return -primary()
    if (t === 'lvl') return lvl
    if (t.startsWith('par')) return params[Number(t.slice(3)) - 1] ?? 0
    if (/^\d+$/.test(t)) return Number(t)
    throw new Error(`CltDoFunc 25 cltcalc1: unexpected token "${t}" in "${expr}"`)
  }
  const multiplicative = (): number => {
    let v = primary()
    while (toks[pos] === '*' || toks[pos] === '/') {
      const op = toks[pos++]
      const r = primary()
      v = op === '*' ? v * r : r === 0 ? 0 : Math.trunc(v / r)
    }
    return v
  }
  const additive = (): number => {
    let v = multiplicative()
    while (toks[pos] === '+' || toks[pos] === '-') {
      const op = toks[pos++]
      const r = multiplicative()
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  const result = additive()
  if (pos !== toks.length) throw new Error(`CltDoFunc 25 cltcalc1: trailing tokens in "${expr}"`)
  return result
}

/** DATATBLS_GetMissileVelocityFromMissilesTxt (D2Common 0x6FDCC4C2): `Vel + lvl * VelLev / 8`, no MaxVel clamp. */
export function missileTxtVelocity113c(missile: { readonly vel: number; readonly velLev?: number | undefined }, lvl: number): number {
  return missile.vel + Math.trunc((lvl * (missile.velLev ?? 0)) / 8)
}

/** 0x6FB23CB0 velocity: Missiles.txt velocity of `cltmissilea` at `lvl` + Skills.txt `cltcalc1`. */
export function cltDo25Velocity113c(
  row: CltDo25SkillRow113c,
  missile: { readonly vel: number; readonly velLev?: number | undefined },
  lvl: number,
): number {
  return missileTxtVelocity113c(missile, lvl) + evalCltDo25Calc113c(row.cltCalc1, row.params, lvl)
}

export interface CltDo25RingEntry113c {
  readonly index: number
  /** Target offset from the ring centre (sub-tiles), straight from the 64-entry table. */
  readonly dx: number
  readonly dy: number
  /** Param flag 0x4000 set for this create (no missile light). Only toggled for `diabfire` (id 176). */
  readonly noLight: boolean
}

/** The 64 creates of 0x6FB50DB0(0) / sub_6FD14170, in order, for the given Missiles.txt id. */
export function cltDo25RingEntries113c(missileId: number): CltDo25RingEntry113c[] {
  const out: CltDo25RingEntry113c[] = []
  let flags = 0
  for (let i = 0; i < CLTDO25_RING_COUNT_113C; i++) {
    if (missileId === CLTDO25_DIABFIRE_MISSILE_ID_113C) flags ^= MISSILE_PARAM_NO_LIGHT_113C
    out.push({
      index: i,
      dx: CLTDO25_RING_X_113C[i]!,
      dy: CLTDO25_RING_Y_113C[i]!,
      noLight: (flags & MISSILE_PARAM_NO_LIGHT_113C) !== 0,
    })
  }
  return out
}

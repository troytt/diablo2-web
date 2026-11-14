/**
 * src/common/skills/skilldesc-lines.ts
 *
 * Diablo II v1.13c skill description line formatter, ported from the `D2Client.dll` SkillDesc line dispatcher
 * at `0x6FAE16C0` (`movzx eax, byte [desc+idx+0x42]; dec eax; cmp eax,0x4A; jmp [eax*4+0x6FAE2ABC]` → ids 1..75).
 *
 * Every case below cites the D2Client helper it reproduces. Text pieces are the canonical string-table entries
 * baked into `SKILL_DESC_BY_SKILL_ID` (ENG `en` / CHI `zh`), concatenated exactly like the original
 * (`Unicode::strcat`, no implicit spaces). A helper that returns 0 in the original (e.g. a zero value) yields
 * `null` here, i.e. the line is not printed.
 *
 * Functions not reproduced here return `undefined` so the caller can keep its legacy damage formatter for them.
 */
import type { SkillDescLine, SkillDescMissile, SkillDescText } from '../data/skilldesc-table.ts'

export type SkillDescLang = 'en' | 'zh'

/** Inputs a description function needs besides the line's own calc values. */
export interface SkillDescLineEnv {
  /** Skill level the line is evaluated at (already `max(1, lvl)` like 0x6FAE36C9). */
  readonly lvl: number
  /** `desccalca` / `desccalcb` evaluated with the SkillCalc engine (0 when empty). */
  readonly calcA: number
  readonly calcB: number
  /** `descmissile1` record (descline 23/28/29/30). */
  readonly missile1?: SkillDescMissile | null | undefined
  /** Skills.txt EType code (`cold` / `pois` …) and elemental length in frames (descline 11 → 0x6FABCEB6). */
  readonly eType: string
  readonly elemLengthFrames: number
  /** Skill ToHit percent (descline 8 → D2Common ToHit via 0x6FABCEAA). */
  readonly toHitPercent: number
  /** `DifficultyLevels.txt` AiCurseDivisor of the current difficulty (descline 31 → 0x6FADE330). */
  readonly aiCurseDivisor: number
  /** Skills.txt mana fields (descline 1 → 0x6FAE14D0). */
  readonly mana: number
  readonly lvlMana: number
  readonly minMana: number
  readonly manaShift: number
  /** Summoned monster average base HP for the active difficulty (descline 13 → 0x6FADEFD0 + D2Common.#11089). */
  readonly summonBaseHp?: number | undefined
  /** Pre-evaluated summon physical damage range (descline 34 → 0x6FADE410, descline 39 → 0x6FADE900). */
  readonly summonDamage?: { readonly min: number; readonly max: number } | undefined
  /** Summoned monster base A1MinD..A1MaxD for the active difficulty (descline 41 → 0x6FADE770). */
  readonly summonBaseAttack?: { readonly min: number; readonly max: number } | undefined
  /** Un-aura-boosted elemental/magic min/max damage (descline 48 → 0x6FAE0270). */
  readonly elemMin?: number | undefined
  readonly elemMax?: number | undefined
  /** Scroll/Tome stack quantity (descline 53..56 → 0x6FADC950). */
  readonly bookQty?: number | undefined
  /** Fixed tbl strings (`StrSkill10`, `StrSkill13` …) in the active language. */
  readonly tbl: (key: string) => string
}

export interface SkillDescLineText {
  readonly text: string
  /** D2 colour index applied by `0x6FB6F5F0` (`ÿc<n>`), when the line sets one. */
  readonly color?: number | undefined
  /** True when `0x6FADC950` draws a separate side box and appends nothing to the main tooltip buffer (`descline 53..56`). */
  readonly sideBoxOnly?: boolean | undefined
}

const txt = (t: SkillDescText | undefined, lang: SkillDescLang): string => (t ? t[lang] : '')
const signed = (v: number, plus: boolean): string => (plus && v >= 0 ? `+${v}` : `${v}`)

/** D2Client.dll 0x6FADE060: frames → `N[.d]` + " second"/" seconds"; 0 → no line. */
export function formatSkillSeconds(frames: number, tbl: (key: string) => string, plus = false): string | null {
  const whole = Math.trunc(frames / 25)
  const tenth = Math.trunc(((frames % 25) * 10) / 25)
  if (whole === 0 && tenth === 0) return null
  const num = tenth !== 0 ? `${whole}.${Math.abs(tenth)}` : `${whole}`
  const unit = whole === 1 && tenth === 0 ? tbl('StrSkill15') : tbl('StrSkill16')
  return `${plus && frames >= 0 ? '+' : ''}${num}${unit}`
}

/** D2Client.dll 0x6FADF430: sub-tiles → yards (`v*20/3`, one decimal, int part clamped to ≥1, singular " yard"). */
export function formatSkillYards(subtiles: number, tbl: (key: string) => string): string {
  const x = Math.trunc((subtiles * 20) / 3)
  let whole = Math.trunc(x / 10)
  const tenth = x % 10
  if (whole < 1) whole = 1
  const num = tenth !== 0 ? `${whole}.${tenth}` : `${whole}`
  return `${num}${whole === 1 ? tbl('StrSkill36') : tbl('StrSkill26')}`
}

/**
 * D2Client.dll 0x6FAE14D0 (descline 1): mana cost in 256ths,
 * `v = max(minmana<<8, (mana + lvlmana*(lvl-1)) << manashift)`; one truncated decimal only when
 * `manashift != 8 && (lvlmana<<manashift) <= 256 && v <= 0x1900` (and the tenth is non-zero), otherwise the
 * integer part.
 */
export function formatSkillManaCost(env: Pick<SkillDescLineEnv, 'lvl' | 'mana' | 'lvlMana' | 'minMana' | 'manaShift'>): string | null {
  if (env.mana === 0 && env.lvlMana === 0) return null
  const shiftL = (n: number, s: number) => (s >= 0 ? n * 2 ** s : Math.trunc(n / 2 ** -s))
  let v = shiftL(env.mana + env.lvlMana * (env.lvl - 1), env.manaShift)
  const floor = env.minMana * 256
  if (floor > v) v = floor
  const perLevel = shiftL(env.lvlMana, env.manaShift)
  if (env.manaShift !== 8 && perLevel <= 0x100 && v <= 0x1900) {
    // 0x6FADF7D0: "%d.%d" only when the tenth is non-zero, "%d" otherwise; nothing when both are 0.
    const whole = Math.trunc(v / 256)
    const frac = Math.trunc(((v % 256) * 10) / 256)
    if (whole === 0 && frac <= 0) return null
    return frac !== 0 ? `${whole}.${Math.abs(frac)}` : `${whole}`
  }
  // 0x6FADDCA0: integer part; value 0 prints nothing.
  const whole = Math.trunc(v / 256)
  return whole === 0 ? null : `${whole}`
}

/** sprintf-style `%s` / `%d` substitution used by D2Lang `Unicode::sprintf` for tbl format strings. */
function sprintfTbl(fmt: string, ...args: (string | number)[]): string {
  let i = 0
  return fmt.replace(/%(\+?)([ds%])/g, (m, plus: string, c: string) => {
    if (c === '%') return '%'
    const a = args[i++]
    if (a === undefined) return m
    if (c === 'd' && typeof a === 'number') return plus && a >= 0 ? `+${a}` : `${a}`
    return String(a)
  })
}

/**
 * Formats one SkillDesc line. Returns `null` when the original prints nothing for it, `undefined` when the
 * function id is not reproduced here (caller falls back to its own damage formatter).
 */
export function formatSkillDescLine(line: SkillDescLine, env: SkillDescLineEnv, lang: SkillDescLang): SkillDescLineText | null | undefined {
  const A = txt(line.textA, lang)
  const B = txt(line.textB, lang)
  const { calcA: a, calcB: b, tbl } = env
  const out = (text: string | null, color?: number): SkillDescLineText | null => (text === null ? null : { text, color })
  switch (line.func) {
    case 1: {
      // 0x6FAE14D0 -> 0x6FADDCA0(strMana, value) / 0x6FADF7D0 "%d.%d"; caller passes str mana as textA.
      const mana = formatSkillManaCost(env)
      return mana === null ? null : out(`${A}${mana}`)
    }
    case 2: // 0x6FADD9B0(textA, textB, calcA, 1)
    case 3: // 0x6FADD9B0(textA, textB, calcA, 0)
      return a === 0 ? null : out(`${A}${signed(a, line.func === 2)}${B}`)
    case 4: // 0x6FADDCA0(textA, calcA, 1)
    case 5: // 0x6FADDCA0(textA, calcA, 0)
      return a === 0 ? null : out(`${A}${signed(a, line.func === 4)}`)
    case 6: // 0x6FADDBF0(textA, calcA, 1): value first
    case 7:
      return a === 0 ? null : out(`${signed(a, line.func === 6)}${A}`)
    case 8: // 0x6FADEEF0: StrSkill10 "To Attack Rating: " + "+N" + StrSkill23 " percent" (calc columns unused)
      return env.toHitPercent === 0 ? null : out(`${tbl('StrSkill10')}${signed(env.toHitPercent, true)}${tbl('StrSkill23')}`)
    case 11: {
      // 0x6FADF2E0: only EType cold (4) / poison (5)
      const label = env.eType === 'cold' ? tbl('StrSkill13') : env.eType === 'pois' ? tbl('StrSkill14') : null
      if (label === null) return null
      const secs = formatSkillSeconds(env.elemLengthFrames, tbl)
      return secs === null ? null : out(`${label}${secs}`)
    }
    case 12: { // 0x6FADE060(textA, calcA)
      const secs = formatSkillSeconds(a, tbl)
      return secs === null ? null : out(`${A}${secs}`)
    }
    case 13: { // 0x6FADEFD0: D2Common.#11089 average base HP h, then h + (h*calcA)/100 + calcB
      const h = env.summonBaseHp ?? 0
      const life = h + Math.trunc((h * a) / 100) + b
      return life === 0 ? null : out(`${tbl('StrSkill42')}${life}`)
    }
    case 15: // 0x6FAE1AB6: textA + ": " + textB
      return out(`${A}${tbl('colon')}${tbl('space')}${B}`)
    case 16: { // 0x6FADDF50(StrSkill20, calcA, calcB): "a-b" / "a.d-b.d" + " seconds"
      const s = (f: number) => [Math.trunc(f / 25), Math.trunc(((f % 25) * 10) / 25)] as const
      const [w1, t1] = s(a)
      const [w2, t2] = s(b)
      if (w1 === 0 && t1 === 0 && w2 === 0) return null
      const range = t1 === 0 && t2 === 0 ? `${w1}-${w2}` : `${w1}.${t1}-${w2}.${t2}`
      return out(`${tbl('StrSkill20')}${range}${tbl('StrSkill16')}`)
    }
    case 17: { // 0x6FAE1B1B: [textB] + 0x6FADF6E0(textA, StrSkill34 " per second", calcA, calcB, 0)
      if (a === b) return a === 0 ? null : out(`${B}${A}${a}${tbl('StrSkill34')}`)
      return out(`${B}${A}${a}-${b}${tbl('StrSkill34')}`)
    }
    case 18: // 0x6FAE1B5A: textA, coloured by calcA when > 0
      return out(A, a > 0 ? a : undefined)
    case 19: // 0x6FADF430(textA, calcA)
      return out(`${A}${formatSkillYards(a, tbl)}`)
    case 20: // 0x6FAE1C1B -> 0x6FADD8E0(textA, StrSkill23, textB, calcA, 1)
    case 21: // 0x6FAE1C3E -> 0x6FADD8E0(textA, StrSkill23, textB, calcA, 0)
      return a === 0 ? null : out(`${A}${signed(a, line.func === 20)}${tbl('StrSkill23')}${B}`)
    case 23: { // 0x6FAE1C97: descmissile1 Range + LevRange*lvl frames
      const m = env.missile1
      if (!m) return null
      const secs = formatSkillSeconds(m.range + m.levRange * env.lvl, tbl)
      return secs === null ? null : out(`${A}${secs}`)
    }
    case 25: // 0x6FAE1D2F: textA + textB, coloured by calcA when > 0
      return out(`${A}${B}`, a > 0 ? a : undefined)
    case 28: { // 0x6FAE1EA3: StrSkill18 "Radius: " + yards([descmissile1 + 0x38] = Missiles.txt Param1; the
      // D2Common Missiles field table maps Param1 -> 0x38, sHitPar1 -> 0x4C at 0x6FDCCBEF / 0x6FDCCE15).
      // Fire Ball's "fireball" missile has no Param1, so the original prints "Radius: 1 yard" (oracle P5.4).
      const m = env.missile1
      if (!m) return null
      return out(`${tbl('StrSkill18')}${formatSkillYards(m.param1, tbl)}`)
    }
    case 29: { // 0x6FAE1ED8: ((Range + LevRange*(lvl-1))*2)/3 + " yards" via 0x6FADDBF0 (value first)
      const m = env.missile1
      if (!m) return null
      const yards = Math.trunc(((m.range + m.levRange * (env.lvl - 1)) * 2) / 3)
      return yards === 0 ? null : out(`${yards}${tbl('StrSkill26')}`)
    }
    case 30: { // 0x6FAE1F39: descmissile1 -> SubMissile1 Range + LevRange*lvl frames
      const sub = env.missile1?.subMissile
      if (!sub) return null
      const secs = formatSkillSeconds(sub.range + sub.levRange * env.lvl, tbl)
      return secs === null ? null : out(`${A}${secs}`)
    }
    case 31: { // 0x6FADE330: calcA / DifficultyLevels.AiCurseDivisor
      const div = env.aiCurseDivisor > 0 ? env.aiCurseDivisor : 1
      const secs = formatSkillSeconds(Math.trunc(a / div), tbl)
      return secs === null ? null : out(`${A}${secs}`)
    }
    case 32: // 0x6FAE1FB4: textA + 0x6FADD9B0(textB, StrSkill23, calcA, 1)
      return a === 0 ? null : out(`${A}${B}${signed(a, true)}${tbl('StrSkill23')}`)
    case 33: // 0x6FAE1FE7: only when lvl > 1: textA + textB
      return env.lvl > 1 ? out(`${A}${B}`) : null
    case 34: // 0x6FAE2016 -> 0x6FADE410: Raise Skeleton summon physical damage (StrSkill4 + min-max)
    case 39: { // 0x6FAE2155 -> 0x6FADE900: Golem summon physical damage (StrSkill4 + min-max)
      const sd = env.summonDamage
      if (!sd || (sd.min === 0 && sd.max === 0)) return null
      return out(`${tbl('StrSkill4')}${sd.min === sd.max ? `${sd.min}` : `${sd.min}-${sd.max}`}`)
    }
    case 35: // 0x6FAE204E: textA + ": " + "%d-%d"(calcA, calcB)
      return out(`${A}${tbl('colon')}${tbl('space')}${a}-${b}`)
    case 36: // 0x6FADDA70(textA, textB, calcA, 0): value + (value==1 ? textA : textB)
      return a === 0 ? null : out(`${a}${a === 1 ? A : B}`)
    case 37: { // 0x6FAE2117 -> 0x6FADF340: half-subtile radius (calcA*10/3 -> whole.tenth yards, clamped >= 1)
      const x = Math.trunc((a * 10) / 3)
      const whole = Math.max(1, Math.trunc(x / 10))
      const tenth = x % 10
      const num = tenth !== 0 ? `${whole}.${Math.abs(tenth)}` : `${whole}`
      return out(`${A}${num}${whole === 1 ? tbl('StrSkill36') : tbl('StrSkill26')}`)
    }
    case 38: // 0x6FADF6E0(textA, textB, calcA, calcB, 0)
    case 52: { // same with '+'
      const plus = line.func === 52
      if (a === b) return a === 0 ? null : out(`${A}${signed(a, false)}${B}`)
      return out(`${A}${plus ? '+' : ''}${a}-${b}${B}`)
    }
    case 40: // 0x6FAE218D: sprintf(textA, textB), coloured by calcA when > 0
      return out(sprintfTbl(A, B), a > 0 ? a : undefined)
    case 41: { // 0x6FAE2251 -> 0x6FADE770: summon A1MinD..A1MaxD + calcA..calcB, prefixed by EType
      const fMin = (env.summonBaseAttack?.min ?? 0) + a
      const fMax = (env.summonBaseAttack?.max ?? 0) + b
      if (fMin === 0 && fMax === 0) return null
      const prefixKey =
        env.eType === 'fire' ? 'StrSkill5'
        : env.eType === 'ltng' ? 'StrSkill7'
        : env.eType === 'cold' ? 'StrSkill6'
        : env.eType === 'mag' ? 'StrSkill39'
        : env.eType === 'pois' ? 'StrSkill8'
        : 'StrSkill4'
      return out(`${tbl(prefixKey)}${fMin === fMax ? `${fMin}` : `${fMin}-${fMax}`}`)
    }
    case 42: { // 0x6FAE2277 -> 0x6FADCD20(textA, textB, calcA, calcB, 1, 0): textA ": " "+calcA.calcB" " " textB
      if (!line.textA || (a === 0 && b === 0)) return null
      return out(`${A}${tbl('colon')}${tbl('space')}${signed(a, true)}.${Math.abs(b)}${tbl('space')}${B}`)
    }
    case 43: // 0x6FAE229B -> 0x6FADDE00(textA, textB, calcA, calcB, 10)
    case 44: { // 0x6FAE22C0 -> 0x6FADDE00(textA, textB, calcA, calcB, 100)
      const scale = line.func === 43 ? 10 : 100
      const w1 = Math.trunc(a / 256)
      const f1 = Math.trunc(((a % 256) * scale) / 256)
      const w2 = Math.trunc(b / 256)
      const f2 = Math.trunc(((b % 256) * scale) / 256)
      if (w1 === 0 && w2 === 0 && f1 === 0 && f2 === 0) return null
      const range = f1 === 0 && f2 === 0 ? `${w1}-${w2}` : `${w1}.${Math.abs(f1)}-${w2}.${Math.abs(f2)}`
      return out(`${A}${range}${B}`)
    }
    case 46: // 0x6FAE230C: if calcB != 0, sprintf(textA, textB) coloured by calcA
      if (b === 0 || !line.textA) return null
      return out(sprintfTbl(A, B), a > 0 ? a : undefined)
    case 47: // 0x6FAE23D4 -> 0x6FADF520(textA, calcA, calcB, 0, 0)
      if (a === b) return a === 0 ? null : out(`${A}${a}`)
      return out(`${A}${a}-${b}`)
    case 10: // 0x6FAE1929 -> 0x6FADEF80(unit, skill, lvl): #10121/#11091 (bMastery=1) >> 8 -> 0x6FADD220 (oracle P5.4)
    case 48: { // 0x6FAE23F8 -> 0x6FAE0270 -> 0x6FADEF80 -> 0x6FADD220 -> 0x6FADC870: elemental/magic damage without Concentration aura
      const eMin = env.elemMin ?? 0
      const eMax = env.elemMax ?? 0
      if (eMin === 0 && eMax === 0) return null
      const prefixKey =
        env.eType === 'fire' ? 'StrSkill5'
        : env.eType === 'ltng' ? 'StrSkill7'
        : env.eType === 'cold' ? 'StrSkill6'
        : env.eType === 'mag' ? 'StrSkill39'
        : env.eType === 'pois' ? 'StrSkill8'
        : 'StrSkill4'
      return out(`${tbl(prefixKey)}${eMin === eMax ? `${eMin}` : `${eMin}-${eMax}`}`)
    }
    case 51: // 0x6FAE24BD -> 0x6FADDD50(textA, calcA): sprintf(textA, calcA)
      return line.textA ? out(sprintfTbl(A, a)) : null
    case 53: // 0x6FAE24FB -> 0x6FADC950(scrollbooktext, textA, invCode): side quantity box at (x-128, y-52); main buffer unchanged, returns 1
    case 54: // 0x6FAE2525
    case 55: // 0x6FAE2552
    case 56: // 0x6FAE257F
      return { text: `${sprintfTbl(tbl('scrollbooktext'), env.bookQty ?? 1)}\n${A}`, sideBoxOnly: true }
    case 57: { // 0x6FAE25AB -> 0x6FADE060(textA, calcA, plus=1)
      const secs = formatSkillSeconds(a, tbl, true)
      return secs === null ? null : out(`${A}${secs}`)
    }
    case 58: // 0x6FAE25CA -> 0x6FADF600(textA, textB, calcA, calcB, 1)
    case 62: { // 0x6FAE269A -> 0x6FADF600(textA, textB, calcA, calcB, 0)
      if (a === b) return a === 0 ? null : out(`${A}${a}${B}`)
      return out(`${A}${B}${line.func === 58 ? '+' : ''}${a}-${b}`)
    }
    case 60: // 0x6FADF870(textA, textB, calcB|10, 1)
    case 61: { // 0x6FADF870(textA, textB, calcB|10, 0): calcA in 256ths, decimals scaled by calcB
      if (a === 0) return null
      const scale = b === 0 ? 10 : b
      const whole = Math.trunc(a / 256)
      const frac = Math.trunc(((a % 256) * scale) / 256)
      const plus = line.func === 60
      const num = whole === 0 && frac === 0 ? null : frac !== 0 ? `${signed(whole, plus)}.${Math.abs(frac)}` : signed(whole, plus)
      return out(`${A}${num ?? ''}${B}`)
    }
    case 63: // 0x6FADCE10(textA, textB, calcA, 1, 1): textA ": " "+N" "%" " " textB
    case 67: { // 0x6FADCE10(textA, textB, calcA, 1, 0): no '%'
      if (a === 0) return null
      const head = line.textA ? `${A}${tbl('colon')}${tbl('space')}` : ''
      return out(`${head}${signed(a, true)}${line.func === 63 ? tbl('percent') : ''}${tbl('space')}${B}`)
    }
    case 66: // 0x6FADC9F0(textA, calcA): sprintf(textA, calcA)
      return line.textA ? out(sprintfTbl(A, a)) : null
    case 68: // 0x6FADDB30(textA, textB, calcA, 0): value + textA + textB
      return a === 0 ? null : out(`${a}${A}${B}`)
    case 70: // 0x6FAE2793: textA + 0x6FADDCA0(textB, calcA, 1)
      return a === 0 ? null : out(`${A}${B}${signed(a, true)}`)
    case 71: // 0x6FAE27C1: textA ": " sprintf(textB, calcA)
      return line.textA && line.textB ? out(`${A}${tbl('colon')}${tbl('space')}${sprintfTbl(B, a)}`) : null
    case 72: // 0x6FAE2864: "+A/B " textA (requires calcA != 0 && calcB > 0)
    case 73: // 0x6FAE2917: "A/B " textA
      if (a === 0 || b <= 0) return null
      return out(`${line.func === 72 ? signed(a, true) : `${a}`}${tbl('slash')}${b}${tbl('space')}${A}`)
    case 74: // 0x6FAE29DB: sprintf(textA, calcA)
    case 75: // 0x6FAE2A29: sprintf(textA, calcA, calcB)
      return line.textA ? out(line.func === 74 ? sprintfTbl(A, a) : sprintfTbl(A, a, b)) : null
    default:
      return undefined
  }
}

/** Description line sections as laid out by 0x6FAE3550 / 0x6FAE3B50. */
export const SKILLDESC_SECTION = {
  desc: [0, 5],
  dsc2: [6, 9],
  dsc3: [10, 16],
} as const

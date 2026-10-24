/**
 * 1.13c quest special ambient lights: D2Client `CLIENT_GetAmbientLight` 0x6fb59a20 steps 1–3 (#826).
 *
 * Golden vectors: tests/fixtures/lighting/quest-fx-826-vectors.txt, the verbatim SPEC #826 §10 vector
 * dump (DenLight 0x6fb024d0, FadeTick 0x6fb02f10 with the Fog #10083 table bits, Act 4 red 0x6fb59a4c).
 * The `(pN)` annotations are the phase each tick's intensity used; the tick at k = end computes a value
 * and then memsets the fade in the same tick, so that value is never visible to the light grid.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { type AmbientLight, resolveLevelAmbient } from '../../src/common/world/ambient-light.ts'
import { FOG_SIN_TABLE } from '../../src/client/weather/fog-sin-table.ts'
import {
  AURA_LEN_CALC_BY_SKILL,
  CAIRN_STONES_MISSILE,
  SETFUNC_FADE_STATES,
  SKILLS_TXT_ROW_COUNT,
} from '../../src/client/world/quest-fx-data-113c.ts'
import {
  evaluateAuraLenCalc,
  QuestFxLight,
  resolveRoomAmbient,
  type QuestFxStat,
} from '../../src/client/world/quest-fx-light.ts'

const VECTOR_LINES = readFileSync('tests/fixtures/lighting/quest-fx-826-vectors.txt', 'utf8').split('\n')

/** The line after the `## <title>` header that starts with `title`. */
function vectorLine(title: string): string {
  const index = VECTOR_LINES.findIndex(line => line.startsWith(`## ${title}`))
  if (index < 0) throw new Error(`vector section '${title}' not found`)
  return VECTOR_LINES[index + 1]!
}

interface FadeStep {
  readonly k: number
  readonly intensity: number
  /** Phase the intensity used; undefined inside a `[kA..kB:0]` hold run. */
  readonly phase: number | undefined
}

/** Expands `k:I(pP)` tokens and `[kA..kB:0]` hold runs. */
function parseFadeVector(line: string): FadeStep[] {
  const steps: FadeStep[] = []
  for (const token of line.trim().split(/\s+/)) {
    const run = /^\[k(\d+)\.\.k(\d+):0\]$/.exec(token)
    if (run) {
      for (let k = Number(run[1]); k <= Number(run[2]); k += 1) steps.push({ k, intensity: 0, phase: undefined })
      continue
    }
    const step = /^(\d+):(\d+)\(p(\d+)\)$/.exec(token)
    if (!step) throw new Error(`bad fade token '${token}'`)
    steps.push({ k: Number(step[1]), intensity: Number(step[2]), phase: Number(step[3]) })
  }
  steps.forEach((s, i) => {
    if (s.k !== i) throw new Error(`fade vector: step ${i} has k=${s.k}`)
  })
  return steps
}

function base(intensity: number, red = 255, green = 255, blue = 255): AmbientLight {
  return { intensity, red, green, blue, source: 'environment' }
}

/** Fixed Levels.txt light (step 4); the 1.13c rows of levels 8, 107 and 108 are white. */
function levels(intensity: number): AmbientLight {
  return { intensity, red: 255, green: 255, blue: 255, source: 'levels' }
}

const WHITE_ENV = { intensity: 128, red: 255, green: 255, blue: 255 }

function availability(a1q1: number): Uint8Array {
  const bytes = new Uint8Array(37)
  bytes[1] = a1q1
  return bytes
}

const STONE_FOUND = { findStoneAlpha: (): boolean => true }
const NO_STONE = { findStoneAlpha: (): boolean => false }

function cloakStats(slvl: number): QuestFxStat[] {
  return [
    { statId: 31, param: 0, value: 15 },
    { statId: 350, param: 0, value: 264 },
    { statId: 351, param: 0, value: slvl },
  ]
}

/**
 * Runs every tick of a fade whose player stays in its level and checks the intensity the light grid
 * sees after each tick (`special()` of a non-special level) and the phase stored for the next tick.
 */
function expectFadeVector(
  fx: QuestFxLight,
  steps: readonly FadeStep[],
  playerBase: AmbientLight,
  levelId: number,
): void {
  const end = steps.length - 1
  expect(fx.snapshot().fade.end).toBe(end)
  expect(fx.special(levelId)).toBeNull() // memset colour until the first FadeTick
  for (const step of steps) {
    fx.tick({ levelId, base: playerBase })
    if (step.k === end) {
      expect(fx.special(levelId), 'cleared after the tick at k = end').toBeNull()
      expect(fx.snapshot().fade.active).toBe(false)
      break
    }
    const light = fx.special(levelId)
    expect(light, `k=${step.k}`).toEqual({
      intensity: step.intensity,
      red: playerBase.red,
      green: playerBase.green,
      blue: playerBase.blue,
      source: 'fade',
    })
    const next = steps[step.k + 1]!
    if (next.phase !== undefined) expect(fx.snapshot().fade.phase, `phase for k=${next.k}`).toBe(next.phase)
  }
}

describe('quest special light data (Patch_D2 excel)', () => {
  it('holds the 1.13c rows the lights read', () => {
    expect(SETFUNC_FADE_STATES).toEqual([153])
    expect(SKILLS_TXT_ROW_COUNT).toBe(357)
    expect(AURA_LEN_CALC_BY_SKILL[264]).toEqual({
      skill: 'Cloak of Shadows',
      calc: 'ln34',
      params: [30, 30, 200, 25, 15, 3, 10, 3],
    })
    expect(CAIRN_STONES_MISSILE).toEqual({ id: 288, name: 'cairnstones', param1: 40, range: 300 })
  })

  it('V11: uses the exact Fog cos512 bits for every reachable phase (0..128)', () => {
    const bitsLine = VECTOR_LINES.find(line => line.startsWith('# 3f800000'))!
    const expected = bitsLine.slice(2).trim().split(/\s+/).map(h => parseInt(h, 16))
    expect(expected).toHaveLength(129)
    const view = new DataView(new ArrayBuffer(4))
    for (let a = 0; a <= 128; a += 1) {
      view.setFloat32(0, FOG_SIN_TABLE[(a + 128) & 511]!, true)
      expect(view.getUint32(0, true), `cos512(${a})`).toBe(expected[a])
    }
  })
})

describe('evaluateAuraLenCalc (#10786 on Skills.txt auralencalc)', () => {
  it('evaluates the single-skill forms', () => {
    expect(evaluateAuraLenCalc(264, 1)).toBe(200) // Cloak of Shadows ln34: 200 + 25 (slvl - 1)
    expect(evaluateAuraLenCalc(264, 20)).toBe(675)
    expect(evaluateAuraLenCalc(173, 5)).toBe(300) // SpiderLay '300'
    expect(evaluateAuraLenCalc(147, 5)).toBe(150) // Frenzy 'par7'
    expect(evaluateAuraLenCalc(46, 1)).toBe(120) // Blaze dm12: 50 + trunc(110 * 1 * 450 / 700)
  })

  it('gives 0 without an auralencalc (UNVERIFIED #10786 calc -1) and throws on formulas it cannot port', () => {
    expect(evaluateAuraLenCalc(0, 1)).toBe(0)
    expect(() => evaluateAuraLenCalc(40, 1)).toThrow(/Frozen Armor/)
  })
})

describe('Den of Evil light (level 8, DenLight 0x6fb024d0)', () => {
  it('V1: I 80 while A1Q1 is live, then trunc(80 cos512((t << 7) / 30)) for t = 1..29, then Levels.txt', () => {
    const expected = new Map(
      vectorLine('DEN')
        .trim()
        .split(/\s+/)
        .map(token => token.split(':').map(Number) as [number, number]),
    )
    expect(expected.size).toBe(31)
    const fx = new QuestFxLight()
    fx.onQuestAvailability(availability(1))
    const den = (intensity: number): AmbientLight => ({ intensity, red: 255, green: 64, blue: 48, source: 'den' })
    expect(fx.special(8)).toEqual(den(expected.get(-1)!))
    fx.tick({ levelId: 8, base: resolveLevelAmbient(8, WHITE_ENV) })
    expect(fx.special(8)).toEqual(den(80)) // the timer does not run before event 0

    fx.onSpecialQuestEvent(0, NO_STONE)
    expect(fx.snapshot().denTimer).toBe(0)
    expect(fx.special(8)).toEqual(den(expected.get(0)!))
    for (let t = 1; t <= 29; t += 1) {
      fx.tick({ levelId: 8, base: resolveLevelAmbient(8, WHITE_ENV) })
      expect(fx.special(8), `t=${t}`).toEqual(den(expected.get(t)!))
    }
    fx.tick({ levelId: 8, base: resolveLevelAmbient(8, WHITE_ENV) })
    expect(fx.snapshot().denDone).toBe(true)
    expect(fx.special(8)).toBeNull()
    expect(resolveRoomAmbient(8, WHITE_ENV, fx)).toEqual(levels(0))
  })

  it('V2: falls through when A1Q1 is not live, and asserts like 1.13c before any S2C 0x5E', () => {
    const fx = new QuestFxLight()
    expect(() => fx.special(8)).toThrow(/0x5E/)
    fx.onQuestAvailability(availability(0))
    expect(fx.special(8)).toBeNull()
    expect(resolveRoomAmbient(8, WHITE_ENV, fx).source).toBe('levels')
    expect(() => fx.onQuestAvailability(new Uint8Array(36))).toThrow(/37/)
  })

  it('checks denDone before the S2C 0x5E assert (0x6fb024d0-d7)', () => {
    const fx = new QuestFxLight()
    fx.onSpecialQuestEvent(0, NO_STONE)
    for (let i = 0; i < 30; i += 1) fx.tick(null)
    expect(fx.snapshot().denDone).toBe(true)
    expect(fx.special(8)).toBeNull()
  })

  it('game init resets the Den globals but keeps the S2C 0x5E copy (0x6faf456b-c0)', () => {
    const fx = new QuestFxLight()
    fx.onQuestAvailability(availability(1))
    fx.onSpecialQuestEvent(0, NO_STONE)
    for (let i = 0; i < 30; i += 1) fx.tick(null)
    fx.resetForNewGame()
    const snap = fx.snapshot()
    expect(snap.denTimer).toBe(-1)
    expect(snap.denDone).toBe(false)
    expect(snap.questAvailRecv).toBe(true)
    expect(snap.questAvail[1]).toBe(1)
    expect(fx.special(8)?.intensity).toBe(80)
  })
})

describe('Act 4 red light (levels 107/108, 0x6fb59a42-73)', () => {
  it('V9: lights 107/108 red from event 12 until event 13, then falls through at once', () => {
    const fx = new QuestFxLight()
    expect(resolveRoomAmbient(107, WHITE_ENV, fx)).toEqual(levels(120))
    expect(resolveRoomAmbient(108, WHITE_ENV, fx)).toEqual(levels(80))
    fx.onSpecialQuestEvent(12, NO_STONE)
    const red = { intensity: 160, red: 255, green: 64, blue: 48, source: 'act4' }
    expect(fx.special(107)).toEqual(red)
    expect(fx.special(108)).toEqual(red)
    expect(fx.special(106)).toBeNull()
    fx.onSpecialQuestEvent(13, NO_STONE)
    for (let tick = 1; tick <= 30; tick += 1) {
      expect(fx.special(107), `tick ${tick}`).toBeNull()
      fx.tick(null)
      expect(fx.snapshot().act4Red).toBe(tick < 30)
    }
    expect(fx.snapshot().act4RedCountdown).toBe(-1)
  })

  it('keeps a stale countdown across games: no red in the next game (game init skips 0x6fba2130)', () => {
    const fx = new QuestFxLight()
    fx.onSpecialQuestEvent(12, NO_STONE)
    fx.onSpecialQuestEvent(13, NO_STONE)
    for (let i = 0; i < 7; i += 1) fx.tick(null)
    fx.resetForNewGame()
    expect(fx.snapshot()).toMatchObject({ act4Red: false, act4RedCountdown: 7 })
    fx.onSpecialQuestEvent(12, NO_STONE)
    expect(fx.special(107)).toBeNull()
    for (let i = 0; i < 22; i += 1) fx.tick(null)
    expect(fx.snapshot()).toMatchObject({ act4Red: true, act4RedCountdown: 29 })
    fx.tick(null)
    expect(fx.snapshot()).toMatchObject({ act4Red: false, act4RedCountdown: -1 })
  })

  it('freezes the countdown while the flag is clear (0x6fb0375b-62)', () => {
    const fx = new QuestFxLight()
    fx.onSpecialQuestEvent(13, NO_STONE)
    for (let i = 0; i < 50; i += 1) fx.tick(null)
    expect(fx.snapshot().act4RedCountdown).toBe(0)
    fx.resetForNewGame()
    fx.onSpecialQuestEvent(12, NO_STONE)
    expect(fx.special(108)).toBeNull()
  })
})

describe('global fade (every other level, FadeTick 0x6fb02f10)', () => {
  it('V3: event 1 with a StoneAlpha in reach, T = 255', () => {
    const fx = new QuestFxLight()
    fx.onSpecialQuestEvent(1, STONE_FOUND)
    expect(fx.snapshot().fade).toEqual({
      active: true,
      intensity: 0,
      red: 0,
      green: 0,
      blue: 0,
      rampIn: 40,
      rampOut: 40,
      hold: 220,
      end: 300,
      tick: 0,
      phase: 0,
      levelId: 4,
    })
    expectFadeVector(fx, parseFadeVector(vectorLine('EVENT 1 (Cairn')), base(255), 4)
  })

  it('V4: event 1 under the act clock, T = 128', () => {
    const fx = new QuestFxLight()
    fx.onSpecialQuestEvent(1, STONE_FOUND)
    expectFadeVector(fx, parseFadeVector(vectorLine('EVENT 1 same, act-clock T=128')), base(128, 200, 180, 160), 4)
  })

  it('does nothing for event 1 without a StoneAlpha near the player', () => {
    const fx = new QuestFxLight()
    fx.onSpecialQuestEvent(1, NO_STONE)
    expect(fx.snapshot().fade.active).toBe(false)
  })

  it('V5/V6: Cloak of Shadows L1 (X = 200) and L20 (X = 675)', () => {
    for (const [slvl, title] of [
      [1, 'CLOAK L1'],
      [20, 'CLOAK L20'],
    ] as const) {
      const fx = new QuestFxLight()
      fx.onStateSetFunc(153, cloakStats(slvl), 4)
      expectFadeVector(fx, parseFadeVector(vectorLine(title)), base(255), 4)
    }
  })

  it('V7: a state 153 statlist without stat 350 is skill 0 (no auralencalc): X = 0, ramp out 25', () => {
    const fx = new QuestFxLight()
    fx.onStateSetFunc(153, [{ statId: 31, param: 0, value: 15 }], 4)
    expect(fx.snapshot().fade).toMatchObject({ rampIn: 5, hold: 0, rampOut: 25, end: 30 })
    expectFadeVector(fx, parseFadeVector(vectorLine('CLOAK X=0')), base(255), 4)
  })

  it('V8: dies on the first tick the local player is in another level', () => {
    const fx = new QuestFxLight()
    fx.onSpecialQuestEvent(1, STONE_FOUND)
    fx.tick({ levelId: 4, base: base(255) })
    expect(fx.special(4)?.intensity).toBe(255)
    fx.tick({ levelId: 38, base: base(255) })
    expect(fx.snapshot().fade.active).toBe(false)
    expect(fx.special(4)).toBeNull()
    expect(fx.special(38)).toBeNull()
  })

  it('is cleared in a tick without a local player', () => {
    const fx = new QuestFxLight()
    fx.startStateFade(200, 4)
    fx.tick(null)
    expect(fx.snapshot().fade.active).toBe(false)
  })

  it('V10: colours every non-special room with the player room base light; 8/107/108 ignore it', () => {
    const fx = new QuestFxLight()
    fx.onQuestAvailability(availability(0))
    fx.onSpecialQuestEvent(1, STONE_FOUND)
    for (let k = 0; k <= 40; k += 1) fx.tick({ levelId: 4, base: base(128, 10, 20, 30) })
    const fade = { intensity: 0, red: 10, green: 20, blue: 30, source: 'fade' }
    expect(resolveRoomAmbient(4, WHITE_ENV, fx)).toEqual(fade)
    expect(resolveRoomAmbient(2, WHITE_ENV, fx)).toEqual(fade)
    expect(resolveRoomAmbient(75, WHITE_ENV, fx)).toEqual(fade)
    expect(resolveRoomAmbient(8, WHITE_ENV, fx)).toEqual(levels(0))
    expect(resolveRoomAmbient(107, WHITE_ENV, fx)).toEqual(levels(120))
    expect(resolveRoomAmbient(108, WHITE_ENV, fx)).toEqual(levels(80))
  })

  it('setfunc 2 needs state 153, a room, a statlist and a skill id inside Skills.txt', () => {
    const fx = new QuestFxLight()
    fx.onStateSetFunc(152, cloakStats(1), 4)
    fx.onStateSetFunc(153, cloakStats(1), null)
    fx.onStateSetFunc(153, undefined, 4)
    fx.onStateSetFunc(153, [], 4)
    fx.onStateSetFunc(153, [{ statId: 350, param: 0, value: SKILLS_TXT_ROW_COUNT }], 4)
    fx.onStateSetFunc(153, [{ statId: 350, param: 0, value: -1 }], 4)
    expect(fx.snapshot().fade.active).toBe(false)
    fx.onStateSetFunc(153, cloakStats(3), 38)
    const fade = { active: true, rampIn: 5, hold: 150, rampOut: 100, end: 255, levelId: 38 }
    expect(fx.snapshot().fade).toMatchObject(fade)
  })

  it('a new start restarts the fade (memset), game init clears it', () => {
    const fx = new QuestFxLight()
    fx.startStateFade(200, 4)
    for (let i = 0; i < 10; i += 1) fx.tick({ levelId: 4, base: base(255) })
    fx.onSpecialQuestEvent(1, STONE_FOUND)
    expect(fx.snapshot().fade).toMatchObject({ tick: 0, phase: 0, intensity: 0, red: 0, end: 300 })
    fx.resetForNewGame()
    expect(fx.snapshot().fade.active).toBe(false)
  })
})

describe('special quest event ids (0x6fb023b0 FatalAsserts)', () => {
  it('throws for ids the 1.13c client asserts on and ignores the ones without lighting effects', () => {
    const fx = new QuestFxLight()
    for (const id of [3, 6, 14, 16, 17, 19]) fx.onSpecialQuestEvent(id, STONE_FOUND)
    expect(fx.snapshot()).toMatchObject({ denTimer: -1, act4Red: false, act4RedCountdown: -1 })
    expect(fx.snapshot().fade.active).toBe(false)
    expect(() => fx.onSpecialQuestEvent(20, NO_STONE)).toThrow(/FatalAssert/)
    expect(() => fx.onSpecialQuestEvent(32, NO_STONE)).toThrow(/FatalAssert/)
  })
})

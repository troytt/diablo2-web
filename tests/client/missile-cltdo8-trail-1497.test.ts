import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cell, parseTable } from '../../src/common/world/acts.ts'
import { SEED_RollLimitedRandomNumber } from '../../src/common/rng/d2-rng.ts'
import { CANONICAL_113C_MISSILES } from '../../src/common/skills/missiles-data.ts'
import { MISSILE_CLT_COLS_113C, missileCltCols113c } from '../../src/common/skills/missile-clt-cols-113c.ts'
import { cltDo8Decide, cltDo8SubInit, pathEnteredNewSubtile } from '../../src/client/world/missile-cltdo8-trail-113c.ts'

const txt = parseTable(readFileSync(resolve('samples/fixtures/data/global/excel/Missiles.txt')))
const txtRows = txt.rows.filter(r => cell(txt, r, 'Missile').trim() !== '' && cell(txt, r, 'Missile').trim() !== 'Expansion')

describe('missile-clt-cols-113c (missiles.bin client columns)', () => {
  it('has one row per Missiles.txt row, in Id order, named like the canonical table', () => {
    expect(MISSILE_CLT_COLS_113C.length).toBe(684)
    expect(txtRows.length).toBe(684)
    MISSILE_CLT_COLS_113C.forEach((r, i) => {
      expect(r.id).toBe(i)
      expect(r.name).toBe(cell(txt, txtRows[i]!, 'Missile').trim())
      expect(CANONICAL_113C_MISSILES[r.name.toLowerCase()]?.id).toBe(i)
    })
  })

  it('matches the Missiles.txt InitSteps / Activate / Size / CltParam1 / CltParam2 columns', () => {
    const num = (r: readonly string[], c: string): number => Number(cell(txt, r, c).trim() || '0')
    MISSILE_CLT_COLS_113C.forEach((m, i) => {
      const r = txtRows[i]!
      expect(m.initSteps).toBe(num(r, 'InitSteps'))
      expect(m.activate).toBe(num(r, 'Activate'))
      expect(m.size).toBe(num(r, 'Size'))
      expect(m.cltParam[0]).toBe(num(r, 'CltParam1'))
      expect(m.cltParam[1]).toBe(num(r, 'CltParam2'))
    })
  })

  it('keeps the compiled garbage pCltHitFunc of row 568 (txt "*16") as a non-positive id', () => {
    expect(missileCltCols113c(568).pCltHitFunc).toBeLessThanOrEqual(0)
  })

  it('throws for an unknown id', () => {
    expect(() => missileCltCols113c(684)).toThrow(RangeError)
  })
})

describe('MissCltDoFunc[8] 0x6fb691c0 trail', () => {
  const cltDo8Rows = MISSILE_CLT_COLS_113C.filter(r => r.pCltDoFunc === 8)

  it('covers every pCltDoFunc = 8 row (class sweep) with a valid CltSubMissile1', () => {
    expect(cltDo8Rows.map(r => r.name)).toEqual(
      expect.arrayContaining(['chainlightning', 'lightningbolt', 'lightningstrike', 'monsterlight', 'cairnstonesground', 'baal taunt lightning']),
    )
    expect(cltDo8Rows.length).toBe(16)
    for (const r of cltDo8Rows) {
      const d = cltDo8Decide(r, 1000, true)
      expect(d.kind).toBe('spawn')
      if (d.kind === 'spawn') {
        expect(d.sub.id).toBe(r.cltSubMissile[0])
        expect(d.loops).toBe(Math.max(1, r.cltParam[0]))
      }
    }
  })

  it('spawns only when the path entered a new sub-tile', () => {
    const cl = missileCltCols113c(93)
    expect(cltDo8Decide(cl, 0, false).kind).toBe('skip')
    const d = cltDo8Decide(cl, 0, true)
    expect(d).toMatchObject({ kind: 'spawn', loops: 3 })
    if (d.kind === 'spawn') expect(d.sub.name).toBe('lightninghit')
  })

  it('waits InitSteps frames (monsterlight InitSteps = 2)', () => {
    const ml = missileCltCols113c(170)
    expect(ml.initSteps).toBe(2)
    expect(cltDo8Decide(ml, 1, true).kind).toBe('skip')
    expect(cltDo8Decide(ml, 2, true).kind).toBe('spawn')
  })

  it('removes the missile when CltSubMissile1 is empty', () => {
    const noSub = { ...missileCltCols113c(93), cltSubMissile: [-1, -1, -1] as const }
    expect(cltDo8Decide(noSub, 5, true).kind).toBe('remove')
  })

  it('0x6fb60f40: z = RAND(parent, P2) - P2/2, frame = RAND(sub, AnimLen)', () => {
    const sub = missileCltCols113c(99)
    expect(sub.cltParam[1]).toBe(16)
    const parent = { lo: 12345, hi: 666 }
    const subSeed = { lo: 777, hi: 666 }
    const p2 = { ...parent }
    const s2 = { ...subSeed }
    const init = cltDo8SubInit(sub, parent, subSeed)
    expect(init.altitude).toBe(SEED_RollLimitedRandomNumber(p2, 16) - 8)
    expect(init.initialFrame).toBe(SEED_RollLimitedRandomNumber(s2, sub.animLen))
    expect(init.altitude).toBeGreaterThanOrEqual(-8)
    expect(init.altitude).toBeLessThanOrEqual(7)
  })

  it('sub-tile change test (#10203)', () => {
    expect(pathEnteredNewSubtile(10.2, 5.5, 10.9, 5.6)).toBe(false)
    expect(pathEnteredNewSubtile(10.9, 5.5, 11.1, 5.6)).toBe(true)
    expect(pathEnteredNewSubtile(10.5, 5.9, 10.5, 6.0)).toBe(true)
  })
})

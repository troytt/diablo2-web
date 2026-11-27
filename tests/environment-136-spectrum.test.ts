/**
 * 136-level ambient light spectrum (1.13c): which levels take the act clock and which take their fixed
 * Levels.txt light, checked against Patch_D2.mpq Levels.txt for every level id 1..136.
 *
 * Ground truth: D2Client `CLIENT_GetAmbientLight` 0x6fb59a20 steps 4–5 — Levels.txt Intensity/Red/Green/Blue
 * (D2Common #10636) when any of R, G, B is non-zero, otherwise the act clock (#10189 / #10731). IsInside
 * plays no part, so the 11 outdoor levels with a fixed Levels.txt light never follow the clock.
 */

import { existsSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { resolveLevelAmbient } from '../src/common/world/ambient-light.ts'
import { cell, parseTable, type D2Table } from '../src/common/world/acts.ts'
import { Environment } from '../src/common/world/environment.ts'
import { getLevelLighting } from '../src/common/world/levels-meta.ts'

/** Levels that take the act clock (Levels.txt Red = Green = Blue = 0). */
const CLOCK_LEVELS = [
  1, 2, 3, 4, 5, 6, 7, 17, 26, 27, 32, 38, 39, 40, 41, 42, 43, 44, 45, 46, 75, 76, 77, 78, 79, 80, 81, 82, 83,
  109, 110, 111, 112, 117, 120, 136,
]
/** Outdoor levels (IsInside = 0) whose Levels.txt light is fixed. */
const OUTDOOR_FIXED_LEVELS = [103, 104, 105, 106, 107, 108, 125, 126, 127, 134, 135]

interface LevelsRow {
  readonly id: number
  readonly name: string
  readonly isInside: boolean
  readonly intensity: number
  readonly red: number
  readonly green: number
  readonly blue: number
}

describe('136-level ambient light source vs 1.13c Levels.txt', () => {
  let byId: ReadonlyMap<number, LevelsRow>

  beforeAll(async () => {
    const dir = existsSync('samples/d2/Patch_D2.mpq') ? 'samples/d2' : (process.env.D2_DATA_DIR ?? 'samples/d2')
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`${dir}/${name}`)))
    }
    const table: D2Table = parseTable(await archives.read('data\\global\\excel\\Levels.txt'))
    const rows = new Map<number, LevelsRow>()
    for (const raw of table.rows) {
      const idText = cell(table, raw, 'Id').trim()
      if (idText === '') continue
      const num = (column: string): number => Number(cell(table, raw, column).trim() || '0')
      const id = Number(idText)
      if (rows.has(id)) throw new Error(`Levels.txt has two rows for level ${String(id)}`)
      rows.set(id, {
        id,
        name: cell(table, raw, 'Name'),
        isInside: num('IsInside') !== 0,
        intensity: num('Intensity'),
        red: num('Red'),
        green: num('Green'),
        blue: num('Blue'),
      })
    }
    byId = rows
  })

  it('has a Levels.txt row for every level 1..136', () => {
    for (let id = 1; id <= 136; id++) expect(byId.has(id), `level ${String(id)}`).toBe(true)
  })

  it('every level resolves to its fixed Levels.txt light or to the act clock (RGB 0)', () => {
    // A clock state no Levels.txt row has, so the source of every value is unambiguous.
    const env = { intensity: 77, red: 11, green: 22, blue: 33 }
    const clockLevels: number[] = []
    for (let id = 1; id <= 136; id++) {
      const row = byId.get(id)!
      const ambient = resolveLevelAmbient(id, env)
      if ((row.red | row.green | row.blue) !== 0) {
        expect(ambient, `level ${String(id)} ${row.name}`).toEqual({
          intensity: row.intensity,
          red: row.red,
          green: row.green,
          blue: row.blue,
          source: 'levels',
        })
      } else {
        clockLevels.push(id)
        expect(ambient, `level ${String(id)} ${row.name}`).toEqual({ ...env, source: 'environment' })
      }
    }
    expect(clockLevels).toEqual(CLOCK_LEVELS)
  })

  it('the baked levels-meta lighting matches Levels.txt for all 136 levels', () => {
    for (let id = 1; id <= 136; id++) {
      const row = byId.get(id)!
      const meta = getLevelLighting(id)
      expect(meta, `level ${String(id)}`).toBeDefined()
      expect(
        { intensity: meta!.intensity, red: meta!.red, green: meta!.green, blue: meta!.blue, isInside: meta!.isInside },
        `level ${String(id)} ${row.name}`,
      ).toEqual({ intensity: row.intensity, red: row.red, green: row.green, blue: row.blue, isInside: row.isInside })
    }
  })

  it('IsInside does not select the source: 11 outdoor levels have a fixed light', () => {
    const outdoorFixed: number[] = []
    for (let id = 1; id <= 136; id++) {
      const row = byId.get(id)!
      if (!row.isInside && (row.red | row.green | row.blue) !== 0) outdoorFixed.push(id)
    }
    expect(outdoorFixed).toEqual(OUTDOOR_FIXED_LEVELS)
    // Pandemonium Fortress and the River of Flame keep their Levels.txt light at any time of day.
    const night = Environment.alloc()
    night.initialize(103, 5, 25600, false)
    expect(resolveLevelAmbient(103, night)).toMatchObject({ intensity: 140, red: 255, green: 255, blue: 255, source: 'levels' })
    expect(resolveLevelAmbient(104, night)).toMatchObject({ intensity: 120, source: 'levels' })
  })

  it('throws for a level id without a Levels.txt row', () => {
    const env = Environment.alloc()
    expect(() => resolveLevelAmbient(137, env)).toThrow(/Levels.txt has no row for level 137/)
    expect(() => resolveLevelAmbient(-1, env)).toThrow(/Levels.txt has no row for level -1/)
  })
})

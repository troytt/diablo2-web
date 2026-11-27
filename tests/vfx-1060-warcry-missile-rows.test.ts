/**
 * Issue #1060: the warcry shockwave missiles' CANONICAL Vel / MaxVel / Accel / Range / LevRange must be the
 * 1.13c Missiles.txt columns (howl #148, shout #149, battlecry #219, warcry #235, battlecommand #236,
 * battleorders #237). Howl's per-level growth is a velocity bonus from Skills.txt cltcalc1 (CltDoFunc 25),
 * never a LevRange baked into the row.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/common/data/data-registry.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'

// 1.13c Missiles.txt: [Vel, MaxVel, Accel, Range, LevRange]
const EXPECTED: Readonly<Record<string, readonly [number, number, number, number, number]>> = {
  howl: [12, 12, -1000, 12, 0],
  shout: [30, 30, -500, 15, 0],
  battlecry: [12, 12, -1000, 12, 0],
  warcry: [12, 12, -600, 16, 0],
  battlecommand: [30, 30, -500, 15, 0],
  battleorders: [30, 30, -500, 15, 0],
}

function missilesTxt(): Map<string, Readonly<Record<string, string>>> | null {
  try {
    const rows = new Map<string, Readonly<Record<string, string>>>()
    for (const row of getSharedDataRegistry().missilesTable.rows) rows.set(row['Missile'] ?? '', row)
    return rows
  } catch {
    return null
  }
}
const TXT = missilesTxt()
const n = (s: string | undefined) => (s === undefined || s.trim() === '' ? 0 : Number(s))

describe('Issue #1060: warcry missile rows equal Missiles.txt', () => {
  for (const [key, [vel, maxVel, accel, range, levRange]] of Object.entries(EXPECTED)) {
    it(`${key}: Vel ${vel} / MaxVel ${maxVel} / Accel ${accel} / Range ${range} / LevRange ${levRange}`, () => {
      const row = CANONICAL_113C_MISSILES[key]!
      expect(row).toBeDefined()
      expect([row.vel, row.maxVel, row.accel ?? 0, row.range, row.levRange ?? 0]).toEqual([vel, maxVel, accel, range, levRange])
      // Derived pixel fields follow the same columns (Vel * 25 px/s, Vel * Range px).
      expect(row.speedPxPerSec).toBe(vel * 25)
      expect(row.distancePx).toBe(vel * range)
    })
  }

  it.skipIf(TXT === null)('rows match the MPQ Missiles.txt columns', () => {
    for (const key of Object.keys(EXPECTED)) {
      const t = TXT!.get(key)!
      const row = CANONICAL_113C_MISSILES[key]!
      expect([row.vel, row.maxVel, row.accel ?? 0, row.range, row.levRange ?? 0], key).toEqual([
        n(t['Vel']),
        n(t['MaxVel']),
        n(t['Accel']),
        n(t['Range']),
        n(t['LevRange']),
      ])
    }
  })
})

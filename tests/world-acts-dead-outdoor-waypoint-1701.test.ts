import { describe, expect, it } from 'vitest'
import * as acts from '../src/common/world/acts.ts'

describe('#1701 dead OUTDOOR_WAYPOINT_LEVELS / hasOutdoorWaypoint removed', () => {
  it('acts.ts no longer exports the hard-coded outdoor-waypoint classification', () => {
    // Levels.txt (Patch_D2.mpq) DrlgType: 48 Sewer 1 B and 113/115 Ice Cave 1/2 are mazes (DrlgType 1),
    // so the removed list misclassified them as outdoor. 1.13c derives level kind from DrlgType only.
    expect('hasOutdoorWaypoint' in acts).toBe(false)
    expect('OUTDOOR_WAYPOINT_LEVELS' in acts).toBe(false)
  })
})

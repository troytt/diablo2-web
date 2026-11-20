/**
 * Regression test for Issue #1729 (`D2CLIENT-UI-6`):
 * `D2Client.dll` `0x6FAD743A..0x6FAD7536` (`sub_6FAD73F0`) renders only frames `0..5` of
 * `data\global\ui\Panel\800CtrlPnl7.dc6`; frame `6` is never rendered by the 1.13c client.
 */

import { describe, expect, it } from 'vitest'
import { build800CtrlPnlPlacements113c } from '../../src/baker/packers/pack-ui.ts'

describe('Issue #1729: 800CtrlPnl7.dc6 1.13c stitch layout (D2Client.dll 0x6FAD73F0)', () => {
  it('stitches only frames 0..5 at canonical 1.13c offsets and excludes unused frame 6', () => {
    const mockFrames = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6'] as const
    const placements = build800CtrlPnlPlacements113c(mockFrames)

    expect(placements).toEqual([
      { frame: 'f1', x: 165, y: 49, frameIndex: 1 },
      { frame: 'f2', x: 293, y: 49, frameIndex: 2 },
      { frame: 'f3', x: 421, y: 49, frameIndex: 3 },
      { frame: 'f4', x: 549, y: 49, frameIndex: 4 },
      { frame: 'f0', x: 0, y: 0, frameIndex: 0 },
      { frame: 'f5', x: 683, y: 0, frameIndex: 5 },
    ])
    expect(placements.some((p) => p.frameIndex === 6 || p.frame === 'f6')).toBe(false)
  })
})

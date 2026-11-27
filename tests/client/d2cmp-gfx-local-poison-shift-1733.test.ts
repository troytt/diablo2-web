import { describe, expect, it } from 'vitest'
import { buildSceneDrawables } from '../../src/client/view/unit-drawables.ts'

describe('issue #1733 (D2CMP-GFX-3): suppress poison colorshift 104 on local player in 3D render modes', () => {
  it('suppresses poison palette shift (colorshift=104) on the local player in 3D mode (D2Client 0x6FB221B8)', () => {
    const res = buildSceneDrawables([
      {
        id: 1,
        kind: 'player',
        classId: 0,
        x: 100,
        y: 100,
        isLocalPlayer: true,
        states: [2], // poison (colorshift=104)
      },
    ])
    expect(res.unitDrawables[0]?.paletteRow).toBeUndefined()
    expect(res.unitDrawables[0]?.tintColor).toBeNull()
  })

  it('applies poison palette shift (paletteRow=2) to remote players and monsters in 3D mode, and to local player in 2D software mode', () => {
    const res3d = buildSceneDrawables([
      {
        id: 2,
        kind: 'player',
        classId: 0,
        x: 100,
        y: 100,
        isLocalPlayer: false,
        states: [2],
      },
      {
        id: 10,
        kind: 'monster',
        classId: 0,
        x: 104,
        y: 100,
        states: [2],
      },
    ])
    expect(res3d.unitDrawables.find((d) => d.id === 2)?.paletteRow).toBe(2)
    expect(res3d.unitDrawables.find((d) => d.id === 10)?.paletteRow).toBe(2)

    const res2d = buildSceneDrawables(
      [
        {
          id: 1,
          kind: 'player',
          classId: 0,
          x: 100,
          y: 100,
          isLocalPlayer: true,
          states: [2],
        },
      ],
      { softwarePaletteMode: true },
    )
    expect(res2d.unitDrawables[0]?.paletteRow).toBe(2)
  })

  it('still applies non-poison shifts (e.g. cold colorshift=108) on the local player in 3D mode', () => {
    const res = buildSceneDrawables([
      {
        id: 1,
        kind: 'player',
        classId: 0,
        x: 100,
        y: 100,
        isLocalPlayer: true,
        states: [2, 11], // poison (95) + cold (100, colorshift=108)
      },
    ])
    expect(res.unitDrawables[0]?.paletteRow).toBe(1)
  })
})

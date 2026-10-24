import { describe, expect, it } from 'vitest'
import {
  cofLayerDrawModeAlphaByte,
  compositeLoadedLayers,
  resolveCofLayerDrawMode,
} from '../src/common/units/monster-art.ts'
import { D2_DRAW_MODE_BLENDS } from '../src/common/gfx/draw-mode.ts'
import { verifyMonsterMeta, verifyObjectMeta } from '../src/baker/audit/verify-entity-packs.ts'
import { normalizeMonsterBlendMode } from '../src/client/scene/entity-art-loader.ts'
import type { CofFile } from '../src/common/formats/cof.ts'
import type { DccFile } from '../src/common/formats/dcc.ts'
import type { EntityMeta } from '../src/common/pack-contract/index.ts'

function makeTestDcc(width: number, height: number, pixels: readonly number[]): DccFile {
  const indices = new Uint8Array(pixels)
  const mask = new Uint8Array(pixels.map(p => (p === 0 ? 0 : 1)))
  return {
    version: 6,
    directions: [
      {
        box: { left: 0, top: 0, width, height },
        frames: [
          {
            width,
            height,
            offsetX: 0,
            offsetY: 0,
            bottomUp: false,
            frame: { width, height, indices, mask },
          },
        ],
      },
    ],
  }
}

describe('Issue #1289: COF per-layer transparent + drawEffect 6-level blend table (1.13c sub_6F61A100)', () => {
  it('resolves COF layer draw mode only when layer.transparent is true', () => {
    // When transparent is false, drawEffect is ignored and unitDefaultDrawMode is used.
    expect(resolveCofLayerDrawMode({ transparent: false, drawEffect: 3 })).toBe('normal')
    expect(resolveCofLayerDrawMode({ transparent: false, drawEffect: 0 }, 'trans50')).toBe('trans50')

    // When transparent is true, drawEffect 0..5 maps to 1.13c DrawMode table:
    expect(resolveCofLayerDrawMode({ transparent: true, drawEffect: 0 })).toBe('trans25')
    expect(resolveCofLayerDrawMode({ transparent: true, drawEffect: 1 })).toBe('trans50')
    expect(resolveCofLayerDrawMode({ transparent: true, drawEffect: 2 })).toBe('trans75')
    expect(resolveCofLayerDrawMode({ transparent: true, drawEffect: 3 })).toBe('additive')
    expect(resolveCofLayerDrawMode({ transparent: true, drawEffect: 4 })).toBe('normal')
    expect(resolveCofLayerDrawMode({ transparent: true, drawEffect: 5 })).toBe('normal')
    expect(resolveCofLayerDrawMode({ transparent: true, drawEffect: 99 }, 'trans75')).toBe('trans75')

    expect(cofLayerDrawModeAlphaByte('trans25')).toBe(64)
    expect(cofLayerDrawModeAlphaByte('trans50')).toBe(128)
    expect(cofLayerDrawModeAlphaByte('trans75')).toBe(192)
    expect(cofLayerDrawModeAlphaByte('normal')).toBe(255)
    expect(cofLayerDrawModeAlphaByte('additive')).toBe(255)
  })

  it('skips baked shadow index 172 on translucent layers and occludes glowSheet when an opaque layer draws over an additive layer', () => {
    // Layer 0 (type 0): additive glow at pixel 0 and pixel 1
    // Layer 1 (type 1): opaque normal body at pixel 0 (should occlude glow at pixel 0!)
    // Layer 2 (type 2): trans50 effect at pixel 1 with shadow index 172 at pixel 0 (should skip 172 and write alphaByte=128 at pixel 1)
    const cof: CofFile = {
      numberOfLayers: 3,
      framesPerDirection: 1,
      numberOfDirections: 1,
      speed: 256,
      layers: [
        { type: 0, shadow: 0, selectable: true, transparent: true, drawEffect: 3, weaponClass: 'hth' },
        { type: 1, shadow: 1, selectable: true, transparent: false, drawEffect: 5, weaponClass: 'hth' },
        { type: 2, shadow: 0, selectable: true, transparent: true, drawEffect: 1, weaponClass: 'hth' },
      ],
      animationFrames: new Uint8Array([0]),
      priority: [[[0, 1, 2]]],
    }

    const glowDcc = makeTestDcc(2, 1, [200, 201])
    const bodyDcc = makeTestDcc(2, 1, [50, 0])
    const trans50Dcc = makeTestDcc(2, 1, [172, 99])

    const result = compositeLoadedLayers(
      cof,
      [glowDcc, bodyDcc, trans50Dcc],
      ['L0', 'L1', 'L2'],
      [],
      0,
      0,
    )

    const baseFrame = result.sheet.groups[0]!.frames[0]!
    const glowFrame = result.glowSheet!.groups[0]!.frames[0]!

    // Pixel 0: bodyDcc wrote 50 (alpha 255), trans50Dcc had index 172 which must be skipped on translucent layers!
    expect(baseFrame.indices[0]).toBe(50)
    expect(baseFrame.mask[0]).toBe(255)
    // And because opaque bodyDcc drew at pixel 0 AFTER glowDcc, glowFrame pixel 0 must be occluded (0)!
    expect(glowFrame.indices[0]).toBe(0)
    expect(glowFrame.mask[0]).toBe(0)

    // Pixel 1: glowDcc wrote 201 to glowFrame (not occluded by trans50Dcc since alphaByte=128 < 255),
    // and trans50Dcc wrote 99 with mask=128 to baseFrame.
    expect(baseFrame.indices[1]).toBe(99)
    expect(baseFrame.mask[1]).toBe(128)
    expect(glowFrame.indices[1]).toBe(201)
    expect(glowFrame.mask[1]).toBe(255)
  })

  it('preserves uniform translucent monster blendMode through compositeLoadedLayers and normalizeMonsterBlendMode', () => {
    const cof: CofFile = {
      numberOfLayers: 1,
      framesPerDirection: 1,
      numberOfDirections: 1,
      speed: 256,
      layers: [
        { type: 0, shadow: 0, selectable: true, transparent: true, drawEffect: 0, weaponClass: 'hth' },
      ],
      animationFrames: new Uint8Array([0]),
      priority: [[[0]]],
    }
    const dcc = makeTestDcc(2, 2, [88, 88, 88, 88])
    const res = compositeLoadedLayers(cof, [dcc], ['L0'], [], 0, 0)
    expect(res.blendMode).toBe('trans25')
    expect(normalizeMonsterBlendMode('SK', res.blendMode)).toBe('trans25')
    expect(normalizeMonsterBlendMode('DC', res.blendMode)).toBe('normal')
  })

  it('Issue #1308: verifyMonsterMeta and verifyObjectMeta accept all 6 D2_DRAW_MODE_BLENDS and reject invalid modes', () => {
    const baseMeta: EntityMeta = {
      schema: 2,
      token: 'E9',
      weapon: 'hth',
      file: 'monster-e9-hth.r8',
      width: 64,
      height: 64,
      directions: 1,
      standOffset: 0,
      clips: {
        nu: { group: 0, directions: 1, frames: 1, speed: 256, loop: true, events: [] },
      },
      groups: [[[0, 0, 16, 16, 0, 0]]],
    }

    for (const blendMode of D2_DRAW_MODE_BLENDS) {
      expect(() => verifyMonsterMeta({ ...baseMeta, blendMode }, `Global monster-e9-hth (${blendMode})`)).not.toThrow()
      expect(() => verifyObjectMeta({ ...baseMeta, blendMode }, `Global object-r1 (${blendMode})`)).not.toThrow()
    }

    expect(() =>
      verifyMonsterMeta({ ...baseMeta, blendMode: 'bogus' as any }, 'Global monster-e9-hth'),
    ).toThrow(/invalid blendMode: bogus/)
    expect(() =>
      verifyObjectMeta({ ...baseMeta, blendMode: 'bogus' as any }, 'Global object-r1'),
    ).toThrow(/invalid blendMode: bogus/)
  })
})

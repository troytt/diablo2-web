import { describe, expect, it } from 'vitest'
import { buildSceneDrawables, type SceneMissileDrawable } from '../src/client/view/unit-drawables.ts'
import { OVERLAY_METAS } from '../src/client/render/overlays-meta.ts'
import { overlayTransToDrawBlend } from '../src/common/gfx/draw-mode.ts'
import { drawTownPortal, type LoadedOverlayArt } from '../src/client/scene/missile-overlay-renderer.ts'
import { drawSceneMissileDrawable } from '../src/client/scene/world-renderer.ts'
import type { AtlasHandle, DrawOptions, SpriteRenderer } from '../src/client/render/renderer.ts'
import type { AtlasFrame } from '../src/client/render/atlas.ts'

function createMockRenderer(): {
  renderer: SpriteRenderer
  draws: Array<{ frame: AtlasFrame; x: number; y: number; options: DrawOptions | undefined }>
} {
  const draws: Array<{ frame: AtlasFrame; x: number; y: number; options: DrawOptions | undefined }> = []
  const renderer = {
    draw(frame: AtlasFrame, x: number, y: number, options?: DrawOptions) {
      draws.push({ frame, x, y, options: options ? { ...options } : undefined })
    },
    setBlendMode() {},
  } as unknown as SpriteRenderer
  return { renderer, draws }
}

describe('Issue #1290: 1.13c Overlay/Missile/Portal blendMode parity (shrine_*, npcalert, portaltr, missiles)', () => {
  it('maps shrine_* and npcalert Overlay.txt Trans=3 to additive blendMode', () => {
    expect(OVERLAY_METAS['npcalert']?.trans).toBe(3)
    expect(overlayTransToDrawBlend(OVERLAY_METAS['npcalert']!.trans)).toBe('additive')
    expect(OVERLAY_METAS['shrine_armor']?.trans).toBe(3)
    expect(overlayTransToDrawBlend(OVERLAY_METAS['shrine_armor']!.trans)).toBe('additive')
    expect(OVERLAY_METAS['shrine_skill']?.trans).toBe(3)
    expect(overlayTransToDrawBlend(OVERLAY_METAS['shrine_skill']!.trans)).toBe('additive')

    const drawables = buildSceneDrawables(
      [
        {
          id: 10,
          kind: 'monster',
          classId: 148, // Akara
          x: 100,
          y: 100,
          mode: 1,
          direction: 0,
          hpRatio: 1,
          isCorpse: false,
          isHovered: false,
          isNpc: true,
          wantsInteract: true,
        },
      ],
      { tick: 3 },
    )
    const alertOv = drawables.overlayDrawables.find(o => o.token === 'npcalert')
    expect(alertOv).toBeDefined()
    expect(alertOv?.blendMode).toBe('additive')
  })

  it('draws Town Portal TR base with trans25 (PFONHTH.cof TR transparent=1, drawEffect=0) and HD swirl with additive', () => {
    const { renderer, draws } = createMockRenderer()
    const trHandle = { id: 1 } as unknown as AtlasHandle
    const hdHandle = { id: 2 } as unknown as AtlasHandle
    const dummyFrame: AtlasFrame = { x: 0, y: 0, width: 32, height: 32, anchorX: -16, anchorY: -16 }
    const overlayArtMap = new Map<string, LoadedOverlayArt>([
      [
        'town_portal_op_tr',
        {
          meta: {
            name: 'town_portal_op_tr',
            celFile: 'PFTRLITA1HTH',
            width: 32,
            height: 32,
            directions: 1,
            frames: 1,
            framesPerDirection: 1,
            animRate: 16,
            trans: 0,
            preDraw: false,
            lightRadius: 0,
            lightColor: [0, 0, 0],
            box: { left: -16, top: -16, width: 32, height: 32 },
            groups: [[[0, 0, 32, 32, -16, -16]]],
          },
          handle: trHandle,
          frames: [[dummyFrame]],
        },
      ],
      [
        'town_portal_op_hd',
        {
          meta: {
            name: 'town_portal_op_hd',
            celFile: 'PFHDLITA1HTH',
            width: 32,
            height: 32,
            directions: 1,
            frames: 1,
            framesPerDirection: 1,
            animRate: 16,
            trans: 3,
            preDraw: false,
            lightRadius: 0,
            lightColor: [0, 0, 0],
            box: { left: -16, top: -16, width: 32, height: 32 },
            groups: [[[0, 0, 32, 32, -16, -16]]],
          },
          handle: hdHandle,
          frames: [[dummyFrame]],
        },
      ],
    ])

    drawTownPortal(renderer, 200, 300, 0, overlayArtMap)
    expect(draws).toHaveLength(2)
    expect(draws[0]!.options?.atlas).toBe(trHandle)
    expect(draws[0]!.options?.blendMode).toBe('trans25')
    expect(draws[1]!.options?.atlas).toBe(hdHandle)
    expect(draws[1]!.options?.blendMode).toBe('additive')
  })

  it('resolves missile blendMode from missile.trans or art.meta.trans / art.meta.blendMode when drawable blendMode is normal', () => {
    const { renderer, draws } = createMockRenderer()
    const handle = { id: 99 } as unknown as AtlasHandle
    const dummyFrame: AtlasFrame = { x: 0, y: 0, width: 16, height: 16, anchorX: -8, anchorY: -8 }
    const missileArtMap = new Map([
      [
        'firebolt',
        {
          meta: {
            name: 'firebolt',
            celFile: 'firebolt',
            width: 16,
            height: 16,
            directions: 1,
            framesPerDirection: 1,
            animSpeed: 16,
            trans: 1,
            blendMode: 'lighter',
            groups: [[[0, 0, 16, 16, -8, -8] as const]],
          },
          handle,
          frames: [[dummyFrame]],
        },
      ],
    ])

    const drawable: SceneMissileDrawable = {
      drawableKind: 'missile',
      unitId: 1,
      missileClassId: 59,
      missileKey: 'firebolt',
      celFile: 'firebolt',
      direction: 0,
      frame: 0,
      totalFrames: 1,
      loopAnim: true,
      subX: 10,
      subY: 10,
      worldX: 100,
      worldY: 200,
      sortY: 200,
      blendMode: 'normal',
      trans: 0,
      lightRadius: 0,
      lightColor: [255, 255, 255],
    }

    drawSceneMissileDrawable(renderer, drawable, { missileArtMap } as never, 0)
    expect(draws).toHaveLength(1)
    expect(draws[0]!.options?.blendMode).toBe('additive')
  })
})

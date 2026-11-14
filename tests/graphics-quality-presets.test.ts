/**
 * Graphics quality preset / performance mode (port-only presentation layer).
 */
import { describe, expect, it } from 'vitest'
import {
  createDefaultClientSettings,
  parseClientSettingsJson,
  sanitizeClientSettings,
} from '../src/client/settings/client-settings.ts'
import {
  LOW_GROUND_LABEL_MAX,
  LOW_VFX_BUDGET,
  resolveEffectiveGraphics,
} from '../src/client/settings/graphics-quality.ts'
import {
  capGroundItemLabels,
  isDecorativeMissileKey,
  isDecorativeVfx,
  selectVfxSkipSet,
} from '../src/client/scene/vfx-budget.ts'
import { syncCrispBackingStore } from '../src/client/view/crisp-scale.ts'
import { getMissileTxtData } from '../src/common/skills/missiles-data.ts'
import { PD2_D2GL_CONFIG, resolveD2GlUpscaleKernel } from '../src/common/ui/pd2-d2gl.ts'
import type { GroundItemLabelInput } from '../src/common/items/ground-items.ts'
import type {
  SceneEntityDrawable,
  SceneMissileDrawable,
  SceneOverlayDrawable,
  SceneUnitDrawable,
} from '../src/client/view/unit-drawables.ts'

function missile(missileKey: string, worldX: number, worldY: number): SceneMissileDrawable {
  const row = getMissileTxtData(missileKey)
  return {
    drawableKind: 'missile',
    unitId: 1,
    missileClassId: row.id,
    missileKey,
    celFile: row.celFile,
    worldX,
    worldY,
    sortY: worldY,
  } as unknown as SceneMissileDrawable
}

function overlay(ownerUnitId: number, loop: boolean, worldX = 0, worldY = 0): SceneOverlayDrawable {
  return {
    drawableKind: 'overlay',
    ownerUnitId,
    overlayId: 1,
    token: 'x',
    frame: 0,
    totalFrames: 1,
    loop,
    worldX,
    worldY,
    sortY: worldY,
    blendMode: 'normal',
  }
}

const LOCAL_PLAYER = {
  drawableKind: 'unit',
  unitKind: 'player',
  isLocalPlayer: true,
  unitId: 7,
  worldX: 0,
  worldY: 0,
} as unknown as SceneUnitDrawable

describe('[graphics quality] settings', () => {
  it('defaults to high and persists through JSON', () => {
    expect(createDefaultClientSettings().graphicsQuality).toBe('high')
    expect(sanitizeClientSettings({}).graphicsQuality).toBe('high')
    expect(sanitizeClientSettings({ graphicsQuality: 'bogus' }).graphicsQuality).toBe('high')
    const saved = sanitizeClientSettings({ graphicsQuality: 'low' })
    expect(parseClientSettingsJson(JSON.stringify(saved)).graphicsQuality).toBe('low')
  })
})

describe('[graphics quality] resolveEffectiveGraphics', () => {
  it('high passes the user options through and caps nothing', () => {
    const g = resolveEffectiveGraphics({ graphicsQuality: 'high', worldRenderFps: 60, lightQuality: 2 })
    expect(g.worldRenderFps).toBe(60)
    expect(g.lightQuality).toBe(2)
    expect(g.maxCrispScale).toBe(Number.POSITIVE_INFINITY)
    expect(g.maxRenderDpr).toBe(Number.POSITIVE_INFINITY)
    expect(g.postProcess).toEqual({
      shaderPreset: PD2_D2GL_CONFIG.graphics.shaderPreset,
      sharpen: PD2_D2GL_CONFIG.graphics.sharpen,
    })
    expect(g.vfxBudget).toBe(Number.POSITIVE_INFINITY)
    expect(g.groundLabelMax).toBe(Number.POSITIVE_INFINITY)
  })

  it('low clamps without touching the inputs; switching back restores them', () => {
    const user = { graphicsQuality: 'low' as const, worldRenderFps: 60 as const, lightQuality: 2 as const }
    const g = resolveEffectiveGraphics(user)
    expect(g.worldRenderFps).toBe(30)
    expect(g.lightQuality).toBe(0)
    expect(g.maxCrispScale).toBe(1)
    expect(g.maxRenderDpr).toBe(1)
    expect(resolveD2GlUpscaleKernel(g.postProcess.shaderPreset)).toBe('bilinear')
    expect(g.postProcess.sharpen).toBe(false)
    expect(g.vfxBudget).toBe(LOW_VFX_BUDGET)
    expect(g.groundLabelMax).toBe(LOW_GROUND_LABEL_MAX)
    const back = resolveEffectiveGraphics({ ...user, graphicsQuality: 'high' })
    expect(back.worldRenderFps).toBe(60)
    expect(back.lightQuality).toBe(2)
  })

  it('medium keeps bicubic without LumaSharpen, crisp scale <= 2, light <= 1', () => {
    const g = resolveEffectiveGraphics({ graphicsQuality: 'medium', worldRenderFps: 60, lightQuality: 2 })
    expect(resolveD2GlUpscaleKernel(g.postProcess.shaderPreset)).toBe('bicubic')
    expect(g.postProcess.sharpen).toBe(false)
    expect(g.maxCrispScale).toBe(2)
    expect(g.lightQuality).toBe(1)
  })
})

describe('[graphics quality] crisp backing store cap', () => {
  it('caps the integer scale', () => {
    const canvas = { clientWidth: 3200, clientHeight: 2400, width: 0, height: 0 } as unknown as HTMLCanvasElement
    expect(syncCrispBackingStore(canvas, 800, 600)).toBe(4)
    expect(canvas.width).toBe(3200)
    expect(syncCrispBackingStore(canvas, 800, 600, 2)).toBe(2)
    expect(canvas.width).toBe(1600)
    expect(syncCrispBackingStore(canvas, 800, 600, 1)).toBe(1)
    expect(canvas.width).toBe(800)
    expect(syncCrispBackingStore(canvas, 800, 600, Number.POSITIVE_INFINITY)).toBe(4)
  })
})

describe('[graphics quality] decorative VFX budget', () => {
  it('classifies by 1.13c Missiles.txt CollideType: colliding missiles are never decorative', () => {
    for (const key of ['firewall', 'blaze', 'infernoflame1', 'meteorfire', 'frozenorb', 'arrow']) {
      expect(getMissileTxtData(key).collideType).not.toBe(0)
      expect(isDecorativeMissileKey(key)).toBe(false)
    }
    for (const key of ['fireexplode', 'blood1']) {
      expect(getMissileTxtData(key).collideType).toBe(0)
      expect(isDecorativeMissileKey(key)).toBe(true)
    }
    expect(isDecorativeMissileKey('no-such-missile')).toBe(false)
  })

  it('keeps looping overlays and every overlay on the local player', () => {
    expect(isDecorativeVfx(overlay(7, false), 7)).toBe(false)
    expect(isDecorativeVfx(overlay(9, true), 7)).toBe(false)
    expect(isDecorativeVfx(overlay(9, false), 7)).toBe(true)
  })

  it('skips the farthest decorative effects only', () => {
    const near = missile('fireexplode', 5, 0)
    const mid = missile('fireexplode', 50, 0)
    const far = missile('fireexplode', 500, 0)
    const farOverlay = overlay(9, false, 400, 0)
    const danger = missile('firewall', 900, 0)
    const selfHit = overlay(7, false, 950, 0)
    const ents: SceneEntityDrawable[] = [LOCAL_PLAYER, far, danger, mid, farOverlay, near, selfHit]
    expect(selectVfxSkipSet(ents, Number.POSITIVE_INFINITY, 0, 0)).toBeNull()
    expect(selectVfxSkipSet(ents, 10, 0, 0)).toBeNull()
    const skip = selectVfxSkipSet(ents, 2, 0, 0)!
    expect(skip.size).toBe(2)
    expect(skip.has(far)).toBe(true)
    expect(skip.has(farOverlay)).toBe(true)
    const skipAll = selectVfxSkipSet(ents, 0, 0, 0)!
    expect(skipAll.size).toBe(4)
    expect(skipAll.has(danger)).toBe(false)
    expect(skipAll.has(selfHit)).toBe(false)
  })
})

describe('[graphics quality] ground label cap', () => {
  it('never exceeds the cap, keeps the hovered label and the original order', () => {
    const labels: GroundItemLabelInput[] = []
    for (let i = 0; i < 40; i++) {
      labels.push({ id: i, text: `item${i}`, screenX: i * 20, screenY: 300, isHovered: i === 39 })
    }
    const capped = capGroundItemLabels(labels, LOW_GROUND_LABEL_MAX, 400, 300)
    expect(capped.length).toBe(LOW_GROUND_LABEL_MAX)
    expect(capped.some((l) => l.id === 39)).toBe(true)
    const ids = capped.map((l) => l.id)
    expect([...ids].sort((a, b) => a - b)).toEqual(ids)
    expect(capGroundItemLabels(labels, Number.POSITIVE_INFINITY, 400, 300)).toBe(labels)
  })
})

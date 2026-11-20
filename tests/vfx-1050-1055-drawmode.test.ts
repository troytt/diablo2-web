/**
 * Issues #1050–#1055 (VFX-B3): Overlay.txt / Missiles.txt `Trans` -> D2gfx eDrawMode -> port blend, the GPU state
 * each mode uses, and Trans-independent bake keying.
 *
 * Ground truth (kb/render/d2gfx-draw-mode-113c.md):
 * - Overlay Trans is the eDrawMode unchanged (D2Client 0x6FB1B11D movzx ecx,[ebx+0x7C] -> 0x6FB1B12E push ecx ->
 *   D2gfx #10041 at 0x6FB1B143; pass B 0x6FB1B2B2 / 0x6FB1B2D0).
 * - Missile Trans 0/1/2 -> eDrawMode 5/3/4 (D2Client 0x6FB1CF32-0x6FB1CF4C).
 * - D2Direct3D 0x6F886B90: 0..2 SRCALPHA alpha 0x40/0x80/0xC0, 3 ONE/ONE, 4 ZERO/SRCCOLOR, 5 blend off, >=8 alpha 0xFF.
 */
import { describe, expect, it } from 'vitest'
import { packMissileSheetToRgbaPng, missileTargetTrans, missileMetaBlendMode } from '../src/baker/packers/pack-missiles.ts'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { OVERLAY_METAS } from '../src/client/render/overlays-meta.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import { FLOATS_PER_VERTEX, SpriteRenderer, fragmentShaderSource } from '../src/client/render/renderer.ts'
import {
  OVERLAY_METADATA,
  buildSceneDrawables,
  overlayTransToBlendMode,
  transToBlendMode,
  type RenderableUnitInput,
} from '../src/client/view/unit-drawables.ts'
import { getSharedDataRegistry } from '../src/common/data/data-registry.ts'
import { drawModeToBlendMode, overlayTransToDrawBlend } from '../src/common/gfx/draw-mode.ts'
import { CANONICAL_113C_MISSILES, getMissileTxtData } from '../src/common/skills/missiles-data.ts'

const GL = { ZERO: 0, ONE: 1, SRC_COLOR: 768, SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771, DST_COLOR: 774 }

/** A WebGL2 stub recording blendFunc / u_blendMode and the uploaded vertices. */
function mockRenderer(): { renderer: SpriteRenderer; blendFuncs: [number, number][]; blendUniform: number[]; uploads: Float32Array[] } {
  const blendFuncs: [number, number][] = []
  const blendUniform: number[] = []
  const uploads: Float32Array[] = []
  let id = 1
  const base: Record<string, unknown> = {
    ...GL,
    drawingBufferWidth: 640,
    drawingBufferHeight: 480,
    isContextLost: () => false,
    getParameter: (p: number) => (p === 3379 ? 8192 : 16),
    getProgramParameter: () => true,
    getShaderParameter: () => true,
    getProgramInfoLog: () => '',
    getShaderInfoLog: () => '',
    getAttribLocation: () => 0,
    getUniformLocation: (_p: unknown, name: string) => ({ name }),
    blendFunc: (s: number, d: number) => blendFuncs.push([s, d]),
    uniform1i: (loc: { name: string } | null, v: number) => {
      if (loc?.name === 'u_blendMode') blendUniform.push(v)
    },
    bufferSubData: (_t: number, _o: number, data: unknown, src?: number, len?: number) => {
      if (data instanceof Float32Array) uploads.push(data.slice(src ?? 0, (src ?? 0) + (len ?? data.length)))
    },
  }
  const gl = new Proxy(base, {
    get(target, prop) {
      if (typeof prop === 'string' && prop in target) return target[prop]
      if (typeof prop === 'string' && /^[A-Z0-9_]+$/.test(prop)) return 0x9000 + prop.length
      if (typeof prop === 'string' && prop.startsWith('create')) return () => ({ id: id++ })
      return () => undefined
    },
  })
  const canvas = {
    getContext: (t: string) => (t === 'webgl2' ? gl : null),
    addEventListener: () => {},
    removeEventListener: () => {},
    width: 640,
    height: 480,
  }
  return { renderer: new SpriteRenderer(canvas as unknown as HTMLCanvasElement), blendFuncs, blendUniform, uploads }
}

function overlayScene(token: string) {
  const unit: RenderableUnitInput = {
    kind: 'player',
    id: 1,
    classId: 1,
    x: 100,
    y: 100,
    overlays: [{ overlayId: 9000, token, frame: 0 }],
  } as RenderableUnitInput
  return buildSceneDrawables([unit], { tick: 0 })
}

function missileScene(missileKey: string) {
  const row = getMissileTxtData(missileKey)
  const unit = { kind: 'missile', id: 7, classId: row.id, missileKey, x: 100, y: 100, frame: 0 } as RenderableUnitInput
  return buildSceneDrawables([unit], { tick: 0 })
}

function missilesTxt(): Map<string, Readonly<Record<string, string>>> | null {
  try {
    const rows = new Map<string, Readonly<Record<string, string>>>()
    for (const row of getSharedDataRegistry().missilesTable.rows) {
      const name = row['Missile'] ?? ''
      if (name !== '' && (row['Id'] ?? '') !== '') rows.set(name, row)
    }
    return rows
  } catch {
    return null
  }
}
const TXT = missilesTxt()

describe('#1050 Overlay.txt Trans=5 is eDrawMode 5 NORMAL (opaque), not multiply', () => {
  const trans5 = OVERLAY_TXT_ROWS.filter(r => r.trans === 5)

  it('the five 1.13c Trans=5 rows', () => {
    expect(trans5.map(r => r.name).sort()).toEqual(
      ['durieldead_fwd', 'durieldead_rear', 'energyshield', 'fetishdeath1', 'vulturedemonfeathers'].sort(),
    )
    expect(overlayTransToBlendMode(5)).toBe('normal')
  })

  it('every Trans=5 overlay drawable is normal and draws with premultiplied ONE/ONE_MINUS_SRC_ALPHA', () => {
    for (const row of trans5) {
      const ov = overlayScene(row.name).overlayDrawables.find(d => d.token === row.name)
      expect(ov, row.name).toBeDefined()
      expect(ov!.blendMode, row.name).toBe('normal')
    }
    const { renderer, blendFuncs } = mockRenderer()
    renderer.setBlendMode('burn')
    renderer.setBlendMode('normal')
    expect(blendFuncs.at(-1)).toEqual([GL.ONE, GL.ONE_MINUS_SRC_ALPHA])
    expect(blendFuncs.at(-1)).not.toEqual([GL.DST_COLOR, GL.ZERO])
  })

  it('baked energyshield meta is normal and black (index != 0) texels stay opaque', () => {
    expect(OVERLAY_METAS['energyshield']!.blendMode).toBe('normal')
    const palette = new Uint8Array(256 * 3)
    palette.set([200, 150, 100], 7 * 3) // index 5 stays RGB 0
    const sheet = {
      width: null,
      groups: [{ frames: [{ width: 3, height: 1, indices: new Uint8Array([0, 5, 7]), mask: new Uint8Array([1, 1, 1]) }] }],
    }
    const packed = packMissileSheetToRgbaPng(sheet as never, palette)
    expect(packed.png.byteLength).toBeGreaterThan(0)
    // The packer's keying rule is now index-0 only: verify on its raw pixel rule through a 1x3 decode.
    const alpha = decodeAlphaRow(packed.png, 3)
    expect(alpha).toEqual([0, 255, 255])
  })
})

describe('#1051 Overlay.txt Trans=0 is eDrawMode 0 TRANS25', () => {
  it('0/1/2 -> trans25/trans50/trans75', () => {
    expect(overlayTransToBlendMode(0)).toBe('trans25')
    expect(overlayTransToBlendMode(1)).toBe('trans50')
    expect(overlayTransToBlendMode(2)).toBe('trans75')
  })

  it('whirlwind, ice_cage, ice_cage_melt drawables are trans25 and their quads carry alpha 0.25', () => {
    const names = OVERLAY_TXT_ROWS.filter(r => r.trans === 0).map(r => r.name).sort()
    expect(names).toEqual(['ice_cage', 'ice_cage_melt', 'whirlwind'])
    for (const name of names) {
      const ov = overlayScene(name).overlayDrawables.find(d => d.token === name)
      expect(ov?.blendMode, name).toBe('trans25')
    }
    const { renderer, uploads } = mockRenderer()
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.draw({ x: 0, y: 0, width: 4, height: 4 }, 0, 0, { blendMode: 'trans25' })
    renderer.flush()
    const v = uploads.at(-1)!
    expect(v.length).toBeGreaterThanOrEqual(4 * FLOATS_PER_VERTEX)
    expect(v[7]).toBeCloseTo(0.25)
  })
})

describe('#1052 Missiles.txt Trans=2 is eDrawMode 4 (BURN = multiply ZERO/SRC_COLOR)', () => {
  it('missile Trans 0/1/2 -> eDrawMode 5/3/4 (0x6FB1CF32) -> normal/additive/burn', () => {
    expect(transToBlendMode(0)).toBe('normal')
    expect(transToBlendMode(1)).toBe('additive')
    expect(transToBlendMode(2)).toBe('burn')
  })

  it('unholybolt1..4 drawables are burn, which binds ZERO/SRC_COLOR with transparent-neutral shading', () => {
    for (const key of ['unholybolt1', 'unholybolt2', 'unholybolt3', 'unholybolt4']) {
      expect(getMissileTxtData(key).trans, key).toBe(2)
      const d = missileScene(key).missileDrawables.find(m => m.missileKey === key)
      expect(d?.blendMode, key).toBe('burn')
    }
    const { renderer, blendFuncs, blendUniform } = mockRenderer()
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.draw({ x: 0, y: 0, width: 4, height: 4 }, 0, 0, { blendMode: 'burn' })
    renderer.flush()
    expect(blendFuncs.at(-1)).toEqual([GL.ZERO, GL.SRC_COLOR])
    expect(blendUniform.at(-1)).toBe(2)
    // dst * mix(1, src, a): an alpha-0 texel leaves a white background white; an opaque texel gives dst*src.
    expect(fragmentShaderSource(4)).toContain('mix(vec3(1.0), texel.rgb * v_tint.rgb, texel.a * v_tint.a)')
  })

  it('missile-overlay-renderer has no additive fallback for unknown missiles', () => {
    expect(() => getMissileTxtData('__no_such_missile__')).toThrow()
  })
})

describe('#1053 CANONICAL Missiles Trans equals Missiles.txt', () => {
  it.skipIf(TXT === null)('trans == Number(row.Trans || 0) for every canonical row', () => {
    const bad: string[] = []
    for (const [key, row] of Object.entries(CANONICAL_113C_MISSILES)) {
      const t = TXT!.get(row.name) ?? TXT!.get(key)
      if (!t) continue
      const want = (t['Trans'] ?? '').trim() === '' ? 0 : Number(t['Trans'])
      if ((row.trans ?? 0) !== want) bad.push(`${key}: ${String(row.trans)} != ${String(want)}`)
    }
    expect(bad).toEqual([])
  })

  it('meteor family opaque; twister / tornado / volcano debris 2 additive', () => {
    for (const key of ['meteor', 'vampiremeteor', 'royalstrikemeteor']) {
      expect(CANONICAL_113C_MISSILES[key]!.trans, key).toBe(0)
      expect(missileScene(key).missileDrawables[0]?.blendMode, key).toBe('normal')
    }
    for (const key of ['twister', 'tornado', 'volcano debris 2']) {
      expect(getMissileTxtData(key).trans, key).toBe(1)
      expect(missileScene(key).missileDrawables[0]?.blendMode, key).toBe('additive')
    }
    expect(MISSILE_METAS['twister']!.trans).toBe(1)
    expect(MISSILE_METAS['tornado']!.trans).toBe(1)
    expect(MISSILE_METAS['meteor']!.trans).toBe(0)
    expect(missileScene('meteortail').missileDrawables[0]?.blendMode).toBe('additive')
  })
})

describe('#1054 bake keying is independent of Trans', () => {
  it('black texels are never colour-keyed, so keyed(atlas trans) == keyed(row Trans) for every row', () => {
    const palette = new Uint8Array(256 * 3)
    const sheet = {
      width: null,
      groups: [{ frames: [{ width: 2, height: 1, indices: new Uint8Array([172, 9]), mask: new Uint8Array([1, 1]) }] }],
    }
    expect(decodeAlphaRow(packMissileSheetToRgbaPng(sheet as never, palette).png, 2)).toEqual([255, 255])
    expect(packMissileSheetToRgbaPng.length).toBe(2) // no trans parameter left
  })

  it('every meta named after a real Missiles.txt row carries that row Trans and its draw-mode label', () => {
    const bad: string[] = []
    for (const [key, meta] of Object.entries(MISSILE_METAS)) {
      const row = CANONICAL_113C_MISSILES[key.toLowerCase()]
      if (!row || row.name.toLowerCase() !== key.toLowerCase()) continue
      if (meta.name.toLowerCase() !== key.toLowerCase()) continue
      if (meta.trans !== (row.trans ?? 0)) bad.push(`${key}: ${String(meta.trans)} != ${String(row.trans)}`)
      if (meta.blendMode !== missileMetaBlendMode(row.trans ?? 0)) bad.push(`${key}: blend ${String(meta.blendMode)}`)
    }
    expect(bad).toEqual([])
    expect(() => missileTargetTrans({ name: 'meteor', trans: 1 })).toThrow()
    expect(missileTargetTrans({ name: 'meteor', trans: 0 })).toBe(0)
  })
})

describe('#1055 one Trans -> eDrawMode table shared by runtime and baker', () => {
  it('baker meta blendMode == map(Overlay.txt Trans) for every Overlay.txt row; Trans 3 rows are additive', () => {
    const rows = new Map(OVERLAY_TXT_ROWS.map(r => [r.name.toLowerCase(), r]))
    const bad: string[] = []
    let trans3 = 0
    for (const [key, meta] of Object.entries(OVERLAY_METAS)) {
      const row = rows.get(meta.name.toLowerCase())
      if (!row || meta.name.toLowerCase() !== key.toLowerCase()) continue
      if (meta.trans !== row.trans) bad.push(`${key}: trans ${String(meta.trans)} != ${String(row.trans)}`)
      if (meta.blendMode !== overlayTransToDrawBlend(row.trans)) bad.push(`${key}: ${String(meta.blendMode)}`)
      if (row.trans === 3) {
        trans3 += 1
        expect(meta.blendMode, key).toBe('additive')
      }
    }
    expect(bad).toEqual([])
    expect(trans3).toBeGreaterThan(100)
  })

  it('runtime and baker map 0..8 identically; Trans 8 (tentacleheadbloodripple) is opaque', () => {
    for (let t = 0; t <= 8; t += 1) expect(overlayTransToBlendMode(t)).toBe(drawModeToBlendMode(t))
    expect(OVERLAY_TXT_ROWS.find(r => r.name === 'tentacleheadbloodripple')?.trans).toBe(8)
    expect(overlayTransToBlendMode(8)).toBe('normal')
  })

  it('OVERLAY_METADATA no longer hard-codes a blend mode', () => {
    for (const meta of Object.values(OVERLAY_METADATA)) expect('blendMode' in meta).toBe(false)
  })
})

/** Alpha channel of the first row of an RGBA PNG produced by encodeRgbaPng. */
function decodeAlphaRow(png: Uint8Array, width: number): number[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zlib = require('node:zlib') as typeof import('node:zlib')
  const chunks: Uint8Array[] = []
  let at = 8
  while (at < png.length) {
    const len = (png[at]! << 24) | (png[at + 1]! << 16) | (png[at + 2]! << 8) | png[at + 3]!
    const type = String.fromCharCode(png[at + 4]!, png[at + 5]!, png[at + 6]!, png[at + 7]!)
    if (type === 'IDAT') chunks.push(png.subarray(at + 8, at + 8 + len))
    at += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks))
  // Row 0: filter byte then RGBA; the encoder may filter, so only filter 0 (None) / 1 (Sub) are handled here.
  const filter = raw[0]!
  const out: number[] = []
  let prev = [0, 0, 0, 0]
  for (let x = 0; x < width; x += 1) {
    const px = [0, 1, 2, 3].map(c => raw[1 + x * 4 + c]!)
    const v = filter === 1 ? px.map((b, c) => (b + prev[c]!) & 0xff) : px
    prev = v
    out.push(v[3]!)
  }
  return out
}

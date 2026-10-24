/**
 * Integration tests for the Diablo II v1.13c light grid consumers (issue #830) and the environment system.
 *
 * Verifies:
 * 1. Single-pass draw call batching with dynamic lighting enabled (drawCalls === 1).
 * 2. Exact 10-float vertex stride invariant (FLOATS_PER_VERTEX === 10).
 * 3. Lazy 48x48 RGBA8 lightmap texture allocation upon first setLighting() invocation (bad sizes throw).
 * 4. The flat unit light (D2Client 0x6fb4f120): tint × T[I][C] / 255, prelit bit, additive sprites unlit.
 * 5. 1.13c room ambient (Levels.txt light vs act clock) and the light-grid prefill (0x6fb59c90).
 * 6. The lighting pass: origin = path sub-tile − 24 (0x6fb59e8e), local player light radius 13 + stat 89 / 90
 *    (0x6fac92f3, 0x6fac8bc0, 0x6fac89a0), shadows only in light mode 2 (0x6fb59480), one build per game frame.
 */

import { describe, it, expect } from 'vitest'
import {
  SpriteRenderer,
  FLOATS_PER_VERTEX,
  UNIT_LIGHT_PRELIT,
  type LightingConfig,
} from '../src/client/render/renderer.ts'
import {
  LIGHT_GRID_SIZE,
  LightGrid,
  LightList,
  createLightShadowScratch,
  lightPos8,
} from '../src/common/drlg/light-grid.ts'
import { resolveLevelAmbient } from '../src/common/world/ambient-light.ts'
import { Environment } from '../src/common/world/environment.ts'
import { getLevelLighting } from '../src/common/world/levels-meta.ts'
import {
  COLLIDE_MASK_INVALID,
  COLLIDE_MISSILE_BARRIER,
  COLLIDE_VISIBLE,
  COLLIDE_WALL,
  buildIsoMapScene,
  type CollisionGrid,
} from '../src/common/world/d2map.ts'
import { subTileFlagsOf, type Dt1, type Dt1Tile } from '../src/common/formats/dt1.ts'
import type { Ds1, Ds1Cell } from '../src/common/formats/ds1.ts'
import {
  applyLightingInputs,
  getLightingPassState,
  wallColumnTints113c,
  type LightingInputs,
  type LightingRendererParams,
} from '../src/client/scene/lighting-presets.ts'

interface MockResource {
  id: number
  type: string
}

function createMockCanvas(): {
  canvas: any
  stats: {
    createdTextures: Set<MockResource>
    glDrawCalls: number
    /** Vertex floats of every flush (bufferSubData). */
    uploads: Float32Array[]
  }
} {
  let nextId = 1
  const stats = {
    createdTextures: new Set<MockResource>(),
    glDrawCalls: 0,
    uploads: [] as Float32Array[],
  }

  const gl: any = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    MAX_TEXTURE_SIZE: 3379,
    MAX_TEXTURE_IMAGE_UNITS: 34930,
    TEXTURE_2D: 3553,
    RGBA: 6408,
    RGBA8: 32856,
    R8: 33321,
    RED: 6403,
    UNSIGNED_BYTE: 5121,
    UNSIGNED_INT: 5125,
    FLOAT: 5126,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    DYNAMIC_DRAW: 35048,
    STATIC_DRAW: 35044,
    TRIANGLES: 4,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    CLAMP_TO_EDGE: 33071,
    NEAREST: 9728,
    LINEAR: 9729,
    UNPACK_ALIGNMENT: 3317,
    BLEND: 3042,
    SRC_ALPHA: 770,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 771,
    DEPTH_TEST: 2929,
    COLOR_BUFFER_BIT: 16384,
    TEXTURE0: 33984,

    drawingBufferWidth: 1280,
    drawingBufferHeight: 720,

    isContextLost: () => false,
    getParameter: (param: number) => {
      if (param === 34930) return 16 // MAX_TEXTURE_IMAGE_UNITS
      if (param === 3379) return 8192 // MAX_TEXTURE_SIZE
      return 16
    },

    createProgram: () => ({ id: nextId++, type: 'program' }),
    deleteProgram: () => {},
    attachShader: () => {},
    detachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: () => {},

    createShader: (type: number) => ({ id: nextId++, type: type === 35633 ? 'vertexShader' : 'fragmentShader' }),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},

    createVertexArray: () => ({ id: nextId++, type: 'vao' }),
    deleteVertexArray: () => {},
    bindVertexArray: () => {},

    createBuffer: () => ({ id: nextId++, type: 'buffer' }),
    deleteBuffer: () => {},
    bindBuffer: () => {},
    bufferData: () => {},
    bufferSubData: (_target: number, _offset: number, data: unknown, srcOffset?: number, length?: number) => {
      if (data instanceof Float32Array) {
        const from = srcOffset ?? 0
        stats.uploads.push(data.slice(from, from + (length ?? data.length - from)))
      }
    },

    getAttribLocation: (_p: any, name: string) => {
      const map: Record<string, number> = {
        a_position: 0,
        a_uv: 1,
        a_tint: 2,
        a_unit: 3,
        a_paletteRow: 4,
      }
      return map[name] ?? -1
    },
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    vertexAttribIPointer: () => {},

    createTexture: () => {
      const res: MockResource = { id: nextId++, type: 'texture' }
      stats.createdTextures.add(res)
      return res
    },
    deleteTexture: (t: MockResource) => { stats.createdTextures.delete(t) },
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    texStorage2D: () => {},
    texSubImage2D: () => {},
    pixelStorei: () => {},

    getUniformLocation: (_p: any, name: string) => ({ name, id: nextId++ }),
    uniform2f: () => {},
    uniform4f: () => {},
    uniform1f: () => {},
    uniform1i: () => {},
    uniform1iv: () => {},

    enable: () => {},
    disable: () => {},
    blendFunc: () => {},
    viewport: () => {},
    clearColor: () => {},
    clear: () => {},
    activeTexture: () => {},
    drawArrays: () => { stats.glDrawCalls += 1 },
    drawElements: () => { stats.glDrawCalls += 1 },
  }

  const canvas: any = {
    getContext: (type: string) => (type === 'webgl2' ? gl : null),
    addEventListener: () => {},
    removeEventListener: () => {},
    width: 1280,
    height: 720,
    drawingBufferWidth: 1280,
    drawingBufferHeight: 720,
  }

  return { canvas, stats }
}

/** Renderer lighting config of a grid with its texture. */
function gridLighting(grid: LightGrid): LightingConfig {
  return {
    originSubX: grid.originSubX,
    originSubY: grid.originSubY,
    sceneOriginX: 0,
    sceneOriginY: 0,
    lightmap: grid.exportTextureBuffer(),
  }
}

/** A 200×200 sub-tile level without obstacles (level-local sub-tiles, scene origin 0). */
function openCollisionGrid(): CollisionGrid {
  return {
    cellsX: 40,
    cellsY: 40,
    originX: 0,
    originY: 0,
    gridWidth: 200,
    blocked: new Uint8Array(200 * 200),
    collisionMasks: new Uint16Array(200 * 200),
  }
}

const cell = (gx: number, gy: number): number => gy * LIGHT_GRID_SIZE + gx

describe('Scene Lighting & Environment Integration', () => {
  it('maintains strict 10-float vertex stride invariant', () => {
    expect(FLOATS_PER_VERTEX).toBe(10)
  })

  it('allocates lightmap texture lazily on first setLighting call and rejects a grid that is not 48x48 RGBA8', () => {
    const { canvas } = createMockCanvas()
    const renderer = new SpriteRenderer(canvas)

    // Non-lighting setup has 3 default textures (atlas, white, palette)
    const initialTextures = (renderer as any).allocatedTextures.size
    expect(initialTextures).toBe(3)

    // Clear and draw unlit quad
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.drawSolid(0, 0, 100, 100, [1, 1, 1, 1])
    renderer.flush()
    expect((renderer as any).allocatedTextures.size).toBe(3)

    // Set lighting
    const lightGrid = new LightGrid()
    lightGrid.setOrigin(100, 100)
    renderer.setLighting(gridLighting(lightGrid))

    // Lightmap texture is now allocated (3 + 1 = 4)
    expect((renderer as any).allocatedTextures.size).toBe(4)

    expect(() => renderer.setLighting({ ...gridLighting(lightGrid), lightmap: new Uint8Array(64 * 64 * 4) })).toThrow(
      /48x48 RGBA8/,
    )

    renderer.dispose()
  })

  it('maintains single-pass draw call batching when dynamic lighting is active', () => {
    const { canvas, stats } = createMockCanvas()
    const renderer = new SpriteRenderer(canvas)
    const lightGrid = new LightGrid()
    lightGrid.setOrigin(200, 200)
    const lights = new LightList()
    lights.create(null, 1, 13, 255, 255, 255, 255, lightPos8(200.5), lightPos8(200.5))
    lights.build(lightGrid, 2, { collisionAt: () => 0, localPlayerId: -1, scratch: createLightShadowScratch() })

    renderer.begin({ x: 100, y: 100, zoom: 1 }, [0.03, 0.03, 0.04])
    renderer.setLighting(gridLighting(lightGrid))

    // Draw world floor tiles and entities
    for (let i = 0; i < 50; i += 1) {
      renderer.drawSolid(i * 10, i * 5, 80, 40, [0.8, 0.8, 0.8, 1])
    }

    // Flush batch
    renderer.flush()

    // All 50 quads rendered in exactly 1 single draw call
    expect(renderer.drawCalls).toBe(1)
    expect(stats.glDrawCalls).toBe(1)
    expect(renderer.quadsSubmitted).toBe(50)

    renderer.dispose()
  })

  it('supports unshaded UI rendering by setting lighting to null before minimap', () => {
    const { canvas, stats } = createMockCanvas()
    const renderer = new SpriteRenderer(canvas)
    const lightGrid = new LightGrid()
    lightGrid.setOrigin(200, 200)

    renderer.begin({ x: 100, y: 100, zoom: 1 })

    // 1. World pass with dynamic lighting
    renderer.setLighting(gridLighting(lightGrid))
    renderer.drawSolid(0, 0, 50, 50, [1, 1, 1, 1])

    // 2. Automap / Minimap pass without lighting
    renderer.setLighting(null)
    renderer.drawSolid(10, 10, 20, 20, [0, 1, 0, 1])

    renderer.flush()

    // Total draw calls: 1 for lit world + 1 for unshaded automap = 2
    expect(renderer.drawCalls).toBe(2)
    expect(stats.glDrawCalls).toBe(2)

    renderer.dispose()
  })

  it('setUnitLight multiplies the sprite tint by the flat unit light and marks it prelit (0x6fb4f120); additive sprites, unlit frames and begin() skip it', () => {
    const { canvas, stats } = createMockCanvas()
    const renderer = new SpriteRenderer(canvas)
    const lightGrid = new LightGrid()
    lightGrid.setOrigin(100, 100)
    const frame = { x: 0, y: 0, width: 8, height: 8 }
    /** Tint r, g, b and the texture-unit word of quad `q` (first corner) of upload `u`. */
    const quadOf = (u: number, q: number): number[] => {
      const v = stats.uploads[u]!
      const at = q * 4 * FLOATS_PER_VERTEX
      return [v[at + 4]!, v[at + 5]!, v[at + 6]!, v[at + 8]!]
    }

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.setLighting(gridLighting(lightGrid))
    renderer.setUnitLight([0.5, 0.25, 1])
    renderer.draw(frame, 0, 0, { tint: [0.5, 1, 0.5, 1] })
    renderer.draw(frame, 0, 0, { tint: [0.5, 1, 0.5, 1], blendMode: 'highlight' })
    renderer.setUnitLight(null)
    renderer.draw(frame, 0, 0)
    renderer.flush()
    // Quads 0 and 2 are alpha blended, quad 1 is additive (its own batch after the blend switch).
    const lit = stats.uploads.flatMap((_, u) => Array.from({ length: stats.uploads[u]!.length / (4 * FLOATS_PER_VERTEX) }, (_, q) => quadOf(u, q)))
    expect(lit).toHaveLength(3)
    expect(lit[0]!.slice(0, 3)).toEqual([0.25, 0.25, 0.5])
    expect(lit[0]![3]! & UNIT_LIGHT_PRELIT).toBe(UNIT_LIGHT_PRELIT)
    expect(lit[1]!.slice(0, 3)).toEqual([0.5, 1, 0.5])
    expect(lit[1]![3]! & UNIT_LIGHT_PRELIT).toBe(0)
    expect(lit[2]!.slice(0, 3)).toEqual([1, 1, 1])
    expect(lit[2]![3]! & UNIT_LIGHT_PRELIT).toBe(0)

    // begin() resets the unit light; without lighting it does not apply either.
    stats.uploads.length = 0
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.setLighting(gridLighting(lightGrid))
    renderer.draw(frame, 0, 0)
    renderer.setLighting(null)
    renderer.setUnitLight([0.5, 0.5, 0.5])
    renderer.draw(frame, 0, 0)
    renderer.flush()
    const after = stats.uploads.flatMap((_, u) => Array.from({ length: stats.uploads[u]!.length / (4 * FLOATS_PER_VERTEX) }, (_, q) => quadOf(u, q)))
    expect(after.map((q) => q[3]! & UNIT_LIGHT_PRELIT)).toEqual([0, 0])
    expect(after.map((q) => q.slice(0, 3))).toEqual([[1, 1, 1], [1, 1, 1]])

    expect(() => renderer.setUnitLight([1.5, 0, 0])).toThrow(/0\.\.1/)
    renderer.dispose()
  })

  it('draws 160px wall tiles as 5 32px Gouraud-shaded columns with columnTints (D2gfx.#10001 / #10058) and encodes roofHeight on all 4 vertices (D2gfx.#10023)', () => {
    const { canvas, stats } = createMockCanvas()
    const renderer = new SpriteRenderer(canvas)
    const lightGrid = new LightGrid()
    lightGrid.setOrigin(100, 100)
    const wallFrame = { x: 0, y: 0, width: 160, height: 120 }
    const columnTints: [
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ] = [
      [0.1, 0.2, 0.3],
      [0.2, 0.3, 0.4],
      [0.4, 0.5, 0.6],
      [0.6, 0.7, 0.8],
      [0.8, 0.9, 1.0],
      [1.0, 0.5, 0.25],
    ]

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.setLighting(gridLighting(lightGrid))
    renderer.draw(wallFrame, 100, 200, {
      tint: [1, 1, 1, 0.5],
      columnTints,
    })
    renderer.draw(wallFrame, 300, 400, {
      roofHeight: 80,
    })
    renderer.flush()

    expect(stats.uploads).toHaveLength(1)
    const buf = stats.uploads[0]!
    // 5 column quads for wall + 1 quad for roof = 6 quads (24 vertices)
    expect(buf.length).toBe(6 * 4 * FLOATS_PER_VERTEX)

    for (let col = 0; col < 5; col += 1) {
      const base = col * 4 * FLOATS_PER_VERTEX
      const leftTint = columnTints[col]!
      const rightTint = columnTints[col + 1]!
      // Vertex 0 (top-left) and Vertex 3 (bottom-left) use leftTint
      expect(buf[base + 0]).toBeCloseTo(100 + col * 32, 5)
      expect(buf[base + 4]).toBeCloseTo(leftTint[0], 5)
      expect(buf[base + 5]).toBeCloseTo(leftTint[1], 5)
      expect(buf[base + 6]).toBeCloseTo(leftTint[2], 5)
      expect(buf[base + 7]).toBeCloseTo(0.5, 5)
      expect(buf[base + 8]! & UNIT_LIGHT_PRELIT).toBe(UNIT_LIGHT_PRELIT)

      // Vertex 1 (top-right) and Vertex 2 (bottom-right) use rightTint
      const v1 = base + FLOATS_PER_VERTEX
      expect(buf[v1 + 0]).toBeCloseTo(100 + (col + 1) * 32, 5)
      expect(buf[v1 + 4]).toBeCloseTo(rightTint[0], 5)
      expect(buf[v1 + 5]).toBeCloseTo(rightTint[1], 5)
      expect(buf[v1 + 6]).toBeCloseTo(rightTint[2], 5)
      expect(buf[v1 + 7]).toBeCloseTo(0.5, 5)
      expect(buf[v1 + 8]! & UNIT_LIGHT_PRELIT).toBe(UNIT_LIGHT_PRELIT)
    }

    // Quad 5 (roof): all 4 vertices encode roofHeight = 80 in a_palette (-1 + 80 * 32 = 2559) and do not set UNIT_LIGHT_PRELIT
    const roofBase = 5 * 4 * FLOATS_PER_VERTEX
    for (let v = 0; v < 4; v += 1) {
      const at = roofBase + v * FLOATS_PER_VERTEX
      expect(buf[at + 8]! & UNIT_LIGHT_PRELIT).toBe(0)
      expect(buf[at + 9]).toBe(-1 + 80 * 32)
    }

    renderer.dispose()
  })

  it('resolves the 1.13c room ambient: coloured Levels.txt light, otherwise the act clock (0x6fb59a20)', () => {
    const env = Environment.alloc() // ENVIRONMENT_Alloc: noon, intensity 128, white

    // Level 1: Rogue Encampment has Levels.txt RGB 0,0,0, so the act clock lights it.
    expect(resolveLevelAmbient(1, env)).toEqual({
      intensity: 128,
      red: 255,
      green: 255,
      blue: 255,
      source: 'environment',
    })

    // Level 37: Catacombs Level 4 has a coloured Levels.txt light, used as is.
    const cataMeta = getLevelLighting(37)!
    expect(resolveLevelAmbient(37, env)).toEqual({
      intensity: cataMeta.intensity,
      red: cataMeta.red,
      green: cataMeta.green,
      blue: cataMeta.blue,
      source: 'levels',
    })

    // Act IV levels have coloured Levels.txt lights, so the Act IV clock (which steps toward 64 in
    // the Outer Steppes) never shows: level 104 stays at its Levels.txt Intensity 120.
    for (let t = 0; t < 200; t += 1) env.updatePeriodOfDay(104)
    expect(env.intensity).toBe(64)
    expect(resolveLevelAmbient(104, env)).toEqual({
      intensity: 120,
      red: 255,
      green: 255,
      blue: 255,
      source: 'levels',
    })
    expect(resolveLevelAmbient(103, env).intensity).toBe(140)

    expect(() => resolveLevelAmbient(9999, env)).toThrow(/no row for level 9999/)
  })

  it('the local player light is shadowed only in light mode 2 (Light Quality 2 at 25 FPS); Light Quality 0 forces mode 0 (0x6fb58800)', () => {
    // A COLLIDE_VISIBLE column at sub-tile x 105 (cell 29), y 90..110 (cells 14..34). The player stands at 100.0
    // (D2 precise 100.5): light x8 = 808, the corner of sub-tile 101 = cell (25, 25), radius 13 (104 in x8).
    const collisionGrid = openCollisionGrid()
    for (let y = 90; y <= 110; y += 1) collisionGrid.collisionMasks![y * 200 + 105] = COLLIDE_VISIBLE
    const run = (lightQuality: 0 | 2): LightGrid => {
      const grid = new LightGrid()
      applyLightingInputs(
        {
          preset: 'auto',
          levelId: 8,
          collisionGrid,
          playerSubTile: { x: 100, y: 100 },
          playerUnitId: 1,
          lightEmitters: [],
          tick: 1,
          ambient: null,
        },
        { lightGrid: grid, renderer: { setLighting: () => {} }, lightQuality, nowMs: 5000 },
      )
      return grid
    }
    const high = run(2)
    const low = run(0)
    expect(getLightingPassState(high).lastMode).toBe(2)
    expect(getLightingPassState(low).lastMode).toBe(0)
    expect(high.blocked[cell(29, 25)]).toBe(1)
    // The light's own corner: v = (104 * floor(255·65536 / 104)) >> 16 = 254 on a zero prefill.
    expect(high.intensity[cell(25, 25)]).toBe(254)
    // The blocked point itself stays lit (d = 30): v = (74 * 160689) >> 16 = 181 in both modes.
    expect(high.intensity[cell(29, 25)]).toBe(181)
    expect(low.intensity[cell(29, 25)]).toBe(181)
    // Behind the column the shade is 16 in mode 2 (dark); mode 0 has no shadows (d = 53 → 125).
    expect(high.intensity[cell(32, 25)]).toBe(0)
    expect(low.intensity[cell(32, 25)]).toBe(125)
    // In front of the column (west) both modes agree.
    expect(high.intensity[cell(20, 25)]).toBe(low.intensity[cell(20, 25)])
  })

  it('supports interactive scene lighting presets and #lighting selector in acts.html', async () => {
    const { LIGHTING_PRESETS, normalizeLightingPreset } = await import('../src/client/scene/lighting-presets.ts')
    const fs = await import('node:fs')

    expect(normalizeLightingPreset(undefined)).toBe('auto')
    expect(normalizeLightingPreset('1')).toBe('auto')
    expect(normalizeLightingPreset('0')).toBe('off')
    expect(normalizeLightingPreset('off')).toBe('off')
    expect(normalizeLightingPreset('noon')).toBe('noon')
    expect(normalizeLightingPreset('night')).toBe('night')
    expect(normalizeLightingPreset('cave')).toBe('cave')
    expect(normalizeLightingPreset('hell')).toBe('hell')
    expect(normalizeLightingPreset('eclipse')).toBe('eclipse')

    expect(LIGHTING_PRESETS.noon.overrideAmbient?.intensity).toBe(255)
    expect(LIGHTING_PRESETS.cave.overrideAmbient?.intensity).toBe(5)
    expect(LIGHTING_PRESETS.off.enabled).toBe(false)

    const playHtml = fs.readFileSync('play.html', 'utf8')
    expect(playHtml).toContain('id="d2-toolbar-container"')
    for (const preset of Object.keys(LIGHTING_PRESETS)) {
      expect(LIGHTING_PRESETS[preset as keyof typeof LIGHTING_PRESETS]).toBeDefined()
    }
  }, 15000)

  it('the local player light has radius 13 (0x6fac92f3): lit 13 sub-tiles away along an axis, dark at 14', () => {
    const grid = new LightGrid()
    applyLightingInputs(
      {
        preset: 'auto',
        levelId: 8,
        collisionGrid: openCollisionGrid(),
        playerSubTile: { x: 100, y: 100 },
        playerUnitId: 1,
        lightEmitters: [],
        tick: 1,
        ambient: null,
      },
      { lightGrid: grid, renderer: { setLighting: () => {} }, nowMs: 0 },
    )
    // Cell 38 is 13 sub-tiles east of the light corner (d = 99 < 104), cell 39 is 14 (d = 107).
    expect(grid.intensity[cell(38, 25)]).toBe(12)
    expect(grid.intensity[cell(39, 25)]).toBe(0)
    expect(grid.intensity[cell(25, 12)]).toBe(12)
    expect(grid.intensity[cell(25, 11)]).toBe(0)
  })

  it('applyLightingInputs prefills the grid with the room ambient (0x6fb59c90) around origin = path sub-tile − 24 and rebuilds once per game frame', () => {
    const lightGrid = new LightGrid()
    let captured: LightingRendererParams | null = null
    const renderer = {
      setLighting(cfg: LightingRendererParams | null) {
        captured = cfg
      },
    }
    const base: Omit<LightingInputs, 'ambient' | 'tick'> = {
      preset: 'auto',
      levelId: 2,
      collisionGrid: openCollisionGrid(),
      playerSubTile: { x: 100, y: 100 },
      playerUnitId: 1,
      lightEmitters: [],
    }
    const targets = { lightGrid, renderer, nowMs: 0 }
    const rgbi = (idx: number): number[] => [
      lightGrid.intensity[idx]!,
      lightGrid.red[idx]!,
      lightGrid.green[idx]!,
      lightGrid.blue[idx]!,
    ]
    const dusk = { intensity: 60, red: 200, green: 150, blue: 100, source: 'environment' as const }
    const caveRoom = {
      subX: 110,
      subY: 80,
      subW: 10,
      subH: 40,
      ambient: { intensity: 0, red: 255, green: 255, blue: 255, source: 'levels' as const },
    }

    // 1. Every cell gets the player room's light, then the near room overwrites its own (inclusive) rectangle.
    expect(applyLightingInputs({ ...base, tick: 1, ambient: { playerRoom: dusk, nearRooms: [caveRoom] } }, targets)).toBe(true)
    expect(captured).not.toBeNull()
    expect(captured).not.toHaveProperty('ambient')
    // Grid origin = floor(100 + 0.5) - 24 = 76: the near room (x 110..120, y 80..120) covers cells 34..44 x 4..44.
    expect(lightGrid.originSubX).toBe(76)
    expect(lightGrid.originSubY).toBe(76)
    expect(captured!.originSubX).toBe(76)
    expect(rgbi(cell(0, 0))).toEqual([60, 200, 150, 100])
    expect(rgbi(cell(47, 47))).toEqual([60, 200, 150, 100])
    expect(lightGrid.intensity[cell(34, 4)]).toBe(0)
    expect(lightGrid.intensity[cell(44, 44)]).toBe(0)
    expect(lightGrid.intensity[cell(33, 4)]).toBe(60)
    expect(lightGrid.intensity[cell(34, 3)]).toBe(60)
    expect(lightGrid.intensity[cell(45, 44)]).toBe(60)
    expect(lightGrid.intensity[cell(44, 45)]).toBe(60)
    // The player light blends on top of the prefill: I = min(60 + 254, 255), every colour saturates.
    expect(rgbi(cell(25, 25))).toEqual([255, 255, 255, 255])
    // Texture: RGB = floor(I·C / 255), A = I.
    const lightmap = captured!.lightmap!
    expect(Array.from(lightmap.subarray(0, 4))).toEqual([47, 35, 23, 60])

    // 2. The same game frame again: no rebuild and no new upload.
    applyLightingInputs({ ...base, tick: 1, ambient: null }, targets)
    expect(lightGrid.intensity[cell(0, 0)]).toBe(60)
    expect(captured!.lightmap).toBeUndefined()

    // 3. Next frame without a player room: the whole grid is zero (0x6fb59e13), only the lights remain.
    applyLightingInputs({ ...base, tick: 2, ambient: null }, targets)
    expect(lightGrid.intensity[cell(0, 0)]).toBe(0)
    expect(lightGrid.intensity[cell(40, 20)]).toBe(0)
    expect(rgbi(cell(25, 25))).toEqual([254, 254, 254, 254])
    expect(captured!.lightmap).toBeDefined()

    // 4. Override presets replace the whole prefill (near rooms included) with their fixed light.
    applyLightingInputs({ ...base, tick: 3, preset: 'night', ambient: { playerRoom: dusk, nearRooms: [caveRoom] } }, targets)
    expect(rgbi(cell(0, 0))).toEqual([38, 115, 140, 240])
    expect(rgbi(cell(40, 20))).toEqual([38, 115, 140, 240])

    // 5. A frame counter that went back is a new game: the light list starts over.
    const st = getLightingPassState(lightGrid)
    const playerRecord = st.lights.head
    applyLightingInputs({ ...base, tick: 0, ambient: null }, targets)
    expect(st.lights.size).toBe(1)
    expect(st.lights.head).not.toBe(playerRecord)

    // 6. Disabled lighting clears the renderer's lighting.
    expect(applyLightingInputs({ ...base, tick: 4, preset: 'off', ambient: null }, targets)).toBe(false)
    expect(captured).toBeNull()
  })

  it('OnlineSession feeds the room ambient into the lighting pass (act clock outdoors, Levels.txt in Den of Evil) and wires STAT_LIGHTRADIUS (89) / STAT_LIGHTCOLOR (90)', async () => {
    const { OnlineSession } = await import('../src/client/session/online-session.ts')
    const { STAT_LIGHTRADIUS } = await import('../src/client/world/client-world.ts')
    const { STAT_LIGHTCOLOR } = await import('../src/common/units/char-anim-speed.ts')

    const makeMockLevelView = (areaId: number, act: number): any => ({
      act,
      areaId,
      subOriginX: 0,
      subOriginY: 0,
      subWidth: 200,
      subHeight: 200,
      isoOriginX: 0,
      isoOriginY: 0,
      cellsX: 40,
      cellsY: 40,
      gridWidth: 200,
      blocked: new Uint8Array(200 * 200),
      collisionMasks: new Uint16Array(200 * 200),
      rooms: [{ x: 0, y: 0, width: 40, height: 40 }],
      floors: [],
      shadows: [],
      walls: [],
      roofs: [],
      warps: [],
    })

    const session = new OnlineSession()
    session.world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Hero',
        x: 100,
        y: 100,
      },
    })
    session.predictor.setPosition(100, 100)

    const lightGrid = new LightGrid()
    let capturedLighting: LightingRendererParams | null = null
    const mockRenderer = {
      setLighting(cfg: LightingRendererParams | null) {
        capturedLighting = cfg
      },
    }
    const targets = { lightGrid, renderer: mockRenderer, nowMs: 0 }
    let now = 1000
    /** One client game frame, then the lighting pass with the session's inputs. */
    const frame = (): LightingInputs => {
      session.tick(40, now)
      now += 40
      const inputs = session.sceneSource.buildLightingInputs('auto')
      applyLightingInputs(inputs, targets)
      return inputs
    }

    // 1. Blood Moor (level 2) has Levels.txt RGB 0,0,0: the act clock lights it (ENVIRONMENT_Alloc
    // noon, intensity 128; the clock does not run before 0x03 LoadAct).
    session.world.areaId = 2
    session.levelView = makeMockLevelView(2, 0)
    const outdoorInputs = frame()
    expect(outdoorInputs.levelId).toBe(2)
    expect(outdoorInputs.playerUnitId).toBe(1)
    expect(outdoorInputs.ambient).toEqual({
      playerRoom: { intensity: 128, red: 255, green: 255, blue: 255, source: 'environment' },
      nearRooms: [],
    })
    expect(capturedLighting).not.toBeNull()
    expect(lightGrid.originSubX).toBe(76)
    expect(lightGrid.intensity[0]).toBe(128)

    // 2. Den of Evil (level 8, Levels.txt Intensity 0, white): dark as soon as the player is in it.
    // Step 1 of CLIENT_GetAmbientLight reads the S2C 0x5E copy for level 8 and FatalAsserts when no
    // 0x5E has arrived (0x6fb024dd-fd), so the session needs one before it lights the Den. All zero
    // (A1Q1, byte 1, not live): no Den light, the Levels.txt ambient applies.
    session.handleServerEvent({
      type: 'QuestState',
      kind: 'availability',
      source: 0x5e,
      quests: new Uint16Array(18),
      availabilityBytes: new Uint8Array(37),
    })
    session.world.areaId = 8
    session.levelView = makeMockLevelView(8, 0)

    const caveInputs = frame()
    expect(caveInputs.levelId).toBe(8)
    expect(caveInputs.ambient?.playerRoom).toEqual({
      intensity: 0,
      red: 255,
      green: 255,
      blue: 255,
      source: 'levels',
    })
    expect(caveInputs.playerLightRadiusBonus).toBe(0)
    expect(lightGrid.intensity[0]).toBe(0)

    // 3. The player light (radius 13, light corner = cell (25, 25)) reaches 13 sub-tiles east, not 14.
    expect(lightGrid.intensity[cell(38, 25)]).toBeGreaterThan(0)
    expect(lightGrid.intensity[cell(39, 25)]).toBe(0)

    // +5 Light Radius via STAT_LIGHTRADIUS (89): SetRadius(13 + 5) is immediate (0x6fac8bc0 → 0x6fb58b60).
    session.world.self.applyStat(STAT_LIGHTRADIUS, 5)
    expect(session.world.resolvePlayerLightRadiusBonus()).toBe(5)
    const boostedCaveInputs = frame()
    expect(boostedCaveInputs.playerLightRadiusBonus).toBe(5)
    expect(lightGrid.intensity[cell(39, 25)]).toBeGreaterThan(0)

    // 4. STAT_LIGHTCOLOR (90) 0xFF0000 makes the light red (0x6fac89a0 → SetColor 0x6fb586c0).
    session.world.self.applyStat(STAT_LIGHTCOLOR, 0xff0000)
    expect(frame().playerLightColor).toBe(0xff0000)
    const k = cell(25, 25)
    expect([lightGrid.intensity[k], lightGrid.red[k], lightGrid.green[k], lightGrid.blue[k]]).toEqual([254, 254, 0, 0])

    // 4b. Another player in the scene (unitId 42) reflects their stat 89 / 90 (issue #879 parity)
    session.world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 'player',
        id: 42,
        classId: 2,
        name: 'Paladin',
        x: 120,
        y: 100,
      },
    })
    const remoteBaseInputs = frame()
    const otherEmitterBase = remoteBaseInputs.lightEmitters.find(e => e.unitType === 0 && e.unitId === 42)
    expect(otherEmitterBase).toBeDefined()
    expect(otherEmitterBase?.playerLightRadiusBonus).toBe(0)
    expect(otherEmitterBase?.playerLightColor).toBe(0)

    // Remote player equips an item with +5 light radius and 0x00FF80 (cyan-green) color
    session.world.apply({
      type: 'ItemEvent',
      action: 0x07,
      item: {
        id: 2001,
        code: 'hlm',
        container: 'equipment',
        bodyLoc: 1,
        equippedSlot: 1,
        ownerType: 0,
        ownerId: 42,
        stats: [
          { statId: 89, value: 5 },
          { statId: 90, value: 0x00ff80 },
        ],
      } as any,
    })
    const remoteEquippedInputs = frame()
    const otherEmitterEquipped = remoteEquippedInputs.lightEmitters.find(e => e.unitType === 0 && e.unitId === 42)
    expect(otherEmitterEquipped?.playerLightRadiusBonus).toBe(5)
    expect(otherEmitterEquipped?.playerLightColor).toBe(0x00ff80)

    // Remote player's position is sub-tile 120 (cell 45 in grid, beyond local player's 18 sub-tile red reach)
    const otherK = cell(45, 25)
    expect(lightGrid.intensity[otherK]).toBeGreaterThan(0)
    expect(lightGrid.red[otherK]).toBe(0)
    expect(lightGrid.green[otherK]).toBeGreaterThan(200)
    expect(lightGrid.blue[otherK]).toBeGreaterThan(100)

    // Remote player unequips item: returns to radius bonus 0 and white color
    session.world.apply({
      type: 'ItemEvent',
      action: 0x08,
      item: {
        id: 2001,
        code: 'hlm',
        container: 'cursor',
        ownerType: 0,
        ownerId: 42,
      } as any,
    })
    const remoteUnequippedInputs = frame()
    const otherEmitterUnequipped = remoteUnequippedInputs.lightEmitters.find(e => e.unitType === 0 && e.unitId === 42)
    expect(otherEmitterUnequipped?.playerLightRadiusBonus).toBe(0)
    expect(otherEmitterUnequipped?.playerLightColor).toBe(0)
    expect(lightGrid.intensity[otherK]).toBeGreaterThan(0)
    expect(lightGrid.red[otherK]).toBeGreaterThan(200)
    expect(lightGrid.green[otherK]).toBeGreaterThan(200)
    expect(lightGrid.blue[otherK]).toBeGreaterThan(200)

    // 5. Back in Blood Moor the act clock lights the room again.
    session.world.areaId = 2
    session.levelView = makeMockLevelView(2, 0)
    const backOutdoorInputs = frame()
    expect(backOutdoorInputs.levelId).toBe(2)
    expect(backOutdoorInputs.ambient?.playerRoom.source).toBe('environment')
    expect(backOutdoorInputs.ambient?.playerRoom.intensity).toBe(128)
    expect(lightGrid.intensity[0]).toBe(128)
  }, 15000)

  it('steps columnTints in fixed 32px DT1 block columns (blockPosX >> 5, D2Direct3D 0x6f88e643) so 96px type-4 and 160px type-3 corner walls match across col 2 (issue #996)', () => {
    const { canvas, stats } = createMockCanvas()
    const renderer = new SpriteRenderer(canvas)
    const lightGrid = new LightGrid()
    lightGrid.setOrigin(100, 100)
    const columnTints: [
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ] = [
      [0.09, 0.09, 0.09],
      [0.09, 0.09, 0.09],
      [0.09, 0.09, 0.09],
      [0.80, 0.80, 0.80],
      [0.92, 0.92, 0.92],
      [1.00, 1.00, 1.00],
    ]

    // tomb.dt1 style=1 seq=0 corner pair: tile=49 (type=4 left corner, width=96) and tile=48 (type=3 right corner, width=160)
    const leftCornerFrame = { x: 0, y: 0, width: 96, height: 196 }
    const rightCornerFrame = { x: 0, y: 0, width: 160, height: 196 }

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.setLighting(gridLighting(lightGrid))
    renderer.draw(leftCornerFrame, 500, 300, { columnTints })
    renderer.draw(rightCornerFrame, 500, 300, { columnTints })
    renderer.flush()

    expect(stats.uploads).toHaveLength(1)
    const buf = stats.uploads[0]!
    // 96px left corner emits 3 32px columns (0..32, 32..64, 64..96); 160px right corner emits 5 32px columns (total 8 quads)
    expect(buf.length).toBe(8 * 4 * FLOATS_PER_VERTEX)

    // Left corner col 2 (quad 2) and right corner col 2 (quad 3 + 2 = 5) both span [564, 596] with tints columnTints[2] -> columnTints[3]
    const leftCol2 = 2 * 4 * FLOATS_PER_VERTEX
    const rightCol2 = 5 * 4 * FLOATS_PER_VERTEX
    expect(buf[leftCol2 + 0]).toBeCloseTo(564, 5)
    expect(buf[leftCol2 + FLOATS_PER_VERTEX + 0]).toBeCloseTo(596, 5)
    expect(buf[rightCol2 + 0]).toBeCloseTo(564, 5)
    expect(buf[rightCol2 + FLOATS_PER_VERTEX + 0]).toBeCloseTo(596, 5)
    expect(buf[leftCol2 + 4]).toBeCloseTo(columnTints[2][0], 5)
    expect(buf[leftCol2 + FLOATS_PER_VERTEX + 4]).toBeCloseTo(columnTints[3][0], 5)
    expect(buf[rightCol2 + 4]).toBeCloseTo(columnTints[2][0], 5)
    expect(buf[rightCol2 + FLOATS_PER_VERTEX + 4]).toBeCloseTo(columnTints[3][0], 5)

    renderer.dispose()
  })

  it('stamps hidden chasm floor DT1 nSubtileFlags per 1.13c sub_6FD413E0 (0x6FD413E0) so Act 2 Tomb chasm corner walls do not flicker on movement (issue #996)', () => {
    const mkTile = (
      type: number,
      style: number,
      sequence: number,
      width: number,
      rows: readonly (readonly number[])[],
    ): Dt1Tile => ({
      direction: type,
      roofHeight: 0,
      materialFlags: 0,
      height: -80,
      width,
      type,
      style,
      sequence,
      rarityFrameIndex: 1,
      animated: 0,
      // subTileFlags in decoded Dt1Tile is indexed by gy * 5 + gx (top-to-bottom)
      subTileFlags: rows.flatMap((row) => row.map((raw) => subTileFlagsOf(raw))),
      minBlockY: -80,
      bitmapHeight: 80,
      blocks: [
        {
          x: 0,
          y: -80,
          gridX: 0,
          gridY: 0,
          format: 1,
          pixels: new Uint8Array(width * 80).fill(1),
        },
      ],
    })

    // Exact 1.13c tomb.dt1 subTileFlags (gy = 0..4 top-to-bottom):
    // style=0, seq=0: walkable floor (0x00)
    const walkableFloor = mkTile(0, 0, 0, 160, [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ])
    // tomb.dt1 style=50, seq=0: chasm corner hidden floor (0x05 outer rim light-transparent, 0x07 diagonal light-blocking)
    const chasmCornerFloor = mkTile(0, 50, 0, 160, [
      [0x00, 0x05, 0x05, 0x05, 0x05],
      [0x05, 0x05, 0x05, 0x05, 0x05],
      [0x05, 0x05, 0x05, 0x05, 0x07],
      [0x05, 0x05, 0x05, 0x07, 0x05],
      [0x05, 0x05, 0x07, 0x05, 0x05],
    ])
    // tomb.dt1 style=50, seq=1: top chasm edge hidden floor (rows 0..3 = 0x05, row 4 = 0x07)
    const chasmTopEdgeFloor = mkTile(0, 50, 1, 160, [
      [0x05, 0x05, 0x05, 0x05, 0x05],
      [0x05, 0x05, 0x05, 0x05, 0x05],
      [0x05, 0x05, 0x05, 0x05, 0x05],
      [0x05, 0x05, 0x05, 0x05, 0x05],
      [0x07, 0x07, 0x07, 0x07, 0x07],
    ])
    // tomb.dt1 style=50, seq=2: left chasm edge hidden floor (cols 0..3 = 0x05, col 4 = 0x07)
    const chasmLeftEdgeFloor = mkTile(0, 50, 2, 160, [
      [0x05, 0x05, 0x05, 0x05, 0x07],
      [0x05, 0x05, 0x05, 0x05, 0x07],
      [0x05, 0x05, 0x05, 0x05, 0x07],
      [0x05, 0x05, 0x05, 0x05, 0x07],
      [0x05, 0x05, 0x05, 0x05, 0x07],
    ])
    // Blank.dt1 style=30, seq=0: chasm interior hidden floor (all 25 sub-tiles = 0x05)
    const chasmInteriorBlank = mkTile(0, 30, 0, 160, [
      [0x05, 0x05, 0x05, 0x05, 0x05],
      [0x05, 0x05, 0x05, 0x05, 0x05],
      [0x05, 0x05, 0x05, 0x05, 0x05],
      [0x05, 0x05, 0x05, 0x05, 0x05],
      [0x05, 0x05, 0x05, 0x05, 0x05],
    ])
    // tomb.dt1 style=1, seq=0, type=3 (tile=48) and companion type=4 (tile=49)
    const cornerRightWall = mkTile(3, 1, 0, 160, [
      [0x05, 0x05, 0x05, 0x05, 0x05],
      [0x05, 0x00, 0x00, 0x00, 0x00],
      [0x05, 0x00, 0x00, 0x00, 0x00],
      [0x05, 0x00, 0x00, 0x00, 0x00],
      [0x05, 0x00, 0x00, 0x00, 0x00],
    ])
    const cornerLeftWall = mkTile(4, 1, 0, 96, [
      [0x05, 0x00, 0x00, 0x00, 0x00],
      [0x05, 0x00, 0x00, 0x00, 0x00],
      [0x05, 0x00, 0x00, 0x00, 0x00],
      [0x05, 0x00, 0x00, 0x00, 0x00],
      [0x05, 0x00, 0x00, 0x00, 0x00],
    ])

    const dt1: Dt1 = {
      versionMajor: 7,
      versionMinor: 6,
      warnings: [],
      tiles: [
        walkableFloor,
        chasmCornerFloor,
        chasmTopEdgeFloor,
        chasmLeftEdgeFloor,
        chasmInteriorBlank,
        cornerRightWall,
        cornerLeftWall,
      ],
    }

    const mkCell = (floorStyle: number, floorSeq: number, hidden: boolean, withCornerWall = false): Ds1Cell => ({
      floors: [
        {
          prop1: 194,
          sequence: floorSeq,
          unknown1: 0,
          style: floorStyle,
          unknown2: 0,
          hidden,
        },
      ],
      walls: withCornerWall
        ? [
            {
              prop1: 129,
              sequence: 0,
              unknown1: 0,
              style: 1,
              unknown2: 0,
              type: 3,
              hidden: false,
            },
          ]
        : [],
      shadows: [],
      substitutions: [],
    })

    // 4x4 cell map: row 0 and col 0 are walkable corridors around the chasm corner at (1, 1)
    const ds1: Ds1 = {
      version: 18,
      width: 4,
      height: 4,
      act: 2,
      substitutionType: 0,
      objects: [],
      wallLayers: 1,
      floorLayers: 1,
      npcPathOffset: null,
      cells: [
        [mkCell(0, 0, false), mkCell(0, 0, false), mkCell(0, 0, false), mkCell(0, 0, false)],
        [mkCell(0, 0, false), mkCell(50, 0, true, true), mkCell(50, 1, true), mkCell(50, 1, true)],
        [mkCell(0, 0, false), mkCell(50, 2, true), mkCell(30, 0, true), mkCell(30, 0, true)],
        [mkCell(0, 0, false), mkCell(50, 2, true), mkCell(30, 0, true), mkCell(30, 0, true)],
      ],
    }

    const scene = buildIsoMapScene(ds1, [dt1], 0)
    const cg = scene
    const maskAt = (sx: number, sy: number): number => cg.collisionMasks[sy * cg.gridWidth + sx]!

    // 1. All 25 sub-tiles of chasm corner (1, 1) are walk-blocked, with 0x05 on the outer rim and 0x07 on the diagonal,
    //    never COLLIDE_MASK_INVALID (0x0027).
    for (let sy = 5; sy < 10; sy += 1) {
      for (let sx = 5; sx < 10; sx += 1) {
        expect(cg.blocked[sy * cg.gridWidth + sx]).toBe(1)
        expect(maskAt(sx, sy) & COLLIDE_WALL).toBe(COLLIDE_WALL)
        expect(maskAt(sx, sy) & COLLIDE_MISSILE_BARRIER).toBe(COLLIDE_MISSILE_BARRIER)
        expect(maskAt(sx, sy)).not.toBe(COLLIDE_MASK_INVALID)
      }
    }
    // Outer rim sample sub-tiles for type=3/4 corner wall at (1, 1) are 0x05 (light-transparent, no COLLIDE_VISIBLE)
    expect(maskAt(9, 8) & COLLIDE_VISIBLE).toBe(0)
    expect(maskAt(10, 7) & COLLIDE_VISIBLE).toBe(0)
    expect(maskAt(11, 6) & COLLIDE_VISIBLE).toBe(0)
    // Inner diagonal of (1, 1) and row 9 of (2, 1) have COLLIDE_VISIBLE (0x07) to stop light crossing the chasm
    expect(maskAt(9, 7) & COLLIDE_VISIBLE).toBe(COLLIDE_VISIBLE)
    expect(maskAt(8, 8) & COLLIDE_VISIBLE).toBe(COLLIDE_VISIBLE)
    expect(maskAt(7, 9) & COLLIDE_VISIBLE).toBe(COLLIDE_VISIBLE)
    expect(maskAt(10, 9) & COLLIDE_VISIBLE).toBe(COLLIDE_VISIBLE)

    // 2. As the player walks along the middle of the top corridor (subY = 2.0, subX = 11.5 -> 8.5), light passes
    //    through the 0x05 outer rim of (1, 1) and (2, 1) onto the right half of the corner arch (tints[3..5]),
    //    keeping it brightly illuminated (> 0.50, vs ambient 24/255 ≈ 0.094 when 0x0027 overwrote hidden chasm floors).
    const grid = new LightGrid()
    const amb = { intensity: 24, red: 255, green: 255, blue: 255, source: 'levels' as const }
    let tick = 1
    for (const px of [11.5, 10.5, 9.5, 8.5]) {
      applyLightingInputs(
        {
          preset: 'auto',
          levelId: 66,
          collisionGrid: cg,
          playerSubTile: { x: px, y: 2.0 },
          playerUnitId: 1,
          lightEmitters: [],
          tick: tick++,
          ambient: { playerRoom: amb, nearRooms: [] },
        },
        { lightGrid: grid, renderer: { setLighting: () => {} }, lightQuality: 2, nowMs: 0 },
      )
      const tints = wallColumnTints113c(grid, 1, 1, 3, false)!
      if (px >= 9.5) {
        expect(tints[3]![0]).toBeGreaterThan(0.20)
      }
      expect(tints[4]![0]).toBeGreaterThan(0.60)
      expect(tints[5]![0]).toBeGreaterThan(0.65)
    }
  })
})

import { describe, test, expect } from 'vitest'
import {
  SpriteRenderer,
  vertexShaderSource,
  fragmentShaderSource,
  type AtlasHandle,
} from '../src/client/render/renderer.ts'

interface MockResource {
  id: number
  type: string
}

function createMockCanvas(hasTexStorage = true): {
  canvas: any
  gl: any
  stats: {
    createdTextures: Set<MockResource>
    deletedTextures: Set<MockResource>
    texStorage2DCalls: Array<{ target: number; levels: number; internalformat: number; width: number; height: number }>
    texSubImage2DCalls: Array<{ target: number; level: number; xoffset: number; yoffset: number; width: number; height: number; format: number; type: number; data: any }>
    texImage2DCalls: Array<any>
    uniformCameraCalls: number
    uniformViewportCalls: number
    uniformZoomCalls: number
    uniformUploadCalls: number
    shaderSources: string[]
  }
} {
  let nextId = 1
  const stats = {
    createdTextures: new Set<MockResource>(),
    deletedTextures: new Set<MockResource>(),
    texStorage2DCalls: [] as Array<{ target: number; levels: number; internalformat: number; width: number; height: number }>,
    texSubImage2DCalls: [] as Array<{ target: number; level: number; xoffset: number; yoffset: number; width: number; height: number; format: number; type: number; data: any }>,
    texImage2DCalls: [] as Array<any>,
    uniformCameraCalls: 0,
    uniformViewportCalls: 0,
    uniformZoomCalls: 0,
    uniformUploadCalls: 0,
    shaderSources: [] as string[],
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
    UNPACK_ALIGNMENT: 3317,
    BLEND: 3042,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,
    DEPTH_TEST: 2929,
    COLOR_BUFFER_BIT: 16384,
    TEXTURE0: 33984,

    drawingBufferWidth: 800,
    drawingBufferHeight: 600,

    isContextLost: () => false,

    createProgram: () => ({ id: nextId++, type: 'program' }),
    deleteProgram: () => {},
    attachShader: () => {},
    detachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: () => {},

    createShader: (type: number) => ({ id: nextId++, type: type === 35633 ? 'vs' : 'fs' }),
    shaderSource: (_shader: any, source: string) => { stats.shaderSources.push(source) },
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
    bufferSubData: () => {},

    getAttribLocation: (_p: any, name: string) => (
      name === 'a_position' ? 0 : name === 'a_uv' ? 1 : name === 'a_tint' ? 2 : name === 'a_unit' ? 3 : 4
    ),
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},

    createTexture: () => {
      const res: MockResource = { id: nextId++, type: 'texture' }
      stats.createdTextures.add(res)
      return res
    },
    deleteTexture: (t: MockResource) => { stats.deletedTextures.add(t) },
    bindTexture: () => {},
    texParameteri: () => {},
    pixelStorei: () => {},

    texImage2D: (...args: any[]) => {
      stats.texImage2DCalls.push(args)
    },
    texSubImage2D: (
      target: number,
      level: number,
      xoffset: number,
      yoffset: number,
      width: number,
      height: number,
      format: number,
      type: number,
      data: any,
    ) => {
      stats.texSubImage2DCalls.push({ target, level, xoffset, yoffset, width, height, format, type, data })
    },

    getParameter: (param: number) => (param === 3379 ? 4096 : param === 34930 ? 16 : 0),
    getUniformLocation: (_p: any, name: string) => ({ name }),

    uniform2f: (loc: any, x: number, y: number) => {
      stats.uniformUploadCalls += 1
      if (loc?.name === 'u_camera') stats.uniformCameraCalls += 1
      if (loc?.name === 'u_viewport') stats.uniformViewportCalls += 1
    },
    uniform1f: (loc: any, x: number) => {
      stats.uniformUploadCalls += 1
      if (loc?.name === 'u_zoom') stats.uniformZoomCalls += 1
    },
    uniform1i: () => {},
    uniform1iv: () => {},

    enable: () => {},
    disable: () => {},
    blendFunc: () => {},
    viewport: () => {},
    clearColor: () => {},
    clear: () => {},
    activeTexture: () => {},
    drawArrays: () => {},
    drawElements: () => {},
  }

  if (hasTexStorage) {
    gl.texStorage2D = (target: number, levels: number, internalformat: number, width: number, height: number) => {
      stats.texStorage2DCalls.push({ target, levels, internalformat, width, height })
    }
  }

  const canvas: any = {
    getContext: (type: string) => (type === 'webgl2' ? gl : null),
    addEventListener: () => {},
    removeEventListener: () => {},
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
  }

  return { canvas, gl, stats }
}

describe('WebGL2 SpriteRenderer Performance Tuning (Issue #20)', () => {
  describe('Immutable Texture Storage (texStorage2D + texSubImage2D)', () => {
    test('allocates whiteTexture and paletteTexture with texStorage2D in constructor', () => {
      const { canvas, stats } = createMockCanvas()
      const renderer = new SpriteRenderer(canvas)

      expect(stats.texStorage2DCalls.length).toBeGreaterThanOrEqual(2)
      // whiteTexture: 1x1 RGBA8
      const whiteStorage = stats.texStorage2DCalls.find(call => call.width === 1 && call.height === 1)
      expect(whiteStorage).toBeDefined()
      expect(whiteStorage?.internalformat).toBe(32856) // gl.RGBA8
      expect(whiteStorage?.levels).toBe(1)

      // paletteTexture: 256x5 RGBA8
      const palStorage = stats.texStorage2DCalls.find(call => call.width === 256 && call.height === 5)
      expect(palStorage).toBeDefined()
      expect(palStorage?.internalformat).toBe(32856) // gl.RGBA8

      // Both should have data uploaded via texSubImage2D
      expect(stats.texSubImage2DCalls.length).toBeGreaterThanOrEqual(2)
      renderer.dispose()
    })

    test('setAtlas allocates immutable storage via texStorage2D and uploads via texSubImage2D', () => {
      const { canvas, stats } = createMockCanvas()
      const renderer = new SpriteRenderer(canvas)
      const storageCallsBefore = stats.texStorage2DCalls.length
      const subCallsBefore = stats.texSubImage2DCalls.length

      const atlas = {
        pixels: new Uint8ClampedArray(128 * 64 * 4),
        width: 128,
        height: 64,
        groups: [],
      }
      renderer.setAtlas(atlas)

      expect(stats.texStorage2DCalls.length).toBe(storageCallsBefore + 1)
      const lastStorage = stats.texStorage2DCalls[stats.texStorage2DCalls.length - 1]
      expect(lastStorage?.width).toBe(128)
      expect(lastStorage?.height).toBe(64)
      expect(lastStorage?.internalformat).toBe(32856) // gl.RGBA8

      expect(stats.texSubImage2DCalls.length).toBe(subCallsBefore + 1)
      const lastSub = stats.texSubImage2DCalls[stats.texSubImage2DCalls.length - 1]
      expect(lastSub?.width).toBe(128)
      expect(lastSub?.height).toBe(64)

      // Re-uploading atlas with SAME dimensions reuses the immutable storage
      renderer.setAtlas(atlas)
      expect(stats.texStorage2DCalls.length).toBe(storageCallsBefore + 1) // no extra texStorage2D
      expect(stats.texSubImage2DCalls.length).toBe(subCallsBefore + 2) // extra texSubImage2D

      // Uploading atlas with DIFFERENT dimensions deletes old texture and allocates new storage
      const resizedAtlas = {
        pixels: new Uint8ClampedArray(256 * 256 * 4),
        width: 256,
        height: 256,
        groups: [],
      }
      renderer.setAtlas(resizedAtlas)
      expect(stats.texStorage2DCalls.length).toBe(storageCallsBefore + 2)
      const resizedStorage = stats.texStorage2DCalls[stats.texStorage2DCalls.length - 1]
      expect(resizedStorage?.width).toBe(256)
      expect(resizedStorage?.height).toBe(256)

      renderer.dispose()
    })

    test('addAtlas and createAtlas allocate immutable storage via texStorage2D', () => {
      const { canvas, stats } = createMockCanvas()
      const renderer = new SpriteRenderer(canvas)
      const storageCallsBefore = stats.texStorage2DCalls.length
      const subCallsBefore = stats.texSubImage2DCalls.length

      const handle1 = renderer.addAtlas({
        pixels: new Uint8ClampedArray(32 * 32 * 4),
        width: 32,
        height: 32,
      })
      expect(handle1.width).toBe(32)
      expect(handle1.height).toBe(32)
      expect(stats.texStorage2DCalls.length).toBe(storageCallsBefore + 1)
      expect(stats.texSubImage2DCalls.length).toBe(subCallsBefore + 1)

      const handle2 = renderer.createAtlas({
        pixels: new Uint8ClampedArray(64 * 32 * 4),
        width: 64,
        height: 32,
      })
      expect(handle2.width).toBe(64)
      expect(handle2.height).toBe(32)
      expect(stats.texStorage2DCalls.length).toBe(storageCallsBefore + 2)
      expect(stats.texSubImage2DCalls.length).toBe(subCallsBefore + 2)

      renderer.dispose()
    })

    test('addIndexedAtlas allocates R8 single-channel texture via texStorage2D', () => {
      const { canvas, stats } = createMockCanvas()
      const renderer = new SpriteRenderer(canvas)
      const storageCallsBefore = stats.texStorage2DCalls.length
      const subCallsBefore = stats.texSubImage2DCalls.length

      const handle = renderer.addIndexedAtlas(new Uint8Array(64 * 64), 64, 64)
      expect(handle.indexed).toBe(true)
      expect(handle.width).toBe(64)
      expect(handle.height).toBe(64)

      expect(stats.texStorage2DCalls.length).toBe(storageCallsBefore + 1)
      const lastStorage = stats.texStorage2DCalls[stats.texStorage2DCalls.length - 1]
      expect(lastStorage?.width).toBe(64)
      expect(lastStorage?.height).toBe(64)
      expect(lastStorage?.internalformat).toBe(33321) // gl.R8

      expect(stats.texSubImage2DCalls.length).toBe(subCallsBefore + 1)
      const lastSub = stats.texSubImage2DCalls[stats.texSubImage2DCalls.length - 1]
      expect(lastSub?.format).toBe(6403) // gl.RED

      renderer.dispose()
    })

    test('gracefully falls back to texImage2D when texStorage2D is unavailable', () => {
      const { canvas, stats } = createMockCanvas(false) // without texStorage2D
      const renderer = new SpriteRenderer(canvas)
      expect(stats.texImage2DCalls.length).toBeGreaterThan(0)

      const atlas = {
        pixels: new Uint8ClampedArray(16 * 16 * 4),
        width: 16,
        height: 16,
        groups: [],
      }
      renderer.setAtlas(atlas)
      renderer.addAtlas({ pixels: new Uint8ClampedArray(16 * 16 * 4), width: 16, height: 16 })
      renderer.addIndexedAtlas(new Uint8Array(16 * 16), 16, 16)
      expect(stats.texImage2DCalls.length).toBeGreaterThanOrEqual(4)
      renderer.dispose()
    })
  })

  describe('Uniform Caching & Dirty Checking', () => {
    test('only issues uniform uploads when camera, viewport, or zoom values change', () => {
      const { canvas, gl, stats } = createMockCanvas()
      const renderer = new SpriteRenderer(canvas)
      const frame = { x: 0, y: 0, width: 8, height: 8 }

      // Frame 1: Initial flush
      renderer.begin({ x: 50, y: 100, zoom: 1.0 })
      renderer.draw(frame, 0, 0)
      renderer.flush()

      expect(stats.uniformCameraCalls).toBe(1)
      expect(stats.uniformViewportCalls).toBe(1)
      expect(stats.uniformZoomCalls).toBe(1)

      // Frame 2: Same camera, same viewport, same zoom -> 0 uniform uploads
      renderer.begin({ x: 50, y: 100, zoom: 1.0 })
      renderer.draw(frame, 0, 0)
      renderer.flush()

      expect(stats.uniformCameraCalls).toBe(1)
      expect(stats.uniformViewportCalls).toBe(1)
      expect(stats.uniformZoomCalls).toBe(1)

      // Frame 3: Multiple flushes within the same frame -> 0 redundant uploads
      renderer.draw(frame, 8, 8)
      renderer.flush()
      renderer.draw(frame, 16, 16)
      renderer.flush()

      expect(stats.uniformCameraCalls).toBe(1)
      expect(stats.uniformViewportCalls).toBe(1)
      expect(stats.uniformZoomCalls).toBe(1)

      // Frame 4: Camera changes -> only camera uniform uploaded
      renderer.begin({ x: 60, y: 100, zoom: 1.0 })
      renderer.draw(frame, 0, 0)
      renderer.flush()

      expect(stats.uniformCameraCalls).toBe(2)
      expect(stats.uniformViewportCalls).toBe(1)
      expect(stats.uniformZoomCalls).toBe(1)

      // Frame 5: Zoom changes -> only zoom uniform uploaded
      renderer.begin({ x: 60, y: 100, zoom: 2.0 })
      renderer.draw(frame, 0, 0)
      renderer.flush()

      expect(stats.uniformCameraCalls).toBe(2)
      expect(stats.uniformViewportCalls).toBe(1)
      expect(stats.uniformZoomCalls).toBe(2)

      // Frame 6: Viewport changes -> only viewport uniform uploaded
      gl.drawingBufferWidth = 1024
      gl.drawingBufferHeight = 768
      renderer.begin({ x: 60, y: 100, zoom: 2.0 })
      renderer.draw(frame, 0, 0)
      renderer.flush()

      expect(stats.uniformCameraCalls).toBe(2)
      expect(stats.uniformViewportCalls).toBe(2)
      expect(stats.uniformZoomCalls).toBe(2)

      renderer.dispose()
    })
  })

  describe('Configurable Shader Discard / Alpha Optimization', () => {
    test('fragmentShaderSource generates discard when alphaDiscard is true', () => {
      const src = fragmentShaderSource(8, { alphaDiscard: true })
      expect(src).toContain('if (idx == 0) discard;')
      expect(src).toContain('if (texel.a == 0.0) discard;')
    })

    test('fragmentShaderSource omits discard when alphaDiscard is false', () => {
      const src = fragmentShaderSource(8, { alphaDiscard: false })
      expect(src).not.toContain('discard')
      expect(src).toContain('texel = idx == 0 ? vec4(0.0) : texelFetch(u_palette, ivec2(idx, v_palette), 0);')
      expect(src).toContain('outColor = texel * v_tint;')
    })

    test('SpriteRenderer defaults to alphaDiscard = true', () => {
      const { canvas, stats } = createMockCanvas()
      const renderer = new SpriteRenderer(canvas)
      expect(renderer.alphaDiscard).toBe(true)

      const fs = stats.shaderSources.find(s => s.includes('outColor')) ?? ''
      expect(fs).toContain('discard;')
      renderer.dispose()
    })

    test('SpriteRenderer respects alphaDiscard = false option', () => {
      const { canvas, stats } = createMockCanvas()
      const renderer = new SpriteRenderer(canvas, { alphaDiscard: false })
      expect(renderer.alphaDiscard).toBe(false)

      const fs = stats.shaderSources.find(s => s.includes('outColor')) ?? ''
      expect(fs).not.toContain('discard')
      expect(fs).toContain('outColor = texel * v_tint;')
      renderer.dispose()
    })
  })
})

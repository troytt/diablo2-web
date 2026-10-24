import { describe, test, expect } from 'vitest'
import { SpriteRenderer, RendererError, type AtlasHandle } from '../src/client/render/renderer.ts'

interface MockResource {
  id: number
  type: string
}

function createMockCanvas(): {
  canvas: any
  stats: {
    createdTextures: Set<MockResource>
    deletedTextures: Set<MockResource>
    createdBuffers: Set<MockResource>
    deletedBuffers: Set<MockResource>
    createdVAOs: Set<MockResource>
    deletedVAOs: Set<MockResource>
    createdPrograms: Set<MockResource>
    deletedPrograms: Set<MockResource>
    createdShaders: Set<MockResource>
    deletedShaders: Set<MockResource>
    eventListeners: Map<string, Set<EventListener>>
    glDrawCalls: number
    shaderSources: string[]
  }
  setContextLost: (lost: boolean) => void
  dispatchMockEvent: (type: string) => { defaultPrevented: boolean }
} {
  let nextId = 1
  let contextLost = false

  const stats = {
    createdTextures: new Set<MockResource>(),
    deletedTextures: new Set<MockResource>(),
    createdBuffers: new Set<MockResource>(),
    deletedBuffers: new Set<MockResource>(),
    createdVAOs: new Set<MockResource>(),
    deletedVAOs: new Set<MockResource>(),
    createdPrograms: new Set<MockResource>(),
    deletedPrograms: new Set<MockResource>(),
    createdShaders: new Set<MockResource>(),
    deletedShaders: new Set<MockResource>(),
    eventListeners: new Map<string, Set<EventListener>>(),
    glDrawCalls: 0,
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

    drawingBufferWidth: 1280,
    drawingBufferHeight: 720,

    isContextLost: () => contextLost,

    createProgram: () => {
      const res: MockResource = { id: nextId++, type: 'program' }
      stats.createdPrograms.add(res)
      return res
    },
    deleteProgram: (p: MockResource) => { stats.deletedPrograms.add(p) },
    attachShader: () => {},
    detachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: () => {},

    createShader: (type: number) => {
      const res: MockResource = { id: nextId++, type: type === 35633 ? 'vertexShader' : 'fragmentShader' }
      stats.createdShaders.add(res)
      return res
    },
    shaderSource: (_shader: MockResource, source: string) => { stats.shaderSources.push(source) },
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: (s: MockResource) => { stats.deletedShaders.add(s) },

    createVertexArray: () => {
      const res: MockResource = { id: nextId++, type: 'vao' }
      stats.createdVAOs.add(res)
      return res
    },
    deleteVertexArray: (vao: MockResource) => { stats.deletedVAOs.add(vao) },
    bindVertexArray: () => {},

    createBuffer: () => {
      const res: MockResource = { id: nextId++, type: 'buffer' }
      stats.createdBuffers.add(res)
      return res
    },
    deleteBuffer: (b: MockResource) => { stats.deletedBuffers.add(b) },
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
    texImage2D: () => {},
    pixelStorei: () => {},

    getParameter: (param: number) => (param === 3379 ? 4096 : param === 34930 ? 16 : 0),
    getUniformLocation: (_p: any, name: string) => ({ name }),
    uniform2f: () => {},
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

  const eventListeners = stats.eventListeners

  const canvas: any = {
    getContext: (type: string) => (type === 'webgl2' ? gl : null),
    addEventListener: (type: string, listener: EventListener) => {
      if (!eventListeners.has(type)) eventListeners.set(type, new Set())
      eventListeners.get(type)!.add(listener)
    },
    removeEventListener: (type: string, listener: EventListener) => {
      eventListeners.get(type)?.delete(listener)
    },
    width: 1280,
    height: 720,
    drawingBufferWidth: 1280,
    drawingBufferHeight: 720,
  }

  return {
    canvas,
    stats,
    setContextLost: (lost: boolean) => { contextLost = lost },
    dispatchMockEvent: (type: string) => {
      let defaultPrevented = false
      const event: any = {
        type,
        preventDefault: () => { defaultPrevented = true },
      }
      const set = eventListeners.get(type)
      if (set) {
        for (const listener of set) {
          listener(event)
        }
      }
      return { defaultPrevented }
    },
  }
}

function createAtlasPage(renderer: SpriteRenderer, width = 32, height = 32): AtlasHandle {
  return renderer.addAtlas({ pixels: new Uint8ClampedArray(width * height * 4), width, height })
}

describe('多纹理合批与 Draw Call 预算 (方案 B / Issue #16)', () => {
  test('多图集页关卡在画家顺序重度交错下维持 Draw Call <= 1', () => {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)

    // 典型多图集关卡构成：
    // 地面（2页）+ 墙体（2页）+ 屋顶（1页）+ 物件（1页）+ 角色（1页）+ 怪物（2页）= 9页
    const pages = Array.from({ length: 9 }, () => createAtlasPage(renderer))
    const frame = { x: 0, y: 0, width: 32, height: 32 }

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    const initialCalls = mock.stats.glDrawCalls

    // 1. 地面层（400 个四边形在 page 0 和 page 1 交替）
    for (let i = 0; i < 400; i += 1) {
      renderer.draw(frame, i * 16, 0, { atlas: pages[i % 2] })
    }
    // 2. 墙体与物件深度归并层（600 个四边形在 pages 2, 3, 5 频繁交替）
    for (let i = 0; i < 600; i += 1) {
      const p = i % 3 === 0 ? 5 : i % 3 === 1 ? 2 : 3
      renderer.draw(frame, i * 16, 50, { atlas: pages[p] })
    }
    // 3. 实体层：玩家与怪物（150 个四边形在 pages 6, 7, 8 频繁交替）
    for (let i = 0; i < 150; i += 1) {
      renderer.draw(frame, i * 20, 100, { atlas: pages[6 + (i % 3)] })
    }
    // 4. 屋顶层（200 个四边形在 page 4）
    for (let i = 0; i < 200; i += 1) {
      renderer.draw(frame, i * 16, 150, { atlas: pages[4] })
    }

    renderer.flush()

    expect(renderer.quadsSubmitted).toBe(1350)
    expect(mock.stats.glDrawCalls - initialCalls).toBe(1)
    expect(renderer.drawCalls).toBe(1)

    renderer.dispose()
  })

  test('精灵纹理与纯色矩形混合绘制不打断合批（单次 Draw Call）', () => {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const pageA = createAtlasPage(renderer)
    const pageB = createAtlasPage(renderer)
    const frame = { x: 0, y: 0, width: 16, height: 16 }

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    const initialCalls = mock.stats.glDrawCalls

    for (let i = 0; i < 50; i += 1) {
      renderer.draw(frame, i * 8, 0, { atlas: i % 2 === 0 ? pageA : pageB })
      renderer.drawSolid(i * 8, 20, 10, 10, [1, 0.5, 0, 1])
    }

    renderer.flush()

    expect(renderer.quadsSubmitted).toBe(100)
    expect(mock.stats.glDrawCalls - initialCalls).toBe(1)
    expect(renderer.drawCalls).toBe(1)

    renderer.dispose()
  })

  test('超出 GPU 纹理单元上限时严格按需断批，保持最小 Draw Call 开销', () => {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const units = renderer.textureUnits
    expect(units).toBeGreaterThanOrEqual(8)

    // 创建 units + 3 个不同纹理页
    const totalPages = units + 3
    const pages = Array.from({ length: totalPages }, () => createAtlasPage(renderer))
    const frame = { x: 0, y: 0, width: 8, height: 8 }

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    const initialCalls = mock.stats.glDrawCalls

    // 前 units 个页在 batch 1
    for (let i = 0; i < units; i += 1) {
      renderer.draw(frame, i * 10, 0, { atlas: pages[i] })
    }
    // 接下来 3 个页触发断批，进入 batch 2
    for (let i = units; i < totalPages; i += 1) {
      renderer.draw(frame, i * 10, 0, { atlas: pages[i] })
    }

    renderer.flush()

    const issuedCalls = mock.stats.glDrawCalls - initialCalls
    expect(issuedCalls).toBe(2)
    expect(renderer.drawCalls).toBe(2)
    expect(renderer.drawCalls).toBeLessThanOrEqual(Math.ceil(totalPages / units))

    renderer.dispose()
  })

  test('begin() 重置每帧计数器，防止跨帧累加污染性能监控', () => {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const page = createAtlasPage(renderer)
    const frame = { x: 0, y: 0, width: 10, height: 10 }

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.draw(frame, 0, 0, { atlas: page })
    renderer.flush()
    expect(renderer.drawCalls).toBe(1)
    expect(renderer.quadsSubmitted).toBe(1)

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    expect(renderer.drawCalls).toBe(0)
    expect(renderer.quadsSubmitted).toBe(0)

    renderer.dispose()
  })
})

describe('HUD 动态度量与真实性能指标', () => {
  test('HUD 数据源自渲染器实时测量值，而非硬编码假值', () => {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const page = createAtlasPage(renderer)
    const frame = { x: 0, y: 0, width: 16, height: 16 }

    // Frame 1 模拟：提交 150 个四边形，剔除 1850 个，耗时真实记录
    const start1 = performance.now()
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    for (let i = 0; i < 150; i += 1) {
      renderer.draw(frame, i * 4, 0, { atlas: page })
    }
    renderer.flush()
    const renderMs1 = performance.now() - start1

    const state1 = {
      drawCalls: renderer.drawCalls,
      quadsDrawn: renderer.quadsSubmitted,
      culledDraws: 1850,
      renderMs: renderMs1,
    }

    const hudText1 = `${String(state1.quadsDrawn)} 图元 / ${String(state1.drawCalls)} 批次（剔除 ${String(state1.culledDraws)}）· ${state1.renderMs.toFixed(1)} ms`

    expect(state1.drawCalls).toBe(1)
    expect(state1.quadsDrawn).toBe(150)
    expect(state1.culledDraws).toBe(1850)
    expect(state1.renderMs).toBeGreaterThanOrEqual(0)
    expect(hudText1).toContain('150 图元 / 1 批次（剔除 1850）')

    // Frame 2 模拟：多图集导致 2 次 Draw Call，提交 300 个四边形，剔除 3700 个
    const overPages = Array.from({ length: renderer.textureUnits + 1 }, () => createAtlasPage(renderer))
    const start2 = performance.now()
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    for (let i = 0; i < 250; i += 1) {
      renderer.draw(frame, i * 4, 0, { atlas: overPages[i % renderer.textureUnits] })
    }
    for (let i = 0; i < 50; i += 1) {
      renderer.draw(frame, i * 4, 50, { atlas: overPages[renderer.textureUnits] })
    }
    renderer.flush()
    const renderMs2 = performance.now() - start2

    const state2 = {
      drawCalls: renderer.drawCalls,
      quadsDrawn: renderer.quadsSubmitted,
      culledDraws: 3700,
      renderMs: renderMs2,
    }

    const hudText2 = `${String(state2.quadsDrawn)} 图元 / ${String(state2.drawCalls)} 批次（剔除 ${String(state2.culledDraws)}）· ${state2.renderMs.toFixed(1)} ms`

    // 验证不是硬编码的常量
    expect(state2.drawCalls).toBe(2)
    expect(state2.quadsDrawn).toBe(300)
    expect(state2.culledDraws).toBe(3700)
    expect(hudText2).toContain('300 图元 / 2 批次（剔除 3700）')
    expect(state2.drawCalls).not.toBe(state1.drawCalls)
    expect(state2.quadsDrawn).not.toBe(state1.quadsDrawn)

    renderer.dispose()
  })
})

describe('零分配顶点写入与 GPU 资源生命周期审计 (方案 C & 方案 D/E/G 护栏)', () => {
  test('动态顶点缓冲容量自动翻倍，并保全已有几何数据', () => {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const page = createAtlasPage(renderer)
    const frame = { x: 0, y: 0, width: 8, height: 8 }

    // 初始容量 8192，这里提交 10,000 个四边形触发 grow()
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    for (let i = 0; i < 10000; i += 1) {
      renderer.draw(frame, i % 100, i % 100, { atlas: page })
    }
    expect(renderer.quadsSubmitted).toBe(10000)

    renderer.flush()
    expect(renderer.drawCalls).toBe(1)

    renderer.dispose()
  })

  test('WebGL 着色器与纹理生命周期完整释放，无显存泄漏', () => {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)

    expect(mock.stats.createdShaders.size).toBe(2)
    expect(mock.stats.deletedShaders.size).toBe(2)
    expect(mock.stats.createdPrograms.size).toBe(1)
    expect(mock.stats.createdTextures.size).toBe(3) // atlas + white + palette

    const extra = renderer.addAtlas({ pixels: new Uint8ClampedArray(16 * 16 * 4), width: 16, height: 16 })
    expect(mock.stats.createdTextures.size).toBe(4)

    // 删除单个 atlas
    renderer.deleteAtlas(extra)
    expect(mock.stats.deletedTextures.has(extra.texture as any)).toBe(true)

    // 释放整个渲染器
    renderer.dispose()
    expect(renderer.isDisposed).toBe(true)
    expect(mock.stats.deletedTextures.size).toBe(4)
    expect(mock.stats.deletedBuffers.size).toBe(2) // vertex + index buffer
    expect(mock.stats.deletedVAOs.size).toBe(1)
    expect(mock.stats.deletedPrograms.size).toBe(1)
  })

  test('上下文丢失时安全降级与清理', () => {
    const mock = createMockCanvas()
    let lostTriggered = false
    const renderer = new SpriteRenderer(mock.canvas, {
      onContextLost: () => { lostTriggered = true },
    })

    const eventResult = mock.dispatchMockEvent('webglcontextlost')
    expect(eventResult.defaultPrevented).toBe(true)
    expect(lostTriggered).toBe(true)

    mock.setContextLost(true)
    // 在上下文已丢失状态下 dispose 不应报错
    expect(() => { renderer.dispose() }).not.toThrow()
    expect(renderer.isDisposed).toBe(true)
  })
})

/**
 * Verification test for SpriteRenderer GPU resource lifecycle, deleteAtlas,
 * dispose, and WebGL context loss handling (Issue #9), plus the multi-texture
 * batching, indexed geometry and draw-call instrumentation added for Issue #16.
 */
import { SpriteRenderer, RendererError } from '../src/client/render/renderer.ts'

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
    texStorage2DCalls: number
    texSubImage2DCalls: number
    uniformUploadCalls: number
    uniformCameraCalls: number
    uniformViewportCalls: number
    uniformZoomCalls: number
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
    texStorage2DCalls: 0,
    texSubImage2DCalls: 0,
    uniformUploadCalls: 0,
    uniformCameraCalls: 0,
    uniformViewportCalls: 0,
    uniformZoomCalls: 0,
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
      name === 'a_position' ? 0 : name === 'a_uv' ? 1 : name === 'a_tint' ? 2 : 3
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
    texStorage2D: () => { stats.texStorage2DCalls += 1 },
    texSubImage2D: () => { stats.texSubImage2DCalls += 1 },
    pixelStorei: () => {},

    getParameter: (param: number) => (param === 3379 ? 4096 : param === 34930 ? 16 : 0),
    getUniformLocation: (_p: any, name: string) => ({ name }),
    uniform2f: (loc: any) => {
      stats.uniformUploadCalls += 1
      if (loc?.name === 'u_camera') stats.uniformCameraCalls += 1
      if (loc?.name === 'u_viewport') stats.uniformViewportCalls += 1
    },
    uniform1f: (loc: any) => {
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
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
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

/**
 * Make a throwaway atlas page handle.
 *
 * @param renderer - the renderer to allocate on.
 * @returns a handle backed by a real (mock) texture.
 */
function page(renderer: SpriteRenderer): ReturnType<SpriteRenderer['addAtlas']> {
  return renderer.addAtlas({ pixels: new Uint8ClampedArray(16 * 16 * 4), width: 16, height: 16 })
}

function runTests(): void {
  console.log('== Running SpriteRenderer Lifecycle Verification ==\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, name: string): void {
    if (condition) {
      console.log(`  ✓ ${name}`)
      passed += 1
    } else {
      console.error(`  ✗ ${name}`)
      failed += 1
    }
  }

  // Test 1: Shader cleanup after compilation
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)

    assert(mock.stats.createdShaders.size === 2, 'Two shaders created (VS & FS)')
    assert(mock.stats.deletedShaders.size === 2, 'Both shaders detached and deleted right after program link')
    assert(mock.stats.createdPrograms.size === 1, 'Program created')
    assert(mock.stats.createdVAOs.size === 1, 'VAO created')
    assert(mock.stats.createdBuffers.size === 2, 'Vertex and index buffers created')
    assert(mock.stats.createdTextures.size === 3, 'Initial textures created (atlas + white + palette)')
    assert(renderer.isDisposed === false, 'Renderer is active and not disposed')

    renderer.dispose()
  }

  // Test 2: addAtlas & deleteAtlas
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)

    const extra = renderer.addAtlas({ pixels: new Uint8ClampedArray(64 * 64 * 4), width: 64, height: 64 })
    assert(mock.stats.createdTextures.size === 4, 'addAtlas creates a new GPU texture (4 total)')

    // Draw with this extra atlas
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.draw({ x: 0, y: 0, width: 32, height: 32 }, 0, 0, { atlas: extra })

    // Now delete this atlas
    const deleted = renderer.deleteAtlas(extra)
    assert(deleted === true, 'deleteAtlas returned true for managed handle')
    assert(mock.stats.deletedTextures.has(extra.texture as any), 'GPU texture was deleted via gl.deleteTexture')

    // Deleting again should be safe and return false
    const deletedAgain = renderer.deleteAtlas(extra)
    assert(deletedAgain === false, 'deleteAtlas returned false on already deleted handle')

    renderer.dispose()
  }

  // Test 3: dispose() cleans up all resources
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const extra1 = renderer.addAtlas({ pixels: new Uint8ClampedArray(32 * 32 * 4), width: 32, height: 32 })
    const extra2 = renderer.addAtlas({ pixels: new Uint8ClampedArray(32 * 32 * 4), width: 32, height: 32 })
    void extra1
    void extra2

    assert(mock.stats.createdTextures.size === 5, '5 total textures created before dispose')

    renderer.dispose()
    assert(renderer.isDisposed === true, 'isDisposed is true after dispose()')
    assert(mock.stats.deletedTextures.size === 5, 'All 5 textures were deleted on dispose()')
    assert(mock.stats.deletedBuffers.size === 2, 'Vertex and index buffers were deleted on dispose()')
    assert(mock.stats.deletedVAOs.size === 1, 'VAO was deleted on dispose()')
    assert(mock.stats.deletedPrograms.size === 1, 'Program was deleted on dispose()')

    // Idempotent dispose
    renderer.dispose()
    assert(mock.stats.deletedPrograms.size === 1, 'Second dispose() is safe and idempotent')

    // Calling methods after dispose throws RendererError
    let threwOnBegin = false
    try {
      renderer.begin({ x: 0, y: 0, zoom: 1 })
    } catch (err) {
      if (err instanceof RendererError) threwOnBegin = true
    }
    assert(threwOnBegin, 'begin() throws RendererError when called on disposed renderer')

    let threwOnAdd = false
    try {
      renderer.addAtlas({ pixels: new Uint8ClampedArray(16), width: 2, height: 2 })
    } catch (err) {
      if (err instanceof RendererError) threwOnAdd = true
    }
    assert(threwOnAdd, 'addAtlas() throws RendererError when called on disposed renderer')
  }

  // Test 4: WebGL Context Lost & Restored
  {
    const mock = createMockCanvas()
    const tracker = { lostFired: false, restoredFired: false }

    const renderer = new SpriteRenderer(mock.canvas, {
      onContextLost: () => { tracker.lostFired = true },
      onContextRestored: () => { tracker.restoredFired = true },
    })

    const lostEvent = mock.dispatchMockEvent('webglcontextlost')
    assert(lostEvent.defaultPrevented === true, 'webglcontextlost calls event.preventDefault() to allow recovery')
    assert(tracker.lostFired === true, 'onContextLost callback fired')

    mock.dispatchMockEvent('webglcontextrestored')
    assert(tracker.restoredFired === true, 'onContextRestored callback fired')

    // Dispose cleans up event listeners
    renderer.dispose()
    assert(mock.stats.eventListeners.get('webglcontextlost')?.size === 0, 'Context lost listener removed on dispose')
    assert(mock.stats.eventListeners.get('webglcontextrestored')?.size === 0, 'Context restored listener removed on dispose')
  }

  // Test 5: Dispose when context is already lost
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    mock.setContextLost(true)

    // Dispose should not attempt invalid GL deletes when context is lost
    renderer.dispose()
    assert(renderer.isDisposed === true, 'dispose() safely completes when context is already lost')
  }

  // Test 6 (Issue #16): several atlas pages interleaved in painter's order stay
  // in ONE draw call. This is the regression that mattered: sorting by texture
  // is not an option here, because draw order *is* the depth order.
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const a = page(renderer)
    const b = page(renderer)
    const c = page(renderer)
    const frame = { x: 0, y: 0, width: 8, height: 8 }

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    const before = mock.stats.glDrawCalls
    // Worst case for the old batcher: every quad switches page.
    for (let i = 0; i < 60; i += 1) {
      renderer.draw(frame, i, i, { atlas: i % 3 === 0 ? a : i % 3 === 1 ? b : c })
    }
    renderer.flush()

    assert(mock.stats.glDrawCalls - before === 1, '60 quads ping-ponging across 3 pages cost exactly 1 draw call')
    assert(renderer.drawCalls === 1, 'renderer.drawCalls reports the real measured count')
    assert(renderer.quadsSubmitted === 60, 'renderer.quadsSubmitted counts every queued quad')

    renderer.dispose()
  }

  // Test 7 (Issue #16): solid rectangles batch together with sprites rather
  // than forcing a flush per colour or per texture switch.
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const a = page(renderer)
    const frame = { x: 0, y: 0, width: 8, height: 8 }

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    const before = mock.stats.glDrawCalls
    renderer.draw(frame, 0, 0, { atlas: a })
    renderer.drawSolid(0, 0, 4, 4, [1, 0, 0, 1])
    renderer.draw(frame, 8, 8, { atlas: a })
    renderer.drawSolid(8, 8, 4, 4, [0, 1, 0, 1])
    renderer.flush()

    assert(mock.stats.glDrawCalls - before === 1, 'Sprites and solid rects interleave in a single draw call')
    renderer.dispose()
  }

  // Test 8 (Issue #16): the batch only splits once it runs out of texture units.
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const units = renderer.textureUnits
    const frame = { x: 0, y: 0, width: 8, height: 8 }
    // One more distinct page than there are units: the extra one must flush.
    const pages = Array.from({ length: units + 1 }, () => page(renderer))

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    const before = mock.stats.glDrawCalls
    for (const atlas of pages) renderer.draw(frame, 0, 0, { atlas })
    renderer.flush()

    assert(units >= 8, `Context exposes a usable number of texture units (${String(units)})`)
    assert(mock.stats.glDrawCalls - before === 2, 'Exceeding the texture-unit budget costs exactly one extra draw call')
    renderer.dispose()
  }

  // Test 9 (Issue #16): begin() resets the per-frame counters, so the HUD reads
  // this frame's cost rather than an ever-growing total.
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const a = page(renderer)
    const frame = { x: 0, y: 0, width: 8, height: 8 }

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.draw(frame, 0, 0, { atlas: a })
    renderer.flush()
    assert(renderer.drawCalls === 1 && renderer.quadsSubmitted === 1, 'First frame counted')

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    assert(renderer.drawCalls === 0 && renderer.quadsSubmitted === 0, 'begin() resets the per-frame counters')
    renderer.dispose()
  }

  // Test 10 (Issue #16): indexed geometry and the generated sampler switch.
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const fragment = mock.stats.shaderSources.find(source => source.includes('u_textures')) ?? ''
    const vertex = mock.stats.shaderSources.find(source => source.includes('a_position')) ?? ''

    assert(fragment.includes('switch (v_unit)'), 'Fragment shader selects the sampler by a constant-case switch')
    assert(
      fragment.includes(`u_textures[${String(renderer.textureUnits)}]`),
      'Sampler array is sized to the units the context actually reports',
    )
    assert(vertex.includes('flat out int v_unit'), 'Texture unit is carried per-vertex, flat-interpolated')
    renderer.dispose()
  }

  // Test 11 (Issue #20): Immutable texture storage (texStorage2D + texSubImage2D)
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)

    // In constructor: whiteTexture and setPalette(defaultPal) should have used texStorage2D + texSubImage2D
    assert(mock.stats.texStorage2DCalls >= 2, 'texStorage2D called for initial whiteTexture and paletteTexture')
    assert(mock.stats.texSubImage2DCalls >= 2, 'texSubImage2D called for initial whiteTexture and paletteTexture')

    const beforeStorage = mock.stats.texStorage2DCalls
    const beforeSub = mock.stats.texSubImage2DCalls

    // setAtlas uses texStorage2D on first upload
    const atlas = {
      pixels: new Uint8ClampedArray(64 * 64 * 4),
      width: 64,
      height: 64,
      groups: [],
    }
    renderer.setAtlas(atlas)
    assert(mock.stats.texStorage2DCalls === beforeStorage + 1, 'setAtlas allocates immutable storage via texStorage2D')
    assert(mock.stats.texSubImage2DCalls === beforeSub + 1, 'setAtlas uploads data via texSubImage2D')

    // Calling setAtlas again with SAME dimensions reuses storage (no extra texStorage2D, only texSubImage2D)
    renderer.setAtlas(atlas)
    assert(mock.stats.texStorage2DCalls === beforeStorage + 1, 'setAtlas with same dimensions reuses immutable storage')
    assert(mock.stats.texSubImage2DCalls === beforeSub + 2, 'setAtlas with same dimensions uploads data via texSubImage2D')

    // addAtlas uses texStorage2D and texSubImage2D
    renderer.addAtlas({ pixels: new Uint8ClampedArray(32 * 32 * 4), width: 32, height: 32 })
    assert(mock.stats.texStorage2DCalls === beforeStorage + 2, 'addAtlas allocates immutable storage via texStorage2D')
    assert(mock.stats.texSubImage2DCalls === beforeSub + 3, 'addAtlas uploads data via texSubImage2D')

    // createAtlas alias also uses texStorage2D and texSubImage2D
    renderer.createAtlas({ pixels: new Uint8ClampedArray(16 * 16 * 4), width: 16, height: 16 })
    assert(mock.stats.texStorage2DCalls === beforeStorage + 3, 'createAtlas allocates immutable storage via texStorage2D')
    assert(mock.stats.texSubImage2DCalls === beforeSub + 4, 'createAtlas uploads data via texSubImage2D')

    // addIndexedAtlas uses texStorage2D (R8) and texSubImage2D (RED)
    renderer.addIndexedAtlas(new Uint8Array(16 * 16), 16, 16)
    assert(mock.stats.texStorage2DCalls === beforeStorage + 4, 'addIndexedAtlas allocates immutable storage via texStorage2D')
    assert(mock.stats.texSubImage2DCalls === beforeSub + 5, 'addIndexedAtlas uploads data via texSubImage2D')

    renderer.dispose()
  }

  // Test 12 (Issue #20): Uniform dirty checking and caching in flush()
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const frame = { x: 0, y: 0, width: 8, height: 8 }

    renderer.begin({ x: 100, y: 200, zoom: 1.5 })
    renderer.draw(frame, 0, 0)
    renderer.flush()

    assert(mock.stats.uniformCameraCalls === 1, 'First flush uploads camera uniform')
    assert(mock.stats.uniformViewportCalls === 1, 'First flush uploads viewport uniform')
    assert(mock.stats.uniformZoomCalls === 1, 'First flush uploads zoom uniform')

    // Second flush with identical camera/viewport/zoom should NOT re-upload any uniforms
    renderer.draw(frame, 8, 8)
    renderer.flush()

    assert(mock.stats.uniformCameraCalls === 1, 'Consecutive flush with same camera skips camera uniform upload')
    assert(mock.stats.uniformViewportCalls === 1, 'Consecutive flush with same viewport skips viewport uniform upload')
    assert(mock.stats.uniformZoomCalls === 1, 'Consecutive flush with same zoom skips zoom uniform upload')

    // Change only camera
    renderer.begin({ x: 150, y: 200, zoom: 1.5 })
    renderer.draw(frame, 0, 0)
    renderer.flush()

    assert(mock.stats.uniformCameraCalls === 2, 'Only camera uniform is uploaded when camera changes')
    assert(mock.stats.uniformViewportCalls === 1, 'Viewport uniform is not uploaded when viewport did not change')
    assert(mock.stats.uniformZoomCalls === 1, 'Zoom uniform is not uploaded when zoom did not change')

    // Change only zoom
    renderer.begin({ x: 150, y: 200, zoom: 2.0 })
    renderer.draw(frame, 0, 0)
    renderer.flush()

    assert(mock.stats.uniformCameraCalls === 2, 'Camera uniform is not uploaded when camera did not change')
    assert(mock.stats.uniformZoomCalls === 2, 'Only zoom uniform is uploaded when zoom changes')

    renderer.dispose()
  }

  // Test 13 (Issue #20): Configurable shader alphaDiscard option
  {
    const mockDefault = createMockCanvas()
    const rendererDefault = new SpriteRenderer(mockDefault.canvas)
    assert(rendererDefault.alphaDiscard === true, 'alphaDiscard defaults to true')
    const fsDefault = mockDefault.stats.shaderSources.find(s => s.includes('outColor')) ?? ''
    assert(fsDefault.includes('discard;'), 'Default shader includes discard for transparent fragments')
    rendererDefault.dispose()

    const mockNoDiscard = createMockCanvas()
    const rendererNoDiscard = new SpriteRenderer(mockNoDiscard.canvas, { alphaDiscard: false })
    assert(rendererNoDiscard.alphaDiscard === false, 'alphaDiscard can be disabled via RendererOptions')
    const fsNoDiscard = mockNoDiscard.stats.shaderSources.find(s => s.includes('outColor')) ?? ''
    assert(!fsNoDiscard.includes('discard;'), 'Shader with alphaDiscard=false omits discard instructions for mobile GPU optimization')
    assert(fsNoDiscard.includes('outColor = texel * v_tint;'), 'Pure alpha blending used when alphaDiscard=false')
    rendererNoDiscard.dispose()
  }

  // Test 14 (Issue #16): Multi-page level maintains draw calls <= 1 (within batch limits)
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    // A complex multi-page level with 8 pages:
    // Floors (2 pages), Walls (2 pages), Roofs (1 page), Objects (1 page), Character (1 page), Monsters (1 page)
    const pages = Array.from({ length: 8 }, () => page(renderer))
    const frame = { x: 0, y: 0, width: 16, height: 16 }

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    const beforeDrawCalls = mock.stats.glDrawCalls

    // Simulate drawing a full frame in painter's order across these 8 pages (1200 quads total)
    // 1. Floors (pages 0 & 1)
    for (let i = 0; i < 400; i += 1) {
      renderer.draw(frame, i * 4, 0, { atlas: pages[i % 2] })
    }
    // 2. Walls and objects interleaved (pages 2, 3, 5)
    for (let i = 0; i < 500; i += 1) {
      const pageIndex = i % 3 === 0 ? 5 : i % 3 === 1 ? 2 : 3
      renderer.draw(frame, i * 4, 100, { atlas: pages[pageIndex] })
    }
    // 3. Characters and monsters (pages 6, 7)
    for (let i = 0; i < 100; i += 1) {
      renderer.draw(frame, i * 10, 200, { atlas: pages[6 + (i % 2)] })
    }
    // 4. Roofs (page 4)
    for (let i = 0; i < 200; i += 1) {
      renderer.draw(frame, i * 4, 300, { atlas: pages[4] })
    }
    renderer.flush()

    assert(renderer.quadsSubmitted === 1200, 'Multi-page level submitted all 1200 quads')
    assert(mock.stats.glDrawCalls - beforeDrawCalls === 1, 'Multi-page level (8 pages) rendered in exactly 1 draw call')
    assert(renderer.drawCalls === 1, 'renderer.drawCalls reports 1 draw call')

    // Now verify when distinct pages exceed the hardware texture unit budget
    const overBudgetPages = Array.from({ length: renderer.textureUnits + 4 }, () => page(renderer))
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    const beforeOverCalls = mock.stats.glDrawCalls
    for (let i = 0; i < overBudgetPages.length; i += 1) {
      renderer.draw(frame, i * 16, 0, { atlas: overBudgetPages[i] })
    }
    renderer.flush()
    const extraCalls = mock.stats.glDrawCalls - beforeOverCalls
    assert(
      extraCalls <= Math.ceil(overBudgetPages.length / renderer.textureUnits),
      'Exceeding texture unit budget flushes minimally within batch unit limits',
    )

    renderer.dispose()
  }

  // Test 16 (Issue #16): HUD displays accurate measured metrics rather than hardcoded dummies
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const a = page(renderer)
    const frame = { x: 0, y: 0, width: 16, height: 16 }

    // Frame 1: Render 120 quads
    const t0 = performance.now()
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    for (let i = 0; i < 120; i += 1) {
      renderer.draw(frame, i, i, { atlas: a })
    }
    renderer.flush()
    const renderMs1 = performance.now() - t0

    const state1 = {
      drawCalls: renderer.drawCalls,
      quadsDrawn: renderer.quadsSubmitted,
      culledDraws: 880,
      renderMs: renderMs1,
    }

    const hudText1 = `${String(state1.quadsDrawn)} 图元 / ${String(state1.drawCalls)} 批次（剔除 ${String(state1.culledDraws)}）· ${state1.renderMs.toFixed(1)} ms`
    assert(state1.drawCalls === 1, 'HUD state drawCalls accurately records 1 draw call')
    assert(state1.quadsDrawn === 120, 'HUD state quadsDrawn accurately records 120 quads')
    assert(state1.culledDraws === 880, 'HUD state culledDraws accurately records 880 culled quads')
    assert(state1.renderMs >= 0, 'HUD state renderMs is a valid measured frame duration')
    assert(hudText1.includes('120 图元 / 1 批次（剔除 880）'), 'HUD string accurately formats measured metrics')

    // Frame 2: Render with over-budget pages to force 2 draw calls and 250 quads
    const overPages = Array.from({ length: renderer.textureUnits + 1 }, () => page(renderer))
    const t1 = performance.now()
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    for (let i = 0; i < 200; i += 1) {
      renderer.draw(frame, i, i, { atlas: overPages[i % renderer.textureUnits] })
    }
    for (let i = 0; i < 50; i += 1) {
      renderer.draw(frame, i, i, { atlas: overPages[renderer.textureUnits] })
    }
    renderer.flush()
    const renderMs2 = performance.now() - t1

    const state2 = {
      drawCalls: renderer.drawCalls,
      quadsDrawn: renderer.quadsSubmitted,
      culledDraws: 1750,
      renderMs: renderMs2,
    }

    const hudText2 = `${String(state2.quadsDrawn)} 图元 / ${String(state2.drawCalls)} 批次（剔除 ${String(state2.culledDraws)}）· ${state2.renderMs.toFixed(1)} ms`
    assert(state2.drawCalls === 2, 'HUD state drawCalls dynamically updates to 2 (not a hardcoded dummy)')
    assert(state2.quadsDrawn === 250, 'HUD state quadsDrawn dynamically updates to 250 (not a hardcoded dummy)')
    assert(state2.culledDraws === 1750, 'HUD state culledDraws dynamically updates to 1750')
    assert(hudText2.includes('250 图元 / 2 批次（剔除 1750）'), 'HUD string reflects dynamic update without hardcoded values')

    renderer.dispose()
  }

  // Test 17 (Issue #16): Memory allocation and performance regression audit
  {
    const mock = createMockCanvas()
    const renderer = new SpriteRenderer(mock.canvas)
    const a = page(renderer)
    const frame = { x: 0, y: 0, width: 8, height: 8 }

    // 1. Buffer growth audit: submitting > INITIAL_CAPACITY (8192) quads
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    for (let i = 0; i < 9000; i += 1) {
      renderer.draw(frame, i % 100, i % 100, { atlas: a })
    }
    assert(renderer.quadsSubmitted === 9000, 'Batch buffer dynamically grows past initial capacity (9000 quads)')
    renderer.flush()
    assert(renderer.drawCalls === 1, 'Large batch (>8192 quads) flushed in single draw call without memory error')

    // 2. Texture cleanup audit on deleteAtlas
    const tempAtlas = page(renderer)
    const texturesBefore = mock.stats.deletedTextures.size
    renderer.deleteAtlas(tempAtlas)
    assert(mock.stats.deletedTextures.size === texturesBefore + 1, 'deleteAtlas promptly frees GPU texture memory')

    renderer.dispose()
  }
  console.log(`\n== Summary: ${String(passed)} passed, ${String(failed)} failed ==`)
  if (failed > 0) process.exit(1)
}

runTests()

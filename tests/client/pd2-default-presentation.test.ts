/**
 * Step B1: PD2 is the client's only runtime default for the Issue #6 presentation runtime
 * (SGD2FreeRes viewport, d2fps motion smoothing, D2GL HD cursor). 1.13c stays reachable only through an
 * explicit `'113c'`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_VIEWPORT_RESOLUTION,
  VALID_VIEWPORT_RESOLUTIONS,
  createDefaultClientSettings,
  defaultViewportResolution,
  normalizeViewportResolution,
} from '../../src/client/settings/client-settings.ts'
import {
  DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS,
  DEFAULT_VIEWPORT_PROFILE,
  NATIVE_113C_VIEWPORT_RESOLUTIONS,
  PD2_SGD2FREERES_VIEWPORT_RESOLUTIONS,
  getViewportProfile,
  getViewportProfileBySize,
  pickFallbackViewport,
} from '../../src/client/view/viewport-profile.ts'
import { LogicClock } from '../../src/client/loop/logic-clock.ts'
import { MotionSmoothing, PD2_D2FPS_CONFIG } from '../../src/client/loop/motion-smoothing.ts'
import { SceneMotionSmoother } from '../../src/client/loop/scene-motion-smoothing.ts'
import type { ClientSceneWorldAdapter } from '../../src/client/view/scene-source.ts'
import type { RenderableUnitInput } from '../../src/client/view/unit-drawables.ts'
import {
  CursorController,
  hdCursorTypeFor,
  parseHdCursorManifest,
  type HdCursorAssetLoader,
} from '../../src/client/ui/cursor.ts'
import { CURSOR_METADATA } from '../../src/common/items/cursor-meta.ts'
import {
  HD_CURSOR_CELL,
  HD_CURSOR_DRAW_SIZE,
  HD_CURSOR_IDLE_STEP_MS,
  HD_CURSOR_OFFSET,
  HdCursorType,
  PD2_HD_CURSOR_FILES,
  PD2_HD_CURSOR_MANIFEST_URL,
  sliceHdCursorStrip,
} from '../../src/common/ui/pd2-hd-cursor.ts'
import { clearMissingArtEntries, getMissingArtEntries } from '../../src/client/scene/missing-art.ts'
import { SpriteRenderer } from '../../src/client/render/renderer.ts'
import {
  d2glPostProcessFragmentShaderSource,
  d2glPostProcessVertexShaderSource,
} from '../../src/client/render/d2gl-postfx.ts'
import {
  D2FontRenderer,
  D2_EXOCET_FONT_STACK,
  D2_FORMAL_FONT_STACK,
  type FontAtlasMeta,
} from '../../src/client/ui/font.ts'
import { PD2_D2GL_CONFIG } from '../../src/common/ui/pd2-d2gl.ts'

describe('B1: PD2 default presentation runtime', () => {
  describe('SGD2FreeRes viewport default', () => {
    it('a fresh client starts at the SGD2FreeRes PD2 default 1068x600', () => {
      expect(DEFAULT_VIEWPORT_RESOLUTION).toBe('1068x600')
      expect(createDefaultClientSettings('en').viewport).toBe('1068x600')
      expect(DEFAULT_CLIENT_SETTINGS.viewport).toBe('1068x600')
      expect(DEFAULT_VIEWPORT_PROFILE.id).toBe('1068x600')
      expect(getViewportProfile(null).id).toBe('1068x600')
      expect(getViewportProfile(undefined).id).toBe('1068x600')
    })

    it('1.13c 800x600 is only reachable explicitly', () => {
      expect(defaultViewportResolution()).toBe('1068x600')
      expect(defaultViewportResolution('113c')).toBe('800x600')
      expect(NATIVE_113C_VIEWPORT_RESOLUTIONS).toEqual(['640x480', '800x600'])
    })

    it('offers the whole SGD2FreeRes list and normalizes to the PD2 default', () => {
      expect(VALID_VIEWPORT_RESOLUTIONS).toEqual(PD2_SGD2FREERES_VIEWPORT_RESOLUTIONS)
      expect(DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS).toEqual(PD2_SGD2FREERES_VIEWPORT_RESOLUTIONS)
      expect(normalizeViewportResolution(undefined)).toBe('1068x600')
      expect(normalizeViewportResolution('bogus')).toBe('1068x600')
      expect(normalizeViewportResolution('1424x800')).toBe('1424x800')
      expect(normalizeViewportResolution(' 1068 ')).toBe('1068x600')
      // 1280 is both 1280x720 and 1280x960: the shorthand is ambiguous.
      expect(normalizeViewportResolution('1280')).toBe('1068x600')
      expect(() => getViewportProfileBySize(1280)).toThrow(/ambiguous/)
      expect(getViewportProfileBySize(1280, 960).id).toBe('1280x960')
    })

    it('falls back to the PD2 default, then 800x600, then the first allowed entry', () => {
      expect(pickFallbackViewport(PD2_SGD2FREERES_VIEWPORT_RESOLUTIONS)).toBe('1068x600')
      expect(pickFallbackViewport(NATIVE_113C_VIEWPORT_RESOLUTIONS)).toBe('800x600')
      expect(pickFallbackViewport(['1280x720', '1424x800'])).toBe('1280x720')
      expect(() => pickFallbackViewport([])).toThrow(/no allowed/)
    })
  })

  describe('d2fps motion smoothing in the scene state', () => {
    const unit = (id: number, x: number, y: number): RenderableUnitInput => ({ kind: 'monster', id, classId: 1, x, y })
    const state = (tick: number, px: number, py: number, units: RenderableUnitInput[], levelId = 1): ClientSceneWorldAdapter => ({
      tick,
      levelId,
      actId: 1,
      playerSubX: px,
      playerSubY: py,
      ambient: null,
      units,
    })

    it('draws units and the camera anchor between the previous and current tick (PD2 default)', () => {
      const clock = new LogicClock(0)
      const smoother = new SceneMotionSmoother(new MotionSmoothing(), clock)
      // First tick seen: snapped.
      clock.advance(40)
      smoother.beginFrame(50) // alpha 0.25
      let out = smoother.apply(state(1, 100, 200, [unit(7, 10, 20)]))
      expect([out.playerSubX, out.playerSubY]).toEqual([100, 200])
      expect(Array.from(out.units)[0]).toMatchObject({ x: 10, y: 20 })
      // Next tick moved everything; at alpha 0.25 the draw is a quarter of the way.
      clock.advance(80)
      smoother.beginFrame(90)
      out = smoother.apply(state(2, 104, 208, [unit(7, 18, 24), unit(9, 50, 50)]))
      expect([out.playerSubX, out.playerSubY]).toEqual([101, 202])
      const [u7, u9] = Array.from(out.units)
      expect(u7).toMatchObject({ id: 7, x: 12, y: 21 })
      // A unit that just appeared is not slid in.
      expect(u9).toMatchObject({ id: 9, x: 50, y: 50 })
      // Same tick, later frame: alpha 0.75.
      smoother.beginFrame(110)
      out = smoother.apply(state(2, 104, 208, [unit(7, 18, 24)]))
      expect(Array.from(out.units)[0]).toMatchObject({ x: 16, y: 23 })
    })

    it('snaps on a level change and passes the state through for an explicit 1.13c', () => {
      const clock = new LogicClock(0)
      const smoother = new SceneMotionSmoother(new MotionSmoothing(), clock)
      clock.advance(40)
      smoother.beginFrame(50)
      smoother.apply(state(1, 100, 200, [unit(7, 10, 20)]))
      clock.advance(80)
      smoother.beginFrame(90)
      const out = smoother.apply(state(2, 900, 900, [unit(7, 500, 500)], 2))
      expect([out.playerSubX, out.playerSubY]).toEqual([900, 900])
      expect(Array.from(out.units)[0]).toMatchObject({ x: 500, y: 500 })

      const vanilla = new SceneMotionSmoother(new MotionSmoothing(PD2_D2FPS_CONFIG, '113c'), clock)
      expect(vanilla.beginFrame(90)).toBe(1)
      const st = state(2, 104, 208, [unit(7, 18, 24)])
      expect(vanilla.apply(st)).toBe(st)
    })

    it('fails fast without a scene tick', () => {
      const clock = new LogicClock(0)
      const smoother = new SceneMotionSmoother(new MotionSmoothing(), clock)
      const { tick: _tick, ...noTick } = state(1, 1, 1, [])
      expect(() => smoother.apply(noTick)).toThrow(/scene tick/)
    })
  })

  describe('D2GL HD cursor in CursorController', () => {
    const manifest = {
      schema: 1,
      mode: 'pd2',
      drawSize: HD_CURSOR_DRAW_SIZE,
      offset: HD_CURSOR_OFFSET,
      idleStepMs: HD_CURSOR_IDLE_STEP_MS,
      sheets: Object.fromEntries(
        Object.entries(PD2_HD_CURSOR_FILES).map(([key, spec]) => [
          key,
          {
            image: `/cursor-pd2/${key}.png`,
            source: spec.path,
            width: spec.width,
            height: spec.height,
            frames: sliceHdCursorStrip(spec.width, spec.height, spec.frames),
          },
        ]),
      ),
    }
    const images = { hand: { tag: 'hand' } as unknown as CanvasImageSource, other: { tag: 'other' } as unknown as CanvasImageSource }
    const okLoader: HdCursorAssetLoader = {
      fetchJson: (url) => (url === PD2_HD_CURSOR_MANIFEST_URL ? Promise.resolve(manifest) : Promise.reject(new Error(url))),
      loadImage: (url) => Promise.resolve(url.endsWith('hand.png') ? images.hand : images.other),
    }

    beforeEach(() => {
      clearMissingArtEntries()
    })

    it('draws the HD hand from /cursor-pd2/ by default', async () => {
      const cursor = new CursorController(CURSOR_METADATA, 0)
      expect(cursor.getDataMode()).toBe('pd2')
      expect(cursor.getHdCursorStatus()).toBe('idle')
      await cursor.loadHdCursor(okLoader)
      expect(cursor.getHdCursorStatus()).toBe('ready')
      cursor.handleMouseMove(100, 50, 0)
      const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
      cursor.render(ctx, {} as CanvasImageSource, 0)
      expect(ctx.drawImage).toHaveBeenCalledTimes(1)
      expect(ctx.drawImage).toHaveBeenCalledWith(images.hand, 0, 0, HD_CURSOR_CELL, HD_CURSOR_CELL, 99, 44, 40, 40)

      // Trade cursors use other.png (identify = cell 0).
      cursor.setTradeCursorMode('identify', 10)
      const ctx2 = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
      cursor.render(ctx2, {} as CanvasImageSource, 10)
      expect(ctx2.drawImage).toHaveBeenCalledWith(images.other, 0, 0, HD_CURSOR_CELL, HD_CURSOR_CELL, 99, 44, 40, 40)
      expect(getMissingArtEntries()).toHaveLength(0)
    })

    it('an explicit 1.13c keeps the DC6 cursor', async () => {
      const cursor = new CursorController(CURSOR_METADATA, 0, '113c')
      expect(cursor.getHdCursorStatus()).toBe('off')
      cursor.handleMouseMove(100, 200, 0)
      const atlas = {} as CanvasImageSource
      const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
      cursor.render(ctx, atlas, 0)
      const f = CURSOR_METADATA.protate[0]!
      expect(ctx.drawImage).toHaveBeenCalledWith(atlas, f.x, f.y, f.w, f.h, 100, 200, f.w, f.h)
    })

    it('reports a missing manifest and falls back to the DC6 cursor', async () => {
      const cursor = new CursorController(CURSOR_METADATA, 0)
      const missingLoader: HdCursorAssetLoader = {
        fetchJson: () => Promise.reject(new Error('HTTP 404')),
        loadImage: () => Promise.reject(new Error('unused')),
      }
      await cursor.loadHdCursor(missingLoader)
      expect(cursor.getHdCursorStatus()).toBe('missing')
      expect(getMissingArtEntries()).toEqual([
        expect.objectContaining({ category: 'ui-cursor', id: PD2_HD_CURSOR_MANIFEST_URL, detail: expect.stringMatching(/HTTP 404/) }),
      ])
      cursor.handleMouseMove(100, 200, 0)
      const atlas = {} as CanvasImageSource
      const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
      cursor.render(ctx, atlas, 0)
      const f = CURSOR_METADATA.protate[0]!
      expect(ctx.drawImage).toHaveBeenCalledWith(atlas, f.x, f.y, f.w, f.h, 100, 200, f.w, f.h)
    })

    it('rejects a manifest that does not match the D2GL constants', () => {
      expect(parseHdCursorManifest(manifest).sheets.hand.frames).toHaveLength(19)
      expect(() => parseHdCursorManifest({ ...manifest, drawSize: 32 })).toThrow(/drawSize/)
      expect(() => parseHdCursorManifest({ ...manifest, mode: '113c' })).toThrow(/mode/)
      const short = { ...manifest, sheets: { ...manifest.sheets, other: { ...manifest.sheets.other!, frames: [] } } }
      expect(() => parseHdCursorManifest(short)).toThrow(/frames/)
    })

    it('maps the cursor state onto D2GL CursorType', () => {
      expect(hdCursorTypeFor('POINTING', null)).toBe(HdCursorType.Hand)
      expect(hdCursorTypeFor('RELEASE', null)).toBe(HdCursorType.Hand)
      expect(hdCursorTypeFor('CLICK_DOWN', null)).toBe(HdCursorType.Press)
      expect(hdCursorTypeFor('OPENING', null)).toBe(HdCursorType.Idle)
      expect(hdCursorTypeFor('OPEN_IDLE', null)).toBe(HdCursorType.Idle)
      expect(hdCursorTypeFor('POINTING', 'buy')).toBe(HdCursorType.Buy)
      expect(hdCursorTypeFor('POINTING', 'sell')).toBe(HdCursorType.Sell)
      expect(hdCursorTypeFor('POINTING', 'repair')).toBe(HdCursorType.Repair)
    })
  })

  describe('Step 2: D2GL WebGL2 Post-Processing (Bicubic + LumaSharpen + 3D LUT) & HD Text', () => {
    function createWebGl2FboMock() {
      const boundFbos: (WebGLFramebuffer | null)[] = []
      const gl: Record<string, unknown> = {
        VERTEX_SHADER: 0x8b31,
        FRAGMENT_SHADER: 0x8b30,
        COMPILE_STATUS: 0x8b81,
        LINK_STATUS: 0x8b82,
        ARRAY_BUFFER: 0x8892,
        ELEMENT_ARRAY_BUFFER: 0x8893,
        DYNAMIC_DRAW: 0x88e8,
        STATIC_DRAW: 0x88e4,
        FLOAT: 0x1406,
        TEXTURE_2D: 0x0de1,
        TEXTURE0: 0x84c0,
        TEXTURE_MIN_FILTER: 0x2801,
        TEXTURE_MAG_FILTER: 0x2800,
        TEXTURE_WRAP_S: 0x2802,
        TEXTURE_WRAP_T: 0x2803,
        NEAREST: 0x2600,
        LINEAR: 0x2601,
        CLAMP_TO_EDGE: 0x812f,
        RGBA: 0x1908,
        RGBA8: 0x8058,
        UNSIGNED_BYTE: 0x1401,
        UNSIGNED_INT: 0x1405,
        TRIANGLES: 0x0004,
        BLEND: 0x0be2,
        DEPTH_TEST: 0x0b71,
        ONE: 1,
        ZERO: 0,
        SRC_ALPHA: 0x0302,
        ONE_MINUS_SRC_ALPHA: 0x0303,
        COLOR_BUFFER_BIT: 0x4000,
        UNPACK_ALIGNMENT: 0x0cf5,
        MAX_TEXTURE_IMAGE_UNITS: 0x8872,
        MAX_TEXTURE_SIZE: 0x0d33,
        FRAMEBUFFER: 0x8d40,
        COLOR_ATTACHMENT0: 0x8ce0,
        FRAMEBUFFER_COMPLETE: 0x8cd5,
        drawingBufferWidth: 1068,
        drawingBufferHeight: 600,
        getParameter: vi.fn((p: number) => (p === 0x8872 ? 16 : 4096)),
        createShader: vi.fn(() => ({})),
        shaderSource: vi.fn(),
        compileShader: vi.fn(),
        getShaderParameter: vi.fn(() => true),
        getShaderInfoLog: vi.fn(() => ''),
        deleteShader: vi.fn(),
        createProgram: vi.fn(() => ({})),
        attachShader: vi.fn(),
        detachShader: vi.fn(),
        linkProgram: vi.fn(),
        getProgramParameter: vi.fn(() => true),
        getProgramInfoLog: vi.fn(() => ''),
        useProgram: vi.fn(),
        deleteProgram: vi.fn(),
        createVertexArray: vi.fn(() => ({})),
        bindVertexArray: vi.fn(),
        deleteVertexArray: vi.fn(),
        createBuffer: vi.fn(() => ({})),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        bufferSubData: vi.fn(),
        deleteBuffer: vi.fn(),
        getAttribLocation: vi.fn(() => 0),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        getUniformLocation: vi.fn((_prog: unknown, name: string) => ({ name })),
        uniform1i: vi.fn(),
        uniform1iv: vi.fn(),
        uniform1f: vi.fn(),
        uniform2f: vi.fn(),
        createTexture: vi.fn(() => ({})),
        bindTexture: vi.fn(),
        texParameteri: vi.fn(),
        texStorage2D: vi.fn(),
        texSubImage2D: vi.fn(),
        texImage2D: vi.fn(),
        pixelStorei: vi.fn(),
        activeTexture: vi.fn(),
        deleteTexture: vi.fn(),
        createFramebuffer: vi.fn(() => ({ tag: 'scene-fbo' })),
        bindFramebuffer: vi.fn((_target: number, fbo: WebGLFramebuffer | null) => {
          boundFbos.push(fbo)
        }),
        framebufferTexture2D: vi.fn(),
        checkFramebufferStatus: vi.fn(() => 0x8cd5),
        deleteFramebuffer: vi.fn(),
        enable: vi.fn(),
        disable: vi.fn(),
        blendFunc: vi.fn(),
        blendFuncSeparate: vi.fn(),
        viewport: vi.fn(),
        clearColor: vi.fn(),
        clear: vi.fn(),
        drawElements: vi.fn(),
        drawArrays: vi.fn(),
      }
      const canvas = {
        width: 1068,
        height: 600,
        getContext: vi.fn(() => gl),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as HTMLCanvasElement
      return { canvas, gl, boundFbos }
    }

    it('runs the D2GL FBO post-processing pass in PD2 mode by default and bypasses it in 1.13c mode', () => {
      expect(d2glPostProcessVertexShaderSource()).toContain('gl_VertexID')
      const frag = d2glPostProcessFragmentShaderSource()
      expect(frag).toContain('sampleBicubic')
      expect(frag).toContain('cubicWeight4(f.x, B, C)')
      expect(frag).not.toContain('cubicWeight4(1.0 - f.x')
      expect(frag).toContain('sampleJinc2Sharper')
      expect(frag).toContain('applyD2GlLumaSharpen')
      expect(frag).toContain('u_outputRelSize')
      expect(frag).toContain('applyD2GlLut')

      const { canvas, gl, boundFbos } = createWebGl2FboMock()
      const renderer = new SpriteRenderer(canvas)
      expect(renderer.getDataMode()).toBe('pd2')
      expect(renderer.isPostProcessEnabled()).toBe(true)
      expect(renderer.getPostProcessConfig()).toEqual(PD2_D2GL_CONFIG.graphics)

      // Configure logical 1068x600 scene viewport with 1920x1080 physical output backbuffer
      ;(gl as { drawingBufferWidth: number; drawingBufferHeight: number }).drawingBufferWidth = 1920
      ;(gl as { drawingBufferWidth: number; drawingBufferHeight: number }).drawingBufferHeight = 1080
      renderer.setSceneViewportSize(1068, 600)
      expect(renderer.getSceneViewportSize()).toEqual({ width: 1068, height: 600 })

      renderer.begin({ x: 0, y: 0, zoom: 1 }, [0, 0, 0])
      renderer.drawSolid(10, 10, 32, 32, [1, 1, 1, 1])
      renderer.end()

      expect(renderer.postProcessPassCount).toBe(1)
      expect(boundFbos.some(f => f !== null)).toBe(true)
      expect(boundFbos.at(-1)).toBeNull()
      expect((gl as { viewport: ReturnType<typeof vi.fn> }).viewport).toHaveBeenCalledWith(0, 0, 1068, 600)
      expect((gl as { viewport: ReturnType<typeof vi.fn> }).viewport).toHaveBeenCalledWith(0, 0, 1920, 1080)

      // Upload 1024x448 LUT texture and switch preset to catmull-rom + lut=3
      renderer.uploadLutTexture({
        width: 1024,
        height: 448,
        pixels: new Uint8Array(1024 * 448 * 4),
      })
      renderer.setPostProcessConfig({
        shaderPreset: 'cubic\\catmull-rom.slangp',
        lut: 3,
      })
      renderer.begin({ x: 0, y: 0, zoom: 1 }, [0, 0, 0])
      renderer.drawSolid(0, 0, 16, 16, [0.5, 0.5, 0.5, 1])
      renderer.end()
      expect(renderer.postProcessPassCount).toBe(2)

      // Explicit 1.13c mode bypasses the post-processing FBO pass
      boundFbos.length = 0
      renderer.setDataMode('113c')
      renderer.begin({ x: 0, y: 0, zoom: 1 }, [0, 0, 0])
      renderer.drawSolid(0, 0, 16, 16, [1, 1, 1, 1])
      renderer.end()
      expect(renderer.postProcessPassCount).toBe(2)
      expect(boundFbos).toHaveLength(0)

      renderer.dispose()
    })

    it('renders crisp D2GL HD Text vector typography by default in PD2 mode and DC6 bitmaps in 1.13c mode', () => {
      expect(D2_EXOCET_FONT_STACK).toContain('"D2GlExocetBlizzard"')
      expect(D2_EXOCET_FONT_STACK).toContain('"D2GlChi"')
      expect(D2_EXOCET_FONT_STACK.indexOf('"Songti SC"')).toBeLessThan(D2_EXOCET_FONT_STACK.indexOf('"D2GlChi"'))
      expect(D2_FORMAL_FONT_STACK).toContain('"D2GlFormal436BT"')
      expect(D2_FORMAL_FONT_STACK).toContain('"D2GlChi"')
      expect(D2_FORMAL_FONT_STACK.indexOf('"Songti SC"')).toBeLessThan(D2_FORMAL_FONT_STACK.indexOf('"D2GlChi"'))

      const glyphs = Array.from({ length: 256 }, (_, code) => ({
        code,
        width: 8,
        height: 16,
        x: (code % 16) * 16,
        y: Math.floor(code / 16) * 16,
        frameW: 8,
        frameH: 16,
      }))
      const meta: FontAtlasMeta = {
        name: 'font16',
        lineHeight: 16,
        capHeight: 12,
        atlasWidth: 256,
        atlasHeight: 256,
        glyphs,
      }
      const fakeAtlas = { width: 256, height: 256 } as unknown as HTMLCanvasElement

      const pd2Font = new D2FontRenderer()
      pd2Font.setFontAtlas('font16', meta, fakeAtlas)
      expect(pd2Font.getDataMode()).toBe('pd2')
      expect(pd2Font.isHdTextEnabled()).toBe(true)
      expect(pd2Font.getHdTextScale()).toBe(1.0)
      expect(pd2Font.measureText('Harlequin Crest', 'font16')).toBe(15 * 8)

      const pd2Ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        drawImage: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn((s: string) => ({ width: s.length * 8 })),
        font: '',
        fillStyle: '',
        textAlign: 'left',
        textBaseline: 'alphabetic',
      } as unknown as CanvasRenderingContext2D

      pd2Font.drawText(pd2Ctx, 'Harlequin Crest', 100, 50, { font: 'font16', color: 'gold' })
      expect(pd2Ctx.drawImage).not.toHaveBeenCalled()
      expect(pd2Ctx.fillText).toHaveBeenCalledWith('Harlequin Crest', 100, 50)
      expect(pd2Ctx.font).toContain('"D2GlExocetBlizzard"')

      // Explicit 1.13c mode blits DC6 bitmap glyphs while keeping identical .tbl measureText advance widths
      const vanillaFont = new D2FontRenderer('113c')
      vanillaFont.setFontAtlas('font16', meta, fakeAtlas)
      expect(vanillaFont.getDataMode()).toBe('113c')
      expect(vanillaFont.isHdTextEnabled()).toBe(false)
      expect(vanillaFont.measureText('Harlequin Crest', 'font16')).toBe(15 * 8)

      const vanillaCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        drawImage: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn((s: string) => ({ width: s.length * 8 })),
        font: '',
        fillStyle: '',
        textAlign: 'left',
        textBaseline: 'alphabetic',
      } as unknown as CanvasRenderingContext2D

      vanillaFont.drawText(vanillaCtx, 'Hi', 100, 50, { font: 'font16', color: 'gold' })
      expect(vanillaCtx.drawImage).toHaveBeenCalledTimes(2)
      expect(vanillaCtx.fillText).not.toHaveBeenCalled()
    })
  })
})

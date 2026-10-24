/**
 * WebGL2 sprite renderer: one indexed quad batcher with per-quad tint that can
 * sample several atlas pages inside a single draw call.
 *
 * Diablo-style rendering is a flood of axis-aligned quads — floors, walls,
 * units, items — drawn in painter's order. So the renderer accumulates
 * world-space quads (position, source rectangle, tint) and submits them in as
 * few calls as it can. Depth ordering is the caller's job (draw order), not the
 * GPU's, which is how the original games did it and what keeps the batcher
 * trivial.
 *
 * Three properties keep the batch big and the CPU cost low:
 *
 * - **Multi-texture batching.** A Diablo level needs more tiles than one 2048²
 *   page holds, and painter's order interleaves those pages constantly: sorting
 *   by texture is not allowed, because that is exactly the order that makes the
 *   scene correct. Binding one texture per batch therefore used to split the
 *   frame into hundreds of draw calls (measured: up to 3077 on
 *   `act4/107-act-4-lava-1`). Instead every page in flight gets its own texture
 *   unit, the unit index rides along as a vertex attribute, and the fragment
 *   shader picks the sampler — so painter's order survives *and* the whole frame
 *   is usually one `drawElements`. Only when a batch needs more distinct pages
 *   than the hardware has units does it flush and start over.
 * - **Indexed geometry.** Four vertices per quad instead of six, with a static
 *   element buffer, so a third less vertex data crosses the bus per frame.
 * - **Zero-allocation vertex writes.** {@link SpriteRenderer.quad} writes the
 *   vertex floats straight out, unrolled. The earlier version built four
 *   throwaway arrays per quad, which at ~2800 quads a frame meant ~11k
 *   short-lived objects per frame handed to the GC.
 *
 * Tint is a vertex attribute rather than a uniform, so coloured geometry
 * (a floor rectangle, a wall) batches together with sprites instead of forcing
 * a flush per colour.
 */
import type { AtlasFrame, SpriteAtlas } from './atlas.ts'
import type { Pl2, Pl2Transform } from '../../common/formats/pl2.ts'
import {
  DEFAULT_CHAMPION_TRANSFORM_113C,
  DEFAULT_COLD_TRANSFORM_113C,
  DEFAULT_INV_COLOR_VARIATIONS_113C,
  DEFAULT_POISON_TRANSFORM_113C,
  DEFAULT_UNIQUE_TRANSFORM_113C,
  PACKED_PALETTE_BIN_BYTES,
  decodePaletteBin,
  decodePl2,
  pl2ExpectedSize,
} from '../../common/formats/pl2.ts'
import { PD2_D2GL_CONFIG, type D2GlGraphicsConfig } from '../../common/ui/pd2-d2gl.ts'
import type { UiDataMode } from '../../common/ui/pd2-sgd2freeres.ts'
import { D2GlPostProcessPass, supportsWebGl2PostProcessFbo } from './d2gl-postfx.ts'

/** Camera state for one frame. */
export interface Camera {
  /** World-space centre of the view. */
  readonly x: number
  /** World-space centre of the view. */
  readonly y: number
  /** Pixels per world unit. */
  readonly zoom: number
}

/**
 * One uploaded atlas texture.
 *
 * Diablo II maps need more tiles than a single 2048² page holds, so the renderer
 * keeps several textures. Each quad records which page it samples; the batcher
 * assigns pages to texture units so a page switch no longer splits the batch
 * (see {@link SpriteRenderer.draw}).
 */
export interface AtlasHandle {
  /** The GPU texture. */
  readonly texture: WebGLTexture
  /** Texture width in pixels, for UV maths. */
  readonly width: number
  /** Texture height in pixels, for UV maths. */
  readonly height: number
  /** Whether this atlas stores 8-bit palette indices (R8 internal format). */
  readonly indexed?: boolean
}

/**
 * A frame that lives on a specific page of a multi-page atlas (entity packs
 * taller than one GPU texture, issue #921). When present, `atlas` wins over
 * `DrawOptions.atlas`, so every existing `draw(frame, x, y, { atlas: art.handle })`
 * call site samples the right page without knowing about paging.
 */
export interface PagedAtlasFrame extends AtlasFrame {
  readonly atlas?: AtlasHandle
}

function framePage(frame: AtlasFrame): AtlasHandle | undefined {
  return (frame as PagedAtlasFrame).atlas
}

/** Draw options for one sprite quad. */
export interface DrawOptions {
  /** Multiplicative tint, defaulting to opaque white. */
  readonly tint?: readonly [number, number, number, number]
  /** Mirror horizontally. */
  readonly flipX?: boolean
  /** Atlas page to sample; defaults to the most recently set atlas. */
  readonly atlas?: AtlasHandle
  /**
   * Hardware palette row index for indexed (R8) atlases:
   * - 0: Normal Act Palette
   * - 1: Cold / Chilled Blue Tint
   * - 2: Poisoned Green Tint
   * - 3: Unique Gold Boss Tint
   * - 4: Champion / Elite Blue Tint
   */
  readonly paletteRow?: number
  /** Destination width in pixels (defaults to frame.width). */
  readonly width?: number
  /** Destination height in pixels (defaults to frame.height). */
  readonly height?: number
  /** Blend mode for rendering: 'normal' (alpha blend), 'additive'/'highlight', or any D2Gfx DrawMode. */
  readonly blendMode?: DrawBlendMode
  /**
   * Optional vertical screen height (in scene pixels) of the sprite's top edge above its ground base.
   * Compensates isometric lightmap UV projection for upright geometry (actors, objects)
   * while preserving the 10-float vertex stride invariant.
   */
  readonly elevationY?: number
  /**
   * Optional vertical roof height shift (in scene pixels, `pTileGfx->wRoofHeight`) applied to all four corners
   * so roof lightmap UVs sample the ground cell beneath the roof (1.13c `0x6fac3a00` -> `D2gfx.#10023`, SPEC #830 §11 Q6).
   */
  readonly roofHeight?: number
  /**
   * Optional 6-point per-column RGB tint array (each `[r, g, b]` in `0..1`) from the 1.13c wall light tables
   * (`0x6fb4e970` / `0x6fb4ec10` / `0x6fb4ee90`, tables `0x6fb8ed18` & `0x6fb8eef8`). When lighting is enabled
   * on a non-additive wall quad, the 160px tile is split into 5 32-pixel vertical columns (`col = block.posX >> 5`
   * in `0..4`) with left vertices tinted by `columnTints[col]` and right vertices by `columnTints[col + 1]`,
   * matching `D2gfx.#10001` (vtable `+0x9c`) and `D2gfx.#10058` (vtable `+0xa0`) in `D2Direct3D.dll`, `D2Glide.dll`,
   * `D2Gdi.dll`, and `D2DDraw.dll` (SPEC #830 §7.3, §11 Q11).
   */
  readonly columnTints?: readonly (readonly [number, number, number])[] | undefined
}

/**
 * Port blend modes. The D2gfx eDrawMode -> mode table lives in `src/common/gfx/draw-mode.ts`
 * (D2Direct3D 0x6F886B90, kb/render/d2gfx-draw-mode-113c.md):
 * - normal: eDrawMode 5/6/7/>=8, opaque (palette index 0 / alpha 0 transparent)
 * - additive: eDrawMode 3, ONE/ONE (S + D)
 * - trans25 / trans50 / trans75: eDrawMode 0 / 1 / 2, SRCALPHA/INVSRCALPHA with alpha 0x40 / 0x80 / 0xC0
 * - burn: eDrawMode 4 (D2MOO DRAWMODE_BURN), D3D ZERO/SRCCOLOR = multiply (S * D); transparent texels are neutral
 * - modulate: multiply via DST_COLOR/ZERO (same result as burn)
 * - highlight: port-only additive alias (S + D)
 * - transhighlight: port-only half-strength additive (D + 0.5*S)
 */
export type DrawBlendMode =
  | 'normal'
  | 'additive'
  | 'trans25'
  | 'trans50'
  | 'trans75'
  | 'modulate'
  | 'burn'
  | 'transhighlight'
  | 'highlight'

/**
 * Optional transform tables or full PL2 file for authentic 1.13c hardware palette rows.
 */
export type PaletteTransformInput =
  | Pl2
  | readonly (Pl2Transform | undefined | null)[]
  | {
      readonly cold?: Pl2Transform | undefined
      readonly poison?: Pl2Transform | undefined
      readonly unique?: Pl2Transform | undefined
      readonly champion?: Pl2Transform | undefined
      readonly hueVariations?: readonly Pl2Transform[] | undefined
    }

/**
 * The 1.13c light grid as the renderer samples it (issue #830): a 48×48 texture of sub-tile CORNER lights
 * (RGB = floor(I·C/255), A = I; `LightGrid.exportTextureBuffer`) whose texel (0, 0) is the corner at sub-tile
 * (originSubX, originSubY). The room ambient light is already in the grid prefill, so there is no ambient term.
 */
export interface LightingConfig {
  /** Sub-tile of texel (0, 0): the grid origin. */
  readonly originSubX: number
  readonly originSubY: number
  /** Scene pixel origin (e.g. grid.originX, grid.originY). */
  readonly sceneOriginX: number
  readonly sceneOriginY: number
  /** 48x48 RGBA8 grid texture (48 * 48 * 4 bytes). If omitted, the existing texture is retained. */
  readonly lightmap?: Uint8Array | null | undefined
}

/** Configuration options and event callbacks for SpriteRenderer. */
export interface RendererOptions {
  /** Optional callback invoked when the WebGL context is lost. */
  readonly onContextLost?: (event: Event) => void
  /** Optional callback invoked when the WebGL context is restored. */
  readonly onContextRestored?: () => void
  /**
   * Whether to discard transparent pixels in the fragment shader.
   * Defaults to true. When false, pure alpha blending is used instead of discard,
   * avoiding early-Z / tile-kill penalties on mobile GPUs.
   */
  readonly alphaDiscard?: boolean
  /**
   * Active data/presentation mode (`'pd2'` by default, `'113c'` for vanilla 1.13c presentation).
   * In `'pd2'` mode, when WebGL2 framebuffer post-processing is supported (`createFramebuffer`),
   * the scene renders to an offscreen FBO and resolves through the D2GL post-processing pipeline
   * (`bicubic` / `catmull-rom` / `jinc2-sharper`, `LumaSharpen`, and 3D LUT).
   */
  readonly dataMode?: UiDataMode
  /**
   * Optional D2GL post-processing configuration override (`d2gl.json`), or `false` to disable.
   * Defaults to `PD2_D2GL_CONFIG` in `'pd2'` mode and disabled in `'113c'` mode.
   */
  readonly postProcess?: Partial<D2GlGraphicsConfig> | boolean | null
}

/** Vertices per quad: the four corners, reused by the index buffer. */
const VERTICES_PER_QUAD = 4
/** Indices per quad (two triangles). */
const INDICES_PER_QUAD = 6
/** Floats per vertex: x, y, u, v, r, g, b, a, unit, paletteRow. */
export const FLOATS_PER_VERTEX = 10
/** Initial batch capacity in quads. */
const INITIAL_CAPACITY = 8192
/**
 * Texture units the batcher will use at most (reserving 1 unit for the hardware palette texture).
 */
const MAX_BATCH_TEXTURES = 16
/** Initial hardware palette rows allocated at construction time (0..4). */
const INITIAL_PALETTE_ROWS = 5
/** Number of precomputed color-shift rows in the 256-color hardware palette texture (0 + 16 variations). */
export const PALETTE_ROWS = 17
/**
 * Added to a quad's texture-unit word when its tint already holds the flat 1.13c unit light (bit 5; units use bits
 * 0..4, and at most `MAX_BATCH_TEXTURES` = 16 are ever bound). The fragment shader then skips the grid sample.
 */
export const UNIT_LIGHT_PRELIT = 32
/**
 * Added to a quad's texture-unit word when it uses additive blending (`additive`, `highlight`, `transhighlight`)
 * inside the unified Premultiplied-Alpha (`ONE, ONE_MINUS_SRC_ALPHA`) batch (bit 6).
 */
export const UNIT_BLEND_ADDITIVE = 64

/**
 * Build the vertex shader.
 *
 * @returns GLSL ES 3.00 source.
 */
export function vertexShaderSource(): string {
  return `#version 300 es
in vec2 a_position;
in vec2 a_uv;
in vec4 a_tint;
in float a_unit;
in float a_palette;
uniform vec2 u_camera;
uniform vec2 u_viewport;
uniform float u_zoom;
uniform vec2 u_sceneOrigin;
uniform vec2 u_lightOrigin;
out vec2 v_uv;
out vec4 v_tint;
out vec2 v_lightUv;
flat out int v_unit;
flat out int v_prelit;
flat out int v_additive;
flat out int v_palette;
void main() {
  vec2 offset = (a_position - u_camera) * u_zoom;
  vec2 halfViewport = u_viewport * 0.5;
  gl_Position = vec4(offset.x / halfViewport.x, -offset.y / halfViewport.y, 0.0, 1.0);
  v_uv = a_uv;
  v_tint = a_tint;
  // Bits 0..4: batch texture unit; bit 5: prelit flat unit light; bit 6: additive blend in unified PMA batch.
  int unitWord = int(a_unit);
  v_unit = unitWord & 31;
  v_prelit = (unitWord >> 5) & 1;
  v_additive = (unitWord >> 6) & 1;
  float liftY = floor((a_palette + 1.5) * (1.0 / 32.0));
  float rawPalette = a_palette - liftY * 32.0;
  v_palette = int(round(rawPalette));

  // Inverse isometric projection to ground-plane sub-tiles (compensating for vertical height liftY):
  // x_scene = (subX - subY) * 16.0 + originX
  // y_scene = (subX + subY) * 8.0  + originY - liftY
  vec2 d = vec2(a_position.x, a_position.y + liftY) - u_sceneOrigin;
  float subX = (d.x * (1.0 / 16.0) + d.y * (1.0 / 8.0)) * 0.5;
  float subY = (d.y * (1.0 / 8.0)  - d.x * (1.0 / 16.0)) * 0.5;
  // 1.13c light grid (#830): texel (i, j) is the sub-tile CORNER (origin + i, origin + j), and integer (subX, subY)
  // are corners here (a floor tile's top corner projects from sub-tile (5*tx, 5*ty)), so a corner sits at its
  // texel centre. LINEAR filtering interpolates the corner lights like the 6x6 per-tile vertex mesh of the 3D path.
  v_lightUv = (vec2(subX, subY) - u_lightOrigin + 0.5) * (1.0 / 48.0);
}`
}

/**
 * Build the fragment shader for a given texture-unit count.
 *
 * Supports both standard RGBA textures (`v_palette < 0`) and 8-bit `R8` palette-indexed
 * textures (`v_palette >= 0`), performing hardware-accelerated palette lookups via `texelFetch`.
 * When dynamic lighting is active (`u_lightMode == 1`), modulates normal non-additive fragments
 * with the bilinear-filtered 1.13c light grid (room ambient included); pre-lit unit sprites keep their tint.
 *
 * @param units - number of batch samplers to expose.
 * @param options - compilation options including alphaDiscard.
 * @returns GLSL ES 3.00 source.
 */
export function fragmentShaderSource(units: number, options: { alphaDiscard?: boolean } = {}): string {
  const alphaDiscard = options.alphaDiscard ?? true
  const cases: string[] = []
  for (let unit = 1; unit < units; unit += 1) {
    cases.push(`    case ${String(unit)}: texel = texture(u_textures[${String(unit)}], v_uv); break;`)
  }
  const paletteLookup = alphaDiscard
    ? `  if (v_palette >= 0) {
    int idx = int(texel.r * 255.0 + 0.5);
    if (idx == 0) discard;
    texel = texelFetch(u_palette, ivec2(idx, v_palette), 0);
  }`
    : `  if (v_palette >= 0) {
    int idx = int(texel.r * 255.0 + 0.5);
    texel = idx == 0 ? vec4(0.0) : texelFetch(u_palette, ivec2(idx, v_palette), 0);
  }`
  const discardAlpha = alphaDiscard ? '\n  if (texel.a == 0.0) discard;' : ''
  return `#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_tint;
in vec2 v_lightUv;
flat in int v_unit;
flat in int v_prelit;
flat in int v_additive;
flat in int v_palette;
uniform sampler2D u_textures[${String(units)}];
uniform sampler2D u_palette;
uniform sampler2D u_lightmap;
uniform int u_lightMode;
uniform int u_blendMode;
out vec4 outColor;
void main() {
  vec4 texel;
  switch (v_unit) {
${cases.join('\n')}
    default: texel = texture(u_textures[0], v_uv); break;
  }
${paletteLookup}${discardAlpha}
  if (u_lightMode == 1 && u_blendMode == 0 && v_additive == 0 && v_prelit == 0) {
    // 1.13c grid light T[I][C]/255 (room ambient included): texel x vertex colour, like D3D MODULATE / Glide.
    vec4 lightSample = texture(u_lightmap, v_lightUv);
    outColor = vec4(texel.rgb * lightSample.rgb * v_tint.rgb, texel.a * v_tint.a);
  } else if (u_blendMode == 2) {
    // eDrawMode 4 multiply (D2Direct3D 0x6F886C41 ZERO/SRCCOLOR): dst *= src. Transparent / partially transparent
    // texels resolve towards white so they leave the destination unchanged instead of multiplying it to black.
    outColor = vec4(mix(vec3(1.0), texel.rgb * v_tint.rgb, texel.a * v_tint.a), 1.0);
  } else if (u_blendMode == 1 || v_additive == 1) {
    outColor = vec4(texel.rgb * v_tint.rgb, (texel.a > 0.0 ? 1.0 : 0.0) * v_tint.a);
  } else {
    outColor = texel * v_tint;
  }
  if (u_blendMode == 0) {
    outColor = vec4(outColor.rgb * outColor.a, v_additive == 1 ? 0.0 : outColor.a);
  }
}`
}

/** Configure standard 2D texture filtering and clamping parameters. */
function initTextureParams(gl: WebGL2RenderingContext, texture: WebGLTexture): void {
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
}

/**
 * Configure WebGL blend factors while preserving an opaque destination alpha channel (`dst.a = 1.0`)
 * when `blendFuncSeparate` is available on the context. Calls `gl.blendFunc(srcRgb, dstRgb)` first
 * so lightweight test stubs that only implement `blendFunc` still observe the RGB blend transition.
 */
function applyGlBlendFunc(
  gl: WebGL2RenderingContext,
  srcRgb: number,
  dstRgb: number,
  srcAlpha: number,
  dstAlpha: number,
): void {
  gl.blendFunc(srcRgb, dstRgb)
  if (typeof gl.blendFuncSeparate === 'function') {
    gl.blendFuncSeparate(srcRgb, dstRgb, srcAlpha, dstAlpha)
  }
}

/** Raised when the context or program cannot be created. */
export class RendererError extends Error {}

/**
 * A quad batcher bound to one canvas.
 */
export class SpriteRenderer {
  /** The target canvas. */
  readonly canvas: HTMLCanvasElement
  /** The WebGL2 context, exposed for the few callers that need raw access. */
  readonly gl: WebGL2RenderingContext
  /** Whether the fragment shader discards transparent fragments. */
  readonly alphaDiscard: boolean
  private readonly program: WebGLProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly buffer: WebGLBuffer
  private readonly indexBuffer: WebGLBuffer
  private atlasTexture: WebGLTexture
  private readonly whiteTexture: WebGLTexture
  private paletteTexture: WebGLTexture
  private lightmapTexture: WebGLTexture | null = null
  /** The 1×1 white page used by `drawSolid`. */
  private readonly whiteAtlas: AtlasHandle
  /** The default page (what `setAtlas` uploads into). */
  private defaultAtlas: AtlasHandle
  private readonly uniformCamera: WebGLUniformLocation
  private readonly uniformViewport: WebGLUniformLocation
  private readonly uniformZoom: WebGLUniformLocation
  private readonly uniformTextures: WebGLUniformLocation
  private readonly uniformPalette: WebGLUniformLocation | null
  private readonly uniformLightmap: WebGLUniformLocation | null
  private readonly uniformSceneOrigin: WebGLUniformLocation | null
  private readonly uniformLightOrigin: WebGLUniformLocation | null
  private readonly uniformLightMode: WebGLUniformLocation | null
  private readonly uniformBlendMode: WebGLUniformLocation | null
  private vertices: Float32Array
  private indices: Uint32Array
  private quadCount = 0
  private atlasWidth = 1
  private atlasHeight = 1
  private atlasStorageAllocated = false
  private paletteStorageAllocated = false
  private paletteRowsAllocated = 0
  /** Cached uniform values to eliminate redundant uniform uploads across flushes. */
  private cachedCameraX = Number.NaN
  private cachedCameraY = Number.NaN
  private cachedViewportWidth = Number.NaN
  private cachedViewportHeight = Number.NaN
  private cachedZoom = Number.NaN
  private cachedSceneOriginX = Number.NaN
  private cachedSceneOriginY = Number.NaN
  private cachedOriginSubX = Number.NaN
  private cachedOriginSubY = Number.NaN
  private cachedLightMode = -1
  private cachedBlendMode = -1
  /** Texture units this context offers the batcher for atlases (reserving 1 unit for palette and 1 for lightmap). */
  private readonly maxBatchTextures: number
  /** Dedicated texture unit for the 256-color hardware palette texture. */
  private readonly paletteUnit: number
  /** Dedicated texture unit for the 48x48 dynamic lightmap texture. */
  private readonly lightmapUnit: number
  /** Pages bound to units `0..batchTextureCount-1` for the pending batch. */
  private readonly batchTextures: (AtlasHandle | null)[]
  private batchTextureCount = 0
  private camera: Camera = { x: 0, y: 0, zoom: 1 }

  /** Lighting parameters. */
  private lightingEnabled = false
  private originSubX = 0
  private originSubY = 0
  private sceneOriginX = 0
  private sceneOriginY = 0
  /** Flat light of the sprites being queued (see {@link setUnitLight}); reset by {@link begin}. */
  private unitLightActive = false
  private unitLightR = 1
  private unitLightG = 1
  private unitLightB = 1

  /** `drawElements` calls issued since the last {@link begin}. */
  private frameDrawCalls = 0
  /** Quads submitted since the last {@link begin}. */
  private frameQuads = 0
  /** Current active blend mode. */
  private currentBlendMode: DrawBlendMode = 'normal'

  /** Active data/presentation mode (`'pd2'` by default, `'113c'` for vanilla 1.13c). */
  private dataMode: UiDataMode
  /** Whether D2GL post-processing is enabled when `dataMode === 'pd2'`. */
  private postProcessEnabled: boolean
  /** Current D2GL post-processing parameters (`d2gl.json`). */
  private postProcessConfig: D2GlGraphicsConfig
  /** Lazily allocated D2GL WebGL2 post-processing pass. */
  private postProcessPass: D2GlPostProcessPass | null = null
  /** Optional logical scene viewport dimensions (e.g. `1068x600`) when output canvas is scaled to HiDPI/CSS size. */
  private sceneViewportWidth = 0
  private sceneViewportHeight = 0

  /** All textures allocated and managed by this renderer. */
  private readonly allocatedTextures = new Set<WebGLTexture>()
  /** Whether this renderer has been disposed. */
  private disposed = false
  /** Listener references for cleanup. */
  private readonly handleContextLost: (event: Event) => void
  private readonly handleContextRestored: () => void

  /**
   * @param canvas - the canvas to render into.
   * @param options - optional lifecycle hooks and configuration.
   */
  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false })
    if (gl === null) throw new RendererError('WebGL2 is not available in this browser')
    this.gl = gl
    this.alphaDiscard = options.alphaDiscard ?? true
    this.dataMode = options.dataMode ?? 'pd2'
    if (options.postProcess === false || options.postProcess === null) {
      this.postProcessEnabled = false
      this.postProcessConfig = { ...PD2_D2GL_CONFIG.graphics }
    } else if (options.postProcess === true || options.postProcess === undefined) {
      this.postProcessEnabled = this.dataMode === 'pd2'
      this.postProcessConfig = { ...PD2_D2GL_CONFIG.graphics }
    } else {
      this.postProcessEnabled = true
      this.postProcessConfig = { ...PD2_D2GL_CONFIG.graphics, ...options.postProcess }
    }

    const reportedUnits = typeof gl.getParameter === 'function'
      ? (gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number | null)
      : null
    const availableUnits = typeof reportedUnits === 'number' && reportedUnits > 0 ? reportedUnits : MAX_BATCH_TEXTURES
    const clampedUnits = Math.max(3, Math.min(MAX_BATCH_TEXTURES, availableUnits))
    this.paletteUnit = clampedUnits - 1
    this.lightmapUnit = clampedUnits - 2
    this.maxBatchTextures = clampedUnits - 2
    this.batchTextures = new Array<AtlasHandle | null>(this.maxBatchTextures).fill(null)

    this.program = createProgram(
      gl,
      vertexShaderSource(),
      fragmentShaderSource(this.maxBatchTextures, { alphaDiscard: this.alphaDiscard }),
    )
    const vao = gl.createVertexArray()
    const buffer = gl.createBuffer()
    const indexBuffer = gl.createBuffer()
    const atlasTexture = gl.createTexture()
    const whiteTexture = gl.createTexture()
    const paletteTexture = gl.createTexture()
    if (
      vao === null ||
      buffer === null ||
      indexBuffer === null ||
      atlasTexture === null ||
      whiteTexture === null ||
      paletteTexture === null
    ) {
      throw new RendererError('WebGL2 resource allocation failed')
    }
    this.vao = vao
    this.buffer = buffer
    this.indexBuffer = indexBuffer
    this.atlasTexture = atlasTexture
    this.whiteTexture = whiteTexture
    this.paletteTexture = paletteTexture
    this.allocatedTextures.add(atlasTexture)
    this.allocatedTextures.add(whiteTexture)
    this.allocatedTextures.add(paletteTexture)
    this.defaultAtlas = { texture: atlasTexture, width: 1, height: 1 }
    this.whiteAtlas = { texture: whiteTexture, width: 1, height: 1 }
    this.vertices = new Float32Array(INITIAL_CAPACITY * VERTICES_PER_QUAD * FLOATS_PER_VERTEX)
    this.indices = buildQuadIndices(INITIAL_CAPACITY)

    const attributePosition = typeof gl.getAttribLocation === 'function' ? gl.getAttribLocation(this.program, 'a_position') : 0
    const attributeUv = typeof gl.getAttribLocation === 'function' ? gl.getAttribLocation(this.program, 'a_uv') : 1
    const attributeTint = typeof gl.getAttribLocation === 'function' ? gl.getAttribLocation(this.program, 'a_tint') : 2
    const attributeUnit = typeof gl.getAttribLocation === 'function' ? gl.getAttribLocation(this.program, 'a_unit') : 3
    const attributePalette = typeof gl.getAttribLocation === 'function' ? gl.getAttribLocation(this.program, 'a_palette') : 4
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW)
    const stride = FLOATS_PER_VERTEX * 4
    gl.enableVertexAttribArray(attributePosition)
    gl.vertexAttribPointer(attributePosition, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(attributeUv)
    gl.vertexAttribPointer(attributeUv, 2, gl.FLOAT, false, stride, 8)
    gl.enableVertexAttribArray(attributeTint)
    gl.vertexAttribPointer(attributeTint, 4, gl.FLOAT, false, stride, 16)
    if (attributeUnit >= 0) {
      gl.enableVertexAttribArray(attributeUnit)
      gl.vertexAttribPointer(attributeUnit, 1, gl.FLOAT, false, stride, 32)
    }
    if (attributePalette >= 0) {
      gl.enableVertexAttribArray(attributePalette)
      gl.vertexAttribPointer(attributePalette, 1, gl.FLOAT, false, stride, 36)
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW)
    gl.bindVertexArray(null)

    this.uniformCamera = requireUniform(gl, this.program, 'u_camera')
    this.uniformViewport = requireUniform(gl, this.program, 'u_viewport')
    this.uniformZoom = requireUniform(gl, this.program, 'u_zoom')
    this.uniformTextures = requireUniform(gl, this.program, 'u_textures[0]')
    this.uniformPalette = gl.getUniformLocation(this.program, 'u_palette')
    this.uniformLightmap = gl.getUniformLocation(this.program, 'u_lightmap')
    this.uniformSceneOrigin = gl.getUniformLocation(this.program, 'u_sceneOrigin')
    this.uniformLightOrigin = gl.getUniformLocation(this.program, 'u_lightOrigin')
    this.uniformLightMode = gl.getUniformLocation(this.program, 'u_lightMode')
    this.uniformBlendMode = gl.getUniformLocation(this.program, 'u_blendMode')

    const samplerUnits = new Int32Array(this.maxBatchTextures)
    for (let unit = 0; unit < this.maxBatchTextures; unit += 1) samplerUnits[unit] = unit
    gl.useProgram(this.program)
    if (typeof gl.uniform1iv === 'function') {
      gl.uniform1iv(this.uniformTextures, samplerUnits)
    }
    if (this.uniformPalette !== null) {
      gl.uniform1i(this.uniformPalette, this.paletteUnit)
    }
    if (this.uniformLightmap !== null) {
      gl.uniform1i(this.uniformLightmap, this.lightmapUnit)
    }

    for (const texture of [atlasTexture, whiteTexture, paletteTexture]) {
      initTextureParams(gl, texture)
    }

    gl.bindTexture(gl.TEXTURE_2D, whiteTexture)
    if (typeof gl.texStorage2D === 'function') {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 1, 1)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]))
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]))
    }
    // Initialize default 256x5 greyscale palette until setPalette is called
    const defaultPal = new Uint8Array(256 * 3)
    for (let i = 0; i < 256; i += 1) {
      defaultPal[i * 3] = i
      defaultPal[i * 3 + 1] = i
      defaultPal[i * 3 + 2] = i
    }
    this.uploadPaletteInternal(defaultPal, undefined, INITIAL_PALETTE_ROWS)
    gl.enable(gl.BLEND)
    applyGlBlendFunc(gl, gl.ONE ?? 1, gl.ONE_MINUS_SRC_ALPHA, gl.ONE ?? 1, gl.ONE_MINUS_SRC_ALPHA)
    if (typeof gl.disable === 'function') {
      gl.disable(gl.DEPTH_TEST)
    }

    this.handleContextLost = (event: Event): void => {
      event.preventDefault()
      console.warn('WebGL2 context lost')
      options.onContextLost?.(event)
    }
    this.handleContextRestored = (): void => {
      this.cachedCameraX = Number.NaN
      this.cachedCameraY = Number.NaN
      this.cachedViewportWidth = Number.NaN
      this.cachedViewportHeight = Number.NaN
      this.cachedZoom = Number.NaN
      this.atlasStorageAllocated = false
      this.paletteStorageAllocated = false
      this.paletteRowsAllocated = 0
      this.postProcessPass?.resetContextState()
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
      gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW)
      console.info('WebGL2 context restored')
      options.onContextRestored?.()
    }
    canvas.addEventListener?.('webglcontextlost', this.handleContextLost)
    canvas.addEventListener?.('webglcontextrestored', this.handleContextRestored)
  }

  /** Active data/presentation mode (`'pd2'` by default, `'113c'` for vanilla 1.13c). */
  getDataMode(): UiDataMode {
    return this.dataMode
  }

  /** Switch data/presentation mode (`'pd2'` enables D2GL post-processing by default; `'113c'` disables it). */
  setDataMode(mode: UiDataMode): void {
    this.dataMode = mode
  }

  /** Whether D2GL post-processing is enabled when `dataMode === 'pd2'`. */
  isPostProcessEnabled(): boolean {
    return this.postProcessEnabled
  }

  /** Enable or disable the D2GL post-processing pass. */
  setPostProcessEnabled(enabled: boolean): void {
    this.postProcessEnabled = enabled
  }

  /** Current D2GL post-processing configuration (`d2gl.json`). */
  getPostProcessConfig(): D2GlGraphicsConfig {
    return this.postProcessPass ? this.postProcessPass.getConfig() : { ...this.postProcessConfig }
  }

  /** Update D2GL post-processing parameters (`shader_preset`, `sharpen`, `lut`, etc.). */
  setPostProcessConfig(config: Partial<D2GlGraphicsConfig>): void {
    this.postProcessConfig = { ...this.postProcessConfig, ...config }
    this.postProcessPass?.setConfig(config)
  }

  /** Upload the `1024x448` `lut.png` texture for the D2GL 3D LUT pass (`lut = 1..14`). */
  uploadLutTexture(
    source:
      | ImageBitmap
      | HTMLImageElement
      | HTMLCanvasElement
      | { readonly width: number; readonly height: number; readonly pixels: Uint8Array | Uint8ClampedArray },
  ): void {
    if (this.disposed) throw new RendererError('SpriteRenderer has already been disposed')
    this.ensurePostProcessPass().uploadLutTexture(source)
  }

  /** Number of D2GL post-processing fullscreen resolve passes executed so far. */
  get postProcessPassCount(): number {
    return this.postProcessPass?.passCount ?? 0
  }

  pixelScale = 1

  /**
   * Configure the logical game viewport dimensions (e.g. `1068x600`) rendered into the offscreen scene FBO
   * before `D2GlPostProcessPass` upscales to the physical output canvas (`gl.drawingBufferWidth x Height`).
   * Pass `(0, 0)` to match the output canvas 1:1.
   */
  setSceneViewportSize(width: number, height: number): void {
    this.sceneViewportWidth = width > 0 ? Math.round(width) : 0
    this.sceneViewportHeight = height > 0 ? Math.round(height) : 0
  }

  /** Effective logical scene viewport dimensions (`u_viewport` and scene FBO size). */
  getSceneViewportSize(): { readonly width: number; readonly height: number } {
    const outW = this.gl.drawingBufferWidth ?? this.canvas.width ?? 800
    const outH = this.gl.drawingBufferHeight ?? this.canvas.height ?? 600
    if (this.sceneViewportWidth > 0 && this.sceneViewportHeight > 0 && this.isPostProcessActive()) {
      return { width: this.sceneViewportWidth, height: this.sceneViewportHeight }
    }
    return { width: outW, height: outH }
  }

  private isPostProcessActive(): boolean {
    return (
      !this.disposed &&
      this.dataMode === 'pd2' &&
      this.postProcessEnabled &&
      supportsWebGl2PostProcessFbo(this.gl)
    )
  }

  private ensurePostProcessPass(): D2GlPostProcessPass {
    if (this.postProcessPass === null) {
      this.postProcessPass = new D2GlPostProcessPass(this.gl, this.postProcessConfig)
    }
    return this.postProcessPass
  }

  /** Whether this renderer and its GPU resources have been disposed. */
  get isDisposed(): boolean {
    return this.disposed
  }

  /** Number of live WebGL textures currently allocated and managed by this renderer. */
  get liveTextureCount(): number {
    return this.allocatedTextures.size
  }

  /**
   * Draw calls issued since the last {@link begin}.
   *
   * This is the real measured count, not an estimate: the HUD used to report a
   * hardcoded `1` while the frame was actually spending hundreds of calls, which
   * is precisely why the cost stayed invisible.
   */
  get drawCalls(): number {
    return this.frameDrawCalls
  }

  /** Quads submitted since the last {@link begin}. */
  get quadsSubmitted(): number {
    return this.frameQuads
  }

  /** Texture units this batcher can bind at once. */
  get textureUnits(): number {
    return this.maxBatchTextures
  }

  /** Current blending mode. */
  get blendMode(): DrawBlendMode {
    return this.currentBlendMode
  }

  /**
   * Set the blend mode for subsequent quads.
   * Flushes any pending quads only when switching to a GPU blend state that requires a different
   * `gl.blendFunc` or `u_blendMode` uniform (`normal`/`trans25`/`trans50`/`trans75` share the same
   * GPU state and bake alpha per vertex).
   */
  setBlendMode(mode: DrawBlendMode): void {
    if (this.disposed) return
    if (this.currentBlendMode === mode) return
    const prevGroup = getGpuBlendGroup(this.currentBlendMode)
    const nextGroup = getGpuBlendGroup(mode)
    if (prevGroup === nextGroup) {
      this.currentBlendMode = mode
      return
    }
    this.flush()
    this.currentBlendMode = mode
    const gl = this.gl
    const one = gl.ONE ?? 1
    const zero = gl.ZERO ?? 0
    switch (nextGroup) {
      case 1:
        applyGlBlendFunc(gl, gl.SRC_ALPHA, one, zero, one)
        break
      case 2:
        applyGlBlendFunc(gl, gl.DST_COLOR, zero, zero, one)
        break
      case 3:
        applyGlBlendFunc(gl, zero, gl.SRC_COLOR, zero, one)
        break
      case 0:
      default:
        applyGlBlendFunc(gl, one, gl.ONE_MINUS_SRC_ALPHA, one, gl.ONE_MINUS_SRC_ALPHA)
        break
    }
  }

  /**
   * Upload an atlas, replacing the current one.
   *
   * @param atlas - the packed atlas.
   * @returns the handle other pages can be drawn with.
   */
  setAtlas(atlas: SpriteAtlas): AtlasHandle {
    if (this.disposed) throw new RendererError('SpriteRenderer has already been disposed')
    const gl = this.gl
    // Uploading past the limit is a silent INVALID_VALUE in GL; say what
    // actually went wrong instead.
    const limit = typeof gl.getParameter === 'function' ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096
    if (typeof limit === 'number' && limit > 0 && (atlas.width > limit || atlas.height > limit)) {
      throw new RendererError(
        `atlas ${String(atlas.width)}x${String(atlas.height)} exceeds the ${String(limit)}px texture limit`,
      )
    }
    this.flush()
    const pixels = new Uint8Array(atlas.pixels.buffer, atlas.pixels.byteOffset, atlas.pixels.byteLength)

    if (this.atlasStorageAllocated) {
      if (this.atlasWidth === atlas.width && this.atlasHeight === atlas.height) {
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
        gl.texSubImage2D(
          gl.TEXTURE_2D, 0, 0, 0, atlas.width, atlas.height,
          gl.RGBA, gl.UNSIGNED_BYTE, pixels,
        )
        return this.defaultAtlas
      }
      // Reallocate if dimensions changed because immutable texture storage cannot be resized.
      const contextLost = typeof gl.isContextLost === 'function' ? gl.isContextLost() : false
      if (!contextLost) {
        gl.deleteTexture(this.atlasTexture)
      }
      this.allocatedTextures.delete(this.atlasTexture)
      const newTexture = gl.createTexture()
      if (newTexture === null) throw new RendererError('texture allocation failed')
      this.atlasTexture = newTexture
      this.allocatedTextures.add(newTexture)
      initTextureParams(gl, newTexture)
    }

    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    if (typeof gl.texStorage2D === 'function') {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, atlas.width, atlas.height)
      gl.texSubImage2D(
        gl.TEXTURE_2D, 0, 0, 0, atlas.width, atlas.height,
        gl.RGBA, gl.UNSIGNED_BYTE, pixels,
      )
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, atlas.width, atlas.height, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, pixels,
      )
    }
    this.atlasStorageAllocated = true
    this.atlasWidth = Math.max(atlas.width, 1)
    this.atlasHeight = Math.max(atlas.height, 1)
    this.defaultAtlas = { texture: this.atlasTexture, width: this.atlasWidth, height: this.atlasHeight }
    return this.defaultAtlas
  }

  /**
   * Upload an extra atlas page and return a handle for it.
   *
   * Packed maps ship several pages; the page can load the ones the spawn area
   * needs first and hand them over as they arrive, instead of waiting for one
   * gigantic texture to decode.
   *
   * @param source - decoded pixels or an `ImageBitmap` (PNG straight from cache).
   * @param width - page width in pixels.
   * @param height - page height in pixels.
   * @returns the handle to pass to {@link draw}.
   */
  addAtlas(
    source: ImageBitmap | Uint8Array | Uint8ClampedArray | { pixels: Uint8ClampedArray | Uint8Array; width: number; height: number },
    width?: number,
    height?: number,
  ): AtlasHandle {
    if (this.disposed) throw new RendererError('SpriteRenderer has already been disposed')
    const gl = this.gl
    const limit = typeof gl.getParameter === 'function' ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096
    const isBitmap = typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap
    const isRawBytes = source instanceof Uint8Array || source instanceof Uint8ClampedArray
    const sourceWidth = isBitmap
      ? (source as ImageBitmap).width
      : isRawBytes
        ? (width ?? 1)
        : (source as { width: number }).width
    const sourceHeight = isBitmap
      ? (source as ImageBitmap).height
      : isRawBytes
        ? (height ?? 1)
        : (source as { height: number }).height
    const pageWidth = Math.max(1, width ?? sourceWidth)
    const pageHeight = Math.max(1, height ?? sourceHeight)
    if (typeof limit === 'number' && limit > 0 && (pageWidth > limit || pageHeight > limit)) {
      throw new RendererError(`atlas ${String(pageWidth)}x${String(pageHeight)} exceeds the ${String(limit)}px texture limit`)
    }
    this.flush()
    const texture = gl.createTexture()
    if (texture === null) throw new RendererError('texture allocation failed')
    this.allocatedTextures.add(texture)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    initTextureParams(gl, texture)
    if (typeof gl.texStorage2D === 'function') {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, pageWidth, pageHeight)
      if (isBitmap) {
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          Math.min(pageWidth, sourceWidth),
          Math.min(pageHeight, sourceHeight),
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          source as ImageBitmap,
        )
      } else if (isRawBytes) {
        const pixels = source instanceof Uint8Array
          ? source
          : new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
        gl.texSubImage2D(
          gl.TEXTURE_2D, 0, 0, 0, pageWidth, pageHeight,
          gl.RGBA, gl.UNSIGNED_BYTE, pixels,
        )
      } else {
        const indexed = source as { pixels: Uint8ClampedArray | Uint8Array; width: number; height: number }
        const pixels = indexed.pixels instanceof Uint8Array
          ? indexed.pixels
          : new Uint8Array(indexed.pixels.buffer, indexed.pixels.byteOffset, indexed.pixels.byteLength)
        gl.texSubImage2D(
          gl.TEXTURE_2D, 0, 0, 0, indexed.width, indexed.height,
          gl.RGBA, gl.UNSIGNED_BYTE, pixels,
        )
      }
    } else {
      if (isBitmap) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as ImageBitmap)
      } else if (isRawBytes) {
        const pixels = source instanceof Uint8Array
          ? source
          : new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
        gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, pageWidth, pageHeight, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, pixels,
        )
      } else {
        const indexed = source as { pixels: Uint8ClampedArray | Uint8Array; width: number; height: number }
        const pixels = indexed.pixels instanceof Uint8Array
          ? indexed.pixels
          : new Uint8Array(indexed.pixels.buffer, indexed.pixels.byteOffset, indexed.pixels.byteLength)
        gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, indexed.width, indexed.height, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, pixels,
        )
      }
    }
    return { texture, width: pageWidth, height: pageHeight }
  }

  /**
   * Alias for {@link addAtlas} for creating/uploading an atlas page.
   */
  createAtlas(
    source: ImageBitmap | Uint8Array | Uint8ClampedArray | { pixels: Uint8ClampedArray | Uint8Array; width: number; height: number },
    width?: number,
    height?: number,
  ): AtlasHandle {
    return this.addAtlas(source, width, height)
  }

  /**
   * Re-upload pixel data into an EXISTING atlas handle's texture in place.
   *
   * Unlike {@link addAtlas} this never allocates a new GPU texture, so callers
   * that refresh one cache slot repeatedly (e.g. the automap static-layer
   * cache) keep a constant texture footprint. `source` dimensions must match
   * the handle exactly; allocate a new slot when the cache size changes.
   */
  updateAtlas(
    handle: AtlasHandle,
    source: ImageBitmap | { pixels: Uint8ClampedArray | Uint8Array; width: number; height: number },
  ): void {
    if (this.disposed) throw new RendererError('SpriteRenderer has already been disposed')
    const gl = this.gl
    const srcW = source instanceof Object && 'width' in source ? source.width : 1
    const srcH = source instanceof Object && 'height' in source ? source.height : 1
    if (srcW !== handle.width || srcH !== handle.height) {
      throw new RendererError(
        `updateAtlas source ${String(srcW)}x${String(srcH)} does not match handle ${String(handle.width)}x${String(handle.height)}`,
      )
    }
    this.flush()
    gl.bindTexture(gl.TEXTURE_2D, handle.texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source)
    } else {
      const indexed = source as { pixels: Uint8ClampedArray | Uint8Array; width: number; height: number }
      const pixels = indexed.pixels instanceof Uint8Array
        ? indexed.pixels
        : new Uint8Array(indexed.pixels.buffer, indexed.pixels.byteOffset, indexed.pixels.byteLength)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, indexed.width, indexed.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    }
  }

  /**
   * Upload a raw 8-bit palette-indexed (`gl.R8`, 1 byte per pixel) atlas texture.
   *
   * Zero image decoding is performed on the CPU, and GPU memory consumption is
   * reduced by 75% compared to RGBA8. Color expansion and status tinting are
   * performed in hardware via `texelFetch(u_palette, ...)`.
   *
   * @param indices - raw 8-bit palette index array (`width * height` bytes, 0 = transparent).
   * @param width - atlas width in pixels.
   * @param height - atlas height in pixels.
   * @returns the indexed atlas handle (`indexed: true`).
   */
  addIndexedAtlas(indices: Uint8Array, width: number, height: number): AtlasHandle {
    if (this.disposed) throw new RendererError('SpriteRenderer has already been disposed')
    const gl = this.gl
    const limit = typeof gl.getParameter === 'function' ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096
    const pageWidth = Math.max(1, width)
    const pageHeight = Math.max(1, height)
    if (typeof limit === 'number' && limit > 0 && (pageWidth > limit || pageHeight > limit)) {
      throw new RendererError(`indexed atlas ${String(pageWidth)}x${String(pageHeight)} exceeds the ${String(limit)}px texture limit`)
    }
    this.flush()
    const texture = gl.createTexture()
    if (texture === null) throw new RendererError('indexed texture allocation failed')
    this.allocatedTextures.add(texture)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    initTextureParams(gl, texture)
    if (typeof gl.texStorage2D === 'function') {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, pageWidth, pageHeight)
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        pageWidth,
        pageHeight,
        gl.RED,
        gl.UNSIGNED_BYTE,
        indices,
      )
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        pageWidth,
        pageHeight,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        indices,
      )
    }
    return { texture, width: pageWidth, height: pageHeight, indexed: true }
  }

  /**
   * Upload the 256-colour Act palette and precompute hardware status/variation tint rows (0..16):
   * - Row 0: Normal Act Palette
   * - Row 1: Cold / Chilled Blue Tint (authentic States.txt shift 108 / blueTones transform)
   * - Row 2: Poisoned Green Tint (authentic States.txt shift 104 / greenTones transform)
   * - Row 3: Unique Gold Boss Tint (authentic RandTransforms.dat[4] / Utrans transform)
   * - Row 4: Champion / Elite Tint (authentic RandTransforms.dat[24] transform)
   * - Rows 5..16: Authentic 1.13c RandTransforms.dat / invColorVariations monster & item colormap shifts
   *
   * @param rgb - 768-byte array of 256 RGB triplets, 4864-byte packed `palette.bin`, or full decoded PL2 buffer.
   * @param transforms - optional PL2 object or transform array for authentic 1.13c colormaps.
   */
  setPalette(rgb: Uint8Array, transforms?: PaletteTransformInput): void {
    this.uploadPaletteInternal(rgb, transforms, PALETTE_ROWS)
  }

  private uploadPaletteInternal(
    rgb: Uint8Array,
    transforms: PaletteTransformInput | undefined,
    rowCount: number,
  ): void {
    if (this.disposed) return
    this.flush()
    const gl = this.gl

    let baseRgb = rgb
    let preResolvedRows: readonly Uint8Array[] | null = null
    const variationTables: Pl2Transform[] = [...DEFAULT_INV_COLOR_VARIATIONS_113C]

    if (rgb.byteLength >= pl2ExpectedSize()) {
      try {
        const pl2 = decodePl2(rgb)
        baseRgb = pl2.rgb
        variationTables[0] = pl2.hueVariations[107] ?? pl2.blueTones
        variationTables[1] = pl2.hueVariations[103] ?? pl2.greenTones
        variationTables[2] = DEFAULT_UNIQUE_TRANSFORM_113C
        variationTables[3] = DEFAULT_CHAMPION_TRANSFORM_113C
      } catch {
        // Fall back to treating as raw RGB
      }
    } else if (rgb.byteLength >= 768) {
      try {
        const decoded = decodePaletteBin(rgb)
        baseRgb = decoded.rgb
        if (rgb.byteLength >= PACKED_PALETTE_BIN_BYTES && !transforms) {
          preResolvedRows = decoded.rows
        }
        for (let idx = 0; idx < decoded.variations.length && idx < variationTables.length; idx += 1) {
          variationTables[idx] = decoded.variations[idx]!
        }
      } catch {
        // Fall back to treating as raw RGB
      }
    }

    if (transforms) {
      if (Array.isArray(transforms)) {
        for (let idx = 0; idx < transforms.length && idx < variationTables.length; idx += 1) {
          const table = transforms[idx]
          if (table) variationTables[idx] = table
        }
      } else if ('blueTones' in transforms && 'greenTones' in transforms) {
        const pl2 = transforms as Pl2
        variationTables[0] = pl2.blueTones ?? pl2.hueVariations?.[107] ?? DEFAULT_COLD_TRANSFORM_113C
        variationTables[1] = pl2.greenTones ?? pl2.hueVariations?.[103] ?? DEFAULT_POISON_TRANSFORM_113C
        variationTables[2] = pl2.hueVariations?.[2] ?? pl2.selectedUnitShift ?? DEFAULT_UNIQUE_TRANSFORM_113C
        variationTables[3] = pl2.hueVariations?.[4] ?? pl2.blueTones ?? DEFAULT_CHAMPION_TRANSFORM_113C
      } else {
        const tObj = transforms as {
          cold?: Pl2Transform
          poison?: Pl2Transform
          unique?: Pl2Transform
          champion?: Pl2Transform
          hueVariations?: readonly Pl2Transform[]
        }
        if (tObj.cold ?? tObj.hueVariations?.[1]) {
          variationTables[0] = (tObj.cold ?? tObj.hueVariations?.[1])!
        }
        if (tObj.poison ?? tObj.hueVariations?.[3]) {
          variationTables[1] = (tObj.poison ?? tObj.hueVariations?.[3])!
        }
        if (tObj.unique ?? tObj.hueVariations?.[2]) {
          variationTables[2] = (tObj.unique ?? tObj.hueVariations?.[2])!
        }
        if (tObj.champion ?? tObj.hueVariations?.[4]) {
          variationTables[3] = (tObj.champion ?? tObj.hueVariations?.[4])!
        }
        if (tObj.hueVariations) {
          for (let idx = 4; idx < variationTables.length && idx < tObj.hueVariations.length; idx += 1) {
            const table = tObj.hueVariations[idx]
            if (table) variationTables[idx] = table
          }
        }
      }
    }

    const totalRows = Math.max(1, Math.min(PALETTE_ROWS, rowCount))
    const rgba = new Uint8Array(256 * totalRows * 4)
    if (preResolvedRows) {
      for (let row = 0; row < totalRows; row += 1) {
        const rowRgb = preResolvedRows[row] ?? baseRgb
        for (let i = 1; i < 256; i += 1) {
          const dst = (256 * row + i) * 4
          rgba[dst] = rowRgb[i * 3] ?? 0
          rgba[dst + 1] = rowRgb[i * 3 + 1] ?? 0
          rgba[dst + 2] = rowRgb[i * 3 + 2] ?? 0
          rgba[dst + 3] = 255
        }
      }
    } else {
      for (let i = 1; i < 256; i += 1) {
        const r = baseRgb[i * 3] ?? 0
        const g = baseRgb[i * 3 + 1] ?? 0
        const b = baseRgb[i * 3 + 2] ?? 0

        // Row 0: Normal Act Palette
        const r0 = i * 4
        rgba[r0] = r
        rgba[r0 + 1] = g
        rgba[r0 + 2] = b
        rgba[r0 + 3] = 255

        // Rows 1..totalRows-1: Authentic 1.13c index-to-index remap tables
        for (let row = 1; row < totalRows; row += 1) {
          const table = variationTables[row - 1] ?? DEFAULT_INV_COLOR_VARIATIONS_113C[row - 1]!
          const targetIdx = (table[i] ?? i) * 3
          const dst = (256 * row + i) * 4
          rgba[dst] = baseRgb[targetIdx] ?? 0
          rgba[dst + 1] = baseRgb[targetIdx + 1] ?? 0
          rgba[dst + 2] = baseRgb[targetIdx + 2] ?? 0
          rgba[dst + 3] = 255
        }
      }
    }

    if (typeof gl.texStorage2D === 'function') {
      if (this.paletteStorageAllocated && this.paletteRowsAllocated !== totalRows) {
        const contextLost = typeof gl.isContextLost === 'function' ? gl.isContextLost() : false
        if (!contextLost) {
          gl.deleteTexture(this.paletteTexture)
        }
        this.allocatedTextures.delete(this.paletteTexture)
        const newTex = gl.createTexture()
        if (newTex === null) throw new RendererError('palette texture allocation failed')
        this.paletteTexture = newTex
        this.allocatedTextures.add(newTex)
        initTextureParams(gl, newTex)
        this.paletteStorageAllocated = false
      }
      gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      if (!this.paletteStorageAllocated) {
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 256, totalRows)
        this.paletteStorageAllocated = true
        this.paletteRowsAllocated = totalRows
      }
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        256,
        totalRows,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        rgba,
      )
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        256,
        totalRows,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        rgba,
      )
      this.paletteRowsAllocated = totalRows
    }
  }

  /**
   * Lazily acquire or allocate the 48x48 RGBA8 dynamic lightmap texture.
   */
  private getLightmapTexture(): WebGLTexture {
    if (this.lightmapTexture !== null) return this.lightmapTexture
    const gl = this.gl
    const texture = gl.createTexture()
    if (texture === null) throw new RendererError('lightmap texture allocation failed')
    this.lightmapTexture = texture
    this.allocatedTextures.add(texture)
    initTextureParams(gl, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const emptyLightmap = new Uint8Array(48 * 48 * 4)
    if (typeof gl.texStorage2D === 'function') {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 48, 48)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 48, 48, gl.RGBA, gl.UNSIGNED_BYTE, emptyLightmap)
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 48, 48, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyLightmap)
    }
    return texture
  }

  /**
   * Configure dynamic scene lighting: the 1.13c light grid texture and its origin (issue #830).
   *
   * @param config - lighting configuration, or null to disable lighting.
   */
  setLighting(config: LightingConfig | null): void {
    if (this.disposed) return
    if (config === null) {
      if (this.lightingEnabled) {
        this.flush()
        this.lightingEnabled = false
      }
      return
    }
    const lightmap = config.lightmap ?? null
    if (lightmap !== null && lightmap.length !== 48 * 48 * 4) {
      throw new RendererError(`light grid texture must be 48x48 RGBA8 (${String(48 * 48 * 4)} bytes), got ${String(lightmap.length)}`)
    }
    if (
      !this.lightingEnabled ||
      lightmap !== null ||
      config.originSubX !== this.originSubX ||
      config.originSubY !== this.originSubY ||
      config.sceneOriginX !== this.sceneOriginX ||
      config.sceneOriginY !== this.sceneOriginY
    ) {
      // Queued quads were built for the previous grid state.
      this.flush()
    }
    this.lightingEnabled = true
    this.originSubX = config.originSubX
    this.originSubY = config.originSubY
    this.sceneOriginX = config.sceneOriginX
    this.sceneOriginY = config.sceneOriginY

    if (lightmap !== null) {
      const gl = this.gl
      const texture = this.getLightmapTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.texSubImage2D(
        gl.TEXTURE_2D, 0, 0, 0, 48, 48,
        gl.RGBA, gl.UNSIGNED_BYTE, lightmap,
      )
    }
  }

  /**
   * Flat light for the sprites queued next, or `null` to return to per-fragment grid sampling. 1.13c lights each
   * unit with ONE grid value (D2Client 0x6fb4f120 / 0x6fb4f2b0: `GetLightAt` of the unit's cell, packed and passed
   * to the unit blitter), so while lighting is enabled every non-additive `draw` / `drawQuad` multiplies its tint
   * by `rgb` (0..1, i.e. T[I][C] / 255) and skips the lightmap sample. Additive draws stay unlit, as before.
   * Reset by {@link begin}.
   */
  setUnitLight(rgb: readonly [number, number, number] | null): void {
    if (rgb === null) {
      this.unitLightActive = false
      return
    }
    for (const c of rgb) {
      if (!Number.isFinite(c) || c < 0 || c > 1) throw new RendererError(`unit light channel must be 0..1, got ${String(c)}`)
    }
    this.unitLightActive = true
    this.unitLightR = rgb[0]
    this.unitLightG = rgb[1]
    this.unitLightB = rgb[2]
  }

  /** Whether a sprite drawn with `blendMode` takes the flat unit light right now. */
  private unitLightApplies(blendMode: DrawBlendMode): boolean {
    return (
      this.unitLightActive &&
      this.lightingEnabled &&
      !isAdditiveBlendMode(blendMode) &&
      getGpuBlendGroup(blendMode) === 0
    )
  }

  /**
   * Release an atlas texture handle and free its GPU memory.
   *
   * @param handle - the atlas handle previously returned by addAtlas or setAtlas.
   * @returns true if the texture was managed by this renderer and deleted, false otherwise.
   */
  deleteAtlas(handle: AtlasHandle | number | null | undefined): boolean {
    if (this.disposed || !handle || typeof handle !== 'object' || handle === this.whiteAtlas) return false
    if (!this.allocatedTextures.has(handle.texture)) return false

    // Quads already queued may reference this page's unit, so they have to go
    // out before the texture disappears.
    for (let unit = 0; unit < this.batchTextureCount; unit += 1) {
      if (this.batchTextures[unit] === handle) {
        this.flush()
        break
      }
    }
    if (this.defaultAtlas === handle) {
      this.defaultAtlas = this.whiteAtlas
    }

    const contextLost = typeof this.gl.isContextLost === 'function' ? this.gl.isContextLost() : false
    if (!contextLost) {
      this.gl.deleteTexture(handle.texture)
    }
    this.allocatedTextures.delete(handle.texture)
    return true
  }

  /** The page `setAtlas` uploaded into, for callers that draw with handles. */
  get defaultAtlasHandle(): AtlasHandle {
    return this.defaultAtlas
  }

  /**
   * Start a frame: clear, and record the camera.
   *
   * @param camera - camera to render with, or world X coordinate.
   * @param clearOrY - background colour as `[r, g, b]` in 0..1, or world Y coordinate.
   */
  begin(
    camera: Camera | number,
    clearOrY: readonly [number, number, number] | number = [0, 0, 0],
    clearFallback: readonly [number, number, number] = [0, 0, 0],
  ): void {
    if (this.disposed) throw new RendererError('SpriteRenderer has already been disposed')
    const gl = this.gl
    this.setBlendMode('normal')
    if (typeof camera === 'number') {
      this.camera = {
        x: camera,
        y: typeof clearOrY === 'number' ? clearOrY : 0,
        zoom: 1,
      }
    } else {
      this.camera = camera
    }
    const clear: readonly [number, number, number] = typeof clearOrY === 'number' ? clearFallback : clearOrY
    this.quadCount = 0
    this.batchTextureCount = 0
    this.frameDrawCalls = 0
    this.frameQuads = 0
    this.lightingEnabled = false
    this.unitLightActive = false
    if (this.currentBlendMode !== 'normal') {
      this.currentBlendMode = 'normal'
      applyGlBlendFunc(gl, gl.ONE ?? 1, gl.ONE_MINUS_SRC_ALPHA, gl.ONE ?? 1, gl.ONE_MINUS_SRC_ALPHA)
    }
    const outWidth = gl.drawingBufferWidth ?? this.canvas.width ?? 800
    const outHeight = gl.drawingBufferHeight ?? this.canvas.height ?? 600
    if (this.isPostProcessActive()) {
      const sceneVp = this.getSceneViewportSize()
      this.ensurePostProcessPass().beginScenePass(sceneVp.width, sceneVp.height, clear)
    } else {
      if (this.postProcessPass !== null && this.postProcessPass.isSceneFboBound) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      }
      gl.viewport(0, 0, outWidth, outHeight)
      gl.clearColor(clear[0], clear[1], clear[2], 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
  }

  /** Finish a frame by flushing all pending quads and resolving any active D2GL post-processing pass. */
  end(): void {
    this.flush()
    if (this.disposed) return
    if (this.postProcessPass !== null && this.postProcessPass.isSceneFboBound) {
      const gl = this.gl
      const outWidth = gl.drawingBufferWidth ?? this.canvas.width ?? 800
      const outHeight = gl.drawingBufferHeight ?? this.canvas.height ?? 600
      this.postProcessPass.endScenePass(outWidth, outHeight)
      const one = gl.ONE ?? 1
      const zero = gl.ZERO ?? 0
      const group = getGpuBlendGroup(this.currentBlendMode)
      switch (group) {
        case 1:
          applyGlBlendFunc(gl, gl.SRC_ALPHA, one, zero, one)
          break
        case 2:
          applyGlBlendFunc(gl, gl.DST_COLOR, zero, zero, one)
          break
        case 3:
          applyGlBlendFunc(gl, zero, gl.SRC_COLOR, zero, one)
          break
        case 0:
        default:
          applyGlBlendFunc(gl, one, gl.ONE_MINUS_SRC_ALPHA, one, gl.ONE_MINUS_SRC_ALPHA)
          break
      }
    }
  }

  /**
   * Queue one atlas sprite.
   *
   * @param frame - the atlas placement to draw.
   * @param x - world-space left edge.
   * @param y - world-space top edge.
   * @param options - tint, flipping, and hardware palette row.
   */
  draw(frame: AtlasFrame, x: number, y: number, options: DrawOptions = {}): void {
    if (this.disposed) return
    const blendMode = options.blendMode ?? 'normal'
    if (blendMode !== this.currentBlendMode) {
      this.setBlendMode(blendMode)
    }
    const rawPage = framePage(frame) ?? options.atlas ?? this.defaultAtlas
    const page =
      rawPage && typeof rawPage === 'object' && 'texture' in rawPage && typeof rawPage.width === 'number'
        ? rawPage
        : this.defaultAtlas
    const unit = this.unitFor(page)
    const u0 = frame.x / page.width
    const v0 = frame.y / page.height
    const u1 = (frame.x + frame.width) / page.width
    const v1 = (frame.y + frame.height) / page.height
    const tint = options.tint
    let defaultAlpha = 1.0
    if (blendMode === 'trans25') defaultAlpha = 0.25
    else if (blendMode === 'trans50') defaultAlpha = 0.50
    else if (blendMode === 'trans75') defaultAlpha = 0.75
    else if (blendMode === 'transhighlight') defaultAlpha = 0.50
    const quadAlpha = tint === undefined || tint[3] >= 1.0 ? defaultAlpha : tint[3]

    const flipped = options.flipX === true
    const paletteRow = page.indexed === true ? (options.paletteRow ?? 0) : -1
    const drawW = options.width ?? frame.width
    const drawH = options.height ?? frame.height
    const baseR = tint === undefined ? 1 : tint[0]
    const baseG = tint === undefined ? 1 : tint[1]
    const baseB = tint === undefined ? 1 : tint[2]

    const isAdditive = isAdditiveBlendMode(blendMode)
    const additiveFlag = isAdditive ? UNIT_BLEND_ADDITIVE : 0

    if (options.columnTints !== undefined) {
      const cols = options.columnTints
      if (cols.length !== 6) {
        throw new RendererError(`columnTints must have 6 entries (0x6fb8ed18 / 0x6fb8eef8), got ${String(cols.length)}`)
      }
      if (this.lightingEnabled && !isAdditive && getGpuBlendGroup(blendMode) === 0) {
        const prelitUnit = unit + UNIT_LIGHT_PRELIT
        const firstCol = cols[0]!
        const r0 = firstCol[0]
        const g0 = firstCol[1]
        const b0 = firstCol[2]
        let uniformCols = true
        for (let col = 1; col < 6; col += 1) {
          const c = cols[col]!
          if (c[0] !== r0 || c[1] !== g0 || c[2] !== b0) {
            uniformCols = false
            break
          }
        }
        if (uniformCols) {
          this.quad(
            x, y,
            x + drawW, y,
            x, y + drawH,
            x + drawW, y + drawH,
            flipped ? u1 : u0, v0,
            flipped ? u0 : u1, v1,
            baseR * r0,
            baseG * g0,
            baseB * b0,
            quadAlpha,
            prelitUnit,
            paletteRow,
            paletteRow,
          )
          return
        }
        const uLeft = flipped ? u1 : u0
        const uSpan = (flipped ? u0 : u1) - uLeft
        for (let col = 0; col < 5; col += 1) {
          const px0 = col * 32
          if (px0 >= drawW) break
          const px1 = Math.min((col + 1) * 32, drawW)
          const t0 = px0 / drawW
          const t1 = px1 / drawW
          const cx0 = x + px0
          const cx1 = x + px1
          const cu0 = uLeft + uSpan * t0
          const cu1 = uLeft + uSpan * t1
          const c0 = cols[col]!
          const c1 = cols[col + 1]!
          this.quad(
            cx0, y,
            cx1, y,
            cx0, y + drawH,
            cx1, y + drawH,
            cu0, v0,
            cu1, v1,
            baseR * c0[0],
            baseG * c0[1],
            baseB * c0[2],
            quadAlpha,
            prelitUnit,
            paletteRow,
            paletteRow,
            baseR * c1[0],
            baseG * c1[1],
            baseB * c1[2],
          )
        }
        return
      }
    }

    const roofLift = options.roofHeight !== undefined && options.roofHeight > 0 ? Math.round(options.roofHeight) : 0
    const elevationY = options.elevationY !== undefined && options.elevationY > 0 ? Math.round(options.elevationY) : 0
    const bottomPalette = roofLift > 0 ? paletteRow + roofLift * 32 : paletteRow
    const topPalette = roofLift > 0 ? bottomPalette : (elevationY > 0 ? paletteRow + elevationY * 32 : paletteRow)
    const lit = this.unitLightApplies(blendMode)
    this.quad(
      x, y,
      x + drawW, y,
      x, y + drawH,
      x + drawW, y + drawH,
      flipped ? u1 : u0, v0,
      flipped ? u0 : u1, v1,
      baseR * (lit ? this.unitLightR : 1),
      baseG * (lit ? this.unitLightG : 1),
      baseB * (lit ? this.unitLightB : 1),
      quadAlpha,
      unit + (lit ? UNIT_LIGHT_PRELIT : 0) + additiveFlag,
      bottomPalette,
      topPalette,
    )
  }

  /**
   * Queue one arbitrarily projected atlas quad with four explicit corners.
   *
   * Corner order matches index winding:
   * - (x0, y0): Top-Left
   * - (x1, y1): Top-Right
   * - (x2, y2): Bottom-Left
   * - (x3, y3): Bottom-Right
   *
   * Allows authentic isometric perspective ground projection, sheared decals,
   * and affine sprite tilting.
   */
  drawQuad(
    frame: AtlasFrame,
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    options: DrawOptions = {},
  ): void {
    if (this.disposed) return
    const blendMode = options.blendMode ?? 'normal'
    if (blendMode !== this.currentBlendMode) {
      this.setBlendMode(blendMode)
    }
    const rawPage = framePage(frame) ?? options.atlas ?? this.defaultAtlas
    const page =
      rawPage && typeof rawPage === 'object' && 'texture' in rawPage && typeof rawPage.width === 'number'
        ? rawPage
        : this.defaultAtlas
    const unit = this.unitFor(page)
    const u0 = frame.x / page.width
    const v0 = frame.y / page.height
    const u1 = (frame.x + frame.width) / page.width
    const v1 = (frame.y + frame.height) / page.height
    const tint = options.tint
    let defaultAlpha = 1.0
    if (blendMode === 'trans25') defaultAlpha = 0.25
    else if (blendMode === 'trans50') defaultAlpha = 0.50
    else if (blendMode === 'trans75') defaultAlpha = 0.75
    else if (blendMode === 'transhighlight') defaultAlpha = 0.50
    const quadAlpha = tint === undefined || tint[3] >= 1.0 ? defaultAlpha : tint[3]

    const flipped = options.flipX === true
    const paletteRow = page.indexed === true ? (options.paletteRow ?? 0) : -1
    const elevationY = options.elevationY !== undefined && options.elevationY > 0 ? Math.round(options.elevationY) : 0
    const topPalette = elevationY > 0 ? paletteRow + elevationY * 32 : paletteRow
    const lit = this.unitLightApplies(blendMode)
    const additiveFlag = isAdditiveBlendMode(blendMode) ? UNIT_BLEND_ADDITIVE : 0
    this.quad(
      x0, y0, x1, y1, x2, y2, x3, y3,
      flipped ? u1 : u0, v0,
      flipped ? u0 : u1, v1,
      (tint === undefined ? 1 : tint[0]) * (lit ? this.unitLightR : 1),
      (tint === undefined ? 1 : tint[1]) * (lit ? this.unitLightG : 1),
      (tint === undefined ? 1 : tint[2]) * (lit ? this.unitLightB : 1),
      quadAlpha,
      unit + (lit ? UNIT_LIGHT_PRELIT : 0) + additiveFlag,
      paletteRow,
      topPalette,
    )
  }

  /**
   * Queue one solid-colour rectangle.
   *
   * @param x - world-space left edge.
   * @param y - world-space top edge.
   * @param width - rectangle width.
   * @param height - rectangle height.
   * @param color - `[r, g, b, a]` in 0..1.
   * @param options - optional draw options like blendMode.
   */
  drawSolid(
    x: number,
    y: number,
    width: number,
    height: number,
    color: readonly [number, number, number, number],
    options: { blendMode?: DrawBlendMode } = {},
  ): void {
    if (this.disposed) return
    const blendMode = options.blendMode ?? 'normal'
    if (blendMode !== this.currentBlendMode) {
      this.setBlendMode(blendMode)
    }
    const unit = this.unitFor(this.whiteAtlas) + (isAdditiveBlendMode(blendMode) ? UNIT_BLEND_ADDITIVE : 0)
    this.quad(
      x, y,
      x + width, y,
      x, y + height,
      x + width, y + height,
      0.5, 0.5, 0.5, 0.5,
      color[0], color[1], color[2], color[3],
      unit, -1,
    )
  }

  /**
   * Queue one arbitrarily projected solid color quad with four explicit corners.
   */
  drawSolidQuad(
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    color: readonly [number, number, number, number],
    options: { blendMode?: DrawBlendMode } = {},
  ): void {
    if (this.disposed) return
    const blendMode = options.blendMode ?? 'normal'
    if (blendMode !== this.currentBlendMode) {
      this.setBlendMode(blendMode)
    }
    const unit = this.unitFor(this.whiteAtlas) + (isAdditiveBlendMode(blendMode) ? UNIT_BLEND_ADDITIVE : 0)
    this.quad(
      x0, y0, x1, y1, x2, y2, x3, y3,
      0.5, 0.5, 0.5, 0.5,
      color[0], color[1], color[2], color[3],
      unit, -1,
    )
  }

  /**
   * Find the texture unit a page is bound to for the pending batch, binding it
   * to a free unit if this is its first quad.
   *
   * @param page - the atlas page the caller wants to sample.
   * @returns the texture unit index to write into the vertices.
   */
  private unitFor(page: AtlasHandle): number {
    const count = this.batchTextureCount
    for (let unit = 0; unit < count; unit += 1) {
      if (this.batchTextures[unit] === page) return unit
    }
    if (count === this.maxBatchTextures) {
      this.flush()
      this.batchTextures[0] = page
      this.batchTextureCount = 1
      return 0
    }
    this.batchTextures[count] = page
    this.batchTextureCount = count + 1
    return count
  }

  /**
   * Append one quad's four vertices.
   *
   * Corners:
   * - 0: Top-Left (x0, y0, u0, v0)
   * - 1: Top-Right (x1, y1, u1, v0)
   * - 2: Bottom-Left (x2, y2, u0, v1)
   * - 3: Bottom-Right (x3, y3, u1, v1)
   */
  private quad(
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    u0: number, v0: number, u1: number, v1: number,
    r0: number, g0: number, b0: number, a: number,
    unit: number,
    bottomPalette: number,
    topPalette = bottomPalette,
    r1 = r0, g1 = g0, b1 = b0,
  ): void {
    const needed = (this.quadCount + 1) * VERTICES_PER_QUAD * FLOATS_PER_VERTEX
    if (needed > this.vertices.length) this.grow(needed)
    const v = this.vertices
    let at = this.quadCount * VERTICES_PER_QUAD * FLOATS_PER_VERTEX
    // Corner 0: top-left.
    v[at] = x0; v[at + 1] = y0; v[at + 2] = u0; v[at + 3] = v0
    v[at + 4] = r0; v[at + 5] = g0; v[at + 6] = b0; v[at + 7] = a; v[at + 8] = unit; v[at + 9] = topPalette
    at += FLOATS_PER_VERTEX
    // Corner 1: top-right.
    v[at] = x1; v[at + 1] = y1; v[at + 2] = u1; v[at + 3] = v0
    v[at + 4] = r1; v[at + 5] = g1; v[at + 6] = b1; v[at + 7] = a; v[at + 8] = unit; v[at + 9] = topPalette
    at += FLOATS_PER_VERTEX
    // Corner 2: bottom-left.
    v[at] = x2; v[at + 1] = y2; v[at + 2] = u0; v[at + 3] = v1
    v[at + 4] = r0; v[at + 5] = g0; v[at + 6] = b0; v[at + 7] = a; v[at + 8] = unit; v[at + 9] = bottomPalette
    at += FLOATS_PER_VERTEX
    // Corner 3: bottom-right.
    v[at] = x3; v[at + 1] = y3; v[at + 2] = u1; v[at + 3] = v1
    v[at + 4] = r1; v[at + 5] = g1; v[at + 6] = b1; v[at + 7] = a; v[at + 8] = unit; v[at + 9] = bottomPalette
    this.quadCount += 1
    this.frameQuads += 1
  }

  /** Submit every queued quad. */
  flush(): void {
    const gl = this.gl
    if (this.disposed || this.quadCount === 0) return
    const floatCount = this.quadCount * VERTICES_PER_QUAD * FLOATS_PER_VERTEX
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices, 0, floatCount)
    const camX = this.camera.x
    const camY = this.camera.y
    if (camX !== this.cachedCameraX || camY !== this.cachedCameraY) {
      gl.uniform2f(this.uniformCamera, camX, camY)
      this.cachedCameraX = camX
      this.cachedCameraY = camY
    }

    const sceneVp = this.getSceneViewportSize()
    const vpWidth = sceneVp.width
    const vpHeight = sceneVp.height
    if (vpWidth !== this.cachedViewportWidth || vpHeight !== this.cachedViewportHeight) {
      gl.uniform2f(this.uniformViewport, vpWidth, vpHeight)
      this.cachedViewportWidth = vpWidth
      this.cachedViewportHeight = vpHeight
    }

    const zoom = this.camera.zoom * this.pixelScale
    if (zoom !== this.cachedZoom) {
      if (typeof gl.uniform1f === 'function') {
        gl.uniform1f(this.uniformZoom, zoom)
      }
      this.cachedZoom = zoom
    }

    const lightMode = this.lightingEnabled ? 1 : 0
    if (lightMode !== this.cachedLightMode && this.uniformLightMode !== null) {
      gl.uniform1i(this.uniformLightMode, lightMode)
      this.cachedLightMode = lightMode
    }

    const group = getGpuBlendGroup(this.currentBlendMode)
    const blendMode = group === 1 ? 1 : group === 2 || group === 3 ? 2 : 0
    if (blendMode !== this.cachedBlendMode && this.uniformBlendMode !== null) {
      gl.uniform1i(this.uniformBlendMode, blendMode)
      this.cachedBlendMode = blendMode
    }

    if (this.lightingEnabled) {
      if (
        (this.sceneOriginX !== this.cachedSceneOriginX ||
          this.sceneOriginY !== this.cachedSceneOriginY) &&
        this.uniformSceneOrigin !== null
      ) {
        gl.uniform2f(this.uniformSceneOrigin, this.sceneOriginX, this.sceneOriginY)
        this.cachedSceneOriginX = this.sceneOriginX
        this.cachedSceneOriginY = this.sceneOriginY
      }

      if (
        (this.originSubX !== this.cachedOriginSubX ||
          this.originSubY !== this.cachedOriginSubY) &&
        this.uniformLightOrigin !== null
      ) {
        gl.uniform2f(this.uniformLightOrigin, this.originSubX, this.originSubY)
        this.cachedOriginSubX = this.originSubX
        this.cachedOriginSubY = this.originSubY
      }
    }

    gl.activeTexture(gl.TEXTURE0 + this.paletteUnit)
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture)
    if (this.lightingEnabled) {
      const lightmap = this.getLightmapTexture()
      gl.activeTexture(gl.TEXTURE0 + this.lightmapUnit)
      gl.bindTexture(gl.TEXTURE_2D, lightmap)
    }
    for (let unit = 0; unit < this.batchTextureCount; unit += 1) {
      const page = this.batchTextures[unit]
      if (page === undefined || page === null) continue
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, page.texture)
    }
    if (typeof gl.drawElements === 'function') {
      gl.drawElements(gl.TRIANGLES, this.quadCount * INDICES_PER_QUAD, gl.UNSIGNED_INT, 0)
    } else if (typeof gl.drawArrays === 'function') {
      gl.drawArrays(gl.TRIANGLES, 0, this.quadCount * INDICES_PER_QUAD)
    }
    this.frameDrawCalls += 1
    this.quadCount = 0
    this.batchTextureCount = 0
  }

  /**
   * Destroy all WebGL2 GPU resources (textures, VAO, VBO, program) and detach event listeners.
   */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.cachedCameraX = Number.NaN
    this.cachedCameraY = Number.NaN
    this.cachedViewportWidth = Number.NaN
    this.cachedViewportHeight = Number.NaN
    this.cachedZoom = Number.NaN
    this.cachedSceneOriginX = Number.NaN
    this.cachedSceneOriginY = Number.NaN
    this.cachedOriginSubX = Number.NaN
    this.cachedOriginSubY = Number.NaN
    this.cachedLightMode = -1
    this.cachedBlendMode = -1
    this.atlasStorageAllocated = false
    this.paletteStorageAllocated = false
    this.lightmapTexture = null

    this.canvas.removeEventListener?.('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener?.('webglcontextrestored', this.handleContextRestored)

    const gl = this.gl
    this.postProcessPass?.dispose()
    this.postProcessPass = null
    const contextLost = typeof gl.isContextLost === 'function' ? gl.isContextLost() : false
    if (!contextLost) {
      for (const texture of this.allocatedTextures) {
        gl.deleteTexture(texture)
      }
      this.allocatedTextures.clear()
      gl.deleteBuffer(this.buffer)
      gl.deleteBuffer(this.indexBuffer)
      gl.deleteVertexArray(this.vao)
      gl.deleteProgram(this.program)
    } else {
      this.allocatedTextures.clear()
    }
    this.quadCount = 0
    this.batchTextureCount = 0
  }

  /**
   * Grow the vertex and index buffers, preserving queued geometry.
   *
   * @param needed - required float count.
   */
  private grow(needed: number): void {
    let capacity = this.vertices.length
    while (capacity < needed) capacity *= 2
    const grown = new Float32Array(capacity)
    grown.set(this.vertices)
    this.vertices = grown
    const quads = Math.floor(capacity / (VERTICES_PER_QUAD * FLOATS_PER_VERTEX))
    this.indices = buildQuadIndices(quads)
    const gl = this.gl
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, grown.byteLength, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW)
    gl.bindVertexArray(null)
  }
}

function isAdditiveBlendMode(mode: DrawBlendMode): boolean {
  return mode === 'additive' || mode === 'highlight' || mode === 'transhighlight'
}

/**
 * Group `DrawBlendMode` values by their underlying GPU blend state (`gl.blendFunc` + `u_blendMode`).
 * Normal (`normal`/`trans25`/`trans50`/`trans75`) and additive (`additive`/`highlight`/`transhighlight`)
 * modes share Premultiplied-Alpha hardware state `(ONE, ONE_MINUS_SRC_ALPHA)` in group 0 via the
 * per-vertex `UNIT_BLEND_ADDITIVE` flag, so they batch together in a single draw call without flushing.
 */
function getGpuBlendGroup(mode: DrawBlendMode): 0 | 1 | 2 | 3 {
  switch (mode) {
    case 'modulate':
      return 2
    case 'burn':
      return 3
    case 'additive':
    case 'highlight':
    case 'transhighlight':
    case 'trans25':
    case 'trans50':
    case 'trans75':
    case 'normal':
    default:
      return 0
  }
}

/**
 * Build the static index buffer contents for a quad capacity.
 *
 * Every quad is two triangles over its four corners: top-left, top-right,
 * bottom-left and bottom-right, wound the same way the old six-vertex layout
 * was so nothing about the rasterised result changes.
 *
 * @param quads - number of quads to cover.
 * @returns indices, `6 * quads` long.
 */
function buildQuadIndices(quads: number): Uint32Array {
  const indices = new Uint32Array(quads * INDICES_PER_QUAD)
  for (let quad = 0; quad < quads; quad += 1) {
    const vertex = quad * VERTICES_PER_QUAD
    const at = quad * INDICES_PER_QUAD
    indices[at] = vertex
    indices[at + 1] = vertex + 1
    indices[at + 2] = vertex + 2
    indices[at + 3] = vertex + 1
    indices[at + 4] = vertex + 3
    indices[at + 5] = vertex + 2
  }
  return indices
}

/**
 * Compile and link a program, reporting shader logs on failure.
 *
 * Shaders are detached and flagged for deletion immediately after linking to
 * prevent driver-level memory leaks.
 *
 * @param gl - the context.
 * @param vertexSource - vertex shader source.
 * @param fragmentSource - fragment shader source.
 * @returns the linked program.
 */
function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const compile = (type: number, source: string): WebGLShader => {
    const shader = gl.createShader(type)
    if (shader === null) throw new RendererError('could not create shader')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      const log = gl.getShaderInfoLog(shader) ?? 'unknown'
      gl.deleteShader(shader)
      throw new RendererError(`shader compile failed: ${log}`)
    }
    return shader
  }
  const program = gl.createProgram()
  if (program === null) throw new RendererError('could not create program')
  const vs = compile(gl.VERTEX_SHADER, vertexSource)
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSource)
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS) === true
  const log = linked ? '' : (gl.getProgramInfoLog(program) ?? 'unknown')
  if (typeof gl.detachShader === 'function') {
    gl.detachShader(program, vs)
  }
  gl.deleteShader(vs)
  if (typeof gl.detachShader === 'function') {
    gl.detachShader(program, fs)
  }
  gl.deleteShader(fs)
  if (!linked) {
    gl.deleteProgram(program)
    throw new RendererError(`program link failed: ${log}`)
  }
  return program
}

/**
 * Fetch a uniform location or fail loudly.
 *
 * @param gl - the context.
 * @param program - the linked program.
 * @param name - uniform name.
 * @returns the location.
 */
function requireUniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)
  if (location === null) throw new RendererError(`uniform ${name} is missing from the program`)
  return location
}

export { SpriteRenderer as WebGLRenderer2D }


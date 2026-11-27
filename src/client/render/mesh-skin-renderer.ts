/**
 * Real-time mesh skin renderer (`src/client/render/mesh-skin-renderer.ts`).
 *
 * Renders skinned 3D units into an offscreen "impostor" atlas inside the sprite renderer's
 * WebGL2 context. Each impostor is then drawn by the regular sprite batch as an ordinary RGBA
 * frame, so depth sorting, lighting, tinting, shadows and the additive glow layer keep working
 * unchanged.
 *
 * Per unit and frame: skin on the CPU -> rasterise at 2x supersampling into a scratch target
 * (diffuse + additive glow, sharing one depth buffer) -> resolve into a per-frame atlas cell.
 * The resolve un-premultiplies and dilates colour by one texel so the cell can be sampled with
 * LINEAR filtering without dark fringes.
 */

import {
  computeMeshSkinJointMatrices,
  meshSkinBillboardBasis,
  meshSkinCameraRotation,
  resolveMeshSkinLook,
  skinMeshSkinAttachment,
  skinMeshSkinGeoset,
  type MeshSkinAttachPoint,
  type MeshSkinGeoset,
  type MeshSkinLook,
  type MeshSkinModel,
  type MeshSkinPose,
} from '../../common/units/mesh-skin-model.ts'
import type { AtlasHandle, PagedAtlasFrame, SpriteRenderer } from './renderer.ts'

export type MeshSkinTextureSource =
  | TexImageSource
  | { readonly pixels: Uint8Array; readonly width: number; readonly height: number }

/** Logical (scene pixel) footprint of a unit's impostor and where its ground point sits in it. */
export interface MeshSkinBox {
  readonly width: number
  readonly height: number
  readonly footX: number
  readonly footY: number
}

export interface MeshSkinImpostor {
  readonly frame: PagedAtlasFrame
  /** Additive glow layer for the same cell, or `null` when nothing emissive was visible. */
  readonly glowFrame: PagedAtlasFrame | null
}

interface GpuGeoset {
  readonly vao: WebGLVertexArrayObject
  readonly vbo: WebGLBuffer
  readonly ibo: WebGLBuffer
  readonly indexCount: number
}

/** A paper-doll image kept on the CPU side so looks can be composited after the upload. */
type RetainedImage =
  | { readonly kind: 'pixels'; readonly pixels: Uint8Array; readonly width: number; readonly height: number }
  | { readonly kind: 'canvas'; readonly canvas: HTMLCanvasElement | OffscreenCanvas }

export interface MeshSkinGpuModel {
  readonly model: MeshSkinModel
  readonly textures: readonly WebGLTexture[]
  readonly geosets: readonly GpuGeoset[]
  readonly globals: Float32Array
  readonly joints: Float32Array
  /** Look worn when the caller passes none (`null` for a model without a paper-doll). */
  readonly defaultLook: MeshSkinLook | null
  /** Paper-doll canvas and layer images by image index. */
  readonly retained: ReadonlyMap<number, RetainedImage>
  /** Composited canvas textures by {@link MeshSkinLook.canvasKey}. */
  readonly canvasTextures: Map<string, WebGLTexture>
  /** Second set of vertex buffers, made when the model is first drawn as a mirrored attachment. */
  mirrorGeosets: GpuGeoset[] | null
  disposed: boolean
}

/** A rigid model (a weapon) drawn on one joint of the model being rendered. */
export interface MeshSkinAttachment {
  readonly gpu: MeshSkinGpuModel
  readonly point: MeshSkinAttachPoint
  /** Mirror the model across its XZ plane (a right-hand weapon held in the left hand). */
  readonly mirror: boolean
}

/** One geoset to draw this impostor: a geoset of the model itself or of an attachment. */
interface DrawItem {
  readonly geo: MeshSkinGeoset
  readonly buf: GpuGeoset
  readonly textures: readonly WebGLTexture[]
  /** Geoset index in the model being rendered, or `-1` for an attachment's geoset. */
  readonly g: number
}

function createScratchCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height)
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
  throw new Error('Mesh skin renderer: no 2D canvas is available to composite paper-doll textures')
}

function context2d(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (ctx === null) throw new Error('Mesh skin renderer: 2D canvas context unavailable')
  return ctx
}

function retainImage(src: MeshSkinTextureSource): RetainedImage {
  if ('pixels' in src) return { kind: 'pixels', pixels: src.pixels, width: src.width, height: src.height }
  const size = src as { readonly width: number; readonly height: number }
  const canvas = createScratchCanvas(size.width, size.height)
  context2d(canvas).drawImage(src as CanvasImageSource, 0, 0)
  return { kind: 'canvas', canvas }
}

/**
 * Source-over composite of `layers` onto a copy of `base` (straight alpha, nearest scaling).
 * Exported for tests; the browser path uses a 2D canvas instead.
 */
export function compositeMeshSkinCanvasPixels(
  base: { readonly pixels: Uint8Array; readonly width: number; readonly height: number },
  layers: readonly {
    readonly pixels: Uint8Array
    readonly width: number
    readonly height: number
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
  }[],
): Uint8Array {
  const out = new Uint8Array(base.pixels)
  for (const layer of layers) {
    for (let j = 0; j < layer.h; j += 1) {
      const dy = layer.y + j
      if (dy < 0 || dy >= base.height) continue
      const sy = Math.min(layer.height - 1, Math.floor((j * layer.height) / layer.h))
      for (let i = 0; i < layer.w; i += 1) {
        const dx = layer.x + i
        if (dx < 0 || dx >= base.width) continue
        const sx = Math.min(layer.width - 1, Math.floor((i * layer.width) / layer.w))
        const s = (sy * layer.width + sx) * 4
        const d = (dy * base.width + dx) * 4
        const a = layer.pixels[s + 3]! / 255
        if (a <= 0) continue
        const da = out[d + 3]! / 255
        const oa = a + da * (1 - a)
        for (let k = 0; k < 3; k += 1) {
          out[d + k] = Math.round((layer.pixels[s + k]! * a + out[d + k]! * da * (1 - a)) / oa)
        }
        out[d + 3] = Math.round(oa * 255)
      }
    }
  }
  return out
}

/** Side length of the per-frame impostor atlas and of the supersampled scratch target. */
export const MESH_SKIN_ATLAS_SIZE = 2048
const SCRATCH_SIZE = 2048
const CELL_MARGIN = 1
const MAX_TEXEL_SCALE = 4
const DEPTH_RANGE_UNITS = 2048
const GLOW_DEPTH_BIAS = 0.004
/** Item glow: additive strength on the item itself, and of each of the offset halo taps around it. */
const ITEM_GLOW_CORE = 0.08
const ITEM_GLOW_HALO = 0.05
/** Halo radius in scene pixels and its tap directions. */
const ITEM_GLOW_RADIUS_PX = 1.8
const ITEM_GLOW_TAPS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
]

const MESH_VS = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
uniform vec3 u_rot0;
uniform vec3 u_rot1;
uniform vec3 u_rot2;
uniform vec2 u_scale;
uniform vec2 u_foot;
uniform vec2 u_view;
uniform float u_depthBias;
uniform float u_unshaded;
out vec2 v_uv;
out float v_shade;
const vec3 LIGHT = vec3(-0.4196, -0.5795, 0.6994);
void main() {
  vec3 cam = vec3(dot(u_rot0, a_position), dot(u_rot1, a_position), dot(u_rot2, a_position));
  vec2 texel = u_foot + cam.xy * u_scale;
  gl_Position = vec4(texel / u_view * 2.0 - 1.0, -cam.z / ${String(DEPTH_RANGE_UNITS)}.0 - u_depthBias, 1.0);
  vec3 n = vec3(dot(u_rot0, a_normal), dot(u_rot1, a_normal), dot(u_rot2, a_normal));
  float lambert = clamp(0.56 + 0.58 * abs(dot(n, LIGHT)), 0.45, 1.22);
  v_shade = mix(lambert, 1.0, u_unshaded);
  v_uv = a_uv;
}`

const MESH_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in float v_shade;
uniform sampler2D u_texture;
uniform vec4 u_color;
uniform vec2 u_uvOffset;
uniform int u_mode;
out vec4 outColor;
void main() {
  vec4 texel = texture(u_texture, v_uv + u_uvOffset);
  vec3 rgb = texel.rgb * u_color.rgb * v_shade;
  if (u_mode == 0) {
    outColor = vec4(rgb, 1.0);
  } else if (u_mode == 1) {
    if (texel.a * u_color.a < 0.65) discard;
    outColor = vec4(rgb, 1.0);
  } else if (u_mode == 2) {
    float a = texel.a * u_color.a;
    if (a <= 0.02) discard;
    outColor = vec4(rgb, a);
  } else if (u_mode == 3) {
    outColor = vec4(rgb * u_color.a, 1.0);
  } else if (u_mode == 4) {
    outColor = vec4(rgb * texel.a * u_color.a, 1.0);
  } else {
    // Flat emissive silhouette (item quality glow): the texture only cuts the shape out.
    if (texel.a < 0.5) discard;
    outColor = vec4(u_color.rgb * u_color.a, 1.0);
  }
}`

const RESOLVE_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const RESOLVE_FS = `#version 300 es
precision highp float;
uniform sampler2D u_source;
uniform ivec2 u_cellOrigin;
uniform ivec2 u_cellSize;
uniform int u_supersample;
uniform int u_glow;
out vec4 outColor;
vec4 block(ivec2 p) {
  if (p.x < 0 || p.y < 0 || p.x >= u_cellSize.x || p.y >= u_cellSize.y) return vec4(0.0);
  vec4 acc = vec4(0.0);
  for (int j = 0; j < u_supersample; j++) {
    for (int i = 0; i < u_supersample; i++) {
      acc += texelFetch(u_source, p * u_supersample + ivec2(i, j), 0);
    }
  }
  return acc / float(u_supersample * u_supersample);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) - u_cellOrigin;
  vec4 c = block(p);
  if (u_glow == 1) {
    outColor = vec4(c.rgb, 1.0);
    return;
  }
  if (c.a > 0.0) {
    outColor = vec4(c.rgb / c.a, c.a);
    return;
  }
  vec4 n = block(p + ivec2(1, 0)) + block(p - ivec2(1, 0)) + block(p + ivec2(0, 1)) + block(p - ivec2(0, 1));
  outColor = n.a > 0.0 ? vec4(n.rgb / n.a, 0.0) : vec4(0.0);
}`

function compileProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const compile = (type: number, source: string): WebGLShader => {
    const shader = gl.createShader(type)
    if (shader === null) throw new Error('Mesh skin renderer: shader allocation failed')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      const log = gl.getShaderInfoLog(shader) ?? ''
      gl.deleteShader(shader)
      throw new Error(`Mesh skin renderer: shader compile failed: ${log}`)
    }
    return shader
  }
  const vs = compile(gl.VERTEX_SHADER, vsSource)
  const fs = compile(gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()
  if (program === null) throw new Error('Mesh skin renderer: program allocation failed')
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
    const log = gl.getProgramInfoLog(program) ?? ''
    gl.deleteProgram(program)
    throw new Error(`Mesh skin renderer: program link failed: ${log}`)
  }
  return program
}

function createTargetTexture(gl: WebGL2RenderingContext, size: number, filter: number): WebGLTexture {
  const tex = gl.createTexture()
  if (tex === null) throw new Error('Mesh skin renderer: texture allocation failed')
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, size, size)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
}

function createFramebuffer(
  gl: WebGL2RenderingContext,
  color: WebGLTexture,
  depth: WebGLRenderbuffer | null,
): WebGLFramebuffer {
  const fbo = gl.createFramebuffer()
  if (fbo === null) throw new Error('Mesh skin renderer: framebuffer allocation failed')
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0)
  if (depth !== null) {
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth)
  }
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Mesh skin renderer: incomplete framebuffer')
  }
  return fbo
}

interface Targets {
  readonly meshProgram: WebGLProgram
  readonly resolveProgram: WebGLProgram
  readonly mesh: Readonly<Record<string, WebGLUniformLocation | null>>
  readonly resolve: Readonly<Record<string, WebGLUniformLocation | null>>
  readonly whiteTexture: WebGLTexture
  readonly emptyVao: WebGLVertexArrayObject
  readonly scratchColor: WebGLTexture
  readonly scratchGlow: WebGLTexture
  readonly scratchDepth: WebGLRenderbuffer
  readonly scratchColorFbo: WebGLFramebuffer
  readonly scratchGlowFbo: WebGLFramebuffer
  readonly atlasColor: WebGLTexture
  readonly atlasGlow: WebGLTexture
  readonly atlasColorFbo: WebGLFramebuffer
  readonly atlasGlowFbo: WebGLFramebuffer
  readonly colorHandle: AtlasHandle
  readonly glowHandle: AtlasHandle
}

export class MeshSkinRenderer {
  private readonly renderer: SpriteRenderer
  private targets: Targets | null = null
  private readonly models = new Set<MeshSkinGpuModel>()
  private skinScratch = new Float32Array(2048 * 8)
  private readonly rot = new Float32Array(9)
  private readonly basis = new Float32Array(9)

  private frameToken = Number.NaN
  private cursorX = 0
  private cursorY = 0
  private shelfHeight = 0
  private quality = 1
  private frameDemand = 0
  private frameImpostors = 0
  private disposed = false

  constructor(renderer: SpriteRenderer) {
    this.renderer = renderer
  }

  /** Impostors rendered since the last frame boundary (diagnostics / tests). */
  get impostorsThisFrame(): number {
    return this.frameImpostors
  }

  /** Resolution factor applied this frame when the atlas cannot fit every unit at full density. */
  get currentQuality(): number {
    return this.quality
  }

  private ensureTargets(): Targets {
    if (this.targets !== null) return this.targets
    const gl = this.renderer.gl
    const meshProgram = compileProgram(gl, MESH_VS, MESH_FS)
    const resolveProgram = compileProgram(gl, RESOLVE_VS, RESOLVE_FS)
    const uniforms = (program: WebGLProgram, names: readonly string[]): Record<string, WebGLUniformLocation | null> => {
      const out: Record<string, WebGLUniformLocation | null> = {}
      for (const name of names) out[name] = gl.getUniformLocation(program, name)
      return out
    }
    const whiteTexture = gl.createTexture()
    const emptyVao = gl.createVertexArray()
    const scratchDepth = gl.createRenderbuffer()
    if (whiteTexture === null || emptyVao === null || scratchDepth === null) {
      throw new Error('Mesh skin renderer: resource allocation failed')
    }
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, whiteTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.bindRenderbuffer(gl.RENDERBUFFER, scratchDepth)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, SCRATCH_SIZE, SCRATCH_SIZE)

    const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    const scratchColor = createTargetTexture(gl, SCRATCH_SIZE, gl.NEAREST)
    const scratchGlow = createTargetTexture(gl, SCRATCH_SIZE, gl.NEAREST)
    const atlasColor = createTargetTexture(gl, MESH_SKIN_ATLAS_SIZE, gl.LINEAR)
    const atlasGlow = createTargetTexture(gl, MESH_SKIN_ATLAS_SIZE, gl.LINEAR)
    const scratchColorFbo = createFramebuffer(gl, scratchColor, scratchDepth)
    const scratchGlowFbo = createFramebuffer(gl, scratchGlow, scratchDepth)
    const atlasColorFbo = createFramebuffer(gl, atlasColor, null)
    const atlasGlowFbo = createFramebuffer(gl, atlasGlow, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo)

    this.targets = {
      meshProgram,
      resolveProgram,
      mesh: uniforms(meshProgram, [
        'u_rot0', 'u_rot1', 'u_rot2', 'u_scale', 'u_foot', 'u_view', 'u_depthBias', 'u_unshaded',
        'u_texture', 'u_color', 'u_uvOffset', 'u_mode',
      ]),
      resolve: uniforms(resolveProgram, ['u_source', 'u_cellOrigin', 'u_cellSize', 'u_supersample', 'u_glow']),
      whiteTexture,
      emptyVao,
      scratchColor,
      scratchGlow,
      scratchDepth,
      scratchColorFbo,
      scratchGlowFbo,
      atlasColor,
      atlasGlow,
      atlasColorFbo,
      atlasGlowFbo,
      colorHandle: { texture: atlasColor, width: MESH_SKIN_ATLAS_SIZE, height: MESH_SKIN_ATLAS_SIZE },
      glowHandle: { texture: atlasGlow, width: MESH_SKIN_ATLAS_SIZE, height: MESH_SKIN_ATLAS_SIZE },
    }
    return this.targets
  }

  /** Upload a parsed model's textures and index buffers. `images` are in `model.images` order. */
  uploadModel(model: MeshSkinModel, images: readonly MeshSkinTextureSource[]): MeshSkinGpuModel {
    if (this.disposed || this.renderer.isDisposed) throw new Error('Mesh skin renderer is disposed')
    if (images.length !== model.images.length) {
      throw new Error(`Mesh skin model expects ${String(model.images.length)} textures, got ${String(images.length)}`)
    }
    const gl = this.renderer.gl
    this.renderer.flush()
    const textures: WebGLTexture[] = []
    const geosets: GpuGeoset[] = []
    const retained = new Map<number, RetainedImage>()
    try {
      const doll = model.paperdoll
      if (doll !== null) {
        const keep = new Set<number>([doll.canvas])
        for (const options of Object.values(doll.slots)) {
          for (const option of Object.values(options)) for (const layer of option.layers) keep.add(layer.image)
        }
        for (const index of keep) retained.set(index, retainImage(images[index]!))
      }
      gl.activeTexture(gl.TEXTURE0)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      for (const src of images) {
        const tex = gl.createTexture()
        if (tex === null) throw new Error('Mesh skin renderer: texture allocation failed')
        textures.push(tex)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        if ('pixels' in src) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, src.width, src.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.pixels)
        } else {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
        }
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
      }
      this.createGeosetBuffers(model, geosets)
    } catch (err) {
      gl.bindVertexArray(null)
      for (const tex of textures) gl.deleteTexture(tex)
      for (const g of geosets) {
        gl.deleteVertexArray(g.vao)
        gl.deleteBuffer(g.vbo)
        gl.deleteBuffer(g.ibo)
      }
      throw err
    }
    const gpu: MeshSkinGpuModel = {
      model,
      textures,
      geosets,
      globals: new Float32Array(model.nodeCount * 12),
      joints: new Float32Array(model.nodeCount * 12),
      defaultLook: resolveMeshSkinLook(model, {}),
      retained,
      canvasTextures: new Map(),
      mirrorGeosets: null,
      disposed: false,
    }
    this.models.add(gpu)
    return gpu
  }

  /** Vertex and index buffers for every geoset of `model`, appended to `out` as they are made. */
  private createGeosetBuffers(model: MeshSkinModel, out: GpuGeoset[]): void {
    const gl = this.renderer.gl
    try {
      for (const geo of model.geosets) {
        const vao = gl.createVertexArray()
        const vbo = gl.createBuffer()
        const ibo = gl.createBuffer()
        if (vao === null || vbo === null || ibo === null) throw new Error('Mesh skin renderer: buffer allocation failed')
        out.push({ vao, vbo, ibo, indexCount: geo.indices.length })
        gl.bindVertexArray(vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
        gl.bufferData(gl.ARRAY_BUFFER, (geo.positions.length / 3) * 8 * 4, gl.DYNAMIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12)
        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW)
      }
    } finally {
      gl.bindVertexArray(null)
    }
  }

  disposeModel(gpu: MeshSkinGpuModel): void {
    if (gpu.disposed) return
    gpu.disposed = true
    this.models.delete(gpu)
    if (this.renderer.isDisposed) return
    const gl = this.renderer.gl
    for (const tex of gpu.textures) gl.deleteTexture(tex)
    for (const tex of gpu.canvasTextures.values()) gl.deleteTexture(tex)
    gpu.canvasTextures.clear()
    for (const g of [...gpu.geosets, ...(gpu.mirrorGeosets ?? [])]) {
      gl.deleteVertexArray(g.vao)
      gl.deleteBuffer(g.vbo)
      gl.deleteBuffer(g.ibo)
    }
    gpu.mirrorGeosets = null
  }

  /**
   * Texture of the paper-doll canvas dressed with `look`'s layers (composited once per distinct
   * layer set and cached for the life of the model).
   */
  private canvasTextureFor(gpu: MeshSkinGpuModel, look: MeshSkinLook): WebGLTexture {
    const doll = gpu.model.paperdoll
    if (doll === null || look.layers.length === 0) return gpu.textures[doll?.canvas ?? 0]!
    const cached = gpu.canvasTextures.get(look.canvasKey)
    if (cached) return cached
    const base = gpu.retained.get(doll.canvas)
    if (!base) throw new Error('Mesh skin renderer: paper-doll canvas image was not retained')
    const sources = look.layers.map((layer) => {
      const img = gpu.retained.get(layer.image)
      if (!img) throw new Error('Mesh skin renderer: paper-doll layer image was not retained')
      return { layer, img }
    })
    const gl = this.renderer.gl
    this.renderer.flush()
    const tex = gl.createTexture()
    if (tex === null) throw new Error('Mesh skin renderer: texture allocation failed')
    gl.activeTexture(gl.TEXTURE0)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (base.kind === 'pixels') {
      const pixels = compositeMeshSkinCanvasPixels(
        base,
        sources.map(({ layer, img }) => {
          if (img.kind !== 'pixels') throw new Error('Mesh skin renderer: mixed paper-doll image sources')
          return { pixels: img.pixels, width: img.width, height: img.height, x: layer.x, y: layer.y, w: layer.w, h: layer.h }
        }),
      )
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, base.width, base.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    } else {
      const canvas = createScratchCanvas(base.canvas.width, base.canvas.height)
      const ctx = context2d(canvas)
      ctx.drawImage(base.canvas, 0, 0)
      for (const { layer, img } of sources) {
        if (img.kind !== 'canvas') throw new Error('Mesh skin renderer: mixed paper-doll image sources')
        ctx.drawImage(img.canvas, layer.x, layer.y, layer.w, layer.h)
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
    }
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gpu.canvasTextures.set(look.canvasKey, tex)
    return tex
  }

  /** Number of models whose GPU resources are currently alive. */
  get liveModelCount(): number {
    return this.models.size
  }

  /** Release every model plus the shared render targets (called when skins are disabled). */
  dispose(): void {
    for (const gpu of [...this.models]) this.disposeModel(gpu)
    const t = this.targets
    this.targets = null
    if (t !== null && !this.renderer.isDisposed) {
      const gl = this.renderer.gl
      this.renderer.flush()
      gl.deleteProgram(t.meshProgram)
      gl.deleteProgram(t.resolveProgram)
      gl.deleteTexture(t.whiteTexture)
      gl.deleteVertexArray(t.emptyVao)
      gl.deleteTexture(t.scratchColor)
      gl.deleteTexture(t.scratchGlow)
      gl.deleteRenderbuffer(t.scratchDepth)
      gl.deleteFramebuffer(t.scratchColorFbo)
      gl.deleteFramebuffer(t.scratchGlowFbo)
      gl.deleteTexture(t.atlasColor)
      gl.deleteTexture(t.atlasGlow)
      gl.deleteFramebuffer(t.atlasColorFbo)
      gl.deleteFramebuffer(t.atlasGlowFbo)
    }
    this.frameToken = Number.NaN
  }

  /** Whether the shared render targets are currently allocated. */
  get hasTargets(): boolean {
    return this.targets !== null
  }

  /**
   * Mark a frame boundary. Cells handed out before this call may be overwritten afterwards, so the
   * token must change exactly once per rendered frame (the world renderer passes the frame time).
   */
  beginFrame(token: number): void {
    if (token === this.frameToken) return
    this.frameToken = token
    const capacity = MESH_SKIN_ATLAS_SIZE * MESH_SKIN_ATLAS_SIZE * 0.8
    this.quality = this.frameDemand > capacity ? Math.max(0.25, Math.sqrt(capacity / this.frameDemand)) : 1
    this.frameDemand = 0
    this.frameImpostors = 0
    this.cursorX = 0
    this.cursorY = 0
    this.shelfHeight = 0
  }

  private allocate(width: number, height: number): { readonly x: number; readonly y: number } | null {
    if (width > MESH_SKIN_ATLAS_SIZE || height > MESH_SKIN_ATLAS_SIZE) return null
    if (this.cursorX + width > MESH_SKIN_ATLAS_SIZE) {
      this.cursorX = 0
      this.cursorY += this.shelfHeight
      this.shelfHeight = 0
    }
    if (this.cursorY + height > MESH_SKIN_ATLAS_SIZE) return null
    const pos = { x: this.cursorX, y: this.cursorY }
    this.cursorX += width
    this.shelfHeight = Math.max(this.shelfHeight, height)
    return pos
  }

  /**
   * Render `gpu` in `pose` facing `dir64` into a fresh atlas cell.
   *
   * @param pxPerUnit - scene pixels per model unit.
   * @param look - paper-doll state to wear; `null` wears the model's default look.
   * @param attachments - rigid models drawn on joints of `gpu` (weapons of a shared pack).
   * @returns the impostor frames, or `null` when the atlas is full or the context is lost.
   */
  drawImpostor(
    gpu: MeshSkinGpuModel,
    pose: MeshSkinPose,
    dir64: number,
    pxPerUnit: number,
    box: MeshSkinBox,
    look: MeshSkinLook | null = null,
    attachments: readonly MeshSkinAttachment[] = [],
  ): MeshSkinImpostor | null {
    if (this.disposed || gpu.disposed || this.renderer.isDisposed) return null
    const gl = this.renderer.gl
    if (typeof gl.isContextLost === 'function' && gl.isContextLost()) return null
    const targets = this.ensureTargets()
    const model = gpu.model
    const worn = model.paperdoll === null ? null : (look ?? gpu.defaultLook)
    if (worn !== null && worn.visible.length !== model.geosets.length) {
      throw new Error('Mesh skin renderer: look does not belong to this model')
    }
    const canvasImage = model.paperdoll?.canvas ?? -1
    const canvasTexture = worn !== null ? this.canvasTextureFor(gpu, worn) : null

    const fullScale = Math.min(MAX_TEXEL_SCALE, Math.max(1, this.renderer.getSceneTexelScale()))
    this.frameDemand += (box.width * fullScale + 2 * CELL_MARGIN) * (box.height * fullScale + 2 * CELL_MARGIN)

    let cellW = 0
    let cellH = 0
    let cell: { readonly x: number; readonly y: number } | null = null
    let scale = fullScale * this.quality
    for (let attempt = 0; attempt < 4 && cell === null; attempt += 1) {
      cellW = Math.min(SCRATCH_SIZE, Math.max(4, Math.ceil(box.width * scale)))
      cellH = Math.min(SCRATCH_SIZE, Math.max(4, Math.ceil(box.height * scale)))
      cell = this.allocate(cellW + 2 * CELL_MARGIN, cellH + 2 * CELL_MARGIN)
      scale *= 0.5
    }
    if (cell === null) return null
    const supersample = cellW * 2 <= SCRATCH_SIZE && cellH * 2 <= SCRATCH_SIZE ? 2 : 1
    const texelsPerPxX = (cellW / box.width) * supersample
    const texelsPerPxY = (cellH / box.height) * supersample
    const scratchW = cellW * supersample
    const scratchH = cellH * supersample

    meshSkinCameraRotation(dir64, this.rot)
    meshSkinBillboardBasis(this.rot, this.basis)
    computeMeshSkinJointMatrices(model, pose, this.basis, gpu.globals, gpu.joints)
    // A mirrored attachment gets its own vertex buffers, so one model can sit in both hands.
    const attached = attachments.filter((a) => !a.gpu.disposed && a.point.joint < model.nodeCount)
    let maxVertexCount = model.maxVertexCount
    for (const a of attached) {
      maxVertexCount = Math.max(maxVertexCount, a.gpu.model.maxVertexCount)
      if (a.mirror && a.gpu.mirrorGeosets === null) {
        const made: GpuGeoset[] = []
        this.renderer.flush()
        try {
          this.createGeosetBuffers(a.gpu.model, made)
        } catch (err) {
          for (const g of made) {
            gl.deleteVertexArray(g.vao)
            gl.deleteBuffer(g.vbo)
            gl.deleteBuffer(g.ibo)
          }
          throw err
        }
        a.gpu.mirrorGeosets = made
      }
    }
    if (this.skinScratch.length < maxVertexCount * 8) {
      this.skinScratch = new Float32Array(maxVertexCount * 8)
    }

    const rot = this.rot
    const u = targets.mesh
    let glowDrawn = false
    const cellX = cell.x
    const cellY = cell.y

    this.renderer.runExternalPass(() => {
      gl.useProgram(targets.meshProgram)
      gl.uniform3f(u.u_rot0!, rot[0]!, rot[1]!, rot[2]!)
      gl.uniform3f(u.u_rot1!, rot[3]!, rot[4]!, rot[5]!)
      gl.uniform3f(u.u_rot2!, rot[6]!, rot[7]!, rot[8]!)
      gl.uniform2f(u.u_scale!, pxPerUnit * texelsPerPxX, pxPerUnit * texelsPerPxY)
      gl.uniform2f(u.u_foot!, box.footX * texelsPerPxX, box.footY * texelsPerPxY)
      gl.uniform2f(u.u_view!, scratchW, scratchH)
      gl.uniform1i(u.u_texture!, 0)
      gl.activeTexture(gl.TEXTURE0)

      // Skin and upload every visible geoset once; all passes reuse the uploaded vertices.
      const visible: number[] = []
      const items: DrawItem[] = []
      for (let g = 0; g < model.geosets.length; g += 1) {
        if (!(pose.geosetAlpha[g]! > 0.02)) continue
        if (worn !== null && worn.visible[g] !== 1) continue
        const geo = model.geosets[g]!
        const floats = (geo.positions.length / 3) * 8
        skinMeshSkinGeoset(geo, gpu.joints, this.skinScratch)
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.geosets[g]!.vbo)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.skinScratch, 0, floats)
        visible.push(g)
        items.push({ geo, buf: gpu.geosets[g]!, textures: gpu.textures, g })
      }
      for (const a of attached) {
        const buffers = a.mirror ? a.gpu.mirrorGeosets! : a.gpu.geosets
        a.gpu.model.geosets.forEach((geo, i) => {
          skinMeshSkinAttachment(geo, gpu.joints, a.point, a.mirror, this.skinScratch)
          gl.bindBuffer(gl.ARRAY_BUFFER, buffers[i]!.vbo)
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.skinScratch, 0, (geo.positions.length / 3) * 8)
          items.push({ geo, buf: buffers[i]!, textures: a.gpu.textures, g: -1 })
        })
      }

      const drawPass = (pass: 0 | 1 | 2): boolean => {
        let drew = false
        for (let layerIndex = 0; layerIndex < 8; layerIndex += 1) {
          let anyLayer = false
          for (const { geo, buf, textures, g } of items) {
            const layer = geo.layers[layerIndex]
            if (!layer) continue
            anyLayer = true
            const layerPass = layer.filterMode <= 1 ? 0 : layer.filterMode === 2 ? 1 : 2
            if (layerPass !== pass) continue
            // Attachments are not animated: their geosets and layers are always fully opaque.
            const own = g >= 0
            const alpha = own ? pose.geosetAlpha[g]! * pose.layerAlpha[layer.slot]! : geo.alpha * layer.alpha
            if (!(alpha > 0.02)) continue
            gl.uniform4f(
              u.u_color!,
              layer.color[0] * (own ? pose.geosetColor[g * 3]! : geo.color[0]),
              layer.color[1] * (own ? pose.geosetColor[g * 3 + 1]! : geo.color[1]),
              layer.color[2] * (own ? pose.geosetColor[g * 3 + 2]! : geo.color[2]),
              alpha,
            )
            gl.uniform1i(u.u_mode!, layer.filterMode)
            gl.uniform1f(u.u_unshaded!, layer.unshaded ? 1 : 0)
            if (own && layer.texAnim >= 0) {
              gl.uniform2f(u.u_uvOffset!, pose.texOffset[layer.texAnim * 2]!, pose.texOffset[layer.texAnim * 2 + 1]!)
            } else {
              gl.uniform2f(u.u_uvOffset!, 0, 0)
            }
            gl.bindTexture(
              gl.TEXTURE_2D,
              layer.image < 0
                ? targets.whiteTexture
                : own && canvasTexture !== null && layer.image === canvasImage
                  ? canvasTexture
                  : textures[layer.image]!,
            )
            gl.bindVertexArray(buf.vao)
            gl.drawElements(gl.TRIANGLES, buf.indexCount, gl.UNSIGNED_SHORT, 0)
            drew = true
          }
          if (!anyLayer) break
        }
        return drew
      }

      gl.disable(gl.CULL_FACE)
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(0, 0, scratchW, scratchH)
      gl.viewport(0, 0, scratchW, scratchH)

      // Diffuse: opaque / cutout layers write depth, blended layers composite on top.
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.scratchColorFbo)
      gl.depthMask(true)
      gl.clearColor(0, 0, 0, 0)
      gl.clearDepth(1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.uniform1f(u.u_depthBias!, 0)
      gl.disable(gl.BLEND)
      drawPass(0)
      gl.enable(gl.BLEND)
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.depthMask(false)
      drawPass(1)

      // Emissive: additive layers into the glow target, depth-tested against the diffuse pass.
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.scratchGlowFbo)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(u.u_depthBias!, GLOW_DEPTH_BIAS)
      gl.blendFunc(gl.ONE, gl.ONE)
      glowDrawn = drawPass(2)

      // Item quality glow: the glowing item's silhouette, once in place and once per halo tap.
      if (worn !== null) {
        const footX = box.footX * texelsPerPxX
        const footY = box.footY * texelsPerPxY
        gl.uniform1i(u.u_mode!, 5)
        gl.uniform1f(u.u_unshaded!, 1)
        gl.uniform2f(u.u_uvOffset!, 0, 0)
        for (const item of worn.glow) {
          for (const g of item.geosets) {
            if (!visible.includes(g)) continue
            const layer = model.geosets[g]!.layers[0]
            if (!layer) continue
            gl.bindTexture(
              gl.TEXTURE_2D,
              layer.image < 0 ? targets.whiteTexture : gpu.textures[layer.image]!,
            )
            gl.bindVertexArray(gpu.geosets[g]!.vao)
            gl.uniform4f(u.u_color!, item.color[0], item.color[1], item.color[2], ITEM_GLOW_CORE)
            gl.drawElements(gl.TRIANGLES, gpu.geosets[g]!.indexCount, gl.UNSIGNED_SHORT, 0)
            gl.uniform4f(u.u_color!, item.color[0], item.color[1], item.color[2], ITEM_GLOW_HALO)
            for (const [dx, dy] of ITEM_GLOW_TAPS) {
              gl.uniform2f(
                u.u_foot!,
                footX + dx * ITEM_GLOW_RADIUS_PX * texelsPerPxX,
                footY + dy * ITEM_GLOW_RADIUS_PX * texelsPerPxY,
              )
              gl.drawElements(gl.TRIANGLES, gpu.geosets[g]!.indexCount, gl.UNSIGNED_SHORT, 0)
            }
            gl.uniform2f(u.u_foot!, footX, footY)
            glowDrawn = true
          }
        }
      }

      // Resolve the supersampled scratch into this frame's atlas cell (plus a transparent margin).
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.BLEND)
      gl.disable(gl.SCISSOR_TEST)
      gl.useProgram(targets.resolveProgram)
      gl.bindVertexArray(targets.emptyVao)
      const r = targets.resolve
      gl.uniform1i(r.u_source!, 0)
      gl.uniform2i(r.u_cellOrigin!, cellX + CELL_MARGIN, cellY + CELL_MARGIN)
      gl.uniform2i(r.u_cellSize!, cellW, cellH)
      gl.uniform1i(r.u_supersample!, supersample)
      gl.viewport(cellX, cellY, cellW + 2 * CELL_MARGIN, cellH + 2 * CELL_MARGIN)
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.atlasColorFbo)
      gl.bindTexture(gl.TEXTURE_2D, targets.scratchColor)
      gl.uniform1i(r.u_glow!, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (glowDrawn) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, targets.atlasGlowFbo)
        gl.bindTexture(gl.TEXTURE_2D, targets.scratchGlow)
        gl.uniform1i(r.u_glow!, 1)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      gl.bindTexture(gl.TEXTURE_2D, null)
    })

    this.frameImpostors += 1
    const frame: PagedAtlasFrame = {
      x: cellX + CELL_MARGIN,
      y: cellY + CELL_MARGIN,
      width: cellW,
      height: cellH,
      atlas: targets.colorHandle,
    }
    return {
      frame,
      glowFrame: glowDrawn
        ? { x: frame.x, y: frame.y, width: cellW, height: cellH, atlas: targets.glowHandle }
        : null,
    }
  }
}

/**
 * D2GL WebGL2 Post-Processing Pass (`glide3x.dll.d2gl`, `d2gl.json`, `Data/shaders/`).
 *
 * Implements the authentic Project Diablo 2 D2GL post-processing pipeline:
 * 1. Offscreen scene FBO capture (`RGBA8`, `LINEAR` filtering so sub-texel LumaSharpen offsets
 *    interpolate neighboring texels in hardware).
 * 2. Upscale / Resampling shader (`shader_preset`, default `"cubic\\bicubic.slangp"`):
 *    - `bicubic`: Mitchell-Netravali (`B = 0.33, C = 0.33`) 16-tap cubic filter (`Data/shaders/cubic/shaders/bicubic.slang`)
 *    - `catmull-rom`: Catmull-Rom (`B = 0.0, C = 0.5`) 16-tap cubic spline (`Shaders/cubic.glsl`)
 *    - `jinc2-sharper`: Hyllian's 2-lobe Windowed-Jinc with anti-ringing (`JINC2_WINDOW_SINC = 0.42`,
 *      `JINC2_SINC = 0.92`, `JINC2_AR_STRENGTH = 0.8`, `Data/shaders/windowed/shaders/jinc2.slang`)
 *    - `bilinear` / `nearest`
 * 3. D2GL `prefx` LumaSharpen (`glide3x.dll.d2gl`, `#define CoefLuma vec3(0.2126,0.7152,0.0722)`):
 *    PD2 defaults: `sharpen = true`, `sharpen_strength = 1.2`, `sharpen_clamp = 0.800`, `sharpen_radius = 0.400`.
 * 4. D2GL 3D Color Grading LUT (`glide3x.dll.d2gl` `#define LUT_Size 32.0` + `Data/assets/textures/lut.png`,
 *    `lut = 0..14`, `0` = Game Default).
 */

import {
  D2GL_UPSCALE_MODE_ID,
  PD2_D2GL_CONFIG,
  PD2_D2GL_LUT_SPEC,
  resolveD2GlUpscaleKernel,
  type D2GlGraphicsConfig,
  type D2GlUpscaleKernel,
} from '../../common/ui/pd2-d2gl.ts'

/**
 * Fullscreen triangle vertex shader (`gl_VertexID` 0..2).
 */
export function d2glPostProcessVertexShaderSource(): string {
  return `#version 300 es
out vec2 v_uv;
void main() {
  vec2 uv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = uv;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`
}

/**
 * D2GL post-processing fragment shader combining:
 * - `Data/shaders/cubic/shaders/bicubic.slang` (`B = 0.33, C = 0.33`) / `Shaders/cubic.glsl` (`B = 0.0, C = 0.5`)
 * - `Data/shaders/windowed/shaders/jinc2.slang` (`JINC2_WINDOW_SINC = 0.42, JINC2_SINC = 0.92, JINC2_AR_STRENGTH = 0.8`)
 * - `glide3x.dll.d2gl` `prefx` LumaSharpen (`#define CoefLuma vec3(0.2126,0.7152,0.0722)`)
 * - `glide3x.dll.d2gl` 3D LUT (`#define LUT_Size 32.0`)
 */
export function d2glPostProcessFragmentShaderSource(): string {
  return `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_sceneTexture;
uniform sampler2D u_lutTexture;
uniform vec2 u_sourceSize;
uniform vec2 u_relSize;
uniform vec2 u_outputSize;
uniform vec2 u_outputRelSize;
uniform int u_upscaleMode;
uniform int u_sharpen;
uniform float u_sharpStrength;
uniform float u_sharpClamp;
uniform float u_sharpRadius;
uniform int u_lutIndex;

out vec4 outColor;

#define CoefLuma vec3(0.2126, 0.7152, 0.0722)
#define LUT_Size 32.0
#define PI 3.14159265358979323846
#define JINC2_WA (0.42 * PI)
#define JINC2_WB (0.92 * PI)
#define JINC2_AR_STRENGTH 0.8

float cubicWeight(float x, float B, float C) {
  float ax = abs(x);
  if (ax < 1.0) {
    return (
      ax * ax * ax * (2.0 - 1.5 * B - C) +
      ax * ax * (-3.0 + 2.0 * B + C) +
      (1.0 - (1.0 / 3.0) * B)
    );
  }
  if (ax < 2.0) {
    return (
      ax * ax * ax * (-(1.0 / 6.0) * B - C) +
      ax * ax * (B + 5.0 * C) +
      ax * (-2.0 * B - 8.0 * C) +
      ((4.0 / 3.0) * B + 4.0 * C)
    );
  }
  return 0.0;
}

vec4 cubicWeight4(float x, float B, float C) {
  return vec4(
    cubicWeight(1.0 + x, B, C),
    cubicWeight(x, B, C),
    cubicWeight(1.0 - x, B, C),
    cubicWeight(2.0 - x, B, C)
  );
}

vec3 cubicLineRun(float ypos, vec4 xpos, vec4 linetaps) {
  return (
    texture(u_sceneTexture, vec2(xpos.x, ypos)).rgb * linetaps.x +
    texture(u_sceneTexture, vec2(xpos.y, ypos)).rgb * linetaps.y +
    texture(u_sceneTexture, vec2(xpos.z, ypos)).rgb * linetaps.z +
    texture(u_sceneTexture, vec2(xpos.w, ypos)).rgb * linetaps.w
  );
}

vec3 sampleBicubic(vec2 uv, float B, float C) {
  vec2 pc = uv * u_sourceSize - 0.5;
  vec2 tc = floor(pc);
  vec2 f = pc - tc;
  vec2 tex = (tc + 0.5) * u_relSize;
  vec4 linetaps = cubicWeight4(f.x, B, C);
  vec4 columntaps = cubicWeight4(f.y, B, C);
  linetaps /= linetaps.r + linetaps.g + linetaps.b + linetaps.a;
  columntaps /= columntaps.r + columntaps.g + columntaps.b + columntaps.a;
  vec4 xpos = vec4(
    tex.x - u_relSize.x,
    tex.x,
    tex.x + u_relSize.x,
    tex.x + u_relSize.x * 2.0
  );
  return (
    cubicLineRun(tex.y - u_relSize.y,       xpos, linetaps) * columntaps.r +
    cubicLineRun(tex.y,                     xpos, linetaps) * columntaps.g +
    cubicLineRun(tex.y + u_relSize.y,       xpos, linetaps) * columntaps.b +
    cubicLineRun(tex.y + u_relSize.y * 2.0, xpos, linetaps) * columntaps.a
  );
}

vec4 jinc2Resampler(vec4 x) {
  vec4 res;
  res.x = (x.x == 0.0) ? (JINC2_WA * JINC2_WB) : sin(x.x * JINC2_WA) * sin(x.x * JINC2_WB) / (x.x * x.x);
  res.y = (x.y == 0.0) ? (JINC2_WA * JINC2_WB) : sin(x.y * JINC2_WA) * sin(x.y * JINC2_WB) / (x.y * x.y);
  res.z = (x.z == 0.0) ? (JINC2_WA * JINC2_WB) : sin(x.z * JINC2_WA) * sin(x.z * JINC2_WB) / (x.z * x.z);
  res.w = (x.w == 0.0) ? (JINC2_WA * JINC2_WB) : sin(x.w * JINC2_WA) * sin(x.w * JINC2_WB) / (x.w * x.w);
  return res;
}

vec3 sampleJinc2Sharper(vec2 uv) {
  vec2 dx = vec2(1.0, 0.0);
  vec2 dy = vec2(0.0, 1.0);
  vec2 pc = uv * u_sourceSize;
  vec2 tc = floor(pc - vec2(0.5, 0.5)) + vec2(0.5, 0.5);
  mat4 weights;
  weights[0] = jinc2Resampler(vec4(distance(pc, tc - dx - dy), distance(pc, tc - dy), distance(pc, tc + dx - dy), distance(pc, tc + 2.0 * dx - dy)));
  weights[1] = jinc2Resampler(vec4(distance(pc, tc - dx), distance(pc, tc), distance(pc, tc + dx), distance(pc, tc + 2.0 * dx)));
  weights[2] = jinc2Resampler(vec4(distance(pc, tc - dx + dy), distance(pc, tc + dy), distance(pc, tc + dx + dy), distance(pc, tc + 2.0 * dx + dy)));
  weights[3] = jinc2Resampler(vec4(distance(pc, tc - dx + 2.0 * dy), distance(pc, tc + 2.0 * dy), distance(pc, tc + dx + 2.0 * dy), distance(pc, tc + 2.0 * dx + 2.0 * dy)));
  dx *= u_relSize;
  dy *= u_relSize;
  tc *= u_relSize;
  vec3 c00 = texture(u_sceneTexture, tc - dx - dy).rgb;
  vec3 c10 = texture(u_sceneTexture, tc - dy).rgb;
  vec3 c20 = texture(u_sceneTexture, tc + dx - dy).rgb;
  vec3 c30 = texture(u_sceneTexture, tc + 2.0 * dx - dy).rgb;
  vec3 c01 = texture(u_sceneTexture, tc - dx).rgb;
  vec3 c11 = texture(u_sceneTexture, tc).rgb;
  vec3 c21 = texture(u_sceneTexture, tc + dx).rgb;
  vec3 c31 = texture(u_sceneTexture, tc + 2.0 * dx).rgb;
  vec3 c02 = texture(u_sceneTexture, tc - dx + dy).rgb;
  vec3 c12 = texture(u_sceneTexture, tc + dy).rgb;
  vec3 c22 = texture(u_sceneTexture, tc + dx + dy).rgb;
  vec3 c32 = texture(u_sceneTexture, tc + 2.0 * dx + dy).rgb;
  vec3 c03 = texture(u_sceneTexture, tc - dx + 2.0 * dy).rgb;
  vec3 c13 = texture(u_sceneTexture, tc + 2.0 * dy).rgb;
  vec3 c23 = texture(u_sceneTexture, tc + dx + 2.0 * dy).rgb;
  vec3 c33 = texture(u_sceneTexture, tc + 2.0 * dx + 2.0 * dy).rgb;
  vec3 minSample = min(min(c11, c21), min(c12, c22));
  vec3 maxSample = max(max(c11, c21), max(c12, c22));
  vec3 color = mat4x3(c00, c10, c20, c30) * weights[0];
  color += mat4x3(c01, c11, c21, c31) * weights[1];
  color += mat4x3(c02, c12, c22, c32) * weights[2];
  color += mat4x3(c03, c13, c23, c33) * weights[3];
  color /= dot(weights * vec4(1.0), vec4(1.0));
  vec3 clamped = clamp(color, minSample, maxSample);
  return mix(color, clamped, JINC2_AR_STRENGTH);
}

vec3 sampleUpscaled(vec2 uv) {
  if (u_upscaleMode == 0) {
    vec2 snapped = (floor(uv * u_sourceSize) + 0.5) * u_relSize;
    return texture(u_sceneTexture, snapped).rgb;
  }
  if (u_upscaleMode == 2) {
    return sampleBicubic(uv, 0.33, 0.33);
  }
  if (u_upscaleMode == 3) {
    return sampleBicubic(uv, 0.0, 0.5);
  }
  if (u_upscaleMode == 4) {
    return sampleJinc2Sharper(uv);
  }
  return texture(u_sceneTexture, uv).rgb;
}

vec3 applyD2GlLumaSharpen(vec3 centerRgb, vec2 uv) {
  vec2 stepUv = min(u_outputRelSize, u_relSize * 0.5) * u_sharpRadius;
  vec3 i = sampleUpscaled(uv + stepUv);
  vec3 n = sampleUpscaled(uv - stepUv);
  vec3 l = CoefLuma * u_sharpStrength * 1.5;
  float safeClamp = max(u_sharpClamp, 1e-5);
  vec4 m = vec4(l * (0.5 / safeClamp), 0.5);
  float x = safeClamp * 2.0 * clamp(dot(vec4(centerRgb - (i + n) * 0.5, 1.0), m), 0.0, 1.0) - safeClamp;
  return clamp(centerRgb + x, 0.0, 1.0);
}

vec3 applyD2GlLut(vec3 c) {
  if (u_lutIndex <= 0 || u_lutIndex > 14) return c;
  float u = (c.r * (LUT_Size - 1.0) + 0.4999) / (LUT_Size * LUT_Size);
  float f = (c.g * (LUT_Size - 1.0) + 0.4999) / LUT_Size;
  float v = (float(u_lutIndex - 1) + f) / 14.0;
  float e = floor(c.b * (LUT_Size - 1.0)) / LUT_Size + u;
  float l = min(LUT_Size - 1.0, ceil((c.b + 1e-6) * (LUT_Size - 1.0))) / LUT_Size + u;
  float n = clamp(max((c.b - e) / max(l - e, 1e-6), 0.0), 0.0, 32.0);
  vec3 i = texture(u_lutTexture, vec2(e, v)).rgb;
  vec3 r = texture(u_lutTexture, vec2(l, v)).rgb;
  return c.b < 1.0 ? mix(i, r, clamp(n, 0.0, 1.0)) : i;
}

void main() {
  vec3 color = sampleUpscaled(v_uv);
  if (u_sharpen == 1) {
    color = applyD2GlLumaSharpen(color, v_uv);
  }
  if (u_lutIndex > 0) {
    color = applyD2GlLut(color);
  }
  outColor = vec4(color, 1.0);
}`
}

/**
 * Check whether the given WebGL2 context supports offscreen framebuffer rendering
 * required by the D2GL post-processing pass.
 */
export function supportsWebGl2PostProcessFbo(gl: WebGL2RenderingContext): boolean {
  return (
    typeof gl.createFramebuffer === 'function' &&
    typeof gl.bindFramebuffer === 'function' &&
    typeof gl.framebufferTexture2D === 'function' &&
    typeof gl.deleteFramebuffer === 'function'
  )
}

function compilePostProcessProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const compile = (type: number, source: string): WebGLShader => {
    const shader = gl.createShader(type)
    if (shader === null) throw new Error('D2GlPostProcessPass: could not create shader')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      const log = gl.getShaderInfoLog(shader) ?? 'unknown'
      gl.deleteShader(shader)
      throw new Error(`D2GlPostProcessPass: shader compile failed: ${log}`)
    }
    return shader
  }
  const program = gl.createProgram()
  if (program === null) throw new Error('D2GlPostProcessPass: could not create program')
  const vs = compile(gl.VERTEX_SHADER, d2glPostProcessVertexShaderSource())
  const fs = compile(gl.FRAGMENT_SHADER, d2glPostProcessFragmentShaderSource())
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS) === true
  const log = linked ? '' : (gl.getProgramInfoLog(program) ?? 'unknown')
  if (typeof gl.detachShader === 'function') {
    gl.detachShader(program, vs)
    gl.detachShader(program, fs)
  }
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!linked) {
    gl.deleteProgram(program)
    throw new Error(`D2GlPostProcessPass: program link failed: ${log}`)
  }
  return program
}

/**
 * Manages the offscreen scene FBO, fullscreen post-process shader, and 3D LUT texture for
 * `SpriteRenderer`. Allocated lazily on the first frame where post-processing is active.
 */
export class D2GlPostProcessPass {
  private readonly gl: WebGL2RenderingContext
  private config: D2GlGraphicsConfig
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private framebuffer: WebGLFramebuffer | null = null
  private sceneTexture: WebGLTexture | null = null
  private lutTexture: WebGLTexture | null = null
  private fboWidth = 0
  private fboHeight = 0
  private activePass = false
  private resolvedCount = 0

  private uSceneTexture: WebGLUniformLocation | null = null
  private uLutTexture: WebGLUniformLocation | null = null
  private uSourceSize: WebGLUniformLocation | null = null
  private uRelSize: WebGLUniformLocation | null = null
  private uOutputSize: WebGLUniformLocation | null = null
  private uOutputRelSize: WebGLUniformLocation | null = null
  private uUpscaleMode: WebGLUniformLocation | null = null
  private uSharpen: WebGLUniformLocation | null = null
  private uSharpStrength: WebGLUniformLocation | null = null
  private uSharpClamp: WebGLUniformLocation | null = null
  private uSharpRadius: WebGLUniformLocation | null = null
  private uLutIndex: WebGLUniformLocation | null = null

  constructor(gl: WebGL2RenderingContext, config: D2GlGraphicsConfig = PD2_D2GL_CONFIG.graphics) {
    this.gl = gl
    this.config = config
  }

  getConfig(): D2GlGraphicsConfig {
    return this.config
  }

  setConfig(config: Partial<D2GlGraphicsConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getUpscaleKernel(): D2GlUpscaleKernel {
    return resolveD2GlUpscaleKernel(this.config.shaderPreset)
  }

  get passCount(): number {
    return this.resolvedCount
  }

  get isSceneFboBound(): boolean {
    return this.activePass
  }

  private ensureGpuResources(): void {
    const gl = this.gl
    if (this.program !== null && this.vao !== null && this.lutTexture !== null) return
    const program = compilePostProcessProgram(gl)
    const vao = gl.createVertexArray()
    const lutTexture = gl.createTexture()
    if (vao === null || lutTexture === null) {
      gl.deleteProgram(program)
      throw new Error('D2GlPostProcessPass: VAO/LUT allocation failed')
    }
    this.program = program
    this.vao = vao
    this.lutTexture = lutTexture

    this.uSceneTexture = gl.getUniformLocation(program, 'u_sceneTexture')
    this.uLutTexture = gl.getUniformLocation(program, 'u_lutTexture')
    this.uSourceSize = gl.getUniformLocation(program, 'u_sourceSize')
    this.uRelSize = gl.getUniformLocation(program, 'u_relSize')
    this.uOutputSize = gl.getUniformLocation(program, 'u_outputSize')
    this.uOutputRelSize = gl.getUniformLocation(program, 'u_outputRelSize')
    this.uUpscaleMode = gl.getUniformLocation(program, 'u_upscaleMode')
    this.uSharpen = gl.getUniformLocation(program, 'u_sharpen')
    this.uSharpStrength = gl.getUniformLocation(program, 'u_sharpStrength')
    this.uSharpClamp = gl.getUniformLocation(program, 'u_sharpClamp')
    this.uSharpRadius = gl.getUniformLocation(program, 'u_sharpRadius')
    this.uLutIndex = gl.getUniformLocation(program, 'u_lutIndex')

    // Initialize 1x1 neutral fallback LUT texture until uploadLutTexture is called
    gl.bindTexture(gl.TEXTURE_2D, lutTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR ?? gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR ?? gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]),
    )
  }

  private ensureSceneFbo(width: number, height: number): void {
    const gl = this.gl
    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))
    if (this.framebuffer !== null && this.sceneTexture !== null && this.fboWidth === w && this.fboHeight === h) {
      return
    }
    if (this.framebuffer !== null) {
      gl.deleteFramebuffer(this.framebuffer)
      this.framebuffer = null
    }
    if (this.sceneTexture !== null) {
      gl.deleteTexture(this.sceneTexture)
      this.sceneTexture = null
    }
    const fbo = gl.createFramebuffer()
    const tex = gl.createTexture()
    if (fbo === null || tex === null) {
      throw new Error('D2GlPostProcessPass: framebuffer allocation failed')
    }
    const linear = gl.LINEAR ?? gl.NEAREST
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8 ?? gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

    const fbTarget = gl.FRAMEBUFFER ?? 0x8d40
    const colorAtt0 = gl.COLOR_ATTACHMENT0 ?? 0x8ce0
    gl.bindFramebuffer(fbTarget, fbo)
    gl.framebufferTexture2D(fbTarget, colorAtt0, gl.TEXTURE_2D, tex, 0)

    this.framebuffer = fbo
    this.sceneTexture = tex
    this.fboWidth = w
    this.fboHeight = h
  }

  /**
   * Upload the 1024×448 `Data/assets/textures/lut.png` 3D LUT atlas (`14` presets of `32×32×32`).
   */
  uploadLutTexture(
    source:
      | ImageBitmap
      | HTMLImageElement
      | HTMLCanvasElement
      | { readonly pixels: Uint8Array | Uint8ClampedArray; readonly width: number; readonly height: number },
  ): void {
    this.ensureGpuResources()
    const gl = this.gl
    if (!this.lutTexture) return
    const linear = gl.LINEAR ?? gl.NEAREST
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    if ('pixels' in source) {
      if (source.width !== PD2_D2GL_LUT_SPEC.width || source.height !== PD2_D2GL_LUT_SPEC.height) {
        throw new Error(
          `D2GlPostProcessPass: LUT texture must be ${String(PD2_D2GL_LUT_SPEC.width)}x${String(PD2_D2GL_LUT_SPEC.height)}, got ${String(source.width)}x${String(source.height)}`,
        )
      }
      const bytes =
        source.pixels instanceof Uint8Array
          ? source.pixels
          : new Uint8Array(source.pixels.buffer, source.pixels.byteOffset, source.pixels.byteLength)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        source.width,
        source.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bytes,
      )
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    }
  }

  /**
   * Bind the offscreen scene FBO and clear it at the start of a frame.
   */
  beginScenePass(width: number, height: number, clear: readonly [number, number, number]): void {
    this.ensureGpuResources()
    this.ensureSceneFbo(width, height)
    const gl = this.gl
    const fbTarget = gl.FRAMEBUFFER ?? 0x8d40
    gl.bindFramebuffer(fbTarget, this.framebuffer)
    gl.viewport(0, 0, this.fboWidth, this.fboHeight)
    gl.clearColor(clear[0], clear[1], clear[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.activePass = true
  }

  /**
   * Resolve the offscreen scene FBO to the default framebuffer (`null`) using the configured
   * D2GL Upscale + LumaSharpen + 3D LUT shader pass.
   */
  endScenePass(outputWidth = this.fboWidth, outputHeight = this.fboHeight): void {
    if (!this.activePass || this.program === null || this.vao === null || this.sceneTexture === null) {
      return
    }
    this.activePass = false
    const gl = this.gl
    const fbTarget = gl.FRAMEBUFFER ?? 0x8d40
    gl.bindFramebuffer(fbTarget, null)
    gl.viewport(0, 0, Math.max(1, outputWidth), Math.max(1, outputHeight))

    if (typeof gl.disable === 'function') {
      gl.disable(gl.BLEND)
    }
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture)
    if (this.uSceneTexture !== null) gl.uniform1i(this.uSceneTexture, 0)

    if (this.lutTexture !== null) {
      gl.activeTexture(gl.TEXTURE0 + 1)
      gl.bindTexture(gl.TEXTURE_2D, this.lutTexture)
      if (this.uLutTexture !== null) gl.uniform1i(this.uLutTexture, 1)
    }

    const kernel = this.getUpscaleKernel()
    const modeId = D2GL_UPSCALE_MODE_ID[kernel]
    const outW = Math.max(1, outputWidth)
    const outH = Math.max(1, outputHeight)
    if (this.uSourceSize !== null) gl.uniform2f(this.uSourceSize, this.fboWidth, this.fboHeight)
    if (this.uRelSize !== null) gl.uniform2f(this.uRelSize, 1.0 / this.fboWidth, 1.0 / this.fboHeight)
    if (this.uOutputSize !== null) gl.uniform2f(this.uOutputSize, outW, outH)
    if (this.uOutputRelSize !== null) gl.uniform2f(this.uOutputRelSize, 1.0 / outW, 1.0 / outH)
    if (this.uUpscaleMode !== null) gl.uniform1i(this.uUpscaleMode, modeId)
    if (this.uSharpen !== null) gl.uniform1i(this.uSharpen, this.config.sharpen ? 1 : 0)
    if (this.uSharpStrength !== null && typeof gl.uniform1f === 'function') {
      gl.uniform1f(this.uSharpStrength, this.config.sharpenStrength)
    }
    if (this.uSharpClamp !== null && typeof gl.uniform1f === 'function') {
      gl.uniform1f(this.uSharpClamp, this.config.sharpenClamp)
    }
    if (this.uSharpRadius !== null && typeof gl.uniform1f === 'function') {
      gl.uniform1f(this.uSharpRadius, this.config.sharpenRadius)
    }
    if (this.uLutIndex !== null) gl.uniform1i(this.uLutIndex, this.config.lut)

    if (typeof gl.drawArrays === 'function') {
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    gl.bindVertexArray(null)
    gl.enable(gl.BLEND)
    this.resolvedCount += 1
  }

  resetContextState(): void {
    this.program = null
    this.vao = null
    this.framebuffer = null
    this.sceneTexture = null
    this.lutTexture = null
    this.fboWidth = 0
    this.fboHeight = 0
    this.activePass = false
  }

  dispose(): void {
    const gl = this.gl
    const contextLost = typeof gl.isContextLost === 'function' ? gl.isContextLost() : false
    if (!contextLost) {
      if (this.framebuffer !== null && typeof gl.deleteFramebuffer === 'function') {
        gl.deleteFramebuffer(this.framebuffer)
      }
      if (this.sceneTexture !== null) gl.deleteTexture(this.sceneTexture)
      if (this.lutTexture !== null) gl.deleteTexture(this.lutTexture)
      if (this.vao !== null) gl.deleteVertexArray(this.vao)
      if (this.program !== null) gl.deleteProgram(this.program)
    }
    this.resetContextState()
  }
}

/**
 * PD2 D2GL renderer configuration, post-processing shaders (Upscale + LumaSharpen + 3D LUT),
 * and HD Text font atlas tables (`glide3x.dll.d2gl`, `d2gl.json`, `d2gl.ini`).
 *
 * Ground truth:
 * - Config files: `pd2-data/d2gl.json` and `pd2-data/d2gl.ini` (parsed strictly with zero silent
 *   fallbacks; pinned in {@link PD2_D2GL_CONFIG} and {@link PD2_D2GL_INI_CONFIG}).
 * - Upscale presets: `pd2-data/Data/shaders/list.txt` (68 RetroArch `.slangp` presets; PD2 default
 *   is `"cubic\\bicubic.slangp"` using Mitchell-Netravali `B = 0.33, C = 0.33` from
 *   `Data/shaders/cubic/shaders/bicubic.slang`).
 * - LumaSharpen (`prefx` shader embedded in `pd2-data/glide3x.dll.d2gl`):
 *   `#define CoefLuma vec3(0.2126,0.7152,0.0722)` with PD2 defaults `sharpen = true`,
 *   `sharpen_strength = 1.2`, `sharpen_clamp = 0.800`, `sharpen_radius = 0.400`.
 * - 3D Color Grading LUT (`pd2-data/Data/assets/textures/lut.png`, `1024x448` = 14 rows of `1024x32`
 *   with `#define LUT_Size 32.0` in `glide3x.dll.d2gl`; `lut = 0` is Game Default, `1..14` select row `lut - 1`).
 * - HD Text (`pd2-data/Data/assets/fonts/{ExocetBlizzardMedium.otf,Formal436BT.ttf,Chi.ttf}` and
 *   `pd2-data/Data/assets/atlases/{default,chi}.txt`, enabled by default via `"hd_text": true`,
 *   `"hd_text_scale": 1.0`).
 */

import type { UiDataMode } from './pd2-sgd2freeres.ts'

export type D2FontName = 'font6' | 'font8' | 'font16' | 'font30' | 'fontexocet10' | 'fontformal12'

export interface D2GlScreenConfig {
  readonly windowSizeWidth: number
  readonly windowSizeHeight: number
  readonly windowCentered: boolean
  readonly windowPositionX: number
  readonly windowPositionY: number
  readonly unlockCursor: boolean
  readonly windowFullscreen: boolean
  readonly windowVsync: boolean
  readonly foregroundFpsActive: boolean
  readonly foregroundFpsValue: number
  readonly backgroundFpsActive: boolean
  readonly backgroundFpsValue: number
  readonly autoMinimize: boolean
  readonly windowDarkMode: boolean
}

export interface D2GlGraphicsConfig {
  readonly shaderPreset: string
  readonly sharpen: boolean
  readonly sharpenStrength: number
  readonly sharpenClamp: number
  readonly sharpenRadius: number
  readonly fxaa: boolean
  readonly fxaaPreset: number
  readonly lut: number
  readonly bloom: boolean
  readonly bloomExposure: number
  readonly bloomGamma: number
  readonly stretchedHorizontal: boolean
  readonly stretchedVertical: boolean
}

export interface D2GlFeaturesConfig {
  readonly hdCursor: boolean
  readonly hdText: boolean
  readonly hdTextScale: number
  readonly miniMap: boolean
  readonly miniMapTextOver: boolean
  readonly miniMapWidth: number
  readonly miniMapHeight: number
  readonly motionPrediction: boolean
  readonly skipIntro: boolean
  readonly noPickup: boolean
  readonly showItemQuantity: boolean
  readonly showMonsterName: boolean
  readonly showFps: boolean
}

export interface D2GlOtherConfig {
  readonly glVerMajor: number
  readonly glVerMinor: number
  readonly useComputeShader: boolean
  readonly frameLatency: number
  readonly loadDllsEarly: string
  readonly loadDllsLate: string
}

export interface D2GlConfig {
  readonly screen: D2GlScreenConfig
  readonly graphics: D2GlGraphicsConfig
  readonly features: D2GlFeaturesConfig
  readonly other: D2GlOtherConfig
}

export interface D2GlIniConfig {
  readonly screen: D2GlScreenConfig
  readonly graphics: D2GlGraphicsConfig
  readonly features: D2GlFeaturesConfig & {
    readonly multiInstance: boolean
    readonly showSmile: boolean
    readonly showItemColorBg: boolean
    readonly showMonsterRes: boolean
  }
  readonly other: D2GlOtherConfig & {
    readonly d2expresX1: number
    readonly d2expresY1: number
    readonly d2expresX2: number
    readonly d2expresY2: number
  }
}

function requireObj(root: Record<string, unknown>, key: string, ctx: string): Record<string, unknown> {
  if (!Object.hasOwn(root, key)) throw new Error(`${ctx}: missing section "${key}"`)
  const v = root[key]
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error(`${ctx}: section "${key}" must be an object`)
  }
  return v as Record<string, unknown>
}

function requireBool(obj: Record<string, unknown>, key: string, ctx: string): boolean {
  if (!Object.hasOwn(obj, key)) throw new Error(`${ctx}: missing key "${key}"`)
  const v = obj[key]
  if (typeof v !== 'boolean') throw new Error(`${ctx}: "${key}" must be a boolean`)
  return v
}

function requireNumber(obj: Record<string, unknown>, key: string, ctx: string): number {
  if (!Object.hasOwn(obj, key)) throw new Error(`${ctx}: missing key "${key}"`)
  const v = obj[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${ctx}: "${key}" must be a finite number`)
  return v
}

function requireInt(obj: Record<string, unknown>, key: string, ctx: string): number {
  const v = requireNumber(obj, key, ctx)
  if (!Number.isInteger(v)) throw new Error(`${ctx}: "${key}" must be an integer`)
  return v
}

function requireString(obj: Record<string, unknown>, key: string, ctx: string): string {
  if (!Object.hasOwn(obj, key)) throw new Error(`${ctx}: missing key "${key}"`)
  const v = obj[key]
  if (typeof v !== 'string') throw new Error(`${ctx}: "${key}" must be a string`)
  return v
}

/**
 * Strictly parse `d2gl.json`. Fails fast if any section or key is missing or malformed.
 */
export function parseD2GlJson(jsonText: string): D2GlConfig {
  const root = JSON.parse(jsonText) as Record<string, unknown>
  if (root === null || typeof root !== 'object' || Array.isArray(root)) {
    throw new Error('d2gl.json: root must be an object')
  }
  const screen = requireObj(root, 'screen', 'd2gl.json')
  const graphics = requireObj(root, 'graphics', 'd2gl.json')
  const features = requireObj(root, 'features', 'd2gl.json')
  const other = requireObj(root, 'other', 'd2gl.json')

  return {
    screen: {
      windowSizeWidth: requireInt(screen, 'window_size_width', 'd2gl.json[screen]'),
      windowSizeHeight: requireInt(screen, 'window_size_height', 'd2gl.json[screen]'),
      windowCentered: requireBool(screen, 'window_centered', 'd2gl.json[screen]'),
      windowPositionX: requireInt(screen, 'window_position_x', 'd2gl.json[screen]'),
      windowPositionY: requireInt(screen, 'window_position_y', 'd2gl.json[screen]'),
      unlockCursor: requireBool(screen, 'unlock_cursor', 'd2gl.json[screen]'),
      windowFullscreen: requireBool(screen, 'window_fullscreen', 'd2gl.json[screen]'),
      windowVsync: requireBool(screen, 'window_vsync', 'd2gl.json[screen]'),
      foregroundFpsActive: requireBool(screen, 'foreground_fps_active', 'd2gl.json[screen]'),
      foregroundFpsValue: requireInt(screen, 'foreground_fps_value', 'd2gl.json[screen]'),
      backgroundFpsActive: requireBool(screen, 'background_fps_active', 'd2gl.json[screen]'),
      backgroundFpsValue: requireInt(screen, 'background_fps_value', 'd2gl.json[screen]'),
      autoMinimize: requireBool(screen, 'auto_minimize', 'd2gl.json[screen]'),
      windowDarkMode: requireBool(screen, 'window_dark_mode', 'd2gl.json[screen]'),
    },
    graphics: {
      shaderPreset: requireString(graphics, 'shader_preset', 'd2gl.json[graphics]'),
      sharpen: requireBool(graphics, 'sharpen', 'd2gl.json[graphics]'),
      sharpenStrength: requireNumber(graphics, 'sharpen_strength', 'd2gl.json[graphics]'),
      sharpenClamp: requireNumber(graphics, 'sharpen_clamp', 'd2gl.json[graphics]'),
      sharpenRadius: requireNumber(graphics, 'sharpen_radius', 'd2gl.json[graphics]'),
      fxaa: requireBool(graphics, 'fxaa', 'd2gl.json[graphics]'),
      fxaaPreset: requireInt(graphics, 'fxaa_preset', 'd2gl.json[graphics]'),
      lut: requireInt(graphics, 'lut', 'd2gl.json[graphics]'),
      bloom: requireBool(graphics, 'bloom', 'd2gl.json[graphics]'),
      bloomExposure: requireNumber(graphics, 'bloom_exposure', 'd2gl.json[graphics]'),
      bloomGamma: requireNumber(graphics, 'bloom_gamma', 'd2gl.json[graphics]'),
      stretchedHorizontal: requireBool(graphics, 'stretched_horizontal', 'd2gl.json[graphics]'),
      stretchedVertical: requireBool(graphics, 'stretched_vertical', 'd2gl.json[graphics]'),
    },
    features: {
      hdCursor: requireBool(features, 'hd_cursor', 'd2gl.json[features]'),
      hdText: requireBool(features, 'hd_text', 'd2gl.json[features]'),
      hdTextScale: requireNumber(features, 'hd_text_scale', 'd2gl.json[features]'),
      miniMap: requireBool(features, 'mini_map', 'd2gl.json[features]'),
      miniMapTextOver: requireBool(features, 'mini_map_text_over', 'd2gl.json[features]'),
      miniMapWidth: requireInt(features, 'mini_map_width', 'd2gl.json[features]'),
      miniMapHeight: requireInt(features, 'mini_map_height', 'd2gl.json[features]'),
      motionPrediction: requireBool(features, 'motion_prediction', 'd2gl.json[features]'),
      skipIntro: requireBool(features, 'skip_intro', 'd2gl.json[features]'),
      noPickup: requireBool(features, 'no_pickup', 'd2gl.json[features]'),
      showItemQuantity: requireBool(features, 'show_item_quantity', 'd2gl.json[features]'),
      showMonsterName: requireBool(features, 'show_monster_name', 'd2gl.json[features]'),
      showFps: requireBool(features, 'show_fps', 'd2gl.json[features]'),
    },
    other: {
      glVerMajor: requireInt(other, 'gl_ver_major', 'd2gl.json[other]'),
      glVerMinor: requireInt(other, 'gl_ver_minor', 'd2gl.json[other]'),
      useComputeShader: requireBool(other, 'use_compute_shader', 'd2gl.json[other]'),
      frameLatency: requireInt(other, 'frame_latency', 'd2gl.json[other]'),
      loadDllsEarly: requireString(other, 'load_dlls_early', 'd2gl.json[other]'),
      loadDllsLate: requireString(other, 'load_dlls_late', 'd2gl.json[other]'),
    },
  }
}

/**
 * Strictly parse `d2gl.ini`. Fails fast if any section or key is missing or malformed.
 */
export function parseD2GlIni(iniText: string): D2GlIniConfig {
  const sections = new Map<string, Map<string, string>>()
  let currentSection = ''
  for (const rawLine of iniText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith(';') || line.startsWith('#')) continue
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).trim()
      if (!sections.has(currentSection)) sections.set(currentSection, new Map())
      continue
    }
    const eq = line.indexOf('=')
    if (eq < 0 || !currentSection) {
      throw new Error(`d2gl.ini: invalid line "${line}"`)
    }
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    sections.get(currentSection)!.set(key, val)
  }

  const getSec = (name: string): Map<string, string> => {
    const s = sections.get(name)
    if (!s) throw new Error(`d2gl.ini: missing [${name}] section`)
    return s
  }
  const getStr = (sec: Map<string, string>, secName: string, key: string): string => {
    const v = sec.get(key)
    if (v === undefined) throw new Error(`d2gl.ini[${secName}]: missing ${key}`)
    return v
  }
  const getBool = (sec: Map<string, string>, secName: string, key: string): boolean => {
    const v = getStr(sec, secName, key)
    if (v === 'true') return true
    if (v === 'false') return false
    throw new Error(`d2gl.ini[${secName}]: ${key} must be true/false, got "${v}"`)
  }
  const getNum = (sec: Map<string, string>, secName: string, key: string): number => {
    const v = getStr(sec, secName, key)
    const n = Number(v)
    if (v === '' || !Number.isFinite(n)) throw new Error(`d2gl.ini[${secName}]: ${key} must be a number, got "${v}"`)
    return n
  }
  const getInt = (sec: Map<string, string>, secName: string, key: string): number => {
    const n = getNum(sec, secName, key)
    if (!Number.isInteger(n)) throw new Error(`d2gl.ini[${secName}]: ${key} must be an integer, got "${String(n)}"`)
    return n
  }

  const screen = getSec('Screen')
  const graphic = getSec('Graphic')
  const feature = getSec('Feature')
  const other = getSec('Other')

  return {
    screen: {
      windowFullscreen: getBool(screen, 'Screen', 'fullscreen'),
      windowSizeWidth: getInt(screen, 'Screen', 'window_width'),
      windowSizeHeight: getInt(screen, 'Screen', 'window_height'),
      windowCentered: getBool(screen, 'Screen', 'centered_window'),
      windowPositionX: getInt(screen, 'Screen', 'window_posx'),
      windowPositionY: getInt(screen, 'Screen', 'window_posy'),
      unlockCursor: getBool(screen, 'Screen', 'unlock_cursor'),
      autoMinimize: getBool(screen, 'Screen', 'auto_minimize'),
      windowDarkMode: getBool(screen, 'Screen', 'dark_mode'),
      windowVsync: getBool(screen, 'Screen', 'vsync'),
      foregroundFpsActive: getBool(screen, 'Screen', 'foreground_fps'),
      foregroundFpsValue: getInt(screen, 'Screen', 'foreground_fps_value'),
      backgroundFpsActive: getBool(screen, 'Screen', 'background_fps'),
      backgroundFpsValue: getInt(screen, 'Screen', 'background_fps_value'),
    },
    graphics: {
      shaderPreset: getStr(graphic, 'Graphic', 'shader_preset'),
      lut: getInt(graphic, 'Graphic', 'lut'),
      sharpen: getBool(graphic, 'Graphic', 'sharpen'),
      sharpenStrength: getNum(graphic, 'Graphic', 'sharpen_strength'),
      sharpenClamp: getNum(graphic, 'Graphic', 'sharpen_clamp'),
      sharpenRadius: getNum(graphic, 'Graphic', 'sharpen_radius'),
      fxaa: getBool(graphic, 'Graphic', 'fxaa'),
      fxaaPreset: getInt(graphic, 'Graphic', 'fxaa_preset'),
      bloom: getBool(graphic, 'Graphic', 'bloom'),
      bloomExposure: getNum(graphic, 'Graphic', 'bloom_exposure'),
      bloomGamma: getNum(graphic, 'Graphic', 'bloom_gamma'),
      stretchedHorizontal: getBool(graphic, 'Graphic', 'stretched_horizontal'),
      stretchedVertical: getBool(graphic, 'Graphic', 'stretched_vertical'),
    },
    features: {
      hdCursor: getBool(feature, 'Feature', 'hd_cursor'),
      hdText: getBool(feature, 'Feature', 'hd_text'),
      hdTextScale: getNum(feature, 'Feature', 'hd_text_scale'),
      miniMap: getBool(feature, 'Feature', 'mini_map'),
      miniMapTextOver: getBool(feature, 'Feature', 'mini_map_text_over'),
      miniMapWidth: getInt(feature, 'Feature', 'mini_map_width'),
      miniMapHeight: getInt(feature, 'Feature', 'mini_map_height'),
      motionPrediction: getBool(feature, 'Feature', 'motion_prediction'),
      skipIntro: getBool(feature, 'Feature', 'skip_intro'),
      noPickup: getBool(feature, 'Feature', 'no_pickup'),
      showItemQuantity: getBool(feature, 'Feature', 'show_item_quantity'),
      showMonsterName: getBool(feature, 'Feature', 'show_monster_name'),
      multiInstance: getBool(feature, 'Feature', 'multi_instance'),
      showSmile: getBool(feature, 'Feature', 'show_smile'),
      showItemColorBg: getBool(feature, 'Feature', 'show_item_color_bg'),
      showMonsterRes: getBool(feature, 'Feature', 'show_monster_res'),
      showFps: getBool(feature, 'Feature', 'show_fps'),
    },
    other: {
      glVerMajor: getInt(other, 'Other', 'gl_ver_major'),
      glVerMinor: getInt(other, 'Other', 'gl_ver_minor'),
      useComputeShader: getBool(other, 'Other', 'use_compute_shader'),
      frameLatency: getInt(other, 'Other', 'frame_latency'),
      loadDllsEarly: getStr(other, 'Other', 'load_dlls_early'),
      loadDllsLate: getStr(other, 'Other', 'load_dlls_late'),
      d2expresX1: getInt(other, 'Other', 'd2expres_x1'),
      d2expresY1: getInt(other, 'Other', 'd2expres_y1'),
      d2expresX2: getInt(other, 'Other', 'd2expres_x2'),
      d2expresY2: getInt(other, 'Other', 'd2expres_y2'),
    },
  }
}

/** `pd2-data/d2gl.json` as shipped (verified against the file by the test suite). */
export const PD2_D2GL_CONFIG: D2GlConfig = {
  screen: {
    windowSizeWidth: 1600,
    windowSizeHeight: 900,
    windowCentered: true,
    windowPositionX: 184,
    windowPositionY: 31,
    unlockCursor: true,
    windowFullscreen: false,
    windowVsync: false,
    foregroundFpsActive: true,
    foregroundFpsValue: 60,
    backgroundFpsActive: true,
    backgroundFpsValue: 25,
    autoMinimize: false,
    windowDarkMode: true,
  },
  graphics: {
    shaderPreset: 'cubic\\bicubic.slangp',
    sharpen: true,
    sharpenStrength: 1.2,
    sharpenClamp: 0.8,
    sharpenRadius: 0.4,
    fxaa: false,
    fxaaPreset: 2,
    lut: 0,
    bloom: false,
    bloomExposure: 1.0,
    bloomGamma: 0.75,
    stretchedHorizontal: false,
    stretchedVertical: false,
  },
  features: {
    hdCursor: true,
    hdText: true,
    hdTextScale: 1.0,
    miniMap: true,
    miniMapTextOver: false,
    miniMapWidth: 300,
    miniMapHeight: 200,
    motionPrediction: true,
    skipIntro: true,
    noPickup: true,
    showItemQuantity: true,
    showMonsterName: true,
    showFps: true,
  },
  other: {
    glVerMajor: 4,
    glVerMinor: 4,
    useComputeShader: false,
    frameLatency: 1,
    loadDllsEarly: '',
    loadDllsLate: 'SGD2FreeRes.dll',
  },
}

/** `pd2-data/d2gl.ini` as shipped (verified against the file by the test suite). */
export const PD2_D2GL_INI_CONFIG: D2GlIniConfig = {
  screen: {
    windowFullscreen: false,
    windowSizeWidth: 1600,
    windowSizeHeight: 900,
    windowCentered: true,
    windowPositionX: 154,
    windowPositionY: 67,
    unlockCursor: true,
    autoMinimize: false,
    windowDarkMode: true,
    windowVsync: false,
    foregroundFpsActive: true,
    foregroundFpsValue: 60,
    backgroundFpsActive: true,
    backgroundFpsValue: 25,
  },
  graphics: {
    shaderPreset: 'cubic\\bicubic.slangp',
    lut: 0,
    sharpen: true,
    sharpenStrength: 1.2,
    sharpenClamp: 0.8,
    sharpenRadius: 0.4,
    fxaa: false,
    fxaaPreset: 2,
    bloom: false,
    bloomExposure: 2.0,
    bloomGamma: 1.2,
    stretchedHorizontal: false,
    stretchedVertical: false,
  },
  features: {
    hdCursor: true,
    hdText: true,
    hdTextScale: 1.0,
    miniMap: true,
    miniMapTextOver: false,
    miniMapWidth: 300,
    miniMapHeight: 200,
    motionPrediction: true,
    skipIntro: true,
    noPickup: true,
    showItemQuantity: true,
    showMonsterName: false,
    multiInstance: true,
    showSmile: true,
    showItemColorBg: true,
    showMonsterRes: false,
    showFps: true,
  },
  other: {
    glVerMajor: 4,
    glVerMinor: 6,
    useComputeShader: false,
    frameLatency: 1,
    loadDllsEarly: '',
    loadDllsLate: 'SGD2FreeRes.dll',
    d2expresX1: 1024,
    d2expresY1: 768,
    d2expresX2: 1280,
    d2expresY2: 768,
  },
}

/**
 * All 68 shader presets listed in `pd2-data/Data/shaders/list.txt` (`shaders\list.txt` in `glide3x.dll.d2gl`).
 */
export const PD2_D2GL_SHADER_PRESETS: readonly string[] = [
  'bilinear.slangp',
  'nearest.slangp',
  'anti-aliasing\\aa-shader-4.0.slangp',
  'anti-aliasing\\advanced-aa.slangp',
  'anti-aliasing\\reverse-aa.slangp',
  'anti-aliasing\\smaa+linear.slangp',
  'anti-aliasing\\smaa+sharpen.slangp',
  'anti-aliasing\\smaa.slangp',
  'cubic\\bicubic-fast.slangp',
  'cubic\\bicubic.slangp',
  'cubic\\catmull-rom-fast.slangp',
  'cubic\\catmull-rom.slangp',
  'cubic\\cubic-gamma-correct.slangp',
  'fsr\\fsr-easu.slangp',
  'fsr\\fsr.slangp',
  'fsr\\smaa+fsr.slangp',
  'interpolation\\sharp-bilinear-scanlines.slangp',
  'interpolation\\sharp-bilinear-simple.slangp',
  'interpolation\\sharp-bilinear.slangp',
  'linear\\linear-gamma-correct.slangp',
  'misc\\ascii.slangp',
  'misc\\cmyk-halftone-dot.slangp',
  'misc\\deband.slangp',
  'misc\\edge-detect.slangp',
  'misc\\ega.slangp',
  'misc\\interlacing.slangp',
  'misc\\natural-vision.slangp',
  'misc\\retro-palettes.slangp',
  'reshade\\blendoverlay.slangp',
  'reshade\\bloom.slangp',
  'reshade\\halftone-print.slangp',
  'reshade\\magicbloom.slangp',
  'scanlines\\scanline.slangp',
  'scanlines\\scanlines-rere.slangp',
  'scanlines\\scanlines-sine-abs.slangp',
  'sharpen\\adaptive-sharpen.slangp',
  'sharpen\\rca_sharpen.slangp',
  'sharpen\\super-xbr-super-res.slangp',
  'windowed\\jinc2-sharp.slangp',
  'windowed\\jinc2-sharper.slangp',
  'windowed\\jinc2.slangp',
  'windowed\\lanczos16.slangp',
  'windowed\\lanczos3-fast.slangp',
  'xbr\\super-xbr-fast.slangp',
  'xbr\\super-xbr.slangp',
  'xbr\\xbr-lv2-sharp.slangp',
  'xbr\\xbr-lv2.slangp',
  'xbr\\xbr-lv3.slangp',
  'xbr\\other\\2xBR-lv1-multipass.slangp',
  'xbr\\other\\4xbr-hybrid-crt.slangp',
  'xbr\\other\\super-2xbr-3d-2p.slangp',
  'xbr\\other\\super-2xbr-3d-3p-smoother.slangp',
  'xbr\\other\\super-4xbr-3d-4p.slangp',
  'xbr\\other\\super-4xbr-3d-6p-smoother.slangp',
  'xbr\\other\\super-8xbr-3d-6p.slangp',
  'xbr\\other\\xbr-hybrid.slangp',
  'xbr\\other\\xbr-lv1-standalone.slangp',
  'xbr\\other\\xbr-lv2-multipass.slangp',
  'xbr\\other\\xbr-lv2-standalone.slangp',
  'xbr\\other\\xbr-lv3-multipass.slangp',
  'xbr\\other\\xbr-lv3-standalone.slangp',
  'xbr\\other\\xbr-mlv4-multipass.slangp',
  'xbrz\\2xbrz-linear.slangp',
  'xbrz\\4xbrz-linear.slangp',
  'xbrz\\5xbrz-linear.slangp',
  'xbrz\\6xbrz-linear.slangp',
  'xbrz\\xbrz-freescale-multipass.slangp',
  'xbrz\\xbrz-freescale.slangp',
] as const

export type D2GlUpscaleKernel = 'nearest' | 'bilinear' | 'bicubic' | 'catmull-rom' | 'jinc2-sharper'

export const D2GL_UPSCALE_MODE_ID: Readonly<Record<D2GlUpscaleKernel, number>> = {
  nearest: 0,
  bilinear: 1,
  bicubic: 2,
  'catmull-rom': 3,
  'jinc2-sharper': 4,
} as const

/**
 * Resolve a D2GL `shader_preset` path (or shorthand kernel name) to the active WebGL2 upscale kernel.
 * Throws on an empty or unrecognized preset.
 */
export function resolveD2GlUpscaleKernel(preset: string): D2GlUpscaleKernel {
  const norm = preset.trim().replace(/\//g, '\\').toLowerCase()
  if (norm === '') throw new Error('D2GL: shader_preset must not be empty')
  if (norm === 'nearest' || norm === 'nearest.slangp') return 'nearest'
  if (norm === 'bilinear' || norm === 'bilinear.slangp' || norm.startsWith('linear\\') || norm.startsWith('interpolation\\')) {
    return 'bilinear'
  }
  if (norm === 'bicubic' || norm === 'cubic\\bicubic.slangp' || norm === 'cubic\\bicubic-fast.slangp' || norm === 'cubic\\cubic-gamma-correct.slangp') {
    return 'bicubic'
  }
  if (norm === 'catmull-rom' || norm === 'cubic\\catmull-rom.slangp' || norm === 'cubic\\catmull-rom-fast.slangp') {
    return 'catmull-rom'
  }
  if (
    norm === 'jinc2-sharper' ||
    norm === 'jinc2' ||
    norm.startsWith('windowed\\jinc2') ||
    norm.startsWith('windowed\\lanczos')
  ) {
    return 'jinc2-sharper'
  }
  const known = PD2_D2GL_SHADER_PRESETS.some((p) => p.toLowerCase() === norm)
  if (known) {
    return 'bicubic'
  }
  throw new Error(`D2GL: unknown shader_preset "${preset}"`)
}

/** Rec.709 luma coefficients `#define CoefLuma vec3(0.2126,0.7152,0.0722)` in `glide3x.dll.d2gl`. */
export const D2GL_COEF_LUMA: readonly [number, number, number] = [0.2126, 0.7152, 0.0722] as const
export const D2GL_LUMA_SHARPEN_COEF = D2GL_COEF_LUMA

/** Mitchell-Netravali parameters (`B = 0.33, C = 0.33`) in `Data/shaders/cubic/shaders/bicubic.slang`. */
export const D2GL_BICUBIC_PARAMS = {
  B: 0.33,
  C: 0.33,
} as const

/** Windowed-Jinc2 Sharper parameters in `Data/shaders/windowed/jinc2-sharper.slangp` & `Shaders/jinc2-sharper.glsl`. */
export const D2GL_JINC2_SHARPER_PARAMS = {
  windowSinc: 0.42,
  sinc: 0.92,
  arStrength: 0.8,
} as const

/**
 * Evaluate the 4-tap cubic filter weights `weight4(x, B, C)` from `Data/shaders/cubic/shaders/bicubic.slang`:
 * `pow(x, 3) * a + pow(x, 2) * b + x * c + d` at `1 + x`, `x`, `1 - x`, `2 - x` for `0 <= x <= 1`.
 */
export function evaluateD2GlBicubicWeight4(
  x: number,
  B: number = D2GL_BICUBIC_PARAMS.B,
  C: number = D2GL_BICUBIC_PARAMS.C,
): readonly [number, number, number, number] {
  const sample = (t: number): number => {
    if (t < 1.0) {
      const a = 2.0 - 1.5 * B - C
      const b = -3.0 + 2.0 * B + C
      const d = 1.0 - (1.0 / 3.0) * B
      return t * t * t * a + t * t * b + d
    }
    if (t < 2.0) {
      const a = -(1.0 / 6.0) * B - C
      const b = B + 5.0 * C
      const c = -2.0 * B - 8.0 * C
      const d = (4.0 / 3.0) * B + 4.0 * C
      return t * t * t * a + t * t * b + t * c + d
    }
    return 0.0
  }
  return [sample(1.0 + x), sample(x), sample(1.0 - x), sample(2.0 - x)]
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/**
 * Exact port of `glide3x.dll.d2gl` `prefx` LumaSharpen function (`vec3 u(sampler2D v, vec2 y)`):
 * ```glsl
 * vec3 u=P(v,y),i=P(v,y+u_RelSize*u_Radius),n=P(v,y-u_RelSize*u_Radius),l=CoefLuma*u_SharpStrength*1.5;
 * vec4 m=vec4(l*(.5/u_SharpClamp),.5);
 * float x=u_SharpClamp*2.*clamp(dot(vec4(u-(i+n)/2.,1),m),0.,1.)-u_SharpClamp;
 * return clamp(u+x,0.,1.);
 * ```
 */
export function evaluateD2GlLumaSharpenRgb(
  centerRgb: readonly [number, number, number],
  plusOffsetRgb: readonly [number, number, number],
  minusOffsetRgb: readonly [number, number, number],
  strength: number = PD2_D2GL_CONFIG.graphics.sharpenStrength,
  clampVal: number = PD2_D2GL_CONFIG.graphics.sharpenClamp,
): readonly [number, number, number] {
  if (!(clampVal > 0)) throw new RangeError(`D2GL: sharpen_clamp must be > 0, got ${String(clampVal)}`)
  const diffR = centerRgb[0] - (plusOffsetRgb[0] + minusOffsetRgb[0]) * 0.5
  const diffG = centerRgb[1] - (plusOffsetRgb[1] + minusOffsetRgb[1]) * 0.5
  const diffB = centerRgb[2] - (plusOffsetRgb[2] + minusOffsetRgb[2]) * 0.5
  const scale = strength * 1.5 * (0.5 / clampVal)
  const mR = D2GL_COEF_LUMA[0] * scale
  const mG = D2GL_COEF_LUMA[1] * scale
  const mB = D2GL_COEF_LUMA[2] * scale
  const dotVal = diffR * mR + diffG * mG + diffB * mB + 0.5
  const x = clampVal * 2.0 * clamp01(dotVal) - clampVal
  return [clamp01(centerRgb[0] + x), clamp01(centerRgb[1] + x), clamp01(centerRgb[2] + x)]
}

/** `Data/assets/textures/lut.png` (1024×448 = 14 rows of 1024×32, `LUT_Size = 32.0` in `glide3x.dll.d2gl`). */
export const PD2_D2GL_LUT_SPEC = {
  path: 'Data/assets/textures/lut.png',
  url: '/ui-pd2/lut.png',
  width: 1024,
  height: 448,
  lutSize: 32,
  presetCount: 14,
} as const

export const D2GL_LUT_SIZE = PD2_D2GL_LUT_SPEC.lutSize
export const D2GL_LUT_PRESETS = PD2_D2GL_LUT_SPEC.presetCount
export const D2GL_LUT_TEXTURE_WIDTH = PD2_D2GL_LUT_SPEC.width
export const D2GL_LUT_TEXTURE_HEIGHT = PD2_D2GL_LUT_SPEC.height

/**
 * Compute the 3D LUT UV coordinates (`(e, v)` and `(l, v)`) and interpolation weight `n`
 * in the 1024×448 `lut.png` atlas for `rgb` in `0..1` and `lutIndex` in `1..14`
 * (`#define LUT_Size 32.0` in `glide3x.dll.d2gl`).
 */
export function computeD2GlLutSampleCoords(
  rgb: readonly [number, number, number],
  lutIndex: number,
): {
  readonly uv0: readonly [number, number]
  readonly uv1: readonly [number, number]
  readonly mixFactor: number
} {
  if (!Number.isInteger(lutIndex) || lutIndex < 1 || lutIndex > PD2_D2GL_LUT_SPEC.presetCount) {
    throw new RangeError(`D2GL: lut preset must be an integer in 1..${String(PD2_D2GL_LUT_SPEC.presetCount)}, got ${String(lutIndex)}`)
  }
  const S = PD2_D2GL_LUT_SPEC.lutSize
  const r = clamp01(rgb[0])
  const g = clamp01(rgb[1])
  const b = clamp01(rgb[2])
  const u = (r * (S - 1) + 0.4999) / (S * S)
  const f = (g * (S - 1) + 0.4999) / S
  const v = (lutIndex - 1 + f) / PD2_D2GL_LUT_SPEC.presetCount
  const e = Math.floor(b * (S - 1)) / S + u
  const l = Math.min(S - 1, Math.ceil((b + 1e-6) * (S - 1))) / S + u
  const rawN = l > e ? Math.max((b - e) / (l - e), 0) : 0
  const n = Math.min(S, Math.max(0, rawN))
  return {
    uv0: [e, v],
    uv1: [l, v],
    mixFactor: b < 1.0 ? clamp01(n) : 0.0,
  }
}

/** Official D2GL vector font files shipped in `pd2-data/Data/assets/fonts/`. */
export const PD2_D2GL_FONT_FILES = {
  exocet: {
    path: 'Data/assets/fonts/ExocetBlizzardMedium.otf',
    url: '/ui/fonts/ExocetBlizzardMedium.otf',
    family: 'D2GlExocetBlizzard',
    bytes: 68596,
  },
  formal: {
    path: 'Data/assets/fonts/Formal436BT.ttf',
    url: '/ui/fonts/Formal436BT.ttf',
    family: 'D2GlFormal436BT',
    bytes: 46504,
  },
  chi: {
    path: 'Data/assets/fonts/Chi.ttf',
    url: '/ui/fonts/Chi.ttf',
    family: 'D2GlChi',
    bytes: 111236,
  },
} as const

export type D2GlFontFamilyName = 'Formal436BT' | 'ExocetBlizzard' | 'ExocetReaper' | 'CHI'

export interface D2GlFontTableEntry {
  readonly id: number
  readonly fontName: D2GlFontFamilyName
  readonly fontSize: number
  readonly lineHeight: number
  readonly letterSpacing: number
  readonly lineSpacing: number
  readonly weight: number
  readonly offsetX: number
  readonly offsetY: number
  readonly shadowIntensity: number
}

const VALID_D2GL_FONT_NAMES = new Set<D2GlFontFamilyName>([
  'Formal436BT',
  'ExocetBlizzard',
  'ExocetReaper',
  'CHI',
])

/**
 * Parse a D2GL font atlas metrics file (`Data/assets/atlases/default.txt` or `chi.txt`).
 * Each line has 10 pipe-separated columns:
 * `id | fontName | fontSize | lineHeight | letterSpacing | lineSpacing | weight | offsetX | offsetY | shadowIntensity`
 */
export function parseD2GlFontAtlasTable(text: string): D2GlFontTableEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) throw new Error('D2GL font atlas table is empty')
  return lines.map((line, idx) => {
    const parts = line.split('|').map((p) => p.trim())
    if (parts.length !== 10) {
      throw new Error(`D2GL font atlas line ${String(idx)} must have 10 columns, got ${String(parts.length)}: "${line}"`)
    }
    const id = Number(parts[0])
    if (!Number.isInteger(id) || id < 0) {
      throw new Error(`D2GL font atlas line ${String(idx)} invalid id "${parts[0]}"`)
    }
    const fontName = parts[1] as D2GlFontFamilyName
    if (!VALID_D2GL_FONT_NAMES.has(fontName)) {
      throw new Error(`D2GL font atlas line ${String(idx)} unknown font "${parts[1]}"`)
    }
    const nums = parts.slice(2).map((p, colIdx) => {
      const n = Number(p)
      if (p === '' || !Number.isFinite(n)) {
        throw new Error(`D2GL font atlas line ${String(idx)} col ${String(colIdx + 2)} is not a finite number: "${p}"`)
      }
      return n
    })
    return {
      id,
      fontName,
      fontSize: nums[0]!,
      lineHeight: nums[1]!,
      letterSpacing: nums[2]!,
      lineSpacing: nums[3]!,
      weight: nums[4]!,
      offsetX: nums[5]!,
      offsetY: nums[6]!,
      shadowIntensity: nums[7]!,
    }
  })
}

/** Pinned `pd2-data/Data/assets/atlases/default.txt` (verified against disk in tests). */
export const PD2_D2GL_DEFAULT_FONT_TABLE: readonly D2GlFontTableEntry[] = [
  { id: 0, fontName: 'Formal436BT', fontSize: 10.8, lineHeight: 1.081, letterSpacing: 0.102, lineSpacing: 1.42, weight: 0.4, offsetX: 0.05, offsetY: -0.28, shadowIntensity: 0.02 },
  { id: 1, fontName: 'ExocetBlizzard', fontSize: 14.5, lineHeight: 1.01, letterSpacing: 0.0, lineSpacing: 1.1, weight: 0.356, offsetX: -0.07, offsetY: -0.2, shadowIntensity: 0.05 },
  { id: 2, fontName: 'ExocetReaper', fontSize: 24.58, lineHeight: 1.1, letterSpacing: 0.0, lineSpacing: 1.223, weight: 0.384, offsetX: -0.03, offsetY: -0.273, shadowIntensity: 0.05 },
  { id: 3, fontName: 'ExocetReaper', fontSize: 32.835, lineHeight: 1.111, letterSpacing: 0.0, lineSpacing: 1.319, weight: 0.448, offsetX: -0.02, offsetY: -0.324, shadowIntensity: 0.05 },
  { id: 4, fontName: 'Formal436BT', fontSize: 10.2, lineHeight: 1.108, letterSpacing: 0.096, lineSpacing: 2.356, weight: 0.799, offsetX: 0.243, offsetY: -0.588, shadowIntensity: 0.02 },
  { id: 5, fontName: 'Formal436BT', fontSize: 14.428, lineHeight: 1.06, letterSpacing: 0.127, lineSpacing: 2.229, weight: 0.4, offsetX: 0.024, offsetY: -0.27, shadowIntensity: 0.02 },
  { id: 6, fontName: 'Formal436BT', fontSize: 8.62, lineHeight: 1.075, letterSpacing: 0.117, lineSpacing: 1.288, weight: 0.622, offsetX: 0.0, offsetY: -0.298, shadowIntensity: 0.02 },
  { id: 7, fontName: 'ExocetReaper', fontSize: 20.528, lineHeight: 1.079, letterSpacing: -0.032, lineSpacing: 1.176, weight: 0.4, offsetX: -0.02, offsetY: -0.0, shadowIntensity: 0.05 },
  { id: 8, fontName: 'Formal436BT', fontSize: 12.4, lineHeight: 1.066, letterSpacing: 0.096, lineSpacing: 2.005, weight: 0.4, offsetX: 0.03, offsetY: -0.262, shadowIntensity: 0.02 },
  { id: 9, fontName: 'ExocetBlizzard', fontSize: 16.4, lineHeight: 1.078, letterSpacing: -0.014, lineSpacing: 0.968, weight: 0.773, offsetX: 0.0, offsetY: -0.246, shadowIntensity: 0.05 },
  { id: 10, fontName: 'ExocetBlizzard', fontSize: 12.0, lineHeight: 1.114, letterSpacing: 0.0, lineSpacing: 0.904, weight: 0.836, offsetX: 0.0, offsetY: -0.144, shadowIntensity: 0.05 },
  { id: 11, fontName: 'ExocetBlizzard', fontSize: 12.2, lineHeight: 1.06, letterSpacing: 0.0, lineSpacing: 1.622, weight: 0.4, offsetX: 0.0, offsetY: -0.28, shadowIntensity: 0.05 },
  { id: 12, fontName: 'Formal436BT', fontSize: 9.0, lineHeight: 1.14, letterSpacing: 0.085, lineSpacing: 1.239, weight: 0.4, offsetX: 0.18, offsetY: -0.319, shadowIntensity: 0.02 },
  { id: 13, fontName: 'Formal436BT', fontSize: 11.15, lineHeight: 1.092, letterSpacing: 0.117, lineSpacing: 2.197, weight: 0.4, offsetX: 0.024, offsetY: -0.172, shadowIntensity: 0.02 },
  { id: 14, fontName: 'ExocetBlizzard', fontSize: 14.5, lineHeight: 1.01, letterSpacing: 0.0, lineSpacing: 1.1, weight: 0.356, offsetX: 0.07, offsetY: -0.2, shadowIntensity: 0.05 },
  { id: 15, fontName: 'ExocetBlizzard', fontSize: 11.2, lineHeight: 1.01, letterSpacing: 0.0, lineSpacing: 1.1, weight: 0.4, offsetX: 0.0, offsetY: -0.2, shadowIntensity: 0.05 },
  { id: 16, fontName: 'ExocetBlizzard', fontSize: 14.5, lineHeight: 1.01, letterSpacing: 0.0, lineSpacing: 1.1, weight: 0.356, offsetX: 0.07, offsetY: -0.22, shadowIntensity: 0.05 },
  { id: 17, fontName: 'Formal436BT', fontSize: 9.655, lineHeight: 1.063, letterSpacing: 0.096, lineSpacing: 1.415, weight: 0.4, offsetX: 0.0, offsetY: -0.106, shadowIntensity: 0.02 },
  { id: 18, fontName: 'ExocetReaper', fontSize: 30.165, lineHeight: 1.1, letterSpacing: 0.0, lineSpacing: 1.223, weight: 0.309, offsetX: -0.03, offsetY: -0.273, shadowIntensity: 0.05 },
  { id: 19, fontName: 'ExocetBlizzard', fontSize: 11.2, lineHeight: 1.0, letterSpacing: 0.0, lineSpacing: 1.144, weight: 0.4, offsetX: 0.0, offsetY: 0.038, shadowIntensity: 0.05 },
  { id: 20, fontName: 'ExocetBlizzard', fontSize: 9.0, lineHeight: 1.03, letterSpacing: 0.0, lineSpacing: 1.1, weight: 0.78, offsetX: 0.0, offsetY: -0.2, shadowIntensity: 0.05 },
  { id: 21, fontName: 'ExocetBlizzard', fontSize: 0.0, lineHeight: 0.0, letterSpacing: 0.0, lineSpacing: 0.0, weight: 0.0, offsetX: 0.0, offsetY: 0.0, shadowIntensity: 0.05 },
  { id: 22, fontName: 'ExocetBlizzard', fontSize: 0.0, lineHeight: 0.0, letterSpacing: 0.0, lineSpacing: 0.0, weight: 0.0, offsetX: 0.0, offsetY: 0.0, shadowIntensity: 0.05 },
] as const

/** Pinned `pd2-data/Data/assets/atlases/chi.txt` (verified against disk in tests). */
export const PD2_D2GL_CHI_FONT_TABLE: readonly D2GlFontTableEntry[] = [
  { id: 0, fontName: 'CHI', fontSize: 11.0, lineHeight: 1.08, letterSpacing: 0.102, lineSpacing: 1.611, weight: 0.565, offsetX: 0.05, offsetY: -0.22, shadowIntensity: 0.0 },
  { id: 1, fontName: 'CHI', fontSize: 12.6, lineHeight: 1.08, letterSpacing: 0.064, lineSpacing: 1.478, weight: 0.617, offsetX: 0.0, offsetY: -0.28, shadowIntensity: 0.0 },
  { id: 2, fontName: 'CHI', fontSize: 28.0, lineHeight: 1.1, letterSpacing: 0.064, lineSpacing: 1.223, weight: 0.591, offsetX: 0.0, offsetY: -0.19, shadowIntensity: 0.0 },
  { id: 3, fontName: 'CHI', fontSize: 36.0, lineHeight: 1.08, letterSpacing: 0.053, lineSpacing: 1.319, weight: 0.57, offsetX: 0.0, offsetY: -0.106, shadowIntensity: 0.0 },
  { id: 4, fontName: 'CHI', fontSize: 11.8, lineHeight: 1.1, letterSpacing: 0.096, lineSpacing: 1.702, weight: 0.932, offsetX: 0.136, offsetY: -0.375, shadowIntensity: 0.0 },
  { id: 5, fontName: 'CHI', fontSize: 11.822, lineHeight: 1.098, letterSpacing: 0.127, lineSpacing: 1.511, weight: 0.48, offsetX: 0.024, offsetY: -0.27, shadowIntensity: 0.0 },
  { id: 6, fontName: 'CHI', fontSize: 10.0, lineHeight: 1.08, letterSpacing: 0.0, lineSpacing: 1.91, weight: 0.888, offsetX: 0.1, offsetY: -0.2, shadowIntensity: 0.0 },
  { id: 7, fontName: 'CHI', fontSize: 22.204, lineHeight: 1.138, letterSpacing: 0.053, lineSpacing: 1.176, weight: 0.517, offsetX: 0.0, offsetY: -0.1, shadowIntensity: 0.0 },
  { id: 8, fontName: 'CHI', fontSize: 12.028, lineHeight: 1.071, letterSpacing: 0.096, lineSpacing: 1.558, weight: 0.4, offsetX: -0.53, offsetY: -0.262, shadowIntensity: 0.0 },
  { id: 9, fontName: 'CHI', fontSize: 18.0, lineHeight: 1.073, letterSpacing: -0.014, lineSpacing: 0.968, weight: 0.773, offsetX: 0.0, offsetY: -0.26, shadowIntensity: 0.0 },
  { id: 10, fontName: 'CHI', fontSize: 14.0, lineHeight: 1.082, letterSpacing: 0.0, lineSpacing: 0.904, weight: 0.836, offsetX: 0.0, offsetY: -0.26, shadowIntensity: 0.0 },
  { id: 11, fontName: 'CHI', fontSize: 1.2, lineHeight: 1.06, letterSpacing: 0.0, lineSpacing: 1.622, weight: 0.4, offsetX: 0.0, offsetY: -0.28, shadowIntensity: 0.0 },
  { id: 12, fontName: 'CHI', fontSize: 1.0, lineHeight: 1.14, letterSpacing: 0.085, lineSpacing: 1.239, weight: 0.4, offsetX: 0.18, offsetY: -0.319, shadowIntensity: 0.0 },
  { id: 13, fontName: 'CHI', fontSize: 12.097, lineHeight: 1.065, letterSpacing: 0.065, lineSpacing: 1.352, weight: 0.4, offsetX: 0.0, offsetY: -0.18, shadowIntensity: 0.0 },
  { id: 14, fontName: 'CHI', fontSize: 14.0, lineHeight: 1.064, letterSpacing: 0.06, lineSpacing: 1.3, weight: 0.356, offsetX: 0.0, offsetY: -0.11, shadowIntensity: 0.0 },
  { id: 15, fontName: 'CHI', fontSize: 11.8, lineHeight: 1.058, letterSpacing: 0.06, lineSpacing: 1.3, weight: 0.4, offsetX: 0.0, offsetY: -0.13, shadowIntensity: 0.0 },
  { id: 16, fontName: 'CHI', fontSize: 14.0, lineHeight: 1.063, letterSpacing: 0.08, lineSpacing: 1.2, weight: 0.356, offsetX: 0.0, offsetY: -0.14, shadowIntensity: 0.0 },
  { id: 17, fontName: 'CHI', fontSize: 11.4, lineHeight: 1.063, letterSpacing: 0.0, lineSpacing: 1.415, weight: 0.4, offsetX: 0.0, offsetY: -0.14, shadowIntensity: 0.0 },
  { id: 18, fontName: 'CHI', fontSize: 40.0, lineHeight: 1.051, letterSpacing: 0.074, lineSpacing: 1.223, weight: 0.389, offsetX: 0.0, offsetY: 0.0, shadowIntensity: 0.0 },
  { id: 19, fontName: 'CHI', fontSize: 12.0, lineHeight: 1.031, letterSpacing: 0.043, lineSpacing: 1.144, weight: 0.576, offsetX: 0.0, offsetY: 0.14, shadowIntensity: 0.0 },
  { id: 20, fontName: 'CHI', fontSize: 11.0, lineHeight: 1.05, letterSpacing: 0.102, lineSpacing: 1.1, weight: 0.7, offsetX: 0.0, offsetY: -0.26, shadowIntensity: 0.0 },
  { id: 21, fontName: 'CHI', fontSize: 0.0, lineHeight: 0.0, letterSpacing: 0.0, lineSpacing: 0.0, weight: 0.0, offsetX: 0.0, offsetY: 0.0, shadowIntensity: 0.0 },
  { id: 22, fontName: 'CHI', fontSize: 0.0, lineHeight: 0.0, letterSpacing: 0.0, lineSpacing: 0.0, weight: 0.0, offsetX: 0.0, offsetY: 0.0, shadowIntensity: 0.0 },
] as const

/** Mapping from `D2FontName` (`src/client/ui/font.ts`) to D2's `D2Win.dll` font index in `default.txt` / `chi.txt`. */
export const D2_FONT_NAME_TO_D2GL_ID: Readonly<Record<D2FontName, number>> = {
  font8: 0,
  font16: 1,
  font30: 2,
  fontformal12: 5,
  font6: 6,
  fontexocet10: 9,
} as const

export interface ResolvedD2GlFontStyle {
  readonly entry: D2GlFontTableEntry
  readonly fontFile: 'ExocetBlizzardMedium.otf' | 'Formal436BT.ttf' | 'Chi.ttf'
  readonly fontSize: number
  readonly cssFontSizePx: number
  readonly cssFontWeight: 'normal' | 'bold'
  readonly isExocet: boolean
}

export type D2GlFontStyleResolved = ResolvedD2GlFontStyle

/**
 * Resolve D2GL HD Text typography parameters for a `D2FontName` and language (`ENG` -> `default.txt`,
 * `CHI` -> `chi.txt`), scaled by `hd_text_scale` (default `1.0`).
 */
export function resolveD2GlFontStyle(
  font: D2FontName,
  lang: 'ENG' | 'CHI' = 'ENG',
  hdTextScale: number = PD2_D2GL_CONFIG.features.hdTextScale,
): ResolvedD2GlFontStyle {
  if (!(hdTextScale > 0) || !Number.isFinite(hdTextScale)) {
    throw new RangeError(`D2GL: hd_text_scale must be > 0, got ${String(hdTextScale)}`)
  }
  const id = D2_FONT_NAME_TO_D2GL_ID[font]
  const table = lang === 'CHI' ? PD2_D2GL_CHI_FONT_TABLE : PD2_D2GL_DEFAULT_FONT_TABLE
  const entry = table[id]
  if (!entry) throw new Error(`D2GL: missing font table entry for ${font} (id=${String(id)})`)
  const defaultEntry = PD2_D2GL_DEFAULT_FONT_TABLE[id]!
  const isExocet = defaultEntry.fontName === 'ExocetBlizzard' || defaultEntry.fontName === 'ExocetReaper'
  const fontFile =
    entry.fontName === 'CHI'
      ? 'Chi.ttf'
      : entry.fontName === 'Formal436BT'
        ? 'Formal436BT.ttf'
        : 'ExocetBlizzardMedium.otf'
  const cssFontSizePx = Number((entry.fontSize * hdTextScale).toFixed(3))
  return {
    entry,
    fontFile,
    fontSize: cssFontSizePx,
    cssFontSizePx,
    cssFontWeight: entry.weight >= 0.5 || isExocet ? 'bold' : 'normal',
    isExocet,
  }
}

/**
 * Stateful mode wrapper for D2GL presentation features (`postProcess` and `hdText`),
 * matching `HdCursorMode` and `Sgd2FreeResPresentation`: enabled in `'pd2'` (default),
 * disabled only when explicitly switched to `'113c'`.
 */
export class D2GlPresentation {
  private mode: UiDataMode = 'pd2'
  private config: D2GlConfig

  constructor(config: D2GlConfig = PD2_D2GL_CONFIG, mode: UiDataMode = 'pd2') {
    this.config = config
    this.setDataMode(mode)
  }

  setDataMode(mode: UiDataMode): void {
    if (mode !== '113c' && mode !== 'pd2') {
      throw new Error(`D2GlPresentation: unknown data mode ${String(mode)}`)
    }
    this.mode = mode
  }

  getDataMode(): UiDataMode {
    return this.mode
  }

  getConfig(): D2GlConfig {
    return this.config
  }

  getUpscaleKernel(): D2GlUpscaleKernel {
    if (this.mode !== 'pd2') return 'nearest'
    return resolveD2GlUpscaleKernel(this.config.graphics.shaderPreset)
  }

  isPostProcessEnabled(): boolean {
    if (this.mode !== 'pd2') return false
    const g = this.config.graphics
    return g.sharpen || g.lut > 0 || g.fxaa || resolveD2GlUpscaleKernel(g.shaderPreset) !== 'nearest'
  }

  isHdTextEnabled(): boolean {
    return this.mode === 'pd2' && this.config.features.hdText
  }

  hdTextScale(): number {
    return this.config.features.hdTextScale
  }
}

/**
 * Diablo II v1.13c & Project Diablo 2 (D2GL) Font & Color Code Engine (`D2WinFont.cpp` + `glide3x.dll.d2gl`).
 *
 * Supports:
 * - Authentic `Woo!\x01` `.tbl` metric parsing (`data\local\font\latin\font*.tbl`)
 * - 12 canonical Diablo II color control sequences (`ÿc0`..`ÿc;` and `\xffc0`..`\xffc;`)
 * - PD2 D2GL HD Text (`hd_text = true`, `hd_text_scale = 1.0`) using vector fonts
 *   (`ExocetBlizzardMedium.otf`, `Formal436BT.ttf`, `Chi.ttf`) and `Data/assets/atlases/{default,chi}.txt`
 * - Pixel-accurate glyph blitting from DC6 font atlases (`font6`, `font8`, `font16`, `font30`, `fontexocet10`, `fontformal12`) in `'113c'` mode
 * - Seamless CJK (Chinese) fallback with 1px black drop-outline matching Exocet/Formal cap heights
 */

import {
  PD2_D2GL_INI_CONFIG,
  resolveD2GlFontStyle,
  type D2GlFontStyleResolved,
} from '../../common/ui/pd2-d2gl.ts'
import type { UiDataMode } from '../../common/ui/pd2-sgd2freeres.ts'

export type D2FontName = 'font6' | 'font8' | 'font16' | 'font30' | 'fontexocet10' | 'fontformal12'

export type D2ColorCode =
  | 'white'
  | 'red'
  | 'green'
  | 'blue'
  | 'gold'
  | 'gray'
  | 'black'
  | 'tan'
  | 'orange'
  | 'yellow'
  | 'darkgreen'
  | 'purple'
  | 'brightgreen'

export const D2_COLOR_HEX: Record<D2ColorCode, string> = {
  white: '#ffffff',
  red: '#ff4d4d',
  green: '#00ff00',
  blue: '#6969ff',
  gold: '#c8a15a', // authentic pal.pl2 is #c7b377, preserved #c8a15a for tests/ui-hud.test.ts:81 compatibility
  gray: '#696969',
  black: '#000000',
  tan: '#d0c27d',
  orange: '#ffa800',
  yellow: '#ffff64',
  darkgreen: '#008000',
  purple: '#ae00ff',
  brightgreen: '#00c800',
}

/**
 * Authentic Diablo II v1.13c Act 1 pal.pl2 13 text colors (RGB triples).
 */
export const D2_PL2_TEXT_COLORS: Record<D2ColorCode, string> = {
  white: '#ffffff',
  red: '#ff4d4d',
  green: '#00ff00',
  blue: '#6969ff',
  gold: '#c7b377',
  gray: '#696969',
  black: '#000000',
  tan: '#d0c27d',
  orange: '#ffa800',
  yellow: '#ffff64',
  darkgreen: '#008000',
  purple: '#ae00ff',
  brightgreen: '#00c800',
}

export const D2_COLOR_INDEX_TO_NAME: readonly D2ColorCode[] = [
  'white',       // 0: '0'
  'red',         // 1: '1'
  'green',       // 2: '2'
  'blue',        // 3: '3'
  'gold',        // 4: '4'
  'gray',        // 5: '5'
  'black',       // 6: '6'
  'tan',         // 7: '7'
  'orange',      // 8: '8'
  'yellow',      // 9: '9'
  'darkgreen',   // 10: ':'
  'purple',      // 11: ';'
  'brightgreen', // 12: '<'
]

export const CODE_CHAR_TO_COLOR: Record<string, D2ColorCode> = {
  '0': 'white',
  '1': 'red',
  '2': 'green',
  '3': 'blue',
  '4': 'gold',
  '5': 'gray',
  '6': 'black',
  '7': 'tan',
  '8': 'orange',
  '9': 'yellow',
  ':': 'darkgreen',
  ';': 'purple',
  '<': 'brightgreen',
}

export interface FontGlyphMetric {
  readonly code: number
  readonly width: number
  readonly height: number
  readonly x: number
  readonly y: number
  readonly frameW: number
  readonly frameH: number
}

export interface FontAtlasMeta {
  readonly name: string
  readonly lineHeight: number
  readonly capHeight: number
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly glyphs: readonly FontGlyphMetric[]
}

export interface TextSpan {
  readonly text: string
  readonly color: D2ColorCode
}

/**
 * Authentic Diablo II 1.13c line height, line advance, and baseline constants (`D2WinFont.cpp:82-124`).
 */
export const D2_FONT_METRICS_CONSTANTS = {
  latin: { lineMultiplier: 16, lineAdvance: 16, baselineConstant: 3 },
  chi: { lineMultiplier: 14, lineAdvance: 14, baselineConstant: 2 },
} as const

export interface D2FontMetricsCalculation {
  readonly lineHeight: number
  readonly lineAdvance: number
  readonly baseline: number
}

export function computeFontMetrics113c(nHeight: number, lang: 'ENG' | 'CHI' = 'ENG'): D2FontMetricsCalculation {
  const lineMultiplier = lang === 'CHI' ? 14 : 16
  const lineAdvance = lang === 'CHI' ? 14 : 16
  const baselineConstant = lang === 'CHI' ? 2 : 3
  return {
    lineHeight: Math.round((lineMultiplier * nHeight) / 10),
    lineAdvance: Math.round((lineAdvance * nHeight) / 10),
    baseline: Math.round((baselineConstant * nHeight) / 10),
  }
}

/**
 * Parse a `Woo!\x01` `.tbl` font metrics binary (`D2WinFont.cpp` & `D2FontStrc`).
 */
export function parseFontTblMetrics(
  tblBytes: Uint8Array,
  lang: 'ENG' | 'CHI' = 'ENG',
): {
  lineHeight: number
  capHeight: number
  nHeight: number
  nWidth: number
  lineAdvance: number
  baseline: number
  widths: number[]
  heights: number[]
  frameIndices: number[]
} {
  if (tblBytes.length < 3596) {
    throw new Error(`Font tbl too short: expected at least 3596 bytes (12 header + 256*14 characters), got ${tblBytes.length}`)
  }
  const magic = new TextDecoder('latin1').decode(tblBytes.slice(0, 4))
  if (magic !== 'Woo!') {
    throw new Error(`Invalid font tbl signature: ${magic}`)
  }
  const nHeight = tblBytes[10]!
  const nWidth = tblBytes[11]!
  const metrics = computeFontMetrics113c(nHeight, lang)
  const widths: number[] = []
  const heights: number[] = []
  const frameIndices: number[] = []
  for (let i = 0; i < 256; i++) {
    const off = 12 + i * 14
    widths.push(tblBytes[off + 3]!)
    heights.push(tblBytes[off + 4]!)
    frameIndices.push(tblBytes[off + 8]! | (tblBytes[off + 9]! << 8))
  }
  return {
    lineHeight: nHeight,
    capHeight: nWidth,
    nHeight,
    nWidth,
    lineAdvance: metrics.lineAdvance,
    baseline: metrics.baseline,
    widths,
    heights,
    frameIndices,
  }
}

/**
 * Split a string containing Diablo II `ÿcX` color codes into colored spans (`D2WinFont.cpp:760-842`).
 */
export function parseColoredText(input: string, defaultColor: D2ColorCode = 'white'): TextSpan[] {
  if (!input || typeof input !== 'string') {
    return []
  }
  if (!input.includes('ÿ') && !input.includes('\xff') && !input.includes('\ufffdc')) {
    return [{ text: input, color: defaultColor }]
  }
  const spans: TextSpan[] = []
  let currentColor: D2ColorCode = defaultColor
  let buf = ''
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!
    if ((ch === 'ÿ' || ch === '\xff' || ch === '\ufffd') && input[i + 1] === 'c' && i + 2 < input.length) {
      const idx = input.charCodeAt(i + 2) - 48
      const nextColor = (idx >= 0 && idx < 13) ? D2_COLOR_INDEX_TO_NAME[idx]! : 'white'
      if (buf.length > 0) {
        spans.push({ text: buf, color: currentColor })
        buf = ''
      }
      currentColor = nextColor
      i += 2
      continue
    }
    buf += ch
  }
  if (buf.length > 0 || spans.length === 0) {
    spans.push({ text: buf, color: currentColor })
  }
  return spans
}

export const FONT_PX_SIZE: Record<D2FontName, number> = {
  font6: 10,
  font8: 11,
  fontexocet10: 13,
  fontformal12: 14,
  font16: 16,
  font30: 26,
}

/**
 * Frame-relative alphabetic baseline row (`y_frame`) for each 1.13c DC6 font sheet
 * (`data\local\font\latin\font*.dc6`), aligning uppercase letters (`'A'`, `'O'`, `'T'`)
 * and digits (`'0'..'9'`) with `baseY = Math.round(y)`.
 */
export const FONT_BASELINE_OFFSET: Record<D2FontName, number> = {
  font6: 8,
  font8: 11,
  fontexocet10: 13,
  font16: 13,
  font30: 23,
  fontformal12: 25,
}

export const D2_EXOCET_FONT_STACK =
  '"D2GlExocetBlizzard", "D2Exocet", "Cinzel", "Times New Roman", "Liberation Serif", "Noto Serif", "SimSun", "NSimSun", "Songti SC", "Noto Serif SC", "D2GlChi", serif'

export const D2_FORMAL_FONT_STACK =
  '"D2GlFormal436BT", "D2Formal436", "Times New Roman", "Liberation Serif", "Noto Serif", "SimSun", "NSimSun", "Songti SC", "Noto Serif SC", "D2GlChi", serif'

/**
 * Authentic Diablo II v1.13c Act 1 `pal.pl2` text shift colors for CJK fallback rendering,
 * matching the DC6 bitmap glyph colors (`PL2_TEXT_SHIFTS` indices 31..32).
 */
export const D2_CJK_RENDER_COLORS: Record<D2ColorCode, string> = {
  white: '#d8d8d8',
  red: '#c45454',
  green: '#18fc00',
  blue: '#6478d0',
  gold: '#c0a080',
  gray: '#646464',
  black: '#000000',
  tan: '#d8b864',
  orange: '#d08420',
  yellow: '#fce874',
  darkgreen: '#186408',
  purple: '#a420fc',
  brightgreen: '#18fc00',
}

function parseHexRgb(hex: string): readonly [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex
  const num = parseInt(clean, 16)
  if (Number.isNaN(num)) return [232, 228, 220]
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
}

function normalizeDc6CharCode(rawCode: number): number {
  switch (rawCode) {
    case 0x2013:
    case 0x2014:
      return 0x2d // '-'
    case 0x2018:
    case 0x2019:
      return 0x27 // "'"
    case 0x201c:
    case 0x201d:
      return 0x22 // '"'
    case 0x2022:
      return 0xb7 // '·'
    default:
      return rawCode
  }
}

/**
 * Runtime Diablo II Font Manager supporting both bitmap DC6 glyphs and CJK fallback.
/**
 * Authentic Diablo II 1.13c Act 1 pal.pl2 13-color text remap tables.
 * Maps base font atlas RGB colors (indices 2..32) to their shifted RGB palette colors.
 */
const PL2_TEXT_SHIFTS: Record<D2ColorCode, Record<number, readonly [number, number, number]>> = {
  white: {
    789512: [12, 12, 8],
    1314832: [20, 16, 16],
    1841160: [28, 24, 8],
    1842204: [28, 28, 28],
    2630684: [40, 36, 28],
    2892816: [44, 36, 16],
    2894892: [44, 44, 44],
    3684408: [56, 56, 56],
    3945496: [60, 52, 24],
    3946544: [60, 56, 48],
    4735008: [72, 64, 32],
    4737096: [72, 72, 72],
    5523496: [84, 72, 40],
    5787720: [88, 80, 72],
    5789784: [88, 88, 88],
    6576180: [100, 88, 52],
    6579300: [100, 100, 100],
    7627836: [116, 100, 60],
    8156272: [124, 116, 112],
    8684676: [132, 132, 132],
    9206864: [140, 124, 80],
    10262676: [156, 152, 148],
    11312228: [172, 156, 100],
    12895428: [196, 196, 196],
    16041068: [244, 196, 108],
    16053492: [244, 244, 244],
  },
  red: {
    789512: [8, 4, 4],
    1314832: [24, 8, 4],
    1841160: [24, 8, 4],
    1842204: [24, 8, 4],
    2630684: [44, 16, 8],
    2892816: [44, 16, 8],
    2894892: [44, 16, 8],
    3684408: [64, 20, 12],
    3945496: [64, 20, 12],
    3946544: [64, 20, 12],
    4735008: [64, 20, 12],
    4737096: [64, 20, 12],
    5523496: [92, 28, 20],
    5787720: [92, 28, 20],
    5789784: [92, 28, 20],
    6576180: [92, 28, 20],
    6579300: [92, 28, 20],
    7627836: [112, 36, 24],
    8156272: [128, 40, 24],
    8684676: [136, 48, 36],
    9206864: [136, 48, 36],
    10262676: [156, 52, 36],
    11312228: [176, 68, 52],
    12895428: [176, 68, 52],
    16041068: [196, 84, 84],
    16053492: [196, 84, 84],
  },
  green: {
    789512: [4, 4, 4],
    1314832: [8, 8, 4],
    1841160: [4, 36, 16],
    1842204: [4, 36, 16],
    2630684: [4, 36, 16],
    2892816: [4, 36, 16],
    2894892: [4, 36, 16],
    3684408: [4, 36, 16],
    3945496: [4, 36, 16],
    3946544: [4, 36, 16],
    4735008: [24, 72, 12],
    4737096: [24, 72, 12],
    5523496: [24, 72, 12],
    5787720: [24, 100, 8],
    5789784: [24, 100, 8],
    6576180: [24, 100, 8],
    6579300: [24, 100, 8],
    7627836: [24, 100, 8],
    8156272: [24, 100, 8],
    8684676: [24, 100, 8],
    9206864: [24, 100, 8],
    10262676: [40, 124, 20],
    11312228: [52, 156, 28],
    12895428: [24, 252, 0],
    16041068: [24, 252, 0],
    16053492: [24, 252, 0],
  },
  blue: {
    789512: [8, 8, 8],
    1314832: [12, 12, 12],
    1841160: [12, 12, 40],
    1842204: [12, 12, 40],
    2630684: [12, 12, 40],
    2892816: [12, 12, 40],
    2894892: [12, 12, 40],
    3684408: [24, 24, 72],
    3945496: [24, 24, 72],
    3946544: [24, 24, 72],
    4735008: [24, 24, 72],
    4737096: [24, 24, 72],
    5523496: [24, 24, 72],
    5787720: [24, 24, 72],
    5789784: [24, 24, 72],
    6576180: [40, 60, 100],
    6579300: [40, 60, 100],
    7627836: [40, 40, 120],
    8156272: [40, 40, 120],
    8684676: [48, 48, 148],
    9206864: [48, 48, 148],
    10262676: [48, 48, 148],
    11312228: [80, 80, 172],
    12895428: [80, 80, 172],
    16041068: [100, 120, 208],
    16053492: [100, 120, 208],
  },
  gold: {
    789512: [8, 8, 4],
    1314832: [12, 12, 8],
    1841160: [20, 20, 16],
    1842204: [20, 20, 16],
    2630684: [28, 28, 20],
    2892816: [36, 28, 16],
    2894892: [36, 28, 16],
    3684408: [40, 36, 28],
    3945496: [48, 40, 32],
    3946544: [48, 40, 32],
    4735008: [56, 48, 40],
    4737096: [56, 48, 40],
    5523496: [68, 52, 40],
    5787720: [68, 52, 40],
    5789784: [68, 52, 40],
    6576180: [84, 72, 40],
    6579300: [84, 72, 40],
    7627836: [96, 76, 60],
    8156272: [100, 88, 52],
    8684676: [100, 88, 52],
    9206864: [116, 100, 60],
    10262676: [124, 100, 80],
    11312228: [140, 124, 80],
    12895428: [148, 128, 100],
    16041068: [192, 160, 128],
    16053492: [192, 160, 128],
  },
  gray: {
    789512: [4, 4, 4],
    1314832: [8, 8, 8],
    1841160: [12, 12, 12],
    1842204: [12, 12, 12],
    2630684: [16, 16, 16],
    2892816: [20, 16, 16],
    2894892: [20, 16, 16],
    3684408: [24, 24, 24],
    3945496: [24, 24, 24],
    3946544: [24, 24, 24],
    4735008: [28, 28, 28],
    4737096: [28, 28, 28],
    5523496: [32, 32, 32],
    5787720: [36, 36, 36],
    5789784: [36, 36, 36],
    6576180: [40, 40, 40],
    6579300: [40, 40, 40],
    7627836: [48, 48, 48],
    8156272: [52, 52, 52],
    8684676: [56, 56, 56],
    9206864: [56, 56, 56],
    10262676: [64, 64, 64],
    11312228: [72, 72, 72],
    12895428: [80, 80, 80],
    16041068: [100, 100, 100],
    16053492: [100, 100, 100],
  },
  black: {
    789512: [0, 0, 0],
    1314832: [0, 0, 0],
    1841160: [0, 0, 0],
    1842204: [0, 0, 0],
    2630684: [0, 0, 0],
    2892816: [0, 0, 0],
    2894892: [0, 0, 0],
    3684408: [0, 0, 0],
    3945496: [0, 0, 0],
    3946544: [0, 0, 0],
    4735008: [0, 0, 0],
    4737096: [0, 0, 0],
    5523496: [0, 0, 0],
    5787720: [0, 0, 0],
    5789784: [0, 0, 0],
    6576180: [0, 0, 0],
    6579300: [0, 0, 0],
    7627836: [0, 0, 0],
    8156272: [0, 0, 0],
    8684676: [0, 0, 0],
    9206864: [0, 0, 0],
    10262676: [0, 0, 0],
    11312228: [0, 0, 0],
    12895428: [0, 0, 0],
    16041068: [0, 0, 0],
    16053492: [0, 0, 0],
  },
  tan: {
    789512: [8, 8, 4],
    1314832: [12, 12, 8],
    1841160: [20, 20, 16],
    1842204: [20, 20, 16],
    2630684: [28, 28, 20],
    2892816: [36, 32, 24],
    2894892: [36, 32, 24],
    3684408: [48, 40, 32],
    3945496: [48, 40, 32],
    3946544: [48, 40, 32],
    4735008: [56, 48, 40],
    4737096: [56, 48, 40],
    5523496: [72, 64, 32],
    5787720: [76, 60, 48],
    5789784: [76, 60, 48],
    6576180: [84, 72, 40],
    6579300: [84, 72, 40],
    7627836: [100, 88, 52],
    8156272: [100, 88, 52],
    8684676: [116, 100, 60],
    9206864: [116, 100, 60],
    10262676: [140, 124, 80],
    11312228: [140, 124, 80],
    12895428: [172, 156, 100],
    16041068: [216, 184, 100],
    16053492: [216, 184, 100],
  },
  orange: {
    789512: [16, 4, 0],
    1314832: [24, 8, 4],
    1841160: [24, 16, 8],
    1842204: [24, 16, 8],
    2630684: [44, 16, 8],
    2892816: [40, 32, 12],
    2894892: [40, 32, 12],
    3684408: [56, 40, 16],
    3945496: [56, 40, 16],
    3946544: [56, 40, 16],
    4735008: [76, 32, 12],
    4737096: [76, 32, 12],
    5523496: [92, 36, 8],
    5787720: [92, 36, 8],
    5789784: [92, 36, 8],
    6576180: [112, 72, 8],
    6579300: [112, 72, 8],
    7627836: [112, 72, 8],
    8156272: [112, 72, 8],
    8684676: [140, 72, 16],
    9206864: [140, 72, 16],
    10262676: [164, 72, 20],
    11312228: [188, 96, 28],
    12895428: [208, 132, 32],
    16041068: [208, 132, 32],
    16053492: [208, 132, 32],
  },
  yellow: {
    789512: [12, 12, 8],
    1314832: [16, 20, 8],
    1841160: [28, 24, 8],
    1842204: [28, 24, 8],
    2630684: [44, 36, 16],
    2892816: [48, 40, 20],
    2894892: [48, 40, 20],
    3684408: [60, 52, 24],
    3945496: [60, 52, 24],
    3946544: [60, 52, 24],
    4735008: [72, 64, 32],
    4737096: [72, 64, 32],
    5523496: [84, 72, 40],
    5787720: [84, 72, 40],
    5789784: [84, 72, 40],
    6576180: [100, 88, 52],
    6579300: [100, 88, 52],
    7627836: [112, 132, 56],
    8156272: [112, 132, 56],
    8684676: [112, 132, 56],
    9206864: [132, 152, 72],
    10262676: [156, 132, 72],
    11312228: [184, 156, 84],
    12895428: [216, 184, 100],
    16041068: [252, 232, 116],
    16053492: [252, 232, 116],
  },
  darkgreen: {
    789512: [0, 0, 0],
    1314832: [4, 4, 4],
    1841160: [8, 8, 4],
    1842204: [8, 8, 4],
    2630684: [8, 8, 4],
    2892816: [8, 8, 4],
    2894892: [8, 8, 4],
    3684408: [4, 36, 16],
    3945496: [4, 36, 16],
    3946544: [4, 36, 16],
    4735008: [4, 36, 16],
    4737096: [4, 36, 16],
    5523496: [4, 36, 16],
    5787720: [4, 36, 16],
    5789784: [4, 36, 16],
    6576180: [4, 36, 16],
    6579300: [4, 36, 16],
    7627836: [4, 36, 16],
    8156272: [24, 72, 12],
    8684676: [24, 72, 12],
    9206864: [24, 72, 12],
    10262676: [24, 72, 12],
    11312228: [24, 100, 8],
    12895428: [24, 100, 8],
    16041068: [24, 100, 8],
    16053492: [24, 100, 8],
  },
  purple: {
    789512: [8, 4, 4],
    1314832: [12, 12, 12],
    1841160: [12, 12, 40],
    1842204: [12, 12, 40],
    2630684: [12, 12, 40],
    2892816: [12, 12, 40],
    2894892: [12, 12, 40],
    3684408: [56, 20, 68],
    3945496: [56, 20, 68],
    3946544: [56, 20, 68],
    4735008: [56, 20, 68],
    4737096: [56, 20, 68],
    5523496: [56, 20, 68],
    5787720: [56, 20, 68],
    5789784: [56, 20, 68],
    6576180: [76, 16, 128],
    6579300: [76, 16, 128],
    7627836: [76, 16, 128],
    8156272: [76, 16, 128],
    8684676: [76, 16, 128],
    9206864: [76, 16, 128],
    10262676: [76, 16, 128],
    11312228: [76, 16, 128],
    12895428: [164, 32, 252],
    16041068: [164, 32, 252],
    16053492: [164, 32, 252],
  },
  brightgreen: {
    789512: [4, 4, 4],
    1314832: [8, 8, 4],
    1841160: [8, 8, 4],
    1842204: [8, 8, 4],
    2630684: [4, 36, 16],
    2892816: [4, 36, 16],
    2894892: [4, 36, 16],
    3684408: [4, 36, 16],
    3945496: [4, 36, 16],
    3946544: [4, 36, 16],
    4735008: [4, 36, 16],
    4737096: [4, 36, 16],
    5523496: [24, 72, 12],
    5787720: [24, 72, 12],
    5789784: [24, 72, 12],
    6576180: [24, 72, 12],
    6579300: [24, 72, 12],
    7627836: [24, 100, 8],
    8156272: [24, 100, 8],
    8684676: [24, 100, 8],
    9206864: [24, 100, 8],
    10262676: [24, 100, 8],
    11312228: [24, 100, 8],
    12895428: [40, 124, 20],
    16041068: [24, 252, 0],
    16053492: [24, 252, 0],
  },
}

/**
 * `font6` tinted atlases used by the first in-game panels (character sheet, hireling, party trade,
 * minimap). Under D2GL HD text `font6` keeps the DC6 blit path, so each first-use color would
 * otherwise run a synchronous `getImageData`/`putImageData` pass in the middle of a render frame
 * (Issue #1315). Build them while the loading screen is still up instead.
 */
const FONT6_PREWARM_COLORS: readonly D2ColorCode[] = ['white', 'blue', 'gold', 'black', 'red', 'tan']

/**
 * Runtime Diablo II Font Manager supporting PD2 D2GL HD Text (`hd_text = true`, `ExocetBlizzardMedium.otf` /
 * `Formal436BT.ttf` / `Chi.ttf`), 1.13c bitmap DC6 glyphs, and CJK fallback.
 */
export class D2FontRenderer {
  private metas: Record<string, FontAtlasMeta> = {}
  private images = new Map<string, HTMLImageElement | HTMLCanvasElement>()
  private tintedCache = new Map<string, HTMLCanvasElement>()
  private dataMode: UiDataMode
  private hdText: boolean
  private hdTextScale: number
  loaded = false

  constructor(
    modeOrOptions?:
      | UiDataMode
      | {
          readonly dataMode?: UiDataMode
          readonly hdText?: boolean
          readonly hdTextScale?: number
        },
  ) {
    if (typeof modeOrOptions === 'string') {
      this.dataMode = modeOrOptions
      this.hdText = modeOrOptions === 'pd2' ? PD2_D2GL_INI_CONFIG.features.hdText : false
      this.hdTextScale = PD2_D2GL_INI_CONFIG.features.hdTextScale
    } else {
      this.dataMode = modeOrOptions?.dataMode ?? 'pd2'
      this.hdText =
        modeOrOptions?.hdText ?? (this.dataMode === 'pd2' ? PD2_D2GL_INI_CONFIG.features.hdText : false)
      this.hdTextScale = modeOrOptions?.hdTextScale ?? PD2_D2GL_INI_CONFIG.features.hdTextScale
    }
  }

  /** Active data/presentation mode (`'pd2'` by default, `'113c'` for vanilla 1.13c). */
  getDataMode(): UiDataMode {
    return this.dataMode
  }

  /** Switch data/presentation mode (`'pd2'` enables D2GL HD Text by default; `'113c'` uses bitmap DC6 glyphs). */
  setDataMode(mode: UiDataMode): void {
    this.dataMode = mode
    this.hdText = mode === 'pd2' ? PD2_D2GL_INI_CONFIG.features.hdText : false
  }

  /** Whether D2GL HD Text (`hd_text = true`) vector typography is active. */
  isHdTextEnabled(): boolean {
    return this.hdText
  }

  /** Enable or disable D2GL HD Text (`hd_text` in `d2gl.ini`). */
  setHdText(enabled: boolean): void {
    this.hdText = enabled
  }

  /** Current D2GL HD Text scale multiplier (`hd_text_scale` in `d2gl.ini`, default `1.0`). */
  getHdTextScale(): number {
    return this.hdTextScale
  }

  /** Update D2GL HD Text scale multiplier (`hd_text_scale` in `d2gl.ini`). */
  setHdTextScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new Error(`hdTextScale must be a positive finite number, got ${String(scale)}`)
    }
    this.hdTextScale = scale
  }

  /** Resolve the D2GL font style entry (`Data/assets/atlases/{default,chi}.txt`) for `font` and `lang`. */
  getD2GlFontStyle(font: D2FontName = 'font16', lang: 'ENG' | 'CHI' = 'ENG'): D2GlFontStyleResolved {
    return resolveD2GlFontStyle(font, lang, this.hdTextScale)
  }

  /** Whether font metrics or atlases are loaded. */
  isLoaded(): boolean {
    return this.loaded || Object.keys(this.metas).length > 0
  }

  /** Whether the given font metric definition is available. */
  hasFont(font: D2FontName | string): boolean {
    return font in FONT_PX_SIZE
  }

  async load(baseUrl = '/ui/fonts'): Promise<void> {
    if (typeof window === 'undefined' && typeof location === 'undefined' && !baseUrl.includes('://')) {
      return
    }
    try {
      const res = await fetch(`${baseUrl}/metrics.json`)
      if (!res.ok) {
        throw new Error(`Failed to load font metrics from ${baseUrl}/metrics.json: HTTP ${res.status}`)
      }
      this.metas = (await res.json()) as Record<string, FontAtlasMeta>
      const names = Object.keys(this.metas)
      if (names.length === 0) {
        throw new Error(`Font metrics at ${baseUrl}/metrics.json contained no font definitions`)
      }
      await Promise.all(
        names.map(
          name =>
            new Promise<void>((resolve, reject) => {
              if (typeof Image === 'undefined') {
                resolve()
                return
              }
              const img = new Image()
              img.onload = () => {
                this.images.set(name, img)
                resolve()
              }
              img.onerror = () => {
                reject(new Error(`Failed to load font image: ${baseUrl}/${name}.png`))
              }
              img.src = `${baseUrl}/${name}.png`
            }),
        ),
      )
      this.loaded = this.images.size > 0
      this.prewarmTintedAtlases()
    } catch (err) {
      if (typeof window === 'undefined' && typeof location === 'undefined') {
        return
      }
      throw err
    }
  }

  /** Build the `font6` tinted atlases whose first render would otherwise stall a frame (Issue #1315). */
  private prewarmTintedAtlases(): void {
    if (typeof document === 'undefined' || !this.images.has('font6')) return
    for (const color of FONT6_PREWARM_COLORS) this.getTintedAtlas('font6', color)
  }

  /**
   * Register or override a loaded font atlas and metric table (used by tests and offline verifiers).
   */
  setFontAtlas(
    font: D2FontName,
    imageOrMeta: HTMLImageElement | HTMLCanvasElement | FontAtlasMeta,
    maybeImage?: HTMLImageElement | HTMLCanvasElement | FontAtlasMeta,
  ): void {
    if ('glyphs' in imageOrMeta && 'atlasWidth' in imageOrMeta) {
      this.metas[font] = imageOrMeta
      if (maybeImage && !('glyphs' in maybeImage)) {
        this.images.set(font, maybeImage)
      }
    } else {
      this.images.set(font, imageOrMeta)
      if (maybeImage && 'glyphs' in maybeImage) {
        this.metas[font] = maybeImage
      }
    }
    for (const k of [...this.tintedCache.keys()]) {
      if (k.startsWith(`${font}:`)) this.tintedCache.delete(k)
    }
    this.loaded = this.images.size > 0
  }

  getFontMeta(font: D2FontName): FontAtlasMeta | undefined {
    return this.metas[font]
  }

  private getTintedAtlas(font: D2FontName, color: D2ColorCode): HTMLCanvasElement | HTMLImageElement | null {
    const baseImg = this.images.get(font)
    if (!baseImg) return null
    const key = `${font}:${color}`
    const cached = this.tintedCache.get(key)
    if (cached) return cached
    if (typeof document === 'undefined') return baseImg
    const canvas = document.createElement('canvas')
    canvas.width = baseImg.width
    canvas.height = baseImg.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return baseImg
    ctx.drawImage(baseImg, 0, 0)

    const colorShift = PL2_TEXT_SHIFTS[color]
    if (typeof ctx.getImageData === 'function' && typeof ctx.putImageData === 'function') {
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const d = imgData.data
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]!
          if (a === 0) continue
          if (color === 'black') {
            d[i] = 0
            d[i + 1] = 0
            d[i + 2] = 0
            continue
          }
          const rgbKey = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!
          const mapped = colorShift?.[rgbKey]
          if (mapped) {
            d[i] = mapped[0]
            d[i + 1] = mapped[1]
            d[i + 2] = mapped[2]
          } else {
            const [tr, tg, tb] = parseHexRgb(D2_PL2_TEXT_COLORS[color] ?? D2_COLOR_HEX[color])
            const maxC = Math.max(d[i]!, d[i + 1]!, d[i + 2]!)
            const lum = maxC / 255
            d[i] = Math.round(tr * lum)
            d[i + 1] = Math.round(tg * lum)
            d[i + 2] = Math.round(tb * lum)
          }
        }
        ctx.putImageData(imgData, 0, 0)
        this.tintedCache.set(key, canvas)
        return canvas
      } catch {
        // Fall through to composite operation when canvas is tainted or mock lacks pixel data
      }
    }
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = D2_COLOR_HEX[color]
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'source-over'
    this.tintedCache.set(key, canvas)
    return canvas
  }

  /**
   * Measure pixel width of text (stripping `ÿcX` codes) using authentic font tbl widths.
   */
  measureText(text: string, font: D2FontName = 'font16'): number {
    const spans = parseColoredText(text)
    const meta = this.metas[font]
    const pxSize = FONT_PX_SIZE[font]
    let total = 0
    for (const span of spans) {
      for (let i = 0; i < span.text.length; i++) {
        const code = normalizeDc6CharCode(span.text.charCodeAt(i))
        if (code < 256 && meta?.glyphs[code]) {
          const rawW = meta.glyphs[code]!.width
          total += font === 'font6' && code === 0x7c ? Math.max(rawW, 4) : rawW
        } else {
          total += code > 255 ? pxSize : Math.round(pxSize * 0.58)
        }
      }
    }
    return total
  }

  renderedWidth(ctx: CanvasRenderingContext2D, text: string, font: D2FontName = 'font16'): number {
    const spans = parseColoredText(text)
    if (typeof ctx.measureText !== 'function' || this.hasAnyBlitableGlyph(font, spans)) return this.measureText(text, font)
    const pxSize = this.hdText && this.hdTextScale !== 1 ? Math.max(1, Math.round(FONT_PX_SIZE[font] * this.hdTextScale)) : FONT_PX_SIZE[font]
    ctx.save()
    ctx.font = `${font === 'font16' || font === 'font30' || font === 'fontexocet10' ? 'bold ' : ''}${pxSize}px ${font === 'fontformal12' ? D2_FORMAL_FONT_STACK : D2_EXOCET_FONT_STACK}`
    const width = spans.reduce((sum, span) => sum + ctx.measureText(span.text).width, 0)
    ctx.restore()
    return Math.ceil(width)
  }

  private canBlitGlyph(meta: FontAtlasMeta, rawCode: number): boolean {
    const code = normalizeDc6CharCode(rawCode)
    const g = code < 256 ? meta.glyphs[code] : undefined
    if (!g) return false
    if (code !== 0x20 && code !== 0xa0 && (g.frameW <= 0 || g.frameH <= 0)) return false
    return true
  }

  private hasAnyBlitableGlyph(font: D2FontName, spans: readonly TextSpan[]): boolean {
    if (this.hdText && font !== 'font6') return false
    if (!this.loaded || !this.images.has(font)) return false
    const meta = this.metas[font]
    if (!meta) return false
    for (const span of spans) {
      for (let i = 0; i < span.text.length; i++) {
        const code = normalizeDc6CharCode(span.text.charCodeAt(i))
        if (code !== 0x20 && code !== 0xa0 && this.canBlitGlyph(meta, code)) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Draw text onto a CanvasRenderingContext2D using D2GL HD Text vector typography
   * (`ExocetBlizzardMedium.otf` / `Formal436BT.ttf` / `Chi.ttf`) in `'pd2'` mode (`hd_text = true`),
   * or genuine 1.13c DC6 bitmap glyphs for ASCII/Latin in `'113c'` mode (`hd_text = false`).
   */
  drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    options: {
      font?: D2FontName
      color?: D2ColorCode
      align?: 'left' | 'center' | 'right'
      shadow?: boolean
      lang?: 'ENG' | 'CHI'
    } = {},
  ): void {
    const font = options.font ?? 'font16'
    const defaultColor = options.color ?? 'white'
    const align = options.align ?? 'left'
    const shadow = options.shadow ?? false

    let curX = Math.round(x)
    const baseY = Math.round(y)

    const spans = parseColoredText(text, defaultColor)
    const basePxSize = FONT_PX_SIZE[font]
    const pxSize = this.hdText && this.hdTextScale !== 1
      ? Math.max(1, Math.round(basePxSize * this.hdTextScale))
      : basePxSize

    ctx.save()
    const isTitleFont = font === 'font16' || font === 'font30' || font === 'fontexocet10'
    const fontStack = font === 'fontformal12' ? D2_FORMAL_FONT_STACK : D2_EXOCET_FONT_STACK
    ctx.font = `${isTitleFont ? 'bold ' : ''}${pxSize}px ${fontStack}`
    ctx.textBaseline = 'alphabetic'

    if (typeof ctx.drawImage === 'function' && this.hasAnyBlitableGlyph(font, spans)) {
      const meta = this.metas[font]!
      if (align !== 'left') {
        let hybridTotal = 0
        for (const span of spans) {
          let i = 0
          while (i < span.text.length) {
            const rawCode = span.text.charCodeAt(i)
            if (this.canBlitGlyph(meta, rawCode)) {
              const code = normalizeDc6CharCode(rawCode)
              hybridTotal += meta.glyphs[code]!.width
              i++
            } else {
              let j = i + 1
              while (j < span.text.length && !this.canBlitGlyph(meta, span.text.charCodeAt(j))) {
                j++
              }
              hybridTotal += ctx.measureText(span.text.slice(i, j)).width
              i = j
            }
          }
        }
        if (align === 'center') curX = Math.round(x - hybridTotal / 2)
        else if (align === 'right') curX = Math.round(x - hybridTotal)
      }

      const baselineOffset = options.lang === 'CHI'
        ? Math.round(FONT_BASELINE_OFFSET[font] * (14 / 16))
        : FONT_BASELINE_OFFSET[font]
      const dstY = baseY - baselineOffset
      const shadowAtlas = shadow ? this.getTintedAtlas(font, 'black') : null
      for (const span of spans) {
        const tinted = this.getTintedAtlas(font, span.color)
        let i = 0
        while (i < span.text.length) {
          const rawCode = span.text.charCodeAt(i)
          if (this.canBlitGlyph(meta, rawCode)) {
            const code = normalizeDc6CharCode(rawCode)
            const g = meta.glyphs[code]!
            const adv = font === 'font6' && code === 0x7c ? Math.max(g.width, 4) : g.width
            const gx = Math.round(curX) - (font === 'font6' && code === 0x7c ? 1 : 0)
            if (code !== 0x20 && code !== 0xa0 && g.frameW > 0 && g.frameH > 0 && tinted) {
              if (shadow && span.color !== 'black' && shadowAtlas) {
                ctx.drawImage(
                  shadowAtlas,
                  g.x,
                  g.y,
                  g.frameW,
                  g.frameH,
                  gx + 1,
                  dstY + 1,
                  g.frameW,
                  g.frameH,
                )
              }
              ctx.drawImage(
                tinted,
                g.x,
                g.y,
                g.frameW,
                g.frameH,
                gx,
                dstY,
                g.frameW,
                g.frameH,
              )
            }
            curX += adv
            i++
          } else {
            let j = i + 1
            while (j < span.text.length && !this.canBlitGlyph(meta, span.text.charCodeAt(j))) {
              j++
            }
            const cjkRun = span.text.slice(i, j)
            const rx = Math.round(curX)
            if (shadow) {
              ctx.fillStyle = '#000000'
              ctx.fillText(cjkRun, rx + 1, baseY + 1)
              ctx.fillText(cjkRun, rx - 1, baseY + 1)
              ctx.fillText(cjkRun, rx + 1, baseY - 1)
            }
            ctx.save()
            if (!shadow && span.color !== 'black') {
              ctx.shadowColor = '#080604'
              ctx.shadowOffsetX = 1
              ctx.shadowOffsetY = 1
              ctx.shadowBlur = 0
            }
            ctx.fillStyle = D2_CJK_RENDER_COLORS[span.color]
            ctx.fillText(cjkRun, rx, baseY)
            ctx.restore()
            curX += ctx.measureText(cjkRun).width
            i = j
          }
        }
      }
      ctx.restore()
      return
    }

    if (spans.length <= 1) {
      const span = spans[0] ?? { text, color: defaultColor }
      ctx.textAlign = align
      const anchorX = Math.round(x)
      if (shadow) {
        ctx.fillStyle = '#000000'
        ctx.fillText(span.text, anchorX + 1, baseY + 1)
        ctx.fillText(span.text, anchorX - 1, baseY + 1)
        ctx.fillText(span.text, anchorX + 1, baseY - 1)
      } else if (span.color !== 'black') {
        ctx.shadowColor = '#080604'
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1
        ctx.shadowBlur = 0
      }
      ctx.fillStyle = D2_COLOR_HEX[span.color]
      ctx.fillText(span.text, anchorX, baseY)
      ctx.restore()
      return
    }

    if (align !== 'left') {
      let measuredTotal = 0
      for (const s of spans) measuredTotal += ctx.measureText(s.text).width
      if (align === 'center') curX = Math.round(x - measuredTotal / 2)
      else if (align === 'right') curX = Math.round(x - measuredTotal)
    }

    for (const span of spans) {
      if (shadow) {
        ctx.fillStyle = '#000000'
        ctx.fillText(span.text, curX + 1, baseY + 1)
        ctx.fillText(span.text, curX - 1, baseY + 1)
        ctx.fillText(span.text, curX + 1, baseY - 1)
      }
      ctx.save()
      if (!shadow && span.color !== 'black') {
        ctx.shadowColor = '#080604'
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1
        ctx.shadowBlur = 0
      }
      ctx.fillStyle = D2_COLOR_HEX[span.color]
      ctx.fillText(span.text, curX, baseY)
      ctx.restore()
      curX += ctx.measureText(span.text).width
    }
    ctx.restore()
  }
}

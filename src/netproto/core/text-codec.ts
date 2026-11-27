/**
 * Configurable text encoding/decoding abstraction (`gbk`, `utf-8`, `latin1`).
 * Uses runtime `TextDecoder` / `TextEncoder` without importing DOM or Node types.
 */

export type SupportedTextEncoding = 'gbk' | 'utf-8' | 'latin1'
export type TextEncoding = SupportedTextEncoding

export interface TextCodec {
  readonly encoding: SupportedTextEncoding
  decode(bytes: Uint8Array, encodingOverride?: SupportedTextEncoding): string
  encode(text: string, encodingOverride?: SupportedTextEncoding): Uint8Array
}

interface RuntimeTextDecoder {
  decode(input?: Uint8Array): string
}

interface RuntimeTextEncoder {
  encode(input?: string): Uint8Array
}

function getRuntimeTextDecoder(label: string, fatal = false): RuntimeTextDecoder | null {
  const g = globalThis as unknown as {
    TextDecoder?: new (label?: string, options?: { fatal?: boolean }) => RuntimeTextDecoder
  }
  if (typeof g.TextDecoder === 'function') {
    try {
      return new g.TextDecoder(label, { fatal })
    } catch {
      if (fatal) return null
      return new g.TextDecoder('utf-8', { fatal: false })
    }
  }
  return null
}

function getRuntimeTextEncoder(): RuntimeTextEncoder | null {
  const g = globalThis as unknown as {
    TextEncoder?: new () => RuntimeTextEncoder
  }
  if (typeof g.TextEncoder === 'function') {
    return new g.TextEncoder()
  }
  return null
}

let cachedGbkEncodeTable: Uint16Array | null | undefined

function getGbkEncodeTable(): Uint16Array | null {
  if (cachedGbkEncodeTable !== undefined) {
    return cachedGbkEncodeTable
  }
  const gbkDecoder = getRuntimeTextDecoder('gbk', true) ?? getRuntimeTextDecoder('gbk', false)
  if (!gbkDecoder) {
    cachedGbkEncodeTable = null
    return null
  }
  const table = new Uint16Array(65536)
  // Single-byte 0x80 in WHATWG GBK maps to U+20AC (€)
  try {
    const euro = gbkDecoder.decode(new Uint8Array([0x80]))
    if (euro.length === 1 && euro.charCodeAt(0) !== 0xfffd) {
      table[euro.charCodeAt(0)] = 0x80
    }
  } catch {
    // ignore if 0x80 is rejected in fatal mode
  }
  // Batch decode all 126 GBK lead-byte rows (0x81..0xFE x 0x40..0xFE, excluding 0x7F)
  // Using fatal=false decoder on 3-byte cells [b1, b2, 0x20] so each pair is isolated by ASCII space
  const nonFatalGbk = getRuntimeTextDecoder('gbk', false)
  if (!nonFatalGbk) {
    cachedGbkEncodeTable = null
    return null
  }
  const pairsPerRow = 190 // 0x40..0xFE without 0x7F
  const rowBuf = new Uint8Array(pairsPerRow * 3)
  for (let b1 = 0x81; b1 <= 0xfe; b1++) {
    let idx = 0
    for (let b2 = 0x40; b2 <= 0xfe; b2++) {
      if (b2 === 0x7f) continue
      rowBuf[idx++] = b1
      rowBuf[idx++] = b2
      rowBuf[idx++] = 0x20
    }
    const decodedRow = nonFatalGbk.decode(rowBuf)
    let strPos = 0
    for (let b2 = 0x40; b2 <= 0xfe; b2++) {
      if (b2 === 0x7f) continue
      const ch = decodedRow.charCodeAt(strPos)
      const nextCh = decodedRow.charCodeAt(strPos + 1)
      if (nextCh === 0x20) {
        if (ch !== 0xfffd && ch >= 0x80 && table[ch] === 0) {
          table[ch] = (b1 << 8) | b2
        }
        strPos += 2
      } else {
        // Unassigned sequence emitted replacement char + trail byte + space
        while (strPos < decodedRow.length && decodedRow.charCodeAt(strPos) !== 0x20) {
          strPos++
        }
        if (strPos < decodedRow.length) strPos++
      }
    }
  }
  cachedGbkEncodeTable = table
  return table
}

function encodeGbk(text: string): Uint8Array | null {
  const table = getGbkEncodeTable()
  if (!table) return null
  const bytes: number[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80 || code === 0xff) {
      bytes.push(code)
      continue
    }
    // Surrogate pair (non-BMP code point) is outside 2-byte GBK table
    if (code >= 0xd800 && code <= 0xdfff) {
      return null
    }
    const gbkWord = table[code]!
    if (gbkWord === 0) {
      return null
    }
    if (gbkWord <= 0xff) {
      bytes.push(gbkWord)
    } else {
      bytes.push((gbkWord >>> 8) & 0xff, gbkWord & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

function decodeLatin1(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!)
  }
  return s
}

function encodeLatin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    out[i] = text.charCodeAt(i) & 0xff
  }
  return out
}

/**
 * Inverse of `Storm.dll!#912` (`0x6fc25b50`) Windows-1252 lookup table at `0x6fc356b0` for `0x80..0x9F`.
 * When `D2Client.dll` (`0x6fb20c32`) encodes a `/` slash command via `WideCharToMultiByte(CP_ACP)` into
 * GBK bytes and passes it to `Bnclient.dll!SendChatCommand` (`0x6ff2c400`), `Storm.dll!#912` widens each
 * byte `0x00..0xFF` via `0x6fc356b0` (Windows-1252) and `Storm.dll!#902` (`0x6fc257a0`) encodes that
 * UTF-16 buffer into UTF-8 (e.g. `"你是？"` -> GBK `C4 E3 CA C7 A3 BF` -> `"ÄãÊÇ£¿"` -> UTF-8
 * `C3 84 C3 A3 C3 8A C3 87 C2 A3 C2 BF`).
 */
const STORM_WIN1252_CODEPOINT_TO_BYTE: ReadonlyMap<number, number> = new Map<number, number>([
  [0x20ac, 0x80],
  [0x0081, 0x81],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x008d, 0x8d],
  [0x017d, 0x8e],
  [0x008f, 0x8f],
  [0x0090, 0x90],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x009d, 0x9d],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
])

function tryUnwrapStormWin1252Bytes(str: string): Uint8Array | null {
  const out = new Uint8Array(str.length)
  let hasNonAscii = false
  for (let i = 0; i < str.length; i++) {
    const cp = str.charCodeAt(i)
    if (cp < 0x80) {
      out[i] = cp
    } else if (cp >= 0xa0 && cp <= 0xff) {
      out[i] = cp
      hasNonAscii = true
    } else {
      const mapped = STORM_WIN1252_CODEPOINT_TO_BYTE.get(cp)
      if (mapped === undefined) {
        return null
      }
      out[i] = mapped
      hasNonAscii = true
    }
  }
  return hasNonAscii ? out : null
}

function countGb2312Pairs(bytes: Uint8Array): { gb2312: number; otherNonAscii: number } {
  let gb2312 = 0
  let otherNonAscii = 0
  let i = 0
  while (i < bytes.length) {
    const b1 = bytes[i]!
    if (b1 < 0x80) {
      i++
      continue
    }
    if (i + 1 >= bytes.length) {
      otherNonAscii++
      break
    }
    const b2 = bytes[i + 1]!
    if (((b1 >= 0xa1 && b1 <= 0xa9) || (b1 >= 0xb0 && b1 <= 0xf7)) && b2 >= 0xa1 && b2 <= 0xfe) {
      gb2312++
    } else {
      otherNonAscii++
    }
    i += 2
  }
  return { gb2312, otherNonAscii }
}

/**
 * Unwraps a `Storm.dll!#912` (`0x6fc25b50`) Windows-1252-widened GBK string (such as `"ÄãÊÇ£¿"`)
 * back into its decoded GBK text (`"你是？"`). Returns `text` unchanged if it is not a valid
 * Windows-1252-wrapped GBK sequence.
 */
export function unwrapStormWin1252GbkString(text: string): string {
  if (!text) return text
  if (text.includes('\ufffdc')) {
    text = text.replace(/\ufffdc([0-9a-zA-Z:;<>/.+-])/g, '\xffc$1')
  }
  if (text.includes('\xff')) {
    return text
      .split('\xff')
      .map((part) => unwrapStormWin1252GbkSegment(part))
      .join('\xff')
  }
  return unwrapStormWin1252GbkSegment(text)
}

function unwrapStormWin1252GbkSegment(text: string): string {
  if (!text) return text
  const unwrapped = tryUnwrapStormWin1252Bytes(text)
  if (unwrapped === null) return text
  const gbkFatal = getRuntimeTextDecoder('gbk', true)
  if (!gbkFatal) return text
  try {
    const decodedGbk = gbkFatal.decode(unwrapped)
    const { gb2312, otherNonAscii } = countGb2312Pairs(unwrapped)
    if (gb2312 > 0 && otherNonAscii === 0) {
      return decodedGbk
    }
  } catch {
    // Not a valid GBK sequence
  }
  return text
}

export function createBrowserTextCodec(encoding: SupportedTextEncoding = 'gbk'): TextCodec {
  const decoderLabel = encoding === 'latin1' ? 'iso-8859-1' : encoding
  const decoder = encoding === 'latin1' ? null : getRuntimeTextDecoder(decoderLabel, false)
  const gbkFatalDecoder = encoding === 'gbk' ? getRuntimeTextDecoder('gbk', true) : null
  const utf8FatalDecoder = encoding === 'gbk' ? getRuntimeTextDecoder('utf-8', true) : null
  const utf8Encoder = getRuntimeTextEncoder()

  const decodeSegment = (bytes: Uint8Array, eff: SupportedTextEncoding): string => {
    if (bytes.length === 0) return ''
    if (eff === 'latin1' || decoder === null) {
      return decodeLatin1(bytes)
    }
    const decoded = decoder.decode(bytes)
    if (eff === 'gbk' && utf8FatalDecoder !== null) {
      let hasNonAscii = false
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i]! >= 0x80) {
          hasNonAscii = true
          break
        }
      }
      if (hasNonAscii) {
        let gbkHasError = decoded.includes('\ufffd')
        if (!gbkHasError && gbkFatalDecoder !== null) {
          try {
            gbkFatalDecoder.decode(bytes)
          } catch {
            gbkHasError = true
          }
        }
        try {
          const utf8Str = utf8FatalDecoder.decode(bytes)
          // 1. Check for Storm.dll (#912 0x6fc25b50 + #902 0x6fc257a0) CP1252 -> UTF-8 double-encoded GBK
          const unwrapped = tryUnwrapStormWin1252Bytes(utf8Str)
          if (unwrapped !== null && unwrapped.length < bytes.length && gbkFatalDecoder !== null) {
            try {
              const unwrappedGbk = gbkFatalDecoder.decode(unwrapped)
              const u = countGb2312Pairs(unwrapped)
              const r = countGb2312Pairs(bytes)
              if (u.otherNonAscii === 0 && u.gb2312 > 0 && (gbkHasError || r.otherNonAscii > 0)) {
                return unwrappedGbk
              }
              if (gbkHasError && unwrapped.some((b) => b >= 0xa0)) {
                return unwrappedGbk
              }
            } catch {
              // Unwrapped bytes are not valid GBK
            }
          }
          // 2. Genuine 3-byte / 4-byte UTF-8 (code points >= U+0800: CJK Hanzi, fullwidth, Chinese punctuation)
          for (let i = 0; i < utf8Str.length; i++) {
            if (utf8Str.charCodeAt(i) >= 0x0800) {
              return utf8Str
            }
          }
          // 3. 2-byte UTF-8 (U+0080..U+07FF): only use UTF-8 if raw GBK decoding failed
          if (gbkHasError) {
            return utf8Str
          }
        } catch {
          // Not valid UTF-8; return GBK decoder output
        }
      }
    }
    return decoded
  }

  return {
    encoding,
    decode(bytes: Uint8Array, encodingOverride?: SupportedTextEncoding): string {
      if (bytes.length === 0) return ''
      const eff = encodingOverride ?? encoding
      if (eff !== encoding) {
        return resolveTextCodec(eff).decode(bytes)
      }
      if (eff === 'latin1' || decoder === null) {
        return decodeLatin1(bytes)
      }
      // Byte 0xFF is never valid in GBK (0x81..0xFE) or UTF-8 (0x00..0xF4), and in Diablo II
      // network strings is always the control character 'ÿ' (U+00FF) for ÿcX color codes and ÿÿ<id> emotes.
      if (bytes.includes(0xff)) {
        let out = ''
        let segStart = 0
        for (let i = 0; i < bytes.length; i++) {
          if (bytes[i] === 0xff) {
            if (i > segStart) {
              out += decodeSegment(bytes.subarray(segStart, i), eff)
            }
            out += '\xff'
            segStart = i + 1
          }
        }
        if (segStart < bytes.length) {
          out += decodeSegment(bytes.subarray(segStart), eff)
        }
        return out
      }
      return decodeSegment(bytes, eff)
    },
    encode(text: string, encodingOverride?: SupportedTextEncoding): Uint8Array {
      if (text.length === 0) return new Uint8Array(0)
      const eff = encodingOverride ?? encoding
      if (eff !== encoding) {
        return resolveTextCodec(eff).encode(text)
      }
      if (eff === 'latin1') {
        return encodeLatin1(text)
      }
      let isAscii = true
      for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) >= 0x80) {
          isAscii = false
          break
        }
      }
      if (isAscii) {
        return encodeLatin1(text)
      }
      if (eff === 'gbk') {
        const gbkBytes = encodeGbk(text)
        if (gbkBytes !== null) {
          return gbkBytes
        }
      }
      if (utf8Encoder === null) {
        return encodeLatin1(text)
      }
      return utf8Encoder.encode(text)
    },
  }
}

export const defaultTextCodec: TextCodec = createBrowserTextCodec('gbk')

const codecCache: Record<SupportedTextEncoding, TextCodec> = {
  gbk: defaultTextCodec,
  'utf-8': createBrowserTextCodec('utf-8'),
  latin1: createBrowserTextCodec('latin1'),
}

export function resolveTextCodec(codecOrEncoding?: TextCodec | SupportedTextEncoding): TextCodec {
  if (!codecOrEncoding) return defaultTextCodec
  if (typeof codecOrEncoding === 'string') {
    return codecCache[codecOrEncoding] ?? defaultTextCodec
  }
  return codecOrEncoding
}

export function decodeText(bytes: Uint8Array, encoding: SupportedTextEncoding = 'gbk'): string {
  return resolveTextCodec(encoding).decode(bytes)
}

export function encodeText(text: string, encoding: SupportedTextEncoding = 'gbk'): Uint8Array {
  return resolveTextCodec(encoding).encode(text)
}

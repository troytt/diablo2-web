import { requireBytes } from './reader.ts'
/**
 * Diablo II `.tbl` string-table decoder (hash-bucket layout).
 * 
 * Implements the verified structure of Diablo II `.tbl` files.
 */

export class TblError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TblError'
  }
}

export function tblHash(key: Uint8Array, hashTableSize: number): number {
  if (hashTableSize === 0) return 0
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = ((h << 4) + key[i]!) >>> 0
    const high = h & 0xf0000000
    if (high !== 0) h ^= high >>> 24
    h = (h & ~high) >>> 0
  }
  return h % hashTableSize
}

function u16(data: Uint8Array, at: number): number {
  requireBytes(data, at, 2, 'tbl', 'u16')
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(at, true)
}

function u32(data: Uint8Array, at: number): number {
  requireBytes(data, at, 4, 'tbl', 'u32')
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(at, true) >>> 0
}

function readCStr(data: Uint8Array, start: number): Uint8Array {
  let end = start
  while (end < data.byteLength && data[end] !== 0) {
    end++
  }
  return data.subarray(start, end)
}

export type DecodedTbl = (string | undefined)[] & {
  dict: Map<string, string>
}

const decoderCache = new Map<string, TextDecoder>()
function getDecoder(encoding: string): TextDecoder {
  if (decoderCache.has(encoding)) return decoderCache.get(encoding)!
  try {
    const dec = new TextDecoder(encoding)
    decoderCache.set(encoding, dec)
    return dec
  } catch {
    const fallback = new TextDecoder('latin1')
    decoderCache.set(encoding, fallback)
    return fallback
  }
}

const keyDecoder = new TextDecoder('latin1')

export function decodeTbl(data: Uint8Array, encoding = 'windows-1252'): DecodedTbl {
  if (data.byteLength < 21) {
    throw new TblError(`TBL is ${data.byteLength} bytes, too short for a 21-byte header`)
  }

  const crc = u16(data, 0)
  const numElements = u16(data, 2)
  const hashTableSize = u32(data, 4)
  const version = data[8]
  const stringOffset = u32(data, 9)
  const maxTries = u32(data, 13)
  const fileSize = u32(data, 17)

  const nodesStart = 21 + numElements * 2
  const nodesEnd = nodesStart + hashTableSize * 17

  if (nodesEnd > stringOffset) {
    throw new TblError(`header arithmetic: 21 + ${numElements}*2 + ${hashTableSize}*17 = ${nodesEnd} which exceeds stringOffset ${stringOffset}`)
  }
  if (stringOffset > fileSize) {
    throw new TblError(`stringOffset ${stringOffset} exceeds fileSize ${fileSize}`)
  }
  if (fileSize !== data.byteLength) {
    throw new TblError(`fileSize ${fileSize} does not match actual buffer length ${data.byteLength}`)
  }

  const valDecoder = getDecoder(encoding)

  const out = [] as unknown as DecodedTbl
  out.dict = new Map<string, string>()

  for (let i = 0; i < hashTableSize; i++) {
    const base = nodesStart + i * 17
    const isActive = data[base]
    if (!isActive) continue

    const index = u16(data, base + 1)
    const hashValue = u32(data, base + 3)
    const keyOffset = u32(data, base + 7)
    const valOffset = u32(data, base + 11)
    const valLen = u16(data, base + 15)

    if (keyOffset >= data.byteLength) {
      throw new TblError(`node ${i} keyOffset ${keyOffset} outside buffer`)
    }
    if (valOffset >= data.byteLength) {
      throw new TblError(`node ${i} valOffset ${valOffset} outside buffer`)
    }

    const keySlice = readCStr(data, keyOffset)
    const key = keyDecoder.decode(keySlice)

    const readLen = Math.max(0, valLen - 1)
    const valSlice = data.subarray(valOffset, valOffset + readLen)
    const value = valDecoder.decode(valSlice)

    out[index] = value
    if (!out.dict.has(key)) {
      out.dict.set(key, value)
    }
  }

  return out
}

export function lookupTblFast(data: Uint8Array, key: string, encoding = 'windows-1252'): string | undefined {
  if (data.byteLength < 21) return undefined
  const numElements = u16(data, 2)
  const hashTableSize = u32(data, 4)
  if (hashTableSize === 0) return undefined
  const stringOffset = u32(data, 9)
  const maxTries = u32(data, 13)

  const nodesStart = 21 + numElements * 2
  const nodesEnd = nodesStart + hashTableSize * 17
  if (nodesEnd > stringOffset || stringOffset > data.byteLength) return undefined

  const keyEncoder = new TextEncoder()
  let keyBuf: Uint8Array
  let isAscii = true
  for (let i = 0; i < key.length; i++) {
    if (key.charCodeAt(i) > 0x7F) {
      isAscii = false
      break
    }
  }
  if (isAscii) {
    keyBuf = keyEncoder.encode(key)
  } else {
    keyBuf = new Uint8Array(key.length)
    for (let i = 0; i < key.length; i++) {
      keyBuf[i] = key.charCodeAt(i) & 0xFF
    }
  }
  
  const targetHash = tblHash(keyBuf, hashTableSize)
  const valDecoder = getDecoder(encoding)

  for (let i = 0; i < maxTries; i++) {
    const bucket = (targetHash + i) % hashTableSize
    const base = nodesStart + bucket * 17
    const isActive = data[base]
    if (!isActive) return undefined

    const nodeHash = u32(data, base + 3)
    if (nodeHash !== targetHash) continue

    const keyOffset = u32(data, base + 7)
    if (keyOffset >= data.byteLength) continue

    const keySlice = readCStr(data, keyOffset)
    if (keySlice.byteLength !== keyBuf.byteLength) continue
    
    let match = true
    for (let j = 0; j < keyBuf.byteLength; j++) {
      if (keySlice[j] !== keyBuf[j]) {
        match = false
        break
      }
    }
    
    if (match) {
      const valOffset = u32(data, base + 11)
      const valLen = u16(data, base + 15)
      const readLen = Math.max(0, valLen - 1)
      if (valOffset + readLen > data.byteLength) return undefined
      return valDecoder.decode(data.subarray(valOffset, valOffset + readLen))
    }
  }
  return undefined
}

export function tblLookup(entries: readonly (string | undefined)[]): {
  readonly size: number
  get: (index: number) => string | undefined
} {
  let size = 0
  for (const entry of entries) if (entry !== undefined) size += 1
  return {
    size,
    get: index => (index >= 0 && index < entries.length ? entries[index] : undefined),
  }
}

import { resolveTblKey } from '../data/canonical-tbl-strings.ts'

export type GameLang = 'zh' | 'en'
export type TblLang = 'CHI' | 'ENG'

export function toGameLang(lang: GameLang | TblLang | string): GameLang {
  const norm = String(lang).trim().toLowerCase()
  return norm === 'en' || norm === 'eng' || norm === 'english' ? 'en' : 'zh'
}

export function toTblLang(lang: GameLang | TblLang | string): TblLang {
  return toGameLang(lang) === 'en' ? 'ENG' : 'CHI'
}

let defaultTblLang: TblLang = 'CHI'
let defaultTblLangProvider: (() => TblLang) | null = null
let defaultTblLangSetter: ((lang: TblLang) => void) | null = null

export function setDefaultTblLang(lang: TblLang | GameLang | string): void {
  const next = toTblLang(lang)
  defaultTblLang = next
  defaultTblLangSetter?.(next)
}

export function setDefaultTblLangProvider(
  provider: (() => TblLang) | null,
  setter?: ((lang: TblLang) => void) | null,
): void {
  defaultTblLangProvider = provider
  if (setter !== undefined) {
    defaultTblLangSetter = setter
  }
}

export function getDefaultTblLang(): TblLang {
  return defaultTblLangProvider ? defaultTblLangProvider() : defaultTblLang
}

export function isDefaultTblLangEn(): boolean {
  return getDefaultTblLang() === 'ENG'
}

export function lookupTbl(key: string, lang: TblLang = getDefaultTblLang()): string | undefined {
  return resolveTblKey(key, lang)
}



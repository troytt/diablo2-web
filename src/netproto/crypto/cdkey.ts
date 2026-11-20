/**
 * Diablo II Classic (`D2DV`, product `0x06`) and Expansion (`D2XP`, product `0x0A`)
 * 16-character CD-Key decoding and hashing for `SID_AUTH_CHECK` (`0x51`).
 */

import { xsha1 } from './xsha1.ts'

export const D2DV_PRODUCT_ID = 0x06
export const D2XP_PRODUCT_ID = 0x0a

const CDKEY_ALPHA_MAP: readonly number[] = [
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0x00, 0xff, 0x01, 0xff, 0x02, 0x03, 0x04, 0x05, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0xff, 0x0d, 0x0e, 0xff, 0x0f, 0x10, 0xff,
  0x11, 0xff, 0x12, 0xff, 0x13, 0xff, 0x14, 0x15, 0x16, 0xff, 0x17, 0xff, 0xff, 0xff, 0xff, 0xff,
] as const

export interface DecodedCdKey {
  readonly rawKey: string
  readonly keyLength: number
  readonly productValue: number
  readonly publicValue: number
  readonly privateValue: number
}

export interface HashedCdKeyBlock {
  readonly keyLength: number
  readonly productValue: number
  readonly publicValue: number
  readonly unknown: number
  readonly hashedKeyData: Uint8Array // 20 bytes (5 x u32 LE)
}

const VALID_CDKEY_CHARS = '246789BCDEFGHJKMNPRTVWXZ'

/**
 * Decodes a 16-character Diablo II CD-Key into `{ rawKey, keyLength, productValue, publicValue, privateValue }`.
 */
export function decodeD2CdKey(rawKey: string, expectedProduct?: number): DecodedCdKey {
  const clean = rawKey.replace(/[-\s]/g, '').toUpperCase()
  if (clean.length !== 16) {
    throw new Error(`Expected 16-character D2 CD-Key, got ${clean.length} chars`)
  }

  const digits = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    const code = clean.charCodeAt(i)
    const val = code < CDKEY_ALPHA_MAP.length ? CDKEY_ALPHA_MAP[code]! : 0xff
    if (val === 0xff) {
      throw new Error(`Invalid D2 CD-key character '${clean[i]!}' at index ${i}`)
    }
    digits[i] = val
  }

  const outChars = new Uint8Array(16)
  for (let i = 0; i < 16; i += 2) {
    const n = (digits[i + 1]! + digits[i]! * 24) & 0xff
    outChars[i] = (n >>> 4) & 0x0f
    outChars[i + 1] = n & 0x0f
  }

  for (let i = 15; i >= 0; i--) {
    const idx = (i - 9) & 0x0f
    const tmp = outChars[i]!
    outChars[i] = outChars[idx]!
    outChars[idx] = tmp
  }

  let hashVal = 0x13ac9741
  for (let i = 15; i >= 0; i--) {
    const c = outChars[i]! & 0x0f
    const b = hashVal & 0xff
    const d = ((b & 7) ^ c) & 0x0f
    outChars[i] = d
    hashVal = (hashVal >>> 3) >>> 0
  }

  let hexStr = ''
  for (let i = 0; i < 16; i++) {
    hexStr += outChars[i]!.toString(16)
  }

  const decodedProduct = Number.parseInt(hexStr.slice(0, 2), 16) || D2DV_PRODUCT_ID
  const productValue = expectedProduct !== undefined ? expectedProduct : decodedProduct
  const publicValue = Number.parseInt(hexStr.slice(2, 8), 16) >>> 0
  const privateValue = Number.parseInt(hexStr.slice(8, 16), 16) >>> 0

  return {
    rawKey: clean,
    keyLength: 16,
    productValue,
    publicValue,
    privateValue,
  }
}

/**
 * Hashes a decoded (or raw 16-char string) CD-Key for `SID_AUTH_CHECK` (`0x51`) using `xsha1` over 6 `uint32` words:
 * `[clientToken, serverToken, productValue, publicValue, 0, privateValue]`.
 */
export function hashD2CdKey(
  clientToken: number,
  serverToken: number,
  key: DecodedCdKey | string,
  expectedProduct?: number,
): HashedCdKeyBlock {
  const decoded = typeof key === 'string' ? decodeD2CdKey(key, expectedProduct) : key
  const buf = new Uint8Array(24)
  const view = new DataView(buf.buffer)
  view.setUint32(0, clientToken >>> 0, true)
  view.setUint32(4, serverToken >>> 0, true)
  view.setUint32(8, decoded.productValue >>> 0, true)
  view.setUint32(12, decoded.publicValue >>> 0, true)
  view.setUint32(16, 0, true)
  view.setUint32(20, decoded.privateValue >>> 0, true)

  return {
    keyLength: decoded.keyLength,
    productValue: decoded.productValue,
    publicValue: decoded.publicValue,
    unknown: 0,
    hashedKeyData: xsha1(buf),
  }
}

function buildDeterministicKeyString(seed: number): string {
  let state = (seed >>> 0) || 1
  let out = ''
  for (let i = 0; i < 16; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    out += VALID_CDKEY_CHARS[state % VALID_CDKEY_CHARS.length]!
  }
  return out
}

export function createSyntheticCdKeyPair(seed = 1): {
  readonly classic: DecodedCdKey
  readonly expansion: DecodedCdKey
} {
  const s = (seed >>> 0) || 1
  const classicRaw = buildDeterministicKeyString(s ^ 0x13579bdf)
  const expRaw = buildDeterministicKeyString(s ^ 0x2468ace0)
  return {
    classic: decodeD2CdKey(classicRaw, D2DV_PRODUCT_ID),
    expansion: decodeD2CdKey(expRaw, D2XP_PRODUCT_ID),
  }
}

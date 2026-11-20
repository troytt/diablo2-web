/**
 * Battle.net Broken SHA-1 (`xsha1`) implementation (PvPGN / `bnetd` OLS LogonType 0).
 *
 * Key differences from FIPS-180-1 SHA-1:
 * 1. Input buffer is zero-padded to 64 bytes (no `0x80` bit padding, no bit-length trailer).
 * 2. Initial 16 32-bit words `W[0..15]` are read in little-endian byte order.
 * 3. Message schedule (`i = 16..79`) uses `W[i] = rotl32(1, (W[i-3] ^ W[i-8] ^ W[i-14] ^ W[i-16]) & 0x1f)`
 *    (rotates literal `1` by `x & 31` instead of rotating `x` by `1`).
 * 4. Output digest `H0..H4` is serialized as 5 little-endian 32-bit words (20 bytes).
 */

function rotl32(value: number, shift: number): number {
  const s = shift & 31
  if (s === 0) return value >>> 0
  return ((value << s) | (value >>> (32 - s))) >>> 0
}

export function xsha1Words(input: Uint8Array): Uint32Array {
  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0

  const blockCount = Math.max(1, Math.ceil(input.length / 64))
  const w = new Uint32Array(80)

  for (let b = 0; b < blockCount; b++) {
    const block = new Uint8Array(64)
    const start = b * 64
    const end = Math.min(start + 64, input.length)
    if (end > start) {
      block.set(input.subarray(start, end))
    }
    const view = new DataView(block.buffer)
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(i * 4, true)
    }
    for (let i = 16; i < 80; i++) {
      const x = (w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!) >>> 0
      w[i] = rotl32(1, x & 0x1f)
    }

    let a = h0
    let bReg = h1
    let c = h2
    let d = h3
    let e = h4

    for (let i = 0; i < 80; i++) {
      let f: number
      let k: number
      if (i < 20) {
        f = ((bReg & c) | (~bReg & d)) >>> 0
        k = 0x5a827999
      } else if (i < 40) {
        f = (bReg ^ c ^ d) >>> 0
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = ((bReg & c) | (bReg & d) | (c & d)) >>> 0
        k = 0x8f1bbcdc
      } else {
        f = (bReg ^ c ^ d) >>> 0
        k = 0xca62c1d6
      }
      const temp = (rotl32(a, 5) + f + e + w[i]! + k) >>> 0
      e = d
      d = c
      c = rotl32(bReg, 30)
      bReg = a
      a = temp
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + bReg) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  return new Uint32Array([h0, h1, h2, h3, h4])
}

export function xsha1(input: Uint8Array): Uint8Array {
  const words = xsha1Words(input)
  const out = new Uint8Array(20)
  const view = new DataView(out.buffer)
  for (let i = 0; i < 5; i++) {
    view.setUint32(i * 4, words[i]!, true)
  }
  return out
}

export function xsha1Ascii(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff
  }
  return xsha1(bytes)
}

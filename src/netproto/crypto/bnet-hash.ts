/**
 * Battle.net OLS account password hashing (`SID_CREATEACCOUNT2` `0x3D`, `SID_LOGONRESPONSE2` `0x3A`,
 * `SID_LOGONREALMEX` `0x3E`).
 */

import { xsha1, xsha1Ascii } from './xsha1.ts'

/**
 * Hashes a plaintext Battle.net password by lowercasing ASCII characters and running `xsha1`.
 */
export function hashBnetPassword(password: string): Uint8Array {
  return xsha1Ascii(password.toLowerCase())
}

/**
 * Computes the 20-byte double-hash proof `xsha1(u32 clientToken | u32 serverToken | u8[20] pwHash)`.
 */
export function doubleHash(
  clientToken: number,
  serverToken: number,
  passwordHash: Uint8Array,
): Uint8Array {
  if (passwordHash.length !== 20) {
    throw new Error(`doubleHash expected 20-byte passwordHash, got ${passwordHash.length}`)
  }
  const buf = new Uint8Array(28)
  const view = new DataView(buf.buffer)
  view.setUint32(0, clientToken >>> 0, true)
  view.setUint32(4, serverToken >>> 0, true)
  buf.set(passwordHash, 8)
  return xsha1(buf)
}

/**
 * Computes the 20-byte realm password hash for `SID_LOGONREALMEX` (`0x3E`),
 * which hashes literal `"password"` with `(clientToken, serverToken)`.
 */
export function hashRealmPassword(clientToken: number, serverToken: number): Uint8Array {
  return doubleHash(clientToken, serverToken, hashBnetPassword('password'))
}

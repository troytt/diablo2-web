/**
 * MPQ (Storm) cryptography: the shared crypt table, `HashString`, and the
 * block cipher.
 *
 * Semantics follow the public StormLib reference implementation (MIT,
 * Copyright (c) Ladislav Zezula); this file is an independent TypeScript
 * port. All arithmetic is unsigned 32-bit with explicit wrapping, because
 * the format depends on exact overflow behaviour.
 */

/** Hash selector: table index (start of the probe chain). */
export const HASH_TABLE_OFFSET = 0
/** Hash selector: name hash A (hash table entry comparison). */
export const HASH_NAME_A = 1
/** Hash selector: name hash B (hash table entry comparison). */
export const HASH_NAME_B = 2
/** Hash selector: per-file encryption key. */
export const HASH_FILE_KEY = 3

/** Charset size: one hash alphabet per selector occupies 0x100 slots. */
const CHARSET_SIZE = 0x100

/**
 * The 0x500-entry Storm crypt table: 5 alphabets of 0x100 values. The last
 * alphabet (0x400..0x4FF) is the cipher's per-key-byte seed table.
 */
const CRYPT_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(5 * CHARSET_SIZE)
  let seed = 0x00100001
  for (let index1 = 0; index1 < CHARSET_SIZE; index1 += 1) {
    let index2 = index1
    for (let i = 0; i < 5; i += 1, index2 += CHARSET_SIZE) {
      seed = ((((Math.imul(seed, 125) + 3) >>> 0) % 0x2aaaab) >>> 0)
      const temp1 = ((seed & 0xffff) << 0x10) >>> 0
      seed = ((((Math.imul(seed, 125) + 3) >>> 0) % 0x2aaaab) >>> 0)
      const temp2 = seed & 0xffff
      table[index2] = (temp1 | temp2) >>> 0
    }
  }
  return table
})()

/**
 * Storm's case-insensitive string hash.
 *
 * Archive names are ASCII; the uppercase fold is applied to ASCII only so a
 * stray non-ASCII byte cannot alias two distinct names.
 *
 * @param name - archive file name (either separator is accepted by callers).
 * @param hashType - one of the `HASH_*` selectors.
 * @returns the 32-bit hash.
 */
export function hashString(name: string, hashType: number): number {
  let seed1 = 0x7fed7fed
  let seed2 = 0xeeeeeeee
  const base = hashType * CHARSET_SIZE
  for (let i = 0; i < name.length; i += 1) {
    const code = name.charCodeAt(i)
    const ch = (code >= 0x61 && code <= 0x7a ? code - 0x20 : code) & 0xff
    seed1 = (CRYPT_TABLE[base + ch]! ^ ((seed1 + seed2) >>> 0)) >>> 0
    seed2 = (ch + seed1 + seed2 + (((seed2 << 5) >>> 0)) + 3) >>> 0
  }
  return seed1
}

/**
 * Decrypt one block in place with the MPQ block cipher.
 *
 * @param data - buffer to decrypt; `byteLength` must be a multiple of 4.
 * @param key - the 32-bit file/table key.
 */
export function decryptBlock(data: Uint8Array, key: number): void {
  const words = data.byteLength >>> 2
  if (words === 0) return
  const view = new DataView(data.buffer, data.byteOffset, words << 2)
  let seed = 0xeeeeeeee
  let k = key >>> 0
  for (let i = 0; i < words; i += 1) {
    seed = (seed + CRYPT_TABLE[0x400 + (k & 0xff)]!) >>> 0
    const ch = (view.getUint32(i * 4, true) ^ ((k + seed) >>> 0)) >>> 0
    k = ((((~k << 0x15) >>> 0) + 0x11111111 | (k >>> 0x0b)) >>> 0)
    seed = (ch + seed + (((seed << 5) >>> 0)) + 3) >>> 0
    view.setUint32(i * 4, ch, true)
  }
}

/**
 * Encrypt one block in place with the MPQ block cipher.
 *
 * MPQ's cipher is its own inverse in the sense that both directions run the same
 * key schedule: the schedule is advanced with the *plaintext* word, so encrypting
 * reads the plaintext, writes the ciphertext, and feeds the plaintext into the
 * schedule — while `decryptBlock` reads the ciphertext, recovers the plaintext,
 * and feeds that same plaintext in. Keeping the two explicit matters for the
 * writer, where using the decrypt path would corrupt the schedule.
 *
 * @param data - buffer to encrypt; `byteLength` must be a multiple of 4.
 * @param key - the 32-bit file/table key.
 */
export function encryptBlock(data: Uint8Array, key: number): void {
  const words = data.byteLength >>> 2
  if (words === 0) return
  const view = new DataView(data.buffer, data.byteOffset, words << 2)
  let seed = 0xeeeeeeee
  let k = key >>> 0
  for (let i = 0; i < words; i += 1) {
    seed = (seed + CRYPT_TABLE[0x400 + (k & 0xff)]!) >>> 0
    const plain = view.getUint32(i * 4, true)
    const cipher = (plain ^ ((k + seed) >>> 0)) >>> 0
    k = ((((~k << 0x15) >>> 0) + 0x11111111 | (k >>> 0x0b)) >>> 0)
    seed = (plain + seed + (((seed << 5) >>> 0)) + 3) >>> 0
    view.setUint32(i * 4, cipher, true)
  }
}

/**
 * The encryption key of one archive member.
 *
 * The key is derived from the *plain* file name — the segment after the last
 * separator — while the hash-table lookup uses the full path. The two are the
 * same only for root-level names, so a path-qualified lookup that hashes the
 * whole name silently produces a key that decrypts to noise.
 *
 * @param name - archive file name, either separator.
 * @param blockOffset - stored offset of the file's first byte.
 * @param fileSize - uncompressed size of the file.
 * @param fixKey - the entry carries `MPQ_FILE_FIX_KEY`.
 * @returns the file key.
 */
export function fileKey(name: string, blockOffset: number, fileSize: number, fixKey: boolean): number {
  const base = hashString(plainName(normalizeName(name)), HASH_FILE_KEY)
  return fixKey ? (((base + blockOffset) >>> 0) ^ fileSize) >>> 0 : base
}

/**
 * The plain (directory-less) form of an archive name.
 *
 * @param name - archive name, either separator.
 * @returns the trailing path segment.
 */
export function plainName(name: string): string {
  const cut = Math.max(name.lastIndexOf('\\'), name.lastIndexOf('/'))
  return cut === -1 ? name : name.slice(cut + 1)
}

/** The fixed key of the hash table. */
export const HASH_TABLE_KEY = hashString('(hash table)', HASH_FILE_KEY)
/** The fixed key of the block table. */
export const BLOCK_TABLE_KEY = hashString('(block table)', HASH_FILE_KEY)

/**
 * Archive names use backslash separators internally; callers may pass either.
 *
 * @param name - caller-supplied name.
 * @returns the normalized name.
 */
export function normalizeName(name: string): string {
  return name.replace(/\//g, '\\')
}

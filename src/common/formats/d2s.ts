/**
 * Pure Diablo II `.d2s` save file checksum, header constants, and `"gf"` attribute bitstream helpers
 * (`src/common/formats/d2s.ts`). Zero DOM or Node dependencies.
 */

export const D2S_MAGIC = 0xaa55aa55
export const D2S_CHECKSUM_OFFSET = 0x0c

/** Diablo II version this writer targets (1.09+ layout, v96). */
export const D2S_VERSION = 96

/**
 * Diablo II's save checksum (`D2Common.dll` rotating sum).
 *
 * Shift left, add the byte, and fold any carry back into the low bit.
 * Stored as a 32-bit little-endian integer at offset `0x0C` (which is zeroed during calculation).
 *
 * @param data - the file bytes, with the checksum field present.
 * @returns the unsigned 32-bit checksum.
 */
export function d2sChecksum(data: Uint8Array): number {
  let sum = 0
  for (let index = 0; index < data.byteLength; index += 1) {
    const byte = index >= D2S_CHECKSUM_OFFSET && index < D2S_CHECKSUM_OFFSET + 4 ? 0 : data[index]!
    sum = sum * 2 + byte
    if (sum > 0xffffffff) sum = (sum % 0x100000000) + 1
  }
  return sum | 0
}

export function computeD2sChecksum(data: Uint8Array): number {
  return d2sChecksum(data) >>> 0
}

/**
 * Zeroes offset `0x0C..0x0F`, computes the rotating `.d2s` checksum, writes it in-place at `0x0C` (little-endian),
 * and returns the unsigned 32-bit checksum.
 */
export function writeD2sChecksum(data: Uint8Array): number {
  if (data.byteLength < D2S_CHECKSUM_OFFSET + 4) {
    throw new Error(`.d2s buffer too short for checksum header: ${data.byteLength} bytes`)
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  view.setUint32(D2S_CHECKSUM_OFFSET, 0, true)
  const checksum = computeD2sChecksum(data)
  view.setUint32(D2S_CHECKSUM_OFFSET, checksum, true)
  return checksum
}

/**
 * Verifies that the stored checksum at offset `0x0C` matches `d2sChecksum(data)`.
 */
export function verifyD2sChecksum(data: Uint8Array): boolean {
  if (data.byteLength < D2S_CHECKSUM_OFFSET + 4) return false
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const expected = view.getUint32(D2S_CHECKSUM_OFFSET, true) >>> 0
  return expected === computeD2sChecksum(data)
}

/**
 * 1.13c `ItemStatCost.txt` `CSvBits` table for `.d2s` `"gf"` character attribute block (`0x2FD`).
 */
export const D2S_ATTR_BITS: Readonly<Record<number, number>> = {
  0: 10, // strength
  1: 10, // energy
  2: 10, // dexterity
  3: 10, // vitality
  4: 10, // statpts
  5: 8, // newskills
  6: 21, // hitpoints
  7: 21, // maxhp
  8: 21, // mana
  9: 21, // maxmana
  10: 21, // stamina
  11: 21, // maxstamina
  12: 7, // level
  13: 32, // experience
  14: 25, // gold
  15: 25, // goldbank
} as const

export interface D2sAttributesInput {
  readonly strength?: number | undefined
  readonly energy?: number | undefined
  readonly dexterity?: number | undefined
  readonly vitality?: number | undefined
  readonly statPts?: number | undefined
  readonly statpts?: number | undefined
  readonly skillPts?: number | undefined
  readonly newSkills?: number | undefined
  readonly newskills?: number | undefined
  readonly hitpointsFixed?: number | undefined
  readonly hitpoints?: number | undefined
  readonly maxHpFixed?: number | undefined
  readonly maxhp?: number | undefined
  readonly manaFixed?: number | undefined
  readonly mana?: number | undefined
  readonly maxManaFixed?: number | undefined
  readonly maxmana?: number | undefined
  readonly staminaFixed?: number | undefined
  readonly stamina?: number | undefined
  readonly maxStaminaFixed?: number | undefined
  readonly maxstamina?: number | undefined
  readonly level?: number | undefined
  readonly experience?: number | undefined
  readonly gold?: number | undefined
  readonly goldBank?: number | undefined
  readonly goldbank?: number | undefined
}

export interface D2sAttributes {
  readonly strength: number
  readonly energy: number
  readonly dexterity: number
  readonly vitality: number
  readonly statPts: number
  readonly statpts?: number | undefined
  readonly skillPts: number
  readonly newSkills?: number | undefined
  readonly newskills?: number | undefined
  readonly hitpointsFixed: number
  readonly hitpoints?: number | undefined
  readonly maxHpFixed: number
  readonly maxhp?: number | undefined
  readonly manaFixed: number
  readonly mana?: number | undefined
  readonly maxManaFixed: number
  readonly maxmana?: number | undefined
  readonly staminaFixed: number
  readonly stamina?: number | undefined
  readonly maxStaminaFixed: number
  readonly maxstamina?: number | undefined
  readonly level: number
  readonly experience: number
  readonly gold: number
  readonly goldBank: number
  readonly goldbank?: number | undefined
}

export interface D2sDecodedAttributes extends D2sAttributes {
  readonly statpts: number
  readonly newSkills: number
  readonly newskills: number
  readonly hitpoints: number
  readonly maxhp: number
  readonly mana: number
  readonly maxmana: number
  readonly stamina: number
  readonly maxstamina: number
  readonly goldbank: number
}

/**
 * Encodes the `"gf"` (0x67, 0x66) character attribute bitstream terminated by 9-bit `0x1FF`.
 */
export function encodeGfStatSection(attrs: D2sAttributesInput): Uint8Array {
  const bytes: number[] = [0x67, 0x66]
  let curByte = 0
  let bitPos = 0

  const writeBits = (val: number, bitCount: number): void => {
    const v = val >>> 0
    for (let i = 0; i < bitCount; i++) {
      const bit = (v >>> i) & 1
      curByte |= bit << bitPos
      bitPos++
      if (bitPos === 8) {
        bytes.push(curByte & 0xff)
        curByte = 0
        bitPos = 0
      }
    }
  }

  const entries: ReadonlyArray<readonly [number, number]> = [
    [0, (attrs.strength ?? 0) >>> 0],
    [1, (attrs.energy ?? 0) >>> 0],
    [2, (attrs.dexterity ?? 0) >>> 0],
    [3, (attrs.vitality ?? 0) >>> 0],
    [4, (attrs.statPts ?? attrs.statpts ?? 0) >>> 0],
    [5, (attrs.skillPts ?? attrs.newSkills ?? attrs.newskills ?? 0) >>> 0],
    [6, (attrs.hitpointsFixed ?? attrs.hitpoints ?? 0) >>> 0],
    [7, (attrs.maxHpFixed ?? attrs.maxhp ?? 0) >>> 0],
    [8, (attrs.manaFixed ?? attrs.mana ?? 0) >>> 0],
    [9, (attrs.maxManaFixed ?? attrs.maxmana ?? 0) >>> 0],
    [10, (attrs.staminaFixed ?? attrs.stamina ?? 0) >>> 0],
    [11, (attrs.maxStaminaFixed ?? attrs.maxstamina ?? 0) >>> 0],
    [12, (attrs.level ?? 1) >>> 0],
    [13, (attrs.experience ?? 0) >>> 0],
    [14, (attrs.gold ?? 0) >>> 0],
    [15, (attrs.goldBank ?? attrs.goldbank ?? 0) >>> 0],
  ]

  for (const [id, val] of entries) {
    if (val > 0 || id === 12) {
      const bits = D2S_ATTR_BITS[id]!
      writeBits(id, 9)
      writeBits(val >>> 0, bits)
    }
  }
  writeBits(0x1ff, 9)

  if (bitPos > 0) {
    bytes.push(curByte & 0xff)
  }
  return new Uint8Array(bytes)
}

/**
 * Decodes the `"gf"` (0x67, 0x66) character attribute bitstream starting at `offset`.
 */
export function decodeGfStatSection(
  buf: Uint8Array,
  offset: number,
): {
  readonly attributes: D2sDecodedAttributes
  readonly bytesConsumed: number
  readonly nextOffset: number
} {
  if (offset + 2 > buf.byteLength || buf[offset] !== 0x67 || buf[offset + 1] !== 0x66) {
    throw new Error(`Invalid .d2s "gf" stat header at offset 0x${offset.toString(16)}`)
  }
  let bitOffset = (offset + 2) * 8
  const maxBits = buf.byteLength * 8

  const readBits = (bitCount: number): number => {
    if (bitOffset + bitCount > maxBits) {
      throw new Error(`Truncated .d2s "gf" stat bitstream at bit ${bitOffset}`)
    }
    let val = 0
    for (let i = 0; i < bitCount; i++) {
      const byteIdx = (bitOffset + i) >>> 3
      const bitIdx = (bitOffset + i) & 7
      const bit = (buf[byteIdx]! >>> bitIdx) & 1
      if (bit !== 0) {
        val += 2 ** i
      }
    }
    bitOffset += bitCount
    return val >>> 0
  }

  const values: Record<number, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    11: 0,
    12: 1,
    13: 0,
    14: 0,
    15: 0,
  }

  while (true) {
    const id = readBits(9)
    if (id === 0x1ff) break
    const bits = D2S_ATTR_BITS[id]
    if (bits === undefined) {
      throw new Error(`Unknown .d2s "gf" attribute ID ${id}`)
    }
    values[id] = readBits(bits)
  }

  const nextOffset = (bitOffset + 7) >>> 3
  const statPts = values[4]!
  const newSkills = values[5]!
  const hitpoints = values[6]!
  const maxhp = values[7]!
  const mana = values[8]!
  const maxmana = values[9]!
  const stamina = values[10]!
  const maxstamina = values[11]!
  const goldbank = values[15]!
  return {
    attributes: {
      strength: values[0]!,
      energy: values[1]!,
      dexterity: values[2]!,
      vitality: values[3]!,
      statPts,
      statpts: statPts,
      newSkills,
      newskills: newSkills,
      skillPts: newSkills,
      hitpoints,
      hitpointsFixed: hitpoints,
      maxhp,
      maxHpFixed: maxhp,
      mana,
      manaFixed: mana,
      maxmana,
      maxManaFixed: maxmana,
      stamina,
      staminaFixed: stamina,
      maxstamina,
      maxStaminaFixed: maxstamina,
      level: values[12]!,
      experience: values[13]!,
      gold: values[14]!,
      goldbank,
      goldBank: goldbank,
    },
    bytesConsumed: nextOffset - offset,
    nextOffset,
  }
}

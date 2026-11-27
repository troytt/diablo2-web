/**
 * Diablo II: Lord of Destruction v1.13c compiled `ItemStatCost.bin` (`359 × 0x144` bytes) and
 * `CharStats.bin` (`7 × 0xC4` bytes) binary parsers & canonical tables.
 *
 * Binary ground truth (`D2Common.dll`, image base `0x6FD50000`, `Patch_D2.mpq`):
 * - `DATATBLS_LoadItemStatCostTxt` (`0x6FDC3330..0x6FDC3FF9`): compiles `ItemStatCost.txt` into
 *   `0x144`-byte (`324`-byte) `D2ItemStatCostTxt` records (`push 0x144` at `0x6FDC3BE7`),
 *   populates `wBaseDepStats[64]` (`+0x5E..+0xDD`, `0x6FDC3CE3..0x6FDC3D35`), `pOpChain[16]`
 *   (`+0xDE..+0x13D`, `16 × 6`-byte `{ wOpBase (+0), wStat (+2), bOp (+4), bOpParam (+5) }` entries
 *   at `0x6FDC3D62..0x6FDC3EA5`, followed by 2-byte alignment padding `+0x13E..+0x13F` and `dwStuff`
 *   at `+0x140`), and ORs post-load runtime `dwFlags` bits 5..8 (`0x6FDC3DC4..0x6FDC3E7A`) onto the
 *   12 rows targeting `maxhp` (`7`), `maxmana` (`9`), or `maxstamina` (`11`).
 * - `DATATBLS_LoadCharStatsTxt` (`0x6FDB0A80..0x6FDB1680`): compiles `CharStats.txt` into
 *   `0xC4`-byte (`196`-byte) `D2CharStatsTxt` records (`push 0xC4` at `0x6FDB14EB`; `+0x20 szClass[16]`,
 *   `+0x30..+0x35` base stats, `+0x43..+0x48` quarter-point per-level / per-attribute growth factors,
 *   `+0x50 bStatPerLevel`).
 */

export const ITEM_STAT_COST_BIN_STRIDE_113C = 0x144 // 324 bytes per D2ItemStatCostTxt record
export const ITEM_STAT_COST_COUNT_113C = 359
export const CHAR_STATS_BIN_STRIDE_113C = 0xc4 // 196 bytes per D2CharStatsTxt record
export const CHAR_STATS_COUNT_113C = 7
export const STAT_ID_NONE_113C = 0xffff

// D2ItemStatCostTxt.dwFlags (+0x04) bitmasks verified against D2Common.dll 0x6FDC3440..0x6FDC3E7D
export const ISC_FLAG_SEND_OTHER = 0x00000001 // bit 0: Send Other
export const ISC_FLAG_SIGNED = 0x00000002 // bit 1: Signed
export const ISC_FLAG_DAMAGE_RELATED = 0x00000004 // bit 2: DamageRelated
export const ISC_FLAG_ITEM_SPECIFIC = 0x00000008 // bit 3: ItemSpecific
export const ISC_FLAG_DIRECT = 0x00000010 // bit 4: Direct (clamped by wMaxStat +0x32)
export const ISC_FLAG_RUNTIME_MAXSTAT = 0x00000020 // bit 5: post-load 0x6FDC3E77 (affects maxhp/mana/stam)
export const ISC_FLAG_RUNTIME_MAXHP = 0x00000040 // bit 6: post-load 0x6FDC3E61 (affects maxhp=7)
export const ISC_FLAG_RUNTIME_MAXMANA = 0x00000080 // bit 7: post-load 0x6FDC3E56 (affects maxmana=9)
export const ISC_FLAG_RUNTIME_MAXSTAM = 0x00000100 // bit 8: post-load 0x6FDC3E48 (affects maxstamina=11)
export const ISC_FLAG_UPDATE_ANIM_RATE = 0x00000200 // bit 9: UpdateAnimRate
export const ISC_FLAG_FMIN = 0x00000400 // bit 10: fMin (clamped to dwMinAccr << bValShift on unit)
export const ISC_FLAG_FCALLBACK = 0x00000800 // bit 11: fCallback
export const ISC_FLAG_SAVED = 0x00001000 // bit 12: Saved
export const ISC_FLAG_CSV_SIGNED = 0x00002000 // bit 13: CSvSigned

export interface ItemStatCostMeta113c {
  readonly statId: number // +0x00 wStatId (u16)
  readonly flags?: number // +0x04 post-load dwFlags (u32, includes runtime bits 5..8 per 0x6FDC3DC4..0x6FDC3E7A)
  readonly diskFlags?: number // +0x04 on-disk ItemStatCost.bin dwFlags (u32, prior to post-load bits 5..8)
  readonly sendOther?: boolean // dwFlags & 0x0001
  readonly signed?: boolean // dwFlags & 0x0002
  readonly damageRelated?: boolean // dwFlags & 0x0004
  readonly itemSpecific?: boolean // dwFlags & 0x0008
  readonly direct?: boolean // dwFlags & 0x0010
  readonly runtimeMaxStat?: boolean // post-load dwFlags & 0x0020
  readonly runtimeMaxHp?: boolean // post-load dwFlags & 0x0040
  readonly runtimeMaxMana?: boolean // post-load dwFlags & 0x0080
  readonly runtimeMaxStam?: boolean // post-load dwFlags & 0x0100
  readonly updateAnimRate?: boolean // dwFlags & 0x0200
  readonly fMin?: boolean // dwFlags & 0x0400
  readonly fCallback?: boolean // dwFlags & 0x0800
  readonly saved?: boolean // dwFlags & 0x1000
  readonly csvSigned?: boolean // dwFlags & 0x2000
  readonly sendBits?: number // +0x08 bSendBits (u8)
  readonly sendParamBits?: number // +0x09 bSendParamBits (u8)
  readonly csvBits?: number // +0x0A bCSvBits (u8)
  readonly csvParam?: number // +0x0B bCSvParam (u8)
  readonly divide?: number // +0x0C dwDivide (i32)
  readonly multiply?: number // +0x10 dwMultiply (i32)
  readonly add?: number // +0x14 dwAdd (i32)
  readonly valShift?: number // +0x18 bValShift (u8)
  readonly saveBits?: number // +0x19 bSaveBits (u8)
  readonly saveBits109?: number // +0x1A bSaveBits109 (u8)
  readonly saveAdd?: number // +0x1C dwSaveAdd (i32)
  readonly saveAdd109?: number // +0x20 dwSaveAdd109 (i32)
  readonly saveParamBits?: number // +0x24 dwSaveParamBits (u32)
  readonly minAccr?: number // +0x2C dwMinAccr (i32)
  readonly encode?: number // +0x30 bEncode (u8)
  readonly maxStat?: number // +0x32 wMaxStat (u16, 0xFFFF if none; 6->7, 8->9, 10->11, 72->73)
  readonly itemEvent1?: number // +0x48 wItemEvent1 (u16, 0xFFFF if none; 0x6FDC37AD)
  readonly itemEvent2?: number // +0x4A wItemEvent2 (u16, 0xFFFF if none; 0x6FDC3814)
  readonly itemEventFunc1?: number // +0x4C wItemEventFunc1 (u16; 0x6FDC37D8)
  readonly itemEventFunc2?: number // +0x4E wItemEventFunc2 (u16; 0x6FDC3838)
  readonly keepZero?: boolean // +0x50 bKeepZero (u8 != 0)
  readonly op?: number // +0x54 bOp (u8, 1..13 or 0)
  readonly opParam?: number // +0x55 bOpParam (u8)
  readonly opBase?: number // +0x56 wOpBase (u16, 0xFFFF if none)
  readonly opStats?: readonly number[] // +0x58..+0x5D wOpStat[0..2] (active < count targets; break on >= count at 0x6FDC3D6F)
  readonly stuff?: number // +0x140 dwStuff (u32; 0x6FDC3BA2, row 0 = 6)
  readonly evalByTime?: (pOwner: number, statVal: number) => number // optional op 6/7 callback (0x6FD893B0)
}

export interface CharStatsGrowthMeta113c {
  readonly classId?: number // 0..6
  readonly className?: string // +0x20 szClass[16]
  readonly str?: number // +0x30 bStr
  readonly dex?: number // +0x31 bDex
  readonly int?: number // +0x32 bInt
  readonly vit?: number // +0x33 bVit
  readonly stamina?: number // +0x34 bStamina
  readonly hpAdd?: number // +0x35 bHpAdd
  readonly manaRegen?: number // +0x3A bManaRegen
  readonly toHitFactor?: number // +0x3C dwToHitFactor (i32)
  readonly walkVelocity?: number // +0x40 bWalkVelocity
  readonly runVelocity?: number // +0x41 bRunVelocity
  readonly runDrain?: number // +0x42 bRunDrain
  readonly lifePerLevel?: number // +0x43 bLifePerLevel (quarter-points)
  readonly staminaPerLevel?: number // +0x44 bStaminaPerLevel (quarter-points)
  readonly manaPerLevel?: number // +0x45 bManaPerLevel (quarter-points)
  readonly lifePerVitality: number // +0x46 bLifePerVitality (quarter-points, e.g. Barb=16 -> +4 HP/vit)
  readonly staminaPerVitality: number // +0x47 bStaminaPerVitality (quarter-points)
  readonly manaPerMagic: number // +0x48 bManaPerMagic (quarter-points)
  readonly blockFactor?: number // +0x49 bBlockFactor
  readonly statPerLevel?: number // +0x50 bStatPerLevel
}

function resolveBinLayout(buf: Uint8Array, stride: number, label: string): { headerBytes: number; count: number } {
  if (buf.byteLength >= 4) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const declared = dv.getUint32(0, true)
    if (4 + declared * stride === buf.byteLength) {
      return { headerBytes: 4, count: declared }
    }
  }
  if (buf.byteLength % stride === 0) {
    return { headerBytes: 0, count: buf.byteLength / stride }
  }
  throw new RangeError(`${label}: invalid byte length ${buf.byteLength} for stride 0x${stride.toString(16)}`)
}

/**
 * Parse compiled 1.13c `ItemStatCost.bin` (`4 + N * 0x144` bytes or raw `N * 0x144` bytes)
 * using exact `D2Common.dll` `0x6FDC3330..0x6FDC3FF9` binary offsets and post-load runtime
 * `dwFlags` mutation (`0x6FDC3DC4..0x6FDC3E7A`).
 */
export function parseItemStatCostBin113c(buf: Uint8Array): ItemStatCostMeta113c[] {
  const { headerBytes, count } = resolveBinLayout(buf, ITEM_STAT_COST_BIN_STRIDE_113C, 'ItemStatCost.bin')
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const out: ItemStatCostMeta113c[] = new Array(count)
  const opChainCount = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const base = headerBytes + i * ITEM_STAT_COST_BIN_STRIDE_113C
    const statId = dv.getUint16(base + 0x00, true)
    const diskFlags = dv.getUint32(base + 0x04, true)
    let flags = diskFlags
    const rawOp = dv.getUint8(base + 0x54)
    // 0x6FDC3CD2..0x6FDC3CDD: if (bOp == 0 || bOp >= 14) bOp = 0
    const op = rawOp > 0 && rawOp < 14 ? rawOp : 0
    const opStats: number[] = []
    if (op !== 0) {
      for (let k = 0; k < 3; k++) {
        const target = dv.getUint16(base + 0x58 + k * 2, true)
        // 0x6FDC3D6F: cmp eax, [nItemStatCostTxt]; jge 0x6FDC3EA5 (break out of k=0..2 loop)
        if (target === STAT_ID_NONE_113C || target >= count) break
        opStats.push(target)
        // 0x6FDC3DA8..0x6FDC3E7A: when target's pOpChain (+0xDE..+0x13D) has room (< 16 slots),
        // OR Fog.gdwBitMasks[5..8] into row[i].dwFlags for maxhp (7), maxmana (9), maxstamina (11).
        if (opChainCount[target]! < 16) {
          opChainCount[target]!++
          if (i === 7 || target === 7) {
            flags = (flags | ISC_FLAG_RUNTIME_MAXHP | ISC_FLAG_RUNTIME_MAXSTAT) >>> 0
          } else if (i === 9 || target === 9) {
            flags = (flags | ISC_FLAG_RUNTIME_MAXMANA | ISC_FLAG_RUNTIME_MAXSTAT) >>> 0
          } else if (i === 11 || target === 11) {
            flags = (flags | ISC_FLAG_RUNTIME_MAXSTAM | ISC_FLAG_RUNTIME_MAXSTAT) >>> 0
          }
        }
      }
    }
    out[i] = {
      statId,
      flags,
      diskFlags,
      sendOther: (flags & ISC_FLAG_SEND_OTHER) !== 0,
      signed: (flags & ISC_FLAG_SIGNED) !== 0,
      damageRelated: (flags & ISC_FLAG_DAMAGE_RELATED) !== 0,
      itemSpecific: (flags & ISC_FLAG_ITEM_SPECIFIC) !== 0,
      direct: (flags & ISC_FLAG_DIRECT) !== 0,
      runtimeMaxStat: (flags & ISC_FLAG_RUNTIME_MAXSTAT) !== 0,
      runtimeMaxHp: (flags & ISC_FLAG_RUNTIME_MAXHP) !== 0,
      runtimeMaxMana: (flags & ISC_FLAG_RUNTIME_MAXMANA) !== 0,
      runtimeMaxStam: (flags & ISC_FLAG_RUNTIME_MAXSTAM) !== 0,
      updateAnimRate: (flags & ISC_FLAG_UPDATE_ANIM_RATE) !== 0,
      fMin: (flags & ISC_FLAG_FMIN) !== 0,
      fCallback: (flags & ISC_FLAG_FCALLBACK) !== 0,
      saved: (flags & ISC_FLAG_SAVED) !== 0,
      csvSigned: (flags & ISC_FLAG_CSV_SIGNED) !== 0,
      sendBits: dv.getUint8(base + 0x08),
      sendParamBits: dv.getUint8(base + 0x09),
      csvBits: dv.getUint8(base + 0x0a),
      csvParam: dv.getUint8(base + 0x0b),
      divide: dv.getInt32(base + 0x0c, true),
      multiply: dv.getInt32(base + 0x10, true),
      add: dv.getInt32(base + 0x14, true),
      valShift: dv.getUint8(base + 0x18),
      saveBits: dv.getUint8(base + 0x19),
      saveBits109: dv.getUint8(base + 0x1a),
      saveAdd: dv.getInt32(base + 0x1c, true),
      saveAdd109: dv.getInt32(base + 0x20, true),
      saveParamBits: dv.getUint32(base + 0x24, true),
      minAccr: dv.getInt32(base + 0x2c, true),
      encode: dv.getUint8(base + 0x30),
      maxStat: dv.getUint16(base + 0x32, true),
      itemEvent1: dv.getUint16(base + 0x48, true),
      itemEvent2: dv.getUint16(base + 0x4a, true),
      itemEventFunc1: dv.getUint16(base + 0x4c, true),
      itemEventFunc2: dv.getUint16(base + 0x4e, true),
      keepZero: dv.getUint8(base + 0x50) !== 0,
      op,
      opParam: dv.getUint8(base + 0x55),
      opBase: dv.getUint16(base + 0x56, true),
      opStats,
      stuff: dv.getUint32(base + 0x140, true),
    }
  }
  return out
}

/**
 * Parse compiled 1.13c `CharStats.bin` (`4 + N * 0xC4` bytes or raw `N * 0xC4` bytes)
 * using exact `D2Common.dll` `0x6FDB0A80..0x6FDB1680` binary offsets.
 */
export function parseCharStatsBin113c(buf: Uint8Array): CharStatsGrowthMeta113c[] {
  const { headerBytes, count } = resolveBinLayout(buf, CHAR_STATS_BIN_STRIDE_113C, 'CharStats.bin')
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const out: CharStatsGrowthMeta113c[] = new Array(count)
  for (let c = 0; c < count; c++) {
    const base = headerBytes + c * CHAR_STATS_BIN_STRIDE_113C
    let className = ''
    for (let k = 0; k < 16; k++) {
      const ch = dv.getUint8(base + 0x20 + k)
      if (ch === 0) break
      className += String.fromCharCode(ch)
    }
    out[c] = {
      classId: c,
      className,
      str: dv.getUint8(base + 0x30),
      dex: dv.getUint8(base + 0x31),
      int: dv.getUint8(base + 0x32),
      vit: dv.getUint8(base + 0x33),
      stamina: dv.getUint8(base + 0x34),
      hpAdd: dv.getUint8(base + 0x35),
      manaRegen: dv.getUint8(base + 0x3a),
      toHitFactor: dv.getInt32(base + 0x3c, true),
      walkVelocity: dv.getUint8(base + 0x40),
      runVelocity: dv.getUint8(base + 0x41),
      runDrain: dv.getUint8(base + 0x42),
      lifePerLevel: dv.getUint8(base + 0x43),
      staminaPerLevel: dv.getUint8(base + 0x44),
      manaPerLevel: dv.getUint8(base + 0x45),
      lifePerVitality: dv.getUint8(base + 0x46),
      staminaPerVitality: dv.getUint8(base + 0x47),
      manaPerMagic: dv.getUint8(base + 0x48),
      blockFactor: dv.getUint8(base + 0x49),
      statPerLevel: dv.getUint8(base + 0x50),
    }
  }
  return out
}

/**
 * Compact helper used solely to expand canonical 1.13c `ItemStatCost.bin` rows into full
 * `ItemStatCostMeta113c` objects with 100% field parity against `parseItemStatCostBin113c`.
 */
type RawIscTuple = readonly [
  statId: number,
  flags: number,
  diskFlags: number,
  sendBits: number,
  sendParamBits: number,
  csvBits: number,
  csvParam: number,
  divide: number,
  multiply: number,
  add: number,
  valShift: number,
  saveBits: number,
  saveBits109: number,
  saveAdd: number,
  saveAdd109: number,
  saveParamBits: number,
  minAccr: number,
  encode: number,
  maxStat: number,
  itemEvent1: number,
  itemEvent2: number,
  itemEventFunc1: number,
  itemEventFunc2: number,
  keepZero: number,
  op: number,
  opParam: number,
  opBase: number,
  opStats: readonly number[],
  stuff: number,
]

function expandIscTuple(t: RawIscTuple): ItemStatCostMeta113c {
  const flags = t[1]
  return {
    statId: t[0],
    flags,
    diskFlags: t[2],
    sendOther: (flags & ISC_FLAG_SEND_OTHER) !== 0,
    signed: (flags & ISC_FLAG_SIGNED) !== 0,
    damageRelated: (flags & ISC_FLAG_DAMAGE_RELATED) !== 0,
    itemSpecific: (flags & ISC_FLAG_ITEM_SPECIFIC) !== 0,
    direct: (flags & ISC_FLAG_DIRECT) !== 0,
    runtimeMaxStat: (flags & ISC_FLAG_RUNTIME_MAXSTAT) !== 0,
    runtimeMaxHp: (flags & ISC_FLAG_RUNTIME_MAXHP) !== 0,
    runtimeMaxMana: (flags & ISC_FLAG_RUNTIME_MAXMANA) !== 0,
    runtimeMaxStam: (flags & ISC_FLAG_RUNTIME_MAXSTAM) !== 0,
    updateAnimRate: (flags & ISC_FLAG_UPDATE_ANIM_RATE) !== 0,
    fMin: (flags & ISC_FLAG_FMIN) !== 0,
    fCallback: (flags & ISC_FLAG_FCALLBACK) !== 0,
    saved: (flags & ISC_FLAG_SAVED) !== 0,
    csvSigned: (flags & ISC_FLAG_CSV_SIGNED) !== 0,
    sendBits: t[3],
    sendParamBits: t[4],
    csvBits: t[5],
    csvParam: t[6],
    divide: t[7],
    multiply: t[8],
    add: t[9],
    valShift: t[10],
    saveBits: t[11],
    saveBits109: t[12],
    saveAdd: t[13],
    saveAdd109: t[14],
    saveParamBits: t[15],
    minAccr: t[16],
    encode: t[17],
    maxStat: t[18],
    itemEvent1: t[19],
    itemEvent2: t[20],
    itemEventFunc1: t[21],
    itemEventFunc2: t[22],
    keepZero: t[23] !== 0,
    op: t[24],
    opParam: t[25],
    opBase: t[26],
    opStats: t[27],
    stuff: t[28],
  }
}

const RAW_ITEM_STAT_COST_113C: readonly RawIscTuple[] = [
  [0, 0x1401, 0x1401, 11, 0, 10, 0, 1024, 55, 125, 0, 8, 7, 32, 32, 0, 1, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 6], // 0: strength
  [1, 0x14a0, 0x1400, 11, 0, 10, 0, 1024, 55, 100, 0, 7, 7, 32, 32, 0, 1, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 8, 0, 0xffff, [9], 0], // 1: energy
  [2, 0x1401, 0x1401, 11, 0, 10, 0, 1024, 55, 125, 0, 7, 7, 32, 32, 0, 1, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 2: dexterity
  [3, 0x1560, 0x1400, 11, 0, 10, 0, 1024, 55, 100, 0, 7, 7, 32, 32, 0, 1, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 9, 0, 0xffff, [7, 11], 0], // 3: vitality
  [4, 0x1000, 0x1000, 9, 0, 10, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 4: statpts
  [5, 0x1000, 0x1000, 9, 0, 8, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 5: newskills
  [6, 0x1010, 0x1010, 32, 0, 21, 0, 1024, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 7, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 6: hitpoints
  [7, 0x1c00, 0x1c00, 32, 0, 21, 0, 1024, 20, 56, 8, 9, 8, 32, 32, 0, 1, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 7: maxhp
  [8, 0x1010, 0x1010, 32, 0, 21, 0, 1024, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 9, 0xffff, 0xffff, 0, 0, 1, 0, 0, 0xffff, [], 0], // 8: mana
  [9, 0x1c00, 0x1c00, 32, 0, 21, 0, 1024, 20, 81, 8, 8, 8, 32, 32, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 9: maxmana
  [10, 0x1010, 0x1010, 32, 0, 21, 0, 1024, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 11, 0xffff, 0xffff, 0, 0, 1, 0, 0, 0xffff, [], 0], // 10: stamina
  [11, 0x1c00, 0x1c00, 32, 0, 21, 0, 1024, 20, 75, 8, 8, 8, 32, 32, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 11: maxstamina
  [12, 0x1000, 0x1000, 9, 0, 7, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 12: level
  [13, 0x1000, 0x1000, 32, 0, 32, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 13: experience
  [14, 0x1000, 0x1000, 32, 0, 25, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 14: gold
  [15, 0x1000, 0x1000, 32, 0, 25, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 15: goldbank
  [16, 0x0002, 0x0002, 11, 0, 0, 0, 1024, 20, 47, 0, 9, 9, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 13, 0, 0xffff, [31], 0], // 16: item_armor_percent
  [17, 0x0006, 0x0006, 11, 0, 0, 0, 1024, 20, 45, 0, 9, 9, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 13, 0, 0xffff, [22, 24, 160], 0], // 17: item_maxdamage_percent
  [18, 0x0006, 0x0006, 11, 0, 0, 0, 1024, 20, 45, 0, 9, 9, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 13, 0, 0xffff, [21, 23, 159], 0], // 18: item_mindamage_percent
  [19, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 10, 15, 0, 10, 10, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 19: tohit
  [20, 0x0002, 0x0002, 10, 0, 0, 0, 1024, 204, 89, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 20: toblock
  [21, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 25, 122, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 21: mindamage
  [22, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 16, 94, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 22: maxdamage
  [23, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 15, 97, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 23: secondary_mindamage
  [24, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 11, 85, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 24: secondary_maxdamage
  [25, 0x0006, 0x0006, 12, 0, 0, 0, 1024, 40, 45, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 25: damagepercent
  [26, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 26: manarecovery
  [27, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 27: manarecoverybonus
  [28, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 28: staminarecoverybonus
  [29, 0x0000, 0x0000, 32, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 29: lastexp
  [30, 0x0000, 0x0000, 32, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 30: nextexp
  [31, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 10, 17, 0, 11, 10, 10, 10, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 31: armorclass
  [32, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 5, 11, 0, 9, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 32: armorclass_vs_missile
  [33, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 7, 13, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 33: armorclass_vs_hth
  [34, 0x0002, 0x0002, 10, 0, 0, 0, 1024, 200, 188, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 34: normal_damage_reduction
  [35, 0x0002, 0x0002, 10, 0, 0, 0, 1024, 340, 397, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 35: magic_damage_reduction
  [36, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 68, 152, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 36: damageresist
  [37, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 68, 164, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 37: magicresist
  [38, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 409, 1091, 0, 5, 5, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 38: maxmagicresist
  [39, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 20, 43, 0, 8, 8, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 39: fireresist
  [40, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 256, 584, 0, 5, 5, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 40: maxfireresist
  [41, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 20, 43, 0, 8, 8, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 41: lightresist
  [42, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 256, 584, 0, 5, 5, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 42: maxlightresist
  [43, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 20, 43, 0, 8, 8, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 43: coldresist
  [44, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 256, 584, 0, 5, 5, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 44: maxcoldresist
  [45, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 20, 43, 0, 8, 8, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 45: poisonresist
  [46, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 256, 526, 0, 5, 5, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 46: maxpoisonresist
  [47, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 47: damageaura
  [48, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 10, 11, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 48: firemindam
  [49, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 10, 19, 0, 9, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 49: firemaxdam
  [50, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 10, 12, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 50: lightmindam
  [51, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 10, 17, 0, 10, 9, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 51: lightmaxdam
  [52, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 20, 196, 0, 8, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 52: magicmindam
  [53, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 20, 183, 0, 9, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 53: magicmaxdam
  [54, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 512, 451, 0, 8, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 54: coldmindam
  [55, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 340, 128, 0, 9, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 55: coldmaxdam
  [56, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 4, 77, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 56: coldlength
  [57, 0x0006, 0x0006, 19, 0, 0, 0, 1024, 28, 12, 0, 10, 9, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 57: poisonmindam
  [58, 0x0006, 0x0006, 19, 0, 0, 0, 1024, 34, 11, 0, 10, 9, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 58: poisonmaxdam
  [59, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 4, 0, 0, 9, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 59: poisonlength
  [60, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 341, 1044, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 60: lifedrainmindam
  [61, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 61: lifedrainmaxdam
  [62, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 341, 1179, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 62: manadrainmindam
  [63, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 63: manadrainmaxdam
  [64, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 64: stamdrainmindam
  [65, 0x0006, 0x0006, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 65: stamdrainmaxdam
  [66, 0x0004, 0x0004, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 66: stunlength
  [67, 0x0203, 0x0203, 10, 0, 0, 0, 1024, 0, 0, 0, 7, 7, 30, 30, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 67: velocitypercent
  [68, 0x0207, 0x0207, 10, 0, 0, 0, 1024, 0, 0, 0, 7, 7, 30, 30, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 68: attackrate
  [69, 0x0203, 0x0203, 10, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 69: other_animrate
  [70, 0x000e, 0x000e, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 70: quantity
  [71, 0x000a, 0x000a, 9, 0, 0, 0, 1024, 0, 0, 0, 8, 8, 100, 100, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 71: value
  [72, 0x001a, 0x001a, 9, 0, 0, 0, 1024, 0, 0, 0, 9, 8, 0, 0, 0, 0, 0, 73, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 72: durability
  [73, 0x000a, 0x000a, 9, 0, 0, 0, 1024, 4, 9, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 73: maxdurability
  [74, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 410, 451, 0, 6, 6, 30, 30, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 74: hpregen
  [75, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 10, 117, 0, 7, 7, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 13, 0, 0xffff, [73], 0], // 75: item_maxdurability_percent
  [76, 0x0062, 0x0002, 16, 0, 0, 0, 1024, 204, 32093, 0, 6, 6, 10, 10, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 11, 0, 0xffff, [7], 0], // 76: item_maxhp_percent
  [77, 0x00a2, 0x0002, 16, 0, 0, 0, 1024, 204, 56452, 0, 6, 6, 10, 10, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 11, 0, 0xffff, [9], 0], // 77: item_maxmana_percent
  [78, 0x0802, 0x0802, 16, 0, 0, 0, 1024, 128, 112, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 1, 0xffff, 6, 0, 0, 0, 0, 0xffff, [], 0], // 78: item_attackertakesdamage
  [79, 0x0002, 0x0002, 10, 0, 0, 0, 1024, 34, 187, 0, 9, 9, 100, 100, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 79: item_goldbonus
  [80, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 102, 577, 0, 8, 8, 100, 100, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 80: item_magicbonus
  [81, 0x0806, 0x0806, 8, 0, 0, 0, 1024, 0, 105, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 5, 6, 7, 7, 0, 0, 0, 0xffff, [], 0], // 81: item_knockback
  [82, 0x0002, 0x0002, 10, 0, 0, 0, 1024, 0, 0, 0, 9, 9, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 82: item_timeduration
  [83, 0x0802, 0x0802, 4, 3, 0, 0, 1024, 1560, 49523, 0, 3, 3, 0, 0, 3, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 83: item_addclassskills
  [84, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 84: unsentparam1
  [85, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 519, 36015, 0, 9, 3, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 85: item_addexperience
  [86, 0x0802, 0x0802, 7, 0, 0, 0, 1024, 101, 30, 0, 7, 3, 0, 0, 0, 0, 0, 0xffff, 9, 0xffff, 28, 0, 0, 0, 0, 0xffff, [], 0], // 86: item_healafterkill
  [87, 0x0000, 0x0000, 8, 0, 0, 0, 1024, 203, 18957, 0, 7, 3, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 87: item_reducedprices
  [88, 0x0002, 0x0002, 2, 0, 0, 0, 1024, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 88: item_doubleherbduration
  [89, 0x0802, 0x0802, 5, 0, 0, 0, 1024, 51, 15, 0, 4, 4, 4, 4, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 89: item_lightradius
  [90, 0x0802, 0x0802, 24, 0, 0, 0, 1024, 0, 155, 0, 24, 5, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 90: item_lightcolor
  [91, 0x0002, 0x0002, 8, 0, 0, 0, 1024, -34, 26, 0, 8, 8, 100, 100, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 91: item_req_percent
  [92, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 7, 6, 0, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 92: item_levelreq
  [93, 0x0007, 0x0007, 9, 0, 0, 0, 1024, 156, 1042, 0, 7, 7, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 93: item_fasterattackrate
  [94, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 7, 7, 64, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 13, 0, 0xffff, [92], 0], // 94: item_levelreqpct
  [95, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 6, 0, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 95: lastblockframe
  [96, 0x0003, 0x0003, 9, 0, 0, 0, 1024, 156, 4083, 0, 7, 7, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 96: item_fastermovevelocity
  [97, 0x0802, 0x0802, 15, 9, 0, 0, 1024, 327, 181, 0, 6, 7, 0, 20, 9, 0, 1, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 97: item_nonclassskill
  [98, 0x0801, 0x0801, 1, 8, 0, 0, 1024, 64, 415, 0, 1, 6, 0, 20, 8, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 98: state
  [99, 0x0003, 0x0003, 9, 0, 0, 0, 1024, 72, 1065, 0, 7, 7, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 99: item_fastergethitrate
  [100, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 7, 0, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 100: monster_playercount
  [101, 0x0000, 0x0000, 8, 0, 0, 0, 1024, 0, 0, 0, 0, 6, 0, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 101: skill_poison_override_length
  [102, 0x0003, 0x0003, 9, 0, 0, 0, 1024, 72, 1484, 0, 7, 7, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 102: item_fasterblockrate
  [103, 0x0000, 0x0000, 1, 0, 0, 0, 1024, 0, 0, 0, 0, 7, 0, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 103: skill_bypass_undead
  [104, 0x0000, 0x0000, 1, 0, 0, 0, 1024, 0, 0, 0, 0, 6, 0, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 104: skill_bypass_demons
  [105, 0x0003, 0x0003, 9, 0, 0, 0, 1024, 156, 3876, 0, 7, 7, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 105: item_fastercastrate
  [106, 0x0000, 0x0000, 1, 0, 0, 0, 1024, 0, 0, 0, 0, 7, 0, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 106: skill_bypass_beasts
  [107, 0x0802, 0x0802, 15, 9, 0, 0, 1024, 256, 181, 0, 3, 14, 0, 0, 9, 0, 1, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 107: item_singleskill
  [108, 0x0804, 0x0804, 1, 0, 0, 0, 1024, 0, 1987, 0, 1, 14, 0, 0, 0, 0, 0, 0xffff, 9, 0xffff, 29, 0, 0, 0, 0, 0xffff, [], 0], // 108: item_restinpeace
  [109, 0x0000, 0x0000, 9, 0, 0, 0, 1024, 33, 159, 0, 9, 14, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 109: curse_resistance
  [110, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 10, 27, 0, 8, 8, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 110: item_poisonlengthresist
  [111, 0x0006, 0x0006, 8, 0, 0, 0, 1024, 100, 94, 0, 9, 7, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 111: item_normaldamage
  [112, 0x0806, 0x0806, 8, 0, 0, 0, 1024, 10, 55, 0, 7, 7, -1, -1, 0, 0, 0, 0xffff, 5, 6, 8, 8, 0, 0, 0, 0xffff, [], 0], // 112: item_howl
  [113, 0x0806, 0x0806, 8, 0, 0, 0, 1024, 1024, 332, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 5, 6, 9, 9, 0, 0, 0, 0xffff, [], 0], // 113: item_stupidity
  [114, 0x0802, 0x0802, 7, 0, 0, 0, 1024, 20, 43, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 1, 2, 13, 13, 0, 0, 0, 0xffff, [], 0], // 114: item_damagetomana
  [115, 0x0006, 0x0006, 2, 0, 0, 0, 1024, 1024, 1088, 0, 1, 1, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 115: item_ignoretargetac
  [116, 0x0006, 0x0006, 8, 0, 0, 0, 1024, 20, 67, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 116: item_fractionaltargetac
  [117, 0x0006, 0x0006, 8, 0, 0, 0, 1024, 50, 48, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 117: item_preventheal
  [118, 0x0002, 0x0002, 2, 0, 0, 0, 1024, 988, 5096, 0, 1, 1, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 118: item_halffreezeduration
  [119, 0x0006, 0x0006, 12, 0, 0, 0, 1024, 40, 981, 0, 9, 9, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 119: item_tohit_percent
  [120, 0x0006, 0x0006, 8, 0, 0, 0, 1024, -20, 24, 0, 7, 7, 128, 128, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 120: item_damagetargetac
  [121, 0x0006, 0x0006, 12, 0, 0, 0, 1024, 12, 19, 0, 9, 9, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 121: item_demondamage_percent
  [122, 0x0006, 0x0006, 12, 0, 0, 0, 1024, 12, 13, 0, 9, 9, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 122: item_undeaddamage_percent
  [123, 0x0006, 0x0006, 13, 0, 0, 0, 1024, 7, 15, 0, 10, 10, 128, 128, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 123: item_demon_tohit
  [124, 0x0006, 0x0006, 13, 0, 0, 0, 1024, 7, 11, 0, 10, 10, 128, 128, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 124: item_undead_tohit
  [125, 0x0002, 0x0002, 2, 0, 0, 0, 1024, 1024, 82, 0, 1, 1, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 125: item_throwable
  [126, 0x0802, 0x0802, 3, 3, 0, 0, 1024, 1024, 76, 0, 3, 4, 0, 0, 3, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 126: item_elemskill
  [127, 0x0802, 0x0802, 8, 0, 0, 0, 1024, 4096, 15123, 0, 3, 3, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 127: item_allskills
  [128, 0x0802, 0x0802, 6, 0, 0, 0, 1024, 102, 4, 0, 5, 5, 0, 0, 0, 0, 0, 0xffff, 1, 0xffff, 10, 0, 0, 0, 0, 0xffff, [], 0], // 128: item_attackertakeslightdamage
  [129, 0x0002, 0x0002, 10, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 129: ironmaiden_level
  [130, 0x0002, 0x0002, 10, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 130: lifetap_level
  [131, 0x0000, 0x0000, 12, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 131: thorns_percent
  [132, 0x0002, 0x0002, 32, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 132: bonearmor
  [133, 0x0002, 0x0002, 32, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 133: bonearmormax
  [134, 0x0806, 0x0806, 5, 0, 0, 0, 1024, 12, 666, 0, 5, 5, 0, 0, 0, 0, 0, 0xffff, 5, 6, 14, 14, 0, 0, 0, 0xffff, [], 0], // 134: item_freeze
  [135, 0x0806, 0x0806, 7, 0, 0, 0, 1024, 10, 23, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 5, 6, 15, 15, 0, 0, 0, 0xffff, [], 0], // 135: item_openwounds
  [136, 0x0806, 0x0806, 7, 0, 0, 0, 1024, 40, 98, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 5, 6, 16, 16, 0, 0, 0, 0xffff, [], 0], // 136: item_crushingblow
  [137, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 51, 77, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 137: item_kickdamage
  [138, 0x0802, 0x0802, 7, 0, 0, 0, 1024, 102, 17, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 9, 0xffff, 17, 0, 0, 0, 0, 0xffff, [], 0], // 138: item_manaafterkill
  [139, 0x0802, 0x0802, 7, 0, 0, 0, 1024, 102, 18, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 9, 0xffff, 18, 0, 0, 0, 0, 0xffff, [], 0], // 139: item_healafterdemonkill
  [140, 0x0006, 0x0006, 7, 0, 0, 0, 1024, 10, 15, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 140: item_extrablood
  [141, 0x0006, 0x0006, 7, 0, 0, 0, 1024, 25, 31, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 141: item_deadlystrike
  [142, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 102, 5486, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 142: item_absorbfire_percent
  [143, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 204, 1739, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 143: item_absorbfire
  [144, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 102, 5486, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 144: item_absorblight_percent
  [145, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 204, 1739, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 145: item_absorblight
  [146, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 102, 5486, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 146: item_absorbmagic_percent
  [147, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 204, 1739, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 147: item_absorbmagic
  [148, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 102, 5486, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 148: item_absorbcold_percent
  [149, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 204, 1739, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 149: item_absorbcold
  [150, 0x0806, 0x0806, 7, 0, 0, 0, 1024, 40, 101, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 5, 6, 19, 19, 0, 0, 0, 0xffff, [], 0], // 150: item_slow
  [151, 0x0802, 0x0802, 0, 0, 0, 0, 1024, 0, 0, 0, 5, 7, 0, 0, 9, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 151: item_aura
  [152, 0x0002, 0x0002, 1, 0, 0, 0, 1024, 0, 0, 0, 1, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 152: item_indesctructible
  [153, 0x0002, 0x0002, 2, 0, 0, 0, 1024, 2048, 15011, 0, 1, 1, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 153: item_cannotbefrozen
  [154, 0x0006, 0x0006, 7, 0, 0, 0, 1024, 20, 102, 0, 7, 7, 20, 20, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 154: item_staminadrainpct
  [155, 0x0804, 0x0804, 7, 10, 0, 0, 1024, 0, 0, 0, 7, 7, 0, 0, 10, 0, 0, 0xffff, 9, 0xffff, 31, 0, 0, 0, 0, 0xffff, [], 0], // 155: item_reanimate
  [156, 0x0006, 0x0006, 7, 0, 0, 0, 1024, 2048, 1924, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 156: item_pierce
  [157, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 1024, 511, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 157: item_magicarrow
  [158, 0x0002, 0x0002, 7, 0, 0, 0, 1024, 1536, 492, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 158: item_explosivearrow
  [159, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 128, 76, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 159: item_throw_mindamage
  [160, 0x0006, 0x0006, 7, 0, 0, 0, 1024, 128, 88, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 160: item_throw_maxdamage
  [161, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 161: skill_handofathena
  [162, 0x0122, 0x0002, 13, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 1, 0, 0xffff, [11], 0], // 162: skill_staminapercent
  [163, 0x0122, 0x0002, 12, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 1, 0, 0xffff, [11], 0], // 163: skill_passive_staminapercent
  [164, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 164: skill_concentration
  [165, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 165: skill_enchant
  [166, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 166: skill_pierce
  [167, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 167: skill_conviction
  [168, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 168: skill_chillingarmor
  [169, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 169: skill_frenzy
  [170, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 170: skill_decrepify
  [171, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 171: skill_armor_percent
  [172, 0x0001, 0x0001, 2, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 172: alignment
  [173, 0x0000, 0x0000, 32, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 173: target0
  [174, 0x0000, 0x0000, 32, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 174: target1
  [175, 0x0000, 0x0000, 24, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 175: goldlost
  [176, 0x0000, 0x0000, 8, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 176: conversion_level
  [177, 0x0000, 0x0000, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 177: conversion_maxhp
  [178, 0x0000, 0x0000, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 178: unit_dooverlay
  [179, 0x0004, 0x0004, 9, 10, 0, 0, 1024, 14, 19, 0, 9, 3, 0, 0, 10, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 179: attack_vs_montype
  [180, 0x0004, 0x0004, 9, 10, 0, 0, 1024, 17, 27, 0, 9, 3, 0, 0, 10, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 180: damage_vs_montype
  [181, 0x0001, 0x0001, 7, 0, 0, 0, 0, 0, 0, 0, 3, 14, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 181: fade
  [182, 0x0003, 0x0003, 8, 0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 182: armor_override_percent
  [183, 0x0000, 0x0000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 183: unused183
  [184, 0x0000, 0x0000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 184: unused184
  [185, 0x0000, 0x0000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 185: unused185
  [186, 0x0000, 0x0000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 186: unused186
  [187, 0x0000, 0x0000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 187: unused187
  [188, 0x0802, 0x0802, 3, 6, 0, 0, 1024, 768, 11042, 0, 3, 10, 0, 0, 16, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 188: item_addskill_tab
  [189, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 189: unused189
  [190, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 190: unused190
  [191, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 191: unused191
  [192, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 192: unused192
  [193, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 193: unused193
  [194, 0x000a, 0x000a, 4, 0, 0, 0, 1024, 170, 38, 0, 4, 4, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 194: item_numsockets
  [195, 0x0806, 0x0806, 7, 16, 0, 0, 1024, 256, 190, 0, 7, 21, 0, 0, 16, 0, 2, 0xffff, 7, 8, 20, 20, 0, 0, 0, 0xffff, [], 0], // 195: item_skillonattack
  [196, 0x0806, 0x0806, 7, 16, 0, 0, 1024, 19, 85, 0, 7, 21, 0, 0, 16, 0, 2, 0xffff, 9, 0xffff, 20, 0, 0, 0, 0, 0xffff, [], 0], // 196: item_skillonkill
  [197, 0x0802, 0x0802, 7, 16, 0, 0, 1024, 9, 11, 0, 7, 21, 0, 0, 16, 0, 2, 0xffff, 10, 0xffff, 30, 0, 0, 0, 0, 0xffff, [], 0], // 197: item_skillondeath
  [198, 0x0806, 0x0806, 7, 16, 0, 0, 1024, 256, 190, 0, 7, 21, 0, 0, 16, 0, 2, 0xffff, 5, 6, 20, 20, 0, 0, 0, 0xffff, [], 0], // 198: item_skillonhit
  [199, 0x0802, 0x0802, 7, 16, 0, 0, 1024, 6, 7, 0, 7, 21, 0, 0, 16, 0, 2, 0xffff, 12, 0xffff, 30, 0, 0, 0, 0, 0xffff, [], 0], // 199: item_skillonlevelup
  [200, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 21, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 200: unused200
  [201, 0x0802, 0x0802, 7, 16, 0, 0, 1024, 256, 190, 0, 7, 21, 0, 0, 16, 0, 2, 0xffff, 1, 2, 21, 21, 0, 0, 0, 0xffff, [], 0], // 201: item_skillongethit
  [202, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 21, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 202: unused202
  [203, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 21, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 203: unused203
  [204, 0x0802, 0x0802, 30, 0, 0, 0, 1024, 256, 401, 0, 16, 30, 0, 0, 16, 0, 3, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 204: item_charged_skill
  [205, 0x0002, 0x0002, 30, 0, 0, 0, 1024, 256, 401, 0, 0, 30, 0, 0, 0, 0, 3, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 205: unused204
  [206, 0x0002, 0x0002, 30, 0, 0, 0, 1024, 256, 401, 0, 0, 30, 0, 0, 0, 0, 3, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 206: unused205
  [207, 0x0002, 0x0002, 30, 0, 0, 0, 1024, 256, 401, 0, 0, 30, 0, 0, 0, 0, 3, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 207: unused206
  [208, 0x0002, 0x0002, 30, 0, 0, 0, 1024, 256, 401, 0, 0, 30, 0, 0, 0, 0, 3, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 208: unused207
  [209, 0x0002, 0x0002, 30, 0, 0, 0, 1024, 256, 401, 0, 0, 30, 0, 0, 0, 0, 3, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 209: unused208
  [210, 0x0002, 0x0002, 30, 0, 0, 0, 1024, 256, 401, 0, 0, 30, 0, 0, 0, 0, 3, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 210: unused209
  [211, 0x0002, 0x0002, 30, 0, 0, 0, 1024, 256, 401, 0, 0, 30, 0, 0, 0, 0, 3, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 211: unused210
  [212, 0x0002, 0x0002, 30, 0, 0, 0, 1024, 256, 401, 0, 0, 30, 0, 0, 0, 0, 3, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 212: unused211
  [213, 0x0002, 0x0002, 30, 0, 0, 0, 1024, 256, 401, 0, 0, 30, 0, 0, 0, 0, 3, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 213: unused212
  [214, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 42, 43, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 4, 3, 12, [31], 0], // 214: item_armor_perlevel
  [215, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 100, 87, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 5, 3, 12, [31], 0], // 215: item_armorpercent_perlevel
  [216, 0x0062, 0x0002, 6, 0, 0, 0, 1024, 64, 92, 8, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [7], 0], // 216: item_hp_perlevel
  [217, 0x00a2, 0x0002, 6, 0, 0, 0, 1024, 128, 90, 8, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [9], 0], // 217: item_mana_perlevel
  [218, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 204, 54, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 4, 3, 12, [22, 24, 160], 0], // 218: item_maxdamage_perlevel
  [219, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 100, 86, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 5, 3, 12, [22, 24, 160], 0], // 219: item_maxdamage_percent_perlevel
  [220, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 128, 132, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [0], 0], // 220: item_strength_perlevel
  [221, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 128, 132, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [2], 0], // 221: item_dexterity_perlevel
  [222, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 128, 105, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [1], 0], // 222: item_energy_perlevel
  [223, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 128, 105, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [3], 0], // 223: item_vitality_perlevel
  [224, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 20, 53, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 1, 12, [19], 0], // 224: item_tohit_perlevel
  [225, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 256, 10, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 1, 12, [119], 0], // 225: item_tohitpercent_perlevel
  [226, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 340, 1058, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [55], 0], // 226: item_cold_damagemax_perlevel
  [227, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 128, 49, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [49], 0], // 227: item_fire_damagemax_perlevel
  [228, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 128, 49, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [51], 0], // 228: item_ltng_damagemax_perlevel
  [229, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 128, 49, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [58], 0], // 229: item_pois_damagemax_perlevel
  [230, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 128, 101, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [43], 0], // 230: item_resist_cold_perlevel
  [231, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 128, 101, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [39], 0], // 231: item_resist_fire_perlevel
  [232, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 128, 101, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [41], 0], // 232: item_resist_ltng_perlevel
  [233, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 128, 101, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [45], 0], // 233: item_resist_pois_perlevel
  [234, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 340, 207, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [149], 0], // 234: item_absorb_cold_perlevel
  [235, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 340, 207, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [143], 0], // 235: item_absorb_fire_perlevel
  [236, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 340, 207, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [145], 0], // 236: item_absorb_ltng_perlevel
  [237, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 340, 207, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [147], 0], // 237: item_absorb_pois_perlevel
  [238, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 256, 55, 0, 5, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [78], 0], // 238: item_thorns_perlevel
  [239, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 256, 42, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [79], 0], // 239: item_find_gold_perlevel
  [240, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 1024, 814, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [80], 0], // 240: item_find_magic_perlevel
  [241, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 256, 79, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [28], 0], // 241: item_regenstamina_perlevel
  [242, 0x0122, 0x0002, 6, 0, 0, 0, 1024, 64, 104, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [11], 0], // 242: item_stamina_perlevel
  [243, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 10, 56, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [121], 0], // 243: item_damage_demon_perlevel
  [244, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 10, 91, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [122], 0], // 244: item_damage_undead_perlevel
  [245, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 10, 55, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 1, 12, [123], 0], // 245: item_tohit_demon_perlevel
  [246, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 10, 12, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 1, 12, [124], 0], // 246: item_tohit_undead_perlevel
  [247, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 1024, 213, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [136], 0], // 247: item_crushingblow_perlevel
  [248, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 128, 181, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [135], 0], // 248: item_openwounds_perlevel
  [249, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 128, 104, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [137], 0], // 249: item_kick_damage_perlevel
  [250, 0x0006, 0x0006, 6, 0, 0, 0, 1024, 512, 118, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 2, 3, 12, [141], 0], // 250: item_deadlystrike_perlevel
  [251, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 251: item_find_gems_perlevel
  [252, 0x0002, 0x0002, 5, 0, 0, 0, 1024, 256, 106, 0, 6, 5, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 252: item_replenish_durability
  [253, 0x0002, 0x0002, 5, 0, 0, 0, 1024, 256, 106, 0, 6, 5, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 253: item_replenish_quantity
  [254, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 10, 99, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 254: item_extra_stack
  [255, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 255: item_find_item
  [256, 0x0006, 0x0006, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 256: item_slash_damage
  [257, 0x0006, 0x0006, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 257: item_slash_damage_percent
  [258, 0x0006, 0x0006, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 258: item_crush_damage
  [259, 0x0006, 0x0006, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 259: item_crush_damage_percent
  [260, 0x0006, 0x0006, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 260: item_thrust_damage
  [261, 0x0006, 0x0006, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 261: item_thrust_damage_percent
  [262, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 262: item_absorb_slash
  [263, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 263: item_absorb_crush
  [264, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 264: item_absorb_thrust
  [265, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 265: item_absorb_slash_percent
  [266, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 266: item_absorb_crush_percent
  [267, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 267: item_absorb_thrust_percent
  [268, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [31], 0], // 268: item_armor_bytime
  [269, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 7, 0, 0xffff, [31], 0], // 269: item_armorpercent_bytime
  [270, 0x0062, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [7], 0], // 270: item_hp_bytime
  [271, 0x00a2, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [9], 0], // 271: item_mana_bytime
  [272, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [22, 24, 160], 0], // 272: item_maxdamage_bytime
  [273, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 7, 0, 0xffff, [22, 23, 159], 0], // 273: item_maxdamage_percent_bytime
  [274, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [0], 0], // 274: item_strength_bytime
  [275, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [2], 0], // 275: item_dexterity_bytime
  [276, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [1], 0], // 276: item_energy_bytime
  [277, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [3], 0], // 277: item_vitality_bytime
  [278, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [19], 0], // 278: item_tohit_bytime
  [279, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [119], 0], // 279: item_tohitpercent_bytime
  [280, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [55], 0], // 280: item_cold_damagemax_bytime
  [281, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [49], 0], // 281: item_fire_damagemax_bytime
  [282, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [51], 0], // 282: item_ltng_damagemax_bytime
  [283, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [58], 0], // 283: item_pois_damagemax_bytime
  [284, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [43], 0], // 284: item_resist_cold_bytime
  [285, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [39], 0], // 285: item_resist_fire_bytime
  [286, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [41], 0], // 286: item_resist_ltng_bytime
  [287, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [45], 0], // 287: item_resist_pois_bytime
  [288, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [149], 0], // 288: item_absorb_cold_bytime
  [289, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [143], 0], // 289: item_absorb_fire_bytime
  [290, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [145], 0], // 290: item_absorb_ltng_bytime
  [291, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [147], 0], // 291: item_absorb_pois_bytime
  [292, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [79], 0], // 292: item_find_gold_bytime
  [293, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [80], 0], // 293: item_find_magic_bytime
  [294, 0x0002, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [28], 0], // 294: item_regenstamina_bytime
  [295, 0x0122, 0x0002, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [11], 0], // 295: item_stamina_bytime
  [296, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [121], 0], // 296: item_damage_demon_bytime
  [297, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [122], 0], // 297: item_damage_undead_bytime
  [298, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [123], 0], // 298: item_tohit_demon_bytime
  [299, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [124], 0], // 299: item_tohit_undead_bytime
  [300, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [136], 0], // 300: item_crushingblow_bytime
  [301, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [135], 0], // 301: item_openwounds_bytime
  [302, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [137], 0], // 302: item_kick_damage_bytime
  [303, 0x0006, 0x0006, 22, 0, 0, 0, 1024, 0, 0, 0, 22, 22, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 6, 0, 0xffff, [141], 0], // 303: item_deadlystrike_bytime
  [304, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 304: item_find_gems_bytime
  [305, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 513, 1432, 0, 8, 0, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 305: item_pierce_cold
  [306, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 497, 1240, 0, 8, 0, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 306: item_pierce_fire
  [307, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 481, 1187, 0, 8, 0, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 307: item_pierce_ltng
  [308, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 506, 1322, 0, 8, 0, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 308: item_pierce_pois
  [309, 0x0006, 0x0006, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 309: item_damage_vs_monster
  [310, 0x0006, 0x0006, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 310: item_damage_percent_vs_monster
  [311, 0x0006, 0x0006, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 311: item_tohit_vs_monster
  [312, 0x0006, 0x0006, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 312: item_tohit_percent_vs_monster
  [313, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 313: item_ac_vs_monster
  [314, 0x0002, 0x0002, 0, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 314: item_ac_percent_vs_monster
  [315, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 315: firelength
  [316, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 316: burningmin
  [317, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 317: burningmax
  [318, 0x0002, 0x0002, 3, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 318: progressive_damage
  [319, 0x0002, 0x0002, 3, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 319: progressive_steal
  [320, 0x0002, 0x0002, 3, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 320: progressive_other
  [321, 0x0002, 0x0002, 3, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 321: progressive_fire
  [322, 0x0002, 0x0002, 3, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 322: progressive_cold
  [323, 0x0002, 0x0002, 3, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 323: progressive_lightning
  [324, 0x000e, 0x000e, 6, 0, 0, 0, 1024, 0, 0, 0, 6, 6, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 324: item_extra_charges
  [325, 0x0002, 0x0002, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 325: progressive_tohit
  [326, 0x0006, 0x0006, 5, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 326: poison_count
  [327, 0x0002, 0x0002, 8, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 327: damage_framerate
  [328, 0x0002, 0x0002, 6, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 328: pierce_idx
  [329, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 415, 1117, 0, 9, 8, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 329: passive_fire_mastery
  [330, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 408, 1054, 0, 9, 8, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 330: passive_ltng_mastery
  [331, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 379, 1295, 0, 9, 8, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 331: passive_cold_mastery
  [332, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 394, 978, 0, 9, 8, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 332: passive_pois_mastery
  [333, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 2578, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 333: passive_fire_pierce
  [334, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 2493, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 334: passive_ltng_pierce
  [335, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 1984, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 335: passive_cold_pierce
  [336, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 2345, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 336: passive_pois_pierce
  [337, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 337: passive_critical_strike
  [338, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 0, 0, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 338: passive_dodge
  [339, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 0, 0, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 339: passive_avoid
  [340, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 0, 0, 0, 7, 7, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 340: passive_evade
  [341, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 341: passive_warmth
  [342, 0x0002, 0x0002, 11, 8, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 342: passive_mastery_melee_th
  [343, 0x0002, 0x0002, 11, 8, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 343: passive_mastery_melee_dmg
  [344, 0x0002, 0x0002, 9, 8, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 344: passive_mastery_melee_crit
  [345, 0x0002, 0x0002, 11, 8, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 345: passive_mastery_throw_th
  [346, 0x0002, 0x0002, 11, 8, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 346: passive_mastery_throw_dmg
  [347, 0x0002, 0x0002, 9, 8, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 347: passive_mastery_throw_crit
  [348, 0x0002, 0x0002, 9, 8, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 348: passive_weaponblock
  [349, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 349: passive_summon_resist
  [350, 0x0000, 0x0000, 9, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 350: modifierlist_skill
  [351, 0x0000, 0x0000, 8, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 351: modifierlist_level
  [352, 0x0002, 0x0002, 8, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 352: last_sent_hp_pct
  [353, 0x0000, 0x0000, 5, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 353: source_unit_type
  [354, 0x0000, 0x0000, 32, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 354: source_unit_id
  [355, 0x0000, 0x0000, 16, 0, 0, 0, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 355: shortparam1
  [356, 0x0000, 0x0000, 0, 0, 0, 0, 1024, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 356: questitemdifficulty
  [357, 0x0002, 0x0002, 12, 0, 0, 0, 1024, 431, 1211, 0, 9, 8, 50, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 357: passive_mag_mastery
  [358, 0x0002, 0x0002, 9, 0, 0, 0, 1024, 2812, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0, 0xffff, [], 0], // 358: passive_mag_pierce
]

/** Complete 359-row canonical 1.13c `ItemStatCost.bin` table (`statId 0..358`). */
export const CANONICAL_ITEM_STAT_COST_113C: readonly ItemStatCostMeta113CEntry[] = RAW_ITEM_STAT_COST_113C.map(expandIscTuple)
export type ItemStatCostMeta113CEntry = ItemStatCostMeta113c

/** Complete 7-row canonical 1.13c `CharStats.bin` table (`classId 0..6`). */
export const CANONICAL_CHAR_GROWTH_113C: readonly CharStatsGrowthMeta113c[] = [
  {
    classId: 0,
    className: 'Amazon',
    str: 20,
    dex: 25,
    int: 15,
    vit: 20,
    stamina: 84,
    hpAdd: 30,
    manaRegen: 120,
    toHitFactor: 5,
    walkVelocity: 6,
    runVelocity: 9,
    runDrain: 20,
    lifePerLevel: 8,
    staminaPerLevel: 4,
    manaPerLevel: 6,
    lifePerVitality: 12,
    staminaPerVitality: 4,
    manaPerMagic: 6,
    blockFactor: 25,
    statPerLevel: 5,
  },
  {
    classId: 1,
    className: 'Sorceress',
    str: 10,
    dex: 25,
    int: 35,
    vit: 10,
    stamina: 74,
    hpAdd: 30,
    manaRegen: 120,
    toHitFactor: -15,
    walkVelocity: 6,
    runVelocity: 9,
    runDrain: 20,
    lifePerLevel: 4,
    staminaPerLevel: 4,
    manaPerLevel: 8,
    lifePerVitality: 8,
    staminaPerVitality: 4,
    manaPerMagic: 8,
    blockFactor: 20,
    statPerLevel: 5,
  },
  {
    classId: 2,
    className: 'Necromancer',
    str: 15,
    dex: 25,
    int: 25,
    vit: 15,
    stamina: 79,
    hpAdd: 30,
    manaRegen: 120,
    toHitFactor: -10,
    walkVelocity: 6,
    runVelocity: 9,
    runDrain: 20,
    lifePerLevel: 6,
    staminaPerLevel: 4,
    manaPerLevel: 8,
    lifePerVitality: 8,
    staminaPerVitality: 4,
    manaPerMagic: 8,
    blockFactor: 20,
    statPerLevel: 5,
  },
  {
    classId: 3,
    className: 'Paladin',
    str: 25,
    dex: 20,
    int: 15,
    vit: 25,
    stamina: 89,
    hpAdd: 30,
    manaRegen: 120,
    toHitFactor: 20,
    walkVelocity: 6,
    runVelocity: 9,
    runDrain: 20,
    lifePerLevel: 8,
    staminaPerLevel: 4,
    manaPerLevel: 6,
    lifePerVitality: 12,
    staminaPerVitality: 4,
    manaPerMagic: 6,
    blockFactor: 30,
    statPerLevel: 5,
  },
  {
    classId: 4,
    className: 'Barbarian',
    str: 30,
    dex: 20,
    int: 10,
    vit: 25,
    stamina: 92,
    hpAdd: 30,
    manaRegen: 120,
    toHitFactor: 20,
    walkVelocity: 6,
    runVelocity: 9,
    runDrain: 20,
    lifePerLevel: 8,
    staminaPerLevel: 4,
    manaPerLevel: 4,
    lifePerVitality: 16,
    staminaPerVitality: 4,
    manaPerMagic: 4,
    blockFactor: 25,
    statPerLevel: 5,
  },
  {
    classId: 5,
    className: 'Druid',
    str: 15,
    dex: 20,
    int: 20,
    vit: 25,
    stamina: 84,
    hpAdd: 30,
    manaRegen: 120,
    toHitFactor: 5,
    walkVelocity: 6,
    runVelocity: 9,
    runDrain: 20,
    lifePerLevel: 6,
    staminaPerLevel: 4,
    manaPerLevel: 8,
    lifePerVitality: 8,
    staminaPerVitality: 4,
    manaPerMagic: 8,
    blockFactor: 20,
    statPerLevel: 5,
  },
  {
    classId: 6,
    className: 'Assassin',
    str: 20,
    dex: 20,
    int: 25,
    vit: 20,
    stamina: 95,
    hpAdd: 30,
    manaRegen: 120,
    toHitFactor: 15,
    walkVelocity: 6,
    runVelocity: 9,
    runDrain: 15,
    lifePerLevel: 8,
    staminaPerLevel: 5,
    manaPerLevel: 6,
    lifePerVitality: 12,
    staminaPerVitality: 5,
    manaPerMagic: 7,
    blockFactor: 25,
    statPerLevel: 5,
  },
]

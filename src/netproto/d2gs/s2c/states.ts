/**
 * D2GS S->C Unit State Packet Decoders (1.13c).
 * Verified against D2Client.dll:
 * - 0xA7 DelayedState (8B in D2Net, 7B in D2Client 0x6fb5deb0)
 * - 0xA8 SetState (variable pkt[6], D2Client 0x6fb5dd70)
 * - 0xA9 EndState (7B, D2Client 0x6fb5dd30)
 * - 0xAA AddUnitState (variable pkt[6], D2Client 0x6fb5db90)
 */

import { BitReader } from '../../core/bit-reader.ts'
import { ByteReader } from '../../core/byte-reader.ts'
import { unitTypeToId, type ItemDataTables, type ItemStat } from '../../domain/ids.ts'
import type { ServerEvent, StateSetEntry } from '../../domain/server-event.ts'

/** 0xA7 DelayedState (8B, D2Client.dll 0x6fb5deb0) */
export function decode0xA7DelayedState(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xA7
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const state = r.u8()
  return {
    type: 'StateSet',
    unit: { unitType, id },
    state,
    origin: 0xa7,
  }
}

/**
 * One state's stat list as D2Client reads it for 0xA8 (loop 0x6fb5ddc6-92) and 0xAA: 9-bit stat ids
 * until 0x1FF, each followed by its ItemStatCost `Send Param Bits` param (signed) and `Send Bits` value
 * (signed when Send Bits < 32 and the stat is signed). `complete` is false on a bail-out — a stat id the
 * table lacks or with Send Bits 0 (0x6fb5dde4, 0x6fb5ddf7, 0x6fb5de18) — and when a field runs past the
 * packet (the 1.13c reader zero-fills there; the decoder stops instead).
 */
function readStateStats(bits: BitReader, tables: ItemDataTables): { stats: ItemStat[]; complete: boolean } {
  const stats: ItemStat[] = []
  while (bits.remainingBits >= 9) {
    const statId = bits.readBits(9)
    if (statId >= 0x1ff) return { stats, complete: true }
    const entry = tables.getStatCost(statId)
    if (!entry || entry.sendBits <= 0) return { stats, complete: false }
    let param = 0
    if (entry.sendParamBits > 0) {
      if (bits.remainingBits < entry.sendParamBits) return { stats, complete: false }
      param = bits.readSignedBits(entry.sendParamBits)
    }
    if (bits.remainingBits < entry.sendBits) return { stats, complete: false }
    const value =
      entry.sendBits < 32 && entry.signed ? bits.readSignedBits(entry.sendBits) : bits.readBits(entry.sendBits)
    stats.push({ statId, param, value })
  }
  return { stats, complete: false }
}

/**
 * 0xA8 SetState (variable pkt[6], D2Client.dll 0x6fb5dd70):
 * Reads 9-bit statId loop terminated by 0x1FF (511), using sendParamBits and sendBits from ItemStatCost.
 * Only the terminator reaches the state set-function dispatch 0x6fb22530 (0x6fb5dea3): `complete`.
 */
export function decode0xA8SetState(pkt: Uint8Array, tables?: ItemDataTables): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xA8
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const packetLen = r.u8()
  const state = r.u8()

  const { stats, complete } =
    tables && packetLen > 8 && pkt.byteLength > 8
      ? readStateStats(new BitReader(pkt.subarray(8, Math.min(pkt.byteLength, packetLen))), tables)
      : { stats: [], complete: false }

  return {
    type: 'StateSet',
    unit: { unitType, id },
    state,
    stats: stats.length > 0 ? stats : undefined,
    origin: 0xa8,
    complete,
  }
}

/** 0xA9 EndState (7B, D2Client.dll 0x6fb5dd30) */
export function decode0xA9EndState(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xA9
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const state = r.u8()
  return {
    type: 'StateEnd',
    unit: { unitType, id },
    state,
  }
}

/**
 * 0xAA AddUnitState (variable pkt[6], D2Client.dll 0x6fb5db90): a bitstream from byte 7 of `pkt[6] - 7`
 * bytes holding states until 0xFF, each an 8-bit state, a `hasStats` bit and, when set, a stat list like
 * 0xA8's. The client sets every state and calls the set-function dispatch after each one (0x6fb5dcfa); a
 * stat bail-out ends the whole packet (that state stays `complete: false`, later states are not read).
 */
export function decode0xAAAddUnitState(pkt: Uint8Array, tables: ItemDataTables): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xAA
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const packetLen = r.u8()
  const states: StateSetEntry[] = []
  if (packetLen > 7 && pkt.byteLength > 7) {
    const bits = new BitReader(pkt.subarray(7, Math.min(pkt.byteLength, packetLen)))
    while (bits.remainingBits >= 8) {
      const state = bits.readBits(8)
      if (state >= 0xff) break
      if (bits.remainingBits < 1) {
        states.push({ state, complete: false })
        break
      }
      if (bits.readBits(1) === 0) {
        states.push({ state, complete: true })
        continue
      }
      const { stats, complete } = readStateStats(bits, tables)
      states.push({ state, ...(stats.length > 0 ? { stats } : {}), complete })
      if (!complete) break
    }
  }
  const first = states[0]
  return {
    type: 'StateSet',
    unit: { unitType, id },
    state: first?.state ?? 0,
    ...(first?.stats ? { stats: first.stats } : {}),
    origin: 0xaa,
    states,
  }
}

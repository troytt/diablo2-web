/**
 * Builders for the D2GS S2C unit-state packets the quest special lights read (#826), laid out as the
 * D2Client 1.13c handlers parse them: 0xA5 (8 bytes), 0xA7 (7 bytes), 0xA8 (`pkt[6]` bytes, state at 7,
 * stat bitstream from 8) and 0xAA (`pkt[6]` bytes, state bitstream from 7). Stat lists are 9-bit
 * ItemStatCost ids, each followed by its `Send Bits` value, ended by 0x1ff (LSB-first bitstreams).
 */

import { BitWriter } from '../../../src/netproto/index.ts'

/** ItemStatCost (1.13c) `Send Bits` of the stats these packets carry; all have `Send Param Bits` 0. */
const SEND_BITS: Readonly<Record<number, number>> = {
  172: 2, // alignment
  350: 9, // modifierlist_skill
  351: 8, // modifierlist_level
}

/** `[statId, value]`; a stat id without an entry in SEND_BITS is written bare (the client bails out on it). */
export type StatPair = readonly [statId: number, value: number]

export interface AddUnitStateEntry {
  readonly state: number
  /** Omitted: the `hasStats` bit is clear. */
  readonly stats?: readonly StatPair[]
  /** Write the 0x1ff terminator after the stats (default true). */
  readonly terminate?: boolean
}

function writeStats(w: BitWriter, stats: readonly StatPair[], terminate: boolean): void {
  for (const [statId, value] of stats) {
    w.writeBits(statId, 9)
    const bits = SEND_BITS[statId]
    if (bits !== undefined) w.writeBits(value, bits)
  }
  if (terminate) w.writeBits(0x1ff, 9)
}

function unitHeader(opcode: number, unitType: number, id: number): number[] {
  return [opcode, unitType, id & 0xff, (id >>> 8) & 0xff, (id >>> 16) & 0xff, (id >>> 24) & 0xff]
}

/** 0xA5 StateSkillEffect: unit, u16 state. */
export function packet0xA5(unitType: number, id: number, state: number): Uint8Array {
  return Uint8Array.from([...unitHeader(0xa5, unitType, id), state & 0xff, state >>> 8])
}

/** 0xA7 DelayedState: unit, u8 state. */
export function packet0xA7(unitType: number, id: number, state: number): Uint8Array {
  return Uint8Array.from([...unitHeader(0xa7, unitType, id), state])
}

/** 0xA8 SetState: unit, length, state, stat list. */
export function packet0xA8(
  unitType: number,
  id: number,
  state: number,
  stats: readonly StatPair[],
  terminate = true,
): Uint8Array {
  const w = new BitWriter()
  writeStats(w, stats, terminate)
  const body = w.toUint8Array()
  return Uint8Array.from([...unitHeader(0xa8, unitType, id), 8 + body.length, state, ...body])
}

/** 0xAA AddUnitState: unit, length, then per state 8-bit id, `hasStats` bit, stat list; 0xff ends. */
export function packet0xAA(
  unitType: number,
  id: number,
  states: readonly AddUnitStateEntry[],
  end = true,
): Uint8Array {
  const w = new BitWriter()
  for (const entry of states) {
    w.writeBits(entry.state, 8)
    if (entry.stats === undefined) {
      w.writeBits(0, 1)
      continue
    }
    w.writeBits(1, 1)
    writeStats(w, entry.stats, entry.terminate ?? true)
  }
  if (end) w.writeBits(0xff, 8)
  const body = w.toUint8Array()
  return Uint8Array.from([...unitHeader(0xaa, unitType, id), 7 + body.length, ...body])
}

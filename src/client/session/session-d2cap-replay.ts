/**
 * Deterministic `.d2cap` Capture Decoding & Frame-by-Frame Replay (`src/client/session/session-d2cap-replay.ts`).
 *
 * Extracted from `src/client/session/online-session.ts` (Phase 3 — Step 3.5, Refs #985).
 * Strict import boundary: imports only from `src/netproto/index.ts` (never `bncs/mcp/d2gs/crypto`).
 */

import {
  decodeD2gsS2cPacket,
  hexToBytes,
  parseD2CapJsonl,
  type D2CapRecord,
  type D2gsS2cFramer,
  type InMemoryPacketTap,
  type ItemDataTables,
  type PacketConn,
  type PacketDirection,
  type ServerEvent,
} from '../../netproto/index.ts'
import type { AudioRuntime113c } from '../audio/audio-runtime-113c.ts'
import { getCanonicalItemDataTables } from '../world/item-tables-provider.ts'
import type { OnlineSessionPhase } from './online-session.ts'

export interface ReplayedD2CapFrame {
  readonly seq: number
  readonly timestampMs: number
  readonly conn: PacketConn
  readonly dir: PacketDirection
  readonly opcode: number
  readonly raw: Uint8Array
  readonly record: D2CapRecord
}

export interface SessionReplayHost {
  readonly replayS2cFramer: D2gsS2cFramer
  replayQueue: D2CapRecord[]
  replayCursor: number
  replaySeq: number
  disconnectReasonValue: string | null
  readonly audioRuntime: AudioRuntime113c
  readonly packetTap: InMemoryPacketTap
  readonly itemTables: ItemDataTables
  setPhase(next: OnlineSessionPhase): void
  handleServerEvent(rawEv: ServerEvent): void
  stepD2CapReplay(): ReplayedD2CapFrame | null
  extractEventsFromReplayRecord(
    conn: ReplayedD2CapFrame['conn'],
    dir: ReplayedD2CapFrame['dir'],
    rawBytes: Uint8Array,
    record: ReplayedD2CapFrame['record'],
  ): readonly ServerEvent[]
}

/**
 * Decode a framed D2GS S->C packet (`conn === 'game'`, `dir === 's2c'`) from a `.d2cap`
 * capture into a protocol-neutral `ServerEvent` using the full 167-opcode 1.13c registry
 * (`D2GS_S2C_REGISTRY`) and canonical 1.13c item data tables (`ItemStatCost.txt`, `Armor.txt`,
 * `Weapons.txt`, `Misc.txt`).
 */
export function decodeCapturedGameS2cPacket(
  pkt: Uint8Array,
  itemTables: ItemDataTables = getCanonicalItemDataTables(),
): ServerEvent {
  if (pkt.byteLength === 0) {
    return { type: 'Opaque', proto: 'd2gs', id: 0, raw: pkt }
  }
  return decodeD2gsS2cPacket(pkt, {
    tables: itemTables,
    encoding: 'gbk',
  })
}

/**
 * Load a `.d2cap` JSONL capture into the session replay queue and transition to `'replay'` phase.
 */
export function loadSessionD2CapReplay(host: SessionReplayHost, jsonlText: string): number {
  host.replayS2cFramer.reset(false)
  const parsed = parseD2CapJsonl(jsonlText)
  host.replayQueue = [...parsed.records]
  host.replayCursor = 0
  host.disconnectReasonValue = null
  host.audioRuntime.gameInit()
  host.setPhase('replay')
  return host.replayQueue.length
}

/**
 * Step 1 packet from the loaded `.d2cap` capture, decoding `game` `s2c` packets into `ServerEvent`s.
 */
export function stepSessionD2CapReplay(host: SessionReplayHost): ReplayedD2CapFrame | null {
  if (host.replayCursor >= host.replayQueue.length) {
    return null
  }
  const record = host.replayQueue[host.replayCursor]!
  host.replayCursor += 1
  const rawBytes = hexToBytes(record.hex)
  const opcode =
    record.packetId ??
    (record.conn === 'bnet' && rawBytes.length >= 2 && rawBytes[0] === 0xff
      ? rawBytes[1]!
      : record.conn === 'realm' && rawBytes.length >= 3
        ? rawBytes[2]!
        : rawBytes[0] ?? 0)
  const frame: ReplayedD2CapFrame = {
    seq: ++host.replaySeq,
    timestampMs: record.t,
    conn: record.conn,
    dir: record.dir,
    opcode,
    raw: rawBytes,
    record,
  }
  host.packetTap.record({
    t: record.t,
    conn: record.conn,
    dir: record.dir,
    packetId: opcode,
    raw: rawBytes,
  })
  const events = host.extractEventsFromReplayRecord(record.conn, record.dir, rawBytes, record)
  for (const ev of events) {
    host.handleServerEvent(ev)
  }
  return frame
}

/**
 * Replay all remaining records in the loaded `.d2cap` capture synchronously.
 */
export function replayAllSessionD2Cap(host: SessionReplayHost): number {
  host.setPhase('replay')
  let count = 0
  while (host.stepD2CapReplay() !== null) {
    count += 1
  }
  return count
}

export function extractSessionEventsFromReplayRecord(
  host: SessionReplayHost,
  conn: ReplayedD2CapFrame['conn'],
  dir: ReplayedD2CapFrame['dir'],
  rawBytes: Uint8Array,
  record: ReplayedD2CapFrame['record'],
): readonly ServerEvent[] {
  if (conn !== 'game' || dir !== 's2c') {
    return []
  }
  if (record.stream) {
    const framedPackets = host.replayS2cFramer.push(rawBytes)
    const events: ServerEvent[] = []
    for (const pkt of framedPackets) {
      events.push(decodeCapturedGameS2cPacket(pkt.bytes, host.itemTables))
    }
    return events
  }
  return [decodeCapturedGameS2cPacket(rawBytes, host.itemTables)]
}

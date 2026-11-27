import type { ServerEvent } from '../../domain/server-event.ts'

/**
 * Exact-length guard for fixed-size D2GS S→C packets (1.13c D2Client packet-size table).
 *
 * The original unit handlers read fixed offsets without any length check, so a short or long packet
 * is a framing/protocol error and must fail fast instead of decoding garbage.
 */
/**
 * Event for a packet whose D2Client unit lookup cannot succeed (raw unit type outside `0..5`, see
 * `wireUnitTypeId`): the 1.13c handler returns without touching any state, so the packet carries no domain
 * effect and is surfaced as `Opaque` (#1656).
 */
export function unitLookupMiss(pkt: Uint8Array): ServerEvent {
  return { type: 'Opaque', proto: 'd2gs', id: pkt[0] ?? 0, raw: pkt }
}

export function requirePacketLength(pkt: Uint8Array, name: string, size: number): void {
  if (pkt.byteLength !== size) {
    throw new RangeError(`${name}: expected ${String(size)} bytes, got ${String(pkt.byteLength)}`)
  }
}

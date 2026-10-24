/**
 * Exact-length guard for fixed-size D2GS S→C packets (1.13c D2Client packet-size table).
 *
 * The original unit handlers read fixed offsets without any length check, so a short or long packet
 * is a framing/protocol error and must fail fast instead of decoding garbage.
 */
export function requirePacketLength(pkt: Uint8Array, name: string, size: number): void {
  if (pkt.byteLength !== size) {
    throw new RangeError(`${name}: expected ${String(size)} bytes, got ${String(pkt.byteLength)}`)
  }
}

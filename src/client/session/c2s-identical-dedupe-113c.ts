/**
 * 1.13c identical-packet dedupe of the client's single C->S send function.
 *
 * Ground truth: `1.13c D2Client 0x6fac43e0 SendPacket(ebx=size, [esp+4]=buf)`, dedupe block
 * 0x6fac4415..0x6fac4462 (static disassembly, /tmp/d2client-hold-re/REPORT.md §1.1):
 *
 * ```
 * now = GetTickCount()                                   ; 0x6fac4415
 * idx = buf[0] - 5; if (idx <= 0x35) jmp table[idx]      ; 0x6fac441e..0x6fac4434 (op 0x05..0x3A)
 *   op 0x05..0x0A, 0x0C..0x11 -> 0x6fac443b: window = 0x32 (50 ms)
 *   op 0x3A                   -> 0x6fac4462: never deduped
 *   everything else           -> 0x6fac4446: window = 0xC8 (200 ms)  (incl. 0x0B, 0x12..0x39 and
 *                                                                     every op outside 0x05..0x3A,
 *                                                                     e.g. walk/run 0x01..0x04)
 * if ((u32)(now - lastTick[0x6fbd34c8]) < window          ; `jae 0x6fac4462` = unsigned compare
 *     && memcmp(buf, lastBuf[0x6fbd34d0], size) == 0)     ; 0x6fac4453..0x6fac4460 `repz cmpsb`
 *   return                                               ; drop (0x6fac44c3)
 * memcpy(lastBuf, buf, size); lastTick = now             ; 0x6fac4462..0x6fac447d — one shared slot,
 *                                                        ; updated on EVERY non-dropped send
 * D2Net#10024(size, 1, buf)                              ; 0x6fac44a1
 * ```
 *
 * The slot is shared by all opcodes, so any different packet sent in between "breaks" the dedupe of
 * the previous one.
 */

import { encodeD2gsClientCommand, type ClientCommand } from '../../netproto/index.ts'

/** 1.13c D2Client 0x6fac443b `cmp eax,0x32`: window for skill opcodes 0x05..0x0A, 0x0C..0x11. */
export const C2S_IDENTICAL_DEDUPE_SKILL_WINDOW_MS_113C = 0x32
/** 1.13c D2Client 0x6fac4446 `cmp eax,0xc8`: window for every other opcode except 0x3A. */
export const C2S_IDENTICAL_DEDUPE_DEFAULT_WINDOW_MS_113C = 0xc8
/** Size of the static last-sent buffer 0x6fbd34d0 (SendPacket asserts size < 0x200 @0x6fac43ec). */
const LAST_SENT_BUFFER_SIZE_113C = 0x200

/**
 * Dedupe window (ms) for a C->S opcode per the 0x6fac44cc/0x6fac44d8 jump table, or `null` when the
 * opcode is never deduped (0x3A AddStatPoint, 0x6fac4462).
 */
export function c2sIdenticalDedupeWindowMs113c(opcode: number): number | null {
  if (!Number.isInteger(opcode) || opcode < 0 || opcode > 0xff) {
    throw new RangeError(`c2sIdenticalDedupeWindowMs113c: invalid opcode ${String(opcode)}`)
  }
  if (opcode === 0x3a) return null
  if ((opcode >= 0x05 && opcode <= 0x0a) || (opcode >= 0x0c && opcode <= 0x11)) {
    return C2S_IDENTICAL_DEDUPE_SKILL_WINDOW_MS_113C
  }
  return C2S_IDENTICAL_DEDUPE_DEFAULT_WINDOW_MS_113C
}

/**
 * Stateful replica of the SendPacket dedupe slot (last-sent tick 0x6fbd34c8 + buffer 0x6fbd34d0).
 * Pure apart from its own slot; owns no I/O.
 */
export class C2sIdenticalPacketDedupe113c {
  private lastBuf = new Uint8Array(LAST_SENT_BUFFER_SIZE_113C)
  private lastTickMs: number | null = null

  droppedCount = 0

  /**
   * Returns `true` when 1.13c would transmit `packet` at `nowMs` (and records it in the shared slot),
   * `false` when 1.13c drops it as an identical repeat inside the opcode's window.
   */
  admitPacket(packet: Uint8Array, nowMs: number): boolean {
    if (packet.length < 1) {
      throw new RangeError('C2sIdenticalPacketDedupe113c: empty C->S packet')
    }
    if (!Number.isFinite(nowMs)) {
      throw new RangeError(`C2sIdenticalPacketDedupe113c: invalid clock ${String(nowMs)}`)
    }
    const windowMs = c2sIdenticalDedupeWindowMs113c(packet[0]!)
    if (windowMs !== null && this.lastTickMs !== null) {
      const elapsed = nowMs - this.lastTickMs
      // `jae` on (u32)(now - last): a clock that went backwards wraps to a huge value -> send.
      if (elapsed >= 0 && elapsed < windowMs && this.matchesLast(packet)) {
        this.droppedCount += 1
        return false
      }
    }
    this.record(packet, nowMs)
    return true
  }

  /**
   * Command-level admission for the port's single C->S choke point. The command is encoded exactly
   * like the D2GS adapter does (`encodeD2gsClientCommand`) so identity is byte identity; it is
   * admitted when at least one of its packets is admitted (every current command encodes to one
   * packet). Commands that are not D2GS packets (`Ping` is sent by the adapter's own path) or that
   * fail to encode are admitted unchanged so the adapter reports the error as before.
   */
  admitCommand(cmd: ClientCommand, nowMs: number): boolean {
    if (cmd.type === 'Ping') return true
    let packets: readonly Uint8Array[]
    try {
      packets = encodeD2gsClientCommand(cmd)
    } catch {
      return true
    }
    if (packets.length === 0) return true
    let admitted = false
    for (const pkt of packets) {
      if (this.admitPacket(pkt, nowMs)) admitted = true
    }
    return admitted
  }

  reset(): void {
    this.lastBuf = new Uint8Array(LAST_SENT_BUFFER_SIZE_113C)
    this.lastTickMs = null
    this.droppedCount = 0
  }

  /** `repz cmpsb` over `size` bytes of the new packet against the static buffer (0x6fac445e). */
  private matchesLast(packet: Uint8Array): boolean {
    if (packet.length > this.lastBuf.length) return false
    for (let i = 0; i < packet.length; i++) {
      if (packet[i] !== this.lastBuf[i]) return false
    }
    return true
  }

  /** `rep movs` into 0x6fbd34d0 + `mov [0x6fbd34c8], now` (0x6fac4462..0x6fac447d). */
  private record(packet: Uint8Array, nowMs: number): void {
    if (packet.length > this.lastBuf.length) {
      // 1.13c asserts size < 0x200 (0x6fac43ec); the port has no such hard cap, so the slot grows.
      const grown = new Uint8Array(packet.length)
      grown.set(this.lastBuf)
      this.lastBuf = grown
    }
    this.lastBuf.set(packet, 0)
    this.lastTickMs = nowMs
  }
}

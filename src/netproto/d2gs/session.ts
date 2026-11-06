/**
 * D2GS Session State Machine (1.13c):
 * 1. Waits for uncompressed S->C [0xAF, 0x01] CompressionInfo
 * 2. Sends 37-byte C->S 0x68 GameLogon
 * 3. Receives compressed S->C 0x01 GameFlags and 0x02 GameLogonSuccess
 * 4. Sends 1-byte C->S 0x6B EnterGame
 * 5. Starts 5000ms C->S 0x6D Ping loop and tracks 0x8F Pong RTT
 */

import { type Clock, defaultClock } from '../core/clock.ts'
import { Emitter } from '../core/emitter.ts'
import { ProtocolError } from '../core/errors.ts'
import {
  bytesToHex,
  formatRecentS2cPacketSummaries,
  type PacketTap,
  type RecentS2cPacketSummary,
} from '../core/packet-tap.ts'
import type { ByteStream, CloseReason } from '../transport/byte-stream.ts'
import {
  type D2gsGameLogonParams,
  encodeC2sEnterGame,
  encodeC2sGameLogon,
  encodeC2sLeaveGame,
  encodeC2sPing,
} from './c2s/session.ts'
import { type D2gsFramedS2cPacket, D2gsS2cFramer } from './framing-s2c.ts'

export const D2GS_S2C_RING_BUFFER_SIZE = 64

function formatD2gsCantEnterError(reason: number, charName: string): ProtocolError {
  const hex = `0x${(reason >>> 0).toString(16).padStart(2, '0')}`
  if (reason === 0x06) {
    return new ProtocolError(
      `该角色 "${charName}" 已经登录并处于游戏中，无法重复创建或加入房间 (Unable to enter game: character is already in a game, reason=${hex})`,
      { proto: 'd2gs', packetId: 0xb4 },
    )
  }
  if (reason === 0x13) {
    return new ProtocolError(
      `该房间人数已满，无法加入房间 (Game is full, reason=${hex})`,
      { proto: 'd2gs', packetId: 0xb4 },
    )
  }
  return new ProtocolError(
    `无法进入房间，角色 "${charName}" 可能已在游戏中 (Unable to enter game, reason=${hex})`,
    { proto: 'd2gs', packetId: 0xb4 },
  )
}

/**
 * Fallback wait for the D2GS logout acknowledgement after C2S `0x69` LeaveGame (`leaveGracefully`).
 * Normally the server answers with S2C `0x06` GameLogoutSuccess (D2Client handler `0x6fb5caa0`) or
 * closes the connection itself well before this.
 */
export const D2GS_LEAVE_ACK_TIMEOUT_MS = 1500

export type D2gsSessionState =
  | 'connecting'
  | 'logonSent'
  | 'entering'
  | 'ingame'
  | 'closed'

export interface D2gsSessionOptions {
  readonly stream: ByteStream
  readonly logon: D2gsGameLogonParams
  readonly clock?: Clock | undefined
  readonly tap?: PacketTap | undefined
  readonly pingIntervalMs?: number | undefined
}

export class D2gsSession {
  private readonly stream: ByteStream
  private readonly logon: D2gsGameLogonParams
  private readonly clock: Clock
  private readonly tap: PacketTap | undefined
  private readonly pingIntervalMs: number
  private readonly framer = new D2gsS2cFramer()
  private readonly packetEmitter = new Emitter<Uint8Array>()
  private readonly stateEmitter = new Emitter<D2gsSessionState>()
  private readonly errorEmitter = new Emitter<Error>()
  private readonly closeEmitter = new Emitter<CloseReason>()

  private stateValue: D2gsSessionState = 'connecting'
  private stopPingTimer: (() => void) | undefined
  private lastPingSentMs = 0
  private rttMsValue = 0
  private lastRttMsValue = 0
  private avgPingMsValue = 0
  private pingSampleCountValue = 0
  private bytesInValue = 0
  private bytesOutValue = 0
  private packetsInValue = 0
  private packetsOutValue = 0
  private enterGameSent = false
  /** Set once C2S `0x69` LeaveGame was sent by `leaveGracefully`; blocks any further C2S traffic. */
  private leaving = false
  private leavePromise: Promise<void> | undefined
  private finishLeave: (() => void) | undefined
  private hasPacketListener = false
  private readonly earlyPackets: Uint8Array[] = []
  private readonly recentS2cRing: RecentS2cPacketSummary[] = []
  private protocolFailed = false

  constructor(options: D2gsSessionOptions) {
    this.stream = options.stream
    this.logon = options.logon
    this.clock = options.clock ?? defaultClock
    this.tap = options.tap
    this.pingIntervalMs = options.pingIntervalMs ?? 5000

    this.stream.onData((chunk) => {
      if (this.stateValue === 'closed') return
      this.bytesInValue += chunk.byteLength
      const packets: D2gsFramedS2cPacket[] = []
      let framingErr: unknown = undefined
      try {
        this.framer.push(chunk, packets)
      } catch (err) {
        framingErr = err
      }

      for (const pkt of packets) {
        if (this.protocolFailed || this.state === 'closed') break
        const now = this.clock.now()
        this.packetsInValue++
        this.pushRecentS2c(this.packetsInValue, now, pkt.packetId, pkt.bytes)
        this.tap?.record({
          t: now,
          conn: 'game',
          dir: 's2c',
          raw: pkt.bytes,
          packetId: pkt.packetId,
        })
        this.handleIncomingPacket(pkt.bytes)
      }

      if (framingErr !== undefined) {
        const baseErr =
          framingErr instanceof Error ? framingErr : new Error(String(framingErr))
        const unreadHex = bytesToHex(this.framer.peekUnreadBytes(32))
        const protocolErr =
          baseErr instanceof ProtocolError
            ? baseErr
            : new ProtocolError(
                `D2GS S->C stream framing failed: ${baseErr.message}${unreadHex ? ` (unread=${unreadHex})` : ''}`,
                { proto: 'd2gs' },
              )
        this.failProtocol(protocolErr, unreadHex)
      }
    })

    this.stream.onClose((reason) => {
      this.stopPing()
      this.setState('closed')
      this.closeEmitter.emit(reason)
      if (reason.kind === 'error') {
        this.errorEmitter.emit(reason.error)
      }
    })
  }

  get state(): D2gsSessionState {
    return this.stateValue
  }

  get currentState(): D2gsSessionState {
    return this.stateValue
  }

  get rttMs(): number {
    return this.rttMsValue
  }

  get avgPingMs(): number {
    return this.avgPingMsValue
  }

  get lastRttMs(): number {
    return this.lastRttMsValue
  }

  get pingSampleCount(): number {
    return this.pingSampleCountValue
  }

  get stats(): {
    readonly rttMs: number
    readonly bytesIn: number
    readonly bytesOut: number
    readonly packetsIn: number
    readonly packetsOut: number
  } {
    return {
      rttMs: this.rttMsValue,
      bytesIn: this.bytesInValue,
      bytesOut: this.bytesOutValue,
      packetsIn: this.packetsInValue,
      packetsOut: this.packetsOutValue,
    }
  }

  onPacket(cb: (pkt: Uint8Array) => void): () => void {
    const unsub = this.packetEmitter.on(cb)
    if (!this.hasPacketListener) {
      this.hasPacketListener = true
      if (this.earlyPackets.length > 0) {
        const queued = this.earlyPackets.splice(0, this.earlyPackets.length)
        for (const pkt of queued) {
          this.packetEmitter.emit(pkt)
        }
      }
    }
    return unsub
  }

  onState(cb: (state: D2gsSessionState) => void): () => void {
    return this.stateEmitter.on(cb)
  }

  onError(cb: (err: Error) => void): () => void {
    return this.errorEmitter.on(cb)
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    return this.closeEmitter.on(cb)
  }

  getRecentS2cPackets(limit = D2GS_S2C_RING_BUFFER_SIZE): readonly RecentS2cPacketSummary[] {
    if (limit <= 0) return []
    return this.recentS2cRing.slice(-limit)
  }

  formatRecentS2cPackets(limit = D2GS_S2C_RING_BUFFER_SIZE): string {
    return formatRecentS2cPacketSummaries(this.getRecentS2cPackets(limit))
  }

  /**
   * Fails the D2GS session closed when the S->C byte stream is desynchronized or carries an
   * unrecoverable corrupt bootstrap/act packet (`0x01`, `0x03`), dumping the 64-packet S->C ring buffer.
   */
  failProtocol(error: Error, unreadHex?: string): void {
    if (this.protocolFailed) return
    this.protocolFailed = true
    const unreadPart = unreadHex ? `; unread=[${unreadHex}]` : ''
    console.error(
      `[d2gs] Fatal S2C protocol/framing error: ${error.message}${unreadPart}; recentS2C(${this.recentS2cRing.length})=[${this.formatRecentS2cPackets()}]`,
    )
    this.stopPing()
    const reason: CloseReason = { kind: 'error', error }
    try {
      this.stream.close(reason)
    } catch {
      // Ignore stream close errors on already-closed transport.
    }
    if ((this.stateValue as D2gsSessionState) !== 'closed') {
      this.setState('closed')
      this.closeEmitter.emit(reason)
      this.errorEmitter.emit(error)
    }
  }

  private pushRecentS2c(seq: number, t: number, packetId: number, raw: Uint8Array): void {
    const maxHexBytes = 48
    const head = raw.byteLength > maxHexBytes ? raw.subarray(0, maxHexBytes) : raw
    const hex = bytesToHex(head) + (raw.byteLength > maxHexBytes ? '…' : '')
    if (this.recentS2cRing.length >= D2GS_S2C_RING_BUFFER_SIZE) {
      this.recentS2cRing.shift()
    }
    this.recentS2cRing.push({
      seq,
      t,
      packetId,
      len: raw.byteLength,
      hex,
    })
  }

  sendRawPacket(pkt: Uint8Array): void {
    if (this.stateValue === 'closed' || this.leaving) return
    this.bytesOutValue += pkt.byteLength
    this.packetsOutValue++
    this.tap?.record({
      t: this.clock.now(),
      conn: 'game',
      dir: 'c2s',
      raw: pkt,
      packetId: pkt[0],
    })
    this.stream.write(pkt)
  }

  sendPing(): void {
    const now = Math.floor(this.clock.now())
    this.lastPingSentMs = now
    // Per D2Client.dll 0x6fac4bdb..0x6fac4bf0: @5 = [0x6fbc9830] >>> 1 (avgPing >>> 1).
    this.sendRawPacket(encodeC2sPing(now >>> 0, this.avgPingMsValue >>> 1))
  }

  leaveAndClose(): void {
    this.stopPing()
    if (this.stateValue !== 'closed') {
      try {
        this.sendRawPacket(encodeC2sLeaveGame())
      } catch {
        // Ignore write error on leave
      }
    }
    this.setState('closed')
    this.stream.close()
  }

  private emitPacket(pkt: Uint8Array): void {
    if (!this.hasPacketListener) {
      this.earlyPackets.push(pkt)
      return
    }
    this.packetEmitter.emit(pkt)
  }

  /**
   * Leave the game the way D2GS expects: send C2S `0x69` LeaveGame (D2Client `0x6faf2850` ->
   * `0x6fac4660`) and keep the stream open until D2GS acknowledges with S2C `0x06` GameLogoutSuccess
   * or closes the connection itself; only then is the stream closed. Closing the socket in the same
   * tick as the `0x69` write can abort the TCP connection before D2GS reads the packet, which turns a
   * clean exit into a drop and lets an immediate rejoin load a stale character save (rollback).
   *
   * `timeoutMs` (default `D2GS_LEAVE_ACK_TIMEOUT_MS` = 1.5 s) is the fallback when neither happens.
   * Outside the `ingame` state there is no game to save, so this degrades to `leaveAndClose`.
   */
  leaveGracefully(timeoutMs: number = D2GS_LEAVE_ACK_TIMEOUT_MS): Promise<void> {
    if (this.leavePromise) return this.leavePromise
    if (this.stateValue !== 'ingame') {
      this.leaveAndClose()
      return Promise.resolve()
    }
    this.stopPing()
    try {
      this.sendRawPacket(encodeC2sLeaveGame())
    } catch {
      // A failed write means the stream is gone; the close watcher below resolves the wait.
    }
    this.leaving = true
    this.leavePromise = new Promise<void>((resolve) => {
      let done = false
      let cancelTimer: (() => void) | undefined
      let unsubClose: (() => void) | undefined
      const finish = (): void => {
        if (done) return
        done = true
        cancelTimer?.()
        unsubClose?.()
        this.finishLeave = undefined
        if (this.stateValue !== 'closed') {
          this.setState('closed')
          this.stream.close()
        }
        resolve()
      }
      this.finishLeave = finish
      unsubClose = this.closeEmitter.on(finish)
      cancelTimer = this.clock.setTimeout(finish, Math.max(0, timeoutMs))
      if (this.stateValue === 'closed') finish()
    })
    return this.leavePromise
  }

  private handleIncomingPacket(pkt: Uint8Array): void {
    const op = pkt[0]!
    if (this.leaving) {
      // S2C 0x06 GameLogoutSuccess (1B, D2Client 0x6fb5caa0): D2GS processed our 0x69 LeaveGame.
      if (op === 0x06) {
        this.emitPacket(pkt)
        this.finishLeave?.()
      }
      return
    }
    if (op === 0xaf && this.stateValue === 'connecting') {
      // Server sent [0xAF, 0x01]; record incoming packet first, then reply with 37-byte 0x68 GameLogon
      this.setState('logonSent')
      this.emitPacket(pkt)
      this.sendRawPacket(encodeC2sGameLogon(this.logon))
      return
    }
    if (op === 0x02 && !this.enterGameSent) {
      // Server sent 0x02 GameLogonSuccess; record incoming packet first, then send 0x6B EnterGame + 5s Ping loop
      this.enterGameSent = true
      this.setState('entering')
      this.emitPacket(pkt)
      this.sendRawPacket(encodeC2sEnterGame())
      this.sendPing()
      this.startPing()
      return
    }
    if (op === 0x04 || (op === 0x03 && this.stateValue === 'entering')) {
      if (this.stateValue !== 'ingame') {
        this.setState('ingame')
      }
      this.emitPacket(pkt)
      return
    }
    if (op === 0xb4 && this.stateValue !== 'ingame' && this.stateValue !== 'closed') {
      // S2C 0xB4 CantEnterGame / TimeoutReason (5B, D2Client.dll 0x6fb5cbf0):
      // reason = 0x06 is D2GS_GAMELOGON_CHARLOCKED (character already in game).
      const reason =
        pkt.byteLength >= 5
          ? new DataView(pkt.buffer, pkt.byteOffset, pkt.byteLength).getUint32(1, true)
          : 0
      this.emitPacket(pkt)
      this.stopPing()
      this.errorEmitter.emit(formatD2gsCantEnterError(reason, this.logon.charName))
      this.setState('closed')
      this.stream.close()
      return
    }
    if (op === 0xb0 && this.stateValue !== 'ingame' && this.stateValue !== 'closed') {
      // S2C 0xB0 ConnectionTerminated (1B, D2Client.dll 0x6fb5d450) during handshake.
      this.emitPacket(pkt)
      this.stopPing()
      this.errorEmitter.emit(
        new ProtocolError(
          `该角色 "${this.logon.charName}" 已经登录或无法进入房间 (D2GS connection terminated during logon, 0xB0)`,
          { proto: 'd2gs', packetId: 0xb0 },
        ),
      )
      this.setState('closed')
      this.stream.close()
      return
    }
    if (op === 0x8f) {
      if (this.lastPingSentMs > 0) {
        const ping = Math.max(0, Math.floor(this.clock.now()) - this.lastPingSentMs) >>> 0
        this.lastRttMsValue = ping
        // Per D2Client.dll 0x6faf2338..0x6faf2367:
        // for the first 10 pong samples (0x6fbc982c < 10), update running average:
        // avg = Math.floor((avg * n + ping) / (n + 1)) -> 0x6fbc9830.
        if (this.pingSampleCountValue < 10) {
          const n = this.pingSampleCountValue
          this.avgPingMsValue = Math.floor((this.avgPingMsValue * n + ping) / (n + 1)) >>> 0
          this.pingSampleCountValue = n + 1
        }
        this.rttMsValue = this.avgPingMsValue
      }
    }
    this.emitPacket(pkt)
  }

  private startPing(): void {
    this.stopPing()
    this.stopPingTimer = this.clock.setInterval(() => {
      if (this.stateValue !== 'closed') {
        this.sendPing()
      }
    }, this.pingIntervalMs)
  }

  private stopPing(): void {
    if (this.stopPingTimer) {
      this.stopPingTimer()
      this.stopPingTimer = undefined
    }
  }

  private setState(next: D2gsSessionState): void {
    if (this.stateValue !== next) {
      this.stateValue = next
      this.stateEmitter.emit(next)
    }
  }
}

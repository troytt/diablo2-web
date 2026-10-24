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
import type { PacketTap } from '../core/packet-tap.ts'
import type { ByteStream, CloseReason } from '../transport/byte-stream.ts'
import {
  type D2gsGameLogonParams,
  encodeC2sEnterGame,
  encodeC2sGameLogon,
  encodeC2sLeaveGame,
  encodeC2sPing,
} from './c2s/session.ts'
import { D2gsS2cFramer } from './framing-s2c.ts'

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
  private bytesInValue = 0
  private bytesOutValue = 0
  private packetsInValue = 0
  private packetsOutValue = 0
  private enterGameSent = false

  constructor(options: D2gsSessionOptions) {
    this.stream = options.stream
    this.logon = options.logon
    this.clock = options.clock ?? defaultClock
    this.tap = options.tap
    this.pingIntervalMs = options.pingIntervalMs ?? 5000

    this.stream.onData((chunk) => {
      this.bytesInValue += chunk.byteLength
      try {
        const packets = this.framer.push(chunk)
        for (const pkt of packets) {
          this.packetsInValue++
          this.tap?.record({
            t: this.clock.now(),
            conn: 'game',
            dir: 's2c',
            raw: pkt.bytes,
            packetId: pkt.packetId,
          })
          this.handleIncomingPacket(pkt.bytes)
        }
      } catch (err) {
        this.errorEmitter.emit(err instanceof Error ? err : new Error(String(err)))
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

  get rttMs(): number {
    return this.rttMsValue
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
    return this.packetEmitter.on(cb)
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

  sendRawPacket(pkt: Uint8Array): void {
    if (this.stateValue === 'closed') return
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
    this.sendRawPacket(encodeC2sPing(now >>> 0, 0))
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

  private handleIncomingPacket(pkt: Uint8Array): void {
    const op = pkt[0]!
    if (op === 0xaf && this.stateValue === 'connecting') {
      // Server sent [0xAF, 0x01]; reply with 37-byte 0x68 GameLogon
      this.setState('logonSent')
      this.sendRawPacket(encodeC2sGameLogon(this.logon))
    } else if (op === 0x02 && !this.enterGameSent) {
      // Server sent 0x02 GameLogonSuccess; send 0x6B EnterGame and start 5s Ping loop
      this.enterGameSent = true
      this.setState('entering')
      this.sendRawPacket(encodeC2sEnterGame())
      this.sendPing()
      this.startPing()
    } else if (op === 0x04 || (op === 0x03 && this.stateValue === 'entering')) {
      if (this.stateValue !== 'ingame') {
        this.setState('ingame')
      }
    } else if (op === 0xb4 && this.stateValue !== 'ingame' && this.stateValue !== 'closed') {
      // S2C 0xB4 CantEnterGame / TimeoutReason (5B, D2Client.dll 0x6fb5cbf0):
      // reason = 0x06 is D2GS_GAMELOGON_CHARLOCKED (character already in game).
      const reason =
        pkt.byteLength >= 5
          ? new DataView(pkt.buffer, pkt.byteOffset, pkt.byteLength).getUint32(1, true)
          : 0
      this.packetEmitter.emit(pkt)
      this.stopPing()
      this.errorEmitter.emit(formatD2gsCantEnterError(reason, this.logon.charName))
      this.setState('closed')
      this.stream.close()
      return
    } else if (op === 0xb0 && this.stateValue !== 'ingame' && this.stateValue !== 'closed') {
      // S2C 0xB0 ConnectionTerminated (1B, D2Client.dll 0x6fb5d450) during handshake.
      this.packetEmitter.emit(pkt)
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
    } else if (op === 0x8f) {
      if (this.lastPingSentMs > 0) {
        this.rttMsValue = Math.max(0, Math.floor(this.clock.now()) - this.lastPingSentMs)
      }
    }
    this.packetEmitter.emit(pkt)
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

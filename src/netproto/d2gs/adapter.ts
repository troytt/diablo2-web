/**
 * `D2gsAdapter` implementing protocol-neutral `GameServerAdapter` over `D2gsSession`.
 */

import { type Clock, defaultClock } from '../core/clock.ts'
import { Emitter } from '../core/emitter.ts'
import type { TextEncoding } from '../core/text-codec.ts'
import type { ClientCommand } from '../domain/client-command.ts'
import type { GameServerAdapter, GameServerStats } from '../domain/game-server-adapter.ts'
import type { CharClassId, ItemDataTables } from '../domain/ids.ts'
import type { ServerEvent } from '../domain/server-event.ts'
import type { ByteStream, CloseReason } from '../transport/byte-stream.ts'
import { decodeD2gsS2cPacket, encodeD2gsClientCommand } from './registry.ts'
import { D2gsSession } from './session.ts'

export interface D2gsAdapterOptions {
  readonly session: D2gsSession
  readonly tables: ItemDataTables
  readonly encoding?: TextEncoding | undefined
  readonly clock?: Clock | undefined
}

export interface D2gsStreamAdapterOptions {
  readonly charName?: string | undefined
  readonly classId?: CharClassId | number | string | undefined
  readonly charClass?: CharClassId | number | undefined
  readonly gameHash?: number | undefined
  readonly gameToken?: number | undefined
  readonly tables?: ItemDataTables | undefined
  readonly encoding?: TextEncoding | undefined
  readonly clock?: Clock | undefined
}

const DEFAULT_ADAPTER_TABLES: ItemDataTables = {
  itemStatCost: new Map(),
  armor: new Map(),
  weapons: new Map(),
  misc: new Map(),
  getStatMeta: () => undefined,
  getStatCost: () => undefined,
  getItemBaseMeta: () => undefined,
  getItemMeta: () => undefined,
}

function isByteStream(arg: D2gsAdapterOptions | ByteStream): arg is ByteStream {
  return typeof (arg as ByteStream).onData === 'function' && typeof (arg as ByteStream).write === 'function'
}

/** Reports a failed S2C packet loudly: stage, opcode, raw hex and the error stack. */
function reportPacketError(stage: string, pkt: Uint8Array, err: unknown): void {
  const opcode = pkt.byteLength > 0 ? `0x${pkt[0]!.toString(16).padStart(2, '0')}` : '(empty)'
  const hex = Array.from(pkt, (b) => b.toString(16).padStart(2, '0')).join(' ')
  const detail = err instanceof Error ? (err.stack ?? `${err.name}: ${err.message}`) : String(err)
  console.error(`[d2gs] S2C ${opcode} ${stage} failed; packet=[${hex}]\n${detail}`)
}

export class D2gsAdapter implements GameServerAdapter {
  private readonly session: D2gsSession
  private readonly tables: ItemDataTables
  private readonly encoding: TextEncoding
  private readonly clock: Clock
  private readonly eventEmitter = new Emitter<ServerEvent>()
  private readonly earlyEvents: Array<{ readonly ev: ServerEvent; readonly pkt: Uint8Array }> = []
  private hasAttachedListener = false

  private unknownPacketsCount = 0
  private opaquePacketsCount = 0
  private protocolErrorsCount = 0
  private listenerErrorsCount = 0

  constructor(
    optionsOrStream: D2gsAdapterOptions | ByteStream,
    streamOptions?: D2gsStreamAdapterOptions,
  ) {
    if (isByteStream(optionsOrStream)) {
      this.encoding = streamOptions?.encoding ?? 'gbk'
      this.clock = streamOptions?.clock ?? defaultClock
      this.tables = streamOptions?.tables ?? DEFAULT_ADAPTER_TABLES
      const rawClass = streamOptions?.classId ?? streamOptions?.charClass ?? 0
      const charClass = (typeof rawClass === 'number' ? (rawClass & 0x07) : 0) as CharClassId
      this.session = new D2gsSession({
        stream: optionsOrStream,
        logon: {
          gameHash: streamOptions?.gameHash ?? 0,
          gameToken: streamOptions?.gameToken ?? 1,
          charClass,
          versionByte: 0x0d,
          charName: streamOptions?.charName ?? 'Hero',
        },
        clock: this.clock,
        pingIntervalMs: 60_000,
      })
      this.session.sendRawPacket(new Uint8Array([0x6b]))
    } else {
      this.session = optionsOrStream.session
      this.tables = optionsOrStream.tables
      this.encoding = optionsOrStream.encoding ?? 'gbk'
      this.clock = optionsOrStream.clock ?? defaultClock
    }

    this.session.onPacket((pkt) =>
      this.handlePacket(pkt),
    )
  }

  /**
   * Decode one S2C packet and dispatch it. Decode failures are protocol errors; an exception thrown by a
   * listener (OnlineSession / ClientWorld applying the event) is a client bug. Neither may be swallowed
   * silently (AGENTS.md anti-silent-failure): both are counted and reported via `console.error` with the
   * packet id, the raw bytes and the stack, and the session loop keeps running so the remaining packets of
   * the chunk are still applied (Refs #916: a swallowed exception while applying a death packet left the
   * monster standing and targetable with no trace).
   */
  private handlePacket(pkt: Uint8Array): void {
    let ev: ServerEvent
    try {
      ev = decodeD2gsS2cPacket(pkt, {
        tables: this.tables,
        encoding: this.encoding,
        rttMs: this.session.rttMs,
      })
    } catch (err) {
      this.protocolErrorsCount++
      reportPacketError('decode', pkt, err)
      return
    }
    if (ev.type === 'Opaque') {
      this.opaquePacketsCount++
    }
    if (!this.hasAttachedListener) {
      this.earlyEvents.push({ ev, pkt })
      return
    }
    this.emitEvent(ev, pkt)
  }

  private emitEvent(ev: ServerEvent, pkt: Uint8Array): void {
    try {
      this.eventEmitter.emit(ev)
    } catch (err) {
      this.protocolErrorsCount++
      this.listenerErrorsCount++
      reportPacketError(`listener (${ev.type})`, pkt, err)
    }
  }

  /** Number of S2C events whose listener threw (each one was reported via `console.error`). */
  get listenerErrors(): number {
    return this.listenerErrorsCount
  }

  get state(): 'loading' | 'ingame' | 'closed' {
    const s = this.session.state
    if (s === 'closed') return 'closed'
    if (s === 'ingame') return 'ingame'
    return 'loading'
  }

  onEvent(cb: (ev: ServerEvent) => void): () => void {
    const unsub = this.eventEmitter.on(cb)
    if (!this.hasAttachedListener) {
      this.hasAttachedListener = true
      if (this.earlyEvents.length > 0) {
        const buffered = this.earlyEvents.splice(0, this.earlyEvents.length)
        for (const { ev, pkt } of buffered) {
          this.emitEvent(ev, pkt)
        }
      }
    }
    return unsub
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    return this.session.onClose(cb)
  }

  send(cmd: ClientCommand): void {
    if (cmd.type === 'Ping') {
      this.session.sendPing()
      return
    }
    const packets = encodeD2gsClientCommand(
      cmd,
      this.encoding,
      Math.floor(this.clock.now()) >>> 0,
    )
    for (const pkt of packets) {
      this.session.sendRawPacket(pkt)
    }
  }

  get stats(): GameServerStats {
    const s = this.session.stats
    return {
      rttMs: s.rttMs,
      bytesIn: s.bytesIn,
      bytesOut: s.bytesOut,
      packetsIn: s.packetsIn,
      packetsOut: s.packetsOut,
      unknownPackets: this.unknownPacketsCount,
      opaquePackets: this.opaquePacketsCount,
      protocolErrors: this.protocolErrorsCount,
    }
  }

  leave(): void {
    this.session.leaveAndClose()
  }

  async close(): Promise<void> {
    this.session.leaveAndClose()
  }
}

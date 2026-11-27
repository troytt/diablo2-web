/**
 * `TsServerAdapter` implementing `GameServerAdapter` over length-prefixed JSON `ByteStream`.
 */

import { Emitter } from '../core/emitter.ts'
import type { ClientCommand } from '../domain/client-command.ts'
import type { GameServerAdapter, GameServerStats } from '../domain/game-server-adapter.ts'
import type { ServerEvent } from '../domain/server-event.ts'
import type { ByteStream, CloseReason } from '../transport/byte-stream.ts'
import { encodeTsFrame, TsFramer } from './framing.ts'

export class TsServerAdapter implements GameServerAdapter {
  readonly kind = 'ts' as const
  private readonly stream: ByteStream
  private readonly framer = new TsFramer()
  private readonly eventEmitter = new Emitter<ServerEvent>()
  private readonly closeEmitter = new Emitter<CloseReason>()
  private stateValue: 'loading' | 'ingame' | 'closed' = 'ingame'

  private bytesIn = 0
  private bytesOut = 0
  private packetsIn = 0
  private packetsOut = 0

  constructor(stream: ByteStream) {
    this.stream = stream
    this.stream.onData((chunk) => {
      this.bytesIn += chunk.byteLength
      const events = this.framer.push(chunk) as ServerEvent[]
      for (const ev of events) {
        this.packetsIn++
        this.eventEmitter.emit(ev)
      }
    })
    this.stream.onClose((reason) => {
      this.stateValue = 'closed'
      this.closeEmitter.emit(reason)
    })
  }

  get state(): 'loading' | 'ingame' | 'closed' {
    return this.stateValue
  }

  onEvent(cb: (ev: ServerEvent) => void): () => void {
    return this.eventEmitter.on(cb)
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    return this.closeEmitter.on(cb)
  }

  send(cmd: ClientCommand): void {
    if (this.stateValue === 'closed' || (this.stream as { readonly isClosed?: boolean }).isClosed) {
      return
    }
    const frame = encodeTsFrame(cmd)
    this.bytesOut += frame.byteLength
    this.packetsOut++
    this.stream.write(frame)
  }

  get stats(): GameServerStats {
    return {
      rttMs: 0,
      bytesIn: this.bytesIn,
      bytesOut: this.bytesOut,
      packetsIn: this.packetsIn,
      packetsOut: this.packetsOut,
      packetsReceived: this.packetsIn,
      packetsSent: this.packetsOut,
      unknownPackets: 0,
      opaquePackets: 0,
      protocolErrors: 0,
    }
  }

  getStats(): GameServerStats {
    return this.stats
  }

  leave(): void {
    this.stateValue = 'closed'
    this.stream.close()
  }

  async close(): Promise<void> {
    this.leave()
  }
}

export { TsServerAdapter as TsClientAdapter }


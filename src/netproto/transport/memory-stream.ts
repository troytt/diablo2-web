/**
 * In-memory paired ByteStream implementation for unit testing and offline replay.
 */

import { ClosedError } from '../core/errors.ts'
import { TypedEmitter } from '../core/emitter.ts'
import type { ByteStream, CloseReason } from './byte-stream.ts'

export class MemoryStream implements ByteStream {
  readonly label: string
  private peer: MemoryStream | null = null
  private closed = false
  private readonly dataEmitter = new TypedEmitter<Uint8Array>()
  private readonly closeEmitter = new TypedEmitter<CloseReason>()
  private readonly pendingQueue: Uint8Array[] = []

  constructor(label: string) {
    this.label = label
  }

  static createPair(label = 'mem', serverLabel?: string): [MemoryStream, MemoryStream] {
    const a = new MemoryStream(serverLabel !== undefined ? label : `${label}:client`)
    const b = new MemoryStream(serverLabel ?? `${label}:server`)
    a.peer = b
    b.peer = a
    return [a, b]
  }

  get isClosed(): boolean {
    return this.closed
  }

  write(bytes: Uint8Array): void {
    if (this.closed) {
      throw new ClosedError(this.label, 'Cannot write to closed MemoryStream')
    }
    const copy = bytes.slice()
    const target = this.peer
    if (target && !target.closed) {
      target.receive(copy)
    }
  }

  send(bytes: Uint8Array): void {
    if (this.closed) return
    this.write(bytes)
  }

  receive(chunk: Uint8Array): void {
    if (this.closed) return
    if (this.dataEmitter.size === 0) {
      this.pendingQueue.push(chunk)
      return
    }
    this.dataEmitter.emit(chunk)
  }

  close(codeOrReason?: number | string | CloseReason): void {
    if (this.closed) return
    this.closed = true
    const isObj = typeof codeOrReason === 'object' && codeOrReason !== null
    const localReason: CloseReason = isObj
      ? codeOrReason
      : typeof codeOrReason === 'number'
        ? { kind: 'local', code: codeOrReason }
        : typeof codeOrReason === 'string'
          ? { kind: 'local', reason: codeOrReason }
          : { kind: 'local' }
    this.closeEmitter.emit(localReason)
    this.dataEmitter.clear()
    this.closeEmitter.clear()

    const peer = this.peer
    if (peer && !peer.closed) {
      peer.closed = true
      const remoteReason: CloseReason = isObj
        ? codeOrReason.kind === 'error'
          ? codeOrReason
          : {
              kind: 'local',
              ...(codeOrReason.code !== undefined ? { code: codeOrReason.code } : {}),
              ...(codeOrReason.reason !== undefined ? { reason: codeOrReason.reason } : {}),
            }
        : typeof codeOrReason === 'number'
          ? { kind: 'local', code: codeOrReason }
          : typeof codeOrReason === 'string'
            ? { kind: 'local', reason: codeOrReason }
            : { kind: 'local' }
      peer.closeEmitter.emit(remoteReason)
      peer.dataEmitter.clear()
      peer.closeEmitter.clear()
    }
  }

  fail(error: Error): void {
    this.close({ kind: 'error', error })
  }

  onData(cb: (chunk: Uint8Array) => void): () => void {
    const unsub = this.dataEmitter.on(cb)
    if (this.pendingQueue.length > 0) {
      const queued = this.pendingQueue.splice(0, this.pendingQueue.length)
      for (const chunk of queued) {
        if (!this.closed) cb(chunk)
      }
    }
    return unsub
  }

  onMessage(cb: (chunk: Uint8Array) => void): () => void {
    return this.onData(cb)
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    return this.closeEmitter.on(cb)
  }
}

export function createMemoryStreamPair(label = 'mem', serverLabel?: string): [MemoryStream, MemoryStream] {
  return MemoryStream.createPair(label, serverLabel)
}

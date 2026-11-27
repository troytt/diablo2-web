/**
 * Node.js TCP socket ByteStream implementation (`node:net`).
 * Used exclusively by Node CLI scripts (`scripts/d2-bot.ts`) and integration tests.
 */

import * as net from 'node:net'
import {
  ClosedError,
  TimeoutError,
  TypedEmitter,
  type ByteStream,
  type CloseReason,
} from '../../src/netproto/index.ts'

export interface ConnectNodeTcpOptions {
  readonly timeoutMs?: number | undefined
}

export class NodeTcpStream implements ByteStream {
  readonly label: string
  private readonly socket: net.Socket
  private closed = false
  private readonly dataEmitter = new TypedEmitter<Uint8Array>()
  private readonly closeEmitter = new TypedEmitter<CloseReason>()
  private readonly pendingQueue: Uint8Array[] = []

  constructor(socket: net.Socket, label: string) {
    this.socket = socket
    this.label = label
    this.socket.setNoDelay(true)

    this.socket.on('data', (chunk: Buffer) => {
      if (this.closed) return
      const bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength).slice()
      if (this.dataEmitter.size === 0) {
        this.pendingQueue.push(bytes)
      } else {
        this.dataEmitter.emit(bytes)
      }
    })

    this.socket.on('error', (err: Error) => {
      if (this.closed) return
      this.closed = true
      this.closeEmitter.emit({ kind: 'error', error: err })
      this.dataEmitter.clear()
      this.closeEmitter.clear()
    })

    this.socket.on('close', () => {
      if (this.closed) return
      this.closed = true
      this.closeEmitter.emit({ kind: 'remote' })
      this.dataEmitter.clear()
      this.closeEmitter.clear()
    })
  }

  write(bytes: Uint8Array): void {
    if (this.closed) {
      throw new ClosedError(this.label, 'TCP socket is closed')
    }
    this.socket.write(bytes)
  }

  close(codeOrReason?: number | CloseReason): void {
    if (this.closed) return
    this.closed = true
    this.socket.destroy()
    const reason: CloseReason =
      typeof codeOrReason === 'object' && codeOrReason !== null
        ? codeOrReason
        : codeOrReason !== undefined
          ? { kind: 'local', code: codeOrReason }
          : { kind: 'local' }
    this.closeEmitter.emit(reason)
    this.dataEmitter.clear()
    this.closeEmitter.clear()
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

  onClose(cb: (reason: CloseReason) => void): () => void {
    return this.closeEmitter.on(cb)
  }
}

export function connectNodeTcpStream(
  host: string,
  port: number,
  label: string,
  options: ConnectNodeTcpOptions = {},
): Promise<NodeTcpStream> {
  const timeoutMs = options.timeoutMs ?? 10_000
  return new Promise<NodeTcpStream>((resolve, reject) => {
    let settled = false
    const socket = new net.Socket()
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(new TimeoutError(label, timeoutMs, `TCP connect to ${host}:${port}`))
    }, timeoutMs)

    socket.once('connect', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(new NodeTcpStream(socket, label))
    })

    socket.once('error', (err: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      reject(err)
    })

    socket.connect(port, host)
  })
}

export const openNodeTcpStream = connectNodeTcpStream


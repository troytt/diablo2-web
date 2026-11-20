/**
 * WebSocket-backed ByteStream implementation for browsers and Node 22+ WebSocket.
 */

import { ClosedError, TimeoutError } from '../core/errors.ts'
import { TypedEmitter } from '../core/emitter.ts'
import { systemClock, type Clock } from '../core/clock.ts'
import type { ByteStream, CloseReason } from './byte-stream.ts'

export interface WebSocketLike {
  binaryType: string
  readonly readyState: number
  readonly bufferedAmount?: number
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { readonly data: unknown }) => void) | null
  onerror: ((ev: unknown) => void) | null
  onclose: ((ev: { readonly code?: number; readonly reason?: string }) => void) | null
  send(data: Uint8Array): void
  close(code?: number, reason?: string): void
}

export type WebSocketConstructor = new (url: string, protocols?: string | string[]) => WebSocketLike

const WS_CLOSE_NORMAL = 1000

function isValidWireCloseCode(code: number | undefined): code is number {
  if (typeof code !== 'number' || !Number.isInteger(code)) return false
  return code === WS_CLOSE_NORMAL || (code >= 3000 && code <= 4999)
}

function getDefaultWebSocketCtor(): WebSocketConstructor {
  const g = globalThis as unknown as { WebSocket?: WebSocketConstructor }
  if (typeof g.WebSocket !== 'function') {
    throw new Error('Global WebSocket constructor is not available in this environment')
  }
  return g.WebSocket
}

export interface ConnectWsOptions {
  readonly timeoutMs?: number | undefined
  readonly protocols?: string | string[] | undefined
  readonly clock?: Clock | undefined
  readonly WebSocketCtor?: WebSocketConstructor | undefined
}

export class WsStream implements ByteStream {
  readonly label: string
  readonly url: string
  private readonly ws: WebSocketLike
  private closed = false
  private closeReason: CloseReason | null = null
  private readonly dataEmitter = new TypedEmitter<Uint8Array>()
  private readonly closeEmitter = new TypedEmitter<CloseReason>()
  private readonly pendingQueue: Uint8Array[] = []

  constructor(ws: WebSocketLike, label: string, url: string) {
    this.ws = ws
    this.label = label
    this.url = url

    this.ws.onmessage = (ev: { readonly data: unknown }) => {
      if (this.closed) return
      const data = ev.data
      let bytes: Uint8Array
      if (data instanceof Uint8Array) {
        bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      } else if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data)
      } else if (ArrayBuffer.isView(data)) {
        bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      } else {
        return
      }
      if (this.dataEmitter.size === 0) {
        this.pendingQueue.push(bytes)
      } else {
        this.dataEmitter.emit(bytes)
      }
    }

    this.ws.onerror = () => {
      // Follow up handled by onclose or explicit error if not yet closed
    }

    this.ws.onclose = (ev: { readonly code?: number; readonly reason?: string }) => {
      if (this.closed) return
      this.closed = true
      const reason: CloseReason = {
        kind: 'remote',
        ...(ev.code !== undefined ? { code: ev.code } : {}),
        ...(ev.reason ? { reason: ev.reason } : {}),
      }
      this.closeReason = reason
      this.closeEmitter.emit(reason)
      this.dataEmitter.clear()
      this.closeEmitter.clear()
    }
  }

  get bufferedAmount(): number {
    return this.ws.bufferedAmount ?? 0
  }

  write(bytes: Uint8Array): void {
    if (this.closed) {
      throw new ClosedError(this.label, `WebSocket stream (${this.url}) is closed`)
    }
    this.ws.send(bytes)
  }

  close(codeOrReason?: number | CloseReason): void {
    if (this.closed) return
    this.closed = true
    const rawCode =
      typeof codeOrReason === 'number'
        ? codeOrReason
        : typeof codeOrReason === 'object' &&
            codeOrReason !== null &&
            'code' in codeOrReason &&
            typeof codeOrReason.code === 'number'
          ? codeOrReason.code
          : undefined
    const wireCode = isValidWireCloseCode(rawCode) ? rawCode : WS_CLOSE_NORMAL
    this.ws.onopen = null
    this.ws.onmessage = null
    this.ws.onerror = null
    this.ws.onclose = null
    try {
      this.ws.close(wireCode)
    } catch {
      // ignore close errors on already closing socket
    }
    const reason: CloseReason =
      typeof codeOrReason === 'object' && codeOrReason !== null
        ? codeOrReason
        : typeof codeOrReason === 'number'
          ? { kind: 'local', code: codeOrReason }
          : { kind: 'local' }
    this.closeReason = reason
    this.closeEmitter.emit(reason)
    this.dataEmitter.clear()
    this.closeEmitter.clear()
  }

  onData(cb: (chunk: Uint8Array) => void): () => void {
    const unsub = this.dataEmitter.on(cb)
    if (this.pendingQueue.length > 0) {
      const queued = this.pendingQueue.splice(0, this.pendingQueue.length)
      for (const chunk of queued) {
        cb(chunk)
      }
    }
    return unsub
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    if (this.closed) {
      cb(this.closeReason ?? { kind: 'local' })
      return () => {}
    }
    return this.closeEmitter.on(cb)
  }
}

export function connectWsStream(
  url: string,
  label: string,
  options: ConnectWsOptions = {},
): Promise<WsStream> {
  const clock = options.clock ?? systemClock
  const timeoutMs = options.timeoutMs ?? 10_000
  const Ctor = options.WebSocketCtor ?? getDefaultWebSocketCtor()

  return new Promise<WsStream>((resolve, reject) => {
    let settled = false
    let ws: WebSocketLike
    try {
      ws = options.protocols !== undefined ? new Ctor(url, options.protocols) : new Ctor(url)
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
      return
    }
    ws.binaryType = 'arraybuffer'

    const cancelTimer = clock.setTimeout(() => {
      if (settled) return
      settled = true
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      try {
        ws.close(WS_CLOSE_NORMAL)
      } catch {
        // ignore
      }
      reject(new TimeoutError(label, timeoutMs, `WebSocket connect to ${url}`))
    }, timeoutMs)

    ws.onopen = () => {
      if (settled) return
      settled = true
      cancelTimer()
      resolve(new WsStream(ws, label, url))
    }

    ws.onerror = () => {
      if (settled) return
      settled = true
      cancelTimer()
      reject(new Error(`WebSocket connection error to ${url} (${label})`))
    }

    ws.onclose = (ev: { readonly code?: number; readonly reason?: string }) => {
      if (settled) return
      settled = true
      cancelTimer()
      reject(
        new Error(
          `WebSocket closed before open (${url}, code=${String(ev.code ?? 'unknown')}, reason=${ev.reason ?? ''})`,
        ),
      )
    }
  })
}

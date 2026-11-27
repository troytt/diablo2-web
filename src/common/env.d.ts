declare class TextDecoder {
  readonly encoding: string
  readonly fatal: boolean
  readonly ignoreBOM: boolean
  constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean })
  decode(
    input?: ArrayBufferView | ArrayBuffer,
    options?: { stream?: boolean },
  ): string
}

declare class TextEncoder {
  readonly encoding: string
  constructor()
  encode(input?: string): Uint8Array
  encodeInto(
    source: string,
    destination: Uint8Array,
  ): { read: number; written: number }
}

declare type BlobPart = ArrayBufferView | ArrayBuffer | Blob | string

declare interface ReadableStreamLike {
  pipeThrough(transform: unknown): ReadableStreamLike
}

declare class Blob {
  readonly size: number
  readonly type: string
  constructor(blobParts?: BlobPart[], options?: { type?: string })
  stream(): ReadableStreamLike
  arrayBuffer(): Promise<ArrayBuffer>
  slice(start?: number, end?: number, contentType?: string): Blob
}

declare class DecompressionStream {
  readonly readable: unknown
  readonly writable: unknown
  constructor(format: 'gzip' | 'deflate' | 'deflate-raw')
}

declare class Response {
  constructor(body?: unknown, init?: unknown)
  arrayBuffer(): Promise<ArrayBuffer>
}

declare const console: {
  log(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
  info(...args: unknown[]): void
  debug(...args: unknown[]): void
}

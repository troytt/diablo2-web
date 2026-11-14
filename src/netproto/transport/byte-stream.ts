/**
 * L0 Transport ByteStream interface.
 * Zero DOM or Node dependencies.
 */

export type EndpointKind = 'bnet' | 'realm' | 'game' | 'ts'

export type CloseReason =
  | { readonly kind: 'local'; readonly code?: number | undefined; readonly reason?: string | undefined }
  | { readonly kind: 'remote'; readonly code?: number | undefined; readonly reason?: string | undefined }
  | { readonly kind: 'error'; readonly error: Error }

export interface ByteStream {
  write(bytes: Uint8Array): void
  close(codeOrReason?: number | string | CloseReason): void
  onData(cb: (chunk: Uint8Array) => void): () => void
  onClose(cb: (reason: CloseReason) => void): () => void
  readonly label: string
}

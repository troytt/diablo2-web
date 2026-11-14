/**
 * Protocol, framing, stream, and timeout error classes for `src/netproto/`.
 * Zero DOM or Node dependencies.
 */

export type ProtocolConnectionKind =
  | 'bnet'
  | 'bncs'
  | 'realm'
  | 'mcp'
  | 'game'
  | 'd2gs'
  | 'ts'
  | 'bitstream'
  | 'unknown'

export interface ProtocolErrorOptions {
  readonly proto?: ProtocolConnectionKind | undefined
  readonly packetId?: number | null | undefined
  readonly offset?: number | undefined
  readonly raw?: Uint8Array | undefined
}

export class ProtocolError extends Error {
  readonly conn: ProtocolConnectionKind
  readonly packetId: number | null
  readonly offset: number
  readonly rawBytes?: Uint8Array | undefined

  constructor(
    connOrMessage: string,
    packetIdOrOpts?: number | null | ProtocolErrorOptions,
    offset?: number,
    message?: string,
    rawBytes?: Uint8Array,
  ) {
    let resolvedConn: ProtocolConnectionKind = 'unknown'
    let resolvedPacketId: number | null = null
    let resolvedOffset = 0
    let resolvedMessage = connOrMessage
    let resolvedRaw: Uint8Array | undefined = rawBytes

    if (typeof message === 'string') {
      // 4/5-arg form: (conn, packetId, offset, message, rawBytes?)
      resolvedConn = connOrMessage as ProtocolConnectionKind
      resolvedPacketId = typeof packetIdOrOpts === 'number' ? packetIdOrOpts : null
      resolvedOffset = offset ?? 0
      resolvedMessage = message
    } else if (packetIdOrOpts && typeof packetIdOrOpts === 'object') {
      // 2-arg form: (message, { proto, packetId, offset, raw })
      resolvedConn = packetIdOrOpts.proto ?? 'unknown'
      resolvedPacketId = packetIdOrOpts.packetId ?? null
      resolvedOffset = packetIdOrOpts.offset ?? 0
      resolvedRaw = packetIdOrOpts.raw
    } else {
      // 1..3-arg form: (message, packetId?, offset?)
      resolvedConn = 'd2gs'
      resolvedPacketId = typeof packetIdOrOpts === 'number' ? packetIdOrOpts : null
      resolvedOffset = offset ?? 0
    }

    const pktHex =
      resolvedPacketId !== null && resolvedPacketId >= 0
        ? `0x${(resolvedPacketId >>> 0).toString(16).padStart(2, '0')}`
        : 'n/a'
    super(`[ProtocolError conn=${resolvedConn} packet=${pktHex} offset=${resolvedOffset}] ${resolvedMessage}`)
    this.name = 'ProtocolError'
    this.conn = resolvedConn
    this.packetId = resolvedPacketId
    this.offset = resolvedOffset
    if (resolvedRaw !== undefined) {
      this.rawBytes = resolvedRaw
    }
  }
}

export class ClosedError extends ProtocolError {
  constructor(conn: string, message = 'Stream is closed') {
    super(conn, null, 0, message)
    this.name = 'ClosedError'
  }
}

export class TimeoutError extends ProtocolError {
  readonly timeoutMs: number

  constructor(conn: string, timeoutMs: number, operation = 'operation') {
    super(conn, null, 0, `${operation} timed out after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs
  }
}

export interface NetprotoErrorOptions {
  readonly channel?: string | undefined
}

export class NetprotoError extends ProtocolError {
  readonly code: string
  readonly channel?: string | undefined

  constructor(code: string, message: string, options?: NetprotoErrorOptions) {
    const ch = (options?.channel ?? 'unknown') as ProtocolConnectionKind
    super(ch, null, 0, message)
    this.name = 'NetprotoError'
    this.code = code
    if (options?.channel !== undefined) {
      this.channel = options.channel
    }
  }
}

export class BncsCreateAccountError extends ProtocolError {
  readonly status: number
  readonly suggestion: string
  readonly nameSuggestion: string

  constructor(status: number, suggestion = '', accountName?: string) {
    const target = accountName ? ` for "${accountName}"` : ''
    super(
      `BNCS SID_CREATEACCOUNT2 failed${target} with status=0x${(status >>> 0).toString(16)}`,
      { proto: 'bncs', packetId: 0x3d },
    )
    this.name = 'BncsCreateAccountError'
    this.status = status
    this.suggestion = suggestion
    this.nameSuggestion = suggestion
  }
}


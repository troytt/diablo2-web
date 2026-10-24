/**
 * Configuration & state contracts for `D2OnlineFlow` (PROJECT.md § Interface Contracts).
 */

import type { Clock } from '../core/clock.ts'
import type { PacketTap } from '../core/packet-tap.ts'
import type { TextEncoding } from '../core/text-codec.ts'
import type { ItemDataTables } from '../domain/ids.ts'
import type { EndpointResolver } from '../transport/endpoint.ts'

export type D2OnlineState =
  | 'idle'
  | 'connecting_bnet'
  | 'authenticated'
  | 'connecting_realm'
  | 'realm_ready'
  | 'connecting_game'
  | 'ingame'
  | 'closed'

/** Which live connection of the flow was lost. */
export type D2OnlineSessionKind = 'bncs' | 'mcp' | 'd2gs'

/**
 * Why the connection was lost:
 * - `closed`: the socket closed without the flow asking for it (server/bridge close).
 * - `error`: the transport reported an error (socket error / write on a dead socket).
 * - `timeout`: a request/response exchange on that connection timed out.
 * - `connect_failed`: opening the connection (or the realm MCP startup) failed.
 * - `not_connected`: a command needed the connection but it is not connected.
 */
export type D2OnlineSessionLostCause = 'closed' | 'error' | 'timeout' | 'connect_failed' | 'not_connected'

/**
 * Emitted exactly once per `D2OnlineFlow` when a connection it owns is lost. By the time listeners run,
 * the flow has already closed every remaining connection and is in state `closed`.
 */
export interface D2OnlineSessionLost {
  readonly session: D2OnlineSessionKind
  readonly cause: D2OnlineSessionLostCause
  /** Concrete technical description (connection, close code/reason, timed-out packet, error text). */
  readonly message: string
  readonly closeCode?: number | undefined
  readonly closeReason?: string | undefined
  readonly error?: Error | undefined
  /** Flow state at the moment the loss was detected. */
  readonly flowState: D2OnlineState
}

export interface D2OnlineConfig {
  readonly resolver: EndpointResolver
  readonly bnetHost: string
  readonly bnetPort?: number | undefined
  readonly realmPort?: number | undefined
  readonly gamePort?: number | undefined
  readonly defaultRealm?: string | undefined
  readonly classicCdKey?: string | undefined
  readonly expansionCdKey?: string | undefined
  readonly textEncoding?: TextEncoding | undefined
  readonly itemTables?: ItemDataTables | undefined
  readonly tap?: PacketTap | undefined
  readonly clock?: Clock | undefined
  readonly bncsKeepaliveIntervalMs?: number | undefined
}

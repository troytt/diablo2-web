/**
 * Graceful D2GS leave: C2S `0x69` LeaveGame must stay on an open connection until D2GS acknowledges
 * with S2C `0x06` GameLogoutSuccess (D2Client handler `0x6fb5caa0`) or closes the socket, with a
 * 1.5 s fallback (`D2GS_LEAVE_ACK_TIMEOUT_MS`). Closing in the same tick as the `0x69` write can turn
 * the exit into a drop and let a fast rejoin (+1 / next game) load a stale save.
 */

import { describe, expect, it } from 'vitest'

import { createD2OnlineFlow, type D2OnlineFlow } from '../../src/netproto/index.ts'
import { FakeClock } from '../../src/netproto/core/clock.ts'
import { D2GS_LEAVE_ACK_TIMEOUT_MS, D2gsSession } from '../../src/netproto/d2gs/session.ts'
import {
  defaultD2gsHuffmanCodec,
  wrapD2gsCompressedBlock,
} from '../../src/netproto/d2gs/compression.ts'
import { createMemoryStreamPair, type MemoryStream } from '../../src/netproto/transport/memory-stream.ts'
import { getCanonicalItemDataTables } from '../../src/client/world/item-tables-provider.ts'
import { createFakeRealm, type FakeRealm, type FakeRealmOptions } from './fake-realm-servers.ts'

function s2c(bytes: number[]): Uint8Array {
  return wrapD2gsCompressedBlock(defaultD2gsHuffmanCodec.compress(new Uint8Array(bytes)))
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

interface SessionHarness {
  readonly clock: FakeClock
  readonly server: MemoryStream
  readonly session: D2gsSession
  readonly c2s: number[]
}

/** D2GS session driven to `ingame` over an in-memory stream (0xAF -> 0x68, 0x01/0x02 -> 0x6B, 0x04). */
function ingameSession(): SessionHarness {
  const clock = new FakeClock(1_000)
  const [client, server] = createMemoryStreamPair()
  const c2s: number[] = []
  server.onData((chunk) => {
    c2s.push(chunk[0]!)
  })
  const session = new D2gsSession({
    stream: client,
    logon: { gameHash: 1, gameToken: 1, charClass: 1, charName: 'Hero' },
    clock,
  })
  server.write(new Uint8Array([0xaf, 0x01]))
  server.write(s2c([0x01, 0, 0, 0, 0, 0, 1, 1, 0x02, 0x04]))
  expect(session.state).toBe('ingame')
  c2s.length = 0
  return { clock, server, session, c2s }
}

describe('D2gsSession.leaveGracefully', () => {
  it('uses a 1.5 s fallback timeout', () => {
    expect(D2GS_LEAVE_ACK_TIMEOUT_MS).toBe(1500)
  })

  it('sends 0x69 and keeps the stream open until S2C 0x06 GameLogoutSuccess', async () => {
    const h = ingameSession()
    let resolved = false
    const done = h.session.leaveGracefully().then(() => {
      resolved = true
    })
    expect(h.c2s).toEqual([0x69])
    await flushMicrotasks()
    expect(resolved).toBe(false)
    expect(h.server.isClosed).toBe(false)
    expect(h.session.state).toBe('ingame')

    // Nothing else may follow the 0x69 on the wire (no ping / gameplay packet after leaving).
    h.session.sendPing()
    h.clock.advance(D2GS_LEAVE_ACK_TIMEOUT_MS - 1)
    expect(h.c2s).toEqual([0x69])

    h.server.write(s2c([0x06]))
    await done
    expect(resolved).toBe(true)
    expect(h.session.state).toBe('closed')
    expect(h.server.isClosed).toBe(true)
  })

  it('resolves when D2GS closes the connection instead of sending 0x06', async () => {
    const h = ingameSession()
    const done = h.session.leaveGracefully()
    h.server.close()
    await done
    expect(h.session.state).toBe('closed')
  })

  it('falls back to closing after exactly 1.5 s without an answer', async () => {
    const h = ingameSession()
    let resolved = false
    const done = h.session.leaveGracefully().then(() => {
      resolved = true
    })
    h.clock.advance(D2GS_LEAVE_ACK_TIMEOUT_MS - 1)
    await flushMicrotasks()
    expect(resolved).toBe(false)
    expect(h.server.isClosed).toBe(false)

    h.clock.advance(1)
    await done
    expect(h.session.state).toBe('closed')
    expect(h.server.isClosed).toBe(true)
  })

  it('is idempotent and leaveAndClose during the wait finishes it without a second 0x69', async () => {
    const h = ingameSession()
    const a = h.session.leaveGracefully()
    const b = h.session.leaveGracefully()
    expect(b).toBe(a)
    h.session.leaveAndClose()
    await a
    expect(h.c2s).toEqual([0x69])
    expect(h.server.isClosed).toBe(true)
  })

  it('closes immediately when not in game (no save to wait for)', async () => {
    const clock = new FakeClock(1_000)
    const [client, server] = createMemoryStreamPair()
    const session = new D2gsSession({
      stream: client,
      logon: { gameHash: 1, gameToken: 1, charClass: 1, charName: 'Hero' },
      clock,
    })
    await session.leaveGracefully()
    expect(session.state).toBe('closed')
    expect(server.isClosed).toBe(true)
  })
})

interface FlowHarness {
  readonly realm: FakeRealm
  readonly clock: FakeClock
  readonly flow: D2OnlineFlow
  readonly lost: unknown[]
}

async function ingameFlow(options: FakeRealmOptions = {}): Promise<FlowHarness> {
  const realm = createFakeRealm({ characters: 1, ...options })
  const clock = new FakeClock(1000)
  const flow = createD2OnlineFlow({
    bnetHost: '127.0.0.1',
    resolver: realm.resolver,
    clock,
    itemTables: getCanonicalItemDataTables(),
  })
  const lost: unknown[] = []
  flow.onSessionLost((ev) => lost.push(ev))
  await flow.connectBnet()
  await flow.login('d2webbot2', 'secret')
  await flow.enterRealm('D2CS')
  await flow.selectCharacter('d2webbot_sorc')
  await flow.createGame({ name: 'leave-game', password: '', difficulty: 0 })
  await flow.joinGame('leave-game', '')
  expect(flow.state).toBe('ingame')
  return { realm, clock, flow, lost }
}

describe('D2OnlineFlow.leaveToLobby graceful D2GS exit', () => {
  it('returns to realm_ready only after D2GS acknowledged 0x69 with 0x06', async () => {
    const h = await ingameFlow()
    const game = h.realm.latest('game')
    const c2s: number[] = []
    game.server.onData((chunk) => c2s.push(chunk[0]!))

    await h.flow.leaveToLobby()
    expect(c2s).toContain(0x69)
    expect(game.client.isClosed).toBe(true)
    expect(h.flow.state).toBe('realm_ready')
    expect(h.lost).toHaveLength(0)
    await h.flow.close()
  })

  it('waits for the 1.5 s fallback when D2GS stays silent, then returns to realm_ready', async () => {
    const h = await ingameFlow({ d2gsLeaveMode: 'silent' })
    const game = h.realm.latest('game')
    let settled = false
    const done = h.flow.leaveToLobby().then(() => {
      settled = true
    })
    await flushMicrotasks()
    h.clock.advance(D2GS_LEAVE_ACK_TIMEOUT_MS - 1)
    await flushMicrotasks()
    expect(settled).toBe(false)
    expect(game.client.isClosed).toBe(false)

    h.clock.advance(1)
    await done
    expect(game.client.isClosed).toBe(true)
    expect(h.flow.state).toBe('realm_ready')
    expect(h.lost).toHaveLength(0)
    await h.flow.close()
  })

  it('a BNCS loss while waiting for the logout ack ends the flow as closed (not realm_ready)', async () => {
    const h = await ingameFlow({ d2gsLeaveMode: 'silent' })
    const done = h.flow.leaveToLobby()
    await flushMicrotasks()
    h.realm.latest('bnet').server.close()
    h.clock.advance(D2GS_LEAVE_ACK_TIMEOUT_MS)
    await done
    expect(h.flow.state).toBe('closed')
    expect(h.lost).toHaveLength(1)
    expect(h.realm.allClientStreamsClosed()).toBe(true)
  })
})

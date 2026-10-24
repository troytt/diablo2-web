/**
 * `createD2OnlineFlow` connection-loss detection: every BNCS/MCP/D2GS loss (socket close, request
 * timeout, command without a connection) produces exactly one `onSessionLost` event, the flow ends
 * in state `closed`, and every connection it opened is closed.
 */

import { describe, expect, it } from 'vitest'

import {
  createD2OnlineFlow,
  type D2OnlineFlow,
  type D2OnlineSessionLost,
} from '../../src/netproto/index.ts'
import { FakeClock } from '../../src/netproto/core/clock.ts'
import { TimeoutError } from '../../src/netproto/core/errors.ts'
import { BncsOpcode } from '../../src/netproto/bncs/packets.ts'
import { McpOpcode } from '../../src/netproto/mcp/packets.ts'
import { getCanonicalItemDataTables } from '../../src/client/world/item-tables-provider.ts'
import { createFakeRealm, type FakeRealm, type FakeRealmOptions } from './fake-realm-servers.ts'

interface Harness {
  readonly realm: FakeRealm
  readonly clock: FakeClock
  readonly flow: D2OnlineFlow
  readonly lost: D2OnlineSessionLost[]
}

function createHarness(options: FakeRealmOptions = {}): Harness {
  const realm = createFakeRealm(options)
  const clock = new FakeClock(1000)
  const flow = createD2OnlineFlow({
    bnetHost: '127.0.0.1',
    resolver: realm.resolver,
    clock,
    itemTables: getCanonicalItemDataTables(),
  })
  const lost: D2OnlineSessionLost[] = []
  flow.onSessionLost((ev) => lost.push(ev))
  return { realm, clock, flow, lost }
}

/** Log in and enter the realm: the char_select (1 char) / char_create (0 chars) screen. */
async function toCharacterScreen(h: Harness): Promise<void> {
  await h.flow.connectBnet()
  await h.flow.login('d2webbot2', 'secret')
  await h.flow.enterRealm('D2CS')
  expect(h.flow.state).toBe('realm_ready')
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

/** Advance the fake clock in steps so promise continuations can arm their timers in between. */
async function advance(clock: FakeClock, ms: number): Promise<void> {
  const step = 500
  for (let t = 0; t < ms; t += step) {
    await flushMicrotasks()
    clock.advance(Math.min(step, ms - t))
  }
  await flushMicrotasks()
}

describe('D2OnlineFlow session loss', () => {
  it('BNCS server close on char_select: one loss event, flow closed, BNCS + MCP sockets disposed', async () => {
    const h = createHarness({ characters: 1 })
    await toCharacterScreen(h)

    h.realm.latest('bnet').server.close()

    expect(h.lost).toHaveLength(1)
    expect(h.lost[0]).toMatchObject({ session: 'bncs', cause: 'closed', flowState: 'realm_ready' })
    expect(h.lost[0]!.message).toContain('BNCS connection closed')
    expect(h.flow.state).toBe('closed')
    expect(h.flow.sessionLost).toBe(h.lost[0])
    expect(h.realm.latest('realm').client.isClosed).toBe(true)
    expect(h.realm.allClientStreamsClosed()).toBe(true)
  })

  it('MCP server close on char_create: one loss event; a later createCharacter fails without a second event', async () => {
    const h = createHarness({ characters: 0 })
    await toCharacterScreen(h)

    h.realm.latest('realm').server.close({ kind: 'error', error: new Error('ECONNRESET') })

    expect(h.lost).toHaveLength(1)
    expect(h.lost[0]).toMatchObject({ session: 'mcp', cause: 'error', flowState: 'realm_ready' })
    expect(h.lost[0]!.message).toContain('ECONNRESET')
    expect(h.realm.allClientStreamsClosed()).toBe(true)

    await expect(
      h.flow.createCharacter({ name: 'NewSorc', classId: 1, expansion: true }),
    ).rejects.toThrow(/MCP realm session is not connected for createCharacter/)
    expect(h.lost).toHaveLength(1)
    expect(h.flow.state).toBe('closed')
  })

  it('realm logon timeout (SID_LOGONREALMEX unanswered): timeout loss, no reconnect, sockets disposed', async () => {
    const h = createHarness({ silentBncs: [BncsOpcode.SID_LOGONREALMEX] })
    await h.flow.connectBnet()
    await h.flow.login('d2webbot2', 'secret')

    const entering = h.flow.enterRealm('D2CS')
    const outcome = entering.then(
      () => null,
      (err: unknown) => err,
    )
    await advance(h.clock, 10_500)

    expect(await outcome).toBeInstanceOf(TimeoutError)
    expect(h.lost).toHaveLength(1)
    expect(h.lost[0]).toMatchObject({ session: 'bncs', cause: 'timeout', flowState: 'connecting_realm' })
    expect(h.flow.state).toBe('closed')
    expect(h.realm.connections.filter((c) => c.role === 'realm')).toHaveLength(0)
    expect(h.realm.connections.filter((c) => c.role === 'bnet')).toHaveLength(1)
    expect(h.realm.allClientStreamsClosed()).toBe(true)
  })

  it('MCP_STARTUP timeout: realm timeout loss closes both the MCP and BNCS sockets', async () => {
    const h = createHarness({ silentMcp: [McpOpcode.MCP_STARTUP] })
    await h.flow.connectBnet()
    await h.flow.login('d2webbot2', 'secret')

    const outcome = h.flow.enterRealm('D2CS').then(
      () => null,
      (err: unknown) => err,
    )
    await advance(h.clock, 10_500)

    expect(await outcome).toBeInstanceOf(TimeoutError)
    expect(h.lost).toHaveLength(1)
    expect(h.lost[0]).toMatchObject({ session: 'mcp', cause: 'timeout' })
    expect(h.realm.allClientStreamsClosed()).toBe(true)
  })

  it('BNCS and MCP closing at the same time are reported exactly once', async () => {
    const h = createHarness({ characters: 1 })
    await toCharacterScreen(h)

    h.realm.latest('realm').server.close()
    h.realm.latest('bnet').server.close()
    await flushMicrotasks()

    expect(h.lost).toHaveLength(1)
    expect(h.lost[0]!.session).toBe('mcp')
    expect(h.flow.state).toBe('closed')
    expect(h.realm.allClientStreamsClosed()).toBe(true)
  })

  it('D2GS drop in game: one d2gs loss event and BNCS/MCP/D2GS are all disposed', async () => {
    const h = createHarness({ characters: 1 })
    await toCharacterScreen(h)
    await h.flow.selectCharacter('d2webbot_sorc')
    await h.flow.createGame({ name: 'loss-game', password: '', difficulty: 0 })
    await h.flow.joinGame('loss-game', '')
    expect(h.flow.state).toBe('ingame')

    h.realm.latest('game').server.close()

    expect(h.lost).toHaveLength(1)
    expect(h.lost[0]).toMatchObject({ session: 'd2gs', cause: 'closed', flowState: 'ingame' })
    expect(h.flow.state).toBe('closed')
    expect(h.realm.allClientStreamsClosed()).toBe(true)
  })

  it('BNCS loss during a game is reported when the game ends, not by aborting the game', async () => {
    const h = createHarness({ characters: 1 })
    await toCharacterScreen(h)
    await h.flow.selectCharacter('d2webbot_sorc')
    await h.flow.joinGame('loss-game', '')

    h.realm.latest('bnet').server.close()
    expect(h.lost).toHaveLength(0)
    expect(h.flow.state).toBe('ingame')
    expect(h.realm.latest('game').client.isClosed).toBe(false)

    await h.flow.leaveToLobby()
    expect(h.lost).toHaveLength(1)
    expect(h.lost[0]).toMatchObject({ session: 'bncs', cause: 'closed', flowState: 'ingame' })
    expect(h.flow.state).toBe('closed')
    expect(h.realm.allClientStreamsClosed()).toBe(true)
  })

  it('close() on purpose emits no loss event and disposes every socket', async () => {
    const h = createHarness({ characters: 1 })
    await toCharacterScreen(h)

    await h.flow.close()

    expect(h.lost).toHaveLength(0)
    expect(h.flow.sessionLost).toBeNull()
    expect(h.flow.state).toBe('closed')
    expect(h.realm.allClientStreamsClosed()).toBe(true)
  })

  it('idling >6 minutes on char_select / lobby sends 180s SID_NULL keepalives and still allows listCharacters and createGame', async () => {
    const h = createHarness({ characters: 1 })
    await toCharacterScreen(h)
    expect(h.realm.bncsNullCount).toBe(0)

    // Idle 6 minutes (360,000 ms) on character screen -> 2 BNCS SID_NULL keepalives
    h.clock.advance(360_000)
    await flushMicrotasks()
    expect(h.realm.bncsNullCount).toBe(2)
    expect(h.lost).toHaveLength(0)
    expect(h.flow.sessionLost).toBeNull()
    expect(h.flow.state).toBe('realm_ready')

    const charsAfterCharSelectIdle = await h.flow.listCharacters()
    expect(charsAfterCharSelectIdle).toHaveLength(1)
    expect(charsAfterCharSelectIdle[0]!.name).toBe('d2webbot_sorc')

    // Select character, enter chat lobby, and idle another 6 minutes (360,000 ms) -> 4 total SID_NULLs
    await h.flow.selectCharacter('d2webbot_sorc')
    await h.flow.enterChat()
    h.clock.advance(360_000)
    await flushMicrotasks()
    expect(h.realm.bncsNullCount).toBe(4)
    expect(h.lost).toHaveLength(0)
    expect(h.flow.sessionLost).toBeNull()

    await h.flow.createGame({ name: 'after-idle', password: '', difficulty: 0 })
    const adapter = await h.flow.joinGame('after-idle', '')
    expect(h.flow.state).toBe('ingame')
    adapter.leave()
    await h.flow.close()
  })

  it('D2GS S2C 0xB4 (reason=0x06 CHARLOCKED) rejects joinGame with explicit duplicate-login message and keeps lobby alive', async () => {
    const h = createHarness({ characters: 1, d2gsLogonMode: 'charlocked_0xb4' })
    await toCharacterScreen(h)
    await h.flow.selectCharacter('d2webbot_sorc')
    await h.flow.createGame({ name: 'dup-room', password: '', difficulty: 0 })

    await expect(h.flow.joinGame('dup-room', '')).rejects.toThrow(/已经登录/)
    expect(h.lost).toHaveLength(0)
    expect(h.flow.state).toBe('realm_ready')
    expect(h.realm.latest('game').client.isClosed).toBe(true)
    await h.flow.close()
  })

  it('D2GS silent 0x68 GameLogon drop (PvPGN d2dbs CHARLOCKED) rejects after 3s with explicit duplicate-login message and keeps lobby alive', async () => {
    const h = createHarness({ characters: 1, d2gsLogonMode: 'silent_logon' })
    await toCharacterScreen(h)
    await h.flow.selectCharacter('d2webbot_sorc')
    await h.flow.createGame({ name: 'dup-silent', password: '', difficulty: 0 })

    const joining = h.flow.joinGame('dup-silent', '').then(
      () => null,
      (err: unknown) => err,
    )
    await new Promise((r) => setTimeout(r, 15))
    await advance(h.clock, 3_500)

    const err = await joining
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/已经登录/)
    expect(h.lost).toHaveLength(0)
    expect(h.flow.state).toBe('realm_ready')
    expect(h.realm.latest('game').client.isClosed).toBe(true)
    await h.flow.close()
  })
})


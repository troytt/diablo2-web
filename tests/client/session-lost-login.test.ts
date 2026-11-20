/**
 * Session loss on every Battle.net screen returns the UI to the login screen with the reason.
 *
 * Drives the real `OnlineSession` + `createD2OnlineFlow` over in-memory BNCS/MCP/D2GS fake servers
 * and wires `onSessionLost` to `returnToLoginAfterSessionLoss` exactly like `src/client/main.ts`.
 * Each case asserts: back on `bnet_login`, the 1.13c tbl reason text, connections disposed, and a
 * single loss notification.
 */

import { describe, expect, it } from 'vitest'

import {
  applyOnlineCharactersToFlowState,
  createInitialFlowState,
  openPopupModal,
  returnToLoginAfterSessionLoss,
  type BnetFlowState,
} from '../../src/client/frontend/flow-state.ts'
import {
  DuplicateCharacterLoginError,
  OnlineSession,
  SessionLostError,
  createMemoryLeaseStorage,
  formatLobbyGameEnterError,
  formatSessionLostReason,
  type ActiveCharLeaseStorage,
  type OnlineSessionLostEvent,
} from '../../src/client/session/online-session.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'
import { createD2OnlineFlow, type D2OnlineFlow } from '../../src/netproto/index.ts'
import { FakeClock } from '../../src/netproto/core/clock.ts'
import { BncsOpcode } from '../../src/netproto/bncs/packets.ts'
import { createFakeRealm, type FakeRealm, type FakeRealmOptions } from '../netproto/fake-realm-servers.ts'

const TBL_BNCS_LOST = 'Your connection to Battle.net has been lost.'
const TBL_INTERRUPTED = 'Your connection has been interrupted'
const TBL_TIMEOUT = 'Timed out waiting for response.'
const TBL_LOST_CONNECTION = 'Lost Connection to battle.net.'

interface Harness {
  readonly realm: FakeRealm
  readonly clock: FakeClock
  readonly session: OnlineSession
  readonly ui: BnetFlowState
  readonly lost: OnlineSessionLostEvent[]
  readonly disconnects: string[]
}

function createHarness(
  options: FakeRealmOptions = {},
  wrapFlow: (flow: D2OnlineFlow) => D2OnlineFlow = (flow) => flow,
  extraOptions?: {
    readonly leaseStorage?: ActiveCharLeaseStorage | null | undefined
    readonly tabId?: string | undefined
  },
): Harness {
  const realm = createFakeRealm(options)
  const clock = new FakeClock(1000)
  const session = new OnlineSession({
    settingsStore: createSettingsStore(),
    flowFactory: (config) => wrapFlow(createD2OnlineFlow({ ...config, resolver: realm.resolver, clock })),
    leaseStorage: extraOptions?.leaseStorage,
    tabId: extraOptions?.tabId,
  })
  const ui = createInitialFlowState()
  ui.stage = 'bnet_login'
  ui.accountName = 'd2webbot2'
  ui.accountPassword = 'secret'
  const lost: OnlineSessionLostEvent[] = []
  const disconnects: string[] = []
  // Same routing as `bootPlayApp` in src/client/main.ts.
  session.onSessionLost((ev) => {
    lost.push(ev)
    returnToLoginAfterSessionLoss(ui, ev.reason)
  })
  session.onDisconnect((reason) => disconnects.push(reason))
  return { realm, clock, session, ui, lost, disconnects }
}

/** What `onLogin` in main.ts does on success. */
async function logIn(h: Harness): Promise<void> {
  const res = await h.session.login({ username: h.ui.accountName, password: h.ui.accountPassword })
  applyOnlineCharactersToFlowState(h.ui, res.characters)
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function expectBackOnLogin(h: Harness, reasonPrefix: string, technical: string | RegExp): void {
  expect(h.lost).toHaveLength(1)
  expect(h.disconnects).toHaveLength(1)
  const reason = h.lost[0]!.reason
  expect(reason.startsWith(reasonPrefix)).toBe(true)
  if (typeof technical === 'string') expect(reason).toContain(technical)
  else expect(reason).toMatch(technical)
  expect(h.ui.stage).toBe('bnet_login')
  expect(h.ui.loginError).toBe(reason)
  expect(h.ui.lastError).toBe(reason)
  expect(h.ui.roster).toEqual([])
  expect(h.ui.onlineConnected).toBe(false)
  expect(h.ui.accountName).toBe('d2webbot2')
  expect(h.session.phase).toBe('disconnected')
  expect(h.session.disconnectReason).toBe(reason)
  expect(h.session.getSnapshot().flowState).toBe('idle')
  expect(h.realm.allClientStreamsClosed()).toBe(true)
}

describe('OnlineSession session loss -> login screen', () => {
  it('BNCS close on char_select returns to login with string#5352', async () => {
    const h = createHarness({ characters: 1 })
    await logIn(h)
    expect(h.ui.stage).toBe('char_select')

    h.realm.latest('bnet').server.close()

    expectBackOnLogin(h, TBL_BNCS_LOST, 'BNCS connection closed')
    expect(h.lost[0]).toMatchObject({ session: 'bncs', cause: 'closed' })
  })

  it('MCP close on char_create returns to login with string#5357', async () => {
    const h = createHarness({ characters: 0 })
    await logIn(h)
    expect(h.ui.stage).toBe('char_create')

    h.realm.latest('realm').server.close()

    expectBackOnLogin(h, TBL_INTERRUPTED, 'MCP realm connection closed')
    expect(h.lost[0]).toMatchObject({ session: 'mcp', cause: 'closed' })

    // A create-character click on the stale screen stays on login and reports nothing new.
    await expect(h.session.createCharacter({ name: 'NewSorc', classId: 1 })).rejects.toBeInstanceOf(
      SessionLostError,
    )
    expect(h.lost).toHaveLength(1)
    expect(h.ui.stage).toBe('bnet_login')
    expect(h.ui.charCreateError).toBeNull()
  })

  it('realm logon timeout during login returns to login with string#5349', async () => {
    const h = createHarness({ silentBncs: [BncsOpcode.SID_LOGONREALMEX] })
    const attempt = logIn(h).then(
      () => null,
      (err: unknown) => err,
    )
    for (let t = 0; t < 10_500; t += 500) {
      await flushMicrotasks()
      h.clock.advance(500)
    }

    const err = await attempt
    expect(err).toBeInstanceOf(SessionLostError)
    expectBackOnLogin(h, TBL_TIMEOUT, /timed out after 10000ms/)
    expect(h.lost[0]).toMatchObject({ session: 'bncs', cause: 'timeout' })
    expect(h.realm.connections.filter((c) => c.role === 'realm')).toHaveLength(0)
  })

  it('create-character click while the MCP session is gone returns to login with string#5351', async () => {
    // A flow whose realm logon left no MCP connection (the original dead-end: the char_create
    // screen showed "MCP realm session is not connected" and stayed there).
    const h = createHarness({ characters: 0 }, (flow) => ({
      ...flow,
      get state() {
        return flow.state
      },
      get sessionLost() {
        return flow.sessionLost
      },
      enterRealm: async () => [],
    }))
    await logIn(h)
    expect(h.ui.stage).toBe('char_create')
    expect(h.realm.connections.filter((c) => c.role === 'realm')).toHaveLength(0)

    let routedError: unknown = null
    try {
      await h.session.createCharacter({ name: 'NewSorc', classId: 1 })
    } catch (err) {
      routedError = err
    }

    expect(routedError).toBeInstanceOf(SessionLostError)
    expectBackOnLogin(h, TBL_LOST_CONNECTION, 'MCP realm session is not connected for createCharacter')
    expect(h.lost[0]).toMatchObject({ session: 'mcp', cause: 'not_connected' })
    expect(h.ui.charCreateError).toBeNull()
  })

  it('create-character click without any session returns to login with string#5351', async () => {
    const h = createHarness()
    h.ui.stage = 'char_create'

    await expect(h.session.createCharacter({ name: 'NewSorc', classId: 1 })).rejects.toBeInstanceOf(
      SessionLostError,
    )

    expectBackOnLogin(h, TBL_LOST_CONNECTION, 'MCP realm session is not connected for createCharacter')
  })

  it('BNCS and MCP closing together are handled once', async () => {
    const h = createHarness({ characters: 1 })
    await logIn(h)

    h.realm.latest('bnet').server.close()
    h.realm.latest('realm').server.close()
    await flushMicrotasks()

    expectBackOnLogin(h, TBL_BNCS_LOST, 'BNCS connection closed')
  })

  it('D2GS drop in game returns to login with string#5357 and disposes BNCS/MCP/D2GS', async () => {
    const h = createHarness({ characters: 1 })
    await logIn(h)
    await h.session.selectCharacter('d2webbot_sorc')
    await h.session.enterGame({ mode: 'create', spec: { name: 'loss-game', difficulty: 0 } })
    h.ui.stage = 'in_game'
    expect(h.session.phase).toBe('ingame')

    h.realm.latest('game').server.close()

    expectBackOnLogin(h, TBL_INTERRUPTED, 'D2GS game connection closed')
    expect(h.lost[0]).toMatchObject({ session: 'd2gs', cause: 'closed' })
    expect(h.ui.sceneReady).toBe(false)
  })

  it('disconnect() ends the session through the same path with the exact reason', async () => {
    const h = createHarness({ characters: 1 })
    await logIn(h)

    await h.session.disconnect('Saved and exited the game; Battle.net session closed')

    expect(h.lost).toHaveLength(1)
    expect(h.lost[0]).toMatchObject({ session: 'client', cause: 'local' })
    expect(h.ui.stage).toBe('bnet_login')
    expect(h.ui.loginError).toBe('Saved and exited the game; Battle.net session closed')
    expect(h.session.disconnectReason).toBe('Saved and exited the game; Battle.net session closed')
    expect(h.realm.allClientStreamsClosed()).toBe(true)
  })

  it('a new login after a loss starts a fresh session', async () => {
    const h = createHarness({ characters: 1 })
    await logIn(h)
    h.realm.latest('realm').server.close()
    expect(h.ui.stage).toBe('bnet_login')

    await logIn(h)

    expect(h.ui.stage).toBe('char_select')
    expect(h.session.phase).toBe('lobby')
    expect(h.session.sessionLost).toBeNull()
    expect(h.realm.latest('bnet').client.isClosed).toBe(false)
    expect(h.realm.latest('realm').client.isClosed).toBe(false)
  })
})

describe('Duplicate character login in a second page/tab (#963)', () => {
  it('blocks creating or joining a game in Tab 2 when Tab 1 has the same character in game, returning to bnet_lobby with explicit prompt instead of hanging on door_loading', async () => {
    const sharedStorage = createMemoryLeaseStorage()
    const tab1 = createHarness({ characters: 1 }, (f) => f, {
      leaseStorage: sharedStorage,
      tabId: 'tab-1',
    })
    const tab2 = createHarness({ characters: 1 }, (f) => f, {
      leaseStorage: sharedStorage,
      tabId: 'tab-2',
    })

    // Tab 1 logs in, selects character, and enters a room
    await logIn(tab1)
    await tab1.session.selectCharacter('d2webbot_sorc')
    await tab1.session.enterGame({ mode: 'create', spec: { name: 'room-tab1', difficulty: 0 } })
    tab1.ui.stage = 'in_game'
    expect(tab1.session.phase).toBe('ingame')

    // Tab 2 logs in and selects the same character
    await logIn(tab2)
    await tab2.session.selectCharacter('d2webbot_sorc')
    tab2.ui.stage = 'bnet_lobby'

    // Simulate Tab 2 clicking Create Game / Join Game (which sets stage = 'door_loading' first)
    tab2.ui.stage = 'door_loading'
    let caughtErr: unknown = null
    try {
      await tab2.session.enterGame({ mode: 'create', spec: { name: 'room-tab2', difficulty: 0 } })
    } catch (err) {
      caughtErr = err
      const friendlyMsg = formatLobbyGameEnterError(err, tab2.session.selectedChar)
      tab2.ui.stage = 'bnet_lobby'
      tab2.ui.createGameError = friendlyMsg
      tab2.ui.lastError = friendlyMsg
      openPopupModal(tab2.ui, friendlyMsg, 'bnet_lobby')
    }

    expect(caughtErr).toBeInstanceOf(DuplicateCharacterLoginError)
    expect(tab2.session.phase).toBe('lobby')
    expect(tab2.ui.stage).toBe('bnet_lobby')
    expect(tab2.ui.createGameError).toContain('该角色')
    expect(tab2.ui.createGameError).toContain('已经登录')
    expect(tab2.ui.popupModal?.message).toContain('已经登录')
    // Tab 1 remains in game undisturbed
    expect(tab1.session.phase).toBe('ingame')

    // Once Tab 1 leaves the game, Tab 2 can enter a game normally
    await tab1.session.leaveGame()
    expect(tab1.session.phase).toBe('lobby')

    await tab2.session.enterGame({ mode: 'create', spec: { name: 'room-tab2', difficulty: 0 } })
    expect(tab2.session.phase).toBe('ingame')

    tab1.session.destroy()
    tab2.session.destroy()
  })

  it('recovers from door_loading to bnet_lobby with explicit duplicate-login prompt when D2GS rejects with 0xB4 CHARLOCKED', async () => {
    const h = createHarness({ characters: 1, d2gsLogonMode: 'charlocked_0xb4' })
    await logIn(h)
    await h.session.selectCharacter('d2webbot_sorc')
    h.ui.stage = 'door_loading'

    let caughtErr: unknown = null
    try {
      await h.session.enterGame({ mode: 'join', name: 'locked-room' })
    } catch (err) {
      caughtErr = err
      const friendlyMsg = formatLobbyGameEnterError(err, h.session.selectedChar)
      h.ui.stage = 'bnet_lobby'
      h.ui.createGameError = friendlyMsg
      h.ui.lastError = friendlyMsg
      openPopupModal(h.ui, friendlyMsg, 'bnet_lobby')
    }

    expect(caughtErr).toBeInstanceOf(Error)
    expect(h.session.phase).toBe('lobby')
    expect(h.ui.stage).toBe('bnet_lobby')
    expect(h.ui.createGameError).toContain('已经登录')
    expect(h.ui.popupModal?.message).toContain('已经登录')
    expect(h.session.disconnectReason).toContain('已经登录')
    h.session.destroy()
  })
})

describe('formatSessionLostReason', () => {
  it('uses the ENG 1.13c tbl string plus the technical reason', () => {
    expect(formatSessionLostReason('bncs', 'connect_failed', 'BNCS connect failed')).toBe(
      'Battle.net is not responding. Please try connecting again in a few minutes. (BNCS connect failed)',
    )
    expect(formatSessionLostReason('mcp', 'connect_failed', 'x')).toMatch(
      /^Diablo II was unable to connect to the realm server\..* \(x\)$/,
    )
    expect(formatSessionLostReason('client', 'local', 'Disconnected by user')).toBe('Disconnected by user')
  })

  it('resolves wss:// for remote domains (d2.laiseek.xyz, www.laiseek.xyz) and ws:// for localhost even from http://localhost:8080', () => {
    const session = new OnlineSession({ settingsStore: createSettingsStore(), leaseStorage: null })
    expect(session.resolveWsBridgeBaseUrl('d2.laiseek.xyz')).toBe('wss://d2.laiseek.xyz/d2net')
    expect(session.resolveWsBridgeBaseUrl('www.laiseek.xyz')).toBe('wss://www.laiseek.xyz/d2net')
    expect(session.resolveWsBridgeBaseUrl('localhost:8080')).toBe('ws://localhost:8080/d2net')
    expect(session.resolveWsBridgeBaseUrl('127.0.0.1:8080')).toBe('ws://127.0.0.1:8080/d2net')
    expect(session.resolveWsBridgeBaseUrl('ws://d2.laiseek.xyz:8080')).toBe('ws://d2.laiseek.xyz:8080/d2net')
    expect(session.resolveWsBridgeBaseUrl('wss://localhost:8443')).toBe('wss://localhost:8443/d2net')
    session.destroy()
  })
})

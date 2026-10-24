import { describe, expect, it } from 'vitest'
import {
  createNextGamePlugin,
  incrementGameName,
  NEXT_GAME_PLUGIN_ID,
  NEXT_GAME_TOOLBAR_BUTTON_ID,
  nextGamePlugin,
  type NextGamePluginInstance,
} from '../../plugins/next-game/index.ts'
import {
  containsCjkCharacters,
  validatePluginRegistry,
} from '../../src/client/plugin-host/api.ts'
import { PluginConfigStore } from '../../src/client/plugin-host/plugin-config-store.ts'
import {
  PluginHost,
  type PluginHostToolbarPort,
  type ToolbarContributionSpec,
} from '../../src/client/plugin-host/plugin-host.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import type {
  D2OnlineFlow,
  GameCreateSpec,
  GameServerAdapter,
  ServerEvent,
} from '../../src/netproto/index.ts'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

function createMockGameAdapter(initialEvents: readonly ServerEvent[] = []): GameServerAdapter {
  const listeners = new Set<(ev: ServerEvent) => void>()
  let attached = false
  return {
    state: 'ingame',
    stats: {
      rttMs: 24,
      bytesIn: 0,
      bytesOut: 0,
      packetsIn: 0,
      packetsOut: 0,
      unknownPackets: 0,
      opaquePackets: 0,
      protocolErrors: 0,
    },
    onEvent(cb) {
      listeners.add(cb)
      if (!attached) {
        attached = true
        for (const ev of initialEvents) {
          cb(ev)
        }
      }
      return () => {
        listeners.delete(cb)
      }
    },
    onClose() {
      return () => {}
    },
    send() {},
    leave() {},
  }
}

describe('next-game plugin (+1 seamless room switcher)', () => {
  it('increments room numbers while preserving zero-padding and 15-character limit', () => {
    expect(incrementGameName('baal-01')).toBe('baal-02')
    expect(incrementGameName('baal-09')).toBe('baal-10')
    expect(incrementGameName('baal-99')).toBe('baal-100')
    expect(incrementGameName('mf1')).toBe('mf2')
    expect(incrementGameName('cow')).toBe('cow1')
    expect(incrementGameName('1')).toBe('2')
    expect(incrementGameName('')).toBe('game1')
    // 15-char cap check: "abcdefghijklm99" (15 chars) -> "abcdefghijkl100" (15 chars)
    const capped = incrementGameName('abcdefghijklm99')
    expect(capped).toBe('abcdefghijkl100')
    expect(capped.length).toBeLessThanOrEqual(15)
  })

  it('registers toolbar button with label "+1" and passes bilingual validation', async () => {
    expect(() => validatePluginRegistry([nextGamePlugin])).not.toThrow()
    expect(containsCjkCharacters(nextGamePlugin.name.en)).toBe(false)
    expect(containsCjkCharacters(nextGamePlugin.description.en)).toBe(false)

    const settingsStore = new SettingsStore({
      storage: new MemoryStorage(),
      defaultLang: 'zh',
      syncGlobalLang: false,
    })
    const session = new OnlineSession({ settingsStore, leaseStorage: null })
    const buttons = new Map<string, Extract<ToolbarContributionSpec, { kind: 'button' }>>()
    const toolbarPort: PluginHostToolbarPort = {
      setPluginsButtonState() {},
      addContribution(spec) {
        if (spec.kind === 'button') {
          buttons.set(spec.domId, spec)
        }
        return () => {
          buttons.delete(spec.domId)
        }
      },
    }

    const plugin = createNextGamePlugin({ settleDelayMs: 0, retryDelayMs: 0 })
    const configStore = new PluginConfigStore([plugin], { storage: new MemoryStorage() })
    const host = new PluginHost({
      plugins: [plugin],
      configStore,
      session,
      toolbar: toolbarPort,
      settingsStore,
      autoStart: false,
    })

    await host.start()

    const btn = buttons.get(NEXT_GAME_TOOLBAR_BUTTON_ID)
    expect(btn).toBeDefined()
    expect(btn?.label).toEqual({ zh: '+1', en: '+1' })

    // Clicking while not in game sets a friendly warning status without throwing
    btn?.onClick()
    const warnStatus = host.getStatus(NEXT_GAME_PLUGIN_ID)
    expect(warnStatus.level).toBe('warn')
    expect(containsCjkCharacters(warnStatus.text.en)).toBe(false)

    // Disabling removes the "+1" toolbar button
    await host.setEnabled(NEXT_GAME_PLUGIN_ID, false)
    expect(buttons.has(NEXT_GAME_TOOLBAR_BUTTON_ID)).toBe(false)

    await host.destroy()
    session.destroy()
  })

  it('leaves current game, increments room +1, retries transient CHARLOCKED, and teleports directly to current Act town without entering lobby phase', async () => {
    const createdSpecs: GameCreateSpec[] = []
    const joinedGames: Array<{ name: string; password: string }> = []
    let leaveToLobbyCount = 0
    let joinAttemptsForGame2 = 0

    const mockFlow: D2OnlineFlow = {
      state: 'idle',
      sessionLost: null,
      onState: () => () => {},
      onSessionLost: () => () => {},
      async connectBnet() {},
      async connect() {},
      async loginOrRegister() {},
      onChannelEvent: () => () => {},
      onChatEvent: () => () => {},
      async createAccount() {},
      async login() {},
      async listRealms() {
        return [{ id: 1, title: 'D2CS', description: 'Realm' }]
      },
      async enterRealm() {
        return [
          {
            name: 'SorcRunner',
            charClass: 1,
            level: 88,
            act: 3,
            difficulty: 2,
            hardcore: false,
            expansion: true,
            ladder: true,
            dead: false,
            expiresAt: 0,
            equipmentGraphics: new Uint8Array(0),
            rawStatString: new Uint8Array(0),
          },
        ]
      },
      async realmLogon() {
        return []
      },
      async listCharacters() {
        return []
      },
      async listChars() {
        return []
      },
      async createCharacter() {},
      async createChar() {},
      async deleteCharacter() {},
      async deleteChar() {},
      async upgradeCharacter() {},
      async upgradeChar() {},
      async selectCharacter() {},
      async charLogon() {},
      async listGames() {
        return []
      },
      async getGameInfo() {
        throw new Error('not used')
      },
      async createGame(spec) {
        createdSpecs.push(spec)
      },
      async joinGame(name, password = '') {
        joinedGames.push({ name, password })
        if (name === 'meph-01') {
          return createMockGameAdapter([
            {
              type: 'GameFlags',
              difficulty: 2,
              hardcore: false,
              expansion: true,
              ladder: true,
            },
            {
              type: 'LoadAct',
              act: 2, // 0-based Act 3
              mapSeed: 0x11112222,
              areaId: 102, // Durance of Hate Level 3
            },
            {
              type: 'UnitAssign',
              isSelf: true,
              unit: {
                unitType: 0,
                id: 1,
                classId: 1,
                name: 'SorcRunner',
                x: 17560,
                y: 8068,
              },
            },
          ])
        }
        // Simulate transient PvPGN d2dbs CHARLOCKED (0xB4 reason=0x06) on the first attempt of meph-02
        joinAttemptsForGame2++
        if (joinAttemptsForGame2 === 1) {
          const err = Object.assign(
            new Error('Unable to enter game: character is already in a game, reason=0x06'),
            { packetId: 0xb4 },
          )
          throw err
        }
        // Second attempt succeeds and spawns the player in Act 3 Town (Kurast Docks, areaId 75)
        return createMockGameAdapter([
          {
            type: 'GameFlags',
            difficulty: 2,
            hardcore: false,
            expansion: true,
            ladder: true,
          },
          {
            type: 'LoadAct',
            act: 2, // 0-based Act 3
            mapSeed: 0x33334444,
            areaId: 75, // Kurast Docks (Act 3 Town)
          },
          {
            type: 'UnitAssign',
            isSelf: true,
            unit: {
              unitType: 0,
              id: 1,
              classId: 1,
              name: 'SorcRunner',
              x: 5160,
              y: 5060,
            },
          },
          {
            type: 'UnitReassign',
            unitType: 0,
            id: 1,
            at: {
              x: 5160,
              y: 5060,
            },
            snap: true,
          },
        ])
      },
      async enterChat() {},
      async joinChannel() {},
      async sendChannelChat() {},
      async sendChat() {},
      async leaveToLobby() {
        leaveToLobbyCount++
      },
      async close() {},
    }

    const settingsStore = new SettingsStore({
      storage: new MemoryStorage(),
      defaultLang: 'zh',
      syncGlobalLang: false,
    })
    const session = new OnlineSession({
      settingsStore,
      leaseStorage: null,
      flowFactory: () => mockFlow,
    })

    await session.login({ username: 'hero', password: 'pw' })
    await session.selectCharacter('SorcRunner')
    await session.enterGame({
      mode: 'create',
      spec: {
        name: 'meph-01',
        password: '123',
        description: 'runs',
        difficulty: 2,
        maxPlayers: 8,
        levelDiff: 0xff,
      },
    })

    expect(session.phase).toBe('ingame')
    expect(session.getSnapshot().activeGameName).toBe('meph-01')
    expect(session.world.areaId).toBe(102)
    expect(session.world.self.x).toBe(17560)
    expect(session.world.self.y).toBe(8068)

    // Track every phase change emitted while switching from meph-01 -> meph-02
    const observedPhases: string[] = []
    session.onStateChange((snap) => {
      observedPhases.push(snap.phase)
    })

    let clickHandler: (() => void) | undefined
    const plugin = createNextGamePlugin({
      settleDelayMs: 0,
      retryDelayMs: 1,
      maxJoinAttempts: 3,
    })
    const host = new PluginHost({
      plugins: [plugin],
      configStore: new PluginConfigStore([plugin], { storage: new MemoryStorage() }),
      session,
      toolbar: {
        setPluginsButtonState() {},
        addContribution(spec) {
          if (spec.kind === 'button' && spec.domId === NEXT_GAME_TOOLBAR_BUTTON_ID) {
            clickHandler = spec.onClick
          }
          return () => {}
        },
      },
      settingsStore,
      autoStart: false,
    })

    await host.start()
    expect(clickHandler).toBeDefined()

    const inst = host.getInstance<NextGamePluginInstance>(NEXT_GAME_PLUGIN_ID)
    expect(inst).not.toBeNull()

    const nextRoom = await inst!.stepToNextGame()
    expect(nextRoom).toBe('meph-02')
    expect(leaveToLobbyCount).toBe(1)
    expect(joinAttemptsForGame2).toBe(2)
    expect(createdSpecs.at(-1)?.name).toBe('meph-02')
    expect(createdSpecs.at(-1)?.difficulty).toBe(2)

    // Crucial: session NEVER entered 'lobby' or 'entering-game', preventing any lobby UI flash!
    expect(observedPhases).not.toContain('lobby')
    expect(session.phase).toBe('ingame')
    expect(session.getSnapshot().activeGameName).toBe('meph-02')

    // Player is now standing in Act 3 Town (Kurast Docks, areaId 75) at (5160, 5060)
    expect(session.world.areaId).toBe(75)
    expect(session.world.self.x).toBe(5160)
    expect(session.world.self.y).toBe(5060)

    const status = host.getStatus(NEXT_GAME_PLUGIN_ID)
    expect(status.level).toBe('ok')
    expect(status.text.zh).toContain('meph-02')
    expect(containsCjkCharacters(status.text.en)).toBe(false)

    await host.destroy()
    session.destroy()
  })
})

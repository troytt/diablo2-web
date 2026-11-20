/**
 * Issue #1324 — Single Player shares the Battle.net in-game `OnlineSession` lifecycle.
 *
 * Only the `GameServerAdapter` differs (`LocalLoopbackAdapter` vs D2GS):
 * 1. every attach of a new standalone adapter runs the full 1.13c game-init reset (also after
 *    `leaveGame` cleared the previous adapter);
 * 2. the local server is stepped by `OnlineSession.tick` (one 25 Hz tick line, pause-aware);
 * 3. the selected local character is bound to the session, so S2C `0x61 07` (`completeGame`) works
 *    offline and writes the progression back into the local `.d2s` via `LocalLobbyProvider`;
 * 4. leaving on purpose (save-and-exit, C2S `0x69` LeaveGame) never reports a lost session.
 */

import { describe, expect, it, vi } from 'vitest'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { LocalLobbyProvider, LocalLoopbackAdapter } from '../../src/server/loopback-adapter.ts'
import { readD2sSave113c } from '../../src/server/save/d2s-reader.ts'
import type { GameServerAdapter } from '../../src/netproto/index.ts'

async function enterLocalGame(
  session: OnlineSession,
  lobby: LocalLobbyProvider,
  charName: string,
): Promise<LocalLoopbackAdapter> {
  const adapter = await lobby.enterGame({ charName, difficulty: 0 })
  const characters = await lobby.listCharacters()
  session.attachGameServer(adapter, {
    localCharacter: {
      characters,
      selectedName: charName,
      writeProgression: (name, progression) => lobby.writeCharacterProgression(name, progression),
    },
  })
  session.tick(40, 40)
  return adapter
}

async function newLobbyWithHero(name = 'SpHero'): Promise<LocalLobbyProvider> {
  const lobby = new LocalLobbyProvider()
  await lobby.createCharacter({ name, classId: 4 })
  return lobby
}

describe('Issue #1324 — Single Player in-game lifecycle runs through OnlineSession', () => {
  it('re-entering a local game after leaveGame runs the full game-init reset', async () => {
    const lobby = await newLobbyWithHero()
    const session = new OnlineSession()
    const internals = session as unknown as {
      weather: { onGameInit: () => void }
      questFx: { resetForNewGame: () => void }
      clientActLoaded: boolean
      lastObjectLightBuildFrame: number
    }
    const weatherInit = vi.spyOn(internals.weather, 'onGameInit')
    const questFxReset = vi.spyOn(internals.questFx, 'resetForNewGame')
    const audioInit = vi.spyOn(session.audioRuntime, 'gameInit')
    const lost: string[] = []
    session.onSessionLost((ev) => lost.push(ev.reason))

    const first = await enterLocalGame(session, lobby, 'SpHero')
    expect(session.phase).toBe('ingame')
    expect(session.world.entities.has(first.playerUnitId)).toBe(true)
    expect(weatherInit).toHaveBeenCalledTimes(1)
    expect(questFxReset).toHaveBeenCalledTimes(1)
    expect(audioInit).toHaveBeenCalledTimes(1)

    await session.leaveGame()
    expect(session.phase).toBe('idle')
    expect(first.state).toBe('closed')

    // Stale per-game client state left over from the first game.
    internals.clientActLoaded = true
    internals.lastObjectLightBuildFrame = 1234
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 1, id: 777, classId: 5, x: 5000, y: 5000 },
    } as never)
    expect(session.world.entities.size).toBeGreaterThan(0)

    const second = await lobby.enterGame({ charName: 'SpHero', difficulty: 0 })
    session.attachGameServer(second, {
      localCharacter: {
        characters: await lobby.listCharacters(),
        selectedName: 'SpHero',
        writeProgression: (n, p) => lobby.writeCharacterProgression(n, p),
      },
    })
    // The reset ran before any event of the second game was processed.
    expect(weatherInit).toHaveBeenCalledTimes(2)
    expect(questFxReset).toHaveBeenCalledTimes(2)
    expect(audioInit).toHaveBeenCalledTimes(2)
    expect(internals.lastObjectLightBuildFrame).toBe(0)
    expect(internals.clientActLoaded).toBe(false)
    expect(session.world.entities.size).toBe(0)
    expect(session.world.self.name).toBe('SpHero')
    expect(session.selectedChar).toBe('SpHero')

    session.tick(40, 80)
    expect(session.world.entities.has(second.playerUnitId)).toBe(true)
    await session.leaveGame()
    expect(lost).toEqual([])
  })

  it('OnlineSession.tick steps the local game server (no second tick line in main.ts)', async () => {
    const lobby = await newLobbyWithHero()
    const session = new OnlineSession()
    const adapter = await enterLocalGame(session, lobby, 'SpHero')
    const game = adapter.getGameInstance()

    const before = game.tickCount
    session.tick(40, 120)
    session.tick(40, 160)
    expect(game.tickCount).toBe(before + 2)

    // Paused local game: the adapter only runs its pause frame and drops the owed time.
    adapter.setPaused(true)
    const tickSpy = vi.spyOn(adapter, 'tick')
    session.tick(40, 200)
    expect(tickSpy).toHaveBeenCalledWith(40)
    expect(adapter.isPaused()).toBe(true)

    await session.leaveGame()
    tickSpy.mockClear()
    session.tick(40, 240)
    expect(tickSpy).not.toHaveBeenCalled()
  })

  it('S2C 0x61 07 completes the offline game and writes the progression into the local .d2s', async () => {
    const lobby = await newLobbyWithHero()
    const session = new OnlineSession()
    session.hudManager.resize(800, 600)
    const lost: string[] = []
    session.onSessionLost((ev) => lost.push(ev.reason))
    const adapter = await enterLocalGame(session, lobby, 'SpHero')
    expect(session.world.difficulty).toBe(0)

    session.handleServerEvent({ type: 'CanGoToAct', act: 7 })
    await Promise.resolve()

    expect(lost).toEqual([])
    expect(session.phase).toBe('idle')
    expect(adapter.state).toBe('closed')
    const completion = session.takeGameCompletion()
    expect(completion).toMatchObject({ showVictoryScreen: true, newProgression: 5, nameLine: 'SpHero' })
    // 0x6faf52fd progression (normal: 0*4+5) persisted into the local save header (+0x25).
    const saved = readD2sSave113c((await lobby.exportCharacterD2s('SpHero'))!)
    expect(saved.progression).toBe(5)
    const summary = (await lobby.listCharacters()).find((c) => c.name === 'SpHero')
    expect(summary?.progression).toBe(5)
  })

  it('rejects a local character context that does not name a listed character', async () => {
    const lobby = await newLobbyWithHero()
    const session = new OnlineSession()
    const adapter = await lobby.enterGame({ charName: 'SpHero', difficulty: 0 })
    const characters = await lobby.listCharacters()
    expect(() =>
      session.attachGameServer(adapter, {
        localCharacter: {
          characters,
          selectedName: 'Nobody',
          writeProgression: () => {},
        },
      }),
    ).toThrow(/Nobody/)
    adapter.leave()
  })

  it('C2S LeaveGame and save-and-exit leave the local game without a lost session', async () => {
    const lobby = await newLobbyWithHero()
    const session = new OnlineSession()
    const lost: string[] = []
    session.onSessionLost((ev) => lost.push(ev.reason))

    const first = await enterLocalGame(session, lobby, 'SpHero')
    expect(session.sendCommand({ type: 'LeaveGame' })).toBe(true)
    await Promise.resolve()
    expect(first.state).toBe('closed')
    expect(session.phase).toBe('idle')
    expect(lost).toEqual([])

    const second = await enterLocalGame(session, lobby, 'SpHero')
    session.hudManager.onEscapeMenuAction?.('saveAndExit')
    await Promise.resolve()
    expect(second.state).toBe('closed')
    expect(session.phase).toBe('idle')
    expect(lost).toEqual([])
  })

  it('an intentional leave ignores the adapter close it causes, an unexpected close is still a loss', async () => {
    const session = new OnlineSession()
    const lost: string[] = []
    session.onSessionLost((ev) => lost.push(ev.reason))
    const closeListeners = new Set<(reason: { kind: 'local' }) => void>()
    const makeAdapter = (): GameServerAdapter & { closeNow: () => void } => {
      let state: GameServerAdapter['state'] = 'ingame'
      const closeNow = (): void => {
        state = 'closed'
        for (const cb of [...closeListeners]) cb({ kind: 'local' })
      }
      return {
        get state() {
          return state
        },
        send: () => {},
        onEvent: () => () => {},
        onClose: (cb) => {
          closeListeners.add(cb as (reason: { kind: 'local' }) => void)
          return () => closeListeners.delete(cb as (reason: { kind: 'local' }) => void)
        },
        leave: closeNow,
        closeNow,
        stats: { unknownPackets: 0, opaquePackets: 0, rttMs: null, bytesIn: 0, bytesOut: 0 },
      }
    }

    session.attachGameServer(makeAdapter())
    await session.leaveGame()
    expect(lost).toEqual([])
    expect(session.phase).toBe('idle')

    const crashed = makeAdapter()
    session.attachGameServer(crashed)
    crashed.closeNow()
    expect(lost).toHaveLength(1)
    expect(session.phase).toBe('disconnected')
  })
})

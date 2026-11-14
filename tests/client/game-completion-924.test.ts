/**
 * Issue #924 — killing Baal and entering Tyrael's "Destruction's End" portal ends the game (1.13c).
 *
 * Packet sequence (D2Game.dll 0x6fc7fd00 LastPortal operate, see kb/quests/a5q6-game-completion-113c.md):
 *   server: warp to Harrogath (level 109), save, bBusy = 1, S2C `61 07`
 *   client (D2Client 0x6fb5f940 -> 0x6fb399a0(7)): [D2X_OUT Bink] -> C2S `48` -> C2S `69` LeaveGame
 *   -> after the game loop: progression rewrite + victory screen 0x6faf3a70 -> lobby.
 */

import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import {
  CINEMATIC_BINK_NAMES_113C,
  CINEMATIC_COUNT_113C,
  CINEMATIC_GAME_COMPLETE_113C,
  characterTitle113c,
  computeGameCompletion113c,
} from '../../src/client/session/game-completion-113c.ts'
import { decode0x61CanGoToAct } from '../../src/netproto/index.ts'
import type { CharSummary } from '../../src/netproto/domain/lobby.ts'

function charSummary(overrides: Partial<CharSummary> = {}): CharSummary {
  return {
    name: 'Hero',
    charClass: 4,
    level: 90,
    hardcore: false,
    dead: false,
    expansion: true,
    ladder: false,
    act: 5,
    difficulty: 2,
    progression: 10,
    expiresAt: 0,
    equipmentGraphics: new Uint8Array(9),
    rawStatString: new Uint8Array(33),
    ...overrides,
  }
}

/** OnlineSession in game with a realm character list (no live flow), recording C2S and leave calls. */
function sessionInGame(char: CharSummary, difficulty: 0 | 1 | 2) {
  const session = new OnlineSession()
  session.hudManager.resize(800, 600)
  const internals = session as unknown as {
    charactersValue: readonly CharSummary[]
    selectedCharValue: string | null
    leaveGame: () => Promise<void>
  }
  internals.charactersValue = [char]
  internals.selectedCharValue = char.name
  let leaveCalls = 0
  internals.leaveGame = async () => {
    leaveCalls++
  }
  session.world.difficulty = difficulty
  session.handleServerEvent({ type: 'LoadAct', act: 4, mapSeed: 0x11223344, areaId: 109 })
  session.handleServerEvent({
    type: 'UnitAssign',
    isSelf: true,
    unit: { unitType: 0, id: 1, classId: char.charClass, name: char.name, x: 5000, y: 5000 },
  })
  return {
    session,
    leaveCalls: () => leaveCalls,
    characters: () => internals.charactersValue,
  }
}

describe('Issue #924 — S2C 0x61 07 game completion', () => {
  it('decodes the 2-byte S2C 0x61 packet; its byte indexes the 8-entry D2Client cinematic table', () => {
    const ev = decode0x61CanGoToAct(new Uint8Array([0x61, 0x07]))
    expect(ev).toMatchObject({ type: 'CanGoToAct', act: 7 })
    expect(CINEMATIC_COUNT_113C).toBe(8)
    expect(CINEMATIC_BINK_NAMES_113C).toHaveLength(8)
    expect(CINEMATIC_BINK_NAMES_113C[CINEMATIC_GAME_COMPLETE_113C]).toBe('D2X_OUT_%s.BIK')
    expect(CINEMATIC_BINK_NAMES_113C[5]).toBe('ACT04END%s.BIK')
  })

  it('61 07 → C2S 0x48 then leaves the game, records the completion and rewrites the cached progression', () => {
    const h = sessionInGame(charSummary({ progression: 10 }), 2)
    h.session.handleServerEvent({ type: 'CanGoToAct', act: 7 })

    const sent = h.session.getSentCommands()
    expect(sent.filter((c) => c.type === 'CancelController')).toHaveLength(1)
    expect(h.leaveCalls()).toBe(1)
    // 0x6faf52fd: progression := difficulty * 4 + 5
    expect(h.characters()[0]!.progression).toBe(13)

    const completion = h.session.takeGameCompletion()
    expect(completion).toEqual({
      showVictoryScreen: true,
      newProgression: 13,
      nameLine: 'Hero',
      titleLine: 'Patriarch Hero',
    })
    // Handed out once.
    expect(h.session.takeGameCompletion()).toBeNull()
  })

  it('other cinematic indices keep the game running and only send C2S 0x48', () => {
    // One session per index: the 1.13c SendPacket dedupe (0x6fac43e0) drops byte-identical repeats.
    for (const act of [0, 1, 2, 3, 4, 5, 6]) {
      const h = sessionInGame(charSummary(), 0)
      h.session.handleServerEvent({ type: 'CanGoToAct', act })
      expect(h.session.getSentCommands().filter((c) => c.type === 'CancelController')).toHaveLength(1)
      expect(h.leaveCalls()).toBe(0)
      expect(h.session.takeGameCompletion()).toBeNull()
      expect(h.characters()[0]!.progression).toBe(10)
    }
  })

  it('an index >= 8 is the D2Client 0x6fb399b3 FatalAssert: the session ends without sending 0x48', () => {
    const h = sessionInGame(charSummary(), 0)
    const lost: string[] = []
    h.session.onSessionLost((ev) => lost.push(ev.reason))
    h.session.handleServerEvent({ type: 'CanGoToAct', act: 8 })
    expect(lost).toHaveLength(1)
    expect(lost[0]).toContain('cinematic index 8')
    expect(h.session.getSentCommands().some((c) => c.type === 'CancelController')).toBe(false)
  })
})

describe('Issue #924 — D2Client 0x6faf52b3 victory gate and D2Win #10205 titles', () => {
  it('shows the victory screen unless normal has old progression 8/12 or nightmare has 12', () => {
    const c = (progression: number) => ({
      name: 'X',
      charClass: 0 as const,
      hardcore: false,
      expansion: true,
      progression,
    })
    expect(computeGameCompletion113c(0, c(0)).showVictoryScreen).toBe(true)
    expect(computeGameCompletion113c(0, c(5)).showVictoryScreen).toBe(true)
    expect(computeGameCompletion113c(0, c(8)).showVictoryScreen).toBe(false)
    expect(computeGameCompletion113c(0, c(12)).showVictoryScreen).toBe(false)
    expect(computeGameCompletion113c(1, c(8)).showVictoryScreen).toBe(true)
    expect(computeGameCompletion113c(1, c(12)).showVictoryScreen).toBe(false)
    expect(computeGameCompletion113c(2, c(12)).showVictoryScreen).toBe(true)
    expect(computeGameCompletion113c(2, c(15)).showVictoryScreen).toBe(true)
    expect([0, 1, 2].map((d) => computeGameCompletion113c(d, c(0)).newProgression)).toEqual([5, 9, 13])
    expect(() => computeGameCompletion113c(3, c(0))).toThrow()
  })

  it('builds the title line from the game difficulty (Slayer / Champion / Patriarch|Matriarch, hardcore tiers)', () => {
    const line = (difficulty: number, charClass: 0 | 1 | 2 | 3 | 4 | 5 | 6, hardcore: boolean) =>
      computeGameCompletion113c(difficulty, { name: 'Ann', charClass, hardcore, expansion: true, progression: 0 })
        .titleLine
    expect(line(0, 4, false)).toBe('Slayer Ann')
    expect(line(1, 4, false)).toBe('Champion Ann')
    expect(line(2, 4, false)).toBe('Patriarch Ann')
    expect(line(2, 0, false)).toBe('Matriarch Ann')
    expect(line(2, 6, false)).toBe('Matriarch Ann')
    expect(line(0, 1, true)).toBe('Destroyer Ann')
    expect(line(1, 1, true)).toBe('Conqueror Ann')
    expect(line(2, 1, true)).toBe('Guardian Ann')
  })

  it('ports D2Win #10205 thresholds for classic characters too', () => {
    expect(characterTitle113c(4, 3, false, false)).toBe('')
    expect(characterTitle113c(4, 4, false, false)).toBe('Sir ')
    expect(characterTitle113c(0, 4, false, false)).toBe('Dame ')
    expect(characterTitle113c(2, 8, false, false)).toBe('Lord ')
    expect(characterTitle113c(1, 12, false, false)).toBe('Baroness ')
    expect(characterTitle113c(3, 12, true, false)).toBe('King ')
    expect(characterTitle113c(1, 12, true, false)).toBe('Queen ')
    expect(characterTitle113c(4, 4, false, true)).toBe('')
    expect(characterTitle113c(4, 9, false, true)).toBe('Slayer ')
  })
})

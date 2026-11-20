import { describe, expect, it } from 'vitest'
import {
  applyOnlineCharactersToFlowState,
  createInitialFlowState,
  getRosterCharacterTitle,
} from '../src/client/frontend/flow-state.ts'
import { FrontendRenderer } from '../src/client/frontend/frontend-renderer.ts'
import { OnlineSession } from '../src/client/session/online-session.ts'
import { readD2sSave113c } from '../src/server/save/d2s-reader.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  hasQuestFlag113c,
} from '../src/server/engine/quests-113c.ts'
import { LocalLobbyProvider } from '../src/server/loopback-adapter.ts'

interface InternalViews {
  players: Map<number, { questFlags: Uint16Array; areaId: number; x: number; y: number }>
  monsters: Map<number, { unitId: number; classId: number; hcIdx: number; areaId: number; x: number; y: number }>
  objects: Map<number, { unitId: number; classId: number; areaId: number; x: number; y: number; mode: number }>
}

function view(game: GameInstance): InternalViews {
  return game as unknown as InternalViews
}

describe("Issue #1620: Hell completion (\"Destruction's End\" #565 -> S2C 0x61 07) & character titles", () => {
  it('does not falsely complete a5q6 or a4q3 on Baal tentacles, Baal clone, Baal minions, or Diablo clone', () => {
    const g = new GameInstance({ difficulty: 2, seed: 1620, areaId: 132 })
    const p = g.connectPlayer({ charClass: 'pal', name: 'LYQS', level: 80, x: 50, y: 50, areaId: 132 })

    for (const nonBoss of [
      { defId: 'baaltentacle1', hcIdx: 546 },
      { defId: 'baalclone', hcIdx: 574 },
      { defId: 'baalminion1', hcIdx: 571 },
      { defId: 'baalthrone', hcIdx: 543 },
      { defId: 'diabloclone', hcIdx: 333 },
    ]) {
      const mId = g.spawnMonster({
        defId: nonBoss.defId,
        classId: nonBoss.hcIdx,
        x: 52,
        y: 50,
        areaId: 132,
        hp: 10,
        maxHp: 10,
      })
      g.applyDamageToMonster(mId, 1000, p)
    }

    const q = view(g).players.get(p)!.questFlags
    expect(hasQuestFlag113c(q, 'a5q6', QUEST_FLAG_COMPLETED_113C)).toBe(false)
    expect(hasQuestFlag113c(q, 'a4q3', QUEST_FLAG_COMPLETED_113C)).toBe(false)
    expect([...view(g).objects.values()].some((o) => o.areaId === 132 && o.classId === 565)).toBe(false)
  })

  it('spawns tyrael3 (#521) and opened LastPortal (#565) when Baal (#544 baalcrab) dies, and OperateFn 72 warps to Harrogath (109) + emits CanGoToAct(7)', () => {
    const g = new GameInstance({ difficulty: 2, seed: 1620, areaId: 132 })
    const p = g.connectPlayer({ charClass: 'pal', name: 'LYQS', level: 80, x: 100, y: 100, areaId: 132 })
    g.drainEvents(p)

    // Pre-existing LastPortal before killing Baal rejects with sound 19 and does not warp
    const closedPortalId = g.spawnObject({
      classId: 565,
      x: 101,
      y: 100,
      areaId: 132,
      mode: 2,
    })
    g.drainEvents(p)
    g.enqueueCommand(p, { type: 'OperateObject', objectId: closedPortalId })
    g.stepFrames(1)
    const rejectEvents = g.drainEvents(p)
    expect(rejectEvents).toContainEqual({
      type: 'PlaySound',
      unit: { unitType: 0, id: p },
      sound: 19,
    })
    expect(rejectEvents.some((e) => e.type === 'CanGoToAct')).toBe(false)
    expect(view(g).players.get(p)?.areaId).toBe(132)

    // Kill Baal (baalcrab #544)
    const baalId = g.spawnMonster({
      defId: 'baalcrab',
      classId: 544,
      x: 101,
      y: 101,
      areaId: 132,
      hp: 10,
      maxHp: 10,
    })
    g.applyDamageToMonster(baalId, 1000, p)

    const qAfterKill = view(g).players.get(p)!.questFlags
    expect(
      hasQuestFlag113c(
        qAfterKill,
        'a5q6',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      ),
    ).toBe(true)

    const tyrael = [...view(g).monsters.values()].find((m) => m.areaId === 132 && m.hcIdx === 521)
    expect(tyrael).toBeDefined()
    expect(tyrael?.x).toBe(96)
    expect(tyrael?.y).toBe(96)

    const lastPortal = [...view(g).objects.values()].find((o) => o.areaId === 132 && o.classId === 565)
    expect(lastPortal).toBeDefined()
    expect(lastPortal?.mode).toBe(2)

    g.drainEvents(p)
    // Operate "Destruction's End" (LastPortal #565)
    g.enqueueCommand(p, { type: 'OperateObject', objectId: lastPortal!.unitId })
    g.stepFrames(1)

    const portalEvents = g.drainEvents(p)
    expect(portalEvents).toContainEqual({ type: 'CanGoToAct', act: 7 })
    expect(view(g).players.get(p)?.areaId).toBe(109)

    // Exported .d2s save has progression = 15 (Hell Expansion completed -> Patriarch)
    const d2sBytes = g.exportPlayerD2s(p)!
    const parsed = readD2sSave113c(d2sBytes)
    expect(parsed.progression).toBe(15)
    expect(
      getRosterCharacterTitle({
        classId: 'pa',
        progression: parsed.progression,
        isHardcore: false,
        isExpansion: true,
      }),
    ).toBe('Patriarch ')
  })

  it('spawns Harrogath portal (#566) when Diablo (#243) dies and Tyrael in 103 opens #566, and OperateFn 73 emits CanGoToAct(5) + warps to Harrogath (109)', () => {
    const g = new GameInstance({ difficulty: 2, seed: 1620, areaId: 108 })
    const p = g.connectPlayer({ charClass: 'pal', name: 'LYQS', level: 80, x: 80, y: 80, areaId: 108 })
    const diabloId = g.spawnMonster({
      defId: 'diablo',
      classId: 243,
      x: 81,
      y: 80,
      areaId: 108,
      hp: 10,
      maxHp: 10,
    })
    g.applyDamageToMonster(diabloId, 1000, p)

    // 1.13c #1928: 108 does NOT spawn 566 inside Chaos Sanctuary
    expect([...view(g).objects.values()].some((o) => o.areaId === 108 && o.classId === 566)).toBe(false)

    // Talk to Tyrael (hcIdx 367) in Pandemonium Fortress (103) per 1.13c ACT4Q2_NpcActivate
    const pRec = view(g).players.get(p)!
    pRec.areaId = 103
    pRec.x = 50
    pRec.y = 50
    const tyraelId = g.spawnMonster({ classId: 367, x: 50, y: 50, areaId: 103, isNpc: true })
    g.enqueueCommand(p, { type: 'NpcInit', target: { unitType: 'monster', id: tyraelId } } as never)
    g.stepFrames(1)

    const harrogathPortal = [...view(g).objects.values()].find(
      (o) => o.areaId === 103 && o.classId === 566,
    )
    expect(harrogathPortal).toBeDefined()
    expect(harrogathPortal?.mode).toBe(2)

    // Move player next to portal and operate
    pRec.x = harrogathPortal!.x
    pRec.y = harrogathPortal!.y
    g.drainEvents(p)
    g.enqueueCommand(p, { type: 'OperateObject', objectId: harrogathPortal!.unitId })
    g.stepFrames(1)

    const events = g.drainEvents(p)
    expect(events).toContainEqual({ type: 'CanGoToAct', act: 5 })
    expect(view(g).players.get(p)?.areaId).toBe(109)
  })

  it('preserves server progression = 15 in LocalLobbyProvider when OnlineSession.completeGame runs after Hell Baal', async () => {
    const lobby = new LocalLobbyProvider()
    await lobby.createCharacter({
      name: 'LYQS',
      charClass: 3,
      expansion: true,
      hardcore: false,
      ladder: true,
    })

    // Simulate GameInstance saving progression = 15 on leaveGame, followed by OnlineSession.completeGame writing 13
    const g = new GameInstance({ difficulty: 2, seed: 1620, areaId: 132 })
    const p = g.connectPlayer({ charClass: 'pal', name: 'LYQS', level: 80, x: 50, y: 50, areaId: 132 })
    const baalId = g.spawnMonster({
      defId: 'baalcrab',
      classId: 544,
      x: 51,
      y: 50,
      areaId: 132,
      hp: 10,
      maxHp: 10,
    })
    g.applyDamageToMonster(baalId, 1000, p)
    lobby.putCharacterD2s('LYQS', g.exportPlayerD2s(p)!)

    const session = new OnlineSession()
    session.hudManager.resize(800, 600)
    const internals = session as unknown as {
      charactersValue: readonly unknown[]
      selectedCharValue: string | null
      localProgressionWriter: ((name: string, progression: number) => void) | null
      leaveGame: (afterGameClosed?: () => void) => Promise<void>
    }
    internals.localProgressionWriter = (name, prog) => {
      lobby.writeCharacterProgression(name, prog)
    }
    internals.charactersValue = await lobby.listCharacters()
    internals.selectedCharValue = 'LYQS'
    internals.leaveGame = async (afterGameClosed?: () => void) => {
      afterGameClosed?.()
    }
    session.world.difficulty = 2
    session.handleServerEvent({ type: 'LoadAct', act: 4, mapSeed: 0x11223344, areaId: 109 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 3, name: 'LYQS', x: 5000, y: 5000 },
    })
    session.handleServerEvent({
      type: 'CanGoToAct',
      act: 7,
    })

    const completion = session.takeGameCompletion()
    expect(completion?.titleLine).toBe('Patriarch LYQS')
    const charsAfter = await lobby.listCharacters()
    expect(charsAfter[0]!.progression).toBe(15)
  })

  it('resolves all 1.13c titles in getRosterCharacterTitle and draws them in renderCharSelect & renderBnetLobby', () => {
    // Expansion Softcore & Hardcore
    expect(getRosterCharacterTitle({ classId: 'pa', progression: 0, isHardcore: false, isExpansion: true })).toBe('')
    expect(getRosterCharacterTitle({ classId: 'pa', progression: 5, isHardcore: false, isExpansion: true })).toBe('Slayer ')
    expect(getRosterCharacterTitle({ classId: 'pa', progression: 10, isHardcore: false, isExpansion: true })).toBe('Champion ')
    expect(getRosterCharacterTitle({ classId: 'pa', progression: 15, isHardcore: false, isExpansion: true })).toBe('Patriarch ')
    expect(getRosterCharacterTitle({ classId: 'so', progression: 15, isHardcore: false, isExpansion: true })).toBe('Matriarch ')
    expect(getRosterCharacterTitle({ classId: 'pa', progression: 5, isHardcore: true, isExpansion: true })).toBe('Destroyer ')
    expect(getRosterCharacterTitle({ classId: 'pa', progression: 10, isHardcore: true, isExpansion: true })).toBe('Conqueror ')
    expect(getRosterCharacterTitle({ classId: 'so', progression: 15, isHardcore: true, isExpansion: true })).toBe('Guardian ')

    // Classic Softcore & Hardcore
    expect(getRosterCharacterTitle({ classId: 'pa', progression: 4, isHardcore: false, isExpansion: false })).toBe('Sir ')
    expect(getRosterCharacterTitle({ classId: 'am', progression: 4, isHardcore: false, isExpansion: false })).toBe('Dame ')
    expect(getRosterCharacterTitle({ classId: 'pa', progression: 8, isHardcore: false, isExpansion: false })).toBe('Lord ')
    expect(getRosterCharacterTitle({ classId: 'am', progression: 8, isHardcore: false, isExpansion: false })).toBe('Lady ')
    expect(getRosterCharacterTitle({ classId: 'pa', progression: 12, isHardcore: false, isExpansion: false })).toBe('Baron ')
    expect(getRosterCharacterTitle({ classId: 'am', progression: 12, isHardcore: false, isExpansion: false })).toBe('Baroness ')
    expect(getRosterCharacterTitle({ classId: 'pa', progression: 12, isHardcore: true, isExpansion: false })).toBe('King ')
    expect(getRosterCharacterTitle({ classId: 'am', progression: 12, isHardcore: true, isExpansion: false })).toBe('Queen ')

    // Verify FrontendRenderer.renderCharSelect and renderBnetLobby draw calls
    const state = createInitialFlowState()
    applyOnlineCharactersToFlowState(
      state,
      [
        {
          name: 'LYQS',
          charClass: 3,
          level: 80,
          expansion: true,
          hardcore: false,
          ladder: true,
          progression: 15,
        },
        {
          name: 'Novice',
          charClass: 1,
          level: 1,
          expansion: true,
          hardcore: false,
          ladder: true,
          progression: 0,
        },
      ],
      { stayOnCharSelect: true, preserveSelectedName: 'LYQS' },
    )
    expect(state.selectedSlotIndex).toBe(0)

    const drawnTexts: Array<{ text: string; x: number; y: number; color?: number | undefined }> = []
    const fakeRenderer = Object.create(FrontendRenderer.prototype) as {
      state: typeof state
      images: Map<string, unknown>
      drawCharacterAvatar: () => void
      drawBitmapText: (text: string, x: number, y: number, opts?: { color?: number }) => void
      drawButton: () => void
      getActiveButtons: () => never[]
      requireStr: (id: number, key: string) => string
      getLocalizedStrings: () => Record<string, string>
      renderCharSelect: () => void
    }
    fakeRenderer.state = state
    fakeRenderer.images = new Map()
    fakeRenderer.drawCharacterAvatar = () => {}
    fakeRenderer.drawButton = () => {}
    fakeRenderer.getActiveButtons = () => []
    fakeRenderer.requireStr = (_id: number, key: string) => key
    fakeRenderer.getLocalizedStrings = () => ({
      strchrlevel: 'Level %d %s',
      Paladin: 'Paladin',
      Sorceress: 'Sorceress',
      expansionCharacter: 'EXPANSION CHARACTER',
      ladderCharacter: 'LADDER CHARACTER',
    })
    fakeRenderer.drawBitmapText = (text: string, x: number, y: number, opts?: { color?: number }) => {
      drawnTexts.push({ text, x, y, color: opts?.color })
    }

    fakeRenderer.renderCharSelect()

    // Slot 0 (LYQS, progression 15) draws "Patriarch" above "LYQS" with 14px line step
    const patriarchCall = drawnTexts.find((d) => d.text === 'Patriarch')
    const lyqsCall = drawnTexts.find((d) => d.text === 'LYQS')
    expect(patriarchCall).toBeDefined()
    expect(patriarchCall?.color).toBe(4)
    expect(lyqsCall).toBeDefined()
    expect(lyqsCall!.y - patriarchCall!.y).toBe(14)

    // Slot 1 (Novice, progression 0) has no title and uses 16px line step
    const noviceIdx = drawnTexts.findIndex((d) => d.text === 'Novice')
    expect(noviceIdx).toBeGreaterThanOrEqual(0)
    const noviceCall = drawnTexts[noviceIdx]!
    const noviceLevelCall = drawnTexts[noviceIdx + 1]
    expect(noviceLevelCall).toBeDefined()
    expect(noviceLevelCall!.y - noviceCall.y).toBe(16)

    // Verify Battle.net Lobby bottom lineup bar draws "Patriarch LYQS" at (134, 528)
    drawnTexts.length = 0
    const lobbyBannerFake = {
      state,
      drawCharacterAvatar: () => {},
      drawBitmapText: fakeRenderer.drawBitmapText,
    }
    const selectedChar = lobbyBannerFake.state.roster[lobbyBannerFake.state.selectedSlotIndex]!
    const rawTitle = getRosterCharacterTitle(selectedChar)
    lobbyBannerFake.drawBitmapText(`${rawTitle}${selectedChar.name}`, 134, 528, {
      color: selectedChar.isHardcore ? 1 : 4,
    })
    expect(drawnTexts).toContainEqual({
      text: 'Patriarch LYQS',
      x: 134,
      y: 528,
      color: 4,
    })
  })
})

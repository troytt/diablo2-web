import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../src/client/session/online-session.ts'
import type { ClientCommand, ServerEvent } from '../src/netproto/index.ts'
import { LocalLobbyProvider, type LocalLoopbackAdapter } from '../src/server/index.ts'
import { testCharacterSaves } from '../tools/test-characters.ts'

const ALL_FIVE_ACTS_INTERACTIVE_NPCS: readonly {
  readonly act: number
  readonly areaId: number
  readonly classId: number
  readonly name: string
}[] = [
  // Act 1 — Rogue Encampment
  { act: 0, areaId: 1, classId: 148, name: 'Akara' },
  { act: 0, areaId: 1, classId: 154, name: 'Charsi' },
  { act: 0, areaId: 1, classId: 147, name: 'Gheed' },
  { act: 0, areaId: 1, classId: 150, name: 'Kashya' },
  { act: 0, areaId: 1, classId: 155, name: 'Warriv' },
  // Act 2 — Lut Gholein
  { act: 1, areaId: 40, classId: 178, name: 'Fara' },
  { act: 1, areaId: 40, classId: 177, name: 'Drognan' },
  { act: 1, areaId: 40, classId: 199, name: 'Elzix' },
  { act: 1, areaId: 40, classId: 202, name: 'Lysander' },
  { act: 1, areaId: 40, classId: 198, name: 'Greiz' },
  { act: 1, areaId: 40, classId: 210, name: 'Meshif' },
  // Act 3 — Kurast Docks
  { act: 2, areaId: 75, classId: 255, name: 'Ormus' },
  { act: 2, areaId: 75, classId: 253, name: 'Hratli' },
  { act: 2, areaId: 75, classId: 252, name: 'Asheara' },
  { act: 2, areaId: 75, classId: 254, name: 'Alkor' },
  { act: 2, areaId: 75, classId: 245, name: 'Deckard Cain' },
  // Act 4 — Pandemonium Fortress
  { act: 3, areaId: 103, classId: 405, name: 'Jamella' },
  { act: 3, areaId: 103, classId: 257, name: 'Halbu' },
  { act: 3, areaId: 103, classId: 367, name: 'Tyrael' },
  // Act 5 — Harrogath & Frozen River
  { act: 4, areaId: 109, classId: 513, name: 'Malah' },
  { act: 4, areaId: 109, classId: 511, name: 'Larzuk' },
  { act: 4, areaId: 109, classId: 512, name: 'Anya' },
  { act: 4, areaId: 109, classId: 515, name: 'Qual-Kehk' },
  { act: 4, areaId: 109, classId: 514, name: 'Nihlathak' },
  { act: 4, areaId: 114, classId: 527, name: 'Frozen Anya' },
]

describe('1.13c S2C 0x28 UpdateQuestInfo -> C2S 0x2F NpcInit / 0x30 NpcCancel Handshake (#1529)', () => {
  it('sends C2S 0x2F NpcInit and opens NPC interaction when S2C 0x28 unit exists in client table (0x6fafb955..0x6fafb9b7)', () => {
    const session = new OnlineSession()
    const sent: ClientCommand[] = []
    ;(session as any).gameAdapter = {
      state: 'open',
      send: (cmd: ClientCommand) => {
        sent.push(cmd)
      },
    }
    session.world.selfId = 1
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 100, y: 100, mode: 1, lifePct: 100 },
      isSelf: true,
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 42, classId: 154, x: 102, y: 102, mode: 1, lifePct: 128 },
    })

    const quests = new Uint16Array(48)
    quests[3] = 0x0002
    session.handleServerEvent({
      type: 'QuestState',
      kind: 'update',
      source: 0x28,
      updateType: 1,
      unitId: 42,
      quests,
    })

    expect(session.world.npcInteraction.npcId).toBe(42)
    expect(session.world.npcInteraction.unitType).toBe(1)
    expect(session.world.quests[3]).toBe(0x0002)
    expect(sent).toContainEqual({
      type: 'NpcInit',
      target: { unitType: 1, id: 42 },
    })
    expect(session.getSentCommands()).toContainEqual({
      type: 'NpcInit',
      target: { unitType: 1, id: 42 },
    })
  })

  it('sends C2S 0x30 NpcCancel and clears NPC interaction when S2C 0x28 unit is missing from client table (0x6fafb923..0x6fafb93f)', () => {
    const session = new OnlineSession()
    const sent: ClientCommand[] = []
    ;(session as any).gameAdapter = {
      state: 'open',
      send: (cmd: ClientCommand) => {
        sent.push(cmd)
      },
    }
    session.world.selfId = 1
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 100, y: 100, mode: 1, lifePct: 100 },
      isSelf: true,
    })
    session.world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 42, classId: 154, x: 102, y: 102, mode: 1, lifePct: 128 },
    })
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: 42 } })
    expect(session.world.npcInteraction.npcId).toBe(42)

    const quests = new Uint16Array(48).fill(0x1111)
    session.handleServerEvent({
      type: 'QuestState',
      kind: 'update',
      source: 0x28,
      updateType: 1,
      unitId: 99,
      quests,
    })

    expect(session.world.npcInteraction.npcId).toBeNull()
    expect(sent).toContainEqual({
      type: 'NpcCancel',
      target: { unitType: 1, id: 99 },
      npcId: 99,
    })
  })

  it('prevents empty vendor shop when client predicted position is in range (#10407 <= 2) while server is out of range (no S2C 0x28 yet), then opens cleanly once delayed S2C 0x28 arrives', () => {
    const session = new OnlineSession()
    session.hudManager.resize(800, 600)
    const sent: ClientCommand[] = []
    ;(session as any).gameAdapter = {
      state: 'open',
      send: (cmd: ClientCommand) => {
        sent.push(cmd)
      },
    }

    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 5008, y: 5000, mode: 5, lifePct: 100 },
    })
    const akaraId = 148
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: akaraId, classId: 148, name: 'Akara', x: 5000, y: 5000, mode: 1, lifePct: 128 },
    })
    session.handleServerEvent({
      type: 'Npc',
      kind: 'wantsInteract',
      unitType: 1,
      unitId: akaraId,
    })
    expect(session.world.getUnit('monster', akaraId)?.wantsInteract).toBe(true)

    session.predictor.setPosition(5003, 5000)
    const akara = session.world.getUnit('monster', akaraId)!

    const camera = session.camera as unknown as {
      subtileToScreen: (x: number, y: number) => { x: number; y: number }
      screenToSubtile: (x: number, y: number) => { x: number; y: number }
    }
    camera.subtileToScreen = (x: number, y: number) => ({ x: 400 + (x - 5003) * 16, y: 300 + (y - 5000) * 8 })
    camera.screenToSubtile = (x: number, y: number) => ({
      x: Math.round(5003 + (x - 400) / 16),
      y: Math.round(5000 + (y - 300) / 8),
    })

    // 1. Player clicks Akara while server has NOT confirmed range (no S2C 0x28 sent by server yet)
    session.commandMapper.setHoveredUnit(akara)
    const npcScreen = session.camera.subtileToScreen(akara.x, akara.y)
    session.commandMapper.handlePointerDown(npcScreen.x, npcScreen.y, 0, 1000)

    expect(sent.map((c) => c.type)).toEqual(['MakeEntityMove', 'Interact'])
    expect(sent.some((c) => c.type === 'NpcInit')).toBe(false)
    expect(session.world.npcInteraction.npcId).toBeNull()
    expect(session.hudManager.worldPanels.npcMenu).toBeNull()
    expect(session.world.getUnit('monster', akaraId)?.wantsInteract).toBe(true)

    // 2. Holding mouse button inside 200ms monster throttle window does NOT spam 0x59/0x13 or walk
    const sentCountAfterClick = sent.length
    session.tick(40, 1040)
    session.tick(40, 1080)
    session.tick(40, 1120)
    expect(sent.slice(sentCountAfterClick)).toEqual([])
    expect(session.predictor.getSnapshot().moving).toBe(false)
    session.commandMapper.handlePointerUp(0)

    // 3. Server walks player into range and emits authoritative S2C 0x28
    session.handleServerEvent({
      type: 'QuestState',
      kind: 'update',
      source: 0x28,
      updateType: 1,
      unitId: akaraId,
      quests: new Uint16Array(48),
    })

    expect(session.world.npcInteraction.npcId).toBe(akaraId)
    expect(session.world.getUnit('monster', akaraId)?.wantsInteract).toBe(false)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)
    expect(session.hudManager.worldPanels.npcMenu?.talking).toBe(true)
    expect(sent).toContainEqual({
      type: 'NpcInit',
      target: { unitType: 1, id: akaraId },
    })

    // 4. Dismiss quest greeting scroll, then click Trade -> sends C2S 0x38 and populates shop via S2C 0x9C (non-empty shop!)
    session.hudManager.worldPanels.closeNpcSpeech()
    expect(session.hudManager.worldPanels.clickNpcMenuOption('trade')).toBe(true)
    expect(session.world.npcInteraction.activeWindow).toBe('trade')
    session.handleServerEvent({
      type: 'ItemAction',
      action: 0x0b,
      item: {
        id: 9001,
        itemId: 9001,
        action: 0x0b,
        code: 'tsc',
        rawCode: 'tsc ',
        baseName: 'Scroll of Town Portal',
        container: 'shop',
        location: 0,
        storePage: 4,
        gridX: 0,
        gridY: 0,
        x: 0,
        y: 0,
        invWidth: 1,
        invHeight: 1,
        quality: 2,
        identified: true,
        ethereal: false,
        starterItem: false,
        isEar: false,
        simple: true,
        rawFlags: 0x10,
        version: 101,
        level: 1,
        stats: [],
        runewordStats: [],
        setStats: [],
        socketedItems: [],
      },
    } as any)
    expect(session.world.containers.shop.size).toBe(1)
  })

  it('Single-Player E2E (LocalLobbyProvider + OnlineSession): client/server position desync waits for GameInstance server walk + S2C 0x28 before opening menu and populating non-empty Charsi shop', async () => {
    const lobby = new LocalLobbyProvider({ seed: 1337 })
    await lobby.importCharacterD2s(testCharacterSaves().get('TestFireSorc')!)
    const adapter: LocalLoopbackAdapter = await lobby.enterGame({
      charName: 'TestFireSorc',
      difficulty: 0,
    })

    const session = new OnlineSession()
    session.hudManager.resize(800, 600)
    const serverEvents: ServerEvent[] = []
    adapter.onEvent((ev) => {
      serverEvents.push(ev)
      session.handleServerEvent(ev)
    })
    ;(session as any).gameAdapter = adapter

    // Drain initial join burst
    adapter.stepFrames(2)

    const player = (
      adapter.game as unknown as {
        players: Map<number, { x: number; y: number; areaId: number }>
      }
    ).players.get(adapter.playerUnitId)!
    session.world.selfId = adapter.playerUnitId

    // Spawn Charsi 8 subtiles away from authoritative server player position, while client predictor
    // believes the player is already 2 subtiles from Charsi (client/server position desync!).
    const npcX = Math.round(player.x) + 8
    const npcY = Math.round(player.y)
    const charsiId = adapter.game.spawnMonster({
      classId: 154,
      x: npcX,
      y: npcY,
      areaId: player.areaId,
      isNpc: true,
    })
    adapter.stepFrames(1)
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: charsiId,
        classId: 154,
        name: 'Charsi',
        x: npcX,
        y: npcY,
        mode: 1,
        lifePct: 128,
      },
    })

    session.predictor.setPosition(npcX - 2, npcY)
    const charsiUnit = session.world.getUnit('monster', charsiId)!

    // Click Charsi: client thinks #10407 <= 2, sends Interact (0x13), does NOT open menu before S2C 0x28
    const clickRec = session.commandMapper.triggerPrimaryWorldAction(npcX, npcY, charsiUnit, 2000)
    expect(clickRec?.command).toEqual({
      type: 'Interact',
      target: { unitType: 1, id: charsiId },
    })
    expect(session.hudManager.worldPanels.npcMenu).toBeNull()
    expect(session.world.npcInteraction.npcId).toBeNull()

    // Step server frames so GameInstance walks player into range via pendingInteraction and emits S2C 0x28
    adapter.stepFrames(10)

    expect(
      serverEvents.some(
        (ev) =>
          ev.type === 'QuestState' &&
          ev.source === 0x28 &&
          ev.updateType === 1 &&
          ev.unitId === charsiId,
      ),
    ).toBe(true)
    expect(session.world.npcInteraction.npcId).toBe(charsiId)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(charsiId)

    // Dismiss any first-meeting greeting scroll, then click Trade -> server immediately populates Charsi's shop (never empty!)
    if (session.hudManager.worldPanels.npcMenu?.talking) {
      session.hudManager.worldPanels.closeNpcSpeech()
    }
    expect(session.hudManager.worldPanels.clickNpcMenuOption('trade')).toBe(true)
    adapter.stepFrames(2)
    expect(session.world.containers.shop.size).toBeGreaterThan(0)
  })

  it('preserves active artisan window (imbue / add_sockets / personalize) and resets stale object unitType=2 on S2C 0x28 -> NpcInit', () => {
    const session = new OnlineSession()
    session.world.selfId = 1
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000, mode: 5, lifePct: 100 },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 154, classId: 154, name: 'Charsi', x: 5002, y: 5000, mode: 1, lifePct: 128 },
    })

    session.world.applyEvent({
      type: 'Npc',
      kind: 'info',
      unitType: 2,
      id: 777,
      messages: [{ stringId: 100, menuIndex: 0 }],
    } as any)
    expect(session.world.npcInteraction.unitType).toBe(2)

    session.handleServerEvent({
      type: 'QuestState',
      kind: 'update',
      source: 0x28,
      updateType: 1,
      unitId: 154,
      quests: new Uint16Array(48),
    })
    expect(session.world.npcInteraction.npcId).toBe(154)
    expect(session.world.npcInteraction.unitType).toBe(1)

    session.world.quests[3] = 0x0002
    session.hudModel.handleNpcMenuAction('imbue', 154)
    expect(session.world.npcInteraction.activeWindow).toBe('imbue')
    session.handleServerEvent({
      type: 'QuestState',
      kind: 'update',
      source: 0x28,
      updateType: 1,
      unitId: 154,
      quests: new Uint16Array(48),
    })
    expect(session.world.npcInteraction.activeWindow).toBe('imbue')
    expect(session.world.npcInteraction.window).toBe('imbue')
  })

  it('5-Act class-of-bug sweep: all 25 interactive NPCs across Acts 1-5 strictly gate NpcInit & npcMenu on S2C 0x28 for both direct click and deferred walk arrival', () => {
    for (const [idx, spec] of ALL_FIVE_ACTS_INTERACTIVE_NPCS.entries()) {
      const session = new OnlineSession()
      session.hudManager.resize(800, 600)
      const sent: ClientCommand[] = []
      ;(session as any).gameAdapter = {
        state: 'open',
        send: (cmd: ClientCommand) => {
          sent.push(cmd)
        },
      }
      const npcId = 2000 + idx
      session.handleServerEvent({ type: 'LoadAct', act: spec.act, mapSeed: 0x12345678, areaId: spec.areaId })
      session.handleServerEvent({
        type: 'UnitAssign',
        isSelf: true,
        unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000, mode: 5, lifePct: 100 },
      })
      session.handleServerEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: npcId,
          classId: spec.classId,
          name: spec.name,
          x: 5006,
          y: 5000,
          mode: 1,
          lifePct: 128,
        },
      })
      const npcUnit = session.world.getUnit('monster', npcId)!

      session.commandMapper.triggerPrimaryWorldAction(npcUnit.x, npcUnit.y, npcUnit, 1000)
      expect(session.commandMapper.getPendingNpcInteractId(), spec.name).toBe(npcId)
      expect(sent.some((c) => c.type === 'NpcInit'), spec.name).toBe(false)
      expect(session.world.npcInteraction.npcId, spec.name).toBeNull()

      session.predictor.setPosition(5004, 5000)
      session.world.self.x = 5004
      session.world.self.y = 5000
      const arrivalCmd = session.commandMapper.tick(1300)
      expect(arrivalCmd, spec.name).toEqual({
        type: 'Interact',
        target: { unitType: 1, id: npcId },
      })
      expect(sent.some((c) => c.type === 'NpcInit'), spec.name).toBe(false)
      expect(session.world.npcInteraction.npcId, spec.name).toBeNull()

      session.handleServerEvent({
        type: 'QuestState',
        kind: 'update',
        source: 0x28,
        updateType: 1,
        unitId: npcId,
        quests: new Uint16Array(48),
      })
      expect(session.world.npcInteraction.npcId, spec.name).toBe(npcId)
      expect(sent, spec.name).toContainEqual({
        type: 'NpcInit',
        target: { unitType: 1, id: npcId },
      })
    }
  })
})

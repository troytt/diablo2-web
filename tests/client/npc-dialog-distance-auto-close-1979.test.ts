/**
 * Issue #1979 — NPC dialogs (`npcMenu`, `npcSpeech`), vendor/service panels (`vendor`, `hire`,
 * `imbue`, `add_sockets`, `personalize`), and quest-object interactions (`unitType === 2` scroll
 * speech & `orifice`) automatically dismiss once the player or target moves outside D2Game's
 * 10-subtile Chebyshev interaction tether (`0x6fceccf0 -> 0x6fceb690`, `ebx = 0x0A`), while
 * staying open for any drift inside `<= 10` subtiles (#890) and preserving Quest Log speech replay.
 */

import { describe, expect, it } from 'vitest'
import {
  NPC_INTERACT_TETHER_SUBTILES_113C,
  isWithinNpcInteractTether113c,
} from '../../src/client/input/click-rules-113c.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'

const AKARA_ID = 148
const AKARA_CLASS_ID = 148
const CHARSI_ID = 154
const CHARSI_CLASS_ID = 154
const KASHYA_ID = 150
const KASHYA_CLASS_ID = 150
const MOLDY_TOME_ID = 701
const MOLDY_TOME_CLASS_ID = 72
const ORIFICE_ID = 702
const ORIFICE_CLASS_ID = 152

function createTownSession() {
  const session = new OnlineSession()
  session.hudManager.resize(800, 600)
  session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 1 })
  session.handleServerEvent({
    type: 'RoomReveal',
    tileX: 1000,
    tileY: 1000,
    areaId: 1,
  })
  session.handleServerEvent({
    type: 'UnitAssign',
    isSelf: true,
    unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 },
  })
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: {
      unitType: 1,
      id: AKARA_ID,
      classId: AKARA_CLASS_ID,
      name: 'Akara',
      x: 5003,
      y: 5000,
      lifePct: 128,
      mode: 1,
    },
  })
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: {
      unitType: 1,
      id: CHARSI_ID,
      classId: CHARSI_CLASS_ID,
      name: 'Charsi',
      x: 5003,
      y: 5002,
      lifePct: 128,
      mode: 1,
    },
  })
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: {
      unitType: 1,
      id: KASHYA_ID,
      classId: KASHYA_CLASS_ID,
      name: 'Kashya',
      x: 5002,
      y: 5003,
      lifePct: 128,
      mode: 1,
    },
  })
  const camera = session.camera as unknown as {
    subtileToScreen: (x: number, y: number) => { x: number; y: number }
    screenToSubtile: (x: number, y: number) => { x: number; y: number }
  }
  camera.subtileToScreen = (x: number, y: number) => ({
    x: 400 + (x - session.world.self.x) * 16,
    y: 300 + (y - session.world.self.y) * 8,
  })
  camera.screenToSubtile = (x: number, y: number) => ({
    x: Math.round(session.world.self.x + (x - 400) / 16),
    y: Math.round(session.world.self.y + (y - 300) / 8),
  })
  ;(session as unknown as { gameAdapter: unknown }).gameAdapter = {
    state: 'open',
    send: () => {},
  }
  return session
}

describe('Issue #1979 — NPC & quest-object 10-subtile interaction tether auto-close', () => {
  it('1. isWithinNpcInteractTether113c enforces exact Chebyshev <= 10 boundary and ignores (0,0)', () => {
    expect(NPC_INTERACT_TETHER_SUBTILES_113C).toBe(10)
    expect(isWithinNpcInteractTether113c(0, 0, 5050, 5050)).toBe(true)
    expect(isWithinNpcInteractTether113c(5000, 5000, 0, 0)).toBe(true)
    expect(isWithinNpcInteractTether113c(5000, 5000, 5010, 5010)).toBe(true)
    expect(isWithinNpcInteractTether113c(5000, 5000, 4990, 4990)).toBe(true)
    expect(isWithinNpcInteractTether113c(5000, 5000, 5011, 5000)).toBe(false)
    expect(isWithinNpcInteractTether113c(5000, 5000, 5000, 4989)).toBe(false)
  })

  it('2. auto-closes both npcMenu and npcSpeech (and stops speech audio) when player moves > 10 subtiles away', () => {
    const session = createTownSession()
    let speechCloseAudioCount = 0
    const prevOnClose = session.hudManager.worldPanels.onCloseNpcSpeech
    session.hudManager.worldPanels.onCloseNpcSpeech = () => {
      speechCloseAudioCount++
      prevOnClose?.()
    }

    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: AKARA_ID } })
    session.hudModel.syncFromWorld()
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(AKARA_ID)

    const desc = session.hudManager.worldPanels.npcMenu!.descriptor!
    session.hudManager.worldPanels.openNpcSpeech(desc, undefined, 'gossip')
    expect(session.hudManager.worldPanels.npcSpeech).not.toBeNull()
    expect(session.hudManager.worldPanels.npcSpeech?.npcId).toBe(AKARA_ID)

    // At Chebyshev = 10 from Akara (5003, 5000) -> (5013, 5010): stays open
    const beforeMove = session.getSentCommands().length
    session.predictor.setPosition(5013, 5010)
    session.tick(40, 1040)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(AKARA_ID)
    expect(session.hudManager.worldPanels.npcSpeech).not.toBeNull()

    // Move to (5014, 5010) -> |dx| = 11 > 10: both npcMenu and npcSpeech auto-close and send NpcCancel once
    session.predictor.setPosition(5014, 5010)
    session.tick(40, 1080)
    session.tick(40, 1120)
    expect(session.world.npcInteraction.npcId).toBeNull()
    expect(session.hudManager.worldPanels.npcMenu).toBeNull()
    expect(session.hudManager.worldPanels.npcSpeech).toBeNull()
    expect(speechCloseAudioCount).toBeGreaterThanOrEqual(1)
    expect(
      session
        .getSentCommands()
        .slice(beforeMove)
        .filter((c) => c.type === 'NpcCancel'),
    ).toEqual([{ type: 'NpcCancel', target: { unitType: 1, id: AKARA_ID } }])
  })

  it('3. auto-closes npcMenu when the NPC itself wanders > 10 subtiles away', () => {
    const session = createTownSession()
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: AKARA_ID } })
    session.hudModel.syncFromWorld()
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(AKARA_ID)

    const beforeWander = session.getSentCommands().length
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: AKARA_ID,
        classId: AKARA_CLASS_ID,
        name: 'Akara',
        x: 5015,
        y: 5000,
        lifePct: 128,
        mode: 1,
      },
    }) // |dx| = 15 > 10 from player (5000, 5000)
    session.tick(40, 1040)

    expect(session.world.npcInteraction.npcId).toBeNull()
    expect(session.hudManager.worldPanels.npcMenu).toBeNull()
    expect(
      session
        .getSentCommands()
        .slice(beforeWander)
        .filter((c) => c.type === 'NpcCancel'),
    ).toEqual([{ type: 'NpcCancel', target: { unitType: 1, id: AKARA_ID } }])
  })

  it('4. late S2C 0x28 QuestState arriving after player already moved > 10 subtiles away sends NpcCancel instead of NpcInit', () => {
    const session = createTownSession()
    session.predictor.setPosition(5020, 5000)
    session.world.self.x = 5020
    session.world.self.y = 5000

    const beforeHandshake = session.getSentCommands().length
    session.handleServerEvent({
      type: 'QuestState',
      kind: 'update',
      source: 0x28,
      updateType: 1,
      unitId: AKARA_ID,
      quests: new Uint16Array(48),
    })

    const sent = session.getSentCommands().slice(beforeHandshake)
    expect(sent.map((c) => c.type)).not.toContain('NpcInit')
    expect(sent.filter((c) => c.type === 'NpcCancel')).toEqual([
      { type: 'NpcCancel', target: { unitType: 1, id: AKARA_ID }, npcId: AKARA_ID },
    ])
    expect(session.hudManager.worldPanels.npcMenu).toBeNull()
  })

  it('5. auto-closes hire and artisan (imbue) panels when displaced > 10 subtiles, restoring slotted item', () => {
    const session = createTownSession()

    // Hire panel with Kashya
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: KASHYA_ID } })
    session.hudModel.syncFromWorld()
    session.hudModel.handleNpcMenuAction('hire', KASHYA_ID)
    expect(session.hudManager.leftPanel).toBe('hire')

    session.predictor.setPosition(5025, 5025)
    session.tick(40, 1040)
    expect(session.hudManager.leftPanel).toBe('none')
    expect(session.world.npcInteraction.npcId).toBeNull()

    // Imbue panel with Charsi + item in artisan slot
    session.predictor.setPosition(5000, 5000)
    session.tick(40, 1080)
    session.hudModel.openArtisanWindow('imbue', CHARSI_ID)
    const testBoots = {
      id: 9001,
      code: 'lbt',
      name: 'Boots',
      invWidth: 2,
      invHeight: 2,
      quality: 'normal',
      identified: true,
    } as any
    session.hudManager.worldPanels.questRewardItem = testBoots
    expect(session.hudManager.leftPanel).toBe('imbue')

    session.predictor.setPosition(5025, 5025)
    session.tick(40, 1120)
    expect(session.hudManager.leftPanel).toBe('none')
    expect(session.hudManager.worldPanels.questRewardItem).toBeNull()
    expect(session.hudManager.inventory.cursorItem?.id).toBe(9001)
    expect(session.hudManager.rightPanel).toBe('inv')
  })

  it('6. auto-closes object scroll speech (C2S 0x31 -1) and Horadric Orifice when moving > 10 subtiles away, while preserving Quest Log speech replay', () => {
    const session = createTownSession()
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: MOLDY_TOME_ID,
        classId: MOLDY_TOME_CLASS_ID,
        x: 5002,
        y: 5000,
        mode: 1,
      },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: ORIFICE_ID,
        classId: ORIFICE_CLASS_ID,
        x: 5000,
        y: 5002,
        mode: 0,
      },
    })

    ;(session.world.npcInteraction as any).unitType = 2
    ;(session.world.npcInteraction as any).npcId = MOLDY_TOME_ID
    session.hudManager.worldPanels.openStandaloneSpeech('', 'And so it came to pass...', {
      stringId: 2100,
      onClose: () => {
        session.world.clearObjectNpcInteraction(MOLDY_TOME_ID)
        session.hudModel.questMessage(0xffffffff, 2100)
      },
    })
    expect(session.hudManager.worldPanels.npcSpeech).not.toBeNull()

    const beforeObjMove = session.getSentCommands().length
    session.predictor.setPosition(5020, 5000) // |dx| = 18 > 10
    session.tick(40, 1040)
    expect(session.hudManager.worldPanels.npcSpeech).toBeNull()
    expect(
      session
        .getSentCommands()
        .slice(beforeObjMove)
        .some((c) => c.type === 'QuestMessage' && (c.npcId >>> 0) === 0xffffffff),
    ).toBe(true)

    // Horadric Orifice
    session.predictor.setPosition(5000, 5000)
    session.tick(40, 1080)
    ;(session.world.npcInteraction as any).unitType = 2
    session.hudModel.openArtisanWindow('orifice', ORIFICE_ID)
    expect(session.hudManager.leftPanel).toBe('orifice')

    const beforeOrificeMove = session.getSentCommands().length
    session.predictor.setPosition(5000, 5020) // |dy| = 18 > 10
    session.tick(40, 1120)
    expect(session.hudManager.leftPanel).toBe('none')
    expect(
      session
        .getSentCommands()
        .slice(beforeOrificeMove)
        .some((c) => c.type === 'StaffInOrifice' && c.state === 2),
    ).toBe(true)

    // Quest Log standalone speech replay (npcId === 0, npcInteraction.npcId === null) stays open anywhere
    session.hudManager.worldPanels.openStandaloneSpeech('Quest Log', 'Replay text')
    expect(session.hudManager.worldPanels.npcSpeech?.npcId).toBe(0)
    session.predictor.setPosition(5100, 5100)
    session.tick(40, 1160)
    expect(session.hudManager.worldPanels.npcSpeech?.text).toBe('Replay text')
  })

  it('7. multi-touch joystick movement immediately cancels an open NPC dialog', () => {
    const session = createTownSession()
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: AKARA_ID } })
    session.hudModel.syncFromWorld()
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(AKARA_ID)

    const tc = session.hudManager.touchControls
    tc.enabled = true
    tc.hudLayoutMode = 'compact-d2r'

    const beforeJoy = session.getSentCommands().length
    session.commandMapper.handleTouchStart(1, 120, 450, 2000)
    session.commandMapper.handleTouchMove(1, 180, 450, 2020)

    expect(session.world.npcInteraction.npcId).toBeNull()
    expect(session.hudManager.worldPanels.npcMenu).toBeNull()
    const sent = session.getSentCommands().slice(beforeJoy)
    expect(sent.some((c) => c.type === 'NpcCancel')).toBe(true)
    expect(sent.some((c) => c.type === 'Move')).toBe(true)
  })
})

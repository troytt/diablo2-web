/**
 * Issue #2009 — Unloaded / missing monster & Stash unit lifecycle across multi-room town AOI
 * (`D2Client.dll` `0x6FAF6150`, `0x6FAFBA20`, `0x6FAF8C80`, `0x6FB5C3D0` & `D2Game.dll` `0x6FC68410`).
 *
 * Verifies:
 * 1. `RoomHide` (`0x08`) in a multi-room town (`Area 75` Kurast Docks) pruning an active NPC (`Ormus`,
 *    `classId 255`) or `Stash` (`classId 267`) cancels `world.npcInteraction` and closes HUD `vendor`,
 *    `npcMenu`, `npcSpeech`, and `stash` panels cleanly without throwing.
 * 2. Outgoing `NpcInit`, `NpcOpenTrade`, `NpcOpenGamble`, `NpcEntityAction(1..3)`, `HudModel.openNpcTrade`,
 *    `HudModel.openNpcGamble`, and `HudModel.syncFromWorld` when the monster unit was unloaded from a
 *    populated `ClientWorld` cleanly abort/cancel without throwing `HudModel: NPC unit #<id> is not in the world`.
 * 3. Server `GameInstance` `emitRoomUnitsRemovedToPlayer` clears `player.activeNpcId`,
 *    `player.lastNpcInteractHandshakeId`, and `player.activeVendorMode` when unloading an NPC's room.
 */

import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

const ORMUS_ID = 7
const ORMUS_CLASS_ID = 255
const ALKOR_ID = 8
const ALKOR_CLASS_ID = 254
const ASHEARA_ID = 9
const ASHEARA_CLASS_ID = 252
const STASH_ID = 77
const STASH_CLASS_ID = 267

function createKurastDocksSession() {
  const session = new OnlineSession()
  session.hudManager.resize(800, 600)
  session.handleServerEvent({ type: 'LoadAct', act: 2, mapSeed: 0x12345678, areaId: 75 })
  // North room [5000..5040, 5000..5040) holds the local player after walking away.
  session.handleServerEvent({
    type: 'RoomReveal',
    tileX: 1000,
    tileY: 1000,
    tileW: 8,
    tileH: 8,
    areaId: 75,
  })
  // South room [5000..5040, 5160..5200) holds Ormus, Alkor, Asheara, and Stash.
  session.handleServerEvent({
    type: 'RoomReveal',
    tileX: 1000,
    tileY: 1032,
    tileW: 8,
    tileH: 8,
    areaId: 75,
  })
  session.handleServerEvent({
    type: 'UnitAssign',
    isSelf: true,
    unit: { unitType: 0, id: 1, classId: 1, name: 'ActOneSorc', x: 5010, y: 5170 },
  })
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: {
      unitType: 1,
      id: ORMUS_ID,
      classId: ORMUS_CLASS_ID,
      name: 'Ormus',
      x: 5012,
      y: 5170,
      lifePct: 128,
      mode: 1,
    },
  })
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: {
      unitType: 1,
      id: ALKOR_ID,
      classId: ALKOR_CLASS_ID,
      name: 'Alkor',
      x: 5014,
      y: 5172,
      lifePct: 128,
      mode: 1,
    },
  })
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: {
      unitType: 1,
      id: ASHEARA_ID,
      classId: ASHEARA_CLASS_ID,
      name: 'Asheara',
      x: 5016,
      y: 5172,
      lifePct: 128,
      mode: 1,
    },
  })
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: {
      unitType: 2,
      id: STASH_ID,
      classId: STASH_CLASS_ID,
      name: 'Stash',
      x: 5013,
      y: 5171,
      mode: 0,
    },
  })
  ;(session as unknown as { gameAdapter: unknown }).gameAdapter = {
    state: 'open',
    send: () => {},
  }
  return session
}

describe('Issue #2009 — Unloaded / missing NPC & Stash unit lifecycle parity', () => {
  it('1. RoomHide (0x08) pruning an active town NPC cancels world.npcInteraction and closes vendor / npcMenu without throwing', () => {
    const session = createKurastDocksSession()
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: ORMUS_ID } })
    session.handleServerEvent({
      type: 'NpcInfo',
      unitType: 1,
      unitId: ORMUS_ID,
      messages: [],
    })
    session.hudModel.openNpcTrade(ORMUS_ID)
    expect(session.world.npcInteraction.npcId).toBe(ORMUS_ID)
    expect(session.world.npcInteraction.window).toBe('trade')
    expect(session.hudManager.leftPanel).toBe('vendor')

    // Move local player to the north room, then hide the south room containing Ormus without an explicit 0x0A.
    session.handleServerEvent({
      type: 'UnitReassign',
      unitType: 0,
      id: 1,
      at: { x: 5010, y: 5010 },
      snap: true,
    })
    expect(() =>
      session.handleServerEvent({
        type: 'RoomHide',
        tileX: 1000,
        tileY: 1032,
        areaId: 75,
      }),
    ).not.toThrow()

    expect(session.world.getUnit('monster', ORMUS_ID)).toBeUndefined()
    expect(session.world.npcInteraction.npcId).toBeNull()
    expect(session.world.npcInteraction.window).toBe('none')
    expect(session.hudManager.leftPanel).toBe('none')
    expect(session.hudManager.worldPanels.npcMenu).toBeNull()
  })

  it('2. RoomHide (0x08) pruning an open Stash object closes stashOpen and hides the stash panel', () => {
    const session = createKurastDocksSession()
    session.handleServerEvent({
      type: 'Trade',
      action: 0x10,
    })
    expect(session.world.npcInteraction.stashOpen).toBe(true)
    expect(session.hudManager.leftPanel).toBe('stash')

    session.handleServerEvent({
      type: 'UnitReassign',
      unitType: 0,
      id: 1,
      at: { x: 5010, y: 5010 },
      snap: true,
    })
    session.handleServerEvent({
      type: 'RoomHide',
      tileX: 1000,
      tileY: 1032,
      areaId: 75,
    })

    expect(session.world.getUnit('object', STASH_ID)).toBeUndefined()
    expect(session.world.npcInteraction.stashOpen).toBe(false)
    expect(session.hudManager.leftPanel).toBe('none')
  })

  it('3. Outgoing NPC commands and HudModel.openNpcTrade / openNpcGamble / syncFromWorld do not crash when the NPC unit was unloaded', () => {
    const world = new ClientWorld()
    const hud = new HudManager()
    const commands: ClientCommand[] = []
    const model = new HudModel({
      world,
      hudManager: hud,
      onCommand: (cmd) => {
        commands.push(cmd)
        world.noteOutgoingCommand(cmd)
      },
      vendorPrice: (item, type) => 1000 * (type + 1) + item.id,
      vendorRepairAll: () => 100,
    })

    world.apply({ type: 'LoadAct', act: 2, mapSeed: 1, areaId: 75 })
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 1, name: 'ActOneSorc', x: 5010, y: 5010 },
    })
    // Ormus, Alkor, and Asheara are NOT in ClientWorld (unloaded via AOI).
    expect(world.getUnit('monster', ORMUS_ID)).toBeUndefined()

    expect(() => {
      world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: ORMUS_ID } })
      model.syncFromWorld()
    }).not.toThrow()
    expect(world.npcInteraction.npcId).toBeNull()

    expect(() => model.openNpcTrade(ORMUS_ID)).not.toThrow()
    expect(world.npcInteraction.window).toBe('none')
    expect(hud.leftPanel).toBe('none')

    expect(() => model.openNpcGamble(ALKOR_ID)).not.toThrow()
    expect(world.npcInteraction.window).toBe('none')
    expect(hud.leftPanel).toBe('none')

    expect(() => {
      world.noteOutgoingCommand({
        type: 'NpcEntityAction',
        action: 3,
        npcId: ASHEARA_ID,
        complement: 0,
      })
      model.syncFromWorld()
    }).not.toThrow()
    expect(world.npcInteraction.window).toBe('none')

    // Even if stale _npcInteraction state remained armed before a missing-unit sync, syncFromWorld degrades cleanly.
    ;(world as unknown as { _npcInteraction: Record<string, unknown> })._npcInteraction = {
      npcId: ORMUS_ID,
      unitType: 1,
      window: 'trade',
      activeWindow: 'trade',
      stashOpen: false,
      cubeOpen: false,
    }
    expect(() => model.syncFromWorld()).not.toThrow()
    expect(hud.leftPanel).toBe('none')
  })

  it('4. Server GameInstance emitRoomUnitsRemovedToPlayer clears activeNpcId and activeVendorMode when unloading an NPC room', () => {
    const game = new GameInstance({ seed: 200901, areaId: 75, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'ActOneSorc',
      x: 5100,
      y: 5050,
      areaId: 75,
      hp: 500,
      maxHp: 500,
    })
    const npcUnitId = game.spawnMonster({
      defId: 'ormus',
      hcIdx: ORMUS_CLASS_ID,
      classId: ORMUS_CLASS_ID,
      areaId: 75,
      x: 5102,
      y: 5050,
      hp: 100,
      maxHp: 100,
    })
    const playerRec = (
      game as unknown as {
        players: Map<
          number,
          {
            unitId: number
            activeNpcId?: number
            lastNpcInteractHandshakeId?: number
            activeVendorMode?: 'trade' | 'gamble' | null
          }
        >
      }
    ).players.get(pid)
    expect(playerRec).toBeDefined()
    playerRec!.activeNpcId = npcUnitId
    playerRec!.lastNpcInteractHandshakeId = npcUnitId
    playerRec!.activeVendorMode = 'trade'

    ;(
      game as unknown as {
        emitRoomUnitsRemovedToPlayer: (
          p: unknown,
          areaId: number,
          subX: number,
          subY: number,
          subW: number,
          subH: number,
        ) => void
      }
    ).emitRoomUnitsRemovedToPlayer(playerRec!, 75, 5080, 5040, 40, 40)

    expect(playerRec!.activeNpcId).toBeUndefined()
    expect(playerRec!.lastNpcInteractHandshakeId).toBeUndefined()
    expect(playerRec!.activeVendorMode).toBeNull()
  })
})

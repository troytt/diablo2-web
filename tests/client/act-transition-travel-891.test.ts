/**
 * Issue #891 — Act transition travel reliability & 1.13c parity tests:
 * 1. S2C 0x61 CanGoToAct handshake: client automatically emits C2S 0x48 CancelController (ResetBusy)
 *    to clear pPlayerData->bBusy (+0x4c) on server (D2Client 0x6fb39a04 / D2Game 0x6fceb4e0).
 * 2. Strict packet order for all 5 act transition NPCs: C2S 0x30 NpcCancel is dispatched BEFORE
 *    C2S 0x38 NpcEntityAction so D2Game SCMD_NpcCancel (0x6fced480) finds the NPC in the current room
 *    and clears bInteracting before the player is transferred to the new act.
 * 3. Dynamic NPC menu options refresh: completing dialog/speech or receiving QuestInfo / CanGoToAct
 *    rebuilds primaryOptions and options so 'travel_east' ("向東走") appears without stale menu locks.
 * 4. Tyrael Act 4 -> Act 5 travel condition parity (q[26] Diablo dead, q[28] Expansion Act 5, or CanGoToAct(4)).
 */

import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { WorldPanelsHud, buildNpcMenuOptions } from '../../src/client/ui/world-panels.ts'
import {
  getTownNpcDescriptorByHcIdx,
  getTownNpcDescriptorByName,
} from '../../src/common/units/npc-table.ts'
import {
  encodeC2sCancelController,
  encodeClientCommand,
  validateC2sPacket,
  type ClientCommand,
} from '../../src/netproto/index.ts'

describe('Issue #891 — Act Transition Travel Reliability & 1.13c Parity', () => {
  it('1. S2C 0x61 CanGoToAct triggers C2S 0x48 CancelController handshake and updates world capabilities', () => {
    // Verify C2S 0x48 wire encoding
    const pkt48 = encodeC2sCancelController()
    expect(pkt48.byteLength).toBe(1)
    expect(pkt48[0]).toBe(0x48)
    expect(() => validateC2sPacket(pkt48)).not.toThrow()

    const session = new OnlineSession()
    session.hudManager.resize(800, 600)
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 },
    })

    // Before S2C 0x61: cannot go to Act 2
    expect(session.world.canGoToAct(1)).toBe(false)
    expect(session.world.canGoToAct(2)).toBe(false)

    // Receive S2C 0x61 CanGoToAct (act=2)
    session.handleServerEvent({ type: 'CanGoToAct', act: 2 })

    // World state updated
    expect(session.world.canGoToAct(1)).toBe(true)
    expect(session.world.canGoToAct(2)).toBe(true)

    // Client sent C2S 0x48 CancelController to clear pPlayerData->bBusy on server
    const sent = session.getSentCommands()
    const cancelCmd = sent.find((c) => c.type === 'CancelController')
    expect(cancelCmd).toBeDefined()
    expect(cancelCmd).toEqual({ type: 'CancelController' })

    const encoded = encodeClientCommand(cancelCmd!)
    expect(encoded).toHaveLength(1)
    expect(encoded[0]![0]).toBe(0x48)
  })

  it('2. HudModel enforces 1.13c packet order (0x30 NpcCancel BEFORE 0x38 EntityAction) for all 5 act transition NPCs', () => {
    const transitions = [
      { name: 'Warriv Act 1 -> Act 2', hcIdx: 155, action: 'travel_east', expectedDest: 40 },
      { name: 'Warriv Act 2 -> Act 1', hcIdx: 175, action: 'travel_west', expectedDest: 1 },
      { name: 'Meshif Act 2 -> Act 3', hcIdx: 210, action: 'travel_east', expectedDest: 75 },
      { name: 'Meshif Act 3 -> Act 2', hcIdx: 264, action: 'travel_west', expectedDest: 40 },
      { name: 'Tyrael Act 4 -> Act 5', hcIdx: 367, action: 'travel_harrogath', expectedDest: 109 },
    ]

    for (const t of transitions) {
      const session = new OnlineSession()
      session.hudManager.resize(800, 600)
      const desc = getTownNpcDescriptorByHcIdx(t.hcIdx)!
      expect(desc).toBeDefined()

      const npcUnitId = 1000 + t.hcIdx
      const emittedCommands: ClientCommand[] = []
      session.hudModel.onCommand = (cmd) => emittedCommands.push(cmd)

      session.hudModel.handleNpcMenuAction(t.action, npcUnitId, desc)

      // Must have emitted at least NpcCancel and NpcEntityAction
      const cancelIdx = emittedCommands.findIndex((c) => c.type === 'NpcCancel')
      const actionIdx = emittedCommands.findIndex((c) => c.type === 'NpcEntityAction')

      expect(cancelIdx, `${t.name}: NpcCancel must be emitted`).toBeGreaterThanOrEqual(0)
      expect(actionIdx, `${t.name}: NpcEntityAction must be emitted`).toBeGreaterThanOrEqual(0)

      // Strict 1.13c order: NpcCancel BEFORE NpcEntityAction
      expect(
        cancelIdx,
        `${t.name}: 0x30 NpcCancel must be sent BEFORE 0x38 NpcEntityAction`,
      ).toBeLessThan(actionIdx)

      const cancelCmd = emittedCommands[cancelIdx] as any
      expect(cancelCmd.target?.id ?? cancelCmd.npcId).toBe(npcUnitId)

      const actionCmd = emittedCommands[actionIdx] as any
      expect(actionCmd.action).toBe(0)
      expect(actionCmd.npcId).toBe(npcUnitId)
      expect(actionCmd.complement).toBe(t.expectedDest)
    }
  })

  it('3. WorldPanelsHud standalone enforces 1.13c callback order (onNpcCancel BEFORE onNpcEntityAction)', () => {
    const transitions = [
      { name: 'Warriv Act 1', hcIdx: 155, option: 'travel_east', expectedDest: 40 },
      { name: 'Warriv Act 2', hcIdx: 175, option: 'travel_west', expectedDest: 1 },
      { name: 'Meshif Act 2', hcIdx: 210, option: 'travel_east', expectedDest: 75 },
      { name: 'Meshif Act 3', hcIdx: 264, option: 'travel_west', expectedDest: 40 },
      { name: 'Tyrael Act 4', hcIdx: 367, option: 'travel_harrogath', expectedDest: 109 },
    ]

    for (const t of transitions) {
      const wp = new WorldPanelsHud()
      const eventLog: Array<{ type: 'cancel' | 'action'; id: number; dest?: number | undefined }> = []

      wp.onNpcCancel = (id) => eventLog.push({ type: 'cancel', id })
      wp.onNpcEntityAction = (actionType, id, dest) => {
        expect(actionType).toBe(0)
        eventLog.push({ type: 'action', id, dest })
      }

      const desc = getTownNpcDescriptorByHcIdx(t.hcIdx)!
      const npcUnitId = 2000 + t.hcIdx
      wp.openNpcMenu(npcUnitId, desc)

      const clicked = wp.clickNpcMenuOption(t.option)
      expect(clicked, `${t.name}: option ${t.option} click must succeed`).toBe(true)

      expect(eventLog).toHaveLength(2)
      expect(eventLog[0]!.type, `${t.name}: onNpcCancel must fire first`).toBe('cancel')
      expect(eventLog[0]!.id).toBe(npcUnitId)
      expect(eventLog[1]!.type, `${t.name}: onNpcEntityAction must fire second`).toBe('action')
      expect(eventLog[1]!.id).toBe(npcUnitId)
      expect(eventLog[1]!.dest).toBe(t.expectedDest)
    }
  })

  it('4. Dynamic NPC menu refresh: Warriv "travel_east" appears after speech/quest completion without stale menu lock', () => {
    const session = new OnlineSession()
    session.hudManager.resize(800, 600)
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 },
    })

    const wp = session.hudManager.worldPanels
    const warrivDesc = getTownNpcDescriptorByHcIdx(155)!
    const warrivId = 155
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: warrivId,
        classId: 155,
        name: 'Warriv',
        x: 5002,
        y: 5000,
        lifePct: 128,
        mode: 1,
      },
    })
    const camera = session.camera as unknown as {
      subtileToScreen: (x: number, y: number) => { x: number; y: number }
      screenToSubtile: (x: number, y: number) => { x: number; y: number }
    }
    camera.subtileToScreen = (x: number, y: number) => ({
      x: 400 + (x - 5000) * 16,
      y: 300 + (y - 5000) * 8,
    })
    camera.screenToSubtile = (x: number, y: number) => ({
      x: Math.round(5000 + (x - 400) / 16),
      y: Math.round(5000 + (y - 300) / 8),
    })

    // Step 1: Open Warriv menu before Andariel is defeated (q[6] & 1 === 0)
    session.world.quests[6] = 0
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: warrivId } })
    session.hudModel.syncFromWorld()

    expect(wp.npcMenu).toBeDefined()
    expect(wp.npcMenu?.primaryOptions?.map((o) => o.id)).toEqual(['talk', 'cancel'])
    expect(wp.npcMenu?.options?.map((o) => o.id)).toEqual(['talk', 'cancel'])

    // Step 2: Warriv victory speech 183 plays (talking = true)
    wp.openNpcSpeech(warrivDesc, 'With Andariel defeated, my caravan is ready...', 'quest', 183)
    expect(wp.npcMenu?.talking).toBe(true)

    // Step 3: Andariel is defeated, server updates quest flags (q[6] bit 0 = 1)
    session.world.quests[6] = 1
    session.hudModel.syncFromWorld()

    // While talking, primaryOptions has been dynamically refreshed with the new capability
    expect(wp.npcMenu?.primaryOptions?.map((o) => o.id)).toEqual(['talk', 'travel_east', 'cancel'])

    // Step 4: Speech completes or is dismissed
    wp.closeNpcSpeech()
    expect(wp.npcMenu?.talking).toBe(false)

    // Both primaryOptions and active options now contain 'travel_east'
    expect(wp.npcMenu?.options?.map((o) => o.id)).toEqual(['talk', 'travel_east', 'cancel'])
    const travelOpt = wp.npcMenu?.options?.find((o) => o.id === 'travel_east')
    expect(travelOpt).toBeDefined()
    expect(travelOpt?.labelZh).toBe('向東走')
    expect(travelOpt?.labelEn).toBe('Go East')

    // Step 5: Player clicks 'travel_east'
    const emittedCommands: ClientCommand[] = []
    session.hudModel.onCommand = (cmd) => emittedCommands.push(cmd)

    expect(wp.clickNpcMenuOption('travel_east')).toBe(true)

    // Menu closed
    expect(wp.npcMenu).toBeNull()

    // Emitted NpcCancel then NpcEntityAction (0, warrivId, 40)
    expect(emittedCommands).toHaveLength(2)
    expect(emittedCommands[0]!.type).toBe('NpcCancel')
    expect(emittedCommands[1]!.type).toBe('NpcEntityAction')
    const actionCmd = emittedCommands[1] as any
    expect(actionCmd.action).toBe(0)
    expect(actionCmd.npcId).toBe(warrivId)
    expect(actionCmd.complement).toBe(40)
  })

  it('5. Talk submenu cancel re-evaluates menu options with latest quest and act permissions', () => {
    const wp = new WorldPanelsHud()
    const warrivDesc = getTownNpcDescriptorByHcIdx(155)!
    const questFlags: number[] = [0, 0, 0, 0, 0, 0, 0] // q[6] = 0 initially

    wp.openNpcMenu(101, warrivDesc, {
      questFlags,
      canGoToAct: (act: number) => act === 0,
    })

    // Open talk submenu
    wp.clickNpcMenuOption('talk')
    expect(wp.npcMenu?.submenu).toBe('talk')

    // Andariel is completed while player was in talk submenu
    questFlags[6] = 1

    // Player clicks cancel in talk submenu
    expect(wp.clickNpcMenuOption('cancel')).toBe(true)
    expect(wp.npcMenu?.submenu).toBe('main')

    // Primary options and active options now include travel_east!
    expect(wp.npcMenu?.options?.map((o) => o.id)).toEqual(['talk', 'travel_east', 'cancel'])
  })

  it('6. Tyrael Act 4 -> Act 5 travel gating reads only q[28] bit 0 + expansion (1.13c D2Client 0x6fba2330 / 0x6faf9000, #918)', () => {
    const tyraelDesc = getTownNpcDescriptorByHcIdx(367)!
    expect(tyraelDesc).toBeDefined()

    // 1. Nothing done -> no travel_harrogath
    const optsDefault = buildNpcMenuOptions(tyraelDesc, { questFlags: new Array(48).fill(0), expansion: true })
    expect(optsDefault.map((o) => o.id)).toEqual(['talk', 'cancel'])

    // 2. Terror's End / Hell's Forge bits alone do NOT unlock the item (D2Game sets q[28] itself, #918)
    for (const qi of [25, 26, 27]) {
      const flags = new Array(48).fill(0)
      flags[qi] = 0x3fff
      const opts = buildNpcMenuOptions(tyraelDesc, { questFlags: flags, expansion: true })
      expect(opts.map((o) => o.id), `q[${qi}] must not unlock Harrogath`).toEqual(['talk', 'cancel'])
    }

    // 3. Act 5 unlock bit (q[28] & 1) in an expansion game -> travel_harrogath enabled
    const q28Flags = new Array(48).fill(0)
    q28Flags[28] = 1
    const optsQ28 = buildNpcMenuOptions(tyraelDesc, { questFlags: q28Flags, expansion: true })
    expect(optsQ28.map((o) => o.id)).toEqual(['talk', 'travel_harrogath', 'cancel'])

    // 4. Classic game: 0x6faf9000 requires the expansion flag 0x6fbc9854
    const optsClassic = buildNpcMenuOptions(tyraelDesc, { questFlags: q28Flags, expansion: false })
    expect(optsClassic.map((o) => o.id)).toEqual(['talk', 'cancel'])

    // 5. S2C 0x61 is never consulted by the 1.13c menu gate
    const optsCanGo = buildNpcMenuOptions(tyraelDesc, { canGoToAct: (act: number) => act === 4 || act === 5 })
    expect(optsCanGo.map((o) => o.id)).toEqual(['talk', 'cancel'])
    const optsCanGoQ = buildNpcMenuOptions(tyraelDesc, {
      questFlags: new Array(48).fill(0),
      canGoToAct: (act: number) => act === 4 || act === 5,
      expansion: true,
    })
    expect(optsCanGoQ.map((o) => o.id)).toEqual(['talk', 'cancel'])

    // Check localized strings
    const harrogathOpt = optsQ28.find((o) => o.id === 'travel_harrogath')
    expect(harrogathOpt?.labelZh).toBe('前往哈洛加斯')
    expect(harrogathOpt?.labelEn).toBe('Travel to Harrogath')
  })
})

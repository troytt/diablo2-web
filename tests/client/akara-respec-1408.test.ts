/**
 * Issue #1408 — Akara "Reset Stat/Skill Points" click has no effect online.
 *
 * 1.13c ground truth:
 * - D2Client.dll quest gate table 0x6fba2330: Akara (148) = quest 1, bit 0, wantSet 1 (0x6fafa3a0).
 * - Menu callback 0x6fafa2a0 -> 0x6faf9c80 opens the confirm box (text 0x2ba0, buttons 0xd49 / 0xd48).
 * - Confirm callback 0x6faf90d0: C2S 0x30 NpcCancel (0x6faf8150) first, then C2S 0x38 action 0, complement 0.
 * - D2Game.dll 0x6fce00c0 @ 0x6fce0504: Akara (0x94) resets via 0x6fc82340.
 */

import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { WorldPanelsHud, buildNpcMenuOptions } from '../../src/client/ui/world-panels.ts'
import { getTownNpcDescriptorByHcIdx } from '../../src/common/units/npc-table.ts'
import { encodeClientCommand, type ClientCommand } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

const AKARA_HCIDX = 148

function setupAkaraSession(): { session: OnlineSession; akaraId: number } {
  const session = new OnlineSession()
  session.hudManager.resize(800, 600)
  session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
  session.handleServerEvent({
    type: 'UnitAssign',
    isSelf: true,
    unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 },
  })
  const akaraId = 148
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: { unitType: 1, id: akaraId, classId: AKARA_HCIDX, name: 'Akara', x: 5002, y: 5000, lifePct: 128, mode: 1 },
  })
  const camera = session.camera as unknown as {
    subtileToScreen: (x: number, y: number) => { x: number; y: number }
    screenToSubtile: (x: number, y: number) => { x: number; y: number }
  }
  camera.subtileToScreen = (x: number, y: number) => ({ x: 400 + (x - 5000) * 16, y: 300 + (y - 5000) * 8 })
  camera.screenToSubtile = (x: number, y: number) => ({
    x: Math.round(5000 + (x - 400) / 16),
    y: Math.round(5000 + (y - 300) / 8),
  })
  return { session, akaraId }
}

describe('Issue #1408 — Akara respec', () => {
  it('gates the respec item on quest 1 bit 0 (D2Client 0x6fba2330)', () => {
    const desc = getTownNpcDescriptorByHcIdx(AKARA_HCIDX)!
    const withBit0 = buildNpcMenuOptions(desc, { questFlags: [0, 1] }).map((o) => o.id)
    const withBit1Only = buildNpcMenuOptions(desc, { questFlags: [0, 2] }).map((o) => o.id)
    expect(withBit0).toContain('respec')
    expect(withBit1Only).not.toContain('respec')
  })

  it('keeps the confirm submenu across per-frame NPC menu sync', () => {
    const { session, akaraId } = setupAkaraSession()
    const wp = session.hudManager.worldPanels
    session.world.quests[1] = 1
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: akaraId } })
    session.hudModel.syncFromWorld()
    wp.closeNpcSpeech()
    session.hudModel.syncFromWorld()
    expect(wp.npcMenu?.options?.map((o) => o.id)).toContain('respec')

    expect(wp.clickNpcMenuOption('respec')).toBe(true)
    expect(wp.npcMenu?.submenu).toBe('respec')
    expect(wp.npcMenu?.options?.map((o) => o.id)).toEqual(['confirm_respec', 'cancel'])

    // Several frames later the confirm submenu must still be there.
    for (let i = 0; i < 3; i++) session.hudModel.syncFromWorld()
    expect(wp.npcMenu?.options?.map((o) => o.id)).toEqual(['confirm_respec', 'cancel'])
  })

  it('confirm sends C2S 0x30 NpcCancel then C2S 0x38 action 0 / complement 0 (D2Client 0x6faf90d0)', () => {
    const session = new OnlineSession()
    const desc = getTownNpcDescriptorByHcIdx(AKARA_HCIDX)!
    const npcUnitId = 4242
    const emitted: ClientCommand[] = []
    session.hudModel.onCommand = (cmd) => emitted.push(cmd)

    session.hudModel.handleNpcMenuAction('confirm_respec', npcUnitId, desc)

    const cancelIdx = emitted.findIndex((c) => c.type === 'NpcCancel')
    const actionIdx = emitted.findIndex((c) => c.type === 'NpcEntityAction')
    expect(cancelIdx).toBeGreaterThanOrEqual(0)
    expect(actionIdx).toBeGreaterThan(cancelIdx)
    const action = emitted[actionIdx] as Extract<ClientCommand, { type: 'NpcEntityAction' }>
    expect(action).toMatchObject({ action: 0, npcId: npcUnitId, complement: 0 })
    const wire = encodeClientCommand(action)[0]!
    expect(Array.from(wire)).toEqual([0x38, 0, 0, 0, 0, 0x92, 0x10, 0, 0, 0, 0, 0, 0])
  })

  it('standalone WorldPanelsHud confirm fires onNpcCancel before onNpcEntityAction(0, id, 0)', () => {
    const wp = new WorldPanelsHud()
    const log: string[] = []
    wp.onNpcCancel = (id) => log.push(`cancel:${id}`)
    wp.onNpcEntityAction = (a, id, c) => log.push(`action:${a}:${id}:${c}`)
    const desc = getTownNpcDescriptorByHcIdx(AKARA_HCIDX)!
    wp.openNpcMenu(77, desc, { questFlags: [0, 1] } as any)
    expect(wp.clickNpcMenuOption('respec')).toBe(true)
    expect(wp.clickNpcMenuOption('confirm_respec')).toBe(true)
    expect(log).toEqual(['cancel:77', 'action:0:77:0'])
  })

  it('hides the respec option once Quest 41 (0x29) bit 0 is set (D2Client 0x6faf8f18)', () => {
    const desc = getTownNpcDescriptorByHcIdx(AKARA_HCIDX)!
    const availableFlags = new Array(48).fill(0)
    availableFlags[1] = 0x2001
    availableFlags[41] = 0x2002
    expect(buildNpcMenuOptions(desc, { questFlags: availableFlags }).map((o) => o.id)).toContain('respec')

    const consumedFlags = new Array(48).fill(0)
    consumedFlags[1] = 0x2001
    consumedFlags[41] = 0x2001
    expect(buildNpcMenuOptions(desc, { questFlags: consumedFlags }).map((o) => o.id)).not.toContain('respec')
  })

  it('clicking cancel in the respec confirm submenu returns to main NPC menu without closing session (D2Client 0x6faf9200)', () => {
    const wp = new WorldPanelsHud()
    const desc = getTownNpcDescriptorByHcIdx(AKARA_HCIDX)!
    let cancelFired = false
    const ctx = { questFlags: [0, 1], onCancel: () => { cancelFired = true } }
    wp.openNpcMenu(desc, 400, 300, 77, ctx)
    expect(wp.clickNpcMenuOption('respec', ctx)).toBe(true)
    expect(wp.npcMenu?.submenu).toBe('respec')

    expect(wp.clickNpcMenuOption('cancel', ctx)).toBe(true)
    expect(cancelFired).toBe(false)
    expect(wp.npcMenu).not.toBeNull()
    expect(wp.npcMenu?.submenu).toBe('main')
    expect(wp.npcMenu?.options?.map((o) => o.id)).toContain('respec')

    // Also verify confirm_respec succeeds when context is passed
    expect(wp.clickNpcMenuOption('respec', ctx)).toBe(true)
    const log: string[] = []
    wp.onNpcCancel = (id) => log.push(`cancel:${id}`)
    wp.onNpcEntityAction = (a, id, c) => log.push(`action:${a}:${id}:${c}`)
    expect(wp.clickNpcMenuOption('confirm_respec', ctx)).toBe(true)
    expect(log).toEqual(['cancel:77', 'action:0:77:0'])
  })

  it('GameInstance executes Akara respec (stats + skills + Quest 41 bit 0) on NpcEntityAction(0, akara, 0)', () => {
    const game = new GameInstance({ seed: 12345 })
    const playerId = game.connectPlayer({
      name: 'Sorceress',
      classId: 1, // Sorceress: base str=10, dex=25, vit=10, ene=35
      level: 10,
      areaId: 1,
      x: 5100,
      y: 5050,
    })
    const akaraId = game.spawnMonster({
      hcIdx: AKARA_HCIDX,
      areaId: 1,
      x: 5101,
      y: 5050,
      isNpc: true,
    })
    const player = (game as any).players.get(playerId)!
    player.statPts = 10
    player.newSkills = 2
    // Complete Den of Evil (a1q1) -> grants +1 skill point and Quest 41 = 0x2002
    ;(game as any).setPlayerQuestFlag(player, 'a1q1', 1)
    expect(player.newSkills).toBe(3)
    expect(player.questFlags[41]).toBe(0x2002)

    // Allocate 5 Str, 5 Vit, and 2 points into Fire Bolt (skill 36)
    game.enqueueCommand(playerId, { type: 'AllocateStat', statId: 0, amount: 5 })
    game.enqueueCommand(playerId, { type: 'AllocateStat', statId: 3, amount: 5 })
    game.enqueueCommand(playerId, { type: 'AllocateSkill', skillId: 36 })
    game.enqueueCommand(playerId, { type: 'AllocateSkill', skillId: 36 })
    game.enqueueCommand(playerId, { type: 'SelectSkill', hand: 'right', skill: 36 })
    game.stepFrame()

    expect(player.strength).toBe(15)
    expect(player.vitality).toBe(15)
    expect(player.statPts).toBe(0)
    expect(player.skills.get(36)).toBe(2)
    expect(player.newSkills).toBe(1)
    expect(player.rightSkill).toBe(36)

    // Trigger Akara Respec via NpcEntityAction(0, akaraId, 0)
    game.enqueueCommand(playerId, { type: 'NpcCancel', target: { unitType: 1, id: akaraId }, npcId: akaraId })
    game.enqueueCommand(playerId, { type: 'NpcEntityAction', action: 0, npcId: akaraId, complement: 0 })
    game.stepFrame()

    // Base stats restored & all points refunded
    expect(player.strength).toBe(10)
    expect(player.vitality).toBe(10)
    expect(player.statPts).toBe(10)
    expect(player.skills.size).toBe(0)
    expect(player.newSkills).toBe(3)
    expect(player.rightSkill).toBe(0)
    expect(player.questFlags[41]).toBe(0x2001)

    // Second respec attempt in the same difficulty must be rejected
    game.enqueueCommand(playerId, { type: 'AllocateStat', statId: 0, amount: 5 })
    game.enqueueCommand(playerId, { type: 'NpcEntityAction', action: 0, npcId: akaraId, complement: 0 })
    game.stepFrame()
    expect(player.strength).toBe(15)
    expect(player.statPts).toBe(5)
  })
})

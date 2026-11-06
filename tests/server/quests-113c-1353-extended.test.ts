/**
 * Issue #1353 follow-up — area gates must not be self-referential.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'

function setup(seed: number) {
  const game = new GameInstance({ seed, areaId: 1 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
  const internal = game as unknown as {
    players: Map<number, { questFlags: Uint16Array }>
    playerCanEnterArea: (player: unknown, areaId: number) => boolean
  }
  return { game, player: internal.players.get(playerId)!, internal }
}

describe('issue #1353 quest area gates', () => {
  it('opens Chaos Sanctuary and Arreat Summit without a self-referential quest', () => {
    const { player, internal } = setup(1353)
    expect(internal.playerCanEnterArea(player, 108)).toBe(true)
    expect(internal.playerCanEnterArea(player, 120)).toBe(true)
  })

  it('gates the Arcane Sanctuary on a2q3 and Worldstone on a5q5', () => {
    const { player, internal } = setup(1354)
    expect(internal.playerCanEnterArea(player, 74)).toBe(false)
    expect(internal.playerCanEnterArea(player, 128)).toBe(false)
    // Quest word indices: a2q3 = 9 + 2, a5q5 = 35 + 4.
    player.questFlags[11] |= QUEST_FLAG_STARTED_113C
    player.questFlags[39] |= QUEST_FLAG_COMPLETED_113C
    expect(internal.playerCanEnterArea(player, 74)).toBe(true)
    expect(internal.playerCanEnterArea(player, 128)).toBe(true)
  })
})

describe('issue #1353 boss quest kills', () => {
  it('completes Blood Raven, Radament and Shenk quests on death', () => {
    for (const [defId, quest] of [
      ['bloodraven', 'a1q2'],
      ['radament', 'a2q1'],
    ] as const) {
      const game = new GameInstance({ seed: 1355 + quest.length, areaId: 1 })
      const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
      const player = (game as unknown as { players: Map<number, { questFlags: Uint16Array }> })
        .players.get(playerId)!
      const bossId = game.spawnMonster({ defId, x: 12, y: 10, areaId: 1, hp: 10, maxHp: 10 })
      game.applyDamageToMonster(bossId, 100, playerId)
      const idx = questWordIndex113c(quest)!
      expect(player.questFlags[idx]! & 0x0001, `${defId} -> ${quest}`).toBe(1)
    }
  })
})

describe('issue #1353 quest objects', () => {
  it('completes Hellforge and all five Chaos seals', () => {
    const game = new GameInstance({ seed: 1360, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as { players: Map<number, { questFlags: Uint16Array }> })
      .players.get(playerId)!
    for (let i = 0; i < 5; i++) {
      const seal = game.spawnObject({ classId: 392 + i, x: 11, y: 10, areaId: 1 })
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: seal })
      game.stepFrames(1)
    }
    expect(player.questFlags[questWordIndex113c('a4q3')!]! & 0x1000).toBe(0x1000)
  })
})

describe('issue #1353 Horadric orifice', () => {
  it("consumes the staff and spawns Duriel's Lair after 18 ticks", () => {
    const game = new GameInstance({ seed: 1362, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as { players: Map<number, { items: any[]; questFlags: Uint16Array }> })
      .players.get(playerId)!
    player.items.push({
      unitId: 9800, code: 'hst', name: 'hst', quality: 2, level: 1, location: 'inventory',
      x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: playerId, bodyLoc: 0,
      storePage: 0, cost: 0, gamble: false, identified: true, ethereal: false,
      socketed: false, totalSockets: 0, durability: 0, maxDurability: 0,
      quantity: 1, stats: new Map(), socketedItems: [],
    })
    const orifice = game.spawnObject({ classId: 152, x: 11, y: 10, areaId: 1 })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: orifice })
    game.stepFrames(1)
    expect(player.items.some((item) => item.code === 'hst')).toBe(false)
    const questEvents = game.drainEvents(playerId).filter((e) => e.type === 'QuestState') as { source?: number; specialEventId?: number }[]
    expect(questEvents.some((e) => e.source === 0x28)).toBe(true)
    expect(questEvents.some((e) => e.source === 0x89 && e.specialEventId === 3)).toBe(true)
    expect(player.questFlags[questWordIndex113c('a2q2')!]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
    game.stepFrames(18)
    const objects = (game as unknown as { objects: Map<number, { classId: number; destAreaId?: number; x: number; y: number }> })
      .objects
    expect([...objects.values()].some((obj) => obj.classId === 100 && obj.destAreaId === 73)).toBe(true)
  })
})

describe('issue #1353 Compelling Orb', () => {
  it("requires Khalim's Will and two hits, plays mode 1 -> 2 smash show, kills MonStats 366, and opens stairs 386 (D2Game 0x6fd0a140)", () => {
    const game = new GameInstance({ seed: 1363, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as { players: Map<number, { items: any[]; questFlags: Uint16Array; areaId: number }> })
      .players.get(playerId)!
    const flail = {
      unitId: 9901, code: 'qf2', name: "Khalim's Will", quality: 2, level: 1,
      location: 'equipped', x: 0, y: 0, width: 1, height: 1, areaId: 1,
      ownerId: playerId, bodyLoc: 4, storePage: 0, cost: 0, gamble: false,
      identified: true, ethereal: false, socketed: false, totalSockets: 0,
      durability: 10, maxDurability: 10, quantity: 1, stats: new Map(),
      socketedItems: [],
    }
    player.items.push(flail)
    const stairs = game.spawnObject({ classId: 386, x: 11, y: 11, areaId: 1 })
    const orb = game.spawnObject({ classId: 404, x: 11, y: 10, areaId: 1 })
    const objects = (game as unknown as { objects: Map<number, { mode: number; linkedMonsterId?: number }> }).objects
    const orbRec = objects.get(orb)!
    const stairsRec = objects.get(stairs)!
    expect(orbRec.linkedMonsterId).toBeDefined()
    const assignEvents = game.drainEvents(playerId)
    const orbMonsterAssign = assignEvents.find(
      (e) => e.type === 'UnitAssign' && e.unitType === 'monster' && e.classId === 366,
    ) as { unit?: { bossMods?: number[] } } | undefined
    expect(orbMonsterAssign?.unit?.bossMods).toEqual([22])

    // Sealed stairs (mode 0) cannot warp the player or be forced open before the orb is smashed.
    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 2, id: stairs } })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: stairs })
    game.stepFrames(1)
    expect(player.areaId).toBe(1)
    expect(stairsRec.mode).toBe(0)

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: orb })
    game.stepFrames(1)
    expect(player.items.includes(flail)).toBe(true)
    expect(player.questFlags[questWordIndex113c('a3q3')!]! & QUEST_FLAG_COMPLETED_113C).toBe(0)
    expect(orbRec.mode).toBe(0)

    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: orb })
    game.stepFrames(1)
    expect(player.items.includes(flail)).toBe(false)
    const smashEvents = game.drainEvents(playerId)
    expect(smashEvents.some((e) => e.type === 'ItemEvent' && (e as { action?: string; itemId?: number }).action === 'remove' && (e as { itemId?: number }).itemId === 9901)).toBe(true)
    expect(smashEvents.some((e) => e.type === 'UnitMode' && (e as { unitType?: number; id?: number; mode?: number }).unitType === 1 && (e as { id?: number }).id === orbRec.linkedMonsterId && (e as { mode?: number }).mode === 0)).toBe(true)
    expect(smashEvents.some((e) => e.type === 'QuestState' && (e as { specialEventId?: number }).specialEventId === 10)).toBe(true)
    expect(player.questFlags[questWordIndex113c('a3q3')!]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
    // Enters OBJMODE_OPERATING (1) immediately, then settles into OBJMODE_OPENED (2) after 58 ticks.
    expect(orbRec.mode).toBe(1)
    game.stepFrames(11)
    expect(stairsRec.mode).toBe(1)
    game.stepFrames(19)
    expect(stairsRec.mode).toBe(2)
    game.stepFrames(28)
    expect(orbRec.mode).toBe(2)
  })
})

describe('issue #1353 Hellforge reward', () => {
  it('places Mephisto Soulstone (mss), requires equipped Hellforge Hammer (hfh) for three hits, consumes hfh, sets 0x2002, and Cain completes 0x0001 (D2Game 0x6fcdb8d0 / 0x6fcdaa50)', () => {
    const game = new GameInstance({ seed: 1364, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as { players: Map<number, { items: any[]; questFlags: Uint16Array }> })
      .players.get(playerId)!
    const soulstone = {
      unitId: 9909, code: 'mss', name: "Mephisto's Soulstone", quality: 2, level: 1,
      location: 'inventory', x: 0, y: 0, width: 1, height: 1, areaId: 1,
      ownerId: playerId, bodyLoc: 0, storePage: 1, cost: 0, gamble: false,
      identified: true, ethereal: false, socketed: false, totalSockets: 0,
      durability: 0, maxDurability: 0, quantity: 1, stats: new Map(),
      socketedItems: [],
    }
    const hammer = {
      unitId: 9910, code: 'hfh', name: 'Hellforge Hammer', quality: 2, level: 1,
      location: 'equipped', x: 0, y: 0, width: 1, height: 1, areaId: 1,
      ownerId: playerId, bodyLoc: 4, storePage: 0, cost: 0, gamble: false,
      identified: true, ethereal: false, socketed: false, totalSockets: 0,
      durability: 10, maxDurability: 10, quantity: 1, stats: new Map(),
      socketedItems: [],
    }
    player.items.push(soulstone, hammer)
    const forge = game.spawnObject({ classId: 376, x: 11, y: 10, areaId: 1 })
    const internal = game as unknown as {
      objects: Map<number, { mode: number }>
      groundItems: Map<number, unknown>
    }
    // Stage 1: place Mephisto's Soulstone ('mss') -> consumes 'mss', sets forge mode to 1
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forge })
    game.stepFrames(1)
    expect(player.items.includes(soulstone)).toBe(false)
    expect(internal.objects.get(forge)!.mode).toBe(1)

    // Stage 2: three hits with equipped Hellforge Hammer ('hfh')
    for (let hit = 1; hit <= 2; hit++) {
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forge })
      game.stepFrames(1)
      expect(player.questFlags[questWordIndex113c('a4q2')!]! & (QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C)).toBe(0)
      expect(internal.objects.get(forge)!.mode).toBe(1)
      expect(player.items.includes(hammer)).toBe(true)
    }
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forge })
    game.stepFrames(1)
    expect(player.items.includes(hammer)).toBe(false)
    expect(player.questFlags[questWordIndex113c('a4q2')!]).toBe(
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(internal.objects.get(forge)!.mode).toBe(3)
    game.stepFrames(80)
    expect(internal.groundItems.size).toBeGreaterThanOrEqual(5)

    // Stage 3: talk to Cain -> transitions bit 1 (0x0002) to bit 0 (0x0001)
    const cain = game.spawnMonster({ classId: 246, name: 'Deckard Cain', x: 11, y: 10, areaId: 1, isNpc: true })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: cain } } as never)
    game.stepFrames(1)
    expect(player.questFlags[questWordIndex113c('a4q2')!]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[questWordIndex113c('a4q2')!]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
  })
})

describe('issue #1353 Chaos seal bosses', () => {
  it('spawns the three seal bosses and Diablo after all seals', () => {
    const game = new GameInstance({ seed: 1365, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
    const internal = game as unknown as {
      monsters: Map<number, { defId: string; superUniqueId?: string; dead: boolean }>
    }
    for (let i = 0; i < 5; i++) {
      const seal = game.spawnObject({ classId: 392 + i, x: 11, y: 10, areaId: 1 })
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: seal })
      game.stepFrames(1)
    }
    const bosses = [...internal.monsters.entries()].filter(
      ([, m]) => m.superUniqueId !== undefined && /Vizier|Seis|Infector/.test(m.superUniqueId),
    )
    expect(bosses).toHaveLength(3)
    for (const [id] of bosses) game.applyDamageToMonster(id, 1_000_000, playerId)
    game.stepFrames(125)
    expect([...internal.monsters.values()].some((m) => m.defId === 'diablo' && !m.dead)).toBe(true)
  })
})

describe('issue #1353 Ancients altar', () => {
  it('spawns three Ancients once and completes a5q5 after all die', () => {
    const game = new GameInstance({ seed: 1366, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1, level: 30 })
    const player = (game as unknown as { players: Map<number, { questFlags: Uint16Array }> })
      .players.get(playerId)!
    const altar = game.spawnObject({ classId: 546, x: 11, y: 10, areaId: 1 })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: altar })
    game.stepFrames(1)
    const internal = game as unknown as {
      monsters: Map<number, { superUniqueId?: string; dead: boolean }>
    }
    const ancients = [...internal.monsters.entries()].filter(
      ([, m]) => m.superUniqueId?.startsWith('Ancient Barbarian') === true,
    )
    expect(ancients).toHaveLength(3)
    for (const [id] of ancients) game.applyDamageToMonster(id, 1_000_000, playerId)
    game.stepFrames(1)
    expect(player.questFlags[questWordIndex113c('a5q5')!]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
  })
})

describe('issue #1353 Cain / Cairn / Inifuss', () => {
  it('opens Tristram from five Cairn Stones, drops the Inifuss scroll and frees Cain', () => {
    const game = new GameInstance({ seed: 1367, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as { players: Map<number, { questFlags: Uint16Array }> })
      .players.get(playerId)!
    const before = (game as unknown as { groundItems: Map<number, unknown> }).groundItems.size
    const tree = game.spawnObject({ classId: 30, x: 11, y: 10, areaId: 1 })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: tree })
    game.stepFrames(1)
    const ground = (game as unknown as { groundItems: Map<number, { code: string }> }).groundItems
    expect(ground.size).toBeGreaterThan(before)
    const bksEntry = [...ground.entries()].find(([, item]) => item.code.trim().toLowerCase() === 'bks')
    expect(bksEntry).toBeDefined()
    game.enqueueCommand(playerId, { type: 'ItemPickup', itemId: bksEntry![0], toCursor: false } as never)
    game.stepFrames(1)
    const akara = game.spawnMonster({ classId: 148, name: 'Akara', x: 11, y: 10, areaId: 1, isNpc: true })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: akara } } as never)
    game.stepFrames(1)

    const stoneIdsByClass = new Map<number, number>()
    for (let i = 0; i < 5; i++) {
      stoneIdsByClass.set(17 + i, game.spawnObject({ classId: 17 + i, x: 11, y: 10, areaId: 1 }))
    }
    for (const cls of game.getCairnStoneOrder()) {
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: stoneIdsByClass.get(cls)! })
      game.stepFrames(1)
    }
    const objects = (game as unknown as { objects: Map<number, { classId: number; destAreaId?: number }> })
      .objects
    expect([...objects.values()].some((o) => o.classId === 60 && o.destAreaId === 38)).toBe(true)

    const gibbet = game.spawnObject({ classId: 26, x: 11, y: 10, areaId: 1 })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: gibbet })
    game.stepFrames(1)
    expect(player.questFlags[questWordIndex113c('a1q3')!]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
  })
})

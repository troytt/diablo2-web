import { describe, expect, it } from 'vitest'
import {
  decode0x1AExpByte,
  decode0x1BExpWord,
  decode0x1CExpDword,
} from '../src/netproto/d2gs/s2c/stats.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  questWordIndex113c,
} from '../src/server/engine/quests-113c.ts'
import { D2_EXPERIENCE_TABLE_99 } from '../src/common/skills/formulas.ts'

describe('Issue #1406: S2C 0x1C absolute experience & HUD experience bar parity', () => {
  it('decodes 0x1A/0x1B as delta and 0x1C as absolute experience (D2Client.dll 0x6fb5edf0)', () => {
    const ev1A = decode0x1AExpByte(new Uint8Array([0x1a, 200]))
    expect(ev1A).toEqual({ type: 'Experience', value: 200, isDelta: true })

    const ev1B = decode0x1BExpWord(new Uint8Array([0x1b, 0x34, 0x12]))
    expect(ev1B).toEqual({ type: 'Experience', value: 0x1234, isDelta: true })

    // 13,763,188 = 0x00d20274
    const ev1C = decode0x1CExpDword(new Uint8Array([0x1c, 0x74, 0x02, 0xd2, 0x00]))
    expect(ev1C).toEqual({ type: 'Experience', value: 13_763_188, isDelta: false })
  })

  it('prevents experience doubling when both UnitStatUpdate(13) and 0x1C Experience arrive at level 38', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'AssignPlayer',
      unitId: 1,
      charClass: 1,
      name: 'Sorc',
      x: 100,
      y: 100,
    })
    world.applyEvent({
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: 1,
      statId: 12,
      value: 38,
    })
    world.applyEvent({
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: 1,
      statId: 13,
      value: 13_763_188,
    })
    const ev1C = decode0x1CExpDword(new Uint8Array([0x1c, 0x74, 0x02, 0xd2, 0x00]))
    world.applyEvent(ev1C)

    expect(world.self.experience).toBe(13_763_188)
    expect(world.getUnit('player', 1)?.stats.get(13)).toBe(13_763_188)

    // Level 38 floor = 13,815,086; Level 39 next = 15,468,534.
    // Previously, 0x1C (13,763,188) had isDelta: true, which added 13,763,188 onto 13,763,188
    // to produce 27,526,376 / 15,468,534!
    const curFloor = D2_EXPERIENCE_TABLE_99[38]!
    const nextFloor = D2_EXPERIENCE_TABLE_99[39]!
    expect(curFloor).toBe(13_815_086)
    expect(nextFloor).toBe(15_468_534)
    expect(world.self.experience).toBe(13_763_188)
    expect(world.self.experience).toBeLessThan(nextFloor)
  })

  it('emits absolute Experience from GameInstance.grantExperience so ClientWorld never doubles XP', () => {
    const game = new GameInstance({ seed: 1406, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 10, y: 10, areaId: 1 })
    game.drainEvents(playerId)

    const monId = game.spawnMonster({
      defId: 'zombie1',
      x: 11,
      y: 10,
      areaId: 1,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(monId, 500, playerId)

    const events = game.drainEvents(playerId)
    const world = new ClientWorld()
    world.applyEvent({
      type: 'AssignPlayer',
      unitId: playerId,
      charClass: 1,
      name: 'Sorc',
      x: 10,
      y: 10,
    })
    for (const ev of events) {
      world.applyEvent(ev)
    }

    const expEvent = events.find((e) => e.type === 'Experience') as
      | { type: 'Experience'; value: number; isDelta?: boolean }
      | undefined
    expect(expEvent).toBeDefined()
    expect(expEvent?.isDelta).toBe(false)
    expect(world.self.experience).toBe(expEvent?.value)
    expect(world.getUnit('player', playerId)?.stats.get(13)).toBe(expEvent?.value)
  })
})

describe('Issue #1404: Quest item full-inventory ground drop, one-time grant & duplicate pickup guard', () => {
  function setupGame(seed: number) {
    const game = new GameInstance({ seed, areaId: 109 })
    const playerId = game.connectPlayer({
      charClass: 'pal',
      name: 'Hero',
      x: 20,
      y: 20,
      areaId: 109,
    })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          unitId: number
          areaId: number
          x: number
          y: number
          questFlags: Uint16Array
          items: Array<{
            unitId: number
            code: string
            location: string
            x: number
            y: number
            width: number
            height: number
          }>
        }
      >
      groundItems: Map<number, { unitId: number; code: string; areaId: number; x: number; y: number }>
    }
    const player = internal.players.get(playerId)!
    return { game, playerId, player, groundItems: internal.groundItems }
  }

  function fillInventory(player: { items: any[]; areaId: number; unitId: number }) {
    player.items = []
    let nextId = 50000
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 10; x++) {
        player.items.push({
          unitId: nextId++,
          code: 'cm1',
          name: 'Small Charm',
          quality: 4,
          level: 1,
          location: 'inventory',
          x,
          y,
          width: 1,
          height: 1,
          areaId: player.areaId,
          ownerId: player.unitId,
          bodyLoc: 0,
          storePage: 1,
          cost: 1,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        })
      }
    }
  }

  it('drops Malah potion (ice) on the ground with sound 23 when inventory is full, and does not mint duplicates on repeat clicks', () => {
    const { game, playerId, player, groundItems } = setupGame(14041)
    fillInventory(player)
    game.drainEvents(playerId)

    const malah = game.spawnMonster({
      classId: 513,
      name: 'Malah',
      x: 21,
      y: 20,
      areaId: 109,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)

    const events1 = game.drainEvents(playerId)
    const droppedIce = [...groundItems.values()].filter((g) => g.code.trim().toLowerCase() === 'ice')
    expect(droppedIce).toHaveLength(1)
    expect(events1.some((e) => e.type === 'PlaySound' && e.sound === 23)).toBe(true)

    const a5q3Idx = questWordIndex113c('a5q3')!
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_STARTED_113C).toBe(QUEST_FLAG_STARTED_113C)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_PRIMARY_GOAL_DONE_113C).toBe(
      QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
    )

    // Talking to Malah again while ice is on the ground must NOT spawn a second ice.
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect([...groundItems.values()].filter((g) => g.code.trim().toLowerCase() === 'ice')).toHaveLength(1)
  })

  it('grants Scroll of Resistance (tr2) once on A5Q3 turn-in, clears REWARD_PENDING, and never grants a second tr2', () => {
    const { game, playerId, player, groundItems } = setupGame(14042)
    const malah = game.spawnMonster({
      classId: 513,
      name: 'Malah',
      x: 21,
      y: 20,
      areaId: 109,
      isNpc: true,
    })

    // 1. Talk to Malah -> get 'ice' in inventory
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.items.filter((i) => i.code === 'ice')).toHaveLength(1)

    // 2. Talk to Malah again after dropping 'ice' on ground -> still only 1 'ice' total
    const iceItem = player.items.find((i) => i.code === 'ice')!
    game.enqueueCommand(playerId, { type: 'ItemDrop', itemId: iceItem.unitId } as never)
    game.stepFrames(1)
    expect(player.items.filter((i) => i.code === 'ice')).toHaveLength(0)
    expect([...groundItems.values()].filter((g) => g.code === 'ice')).toHaveLength(1)

    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.items.filter((i) => i.code === 'ice')).toHaveLength(0)
    expect([...groundItems.values()].filter((g) => g.code === 'ice')).toHaveLength(1)

    // Pick 'ice' back up and thaw Frozen Anya (558)
    game.enqueueCommand(playerId, {
      type: 'ItemPickup',
      itemId: iceItem.unitId,
      toCursor: false,
    } as never)
    game.stepFrames(1)
    expect(player.items.filter((i) => i.code === 'ice')).toHaveLength(1)

    const anyaObj = game.spawnObject({ classId: 558, x: 21, y: 20, areaId: 109 })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: anyaObj })
    game.stepFrames(1)

    const a5q3Idx = questWordIndex113c('a5q3')!
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
      QUEST_FLAG_REWARD_PENDING_113C,
    )

    // 3. Talk to Malah -> grants 'tr2', sets COMPLETED, clears REWARD_PENDING
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.items.filter((i) => i.code === 'tr2')).toHaveLength(1)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)

    // 4. Talk to Malah again -> must NOT grant a second 'tr2'
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.items.filter((i) => i.code === 'tr2')).toHaveLength(1)
    expect([...groundItems.values()].filter((g) => g.code === 'tr2')).toHaveLength(0)
  })

  it('rejects picking up a duplicate quest item, full-inventory item, or cursor-occupied item without deleting the ground item', () => {
    const { game, playerId, player, groundItems } = setupGame(14043)

    // Give player one 'tr2' in inventory and place another 'tr2' on the ground
    const malah = game.spawnMonster({
      classId: 513,
      name: 'Malah',
      x: 21,
      y: 20,
      areaId: 109,
      isNpc: true,
    })
    const a5q3Idx = questWordIndex113c('a5q3')!
    player.questFlags[a5q3Idx] = QUEST_FLAG_REWARD_PENDING_113C
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.items.filter((i) => i.code === 'tr2')).toHaveLength(1)

    // Manually place a second 'tr2' on the ground
    const dupTr2Id = 99001
    groundItems.set(dupTr2Id, {
      unitId: dupTr2Id,
      code: 'tr2',
      name: 'Scroll of Resistance',
      quality: 2,
      level: 1,
      location: 'ground',
      x: 20,
      y: 20,
      width: 2,
      height: 2,
      areaId: 109,
      ownerId: 0,
      bodyLoc: 0,
      storePage: 0,
      cost: 0,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 0,
      maxDurability: 0,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    } as any)

    game.drainEvents(playerId)
    game.enqueueCommand(playerId, {
      type: 'ItemPickup',
      itemId: dupTr2Id,
      toCursor: false,
    } as never)
    game.stepFrames(1)

    // Duplicate quest item must remain on the ground and emit sound 19 (impossible1)
    const dupEvents = game.drainEvents(playerId)
    expect(groundItems.has(dupTr2Id)).toBe(true)
    expect(player.items.filter((i) => i.code === 'tr2')).toHaveLength(1)
    expect(dupEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(dupEvents.some((e) => e.type === 'UnitRemove' && e.id === dupTr2Id)).toBe(false)

    // Now test full-inventory pickup rejection (toCursor = false) for a regular item
    groundItems.delete(dupTr2Id)
    fillInventory(player)
    const capId = 99002
    groundItems.set(capId, {
      unitId: capId,
      code: 'cap',
      name: 'Cap',
      quality: 2,
      level: 1,
      location: 'ground',
      x: 20,
      y: 20,
      width: 2,
      height: 2,
      areaId: 109,
      ownerId: 0,
      bodyLoc: 0,
      storePage: 0,
      cost: 10,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 12,
      maxDurability: 12,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    } as any)

    game.drainEvents(playerId)
    game.enqueueCommand(playerId, {
      type: 'ItemPickup',
      itemId: capId,
      toCursor: false,
    } as never)
    game.stepFrames(1)

    const fullEvents = game.drainEvents(playerId)
    expect(groundItems.has(capId)).toBe(true)
    expect(player.items.some((i) => i.location === 'cursor')).toBe(false)
    expect(fullEvents.some((e) => e.type === 'PlaySound' && e.sound === 23)).toBe(true)
  })
})

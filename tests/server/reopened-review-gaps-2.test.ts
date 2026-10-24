/**
 * Regression tests for the second review pass on the reopened issues:
 * #1341 aidel think cadence, #1342 flying/terrain, #1343 melee ally wind-up +
 * El1..3, #1348 Conviction defense / pet resist, #1350 warp auto-approach,
 * #1352 numeric OperateFn dispatch, #1356 buyback store page, #1358 Anya
 * wearable gate, #1359 duplicate set pieces / merc MF / sparkling chest.
 */
import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { OBJECTS_TXT_113C } from '../../src/common/world/objects-txt-113c.ts'
import { classifyObjectOperate113c } from '../../src/common/world/object-operate-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { UnitStatList } from '../../src/server/engine/stat-list.ts'

type AnyRecord = Record<string, any>

function internal(game: GameInstance): AnyRecord {
  return game as unknown as AnyRecord
}

function item(unitId: number, code: string, overrides: AnyRecord = {}): AnyRecord {
  return {
    unitId,
    code,
    name: code,
    quality: 2,
    level: 20,
    location: 'inventory',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    areaId: 1,
    ownerId: 1,
    bodyLoc: 0,
    storePage: 0,
    cost: 100,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 10,
    maxDurability: 10,
    quantity: 1,
    stats: new Map(),
    socketedItems: [],
    ...overrides,
  }
}

describe('reopened review pass 2', () => {
  it('#1341 gates AI decisions by aidel while movement stays continuous', () => {
    const game = new GameInstance({ seed: 2001, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'P', x: 10, y: 10, areaId: 1 })
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 10,
      areaId: 1,
      aggroRadius: 40,
      aiDelay: 10,
      hp: 5000,
      maxHp: 5000,
    })
    const monster = internal(game).monsters.get(monsterId) as AnyRecord
    game.stepFrame()
    expect(monster.nextAiFrame).toBe(11)
    const xAfterThink = monster.x as number
    game.stepFrames(5)
    // No new think before frame 11, but the chosen path still advances.
    expect(monster.nextAiFrame).toBe(11)
    expect(monster.x).toBeLessThan(xAfterThink)
    game.stepFrames(5)
    expect(monster.nextAiFrame).toBe(21)
    expect(game.getPlayerState(playerId)!.areaId).toBe(1)
  })

  it('#1342 flying units still use the 4-argument terrain callback', () => {
    const game = new GameInstance({ seed: 2002, areaId: 1 })
    game.setTerrainWalkableCheck((_area, x, y) => !(x >= 11 && x <= 12 && y === 10))
    const g = internal(game)
    expect(g.isMonsterStepWalkable(1, 10, 10, 13, 10, true)).toBe(false)
    expect(g.isMonsterStepWalkable(1, 10, 9, 13, 9, true)).toBe(true)
  })

  it('#1343 melee against a merc uses the action frame and MonStats El1..3', () => {
    const game = new GameInstance({ seed: 2003, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'P', x: 10, y: 30, areaId: 2 })
    const mercId = game.hireMercenary(playerId, { x: 12, y: 10, level: 5, hp: 500, maxHp: 500 })
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 10,
      y: 10,
      areaId: 2,
      hp: 5000,
      maxHp: 5000,
      minDmg: 1,
      maxDmg: 1,
      ar: 100_000,
      aggroRadius: 40,
    })
    const g = internal(game)
    const monster = g.monsters.get(monsterId) as AnyRecord
    monster.elementalAttacks = [
      {
        slot: 1,
        mode: 'A1',
        type: 'fire',
        chancePct: 100,
        min: 50,
        max: 50,
        minDamage: 50,
        maxDamage: 50,
        durationFrames: 0,
      },
    ]
    game.stepFrame()
    expect(monster.pendingAllyAttack).toBeDefined()
    const before = (g.mercenaries.get(mercId) as AnyRecord).hp as number
    game.stepFrames(10)
    expect((g.mercenaries.get(mercId) as AnyRecord).hp).toBeLessThan(before - 40)
  })

  it('#1348 Conviction defense penalty and summon resistances apply', () => {
    const game = new GameInstance({ seed: 2004, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'P', x: 10, y: 10, areaId: 1 })
    const g = internal(game)
    const player = g.players.get(playerId) as AnyRecord
    player.dexterity = 100
    const before = g.computePlayerDefense(player) as number
    g.playerCombatContext(player).stateBus.applyState({
      stateNameOrId: 'conviction',
      sourceSkillId: 123,
      slvl: 10,
      durationFrames: 75,
      stats: { defense_pct: -50 },
    })
    expect(g.computePlayerDefense(player)).toBeLessThan(before)

    const pet = {
      uid: 'pet-1',
      name: 'Pet',
      hp: 100,
      maxHp: 100,
      x: 10,
      y: 10,
      alive: true,
      statList: new UnitStatList(),
      stateBus: undefined,
    }
    pet.statList.setBaseStat('damageresist', 50)
    g.summonManagers.set(playerId, { getActivePets: () => [pet] })
    g.damageMercsAndPetsInRadius(1, 10, 10, 5, 100, 'phys')
    expect(pet.hp).toBe(50)
  })

  it('#1350 a far WarpTo queues a warp pendingInteraction and approaches', () => {
    const game = new GameInstance({ seed: 2005, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'P', x: 10, y: 10, areaId: 1 })
    const g = internal(game)
    g.warpTiles.set(9001, { unitId: 9001, lvlWarpId: 0, areaId: 1, x: 50, y: 50, destAreaId: 2 })
    game.enqueueCommand(playerId, { type: 'WarpTo', warpId: 9001 })
    game.stepFrames(1)
    const player = g.players.get(playerId) as AnyRecord
    expect(player.pendingInteraction).toEqual({ kind: 'warp', id: 9001 })
    const before = Math.hypot((player.x as number) - 50, (player.y as number) - 50)
    game.stepFrames(10)
    expect(Math.hypot((player.x as number) - 50, (player.y as number) - 50)).toBeLessThan(before)
  })

  it('#1352 classifies by numeric OperateFn instead of English names', () => {
    const classFor = (operateFn: number): number =>
      OBJECTS_TXT_113C.findIndex((record) => record.operateFn === operateFn)
    expect(classifyObjectOperate113c(classFor(22))).toBe('well')
    expect(classifyObjectOperate113c(classFor(51))).toBe('stash')
    expect(classifyObjectOperate113c(classFor(32))).toBe('stash')
    expect(classifyObjectOperate113c(classFor(23))).toBe('portal')
    expect(classifyObjectOperate113c(classFor(4))).toBe('container')
    expect(classifyObjectOperate113c(classFor(8))).toBe('door')
    expect(classifyObjectOperate113c(classFor(30))).toBe('trap')
    expect(classifyObjectOperate113c(classFor(0))).toBe('mode')
  })

  it('#1356 buyback places armor / weapons / misc on their own store pages', () => {
    const game = new GameInstance({ seed: 2006, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'P', x: 10, y: 10, areaId: 1 })
    const npcId = game.spawnMonster({
      classId: 154,
      name: 'Charsi',
      x: 11,
      y: 10,
      areaId: 1,
      isNpc: true,
      isVendor: true,
    })
    const g = internal(game)
    const player = g.players.get(playerId) as AnyRecord
    player.activeNpcId = npcId
    player.activeVendorMode = 'trade'
    player.vendorPools.set(npcId, [])
    const sell = (unitId: number, code: string): AnyRecord => {
      player.items.push(item(unitId, code))
      game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: unitId })
      game.stepFrames(1)
      return (player.vendorPools.get(npcId) as AnyRecord[]).find((entry) => entry.unitId === unitId)!
    }
    expect(sell(9001, 'cap').storePage).toBe(1)
    expect(sell(9002, 'ssd').storePage).toBe(2)
    expect(sell(9003, 'hp1').storePage).toBe(4)
  })

  it('#1358 Anya personalizes armor but rejects a potion without consuming the quest', () => {
    const game = new GameInstance({ seed: 2007, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
    const npcId = game.spawnMonster({
      classId: 512,
      name: 'Anya',
      x: 11,
      y: 10,
      areaId: 1,
      isNpc: true,
    })
    const g = internal(game)
    const player = g.players.get(playerId) as AnyRecord
    player.activeNpcId = npcId
    g.setPlayerQuestFlag(player, 'a5q4', 1)
    const potion = item(9001, 'hp1')
    const cap = item(9002, 'cap')
    player.items.push(potion, cap)
    game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9001 })
    game.stepFrames(1)
    expect(potion.name).toBe('hp1')
    game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9002 })
    game.stepFrames(1)
    expect(cap.name).toBe("Hero's cap")
  })

  it('#1359 duplicate set pieces count once, merc MF is summed, sparkling chest has gold/potions', () => {
    const game = new GameInstance({ seed: 2008, areaId: 1 })
    const g = internal(game)
    const tables = getEmbeddedDropTables()
    const setItem = tables.sets.items.entries[0]!
    const ring = { rawItemData: { setItemId: setItem.id } }
    const counts = g.wornSetPieceCounts([ring, ring]) as Map<string, number>
    expect(counts.get(setItem.set)).toBe(1)

    const merc = { equipment: [{ stats: new Map([[80, 50]]), socketedItems: [] }], level: 20 }
    expect(g.sumMercItemStat(merc, 80)).toBe(50)

    const high = g.sparklingChestPlan(6500) as AnyRecord
    expect(high.gold).toBe(5)
    expect(high.potions).toBe(4)
    expect(high.magic).toBe(1)
    const mid = g.sparklingChestPlan(4000) as AnyRecord
    expect(mid.gold).toBe(7)
    const unique = g.sparklingChestPlan(100) as AnyRecord
    expect(unique.quality).toBe(7)
  })
})
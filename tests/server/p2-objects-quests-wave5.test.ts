/**
 * Wave 5 World Objects, Quests & Vendor Parity P2 Suite (#1954–#1963):
 * - #1954: Wilderness Wells (`OperateFn 22`) & Town Healers cleanse mercenary poison/freeze/chill/curses.
 * - #1955: Cursor item guard (`location === 'cursor'`) blocks all world object interactions except Stash (`267`).
 * - #1956: One-way doors (`Op 16, 18, 29`) stay permanently open; normal doors (`Op 8`) check unit/corpse occupancy before closing.
 * - #1957: Act 4 Trapped Soul (`380, 381`, `OperateFn 48`) drops `1..2` potions or gold piles instead of `Act 4 Chest` TC.
 * - #1958: Town NPC `10%` vendor buy & repair discount unlocked by completing the Act's town quest.
 * - #1959: Act 1 Den of Evil (`A1Q1`, `Area 8`) emits `<= 5` remaining-monster count (`S2C 0x5D` `extra`) on kills & Shaman revives.
 * - #1960: Act 1 Andariel (`A1Q6`) sets `0x3000` (not `0x0001`) on kill, unlocks Warriv East travel, and replicates 1.13c Warriv Quest Drop (`Andarielq`).
 * - #1961: Act 2 Horadric Orifice (`152`) rejects `msf`/`vip` (accepts only `hst`), Tainted Sun (`149`) clears solar eclipse (`S2C 0x53`), and Palace Harem (`40 -> 50`) requires `a2q4` gate.
 * - #1962: Act 4 Hellforge (`376`) scales gems by eligible same-area party count (`N` normal + `2N` flawless + `N` perfect + `1` rune) staggered across 4 x 20-frame beats.
 * - #1963: Act 5 Shenk (`#479`, `A5Q1`) death triggers victory catapult bombardment (`missile 422/423`) damaging hostile monsters only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as dropTablesModule from '../../src/common/items/drop-tables.ts'
import {
  computeTransactionCost113c,
  getCanonicalTransactionCostTables,
} from '../../src/common/items/transaction-cost.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import {
  ONE_WAY_DOOR_OPERATE_FNS_113C,
  WELL_CURABLE_STATE_IDS_113C,
} from '../../src/common/world/object-operate-113c.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  getVendorQuestDiscountPct113c,
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_CUSTOM_4_113C,
  QUEST_FLAG_LEAVE_BEFORE_113C,
  QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import { rollTrappedSoulDrops113c } from '../../src/server/world/object-drops-113c.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

function makeItem(
  unitId: number,
  ownerId: number,
  code: string,
  location: 'inventory' | 'equipped' | 'cursor' = 'inventory',
  areaId = 1,
) {
  return {
    unitId,
    code,
    name: code,
    quality: 2,
    level: 10,
    location,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    areaId,
    ownerId,
    bodyLoc: location === 'equipped' ? 4 : 0,
    storePage: location === 'inventory' ? 1 : 0,
    cost: 1000,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 10,
    maxDurability: 20,
    quantity: 1,
    stats: new Map<number, number>(),
    socketedItems: [],
  }
}

function makeMercenary(unitId: number, ownerPlayerId: number, areaId: number, x: number, y: number) {
  return {
    unitId,
    ownerPlayerId,
    act: 1 as const,
    subType: 0,
    classId: 271,
    level: 20,
    difficulty: 0 as const,
    name: 'RogueScout',
    areaId,
    x,
    y,
    hp: 100,
    maxHp: 240,
    damage: 15,
    defense: 60,
    resist: 25,
    reach: 2,
    aggroRadius: 10,
    speed: 6,
    cooldown: 15,
    cooldownTicks: 0,
    activeAura: undefined,
    state: 'idle' as const,
    alive: true,
    experience: 0,
    expPerLvl: 100,
    equipment: [],
    states: new Set<number>(),
    stateTimers: new Map<number, number>(),
  }
}

describe('#1954 Wilderness Wells (OperateFn 22) & Town Healer Mercenary State Cleanse', () => {
  it('cleanses mercenary poison, freeze, chill, and curable curses while preserving buffs on Well drink and Town Healer talk', () => {
    const game = new GameInstance({ seed: 1954, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'MercHero', x: 20, y: 20, areaId: 2 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          hp: number
          maxHp: number
          hpFixed: number
          maxHpFixed: number
          states: Set<number>
          stateTimers: Map<number, number>
        }
      >
      mercenaries: Map<number, ReturnType<typeof makeMercenary>>
    }
    const player = internal.players.get(playerId)!
    player.maxHp = 200
    player.maxHpFixed = 200 * FIXED_ONE
    player.hp = 80
    player.hpFixed = 80 * FIXED_ONE

    const merc = makeMercenary(7001, playerId, 2, 21, 20)
    // Afflict mercenary with Freeze (1), Poison (2), Amplify Damage (9), Chill (11), Decrepify (60), plus non-curable Battle Orders (32).
    for (const s of [1, 2, 9, 11, 60, 32]) {
      merc.states.add(s)
      merc.stateTimers.set(s, 500)
      player.states.add(s)
      player.stateTimers.set(s, 500)
    }
    internal.mercenaries.set(merc.unitId, merc)

    const wellId = game.spawnObject({ classId: 111, x: 20, y: 20, areaId: 2 })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wellId })
    game.stepFrames(1)
    const events = game.drainEvents(playerId)

    expect(merc.hp).toBe(merc.maxHp)
    for (const cured of [1, 2, 9, 11, 60]) {
      if (cured !== 11) {
        expect(WELL_CURABLE_STATE_IDS_113C.includes(cured)).toBe(true)
      }
      expect(merc.states.has(cured), `merc state ${cured} cleared`).toBe(false)
      expect(merc.stateTimers.has(cured)).toBe(false)
      if (cured !== 11) {
        expect(player.states.has(cured), `player state ${cured} cleared`).toBe(false)
      }
      expect(
        events.some(
          (e) =>
            e.type === 'StateEnd' &&
            e.unit.unitType === 1 &&
            e.unit.id === merc.unitId &&
            e.state === cured,
        ),
        `StateEnd emitted for merc state ${cured}`,
      ).toBe(true)
    }
    // Non-curable buff (Battle Orders = 32) remains intact on both player and mercenary.
    expect(merc.states.has(32)).toBe(true)
    expect(player.states.has(32)).toBe(true)

    // Re-afflict mercenary and verify Town Healer (Akara, hcIdx 148) also cleanses mercenary states.
    for (const s of [1, 2, 9, 11, 60]) {
      merc.states.add(s)
      merc.stateTimers.set(s, 400)
    }
    merc.hp = 50
    const akaraId = game.spawnMonster({
      classId: 148,
      name: 'Akara',
      x: 21,
      y: 20,
      areaId: 2,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: akaraId } } as never)
    game.stepFrames(1)

    expect(merc.hp).toBe(merc.maxHp)
    for (const cured of [1, 2, 9, 11, 60]) {
      expect(merc.states.has(cured)).toBe(false)
    }
    expect(merc.states.has(32)).toBe(true)
  })
})

describe('#1955 Cursor Item Guard on World Object Interactions', () => {
  it('blocks chests, shrines, doors, waypoints, portals, warp tiles, and Telekinesis while holding a cursor item, except Town Stash (267)', () => {
    const game = new GameInstance({ seed: 1955, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'CursorGuard', x: 10, y: 10, areaId: 1 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          areaId: number
          activeWaypointUnitId: number
          items: ReturnType<typeof makeItem>[]
        }
      >
      objects: Map<number, { mode: number; destAreaId?: number }>
      warpTiles: Map<
        number,
        { unitId: number; lvlWarpId: number; areaId: number; x: number; y: number; destAreaId: number }
      >
    }
    const player = internal.players.get(playerId)!
    const cursorItem = makeItem(8101, playerId, 'cap', 'cursor', 1)
    player.items.push(cursorItem)

    const chestId = game.spawnObject({ classId: 5, x: 11, y: 10, areaId: 1 })
    const shrineId = game.spawnObject({ classId: 2, x: 10, y: 11, areaId: 1 })
    const doorId = game.spawnObject({ classId: 13, x: 9, y: 10, areaId: 1 })
    const waypointId = game.spawnObject({ classId: 119, x: 10, y: 9, areaId: 1 })
    const portalId = game.spawnObject({ classId: 59, x: 11, y: 11, areaId: 1, mode: 2 })
    internal.objects.get(portalId)!.destAreaId = 2
    const stashId = game.spawnObject({ classId: 267, x: 11, y: 9, areaId: 1 })
    internal.warpTiles.set(955, {
      unitId: 955,
      lvlWarpId: 0,
      areaId: 1,
      x: 10,
      y: 11,
      destAreaId: 2,
    })

    game.drainEvents(playerId)
    for (const id of [chestId, shrineId, doorId, waypointId, portalId]) {
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: id })
    }
    // Warp tile interaction (unitType 5) must also be blocked while holding a cursor item.
    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 5, id: 955 } })
    game.stepFrames(1)

    expect(internal.objects.get(chestId)!.mode).toBe(0)
    expect(internal.objects.get(shrineId)!.mode).toBe(0)
    expect(internal.objects.get(doorId)!.mode).toBe(0)
    expect(player.activeWaypointUnitId).toBe(0)
    expect(player.areaId).toBe(1)
    const blockedEvents = game.drainEvents(playerId)
    expect(blockedEvents.some((e) => e.type === 'WaypointMenu')).toBe(false)

    // Town Personal Stash (classId 267) IS allowed while holding a cursor item so players can deposit it!
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: stashId })
    game.stepFrames(1)
    const stashEvents = game.drainEvents(playerId)
    expect(stashEvents.some((e) => e.type === 'Trade' && e.action === 0x10)).toBe(true)

    // Once cursor item is placed in inventory, operating chest succeeds normally.
    cursorItem.location = 'inventory'
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: chestId })
    game.stepFrames(1)
    expect(internal.objects.get(chestId)!.mode).toBe(2)
  })
})

describe('#1956 One-Way Doors (Op 16, 18, 29) & Unit-Blocked Door Closing (Op 8)', () => {
  it('keeps Trap Door (74), Secret Door (129), and Slime/Grate Doors (229, 230) permanently open once operated', () => {
    expect([...ONE_WAY_DOOR_OPERATE_FNS_113C].sort((a, b) => a - b)).toEqual([16, 18, 29])
    const game = new GameInstance({ seed: 1956, areaId: 20 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'DoorOpener', x: 10, y: 10, areaId: 20 })
    const objects = (game as unknown as { objects: Map<number, { mode: number }> }).objects

    for (const classId of [74, 129, 229, 230]) {
      const doorId = game.spawnObject({ classId, x: 11, y: 10, areaId: 20 })
      expect(objects.get(doorId)!.mode).toBe(0)

      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: doorId })
      game.stepFrames(1)
      expect(objects.get(doorId)!.mode, `one-way door ${classId} opens`).toBe(2)

      // Operating again must NOT toggle a one-way door closed!
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: doorId })
      game.stepFrames(1)
      expect(objects.get(doorId)!.mode, `one-way door ${classId} stays open`).toBe(2)
    }
  })

  it('prevents normal doors (Op 8) from closing while a living monster, unconsumed corpse, or player occupies the doorway', () => {
    const game = new GameInstance({ seed: 195602, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'ama', name: 'DoorGuard', x: 10, y: 10, areaId: 2 })
    const internal = game as unknown as {
      objects: Map<number, { mode: number }>
      monsters: Map<number, { dead: boolean; corpseConsumed?: boolean; x: number; y: number }>
    }

    const doorId = game.spawnObject({ classId: 13, x: 12, y: 10, areaId: 2 })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: doorId })
    game.stepFrames(1)
    expect(internal.objects.get(doorId)!.mode).toBe(2)

    // 1. Living monster standing in the doorway blocks closing.
    const monId = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 2,
      hp: 50,
      maxHp: 50,
      aiDisabled: true,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: doorId })
    game.stepFrames(1)
    expect(internal.objects.get(doorId)!.mode).toBe(2)

    // 2. Monster dies leaving an unconsumed corpse on the door tile -> still blocks closing!
    game.applyDamageToMonster(monId, 500, playerId)
    expect(internal.monsters.get(monId)!.dead).toBe(true)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: doorId })
    game.stepFrames(1)
    expect(internal.objects.get(doorId)!.mode).toBe(2)

    // 3. Once the corpse is consumed/cleared, the door closes cleanly back to mode 0!
    internal.monsters.get(monId)!.corpseConsumed = true
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: doorId })
    game.stepFrames(1)
    expect(internal.objects.get(doorId)!.mode).toBe(0)
  })
})

describe('#1957 Act 4 Trapped Soul (Objects 380 / 381, OperateFn 48)', () => {
  it('drops 1..2 healing/mana potions or gold piles and never rolls Act 4 Chest equipment TCs', () => {
    const allowedCodes = new Set([
      'gld',
      'hp1',
      'hp2',
      'hp3',
      'hp4',
      'hp5',
      'mp1',
      'mp2',
      'mp3',
      'mp4',
      'mp5',
    ])
    let sawGold = false
    let sawPotion = false
    for (let seed = 1; seed <= 120; seed++) {
      const drops = rollTrappedSoulDrops113c(105, 1, 50, new D2Rng(seed))
      expect(drops.length).toBeGreaterThanOrEqual(1)
      expect(drops.length).toBeLessThanOrEqual(2)
      for (const d of drops) {
        const code = (d.code ?? d.base.id).trim().toLowerCase()
        expect(allowedCodes.has(code), `unexpected Trapped Soul drop code: ${code}`).toBe(true)
        if (code === 'gld') sawGold = true
        else sawPotion = true
      }
    }
    expect(sawGold).toBe(true)
    expect(sawPotion).toBe(true)

    const spy = vi.spyOn(dropTablesModule, 'executeDropPipeline')
    const game = new GameInstance({ seed: 1957, difficulty: 2, areaId: 105 })
    const playerId = game.connectPlayer({ charClass: 'nec', name: 'SoulSaver', x: 10, y: 10, areaId: 105 })
    const objects = (game as unknown as { objects: Map<number, { mode: number }> }).objects

    for (const classId of [380, 381]) {
      const soulId = game.spawnObject({ classId, x: 11, y: 10, areaId: 105 })
      const before = game.getGroundItems().length
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: soulId })
      game.stepFrames(1)
      expect(objects.get(soulId)!.mode).toBe(2)
      const afterItems = game.getGroundItems().slice(before)
      expect(afterItems.length).toBeGreaterThanOrEqual(1)
      expect(afterItems.length).toBeLessThanOrEqual(2)
      for (const item of afterItems) {
        expect(allowedCodes.has(item.code.trim().toLowerCase())).toBe(true)
      }
    }
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('#1958 Town NPC 10% Quest Vendor Buy & Repair Discount', () => {
  it('unlocks 10% buy & repair discount per Act town quest across all 5 Acts without discounting sell or gamble', () => {
    const quests = new Uint16Array(48)
    expect(getVendorQuestDiscountPct113c(quests, 154)).toBe(0)

    quests[questWordIndex113c('a1q3')!] = QUEST_FLAG_COMPLETED_113C
    expect(getVendorQuestDiscountPct113c(quests, 147)).toBe(10)
    expect(getVendorQuestDiscountPct113c(quests, 148)).toBe(10)
    expect(getVendorQuestDiscountPct113c(quests, 154)).toBe(10)
    expect(getVendorQuestDiscountPct113c(quests, 150)).toBe(0)

    quests[questWordIndex113c('a2q1')!] = QUEST_FLAG_COMPLETED_113C
    for (const hcIdx of [176, 177, 178, 199, 202]) {
      expect(getVendorQuestDiscountPct113c(quests, hcIdx)).toBe(10)
    }

    quests[questWordIndex113c('a3q2')!] = QUEST_FLAG_COMPLETED_113C
    for (const hcIdx of [252, 253, 254, 255]) {
      expect(getVendorQuestDiscountPct113c(quests, hcIdx)).toBe(10)
    }

    quests[questWordIndex113c('a4q1')!] = QUEST_FLAG_COMPLETED_113C
    expect(getVendorQuestDiscountPct113c(quests, 257)).toBe(10)
    expect(getVendorQuestDiscountPct113c(quests, 405)).toBe(10)

    quests[questWordIndex113c('a5q3')!] = QUEST_FLAG_COMPLETED_113C
    for (const hcIdx of [511, 512, 513, 514]) {
      expect(getVendorQuestDiscountPct113c(quests, hcIdx)).toBe(10)
    }

    const tables = getCanonicalTransactionCostTables()
    const swordInput = {
      code: 'lsd',
      itemFormat: 100,
      quality: 2 as const,
      identified: true,
      ethereal: false,
      starterItem: false,
      isEar: false,
      stats: [
        { statId: 72, param: 0, value: 10, base: 10 },
        { statId: 73, param: 0, value: 44, base: 44 },
      ],
      socketedChildCodes: [],
    }
    const baseBuy = computeTransactionCost113c(
      swordInput,
      {
        difficulty: 0,
        playerLevel: 20,
        playerReducedPricesPct: 0,
        npcClass: 154,
        isQuestFlagSet: () => false,
        questDiscountPct: 0,
        tables,
      },
      0,
    )
    const discBuy = computeTransactionCost113c(
      swordInput,
      {
        difficulty: 0,
        playerLevel: 20,
        playerReducedPricesPct: 0,
        npcClass: 154,
        isQuestFlagSet: () => false,
        questDiscountPct: 10,
        tables,
      },
      0,
    )
    expect(discBuy).toBeLessThan(baseBuy)
    expect(discBuy).toBe(Math.floor((baseBuy * 90) / 100))

    const baseRepair = computeTransactionCost113c(
      swordInput,
      {
        difficulty: 0,
        playerLevel: 20,
        playerReducedPricesPct: 0,
        npcClass: 154,
        isQuestFlagSet: () => false,
        questDiscountPct: 0,
        tables,
      },
      3,
    )
    const discRepair = computeTransactionCost113c(
      swordInput,
      {
        difficulty: 0,
        playerLevel: 20,
        playerReducedPricesPct: 0,
        npcClass: 154,
        isQuestFlagSet: () => false,
        questDiscountPct: 10,
        tables,
      },
      3,
    )
    expect(discRepair).toBeLessThan(baseRepair)
    expect(discRepair).toBe(Math.floor((baseRepair * 90) / 100))

    // End-to-end GameInstance test with Charsi (154): buy & repair drop by 10% once A1Q3 (Cain) is completed!
    const game = new GameInstance({ seed: 1958, difficulty: 0, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Bargainer', x: 10, y: 10, areaId: 1 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          gold: number
          questFlags: Uint16Array
          vendorPools: Map<number, { unitId: number; cost: number; code: string }[]>
          items: ReturnType<typeof makeItem>[]
        }
      >
      serverItemPrice113c: (p: unknown, npcHcIdx: number, entry: unknown, type: number) => number
    }
    const player = internal.players.get(playerId)!
    player.gold = 500_000

    const charsiId = game.spawnMonster({
      classId: 154,
      name: 'Charsi',
      x: 11,
      y: 10,
      areaId: 1,
      isNpc: true,
      isVendor: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId: charsiId, action: 'trade' } as never)
    game.stepFrames(1)

    const pool = player.vendorPools.get(charsiId)!
    const targetShopItem = pool.find((entry) => entry.cost >= 100) ?? pool[0]!
    const costBefore = targetShopItem.cost

    const damagedSword = makeItem(8501, playerId, 'lsd', 'equipped', 1)
    damagedSword.cost = 2000
    damagedSword.durability = 5
    damagedSword.maxDurability = 44
    player.items.push(damagedSword)
    const repairBefore = internal.serverItemPrice113c(player, 154, damagedSword, 3)
    const sellBefore = internal.serverItemPrice113c(player, 154, damagedSword, 1)

    // Complete A1Q3 (Search for Cain) and re-open Charsi's trade window -> prices update with 10% discount!
    player.questFlags[questWordIndex113c('a1q3')!] = QUEST_FLAG_COMPLETED_113C
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId: charsiId, action: 'trade' } as never)
    game.stepFrames(1)

    expect(targetShopItem.cost).toBeLessThan(costBefore)
    expect(targetShopItem.cost).toBe(internal.serverItemPrice113c(player, 154, targetShopItem, 0))
    const repairAfter = internal.serverItemPrice113c(player, 154, damagedSword, 3)
    const sellAfter = internal.serverItemPrice113c(player, 154, damagedSword, 1)
    expect(repairAfter).toBeLessThan(repairBefore)
    expect(sellAfter).toBe(sellBefore)

    const goldBeforeBuy = player.gold
    game.enqueueCommand(playerId, {
      type: 'NpcBuy',
      npcId: charsiId,
      itemId: targetShopItem.unitId,
      cost: 0,
    } as never)
    game.stepFrames(1)
    expect(player.gold).toBe(goldBeforeBuy - targetShopItem.cost)
  })
})

describe('#1959 Act 1 Den of Evil (A1Q1, Area 8) Remaining Monster Counter', () => {
  it('emits S2C 0x5D remaining-monster count when <= 5 monsters remain in Area 8 and updates when a Shaman revives a Fallen', () => {
    const game = new GameInstance({ seed: 1959, areaId: 8 })
    const playerId = game.connectPlayer({ charClass: 'ama', name: 'DenCleaner', x: 10, y: 10, areaId: 8 })
    const monsters: number[] = []
    const shamanId = game.spawnMonster({
      defId: 'fallenshaman1',
      x: 20,
      y: 20,
      areaId: 8,
      hp: 20,
      maxHp: 20,
      aiDisabled: true,
    })
    monsters.push(shamanId)
    for (let i = 0; i < 6; i++) {
      monsters.push(
        game.spawnMonster({
          defId: 'fallen1',
          x: 12 + i,
          y: 10,
          areaId: 8,
          hp: 10,
          maxHp: 10,
          aiDisabled: true,
        }),
      )
    }

    // 7 monsters total -> kill 1st Fallen (6 remaining > 5): no remaining-count 0x5D packet yet.
    game.drainEvents(playerId)
    game.applyDamageToMonster(monsters[1]!, 500, playerId)
    const ev6 = game.drainEvents(playerId)
    expect(
      ev6.some(
        (e) =>
          e.type === 'QuestState' &&
          e.kind === 'status' &&
          e.questStatus?.questId === 1 &&
          (e.questStatus?.extra ?? 0) > 0,
      ),
    ).toBe(false)

    // Kill 2nd Fallen -> 5 remaining: emits QuestState status with extra = 5!
    game.applyDamageToMonster(monsters[2]!, 500, playerId)
    const ev5 = game.drainEvents(playerId)
    expect(
      ev5.some(
        (e) =>
          e.type === 'QuestState' &&
          e.kind === 'status' &&
          e.questStatus?.questId === 1 &&
          e.questStatus?.extra === 5,
      ),
    ).toBe(true)

    // Kill 3rd Fallen -> 4 remaining: emits extra = 4!
    game.applyDamageToMonster(monsters[3]!, 500, playerId)
    const ev4 = game.drainEvents(playerId)
    expect(
      ev4.some(
        (e) =>
          e.type === 'QuestState' &&
          e.kind === 'status' &&
          e.questStatus?.questId === 1 &&
          e.questStatus?.extra === 4,
      ),
    ).toBe(true)

    // Shaman resurrects a dead Fallen -> count climbs back to 5 and emits extra = 5!
    const internal = game as unknown as {
      monsters: Map<number, unknown>
      reviveMonsterCorpse: (caster: unknown, corpse: unknown) => void
      players: Map<number, { questFlags: Uint16Array }>
    }
    internal.reviveMonsterCorpse(
      internal.monsters.get(shamanId)!,
      internal.monsters.get(monsters[3]!)!,
    )
    const evRevive = game.drainEvents(playerId)
    expect(
      evRevive.some(
        (e) =>
          e.type === 'QuestState' &&
          e.kind === 'status' &&
          e.questStatus?.questId === 1 &&
          e.questStatus?.extra === 5,
      ),
    ).toBe(true)

    // Kill all remaining living monsters -> completes Den of Evil!
    for (const id of [shamanId, monsters[3]!, monsters[4]!, monsters[5]!, monsters[6]!]) {
      game.applyDamageToMonster(id, 500, playerId)
    }
    const a1q1Bits = internal.players.get(playerId)!.questFlags[questWordIndex113c('a1q1')!]!
    expect(a1q1Bits & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
  })
})

describe('#1960 Act 1 Sisters to the Slaughter (A1Q6 Andariel & Warriv Quest Drop)', () => {
  it('sets 0x3000 on Andariel death, unlocks Warriv East travel, preserves Andarielq when talking to Warriv same-game, and drops Andariel if exited before Warriv', () => {
    const spy = vi.spyOn(dropTablesModule, 'executeDropPipeline')
    const a1q6Idx = questWordIndex113c('a1q6')!

    // Game 1: fresh character kills Andariel in Area 37.
    const game1 = new GameInstance({ seed: 1960, areaId: 37 })
    const p1 = game1.connectPlayer({ charClass: 'sor', name: 'AndyRunner', x: 10, y: 10, areaId: 37 })
    const player1 = (
      game1 as unknown as { players: Map<number, { areaId: number; questFlags: Uint16Array }> }
    ).players.get(p1)!

    const andy1 = game1.spawnMonster({
      defId: 'andariel',
      x: 12,
      y: 10,
      areaId: 37,
      hp: 10,
      maxHp: 10,
      aiDisabled: true,
    })
    game1.applyDamageToMonster(andy1, 500, p1)

    expect(spy).toHaveBeenCalledTimes(1)
    expect((spy.mock.calls[0]![1] as dropTablesModule.DropPipelineOptions).tcName).toBe('Andarielq')
    // Must set 0x3000 (PRIMARY_GOAL_DONE | COMPLETED_NOW) and NOT 0x0001 before Warriv!
    expect(player1.questFlags[a1q6Idx]).toBe(
      QUEST_FLAG_PRIMARY_GOAL_DONE_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(player1.questFlags[a1q6Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(0)

    const savedBeforeWarriv = new Uint16Array(player1.questFlags)

    // Return to Rogue Encampment (Area 1) in the SAME game and talk/travel East with Warriv (hcIdx 155).
    player1.areaId = 1
    const warriv1 = game1.spawnMonster({
      classId: 155,
      name: 'Warriv',
      x: 11,
      y: 10,
      areaId: 1,
      isNpc: true,
    })
    game1.drainEvents(p1)
    game1.enqueueCommand(p1, { type: 'NpcInit', target: { unitType: 1, id: warriv1 } } as never)
    game1.stepFrames(1)
    const warrivEvents = game1.drainEvents(p1)
    expect(warrivEvents.some((e) => e.type === 'CanGoToAct' && e.act === 1)).toBe(true)
    expect(player1.questFlags[a1q6Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player1.questFlags[a1q6Idx]! & QUEST_FLAG_CUSTOM_4_113C).toBe(QUEST_FLAG_CUSTOM_4_113C)

    // Game 2A (classic 1.13c Quest Bug): join new game with same-game-Warriv flags -> Andariel STILL drops Andarielq!
    spy.mockClear()
    const game2a = new GameInstance({ seed: 19601, areaId: 37 })
    const p2a = game2a.connectPlayer({
      charClass: 'sor',
      name: 'AndyBugged',
      x: 10,
      y: 10,
      areaId: 37,
      questFlags: new Uint16Array(player1.questFlags),
    })
    const andy2a = game2a.spawnMonster({
      defId: 'andariel',
      x: 12,
      y: 10,
      areaId: 37,
      hp: 10,
      maxHp: 10,
      aiDisabled: true,
    })
    game2a.applyDamageToMonster(andy2a, 500, p2a)
    expect((spy.mock.calls[0]![1] as dropTablesModule.DropPipelineOptions).tcName).toBe('Andarielq')

    // Game 2B (exited WITHOUT talking to Warriv): connectPlayer clears 0x2000 & sets 0x8000; talking to Warriv sets 0x0001 without 0x0010 -> subsequent kills drop regular Andariel!
    const game2b = new GameInstance({ seed: 19602, areaId: 1 })
    const p2b = game2b.connectPlayer({
      charClass: 'sor',
      name: 'AndyUnbugged',
      x: 10,
      y: 10,
      areaId: 1,
      questFlags: savedBeforeWarriv,
    })
    const player2b = (
      game2b as unknown as { players: Map<number, { questFlags: Uint16Array }> }
    ).players.get(p2b)!
    expect(player2b.questFlags[a1q6Idx]! & QUEST_FLAG_COMPLETED_NOW_113C).toBe(0)
    expect(player2b.questFlags[a1q6Idx]! & QUEST_FLAG_LEAVE_BEFORE_113C).toBe(
      QUEST_FLAG_LEAVE_BEFORE_113C,
    )
    const warriv2b = game2b.spawnMonster({
      classId: 155,
      name: 'Warriv',
      x: 11,
      y: 10,
      areaId: 1,
      isNpc: true,
    })
    game2b.enqueueCommand(p2b, { type: 'NpcInit', target: { unitType: 1, id: warriv2b } } as never)
    game2b.stepFrames(1)
    expect(player2b.questFlags[a1q6Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player2b.questFlags[a1q6Idx]! & QUEST_FLAG_CUSTOM_4_113C).toBe(0)

    spy.mockClear()
    const game3 = new GameInstance({ seed: 19603, areaId: 37 })
    const p3 = game3.connectPlayer({
      charClass: 'sor',
      name: 'AndyNormalDrop',
      x: 10,
      y: 10,
      areaId: 37,
      questFlags: new Uint16Array(player2b.questFlags),
    })
    const andy3 = game3.spawnMonster({
      defId: 'andariel',
      x: 12,
      y: 10,
      areaId: 37,
      hp: 10,
      maxHp: 10,
      aiDisabled: true,
    })
    game3.applyDamageToMonster(andy3, 500, p3)
    expect((spy.mock.calls[0]![1] as dropTablesModule.DropPipelineOptions).tcName).toBe('Andariel')
  })
})

describe('#1961 Act 2 Horadric Orifice (152), Tainted Sun Eclipse (149), & Palace Harem Gate (40 -> 50)', () => {
  it('rejects incomplete msf/vip at Horadric Orifice (152) and accepts only transmuted hst', () => {
    const game = new GameInstance({ seed: 1961, areaId: 72 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'TombRaider', x: 10, y: 10, areaId: 72 })
    const internal = game as unknown as {
      players: Map<
        number,
        { questFlags: Uint16Array; items: ReturnType<typeof makeItem>[] }
      >
      objects: Map<number, { classId: number; mode: number; destAreaId?: number }>
    }
    const player = internal.players.get(playerId)!
    player.items.push(
      makeItem(8601, playerId, 'msf', 'inventory', 72),
      makeItem(8602, playerId, 'vip', 'inventory', 72),
    )

    const orificeId = game.spawnObject({ classId: 152, x: 11, y: 10, areaId: 72 })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: orificeId })
    game.stepFrames(1)
    const rejectEvents = game.drainEvents(playerId)

    expect(internal.objects.get(orificeId)!.mode).toBe(0)
    expect(player.items.some((i) => i.code === 'msf')).toBe(true)
    expect(player.items.some((i) => i.code === 'vip')).toBe(true)
    expect(player.questFlags[questWordIndex113c('a2q2')!]).toBe(0)
    expect(rejectEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)

    // Replace with assembled Horadric Staff ('hst') -> consumes 'hst', completes a2q2, and opens Duriel's Lair (100) after 18 frames!
    player.items = [makeItem(8603, playerId, 'hst', 'inventory', 72)]
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: orificeId })
    game.stepFrames(1)
    expect(internal.objects.get(orificeId)!.mode).toBe(2)
    expect(player.items).toHaveLength(0)
    expect(player.questFlags[questWordIndex113c('a2q2')!]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
    game.stepFrames(18)
    expect([...internal.objects.values()].some((o) => o.classId === 100 && o.destAreaId === 73)).toBe(
      true,
    )
  })

  it('activates solar eclipse in Tainted Sun areas, broadcasts S2C 0x53 eclipse=false on Altar (149) smash, and gates Palace Harem (40 -> 50) on Drognan/Jerhyn talk', () => {
    const game = new GameInstance({ seed: 196102, areaId: 40 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'SunSeeker', x: 10, y: 10, areaId: 40 })
    const internal = game as unknown as {
      players: Map<number, { areaId: number; x: number; y: number; questFlags: Uint16Array }>
      warpTiles: Map<
        number,
        { unitId: number; lvlWarpId: number; areaId: number; x: number; y: number; destAreaId: number }
      >
      transitionPlayerArea: (p: unknown, destAreaId: number, arrival: { kind: 'warp' }) => boolean
    }
    const player = internal.players.get(playerId)!
    internal.warpTiles.set(950, {
      unitId: 950,
      lvlWarpId: 24,
      areaId: 40,
      x: 11,
      y: 10,
      destAreaId: 50,
    })

    // 1. Before Tainted Sun & Drognan/Jerhyn talk, entering Harem Level 1 (40 -> 50) via warp is blocked!
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 5, id: 950 } })
    game.stepFrames(1)
    expect(player.areaId).toBe(40)
    const blockedEvents = game.drainEvents(playerId)
    expect(
      blockedEvents.some(
        (e) => e.type === 'Chat' && e.kind === 'system' && e.text.includes('Unable to enter area 50'),
      ),
    ).toBe(true)
    expect(blockedEvents.some((e) => e.type === 'UnitReassign' && e.areaId === 40)).toBe(true)

    // 2. Entering Claw Viper Temple Level 2 (61) emits EnvironmentSync with eclipse = true and starts a2q3.
    expect(internal.transitionPlayerArea(player, 61, { kind: 'warp' })).toBe(true)
    player.x = 10
    player.y = 10
    const enterEclipseEvents = game.drainEvents(playerId)
    expect(
      enterEclipseEvents.some(
        (e): e is Extract<ServerEvent, { type: 'EnvironmentSync' }> =>
          e.type === 'EnvironmentSync' && e.eclipse === true,
      ),
    ).toBe(true)
    expect(player.questFlags[questWordIndex113c('a2q3')!]! & QUEST_FLAG_STARTED_113C).toBe(
      QUEST_FLAG_STARTED_113C,
    )

    // 3. Smashing Tainted Sun Altar (149) completes a2q3 and broadcasts EnvironmentSync with eclipse = false!
    const altarId = game.spawnObject({ classId: 149, x: 11, y: 10, areaId: 61 })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: altarId })
    game.stepFrames(1)
    const clearEvents = game.drainEvents(playerId)
    expect(
      clearEvents.some(
        (e): e is Extract<ServerEvent, { type: 'EnvironmentSync' }> =>
          e.type === 'EnvironmentSync' && e.eclipse === false,
      ),
    ).toBe(true)
    expect(player.questFlags[questWordIndex113c('a2q3')!]! & QUEST_FLAG_COMPLETED_113C).toBe(1)

    // 4. Return to Lut Gholein (40): Harem (50) is STILL gated until talking to Drognan (177) or Jerhyn (201)!
    expect(internal.transitionPlayerArea(player, 40, { kind: 'warp' })).toBe(true)
    player.x = 10
    player.y = 10
    game.stepFrames(30)
    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 5, id: 950 } })
    game.stepFrames(1)
    expect(player.areaId).toBe(40)

    const jerhynId = game.spawnMonster({
      classId: 201,
      name: 'Jerhyn',
      x: 11,
      y: 10,
      areaId: 40,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: jerhynId } } as never)
    game.stepFrames(1)
    expect(player.questFlags[questWordIndex113c('a2q4')!]! & QUEST_FLAG_STARTED_113C).toBe(
      QUEST_FLAG_STARTED_113C,
    )

    game.stepFrames(30)
    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 5, id: 950 } })
    game.stepFrames(1)
    expect(player.areaId).toBe(50)
  })
})

describe('#1962 Act 4 Hellforge (A4Q2, Object 376) Party Gem Scaling & 20-Frame Stagger', () => {
  it('scales normal/flawless/perfect gems by eligible same-area party count while keeping 1 rune across 4 x 20-frame beats', () => {
    const game = new GameInstance({ seed: 1962, difficulty: 2, areaId: 107, maxPlayers: 8 })
    const p1 = game.connectPlayer({ charClass: 'pal', name: 'Smasher', x: 10, y: 10, areaId: 107 })
    const p2 = game.connectPlayer({ charClass: 'sor', name: 'PartyAlly', x: 12, y: 10, areaId: 107 })
    const p3 = game.connectPlayer({ charClass: 'bar', name: 'SoloBystander', x: 13, y: 10, areaId: 107 })

    game.enqueueCommand(p1, { type: 'PartyAction', action: 'invite', targetPlayerId: p2 } as never)
    game.stepFrames(1)
    game.enqueueCommand(p2, { type: 'PartyAction', action: 'accept', targetPlayerId: p1 } as never)
    game.stepFrames(1)

    const internal = game as unknown as {
      players: Map<number, { questFlags: Uint16Array; items: ReturnType<typeof makeItem>[] }>
    }
    const player1 = internal.players.get(p1)!
    player1.items.push(
      makeItem(8701, p1, 'mss', 'inventory', 107),
      makeItem(8702, p1, 'hfh', 'equipped', 107),
    )

    const forgeId = game.spawnObject({ classId: 376, x: 11, y: 10, areaId: 107 })
    // Place soulstone + 3 hammer hits
    for (let i = 0; i < 4; i++) {
      game.enqueueCommand(p1, { type: 'OperateObject', objectId: forgeId })
      game.stepFrames(1)
    }

    const a4q2Idx = questWordIndex113c('a4q2')!
    expect(player1.questFlags[a4q2Idx]).toBe(
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(internal.players.get(p2)!.questFlags[a4q2Idx]).toBe(
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    // Unpartied bystander gets 0 credit and does NOT inflate gem count!
    expect(internal.players.get(p3)!.questFlags[a4q2Idx]).toBe(0)

    // Staggered 4 x 20-frame drops for N = 2 party members: +20 -> 2 normal, +40 -> +4 flawless (6), +60 -> +2 perfect (8), +80 -> +1 rune (9)!
    expect(game.getGroundItems()).toHaveLength(0)
    game.stepFrames(20)
    expect(game.getGroundItems()).toHaveLength(2)
    game.stepFrames(20)
    expect(game.getGroundItems()).toHaveLength(6)
    game.stepFrames(20)
    expect(game.getGroundItems()).toHaveLength(8)
    game.stepFrames(20)
    const allDrops = game.getGroundItems()
    expect(allDrops).toHaveLength(9)
    const runeDrops = allDrops.filter((d) => /^r\d\d$/i.test(d.code.trim()))
    expect(runeDrops).toHaveLength(1)
  })
})

describe('#1963 Act 5 Siege on Harrogath (Shenk #479 Victory Catapult Bombardment)', () => {
  it('launches catapult meteor missiles (422 / 423) around Shenk on death and damages nearby hostile monsters without hurting players or mercenaries', () => {
    const game = new GameInstance({ seed: 1963, areaId: 110 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'SiegeBreaker', x: 30, y: 30, areaId: 110 })
    const internal = game as unknown as {
      players: Map<number, { hp: number; maxHp: number; hpFixed: number; maxHpFixed: number }>
      mercenaries: Map<number, ReturnType<typeof makeMercenary>>
    }
    const player = internal.players.get(playerId)!
    player.maxHp = 300
    player.maxHpFixed = 300 * FIXED_ONE
    player.hp = 300
    player.hpFixed = 300 * FIXED_ONE

    const merc = makeMercenary(7901, playerId, 110, 31, 30)
    merc.hp = 240
    merc.maxHp = 240
    internal.mercenaries.set(merc.unitId, merc)

    const shenkId = game.spawnMonster({
      classId: 479,
      defId: 'overseer1',
      superUniqueId: 'Siege Boss',
      x: 32,
      y: 30,
      areaId: 110,
      hp: 10,
      maxHp: 10,
      aiDisabled: true,
    })

    // Surround Shenk's death spot with hostile monsters so catapult impacts hit them.
    const minions: number[] = []
    for (let dx = -6; dx <= 6; dx += 3) {
      for (let dy = -6; dy <= 6; dy += 3) {
        minions.push(
          game.spawnMonster({
            defId: 'fallen1',
            x: 32 + dx,
            y: 30 + dy,
            areaId: 110,
            hp: 150,
            maxHp: 150,
            aiDisabled: true,
          }),
        )
      }
    }

    game.drainEvents(playerId)
    game.applyDamageToMonster(shenkId, 500, playerId)
    game.stepFrames(160)
    const events = game.drainEvents(playerId)

    const catapultMissiles = events.filter(
      (e) =>
        e.type === 'CreateMissile' &&
        (e.missileClassId === 422 || e.missileClassId === 423),
    )
    expect(catapultMissiles.length).toBeGreaterThanOrEqual(20)

    const damagedMinions = minions.filter((id) => {
      const m = game.getMonster(id)!
      return m.dead || m.hp < 150
    })
    expect(damagedMinions.length).toBeGreaterThan(0)

    // Friendly-fire immunity: neither the player nor their mercenary takes catapult bombardment damage!
    expect(player.hp).toBe(300)
    expect(merc.hp).toBe(240)
  })
})

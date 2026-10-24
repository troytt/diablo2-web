/**
 * #1326: GameInstance monster / container drops and NPC stores run through the canonical 1.13c
 * generators (TreasureClassEx drop pipeline, Objects.txt OperateFn container dispatch, Armor/Weapons/
 * Misc.txt store columns) and send complete ItemData the client item bridge renders.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as dropTablesModule from '../../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { onlineItemDataToUiInventoryItem } from '../../src/common/items/item-bridge.ts'
import { generateVendorStoreInventory, VENDOR_TAB_KEYS } from '../../src/common/items/vendor-generator.ts'
import { goldItem, ItemQuality, type Item } from '../../src/common/items/items.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { getTownNpcDescriptorByHcIdx, VendorNpcId } from '../../src/common/units/npc-table.ts'
import { getLevelMonsterLevel113c, LEVELS_MONLVL_113C } from '../../src/common/world/levels-monlvl-113c.ts'
import { getObjectsTxtRecord113c, OBJECTS_TXT_113C } from '../../src/common/world/objects-txt-113c.ts'
import type { ItemData, ServerEvent } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  CONTAINER_OPERATE_DROP_CHANCE_113C,
  domainItemToItemData113c,
  finalizeDroppedItem113c,
  resolveChestDropContext113c,
} from '../../src/server/items/server-item-data.ts'

type ItemEvent = Extract<ServerEvent, { type: 'ItemEvent' }>

function itemEvents(events: readonly ServerEvent[], action: string): ItemEvent[] {
  return events.filter((e): e is ItemEvent => e.type === 'ItemEvent' && e.action === action)
}

function killMonster(game: GameInstance, playerId: number, monsterId: number): void {
  game.enqueueCommand(playerId, { type: 'CastSkillOnTarget', skillId: 0, targetType: 'monster', targetId: monsterId })
  game.stepFrames(120)
  expect(game.getMonster(monsterId)!.dead).toBe(true)
}

/** The client-side name of a sent item must be the name the generator gave it. */
function expectRendersAs(data: ItemData, item: Item): void {
  const ui = onlineItemDataToUiInventoryItem(data)
  expect(ui.code).toBe(item.base.id)
  if (item.quality === ItemQuality.MAGIC || item.quality === ItemQuality.RARE || item.quality === ItemQuality.UNIQUE) {
    expect(ui.nameEn).toBe(item.name)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('#1326 generated data: Objects.txt OperateFn and Levels.txt MonLvl', () => {
  it('extracts OperateFn for all 573 Objects.txt records (chest 4, casket 1, barrel 5, shrine 2, door 8, waypoint 23)', () => {
    expect(OBJECTS_TXT_113C).toHaveLength(573)
    expect(getObjectsTxtRecord113c(5).operateFn).toBe(4)
    expect(getObjectsTxtRecord113c(1).operateFn).toBe(1)
    expect(getObjectsTxtRecord113c(7).operateFn).toBe(5)
    expect(getObjectsTxtRecord113c(2).operateFn).toBe(2)
    expect(getObjectsTxtRecord113c(13).operateFn).toBe(8)
    expect(getObjectsTxtRecord113c(119).operateFn).toBe(23)
  })

  it('extracts MonLvl / MonLvlEx for all 137 Levels.txt records', () => {
    expect(LEVELS_MONLVL_113C).toHaveLength(137)
    expect(LEVELS_MONLVL_113C[2]!.name).toBe('Act 1 - Wilderness 1')
    expect(getLevelMonsterLevel113c(2, 0)).toBe(1)
    expect(getLevelMonsterLevel113c(2, 1)).toBe(36)
    expect(getLevelMonsterLevel113c(2, 2)).toBe(67)
    expect(getLevelMonsterLevel113c(2, 2, false)).toBe(51)
    expect(LEVELS_MONLVL_113C[110]!.act).toBe(4)
  })
})

describe('#1326 chest treasure class (D2Game 0x6fc8b570)', () => {
  it('picks Act N [(N)|(H)] Chest A/B/C from the level monster level within the act range', () => {
    expect(resolveChestDropContext113c(2, 0)).toEqual({ tcName: 'Act 1 Chest A', monsterLevel: 1 })
    expect(resolveChestDropContext113c(21, 0)).toEqual({ tcName: 'Act 1 Chest B', monsterLevel: 7 })
    expect(resolveChestDropContext113c(37, 0)).toEqual({ tcName: 'Act 1 Chest C', monsterLevel: 12 })
    expect(resolveChestDropContext113c(110, 0)).toEqual({ tcName: 'Act 5 Chest B', monsterLevel: 24 })
    expect(resolveChestDropContext113c(44, 1)).toEqual({ tcName: 'Act 2 (N) Chest B', monsterLevel: 46 })
    expect(resolveChestDropContext113c(108, 2)).toEqual({ tcName: 'Act 4 (H) Chest C', monsterLevel: 85 })
  })

  it('every non-town level of every difficulty resolves to a TreasureClassEx row', () => {
    const tables = getEmbeddedDropTables()
    for (let levelId = 1; levelId < LEVELS_MONLVL_113C.length; levelId++) {
      for (const d of [0, 1, 2] as const) {
        const { tcName } = resolveChestDropContext113c(levelId, d)
        expect(tables.tcTable.get(tcName), `${levelId}/${d} ${tcName}`).toBeDefined()
      }
    }
  })

  it('container operate functions are exactly the D2Game ones that call the chest drop', () => {
    expect(Object.keys(CONTAINER_OPERATE_DROP_CHANCE_113C).map(Number).sort((a, b) => a - b)).toEqual([1, 3, 4, 5, 14, 48, 58, 68])
  })
})

describe('#1326 domainItemToItemData113c', () => {
  it('sends magic / rare / unique ids and stats that the client bridge renders back to the same item', () => {
    const tables = getEmbeddedDropTables()
    const seen = new Set<number>()
    for (let seed = 1; seed < 400 && seen.size < 3; seed++) {
      const items = dropTablesModule.executeDropPipeline(tables, {
        tcName: 'Act 5 (H) Equip C',
        nLevel: 85,
        monsterType: 3,
        difficulty: 'hell',
        playerMf: 400,
        monsterRng: new D2Rng(seed),
      })
      for (const raw of items) {
        if (raw.code?.trim() === 'gld') continue
        const item = finalizeDroppedItem113c(raw)
        const data = domainItemToItemData113c(item, tables, { unitId: 77, compactSave: false })
        expect(data.code).toBe(item.base.id)
        expect(data.quality).toBe(item.quality)
        if (item.base.kind === 'armor') expect(data.defense).toBeGreaterThan(0)
        if (item.quality === ItemQuality.MAGIC) {
          expect((data.magicPrefixId ?? 0) + (data.magicSuffixId ?? 0)).toBeGreaterThan(0)
        }
        if (item.quality === ItemQuality.RARE) {
          expect(data.rareAffixes).toHaveLength(6)
          expect(data.rareName1).toBeGreaterThan(tables.rareNames.suffixes.length)
        }
        if (item.quality === ItemQuality.UNIQUE) expect(data.uniqueItemId).toBe(item.uniqueItemDef.id)
        if ((item.rolledProps?.length ?? 0) > 0) expect(data.stats.length).toBeGreaterThan(0)
        if (item.quality === ItemQuality.MAGIC || item.quality === ItemQuality.RARE || item.quality === ItemQuality.UNIQUE) {
          expectRendersAs({ ...data, identified: true }, item)
          seen.add(item.quality)
        }
      }
    }
    expect([...seen].sort()).toEqual([ItemQuality.MAGIC, ItemQuality.RARE, ItemQuality.UNIQUE])
  })

  it('sends gold as gld with its amount', () => {
    const tables = getEmbeddedDropTables()
    const gold = goldItem(321)
    const data = domainItemToItemData113c(gold, tables, { unitId: 9, compactSave: true })
    expect(data.code).toBe('gld')
    expect(data.quantity).toBe(321)
    expect(data.goldAmount).toBe(321)
    expect(data.simple).toBe(true)
  })

  it('rejects armor that never got a rolled defense', () => {
    const tables = getEmbeddedDropTables()
    const store = generateVendorStoreInventory({ vendorId: VendorNpcId.CHARSI, difficulty: 0, cLvl: 5, tables, rng: new D2Rng(3) })
    const armor = store.allItems.find((i) => i.base.kind === 'armor')!
    const { defense: _ignored, ...withoutDefense } = armor
    expect(() => domainItemToItemData113c(withoutDefense as Item, tables, { unitId: 1, compactSave: false })).toThrow(/rolled defense/)
  })
})

describe('#1326 GameInstance monster drops use the 1.13c TreasureClassEx pipeline', () => {
  it('Andariel drops from Andarielq on the first kill and Andariel afterwards, with /players and MF context', () => {
    const spy = vi.spyOn(dropTablesModule, 'executeDropPipeline')
    const game = new GameInstance({ seed: 1326, difficulty: 0, areaId: 37, playersX: 3 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'Loot', x: 10, y: 10, areaId: 37 })
    const tables = getEmbeddedDropTables()

    for (const expectedTc of ['Andarielq', 'Andariel']) {
      spy.mockClear()
      const before = game.getGroundItems().length
      const andyId = game.spawnMonster({ defId: 'andariel', x: 11, y: 10, areaId: 37, hp: 1, maxHp: 1, aiDisabled: true })
      game.drainPlayerEvents(playerId)
      killMonster(game, playerId, andyId)
      expect(spy).toHaveBeenCalledTimes(1)
      const opts = spy.mock.calls[0]![1] as dropTablesModule.DropPipelineOptions
      expect(opts.tcName).toBe(expectedTc)
      expect(opts.nLevel).toBe(game.getMonster(andyId)!.level)
      expect(opts.gamePlayers).toBe(3)
      expect(opts.playerMf).toBe(0)

      const spawned = itemEvents(game.drainPlayerEvents(playerId), 'groundSpawn')
      expect(spawned.length).toBeGreaterThan(0)
      expect(game.getGroundItems().length - before).toBe(spawned.length)
      for (const ev of spawned) {
        const data = ev.item!
        expect(tables.getBase(data.code), data.code).toBeDefined()
        expect(data.quality).toBeGreaterThanOrEqual(1)
        expect(() => onlineItemDataToUiInventoryItem(data)).not.toThrow()
      }
    }
  })

  it('a fallen kill never produces the removed hpot/cap/Hnd stub and drops only table items', () => {
    const game = new GameInstance({ seed: 77, difficulty: 0, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 10, y: 10, areaId: 2 })
    const tables = getEmbeddedDropTables()
    for (let i = 0; i < 12; i++) {
      const id = game.spawnMonster({ defId: 'fallen1', x: 11, y: 10, areaId: 2, hp: 1, maxHp: 1, aiDisabled: true })
      killMonster(game, playerId, id)
    }
    for (const g of game.getGroundItems()) {
      expect(g.code).not.toBe('hpot')
      expect(tables.getBase(g.code), g.code).toBeDefined()
      expect(g.rawItemData).toBeDefined()
    }
  })
})

describe('#1326 GameInstance containers dispatch on Objects.txt OperateFn', () => {
  it('chests drop from Act 1 Chest A at the level monster level; doors open without a drop', () => {
    const spy = vi.spyOn(dropTablesModule, 'executeDropPipeline')
    // #1327: the removed wilderness Fallen stub no longer consumes game RNG, so the seed was
    // re-picked to keep this 75%-per-chest sample below 16/16.
    const game = new GameInstance({ seed: 4243, difficulty: 0, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'ama', name: 'Ama', x: 10, y: 10, areaId: 2 })

    const doorId = game.spawnObject({ classId: 13, x: 11, y: 10, areaId: 2 })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: doorId } as never)
    game.stepFrame()
    expect(spy).not.toHaveBeenCalled()

    for (let i = 0; i < 16; i++) {
      const chestId = game.spawnObject({ classId: 5, x: 11, y: 10, areaId: 2 })
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: chestId } as never)
      game.stepFrame()
    }
    // OperateFn 4: an unlocked chest drops on 75 of 100 operate rolls.
    expect(spy.mock.calls.length).toBeGreaterThan(0)
    expect(spy.mock.calls.length).toBeLessThan(16)
    for (const call of spy.mock.calls) {
      const opts = call[1] as dropTablesModule.DropPipelineOptions
      expect(opts.tcName).toBe('Act 1 Chest A')
      expect(opts.nLevel).toBe(1)
    }
    expect(game.getGroundItems().every((g) => g.code !== 'hpot')).toBe(true)
  })
})

describe('#1326 GameInstance NPC stores use the 1.13c store columns', () => {
  it('Charsi sells her Armor/Weapons/Misc.txt store items on tabs 1..4; buying hands over the rolled item', () => {
    expect(getTownNpcDescriptorByHcIdx(154)?.vendorId).toBe(VendorNpcId.CHARSI)
    const game = new GameInstance({ seed: 9, difficulty: 0, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Pal', x: 10, y: 10, areaId: 1 })
    ;(game as unknown as { players: Map<number, { gold: number }> }).players.get(playerId)!.gold = 1_000_000
    const charsiId = game.spawnMonster({ classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true })
    game.drainPlayerEvents(playerId)
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId: charsiId, action: 'trade' } as never)
    game.stepFrame()

    const pool = itemEvents(game.drainPlayerEvents(playerId), 'vendorPool')
    expect(pool.length).toBeGreaterThan(5)
    const tables = getEmbeddedDropTables()
    for (const ev of pool) {
      const data = ev.item!
      const base = tables.getBase(data.code)!
      expect(base.vendorColumns?.[VendorNpcId.CHARSI]).toBeDefined()
      expect(data.container).toBe('shop')
      expect(data.storePage).toBeGreaterThanOrEqual(1)
      expect(data.storePage).toBeLessThanOrEqual(VENDOR_TAB_KEYS.length)
      expect(() => onlineItemDataToUiInventoryItem(data)).not.toThrow()
    }
    expect(pool.some((ev) => tables.getBase(ev.item!.code)!.kind === 'weapon')).toBe(true)
    expect(pool.some((ev) => tables.getBase(ev.item!.code)!.kind === 'armor')).toBe(true)

    const magic = pool.find((ev) => ev.item!.quality === ItemQuality.MAGIC) ?? pool[0]!
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId: charsiId, itemId: magic.itemId, cost: 0 } as never)
    game.stepFrame()
    const bought = itemEvents(game.drainPlayerEvents(playerId), 'buy')
    expect(bought).toHaveLength(1)
    const got = bought[0]!.item!
    expect(got.code).toBe(magic.item!.code)
    expect(got.quality).toBe(magic.item!.quality)
    expect(got.stats).toEqual(magic.item!.stats)
    expect(got.magicPrefixId).toBe(magic.item!.magicPrefixId)
    expect(got.magicSuffixId).toBe(magic.item!.magicSuffixId)
  })

  it('Gheed gambles mystery items and a gamble purchase reveals a 1.13c gamble item', () => {
    const game = new GameInstance({ seed: 31, difficulty: 0, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'Gambler', x: 10, y: 10, areaId: 1, level: 20 } as never)
    ;(game as unknown as { players: Map<number, { gold: number }> }).players.get(playerId)!.gold = 1_000_000
    const gheedId = game.spawnMonster({ classId: 147, name: 'Gheed', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true })
    game.drainPlayerEvents(playerId)
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId: gheedId, action: 'gamble' } as never)
    game.stepFrame()
    const pool = itemEvents(game.drainPlayerEvents(playerId), 'vendorPool')
    expect(pool.length).toBeGreaterThan(0)
    for (const ev of pool) {
      expect(ev.item!.identified).toBe(false)
      expect((ev.item as ItemData & { isGambleMystery?: boolean }).isGambleMystery).toBe(true)
    }
    const ring = pool.find((ev) => ev.item!.code === 'rin') ?? pool[0]!
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId: gheedId, itemId: ring.itemId, gamble: true, cost: 0 } as never)
    game.stepFrame()
    const bought = itemEvents(game.drainPlayerEvents(playerId), 'gamble')
    expect(bought).toHaveLength(1)
    const got = bought[0]!.item!
    expect(got.identified).toBe(true)
    expect(got.quality).toBeGreaterThanOrEqual(ItemQuality.MAGIC)
    expect(getEmbeddedDropTables().getBase(got.code)).toBeDefined()
  })

  it('NPCs without a store (Kashya) sell nothing instead of a fixed stub pool', () => {
    const game = new GameInstance({ seed: 5, difficulty: 0, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'ama', name: 'Ama', x: 10, y: 10, areaId: 1 })
    const kashyaId = game.spawnMonster({ classId: 150, name: 'Kashya', x: 11, y: 10, areaId: 1, isNpc: true })
    game.drainPlayerEvents(playerId)
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId: kashyaId, action: 'trade' } as never)
    game.stepFrame()
    expect(itemEvents(game.drainPlayerEvents(playerId), 'vendorPool')).toHaveLength(0)
  })
})

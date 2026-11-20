import { describe, expect, it } from 'vitest'
import {
  onlineItemDataToUiInventoryItem,
  resolveOnlineItemReqLevel,
} from '../src/common/items/item-bridge.ts'
import {
  HudModel,
  computeEquipmentSkillBonus,
} from '../src/client/ui-model/hud-model.ts'
import { activeCharms, aggregateUnit } from '../src/client/ui-model/stat-engine.ts'
import { transactionCostContextFromWorld } from '../src/client/ui-model/transaction-cost-input.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { D2StatId } from '../src/client/world/stat-list.ts'
import type { ItemData } from '../src/netproto/index.ts'

function makeOcherSmallCharmOfFlame(overrides: Partial<ItemData> = {}): ItemData {
  return {
    id: 5001,
    itemId: 5001,
    opcode: 0x9c,
    action: 4,
    category: 0,
    flags: 0x10,
    rawFlags: 0x10,
    version: 100,
    location: 0,
    container: 'inventory',
    bodyLoc: 0,
    equippedSlot: 0,
    gridX: 0,
    gridY: 0,
    storePage: 1,
    storagePage: 1,
    worldX: 0,
    worldY: 0,
    x: 0,
    y: 0,
    code: 'cm1',
    rawCode: 'cm1 ',
    compact: false,
    simple: false,
    identified: true,
    socketed: false,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: false,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    quality: 4, // Magic
    invWidth: 1,
    invHeight: 1,
    // MagicPrefix.txt ID 386 = "Ocher" on scha (lightresist 6..7, levelreq = 10)
    magicPrefixId: 386,
    // MagicSuffix.txt ID 714 = "of Flame" on scha (fire-min 1, fire-max 2, levelreq = 8)
    magicSuffixId: 714,
    stats: [
      { statId: 41, param: 0, value: 6 }, // +6% Lightning Resist
      { statId: 48, param: 0, value: 1 }, // +1 Minimum Fire Damage
      { statId: 49, param: 0, value: 2 }, // +2 Maximum Fire Damage
    ],
    runewordStats: [],
    setBonusStats: [],
    ...overrides,
  }
}

describe('Issue #825: Inventory Charm Required Level & Identified Gating (D2Common.dll ITEMS_IsCharmUsable @ 0x6fd77090 / ITEMS_CheckRequirements @ 0x6fd76db0 / ITEMS_GetRequiredLevel @ 0x6fd76190)', () => {
  it('1. Screenshot case ("赭黄之火焰的小护身符" / "Ocher Small Charm of Flame"): resolves reqLevel = 10 and blocks stats when character level < 10', () => {
    const charm = makeOcherSmallCharmOfFlame()

    expect(resolveOnlineItemReqLevel(charm)).toBe(10)
    const uiItem = onlineItemDataToUiInventoryItem(charm, undefined, undefined, 1)
    expect(uiItem.nameZh).toBe('赭黄之火焰的小护身符')
    expect(uiItem.nameEn).toBe('Ocher Small Charm of Flame')
    expect(uiItem.baseNameEn).toBe('Small Charm')
    expect(uiItem.reqLevel).toBe(10)

    const world = new ClientWorld()
    world.self.charClass = 0 // Amazon
    world.self.applyStat(D2StatId.Level, 1)
    world.self.applyStat(D2StatId.Strength, 20)
    world.self.applyStat(D2StatId.Dexterity, 25)
    world.self.applyStat(D2StatId.Vitality, 20)
    world.self.applyStat(D2StatId.Energy, 15)
    world.containers.applyItemEvent(4, charm, 'inventory')

    // Level 1 (< 10): charm is NOT usable
    expect(activeCharms(world.containers, 1, 'ama')).toHaveLength(0)
    const aggLvl1 = aggregateUnit({
      kind: 'player',
      stats: world.self.stats,
      level: world.self.level,
      activeStates: world.self.states,
      classId: 0,
      hardSkillLevels: world.self.skills,
      containers: world.containers,
    })
    expect(aggLvl1.charms).toHaveLength(0)
    expect(aggLvl1.total(41)).toBe(0) // Lightning Resist = 0
    expect(aggLvl1.total(48)).toBe(0) // Fire Min Damage = 0
    expect(aggLvl1.total(49)).toBe(0) // Fire Max Damage = 0

    const hud = new HudManager()
    const model = new HudModel({ world, hudManager: hud })
    model.syncFromWorld()
    expect(hud.charSheet.attrs.lightRes).toBe(0)
    expect(hud.charSheet.attrs.leftSkillDmg).toBe('1-2')

    // Level 9 (< 10): still NOT usable
    world.self.applyStat(D2StatId.Level, 9)
    model.syncFromWorld()
    expect(hud.charSheet.attrs.lightRes).toBe(0)
    expect(hud.charSheet.attrs.leftSkillDmg).toBe('1-2')

    // Level 10 (>= 10): charm becomes active and grants +6% Lightning Resist and +1-2 Fire Damage
    world.self.applyStat(D2StatId.Level, 10)
    expect(activeCharms(world.containers, 10, 'ama')).toHaveLength(1)
    model.syncFromWorld()
    expect(hud.charSheet.attrs.lightRes).toBe(6)
    expect(hud.charSheet.attrs.leftSkillDmg).toBe('2-4')
  })

  it('2. Unidentified charms in inventory never contribute stats or skills (ITEMS_IsCharmUsable IFLAG_IDENTIFIED @ 0x6fd770aa)', () => {
    const unidCharm = makeOcherSmallCharmOfFlame({
      id: 5002,
      itemId: 5002,
      identified: false,
      rawFlags: 0x0,
      stats: [
        { statId: 41, param: 0, value: 11 },
        { statId: 127, param: 0, value: 1 },
      ],
    })

    const world = new ClientWorld()
    world.self.charClass = 1 // Sorceress
    world.self.applyStat(D2StatId.Level, 90)
    world.containers.applyItemEvent(4, unidCharm, 'inventory')

    expect(activeCharms(world.containers, 90, 'sor')).toHaveLength(0)
    const agg = aggregateUnit({
      kind: 'player',
      stats: world.self.stats,
      level: world.self.level,
      activeStates: world.self.states,
      classId: 1,
      hardSkillLevels: world.self.skills,
      containers: world.containers,
    })
    expect(agg.total(41)).toBe(0)
    expect(agg.total(127)).toBe(0)
    expect(computeEquipmentSkillBonus(36, 'sor', world.containers, world.self.stats)).toBe(0)
  })

  it('3. Unique charms (Annihilus reqLevel=70, Gheed\'s Fortune reqLevel=62) enforce reqLevel and carry1 deduplication across stats, skills, and vendor pricing', () => {
    const annihilus1: ItemData = {
      ...makeOcherSmallCharmOfFlame(),
      id: 5003,
      itemId: 5003,
      code: 'cm1',
      quality: 7, // Unique
      uniqueItemId: 381, // Annihilus (levelreq = 70)
      magicPrefixId: undefined,
      magicSuffixId: undefined,
      stats: [
        { statId: 127, param: 0, value: 1 }, // +1 to All Skills
        { statId: 0, param: 0, value: 15 }, // +15 Strength
        { statId: 41, param: 0, value: 18 }, // +18% Lightning Resist
      ],
    }
    const annihilus2: ItemData = {
      ...annihilus1,
      id: 5004,
      itemId: 5004,
    }
    const gheeds: ItemData = {
      ...makeOcherSmallCharmOfFlame(),
      id: 5005,
      itemId: 5005,
      code: 'cm3',
      quality: 7, // Unique
      uniqueItemId: 359, // Gheed's Fortune (levelreq = 62)
      magicPrefixId: undefined,
      magicSuffixId: undefined,
      stats: [
        { statId: 87, param: 0, value: 15 }, // Reduces All Vendor Prices 15%
      ],
    }

    expect(resolveOnlineItemReqLevel(annihilus1)).toBe(70)
    expect(resolveOnlineItemReqLevel(gheeds)).toBe(62)
    expect(onlineItemDataToUiInventoryItem(annihilus1, undefined, undefined, 70).baseNameEn).toBe('Small Charm')
    expect(
      onlineItemDataToUiInventoryItem({ ...makeOcherSmallCharmOfFlame(), code: 'cm2', rawCode: 'cm2 ' }, undefined, undefined, 20)
        .baseNameEn,
    ).toBe('Large Charm')
    expect(onlineItemDataToUiInventoryItem(gheeds, undefined, undefined, 70).baseNameEn).toBe('Grand Charm')

    const world = new ClientWorld()
    world.self.charClass = 1 // Sorceress
    world.self.applyStat(D2StatId.Level, 60)
    world.self.applyStat(D2StatId.Strength, 10)
    world.containers.applyItemEvent(4, annihilus1, 'inventory')
    world.containers.applyItemEvent(4, annihilus2, 'inventory')
    world.containers.applyItemEvent(4, gheeds, 'inventory')

    // At level 60 (< 62 and < 70), neither Gheed's nor Annihilus is usable
    expect(activeCharms(world.containers, 60, 'sor')).toHaveLength(0)
    expect(computeEquipmentSkillBonus(36, 'sor', world.containers, world.self.stats)).toBe(0)
    expect(transactionCostContextFromWorld(world, 154).playerReducedPricesPct).toBe(0)

    // At level 65 (>= 62, < 70), Gheed's is active but Annihilus is still blocked
    world.self.applyStat(D2StatId.Level, 65)
    expect(activeCharms(world.containers, 65, 'sor').map((c) => c.id)).toEqual([5005])
    expect(computeEquipmentSkillBonus(36, 'sor', world.containers, world.self.stats)).toBe(0)
    expect(transactionCostContextFromWorld(world, 154).playerReducedPricesPct).toBe(15)

    // At level 70 (>= 70), Annihilus becomes active, and duplicate Annihilus (5004) is deduplicated
    world.self.applyStat(D2StatId.Level, 70)
    expect(activeCharms(world.containers, 70, 'sor').map((c) => c.id)).toEqual([5003, 5005])
    expect(computeEquipmentSkillBonus(36, 'sor', world.containers, world.self.stats)).toBe(1)
    const aggLvl70 = aggregateUnit({
      kind: 'player',
      stats: world.self.stats,
      level: world.self.level,
      activeStates: world.self.states,
      classId: 1,
      hardSkillLevels: world.self.skills,
      containers: world.containers,
    })
    expect(aggLvl70.total(0)).toBe(25) // 10 base + 15 from one Annihilus (not 30)
    expect(aggLvl70.total(41)).toBe(18)
  })
})

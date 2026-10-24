import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { onlineItemDataToUiInventoryItem } from '../src/common/items/item-bridge.ts'
import { resolveItemContainer, type ItemData } from '../src/netproto/d2gs/items/item-types.ts'
import { ClientInventoryManager } from '../src/client/world/inventory.ts'
import { convertWorldItemToUiItem } from '../src/client/ui-model/hud-item-adapter.ts'

describe('Issue #1014: Weapon Final Damage Calculation (Affixes, Socketed Runes/Jewels, Set Bonuses, Per-Level & Throw)', () => {
  const tables = getEmbeddedDropTables()

  it('1. resolveItemContainer routes 0x0A (PutInSocket) and 0x13 (ItemInSocket) to socket container regardless of location bits', () => {
    expect(resolveItemContainer(0x9c, 0x04, undefined, 6, 0)).toBe('socket')
    expect(resolveItemContainer(0x9d, 0x0a, 'item', 4, 0)).toBe('socket')
    expect(resolveItemContainer(0x9d, 0x0a, 'item', 0, 0)).toBe('socket')
    expect(resolveItemContainer(0x9d, 0x13, 'item', 4, 0)).toBe('socket')
  })

  it('2. ClientInventoryManager updates socket array reference and invalidates convertWorldItemToUiItem cache when socketed runes arrive after parent weapon', () => {
    const inv = new ClientInventoryManager()

    // Parent weapon arrives first (Immortal King's Stone Crusher, Ogre Maul 7m7, base 77-106, +200% ED)
    const parentWeapon: ItemData = {
      id: 5001,
      action: 0x06,
      category: 5,
      code: '7m7',
      location: 1,
      bodyLoc: 4, // right arm
      gridX: 0,
      gridY: 0,
      storePage: 0,
      ownerType: 'player',
      ownerId: 1,
      identified: true,
      socketed: true,
      ethereal: false,
      runeword: false,
      personalized: false,
      broken: false,
      ear: false,
      starter: false,
      simple: false,
      compact: false,
      newItem: false,
      switchIn: false,
      switchOut: false,
      inSocket: false,
      equipped: true,
      deleted: false,
      rawFlags: 0x00000811,
      version: 101,
      usedSockets: 2,
      totalSockets: 2,
      ilvl: 85,
      quality: 5, // Set
      setItemId: 109, // Immortal King's Stone Crusher
      curDurability: 60,
      maxDurability: 60,
      stats: [{ statId: 17, param: 0, value: 200 }], // +200% Enhanced Damage
    } as unknown as ItemData

    inv.applyItemEvent(0x06, parentWeapon, 'equipment', 1)

    const mockModel = {
      world: {
        self: { level: 85, stats: new Map() },
        containers: inv,
      },
      uiItemCacheById: new Map(),
      uiItemCacheByRef: new Map(),
      resolveEquippedContext: () => ({
        equippedItems: [parentWeapon],
        equippedSig: '5001',
      }),
    }

    // First HUD render before socket children arrive: +200% ED -> 77*3=231 to 106*3=318
    const hudBeforeSockets = convertWorldItemToUiItem(mockModel, inv.equipmentBySlot.get(4)!)
    expect(hudBeforeSockets.twoHandDamage).toMatchObject({
      min: 231,
      max: 318,
    })

    // Now two Ohm Runes (r27, +50% ED each on weapon) arrive in packets with ownerId=5001
    const ohm1: ItemData = {
      ...parentWeapon,
      id: 5002,
      action: 0x0a, // PutInSocket
      code: 'r27',
      location: 6,
      bodyLoc: 0,
      ownerType: 'item',
      ownerId: 5001,
      quality: 2,
      setItemId: undefined,
      socketed: false,
      inSocket: true,
      equipped: false,
      totalSockets: 0,
      usedSockets: 0,
      stats: [],
    } as unknown as ItemData
    const ohm2: ItemData = {
      ...ohm1,
      id: 5003,
      gridX: 1,
    }

    inv.applyItemEvent(0x0a, ohm1, 'socket', 1)
    inv.applyItemEvent(0x0a, ohm2, 'socket', 1)

    // Subsequent HUD render must invalidate cache and include both Ohm Runes (+100% ED -> total +300% ED -> 77*4=308 to 106*4=424)
    const hudAfterSockets = convertWorldItemToUiItem(mockModel, inv.equipmentBySlot.get(4)!)
    expect(hudAfterSockets.twoHandDamage).toMatchObject({
      min: 308,
      max: 424,
    })
  })

  it('3. Set weapon green item bonuses (activeItemSetProps / unlocked aprops) are applied to final weapon damage', () => {
    // Cleglaw's Tooth (Long Sword 'lsd', base 1H damage 3-19, 2-piece set bonus: dmg/lvl 10 -> +1.25 max dmg per clvl)
    const toothData = {
      id: 6001,
      code: 'lsd',
      quality: 5, // Set
      identified: true,
      bodyLoc: 4,
      setItemId: 6, // Cleglaw's Tooth
      stats: [],
    }
    const clawData = {
      id: 6002,
      code: 'sml',
      quality: 5,
      identified: true,
      bodyLoc: 5,
      setItemId: 7, // Cleglaw's Claw
      stats: [],
    }

    const cleglawTooth = onlineItemDataToUiInventoryItem(
      toothData,
      undefined,
      tables,
      80, // charLevel 80 -> +(10 * 80) >> 3 = +100 max damage when 2+ pieces of Cleglaw's Brace are equipped
      [toothData, clawData],
    )

    // Base 3 to 19 + 100 (unlocked green set bonus dmg/lvl at clvl 80) = 3 to 119
    expect(cleglawTooth.oneHandDamage).toMatchObject({
      min: 3,
      max: 119,
      isEnhanced: true,
    })
  })

  it('4. Per-level damage stats (statId 218 item_maxdamage_perlevel and statId 219 item_maxdamage_percent_perlevel) scale weapon damage', () => {
    // Phase Blade ('7cr', base 31-35) with Fool's affix: +0.5 max dmg/lvl (value=4) and Grinding: +0.75% ED/lvl (value=6) at clvl 80
    const phaseBlade = onlineItemDataToUiInventoryItem(
      {
        id: 6003,
        code: '7cr',
        quality: 4, // Magic
        identified: true,
        stats: [
          { statId: 218, param: 0, value: 4 }, // (4 * 80) >> 3 = +40 max damage
          { statId: 219, param: 0, value: 6 }, // (6 * 80) >> 3 = +60% max ED
        ],
      },
      undefined,
      tables,
      80,
    )

    // Min: 31 (no min% bonus), Max: floor(35 * (100 + 60) / 100) + 40 = 56 + 40 = 96
    expect(phaseBlade.oneHandDamage).toMatchObject({
      min: 31,
      max: 96,
      isEnhanced: true,
    })
  })

  it('5. Throwing weapons compute final throwDamage with %ED and flat +min/+max without double-counting statId 159/160', () => {
    // Winged Harpoon ('7ts', base throw 11-77, 1H 27-35) with +200% ED and +10 Min / +20 Max across 1H + Throw stats
    const wingedHarpoon = onlineItemDataToUiInventoryItem(
      {
        id: 6004,
        code: '7ts',
        quality: 6, // Rare
        identified: true,
        stats: [
          { statId: 17, param: 0, value: 200 }, // +200% Enhanced Damage
          { statId: 21, param: 0, value: 10 }, // +10 to Minimum Damage (1H)
          { statId: 159, param: 0, value: 10 }, // +10 to Minimum Throw Damage (D2GS emits both 21 and 159 on throwing weapons)
          { statId: 22, param: 0, value: 20 }, // +20 to Maximum Damage (1H)
          { statId: 160, param: 0, value: 20 }, // +20 to Maximum Throw Damage
        ],
      },
      undefined,
      tables,
      85,
    )

    // Throw base: 11-77 -> 11*3 + 10 = 43, 77*3 + 20 = 251
    expect(wingedHarpoon.throwDamage).toMatchObject({
      min: 43,
      max: 251,
      isEnhanced: true,
    })
    // 1H base: 27-35 -> 27*3 + 10 = 91, 35*3 + 20 = 125
    expect(wingedHarpoon.oneHandDamage).toMatchObject({
      min: 91,
      max: 125,
      isEnhanced: true,
    })
  })
})

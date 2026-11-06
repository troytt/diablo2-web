import { describe, it, expect } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { onlineItemDataToUiInventoryItem } from '../src/common/items/item-bridge.ts'

describe('Issue #809: Item Required Level & Compiled Affix Row Index Parity (D2Common.dll 0x6fdaef40 / 0x6fdc1820 / 0x6fd76190 & D2Client.dll 0x6fb42c7b)', () => {
  const tables = getEmbeddedDropTables()

  it('1. MagicPrefix.txt and MagicSuffix.txt preserve 1-based compiled row IDs across empty-Name rows', () => {
    const prefixes = tables.magicAffixes.prefixes
    const suffixes = tables.magicAffixes.suffixes

    // Non-empty count remains 637 / 741 for pool iteration compatibility
    expect(prefixes.all.length).toBe(637)
    expect(suffixes.all.length).toBe(741)

    // Empty-Name compiled slots return undefined via getById
    for (const emptyPreId of [1, 10, 11, 12, 21, 22, 23, 24, 31, 44, 45, 46, 47, 48, 51, 52, 54, 62, 63, 71, 73, 74, 80, 82, 83, 89, 91, 92, 98, 100, 116, 117]) {
      expect(prefixes.getById(emptyPreId)).toBeUndefined()
    }
    for (const emptySufId of [5, 10, 63, 70, 101, 104]) {
      expect(suffixes.getById(emptySufId)).toBeUndefined()
    }

    // Exact 1-based compiled IDs match D2Common.dll DATATBLS_GetMagicAffixTxtRecord (0x6fdc1820)
    expect(prefixes.getById(2)?.name).toBe('Sturdy')
    expect(prefixes.getById(143)).toMatchObject({ name: 'Sturdy', levelreq: 1 })
    // Before fix: packet ID 143 indexed prefixes.all[142], which is compiled ID 175 ("Jagged", levelreq=7)!
    expect(prefixes.all[143 - 1]).toMatchObject({ id: 175, name: 'Jagged', levelreq: 7 })
    expect(prefixes.getById(175)).toMatchObject({ name: 'Jagged', levelreq: 7 })
    expect(prefixes.getById(366)).toMatchObject({ name: 'Crimson', levelreq: 1 })
    const tangerineLvl1 = prefixes.getByName('Tangerine').find((a) => a.levelreq === 1)!
    expect(prefixes.getById(tangerineLvl1.id!)).toMatchObject({ name: 'Tangerine', levelreq: 1 })
    expect(prefixes.getById(650)).toMatchObject({ name: 'Septic', levelreq: 1 })
    expect(prefixes.getById(665)).toMatchObject({ name: 'Crimson', levelreq: 1 })
    expect(prefixes.getById(669)?.id).toBe(669)

    expect(suffixes.getById(1)?.name).toBe('of Health')
    expect(suffixes.getById(732)).toMatchObject({ name: 'of Strength', levelreq: 1 })
    expect(suffixes.getById(738)).toMatchObject({ name: 'of Shock', levelreq: 1 })
    expect(suffixes.getById(739)).toMatchObject({ name: 'of Regeneration', levelreq: 1 })
    // Before fix: packet ID 738 indexed suffixes.all[737], which is compiled ID 744 ("of the Lamprey", levelreq=73)!
    expect(suffixes.all[738 - 1]).toMatchObject({ id: 744, name: 'of the Lamprey', levelreq: 73 })
    expect(suffixes.getById(744)).toMatchObject({ name: 'of the Lamprey', levelreq: 73 })
    expect(suffixes.getById(747)?.id).toBe(747)
  })

  it('2. Screenshot 1 (Rare Quilted Armor "Hailstone Wrap"): packet prefix IDs 143 ("Sturdy") and 366 ("Crimson") do not falsely require level 7', () => {
    const thornsLvl1 = tables.magicAffixes.suffixes
      .getByName('of Thorns')
      .find((a) => a.levelreq === 1)!
    const tangerineLvl1 = tables.magicAffixes.prefixes
      .getByName('Tangerine')
      .find((a) => a.levelreq === 1)!
    expect(thornsLvl1.id).toBeDefined()
    expect(tangerineLvl1.id).toBeDefined()

    const uiItem = onlineItemDataToUiInventoryItem(
      {
        id: 1001,
        code: 'qui',
        quality: 6, // Rare
        identified: true,
        defense: 11,
        durability: 16,
        maxDurability: 20,
        rareName1: 185, // Hailstone (155 + 29 + 1)
        rareName2: 74, // Wrap (73 + 1)
        // Slot 0 (prefix): 143 (Sturdy, levelreq=1 — previously shifted by 32 to 175 "Jagged" levelreq=7!)
        // Slot 1 (suffix): of Thorns (levelreq=1)
        // Slot 2 (prefix): 366 (Crimson, levelreq=1)
        // Slot 4 (prefix): Tangerine (levelreq=1)
        rareAffixes: [143, thornsLvl1.id!, 366, 0, tangerineLvl1.id!, 0],
        stats: [
          { statId: 16, value: 20 }, // +20% Enhanced Defense
          { statId: 39, value: 6 }, // Fire Resist +6%
          { statId: 41, value: 6 }, // Lightning Resist +6%
          { statId: 78, value: 1 }, // Attacker Takes Damage of 1
        ],
      },
      undefined,
      tables,
      1,
    )

    expect(uiItem.nameEn).toContain('Hailstone Wrap')
    // Level 1 requirement is suppressed on equipment tooltips per D2Client.dll 0x6fb42c7b (cmp $0x1, %eax; jle)
    expect(uiItem.reqLevel).toBeUndefined()
  })

  it('3. Screenshot 2 (Rare Scepter "Doom Spell"): packet suffix ID 738 ("of Shock") and prefix ID 650 ("Septic") do not falsely require level 73', () => {
    const jaggedLvl1 = tables.magicAffixes.prefixes
      .getByName('Jagged')
      .find((a) => a.levelreq === 1)!
    expect(jaggedLvl1.id).toBeDefined()

    const uiItem = onlineItemDataToUiInventoryItem(
      {
        id: 1002,
        code: 'scp',
        quality: 6, // Rare
        identified: true,
        durability: 40,
        maxDurability: 60,
        rareName1: 164, // Doom (155 + 8 + 1)
        rareName2: 56, // Spell (55 + 1)
        // Slot 0 (prefix): Jagged (levelreq=1)
        // Slot 1 (suffix): 739 (of Worth, levelreq=1)
        // Slot 2 (prefix): 650 (Septic, levelreq=1)
        // Slot 3 (suffix): 738 (of Shock, levelreq=1 — previously shifted by 6 to 744 "of the Lamprey" levelreq=73!)
        rareAffixes: [jaggedLvl1.id!, 739, 650, 738, 0, 0],
        stats: [
          { statId: 17, value: 20 }, // +20% Enhanced Damage
          { statId: 21, value: 2 }, // +2 to Minimum Damage
          { statId: 50, value: 1 }, // Lightning Min 1
          { statId: 51, value: 3 }, // Lightning Max 3
          { statId: 57, value: 80 }, // Poison Min
          { statId: 58, value: 80 }, // Poison Max
          { statId: 59, value: 50 }, // Poison Length 2s
          { statId: 107, param: 99, value: 2 }, // +2 to Prayer (Paladin Only, reqlevel=1)
        ],
      },
      undefined,
      tables,
      1,
    )

    expect(uiItem.nameEn).toContain('Doom Spell')
    expect(uiItem.reqLevel).toBeUndefined()
  })

  it('4. Magic item name, reqLevel, and transform color resolve accurately for high packet IDs after empty rows', () => {
    const shockScepter = onlineItemDataToUiInventoryItem(
      {
        id: 1003,
        code: 'scp',
        quality: 4, // Magic
        identified: true,
        magicPrefixId: 665, // Crimson (levelreq=1)
        magicSuffixId: 738, // of Shock (levelreq=1)
        stats: [
          { statId: 39, value: 5 },
          { statId: 50, value: 1 },
          { statId: 51, value: 3 },
        ],
      },
      undefined,
      tables,
      1,
    )
    expect(shockScepter.nameEn).toBe('Crimson Scepter of Shock')
    expect(shockScepter.reqLevel).toBeUndefined()

    const lampreyScepter = onlineItemDataToUiInventoryItem(
      {
        id: 1004,
        code: 'scp',
        quality: 4, // Magic
        identified: true,
        magicSuffixId: 744, // of the Lamprey (levelreq=73, transform=true, transformColor='cred')
        stats: [{ statId: 60, value: 8 }],
      },
      undefined,
      tables,
      1,
    )
    expect(lampreyScepter.nameEn).toBe('Scepter of the Lamprey')
    expect(lampreyScepter.reqLevel).toBe(73)
    expect(lampreyScepter.invtransform).toBe('cred')
  })

  it('5. Crafted item Required Level applies min(98, maxReqLevel + 10 + 3 * numAffixes) per D2Common.dll 0x6fd7637f', () => {
    const craftedAmulet = onlineItemDataToUiInventoryItem(
      {
        id: 1005,
        code: 'amu',
        quality: 8, // Crafted
        identified: true,
        rareName1: 204,
        rareName2: 118,
        // 3 affixes: prefix 143 (levelreq=1), suffix 744 (of the Lamprey, levelreq=73), prefix 366 (levelreq=1)
        // Expected: 73 + 10 + 3 * 3 = 92
        rareAffixes: [143, 744, 366, 0, 0, 0],
        stats: [{ statId: 60, value: 8 }],
      },
      undefined,
      tables,
      1,
    )
    expect(craftedAmulet.reqLevel).toBe(92)
  })
})

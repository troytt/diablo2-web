import { describe, expect, it } from 'vitest'
import {
  CANONICAL_RUNES_TABLE,
  type RunewordDefinition,
} from '../src/common/items/runeword.ts'
import {
  canSocketItem,
  createSocketableItem,
  createSocketedBaseItem,
  getFilledSocketCount,
  getTotalSocketCount,
  resolveGemApplyType,
  socketItemWithSubItem,
  transmuteCubeItems,
} from '../src/common/items/runeword-socket.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { ItemFlag, ItemQuality, type ItemBase } from '../src/common/items/items.ts'
import { Rng } from '../src/common/rng/d2-rng.ts'
import { formatItemTooltip } from '../src/common/items/item-tooltip.ts'
import { itemToUiInventoryItem } from '../src/common/items/item-bridge.ts'
import { InventoryPanel } from '../src/client/ui/inventory.ts'
import { WorldPanelsHud } from '../src/client/ui/world-panels.ts'

/**
 * Finds a canonical 1.13c base item from `weapons` or `armor` whose `type` matches
 * `rw.itypes` and does not match `rw.etypes`.
 */
function findMatchingBaseForRuneword(rw: RunewordDefinition): ItemBase {
  const tables = getEmbeddedDropTables()
  const allBases: ItemBase[] = [
    ...tables.weapons.all,
    ...tables.armor.all,
  ]

  for (const base of allBases) {
    const typeCode = (base.type || '').trim().toLowerCase()
    if (!typeCode) continue

    const matchesItype = rw.itypes.some((it: string) => tables.isA(typeCode, it))
    if (!matchesItype) continue

    const matchesEtype = rw.etypes.some((et: string) => tables.isA(typeCode, et))
    if (matchesEtype) continue

    return base
  }

  throw new Error(`No matching 1.13c base item found for Runeword ${rw.name} (${rw.runeName}) with itypes=${rw.itypes.join(',')}`)
}

describe('Diablo II v1.13c Authentic Runeword & Socketing System', () => {
  it('completes all 78 active 1.13c Runewords end-to-end with valid stats and bilingual tooltips', () => {
    expect(CANONICAL_RUNES_TABLE.complete.length).toBe(78)

    for (const rw of CANONICAL_RUNES_TABLE.complete) {
      const base = findMatchingBaseForRuneword(rw)
      const baseCode = ((base as any).code || base.id).trim()
      const totalSockets = rw.runes.length
      let currentItem = createSocketedBaseItem(baseCode, totalSockets, { ilvl: 85 })
      const rng = new Rng(0x1337beef)

      for (let i = 0; i < rw.runes.length; i++) {
        const runeCode = rw.runes[i]!
        const runeItem = createSocketableItem(runeCode)
        const check = canSocketItem(currentItem, runeItem)
        expect(check, `${rw.runeName} socket step ${i + 1} (${runeCode}) into ${baseCode}`).toBe(true)

        const res = socketItemWithSubItem(currentItem, runeItem, rng)
        expect(res.success).toBe(true)
        currentItem = res.item

        if (i < rw.runes.length - 1) {
          // Partial socketing: must be Gemmed <BaseName>, NOT a Runeword yet
          expect(res.runewordMatch).toBeUndefined()
          expect(currentItem.flags?.runeword).toBe(false)
          expect((currentItem.rawFlags! & ItemFlag.RUNEWORD) !== 0).toBe(false)
          expect(currentItem.name.startsWith('Gemmed ')).toBe(true)
          expect(currentItem.nameZh?.startsWith('镶嵌的')).toBe(true)

          const partialTt = formatItemTooltip(currentItem, 'bilingual')
          // Socketed normal base has grey title (#a0a0a0)
          expect(partialTt.qualityColor).toBe('#a0a0a0')
          expect(partialTt.title.startsWith('Gemmed ')).toBe(true)
        } else {
          // Final rune inserted: must complete the Runeword!
          expect(res.runewordMatch).toBeDefined()
          expect(res.runewordMatch?.name).toBe(rw.name)
          expect(currentItem.flags?.runeword).toBe(true)
          expect((currentItem.rawFlags! & ItemFlag.RUNEWORD) !== 0).toBe(true)
          expect(currentItem.rarity).toBe('runeword')
          expect(currentItem.socketedItems?.length).toBe(totalSockets)

          // Verify UiInventoryItem bridge fields
          const uiItem = res.uiItem
          expect(uiItem.quality).toBe('rune')
          expect(uiItem.runewordRunes).toMatch(/^'[A-Za-z]+'$/)
          expect(uiItem.sockets).toBe(totalSockets)

          // Verify English, Chinese, and Bilingual tooltips
          const ttEn = formatItemTooltip(currentItem, 'en')
          const ttZh = formatItemTooltip(currentItem, 'zh')
          const ttBoth = formatItemTooltip(currentItem, 'bilingual')

          expect(ttEn.qualityColor).toBe('#c8a15a')
          expect(ttZh.qualityColor).toBe('#c8a15a')
          expect(ttBoth.qualityColor).toBe('#c8a15a')
          expect(ttEn.runewordRunes).toBe(uiItem.runewordRunes)
          expect(ttEn.subTitle).toBeTruthy()
          expect(ttZh.subTitle).toBeTruthy()

          // Must not leak raw unformatted property strings
          for (const line of ttBoth.lines) {
            expect(line.text).not.toMatch(/undefined|NaN/)
          }
        }
      }
    }
  })

  it('applies slot-specific GemApplyType modifiers (Weapon=0 vs Armor/Helm=1 vs Shield=2)', () => {
    // 1. Spirit (Tal + Thul + Ort + Amn) in Crystal Sword (Weapon, applyType=0) vs Monarch (Shield, applyType=2)
    const spiritRunes = ['r07', 'r10', 'r09', 'r11']
    let sword = createSocketedBaseItem('crs', 4, { ilvl: 80 })
    let shield = createSocketedBaseItem('uit', 4, { ilvl: 80 })
    expect(resolveGemApplyType(sword)).toBe(0)
    expect(resolveGemApplyType(shield)).toBe(2)

    for (const r of spiritRunes) {
      sword = socketItemWithSubItem(sword, createSocketableItem(r), new Rng(42)).item
      shield = socketItemWithSubItem(shield, createSocketableItem(r), new Rng(42)).item
    }

    expect(sword.flags?.runeword).toBe(true)
    expect(shield.flags?.runeword).toBe(true)

    const swordPropCodes = new Set(sword.rolledProps?.map(p => p.code))
    const shieldPropCodes = new Set(shield.rolledProps?.map(p => p.code))

    // Weapon Spirit gets lifesteal (Amn), dmg-ltng (Ort), dmg-cold (Thul), dmg-pois (Tal)
    expect(swordPropCodes.has('lifesteal')).toBe(true)
    expect(swordPropCodes.has('res-cold')).toBe(false)

    // Shield Spirit gets res-cold (Thul), res-ltng (Ort), res-pois (Tal), thorns (Amn)
    expect(shieldPropCodes.has('res-cold')).toBe(true)
    expect(shieldPropCodes.has('res-ltng')).toBe(true)
    expect(shieldPropCodes.has('res-pois')).toBe(true)
    expect(shieldPropCodes.has('thorns')).toBe(true)
    expect(shieldPropCodes.has('lifesteal')).toBe(false)

    // 2. Fortitude (El + Sol + Dol + Lo) in Berserker Axe (Weapon, applyType=0) vs Archon Plate (Armor, applyType=1)
    const fortRunes = ['r01', 'r12', 'r14', 'r28']
    let axe = createSocketedBaseItem('7wa', 4, { ilvl: 85 })
    let armor = createSocketedBaseItem('utp', 4, { ilvl: 85 })
    expect(resolveGemApplyType(axe)).toBe(0)
    expect(resolveGemApplyType(armor)).toBe(1)

    for (const r of fortRunes) {
      axe = socketItemWithSubItem(axe, createSocketableItem(r), new Rng(99)).item
      armor = socketItemWithSubItem(armor, createSocketableItem(r), new Rng(99)).item
    }

    expect(axe.flags?.runeword).toBe(true)
    expect(armor.flags?.runeword).toBe(true)

    const axePropCodes = new Set(axe.rolledProps?.map(p => p.code))
    const armorPropCodes = new Set(armor.rolledProps?.map(p => p.code))

    // Weapon Fortitude gets deadly (Lo = 20% Deadly Strike) and howl (Dol = Hit Causes Monster to Flee)
    expect(axePropCodes.has('deadly')).toBe(true)
    expect(axePropCodes.has('howl')).toBe(true)
    // Armor Fortitude gets res-ltng-max (Lo = +5% Max Lightning Resist) and red-dmg (Sol = Damage Reduced By 7)
    expect(armorPropCodes.has('res-ltng-max')).toBe(true)
    expect(armorPropCodes.has('red-dmg')).toBe(true)
  })

  it('enforces strict 1.13c Runeword invariants (exact sockets, exact rune order, item type hierarchy, normal/superior quality)', () => {
    // 1. Wrong rune order: Jah + Thul + Ber in 3-socket Mage Plate ("Enigma" fail)
    let wrongOrderArmor = createSocketedBaseItem('xtp', 3, { ilvl: 85 })
    for (const r of ['r31', 'r10', 'r30']) {
      wrongOrderArmor = socketItemWithSubItem(wrongOrderArmor, createSocketableItem(r)).item
    }
    expect(wrongOrderArmor.flags?.runeword).toBe(false)
    expect(wrongOrderArmor.name).toBe('Gemmed Mage Plate')
    expect(wrongOrderArmor.nameZh).toBe('镶嵌的法师铠甲')

    // 2. Extra sockets: Stealth (Tal + Eth) in a 3-socket Mage Plate
    let threeSocketArmor = createSocketedBaseItem('xtp', 3, { ilvl: 85 })
    threeSocketArmor = socketItemWithSubItem(threeSocketArmor, createSocketableItem('r07')).item
    threeSocketArmor = socketItemWithSubItem(threeSocketArmor, createSocketableItem('r05')).item
    expect(threeSocketArmor.flags?.runeword).toBe(false)
    expect(threeSocketArmor.name).toBe('Gemmed Mage Plate')

    // 3. Wrong item type: Insight (Ral + Tir + Tal + Sol) requires pole/staf; must fail on a Spear ('spr')
    let spear = createSocketedBaseItem('spr', 4, { ilvl: 85 })
    for (const r of ['r08', 'r03', 'r07', 'r12']) {
      spear = socketItemWithSubItem(spear, createSocketableItem(r)).item
    }
    expect(spear.flags?.runeword).toBe(false)
    expect(spear.name).toBe('Gemmed Spear')

    // 4. Heart of the Oak (Ko + Vex + Pul + Thul) requires staf/mace; fails on Crystal Sword ('crs'), succeeds on Flail ('fla')
    let swordHoto = createSocketedBaseItem('crs', 4, { ilvl: 85 })
    let flailHoto = createSocketedBaseItem('fla', 4, { ilvl: 85 })
    for (const r of ['r18', 'r26', 'r21', 'r10']) {
      swordHoto = socketItemWithSubItem(swordHoto, createSocketableItem(r)).item
      flailHoto = socketItemWithSubItem(flailHoto, createSocketableItem(r)).item
    }
    expect(swordHoto.flags?.runeword).toBe(false)
    expect(flailHoto.flags?.runeword).toBe(true)
    expect(flailHoto.name).toBe('Heart of the Oak')
    expect(flailHoto.nameZh).toBe('橡树之心')

    // 5. Magic base item with 4 sockets (Jeweler's Monarch) cannot form Spirit Runeword
    let magicMonarch = createSocketedBaseItem('uit', 4, {
      ilvl: 85,
      quality: ItemQuality.MAGIC,
    })
    magicMonarch = {
      ...magicMonarch,
      name: "Jeweler's Monarch",
      rarity: 'magic',
    }
    for (const r of ['r07', 'r10', 'r09', 'r11']) {
      magicMonarch = socketItemWithSubItem(magicMonarch, createSocketableItem(r)).item
    }
    expect(magicMonarch.flags?.runeword).toBe(false)
    expect(magicMonarch.name).toBe("Jeweler's Monarch")
    // Still receives Shield rune modifiers!
    expect(magicMonarch.rolledProps?.some(p => p.code === 'res-cold' && p.value === 35)).toBe(true)

    // 6. Superior base item WITH base rolledProps (+15% Enhanced Defense) forms Runeword AND retains base mods
    let supMonarch = createSocketedBaseItem('uit', 4, {
      ilvl: 85,
      quality: ItemQuality.SUPERIOR,
      baseRolledProps: [{ code: 'ac%', min: 15, max: 15, value: 15 }],
    })
    for (const r of ['r07', 'r10', 'r09', 'r11']) {
      supMonarch = socketItemWithSubItem(supMonarch, createSocketableItem(r)).item
    }
    expect(supMonarch.flags?.runeword).toBe(true)
    expect(supMonarch.name).toBe('Spirit')
    expect(supMonarch.nameZh).toBe('精神')
    expect(supMonarch.rolledProps?.some(p => p.code === 'ac%' && p.value === 15)).toBe(true)
  })

  it('supports Horadric Cube unsocketing, normal base socketing, and rune/gem upgrade recipes', () => {
    const tables = getEmbeddedDropTables()
    // 1. Unsocketing Recipe: 1x Hel ('r15') + 1x Scroll of Town Portal ('tsc') + Spirit Superior Monarch
    let supMonarch = createSocketedBaseItem('uit', 4, {
      ilvl: 85,
      quality: ItemQuality.SUPERIOR,
      baseRolledProps: [{ code: 'ac%', min: 15, max: 15, value: 15 }],
    })
    for (const r of ['r07', 'r10', 'r09', 'r11']) {
      supMonarch = socketItemWithSubItem(supMonarch, createSocketableItem(r)).item
    }
    const spiritUi = { ...itemToUiInventoryItem(supMonarch, tables), id: 'spirit_monarch_1' }
    const helUi = { ...itemToUiInventoryItem(createSocketableItem('r15'), tables), id: 'hel_1' }
    const tscUi = { ...itemToUiInventoryItem(createSocketableItem('tsc'), tables), id: 'tsc_1' }

    const unsocketRes = transmuteCubeItems([
      { item: spiritUi, col: 0, row: 0 },
      { item: helUi, col: 2, row: 0 },
      { item: tscUi, col: 2, row: 1 },
    ])
    expect(unsocketRes.matched).toBe(true)
    expect(unsocketRes.resultItems.length).toBe(1)

    const restoredUi = unsocketRes.resultItems[0]!.item
    expect(restoredUi.quality).toBe('normal')
    expect(restoredUi.runewordRunes).toBeUndefined()
    expect(getTotalSocketCount(restoredUi)).toBe(4)
    expect(getFilledSocketCount(restoredUi)).toBe(0)
    expect(restoredUi.rawItem?.flags?.runeword).toBe(false)
    expect(restoredUi.rawItem?.rolledProps?.some(p => p.code === 'ac%' && p.value === 15)).toBe(true)

    // 2. Normal Base Socketing Recipe: Tal + Thul + Perfect Topaz + Unsocketed Archon Plate -> 1..4 sockets
    const unsocketedAp = { ...itemToUiInventoryItem(createSocketedBaseItem('utp', 0, { ilvl: 85 }), tables), id: 'clean_ap' }
    const talUi = { ...itemToUiInventoryItem(createSocketableItem('r07'), tables), id: 'tal_1' }
    const thulUi = { ...itemToUiInventoryItem(createSocketableItem('r10'), tables), id: 'thul_1' }
    const ptopazUi = { ...itemToUiInventoryItem(createSocketableItem('gpy'), tables), id: 'gpy_1' }

    const socketArmorRes = transmuteCubeItems(
      [
        { item: unsocketedAp, col: 0, row: 0 },
        { item: talUi, col: 2, row: 0 },
        { item: thulUi, col: 2, row: 1 },
        { item: ptopazUi, col: 2, row: 2 },
      ],
      new Rng(12345),
    )
    expect(socketArmorRes.matched).toBe(true)
    expect(socketArmorRes.resultItems.length).toBe(1)
    const socketedAp = socketArmorRes.resultItems[0]!.item
    expect(socketedAp.sockets).toBeGreaterThanOrEqual(1)
    expect(socketedAp.sockets).toBeLessThanOrEqual(4)

    // 3. Rejects Superior item in Normal Base Socketing Recipe
    const supUnsocketedAp = {
      ...itemToUiInventoryItem(
        createSocketedBaseItem('utp', 0, { ilvl: 85, quality: ItemQuality.SUPERIOR }),
        tables,
      ),
      id: 'sup_ap',
    }
    const rejectSupRes = transmuteCubeItems([
      { item: supUnsocketedAp, col: 0, row: 0 },
      { item: talUi, col: 2, row: 0 },
      { item: thulUi, col: 2, row: 1 },
      { item: ptopazUi, col: 2, row: 2 },
    ])
    expect(rejectSupRes.matched).toBe(false)

    // 4. Rune Upgrade: 3x El ('r01') -> 1x Eld ('r02')
    const el1 = { ...itemToUiInventoryItem(createSocketableItem('r01'), tables), id: 'el_1' }
    const el2 = { ...itemToUiInventoryItem(createSocketableItem('r01'), tables), id: 'el_2' }
    const el3 = { ...itemToUiInventoryItem(createSocketableItem('r01'), tables), id: 'el_3' }
    const runeUpRes = transmuteCubeItems([
      { item: el1, col: 0, row: 0 },
      { item: el2, col: 1, row: 0 },
      { item: el3, col: 2, row: 0 },
    ])
    expect(runeUpRes.matched).toBe(true)
    expect(runeUpRes.resultItems[0]?.item.code).toBe('r02')

    // 5. High Rune Upgrade with Gem: 2x Ber ('r30') + 1x Flawless Sapphire ('glb') -> 1x Jah ('r31')
    const ber1 = { ...itemToUiInventoryItem(createSocketableItem('r30'), tables), id: 'ber_1' }
    const ber2 = { ...itemToUiInventoryItem(createSocketableItem('r30'), tables), id: 'ber_2' }
    const glb = { ...itemToUiInventoryItem(createSocketableItem('glb'), tables), id: 'glb_1' }
    const highRuneUpRes = transmuteCubeItems([
      { item: ber1, col: 0, row: 0 },
      { item: ber2, col: 1, row: 0 },
      { item: glb, col: 2, row: 0 },
    ])
    expect(highRuneUpRes.matched).toBe(true)
    expect(highRuneUpRes.resultItems[0]?.item.code).toBe('r31')

    // 6. Gem Upgrade: 3x Flawless Amethyst ('gzv') -> 1x Perfect Amethyst ('gpv')
    const gzv1 = { ...itemToUiInventoryItem(createSocketableItem('gzv'), tables), id: 'gzv_1' }
    const gzv2 = { ...itemToUiInventoryItem(createSocketableItem('gzv'), tables), id: 'gzv_2' }
    const gzv3 = { ...itemToUiInventoryItem(createSocketableItem('gzv'), tables), id: 'gzv_3' }
    const gemUpRes = transmuteCubeItems([
      { item: gzv1, col: 0, row: 0 },
      { item: gzv2, col: 1, row: 0 },
      { item: gzv3, col: 2, row: 0 },
    ])
    expect(gemUpRes.matched).toBe(true)
    expect(gemUpRes.resultItems[0]?.item.code).toBe('gpv')
  })

  it('supports interactive UI click-to-socket across Inventory, Equipment, Stash, and Horadric Cube', () => {
    const tables = getEmbeddedDropTables()
    const inv = new InventoryPanel()
    const worldPanels = new WorldPanelsHud()

    // 1. Place a 4-socket Crystal Sword in Inventory (col=0, row=0)
    const crystalSwordUi = { ...itemToUiInventoryItem(createSocketedBaseItem('crs', 4, { ilvl: 80 }), tables), id: 'inv_crs' }
    inv.gridItems = [{ item: crystalSwordUi, col: 0, row: 0 }]

    // Click with Tal, Thul, Ort, Amn on cursor onto cell (0, 0)
    for (const code of ['r07', 'r10', 'r09', 'r11']) {
      inv.cursorItem = { ...itemToUiInventoryItem(createSocketableItem(code), tables), id: `cursor_${code}` }
      expect(inv.clickGridCell(0, 0)).toBe(true)
      expect(inv.cursorItem).toBeNull() // Rune consumed into socket!
    }

    const completedSword = inv.gridItems.find(p => p.col === 0 && p.row === 0)?.item
    expect(completedSword).toBeDefined()
    expect(completedSword?.quality).toBe('rune')
    expect(completedSword?.runewordRunes).toBe("'TalThulOrtAmn'")
    expect(completedSword?.rawItem?.flags?.runeword).toBe(true)

    // 1b. Equip a 2-socket Bone Shield in weapon2 slot and socket Rhyme (Shael + Eth) via clickEquipSlot
    inv.equipped.weapon2 = { ...itemToUiInventoryItem(createSocketedBaseItem('bsh', 2, { ilvl: 80 }), tables), id: 'eq_bsh' }
    for (const code of ['r13', 'r05']) {
      inv.cursorItem = { ...itemToUiInventoryItem(createSocketableItem(code), tables), id: `eq_cursor_${code}` }
      expect(inv.clickEquipSlot('weapon2')).toBe(true)
      expect(inv.cursorItem).toBeNull()
    }
    expect(inv.equipped.weapon2?.quality).toBe('rune')
    expect(inv.equipped.weapon2?.runewordRunes).toBe("'ShaelEth'")
    expect(inv.equipped.weapon2?.rawItem?.name).toBe('Rhyme')
    expect(inv.equipped.weapon2?.rawItem?.nameZh).toBe('押韵')

    // 2. Place a 2-socket Mage Plate in Stash (col=0, row=0) and socket Stealth (Tal + Eth)
    worldPanels.stashItems = []
    const magePlateUi = { ...itemToUiInventoryItem(createSocketedBaseItem('xtp', 2, { ilvl: 80 }), tables), id: 'stash_xtp' }
    worldPanels.stashItems.push({ item: magePlateUi, col: 0, row: 0 })

    for (const code of ['r07', 'r05']) {
      const cursorRune = { ...itemToUiInventoryItem(createSocketableItem(code), tables), id: `stash_cursor_${code}` }
      const stashClickRes = worldPanels.clickStashCell(0, 0, cursorRune)
      expect(stashClickRes).toEqual({ handled: true, newCursorItem: null })
    }

    const stealthArmor = worldPanels.stashItems[0]?.item
    expect(stealthArmor?.quality).toBe('rune')
    expect(stealthArmor?.runewordRunes).toBe("'TalEth'")
    expect(stealthArmor?.rawItem?.name).toBe('Stealth')
    expect(stealthArmor?.rawItem?.nameZh).toBe('隐秘')

    // 3. Place Stealth Mage Plate + Hel + Scroll of Town Portal in Cube and call worldPanels.transmuteCube()
    worldPanels.cubeItems = [
      { item: stealthArmor!, col: 0, row: 0 },
      { item: { ...itemToUiInventoryItem(createSocketableItem('r15'), tables), id: 'cube_hel' }, col: 2, row: 0 },
      { item: { ...itemToUiInventoryItem(createSocketableItem('tsc'), tables), id: 'cube_tsc' }, col: 2, row: 1 },
    ]
    expect(worldPanels.transmuteCube().matched).toBe(true)
    expect(worldPanels.cubeItems.length).toBe(1)
    expect(worldPanels.cubeItems[0]?.item.quality).toBe('normal')
    expect(getFilledSocketCount(worldPanels.cubeItems[0]?.item)).toBe(0)
    expect(getTotalSocketCount(worldPanels.cubeItems[0]?.item)).toBe(2)
  })
})

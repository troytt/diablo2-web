/**
 * tests/inventory.test.ts
 *
 * Comprehensive Unit and Parity Test Suite for Milestone M4 (Issue #149):
 * Base item `invfile` audit & authentic charm icons (`invch1`..`invch9`).
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveItemSpriteRect, InventoryPanel, EQUIP_SLOTS_LAYOUT, INV_GRID_ORIGIN } from '../src/client/ui/inventory.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { parseTable } from '../src/common/items/tables.ts'
import { DEMO_BAG_ITEMS, DEMO_EQUIPPED_GEAR } from './fixtures/demo-profile-data.ts'

describe('Milestone M4 (Issue #149): Base item invfile audit & charm icons', () => {
  const itemRects = BAKED_UI_MANIFEST.itemRects
  const codeToInv = BAKED_UI_MANIFEST.codeToInvFile

  it('bakes all authentic charm DC6 icons invch1..invch9, invmss, invtrch into items atlas', () => {
    // 1. All 9 charm sprite variants exist in itemRects
    for (let i = 1; i <= 9; i++) {
      const charmKey = `invch${i}`
      expect(itemRects[charmKey], `Expected ${charmKey} in itemRects`).toBeDefined()
      expect(itemRects[charmKey]!.w).toBe(28)
      expect(itemRects[charmKey]!.h).toBeGreaterThan(0)
    }

    // 2. Annihilus and Hellfire Torch icons exist
    expect(itemRects['invmss']).toBeDefined()
    expect(itemRects['invmss']!.w).toBe(28)
    expect(itemRects['invmss']!.h).toBe(28)

    expect(itemRects['invtrch']).toBeDefined()
    expect(itemRects['invtrch']!.w).toBe(28)
    expect(itemRects['invtrch']!.h).toBe(56)

    // 3. Confirm authentic DC6 dimensions from 1.13c MPQ
    expect(itemRects['invch1']!.h).toBe(28) // Small Charm variant 1
    expect(itemRects['invch2']!.h).toBe(56) // Large Charm variant 1
    expect(itemRects['invch3']!.h).toBe(84) // Grand Charm variant 1
    expect(itemRects['invch4']!.h).toBe(28) // Small Charm variant 2
    expect(itemRects['invch5']!.h).toBe(56) // Large Charm variant 2
    expect(itemRects['invch6']!.h).toBe(84) // Grand Charm variant 2
    expect(itemRects['invch7']!.h).toBe(28) // Small Charm variant 3
    expect(itemRects['invch8']!.h).toBe(56) // Large Charm variant 3
    expect(itemRects['invch9']!.h).toBe(84) // Grand Charm variant 3
  })

  it('maps authentic charm item codes to charm DC6 icons in codeToInvFile', () => {
    // Base charm code mappings
    expect(codeToInv['cm1']).toBe('invch1')
    expect(codeToInv['cm2']).toBe('invch2')
    expect(codeToInv['cm3']).toBe('invch3')

    // Identity mappings for all 9 charm invfiles
    for (let i = 1; i <= 9; i++) {
      expect(codeToInv[`invch${i}`]).toBe(`invch${i}`)
    }

    // Unique charms
    expect(codeToInv['gheeds']).toBe('invch3')
    expect(codeToInv["Gheed's Fortune"]).toBe('invch3')
    expect(codeToInv['anni']).toBe('invmss')
    expect(codeToInv['Annihilus']).toBe('invmss')
    expect(codeToInv['torch']).toBe('invtrch')
    expect(codeToInv['Hellfire Torch']).toBe('invtrch')
  })

  describe('resolveItemSpriteRect charm resolution', () => {
    it('cm1 (Small Charm) resolves to 1x1 charm rect (invch1, invch4, invch7, or invmss)', () => {
      const validSmallCharmKeys = ['invch1', 'invch4', 'invch7', 'invmss']
      const validSmallCharmRects = validSmallCharmKeys.map((k) => itemRects[k]).filter(Boolean)

      // Base item code cm1
      const rectBase = resolveItemSpriteRect({ code: 'cm1' }, itemRects)
      expect(rectBase).not.toBeNull()
      expect(validSmallCharmRects).toContainEqual(rectBase)
      expect(rectBase).toEqual(itemRects['invch1'])
      expect(rectBase!.w).toBe(28)
      expect(rectBase!.h).toBe(28)

      // Item with name
      const rectName = resolveItemSpriteRect({ code: 'cm1', name: 'Small Charm' }, itemRects)
      expect(validSmallCharmRects).toContainEqual(rectName)
      expect(rectName!.h).toBe(28)

      // Item with misc.txt placeholder invfile (invchm)
      const rectPlaceholder = resolveItemSpriteRect(
        { code: 'cm1', invFile: 'invchm', name: 'Small Charm of Vita' },
        itemRects,
      )
      expect(rectPlaceholder).not.toBeNull()
      expect(validSmallCharmRects).toContainEqual(rectPlaceholder)
      expect(rectPlaceholder!.h).toBe(28)

      // Specific variants invch4, invch7
      const rectVar4 = resolveItemSpriteRect({ code: 'cm1', invFile: 'invch4' }, itemRects)
      expect(rectVar4).toEqual(itemRects['invch4'])
      expect(rectVar4!.h).toBe(28)

      const rectVar7 = resolveItemSpriteRect({ code: 'cm1', invFile: 'invch7' }, itemRects)
      expect(rectVar7).toEqual(itemRects['invch7'])
      expect(rectVar7!.h).toBe(28)

      // Unique Annihilus
      const rectAnni = resolveItemSpriteRect({ code: 'anni', name: 'Annihilus' }, itemRects)
      expect(rectAnni).toEqual(itemRects['invmss'])
      expect(rectAnni!.h).toBe(28)
    })

    it('cm2 (Large Charm) resolves to 1x2 charm rect (invch2, invch5, invch8, or invtrch)', () => {
      const validLargeCharmKeys = ['invch2', 'invch5', 'invch8', 'invtrch']
      const validLargeCharmRects = validLargeCharmKeys.map((k) => itemRects[k]).filter(Boolean)

      // Base item code cm2
      const rectBase = resolveItemSpriteRect({ code: 'cm2' }, itemRects)
      expect(rectBase).not.toBeNull()
      expect(validLargeCharmRects).toContainEqual(rectBase)
      expect(rectBase).toEqual(itemRects['invch2'])
      expect(rectBase!.w).toBe(28)
      expect(rectBase!.h).toBe(56)

      // Item with misc.txt placeholder invfile (invwnd - Wand)
      const rectPlaceholder = resolveItemSpriteRect(
        { code: 'cm2', invFile: 'invwnd', name: 'Large Charm of Strength' },
        itemRects,
      )
      expect(rectPlaceholder).not.toBeNull()
      expect(validLargeCharmRects).toContainEqual(rectPlaceholder)
      expect(rectPlaceholder).not.toEqual(itemRects['invwnd'])
      expect(rectPlaceholder!.h).toBe(56)

      // Specific variants invch5, invch8
      const rectVar5 = resolveItemSpriteRect({ code: 'cm2', invFile: 'invch5' }, itemRects)
      expect(rectVar5).toEqual(itemRects['invch5'])
      expect(rectVar5!.h).toBe(56)

      const rectVar8 = resolveItemSpriteRect({ code: 'cm2', invFile: 'invch8' }, itemRects)
      expect(rectVar8).toEqual(itemRects['invch8'])
      expect(rectVar8!.h).toBe(56)

      // Unique Hellfire Torch
      const rectTorch = resolveItemSpriteRect({ code: 'torch', name: 'Hellfire Torch' }, itemRects)
      expect(rectTorch).toEqual(itemRects['invtrch'])
      expect(rectTorch!.h).toBe(56)
    })

    it('cm3 (Grand Charm / Gheed) resolves to 1x3 charm rect (invch3, invch6, invch9), and NOT invsst', () => {
      const validGrandCharmKeys = ['invch3', 'invch6', 'invch9']
      const validGrandCharmRects = validGrandCharmKeys.map((k) => itemRects[k]).filter(Boolean)

      // Base item code cm3
      const rectBase = resolveItemSpriteRect({ code: 'cm3' }, itemRects)
      expect(rectBase).not.toBeNull()
      expect(validGrandCharmRects).toContainEqual(rectBase)
      expect(rectBase).toEqual(itemRects['invch3'])
      expect(rectBase).not.toEqual(itemRects['invsst'])
      expect(rectBase!.w).toBe(28)
      expect(rectBase!.h).toBe(84)

      // Item with misc.txt placeholder invfile (invsst - Short Staff)
      const rectPlaceholder = resolveItemSpriteRect(
        { code: 'cm3', invFile: 'invsst', name: 'Grand Charm of Balance' },
        itemRects,
      )
      expect(rectPlaceholder).not.toBeNull()
      expect(validGrandCharmRects).toContainEqual(rectPlaceholder)
      expect(rectPlaceholder).not.toEqual(itemRects['invsst'])
      expect(rectPlaceholder!.h).toBe(84)

      // Specific variants invch6, invch9
      const rectVar6 = resolveItemSpriteRect({ code: 'cm3', invFile: 'invch6' }, itemRects)
      expect(rectVar6).toEqual(itemRects['invch6'])
      expect(rectVar6!.h).toBe(84)

      const rectVar9 = resolveItemSpriteRect({ code: 'cm3', invFile: 'invch9' }, itemRects)
      expect(rectVar9).toEqual(itemRects['invch9'])
      expect(rectVar9!.h).toBe(84)

      // Unique Gheed's Fortune
      const rectGheeds = resolveItemSpriteRect({ code: 'cm3', name: "Gheed's Fortune" }, itemRects)
      expect(rectGheeds).not.toBeNull()
      expect(validGrandCharmRects).toContainEqual(rectGheeds)
      expect(rectGheeds).toEqual(itemRects['invch3'])
      expect(rectGheeds).not.toEqual(itemRects['invsst'])
      expect(rectGheeds!.h).toBe(84)

      const rectGheedsAlias = resolveItemSpriteRect({ code: 'gheeds' }, itemRects)
      expect(rectGheedsAlias).not.toBeNull()
      expect(validGrandCharmRects).toContainEqual(rectGheedsAlias)
      expect(rectGheedsAlias).toEqual(itemRects['invch3'])
      expect(rectGheedsAlias).not.toEqual(itemRects['invsst'])
      expect(rectGheedsAlias!.h).toBe(84)
    })

    it('resolves canonical cm3 to invch3 while rejecting unmapped 1x3 items without fake fallbacks', () => {
      // Unmapped 1x3 item without valid code or invFile returns null
      const fallbackCharm = { name: 'Unknown Grand Charm', invWidth: 1, invHeight: 3 }
      const rectCharm = resolveItemSpriteRect(fallbackCharm, itemRects)
      expect(rectCharm).toBeNull()

      // 1x3 item with cm3 code and missing invfile resolves to invch3
      const fallbackCm3 = { code: 'cm3', invWidth: 1, invHeight: 3 }
      const rectCm3 = resolveItemSpriteRect(fallbackCm3, itemRects)
      expect(rectCm3).toEqual(itemRects['invch3'])
      expect(rectCm3).not.toEqual(itemRects['invsst'])
      expect(rectCm3!.h).toBe(84)

      // Generic unmapped 1x3 item returns null
      const generic1x3 = { invWidth: 1, invHeight: 3 }
      const rect1x3 = resolveItemSpriteRect(generic1x3, itemRects)
      expect(rect1x3).toBeNull()
    })
  })

  describe('Comprehensive Base Item & Starter Inventory Audit', () => {
    it('resolves valid non-null sprite rectangles for all codes in codeToInvFile', () => {
      let resolvedCount = 0
      for (const [code, invFile] of Object.entries(codeToInv)) {
        const rect = resolveItemSpriteRect({ code, invFile }, itemRects)
        expect(rect, `Item code "${code}" (invFile "${invFile}") must resolve to sprite rect`).not.toBeNull()
        expect(rect!.w, `Item code "${code}" width must be > 0`).toBeGreaterThan(0)
        expect(rect!.h, `Item code "${code}" height must be > 0`).toBeGreaterThan(0)
        resolvedCount++
      }
      expect(resolvedCount).toBeGreaterThanOrEqual(300)
    })

    it('resolves valid sprite rectangles for all starter equipped items and bag items', () => {
      for (const [slot, item] of Object.entries(DEMO_EQUIPPED_GEAR)) {
        if (!item) continue
        const rect = resolveItemSpriteRect(item, itemRects)
        expect(rect, `Starter equipped ${slot} (${item.name}) must resolve`).not.toBeNull()
        expect(rect!.w).toBeGreaterThan(0)
        expect(rect!.h).toBeGreaterThan(0)
      }

      for (const { item, col, row } of DEMO_BAG_ITEMS) {
        const rect = resolveItemSpriteRect(item, itemRects)
        expect(rect, `Starter bag item at (${col}, ${row}) (${item.name}) must resolve`).not.toBeNull()
        expect(rect!.w).toBeGreaterThan(0)
        expect(rect!.h).toBeGreaterThan(0)

        // Specifically check charms in bag
        if (item.id === 'bag-gheeds') {
          expect(rect).toEqual(itemRects['invch3'])
          expect(rect).not.toEqual(itemRects['invsst'])
          expect(rect!.h).toBe(84)
        } else if (item.id === 'bag-torch') {
          expect(rect).toEqual(itemRects['invtrch'])
          expect(rect!.h).toBe(56)
        } else if (item.id === 'bag-anni') {
          expect(rect).toEqual(itemRects['invmss'])
          expect(rect!.h).toBe(28)
        }
      }
    })

    it('audits all base items from authentic 1.13c misc.txt, weapons.txt, and armor.txt if MPQs present', async () => {
      const d2Path = join(process.cwd(), 'samples', 'd2')
      if (!existsSync(join(d2Path, 'Patch_D2.mpq'))) {
        return // Skip MPQ read if samples/d2 is not mounted in environment
      }

      const archives = new MountedArchives()
      for (const m of ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(m, await MpqArchive.open(await fileSource(join(d2Path, m))))
      }

      for (const tblFile of ['weapons.txt', 'armor.txt', 'misc.txt']) {
        const data = await archives.read(`data/global/excel/${tblFile}`)
        const tbl = parseTable(new TextDecoder().decode(data))
        for (const row of tbl.rows) {
          const code = row['code']?.trim()
          if (!code) continue
          const invfile = row['invfile']?.trim()
          const rect = resolveItemSpriteRect({ code, invFile: invfile, name: row['name'] }, itemRects)
          expect(rect, `Base item ${code} (${row['name']}) from ${tblFile} must resolve to sprite rect`).not.toBeNull()
          expect(rect!.w).toBeGreaterThan(0)
          expect(rect!.h).toBeGreaterThan(0)

          // Verify charm items never resolve to staff or wand
          if (code === 'cm3') {
            expect(rect).not.toEqual(itemRects['invsst'])
          } else if (code === 'cm2') {
            expect(rect).not.toEqual(itemRects['invwnd'])
          }
        }
      }
    })

    describe('Issue #375: ItemTypes.txt VarInvGfx variants for rings, amulets, jewels, and charms', () => {
      it('bakes all ring (5), amulet (3), and jewel (6) graphic variants into itemRects', () => {
        // Rings: invrin1 to invrin5
        for (let i = 1; i <= 5; i++) {
          const key = `invrin${i}`
          expect(itemRects[key], `Expected ${key} in itemRects`).toBeDefined()
          expect(itemRects[key]!.w).toBe(28)
          expect(itemRects[key]!.h).toBe(28)
        }

        // Amulets: invamu1 to invamu3
        for (let i = 1; i <= 3; i++) {
          const key = `invamu${i}`
          expect(itemRects[key], `Expected ${key} in itemRects`).toBeDefined()
          expect(itemRects[key]!.w).toBe(28)
          expect(itemRects[key]!.h).toBe(28)
        }

        // Jewels: invjw1 to invjw6
        for (let i = 1; i <= 6; i++) {
          const key = `invjw${i}`
          expect(itemRects[key], `Expected ${key} in itemRects`).toBeDefined()
          expect(itemRects[key]!.w).toBe(28)
          expect(itemRects[key]!.h).toBe(28)
        }
      })

      it('resolves all ring variants 0..4 correctly', () => {
        for (let v = 0; v < 5; v++) {
          const rect = resolveItemSpriteRect({ code: 'rin', variant: v }, itemRects)
          expect(rect).toEqual(itemRects[`invrin${v + 1}`])
        }
        // Direct invFile
        expect(resolveItemSpriteRect({ code: 'rin', invFile: 'invrin3' }, itemRects)).toEqual(itemRects['invrin3'])
      })

      it('resolves all amulet variants 0..2 correctly', () => {
        for (let v = 0; v < 3; v++) {
          const rect = resolveItemSpriteRect({ code: 'amu', variant: v }, itemRects)
          expect(rect).toEqual(itemRects[`invamu${v + 1}`])
        }
        // Direct invFile
        expect(resolveItemSpriteRect({ code: 'amu', invFile: 'invamu2' }, itemRects)).toEqual(itemRects['invamu2'])
      })

      it('resolves all jewel variants 0..5 correctly', () => {
        for (let v = 0; v < 6; v++) {
          const rect = resolveItemSpriteRect({ code: 'jew', variant: v }, itemRects)
          expect(rect).toEqual(itemRects[`invjw${v + 1}`])
        }
        // Direct invFile
        expect(resolveItemSpriteRect({ code: 'jew', invFile: 'invjw5' }, itemRects)).toEqual(itemRects['invjw5'])
      })

      it('resolves charm variants when variant property is specified', () => {
        expect(resolveItemSpriteRect({ code: 'cm1', variant: 0 }, itemRects)).toEqual(itemRects['invch1'])
        expect(resolveItemSpriteRect({ code: 'cm1', variant: 1 }, itemRects)).toEqual(itemRects['invch4'])
        expect(resolveItemSpriteRect({ code: 'cm1', variant: 2 }, itemRects)).toEqual(itemRects['invch7'])

        expect(resolveItemSpriteRect({ code: 'cm2', variant: 0 }, itemRects)).toEqual(itemRects['invch2'])
        expect(resolveItemSpriteRect({ code: 'cm2', variant: 1 }, itemRects)).toEqual(itemRects['invch5'])
        expect(resolveItemSpriteRect({ code: 'cm2', variant: 2 }, itemRects)).toEqual(itemRects['invch8'])

        expect(resolveItemSpriteRect({ code: 'cm3', variant: 0 }, itemRects)).toEqual(itemRects['invch3'])
        expect(resolveItemSpriteRect({ code: 'cm3', variant: 1 }, itemRects)).toEqual(itemRects['invch6'])
        expect(resolveItemSpriteRect({ code: 'cm3', variant: 2 }, itemRects)).toEqual(itemRects['invch9'])
      })
    })
  })
})


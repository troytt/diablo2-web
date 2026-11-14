/**
 * tests/set-items-icons-dye.test.ts
 *
 * Verifies Diablo II v1.13c parity for:
 * 1. M'avina's Battle Hymn set items off-white dyeing (whit colormap from invgreybrown.dat table 0).
 * 2. Trang-Oul's Guise dedicated set icon (invbhmu inherited from uh9 setinvfile).
 * 3. Griswold's Heart dedicated set icon (invxaru inherited from xar setinvfile).
 * 4. Ground flippy item sprites for M'avina pieces.
 * 5. Regression protection for existing dyed items (Harlequin Crest cgrn, Tal Rasha dpur, Magefist lgry, Arachnid Mesh blac).
 */

import { describe, it, expect } from 'vitest'
import { resolveItemSpriteRect, resolveGroundItemSpriteRect } from '../src/client/ui/inventory.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import { createRolledAffix } from '../src/common/items/affix-generator.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { itemToUiInventoryItem, resolveItemColorTransform, resolveItemInvFile } from '../src/common/items/item-bridge.ts'
import { applyInvTransToRgbaPixels, ensureDyedItemSpriteRect, getAct1PaletteRgb, getInvTransRowTable, resolveItemInvTrans } from '../src/common/items/item-palette-dyer.ts'
import { ItemQuality } from '../src/common/items/items.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { CLASS_EXCLUSIVE_SETS } from '../src/common/units/class-starter-profiles.ts'

describe('Set Items Dedicated Icons & Color Dyeing Parity (D2 1.13c)', () => {
  describe("Trang-Oul's Guise dedicated icon (invbhmu)", () => {
    it('sets dedicated invFile invbhmu in Necromancer starter profile', () => {
      const trangHelm = CLASS_EXCLUSIVE_SETS.nec.helm!
      expect(trangHelm).toBeDefined()
      expect(trangHelm.name).toBe("Trang-Oul's Guise")
      expect(trangHelm.code).toBe('uh9')
      expect(trangHelm.invFile).toBe('invbhmu')
    })

    it("maps Trang-Oul's Guise to invbhmu in BAKED_UI_MANIFEST.codeToInvFile", () => {
      expect(BAKED_UI_MANIFEST.codeToInvFile["Trang-Oul's Guise"]).toBe('invbhmu')
    })

    it('resolves valid non-zero sprite rectangle for invbhmu', () => {
      const rect = resolveItemSpriteRect(CLASS_EXCLUSIVE_SETS.nec.helm!)
      expect(rect).toBeDefined()
      expect(rect).toEqual(BAKED_UI_MANIFEST.itemRects['invbhmu'])
      expect(rect!.w).toBeGreaterThan(0)
      expect(rect!.h).toBeGreaterThan(0)
    })

    it('does not resolve to generic base bone helm invbhm', () => {
      const rect = resolveItemSpriteRect(CLASS_EXCLUSIVE_SETS.nec.helm!)
      const baseRect = BAKED_UI_MANIFEST.itemRects['invbhm']
      expect(rect).not.toEqual(baseRect)
    })

    it('resolves invbhmu by item name even if invFile is omitted', () => {
      const rect = resolveItemSpriteRect({ name: "Trang-Oul's Guise" })
      expect(rect).toEqual(BAKED_UI_MANIFEST.itemRects['invbhmu'])
    })
  })

  describe("Griswold's Heart dedicated icon (invxaru)", () => {
    it('sets dedicated invFile invxaru in Paladin starter profile', () => {
      const grisArmor = CLASS_EXCLUSIVE_SETS.pal.armor!
      expect(grisArmor).toBeDefined()
      expect(grisArmor.name).toBe("Griswold's Heart")
      expect(grisArmor.code).toBe('xar')
      expect(grisArmor.invFile).toBe('invxaru')
    })

    it("maps Griswold's Heart to invxaru in BAKED_UI_MANIFEST.codeToInvFile", () => {
      expect(BAKED_UI_MANIFEST.codeToInvFile["Griswold's Heart"]).toBe('invxaru')
    })

    it('resolves valid non-zero sprite rectangle for invxaru', () => {
      const rect = resolveItemSpriteRect(CLASS_EXCLUSIVE_SETS.pal.armor!)
      expect(rect).toBeDefined()
      expect(rect).toEqual(BAKED_UI_MANIFEST.itemRects['invxaru'])
      expect(rect!.w).toBeGreaterThan(0)
      expect(rect!.h).toBeGreaterThan(0)
    })

    it('does not resolve to generic base ornate plate invaar', () => {
      const rect = resolveItemSpriteRect(CLASS_EXCLUSIVE_SETS.pal.armor!)
      const baseRect = BAKED_UI_MANIFEST.itemRects['invaar']
      expect(rect).not.toEqual(baseRect)
    })

    it('resolves invxaru by item name even if invFile is omitted', () => {
      const rect = resolveItemSpriteRect({ name: "Griswold's Heart" })
      expect(rect).toEqual(BAKED_UI_MANIFEST.itemRects['invxaru'])
    })
  })

  describe("M'avina's Battle Hymn off-white (whit) dyeing parity", () => {
    const mavinaPieces = [
      { slot: 'helm', name: "M'avina's True Sight", baseInv: 'invci3', dyedInv: 'invci3_whit', flp: 'flpci2_whit' },
      { slot: 'armor', name: "M'avina's Embrace", baseInv: 'invfld', dyedInv: 'invfld_whit', flp: 'flpfld_whit' },
      { slot: 'gloves', name: "M'avina's Icy Clutch", baseInv: 'invtgl', dyedInv: 'invtgl_whit', flp: 'flptgl_whit' },
      { slot: 'belt', name: "M'avina's Tenet", baseInv: 'invvbl', dyedInv: 'invvbl_whit', flp: 'flpvbl_whit' },
      { slot: 'weapon1', name: "M'avina's Caster", baseInv: 'invam2', dyedInv: 'invam2_whit', flp: 'flpam2_whit' },
    ] as const

    it('has invtransform: whit on all 5 pieces in Amazon starter profile', () => {
      const amaSet = CLASS_EXCLUSIVE_SETS.ama
      for (const p of mavinaPieces) {
        const item = (amaSet as any)[p.slot]
        expect(item, `Amazon starter set must include ${p.slot}`).toBeDefined()
        expect(item.invtransform, `${p.name} must have invtransform: 'whit'`).toBe('whit')
      }
    })

    it('registers all 5 dyed variants in BAKED_UI_MANIFEST.itemRects with non-zero dimensions', () => {
      for (const p of mavinaPieces) {
        const rect = BAKED_UI_MANIFEST.itemRects[p.dyedInv]
        expect(rect, `itemRects must contain ${p.dyedInv}`).toBeDefined()
        expect(rect!.w).toBeGreaterThan(0)
        expect(rect!.h).toBeGreaterThan(0)
      }
    })

    it('maps all 5 piece names to dyed variants in codeToInvFile', () => {
      for (const p of mavinaPieces) {
        expect(BAKED_UI_MANIFEST.codeToInvFile[p.name], `codeToInvFile[${p.name}] must map to ${p.dyedInv}`).toBe(p.dyedInv)
      }
    })

    it('resolves dyed rects from starter items via resolveItemSpriteRect', () => {
      const amaSet = CLASS_EXCLUSIVE_SETS.ama
      for (const p of mavinaPieces) {
        const item = (amaSet as any)[p.slot]
        const rect = resolveItemSpriteRect(item)
        expect(rect, `${p.name} must resolve to ${p.dyedInv}`).toEqual(BAKED_UI_MANIFEST.itemRects[p.dyedInv])
      }
    })

    it('resolves dyed rects when given base invFile + invtransform: whit', () => {
      for (const p of mavinaPieces) {
        const rect = resolveItemSpriteRect({ invFile: p.baseInv, invtransform: 'whit' })
        expect(rect, `${p.baseInv} + whit must resolve to ${p.dyedInv}`).toEqual(BAKED_UI_MANIFEST.itemRects[p.dyedInv])
      }
    })

    it('resolves dyed rects when given item name alone', () => {
      for (const p of mavinaPieces) {
        const rect = resolveItemSpriteRect({ name: p.name })
        expect(rect, `${p.name} alone must resolve to ${p.dyedInv}`).toEqual(BAKED_UI_MANIFEST.itemRects[p.dyedInv])
      }
    })

    it("resolves authentic ground flippy sprites for all 5 M'avina pieces", () => {
      for (const p of mavinaPieces) {
        const flpRect = resolveGroundItemSpriteRect({ name: p.name, invtransform: 'whit' })
        expect(flpRect, `${p.name} ground item must resolve to ${p.flp}`).toEqual(BAKED_UI_MANIFEST.flippyRects[p.flp])
        expect(flpRect!.w).toBeGreaterThan(0)
        expect(flpRect!.h).toBeGreaterThan(0)
      }
    })
  })

  describe('Regression: existing dyed items remain fully intact', () => {
    it('resolves Harlequin Crest to invcap_cgrn and flpcap_cgrn', () => {
      expect(resolveItemSpriteRect({ invFile: 'invcap', invtransform: 'cgrn' })).toEqual(BAKED_UI_MANIFEST.itemRects['invcap_cgrn'])
      expect(resolveItemSpriteRect({ name: 'Harlequin Crest' })).toEqual(BAKED_UI_MANIFEST.itemRects['invcap_cgrn'])
      expect(resolveGroundItemSpriteRect({ name: 'Harlequin Crest', invtransform: 'cgrn' })).toEqual(BAKED_UI_MANIFEST.flippyRects['flpcap_cgrn'])
    })

    it("resolves Tal Rasha's Guardianship to invgth_dpur", () => {
      expect(resolveItemSpriteRect({ invFile: 'invgth', invtransform: 'dpur' })).toEqual(BAKED_UI_MANIFEST.itemRects['invgth_dpur'])
      expect(resolveItemSpriteRect({ name: "Tal Rasha's Guardianship" })).toEqual(BAKED_UI_MANIFEST.itemRects['invgth_dpur'])
    })

    it("bakes Tal Rasha's Horadric Crest (invmsk_dpur) with xsk InvTrans=2 (grey2.dat) preserving golden/bone mask RGB, and leaves Tal Rasha's Adjudication (amu InvTrans=0) undyed", async () => {
      const { readFileSync } = await import('node:fs')
      const { inflateSync } = await import('node:zlib')

      // 1. Tal Rasha's Adjudication (amu, InvTrans=0) must NOT be dyed in 2D inventory
      expect(BAKED_UI_MANIFEST.codeToInvFile["Tal Rasha's Adjudication"]).toBe('invamu')
      expect(BAKED_UI_MANIFEST.itemRects['invamu_dpur']).toBeUndefined()
      expect(resolveItemSpriteRect(CLASS_EXCLUSIVE_SETS.sor.amulet!)).toEqual(BAKED_UI_MANIFEST.itemRects['invamu1'])

      // 2. Tal Rasha's Horadric Crest (xsk, InvTrans=2 -> grey2.dat) must preserve 91.6% golden/bone pixels
      expect(resolveItemSpriteRect(CLASS_EXCLUSIVE_SETS.sor.helm!)).toEqual(BAKED_UI_MANIFEST.itemRects['invmsk_dpur'])

      const png = readFileSync('public/ui/items-atlas.png')
      let off = 8
      let w = 0
      let h = 0
      let plte: Buffer | null = null
      const idats: Buffer[] = []
      while (off < png.length) {
        const len = png.readUInt32BE(off)
        const type = png.toString('ascii', off + 4, off + 8)
        const chunk = png.subarray(off + 8, off + 8 + len)
        if (type === 'IHDR') {
          w = chunk.readUInt32BE(0)
          h = chunk.readUInt32BE(4)
        } else if (type === 'PLTE') {
          plte = chunk
        } else if (type === 'IDAT') {
          idats.push(chunk)
        }
        off += 12 + len
      }
      const raw = inflateSync(Buffer.concat(idats))
      const stride = w + 1
      const pixels = new Uint8Array(w * h)
      for (let y = 0; y < h; y++) {
        const filter = raw[y * stride]
        for (let x = 0; x < w; x++) {
          const b = raw[y * stride + 1 + x]!
          if (filter === 0) pixels[y * w + x] = b
          else if (filter === 1) pixels[y * w + x] = ((x > 0 ? pixels[y * w + x - 1]! : 0) + b) & 0xff
          else if (filter === 2) pixels[y * w + x] = ((y > 0 ? pixels[(y - 1) * w + x]! : 0) + b) & 0xff
        }
      }

      const rect = BAKED_UI_MANIFEST.itemRects['invmsk_dpur']!
      let rSum = 0
      let gSum = 0
      let bSum = 0
      let n = 0
      for (let y = rect.y; y < rect.y + rect.h; y++) {
        for (let x = rect.x; x < rect.x + rect.w; x++) {
          const idx = pixels[y * w + x]!
          if (idx === 0) continue
          rSum += plte![idx * 3]!
          gSum += plte![idx * 3 + 1]!
          bSum += plte![idx * 3 + 2]!
          n++
        }
      }
      const avgR = Math.round(rSum / n)
      const avgG = Math.round(gSum / n)
      const avgB = Math.round(bSum / n)
      // Under grey2.dat row 18 (dpur), invmsk_dpur has avgRGB = (95, 80, 49) (warm golden/bone: R > G > B),
      // whereas wrong invgreybrown.dat gave (67, 35, 63) and wrong pal.pl2 gave (72, 22, 131).
      expect([avgR, avgG, avgB]).toEqual([95, 80, 49])
    })

    it('resolves Magefist to invtgl_lgry', () => {
      expect(resolveItemSpriteRect({ invFile: 'invtgl', invtransform: 'lgry' })).toEqual(BAKED_UI_MANIFEST.itemRects['invtgl_lgry'])
      expect(resolveItemSpriteRect({ name: 'Magefist' })).toEqual(BAKED_UI_MANIFEST.itemRects['invtgl_lgry'])
    })

    it('resolves Arachnid Mesh to invvbl_blac', () => {
      expect(resolveItemSpriteRect({ invFile: 'invvbl', invtransform: 'blac' })).toEqual(BAKED_UI_MANIFEST.itemRects['invvbl_blac'])
      expect(resolveItemSpriteRect({ name: 'Arachnid Mesh' })).toEqual(BAKED_UI_MANIFEST.itemRects['invvbl_blac'])
    })
  })

  describe('Starter Profiles Dedicated Set Icons Parity (D2 1.13c)', () => {
    it("sets dedicated invFile invaaru for Immortal King's Soul Cage (Barbarian)", () => {
      const ikArmor = CLASS_EXCLUSIVE_SETS.bar.armor!
      expect(ikArmor).toBeDefined()
      expect(ikArmor.code).toBe('uar')
      expect(ikArmor.invFile).toBe('invaaru')
      expect(BAKED_UI_MANIFEST.codeToInvFile[ikArmor.name!]).toBe('invaaru')
      expect(resolveItemSpriteRect(ikArmor)).toEqual(BAKED_UI_MANIFEST.itemRects['invaaru'])
      expect(resolveItemSpriteRect(ikArmor)).not.toEqual(BAKED_UI_MANIFEST.itemRects['invaar'])
    })

    it("sets dedicated invFile invmstu for Aldur's Rhythm (Druid)", () => {
      const aldurWeapon = CLASS_EXCLUSIVE_SETS.dru.weapon1!
      expect(aldurWeapon).toBeDefined()
      expect(aldurWeapon.code).toBe('9mt')
      expect(aldurWeapon.invFile).toBe('invmstu')
      expect(BAKED_UI_MANIFEST.codeToInvFile[aldurWeapon.name!]).toBe('invmstu')
      expect(resolveItemSpriteRect(aldurWeapon)).toEqual(BAKED_UI_MANIFEST.itemRects['invmstu'])
      expect(resolveItemSpriteRect(aldurWeapon)).not.toEqual(BAKED_UI_MANIFEST.itemRects['invmst'])
    })

    it("sets dedicated invFile invbhmu for Natalya's Totem (Assassin)", () => {
      const natHelm = CLASS_EXCLUSIVE_SETS.ass.helm!
      expect(natHelm).toBeDefined()
      expect(natHelm.code).toBe('xh9')
      expect(natHelm.invFile).toBe('invbhmu')
      expect(BAKED_UI_MANIFEST.codeToInvFile[natHelm.name!]).toBe('invbhmu')
      expect(resolveItemSpriteRect(natHelm)).toEqual(BAKED_UI_MANIFEST.itemRects['invbhmu'])
      expect(resolveItemSpriteRect(natHelm)).not.toEqual(BAKED_UI_MANIFEST.itemRects['invbhm'])
    })

    it("sets dedicated invFile invskru for Natalya's Mark (Assassin)", () => {
      const natClaw = CLASS_EXCLUSIVE_SETS.ass.weapon1!
      expect(natClaw).toBeDefined()
      expect(natClaw.code).toBe('7qr')
      expect(natClaw.invFile).toBe('invskru')
      expect(BAKED_UI_MANIFEST.codeToInvFile[natClaw.name!]).toBe('invskru')
      expect(resolveItemSpriteRect(natClaw)).toEqual(BAKED_UI_MANIFEST.itemRects['invskru'])
      expect(resolveItemSpriteRect(natClaw)).not.toEqual(BAKED_UI_MANIFEST.itemRects['invskr'])
    })
  })

  describe('String Table Display Name vs Internal Index Resolution (D2 1.13c)', () => {
    it("resolves Aldur's Rhythm by both internal index and English display name", () => {
      expect(BAKED_UI_MANIFEST.codeToInvFile["Aldur's Gauntlet"]).toBe('invmstu')
      expect(BAKED_UI_MANIFEST.codeToInvFile["Aldur's Rhythm"]).toBe('invmstu')
      expect(resolveItemSpriteRect({ name: "Aldur's Rhythm" })).toEqual(BAKED_UI_MANIFEST.itemRects['invmstu'])
    })

    it("resolves Bartuc's Cut-Throat by internal index (Cutthroat1) and display name", () => {
      expect(BAKED_UI_MANIFEST.codeToInvFile['Cutthroat1']).toBe('invclw')
      expect(BAKED_UI_MANIFEST.codeToInvFile["Bartuc's Cut-Throat"]).toBe('invclw')
      expect(resolveItemSpriteRect({ name: "Bartuc's Cut-Throat" })).toEqual(BAKED_UI_MANIFEST.itemRects['invclw'])
    })

    it("resolves Death's Fathom by internal index (Fathom) and display name", () => {
      expect(BAKED_UI_MANIFEST.codeToInvFile['Fathom']).toBe('invob5')
      expect(BAKED_UI_MANIFEST.codeToInvFile["Death's Fathom"]).toBe('invob5')
      expect(resolveItemSpriteRect({ name: "Death's Fathom" })).toEqual(BAKED_UI_MANIFEST.itemRects['invob5'])
    })

    it("resolves Griswold's Redemption by Blizzard index (with typo Griswolds's) and display name", () => {
      expect(BAKED_UI_MANIFEST.codeToInvFile["Griswolds's Redemption"]).toBe('invwsp_dgld')
      expect(BAKED_UI_MANIFEST.codeToInvFile["Griswold's Redemption"]).toBe('invwsp_dgld')
    })

    it("resolves Whitstan's Guard by Blizzard index (with typo Wihtstan's) and display name", () => {
      expect(BAKED_UI_MANIFEST.codeToInvFile["Wihtstan's Guard"]).toBe('invxmlu')
      expect(BAKED_UI_MANIFEST.codeToInvFile["Whitstan's Guard"]).toBe('invxmlu')
    })
  })

  describe('Rare Name Collisions with UniqueItems.txt & Dynamic Affix Palette Dyeing', () => {
    const COLLISION_CASES = [
      { name: 'Raven Claw', rareCode: 'lgl', expectedInv: 'invlgl', uniqueInv: 'invlbw_dred' },
      { name: 'Skull Splitter', rareCode: 'lgl', expectedInv: 'invlgl', uniqueInv: 'invmpiu' },
      { name: 'Death Cleaver', rareCode: 'cap', expectedInv: 'invcap', uniqueInv: 'invwax' },
      { name: 'Rune Master', rareCode: 'tgl', expectedInv: 'invtgl', uniqueInv: 'inv2ax_lblu' },
      { name: 'Stone Crusher', rareCode: 'vbt', expectedInv: 'invvbt', uniqueInv: 'invwhm' },
      { name: 'Spirit Ward', rareCode: 'hgl', expectedInv: 'invhgl', uniqueInv: 'invgtsu' },
    ] as const

    for (const c of COLLISION_CASES) {
      it(`prevents Rare "${c.name}" (${c.rareCode}) from hijacking Unique icon (${c.uniqueInv})`, () => {
        const tables = getEmbeddedDropTables()
        const base = tables.armor.get(c.rareCode) ?? tables.weapons.get(c.rareCode)!
        const rawRareItem: any = {
          base,
          code: c.rareCode,
          name: c.name,
          quality: ItemQuality.RARE,
          rarity: 'rare',
          identified: true,
          level: 25,
          ilvl: 25,
          invWidth: base.invWidth,
          invHeight: base.invHeight,
          stats: {},
          flags: { identified: true },
        }
        const resolved = resolveItemInvFile(rawRareItem, 'rare', c.rareCode, tables)
        expect(resolved.invFile).toBe(c.expectedInv)
        expect(resolved.invtransform).toBeUndefined()

        const uiItem = itemToUiInventoryItem(rawRareItem, tables)
        expect(uiItem.invFile).toBe(c.expectedInv)
        expect(resolveItemSpriteRect(uiItem)).toEqual(BAKED_UI_MANIFEST.itemRects[c.expectedInv])

        // Even when quality is omitted on a ResolvableItem, mismatched base code blocks the Unique icon
        expect(resolveItemSpriteRect({ code: c.rareCode, name: c.name })).toEqual(
          BAKED_UI_MANIFEST.itemRects[c.expectedInv],
        )
        expect(resolveGroundItemSpriteRect({ code: c.rareCode, name: c.name })).toEqual(
          BAKED_UI_MANIFEST.flippyRects[c.expectedInv.replace(/^inv/, 'flp')],
        )
      })
    }

    it('propagates transform & transformColor on RolledAffix and packet rareAffixes, and dynamically dyes unbaked icons', () => {
      const tables = getEmbeddedDropTables()
      const base = tables.armor.get('lgl')!
      const rng = new D2Rng(42)
      const colorSuffix = tables.magicAffixes.suffixes.all.find(s => s.transform && s.transformColor === 'cred')!
      expect(colorSuffix).toBeDefined()

      const rolledSuffix = createRolledAffix(colorSuffix, rng, 30)
      expect(rolledSuffix.transform).toBe(true)
      expect(rolledSuffix.transformColor).toBe('cred')

      const rareGlovesWithRolledAffix: any = {
        base,
        code: 'lgl',
        name: 'Raven Claw',
        quality: ItemQuality.RARE,
        rarity: 'rare',
        identified: true,
        level: 30,
        ilvl: 30,
        invWidth: base.invWidth,
        invHeight: base.invHeight,
        stats: {},
        flags: { identified: true },
        rolledRareAffixes: {
          name: 'Raven Claw',
          alvl: 30,
          prefix: null,
          suffix: rolledSuffix,
          prefixes: [],
          suffixes: [rolledSuffix],
          affixes: [rolledSuffix],
          baseName: base.name,
        },
      }

      const uiRare = itemToUiInventoryItem(rareGlovesWithRolledAffix, tables)
      expect(uiRare.invFile).toBe('invlgl')
      expect(uiRare.invtransform).toBe('cred')

      // Also verify online packet `rareAffixes` ([pre0, suf0, pre1, suf1, pre2, suf2])
      const packetRareGloves: any = {
        base,
        code: 'lgl',
        name: 'Raven Claw',
        quality: ItemQuality.RARE,
        identified: true,
        rareAffixes: [0, colorSuffix.id ?? 1, 0, 0, 0, 0],
      }
      const packetColors = resolveItemColorTransform(packetRareGloves, 'rare', 'lgl', tables)
      expect(packetColors.invtransform).toBe('cred')
      expect(packetColors.chrtransform).toBe('cred')

      // Verify dynamic sprite rect allocation & caching for `invlgl_cred` (not pre-baked in items-atlas.png)
      expect(resolveItemInvTrans('invlgl', 'lgl')).toBe(8)
      const dyedRect = resolveItemSpriteRect(uiRare)
      expect(dyedRect).toBeDefined()
      expect(dyedRect).toEqual(BAKED_UI_MANIFEST.itemRects['invlgl_cred'])
      expect(dyedRect!.w).toBe(BAKED_UI_MANIFEST.itemRects['invlgl']!.w)
      expect(dyedRect!.h).toBe(BAKED_UI_MANIFEST.itemRects['invlgl']!.h)
      expect(dyedRect!.y).toBeGreaterThanOrEqual(BAKED_UI_MANIFEST.atlasHeight)

      // Verify pixel-level palette remapping matches ACT1/pal.pl2 + invgreybrown.dat row 9 (cred)
      const pal = getAct1PaletteRgb()
      const rowTable = getInvTransRowTable(8, 'cred')!
      expect(rowTable).toBeDefined()
      const samplePalIdx = 20
      const srcRgba = new Uint8ClampedArray([
        pal[samplePalIdx * 3]!,
        pal[samplePalIdx * 3 + 1]!,
        pal[samplePalIdx * 3 + 2]!,
        255,
        0,
        0,
        0,
        0,
      ])
      const dstRgba = applyInvTransToRgbaPixels(srcRgba, 8, 'cred')
      const expectedDstIdx = rowTable[samplePalIdx]!
      expect(dstRgba[0]).toBe(pal[expectedDstIdx * 3])
      expect(dstRgba[1]).toBe(pal[expectedDstIdx * 3 + 1])
      expect(dstRgba[2]).toBe(pal[expectedDstIdx * 3 + 2])
      expect(dstRgba[3]).toBe(255)
      expect(dstRgba[7]).toBe(0)

      // Non-dyeable items (`InvTrans == 0`, e.g. rings `rin` -> `invrin1`) do not allocate dynamic dyed rects
      expect(resolveItemInvTrans('invrin1', 'rin')).toBe(0)
      expect(ensureDyedItemSpriteRect('invrin1', 'cred', BAKED_UI_MANIFEST.itemRects, 'rin')).toBeUndefined()
    })
  })
})

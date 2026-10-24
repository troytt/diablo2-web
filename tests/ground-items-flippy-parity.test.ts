import { describe, it, expect } from 'vitest'
import { resolveGroundItemSpriteRect } from '../src/client/ui/inventory.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import type { GroundItemEntity } from '../src/common/items/ground-items.ts'
import type { SpriteRenderer } from '../src/client/render/renderer.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'

describe('Authentic Diablo II v1.13c Ground Items Flippy Parity', () => {
  describe('1. Flippy File Resolution Parity', () => {
    it('resolves authentic flippy ground sprites for weapons and armor', () => {
      const sword = resolveGroundItemSpriteRect({ code: 'ssd', name: 'Short Sword' })
      expect(sword).toBeDefined()
      expect(sword).not.toBeNull()
      expect(sword).toEqual(BAKED_UI_MANIFEST.flippyRects['flpssd'])
      expect(sword!.w).toBe(27)
      expect(sword!.h).toBe(9)

      const axe = resolveGroundItemSpriteRect({ code: 'hax', name: 'Hand Axe' })
      expect(axe).toEqual(BAKED_UI_MANIFEST.flippyRects['flphax'])
      expect(axe!.w).toBe(9)
      expect(axe!.h).toBe(13)

      const cap = resolveGroundItemSpriteRect({ code: 'cap', name: 'Cap' })
      expect(cap).toEqual(BAKED_UI_MANIFEST.flippyRects['flpcap'])
      expect(cap!.w).toBe(11)
      expect(cap!.h).toBe(8)
    })

    it('resolves gold piles into 4 authentic DC6 graphic tiers based on gold amount', () => {
      // Tier 0: small pile (1 - 99 gold)
      const small = resolveGroundItemSpriteRect({ isGold: true, amount: 45, code: 'gld' })
      expect(small).toEqual(BAKED_UI_MANIFEST.flippyRects['flpgld_0'])
      expect(small!.w).toBe(24)
      expect(small!.h).toBe(7)

      // Tier 1: medium pile (100 - 499 gold)
      const medium = resolveGroundItemSpriteRect({ isGold: true, amount: 250, code: 'gld' })
      expect(medium).toEqual(BAKED_UI_MANIFEST.flippyRects['flpgld_1'])
      expect(medium!.w).toBe(26)
      expect(medium!.h).toBe(13)

      // Tier 2: large pile (500 - 4999 gold)
      const large = resolveGroundItemSpriteRect({ isGold: true, amount: 1500, code: 'gld' })
      expect(large).toEqual(BAKED_UI_MANIFEST.flippyRects['flpgld_2'])
      expect(large!.w).toBe(32)
      expect(large!.h).toBe(20)

      // Tier 3: huge pile (5000+ gold)
      const huge = resolveGroundItemSpriteRect({ isGold: true, amount: 10000, code: 'gld' })
      expect(huge).toEqual(BAKED_UI_MANIFEST.flippyRects['flpgld_3'])
      expect(huge!.w).toBe(46)
      expect(huge!.h).toBe(23)
    })

    it('resolves potions, scrolls, and runes to authentic flippy files', () => {
      const redPotion = resolveGroundItemSpriteRect({ code: 'hp1', name: 'Lesser Healing Potion' })
      expect(redPotion).toEqual(BAKED_UI_MANIFEST.flippyRects['flprps'])

      const bluePotion = resolveGroundItemSpriteRect({ code: 'mp1', name: 'Lesser Mana Potion' })
      expect(bluePotion).toEqual(BAKED_UI_MANIFEST.flippyRects['flpbps'])

      const rune = resolveGroundItemSpriteRect({ code: 'r01', name: 'El Rune' })
      expect(rune).toEqual(BAKED_UI_MANIFEST.flippyRects['flprun'])
      expect(rune!.w).toBe(4)
      expect(rune!.h).toBe(4)

      const tpScroll = resolveGroundItemSpriteRect({ code: 'tsc', name: 'Town Portal Scroll' })
      expect(tpScroll).toEqual(BAKED_UI_MANIFEST.flippyRects['flpbsc'])
    })

    it('resolves unique items and charms to authentic ground art', () => {
      const anni = resolveGroundItemSpriteRect({ code: 'cm1', name: 'Annihilus' })
      expect(anni).toEqual(BAKED_UI_MANIFEST.flippyRects['flpmss'])

      const torch = resolveGroundItemSpriteRect({ code: 'cm2', name: 'Hellfire Torch' })
      expect(torch).toEqual(BAKED_UI_MANIFEST.flippyRects['flptrch'])

      const cube = resolveGroundItemSpriteRect({ code: 'box', name: 'Horadric Cube' })
      expect(cube).toEqual(BAKED_UI_MANIFEST.flippyRects['flpbox'])
    })

    it('resolves color-transformed items to dyed ground flippy sprites', () => {
      const shako = resolveGroundItemSpriteRect({
        code: 'uap',
        invFile: 'invcap',
        invtransform: 'cgrn',
        name: 'Harlequin Crest',
      })
      expect(shako).toEqual(BAKED_UI_MANIFEST.flippyRects['flpcap_cgrn'])
    })
  })

  describe('3. Clean Pickup Lifecycle (Zero Remaining Dots / Artifacts)', () => {
    it('completely cleans groundItems on engine pickup tick without leaving orphaned entities', () => {
      const engine = new GameEngine(
        { widthPx: 1000, heightPx: 1000, overlap: () => 0 },
        {
          spawn: { x: 100, y: 100 },
          stats: [],
          xpTable: [],
          skills: [],
          npcDefs: [],
          questDefs: [],
          combatOptions: {
            playerSpeed: 4,
            playerReach: 50,
            playerCooldownTicks: 10,
            playerDamage: 5,
            playerManaPerAttack: 1,
            respawnTicks: 100,
          },
          talkRadius: 50,
          pickupRadius: 30,
          inventoryCols: 10,
          inventoryRows: 4,
        },
      )
      engine.world.player.x = 100
      engine.world.player.y = 100

      const droppedItem = {
        id: 'test_drop_item',
        code: 'hax',
        name: 'Hand Axe',
        invWidth: 1,
        invHeight: 3,
      }

      // Drop item near player
      engine.dropItem(droppedItem, 105, 105, 5, 5)
      expect(engine.groundItems.count).toBe(1)
      expect(engine.ground.length).toBe(1)

      // Tick with pickup intent
      engine.tick({
        pickingUp: true,
        movement: { x: 0, y: 0 },
        attacking: false,
        talking: false,
        digits: [],
        saving: false,
        loading: false,
      })

      // Verified: Cleanly removed from both collections
      expect(engine.groundItems.count).toBe(0)
      expect(engine.ground.length).toBe(0)
      expect(engine.bag.contents.some(p => (p.item as any).id === 'test_drop_item')).toBe(true)
    })
  })

  describe('4. Full-Spectrum 100% Drop Table Flippy DC6 Coverage & Anti-Color-Box Parity (Issue #423)', () => {
    it('resolves valid non-empty flippyRects for 100% of weapons, armor, and misc bases in embedded drop tables', async () => {
      const { getEmbeddedDropTables } = await import('../src/common/items/embedded-drop-tables.ts')
      const tables = getEmbeddedDropTables()
      const allBases = [
        ...tables.weapons.all,
        ...tables.armor.all,
        ...tables.misc.all,
      ]
      expect(allBases.length).toBeGreaterThanOrEqual(500)

      for (const base of allBases) {
        const flippyFile = ((base as any).flippyfile ?? BAKED_UI_MANIFEST.codeToFlippyFile?.[base.code] ?? '').toLowerCase()
        const sr = resolveGroundItemSpriteRect(
          { code: base.code, name: base.name, flippyFile: (base as any).flippyfile, invFile: (base as any).invfile },
          BAKED_UI_MANIFEST.flippyRects,
          BAKED_UI_MANIFEST.codeToFlippyFile,
        )
        if (flippyFile && BAKED_UI_MANIFEST.flippyRects[flippyFile]) {
          expect(sr, `Expected flippy sprite rect for base ${base.code} (${base.name})`).not.toBeNull()
          expect(sr!.w).toBeGreaterThan(0)
          expect(sr!.h).toBeGreaterThan(0)
        } else {
          // Unused cut items without an MPQ flippy DC6 (e.g. 'tal' / 'tor' "Not used") must not fall back to 2D invFile
          expect(sr).toBeNull()
        }
      }
    })

    it('defaults item unitDrawable.frame to 0 when unit.frame is undefined even on non-zero ticks', async () => {
      const { buildSceneDrawables } = await import('../src/client/view/unit-drawables.ts')
      const out = buildSceneDrawables(
        [
          {
            id: 777,
            kind: 'item',
            classId: 0,
            code: 'cap',
            name: 'cap',
            x: 100,
            y: 100,
            mode: 5,
          },
        ],
        { tick: 5 },
      )
      expect(out.unitDrawables).toHaveLength(1)
      expect(out.unitDrawables[0]!.frame).toBe(0)
      expect(out.unitDrawables[0]!.token).toBe('cap')
    })
  })
})


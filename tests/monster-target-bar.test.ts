/**
 * tests/monster-target-bar.test.ts
 *
 * Comprehensive unit & integration tests for Diablo II 1.13c Monster Hover Lifebar
 * and 2-Line Subtext Tooltip Parity:
 * - D2Client.dll `0x6fb739e0` (`UpdateSelectedUnitOnMouseMove`), `0x6fb01a80` (`FindSelectableUnitUnderCursor`)
 * - D2Client.dll `0x6fb70850` (`DrawSelectedMonsterLifeBar`), `0x6facfdd0` (`BuildMonsterHoverSubtext`)
 * - D2Client.dll `0x6fb6fca0` (`AppendMonsterTypeAndDesc`), `0x6fb719b0` (`AppendMonsterModifiers`), `0x6fb71a20` (`AppendMonsterImmunities`)
 * - D2Win.dll `Ordinal_10070` (`DrawMonsterLifeBarBox`)
 */

import { describe, expect, it, vi } from 'vitest'
import {
  WorldPanelsHud,
  lookupMonsterTblString,
  resolveMonsterTitleAndColor,
  computeMonsterLifebarLayout,
  buildMonsterHoverSubtext,
  CANONICAL_IMMUNITY_DESCRIPTORS,
  type MonsterTargetHudInfo,
} from '../src/client/ui/world-panels.ts'
import { D2FontRenderer } from '../src/client/ui/font.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { WaypointNetwork } from '../src/common/world/portal.ts'
import { GameEngine, type GameEngineOptions, type WorldMapProvider } from '../src/server/engine/game-engine.ts'
import { rebudgetMonsterPacks } from '../src/common/world/scene-population.ts'
import {
  CANONICAL_CHAMPION_MODIFIERS,
  readMonsterKinds,
  readSuperUniques,
  monsterStatsOf,
  applyEliteModifiers,
  rollEliteModifiers,
  enrichMonsterPacks,
} from '../src/common/units/monsters-data.ts'
import { Rng } from '../src/common/rng/d2-rng.ts'
import { parseTable } from '../src/common/world/acts.ts'
import { RAW_MONSTATS, RAW_SUPERUNIQUES } from '../src/common/data/canonical-drop-data.ts'

// Headless DOM mocks for SceneMouseController testing
class MockWindow extends EventTarget {
  innerWidth = 800
  innerHeight = 600
  devicePixelRatio = 1
}

class MockCanvas extends EventTarget {
  clientWidth = 800
  clientHeight = 600
  width = 800
  height = 600
  style = { pointerEvents: 'none' }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 }
  }
  getContext() {
    return null
  }
}

class SyntheticPointerEvent extends Event {
  readonly clientX: number
  readonly clientY: number
  readonly button: number
  readonly buttons: number
  readonly shiftKey: boolean

  constructor(
    type: string,
    init: { clientX: number; clientY: number; button?: number; buttons?: number; shiftKey?: boolean },
  ) {
    super(type, { cancelable: true })
    this.clientX = init.clientX
    this.clientY = init.clientY
    this.button = init.button ?? 0
    this.buttons = init.buttons !== undefined ? init.buttons : 1 << (init.button ?? 0)
    this.shiftKey = init.shiftKey ?? false
  }
}

if (typeof globalThis.window === 'undefined') {
  // @ts-ignore
  globalThis.window = new MockWindow()
}
if (typeof globalThis.HTMLInputElement === 'undefined') {
  // @ts-ignore
  globalThis.HTMLInputElement = class HTMLInputElement {}
}
if (typeof globalThis.HTMLSelectElement === 'undefined') {
  // @ts-ignore
  globalThis.HTMLSelectElement = class HTMLSelectElement {}
}

function createMockFont(charWidth = 8): D2FontRenderer & {
  calls: Array<{ text: string; x: number; y: number; opts?: any }>
} {
  const calls: Array<{ text: string; x: number; y: number; opts?: any }> = []
  return {
    calls,
    measureText: vi.fn((text: string) => text.length * charWidth),
    drawText: vi.fn((_ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts?: any) => {
      calls.push({ text, x, y, opts })
    }),
  } as unknown as D2FontRenderer & {
    calls: Array<{ text: string; x: number; y: number; opts?: any }>
  }
}

describe('Diablo II 1.13c Monster Lifebar & 2-Line Subtext Tooltip Parity', () => {
  describe('R1: Canonical .tbl Strings & MonStats.txt Metadata Pipeline', () => {
    it('packs required MonStats.txt columns and resolves canonical ENG & CHI .tbl strings', () => {
      const monstatsTable = parseTable(new TextEncoder().encode(RAW_MONSTATS))
      expect(monstatsTable.header).toContain('DescStr')
      expect(monstatsTable.header).toContain('lUndead')
      expect(monstatsTable.header).toContain('hUndead')
      expect(monstatsTable.header).toContain('demon')
      expect(monstatsTable.header).toContain('killable')
      expect(monstatsTable.header).toContain('inTown')
      expect(monstatsTable.header).toContain('ResDm')
      expect(monstatsTable.header).toContain('ResCo(H)')

      // Base monster names
      expect(lookupMonsterTblString('Fallen', 'en')).toBe('Fallen')
      expect(lookupMonsterTblString('Fallen', 'zh')).toBe('沈淪魔')
      expect(lookupMonsterTblString('Zombie', 'en')).toBe('Zombie')
      expect(lookupMonsterTblString('Zombie', 'zh')).toBe('僵屍')

      // SuperUniques
      expect(lookupMonsterTblString('Bishibosh', 'en')).toBe('Bishibosh')
      expect(lookupMonsterTblString('Bishibosh', 'zh')).toBe('畢須博須')
      expect(lookupMonsterTblString('Corpsefire', 'en')).toBe('Corpsefire')
      expect(lookupMonsterTblString('Corpsefire', 'zh')).toBe('屍體發火')

      // Base type & rank affixes
      expect(lookupMonsterTblString('DemonID', 'en')).toBe('Demon')
      expect(lookupMonsterTblString('DemonID', 'zh')).toBe('惡魔')
      expect(lookupMonsterTblString('UndeadDescriptX', 'en')).toBe('Undead')
      expect(lookupMonsterTblString('UndeadDescriptX', 'zh')).toBe('不死的')
      expect(lookupMonsterTblString('Champion', 'en')).toBe('Champion')
      expect(lookupMonsterTblString('Champion', 'zh')).toBe('頭目')
      expect(lookupMonsterTblString('minion', 'en')).toBe('Minion')
      expect(lookupMonsterTblString('minion', 'zh')).toBe('嘍囉')

      // Elite modifiers (3205..3218)
      expect(lookupMonsterTblString('uniquextrastrong', 'en')).toBe('Extra Strong')
      expect(lookupMonsterTblString('uniquextrastrong', 'zh')).toBe('特別強壯')
      expect(lookupMonsterTblString('uniqueextrafast', 'en')).toBe('Extra Fast')
      expect(lookupMonsterTblString('uniqueextrafast', 'zh')).toBe('特別快速')
      expect(lookupMonsterTblString('uniquecursed', 'en')).toBe('Cursed')
      expect(lookupMonsterTblString('uniquecursed', 'zh')).toBe('特別詛咒')
      expect(lookupMonsterTblString('monsteruniqueprop6', 'en')).toBe('Stone Skin')
      expect(lookupMonsterTblString('monsteruniqueprop6', 'zh')).toBe('皮膚硬化')

      // Immunity strings (10990..10995)
      expect(lookupMonsterTblString('strScaryMonDesc1', 'en')).toBe('Immune to Fire')
      expect(lookupMonsterTblString('strScaryMonDesc1', 'zh')).toBe('火焰系無效')
      expect(lookupMonsterTblString('strScaryMonDesc2', 'en')).toBe('Immune to Cold')
      expect(lookupMonsterTblString('strScaryMonDesc2', 'zh')).toBe('冰冷系無效')
      expect(lookupMonsterTblString('strScaryMonDesc3', 'en')).toBe('Immune to Lightning')
      expect(lookupMonsterTblString('strScaryMonDesc3', 'zh')).toBe('閃電系無效')
      expect(lookupMonsterTblString('strScaryMonDesc4', 'en')).toBe('Immune to Poison')
      expect(lookupMonsterTblString('strScaryMonDesc4', 'zh')).toBe('毒素系無效')
      expect(lookupMonsterTblString('strScaryMonDesc5', 'en')).toBe('Immune to Physical')
      expect(lookupMonsterTblString('strScaryMonDesc5', 'zh')).toBe('實體攻擊無效')
      expect(lookupMonsterTblString('strScaryMonDesc6', 'en')).toBe('Immune to Magic')
      expect(lookupMonsterTblString('strScaryMonDesc6', 'zh')).toBe('魔法系無效')
    })

    it('populates descKey, isUndead, isDemon, isBoss, killable, inTown, and resistances in readMonsterKinds and enrichMonsterPacks', () => {
      const kinds = readMonsterKinds(parseTable(new TextEncoder().encode(RAW_MONSTATS)), 'hell')
      const superUniquesList = readSuperUniques(parseTable(new TextEncoder().encode(RAW_SUPERUNIQUES)), 'hell')
      const superUniques = new Map(superUniquesList.map(s => [s.id.toLowerCase(), s]))

      const fallen = kinds.get('fallen1')!
      const zombie = kinds.get('zombie1')!
      const quillRat = kinds.get('quillrat1')!
      const fallenShaman = kinds.get('fallenshaman1')!
      const andariel = kinds.get('andariel')!

      expect(fallen.isDemon).toBe(true)
      expect(fallen.isUndead).toBe(false)
      expect(fallen.resistances.fire).toBeGreaterThanOrEqual(100) // Hell Fallen is Fire Immune

      expect(zombie.isUndead).toBe(true)
      expect(zombie.isDemon).toBe(false)

      expect(quillRat.isUndead).toBe(false)
      expect(quillRat.isDemon).toBe(false)

      expect(fallenShaman.descKey).toBe('raises Fallen')
      expect(andariel.isBoss).toBe(true)

      const stats = monsterStatsOf(fallen, new Rng(123), 4)
      expect(stats.nameKey).toBe('Fallen')
      expect(stats.isDemon).toBe(true)
      expect(stats.isUndead).toBe(false)
      expect(stats.resistances?.fire).toBeGreaterThanOrEqual(100)

      // Verify enrichMonsterPacks enriches pre-baked pack stats with MonStats & SuperUniques metadata
      const rawPacks = [
        {
          kindId: 'fallenshaman1',
          rank: 'unique' as const,
          superUniqueId: 'Bishibosh',
          members: [
            {
              id: 'fallenshaman1',
              name: 'Bishibosh',
              rank: 'unique' as const,
              hp: 120,
              damage: 10,
              cooldownTicks: 25,
              reach: 24,
              aggroRadius: 100,
              speed: 4,
              xp: 90,
            },
          ],
        },
      ]
      const enriched = enrichMonsterPacks(rawPacks, kinds, superUniques)
      expect(enriched[0]!.members[0]!.nameKey).toBe('Bishibosh')
      expect(enriched[0]!.members[0]!.descKey).toBe('raises Fallen')
      expect(enriched[0]!.members[0]!.isDemon).toBe(true)
      expect(enriched[0]!.members[0]!.isUndead).toBe(false)
    })
  })

  describe('R3: Authentic 1.13c Lifebar Plaque Layout, Title, and 2-Line Subtext', () => {
    it('computes 1.13c panel-aware lifebar layout and [2, 128] HP fill clamping (0x6fb70850 & Ordinal_10070)', () => {
      // Short name ("  Fallen  " = 10 chars * 8 = 80px -> clamped to min width 128)
      const layoutClosed = computeMonsterLifebarLayout(800, false, false, 80, 100, 100)
      expect(layoutClosed.visible).toBe(true)
      expect(layoutClosed.centerX).toBe(400)
      expect(layoutClosed.barWidth).toBe(128)
      expect(layoutClosed.left).toBe(400 - 64)
      expect(layoutClosed.y).toBe(32)
      expect(layoutClosed.top).toBe(19)
      expect(layoutClosed.bottom).toBe(36)
      expect(layoutClosed.barHeight).toBe(17) // 16 + 1 inclusive
      expect(layoutClosed.fillRatio128).toBe(128)
      expect(layoutClosed.fillWidth).toBe(128)

      // Long name (textWidth = 264px > 128)
      const layoutLong = computeMonsterLifebarLayout(800, false, false, 264, 50, 100)
      expect(layoutLong.barWidth).toBe(264)
      expect(layoutLong.left).toBe(400 - 132)
      expect(layoutLong.fillRatio128).toBe(64)
      expect(layoutLong.fillWidth).toBe(132)

      // Sliver of HP (1 / 10000) -> fillRatio128 clamped to minimum 2 per 0x6fb7092f
      const layoutSliver = computeMonsterLifebarLayout(800, false, false, 80, 1, 10000)
      expect(layoutSliver.fillRatio128).toBe(2)
      expect(layoutSliver.fillWidth).toBe(2)

      // Dead (0 / 100) -> visible = false, fillRatio128 = 0
      const layoutDead = computeMonsterLifebarLayout(800, false, false, 80, 0, 100)
      expect(layoutDead.visible).toBe(false)
      expect(layoutDead.fillRatio128).toBe(0)
      expect(layoutDead.fillWidth).toBe(0)

      // Left panel open, right closed -> shifts right by +200 to centerX = 600
      const layoutLeftOpen = computeMonsterLifebarLayout(800, true, false, 80, 100, 100)
      expect(layoutLeftOpen.visible).toBe(true)
      expect(layoutLeftOpen.centerX).toBe(600)

      // Right panel open, left closed -> shifts left by -200 to centerX = 200
      const layoutRightOpen = computeMonsterLifebarLayout(800, false, true, 80, 100, 100)
      expect(layoutRightOpen.visible).toBe(true)
      expect(layoutRightOpen.centerX).toBe(200)

      // Both panels open -> hidden
      const layoutBothOpen = computeMonsterLifebarLayout(800, true, true, 80, 100, 100)
      expect(layoutBothOpen.visible).toBe(false)
    })

    it('resolves monster title and color across Normal, Champion, Unique, Minion, and Boss ranks in ENG and CHI', () => {
      // Normal
      const normalEn = resolveMonsterTitleAndColor(
        { name: 'Fallen', nameKey: 'Fallen', hp: 10, maxHp: 10, rank: 'normal' },
        'en',
      )
      expect(normalEn).toEqual({
        displayName: 'Fallen',
        paddedTitle: '  Fallen  ',
        titleColor: 'white',
      })
      const normalZh = resolveMonsterTitleAndColor(
        { name: 'Fallen', nameKey: 'Fallen', hp: 10, maxHp: 10, rank: 'normal' },
        'zh',
      )
      expect(normalZh).toEqual({
        displayName: '沈淪魔',
        paddedTitle: '  沈淪魔  ',
        titleColor: 'white',
      })

      // Champion
      const champEn = resolveMonsterTitleAndColor(
        { name: 'Fallen', nameKey: 'Fallen', hp: 20, maxHp: 20, rank: 'champion' },
        'en',
      )
      expect(champEn).toEqual({
        displayName: 'Champion Fallen',
        paddedTitle: '  Champion Fallen  ',
        titleColor: 'blue',
      })
      const champZh = resolveMonsterTitleAndColor(
        { name: 'Fallen', nameKey: 'Fallen', hp: 20, maxHp: 20, rank: 'champion' },
        'zh',
      )
      expect(champZh).toEqual({
        displayName: '頭目 沈淪魔',
        paddedTitle: '  頭目 沈淪魔  ',
        titleColor: 'blue',
      })

      // SuperUnique / Unique
      const uniqueEn = resolveMonsterTitleAndColor(
        { name: 'Bishibosh', nameKey: 'Bishibosh', hp: 100, maxHp: 100, rank: 'unique' },
        'en',
      )
      expect(uniqueEn).toEqual({
        displayName: 'Bishibosh',
        paddedTitle: '  Bishibosh  ',
        titleColor: 'gold',
      })
      const uniqueZh = resolveMonsterTitleAndColor(
        { name: 'Bishibosh', nameKey: 'Bishibosh', hp: 100, maxHp: 100, rank: 'unique' },
        'zh',
      )
      expect(uniqueZh).toEqual({
        displayName: '畢須博須',
        paddedTitle: '  畢須博須  ',
        titleColor: 'gold',
      })

      // Minion (title is white base name, subtext line 1 carries Minion / 僕人)
      const minionEn = resolveMonsterTitleAndColor(
        { name: 'Fallen', nameKey: 'Fallen', hp: 15, maxHp: 15, rank: 'minion' },
        'en',
      )
      expect(minionEn).toEqual({
        displayName: 'Fallen',
        paddedTitle: '  Fallen  ',
        titleColor: 'white',
      })

      // Act Boss
      const bossZh = resolveMonsterTitleAndColor(
        { name: 'Andariel', nameKey: 'Andariel', hp: 500, maxHp: 500, rank: 'boss', isBoss: true },
        'zh',
      )
      expect(bossZh).toEqual({
        displayName: '安達利爾',
        paddedTitle: '  安達利爾  ',
        titleColor: 'gold',
      })
    })

    it('builds 2-line subtext (0x6facfdd0): Undead/Demon/Animal, DescStr, Unique Modifiers, and 6-element Immunities with line promotion', () => {
      // 1. Undead Unique with DescStr ('raises Fallen'), 2 modifiers, and Cold + Poison immunities
      const undeadUnique: MonsterTargetHudInfo = {
        name: 'Corpsefire',
        nameKey: 'Corpsefire',
        descKey: 'raises Fallen',
        hp: 100,
        maxHp: 100,
        rank: 'unique',
        isUndead: true,
        isDemon: false,
        modifiers: ['strong', 'spectralhit'],
        resistances: {
          cold: 100,
          fire: 50,
          lightning: 0,
          poison: 120,
          physical: 99,
          magic: 0,
        },
      }
      const subEn = buildMonsterHoverSubtext(undeadUnique, 'en')
      expect(subEn.line1).toBe('Undead  Extra Strong  Spectral Hit  Raises Fallen')
      expect(subEn.line1Y).toBe(55)
      expect(subEn.line2).toBe('Immune to Cold, Immune to Poison')
      expect(subEn.line2Y).toBe(69)

      const subZh = buildMonsterHoverSubtext(undeadUnique, 'zh')
      expect(subZh.line1).toBe('不死的  特別強壯  幽靈一擊  復甦的沉淪魔')
      expect(subZh.line2).toBe('冰冷系無效, 毒素系無效')

      // 2. Animal/Beast (neither Undead nor Demon, no DescStr, normal rank) -> empty subtext when no immunities
      const quillRat: MonsterTargetHudInfo = {
        name: 'Quill Rat',
        nameKey: 'QuillRat',
        descKey: '',
        hp: 10,
        maxHp: 10,
        rank: 'normal',
        isUndead: false,
        isDemon: false,
        modifiers: [],
        resistances: { cold: 0, fire: 0, lightning: 0, poison: 0, physical: 0, magic: 0 },
      }
      const emptySub = buildMonsterHoverSubtext(quillRat, 'en')
      expect(emptySub.line1).toBe('')
      expect(emptySub.line2).toBe('')

      // 3. Animal/Beast with Physical + Magic immunity: Line 1 is empty, so Line 2 renders at y = 55 per 0x6fb70850!
      const immuneBeast: MonsterTargetHudInfo = {
        ...quillRat,
        resistances: { cold: 0, fire: 0, lightning: 0, poison: 0, physical: 100, magic: 100 },
      }
      const promotedEn = buildMonsterHoverSubtext(immuneBeast, 'en')
      expect(promotedEn.line1).toBe('')
      expect(promotedEn.line2).toBe('Immune to Physical, Immune to Magic')
      expect(promotedEn.line2Y).toBe(55)

      // 4. Verify all 6 immunity descriptors in canonical 1.13c .rdata:0x6FB834EC order
      expect(CANONICAL_IMMUNITY_DESCRIPTORS.map(d => d.key)).toEqual([
        'physical',
        'magic',
        'fire',
        'lightning',
        'cold',
        'poison',
      ])
    })

    it('renders plaque backdrop at top=19 (h=17), title at y=32, line 1 at y=55, and line 2 at y=69 in WorldPanelsHud.drawMonsterTargetBar', () => {
      const hud = new WorldPanelsHud()
      const font = createMockFont(8)
      const fillRectCalls: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> = []

      const ctx = {
        fillStyle: '',
        fillRect: vi.fn(function (this: any, x: number, y: number, w: number, h: number) {
          fillRectCalls.push({ x, y, w, h, fillStyle: this.fillStyle })
        }),
      } as unknown as CanvasRenderingContext2D

      const target: MonsterTargetHudInfo = {
        name: 'Bishibosh',
        nameKey: 'Bishibosh',
        descKey: 'FallenShamanDesc',
        hp: 50,
        maxHp: 100,
        rank: 'unique',
        isDemon: true,
        isUndead: false,
        modifiers: ['fireenchant', 'magicresistant'],
        resistances: { fire: 100, cold: 0, lightning: 0, poison: 0, physical: 0, magic: 75 },
      }

      hud.drawMonsterTargetBar(ctx, target, font, {
        leftPanelOpen: false,
        rightPanelOpen: false,
        canvasWidth: 800,
        locale: 'en',
      })

      // Two fillRect calls: dark backdrop (w=128, h=17 at top=19) and crimson HP fill (w=64, h=17 at top=19)
      expect(fillRectCalls).toHaveLength(2)
      expect(fillRectCalls[0]).toEqual({
        x: 400 - 64,
        y: 19,
        w: 128,
        h: 17,
        fillStyle: 'rgba(0, 0, 0, 0.72)',
      })
      expect(fillRectCalls[1]).toEqual({
        x: 400 - 64,
        y: 19,
        w: 64,
        h: 17,
        fillStyle: 'rgba(156, 20, 20, 0.88)',
      })

      // Three drawText calls: title at y=32, line 1 at y=55, line 2 at y=69
      expect(font.calls).toHaveLength(3)
      expect(font.calls[0]!.y).toBe(32)
      expect(font.calls[0]!.opts?.color).toBe('gold')
      expect(font.calls[1]!.y).toBe(55)
      expect(font.calls[1]!.opts?.font).toBe('font6')
      expect(font.calls[2]!.y).toBe(69)
      expect(font.calls[2]!.opts?.font).toBe('font6')
    })
  })

  describe('R2: Authentic Mouse Hover Hit-Testing & Target Clearing in SceneMouseController', () => {

    it('filters "dummy" DescStr (0x6fb70c0b) and resolves wMonUModStrTable[24] ("thief") plus short/numeric MonUMod keys', () => {
      const dummyMonster: MonsterTargetHudInfo = {
        name: 'Skeleton',
        nameKey: 'Skeleton',
        descKey: 'dummy',
        subType: 'Dummy',
        hp: 30,
        maxHp: 30,
        rank: 'normal',
        isUndead: true,
        isDemon: false,
      }
      const dummySub = buildMonsterHoverSubtext(dummyMonster, 'en')
      expect(dummySub.line1).toBe('Undead')
      expect(dummySub.line1Colored).toBe('Undead')

      const thiefUnique: MonsterTargetHudInfo = {
        name: 'Bone Ash',
        nameKey: 'Bone Ash',
        descKey: 'dummy',
        hp: 150,
        maxHp: 150,
        rank: 'unique',
        isUndead: true,
        modifiers: ['thief', 'curse', 'resist', '18'],
      }
      const thiefEn = buildMonsterHoverSubtext(thiefUnique, 'en')
      expect(thiefEn.line1).toBe('Undead  Thief  Cursed  Magic Resistant  Cold Enchanted')
      const thiefZh = buildMonsterHoverSubtext(thiefUnique, 'zh')
      expect(thiefZh.line1).toBe('不死的  小偷  特別詛咒  魔法抵抗  冰冷強化')
    })

    it('wraps multi-immunity Line 2 and clamps long modifier Line 1 within the open half-viewport when a side panel is open', () => {
      const hud = new WorldPanelsHud()
      const font = createMockFont(8)
      const ctx = {
        fillStyle: '',
        fillRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D

      const sixImmuneBoss: MonsterTargetHudInfo = {
        name: 'Uber Boss',
        nameKey: 'Diablo',
        hp: 500,
        maxHp: 500,
        rank: 'unique',
        isDemon: true,
        modifiers: ['strong', 'fast', 'cursed', 'magicresistant', 'fireenchant', 'lightenchant', 'coldenchant', 'stoneskin'],
        resistances: {
          physical: 100,
          magic: 100,
          fire: 100,
          lightning: 100,
          cold: 100,
          poison: 100,
        },
      }

      hud.drawMonsterTargetBar(ctx, sixImmuneBoss, font, {
        leftPanelOpen: true,
        rightPanelOpen: false,
        canvasWidth: 800,
        locale: 'en',
      })

      // Active viewport is [400, 800] (width 400, maxSubtextWidth = 392)
      // Title at y=32, clamped Line 1 at y=55, wrapped Line 2 across y=69, 83, 97
      const line1Call = font.calls.find(c => c.y === 55)
      expect(line1Call).toBeDefined()
      const plainLine1 = line1Call!.text.replace(/ÿc[0-9a-z]/g, '')
      expect(font.measureText(plainLine1, 'font6')).toBeLessThanOrEqual(392)

      const immunityCalls = font.calls.filter(c => c.y >= 69)
      expect(immunityCalls.length).toBeGreaterThanOrEqual(2)
      expect(immunityCalls[0]!.y).toBe(69)
      expect(immunityCalls[1]!.y).toBe(83)
      for (const call of immunityCalls) {
        const plain = call.text.replace(/ÿc[0-9a-z]/g, '')
        expect(font.measureText(plain, 'font6')).toBeLessThanOrEqual(392)
      }
    })

    it('renders entire Subtext Line 1 (including Race and race-only Champions/Bosses) in rank color per 0x6fb719b0 and 0x6fb71a20', () => {
      // 1. Unique Undead with modifiers + DescStr -> entire line1Colored starts with ÿc4 (gold)
      const uniqueUndead = buildMonsterHoverSubtext(
        {
          name: 'Corpsefire',
          nameKey: 'Corpsefire',
          descKey: 'raises Fallen',
          hp: 100,
          maxHp: 100,
          rank: 'unique',
          isUndead: true,
          modifiers: ['strong', 'spectralhit'],
        },
        'en',
      )
      expect(uniqueUndead.line1).toBe('Undead  Extra Strong  Spectral Hit  Raises Fallen')
      expect(uniqueUndead.line1Colored).toBe('ÿc4Undead  Extra Strong  Spectral Hit  Raises Fallen')

      // 2. Champion Demon without DescStr -> line1Colored is blue ('ÿc3Demon'), not white
      const champFallen = buildMonsterHoverSubtext(
        {
          name: 'Fallen',
          nameKey: 'Fallen',
          descKey: 'dummy',
          hp: 60,
          maxHp: 60,
          rank: 'champion',
          isDemon: true,
        },
        'en',
      )
      expect(champFallen.line1).toBe('Demon')
      expect(champFallen.line1Colored).toBe('ÿc3Demon')

      // 3. Champion Demon with DescStr -> entire line1Colored is blue ('ÿc3Demon  Raises Fallen')
      const champShaman = buildMonsterHoverSubtext(
        {
          name: 'Fallen Shaman',
          nameKey: 'FallenShaman',
          descKey: 'raises Fallen',
          hp: 90,
          maxHp: 90,
          rank: 'champion',
          isDemon: true,
        },
        'en',
      )
      expect(champShaman.line1).toBe('Demon  Raises Fallen')
      expect(champShaman.line1Colored).toBe('ÿc3Demon  Raises Fallen')

      // 4. Act Boss (Andariel, descKey = 'dummy') -> line1Colored is gold ('ÿc4Demon')
      const andarielSub = buildMonsterHoverSubtext(
        {
          name: 'Andariel',
          nameKey: 'Andariel',
          descKey: 'dummy',
          hp: 500,
          maxHp: 500,
          rank: 'boss',
          isBoss: true,
          isDemon: true,
        },
        'en',
      )
      expect(andarielSub.line1).toBe('Demon')
      expect(andarielSub.line1Colored).toBe('ÿc4Demon')

      // 5. Minion Demon -> line1Colored is white ('Demon  Minion')
      const minionSub = buildMonsterHoverSubtext(
        {
          name: 'Fallen',
          nameKey: 'Fallen',
          hp: 30,
          maxHp: 30,
          rank: 'minion',
          isDemon: true,
        },
        'en',
      )
      expect(minionSub.line1).toBe('Demon  Minion')
      expect(minionSub.line1Colored).toBe('Demon  Minion')
    })

    it('resolves Champion subtype prefixes from numeric MonUMod IDs (16, 36..39), case-variants, and affixes fallback (.rdata:0x6fb86d64)', () => {
      expect(
        resolveMonsterTitleAndColor(
          { name: 'Fallen', nameKey: 'Fallen', hp: 50, maxHp: 50, rank: 'champion', modifiers: ['16'] },
          'en',
        ).displayName,
      ).toBe('Champion Fallen')

      expect(
        resolveMonsterTitleAndColor(
          { name: 'Fallen', nameKey: 'Fallen', hp: 50, maxHp: 50, rank: 'champion', modifiers: ['36'] },
          'en',
        ).displayName,
      ).toBe('Ghostly Fallen')

      expect(
        resolveMonsterTitleAndColor(
          { name: 'Fallen', nameKey: 'Fallen', hp: 50, maxHp: 50, rank: 'champion', modifiers: ['37'] },
          'zh',
        ).displayName,
      ).toBe(`${lookupMonsterTblString('champfanaticX', 'zh')} 沈淪魔`)

      expect(
        resolveMonsterTitleAndColor(
          { name: 'Fallen', nameKey: 'Fallen', hp: 50, maxHp: 50, rank: 'champion', modifiers: ['38'] },
          'en',
        ).displayName,
      ).toBe('Possessed Fallen')

      expect(
        resolveMonsterTitleAndColor(
          { name: 'Fallen', nameKey: 'Fallen', hp: 50, maxHp: 50, rank: 'champion', affixes: ['39'] },
          'en',
        ).displayName,
      ).toBe('Berserker Fallen')

      expect(
        resolveMonsterTitleAndColor(
          { name: 'Fallen', nameKey: 'Fallen', hp: 50, maxHp: 50, rank: 'champion', affixes: ['Berserker'] },
          'zh',
        ).displayName,
      ).toBe(`${lookupMonsterTblString('champberserkX', 'zh')} 沈淪魔`)
    })

    it('demotes already-elite packs before promoting when rebudgetMonsterPacks is called with eliteMultiplier="all"', () => {
      const normalBaseHp = 30
      const alreadyChampionPack = {
        members: [
          {
            id: 'fallen1',
            name: 'Fallen',
            level: 3, // base level 1 + 2 champion bonus
            hp: normalBaseHp * 3, // 90 (already 3x champion HP)
            damage: 5,
            cooldownTicks: 15,
            reach: 48,
            aggroRadius: 200,
            speed: 6,
            xp: 25,
            rank: 'champion' as const,
            modifiers: ['ghostly'],
          },
        ],
      }

      const rebudgeted = rebudgetMonsterPacks([alreadyChampionPack], {
        levelId: 2,
        densityMultiplier: 1,
        eliteMultiplier: 'all',
        seed: 777,
      })
      expect(rebudgeted).toHaveLength(1)
      const leader = rebudgeted[0]!.members[0]!
      // Leader HP must be 3x (90) or 4x (120) of normalBaseHp (30), never 9x (270) or 12x (360)!
      expect(leader.hp === normalBaseHp * 3 || leader.hp === normalBaseHp * 4).toBe(true)
      // Leader level must be base 1 + 2 (3) or base 1 + 3 (4), never +4 or +5!
      expect(leader.level === 3 || leader.level === 4).toBe(true)
    })
  })

  it('applies 1.13c MonUMod elemental/physical/magic resistance bonuses in applyEliteModifiers and enrichMonsterPacks so Bishibosh and Frozenstein display immunities on Line 2 (D2Game.dll 0x6fc41be0)', () => {
    const kinds = readMonsterKinds(parseTable(new TextEncoder().encode(RAW_MONSTATS)), 'normal')
    const superUniquesList = readSuperUniques(parseTable(new TextEncoder().encode(RAW_SUPERUNIQUES)), 'normal')
    const superUniques = new Map(superUniquesList.map(s => [s.id.toLowerCase(), s]))

    // 1. Pre-baked Cold Plains Bishibosh (fallenshaman1: base fire=25 + magicresistant(+40) + fireenchant(+75) = 140 >= 100)
    const bishiboshPack = enrichMonsterPacks(
      [
        {
          superUniqueId: 'Bishibosh',
          members: [
            {
              id: 'fallenshaman1',
              name: 'Bishibosh',
              hp: 43,
              damage: 2,
              cooldownTicks: 25,
              reach: 40,
              aggroRadius: 560,
              speed: 113,
              xp: 32,
              level: 5,
              rank: 'unique',
              resistances: { physical: 0, magic: 0, fire: 25, lightning: 20, cold: 0, poison: 0 },
              resists: { physical: 0, magic: 0, fire: 25, lightning: 20, cold: 0, poison: 0 },
              modifiers: ['magicresistant', 'fireenchant'],
              superUniqueId: 'Bishibosh',
            },
          ],
        },
      ],
      kinds,
      superUniques,
    )
    const bishiboshStats = bishiboshPack[0]!.members[0]!
    expect(bishiboshStats.resistances?.fire).toBe(140)
    expect(bishiboshStats.resistances?.cold).toBe(40)
    expect(bishiboshStats.resistances?.lightning).toBe(20)

    const bishiboshHud = ({ ...bishiboshStats, hp: 43, maxHp: bishiboshStats.hp, rank: 'unique' }) as MonsterTargetHudInfo
    const bishiboshSubEn = buildMonsterHoverSubtext(bishiboshHud, 'en')
    expect(bishiboshSubEn.line1).toBe('Demon  Magic Resistant  Fire Enchanted  Raises Fallen')
    expect(bishiboshSubEn.line2).toBe('Immune to Fire')
    expect(bishiboshSubEn.line2Colored).toBe('ÿc1Immune to Fire')

    const bishiboshSubZh = buildMonsterHoverSubtext(bishiboshHud, 'zh')
    expect(bishiboshSubZh.line2).toBe(lookupMonsterTblString('strScaryMonDesc1', 'zh'))
    expect(bishiboshSubZh.line2Colored).toBe(`ÿc1${lookupMonsterTblString('strScaryMonDesc1', 'zh')}`)

    // 2. Pre-baked Frozenstein (snowyeti4: base cold=75 + coldenchant(+75) = 150 >= 100, manahit(+20 magic))
    const frozensteinPack = enrichMonsterPacks(
      [
        {
          superUniqueId: 'Frozenstein',
          members: [
            {
              id: 'snowyeti4',
              name: 'Frozenstein',
              hp: 300,
              damage: 25,
              cooldownTicks: 25,
              reach: 40,
              aggroRadius: 560,
              speed: 120,
              xp: 200,
              level: 40,
              rank: 'unique',
              resistances: { physical: 0, magic: 0, fire: 0, lightning: 0, cold: 75, poison: 0 },
              modifiers: ['coldenchant', 'manahit'],
              superUniqueId: 'Frozenstein',
            },
          ],
        },
      ],
      kinds,
      superUniques,
    )
    const frozensteinStats = frozensteinPack[0]!.members[0]!
    expect(frozensteinStats.resistances?.cold).toBe(150)
    expect(frozensteinStats.resistances?.magic).toBe(20)

    // 3. applyEliteModifiers directly for stoneskin (+50 physical), spectralhit (+20 fire/cold/ltng), poisonenchant (+75 poison)
    const baseStats = monsterStatsOf(kinds.get('fallen1')!, new Rng(1), 4)
    const modded = applyEliteModifiers(baseStats, 'unique', ['stoneskin', 'spectralhit', 'poisonenchant'])
    expect(modded.resistances?.physical).toBe(50)
    expect(modded.resistances?.fire).toBe(20)
    expect(modded.resistances?.cold).toBe(20)
    expect(modded.resistances?.lightning).toBe(20)
    expect(modded.resistances?.poison).toBe(75)
  })

  it('maps online ClientUnit snapshots via clientUnitToMonsterTargetInfo with 1.13c nameKey, descKey, race, rank, modifiers, and immunities', async () => {
    const { ClientUnit } = await import('../src/client/world/client-unit.ts')
    const { clientUnitToMonsterTargetInfo } = await import('../src/client/ui-model/hud-model.ts')

    // 1. Normal Skeleton (hcIdx = 0, Skeleton1): Undead
    const skelUnit = new ClientUnit({
      unitType: 1,
      id: 101,
      classId: 0,
      x: 5000,
      y: 5000,
      lifePct: 128,
    })
    const skelInfo = clientUnitToMonsterTargetInfo(skelUnit, 0)
    expect(skelInfo.name).toBe('Skeleton')
    expect(skelInfo.nameKey).toBe('Skeleton')
    expect(skelInfo.rank).toBe('normal')
    expect(skelInfo.isUndead).toBe(true)
    expect(buildMonsterHoverSubtext(skelInfo, 'en').line1).toBe('Undead')
    expect(buildMonsterHoverSubtext(skelInfo, 'zh').line1).toBe('不死的')

    // 2. SuperUnique Bishibosh (hcIdx = 58 fallenshaman1, superUniqueId = 0, bossMods = [8, 9, 22])
    // Note: 22 (questcomplete) is an internal MonUMod with wMonUModStrTable[22] == 0 (D2Client.dll 0x6fb6fca0)
    // and must be suppressed from modifiers/affixes and never appear as "22" on subtext line 1.
    const bishUnit = new ClientUnit({
      unitType: 1,
      id: 102,
      classId: 58,
      x: 5010,
      y: 5010,
      lifePct: 100,
      flags: 0x0a,
      isUnique: true,
      isSuperUnique: true,
      superUniqueId: 0,
      bossMods: [8, 9, 22, 15],
    })
    const bishInfo = clientUnitToMonsterTargetInfo(bishUnit, 0)
    expect(bishInfo.name).toBe('Bishibosh')
    expect(bishInfo.nameKey).toBe('Bishibosh')
    expect(bishInfo.rank).toBe('superunique')
    expect(bishInfo.isDemon).toBe(true)
    expect(bishInfo.modifiers).toEqual(['magicresistant', 'fireenchant'])
    expect(bishInfo.affixes).toEqual(['Magic Resistant', 'Fire Enchanted'])
    expect(resolveMonsterTitleAndColor(bishInfo, 'en').titleColor).toBe('gold')
    expect(resolveMonsterTitleAndColor(bishInfo, 'zh').displayName).toBe('畢須博須')
    const bishSubEn = buildMonsterHoverSubtext(bishInfo, 'en')
    expect(bishSubEn.line1).toBe('Demon  Magic Resistant  Fire Enchanted  Raises Fallen')
    expect(bishSubEn.line2).toBe('Immune to Fire')
    // Direct buildMonsterHoverSubtext call with raw internal MonUMod IDs ('22', 'questcomplete', '12')
    expect(
      buildMonsterHoverSubtext(
        {
          ...bishInfo,
          modifiers: ['8', '22', 'questcomplete', '9', '12', 'Mod #22'],
        },
        'en',
      ).line1,
    ).toBe('Demon  Magic Resistant  Fire Enchanted  Raises Fallen')

    // 3. Authentic 1.13c Champion packs (D2Game.dll 0x6fc6ffb9 sets 0x08 MONFLAG_UNIQUE alongside
    // 0x04 MONFLAG_CHAMPION and sends 16-bit nameSeed in 0xAC AssignNPC; D2Client.dll 0x6fad0758
    // & 0x6fb70aa1 prioritize 0x04 over 0x08 across all 5 subtypes: 16, 36..39).
    const champCases: ReadonlyArray<{
      readonly modId: number
      readonly flags: number
      readonly expectedEn: string
      readonly expectedZh: string
    }> = [
      { modId: 16, flags: 0x0c, expectedEn: 'Champion Fallen', expectedZh: '頭目 沈淪魔' },
      { modId: 36, flags: 0x4c, expectedEn: 'Ghostly Fallen', expectedZh: '幽靈的 沈淪魔' },
      { modId: 37, flags: 0x0c, expectedEn: 'Fanatic Fallen', expectedZh: '狂信者 沈淪魔' },
      { modId: 38, flags: 0x0c, expectedEn: 'Possessed Fallen', expectedZh: '著魔者 沈淪魔' },
      { modId: 39, flags: 0x0c, expectedEn: 'Berserker Fallen', expectedZh: '狂戰士 沈淪魔' },
    ]
    for (const tc of champCases) {
      const champUnit = new ClientUnit({
        unitType: 1,
        id: 103 + tc.modId,
        classId: 19,
        x: 5020,
        y: 5020,
        lifePct: 128,
        flags: tc.flags,
        isChampion: true,
        isUnique: true,
        nameSeed: 0x1234,
        bossMods: [tc.modId],
      })
      const champInfo = clientUnitToMonsterTargetInfo(champUnit, 0)
      expect(champInfo.rank).toBe('champion')
      expect(champInfo.name).toBe(tc.expectedEn)
      expect(champInfo.nameKey).toBe('Fallen')
      expect(resolveMonsterTitleAndColor(champInfo, 'en')).toMatchObject({
        displayName: tc.expectedEn,
        titleColor: 'blue',
      })
      expect(resolveMonsterTitleAndColor(champInfo, 'zh')).toMatchObject({
        displayName: tc.expectedZh,
        titleColor: 'blue',
      })
      expect(buildMonsterHoverSubtext(champInfo, 'en').line1Colored).toBe('ÿc3Demon')
    }

    // Offline rollEliteModifiers('champion') strictly draws from CANONICAL_CHAMPION_MODIFIERS (16, 36..39)
    const champSubtypeNames = new Set(CANONICAL_CHAMPION_MODIFIERS.map(m => m.name))
    const rolledChampMods = new Set<string>()
    const champRng = new Rng(99)
    for (let i = 0; i < 100; i += 1) {
      const mods = rollEliteModifiers('champion', champRng)
      expect(mods).toHaveLength(1)
      expect(champSubtypeNames.has(mods[0]!)).toBe(true)
      rolledChampMods.add(mods[0]!)
    }
    expect(rolledChampMods.size).toBe(5)

    // 4. Minion Fallen (hcIdx = 19 fallen1, flags = 0x10)
    const minionUnit = new ClientUnit({
      unitType: 1,
      id: 104,
      classId: 19,
      x: 5030,
      y: 5030,
      lifePct: 128,
      flags: 0x10,
    })
    const minionInfo = clientUnitToMonsterTargetInfo(minionUnit, 0)
    expect(minionInfo.rank).toBe('minion')
    expect(buildMonsterHoverSubtext(minionInfo, 'en').line1).toBe('Demon  Minion')

    // 5. Act Boss Andariel (hcIdx = 156 andariel)
    const andarielUnit = new ClientUnit({
      unitType: 1,
      id: 105,
      classId: 156,
      x: 5040,
      y: 5040,
      lifePct: 128,
    })
    const andarielInfo = clientUnitToMonsterTargetInfo(andarielUnit, 0)
    expect(andarielInfo.rank).toBe('boss')
    expect(andarielInfo.isBoss).toBe(true)
    expect(andarielInfo.isDemon).toBe(true)
    expect(resolveMonsterTitleAndColor(andarielInfo, 'en').titleColor).toBe('gold')

    // 6. Uber Diablo (hcIdx = 705 uberdiablo) and Uber Mephisto (hcIdx = 704 ubermephisto) suppress modifiers and immunities (0x6facfedb & 0x6fb6fca0)
    const uberUnit = new ClientUnit({
      unitType: 1,
      id: 106,
      classId: 705,
      x: 5050,
      y: 5050,
      lifePct: 128,
      bossMods: [8, 9, 17, 18],
    })
    const uberInfo = clientUnitToMonsterTargetInfo(uberUnit, 2)
    expect(uberInfo.name).toBe('Diablo')
    expect(uberInfo.nameKey).toBe('Diablo')
    expect(uberInfo.isBoss).toBe(true)
    expect(uberInfo.isDemon).toBe(true)
    expect(uberInfo.modifiers).toEqual([])
    expect(uberInfo.resistances).toBeUndefined()

    const uberMephUnit = new ClientUnit({
      unitType: 1,
      id: 108,
      classId: 704,
      x: 5055,
      y: 5055,
      lifePct: 128,
      bossMods: [8, 9],
    })
    const uberMephInfo = clientUnitToMonsterTargetInfo(uberMephUnit, 2)
    expect(uberMephInfo.name).toBe('Mephisto')
    expect(uberMephInfo.nameKey).toBe('Mephisto')
    expect(uberMephInfo.isBoss).toBe(true)
    expect(uberMephInfo.isDemon).toBe(true)
    expect(uberMephInfo.modifiers).toEqual([])
    expect(uberMephInfo.resistances).toBeUndefined()

    // Baal (hcIdx = 544 baalcrab) resolves NameStr 'Baal Crab' -> "Baal", not baalthrone
    const baalUnit = new ClientUnit({
      unitType: 1,
      id: 109,
      classId: 544,
      x: 5058,
      y: 5058,
      lifePct: 128,
    })
    const baalInfo = clientUnitToMonsterTargetInfo(baalUnit, 2)
    expect(baalInfo.nameKey).toBe('Baal Crab')
    expect(baalInfo.name).toBe('Baal')
    expect(baalInfo.isBoss).toBe(true)
    expect(baalInfo.isDemon).toBe(true)

    // 7. Random Unique Fallen (hcIdx = 19, flags = 0x08, nameSeed = 0x1234 -> wNameSeed = 0x34)
    const randUniqueUnit = new ClientUnit({
      unitType: 1,
      id: 107,
      classId: 19,
      x: 5060,
      y: 5060,
      lifePct: 128,
      flags: 0x08,
      isUnique: true,
      nameSeed: 0x1234,
      bossMods: [5, 6],
    })
    const randUniqueInfo = clientUnitToMonsterTargetInfo(randUniqueUnit, 0)
    expect(randUniqueInfo.rank).toBe('unique')
    expect(randUniqueInfo.nameSeed).toBe(0x1234)
    const enTitle = resolveMonsterTitleAndColor(randUniqueInfo, 'en')
    const zhTitle = resolveMonsterTitleAndColor(randUniqueInfo, 'zh')
    expect(enTitle.titleColor).toBe('gold')
    expect(enTitle.displayName).not.toBe('Fallen')
    expect(enTitle.displayName.split(' ').length).toBeGreaterThanOrEqual(2)
    expect(zhTitle.titleColor).toBe('gold')
    expect(zhTitle.displayName).not.toBe('沉淪魔')
  })

  it('Issue #713: getMonsterKindByHcIdx aligns 0..733 with MONSTER_HCIDX_TO_ID and 1.13c MonStats.txt with 0 discrepancies across all difficulties', async () => {
    const fs = await import('node:fs')
    const { cell } = await import('../src/common/world/acts.ts')
    const { MONSTER_HCIDX_TO_ID } = await import('../src/common/units/monster-mapping.ts')
    const { getMonsterKindByHcIdx, getMonsterKindByClassId, MONSTER_TABLE } = await import(
      '../src/common/units/monsters-data.ts'
    )

    // 1. Canonical boundary checks for Expansion shift & duplicate cr_lancer8
    expect(getMonsterKindByHcIdx(409, 'normal')?.id).toBe('hephasto')
    expect(getMonsterKindByHcIdx(410, 'normal')?.id).toBe('wakeofdestruction')
    expect(getMonsterKindByHcIdx(543, 'normal')?.id).toBe('baalthrone')
    expect(getMonsterKindByHcIdx(544, 'normal')?.id).toBe('baalcrab')
    expect(getMonsterKindByHcIdx(617, 'normal')?.id).toBe('cr_lancer8')
    expect(getMonsterKindByHcIdx(703, 'normal')?.id).toBe('mummy6')
    expect(getMonsterKindByHcIdx(704, 'normal')?.id).toBe('ubermephisto')
    expect(getMonsterKindByHcIdx(705, 'normal')?.id).toBe('uberdiablo')
    expect(getMonsterKindByHcIdx(723, 'normal')?.id).toBe('cr_lancer8')
    expect(getMonsterKindByHcIdx(733, 'normal')?.id).toBe('willowisp8')

    // Out-of-range and non-integer inputs return undefined; Expansion separator never leaks
    expect(getMonsterKindByHcIdx(-1, 'normal')).toBeUndefined()
    expect(getMonsterKindByHcIdx(734, 'normal')).toBeUndefined()
    expect(getMonsterKindByHcIdx(1.5, 'normal')).toBeUndefined()
    expect(getMonsterKindByHcIdx(Number.NaN, 'normal')).toBeUndefined()
    expect(MONSTER_TABLE.get('Expansion')).toBeUndefined()

    // 2. Full 0..733 spectrum parity across all difficulties ('normal'|'nightmare'|'hell' and 0|1|2)
    const rawTable = parseTable(new TextEncoder().encode(RAW_MONSTATS))
    const nonExpansionRows = rawTable.rows.filter(r => {
      const id = cell(rawTable, r, 'Id').trim()
      return id !== '' && id.toLowerCase() !== 'expansion'
    })
    expect(nonExpansionRows).toHaveLength(734)

    for (let hcIdx = 0; hcIdx <= 733; hcIdx += 1) {
      const expectedId = MONSTER_HCIDX_TO_ID[hcIdx]
      expect(expectedId, `MONSTER_HCIDX_TO_ID[${hcIdx}] must be defined`).toBeDefined()

      const row = nonExpansionRows[hcIdx]!
      expect(cell(rawTable, row, 'Id').trim()).toBe(expectedId)

      const byClassId = getMonsterKindByClassId(hcIdx)
      expect(byClassId?.id).toBe(expectedId)

      for (const [diffStr, diffNum] of [
        ['normal', 0],
        ['nightmare', 1],
        ['hell', 2],
      ] as const) {
        const kindStr = getMonsterKindByHcIdx(hcIdx, diffStr)
        const kindNum = getMonsterKindByHcIdx(hcIdx, diffNum)
        expect(kindStr?.id, `hcIdx=${hcIdx} diff=${diffStr}`).toBe(expectedId)
        expect(kindNum?.id, `hcIdx=${hcIdx} diff=${diffNum}`).toBe(expectedId)
        expect(kindStr?.nameKey).toBe(cell(rawTable, row, 'NameStr').trim())
      }
    }

    // 3. Direct row-by-row comparison against Patch_D2.mpq MonStats.txt when local MPQ is present
    const mpqPath = fs.existsSync('samples/d2/Patch_D2.mpq')
      ? 'samples/d2/Patch_D2.mpq'
      : process.env.D2_DATA_DIR && fs.existsSync(`${process.env.D2_DATA_DIR}/Patch_D2.mpq`)
        ? `${process.env.D2_DATA_DIR}/Patch_D2.mpq`
        : null
    if (mpqPath) {
      const { MpqArchive } = await import('../src/common/mpq/archive.ts')
      const { fileSource } = await import('../src/baker/io/file-source.ts')
      const archive = await MpqArchive.open(await fileSource(mpqPath))
      const monstatsBytes = await archive.read(archive.find('data\\global\\excel\\MonStats.txt')!)
      const mpqTable = parseTable(monstatsBytes)
      const mpqRows = mpqTable.rows.filter(r => {
        const id = cell(mpqTable, r, 'Id').trim()
        return id !== '' && id.toLowerCase() !== 'expansion'
      })
      expect(mpqRows).toHaveLength(734)
      for (let hcIdx = 0; hcIdx <= 733; hcIdx += 1) {
        const mpqRow = mpqRows[hcIdx]!
        expect(Number(cell(mpqTable, mpqRow, 'hcIdx').trim())).toBe(hcIdx)
        const mpqId = cell(mpqTable, mpqRow, 'Id').trim()
        const kind = getMonsterKindByHcIdx(hcIdx, 'hell')
        expect(kind?.id).toBe(mpqId)
        expect(kind?.nameKey).toBe(cell(mpqTable, mpqRow, 'NameStr').trim())
      }
    }
  })
})



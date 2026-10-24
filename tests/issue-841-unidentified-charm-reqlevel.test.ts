import { describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { createDroppedItem } from '../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { rollMagicAffixes } from '../src/common/items/affix-generator.ts'
import { onlineItemDataToUiInventoryItem } from '../src/common/items/item-bridge.ts'
import type { D2ColorCode, D2FontName, D2FontRenderer } from '../src/client/ui/font.ts'
import {
  identifyUiItem,
  isUiItemUnidentified,
  itemToUiInventoryItem,
} from '../src/client/ui/inventory.ts'
import { WorldPanelsHud } from '../src/client/ui/world-panels.ts'

function createMockTooltipCanvas() {
  const fontCalls: Array<{ text: string; color?: D2ColorCode | undefined; font?: D2FontName | undefined }> = []
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D

  const font = {
    loaded: true,
    measureText: vi.fn((text: string) => text.length * 8),
    drawText: vi.fn(
      (
        _ctx: CanvasRenderingContext2D,
        text: string,
        _x: number,
        _y: number,
        opts?: { font?: D2FontName; color?: D2ColorCode },
      ) => {
        fontCalls.push({ text, color: opts?.color, font: opts?.font })
      },
    ),
  } as unknown as D2FontRenderer

  return { ctx, font, fontCalls }
}

describe('Issue #841: Unidentified Charms & Items Suppress Required Level Tooltip (D2Client.dll 0x6fb43d89 & D2Common.dll 0x6fd76190)', () => {
  const tables = getEmbeddedDropTables()

  it('1. Unidentified Small Charm (cm1, qlvl=28, levelreq=0) and Large Charm (cm2, qlvl=14) do NOT display Required Level before identification', () => {
    const cm1Base = tables.getBase('cm1')!
    const cm2Base = tables.getBase('cm2')!
    const cm3Base = tables.getBase('cm3')!
    expect(cm1Base.level).toBe(28)
    expect(tables.misc.get('cm1')?.levelreq ?? 0).toBe(0)
    expect(cm2Base.level).toBe(14)
    expect(tables.misc.get('cm2')?.levelreq ?? 0).toBe(0)
    expect(cm3Base.level).toBe(1)
    expect(tables.misc.get('cm3')?.levelreq ?? 0).toBe(0)

    // Roll a high-ilvl magic Small Charm that gets a required level > 1 affix once identified
    let droppedSmallCharm = createDroppedItem(cm1Base, 'magic', {
      itemTypes: tables.itemTypes,
      ilvl: 85,
      dwInitSeed: 101,
      itemRng: new D2Rng(101),
    })
    for (let seed = 100; seed < 300; seed++) {
      const rng = new D2Rng(seed)
      const magicAffixes = rollMagicAffixes(cm1Base, 85, tables.magicAffixes, tables.isA, rng)
      const preReq = magicAffixes.prefix?.levelreq ?? 0
      const sufReq = magicAffixes.suffix?.levelreq ?? 0
      if (Math.max(preReq, sufReq) > 10) {
        droppedSmallCharm = createDroppedItem(cm1Base, 'magic', {
          magicAffixes,
          itemTypes: tables.itemTypes,
          ilvl: 85,
          dwInitSeed: seed,
          itemRng: rng,
        })
        break
      }
    }

    expect(droppedSmallCharm.identified).toBe(false)
    const uiCharm = itemToUiInventoryItem(droppedSmallCharm, tables)
    expect(isUiItemUnidentified(uiCharm)).toBe(true)
    // Unidentified charm must NOT leak affix reqLevel or base.level (qlvl=28)
    expect(uiCharm.reqLevel).toBeUndefined()

    const { ctx, font, fontCalls } = createMockTooltipCanvas()
    const wp = new WorldPanelsHud()
    wp.setPlayerContext({ level: 1 })

    // CHI tooltip while unidentified
    wp.lang = 'CHI'
    fontCalls.length = 0
    wp.drawItemTooltip(ctx, { item: uiCharm, x: 400, y: 300 }, font, false)
    const textsZh = fontCalls.map(c => c.text)
    expect(textsZh[0]).toBe('小护身符')
    expect(textsZh).toContain('未辨识')
    expect(textsZh.some(t => t.includes('需要等级'))).toBe(false)

    // ENG tooltip while unidentified
    wp.lang = 'ENG'
    fontCalls.length = 0
    wp.drawItemTooltip(ctx, { item: uiCharm, x: 400, y: 300 }, font, false)
    const textsEn = fontCalls.map(c => c.text)
    expect(textsEn[0]).toBe('Small Charm')
    expect(textsEn).toContain('Unidentified')
    expect(textsEn.some(t => t.includes('Required Level'))).toBe(false)

    // Also verify Large Charm (cm2, qlvl=14) while unidentified
    const droppedLargeCharm = createDroppedItem(cm2Base, 'magic', {
      itemTypes: tables.itemTypes,
      ilvl: 50,
      dwInitSeed: 202,
      itemRng: new D2Rng(202),
    })
    const uiLargeCharm = itemToUiInventoryItem(droppedLargeCharm, tables)
    expect(uiLargeCharm.reqLevel).toBeUndefined()
    wp.lang = 'CHI'
    fontCalls.length = 0
    wp.drawItemTooltip(ctx, { item: uiLargeCharm, x: 400, y: 300 }, font, false)
    expect(fontCalls.some(c => c.text.includes('需要等级'))).toBe(false)

    // Identify the Small Charm and verify Required Level now appears per 1.13c
    identifyUiItem(uiCharm)
    expect(isUiItemUnidentified(uiCharm)).toBe(false)
    expect(uiCharm.reqLevel).toBeDefined()
    expect(uiCharm.reqLevel!).toBeGreaterThan(10)

    wp.lang = 'CHI'
    fontCalls.length = 0
    wp.drawItemTooltip(ctx, { item: uiCharm, x: 400, y: 300 }, font, false)
    const idTextsZh = fontCalls.map(c => c.text)
    expect(idTextsZh).not.toContain('未辨识')
    expect(idTextsZh).toContain(`需要等级: ${uiCharm.reqLevel}`)

    wp.lang = 'ENG'
    fontCalls.length = 0
    wp.drawItemTooltip(ctx, { item: uiCharm, x: 400, y: 300 }, font, false)
    const idTextsEn = fontCalls.map(c => c.text)
    expect(idTextsEn).not.toContain('Unidentified')
    expect(idTextsEn).toContain(`Required Level: ${uiCharm.reqLevel}`)
  })

  it('2. Online unidentified Small Charm (onlineItemDataToUiInventoryItem) suppresses Required Level until identified', () => {
    const vitaSmallCharmSuffix = tables.magicAffixes.suffixes
      .getByName('of Vita')
      .find(a => a.itypes.includes('scha') || a.itypes.includes('char'))!
    expect(vitaSmallCharmSuffix).toBeDefined()
    expect(vitaSmallCharmSuffix.levelreq).toBeGreaterThan(1)

    const unidOnlineCharm = onlineItemDataToUiInventoryItem(
      {
        id: 84101,
        code: 'cm1',
        quality: 4, // Magic
        identified: false,
        magicSuffixId: vitaSmallCharmSuffix.id!,
        stats: [{ statId: 7, value: 20 << 8 }],
      },
      undefined,
      tables,
      1,
    )

    expect(unidOnlineCharm.identified).toBe(false)
    expect(unidOnlineCharm.reqLevel).toBeUndefined()

    const { ctx, font, fontCalls } = createMockTooltipCanvas()
    const wp = new WorldPanelsHud()
    wp.setPlayerContext({ level: 1 })
    wp.lang = 'CHI'
    wp.drawItemTooltip(ctx, { item: unidOnlineCharm, x: 400, y: 300 }, font, false)
    expect(fontCalls.map(c => c.text)).toContain('未辨识')
    expect(fontCalls.some(c => c.text.includes('需要等级'))).toBe(false)

    const idOnlineCharm = onlineItemDataToUiInventoryItem(
      {
        id: 84101,
        code: 'cm1',
        quality: 4, // Magic
        identified: true,
        magicSuffixId: vitaSmallCharmSuffix.id!,
        stats: [{ statId: 7, value: 20 << 8 }],
      },
      undefined,
      tables,
      1,
    )

    expect(idOnlineCharm.identified).toBe(true)
    expect(idOnlineCharm.reqLevel).toBe(vitaSmallCharmSuffix.levelreq)

    fontCalls.length = 0
    wp.drawItemTooltip(ctx, { item: idOnlineCharm, x: 400, y: 300 }, font, false)
    expect(fontCalls.map(c => c.text)).toContain(`需要等级: ${vitaSmallCharmSuffix.levelreq}`)
  })

  it('3. Unidentified Unique/Rare equipment suppresses Required Level line per D2Client.dll 0x6fb43d89 and reveals it upon identification', () => {
    const shakoBase = tables.getBase('uap')!
    const harlequinDef = tables.uniques.getEnabledByCode('uap')[0]!
    const unidShako = createDroppedItem(shakoBase, 'unique', {
      uniqueItem: harlequinDef,
      itemTypes: tables.itemTypes,
      ilvl: 85,
      dwInitSeed: 841,
      itemRng: new D2Rng(841),
    })

    const uiShako = itemToUiInventoryItem(unidShako, tables)
    expect(isUiItemUnidentified(uiShako)).toBe(true)
    // Base Shako levelreq is 43 (not qlvl=58 or Harlequin Crest levelreq=62)
    expect(uiShako.reqLevel).toBe(43)

    const { ctx, font, fontCalls } = createMockTooltipCanvas()
    const wp = new WorldPanelsHud()
    wp.setPlayerContext({ level: 1 })
    wp.lang = 'CHI'
    wp.drawItemTooltip(ctx, { item: uiShako, x: 400, y: 300 }, font, false)
    const unidTexts = fontCalls.map(c => c.text)
    // D2Client.dll 0x6fb43d89 skips Required Level when IFLAG_IDENTIFIED is unset
    expect(unidTexts.some(t => t.includes('需要等级'))).toBe(false)
    expect(unidTexts).toContain('未辨识')
    expect(unidTexts).toContain('无法使用')

    // Identify and verify Harlequin Crest's Required Level: 62 is revealed
    identifyUiItem(uiShako)
    expect(uiShako.reqLevel).toBe(62)
    fontCalls.length = 0
    wp.drawItemTooltip(ctx, { item: uiShako, x: 400, y: 300 }, font, false)
    const idTexts = fontCalls.map(c => c.text)
    expect(idTexts).toContain('需要等级: 62')
  })
})

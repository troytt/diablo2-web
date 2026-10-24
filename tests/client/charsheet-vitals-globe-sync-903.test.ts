/**
 * Diablo II v1.13c Character Sheet Vitals Layout & HUD Globe Max-Vitals Sync Tests (Issue #903).
 *
 * Ground Truth:
 * - `D2Client.dll 0x6FB6CEA0` (`UI_DrawCharSheet`) & stat readout table `0x6FB8D6F0` (entries `[7]..[13]`):
 *   - `[7]`  `x1=232..267` (`mid = ox+250`), `y = oy+246`: `statId = 11` (`STAT_MAXSTAMINA`, blue when boosted)
 *   - `[8]`  `x1=273..308` (`mid = ox+291`), `y = oy+246`: `statId = 10` (`STAT_STAMINA`, white)
 *   - `[9]`  `x1=232..267` (`mid = ox+250`), `y = oy+270`: `statId = 7`  (`STAT_MAXHP`, blue when boosted)
 *   - `[10]` `x1=273..308` (`mid = ox+291`), `y = oy+270`: `statId = 6`  (`STAT_HITPOINTS`, white)
 *   - `[12]` `x1=232..267` (`mid = ox+250`), `y = oy+308`: `statId = 9`  (`STAT_MAXMANA`, blue when boosted)
 *   - `[13]` `x1=273..308` (`mid = ox+291`), `y = oy+308`: `statId = 8`  (`STAT_MANA`, white)
 *   Authentic 1.13c renders Maximum in the LEFT box (`ox + 251`) and Current in the RIGHT box (`ox + 291`).
 * - `D2Client.dll 0x6FAD7BD0` (`HUD_DrawLifeGlobe` -> `D2Common #10913 GetMaxLifeFromUnit`) &
 *   `0x6FAD7A90` (`HUD_DrawManaGlobe` -> `D2Common #10186 GetMaxManaFromUnit`):
 *   - `S2C 0x1D/0x1E/0x1F` (`0x6FB5EDF0`) writes only unequipped base pool stats (`pStats->BaseStats`).
 *   - Both the Character Sheet and HUD Globes evaluate `D2Common_GetUnitStat` (`StatOpEngine`) across all
 *     attached equipment, charm, passive, and state lists so full-health `0x95` / `0x18` vitals are never
 *     clamped down to the unequipped base pool maximum.
 */

import { describe, expect, it, vi } from 'vitest'
import { AutomapView } from '../../src/client/automap/automap-view.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { CharacterSheetPanel } from '../../src/client/ui/character-sheet.ts'
import type { D2ColorCode, D2FontRenderer } from '../../src/client/ui/font.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { D2StatId } from '../../src/client/world/stat-list.ts'
import type { ItemData } from '../../src/netproto/index.ts'

interface DrawnTextEntry {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly color?: D2ColorCode | undefined
  readonly align?: string | undefined
}

function createRecordingFont(): {
  font: D2FontRenderer
  entries: DrawnTextEntry[]
} {
  const entries: DrawnTextEntry[] = []
  const font = {
    drawText: vi.fn(
      (
        _ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        opts?: { color?: D2ColorCode; align?: string },
      ) => {
        entries.push({ text, x, y, color: opts?.color, align: opts?.align })
      },
    ),
    measureText: vi.fn((text: string) => text.length * 7),
  } as unknown as D2FontRenderer
  return { font, entries }
}

function makeEquippedItem(params: {
  id: number
  code: string
  bodyLoc: number
  defense?: number
  stats: Array<{ statId: number; value: number; param?: number }>
}): ItemData {
  return {
    id: params.id,
    itemId: params.id,
    opcode: 0x9d,
    action: 0x06,
    category: 0,
    flags: 0x10,
    rawFlags: 0x10,
    version: 101,
    location: 1,
    container: 'equipment',
    bodyLoc: params.bodyLoc,
    equippedSlot: params.bodyLoc,
    gridX: 0,
    gridY: 0,
    storePage: 0,
    storagePage: 0,
    worldX: 0,
    worldY: 0,
    x: 0,
    y: 0,
    code: params.code,
    rawCode: `${params.code} `,
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
    equipped: true,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    quality: 4,
    invWidth: 2,
    invHeight: 2,
    ...(params.defense !== undefined ? { defense: params.defense } : {}),
    stats: params.stats.map((s) => ({
      statId: s.statId,
      value: s.value,
      param: s.param ?? 0,
    })),
    setBonusStats: [],
    runewordStats: [],
  }
}

describe('Issue #903: D2 1.13c Character Sheet Vitals Layout & HUD Globe Max-Vitals Sync', () => {
  it('syncs equipment-boosted maxHp/maxMana/maxStamina into HudManager globes and does not clamp full health to base stats', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const predictor = new LocalMovementPredictor()
    const automap = new AutomapView()
    const hudModel = new HudModel({
      world,
      hudManager,
      predictor,
      automap,
      onCommand: () => {},
    })

    // Reproduce exact Issue #903 state: Level 85 Sorceress with base MaxHp=558, MaxMana=601, MaxStamina=382
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 0,
        id: 1,
        classId: 1, // Sorceress
        name: 'sorone',
        x: 5100,
        y: 5100,
      },
      isSelf: true,
    })
    world.apply({ type: 'StatSet', stat: D2StatId.Level, value: 85 })
    world.apply({ type: 'StatSet', stat: D2StatId.Strength, value: 78 })
    world.apply({ type: 'StatSet', stat: D2StatId.Dexterity, value: 25 })
    world.apply({ type: 'StatSet', stat: D2StatId.Vitality, value: 200 })
    world.apply({ type: 'StatSet', stat: D2StatId.Energy, value: 222 })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxHp, value: 558 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxMana, value: 601 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxStamina, value: 382 << 8 })

    // Equip ring at bodyLoc 6 granting +52 Life (stat 7 in 8.8 fixed-point) and +8 Mana (stat 9 in 8.8 fixed-point)
    world.apply({
      type: 'ItemEvent',
      action: 0x06,
      container: 'equipment',
      item: makeEquippedItem({
        id: 101,
        code: 'rin',
        bodyLoc: 6,
        stats: [
          { statId: D2StatId.MaxHp, value: 52 << 8 },
          { statId: D2StatId.MaxMana, value: 8 << 8 },
        ],
      }),
    })

    // Server S2C 0x95 sends full current life=610, mana=609, stamina=382
    world.apply({
      type: 'LifeMana',
      life: 610,
      mana: 609,
      stamina: 382,
      at: { x: 5100, y: 5100 },
    })

    // Both HUD globes and Character Sheet must reflect 610 / 610 and 609 / 609
    expect(hudManager.maxHp).toBe(610)
    expect(hudManager.hp).toBe(610)
    expect(hudManager.maxMana).toBe(609)
    expect(hudManager.mana).toBe(609)
    expect(hudManager.maxStamina).toBe(382)
    expect(hudManager.stamina).toBe(382)

    expect(hudManager.charSheet.attrs.baseMaxHp).toBe(558)
    expect(hudManager.charSheet.attrs.maxHp).toBe(610)
    expect(hudManager.charSheet.attrs.maxHpColor).toBe('blue')
    expect(hudManager.charSheet.attrs.baseMaxMana).toBe(601)
    expect(hudManager.charSheet.attrs.maxMana).toBe(609)
    expect(hudManager.charSheet.attrs.maxManaColor).toBe('blue')

    const snap = hudModel.getSnapshot()
    expect(snap.maxHp).toBe(610)
    expect(snap.hp).toBe(610)
    expect(snap.maxMana).toBe(609)
    expect(snap.mana).toBe(609)
  })

  it('syncs +Vitality / +Energy equipment ops and active state % bonuses (Battle Orders) into HudManager globes', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const hudModel = new HudModel({
      world,
      hudManager,
      onCommand: () => {},
    })

    // Sorceress: LifePerVitality = 8 fourths (2 HP/Vit), StaminaPerVitality = 4 fourths (1 Stam/Vit), ManaPerMagic = 8 fourths (2 Mana/Ene)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'sorone', x: 5000, y: 5000 },
      isSelf: true,
    })
    world.apply({ type: 'StatSet', stat: D2StatId.Level, value: 40 })
    world.apply({ type: 'StatSet', stat: D2StatId.Vitality, value: 100 })
    world.apply({ type: 'StatSet', stat: D2StatId.Energy, value: 100 })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxHp, value: 200 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxMana, value: 200 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxStamina, value: 150 << 8 })

    // Amulet with +10 Vitality (+20 HP, +10 Stamina on Sorceress via op 9) and +10 Energy (+20 Mana via op 8)
    world.apply({
      type: 'ItemEvent',
      action: 0x06,
      container: 'equipment',
      item: makeEquippedItem({
        id: 202,
        code: 'amu',
        bodyLoc: 2,
        stats: [
          { statId: D2StatId.Vitality, value: 10 },
          { statId: D2StatId.Energy, value: 10 },
        ],
      }),
    })

    // Apply Battle Orders state (state 32) with +50% maxhp / maxmana / maxstamina (stats 76, 77, 163)
    // Per 1.13c D2Common sub_6FDB5830: op 11 % applies to pre-op base+flat (200) -> +100, then op 8/9 adds +20/+10.
    world.apply({
      type: 'StateSet',
      unit: { unitType: 0, id: 1 },
      state: 32,
      stats: [
        { statId: 76, value: 50, param: 0 }, // item_maxhp_percent
        { statId: 77, value: 50, param: 0 }, // item_maxmana_percent
        { statId: 163, value: 50, param: 0 }, // item_maxstamina_percent
      ],
    })

    world.apply({
      type: 'LifeMana',
      life: 320,
      mana: 320,
      stamina: 235,
      at: { x: 5000, y: 5000 },
    })

    // 200 * 1.5 + 20 = 320 HP, 200 * 1.5 + 20 = 320 Mana, 150 * 1.5 + 10 = 235 Stamina
    expect(hudManager.maxHp).toBe(320)
    expect(hudManager.hp).toBe(320)
    expect(hudManager.maxMana).toBe(320)
    expect(hudManager.mana).toBe(320)
    expect(hudManager.maxStamina).toBe(235)
    expect(hudManager.stamina).toBe(235)
    expect(hudModel.getSnapshot().maxHp).toBe(320)
  })

  it('draws Maximum in the LEFT box (ox + 251) and Current in the RIGHT box (ox + 291) per D2Client.dll 0x6fb8d6f0', () => {
    const sheet = new CharacterSheetPanel()
    sheet.visible = true
    sheet.lang = 'CHI'
    sheet.attrs.name = 'sorone'
    sheet.attrs.level = 85
    sheet.attrs.maxStamina = 382
    sheet.attrs.maxStaminaColor = 'white'
    sheet.attrs.maxHp = 610
    sheet.attrs.maxHpColor = 'blue'
    sheet.attrs.maxMana = 609
    sheet.attrs.maxManaColor = 'blue'

    const { font, entries } = createRecordingFont()
    const ctx = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    // CHAR_PANEL_ORIGIN in 800x600: ox = 80, oy = 60
    const ox = 80
    const oy = 60
    sheet.draw(
      ctx,
      {
        hp: 400,
        maxHp: 610,
        mana: 350,
        maxMana: 609,
        stamina: 210,
        maxStamina: 382,
        leftSkillDmg: '1-2',
        rightSkillDmg: '1-2',
      },
      {
        borderLeftImg: null,
        charSheetImg: null,
        buySellBtnImg: null,
      },
      font,
    )

    const findAt = (x: number, y: number) => entries.find((e) => e.x === x && e.y === y)

    // Stamina row (oy + 242): Left = Max (382), Right = Current (210)
    expect(findAt(ox + 251, oy + 242)).toMatchObject({
      text: '382',
      color: 'white',
      align: 'center',
    })
    expect(findAt(ox + 291, oy + 242)).toMatchObject({
      text: '210',
      color: 'white',
      align: 'center',
    })

    // Life row (oy + 266): Left = Max (610, blue), Right = Current (400, white)
    expect(findAt(ox + 251, oy + 266)).toMatchObject({
      text: '610',
      color: 'blue',
      align: 'center',
    })
    expect(findAt(ox + 291, oy + 266)).toMatchObject({
      text: '400',
      color: 'white',
      align: 'center',
    })

    // Mana row (oy + 304): Left = Max (609, blue), Right = Current (350, white)
    expect(findAt(ox + 251, oy + 304)).toMatchObject({
      text: '609',
      color: 'blue',
      align: 'center',
    })
    expect(findAt(ox + 291, oy + 304)).toMatchObject({
      text: '350',
      color: 'white',
      align: 'center',
    })
  })
})

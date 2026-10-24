import { describe, expect, it, vi } from 'vitest'
import {
  createHudEnhancementsPlugin,
  hudEnhancementsPlugin,
} from '../../plugins/hud-enhancements/index.ts'
import { PluginHost } from '../../src/client/plugin-host/plugin-host.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import {
  CHAR_ADV_STATS_BTN_BOUNDS,
  CHAR_PANEL_ORIGIN,
  CharacterSheetPanel,
  DAMAGE_ROW_BOUNDS,
  STAT_ROW_BOUNDS,
  computeFcrBreakpoints,
  computeFhrBreakpoints,
  computeIasBreakpoints,
  formatCharacterDamageTooltipLines,
  formatStatBasePlusBonus,
  formatStatGainTooltipLines,
} from '../../src/client/ui/character-sheet.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { D2FontRenderer } from '../../src/client/ui/font.ts'
import { SkillHotkeysHud } from '../../src/client/ui/hotkeys.ts'
import {
  SKILL_PANEL_ORIGIN,
  SkillTreePanel,
  formatSkillSocketLabel,
} from '../../src/client/ui/skill-tree-panel.ts'
import { formatWeaponDamageFormulaLines } from '../../src/client/ui/panels/escape-monster-tooltip.ts'
import { WorldPanelsHud } from '../../src/client/ui/world-panels.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { onlineItemDataToUiInventoryItem } from '../../src/common/items/item-bridge.ts'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

function createMockCanvasCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D
}

function createMockFont(): D2FontRenderer {
  return {
    drawText: vi.fn(),
    measureText: vi.fn((text: string) => text.length * 6),
  } as unknown as D2FontRenderer
}

describe('HUD Display Enhancements Plugin (`hud-enhancements`)', () => {
  it('activates with default enabled enhancements, syncs individual toggles, and reverts to 1.13c vanilla on deactivate', async () => {
    const settingsStorage = new MemoryStorage()
    const pluginStorage = new MemoryStorage()
    const settingsStore = new SettingsStore({
      storage: settingsStorage,
      syncGlobalLang: false,
    })
    const session = new OnlineSession({ settingsStore })

    // Vanilla baseline before plugin host starts
    expect(settingsStore.get().showBasePlusBonusStats).toBe(false)
    expect(settingsStore.get().showBasePlusBonusSkills).toBe(false)
    expect(settingsStore.get().showStatGainTooltips).toBe(false)
    expect(settingsStore.get().showWeaponDamageFormula).toBe(false)
    expect(settingsStore.get().showAdvancedStatsButton).toBe(false)
    expect(settingsStore.get().showRuneNumbers).toBe(false)
    expect(session.hudManager.getHudEnhancements()).toEqual({
      showBasePlusBonusStats: false,
      showBasePlusBonusSkills: false,
      showStatGainTooltips: false,
      showWeaponDamageFormula: false,
      showAdvancedStatsButton: false,
      showRuneNumbers: false,
    })

    const host = new PluginHost({
      plugins: [createHudEnhancementsPlugin()],
      session,
      settingsStore,
      enforceClientDefaults: true,
      storageOptions: { storage: pluginStorage },
    })
    await host.whenStarted()

    // Plugin is defaultEnabled: true -> all 6 enhancements active
    expect(settingsStore.get().showBasePlusBonusStats).toBe(true)
    expect(settingsStore.get().showBasePlusBonusSkills).toBe(true)
    expect(settingsStore.get().showStatGainTooltips).toBe(true)
    expect(settingsStore.get().showWeaponDamageFormula).toBe(true)
    expect(settingsStore.get().showAdvancedStatsButton).toBe(true)
    expect(settingsStore.get().showRuneNumbers).toBe(true)
    expect(session.hudManager.getHudEnhancements()).toEqual({
      showBasePlusBonusStats: true,
      showBasePlusBonusSkills: true,
      showStatGainTooltips: true,
      showWeaponDamageFormula: true,
      showAdvancedStatsButton: true,
      showRuneNumbers: true,
    })

    const snap1 = host.list().find((p) => p.id === hudEnhancementsPlugin.id)!
    expect(snap1.active).toBe(true)
    expect(snap1.status.level).toBe('ok')
    expect(snap1.status.text.zh).toContain('属性x+y')
    expect(snap1.status.text.zh).toContain('属性增益提示')
    expect(snap1.status.text.zh).toContain('武器伤害公式')
    expect(snap1.status.text.zh).toContain('更多属性面板')
    expect(snap1.status.text.zh).toContain('符文编号')
    expect(snap1.status.text.en).toContain('Stats x+y')
    expect(snap1.status.text.en).toContain('Stat Gain Tips')
    expect(snap1.status.text.en).toContain('Weapon Dmg Formula')
    expect(snap1.status.text.en).toContain('Advanced Stats')
    expect(snap1.status.text.en).toContain('Rune #')

    // Toggle individual setting: disable showBasePlusBonusSkills only
    host.setSetting('hud-enhancements', 'showBasePlusBonusSkills', false)
    expect(settingsStore.get().showBasePlusBonusStats).toBe(true)
    expect(settingsStore.get().showBasePlusBonusSkills).toBe(false)
    expect(settingsStore.get().showStatGainTooltips).toBe(true)
    expect(settingsStore.get().showWeaponDamageFormula).toBe(true)
    expect(settingsStore.get().showAdvancedStatsButton).toBe(true)
    expect(settingsStore.get().showRuneNumbers).toBe(true)
    expect(session.hudManager.skillTree.showBasePlusBonusSkills).toBe(false)
    expect(session.hudManager.hotkeys.showBasePlusBonusSkills).toBe(false)

    // Toggle showStatGainTooltips off individually
    host.setSetting('hud-enhancements', 'showStatGainTooltips', false)
    expect(settingsStore.get().showStatGainTooltips).toBe(false)
    expect(session.hudManager.charSheet.showStatGainTooltips).toBe(false)

    // Re-enable showStatGainTooltips
    host.setSetting('hud-enhancements', 'showStatGainTooltips', true)
    expect(settingsStore.get().showStatGainTooltips).toBe(true)
    expect(session.hudManager.charSheet.showStatGainTooltips).toBe(true)

    // Toggle showWeaponDamageFormula off individually
    host.setSetting('hud-enhancements', 'showWeaponDamageFormula', false)
    expect(settingsStore.get().showWeaponDamageFormula).toBe(false)
    expect(session.hudManager.worldPanels.showWeaponDamageFormula).toBe(false)

    // Re-enable showWeaponDamageFormula
    host.setSetting('hud-enhancements', 'showWeaponDamageFormula', true)
    expect(settingsStore.get().showWeaponDamageFormula).toBe(true)
    expect(session.hudManager.worldPanels.showWeaponDamageFormula).toBe(true)

    // Toggle showAdvancedStatsButton off individually
    session.hudManager.charSheet.advancedStatsOpen = true
    host.setSetting('hud-enhancements', 'showAdvancedStatsButton', false)
    expect(settingsStore.get().showAdvancedStatsButton).toBe(false)
    expect(session.hudManager.charSheet.showAdvancedStatsButton).toBe(false)
    expect(session.hudManager.charSheet.advancedStatsOpen).toBe(false)

    // Re-enable showAdvancedStatsButton
    host.setSetting('hud-enhancements', 'showAdvancedStatsButton', true)
    expect(settingsStore.get().showAdvancedStatsButton).toBe(true)
    expect(session.hudManager.charSheet.showAdvancedStatsButton).toBe(true)

    // Toggle showRuneNumbers off individually
    host.setSetting('hud-enhancements', 'showRuneNumbers', false)
    expect(settingsStore.get().showRuneNumbers).toBe(false)
    expect(session.hudManager.worldPanels.showRuneNumbers).toBe(false)

    // Re-enable showRuneNumbers
    host.setSetting('hud-enhancements', 'showRuneNumbers', true)
    expect(settingsStore.get().showRuneNumbers).toBe(true)
    expect(session.hudManager.worldPanels.showRuneNumbers).toBe(true)

    // Disable the entire plugin -> strictly reverts all 6 flags to 1.13c vanilla false
    await host.setEnabled('hud-enhancements', false)
    expect(settingsStore.get().showBasePlusBonusStats).toBe(false)
    expect(settingsStore.get().showBasePlusBonusSkills).toBe(false)
    expect(settingsStore.get().showStatGainTooltips).toBe(false)
    expect(settingsStore.get().showWeaponDamageFormula).toBe(false)
    expect(settingsStore.get().showAdvancedStatsButton).toBe(false)
    expect(settingsStore.get().showRuneNumbers).toBe(false)
    expect(session.hudManager.getHudEnhancements()).toEqual({
      showBasePlusBonusStats: false,
      showBasePlusBonusSkills: false,
      showStatGainTooltips: false,
      showWeaponDamageFormula: false,
      showAdvancedStatsButton: false,
      showRuneNumbers: false,
    })
  })

  it('formats primary attributes as base+bonus (x+y) on CharacterSheetPanel when enabled and preserves vanilla total when disabled', () => {
    expect(formatStatBasePlusBonus(120, 85)).toEqual({
      text: '85+35',
      font: 'font8',
      color: 'blue',
    })
    expect(formatStatBasePlusBonus(25, 25)).toEqual({
      text: '25+0',
      font: 'font8',
      color: 'white',
    })
    expect(formatStatBasePlusBonus(75, 85)).toEqual({
      text: '85-10',
      font: 'font8',
      color: 'red',
    })
    expect(formatStatBasePlusBonus(270, 150)).toEqual({
      text: '150+120',
      font: 'font6',
      color: 'blue',
    })

    const panel = new CharacterSheetPanel()
    panel.visible = true
    panel.classCode = 'sor'
    panel.attrs = {
      ...panel.attrs,
      name: 'Sorc',
      level: 80,
      str: 120,
      baseStr: 85,
      strColor: 'blue',
      dex: 25,
      baseDex: 25,
      vit: 75,
      baseVit: 85,
      vitColor: 'red',
      ene: 270,
      baseEne: 150,
      eneColor: 'blue',
    }

    const ctx = createMockCanvasCtx()
    const font = createMockFont()
    const runtime = {
      hp: 800,
      maxHp: 800,
      mana: 600,
      maxMana: 600,
      stamina: 200,
      maxStamina: 200,
      leftSkillDmg: '10-20',
      rightSkillDmg: '100-200',
    }

    // 1. Vanilla mode (showBasePlusBonusStats = false)
    panel.showBasePlusBonusStats = false
    panel.draw(ctx, runtime, { borderLeftImg: null, charSheetImg: null, levelBtnImg: null, buySellBtnImg: null }, font)
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '120',
      CHAR_PANEL_ORIGIN.x + 95,
      CHAR_PANEL_ORIGIN.y + 94,
      expect.objectContaining({ font: 'fontexocet10', color: 'blue', align: 'center' }),
    )

    // 2. Enhanced mode (showBasePlusBonusStats = true)
    vi.clearAllMocks()
    panel.showBasePlusBonusStats = true
    panel.draw(ctx, runtime, { borderLeftImg: null, charSheetImg: null, levelBtnImg: null, buySellBtnImg: null }, font)
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '85+35',
      CHAR_PANEL_ORIGIN.x + 95,
      CHAR_PANEL_ORIGIN.y + 94,
      expect.objectContaining({ font: 'font8', color: 'blue', align: 'center' }),
    )
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '25+0',
      CHAR_PANEL_ORIGIN.x + 95,
      CHAR_PANEL_ORIGIN.y + 156,
      expect.objectContaining({ font: 'font8', color: 'white', align: 'center' }),
    )
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '85-10',
      CHAR_PANEL_ORIGIN.x + 95,
      CHAR_PANEL_ORIGIN.y + 242,
      expect.objectContaining({ font: 'font8', color: 'red', align: 'center' }),
    )
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '150+120',
      CHAR_PANEL_ORIGIN.x + 95,
      CHAR_PANEL_ORIGIN.y + 304,
      expect.objectContaining({ font: 'font6', color: 'blue', align: 'center' }),
    )
  })

  it('formats skill sockets and skill tooltips as hard+bonus (x+y) when enabled', () => {
    expect(formatSkillSocketLabel(5, 3, true)).toEqual({
      text: '5+3',
      font: 'font6',
      color: 'blue',
    })
    expect(formatSkillSocketLabel(5, 0, true)).toEqual({
      text: '5+0',
      font: 'font6',
      color: 'white',
    })
    expect(formatSkillSocketLabel(0, 3, true)).toBeNull()

    const panel = new SkillTreePanel('sor')
    panel.visible = true
    panel.activeTab = 0 // Fire Spells
    panel.hardPoints.set(36, 5) // Fire Bolt: 5 hard
    panel.bonusLevels.set(36, 3) // +3 bonus -> 8 effective
    panel.hardPoints.set(37, 2) // Warmth: 2 hard, 0 bonus

    panel.showBasePlusBonusSkills = true
    expect(panel.formatSkillSocketLabel(36)).toBe('5+3')
    expect(panel.formatSkillSocketLabel(37)).toBe('2+0')

    const ctx = createMockCanvasCtx()
    const font = createMockFont()
    panel.draw(
      ctx,
      { borderRightImg: null, skillPointsImg: null, buySellBtnImg: null, skillTabsImg: null },
      font,
    )

    const fbPos = SkillTreePanel.nodeScreenPos(panel.getSkillTree().find((n) => n.skillId === 36)!)
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '5+3',
      fbPos.x + 51,
      fbPos.y + 59,
      expect.objectContaining({ font: 'font6', color: 'blue', align: 'center' }),
    )

    // Verify tooltip Current Skill Level line includes (x+y) breakdown
    const tooltipLines = panel.formatSkillTooltipLines(36)
    expect(tooltipLines.some((l) => l.text.includes('8 (5+3)'))).toBe(true)

    // Verify hotkey tooltip Current Skill Level line includes (x+y) breakdown
    const hotkeys = new SkillHotkeysHud()
    hotkeys.showBasePlusBonusSkills = true
    hotkeys.tooltipResolver = (id) => panel.getTooltipViewModel(id)
    const hkLines = hotkeys.formatTooltipLines(36, 'left', false)
    expect(hkLines.some((l) => l.text.includes('8 (5+3)'))).toBe(true)

    // Revert to vanilla -> tooltip omits (x+y)
    panel.showBasePlusBonusSkills = false
    const vanillaLines = panel.formatSkillTooltipLines(36)
    expect(vanillaLines.some((l) => l.text.includes('8 (5+3)'))).toBe(false)
    expect(vanillaLines.some((l) => l.text.endsWith('8'))).toBe(true)
  })

  it('computes 1.13c per-point attribute gain tooltips and renders them on hover when showStatGainTooltips is enabled', () => {
    const panel = new CharacterSheetPanel()
    panel.visible = true
    panel.lang = 'CHI'
    panel.classCode = 'bar'
    panel.attrs = {
      ...panel.attrs,
      weaponStrBonus: 110, // Warhammer / Maul: +1.1% per Str
      weaponDexBonus: 0,
      weaponPhysBaseMin: 100,
      weaponPhysBaseMax: 150,
      weaponIsRanged: false,
      arPctBonus: 0,
    }

    // 1. Barbarian Vitality (+4 Life, +1 Stamina) & Energy (+1 Mana) & Strength (+1.1-1.65 Melee Damage (+1.1%))
    const barVitZh = formatStatGainTooltipLines('vit', 'bar', panel.attrs, 'CHI').map((l) => l.text)
    expect(barVitZh).toContain('+4 生命')
    expect(barVitZh).toContain('+1 耐力')

    const barEneZh = formatStatGainTooltipLines('ene', 'bar', panel.attrs, 'CHI').map((l) => l.text)
    expect(barEneZh).toContain('+1 法力')

    const barStrZh = formatStatGainTooltipLines('str', 'bar', panel.attrs, 'CHI').map((l) => l.text)
    expect(barStrZh).toContain('+1.1-1.65 近战伤害 (+1.1%)')

    // 2. Sorceress Vitality (+2 Life, +1 Stamina) & Energy (+2 Mana) in English
    const sorVitEn = formatStatGainTooltipLines('vit', 'sor', panel.attrs, 'ENG').map((l) => l.text)
    expect(sorVitEn).toContain('+2 Life')
    expect(sorVitEn).toContain('+1 Stamina')

    const sorEneEn = formatStatGainTooltipLines('ene', 'sor', panel.attrs, 'ENG').map((l) => l.text)
    expect(sorEneEn).toContain('+2 Mana')

    // 3. Assassin Vitality (+3 Life, +1.25 Stamina), Energy (+1.75 Mana), and Claw DexBonus=75
    const assAttrs = {
      ...panel.attrs,
      weaponStrBonus: 75,
      weaponDexBonus: 75,
      weaponPhysBaseMin: 40,
      weaponPhysBaseMax: 80,
      weaponIsRanged: false,
      arPctBonus: 100, // +100% AR -> +10 effective AR (+5 Base)
    }
    const assVitZh = formatStatGainTooltipLines('vit', 'ass', assAttrs, 'CHI').map((l) => l.text)
    expect(assVitZh).toContain('+3 生命')
    expect(assVitZh).toContain('+1.25 耐力')
    const assEneZh = formatStatGainTooltipLines('ene', 'ass', assAttrs, 'CHI').map((l) => l.text)
    expect(assEneZh).toContain('+1.75 法力')
    const assDexZh = formatStatGainTooltipLines('dex', 'ass', assAttrs, 'CHI').map((l) => l.text)
    expect(assDexZh).toContain('+10 攻击准确率 (基础 +5)')
    expect(assDexZh).toContain('+0.25 基础防御力 (每 4 点 +1)')
    expect(assDexZh).toContain('+0.3-0.6 近战伤害 (+0.75%)')

    // 4. Amazon with Bow (StrBonus=0, DexBonus=100, weaponIsRanged=true)
    const amaBowAttrs = {
      ...panel.attrs,
      weaponStrBonus: 0,
      weaponDexBonus: 100,
      weaponPhysBaseMin: 20,
      weaponPhysBaseMax: 50,
      weaponIsRanged: true,
      arPctBonus: 0,
    }
    const amaStrZh = formatStatGainTooltipLines('str', 'ama', amaBowAttrs, 'CHI').map((l) => l.text)
    expect(amaStrZh).toContain('+0 当前远程武器伤害')
    const amaDexZh = formatStatGainTooltipLines('dex', 'ama', amaBowAttrs, 'CHI').map((l) => l.text)
    expect(amaDexZh).toContain('+5 攻击准确率')
    expect(amaDexZh).toContain('+0.2-0.5 远程伤害 (+1%)')

    // 5. Vanilla mode (showStatGainTooltips = false) -> hover is ignored and no tooltip is drawn
    const ctx = createMockCanvasCtx()
    const font = createMockFont()
    panel.showStatGainTooltips = false
    panel.handleMouseMove(STAT_ROW_BOUNDS.vit.x + 10, STAT_ROW_BOUNDS.vit.y + 10)
    expect(panel.hoveredStat).toBeNull()
    panel.drawStatTooltip(ctx, font)
    expect(ctx.fillRect).not.toHaveBeenCalled()

    // 6. Enhanced mode (showStatGainTooltips = true) -> hovering Vitality sets hoveredStat='vit' and draws tooltip
    panel.showStatGainTooltips = true
    panel.handleMouseMove(STAT_ROW_BOUNDS.vit.x + 10, STAT_ROW_BOUNDS.vit.y + 10)
    expect(panel.hoveredStat).toBe('vit')

    panel.drawStatTooltip(ctx, font)
    expect(ctx.fillRect).toHaveBeenCalled()
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '+4 生命',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ color: 'blue', font: 'font8' }),
    )
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '+1 耐力',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ color: 'blue', font: 'font8' }),
    )

    // Moving cursor outside attribute rows clears hoveredStat
    panel.handleMouseMove(10, 10)
    expect(panel.hoveredStat).toBeNull()
  })

  it('displays base white weapon damage (excluding ethereal) and 1.13c calculation formula when showWeaponDamageFormula is enabled', () => {
    const tables = getEmbeddedDropTables()

    // 1. Plain normal white weapon (Ogre Maul '7m7', base 77~106)
    const normalMaul = onlineItemDataToUiInventoryItem(
      { id: 7001, code: '7m7', quality: 2, identified: true, stats: [] },
      undefined,
      tables,
      85,
    )
    expect(formatWeaponDamageFormulaLines(normalMaul, false)).toEqual(['基础白字: 77~106'])
    expect(formatWeaponDamageFormulaLines(normalMaul, true)).toEqual(['Base White: 77~106'])

    // 2. Immortal King's Stone Crusher ('7m7', base 77~106) +200% ED + 2x Ohm Rune (+100% ED) = +300% ED -> 308~424
    const ikMaul = onlineItemDataToUiInventoryItem(
      {
        id: 7002,
        code: '7m7',
        quality: 5,
        setItemId: 109,
        identified: true,
        socketed: true,
        totalSockets: 2,
        usedSockets: 2,
        stats: [{ statId: 17, param: 0, value: 200 }],
      },
      [
        { id: 7003, code: 'r27', quality: 2, identified: true, inSocket: true, stats: [] },
        { id: 7004, code: 'r27', quality: 2, identified: true, inSocket: true, stats: [] },
      ],
      tables,
      85,
    )
    expect(formatWeaponDamageFormulaLines(ikMaul, false)).toEqual([
      '基础白字: 77~106 | 公式: 77~106 × (1+300%) = 308~424',
    ])
    expect(formatWeaponDamageFormulaLines(ikMaul, true)).toEqual([
      'Base White: 77~106 | Formula: 77~106 × (1+300%) = 308~424',
    ])

    // 3. Ethereal Superior Crystal Sword ('crs', raw base 5~15, ethereal floor 7~22, +15% ED -> 8~25)
    const ethCrystalSword = onlineItemDataToUiInventoryItem(
      {
        id: 7005,
        code: 'crs',
        quality: 3, // Superior
        identified: true,
        ethereal: true,
        stats: [{ statId: 17, param: 0, value: 15 }],
      },
      undefined,
      tables,
      85,
    )
    expect(formatWeaponDamageFormulaLines(ethCrystalSword, false)).toEqual([
      '基础白字: 5~15 | 公式: ⌊5~15⌋×1.5 × (1+15%) = 8~25',
    ])
    expect(formatWeaponDamageFormulaLines(ethCrystalSword, true)).toEqual([
      'Base White: 5~15 | Formula: ⌊5~15⌋×1.5 × (1+15%) = 8~25',
    ])

    // 4. Ethereal Winged Harpoon ('7ts', throw base 11~77, 1H base 27~35, ethereal, +200% ED, +10 Min, +20 Max)
    const ethHarpoon = onlineItemDataToUiInventoryItem(
      {
        id: 7006,
        code: '7ts',
        quality: 6, // Rare
        identified: true,
        ethereal: true,
        stats: [
          { statId: 17, param: 0, value: 200 },
          { statId: 21, param: 0, value: 10 },
          { statId: 159, param: 0, value: 10 },
          { statId: 22, param: 0, value: 20 },
          { statId: 160, param: 0, value: 20 },
        ],
      },
      undefined,
      tables,
      85,
    )
    expect(formatWeaponDamageFormulaLines(ethHarpoon, false)).toEqual([
      '投掷白字: 11~77 | 公式: ⌊11~77⌋×1.5 × (1+200%) + (10~20) = 58~365',
      '单手白字: 27~35 | 公式: ⌊27~35⌋×1.5 × (1+200%) + (10~20) = 130~176',
    ])
    expect(formatWeaponDamageFormulaLines(ethHarpoon, true)).toEqual([
      'Throw Base: 11~77 | Formula: ⌊11~77⌋×1.5 × (1+200%) + (10~20) = 58~365',
      '1H Base: 27~35 | Formula: ⌊27~35⌋×1.5 × (1+200%) + (10~20) = 130~176',
    ])

    // 5. Phase Blade ('7cr', base 31~35) with Fool's (+40 Max/lvl) & Grinding (+60% Max ED/lvl) at clvl 80
    const phaseBlade = onlineItemDataToUiInventoryItem(
      {
        id: 7007,
        code: '7cr',
        quality: 4,
        identified: true,
        stats: [
          { statId: 218, param: 0, value: 4 },
          { statId: 219, param: 0, value: 6 },
        ],
      },
      undefined,
      tables,
      80,
    )
    expect(formatWeaponDamageFormulaLines(phaseBlade, false)).toEqual([
      '基础白字: 31~35 | 公式: 31~35 × (1+0%~60%) + (0~40) = 31~96',
    ])
    expect(formatWeaponDamageFormulaLines(phaseBlade, true)).toEqual([
      'Base White: 31~35 | Formula: 31~35 × (1+0%~60%) + (0~40) = 31~96',
    ])

    // 6. WorldPanelsHud.drawItemTooltip renders formula line when showWeaponDamageFormula=true and omits it when false
    const worldPanels = new WorldPanelsHud()
    worldPanels.lang = 'CHI'
    const ctx = createMockCanvasCtx()
    const font = createMockFont()

    worldPanels.showWeaponDamageFormula = false
    worldPanels.drawItemTooltip(ctx, { item: ikMaul, x: 200, y: 200 }, font)
    expect(font.drawText).not.toHaveBeenCalledWith(
      ctx,
      '基础白字: 77~106 | 公式: 77~106 × (1+300%) = 308~424',
      expect.any(Number),
      expect.any(Number),
      expect.anything(),
    )

    vi.clearAllMocks()
    worldPanels.showWeaponDamageFormula = true
    worldPanels.drawItemTooltip(ctx, { item: ikMaul, x: 200, y: 200 }, font)
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '基础白字: 77~106 | 公式: 77~106 × (1+300%) = 308~424',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ color: 'gray', font: 'font16' }),
    )
  })

  it('displays character-sheet damage hover formula for weapon attacks (with party aura & gear %ED) and spells (base, synergy, mastery, equip +spell damage %)', () => {
    // 1. Barbarian Concentrate (#144) with Immortal King Stone Crusher (308~424), +10~20 charm flat,
    //    Str 200 (110% StrBonus -> +220%), Mace Mastery +100%, Skill +150%, Fortitude Armor +300% Gear ED,
    //    Party Might/Fanaticism Aura +200% Aura ED, +50~100 Fire Damage -> total +970% ED
    //    Phys = floor((318~444) * (1+970%)) = 3402~4750, + Fire 50~100 = 3452~4850
    const panel = new CharacterSheetPanel()
    panel.visible = true
    panel.lang = 'CHI'
    panel.attrs = {
      ...panel.attrs,
      leftSkillName: '专心',
      leftSkillDmg: '3452-4850',
      leftDamageFormula: {
        kind: 'weapon',
        weaponMin: 308,
        weaponMax: 424,
        offWeaponFlatMin: 10,
        offWeaponFlatMax: 20,
        physBaseMin: 318,
        physBaseMax: 444,
        strEdPct: 220,
        dexEdPct: 0,
        masteryEdPct: 100,
        skillEdPct: 150,
        gearEdPct: 300,
        auraEdPct: 200,
        totalMinEdPct: 970,
        totalMaxEdPct: 970,
        skillPhysMin: 0,
        skillPhysMax: 0,
        srcDam: 128,
        magicConversionPct: 0,
        physMin: 3402,
        physMax: 4750,
        fireMin: 50,
        fireMax: 100,
        coldMin: 0,
        coldMax: 0,
        lightMin: 0,
        lightMax: 0,
        magicMin: 0,
        magicMax: 0,
        poisonMin: 0,
        poisonMax: 0,
        finalMin: 3452,
        finalMax: 4850,
      },
    }

    const leftLinesZh = formatCharacterDamageTooltipLines('left', panel.attrs, 'CHI').map((l) => l.text)
    expect(leftLinesZh).toEqual([
      '专心 伤害',
      '武器伤害基底: 308~424 | 装备点伤: +10~20 (物理基底 318~444)',
      '物理增伤 (+970%): 力量 +220% + 支配 +100% + 技能 +150% + 防具 +300% + 光环 +200%',
      '元素/魔法附加: 火焰 50~100',
      '公式: (308~424 + 10~20) × (1+970%) + (50~100) = 3452~4850',
    ])

    panel.attrs.leftSkillName = 'Concentrate'
    const leftLinesEn = formatCharacterDamageTooltipLines('left', panel.attrs, 'ENG').map((l) => l.text)
    expect(leftLinesEn).toEqual([
      'Concentrate Damage',
      'Weapon Base: 308~424 | Off-Weapon Flat: +10~20 (Phys Base 318~444)',
      'Phys %ED (+970%): Str +220% + Mastery +100% + Skill +150% + Gear +300% + Aura +200%',
      'Elemental/Magic: Fire 50~100',
      'Formula: (308~424 + 10~20) × (1+970%) + (50~100) = 3452~4850',
    ])

    // 2. End-to-end World + HudModel sync for Sorceress Fire Ball (#47) with Fire Bolt (#36) synergy,
    //    Fire Mastery (#61), and Eschuta's Temper / Rainbow Facet (+20% Fire Skill Damage, stat 329)
    const world = new ClientWorld()
    world.selfId = 1
    ;(world.self as any).charClass = 1 // Sorceress ('sor')
    ;(world.self as any).level = 80
    ;(world.self as any).leftSkill = 47 // Fire Ball
    ;(world.self as any).rightSkill = 59 // Blizzard
    ;(world.self as any).stats.set(12, 80)
    ;(world.self as any).skillEntries.set(47, { skillId: 47, level: 20, baseLevel: 20, bonus: 0 }) // Fire Ball lvl 20 (base 227~257)
    ;(world.self as any).skillEntries.set(36, { skillId: 36, level: 20, baseLevel: 20, bonus: 0 }) // Fire Bolt 20 hard (+280% synergy -> 862~976)
    ;(world.self as any).skillEntries.set(61, { skillId: 61, level: 20, baseLevel: 20, bonus: 0 }) // Fire Mastery lvl 20 (+163%)
    ;(world.self as any).skillEntries.set(59, { skillId: 59, level: 20, baseLevel: 20, bonus: 0 }) // Blizzard lvl 20

    // Equip an armor with +20% to Fire Skill Damage (stat 329) and +15% to Cold Skill Damage (stat 331)
    const ormusRobes = {
      id: 9001,
      code: 'uui',
      name: "Ormus' Robes",
      quality: 7,
      identified: true,
      defense: 400,
      container: 'equipped',
      bodyLoc: 3,
      equippedSlot: 3,
      stats: [
        { statId: 329, param: 0, value: 20 },
        { statId: 331, param: 0, value: 15 },
      ],
      flags: { identified: true },
    } as any
    ;(world.containers.equipment as Map<number, any>).set(ormusRobes.id, ormusRobes)
    ;(world.containers.equipmentBySlot as Map<number, any>).set(3, ormusRobes)

    const hud = new HudManager()
    const model = new HudModel({ world, hudManager: hud })
    model.syncFromWorld()

    // Fire Ball: base 200~227, synergy +280% -> 760~862, Mastery +163% + Equip +20% = +183% -> floor(760~862 * 2.83) = 2150~2439
    const fbLinesZh = formatCharacterDamageTooltipLines('left', hud.charSheet.attrs, 'CHI').map((l) => l.text)
    expect(fbLinesZh).toEqual([
      '火球 伤害',
      '技能基础伤害: 200~227',
      '技能协同增伤: +280% (→ 760~862)',
      '法术增伤 (+183%): 法术精通 +163% + 装备法伤 +20%',
      '公式: ⌊200~227 × (1+280%)⌋ × (1+183%) = 2150~2439',
    ])
    const fbLinesEn = formatCharacterDamageTooltipLines('left', hud.charSheet.attrs, 'ENG').map((l) => l.text)
    expect(fbLinesEn).toEqual([
      'Fire Ball Damage',
      'Skill Base Damage: 200~227',
      'Synergy Bonus: +280% (→ 760~862)',
      'Spell Bonus (+183%): Mastery +163% + Equip +20%',
      'Formula: ⌊200~227 × (1+280%)⌋ × (1+183%) = 2150~2439',
    ])

    // 3. Hovering DAMAGE_ROW_BOUNDS.left / DAMAGE_ROW_BOUNDS.right triggers drawDamageTooltip when enabled
    const ctx = createMockCanvasCtx()
    const font = createMockFont()
    hud.charSheet.visible = true
    hud.setHudEnhancements({ showWeaponDamageFormula: false })
    hud.charSheet.handleMouseMove(DAMAGE_ROW_BOUNDS.left.x + 10, DAMAGE_ROW_BOUNDS.left.y + 10)
    expect(hud.charSheet.hoveredDamageHand).toBeNull()

    hud.setHudEnhancements({ showWeaponDamageFormula: true })
    hud.charSheet.handleMouseMove(DAMAGE_ROW_BOUNDS.left.x + 10, DAMAGE_ROW_BOUNDS.left.y + 10)
    expect(hud.charSheet.hoveredDamageHand).toBe('left')
    hud.charSheet.drawDamageTooltip(ctx, font)
    expect(ctx.fillRect).toHaveBeenCalled()
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '公式: ⌊200~227 × (1+280%)⌋ × (1+183%) = 2150~2439',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ color: 'gold', font: 'font8' }),
    )

    hud.charSheet.handleMouseMove(DAMAGE_ROW_BOUNDS.right.x + 10, DAMAGE_ROW_BOUNDS.right.y + 10)
    expect(hud.charSheet.hoveredDamageHand).toBe('right')
  })

  it('renders the Diablo-styled (?) button next to Close and toggles the Advanced Character Stats overlay with breakpoints', () => {
    const panel = new CharacterSheetPanel()
    panel.visible = true
    panel.lang = 'ENG'
    panel.classCode = 'pal'
    panel.showAdvancedStatsButton = true
    panel.attrs = {
      ...panel.attrs,
      name: 'Jads',
      level: 85,
      dex: 175,
      uncappedFireRes: 108,
      maxFireRes: 83,
      uncappedColdRes: 86,
      maxColdRes: 75,
      uncappedLightRes: 136,
      maxLightRes: 83,
      uncappedPoisonRes: 48,
      maxPoisonRes: 75,
      poisonLengthPct: 200,
      curseRes: 0,
      maxCurseRes: 50,
      curseLengthPct: 50,
      drFlat: 7,
      drPct: 10,
      mdrFlat: 6,
      mdrPct: 0,
      atdPhys: 47,
      atdLight: 0,
      firePiercePct: 28,
      baseArDex: 875,
      baseArEquip: 877,
      baseDefDex: 44,
      baseDefEquip: 2580,
      baseDmg1hMin: 261,
      baseDmg1hMax: 517,
      baseDmg2hMin: 15,
      baseDmg2hMax: 220,
      fcr: 25,
      fbr: 18,
      fhr: 30,
      frw: 25,
      arPct: 116,
      ias: 40,
      rightSkillId: 106, // Zeal
      weaponClass: '1hs',
      weaponWsm: -16,
      skillEias: 0,
      lifeLeech: 13,
      manaLeech: 8,
      addedColdMin: 4,
      addedColdMax: 8,
      addedLightMin: 76,
      addedLightMax: 592,
      addedPoisonMin: 171,
      addedPoisonMax: 171,
      addedPoisonSec: 4.0,
      magicFind: 77,
      goldFind: 151,
      stashGold: 1363259,
    }

    // Verify FCR, FHR, and IAS breakpoints match Paladin Zeal reference
    expect(computeFcrBreakpoints('pal', panel.attrs)).toEqual([9, 18, 30, 48, 75, 125])
    expect(computeFhrBreakpoints('pal', panel.attrs)).toEqual([7, 15, 27, 48, 86, 200])
    const iasRes = computeIasBreakpoints('pal', panel.attrs)
    expect(iasRes.isAttack).toBe(true)
    expect(iasRes.entries.map((e) => e.ias)).toEqual([0, 2, 10, 26, 32, 48, 89, 117])
    expect(iasRes.entries[iasRes.activeIndex]).toEqual({ ias: 32, frames: '6|5|9' })

    // Hovering the `?` button sets hoveredElement = 'advStats' and formats tooltip
    const btnCenterX = CHAR_ADV_STATS_BTN_BOUNDS.x + 16
    const btnCenterY = CHAR_ADV_STATS_BTN_BOUNDS.y + 16
    panel.handleMouseMove(btnCenterX, btnCenterY)
    expect(panel.hoveredElement).toBe('advStats')
    expect(panel.formatVanillaHoverTooltipLines()).toEqual(['Advanced Stats'])

    // Clicking the `?` button toggles `advancedStatsOpen` on
    expect(panel.advancedStatsOpen).toBe(false)
    expect(panel.handleMouseDown(btnCenterX, btnCenterY)).toBe(true)
    expect(panel.handleMouseUp(btnCenterX, btnCenterY)).toBe(true)
    expect(panel.advancedStatsOpen).toBe(true)

    const ctx = createMockCanvasCtx()
    const font = createMockFont()
    const runtime = {
      hp: 1500,
      maxHp: 1500,
      mana: 400,
      maxMana: 400,
      stamina: 500,
      maxStamina: 500,
      leftSkillDmg: '1000-2000',
      rightSkillDmg: '1000-2000',
    }
    const mockCharSheetImg = {} as HTMLImageElement
    const mockQuestLastImg = {} as HTMLImageElement
    panel.draw(
      ctx,
      runtime,
      {
        borderLeftImg: null,
        charSheetImg: mockCharSheetImg,
        levelBtnImg: null,
        buySellBtnImg: null,
        questLastImg: mockQuestLastImg,
      },
      font,
    )

    // Verify sunken socket from charSheetImg and depressed frame 1 of questLastImg were drawn
    expect(ctx.drawImage).toHaveBeenCalledWith(
      mockCharSheetImg,
      126,
      386,
      36,
      36,
      CHAR_ADV_STATS_BTN_BOUNDS.x - 2,
      CHAR_ADV_STATS_BTN_BOUNDS.y - 2,
      36,
      36,
    )
    expect(ctx.drawImage).toHaveBeenCalledWith(
      mockQuestLastImg,
      30,
      0,
      30,
      30,
      CHAR_ADV_STATS_BTN_BOUNDS.x + 1,
      CHAR_ADV_STATS_BTN_BOUNDS.y + 1,
      30,
      30,
    )
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '108',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font6', color: 'red' }),
    )
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '18',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font6', color: 'orange' }),
    )
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '27',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font6', color: 'orange' }),
    )
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '32 (6|5|9)',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font6', color: 'orange' }),
    )
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '171-171 over 4.0s',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font6', color: 'green' }),
    )
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '1363259',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font6', color: 'yellow' }),
    )

    // Clicking the button again closes the overlay and draws raised frame 0
    expect(panel.handleMouseDown(btnCenterX, btnCenterY)).toBe(true)
    expect(panel.handleMouseUp(btnCenterX, btnCenterY)).toBe(true)
    expect(panel.advancedStatsOpen).toBe(false)
    ;(ctx.drawImage as ReturnType<typeof vi.fn>).mockClear()
    panel.draw(
      ctx,
      runtime,
      {
        borderLeftImg: null,
        charSheetImg: mockCharSheetImg,
        levelBtnImg: null,
        buySellBtnImg: null,
        questLastImg: mockQuestLastImg,
      },
      font,
    )
    expect(ctx.drawImage).toHaveBeenCalledWith(
      mockQuestLastImg,
      0,
      0,
      30,
      30,
      CHAR_ADV_STATS_BTN_BOUNDS.x + 1,
      CHAR_ADV_STATS_BTN_BOUNDS.y + 1,
      30,
      30,
    )
  })

  it('renders rune hover tooltips with (#N) when showRuneNumbers is enabled and preserves full Chinese rune names without degrading to bare 符文 (#1403)', () => {
    const hud = new HudManager()
    const ctx = createMockCanvasCtx()
    const font = createMockFont()

    const starterLoRune = {
      id: 'stash-r-lo',
      code: 'r28',
      invFile: 'invrlo',
      name: 'Lo Rune',
      nameZh: '罗 (Lo 符文)',
      baseNameZh: '符文 (#28)',
      quality: 'rune' as const,
      invWidth: 1,
      invHeight: 1,
      allowedSlots: [],
      reqLevel: 59,
      stats: [{ text: '可镶嵌进有凹槽的装备', color: 'white' as const }],
    }

    // 1. Default vanilla (showRuneNumbers = false) -> 罗符文 (CHI) & Lo Rune (ENG)
    expect(hud.worldPanels.showRuneNumbers).toBe(false)
    hud.worldPanels.lang = 'CHI'
    hud.worldPanels.drawItemTooltip(ctx, { item: starterLoRune, x: 200, y: 200 }, font)
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '罗符文',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font16', color: 'gold' }),
    )

    vi.clearAllMocks()
    hud.worldPanels.lang = 'ENG'
    hud.worldPanels.drawItemTooltip(ctx, { item: starterLoRune, x: 200, y: 200 }, font)
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      'Lo Rune',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font16', color: 'gold' }),
    )

    // 2. Enable showRuneNumbers via HudManager -> 罗符文 (#28) (CHI) & Lo Rune (#28) (ENG)
    hud.setHudEnhancements({ showRuneNumbers: true })
    expect(hud.worldPanels.showRuneNumbers).toBe(true)

    vi.clearAllMocks()
    hud.worldPanels.lang = 'CHI'
    hud.worldPanels.drawItemTooltip(ctx, { item: starterLoRune, x: 200, y: 200 }, font)
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '罗符文 (#28)',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font16', color: 'gold' }),
    )

    vi.clearAllMocks()
    hud.worldPanels.lang = 'ENG'
    hud.worldPanels.drawItemTooltip(ctx, { item: starterLoRune, x: 200, y: 200 }, font)
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      'Lo Rune (#28)',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font16', color: 'gold' }),
    )

    // 3. Edge cases: bare '符文', '符文 (#28)', '符文：夏' (r13), or compact packet with identified: false
    const degradedLoRune = {
      ...starterLoRune,
      nameZh: '符文 (#28)',
      identified: false,
    }
    vi.clearAllMocks()
    hud.worldPanels.lang = 'CHI'
    hud.setHudEnhancements({ showRuneNumbers: false })
    hud.worldPanels.drawItemTooltip(ctx, { item: degradedLoRune, x: 200, y: 200 }, font)
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '罗符文',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font16', color: 'gold' }),
    )

    const onlineShaelRune = onlineItemDataToUiInventoryItem({
      id: 901,
      code: 'r13',
      quality: 2,
      compact: true,
      identified: false,
    })
    vi.clearAllMocks()
    hud.setHudEnhancements({ showRuneNumbers: true })
    hud.worldPanels.lang = 'CHI'
    hud.worldPanels.drawItemTooltip(ctx, { item: onlineShaelRune, x: 200, y: 200 }, font)
    expect(font.drawText).toHaveBeenCalledWith(
      ctx,
      '夏符文 (#13)',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ font: 'font16', color: 'gold' }),
    )
  })
})

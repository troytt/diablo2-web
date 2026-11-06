import { describe, expect, it, vi } from 'vitest'
import {
  resolveNpcIntroStringId113c,
  resolveNpcSpeechSoundId113c,
} from '../../src/common/audio/npc-speech-113c.ts'
import { resolveNpcIntroMsgIdByTblKey } from '../../src/common/data/canonical-npc-dialog-table.ts'
import {
  isObjectInInteractRange113c,
  isObjectSelectableInMode,
  resolveObjectDisplayName,
} from '../../src/common/world/objects-meta.ts'
import { OBJECTS_TXT_113C } from '../../src/common/world/objects-txt-113c.ts'
import { GlobesHud } from '../../src/client/ui/globes.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { SkillTreePanel } from '../../src/client/ui/skill-tree-panel.ts'
import { ClientUnit } from '../../src/client/world/client-unit.ts'
import { tickObjectAnim } from '../../src/client/world/object-light.ts'
import { QuestLogState } from '../../src/client/world/quest-log-state.ts'
import type { D2FontRenderer } from '../../src/client/ui/font.ts'

describe('Screencast Gameplay Bug Fixes & Class-of-Bug Sweeps', () => {
  it('1. eliminates duplicate Simplified + Traditional Chinese damage lines in SkillTreePanel and HotkeysHud', () => {
    const panel = new SkillTreePanel('sor')
    panel.lang = 'CHI'
    panel.loadProfile(
      'sor',
      new Map([
        [62, 19],
        [56, 15],
        [59, 15],
        [64, 15],
        [51, 15],
      ]),
      0,
    )
    panel.bonusAllSkills = 5

    for (const skillId of [62, 56, 59, 64, 51]) {
      const vm = panel.getTooltipViewModel(skillId)!
      const lines = SkillTreePanel.formatSkillTooltipLines(vm, 'CHI')
      const drawnTexts = lines.map((l) => l.text)
      for (const t of drawnTexts) {
        expect(t).not.toContain('伤害:')
      }
      expect(drawnTexts.filter((t) => t.includes('傷害')).length).toBeGreaterThanOrEqual(1)
    }

    const hud = new HudManager()
    hud.skillTree.loadProfile('sor', new Map([[62, 19]]), 0)
    hud.hotkeys.lang = 'CHI'
    const hkLines = hud.hotkeys.formatTooltipLines(62, 'right', false, 'CHI')
    const hkTexts = hkLines.map((l) => l.text)
    expect(hkTexts.some((t) => t.includes('伤害:'))).toBe(false)
    expect(hkTexts.some((t) => t.includes('持续'))).toBe(false)
    expect(hkTexts.filter((t) => t.includes('火焰傷害')).length).toBe(1)
  })

  it('2. hides Quest Alert icon immediately when opening Quest Log in alertState === 1 (0x6face940)', () => {
    const qlog = new QuestLogState()
    qlog.apply5D(1, 0, 2, 0, { denQuestWord: 0, playerDeadOrDying: false })
    expect(qlog.alertVisible).toBe(true)
    expect(qlog.alertState).toBe(1)

    qlog.openQuestLog(0)
    expect(qlog.questPanelOpen).toBe(true)
    expect(qlog.alertVisible).toBe(false)
    expect(qlog.alertPressed).toBe(false)
  })

  it('3. routes Left Skill button click before GlobesHud and renders Life/Mana above orb without dark box', () => {
    const hud = new HudManager()
    hud.setViewportProfile('800x600')

    // Clicking Left Skill button at (115, 565) must NOT pin Life globe text
    hud.handleClick(115, 565)
    expect(hud.globes.lifeTextPinned).toBe(false)

    // Clicking inside the Life orb circle at (69, 547) toggles lifeTextPinned
    hud.handleClick(69, 547)
    expect(hud.globes.lifeTextPinned).toBe(true)

    const globes = new GlobesHud()
    globes.lifeTextPinned = true
    globes.manaTextPinned = true
    const fillRectSpy = vi.fn()
    const drawTextSpy = vi.fn()
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn(),
      fillRect: fillRectSpy,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D
    const font = {
      drawText: drawTextSpy,
      measureText: vi.fn(() => 64),
    } as unknown as D2FontRenderer

    globes.draw(
      ctx,
      { hp: 562, maxHp: 726, mana: 526, maxMana: 526 },
      { lifeImg: null, manaImg: null, poisonImg: null, overlapLeftImg: null, overlapRightImg: null },
      font,
    )
    expect(fillRectSpy).not.toHaveBeenCalled()
    expect(drawTextSpy).toHaveBeenCalledWith(
      ctx,
      expect.stringContaining('562 / 726'),
      expect.any(Number),
      505,
      expect.objectContaining({ font: 'font16', shadow: true }),
    )
    expect(drawTextSpy).toHaveBeenCalledWith(
      ctx,
      expect.stringContaining('526 / 526'),
      expect.any(Number),
      505,
      expect.objectContaining({ font: 'font16', shadow: true }),
    )
  })

  it('4. maps non-town quest NPCs (Izual 406, Tyrael1 251, Tyrael3 521, Drehya 527, Ancients 537..539) to authentic 1.13c speech & text', () => {
    expect(resolveNpcIntroStringId113c(406, 3)).toBe(675) // A4Q1SuccessfulIzual
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 406, topic: 'intro', act: 3 })).toBe(4042)
    expect(resolveNpcIntroMsgIdByTblKey('A4Q1SuccessfulIzual')).toBe(675)

    expect(resolveNpcIntroStringId113c(251, 1)).toBe(302) // TyraelGossip1
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 251, topic: 'intro', act: 1 })).toBe(4309)

    expect(resolveNpcIntroStringId113c(521, 4)).toBe(20175) // A5Q6SuccessfulTyrael
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 521, topic: 'intro', act: 4 })).toBe(4611)

    expect(resolveNpcIntroStringId113c(527, 4)).toBe(20131) // A5Q3FoundAnyaAnya
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 527, topic: 'intro', act: 4 })).toBe(4406)

    expect(resolveNpcIntroStringId113c(537, 4)).toBe(20169) // A5Q6InitAncients
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 537, topic: 'intro', act: 4 })).toBe(4379)

    // Non-talk artisans Jamella (405) and Halbu (257) have no copied talk rows
    expect(resolveNpcIntroStringId113c(405, 3)).toBeUndefined()
    expect(resolveNpcIntroStringId113c(257, 3)).toBeUndefined()
  })

  it('5. makes Red Portals (565, 566, 563, 569) selectable across modes 0..2, auto-promotes FrameCnt0=0 objects to mode 2, and allows adjacent interaction', () => {
    for (const cid of [59, 60, 342, 563, 565, 566, 569]) {
      expect(isObjectSelectableInMode(cid, 0)).toBe(true)
      expect(isObjectSelectableInMode(cid, 1)).toBe(true)
      expect(isObjectSelectableInMode(cid, 2)).toBe(true)
    }

    expect(resolveObjectDisplayName(565, 0)?.nameZh).toBe('毀滅之終結')
    expect(resolveObjectDisplayName(566, 0)?.nameZh).toBe('哈洛加斯')

    // LastPortal (565) and Zoo (566) have SizeX=0, SizeY=0 in Objects.txt; adjacent subtile (dx=2, dy=1) is in range
    expect(isObjectInInteractRange113c(102, 101, 2, 100, 100, 565)).toBe(true)
    expect(isObjectInInteractRange113c(102, 101, 2, 100, 100, 566)).toBe(true)

    // tickObjectAnim promotes mode=0 object with FrameCnt0=0 (565, 566) to mode=2
    const unit = new ClientUnit({ unitType: 2, id: 99, classId: 565, x: 100, y: 100, mode: 0 })
    tickObjectAnim(unit, OBJECTS_TXT_113C[565]!, 1040)
    expect(unit.mode).toBe(2)
  })
})

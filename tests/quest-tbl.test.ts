/**
 * Diablo II v1.13c Quest TBL Parity & Dynamic Resolution Tests (Issue #381).
 *
 * Verifies:
 * 1. All 27 canonical Diablo II quests across Acts 1..5 match Blizzard's
 *    string.tbl / expansionstring.tbl / patchstring.tbl keys and metadata.
 * 2. WorldPanelsHud dynamic TBL lookup and string table chain resolution.
 * 3. Fallback resolution when TBL archives are not mounted.
 * 4. Multi-stage objective directives and completion speech rendering.
 * 5. Quest parchment layout bounds and text wrapping within 1.13c UI sockets.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  CANONICAL_QUEST_DATA,
  CANONICAL_QUEST_BY_ID,
  CANONICAL_QUESTS_BY_ACT,
} from '../src/common/data/canonical-quest-data.ts'
import {
  WorldPanelsHud,
  ACT_QUESTS,
  ALL_QUESTS,
  type QuestEntry,
} from '../src/client/ui/world-panels.ts'
import { D2FontRenderer } from '../src/client/ui/font.ts'

describe('Diablo II v1.13c Quest TBL Ground Truth (Issue #381)', () => {
  it('contains exactly 27 canonical quests with authentic Blizzard 1.13c TBL keys', () => {
    expect(CANONICAL_QUEST_DATA.length).toBe(27)
    expect(ALL_QUESTS.length).toBe(27)

    // Act 1: 6, Act 2: 6, Act 3: 6, Act 4: 3, Act 5: 6
    expect(CANONICAL_QUESTS_BY_ACT[1]?.length).toBe(6)
    expect(CANONICAL_QUESTS_BY_ACT[2]?.length).toBe(6)
    expect(CANONICAL_QUESTS_BY_ACT[3]?.length).toBe(6)
    expect(CANONICAL_QUESTS_BY_ACT[4]?.length).toBe(3)
    expect(CANONICAL_QUESTS_BY_ACT[5]?.length).toBe(6)

    // Verify Blizzard 1.13c socket key ordering parity
    // Act 1: Cain is socket 2 (a1q3) -> qstsa1q4; Tools of Trade is socket 4 (a1q5) -> qstsa1q3
    const a1q1 = CANONICAL_QUEST_BY_ID['a1q1']!
    expect(a1q1.titleKey).toBe('qstsa1q1')
    expect(a1q1.objectiveKey).toBe('qstsa1q11')
    expect(a1q1.completedKey).toBe('A1Q1SuccessfulAkara')
    expect(a1q1.titleEn).toBe('Den of Evil')
    expect(a1q1.titleZh).toBe('邪惡洞穴')

    const a1q3 = CANONICAL_QUEST_BY_ID['a1q3']!
    expect(a1q3.titleKey).toBe('qstsa1q4') // Blizzard swapped qstsa1q3 and qstsa1q4
    expect(a1q3.titleEn).toBe('The Search for Cain')

    const a1q5 = CANONICAL_QUEST_BY_ID['a1q5']!
    expect(a1q5.titleKey).toBe('qstsa1q3') // Tools of the Trade
    expect(a1q5.titleEn).toBe('Tools of the Trade')

    // Act 3: Golden Bird (a3q1) -> qstsa3q4; Blade (a3q2) -> qstsa3q3; Khalim (a3q3) -> qstsa3q2; Lam Esen (a3q4) -> qstsa3q1
    const a3q1 = CANONICAL_QUEST_BY_ID['a3q1']!
    expect(a3q1.titleKey).toBe('qstsa3q4')
    expect(a3q1.titleEn).toBe('The Golden Bird')

    const a3q4 = CANONICAL_QUEST_BY_ID['a3q4']!
    expect(a3q4.titleKey).toBe('qstsa3q1')
    expect(a3q4.titleEn).toBe("Lam Esen's Tome")

    // Act 4: Fallen Angel -> qstsa4q1, Hell's Forge -> qstsa4q3, Terror's End -> qstsa4q2
    const a4q1 = CANONICAL_QUEST_BY_ID['a4q1']!
    expect(a4q1.titleKey).toBe('qstsa4q1')
    expect(a4q1.titleEn).toBe('The Fallen Angel')

    const a4q2 = CANONICAL_QUEST_BY_ID['a4q2']!
    expect(a4q2.titleKey).toBe('qstsa4q3')
    expect(a4q2.titleEn).toBe("Hell's Forge")

    const a4q3 = CANONICAL_QUEST_BY_ID['a4q3']!
    expect(a4q3.titleKey).toBe('qstsa4q2')
    expect(a4q3.titleEn).toBe("Terror's End")

    // Act 5: Siege (a5q1) -> qstsa5q1, Rescue (a5q2) -> qstsa5q2, Prison (a5q3) -> qstsa5q3,
    // Betrayal (a5q4) -> qstsa5q4, Rite (a5q5) -> qstsa5q5, Eve of Destruction (a5q6) -> qstsa5q6
    const a5q6 = CANONICAL_QUEST_BY_ID['a5q6']!
    expect(a5q6.titleKey).toBe('qstsa5q6')
    expect(a5q6.titleEn).toBe('Eve of Destruction')
  })

  it('provides multi-stage objective progression data for all 27 quests', () => {
    for (const q of CANONICAL_QUEST_DATA) {
      expect(q.stages.length).toBeGreaterThan(0)
      for (const stage of q.stages) {
        expect(stage.key).toBeTruthy()
        expect(stage.stage).toBeGreaterThan(0)
        expect(stage.textEn.length).toBeGreaterThan(0)
      }
    }
  })

  it('resolves quest display text using default fallback when no TBL is provided', () => {
    const hud = new WorldPanelsHud()
    const a1q1 = ACT_QUESTS[1]![0]!
    expect(a1q1.id).toBe('a1q1')

    // Neutral (server-not-ready): every quest starts locked
    expect(hud.getQuestDisplayText(a1q1).status).toBe('locked')

    // Server quest-flag block (0x29): word 1 = a1q1 (Den of Evil), bit 0 = completed
    const flags = new Uint16Array(48)
    flags[1] = 0x0001
    hud.applyServerQuestFlags(flags)
    const displayCompleted = hud.getQuestDisplayText(a1q1)
    expect(displayCompleted.status).toBe('completed')
    expect(displayCompleted.statusTag).toBe('[已完成]')
    expect(displayCompleted.title).toBe('邪惡洞穴')
    expect(displayCompleted.titleKey).toBe('qstsa1q1')
    expect(displayCompleted.body).toContain('清除')
    expect(displayCompleted.rewardText).toContain('技能点')

    // Toggle status to active
    hud.setQuestStatus('a1q1', 'active')
    const displayActive = hud.getQuestDisplayText(a1q1)
    expect(displayActive.status).toBe('active')
    expect(displayActive.statusTag).toBe('[进行中]')
    expect(displayActive.body).toContain('找尋一個洞穴')

    // Toggle status to locked
    hud.setQuestStatus('a1q1', 'locked')
    const displayLocked = hud.getQuestDisplayText(a1q1)
    expect(displayLocked.status).toBe('locked')
    expect(displayLocked.statusTag).toBe('[未开启]')
    expect(displayLocked.body).toContain('尚未开启')
  })

  it('dynamically resolves strings via setQuestTblLookup', () => {
    const hud = new WorldPanelsHud()
    const customTbl = new Map<string, string>([
      ['qstsa1q1', '洞穴肃清行动 (Custom TBL)'],
      ['qstsa1q11', '前往鲜血荒地消灭全部恶魔。'],
      ['A1Q1SuccessfulAkara', '感谢你，阿卡拉赐予你技能。'],
    ])

    hud.setQuestTblLookup(key => customTbl.get(key))

    const a1q1 = ACT_QUESTS[1]![0]!
    hud.setQuestStatus('a1q1', 'active')
    const display = hud.getQuestDisplayText(a1q1)

    expect(display.title).toBe('洞穴肃清行动 (Custom TBL)')
    expect(display.body).toBe('前往鲜血荒地消灭全部恶魔。')

    hud.setQuestStatus('a1q1', 'completed')
    const completedDisplay = hud.getQuestDisplayText(a1q1)
    expect(completedDisplay.body).toBe('感谢你，阿卡拉赐予你技能。')
  })

  it('dynamically resolves strings via setQuestStringTableChain', () => {
    const hud = new WorldPanelsHud()
    const fakeChain = {
      get(k: string) {
        if (k === 'qstsa2q1') return "Radament's Hideout"
        if (k === 'qstsa2q11') return 'Search the Sewers beneath Lut Gholein.'
        return undefined
      },
    }

    hud.setQuestStringTableChain(fakeChain)

    const a2q1 = ACT_QUESTS[2]![0]!
    hud.setQuestStatus('a2q1', 'active')
    const display = hud.getQuestDisplayText(a2q1)

    expect(display.title).toBe("Radament's Hideout")
    expect(display.body).toBe('Search the Sewers beneath Lut Gholein.')
  })

  it('renders the quest log parchment without overlapping bottom bezels', () => {
    const hud = new WorldPanelsHud()
    const font = new D2FontRenderer()

    const drawCalls: { text: string; x: number; y: number }[] = []
    const originalDrawText = font.drawText.bind(font)
    vi.spyOn(font, 'drawText').mockImplementation((ctx, text, x, y, opts) => {
      drawCalls.push({ text: String(text), x, y })
      return originalDrawText(ctx, text, x, y, opts)
    })

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D

    hud.selectedActTab = 1
    hud.selectedQuestIdx = 0

    // Render Quest Log Panel
    hud.drawLeftDockPanel(
      mockCtx,
      'quest',
      {
        borderLeftImg: null,
        questBgImg: null,
        waypointBgImg: null,
        stashBgImg: null,
        cubeBgImg: null,
        vendorBgImg: null,
        buySellBtnImg: null,
      },
      font,
    )

    // Parchment title should be drawn around oy + 282 (60 + 282 = 342)
    const titleCall = drawCalls.find(c => c.y === 60 + 282 && c.text.includes('洞穴'))
    expect(titleCall).toBeDefined()
    expect(titleCall!.y).toBe(60 + 282)

    // Body should start around oy + 300 (60 + 300 = 360)
    const bodyCall = drawCalls.find(c => c.y >= 60 + 300 && c.y <= 60 + 380)
    expect(bodyCall).toBeDefined()

    // No text should be drawn below oy + 380 into the close button zone
    const outOfBoundsCall = drawCalls.find(c => c.y > 60 + 380 && c.text.includes('洞穴'))
    expect(outOfBoundsCall).toBeUndefined()
  })
})

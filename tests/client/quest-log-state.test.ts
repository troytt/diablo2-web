import { describe, expect, it, vi } from 'vitest'
import {
  CANONICAL_QUESTS_BY_ACT,
  CANONICAL_QUEST_STATE_TABLES,
} from '../../src/common/data/canonical-quest-data.ts'
import { BAKED_UI_MANIFEST } from '../../src/common/items/baked-ui-meta.ts'
import { decode0x28QuestInfo, decode0x5DQuestStatus } from '../../src/netproto/d2gs/s2c/quest.ts'
import {
  QUEST_ICON_FILES_113C,
  QUEST_LOG_DESCRIPTORS,
  QUEST_LOG_ROW_COUNT,
  QuestLogState,
  buildQuestLogPage,
  questAlertHit,
  questAlertRect,
  questLogRowIndex,
} from '../../src/client/world/quest-log-state.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { D2FontRenderer } from '../../src/client/ui/font.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { WorldPanelsHud, getActQuests, questFlagWordIndex } from '../../src/client/ui/world-panels.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

describe('1.13c Quest Log State Machine, Packet Decoders & Quest Alert (UI 0x11)', () => {
  it('decodes S2C 0x28 with timer at +0x06 and 48 u16LE quest words at +0x07..+0x66', () => {
    const pkt = new Uint8Array(103)
    pkt[0] = 0x28
    pkt[1] = 6 // updateType = 6 (player quest sync)
    pkt[2] = 0x2a // unitId = 42
    pkt[6] = 0x7f // timer byte at +6
    // word[0] = 0x0001 at +7..+8, word[1] (Den of Evil) = 0x2002 at +9..+10
    pkt[7] = 0x01
    pkt[8] = 0x00
    pkt[9] = 0x02
    pkt[10] = 0x20

    const ev = decode0x28QuestInfo(pkt)
    expect(ev.type).toBe('QuestState')
    if (ev.type !== 'QuestState') return
    expect(ev.updateType).toBe(6)
    expect(ev.unitId).toBe(42)
    expect(ev.timer).toBe(0x7f)
    expect(ev.quests.length).toBe(48)
    expect(ev.quests[0]).toBe(0x0001)
    expect(ev.quests[1]).toBe(0x2002)

    const world = new ClientWorld()
    world.applyEvent(ev)
    expect(world.quests[1]).toBe(0x2002)

    // Non-6 updateType (e.g. trade quest snapshot updateType = 2) must not overwrite player quests
    const tradeEv = { ...ev, updateType: 2, quests: new Array<number>(48).fill(0xffff) }
    world.applyEvent(tradeEv)
    expect(world.quests[1]).toBe(0x2002)
  })

  it('decodes S2C 0x5D extra as signed i16LE and does not synthesize wantsInteractUnitId', () => {
    const pkt = new Uint8Array([0x5d, 0x26, 0x00, 0x04, 0xff, 0xff])
    const ev = decode0x5DQuestStatus(pkt)
    expect(ev).toEqual({
      type: 'QuestState',
      source: 0x5d,
      kind: 'status',
      questStatus: {
        questId: 0x26,
        alertFlags: 0x00,
        filterStatus: 0x04,
        extra: -1,
      },
      quests: new Uint16Array([0x26, 0x0400, 0xffff]),
    })
    expect('wantsInteractUnitId' in (ev as unknown as Record<string, unknown>)).toBe(false)
  })

  it('matches all 41 1.13c quest descriptor rows (0x6fba8188) against quest catalog and state tables', () => {
    expect(QUEST_LOG_DESCRIPTORS.length).toBe(QUEST_LOG_ROW_COUNT)
    expect(QUEST_ICON_FILES_113C.length).toBe(27)
    const tableIds = new Set(Object.keys(CANONICAL_QUEST_STATE_TABLES).map(Number))
    const seenB1 = new Set<number>()
    for (let row = 0; row < QUEST_LOG_ROW_COUNT; row++) {
      const desc = QUEST_LOG_DESCRIPTORS[row]!
      expect(desc.row).toBe(row)
      expect(desc.hasTable).toBe(tableIds.has(row))
      if (desc.hasTable) {
        expect(desc.b1).toBeGreaterThanOrEqual(0)
        expect(desc.b1).toBeLessThan(27)
        seenB1.add(desc.b1)
        expect(questLogRowIndex(desc.questId)).toBe(row)
        const actQuests = getActQuests(desc.act + 1)
        const questEntry = actQuests[desc.local]!
        expect(questFlagWordIndex(questEntry)).toBe(row)
        expect(questEntry.b1).toBe(desc.b1)
        expect(questEntry.iconKey).toBe(QUEST_ICON_FILES_113C[desc.b1])
      } else {
        expect(desc.b1).toBe(0xff)
      }
    }
    expect(seenB1.size).toBe(27)
    expect(questLogRowIndex(0)).toBe(-1)
    expect(questLogRowIndex(30)).toBe(34)
    expect(questLogRowIndex(36)).toBe(40)
    expect(questLogRowIndex(37)).toBe(0)
    expect(questLogRowIndex(41)).toBe(-1)
  })

  it('implements 0x5D alert state machine and Den flags & 0x20 counter', () => {
    const qlog = new QuestLogState()
    const aliveCtx = { denQuestWord: 0, playerDeadOrDying: false }

    // 1. Entering Den of Evil: 0x5D(q=1, flags=0, state=2, extra=0) while Quest Log closed
    qlog.apply5D(1, 0, 2, 0, aliveCtx)
    expect(qlog.alertVisible).toBe(true)
    expect(qlog.alertState).toBe(1)
    expect(qlog.highlights[0]).toBe(0)
    // Status byte is NOT written while Quest Log is closed (waits for C2S 0x40 -> S2C 0x52)
    expect(qlog.statusBytes[1]).toBe(0)

    // 2. Subsequent 0x5D while alertState === 1 and panel closed is dropped
    qlog.apply5D(2, 0, 3, 0, aliveCtx)
    expect(qlog.highlights[0]).toBe(0)
    expect(qlog.statusBytes[2]).toBe(0)

    // 3. Opening Quest Log selects highlighted quest; 0x52 copies statusBytes and consumes highlight
    expect(qlog.openQuestLog(0)).toBe(0)
    expect(qlog.questPanelOpen).toBe(true)

    const s52 = new Uint8Array(41)
    s52[1] = 2
    qlog.apply52(s52)
    expect(qlog.statusBytes[1]).toBe(2)
    expect(qlog.highlights[0]).toBe(-1)
    expect(qlog.selectRequest?.local).toBe(0)

    qlog.closeQuestLog()
    qlog.alertVisible = false
    expect(qlog.alertState).toBe(0)

    // 3b. 0x6facda90 icon-animation-flag fallback (#870-era omission): with no pending highlight,
    // openQuestLog / selectActTab / selectForActTab select the scan's first started, unfinished
    // quest; highlights stay untouched and the -1 result is kept when the scan finds nothing.
    const qlog2 = new QuestLogState()
    const scan = vi.fn(() => 2)
    expect(qlog2.openQuestLog(0, scan)).toBe(2)
    expect(scan).toHaveBeenCalledWith()
    expect(qlog2.highlights[0]).toBe(-1) // scan result is panel-level, not a highlight

    const qlog3 = new QuestLogState()
    qlog3.highlights[1] = 4 // pending alert highlight wins over the fallback scan
    const scan3 = vi.fn(() => 2)
    expect(qlog3.openQuestLog(1, scan3)).toBe(4)
    expect(scan3).not.toHaveBeenCalled()

    expect(new QuestLogState().selectForActTab(0, false, () => -1)).toBe(-1)
    expect(new QuestLogState().openQuestLog(0)).toBe(-1) // no scan -> native -1
    expect(new QuestLogState().selectActTab(2, () => 5)).toBe(5)

    qlog.closeQuestLog()
    qlog.alertVisible = false
    expect(qlog.alertState).toBe(0)

    // 4. Den counter (flags & 0x20): s16 = 4..1 updates statusBytes[1]=4 and den=s16 silently
    qlog.apply5D(1, 0x20, 4, 4, aliveCtx)
    expect(qlog.den).toBe(4)
    expect(qlog.statusBytes[1]).toBe(4)
    expect(qlog.alertVisible).toBe(false)
    expect(qlog.alertState).toBe(0)

    // s16 = 5 updates den=5 and runs the common path (pops Quest Alert)
    qlog.apply5D(1, 0x20, 4, 5, aliveCtx)
    expect(qlog.den).toBe(5)
    expect(qlog.alertVisible).toBe(true)
    expect(qlog.alertState).toBe(1)

    // s16 = 7 or -1 sets den = 666 and statusBytes[1] = 4
    qlog.reset()
    qlog.apply5D(1, 0x20, 4, 7, aliveCtx)
    expect(qlog.den).toBe(666)
    expect(qlog.statusBytes[1]).toBe(4)
    qlog.apply5D(1, 0x20, 4, -1, aliveCtx)
    expect(qlog.den).toBe(666)

    // Ignored when Den quest word has bit 0 or bit 1 set
    qlog.reset()
    qlog.apply5D(1, 0x20, 4, 3, { denQuestWord: 0x0001, playerDeadOrDying: false })
    expect(qlog.den).toBe(0)
    qlog.apply5D(1, 0x20, 4, 3, { denQuestWord: 0x0002, playerDeadOrDying: false })
    expect(qlog.den).toBe(0)

    // 5. flags === 0x10 returns early without popping Quest Alert
    qlog.reset()
    qlog.apply5D(0x0a, 0x10, 0, 0, aliveCtx)
    expect(qlog.alertVisible).toBe(false)
    qlog.reset()
    qlog.apply5D(0x21, 0x10, 0, 0x1234, aliveCtx)
    expect(qlog.alertVisible).toBe(false)

    // 6. S2C 0x50 type === 1 updates den, tombOffset, barbs
    qlog.apply50([1, 3, 2, 10])
    expect(qlog.den).toBe(3)
    expect(qlog.tombOffset).toBe(2)
    expect(qlog.barbs).toBe(10)
    qlog.apply50([36, 9, 9, 9])
    expect(qlog.den).toBe(3)
  })

  it('builds 1.13c Quest Log pages (0x6facce00) for Den of Evil across active, count, turn-in, and complete states', () => {
    const wp = new WorldPanelsHud()
    const quests = new Uint16Array(48)
    const gameQuests = new Uint16Array(48)
    const statusBytes = new Uint8Array(41)

    // s=4, den=3 -> Monsters remaining: 3 / 剩下的怪物： 3 (with trailing space after colon)
    quests[1] = 0x0004
    statusBytes[1] = 4
    wp.applyServerQuestState({
      quests,
      gameQuests,
      questStatusBytes: statusBytes,
      denMonstersRemaining: 3,
      questBarbsRemaining: 0,
    })
    const denQuest = getActQuests(1)[0]!
    wp.lang = 'ENG'
    expect(wp.getQuestDisplayText(denQuest).body).toBe('Monsters remaining: 3')
    wp.lang = 'CHI'
    expect(wp.getQuestDisplayText(denQuest).body).toBe('剩下的怪物： 3')

    // s=4, den=1 -> One monster left.
    wp.applyServerQuestState({
      quests,
      gameQuests,
      questStatusBytes: statusBytes,
      denMonstersRemaining: 1,
      questBarbsRemaining: 0,
    })
    wp.lang = 'ENG'
    expect(wp.getQuestDisplayText(denQuest).body).toBe('One monster left.')

    // s=3, den=3 -> appends bare number
    statusBytes[1] = 3
    wp.applyServerQuestState({
      quests,
      gameQuests,
      questStatusBytes: statusBytes,
      denMonstersRemaining: 3,
      questBarbsRemaining: 0,
    })
    const pageS3 = buildQuestLogPage({
      row: 1,
      playerWords: quests,
      gameWords: gameQuests,
      status: 3,
      den: 3,
      barbs: 0,
    })
    expect(pageS3?.text).toEqual({
      kind: 'appendCount',
      key: '',
      count: 3,
    })
    expect(wp.getQuestDisplayText(denQuest).body).toBe('3')

    // B && !A && C (0x2002): Return to Akara for a reward.
    quests[1] = 0x2002
    statusBytes[1] = 0
    wp.applyServerQuestState({
      quests,
      gameQuests,
      questStatusBytes: statusBytes,
      denMonstersRemaining: 0,
      questBarbsRemaining: 0,
    })
    expect(wp.getQuestDisplayText(denQuest).body).toBe('Return to Akara for a reward.')
    expect(wp.getQuestSpeechKey(denQuest)).toBe('A1Q1InitAkara')

    // B && A (0x2001): Quest completed.
    quests[1] = 0x2001
    wp.applyServerQuestState({
      quests,
      gameQuests,
      questStatusBytes: statusBytes,
      denMonstersRemaining: 0,
      questBarbsRemaining: 0,
    })
    expect(wp.getQuestDisplayText(denQuest).body).toBe('Quest completed.')
    expect(wp.getQuestSpeechKey(denQuest)).toBe('A1Q1SuccessfulAkara')

    // !B && A (0x0001): You completed this quest in a previous game.
    quests[1] = 0x0001
    wp.applyServerQuestState({
      quests,
      gameQuests,
      questStatusBytes: statusBytes,
      denMonstersRemaining: 0,
      questBarbsRemaining: 0,
    })
    expect(wp.getQuestDisplayText(denQuest).body).toBe('You completed this quest in a previous game.')
    expect(wp.getQuestSpeechKey(denQuest)).toBe('A1Q1SuccessfulAkara')
  })

  it('computes exact 1.13c Quest Alert rectangles and strict-inequality hit-testing across 640x480 and 800x600', () => {
    const r800e0 = questAlertRect(800, 0, false)
    expect(r800e0).toEqual({ entryIndex: 0, x1: 40, y1: 460, x2: 75, y2: 495, yText: 457 })
    expect(questAlertHit(r800e0, 40, 470)).toBe(false)
    expect(questAlertHit(r800e0, 41, 461)).toBe(true)
    expect(questAlertHit(r800e0, 74, 494)).toBe(true)
    expect(questAlertHit(r800e0, 75, 470)).toBe(false)

    const r800mode2 = questAlertRect(800, 2, false)
    expect(r800mode2).toEqual({ entryIndex: 1, x1: 440, y1: 460, x2: 475, y2: 495, yText: 457 })

    expect(questAlertRect(640, 0, false)).toEqual({
      entryIndex: 2,
      x1: 40,
      y1: 285,
      x2: 75,
      y2: 320,
      yText: 282,
    })
    expect(questAlertRect(640, 2, false)).toEqual({
      entryIndex: 3,
      x1: 360,
      y1: 285,
      x2: 395,
      y2: 320,
      yText: 282,
    })
    expect(questAlertRect(640, 2, true)).toEqual({
      entryIndex: 1,
      x1: 360,
      y1: 340,
      x2: 395,
      y2: 375,
      yText: 337,
    })
  })

  it('wires Quest Alert button press/release, RequestQuestData (0x40), and player death in HudManager + HudModel', () => {
    const world = new ClientWorld()
    const hud = new HudManager()
    hud.lang = 'ENG'
    const commands: ClientCommand[] = []
    const model = new HudModel({
      world,
      hudManager: hud,
      onCommand: (cmd) => commands.push(cmd),
    })

    // Enter Den of Evil: S2C 0x5D (q=1, flags=0, state=2)
    world.applyEvent(decode0x5DQuestStatus(new Uint8Array([0x5d, 1, 0, 2, 0, 0])))

    expect(hud.getQuestAlertBarLocalRect()).toEqual({
      entryIndex: 0,
      x1: 40,
      y1: 460,
      x2: 75,
      y2: 495,
      yText: 457,
    })
    expect(hud.isPointInterceptedByHud(55, 475)).toBe(true)

    // Press inside Quest Alert button -> arms alertPressed
    hud.handleClick(55, 475, 0)
    expect(world.questLog.alertPressed).toBe(true)
    expect(hud.leftPanel).toBe('none')

    // Release inside Quest Alert button -> opens Quest Log, selects A1Q1 (index 0), sends C2S 0x40 RequestQuestData
    hud.handleHudMouseUp(55, 475, 0)
    expect(hud.leftPanel).toBe('quest')
    expect(hud.worldPanels.selectedQuestIdx).toBe(0)
    expect(world.questLog.alertVisible).toBe(false)
    expect(commands.some((c) => c.type === 'RequestQuestData')).toBe(true)

    // Server replies with S2C 0x52 (statusBytes[1] = 2 -> qstsa1q12 "Kill all the monsters in the Den.")
    const status52 = new Array<number>(41).fill(0)
    status52[1] = 2
    world.applyEvent({
      type: 'QuestState',
      source: 0x52,
      flags: status52,
    })
    const denQuest = getActQuests(1)[0]!
    expect(hud.worldPanels.getQuestDisplayText(denQuest).body).toBe('Kill all the monsters in the Den.')

    // Close Quest Log, trigger another alert, then die -> alert is hidden on player death
    hud.setLeftPanel('none')
    world.applyEvent(decode0x5DQuestStatus(new Uint8Array([0x5d, 1, 0x20, 4, 5, 0])))
    expect(world.questLog.alertVisible).toBe(true)
    ;(world as unknown as { _self: { isDead: boolean } })._self.isDead = true
    model.syncFromWorld()
    expect(world.questLog.alertVisible).toBe(false)
    expect(hud.getQuestAlertBarLocalRect()).toBeNull()
  })

  it('decouples UI 2x3 grid slot local from MPQ DC6 icon index b1 across all 5 acts (0x6fba8188 & 0x6fba7990)', () => {
    const expectedByAct: Record<
      number,
      readonly { readonly id: string; readonly b1: number; readonly iconKey: string }[]
    > = {
      1: [
        { id: 'a1q1', b1: 0, iconKey: 'a1q1' },
        { id: 'a1q2', b1: 1, iconKey: 'a1q2' },
        { id: 'a1q3', b1: 3, iconKey: 'a1q4' }, // Search for Cain -> a1q4.dc6
        { id: 'a1q4', b1: 4, iconKey: 'a1q5' }, // Forgotten Tower -> a1q5.dc6
        { id: 'a1q5', b1: 2, iconKey: 'a1q3' }, // Tools of the Trade -> a1q3.dc6
        { id: 'a1q6', b1: 5, iconKey: 'a1q6' },
      ],
      2: [
        { id: 'a2q1', b1: 6, iconKey: 'a2q1' },
        { id: 'a2q2', b1: 7, iconKey: 'a2q2' },
        { id: 'a2q3', b1: 8, iconKey: 'a2q3' },
        { id: 'a2q4', b1: 9, iconKey: 'a2q4' },
        { id: 'a2q5', b1: 10, iconKey: 'a2q5' },
        { id: 'a2q6', b1: 11, iconKey: 'a2q6' },
      ],
      3: [
        { id: 'a3q1', b1: 15, iconKey: 'a3q4' }, // Golden Bird -> a3q4.dc6
        { id: 'a3q2', b1: 14, iconKey: 'a3q3' }, // Blade of the Old Religion -> a3q3.dc6
        { id: 'a3q3', b1: 13, iconKey: 'a3q2' }, // Khalim's Will -> a3q2.dc6
        { id: 'a3q4', b1: 12, iconKey: 'a3q1' }, // Lam Esen's Tome -> a3q1.dc6
        { id: 'a3q5', b1: 16, iconKey: 'a3q5' },
        { id: 'a3q6', b1: 17, iconKey: 'a3q6' },
      ],
      4: [
        { id: 'a4q1', b1: 18, iconKey: 'a4q1' },
        { id: 'a4q2', b1: 19, iconKey: 'a4q2' },
        { id: 'a4q3', b1: 20, iconKey: 'a4q3' },
      ],
      5: [
        { id: 'a5q1', b1: 21, iconKey: 'a5q1' },
        { id: 'a5q2', b1: 22, iconKey: 'a5q2' },
        { id: 'a5q3', b1: 23, iconKey: 'a5q3' },
        { id: 'a5q4', b1: 24, iconKey: 'a5q4' },
        { id: 'a5q5', b1: 25, iconKey: 'a5q5' },
        { id: 'a5q6', b1: 26, iconKey: 'a5q6' },
      ],
    }

    for (let act = 1; act <= 5; act++) {
      const canonical = CANONICAL_QUESTS_BY_ACT[act]!
      const runtime = getActQuests(act)
      const expected = expectedByAct[act]!
      expect(canonical.length).toBe(expected.length)
      expect(runtime.length).toBe(expected.length)

      for (let local = 0; local < expected.length; local++) {
        const exp = expected[local]!
        expect(canonical[local]!.id).toBe(exp.id)
        expect(canonical[local]!.index).toBe(local)
        expect(canonical[local]!.b1).toBe(exp.b1)
        expect(canonical[local]!.iconKey).toBe(exp.iconKey)
        expect(QUEST_ICON_FILES_113C[exp.b1]).toBe(exp.iconKey)

        expect(runtime[local]!.id).toBe(exp.id)
        expect(runtime[local]!.b1).toBe(exp.b1)
        expect(runtime[local]!.iconKey).toBe(exp.iconKey)

        // Verify all 4 atlas rect variants exist for every iconKey
        expect(BAKED_UI_MANIFEST.questRects[exp.iconKey]).toBeDefined()
        expect(BAKED_UI_MANIFEST.questRects[`${exp.iconKey}_done`]).toBeDefined()
        expect(BAKED_UI_MANIFEST.questRects[`${exp.iconKey}_pressed`]).toBeDefined()
        expect(BAKED_UI_MANIFEST.questRects[`${exp.iconKey}_unstarted`]).toBeDefined()
      }
    }
  })

  it('blits BAKED_UI_MANIFEST.questRects[q.iconKey] (_unstarted, active, _pressed, _done) in drawLeftDockPanel for Act I and Act III', () => {
    const hud = new WorldPanelsHud()
    const font = new D2FontRenderer()
    const fakeQuestsAtlas = {
      complete: true,
      naturalWidth: 1024,
      width: 1024,
      src: '/ui/quests-atlas.png',
    } as unknown as HTMLImageElement

    type AtlasBlit = { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number }
    const atlasBlits: AtlasBlit[] = []
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn((img: unknown, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) => {
        if (img === fakeQuestsAtlas) {
          atlasBlits.push({ sx, sy, sw, sh, dx, dy })
        }
      }),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 80 })),
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D

    const baseAssets = {
      borderLeftImg: null,
      questBgImg: null,
      waypointBgImg: null,
      stashBgImg: null,
      cubeBgImg: null,
      vendorBgImg: null,
      buySellBtnImg: null,
      questsAtlasImg: fakeQuestsAtlas,
      questSocketsImg: null,
      questLastImg: null,
    }

    // 1. Act I: local=0 completed (a1q1_done), local=2 active & selected (a1q4_pressed),
    //    local=3 active & unselected (a1q5), local=4 locked (a1q3_unstarted)
    hud.selectedActTab = 1
    hud.selectedQuestIdx = 2
    hud.setQuestStatus('a1q1', 'completed')
    hud.setQuestStatus('a1q2', 'locked')
    hud.setQuestStatus('a1q3', 'active') // local=2 (Cain) -> iconKey a1q4
    hud.setQuestStatus('a1q4', 'active') // local=3 (Forgotten Tower) -> iconKey a1q5
    hud.setQuestStatus('a1q5', 'locked') // local=4 (Tools of the Trade) -> iconKey a1q3
    hud.setQuestStatus('a1q6', 'locked')

    hud.drawLeftDockPanel(mockCtx, 'quest', baseAssets, font)
    expect(atlasBlits.length).toBe(6)

    const expectedAct1Keys = [
      'a1q1_done',
      'a1q2_unstarted',
      'a1q4_pressed',
      'a1q5',
      'a1q3_unstarted',
      'a1q6_unstarted',
    ]
    for (let i = 0; i < 6; i++) {
      const rect = BAKED_UI_MANIFEST.questRects[expectedAct1Keys[i]!]!
      expect(atlasBlits[i]!.sx).toBe(rect.x)
      expect(atlasBlits[i]!.sy).toBe(rect.y)
      expect(atlasBlits[i]!.sw).toBe(rect.w)
      expect(atlasBlits[i]!.sh).toBe(rect.h)
    }

    // 2. Act III: local=0..3 map to a3q4, a3q3, a3q2, a3q1
    atlasBlits.length = 0
    // Standing in Act 3 (Kurast Docks) so the Act III tab is visible (issue #933).
    hud.setCurrentLevel(75)
    hud.selectedActTab = 3
    hud.selectedQuestIdx = 0
    hud.setQuestStatus('a3q1', 'active') // local=0 (Golden Bird) -> a3q4_pressed
    hud.setQuestStatus('a3q2', 'completed') // local=1 (Gidbinn) -> a3q3_done
    hud.setQuestStatus('a3q3', 'active') // local=2 (Khalim's Will) -> a3q2
    hud.setQuestStatus('a3q4', 'locked') // local=3 (Lam Esen's Tome) -> a3q1_unstarted
    hud.setQuestStatus('a3q5', 'locked')
    hud.setQuestStatus('a3q6', 'locked')

    hud.drawLeftDockPanel(mockCtx, 'quest', baseAssets, font)
    expect(atlasBlits.length).toBe(6)

    const expectedAct3Keys = [
      'a3q4_pressed',
      'a3q3_done',
      'a3q2',
      'a3q1_unstarted',
      'a3q5_unstarted',
      'a3q6_unstarted',
    ]
    for (let i = 0; i < 6; i++) {
      const rect = BAKED_UI_MANIFEST.questRects[expectedAct3Keys[i]!]!
      expect(atlasBlits[i]!.sx).toBe(rect.x)
      expect(atlasBlits[i]!.sy).toBe(rect.y)
      expect(atlasBlits[i]!.sw).toBe(rect.w)
      expect(atlasBlits[i]!.sh).toBe(rect.h)
    }
  })
})

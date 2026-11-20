import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  LEVEL_ENTRY_TITLE_FRAMES,
  LEVEL_ENTRY_TITLE_FRAME_MS,
  LEVEL_ENTRY_TITLE_QUEST_OVERRIDES,
  LevelEntryTitle113c,
  computeLevelEntryTitlePlacement,
  levelEntryTitleFolder,
  type LevelEntryTitleQuestSource,
} from '../../src/common/world/level-entry-title-113c.ts'
import {
  LEVEL_ENTRY_TITLE_ATLAS,
  LEVEL_ENTRY_TITLE_KEY_BY_LEVEL,
  LEVEL_ENTRY_TITLE_RECTS,
} from '../../src/common/world/level-entry-titles-113c.ts'
import { layoutLevelEntryTitle, renderLevelEntryTitle113c } from '../../src/client/ui/level-entry-title.ts'
import { QuestFxLight, QUEST_AVAILABILITY_BYTES } from '../../src/client/world/quest-fx-light.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'

/** 120 frames x 40 ms. */
const VISIBLE_MS = LEVEL_ENTRY_TITLE_FRAMES * LEVEL_ENTRY_TITLE_FRAME_MS

function questSource(avail: Record<number, number> = {}): LevelEntryTitleQuestSource & { reads: number[] } {
  const reads: number[] = []
  return {
    reads,
    getQuestAvailability(questId: number): number {
      reads.push(questId)
      return avail[questId] ?? 0
    },
  }
}

describe('issue #1007: level entry title (D2Client.dll 0x6fb6f0d0)', () => {
  it('bakes one title for every Levels.txt id 1..136, Act 5 under EXPANSION', () => {
    for (let id = 1; id <= 136; id++) {
      const key = LEVEL_ENTRY_TITLE_KEY_BY_LEVEL[id]
      expect(key, `level ${id}`).toBeDefined()
      const rect = LEVEL_ENTRY_TITLE_RECTS[key!]
      expect(rect, key).toBeDefined()
      expect(rect!.h).toBe(26)
      expect(rect!.x + rect!.w).toBeLessThanOrEqual(LEVEL_ENTRY_TITLE_ATLAS.width)
      expect(rect!.y + rect!.h).toBeLessThanOrEqual(LEVEL_ENTRY_TITLE_ATLAS.height)
      expect(key!.startsWith(id >= 0x6d ? 'expansion/' : 'act')).toBe(true)
    }
    expect(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL[1]).toBe('act1/a1l1')
    expect(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL[2]).toBe('act1/a1l2')
    expect(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL[40]).toBe('act2/a2l1')
    expect(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL[108]).toMatch(/^act4\//)
    expect(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL[109]).toBe('expansion/a5l1')
    for (const o of LEVEL_ENTRY_TITLE_QUEST_OVERRIDES) {
      expect(LEVEL_ENTRY_TITLE_RECTS[o.titleKey], o.titleKey).toBeDefined()
    }
    expect(levelEntryTitleFolder(108, 3)).toBe('act4')
    expect(levelEntryTitleFolder(109, 4)).toBe('expansion')
  })

  it('places titles like D2Win #10138 align=1: x = W/2 - (w >> 1) - 1, bottom = H/2 - 0x8c', () => {
    // Blood Moor: 256 + 107 = 363 px.
    expect(LEVEL_ENTRY_TITLE_RECTS['act1/a1l2']!.w).toBe(363)
    expect(computeLevelEntryTitlePlacement(800, 600, 363, 26)).toEqual({ x: 400 - 181 - 1, y: 300 - 140 - 26 })
    expect(computeLevelEntryTitlePlacement(640, 480, 363, 26)).toEqual({ x: 320 - 181 - 1, y: 240 - 140 - 26 })
    expect(layoutLevelEntryTitle('act1/a1l2', 800, 600)).toEqual({ titleKey: 'act1/a1l2', x: 218, y: 134, width: 363, height: 26 })
    expect(() => layoutLevelEntryTitle('act1/nope', 800, 600)).toThrow(/not in the baked atlas/)
  })

  it('never shows a title for the first level after start, then 120 frames on each level change', () => {
    const t = new LevelEntryTitle113c(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL)
    const q = questSource()
    expect(t.update(1, 0, q)).toBeNull() // 0x6fbd340c = 0x78 when g_nLastLevel was 0
    expect(t.active).toBe(false)
    expect(t.update(1, 10_000, q)).toBeNull()
    expect(t.update(2, 20_000, q)).toBe('act1/a1l2')
    expect(t.active).toBe(true)
    expect(t.update(2, 20_000 + VISIBLE_MS - 1, q)).toBe('act1/a1l2')
    expect(t.update(2, 20_000 + VISIBLE_MS, q)).toBeNull()
    expect(t.active).toBe(false)
    expect(t.update(2, 60_000, q)).toBeNull()
    // Walking back restarts the counter.
    expect(t.update(1, 70_000, q)).toBe('act1/a1l1')
    // A new change mid-display swaps the title and restarts at frame 0.
    expect(t.update(3, 71_000, q)).toBe('act1/a1l3')
    expect(t.update(3, 71_000 + VISIBLE_MS - 1, q)).toBe('act1/a1l3')
  })

  it('keeps g_nLastLevel across a missing player / room and across games', () => {
    const t = new LevelEntryTitle113c(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL)
    const q = questSource()
    t.update(1, 0, q)
    expect(t.update(null, 100, q)).toBeNull()
    expect(t.lastLevel).toBe(1)
    // Next game starts in the same town: no title. In another town: title (no game-init reset).
    expect(t.update(1, 200, q)).toBeNull()
    expect(t.update(40, 300, q)).toBe('act2/a2l1')
  })

  it('applies the 0x6fb8be88 quest overrides only when g_QuestAvail[quest] != 0', () => {
    const base = LEVEL_ENTRY_TITLE_KEY_BY_LEVEL[8]!
    const on = new LevelEntryTitle113c(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL)
    const qOn = questSource({ 1: 1, 5: 1 })
    on.update(1, 0, qOn)
    expect(on.update(8, 1, qOn)).toBe('act1/a1q1')
    expect(on.update(20, 2, qOn)).toBe('act1/a1q5')
    expect(qOn.reads).toEqual([1, 5])

    const off = new LevelEntryTitle113c(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL)
    const qOff = questSource()
    off.update(1, 0, qOff)
    expect(off.update(8, 1, qOff)).toBe(base)
    expect(off.update(2, 2, qOff)).toBe('act1/a1l2')
    expect(qOff.reads).toEqual([1]) // only the override level reads g_QuestAvail
  })

  it('fails fast like the 1.13c FatalAsserts', () => {
    const t = new LevelEntryTitle113c(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL)
    const fx = new QuestFxLight()
    t.update(1, 0, fx)
    expect(() => t.update(8, 1, fx)).toThrow(/FatalAssert 0x60/)
    fx.onQuestAvailability(new Uint8Array(QUEST_AVAILABILITY_BYTES).fill(0).map((_, i) => (i === 1 ? 1 : 0)))
    expect(fx.getQuestAvailability(1)).toBe(1)
    expect(fx.getQuestAvailability(5)).toBe(0)
    expect(() => fx.getQuestAvailability(0x25)).toThrow(/FatalAssert 0x65/)
    const t2 = new LevelEntryTitle113c(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL)
    t2.update(1, 0, fx)
    expect(t2.update(8, 1, fx)).toBe('act1/a1q1')

    const sparse = new LevelEntryTitle113c({ 1: 'act1/a1l1' })
    sparse.update(1, 0, fx)
    expect(() => sparse.update(2, 1, fx)).toThrow(/no baked EntryFile title/)
  })

  it('draws the atlas rect at the 1.13c position and errors on a missing atlas once the HUD is ready', () => {
    const calls: unknown[][] = []
    const ctx = { drawImage: (...args: unknown[]) => calls.push(args) } as unknown as CanvasRenderingContext2D
    const atlas = {} as CanvasImageSource
    const t = new LevelEntryTitle113c(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL)
    const q = questSource()
    expect(renderLevelEntryTitle113c(ctx, t, 1, q, atlas, true, 0, 800, 600)).toBeNull()
    const layout = renderLevelEntryTitle113c(ctx, t, 2, q, atlas, true, 1000, 800, 600)
    expect(layout).toEqual({ titleKey: 'act1/a1l2', x: 218, y: 134, width: 363, height: 26 })
    const r = LEVEL_ENTRY_TITLE_RECTS['act1/a1l2']!
    expect(calls).toEqual([[atlas, r.x, r.y, r.w, r.h, 218, 134, r.w, r.h]])

    // Still loading: skip quietly. Loaded without the atlas: console.error once, never throw (ctx save stack).
    const errors: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((m: unknown) => void errors.push(String(m)))
    try {
      expect(renderLevelEntryTitle113c(ctx, t, 2, q, null, false, 1001, 800, 600)).toBeNull()
      expect(errors).toEqual([])
      expect(renderLevelEntryTitle113c(ctx, t, 2, q, null, true, 1002, 800, 600)).toBeNull()
      expect(renderLevelEntryTitle113c(ctx, t, 2, q, null, true, 1003, 800, 600)).toBeNull()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatch(/level-entry-titles\.png is missing/)

      // FatalAssert mirrors (no quest source wired) are reported, not thrown.
      const t2 = new LevelEntryTitle113c(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL)
      expect(renderLevelEntryTitle113c(ctx, t2, 1, null, atlas, true, 0, 800, 600)).toBeNull()
      expect(renderLevelEntryTitle113c(ctx, t2, 8, null, atlas, true, 1, 800, 600)).toBeNull()
      expect(errors[1]).toMatch(/FatalAssert 0x60/)
    } finally {
      spy.mockRestore()
    }
  })

  it('HudManager owns one per-client title state and reads the room level source when wired', () => {
    const hud = new HudManager()
    expect(hud.levelEntryTitle).toBeInstanceOf(LevelEntryTitle113c)
    expect(hud.levelEntryQuestSource).toBeNull()
    hud.worldPanels.setCurrentLevel(40)
    expect(hud.resolveLevelEntryLevelId()).toBe(40)
    let room: number | null = null
    hud.levelEntryLevelSource = () => room
    expect(hud.resolveLevelEntryLevelId()).toBeNull() // no room (e.g. right after LoadAct)
    room = 46
    expect(hud.resolveLevelEntryLevelId()).toBe(46)
  })

  it.skipIf(!existsSync('samples/d2/d2data.mpq'))('generated module matches a fresh bake of the MPQs', async () => {
    const { mountNodeArchives } = await import('../../src/baker/mpq-archive-source.ts')
    const { bakeLevelEntryTitles, renderLevelEntryTitlesModule } = await import(
      '../../src/baker/packers/pack-level-entry-titles.ts'
    )
    const { readFileSync } = await import('node:fs')
    const bake = await bakeLevelEntryTitles(mountNodeArchives('samples/d2'))
    expect(renderLevelEntryTitlesModule(bake)).toBe(readFileSync('src/common/world/level-entry-titles-113c.ts', 'utf8'))
  })
})

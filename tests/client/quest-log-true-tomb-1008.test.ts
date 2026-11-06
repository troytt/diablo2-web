/**
 * Issue #1008: the A2Q6 "The Seven Tombs" Quest Log page `qstsa2q61a` ("The Symbol of the True Tomb of Tal Rasha.")
 * must draw the True Tomb symbol (`invps.dc6`) per D2Client.dll 1.13c `0x6facf46c..0x6facf480` and
 * `0x6facf589..0x6facf5e3`. The previous renderer gated on a non-existent key `qstsa2q67`, so it never drew.
 */
import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { D2FontRenderer } from '../../src/client/ui/font.ts'
import { WorldPanelsHud } from '../../src/client/ui/world-panels.ts'
import {
  A2Q6_QUEST_LOG_ROW,
  A2Q6_TRUE_TOMB_PAGE_SLOT,
  A2Q6_TRUE_TOMB_TEXT_KEY,
  INVPS_DRAW_REL_BOTTOM_Y,
  INVPS_DRAW_REL_X,
  INVPS_FRAME_H,
  INVPS_FRAME_W,
  buildQuestLogPage,
  trueTombSymbolFrame113c,
} from '../../src/client/world/quest-log-state.ts'
import { CANONICAL_QUEST_STATE_TABLES } from '../../src/common/data/canonical-quest-data.ts'
import { CANONICAL_ENG_TBL_DICT } from '../../src/common/data/canonical-tbl-strings.ts'
import { MountedArchives } from '../../src/common/mpq/mount.ts'
import { MpqArchive } from '../../src/common/mpq/archive.ts'
import { fileSource } from '../../src/baker/io/file-source.ts'
import { decodeDc6 } from '../../src/common/formats/dc6.ts'

const D2_DIR = 'samples/d2'
const hasDll = fs.existsSync(`${D2_DIR}/D2Client.dll`)
const hasMpqs = fs.existsSync(`${D2_DIR}/d2data.mpq`) && fs.existsSync(`${D2_DIR}/d2exp.mpq`)

/** Read `count` bytes at virtual address `va` of a PE image. */
function readPeBytes(bytes: Buffer, va: number, count: number): number[] {
  const pe = bytes.readUInt32LE(0x3c)
  const imageBase = bytes.readUInt32LE(pe + 24 + 28)
  const numSections = bytes.readUInt16LE(pe + 6)
  const optSize = bytes.readUInt16LE(pe + 20)
  let s = pe + 24 + optSize
  for (let i = 0; i < numSections; i++, s += 40) {
    const secVa = imageBase + bytes.readUInt32LE(s + 12)
    const rawSize = bytes.readUInt32LE(s + 16)
    const rawPtr = bytes.readUInt32LE(s + 20)
    if (va >= secVa && va + count <= secVa + rawSize) {
      const off = rawPtr + (va - secVa)
      return Array.from(bytes.subarray(off, off + count))
    }
  }
  throw new Error(`VA 0x${va.toString(16)} not in a raw section`)
}

/** Player quest words with A2Q5 (row 12) completed and A2Q6 (row 14) started but not done. */
function trueTombQuestWords(): number[] {
  const words = new Array<number>(41).fill(0)
  words[12] = 0x0001
  words[14] = 0x0004
  return words
}

function trueTombStatusBytes(): number[] {
  const status = new Array<number>(41).fill(0)
  status[A2Q6_QUEST_LOG_ROW] = 1
  return status
}

describe('Issue #1008: A2Q6 True Tomb symbol in the Quest Log', () => {
  it('slot 7 of the A2Q6 state table is qstsa2q61a, and the old key qstsa2q67 does not exist', () => {
    expect(CANONICAL_QUEST_STATE_TABLES[A2Q6_QUEST_LOG_ROW]![A2Q6_TRUE_TOMB_PAGE_SLOT]!.text).toBe(A2Q6_TRUE_TOMB_TEXT_KEY)
    expect(A2Q6_TRUE_TOMB_TEXT_KEY in CANONICAL_ENG_TBL_DICT).toBe(true)
    expect('qstsa2q67' in CANONICAL_ENG_TBL_DICT).toBe(false)
  })

  it('buildQuestLogPage returns qstsa2q61a after A2Q5 is done and A2Q6 status is 1', () => {
    const page = buildQuestLogPage({
      row: A2Q6_QUEST_LOG_ROW,
      playerWords: trueTombQuestWords(),
      status: 1,
      den: 0,
      barbs: 0,
    })
    expect(page?.text.key).toBe(A2Q6_TRUE_TOMB_TEXT_KEY)
  })

  it('trueTombSymbolFrame113c gates on a2q6 + qstsa2q61a and maps out-of-range offsets to frame 0', () => {
    const page = { text: { kind: 'tbl', key: A2Q6_TRUE_TOMB_TEXT_KEY }, speechKey: null } as const
    const other = { text: { kind: 'tbl', key: 'qstsa2q61' }, speechKey: null } as const
    for (let k = 0; k <= 6; k++) expect(trueTombSymbolFrame113c('a2q6', page, k)).toBe(k)
    // 0x6facf5a8..0x6facf5b5: `< 0` or `> 6` -> 0 (not clamped to 6).
    expect(trueTombSymbolFrame113c('a2q6', page, 7)).toBe(0)
    expect(trueTombSymbolFrame113c('a2q6', page, -1)).toBe(0)
    expect(trueTombSymbolFrame113c('a2q6', page, null)).toBe(0)
    expect(trueTombSymbolFrame113c('a2q6', other, 3)).toBeNull()
    expect(trueTombSymbolFrame113c('a2q6', null, 3)).toBeNull()
    expect(trueTombSymbolFrame113c('a2q5', page, 3)).toBeNull()
  })

  it.skipIf(!hasDll)('D2Client.dll gate / draw bytes match the ported constants', () => {
    const dll = fs.readFileSync(`${D2_DIR}/D2Client.dll`)
    // cmp WORD PTR [eax+0x6fbd24ee], 0x3a0 ; cmp BYTE PTR [eax+0x6fbd274e], 7
    expect(readPeBytes(dll, 0x6facf46c, 9)).toEqual([0x66, 0x81, 0xb8, 0xee, 0x24, 0xbd, 0x6f, 0xa0, 0x03])
    expect(readPeBytes(dll, 0x6facf477, 7)).toEqual([0x80, 0xb8, 0x4e, 0x27, 0xbd, 0x6f, A2Q6_TRUE_TOMB_PAGE_SLOT])
    // cmp DWORD PTR ds:0x6fbd23f9, 5 (selected slot = A2Q6)
    expect(readPeBytes(dll, 0x6facf591, 7)).toEqual([0x83, 0x3d, 0xf9, 0x23, 0xbd, 0x6f, 0x05])
    // push 0 ; push 3 (drawMode 3 = DRAWMODE_MODULATE)
    expect(readPeBytes(dll, 0x6facf5c9, 4)).toEqual([0x6a, 0x00, 0x6a, 0x03])
    // lea eax,[edx+ecx-0x6e] ; add ecx,0x6e
    expect(readPeBytes(dll, 0x6facf5cd, 4)).toEqual([0x8d, 0x44, 0x0a, 0x100 - INVPS_DRAW_REL_X])
    expect(readPeBytes(dll, 0x6facf5da, 3)).toEqual([0x83, 0xc1, INVPS_DRAW_REL_X])
    // Bottom y = [0x6fbcb9a4] (-60) + screenH (600) - 0x6e = 430 absolute = 370 relative to the panel origin y 60.
    expect(-60 + 600 - INVPS_DRAW_REL_X - 60).toBe(INVPS_DRAW_REL_BOTTOM_Y)
  })

  it.skipIf(!hasMpqs)('invps.dc6 has 7 frames of 102x93', async () => {
    const archives = new MountedArchives()
    for (const m of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      if (fs.existsSync(`${D2_DIR}/${m}`)) archives.add(m, await MpqArchive.open(await fileSource(`${D2_DIR}/${m}`)))
    }
    const frames = decodeDc6(await archives.read('data/global/ui/MENU/invps.dc6')).groups[0]!.frames
    expect(frames.length).toBe(7)
    for (const f of frames) expect({ w: f.width, h: f.height }).toEqual({ w: INVPS_FRAME_W, h: INVPS_FRAME_H })
  })

  function renderQuestPanel(questWords: number[], statusBytes: number[], tombOffset: number) {
    const hud = new WorldPanelsHud()
    const font = new D2FontRenderer()
    const atlas = { complete: true, naturalWidth: 432, width: 432, src: '/ui/quests-atlas.png' } as unknown as HTMLImageElement
    const invps = { complete: true, naturalWidth: 714, width: 714, src: '/ui/invps.png' } as unknown as HTMLImageElement
    const events: { kind: string; op?: string; sx?: number; dx?: number; dy?: number }[] = []
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn((img: unknown, sx: number, _sy: number, _sw: number, _sh: number, dx: number, dy: number) => {
        if (img === invps) events.push({ kind: 'invps', op: ctx.globalCompositeOperation, sx, dx, dy })
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
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D & { globalCompositeOperation: string }
    ctx.save = vi.fn()
    ctx.restore = vi.fn(() => {
      ctx.globalCompositeOperation = 'source-over'
    })
    vi.spyOn(font, 'drawText').mockImplementation(() => {
      events.push({ kind: 'text' })
    })

    hud.setCurrentLevel(40)
    hud.applyServerQuestState({
      quests: questWords,
      gameQuests: new Array<number>(41).fill(0),
      questStatusBytes: statusBytes,
      tombOffset,
    })
    hud.selectedActTab = 2
    hud.selectedQuestIdx = 5
    hud.drawLeftDockPanel(
      ctx,
      'quest',
      {
        borderLeftImg: null,
        questBgImg: null,
        waypointBgImg: null,
        stashBgImg: null,
        cubeBgImg: null,
        vendorBgImg: null,
        buySellBtnImg: null,
        questsAtlasImg: atlas,
        questSocketsImg: null,
        questLastImg: null,
        invpsImg: invps,
      },
      font,
    )
    return events
  }

  it('drawLeftDockPanel draws invps frame tombOffset before the text, with screen (MODULATE) blend', () => {
    const events = renderQuestPanel(trueTombQuestWords(), trueTombStatusBytes(), 4)
    const draws = events.filter(e => e.kind === 'invps')
    expect(draws).toEqual([
      {
        kind: 'invps',
        op: 'screen',
        sx: 4 * INVPS_FRAME_W,
        dx: 80 + INVPS_DRAW_REL_X,
        dy: 60 + INVPS_DRAW_REL_BOTTOM_Y - INVPS_FRAME_H,
      },
    ])
    const invpsIdx = events.findIndex(e => e.kind === 'invps')
    const firstTextIdx = events.findIndex(e => e.kind === 'text')
    expect(firstTextIdx).toBeGreaterThan(invpsIdx)
  })

  it('does not draw the symbol on other A2Q6 pages', () => {
    const words = trueTombQuestWords()
    words[12] = 0 // A2Q5 not done -> not slot 7
    const events = renderQuestPanel(words, trueTombStatusBytes(), 4)
    expect(events.some(e => e.kind === 'invps')).toBe(false)
  })
})

/**
 * Issue #914: Quest Log icon / socket slot positions must follow the D2Client.dll 1.13c slot table
 * (`0x6fba8100`) and the DC6 bottom-left anchor convention, not a hand-tuned grid.
 */
import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { BAKED_UI_MANIFEST } from '../../src/common/items/baked-ui-meta.ts'
import { D2FontRenderer } from '../../src/client/ui/font.ts'
import {
  QUEST_ICON_DC6_FRAME,
  QUEST_SLOTS_113C,
  QUEST_SOCKET_DC6_FRAME,
  WorldPanelsHud,
  hitTestQuestSlot113c,
  questIconTopLeft113c,
  questSocketTopLeft113c,
} from '../../src/client/ui/world-panels.ts'
import { MountedArchives } from '../../src/common/mpq/mount.ts'
import { MpqArchive } from '../../src/common/mpq/archive.ts'
import { fileSource } from '../../src/baker/io/file-source.ts'
import { decodeDc6 } from '../../src/common/formats/dc6.ts'

const D2_DIR = 'samples/d2'
const hasDll = fs.existsSync(`${D2_DIR}/D2Client.dll`)
const hasMpqs = fs.existsSync(`${D2_DIR}/d2data.mpq`) && fs.existsSync(`${D2_DIR}/d2exp.mpq`)

/** Read `count` int32 values at virtual address `va` of a PE image (image base 0x6fab0000 for D2Client 1.13c). */
function readPeInt32s(bytes: Buffer, va: number, count: number): number[] {
  const pe = bytes.readUInt32LE(0x3c)
  const imageBase = bytes.readUInt32LE(pe + 24 + 28)
  const numSections = bytes.readUInt16LE(pe + 6)
  const optSize = bytes.readUInt16LE(pe + 20)
  let s = pe + 24 + optSize
  for (let i = 0; i < numSections; i++, s += 40) {
    const secVa = imageBase + bytes.readUInt32LE(s + 12)
    const rawSize = bytes.readUInt32LE(s + 16)
    const rawPtr = bytes.readUInt32LE(s + 20)
    if (va >= secVa && va + count * 4 <= secVa + rawSize) {
      const off = rawPtr + (va - secVa)
      return Array.from({ length: count }, (_, k) => bytes.readInt32LE(off + k * 4))
    }
  }
  throw new Error(`VA 0x${va.toString(16)} not in a raw section`)
}

describe('Issue #914: Quest Log slot geometry (D2Client.dll 1.13c 0x6fba8100)', () => {
  it.skipIf(!hasDll)('QUEST_SLOTS_113C matches the D2Client.dll static slot table and pressed offsets', () => {
    const dll = fs.readFileSync(`${D2_DIR}/D2Client.dll`)
    const raw = readPeInt32s(dll, 0x6fba8100, 6 * 4)
    for (let i = 0; i < 6; i++) {
      expect(QUEST_SLOTS_113C[i]).toEqual({
        drawX: raw[i * 4]!,
        drawY: raw[i * 4 + 1]!,
        hitX: raw[i * 4 + 2]!,
        hitY: raw[i * 4 + 3]!,
      })
    }
    // Selected-socket / mouse-down icon vertical offsets.
    expect(readPeInt32s(dll, 0x6fbaa3f8, 2)).toEqual([-1, -1])
  })

  it.skipIf(!hasMpqs)('quest icon and questsockets DC6 frame geometry matches the MPQ', async () => {
    const archives = new MountedArchives()
    for (const m of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      if (fs.existsSync(`${D2_DIR}/${m}`)) archives.add(m, await MpqArchive.open(await fileSource(`${D2_DIR}/${m}`)))
    }
    const sockets = decodeDc6(await archives.read('data/global/ui/MENU/questsockets.dc6')).groups[0]!.frames
    expect(sockets.length).toBe(2)
    for (const f of sockets) {
      expect({ width: f.width, height: f.height, offsetX: f.offsetX, offsetY: f.offsetY }).toEqual(QUEST_SOCKET_DC6_FRAME)
    }
    for (const n of ['a1q1', 'a2q6', 'a3q4', 'a4q3', 'a5q6']) {
      const frames = decodeDc6(await archives.read(`data/global/ui/MENU/${n}.dc6`)).groups[0]!.frames
      expect(frames.length).toBe(27)
      for (const f of frames) {
        expect({ width: f.width, height: f.height, offsetX: f.offsetX, offsetY: f.offsetY }).toEqual(QUEST_ICON_DC6_FRAME)
      }
    }
  })

  it('icon / socket top-left follow the DC6 bottom-left anchor (y + offsetY - height)', () => {
    expect(questIconTopLeft113c(0)).toEqual({ x: 26, y: 34 })
    expect(questIconTopLeft113c(2)).toEqual({ x: 220, y: 34 })
    expect(questIconTopLeft113c(4)).toEqual({ x: 123, y: 131 })
    expect(questIconTopLeft113c(0, true)).toEqual({ x: 26, y: 33 })
    expect(questSocketTopLeft113c(0, false)).toEqual({ x: 22, y: 31 })
    expect(questSocketTopLeft113c(5, true)).toEqual({ x: 216, y: 127 })
    expect(() => questIconTopLeft113c(6)).toThrow()
  })

  it('hit-test uses the binary 56x52 rects', () => {
    expect(hitTestQuestSlot113c(32, 65, 6)).toBe(0)
    expect(hitTestQuestSlot113c(87, 116, 6)).toBe(0)
    expect(hitTestQuestSlot113c(88, 65, 6)).toBe(-1)
    expect(hitTestQuestSlot113c(32, 117, 6)).toBe(-1)
    expect(hitTestQuestSlot113c(224 + 10, 163 + 10, 6)).toBe(5)
    // Act IV only has 3 quests: lower row is not clickable.
    expect(hitTestQuestSlot113c(32 + 10, 163 + 10, 3)).toBe(-1)
  })

  it('drawLeftDockPanel blits icons then socket overlays at the binary slot anchors', () => {
    const hud = new WorldPanelsHud()
    const font = new D2FontRenderer()
    const atlas = { complete: true, naturalWidth: 432, width: 432, src: '/ui/quests-atlas.png' } as unknown as HTMLImageElement
    const sockets = { complete: true, naturalWidth: 160, width: 160, src: '/ui/questsockets.png' } as unknown as HTMLImageElement
    const blits: { img: string; sx: number; dx: number; dy: number }[] = []
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn((img: unknown, sx: number, _sy: number, _sw: number, _sh: number, dx: number, dy: number) => {
        if (img === atlas) blits.push({ img: 'icon', sx, dx, dy })
        else if (img === sockets) blits.push({ img: 'socket', sx, dx, dy })
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

    // Standing in Act 2 (Lut Gholein) so the Act II tab is visible (issue #933).
    hud.setCurrentLevel(40)
    hud.selectedActTab = 2
    for (const id of ['a2q1', 'a2q2', 'a2q3', 'a2q4', 'a2q5', 'a2q6']) hud.setQuestStatus(id, 'active')
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
        questSocketsImg: sockets,
        questLastImg: null,
      },
      font,
    )
    expect(blits.length).toBe(12)
    const ox = 80
    const oy = 60
    for (let i = 0; i < 6; i++) {
      const icon = blits[i * 2]!
      const socket = blits[i * 2 + 1]!
      const s = QUEST_SLOTS_113C[i]!
      expect(icon.img).toBe('icon')
      expect(icon.dx).toBe(ox + s.drawX)
      expect(icon.dy).toBe(oy + s.drawY - 1 - 86)
      expect(socket.img).toBe('socket')
      expect(socket.sx).toBe(i === 5 ? 80 : 0)
      expect(socket.dx).toBe(ox + s.drawX - 4)
      expect(socket.dy).toBe(oy + s.drawY + 5 - 95 - (i === 5 ? 1 : 0))
    }
    expect(BAKED_UI_MANIFEST.questRects['a2q1']!.w).toBe(QUEST_ICON_DC6_FRAME.width)
    expect(BAKED_UI_MANIFEST.questRects['a2q1']!.h).toBe(QUEST_ICON_DC6_FRAME.height)
  })

  it('clicking inside the binary hit rect selects the quest; old guessed area outside it does not', () => {
    const hud = new WorldPanelsHud()
    hud.selectedActTab = 1
    for (const id of ['a1q1', 'a1q2', 'a1q3', 'a1q4', 'a1q5', 'a1q6']) hud.setQuestStatus(id, 'active')
    hud.selectedQuestIdx = -1
    // Old code accepted (ox+28..ox+108, oy+64..oy+156) for slot 0; relY 140 is below the 1.13c rect (65..116).
    hud.handleLeftDockClick('quest', 80 + 40, 60 + 140, { onClose: () => {}, onWaypointTeleport: () => {} } as never)
    expect(hud.selectedQuestIdx).toBe(-1)
    hud.handleLeftDockClick('quest', 80 + 40, 60 + 70, { onClose: () => {}, onWaypointTeleport: () => {} } as never)
    expect(hud.selectedQuestIdx).toBe(0)
  })
})

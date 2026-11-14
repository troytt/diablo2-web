/**
 * Issue #1622: Scroll of Inifuss / Key to the Cairn Stones (`bks` / `bkd`, `UI 0x10` Barkscroll)
 * coordinate tables (`.rdata:0x6fb91c40..0x6fb91ca0`) and `D2Client.dll` `0x6fb2cc60` (`BARKSCROLL_Draw`)
 * rendering parity.
 */
import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { D2FontRenderer } from '../../src/client/ui/font.ts'
import {
  BARKSCROLL_GLOW_POS,
  BARKSCROLL_RUNE_POS,
  BARKSCROLL_STEP_THRESHOLDS,
} from '../../src/client/ui/panels/panel-layout-constants.ts'
import { WorldPanelsHud } from '../../src/client/ui/world-panels.ts'

const D2_DIR = 'samples/d2'
const hasDll = fs.existsSync(`${D2_DIR}/D2Client.dll`)

function readPeSlice(bytes: Buffer, va: number, count: number): Buffer {
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
      return bytes.subarray(off, off + count)
    }
  }
  throw new Error(`VA 0x${va.toString(16)} not in a raw section`)
}

describe('Issue #1622: Barkscroll (Scroll of Inifuss) 1.13c layout and animation parity', () => {
  it('exports the exact 1.13c .rdata coordinate tables for BARKSCROLL_RUNE_POS and BARKSCROLL_GLOW_POS', () => {
    expect(BARKSCROLL_RUNE_POS).toEqual([
      { x: 242, y: 104 },
      { x: 255, y: 222 },
      { x: 148, y: 310 },
      { x: 47, y: 222 },
      { x: 75, y: 104 },
    ])
    expect(BARKSCROLL_GLOW_POS).toEqual([
      { x: 303, y: 161 },
      { x: 322, y: 242 },
      { x: 254, y: 290 },
      { x: 190, y: 238 },
      { x: 211, y: 162 },
    ])
    expect(BARKSCROLL_STEP_THRESHOLDS).toEqual([0, 12, 24, 36, 48])
  })

  it.skipIf(!hasDll)('matches D2Client.dll .rdata:0x6fb91c40..0x6fb91ca0 and 0x6fb2cc60 bytes', () => {
    const dll = fs.readFileSync(`${D2_DIR}/D2Client.dll`)

    const runeSlice = readPeSlice(dll, 0x6fb91c40, 5 * 8)
    for (let i = 0; i < 5; i++) {
      expect({
        x: runeSlice.readInt32LE(i * 8),
        y: runeSlice.readInt32LE(i * 8 + 4),
      }).toEqual(BARKSCROLL_RUNE_POS[i])
    }

    const glowSlice = readPeSlice(dll, 0x6fb91c68, 5 * 8)
    for (let i = 0; i < 5; i++) {
      expect({
        x: glowSlice.readInt32LE(i * 8),
        y: glowSlice.readInt32LE(i * 8 + 4),
      }).toEqual(BARKSCROLL_GLOW_POS[i])
    }

    const threshSlice = readPeSlice(dll, 0x6fb91c90, 5 * 4)
    for (let i = 0; i < 5; i++) {
      expect(threshSlice.readInt32LE(i * 4)).toBe(BARKSCROLL_STEP_THRESHOLDS[i])
    }

    // 0x6fb2cd3a: mov eax, [ebp+8] ; test eax, eax ; je 0x6fb2cec6 (stdcall bDeciphered arg, `ret 4` at 0x6fb2cecc;
    // an undeciphered scroll jumps to the epilogue and skips runes and glows)
    expect(Array.from(readPeSlice(dll, 0x6fb2cd3a, 11))).toEqual([
      0x8b, 0x45, 0x08, 0x85, 0xc0, 0x0f, 0x84, 0x81, 0x01, 0x00, 0x00,
    ])
    // 0x6fb2cd8b: add ecx, 0x32 (50ms tick interval)
    expect(Array.from(readPeSlice(dll, 0x6fb2cd8b, 3))).toEqual([0x83, 0xc1, 0x32])
    // 0x6fb2ce8a: push 3 (eDrawMode = 3 DRAWMODE_MODULATE / screen blend for scroin3.dc6)
    expect(Array.from(readPeSlice(dll, 0x6fb2ce8a, 2))).toEqual([0x6a, 0x03])
  })

  function createMockBarkscrollHarness() {
    const hud = new WorldPanelsHud()
    const font = new D2FontRenderer()
    const scroinBg = { complete: true, naturalWidth: 320, width: 320, src: '/ui/scroin.png' } as unknown as HTMLImageElement
    const scroinRunes = { complete: true, naturalWidth: 200, width: 200, src: '/ui/scroin2.png' } as unknown as HTMLImageElement
    const scroinGlow = { complete: true, naturalWidth: 2400, width: 2400, src: '/ui/scroin3.png' } as unknown as HTMLImageElement
    const buySellBtn = { complete: true, naturalWidth: 512, width: 512, src: '/ui/buysellbtn.png' } as unknown as HTMLImageElement

    const draws: {
      kind: 'bg' | 'rune' | 'glow' | 'close'
      sx: number
      dx: number
      dy: number
      alpha: number
      op: string
    }[] = []

    const stateStack: { alpha: number; op: GlobalCompositeOperation }[] = []
    const ctx = {
      globalAlpha: 1,
      globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
      save: vi.fn(() => {
        stateStack.push({ alpha: ctx.globalAlpha, op: ctx.globalCompositeOperation })
      }),
      restore: vi.fn(() => {
        const prev = stateStack.pop()
        if (prev) {
          ctx.globalAlpha = prev.alpha
          ctx.globalCompositeOperation = prev.op
        }
      }),
      drawImage: vi.fn(
        (
          img: unknown,
          a1: number,
          a2: number,
          _a3?: number,
          _a4?: number,
          a5?: number,
          a6?: number,
        ) => {
          if (img === scroinBg) {
            draws.push({ kind: 'bg', sx: 0, dx: a1, dy: a2, alpha: ctx.globalAlpha, op: ctx.globalCompositeOperation })
          } else if (img === scroinRunes) {
            draws.push({ kind: 'rune', sx: a1, dx: a5!, dy: a6!, alpha: ctx.globalAlpha, op: ctx.globalCompositeOperation })
          } else if (img === scroinGlow) {
            draws.push({ kind: 'glow', sx: a1, dx: a5!, dy: a6!, alpha: ctx.globalAlpha, op: ctx.globalCompositeOperation })
          } else if (img === buySellBtn) {
            draws.push({ kind: 'close', sx: a1, dx: a5!, dy: a6!, alpha: ctx.globalAlpha, op: ctx.globalCompositeOperation })
          }
        },
      ),
    } as unknown as CanvasRenderingContext2D

    const render = (nowMs: number) => {
      draws.length = 0
      hud.drawLeftDockPanel(
        ctx,
        'barkscroll',
        {
          borderLeftImg: null,
          questBgImg: null,
          waypointBgImg: null,
          stashBgImg: null,
          cubeBgImg: null,
          vendorBgImg: null,
          buySellBtnImg: buySellBtn,
          scroinBgImg: scroinBg,
          scroinRunesImg: scroinRunes,
          scroinGlowImg: scroinGlow,
          nowMs,
        },
        font,
      )
      return [...draws]
    }

    return { hud, render }
  }

  it('undeciphered Scroll of Inifuss (bks) draws only background and close button without runes or glow', () => {
    const { hud, render } = createMockBarkscrollHarness()
    hud.openBarkscroll(false, [2, 4, 0, 3, 1])

    const draws = render(1000)
    expect(draws.map((d) => d.kind)).toEqual(['bg', 'close'])
    expect(draws[0]).toMatchObject({ kind: 'bg', dx: 80, dy: 60 })
    expect(draws[1]).toMatchObject({ kind: 'close', sx: 10 * 32, dx: 80 + 277, dy: 60 + 387 })
  })

  it('deciphered Key to the Cairn Stones (bkd) reveals runes and glows at cairnStoneOrder positions and keeps runes permanently visible', () => {
    const { hud, render } = createMockBarkscrollHarness()
    const order: [number, number, number, number, number] = [2, 4, 0, 3, 1]
    hud.openBarkscroll(true, order)

    // Initial tick (t = 1000ms -> animFrame = 1, step 0 delta = 1 at stoneIdx = order[0] = 2):
    const firstDraws = render(1000)
    const firstRunes = firstDraws.filter((d) => d.kind === 'rune')
    const firstGlows = firstDraws.filter((d) => d.kind === 'glow')
    expect(firstRunes).toEqual([
      {
        kind: 'rune',
        sx: 0 * 40, // numeral "1"
        dx: 80 + BARKSCROLL_RUNE_POS[2]!.x,
        dy: 60 + BARKSCROLL_RUNE_POS[2]!.y - 25,
        alpha: 0.25,
        op: 'source-over',
      },
    ])
    expect(firstGlows).toEqual([
      {
        kind: 'glow',
        sx: 0 * 120, // glow frame 1
        dx: 80 + BARKSCROLL_GLOW_POS[2]!.x - 150,
        dy: 60 + BARKSCROLL_GLOW_POS[2]!.y - 88,
        alpha: 1,
        op: 'screen',
      },
    ])

    // Advance in 50ms increments past all 5 step thresholds and 20-frame glows (70 ticks total):
    for (let tick = 1; tick <= 70; tick++) {
      render(1000 + tick * 50)
    }

    // After all 5 glows complete (delta > 20 for all 5 steps), glows are gone and all 5 numerals 1..5
    // remain permanently visible at 100% alpha at their mapped stone positions:
    const finalDraws = render(1000 + 71 * 50)
    expect(finalDraws.filter((d) => d.kind === 'glow')).toHaveLength(0)
    expect(finalDraws.filter((d) => d.kind === 'rune')).toEqual(
      order.map((stoneIdx, stepIdx) => ({
        kind: 'rune' as const,
        sx: stepIdx * 40,
        dx: 80 + BARKSCROLL_RUNE_POS[stoneIdx]!.x,
        dy: 60 + BARKSCROLL_RUNE_POS[stoneIdx]!.y - 25,
        alpha: 1,
        op: 'source-over',
      })),
    )
  })
})

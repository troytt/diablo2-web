/**
 * Issue #924 — D2Client.dll victory screen `0x6faf3a70` (expansion branch) in the frontend renderer:
 * layout, OK-button press/release (`0x6faf2f00` / `0x6faf2e70`) and key dismissal (`0x6faf2170`).
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createInitialFlowState } from '../../src/client/frontend/flow-state.ts'
import {
  END_GAME_LAYOUT_113C,
  END_GAME_UI_IMAGES_113C,
  FrontendRenderer,
  type FrontendManifest,
} from '../../src/client/frontend/frontend-renderer.ts'

interface DrawCall {
  readonly key: string
  readonly sx: number
  readonly sy: number
  readonly dx: number
  readonly dy: number
}

function makeRenderer() {
  const frontendDir = join(process.cwd(), 'public', 'ui', 'frontend')
  const manifest = JSON.parse(readFileSync(join(frontendDir, 'manifest.json'), 'utf8')) as FrontendManifest
  const fontMetas = JSON.parse(readFileSync(join(frontendDir, 'fonts', 'metrics.json'), 'utf8'))
  const calls: DrawCall[] = []
  const fakeCtx = {
    imageSmoothingEnabled: false,
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    fillRect: () => {},
    drawImage: (img: { id: string }, sx: number, sy: number, _sw?: number, _sh?: number, dx?: number, dy?: number) => {
      calls.push({ key: img.id, sx, sy, dx: dx ?? sx, dy: dy ?? sy })
    },
  }
  const canvas = {
    getContext: () => fakeCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  } as unknown as HTMLCanvasElement
  const state = createInitialFlowState()
  const renderer = new FrontendRenderer(canvas, state)
  renderer.manifest = manifest
  renderer.fontMetas = fontMetas
  renderer.ready = true
  for (const key of END_GAME_UI_IMAGES_113C) {
    renderer.images.set(key, { id: key, width: 800, height: 600 } as unknown as HTMLImageElement)
  }
  state.stage = 'end_game'
  state.endGame = { nameLine: 'Hero', titleLine: 'Patriarch Hero', pressed: false }
  return { renderer, state, calls, fontMetas, manifest }
}

describe('Issue #924 — victory screen (D2Client 0x6faf3a70)', () => {
  it('bakes the endgame2 / endgameok / endgame-palette font assets and the 5098 / 5100 strings', () => {
    const frontendDir = join(process.cwd(), 'public', 'ui', 'frontend')
    for (const key of END_GAME_UI_IMAGES_113C) {
      expect(existsSync(join(frontendDir, key)), key).toBe(true)
    }
    const { manifest } = makeRenderer()
    expect(manifest.strings['5098']).toBe('Congratulations!')
    expect(manifest.strings['5100']).toBe('Will Henceforth Be Known As')
  })

  it('draws the background, four Font42 gold lines and the OK button at the 1.13c positions', () => {
    const { renderer, calls, fontMetas } = makeRenderer()
    renderer.render(0)
    const L = END_GAME_LAYOUT_113C
    expect(calls[0]).toEqual({ key: 'endgame/endgame2.png', sx: 0, sy: 0, dx: 0, dy: 0 })

    const h42 = fontMetas.font42.glyphs[65].frameH as number
    const goldRows = [...new Set(calls.filter((c) => c.key === 'endgame/font42-c4.png').map((c) => c.dy))]
    expect(goldRows).toEqual([
      L.congratsBottom - h42,
      L.nameBottom - h42,
      L.knownAsBottom - h42,
      L.titleBottom - h42,
    ])

    const ok = calls.find((c) => c.key === 'endgame/endgameok.png')
    expect(ok).toEqual({ key: 'endgame/endgameok.png', sx: 0, sy: 0, dx: 352, dy: 488 })
    const h16 = fontMetas.font16.glyphs[65].frameH as number
    const label = calls.filter((c) => c.key === 'endgame/font16-c0.png')
    expect(label.length).toBe(2) // "OK"
    expect(label[0]!.dy).toBe(L.okLabelBottom - h16)
  })

  it('shows the pressed frame shifted (-2, +2) and only a release inside OK returns to the lobby', () => {
    const { renderer, state, calls } = makeRenderer()
    let done = 0
    renderer.onEndGameDone = () => {
      done++
    }
    // Press outside: not pressed; release outside: nothing.
    renderer.handleMouseDown(100, 100)
    expect(state.endGame!.pressed).toBe(false)
    renderer.handleMouseUp(100, 100)
    expect(done).toBe(0)

    // Press inside: pressed frame 1, label moved.
    renderer.handleMouseDown(400, 500)
    expect(state.endGame!.pressed).toBe(true)
    const unpressedLabelX = (() => {
      const r = makeRenderer()
      r.renderer.render(0)
      return r.calls.find((c) => c.key === 'endgame/font16-c0.png')!
    })()
    calls.length = 0
    renderer.render(0)
    expect(calls.find((c) => c.key === 'endgame/endgameok.png')).toMatchObject({ sx: 96, dx: 352, dy: 488 })
    const pressedLabel = calls.find((c) => c.key === 'endgame/font16-c0.png')!
    expect(pressedLabel.dx).toBe(unpressedLabelX.dx - 2)
    expect(pressedLabel.dy).toBe(unpressedLabelX.dy + 2)

    // Release inside the inclusive button rect [352..448] x [488..520] ends the screen.
    renderer.handleMouseUp(448, 520)
    expect(done).toBe(1)
    expect(state.endGame).toBeNull()
  })

  it('any non-repeated key dismisses the screen', () => {
    const { renderer, state } = makeRenderer()
    let done = 0
    renderer.onEndGameDone = () => {
      done++
    }
    const key = (repeat: boolean) =>
      ({ key: 'a', repeat, preventDefault: () => {} }) as unknown as KeyboardEvent
    renderer.handleKeyDown(key(true))
    expect(done).toBe(0)
    renderer.handleKeyDown(key(false))
    expect(done).toBe(1)
    expect(state.endGame).toBeNull()
  })
})

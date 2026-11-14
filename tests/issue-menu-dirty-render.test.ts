/**
 * On-demand front-end rendering: the menu canvas must not repaint at display
 * refresh rate when nothing visible changed (measured 61 full 800x600
 * repaints/s on an idle main menu — high GPU load; the fastest visual change
 * is the 25Hz flow tick of the burning-logo fire strip).
 */
import { describe, expect, it } from 'vitest'
import { shouldRenderMenuFrame } from '../src/client/frontend/frontend-renderer.ts'
import type { MenuFrameDirtySignal } from '../src/client/frontend/frontend-renderer.ts'

function signal(overrides: Partial<MenuFrameDirtySignal> = {}): MenuFrameDirtySignal {
  return {
    tick: 100,
    mouseX: 400,
    mouseY: 300,
    inputVersion: 0,
    blinkPhase: 10,
    stageAnimates: true,
    ...overrides,
  }
}

describe('[menu dirty render] shouldRenderMenuFrame', () => {
  it('1. first frame always renders', () => {
    expect(shouldRenderMenuFrame(null, signal(), 1000, null)).toBe(true)
  })

  it('2. idle animated stage renders on tick, static stage does not', () => {
    const prev = signal({ stageAnimates: true })
    const nextTick = signal({ tick: 101, stageAnimates: true })
    expect(shouldRenderMenuFrame(prev, nextTick, 1040, 1000)).toBe(true)

    const prevStatic = signal({ stageAnimates: false })
    const nextTickStatic = signal({ tick: 101, stageAnimates: false })
    expect(shouldRenderMenuFrame(prevStatic, nextTickStatic, 1040, 1000)).toBe(false)
  })

  it('3. input, mouse movement and caret blink each force a render', () => {
    const prev = signal()
    expect(shouldRenderMenuFrame(prev, signal({ inputVersion: 1 }), 1010, 1000)).toBe(true)
    expect(shouldRenderMenuFrame(prev, signal({ mouseX: 410 }), 1010, 1000)).toBe(true)
    expect(shouldRenderMenuFrame(prev, signal({ mouseY: 310 }), 1010, 1000)).toBe(true)
    expect(shouldRenderMenuFrame(prev, signal({ blinkPhase: 11 }), 1010, 1000)).toBe(true)
  })

  it('4. unchanged static frame inside the heartbeat window is skipped', () => {
    const prev = signal({ stageAnimates: false })
    expect(shouldRenderMenuFrame(prev, signal({ stageAnimates: false }), 1200, 1000)).toBe(false)
    // ...but the 250ms heartbeat eventually repaints (async state catch-all)
    expect(shouldRenderMenuFrame(prev, signal({ stageAnimates: false }), 1250, 1000)).toBe(true)
  })
})

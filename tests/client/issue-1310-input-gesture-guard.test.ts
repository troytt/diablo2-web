import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  D2_HISTORY_GUARD_STATE_KEY,
  installBrowserGestureGuard,
  isMouseNavigationOrAuxButton,
} from '../../src/client/input/browser-gesture-guard.ts'
import { bindHudWindowEvents, disposeHudWindowEvents } from '../../src/client/ui/hud-input-router.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'

class FakeEvent {
  readonly type: string
  target: unknown = null
  defaultPrevented = false
  returnValue: unknown = undefined
  button = 0
  clientX = 0
  clientY = 0
  movementX = 0
  movementY = 0
  deltaX = 0
  deltaY = 0
  key = ''
  altKey = false
  ctrlKey = false
  metaKey = false
  shiftKey = false

  constructor(type: string, init?: Partial<FakeEvent>) {
    this.type = type
    if (init) {
      Object.assign(this, init)
    }
  }

  preventDefault(): void {
    this.defaultPrevented = true
  }
}

class FakeElement {
  readonly tagName: string
  readonly style: Record<string, string> = {}
  className = ''
  type = ''
  disabled = false
  readOnly = false
  isContentEditable = false
  parentElement: FakeElement | null = null
  private readonly listeners = new Map<string, Set<(e: FakeEvent) => void>>()

  constructor(tagName = 'DIV') {
    this.tagName = tagName.toUpperCase()
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this
    return child
  }

  closest(selector: string): FakeElement | null {
    const tokens = selector
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    let cur: FakeElement | null = this
    while (cur !== null) {
      for (const token of tokens) {
        if (token.startsWith('.')) {
          const cls = token.slice(1)
          if (cur.className.split(/\s+/).includes(cls)) {
            return cur
          }
        }
      }
      cur = cur.parentElement
    }
    return null
  }

  getBoundingClientRect(): DOMRect {
    return {
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }

  addEventListener(type: string, fn: (e: FakeEvent) => void): void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(fn)
  }

  removeEventListener(type: string, fn: (e: FakeEvent) => void): void {
    this.listeners.get(type)?.delete(fn)
  }
}

class FakeWindow {
  readonly documentElement = new FakeElement('HTML')
  readonly body = new FakeElement('BODY')
  pointerLockElement: unknown = null
  exitPointerLockCalls = 0
  readonly history = {
    state: null as Record<string, unknown> | null,
    pushStateCalls: 0,
    pushState(state: Record<string, unknown> | null, _unused: string, _url?: string): void {
      this.state = state
      this.pushStateCalls += 1
    },
  }
  readonly location = {
    href: 'http://localhost:5173/play.html',
  }
  readonly listeners = new Map<
    string,
    Array<{ fn: (e: FakeEvent) => void; options?: boolean | AddEventListenerOptions | undefined }>
  >()

  readonly document = {
    documentElement: this.documentElement,
    body: this.body,
    get pointerLockElement(): unknown {
      return undefined
    },
    exitPointerLock: (): void => {
      this.pointerLockElement = null
      this.exitPointerLockCalls += 1
    },
  }

  constructor() {
    const self = this
    Object.defineProperty(this.document, 'pointerLockElement', {
      configurable: true,
      get() {
        return self.pointerLockElement
      },
    })
  }

  addEventListener(
    type: string,
    fn: (e: FakeEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    let list = this.listeners.get(type)
    if (!list) {
      list = []
      this.listeners.set(type, list)
    }
    list.push({ fn, options })
  }

  removeEventListener(
    type: string,
    fn: (e: FakeEvent) => void,
    _options?: boolean | AddEventListenerOptions,
  ): void {
    const list = this.listeners.get(type)
    if (!list) return
    const idx = list.findIndex((entry) => entry.fn === fn)
    if (idx >= 0) {
      list.splice(idx, 1)
    }
  }

  dispatch(event: FakeEvent, target: unknown = null): FakeEvent {
    if (target !== null && event.target === null) {
      event.target = target
    }
    const list = this.listeners.get(event.type) ?? []
    for (const entry of [...list]) {
      entry.fn(event)
    }
    return event
  }
}

describe('Issue #1310 — Browser mouse side-button, trackpad swipe, and right-click gesture protection', () => {
  it('declares overscroll-behavior: none and touch-action: none in play.html CSS', () => {
    const playHtml = readFileSync(resolve(process.cwd(), 'play.html'), 'utf8')
    expect(playHtml).toMatch(/html,\s*body\s*\{[\s\S]*?overscroll-behavior:\s*none;/m)
    expect(playHtml).toMatch(
      /#play-workspace\s*\{[\s\S]*?overscroll-behavior:\s*none;[\s\S]*?touch-action:\s*none;/m,
    )
    expect(playHtml).toMatch(
      /#play-stage-wrapper\s*\{[\s\S]*?overscroll-behavior:\s*none;[\s\S]*?touch-action:\s*none;/m,
    )
    expect(playHtml).toMatch(
      /#play-stage\s*\{[\s\S]*?overscroll-behavior:\s*none;[\s\S]*?touch-action:\s*none;/m,
    )
  })

  it('reinforces overscrollBehavior and touchAction on DOM elements at runtime', () => {
    const win = new FakeWindow()
    const workspaceEl = new FakeElement('DIV')
    const stageWrapperEl = new FakeElement('DIV')
    const stageEl = new FakeElement('DIV')

    const guard = installBrowserGestureGuard({
      win: win as unknown as Window,
      doc: win.document as unknown as Document,
      stageEl: stageEl as unknown as HTMLElement,
      stageWrapperEl: stageWrapperEl as unknown as HTMLElement,
      workspaceEl: workspaceEl as unknown as HTMLElement,
      isSessionActive: () => false,
    })

    expect(win.documentElement.style.overscrollBehavior).toBe('none')
    expect(win.body.style.overscrollBehavior).toBe('none')
    expect(workspaceEl.style.overscrollBehavior).toBe('none')
    expect(workspaceEl.style.touchAction).toBe('none')
    expect(stageWrapperEl.style.overscrollBehavior).toBe('none')
    expect(stageWrapperEl.style.touchAction).toBe('none')
    expect(stageEl.style.overscrollBehavior).toBe('none')
    expect(stageEl.style.touchAction).toBe('none')

    guard.dispose()
  })

  it('blocks mouse side buttons (X1=3 Back, X2=4 Forward) and middle button (1) on mousedown, mouseup, and auxclick without blocking LMB(0)/RMB(2)', () => {
    const win = new FakeWindow()
    const stageEl = new FakeElement('DIV')

    const guard = installBrowserGestureGuard({
      win: win as unknown as Window,
      doc: win.document as unknown as Document,
      stageEl: stageEl as unknown as HTMLElement,
      isSessionActive: () => true,
    })

    expect(isMouseNavigationOrAuxButton(0)).toBe(false)
    expect(isMouseNavigationOrAuxButton(2)).toBe(false)
    expect(isMouseNavigationOrAuxButton(1)).toBe(true)
    expect(isMouseNavigationOrAuxButton(3)).toBe(true)
    expect(isMouseNavigationOrAuxButton(4)).toBe(true)

    for (const type of ['mousedown', 'mouseup', 'auxclick'] as const) {
      for (const button of [1, 3, 4]) {
        const ev = win.dispatch(new FakeEvent(type, { button }), stageEl)
        expect(ev.defaultPrevented).toBe(true)
      }
      for (const button of [0, 2]) {
        const ev = win.dispatch(new FakeEvent(type, { button }), stageEl)
        expect(ev.defaultPrevented).toBe(false)
      }
    }

    guard.dispose()
  })

  it('blocks contextmenu and dragstart globally (including pillarbox wrapper) while allowing editable inputs', () => {
    const win = new FakeWindow()
    const stageWrapperEl = new FakeElement('DIV')
    const stageEl = new FakeElement('DIV')
    const textInput = new FakeElement('INPUT')
    textInput.type = 'text'

    const guard = installBrowserGestureGuard({
      win: win as unknown as Window,
      doc: win.document as unknown as Document,
      stageEl: stageEl as unknown as HTMLElement,
      stageWrapperEl: stageWrapperEl as unknown as HTMLElement,
      isSessionActive: () => true,
    })

    // Right-click release inside stage or in 4:3 pillarbox black bars (`stageWrapperEl`) is blocked
    expect(win.dispatch(new FakeEvent('contextmenu'), stageEl).defaultPrevented).toBe(true)
    expect(win.dispatch(new FakeEvent('contextmenu'), stageWrapperEl).defaultPrevented).toBe(true)
    expect(win.dispatch(new FakeEvent('dragstart'), stageWrapperEl).defaultPrevented).toBe(true)

    // Editable text input keeps native context menu
    expect(win.dispatch(new FakeEvent('contextmenu'), textInput).defaultPrevented).toBe(false)

    guard.dispose()
  })

  it('prevents Ctrl/Meta+wheel zoom and non-modal wheel overscroll while allowing scrollable modals', () => {
    const win = new FakeWindow()
    const stageEl = new FakeElement('DIV')
    const modalBody = new FakeElement('DIV')
    modalBody.className = 'd2-toolbar-modal__body'
    const modalChild = new FakeElement('DIV')
    modalBody.appendChild(modalChild)

    const guard = installBrowserGestureGuard({
      win: win as unknown as Window,
      doc: win.document as unknown as Document,
      stageEl: stageEl as unknown as HTMLElement,
      isSessionActive: () => true,
    })

    // Verify wheel listener is registered with `{ passive: false }`
    const wheelEntries = win.listeners.get('wheel') ?? []
    expect(wheelEntries.length).toBe(1)
    expect(wheelEntries[0]?.options).toEqual({ passive: false, capture: true })

    // Trackpad horizontal swipe / vertical wheel on stage is defaultPrevented
    const stageWheel = win.dispatch(new FakeEvent('wheel', { deltaX: -60, deltaY: 120 }), stageEl)
    expect(stageWheel.defaultPrevented).toBe(true)

    // Regular wheel inside `.d2-toolbar-modal__body` is allowed to scroll natively
    const modalWheel = win.dispatch(new FakeEvent('wheel', { deltaY: 120 }), modalChild)
    expect(modalWheel.defaultPrevented).toBe(false)

    // Ctrl+wheel (pinch-to-zoom) is ALWAYS prevented, even over modal dialogs
    const pinchZoomWheel = win.dispatch(
      new FakeEvent('wheel', { deltaY: -50, ctrlKey: true }),
      modalChild,
    )
    expect(pinchZoomWheel.defaultPrevented).toBe(true)

    guard.dispose()
  })

  it('blocks BrowserBack/BrowserForward, Alt+Arrow history shortcuts, and active-session F5 / Ctrl+R reloads', () => {
    const win = new FakeWindow()
    const stageEl = new FakeElement('DIV')
    const inputEl = new FakeElement('INPUT')
    inputEl.type = 'text'

    let sessionActive = true
    const guard = installBrowserGestureGuard({
      win: win as unknown as Window,
      doc: win.document as unknown as Document,
      stageEl: stageEl as unknown as HTMLElement,
      isSessionActive: () => sessionActive,
    })

    for (const key of ['BrowserBack', 'BrowserForward']) {
      expect(win.dispatch(new FakeEvent('keydown', { key }), stageEl).defaultPrevented).toBe(true)
    }

    expect(
      win.dispatch(new FakeEvent('keydown', { key: 'ArrowLeft', altKey: true }), stageEl)
        .defaultPrevented,
    ).toBe(true)

    // Inside a text input, Alt+ArrowLeft (word navigation) is not blocked
    expect(
      win.dispatch(new FakeEvent('keydown', { key: 'ArrowLeft', altKey: true }), inputEl)
        .defaultPrevented,
    ).toBe(false)

    // Active session blocks F5 and Ctrl+R / Cmd+R
    expect(win.dispatch(new FakeEvent('keydown', { key: 'F5' }), stageEl).defaultPrevented).toBe(
      true,
    )
    expect(
      win.dispatch(new FakeEvent('keydown', { key: 'r', ctrlKey: true }), stageEl).defaultPrevented,
    ).toBe(true)

    // Inactive session (disconnected login screen) allows F5 / Ctrl+R
    sessionActive = false
    expect(win.dispatch(new FakeEvent('keydown', { key: 'F5' }), stageEl).defaultPrevented).toBe(
      false,
    )

    guard.dispose()
  })

  it('maintains a History Back-Stack Sentinel via pushState and re-arms on popstate', () => {
    const win = new FakeWindow()
    const stageEl = new FakeElement('DIV')

    const guard = installBrowserGestureGuard({
      win: win as unknown as Window,
      doc: win.document as unknown as Document,
      stageEl: stageEl as unknown as HTMLElement,
      isSessionActive: () => true,
    })

    expect(win.history.pushStateCalls).toBe(1)
    expect(win.history.state).toEqual({ [D2_HISTORY_GUARD_STATE_KEY]: true })

    // Simulate OS/driver-level Back navigation popping the sentinel state
    win.history.state = null
    win.dispatch(new FakeEvent('popstate'))

    expect(win.history.pushStateCalls).toBe(2)
    expect(win.history.state).toEqual({ [D2_HISTORY_GUARD_STATE_KEY]: true })

    guard.dispose()
  })

  it('intercepts beforeunload only when a game or lobby session is active', () => {
    const win = new FakeWindow()
    const stageEl = new FakeElement('DIV')

    let active = false
    const guard = installBrowserGestureGuard({
      win: win as unknown as Window,
      doc: win.document as unknown as Document,
      stageEl: stageEl as unknown as HTMLElement,
      isSessionActive: () => active,
    })

    const idleUnload = win.dispatch(new FakeEvent('beforeunload'))
    expect(idleUnload.defaultPrevented).toBe(false)

    active = true
    const activeUnload = win.dispatch(new FakeEvent('beforeunload'))
    expect(activeUnload.defaultPrevented).toBe(true)
    expect(activeUnload.returnValue).toBe('')

    guard.dispose()
  })

  it('tracks virtual stage coordinates via movementX/movementY when Pointer Lock is active', () => {
    const win = new FakeWindow()
    const stageEl = new FakeElement('DIV')
    ;(stageEl as unknown as { requestPointerLock: () => void }).requestPointerLock = () => {
      win.pointerLockElement = stageEl
    }

    const guard = installBrowserGestureGuard({
      win: win as unknown as Window,
      doc: win.document as unknown as Document,
      stageEl: stageEl as unknown as HTMLElement,
      isSessionActive: () => true,
    })

    // Unlocked: uses fallbackToStageCoords and syncs virtual cursor anchor
    const unlockedEvent = new FakeEvent('mousemove', {
      clientX: 250,
      clientY: 180,
    }) as unknown as MouseEvent
    const pt0 = guard.resolveStageCoords(
      unlockedEvent,
      (e) => ({ x: e.clientX, y: e.clientY }),
      800,
      600,
    )
    expect(pt0).toEqual({ x: 250, y: 180 })

    // Engage Pointer Lock: accumulates movementX / movementY and clamps to [0, 800] x [0, 600]
    guard.requestPointerLock()
    expect(guard.isPointerLocked()).toBe(true)

    const move1 = new FakeEvent('mousemove', {
      movementX: 45,
      movementY: -30,
    }) as unknown as MouseEvent
    expect(
      guard.resolveStageCoords(move1, (e) => ({ x: e.clientX, y: e.clientY }), 800, 600),
    ).toEqual({ x: 295, y: 150 })

    const moveClamp = new FakeEvent('mousemove', {
      movementX: 9999,
      movementY: -9999,
    }) as unknown as MouseEvent
    expect(
      guard.resolveStageCoords(moveClamp, (e) => ({ x: e.clientX, y: e.clientY }), 800, 600),
    ).toEqual({ x: 800, y: 0 })

    guard.dispose()
    expect(guard.isPointerLocked()).toBe(false)
    expect(win.exitPointerLockCalls).toBe(1)
  })

  it('registers HudManager window wheel listener with { passive: false } and calls preventDefault when handled', () => {
    const prevWindow = (globalThis as { window?: unknown }).window
    const fakeWin = new FakeWindow()
    ;(globalThis as { window?: unknown }).window = fakeWin
    try {
      const hudCanvas = new FakeElement('CANVAS') as unknown as HTMLCanvasElement & {
        width: number
        height: number
        getContext: () => null
      }
      hudCanvas.width = 800
      hudCanvas.height = 600
      hudCanvas.getContext = () => null

      const hud = new HudManager(hudCanvas)
      bindHudWindowEvents(hud)
      const handleWheelSpy = vi.spyOn(hud, 'handleWheel').mockReturnValue(true)

      const wheelEntries = fakeWin.listeners.get('wheel') ?? []
      expect(wheelEntries.length).toBe(1)
      expect(wheelEntries[0]?.options).toEqual({ passive: false })

      const wheelEv = fakeWin.dispatch(new FakeEvent('wheel', { deltaY: 100 }))
      expect(handleWheelSpy).toHaveBeenCalledWith(100)
      expect(wheelEv.defaultPrevented).toBe(true)

      disposeHudWindowEvents(hud)
      expect(fakeWin.listeners.get('wheel')?.length ?? 0).toBe(0)
    } finally {
      if (prevWindow === undefined) {
        delete (globalThis as { window?: unknown }).window
      } else {
        ;(globalThis as { window?: unknown }).window = prevWindow
      }
    }
  })
})

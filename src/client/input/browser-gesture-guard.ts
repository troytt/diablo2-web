/**
 * Browser Input & Gesture Protection (`src/client/input/browser-gesture-guard.ts`, Issue #1310).
 *
 * Layered defense-in-depth against browser navigation, refresh, zoom, and context-menu
 * interruptions during gameplay on `play.html`:
 *
 * 1. **CSS Overscroll & Touch-Action Reinforcement**:
 *    Forces `overscroll-behavior: none` on `<html>` and `<body>` and `touch-action: none`
 *    on the workspace/stage containers so trackpad two-finger horizontal swipes and
 *    touchscreen pull-to-refresh never trigger browser history navigation or reload.
 * 2. **Mouse Side Buttons (`X1`/`X2`, `button === 3 | 4`) & Middle Button (`button === 1`)**:
 *    Intercepts `mousedown`, `mouseup`, and `auxclick` in the capture phase and calls
 *    `e.preventDefault()` to suppress browser Back/Forward navigation and middle-click
 *    autoscroll / X11 clipboard paste.
 * 3. **Global Context Menu & Drag Suppression (`contextmenu`, `dragstart`)**:
 *    Prevents the native right-click context menu and element drag-ghosts across the entire
 *    window (including 4:3 pillarbox bars in `#play-stage-wrapper`), while preserving native
 *    context menu access inside editable `<input>` / `<textarea>` elements.
 * 4. **Non-Passive Wheel & Pinch-Zoom Guard (`wheel` `{ passive: false }`)**:
 *    Blocks `Ctrl`/`Meta` + wheel page zoom (and trackpad pinch-to-zoom) globally, and
 *    prevents default wheel overscroll outside scrollable modal overlays while still allowing
 *    in-game HUD / lobby wheel handlers to process `deltaY`.
 * 5. **Keyboard Navigation & Active-Session Reload Shortcut Guard (`keydown`)**:
 *    Blocks `BrowserBack`, `BrowserForward`, and `Alt+ArrowLeft` / `Alt+ArrowRight` history
 *    shortcuts, plus `F5` and `Ctrl+R` / `Cmd+R` when a game/lobby session is active.
 * 6. **History Back-Stack Sentinel (`history.pushState` + `popstate`)**:
 *    Pushes a sentinel history state (`{ __d2BackGuard: true }`) and immediately re-pushes it
 *    on `popstate` so OS/driver-level Back commands that bypass DOM mouse events are absorbed
 *    without leaving `play.html`.
 * 7. **Active-Session Unload Confirmation (`beforeunload`)**:
 *    Triggers the native browser confirmation prompt when a live session is active, stopping
 *    browser right-click mouse gestures (e.g. Right-Click Drag Down = Refresh, Down-Right =
 *    Close Tab) from silently dropping the Battle.net / D2GS WebSocket connection.
 * 8. **Virtual Cursor Tracking for Pointer Lock (`movementX` / `movementY`)**:
 *    Maintains clamped stage-space coordinates when `document.pointerLockElement === stageEl`
 *    so the software-rendered D2 cursor (`#d2-cursor-canvas` / `#bnet-canvas`) continues to
 *    move smoothly if Pointer Lock is engaged.
 */

export const D2_HISTORY_GUARD_STATE_KEY = '__d2BackGuard' as const

export interface BrowserGestureGuardOptions {
  /** Target window (defaults to global `window`). */
  readonly win?: Window | undefined
  /** Target document (defaults to `win.document` or global `document`). */
  readonly doc?: Document | undefined
  /** Primary interactive game stage (`#play-stage`). */
  readonly stageEl: HTMLElement
  /** Outer stage wrapper (`#play-stage-wrapper`, including 4:3 pillarbox bars). */
  readonly stageWrapperEl?: HTMLElement | null | undefined
  /** Outer play workspace (`#play-workspace`). */
  readonly workspaceEl?: HTMLElement | null | undefined
  /**
   * Returns `true` when the user has an active session (e.g. connected to Battle.net lobby,
   * character selection, or in-game world) that would be lost if the page reloads or unloads.
   */
  readonly isSessionActive: () => boolean
}

export interface BrowserGestureGuardHandle {
  /** Remove all window/document listeners registered by this guard. */
  dispose(): void
  /** Whether `stageEl` currently holds browser Pointer Lock. */
  isPointerLocked(): boolean
  /** Request Pointer Lock on `stageEl` (no-op if unsupported). */
  requestPointerLock(): void
  /** Exit Pointer Lock if currently locked to `stageEl`. */
  exitPointerLock(): void
  /**
   * Resolve logical stage coordinates `(x, y)` for a `MouseEvent`, seamlessly accumulating
   * `movementX` / `movementY` when `stageEl` is pointer-locked.
   */
  resolveStageCoords(
    e: MouseEvent,
    fallbackToStageCoords: (e: MouseEvent) => { readonly x: number; readonly y: number },
    logicalWidth: number,
    logicalHeight: number,
  ): { readonly x: number; readonly y: number }
}

function isEditableTextElement(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as {
    readonly tagName?: string
    readonly isContentEditable?: boolean
    readonly disabled?: boolean
    readonly readOnly?: boolean
    readonly type?: string
  }
  if (el.isContentEditable) return true
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : ''
  if (tag === 'TEXTAREA') {
    return !el.disabled && !el.readOnly
  }
  if (tag === 'INPUT') {
    if (el.disabled || el.readOnly) return false
    const inputType = typeof el.type === 'string' ? el.type.toLowerCase() : 'text'
    return (
      inputType === 'text' ||
      inputType === 'password' ||
      inputType === 'search' ||
      inputType === 'email' ||
      inputType === 'url' ||
      inputType === 'tel' ||
      inputType === 'number'
    )
  }
  return false
}

function isInsideScrollableDomOverlay(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as {
    readonly tagName?: string
    readonly closest?: (selector: string) => Element | null
  }
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : ''
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (typeof el.closest === 'function') {
    const match = el.closest(
      '.d2-toolbar-modal__body, .d2-toolbar-modal, .d2-plugin-menu, [data-d2-scrollable="true"]',
    )
    if (match !== null) return true
  }
  return false
}

export function isMouseNavigationOrAuxButton(button: number): boolean {
  // 1 = Middle button (autoscroll / X11 paste)
  // 3 = X1 / Browser Back side button
  // 4 = X2 / Browser Forward side button
  return button === 1 || button === 3 || button === 4
}

export function installBrowserGestureGuard(
  options: BrowserGestureGuardOptions,
): BrowserGestureGuardHandle {
  const win: Window | undefined =
    options.win ?? (typeof window !== 'undefined' ? window : undefined)
  const doc: Document | undefined =
    options.doc ?? win?.document ?? (typeof document !== 'undefined' ? document : undefined)
  const { stageEl, stageWrapperEl, workspaceEl, isSessionActive } = options

  const disposers: (() => void)[] = []
  let disposed = false

  // Virtual cursor state used when `document.pointerLockElement === stageEl`
  let virtualCursorX = 400
  let virtualCursorY = 300
  let virtualCursorInitialized = false

  // 1. Reinforce CSS overscroll & touch-action rules at runtime
  if (doc?.documentElement?.style) {
    doc.documentElement.style.overscrollBehavior = 'none'
  }
  if (doc?.body?.style) {
    doc.body.style.overscrollBehavior = 'none'
  }
  for (const el of [workspaceEl, stageWrapperEl, stageEl]) {
    if (el && el.style) {
      el.style.overscrollBehavior = 'none'
      el.style.touchAction = 'none'
    }
  }

  const addWinListener = (
    type: string,
    fn: (e: Event) => void,
    listenerOptions?: boolean | AddEventListenerOptions,
  ): void => {
    if (!win || typeof win.addEventListener !== 'function') return
    win.addEventListener(type, fn, listenerOptions)
    disposers.push(() => {
      win.removeEventListener(type, fn, listenerOptions)
    })
  }

  // 2. History Back-Stack Sentinel (`history.pushState` + `popstate`)
  let sentinelPushed = false
  const pushHistorySentinel = (): void => {
    if (disposed || !win || !win.history || typeof win.history.pushState !== 'function') {
      return
    }
    try {
      const currentState = win.history.state as Record<string, unknown> | null
      if (currentState && currentState[D2_HISTORY_GUARD_STATE_KEY] === true) {
        sentinelPushed = true
        return
      }
      const nextState =
        currentState && typeof currentState === 'object'
          ? { ...currentState, [D2_HISTORY_GUARD_STATE_KEY]: true }
          : { [D2_HISTORY_GUARD_STATE_KEY]: true }
      win.history.pushState(nextState, '', win.location?.href ?? '')
      sentinelPushed = true
    } catch {
      // Ignore SecurityError in sandboxed/file origins
    }
  }

  pushHistorySentinel()

  const onPopState = (_e: Event): void => {
    if (disposed) return
    // Re-arm the sentinel state immediately so browser Back stays on play.html
    sentinelPushed = false
    pushHistorySentinel()
  }
  addWinListener('popstate', onPopState)

  // Ensure sentinel is armed after first user activation (Chromium back-button intervention)
  const ensureSentinelOnActivation = (): void => {
    if (!sentinelPushed) {
      pushHistorySentinel()
    }
  }

  // 3. Mouse Side Button (X1/X2) & Middle Button Guard (`mousedown`, `mouseup`, `auxclick`)
  const onMouseButtonGuard = (e: Event): void => {
    ensureSentinelOnActivation()
    const me = e as MouseEvent
    if (isMouseNavigationOrAuxButton(me.button)) {
      e.preventDefault()
    }
  }
  addWinListener('mousedown', onMouseButtonGuard, true)
  addWinListener('mouseup', onMouseButtonGuard, true)
  addWinListener('auxclick', onMouseButtonGuard, true)

  // 4. Global Context Menu & Drag Guard (`contextmenu`, `dragstart`)
  const onContextMenu = (e: Event): void => {
    if (isEditableTextElement(e.target)) {
      return
    }
    e.preventDefault()
  }
  addWinListener('contextmenu', onContextMenu, true)

  const onDragStart = (e: Event): void => {
    if (isEditableTextElement(e.target)) {
      return
    }
    e.preventDefault()
  }
  addWinListener('dragstart', onDragStart, true)

  // 5. Non-Passive Wheel & Pinch-Zoom Guard (`wheel`)
  const onWheel = (e: Event): void => {
    const we = e as WheelEvent
    // Always block Ctrl/Meta + wheel (browser page zoom & trackpad pinch-to-zoom)
    if (we.ctrlKey || we.metaKey) {
      e.preventDefault()
      return
    }
    // Allow native scrolling inside scrollable modal dialogs / dropdowns
    if (isInsideScrollableDomOverlay(e.target)) {
      return
    }
    // Block horizontal trackpad two-finger swipe history navigation and page overscroll
    e.preventDefault()
  }
  addWinListener('wheel', onWheel, { passive: false, capture: true })

  // 6. Keyboard Navigation & Active-Session Reload Guard (`keydown`)
  const onKeyDown = (e: Event): void => {
    ensureSentinelOnActivation()
    const ke = e as KeyboardEvent
    const key = ke.key

    // Dedicated browser Back / Forward multimedia keys
    if (key === 'BrowserBack' || key === 'BrowserForward') {
      e.preventDefault()
      return
    }

    // Alt + ArrowLeft / ArrowRight browser history navigation shortcuts
    if (
      ke.altKey &&
      !ke.ctrlKey &&
      !ke.metaKey &&
      (key === 'ArrowLeft' || key === 'ArrowRight') &&
      !isEditableTextElement(e.target)
    ) {
      e.preventDefault()
      return
    }

    // Prevent accidental F5 / Ctrl+R / Cmd+R reload while a session is active
    if (isSessionActive()) {
      const isF5 = key === 'F5'
      const isCtrlOrCmdR =
        (ke.ctrlKey || ke.metaKey) && !ke.altKey && (key === 'r' || key === 'R')
      if (isF5 || isCtrlOrCmdR) {
        e.preventDefault()
      }
    }
  }
  addWinListener('keydown', onKeyDown, true)

  // 7. Active-Session Unload Confirmation (`beforeunload`)
  const onBeforeUnload = (e: Event): string | undefined => {
    if (!isSessionActive()) {
      return undefined
    }
    const bue = e as BeforeUnloadEvent
    bue.preventDefault()
    bue.returnValue = ''
    return ''
  }
  addWinListener('beforeunload', onBeforeUnload)

  const isPointerLocked = (): boolean => {
    return Boolean(doc && doc.pointerLockElement === stageEl)
  }

  const requestPointerLock = (): void => {
    const candidate = stageEl as HTMLElement & {
      requestPointerLock?: () => Promise<void> | void
    }
    if (typeof candidate.requestPointerLock === 'function') {
      try {
        const res = candidate.requestPointerLock()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          void (res as Promise<void>).catch(() => {
            /* ignore user/browser pointer lock rejection */
          })
        }
      } catch {
        /* ignore synchronous pointer lock rejection */
      }
    }
  }

  const exitPointerLock = (): void => {
    if (!isPointerLocked() || !doc) return
    const d = doc as Document & { exitPointerLock?: () => void }
    if (typeof d.exitPointerLock === 'function') {
      try {
        d.exitPointerLock()
      } catch {
        /* ignore */
      }
    }
  }

  const resolveStageCoords = (
    e: MouseEvent,
    fallbackToStageCoords: (e: MouseEvent) => { readonly x: number; readonly y: number },
    logicalWidth: number,
    logicalHeight: number,
  ): { readonly x: number; readonly y: number } => {
    const maxW = Math.max(1, logicalWidth)
    const maxH = Math.max(1, logicalHeight)
    if (isPointerLocked()) {
      if (!virtualCursorInitialized) {
        virtualCursorX = Math.round(maxW / 2)
        virtualCursorY = Math.round(maxH / 2)
        virtualCursorInitialized = true
      }
      const rect = stageEl.getBoundingClientRect?.()
      const scaleX = rect && rect.width > 0 ? maxW / rect.width : 1
      const scaleY = rect && rect.height > 0 ? maxH / rect.height : 1
      const dx = (typeof e.movementX === 'number' ? e.movementX : 0) * scaleX
      const dy = (typeof e.movementY === 'number' ? e.movementY : 0) * scaleY
      virtualCursorX = Math.max(0, Math.min(maxW, virtualCursorX + dx))
      virtualCursorY = Math.max(0, Math.min(maxH, virtualCursorY + dy))
      return { x: virtualCursorX, y: virtualCursorY }
    }
    const pt = fallbackToStageCoords(e)
    virtualCursorX = Math.max(0, Math.min(maxW, pt.x))
    virtualCursorY = Math.max(0, Math.min(maxH, pt.y))
    virtualCursorInitialized = true
    return pt
  }

  return {
    dispose(): void {
      if (disposed) return
      disposed = true
      exitPointerLock()
      for (const disposeOne of disposers) {
        disposeOne()
      }
      disposers.length = 0
    },
    isPointerLocked,
    requestPointerLock,
    exitPointerLock,
    resolveStageCoords,
  }
}

/**
 * Document fullscreen controller backing the toolbar's fullscreen toggle button
 * (`#d2-toolbar-fullscreen-btn`, right after the `60 FPS / 30 FPS` selector).
 *
 * NOT 1.13c behaviour: web-port affordance only.
 *
 * - `toggle()` must run synchronously inside the click handler (user-activation requirement).
 * - Exiting with Esc / F11 is left entirely to the browser (no Keyboard Lock), so Esc always
 *   restores the window; `fullscreenchange` keeps the button state in sync either way.
 * - Rejections are reported through `onError`, never swallowed.
 */

/** Minimal `Document` surface used by the controller (kept small for node-env tests). */
export interface FullscreenDocLike {
  readonly fullscreenElement: Element | null
  exitFullscreen(): Promise<void>
  addEventListener(type: 'fullscreenchange' | 'fullscreenerror', listener: () => void): void
  removeEventListener(type: 'fullscreenchange' | 'fullscreenerror', listener: () => void): void
}

/** Element that goes fullscreen (normally `document.documentElement`). */
export interface FullscreenTargetLike {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void>
}

/** Optional Web Screen Orientation API surface (`window.screen?.orientation`). */
export interface ScreenOrientationLike {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'landscape-secondary' | 'any') => Promise<void>
  unlock?: () => void
}

export type FullscreenErrorKind = 'unsupported' | 'enter' | 'exit' | 'rejected'

export interface FullscreenControllerOptions {
  readonly doc: FullscreenDocLike
  readonly target: FullscreenTargetLike
  /** Optional `screen.orientation` handle for automatic landscape locking on mobile fullscreen. */
  readonly screenOrientation?: ScreenOrientationLike | null | undefined
  /** Called after every `fullscreenchange` (browser- or button-driven). */
  readonly onChange: (active: boolean) => void
  readonly onError: (kind: FullscreenErrorKind, detail: string) => void
}

export class FullscreenController {
  private readonly doc: FullscreenDocLike
  private readonly target: FullscreenTargetLike
  private readonly screenOrientation: ScreenOrientationLike | null
  private readonly onChange: (active: boolean) => void
  private readonly onError: (kind: FullscreenErrorKind, detail: string) => void
  private readonly handleChange = (): void => {
    const active = this.isActive()
    if (!active) {
      this.tryUnlockOrientation()
    }
    this.onChange(active)
  }
  private readonly handleError = (): void => {
    this.onError('rejected', 'fullscreenerror')
  }

  constructor(opts: FullscreenControllerOptions) {
    this.doc = opts.doc
    this.target = opts.target
    this.screenOrientation =
      opts.screenOrientation !== undefined
        ? opts.screenOrientation
        : typeof globalThis !== 'undefined' &&
            typeof (globalThis as { screen?: { orientation?: ScreenOrientationLike } }).screen
              ?.orientation === 'object'
          ? ((globalThis as { screen?: { orientation?: ScreenOrientationLike } }).screen
              ?.orientation ?? null)
          : null
    this.onChange = opts.onChange
    this.onError = opts.onError
    this.doc.addEventListener('fullscreenchange', this.handleChange)
    this.doc.addEventListener('fullscreenerror', this.handleError)
  }

  /** Whether fullscreen can be requested at all in this browser. */
  isSupported(): boolean {
    return typeof this.target.requestFullscreen === 'function'
  }

  isActive(): boolean {
    return this.doc.fullscreenElement != null
  }

  /** Enter or exit fullscreen. Call synchronously from the click handler. */
  toggle(): void {
    if (this.isActive()) {
      this.tryUnlockOrientation()
      this.doc.exitFullscreen().catch((err: unknown) => {
        this.onError('exit', describeError(err))
      })
      return
    }
    this.requestFullscreenLandscape()
  }

  /**
   * Explicitly enter fullscreen and attempt `screen.orientation.lock('landscape')` when supported.
   * Safe to invoke from mobile orientation guard buttons.
   */
  requestFullscreenLandscape(): void {
    const request = this.target.requestFullscreen
    if (typeof request !== 'function') {
      this.onError('unsupported', 'requestFullscreen is not available')
      return
    }
    request
      .call(this.target, { navigationUI: 'hide' })
      .then(() => {
        this.tryLockLandscape()
      })
      .catch((err: unknown) => {
        this.onError('enter', describeError(err))
      })
  }

  private tryLockLandscape(): void {
    const lockFn = this.screenOrientation?.lock
    if (typeof lockFn !== 'function') return
    try {
      const p = lockFn.call(this.screenOrientation, 'landscape')
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Desktop browsers and iOS Safari reject orientation.lock with NotSupportedError; ignore silently.
        })
      }
    } catch {
      // Ignore synchronous orientation lock throws
    }
  }

  private tryUnlockOrientation(): void {
    const unlockFn = this.screenOrientation?.unlock
    if (typeof unlockFn !== 'function') return
    try {
      unlockFn.call(this.screenOrientation)
    } catch {
      // Ignore orientation unlock errors
    }
  }

  dispose(): void {
    this.doc.removeEventListener('fullscreenchange', this.handleChange)
    this.doc.removeEventListener('fullscreenerror', this.handleError)
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

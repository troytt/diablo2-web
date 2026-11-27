import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  FullscreenController,
  type FullscreenDocLike,
  type ScreenOrientationLike,
} from '../../src/client/toolbar/fullscreen-controller.ts'
import {
  computeSafeAreaHudBounds,
  normalizeSafeAreaInsets,
} from '../../src/client/ui/hud-viewport-layout.ts'
import {
  VIEWPORT_1068x600,
  VIEWPORT_1280x720,
  VIEWPORT_800x600,
} from '../../src/client/view/viewport-profile.ts'

describe('Mobile Phase 1 (#1381): Viewport, PWA Manifest, Landscape Orientation Lock & Safe Area', () => {
  it('defines a valid PWA manifest.webmanifest with fullscreen display and landscape orientation', () => {
    const manifestRaw = readFileSync(
      resolve(__dirname, '../../public/manifest.webmanifest'),
      'utf8',
    )
    const manifest = JSON.parse(manifestRaw) as {
      display?: string
      orientation?: string
      start_url?: string
    }
    expect(manifest.display).toBe('fullscreen')
    expect(manifest.orientation).toBe('landscape')
    expect(manifest.start_url).toBe('/play.html')
  })

  it('configures play.html and index.html with viewport-fit=cover, safe-area CSS vars, and orientation guard', () => {
    const playHtml = readFileSync(resolve(__dirname, '../../play.html'), 'utf8')
    const indexHtml = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')

    expect(playHtml).toContain('viewport-fit=cover')
    expect(playHtml).toContain('user-scalable=no')
    expect(playHtml).toContain('href="/manifest.webmanifest"')
    expect(playHtml).toContain('--safe-top: env(safe-area-inset-top, 0px);')
    expect(playHtml).toContain('--safe-right: env(safe-area-inset-right, 0px);')
    expect(playHtml).toContain('--safe-bottom: env(safe-area-inset-bottom, 0px);')
    expect(playHtml).toContain('--safe-left: env(safe-area-inset-left, 0px);')
    expect(playHtml).toContain('height: 100dvh;')
    expect(playHtml).toContain('id="d2-orientation-guard"')
    expect(playHtml).toContain('id="d2-orientation-lock-btn"')
    expect(playHtml).toContain('id="d2-mobile-toolbar-pill"')

    expect(indexHtml).toContain('viewport-fit=cover')
    expect(indexHtml).toContain('href="/manifest.webmanifest"')
  })

  it('locks screen orientation to landscape on fullscreen entry and unlocks on exit', async () => {
    const listeners = new Map<string, () => void>()
    let fsElement: Element | null = null
    const doc: FullscreenDocLike = {
      get fullscreenElement() {
        return fsElement
      },
      exitFullscreen: vi.fn(async () => {
        fsElement = null
        listeners.get('fullscreenchange')?.()
      }),
      addEventListener: (type, fn) => {
        listeners.set(type, fn)
      },
      removeEventListener: (type) => {
        listeners.delete(type)
      },
    }

    const lockSpy = vi.fn(async () => {})
    const unlockSpy = vi.fn(() => {})
    const screenOrientation: ScreenOrientationLike = {
      lock: lockSpy,
      unlock: unlockSpy,
    }

    const target = {
      requestFullscreen: vi.fn(async () => {
        fsElement = {} as Element
        listeners.get('fullscreenchange')?.()
      }),
    }

    const onChange = vi.fn()
    const onError = vi.fn()
    const ctrl = new FullscreenController({
      doc,
      target,
      screenOrientation,
      onChange,
      onError,
    })

    ctrl.toggle()
    await Promise.resolve()
    await Promise.resolve()

    expect(target.requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' })
    expect(lockSpy).toHaveBeenCalledWith('landscape')
    expect(onChange).toHaveBeenCalledWith(true)

    ctrl.toggle()
    await Promise.resolve()
    expect(unlockSpy).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(false)
    expect(onError).not.toHaveBeenCalled()

    ctrl.dispose()
  })

  it('computes logical HUD safe-area bounds accounting for pillarbox margins and notch/home-indicator insets', () => {
    expect(normalizeSafeAreaInsets({ top: -10, left: 44, right: 44, bottom: 21 })).toEqual({
      top: 0,
      left: 44,
      right: 44,
      bottom: 21,
    })

    // Case 1: 800x600 logical viewport centered inside a 932x430 iPhone 15 Pro landscape window
    // uiScale = 430 / 600 = 0.71667, stageCssW = 800 * 0.71667 = 573.33, offsetX = (932 - 573.33)/2 = 179.33px
    // Because the 179.33px pillarbox margin is wider than the 59px Dynamic Island inset,
    // horizontal logical safe insets are 0, while the 21px bottom Home Indicator insets the bottom!
    const bounds43 = computeSafeAreaHudBounds(932, 430, 3, VIEWPORT_800x600, {
      left: 59,
      right: 59,
      top: 0,
      bottom: 21,
    })
    expect(bounds43.insetLeftLogical).toBe(0)
    expect(bounds43.insetRightLogical).toBe(0)
    expect(bounds43.insetBottomLogical).toBeCloseTo(21 / (430 / 600), 2)
    expect(bounds43.safeBottomLogical).toBeCloseTo(600 - 21 / (430 / 600), 2)

    // Case 2: 1280x720 widescreen profile filling a 1280x720 mobile viewport with 48px left/right cutouts
    const boundsWide = computeSafeAreaHudBounds(1280, 720, 2, VIEWPORT_1280x720, {
      left: 48,
      right: 48,
      top: 0,
      bottom: 20,
    })
    expect(boundsWide.safeLeftLogical).toBe(48)
    expect(boundsWide.safeRightLogical).toBe(1280 - 48)
    expect(boundsWide.safeBottomLogical).toBe(720 - 20)
    expect(boundsWide.safeWidthLogical).toBe(1184)

    // Case 3: 1068x600 widescreen profile
    const bounds1068 = computeSafeAreaHudBounds(1068, 600, 2, VIEWPORT_1068x600, {
      left: 36,
      right: 36,
      top: 0,
      bottom: 16,
    })
    expect(bounds1068.safeLeftLogical).toBe(36)
    expect(bounds1068.safeRightLogical).toBe(1032)
    expect(bounds1068.safeBottomLogical).toBe(584)
  })
})

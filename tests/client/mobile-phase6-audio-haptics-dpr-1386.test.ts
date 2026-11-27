import { describe, expect, it, vi } from 'vitest'
import {
  buildMobileSoftKeyboardInputAttrs,
  clampMobileDevicePixelRatio,
  evaluateMobileThermalFrameStep,
  resolveGoldQuickPresetAmount,
  syncMobileAudioVisibility,
  triggerMobileHaptic,
  unlockMobileAudioContext,
} from '../../src/client/ui/touch-controls.ts'
import { sanitizeClientSettings } from '../../src/client/settings/client-settings.ts'

describe('Mobile Phase 6 (#1386): WebAudio Unlock, Multi-Tier Haptics, Adaptive DPR & Soft Keyboard Bridge', () => {
  it('unlocks suspended/interrupted WebAudio context on first gesture and suspends/resumes on visibilitychange', async () => {
    let state = 'suspended'
    const mockAudio = {
      get state() {
        return state
      },
      resume: vi.fn(async () => {
        state = 'running'
      }),
      suspend: vi.fn(async () => {
        state = 'suspended'
      }),
    }

    expect(await unlockMobileAudioContext(mockAudio)).toBe(true)
    expect(mockAudio.resume).toHaveBeenCalledTimes(1)
    expect(mockAudio.state).toBe('running')

    // Backgrounding tab suspends audio
    await syncMobileAudioVisibility(mockAudio, true)
    expect(mockAudio.suspend).toHaveBeenCalledTimes(1)
    expect(mockAudio.state).toBe('suspended')

    // Returning to foreground resumes audio
    await syncMobileAudioVisibility(mockAudio, false)
    expect(mockAudio.resume).toHaveBeenCalledTimes(2)
    expect(mockAudio.state).toBe('running')
  })

  it('triggers multi-tier haptics (tap=10ms, rareDrop=[30,50,60]ms, lowHpWarning=[45,40,45]ms) and degrades safely on iOS', () => {
    const patterns: Array<number | number[]> = []
    const mockNav = {
      vibrate: (p: number | number[]) => {
        patterns.push(p)
        return true
      },
    }

    expect(triggerMobileHaptic('tap', true, mockNav)).toBe(true)
    expect(triggerMobileHaptic('rareDrop', true, mockNav)).toBe(true)
    expect(triggerMobileHaptic('lowHpWarning', true, mockNav)).toBe(true)
    expect(patterns).toEqual([10, [30, 50, 60], [45, 40, 45]])

    // Disabled haptics or missing navigator.vibrate (iOS Safari) returns false without throwing
    expect(triggerMobileHaptic('tap', false, mockNav)).toBe(false)
    expect(triggerMobileHaptic('rareDrop', true, {})).toBe(false)
    expect(triggerMobileHaptic('rareDrop', true, null)).toBe(false)

    const settings = sanitizeClientSettings({ mobileHapticsEnabled: false })
    expect(settings.mobileHapticsEnabled).toBe(false)
  })

  it('clamps mobile DPR to 1.75 and steps down DPR/FPS when thermal frame times exceed 25ms (< 40 FPS)', () => {
    // 3x Retina mobile phone is clamped to 1.75x to prevent GPU fill-rate throttling
    expect(clampMobileDevicePixelRatio(3, true, 1.75)).toBe(1.75)
    // Desktop 2x monitor remains 2.0
    expect(clampMobileDevicePixelRatio(2, false, 1.75)).toBe(2)

    // Smooth 60 FPS (16.5ms average) keeps 1.75 DPR and 60 FPS cap
    const smooth = evaluateMobileThermalFrameStep([16.2, 16.8, 16.5, 16.6], 1.75)
    expect(smooth.throttled).toBe(false)
    expect(smooth.recommendedMaxDpr).toBe(1.75)
    expect(smooth.recommendedFpsCap).toBe(60)

    // Thermal lag (31ms average -> ~32 FPS) steps down DPR 1.75 -> 1.25 and recommends 30 FPS cap
    const throttled = evaluateMobileThermalFrameStep([30, 32, 31, 33], 1.75)
    expect(throttled.throttled).toBe(true)
    expect(throttled.recommendedMaxDpr).toBe(1.25)
    expect(throttled.recommendedFpsCap).toBe(30)
  })

  it('provides mobile soft-keyboard input attributes and 1-tap gold quick presets (25%/50%/75%/MAX)', () => {
    expect(buildMobileSoftKeyboardInputAttrs('gold')).toEqual({
      type: 'text',
      inputMode: 'numeric',
      pattern: '[0-9]*',
      enterKeyHint: 'done',
      autoComplete: 'off',
    })
    expect(buildMobileSoftKeyboardInputAttrs('chat')).toEqual({
      type: 'text',
      inputMode: 'text',
      enterKeyHint: 'send',
      autoComplete: 'off',
    })

    expect(resolveGoldQuickPresetAmount('25%', 10000)).toBe(2500)
    expect(resolveGoldQuickPresetAmount('50%', 10000)).toBe(5000)
    expect(resolveGoldQuickPresetAmount('75%', 10000)).toBe(7500)
    expect(resolveGoldQuickPresetAmount('max', 10000)).toBe(10000)
  })
})

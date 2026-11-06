import { describe, expect, it } from 'vitest'
import {
  CONTRAST_DEFAULT_113C,
  CONTRAST_MAX_113C,
  CONTRAST_MIN_113C,
  GAMMA_DEFAULT_113C,
  GAMMA_MAX_113C,
  GAMMA_MIN_113C,
  applyGammaRampToRgb113c,
  buildFogGammaRamp113c,
  contrastFromSliderStep113c,
  gammaFromSliderStep113c,
  sliderStepFromContrast113c,
  sliderStepFromGamma113c,
} from '../../src/common/gfx/gamma-contrast-113c.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import { computeOptionsSubmenuLayout } from '../../src/client/ui/panels/escape-options-menu.ts'

describe('#1734 (D2CMP-GFX-4): 1.13c Gamma and Contrast video options (Fog #10198 @ 0x6FF712C0)', () => {
  it('computes the exact Fog.dll #10198 (0x6FF712C0) 256-entry ramp for neutral, D3D/DDraw, Glide, and blended contrast', () => {
    // Neutral gamma = 100 -> identity ramp (_ftol of (i * (1/255)) * 255)
    const identityRamp = buildFogGammaRamp113c(100, 100, 256, 255)
    expect(identityRamp[0]).toBe(0)
    expect(identityRamp[255]).toBe(255)
    for (let i = 0; i < 256; i++) {
      expect(identityRamp[i]).toBe(Math.trunc(i * (1 / 255) * 255))
    }

    // D2Direct3D / D2DDraw default: gamma = 155 (0x9B), contrast = 100 (0x64) -> linear slope 1.55 clamped at 255
    const d3dRamp = buildFogGammaRamp113c(GAMMA_DEFAULT_113C, CONTRAST_DEFAULT_113C, 256, 255)
    expect(d3dRamp[0]).toBe(0)
    expect(d3dRamp[100]).toBe(Math.trunc(Math.min(255, (100 / 255) * 255 * 1.55))) // 155
    expect(d3dRamp[200]).toBe(255)
    expect(d3dRamp[255]).toBe(255)

    // D2Glide default: gamma = 155, contrast = 0 -> pure power curve pow(i / 255, 100 / 155) * 255
    const glideRamp = buildFogGammaRamp113c(GAMMA_DEFAULT_113C, 0, 256, 255)
    expect(glideRamp[0]).toBe(0)
    expect(glideRamp[128]).toBe(Math.trunc(Math.pow(128 / 255, 100 / 155) * 255))
    expect(glideRamp[255]).toBe(255)

    // Blended contrast = 50: 50% power curve + 50% linear slope
    const blendedRamp = buildFogGammaRamp113c(GAMMA_DEFAULT_113C, 50, 256, 255)
    const x100 = 100 / 255
    const lin100 = Math.min(255, x100 * 255 * 1.55)
    const pow100 = Math.pow(x100, 100 / 155) * 255
    expect(blendedRamp[100]).toBe(Math.trunc((pow100 * 50 + lin100 * 50) * 0.01))

    // Remaps RGB bytes through the ramp (D2DDraw 0x6F8C8101..0x6F8C81A8)
    const sampleRgb = new Uint8Array([0, 100, 200])
    const remapped = applyGammaRampToRgb113c(sampleRgb, d3dRamp)
    expect(Array.from(remapped)).toEqual([0, 155, 255])
  })

  it('matches D2Client.dll 0x6FB13620 / 0x6FB136A0 21-step slider conversions for Gamma (55..255) and Contrast (0..100)', () => {
    expect(gammaFromSliderStep113c(0)).toBe(GAMMA_MIN_113C)
    expect(gammaFromSliderStep113c(10)).toBe(GAMMA_DEFAULT_113C)
    expect(gammaFromSliderStep113c(20)).toBe(GAMMA_MAX_113C)

    expect(sliderStepFromGamma113c(GAMMA_MIN_113C)).toBe(0)
    expect(sliderStepFromGamma113c(GAMMA_DEFAULT_113C)).toBe(10)
    expect(sliderStepFromGamma113c(GAMMA_MAX_113C)).toBe(20)

    expect(contrastFromSliderStep113c(0)).toBe(CONTRAST_MIN_113C)
    expect(contrastFromSliderStep113c(10)).toBe(50)
    expect(contrastFromSliderStep113c(20)).toBe(CONTRAST_MAX_113C)

    expect(sliderStepFromContrast113c(CONTRAST_MIN_113C)).toBe(0)
    expect(sliderStepFromContrast113c(50)).toBe(10)
    expect(sliderStepFromContrast113c(CONTRAST_MAX_113C)).toBe(20)
  })

  it('exposes Gamma and Contrast sliders in the Escape Video Options submenu and persists adjustments to SettingsStore', () => {
    const store = new SettingsStore({
      storage: null,
      defaultLang: 'en',
    })
    const hud = new HudManager()
    hud.setLang('en')
    hud.configureEscapeMenuSettings({
      getSettings: () => ({
        masterVolume: store.get().masterVolume,
        audioMuted: store.get().audioMuted,
        viewport: store.get().viewport,
        worldRenderFps: store.get().worldRenderFps,
        gamma: store.get().gamma,
        contrast: store.get().contrast,
        keyBindings: store.get().keyBindings,
        fullscreenActive: false,
        fullscreenSupported: true,
      }),
      onUpdateSettings: (patch) => {
        store.set(patch)
      },
    })

    expect(store.get().gamma).toBe(155)
    expect(store.get().contrast).toBe(100)

    // Open Escape -> Options -> Video Options
    hud.toggleEscapeMenu()
    hud.activateEscapeMenuIndex(0) // -> 'options'
    hud.handleKeyDown({ key: 'ArrowDown' }) // row 1: VIDEO OPTIONS
    hud.handleKeyDown({ key: 'Enter' })
    expect(hud.escapeMenuScreen).toBe('video')

    // Navigate to Row 3: GAMMA
    hud.handleKeyDown({ key: 'ArrowDown' }) // 1: resolution
    hud.handleKeyDown({ key: 'ArrowDown' }) // 2: frameRate
    hud.handleKeyDown({ key: 'ArrowDown' }) // 3: gamma
    expect(hud.worldPanels.optionsSubmenuSelectedIndex).toBe(3)

    hud.handleKeyDown({ key: 'ArrowRight' })
    expect(store.get().gamma).toBe(165)
    hud.handleKeyDown({ key: 'ArrowLeft' })
    hud.handleKeyDown({ key: 'ArrowLeft' })
    expect(store.get().gamma).toBe(145)

    // Navigate to Row 4: CONTRAST
    hud.handleKeyDown({ key: 'ArrowDown' }) // 4: contrast
    expect(hud.worldPanels.optionsSubmenuSelectedIndex).toBe(4)
    hud.handleKeyDown({ key: 'ArrowLeft' })
    expect(store.get().contrast).toBe(95)

    // Verify mouse click/drag on the Contrast slider
    const videoLayout = computeOptionsSubmenuLayout(
      'video',
      800,
      600,
      4,
      0,
      undefined,
      'en',
    )
    const contrastRow = videoLayout.rows.find((r) => r.id === 'contrast')!
    expect(contrastRow.sliderBounds).toBeDefined()
    const midX = contrastRow.sliderBounds!.left + Math.round(contrastRow.sliderBounds!.width * 0.5)
    const midY = contrastRow.rowY + 20
    hud.handleEscapeMenuClick(midX, midY)
    expect(store.get().contrast).toBe(50)
    hud.handleHudMouseUp(midX, midY, 0)
  })
})

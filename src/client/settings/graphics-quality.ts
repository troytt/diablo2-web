/**
 * Graphics quality presets (performance mode): a port-only, presentation-layer option.
 *
 * The preset never rewrites the user's own options. Instead {@link resolveEffectiveGraphics} derives
 * the values the renderer actually uses: `high` passes the user's settings through untouched, while
 * `medium` / `low` clamp them down. Switching back to `high` therefore restores every original value
 * without a snapshot/restore step.
 *
 * Every knob is purely visual: netproto, world simulation, hit detection and drops never read it.
 *
 * Resolution knobs:
 * - 1.13c data mode renders the world into an integer-scaled crisp backing store
 *   (`syncCrispBackingStore`, up to 4x). `maxCrispScale` caps that factor; the canvas is CSS
 *   `image-rendering: pixelated`, so a lower factor keeps the same look with far fewer pixels.
 * - PD2 data mode upscales through D2GL (`d2gl.json` `graphics.shader_preset` / `graphics.sharpen`):
 *   `high` keeps the PD2 default (`cubic\\bicubic.slangp` + LumaSharpen), `medium` keeps the bicubic
 *   kernel without LumaSharpen, `low` uses the stock `bilinear.slangp` preset from
 *   `Data/shaders/list.txt` with sharpening off. `maxRenderDpr` caps the upscaled backbuffer.
 */

import { PD2_D2GL_CONFIG, type D2GlGraphicsConfig } from '../../common/ui/pd2-d2gl.ts'
import type { LightQualitySetting } from './client-settings.ts'

export type GraphicsQuality = 'high' | 'medium' | 'low'

export const VALID_GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ['high', 'medium', 'low'] as const

export const DEFAULT_GRAPHICS_QUALITY: GraphicsQuality = 'high'

/** Normalize a persisted value; anything unknown falls back to {@link DEFAULT_GRAPHICS_QUALITY}. */
export function normalizeGraphicsQuality(value: unknown): GraphicsQuality {
  return value === 'high' || value === 'medium' || value === 'low' ? value : DEFAULT_GRAPHICS_QUALITY
}

/** The user-facing settings a preset may clamp. */
export interface GraphicsQualityInputs {
  readonly graphicsQuality?: GraphicsQuality | undefined
  readonly worldRenderFps: 30 | 60
  readonly lightQuality: LightQualitySetting
}

/** The values the render loop actually uses for one frame. */
export interface EffectiveGraphics {
  readonly quality: GraphicsQuality
  readonly worldRenderFps: 30 | 60
  readonly lightQuality: LightQualitySetting
  /** Upper bound for the 1.13c crisp backing-store integer scale (`syncCrispBackingStore`). */
  readonly maxCrispScale: number
  /** Upper bound for the PD2 D2GL upscaled backbuffer device-pixel ratio. */
  readonly maxRenderDpr: number
  /** PD2 D2GL post-process overrides (`shader_preset`, `sharpen`). */
  readonly postProcess: Pick<D2GlGraphicsConfig, 'shaderPreset' | 'sharpen'>
  /**
   * Max decorative VFX (non-colliding missiles + one-shot overlays on other units) drawn per frame,
   * nearest to the camera first. `Infinity` = no cap. See `selectVfxSkipSet`.
   */
  readonly vfxBudget: number
  /** Max ground item labels per frame (hovered label always kept). `Infinity` = no cap. */
  readonly groundLabelMax: number
}

/** PD2 `d2gl.json` default upscaler, used by `high`. */
const PD2_DEFAULT_POST_PROCESS: EffectiveGraphics['postProcess'] = {
  shaderPreset: PD2_D2GL_CONFIG.graphics.shaderPreset,
  sharpen: PD2_D2GL_CONFIG.graphics.sharpen,
}

/** Stock D2GL `bilinear.slangp` (first entry of `Data/shaders/list.txt`), no LumaSharpen. */
const BILINEAR_POST_PROCESS: EffectiveGraphics['postProcess'] = {
  shaderPreset: 'bilinear.slangp',
  sharpen: false,
}

export const MEDIUM_VFX_BUDGET = 64
export const LOW_VFX_BUDGET = 24
export const MEDIUM_GROUND_LABEL_MAX = 30
export const LOW_GROUND_LABEL_MAX = 12

function minLightQuality(a: LightQualitySetting, b: LightQualitySetting): LightQualitySetting {
  return a < b ? a : b
}

/** Derive the frame's effective graphics values from the user's settings. */
export function resolveEffectiveGraphics(settings: GraphicsQualityInputs): EffectiveGraphics {
  const quality = normalizeGraphicsQuality(settings.graphicsQuality)
  switch (quality) {
    case 'low':
      return {
        quality,
        worldRenderFps: 30,
        lightQuality: 0,
        maxCrispScale: 1,
        maxRenderDpr: 1,
        postProcess: BILINEAR_POST_PROCESS,
        vfxBudget: LOW_VFX_BUDGET,
        groundLabelMax: LOW_GROUND_LABEL_MAX,
      }
    case 'medium':
      return {
        quality,
        worldRenderFps: settings.worldRenderFps,
        lightQuality: minLightQuality(settings.lightQuality, 1),
        maxCrispScale: 2,
        maxRenderDpr: 1.5,
        postProcess: { shaderPreset: PD2_DEFAULT_POST_PROCESS.shaderPreset, sharpen: false },
        vfxBudget: MEDIUM_VFX_BUDGET,
        groundLabelMax: MEDIUM_GROUND_LABEL_MAX,
      }
    case 'high':
    default:
      return {
        quality: 'high',
        worldRenderFps: settings.worldRenderFps,
        lightQuality: settings.lightQuality,
        maxCrispScale: Number.POSITIVE_INFINITY,
        maxRenderDpr: Number.POSITIVE_INFINITY,
        postProcess: PD2_DEFAULT_POST_PROCESS,
        vfxBudget: Number.POSITIVE_INFINITY,
        groundLabelMax: Number.POSITIVE_INFINITY,
      }
  }
}

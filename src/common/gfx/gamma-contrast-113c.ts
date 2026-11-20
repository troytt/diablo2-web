/**
 * Diablo II v1.13c Gamma & Contrast Ramp Generator (`Fog.dll #10198` @ `0x6FF712C0`,
 * `D2gfx.dll` @ `0x6FA8AEE0` / `0x6FA8B1E0`, `D2Direct3D.dll` @ `0x6F88A640` / `0x6F88AE00`,
 * `D2DDraw.dll` @ `0x6F8C7FF0` / `0x6F8C80C0`, and `D2Client.dll` @ `0x6FB14110` / `0x6FB14150`).
 *
 * Ground truth: `kb/render/d2gfx-gamma-contrast-113c.md`.
 */

/** Minimum 1.13c Gamma slider value (`0x37` in `D2Client.dll` `0x6FB14158` / `0x6FB148BC`). */
export const GAMMA_MIN_113C = 55

/** Maximum 1.13c Gamma slider value (`0xFF` in `D2Client.dll` `0x6FB14153` / `0x6FB148B7`). */
export const GAMMA_MAX_113C = 255

/** Default 1.13c Gamma registry value (`0x9B` = 155 in `D2gfx.dll` `0x6FA8AF2F` & `D2Client.dll` `0x6FB148A5`). */
export const GAMMA_DEFAULT_113C = 155

/** Neutral identity Gamma value (`100` where `pow(x, 100/100) == x` and `x * 100 * 0.01 == x`). */
export const GAMMA_NEUTRAL_113C = 100

/** Minimum 1.13c Contrast slider value (`0` in `D2Client.dll` `0x6FB14118` / `0x6FB14847`). */
export const CONTRAST_MIN_113C = 0

/** Maximum 1.13c Contrast slider value (`0x64` = 100 in `D2Client.dll` `0x6FB14113` / `0x6FB14842`). */
export const CONTRAST_MAX_113C = 100

/**
 * Default 1.13c Contrast value (`D2gfx.dll` `0x6FA8AF02`: `(renderMode == 4) ? 0 : 100`).
 */
export const CONTRAST_DEFAULT_113C = 100

/** Number of discrete steps on the 1.13c Gamma and Contrast OptBar sliders (`0..20`, count = 21). */
export const GAMMA_CONTRAST_SLIDER_STEPS_113C = 21

/**
 * Clamp and normalize a 1.13c Gamma value into `[55, 255]` (default `155`).
 */
export function normalizeGamma113c(
  value: unknown,
  fallback: number = GAMMA_DEFAULT_113C,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(GAMMA_MIN_113C, Math.min(GAMMA_MAX_113C, Math.round(value)))
}

/**
 * Clamp and normalize a 1.13c Contrast value into `[0, 100]` (default `100`).
 */
export function normalizeContrast113c(
  value: unknown,
  fallback: number = CONTRAST_DEFAULT_113C,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(CONTRAST_MIN_113C, Math.min(CONTRAST_MAX_113C, Math.round(value)))
}

/**
 * `D2Client.dll` `0x6FB13620(maxVal = 0xFF, minVal = 0x37, row)`:
 * Converts a 21-step slider index (`0..20`) to a 1.13c Gamma value (`55..255`, step `10`).
 */
export function gammaFromSliderStep113c(step: number): number {
  const clampedStep = Math.max(0, Math.min(GAMMA_CONTRAST_SLIDER_STEPS_113C - 1, Math.trunc(step)))
  return Math.trunc(
    ((GAMMA_MAX_113C - GAMMA_MIN_113C) / (GAMMA_CONTRAST_SLIDER_STEPS_113C - 1)) * clampedStep +
      GAMMA_MIN_113C,
  )
}

/**
 * `D2Client.dll` `0x6FB136A0(value, maxVal = 0xFF, minVal = 0x37, row)`:
 * Converts a 1.13c Gamma value (`55..255`, default `155` -> step `10`) to a 21-step slider index (`0..20`).
 */
export function sliderStepFromGamma113c(gamma: number): number {
  const clamped = normalizeGamma113c(gamma)
  const step = Math.trunc(
    ((GAMMA_CONTRAST_SLIDER_STEPS_113C - 1) * (clamped - GAMMA_MIN_113C + 1)) /
      (GAMMA_MAX_113C - GAMMA_MIN_113C),
  )
  return Math.max(0, Math.min(GAMMA_CONTRAST_SLIDER_STEPS_113C - 1, step))
}

/**
 * `D2Client.dll` `0x6FB13620(maxVal = 0x64, minVal = 0, row)`:
 * Converts a 21-step slider index (`0..20`) to a 1.13c Contrast value (`0..100`, step `5`).
 */
export function contrastFromSliderStep113c(step: number): number {
  const clampedStep = Math.max(0, Math.min(GAMMA_CONTRAST_SLIDER_STEPS_113C - 1, Math.trunc(step)))
  return Math.trunc(
    ((CONTRAST_MAX_113C - CONTRAST_MIN_113C) / (GAMMA_CONTRAST_SLIDER_STEPS_113C - 1)) *
      clampedStep +
      CONTRAST_MIN_113C,
  )
}

/**
 * `D2Client.dll` `0x6FB136A0(value, maxVal = 0x64, minVal = 0, row)`:
 * Converts a 1.13c Contrast value (`0..100`) to a 21-step slider index (`0..20`).
 */
export function sliderStepFromContrast113c(contrast: number): number {
  const clamped = normalizeContrast113c(contrast)
  const step = Math.trunc(
    ((GAMMA_CONTRAST_SLIDER_STEPS_113C - 1) * (clamped - CONTRAST_MIN_113C + 1)) /
      (CONTRAST_MAX_113C - CONTRAST_MIN_113C),
  )
  return Math.max(0, Math.min(GAMMA_CONTRAST_SLIDER_STEPS_113C - 1, step))
}

/**
 * Exact `Fog.dll #10198` (`0x6FF712C0`) gamma/contrast ramp generator.
 *
 * For each `i = 0 .. count - 1` (`x = i / (count - 1)`):
 * - `lin = min(maxVal, x * maxVal * (gamma * 0.01))`
 * - `powTerm = pow(x, 100.0 / gamma) * maxVal * (100.0 - contrast)`
 * - `out[i] = Math.trunc((powTerm + lin * contrast) * 0.01)` (`_ftol` at `0x6FF7159C`).
 *
 * @param gamma - 1.13c gamma integer (`> 0`, typically `55..255`, default `155`).
 * @param contrast - 1.13c contrast percentage (`0..100`, default `100` in D3D/DDraw, `0` in Glide).
 * @param count - number of ramp entries (`256` in `D2Direct3D` and `D2DDraw`).
 * @param maxVal - maximum output value (`255` for 8-bit palette LUT, `65535` for 16-bit D3D `SetGammaRamp`).
 */
export function buildFogGammaRamp113c(
  gamma: number,
  contrast: number = CONTRAST_DEFAULT_113C,
  count = 256,
  maxVal = 255,
): Uint8Array {
  const out = new Uint8Array(count)
  if (count <= 0 || maxVal <= 0) return out
  const safeGamma = Math.max(1, Math.trunc(gamma))
  const safeContrast = Math.max(0, Math.min(100, contrast))
  const oneMinusContrast = 100.0 - safeContrast
  const gammaScale = safeGamma * 0.01
  const gammaExp = 100.0 / safeGamma
  const denom = count - 1.0
  if (denom <= 0) return out
  const invRange = 1.0 / denom

  for (let i = 0; i < count; i += 1) {
    const x = i * invRange
    let lin = x * maxVal * gammaScale
    if (lin > maxVal) {
      lin = maxVal
    }
    const powVal = x <= 0 ? 0 : Math.pow(x, gammaExp)
    const powTerm = powVal * maxVal * oneMinusContrast
    const combined = (powTerm + lin * safeContrast) * 0.01
    const truncated = Math.trunc(combined)
    out[i] = Math.max(0, Math.min(maxVal, truncated))
  }
  return out
}

/**
 * Remap an RGB or RGBA palette buffer in-place or into a new `Uint8Array` using a 256-entry
 * `Fog #10198` ramp (`D2DDraw.dll` `0x6F8C8101..0x6F8C81A8`).
 */
export function applyGammaRampToRgb113c(
  rgb: Uint8Array,
  ramp: ArrayLike<number>,
): Uint8Array {
  const out = new Uint8Array(rgb.length)
  for (let i = 0; i < rgb.length; i += 1) {
    const c = rgb[i] ?? 0
    out[i] = ramp[c] ?? c
  }
  return out
}

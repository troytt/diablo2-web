const MAX_PIXEL_SCALE = 4
const SCALE_EPSILON = 0.02

export const crispPixelScale = (displayScale: number): number =>
  Number.isFinite(displayScale) && displayScale > 1 ? Math.min(MAX_PIXEL_SCALE, Math.ceil(displayScale - SCALE_EPSILON)) : 1

export const crispRenderDpr = (uiScale: number, dpr: number): number =>
  Number.isFinite(uiScale) && uiScale > 0 ? crispPixelScale(uiScale * dpr) / uiScale : dpr

export const devicePixelRatioOrOne = (): number =>
  typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1

export const syncCrispBackingStore = (canvas: HTMLCanvasElement, nativeWidth: number, nativeHeight: number): number => {
  const scale = crispPixelScale(Math.max(canvas.clientWidth / nativeWidth, canvas.clientHeight / nativeHeight) * devicePixelRatioOrOne())
  const [width, height] = [nativeWidth * scale, nativeHeight * scale]
  if (canvas.width !== width || canvas.height !== height) Object.assign(canvas, { width, height })
  return scale
}

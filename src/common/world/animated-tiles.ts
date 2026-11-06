/**
 * DT1 Animated Tiles controller and runtime helpers.
 *
 * In Diablo II, certain environmental tiles (water ripples, lava, torches,
 * fountains, cauldrons) are stored in DT1 format as animated sequences.
 *
 * Each animated tile group shares the same (style, sequence, type), with
 * byte +7 (animated flag) set, and `rarityFrameIndex` indicating the 0-based
 * animation frame index.
 *
 * In Diablo II 1.13c / 1.10f, animated tile speed is driven by the `Animate` column
 * in `LvlPrest.txt` (column index 6, name 'Animate').
 * `DRLGANIM_AllocAnimationTileGrids` receives `pLvlPrestTxtRecord->nAnimSpeed`.
 * In the original code: `if (nAnimationSpeed == 0) nAnimationSpeed = 80;`
 * Fixed-point step: `nCurrentFrame = (nCurrentFrame + nAnimationSpeed) % (nFrames << 8);`
 * (low 8 bits are fractional).
 * Speed 80 means 80/256 frames per tick.
 * At standard 25Hz simulation rate: 25 * 80 / 256 = 7.8125 FPS => 128 ms per frame.
 */
export interface AtlasFrame {
  /** Left edge. */
  readonly x: number
  /** Top edge. */
  readonly y: number
  /** Frame width. */
  readonly width: number
  /** Frame height. */
  readonly height: number
  /** Horizontal anchor offset in sprite space (box.left in DCC coordinates). */
  readonly anchorX?: number
  /** Vertical anchor offset in sprite space (box.top in DCC coordinates). */
  readonly anchorY?: number
}

/**
 * Calculate frame duration in milliseconds from LvlPrest.txt Animate column value (animSpeed).
 *
 * In Diablo II 1.13c / 1.10f:
 * - `DRLGANIM_AllocAnimationTileGrids` receives `pLvlPrestTxtRecord->nAnimSpeed`.
 * - If `nAnimationSpeed == 0`, it defaults to 80 (`if (nAnimationSpeed == 0) nAnimationSpeed = 80;`).
 * - Fixed-point step: `nCurrentFrame = (nCurrentFrame + nAnimationSpeed) % (nFrames << 8);` (low 8 bits are fractional).
 * - Speed 80 means 80/256 frames per tick.
 * - At 25Hz simulation rate: 25 * 80 / 256 = 7.8125 FPS => (256 / speed) * (1000 / 25) ms per frame.
 *
 * @param animSpeed - speed from LvlPrest.txt Animate column
 * @returns duration of each frame in milliseconds
 */
export function frameDurationMsFromAnimSpeed(animSpeed?: number): number {
  const speed = (!animSpeed || animSpeed <= 0) ? 80 : animSpeed
  return (256 / speed) * (1000 / 25)
}

/** Default playback duration per animated tile frame in milliseconds (128ms / 7.8125 FPS in Diablo II 1.13c, speed 80). */
export const DEFAULT_ANIMATED_TILE_FRAME_DURATION_MS = 128
/** Game ticks per animation frame at standard 25Hz simulation rate (2.5 ticks/frame = 100ms/frame). */
export const DEFAULT_TICKS_PER_ANIMATED_FRAME = 2.5

/** One placed frame of an animated tile. */
export interface AnimatedFrame {
  readonly frame: AtlasFrame
  readonly page: number
}

/** An animated tile or drawable that can advance frames. */
export interface AnimatableTile {
  frame: AtlasFrame
  page: number
  readonly animatedFrames?: readonly AnimatedFrame[] | undefined
  currentFrameIndex?: number | undefined
  animTimeMs?: number | undefined
}

/**
 * Compute the frame index given elapsed time and total frames.
 * Automatically wraps around (modulo) to create a seamless loop.
 *
 * @param elapsedMs - elapsed milliseconds (game clock or timestamp).
 * @param totalFrames - total number of frames in the animation sequence.
 * @param frameDurationMs - duration of each frame in milliseconds (default 100ms / 10 FPS).
 * @returns the 0-based frame index within [0, totalFrames - 1].
 */
export function computeFrameIndexFromTime(
  elapsedMs: number,
  totalFrames: number,
  frameDurationMs = DEFAULT_ANIMATED_TILE_FRAME_DURATION_MS,
): number {
  if (totalFrames <= 1) return 0
  const duration = frameDurationMs > 0 ? frameDurationMs : DEFAULT_ANIMATED_TILE_FRAME_DURATION_MS
  return Math.floor(Math.max(0, elapsedMs) / duration) % totalFrames
}

/**
 * Compute the frame index given game simulation ticks and total frames.
 * Automatically wraps around (modulo) to create a seamless loop.
 *
 * @param tick - simulation tick count (at 25Hz).
 * @param totalFrames - total number of frames in the animation sequence.
 * @param ticksPerFrame - ticks elapsed per frame (default 2.5 ticks / frame).
 * @returns the 0-based frame index within [0, totalFrames - 1].
 */
export function computeFrameIndexFromTick(
  tick: number,
  totalFrames: number,
  ticksPerFrame = DEFAULT_TICKS_PER_ANIMATED_FRAME,
): number {
  if (totalFrames <= 1) return 0
  const rate = ticksPerFrame > 0 ? ticksPerFrame : DEFAULT_TICKS_PER_ANIMATED_FRAME
  return Math.floor(Math.max(0, tick) / rate) % totalFrames
}

/**
 * Advance a frame index by a given step with cycle wrapping.
 *
 * @param currentIndex - current frame index.
 * @param frameCount - total number of frames.
 * @param step - number of frames to advance (default 1, can be negative).
 * @returns the new frame index within [0, frameCount - 1].
 */
export function advanceFrameIndex(currentIndex: number, frameCount: number, step = 1): number {
  if (frameCount <= 1) return 0
  const next = (currentIndex + step) % frameCount
  return next >= 0 ? next : next + frameCount
}

/**
 * Update an animatable tile's current frame according to clock (timestamp or tick).
 *
 * @param tile - the animatable tile to update.
 * @param clock - current timestamp in ms or tick count.
 * @param mode - 'time' for millisecond timestamps or 'tick' for simulation ticks.
 * @param rate - optional override for frame duration (ms) or ticks per frame.
 * @returns true if the frame index changed, false otherwise.
 */
export function updateAnimatableTile(
  tile: AnimatableTile,
  clock: number,
  mode: 'time' | 'tick' = 'time',
  rate?: number,
): boolean {
  const frames = tile.animatedFrames
  if (!frames || frames.length <= 1) return false
  const targetIndex = mode === 'time'
    ? computeFrameIndexFromTime(clock, frames.length, rate)
    : computeFrameIndexFromTick(clock, frames.length, rate)
  if (targetIndex === tile.currentFrameIndex) return false
  tile.currentFrameIndex = targetIndex
  const targetFrame = frames[targetIndex]
  if (targetFrame !== undefined) {
    tile.frame = targetFrame.frame
    tile.page = targetFrame.page
    return true
  }
  return false
}

/**
 * Advance an animatable tile by a discrete step.
 *
 * @param tile - the animatable tile.
 * @param step - number of frames to advance (default 1).
 * @returns true if the frame index changed.
 */
export function advanceAnimatableTile(tile: AnimatableTile, step = 1): boolean {
  const frames = tile.animatedFrames
  if (!frames || frames.length <= 1) return false
  const currentIndex = tile.currentFrameIndex ?? 0
  const nextIndex = advanceFrameIndex(currentIndex, frames.length, step)
  if (nextIndex === tile.currentFrameIndex) return false
  tile.currentFrameIndex = nextIndex
  const targetFrame = frames[nextIndex]
  if (targetFrame !== undefined) {
    tile.frame = targetFrame.frame
    tile.page = targetFrame.page
    return true
  }
  return false
}

/**
 * Update a list of animatable tiles according to clock (timestamp or tick).
 *
 * @param tiles - array of animatable tiles.
 * @param clock - timestamp in ms or simulation tick.
 * @param mode - 'time' or 'tick'.
 * @param rate - optional rate override.
 * @returns the number of tiles whose active frame changed.
 */
export function updateAnimatableTiles(
  tiles: readonly AnimatableTile[],
  clock: number,
  mode: 'time' | 'tick' = 'time',
  rate?: number,
): number {
  let updated = 0
  for (let i = 0; i < tiles.length; i += 1) {
    if (updateAnimatableTile(tiles[i]!, clock, mode, rate)) {
      updated += 1
    }
  }
  return updated
}

/**
 * Advance all animatable tiles by a discrete step.
 *
 * @param tiles - array of animatable tiles.
 * @param step - step count.
 * @returns the number of tiles updated.
 */
export function advanceAnimatableTiles(tiles: readonly AnimatableTile[], step = 1): number {
  let updated = 0
  for (let i = 0; i < tiles.length; i += 1) {
    if (advanceAnimatableTile(tiles[i]!, step)) {
      updated += 1
    }
  }
  return updated
}

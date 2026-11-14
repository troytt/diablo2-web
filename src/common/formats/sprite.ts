/**
 * Shared sprite vocabulary: the frame/group/sheet shape every sprite decoder
 * produces, regardless of container (Diablo I `.cel`/`.cl2` today, Diablo II
 * `.dc6`/`.dcc` next).
 *
 * Frames stay palette-indexed on purpose. Both games implement unit variants
 * (a red skeleton, a black bow skeleton) as an index remap applied at draw
 * time, so keeping indices plus a transparency mask is what lets one decoded
 * sprite serve every variant without re-decoding — the same reason Diablo II's
 * palette shifts exist.
 */

/** One decoded frame. */
export interface SpriteFrame {
  /** Frame width in pixels. */
  readonly width: number
  /** Frame height in pixels. */
  readonly height: number
  /** Palette indices, row-major, `width * height` entries. */
  readonly indices: Uint8Array
  /** 1 where the pixel is opaque, 0 where transparent. */
  readonly mask: Uint8Array
  /** Horizontal anchor offset in sprite space (box.left in DCC coordinates). */
  readonly anchorX?: number
  /** Vertical anchor offset in sprite space (box.top in DCC coordinates). */
  readonly anchorY?: number
}

/** Frames belonging to one animation direction. */
export interface SpriteGroup {
  /** The group's frames, in animation order. */
  readonly frames: readonly SpriteFrame[]
}

/** A decoded file: one group for plain sheets, many for multi-direction art. */
export interface SpriteSheet {
  /** The groups, in file order. */
  readonly groups: readonly SpriteGroup[]
  /**
   * The uniform width every frame was decoded with, or null when the frames
   * were given individual widths.
   */
  readonly width: number | null
}

/** Raised when a sprite file cannot be decoded. */
export class CelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CelError'
  }
}

/** Smallest frame width worth trying. */
const MIN_WIDTH = 8
/**
 * Largest frame width worth trying. Diablo I's cutscene and panel art is
 * 640 wide, so the cap has to sit above that; Diablo II's widest sheets stay
 * below 256.
 */
const MAX_WIDTH = 1024

/**
 * Width candidates for auto-detection, smallest first.
 *
 * Only meaningful for formats whose runs are line-bounded (Diablo I `.cel`):
 * there a width is valid exactly when every row's runs sum to it, so a wrong
 * width is rejected outright. For formats whose runs may cross rows (`.cl2`,
 * Diablo II `.dcc`) the run stream is consumed to the frame end under *any*
 * width, so the width cannot be recovered from the file at all — the game
 * supplies it per animation, and so must a caller.
 *
 * @returns candidate widths.
 */
export function spriteWidthCandidates(): number[] {
  const widths: number[] = []
  for (let width = MIN_WIDTH; width <= MAX_WIDTH; width += 1) widths.push(width)
  return widths
}

/**
 * Player animation frame widths.
 *
 * These are the values the original game assigns in `SetPlrAnims`
 * (`Source/player.cpp` of the Devilution reconstruction): every class stands
 * and walks at 96 (the Hellfire monk at 112), attacks at 128, and drops to 96
 * for bow and unarmed attacks. They are data, not guesses — a `.cl2` file
 * cannot be decoded without them.
 */
export const PLAYER_SPRITE_WIDTH = {
  /** Stand and walk, base classes. */
  stand: 96,
  /** Walk, base classes. */
  walk: 96,
  /** Melee attack. */
  attack: 128,
  /** Attack without a weapon, or with a bow. */
  attackNarrow: 96,
  /** Stand/walk for the Hellfire monk. */
  monk: 112,
  /** Melee attack for the Hellfire monk. */
  monkAttack: 130,
} as const

/**
 * Compositing Diablo II's character and object animations.
 *
 * A `DCC` file holds one *layer* of an animation (a head, a torso, a leg, a
 * shield), and a `COF` file says which layers make up a given animation and in
 * what order they stack. Neither is drawable alone: the file that says "this is
 * the Sorceress walking" is the COF, and the pixels are in eight DCCs beside it.
 *
 * This module joins the two into the plain `SpriteSheet` the renderer already
 * consumes, so the rest of the engine treats a character exactly like a tile
 * atlas. It reuses the path convention the verification script proved out:
 * a layer record names no file — it carries a *composite type* (which body part)
 * and a *weapon class*, and the COF's own name carries the animation and weapon
 * codes, so the sprite path is
 * `<root><component>/<token><component><variant><animation><weapon>.dcc`.
 * `<variant>` is an armour/object tier code that lives in the item tables rather
 * than the COF; the lexicographically first candidate is taken, and the chosen
 * members are reported so the choice is visible instead of implied.
 */
import type { MpqArchive } from '../mpq/archive.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import { decodeCof, cofLayerOrder } from '../formats/cof.ts'
import type { CofFile } from '../formats/cof.ts'
import { decodeDcc } from '../formats/dcc.ts'
import type { DccFile } from '../formats/dcc.ts'
import type { SpriteFrame, SpriteSheet } from '../formats/sprite.ts'

/** Composite-type index → component directory, as the archives name them (all 16 layers hd..s8). */
export const COMPONENTS: readonly string[] = [
  'hd', 'tr', 'lg', 'ra', 'la', 'rh', 'lh', 'sh',
  's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8',
]

/** A composited animation, ready to draw. */
export interface CharacterSheet {
  /** One group per direction, frames in animation order. */
  readonly sheet: SpriteSheet
  /** Directions in the COF (16 for characters, fewer for objects). */
  readonly directions: number
  /** Frames per direction. */
  readonly framesPerDirection: number
  /** Layers the COF declared. */
  readonly layers: number
  /** Animation speed byte from the COF header (8.8 fixed-point, 256 = 25fps). */
  readonly speed?: number
  /** Layer/direction combinations skipped because a sprite was missing. */
  readonly skipped: number
  /** The DCC members that were decoded, for provenance. */
  readonly members: readonly string[]
  /** Non-fatal observations worth reporting. */
  readonly notes: readonly string[]
}

/**
 * Find the sprite a COF layer draws.
 *
 * @param names - the archive's name list.
 * @param root - directory shared by the COF and its art, e.g. `data\\global\\chars\\so\\`.
 * @param token - class or object code, e.g. `so`.
 * @param animation - two-letter animation code from the COF name, e.g. `wl`.
 * @param weapon - weapon-class code from the COF name, e.g. `hth`.
 * @param component - component directory for the layer's composite type.
 * @returns the member name, or undefined.
 */
function findLayerSprite(
  names: readonly string[],
  root: string,
  token: string,
  animation: string,
  weapon: string,
  component: string,
  litUnarmed = true,
): string | undefined {
  if (litUnarmed && (component === 'rh' || component === 'lh' || component === 'sh' || component.startsWith('s'))) {
    return undefined
  }
  const prefix = `${root}${component}\\${token}${component}`
  const suffix = `${animation}${weapon}.dcc`
  const litTarget = `${prefix}lit${suffix}`.toLowerCase()
  return names.find(h => h.toLowerCase() === litTarget)
}

/**
 * Blit one layer onto a bigger canvas.
 *
 * The frames are palette-indexed with a transparency mask, so compositing is a
 * "masked copy": later layers paint over earlier ones exactly where they have
 * pixels, which is the same rule the DT1 tile compositor uses.
 *
 * @param target - destination frame (its buffers are written).
 * @param source - layer frame.
 * @param atX - destination x.
 * @param atY - destination y.
 */
function blit(
  target: { indices: Uint8Array; mask: Uint8Array; width: number; height: number },
  source: SpriteFrame,
  atX: number,
  atY: number,
  skipShadowIndex = false,
): void {
  for (let y = 0; y < source.height; y += 1) {
    const ty = atY + y
    if (ty < 0 || ty >= target.height) continue
    for (let x = 0; x < source.width; x += 1) {
      const at = y * source.width + x
      if (source.mask[at] === 0) continue
      const tx = atX + x
      if (tx < 0 || tx >= target.width) continue
      const to = ty * target.width + tx
      const srcIdx = source.indices[at]!
      if (skipShadowIndex && (srcIdx === 0 || srcIdx === 172)) continue
      target.indices[to] = srcIdx
      target.mask[to] = 1
    }
  }
}

/**
 * Load and composite one animation.
 *
 * @param archives - the mounted archives.
 * @param token - class or object code, e.g. `so` for the Sorceress.
 * @param animation - animation code from the COF name, e.g. `wl` (walk) or `nu` (neutral).
 * @param weapon - weapon class, e.g. `hth` for unarmed.
 * @returns the composited animation.
 */
export async function loadCharacterSheet(
  archives: MountedArchives,
  token: string,
  animation: string,
  weapon: string,
  rootOverride?: string,
  litUnarmed = true,
): Promise<CharacterSheet> {
  const lower = token.toLowerCase()
  const root = rootOverride ?? `data\\global\\chars\\${lower}\\`
  const cofMember = `${root}cof\\${lower}${animation}${weapon}.cof`
  const cofBytes = await archives.read(cofMember)
  const cof: CofFile = decodeCof(cofBytes)

  const names = await archives.listFiles()
  const layerResults = await Promise.all(cof.layers.map(async (layer) => {
    const component = COMPONENTS[layer.type]
    if (component === undefined) {
      return { sprite: null, member: undefined, note: `layer type ${String(layer.type)} has no component directory` }
    }
    const layerWeapon = (layer.weaponClass && layer.weaponClass.trim().length > 0) ? layer.weaponClass.trim() : weapon
    let member = findLayerSprite(names, root, lower, animation, layerWeapon, component, litUnarmed)
    if (member === undefined && layerWeapon !== weapon) {
      member = findLayerSprite(names, root, lower, animation, weapon, component, litUnarmed)
    }
    if (member === undefined) {
      return { sprite: null, member: undefined, note: `no sprite for component ${component} (${animation}${layerWeapon})` }
    }
    try {
      const dcc = decodeDcc(await archives.read(member))
      return { sprite: dcc, member, note: undefined }
    } catch (err) {
      return { sprite: null, member: undefined, note: `${member}: ${(err as Error).message}` }
    }
  }))

  const notes: string[] = layerResults.flatMap(r => r.note ? [r.note] : [])
  const members: string[] = layerResults.flatMap(r => r.member ? [r.member] : [])
  const sprites: (DccFile | null)[] = layerResults.map(r => r.sprite)

  const groups: { frames: SpriteFrame[] }[] = []
  let skipped = 0
  for (let direction = 0; direction < cof.numberOfDirections; direction += 1) {
    const dir64 = Math.round((direction * 64) / cof.numberOfDirections)
    const frames: SpriteFrame[] = []
    for (let index = 0; index < cof.framesPerDirection; index += 1) {
      // Union box across the layers that have art for this direction, so every
      // layer keeps its position in sprite space.
      let left = Number.POSITIVE_INFINITY
      let top = Number.POSITIVE_INFINITY
      let right = Number.NEGATIVE_INFINITY
      let bottom = Number.NEGATIVE_INFINITY
      let placedCount = 0
      for (let layer = 0; layer < cof.layers.length; layer += 1) {
        const sprite = sprites[layer]
        if (sprite === null || sprite === undefined) continue
        const dccDir = dir64ToDcc(dir64, sprite.directions.length)
        const layerDirection = sprite.directions[dccDir]
        const frame = layerDirection?.frames[index]
        if (frame === undefined) { skipped += 1; continue }
        left = Math.min(left, layerDirection!.box.left)
        top = Math.min(top, layerDirection!.box.top)
        right = Math.max(right, layerDirection!.box.left + layerDirection!.box.width)
        bottom = Math.max(bottom, layerDirection!.box.top + layerDirection!.box.height)
        placedCount += 1
      }
      if (placedCount === 0) {
        frames.push({ width: 1, height: 1, indices: new Uint8Array(1), mask: new Uint8Array(1), anchorX: 0, anchorY: 0 })
        continue
      }
      const boxLeft = Math.round(left)
      const boxTop = Math.round(top)
      const width = Math.max(1, Math.round(right) - boxLeft)
      const height = Math.max(1, Math.round(bottom) - boxTop)
      const composed: SpriteFrame = {
        width, height, indices: new Uint8Array(width * height), mask: new Uint8Array(width * height),
        anchorX: boxLeft, anchorY: boxTop,
      }
      // Draw in the COF's own back-to-front order for this direction and frame;
      // the priority table is the authority on what covers what.
      const order = cofLayerOrder(cof, direction, index)
      const ordered = order
        .flatMap(layerIndex => {
          const sprite = sprites[layerIndex]
          return sprite != null ? [{ layerIndex, sprite }] : []
        })
      for (const entry of ordered) {
        const sprite = entry.sprite
        const cofLayer = cof.layers[entry.layerIndex]
        const skipShadowIndex = Boolean(cofLayer?.transparent && cofLayer.drawEffect <= 3)
        const dccDir = dir64ToDcc(dir64, sprite.directions.length)
        const layerDirection = sprite.directions[dccDir]
        const frame = layerDirection?.frames[index]
        if (frame === undefined) continue
        blit(
          composed,
          frame.frame,
          Math.round(layerDirection!.box.left) - boxLeft,
          Math.round(layerDirection!.box.top) - boxTop,
          skipShadowIndex,
        )
      }
      frames.push(composed)
    }
    groups.push({ frames })
  }

  return {
    sheet: { groups, width: null },
    directions: cof.numberOfDirections,
    framesPerDirection: cof.framesPerDirection,
    layers: cof.layers.length,
    speed: cof.speed,
    skipped,
    members,
    notes,
  }
}

/**
 * The engine's 64-direction space → COF direction tables.
 *
 * Ported from OpenDiablo2 `d2fileformats/d2cof/cof_dir_lookup.go` (`Dir64ToCof`),
 * which reproduces the engine's own lookup: the mapping is **not**
 * `floor(dir64 * n / 64)` — it is five literal tables, and they are uneven in
 * places (16 directions: `dir64` 0 and 1 → 0, 2..5 → 1, 6..9 → 2, …).
 */
const DIR64_TO_COF: Readonly<Record<number, readonly number[]>> = {
  4: [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  8: [
    0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2,
    2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4,
    4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6,
    6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0,
  ],
  16: [
    0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4,
    4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8,
    8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12,
    12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 0, 0,
  ],
  32: [
    0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8,
    8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16,
    16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24,
    24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 30, 30, 31, 31, 0,
  ],
  64: Array.from({ length: 64 }, (_, index) => index),
}

/**
 * Map a 64-direction space direction to a COF direction, the way the engine does.
 *
 * @param direction - 0..63.
 * @param directions - directions in the COF (4, 8, 16, 32 or 64).
 * @returns the COF direction index, 0 when the count is not one the engine uses.
 */
export function dir64ToCof(direction: number, directions: number): number {
  const table = DIR64_TO_COF[directions]
  if (table === undefined) return 0
  const index = ((Math.trunc(direction) % 64) + 64) % 64
  return table[index] ?? 0
}

/**
 * The engine's 64-direction space → DCC direction tables.
 *
 * Ported from OpenDiablo2 `d2fileformats/d2dcc/dcc_dir_lookup.go` (`Dir64ToDcc`),
 * which reproduces the engine's internal DCC direction layout. Unlike COF files
 * (which index directions sequentially along a circle), DCC files store directions
 * in a hierarchical / permuted order (e.g. 16 directions: 4, 8, 0, 9, 5, 10, ...).
 */
const DIR64_TO_DCC: Readonly<Record<number, readonly number[]>> = {
  4: [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  8: [
    4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5,
    5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 6, 6, 6, 6,
    6, 6, 6, 6, 2, 2, 2, 2, 2, 2, 2, 2, 7, 7, 7, 7,
    7, 7, 7, 7, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4,
  ],
  16: [
    4, 4, 8, 8, 8, 8, 0, 0, 0, 0, 9, 9, 9, 9, 5, 5,
    5, 5, 10, 10, 10, 10, 1, 1, 1, 1, 11, 11, 11, 11, 6, 6,
    6, 6, 12, 12, 12, 12, 2, 2, 2, 2, 13, 13, 13, 13, 7, 7,
    7, 7, 14, 14, 14, 14, 3, 3, 3, 3, 15, 15, 15, 15, 4, 4,
  ],
  32: [
    4, 16, 16, 8, 8, 17, 17, 0, 0, 18, 18, 9, 9, 19, 19, 5,
    5, 20, 20, 10, 10, 21, 21, 1, 1, 22, 22, 11, 11, 23, 23, 6,
    6, 24, 24, 12, 12, 25, 25, 2, 2, 26, 26, 13, 13, 27, 27, 7,
    7, 28, 28, 14, 14, 29, 29, 3, 3, 30, 30, 15, 15, 31, 31, 4,
  ],
  64: [
    4, 32, 16, 33, 8, 34, 17, 35, 0, 36, 18, 37, 9, 38, 19, 39,
    5, 40, 20, 41, 10, 42, 21, 43, 1, 44, 22, 45, 11, 46, 23, 47,
    6, 48, 24, 49, 12, 50, 25, 51, 2, 52, 26, 53, 13, 54, 27, 55,
    7, 56, 28, 57, 14, 58, 29, 59, 3, 60, 30, 61, 15, 62, 31, 63,
  ],
}

/**
 * Map a 64-direction space direction to a DCC direction, the way the engine does.
 *
 * @param direction - 0..63.
 * @param directions - directions in the DCC (4, 8, 16, 32 or 64).
 * @returns the DCC direction index, 0 when the count is not one the engine uses.
 */
export function dir64ToDcc(direction: number, directions: number): number {
  const table = DIR64_TO_DCC[directions]
  if (table === undefined) return 0
  const index = ((Math.trunc(direction) % 64) + 64) % 64
  return table[index] ?? 0
}

/**
 * Map a facing (0 = south, turning west: 0..7) to a COF direction.
 *
 * The game's eight facings start at south and turn clockwise
 * (South = 0, SouthWest = 1, West = 2, NorthWest = 3, North = 4, NorthEast = 5, East = 6, SouthEast = 7),
 * which in the engine's 64-direction space are the eight multiples of 8.
 *
 * @param facing - 0 = south, turning west, 0..7.
 * @param directions - directions in the COF.
 * @returns the direction index.
 */
export function facingToDirection(facing: number, directions: number): number {
  return dir64ToCof(facing * 8, directions)
}

/** Decode one DCC member, for callers that only need its first frame. */
export async function firstFrameOf(archive: MpqArchive, member: string): Promise<SpriteFrame | undefined> {
  const file = archive.find(member)
  if (file === undefined) return undefined
  const dcc = decodeDcc(await archive.read(file))
  return dcc.directions[0]?.frames[0]?.frame
}

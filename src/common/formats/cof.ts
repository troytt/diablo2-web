/**
 * Diablo II `.cof` animation-table decoder.
 *
 * A COF carries no pixels. It is the glue between an animation and the sprite
 * files that make it up: how many directions and frames the animation has, how
 * many composite layers the character or object is assembled from, which weapon
 * class each layer belongs to, and — the part that is easy to miss — the *draw
 * order* of those layers for every direction and frame, since an arm has to be
 * in front of the torso when the character faces one way and behind it when the
 * character faces the other.
 *
 * The layout is fixed-width and byte-aligned throughout, so unlike `.dcc` this
 * decoder is a plain cursor walk:
 *
 * - a 25-byte header: layer count, frames per direction, direction count, 21
 *   bytes the original tool left as uninitialised garbage, and an animation
 *   speed;
 * - three body bytes nobody has ever explained;
 * - one 9-byte record per layer;
 * - one byte per frame, the "animation frame" tag;
 * - one byte per (direction, frame, layer), the priority table.
 *
 * The priority bytes are *composite types*, not layer indices — the shipped
 * Sorceress walk lists types in an order that does not match record order, which
 * is exactly why a renderer must resolve them through the layer records instead
 * of using them directly. That resolution is `cofLayerOrder`.
 */
import { ByteReader, FormatError, InvalidFieldError, TruncatedDataError } from './reader.ts'

/** Fixed part of the file, up to and including the animation-speed byte. */
const HEADER_SIZE = 25
/** Byte offset of the animation speed inside the header. */
const HEADER_SPEED = 24
/** Unexplained bytes between the header and the first layer record. */
const BODY_PREFIX_SIZE = 3
/** Bytes per layer record: five scalar fields plus a four-byte weapon class. */
const LAYER_SIZE = 9
/** Offset of the weapon-class code inside a layer record. */
const LAYER_WEAPON_CLASS = 5

/** One composite layer of an animation. */
export interface CofLayer {
  /** Composite type this layer draws (which body part or equipment slot). */
  readonly type: number
  /** Shadow flag, as stored. */
  readonly shadow: number
  /** Whether the layer takes part in hit detection. */
  readonly selectable: boolean
  /** Whether the layer is drawn with transparency. */
  readonly transparent: boolean
  /** Draw-effect selector, as stored. */
  readonly drawEffect: number
  /**
   * Weapon-class code this layer applies to, e.g. `hth` for unarmed or `1hs` for
   * a one-handed sword, with the record's NUL padding stripped.
   *
   * Kept as the raw code rather than an enum: this port has no weapon-class
   * enumeration, and callers select layers by matching codes they already have
   * from the item tables.
   */
  readonly weaponClass: string
}

/** A decoded COF animation table. */
export interface CofFile {
  /** Number of directions the animation has. */
  readonly numberOfDirections: number
  /** Number of frames per direction. */
  readonly framesPerDirection: number
  /** Number of composite layers per frame. */
  readonly numberOfLayers: number
  /** Animation speed byte; 0 means "default" (25 fps) to the original engine. */
  readonly speed: number
  /** Layer records, in file order. */
  readonly layers: readonly CofLayer[]
  /** One tag byte per frame. */
  readonly animationFrames: Uint8Array
  /**
   * Priority table: `priority[direction][frame]` lists the composite types to
   * draw, back to front. Resolve it with `cofLayerOrder`.
   */
  readonly priority: readonly (readonly (readonly number[])[])[]
}

export function decodeCof(data: Uint8Array): CofFile {
  const r = new ByteReader(data, 'cof')
  const numberOfLayers = r.u8('numberOfLayers')
  const framesPerDirection = r.u8('framesPerDirection')
  const numberOfDirections = r.u8('numberOfDirections')
  r.seek(HEADER_SPEED, 'speed')
  const speed = r.u8('speed')

  const minimum = HEADER_SIZE + BODY_PREFIX_SIZE
  r.seek(minimum, 'layers start')

  const layers: CofLayer[] = []
  for (let i = 0; i < numberOfLayers; i += 1) {
    const layerOffset = minimum + i * LAYER_SIZE
    r.seek(layerOffset, 'layer')
    const type = r.u8('type')
    const shadow = r.u8('shadow')
    const selectable = r.u8('selectable') > 0
    const transparent = r.u8('transparent') > 0
    const drawEffect = r.u8('drawEffect')
    
    r.seek(layerOffset + LAYER_WEAPON_CLASS, 'weapon class')
    let text = ''
    for (let c = 0; c < 4; c += 1) {
      const byte = r.u8('weapon class byte')
      if (byte !== 0) text += String.fromCharCode(byte)
    }

    layers.push({
      type,
      shadow,
      selectable,
      transparent,
      drawEffect,
      weaponClass: text.trim(),
    })
  }

  const animOffset = minimum + numberOfLayers * LAYER_SIZE
  r.seek(animOffset, 'animation frames')
  const animationFrames = r.bytes(framesPerDirection, 'animation frames').slice()

  const priority: number[][][] = []
  for (let direction = 0; direction < numberOfDirections; direction += 1) {
    const frames: number[][] = []
    for (let frame = 0; frame < framesPerDirection; frame += 1) {
      const row: number[] = []
      for (let layer = 0; layer < numberOfLayers; layer += 1) {
        row.push(r.u8('priority'))
      }
      frames.push(row)
    }
    priority.push(frames)
  }

  return {
    numberOfDirections,
    framesPerDirection,
    numberOfLayers,
    speed,
    layers,
    animationFrames,
    priority,
  }
}

/**
 * The draw order for one direction and frame, as indices into `cof.layers`.
 *
 * The priority table stores composite *types*, and a COF's layer records are not
 * obliged to be sorted by type — the shipped Sorceress walk is not — so the
 * types have to be resolved back to record indices before anything can be
 * drawn. Entries naming a type no layer declares are dropped rather than
 * guessed at: there is provably nothing to draw for them. If two layers share a
 * type, the first record wins, so a layer is never drawn twice.
 *
 * @param cof - the decoded animation table.
 * @param direction - direction index.
 * @param frame - frame index within the direction.
 * @returns layer indices, back to front.
 */
export function cofLayerOrder(cof: CofFile, direction: number, frame: number): number[] {
  const frames = cof.priority[direction]
  if (frames === undefined) {
    throw new InvalidFieldError('cof', 'direction', 0, direction, `0..${String(cof.numberOfDirections - 1)}`)
  }
  const row = frames[frame]
  if (row === undefined) {
    throw new InvalidFieldError('cof', 'frame', 0, frame, `0..${String(cof.framesPerDirection - 1)}`)
  }

  const order: number[] = []
  const used = new Set<number>()
  for (const type of row) {
    let index = -1
    for (let i = 0; i < cof.layers.length; i += 1) {
      if (cof.layers[i]!.type === type) {
        index = i
        break
      }
    }
    if (index < 0 || used.has(index)) continue
    used.add(index)
    order.push(index)
  }
  return order
}



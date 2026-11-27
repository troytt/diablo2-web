/**
 * Diablo I sprite decoders: `.cel` (plain) and `.cl2` (its compressed form).
 *
 * Both are palette-indexed sprite sheets. What differs is how the run stream
 * maps onto the frame grid:
 *
 * - **CEL** runs are *line-bounded*: every row's runs sum to exactly the frame
 *   width, so the decoder consumes one row at a time and the frame height is
 *   the number of rows. A run that overruns its row means corrupt input, not a
 *   wrapped row, so it is rejected instead of silently wrapping (the reference
 *   decoder's unsigned counter would wrap instead).
 * - **CL2** runs may *cross* row boundaries, so the stream is written flat into
 *   the frame and line bookkeeping is derived from the overrun, exactly as the
 *   reference decoder does.
 *
 * Neither format stores the frame width: the game supplies it per animation
 * (Diablo's own tables give, e.g., the walk width per class). A viewer can
 * recover it, which {@link detectSpriteWidth} does by requiring every frame in
 * the file to be consumed exactly.
 */
import { CelError, spriteWidthCandidates } from './sprite.ts'
import type { SpriteFrame, SpriteGroup, SpriteSheet } from './sprite.ts'

export type { SpriteFrame, SpriteGroup, SpriteSheet } from './sprite.ts'
export { CelError } from './sprite.ts'

/** Options shared by both decoders. */
export interface DecodeOptions {
  /**
   * Frame width. Required by the formats themselves; when omitted the width is
   * auto-detected from the file (see {@link detectSpriteWidth}) for `.cel`, and
   * rejected for `.cl2`.
   */
  width?: number | undefined
  /**
   * Per-frame widths, indexed by the frame's position within its group.
   *
   * Diablo I mixes both conventions: full-animation sheets use one width, while
   * tile and cursor sheets give every frame its own (the inventory cursor sheet
   * ships a sidecar width list, and dungeon tile sheets take theirs from the
   * tile definitions). Takes precedence over {@link width}.
   */
  widths?: readonly number[] | undefined
  /** Cap on decoded frames, to keep a pathological file from exhausting memory. */
  maxFrames?: number | undefined
  /** Cap on one frame's pixel count. */
  maxFramePixels?: number | undefined
}

/** Sentinel used by the reference decoder to mark a frame header. */
const CEL_FRAME_HEADER_SIZE = 10
/** Default guard: the largest sprite sheet in the game is far below this. */
const DEFAULT_MAX_FRAMES = 20000
/** Default guard for one frame (a 4096×4096 indexed frame). */
const DEFAULT_MAX_FRAME_PIXELS = 1 << 24

import { requireBytes } from './reader.ts'

/** Read a little-endian uint32. */
function u32(data: Uint8Array, at: number): number {
  requireBytes(data, at, 4, 'cel/cl2', 'u32')
  requireBytes(data, at, 4, 'cel', 'u32')
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(at, true)
}

/** Read a little-endian uint16. */
function u16(data: Uint8Array, at: number): number {
  requireBytes(data, at, 2, 'cel/cl2', 'u16')
  requireBytes(data, at, 2, 'cel', 'u16')
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(at, true)
}

/** A frame's frame-extent table, as `[start, end)` pairs. */
type Extents = readonly (readonly [number, number])[]

/**
 * Resolve a file's groups.
 *
 * A single-group file is `[count][count + 1 offsets][frames...]`; a multi-group
 * file instead opens with a group table. CEL and CL2 differ in how that table
 * is read: CEL concatenates its groups after it, CL2 stores offsets to them.
 *
 * @param data - the complete file.
 * @param mode - `'cel'` or `'cl2'`.
 * @returns the groups' base offsets, or a single group when there is no table.
 */
function readGroups(data: Uint8Array, mode: 'cel' | 'cl2'): { groupBases: number[]; single: boolean } | { error: string } {
  const first = u32(data, 0)
  if (first === 0) return { error: 'declares zero frames' }
  const lastOffsetAt = first * 4 + 4
  if (lastOffsetAt + 4 <= data.byteLength && u32(data, lastOffsetAt) === data.byteLength) {
    // Single group: the frame table's last entry is the file size.
    return { groupBases: [0], single: true }
  }
  const numGroups = Math.floor(first / 4)
  if (numGroups === 0 || numGroups > 4096) return { error: `implausible group count ${String(numGroups)}` }
  if (mode === 'cel') {
    // Groups are laid out back to back after the table; their bases are not
    // stored, so they are walked by decoding.
    return { groupBases: [], single: false }
  }
  const bases: number[] = []
  for (let group = 0; group < numGroups; group += 1) {
    const base = u32(data, group * 4)
    if (base + 4 > data.byteLength) return { error: `group ${String(group)} offset ${String(base)} is out of range` }
    bases.push(base)
  }
  return { groupBases: bases, single: false }
}

/**
 * The frame extents of one group.
 *
 * @param data - the complete file.
 * @param base - the group's base offset.
 * @returns the extents, each `[start, end)` in absolute file offsets.
 */
function groupExtents(data: Uint8Array, base: number): Extents | { error: string } {
  const count = u32(data, base)
  if (count === 0 || count > 65535) return { error: `implausible frame count ${String(count)}` }
  const extents: [number, number][] = []
  for (let frame = 0; frame < count; frame += 1) {
    const start = u32(data, base + 4 * (frame + 1))
    const end = u32(data, base + 4 * (frame + 2))
    if (start < 0 || end < start || base + end > data.byteLength) {
      return { error: `frame ${String(frame)} extent ${String(start)}..${String(end)} is out of range` }
    }
    extents.push([base + start, base + end])
  }
  return extents
}

/**
 * Decode one CEL frame.
 *
 * @param data - the complete file.
 * @param start - frame start offset.
 * @param end - frame end offset.
 * @param width - frame width.
 * @param maxFramePixels - pixel-count guard.
 * @returns the frame.
 */
function decodeCelFrame(data: Uint8Array, start: number, end: number, width: number, maxFramePixels: number): SpriteFrame | { error: string } {
  let cursor = start
  // Some frames carry a 10-byte header whose first word is its own size.
  if (cursor + 2 <= end && u16(data, cursor) === CEL_FRAME_HEADER_SIZE) cursor += CEL_FRAME_HEADER_SIZE
  const capacity = Math.min(maxFramePixels, Math.max(width * 4096, width))
  const indices = new Uint8Array(capacity)
  const mask = new Uint8Array(capacity)
  let at = 0
  let height = 0
  while (cursor < end) {
    let remaining = width
    while (remaining > 0) {
      if (cursor >= end) return { error: `row ${String(height)} ran past the frame end` }
      const control = data[cursor]
      if (control === undefined) return { error: `row ${String(height)} ran past the file end` }
      cursor += 1
      if (control >= 0x80) {
        remaining -= 256 - control
      } else {
        const run = control
        if (run > remaining) return { error: `row ${String(height)} overruns by ${String(run - remaining)} pixels` }
        if (cursor + run > end) return { error: `row ${String(height)} literal run is truncated` }
        if (at + run > capacity) return { error: 'frame exceeds the pixel guard' }
        indices.set(data.subarray(cursor, cursor + run), at)
        mask.fill(1, at, at + run)
        cursor += run
        at += run
        remaining -= run
      }
    }
    height += 1
    if (height * width > capacity) return { error: 'frame exceeds the pixel guard' }
  }
  if (cursor !== end) return { error: 'frame was not consumed exactly' }
  return {
    width,
    height,
    indices: indices.subarray(0, width * height),
    mask: mask.subarray(0, width * height),
  }
}

/**
 * Decode one CL2 frame, whose runs may cross row boundaries.
 *
 * @param data - the complete file.
 * @param start - frame start offset.
 * @param end - frame end offset.
 * @param width - frame width.
 * @param maxFramePixels - pixel-count guard.
 * @returns the frame, the column the run stream ended on, or the failure.
 */
function decodeCl2FrameOutcome(data: Uint8Array, start: number, end: number, width: number, maxFramePixels: number): { ok: true; frame: SpriteFrame; lastXOffset: number } | { ok: false; error: string } {
  // The frame opens with the size of its own header.
  if (start + 2 > end) return { ok: false, error: 'frame is too short for its header' }
  let cursor = start + u16(data, start)
  if (cursor > end) return { ok: false, error: 'frame header points past the frame end' }
  const capacity = Math.min(maxFramePixels, Math.max(width * 4096, width))
  const indices = new Uint8Array(capacity)
  const mask = new Uint8Array(capacity)
  let at = 0
  let height = 0
  let xOffset = 0
  while (cursor < end) {
    let remaining = width - xOffset
    while (remaining > 0) {
      if (cursor >= end) return { ok: false, error: 'runs ran past the frame end' }
      const control = data[cursor]
      if (control === undefined) return { ok: false, error: `runs ran past the file end` }
      cursor += 1
      if (control < 0x80) {
        // Transparent run of `control` pixels.
        if (at + control > capacity) return { ok: false, error: 'frame exceeds the pixel guard' }
        at += control
        remaining -= control
      } else if (control <= 0xbe) {
        // Fill run: one colour repeated 0xBF - control times.
        const count = 0xbf - control
        if (cursor >= end) return { ok: false, error: 'fill run is truncated' }
        const color = data[cursor]
        if (color === undefined) return { ok: false, error: `color run ran past the file end` }
        cursor += 1
        if (at + count > capacity) return { ok: false, error: 'frame exceeds the pixel guard' }
        indices.fill(color, at, at + count)
        mask.fill(1, at, at + count)
        at += count
        remaining -= count
      } else {
        // Literal run of 256 - control pixels (0xBF is 65 wide).
        const count = 256 - control
        if (cursor + count > end) return { ok: false, error: 'literal run is truncated' }
        if (at + count > capacity) return { ok: false, error: 'frame exceeds the pixel guard' }
        indices.set(data.subarray(cursor, cursor + count), at)
        mask.fill(1, at, at + count)
        cursor += count
        at += count
        remaining -= count
      }
    }
    if (remaining === 0) {
      height += 1
      xOffset = 0
    } else {
      const overrun = -remaining
      height += Math.floor(overrun / width) + 1
      xOffset = overrun % width
    }
  }
  if (cursor !== end) return { ok: false, error: 'frame was not consumed exactly' }
  const pixels = width * height
  if (pixels > capacity) return { ok: false, error: 'frame exceeds the pixel guard' }
  return {
    ok: true,
    lastXOffset: xOffset,
    frame: {
      width,
      height,
      indices: indices.subarray(0, pixels),
      mask: mask.subarray(0, pixels),
    },
  }
}

/**
 * Decode one CL2 frame, discarding the row-alignment diagnostic.
 *
 * @param data - the complete file.
 * @param start - frame start offset.
 * @param end - frame end offset.
 * @param width - frame width.
 * @param maxFramePixels - pixel-count guard.
 * @returns the frame or the failure.
 */
function decodeCl2Frame(data: Uint8Array, start: number, end: number, width: number, maxFramePixels: number): SpriteFrame | { error: string } {
  const outcome = decodeCl2FrameOutcome(data, start, end, width, maxFramePixels)
  return outcome.ok ? outcome.frame : { error: outcome.error }
}

/**
 * Guess which frame widths a CL2 file could have been encoded with.
 *
 * Weaker than the CEL rule, deliberately: a CL2 run stream is consumed to the
 * frame end under any width, so exactness proves nothing here. What survives is
 * *row alignment* — an encoder pads the final row, so the stream ends on a
 * column boundary for the true width. Candidates that satisfy this are
 * plausible, not proven; the game's own tables stay authoritative (see
 * `PLAYER_SPRITE_WIDTH`).
 *
 * @param data - the complete file.
 * @param candidates - widths to try.
 * @returns the widths under which every frame decodes and ends on a row boundary.
 */
export function cl2WidthCandidates(data: Uint8Array, candidates: readonly number[]): number[] {
  const groupsInfo = readGroups(data, 'cl2')
  if ('error' in groupsInfo) return []
  const bases = groupsInfo.single ? [0] : [...groupsInfo.groupBases]
  const usable: number[] = []
  for (const width of candidates) {
    let aligned = bases.length > 0
    for (const base of bases) {
      const extents = groupExtents(data, base)
      if ('error' in extents) { aligned = false; break }
      for (const [frameStart, frameEnd] of extents) {
        const outcome = decodeCl2FrameOutcome(data, frameStart, frameEnd, width, DEFAULT_MAX_FRAME_PIXELS)
        if (!outcome.ok || outcome.lastXOffset !== 0 || outcome.frame.height === 0) { aligned = false; break }
      }
      if (!aligned) break
    }
    if (aligned) usable.push(width)
  }
  return usable
}

/**
 * Decode a sprite file.
 *
 * @param data - the complete file.
 * @param mode - `'cel'` or `'cl2'`.
 * @param options - width override and guards.
 * @returns the decoded sheet.
 */
export function decodeSpriteFile(data: Uint8Array, mode: 'cel' | 'cl2', options: DecodeOptions = {}): SpriteSheet {
  const maxFrames = options.maxFrames ?? DEFAULT_MAX_FRAMES
  const maxFramePixels = options.maxFramePixels ?? DEFAULT_MAX_FRAME_PIXELS
  if (data.byteLength < 8) throw new CelError(`file is only ${String(data.byteLength)} bytes`)
  const groupsInfo = readGroups(data, mode)
  if ('error' in groupsInfo) throw new CelError(groupsInfo.error)

  const perFrame = options.widths
  const uniform = options.width ?? (perFrame === undefined && mode === 'cel' ? detectSpriteWidth(data) : null)
  if (perFrame === undefined && uniform === null) {
    throw new CelError(mode === 'cl2'
      ? 'CL2 does not store its frame width: pass the width (or per-frame widths) the game uses for this animation'
      : 'could not determine the frame width (no single width consumes the file exactly; tile and cursor sheets need per-frame widths)')
  }

  const groups: SpriteGroup[] = []
  let frames = 0
  if (groupsInfo.single) {
    const extents = groupExtents(data, 0)
    if ('error' in extents) throw new CelError(extents.error)
    groups.push({ frames: decodeFrames(data, extents, mode, uniform, perFrame, maxFramePixels) })
    frames += extents.length
  } else if (mode === 'cl2') {
    for (const base of groupsInfo.groupBases) {
      const extents = groupExtents(data, base)
      if ('error' in extents) throw new CelError(extents.error)
      if (frames + extents.length > maxFrames) throw new CelError('file exceeds the frame guard')
      groups.push({ frames: decodeFrames(data, extents, mode, uniform, perFrame, maxFramePixels) })
      frames += extents.length
    }
  } else {
    // CEL multi-group: groups are concatenated, so each group is found by
    // decoding the previous one to its end.
    let base = Math.floor(u32(data, 0) / 4) * 4
    while (base < data.byteLength && groups.length < 4096) {
      const extents = groupExtents(data, base)
      if ('error' in extents) throw new CelError(extents.error)
      if (frames + extents.length > maxFrames) throw new CelError('file exceeds the frame guard')
      groups.push({ frames: decodeFrames(data, extents, mode, uniform, perFrame, maxFramePixels) })
      frames += extents.length
      const last = extents[extents.length - 1]
      /* v8 ignore next -- extents is non-empty by construction. */
      if (last === undefined) break
      base = last[1]
    }
  }
  return { groups, width: uniform }
}

/**
 * Decode a run of frames that share one width.
 *
 * @param data - the complete file.
 * @param extents - frame extents.
 * @param mode - `'cel'` or `'cl2'`.
 * @param width - frame width.
 * @param maxFramePixels - pixel-count guard.
 * @returns the frames.
 */
function decodeFrames(
  data: Uint8Array,
  extents: Extents,
  mode: 'cel' | 'cl2',
  uniform: number | null,
  perFrame: readonly number[] | undefined,
  maxFramePixels: number,
): SpriteFrame[] {
  const frames: SpriteFrame[] = []
  for (const [start, end] of extents) {
    const width = perFrame === undefined ? uniform : perFrame[frames.length]
    if (width === undefined || width === null) {
      throw new CelError(`no width for frame ${String(frames.length)} (the width list has ${String(perFrame?.length ?? 0)} entries)`)
    }
    const frame = mode === 'cel'
      ? decodeCelFrame(data, start, end, width, maxFramePixels)
      : decodeCl2Frame(data, start, end, width, maxFramePixels)
    if ('error' in frame) {
      throw new CelError(`frame ${String(frames.length)}: ${frame.error}`)
    }
    frames.push(frame)
  }
  return frames
}

/**
 * Recover a `.cel` file's frame width by requiring every row to be consumed
 * exactly.
 *
 * CEL's runs are line-bounded, so a wrong width makes a row's runs overrun and
 * the file is rejected — the width that survives is the real one. This does not
 * extend to CL2, whose runs may cross rows: there the run stream is consumed
 * under any width, which is why {@link decodeSpriteFile} insists on being told.
 *
 * @param data - the complete file.
 * @param candidates - widths to try, smallest first.
 * @returns the smallest width that decodes the whole file, or null.
 */
export function detectSpriteWidth(
  data: Uint8Array,
  candidates: readonly number[] = spriteWidthCandidates(),
): number | null {
  const groupsInfo = readGroups(data, 'cel')
  if ('error' in groupsInfo) return null
  for (const width of candidates) {
    if (decodesExactly(data, groupsInfo, width)) return width
  }
  return null
}

/**
 * Whether one width decodes every CEL frame of every group exactly.
 *
 * @param data - the complete file.
 * @param groupsInfo - the resolved group layout.
 * @param width - candidate width.
 * @returns true when the whole file is consumed with no leftovers.
 */
function decodesExactly(
  data: Uint8Array,
  groupsInfo: { groupBases: readonly number[]; single: boolean },
  width: number,
): boolean {
  const guard = DEFAULT_MAX_FRAME_PIXELS
  const bases = groupsInfo.single ? [0] : celGroupBases(data)
  if (bases.length === 0) return false
  for (const base of bases) {
    const extents = groupExtents(data, base)
    if ('error' in extents) return false
    for (const [start, end] of extents) {
      const frame = decodeCelFrame(data, start, end, width, guard)
      if ('error' in frame) return false
      if (frame.height === 0) return false
    }
  }
  return true
}

/**
 * Walk a multi-group CEL file's concatenated group bases.
 *
 * @param data - the complete file.
 * @returns the group bases.
 */
function celGroupBases(data: Uint8Array): number[] {
  const bases: number[] = []
  let base = Math.floor(u32(data, 0) / 4) * 4
  while (base + 8 <= data.byteLength && bases.length < 4096) {
    bases.push(base)
    const extents = groupExtents(data, base)
    if ('error' in extents) break
    const last = extents[extents.length - 1]
    /* v8 ignore next -- extents is non-empty by construction. */
    if (last === undefined) break
    if (last[1] <= base) break
    base = last[1]
  }
  return bases
}

/**
 * Diablo II `AnimData.D2` animation-timing table decoder.
 *
 * `AnimData.D2` is the table that says how long every animation in the game
 * takes and on which frame it *does* something. It is the authority the COF
 * files are not: a COF carries a speed byte, but on most shipped player COFs
 * that byte is `0` (`sowlhth` is 0 while `SOWLHTH` here is 256), so a port that
 * times animations from COFs times most of them wrong. Frame events are the
 * other half: D2 lands melee damage and spawns missiles on a specific frame of
 * the attack animation, not on a timer, and that frame number is stored here.
 *
 * Layout — every field little-endian, no header, no version, no magic:
 *
 * - 256 hash blocks, in order. Each block is a `u32` record count followed by
 *   that many 160-byte records.
 * - A record is `char[8]` NUL-padded name, `u32` framesPerDirection,
 *   `u32` animationSpeed, `u8[144]` frame-event flags.
 * - A record's block index is `sum(uppercase name charCodeAt) % 256`. That is
 *   the whole hash function, and it is what makes the file self-checking:
 *   3558/3558 shipped records land in the block their own name demands, so a
 *   decoder that has drifted by even one byte produces mismatches immediately.
 *
 * Arithmetic self-proof for the shipped 1.13c table:
 * `3558 x 160 + 256 x 4 = 569,280 + 1,024 = 570,304` — exactly the file size.
 * `decodeAnimDataFile` therefore refuses to return unless it consumed every
 * byte, which is what turns a truncated or length-tampered buffer into a throw
 * instead of a plausible-looking partial table.
 *
 * Four things in the shipped data contradict the obvious reading of the format,
 * and all four are handled here rather than being left to callers to trip over:
 *
 * 1. **Frame-event codes are not a `1|2` enum.** Code 3 occurs on four records
 *    (`TES1HTH`, `10A1HTH`, `10A2HTH`, `13A1HTH`). Raw codes are preserved and
 *    never filtered: dropping an unknown code would be a silent data loss, and
 *    throwing on it would reject valid shipping data.
 * 2. **Four records store `animationSpeed === 0`** (`CODTHTH`, `VHNUHTH`,
 *    `VJNUHTH`, `R7DDHTH`). `ticksPerCycle` is `fpd * 256 / speed`, so zero
 *    means a division by zero, and in an 8.8 accumulator `acc += 0` means the
 *    animation never advances — a frozen actor with no error anywhere. The
 *    speed is preserved as stored and flagged through `hasSpeed`, and
 *    `ticksPerCycle` throws rather than returning `Infinity`.
 * 3. **The flag array is 144 bytes but `framesPerDirection` can exceed it.**
 *    `42DTHTH` has 200 frames. Frames 144..199 have nowhere to store an event,
 *    so event scanning stops at `min(fpd, 144)`; there is no out-of-bounds read
 *    and no silent truncation, and `recordsOverFlagCeiling` lists every record
 *    in that state so a caller can report it.
 * 4. **29 names occur more than once, and 9 of those disagree** (`VMS1HTH` is
 *    stored as both `fpd=17, speed=200` and `fpd=17, speed=160`). The lookup map
 *    is **first-wins**: the game resolves a name by scanning its hash block
 *    sequentially and returning on the first hit, so the first record in block
 *    order is the one the engine itself would use. Both candidate values are
 *    kept in `conflicts` so the ambiguity stays visible instead of becoming an
 *    accident of map insertion order.
 *
 * **`EAnimData.D2` merge policy, and the evidence for it.** The expansion table
 * (565,984 bytes, 3,531 records, also served by `d2exp.mpq`) has the identical
 * layout and decodes with this same function. Whether the base table or the
 * expansion table should win a name collision looks like a decision, and it is
 * not one, because the two files do not actually disagree anywhere:
 *
 * - 3,520 names collide — every name `EAnimData.D2` has.
 * - **0** of those 3,520 differ in `framesPerDirection`, `animationSpeed` or
 *   events, and **0** differ in the raw 152-byte record payload. They are
 *   byte-identical, including the ordering of the 11 duplicate names they share
 *   and the values of all 9 internally-conflicting names.
 * - 0 names are unique to `EAnimData.D2`; `AnimData.D2` holds 9 it lacks
 *   (`41DDHTH`, `44WLHTH`, `0JDDHTH`, `K9A2HTH`, `K9BLHTH`, `K9S2HTH`,
 *   `K9S3HTH`, `K9S4HTH`, `K9SCHTH`).
 *
 * So `AnimData.D2` is a strict superset by both name and value, and merge
 * precedence cannot change a single number in either direction. The bake reads
 * `AnimData.D2` alone and asserts the above as a cross-check rather than
 * merging. This module itself merges nothing: it decodes the buffer it is
 * handed, so either file can be decoded on its own.
 *
 * (An earlier survey reported "9 shared names disagree". That count is the
 * number of internally-conflicting duplicate names, which is reproduced by
 * comparing one file first-wins against the other last-wins. Comparing like for
 * like, the difference count is 0.)
 */
import { ByteReader, InvalidFieldError } from './reader.ts'

/** Hash blocks in the file, one per possible value of the name hash. */
export const ANIMDATA_BLOCK_COUNT = 256
/** Bytes of NUL-padded name at the head of a record. */
export const ANIMDATA_NAME_SIZE = 8
/**
 * Frame-event flag bytes per record.
 *
 * A clip may legally declare more frames than this (`42DTHTH` declares 200);
 * those frames simply have no event storage.
 */
export const ANIMDATA_FLAG_COUNT = 144

/** Frame-event code: resolve the melee hit on this frame. */
export const ANIM_EVENT_ATTACK = 1
/** Frame-event code: spawn the missile on this frame. */
export const ANIM_EVENT_MISSILE = 2

/**
 * One frame event: a frame index within the clip and the raw byte stored for it.
 *
 * The code is deliberately a `number` and not a union. Codes 1 and 2 are the
 * documented ones, code 3 is in the shipped table with no documented meaning,
 * and a mod is free to store anything. Callers must decide per code, and must
 * not assume the set is closed.
 */
export interface FrameEvent {
  /** Frame index within one direction, always `< min(framesPerDirection, 144)`. */
  readonly frame: number
  /** Raw flag byte, never normalised. 1 = attack, 2 = missile, 3 = undocumented. */
  readonly code: number
}

/** One animation's timing record. */
export interface AnimDataRecord {
  /** Upper-case COF name, e.g. `SOA1HTH`. */
  readonly name: string
  /** Frames in one direction of the animation. */
  readonly framesPerDirection: number
  /**
   * Animation speed as 8.8 fixed point, 256 = 1x.
   *
   * Four shipped records store 0; see `hasSpeed` before dividing by this.
   */
  readonly animationSpeed: number
  /** False for the four records whose `animationSpeed` is 0. */
  readonly hasSpeed: boolean
  /** Frame events, ascending by frame. Sparse: most clips have none. */
  readonly events: readonly FrameEvent[]
  /** Hash block the record was stored in; always equals `animDataHash(name)`. */
  readonly block: number
}

/** A name stored more than once, with the values of every copy. */
export interface AnimDataDuplicate {
  /** The repeated name. */
  readonly name: string
  /** Every record stored under it, in file order. The first one wins lookups. */
  readonly records: readonly AnimDataRecord[]
}

/** A non-zero flag byte sitting at or past its own record's frame count. */
export interface AnimDataStrayFlag {
  /** Record the byte belongs to. */
  readonly name: string
  /** Flag-array index, which is `>= framesPerDirection`. */
  readonly frame: number
  /** The stored byte. */
  readonly code: number
}

/** A decoded `AnimData.D2`, plus the integrity facts worth asserting on. */
export interface AnimDataFile {
  /**
   * Lookup by upper-case name. **First record wins** when a name repeats.
   *
   * The game resolves an animation by hashing the name to a block and scanning
   * that block in order until it matches, so the first stored copy is the copy
   * the original engine uses. Last-wins would silently pick the other speed for
   * the nine conflicting names.
   */
  readonly records: ReadonlyMap<string, AnimDataRecord>
  /** Every record in file order, duplicates included. 3558 for 1.13c AnimData.D2. */
  readonly all: readonly AnimDataRecord[]
  /** Bytes consumed. Always equals the input length, or decoding threw. */
  readonly bytesConsumed: number
  /** Records per hash block, indexed by block. */
  readonly blockCounts: readonly number[]
  /** Names stored more than once, in first-seen order. 29 for 1.13c. */
  readonly duplicates: readonly AnimDataDuplicate[]
  /**
   * Duplicates whose copies disagree on frames, speed or events. 9 for 1.13c.
   *
   * A subset of `duplicates`; the other 20 are byte-identical repeats where the
   * resolution policy cannot matter.
   */
  readonly conflicts: readonly AnimDataDuplicate[]
  /**
   * Records declaring more frames than the 144-byte flag array can describe.
   *
   * One record in 1.13c (`42DTHTH`, 200 frames). Their frames past 143 cannot
   * carry an event, which is a property of the file format, not a decode error.
   */
  readonly recordsOverFlagCeiling: readonly AnimDataRecord[]
  /**
   * Non-zero flag bytes at an index at or beyond the record's own frame count.
   *
   * Empty for 1.13c. Such a byte can never become a `FrameEvent` — event
   * scanning stops at the frame count — so this list exists to make the
   * discarded byte visible rather than silently lost.
   */
  readonly strayFlags: readonly AnimDataStrayFlag[]
}

/**
 * The hash block a name must be stored in.
 *
 * @param name - animation name; case is irrelevant, it is upper-cased first.
 * @returns block index in `0..255`.
 */
export function animDataHash(name: string): number {
  const upper = name.toUpperCase()
  let sum = 0
  for (let i = 0; i < upper.length; i += 1) {
    sum += upper.charCodeAt(i)
  }
  return sum % ANIMDATA_BLOCK_COUNT
}

/**
 * Read the 8-byte NUL-padded name at the reader's cursor.
 *
 * @param r - reader positioned at the name field.
 * @param offset - absolute offset of the field, for error messages.
 * @returns the name, upper-cased, with padding stripped.
 */
function readName(r: ByteReader, offset: number): string {
  const bytes = r.bytes(ANIMDATA_NAME_SIZE, 'record name')
  let name = ''
  let terminated = false
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i]!
    if (byte === 0) {
      terminated = true
      continue
    }
    if (terminated) {
      // Text resuming after the terminator means the cursor is not on a record
      // boundary any more. Guessing which half is the name would invent data.
      throw new InvalidFieldError('animdata', 'record name', offset, `data after NUL at ${String(i)}`, 'NUL padding')
    }
    if (byte < 0x20 || byte > 0x7e) {
      throw new InvalidFieldError('animdata', 'record name', offset, byte, 'printable ASCII')
    }
    name += String.fromCharCode(byte)
  }
  if (name.length === 0) {
    throw new InvalidFieldError('animdata', 'record name', offset, '(empty)', 'a name')
  }
  return name.toUpperCase()
}

/**
 * Decode the whole table with its integrity facts.
 *
 * Throws when a block runs past the end of the buffer, when a record's name is
 * not a NUL-padded printable string, when a record's name hash does not equal
 * the block it was found in, or when decoding does not consume the buffer
 * exactly. There is no partial-result path and no fallback: a table that does
 * not check out is a table whose frame timings cannot be trusted.
 *
 * @param data - the raw `AnimData.D2` (or `EAnimData.D2`) bytes.
 * @returns the decoded table.
 */
export function decodeAnimDataFile(data: Uint8Array): AnimDataFile {
  const r = new ByteReader(data, 'animdata')
  const records = new Map<string, AnimDataRecord>()
  const order: AnimDataRecord[] = []
  const blockCounts: number[] = []
  const repeats = new Map<string, AnimDataRecord[]>()
  const overCeiling: AnimDataRecord[] = []
  const strayFlags: AnimDataStrayFlag[] = []

  for (let block = 0; block < ANIMDATA_BLOCK_COUNT; block += 1) {
    const count = r.u32le('block record count')
    blockCounts.push(count)
    for (let index = 0; index < count; index += 1) {
      const recordOffset = r.position
      const name = readName(r, recordOffset)
      const hash = animDataHash(name)
      if (hash !== block) {
        throw new InvalidFieldError('animdata', `hash of ${name}`, recordOffset, hash, block)
      }

      const framesPerDirection = r.u32le('framesPerDirection')
      const animationSpeed = r.u32le('animationSpeed')
      const flags = r.bytes(ANIMDATA_FLAG_COUNT, 'frameEventFlags')

      const events: FrameEvent[] = []
      const scanned = Math.min(framesPerDirection, ANIMDATA_FLAG_COUNT)
      for (let frame = 0; frame < scanned; frame += 1) {
        const code = flags[frame]!
        if (code !== 0) events.push({ frame, code })
      }
      for (let frame = scanned; frame < ANIMDATA_FLAG_COUNT; frame += 1) {
        const code = flags[frame]!
        if (code !== 0) strayFlags.push({ name, frame, code })
      }

      const record: AnimDataRecord = {
        name,
        framesPerDirection,
        animationSpeed,
        hasSpeed: animationSpeed !== 0,
        events,
        block,
      }
      order.push(record)
      if (framesPerDirection > ANIMDATA_FLAG_COUNT) overCeiling.push(record)

      const seen = repeats.get(name)
      if (seen === undefined) {
        repeats.set(name, [record])
        records.set(name, record)
      } else {
        // First-wins: leave `records` alone. See `AnimDataFile.records`.
        seen.push(record)
      }
    }
  }

  if (r.position !== data.length) {
    throw new InvalidFieldError('animdata', 'bytes consumed', r.position, r.position, data.length)
  }

  const duplicates: AnimDataDuplicate[] = []
  const conflicts: AnimDataDuplicate[] = []
  for (const [name, copies] of repeats) {
    if (copies.length < 2) continue
    const duplicate: AnimDataDuplicate = { name, records: copies }
    duplicates.push(duplicate)
    if (copies.some(copy => !sameTiming(copies[0]!, copy))) conflicts.push(duplicate)
  }

  return {
    records,
    all: order,
    bytesConsumed: r.position,
    blockCounts,
    duplicates,
    conflicts,
    recordsOverFlagCeiling: overCeiling,
    strayFlags,
  }
}

/**
 * Whether two records describe the same animation timing.
 *
 * @param a - first record.
 * @param b - second record.
 * @returns true when frames, speed and the whole event list agree.
 */
function sameTiming(a: AnimDataRecord, b: AnimDataRecord): boolean {
  if (a.framesPerDirection !== b.framesPerDirection) return false
  if (a.animationSpeed !== b.animationSpeed) return false
  if (a.events.length !== b.events.length) return false
  for (let i = 0; i < a.events.length; i += 1) {
    if (a.events[i]!.frame !== b.events[i]!.frame) return false
    if (a.events[i]!.code !== b.events[i]!.code) return false
  }
  return true
}

/**
 * Diablo II v1.13c shrine operate effects (D2Client.dll), issues #1523 / #1527.
 *
 * S2C 0x0E ObjectEvent 0x6fad5ce0 with event 0x15 runs 0x6fad4b90 for the object: the shrine code is the first byte
 * of the object's shrine record (D2Common #10092, only for shrines: #10934; every non-shrine record has 0 at
 * objects.bin +0x16F), the operating player is `pkt[7]` (looked up in the player table 0x6fbba608), and when
 * `1 <= code < 23` the shrine client table 0x6fb82f60 (20-byte rows) entry +4 runs with ecx = shrine, edx = player:
 *
 * | Code | +4 handler | Effect                                                                                   |
 * |------|------------|------------------------------------------------------------------------------------------|
 * | 16   | 0x6fad4750 | Enirhs: the player's name reversed (strrev 0x6fab4090, written back through 0x6fab3ac0)  |
 * | 19   | 0x6fad6060 | Fire: 16 missiles 0x3E `fireball`, flags 3 (source = shrine, target = source + offset),   |
 * |      |            | offsets x, y in {+5, -10, +15, -20} (outer loop x)                                        |
 * | 21   | 0x6fad5f10 | Exploding: 6 missiles 0x2D `explosivepotion`, flags 0x520 (absolute target = shrine +    |
 * |      |            | (dx, dy)), (dx, dy) = (-6, 6) (-6, -6) (0, 6) (0, -6) (6, 6) (6, -6)                       |
 * | 22   | 0x6fad5dc0 | Poison: as 21 with missile 0x30 `chokinggaspoition`                                       |
 *
 * Every missile has owner = the player and level `clamp(trunc(player level (stat 12) / 5), 1, 8)`
 * (`imul 0x66666667; sar edx, 1` at 0x6fad6168 / 0x6fad600b / 0x6fad5ebb). 0x6fb630f0 param flags: 1 = explicit
 * source (+0x14/+0x18), 2 = target relative to the source (+0x1c/+0x20 added), 0x20 = absolute target. The handler then
 * plays the shrine sound (0x6fad4a70), which this port emits from the mode change instead (object-sound-113c.ts).
 */

/** Player stat 12 `level`. */
export const SHRINE_PLAYER_LEVEL_STAT = 12
export const SHRINE_ENIRHS = 16
export const SHRINE_FIRE = 19
export const SHRINE_EXPLODING = 21
export const SHRINE_POISON = 22
/** Shrine client table rows (`cmp ecx, [0x6fba54e0]` = 0x17). */
const SHRINE_TABLE_ROWS = 0x17
/** Write-back buffer of the Enirhs name (`push 0x10`). */
export const ENIRHS_NAME_BYTES = 0x10

export interface ShrineMissile113c {
  readonly missile: 'fireball' | 'explosivepotion' | 'chokinggaspoition'
  readonly sourceX: number
  readonly sourceY: number
  readonly targetX: number
  readonly targetY: number
  readonly level: number
}

export interface ShrineOperateFx113c {
  readonly missiles: readonly ShrineMissile113c[]
  readonly reverseName: boolean
}

/** `clamp(trunc(level / 5), 1, 8)`. */
export function shrineMissileLevel113c(playerLevel: number): number {
  return Math.min(8, Math.max(1, Math.trunc(playerLevel / 5)))
}

const FIRE_OFFSETS = [5, -10, 15, -20] as const
const POTION_OFFSETS: readonly (readonly [number, number])[] = [
  [-6, 6],
  [-6, -6],
  [0, 6],
  [0, -6],
  [6, 6],
  [6, -6],
]

/** 0x6fad4b90 → shrine table +4 handler for `shrineCode` operated by a player of `playerLevel`. */
export function resolveShrineOperateFx113c(
  shrineCode: number,
  shrineX: number,
  shrineY: number,
  playerLevel: number,
): ShrineOperateFx113c {
  if (!(shrineCode >= 1 && shrineCode < SHRINE_TABLE_ROWS)) return { missiles: [], reverseName: false }
  const level = shrineMissileLevel113c(playerLevel)
  switch (shrineCode) {
    case SHRINE_ENIRHS:
      return { missiles: [], reverseName: true }
    case SHRINE_FIRE: {
      const missiles: ShrineMissile113c[] = []
      for (const dx of FIRE_OFFSETS) {
        for (const dy of FIRE_OFFSETS) {
          missiles.push({ missile: 'fireball', sourceX: shrineX, sourceY: shrineY, targetX: shrineX + dx, targetY: shrineY + dy, level })
        }
      }
      return { missiles, reverseName: false }
    }
    case SHRINE_EXPLODING:
    case SHRINE_POISON: {
      const missile = shrineCode === SHRINE_EXPLODING ? 'explosivepotion' : 'chokinggaspoition'
      return {
        missiles: POTION_OFFSETS.map(([dx, dy]) => ({ missile, sourceX: shrineX, sourceY: shrineY, targetX: shrineX + dx, targetY: shrineY + dy, level })),
        reverseName: false,
      }
    }
    default:
      return { missiles: [], reverseName: false }
  }
}

/**
 * strrev (0x6fab4090 reverses the whole NUL-terminated name), written back through 0x6fab3ac0 with a 0x10-byte
 * buffer (player names are at most 15 characters, so the copy keeps them whole).
 */
export function enirhsReverseName113c(name: string): string {
  return name.split('').reverse().join('').slice(0, ENIRHS_NAME_BYTES - 1)
}

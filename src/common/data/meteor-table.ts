/**
 * Diablo II: Lord of Destruction v1.13c — Meteor Ground Fire Subtile Geometry.
 *
 * Ground Truth Reference:
 * - D2Game.dll VA 0x6FC5CEC0 (MISSMODE_CreateMeteor_MoltenBoulderSubmissiles)
 * - D2Game.dll VA 0x6FD1C918 (int16_t pXOffsets[18])
 * - D2Game.dll VA 0x6FD1C8D0 (int16_t pYOffsets[18])
 *
 * Each subtile offset is scaled to world pixels:
 * targetX = gx + offset.x * 20
 * targetY = gy + offset.y * 10 (20 * ISO_GROUND_ASPECT_RATIO, 2:1 isometric aspect ratio)
 */

export interface MeteorFireSubtileOffset {
  readonly x: number
  readonly y: number
}

export const METEOR_FIRE_SUBTILE_OFFSETS: readonly MeteorFireSubtileOffset[] = Object.freeze([
  { x:  2, y: -2 }, // [0]  Inner Ring
  { x: -2, y: -2 }, // [1]  Inner Ring
  { x:  0, y:  2 }, // [2]  Inner Ring
  { x:  0, y:  5 }, // [3]  North Tip
  { x: -3, y:  3 }, // [4]  North-West Outer
  { x:  0, y:  3 }, // [5]  Center-North
  { x:  3, y:  3 }, // [6]  North-East Outer
  { x: -1, y:  2 }, // [7]  Center Cluster
  { x:  1, y:  1 }, // [8]  Center Cluster
  { x: -1, y: -1 }, // [9]  Center Cluster
  { x:  2, y: -1 }, // [10] Center Cluster
  { x: -4, y: -2 }, // [11] West Tip
  { x: -3, y: -2 }, // [12] West Outer
  { x: -1, y: -3 }, // [13] South-West Outer
  { x:  0, y: -4 }, // [14] South Tip
  { x:  1, y: -3 }, // [15] South-East Outer
  { x:  3, y: -3 }, // [16] East Outer
  { x:  4, y: -2 }, // [17] East Tip
])

/**
 * D2Client.dll VA 0x6FB83BF8 (int32_t pExplodeXOffsets[5]) &
 * D2Client.dll VA 0x6FB83C0C (int32_t pExplodeYOffsets[5])
 * Used by MISSMODE_CltHit18_MeteorCenter (0x6FB66540) to spawn cHitPar1 = 5
 * CltHitSubMissile1 (meteorexplode, ID 103) in a 4-subtile cross pattern.
 */
export const METEOR_EXPLODE_SUBTILE_OFFSETS: readonly MeteorFireSubtileOffset[] = Object.freeze([
  { x:  0, y:  0 }, // [0] Center
  { x:  0, y:  4 }, // [1] +4 Y
  { x:  4, y:  0 }, // [2] +4 X
  { x:  0, y: -4 }, // [3] -4 Y
  { x: -4, y:  0 }, // [4] -4 X
])


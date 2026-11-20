/**
 * Issue #1340: fc3998f0 (#1330..#1333) made the DrawGrid cell row (`floor(subX / 5) + floor(subY / 5)`) the primary
 * entity sort key. The falling Meteor-family sub-missiles are stored at their *projected* sky position
 * (`x = targetX - 15 * rem / 32`, `altitude = 25 * rem`), but 1.13c `MISSMODE_CltDo09_MeteorCenter` (0x6FB68F00)
 * spawns them AT the target sub-tile and `UNIT_Set3DTrajectory` (0x6FB77E30) only offsets their screen projection
 * (`D2Common_10132` 0x6FD9DB40) — kb/skills/missiles/d2client-meteor-cltdofunc-clthitfunc.md §2–3. DrawGrid therefore
 * buckets `meteor` / `meteortail` into the target cell, next to `meteorcenter`.
 */
import { describe, expect, it } from 'vitest'
import {
  buildSceneDrawables,
  meteor3dPathSubTile,
  sceneEntityCellDepth,
  type RenderableUnitInput,
  type SceneMissileDrawable,
} from '../../src/client/view/unit-drawables.ts'
import { CANONICAL_113C_MISSILES } from '../../src/common/skills/missiles-data.ts'

const FAMILIES = [
  { center: 'meteorcenter', tail: 'meteortail', core: 'meteor' },
  { center: 'vampiremeteorcenter', tail: 'meteortail', core: 'vampiremeteor' },
  { center: 'royalstrikemeteorcenter', tail: 'royalstrikemeteortail', core: 'royalstrikemeteor' },
] as const

function missileId(key: string): number {
  const row = (CANONICAL_113C_MISSILES as Readonly<Record<string, { id: number } | undefined>>)[key]
  if (row === undefined) throw new Error(`Missiles.txt has no row ${key}`)
  return row.id
}

/** Mirrors world-missile-stepper's Meteor descent for frame `rem` frames before impact. */
function meteorInputs(
  family: (typeof FAMILIES)[number],
  targetX: number,
  targetY: number,
  rem: number,
): RenderableUnitInput[] {
  const skyX = targetX - (15 * rem) / 32
  const altitude = 25 * rem
  return [
    { id: 1, kind: 'missile', classId: missileId(family.center), missileKey: family.center, x: targetX, y: targetY },
    { id: 2, kind: 'missile', classId: missileId(family.tail), missileKey: family.tail, x: skyX, y: targetY, altitude },
    { id: 3, kind: 'missile', classId: missileId(family.core), missileKey: family.core, x: skyX, y: targetY, altitude },
  ]
}

describe('#1340 Meteor-family DrawGrid cell = 1.13c path (target) sub-tile', () => {
  it('meteor3dPathSubTile recovers the target sub-tile exactly for every descent frame (incl. cell boundaries)', () => {
    for (const targetX of [50, 52, 54.5, 77]) {
      for (let rem = 1; rem <= 59; rem++) {
        const skyX = targetX - (15 * rem) / 32
        for (const key of ['meteor', 'meteortail', 'vampiremeteor', 'royalstrikemeteor', 'royalstrikemeteortail']) {
          expect(meteor3dPathSubTile(key, skyX, 40, 25 * rem)).toEqual({ x: targetX, y: 40 })
        }
      }
    }
    // Landed (altitude 0) or non-Meteor missiles: path position = drawn position.
    expect(meteor3dPathSubTile('meteor', 50, 40, 0)).toBeNull()
    expect(meteor3dPathSubTile('meteorcenter', 50, 40, 100)).toBeNull()
    expect(meteor3dPathSubTile('firebolt', 50, 40, 100)).toBeNull()
  })

  for (const family of FAMILIES) {
    it(`${family.center}: all three drawables share the target cell and sort center -> tail -> core every frame`, () => {
      const targetX = 50 // exact cell boundary (floor(50 / 5) = 10) to exercise 1/32 snapping
      const targetY = 40
      const targetCell = Math.floor(targetX / 5) + Math.floor(targetY / 5)
      for (let rem = 59; rem >= 1; rem--) {
        const scene = buildSceneDrawables(meteorInputs(family, targetX, targetY, rem))
        expect(scene.missileDrawables).toHaveLength(3)
        for (const d of scene.missileDrawables) expect(sceneEntityCellDepth(d)).toBe(targetCell)
        const keys = scene.sortedDrawables
          .filter((d): d is SceneMissileDrawable => d.drawableKind === 'missile')
          .map(d => d.missileKey)
        expect(keys).toEqual([family.center, family.tail, family.core])
      }
    })
  }

  it('a unit standing in a cell row between the sky position and the target is drawn before the meteor', () => {
    const targetX = 60
    const targetY = 40 // target cell row 12 + 8 = 20
    const rem = 59 // sky x = 60 - 27.66 = 32.34 -> projected cell row 6 + 8 = 14
    const scene = buildSceneDrawables([
      ...meteorInputs(FAMILIES[0], targetX, targetY, rem),
      { id: 10, kind: 'monster', classId: 0, x: 47, y: 42, mode: 1 }, // cell row 9 + 8 = 17
    ])
    const order = scene.sortedDrawables.map(d => (d.drawableKind === 'missile' ? d.missileKey : d.drawableKind))
    expect(order).toEqual(['unit', 'meteorcenter', 'meteortail', 'meteor'])
  })

  it('ordinary airborne / ground missiles keep their drawn sub-tile as DrawGrid cell (no path override)', () => {
    const scene = buildSceneDrawables([
      { id: 1, kind: 'missile', classId: missileId('firebolt'), missileKey: 'firebolt', x: 33, y: 41, altitude: 40 },
      { id: 2, kind: 'missile', classId: missileId('firesmall'), missileKey: 'firesmall', x: 52, y: 47 },
      { id: 3, kind: 'missile', classId: missileId('meteorcenter'), missileKey: 'meteorcenter', x: 61, y: 44 },
    ])
    for (const d of scene.missileDrawables) {
      expect(d.pathSubX).toBeUndefined()
      expect(d.pathSubY).toBeUndefined()
      expect(sceneEntityCellDepth(d)).toBe(Math.floor(d.subX / 5) + Math.floor(d.subY / 5))
    }
  })
})

/**
 * Issue #915: A2Q6 Horadric staff placed in the orifice (1.13c special quest event 3).
 *
 * Ground truth (D2Client.dll / D2Game.dll 1.13c, see kb/quests/a2q6-staff-orifice-show-113c.md):
 * - D2Game 0x6fce9d72..0x6fce9dcf: S2C 0x89 event 3 to every player, orifice -> OBJMODE_OPERATING, quest timer that
 *   later spawns objects.txt 100 (Duriel's Lair portal) at (orifice.x - 13, orifice.y + 3).
 * - D2Client 0x6fb03450 (event 3): missile 338 at the orifice (z 40 -> 70, vz 0x200), Overlay.txt 181 light_jet.
 * - CltDoFunc 31 0x6fb64b80: 7 beams (340) from table 0x6fb836d0 at rem 325..175, lightning 339 to the wall while
 *   rem < 165 and even, dust 150 at the wall while rem < 150, screen shake (4000 ms, 25) at rem 150.
 */

import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../../src/client/render/missiles-meta.ts'
import { OVERLAY_METAS } from '../../src/client/render/overlays-meta.ts'
import { computeMissileClipDirection } from '../../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { QUEST_FX_MISSILES_113C } from '../../src/client/world/quest-fx-data-113c.ts'
import {
  HORADRIC_LIGHT_BEAMS_113C,
  HORADRIC_ORIFICE_OBJECT_CLASS,
  horadricStaffTick,
  lightningTraj3d,
  staffTraj3d,
  stepTraj3dZ,
} from '../../src/client/world/quest-fx-horadric-113c.ts'
import { QuestFxLight } from '../../src/client/world/quest-fx-light.ts'

const seed = () => ({ lo: 0x1234567, hi: 666 })

describe('Issue #915: A2Q6 staff-in-orifice show (special quest event 3)', () => {
  it('extracts Missiles.txt 150 / 338 / 339 / 340 from the 1.13c tables', () => {
    expect(QUEST_FX_MISSILES_113C[338]).toMatchObject({ name: 'horadricstaff', pCltDoFunc: 31, range: 440, vel: 0 })
    expect(QUEST_FX_MISSILES_113C[339]).toMatchObject({ name: 'horadriclightning', pCltDoFunc: 1, range: 30, vel: 20, light: 3 })
    expect(QUEST_FX_MISSILES_113C[340]).toMatchObject({ name: 'horadriclight', pCltDoFunc: 1, range: 225, light: 2 })
    expect(QUEST_FX_MISSILES_113C[150]).toMatchObject({ name: 'dust', pCltDoFunc: 1, range: 100, vel: 4, animLen: 26 })
  })

  it('bakes the real CelFiles (HoradricStaff, HoradricLightBeamstreaks, LIGHTJET), not the Den of Evil beams', () => {
    expect(MISSILE_METAS['horadricstaff']?.celFile).toBe('HoradricStaff')
    expect(MISSILE_METAS['horadricstaff']?.framesPerDirection).toBe(8)
    expect(MISSILE_METAS['horadriclight']?.celFile).toBe('HoradricLightBeamstreaks')
    expect(MISSILE_METAS['horadriclight']?.directions).toBe(32)
    expect(OVERLAY_METAS['light_jet']).toMatchObject({ celFile: 'LIGHTJET', frames: 13, animRate: 4 })
  })

  it('UNIT_Step3DTrajectory (0x6fb77fb0): the staff rises 40 -> 70 px at 0.25 px/tick and stops there', () => {
    const t = staffTraj3d()
    let z = 0
    for (let i = 0; i < 119; i++) z = stepTraj3dZ(t)
    expect(z).toBe(69)
    expect(t.stopped).toBe(false)
    expect(stepTraj3dZ(t)).toBe(70)
    expect(t.stopped).toBe(true)
    expect(stepTraj3dZ(t)).toBe(70)
  })

  it('horadriclightning starts at 70 px and sinks 1 px/tick', () => {
    const t = lightningTraj3d()
    let z = 0
    for (let i = 0; i < 30; i++) z = stepTraj3dZ(t)
    expect(z).toBe(40)
  })

  it('CltDoFunc 31: one beam per table record at rem 325, 300, ..., 175 with the record offset and dir', () => {
    expect(HORADRIC_LIGHT_BEAMS_113C.map(b => b.rem)).toEqual([325, 300, 275, 250, 225, 200, 175])
    for (let rem = 440; rem >= 165; rem--) {
      const tick = horadricStaffTick(rem, 100, 200, seed())
      const beam = HORADRIC_LIGHT_BEAMS_113C.find(b => b.rem === rem)
      if (beam === undefined) {
        expect(tick.spawns).toEqual([])
      } else {
        expect(tick.spawns).toEqual([
          { kind: 'light', missile: 340, x: 100 + beam.dx, y: 200 + beam.dy, dir: beam.dir, frames: rem },
        ])
      }
    }
  })

  it('CltDoFunc 31: lightning to (x-13, y+3) on even rem < 165, dust at the wall below 150, shake at 150', () => {
    expect(horadricStaffTick(165, 100, 200, seed()).spawns).toEqual([])
    expect(horadricStaffTick(164, 100, 200, seed()).spawns).toEqual([
      { kind: 'lightning', missile: 339, x: 100, y: 200, targetX: 87, targetY: 203, dir: 0x15 },
    ])
    expect(horadricStaffTick(163, 100, 200, seed()).spawns).toEqual([])
    const at150 = horadricStaffTick(150, 100, 200, seed())
    expect(at150.shake).toBe(true)
    expect(at150.spawns.map(s => s.kind)).toEqual(['lightning'])
    const s = seed()
    const at149 = horadricStaffTick(149, 100, 200, s)
    expect(at149.shake).toBe(false)
    expect(at149.spawns).toHaveLength(1)
    const dust = at149.spawns[0]!
    expect(dust).toMatchObject({ kind: 'dust', missile: 150, x: 87, y: 203, animSpeed: 4 })
    if (dust.kind !== 'dust') throw new Error('expected dust')
    // seed step 1: lo % 5 -> tx = 88 + r1; step 2: lo % 10 -> ty = 198 + r2.
    const lo1 = Number((BigInt(0x1234567) * 0x6ac690c5n + 666n) & 0xffffffffn)
    expect(dust.targetX).toBe(88 + (lo1 % 5))
    expect(dust.targetY).toBeGreaterThanOrEqual(198)
    expect(dust.targetY).toBeLessThan(208)
    expect(horadricStaffTick(148, 100, 200, seed()).spawns.map(x => x.kind)).toEqual(['lightning', 'dust'])
  })

  it('special quest event 3 runs the orifice hook (0x6fba2138[3] = 0x6fb03450)', () => {
    const fx = new QuestFxLight()
    let calls = 0
    fx.onSpecialQuestEvent(3, { findStoneAlpha: () => null, spawnHoradricStaffIfOrificeNear: () => void calls++ })
    expect(calls).toBe(1)
  })

  it('ClientWorld: event 3 show at the orifice — staff, light_jet, 7 beams, lightning, dust and the shake', () => {
    const world = new ClientWorld()
    world.setCollisionChecker(() => false)
    world.setQuestFxSeed(0xcafebabe)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'object', id: 77, classId: HORADRIC_ORIFICE_OBJECT_CLASS, x: 300, y: 400, mode: 1 },
    } as any)
    const orifice = world.getUnit('object', 77)!
    const staff = world.spawnHoradricStaffAtOrifice(orifice)
    expect(staff.classId).toBe(338)
    expect(staff.altitude).toBe(40)
    expect(orifice.overlays.map(o => o.token)).toContain('light_jet')

    const beamKeys = new Set<number>()
    let lightningSeen = 0
    let dustSeen = 0
    let shakeAtTick = -1
    for (let t = 1; t <= 300; t++) {
      world.tick(40)
      for (const m of world.getUnitsByType('missile')) {
        if (m.missileKey === 'horadriclight') beamKeys.add(m.id)
        if (m.missileKey === 'horadriclightning' && m.ageTicks === 0) lightningSeen++
        if (m.missileKey === 'dust' && m.ageTicks === 0) dustSeen++
      }
      if (shakeAtTick < 0 && world.screenShake.active) shakeAtTick = t
    }
    expect(beamKeys.size).toBe(7)
    // rem = 440 - (t - 1): rem 150 is tick 291.
    expect(shakeAtTick).toBe(291)
    expect(world.screenShake.sustainMs).toBe(4000)
    expect(world.screenShake.amplitude).toBe(25)
    // even rem in [150, 164] at ticks 277..291 -> 8 lightnings; rem 149..141 (ticks 292..300) add 4 more.
    expect(lightningSeen).toBe(12)
    expect(dustSeen).toBe(9)
    expect(world.getUnitsByType('missile').find(m => m.missileKey === 'horadricstaff')?.altitude).toBe(70)

    const bolt = world.getUnitsByType('missile').find(m => m.missileKey === 'horadriclightning')!
    expect(bolt.fixedDirection).toBe(true)
    expect(bolt.direction).toBe(0x15)
    const boltInput = {
      kind: 'missile' as const,
      id: bolt.id,
      classId: 339,
      x: bolt.x,
      y: bolt.y,
      vx: bolt.vx,
      vy: bolt.vy,
      direction: bolt.direction,
      fixedDirection: true,
    }
    expect(computeMissileClipDirection(boltInput, 32)).toBe(
      computeMissileClipDirection({ kind: 'missile', id: 1, classId: 339, x: 0, y: 0, direction: 0x15 }, 32),
    )
  })
})

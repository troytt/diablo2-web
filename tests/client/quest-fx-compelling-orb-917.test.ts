/**
 * Issue #917: the Compelling Orb smashed with Khalim's Will (1.13c).
 *
 * Ground truth (D2Client.dll / D2Game.dll 1.13c, see kb/quests/a3-compelling-orb-smash-113c.md):
 * - D2Game OperateFn 53 (0x6fd0a140): orb object 404 -> OBJMODE_OPERATING (29 frames, FrameDelta 128 -> mode 2 by the
 *   client animation tick), the invisible MonStats 366 orb monster is killed, the stairs (objects.txt 386) open when the
 *   server-only orbmist reaches them; S2C 0x89 event 10 has no client handler.
 * - D2Client MonUMod 22 event 1 (0x6fba9fe0[111] = 0x6fad0fb0) for class 366 in mode 0 -> 0x6fb030d0: client orbmist
 *   368 from the orb monster to the stairs (#10754) or to (x - 15, y - 15).
 * - CltDoFunc 25 (0x6fb683d0): every CltParam3 elapsed frames, an orbmisttrail 369 at a random point within CltParam2
 *   of the mist heading for a random offset within CltParam1.
 */

import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../../src/client/render/missiles-meta.ts'
import { CANONICAL_113C_MISSILES } from '../../src/common/skills/missiles-data.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { QUEST_FX_MISSILES_113C } from '../../src/client/world/quest-fx-data-113c.ts'
import {
  COMPELLING_ORB_MONSTER_CLASS,
  COMPELLING_ORB_OBJECT_CLASS,
  DURANCE_STAIRS_OBJECT_CLASS,
  orbMistTarget,
  orbMistTick,
} from '../../src/client/world/quest-fx-compelling-orb-113c.ts'
import { getObjectsTxtRecord113c } from '../../src/common/world/objects-txt-113c.ts'

const lcg = (lo: number, hi: number) => {
  const next = BigInt(lo >>> 0) * 0x6ac690c5n + BigInt(hi >>> 0)
  return { lo: Number(next & 0xffffffffn), hi: Number((next >> 32n) & 0xffffffffn) }
}

function makeWorld(stairs: { x: number; y: number } | null) {
  const world = new ClientWorld()
  world.setCollisionChecker(() => false)
  world.setQuestFxSeed(0x917917)
  if (stairs) {
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'object', id: 386, classId: DURANCE_STAIRS_OBJECT_CLASS, x: stairs.x, y: stairs.y, mode: 0 },
    } as any)
  }
  const lookups: number[] = []
  world.setNearRoomObjectFinder((_x, _y, classId) => {
    lookups.push(classId)
    return world.getUnitsByType('object').find(o => o.classId === classId) ?? null
  })
  return { world, lookups }
}

function assignOrbMonster(world: ClientWorld, bossMods: number[] | undefined) {
  world.apply({
    type: 'UnitAssign',
    unit: { unitType: 'monster', id: 366366, classId: COMPELLING_ORB_MONSTER_CLASS, x: 5000, y: 6000, mode: 1, bossMods },
  } as any)
}

describe('Issue #917: Compelling Orb smash (1.13c)', () => {
  it('extracts Missiles.txt 368 / 369 / 370 from the 1.13c tables', () => {
    expect(QUEST_FX_MISSILES_113C[368]).toMatchObject({
      name: 'orbmist',
      pCltDoFunc: 25,
      range: 400,
      vel: 2,
      cltParam1: 10,
      cltParam2: 3,
      cltParam3: 1,
      cltSubMissile1: 369,
      light: 2,
      red: 255,
      green: 125,
      blue: 125,
    })
    expect(QUEST_FX_MISSILES_113C[369]).toMatchObject({ name: 'orbmisttrail', pCltDoFunc: 1, range: 50, vel: 3 })
    expect(QUEST_FX_MISSILES_113C[370]).toMatchObject({ name: 'orbmistfade', range: 15 })
    expect(QUEST_FX_MISSILES_113C[368]!.travelSound).toBe(QUEST_FX_MISSILES_113C[369]!.travelSound)
  })

  it('objects.txt: orb 404 OP is a 29-frame one-shot at FrameDelta 128, stairs 386 OP 9 frames at 120', () => {
    const orb = getObjectsTxtRecord113c(COMPELLING_ORB_OBJECT_CLASS)
    expect(orb.name).toBe('compellingorb')
    expect(orb.frameCnt.slice(0, 3)).toEqual([29, 29, 1])
    expect(orb.frameDelta[1]).toBe(128)
    expect(orb.cycleAnim[1]).toBe(0)
    const stairs = getObjectsTxtRecord113c(DURANCE_STAIRS_OBJECT_CLASS)
    expect(stairs.frameCnt.slice(0, 3)).toEqual([1, 9, 1])
    expect(stairs.frameDelta[1]).toBe(120)
  })

  it('bakes the trail art (mist_Fade_Orb_Loop) and runtime CltDoFunc 25 / pCltHitFunc 0 metadata; orbmist itself has CelFile null (light only)', () => {
    expect(CANONICAL_113C_MISSILES['orbmist']?.pCltDoFunc).toBe(25)
    expect(CANONICAL_113C_MISSILES['orbmist']?.cltSubMissile1).toBe('orbmisttrail')
    expect(MISSILE_METAS['orbmisttrail']?.celFile).toBe('mist_Fade_Orb_Loop')
    expect(CANONICAL_113C_MISSILES['orbmisttrail']?.pCltDoFunc).toBe(1)
    expect(CANONICAL_113C_MISSILES['orbmisttrail']?.alwaysExplode).toBe(true)
    expect(CANONICAL_113C_MISSILES['orbmisttrail']?.pCltHitFunc).toBeUndefined()
    expect(MISSILE_METAS['orbmistfade']?.celFile).toBe('mist_Fade_Orb')
  })

  it('0x6fb030d0 target: the stairs, else (x - 15, y - 15)', () => {
    expect(orbMistTarget({ x: 100, y: 200 }, { x: 110, y: 190 })).toEqual({ x: 110, y: 190 })
    expect(orbMistTarget({ x: 100, y: 200 }, null)).toEqual({ x: 85, y: 185 })
  })

  it('CltDoFunc 25: four RAND draws (dest radius 10, init radius 3) per trail, every CltParam3 frames', () => {
    const seed = { lo: 0x1234567, hi: 666 }
    const s1 = lcg(seed.lo, seed.hi)
    const s2 = lcg(s1.lo, s1.hi)
    const s3 = lcg(s2.lo, s2.hi)
    const s4 = lcg(s3.lo, s3.hi)
    const t = orbMistTick(7, 100, 200, seed)!
    const dx = (s1.lo % 21) - 10
    const dy = (s2.lo % 21) - 10
    const sx = (s3.lo % 7) - 3 + 100
    const sy = (s4.lo % 7) - 3 + 200
    expect(t).toEqual({ missile: 369, x: sx, y: sy, targetX: sx + dx, targetY: sy + dy })
    expect(seed).toEqual(s4)
    const freq2 = { cltParam1: 10, cltParam2: 3, cltParam3: 2 }
    expect(orbMistTick(3, 0, 0, { lo: 1, hi: 2 }, freq2)).toBeNull()
    expect(orbMistTick(4, 0, 0, { lo: 1, hi: 2 }, freq2)).not.toBeNull()
    // CltParam3 0 is clamped to 1 (0x6fb6842a).
    expect(orbMistTick(5, 0, 0, { lo: 1, hi: 2 }, { cltParam1: 1, cltParam2: 1, cltParam3: 0 })).not.toBeNull()
  })

  it('ClientWorld: MonStats 366 with MonUMod 22 dying in mode 0 sends the mist to the stairs and spawns trails', () => {
    const { world, lookups } = makeWorld({ x: 5012, y: 5994 })
    assignOrbMonster(world, [22])
    world.apply({ type: 'UnitMode', unitType: 'monster', id: 366366, mode: 0, lifePct: 0 } as any)
    expect(lookups).toEqual([DURANCE_STAIRS_OBJECT_CLASS])
    const mist = world.getUnitsByType('missile').find(m => m.missileKey === 'orbmist')!
    expect(mist).toBeDefined()
    expect(mist.classId).toBe(368)
    expect(mist.ownerId).toBe(366366)
    expect([mist.x, mist.y]).toEqual([5000, 6000])
    expect([mist.targetX, mist.targetY]).toEqual([5012, 5994])
    expect(mist.maxTicks).toBe(400)
    // heads for the stairs at Vel 2 (dwVelocity 384 -> 0.09375 sub-tiles / tick)
    const speed = Math.hypot(mist.vx ?? 0, mist.vy ?? 0)
    expect(speed).toBeCloseTo(0.09375, 6)
    expect(Math.sign(mist.vx ?? 0)).toBe(1)
    expect(Math.sign(mist.vy ?? 0)).toBe(-1)

    let trails = 0
    for (let t = 1; t <= 10; t++) {
      world.tick(40)
      trails += world.getUnitsByType('missile').filter(m => m.missileKey === 'orbmisttrail' && m.ageTicks === 0).length
    }
    // CltParam3 1: one trail per tick
    expect(trails).toBe(10)
    const trail = world.getUnitsByType('missile').find(m => m.missileKey === 'orbmisttrail')!
    expect(trail.classId).toBe(369)
    expect(trail.ownerId).toBe(366366)
    expect(trail.maxTicks).toBe(50)
    expect(Math.abs(trail.x - 5000)).toBeLessThanOrEqual(4)
    // the mist's carrier and trails never hit the local player (client-only visuals)
    expect(world.getUnitsByType('missile').some(m => m.missileKey === 'orbmist')).toBe(true)

    // Advance 50 more ticks so the first trail expires; AlwaysExplode = 0 means no orbmistfade is spawned on expiry.
    for (let t = 0; t < 50; t++) {
      world.tick(40)
    }
    expect(world.getUnitsByType('missile').some(m => m.missileKey === 'orbmistfade')).toBe(false)
  })

  it('ClientWorld: finds stairs 386 from world units when no custom nearRoomObjectFinder is registered', () => {
    const world = new ClientWorld()
    world.setCollisionChecker(() => false)
    world.setQuestFxSeed(0x917917)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'object', id: 386, classId: DURANCE_STAIRS_OBJECT_CLASS, x: 5012, y: 5994, mode: 0 },
    } as any)
    assignOrbMonster(world, [22])
    world.apply({ type: 'UnitMode', unitType: 'monster', id: 366366, mode: 0, lifePct: 0 } as any)
    const mist = world.getUnitsByType('missile').find(m => m.missileKey === 'orbmist')!
    expect(mist).toBeDefined()
    expect([mist.targetX, mist.targetY]).toEqual([5012, 5994])
  })

  it('ClientWorld: without the stairs in the near rooms the mist goes to (x - 15, y - 15)', () => {
    const { world } = makeWorld(null)
    assignOrbMonster(world, [22])
    world.apply({ type: 'UnitMode', unitType: 'monster', id: 366366, mode: 0, lifePct: 0 } as any)
    const mist = world.getUnitsByType('missile').find(m => m.missileKey === 'orbmist')!
    expect([mist.targetX, mist.targetY]).toEqual([4985, 5985])
  })

  it('ClientWorld: no MonUMod 22 (0x6fad12f0 finds no table entry) -> no mist', () => {
    const { world, lookups } = makeWorld({ x: 5012, y: 5994 })
    assignOrbMonster(world, undefined)
    world.apply({ type: 'UnitMode', unitType: 'monster', id: 366366, mode: 0, lifePct: 0 } as any)
    expect(lookups).toEqual([])
    expect(world.getUnitsByType('missile').some(m => m.missileKey === 'orbmist')).toBe(false)
  })

  it('ClientWorld: the orb object plays its 29-frame OP animation and settles in mode 2', () => {
    const { world } = makeWorld({ x: 5012, y: 5994 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'object', id: 404, classId: COMPELLING_ORB_OBJECT_CLASS, x: 5000, y: 6000, mode: 0 },
    } as any)
    world.apply({ type: 'UnitMode', unitType: 'object', id: 404, mode: 1, eventCode: 3, eventFlag: 0 } as any)
    const orb = world.getUnit('object', 404)!
    let modeOneAt = -1
    let modeTwoAt = -1
    for (let t = 1; t <= 90 && modeTwoAt < 0; t++) {
      world.tick(40)
      if (modeOneAt < 0 && orb.mode === 1) modeOneAt = t
      if (orb.mode === 2) modeTwoAt = t
    }
    expect(modeOneAt).toBeGreaterThan(0)
    // 28 frames * 256 / (128 - 8 + rand(16)) ticks: 53..60
    expect(modeTwoAt - modeOneAt).toBeGreaterThanOrEqual(52)
    expect(modeTwoAt - modeOneAt).toBeLessThanOrEqual(61)
  })
})

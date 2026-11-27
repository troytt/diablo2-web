/**
 * VFX Parity B14-p2 (#1144..#1147): Druid Elemental client VFX parity against 1.13c Missiles.txt & Skills.txt.
 *
 * - #1144 (B14-7): Hurricane (#250) debris uses Missiles.txt Range (hurricaneswoosh 22, hurricanerock 20,
 *   hurricanetree 20) instead of hardcoded maxTicks=100, and periodically spawns debris throughout state 144.
 * - #1145 (B14-8): Volcano (#244) uses real 'volcano' (Range=150) + 'volcano overlay fire' (Range=150) on cast,
 *   spawns CltSubMissile1 = 'volcano debris 2' (Range=16, Vel=14) in the CltParam3..CltParam4 (2..128) window at
 *   calc4=2 cadence, and 'volcano debris 2' impact (pCltHitFunc=55) spawns 'volcano explosion' (Range=18) +
 *   'volcano small fire' (Range=18) without 'fireexplode' or fake clientAlias names.
 * - #1146 (B14-9): Eruption / Fissure (#234) spawns only 'erruption center' (Range=80) on cast; its stepper
 *   (pCltDoFunc=48) spawns CltSubMissile1 = 'erruption crack 1' (Range=84) + CltSubMissile2 = 'erruption smoke 1'
 *   (Range=84) every calc2=6 frames within ±(calc1-1)=±6 sub-tiles, never 'erruption crack 2' or 'firesmall'.
 * - #1147 (B14-10): Armageddon (#249) cast and periodic state 145 meteors spawn 'armageddonrock' (Range=25,
 *   pCltHitFunc=55, ExplosionMissile="") + 'armageddontail' (Range=25), and every 'armageddonrock' impact spawns
 *   both CltHitSubMissile1 = 'armageddonexplosion' (Range=16) and CltHitSubMissile2 = 'armageddonfire' (Range=37).
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'

function createDruidWorld() {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Dru', x: 100, y: 100 })
  const caster = world.getUnit('player', 1)!
  return { world, caster }
}

function getMissileUnits(world: ClientWorld) {
  return Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
}

describe('VFX-B14-p2 Druid Elemental Client VFX Parity (#1144, #1145, #1146, #1147)', () => {
  it('#1144 (B14-7): Hurricane (#250) uses Missiles.txt Range (22/20/20) and continuously re-emits debris during state 144', () => {
    expect(CANONICAL_113C_MISSILES['hurricaneswoosh']?.range).toBe(22)
    expect(CANONICAL_113C_MISSILES['hurricanerock']?.range).toBe(20)
    expect(CANONICAL_113C_MISSILES['hurricanetree']?.range).toBe(20)

    const { world, caster } = createDruidWorld()
    ;(world as any).spawnMissilesForSkill(caster, 250, 100, 100, 5)

    expect(caster.states.has(144)).toBe(true)
    const initialMissiles = getMissileUnits(world)
    const swoosh0 = initialMissiles.find((m) => m.missileKey === 'hurricaneswoosh')
    const rock0 = initialMissiles.find((m) => m.missileKey === 'hurricanerock')
    const tree0 = initialMissiles.find((m) => m.missileKey === 'hurricanetree')
    expect(swoosh0?.maxTicks).toBe(22)
    expect(rock0?.maxTicks).toBe(20)
    expect(tree0?.maxTicks).toBe(20)

    const initialIds = new Set(initialMissiles.map((m) => m.id))

    // Step 45 ticks (past the initial 20-22 tick Range, well inside the 250-tick Hurricane state 144)
    for (let t = 0; t < 45; t++) {
      ;(world as any).stepDiscreteSimulationTick(40)
    }

    const activeAfter45 = getMissileUnits(world).filter(
      (m) =>
        m.missileKey === 'hurricaneswoosh' ||
        m.missileKey === 'hurricanerock' ||
        m.missileKey === 'hurricanetree',
    )
    expect(activeAfter45.length).toBeGreaterThanOrEqual(3)
    for (const m of activeAfter45) {
      expect(initialIds.has(m.id)).toBe(false)
      const expectedRange = m.missileKey === 'hurricaneswoosh' ? 22 : 20
      expect(m.maxTicks).toBe(expectedRange)
    }
  })

  it('#1145 (B14-8): Volcano (#244) spawns volcano + volcano overlay fire (Range=150), erupts volcano debris 2 (Range=16), and impacts into volcano explosion + volcano small fire (Range=18)', () => {
    expect(CANONICAL_113C_MISSILES['volcano']?.range).toBe(150)
    expect(CANONICAL_113C_MISSILES['volcano overlay fire']?.range).toBe(150)
    expect(CANONICAL_113C_MISSILES['volcano debris 2']?.range).toBe(16)
    expect(CANONICAL_113C_MISSILES['volcano explosion']?.range).toBe(18)
    expect(CANONICAL_113C_MISSILES['volcano small fire']?.range).toBe(18)
    expect(CANONICAL_113C_MISSILES['volcanobase' as keyof typeof CANONICAL_113C_MISSILES]).toBeUndefined()
    expect(CANONICAL_113C_MISSILES['volcanofire' as keyof typeof CANONICAL_113C_MISSILES]).toBeUndefined()
    expect(CANONICAL_113C_MISSILES['volcanorock' as keyof typeof CANONICAL_113C_MISSILES]).toBeUndefined()

    const { world, caster } = createDruidWorld()
    ;(world as any).spawnMissilesForSkill(caster, 244, 110, 106, 5)

    // Cast spawns ONLY 'volcano' and 'volcano overlay fire' (no initial 'volcano debris 2' or 'fireexplode')
    const castMissiles = getMissileUnits(world)
    expect(castMissiles.map((m) => m.missileKey).sort()).toEqual(['volcano', 'volcano overlay fire'])
    for (const m of castMissiles) {
      expect(m.maxTicks).toBe(150)
    }

    // Step through ticks 1..22 (rem = 149..128): CltParam4=128 window has not started yet
    for (let t = 1; t <= 22; t++) {
      ;(world as any).stepDiscreteSimulationTick(40)
    }
    expect(getMissileUnits(world).some((m) => m.missileKey === 'volcano debris 2')).toBe(false)

    // Tick 24 (rem = 126 < 128, rem % 2 === 0): first 'volcano debris 2' spawns with Range=16 and no 'fireexplode'
    ;(world as any).stepDiscreteSimulationTick(40) // tick 23 (rem = 127)
    ;(world as any).stepDiscreteSimulationTick(40) // tick 24 (rem = 126)
    const debrisList = getMissileUnits(world).filter((m) => m.missileKey === 'volcano debris 2')
    expect(debrisList.length).toBe(1)
    expect(debrisList[0]?.maxTicks).toBe(16)
    expect(debrisList[0]?.explosionMissile ?? '').toBe('')

    // Step 16 more ticks so the first 'volcano debris 2' reaches impact (pCltHitFunc=55)
    let sawVolcanoExplosion = false
    let sawVolcanoSmallFire = false
    for (let t = 0; t < 18; t++) {
      ;(world as any).stepDiscreteSimulationTick(40)
      for (const m of getMissileUnits(world)) {
        expect(m.missileKey).not.toBe('fireexplode')
        if (m.missileKey === 'volcano explosion') {
          sawVolcanoExplosion = true
          expect(m.maxTicks).toBe(18)
        }
        if (m.missileKey === 'volcano small fire') {
          sawVolcanoSmallFire = true
          expect(m.maxTicks).toBe(18)
        }
      }
    }
    expect(sawVolcanoExplosion).toBe(true)
    expect(sawVolcanoSmallFire).toBe(true)
  })

  it('#1146 (B14-9): Eruption / Fissure (#234) spawns only erruption center (Range=80) on cast and emits erruption crack 1 + erruption smoke 1 (Range=84) every 6 frames', () => {
    expect(CANONICAL_113C_MISSILES['erruption center']?.range).toBe(80)
    expect(CANONICAL_113C_MISSILES['erruption crack 1']?.range).toBe(84)
    expect(CANONICAL_113C_MISSILES['erruption smoke 1']?.range).toBe(84)
    expect(CANONICAL_113C_MISSILES['eruptioncenter' as keyof typeof CANONICAL_113C_MISSILES]).toBeUndefined()

    const { world, caster } = createDruidWorld()
    ;(world as any).spawnMissilesForSkill(caster, 234, 112, 108, 5)

    // Cast spawns ONLY 'erruption center' (Range=80)
    const castMissiles = getMissileUnits(world)
    expect(castMissiles.map((m) => m.missileKey)).toEqual(['erruption center'])
    expect(castMissiles[0]?.maxTicks).toBe(80)

    // Step 20 ticks and verify 'erruption crack 1' + 'erruption smoke 1' (Range=84, within ±6 sub-tiles), never 'erruption crack 2' or 'firesmall'
    for (let t = 0; t < 20; t++) {
      ;(world as any).stepDiscreteSimulationTick(40)
    }
    const afterMissiles = getMissileUnits(world)
    const keys = new Set(afterMissiles.map((m) => m.missileKey))
    expect(keys.has('erruption crack 1')).toBe(true)
    expect(keys.has('erruption smoke 1')).toBe(true)
    expect(keys.has('erruption crack 2')).toBe(false)
    expect(keys.has('firesmall')).toBe(false)

    for (const m of afterMissiles) {
      if (m.missileKey === 'erruption crack 1' || m.missileKey === 'erruption smoke 1') {
        expect(m.maxTicks).toBe(84)
        expect(Math.abs(m.x - 112)).toBeLessThanOrEqual(6)
        expect(Math.abs(m.y - 108)).toBeLessThanOrEqual(6)
      }
    }
  })

  it('#1147 (B14-10): Armageddon (#249) cast and periodic meteors use armageddonrock (Range=25, ExplosionMissile="") and spawn armageddonexplosion (Range=16) + armageddonfire (Range=37) on impact', () => {
    expect(CANONICAL_113C_MISSILES['armageddonrock']?.range).toBe(25)
    expect(CANONICAL_113C_MISSILES['armageddonrock']?.explosionMissile).toBe('')
    expect(CANONICAL_113C_MISSILES['armageddonexplosion']?.range).toBe(16)
    expect(CANONICAL_113C_MISSILES['armageddonfire']?.range).toBe(37)
    expect(CANONICAL_113C_MISSILES['armageddonground' as keyof typeof CANONICAL_113C_MISSILES]).toBeUndefined()

    const { world, caster } = createDruidWorld()
    ;(world as any).spawnMissilesForSkill(caster, 249, 106, 104, 5)

    const castRock = getMissileUnits(world).find((m) => m.missileKey === 'armageddonrock')
    const castTail = getMissileUnits(world).find((m) => m.missileKey === 'armageddontail')
    expect(castRock).toBeDefined()
    expect(castTail).toBeDefined()
    expect(castRock?.maxTicks).toBe(25)
    expect(castTail?.maxTicks).toBe(25)
    expect(castRock?.explosionMissile ?? '').toBe('')

    // Step through tick 25 (initial rock impact) and through tick 45 (periodic state 145 rock impact)
    let impactExplosionCount = 0
    let impactFireCount = 0
    const seenIds = new Set<number>()
    for (let t = 0; t < 45; t++) {
      ;(world as any).stepDiscreteSimulationTick(40)
      for (const m of getMissileUnits(world)) {
        if (m.missileKey === 'armageddonrock') {
          expect(m.explosionMissile ?? '').toBe('')
          expect(m.maxTicks).toBe(25)
        }
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id)
          if (m.missileKey === 'armageddonexplosion') {
            impactExplosionCount++
            expect(m.maxTicks).toBe(16)
          }
          if (m.missileKey === 'armageddonfire') {
            impactFireCount++
            expect(m.maxTicks).toBe(37)
          }
        }
      }
    }
    // Both the initial meteor and at least one periodic state-145 meteor must have impacted with both children
    expect(impactExplosionCount).toBeGreaterThanOrEqual(2)
    expect(impactFireCount).toBeGreaterThanOrEqual(2)
    expect(impactExplosionCount).toBe(impactFireCount)
  })
})

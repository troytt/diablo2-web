import { describe, expect, it } from 'vitest'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'

function addHostileMonster(
  world: ClientWorld,
  id: number,
  x: number,
  y: number,
  opts?: { dead?: boolean; mode?: number; lifePct?: number; classId?: number },
): ClientUnit {
  const mon = new ClientUnit({
    unitType: 'monster',
    id,
    classId: opts?.classId ?? 1,
    x,
    y,
    mode: opts?.mode ?? 1,
    direction: 0,
    lifePct: opts?.lifePct ?? 128,
  })
  if (opts?.dead) mon.dead = true
  ;(world as any)._units.set(mon.key, mon)
  ;(world as any)._monsters.set(mon.id, mon)
  return mon
}

function addPlayerCaster(world: ClientWorld, id = 1, x = 100, y = 100): ClientUnit {
  const player = new ClientUnit({
    unitType: 'player',
    id,
    classId: 0, // Amazon
    x,
    y,
    mode: 1,
    direction: 0,
    lifePct: 128,
  })
  ;(world as any)._units.set(player.key, player)
  ;(world as any).selfId = id
  ;(world as any)._self.unitId = id
  ;(world as any)._self.x = x
  ;(world as any)._self.y = y
  return player
}

function getActiveMissiles(world: ClientWorld): ClientUnit[] {
  return Array.from<ClientUnit>((world as any)._units.values()).filter((u) => u.unitType === 'missile')
}

describe('Diablo II v1.13c Spell VFX Parity — B11-p2 Amazon (#1123)', () => {
  describe('#1123 (B11-7): Lightning Fury (#35) Missiles.txt #206 lightningfury & CltHit25 (0x6FB6AEF0) parity', () => {
    it('matches 1.13c Missiles.txt #206 (lightningfury) and #231 (furylightning) canonical row metadata', () => {
      const lf = CANONICAL_113C_MISSILES.lightningfury!
      expect(lf).toBeDefined()
      expect(lf.id).toBe(206)
      expect(lf.vel).toBe(30)
      expect(lf.maxVel).toBe(30)
      expect(lf.range).toBe(25)
      expect(lf.explosionMissile).toBe('')
      expect(lf.alwaysExplode).toBeFalsy()
      expect(lf.pierce).toBe(true)
      expect(lf.pCltDoFunc).toBe(1)
      expect(lf.pCltHitFunc).toBe(25)
      expect(lf.cltHitSubMissile1).toBe('furylightning')

      const fl = CANONICAL_113C_MISSILES.furylightning!
      expect(fl).toBeDefined()
      expect(fl.id).toBe(231)
      expect(fl.vel).toBe(30)
      expect(fl.maxVel).toBe(30)
      expect(fl.range).toBe(25)
      expect(fl.explosionMissile).toBe('')
      expect(fl.alwaysExplode).toBeFalsy()
      expect(fl.pCltDoFunc).toBe(1)
      expect(fl.pCltHitFunc).toBeUndefined()
    })

    it('does not inject explosionMissile="furylightning" or alwaysExplode=true when casting #35 Lightning Fury', () => {
      const world = new ClientWorld()
      const caster = addPlayerCaster(world, 1, 100, 100)

      ;(world as any).spawnMissilesForSkill(caster, 35, 120, 100, 5)
      const javelins = getActiveMissiles(world).filter((m) => m.missileKey === 'lightningfury')
      expect(javelins).toHaveLength(1)
      const jav = javelins[0]!
      expect(jav.explosionMissile).toBe('')
      expect(jav.alwaysExplode).toBe(false)
      expect(jav.maxTicks).toBe(25)
    })

    it('spawns 0 furylightning bolts when lightningfury expires at max range without hitting a unit (even with 0 monsters)', () => {
      const world = new ClientWorld()
      const caster = addPlayerCaster(world, 1, 100, 100)

      ;(world as any).spawnMissilesForSkill(caster, 35, 130, 100, 5)
      const jav = getActiveMissiles(world).find((m) => m.missileKey === 'lightningfury')!
      expect(jav).toBeDefined()

      for (let t = 0; t < 30; t++) {
        if (!(world as any)._units.has(jav.key)) break
        ;(world as any).stepMissileUnit(jav)
      }

      expect((world as any)._units.has(jav.key)).toBe(false)
      const furyBolts = getActiveMissiles(world).filter((m) => m.missileKey === 'furylightning')
      expect(furyBolts).toHaveLength(0)
    })

    it('spawns 0 furylightning bolts when lightningfury hits a wall without hitting a unit', () => {
      const world = new ClientWorld()
      const caster = addPlayerCaster(world, 1, 100, 100)
      addHostileMonster(world, 101, 108, 104)

      ;(world as any).spawnMissilesForSkill(caster, 35, 110, 100, 5)
      const jav = getActiveMissiles(world).find((m) => m.missileKey === 'lightningfury')!
      ;(world as any).triggerMissileImpact(jav, 105, 100, true, undefined)

      const furyBolts = getActiveMissiles(world).filter((m) => m.missileKey === 'furylightning')
      expect(furyBolts).toHaveLength(0)
    })

    it('spawns 0 furylightning bolts when lightningfury hits a monster with 0 other living hostiles within 15 sub-tiles', () => {
      const world = new ClientWorld()
      const caster = addPlayerCaster(world, 1, 100, 100)
      const hitMon = addHostileMonster(world, 101, 105, 100)
      // Out of 15 sub-tile radius (dist = 16)
      addHostileMonster(world, 102, 121, 100)
      // Dead monster within 15 sub-tiles
      addHostileMonster(world, 103, 108, 100, { dead: true, mode: 12, lifePct: 0 })
      // Friendly Valkyrie (classId 357) within 15 sub-tiles
      addHostileMonster(world, 104, 109, 100, { classId: 357 })

      ;(world as any).spawnMissilesForSkill(caster, 35, 105, 100, 5)
      const jav = getActiveMissiles(world).find((m) => m.missileKey === 'lightningfury')!
      ;(world as any).triggerMissileImpact(jav, hitMon.x, hitMon.y, false, hitMon)

      const furyBolts = getActiveMissiles(world).filter((m) => m.missileKey === 'furylightning')
      expect(furyBolts).toHaveLength(0)
    })

    it('spawns up to 1 + slvl (calc1=ln12) furylightning bolts (Range=25, pierce=true) toward living hostiles within Param3=15 sub-tiles on unit hit', () => {
      const world = new ClientWorld()
      const caster = addPlayerCaster(world, 1, 100, 100)
      const hitMon = addHostileMonster(world, 101, 105, 100)
      // 4 living hostiles within 15 sub-tiles of (105, 100): distances 4, 8, 12, 15
      addHostileMonster(world, 102, 109, 100)
      addHostileMonster(world, 103, 113, 100)
      addHostileMonster(world, 104, 117, 100)
      addHostileMonster(world, 105, 120, 100)
      // 1 hostile outside 15 sub-tiles (dist = 15.5)
      addHostileMonster(world, 106, 120.5, 100)

      // slvl = 2 -> maxBolts = 1 + 2 = 3
      ;(world as any).spawnMissilesForSkill(caster, 35, 105, 100, 2)
      const jav = getActiveMissiles(world).find((m) => m.missileKey === 'lightningfury')!
      ;(world as any).triggerMissileImpact(jav, hitMon.x, hitMon.y, false, hitMon)

      const furyBolts = getActiveMissiles(world).filter((m) => m.missileKey === 'furylightning')
      expect(furyBolts).toHaveLength(3)
      expect(furyBolts.map((b) => b.targetX)).toEqual([109, 113, 117])
      for (const bolt of furyBolts) {
        expect(bolt.maxTicks).toBe(25)
        expect(bolt.pierce).toBe(true)
        expect(bolt.hitUnitIds?.has(hitMon.id)).toBe(true)
      }
    })
  })
})

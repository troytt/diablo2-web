import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'
import {
  CLTDO25_RING_X_113C,
  CLTDO25_RING_Y_113C,
} from '../src/common/skills/cltdo25-ring-113c.ts'

describe('Diablo II v1.13c Spell VFX Parity — B10-p1 (#1106..#1111)', () => {
  describe('#1106 (B10-1): Fire Ball CltHitFunc 1 fireexplosion2 radius-3 disc', () => {
    it('spawns 1 explodingarrowexp + 29 fireexplosion2 in radius-3 integer disc with Range=12 and RandStart=5', () => {
      const fbRow = CANONICAL_113C_MISSILES.fireball!
      expect(fbRow.pCltHitFunc).toBe(1)
      expect(fbRow.cHitPar1).toBe(3)
      expect(fbRow.cHitPar2).toBe(1)
      expect(fbRow.cltHitSubMissile1).toBe('fireexplosion2')
      expect(fbRow.explosionMissile).toBe('explodingarrowexp')

      const exp2Row = CANONICAL_113C_MISSILES.fireexplosion2!
      expect(exp2Row.id).toBe(265)
      expect(exp2Row.range).toBe(12)
      expect(exp2Row.animLen).toBe(12)
      expect(exp2Row.randStart).toBe(5)
      expect(exp2Row.celFile).toBe('FireArrowExplode2')
      expect(MISSILE_METAS.fireexplosion2?.celFile).toBe('FireArrowExplode2')

      const world = new ClientWorld()
      const fb = (world as any).spawnMissileByKey('fireball', 100, 100, 110, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 47,
        skillLevel: 1,
      })
      ;(world as any).triggerMissileImpact(fb, 105, 100, false)

      const spawned = Array.from<any>((world as any)._units.values()).filter(
        (u: any) => u.unitType === 'missile' && u.key !== fb.key,
      )
      const centerExps = spawned.filter((u: any) => u.missileKey === 'explodingarrowexp')
      const discExps = spawned.filter((u: any) => u.missileKey === 'fireexplosion2')

      expect(centerExps).toHaveLength(1)
      expect(centerExps[0].x).toBe(105)
      expect(centerExps[0].y).toBe(100)

      expect(discExps).toHaveLength(29)
      for (const m of discExps) {
        const dx = m.x - 105
        const dy = m.y - 100
        expect(Number.isInteger(dx)).toBe(true)
        expect(Number.isInteger(dy)).toBe(true)
        expect(dx * dx + dy * dy).toBeLessThanOrEqual(9)
        expect(m.maxTicks).toBe(12)
        expect(m.frame).toBeGreaterThanOrEqual(0)
        expect(m.frame).toBeLessThan(5)
        expect(m.vx).toBe(0)
        expect(m.vy).toBe(0)
      }
    })
  })

  describe('#1107 (B10-2): Exploding Arrow CltHitFunc 1 fireexplosion2 radius-3 disc (no Fsexplode fireexplosion)', () => {
    it('spawns 1 explodingarrowexp + 29 fireexplosion2 (FireArrowExplode2) and 0 fireexplosion on impact', () => {
      const eaRow = CANONICAL_113C_MISSILES.explodingarrow!
      expect(eaRow.pCltHitFunc).toBe(1)
      expect(eaRow.cHitPar1).toBe(3)
      expect(eaRow.cHitPar2).toBe(1)
      expect(eaRow.cltHitSubMissile1).toBe('fireexplosion2')
      expect(eaRow.explosionMissile).toBe('explodingarrowexp')

      const world = new ClientWorld()
      const ea = (world as any).spawnMissileByKey('explodingarrow', 100, 100, 110, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 16,
        skillLevel: 1,
      })
      ;(world as any).triggerMissileImpact(ea, 105, 100, false)

      const spawned = Array.from<any>((world as any)._units.values()).filter(
        (u: any) => u.unitType === 'missile' && u.key !== ea.key,
      )
      expect(spawned.filter((u: any) => u.missileKey === 'fireexplosion')).toHaveLength(0)
      expect(spawned.filter((u: any) => u.missileKey === 'explodingarrowexp')).toHaveLength(1)
      const discExps = spawned.filter((u: any) => u.missileKey === 'fireexplosion2')
      expect(discExps).toHaveLength(29)
      for (const m of discExps) {
        const dx = m.x - 105
        const dy = m.y - 100
        expect(dx * dx + dy * dy).toBeLessThanOrEqual(9)
        expect(m.maxTicks).toBe(12)
      }
    })
  })

  describe('#1108 & #1109 (B10-3, B10-4): Immolation Arrow CltHitFunc 12 ground fire disc', () => {
    it('spawns 1 explodingarrowexp (wCltMissileB), 0 fireexplosion, 0 immolationfire, and a radius-3 disc of 100-frame firewall/firesmall/firemedium', () => {
      const iaRow = CANONICAL_113C_MISSILES.immolationarrow!
      expect(iaRow.pCltHitFunc).toBe(12)
      expect(iaRow.explosionMissile).toBe('')
      expect(iaRow.cHitPar1).toBe(0)
      expect(iaRow.cHitPar2).toBe(100)
      expect(iaRow.cHitCalc1).toBe('100')
      expect(iaRow.cltHitSubMissile1).toBe('firewall')
      expect(iaRow.cltHitSubMissile2).toBe('firesmall')
      expect(iaRow.cltHitSubMissile3).toBe('firemedium')

      const world = new ClientWorld()
      const ia = (world as any).spawnMissileByKey('immolationarrow', 100, 100, 110, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 27,
        skillLevel: 1,
      })
      ;(world as any).triggerMissileImpact(ia, 105, 100, false)

      const spawned = Array.from<any>((world as any)._units.values()).filter(
        (u: any) => u.unitType === 'missile' && u.key !== ia.key,
      )
      expect(spawned.filter((u: any) => u.missileKey === 'explodingarrowexp')).toHaveLength(1)
      expect(spawned.filter((u: any) => u.missileKey === 'fireexplosion')).toHaveLength(0)
      expect(spawned.filter((u: any) => u.missileKey === 'immolationfire')).toHaveLength(0)

      const patches = spawned.filter((u: any) => u.missileKey !== 'explodingarrowexp')
      expect(patches).toHaveLength(29)
      const allowedKeys = new Set(['firewall', 'firesmall', 'firemedium'])
      const seenKeys = new Set<string>()
      for (const m of patches) {
        expect(allowedKeys.has(m.missileKey)).toBe(true)
        seenKeys.add(m.missileKey)
        const dx = m.x - 105
        const dy = m.y - 100
        expect(dx * dx + dy * dy).toBeLessThanOrEqual(9)
        expect(m.maxTicks).toBe(100)
        expect(m.vx).toBe(0)
        expect(m.vy).toBe(0)
      }
      expect(seenKeys.size).toBe(3)
    })
  })

  describe('#1110 (B10-5): Frozen Orb CltHitFunc 30 frozenorbnova + CltDoFunc 20 delayed turn', () => {
    it('spawns 16 frozenorbnova (and 0 extra frozenorbbolt) on range expiry and wall impact, and frozenorbnova turns +45 deg on remaining ticks 4 and 2', () => {
      const orbRow = CANONICAL_113C_MISSILES.frozenorb!
      expect(orbRow.pCltDoFunc).toBe(19)
      expect(orbRow.pCltHitFunc).toBe(30)
      expect(orbRow.cHitPar1).toBe(4)
      expect(orbRow.cltHitSubMissile1).toBe('frozenorbnova')
      expect(orbRow.explosionMissile).toBe('')

      const novaRow = CANONICAL_113C_MISSILES.frozenorbnova!
      expect(novaRow.pCltDoFunc).toBe(20)
      expect(novaRow.cltParam1).toBe(6)
      expect(novaRow.cltParam2).toBe(2)

      // 1) Range expiry on Frozen Orb
      const world = new ClientWorld()
      const orb = (world as any).spawnMissileByKey('frozenorb', 100, 100, 120, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 64,
        skillLevel: 1,
      })
      const maxTicks = orb.maxTicks ?? 40
      let boltsBeforeLastTick = 0
      for (let t = 0; t < maxTicks; t++) {
        if (t === maxTicks - 1) {
          boltsBeforeLastTick = Array.from((world as any)._units.values()).filter(
            (u: any) => u.unitType === 'missile' && u.missileKey === 'frozenorbbolt',
          ).length
        }
        ;(world as any).stepMissileUnit(orb)
      }
      const allAfterExpiry = Array.from<any>((world as any)._units.values()).filter(
        (u: any) => u.unitType === 'missile',
      )
      const boltsAfterExpiry = allAfterExpiry.filter(
        (u: any) => u.missileKey === 'frozenorbbolt',
      ).length
      // Only the 1 in-flight CltDoFunc 19 bolt for the final tick was emitted; no 16-bolt burst!
      expect(boltsAfterExpiry - boltsBeforeLastTick).toBe(1)

      const novas = allAfterExpiry.filter((u: any) => u.missileKey === 'frozenorbnova')
      expect(novas).toHaveLength(16)

      // Verify initial directions match the 64-entry ring with step 4
      for (let i = 0; i < 16; i++) {
        const idx = i * 4
        const expectedAngle = Math.atan2(CLTDO25_RING_Y_113C[idx]!, CLTDO25_RING_X_113C[idx]!)
        const actualAngle = Math.atan2(novas[i].vy, novas[i].vx)
        expect(actualAngle).toBeCloseTo(expectedAngle, 5)
      }

      // 2) Verify CltDoFunc 20 on frozenorbnova: straight while rem >= 6, turns +45 deg at rem=4 and rem=2
      const worldNova = new ClientWorld()
      const nova = (worldNova as any).spawnMissileByKey('frozenorbnova', 100, 100, 110, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 64,
        skillLevel: 1,
      })
      expect(nova.maxTicks).toBe(25)
      const angle0 = Math.atan2(nova.vy, nova.vx)
      expect(angle0).toBeCloseTo(0, 5)

      // Step 20 ticks (prevAgeTicks 0..19, remBeforeStep 25..6): direction stays 0
      for (let t = 0; t < 20; t++) {
        ;(worldNova as any).stepMissileUnit(nova)
        expect(Math.atan2(nova.vy, nova.vx)).toBeCloseTo(0, 5)
      }
      // Tick 20 (prevAgeTicks = 20, remBeforeStep = 5, odd): still 0
      ;(worldNova as any).stepMissileUnit(nova)
      expect(Math.atan2(nova.vy, nova.vx)).toBeCloseTo(0, 5)

      // Tick 21 (prevAgeTicks = 21, remBeforeStep = 4 < 6 and even): rotates +45 deg (PI/4)
      ;(worldNova as any).stepMissileUnit(nova)
      expect(Math.atan2(nova.vy, nova.vx)).toBeCloseTo(Math.PI / 4, 5)

      // Tick 22 (prevAgeTicks = 22, remBeforeStep = 3, odd): stays +45 deg
      ;(worldNova as any).stepMissileUnit(nova)
      expect(Math.atan2(nova.vy, nova.vx)).toBeCloseTo(Math.PI / 4, 5)

      // Tick 23 (prevAgeTicks = 23, remBeforeStep = 2 < 6 and even): rotates another +45 deg -> +90 deg (PI/2)
      ;(worldNova as any).stepMissileUnit(nova)
      expect(Math.atan2(nova.vy, nova.vx)).toBeCloseTo(Math.PI / 2, 5)
    })
  })

  describe('#1111 (B10-6): Plague Javelin CltHitFunc 2 double-ring clouds (8 slow + 15 fast, Range 60, subLoops 3)', () => {
    it('spawns 8 slow + 15 fast = 23 plaguejavcloud with 1:2 speed ratio, maxTicks=60, and subLoops=3', () => {
      const pjRow = CANONICAL_113C_MISSILES.plaguejavelin!
      expect(pjRow.pCltHitFunc).toBe(2)
      expect(pjRow.cHitPar1).toBe(1)
      expect(pjRow.cHitPar2).toBe(2)
      expect(pjRow.cHitPar3).toBe(3)
      expect(pjRow.cltHitSubMissile1).toBe('plaguejavcloud')

      const cloudRow = CANONICAL_113C_MISSILES.plaguejavcloud!
      expect(cloudRow.range).toBe(60)
      expect(cloudRow.param1).toBe(2)
      expect(cloudRow.param2).toBe(4)
      expect(cloudRow.subLoop).toBe(1)
      expect(cloudRow.subStart).toBe(10)
      expect(cloudRow.subStop).toBe(19)

      const world = new ClientWorld()
      const pj = (world as any).spawnMissileByKey('plaguejavelin', 100, 100, 110, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 25,
        skillLevel: 10,
      })
      ;(world as any).triggerMissileImpact(pj, 105, 100, false)

      const clouds = Array.from<any>((world as any)._units.values()).filter(
        (u: any) => u.unitType === 'missile' && u.missileKey === 'plaguejavcloud',
      )
      expect(clouds).toHaveLength(23)

      const slowClouds = clouds.slice(0, 8)
      const fastClouds = clouds.slice(8, 23)
      const slowSpeed = Math.hypot(slowClouds[0].vx, slowClouds[0].vy)
      const fastSpeed = Math.hypot(fastClouds[0].vx, fastClouds[0].vy)

      expect(slowSpeed).toBeGreaterThan(0)
      expect(fastSpeed / slowSpeed).toBeCloseTo(2, 5)

      for (const c of slowClouds) {
        expect(Math.hypot(c.vx, c.vy)).toBeCloseTo(slowSpeed, 6)
        expect(c.maxTicks).toBe(60)
        expect(c.subLoop).toBe(1)
        expect(c.subStart).toBe(10)
        expect(c.subStop).toBe(19)
        expect(c.subLoops).toBe(3)
      }
      for (const c of fastClouds) {
        expect(Math.hypot(c.vx, c.vy)).toBeCloseTo(fastSpeed, 6)
        expect(c.maxTicks).toBe(60)
        expect(c.subLoop).toBe(1)
        expect(c.subStart).toBe(10)
        expect(c.subStop).toBe(19)
        expect(c.subLoops).toBe(3)
      }
    })
  })
})

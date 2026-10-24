import { describe, expect, it } from 'vitest'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  LINEAR_SKILL_MISSILES,
  SKILL_CLT_MISSILE_AB_113C,
} from '../src/client/world/world-skill-state-tables.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'

function addHostileMonster(world: ClientWorld, id: number, x: number, y: number, classId = 1): ClientUnit {
  const mon = new ClientUnit({
    unitType: 'monster',
    id,
    classId,
    x,
    y,
    mode: 1,
    direction: 0,
    lifePct: 128,
  })
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

describe('Diablo II v1.13c Spell VFX Parity — B11-p1 Amazon (#1117..#1122)', () => {
  describe('#1117 (B11-1): Missiles.txt Pierce=1 requires owner STAT_SKILL_PIERCE (166) or STAT_ITEM_PIERCE (156) > 0 and caps at 4 pierces (5 hits)', () => {
    it('removes hardcoded pierce: true from LINEAR_SKILL_MISSILES for #15 (poisonjav), #20 (lightningjavelin), #35 (lightningfury)', () => {
      expect(LINEAR_SKILL_MISSILES[15]).toEqual({ key: 'poisonjav' })
      expect(LINEAR_SKILL_MISSILES[20]).toEqual({ key: 'lightningjavelin' })
      expect(LINEAR_SKILL_MISSILES[35]).toEqual({ key: 'lightningfury' })
      expect(LINEAR_SKILL_MISSILES[15]?.pierce).toBeUndefined()
      expect(LINEAR_SKILL_MISSILES[20]?.pierce).toBeUndefined()
      expect(LINEAR_SKILL_MISSILES[35]?.pierce).toBeUndefined()
    })

    it('Fire Arrow (#7) from an owner with 0 pierce stat hits 2 lined-up monsters and is deleted after the first hit (hitUnitIds.size === 1)', () => {
      const world = new ClientWorld()
      const caster = addPlayerCaster(world, 1, 100, 100)
      addHostileMonster(world, 201, 104, 100)
      addHostileMonster(world, 202, 108, 100)

      ;(world as any).spawnMissilesForSkill(caster, 7, 120, 100, 1)
      const arrows = getActiveMissiles(world).filter((m) => m.missileKey === 'firearrow')
      expect(arrows).toHaveLength(1)
      const arrow = arrows[0]!
      expect(arrow.canPierce).toBe(true)
      expect(arrow.pierce).toBe(false)
      expect(arrow.pierceRemaining).toBe(0)

      for (let t = 0; t < 10; t++) {
        if (!(world as any)._units.has(arrow.key)) break
        ;(world as any).stepMissileUnit(arrow)
      }

      expect((world as any)._units.has(arrow.key)).toBe(false)
      expect(arrow.hitUnitIds?.size).toBe(1)
      expect(arrow.hitUnitIds?.has(201)).toBe(true)
      expect(arrow.hitUnitIds?.has(202)).toBe(false)
    })

    it('Fire Arrow (#7) with skill_pierce = 100 (STAT_SKILL_PIERCE = 166) pierces 4 times (hitting 5 targets) and never more than 4 pierces across 6 lined-up monsters', () => {
      const world = new ClientWorld()
      const caster = addPlayerCaster(world, 1, 100, 100)
      caster.stats.set(166, 100) // STAT_SKILL_PIERCE = 100%

      for (let i = 0; i < 6; i++) {
        addHostileMonster(world, 301 + i, 103 + i * 3, 100)
      }

      ;(world as any).spawnMissilesForSkill(caster, 7, 130, 100, 1)
      const arrows = getActiveMissiles(world).filter((m) => m.missileKey === 'firearrow')
      expect(arrows).toHaveLength(1)
      const arrow = arrows[0]!
      expect(arrow.canPierce).toBe(true)
      expect(arrow.pierce).toBe(true)
      expect(arrow.pierceRemaining).toBe(4)

      for (let t = 0; t < 25; t++) {
        if (!(world as any)._units.has(arrow.key)) break
        ;(world as any).stepMissileUnit(arrow)
      }

      // Pierced 4 times -> hit 5 monsters (301..305), deleted on 5th hit before reaching 6th monster (306)
      expect((world as any)._units.has(arrow.key)).toBe(false)
      expect(arrow.hitUnitIds?.size).toBe(5)
      expect(Array.from(arrow.hitUnitIds ?? [])).toEqual([301, 302, 303, 304, 305])
      expect(arrow.pierceCount).toBe(5)
      expect(arrow.pierceRemaining).toBe(0)
    })
  })

  describe('#1118 (B11-2): Lightning Strike (#34) chain lightning originates at struck monster and requires a secondary target within 20 sub-tiles', () => {
    it('creates 0 lightningstrike missiles when only a single monster exists', () => {
      const world = new ClientWorld()
      const caster = addPlayerCaster(world, 1, 100, 100)
      const monA = addHostileMonster(world, 401, 103, 100)

      ;(world as any).spawnMissilesForSkill(caster, 34, monA.x, monA.y, 5)
      const lsMissiles = getActiveMissiles(world).filter((m) => m.missileKey === 'lightningstrike')
      expect(lsMissiles).toHaveLength(0)
      expect(monA.overlays.some((o) => o.token === 'lightning')).toBe(true)
    })

    it('spawns lightningstrike from monster A toward monster B when 2 monsters are within 20 sub-tiles', () => {
      const world = new ClientWorld()
      const caster = addPlayerCaster(world, 1, 100, 100)
      const monA = addHostileMonster(world, 411, 104, 100)
      const monB = addHostileMonster(world, 412, 116, 105)

      ;(world as any).spawnMissilesForSkill(caster, 34, monA.x, monA.y, 5)
      const lsMissiles = getActiveMissiles(world).filter((m) => m.missileKey === 'lightningstrike')
      expect(lsMissiles).toHaveLength(1)
      const ls = lsMissiles[0]!
      expect(ls.x).toBe(monA.x)
      expect(ls.y).toBe(monA.y)
      expect(ls.originX).toBe(monA.x)
      expect(ls.originY).toBe(monA.y)
      expect(ls.targetX).toBe(monB.x)
      expect(ls.targetY).toBe(monB.y)
      expect(ls.maxTicks).toBe(CANONICAL_113C_MISSILES.lightningstrike!.range) // 25
      expect(ls.hitUnitIds?.has(monA.id)).toBe(true)
    })
  })

  describe('#1119 (B11-3): Strafe (#26) fires 1 missile per sequence event frame across distinct frames', () => {
    it('with 5 targets, a Strafe cast produces 1 missile on each of 5 distinct event frames, never more than 1 per frame', () => {
      const world = new ClientWorld()
      const caster = addPlayerCaster(world, 1, 100, 100)
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI) / 6
        addHostileMonster(world, 501 + i, 100 + Math.cos(angle) * 15, 100 + Math.sin(angle) * 15)
      }

      // slvl = 2 -> minArrows = 2, maxArrows = min(10, 5) = 5, 5 hostiles -> 5 shots total
      ;(world as any).applySkillCastToUnit(caster, 26, 115, 100, 2, true, 1000)

      const seenIds = new Set<number>()
      const spawnCountsPerFrame: number[] = []

      const recordNewShots = () => {
        const current = getActiveMissiles(world).filter(
          (m) => m.sourceSkillId === 26 && !seenIds.has(m.id),
        )
        for (const m of current) {
          seenIds.add(m.id)
        }
        if (current.length > 0) {
          spawnCountsPerFrame.push(current.length)
        }
      }

      recordNewShots()
      for (let f = 0; f < 30; f++) {
        world.tick(40)
        recordNewShots()
      }

      expect(seenIds.size).toBe(5)
      expect(spawnCountsPerFrame).toEqual([1, 1, 1, 1, 1])
    })
  })

  describe('#1120 (B11-4): Strafe (#26) client uses Skills.txt cltmissilea/b (multipleshotarrow / multipleshotbolt)', () => {
    it('spawns multipleshotarrow with a bow and multipleshotbolt with a crossbow, never strafearrow/strafebolt', () => {
      expect(SKILL_CLT_MISSILE_AB_113C[26]).toEqual({
        cltMissileA: 'multipleshotarrow',
        cltMissileB: 'multipleshotbolt',
      })

      // 1) Bow equipped (default / 'lwb')
      const bowWorld = new ClientWorld()
      const bowCaster = addPlayerCaster(bowWorld, 1, 100, 100)
      ;(bowWorld as any)._containers.equipmentBySlot.set(4, { code: 'lwb' })
      ;(bowWorld as any).spawnMissilesForSkill(bowCaster, 26, 120, 100, 1)
      for (let f = 0; f < 20; f++) bowWorld.tick(40)
      const bowMissiles = getActiveMissiles(bowWorld).filter((m) => m.sourceSkillId === 26)
      expect(bowMissiles.length).toBeGreaterThan(0)
      for (const m of bowMissiles) {
        expect(m.missileKey).toBe('multipleshotarrow')
      }

      // 2) Crossbow equipped ('lxb')
      const xbowWorld = new ClientWorld()
      const xbowCaster = addPlayerCaster(xbowWorld, 1, 100, 100)
      ;(xbowWorld as any)._containers.equipmentBySlot.set(4, { code: 'lxb' })
      ;(xbowWorld as any).spawnMissilesForSkill(xbowCaster, 26, 120, 100, 1)
      for (let f = 0; f < 20; f++) xbowWorld.tick(40)
      const xbowMissiles = getActiveMissiles(xbowWorld).filter((m) => m.sourceSkillId === 26)
      expect(xbowMissiles.length).toBeGreaterThan(0)
      for (const m of xbowMissiles) {
        expect(m.missileKey).toBe('multipleshotbolt')
      }
    })
  })

  describe('#1121 (B11-5): Poison Javelin (#38) & Plague Javelin (#43) CltDoFunc=3 trail cloud parity (Range=60)', () => {
    it('plaguejavelin in flight spawns only plaguejavcloud (maxTicks=60) and poisonjav spawns only poisonjavcloud (maxTicks=60)', () => {
      expect(CANONICAL_113C_MISSILES.poisonjav?.pCltDoFunc).toBe(3)
      expect(CANONICAL_113C_MISSILES.poisonjav?.cltSubMissile1).toBe('poisonjavcloud')
      expect(CANONICAL_113C_MISSILES.plaguejavelin?.pCltDoFunc).toBe(3)
      expect(CANONICAL_113C_MISSILES.plaguejavelin?.cltSubMissile1).toBe('plaguejavcloud')

      // 1) plaguejavelin in flight
      const worldPlague = new ClientWorld()
      const pJav = (worldPlague as any).spawnMissileByKey('plaguejavelin', 100, 100, 130, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 25,
        skillLevel: 1,
      })
      ;(worldPlague as any).stepMissileUnit(pJav)
      const plagueTrails = getActiveMissiles(worldPlague).filter((m) => m.key !== pJav.key)
      expect(plagueTrails.length).toBeGreaterThan(0)
      for (const c of plagueTrails) {
        expect(c.missileKey).toBe('plaguejavcloud')
        expect(c.maxTicks).toBe(60)
      }

      // 2) poisonjav in flight
      const worldPoison = new ClientWorld()
      const poisJav = (worldPoison as any).spawnMissileByKey('poisonjav', 100, 100, 130, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 15,
        skillLevel: 1,
      })
      ;(worldPoison as any).stepMissileUnit(poisJav)
      const poisonTrails = getActiveMissiles(worldPoison).filter((m) => m.key !== poisJav.key)
      expect(poisonTrails.length).toBeGreaterThan(0)
      for (const c of poisonTrails) {
        expect(c.missileKey).toBe('poisonjavcloud')
        expect(c.maxTicks).toBe(60)
      }
    })
  })

  describe('#1122 (B11-6): CltDoFunc=8 lightninghit trail (Range=12) excluded from lightningjavelin & furylightning (pCltDoFunc=1)', () => {
    it('lightningjavelin and furylightning in flight spawn 0 lightninghit; lightningbolt spawns 3 lightninghit with maxTicks === 12', () => {
      expect(CANONICAL_113C_MISSILES.lightningjavelin?.pCltDoFunc).toBe(1)
      expect(CANONICAL_113C_MISSILES.lightningjavelin?.cltSubMissile1).toBeUndefined()
      expect(CANONICAL_113C_MISSILES.lightningfury?.pCltDoFunc).toBe(1)
      expect(CANONICAL_113C_MISSILES.lightningfury?.cltSubMissile1).toBeUndefined()
      expect(CANONICAL_113C_MISSILES.furylightning?.pCltDoFunc).toBe(1)
      expect(CANONICAL_113C_MISSILES.furylightning?.cltSubMissile1).toBeUndefined()
      expect(CANONICAL_113C_MISSILES.lightningbolt?.pCltDoFunc).toBe(8)
      expect(CANONICAL_113C_MISSILES.lightningbolt?.cltParam1).toBe(3)
      expect(CANONICAL_113C_MISSILES.lightningbolt?.cltSubMissile1).toBe('lightninghit')
      expect(CANONICAL_113C_MISSILES.lightningstrike?.pCltDoFunc).toBe(8)
      expect(CANONICAL_113C_MISSILES.lightningstrike?.cltParam1).toBe(3)
      expect(CANONICAL_113C_MISSILES.lightningstrike?.cltSubMissile1).toBe('lightninghit')
      expect(CANONICAL_113C_MISSILES.chainlightning?.pCltDoFunc).toBe(8)
      expect(CANONICAL_113C_MISSILES.chainlightning?.cltParam1).toBe(3)
      expect(CANONICAL_113C_MISSILES.chainlightning?.cltSubMissile1).toBe('lightninghit')

      // 1) lightningjavelin & furylightning in flight -> 0 lightninghit
      for (const key of ['lightningjavelin', 'furylightning'] as const) {
        const world = new ClientWorld()
        const m = (world as any).spawnMissileByKey(key, 100, 100, 130, 100, {
          ownerType: 'player',
          ownerId: 1,
          skillLevel: 1,
        })
        ;(world as any).stepMissileUnit(m)
        const hits = getActiveMissiles(world).filter((u) => u.missileKey === 'lightninghit')
        expect(hits).toHaveLength(0)
      }

      // 2) lightningbolt in flight -> 3 lightninghit with maxTicks === 12
      const worldLb = new ClientWorld()
      const lb = (worldLb as any).spawnMissileByKey('lightningbolt', 100, 100, 130, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 49,
        skillLevel: 1,
      })
      ;(worldLb as any).stepMissileUnit(lb)
      const lbHits = getActiveMissiles(worldLb).filter((u) => u.missileKey === 'lightninghit')
      expect(lbHits).toHaveLength(3)
      for (const h of lbHits) {
        expect(h.maxTicks).toBe(12)
      }
    })
  })
})

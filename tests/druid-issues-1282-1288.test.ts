import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { arcticBlastRangeFrames113c } from '../src/client/world/state-ids-113c.ts'
import { resolveStateOverlayTokens113c } from '../src/client/view/unit-drawables.ts'
import { castSkill } from '../src/server/skills/skills.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import {
  calculateCarrionVineStats,
  calculatePoisonCreeperStats,
  calculateSolarCreeperStats,
} from '../src/server/skills/druid-summoning.ts'

describe('Druid Skills Parity Fixes (#1282..#1288)', () => {
  describe('#1282: Hurricane (#250) subtile orbit radius (2.5..9.0 without * 0.5) & 5-tick vortex spawn', () => {
    it('orbits in uncollapsed circular subtile space across 2.5..9.0 subtiles and chills up to 9 subtiles', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Dru', x: 100, y: 100 })
      ;(world as any).areaId = 2
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 250, 100, 100, 5)

      const initialMissiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(initialMissiles.length).toBeGreaterThanOrEqual(9)
      const radii = initialMissiles.map((m) => Math.hypot(m.x - caster.x, m.y - caster.y))
      expect(Math.min(...radii)).toBeCloseTo(2.5, 2)
      expect(Math.max(...radii)).toBeCloseTo(9.0, 2)

      // Verify stepping orbit keeps exact circular subtile distance (not squashed by 0.5 on Y)
      ;(world as any).stepDiscreteSimulationTick(40)
      for (const m of initialMissiles) {
        const dist = Math.hypot(m.x - caster.x, m.y - caster.y)
        expect(dist).toBeCloseTo(m.spiralRadius!, 4)
      }

      // Monster at 8.5 subtiles (< 9) gets chilled on 5-tick pulse
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 501, classId: 0, x: 108.5, y: 100, lifePct: 128, mode: 1 },
      } as any)
      const mon = world.getUnit('monster', 501)!
      for (let t = 0; t < 5; t++) {
        ;(world as any).stepDiscreteSimulationTick(40)
      }
      expect(mon.states.has(11)).toBe(true)
    })

    it('sets hurricaneRadiusPx = 180 and does not push a linear projectile on castSkill(250)', () => {
      const engine = new GameEngine()
      ;(engine.world.player as any).charClass = 'druid'
      engine.world.player.mana = 500
      engine.world.player.maxMana = 500
      ;(engine.world.player as any).skillLevels = { 250: 5, 235: 3 }
      const status = { textContent: null as string | null }
      const runtime = { level: 'Blood Moor', levelId: 2, act: 1, grid: {} as any }
      const ok = castSkill(250, 200, 200, { engine, runtime, hudManager: null, status })
      expect(ok).toBe(true)
      expect((engine.world.player as any).hurricaneRadiusPx).toBe(180)
      expect(engine.projectiles.some((p) => p.missileType === 'hurricaneswoosh')).toBe(false)
    })
  })

  describe('#1283: Armageddon (#249) [-8, +8] subtile drop range & 3D diagonal sky-fall trajectory', () => {
    it('spawns armageddonrock + armageddontail with diagonal sky-fall trajectory landing at drop point after 25 ticks', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Dru', x: 100, y: 100 })
      ;(world as any).areaId = 2
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 249, 106, 104, 5)

      const missiles0 = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      const rock = missiles0.find((m) => m.missileKey === 'armageddonrock')!
      const tail = missiles0.find((m) => m.missileKey === 'armageddontail')!
      expect(rock).toBeDefined()
      expect(tail).toBeDefined()
      expect(rock.x).toBeCloseTo(106 - 6.5, 4)
      expect(rock.y).toBeCloseTo(104 - 6.5, 4)
      expect(rock.vx).toBeCloseTo(6.5 / 25, 4)
      expect(rock.vy).toBeCloseTo(6.5 / 25, 4)

      for (let t = 0; t < 25; t++) {
        ;(world as any).stepDiscreteSimulationTick(40)
      }

      const postImpact = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      const exp = postImpact.find((m) => m.missileKey === 'armageddonexplosion')!
      expect(exp).toBeDefined()
      expect(exp.x).toBeCloseTo(106, 3)
      expect(exp.y).toBeCloseTo(104, 3)
      expect(postImpact.some((m) => m.missileKey === 'moltenboulder-flyingrocks')).toBe(true)
      expect(postImpact.some((m) => m.missileKey === 'meteorfire')).toBe(true)
    })

    it('does not push a linear armageddonrock projectile on castSkill(249) and samples [-160, +160] without * 0.5 on Y', () => {
      const engine = new GameEngine()
      ;(engine.world.player as any).charClass = 'druid'
      engine.world.player.mana = 500
      engine.world.player.maxMana = 500
      ;(engine.world.player as any).skillLevels = { 249: 5, 234: 3 }
      const status = { textContent: null as string | null }
      const runtime = { level: 'Blood Moor', levelId: 2, act: 1, grid: {} as any }
      const ok = castSkill(249, 250, 200, { engine, runtime, hudManager: null, status })
      expect(ok).toBe(true)
      expect(engine.projectiles.length).toBe(0)
    })
  })

  describe('#1284: Volcano (#244) base (#479 volcano) SubLoop (subStart=17, subStop=18) holds steady at frame 17 without 25Hz jitter', () => {
    it('steps volcano through growth (0..16), steady hold at frame 17, and collapse (18..29) in final 12 ticks', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Dru', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 244, 108, 106, 5)

      const base = Array.from(world.units.values()).find(
        (u) => u.unitType === 'missile' && u.missileKey === 'volcano',
      )!
      const overlayFire = Array.from(world.units.values()).find(
        (u) => u.unitType === 'missile' && u.missileKey === 'volcano overlay fire',
      )!
      expect(base).toBeDefined()
      expect(overlayFire).toBeDefined()

      const baseFrames: number[] = []
      const fireFrames: number[] = []
      for (let t = 1; t <= 149; t++) {
        ;(world as any).stepDiscreteSimulationTick(40)
        baseFrames.push(base.frame ?? 0)
        fireFrames.push(overlayFire.frame ?? 0)
      }

      // Growth phase ticks 1..16 (indices 0..15): frames 1..16
      expect(baseFrames.slice(0, 16)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
      ])

      // Active eruption hold phase ticks 17..137 (indices 16..136): holds strictly on frame 17 with zero jitter to 18
      for (let i = 16; i <= 136; i++) {
        expect(baseFrames[i]).toBe(17)
      }

      // Overlay fire active loop phase ticks 6..133: loops strictly within [6, 14) = 6..13
      for (let i = 5; i <= 132; i++) {
        expect(fireFrames[i]).toBeGreaterThanOrEqual(6)
        expect(fireFrames[i]).toBeLessThan(14)
      }

      // Final 12 ticks (ticks 138..149, ticksRemaining = 12..1): collapse frames 18..29
      expect(baseFrames.slice(137, 149)).toEqual([
        18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
      ])
    })
  })

  describe('#1285: Cyclone Armor (#235 / State #151) returns cumulative back+front overlay pairs', () => {
    it('returns paired back+front overlays for stages 0, 1, 2 (default 2 at full shield)', () => {
      const makeUnit = (cur?: number, max?: number) =>
        ({
          kind: 'player' as const,
          id: 1,
          classId: 5,
          x: 100,
          y: 100,
          mode: 1,
          direction: 0,
          hpRatio: 1,
          isCorpse: false,
          states: [151],
          ...(cur !== undefined && max !== undefined
            ? { stats: new Map([[132, cur], [133, max]]) }
            : {}),
        }) as any

      expect(resolveStateOverlayTokens113c(makeUnit(), 151)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
        'cyclonearmor2back',
        'cyclonearmor2front',
        'cyclonearmor3back',
        'cyclonearmor3front',
      ])
      expect(resolveStateOverlayTokens113c(makeUnit(90, 90), 151)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
        'cyclonearmor2back',
        'cyclonearmor2front',
        'cyclonearmor3back',
        'cyclonearmor3front',
      ])
      expect(resolveStateOverlayTokens113c(makeUnit(50, 90), 151)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
        'cyclonearmor2back',
        'cyclonearmor2front',
      ])
      expect(resolveStateOverlayTokens113c(makeUnit(20, 90), 151)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
      ])
    })
  })

  describe('#1286: Arctic Blast (#230) Param2 = 6 range formula & animSpeed scaling by abRange', () => {
    it('computes floor((35 + (s - 1) * 6) / 2) and scales arcticblast1 animSpeed by (16 * 16) / abRange', () => {
      expect(arcticBlastRangeFrames113c(1)).toBe(17)
      expect(arcticBlastRangeFrames113c(10)).toBe(44)
      expect(arcticBlastRangeFrames113c(20)).toBe(74)

      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Dru', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 230, 110, 100, 10)

      const ab = Array.from(world.units.values()).find(
        (u) => u.unitType === 'missile' && u.missileKey === 'arcticblast1',
      )!
      expect(ab).toBeDefined()
      expect(ab.maxTicks).toBe(44)
      expect(ab.animSpeed).toBe(Math.max(1, Math.floor((16 * 16) / 44)))
    })
  })

  describe('#1287: Molten Boulder (#229) terminal explosion spawns volcano explosion, volcano small fire, meteorexplode, meteorfire & radial flyingrocks', () => {
    it('spawns visible lava explosion, lava pool, and flying rocks with non-zero radial velocities on boulder expiry', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Dru', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 229, 115, 100, 1)

      // 5 ticks for emerge + 100 ticks for boulder
      for (let t = 0; t < 105; t++) {
        ;(world as any).stepDiscreteSimulationTick(40)
      }

      const postImpact = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(postImpact.some((m) => m.missileKey === 'volcano explosion')).toBe(true)
      expect(postImpact.some((m) => m.missileKey === 'meteorexplode')).toBe(true)
      expect(postImpact.some((m) => m.missileKey === 'volcano small fire')).toBe(true)
      expect(postImpact.filter((m) => m.missileKey === 'meteorfire').length).toBeGreaterThanOrEqual(4)
      const rocks = postImpact.filter((m) => m.missileKey === 'moltenboulder-flyingrocks')
      expect(rocks).toHaveLength(10)
      for (const r of rocks) {
        expect(Math.hypot(r.vx ?? 0, r.vy ?? 0)).toBeGreaterThanOrEqual(0.18 - 1e-4)
      }
    })
  })

  describe('#1288: Druid Vine Summons (#222/#231/#241) classId 425..427 & SkillCltDoFunc[89] vine beast pods', () => {
    it('aligns Poison Creeper (425), Carrion Vine (426), and Solar Creeper (427 / vinecreature) stats and client VFX', () => {
      const poison = calculatePoisonCreeperStats(1)
      expect(poison.classId).toBe(425)
      expect(poison.monId).toBe('plaguepoppy')
      expect(poison.stateId).toBe(150)

      const carrion = calculateCarrionVineStats(1)
      expect(carrion.classId).toBe(426)
      expect(carrion.monId).toBe('cycleoflife')
      expect(carrion.stateId).toBe(150)

      const solar = calculateSolarCreeperStats(1)
      expect(solar.classId).toBe(427)
      expect(solar.monId).toBe('vinecreature')
      expect(solar.stateId).toBe(150)

      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Dru', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!

      for (const skillId of [222, 231, 241]) {
        ;(world as any).spawnMissilesForSkill(caster, skillId, 104, 104, 1)
      }

      const castMissiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(castMissiles.some((m) => m.missileKey === 'vine beast neutral')).toBe(true)
      expect(castMissiles.some((m) => m.missileKey === 'vine beast walk 1')).toBe(true)
      expect(castMissiles.some((m) => m.missileKey === 'vines trail')).toBe(true)

      // Assign active vine monster (classId 425) and verify SkillCltDoFunc[89] pod emission
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 500, classId: 425, name: 'PoisonCreeper', x: 110, y: 110 },
      })
      const vineUnit = world.getUnit('monster', 500)!
      vineUnit.mode = 2
      ;(world as any).stepDiscreteSimulationTick(40)
      expect(vineUnit.states.has(150)).toBe(true)
      const afterMoveMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.ownerId === 500,
      )
      expect(afterMoveMissiles.some((m) => m.missileKey === 'vine beast walk 1')).toBe(true)
      expect(afterMoveMissiles.some((m) => m.missileKey === 'vines trail')).toBe(true)
    })
  })
})

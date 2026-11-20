import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { isPlayerSummonClassId } from '../src/client/input/command-mapper.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { CANONICAL_113C_MISSILES, getMissileTxtData } from '../src/common/skills/missiles-data.ts'
import { SummonManager } from '../src/server/ai/summon-manager.ts'
import { AuraScanner } from '../src/server/engine/aura-scanner.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import {
  calcBladeSentinel113c,
  calcChargedBoltSentry113c,
  calcDeathSentry113c,
  calcLightningSentry113c,
  calcWakeOfFire113c,
  calcWakeOfInferno113c,
} from '../src/server/skills/assassin-traps.ts'
import { evaluateSkill113c, executeSkill113c } from '../src/server/skills/registry.ts'

describe('B15-p1 Assassin VFX 1.13c Parity (#1148-#1153)', () => {
  describe('#1148 (B15-1): Fire Blast (#251) bomb in air -> bomb on ground -> bomb explosion chain', () => {
    it('contains zero firetrauma/firetraumaexplode aliases and chains bomb in air (#385) -> bomb on ground (#386) -> bomb explosion (#387)', () => {
      // Zero fabricated aliases in CANONICAL_113C_MISSILES
      expect(CANONICAL_113C_MISSILES['firetrauma']).toBeUndefined()
      expect(CANONICAL_113C_MISSILES['firetraumaexplode']).toBeUndefined()

      // Verify 1.13c Missiles.txt rows #385, #386, #387
      const bombInAir = getMissileTxtData('bomb in air')
      const bombOnGround = getMissileTxtData('bomb on ground')
      const bombExplosion = getMissileTxtData('bomb explosion')
      expect(bombInAir.id).toBe(385)
      expect(bombInAir.range).toBe(50)
      expect(bombInAir.alwaysExplode).toBe(true)
      expect(bombInAir.celFile).toBe('expansion\\FireTraumaMissile')
      expect(bombOnGround.id).toBe(386)
      expect(bombOnGround.range).toBe(5)
      expect(bombOnGround.alwaysExplode).toBe(true)
      expect(bombOnGround.explosionMissile).toBe('bomb explosion')
      expect(bombOnGround.celFile).toBe('expansion\\FireTraumaGround')
      expect(bombExplosion.id).toBe(387)
      expect(bombExplosion.range).toBe(20)
      expect(bombExplosion.celFile).toBe('expansion\\FireTraumaXplosion')

      // Client cast of #251 Fire Blast spawns 'bomb in air'
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 6, name: 'Ass', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 251, 110, 100, 1)

      const initialMissiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(initialMissiles).toHaveLength(1)
      expect(initialMissiles[0]!.missileKey).toBe('bomb in air')
      expect(initialMissiles[0]!.alwaysExplode).toBe(true)

      // Step 50 frames until 'bomb in air' (Range=50) expires and triggers pCltHitFunc=44 -> 'bomb on ground'
      for (let t = 0; t < 50; t++) {
        world.tick(40)
      }
      const groundMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'bomb on ground',
      )
      expect(groundMissiles).toHaveLength(1)
      expect(groundMissiles[0]!.maxTicks).toBe(5)

      // Step 5 more frames until 'bomb on ground' (Range=5) expires into ExplosionMissile = 'bomb explosion'
      for (let t = 0; t < 5; t++) {
        world.tick(40)
      }
      const explosionMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'bomb explosion',
      )
      expect(explosionMissiles).toHaveLength(1)
      expect(explosionMissiles[0]!.maxTicks).toBe(20)
    })
  })

  describe('#1149 (B15-2): Shock Web (#256) CltDo005 scatter + shock field in air -> shock field on ground chain', () => {
    it('contains zero shockfieldair/shockfieldground aliases and spawns N scattered shock field in air (#388) that land as shock field on ground (#389)', () => {
      expect(CANONICAL_113C_MISSILES['shockfieldair']).toBeUndefined()
      expect(CANONICAL_113C_MISSILES['shockfieldground']).toBeUndefined()

      const sfa = getMissileTxtData('shock field in air')
      const sfg = getMissileTxtData('shock field on ground')
      expect(sfa.id).toBe(388)
      expect(sfa.range).toBe(50)
      expect(sfa.alwaysExplode).toBe(true)
      expect(sfa.celFile).toBe('expansion\\caltrops')
      expect(sfg.id).toBe(389)
      expect(sfg.range).toBe(90)
      expect(sfg.loopAnim).toBe(1)
      expect(sfg.celFile).toBe('Expansion\\ShockField')

      // slvl = 4, Fire Blast (#251) blvl = 3 -> N = 6 + floor(4/4) + floor(3/3) = 8 spikes
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 6, name: 'Ass', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!
      caster.stats.set(251, 3)

      ;(world as any).spawnMissilesForSkill(caster, 256, 120, 100, 4)
      const airMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'shock field in air',
      )
      expect(airMissiles).toHaveLength(8)
      expect(airMissiles.every((m) => m.alwaysExplode === true)).toBe(true)

      // Step 50 frames until 'shock field in air' (Range=50) expires and triggers pCltHitFunc=44 -> 'shock field on ground'
      for (let t = 0; t < 50; t++) {
        world.tick(40)
      }
      const groundSpikes = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'shock field on ground',
      )
      expect(groundSpikes).toHaveLength(8)
      expect(groundSpikes.every((m) => m.maxTicks === 90 && m.vx === 0 && m.vy === 0)).toBe(true)
    })
  })

  describe('#1150 (B15-3): Blade Sentinel (#257) spawns 0 client missiles and SrvDo044 spawns blade creeper (#392) + bladecreeper (hcIdx=413)', () => {
    it('spawns 0 client missiles for #257 and spawns both missile blade creeper (#392) and monster bladecreeper (413) on server', async () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 6, name: 'Ass', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 257, 115, 100, 5)

      const clientMissiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(clientMissiles).toHaveLength(0)

      const bsCalc = calcBladeSentinel113c(5, 40, 80, false)
      expect(bsCalc.missileName).toBe('blade creeper')
      expect(bsCalc.missileId).toBe(392)
      expect(bsCalc.hcIdx).toBe(413)

      const registry = await getSharedDataRegistry()
      const summonManager = new SummonManager(registry)
      const missileEngine = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)
      const statList = new UnitStatList(registry, {
        level: 40,
        maxhp: 800 * FIXED_ONE,
        hitpoints: 800 * FIXED_ONE,
        maxmana: 400 * FIXED_ONE,
        mana: 400 * FIXED_ONE,
      })
      const stateBus = new StateBus(statList, registry)
      const serverCaster = {
        id: 'ass-257',
        name: 'Ass',
        unitType: 'player' as const,
        statList,
        stateBus,
        x: 50,
        y: 50,
      }
      const skill257 = registry.getSkillById(257)!
      const evalRes = evaluateSkill113c({
        registry,
        skill: skill257,
        slvl: 5,
        blvl: 5,
        statList,
        stateBus,
      })
      const execRes = executeSkill113c({
        registry,
        skill: skill257,
        evalResult: evalRes,
        caster: serverCaster,
        targetX: 60,
        targetY: 50,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine,
        summonManager,
        auraScanner,
        currentTick: 100,
      })
      expect(execRes.missilesSpawned).toContain('blade creeper')
      expect(execRes.petsSummoned).toContain('bladecreeper')
      const pet = summonManager.getActivePets().find((p) => p.sourceSkillId === 257)
      expect(pet?.monId).toBe('bladecreeper')
      expect(pet?.classId).toBe(413)
    })
  })

  describe('#1151 (B15-4) & #1152 (B15-5): Trap sentry classIds (411, 410, 412, 415, 416) and 0 cast-time missiles', () => {
    it('maps trap skills to exact 1.13c MonStats.txt hcIdx and spawns 0 missiles on player trap placement', () => {
      expect(CANONICAL_113C_MISSILES['wakeofdestruction']).toBeUndefined()
      expect(calcChargedBoltSentry113c(1).hcIdx).toBe(411)
      expect(calcWakeOfFire113c(1).hcIdx).toBe(410)
      expect(calcLightningSentry113c(1).hcIdx).toBe(412)
      expect(calcWakeOfInferno113c(1).hcIdx).toBe(415)
      expect(calcDeathSentry113c(1).hcIdx).toBe(416)
      expect(isPlayerSummonClassId(410)).toBe(true)
      expect(isPlayerSummonClassId(411)).toBe(true)
      expect(isPlayerSummonClassId(412)).toBe(true)
      expect(isPlayerSummonClassId(415)).toBe(true)
      expect(isPlayerSummonClassId(416)).toBe(true)

      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 6, name: 'Ass', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!

      const expectedClassIds: Array<[number, number]> = [
        [261, 411], // chargeboltsentry
        [262, 410], // wakeofdestruction
        [271, 412], // lightningsentry
        [272, 415], // infernosentry
        [276, 416], // deathsentry
      ]

      for (let i = 0; i < expectedClassIds.length; i++) {
        const [skillId, expectedClassId] = expectedClassIds[i]!
        ;(world as any).spawnMissilesForSkill(caster, skillId, 110 + i * 2, 100, 5)
        const trap = Array.from(world.monsters.values()).find((m) => m.classId === expectedClassId)
        expect(trap).toBeDefined()
      }

      // Zero missiles spawned when placing traps
      const placementMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile',
      )
      expect(placementMissiles).toHaveLength(0)

      // When Wake of Fire sentry (classId 410) fires sub-skill #281, it spawns 'wake of destruction maker' (#517),
      // which emits 'wake of destruction' (#518) when stepped
      const wofTrap = Array.from(world.monsters.values()).find((m) => m.classId === 410)!
      ;(world as any).spawnMissilesForSkill(wofTrap, 281, 120, 100, 5)
      const makerMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'wake of destruction maker',
      )
      expect(makerMissiles).toHaveLength(1)

      world.tick(40)
      const wakeMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'wake of destruction',
      )
      expect(wakeMissiles.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('#1153 (B15-6): Martial Arts Charge-Up increments only on confirmed hit, not on miss', () => {
    it('leaves chargeCounts unchanged on a missed melee swing and increments by 1 on a hit', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 6, name: 'Ass', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!

      // Spawn a hostile monster at (102, 100)
      const monster = (world as any).ensureUnit('monster', 500)
      monster.classId = 1 // Skeleton
      monster.x = 102
      monster.y = 100
      monster.mode = 1
      monster.dead = false
      monster.lifePct = 128
      ;(world as any)._monsters.set(500, monster)

      // 1. Missed swing at empty ground (115, 115) where no monster exists -> chargeCounts stays 0
      ;(world as any).applySkillCastToUnit(caster, 254, 115, 115, 1)
      expect((caster as any).chargeCounts?.get(254) ?? 0).toBe(0)
      expect(caster.states.has(122)).toBe(false)

      // 2. Explicit miss flag on swing at monster -> chargeCounts stays 0
      ;(caster as any).lastAttackHit = false
      ;(world as any).applySkillCastToUnit(caster, 254, 102, 100, 1)
      expect((caster as any).chargeCounts?.get(254) ?? 0).toBe(0)
      expect(caster.states.has(122)).toBe(false)
      delete (caster as any).lastAttackHit

      // 3. Successful melee hit on monster at (102, 100) -> chargeCounts increments to 1, 2, 3
      ;(world as any).applySkillCastToUnit(caster, 254, 102, 100, 1)
      expect((caster as any).chargeCounts?.get(254)).toBe(1)
      expect(caster.states.has(122)).toBe(true)
      expect(caster.overlays.some((o) => o.token === 'progressive_damage_1')).toBe(true)
      expect(caster.overlays.some((o) => o.token === 'tigerstrike1')).toBe(true)

      ;(world as any).applySkillCastToUnit(caster, 254, 102, 100, 1)
      expect((caster as any).chargeCounts?.get(254)).toBe(2)
      expect(caster.overlays.some((o) => o.token === 'progressive_damage_2')).toBe(true)
      expect(caster.overlays.some((o) => o.token === 'tigerstrike2')).toBe(true)

      // Another miss in between leaves charge at 2
      ;(world as any).applySkillCastToUnit(caster, 254, 130, 130, 1)
      expect((caster as any).chargeCounts?.get(254)).toBe(2)

      // Third hit reaches max charge 3
      ;(world as any).applySkillCastToUnit(caster, 254, 102, 100, 1)
      expect((caster as any).chargeCounts?.get(254)).toBe(3)
      expect(caster.overlays.some((o) => o.token === 'progressive_damage_3')).toBe(true)
      expect(caster.overlays.some((o) => o.token === 'tigerstrike3')).toBe(true)
    })
  })
})

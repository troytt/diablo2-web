/**
 * Diablo II v1.13c Spell VFX Parity — Work Unit B16-p6 (Monster Skills #1192–#1197)
 *
 * Ground Truth References:
 * - 1.13c MPQ `Skills.txt`, `Missiles.txt`, `Overlay.txt`, `States.txt`
 * - `D2Client.dll` `SkillCltDoFunc[18]` (`0x6FAC5C40`, `#211 MonBoneSpirit`) & `MissileCltDoFunc[7]` (`0x6FB62EB0`)
 * - `D2Client.dll` `SkillCltDoFunc[57]` (`0x6FB08070`, `#196 FingerMageSpider`), `MissileCltDoFunc[15]` (`0x6FB68BC0`) & `MissileCltHitFunc[10]` (`0x6FB62570`)
 * - `D2Client.dll` `SkillCltDoFunc[58]` (`0x6FB07F60`, `#197 DiabWall`), `SKILLS_CltInitDiabWallMaker` (`0x6FB06D00`) & `MissileCltDoFunc[16]` (`0x6FB68AA0`)
 * - `D2Client.dll` `SkillCltDoFunc[51]` (`0x6FB085C0`, `#172 GargoyleTrap`)
 * - `D2Client.dll` `SkillCltDoFunc[81]` (`0x6FB74C10`, `#318 Baal Cold Missiles`) & `MissileCltDoFunc[52]` (`0x6FB672D0`)
 * - `D2Client.dll` `SkillCltPrgFunc[92]` (`0x6FB795F0`, `#349 Diablogeddon`) & `MissileCltHitFunc[55]` (`0x6FB65930`)
 */

import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { LINEAR_SKILL_MISSILES } from '../src/client/world/world-skill-state-tables.ts'
import { getMissileTxtData } from '../src/common/skills/missiles-data.ts'

function createMonsterCaster(world: ClientWorld, classId = 310, id = 990, x = 100, y = 100): ClientUnit {
  const m = new ClientUnit({
    unitType: 'monster',
    id,
    classId,
    x,
    y,
    mode: 1,
    direction: 0,
  })
  ;(world as any)._units.set(m.key, m)
  ;(world as any)._monsters.set(m.id, m)
  return m
}

function getActiveMissiles(world: ClientWorld): ClientUnit[] {
  const out: ClientUnit[] = []
  for (const u of (world as any)._units.values() as Iterable<ClientUnit>) {
    if (u.unitType === 'missile') out.push(u)
  }
  return out
}

describe('B16-p6 Monster Skill VFX Parity (#1192–#1197)', () => {
  describe('#1192 (B16-31): #211 MonBoneSpirit (CltDo18 / MissileCltDo07)', () => {
    it('registers #211 -> monbonespirit (#329) in LINEAR_SKILL_MISSILES and locks homingTarget only when caster has targetUnit', () => {
      expect(LINEAR_SKILL_MISSILES[211]).toEqual({ key: 'monbonespirit' })

      const world = new ClientWorld()
      const player = new ClientUnit({
        unitType: 'player',
        id: 1,
        classId: 0,
        x: 112,
        y: 108,
        mode: 1,
        direction: 0,
      })
      ;(world as any)._units.set(player.key, player)

      const caster = createMonsterCaster(world, 312, 991, 100, 100)
      caster.targetUnit = { unitType: 'player', id: player.id }

      ;(world as any).spawnMissilesForSkill(caster, 211, 112, 100, 3)

      const missiles = getActiveMissiles(world)
      expect(missiles).toHaveLength(1)
      const spirit = missiles[0]!
      expect(spirit.missileKey).toBe('monbonespirit')
      expect(spirit.sourceSkillId).toBe(211)
      expect(spirit.maxTicks).toBe(128)
      expect(spirit.alwaysExplode).toBe(true)
      expect(spirit.explosionMissile).toBe('bonespiritexplode')
      expect(spirit.homingTarget).toEqual({ unitType: 'player', id: player.id })

      // Ground cast without targetUnit should not set homingTarget (CltDo18 mode 2)
      const groundWorld = new ClientWorld()
      const groundCaster = createMonsterCaster(groundWorld, 312, 992, 100, 100)
      ;(groundWorld as any).spawnMissilesForSkill(groundCaster, 211, 115, 100, 1)
      const groundSpirit = getActiveMissiles(groundWorld)[0]!
      expect(groundSpirit.missileKey).toBe('monbonespirit')
      expect(groundSpirit.homingTarget).toBeUndefined()
    })
  })

  describe('#1193 (B16-32): #196 FingerMageSpider (CltDo57 / MissileCltDo15 / MissileCltHit10)', () => {
    it('spawns fingermagespider (#177, Range=80, Vel=6) which leaves trailing stationary fingermagespider every 3 frames and repaths every 5 frames', () => {
      const world = new ClientWorld()
      const player = new ClientUnit({
        unitType: 'player',
        id: 1,
        classId: 0,
        x: 110,
        y: 106,
        mode: 1,
        direction: 0,
      })
      ;(world as any)._units.set(player.key, player)

      const mage = createMonsterCaster(world, 312, 993, 100, 100)
      mage.targetUnit = { unitType: 'player', id: player.id }

      ;(world as any).spawnMissilesForSkill(mage, 196, 112, 100, 4)

      const initial = getActiveMissiles(world)
      expect(initial).toHaveLength(1)
      const head = initial[0]!
      expect(head.missileKey).toBe('fingermagespider')
      expect(head.sourceSkillId).toBe(196)
      expect(head.maxTicks).toBe(80)
      expect((head as any).spiderTrailActive).toBe(true)
      expect(head.homingTarget).toEqual({ unitType: 'player', id: player.id })
      expect(Math.abs(head.vy ?? 0)).toBeLessThan(1e-5)

      // Step 3 frames: at ageTicks=3, CltDo15 spawns stationary trailing fingermagespider with maxTicks=20
      for (let t = 0; t < 3; t++) {
        ;(world as any).stepDiscreteSimulationTick()
      }
      const after3 = getActiveMissiles(world).filter((m) => m.missileKey === 'fingermagespider')
      const trails = after3.filter((m) => (m as any).spiderTrailActive === false)
      expect(trails.length).toBeGreaterThanOrEqual(1)
      expect(trails[0]!.vx).toBe(0)
      expect(trails[0]!.vy).toBe(0)
      expect(trails[0]!.maxTicks).toBe(20)

      // Step 3 more frames (through prevAgeTicks=5): CltDo15 repaths head toward player at (110, 106) so vy > 0
      for (let t = 0; t < 3; t++) {
        ;(world as any).stepDiscreteSimulationTick()
      }
      expect(head.vy).toBeGreaterThan(0)

      // Unit impact (pCltHitFunc=10) attaches ProgOverlay='fingermagespiderexplode' to hit unit
      ;(world as any).triggerMissileImpact(head, player.x, player.y, false, player)
      expect(player.overlays.some((o) => o.token === 'fingermagespiderexplode')).toBe(true)
    })
  })

  describe('#1194 (B16-33): #197 DiabWall (CltDo58 / SKILLS_CltInitDiabWallMaker / MissileCltDo16)', () => {
    it('spawns calc1=lvl instances of diabwallmaker (#179, maxTicks=77, PATHTYPE_CHARGEDBOLT) which emit stationary diabwall (#180, Range=36)', () => {
      const world = new ClientWorld()
      const diablo = createMonsterCaster(world, 243, 994, 100, 100)

      ;(world as any).spawnMissilesForSkill(diablo, 197, 116, 100, 3)

      const makers = getActiveMissiles(world).filter((m) => m.missileKey === 'diabwallmaker')
      expect(makers).toHaveLength(3)
      for (const mk of makers) {
        expect(mk.sourceSkillId).toBe(197)
        expect(mk.maxTicks).toBe(77) // Clamped from Range=80 to 0x4D (77) by 0x6FB06D00
        expect(mk.pathWaypoints?.length).toBeGreaterThan(0)
      }

      ;(world as any).stepDiscreteSimulationTick()
      const walls = getActiveMissiles(world).filter((m) => m.missileKey === 'diabwall')
      expect(walls.length).toBeGreaterThanOrEqual(3)
      for (const w of walls) {
        expect(w.sourceSkillId).toBe(197)
        expect(w.maxTicks).toBe(36)
        expect(w.vx).toBe(0)
        expect(w.vy).toBe(0)
      }
    })
  })

  describe('#1195 (B16-34): #172 GargoyleTrap (CltDo51)', () => {
    it('spawns shafire3 (#24, Range=40, Vel=12, Pierce=1, ExplosionMissile=shamanexp)', () => {
      const world = new ClientWorld()
      const trap = createMonsterCaster(world, 204, 995, 100, 100)

      ;(world as any).spawnMissilesForSkill(trap, 172, 114, 100, 2)

      const missiles = getActiveMissiles(world)
      expect(missiles).toHaveLength(1)
      const sf = missiles[0]!
      expect(sf.missileKey).toBe('shafire3')
      expect(sf.sourceSkillId).toBe(172)
      expect(sf.maxTicks).toBe(40)
      expect(sf.pierce).toBe(true)
      expect(sf.explosionMissile).toBe('shamanexp')
    })
  })

  describe('#1196 (B16-35): #318 Baal Cold Missiles (CltDo81 / MissileCltDo52)', () => {
    it('spawns baal cold maker (#589, Range=50, Vel=20) which emits opposing perpendicular baal cold trail (#590, Range=20, Vel=13) V-wings', () => {
      const world = new ClientWorld()
      const baal = createMonsterCaster(world, 544, 996, 100, 100)

      ;(world as any).spawnMissilesForSkill(baal, 318, 120, 100, 5)

      const initial = getActiveMissiles(world)
      expect(initial).toHaveLength(1)
      const maker = initial[0]!
      expect(maker.missileKey).toBe('baal cold maker')
      expect(maker.sourceSkillId).toBe(318)
      expect(maker.maxTicks).toBe(50)

      ;(world as any).stepDiscreteSimulationTick()
      const wings = getActiveMissiles(world).filter((m) => m.missileKey === 'baal cold trail')
      expect(wings).toHaveLength(2)
      expect(wings[0]!.maxTicks).toBe(20)
      expect(wings[0]!.vy! * wings[1]!.vy!).toBeLessThan(0)
      expect(Math.abs(wings[0]!.vx!)).toBeLessThan(1e-5)
      expect(Math.abs(wings[1]!.vx!)).toBeLessThan(1e-5)
    })
  })

  describe('#1197 (B16-36): #349 Diablogeddon (CltPrgFunc1=92 / MissileCltHit55)', () => {
    it('activates state 145 (armageddon) with duration 1000+(slvl-1)*50, spawns diablogeddonrock (#671) + diablogeddontail (#672), and detonates into diablogeddonexplosion (#673) + diablogeddonfire (#674)', () => {
      const world = new ClientWorld()
      ;(world as any).areaId = 108 // Chaos Sanctuary (non-town)
      const uberDiablo = createMonsterCaster(world, 333, 997, 100, 100)

      ;(world as any).spawnMissilesForSkill(uberDiablo, 349, 103, 102, 4)

      expect(uberDiablo.states.has(145)).toBe(true)
      expect(uberDiablo.armageddonUntilTick).toBe((world as any).frameCount + 1000 + (4 - 1) * 50)

      const initial = getActiveMissiles(world)
      const rock = initial.find((m) => m.missileKey === 'diablogeddonrock')!
      const tail = initial.find((m) => m.missileKey === 'diablogeddontail')!
      expect(rock).toBeDefined()
      expect(tail).toBeDefined()
      expect(rock.sourceSkillId).toBe(349)
      expect(rock.maxTicks).toBe(25)
      expect(rock.altitude).toBe(625)
      expect(rock.verticalDescentPerTick).toBe(25)
      expect(rock.alwaysExplode).toBe(true)
      expect(tail.sourceSkillId).toBe(349)
      expect(tail.maxTicks).toBe(25)
      expect(tail.altitude).toBe(625)
      expect(tail.verticalDescentPerTick).toBe(25)

      // Step 26 ticks so the initial diablogeddonrock expires (Range=25) and triggers pCltHitFunc=55,
      // while periodic monster state 145 ticks also drop additional rocks every 8 frames.
      let sawExp = false
      let sawFire = false
      for (let t = 0; t < 26; t++) {
        ;(world as any).stepDiscreteSimulationTick()
        const active = getActiveMissiles(world)
        if (active.some((m) => m.missileKey === 'diablogeddonexplosion')) sawExp = true
        if (active.some((m) => m.missileKey === 'diablogeddonfire')) sawFire = true
      }
      expect(sawExp).toBe(true)
      expect(sawFire).toBe(true)
    })

    it('all B16-p6 missile keys have MISSILE_METAS entries matching 1.13c Missiles.txt CelFile', () => {
      const keys = [
        'monbonespirit',
        'bonespiritexplode',
        'fingermagespider',
        'diabwallmaker',
        'diabwall',
        'shafire3',
        'shamanexp',
        'baal cold maker',
        'baal cold trail',
        'diablogeddonrock',
        'diablogeddontail',
        'diablogeddonexplosion',
        'diablogeddonfire',
      ]
      for (const k of keys) {
        const txt = getMissileTxtData(k)
        const meta = MISSILE_METAS[k]
        expect(meta, `MISSILE_METAS["${k}"]`).toBeDefined()
        expect(meta!.celFile.toLowerCase().replace(/\\/g, '/')).toBe(
          txt.celFile.toLowerCase().replace(/\\/g, '/'),
        )
      }
    })
  })
})

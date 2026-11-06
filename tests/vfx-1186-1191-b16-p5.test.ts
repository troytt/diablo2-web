/**
 * Diablo II v1.13c Spell VFX Parity — Work Unit B16-p5 (Monster Skills #1186–#1191)
 *
 * Ground Truth References:
 * - 1.13c MPQ `Skills.txt`, `Missiles.txt`, `Overlay.txt`
 * - `D2Client.dll` `SkillCltDoFunc[71]` (`0x6FB757D0`, `#282 Imp Inferno`)
 * - `D2Client.dll` `SkillCltDoFunc[72]` (`0x6FB75D20`, `#283 Imp Fireball`)
 * - `D2Client.dll` `SkillCltDoFunc[70]` (`0x6FB75A80`, `#281 Wake Of Destruction Sentry`) & `MissileCltDoFunc[52]` (`0x6FB672D0`)
 * - `D2Client.dll` `SkillCltDoFunc[32]` (`0x6FB78FB0` -> `0x6FB78CE0`, `#351 NihlathakCorpseExplosion`)
 * - `D2Client.dll` `SkillCltStFunc[48]` (`0x6FB74550`) & `SkillCltDoFunc[73]` (`0x6FB744D0`, `#292 Teleport 2`, `#329 Baal Teleport`, `#331 Baal Clone Teleport`)
 * - `D2Client.dll` `SkillCltStFunc[48]` (`0x6FB74550`) & `SkillCltDoFunc[74]` (`0x6FB75050`, `#330 Imp Teleport`)
 */

import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { getMissileTxtData, getSkillCastOverlay } from '../src/common/skills/missiles-data.ts'

function createMonsterCaster(world: ClientWorld, classId = 453, id = 960, x = 100, y = 100): ClientUnit {
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

describe('B16-p5 Monster Skill VFX Parity (#1186–#1191)', () => {
  describe('#1186 (B16-25): #282 Imp Inferno (CltDo71)', () => {
    it('spawns dual-layer impinfernoflame1 (#398) and impinfernoflame2 (#399) with zOffset=8 and rangeFrames=15+slvl', () => {
      const world = new ClientWorld()
      const imp = createMonsterCaster(world, 453, 961, 100, 100)

      ;(world as any).spawnMissilesForSkill(imp, 282, 112, 100, 5)

      const missiles = getActiveMissiles(world)
      expect(missiles.map((m) => m.missileKey).sort()).toEqual(['impinfernoflame1', 'impinfernoflame2'])
      const expectedRange = 16 + 5 - 1 // Param2=16 + (slvl-1) = 20
      const expectedAnimSpeed = Math.max(1, Math.floor((15 * 16) / expectedRange)) // floor(240/20) = 12
      for (const m of missiles) {
        expect(m.sourceSkillId).toBe(282)
        expect(m.maxTicks).toBe(expectedRange)
        expect(m.animSpeed).toBe(expectedAnimSpeed)
        expect(m.pierce).toBe(true)
        expect(m.altitude).toBe(8)
        expect(m.verticalDescentPerTick).toBeCloseTo(16 / expectedRange, 5)
        expect(MISSILE_METAS[m.missileKey!]).toBeDefined()
      }
    })
  })

  describe('#1187 (B16-26): #283 Imp Fireball (CltDo72)', () => {
    it('spawns impfireball (#404) with altitude=40, castoverlay=fire_cast_2, and explodes into impfireballexplode (#405)', () => {
      const world = new ClientWorld()
      const imp = createMonsterCaster(world, 453, 962, 100, 100)

      expect(getSkillCastOverlay(283)).toBe('fire_cast_2')
      ;(world as any).spawnMissilesForSkill(imp, 283, 110, 100, 3)

      const missiles = getActiveMissiles(world)
      expect(missiles).toHaveLength(1)
      const fb = missiles[0]!
      expect(fb.missileKey).toBe('impfireball')
      expect(fb.sourceSkillId).toBe(283)
      expect(fb.altitude).toBe(40)
      expect(fb.verticalDescentPerTick).toBeGreaterThan(0)
      expect(fb.alwaysExplode).toBe(true)
      expect(fb.explosionMissile).toBe('impfireballexplode')

      // Advance simulation ticks until impfireball expires and spawns impfireballexplode
      let sawExplode = false
      for (let t = 0; t < 60; t++) {
        ;(world as any).stepDiscreteSimulationTick()
        if (getActiveMissiles(world).some((m) => m.missileKey === 'impfireballexplode')) {
          sawExplode = true
          break
        }
      }
      expect(sawExplode).toBe(true)
    })
  })

  describe('#1188 (B16-27): #281 Wake Of Destruction Sentry (CltDo70 / MissileCltDo52)', () => {
    it('spawns wake of destruction maker (#517, Range=25+2*(slvl-1)) which emits opposing perpendicular wake of destruction (#518) V-wings', () => {
      const world = new ClientWorld()
      const sentry = createMonsterCaster(world, 410, 963, 100, 100)

      ;(world as any).spawnMissilesForSkill(sentry, 281, 120, 100, 4)

      const initialMissiles = getActiveMissiles(world)
      expect(initialMissiles).toHaveLength(1)
      const maker = initialMissiles[0]!
      expect(maker.missileKey).toBe('wake of destruction maker')
      expect(maker.sourceSkillId).toBe(281)
      expect(maker.maxTicks).toBe(25 + 2 * (4 - 1)) // 31

      // Step 1 tick: MissileCltDo52 emits 2 opposing perpendicular 'wake of destruction' wings
      ;(world as any).stepDiscreteSimulationTick()
      const wings = getActiveMissiles(world).filter((m) => m.missileKey === 'wake of destruction')
      expect(wings).toHaveLength(2)
      // Maker moves along +X (vy = 0), so perpendicular wings must move along +Y and -Y
      expect(wings[0]!.vy! * wings[1]!.vy!).toBeLessThan(0)
      expect(Math.abs(wings[0]!.vx!)).toBeLessThan(1e-5)
      expect(Math.abs(wings[1]!.vx!)).toBeLessThan(1e-5)
    })
  })

  describe('#1189 (B16-28): #351 NihlathakCorpseExplosion (CltDo32)', () => {
    it('consumes corpse (STATE_CORPSE_NODRAW=104) and spawns corpseexplosion (#115), explodingarrowexp (#42), and redlightmissile (#151)', () => {
      const world = new ClientWorld()
      const nihlathak = createMonsterCaster(world, 526, 964, 100, 100)
      const corpse = createMonsterCaster(world, 1, 965, 105, 102)
      corpse.dead = true
      corpse.mode = 12
      corpse.lifePct = 0

      ;(world as any).spawnMissilesForSkill(nihlathak, 351, 105, 102, 5)

      expect(corpse.states.has(104)).toBe(true)
      const missiles = getActiveMissiles(world)
      const keys = missiles.map((m) => m.missileKey)
      expect(keys).toContain('corpseexplosion')
      expect(keys).toContain('explodingarrowexp')
      expect(keys).toContain('redlightmissile')
      for (const m of missiles) {
        expect(m.sourceSkillId).toBe(351)
      }
    })
  })

  describe('#1190 (B16-29): CltDo73 Teleport family (#292 Teleport 2, #329 Baal Teleport, #331 Baal Clone Teleport)', () => {
    it('spawns 0 missiles for #292, baalteleport at destination for #329, and baalclonedeath at origin + baalteleport at destination for #331', () => {
      // #292 Teleport 2: no client missiles
      const world292 = new ClientWorld()
      const wolf = createMonsterCaster(world292, 420, 970, 100, 100)
      ;(world292 as any).spawnMissilesForSkill(wolf, 292, 115, 108, 1)
      expect(getActiveMissiles(world292)).toHaveLength(0)

      // #329 Baal Teleport: baalteleport (#613) at destination only
      const world329 = new ClientWorld()
      const baal = createMonsterCaster(world329, 544, 971, 100, 100)
      ;(world329 as any).spawnMissilesForSkill(baal, 329, 115, 108, 1)
      const m329 = getActiveMissiles(world329)
      expect(m329).toHaveLength(1)
      expect(m329[0]!.missileKey).toBe('baalteleport')
      expect(m329[0]!.x).toBe(115)
      expect(m329[0]!.y).toBe(108)
      expect(m329[0]!.sourceSkillId).toBe(329)

      // #331 Baal Clone Teleport: baalclonedeath (#614) at origin + baalteleport (#613) at destination
      const world331 = new ClientWorld()
      const clone = createMonsterCaster(world331, 574, 972, 100, 100)
      ;(world331 as any).spawnMissilesForSkill(clone, 331, 115, 108, 1)
      const m331 = getActiveMissiles(world331)
      expect(m331).toHaveLength(2)
      const originM = m331.find((m) => m.missileKey === 'baalclonedeath')!
      const destM = m331.find((m) => m.missileKey === 'baalteleport')!
      expect(originM).toBeDefined()
      expect(originM.x).toBe(100)
      expect(originM.y).toBe(100)
      expect(originM.sourceSkillId).toBe(331)
      expect(destM).toBeDefined()
      expect(destM.x).toBe(115)
      expect(destM.y).toBe(108)
      expect(destM.sourceSkillId).toBe(331)
    })
  })

  describe('#1191 (B16-30): #330 Imp Teleport (CltDo74)', () => {
    it('spawns imp teleport (#451) at both origin (startX, startY) and destination (targetX, targetY)', () => {
      const world = new ClientWorld()
      const imp = createMonsterCaster(world, 453, 980, 100, 100)

      ;(world as any).spawnMissilesForSkill(imp, 330, 114, 106, 2)

      const missiles = getActiveMissiles(world)
      expect(missiles).toHaveLength(2)
      expect(missiles.every((m) => m.missileKey === 'imp teleport' && m.sourceSkillId === 330)).toBe(true)
      const coords = missiles.map((m) => [m.x, m.y])
      expect(coords).toContainEqual([100, 100])
      expect(coords).toContainEqual([114, 106])
    })

    it('all B16-p5 missile keys have matching MISSILE_METAS entries matching Missiles.txt CelFile', () => {
      const keys = [
        'impinfernoflame1',
        'impinfernoflame2',
        'impfireball',
        'impfireballexplode',
        'wake of destruction maker',
        'wake of destruction',
        'corpseexplosion',
        'explodingarrowexp',
        'baalteleport',
        'baalclonedeath',
        'imp teleport',
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

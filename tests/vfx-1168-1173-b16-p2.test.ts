/**
 * Diablo II v1.13c Spell VFX Parity — Work Unit B16-p2 (Monster Skills #1168–#1173)
 *
 * Ground Truth References:
 * - 1.13c MPQ `Skills.txt` & `Missiles.txt`
 * - `D2Client.dll` `SkillCltStFunc[17]` (`0x6FB23C10`), `SkillCltDoFunc[26]` (`0x6FB24770`),
 *   `SkillCltDoFunc[28]` (`0x6FB24010`), `SkillCltStFunc[44]` (`0x6FB07540`),
 *   `SkillCltDoFunc[54]` (`0x6FB08C90` -> `0x6FB08370` -> `0x6FB06E10`)
 * - `D2Client.dll` `MissCltDoFunc[6]` (`0x6FB6BA20`), `MissCltDoFunc[9]` (`0x6FB68F00`),
 *   `MissCltDoFunc[10]` (`0x6FB6BD40`), `MissCltHitFunc[18]` (`0x6FB66540`),
 *   `MissCltHitFunc[19]` (`0x6FB66510`), `MissCltHitFunc[36]` (`0x6FB6ABF0` -> `0x6FB69740`)
 */

import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { getMissileTxtData } from '../src/common/skills/missiles-data.ts'

function createMonsterCaster(world: ClientWorld, classId = 345, id = 500, x = 100, y = 100): ClientUnit {
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

describe('B16-p2 Monster Skill VFX Parity (#1168–#1173)', () => {
  describe('#1168 (B16-7): #62 Hydra does not synthesize ghost hydra units in _monsters or _pets', () => {
    it('councilmember casting #62 Hydra attaches fire_cast_2 and spawns 0 ghost monsters or player _pets', () => {
      const world = new ClientWorld()
      const council = createMonsterCaster(world, 345, 701, 100, 100)

      ;(world as any).applySkillCastToUnit(council, 62, 108, 104, 5, true, 1000)

      expect(council.overlays.some((o) => o.token === 'fire_cast_2')).toBe(true)
      const ghostHydras = Array.from(((world as any)._monsters as Map<number, ClientUnit>).values()).filter(
        (m) => m.id >= 920000 || (m.classId >= 351 && m.classId <= 353),
      )
      expect(ghostHydras).toHaveLength(0)
      expect(((world as any)._pets as Map<number, unknown>).size).toBe(0)
    })

    it('direct spawnMissilesForSkill(#62) is a no-op on client (server-authoritative summon)', () => {
      const world = new ClientWorld()
      const caster = createMonsterCaster(world, 345, 702, 100, 100)

      ;(world as any).spawnMissilesForSkill(caster, 62, 110, 110, 7)

      expect(getActiveMissiles(world)).toHaveLength(0)
      expect(((world as any)._pets as Map<number, unknown>).size).toBe(0)
    })
  })

  describe('#1169 (B16-8): CltDoFunc 26 Fire Wall family (#170 VampireFirewall, #188 PrimeFirewall, #321 CountessFirewall)', () => {
    it('#170 VampireFirewall & #188 PrimeFirewall spawn vampirefirewallmaker (Range=10) -> vampirefirewall (Range=90) + firesmall + firemedium', () => {
      for (const skillId of [170, 188] as const) {
        const world = new ClientWorld()
        const caster = createMonsterCaster(world, 131, 710 + skillId, 100, 100)

        ;(world as any).spawnMissilesForSkill(caster, skillId, 110, 100, 5)

        const initial = getActiveMissiles(world)
        const makers = initial.filter((m) => m.missileKey === 'vampirefirewallmaker')
        const centers = initial.filter((m) => m.missileKey === 'vampirefirewall')
        expect(makers).toHaveLength(2)
        expect(centers).toHaveLength(1)
        expect(centers[0]!.maxTicks).toBe(90)
        for (const mk of makers) {
          expect(mk.maxTicks).toBe(10)
          expect(mk.pierce).toBe(true)
        }

        ;(world as any).stepDiscreteSimulationTick()
        const afterTick1 = getActiveMissiles(world)
        expect(afterTick1.filter((m) => m.missileKey === 'vampirefirewall').length).toBeGreaterThanOrEqual(3)
        expect(afterTick1.filter((m) => m.missileKey === 'firesmall').length).toBeGreaterThanOrEqual(2)
        expect(afterTick1.filter((m) => m.missileKey === 'firemedium').length).toBeGreaterThanOrEqual(2)
      }
    })

    it('#321 CountessFirewall spawns countessfirewallmaker (Range=7) -> countessfirewall (Range=1000+slvl-1) + firesmall + firemedium', () => {
      const world = new ClientWorld()
      const countess = createMonsterCaster(world, 45, 720, 100, 100)

      ;(world as any).spawnMissilesForSkill(countess, 321, 108, 100, 4)

      const initial = getActiveMissiles(world)
      const makers = initial.filter((m) => m.missileKey === 'countessfirewallmaker')
      const centers = initial.filter((m) => m.missileKey === 'countessfirewall')
      expect(makers).toHaveLength(2)
      expect(centers).toHaveLength(1)
      expect(centers[0]!.maxTicks).toBe(1003)
      for (const mk of makers) {
        expect(mk.maxTicks).toBe(7)
      }

      ;(world as any).stepDiscreteSimulationTick()
      const afterTick1 = getActiveMissiles(world)
      expect(afterTick1.filter((m) => m.missileKey === 'countessfirewall').length).toBeGreaterThanOrEqual(3)
      expect(afterTick1.filter((m) => m.missileKey === 'firesmall').length).toBeGreaterThanOrEqual(2)
      expect(afterTick1.filter((m) => m.missileKey === 'firemedium').length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('#1170 (B16-9): #171 VampireMeteor 3D skyfall and CltHit18 impact chain', () => {
    it('spawns vampiremeteorcenter + vampiremeteor + meteortail and explodes into meteorexplode (never vampiremeteorexp)', () => {
      const world = new ClientWorld()
      const vampire = createMonsterCaster(world, 131, 730, 100, 100)

      ;(world as any).spawnMissilesForSkill(vampire, 171, 112, 108, 4)

      const initial = getActiveMissiles(world)
      const center = initial.find((m) => m.missileKey === 'vampiremeteorcenter')
      const core = initial.find((m) => m.missileKey === 'vampiremeteor')
      const tail = initial.find((m) => m.missileKey === 'meteortail')
      expect(center).toBeDefined()
      expect(core).toBeDefined()
      expect(tail).toBeDefined()
      expect(center!.maxTicks).toBe(60)
      expect(core!.altitude).toBe(25 * 59)

      for (let t = 0; t < 60; t++) {
        ;(world as any).stepDiscreteSimulationTick()
      }

      const postImpact = getActiveMissiles(world)
      expect(postImpact.filter((m) => m.missileKey === 'vampiremeteorexp')).toHaveLength(0)
      expect(postImpact.filter((m) => m.missileKey === 'meteorexplode')).toHaveLength(5)
      const light = postImpact.find((m) => m.missileKey === 'whitelightmissile')
      expect(light).toBeDefined()
      expect(light!.missileLightRadius).toBe(12)
      expect(light!.maxTicks).toBe(10 + 4 * 10)
      expect(postImpact.filter((m) => m.missileKey === 'firemedium')).toHaveLength(3)
      expect(postImpact.filter((m) => m.missileKey === 'firesmall')).toHaveLength(15)
    })
  })

  describe('#1171 (B16-10): #205 MonBlizzard -> monblizcenter -> monbliz1/monbliz4 -> monblizexplode1/3', () => {
    it('spawns monblizcenter (Range = 25 + 15*(slvl-1)), emits monbliz1/monbliz4 shards, and bursts into monblizexplode1/3', () => {
      const world = new ClientWorld()
      const hierophant = createMonsterCaster(world, 258, 740, 100, 100)

      ;(world as any).spawnMissilesForSkill(hierophant, 205, 110, 110, 3)

      const initial = getActiveMissiles(world)
      const center = initial.find((m) => m.missileKey === 'monblizcenter')
      expect(center).toBeDefined()
      expect(center!.maxTicks).toBe(25 + 15 * (3 - 1)) // 55

      const seenShards = new Set<string>()
      const seenExplodes = new Set<string>()
      for (let t = 0; t < 20; t++) {
        for (const m of getActiveMissiles(world)) {
          if (m.missileKey?.startsWith('monbliz') && m.missileKey !== 'monblizcenter') {
            if (m.missileKey.startsWith('monblizexplode')) {
              seenExplodes.add(m.missileKey)
            } else {
              seenShards.add(m.missileKey)
            }
          }
          expect(m.missileKey).not.toBe('blizzard1')
          expect(m.missileKey).not.toBe('icebreaksmall')
        }
        ;(world as any).stepDiscreteSimulationTick()
      }

      expect(seenShards.size).toBeGreaterThan(0)
      for (const s of seenShards) {
        expect(['monbliz1', 'monbliz4']).toContain(s)
      }
      expect(seenExplodes.size).toBeGreaterThan(0)
      for (const e of seenExplodes) {
        expect(['monblizexplode1', 'monblizexplode3']).toContain(e)
      }
    })
  })

  describe('#1172 (B16-11): #213 HellMeteor (cltstfunc=44 @ 0x6FB07540 & pCltHitFunc=36 @ 0x6FB6ABF0)', () => {
    it('spawns hellmeteordown + hellmeteorball at target and hellmeteorup + hellmeteorball + hellmeteorlaunch1/2 at caster, then scatters ground fire on landing', () => {
      const world = new ClientWorld()
      const caster = createMonsterCaster(world, 362, 750, 100, 100)

      ;(world as any).applySkillCastToUnit(caster, 213, 114, 108, 3, true, 1000)

      const initial = getActiveMissiles(world)
      const down = initial.find((m) => m.missileKey === 'hellmeteordown')
      const up = initial.find((m) => m.missileKey === 'hellmeteorup')
      const launch1 = initial.find((m) => m.missileKey === 'hellmeteorlaunch1')
      const launch2 = initial.find((m) => m.missileKey === 'hellmeteorlaunch2')
      const balls = initial.filter((m) => m.missileKey === 'hellmeteorball')

      expect(down).toBeDefined()
      expect(down!.x).toBe(114)
      expect(down!.y).toBe(108)
      expect(down!.maxTicks).toBe(225)
      expect(down!.altitude).toBeCloseTo(175.78125, 4)

      expect(up).toBeDefined()
      expect(up!.x).toBe(100)
      expect(up!.y).toBe(100)
      expect(up!.maxTicks).toBe(50)
      expect(up!.altitude).toBe(0)

      expect(launch1).toBeDefined()
      expect(launch1!.maxTicks).toBe(22)
      expect(launch1!.animSpeed).toBe(8)
      expect(launch2).toBeDefined()
      expect(launch2!.maxTicks).toBe(22)
      expect(launch2!.animSpeed).toBe(8)
      expect(balls).toHaveLength(2)

      ;(world as any).stepDiscreteSimulationTick()
      expect(down!.altitude).toBeCloseTo(175.78125 - 0.78125, 4)
      expect(up!.altitude).toBeCloseTo(0.46875, 4)

      for (let t = 1; t < 225; t++) {
        ;(world as any).stepDiscreteSimulationTick()
      }

      const postLanding = getActiveMissiles(world)
      const groundFire = postLanding.filter(
        (m) =>
          m.missileKey === 'firewall' ||
          m.missileKey === 'firesmall' ||
          m.missileKey === 'firemedium',
      )
      expect(groundFire.length).toBeGreaterThan(10)
    })
  })

  describe('#1173 (B16-12): CltDoFunc 54 Inferno stream family (#178, #317, #319, #323)', () => {
    it('#178 FetishInferno & #319 MegademonInferno spawn 2 fetishinferno1/fetishinferno2 puffs per tick with Range = 7 + slvl - 1', () => {
      for (const skillId of [178, 319] as const) {
        const world = new ClientWorld()
        const caster = createMonsterCaster(world, 199, 760 + skillId, 100, 100)

        ;(world as any).applySkillCastToUnit(caster, skillId, 112, 100, 4, true, 1000)

        const initial = getActiveMissiles(world)
        expect(initial).toHaveLength(2)
        for (const m of initial) {
          expect(['fetishinferno1', 'fetishinferno2']).toContain(m.missileKey)
          expect(m.maxTicks).toBe(7 + 4 - 1) // 10
          expect(m.animSpeed).toBe(Math.floor((15 * 16) / 10)) // 24
          expect(m.pierce).toBe(true)
        }

        ;(world as any).stepDiscreteSimulationTick()
        const afterTick1 = getActiveMissiles(world)
        expect(afterTick1).toHaveLength(4)
      }
    })

    it('#317 Baal Inferno spawns 2 "baal inferno" puffs per tick with Range = 12 + slvl - 1', () => {
      const world = new ClientWorld()
      const baal = createMonsterCaster(world, 544, 780, 100, 100)

      ;(world as any).applySkillCastToUnit(baal, 317, 112, 100, 5, true, 1000)

      const initial = getActiveMissiles(world)
      expect(initial).toHaveLength(2)
      for (const m of initial) {
        expect(m.missileKey).toBe('baal inferno')
        expect(m.maxTicks).toBe(12 + 5 - 1) // 16
        expect(m.animSpeed).toBe(Math.floor((14 * 16) / 16)) // 14
      }
    })

    it('#323 Horror Arctic Blast spawns 2 "frozenhorror arcticblast1" puffs per tick with Range = 7 + slvl - 1', () => {
      const world = new ClientWorld()
      const horror = createMonsterCaster(world, 453, 790, 100, 100)

      ;(world as any).applySkillCastToUnit(horror, 323, 112, 100, 3, true, 1000)

      const initial = getActiveMissiles(world)
      expect(initial).toHaveLength(2)
      for (const m of initial) {
        expect(m.missileKey).toBe('frozenhorror arcticblast1')
        expect(m.maxTicks).toBe(7 + 3 - 1) // 9
        expect(m.animSpeed).toBe(Math.floor((16 * 16) / 9)) // 28
      }
    })

    it('all new B16-p2 missile keys with non-null CelFile have matching MISSILE_METAS entries', () => {
      const keys = [
        'firewallmaker',
        'vampirefirewallmaker',
        'vampirefirewall',
        'countessfirewallmaker',
        'countessfirewall',
        'vampiremeteor',
        'vampiremeteorcenter',
        'vampiremeteorfire',
        'monbliz1',
        'monbliz2',
        'monbliz3',
        'monbliz4',
        'monblizexplode1',
        'monblizexplode2',
        'monblizexplode3',
        'hellmeteorlaunch1',
        'hellmeteorlaunch2',
        'hellmeteorup',
        'hellmeteordown',
        'hellmeteorball',
        'fetishinferno1',
        'fetishinferno2',
        'baal inferno',
        'megademoninferno',
        'frozenhorror arcticblast1',
        'frozenhorror arcticblast2',
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

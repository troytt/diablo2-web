/**
 * Diablo II v1.13c Spell VFX Parity — Work Unit B16-p4 (Monster Skills #1180–#1185)
 *
 * Ground Truth References:
 * - 1.13c MPQ `Skills.txt`, `Missiles.txt`, `Overlay.txt`
 * - `D2Client.dll` `SkillCltDoFunc[63]` (`0x6FB08A70`, `#214 RegurgitatorEat`)
 * - `D2Game.dll` `SkillSrvDoFunc[94]` (`0x6FC29AF0`, `#179 ZakarumHeal`), `Skills.txt` `tgtoverlay=receiving`
 * - `D2Client.dll` `SkillCltDoFunc[94]` (`0x6FB08990`, `#335 DoomKnightMissile`)
 * - `D2Client.dll` `SkillCltDoFunc[76]` (`0x6FB74CE0`) & `D2Game.dll` `SkillSrvDoFunc[136]` (`0x6FC2C400`, `#308 DeathMaul`)
 * - `D2Client.dll` `SkillCltStFunc[52]` (`0x6FB74370`) & `SkillCltDoFunc[77]` (`0x6FB75BA0`, `#311 mon inferno sentry`)
 * - `D2Client.dll` `SkillCltStFunc[50]` (`0x6FB74A20`) & `SkillCltDoFunc[78]` (`0x6FB74B00`, `#312 mon death sentry`)
 */

import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { SKILL_TGT_OVERLAYS_113C } from '../src/client/world/world-skill-state-tables.ts'
import { getMissileTxtData, getOverlayTxtData } from '../src/common/skills/missiles-data.ts'

function createMonsterCaster(world: ClientWorld, classId = 310, id = 900, x = 100, y = 100): ClientUnit {
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

describe('B16-p4 Monster Skill VFX Parity (#1180–#1185)', () => {
  describe('#1180 (B16-19): #214 RegurgitatorEat (CltDo63)', () => {
    it('consumes corpse (STATE_CORPSE_NODRAW=104) and spawns 1..2 corpseexplosion (#115) + 5..8 bigblood1 (#20)', () => {
      const world = new ClientWorld()
      const regurgitator = createMonsterCaster(world, 304, 901, 100, 100)
      const corpse = createMonsterCaster(world, 1, 902, 103, 101)
      corpse.dead = true
      corpse.mode = 12
      corpse.lifePct = 0

      ;(world as any).spawnMissilesForSkill(regurgitator, 214, 103, 101, 1)

      expect(corpse.states.has(104)).toBe(true)
      const missiles = getActiveMissiles(world)
      const ce = missiles.filter((m) => m.missileKey === 'corpseexplosion')
      const blood = missiles.filter((m) => m.missileKey === 'bigblood1')
      expect(ce.length).toBeGreaterThanOrEqual(1)
      expect(ce.length).toBeLessThanOrEqual(2)
      expect(blood.length).toBeGreaterThanOrEqual(5)
      expect(blood.length).toBeLessThanOrEqual(8)
      for (const c of ce) {
        expect(c.x).toBe(103)
        expect(c.y).toBe(101)
        expect(c.sourceSkillId).toBe(214)
      }
      for (const b of blood) {
        expect(b.x).toBe(103)
        expect(b.y).toBe(101)
        expect(b.sourceSkillId).toBe(214)
      }
    })
  })

  describe('#1181 (B16-20): #179 ZakarumHeal tgtoverlay=receiving', () => {
    it('attaches castoverlay=healing on caster and tgtoverlay=receiving on target unit with 0 missiles', () => {
      const world = new ClientWorld()
      const priest = createMonsterCaster(world, 252, 910, 100, 100)
      const zealot = createMonsterCaster(world, 247, 911, 104, 100)

      expect(SKILL_TGT_OVERLAYS_113C[179]).toBe('receiving')
      expect(getOverlayTxtData('receiving').id).toBe(27)

      ;(world as any).applySkillCastToUnit(priest, 179, 104, 100, 2, true, 1000)

      expect(priest.overlays.some((o) => o.token === 'healing')).toBe(true)
      expect(zealot.overlays.some((o) => o.token === 'receiving')).toBe(true)
      expect(getActiveMissiles(world)).toHaveLength(0)
    })

    it('also attaches tgtoverlay=receiving when spawnMissilesForSkill(179) is called directly', () => {
      const world = new ClientWorld()
      const priest = createMonsterCaster(world, 252, 912, 100, 100)
      const zealot = createMonsterCaster(world, 247, 913, 102, 102)

      ;(world as any).spawnMissilesForSkill(priest, 179, 102, 102, 1)

      expect(zealot.overlays.some((o) => o.token === 'receiving')).toBe(true)
    })
  })

  describe('#1182 (B16-21): #335 DoomKnightMissile (CltDo94)', () => {
    it('spawns undeadmissile1..4 for compVariants[10] = 0..3 and throws RangeError when missing or out of range', () => {
      for (const element of [0, 1, 2, 3] as const) {
        const world = new ClientWorld()
        const knight = createMonsterCaster(world, 312, 920 + element, 100, 100)
        knight.compVariants = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, element]

        ;(world as any).spawnMissilesForSkill(knight, 335, 110, 100, 3)

        const missiles = getActiveMissiles(world)
        expect(missiles).toHaveLength(1)
        expect(missiles[0]!.missileKey).toBe(`undeadmissile${element + 1}`)
        expect(missiles[0]!.sourceSkillId).toBe(335)
      }

      const worldMissing = new ClientWorld()
      const knightNoS3 = createMonsterCaster(worldMissing, 312, 929, 100, 100)
      expect(() => {
        ;(worldMissing as any).spawnMissilesForSkill(knightNoS3, 335, 110, 100, 1)
      }).toThrow(RangeError)
    })
  })

  describe('#1183 (B16-22): #308 DeathMaul (CltDo76 / SrvDo136)', () => {
    it('spawns death mauler (#502) and death mauler trail (#503) chain with distance-scaled frames and trail fade (#504) on expiry', () => {
      const worldNear = new ClientWorld()
      const maulerNear = createMonsterCaster(worldNear, 444, 930, 100, 100)
      ;(worldNear as any).spawnMissilesForSkill(maulerNear, 308, 108, 100, 2)

      const nearMissiles = getActiveMissiles(worldNear)
      const nearHead = nearMissiles.find((m) => m.missileKey === 'death mauler')
      const nearTrails = nearMissiles.filter((m) => m.missileKey === 'death mauler trail')
      expect(nearHead).toBeDefined()
      expect(nearTrails.length).toBeGreaterThanOrEqual(1)

      const worldFar = new ClientWorld()
      const maulerFar = createMonsterCaster(worldFar, 444, 931, 100, 100)
      ;(worldFar as any).spawnMissilesForSkill(maulerFar, 308, 124, 100, 2)

      const farMissiles = getActiveMissiles(worldFar)
      const farHead = farMissiles.find((m) => m.missileKey === 'death mauler')
      const farTrails = farMissiles.filter((m) => m.missileKey === 'death mauler trail')
      expect(farHead).toBeDefined()
      expect(farTrails.length).toBeGreaterThan(nearTrails.length)
      expect(farHead!.maxTicks!).toBeGreaterThan(nearHead!.maxTicks!)

      // Advance simulation ticks until a trail segment expires and spawns 'death mauler trail fade' (#504)
      let sawTrailFade = false
      for (let t = 0; t < 80; t++) {
        ;(worldNear as any).stepDiscreteSimulationTick()
        if (getActiveMissiles(worldNear).some((m) => m.missileKey === 'death mauler trail fade')) {
          sawTrailFade = true
          break
        }
      }
      expect(sawTrailFade).toBe(true)
    })
  })

  describe('#1184 (B16-23): #311 mon inferno sentry (CltSt52 / CltDo77)', () => {
    it('spawns only inferno sentry 1 (#523) and inferno sentry 2 (#524) with Range=20+wofBlvl and valid MISSILE_METAS', () => {
      const world = new ClientWorld()
      const sentry = createMonsterCaster(world, 415, 940, 100, 100)
      sentry.stats.set(262, 5) // Wake of Fire blvl = 5

      ;(world as any).spawnMissilesForSkill(sentry, 311, 112, 100, 4)

      const missiles = getActiveMissiles(world)
      expect(missiles.map((m) => m.missileKey).sort()).toEqual(['inferno sentry 1', 'inferno sentry 2'])
      for (const m of missiles) {
        expect(m.maxTicks).toBe(25) // 20 + 5
        expect(m.pierce).toBe(true)
        expect(m.sourceSkillId).toBe(311)
        expect(MISSILE_METAS[m.missileKey!]).toBeDefined()
      }
    })
  })

  describe('#1185 (B16-24): #312 mon death sentry (CltSt50 / CltDo78)', () => {
    it('attaches death_sentry overlay to caster, consumes corpse, and spawns corpseexplosion (#115) + deathsentryexplode (#519)', () => {
      const world = new ClientWorld()
      const sentry = createMonsterCaster(world, 416, 950, 100, 100)
      const corpse = createMonsterCaster(world, 5, 951, 106, 104)
      corpse.dead = true
      corpse.mode = 12
      corpse.lifePct = 0

      ;(world as any).spawnMissilesForSkill(sentry, 312, 106, 104, 3)

      expect(sentry.overlays.some((o) => o.token === 'death_sentry')).toBe(true)
      expect(corpse.states.has(104)).toBe(true)
      const missiles = getActiveMissiles(world)
      expect(missiles.map((m) => m.missileKey).sort()).toEqual(['corpseexplosion', 'deathsentryexplode'])
      for (const m of missiles) {
        expect(m.x).toBe(106)
        expect(m.y).toBe(104)
        expect(m.sourceSkillId).toBe(312)
      }
    })

    it('all B16-p4 missile keys have matching MISSILE_METAS entries matching Missiles.txt CelFile', () => {
      const keys = [
        'corpseexplosion',
        'bigblood1',
        'undeadmissile1',
        'undeadmissile2',
        'undeadmissile3',
        'undeadmissile4',
        'death mauler',
        'death mauler trail',
        'death mauler trail fade',
        'inferno sentry 1',
        'inferno sentry 2',
        'deathsentryexplode',
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

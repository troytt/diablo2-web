/**
 * Diablo II v1.13c Spell VFX Parity — Work Unit B16-p3 (Monster Skills #1174–#1179)
 *
 * Ground Truth References:
 * - 1.13c MPQ `Skills.txt`, `Missiles.txt`, `Overlay.txt`
 * - `D2Client.dll` `SkillCltStFunc[40]` (`0x6FB06930`), `SkillCltDoFunc[56]` (`0x6FB08B80` -> `0x6FB08370` -> `0x6FB06E10`),
 *   `MissCltHitFunc[10]` (`0x6FB62570`)
 * - `D2Client.dll` `SkillCltStFunc[34]` (`0x6FB07120`), `SkillCltDoFunc[48]` (`0x6FB073A0`)
 * - `D2Client.dll` `SkillCltDoFunc[55]` (`0x6FB081F0` -> `0x6FB66BC0`), `MissCltDoFunc[4]` (`0x6FB6BE00` -> `0x6FB69470`)
 * - `D2Client.dll` `SkillCltDoFunc[60]` (`0x6FB07D50`)
 * - `D2Client.dll` `SkillCltDoFunc[61]` (`0x6FB07BB0`)
 * - `D2Client.dll` `SkillCltDoFunc[53]` (`0x6FB084D0`)
 */

import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { getMissileTxtData } from '../src/common/skills/missiles-data.ts'

function createMonsterCaster(world: ClientWorld, classId = 243, id = 800, x = 100, y = 100): ClientUnit {
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

describe('B16-p3 Monster Skill VFX Parity (#1174–#1179)', () => {
  describe('#1174 (B16-13): #193 DiabLight (CltSt40 / CltDo56 / MissCltHitFunc 10)', () => {
    it('channels 40 frames of diablight (#172, Pierce=1, Range=30+slvl-1) and attaches diablolightning on hit', () => {
      const world = new ClientWorld()
      const diablo = createMonsterCaster(world, 243, 801, 100, 100)
      const player = new ClientUnit({
        unitType: 'player',
        id: 1,
        classId: 1,
        x: 105,
        y: 100,
        mode: 1,
        direction: 0,
      })
      ;(world as any)._units.set(player.key, player)
      ;(world as any).selfId = 1

      ;(world as any).applySkillCastToUnit(diablo, 193, 112, 100, 3, true, 1000)

      expect(diablo.castState?.frames).toBeGreaterThanOrEqual(40)
      const initial = getActiveMissiles(world)
      expect(initial).toHaveLength(1)
      const m0 = initial[0]!
      expect(m0.missileKey).toBe('diablight')
      expect(m0.pierce).toBe(true)
      expect(m0.maxTicks).toBe(30 + 3 - 1) // 32
      expect(m0.animSpeed).toBe(Math.floor((15 * 16) / 32)) // 7

      // Step several ticks so diablight continues emitting and pierces through player
      for (let t = 0; t < 10; t++) {
        ;(world as any).stepDiscreteSimulationTick()
      }

      const active = getActiveMissiles(world).filter((m) => m.missileKey === 'diablight')
      expect(active.length).toBeGreaterThanOrEqual(10)
      expect(player.overlays.some((o) => o.token === 'diablolightning')).toBe(true)
    })
  })

  describe('#1175 (B16-14): #164 AndrialSpray (CltSt34 / CltDo48)', () => {
    it('spawns a 9-bolt directional fan sweep of andarielspray (#32, Pierce=true, Range=40)', () => {
      const world = new ClientWorld()
      const andariel = createMonsterCaster(world, 156, 810, 100, 100)

      ;(world as any).applySkillCastToUnit(andariel, 164, 114, 100, 4, true, 1000)

      const bolts = getActiveMissiles(world).filter((m) => m.missileKey === 'andarielspray')
      expect(bolts).toHaveLength(9)
      const angles = new Set<string>()
      for (const b of bolts) {
        expect(b.pierce).toBe(true)
        expect(b.maxTicks).toBe(40)
        angles.add(Math.atan2(b.vy ?? 0, b.vx ?? 0).toFixed(3))
      }
      expect(angles.size).toBe(9)
    })
  })

  describe('#1176 (B16-15): #192 PrimePoisonNova (CltDo55 / MissCltDoFunc 4)', () => {
    it('spawns 16 primepoisoncloud (#220) in 2 concentric speed rings (Param1=2 slow & Param2=4 fast) with non-zero vx/vy and emits poisonpuff', () => {
      const world = new ClientWorld()
      const mephisto = createMonsterCaster(world, 242, 820, 100, 100)

      ;(world as any).spawnMissilesForSkill(mephisto, 192, 108, 100, 5)

      const clouds = getActiveMissiles(world).filter((m) => m.missileKey === 'primepoisoncloud')
      expect(clouds).toHaveLength(16)

      const speeds = new Set<string>()
      for (const c of clouds) {
        expect(c.pierce).toBe(true)
        expect(c.maxTicks).toBe(60)
        expect((c as any).subLoops).toBe(4) // lvl - 1 = 4
        const spd = Math.hypot(c.vx ?? 0, c.vy ?? 0)
        expect(spd).toBeGreaterThan(0)
        speeds.add(spd.toFixed(5))
      }
      // 8 slow ring clouds (Param1=2) and 8 fast ring clouds (Param2=4)
      expect(speeds.size).toBe(2)

      // Advance simulation ticks so primepoisoncloud runs MISSMODE_CltDo04 and emits poisonpuff (#141)
      let sawPoisonPuff = false
      for (let t = 0; t < 60; t++) {
        ;(world as any).stepDiscreteSimulationTick()
        if (getActiveMissiles(world).some((m) => m.missileKey === 'poisonpuff')) {
          sawPoisonPuff = true
          break
        }
      }
      expect(sawPoisonPuff).toBe(true)
    })
  })

  describe('#1177 (B16-16): #203 DesertTurret (CltDo60)', () => {
    it('spawns calc1=3 parallel lateral desertfireball (#283, Vel=16, Range=40) that explode into explodingarrowexp', () => {
      const world = new ClientWorld()
      const turret = createMonsterCaster(world, 326, 830, 100, 100)

      ;(world as any).spawnMissilesForSkill(turret, 203, 112, 100, 3)

      const balls = getActiveMissiles(world).filter((m) => m.missileKey === 'desertfireball')
      expect(balls).toHaveLength(3)
      const targetsY = new Set<number>()
      for (const b of balls) {
        expect(b.maxTicks).toBe(40)
        expect(b.alwaysExplode).toBe(true)
        expect(b.x).toBe(104) // 100 + trunc(12 / 3)
        targetsY.add(b.targetY ?? b.y)
      }
      expect(targetsY.size).toBe(3)

      // Step to range expiry (40 ticks) and verify ExplosionMissile = 'explodingarrowexp'
      for (let t = 0; t < 40; t++) {
        ;(world as any).stepDiscreteSimulationTick()
      }
      const exps = getActiveMissiles(world).filter((m) => m.missileKey === 'explodingarrowexp')
      expect(exps).toHaveLength(3)
    })
  })

  describe('#1178 (B16-17): #204 ArcaneTower (CltDo61)', () => {
    it('spawns 64 radial lightningtowernova (#643, Vel=24, Range=13, Accel=-1000) from the 64-entry radius-30 ring table', () => {
      const world = new ClientWorld()
      const tower = createMonsterCaster(world, 297, 840, 100, 100)

      ;(world as any).spawnMissilesForSkill(tower, 204, 108, 100, 2)

      const novas = getActiveMissiles(world).filter((m) => m.missileKey === 'lightningtowernova')
      expect(novas).toHaveLength(64)
      for (const n of novas) {
        expect(n.maxTicks).toBe(13)
        expect(n.altitude).toBeCloseTo(3.75, 4)
        expect(Math.hypot(n.vx ?? 0, n.vy ?? 0)).toBeGreaterThan(0)
      }
    })
  })

  describe('#1179 (B16-18): #177 FetishAura (CltDo53)', () => {
    it('spawns cltcalc1=3 curseeffectred (#142, Range=20) around target and does NOT locally add states', () => {
      const world = new ClientWorld()
      const shaman = createMonsterCaster(world, 72, 850, 100, 100)
      const ally = createMonsterCaster(world, 58, 851, 104, 102)

      ;(world as any).spawnMissilesForSkill(shaman, 177, 104, 102, 3)

      const reds = getActiveMissiles(world).filter((m) => m.missileKey === 'curseeffectred')
      expect(reds).toHaveLength(3)
      for (const r of reds) {
        expect(r.maxTicks).toBe(20)
        expect(r.vx).toBe(0)
        expect(r.vy).toBe(0)
      }
      expect(Array.from(shaman.states)).toHaveLength(0)
      expect(Array.from(ally.states)).toHaveLength(0)
    })

    it('all B16-p3 missile keys have matching MISSILE_METAS entries matching Missiles.txt CelFile', () => {
      const keys = [
        'diablight',
        'andarielspray',
        'primepoisoncloud',
        'poisonpuff',
        'desertfireball',
        'explodingarrowexp',
        'lightningtowernova',
        'curseeffectred',
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

import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { getMissileTxtData } from '../src/common/skills/missiles-data.ts'
import { castSkill } from '../src/server/skills/skills.ts'

describe('VFX-B15-p3 (#1160, #1161): Assassin Blade Fury (#266) & Blade Shield (#277) 1.13c parity', () => {
  describe('#1160 (B15-13): Blade Fury (#266) client bladefragment2 & server bladefragment1', () => {
    it('client spawns visible bladefragment2 (Expansion\\bladefury_B, Vel=22, Range=33) with vel > 0 and no bladefury1', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 6, name: 'Ass', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!

      ;(world as any).spawnMissilesForSkill(caster, 266, 120, 100, 5)

      const missiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(missiles).toHaveLength(1)

      const bf2 = missiles[0]!
      expect(bf2.missileKey).toBe('bladefragment2')
      expect(bf2.classId).toBe(508)
      expect(bf2.maxTicks).toBe(33)
      expect(bf2.loopAnim).toBe(true)
      expect(bf2.explosionMissile).toBe('')
      expect(Math.hypot(bf2.vx ?? 0, bf2.vy ?? 0)).toBeGreaterThan(0)

      const txt = getMissileTxtData('bladefragment2')
      expect(txt.celFile).toBe('Expansion\\bladefury_B')
      expect(txt.vel).toBe(22)
      expect(txt.range).toBe(33)

      const invisibleBladeFury1 = missiles.filter((m) => m.missileKey === 'bladefury1')
      expect(invisibleBladeFury1).toHaveLength(0)
    })

    it('server castSkill(266) spawns bladefragment1 (srvmissilea #506, Vel=22, Range=40)', () => {
      const projectiles: any[] = []
      const engine = {
        world: {
          player: {
            x: 200,
            y: 200,
            hp: 200,
            maxHp: 200,
            mana: 200,
            maxMana: 200,
            stamina: 100,
            maxStamina: 100,
            level: 30,
            cooldown: 0,
            charClass: 'ass',
            skills: { 266: 5 },
            summons: [],
          },
          monsters: [],
          corpses: [],
          missiles: [],
          groundFires: [],
        },
        projectiles,
        metrics: { casts: 0, projectilesFired: 0 },
        spawnOverlay: () => {},
        spawnProjectile: (p: any) => projectiles.push(p),
      } as any
      const runtime = { level: 'Blood Moor', levelId: 2, act: 1, grid: {} as any }
      const status = { textContent: null as string | null }

      expect(castSkill(266, 240, 200, { engine, runtime, hudManager: null, status })).toBe(true)
      expect(projectiles).toHaveLength(1)
      expect(projectiles[0].missileType).toBe('bladefragment1')
      expect(Math.hypot(projectiles[0].vx, projectiles[0].vy)).toBe(22)
      expect(projectiles[0].ttl).toBe(40)
    })
  })

  describe('#1161 (B15-14): Blade Shield (#277) blade shield attachment -> blade shield missile', () => {
    it('spawns blade shield attachment (#553) while state 158 is active and emits blade shield missile (#552) when a monster is in range', () => {
      const world = new ClientWorld()
      ;(world as any).areaId = 2 // Blood Moor (outside town)
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 6, name: 'Ass', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!

      // Cast #277 Blade Shield at slvl 5
      ;(world as any).spawnMissilesForSkill(caster, 277, 100, 100, 5)
      expect(caster.states.has(158)).toBe(true)
      expect(caster.overlays.some((o) => o.token === 'bladeshield' && o.loop)).toBe(true)

      const attachments = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'blade shield attachment',
      )
      expect(attachments).toHaveLength(1)
      const att = attachments[0]!
      expect(att.classId).toBe(553)
      expect(att.maxTicks).toBe(500 + 5 * 100)

      // Move caster and step: attachment stays anchored to caster and emits 0 slashes with no monster nearby
      caster.x = 104
      caster.y = 102
      world.tick(40)
      expect(att.x).toBe(104)
      expect(att.y).toBe(102)
      expect(
        Array.from(world.units.values()).filter(
          (u) => u.unitType === 'missile' && u.missileKey === 'blade shield missile',
        ),
      ).toHaveLength(0)

      // Spawn a hostile monster within 6 sub-tiles of caster and step
      const mon = (world as any).ensureUnit('monster', 501)
      mon.classId = 1 // Skeleton
      mon.x = 107
      mon.y = 102
      mon.mode = 1
      mon.dead = false
      mon.lifePct = 128
      ;(world as any)._monsters.set(501, mon)

      world.tick(40)

      const slashes = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'blade shield missile',
      )
      expect(slashes.length).toBeGreaterThanOrEqual(1)
      const slash = slashes[0]!
      expect(slash.classId).toBe(552)
      expect(slash.maxTicks).toBe(100)
      expect(Math.hypot(slash.vx ?? 0, slash.vy ?? 0)).toBeGreaterThan(0)

      const slashTxt = getMissileTxtData('blade shield missile')
      expect(slashTxt.celFile).toBe('Expansion\\blade_shield_missile')
      expect(slashTxt.vel).toBe(18)
      expect(slashTxt.range).toBe(100)
      expect(slashTxt.trans).toBe(1)

      // Removing state 158 despawns the attachment on the next tick
      caster.states.remove(158)
      world.tick(40)
      expect(
        Array.from(world.units.values()).filter(
          (u) => u.unitType === 'missile' && u.missileKey === 'blade shield attachment',
        ),
      ).toHaveLength(0)
    })
  })
})

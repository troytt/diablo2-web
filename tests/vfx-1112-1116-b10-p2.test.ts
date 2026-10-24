import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  FREEZINGARROWEXP2_META,
  MISSILE_METAS,
} from '../src/client/render/missiles-meta.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'

describe('B10-p2 Spell VFX Parity (#1112, #1113, #1114, #1115, #1116)', () => {
  describe('#1112 (B10-7): CltHitFunc 14 — freezingarrow / glacialspike / monglacialspike', () => {
    it('removes invented glacialspikeejecta row and keeps canonical freezingarrowexp2 (#89, CelFile=FreezeExplodeEjecta)', () => {
      expect(CANONICAL_113C_MISSILES.glacialspikeejecta).toBeUndefined()
      expect(CANONICAL_113C_MISSILES.freezingarrowexp2).toBeDefined()
      expect(CANONICAL_113C_MISSILES.freezingarrowexp2?.id).toBe(89)
      expect(CANONICAL_113C_MISSILES.freezingarrowexp2?.celFile).toBe('FreezeExplodeEjecta')
      expect(MISSILE_METAS.glacialspikeejecta).toBeUndefined()
      expect(MISSILE_METAS.freezingarrowexp2).toBe(FREEZINGARROWEXP2_META)

      for (const key of ['freezingarrow', 'glacialspike', 'monglacialspike'] as const) {
        const row = CANONICAL_113C_MISSILES[key]!
        expect(row.pCltHitFunc).toBe(14)
        expect(row.explosionMissile).toBe('')
        expect(row.cltHitSubMissile1).toBe('freezingarrowexp1')
        expect(row.cltHitSubMissile2).toBe('freezingarrowexp2')
      }
    })

    it('CltHit14 spawns 1 freezingarrowexp1 at center and 3..4 freezingarrowexp2 at 8-dir offset groups', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Sor', x: 100, y: 100 })
      const countsSeen = new Set<number>()

      for (let i = 0; i < 24; i++) {
        const w = new ClientWorld()
        w.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Sor', x: 100, y: 100 })
        const gs = (w as any).spawnMissileByKey('glacialspike', 100, 100, 105, 100, {
          ownerType: 'player',
          ownerId: 1,
          sourceSkillId: 55,
          skillLevel: 10,
        })
        // Perturb seed across iterations so all 3 direction groups (4, 4, 3) are exercised
        gs.seed.lo = (gs.seed.lo + i * 0x9e3779b9) >>> 0
        ;(w as any).triggerMissileImpact(gs, 105, 100, false)

        const all = Array.from(w.units.values()).filter((u) => u.unitType === 'missile')
        const exp1 = all.filter((u) => u.missileKey === 'freezingarrowexp1')
        const exp2 = all.filter((u) => u.missileKey === 'freezingarrowexp2')
        expect(exp1.length).toBe(1)
        expect(exp1[0]!.x).toBe(105)
        expect(exp1[0]!.y).toBe(100)
        expect(exp2.length === 3 || exp2.length === 4).toBe(true)
        countsSeen.add(exp2.length)
        for (const sub of exp2) {
          const dx = sub.x - 105
          const dy = sub.y - 100
          expect([-1, 0, 1]).toContain(dx)
          expect([-1, 0, 1]).toContain(dy)
          expect(dx !== 0 || dy !== 0).toBe(true)
        }
      }

      expect(countsSeen.has(3)).toBe(true)
      expect(countsSeen.has(4)).toBe(true)
    })
  })

  describe('#1113 (B10-8): CltHitFunc 19 & CltDoFunc 13 — Blizzard shards and explosions', () => {
    it('defines blizzard1..4 with empty ExplosionMissile, pCltHitFunc=19, and CltHitSubMissile1..2 = blizzardexplode1..3', () => {
      const center = CANONICAL_113C_MISSILES.blizzardcenter!
      expect(center.pCltDoFunc).toBe(13)
      expect(center.cltSubMissile1).toBe('blizzard1')
      expect(center.cltSubMissile2).toBe('blizzard4')

      for (const key of ['blizzard1', 'blizzard2', 'blizzard3', 'blizzard4'] as const) {
        const row = CANONICAL_113C_MISSILES[key]!
        expect(row.explosionMissile).toBe('')
        expect(row.pCltHitFunc).toBe(19)
        expect(row.cltHitSubMissile1).toBe('blizzardexplode1')
        expect(row.cltHitSubMissile2).toBe('blizzardexplode3')
      }
    })

    it('casting #59 Blizzard spawns only blizzardcenter (no extra cast-time blizzard1) and CltHit19 randomly picks blizzardexplode1..3 without icebreaksmall', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Sor', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 59, 108, 104, 10)

      const initialMissiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(initialMissiles.map((m) => m.missileKey)).toEqual(['blizzardcenter'])

      const seenExplodes = new Set<string>()
      for (let i = 0; i < 30; i++) {
        const w = new ClientWorld()
        w.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Sor', x: 100, y: 100 })
        const shard = (w as any).spawnMissileByKey('blizzard1', 108, 104, 108, 104, {
          ownerType: 'player',
          ownerId: 1,
          sourceSkillId: 59,
          skillLevel: 10,
          maxTicks: 1,
        })
        shard.alwaysExplode = true
        shard.seed.lo = (shard.seed.lo + i * 0x85ebca6b) >>> 0
        ;(w as any).stepMissileUnit(shard)

        const remaining = Array.from(w.units.values()).filter((u) => u.unitType === 'missile')
        expect(remaining.some((u) => u.missileKey === 'icebreaksmall')).toBe(false)
        const explodes = remaining.filter((u) => u.missileKey?.startsWith('blizzardexplode'))
        expect(explodes.length).toBe(1)
        seenExplodes.add(explodes[0]!.missileKey!)
      }

      expect(seenExplodes).toEqual(
        new Set(['blizzardexplode1', 'blizzardexplode2', 'blizzardexplode3']),
      )
    })
  })

  describe('#1114 (B10-9): CltHitFunc 10 (ProgOverlay) table-driven & no fake lightninghit explosions', () => {
    it('attaches lightning for Nova/ChainLightning/LightningJavelin without spawning fake lightninghit explosion, attaches ice_explode for Frost Nova, and attaches nothing for empty ProgOverlay rows', () => {
      for (const [key, expectedOverlay] of [
        ['nova', 'lightning'],
        ['chainlightning', 'lightning'],
        ['lightningjavelin', 'lightning'],
        ['frostnova', 'ice_explode'],
        ['mephfrostnova', 'ice_explode'],
        ['diablight', 'diablolightning'],
        ['warcry', 'doubledamage1'],
        ['lightningbolt', ''],
        ['furylightning', ''],
        ['chargedstrikebolt', ''],
        ['andyfallingdebris1', ''],
      ] as const) {
        const w = new ClientWorld()
        w.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Sor', x: 100, y: 100 })
        w.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 201, classId: 1, x: 104, y: 100, lifePct: 128, mode: 1 },
        })
        const mon = w.getUnit('monster', 201)!
        const m = (w as any).spawnMissileByKey(key, 100, 100, 104, 100, {
          ownerType: 'player',
          ownerId: 1,
        })
        ;(w as any).triggerMissileImpact(m, 104, 100, false, mon)

        if (expectedOverlay) {
          expect(mon.overlays.some((o) => o.token === expectedOverlay)).toBe(true)
        } else {
          expect(mon.overlays.length).toBe(0)
        }

        // Verify no fake lightninghit explosion is spawned on impact
        const hitSpawns = Array.from(w.units.values()).filter(
          (u) => u.unitType === 'missile' && u.missileKey === 'lightninghit',
        )
        expect(hitSpawns.length).toBe(0)
      }
    })
  })

  describe('#1115 (B10-10): CltHitFunc 9 — Holy Bolt (#55) & Fist of the Heavens Bolt (#234)', () => {
    it('defines holybolt and fistoftheheavensbolt with pCltHitFunc=9, cHitPar1=1, cHitPar2=1, CltHitSubMissile1="teethexplode", CollideFriend=1', () => {
      expect(CANONICAL_113C_MISSILES.holybolt?.explosionMissile).toBe('')
      expect(CANONICAL_113C_MISSILES.holybolt?.progOverlay).toBe('healing')
      for (const key of ['holybolt', 'fistoftheheavensbolt'] as const) {
        const row = CANONICAL_113C_MISSILES[key]!
        expect(row.pCltHitFunc).toBe(9)
        expect(row.cHitPar1).toBe(1)
        expect(row.cHitPar2).toBe(1)
        expect(row.cltHitSubMissile1).toBe('teethexplode')
        expect(Boolean(row.collideFriend)).toBe(true)
      }
    })

    it('passes through non-undead monsters, explodes with teethexplode on undead monsters, heals friendly units with healing overlay, and spawns nothing on wall hit', () => {
      for (const boltKey of ['holybolt', 'fistoftheheavensbolt'] as const) {
        // 1) Non-undead in front (x=101), undead behind (x=103.5)
        const w = new ClientWorld()
        w.apply({ type: 'PlayerAssign', unitId: 1, charClass: 3, name: 'Pal', x: 100, y: 100 })
        w.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 301, classId: 15, x: 101, y: 100, lifePct: 128, mode: 1 },
        })
        ;(w.getUnit('monster', 301) as any).isUndead = false
        w.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 302, classId: 0, x: 103.5, y: 100, lifePct: 128, mode: 1 },
        })
        ;(w.getUnit('monster', 302) as any).isUndead = true

        const hb = (w as any).spawnMissileByKey(boltKey, 100, 100, 110, 100, {
          ownerType: 'player',
          ownerId: 1,
          sourceSkillId: boltKey === 'holybolt' ? 101 : 121,
          skillLevel: 5,
        })

        // First step crosses non-undead monster 301 at x=101 without detonating
        ;(w as any).stepMissileUnit(hb)
        expect(w.units.has(hb.key)).toBe(true)
        expect(
          Array.from(w.units.values()).some(
            (u) => u.unitType === 'missile' && u.missileKey === 'teethexplode',
          ),
        ).toBe(false)

        // Subsequent steps reach undead skeleton 302 and detonate with teethexplode (#204)
        for (let t = 0; t < 15 && w.units.has(hb.key); t++) {
          ;(w as any).stepMissileUnit(hb)
        }
        expect(w.units.has(hb.key)).toBe(false)
        const teethExp = Array.from(w.units.values()).filter(
          (u) => u.unitType === 'missile' && u.missileKey === 'teethexplode',
        )
        expect(teethExp.length).toBe(1)
        expect(teethExp[0]!.classId).toBe(204)

        // 2) Friendly player/ally hit attaches 'healing' overlay and removes the bolt without teethexplode
        const wFriend = new ClientWorld()
        wFriend.apply({ type: 'PlayerAssign', unitId: 1, charClass: 3, name: 'Pal', x: 100, y: 100 })
        wFriend.apply({ type: 'PlayerAssign', unitId: 2, charClass: 0, name: 'Ally', x: 100.5, y: 100 })
        const ally = wFriend.getUnit('player', 2)!
        const hbFriend = (wFriend as any).spawnMissileByKey(boltKey, 100, 100, 110, 100, {
          ownerType: 'player',
          ownerId: 1,
          sourceSkillId: boltKey === 'holybolt' ? 101 : 121,
          skillLevel: 5,
        })
        ;(wFriend as any).stepMissileUnit(hbFriend)
        expect(wFriend.units.has(hbFriend.key)).toBe(false)
        expect(ally.overlays.some((o) => o.token === 'healing')).toBe(true)
        expect(
          Array.from(wFriend.units.values()).some(
            (u) => u.unitType === 'missile' && u.missileKey === 'teethexplode',
          ),
        ).toBe(false)

        // 3) Wall hit spawns no teethexplode and attaches no overlay
        const wWall = new ClientWorld()
        wWall.apply({ type: 'PlayerAssign', unitId: 1, charClass: 3, name: 'Pal', x: 100, y: 100 })
        const wallBolt = (wWall as any).spawnMissileByKey(boltKey, 100, 100, 105, 100, {
          ownerType: 'player',
          ownerId: 1,
          sourceSkillId: boltKey === 'holybolt' ? 101 : 121,
          skillLevel: 5,
        })
        ;(wWall as any).triggerMissileImpact(wallBolt, 105, 100, true)
        expect(
          Array.from(wWall.units.values()).some(
            (u) => u.unitType === 'missile' && u.missileKey === 'teethexplode',
          ),
        ).toBe(false)
      }
    })
  })

  describe('#1116 (B10-11): Universal Missiles.txt ProgOverlay & CltDoFunc 51 (recycler delay)', () => {
    it('defines ProgOverlay across all 1.13c Missiles.txt rows and attaches on impact or CltDo51 countdown', () => {
      expect(CANONICAL_113C_MISSILES.firehead?.progOverlay).toBe('vampiresteal')
      expect(CANONICAL_113C_MISSILES['healing vortex']?.progOverlay).toBe('healing')
      expect(CANONICAL_113C_MISSILES['erruption crack 1']?.progOverlay).toBe('fire_hit')
      expect(CANONICAL_113C_MISSILES['erruption crack 2']?.progOverlay).toBe('fire_hit')
      expect(CANONICAL_113C_MISSILES['recycler delay']?.progOverlay).toBe('steallife')
      expect(CANONICAL_113C_MISSILES['vine recycler delay']?.progOverlay).toBe('stealmana')

      // firehead hitting target attaches 'vampiresteal' overlay
      const wFirehead = new ClientWorld()
      wFirehead.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Sor', x: 100, y: 100 })
      const player = wFirehead.getUnit('player', 1)!
      const fh = (wFirehead as any).spawnMissileByKey('firehead', 105, 100, 100, 100, {
        ownerType: 'monster',
        ownerId: 99,
      })
      ;(wFirehead as any).triggerMissileImpact(fh, 100, 100, false, player)
      expect(player.overlays.some((o) => o.token === 'vampiresteal')).toBe(true)

      // CltDo51: recycler delay (#498) & vine recycler delay (#540)
      for (const [key, expectedOverlay] of [
        ['recycler delay', 'steallife'],
        ['vine recycler delay', 'stealmana'],
      ] as const) {
        const w = new ClientWorld()
        w.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Dru', x: 100, y: 100 })
        const owner = w.getUnit('player', 1)!
        const delayMissile = (w as any).spawnMissileByKey(key, 104, 102, 104, 102, {
          ownerType: 'player',
          ownerId: 1,
        })
        for (let t = 0; t < 10; t++) {
          ;(w as any).stepMissileUnit(delayMissile)
        }
        const spawnedKeys = Array.from(w.units.values())
          .filter((u) => u.unitType === 'missile')
          .map((u) => u.missileKey)
        expect(spawnedKeys).toContain('recycler explosion')
        expect(spawnedKeys).toContain('recycler vine')
        expect(owner.overlays.some((o) => o.token === expectedOverlay)).toBe(true)
      }
    })
  })
})

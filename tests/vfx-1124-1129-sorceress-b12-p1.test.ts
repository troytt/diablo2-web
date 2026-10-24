/**
 * Diablo II v1.13c Spell VFX Parity — Sorceress Work Unit B12-p1 (#1124, #1125, #1126, #1127, #1128, #1129)
 *
 * Ground Truth References:
 * - #1124 Blaze (#46): Missiles.txt `blaze` (#67) Range=90, LevRange=25 -> patch lifetime = 90 + 25*slvl frames
 *   (115 at slvl 1, 590 at slvl 20); Skills.txt #46 aurastate=blaze (13), Param1=50, Param2=500, auralencalc=dm12
 *   -> state duration = trunc((110*slvl*(500-50))/(100*(slvl+6))) + 50 (120 at slvl 1, 430 at slvl 20).
 * - #1125 Frozen Orb (#64): Missiles.txt `frozenorb` (#260) Vel=10 (no 0.55 speed clamp), CltDoFunc=19 / SrvDoFunc=15,
 *   CltParam1=1, CltParam2=19, CltSubMissile1='frozenorbbolt' (#261). Every 1 frame in flight, emits 1 frozenorbbolt
 *   aimed at the 64-entry circle table (CLTDO25_RING_X_113C / CLTDO25_RING_Y_113C), stepping index by 19 mod 64.
 * - #1126 Inferno (#41): Skills.txt #41 srvdofunc=8 (SKILLS_DoInferno), Param1=20, Param2=3, calc1=ln12/2.
 *   Initial frame primes Param1=1 and spawns 0 missiles; each subsequent channel frame spawns 1 infernoflame1/2
 *   with Range = trunc((20 + 3*(slvl-1)) / 2) frames (10 at slvl 1, 38 at slvl 20).
 * - #1127 Chilling Armor (#60): Skills.txt #60 aurastate=chillingarmor (20), cltmissilea=chillingarmorbolt (#264,
 *   ReturnFire=0), cltoverlaya=chillarmor_hit; States.txt row 20 cltevent=hitbymissile, clteventfunc=1.
 *   When struck by a missile with ReturnFire=1, spawns chillingarmorbolt aimed at the attacker and attaches
 *   chillarmor_hit one-shot overlay. Ignores missiles with ReturnFire=0 (e.g. chillingarmorbolt).
 * - #1128 Enchant (#52): Skills.txt #52 TargetAlly=1, TargetPet=1, InTown=1, aurastate=enchant (16);
 *   States.txt row 16 castoverlay=enchant. Applies state 16 and one-shot 'enchant' overlay to the selected
 *   friendly ally/pet/mercenary unit (or caster when self-targeted), never unconditionally to the caster.
 * - #1129 Enchant weapon tint (#52): States.txt row 16 itemtype=weap, itemtrans=cred (Crystal Red).
 *   Units with state 16 have their equipped weapon paperdoll layer(s) (rh/lh) tinted 'cred'.
 */

import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  BLAZE_STATE_ID_113C,
  CHILLINGARMOR_STATE_ID_113C,
  ENCHANT_STATE_ID_113C,
  blazeStateDurationFrames113c,
  infernoFlameRangeFrames113c,
  isReturnFireMissile113c,
} from '../src/client/world/state-ids-113c.ts'
import { SELF_BUFF_SKILL_STATES } from '../src/client/world/world-skill-state-tables.ts'
import {
  CLTDO25_RING_X_113C,
  CLTDO25_RING_Y_113C,
} from '../src/common/skills/cltdo25-ring-113c.ts'
import {
  appearanceKey,
  applyStateItemTransToAppearance,
  getLayerTint,
  resolveCharacterAppearance,
} from '../src/common/units/char-appearance.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import { castSkill } from '../src/server/skills/skills.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'

function fireActionFrame(world: ClientWorld, unitKey: string): void {
  const cs = world.units.get(unitKey)?.castState
  if (cs && cs.missileFireDelayMs !== undefined && cs.missileFireDelayMs > 0) {
    world.expireCastStates(cs.startedAtMs + cs.missileFireDelayMs, 0)
  }
}

describe('Sorceress Spell VFX Parity B12-p1 (#1124..#1129)', () => {
  describe('#1124 Blaze (#46): Missiles.txt Range+LevRange patch lifetime & dm12 state duration', () => {
    it('derives blaze patch maxTicks = 90 + 25*slvl and state 13 duration = dm12(50, 500, slvl)', () => {
      expect(blazeStateDurationFrames113c(1)).toBe(120)
      expect(blazeStateDurationFrames113c(10)).toBe(359)
      expect(blazeStateDurationFrames113c(20)).toBe(430)

      for (const [slvl, expectedPatchTicks, expectedStateFrames] of [
        [1, 115, 120],
        [5, 215, 275],
        [20, 590, 430],
      ] as const) {
        const world = new ClientWorld()
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 0, id: 1, classId: 1, name: 'Sorc', x: 5000, y: 5000 },
          isSelf: true,
        })
        world.apply({
          type: 'SkillCast',
          caster: { unitType: 0, id: 1 },
          skill: 46,
          skillId: 46,
          level: slvl,
          target: { x: 5000, y: 5000 },
        })
        fireActionFrame(world, 'player:1')

        const caster = world.getUnit('player', 1)!
        expect(caster.states.has(BLAZE_STATE_ID_113C)).toBe(true)
        expect(caster.blazeUntilTick).toBe(world.frameCount + expectedStateFrames)

        const castPatches = Array.from(world.units.values()).filter(
          u => u.unitType === 'missile' && u.missileKey === 'blaze',
        )
        expect(castPatches).toHaveLength(1)
        expect(castPatches[0]!.maxTicks).toBe(expectedPatchTicks)

        // Move caster while Blaze is active and verify footstep trail patches also use 90 + 25*slvl (never 112)
        caster.x = 5002
        caster.y = 5002
        world.tick(40)

        const allPatches = Array.from(world.units.values()).filter(
          u => u.unitType === 'missile' && u.missileKey === 'blaze',
        )
        expect(allPatches.length).toBeGreaterThan(1)
        for (const p of allPatches) {
          expect(p.maxTicks).toBe(expectedPatchTicks)
          expect(p.maxTicks).not.toBe(112)
        }
      }
    })
  })

  describe('#1125 Frozen Orb (#64): CltParam1=1 single-bolt rhythm along 64-entry circle stepping by CltParam2=19', () => {
    it('emits 1 frozenorbbolt per tick stepping index by 19 mod 64 without artificially clamping orb velocity', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 1, name: 'Sorc', x: 5000, y: 5000 },
        isSelf: true,
      })
      world.apply({
        type: 'SkillCast',
        caster: { unitType: 0, id: 1 },
        skill: 64,
        skillId: 64,
        level: 10,
        target: { x: 5030, y: 5000 },
      })
      fireActionFrame(world, 'player:1')

      const orb = Array.from(world.units.values()).find(
        u => u.unitType === 'missile' && u.missileKey === 'frozenorb',
      )!
      expect(orb).toBeDefined()
      // Missiles.txt frozenorb Vel=10 -> dwVelocity=1920 -> 15/32 = 0.46875 subtiles/tick (not clamped to 0.55)
      const orbSpeed = Math.hypot(orb.vx ?? 0, orb.vy ?? 0)
      expect(orbSpeed).toBeLessThan(0.55)
      expect(orbSpeed).toBeCloseTo(15 / 32, 4)

      for (let step = 0; step < 5; step++) {
        const expectedIdx = (step * 19) & 63
        world.tick(40)
        const bolts = Array.from(world.units.values()).filter(
          u => u.unitType === 'missile' && u.missileKey === 'frozenorbbolt',
        )
        expect(bolts).toHaveLength(step + 1)
        const newestBolt = bolts[bolts.length - 1]!
        const aimDx = (newestBolt.targetX ?? 0) - (newestBolt.originX ?? 0)
        const aimDy = (newestBolt.targetY ?? 0) - (newestBolt.originY ?? 0)
        expect(aimDx).toBeCloseTo(CLTDO25_RING_X_113C[expectedIdx]!, 5)
        expect(aimDy).toBeCloseTo(CLTDO25_RING_Y_113C[expectedIdx]!, 5)
        expect(orb.subMissileIdx).toBe(((step + 1) * 19) & 63)
      }
    })
  })

  describe('#1126 Inferno (#41): calc1 = ln12/2 flame range & 0 missiles on initial cast frame', () => {
    it('computes infernoFlameRangeFrames113c = trunc((20 + 3*(slvl-1))/2) and spawns 0 flames on frame 0 then 1 per tick', () => {
      expect(infernoFlameRangeFrames113c(1)).toBe(10)
      expect(infernoFlameRangeFrames113c(10)).toBe(23)
      expect(infernoFlameRangeFrames113c(20)).toBe(38)

      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 1, name: 'Sorc', x: 5000, y: 5000 },
        isSelf: true,
      })
      world.apply({
        type: 'SkillCast',
        caster: { unitType: 0, id: 1 },
        skill: 41,
        skillId: 41,
        level: 20,
        target: { x: 5020, y: 5000 },
      })
      // Initial cast frame (SKILLS_DoInferno Param1=0 -> 1): spawns 0 missiles (not 3 stacked flames)
      world.tick(40)
      const flamesFrame0 = Array.from(world.units.values()).filter(
        u =>
          u.unitType === 'missile' &&
          (u.missileKey === 'infernoflame1' || u.missileKey === 'infernoflame2'),
      )
      expect(flamesFrame0).toHaveLength(0)

      // Subsequent channeled frames: 1 flame per frame with maxTicks = 38 at slvl 20
      world.tick(40)
      const flamesFrame1 = Array.from(world.units.values()).filter(
        u =>
          u.unitType === 'missile' &&
          (u.missileKey === 'infernoflame1' || u.missileKey === 'infernoflame2'),
      )
      expect(flamesFrame1).toHaveLength(1)
      expect(flamesFrame1[0]!.maxTicks).toBe(38)

      world.tick(40)
      const flamesFrame2 = Array.from(world.units.values()).filter(
        u =>
          u.unitType === 'missile' &&
          (u.missileKey === 'infernoflame1' || u.missileKey === 'infernoflame2'),
      )
      expect(flamesFrame2).toHaveLength(2)
      expect(flamesFrame2[1]!.maxTicks).toBe(38)
    })

    it('enforces server scene castSkill(41) initial frame 0 missiles and calc1 ttl on subsequent frames', () => {
      const player: any = {
        x: 100,
        y: 100,
        facing: 0,
        cooldown: 0,
        mana: 100,
        maxMana: 100,
        infernoChanneling: false,
        infernoManaRemainder256: 0,
      }
      const engine: any = {
        world: { player, events: [] },
        projectiles: [],
        spawnOverlay: () => {},
        metrics: { casts: 0 },
      }
      const hudManager: any = {
        mana: 100,
        getSkillLevel: (id: number) => (id === 41 ? 20 : 0),
        syncPublishedState: () => {},
      }
      const status = { textContent: '' } as any
      const ctx = { engine, runtime: {} as any, hudManager, status }

      // Frame 0: primes infernoChanneling, spawns 0 projectiles
      expect(castSkill(41, 200, 100, ctx)).toBe(true)
      expect(engine.projectiles).toHaveLength(0)

      // Frame 1: spawns 1 infernoflame projectile with ttl = 38 (calc1 at slvl 20)
      expect(castSkill(41, 200, 100, ctx)).toBe(true)
      expect(engine.projectiles).toHaveLength(1)
      expect(engine.projectiles[0]!.ttl).toBe(38)
    })
  })

  describe('#1127 Chilling Armor (#60): hitbymissile ReturnFire=1 counter-bolt chillingarmorbolt & chillarmor_hit', () => {
    it('fires chillingarmorbolt toward ranged attacker and attaches chillarmor_hit when hit by a ReturnFire=1 missile on client', () => {
      expect(isReturnFireMissile113c('arrow')).toBe(true)
      expect(isReturnFireMissile113c('fireball')).toBe(true)
      expect(isReturnFireMissile113c('chillingarmorbolt')).toBe(false)

      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 1, name: 'Sorc', x: 5000, y: 5000 },
        isSelf: true,
      })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 50, classId: 5, name: 'SkeletonArcher', x: 5015, y: 5000 },
      })
      const sorc = world.getUnit('player', 1)!
      sorc.states.add(CHILLINGARMOR_STATE_ID_113C)
      sorc.skillLevel = 12

      // Monster fires an arrow (ReturnFire=1) that hits the Sorceress
      const arrow = (world as any).spawnMissileByKey('arrow', 5001, 5000, 5000, 5000, {
        ownerType: 'monster',
        ownerId: 50,
      })
      expect(arrow).toBeDefined()
      world.tick(40)

      const counterBolts = Array.from(world.units.values()).filter(
        u => u.unitType === 'missile' && u.missileKey === 'chillingarmorbolt',
      )
      expect(counterBolts).toHaveLength(1)
      expect(counterBolts[0]!.ownerType).toBe('player')
      expect(counterBolts[0]!.ownerId).toBe(1)
      expect(counterBolts[0]!.targetX).toBe(5015)
      expect(counterBolts[0]!.targetY).toBe(5000)
      expect((counterBolts[0]!.vx ?? 0)).toBeGreaterThan(0)
      expect(sorc.overlays.some(o => o.token === 'chillarmor_hit' && !o.loop)).toBe(true)

      // A missile with ReturnFire=0 (e.g. enemy chillingarmorbolt) must NOT trigger retaliation
      ;(world as any).triggerMissileImpact(
        {
          id: 999999,
          classId: 264,
          missileKey: 'chillingarmorbolt',
          ownerType: 'monster',
          ownerId: 50,
          x: 5000,
          y: 5000,
        },
        5000,
        5000,
        false,
        sorc,
      )
      const counterBoltsAfter = Array.from(world.units.values()).filter(
        u => u.unitType === 'missile' && u.missileKey === 'chillingarmorbolt',
      )
      expect(counterBoltsAfter).toHaveLength(1)
    })

    it('consumes Chilling Armor missileHit in server GameEngine to spawn a flying chillingarmorbolt projectile', () => {
      const engine = new GameEngine('sor')
      engine.world.player.coldArmorType = 'chillingarmor'
      engine.world.player.coldArmorTicks = 500
      engine.world.player.coldArmorSlvl = 10
      engine.world.monsters.push({
        index: 0,
        x: 320,
        y: 200,
        hp: 200,
        maxHp: 200,
        state: 'attack',
        cooldown: 0,
        stats: {
          id: 'sk_archer',
          name: 'Archer',
          maxHp: 200,
          damage: 10,
          speed: 0,
          sightRadius: 500,
          reach: 400,
          cooldownTicks: 25,
          xp: 10,
        },
      } as any)

      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })
      const counterBolt = engine.projectiles.find(p => p.missileType === 'chillingarmorbolt')
      expect(counterBolt).toBeDefined()
      expect(counterBolt!.vx).toBeGreaterThan(0)
      expect(counterBolt!.ttl).toBe(24) // spawned at ttl=25 (Missiles.txt Range=25), advanced 1 tick in updateProjectiles
      expect(engine.overlays.some(o => o.overlayName === 'chillarmor_hit')).toBe(true)
    })
  })

  describe('#1128 Enchant (#52): TargetAlly=1 / TargetPet=1 targeted state 16 & castoverlay=enchant', () => {
    it('applies state 16 and one-shot enchant overlay to targeted ally/pet instead of caster', () => {
      expect(SELF_BUFF_SKILL_STATES[52]).toBeUndefined()

      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 1, name: 'Sorc', x: 5000, y: 5000 },
        isSelf: true,
      })
      // Friendly mercenary monster at (5012, 5000)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 200, classId: 271, name: 'RogueMerc', x: 5012, y: 5000 },
      })
      const merc = world.getUnit('monster', 200)!
      merc.ownerType = 'player'
      merc.ownerId = 1

      // Cast Enchant (#52) targeting the mercenary at (5012, 5000)
      world.apply({
        type: 'SkillCast',
        caster: { unitType: 0, id: 1 },
        skill: 52,
        skillId: 52,
        level: 10,
        target: { x: 5012, y: 5000 },
      })

      const sorc = world.getUnit('player', 1)!
      expect(merc.states.has(ENCHANT_STATE_ID_113C)).toBe(true)
      expect(merc.overlays.some(o => o.token === 'enchant' && !o.loop)).toBe(true)
      expect(sorc.states.has(ENCHANT_STATE_ID_113C)).toBe(false)
      expect(sorc.overlays.some(o => o.token === 'enchant')).toBe(false)

      // Self-cast Enchant (#52) at caster's position (5000, 5000) buffs caster
      world.apply({
        type: 'SkillCast',
        caster: { unitType: 0, id: 1 },
        skill: 52,
        skillId: 52,
        level: 10,
        target: { x: 5000, y: 5000 },
      })
      expect(sorc.states.has(ENCHANT_STATE_ID_113C)).toBe(true)
      expect(sorc.overlays.some(o => o.token === 'enchant' && !o.loop)).toBe(true)
    })

    it('applies Enchant buff and overlay to targeted pet/summon in server castSkill(52)', () => {
      const pet: any = { uid: 'pet-1', x: 250, y: 100, hp: 100, maxHp: 100, alive: true }
      const player: any = {
        x: 100,
        y: 100,
        facing: 0,
        cooldown: 0,
        mana: 100,
        maxMana: 100,
        summons: [pet],
      }
      const overlays: any[] = []
      const engine: any = {
        world: { player, summons: [pet], events: [] },
        projectiles: [],
        overlays,
        spawnOverlay: (name: string, pos: { x: number; y: number }, casterId: string, opts: any) => {
          overlays.push({ name, pos, casterId, opts })
        },
        metrics: { casts: 0 },
      }
      const status = { textContent: '' } as any
      const ctx = { engine, runtime: {} as any, hudManager: null, status }

      expect(castSkill(52, 250, 100, ctx)).toBe(true)
      expect(pet.enchantTicks).toBe(3600)
      expect(pet.enchantDamage).toBeDefined()
      expect(player.enchantTicks).toBeUndefined()
      expect(overlays).toHaveLength(1)
      expect(overlays[0]!.name).toBe('enchant')
      expect(overlays[0]!.pos).toEqual({ x: 250, y: 100 })
      expect(overlays[0]!.opts?.loop).toBe(false)
    })
  })

  describe('#1129 Enchant (#52): States.txt itemtype=weap / itemtrans=cred weapon red palette shift', () => {
    it('tints equipped weapon layer(s) with cred when state 16 (enchant) is active and updates appearanceKey in buildSceneDrawables', () => {
      const baseAppearance = resolveCharacterAppearance('so', {
        weapon1: { code: 'lsd' }, // Long Sword (rh='lsd')
        weapon2: { code: 'buc' }, // Buckler shield (sh='buc')
      })
      expect(baseAppearance.layers.rh.variant).toBe('lsd')
      expect(baseAppearance.layers.rh.color).toBeNull()
      expect(getLayerTint(baseAppearance, 'rh')).toBeNull()

      const enchantedAppearance = applyStateItemTransToAppearance(baseAppearance, [16])
      expect(enchantedAppearance.layers.rh.variant).toBe('lsd')
      expect(enchantedAppearance.layers.rh.color).toBe('cred')
      expect(enchantedAppearance.layers.rh.transform).toBeGreaterThan(0)
      expect(getLayerTint(enchantedAppearance, 'rh')).toEqual({
        transform: enchantedAppearance.layers.rh.transform,
        color: 'cred',
      })
      // Non-weapon layers (shield, armor, head) remain untouched
      expect(getLayerTint(enchantedAppearance, 'sh')).toBeNull()
      expect(getLayerTint(enchantedAppearance, 'tr')).toBeNull()
      expect(appearanceKey(enchantedAppearance)).toContain(`rh=lsd:${enchantedAppearance.layers.rh.transform}:cred`)

      // Verify buildSceneDrawables dynamically applies state 16 weapon tint and refreshes appearanceKey
      const scene = buildSceneDrawables({
        units: [
          {
            id: 1,
            kind: 'player',
            classId: 1,
            name: 'Sorc',
            x: 100,
            y: 100,
            mode: 1,
            direction: 0,
            states: [16],
            equipmentAppearance: baseAppearance,
            appearanceKey: appearanceKey(baseAppearance),
          },
        ],
        selfUnitId: 1,
        tick: 0,
      })
      const playerDrawable = scene.unitDrawables.find(u => u.unitKind === 'player' && u.id === 1)!
      expect(playerDrawable).toBeDefined()
      expect(playerDrawable.equipmentAppearance?.layers.rh.color).toBe('cred')
      expect(playerDrawable.appearanceKey).toContain(':cred')
      expect(playerDrawable.appearanceKey).not.toBe(appearanceKey(baseAppearance))
    })
  })
})

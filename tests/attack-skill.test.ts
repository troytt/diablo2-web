/**
 * Tests for Normal Attack Icon Completion & Dual Slot Binding Mechanics (Issue #151).
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSkillIcon, getAvailableSkillsForSide } from '../src/client/ui/hotkeys.ts'
import { createDemoHotkeys } from './fixtures/hud-demo-state.ts'
import { getAttackWeaponInfo, checkAmmunition, getSkillRange, type AttackWeaponInputItem } from '../src/common/skills/weapon-combat-meta.ts'
import { castSkill } from '../src/server/skills/skills.ts'
import { GameEngine, type GameEngineOptions } from '../src/server/engine/game-engine.ts'
import {
  computeEffectiveMonsterDefense,
  computeEffectiveMonsterMissileSpeed,
  tickMonsters,
  type Monster,
} from '../src/server/ai/monster-ai.ts'
import { tickProjectiles } from '../src/server/skills/skills.ts'
import { DEMO_SORCERESS_SKILLS } from './fixtures/demo-profile-data.ts'

describe('Issue #151: Normal Attack Icon Completion & Dual Slot Binding', () => {
  describe('Skill 0 Definition & Dual-Palette Usability', () => {
    it('defines Skill 0 Attack with leftUsable: true and rightUsable: true', () => {
      const attackSkill = DEMO_SORCERESS_SKILLS.find((s) => s.skillId === 0)
      expect(attackSkill).toBeDefined()
      expect(attackSkill!.name).toBe('Attack')
      expect(attackSkill!.nameZh).toBe('普通攻击')
      expect(attackSkill!.leftUsable).toBe(true)
      expect(attackSkill!.rightUsable).toBe(true)
      expect(attackSkill!.manaCost).toBe(0)
    })

    it('includes Skill 0 in both left and right available skill palettes', () => {
      const leftSkills = getAvailableSkillsForSide('left', DEMO_SORCERESS_SKILLS)
      const rightSkills = getAvailableSkillsForSide('right', DEMO_SORCERESS_SKILLS)

      const leftAttack = leftSkills.find((s) => s.skillId === 0)
      const rightAttack = rightSkills.find((s) => s.skillId === 0)

      expect(leftAttack).toBeDefined()
      expect(rightAttack).toBeDefined()
      expect(leftAttack!.name).toBe('Attack')
      expect(rightAttack!.name).toBe('Attack')
    })

    it('allows assigning Skill 0 to left slot, right slot, or both simultaneously (dual binding)', () => {
      // Explicitly seeded legacy Sorceress quickbar (the HUD itself starts neutral).
      const hud = createDemoHotkeys()

      // Seeded defaults
      expect(hud.leftSkillId).toBe(47) // Fire Ball
      expect(hud.rightSkillId).toBe(64) // Frozen Orb

      // Assign Attack to left slot
      hud.assignSkill('left', 0)
      expect(hud.leftSkillId).toBe(0)
      expect(hud.rightSkillId).toBe(64)

      // Assign Attack to right slot
      hud.assignSkill('right', 0)
      expect(hud.leftSkillId).toBe(0)
      expect(hud.rightSkillId).toBe(0)

      // Change left slot back to Fire Ball
      hud.assignSkill('left', 47)
      expect(hud.leftSkillId).toBe(47)
      expect(hud.rightSkillId).toBe(0)

      // Use helper setDualSkill
      hud.setDualSkill(0)
      expect(hud.leftSkillId).toBe(0)
      expect(hud.rightSkillId).toBe(0)
    })
  })

  describe('Icon Asset & DC6 Frame 2 Resolution (skilldesc.txt IconCel = 2)', () => {
    it('resolves Skill 0 to authentic Skillicon.DC6 frame 2 icon regardless of weapon state', () => {
      const iconMapping = resolveSkillIcon(0, false)
      expect(iconMapping).toBeDefined()
      expect(iconMapping.skillId).toBe(0)
      expect(iconMapping.name).toBe('Attack')
      expect(iconMapping.dc6Source).toBe('data/global/ui/SPELLS/Skillicon.DC6')
      expect(iconMapping.frameIndex).toBe(2)
      expect(iconMapping.atlasRect.x).toBe(96)
      expect(iconMapping.atlasRect.y).toBe(0)
      expect(iconMapping.atlasRect.width).toBe(48)
      expect(iconMapping.atlasRect.height).toBe(48)
    })

    it('verifies public/skills/icon_0.png exists and is a valid 48x48 PNG image', () => {
      const iconPath = join(process.cwd(), 'public', 'skills', 'icon_0.png')
      expect(existsSync(iconPath)).toBe(true)

      const buf = readFileSync(iconPath)
      // Check PNG magic header: \x89PNG\r\n\x1a\n
      expect(buf[0]).toBe(0x89)
      expect(buf[1]).toBe(0x50) // P
      expect(buf[2]).toBe(0x4e) // N
      expect(buf[3]).toBe(0x47) // G
      expect(buf[4]).toBe(0x0d) // \r
      expect(buf[5]).toBe(0x0a) // \n
      expect(buf[6]).toBe(0x1a)
      expect(buf[7]).toBe(0x0a) // \n

      // Check IHDR dimensions (width at bytes 16-19, height at bytes 20-23)
      const width = buf.readUInt32BE(16)
      const height = buf.readUInt32BE(20)
      expect(width).toBe(48)
      expect(height).toBe(48)
    })

    it('verifies public/ui/icon_0.png exists for baked UI references', () => {
      const iconPath = join(process.cwd(), 'public', 'ui', 'icon_0.png')
      expect(existsSync(iconPath)).toBe(true)
      const buf = readFileSync(iconPath)
      expect(buf.readUInt32BE(16)).toBe(48)
      expect(buf.readUInt32BE(20)).toBe(48)
    })
  })

  describe('Weapon Timing, Damage, and Ammunition Checks', () => {
    it('evaluates unarmed attack characteristics correctly', () => {
      const unarmed = getAttackWeaponInfo(null)
      expect(unarmed.kind).toBe('unarmed')
      expect(unarmed.subtype).toBe('fist')
      expect(unarmed.isRanged).toBe(false)
      expect(unarmed.damageMin).toBe(1)
      expect(unarmed.damageMax).toBe(2)
      expect(unarmed.reach).toBe(52)
      expect(unarmed.cooldown).toBe(12)
      expect(unarmed.swingTicks).toBe(6)
    })

    it('evaluates melee weapon attack timing and damage correctly', () => {
      const crystalSword: AttackWeaponInputItem = {
        code: 'crs',
        name: 'Crystal Sword',
        damage: '5 to 15',
      }
      const swordInfo = getAttackWeaponInfo(crystalSword)
      expect(swordInfo.kind).toBe('melee')
      expect(swordInfo.subtype).toBe('sword')
      expect(swordInfo.isRanged).toBe(false)
      expect(swordInfo.damageMin).toBe(5)
      expect(swordInfo.damageMax).toBe(15)
      expect(swordInfo.reach).toBe(52)
      expect(swordInfo.cooldown).toBe(14)
      expect(swordInfo.swingTicks).toBe(7)

      // Test extended reach for polearm
      const polearm: AttackWeaponInputItem = {
        code: 'vou',
        name: 'Voulge',
        damage: '6 - 21',
      }
      const polearmInfo = getAttackWeaponInfo(polearm)
      expect(polearmInfo.subtype).toBe('polearm')
      expect(polearmInfo.reach).toBe(60)
    })

    it('evaluates ranged weapon (bow/crossbow) timing and ammo requirement', () => {
      const shortBow: AttackWeaponInputItem = {
        code: 'sbw',
        name: 'Short Bow',
        damage: '1 to 4',
      }
      const bowInfo = getAttackWeaponInfo(shortBow)
      expect(bowInfo.kind).toBe('ranged')
      expect(bowInfo.subtype).toBe('bow')
      expect(bowInfo.isRanged).toBe(true)
      expect(bowInfo.ammoType).toBe('arrow')
      expect(bowInfo.reach).toBe(450)
      expect(bowInfo.cooldown).toBe(14)

      const lightCrossbow: AttackWeaponInputItem = {
        code: 'lxb',
        name: 'Light Crossbow',
        damage: '6 to 9',
      }
      const xbowInfo = getAttackWeaponInfo(lightCrossbow)
      expect(xbowInfo.kind).toBe('ranged')
      expect(xbowInfo.subtype).toBe('crossbow')
      expect(xbowInfo.isRanged).toBe(true)
      expect(xbowInfo.ammoType).toBe('bolt')
      expect(xbowInfo.reach).toBe(450)
      expect(xbowInfo.cooldown).toBe(16)
    })

    it('verifies checkAmmunition for bows and crossbows', () => {
      // Offhand arrow equipped
      expect(checkAmmunition('arrow', { code: 'aqv', name: 'Arrows' })).toBe(true)
      // Offhand bolt equipped when bow needs arrow -> false
      expect(checkAmmunition('arrow', { code: 'cqv', name: 'Bolts' })).toBe(false)
      // Offhand bolt equipped when crossbow needs bolt -> true
      expect(checkAmmunition('bolt', { code: 'cqv', name: 'Bolts' })).toBe(true)

      // Ammo in inventory grid
      const invWithArrows = {
        gridItems: [{ item: { code: 'aqv', nameZh: '箭矢' } }],
      }
      expect(checkAmmunition('arrow', null, invWithArrows)).toBe(true)
      expect(checkAmmunition('bolt', null, invWithArrows)).toBe(false)

      const invWithBolts = {
        items: [{ code: 'cqv', nameZh: '十字弓弹' }],
      }
      expect(checkAmmunition('bolt', null, invWithBolts)).toBe(true)
      expect(checkAmmunition('arrow', null, invWithBolts)).toBe(false)

      // Empty inventory & offhand
      expect(checkAmmunition('arrow', null, null)).toBe(false)
      expect(checkAmmunition('bolt', null, { items: [] })).toBe(false)
    })
  })

  describe('Combat Execution via castSkill', () => {
    let engine: GameEngine
    let statusElem: HTMLElement
    const dummyRuntime: any = {
      level: 'test',
      grid: { width: 100, height: 100, cells: new Uint8Array(10000) },
      waypoints: [],
    }

    beforeEach(() => {
      const dummyTerrain = {
        widthPx: 1000,
        heightPx: 1000,
        overlap: () => 0,
      }
      const dummyOpts: GameEngineOptions = {
        spawn: { x: 100, y: 100 },
        stats: [],
        xpTable: [0, 100],
        itemBases: [],
        prefixAffixes: [],
        suffixAffixes: [],
        skills: [],
        npcDefs: [],
        questDefs: [],
        monsterCount: 0,
        combatOptions: {
          playerSpeed: 100,
          playerReach: 50,
          playerCooldownTicks: 10,
          playerDamage: 5,
          playerManaPerAttack: 0,
          respawnTicks: 100,
        },
        talkRadius: 80,
        pickupRadius: 40,
        inventoryCols: 10,
        inventoryRows: 4,
      }
      engine = new GameEngine(dummyTerrain, dummyOpts)
      engine.world.player.x = 100
      engine.world.player.y = 100
      engine.world.player.cooldown = 0
      statusElem = { textContent: '' } as any
    })

    it('executes unarmed attack hitting a nearby monster with base physical damage and unarmed timing', () => {
      const monster: Monster = {
        index: 0,
        x: 120,
        y: 100,
        hp: 50,
        cooldown: 0,
        hitFlash: 0,
        corpseTicks: 0,
        state: 'idle',
        facing: 0,
        stats: { id: 'zombie', name: 'Zombie', hp: 50, damage: 2, cooldownTicks: 10, reach: 20, aggroRadius: 100, speed: 2, xp: 10 },
      }
      engine.world.monsters = [monster]

      const success = castSkill(0, 120, 100, {
        engine,
        runtime: dummyRuntime,
        hudManager: null,
        status: statusElem,
        equippedWeapon: null, // unarmed
      })

      expect(success).toBe(true)
      expect(engine.world.player.cooldown).toBe(12)
      expect(engine.world.player.swingTicks).toBe(6)
      expect(monster.hp).toBeLessThan(50) // damaged
      expect(engine.metrics.playerHits).toBe(1)
      expect(statusElem.textContent).toContain('普通攻击（空手拳击）命中')
    })

    it('executes melee weapon attack with equipped weapon timing and damage', () => {
      const monster: Monster = {
        index: 0,
        x: 130,
        y: 100,
        hp: 100,
        cooldown: 0,
        hitFlash: 0,
        corpseTicks: 0,
        state: 'idle',
        facing: 0,
        stats: { id: 'skeleton', name: 'Skeleton', hp: 100, damage: 5, cooldownTicks: 10, reach: 20, aggroRadius: 100, speed: 2, xp: 15 },
      }
      engine.world.monsters = [monster]

      const success = castSkill(0, 130, 100, {
        engine,
        runtime: dummyRuntime,
        hudManager: null,
        status: statusElem,
        equippedWeapon: {
          code: 'crs',
          name: 'Crystal Sword',
          damage: '20 to 30',
        },
      })

      expect(success).toBe(true)
      expect(engine.world.player.cooldown).toBe(14)
      expect(engine.world.player.swingTicks).toBe(7)
      // Damage should be (20 + 30) / 2 = 25
      expect(monster.hp).toBe(75)
      expect(statusElem.textContent).toContain('普通攻击命中')
    })

    it('fails fast on ranged attack when ammunition is missing', () => {
      const success = castSkill(0, 200, 100, {
        engine,
        runtime: dummyRuntime,
        hudManager: null,
        status: statusElem,
        equippedWeapon: {
          code: 'sbw',
          name: 'Short Bow',
          damage: '1 to 4',
        },
        hasAmmo: false,
      })

      expect(success).toBe(false)
      expect(engine.projectiles.length).toBe(0)
      expect(statusElem.textContent).toBe('缺少箭矢！')
    })

    it('launches basic arrow projectile on ranged attack when ammunition is present', () => {
      const success = castSkill(0, 300, 100, {
        engine,
        runtime: dummyRuntime,
        hudManager: null,
        status: statusElem,
        equippedWeapon: {
          code: 'sbw',
          name: 'Short Bow',
          damage: '10 to 20',
        },
        hasAmmo: true,
      })

      expect(success).toBe(true)
      expect(engine.world.player.cooldown).toBe(14)
      expect(engine.projectiles.length).toBe(1)

      const proj = engine.projectiles[0]
      expect(proj.skillId).toBe('0')
      expect(proj.fromPlayer).toBe(true)
      expect(proj.damage).toBe(15) // average of 10 and 20
      expect(proj.vx).toBeGreaterThan(0)
      expect(statusElem.textContent).toContain('发射箭矢')
    })

    it('records whiff event when melee attack is performed with no monster in reach', () => {
      engine.world.monsters = [] // no monsters

      const success = castSkill(0, 120, 100, {
        engine,
        runtime: dummyRuntime,
        hudManager: null,
        status: statusElem,
        equippedWeapon: null, // unarmed
      })

      expect(success).toBe(true)
      expect(engine.world.player.cooldown).toBe(12)
      const whiffEvent = engine.world.events.find((e) => e.kind === 'playerHit' && (e as any).text === 'whiff')
      expect(whiffEvent).toBeDefined()
    })

    it('enforces bow/crossbow requirement and ammo consumption for Amazon Bow skills (#7-#31), while exempting #6 Magic Arrow from ammo', () => {
      // Melee weapon fails for #7 Fire Arrow
      const failMelee = castSkill(7, 300, 100, {
        engine,
        runtime: dummyRuntime,
        hudManager: null,
        status: statusElem,
        equippedWeapon: { code: 'crs', name: 'Crystal Sword', damage: '10 to 20' },
        hasAmmo: true,
      })
      expect(failMelee).toBe(false)
      expect(statusElem.textContent).toContain('需要装备弓或十字弓')

      // Bow without ammo succeeds for #6 Magic Arrow
      engine.world.player.mana = 50
      const magicArrowOk = castSkill(6, 300, 100, {
        engine,
        runtime: dummyRuntime,
        hudManager: null,
        status: statusElem,
        equippedWeapon: { code: 'sbw', name: 'Short Bow', damage: '10 to 20' },
        hasAmmo: false,
      })
      expect(magicArrowOk).toBe(true)
      expect(engine.projectiles.length).toBe(1)
      expect(engine.projectiles[0]!.missileType).toBe('magicarrow')

      // Bow without ammo fails for #7 Fire Arrow
      engine.world.player.cooldown = 0
      const failNoAmmo = castSkill(7, 300, 100, {
        engine,
        runtime: dummyRuntime,
        hudManager: null,
        status: statusElem,
        equippedWeapon: { code: 'sbw', name: 'Short Bow', damage: '10 to 20' },
        hasAmmo: false,
      })
      expect(failNoAmmo).toBe(false)

      // Bow with quiver decrements quantity
      const quiver = { code: 'aqv', name: 'Arrows', quantity: 5 }
      const fireArrowOk = castSkill(7, 300, 100, {
        engine,
        runtime: dummyRuntime,
        hudManager: null,
        status: statusElem,
        equippedWeapon: { code: 'sbw', name: 'Short Bow', damage: '10 to 20' },
        equippedAmmo: quiver,
      })
      expect(fireArrowOk).toBe(true)
      expect(quiver.quantity).toBe(4)
    })

    it('spawns 1.13c Multiple Shot (#12), Guided Arrow (#22), Strafe (#26), Immolation Arrow (#27), and Freezing Arrow (#31) projectiles with exact blast/patch/freeze semantics', () => {
      engine.world.player.mana = 500
      const hudLike: any = {
        mana: 500,
        getSkillLevel: (id: number) => (id === 12 ? 5 : id === 27 ? 1 : id === 31 ? 1 : id === 21 ? 10 : 1),
        getBaseSkillLevel: (id: number) => (id === 21 ? 10 : 0),
      }

      // #12 Multiple Shot at slvl 5 => min(24, 1 + 5) = 6 arrows with nextDelay = 4
      engine.world.player.cooldown = 0
      expect(
        castSkill(12, 300, 100, {
          engine,
          runtime: dummyRuntime,
          hudManager: hudLike,
          status: statusElem,
        }),
      ).toBe(true)
      expect(engine.projectiles).toHaveLength(6)
      expect(engine.projectiles[0]!.nextDelay).toBe(4)

      // #22 Guided Arrow => homing = true, pierce capability per #1306, range = 3072 (ttl = 128)
      engine.projectiles.length = 0
      engine.world.player.cooldown = 0
      ;(engine.world.player as any).pierce = true
      expect(
        castSkill(22, 300, 100, {
          engine,
          runtime: dummyRuntime,
          hudManager: hudLike,
          status: statusElem,
        }),
      ).toBe(true)
      expect(engine.projectiles).toHaveLength(1)
      expect(engine.projectiles[0]!.homing).toBe(true)
      expect(engine.projectiles[0]!.pierce).toBe(true)
      expect(engine.projectiles[0]!.ttl).toBe(128)
      ;(engine.world.player as any).pierce = false

      // #27 Immolation Arrow => 25-frame cooldown, 80px blast radius, spawns immolationfire patch on expiry
      engine.projectiles.length = 0
      engine.world.player.cooldown = 0
      expect(
        castSkill(27, 300, 100, {
          engine,
          runtime: dummyRuntime,
          hudManager: hudLike,
          status: statusElem,
        }),
      ).toBe(true)
      expect(engine.world.player.cooldown).toBe(25)
      expect(engine.projectiles).toHaveLength(1)
      const immProj = engine.projectiles[0]!
      expect(immProj.aoeRadius).toBe(80)
      expect(immProj.aoeDamage).toBeDefined()
      expect(immProj.damage).toBeGreaterThan(immProj.aoeDamage!)

      // Force expiry to test AlwaysExplode + immolationfire ground patch spawn
      ;(engine.projectiles as any)[0] = { ...immProj, ttl: 0 }
      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        digits: [],
        saving: false,
        loading: false,
      })
      const firePatch = engine.projectiles.find((p) => p.missileType === 'immolationfire')
      expect(firePatch).toBeDefined()
      expect(firePatch!.ttl).toBe(75)

      // #31 Freezing Arrow with Ice Arrow blvl 10 (+50% freeze length => 75 frames) and 80px blast radius
      engine.projectiles.length = 0
      engine.world.player.cooldown = 0
      expect(
        castSkill(31, 300, 100, {
          engine,
          runtime: dummyRuntime,
          hudManager: hudLike,
          status: statusElem,
        }),
      ).toBe(true)
      expect(engine.projectiles).toHaveLength(1)
      expect(engine.projectiles[0]!.aoeRadius).toBe(80)
      expect(engine.projectiles[0]!.statusEffect).toBe('freeze')
      expect(engine.projectiles[0]!.statusDuration).toBe(75)
    })

    it('enforces Layer 3 1.13c Amazon Passive & Magic runtime parity (#8/#9/#13/#17/#18/#28/#29/#32/#33, Issue #969)', () => {
      engine.world.player.mana = 500
      ;(engine.world.player as any).maxHp = 500
      engine.world.player.hp = 100 // low current HP to verify Decoy uses maxHp, not current hp!

      const monsterInRange: Monster = {
        index: 0,
        x: 150,
        y: 100,
        hp: 200,
        cooldown: 0,
        hitFlash: 0,
        corpseTicks: 0,
        state: 'idle',
        facing: 0,
        defense: 500,
        stats: { id: 'archer', name: 'Skeleton Archer', hp: 200, damage: 10, cooldownTicks: 10, reach: 100, aggroRadius: 200, speed: 3, xp: 20 },
      }
      engine.world.monsters = [monsterInRange]

      const hudAma: any = {
        mana: 500,
        getSkillLevel: (id: number) => {
          if (id === 8 || id === 17 || id === 28 || id === 32 || id === 33) return 10
          if (id === 9) return 20
          return 1
        },
        getBaseSkillLevel: (id: number) => {
          if (id === 8 || id === 17 || id === 28 || id === 32 || id === 33) return 10
          if (id === 9) return 20
          return 0
        },
      }

      // 1. #8 Inner Sight (slvl 10 => -305 flat defense, 1100 ticks, +3 light radius)
      engine.world.player.cooldown = 0
      expect(
        castSkill(8, 150, 100, {
          engine,
          runtime: dummyRuntime,
          hudManager: hudAma,
          status: statusElem,
        }),
      ).toBe(true)
      expect(monsterInRange.innerSightTicks).toBe(1100)
      expect(monsterInRange.innerSightDefReduction).toBe(-305)
      expect(monsterInRange.lightRadiusBonus).toBe(3)
      expect(computeEffectiveMonsterDefense(monsterInRange)).toBe(195) // 500 - 305

      // 2. #17 Slow Missiles (slvl 10 => 1650 ticks, 0.33 velocity mult, +3 light radius)
      engine.world.player.cooldown = 0
      expect(
        castSkill(17, 150, 100, {
          engine,
          runtime: dummyRuntime,
          hudManager: hudAma,
          status: statusElem,
        }),
      ).toBe(true)
      expect(monsterInRange.slowMissilesTicks).toBe(1650)
      expect(monsterInRange.slowMissilesMult).toBe(0.33)
      expect(computeEffectiveMonsterMissileSpeed(monsterInRange, 10)).toBeCloseTo(3.3, 5)

      // 3. #28 Decoy (slvl 10 with player.maxHp=500, player.hp=100 => 100% of maxHp = 500 HP, 0 avoidance inheritance)
      engine.world.player.cooldown = 0
      expect(
        castSkill(28, 160, 100, {
          engine,
          runtime: dummyRuntime,
          hudManager: hudAma,
          status: statusElem,
        }),
      ).toBe(true)
      const worldSummons: any[] = (engine.world as any).summons ?? []
      const decoySummon = worldSummons.find((s) => s.kind === 'dopplezon')
      expect(decoySummon).toBeDefined()
      expect(decoySummon!.hp).toBe(500) // uses maxHp (500), NOT current hp (100)!
      expect(decoySummon!.inheritedAvoidLvl).toBe(0)
      expect(decoySummon!.inheritedEvadeLvl).toBe(0)

      // 4. #32 Valkyrie (slvl 10 + 10 Decoy hard points => 440 * (1 + 1.8 + 2.0) = 2112 HP, 150-frame cooldown)
      engine.world.player.cooldown = 0
      expect(
        castSkill(32, 170, 100, {
          engine,
          runtime: dummyRuntime,
          hudManager: hudAma,
          status: statusElem,
        }),
      ).toBe(true)
      const valkSummon = worldSummons.find((s) => s.kind === 'valkyrie')
      expect(valkSummon).toBeDefined()
      expect(valkSummon!.hp).toBe(2112) // Decoy synergy (+200% HP) properly applied!
      expect(valkSummon!.inheritedCriticalStrikeLvl).toBe(20)

      // 5. #33 Pierce in tickProjectiles: enforces 4-pierce cap (max 5 hits total) and pierceChancePct roll
      const sixLineTargets = Array.from({ length: 6 }, (_, idx) => ({
        index: idx,
        x: 100,
        y: 100,
        radius: 15,
        alive: true,
      }))
      const outcomeAfter100PctPierce = tickProjectiles(
        [
          {
            x: 100,
            y: 100,
            vx: 0,
            vy: 0,
            damage: 10,
            ttl: 10,
            fromPlayer: true,
            skillId: '6',
            pierce: true,
            pierceChancePct: 100,
            maxPierceCount: 4,
          },
        ],
        sixLineTargets,
        { overlap: () => 0, rng: () => 0 }, // always succeeds pierce roll
      )
      // Must stop after 5 hits (initial hit + 4 pierces) and despawn the arrow
      expect(outcomeAfter100PctPierce.alive).toHaveLength(0)
      expect(outcomeAfter100PctPierce.hits).toHaveLength(5)

      // 6. #13 Dodge, #18 Avoid, #29 Evade in tickCombat
      const combatPlayer: any = {
        x: 100,
        y: 100,
        hp: 200,
        cooldown: 0,
        swingTicks: 0,
        facing: 0,
        invulnTicks: 0,
        hitFlash: 0,
        attackDamage: 10,
        attackReach: 30,
        attackCooldownTicks: 10,
        dodgeSlvl: 10, // 47%
        avoidSlvl: 10, // 56%
        evadeSlvl: 10, // 47%
        passiveRollOverride: 10, // < chancePct => triggers avoidance!
        isMovingThisTick: false,
      }
      const meleeAttacker: Monster = {
        index: 0,
        x: 110,
        y: 100,
        hp: 100,
        cooldown: 0,
        hitFlash: 0,
        corpseTicks: 0,
        state: 'chase',
        facing: 0,
        stats: { id: 'z', name: 'Zombie', hp: 100, damage: 25, cooldownTicks: 10, reach: 20, aggroRadius: 100, speed: 2, xp: 10 },
      }
      const events: any[] = []
      const dummyWorld: any = { monsters: [meleeAttacker], events, tick: 1, kills: 0 }
      const dummyOptions: any = { respawnTicks: 50 }
      const dummyTerrain: any = { overlap: () => 0 }
      // Stationary vs melee => Dodge (#13) triggers and sets swingTicks lock
      tickMonsters(dummyWorld, dummyOptions, dummyTerrain, [combatPlayer])
      expect(combatPlayer.hp).toBe(200)
      expect(combatPlayer.swingTicks).toBeGreaterThanOrEqual(4)
      expect(events.some((e) => e.text === 'dodge')).toBe(true)

      // Moving vs melee => Evade (#29) triggers with NO swingTicks lock
      events.length = 0
      combatPlayer.swingTicks = 0
      combatPlayer.isMovingThisTick = true
      meleeAttacker.cooldown = 0
      tickMonsters(dummyWorld, dummyOptions, dummyTerrain, [combatPlayer])
      expect(combatPlayer.hp).toBe(200)
      expect(combatPlayer.swingTicks).toBe(0)
      expect(events.some((e) => e.text === 'evade')).toBe(true)
    })

    it('executes Amazon Javelin & Spear skills (#10/#14/#15/#19/#20/#24/#25/#30/#34/#35) in castSkill and tickProjectiles with 1.13c parity', () => {
      engine.world.player.x = 100
      engine.world.player.y = 100
      engine.world.player.mana = 500
      ;(engine.world.player as any).maxMana = 500
      ;(engine.world.player as any).forceHitSuccess = true

      const hudSkills: Record<number, number> = {
        10: 5,  // Jab slvl 5 => 0% ED, +51% AR
        14: 5,  // Power Strike slvl 5
        15: 5,  // Poison Javelin slvl 5
        19: 5,  // Impale slvl 5 => +400% ED, 31% durability loss chance
        20: 5,  // Lightning Bolt slvl 5
        24: 10, // Charged Strike slvl 10 => 3 + floor(10/5) = 5 bolts
        25: 5,  // Plague Javelin slvl 5
        30: 5,  // Fend slvl 5 => +110% ED
        33: 0,  // Pierce initially 0
        34: 5,  // Lightning Strike slvl 5 => 1 + 5 = 6 chain jumps
        35: 5,  // Lightning Fury slvl 5 => 1 + 5 = 6 furylightning bolts on impact
      }
      const equippedRef: any = {
        weapon: {
          code: 'jav',
          subtype: 'javelin',
          minDamage: 10,
          maxDamage: 10,
          quantity: 5,
          durability: 20,
          maxDurability: 20,
        },
      }
      const hudAma: any = {
        mana: 500,
        charClass: 'AMA',
        level: 30,
        stats: { strength: 50, dexterity: 100, vitality: 50, energy: 20 },
        getSkillLevel: (id: number) => hudSkills[id] ?? 0,
        getBaseSkillLevel: (id: number) => hudSkills[id] ?? 0,
        getEquippedItems: () => equippedRef,
      }

      // 0. Weapon type validation: Sword must be rejected for both Spear/Javelin skills (#10) and Javelin-only skills (#15)
      equippedRef.weapon = { code: 'ssd', subtype: 'sword', minDamage: 10, maxDamage: 10 }
      expect(castSkill(10, 120, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(false)
      expect(castSkill(15, 200, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(false)

      // Spear allows melee spear/jav skills (#10 Jab) but rejects thrown javelin skills (#15 Poison Javelin)
      equippedRef.weapon = { code: 'spr', subtype: 'spear', minDamage: 10, maxDamage: 10, durability: 20, maxDurability: 20 }
      expect(castSkill(15, 200, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(false)

      // 1. #10 Jab: 3 rapid strikes on target in melee reach
      const m1: any = {
        index: 0, x: 120, y: 100, hp: 500, maxHp: 500, cooldown: 0, hitFlash: 0, corpseTicks: 0,
        state: 'chase', facing: 0,
        stats: { id: 'z1', name: 'Zombie1', hp: 500, damage: 10, cooldownTicks: 10, reach: 20, aggroRadius: 100, speed: 2, xp: 10 },
      }
      engine.world.monsters = [m1]
      engine.world.player.cooldown = 0
      expect(castSkill(10, 120, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(true)
      expect(engine.projectiles).toHaveLength(0)
      expect(m1.hp).toBeLessThan(500)

      // 2. #14 Power Strike: single melee hit + lightning damage + 'lightning' overlay, NO chargedstrikebolt projectiles
      m1.hp = 500
      engine.world.player.cooldown = 0
      expect(castSkill(14, 120, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(true)
      expect(engine.projectiles).toHaveLength(0)
      expect(m1.hp).toBeLessThan(500)

      // 3. #19 Impale: high-ED melee hit (+400% ED at slvl 5) + weapon durability loss roll
      m1.hp = 500
      engine.world.player.cooldown = 0
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.05) // 5 < 31% durability loss chance
      expect(castSkill(19, 120, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(true)
      expect(m1.hp).toBeLessThan(500)
      expect(equippedRef.weapon.durability).toBe(19)
      randomSpy.mockRestore()

      // 4. #30 Fend: 1 strike per distinct living monster in melee reach
      const m2: any = {
        index: 1, x: 125, y: 105, hp: 500, maxHp: 500, cooldown: 0, hitFlash: 0, corpseTicks: 0,
        state: 'chase', facing: 0,
        stats: { id: 'z2', name: 'Zombie2', hp: 500, damage: 10, cooldownTicks: 10, reach: 20, aggroRadius: 100, speed: 2, xp: 10 },
      }
      m1.hp = 500
      engine.world.monsters = [m1, m2]
      engine.world.player.cooldown = 0
      expect(castSkill(30, 120, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(true)
      expect(m1.hp).toBeLessThan(500)
      expect(m2.hp).toBeLessThan(500)

      // Switch to Javelin with quantity = 4 for thrown/hybrid javelin skills
      equippedRef.weapon = {
        code: 'jav',
        subtype: 'javelin',
        minDamage: 10,
        maxDamage: 10,
        quantity: 4,
        durability: 20,
        maxDurability: 20,
      }

      // 5. #15 Poison Javelin: consumes 1 javelin, sets 15-frame cooldown, spawns 'poisonjav' that trails 'poisonjavcloud'
      engine.projectiles.length = 0
      engine.world.player.cooldown = 0
      expect(castSkill(15, 250, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(true)
      expect(equippedRef.weapon.quantity).toBe(3)
      expect(engine.world.player.cooldown).toBe(15)
      expect(engine.projectiles).toHaveLength(1)
      expect(engine.projectiles[0]!.missileType).toBe('poisonjav')
      expect(engine.projectiles[0]!.pierce).toBe(false)
      const pjTickOutcome = tickProjectiles(engine.projectiles, [], { overlap: () => 0 })
      expect(pjTickOutcome.alive.some((p) => p.missileType === 'poisonjavcloud')).toBe(true)

      // 6. #20 Lightning Bolt: consumes 1 javelin, spawns 'lightningjavelin' with pierce=false when Pierce slvl=0
      engine.projectiles.length = 0
      engine.world.player.cooldown = 0
      expect(castSkill(20, 250, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(true)
      expect(equippedRef.weapon.quantity).toBe(2)
      expect(engine.projectiles).toHaveLength(1)
      expect(engine.projectiles[0]!.missileType).toBe('lightningjavelin')
      expect(engine.projectiles[0]!.pierce).toBe(false)

      // 7. #24 Charged Strike: melee hit + 3 + floor(10/5) = 5 'chargedstrikebolt' projectiles (does not consume javelin stack)
      engine.projectiles.length = 0
      engine.world.player.cooldown = 0
      m1.hp = 500
      expect(castSkill(24, 120, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(true)
      expect(equippedRef.weapon.quantity).toBe(2)
      expect(m1.hp).toBeLessThan(500)
      expect(engine.projectiles).toHaveLength(5)
      expect(engine.projectiles.every((p) => p.missileType === 'chargedstrikebolt')).toBe(true)

      // 8. #25 Plague Javelin: consumes 1 javelin, sets 100-frame cooldown, explodes into radial 'plaguejavcloud' on hit/wall/expiry
      engine.projectiles.length = 0
      engine.world.player.cooldown = 0
      expect(castSkill(25, 250, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(true)
      expect(equippedRef.weapon.quantity).toBe(1)
      expect(engine.world.player.cooldown).toBe(100)
      expect(engine.projectiles).toHaveLength(1)
      expect(engine.projectiles[0]!.missileType).toBe('plaguejavelin')
      // Test AlwaysExplode on expiry (ttl = 0)
      const plgExpireOutcome = tickProjectiles([{ ...engine.projectiles[0]!, ttl: 0 }], [], { overlap: () => 0 })
      expect(plgExpireOutcome.alive.filter((p) => p.missileType === 'plaguejavcloud').length).toBeGreaterThanOrEqual(8)

      // 9. #34 Lightning Strike: melee hit + 'lightningstrike' chain projectile with chainRemaining = 1 + slvl = 6
      engine.projectiles.length = 0
      engine.world.player.cooldown = 0
      expect(castSkill(34, 120, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(true)
      expect(engine.projectiles).toHaveLength(1)
      expect(engine.projectiles[0]!.missileType).toBe('lightningstrike')
      expect(engine.projectiles[0]!.chainRemaining).toBe(6)
      expect(engine.projectiles[0]!.aoeRadius).toBe(400)

      // 10. #35 Lightning Fury: consumes last javelin (quantity 1 -> 0), spawns 1 'lightningfury' javelin that releases 1 + slvl = 6 'furylightning' bolts on hit
      engine.projectiles.length = 0
      engine.world.player.cooldown = 0
      expect(castSkill(35, 200, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(true)
      expect(equippedRef.weapon.quantity).toBe(0)
      expect(engine.projectiles).toHaveLength(1)
      expect(engine.projectiles[0]!.missileType).toBe('lightningfury')
      // Place primary target at projectile hit position and 2 nearby monsters within 300px
      const lfPrimary = { ...engine.projectiles[0]!, x: 200, y: 100, vx: 0, vy: 0 }
      const lfTargets = [
        { index: 0, x: 200, y: 100, radius: 15, alive: true },
        { index: 1, x: 260, y: 100, radius: 15, alive: true },
        { index: 2, x: 200, y: 180, radius: 15, alive: true },
      ]
      const lfHitOutcome = tickProjectiles([lfPrimary], lfTargets, { overlap: () => 0 })
      const furyBolts = lfHitOutcome.alive.filter((p) => p.missileType === 'furylightning')
      expect(furyBolts).toHaveLength(2) // capped by the 2 eligible secondary monsters within 300px

      // Attempting another thrown javelin cast with quantity = 0 must fail
      engine.world.player.cooldown = 0
      expect(castSkill(35, 200, 100, { engine, runtime: dummyRuntime, hudManager: hudAma, status: statusElem })).toBe(false)
    })
  })
})



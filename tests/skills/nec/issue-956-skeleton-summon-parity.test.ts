import { describe, expect, it } from 'vitest'
import {
  calculateRaiseSkeletonStats,
  calculateSkeletalMageStats,
  calculateNecromageMissileDamage,
  executeSkill,
} from '../../../src/server/skills/skills.ts'
import { CommandMapper } from '../../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../../../src/client/session/rate-limiter.ts'
import { HudModel } from '../../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../../src/netproto/index.ts'
import { evaluateSkillEffects, type SkillCalcState } from '../../../src/common/skills/skill-calc-engine.ts'
import { SKILLS_BY_ID } from '../../../src/common/data/skills-catalog.ts'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { SummonManager } from '../../../src/server/ai/summon-manager.ts'
import { FIXED_ONE, UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { MissileEngine } from '../../../src/server/engine/missile-engine.ts'
import { AuraScanner } from '../../../src/server/engine/aura-scanner.ts'
import type { CombatUnitContext } from '../../../src/server/engine/combat-pipeline.ts'

describe('Issue #956: Necromancer Skeleton Summon Skills 1.13c Parity', () => {
  describe('1. Raise Skeleton (#70) 1.13c Stats & Scaling', () => {
    it('computes 1.13c HP, flat edmn, +7%/lvl damage (slvl 4+), AR, and Defense', () => {
      // slvl 1, smLvl 0 (Normal): HP = 21, minDam = 1, maxDam = 2, AR = 5 + 15 = 20, Def = 5 + 15 = 20
      const s1_0 = calculateRaiseSkeletonStats(1, 0)
      expect(s1_0.maxCount).toBe(1)
      expect(s1_0.maxHp).toBe(21)
      expect(s1_0.minDamage).toBe(1)
      expect(s1_0.maxDamage).toBe(2)
      expect(s1_0.attackRating).toBe(20)
      expect(s1_0.defense).toBe(20)

      // slvl 3, smLvl 0: HP = 21 (bonus starts at slvl 4), minDam = 1, maxDam = 2
      const s3_0 = calculateRaiseSkeletonStats(3, 0)
      expect(s3_0.maxHp).toBe(21)
      expect(s3_0.hpBonusPct).toBe(0)
      expect(s3_0.damageBonusPct).toBe(0)

      // slvl 4, smLvl 1:
      // baseHp = 21 + 8*1 = 29, hpBonusPct = (4-3)*50 = 50% -> floor(29 * 150 / 100) = 43
      // edmn at slvl 4 = 0, masteryDmg = 2 -> baseMin=3, baseMax=4, dmgBonusPct = 7% -> floor(3*1.07)=3, floor(4*1.07)=4
      const s4_1 = calculateRaiseSkeletonStats(4, 1)
      expect(s4_1.maxHp).toBe(43)
      expect(s4_1.minDamage).toBe(3)
      expect(s4_1.maxDamage).toBe(4)
      expect(s4_1.attackRating).toBe(80)
      expect(s4_1.defense).toBe(80)

      // slvl 20, smLvl 20:
      // baseHp = 21 + 160 = 181, hpBonusPct = 17 * 50 = 850% -> floor(181 * 9.5) = 1719
      // edmn at slvl 20: EMin=0, Lev1=0, Lev2=1(x8=8), Lev3=2(x4=8) => 16, plus mastery 40 => flatDamageBonus = 56
      // baseMin = 1 + 56 = 57, baseMax = 2 + 56 = 58
      // dmgBonusPct = 17 * 7 = 119% -> floor(57 * 2.19) = 124, floor(58 * 2.19) = 127
      const s20_20 = calculateRaiseSkeletonStats(20, 20)
      expect(s20_20.maxCount).toBe(8)
      expect(s20_20.maxHp).toBe(1719)
      expect(s20_20.edmnBonus).toBe(16)
      expect(s20_20.flatDamageBonus).toBe(56)
      expect(s20_20.minDamage).toBe(124)
      expect(s20_20.maxDamage).toBe(127)
      expect(s20_20.attackRating).toBe(605)
      expect(s20_20.defense).toBe(605)
    })

    it('executeSkill(70) returns count = calculateSkeletonMaxCount(slvl) instead of slvl', () => {
      const caster = {
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        mana: 500,
        maxMana: 500,
        level: 20,
        xp: 0,
        cooldown: 0,
        facing: 0,
        alive: true,
        respawnIn: 0,
        swingTicks: 0,
      }
      const r1 = executeSkill(70, { caster, skillLevel: 1 })
      expect(r1.kind === 'summon' && r1.count).toBe(1)
      const r4 = executeSkill(70, { caster, skillLevel: 4 })
      expect(r4.kind === 'summon' && r4.count).toBe(3)
      const r20 = executeSkill(70, { caster, skillLevel: 20 })
      expect(r20.kind === 'summon' && r20.count).toBe(8)
    })
  })

  describe('2. Raise Skeletal Mage (#80) 1.13c Stats & necromage1..4 Missiles', () => {
    it('computes 1.13c HP (base 61, +8/smLvl, +7%/lvl from slvl 4+) and Defense (24 + (slvl+smLvl)*10)', () => {
      const m1_0 = calculateSkeletalMageStats(1, 0)
      expect(m1_0.maxHp).toBe(61)
      expect(m1_0.defense).toBe(34)

      // slvl 10, smLvl 10:
      // baseHp = 61 + 80 = 141, hpBonusPct = (10-3)*7 = 49% -> floor(141 * 1.49) = 210
      const m10_10 = calculateSkeletalMageStats(10, 10)
      expect(m10_10.maxHp).toBe(210)
      expect(m10_10.defense).toBe(224)
    })

    it('maps fire/cold/lightning/poison mages to necromage3/2/4/1 with sumsk1calc missileLevel', () => {
      // slvl 4, smLvl 4 -> missileLevel = 4 + floor((4-2)/2) = 5
      const fire = calculateNecromageMissileDamage('fire', 4, 4)
      expect(fire.missileName).toBe('necromage3')
      expect(fire.missileLevel).toBe(5)
      expect(fire.elemType).toBe('fire')
      // mlvl 5: EMin=2 + 4*2 = 10, EMax=6 + 4*2 = 14
      expect(fire.minDamage256).toBe(10 * FIXED_ONE)
      expect(fire.maxDamage256).toBe(14 * FIXED_ONE)

      const cold = calculateNecromageMissileDamage('cold', 4, 4)
      expect(cold.missileName).toBe('necromage2')
      expect(cold.elemType).toBe('cold')
      // mlvl 5: ELen=25 + 4*25 = 125 frames (5s)
      expect(cold.durationFrames).toBe(125)

      const ltng = calculateNecromageMissileDamage('lightning', 4, 4)
      expect(ltng.missileName).toBe('necromage4')
      expect(ltng.elemType).toBe('ltng')
      // mlvl 5: EMin=1 + 4*1 = 5, EMax=7 + 4*3 = 19
      expect(ltng.minDamage256).toBe(5 * FIXED_ONE)
      expect(ltng.maxDamage256).toBe(19 * FIXED_ONE)

      const pois = calculateNecromageMissileDamage('poison', 4, 4)
      expect(pois.missileName).toBe('necromage1')
      expect(pois.elemType).toBe('pois')
      // mlvl 5: ELen=500 + 4*250 = 1500 frames (60s)
      expect(pois.durationFrames).toBe(1500)
    })

    it('spawns necromage1..4 missiles in SummonManager.tickPets', async () => {
      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry)
      stats.setBaseSkillLevel(69, 5)
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      const corpses = [
        { id: 'c1', consumed: false, baseMaxHp: 500, isBoss: false },
        { id: 'c2', consumed: false, baseMaxHp: 500, isBoss: false },
        { id: 'c3', consumed: false, baseMaxHp: 500, isBoss: false },
        { id: 'c4', consumed: false, baseMaxHp: 500, isBoss: false },
      ]
      for (let i = 0; i < 4; i++) {
        sm.createPet({ owner, skillId: 80, slvl: 10, corpses })
      }

      const me = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)
      const dummyStats = new UnitStatList(registry, { maxhp: 5000 * FIXED_ONE, hitpoints: 5000 * FIXED_ONE })
      const enemy: CombatUnitContext = {
        id: 'enemy-1',
        name: 'Target Dummy',
        statList: dummyStats,
        stateBus: new StateBus(dummyStats, registry),
      }
      const enemyPositions = new Map([['enemy-1', { x: 100, y: 100 }]])

      sm.tickPets({
        currentTick: 1,
        owner,
        enemies: [enemy],
        enemyPositions,
        missileEngine: me,
        auraScanner,
      })

      const mslNames = me.getActiveMissiles().map((m) => m.name).sort()
      expect(mslNames).toEqual(['necromage1', 'necromage2', 'necromage3', 'necromage4'])
    })
  })

  describe('3. Revive (#95) Corpse Eligibility & Stats', () => {
    it('rejects non-revivable monsters (MonStats2 revive=0), Unique, and Champion corpses in SummonManager', async () => {
      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry)
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      // Flying Scimitar (classId 234, revive=0 in MonStats2.txt), Unique corpse, Champion corpse
      const invalidCorpses = [
        { id: 'scimitar', consumed: false, baseMaxHp: 500, classId: 234 },
        { id: 'uniq', consumed: false, baseMaxHp: 500, isUnique: true },
        { id: 'champ', consumed: false, baseMaxHp: 500, isChampion: true },
      ]
      const failRes = sm.createPet({ owner, skillId: 95, slvl: 5, corpses: invalidCorpses })
      expect(failRes.created).toBe(false)
      expect(failRes.reason).toBe('missing_corpse')

      // Skeleton (classId 0, revive=1) succeeds and receives +50% velocitypercent
      const validCorpses = [{ id: 'skel', consumed: false, baseMaxHp: 500, classId: 0 }]
      const okRes = sm.createPet({ owner, skillId: 95, slvl: 5, corpses: validCorpses })
      expect(okRes.created).toBe(true)
      expect(okRes.pet?.statList.getAccruedStat('velocitypercent')).toBe(50)
    })
  })

  describe('4. Client Input Corpse Targeting (CommandMapper)', () => {
    function createTestSetup() {
      const world = new ClientWorld()
      const hudManager = new HudManager()
      const sentCommands: ClientCommand[] = []
      const hudModel = new HudModel({ world, hudManager, onCommand: (cmd) => sentCommands.push(cmd) })
      const predictor = new LocalMovementPredictor()
      predictor.setPosition(5000, 5000)
      const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 })

      world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
      world.apply({
        type: 'PlayerAssign',
        unitId: 1,
        classId: 2,
        name: 'NecroHero',
        x: 5000,
        y: 5000,
      })

      const mapper = new CommandMapper({
        world,
        hudManager,
        hudModel,
        predictor,
        rateLimiter,
        sendCommand: (cmd) => sentCommands.push(cmd),
      })
      return { world, hudManager, mapper, sentCommands }
    }

    it('rejects consumed corpses (states 99, 104, 107, 118, 173), live monsters, bosses, and MonStats2 revive=0 corpses', () => {
      const { world, mapper, sentCommands } = createTestSetup()
      world.self.rightSkill = 70

      // 1. Live monster -> rejected
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 61, classId: 0, name: 'Skeleton', x: 5010, y: 5010 },
      })
      const liveUnit = world.getUnit('monster', 61)!
      expect(mapper.triggerSecondaryWorldAction(5010, 5010, liveUnit, 2000)).toBeNull()
      expect(sentCommands).toHaveLength(0)

      // 2. Consumed corpse (state 104 STATE_CORPSE_NODRAW) -> rejected
      liveUnit.dead = true
      liveUnit.mode = 12
      liveUnit.states.add(104)
      expect(mapper.triggerSecondaryWorldAction(5010, 5010, liveUnit, 2100)).toBeNull()
      expect(sentCommands).toHaveLength(0)

      // 3. Boss corpse (Andariel classId 156) -> rejected for 70/80/95
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 62, classId: 156, name: 'Andariel', x: 5012, y: 5012 },
      })
      const andyCorpse = world.getUnit('monster', 62)!
      andyCorpse.dead = true
      andyCorpse.mode = 12
      expect(mapper.triggerSecondaryWorldAction(5012, 5012, andyCorpse, 2200)).toBeNull()
      expect(sentCommands).toHaveLength(0)

      // 4. Flying Scimitar (classId 234, MonStats2 revive=0) -> allowed for Raise Skeleton (70), rejected for Revive (95)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 63, classId: 234, name: 'FlyingScimitar', x: 5014, y: 5014 },
      })
      const scimitarCorpse = world.getUnit('monster', 63)!
      scimitarCorpse.dead = true
      scimitarCorpse.mode = 12
      world.self.rightSkill = 95
      expect(mapper.triggerSecondaryWorldAction(5014, 5014, scimitarCorpse, 2300)).toBeNull()
      expect(sentCommands).toHaveLength(0)

      world.self.rightSkill = 70
      const okCmd = mapper.triggerSecondaryWorldAction(5014, 5014, scimitarCorpse, 2400)
      expect(okCmd).not.toBeNull()
      expect(sentCommands.map((c) => c.type)).toEqual(['SkillOn'])
    })
  })

  describe('5. ClientWorld Visual Parity (SkillCltStFunc[24], MissileCltDoFunc[11], SkillCltDoFunc[95])', () => {
    function createWorldWithSkill(skillId: number): ClientWorld {
      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 2, name: 'NecroHero', x: 5000, y: 5000 },
        isSelf: true,
      })
      world.apply({ type: 'ActiveSkill', unitId: 1, hand: 'right', skill: skillId })
      return world
    }

    it('marks corpse with STATE_CORPSE_NODRAW (104) and spawns corpseexplosion + 6 gore chunks on Raise Skeleton (70)', () => {
      const world = createWorldWithSkill(70)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 200, classId: 0, name: 'Skeleton', x: 5010, y: 5000 },
      })
      const corpse = world.getUnit('monster', 200)!
      corpse.dead = true
      corpse.mode = 12

      world.noteOutgoingCommand({
        type: 'SkillOn',
        hand: 'right',
        target: { unitType: 'monster', id: 200 },
        shift: false,
        hold: false,
      })

      const caster = world.getUnit('player', 1)!
      const cs = caster.castState
      if (cs && cs.missileFireDelayMs !== undefined && cs.missileFireDelayMs > 0) {
        world.expireCastStates(cs.startedAtMs + cs.missileFireDelayMs, 0)
      }

      expect(corpse.states.has(104)).toBe(true)
      const missiles = Array.from(world.units.values())
        .filter((u) => u.unitType === 'missile')
        .map((m) => m.missileKey)
      expect(missiles).toContain('corpseexplosion')
      const goreChunks = missiles.filter((k) => k === 'bigblood1' || k === 'bigblood2')
      expect(goreChunks.length).toBe(6)
    })

    it('spawns exactly ONE size-matched revive missile on Revive (95)', () => {
      function testReviveSize(classId: number, expectedMissile: string) {
        const world = createWorldWithSkill(95)
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 201, classId, name: 'TargetCorpse', x: 5010, y: 5000 },
        })
        const corpse = world.getUnit('monster', 201)!
        corpse.dead = true
        corpse.mode = 12

        world.noteOutgoingCommand({
          type: 'SkillOn',
          hand: 'right',
          target: { unitType: 'monster', id: 201 },
          shift: false,
          hold: false,
        })
        const caster = world.getUnit('player', 1)!
        const cs = caster.castState
        if (cs && cs.missileFireDelayMs !== undefined && cs.missileFireDelayMs > 0) {
          world.expireCastStates(cs.startedAtMs + cs.missileFireDelayMs, 0)
        }
        const missiles = Array.from(world.units.values())
          .filter((u) => u.unitType === 'missile')
          .map((m) => m.missileKey)
        expect(missiles).toEqual([expectedMissile])
      }

      // classId 190 (maggotegg1) has SizeX=1 -> revivesmall
      testReviveSize(190, 'revivesmall')
      // classId 0 (skeleton1) has SizeX=2 -> revivemedium
      testReviveSize(0, 'revivemedium')
      // classId 186 (blunderbore1) has SizeX=3 -> revivelarge
      testReviveSize(186, 'revivelarge')
    })
  })

  describe('6. SkillDesc Tooltip Parity (#69, #70, #80)', () => {
    const state: SkillCalcState = {
      classCode: 'nec',
      hardPoints: {
        69: 5,
        70: 10,
        80: 10,
      },
      tabSoftPoints: { 0: 0, 1: 0, 2: 0 },
      allSkillsSoftPoints: 0,
      specificSoftPoints: {},
    }

    it('renders Skeleton Mastery (#69) lineTypes 70, 33, 32 with full 1.13c text', () => {
      const smEntry = SKILLS_BY_ID[69]!
      const lines = evaluateSkillEffects(state, smEntry, 5)
      const enTexts = lines.map((l) => l.textEn)
      expect(enTexts).toContain('Skeletons: +40 Life')
      expect(enTexts).toContain('Skeletons: +10 Damage')
      expect(enTexts).toContain('Magi: +40 Life')
      expect(enTexts).toContain('Magi: Improved Missile Damage')
      expect(enTexts).toContain('Monsters: +25% Life')
      expect(enTexts).toContain('Monsters: +50% Damage')
    })

    it('includes flat edmn in Raise Skeleton (#70) lineType 34 damage tooltip and +7%/lvl in Raise Skeletal Mage (#80) lineType 13 life tooltip', () => {
      const rsEntry = SKILLS_BY_ID[70]!
      const rsLines = evaluateSkillEffects(state, rsEntry, 10)
      const dmgLine = rsLines.find((l) => l.lineType === 34)!
      // At slvl 10, smLvl 5: edmn = 2, masteryDmg = 10 -> baseMin = 1+2+10 = 13, baseMax = 2+2+10 = 14
      // bonusPct = (10-3)*7 = 49% -> floor(13*1.49)=19, floor(14*1.49)=20
      expect(dmgLine.textEn).toBe('Damage: 19 - 20')

      const rsmEntry = SKILLS_BY_ID[80]!
      const rsmLines = evaluateSkillEffects(state, rsmEntry, 10)
      const lifeLine = rsmLines.find((l) => l.lineType === 13)!
      // At slvl 10, smLvl 5: baseLife = 61 + 40 = 101, bonusPct = 49% -> floor(101*1.49) = 150
      expect(lifeLine.textEn).toBe('Life: 150')
    })
  })
})

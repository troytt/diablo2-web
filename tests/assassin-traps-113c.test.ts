import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { SKILLS_BY_ID } from '../src/common/data/skills-catalog.ts'
import {
  CANONICAL_113C_MISSILES,
  getMissileTxtData,
  getSkillCooldownTicks,
  getSkillManaCost,
} from '../src/common/skills/missiles-data.ts'
import { computeCombatStats, type CombatArmItem, type CombatInput, type CombatSkillInput } from '../src/client/ui-model/combat-stats.ts'
import { SummonManager } from '../src/server/ai/summon-manager.ts'
import { AuraScanner } from '../src/server/engine/aura-scanner.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import { WorldArena } from '../src/server/engine/world-arena.ts'
import { castSkill } from '../src/server/skills/skills.ts'
import {
  calcBladeFury113c,
  calcBladeSentinel113c,
  calcBladeShield113c,
  calcChargedBoltSentry113c,
  calcDeathSentry113c,
  calcFireBlast113c,
  calcLightningSentry113c,
  calcShockWeb113c,
  calcWakeOfFire113c,
  calcWakeOfInferno113c,
} from '../src/server/skills/assassin-traps.ts'
import { computeShockWebSpikeCount } from '../src/server/skills/impl/ass/skill-256-shock-field.ts'
import { evaluateSkill113c, executeSkill113c } from '../src/server/skills/registry.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'

describe('Assassin Traps (#251-#277) — 1.13c 4-Layer Parity (Issue #1005)', () => {
  describe('Layer 1: skills-catalog.ts, hud-world-sync.ts / combat-stats.ts, and missiles-data.ts', () => {
    it('aligns Chinese localization (nameZh, shortDescZh, longDescZh) and synergies for #251-#277', () => {
      expect(SKILLS_BY_ID[251]?.nameZh).toBe('火焰爆震')
      expect(SKILLS_BY_ID[256]?.nameZh).toBe('雷电网')
      expect(SKILLS_BY_ID[257]?.nameZh).toBe('刀刃守卫')
      expect(SKILLS_BY_ID[257]?.longDescZh).toContain('来回巡逻的旋转飞刃')
      expect(SKILLS_BY_ID[261]?.nameZh).toBe('充能弹哨卫')
      expect(SKILLS_BY_ID[261]?.longDescZh).toContain('充能电火花')
      expect(SKILLS_BY_ID[262]?.nameZh).toBe('火焰复苏')
      expect(SKILLS_BY_ID[262]?.longDescZh).toContain('V型烈焰波浪')
      expect(SKILLS_BY_ID[266]?.nameZh).toBe('刀刃之怒')
      expect(SKILLS_BY_ID[266]?.longDescZh).toContain('旋转飞刀')
      expect(SKILLS_BY_ID[271]?.nameZh).toBe('闪电哨卫')
      expect(SKILLS_BY_ID[271]?.longDescZh).toContain('穿透闪电束')
      expect(SKILLS_BY_ID[272]?.nameZh).toBe('地狱火复苏')
      expect(SKILLS_BY_ID[272]?.longDescZh).toContain('地狱烈焰流')
      expect(SKILLS_BY_ID[276]?.nameZh).toBe('死亡哨卫')
      expect(SKILLS_BY_ID[276]?.longDescZh).toContain('引爆附近的怪物尸体')
      expect(SKILLS_BY_ID[277]?.nameZh).toBe('刀刃之盾')
      expect(SKILLS_BY_ID[277]?.longDescZh).toContain('锋利飞刃')

      // #272 Wake of Inferno receives +10%/lvl from #251 Fire Blast and #276 Death Sentry (par7=10), and +7%/lvl from #262 Wake of Fire (par8=7)
      const woiSyns = SKILLS_BY_ID[272]?.synergiesReceived ?? []
      expect(woiSyns.find((s) => s.providerId === 251)?.percentPerLevel).toBe(10)
      expect(woiSyns.find((s) => s.providerId === 276)?.percentPerLevel).toBe(10)
      expect(woiSyns.find((s) => s.providerId === 262)?.percentPerLevel).toBe(7)

      // descdam verification
      expect(Number(SKILLS_BY_ID[257]?.descdam)).toBe(5)
      expect(Number(SKILLS_BY_ID[266]?.descdam)).toBe(24)
      expect(Number(SKILLS_BY_ID[277]?.descdam)).toBe(5)
    })

    it('computes character sheet Blade Traps damage with SrcDam, Half2HSrc, and descdam=24 (#257, #266, #277)', () => {
      const arm1H: CombatArmItem = {
        weapon: {
          code: 'ktr',
          minDam: 40,
          maxDam: 80,
          twoHandMinDam: 0,
          twoHandMaxDam: 0,
          minMisDam: 0,
          maxMisDam: 0,
          strBonus: 0,
          dexBonus: 0,
          twoHanded: false,
          oneOrTwoHanded: false,
          throwable: false,
          weaponClass: 'h2h',
        },
        component: 5,
        ethereal: false,
        canBeEquipped: true,
        isType: () => false,
        localRaw: () => 0,
      }
      const arm2H: CombatArmItem = {
        weapon: {
          code: '2hs',
          minDam: 0,
          maxDam: 0,
          twoHandMinDam: 40,
          twoHandMaxDam: 80,
          minMisDam: 0,
          maxMisDam: 0,
          strBonus: 0,
          dexBonus: 0,
          twoHanded: true,
          oneOrTwoHanded: false,
          throwable: false,
          weaponClass: '2hs',
        },
        component: 5,
        ethereal: false,
        canBeEquipped: true,
        isType: () => false,
        localRaw: () => 0,
      }

      const makeCombatInput = (arm: CombatArmItem, skill: CombatSkillInput): CombatInput => ({
        charClass: 'ass',
        clvl: 40,
        toHitFactor: 15,
        strength: 100,
        dexterity: 100,
        dexterityWithoutStates: 100,
        lists: [{ kind: 'other', get: () => 0 }],
        rightArm: arm,
        leftArm: null,
        primaryArm: 'right',
        boots: null,
        masteries: [],
        isDamageRelated: () => true,
        hasStateColorFlag: () => false,
        leftSkill: skill,
        rightSkill: skill,
      })

      // #257 Blade Sentinel: SrcDam=48 (3/8 1H, 3/16 2H via Half2HSrc=1), descdam=5 scales both weapon and flat skill phys
      const bsSkill: CombatSkillInput = {
        id: 257,
        level: 1,
        weapSel: 0,
        kick: false,
        srcDam: 48,
        itypeA1: '',
        itypeA1IsThrown: false,
        range: 'h2h',
        toHitPercent: 0,
        damagePercent: 0,
        skillPhysical256: { min: 6 * 256, max: 10 * 256 },
        spellDamage: null,
      }
      const bs1H = computeCombatStats(makeCombatInput(arm1H, bsSkill))
      const bs2H = computeCombatStats(makeCombatInput(arm2H, bsSkill))
      expect(bs2H.left.damage.physMin).toBeLessThan(bs1H.left.damage.physMin)
      expect(bs2H.left.damage.physMax).toBeLessThan(bs1H.left.damage.physMax)
      expect(bs2H.left.formulaBreakdown.srcDam).toBe(24)

      // #266 Blade Fury: SrcDam=96 (3/4 1H, 3/8 2H via Half2HSrc=1), descdam=24 adds flat skill phys at 100% unscaled!
      const bfNoFlat: CombatSkillInput = {
        id: 266,
        level: 1,
        weapSel: 0,
        kick: false,
        srcDam: 96,
        itypeA1: '',
        itypeA1IsThrown: false,
        range: 'none',
        toHitPercent: 0,
        damagePercent: 0,
        skillPhysical256: { min: 0, max: 0 },
        spellDamage: null,
      }
      const bfWithFlat: CombatSkillInput = {
        ...bfNoFlat,
        skillPhysical256: { min: 8 * 256, max: 10 * 256 },
      }
      const bf1HNo = computeCombatStats(makeCombatInput(arm1H, bfNoFlat))
      const bf1HWith = computeCombatStats(makeCombatInput(arm1H, bfWithFlat))
      const bf2HNo = computeCombatStats(makeCombatInput(arm2H, bfNoFlat))
      const bf2HWith = computeCombatStats(makeCombatInput(arm2H, bfWithFlat))
      expect(bf1HWith.left.damage.physMin - bf1HNo.left.damage.physMin).toBe(8)
      expect(bf1HWith.left.damage.physMax - bf1HNo.left.damage.physMax).toBe(10)
      expect(bf2HWith.left.damage.physMin - bf2HNo.left.damage.physMin).toBe(8)
      expect(bf2HWith.left.damage.physMax - bf2HNo.left.damage.physMax).toBe(10)
      expect(bf2HWith.left.formulaBreakdown.srcDam).toBe(48)

      // #277 Blade Shield: SrcDam=32 (1/4), Half2HSrc=0 -> identical for 1H and 2H
      const bshSkill: CombatSkillInput = {
        id: 277,
        level: 1,
        weapSel: 0,
        kick: false,
        srcDam: 32,
        itypeA1: '',
        itypeA1IsThrown: false,
        range: 'none',
        toHitPercent: 0,
        damagePercent: 0,
        skillPhysical256: { min: 1 * 256, max: 30 * 256 },
        spellDamage: null,
      }
      const bsh1H = computeCombatStats(makeCombatInput(arm1H, bshSkill))
      const bsh2H = computeCombatStats(makeCombatInput(arm2H, bshSkill))
      expect(bsh2H.left.damage.physMin).toBe(bsh1H.left.damage.physMin)
      expect(bsh2H.left.damage.physMax).toBe(bsh1H.left.damage.physMax)
      expect(bsh2H.left.formulaBreakdown.srcDam).toBe(32)
    })

    it('configures missiles-data.ts for sentrychargedbolt (#495), sentrylightningbolt (#526), mana costs, and cooldowns', () => {
      const scb = getMissileTxtData('sentrychargedbolt')
      expect(scb.id).toBe(495)
      expect(scb.vel).toBe(12)
      expect(scb.maxVel).toBe(12)
      expect(scb.range).toBe(98)

      const slb = getMissileTxtData('sentrylightningbolt')
      expect(slb.id).toBe(526)
      expect(slb.pierce).toBeUndefined()
      expect(CANONICAL_113C_MISSILES['sentrylightningbolt']?.pierce).toBeUndefined()

      // 1.13c mana costs
      expect(getSkillManaCost(251, 1)).toBe(3)
      expect(getSkillManaCost(251, 10)).toBe(4.125)
      expect(getSkillManaCost(256, 1)).toBe(6)
      expect(getSkillManaCost(257, 1)).toBe(7)
      expect(getSkillManaCost(261, 1)).toBe(13)
      expect(getSkillManaCost(262, 1)).toBe(13)
      expect(getSkillManaCost(266, 1)).toBe(1)
      expect(getSkillManaCost(266, 9)).toBe(2)
      expect(getSkillManaCost(271, 1)).toBe(20)
      expect(getSkillManaCost(272, 1)).toBe(20)
      expect(getSkillManaCost(276, 1)).toBe(20)
      expect(getSkillManaCost(277, 1)).toBe(27)
      expect(getSkillManaCost(277, 10)).toBe(45)

      // 1.13c cooldown ticks
      expect(getSkillCooldownTicks(256)).toBe(15)
      expect(getSkillCooldownTicks(257)).toBe(50)
      for (const id of [251, 261, 262, 266, 271, 272, 276, 277]) {
        expect(getSkillCooldownTicks(id)).toBe(0)
      }
    })
  })

  describe('Layer 2: assassin-traps.ts, summon-manager.ts, aura-scanner.ts, and registry.ts', () => {
    it('computes exact 1.13c 5-tier curves and synergies in assassin-traps.ts', () => {
      // #251 Fire Blast
      const fb1 = calcFireBlast113c(1, {})
      expect(fb1.minDmg).toBe(3)
      expect(fb1.maxDmg).toBe(4)
      const fb1Syn = calcFireBlast113c(1, { shockWebBlvl: 10, chargedBoltSentryBlvl: 10 }) // +180%
      expect(fb1Syn.minDmg).toBe(Math.floor((3 * 280) / 100))

      // #256 Shock Web spike count: 6 + floor(slvl/4) + floor(FB_blvl/3)
      expect(computeShockWebSpikeCount(1, 0)).toBe(6)
      expect(computeShockWebSpikeCount(4, 0)).toBe(7)
      expect(computeShockWebSpikeCount(4, 6)).toBe(9)
      expect(calcShockWeb113c(4, { fireBlastBlvl: 6 }).spikeCount).toBe(9)

      // #257 Blade Sentinel: 1H SrcDam=48, 2H SrcDam=24, Range=100, NextDelay=25
      expect(calcBladeSentinel113c(1, 40, 80, false).effectiveSrcDam).toBe(48)
      expect(calcBladeSentinel113c(1, 40, 80, true).effectiveSrcDam).toBe(24)
      expect(calcBladeSentinel113c(1, 40, 80, false).rangeFrames).toBe(100)
      expect(calcBladeSentinel113c(1, 40, 80, false).nextDelayFrames).toBe(25)

      // #261 Charged Bolt Sentry: bolts = 5 + floor(SW_blvl/3), shots = 5 + floor(LS_blvl/4)
      const cbs = calcChargedBoltSentry113c(1, { shockWebBlvl: 9, lightningSentryBlvl: 8 })
      expect(cbs.boltsPerShot).toBe(8)
      expect(cbs.totalShots).toBe(7)

      // #262 Wake of Fire: shots = 5 + floor(FB_blvl/3)
      const wof = calcWakeOfFire113c(1, { fireBlastBlvl: 9 })
      expect(wof.totalShots).toBe(8)

      // #266 Blade Fury: 1H SrcDam=96, 2H SrcDam=48
      expect(calcBladeFury113c(1, 40, 80, false).effectiveSrcDam).toBe(96)
      expect(calcBladeFury113c(1, 40, 80, true).effectiveSrcDam).toBe(48)

      // #271 Lightning Sentry: 10 shots, +12% per blvl in #256, #261, #276
      const ls = calcLightningSentry113c(1, { shockWebBlvl: 5, chargedBoltSentryBlvl: 5 })
      expect(ls.totalShots).toBe(10)
      expect(ls.synPct).toBe(120)

      // #272 Wake of Inferno: +10% from #251 & #276, +7% from #262
      const woi = calcWakeOfInferno113c(1, { fireBlastBlvl: 5, wakeOfFireBlvl: 5, deathSentryBlvl: 5 })
      expect(woi.synPct).toBe(50 + 35 + 50)

      // #276 Death Sentry: shots = 5 + floor(FB_blvl/3), +12% from #271
      const ds = calcDeathSentry113c(1, { fireBlastBlvl: 6, lightningSentryBlvl: 10 })
      expect(ds.totalShots).toBe(7)
      expect(ds.synPct).toBe(120)

      // #277 Blade Shield: SrcDam=32, duration=500 + 125*(slvl-1), perdelay=25, radius=aurarangecalc par4=6 (Skills.txt #277)
      const bsh = calcBladeShield113c(1, 40, 80)
      expect(bsh.effectiveSrcDam).toBe(32)
      expect(bsh.durationFrames).toBe(500)
      expect(bsh.perDelayFrames).toBe(25)
      expect(bsh.radiusSubtiles).toBe(6)
    })

    it('enforces all 5 SummonManager.tickPets sentry trap fixes + #257 non-eviction + sentry owner isolation', async () => {
      const registry = await getSharedDataRegistry()
      const summonManager = new SummonManager(registry)
      const missileEngine = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)
      const ownerStats = new UnitStatList(registry, {
        level: 50,
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 1000 * FIXED_ONE,
        passive_fire_mastery: 100,
        passive_ltng_mastery: 100,
        passive_fire_pierce: 50,
        passive_ltng_pierce: 50,
      })
      ownerStats.setBaseSkillLevel(251, 9) // Fire Blast blvl 9 -> +3 shots to #262 & #276, +3 spikes to #256
      ownerStats.setBaseSkillLevel(256, 6) // Shock Web blvl 6 -> +2 bolts per shot to #261
      ownerStats.setBaseSkillLevel(271, 8) // Lightning Sentry blvl 8 -> +2 shots to #261
      const ownerStateBus = new StateBus(ownerStats, registry)

      const owner = {
        id: 'player-ass',
        name: 'Ass',
        unitType: 'player' as const,
        statList: ownerStats,
        stateBus: ownerStateBus,
        x: 50,
        y: 50,
      }

      // Summon 5 ground sentries: #261, #262, #271, #272, #276
      const s261 = summonManager.createPet({ owner, skillId: 261, slvl: 10, x: 50, y: 50 }).pet!
      const s262 = summonManager.createPet({ owner, skillId: 262, slvl: 10, x: 51, y: 50 }).pet!
      const s271 = summonManager.createPet({ owner, skillId: 271, slvl: 10, x: 52, y: 50 }).pet!
      const s272 = summonManager.createPet({ owner, skillId: 272, slvl: 10, x: 53, y: 50 }).pet!
      const s276 = summonManager.createPet({ owner, skillId: 276, slvl: 10, x: 54, y: 50 }).pet!

      // Check initial shot counts with synergies
      expect(s261.shotsRemaining).toBe(5 + Math.floor(8 / 4)) // 7 shots
      expect(s262.shotsRemaining).toBe(5 + Math.floor(9 / 3)) // 8 shots
      expect(s271.shotsRemaining).toBe(10)
      expect(s272.shotsRemaining).toBe(10)
      expect(s276.shotsRemaining).toBe(5 + Math.floor(9 / 3)) // 8 shots

      // Casting #257 Blade Sentinel must NOT evict any of the 5 ground sentries
      summonManager.createPet({ owner, skillId: 257, slvl: 5, x: 55, y: 50 })
      const activeTrapIds = summonManager
        .getActivePets()
        .filter((p) => p.petType === 'assassintrap')
        .map((p) => p.sourceSkillId)
      expect(activeTrapIds).toEqual([261, 262, 271, 272, 276])

      // Create a living enemy AND a corpse in range of #276 Death Sentry
      const enemyStats = new UnitStatList(registry, {
        level: 50,
        maxhp: 5000 * FIXED_ONE,
        hitpoints: 5000 * FIXED_ONE,
      })
      const livingEnemy = {
        id: 'enemy-1',
        name: 'Target',
        unitType: 'monster' as const,
        statList: enemyStats,
        stateBus: new StateBus(enemyStats, registry),
        x: 56,
        y: 50,
      }
      const corpses = [{ id: 'corpse-1', consumed: false, baseMaxHp: 1000, x: 55, y: 50 }]

      const shots276Before = s276.shotsRemaining
      summonManager.tickPets({
        currentTick: 25,
        owner,
        enemies: [livingEnemy],
        enemyPositions: new Map([[livingEnemy.id, { x: 56, y: 50 }]]),
        corpses,
        missileEngine,
        auraScanner,
      })

      // #276 Death Sentry must consume the corpse, decrement shotsRemaining ONCE (8 -> 7), and NOT also fire #324 lightning on the same tick!
      expect(corpses[0]!.consumed).toBe(true)
      expect(s276.shotsRemaining).toBe(shots276Before - 1)
      const activeMissiles = missileEngine.getActiveMissiles()
      expect(activeMissiles.some((m) => m.sourceSkillId === 276)).toBe(false)

      // #261 Charged Bolt Sentry must fire 5 + floor(6 / 3) = 7 'sentrychargedbolt' missiles
      const cbsMissiles = activeMissiles.filter(
        (m) => m.sourceSkillId === 261 && m.name === 'sentrychargedbolt',
      )
      expect(cbsMissiles).toHaveLength(7)

      // #262 Wake of Fire must fire 'wake of destruction maker' and 'wake of destruction' with nextDelayFrames = 4
      const wofMissiles = activeMissiles.filter((m) => m.sourceSkillId === 262)
      expect(wofMissiles.some((m) => m.name === 'wake of destruction maker')).toBe(true)
      expect(
        wofMissiles.some((m) => m.name === 'wake of destruction' && m.nextDelayFrames === 4),
      ).toBe(true)

      // Sentry owner isolation: sentry missiles must have their own minion CombatUnitContext (0% mastery/pierce), NOT the player's +100% mastery!
      for (const m of activeMissiles) {
        expect(m.owner.id).not.toBe(owner.id)
        expect(m.owner.statList.getAccruedStat('passive_fire_mastery')).toBe(0)
        expect(m.owner.statList.getAccruedStat('passive_ltng_mastery')).toBe(0)
        expect(m.owner.statList.getAccruedStat('passive_fire_pierce')).toBe(0)
        expect(m.owner.statList.getAccruedStat('passive_ltng_pierce')).toBe(0)
      }
    })

    it('evaluates #257 Blade Sentinel, #256 Shock Web, #266 Blade Fury (Half2HSrc), and #277 Blade Shield (AuraScanner 25f pulse) in registry.ts', async () => {
      const registry = await getSharedDataRegistry()

      // #257 Blade Sentinel is treated as a missile skill (not melee swing)
      const arena257 = new WorldArena({
        registry,
        classCode: 'ass',
        skillId: 257,
        slvl: 10,
      })
      const res257 = arena257.triggerCast()
      expect(res257.executed).toBe(true)
      expect(res257.missilesSpawned.length).toBeGreaterThan(0)

      // #266 Blade Fury halves weapon SrcDam when wielding a 2H weapon (96 -> 48), while flat skill physical damage is unscaled
      const skill266 = registry.getSkillById(266)!
      const stats1H = new UnitStatList(registry, { level: 50, maxmana: 500 * FIXED_ONE, mana: 500 * FIXED_ONE })
      const sb1H = new StateBus(stats1H, registry)
      const eval266 = evaluateSkill113c({
        registry,
        skill: skill266,
        slvl: 10,
        blvl: 10,
        statList: stats1H,
        stateBus: sb1H,
      })
      const caster1H = {
        id: 'ass-1h',
        name: 'Ass1H',
        statList: stats1H,
        stateBus: sb1H,
        weaponMinPhys: 100,
        weaponMaxPhys: 100,
        isTwoHandedWeapon: false,
      }
      const caster2H = {
        ...caster1H,
        id: 'ass-2h',
        isTwoHandedWeapon: true,
      }
      const mm1H = new MissileEngine(registry)
      const mm2H = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)
      const summonManager = new SummonManager(registry)
      executeSkill113c({
        registry,
        skill: skill266,
        evalResult: eval266,
        caster: caster1H,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: mm1H,
        auraScanner,
        summonManager,
        currentTick: 1,
        targetX: 60,
        targetY: 50,
      })
      executeSkill113c({
        registry,
        skill: skill266,
        evalResult: eval266,
        caster: caster2H,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: mm2H,
        auraScanner,
        summonManager,
        currentTick: 1,
        targetX: 60,
        targetY: 50,
      })
      const m1H = mm1H.getActiveMissiles()[0]!
      const m2H = mm2H.getActiveMissiles()[0]!
      expect(m1H.dmgPacket.srcDam).toBe(96)
      expect(m2H.dmgPacket.srcDam).toBe(48)
      expect(m1H.dmgPacket.flatPhysMin256).toBe(m2H.dmgPacket.flatPhysMin256)

      // #277 Blade Shield registers on AuraScanner and pulses every 25 frames over radius 4 sub-tiles
      const skill277 = registry.getSkillById(277)!
      const eval277 = evaluateSkill113c({
        registry,
        skill: skill277,
        slvl: 10,
        blvl: 10,
        statList: stats1H,
        stateBus: sb1H,
      })
      const bshCaster = {
        ...caster1H,
        x: 50,
        y: 50,
      }
      const nearEnemyStats = new UnitStatList(registry, {
        level: 50,
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 1000 * FIXED_ONE,
      })
      const nearEnemy = {
        id: 'near-enemy',
        name: 'Near',
        unitType: 'monster' as const,
        statList: nearEnemyStats,
        stateBus: new StateBus(nearEnemyStats, registry),
        x: 53,
        y: 50,
      }
      executeSkill113c({
        registry,
        skill: skill277,
        evalResult: eval277,
        caster: bshCaster,
        targets: [nearEnemy],
        targetPositions: new Map([['near-enemy', { x: 53, y: 50 }]]),
        corpses: [],
        missileEngine: mm1H,
        auraScanner,
        summonManager,
        currentTick: 0,
        targetX: 50,
        targetY: 50,
      })
      const hpAfterCast = nearEnemyStats.getHp256()
      // At tick 10 (not a multiple of 25), no periodic pulse
      auraScanner.tick(10, [bshCaster], [nearEnemy])
      expect(nearEnemyStats.getHp256()).toBe(hpAfterCast)
      // At tick 25 (perdelay=25), periodic pulse damages nearEnemy
      auraScanner.tick(25, [bshCaster], [nearEnemy])
      expect(nearEnemyStats.getHp256()).toBeLessThan(hpAfterCast)
    })
  })

  describe('Layer 3: Scene Skill Caster (skill-caster.ts)', () => {
    function makeMockSceneEngine() {
      const monster = {
        index: 0,
        id: 1,
        x: 220,
        y: 200,
        hp: 1000,
        maxHp: 1000,
        alive: true,
        state: 'idle',
        stats: { id: 'zombie1', name: 'Zombie', hp: 1000 },
      } as any
      const engine = {
        world: {
          tick: 1,
          player: {
            x: 200,
            y: 200,
            hp: 500,
            maxHp: 500,
            mana: 500,
            maxMana: 500,
            level: 40,
            cooldown: 0,
            swingTicks: 0,
            charClass: 'ass',
            skillLevels: {
              251: 6,
              256: 6,
              257: 5,
              261: 5,
              262: 5,
              266: 5,
              271: 8,
              272: 5,
              276: 5,
              277: 5,
            },
            baseSkillLevels: {
              251: 6,
              256: 6,
              257: 5,
              261: 5,
              262: 5,
              266: 5,
              271: 8,
              272: 5,
              276: 5,
              277: 5,
            },
          } as any,
          monsters: [monster],
          events: [],
        },
        projectiles: [] as any[],
        explosions: [],
        overlays: [] as any[],
        metrics: { casts: 0, playerHits: 0, castHits: 0, pickups: 0, inventoryRefusals: 0 },
        spawnOverlay: (token: string, pos: { x: number; y: number }) => {
          engine.overlays.push({ token, x: pos.x, y: pos.y })
        },
      } as any
      return { engine, monster }
    }

    it('handles all 10 Assassin Traps skills authoritatively in castSkill', () => {
      const { engine } = makeMockSceneEngine()
      const status = { textContent: null as string | null }
      const runtime = { level: 'Blood Moor', levelId: 2, act: 1, grid: {} as any }

      // 1. Place 6 ground sentries (#261, #262, #271, #272, #276, #271) -> shared 5-trap cap evicts oldest
      for (const id of [261, 262, 271, 272, 276, 271]) {
        engine.world.player.cooldown = 0
        expect(castSkill(id, 240, 200, { engine, runtime, hudManager: null, status })).toBe(true)
        expect(engine.world.player.cooldown).toBe(0)
      }
      expect(engine.world.player.summons).toHaveLength(5)
      expect(engine.world.player.summons[0].skillId).toBe(262) // 261 was evicted

      // 2. #251 Fire Blast: no cooldown (0), 3 sub-tiles impact explosion (aoeRadius=60)
      engine.projectiles.length = 0
      expect(castSkill(251, 240, 200, { engine, runtime, hudManager: null, status })).toBe(true)
      expect(engine.world.player.cooldown).toBe(0)
      expect(engine.projectiles[0]?.missileType).toBe('bomb in air')
      expect(engine.projectiles[0]?.aoeRadius).toBe(60)

      // 3. #256 Shock Web: 15-frame cooldown, multi-spike scatter (6 + floor(6/4) + floor(6/3) = 9 spikes)
      engine.projectiles.length = 0
      expect(castSkill(256, 240, 200, { engine, runtime, hudManager: null, status })).toBe(true)
      expect(engine.world.player.cooldown).toBe(15)
      expect(engine.projectiles).toHaveLength(9)
      expect(engine.projectiles[0]?.nextDelay).toBe(25)

      // 4. #257 Blade Sentinel: 50-frame cooldown, Range=100 frames, NextDelay=25 frames, patrol metadata, does NOT evict ground sentries
      engine.world.player.cooldown = 0
      engine.projectiles.length = 0
      expect(castSkill(257, 240, 200, { engine, runtime, hudManager: null, status })).toBe(true)
      expect(engine.world.player.cooldown).toBe(50)
      expect(engine.world.player.summons.filter((s: any) => s.petType === 'assassintrap')).toHaveLength(5)
      expect(engine.projectiles).toHaveLength(1)
      expect(engine.projectiles[0]?.ttl).toBe(100)
      expect(engine.projectiles[0]?.nextDelay).toBe(25)
      expect(engine.projectiles[0]?.isPatrol).toBe(true)

      // 5. #266 Blade Fury: single stream shuriken ('bladefragment1' per srvmissilea), no cooldown (0)
      engine.world.player.cooldown = 0
      engine.projectiles.length = 0
      expect(castSkill(266, 240, 200, { engine, runtime, hudManager: null, status })).toBe(true)
      expect(engine.world.player.cooldown).toBe(0)
      expect(engine.projectiles).toHaveLength(1)
      expect(engine.projectiles[0]?.missileType).toBe('bladefragment1')

      // 6. #277 Blade Shield: buff state + 25-frame periodic pulse, no fake 'blade_shield_cast' missile
      engine.world.player.cooldown = 0
      engine.projectiles.length = 0
      expect(castSkill(277, 200, 200, { engine, runtime, hudManager: null, status })).toBe(true)
      expect(engine.projectiles).toHaveLength(0)
      expect(engine.world.player.bladeShieldTicks).toBe(500 + 4 * 125)
      expect(engine.world.player.bladeShieldPerDelayFrames).toBe(25)
    })
  })

  describe('Layer 4: Client World Missiles (world-skill-missiles.ts)', () => {
    it('assigns 1.13c MonStats hcIdx for trap sentries (#261=411, #262=410, #271=412, #272=415, #276=416) with 0 cast-time missiles and fires via sub-skills', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 6, name: 'Ass', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!
      caster.stats.set(256, 6) // Shock Web blvl 6 -> 5 + 2 = 7 sentrychargedbolt bolts

      // #261..#276 trap placement spawns ONLY the sentry monster with 1.13c MonStats.txt hcIdx and 0 missiles on cast frame
      ;(world as any).spawnMissilesForSkill(caster, 261, 110, 100, 5)
      ;(world as any).spawnMissilesForSkill(caster, 262, 112, 100, 5)
      ;(world as any).spawnMissilesForSkill(caster, 271, 114, 100, 5)
      ;(world as any).spawnMissilesForSkill(caster, 272, 118, 100, 5)
      ;(world as any).spawnMissilesForSkill(caster, 276, 116, 100, 5)

      const trap261 = Array.from(world.monsters.values()).find((m) => m.classId === 411)
      const trap262 = Array.from(world.monsters.values()).find((m) => m.classId === 410)
      const trap271 = Array.from(world.monsters.values()).find((m) => m.classId === 412)
      const trap272 = Array.from(world.monsters.values()).find((m) => m.classId === 415)
      const trap276 = Array.from(world.monsters.values()).find((m) => m.classId === 416)
      expect(trap261).toBeDefined()
      expect(trap262).toBeDefined()
      expect(trap271).toBeDefined()
      expect(trap272).toBeDefined()
      expect(trap276).toBeDefined()
      expect(Array.from(world.units.values()).filter((u) => u.unitType === 'missile')).toHaveLength(0)

      // Sub-skill #306 BoltSentry -> 7 'sentrychargedbolt' bolts
      ;(world as any).spawnMissilesForSkill(trap261!, 306, 120, 100, 5)
      const bolts261 = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'sentrychargedbolt',
      )
      expect(bolts261).toHaveLength(7)

      // Sub-skill #313 sentry lightning & #324 death sentry ltng -> piercing 'sentrylightningbolt' / 'sentrylightningbolt2'
      ;(world as any).spawnMissilesForSkill(trap271!, 313, 124, 100, 5)
      ;(world as any).spawnMissilesForSkill(trap276!, 324, 126, 100, 5)
      const slbMissiles = Array.from(world.units.values()).filter(
        (u) =>
          u.unitType === 'missile' &&
          (u.missileKey === 'sentrylightningbolt' || u.missileKey === 'sentrylightningbolt2'),
      )
      expect(slbMissiles).toHaveLength(2)
      expect(slbMissiles.every((m) => m.pierce === true)).toBe(true)

      // Sub-skill #311 mon inferno sentry -> 'inferno sentry 1' + 'inferno sentry 2'
      ;(world as any).spawnMissilesForSkill(trap272!, 311, 128, 100, 5)
      const infMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'inferno sentry 1',
      )
      expect(infMissiles).toHaveLength(1)

      // #266 Blade Fury -> single stream 'bladefragment2' (cltmissilea per CltDo6, not bladefury1 or 3-way fan)
      ;(world as any).spawnMissilesForSkill(caster, 266, 120, 100, 5)
      const bfMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'bladefragment2',
      )
      expect(bfMissiles).toHaveLength(1)
      expect(
        Array.from(world.units.values()).filter(
          (u) => u.unitType === 'missile' && u.missileKey === 'bladefury1',
        ),
      ).toHaveLength(0)

      // #277 Blade Shield -> state 158 + 'blade shield attachment' (#553) on caster
      ;(world as any).spawnMissilesForSkill(caster, 277, 100, 100, 5)
      const bsAttachments = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'blade shield attachment',
      )
      expect(caster.states.has(158)).toBe(true)
      expect(bsAttachments).toHaveLength(1)
    })
  })
})

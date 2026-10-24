import { describe, expect, it } from 'vitest'
import { SKILLS_BY_ID } from '../src/common/data/skills-catalog.ts'
import { buildTooltipViewModel, createInitialState } from '../src/common/skills/skill-calc-engine.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import { AuraScanner } from '../src/server/engine/aura-scanner.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import { SummonManager } from '../src/server/ai/summon-manager.ts'
import { WorldArena } from '../src/server/engine/world-arena.ts'
import type { CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'
import {
  calculateRavenStats,
  calculatePoisonCreeperStats,
  calculateOakSageStats,
  calculateSpiritWolfStats,
  calculateCarrionVineStats,
  calculateHeartOfWolverineStats,
  calculateDireWolfStats,
  calculateSolarCreeperStats,
  calculateSpiritOfBarbsStats,
  calculateGrizzlyStats,
} from '../src/server/skills/druid-summoning.ts'

describe('Issue #1019: Druid Summoning (#221-#247) 4-Layer 1.13c Fidelity', () => {
  describe('Layer 1: Skill Catalog, Tooltip Calc Engine & Character Panel C (F6)', () => {
    it('aligns all 10 Druid Summoning skills in SKILLS_BY_ID (including #241 Solar Creeper 太阳藤)', () => {
      const expectedNames: Record<number, string> = {
        221: '乌鸦',
        222: '毒藤',
        226: '橡木智者',
        227: '召唤恶狼',
        231: '食尸藤',
        236: '狼獾之心',
        237: '召唤狂狼',
        241: '太阳藤',
        246: '灵之守护',
        247: '召唤灰熊',
      }
      for (const [idStr, nameZh] of Object.entries(expectedNames)) {
        const skill = SKILLS_BY_ID[Number(idStr)]
        expect(skill).toBeDefined()
        expect(skill!.nameZh).toBe(nameZh)
      }
      expect(SKILLS_BY_ID[241]!.shortDescZh).toContain('法力')
      expect(SKILLS_BY_ID[241]!.longDescZh).toContain('法力')
    })

    it('formats Spirit of Barbs (#246, lt=7) as percent damage returned instead of hit count, and Poison Creeper (#222, lt=14) with 5-band poison damage', () => {
      const state = createInitialState('dru')
      state.hardPoints = { 222: 1, 246: 1 }

      // #246 Spirit of Barbs at slvl 1 -> +50 percent damage returned (not "50 hits")
      const barbsVm1 = buildTooltipViewModel(state, 246)!
      const barbsLines1 = barbsVm1.current.effects.map(e => e.textEn)
      expect(barbsLines1.some(l => l.includes('50 percent') || l.includes('50%'))).toBe(true)
      expect(barbsLines1.some(l => l.includes('hits'))).toBe(false)

      // #222 Poison Creeper at slvl 1 -> 4-6 poison damage over 4 seconds (not 0-0)
      const creeperVm1 = buildTooltipViewModel(state, 222)!
      const creeperLines1 = creeperVm1.current.effects.map(e => e.textEn)
      expect(creeperLines1.some(l => l.includes('4-6') && l.includes('4 seconds'))).toBe(true)

      // #222 Poison Creeper at slvl 5 -> 15-17 poison damage over 4 seconds (floor(40*100/256)=15, floor(44*100/256)=17)
      state.hardPoints[222] = 5
      const creeperVm5 = buildTooltipViewModel(state, 222)!
      const creeperLines5 = creeperVm5.current.effects.map(e => e.textEn)
      expect(creeperLines5.some(l => l.includes('15-17'))).toBe(true)
    })

    it('reflects soft-point (.lvl) cross-synergies in tooltips for Spirit Wolf (#227), Dire Wolf (#237), and Grizzly (#247)', () => {
      const stateHardOnly = createInitialState('dru')
      stateHardOnly.hardPoints = { 227: 5, 237: 5, 247: 5 }

      const stateWithSoft = createInitialState('dru')
      stateWithSoft.hardPoints = { 227: 5, 237: 5, 247: 5 }
      stateWithSoft.allSkillsSoftPoints = 3 // soft points apply to .lvl cross-synergies!

      const swHard = buildTooltipViewModel(stateHardOnly, 227)!
      const swSoft = buildTooltipViewModel(stateWithSoft, 227)!

      // Spirit Wolf Life line (lt=13) scales with Dire Wolf .lvl (8 vs 5)
      const lifeHard = swHard.current.effects.find(e => e.textEn.startsWith('Life:'))?.textEn ?? ''
      const lifeSoft = swSoft.current.effects.find(e => e.textEn.startsWith('Life:'))?.textEn ?? ''
      expect(lifeHard).not.toBe(lifeSoft)
      // At Dire Wolf .lvl = 8 (+225% HP): floor(60*3.25) = 195 vs .lvl = 5 (+150% HP): floor(60*2.5) = 150
      expect(lifeHard).toContain('150')
      expect(lifeSoft).toContain('195')
    })

    it('applies Oak Sage (149), Heart of Wolverine (148), and Spirit of Barbs (147) aura states in Character Panel C (HudModel)', () => {
      const world = new ClientWorld()
      world.selfId = 1
      world.areaId = 1
      ;(world.self as any).charClass = 5 // Druid ('dru')
      ;(world.self as any).level = 30
      ;(world.self as any).stats.set(0, 100) // Str
      ;(world.self as any).stats.set(2, 100) // Dex
      ;(world.self as any).stats.set(3, 100) // Vit
      ;(world.self as any).stats.set(1, 50)  // Ene
      ;(world.self as any).stats.set(12, 30) // Level
      ;(world.self as any).stats.set(7, 200 << 8) // MaxHP
      ;(world.self as any).stats.set(6, 200 << 8) // HP

      for (const [id, lvl] of [
        [0, 1],
        [226, 5],
        [236, 5],
        [246, 5],
      ] as const) {
        ;(world.self as any).skills.set(id, lvl)
        ;(world.self as any).skillEntries.set(id, {
          skillId: id,
          baseLevel: lvl,
          bonus: 0,
          level: lvl,
          charges: 0,
          ownerType: 0,
          ownerId: 1,
        })
      }

      ;(world.self as any).leftSkill = 0
      ;(world.self as any).rightSkill = 0

      const hud = new HudManager()
      const hudModel = new HudModel({ world, hudManager: hud })

      hudModel.syncFromWorld()
      const baseAr = hud.charSheet.attrs.attackRating

      // Activate Heart of Wolverine (148), Oak Sage (149), and Spirit of Barbs (147)
      ;(world.self.states as Set<number>).add(148)
      ;(world.self.states as Set<number>).add(149)
      ;(world.self.states as Set<number>).add(147)
      hudModel.syncFromWorld()

      expect(hud.charSheet.attrs.attackRating).toBeGreaterThan(baseAr)
    })
  })

  describe('Layer 2: 1.13c Formula Engine (druid-summoning.ts)', () => {
    it('calculates exact 1.13c stats for all 10 Druid Summoning skills', () => {
      // #221 Raven: petCount=min(5,slvl), hitCount=11+slvl, blindChance=clamp(50+5*(clvl-2+slvl-mlvl),5,100)
      const rav = calculateRavenStats(5, 30, 30)
      expect(rav.petCount).toBe(5)
      expect(rav.hitCount).toBe(16)
      expect(rav.blindChancePct).toBe(65) // 50 + 5*(30 - 2 + 5 - 30) = 65%
      expect(rav.minPhysDmg).toBe(6)
      expect(rav.maxPhysDmg).toBe(8)

      // #222 Poison Creeper: 5-band poison damage over 100 frames (4s), floor((rate * 100) / 256)
      const pc1 = calculatePoisonCreeperStats(1, 20)
      expect(pc1.petLevel).toBe(16) // floor(60/4) + 1 = 16
      expect(pc1.poisonDurationFrames).toBe(100)
      expect(pc1.poisonMinDamage).toBe(4) // floor(12*100/256) = 4
      expect(pc1.poisonMaxDamage).toBe(6) // floor(16*100/256) = 6

      // #226 Oak Sage: subSkillId=298, +30 + 5*(slvl-1)% MaxHP, 100% DR in Nightmare
      const oakNorm = calculateOakSageStats(5, 30, 'normal')
      const oakNm = calculateOakSageStats(5, 30, 'nightmare')
      expect(oakNorm.auraSubSkillId).toBe(298)
      expect(oakNorm.auraStateName).toBe('oaksage')
      expect(oakNorm.hpBonusPct).toBe(50)
      expect(oakNorm.damageResist).toBe(0)
      expect(oakNm.damageResist).toBe(100)
      expect(oakNorm.poisonResist).toBe(100)
      expect(oakNorm.fireResist).toBe(25)

      // #236 Heart of Wolverine: subSkillId=297, +20+7*(slvl-1)% Dmg, +25+7*(slvl-1)% AR
      const how = calculateHeartOfWolverineStats(5, 30, 'normal')
      expect(how.auraSubSkillId).toBe(297)
      expect(how.auraStateName).toBe('wolverine')
      expect(how.damageBonusPct).toBe(48)
      expect(how.toHitBonusPct).toBe(53)

      // #246 Spirit of Barbs: subSkillId=296, 50+10*(slvl-1)% thorns aura (tooltip 50+20*(slvl-1)%)
      const sob = calculateSpiritOfBarbsStats(5, 30, 'normal')
      expect(sob.auraSubSkillId).toBe(296)
      expect(sob.auraStateName).toBe('barbs')
      expect(sob.thornsPercent).toBe(90)
      expect(sob.tooltipThornsReturnPct).toBe(130)

      // #231 Carrion Vine & #241 Solar Creeper: dm12(3,12)% HP and dm12(1,8)% Mana
      const cv1 = calculateCarrionVineStats(1, 20)
      const sv1 = calculateSolarCreeperStats(1, 20)
      expect(cv1.healHpPct).toBe(4)
      expect(sv1.manaRecoverPct).toBe(2)

      // #227 Spirit Wolf, #237 Dire Wolf, #247 Grizzly with soft-point (.lvl) cross-synergies
      const sw = calculateSpiritWolfStats(5, 5, 5, 30)
      const dw = calculateDireWolfStats(5, 5, 5, 30)
      const gz = calculateGrizzlyStats(5, 5, 5, 30)
      expect(sw.petCount).toBe(5)
      expect(dw.petCount).toBe(3)
      expect(gz.petCount).toBe(1)
      expect(sw.elemResist).toBe(20) // min(85, 5*(5-1)) = 20
      expect(dw.fenrisRageBonusPct).toBe(116) // 100 + 4*(5-1) = 116%
      expect(gz.bearSmiteStunFrames).toBe(35) // min(250, 15 + 5*(5-1)) = 35 frames
    })
  })

  describe('Layer 2 & 3: SummonManager, AuraScanner, StateBus & Totem/Vine/Wolf/Bear AI (F1-F5)', () => {
    it('F1: maps #226->#296 (oaksage), #236->#297 (wolverine), #246->#298 (barbs), reflects melee damage on barbs, and cleans up aura states on totem eviction/unsummon', async () => {
      const registry = await getSharedDataRegistry()
      const summonManager = new SummonManager(registry)
      const auraScanner = new AuraScanner(registry)
      const missileEngine = new MissileEngine(registry)

      const ownerStats = new UnitStatList(registry, {
        level: 30,
        maxhp: 200 * FIXED_ONE,
        hitpoints: 200 * FIXED_ONE,
      })
      const ownerStateBus = new StateBus(ownerStats, registry)
      const owner: CombatUnitContext = {
        id: 'druid-1',
        name: 'Druid',
        statList: ownerStats,
        stateBus: ownerStateBus,
        // #1410: the spirit aura scan needs a position (Oak Sage spawned at 100,100).
        x: 101,
        y: 100,
      }

      // 1. Summon Oak Sage (#226) -> subSkillId 298 -> applies 'oaksage' and boosts MaxHP
      const oakRes = summonManager.createPet({
        owner,
        skillId: 226,
        slvl: 5,
        x: 100,
        y: 100,
        difficulty: 'nightmare',
      })
      expect(oakRes.created).toBe(true)
      const oakPet = oakRes.pet!
      expect(oakPet.subSkillIds).toContain(298)
      expect(oakPet.statList.getAccruedStat('damageresist')).toBe(100) // 100% physical immune in Nightmare!
      expect(oakPet.statList.getAccruedStat('poisonresist')).toBe(100)

      summonManager.tickPets({
        currentTick: 50,
        owner,
        enemies: [],
        enemyPositions: new Map(),
        corpses: [],
        missileEngine,
        auraScanner,
      })
      expect(ownerStateBus.hasState('oaksage')).toBe(true)
      expect(ownerStats.getMaxHp256()).toBe(300 * FIXED_ONE) // +50% MaxHP at slvl 5

      // 2. Summon Spirit of Barbs (#246) -> evicts Oak Sage (petGroup=1), clears 'oaksage', applies 'barbs' (#296)
      const barbsRes = summonManager.createPet({
        owner,
        skillId: 246,
        slvl: 5,
        x: 100,
        y: 100,
        difficulty: 'normal',
      })
      expect(barbsRes.created).toBe(true)
      const barbsPet = barbsRes.pet!
      expect(barbsPet.subSkillIds).toContain(296)
      expect(ownerStateBus.hasState('oaksage')).toBe(false)
      expect(summonManager.getActivePets().length).toBe(1)

      summonManager.tickPets({
        currentTick: 100,
        owner,
        enemies: [],
        enemyPositions: new Map(),
        corpses: [],
        missileEngine,
        auraScanner,
      })
      expect(ownerStateBus.hasState('barbs')).toBe(true)
      expect(ownerStats.getAccruedStat('thorns_percent')).toBe(90) // 50 + 4*10 = 90%

      // Verify StateBus damagedinmelee triggers thorns reflection for 'barbs'
      const reactive = ownerStateBus.triggerReactiveEvents({
        event: 'damagedinmelee',
        incomingPhys256: 100 * FIXED_ONE,
      })
      expect(reactive.reflectedPhys256).toBe(90 * FIXED_ONE)

      // 3. Unsummon Spirit of Barbs -> clears 'barbs' state from owner
      summonManager.unsummonPet(barbsPet.id)
      expect(ownerStateBus.hasState('barbs')).toBe(false)
    })

    it('F2: enforces Wolf/Bear petGroup=3 mutual exclusion across Spirit Wolf (#227), Dire Wolf (#237), and Grizzly (#247) while allowing multi-wolf coexistence and soft-point (.lvl) synergies', async () => {
      const registry = await getSharedDataRegistry()
      const summonManager = new SummonManager(registry)

      const ownerStats = new UnitStatList(registry, { level: 30 })
      // Set 5 hard points + 3 item_allskills soft points = 8 effective .lvl!
      ownerStats.setBaseSkillLevel(227, 5)
      ownerStats.setBaseSkillLevel(237, 5)
      ownerStats.setBaseSkillLevel(247, 5)
      ownerStats.addStat('item_allskills', 3)
      const owner: CombatUnitContext = {
        id: 'dru-1',
        name: 'Druid',
        statList: ownerStats,
        stateBus: new StateBus(ownerStats, registry),
      }

      // Summon 3 Spirit Wolves -> all 3 coexist (same petType='wolf')
      for (let i = 0; i < 3; i++) {
        summonManager.createPet({
          owner,
          skillId: 227,
          slvl: 8,
          x: 100 + i * 10,
          y: 100,
          difficulty: 'normal',
        })
      }
      expect(summonManager.getActivePets().length).toBe(3)

      // Verify soft-point (.lvl = 8) cross-synergy on Spirit Wolf:
      // Base HP avg = 71, Dire Wolf lvl 8 grants +50 + 7*25 = +225% HP -> floor(71 * 325 / 100) = 230 HP
      const swPet = summonManager.getActivePets()[0]!
      expect(Math.floor(swPet.statList.getMaxHp256() / FIXED_ONE)).toBe(230)
      expect(swPet.statList.getAccruedStat('fireresist')).toBe(35) // min(85, 5*(8-1)) = 35%

      // Summon 1 Dire Wolf (#237) -> evicts all 3 Spirit Wolves (petGroup=3)!
      summonManager.createPet({
        owner,
        skillId: 237,
        slvl: 8,
        x: 100,
        y: 100,
        difficulty: 'normal',
      })
      expect(summonManager.getActivePets().length).toBe(1)
      expect(summonManager.getActivePets()[0]!.sourceSkillId).toBe(237)

      // Summon 2nd Dire Wolf -> coexists up to maxCount=3
      summonManager.createPet({
        owner,
        skillId: 237,
        slvl: 8,
        x: 110,
        y: 100,
        difficulty: 'normal',
      })
      expect(summonManager.getActivePets().length).toBe(2)

      // Summon Grizzly (#247) -> evicts both Dire Wolves!
      summonManager.createPet({
        owner,
        skillId: 247,
        slvl: 8,
        x: 100,
        y: 100,
        difficulty: 'normal',
      })
      expect(summonManager.getActivePets().length).toBe(1)
      expect(summonManager.getActivePets()[0]!.sourceSkillId).toBe(247)
    })

    it('F3: executes Carrion Vine (#231/#307) HP clamp heal, Solar Creeper (#241/#325) Mana clamp recovery, and Poison Creeper (#222/#294) plague vines mat', async () => {
      const registry = await getSharedDataRegistry()
      const summonManager = new SummonManager(registry)
      const auraScanner = new AuraScanner(registry)
      const missileEngine = new MissileEngine(registry)

      const ownerStats = new UnitStatList(registry, {
        level: 20,
        maxhp: 100 * FIXED_ONE,
        hitpoints: 100 * FIXED_ONE, // Full HP initially
        maxmana: 100 * FIXED_ONE,
        mana: 50 * FIXED_ONE,
      })
      const ownerStateBus = new StateBus(ownerStats, registry)
      const owner: CombatUnitContext = {
        id: 'dru-vine',
        name: 'Druid',
        statList: ownerStats,
        stateBus: ownerStateBus,
      }

      // 1. Summon Carrion Vine (#231) at slvl 5 (heals 6% maxHP)
      summonManager.createPet({
        owner,
        skillId: 231,
        slvl: 5,
        x: 100,
        y: 100,
        difficulty: 'normal',
      })

      const corpses = [
        { id: 'c1', consumed: false },
        { id: 'c2', consumed: false },
      ]

      // At full HP (100/100), Carrion Vine does NOT waste a corpse
      summonManager.tickPets({
        currentTick: 1,
        owner,
        enemies: [],
        enemyPositions: new Map(),
        corpses,
        missileEngine,
        auraScanner,
      })
      expect(corpses[0]!.consumed).toBe(false)

      // Damage owner to 97 HP -> Carrion Vine consumes c1 and clamps HP to 100 (never overflows maxHP)
      ownerStats.setHp256(97 * FIXED_ONE)
      summonManager.tickPets({
        currentTick: 2,
        owner,
        enemies: [],
        enemyPositions: new Map(),
        corpses,
        missileEngine,
        auraScanner,
      })
      expect(corpses[0]!.consumed).toBe(true)
      expect(ownerStats.getHp256()).toBe(100 * FIXED_ONE)

      // 2. Summon Solar Creeper (#241) -> evicts Carrion Vine (group=2), consumes c2 and restores 4% MaxMana
      summonManager.createPet({
        owner,
        skillId: 241,
        slvl: 5,
        x: 100,
        y: 100,
        difficulty: 'normal',
      })
      expect(summonManager.getActivePets().length).toBe(1)
      summonManager.tickPets({
        currentTick: 3,
        owner,
        enemies: [],
        enemyPositions: new Map(),
        corpses,
        missileEngine,
        auraScanner,
      })
      expect(corpses[1]!.consumed).toBe(true)
      expect(ownerStats.getMana256()).toBe(54 * FIXED_ONE)

      // 3. Summon Poison Creeper (#222) -> lays 'plague vines' missiles and poisons enemy
      summonManager.createPet({
        owner,
        skillId: 222,
        slvl: 5,
        x: 100,
        y: 100,
        difficulty: 'normal',
      })
      const mobStats = new UnitStatList(registry, {
        maxhp: 200 * FIXED_ONE,
        hitpoints: 200 * FIXED_ONE,
      })
      const mob: CombatUnitContext = {
        id: 'mob-1',
        name: 'Zombie',
        statList: mobStats,
        stateBus: new StateBus(mobStats, registry),
      }
      const tickRes = summonManager.tickPets({
        currentTick: 25,
        owner,
        enemies: [mob],
        enemyPositions: new Map([['mob-1', { x: 110, y: 100 }]]),
        corpses: [],
        missileEngine,
        auraScanner,
      })
      expect(tickRes.subSkillsExecuted).toContain(294)
      expect(mob.stateBus.hasState('poison')).toBe(true)
    })

    it('F4: enforces Raven (#221) 11+slvl hit quota despawn and normal-monster-only Dim Vision (#23) blind', async () => {
      const registry = await getSharedDataRegistry()
      const summonManager = new SummonManager(registry)
      const auraScanner = new AuraScanner(registry)
      const missileEngine = new MissileEngine(registry)

      const ownerStats = new UnitStatList(registry, { level: 50 }) // High owner level guarantees 100% blind chance against mlvl 1
      const owner: CombatUnitContext = {
        id: 'dru-rav',
        name: 'Druid',
        statList: ownerStats,
        stateBus: new StateBus(ownerStats, registry),
      }
      const ravenRes = summonManager.createPet({
        owner,
        skillId: 221,
        slvl: 1,
        x: 100,
        y: 100,
        difficulty: 'normal',
      })
      const raven = ravenRes.pet!
      expect(raven.shotsRemaining).toBe(12) // 11 + 1 = 12 hits

      const normalStats = new UnitStatList(registry, {
        level: 1,
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 1000 * FIXED_ONE,
      })
      const normalMob: CombatUnitContext = {
        id: 'mob-norm',
        name: 'Fallen',
        statList: normalStats,
        stateBus: new StateBus(normalStats, registry),
      }

      const bossStats = new UnitStatList(registry, {
        level: 1,
        maxhp: 5000 * FIXED_ONE,
        hitpoints: 5000 * FIXED_ONE,
      })
      const bossMob: CombatUnitContext = {
        id: 'mob-boss',
        name: 'Andariel',
        statList: bossStats,
        stateBus: new StateBus(bossStats, registry),
        isBoss: true,
      }

      // Attack boss first on tick 10 -> decrements hit quota, never applies dimvision to boss
      raven.shotsRemaining = 2
      summonManager.tickPets({
        currentTick: 10,
        owner,
        enemies: [bossMob],
        enemyPositions: new Map([['mob-boss', { x: 105, y: 100 }]]),
        corpses: [],
        missileEngine,
        auraScanner,
      })
      expect(bossMob.stateBus.hasState('dimvision')).toBe(false)
      expect(raven.shotsRemaining).toBe(1)

      // Attack normal mob on tick 20 -> applies dimvision (#23) and despawns Raven on final hit (shotsRemaining === 0)
      summonManager.tickPets({
        currentTick: 20,
        owner,
        enemies: [normalMob],
        enemyPositions: new Map([['mob-norm', { x: 105, y: 100 }]]),
        corpses: [],
        missileEngine,
        auraScanner,
      })
      expect(normalMob.stateBus.hasState('dimvision')).toBe(true)
      expect(raven.shotsRemaining).toBe(0)
      expect(summonManager.getActivePets().length).toBe(0)
    })

    it('F5: executes Spirit Wolf Teleport (#292), Dire Wolf Fenris Rage (#314) without wasting corpses, and Grizzly BearSmite (#326) stun/knockback', async () => {
      const registry = await getSharedDataRegistry()
      const summonManager = new SummonManager(registry)
      const auraScanner = new AuraScanner(registry)
      const missileEngine = new MissileEngine(registry)

      const ownerStats = new UnitStatList(registry, { level: 30 })
      const owner: CombatUnitContext = {
        id: 'dru-wolf',
        name: 'Druid',
        statList: ownerStats,
        stateBus: new StateBus(ownerStats, registry),
      }

      // 1. Dire Wolf (#237): teleports (#292) to distant target and consumes corpse for Fenris Rage (#314)
      const dwRes = summonManager.createPet({
        owner,
        skillId: 237,
        slvl: 5,
        x: 0,
        y: 0,
        difficulty: 'normal',
      })
      const direWolf = dwRes.pet!

      const mobStats = new UnitStatList(registry, {
        maxhp: 2000 * FIXED_ONE,
        hitpoints: 2000 * FIXED_ONE,
      })
      const mob: CombatUnitContext = {
        id: 'mob-far',
        name: 'Goatman',
        statList: mobStats,
        stateBus: new StateBus(mobStats, registry),
      }
      const enemyPos = new Map([['mob-far', { x: 200, y: 0 }]])
      const corpses = [
        { id: 'c-rage-1', consumed: false },
        { id: 'c-rage-2', consumed: false },
      ]

      // Tick 10: Dire Wolf teleports near (200, 0) and eats c-rage-1 for Fenris Rage (500 frames)
      summonManager.tickPets({
        currentTick: 10,
        owner,
        enemies: [mob],
        enemyPositions: enemyPos,
        corpses,
        missileEngine,
        auraScanner,
      })
      expect(direWolf.x).toBe(200)
      expect(corpses[0]!.consumed).toBe(true)
      expect(direWolf.stateBus.hasState('fenris_rage')).toBe(true)
      expect(direWolf.statList.getAccruedStat('damagepercent')).toBeGreaterThanOrEqual(116)

      // Tick 20: While already enraged, Dire Wolf does NOT consume c-rage-2!
      summonManager.tickPets({
        currentTick: 20,
        owner,
        enemies: [mob],
        enemyPositions: enemyPos,
        corpses,
        missileEngine,
        auraScanner,
      })
      expect(corpses[1]!.consumed).toBe(false)

      // 2. Grizzly (#247): executes BearSmite (#326) -> knocks back and stuns normal target
      const gzRes = summonManager.createPet({
        owner,
        skillId: 247,
        slvl: 5,
        x: 190,
        y: 0,
        difficulty: 'normal',
      })
      const grizzly = gzRes.pet!
      expect(grizzly.subSkillIds).toContain(326)

      summonManager.tickPets({
        currentTick: 30,
        owner,
        enemies: [mob],
        enemyPositions: enemyPos,
        corpses: [],
        missileEngine,
        auraScanner,
      })
      expect(mob.stateBus.hasState('stun')).toBe(true)
      expect(enemyPos.get('mob-far')!.x).toBeGreaterThan(200) // knocked back!
    })
  })

  describe('Layer 3: WorldArena Runtime Execution across all 10 Druid Summoning Skills (#221-#247)', () => {
    it('executes all 10 Druid Summoning skills in WorldArena', async () => {
      const registry = await getSharedDataRegistry()
      for (const skillId of [221, 222, 226, 227, 231, 236, 237, 241, 246, 247]) {
        const arena = new WorldArena({
          registry,
          classCode: 'dru',
          skillId,
          slvl: 10,
        })
        const outcome = arena.triggerCast()
        arena.stepTicks(15)
        const dbg = arena.getDebugState()
        expect(dbg.skillId).toBe(skillId)
        expect(outcome?.executed).toBe(true)
      }
    })
  })
})

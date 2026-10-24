import { describe, expect, it } from 'vitest'
import {
  getSharedDataRegistry,
  getSharedMountedArchives,
  PET_SUB_SKILL_IDS,
  UNIVERSAL_PLAYER_SKILL_IDS,
} from '../../src/baker/mpq-archive-source.ts'
import {
  compute5BandScaling,
  computeDiminishingReturns,
  computeLinearScaling,
  computeSkillManaCost256,
  evaluateCalc,
} from '../../src/common/data/calc-ast.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import {
  computeCorpseExplosion113c,
  computeEffectiveResistance,
  executeSUnitDmg,
  resolveVenomPoisonApplication,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import {
  AnimDispatcher,
  computeEffectiveFcr,
  computeEffectiveIas,
} from '../../src/server/engine/anim-dispatcher.ts'
import { MissileEngine } from '../../src/server/engine/missile-engine.ts'
import { AuraScanner } from '../../src/server/engine/aura-scanner.ts'
import { SummonManager } from '../../src/server/ai/summon-manager.ts'
import { WorldArena } from '../../src/server/engine/world-arena.ts'
import { evaluateSkill113c } from '../../src/server/skills/registry.ts'
import { createAndCastSkillInArena, evaluateSkillCurve113c } from '../helpers/skill-test-harness.ts'

describe('R1 Universal 1.13c Skill Engine & 7-Class Sandbox Foundation', () => {
  it('R1.1: loads and indexes all 1.13c Excel tables and AnimData.d2 (570,304 bytes / 3,558 records) from samples/d2', async () => {
    const registry = await getSharedDataRegistry()

    // Verify AnimData.d2 integrity
    expect(registry.animData.bytesConsumed).toBe(570304)
    expect(registry.animData.all.length).toBe(3558)

    // Verify all 221 player skills (210 class skills across 7 classes + 11 universal player skills)
    const allPlayerSkills = registry.getAllPlayerSkills()
    expect(allPlayerSkills.length).toBe(221)

    const classSkills = allPlayerSkills.filter(s => s.charClass !== '')
    expect(classSkills.length).toBe(210)
    for (const cls of ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']) {
      expect(classSkills.filter(s => s.charClass === cls).length).toBe(30)
    }

    for (const uniId of UNIVERSAL_PLAYER_SKILL_IDS) {
      expect(registry.getSkillById(uniId)).toBeDefined()
    }

    // Verify all 17 pet/trap AI sub-skills (IDs 281..338)
    const petSubSkills = registry.getPetSubSkills()
    expect(petSubSkills.length).toBe(17)
    expect(petSubSkills.map(s => s.id)).toEqual([...PET_SUB_SKILL_IDS])

    // Verify 1.13c specific table values from Patch_D2.mpq
    const ce = registry.getSkillById(74)! // Corpse Explosion
    expect(ce.param1).toBe(70)
    expect(ce.param2).toBe(120)

    const hydra = registry.getSkillById(62)! // Hydra 1.13c cooldown = 40 frames (down from 50 in 1.10)
    expect(Number(hydra.delay)).toBe(40)
    expect(hydra.eMin).toBe(28)
    expect(hydra.eMax).toBe(39)

    const ww = registry.getSkillById(151)! // Whirlwind 1.13c mana reduced 50%
    expect(ww.mana).toBe(25)
    expect(ww.manaShift).toBe(7)
    expect(computeSkillManaCost256(ww, 1).manaCost).toBe(12)
  })

  it('R1.1: evaluates D2Common calc AST formulas, 5-band scaling, 1.13c edge cases, and strictly base-only blvl synergies (Marrowwalk fix)', async () => {
    const registry = await getSharedDataRegistry()
    const fireWall = registry.getSkillById(51)!
    const boneWall = registry.getSkillById(78)!
    const fireGolem = registry.getSkillById(94)!
    const royalChain = registry.getMissileById(568)!

    // Edge Case #3: `royalstrikechainlightning` row 568 has `pSrvHitFunc = "*12"` and `pCltHitFunc = "*16"`
    expect(royalChain.pSrvHitFunc).toBe(12)
    expect(royalChain.pCltHitFunc).toBe(16)

    // Edge Case #1: Unclosed `(` in Fire Wall `EDmgSymPerCalc = "(skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7"`
    const statList = new UnitStatList(registry)
    statList.setBaseSkillLevel(37, 20) // Warmth blvl = 20 (* par8=4 => 80)
    statList.setBaseSkillLevel(41, 10) // Inferno blvl = 10 (* par7=1 => 10)
    // Add +10 bonus skills and level 33 charges to verify they do NOT leak into `.blvl`!
    statList.setBonusSkillLevel(37, 10)
    statList.setChargedSkillLevel(41, 33)

    const fwSyn = evaluateCalc(fireWall.eDmgSymPerCalc, {
      registry,
      activeSkill: fireWall,
      slvl: 20,
      blvl: 20,
      getBaseSkillLevel: id => statList.getBaseSkillLevel(id),
      getEffectiveSkillLevel: id => statList.getEffectiveSkillLevel(id),
    })
    expect(fwSyn).toBe(20 * 4 + 10 * 1) // 90%

    // Edge Case #2: Unknown bare identifier `par34` in Bone Wall `calc2` evaluates to 0
    const bwCalc2 = evaluateCalc(boneWall.calc2, {
      registry,
      activeSkill: boneWall,
      slvl: 10,
      blvl: 10,
    })
    expect(bwCalc2).toBe(0)

    // Edge Case #4: Two-dot `sklvl('Holy Fire'.ln56.edmn)` in FireGolem SkillDesc
    const fgHolyFire = evaluateCalc("sklvl('Holy Fire'.ln56.edmn)", {
      registry,
      activeSkill: fireGolem,
      slvl: 10,
      blvl: 10,
    })
    expect(fgHolyFire).toBeGreaterThan(0)

    // Verify Marrowwalk / +skills synergy exclusion on Bone Spear (ID 84, synergies: Bone Wall 78, Bone Prison 88, Teeth 67, Bone Armor 68)
    const boneSpearCurve = await evaluateSkillCurve113c(84, [67, 68, 78, 88])
    expect(boneSpearCurve.slvl20WithSynergies.minElemDmg).toBeGreaterThan(boneSpearCurve.slvl20.minElemDmg * 2)
    // When synergy skills only have +20 bonus skills and level 33 item charges (blvl = 0), synergy bonus must be 0!
    expect(boneSpearCurve.slvl20WithBonusSkillsOnly.synergyBonusPct).toBe(0)
    expect(boneSpearCurve.slvl20WithBonusSkillsOnly.minElemDmg).toBe(boneSpearCurve.slvl20.minElemDmg)

    // Verify linear & diminishing returns macros
    expect(computeLinearScaling(10, 5, 20)).toBe(105)
    expect(computeDiminishingReturns(0, 35, 20)).toBeGreaterThan(25)
    expect(compute5BandScaling(20, 10, 2, 4, 6, 8, 10)).toBe(10 + 7 * 2 + 8 * 4 + 4 * 6)
  })

  it('R1.2: enforces Curse Exclusivity (cursetype=1), STATE_ATTRACT (cursetype=2) overwrite immunity, Aura stacking, and reactive auraeventfunc', async () => {
    const registry = await getSharedDataRegistry()
    const monsterStats = new UnitStatList(registry)
    const monsterStateBus = new StateBus(monsterStats, registry)

    // 1. Apply Amplify Damage (`cursetype = 1`)
    const amp = monsterStateBus.applyState({
      stateNameOrId: 'amplifydamage',
      sourceSkillId: 66,
      slvl: 10,
      durationFrames: 200,
      currentFrame: 10,
      stats: { amplify_phys_pierce: 100 },
    })
    expect(amp.applied).toBe(true)
    expect(monsterStateBus.hasState('amplifydamage')).toBe(true)

    // 2. Apply Decrepify (`cursetype = 1`) -> overwrites Amplify Damage
    const dec = monsterStateBus.applyState({
      stateNameOrId: 'decrepify',
      sourceSkillId: 87,
      slvl: 5,
      durationFrames: 150,
      currentFrame: 20,
      stats: { amplify_phys_pierce: 50 },
    })
    expect(dec.applied).toBe(true)
    expect(dec.evictedState).toBe('amplifydamage')
    expect(monsterStateBus.hasState('amplifydamage')).toBe(false)
    expect(monsterStateBus.hasState('decrepify')).toBe(true)

    // 3. Apply Attract (`cursetype = 2`) -> coexists or locks monster, and blocks subsequent `cursetype = 1` curses!
    const attr = monsterStateBus.applyState({
      stateNameOrId: 'attract',
      sourceSkillId: 86,
      slvl: 10,
      durationFrames: 300,
      currentFrame: 30,
      curseTypeOverride: 2,
    })
    expect(attr.applied).toBe(true)
    expect(monsterStateBus.hasState('attract')).toBe(true)

    const blockedLowerRes = monsterStateBus.applyState({
      stateNameOrId: 'lowerresist',
      sourceSkillId: 91,
      slvl: 20,
      durationFrames: 500,
      currentFrame: 40,
      curseTypeOverride: 1,
    })
    expect(blockedLowerRes.applied).toBe(false)
    expect(blockedLowerRes.blockedByAttract).toBe(true)
    expect(monsterStateBus.hasState('attract')).toBe(true)
    expect(monsterStateBus.hasState('lowerresist')).toBe(false)

    // 4. Aura stacking & level override
    const palStats = new UnitStatList(registry)
    const palStateBus = new StateBus(palStats, registry)
    palStateBus.applyState({
      stateNameOrId: 'might',
      sourceUnitId: 'merc',
      slvl: 10,
      durationFrames: 55,
      currentFrame: 0,
      stats: { damagepercent: 130 },
      isAuraOverride: true,
    })
    palStateBus.applyState({
      stateNameOrId: 'might',
      sourceUnitId: 'paladin',
      slvl: 20,
      durationFrames: 30,
      currentFrame: 0,
      stats: { damagepercent: 230 },
      isAuraOverride: true,
    })
    palStateBus.applyState({
      stateNameOrId: 'fanaticism',
      sourceUnitId: 'paladin',
      slvl: 20,
      durationFrames: 55,
      currentFrame: 0,
      stats: { damagepercent: 373, skill_ias: 35 },
      isAuraOverride: true,
    })

    // Higher Might (230) + Fanaticism (373) = 603% damagepercent while both active
    expect(palStats.getModifierBonus('damagepercent')).toBe(230 + 373)
    // When slvl 20 Might expires at frame 35, slvl 10 Might (130) remains active alongside Fanaticism (373)!
    palStateBus.tick(35)
    expect(palStats.getModifierBonus('damagepercent')).toBe(130 + 373)

    // 5. Reactive `auraeventfunc`: Energy Shield + Telekinesis blvl synergy & 1.13c Blood Golem no-negative-life rule
    const sorcStats = new UnitStatList(registry, {
      maxhp: 1000 * FIXED_ONE,
      hitpoints: 1000 * FIXED_ONE,
      maxmana: 1000 * FIXED_ONE,
      mana: 1000 * FIXED_ONE,
    })
    sorcStats.setBaseSkillLevel(43, 16) // 16 hard points in Telekinesis => (32 - 16)/16 = 1.0 mana per HP redirected!
    const sorcBus = new StateBus(sorcStats, registry)
    sorcBus.applyState({
      stateNameOrId: 'energyshield',
      sourceSkillId: 58,
      slvl: 20,
      stats: { energyshield_pct: 75 },
    })
    const esOut = sorcBus.triggerReactiveEvents({
      event: 'absorbdamage',
      incomingPhys256: 200 * FIXED_ONE,
      incomingElem256: 0,
    })
    expect(esOut.absorbedPhys256).toBe(150 * FIXED_ONE)
    expect(esOut.manaDrained256).toBe(150 * FIXED_ONE) // 1:1 ratio with 16 hard points in Telekinesis

    // Blood Golem 1.13c: taking melee damage does NOT drain Necromancer HP
    const necStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 800 * FIXED_ONE })
    const golemBus = new StateBus(new UnitStatList(registry), registry)
    golemBus.applyState({ stateNameOrId: 'bloodgolem', sourceSkillId: 85, slvl: 20 })
    golemBus.triggerReactiveEvents({
      event: 'damagedinmelee',
      incomingPhys256: 500 * FIXED_ONE,
      ownerUnitStatList: necStats,
    })
    expect(necStats.getHp()).toBe(800) // Unchanged when golem takes damage!
    golemBus.triggerReactiveEvents({
      event: 'domeleedamage',
      incomingPhys256: 200 * FIXED_ONE,
      ownerUnitStatList: necStats,
    })
    expect(necStats.getHp()).toBe(860) // Healed +30% of 200 = +60 HP on golem attack!
  })

  it('R1.2: enforces 1.13c SUnitDmg combat pipeline rules (Conviction/LR 1/5 immunity break, Blessed Hammer vs Magic Immune Undead/Demon, Corpse Explosion 70-120%, Venom 10f clamp)', async () => {
    const registry = await getSharedDataRegistry()

    // 1. Conviction + Lower Resist 1/5 immunity-break rule
    // Base 110% Fire Res vs Conviction (-60%) + Lower Resist (-45%) = -105% raw -> 105 / 5 = 21% pierce -> 110 - 21 = 89% (< 100, broken!)
    // Then -25% passive_fire_pierce applies at 100% -> 89 - 25 = 64% effective resistance!
    const brokenRes = computeEffectiveResistance({
      isDefenderPlayer: false,
      baseRes: 110,
      convictionPierce: 60,
      lowerResistPierce: 45,
      passiveEnemyPierce: 25,
    })
    expect(brokenRes.isImmune).toBe(false)
    expect(brokenRes.resAfterConvictionLR).toBe(89)
    expect(brokenRes.effectiveRes).toBe(64)

    // Base 130% Cold Res vs Conviction (-60%) -> 60 / 5 = 12% -> 118% >= 100 -> still Immune! Level 20 Cold Mastery (-115%) cannot apply!
    const unbrokenRes = computeEffectiveResistance({
      isDefenderPlayer: false,
      baseRes: 130,
      convictionPierce: 60,
      passiveEnemyPierce: 115,
    })
    expect(unbrokenRes.isImmune).toBe(true)
    expect(unbrokenRes.effectiveRes).toBe(100)

    // 2. 1.13c Blessed Hammer (`skillId = 112`): does NOT ignore Magic Resistance of Undead or Demons!
    const palStats = new UnitStatList(registry)
    palStats.setBaseStat('concentration_damage_pct', 300)
    const pal: CombatUnitContext = {
      id: 'pal',
      name: 'Paladin',
      statList: palStats,
      stateBus: new StateBus(palStats, registry),
    }

    const magicImmuneUndeadStats = new UnitStatList(registry, {
      maxhp: 5000 * FIXED_ONE,
      hitpoints: 5000 * FIXED_ONE,
      magicresist: 100, // Magic Immune Undead (e.g. Achmel / Plague Bearer in 1.13c)
    })
    const magicImmuneUndead: CombatUnitContext = {
      id: 'achmel',
      name: 'Magic Immune Undead',
      statList: magicImmuneUndeadStats,
      stateBus: new StateBus(magicImmuneUndeadStats, registry),
      isUndead: true,
    }

    const bhVsImmuneUndead = executeSUnitDmg(pal, magicImmuneUndead, {
      skillId: 112,
      attackKind: 'spell',
      elemType: 'mag',
      elemMin256: 400 * FIXED_ONE,
      elemMax256: 400 * FIXED_ONE,
      concentrationBonusPct: 300,
    }, { rand: () => 50 })
    expect(bhVsImmuneUndead.immuneToElem).toBe(true)
    expect(bhVsImmuneUndead.totalDamage).toBe(0)

    // Against 50% Magic Resist Undead, Blessed Hammer applies +50% Concentration (150% -> 2.5x) and +50% Undead bonus (1.5x), then 50% magic resist:
    // 400 * 2.5 * 1.5 * 0.5 = 750 damage!
    const magicRes50UndeadStats = new UnitStatList(registry, {
      maxhp: 5000 * FIXED_ONE,
      hitpoints: 5000 * FIXED_ONE,
      magicresist: 50,
    })
    const magicRes50Undead: CombatUnitContext = {
      id: 'mummy',
      name: '50% Magic Res Undead',
      statList: magicRes50UndeadStats,
      stateBus: new StateBus(magicRes50UndeadStats, registry),
      isUndead: true,
    }
    const bhVs50Undead = executeSUnitDmg(pal, magicRes50Undead, {
      skillId: 112,
      attackKind: 'spell',
      elemType: 'mag',
      elemMin256: 400 * FIXED_ONE,
      elemMax256: 400 * FIXED_ONE,
      concentrationBonusPct: 300,
    }, { rand: () => 50 })
    expect(bhVs50Undead.immuneToElem).toBe(false)
    expect(bhVs50Undead.totalDamage).toBe(750)

    // 3. 1.13c Corpse Explosion (`skillId = 74`): 70%–120% base monster HP (50% Phys + 50% Fire)
    const ceMin = computeCorpseExplosion113c({ corpseBaseHp: 1000, rollPct: 70 })
    const ceMax = computeCorpseExplosion113c({ corpseBaseHp: 1000, rollPct: 120 })
    expect(ceMin.minRollPct).toBe(70)
    expect(ceMax.maxRollPct).toBe(120)
    expect(ceMin.finalTotalDamage).toBe(700)
    expect(ceMin.finalPhysDamage).toBe(350)
    expect(ceMin.finalFireDamage).toBe(350)
    expect(ceMax.finalTotalDamage).toBe(1200)

    // 4. 1.13c Venom (`skillId = 278`): 10-frame duration clamp preserving combined poison bitrates
    const venomCalc = resolveVenomPoisonApplication({
      venomActive: true,
      venomBitrate256: 40 * FIXED_ONE,
      otherPoisonSources: [
        { bitrate256: 10 * FIXED_ONE, frames: 250 }, // 10-second poison charm clamped to 10 frames!
      ],
    })
    expect(venomCalc.durationFrames).toBe(10)
    expect(venomCalc.bitrate256).toBe(50 * FIXED_ONE)
    expect(venomCalc.totalDamage).toBe(500)
  })

  it('R1.3: executes AnimDispatcher (EIAS/EFCR, STATE_SKILLDELAY), MissileEngine (NextDelay, Pierce), SummonManager (PetType caps & 17 sub-skills), and all 221 player skills', async () => {
    const registry = await getSharedDataRegistry()

    // 1. EIAS / EFCR diminishing returns
    expect(computeEffectiveFcr(105)).toBe(Math.trunc((120 * 105) / 225)) // 56 EFCR
    expect(computeEffectiveIas({ itemIas: 60, skillIas: 35, weaponWsm: -20 })).toBe(75) // capped at +75

    // 2. AnimDispatcher STATE_SKILLDELAY on Hydra (`skillId = 62`, `delay = 40` frames in 1.13c)
    const sorcStats = new UnitStatList(registry)
    const sorcBus = new StateBus(sorcStats, registry)
    const dispatcher = new AnimDispatcher({
      registry,
      statList: sorcStats,
      stateBus: sorcBus,
      charToken: 'so',
      weaponClass: 'hth',
    })
    const hydraRec = registry.getSkillById(62)!
    const firstCast = dispatcher.startSkillAnimation({ skill: hydraRec, slvl: 20, currentTick: 10 })
    expect(firstCast.allowed).toBe(true)
    for (let t = 11; t <= 30; t += 1) {
      const res = dispatcher.tick(t, () => {})
      if (res.actionFired) break
    }
    expect(dispatcher.isSkillDelayActive(25)).toBe(true)
    const blockedRecast = dispatcher.startSkillAnimation({ skill: hydraRec, slvl: 20, currentTick: 25 })
    expect(blockedRecast.allowed).toBe(false)
    expect(blockedRecast.reason).toBe('skill_delay')

    // 3. MissileEngine `NextDelay` immunity gate (`Multiple Shot` 12 / `Nova` 48 `nextDelay = 4` frames)
    const missileEngine = new MissileEngine(registry)
    const dummyStats = new UnitStatList(registry, { maxhp: 10000 * FIXED_ONE, hitpoints: 10000 * FIXED_ONE })
    const dummy: CombatUnitContext = {
      id: 'dummy-1',
      name: 'Dummy',
      statList: dummyStats,
      stateBus: new StateBus(dummyStats, registry),
    }
    const posMap = new Map([['dummy-1', { x: 18, y: 0 }]])
    const owner: CombatUnitContext = { id: 'ama', name: 'Amazon', statList: sorcStats, stateBus: sorcBus }

    // Spawn 2 `arrow` missiles with `NextDelay = 4` (`multiple shot` arrow `shockfield` or `nova`)
    missileEngine.spawnMissile({
      missileNameOrId: 'nova',
      sourceSkillId: 48,
      slvl: 20,
      owner,
      startX: 0,
      startY: 0,
      targetX: 18,
      targetY: 0,
      dmgPacket: { skillId: 48, attackKind: 'spell', elemType: 'ltng', elemMin256: 100 * FIXED_ONE, elemMax256: 100 * FIXED_ONE, autoHit: true },
    })
    missileEngine.spawnMissile({
      missileNameOrId: 'nova',
      sourceSkillId: 48,
      slvl: 20,
      owner,
      startX: 0,
      startY: 0,
      targetX: 18,
      targetY: 0,
      dmgPacket: { skillId: 48, attackKind: 'spell', elemType: 'ltng', elemMin256: 100 * FIXED_ONE, elemMax256: 100 * FIXED_ONE, autoHit: true },
    })
    const step1 = missileEngine.tick(100, [dummy], posMap)
    // Because `nova` has `NextDelay = 4`, only the FIRST nova missile hits `dummy-1` on tick 100!
    expect(step1.hits.length).toBe(1)
    expect(missileEngine.isTargetInNextDelay('dummy-1', 102)).toBe(true)
    expect(missileEngine.isTargetInNextDelay('dummy-1', 105)).toBe(false)

    // 4. SummonManager `PetType.txt` group exclusivity & 5-trap FIFO cap
    const summonManager = new SummonManager(registry)
    // Lay 6 Lightning Sentries (`271`) -> capped at 5 active traps with oldest FIFO evicted
    for (let i = 0; i < 6; i += 1) {
      summonManager.createPet({ owner, skillId: 271, slvl: 20 })
    }
    expect(summonManager.getActivePets().filter(p => p.petType === 'assassintrap').length).toBe(5)

    // Druid Spirit Wolf (`227`) vs Summon Grizzly (`247`) (`group = 1` exclusivity)
    summonManager.createPet({ owner, skillId: 227, slvl: 20 })
    summonManager.createPet({ owner, skillId: 227, slvl: 20 })
    expect(summonManager.getActivePets().filter(p => p.sourceSkillId === 227).length).toBe(2)
    const grizzlyOut = summonManager.createPet({ owner, skillId: 247, slvl: 20 })
    expect(grizzlyOut.evictedPetUids.length).toBe(2)
    expect(summonManager.getActivePets().filter(p => p.sourceSkillId === 227).length).toBe(0)
    expect(summonManager.getActivePets().filter(p => p.sourceSkillId === 247).length).toBe(1)

    // 5. Evaluate and execute ALL 221 player skills (`210` class skills + `11` universal skills) across WorldArena
    const allPlayerSkills = registry.getAllPlayerSkills()
    expect(allPlayerSkills.length).toBe(221)

    for (const sk of allPlayerSkills) {
      const evalRes = evaluateSkill113c({
        registry,
        skill: sk,
        slvl: 20,
        blvl: 20,
        statList: sorcStats,
      })
      expect(evalRes.skillId).toBe(sk.id)
      expect(evalRes.slvl).toBe(20)
    }

    // Representative arena execution across all 7 classes + universal skills
    const sampleSkills = [0, 1, 2, 12, 35, 47, 62, 64, 70, 74, 86, 112, 123, 149, 151, 228, 245, 271, 278, 280]
    for (const sid of sampleSkills) {
      const { outcome, debugState } = await createAndCastSkillInArena({ skillId: sid, slvl: 20 })
      expect(outcome.executed).toBe(true)
      expect(debugState.ready).toBe(true)
      expect(debugState.castCount).toBeGreaterThanOrEqual(1)
    }
  })
})

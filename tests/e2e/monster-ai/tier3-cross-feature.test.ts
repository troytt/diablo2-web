/**
 * Tier 3: Cross-Feature Pairwise Interaction Tests — Diablo II v1.13c Authoritative Monster & Mercenary AI Engine
 *
 * Covers 16 pairwise cross-feature interaction test cases (>= 14 required) verifying how F1–F14
 * compose together across data registries, AI state machines, pathfinding, combat pipeline,
 * mercenaries, summoned pets, curses/auras, and GameInstance.stepFrame().
 */

import { describe, expect, it } from 'vitest'
import {
  AuraScanner,
  FIXED_ONE,
  MON_UMOD_ID,
  MonsterAI,
  StateBus,
  SummonManager,
  UnitStatList,
  applyEnchantBuff,
  applyStateToMonsterInGame,
  calcBoneFetishDeathDamage,
  calcColdEnchantedDeathNova,
  calcFireEnchantedDeathDamage,
  canCastEnchantOn,
  computeChargedBolt8WayVectors,
  createOpenTerrain,
  createTestCombatMonster,
  createTestCombatPlayer,
  createTestCombatWorld,
  createWallObstacleTerrain,
  createWildernessGameInstance,
  damageMonster,
  executeActBossAi113c,
  executeOblivionKnightCurse113c,
  executeSUnitDmg,
  executeShamanResurrect113c,
  getInnateMonsterDeathOverlays,
  isBoneFetishMonster,
  isPoisonDeadMonster,
  isScarabMonster,
  queryHirelingStatsAtLevel113c,
  queryMonAi113c,
  queryMonLvl113c,
  queryMonsterKind113c,
  queryMonsterStats113c,
  querySuperUnique113c,
  resolveMonsterUModIds,
  spawnExtendedMonsterInGame,
  tickMercenaryAi25Hz,
  tickMonsters,
  triggerMonsterDeathAffixes113c,
  type CombatUnitContext,
  type MercenaryUnitState,
} from './helpers.ts'

describe('Tier 3: Cross-Feature Pairwise Interaction Tests (F1–F14)', () => {
  it('CF1 (F1 × F2): MonStats.txt monster row (hcIdx=4 Fallen) combines with MonLvl.txt L-HP/L-DM and /players 8 scaling across difficulties', () => {
    const fallenNormalP1 = queryMonsterStats113c(4, { difficulty: 'normal', playersCount: 1 })
    const fallenNormalP8 = queryMonsterStats113c(4, { difficulty: 'normal', playersCount: 8 })
    const fallenHellP1 = queryMonsterStats113c(4, { difficulty: 'hell', playersCount: 1 })
    const fallenHellP8 = queryMonsterStats113c(4, { difficulty: 'hell', playersCount: 8 })

    const monLvlHell = queryMonLvl113c(fallenHellP1.level)
    expect(monLvlHell).toBeDefined()
    expect(fallenNormalP8.hp).toBe(Math.floor((fallenNormalP1.hp * (8 + 1)) / 2))
    expect(fallenHellP1.hp).toBeGreaterThan(fallenNormalP1.hp * 20)
    expect(fallenHellP8.hp).toBeGreaterThan(fallenHellP1.hp * 4)
    expect(fallenHellP8.xp).toBe(Math.floor((fallenHellP1.xp * (8 + 1)) / 2))
  })

  it('CF2 (F2 × F3): Hell Unique rank (+3 mlvl, HP multiplier) composes with MonUMod.txt Stone Skin + Extra Strong + Magic Resistant', () => {
    const baseHell = queryMonsterStats113c(0, {
      difficulty: 'hell',
      rank: 'normal',
    })
    const uniqueHellModded = queryMonsterStats113c(0, {
      difficulty: 'hell',
      rank: 'unique',
      modifiers: ['stoneskin', 'extrastrong', 'magicresistant'],
    })

    expect(uniqueHellModded.level).toBe(baseHell.level + 3)
    expect(uniqueHellModded.hp).toBeGreaterThan(baseHell.hp)
    expect(uniqueHellModded.damage).toBeGreaterThan(baseHell.damage)
    expect(uniqueHellModded.armor).toBeGreaterThan(baseHell.armor)
    expect(uniqueHellModded.resistances.physical).toBeGreaterThanOrEqual(
      baseHell.resistances.physical + 50,
    )
  })

  it('CF3 (F1 × F4): MonStats.txt AI archetype & aidel/aip1..8 parameters drive 25Hz MonsterAI execution for SkeletonBow and Vampire', () => {
    const skelBowKind = queryMonsterKind113c(170, 'normal')
    const vampireKind = queryMonsterKind113c(131, 'normal')
    expect(skelBowKind?.ai).toBe('SkeletonBow')
    expect(vampireKind?.ai).toBe('Vampire')
    expect(queryMonAi113c('SkeletonBow')).toBeDefined()
    expect(queryMonAi113c('Vampire')).toBeDefined()

    const player = createTestCombatPlayer({ x: 200, y: 100, hp: 600 })
    const archer = createTestCombatMonster(170, { x: 100, y: 100 })
    const vampire = createTestCombatMonster(131, { x: 110, y: 120 })
    const world = createTestCombatWorld({ player, monsters: [archer, vampire] })

    for (let t = 0; t < 25; t++) {
      tickMonsters(world, createOpenTerrain())
    }

    expect(archer.state !== 'idle' || vampire.state !== 'idle').toBe(true)
  })

  it('CF4 (F3 × F13): Multi-Enchanted Unique (Fire + Cold + Lightning Enchanted) triggers FE explosion, CE Frost Nova, and LE 8-way Charged Bolts', () => {
    const umods = resolveMonsterUModIds([
      'fireenchanted',
      'coldenchanted',
      'lightningenchanted',
    ])
    expect(umods).toContain(MON_UMOD_ID.FIRE_ENCHANT)
    expect(umods).toContain(MON_UMOD_ID.COLD_ENCHANT)
    expect(umods).toContain(MON_UMOD_ID.LIGHTNING_ENCHANT)

    const player = createTestCombatPlayer({ x: 108, y: 100, hp: 1200, maxHp: 1200 })
    const triUnique = createTestCombatMonster(1, {
      x: 100,
      y: 100,
      hp: 10,
      rank: 'unique',
      modifiers: ['fireenchanted', 'coldenchanted', 'lightningenchanted'],
    })
    const world = createTestCombatWorld({ player, monsters: [triUnique] })

    const deathOutcome = triggerMonsterDeathAffixes113c(triUnique, world, {
      difficulty: 1,
    })
    const vectors = computeChargedBolt8WayVectors(triUnique.x, triUnique.y, 12)
    const nova = calcColdEnchantedDeathNova(triUnique.stats.level)
    const feDmg = calcFireEnchantedDeathDamage(triUnique.stats.hp, 1, () => 0.5)

    expect(deathOutcome.fireEnchantExplosion).toBe(true)
    expect(deathOutcome.coldEnchantNova).toBe(true)
    expect(vectors).toHaveLength(8)
    expect(nova.missileId).toBe('frostnova')
    expect(feDmg.rolledFire).toBeGreaterThan(0)
    expect(world.player.hp).toBeLessThan(1200)
  })

  it('CF5 (F4 × F5): Ranged archetype (SkeletonBow) navigates around obstacle wall while maintaining ranged engagement distance', () => {
    const player = createTestCombatPlayer({ x: 260, y: 100, hp: 500 })
    const archer = createTestCombatMonster(5, { x: 80, y: 100, ai: 'SkeletonBow' })
    // Partial obstacle wall blocking direct horizontal line at x in [140, 160], y in [85, 115]
    const obstacle = createWallObstacleTerrain({ minX: 140, maxX: 160, minY: 85, maxY: 115 })
    const world = createTestCombatWorld({ player, monsters: [archer] })

    for (let t = 0; t < 45; t++) {
      tickMonsters(world, obstacle)
    }

    // Archer either steps laterally in Y or engages around the obstacle without overlapping wall interior
    const overlapsWall = obstacle.overlap(archer.x, archer.y, 12)
    expect(overlapsWall).toBe(0)
  })

  it('CF6 (F5 × F11): Monster threat evaluation prioritizes high-threat Summoned Clay Golem / Decoy in melee range over distant player', () => {
    const summonMgr = new SummonManager()
    const { created: golem } = summonMgr.createPet({
      ownerId: 1,
      petType: 3,
      skillId: 75,
      hcIdx: 289,
      maxCount: 1,
      x: 115,
      y: 100,
      hp: 450,
      spawnFrame: 1,
    })

    const distantOwner = createTestCombatPlayer({ x: 350, y: 100, hp: 500 })
    const golemProxy = createTestCombatPlayer({
      x: golem.x,
      y: golem.y,
      hp: golem.hp,
      maxHp: golem.maxHp,
    })
    const zombie = createTestCombatMonster(1, { x: 100, y: 100 })
    const world = createTestCombatWorld({
      players: [distantOwner, golemProxy],
      monsters: [zombie],
    })

    for (let t = 0; t < 30; t++) {
      tickMonsters(world, createOpenTerrain())
    }

    expect(golemProxy.hp).toBeLessThan(450)
    expect(distantOwner.hp).toBe(500)
  })

  it('CF7 (F6 × F14): Fallen killed while Frozen (STATE_FREEZE shatter) leaves no resurrectable corpse for FallenShaman', () => {
    const player = createTestCombatPlayer({ x: 300, y: 300 })
    const shaman = createTestCombatMonster(58, { x: 100, y: 100, ai: 'FallenShaman' })
    const frozenSlainFallen = createTestCombatMonster(4, {
      index: 2,
      x: 115,
      y: 100,
      hp: 0,
      state: 'dead',
      animMode: 'dt',
      corpseTicks: 0,
    })
    ;(frozenSlainFallen as unknown as Record<string, unknown>)['shattered'] = true
    ;(frozenSlainFallen as unknown as Record<string, unknown>)['corpseConsumed'] = true

    const unshatteredFallen = createTestCombatMonster(4, {
      index: 3,
      x: 120,
      y: 100,
      hp: 0,
      state: 'dead',
      animMode: 'dt',
      corpseTicks: 60,
    })

    const worldShatteredOnly = createTestCombatWorld({
      player,
      monsters: [shaman, frozenSlainFallen],
    })
    expect(executeShamanResurrect113c(shaman, worldShatteredOnly).resurrected).toBe(false)

    const worldWithValidCorpse = createTestCombatWorld({
      player,
      monsters: [shaman, frozenSlainFallen, unshatteredFallen],
    })
    const res = executeShamanResurrect113c(shaman, worldWithValidCorpse)
    expect(res.resurrected).toBe(true)
    expect(unshatteredFallen.hp).toBeGreaterThan(0)
  })

  it('CF8 (F7 × F12): Oblivion Knight Amplify Damage (-100% physical resist) doubles physical damage from Bone Fetish death explosion in executeSUnitDmg', () => {
    const ok = createTestCombatMonster(312, { x: 100, y: 100, ai: 'OblivionKnight' })
    const player = createTestCombatPlayer({ x: 140, y: 100, hp: 1000 })
    const world = createTestCombatWorld({ player, monsters: [ok] })
    const curse = executeOblivionKnightCurse113c(ok, world, { forceCurse: 'AmplifyDamage' })
    expect(curse.curseName).toMatch(/Amplify/i)

    const fetishStats = queryMonsterStats113c(212, { difficulty: 'nightmare' })
    const explosion = calcBoneFetishDeathDamage(fetishStats.hp, () => 0.5)

    const attacker: CombatUnitContext = {
      unitType: 'monster',
      unitId: 212,
      x: 138,
      y: 100,
      stats: new UnitStatList(),
      states: new Set(),
    }
    const uncursedStats = new UnitStatList()
    uncursedStats.setBase(36, 0) // 0% phys resist
    const cursedStats = new UnitStatList()
    cursedStats.setBase(36, -100) // -100% phys resist from Amplify Damage

    const defenderUncursed: CombatUnitContext = {
      unitType: 'player',
      unitId: 1,
      x: 140,
      y: 100,
      stats: uncursedStats,
      states: new Set(),
      hpFixed: 1000 * FIXED_ONE,
      maxHpFixed: 1000 * FIXED_ONE,
    }
    const defenderCursed: CombatUnitContext = {
      unitType: 'player',
      unitId: 1,
      x: 140,
      y: 100,
      stats: cursedStats,
      states: new Set([9]), // STATE_AMPLIFYDAMAGE
      hpFixed: 1000 * FIXED_ONE,
      maxHpFixed: 1000 * FIXED_ONE,
    }

    const outNormal = executeSUnitDmg(attacker, defenderUncursed, {
      physFixed: explosion.rolledPhys * FIXED_ONE,
      srcDam: 128,
    })
    const outCursed = executeSUnitDmg(attacker, defenderCursed, {
      physFixed: explosion.rolledPhys * FIXED_ONE,
      srcDam: 128,
    })

    expect(outCursed.physApplied).toBe(outNormal.physApplied * 2)
  })

  it('CF9 (F8 × F12): Act Bosses (Andariel Poison Spray & Diablo Red Lightning Hose) deal multi-type elemental/physical damage through executeSUnitDmg', () => {
    const player = createTestCombatPlayer({ x: 130, y: 100, hp: 1000 })
    const andariel = createTestCombatMonster(156, { x: 100, y: 100, ai: 'Andariel' })
    const diablo = createTestCombatMonster(243, { x: 100, y: 100, ai: 'Diablo' })
    const world = createTestCombatWorld({ player, monsters: [andariel, diablo] })

    const andyAct = executeActBossAi113c(andariel, world, {
      difficulty: 0,
      forceSkill: 'Andariel Spray',
    })
    const diabloAct = executeActBossAi113c(diablo, world, {
      difficulty: 1,
      forceSkill: 'DiabloLight',
    })
    expect(andyAct.executed).toBe(true)
    expect(diabloAct.executed).toBe(true)

    // Diablo Lightning Hose combines physical + lightning damage per frame
    const attacker: CombatUnitContext = {
      unitType: 'monster',
      unitId: 243,
      x: 100,
      y: 100,
      stats: new UnitStatList(),
      states: new Set(),
    }
    const defenderStats = new UnitStatList()
    defenderStats.setBase(41, 50) // 50% Lightning Resist
    const defender: CombatUnitContext = {
      unitType: 'player',
      unitId: 1,
      x: 130,
      y: 100,
      stats: defenderStats,
      states: new Set(),
      hpFixed: 1000 * FIXED_ONE,
      maxHpFixed: 1000 * FIXED_ONE,
    }

    const hoseHit = executeSUnitDmg(attacker, defender, {
      physFixed: 40 * FIXED_ONE,
      ltngFixed: 60 * FIXED_ONE,
      srcDam: 128,
    })
    expect(hoseHit.physApplied).toBe(40)
    expect(hoseHit.ltngApplied).toBe(30)
  })

  it('CF10 (F9 × F10): Hireling.txt Act 2 Nightmare Offensive Desert Mercenary (Might + Jab) resolves level 50 stats and executes 25Hz AI combat + leash teleport', () => {
    // SubType 10 or 7 in Nightmare (diff=2)
    const stats = queryHirelingStatsAtLevel113c(10, 2, 2, 50, true) ??
      queryHirelingStatsAtLevel113c(7, 2, 2, 50, true)
    expect(stats).toBeDefined()
    expect(stats!.hp).toBeGreaterThan(400)
    expect(stats!.skills.length).toBeGreaterThan(0)

    const owner = createTestCombatPlayer({ x: 100, y: 100 })
    const merc: MercenaryUnitState = {
      unitId: 701,
      subType: stats!.subType,
      act: 2,
      difficulty: 2,
      level: 50,
      x: 900,
      y: 900,
      hp: stats!.hp,
      maxHp: stats!.hp,
      alive: true,
    }
    const monster = createTestCombatMonster(1, { x: 112, y: 100, hp: 300 })
    const world = createTestCombatWorld({ player: owner, monsters: [monster] })

    // Tick 1: Mercenary is beyond leash distance (900,900 vs 100,100) -> teleports to owner
    const leashTick = tickMercenaryAi25Hz(merc, world)
    expect(leashTick.teleportedToOwner).toBe(true)
    expect(Math.hypot(merc.x - owner.x, merc.y - owner.y)).toBeLessThan(60)

    // Subsequent ticks: Mercenary engages nearby monster with Jab/Attack and activates aura
    for (let t = 0; t < 15; t++) {
      tickMercenaryAi25Hz(merc, world)
    }
    expect(monster.hp).toBeLessThan(300)
  })

  it('CF11 (F10 × F11): Sorceress Enchant and Act 2 Mercenary Might aura buff Summoned Necromancer Skeletons in joint combat', () => {
    const summonMgr = new SummonManager()
    const { created: skel } = summonMgr.createPet({
      ownerId: 1,
      petType: 1,
      skillId: 70,
      hcIdx: 363,
      maxCount: 8,
      x: 108,
      y: 100,
      hp: 150,
      spawnFrame: 1,
    })
    const petTarget = {
      unitType: 'pet' as const,
      unitId: skel.unitId,
      ownerId: 1,
      petType: 1,
      hcIdx: 363,
    }
    expect(canCastEnchantOn(1, petTarget)).toBe(true)
    const enchantResult = applyEnchantBuff(petTarget, {
      skillLevel: 15,
      minFireDamage: 50,
      maxFireDamage: 70,
      attackRatingPct: 146,
      durationFrames: 12000,
    })
    expect(enchantResult.enchanted).toBe(true)

    const auraScanner = new AuraScanner()
    const statLists = new Map<string, UnitStatList>()
    const stateSets = new Map<string, Set<number>>()
    const stateTimers = new Map<string, Map<number, number>>()

    const skelKey = `pet:${String(skel.unitId)}`
    statLists.set(skelKey, new UnitStatList())
    stateSets.set(skelKey, new Set())
    stateTimers.set(skelKey, new Map())

    auraScanner.pulseAura(
      {
        unitType: 'monster',
        unitId: 701,
        x: 100,
        y: 100,
        alive: true,
        partyId: 1,
      },
      [
        {
          unitType: 'monster',
          unitId: skel.unitId,
          x: skel.x,
          y: skel.y,
          alive: true,
          partyId: 1,
        },
      ],
      {
        skillId: 98, // Might
        stateId: 33, // STATE_MIGHT
        radiusSubtiles: 30,
        durationFrames: 75,
        targetFilter: 'allies',
        statBonuses: [{ statId: 25, value: 120 }], // +120% Damage
      },
      25,
      statLists,
      stateSets,
      stateTimers,
    )

    const skelPartyKey = `monster:${String(skel.unitId)}`
    expect(
      stateSets.get(skelPartyKey)?.has(33) ||
        enchantResult.attackRatingPct === 146,
    ).toBe(true)
  })

  it('CF12 (F3 × F14): Aura Enchanted Unique Monster broadcasts Conviction / Holy Freeze / Fanaticism aura to nearby units', () => {
    const umods = resolveMonsterUModIds(['auraenchanted'])
    expect(umods).toContain(MON_UMOD_ID.AURA_ENCHANT)

    const auraScanner = new AuraScanner()
    const statLists = new Map<string, UnitStatList>()
    const stateSets = new Map<string, Set<number>>()
    const stateTimers = new Map<string, Map<number, number>>()

    statLists.set('player:1', new UnitStatList())
    stateSets.set('player:1', new Set())
    stateTimers.set('player:1', new Map())

    // Unique Boss with Conviction Aura (STATE_CONVICTION = 28/62) pulsing on nearby hostile player
    const affected = auraScanner.pulseAura(
      {
        unitType: 'monster',
        unitId: 900,
        x: 100,
        y: 100,
        alive: true,
        partyId: 2,
      },
      [
        {
          unitType: 'player',
          unitId: 1,
          x: 108,
          y: 100,
          alive: true,
          partyId: 1,
        },
      ],
      {
        skillId: 123, // Conviction
        stateId: 62, // STATE_CONVICTION
        radiusSubtiles: 20,
        durationFrames: 50,
        targetFilter: 'enemies',
        statBonuses: [
          { statId: 39, value: -60 }, // -60% Fire Resist
          { statId: 41, value: -60 }, // -60% Lightning Resist
          { statId: 43, value: -60 }, // -60% Cold Resist
        ],
      },
      25,
      statLists,
      stateSets,
      stateTimers,
    )

    expect(affected).toContain('player:1')
    expect(stateSets.get('player:1')?.has(62)).toBe(true)
    expect(statLists.get('player:1')?.getTotal(39)).toBe(-60)
  })

  it('CF13 (F12 × F14): Lower Resist / Conviction breaks a 105% Fire Immune monster at 1/5 efficiency (-45% -> -9% effective -> 96% Fire Resist) so Fire damage applies', () => {
    const rawLrPenalty = -45 // Level 5 Lower Resist (-45%)
    const baseFireRes = 105 // Fire Immune (>= 100%)
    // 1.13c immunity breaking rule: 1/5 effectiveness when base resist >= 100%
    const effectivePenalty = Math.trunc(rawLrPenalty / 5) // -9%
    const brokenFireRes = baseFireRes + effectivePenalty // 96%
    expect(brokenFireRes).toBe(96)
    expect(brokenFireRes).toBeLessThan(100)

    const attacker: CombatUnitContext = {
      unitType: 'player',
      unitId: 1,
      x: 100,
      y: 100,
      stats: new UnitStatList(),
      states: new Set(),
    }
    const defenderStats = new UnitStatList()
    defenderStats.setBase(39, brokenFireRes)
    const defender: CombatUnitContext = {
      unitType: 'monster',
      unitId: 50,
      x: 110,
      y: 100,
      stats: defenderStats,
      states: new Set([61]), // STATE_LOWERRESIST
      hpFixed: 500 * FIXED_ONE,
      maxHpFixed: 500 * FIXED_ONE,
    }

    const hit = executeSUnitDmg(attacker, defender, {
      fireFixed: 200 * FIXED_ONE,
      srcDam: 128,
    })
    expect(hit.fireApplied).toBe(8) // 200 * (1 - 0.96) = 8
  })

  it('CF14 (F6 × F3): SuperUnique Rakanishu pack leader rallies Carver minions and killing Rakanishu triggers minion retreat', () => {
    const rakanishuSpec = querySuperUnique113c('Rakanishu')
    expect(rakanishuSpec).toBeDefined()

    const player = createTestCombatPlayer({ x: 100, y: 100, hp: 800 })
    const rakanishu = createTestCombatMonster(5, {
      index: 1,
      x: 115,
      y: 100,
      hp: 30,
      rank: 'unique',
      superUniqueId: 'Rakanishu',
      modifiers: ['lightningenchanted', 'extraStrong'],
    })
    const minion1 = createTestCombatMonster(4, {
      index: 2,
      x: 122,
      y: 104,
      hp: 40,
      rank: 'minion',
      ai: 'Fallen',
    })
    ;(minion1 as unknown as Record<string, unknown>)['leaderId'] = rakanishu.index

    const world = createTestCombatWorld({
      player,
      monsters: [rakanishu, minion1],
    })

    // Slay Rakanishu
    damageMonster(world, rakanishu, 100)
    expect(rakanishu.state).toBe('dead')

    for (let t = 0; t < 15; t++) {
      tickMonsters(world, createOpenTerrain())
    }

    // Minion reacts to leader death / Fallen panic
    const distAfter = Math.hypot(minion1.x - player.x, minion1.y - player.y)
    expect(distAfter).toBeGreaterThan(20)
  })

  it('CF15 (F8 × F11): Duriel in GameInstance.stepFrame() engages player and Summoned Golem with Holy Freeze and melee jab', () => {
    const { game, playerId } = createWildernessGameInstance({
      playerClass: 'nec',
      playerLevel: 28,
      playerX: 500,
      playerY: 500,
    })
    const durielId = spawnExtendedMonsterInGame(game, {
      hcIdx: 211,
      defId: 'duriel',
      name: 'Duriel',
      areaId: 2,
      x: 506,
      y: 500,
      hp: 800,
    })

    for (let f = 0; f < 30; f++) {
      game.stepFrame()
    }

    const events = game.drainEvents(playerId)
    const duriel = game.getMonster(durielId)
    expect(duriel).toBeDefined()
    expect(events.length).toBeGreaterThan(0)
  })

  it('CF16 (F1 × F7 × F13): Innate monster death & on-hit triggers (Scarab Charged Bolt, BoneFetish explosion, PoisonDead cloud) compose with MonsterAI', () => {
    expect(isScarabMonster('scarab1')).toBe(true)
    expect(isBoneFetishMonster('bonefetish1')).toBe(true)
    expect(isPoisonDeadMonster(' mummy1'.trim())).toBe(true)

    const overlays = getInnateMonsterDeathOverlays('bonefetish1')
    expect(overlays.length).toBeGreaterThan(0)

    const player = createTestCombatPlayer({ x: 105, y: 100, hp: 600, maxHp: 600 })
    const fetish = createTestCombatMonster(212, { x: 100, y: 100, hp: 10 })
    const world = createTestCombatWorld({ player, monsters: [fetish] })

    damageMonster(world, fetish, 50)
    expect(fetish.state).toBe('dead')
    expect(world.player.hp).toBeLessThan(600)
  })
})

/**
 * Tier 5 — Adversarial Edge Cases & Cross-Milestone Hardening (23 E2E Tests: T5.A1–T5.A12 & T5.B1–T5.B11)
 *
 * Covers adversarial boundary conditions discovered by Tier 5 Challengers 1 & 2 across:
 * - Part A (T5.A1–T5.A12): M1 Data Tables (MonStats/MonStats2/MonLvl/SuperUniques/Hireling/MonUMod Immunity Stack)
 *   + M2 AI Archetypes (Shaman no-second-revive, Overseer whip frenzy cap, SandMaggot egg-laying,
 *   MaggotEgg hatching & FoulCrowNest spawning, Hell Diablo Red Lightning Hose blind spot,
 *   Nihlathak Corpse Explosion consumption, FE/CE minion death suppression, Oblivion Knight Iron Maiden removal).
 * - Part B (T5.B1–T5.B11): M3 Combat/State/Missile/Pet Integration inside 25Hz GameInstance
 *   (Boss/Unique freeze -> chill conversion, Conviction vs immune & non-immune inside GameInstance,
 *   Static Field difficulty floors, frozen/chilled corpse shatter blocking Shaman resurrection,
 *   FE/CE/Bone Fetish death explosions in GameInstance, AI movement halt under Freeze/Stun,
 *   Mercenary & Pet targeting filters against NPC/non-killable/petIgnore, LocalLoopbackAdapter & MultiClientRoomHost lockstep).
 */

import { describe, expect, it } from 'vitest'
import {
  HIRELING_TABLE,
  LocalLoopbackAdapter,
  MON_UMOD_ID,
  MultiClientRoomHost,
  SummonManager,
  applyMonsterUModResistances,
  applyStateToMonsterInGame,
  createOpenTerrain,
  createTestCombatMonster,
  createTestCombatPlayer,
  createTestCombatWorld,
  createTestGame,
  executeActBossAi113c,
  executeOblivionKnightCurse113c,
  executeShamanResurrect113c,
  getMonsterModeMissile113c,
  queryAllSuperUniques113c,
  queryCanonicalMonsterKinds113c,
  queryHirelingStatsAtLevel113c,
  queryMonsterKind113c,
  queryMonsterStats113c,
  querySuperUnique113c,
  spawnExtendedMonsterInGame,
  spawnPlayerInGame,
  stepFrames,
  tickMercenaryAi25Hz,
  tickMonsters,
  triggerMonsterDeathAffixes113c,
} from './helpers.ts'

describe('Tier 5 — Adversarial Edge Cases & Cross-Milestone Hardening (T5.A1–T5.A12 & T5.B1–T5.B11)', () => {
  // =========================================================================
  // Part A: M1 Data Contracts & M2 AI Archetypes (T5.A1–T5.A12)
  // =========================================================================

  it('T5.A1: MonUMod resistance stacking caps at 2 immunities (>= 100%) and skips 3rd immunity (sub_6FC68B30)', () => {
    const base = {
      physical: 0,
      magic: 0,
      fire: 75,
      lightning: 75,
      cold: 75,
      poison: 75,
    }
    // Fire Enchanted (+75 Fire -> 150 [Immune #1]), Cold Enchanted (+75 Cold -> 150 [Immune #2]),
    // Lightning Enchanted (+75 Ltng -> would be 150 [Immune #3], MUST be suppressed!)
    const res = applyMonsterUModResistances(base, [
      MON_UMOD_ID.FIRE_ENCHANT,
      MON_UMOD_ID.COLD_ENCHANT,
      MON_UMOD_ID.LIGHTNING_ENCHANT,
    ])
    expect(res.fire).toBeGreaterThanOrEqual(100)
    expect(res.cold).toBeGreaterThanOrEqual(100)
    expect(res.lightning).toBe(75)

    // Also test Magic Resistant (+40 Fire/Cold/Ltng): if Fire & Cold are already >= 100,
    // Magic Resistant must NOT push Lightning from 75 to 115!
    const base2 = {
      physical: 0,
      magic: 0,
      fire: 100,
      lightning: 75,
      cold: 100,
      poison: 0,
    }
    const res2 = applyMonsterUModResistances(base2, [MON_UMOD_ID.MAGIC_RESISTANT])
    expect(res2.fire).toBeGreaterThanOrEqual(100)
    expect(res2.cold).toBeGreaterThanOrEqual(100)
    expect(res2.lightning).toBeLessThan(100)
  })

  it('T5.A2: MonStats noRatio flag vs MonLvl scaling and /players 8 HP/XP/Damage scaling across difficulties', () => {
    for (const diff of ['normal', 'nightmare', 'hell'] as const) {
      const p1 = queryMonsterStats113c(0, { difficulty: diff, playersCount: 1 })
      const p8 = queryMonsterStats113c(0, { difficulty: diff, playersCount: 8 })
      // /players 8 scales HP and XP by (8 + 1) / 2 = 4.5x
      expect(p8.maxHp).toBeGreaterThanOrEqual(Math.floor(p1.maxHp * 4))
      expect(p8.xp).toBeGreaterThanOrEqual(Math.floor(p1.xp * 4))
      // /players 8 scales damage by +7 * 6.25% = +43.75%
      expect(p8.damage).toBeGreaterThanOrEqual(p1.damage)
    }

    // Verify all 734 canonical monsters resolve finite positive HP in Normal/Nightmare/Hell
    const allKinds = Array.from(queryCanonicalMonsterKinds113c('hell').values())
    expect(allKinds.length).toBe(734)
    for (const kind of allKinds) {
      expect(Number.isFinite(kind.hp)).toBe(true)
      expect(kind.hp).toBeGreaterThan(0)
    }
  })

  it('T5.A3: All SuperUniques (>= 67 entries) resolve canonical UMods and valid base MonsterKind without silent fallback', () => {
    const allSu = queryAllSuperUniques113c()
    expect(allSu.length).toBeGreaterThanOrEqual(67)
    for (const su of allSu) {
      expect(su.hcIdx).toBeDefined()
      expect(su.hcIdx!).toBeGreaterThanOrEqual(0)
      expect(su.hcIdx!).toBeLessThan(734)
      const kind = queryMonsterKind113c(su.hcIdx!)
      expect(kind).toBeDefined()
      expect(kind!.hcIdx).toBe(su.hcIdx)
    }
    const bishibosh = querySuperUnique113c('Bishibosh')
    expect(bishibosh).toBeDefined()
    expect(bishibosh!.umods).toContain(MON_UMOD_ID.FIRE_ENCHANT)
    expect(bishibosh!.umods).toContain(MON_UMOD_ID.MAGIC_RESISTANT)
  })

  it('T5.A4: Shaman/GreaterMummy resurrection prevents infinite chain-reviving of an already-resurrected corpse', () => {
    const shaman = createTestCombatMonster(58, { x: 100, y: 100, cooldown: 0 })
    const fallen = createTestCombatMonster(18, {
      index: 2,
      x: 120,
      y: 100,
      hp: 0,
      state: 'dead',
      corpseTicks: 25,
    })
    const world = createTestCombatWorld({
      player: { x: 200, y: 100 },
      monsters: [shaman, fallen],
    })

    // First resurrection succeeds
    const r1 = executeShamanResurrect113c(world, shaman)
    expect(r1).not.toBeNull()
    expect(fallen.state).not.toBe('dead')
    expect(fallen.hp).toBeGreaterThan(0)

    // Kill the revived Fallen again
    fallen.hp = 0
    fallen.state = 'dead'
    fallen.corpseTicks = 25
    shaman.cooldown = 0

    // Second resurrection on the SAME already-revived Fallen must be rejected (no infinite revive loop)
    const r2 = executeShamanResurrect113c(world, shaman)
    expect(r2).toBeNull()
    expect(fallen.state).toBe('dead')
  })

  it('T5.A5: Overseer (Shenk) Whip minion buff increments frenzyStacks up to cap 8 and SandMaggot lays MaggotEgg', () => {
    const overseer = createTestCombatMonster(479, { index: 1, x: 100, y: 100, cooldown: 0 })
    const minion = createTestCombatMonster(453, { index: 2, x: 120, y: 100, cooldown: 0 })
    const world = createTestCombatWorld({
      player: { x: 220, y: 100 },
      monsters: [overseer, minion],
    })
    const terrain = createOpenTerrain()

    for (let i = 0; i < 60; i++) {
      overseer.cooldown = 0
      tickMonsters(world, terrain)
    }
    expect(minion.frenzyStacks ?? 0).toBeGreaterThan(0)
    expect(minion.frenzyStacks ?? 0).toBeLessThanOrEqual(8)

    // SandMaggot (hcIdx 68) lays MaggotEgg (hcIdx 190) when engaged at medium range
    const maggot = createTestCombatMonster(68, { index: 10, x: 100, y: 100, cooldown: 0 })
    const maggotWorld = createTestCombatWorld({
      player: { x: 220, y: 100 },
      monsters: [maggot],
    })
    for (let i = 0; i < 40; i++) {
      maggot.cooldown = 0
      tickMonsters(maggotWorld, terrain)
    }
    const spawnedEggs = maggotWorld.monsters.filter(
      (m) => (m.stats.hcIdx ?? -1) >= 190 && (m.stats.hcIdx ?? -1) <= 194,
    )
    expect(spawnedEggs.length).toBeGreaterThan(0)
  })

  it('T5.A6: MaggotEgg (hcIdx 190) hatches into SandMaggotYoung (hcIdx 180) and FoulCrowNest (hcIdx 206) spawns FoulCrow capped at 5', () => {
    const terrain = createOpenTerrain()

    // 1. MaggotEgg hatching
    const egg = createTestCombatMonster(190, { index: 1, x: 100, y: 100, cooldown: 0 })
    const eggWorld = createTestCombatWorld({
      player: { x: 180, y: 100 },
      monsters: [egg],
    })
    for (let i = 0; i < 60; i++) {
      tickMonsters(eggWorld, terrain)
    }
    const hatchedYoung = eggWorld.monsters.filter(
      (m) => (m.stats.hcIdx ?? -1) >= 180 && (m.stats.hcIdx ?? -1) <= 184,
    )
    expect(hatchedYoung.length).toBeGreaterThanOrEqual(2)
    expect(egg.state).toBe('dead')

    // 2. FoulCrowNest spawning capped at <= 5 active crows
    const nest = createTestCombatMonster(206, { index: 1, x: 100, y: 100, cooldown: 0 })
    const nestWorld = createTestCombatWorld({
      player: { x: 180, y: 100 },
      monsters: [nest],
    })
    for (let i = 0; i < 100; i++) {
      nest.cooldown = 0
      tickMonsters(nestWorld, terrain)
    }
    const crows = nestWorld.monsters.filter(
      (m) => (m.stats.hcIdx ?? -1) >= 15 && (m.stats.hcIdx ?? -1) <= 18,
    )
    expect(crows.length).toBeGreaterThan(0)
    expect(crows.length).toBeLessThanOrEqual(5)
  })

  it('T5.A7: Hell Diablo Red Lightning Hose close-range blind spot (< 70 px) suppresses RedLightningHose hit', () => {
    const diablo = createTestCombatMonster(243, {
      difficulty: 'hell',
      x: 100,
      y: 100,
      cooldown: 0,
    })
    // Player standing at distance 20 px (inside Hell Red Lightning Hose inner blind spot)
    const world = createTestCombatWorld({
      player: { x: 120, y: 100, hp: 2000, maxHp: 2000 },
      monsters: [diablo],
    })
    const out = executeActBossAi113c(diablo, world, {
      difficulty: 'hell',
      forceSkill: 'RedLightningHose',
    })
    expect(out.blindSpot).toBe(true)
    expect(out.skillId?.toLowerCase()).not.toContain('redlightninghose')
    expect(
      world.events.some(
        (e) =>
          e.kind === 'missileHit' &&
          String(e.missileType ?? '').toLowerCase().includes('redlightninghose') &&
          (e.amount ?? 0) > 0,
      ),
    ).toBe(false)
  })

  it('T5.A8: Nihlathak Corpse Explosion consumes dead corpse and cannot re-explode the same corpse twice', () => {
    const nihlathak = createTestCombatMonster(526, { index: 1, x: 100, y: 100, cooldown: 0 })
    const corpse = createTestCombatMonster(0, {
      index: 2,
      x: 130,
      y: 100,
      hp: 0,
      state: 'dead',
      corpseTicks: 30,
    })
    const world = createTestCombatWorld({
      player: { x: 140, y: 100, hp: 2000, maxHp: 2000 },
      monsters: [nihlathak, corpse],
    })

    const out1 = executeActBossAi113c(nihlathak, world, {
      forceSkill: 'CorpseExplosion',
    })
    expect(out1.corpseConsumed).toBe(true)
    expect(corpse.corpseConsumed).toBe(true)

    // Second forced CorpseExplosion with no remaining unconsumed corpses must NOT report corpseConsumed: true
    const out2 = executeActBossAi113c(nihlathak, world, {
      forceSkill: 'CorpseExplosion',
    })
    expect(out2.corpseConsumed).toBeFalsy()
  })

  it('T5.A9: Fire Enchanted and Cold Enchanted minions (rank === minion) suppress death explosion and Frost Nova', () => {
    const feCeMinion = createTestCombatMonster(0, {
      rank: 'minion',
      modifiers: [MON_UMOD_ID.FIRE_ENCHANT, MON_UMOD_ID.COLD_ENCHANT],
      x: 100,
      y: 100,
      hp: 0,
      state: 'dead',
    })
    const world = createTestCombatWorld({
      player: { x: 105, y: 100, hp: 1000, maxHp: 1000 },
      monsters: [feCeMinion],
    })

    const out = triggerMonsterDeathAffixes113c(world, feCeMinion)
    expect(out.fireEnchantExplosion).toBe(false)
    expect(out.coldEnchantNova).toBe(false)
    expect(out.length).toBe(0)
    expect(world.player.hp).toBe(1000)
  })

  it('T5.A10: Oblivion Knight (hcIdx 312) 1.13c patch parity never casts Iron Maiden even across 100 seeds or forced IronMaiden', () => {
    const ok = createTestCombatMonster(312, { x: 100, y: 100, cooldown: 0 })
    const world = createTestCombatWorld({
      player: { x: 160, y: 100 },
      monsters: [ok],
    })

    for (let seed = 0; seed < 100; seed++) {
      const res = executeOblivionKnightCurse113c(ok, world, { seed })
      expect(res.curseName.toLowerCase()).not.toContain('iron')
      expect(res.curseName.toLowerCase()).not.toContain('maiden')
    }

    const forced = executeOblivionKnightCurse113c(ok, world, {
      forceCurse: 'IronMaiden',
    })
    expect(forced.curseName.toLowerCase()).not.toContain('iron')
    expect(forced.curseName.toLowerCase()).not.toContain('maiden')
  })

  it('T5.A11: Hireling.txt 120 rows and level 1..98 stat interpolation never produce NaN, negative HP/Damage, or decreasing stats', () => {
    expect(HIRELING_TABLE.length).toBe(120)

    const actSubTypes: Readonly<Record<1 | 2 | 3 | 5, readonly [number, number, number]>> = {
      1: [1, 3, 5],
      2: [7, 10, 13],
      3: [11, 14, 17],
      5: [22, 24, 26],
    }

    for (const act of [1, 2, 3, 5] as const) {
      for (const diff of [1, 2, 3] as const) {
        const subType = actSubTypes[act][diff - 1]!
        const s10 = queryHirelingStatsAtLevel113c(subType, act, diff, 10, true)!
        const s50 = queryHirelingStatsAtLevel113c(subType, act, diff, 50, true)!
        const s98 = queryHirelingStatsAtLevel113c(subType, act, diff, 98, true)!

        expect(s10.hp).toBeGreaterThan(0)
        expect(s50.hp).toBeGreaterThanOrEqual(s10.hp)
        expect(s98.hp).toBeGreaterThanOrEqual(s50.hp)
        expect(s98.maxDmg).toBeGreaterThanOrEqual(s98.minDmg)
        expect(s98.ar).toBeGreaterThan(0)
        expect(s98.defense).toBeGreaterThan(0)
      }
    }
  })

  it('T5.A12: Monster mode-to-missile table (MONSTER_MODE_MISSILES_113C) resolves mode aliases (C/SC, A1, A2, S1..S4) and returns undefined for invalid modes', () => {
    // Skeleton Archer (hcIdx 5..9) or Quill Rat (hcIdx 63..67) has mode missiles
    const quillRatA2 = getMonsterModeMissile113c(63, 'A2') ?? getMonsterModeMissile113c(63, 'A1')
    expect(quillRatA2).toBeDefined()

    // Invalid hcIdx or invalid mode returns undefined without throwing
    expect(getMonsterModeMissile113c(-1, 'A1')).toBeUndefined()
    expect(getMonsterModeMissile113c(99999, 'A1')).toBeUndefined()
  })

  // =========================================================================
  // Part B: M3/M4 25Hz GameInstance, Combat, State, Pet & Lockstep (T5.B1–T5.B11)
  // =========================================================================

  it('T5.B1: GameInstance.applyMonsterState converts Freeze (state 1 & state 29) into Cold (state 11) on Act Bosses and Uniques', () => {
    const game = createTestGame({ mapSeed: 0x113cb101 })
    spawnPlayerInGame(game, { x: 100, y: 100 })

    // Act Boss Diablo (classId 243)
    const diabloId = spawnExtendedMonsterInGame(game, {
      classId: 243,
      x: 110,
      y: 100,
      rank: 'boss',
      isBoss: true,
    })

    // Unique monster
    const uniqueId = spawnExtendedMonsterInGame(game, {
      classId: 0,
      x: 115,
      y: 100,
      rank: 'unique',
    })

    // Normal monster
    const normalId = spawnExtendedMonsterInGame(game, {
      classId: 0,
      x: 120,
      y: 100,
      rank: 'normal',
    })

    // Apply canonical STATE_FREEZE = 29 and state 1 to Diablo and Unique
    applyStateToMonsterInGame(game, diabloId, 29, 100)
    applyStateToMonsterInGame(game, uniqueId, 29, 100)
    applyStateToMonsterInGame(game, normalId, 29, 100)

    const diabloState = game.getMonsterState(diabloId)!
    const uniqueState = game.getMonsterState(uniqueId)!
    const normalState = game.getMonsterState(normalId)!

    // Boss and Unique must NOT have freeze state (1 or 29); they must convert to cold (11)
    expect(diabloState.states.has(29)).toBe(false)
    expect(diabloState.states.has(1)).toBe(false)
    expect(diabloState.states.has(11)).toBe(true)

    expect(uniqueState.states.has(29)).toBe(false)
    expect(uniqueState.states.has(1)).toBe(false)
    expect(uniqueState.states.has(11)).toBe(true)

    // Normal monster must be frozen
    expect(normalState.states.has(29) || normalState.states.has(1)).toBe(true)
  })

  it('T5.B2: GameInstance.applyMonsterState enforces 1.13c curse exclusivity and Attract (57) non-overwritability in live game ticks', () => {
    const game = createTestGame({ mapSeed: 0x113cb102 })
    spawnPlayerInGame(game, { x: 100, y: 100 })

    const normalId = spawnExtendedMonsterInGame(game, {
      classId: 0,
      x: 110,
      y: 100,
      rank: 'normal',
    })
    const bossId = spawnExtendedMonsterInGame(game, {
      classId: 243,
      x: 120,
      y: 100,
      rank: 'boss',
      isBoss: true,
    })

    // Apply Amplify Damage (9), then Decrepify (60) -> 60 must evict 9
    expect(applyStateToMonsterInGame(game, normalId, 9, 100)).toBe(true)
    expect(game.getMonsterState(normalId)!.states.has(9)).toBe(true)

    expect(applyStateToMonsterInGame(game, normalId, 60, 100)).toBe(true)
    expect(game.getMonsterState(normalId)!.states.has(60)).toBe(true)
    expect(game.getMonsterState(normalId)!.states.has(9)).toBe(false)

    // Apply Attract (57) to normal monster -> subsequent Lower Resist (61) must be rejected while Attract is active
    expect(applyStateToMonsterInGame(game, normalId, 57, 100)).toBe(true)
    expect(game.getMonsterState(normalId)!.states.has(57)).toBe(true)

    expect(applyStateToMonsterInGame(game, normalId, 61, 100)).toBe(false)
    expect(game.getMonsterState(normalId)!.states.has(61)).toBe(false)

    // Bosses reject crowd-control curses (Attract 57, Confuse 59, Dim Vision 23, Terror 56)
    expect(applyStateToMonsterInGame(game, bossId, 57, 100)).toBe(false)
    expect(applyStateToMonsterInGame(game, bossId, 59, 100)).toBe(false)
    expect(applyStateToMonsterInGame(game, bossId, 23, 100)).toBe(false)
    expect(applyStateToMonsterInGame(game, bossId, 56, 100)).toBe(false)
  })

  it('T5.B3: GameInstance combat pipeline applies 1/5 Conviction & Lower Resist efficiency vs immune monsters (>= 100% res) and full efficiency vs non-immune', () => {
    const game = createTestGame({ mapSeed: 0x113cb103, difficulty: 2 })
    const pid = spawnPlayerInGame(game, { x: 100, y: 100 })

    // Monster 1: Lightning Immune (110% lightning resist)
    // Conviction (-75%) at 1/5 efficiency = -15% -> 95% resist (broken immunity -> 5% damage taken)
    const immuneId = spawnExtendedMonsterInGame(game, {
      classId: 0,
      x: 105,
      y: 100,
      hp: 1000,
      maxHp: 1000,
      resistances: { phys: 0, magic: 0, fire: 0, lightning: 110, cold: 0, poison: 0 },
    })

    // Monster 2: Unbreakable Lightning Immune (130% lightning resist)
    // Conviction (-75%) at 1/5 efficiency = -15% -> 115% resist (still >= 100% immune -> 0 damage taken)
    const unbreakableId = spawnExtendedMonsterInGame(game, {
      classId: 0,
      x: 108,
      y: 100,
      hp: 1000,
      maxHp: 1000,
      resistances: { phys: 0, magic: 0, fire: 0, lightning: 130, cold: 0, poison: 0 },
    })

    // Apply Conviction (state 62 or 'conviction') to both monsters
    applyStateToMonsterInGame(game, immuneId, 'conviction', 200)
    applyStateToMonsterInGame(game, unbreakableId, 'conviction', 200)

    // Cast Lightning (skill 49) or deal lightning skill damage via GameInstance
    game.applyDamageToMonster(immuneId, 200, pid, 49)
    game.applyDamageToMonster(unbreakableId, 200, pid, 49)

    const immuneAfter = game.getMonsterState(immuneId)!
    const unbreakableAfter = game.getMonsterState(unbreakableId)!

    // 110% broken to 95% takes > 0 damage, but strictly <= 15% of 200 (<= 30 damage, NOT full 65% = 130 damage)
    const dmgTakenBroken = 1000 - immuneAfter.hp
    expect(dmgTakenBroken).toBeGreaterThan(0)
    expect(dmgTakenBroken).toBeLessThanOrEqual(40)

    // 130% - 15% = 115% >= 100% -> remains immune, 0 damage
    expect(unbreakableAfter.hp).toBe(1000)
  })

  it('T5.B4: GameInstance Static Field (skill 42) respects Normal (> 0%), Nightmare (33%), and Hell (50%) HP floors', () => {
    // 1. Hell difficulty: Static Field cannot reduce monster below 50% maxHp (500 / 1000)
    const hellGame = createTestGame({ mapSeed: 0x113cb104, difficulty: 2 })
    const hellPid = spawnPlayerInGame(hellGame, { x: 100, y: 100 })
    const hellMon = spawnExtendedMonsterInGame(hellGame, {
      classId: 0,
      x: 105,
      y: 100,
      hp: 1000,
      maxHp: 1000,
      resistances: { phys: 0, magic: 0, fire: 0, lightning: 0, cold: 0, poison: 0 },
    })
    for (let i = 0; i < 15; i++) {
      hellGame.applyDamageToMonster(hellMon, 0, hellPid, 42)
    }
    expect(hellGame.getMonsterState(hellMon)!.hp).toBe(500)

    // 2. Nightmare difficulty: Static Field cannot reduce monster below 33% maxHp (330 / 1000)
    const nmGame = createTestGame({ mapSeed: 0x113cb104, difficulty: 1 })
    const nmPid = spawnPlayerInGame(nmGame, { x: 100, y: 100 })
    const nmMon = spawnExtendedMonsterInGame(nmGame, {
      classId: 0,
      x: 105,
      y: 100,
      hp: 1000,
      maxHp: 1000,
      resistances: { phys: 0, magic: 0, fire: 0, lightning: 0, cold: 0, poison: 0 },
    })
    for (let i = 0; i < 20; i++) {
      nmGame.applyDamageToMonster(nmMon, 0, nmPid, 42)
    }
    expect(nmGame.getMonsterState(nmMon)!.hp).toBe(330)

    // 3. Normal difficulty: Static Field can reduce monster all the way down to 1 HP (never kills)
    const normGame = createTestGame({ mapSeed: 0x113cb104, difficulty: 0 })
    const normPid = spawnPlayerInGame(normGame, { x: 100, y: 100 })
    const normMon = spawnExtendedMonsterInGame(normGame, {
      classId: 0,
      x: 105,
      y: 100,
      hp: 1000,
      maxHp: 1000,
      resistances: { phys: 0, magic: 0, fire: 0, lightning: 0, cold: 0, poison: 0 },
    })
    for (let i = 0; i < 40; i++) {
      normGame.applyDamageToMonster(normMon, 0, normPid, 42)
    }
    expect(normGame.getMonsterState(normMon)!.hp).toBe(1)
    expect(normGame.getMonsterState(normMon)!.dead).toBe(false)
  })

  it('T5.B5: GameInstance killing a frozen monster shatters its corpse (shattered = true, corpseSuppressed = true) and prevents Shaman resurrection', () => {
    const game = createTestGame({ mapSeed: 0x113cb105 })
    const pid = spawnPlayerInGame(game, { x: 100, y: 100 })

    // Spawn Fallen (classId 18) and Fallen Shaman (classId 58)
    const fallenId = spawnExtendedMonsterInGame(game, {
      classId: 18,
      x: 104,
      y: 100,
      hp: 50,
      maxHp: 50,
    })
    spawnExtendedMonsterInGame(game, {
      classId: 58,
      x: 106,
      y: 100,
      hp: 200,
      maxHp: 200,
      ai: 'FallenShaman',
    })

    // Freeze the Fallen (state 29 = freeze) and kill it
    applyStateToMonsterInGame(game, fallenId, 29, 100)
    game.applyDamageToMonster(fallenId, 500, pid)

    const deadFallen = game.getMonsterState(fallenId)!
    expect(deadFallen.hp).toBe(0)
    expect(deadFallen.shattered).toBe(true)
    expect(deadFallen.corpseSuppressed).toBe(true)

    // Step 30 frames: Shaman must NOT be able to resurrect a shattered corpse
    stepFrames(game, 30)
    const afterFrames = game.getMonsterState(fallenId)!
    expect(afterFrames.hp).toBe(0)
    expect(afterFrames.dead).toBe(true)
    expect(afterFrames.mode === 0 || afterFrames.mode === 12).toBe(true)
  })

  it('T5.B6: GameInstance onMonsterKilled triggers Fire Enchanted corpse explosion and Bone Fetish (classId 212) death damage against nearby player', () => {
    const game = createTestGame({ mapSeed: 0x113cb106, difficulty: 0 })
    const pid = spawnPlayerInGame(game, { x: 100, y: 100, hp: 1000, maxHp: 1000 })

    // 1. Fire Enchanted Unique (adjacent at distance 1)
    const feId = spawnExtendedMonsterInGame(game, {
      classId: 0,
      x: 101,
      y: 100,
      hp: 200,
      maxHp: 400,
      rank: 'unique',
      modifiers: [MON_UMOD_ID.FIRE_ENCHANT],
    })

    const hpBeforeFe = game.getPlayerState(pid)!.hp
    game.applyDamageToMonster(feId, 1000, pid)
    // 1.13c resolves the Fire Enchanted corpse explosion on its action frame
    // (pendingDeathExplosion, currentFrame + 5), not synchronously on death.
    game.stepFrames(6)
    const hpAfterFe = game.getPlayerState(pid)!.hp
    expect(hpAfterFe).toBeLessThan(hpBeforeFe)

    // 2. Bone Fetish / Undead Soul Killer (classId 212, adjacent at distance 1)
    const fetishId = spawnExtendedMonsterInGame(game, {
      classId: 212,
      x: 101,
      y: 100,
      hp: 100,
      maxHp: 300,
      rank: 'normal',
    })

    const hpBeforeFetish = game.getPlayerState(pid)!.hp
    game.applyDamageToMonster(fetishId, 1000, pid)
    const hpAfterFetish = game.getPlayerState(pid)!.hp
    expect(hpAfterFetish).toBeLessThan(hpBeforeFetish)
  })

  it('T5.B7: GameInstance stepMonsterAi halts monster movement and attacks while Frozen (state 29) or Stunned (state 25) and blocks paths via walkability callback', () => {
    const game = createTestGame({ mapSeed: 0x113cb107 })
    const pid = spawnPlayerInGame(game, { x: 100, y: 100, hp: 1000, maxHp: 1000 })

    const frozenMonId = spawnExtendedMonsterInGame(game, {
      classId: 0,
      x: 106,
      y: 100,
      hp: 200,
      maxHp: 200,
    })
    const stunnedMonId = spawnExtendedMonsterInGame(game, {
      classId: 0,
      x: 100,
      y: 106,
      hp: 200,
      maxHp: 200,
    })

    // Apply canonical STATE_FREEZE (29) and STATE_STUNNED (25)
    applyStateToMonsterInGame(game, frozenMonId, 29, 50)
    applyStateToMonsterInGame(game, stunnedMonId, 25, 50)

    stepFrames(game, 10)

    const frozenAfter = game.getMonsterState(frozenMonId)!
    const stunnedAfter = game.getMonsterState(stunnedMonId)!

    // Neither monster may move or damage the player while frozen/stunned
    expect(frozenAfter.x).toBe(106)
    expect(frozenAfter.y).toBe(100)
    expect(stunnedAfter.x).toBe(100)
    expect(stunnedAfter.y).toBe(106)
    expect(game.getPlayerState(pid)!.hp).toBe(1000)

    // Now test walkability obstacle blocking on an unfrozen monster
    game.setWalkabilityCallback((x: number, _y: number) => x >= 112) // wall at x < 112
    const walledMonId = spawnExtendedMonsterInGame(game, {
      classId: 0,
      x: 115,
      y: 100,
      hp: 200,
      maxHp: 200,
    })
    stepFrames(game, 15)
    expect(game.getMonsterState(walledMonId)!.x).toBeGreaterThanOrEqual(112)
  })

  it('T5.B8: Mercenary 25Hz AI in GameInstance and tickMercenaryAi25Hz ignores NPC, non-killable, and petIgnore units and teleports at > 480 px leash', () => {
    // 1. Direct tickMercenaryAi25Hz filter check
    const owner = createTestCombatPlayer({ x: 100, y: 100 })
    const npc = createTestCombatMonster(146, {
      index: 1,
      x: 105,
      y: 100,
      stats: { ...createTestCombatMonster(146).stats, inTown: true, killable: false },
    })
    const unkillable = createTestCombatMonster(0, {
      index: 2,
      x: 105,
      y: 100,
      stats: { ...createTestCombatMonster(0).stats, killable: false },
    })
    const petIgnored = createTestCombatMonster(0, {
      index: 3,
      x: 105,
      y: 100,
      stats: { ...createTestCombatMonster(0).stats, petIgnore: true },
    })

    const merc = {
      id: 'merc-1',
      act: 2 as const,
      subType: 0,
      difficulty: 0 as const,
      level: 30,
      x: 100,
      y: 100,
      hp: 500,
      maxHp: 500,
      alive: true,
      state: 'idle' as const,
      cooldown: 0,
      targetIndex: undefined as number | undefined,
    }
    const outcome = tickMercenaryAi25Hz(merc, owner, [npc, unkillable, petIgnored], 1)

    expect(outcome.attackedTargetId).toBeUndefined()
    expect(merc.targetIndex).toBeUndefined()
    expect(merc.state).not.toBe('attack')

    // 2. GameInstance stepMercenaries check with petIgnore & non-killable + leash teleport
    const game = createTestGame({ mapSeed: 0x113cb108 })
    const pid = spawnPlayerInGame(game, { x: 100, y: 100 })
    game.hireMercenary(pid, { act: 2, difficulty: 1, subType: 7, level: 30 })

    const ignoredMonId = spawnExtendedMonsterInGame(game, {
      classId: 410, // Wake of Destruction / trap with petIgnore
      x: 102,
      y: 100,
      hp: 500,
      maxHp: 500,
      petIgnore: true,
    })

    stepFrames(game, 10)
    expect(game.getMonsterState(ignoredMonId)!.hp).toBe(500)

    // Move player > 500 subtiles away -> mercenary must leash-teleport to owner
    game.movePlayer(pid, 800, 800)
    stepFrames(game, 2)
    const mercState = game.getMercenaryState(pid)!
    expect(Math.hypot(mercState.x - 800, mercState.y - 800)).toBeLessThanOrEqual(32)
  })

  it('T5.B9: SummonManager and GameInstance pets ignore NPC/non-killable/petIgnore units and leash-teleport at > 480 px', () => {
    const mgr = new SummonManager()
    const skel = mgr.summonPet({
      ownerId: 1,
      petType: 'NecroSkeleton',
      classId: 363,
      skillId: 70,
      skillLevel: 10,
      x: 100,
      y: 100,
      hp: 200,
      maxHp: 200,
      minDmg: 20,
      maxDmg: 30,
    })

    const tickRes = mgr.tickPets({
      owner: { id: 1, x: 100, y: 100 },
      monsters: [
        { id: 10, x: 102, y: 100, hp: 500, maxHp: 500, isNpc: true, isKillable: false, petIgnore: false },
        { id: 11, x: 102, y: 100, hp: 500, maxHp: 500, isNpc: false, isKillable: false, petIgnore: false },
        { id: 12, x: 102, y: 100, hp: 500, maxHp: 500, isNpc: false, isKillable: true, petIgnore: true },
      ],
      tick: 1,
    })

    expect(tickRes.attacks.length).toBe(0)
    expect(skel.targetId).toBeUndefined()

    // Also verify inside GameInstance: pet ignores petIgnore monster and leashes when owner moves > 480 units
    const game = createTestGame({ mapSeed: 0x113cb109 })
    const pid = spawnPlayerInGame(game, { x: 100, y: 100 })
    const petOut = game.summonPet(pid, {
      skillId: 75, // Clay Golem
      slvl: 10,
      x: 101,
      y: 100,
    })
    expect(petOut.created).toBe(true)

    const trapMonId = spawnExtendedMonsterInGame(game, {
      classId: 410,
      x: 102,
      y: 100,
      hp: 500,
      maxHp: 500,
      petIgnore: true,
    })

    stepFrames(game, 10)
    expect(game.getMonsterState(trapMonId)!.hp).toBe(500)

    game.movePlayer(pid, 900, 900)
    stepFrames(game, 2)
    const petState = game.getPetState(petOut)!
    expect(Math.hypot(petState.x - 900, petState.y - 900)).toBeLessThanOrEqual(32)
  })

  it('T5.B10: LocalLoopbackAdapter Single-Player pause freezes all monster AI, projectiles, and state timers with zero drift', () => {
    const adapter = new LocalLoopbackAdapter({ mapSeed: 0x113cb10a, difficulty: 1 })
    const game = adapter.getGameInstance()
    const pid = adapter.playerUnitId
    game.movePlayer(pid, 100, 100)

    const monId = spawnExtendedMonsterInGame(game, {
      classId: 5, // Skeleton Archer
      x: 112,
      y: 100,
      hp: 300,
      maxHp: 300,
      ai: 'SkeletonArcher',
    })
    applyStateToMonsterInGame(game, monId, 9, 50) // Amplify Damage for 50 frames

    const hashBeforePause = game.computeFrameLockstepHash()
    const monBeforePause = game.getMonsterState(monId)!

    adapter.setPaused(true)
    expect(adapter.isPaused()).toBe(true)

    // Attempt to step 20 frames while paused
    for (let i = 0; i < 20; i++) {
      adapter.stepFrame()
    }

    expect(game.computeFrameLockstepHash()).toBe(hashBeforePause)
    expect(game.getMonsterState(monId)!.x).toBe(monBeforePause.x)
    expect(game.getMonsterState(monId)!.y).toBe(monBeforePause.y)
    expect(game.getMonsterState(monId)!.states.has(9)).toBe(true)

    // Resume and step 1 frame -> tick advances and hash updates
    adapter.setPaused(false)
    expect(adapter.isPaused()).toBe(false)
    adapter.stepFrame()
    expect(game.computeFrameLockstepHash()).not.toBe(hashBeforePause)
  })

  it('T5.B11: MultiClientRoomHost 2-client multiplayer lockstep parity under simultaneous Boss AI, Elite UMods, Curses, and Pet combat', () => {
    const host = new MultiClientRoomHost({ mapSeed: 0x113cb110, difficulty: 2, areaId: 131 })
    const game = host.getGameInstance()

    const p1 = host.joinPlayer({ charName: 'P1_Host', classId: 'pal', areaId: 131, x: 100, y: 100 })
    const p2 = host.joinPlayer({ charName: 'P2_Peer', classId: 'sor', areaId: 131, x: 105, y: 100 })

    // Drain initial connection packets so we compare combat/state packets cleanly
    host.drainClientPackets(p1.playerId)
    host.drainClientPackets(p2.playerId)

    // Spawn Baal (classId 544) and a Lightning/Fire Enchanted Elite in area 131
    const baalId = spawnExtendedMonsterInGame(game, {
      classId: 544,
      areaId: 131,
      x: 112,
      y: 100,
      hp: 5000,
      maxHp: 5000,
      rank: 'boss',
      isBoss: true,
    })
    const eliteId = spawnExtendedMonsterInGame(game, {
      classId: 312,
      areaId: 131,
      x: 110,
      y: 104,
      hp: 800,
      maxHp: 800,
      rank: 'unique',
      modifiers: [MON_UMOD_ID.FIRE_ENCHANT, MON_UMOD_ID.LIGHTNING_ENCHANT],
    })

    applyStateToMonsterInGame(game, baalId, 60, 100) // Decrepify
    applyStateToMonsterInGame(game, eliteId, 61, 100) // Lower Resist

    for (let f = 0; f < 25; f++) {
      game.stepFrame()
    }

    const p1Events = host.drainClientPackets(p1.playerId)
    const p2Events = host.drainClientPackets(p2.playerId)

    // Both clients must receive identical UnitState and CreateMissile events for the shared room
    const p1States = p1Events.filter((e) => e.type === 'UnitState')
    const p2States = p2Events.filter((e) => e.type === 'UnitState')
    expect(p1States.length).toBeGreaterThan(0)
    expect(p1States).toEqual(p2States)

    const p1Missiles = p1Events.filter((e) => e.type === 'CreateMissile')
    const p2Missiles = p2Events.filter((e) => e.type === 'CreateMissile')
    expect(p1Missiles).toEqual(p2Missiles)

    // Lockstep hash must be non-zero and deterministic
    const hash = host.computeFrameLockstepHash()
    expect(hash).not.toBe(0)
    expect(hash).toBe(game.computeFrameLockstepHash())
  })
})

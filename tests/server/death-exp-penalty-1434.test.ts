/**
 * Issue #1434: 1.13c player death experience penalty (`D2Game.dll` `0x6FC583A0` & `0x6FC57730`)
 * reading `DeathExpPenalty` (`0 / 5 / 10` for Normal / Nightmare / Hell) from `DifficultyLevels.txt`.
 */
import { describe, expect, it } from 'vitest'
import {
  calculateDeathExperiencePenalty113c,
  evaluateDeathExperiencePenalty113c,
  getDeathExpPenaltyPct113c,
  getExpThreshold113c,
  isPlayerOrPlayerPetKiller113c,
} from '../../src/common/progression/experience-113c.ts'
import { getExperienceForLevel } from '../../src/common/skills/formulas.ts'
import { difficultyDeathExpPenalty } from '../../src/server/engine/difficulty-resist-penalty.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

type AnyRecord = Record<string, any>

function internal(game: GameInstance): AnyRecord {
  return game as unknown as AnyRecord
}

describe('Issue #1434: 1.13c DeathExpPenalty (D2Game.dll 0x6FC583A0 & 0x6FC57730)', () => {
  it('reads DeathExpPenalty (0 / 5 / 10) from DifficultyLevels.txt (record offset +0x04)', () => {
    expect(difficultyDeathExpPenalty(0)).toBe(0)
    expect(difficultyDeathExpPenalty(1)).toBe(5)
    expect(difficultyDeathExpPenalty(2)).toBe(10)
    expect(() => difficultyDeathExpPenalty(3)).toThrow(/DifficultyLevels\.txt/)

    expect(getDeathExpPenaltyPct113c(0)).toBe(0)
    expect(getDeathExpPenaltyPct113c(1)).toBe(5)
    expect(getDeathExpPenaltyPct113c(2)).toBe(10)
    expect(getDeathExpPenaltyPct113c('normal')).toBe(0)
    expect(getDeathExpPenaltyPct113c('nightmare')).toBe(5)
    expect(getDeathExpPenaltyPct113c('hell')).toBe(10)
  })

  it('resolves D2Common #10399 (0x6FDAE810) Experience.txt thresholds for rows 0..99', () => {
    expect(getExpThreshold113c(0)).toBe(0) // level 1 threshold
    expect(getExpThreshold113c(1)).toBe(500) // level 2 threshold
    expect(getExpThreshold113c(9)).toBe(57_715) // level 10 threshold
    expect(getExpThreshold113c(10)).toBe(72_144) // level 11 threshold
    expect(getExpThreshold113c(98)).toBe(3_520_485_254) // level 99 threshold
    expect(getExpThreshold113c(99)).toBe(3_837_739_017) // row 99 cap
  })

  it('deducts 0% in Normal, 5% in Nightmare, and 10% in Hell of the current level XP span (0x6FC57730)', () => {
    // Level 10: minExp = 57,715 (row 9), nextExp = 72,144 (row 10), span = 14,429
    const clvl = 10
    const minExp = getExperienceForLevel(10) // 57,715
    const nextExp = getExperienceForLevel(11) // 72,144
    const span = nextExp - minExp // 14,429
    const currentExp = 65_000

    // Normal (0%): no loss
    expect(calculateDeathExperiencePenalty113c(clvl, currentExp, 0, 'monster')).toBe(currentExp)

    // Nightmare (5%): floor(14429 * 5 / 100) = 721 -> 65000 - 721 = 64279
    const nmLoss = Math.floor((span * 5) / 100)
    expect(nmLoss).toBe(721)
    expect(calculateDeathExperiencePenalty113c(clvl, currentExp, 1, 'monster')).toBe(
      currentExp - nmLoss,
    )

    // Hell (10%): floor(14429 * 10 / 100) = 1442 -> 65000 - 1442 = 63558
    const hellLoss = Math.floor((span * 10) / 100)
    expect(hellLoss).toBe(1442)
    expect(calculateDeathExperiencePenalty113c(clvl, currentExp, 2, 'monster')).toBe(
      currentExp - hellLoss,
    )
  })

  it('clamps post-death XP to threshold + 1 without de-leveling and records actual expLost (0x6FC577A4..0x6FC577B2)', () => {
    const clvl = 10
    const minExp = getExperienceForLevel(10) // 57,715
    const nearFloorExp = minExp + 285 // 58,000 (less than Hell loss 1,442)

    const evalHell = evaluateDeathExperiencePenalty113c({
      clvl,
      currentExp: nearFloorExp,
      difficulty: 2,
      killerType: 'monster',
    })
    expect(evalHell.rawLoss).toBe(1442)
    expect(evalHell.newExp).toBe(minExp + 1) // 57,716 (lea edi, [ebx + 1])
    expect(evalHell.expLost).toBe(285) // currentExp - minExp ([pClient + 0x508])

    // Subsequent death at minExp + 1 stays at minExp + 1
    expect(calculateDeathExperiencePenalty113c(clvl, minExp + 1, 2, 'monster')).toBe(minExp + 1)

    // Exact threshold (currentExp === minExp) never increases XP
    expect(calculateDeathExperiencePenalty113c(clvl, minExp, 2, 'monster')).toBe(minExp)

    // Level 1 never loses XP (0x6FC5775B: cmp esi, 1; jle)
    expect(calculateDeathExperiencePenalty113c(1, 350, 2, 'monster')).toBe(350)
  })

  it('skips death XP penalty when killed by a player or a player summon/mercenary (0x6FC583AD..0x6FC583E3)', () => {
    const clvl = 20
    const currentExp = 600_000 // between 537,513 (lvl 20) and 671,891 (lvl 21)

    for (const killerType of ['player', 'player_pet', 'pet', 'summon', 'mercenary', 'hireling', 0] as const) {
      expect(isPlayerOrPlayerPetKiller113c(killerType)).toBe(true)
      expect(calculateDeathExperiencePenalty113c(clvl, currentExp, 2, killerType)).toBe(currentExp)
    }

    for (const killerType of ['monster', 'trap', 'object', 'shrine', 'environment', undefined] as const) {
      expect(isPlayerOrPlayerPetKiller113c(killerType)).toBe(false)
      expect(calculateDeathExperiencePenalty113c(clvl, currentExp, 2, killerType)).toBe(
        currentExp - Math.floor(((671_891 - 537_513) * 10) / 100),
      )
    }
  })

  it('applies DeathExpPenalty in GameInstance across Normal/Nightmare/Hell and emits UnitStatUpdate(13) + Experience', () => {
    // 1. Hell difficulty monster kill: -10% of level 10 span (1,442 XP)
    const hellGame = new GameInstance({ seed: 14340, areaId: 1, difficulty: 2 })
    const hellPid = hellGame.connectPlayer({
      name: 'HellHero',
      charClass: 'sor',
      level: 10,
      experience: 65_000,
      hp: 50,
      maxHp: 50,
      x: 100,
      y: 100,
    })
    hellGame.drainEvents(hellPid)
    hellGame.applyDamageToPlayer(hellPid, 100, { killerType: 'monster' })

    const hellSnap = hellGame.getPlayerState(hellPid)!
    expect(hellSnap.dead).toBe(true)
    expect(hellSnap.level).toBe(10)
    expect(hellSnap.experience).toBe(65_000 - 1442)
    expect(internal(hellGame).players.get(hellPid).lastDeathExpLoss).toBe(1442)

    const hellEvents = hellGame.drainEvents(hellPid)
    expect(hellEvents).toContainEqual({
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: hellPid,
      statId: 13,
      value: 63_558,
    })
    expect(hellEvents).toContainEqual({
      type: 'Experience',
      value: 63_558,
      isDelta: false,
    })

    // 2. Nightmare difficulty monster kill: -5% of level 10 span (721 XP)
    const nmGame = new GameInstance({ seed: 14341, areaId: 1, difficulty: 1 })
    const nmPid = nmGame.connectPlayer({
      name: 'NmHero',
      charClass: 'pal',
      level: 10,
      experience: 65_000,
      hp: 50,
      maxHp: 50,
      x: 100,
      y: 100,
    })
    nmGame.drainEvents(nmPid)
    nmGame.applyDamageToPlayer(nmPid, 100, { killerType: 'monster' })
    expect(nmGame.getPlayerState(nmPid)!.experience).toBe(65_000 - 721)

    // 3. Normal difficulty monster kill: 0% loss
    const normGame = new GameInstance({ seed: 14342, areaId: 1, difficulty: 0 })
    const normPid = normGame.connectPlayer({
      name: 'NormHero',
      charClass: 'bar',
      level: 10,
      experience: 65_000,
      hp: 50,
      maxHp: 50,
      x: 100,
      y: 100,
    })
    normGame.drainEvents(normPid)
    normGame.applyDamageToPlayer(normPid, 100, { killerType: 'monster' })
    expect(normGame.getPlayerState(normPid)!.experience).toBe(65_000)
    expect(normGame.drainEvents(normPid).some((ev) => ev.type === 'Experience')).toBe(false)
  })

  it('clamps to threshold + 1 without de-leveling and skips penalty on PvP / player-pet kills in GameInstance', () => {
    const game = new GameInstance({ seed: 14343, areaId: 1, difficulty: 2, maxPlayers: 4 })
    const p1 = game.connectPlayer({
      name: 'NearFloor',
      charClass: 'ama',
      level: 10,
      experience: 57_915, // 200 above 57,715
      hp: 50,
      maxHp: 50,
      x: 100,
      y: 100,
    })
    const p2 = game.connectPlayer({
      name: 'PvpVictim',
      charClass: 'nec',
      level: 10,
      experience: 65_000,
      hp: 50,
      maxHp: 50,
      x: 102,
      y: 100,
    })
    const p3 = game.connectPlayer({
      name: 'PetVictim',
      charClass: 'dru',
      level: 10,
      experience: 65_000,
      hp: 50,
      maxHp: 50,
      x: 104,
      y: 100,
    })
    const mercId = game.hireMercenary(p1, {
      act: 2,
      subType: 7,
      level: 10,
      difficulty: 1,
      x: 101,
      y: 100,
    })

    // p1 dies to a monster near level 10 threshold: clamped to 57,716 (threshold + 1), stays level 10
    game.applyDamageToPlayer(p1, 100, { killerType: 'monster' })
    const s1 = game.getPlayerState(p1)!
    expect(s1.level).toBe(10)
    expect(s1.experience).toBe(57_716)

    // p2 dies to player p1 (resolved via killerUnitId): 0 XP lost
    game.applyDamageToPlayer(p2, 100, { killerUnitId: p1 })
    expect(game.getPlayerState(p2)!.experience).toBe(65_000)

    // p3 dies to player mercenary mercId (resolved via killerUnitId): 0 XP lost
    game.applyDamageToPlayer(p3, 100, { killerUnitId: mercId })
    expect(game.getPlayerState(p3)!.experience).toBe(65_000)
  })

  it('applies DeathExpPenalty across monster melee, Fire Enchanted death explosion, and trap objects', () => {
    const game = new GameInstance({ seed: 14344, areaId: 3, difficulty: 2, maxPlayers: 3 })
    const pMelee = game.connectPlayer({
      name: 'MeleeVictim',
      charClass: 'sor',
      level: 10,
      experience: 65_000,
      hp: 10,
      maxHp: 100,
      x: 50,
      y: 50,
      areaId: 3,
    })
    const pFe = game.connectPlayer({
      name: 'FeVictim',
      charClass: 'sor',
      level: 10,
      experience: 65_000,
      hp: 10,
      maxHp: 100,
      x: 70,
      y: 70,
      areaId: 3,
    })
    const pTrap = game.connectPlayer({
      name: 'TrapVictim',
      charClass: 'sor',
      level: 10,
      experience: 65_000,
      hp: 5,
      maxHp: 100,
      x: 90,
      y: 90,
      areaId: 3,
    })

    const g = internal(game)

    // 1. Monster attack on pMelee
    const m1Id = game.spawnMonster({
      defId: 'fallen1',
      x: 51,
      y: 50,
      areaId: 3,
      minDmg: 50,
      maxDmg: 50,
      ar: 10_000,
    })
    const m1 = g.monsters.get(m1Id)
    g.resolveMonsterAttackOnPlayer(m1, g.players.get(pMelee), {
      minDmg: 50,
      maxDmg: 50,
      guaranteed: true,
    })
    expect(game.getPlayerState(pMelee)!.dead).toBe(true)
    expect(game.getPlayerState(pMelee)!.experience).toBe(63_558)

    // 2. Fire Enchanted pending death explosion on pFe
    const m2Id = game.spawnMonster({
      defId: 'fallen1',
      x: 70,
      y: 70,
      areaId: 3,
    })
    const m2 = g.monsters.get(m2Id)
    m2.pendingDeathExplosion = {
      frame: g.currentFrame,
      radius: 10,
      phys: 50,
      fire: 50,
      total: 100,
    }
    g.resolvePendingDeathExplosion(m2)
    expect(game.getPlayerState(pFe)!.dead).toBe(true)
    expect(game.getPlayerState(pFe)!.experience).toBe(63_558)

    // 3. Trap object on pTrap
    const trapId = game.spawnObject({
      classId: 4, // Objects.txt trap/urn
      x: 90,
      y: 90,
      areaId: 3,
      mode: 0,
    })
    g.applyDamageToPlayer(pTrap, 20, { killerType: 'trap', killerUnitId: trapId })
    expect(game.getPlayerState(pTrap)!.dead).toBe(true)
    expect(game.getPlayerState(pTrap)!.experience).toBe(63_558)
  })
})

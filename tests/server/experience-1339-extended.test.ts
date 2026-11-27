/**
 * Issue #1339 & #1433: 1.13c level-difference experience modifier, party split,
 * `SUNITDMG_CalculateExperienceGain` (`0x6FCFC030`), and `0x6FD1A600` shrine stats.
 *
 * `SUNITDMG_ComputeLevelDiffExp` `0x6FCFAA40` (`.rdata` `0x6FD1A01C` & `0x6FD1A048`),
 * `SUNITDMG_ApplyExpRatio` `0x6FCFA9E0`, `SUNITDMG_CalculateExperienceGain` `0x6FCFC030`,
 * `SUNITDMG_DistributeExperience` `0x6FCFE8F0`, `SUNITDMG_AddExperienceForKill` `0x6FCFEA00`.
 */
import { describe, expect, it } from 'vitest'
import {
  LEVEL_DIFF_EXP_MOD_ABOVE_OR_EQUAL,
  LEVEL_DIFF_EXP_MOD_UNDER25,
  LEVEL_DIFF_EXP_MOD_UNDER25_HIGHER_MLVL,
  MAX_SINGLE_EXP_GAIN_113C,
  PARTY_EXP_MAX_DIST_SQ_113C,
  PARTY_EXP_MAX_MEMBERS_113C,
  PARTY_EXP_MAX_RADIUS_SUBTILES_113C,
  calculateKillExperienceGain113c,
  computeMonsterExpGrant113c,
  isWithinPartyExpRange113c,
  partyExpPool113c,
  partyExpShare113c,
} from '../../src/common/progression/experience-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

type AnyRecord = Record<string, any>

function internal(game: GameInstance): AnyRecord {
  return game as unknown as AnyRecord
}

describe('#1339 / #1433 level-difference experience & 0x6FCFC030 pipeline', () => {
  it('uses 0x6FD1A048 for clvl < 25 & mlvl > clvl, 0x6FD1A01C for clvl >= mlvl, and clvl/mlvl for clvl >= 25 & mlvl > clvl', () => {
    expect(LEVEL_DIFF_EXP_MOD_UNDER25).toHaveLength(11)
    expect(LEVEL_DIFF_EXP_MOD_ABOVE_OR_EQUAL).toEqual([
      256, 256, 256, 256, 256, 256, 207, 159, 110, 61, 13,
    ])
    expect(LEVEL_DIFF_EXP_MOD_UNDER25_HIGHER_MLVL).toEqual([
      256, 256, 256, 256, 256, 256, 225, 174, 92, 38, 5,
    ])
    expect(computeMonsterExpGrant113c(1000, 10, 10)).toBe(1000)
    // clvl = 10 < 25, mlvl = 16 / 18 / 20 -> 0x6FD1A048[6/8/10] = 225 / 92 / 5
    expect(computeMonsterExpGrant113c(1000, 10, 16)).toBe(Math.floor((1000 * 225) / 256))
    expect(computeMonsterExpGrant113c(1000, 10, 18)).toBe(Math.floor((1000 * 92) / 256))
    expect(computeMonsterExpGrant113c(1000, 10, 20)).toBe(Math.floor((1000 * 5) / 256))
    // clvl = 30 >= 25, mlvl = 40 > clvl -> exp * clvl / mlvl
    expect(computeMonsterExpGrant113c(1000, 30, 40)).toBe(750)
    // clvl = 40 >= mlvl = 30 -> 0x6FD1A01C[10] = 13
    expect(computeMonsterExpGrant113c(1000, 40, 30)).toBe(Math.floor((1000 * 13) / 256))
    expect(computeMonsterExpGrant113c(1000, 40, 35)).toBe(1000)
  })

  it('applies the party pool and level-weighted share', () => {
    expect(partyExpPool113c(1000, 1)).toBe(1000)
    expect(partyExpPool113c(1000, 2)).toBe(1000 + Math.floor((1000 * 89) / 256))
    expect(partyExpPool113c(1000, 3)).toBe(1000 + Math.floor((1000 * 89 * 2) / 256))
    expect(partyExpShare113c(1347, 20, 50)).toBe(538)
  })

  it('grants level-adjusted and party-weighted XP on a kill', () => {
    const game = new GameInstance({ seed: 13390, areaId: 1, maxPlayers: 2 })
    game.setPlayersX(1)
    const lowId = game.connectPlayer({ charClass: 'pal', name: 'Low', x: 10, y: 10, areaId: 1 })
    const highId = game.connectPlayer({ charClass: 'pal', name: 'High', x: 12, y: 10, areaId: 1 })
    const g = internal(game)
    const low = g.players.get(lowId) as AnyRecord
    const high = g.players.get(highId) as AnyRecord
    low.level = 20
    high.level = 30
    low.partyId = 1
    high.partyId = 1
    low.experience = 0
    high.experience = 0
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 11,
      y: 10,
      areaId: 1,
      hp: 1,
      maxHp: 1,
      experience: 1000,
    })
    const monster = g.monsters.get(monsterId) as AnyRecord
    monster.level = 40
    g.onMonsterKilled(low, monster)

    // playersX=2 -> base 1500; pool 2021; shares 808/1212.
    // low (clvl 20 < 25 vs mlvl 40, diff >= 10) uses 0x6FD1A048[10] = 5/256.
    expect(low.experience).toBe(Math.floor((808 * 5) / 256))
    expect(high.experience).toBe(Math.floor((1212 * 30) / 40))
  })

  it('#1471: enforces 0x6FCFAED0 party XP radius dx^2 + dy^2 <= 6400 (80 sub-tiles) and 8-member cap', () => {
    expect(PARTY_EXP_MAX_DIST_SQ_113C).toBe(0x1900)
    expect(PARTY_EXP_MAX_RADIUS_SUBTILES_113C).toBe(80)
    expect(PARTY_EXP_MAX_MEMBERS_113C).toBe(8)

    // Exact 0x6FCFAED0 (0x6FCFAFCA: cmp eax, 0x1900; ja 0x6FCFB024) boundary checks:
    expect(isWithinPartyExpRange113c(80, 0, 0, 0)).toBe(true) // 80^2 + 0^2 = 6400 <= 6400
    expect(isWithinPartyExpRange113c(81, 0, 0, 0)).toBe(false) // 81^2 + 0^2 = 6561 > 6400
    expect(isWithinPartyExpRange113c(56, 56, 0, 0)).toBe(true) // 56^2 + 56^2 = 6272 <= 6400
    expect(isWithinPartyExpRange113c(57, 57, 0, 0)).toBe(false) // 57^2 + 57^2 = 6498 > 6400

    const runBoundaryCase = (offsetX: number, offsetY: number): { killerXp: number; allyXp: number } => {
      const game = new GameInstance({ seed: 14710, areaId: 1, maxPlayers: 2 })
      game.setPlayersX(1)
      const killerId = game.connectPlayer({ charClass: 'pal', name: 'Killer', x: 100, y: 100, areaId: 1 })
      const allyId = game.connectPlayer({
        charClass: 'pal',
        name: 'Ally',
        x: 100 + offsetX,
        y: 100 + offsetY,
        areaId: 1,
      })
      const g = internal(game)
      const killer = g.players.get(killerId) as AnyRecord
      const ally = g.players.get(allyId) as AnyRecord
      killer.partyId = 1
      ally.partyId = 1
      killer.level = 20
      ally.level = 20
      killer.experience = 0
      ally.experience = 0
      const monsterId = game.spawnMonster({
        defId: 'fallen1',
        x: 100,
        y: 100,
        areaId: 1,
        hp: 1,
        maxHp: 1,
        experience: 1000,
      })
      const monster = g.monsters.get(monsterId) as AnyRecord
      monster.level = 20
      g.onMonsterKilled(killer, monster)
      return { killerXp: killer.experience as number, allyXp: ally.experience as number }
    }

    // (80, 0): 80^2 + 0^2 = 6400 <= 6400 -> shares XP (playersX=2 -> base 1500, pool 2021, share 1010 each)
    const at80_0 = runBoundaryCase(80, 0)
    expect(at80_0.allyXp).toBeGreaterThan(0)
    expect(at80_0.allyXp).toBe(at80_0.killerXp)

    // (56, 56): 56^2 + 56^2 = 6272 <= 6400 -> shares XP
    const at56_56 = runBoundaryCase(56, 56)
    expect(at56_56.allyXp).toBeGreaterThan(0)
    expect(at56_56.allyXp).toBe(at56_56.killerXp)

    // (57, 57): 57^2 + 57^2 = 6498 > 6400 -> excluded from XP share
    const at57_57 = runBoundaryCase(57, 57)
    expect(at57_57.killerXp).toBe(1500)
    expect(at57_57.allyXp).toBe(0)

    // 8-member cap (0x6FCFAFD8: cmp [esi+0x44], 8): 9th same-party member in range does not receive XP
    expect(partyExpPool113c(1000, 9)).toBe(partyExpPool113c(1000, 8))
    const game9 = new GameInstance({ seed: 14719, areaId: 1, maxPlayers: 8 })
    game9.setPlayersX(1)
    const g9 = internal(game9)
    const ids: number[] = []
    for (let i = 0; i < 8; i++) {
      const pid = game9.connectPlayer({ charClass: 'pal', name: `P${i + 1}`, x: 50, y: 50, areaId: 1 })
      const pRec = g9.players.get(pid) as AnyRecord
      pRec.partyId = 1
      pRec.level = 20
      pRec.experience = 0
      ids.push(pid)
    }
    // Inject a 9th player record into the internal map to verify the 8-recipient hard cap
    const ninth: AnyRecord = {
      ...g9.players.get(ids[0]!),
      unitId: 999,
      name: 'P9',
      partyId: 1,
      level: 20,
      experience: 0,
      dead: false,
      areaId: 1,
      x: 50,
      y: 50,
    }
    g9.players.set(999, ninth)
    const m9 = game9.spawnMonster({
      defId: 'fallen1',
      x: 50,
      y: 50,
      areaId: 1,
      hp: 1,
      maxHp: 1,
      experience: 1000,
    })
    const m9Rec = g9.monsters.get(m9) as AnyRecord
    m9Rec.level = 20
    g9.onMonsterKilled(g9.players.get(ids[0]!), m9Rec)
    for (const pid of ids) {
      expect((g9.players.get(pid) as AnyRecord).experience).toBeGreaterThan(0)
    }
    expect(ninth.experience).toBe(0)
  })

  it('adds Experience Shrine (+50 stat 85) and item_addexperience (+10 stat 85) additively (160%, not 165%)', () => {
    const game = new GameInstance({ seed: 13392, areaId: 1 })
    const id = game.connectPlayer({ charClass: 'pal', name: 'Bonus', x: 10, y: 10, areaId: 1 })
    const player = internal(game).players.get(id) as AnyRecord
    player.level = 20
    player.experience = 0
    player.states.add(137)
    player.items.push({
      location: 'equipped',
      stats: new Map([[85, 10]]),
      socketedItems: [],
    })
    internal(game).grantExperience(player, 1000, 20)
    // 0x6FD1A600 + 0x6FCFC030: stat 85 = 50 (shrine) + 10 (item) = 60 -> 1000 + floor(1000 * 60 / 100) = 1600
    expect(player.experience).toBe(1600)
  })

  it('respects negative signed stat 85 (-20 -> 80%), clamps single input to 0x7FFFFF (8,388,607), and returns 0 at clvl 99', () => {
    // 1. Negative stat 85 (-20%) via D2Common_10519_GetStatSigned (0x6FCFC099)
    expect(calculateKillExperienceGain113c(1000, 20, 20, -20)).toBe(800)
    const game = new GameInstance({ seed: 14330, areaId: 1 })
    const id = game.connectPlayer({ charClass: 'pal', name: 'Penalty', x: 10, y: 10, areaId: 1 })
    const player = internal(game).players.get(id) as AnyRecord
    player.level = 20
    player.experience = 0
    player.items.push({
      location: 'equipped',
      stats: new Map([[85, -20]]),
      socketedItems: [],
    })
    internal(game).grantExperience(player, 1000, 20)
    expect(player.experience).toBe(800)

    // 2. Single-call input > 0x7FFFFF (9,000,000 -> clamped to 8,388,607)
    expect(MAX_SINGLE_EXP_GAIN_113C).toBe(0x7fffff)
    // 0x7FFFFF clamp, then ExpRatio (D2Game 0x6FCFA9E0): exp > 0x7FFFFFFF >> 11 takes `(exp >> 10) * 1024`,
    // dropping the low 10 bits (verified by the function oracle, docs/oracle/P5-formula-sweep.md).
    expect(calculateKillExperienceGain113c(9_000_000, 20, 20, 0)).toBe(8_387_584)
    player.items.length = 0
    player.experience = 0
    internal(game).grantExperience(player, 9_000_000, 20)
    expect(player.experience).toBe(8_387_584)

    // 3. Non-positive input returns 1 (when clvl < 99)
    expect(calculateKillExperienceGain113c(0, 20, 20, 0)).toBe(1)
    expect(calculateKillExperienceGain113c(-50, 20, 20, 0)).toBe(1)

    // 4. Max level (clvl = 99) returns 0 immediately
    expect(calculateKillExperienceGain113c(100_000, 99, 99, 50)).toBe(0)
  })

  it('routes mercenary kill XP through 0x6FCFC030 -> 0x6FCFB6B0 -> 0x6FCFDCB0 (level diff, ExpRatio, merc stat 85, 86/256 owner-kill share, and 2x credit)', () => {
    const game = new GameInstance({ seed: 14331, areaId: 1 })
    game.setPlayersX(1)
    const p1 = game.connectPlayer({ charClass: 'sor', name: 'Owner', level: 30, x: 10, y: 10, areaId: 1 })
    const mercId = game.hireMercenary(p1, { act: 2, subType: 7, level: 10, difficulty: 1, x: 11, y: 10 })
    const g = internal(game)
    const owner = g.players.get(p1) as AnyRecord
    const merc = g.mercenaries.get(mercId) as AnyRecord
    merc.equipment.push({
      location: 'equipped',
      stats: new Map([[85, 10]]),
      socketedItems: [],
    })
    const startMercXp = merc.experience as number

    // Monster mlvl=16 vs merc clvl=10 (diff=6 -> 225/256), baseXp=500:
    // 0x6FCFAA40: floor(500 * 225 / 256) = 439
    // 0x6FCFA9E0: ExpRatio(10)=1024 -> 439
    // 0x6FCFC099: stat85=+10 -> 439 + floor(439 * 10 / 100) = 482
    // 0x6FCFB6B0: maxGain at level 10 (expPerLvl=110) = (12*11*11*110 - 11*10*10*110) >>> 6 = 605 -> 482
    // Owner kill (!lastHitByMerc): floor(482 * 86 / 256) = 161
    // 0x6FCFDCB0 (`0x6FCFDD24: lea edi, [ebx + edi*2]`): credits 2 * 161 = 322
    const m1 = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      hp: 1,
      maxHp: 1,
      experience: 500,
    })
    const m1Rec = g.monsters.get(m1) as AnyRecord
    m1Rec.level = 16
    m1Rec.lastHitByMerc = false
    g.onMonsterKilled(owner, m1Rec)
    expect(merc.experience - startMercXp).toBe(Math.floor((482 * 86) / 256) * 2)

    // Merc kill (lastHitByMerc = true): gets full 482 * 2 = 964
    const beforeM2 = merc.experience as number
    const m2 = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      hp: 1,
      maxHp: 1,
      experience: 500,
    })
    const m2Rec = g.monsters.get(m2) as AnyRecord
    m2Rec.level = 16
    m2Rec.lastHitByMerc = true
    g.onMonsterKilled(owner, m2Rec)
    expect(merc.experience - beforeM2).toBe(482 * 2)
  })
})
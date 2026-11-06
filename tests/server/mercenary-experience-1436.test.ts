import { describe, expect, it } from 'vitest'
import {
  clampMercenaryExpGain113c,
  evaluateMercenaryKillExperience113c,
  hirelingExpThreshold,
  hirelingLevelFromExp,
  MAX_MERCENARY_LEVEL_113C,
} from '../../src/common/progression/experience-113c.ts'
import { readD2sSave113c } from '../../src/server/save/d2s-reader.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

type AnyRecord = Record<string, any>

function internal(game: GameInstance): AnyRecord {
  return game as unknown as AnyRecord
}

describe('1.13c Mercenary Experience & Hireling.txt Exp/Lvl Level-Up Pipeline (#1436)', () => {
  it('computes Hireling.txt cumulative thresholds ((lvl + 1) * lvl * lvl * expPerLvl) and 1/64 per-kill cap (0x6FD7C990 / 0x6FCFB6B0)', () => {
    // D2Common.dll #10448 (0x6FD7C990) & #10458 (0x6FD7CE72):
    // Threshold(lvl, expPerLvl) = (lvl + 1) * lvl * lvl * expPerLvl
    expect(hirelingExpThreshold(0, 110)).toBe(0)
    expect(hirelingExpThreshold(1, 110)).toBe(2 * 1 * 1 * 110)
    expect(hirelingExpThreshold(10, 110)).toBe(11 * 10 * 10 * 110) // 121,000
    expect(hirelingExpThreshold(11, 110)).toBe(12 * 11 * 11 * 110) // 159,720

    // D2Game.dll 0x6FCFB6B0: maxGain = (Threshold(lvl + 1) - Threshold(lvl)) >>> 6
    const maxGain10 = (159_720 - 121_000) >>> 6 // 38,720 >>> 6 = 605
    expect(maxGain10).toBe(605)
    expect(clampMercenaryExpGain113c(400, 10, 110)).toBe(400)
    expect(clampMercenaryExpGain113c(10_000, 10, 110)).toBe(605)
  })

  it('awards 2 * floor(E * 86 / 256) on owner kill and 2 * E on mercenary kill (0x6FCFEA00 -> 0x6FCFDCB0)', () => {
    // Owner level 20, merc level 10, expPerLvl = 110, mlvl = 10, rawExp = 300:
    // calcExp = 300 (<= maxGain 605)
    // Owner kill (!lastHitByMerc): expGain = floor(300 * 86 / 256) = 100, expAdded = 200
    const ownerKill = evaluateMercenaryKillExperience113c({
      rawExp: 300,
      mercLevel: 10,
      ownerLevel: 20,
      currentExp: hirelingExpThreshold(10, 110),
      expPerLvl: 110,
      mlvl: 10,
      lastHitByMerc: false,
    })
    expect(ownerKill.expGain).toBe(100)
    expect(ownerKill.expAdded).toBe(200)
    expect(ownerKill.newExp).toBe(hirelingExpThreshold(10, 110) + 200)
    expect(ownerKill.leveledUp).toBe(false)

    // Mercenary kill (lastHitByMerc = true): does NOT multiply by 86/256 -> expGain = 300, expAdded = 600
    const mercKill = evaluateMercenaryKillExperience113c({
      rawExp: 300,
      mercLevel: 10,
      ownerLevel: 20,
      currentExp: hirelingExpThreshold(10, 110),
      expPerLvl: 110,
      mlvl: 10,
      lastHitByMerc: true,
    })
    expect(mercKill.expGain).toBe(300)
    expect(mercKill.expAdded).toBe(600)
    expect(mercKill.newExp).toBe(hirelingExpThreshold(10, 110) + 600)
  })

  it('blocks mercenary XP gain when merc.level >= owner.level or merc.level >= 98 (0x6FCFDD10..0x6FCFDD3B)', () => {
    const game = new GameInstance({ seed: 14361, areaId: 1 })
    const p1 = game.connectPlayer({ charClass: 'pal', name: 'Paladin', level: 15, x: 10, y: 10, areaId: 1 })
    const mercId = game.hireMercenary(p1, { act: 2, subType: 7, level: 15, difficulty: 1, x: 11, y: 10 })
    const g = internal(game)
    const owner = g.players.get(p1) as AnyRecord
    const merc = g.mercenaries.get(mercId) as AnyRecord
    const startExp = merc.experience as number

    // Even if this kill levels the owner from 15 -> 16, 0x6FCFEA00 runs the merc XP block
    // BEFORE the player XP loop, so merc.level (15) >= owner.level (15) blocks merc XP on this kill.
    const m1 = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      hp: 1,
      maxHp: 1,
      experience: 500_000,
    })
    const m1Rec = g.monsters.get(m1) as AnyRecord
    m1Rec.level = 15
    m1Rec.lastHitByMerc = true
    g.onMonsterKilled(owner, m1Rec)

    expect(owner.level).toBeGreaterThan(15)
    expect(merc.level).toBe(15)
    expect(merc.experience).toBe(startExp)

    // Also verify level 98 cap (MAX_MERCENARY_LEVEL_113C = 98) when owner is level 99
    const capped98 = evaluateMercenaryKillExperience113c({
      rawExp: 50_000,
      mercLevel: MAX_MERCENARY_LEVEL_113C,
      ownerLevel: 99,
      currentExp: hirelingExpThreshold(98, 110),
      expPerLvl: 110,
      mlvl: 98,
      lastHitByMerc: true,
    })
    expect(capped98.expAdded).toBe(0)
    expect(capped98.newLevel).toBe(98)
    expect(capped98.leveledUp).toBe(false)
  })

  it('levels up mercenary across Hireling.txt Exp/Lvl threshold, recomputes stats via MERCS_SetStats (0x6FC68BA0), and heals HP to maxHp', () => {
    const game = new GameInstance({ seed: 14362, areaId: 1 })
    const p1 = game.connectPlayer({ charClass: 'ama', name: 'Amazon', level: 25, x: 10, y: 10, areaId: 1 })
    const mercId = game.hireMercenary(p1, { act: 2, subType: 7, level: 10, difficulty: 1, x: 11, y: 10 })
    const g = internal(game)
    const owner = g.players.get(p1) as AnyRecord
    const merc = g.mercenaries.get(mercId) as AnyRecord

    const beforeMaxHp = merc.maxHp as number
    const beforeAr = merc.ar as number
    const beforeDef = merc.defense as number
    const expPerLvl = merc.expPerLvl as number
    const threshold11 = hirelingExpThreshold(11, expPerLvl)

    // Damage the merc before level-up and set XP just below level 11 threshold
    merc.hp = Math.max(1, Math.floor(beforeMaxHp / 2))
    merc.experience = threshold11 - 100
    game.drainPlayerEvents(p1)

    const mId = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      hp: 1,
      maxHp: 1,
      experience: 300,
    })
    const mRec = g.monsters.get(mId) as AnyRecord
    mRec.level = 10
    mRec.lastHitByMerc = true
    g.onMonsterKilled(owner, mRec)

    expect(merc.experience).toBe(threshold11 - 100 + 600)
    expect(merc.level).toBe(11)
    expect(merc.maxHp).toBeGreaterThan(beforeMaxHp)
    expect(merc.hp).toBe(merc.maxHp)
    expect(merc.ar).toBeGreaterThan(beforeAr)
    expect(merc.defense).toBeGreaterThan(beforeDef)

    const events = game.drainPlayerEvents(p1)
    const expUpdate = events.find(
      (e) =>
        e.type === 'UnitStatUpdate' &&
        e.unitType === 'monster' &&
        e.unitId === mercId &&
        e.statId === 13,
    ) as { value?: number } | undefined
    const lvlUpdate = events.find(
      (e) =>
        e.type === 'UnitStatUpdate' &&
        e.unitType === 'monster' &&
        e.unitId === mercId &&
        e.statId === 12,
    ) as { value?: number } | undefined
    expect(expUpdate?.value).toBe(merc.experience)
    expect(lvlUpdate?.value).toBe(11)
  })

  it('persists and restores mercenary Hireling.txt experience and derived level across .d2s save/load (0x6FD0DA40)', () => {
    const game1 = new GameInstance({ seed: 14363, areaId: 1 })
    const p1 = game1.connectPlayer({ charClass: 'bar', name: 'Hero', level: 30, x: 10, y: 10, areaId: 1 })
    const mercId = game1.hireMercenary(p1, { act: 2, subType: 7, level: 12, difficulty: 1 })
    const g1 = internal(game1)
    const merc1 = g1.mercenaries.get(mercId) as AnyRecord
    const customExp = hirelingExpThreshold(12, merc1.expPerLvl as number) + 4321
    merc1.experience = customExp

    const savedBytes = game1.exportPlayerD2s(p1)
    const parsed = readD2sSave113c(savedBytes)
    expect(parsed.merc?.experience).toBe(customExp)
    expect(hirelingLevelFromExp(customExp, merc1.expPerLvl as number)).toBe(12)

    // Restore into a new game instance where the owner is level 30;
    // merc must restore at level 12 with customExp (NOT owner level 30!)
    const game2 = new GameInstance({ seed: 14364, areaId: 1 })
    const p2 = game2.connectPlayer({
      d2sBytes: savedBytes,
      restoreMercenary: true,
      areaId: 1,
      x: 10,
      y: 10,
    })
    const restoredMerc = game2.getMercenaryForOwner(p2)!
    expect(restoredMerc.level).toBe(12)
    expect(restoredMerc.experience).toBe(customExp)
  })
})

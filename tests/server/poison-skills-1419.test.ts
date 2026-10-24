/**
 * Issue #1419: 1.13c poison skill total damage (`(bitrate256 * ELen) >> 8`), empty `HitShift`
 * default (`0` per `D2Common.dll!DATATBLS_CompileTxt` `0x6FDAEF40`), and `GameInstance` per-frame
 * `STATE_POISON` (`2`) DoT over `ELen` frames (`D2Game.dll` `0x6FCF6C60` + `0x6FC97410`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { writeD2sSave113c } from '../../src/server/save/d2s-writer.ts'
import { evaluateSkill113c } from '../../src/server/skills/registry.ts'
import { createSampleD2sCharacterData } from '../e2e/server-reuse/helpers.ts'

describe('Issue #1419: 1.13c poison skills HitShift=0 default, evaluateSkill113c total damage, and GameInstance per-frame DoT', () => {
  it('compiles empty HitShift cells in Skills.txt and Missiles.txt as 0 (D2Common.dll 0x6FDB5DC8 / 0x6FDCE1B3)', () => {
    const registry = getSharedDataRegistry()
    // Skills.txt rows with empty HitShift
    expect(registry.getSkillById(15)!.hitShift).toBe(0) // Poison Javelin
    expect(registry.getSkillById(222)!.hitShift).toBe(0) // Plague Poppy
    // Skills.txt rows with explicit HitShift
    expect(registry.getSkillById(25)!.hitShift).toBe(3) // Plague Javelin
    expect(registry.getSkillById(73)!.hitShift).toBe(1) // Poison Dagger
    expect(registry.getSkillById(83)!.hitShift).toBe(4) // Poison Explosion
    expect(registry.getSkillById(92)!.hitShift).toBe(4) // Poison Nova
    expect(registry.getSkillById(238)!.hitShift).toBe(3) // Rabies
    expect(registry.getSkillById(278)!.hitShift).toBe(6) // Venom
    // Missiles.txt rows with empty HitShift
    expect(registry.getMissileByName('andarielspray')!.hitShift).toBe(0)
    expect(registry.getMissileByName('poisonball')!.hitShift).toBe(0)
    expect(registry.getMissileByName('primepoisoncloud')!.hitShift).toBe(0)
  })

  it('evaluates all 8 EType=pois skills at slvl 1 with per-frame minElemDmg256/maxElemDmg256 and total minElemDmg/maxElemDmg = (bitrate256 * ELen) >> 8', () => {
    const registry = getSharedDataRegistry()
    // [skillId, name, hitShift, eMin, eMax, eLen, min256, max256, expectedMinTotal, expectedMaxTotal]
    const expectedTable: readonly [
      number,
      string,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ][] = [
      [15, 'Poison Javelin', 0, 32, 48, 200, 32, 48, 25, 37],
      [25, 'Plague Javelin', 3, 10, 16, 75, 80, 128, 23, 37],
      [73, 'Poison Dagger', 1, 18, 40, 50, 36, 80, 7, 15],
      [83, 'Poison Explosion', 4, 8, 24, 50, 128, 384, 25, 75],
      [92, 'Poison Nova', 4, 16, 29, 50, 256, 464, 50, 90],
      [222, 'Plague Poppy', 0, 12, 16, 100, 12, 16, 4, 6],
      [238, 'Rabies', 3, 6, 14, 100, 48, 112, 18, 43],
      [278, 'Venom', 6, 24, 32, 10, 1536, 2048, 60, 80],
    ]

    for (const [
      id,
      name,
      hitShift,
      eMin,
      eMax,
      eLen,
      min256,
      max256,
      minTotal,
      maxTotal,
    ] of expectedTable) {
      const skill = registry.getSkillById(id)!
      expect(skill.name).toBe(name)
      expect(skill.eType).toBe('pois')
      expect(skill.hitShift).toBe(hitShift)
      expect(skill.eMin).toBe(eMin)
      expect(skill.eMax).toBe(eMax)
      expect(skill.eLen).toBe(eLen)

      const statList = new UnitStatList(registry, { level: 30 })
      statList.setBaseSkillLevel(id, 1)
      const res = evaluateSkill113c({ registry, skill, slvl: 1, blvl: 1, statList, difficulty: 0 })
      expect(res.minElemDmg256, `${name} (#${id}) minElemDmg256`).toBe(min256)
      expect(res.maxElemDmg256, `${name} (#${id}) maxElemDmg256`).toBe(max256)
      expect(res.minElemDmg, `${name} (#${id}) minElemDmg`).toBe(minTotal)
      expect(res.maxElemDmg, `${name} (#${id}) maxElemDmg`).toBe(maxTotal)
      if (id !== 278) {
        expect(res.durationFrames, `${name} (#${id}) durationFrames`).toBe(eLen)
      }
    }
  })

  it('ticks Poison Nova (#92 slvl 1) frame-by-frame over ELen=50 frames for 50..90 total HP', () => {
    const game = new GameInstance({ seed: 0x1419_92, difficulty: 0, areaId: 2 })
    const playerId = game.connectPlayer({
      d2sBytes: writeD2sSave113c(
        createSampleD2sCharacterData({
          name: 'PoisNec',
          charClass: 2,
          level: 30,
          skillLevels: new Uint8Array(30),
          attributesOverrides: {
            maxManaFixed: 5000 * FIXED_ONE,
            manaFixed: 5000 * FIXED_ONE,
          },
        }),
      ),
      x: 100,
      y: 100,
      areaId: 2,
      skills: { 92: 1 },
    })
    const monId = game.spawnMonster({
      defId: 'fallen1',
      x: 103,
      y: 100,
      areaId: 2,
      hp: 500,
      maxHp: 500,
      resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
      damageRegen: 0,
      aiDisabled: true,
    })
    game.drainEvents(playerId)

    game.enqueueCommand(playerId, {
      type: 'CastSkillAtLocation',
      skillId: 92,
      x: 103,
      y: 100,
      hand: 'right',
    })
    // Frame 1: STATE_POISON (2) is applied and only 1 frame of poison ticks (1 HP), not all 50..90 HP at once
    game.stepFrames(1)
    const afterFrame1 = game.getMonster(monId)!
    expect(afterFrame1.states.has(2)).toBe(true)
    const lostFrame1 = 500 - afterFrame1.hp
    expect(lostFrame1).toBeGreaterThanOrEqual(1)
    expect(lostFrame1).toBeLessThanOrEqual(2)

    // Step the remaining 49 frames of ELen=50
    game.stepFrames(49)
    const after50 = game.getMonster(monId)!
    const totalLost = 500 - after50.hp
    expect(totalLost).toBeGreaterThanOrEqual(50)
    expect(totalLost).toBeLessThanOrEqual(90)

    // After ELen=50 frames expire, no further poison damage ticks
    game.stepFrames(10)
    expect(500 - game.getMonster(monId)!.hp).toBe(totalLost)
  })

  it('ticks Poison Javelin (#15 slvl 1, ELen=200 -> 25..37 poison) and Plague Javelin (#25 slvl 1, ELen=75 -> 23..37 poison) frame-by-frame', () => {
    // 1. Poison Javelin (#15 slvl 1)
    const game15 = new GameInstance({ seed: 0x1419_15, difficulty: 0, areaId: 2 })
    const ama15 = game15.connectPlayer({
      d2sBytes: writeD2sSave113c(
        createSampleD2sCharacterData({
          name: 'PoisAma15',
          charClass: 0,
          level: 30,
          skillLevels: new Uint8Array(30),
          attributesOverrides: {
            maxManaFixed: 5000 * FIXED_ONE,
            manaFixed: 5000 * FIXED_ONE,
          },
        }),
      ),
      x: 100,
      y: 100,
      areaId: 2,
      skills: { 15: 1 },
    })
    const mon15 = game15.spawnMonster({
      defId: 'fallen1',
      x: 102,
      y: 100,
      areaId: 2,
      hp: 500,
      maxHp: 500,
      resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
      damageRegen: 0,
      aiDisabled: true,
    })
    game15.enqueueCommand(ama15, {
      type: 'CastSkillAtLocation',
      skillId: 15,
      x: 102,
      y: 100,
      hand: 'right',
    })
    // Frame 1: missile hits monster at (102, 100); physical unarmed hit is 1..2, poison is armed for 200 frames
    game15.stepFrames(1)
    const m15AfterHit = game15.getMonster(mon15)!
    expect(m15AfterHit.states.has(2)).toBe(true)
    const hitLoss15 = 500 - m15AfterHit.hp
    expect(hitLoss15).toBeLessThanOrEqual(2)

    // Step remaining 199 poison frames (total 200 frames of poison)
    game15.stepFrames(199)
    const totalPoisonLoss15 = 500 - game15.getMonster(mon15)!.hp - hitLoss15
    expect(totalPoisonLoss15).toBeGreaterThanOrEqual(25)
    expect(totalPoisonLoss15).toBeLessThanOrEqual(37)

    // 2. Plague Javelin (#25 slvl 1)
    const game25 = new GameInstance({ seed: 0x1419_25, difficulty: 0, areaId: 2 })
    const ama25 = game25.connectPlayer({
      d2sBytes: writeD2sSave113c(
        createSampleD2sCharacterData({
          name: 'PoisAma25',
          charClass: 0,
          level: 30,
          skillLevels: new Uint8Array(30),
          attributesOverrides: {
            maxManaFixed: 5000 * FIXED_ONE,
            manaFixed: 5000 * FIXED_ONE,
          },
        }),
      ),
      x: 100,
      y: 100,
      areaId: 2,
      skills: { 25: 1 },
    })
    const mon25 = game25.spawnMonster({
      defId: 'fallen1',
      x: 102,
      y: 100,
      areaId: 2,
      hp: 500,
      maxHp: 500,
      resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
      damageRegen: 0,
      aiDisabled: true,
    })
    game25.enqueueCommand(ama25, {
      type: 'CastSkillAtLocation',
      skillId: 25,
      x: 102,
      y: 100,
      hand: 'right',
    })
    game25.stepFrames(1)
    const m25AfterHit = game25.getMonster(mon25)!
    expect(m25AfterHit.states.has(2)).toBe(true)
    const hitLoss25 = 500 - m25AfterHit.hp
    expect(hitLoss25).toBeLessThanOrEqual(2)

    game25.stepFrames(74)
    const totalPoisonLoss25 = 500 - game25.getMonster(mon25)!.hp - hitLoss25
    expect(totalPoisonLoss25).toBeGreaterThanOrEqual(23)
    expect(totalPoisonLoss25).toBeLessThanOrEqual(37)
  })
})

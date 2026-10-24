/**
 * Issue #1411 — 1.13c Curse State Mask (`States.txt` `curse` column) & `STATLIST_CURSE` (`0x20`) Slot Parity.
 *
 * Ground Truth Citations:
 * - `samples/d2/excel/States.txt`: boolean column `curse` (`0` or `1`, no `cursetype` column exists).
 *   Exact 26 `curse=1` rows: `9` (`amplifydamage`), `19` (`weaken`), `23` (`dimvision`), `27` (`taunt`),
 *   `55` (`ironmaiden`), `56` (`terror`), `57` (`attract`), `58` (`lifetap`), `59` (`confuse`),
 *   `60` (`decrepify`), `61` (`lowerresist`), `89` (`battlecry`), `113` (`defense_curse`),
 *   `114` (`blood_mana`), `128..137` (`shrine_armor`..`shrine_experience`), `141` (`bloodlust`), `156` (`cloaked`).
 *   Row `153` (`cloak_of_shadows`) has `curse=0` (caster self-buff for Skill 264 `aurastate`), whereas
 *   row `156` (`cloaked`) has `curse=1` (enemy curse for Skill 264 `auratargetstate`).
 * - `samples/d2/D2Common.dll` `#10033` (`STATES_CheckStateMaskCurseByStateId` @ `0x6FD83B40`):
 *   reads `States.txt` `curse` bitmask (`fStateMasks[11]`).
 * - `samples/d2/D2Game.dll` `sub_6FCC00B0` (`0x6FCC00B0`):
 *   - `0x6FCC0183`: checks `D2Common #10033` (`bIsCurse`).
 *   - `0x6FCC0192..0x6FCC01BF`: checks `STAT_CURSE_RESISTANCE` (`stat 109`); if `>= 100`, returns `0`;
 *     if `!= 0`, subtracts `MONSTER_ApplyPercentage(nDuration, curseRes, 100)` (`0x6FC214D0`).
 *   - `0x6FCC01C1`: if `bIsCurse` and `STATES_CheckState(pTarget, STATE_ATTRACT = 57)` (`D2Common #10494`), returns `0`.
 *   - `0x6FCC01DD`: if `bIsCurse`, looks up single curse slot via `STATLIST_GetStatListFromUnitAndFlag(pTarget, 0x20)`.
 *   - `0x6FCC01FC..0x6FCC0263`:
 *     * If existing curse has different `stateId` (`0x6FCC01FD`) or different `skillId` (`0x6FCC0208`):
 *       unlinks old StatList (`#11111`/`#11108`) and replaces it regardless of `slvl`.
 *     * If same `stateId` and same `skillId`:
 *       - `newSlvl == oldSlvl` (`0x6FCC021B`): refreshes `expireFrame` via `STATLIST_SetExpireFrame` (`#10161`) in-place.
 *       - `newSlvl > oldSlvl` (`0x6FCC0257: jge 0x6FCC0263`): replaces old StatList with new higher-level StatList.
 *       - `newSlvl < oldSlvl` (`0x6FCC0259`): rejects (`xor eax, eax; ret`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { UnitStatList, FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import {
  evaluateSkillCore113c,
  executeSkillCore113c,
} from '../../src/server/skills/registry.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'
import { MissileEngine } from '../../src/server/engine/missile-engine.ts'
import { AuraScanner } from '../../src/server/engine/aura-scanner.ts'
import { SummonManager } from '../../src/server/ai/summon-manager.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

const EXPECTED_CURSE_STATE_IDS_113C = [
  9, 19, 23, 27, 55, 56, 57, 58, 59, 60, 61, 89, 113, 114, 128, 129, 130, 131, 132, 133, 134, 135,
  136, 137, 141, 156,
]

describe('Issue #1411: 1.13c States.txt curse column & sub_6FCC00B0 (0x6FCC00B0) curse slot parity', () => {
  it('parses the exact 26 curse=1 states from States.txt and distinguishes cloak_of_shadows (153, curse=0) from cloaked (156, curse=1)', () => {
    const registry = getSharedDataRegistry()
    const curseIds: number[] = []
    for (let id = 0; id < 200; id += 1) {
      const rec = registry.getStateById(id)
      if (rec?.curse) {
        curseIds.push(rec.id)
      }
    }
    expect(curseIds).toEqual(EXPECTED_CURSE_STATE_IDS_113C)

    const cloakOfShadows = registry.getStateByName('cloak_of_shadows')
    expect(cloakOfShadows).toBeDefined()
    expect(cloakOfShadows!.id).toBe(153)
    expect(cloakOfShadows!.curse).toBe(false)

    const cloaked = registry.getStateByName('cloaked')
    expect(cloaked).toBeDefined()
    expect(cloaked!.id).toBe(156)
    expect(cloaked!.curse).toBe(true)
  })

  it('treats cloak_of_shadows (153) as a non-curse self-buff that coexists with curses and shrines, while cloaked (156) is a curse', () => {
    const statList = new UnitStatList()
    const bus = new StateBus(statList) // also verifies fallback to shared D2DataRegistry when registry arg omitted

    const selfBuff = bus.applyState({
      stateNameOrId: 'cloak_of_shadows',
      sourceSkillId: 264,
      slvl: 5,
      durationFrames: 300,
      currentFrame: 10,
      stats: { item_armor_percent: 22 },
    })
    expect(selfBuff.applied).toBe(true)
    expect(selfBuff.stateId).toBe(153)
    expect(bus.getState('cloak_of_shadows')?.curseType).toBe(0)

    // Receiving Amplify Damage (9, curse=1) on the Assassin must NOT evict cloak_of_shadows (153, curse=0)
    const amp = bus.applyState({
      stateNameOrId: 'amplifydamage',
      sourceSkillId: 66,
      slvl: 1,
      durationFrames: 200,
      currentFrame: 20,
      stats: { amplify_phys_pierce: 100 },
    })
    expect(amp.applied).toBe(true)
    expect(bus.hasState('cloak_of_shadows')).toBe(true)
    expect(bus.hasState('amplifydamage')).toBe(true)

    // Enemy receiving cloaked (156, curse=1) overwrites amplifydamage (9, curse=1)
    const enemyBus = new StateBus(new UnitStatList())
    enemyBus.applyState({
      stateNameOrId: 'amplifydamage',
      sourceSkillId: 66,
      slvl: 10,
      durationFrames: 500,
      currentFrame: 0,
    })
    const cloakedRes = enemyBus.applyState({
      stateNameOrId: 'cloaked',
      sourceSkillId: 264,
      slvl: 1,
      durationFrames: 200,
      currentFrame: 10,
    })
    expect(cloakedRes.applied).toBe(true)
    expect(cloakedRes.stateId).toBe(156)
    expect(cloakedRes.evictedState).toBe('amplifydamage')
    expect(enemyBus.hasState('amplifydamage')).toBe(false)
    expect(enemyBus.hasState('cloaked')).toBe(true)
  })

  it('enforces single STATLIST_CURSE (0x20) slot mutual exclusion across player curses, shrines (128..137), and monster curses (113, 114, 141)', () => {
    const statList = new UnitStatList()
    const bus = new StateBus(statList)

    // 1. Activate Armor Shrine (128, shrine_armor, curse=1)
    const shrineRes = bus.applyState({
      stateNameOrId: 'shrine_armor',
      slvl: 1,
      durationFrames: 2400,
      currentFrame: 100,
      stats: { item_armor_percent: 100 },
    })
    expect(shrineRes.applied).toBe(true)
    expect(shrineRes.stateId).toBe(128)
    expect(bus.getState('shrine_armor')?.curseType).toBe(1)
    expect(statList.getModifierBonus('item_armor_percent')).toBe(100)

    // 2. Baal/Succubus casts Blood Mana (114, blood_mana, curse=1) -> evicts Armor Shrine!
    const bloodManaRes = bus.applyState({
      stateNameOrId: 'blood_mana',
      sourceSkillId: 285,
      slvl: 1,
      durationFrames: 300,
      currentFrame: 150,
    })
    expect(bloodManaRes.applied).toBe(true)
    expect(bloodManaRes.stateId).toBe(114)
    expect(bloodManaRes.evictedState).toBe('shrine_armor')
    expect(bus.hasState('shrine_armor')).toBe(false)
    expect(bus.hasState('blood_mana')).toBe(true)
    expect(statList.getModifierBonus('item_armor_percent')).toBe(0)

    // 3. Baal casts Defense Curse (113, defense_curse, curse=1) -> evicts Blood Mana!
    const defCurseRes = bus.applyState({
      stateNameOrId: 'defense_curse',
      sourceSkillId: 284,
      slvl: 1,
      durationFrames: 300,
      currentFrame: 160,
      stats: { item_armor_percent: -60 },
    })
    expect(defCurseRes.applied).toBe(true)
    expect(defCurseRes.stateId).toBe(113)
    expect(defCurseRes.evictedState).toBe('blood_mana')
    expect(bus.hasState('blood_mana')).toBe(false)
    expect(bus.hasState('defense_curse')).toBe(true)
    expect(statList.getModifierBonus('item_armor_percent')).toBe(-60)

    // 4. Touching a Skill Shrine (134, shrine_skill, curse=1) -> evicts Defense Curse!
    const skillShrineRes = bus.applyState({
      stateNameOrId: 134,
      slvl: 1,
      durationFrames: 2400,
      currentFrame: 200,
      stats: { item_allskills: 2 },
    })
    expect(skillShrineRes.applied).toBe(true)
    expect(skillShrineRes.stateName).toBe('shrine_skill')
    expect(skillShrineRes.evictedState).toBe('defense_curse')
    expect(bus.hasState('defense_curse')).toBe(false)
    expect(bus.hasState('shrine_skill')).toBe(true)
    expect(statList.getModifierBonus('item_armor_percent')).toBe(0)
    expect(statList.getModifierBonus('item_allskills')).toBe(2)

    // 5. Overseer Bloodlust (141, bloodlust, curse=1) on a monster shares the curse slot
    const monBus = new StateBus(new UnitStatList())
    monBus.applyState({
      stateNameOrId: 'bloodlust',
      sourceSkillId: 295,
      slvl: 3,
      durationFrames: 250,
      currentFrame: 10,
    })
    expect(monBus.getState('bloodlust')?.curseType).toBe(1)
    const decRes = monBus.applyState({
      stateNameOrId: 'decrepify',
      sourceSkillId: 87,
      slvl: 1,
      durationFrames: 100,
      currentFrame: 20,
    })
    expect(decRes.applied).toBe(true)
    expect(decRes.evictedState).toBe('bloodlust')
    expect(monBus.hasState('bloodlust')).toBe(false)
    expect(monBus.hasState('decrepify')).toBe(true)
  })

  it('implements 0x6FCC01FD..0x6FCC0263 same-curse slvl comparison (reject <, in-place expireFrame refresh ==, replace >) and different-skillId overwrite', () => {
    const statList = new UnitStatList()
    const bus = new StateBus(statList)

    // Apply Amplify Damage (9) at slvl 5, frame 100, duration 200 -> expireFrame = 300
    const first = bus.applyState({
      stateNameOrId: 'amplifydamage',
      sourceSkillId: 66,
      slvl: 5,
      durationFrames: 200,
      currentFrame: 100,
      stats: { amplify_phys_pierce: 100 },
    })
    expect(first.applied).toBe(true)
    const entryRef = bus.getState('amplifydamage')!
    expect(entryRef.expireFrame).toBe(300)

    // 1. Lower slvl (slvl 3 < 5) -> rejected (0x6FCC0259), expireFrame unchanged
    const lower = bus.applyState({
      stateNameOrId: 'amplifydamage',
      sourceSkillId: 66,
      slvl: 3,
      durationFrames: 500,
      currentFrame: 150,
    })
    expect(lower.applied).toBe(false)
    expect(lower.activeSlvl).toBe(5)
    expect(bus.getState('amplifydamage')?.expireFrame).toBe(300)

    // 2. Equal slvl (slvl 5 === 5) -> refreshes expireFrame in-place (0x6FCC021B..0x6FCC024E) without evicting
    const equal = bus.applyState({
      stateNameOrId: 'amplifydamage',
      sourceSkillId: 66,
      slvl: 5,
      durationFrames: 200,
      currentFrame: 180,
    })
    expect(equal.applied).toBe(true)
    expect(equal.evictedState).toBeUndefined()
    expect(bus.getState('amplifydamage')).toBe(entryRef) // updated in-place!
    expect(bus.getState('amplifydamage')?.expireFrame).toBe(380)
    expect(statList.getActiveModifiers().find(m => m.stateName === 'amplifydamage')?.expireFrame).toBe(380)

    // 3. Higher slvl (slvl 8 > 5) -> replaces entry (0x6FCC0257)
    const higher = bus.applyState({
      stateNameOrId: 'amplifydamage',
      sourceSkillId: 66,
      slvl: 8,
      durationFrames: 250,
      currentFrame: 200,
      stats: { amplify_phys_pierce: 100 },
    })
    expect(higher.applied).toBe(true)
    expect(higher.activeSlvl).toBe(8)
    expect(bus.getState('amplifydamage')?.slvl).toBe(8)
    expect(bus.getState('amplifydamage')?.expireFrame).toBe(450)

    // 4. Same stateId (56 'terror') but DIFFERENT skillId (0x6FCC0208: Howl #130 vs Terror #77) overwrites even at lower slvl!
    const terrorFromHowl = bus.applyState({
      stateNameOrId: 'terror',
      sourceSkillId: 130,
      slvl: 10,
      durationFrames: 300,
      currentFrame: 210,
    })
    expect(terrorFromHowl.applied).toBe(true)
    expect(bus.getState('terror')?.slvl).toBe(10)

    const terrorFromNecro = bus.applyState({
      stateNameOrId: 'terror',
      sourceSkillId: 77,
      slvl: 1,
      durationFrames: 150,
      currentFrame: 220,
    })
    expect(terrorFromNecro.applied).toBe(true)
    expect(bus.getState('terror')?.slvl).toBe(1)
    expect(bus.getState('terror')?.sourceSkillId).toBe(77)
  })

  it('enforces Attract (57) overwrite immunity (0x6FCC01C1) and STAT_CURSE_RESISTANCE (109, 0x6FCC0192)', () => {
    const statList = new UnitStatList()
    const bus = new StateBus(statList)

    // Attract (57) blocks all curse=1 states (including cloaked, defense_curse, shrine_armor, amplifydamage)
    const att = bus.applyState({
      stateNameOrId: 'attract',
      sourceSkillId: 86,
      slvl: 5,
      durationFrames: 300,
      currentFrame: 0,
    })
    expect(att.applied).toBe(true)
    expect(bus.getState('attract')?.curseType).toBe(2)

    for (const incoming of ['amplifydamage', 'cloaked', 'defense_curse', 'shrine_armor', 'attract']) {
      const blocked = bus.applyState({
        stateNameOrId: incoming,
        slvl: 20,
        durationFrames: 500,
        currentFrame: 10,
      })
      expect(blocked.applied).toBe(false)
      expect(blocked.blockedByAttract).toBe(true)
    }

    // STAT_CURSE_RESISTANCE (109): 60% reduces 200 frames to 80 frames; 100% rejects curse completely
    const fadeStats = new UnitStatList(undefined, { curse_resistance: 60 })
    const fadeBus = new StateBus(fadeStats)
    const reduced = fadeBus.applyState({
      stateNameOrId: 'decrepify',
      sourceSkillId: 87,
      slvl: 1,
      durationFrames: 200,
      currentFrame: 50,
    })
    expect(reduced.applied).toBe(true)
    expect(fadeBus.getState('decrepify')?.durationFrames).toBe(80)
    expect(fadeBus.getState('decrepify')?.expireFrame).toBe(130)

    fadeStats.setBaseStat('curse_resistance', 100)
    const immune = fadeBus.applyState({
      stateNameOrId: 'amplifydamage',
      sourceSkillId: 66,
      slvl: 20,
      durationFrames: 500,
      currentFrame: 60,
    })
    expect(immune.applied).toBe(false)
  })

  it('evaluates curseType from States.txt in evaluateSkillCore113c and applies cloak_of_shadows (153) to caster and cloaked (156) to enemies in executeSkillCore113c', () => {
    const registry = getSharedDataRegistry()
    const statList = new UnitStatList(registry, {
      level: 30,
      maxmana: 200 * FIXED_ONE,
      mana: 200 * FIXED_ONE,
    })

    // Non-curse debuff skills (Inner Sight #8, Slow Missiles #17) have curseType = 0
    for (const nonCurseSkillId of [8, 17]) {
      const sk = registry.getSkillById(nonCurseSkillId)!
      const ev = evaluateSkillCore113c({ registry, skill: sk, slvl: 5, blvl: 5, statList })
      expect(ev.curseType).toBe(0)
    }

    // Attract (#86) has curseType = 2
    const sk86 = registry.getSkillById(86)!
    expect(evaluateSkillCore113c({ registry, skill: sk86, slvl: 5, blvl: 5, statList }).curseType).toBe(2)

    // Standard curse skills (#66, #71, #72, #76, #77, #81, #82, #87, #91, #130, #137, #146, #150, #264) have curseType = 1
    for (const curseSkillId of [66, 71, 72, 76, 77, 81, 82, 87, 91, 130, 137, 146, 150, 264]) {
      const sk = registry.getSkillById(curseSkillId)!
      const ev = evaluateSkillCore113c({ registry, skill: sk, slvl: 5, blvl: 5, statList })
      expect(ev.curseType).toBe(1)
    }

    // Execute Skill #264 (Cloak of Shadows): caster gets state 153 (cloak_of_shadows), target gets state 156 (cloaked)
    const casterBus = new StateBus(statList, registry)
    const caster: CombatUnitContext = {
      id: 'ass-1',
      name: 'Assassin',
      charClass: 'assassin',
      statList,
      stateBus: casterBus,
      unitType: 'player',
    }
    const mobStats = new UnitStatList(registry, { level: 10 })
    const mobBus = new StateBus(mobStats, registry)
    const mob: CombatUnitContext = {
      id: 'mob-1',
      name: 'Fallen',
      statList: mobStats,
      stateBus: mobBus,
      unitType: 'monster',
    }
    const sk264 = registry.getSkillById(264)!
    const ev264 = evaluateSkillCore113c({ registry, skill: sk264, slvl: 5, blvl: 5, statList })
    const res = executeSkillCore113c({
      registry,
      skill: sk264,
      evalResult: ev264,
      caster,
      targets: [mob],
      targetPositions: new Map([
        ['ass-1', { x: 100, y: 100 }],
        ['mob-1', { x: 110, y: 100 }],
      ]),
      corpses: [],
      missileEngine: new MissileEngine(registry),
      auraScanner: new AuraScanner(registry),
      summonManager: new SummonManager(registry),
      currentTick: 10,
      targetX: 100,
      targetY: 100,
      difficulty: 'normal',
    })
    expect(res.executed).toBe(true)
    expect(casterBus.getState('cloak_of_shadows')?.stateId).toBe(153)
    expect(casterBus.getState('cloak_of_shadows')?.curseType).toBe(0)
    expect(casterBus.hasState('cloaked')).toBe(false)
    expect(mobBus.getState('cloaked')?.stateId).toBe(156)
    expect(mobBus.getState('cloaked')?.curseType).toBe(1)
    expect(mobBus.hasState('cloak_of_shadows')).toBe(false)
  })

  it('evicts active shrines when cursed and evicts active curses when activating a shrine on GameInstance', () => {
    const game = new GameInstance()
    const pid = game.addPlayer({ name: 'Hero', classId: 0 })

    // Apply Armor Shrine (state 128)
    expect(game.applyPlayerState(pid, 128, 2400)).toBe(true)
    expect(game.getPlayerState(pid)?.states.has(128)).toBe(true)

    // Apply Amplify Damage (state 9) -> evicts Armor Shrine (128)
    expect(game.applyPlayerState(pid, 9, 200)).toBe(true)
    expect(game.getPlayerState(pid)?.states.has(128)).toBe(false)
    expect(game.getPlayerState(pid)?.states.has(9)).toBe(true)

    // Apply Skill Shrine (state 134) -> evicts Amplify Damage (9)
    expect(game.applyPlayerState(pid, 134, 2400)).toBe(true)
    expect(game.getPlayerState(pid)?.states.has(9)).toBe(false)
    expect(game.getPlayerState(pid)?.states.has(134)).toBe(true)
  })
})

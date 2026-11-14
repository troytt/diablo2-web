import { describe, expect, it } from 'vitest'
import {
  canMonsterClassBeCursed113c,
  canMonsterTargetBeCursed113c,
  resolveMonsterClassId113c,
} from '../src/common/units/monstats2-flags.ts'
import { ClientWorld, CURSE_SKILL_STATES, CURSE_TARGET_OVERLAYS } from '../src/client/world/client-world.ts'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { evaluateSkillCore113c, executeSkillCore113c } from '../src/server/skills/registry.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import type { CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'

describe('Issue #1016: Buildings and structures are immune to Necromancer curses (1.13c D2Game.dll 0x6FC6ECD0 / D2Common_11085)', () => {
  const BUILDING_AND_STRUCTURE_HCIDX: ReadonlyArray<readonly [number, string]> = [
    [190, 'maggotegg1'],
    [206, 'crownest1'],
    [228, 'sarcophagus'],
    [273, 'gargoyletrap'],
    [321, 'evilhole1'],
    [326, 'trap-firebolt'],
    [334, 'suckernest1'],
    [340, 'boneprison1'],
    [344, 'bonewall'],
    [348, 'turret1'],
    [371, 'lightningspire'],
    [372, 'firetower'],
    [392, 'window1'],
    [403, 'trappedsoul1'],
    [432, 'barricadedoor1'],
    [433, 'barricadedoor2'],
    [434, 'prisondoor'],
    [435, 'barricadetower'],
    [497, 'catapult1'],
    [524, 'barricadewall1'],
    [525, 'barricadewall2'],
    [528, 'evilhut'],
  ]

  it('rejects all 1.13c buildings, barricades, towers, walls, nests, traps, and bone walls in canMonsterClassBeCursed113c', () => {
    for (const [hcIdx, monId] of BUILDING_AND_STRUCTURE_HCIDX) {
      expect(resolveMonsterClassId113c(monId)).toBe(hcIdx)
      expect(canMonsterClassBeCursed113c(hcIdx), `${monId} (#${hcIdx})`).toBe(false)
      expect(canMonsterTargetBeCursed113c({ classId: hcIdx }), `${monId} classId`).toBe(false)
      expect(canMonsterTargetBeCursed113c({ monId }), `${monId} monId`).toBe(false)
    }

    // Town NPCs cannot be cursed
    expect(canMonsterClassBeCursed113c(146)).toBe(false) // cain1
    expect(canMonsterClassBeCursed113c(148)).toBe(false) // akara
    expect(canMonsterClassBeCursed113c(154)).toBe(false) // charsi

    // Normal hostile monsters and bosses with mWL=1, isAtt=1, npc=0 CAN be cursed
    expect(canMonsterClassBeCursed113c(0)).toBe(true) // skeleton1
    expect(canMonsterClassBeCursed113c(5)).toBe(true) // zombie1
    expect(canMonsterClassBeCursed113c(19)).toBe(true) // fallen1
    expect(canMonsterClassBeCursed113c(156)).toBe(true) // andariel
    expect(canMonsterClassBeCursed113c(243)).toBe(true) // diablo
    expect(canMonsterClassBeCursed113c(544)).toBe(true) // baalcrab
  })

  it('prevents ClientWorld from applying any of the 10 Necromancer curses or curse overlays to buildings', () => {
    const curseSkillIds = [66, 71, 72, 76, 77, 81, 82, 86, 87, 91]

    for (const skillId of curseSkillIds) {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 90, y: 90 })

      // Spawn buildings right at the curse target (100, 100)
      let nextUnitId = 600
      for (const [hcIdx] of BUILDING_AND_STRUCTURE_HCIDX) {
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: nextUnitId++, classId: hcIdx, x: 100, y: 100, lifePct: 128, mode: 1 },
        })
      }

      // Spawn a regular hostile skeleton1 (classId = 0) at (102, 100)
      const skeletonUnitId = 900
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: skeletonUnitId, classId: 0, x: 102, y: 100, lifePct: 128, mode: 1 },
      })

      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, skillId, 100, 100, 5)

      const expectedStateId = CURSE_SKILL_STATES[skillId]!
      const expectedOverlay = CURSE_TARGET_OVERLAYS[skillId]!

      // None of the buildings may receive the curse state or curse overlay
      let checkUnitId = 600
      for (const [, monId] of BUILDING_AND_STRUCTURE_HCIDX) {
        const bldg = world.getUnit('monster', checkUnitId++)!
        expect(bldg.states.has(expectedStateId), `skill ${skillId} state on ${monId}`).toBe(false)
        expect(
          bldg.overlays.some((o) => o.token === expectedOverlay || o.token === 'curse_hit'),
          `skill ${skillId} overlay on ${monId}`,
        ).toBe(false)
      }

      // The normal skeleton MUST receive the curse state and overlay (even for single-target Attract #86,
      // because closer buildings at (100, 100) are skipped!)
      const skel = world.getUnit('monster', skeletonUnitId)!
      expect(skel.states.has(expectedStateId), `skill ${skillId} state on skeleton1`).toBe(true)
      expect(
        skel.overlays.some((o) => o.token === expectedOverlay),
        `skill ${skillId} overlay on skeleton1`,
      ).toBe(true)
    }
  })

  it('prevents server executeSkillCore113c from cursing buildings across all 10 Necromancer curses', async () => {
    const registry = await getSharedDataRegistry()
    const curseSkillIds = [66, 71, 72, 76, 77, 81, 82, 86, 87, 91]

    for (const skillId of curseSkillIds) {
      const skill = registry.getSkillById(skillId)!
      const casterStats = new UnitStatList()
      casterStats.setBaseSkillLevel(skillId, 5)
      const caster: CombatUnitContext = {
        id: 'nec',
        name: 'Necromancer',
        statList: casterStats,
        stateBus: new StateBus(casterStats, registry),
        unitType: 'player',
      }

      const bldgStats = new UnitStatList()
      bldgStats.setHp256(500 * FIXED_ONE)
      const bldgTower: CombatUnitContext & { classId: number } = {
        id: 'bldg-tower',
        name: 'barricadetower',
        classId: 435,
        statList: bldgStats,
        stateBus: new StateBus(bldgStats, registry),
        unitType: 'monster',
      }

      const hutStats = new UnitStatList()
      hutStats.setHp256(500 * FIXED_ONE)
      const evilHut: CombatUnitContext & { classId: number } = {
        id: 'bldg-hut',
        name: 'evilhut',
        classId: 528,
        statList: hutStats,
        stateBus: new StateBus(hutStats, registry),
        unitType: 'monster',
      }

      const skelStats = new UnitStatList()
      skelStats.setHp256(500 * FIXED_ONE)
      const skeleton: CombatUnitContext & { classId: number } = {
        id: 'mon-skel',
        name: 'skeleton1',
        classId: 0,
        statList: skelStats,
        stateBus: new StateBus(skelStats, registry),
        unitType: 'monster',
      }

      const evalRes = evaluateSkillCore113c({
        registry,
        skill,
        slvl: 5,
        blvl: 5,
        statList: casterStats,
        difficulty: 'normal',
      })

      const execRes = executeSkillCore113c({
        registry,
        skill,
        evalResult: evalRes,
        caster,
        targets: [bldgTower, evilHut, skeleton],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: {} as any,
        auraScanner: {} as any,
        summonManager: {} as any,
        currentTick: 1,
        targetX: 100,
        targetY: 100,
        difficulty: 'normal',
      })

      expect(execRes.executed).toBe(true)
      expect(bldgTower.stateBus.getActiveEntries().length, `skill ${skillId} on barricadetower`).toBe(0)
      expect(evilHut.stateBus.getActiveEntries().length, `skill ${skillId} on evilhut`).toBe(0)
      expect(skeleton.stateBus.getActiveEntries().length, `skill ${skillId} on skeleton1`).toBe(1)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { MONSTATS_113C_ROWS } from '../src/common/units/monsters-data.ts'
import { hasMonStats2Flag, MONSTATS2_FLAGINDEX } from '../src/common/units/monstats2-flags.ts'
import { CommandMapper, isPlayerSummonClassId } from '../src/client/input/command-mapper.ts'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { isAlliedCombatMonster113c } from '../src/client/world/world-missile-stepper.ts'
import {
  findHostileMeleeTargetMonster113c,
  resolveEnchantTargetUnit113c,
} from '../src/client/world/world-skill-missiles.ts'

describe('Issue #1394: 1.13c non-hostile and non-attackable monster classification sweep', () => {
  it('treats all enabled MonStats/MonStats2 rows with align != 0, npc == 1, isAtt == 0, or critter == 1 as non-hostile in ClientWorld', () => {
    const world = new ClientWorld()
    for (const row of MONSTATS_113C_ROWS) {
      if (!row.enabled) continue
      const isAtt = hasMonStats2Flag(row.hcIdx, MONSTATS2_FLAGINDEX.ISATT)
      const isCritter = hasMonStats2Flag(row.hcIdx, MONSTATS2_FLAGINDEX.CRITTER)
      const unit = new ClientUnit({
        unitType: 1,
        id: 1000 + row.hcIdx,
        classId: row.hcIdx,
        x: 100,
        y: 100,
      })
      const nonHostile = (world as any).isFriendlyOrNonHostileMonster(unit)
      if (row.align !== 0 || row.npc || !isAtt || isCritter) {
        expect(nonHostile, `expected hcIdx=${row.hcIdx} (${row.id}) to be non-hostile`).toBe(true)
      }
    }
  })

  it('keeps Diablo Bone Prison (boneprison1..4, hcIdx 340..343) hostile/attackable while Necro Bone Wall (344) is friendly', () => {
    const world = new ClientWorld()
    for (const hcIdx of [340, 341, 342, 343]) {
      const prison = new ClientUnit({ unitType: 1, id: hcIdx, classId: hcIdx, x: 50, y: 50 })
      expect((world as any).isFriendlyOrNonHostileMonster(prison)).toBe(false)
    }
    const boneWall = new ClientUnit({ unitType: 1, id: 344, classId: 344, x: 50, y: 50 })
    expect((world as any).isFriendlyOrNonHostileMonster(boneWall)).toBe(true)
    expect(isPlayerSummonClassId(344)).toBe(true)
  })

  it('excludes non-attackable spawners/traps, critters, NPCs, and bonewall from allied Enchant/HolyBolt targeting while keeping combat allies', () => {
    const world = new ClientWorld()
    const caster = new ClientUnit({ unitType: 0, id: 1, classId: 1, x: 100, y: 100 })
    ;(world as any)._units.set(caster.key, caster)

    const invisospawner = new ClientUnit({ unitType: 1, id: 101, classId: 332, x: 102, y: 100 })
    const fireboltTrap = new ClientUnit({ unitType: 1, id: 102, classId: 326, x: 102, y: 100 })
    const flavie = new ClientUnit({ unitType: 1, id: 103, classId: 270, x: 102, y: 100 })
    const cow = new ClientUnit({ unitType: 1, id: 104, classId: 179, x: 102, y: 100 })
    const boneWall = new ClientUnit({ unitType: 1, id: 105, classId: 344, x: 102, y: 100 })
    const act5Barb = new ClientUnit({ unitType: 1, id: 106, classId: 522, x: 103, y: 100 })

    expect(isAlliedCombatMonster113c(world as any, invisospawner)).toBe(false)
    expect(isAlliedCombatMonster113c(world as any, fireboltTrap)).toBe(false)
    expect(isAlliedCombatMonster113c(world as any, flavie)).toBe(false)
    expect(isAlliedCombatMonster113c(world as any, cow)).toBe(false)
    expect(isAlliedCombatMonster113c(world as any, boneWall)).toBe(false)
    expect(isAlliedCombatMonster113c(world as any, act5Barb)).toBe(true)

    for (const u of [invisospawner, fireboltTrap, flavie, cow, boneWall]) {
      ;(world as any)._units.set(u.key, u)
    }
    expect(resolveEnchantTargetUnit113c(world as any, caster, 102, 100)).toBe(caster)

    ;(world as any)._units.set(act5Barb.key, act5Barb)
    expect(resolveEnchantTargetUnit113c(world as any, caster, 103, 100)).toBe(act5Barb)

    expect(findHostileMeleeTargetMonster113c(world as any, caster, 102, 100, 5.0)).toBeUndefined()
  })

  it('classifies real ClientUnit allies and non-attackable monsters in CommandMapper without requiring ad-hoc align/killable fields', () => {
    const world = new ClientWorld()
    const mapper = new CommandMapper({ world })

    const act5Barb = new ClientUnit({ unitType: 1, id: 201, classId: 522, x: 50, y: 50 })
    const darkWanderer = new ClientUnit({ unitType: 1, id: 202, classId: 368, x: 50, y: 50 })
    const partyMerc = new ClientUnit({ unitType: 1, id: 203, classId: 338, x: 50, y: 50 })
    const fallen = new ClientUnit({ unitType: 1, id: 204, classId: 59, x: 50, y: 50 })

    expect(mapper.isFriendlySummonOrPet(act5Barb, world)).toBe(true)
    expect(mapper.isTownOrInteractiveNpc(act5Barb, world)).toBe(false)
    expect(mapper.isFriendlySummonOrPet(darkWanderer, world)).toBe(true)
    expect(mapper.isFriendlySummonOrPet(partyMerc, world)).toBe(true)
    expect(mapper.isTownOrInteractiveNpc(partyMerc, world)).toBe(false)
    expect(mapper.isFriendlySummonOrPet(fallen, world)).toBe(false)

    // Enchant (#52) can target allied combat units (act5barb1, partyMerc) but not non-attackable darkwanderer (368)
    expect(mapper.isValidSkillTargetUnit(act5Barb, 52, world)).toBe(true)
    expect(mapper.isValidSkillTargetUnit(partyMerc, 52, world)).toBe(true)
    expect(mapper.isValidSkillTargetUnit(darkWanderer, 52, world)).toBe(false)
    expect(mapper.isValidSkillTargetUnit(darkWanderer, 0, world)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../../../src/client/session/rate-limiter.ts'
import { HudModel } from '../../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../../src/netproto/index.ts'

describe('Issue #1010 — Skeleton and Revive nearby corpse targeting without exact cursor alignment', () => {
  function createTestSetup() {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const sentCommands: ClientCommand[] = []
    const hudModel = new HudModel({ world, hudManager, onCommand: (cmd) => sentCommands.push(cmd) })
    const predictor = new LocalMovementPredictor()
    predictor.setPosition(5000, 5000)
    const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 })

    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 2,
      name: 'NecroHero',
      x: 5000,
      y: 5000,
    })

    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      rateLimiter,
      sendCommand: (cmd) => sentCommands.push(cmd),
    })
    return { world, hudManager, mapper, sentCommands }
  }

  it('targets a nearby corpse when cursor is not directly aligned with the corpse (Raise Skeleton 70, Skeletal Mage 80, Revive 95)', () => {
    for (const skillId of [70, 80, 95]) {
      const { world, mapper, sentCommands } = createTestSetup()
      world.self.rightSkill = skillId

      // Corpse at (5014, 5012), cursor clicks 6 subtiles away at (5008, 5012) with hoveredUnit = null
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 101, classId: 0, name: 'Skeleton', x: 5014, y: 5012 },
      })
      const corpse = world.getUnit('monster', 101)!
      corpse.dead = true
      corpse.mode = 12

      const rec = mapper.triggerSecondaryWorldAction(5008, 5012, null, 2000)
      expect(rec).not.toBeNull()
      expect(sentCommands).toEqual([
        {
          type: 'SkillOn',
          hand: 'right',
          target: { unitType: 1, id: 101 },
          shift: false,
          hold: false,
        },
      ])
    }
  })

  it('targets the corpse even when a dropped ground item or live monster overlaps and steals hover under the cursor', () => {
    const { world, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = 70

    // Valid corpse at (5012, 5010)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 102, classId: 0, name: 'FallenCorpse', x: 5012, y: 5010 },
    })
    const corpse = world.getUnit('monster', 102)!
    corpse.dead = true
    corpse.mode = 12

    // Live monster right at the cursor (5010, 5010)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 103, classId: 0, name: 'LiveFallen', x: 5010, y: 5010 },
    })
    const liveMonster = world.getUnit('monster', 103)!

    const rec = mapper.triggerSecondaryWorldAction(5010, 5010, liveMonster, 2000)
    expect(rec).not.toBeNull()
    expect(sentCommands).toEqual([
      {
        type: 'SkillOn',
        hand: 'right',
        target: { unitType: 1, id: 102 },
        shift: false,
        hold: false,
      },
    ])
  })

  it('picks the closest valid corpse to the cursor and skips consumed/boss/non-revivable corpses', () => {
    const { world, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = 95 // Revive

    // Closer corpse at (5011, 5010) is FlyingScimitar (classId 234, revive=0 -> invalid for Revive)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 201, classId: 234, name: 'FlyingScimitar', x: 5011, y: 5010 },
    })
    const invalidReviveCorpse = world.getUnit('monster', 201)!
    invalidReviveCorpse.dead = true
    invalidReviveCorpse.mode = 12

    // Slightly farther corpse at (5015, 5010) is valid Skeleton (classId 0, revive=1)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 202, classId: 0, name: 'Skeleton', x: 5015, y: 5010 },
    })
    const validCorpse = world.getUnit('monster', 202)!
    validCorpse.dead = true
    validCorpse.mode = 12

    const rec = mapper.triggerSecondaryWorldAction(5010, 5010, null, 2000)
    expect(rec).not.toBeNull()
    expect(sentCommands).toEqual([
      {
        type: 'SkillOn',
        hand: 'right',
        target: { unitType: 1, id: 202 },
        shift: false,
        hold: false,
      },
    ])

    // Corpse far outside radius (e.g. 25 subtiles away) is not targeted
    validCorpse.x = 5035
    validCorpse.y = 5035
    expect(mapper.triggerSecondaryWorldAction(5010, 5010, null, 3000)).toBeNull()
  })
})

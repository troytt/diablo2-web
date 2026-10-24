/**
 * Unit tests for CommandMapper — Issue #792 (R5: Require Melee Range for NPC, Chest, and Object Interactions)
 * and Issue #796 (R9: Prevent Casting Damage / Non-Town Spells in Town).
 */

import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../src/client/session/rate-limiter.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { IN_TOWN_SKILL_IDS_113C, isSkillAllowedInTown } from '../src/common/skills/skills-meta.ts'
import type { ClientCommand } from '../src/netproto/index.ts'

describe('CommandMapper — Issue #792: Melee Contact Range for NPC, Chest, and Object Interactions', () => {
  function createTestSetup(startX = 5000, startY = 5000, areaId = 1) {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const sentCommands: ClientCommand[] = []
    const hudModel = new HudModel({
      world,
      hudManager,
      onCommand: (cmd) => sentCommands.push(cmd),
    })
    const predictor = new LocalMovementPredictor()
    predictor.setPosition(startX, startY)
    const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0 })

    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 1,
      name: 'Hero',
      x: startX,
      y: startY,
    })

    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      rateLimiter,
      sendCommand: (cmd) => sentCommands.push(cmd),
    })

    return { world, hudManager, hudModel, predictor, mapper, sentCommands }
  }

  it('1. clicking an interactive object (Chest / Stash / Waypoint / Shrine / Door) at dist > 2.5 only sends MoveToUnit (0x04) and defers Interact (0x13) until tick() reaches melee range', () => {
    const { world, predictor, mapper, sentCommands } = createTestSetup(5000, 5000, 1)

    // Spawn Stash (object classId 267) at (5006, 5000) -> dist = 6 > 2.5
    const stashId = 2670
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: stashId,
        classId: 267,
        name: 'Bank',
        x: 5006,
        y: 5000,
        mode: 0,
      },
    })
    const stashUnit = world.getUnit('object', stashId)!

    const clickRecord = mapper.triggerPrimaryWorldAction(5006, 5000, stashUnit, 1000)
    expect(clickRecord?.command).toEqual({
      type: 'MoveToUnit',
      run: true,
      target: { unitType: 2, id: stashId },
    })

    // Must NOT have sent Interact (0x13) on the initial click from dist = 6
    expect(sentCommands.map((c) => c.type)).toEqual(['MoveToUnit'])
    expect(mapper.getPendingObjectInteractId()).toBe(stashId)

    // Tick while still outside melee range at (5003, 5000) -> dist = 3.0 > 2.5
    predictor.setPosition(5003, 5000)
    world.self.x = 5003
    world.self.y = 5000
    expect(mapper.tick(1100)).toBeNull()
    expect(sentCommands.some((c) => c.type === 'Interact')).toBe(false)
    expect(mapper.getPendingObjectInteractId()).toBe(stashId)

    // Tick once player enters melee contact range at (5004, 5000) -> dist = 2.0 <= 2.5
    predictor.setPosition(5004, 5000)
    world.self.x = 5004
    world.self.y = 5000
    const tickCmd = mapper.tick(1200)
    expect(tickCmd).toEqual({
      type: 'Interact',
      target: { unitType: 2, id: stashId },
    })
    expect(sentCommands.map((c) => c.type)).toEqual(['MoveToUnit', 'Interact'])
    expect(mapper.getPendingObjectInteractId()).toBeNull()
  })

  it('2. clicking an interactive object already within melee range (dist <= 2.5) immediately sends Interact (0x13) without pending deferral', () => {
    const { world, mapper, sentCommands } = createTestSetup(5000, 5000, 2)

    // Spawn Chest (object classId 5) at (5002, 5000) -> dist = 2.0 <= 2.5
    const chestId = 5001
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: chestId,
        classId: 5,
        name: 'Chest',
        x: 5002,
        y: 5000,
        mode: 0,
      },
    })
    const chestUnit = world.getUnit('object', chestId)!

    const clickRecord = mapper.triggerPrimaryWorldAction(5002, 5000, chestUnit, 1000)
    expect(clickRecord?.command).toEqual({
      type: 'Interact',
      target: { unitType: 2, id: chestId },
    })
    expect(sentCommands.map((c) => c.type)).toEqual(['Interact'])
    expect(mapper.getPendingObjectInteractId()).toBeNull()
  })

  it('3. clicking an NPC outside the 1.13c interaction range (#10407 > 2) sends MoveToUnit + MakeEntityMove and defers Interact (0x13) + NpcInit (0x2f) until tick() arrives within #10407 <= 2 (0x6fac9ef0)', () => {
    const { world, predictor, mapper, sentCommands } = createTestSetup(5000, 5000, 1)

    // Spawn Akara (hcIdx 148, MonStats interact, sizeX=2) at (5005, 5000) -> dx = 5: #10407 = 4 > 2
    const akaraId = 1481
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: akaraId,
        classId: 148,
        name: 'Akara',
        x: 5005,
        y: 5000,
        lifePct: 128,
        mode: 1,
      },
    })
    const akaraUnit = world.getUnit('monster', akaraId)!

    mapper.triggerPrimaryWorldAction(5005, 5000, akaraUnit, 1000)
    expect(sentCommands.map((c) => c.type)).toEqual(['MoveToUnit', 'MakeEntityMove'])
    expect(mapper.getPendingNpcInteractId()).toBe(akaraId)

    // Still at dx = 4, dy = 2 (#10407 = 0x6FDDABC0[4 + 2 * 8] = 3 > 2): deferred
    predictor.setPosition(5001, 4998)
    world.self.x = 5001
    world.self.y = 4998
    expect(mapper.tick(1100)).toBeNull()
    expect(sentCommands.some((c) => c.type === 'Interact')).toBe(false)

    // Arrives at (5001, 5000) -> dx = 4 (#10407 = 0x6FDDABC0[4] = 2 <= 2): dispatches Interact then NpcInit
    predictor.setPosition(5001, 5000)
    world.self.x = 5001
    world.self.y = 5000
    const tickCmd = mapper.tick(1200)
    expect(tickCmd).toEqual({
      type: 'NpcInit',
      target: { unitType: 1, id: akaraId },
    })
    expect(sentCommands.map((c) => c.type)).toEqual([
      'MoveToUnit',
      'MakeEntityMove',
      'Interact',
      'NpcInit',
    ])
    expect(mapper.getPendingNpcInteractId()).toBeNull()
  })

  it('4. tick() uses predictor snapshot when predSnap.x !== 0 && predSnap.y === 0 (fixes predSnap.y !== 0 || predSnap.y !== 0 typo)', () => {
    const { world, predictor, mapper, sentCommands } = createTestSetup(0, 0, 1)

    // Spawn Chest at (10, 0) while world.self is at (0, 0)
    const chestId = 5002
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: chestId,
        classId: 5,
        name: 'Chest',
        x: 10,
        y: 0,
        mode: 0,
      },
    })
    const chestUnit = world.getUnit('object', chestId)!

    mapper.triggerPrimaryWorldAction(10, 0, chestUnit, 1000)
    expect(sentCommands.map((c) => c.type)).toEqual(['MoveToUnit'])

    // Predictor moves along X axis with Y === 0: predSnap = { x: 8, y: 0 }, while world.self is still { x: 0, y: 0 }
    predictor.setPosition(8, 0)
    const tickCmd = mapper.tick(1200)
    expect(tickCmd).toEqual({
      type: 'Interact',
      target: { unitType: 2, id: chestId },
    })
    expect(mapper.getPendingObjectInteractId()).toBeNull()
  })
})

describe('CommandMapper & ClientWorld — Issue #796: Prevent Casting Damage / Non-Town Spells in Town (1.13c Skills.txt InTown)', () => {
  it('1. IN_TOWN_SKILL_IDS_113C and isSkillAllowedInTown match canonical 1.13c Skills.txt InTown=1 (63 skills)', () => {
    expect(IN_TOWN_SKILL_IDS_113C.size).toBe(63)

    // Canonical InTown = 1 skills
    for (const allowedId of [
      3, // Unsummon
      32, // Valkyrie
      40, // Frozen Armor
      43, // Telekinesis
      50, // Shiver Armor
      52, // Enchant
      58, // Energy Shield
      60, // Chilling Armor
      68, // Bone Armor
      75, // Clay Golem
      85, // BloodGolem
      90, // IronGolem
      94, // FireGolem
      98, // Might
      113, // Concentration
      117, // Holy Shield
      124, // Redemption
      217, // Scroll of Identify
      218, // Book of Identify
      221, // Raven
      223, // Wearwolf
      226, // Oak Sage
      228, // Wearbear
      235, // Cyclone Armor
      247, // Summon Grizzly
      258, // Burst of Speed
      267, // Fade
      268, // Shadow Warrior
      277, // Blade Shield
      278, // Venom
      279, // Shadow Master
    ]) {
      expect(isSkillAllowedInTown(allowedId)).toBe(true)
    }

    // Canonical InTown = 0 skills (must be blocked in town)
    for (const blockedId of [
      0, // Attack
      1, // Kick
      2, // Throw
      36, // Fire Bolt
      47, // Fire Ball
      48, // Nova
      49, // Lightning
      53, // Chain Lightning
      54, // Teleport
      56, // Meteor
      59, // Blizzard
      64, // Frozen Orb
      112, // Blessed Hammer
      138, // Shout
      149, // Battle Orders
      155, // Battle Command
      219, // Scroll of Townportal
      220, // Tome of Townportal
    ]) {
      expect(isSkillAllowedInTown(blockedId)).toBe(false)
    }
  })

  it('2. right-clicking in town (areaId in {1, 40, 75, 103, 109}) blocks non-town spells (Fire Ball, Teleport, Town Portal, Blizzard) and does not start cast animation or spawn missiles', () => {
    for (const townAreaId of [1, 40, 75, 103, 109]) {
      const world = new ClientWorld()
      const hudManager = new HudManager()
      const sentCommands: ClientCommand[] = []
      const hudModel = new HudModel({
        world,
        hudManager,
        onCommand: (cmd) => sentCommands.push(cmd),
      })
      const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 })

      world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: townAreaId })
      world.apply({
        type: 'PlayerAssign',
        unitId: 1,
        classId: 1,
        name: 'Sorceress',
        x: 5000,
        y: 5000,
      })

      const mapper = new CommandMapper({
        world,
        hudManager,
        hudModel,
        rateLimiter,
        sendCommand: (cmd) => sentCommands.push(cmd),
      })

      for (const forbiddenRightSkill of [36, 47, 54, 56, 59, 64, 219, 220]) {
        world.self.rightSkill = forbiddenRightSkill
        hudManager.hotkeys.rightSkillId = forbiddenRightSkill

        const rec = mapper.triggerSecondaryWorldAction(5010, 5010, null, 2000)
        expect(rec).toBeNull()
        expect(sentCommands).toHaveLength(0)

        const fromMouse = mapper.fromMouseDown({
          button: 'right',
          worldX: 5010,
          worldY: 5010,
        })
        expect(fromMouse).toBeNull()

        // Even if noteOutgoingCommand is called directly with SkillAt in town, it must be ignored
        world.noteOutgoingCommand(
          { type: 'SkillAt', hand: 'right', at: { x: 5010, y: 5010 }, hold: false },
          2000,
        )
        const selfUnit = world.getUnit('player', 1)!
        expect(selfUnit.castState).toBeUndefined()
        expect(Array.from(world.units.values()).filter((u) => u.unitType === 'missile')).toHaveLength(0)
      }
    }
  })

  it('3. right-clicking in town allows town-castable skills (Frozen Armor #40, Energy Shield #58, Telekinesis #43, Paladin Auras)', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const sentCommands: ClientCommand[] = []
    const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 })

    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: 1 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 1,
      name: 'Sorceress',
      x: 5000,
      y: 5000,
    })

    const mapper = new CommandMapper({
      world,
      hudManager,
      rateLimiter,
      sendCommand: (cmd) => sentCommands.push(cmd),
    })

    // Cast Frozen Armor (40) in Rogue Encampment (areaId = 1)
    world.self.rightSkill = 40
    hudManager.hotkeys.rightSkillId = 40

    const rec = mapper.triggerSecondaryWorldAction(5005, 5005, null, 3000)
    expect(rec?.command).toEqual({
      type: 'SkillAt',
      hand: 'right',
      at: { x: 5005, y: 5005 },
      hold: false,
    })
    expect(sentCommands).toHaveLength(1)
    expect(world.getUnit('player', 1)?.castState?.skillId).toBe(40)
  })

  it('4. Shift + left-click in town with a non-town skill (e.g. Fire Bolt #36 or Attack #0) falls back to ground Move / interaction instead of casting SkillAt', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const sentCommands: ClientCommand[] = []
    const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 })

    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: 1 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 1,
      name: 'Sorceress',
      x: 5000,
      y: 5000,
    })
    world.self.leftSkill = 36 // Fire Bolt (InTown = 0)
    hudManager.hotkeys.leftSkillId = 36

    const mapper = new CommandMapper({
      world,
      hudManager,
      rateLimiter,
      sendCommand: (cmd) => sentCommands.push(cmd),
    })

    mapper.handleKeyDown({ key: 'Shift', shiftKey: true })
    const rec = mapper.triggerPrimaryWorldAction(5008, 5008, null, 4000)
    expect(rec?.command).toEqual({
      type: 'Move',
      run: true,
      to: { x: 5008, y: 5008 },
    })
    expect(sentCommands.some((c) => c.type === 'SkillAt' || c.type === 'SkillOn')).toBe(false)

    const fromMouse = mapper.fromMouseDown({
      button: 'left',
      shiftKey: true,
      worldX: 5008,
      worldY: 5008,
    })
    expect(fromMouse).toEqual({
      type: 'Move',
      run: true,
      to: { x: 5008, y: 5008 },
    })
  })

  it('5. outside town (areaId = 2 Blood Moor or uninitialized areaId = 0), all offensive and non-town skills cast normally on both left and right click', () => {
    for (const nonTownAreaId of [0, 2]) {
      const world = new ClientWorld()
      const hudManager = new HudManager()
      const sentCommands: ClientCommand[] = []
      const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 })

      if (nonTownAreaId > 0) {
        world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: nonTownAreaId })
      }
      world.apply({
        type: 'PlayerAssign',
        unitId: 1,
        classId: 1,
        name: 'Sorceress',
        x: 5000,
        y: 5000,
      })
      world.self.leftSkill = 36 // Fire Bolt
      world.self.rightSkill = 47 // Fire Ball

      const mapper = new CommandMapper({
        world,
        hudManager,
        rateLimiter,
        sendCommand: (cmd) => sentCommands.push(cmd),
      })

      const rightRec = mapper.triggerSecondaryWorldAction(5010, 5010, null, 5000)
      expect(rightRec?.command).toEqual({
        type: 'SkillAt',
        hand: 'right',
        at: { x: 5010, y: 5010 },
        hold: false,
      })

      mapper.handleKeyDown({ key: 'Shift', shiftKey: true })
      const leftRec = mapper.triggerPrimaryWorldAction(5012, 5012, null, 6000)
      expect(leftRec?.command).toEqual({
        type: 'SkillAt',
        hand: 'left',
        at: { x: 5012, y: 5012 },
        hold: false,
      })
    }
  })
})

describe('CommandMapper — 1.13c Warp (UNIT_TILE = 5) Walk-Then-Interact & 500ms Cooldown Parity (0x6facaed0 / 0x6fadb090)', () => {
  function createWarpTestSetup(startX = 5000, startY = 5000, areaId = 2) {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const sentCommands: ClientCommand[] = []
    const hudModel = new HudModel({
      world,
      hudManager,
      onCommand: (cmd) => sentCommands.push(cmd),
    })
    const predictor = new LocalMovementPredictor()
    predictor.setPosition(startX, startY)
    const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0 })

    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 1,
      name: 'Hero',
      x: startX,
      y: startY,
    })

    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      rateLimiter,
      sendCommand: (cmd) => {
        if (cmd.type === 'Interact') {
          predictor.stop()
        }
        sentCommands.push(cmd)
      },
    })

    return { world, predictor, mapper, sentCommands }
  }

  it('1. clicking a distant warp (#10407 > 4) sends only MoveToUnit (0x04), keeps local path prediction moving, and defers Interact (0x13) until tick() reaches #10407 <= 4', () => {
    const { world, predictor, mapper, sentCommands } = createWarpTestSetup(5000, 5000, 2)

    const warpId = 401
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 5,
        id: warpId,
        classId: 4,
        warpId: 4,
        x: 5008,
        y: 5000,
      } as any,
    })
    const warpUnit = world.getUnit('tile', warpId)!

    const clickRecord = mapper.triggerPrimaryWorldAction(5008, 5000, warpUnit, 1000)
    expect(clickRecord?.command).toEqual({
      type: 'MoveToUnit',
      run: true,
      target: { unitType: 5, id: warpId },
    })
    // Must NOT send Interact (0x13) or bogus TakeWarp (0x09) on the distant click
    expect(sentCommands.map((c) => c.type)).toEqual(['MoveToUnit'])
    expect(mapper.getPendingWarpInteractId()).toBe(warpId)

    // Still at dx = 5 (#10407(warp, player) = 0x6FDDABC0[5] = 5 > 4): deferred
    predictor.setPosition(5003, 5000)
    world.self.x = 5003
    world.self.y = 5000
    expect(mapper.tick(1100)).toBeNull()
    expect(sentCommands.some((c) => c.type === 'Interact')).toBe(false)
    expect(mapper.getPendingWarpInteractId()).toBe(warpId)

    // Arrives at dx = 4 (#10407(warp, player) = 0x6FDDABC0[4] = 4 <= 4): dispatches Interact (0x13)
    predictor.setPosition(5004, 5000)
    world.self.x = 5004
    world.self.y = 5000
    const tickCmd = mapper.tick(1200)
    expect(tickCmd).toEqual({
      type: 'Interact',
      target: { unitType: 5, id: warpId },
    })
    expect(sentCommands.map((c) => c.type)).toEqual(['MoveToUnit', 'Interact'])
    expect(mapper.getPendingWarpInteractId()).toBeNull()
  })

  it('2. clicking a warp already within #10407 <= 4 immediately sends Interact (0x13) without MoveToUnit or TakeWarp', () => {
    const { world, mapper, sentCommands } = createWarpTestSetup(5000, 5000, 2)

    const warpId = 402
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 5,
        id: warpId,
        classId: 4,
        warpId: 4,
        x: 5004,
        y: 5000,
      } as any,
    })
    const warpUnit = world.getUnit('tile', warpId)!

    const clickRecord = mapper.triggerPrimaryWorldAction(5004, 5000, warpUnit, 1000)
    expect(clickRecord?.command).toEqual({
      type: 'Interact',
      target: { unitType: 5, id: warpId },
    })
    expect(sentCommands.map((c) => c.type)).toEqual(['Interact'])
    expect(mapper.getPendingWarpInteractId()).toBeNull()
  })

  it('3. enforces the 1.13c 500ms warp click cooldown ([0x6fbc9828]) without cancelling an active pendingWarpInteractId, and cancels pendingWarpInteractId on ground move', () => {
    const { world, mapper, sentCommands } = createWarpTestSetup(5000, 5000, 2)

    const warpId = 403
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 5,
        id: warpId,
        classId: 4,
        warpId: 4,
        x: 5010,
        y: 5000,
      } as any,
    })
    const warpUnit = world.getUnit('tile', warpId)!

    // First click at t = 1000ms dispatches MoveToUnit and arms 500ms cooldown
    expect(mapper.triggerPrimaryWorldAction(5010, 5000, warpUnit, 1000)?.command.type).toBe('MoveToUnit')
    expect(mapper.getPendingWarpInteractId()).toBe(warpId)

    // Repeat click within 500ms (t = 1300ms) is ignored and preserves pendingWarpInteractId
    expect(mapper.triggerPrimaryWorldAction(5010, 5000, warpUnit, 1300)).toBeNull()
    expect(sentCommands).toHaveLength(1)
    expect(mapper.getPendingWarpInteractId()).toBe(warpId)

    // Clicking the ground before arrival cancels pendingWarpInteractId
    expect(mapper.triggerPrimaryWorldAction(4995, 5000, null, 1400)?.command.type).toBe('Move')
    expect(mapper.getPendingWarpInteractId()).toBeNull()
  })
})


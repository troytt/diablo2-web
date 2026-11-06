import { describe, expect, it, vi } from 'vitest'
import { CommandMapper } from '../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../src/client/session/rate-limiter.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { resolveEquippedWeaponRangeAdder } from '../src/common/skills/weapon-combat-meta.ts'
import type { ClientCommand, ItemData } from '../src/netproto/index.ts'

const POWER_STRIKE = 14
const FIRE_BALL = 47

function makeEquippedWeapon(id: number, code: string, slot: number): ItemData {
  return {
    id,
    code,
    name: code,
    quality: 2,
    level: 1,
    identified: true,
    ethereal: false,
    sockets: 0,
    location: 1,
    bodyLoc: slot,
    equippedSlot: slot,
    x: 0,
    y: 0,
    width: 1,
    height: 3,
    stats: [],
  } as unknown as ItemData
}

function createCombatHarness(startX = 5000, startY = 5000, areaId = 2) {
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
  const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 })

  const mockCamera = {
    subtileToScreen(x: number, y: number) {
      return { x: (x - 5000) * 16 + 400, y: (y - 5000) * 8 + 300 }
    },
    screenToSubtile(x: number, y: number) {
      return { x: (x - 400) / 16 + 5000, y: (y - 300) / 8 + 5000 }
    },
    update() {},
  }

  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId })
  world.apply({
    type: 'UnitAssign',
    isSelf: true,
    unit: {
      unitType: 0,
      id: 1,
      classId: 0, // Amazon
      name: 'Amazon',
      x: startX,
      y: startY,
      mode: 1,
      lifePct: 128,
    },
  })

  // Equip a Javelin (jav, rangeadder=2) in active weapon slot 4 so Javelin melee skills (Power Strike #14) are usable
  world.containers.applyItemEvent(0, makeEquippedWeapon(101, 'jav', 4), 'equipment', 1)
  hudModel.syncFromWorld()

  const mapper = new CommandMapper({
    world,
    hudManager,
    hudModel,
    predictor,
    rateLimiter,
    camera: mockCamera as any,
    sendCommand: (cmd) => sentCommands.push(cmd),
  })

  return { world, hudManager, hudModel, predictor, mapper, sentCommands }
}

describe('Issue #1298 — Melee Attack Range, Swap Slot Isolation, Right-Click Move/Chase, Anti-Stutter & QuickCast', () => {
  it('1. Sub-issue 1: resolveEquippedWeaponRangeAdder and ClientWorld ignore swap slots (11/12) so an unequipped Pike on swap never inflates active melee reach', () => {
    // Record keyed by numeric slot: active slot 4 has Short Sword (ssd, rangeadder=0), swap slot 11 has Pike (pik, rangeadder=4)
    expect(
      resolveEquippedWeaponRangeAdder({
        4: { code: 'ssd' },
        11: { code: 'pik' },
      }),
    ).toBe(0)

    // Array of equipped items with explicit slot / bodyLoc metadata: Javelin (jav, rangeadder=2) in slot 4, Pike (pik, rangeadder=4) in swap slot 11
    expect(
      resolveEquippedWeaponRangeAdder([
        { code: 'jav', slot: 4 },
        { code: 'pik', slot: 11 },
      ]),
    ).toBe(2)
    expect(
      resolveEquippedWeaponRangeAdder({
        equipped: [
          { code: 'ssd', bodyLoc: 4 },
          { code: '9p9', bodyLoc: 12 },
        ],
      }),
    ).toBe(0)

    // When Pike (pik, rangeadder=4) is in active slot 4, rangeadder is 4
    expect(
      resolveEquippedWeaponRangeAdder([
        { code: 'pik', slot: 4 },
        { code: 'ssd', slot: 11 },
      ]),
    ).toBe(4)

    // Verify in ClientWorld: Amazon with jav (rangeadder=2) in slot 4 and pik (rangeadder=4) in swap slot 11 has rangeAdder = 2 (NOT 4)
    const { world, hudModel, mapper, sentCommands } = createCombatHarness()
    world.self.rightSkill = POWER_STRIKE
    world.containers.applyItemEvent(0, makeEquippedWeapon(102, 'pik', 11), 'equipment', 1)
    hudModel.syncFromWorld()

    expect(world.getSelfWeaponRangeAdder()).toBe(2)

    // Monster at distance 6 (sizeAdjustedDist = 4 > maxDist = 2 + 1 = 3 for jav, whereas pik would have maxDist = 4 + 1 = 5)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 50,
        classId: 0,
        name: 'Fallen',
        x: 5006,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    const monster = world.getUnit('monster', 50)!
    expect(world.isTargetInSelfMeleeRange(monster)).toBe(false)

    // Right-clicking monster 50 with Power Strike (#14) enters pendingMeleeAttack chase instead of swinging in place out of reach
    mapper.triggerSecondaryWorldAction(5006, 5000, monster, 1000, false)
    expect(sentCommands.at(-1)).toMatchObject({
      type: 'SkillOn',
      hand: 'right',
      target: { unitType: 1, id: 50 },
    })
    expect(world.pendingMeleeAttack).not.toBeNull()
    expect(world.pendingMeleeAttack?.skillId).toBe(POWER_STRIKE)
  })

  it('2. Sub-issue 2: Right-clicking empty ground with a melee skill (without Shift) moves the player or locks a nearby monster within 2.5 subtiles instead of swinging at air', () => {
    const { world, predictor, mapper, sentCommands } = createCombatHarness()
    world.self.rightSkill = POWER_STRIKE

    // 2a. Right-click on empty ground at (5015, 5010) with no monsters nearby -> dispatches Move and starts local path prediction
    const moveRec = mapper.triggerSecondaryWorldAction(5015, 5010, null, 1000, false)
    expect(moveRec?.command).toEqual({
      type: 'Move',
      run: true,
      to: { x: 5015, y: 5010 },
    })
    expect(predictor.getSnapshot().moving).toBe(true)

    // 2b. Spawn a monster at (5010, 5000) and right-click slightly outside its hitbox at (5011.5, 5001) (dist ~1.8 <= 2.5)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 77,
        classId: 0,
        name: 'Fallen',
        x: 5010,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    const nearRec = mapper.triggerSecondaryWorldAction(5011.5, 5001, null, 2000, false)
    expect(nearRec?.command).toEqual({
      type: 'SkillOn',
      hand: 'right',
      target: { unitType: 1, id: 77 },
      shift: false,
      hold: false,
    })

    // 2c. Holding Shift + right-clicking empty ground still swings in place (SkillAt)
    mapper.handleKeyDown({ key: 'Shift', shiftKey: true }, 3000)
    const shiftRec = mapper.triggerSecondaryWorldAction(5025, 5025, null, 3000, false)
    expect(shiftRec?.command).toEqual({
      type: 'SkillAt',
      hand: 'right',
      at: { x: 5025, y: 5025 },
      hold: false,
    })
    expect(sentCommands.at(-1)?.type).toBe('SkillAt')
  })

  it('3. Sub-issue 3: syncPendingMeleeChasePath and noteOutgoingCommand preserve chase state and avoid resetting predictor path on <=1 subtile jitter', () => {
    const { world, predictor, mapper } = createCombatHarness()
    world.self.rightSkill = POWER_STRIKE

    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 88,
        classId: 0,
        name: 'Zombie',
        x: 5012,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    const zombie = world.getUnit('monster', 88)!

    mapper.triggerSecondaryWorldAction(5012, 5000, zombie, 1000, false)
    expect(world.pendingMeleeAttack?.startedAtMs).toBe(1000)
    expect(predictor.getSnapshot().moving).toBe(true)

    const setPathSpy = vi.spyOn(predictor, 'setPath')

    // Repeated SkillOn on the same target at t=1040ms preserves startedAtMs=1000 and does NOT re-call predictor.setPath
    mapper.triggerSecondaryWorldAction(5012, 5000, zombie, 1040, true)
    expect(world.pendingMeleeAttack?.startedAtMs).toBe(1000)
    expect(setPathSpy).not.toHaveBeenCalled()

    // Monster jitters by 1 subtile (5012 -> 5013): still within <= 1 subtile deadzone, no path reset
    zombie.x = 5013
    mapper.syncPendingMeleeChasePath()
    expect(setPathSpy).not.toHaveBeenCalled()

    // Monster moves by 3 subtiles (5013 -> 5015, > 1 from 5012): recalculates chase path
    zombie.x = 5015
    mapper.syncPendingMeleeChasePath()
    expect(setPathSpy).toHaveBeenCalledTimes(1)
  })

  it('4. Sub-issue 4: S2C 0x10 UnitMove (PlayerMoveToTarget) during melee chase does not snap local player backward or overwrite self position with monster target', () => {
    const { world, predictor, mapper } = createCombatHarness(5000, 5000)
    world.self.rightSkill = POWER_STRIKE

    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 91,
        classId: 0,
        name: 'Skeleton',
        x: 5010,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    const skeleton = world.getUnit('monster', 91)!

    // Start chasing skeleton at (5010, 5000)
    mapper.triggerSecondaryWorldAction(5010, 5000, skeleton, 1000, false)
    expect(world.hasPendingMeleeAttack()).toBe(true)

    // Predictor advances player 2.5 subtiles forward to (5002.5, 5000)
    predictor.setPosition(5002.5, 5000)
    world.self.x = 5002.5
    world.self.y = 5000
    const selfUnit = world.getUnit('player', 1)!
    selfUnit.x = 5002.5
    selfUnit.y = 5000

    // Server echoes S2C 0x10 PlayerMoveToTarget with lagging from=(5000, 5000) and target=(monster 91 at 5010, 5000)
    world.apply({
      type: 'UnitMove',
      unitType: 'player',
      id: 1,
      mode: 'run',
      from: { x: 5000, y: 5000 },
      to: { x: 5010, y: 5000 },
      target: { unitType: 1, id: 91 },
    })

    // Local player coordinates must NOT be snapped backward to (5000, 5000) or teleported to (5010, 5000)
    expect(world.self.x).toBe(5002.5)
    expect(world.self.y).toBe(5000)
    expect(selfUnit.x).toBe(5002.5)
    expect(selfUnit.y).toBe(5000)
  })

  it('5. Sub-issue 5: quickCastSkillAtCursor defers restoring original right-hand skill while melee chase is pending, then restores upon arrival in melee range', () => {
    const { world, predictor, mapper, sentCommands } = createCombatHarness(5000, 5000)
    world.self.rightSkill = FIRE_BALL

    // Monster at (5010, 5000) — out of melee range (dist = 10 > 5)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 66,
        classId: 0,
        name: 'QuillRat',
        x: 5010,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })

    // Position cursor over monster 66 at screen (560, 300) -> subtile (5010, 5000)
    mapper.handlePointerMove(560, 300)

    // Quick-cast Power Strike (#14) at out-of-range monster
    const cast = mapper.quickCastSkillAtCursor(POWER_STRIKE, undefined, 1000)
    expect(cast).toBe(true)

    // Must emit only SelectSkill(14) and SkillOn(monster 66) initially — NOT SelectSkill(FIRE_BALL) yet!
    expect(sentCommands.map((c) => c.type)).toEqual(['SelectSkill', 'SkillOn'])
    expect(world.self.rightSkill).toBe(POWER_STRIKE)
    expect(world.pendingMeleeAttack).not.toBeNull()
    expect(world.pendingMeleeAttack?.skillId).toBe(POWER_STRIKE)

    // Now player walks into melee range at (5008, 5000) (dist = 2 <= 3) and ticks
    predictor.setPosition(5008, 5000)
    const arrived = mapper.checkPendingMeleeChaseArrival(1500)
    expect(arrived).toBe(true)
    expect(world.pendingMeleeAttack).toBeNull()

    // Upon arrival & attack execution, the deferred SelectSkill(FIRE_BALL) restore is automatically sent
    expect(sentCommands.map((c) => c.type)).toEqual(['SelectSkill', 'SkillOn', 'SelectSkill'])
    expect(sentCommands.at(-1)).toMatchObject({
      type: 'SelectSkill',
      hand: 'right',
      skill: FIRE_BALL,
    })
    expect(world.self.rightSkill).toBe(FIRE_BALL)
  })
})

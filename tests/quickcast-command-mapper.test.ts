/**
 * Quick Cast command tests (Issue #952):
 * 1. `CommandMapper.quickCastSkillAtCursor` emits the PD2 atomic sequence —
 *    `SelectSkill (0x3C)` → `SkillAt`/`SkillOn` → `SelectSkill` restore — without
 *    permanently changing the right-hand skill, gated by the vanilla town / cast-lock /
 *    cooldown / gold-dialog rules.
 * 2. `quickCastMode` reinterprets bound `F1..F8` presses as cast-at-cursor while the
 *    native popup-hover binding flow stays vanilla.
 */

import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../src/client/session/rate-limiter.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import type { ClientCommand } from '../src/netproto/index.ts'

const FROZEN_ORB = 59
const FIRE_BALL = 47

function createTestSetup(startX = 5000, startY = 5000, areaId = 2) {
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

  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId })
  world.apply({
    type: 'PlayerAssign',
    unitId: 1,
    classId: 1,
    name: 'Sorceress',
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

describe('CommandMapper — quickCastSkillAtCursor (Issue #952)', () => {
  it('1. different skill: emits SelectSkill(new) -> SkillAt -> SelectSkill(original) and restores the right-hand slot', () => {
    const { world, hudManager, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = FIRE_BALL
    hudManager.hotkeys.rightSkillId = FIRE_BALL

    const cast = mapper.quickCastSkillAtCursor(FROZEN_ORB, undefined, 2000)
    expect(cast).toBe(true)

    expect(sentCommands.map((c) => c.type)).toEqual(['SelectSkill', 'SkillAt', 'SelectSkill'])
    const [selectNew, castCmd, selectRestore] = sentCommands as Extract<
      ClientCommand,
      { type: 'SelectSkill' | 'SkillAt' }
    >[]
    expect(selectNew).toMatchObject({ type: 'SelectSkill', hand: 'right', skill: FROZEN_ORB })
    expect(castCmd).toMatchObject({ type: 'SkillAt', hand: 'right' })
    expect(selectRestore).toMatchObject({ type: 'SelectSkill', hand: 'right', skill: FIRE_BALL })

    // Optimistic mirror converges back to the original selection after the restore note.
    expect(world.self.rightSkill).toBe(FIRE_BALL)
  })

  it('2. already-selected skill: casts directly with no swap round-trip', () => {
    const { world, hudManager, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = FROZEN_ORB
    hudManager.hotkeys.rightSkillId = FROZEN_ORB

    const cast = mapper.quickCastSkillAtCursor(FROZEN_ORB, undefined, 2000)
    expect(cast).toBe(true)
    expect(sentCommands.map((c) => c.type)).toEqual(['SkillAt'])
    expect(world.self.rightSkill).toBe(FROZEN_ORB)
  })

  it('3. unknown original skill (0): selects and casts, skips the restore', () => {
    const { world, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = 0

    const cast = mapper.quickCastSkillAtCursor(FROZEN_ORB, undefined, 2000)
    expect(cast).toBe(true)
    expect(sentCommands.map((c) => c.type)).toEqual(['SelectSkill', 'SkillAt'])
    expect(world.self.rightSkill).toBe(FROZEN_ORB)
  })

  it('4. town area with a non-castable skill: emits no commands at all (no wasted swap)', () => {
    for (const townAreaId of [1, 40, 75, 103, 109]) {
      const { world, mapper, sentCommands } = createTestSetup(5000, 5000, townAreaId)
      world.self.rightSkill = 40
      const cast = mapper.quickCastSkillAtCursor(FROZEN_ORB, undefined, 2000)
      expect(cast).toBe(false)
      expect(sentCommands).toHaveLength(0)
    }
  })

  it('5. town area with a town-castable skill (Frozen Armor #40): still quick casts', () => {
    const { world, mapper, sentCommands } = createTestSetup(5000, 5000, 1)
    world.self.rightSkill = FIRE_BALL
    const cast = mapper.quickCastSkillAtCursor(40, undefined, 2000)
    expect(cast).toBe(true)
    expect(sentCommands.map((c) => c.type)).toEqual(['SelectSkill', 'SkillAt', 'SelectSkill'])
  })

  it('6. rejects invalid skill ids without side effects', () => {
    const { world, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = FIRE_BALL
    expect(mapper.quickCastSkillAtCursor(0, undefined, 2000)).toBe(false)
    expect(mapper.quickCastSkillAtCursor(-5, undefined, 2000)).toBe(false)
    expect(mapper.quickCastSkillAtCursor(59.5, undefined, 2000)).toBe(false)
    expect(sentCommands).toHaveLength(0)
    expect(world.self.rightSkill).toBe(FIRE_BALL)
  })

  it('7. gold dialog open: blocked without commands (dialog owns digits/Enter input)', () => {
    const { world, hudManager, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = FIRE_BALL
    hudManager.goldDialog = { mode: 2, amount: 0, fresh: true }
    try {
      expect(mapper.quickCastSkillAtCursor(FROZEN_ORB, undefined, 2000)).toBe(false)
      expect(sentCommands).toHaveLength(0)
    } finally {
      hudManager.goldDialog = null
    }
  })

  it('8. passes itemId through to the swap SelectSkill (item-granted skills)', () => {
    const { world, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = FIRE_BALL
    const cast = mapper.quickCastSkillAtCursor(FROZEN_ORB, { itemId: 12345 }, 2000)
    expect(cast).toBe(true)
    const first = sentCommands[0] as Extract<ClientCommand, { type: 'SelectSkill' }>
    expect(first.itemId).toBe(12345)
    const last = sentCommands[2] as Extract<ClientCommand, { type: 'SelectSkill' }>
    expect(last.itemId).toBe(0xffffffff)
  })

  it('9. quickCastMode ON: pressing a bound F1 casts at the cursor instead of selecting', () => {
    const { world, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = FIRE_BALL
    mapper.bindSkillHotkey('F1', { skillId: FROZEN_ORB, hand: 'right', itemId: 0xffffffff })
    mapper.quickCastMode = true

    const handled = mapper.handleKeyDown({ key: 'F1', preventDefault() {} }, 2000)
    expect(handled).toBe(true)
    expect(sentCommands.map((c) => c.type)).toEqual(['SelectSkill', 'SkillAt', 'SelectSkill'])
    expect(world.self.rightSkill).toBe(FIRE_BALL)
  })

  it('10. quickCastMode OFF (vanilla): pressing a bound F1 only selects the skill', () => {
    const { world, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = FIRE_BALL
    mapper.bindSkillHotkey('F1', { skillId: FROZEN_ORB, hand: 'right', itemId: 0xffffffff })

    const handled = mapper.handleKeyDown({ key: 'F1', preventDefault() {} }, 2000)
    expect(handled).toBe(true)
    expect(sentCommands.map((c) => c.type)).toEqual(['SelectSkill'])
    // Vanilla path defers the slot change to the 0x23 ack (no optimistic mirror).
  })

  it('11. quickCastMode ON: skill popup hover + F1 still binds natively without casting', () => {
    const { hudManager, mapper, sentCommands } = createTestSetup()
    mapper.quickCastMode = true
    hudManager.hotkeys.openPopup = 'right'
    hudManager.hotkeys.hoveredPopupSkill = { side: 'right', skillId: 64 }

    const handled = mapper.handleKeyDown({ key: 'F3', preventDefault() {} }, 2000)
    expect(handled).toBe(true)
    expect(sentCommands.filter((c) => c.type !== 'AssignSkillHotkey')).toHaveLength(0)
    expect(hudManager.hotkeys.bindings.get('F3')).toMatchObject({
      side: 'right',
      skillId: 64,
    })
  })

  it('12. quickCastMode ON: unbound F-key is a no-op', () => {
    const { mapper, sentCommands } = createTestSetup()
    mapper.quickCastMode = true
    const handled = mapper.handleKeyDown({ key: 'F8', preventDefault() {} }, 2000)
    expect(handled).toBe(true)
    expect(sentCommands).toHaveLength(0)
  })

  it('13. execution follows the binding maps, not the bindable-key regex: a non-F1..F8 bound key quick casts', () => {
    const { world, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = FIRE_BALL
    // Bind a key outside the vanilla F1..F8 gate — e.g. by a future binding-flow extension.
    mapper.bindSkillHotkey('G', { skillId: FROZEN_ORB, hand: 'right', itemId: 0xffffffff })
    mapper.quickCastMode = true

    expect(mapper.handleKeyDown({ key: 'g', preventDefault() {} }, 2000)).toBe(true)
    expect(sentCommands.map((c) => c.type)).toEqual(['SelectSkill', 'SkillAt', 'SelectSkill'])
    expect(world.self.rightSkill).toBe(FIRE_BALL)

    // Without a binding the same key falls through to normal hotkeys (nothing cast).
    sentCommands.length = 0
    expect(mapper.handleKeyDown({ key: 'j', preventDefault() {} }, 2000)).toBe(false)
    expect(sentCommands).toHaveLength(0)
  })
})

import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { ClientUnit } from '../../src/client/world/client-unit.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'
import { encodeD2gsClientCommand } from '../../src/netproto/d2gs/registry.ts'
import {
  clickGate113c,
  busyGate113c,
  skillHasTargetItem113c,
  skillHasTargetCorpse113c,
} from '../../src/client/input/click-rules-113c.ts'
import { C2sIdenticalPacketDedupe113c } from '../../src/client/session/c2s-identical-dedupe-113c.js'

function opcodeOf(cmd: ClientCommand | null | undefined): number {
  if (!cmd) throw new Error('Expected ClientCommand')
  return encodeD2gsClientCommand(cmd)[0]![0]!
}

function createHarness() {
  const world = new ClientWorld()
  const hudManager = new HudManager()
  const sent: ClientCommand[] = []
  const hudModel = new HudModel({
    world,
    hudManager,
    onCommand: (cmd) => sent.push(cmd),
  })
  hudManager.commandSink = hudModel

  const mockCamera = {
    subtileToScreen(x: number, y: number) {
      return { x: (x - 5000) * 16 + 400, y: (y - 5000) * 8 + 300 }
    },
    screenToSubtile(x: number, y: number) {
      return { x: (x - 400) / 16 + 5000, y: (y - 300) / 8 + 5000 }
    },
    update() {},
  }

  const mapper = new CommandMapper({
    world,
    hudManager,
    hudModel,
    camera: mockCamera as any,
    sendCommand: (cmd) => sent.push(cmd),
  })

  // Blood Moor (areaId = 2, outside town)
  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 2 })
  world.apply({
    type: 'UnitAssign',
    isSelf: true,
    unit: {
      unitType: 0,
      id: 1,
      classId: 1,
      name: 'Hero',
      x: 5000,
      y: 5000,
      mode: 1,
      lifePct: 128,
    },
  })

  return { world, hudManager, hudModel, mapper, sent }
}

describe('1.13c Press-Time Target Lock, C2S Hold Opcodes (0x05-0x11), and Hover Pick Parity', () => {
  it('1. Press left-click on moving monster locks target unit: hold tick keeps sending SkillOn (0x09) for the SAME monster after it walks away from the stationary cursor', () => {
    const { world, mapper, sent } = createHarness()
    world.self.leftSkill = 0

    // Monster 42 starts at (5005, 5000) -> screen (480, 300)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 42,
        classId: 0,
        name: 'Fallen',
        x: 5005,
        y: 5000,
        mode: 2,
        lifePct: 128,
      },
    })
    // Decoy monster 99 starts far away at (5020, 5020)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 99,
        classId: 0,
        name: 'Decoy',
        x: 5020,
        y: 5020,
        mode: 1,
        lifePct: 128,
      },
    })

    // Press left mouse button on monster 42 at screen (480, 300) -> subtile (5005, 5000)
    mapper.handlePointerDown(480, 300, 0, 1000)
    expect(sent.at(-1)).toEqual({
      type: 'SkillOn',
      hand: 'left',
      target: { unitType: 1, id: 42 },
      shift: false,
      hold: false,
    })
    expect(opcodeOf(sent.at(-1))).toBe(0x06)

    // Monster 42 now walks away from the stationary cursor (480, 300) to (5015, 4992),
    // while decoy monster 99 walks directly under the stationary cursor at (5005, 5000)!
    const monster42 = world.getUnit('monster', 42)!
    monster42.x = 5015
    monster42.y = 4992
    const decoy99 = world.getUnit('monster', 99)!
    decoy99.x = 5005
    decoy99.y = 5000

    // Player finishes step/swing and is in neutral mode 1 (ClickGate 0x6fac85e0 allows unit-hold repeat)
    world.getUnit('player', 1)!.mode = 1
    const holdCmd = mapper.tick(2000)
    expect(holdCmd).toEqual({
      type: 'SkillOn',
      hand: 'left',
      target: { unitType: 1, id: 42 }, // Still locked onto monster 42, NOT decoy 99 or ground!
      shift: false,
      hold: true,
    })
    expect(opcodeOf(holdCmd)).toBe(0x09)
  })

  it('2. Locked monster dies (without TargetCorpse skill): hold tick drops unit lock without re-picking another monster until pointer-up', () => {
    const { world, mapper, sent } = createHarness()
    world.self.leftSkill = 0

    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 42,
        classId: 0,
        name: 'Fallen',
        x: 5005,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })

    mapper.handlePointerDown(480, 300, 0, 1000)
    expect(sent.at(-1)).toMatchObject({
      type: 'SkillOn',
      target: { unitType: 1, id: 42 },
      hold: false,
    })

    // Monster 42 dies (mode 12 = DD, lifePct = 0) and another monster 77 spawns right at (5005, 5000)
    const monster42 = world.getUnit('monster', 42)!
    monster42.mode = 12
    monster42.lifePct = 0
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 77,
        classId: 0,
        name: 'OtherFallen',
        x: 5005,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })

    const holdCmd = mapper.tick(2000)
    // Must NOT re-pick monster 77 while selectionLocked is active; falls back to ground Move
    expect(holdCmd?.type).toBe('Move')

    // Only after releasing and pressing again does it pick monster 77
    mapper.handlePointerUp(0)
    mapper.handlePointerDown(480, 300, 0, 2500)
    expect(sent.at(-1)).toMatchObject({
      type: 'SkillOn',
      target: { unitType: 1, id: 77 },
      hold: false,
    })
  })

  it('3. Press on empty ground -> monster later walks under held cursor -> hold tick NEVER switches to SkillOn on the monster', () => {
    const { world, mapper, sent } = createHarness()
    world.self.leftSkill = 0

    // Press left mouse on empty ground at screen (480, 300) -> subtile (5005, 5000)
    mapper.handlePointerDown(480, 300, 0, 1000)
    expect(sent.at(-1)?.type).toBe('Move')

    // Now a monster walks right under the held cursor at (5005, 5000)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 55,
        classId: 0,
        name: 'PassingFallen',
        x: 5005,
        y: 5000,
        mode: 2,
        lifePct: 128,
      },
    })

    const holdCmd = mapper.tick(2000)
    expect(holdCmd?.type).toBe('Move')
  })

  it('4. Emits exact 1.13c press vs hold C2S opcodes (0x05-0x11) across left/right hand, shift, and unit/location', () => {
    const { world, mapper, sent } = createHarness()
    world.self.leftSkill = 0
    world.self.rightSkill = 47 // Fire Ball

    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 42,
        classId: 0,
        name: 'Fallen',
        x: 5005,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    const monster42 = world.getUnit('monster', 42)!

    // Right-click press on monster (0x0D) -> hold tick (0x10)
    mapper.handlePointerDown(480, 300, 2, 1000)
    expect(sent.at(-1)).toEqual({
      type: 'SkillOn',
      hand: 'right',
      target: { unitType: 1, id: 42 },
      shift: false,
      hold: false,
    })
    expect(opcodeOf(sent.at(-1))).toBe(0x0d)

    monster42.x = 5012
    monster42.y = 4996
    const rightHoldCmd = mapper.tick(2000)
    expect(rightHoldCmd).toEqual({
      type: 'SkillOn',
      hand: 'right',
      target: { unitType: 1, id: 42 },
      shift: false,
      hold: true,
    })
    expect(opcodeOf(rightHoldCmd)).toBe(0x10)
    mapper.handlePointerUp(2)

    // Shift + Right-click press on monster (0x0E) -> hold tick (0x11)
    monster42.x = 5005
    monster42.y = 5000
    mapper.handleKeyDown({ key: 'Shift', shiftKey: true }, 3000)
    mapper.handlePointerDown(480, 300, 2, 3000)
    expect(opcodeOf(sent.at(-1))).toBe(0x0e)
    const shiftRightHoldCmd = mapper.tick(4000)
    expect(opcodeOf(shiftRightHoldCmd)).toBe(0x11)
    mapper.handlePointerUp(2)

    // Shift + Left-click press on monster (0x07) -> hold tick (0x0A)
    mapper.handlePointerDown(480, 300, 0, 5000)
    expect(opcodeOf(sent.at(-1))).toBe(0x07)
    const shiftLeftHoldCmd = mapper.tick(6000)
    expect(opcodeOf(shiftLeftHoldCmd)).toBe(0x0a)
    mapper.handlePointerUp(0)

    // Shift + Left-click on empty ground (0x05) -> hold tick (0x08)
    world.apply({ type: 'UnitRemove', unitType: 1, id: 42 })
    mapper.handlePointerDown(480, 300, 0, 7000)
    expect(sent.at(-1)).toMatchObject({ type: 'SkillAt', hand: 'left', hold: false })
    expect(opcodeOf(sent.at(-1))).toBe(0x05)
    const shiftLeftLocHold = mapper.tick(8000)
    expect(shiftLeftLocHold).toMatchObject({ type: 'SkillAt', hand: 'left', hold: true })
    expect(opcodeOf(shiftLeftLocHold)).toBe(0x08)
    mapper.handlePointerUp(0)
    mapper.handleKeyUp({ key: 'Shift', shiftKey: false })

    // Right-click on empty ground (0x0C) -> hold tick (0x0F)
    mapper.handlePointerDown(480, 300, 2, 9000)
    expect(sent.at(-1)).toMatchObject({ type: 'SkillAt', hand: 'right', hold: false })
    expect(opcodeOf(sent.at(-1))).toBe(0x0c)
    const rightLocHold = mapper.tick(10000)
    expect(rightLocHold).toMatchObject({ type: 'SkillAt', hand: 'right', hold: true })
    expect(opcodeOf(rightLocHold)).toBe(0x0f)
    mapper.handlePointerUp(2)
  })

  it('5. ClickGate (0x6fac85e0): unit-hold repeat is suppressed while local player is walking/running (modes 2, 3, 6)', () => {
    const { world, mapper, sent } = createHarness()
    world.self.leftSkill = 0

    expect(clickGate113c({ phase: 'hold', pressKind: 2, targetType: 'monster', selfMode: 2 }).pass).toBe(false)
    expect(clickGate113c({ phase: 'hold', pressKind: 2, targetType: 'monster', selfMode: 3 }).pass).toBe(false)
    expect(clickGate113c({ phase: 'hold', pressKind: 2, targetType: 'monster', selfMode: 6 }).pass).toBe(false)
    expect(clickGate113c({ phase: 'hold', pressKind: 2, targetType: 'monster', selfMode: 1 }).pass).toBe(true)
    expect(clickGate113c({ phase: 'hold', pressKind: 2, targetType: 'object', selfMode: 1 }).pass).toBe(false)

    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 42,
        classId: 0,
        name: 'Fallen',
        x: 5005,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })

    mapper.handlePointerDown(480, 300, 0, 1000)
    const countAfterPress = sent.length

    // Local player is walking toward the monster (mode 2 = WL)
    const selfUnit = world.getUnit('player', 1)!
    selfUnit.mode = 2
    expect(mapper.tick(2000)).toBeNull()
    expect(sent.length).toBe(countAfterPress) // Suppressed while walking!

    // Local player reaches monster and returns to neutral (mode 1 = NU)
    selfUnit.mode = 1
    const holdCmd = mapper.tick(3000)
    expect(holdCmd).toMatchObject({
      type: 'SkillOn',
      target: { unitType: 1, id: 42 },
      hold: true,
    })
  })

  it('6. Right-click on object/item checks Skills.txt TargetItem (0x6facbfb3): Fire Ball (#47) emits SkillAt (0x0C), Telekinesis (#43) emits SkillOn (0x0D)', () => {
    const { world, mapper, sent } = createHarness()

    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 300,
        classId: 5,
        name: 'Chest',
        x: 5005,
        y: 5000,
        mode: 0,
        lifePct: 128,
      },
    })

    expect(skillHasTargetItem113c(47)).toBe(false) // Fire Ball
    expect(skillHasTargetItem113c(43)).toBe(true) // Telekinesis

    // Right-click chest with Fire Ball (#47) -> SkillAt (0x0C) at chest coords
    world.self.rightSkill = 47
    mapper.handlePointerDown(480, 300, 2, 1000)
    expect(sent.at(-1)).toEqual({
      type: 'SkillAt',
      hand: 'right',
      at: { x: 5005, y: 5000 },
      hold: false,
    })
    mapper.handlePointerUp(2)

    // Right-click chest with Telekinesis (#43) -> SkillOn (0x0D) on object:300
    world.self.rightSkill = 43
    mapper.handlePointerDown(480, 300, 2, 2000)
    expect(sent.at(-1)).toEqual({
      type: 'SkillOn',
      hand: 'right',
      target: { unitType: 2, id: 300 },
      shift: false,
      hold: false,
    })
    mapper.handlePointerUp(2)
  })

  it('7. Hover pick (0x6fb01e80 & 0x6fb568e0): skips monster state 0x8F, breaks overlapping ties by distance to LOCAL PLAYER, and uses MonStats2 noGfxHitTest boxes', () => {
    const { world, mapper } = createHarness()
    world.self.leftSkill = 0

    // Monster A with state 0x8F (143) must be skipped by hover pick
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 10,
        classId: 0,
        name: 'HiddenMonster',
        x: 5005,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    const hiddenMonster = world.getUnit('monster', 10)!
    hiddenMonster.states.add(0x8f)

    expect(mapper.findUnitAtScreenPoint(480, 300)).toBeNull()
    expect(mapper.pickUnitAtSubtile(5005, 5000)).toBeNull()
    world.apply({ type: 'UnitRemove', unitType: 1, id: 10 })

    // Two overlapping monsters whose hitboxes both cover cursor (480, 300) -> subtile (5005, 5000):
    // Monster 20 is closer to local player (5000, 5000) at (5004.6, 5000)
    // Monster 21 is closer to cursor (5005, 5000) at (5005.0, 5000)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 21,
        classId: 0,
        name: 'CloserToCursor',
        x: 5005.0,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 20,
        classId: 0,
        name: 'CloserToPlayer',
        x: 5004.6,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })

    expect(mapper.findUnitAtScreenPoint(480, 300)?.id).toBe(20)
    expect(mapper.resolvePointerTarget(480, 300).hoveredUnit?.id).toBe(20)

    // MonStats2 noGfxHitTest monster classId 497 (Catapult) uses exact table hitbox
    const catapult = new ClientUnit({
      unitType: 'monster',
      id: 88,
      classId: 497,
      name: 'Catapult',
      x: 5005,
      y: 5000,
      mode: 1,
      lifePct: 128,
    })
    expect(catapult.getHitBox()).toEqual({ left: -80, top: -70, width: 130, height: 110 })

    // BusyGate (0x6fad9f30): skill #0 (Attack, interrupt=1) passes even in mode 10; skill #10 (Jab, interrupt=0) blocks in mode 10
    expect(busyGate113c({ usedSkillId: 10, selfMode: 10 })).toBe(false)
    expect(busyGate113c({ usedSkillId: 10, selfMode: 1 })).toBe(true)
    expect(busyGate113c({ usedSkillId: 0, selfMode: 10 })).toBe(true)
    expect(skillHasTargetCorpse113c(74)).toBe(true) // Corpse Explosion

    // C2S identical packet dedupe (0x6fac4415..0x6fac4460): 50ms for 0x09, 200ms for 0x01
    const dedupe = new C2sIdenticalPacketDedupe113c()
    const pktHold = new Uint8Array([0x09, 0x01, 0, 0, 0, 0x2a, 0, 0, 0])
    expect(dedupe.admitPacket(pktHold, 1000)).toBe(true)
    expect(dedupe.admitPacket(pktHold, 1049)).toBe(false) // Within 50ms
    expect(dedupe.admitPacket(pktHold, 1050)).toBe(true) // >= 50ms
  })
})

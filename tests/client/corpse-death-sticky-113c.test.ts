import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'
import { decodeD2gsS2cPacket, encodeD2gsClientCommand } from '../../src/netproto/d2gs/registry.ts'
import { UNITFLAG_ISDEAD } from '../../src/common/path/index.ts'

const u32 = (v: number): number[] => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]
const u16 = (v: number): number[] => [v & 255, (v >>> 8) & 255]

const pkt0C = (unitType: number, id: number, hitClass: number, life: number): Uint8Array =>
  new Uint8Array([0x0c, unitType, ...u32(id), ...u16(hitClass), life & 255])

const pkt67 = (id: number, moveType: number, x: number, y: number): Uint8Array =>
  new Uint8Array([0x67, ...u32(id), moveType, ...u16(x), ...u16(y), 0, 0, 0, 0, 0, 0])

const pkt69 = (id: number, cmd: number, x: number, y: number, lifeOrParam = 0, param2 = 0): Uint8Array =>
  new Uint8Array([0x69, ...u32(id), cmd, ...u16(x), ...u16(y), lifeOrParam & 255, param2 & 255])

const pkt6C = (id: number, targetType: number, targetId: number, x: number, y: number): Uint8Array =>
  new Uint8Array([0x6c, ...u32(id), 0x10, 0x00, ...u32(targetId), targetType, ...u16(x), ...u16(y)])

const pkt6D = (id: number, x: number, y: number, life: number): Uint8Array =>
  new Uint8Array([0x6d, ...u32(id), ...u16(x), ...u16(y), life & 255])

function opcodeOf(cmd: ClientCommand | null | undefined): number {
  if (!cmd) throw new Error('Expected ClientCommand')
  return encodeD2gsClientCommand(cmd).at(-1)![0]!
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

describe('Sticky Monster Death & Explicit Resurrection Parity (D2Client 0x6FB55440 / 0x6FB01AE0 / 0x6FAFDC70)', () => {
  it('1. Same-frame post-death S2C 0x0C (life=0x80), 0x69 cmd 0x06, 0x67, 0x6C, and 0x6D never clear monster death state', () => {
    const { world, mapper, sent } = createHarness()
    world.self.leftSkill = 0 // Normal Attack (non-corpse)
    world.self.rightSkill = 47 // Fire Ball (non-corpse)

    world.apply(
      {
        type: 'UnitAssign',
        unit: {
          unitType: 1,
          id: 14,
          classId: 19, // Fallen
          name: 'Fallen',
          x: 5005,
          y: 5000,
          mode: 1,
          lifePct: 128,
        },
      },
      100,
    )

    // Server sends S2C 0x69 cmd=0x08 (MONMODE_DEATH)
    world.apply(decodeD2gsS2cPacket(pkt69(14, 0x08, 5005, 5000, 0x28, 0x03)), 140)
    const mon = world.getUnit('monster', 14)!
    expect(mon.dead).toBe(true)
    expect(mon.mode).toBe(0)
    expect(mon.lifePct).toBe(0)
    expect((world.npcMotion.getUnit(14)!.dwFlags & UNITFLAG_ISDEAD) !== 0).toBe(true)

    // Same-frame trailing S2C 0x0C (NPCGetHit) with pkt[8] = 0x80 (curHp == 0 -> 0x00 | 0x80)
    const decoded0C = decodeD2gsS2cPacket(pkt0C(1, 14, 0x0028, 0x80))
    expect((decoded0C as any).lifePct).toBe(0)
    world.apply(decoded0C, 141)
    expect(mon.dead).toBe(true)
    expect(mon.mode).toBe(0)
    expect(mon.lifePct).toBe(0)

    // Trailing S2C 0x0C with non-zero life byte, 0x69 cmd=0x06 (GH), 0x67 (walk), 0x6C (A2), 0x6D (stop while in DT)
    const decoded69Cmd06 = decodeD2gsS2cPacket(pkt69(14, 0x06, 5005, 5000, 0x80, 0x28))
    expect((decoded69Cmd06 as any).lifePct).toBeUndefined()
    world.apply(decodeD2gsS2cPacket(pkt0C(1, 14, 0x0028, 0x40)), 142)
    world.apply(decoded69Cmd06, 143)
    world.apply(decodeD2gsS2cPacket(pkt67(14, 0x01, 5006, 5000)), 144)
    world.apply(decodeD2gsS2cPacket(pkt6C(14, 0, 1, 5005, 5000)), 145)
    world.apply(decodeD2gsS2cPacket(pkt6D(14, 5005, 5000, 0x80)), 146)

    // Advance 30 client frames: monster must remain dead (never transition from GH -> NU)
    for (let i = 0; i < 30; i++) {
      world.npcMotion.tick()
    }
    expect(mon.dead).toBe(true)
    expect(mon.lifePct).toBe(0)
    expect((world.npcMotion.getUnit(14)!.dwFlags & UNITFLAG_ISDEAD) !== 0).toBe(true)

    // Server sends S2C 0x69 cmd=0x09 (MONMODE_DEAD settled corpse)
    world.apply(decodeD2gsS2cPacket(pkt69(14, 0x09, 5005, 5000, 0x28, 0x00)), 500)
    expect(mon.dead).toBe(true)
    expect(mon.mode).toBe(12)
    expect(mon.lifePct).toBe(0)

    // Bare left-click and right-click on the corpse at screen (480, 300) -> subtile (5005, 5000)
    // must NOT emit SkillOn (0x06 / 0x0D) targeting the dead monster; even after moving the mouse away and back
    mapper.handlePointerMove(420, 300)
    mapper.handlePointerMove(480, 300)
    mapper.handlePointerDown(480, 300, 0, 1000)
    mapper.handlePointerUp(0)
    expect(sent.at(-1)?.type).not.toBe('SkillOn')
    expect(opcodeOf(sent.at(-1))).toBe(0x03) // Move (Run to ground coords)

    mapper.handlePointerMove(420, 300)
    mapper.handlePointerMove(480, 300)
    mapper.handlePointerDown(480, 300, 2, 2000)
    mapper.handlePointerUp(2)
    expect(sent.at(-1)).toEqual({
      type: 'SkillAt',
      hand: 'right',
      at: { x: 5005, y: 5000 },
      hold: false,
    })
    expect(opcodeOf(sent.at(-1))).toBe(0x0c)
  })

  it('2. Explicit resurrection (SKILLS_SrvDo097_Resurrect on settled DD corpse or STATE_REVIVE 96) revives the monster and restores targeting', () => {
    const { world, mapper, sent } = createHarness()
    world.self.leftSkill = 0

    world.apply(
      {
        type: 'UnitAssign',
        unit: {
          unitType: 1,
          id: 21,
          classId: 19, // Fallen
          name: 'Fallen',
          x: 5005,
          y: 5000,
          mode: 1,
          lifePct: 128,
        },
      },
      0,
    )
    world.apply(decodeD2gsS2cPacket(pkt69(21, 0x08, 5005, 5000, 0x28, 0x03)), 40)
    world.apply(decodeD2gsS2cPacket(pkt69(21, 0x09, 5005, 5000, 0x28, 0x00)), 200)
    const mon = world.getUnit('monster', 21)!
    expect(mon.dead).toBe(true)
    expect(mon.mode).toBe(12)

    // Fallen Shaman resurrects the settled corpse (mode 12 -> cmd 0x15 / mode 14 SQ or cmd 0x07 / mode 1 NU)
    world.apply(decodeD2gsS2cPacket(pkt69(21, 0x07, 5005, 5000, 0x80, 0x00)), 600)
    expect(mon.dead).toBe(false)
    expect(mon.mode).toBe(1)
    expect(mon.lifePct).toBe(128)
    expect((world.npcMotion.getUnit(21)!.dwFlags & UNITFLAG_ISDEAD) === 0).toBe(true)

    // Bare left-click on the resurrected Fallen now targets it with SkillOn (0x06)
    mapper.handlePointerMove(480, 300)
    mapper.handlePointerDown(480, 300, 0, 1000)
    mapper.handlePointerUp(0)
    expect(sent.at(-1)).toEqual({
      type: 'SkillOn',
      hand: 'left',
      target: { unitType: 1, id: 21 },
      shift: false,
      hold: false,
    })

    // Kill it again -> settle to mode 12 -> revive via STATE_REVIVE (96)
    world.apply(decodeD2gsS2cPacket(pkt69(21, 0x08, 5005, 5000, 0x28, 0x03)), 1200)
    world.apply(decodeD2gsS2cPacket(pkt69(21, 0x09, 5005, 5000, 0x28, 0x00)), 1400)
    expect(mon.dead).toBe(true)

    world.apply(
      {
        type: 'StateSet',
        unit: { unitType: 1, id: 21 },
        state: 96,
      } as never,
      1600,
    )
    expect(mon.dead).toBe(false)
    expect(mon.mode).toBe(1)
    expect(mon.lifePct).toBe(128)
    expect((world.npcMotion.getUnit(21)!.dwFlags & UNITFLAG_ISDEAD) === 0).toBe(true)
  })
})

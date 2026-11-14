import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

// D2Client.dll 0x6fb5f0f0 / 0x6fb5f090: 0x99/0x9A call the skill do-function (0x6fb79030) directly, while
// 0x4C/0x4D queue unit command 0x16/0x15 (0x6fada750) that switches the caster into its cast mode.
const p4c = (op: number) =>
  new Uint8Array([op, 0x01, 0x2a, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x05, 0x01, 0x2b, 0x00, 0x00, 0x00, 0x00, 0x00])

describe('S2C 0x99/0x9A triggered skills do not enter a cast mode', () => {
  function world(): ClientWorld {
    const w = new ClientWorld()
    w.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 42, classId: 5, x: 5000, y: 5000, lifePct: 128, mode: 1 } })
    w.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 43, classId: 5, x: 5004, y: 5000, lifePct: 128, mode: 1 } })
    return w
  }

  it('0x99 keeps the caster mode and castState', () => {
    const w = world()
    const ev = decodeD2gsS2cPacket(p4c(0x99))
    expect(ev).toMatchObject({ type: 'SkillCast', triggered: true })
    w.apply(ev)
    const caster = w.getUnit('monster', 42)!
    expect(caster.mode).toBe(1)
    expect(caster.castState).toBeUndefined()
  })

  it('0x4C still enters the cast mode', () => {
    const w = world()
    w.apply(decodeD2gsS2cPacket(p4c(0x4c)))
    expect(w.getUnit('monster', 42)!.castState?.skillId).toBe(44)
  })

  it('0x9A with a zero coordinate does nothing', () => {
    const w = world()
    const pkt = new Uint8Array([0x9a, 0x01, 0x2a, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x05, 0x10, 0x27, 0x00, 0x00, 0x00, 0x00])
    w.apply(decodeD2gsS2cPacket(pkt))
    expect(w.getUnit('monster', 42)!.castState).toBeUndefined()
  })
})

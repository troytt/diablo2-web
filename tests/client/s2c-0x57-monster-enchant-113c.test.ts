import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

// D2Client.dll 0x6fb5d560 (S2C 0x57): id @1, type @5 (must be 1), nameSeed @6, bossMods @8..@10, champion @12.
describe('S2C 0x57 MonsterEnchant', () => {
  const pkt = (type: number, champion: number) =>
    new Uint8Array([0x57, 0x09, 0x00, 0x00, 0x00, type, 0x34, 0x12, 0x05, 0x11, 0x00, 0x00, champion, 0x00])

  it('rewrites nameSeed, bossMods and the unique/champion flags of the monster', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 9, classId: 5, x: 5000, y: 5000, lifePct: 128 } })
    world.apply(decodeD2gsS2cPacket(pkt(1, 1)))
    const u = world.getUnit('monster', 9)!
    expect(u.nameSeed).toBe(0x1234)
    expect(u.bossMods).toEqual([5, 0x11])
    expect(u.isUnique).toBe(true)
    expect(u.isChampion).toBe(true)
  })

  it('ignores a non-monster type byte', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 9, classId: 5, x: 5000, y: 5000, lifePct: 128 } })
    world.apply(decodeD2gsS2cPacket(pkt(2, 0)))
    expect(world.getUnit('monster', 9)!.nameSeed).toBeUndefined()
  })
})

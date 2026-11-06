import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

describe('S2C 0x40 / 0x5F / 0x62 are applied (1.13c)', () => {
  it('0x40 decodes item id / flag / enabled (D2Client.dll 0x6fb321b0)', () => {
    const ev = decodeD2gsS2cPacket(
      new Uint8Array([0x40, 0x11, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]),
    )
    expect(ev).toEqual({ type: 'ItemFlagUpdate', ownerType: 4, ownerId: 0, itemId: 0x11, flag: 0x100, enabled: 1, direct: true })
  })

  it('0x5F stores pPlayerData+0x2C (D2Common #10073)', () => {
    const world = new ClientWorld()
    world.apply(decodeD2gsS2cPacket(new Uint8Array([0x5f, 0x78, 0x56, 0x34, 0x12])))
    expect((world.self as { playerData2C?: number }).playerData2C).toBe(0x12345678)
  })

  it('0x62 type 1 ends the NPC interaction (D2Client.dll 0x6faf9370)', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 50, classId: 148, x: 5010, y: 5010, lifePct: 128 } })
    world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: 50 } })
    expect(world.npcInteraction.npcId).toBe(50)
    world.apply(decodeD2gsS2cPacket(new Uint8Array([0x62, 0x01, 0x32, 0x00, 0x00, 0x00, 0x00])))
    expect(world.npcInteraction.npcId).toBeNull()
  })
})

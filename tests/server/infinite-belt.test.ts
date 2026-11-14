import { describe, it, expect } from 'vitest'
import * as Server from '../../src/server/index.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import * as Netproto from '../../src/netproto/index.ts'

function createD2gsClientRig(
  host: Server.MultiClientRoomHost,
  opts: {
    readonly charName?: string
    readonly classId: Netproto.CharClassId
    readonly level?: number
    readonly areaId?: number
    readonly x?: number
    readonly y?: number
    readonly d2s?: Uint8Array
    readonly tap?: Netproto.InMemoryPacketTap
  },
) {
  const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
  const rawS2cPackets: Uint8Array[] = []
  const s2cFramer = new Netproto.D2gsS2cFramer()

  const tappedStream: Netproto.ByteStream = {
    label: clientStream.label,
    write(chunk: Uint8Array): void {
      opts.tap?.record({
        t: 0,
        conn: 'game',
        dir: 'c2s',
        raw: new Uint8Array(chunk),
        isRawStreamChunk: true,
      })
      clientStream.write(chunk)
    },
    onData(cb: (chunk: Uint8Array) => void): () => void {
      return clientStream.onData((chunk) => {
        opts.tap?.record({
          t: 0,
          conn: 'game',
          dir: 's2c',
          raw: new Uint8Array(chunk),
          isRawStreamChunk: true,
        })
        for (const frame of s2cFramer.push(chunk)) {
          rawS2cPackets.push(new Uint8Array(frame.bytes))
        }
        cb(chunk)
      })
    },
    onClose: (cb) => clientStream.onClose(cb),
    close: (reason) => clientStream.close(reason),
  }

  const roomSession = host.attachClient(serverStream, {
    charName: opts.charName ?? 'TestChar',
    classId: opts.classId,
    level: opts.level ?? 30,
    areaId: opts.areaId ?? 1,
    x: opts.x ?? 100,
    y: opts.y ?? 100,
    d2s: opts.d2s,
    protocol: 'd2gs',
  })

  const adapter = new Netproto.D2gsAdapter(tappedStream, {
    charName: opts.charName ?? 'TestChar',
    classId: opts.classId,
  })
  const world = new ClientWorld()
  const events: Netproto.ServerEvent[] = []
  adapter.onEvent((ev) => {
    events.push(ev)
    world.apply(ev)
  })
  host.stepFrame()

  return {
    roomSession,
    playerUnitId: roomSession.playerUnitId,
    adapter,
    world,
    events,
    rawS2cPackets,
  }
}

describe('infinite belt buy test', () => {
  it('should not infinite loop', () => {
    const host = new Server.MultiClientRoomHost({ policy: Server.CLOSED_REALM_POLICY, mapSeed: 0, areaId: 1 })
    const rig = createD2gsClientRig(host, { classId: 1, level: 25, x: 100, y: 100 })
    const game = host.game as any
    const player = game.players.get(rig.playerUnitId)
    player.gold = 50000;
    player.goldBank = 50000;
    player.items = [];

    const akaraId = game.spawnMonster({ hcIdx: 148, areaId: 1, x: 101, y: 100, isNpc: true, isVendor: true })
    const akara = game.monsters.get(akaraId)
    akara.vendorPool = [{
      unitId: 9103, code: 'hp1', name: 'Minor Healing Potion', quality: 2, level: 1,
      location: 'vendor', x: 2, y: 0, width: 1, height: 1, areaId: 1, ownerId: akaraId,
      bodyLoc: 0, storePage: 4, cost: 45, permStore: true, gamble: false, identified: true,
      ethereal: false, socketed: false, totalSockets: 0, durability: 0, maxDurability: 0,
      quantity: 1, stats: new Map(), socketedItems: []
    }]
    
    // Add belt
    player.items.push({
      unitId: 9001, code: 'hbl', location: 'equipped', bodyLoc: 8, x: 0, y: 0, width: 2, height: 1, stats: new Map(), socketedItems: []
    })

    // Shift click buy!
    game.enqueueCommand(rig.playerUnitId, { type: 'NpcBuy', npcId: akaraId, itemId: 9103, cost: 45, shiftFill: true })
    game.stepFrames(1)
    
    expect(player.items.filter((it: any) => it.code === 'hp1').length).toBe(16)
  })
})

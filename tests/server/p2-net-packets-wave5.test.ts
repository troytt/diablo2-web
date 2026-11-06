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

describe('P2 Net Packets Wave 5 (#1932, #1933, #1934)', () => {
  it('1932: WalkVerify emitted on invalid distance and InTown skill blocked', () => {
    const host = new Server.MultiClientRoomHost({ policy: Server.CLOSED_REALM_POLICY, mapSeed: 0, areaId: 1 })
    const rig = createD2gsClientRig(host, { classId: 1, level: 10, x: 100, y: 100 })
    const game = host.game as any
    const player = game.players.get(rig.playerUnitId)
    
    rig.events.length = 0
    game.enqueueCommand(rig.playerUnitId, { type: 'Move', x: 500, y: 500, to: { x: 500, y: 500 }, run: false })
    game.stepFrames(1)
    host.stepFrame()
    
    expect(rig.events.some((e: any) => e.type === 'WalkVerify')).toBe(true)

    // Town skill cast block
    rig.events.length = 0
    // Area 1 is town. Let's try casting a non-town skill
    game.enqueueCommand(rig.playerUnitId, { type: 'SkillAt', hand: 'right', at: { x: 100, y: 100 }, hold: false })
    // We assume the selected skill is not InTown. We need to set active skill.
    player.rightSkillId = 47 // Fire Ball
    game.stepFrames(1)
    host.stepFrame()
    
    expect(rig.events.some((e: any) => e.type === 'WalkVerify')).toBe(true) // Blocked cast returns WalkVerify
  })

  it('1933: Dynamic path target and RequestEntityUpdate', () => {
    const host = new Server.MultiClientRoomHost({ policy: Server.CLOSED_REALM_POLICY, mapSeed: 0, areaId: 1 })
    const rig = createD2gsClientRig(host, { classId: 1, level: 10, x: 100, y: 100 })
    const game = host.game as any
    const player = game.players.get(rig.playerUnitId)

    const akaraId = game.spawnMonster({ hcIdx: 148, areaId: 1, x: 110, y: 110, isNpc: true })
    game.enqueueCommand(rig.playerUnitId, { type: 'MoveToUnit', run: false, target: { unitType: 1, id: akaraId } })
    game.stepFrames(1)
    host.stepFrame()
    expect(player.moveTargetUnitId).toBe(akaraId)

    rig.events.length = 0
    game.enqueueCommand(rig.playerUnitId, { type: 'RequestEntityUpdate', unitType: 1, unitId: akaraId })
    game.stepFrames(1)
    host.stepFrame()
    expect(rig.events.some((e: any) => e.type === 'UnitReassign' && e.id === akaraId)).toBe(true)
  })

  it('1934: Auxiliary packets (0x3F Say, MakeEntityMove)', () => {
    const host = new Server.MultiClientRoomHost({ policy: Server.CLOSED_REALM_POLICY, mapSeed: 0, areaId: 1 })
    const rig = createD2gsClientRig(host, { classId: 1, level: 10, x: 100, y: 100 })
    const game = host.game as any
    const player = game.players.get(rig.playerUnitId)

    rig.events.length = 0
    game.enqueueCommand(rig.playerUnitId, { type: 'Say', phraseId: 10 })
    game.stepFrames(1)
    host.stepFrame()
    expect(rig.events.some((e: any) => e.type === 'PlaySound' && e.sound === 10)).toBe(true)
    
    // MakeEntityMove shouldn't crash
    game.enqueueCommand(rig.playerUnitId, { type: 'MakeEntityMove', target: { unitType: 0, id: 0 } })
    game.stepFrames(1)
    host.stepFrame()
  })
})

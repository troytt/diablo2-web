import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import { computeCharKey } from '../../../plugins/kill-stats/kill-stats-model.ts'
import { KillTracker } from '../../../plugins/kill-stats/kill-tracker.ts'
import { encodeD2gsCompressedFrame } from '../../../src/netproto/d2gs/compression.ts'
import { BitWriter, ByteWriter } from '../../../src/netproto/index.ts'
import { createFakeRealm, type FakeRealm } from '../../netproto/fake-realm-servers.ts'
import { MemoryKillStatsRepository } from './memory-repository.ts'

function sendD2gsPacket(realm: FakeRealm, rawPacket: Uint8Array): void {
  const gameConn = realm.latest('game')
  gameConn.server.write(encodeD2gsCompressedFrame(rawPacket))
}

function make0x01GameFlags(
  difficulty: 0 | 1 | 2,
  hardcore = true,
  expansion = true,
  ladder = true,
): Uint8Array {
  return new Uint8Array([
    0x01,
    difficulty,
    0x00,
    hardcore ? 0x08 : 0x00,
    0x00,
    0x00,
    expansion ? 1 : 0,
    ladder ? 1 : 0,
  ])
}

function make0x59AssignPlayer(
  unitId: number,
  charClass: number,
  charName: string,
  x = 0,
  y = 0,
): Uint8Array {
  const buf = new Uint8Array(26)
  const dv = new DataView(buf.buffer)
  buf[0] = 0x59
  dv.setUint32(1, unitId >>> 0, true)
  buf[5] = charClass & 0xff
  for (let i = 0; i < Math.min(15, charName.length); i++) {
    buf[6 + i] = charName.charCodeAt(i) & 0xff
  }
  dv.setUint16(22, x & 0xffff, true)
  dv.setUint16(24, y & 0xffff, true)
  return buf
}

function make0xACSimpleNpc(
  unitId: number,
  classId: number,
  lifePct = 128,
  x = 5000,
  y = 5000,
): Uint8Array {
  const buf = new Uint8Array(13)
  const dv = new DataView(buf.buffer)
  buf[0] = 0xac
  dv.setUint32(1, unitId >>> 0, true)
  dv.setUint16(5, classId & 0xffff, true)
  dv.setUint16(7, x & 0xffff, true)
  dv.setUint16(9, y & 0xffff, true)
  buf[11] = lifePct & 0xff
  buf[12] = 13
  return buf
}

function make0xACSuperUniqueNpc(
  unitId: number,
  classId: number,
  superUniqueId: number,
  lifePct = 128,
  x = 5000,
  y = 5000,
): Uint8Array {
  const bw = new BitWriter()
  bw.writeBits(1, 4) // rawMode = 1 (NU)
  bw.writeBit(0) // hasAnimComp = 0
  bw.writeBit(1) // hasMonsterFlags = 1
  bw.writeBit(0) // champion = 0
  bw.writeBit(0) // unique = 0
  bw.writeBit(1) // superunique = 1
  bw.writeBit(0) // minion = 0
  bw.writeBit(0) // ghostly = 0
  bw.writeBits(superUniqueId & 0xffff, 16) // 16-bit superUniqueId
  bw.writeBits(0, 8) // bossMods terminator (0)
  bw.writeBits(0x1234, 16) // nameSeed
  bw.writeBit(0) // hasOwner = 0
  const tail = bw.toUint8Array()

  const totalLen = 13 + tail.byteLength
  const w = new ByteWriter(totalLen)
  w.u8(0xac)
  w.u32LE(unitId >>> 0)
  w.u16LE(classId & 0xffff)
  w.u16LE(x & 0xffff)
  w.u16LE(y & 0xffff)
  w.u8(lifePct & 0xff)
  w.u8(totalLen & 0xff)
  w.bytes(tail)
  return w.toUint8Array()
}

function make0x69SetNpcMode(
  unitId: number,
  rawCmd: number,
  lifePct = 0,
  x = 5000,
  y = 5000,
): Uint8Array {
  const buf = new Uint8Array(12)
  const dv = new DataView(buf.buffer)
  buf[0] = 0x69
  dv.setUint32(1, unitId >>> 0, true)
  buf[5] = rawCmd & 0xff
  dv.setUint16(6, x & 0xffff, true)
  dv.setUint16(8, y & 0xffff, true)
  buf[10] = lifePct & 0xff
  buf[11] = 0
  return buf
}

function make0x7ASummonAction(
  ownerId: number,
  mercId: number,
  classId: number,
  action = 1,
  petType = 1,
): Uint8Array {
  const buf = new Uint8Array(13)
  const dv = new DataView(buf.buffer)
  buf[0] = 0x7a
  buf[1] = action & 0xff
  buf[2] = petType & 0xff
  dv.setUint16(3, classId & 0xffff, true)
  dv.setUint32(5, ownerId >>> 0, true)
  dv.setUint32(9, mercId >>> 0, true)
  return buf
}

function make0x81AssignMerc(ownerId: number, mercId: number, classId = 338): Uint8Array {
  const buf = new Uint8Array(20)
  const dv = new DataView(buf.buffer)
  buf[0] = 0x81
  buf[1] = 0
  dv.setUint16(2, classId & 0xffff, true)
  dv.setUint32(4, ownerId >>> 0, true)
  dv.setUint32(8, mercId >>> 0, true)
  dv.setUint32(12, 0x12345678, true)
  dv.setUint32(16, 0, true)
  return buf
}

function make0x5BPlayerInGame(
  unitId: number,
  charName: string,
  charClass = 1,
  charLevel = 80,
  partyId = 0xffff,
): Uint8Array {
  const buf = new Uint8Array(36)
  const dv = new DataView(buf.buffer)
  buf[0] = 0x5b
  dv.setUint16(1, 36, true)
  dv.setUint32(3, unitId >>> 0, true)
  buf[7] = charClass & 0xff
  for (let i = 0; i < Math.min(15, charName.length); i++) {
    buf[8 + i] = charName.charCodeAt(i) & 0xff
  }
  dv.setUint16(24, charLevel & 0xffff, true)
  dv.setUint16(26, partyId & 0xffff, true)
  return buf
}

describe('Full-Wire OnlineSession + KillTracker Integration (createFakeRealm)', () => {
  it('authenticates via BNCS/MCP, joins D2GS, decodes compressed 0x01/0x59/0xAC/0x69/0x7A/0x81/0x5B packets, and persists tallies under (host, D2CS, account, d2webbot_sorc)', async () => {
    const realm = createFakeRealm()
    let nowMs = 1_700_000_000_000
    const repository = new MemoryKillStatsRepository({
      initialReplicaId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      now: () => nowMs,
    })

    const session = new OnlineSession({
      resolver: realm.resolver,
      defaultHost: 'www.laiseek.xyz',
    })
    const tracker = new KillTracker({
      session,
      repository,
      now: () => nowMs,
    })

    // 1. Login to BNCS + MCP and select 'd2webbot_sorc' on realm 'D2CS'
    const loginRes = await session.login({
      host: 'www.laiseek.xyz',
      username: 'DeckardCain',
      password: 'secret',
    })
    expect(session.loginHost).toBe('www.laiseek.xyz')
    expect(loginRes.realms[0]?.title).toBe('D2CS')
    expect(loginRes.characters[0]?.name).toBe('d2webbot_sorc')

    await session.selectCharacter('d2webbot_sorc')
    await session.enterGame({
      mode: 'create',
      spec: {
        name: 'ks-wire-1',
        password: '',
        description: '',
        difficulty: 2,
      },
    })
    expect(session.phase).toBe('ingame')

    // 2. Inject Hell GameFlags (0x01), GameHandshake (0x0B, selfId = 1), and local player assignment (0x59, unitId = 1)
    sendD2gsPacket(realm, make0x01GameFlags(2, true, true, true))
    sendD2gsPacket(realm, new Uint8Array([0x0b, 0x00, 0x01, 0x00, 0x00, 0x00]))
    sendD2gsPacket(realm, make0x59AssignPlayer(1, 1, 'd2webbot_sorc', 0, 0))
    sendD2gsPacket(realm, make0x5BPlayerInGame(1, 'd2webbot_sorc', 1, 80, 0xffff))

    // 3. Solo kill #1: Andariel (hcIdx = 156, unitId = 1001) -> monster/156 + boss/156 (solo)
    sendD2gsPacket(realm, make0xACSimpleNpc(1001, 156, 128))
    sendD2gsPacket(realm, make0x69SetNpcMode(1001, 0x08, 0)) // dying (mode 0)
    sendD2gsPacket(realm, make0x69SetNpcMode(1001, 0x09, 0)) // dead (mode 12, no double count)

    // 4. Solo kill #2: Pindleskin (hcIdx = 440, superUniqueId = 52, unitId = 1002) -> monster/440 + superunique/52 (solo)
    nowMs += 1000
    sendD2gsPacket(realm, make0xACSuperUniqueNpc(1002, 440, 52, 128))
    sendD2gsPacket(realm, make0x69SetNpcMode(1002, 0x08, 0))

    // 5. Merc (0x81, unitId = 2001) and Summon (0x7A, unitId = 2002) deaths -> ignored
    sendD2gsPacket(realm, make0x81AssignMerc(1, 2001, 338))
    sendD2gsPacket(realm, make0xACSimpleNpc(2001, 19, 128))
    sendD2gsPacket(realm, make0x69SetNpcMode(2001, 0x08, 0))

    sendD2gsPacket(realm, make0x7ASummonAction(1, 2002, 363, 1, 1))
    sendD2gsPacket(realm, make0xACSimpleNpc(2002, 19, 128))
    sendD2gsPacket(realm, make0x69SetNpcMode(2002, 0x08, 0))

    // 6. Teammate joins (0x5B, unitId = 2) -> party kill of Fallen (hcIdx = 19, unitId = 1003) -> count = 1, soloCount = 0
    nowMs += 1000
    sendD2gsPacket(realm, make0x5BPlayerInGame(2, 'PartyPaladin', 3, 88, 1))
    sendD2gsPacket(realm, make0xACSimpleNpc(1003, 19, 128))
    sendD2gsPacket(realm, make0x69SetNpcMode(1003, 0x08, 0))

    await tracker.flushNow()

    const expectedCharKey = computeCharKey(
      'www.laiseek.xyz',
      'D2CS',
      'DeckardCain',
      'd2webbot_sorc',
    )
    const snap = await repository.loadAll()
    expect(snap.characters).toHaveLength(1)
    expect(snap.characters[0]?.charKey).toBe(expectedCharKey)
    expect(snap.characters[0]?.host).toBe('www.laiseek.xyz')
    expect(snap.characters[0]?.realm).toBe('D2CS')
    expect(snap.characters[0]?.account).toBe('DeckardCain')
    expect(snap.characters[0]?.charName).toBe('d2webbot_sorc')
    expect(snap.characters[0]?.charClass).toBe(1)
    expect(snap.characters[0]?.level).toBe(80)
    expect(snap.characters[0]?.hardcore).toBe(true)
    expect(snap.characters[0]?.expansion).toBe(true)
    expect(snap.characters[0]?.ladder).toBe(true)

    const byKey = new Map(
      snap.tallies.map((t) => [
        `${t.kind}:${t.difficulty}:${t.subject}`,
        { count: t.count, soloCount: t.soloCount },
      ]),
    )
    expect(byKey.get('monster:2:156')).toEqual({ count: 1, soloCount: 1 })
    expect(byKey.get('boss:2:156')).toEqual({ count: 1, soloCount: 1 })
    expect(byKey.get('monster:2:440')).toEqual({ count: 1, soloCount: 1 })
    expect(byKey.get('superunique:2:52')).toEqual({ count: 1, soloCount: 1 })
    expect(byKey.get('monster:2:19')).toEqual({ count: 1, soloCount: 0 })
    expect(snap.tallies).toHaveLength(5)

    tracker.destroy()
    await session.disconnect()
  })
})

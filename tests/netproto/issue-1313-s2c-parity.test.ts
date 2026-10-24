import { describe, expect, it } from 'vitest'
import {
  decode0x21UpdateSkill,
  decode0x22UpdateSkillStatus,
  decode0x28QuestInfo,
  decode0x73CreateMissile,
  decode0x75PlayerPartyInfo,
  decode0x7BAssignSkillHotkey,
  decode0x81AssignMerc,
  decode0x91SetNpcTalk,
  decodeD2gsS2cPacket,
  decodeRare113cS2cPacket,
  encodeMcpGameList,
} from '../../src/netproto/index.ts'

describe('Issue #1313 — 1.13c S2C packet decoders (0x73, 0x28, 0x7B, 0x81, 0x75, 0x21/0x22, 0x16/0x17/0x57/0x91/0x93/0x97/0x98) & MCP 0x05', () => {
  it('decodes canonical 32-byte 0x73 CreateMissile (D2Client.dll 0x6fb5eee0) with u32 coordinates and owner/velocity/level/pierceIdx', () => {
    const pkt = new Uint8Array(32)
    const dv = new DataView(pkt.buffer)
    pkt[0] = 0x73
    dv.setUint32(1, 0x12345678, true) // unk
    dv.setUint16(5, 62, true) // missileClassId = 62 (fireball)
    dv.setUint32(7, 5010, true) // x (u32LE)
    dv.setUint32(11, 5012, true) // y (u32LE)
    dv.setUint32(15, 5030, true) // targetX (u32LE)
    dv.setUint32(19, 5040, true) // targetY (u32LE)
    dv.setUint16(23, 24, true) // cltDoFuncArg / velocity (u16LE)
    pkt[25] = 1 // ownerType = 1 (monster)
    dv.setUint32(26, 9001, true) // ownerId (u32LE)
    pkt[30] = 9 // level (u8)
    pkt[31] = 3 // pierceIdx (u8)

    const ev = decode0x73CreateMissile(pkt)
    expect(ev).toEqual({
      type: 'CreateMissile',
      missileClassId: 62,
      at: { x: 5010, y: 5012 },
      target: { x: 5030, y: 5040 },
      level: 9,
      owner: { unitType: 1, id: 9001 },
      ownerType: 1,
      ownerId: 9001,
      unk: 0x12345678,
      velocity: 24,
      cltDoFuncArg: 24,
      range: 3,
      pierceIdx: 3,
    })
  })

  it('decodes 0x28 QuestInfo (103B, D2Client.dll 0x6fb5fa70) with 7-byte header and 48 quest u16 flags at +7..+102', () => {
    const pkt = new Uint8Array(103)
    const dv = new DataView(pkt.buffer)
    pkt[0] = 0x28
    pkt[1] = 1 // updateType
    dv.setUint32(2, 42, true) // unitId
    pkt[6] = 12 // timer
    dv.setUint16(7, 0x0001, true) // quest 0
    dv.setUint16(7 + 47 * 2, 0x1001, true) // quest 47

    const ev = decode0x28QuestInfo(pkt)
    expect(ev.type).toBe('QuestState')
    if (ev.type === 'QuestState') {
      expect(ev.updateType).toBe(1)
      expect(ev.unitId).toBe(42)
      expect(ev.timer).toBe(12)
      expect(ev.quests.length).toBe(48)
      expect(ev.quests[0]).toBe(0x0001)
      expect(ev.quests[47]).toBe(0x1001)
    }
  })

  it('decodes 0x7B AssignSkillHotkey (8B, D2Client.dll 0x6fb5c6d0) and 0x81 AssignMerc (20B, D2Client.dll 0x6fb5eba0)', () => {
    const pkt7b = new Uint8Array(8)
    const dv7b = new DataView(pkt7b.buffer)
    pkt7b[0] = 0x7b
    pkt7b[1] = 3 // slot
    dv7b.setUint16(2, 54 | 0x8000, true) // skill 54, left hand (bit 15 = 1)
    dv7b.setUint32(4, 0xffffffff, true)
    const ev7b = decode0x7BAssignSkillHotkey(pkt7b)
    expect(ev7b).toMatchObject({
      type: 'ActiveSkill',
      slot: 3,
      hand: 'left',
      skill: 54,
      itemId: 0xffffffff,
    })

    // 0x81 AssignMerc with canonical 1.13c u32 seed at +12..+15 and u16 nameId at +16..+17
    const pkt81 = new Uint8Array(20)
    const dv81 = new DataView(pkt81.buffer)
    pkt81[0] = 0x81
    pkt81[1] = 0
    dv81.setUint16(2, 338, true) // classId (Act 2 merc)
    dv81.setUint32(4, 1, true) // ownerId
    dv81.setUint32(8, 777, true) // mercId
    dv81.setUint32(12, 0xdeadbeef, true) // seed at +12..+15
    dv81.setUint16(16, 7, true) // nameId at +16..+17
    dv81.setUint16(18, 0, true) // pad at +18..+19

    const ev81 = decode0x81AssignMerc(pkt81)
    expect(ev81).toEqual({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 777,
      classId: 338,
      nameId: 7,
      seed: 0xdeadbeef,
      value: 0xdeadbeef,
    })
  })

  it('decodes 0x75 PlayerPartyInfo (13B), 0x21 UpdateSkill (12B), and 0x22 UpdateSkillStatus (12B)', () => {
    const pkt75 = new Uint8Array(13)
    const dv75 = new DataView(pkt75.buffer)
    pkt75[0] = 0x75
    dv75.setUint32(1, 10, true) // unitId
    dv75.setUint16(5, 2, true) // partyId
    dv75.setUint16(7, 85, true) // charLevel
    dv75.setUint16(9, 4, true) // relation
    dv75.setUint16(11, 1, true) // inParty
    const ev75 = decode0x75PlayerPartyInfo(pkt75)
    expect(ev75).toMatchObject({
      type: 'Party',
      kind: 'roster',
      source: 0x75,
      unitId: 10,
      partyId: 2,
      charLevel: 85,
      inParty: true,
    })

    const pkt21 = new Uint8Array([0x21, 0x00, 0x01, 0x0a, 0x00, 0x00, 0x00, 0x36, 0x00, 0x14, 0x00, 0x01])
    const ev21 = decode0x21UpdateSkill(pkt21)
    expect(ev21).toMatchObject({
      type: 'SkillList',
      unitId: 10,
      unitType: 0,
      flag: 1,
      skills: [{ skillId: 54, level: 20 }],
    })

    const pkt22 = new Uint8Array([0x22, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0xdc, 0x00, 0x05, 0x01, 0x00])
    const ev22 = decode0x22UpdateSkillStatus(pkt22)
    expect(ev22).toMatchObject({
      type: 'SkillList',
      unitId: 10,
      unitType: 0,
      flag: 1,
      skills: [{ skillId: 220, level: 5 }],
    })
  })

  it('decodes 0x16, 0x17, 0x57, 0x91, 0x93, 0x97, 0x98, and encodes MCP 0x05 with u32 flags', () => {
    // 0x16 MultipleUnitAssign (3 + 1 * 9 = 12B)
    const pkt16 = new Uint8Array(12)
    const dv16 = new DataView(pkt16.buffer)
    pkt16[0] = 0x16
    pkt16[1] = 0
    pkt16[2] = 1 // count = 1
    pkt16[3] = 1 // monster
    dv16.setUint32(4, 500, true) // id
    dv16.setUint16(8, 5100, true) // x
    dv16.setUint16(10, 5200, true) // y
    const ev16 = decodeRare113cS2cPacket(pkt16)
    expect(ev16).toEqual({
      type: 'ProtocolSync',
      opcode: 0x16,
      byteLength: 12,
      entries: [{ unitType: 1, id: 500, x: 5100, y: 5200 }],
    })

    // 0x17 RemoveUnit17 (7B canonical with u32 id at +3..+6)
    const pkt17 = new Uint8Array([0x17, 0x01, 0x00, 0xef, 0xbe, 0xad, 0xde])
    expect(decodeRare113cS2cPacket(pkt17)).toEqual({
      type: 'UnitRemove',
      unitType: 1,
      id: 0xdeadbeef,
    })

    // 0x57 MonsterEnchant (14B)
    const pkt57 = new Uint8Array(14)
    const dv57 = new DataView(pkt57.buffer)
    pkt57[0] = 0x57
    dv57.setUint32(1, 300, true)
    pkt57[5] = 2
    dv57.setUint16(6, 105, true)
    pkt57[8] = 3
    pkt57[9] = 4
    dv57.setUint32(10, 99, true)
    expect(decodeRare113cS2cPacket(pkt57)).toEqual({
      type: 'ProtocolSync',
      opcode: 0x57,
      byteLength: 14,
      monsterEnchant: {
        monsterId: 300,
        enchantType: 2,
        textId: 105,
        prefix: 3,
        suffix: 4,
        field10: 99,
      },
    })

    // 0x91 SetNPCTalk (26B)
    const pkt91 = new Uint8Array(26)
    pkt91[0] = 0x91
    pkt91[1] = 2 // Act 3
    pkt91[2] = 0x11
    const ev91 = decode0x91SetNpcTalk(pkt91)
    expect(ev91.act).toBe(2)
    expect(ev91.npcFlags[0]).toBe(0x11)

    // 0x93 Unknown0x93 (8B)
    const pkt93 = new Uint8Array([0x93, 0x2a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01])
    expect(decodeRare113cS2cPacket(pkt93)).toEqual({
      type: 'ProtocolSync',
      opcode: 0x93,
      byteLength: 8,
      npcGossip: { npcId: 42, flag: 1 },
    })

    // 0x97 WeaponSwitch (1B)
    expect(decodeD2gsS2cPacket(new Uint8Array([0x97]))).toEqual({ type: 'WeaponSwitch' })

    // 0x98 EvilHut (7B: u8 0x98 | u32 unitId @+1 | u16 value @+5)
    const pkt98 = new Uint8Array(7)
    const dv98 = new DataView(pkt98.buffer)
    pkt98[0] = 0x98
    dv98.setUint32(1, 1024, true)
    dv98.setUint16(5, 3, true)
    expect(decodeRare113cS2cPacket(pkt98)).toEqual({
      type: 'UnitMode',
      unitType: 2,
      id: 1024,
      mode: 3,
    })

    // MCP 0x05 MCP_GAMELIST (u16 requestId, u32 flags, cstring filter)
    const mcp05 = encodeMcpGameList(0x0009, 'baal', 0x2000)
    expect(Array.from(mcp05)).toEqual([
      14, 0, // length = 14
      0x05, // MCP_GAMELIST
      0x09, 0x00, // requestId = 9
      0x00, 0x20, 0x00, 0x00, // flags = 0x2000 (Hell)
      0x62, 0x61, 0x61, 0x6c, 0x00, // "baal\0"
    ])
  })
})

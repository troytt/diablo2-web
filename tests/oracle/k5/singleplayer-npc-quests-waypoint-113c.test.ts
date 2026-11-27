import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import { QUESTRECORD_SetQuestState113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import { STATLIST_GetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import { UNITS_GetX113c, UNITS_GetY113c } from '../../../src/d2kern-113c/common/unit.ts'
import {
  WAYPOINT_ActivateWaypoint113c,
  WAYPOINT_GetWaypointState113c,
} from '../../../src/d2kern-113c/common/waypoint.ts'
import { D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import type { Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import type {
  LocalAreaBootstrap,
  LocalAreaBootstrapResolver,
  ServerEvent,
} from '../../../src/netproto/index.ts'
import {
  D2gsKernelBridge113c,
  LocalKernelD2gsAdapter113c,
  TOWN_HEALER_CLASS_IDS_113C,
  WAYPOINT_AREA_IDS_113C,
  createDefaultQuestData,
  createDefaultWaypointData,
  readD2sSave113c,
  writeD2sSave113c,
} from '../../../src/server/index.ts'

const FIXED_ONE_113C = 256

function getQuestBitInKernelRecord(
  m: Memory113c,
  pQuestData: number,
  nQuest: number,
  nState: number,
): number {
  const pBuf = m.u32(pQuestData >>> 0) >>> 0
  const bitIdx = ((nQuest << 4) + nState) | 0
  return (m.u8((pBuf + (bitIdx >> 3)) >>> 0) >>> (bitIdx & 7)) & 1
}

function setRawQuestWord(
  questsRaw: Uint8Array,
  difficulty: 0 | 1 | 2,
  wordIndex: number,
  value: number,
): void {
  const offset = 10 + difficulty * 96 + wordIndex * 2
  questsRaw[offset] = value & 0xff
  questsRaw[offset + 1] = (value >>> 8) & 0xff
}

function getRawQuestWord(
  questsRaw: Uint8Array,
  difficulty: 0 | 1 | 2,
  wordIndex: number,
): number {
  const offset = 10 + difficulty * 96 + wordIndex * 2
  return ((questsRaw[offset + 1]! << 8) | questsRaw[offset]!) & 0xffff
}

function setRawWaypointBit(
  waypointsRaw: Uint8Array,
  difficulty: 0 | 1 | 2,
  wpIndex: number,
): void {
  const byteOffset = 8 + difficulty * 24 + 2 + (wpIndex >> 3)
  waypointsRaw[byteOffset] = (waypointsRaw[byteOffset]! | (1 << (wpIndex & 7))) & 0xff
}

function hasRawWaypointBit(
  waypointsRaw: Uint8Array,
  difficulty: 0 | 1 | 2,
  wpIndex: number,
): boolean {
  const byteOffset = 8 + difficulty * 24 + 2 + (wpIndex >> 3)
  return (waypointsRaw[byteOffset]! & (1 << (wpIndex & 7))) !== 0
}

function stepAdapterAndSession(
  adapter: LocalKernelD2gsAdapter113c,
  session: OnlineSession,
  clockState: { nowMs: number },
  frames = 1,
): void {
  for (let i = 0; i < frames; i++) {
    clockState.nowMs += 40
    adapter.stepFrame()
    session.tick(40, clockState.nowMs)
  }
}

function buildMultiAreaTestResolver(): {
  readonly resolver: LocalAreaBootstrapResolver
  readonly requestedAreas: number[]
} {
  const requestedAreas: number[] = []
  const areaSpecs: Readonly<
    Record<
      number,
      {
        readonly originX: number
        readonly originY: number
        readonly wpClassId: number
        readonly npcClassId?: number
        readonly monClassId?: number
      }
    >
  > = {
    1: { originX: 5520, originY: 5880, wpClassId: 119, npcClassId: 148 }, // Rogue Encampment + Akara
    3: { originX: 5840, originY: 5880, wpClassId: 119, monClassId: 0 }, // Cold Plains + Skeleton
    4: { originX: 6160, originY: 5880, wpClassId: 119, monClassId: 18 }, // Stony Field + Fallen
    40: { originX: 5000, originY: 5000, wpClassId: 156, npcClassId: 178 }, // Lut Gholein + Fara
    75: { originX: 5120, originY: 5120, wpClassId: 237, npcClassId: 255 }, // Kurast Docks + Ormus
    103: { originX: 5040, originY: 5040, wpClassId: 398, npcClassId: 405 }, // Pandemonium Fortress + Jamella
    109: { originX: 5080, originY: 5080, wpClassId: 429, npcClassId: 513 }, // Harrogath + Malah
  }

  const resolver: LocalAreaBootstrapResolver = (req): LocalAreaBootstrap | null => {
    requestedAreas.push(req.areaId)
    const spec = areaSpecs[req.areaId]
    if (spec === undefined) return null
    const subW = 80
    const subH = 80
    const spawnX = spec.originX + 20
    const spawnY = spec.originY + 20
    const wpX = spec.originX + 23
    const wpY = spec.originY + 20
    const tileX = Math.trunc(spec.originX / 5)
    const tileY = Math.trunc(spec.originY / 5)
    const collision = new Uint16Array(subW * subH)
    for (let y = 0; y < subH; y++) {
      for (let x = 0; x < subW; x++) {
        if (x === 0 || y === 0 || x === subW - 1 || y === subH - 1) {
          collision[y * subW + x] = 0x0001
        }
      }
    }
    // Waypoint footprint subtile is blocked so `COLLISION_GetFreeCoordinates` lands adjacent
    collision[(wpY - spec.originY) * subW + (wpX - spec.originX)] = 0x0100

    return {
      areaId: req.areaId,
      spawnX,
      spawnY,
      originX: spec.originX,
      originY: spec.originY,
      subWidth: subW,
      subHeight: subH,
      collision,
      rooms: [
        { areaId: req.areaId, tileX, tileY },
        { areaId: req.areaId, tileX: tileX + 8, tileY },
        { areaId: req.areaId, tileX, tileY: tileY + 8 },
        { areaId: req.areaId, tileX: tileX + 8, tileY: tileY + 8 },
      ],
      roomRects: [{ index: 0, x: spec.originX, y: spec.originY, w: subW, h: subH, seed: 1 }],
      adjacentAreaIds: [],
      objects: [
        {
          classId: spec.wpClassId,
          x: wpX,
          y: wpY,
          areaId: req.areaId,
          isWaypoint: true,
          mode: req.areaId === 3 ? 0 : 2,
        },
        // Server-only spawner marker (must be filtered out cleanly)
        {
          classId: 382,
          x: spawnX + 5,
          y: spawnY + 5,
          areaId: req.areaId,
          isWaypoint: false,
          mode: 0,
        },
      ],
      monsters: [
        ...(spec.npcClassId !== undefined
          ? [
              {
                classId: spec.npcClassId,
                x: spawnX + 3,
                y: spawnY + 2,
                areaId: req.areaId,
                isNpc: true,
                isVendor: true,
              },
            ]
          : []),
        ...(spec.monClassId !== undefined
          ? [
              {
                classId: spec.monClassId,
                x: spawnX + 12,
                y: spawnY + 12,
                areaId: req.areaId,
                isNpc: false,
              },
            ]
          : []),
        // Rogue Encampment chicken critter (`149`, must be filtered out cleanly)
        ...(req.areaId === 1
          ? [
              {
                classId: 149,
                x: spawnX + 4,
                y: spawnY + 4,
                areaId: 1,
              },
            ]
          : []),
      ],
      warps: [],
      isWalkable: (checkAreaId, x, y) => {
        if (checkAreaId !== req.areaId) return false
        const lx = x - spec.originX
        const ly = y - spec.originY
        if (lx < 0 || ly < 0 || lx >= subW || ly >= subH) return false
        return (collision[ly * subW + lx]! & 0x1c09) === 0
      },
    }
  }

  return { resolver, requestedAreas }
}

describe('[K5] Wave 2: .d2s Quest/Waypoint Hydration, NPC 0x28 + Healers & Waypoint 0x63/0x49 Multi-Area Travel', () => {
  it('hydrates 298B Woo! quests & 80B WS waypoints into SparseMemory113c and splices live mutations losslessly on exportD2s()', () => {
    const questsIn = createDefaultQuestData()
    const waypointsIn = createDefaultWaypointData()

    // Populate distinct markers in Normal (0), Nightmare (1), and Hell (2)
    setRawQuestWord(questsIn, 0, 1, 0x1001) // Normal A1Q1 completed
    setRawQuestWord(questsIn, 1, 1, 0x0004) // Nightmare A1Q1 started
    setRawQuestWord(questsIn, 1, 6, 0x2001) // Nightmare A1Q6 completed now
    setRawQuestWord(questsIn, 2, 26, 0x9001) // Hell A4Q3 completed

    setRawWaypointBit(waypointsIn, 0, 0)
    setRawWaypointBit(waypointsIn, 0, 8) // Normal Catacombs L2
    setRawWaypointBit(waypointsIn, 1, 0)
    setRawWaypointBit(waypointsIn, 1, 9) // Nightmare Lut Gholein
    setRawWaypointBit(waypointsIn, 2, 0)
    setRawWaypointBit(waypointsIn, 2, 30) // Hell Harrogath

    // Distinct trailing reserved bytes [16..23] in all 3 difficulty waypoint slots
    for (let i = 0; i < 8; i++) {
      waypointsIn[8 + 0 * 24 + 16 + i] = 0xa0 + i
      waypointsIn[8 + 1 * 24 + 16 + i] = 0xb0 + i
      waypointsIn[8 + 2 * 24 + 16 + i] = 0xc0 + i
    }

    const normalQuestsExpected = questsIn.slice(10, 106)
    const hellQuestsExpected = questsIn.slice(202, 298)
    const normalWpExpected = waypointsIn.slice(8, 32)
    const hellWpExpected = waypointsIn.slice(56, 80)
    const nightmareWpTrailingExpected = waypointsIn.slice(8 + 24 + 16, 8 + 48)

    const initialSave = writeD2sSave113c({
      name: 'QuestKeeper',
      classId: 1,
      level: 45,
      statusFlags: 0x20,
      progression: 8,
      activeDifficulty: 1,
      activeAct: 1,
      mapSeed: 0x2468ace0,
      questsRaw: questsIn,
      waypointsRaw: waypointsIn,
      attributes: {
        strength: 60,
        energy: 95,
        dexterity: 50,
        vitality: 120,
        statPts: 0,
        newSkills: 0,
        hitpointsFixed: 360 * FIXED_ONE_113C,
        maxHpFixed: 360 * FIXED_ONE_113C,
        manaFixed: 280 * FIXED_ONE_113C,
        maxManaFixed: 280 * FIXED_ONE_113C,
        staminaFixed: 210 * FIXED_ONE_113C,
        maxStaminaFixed: 210 * FIXED_ONE_113C,
        level: 45,
        experience: 29_000_000,
        gold: 50_000,
        goldBank: 200_000,
      },
      skills: new Uint8Array(30),
      items: [],
    })

    const adapter = new LocalKernelD2gsAdapter113c({ d2s: initialSave })
    const m = adapter.bridge.m
    const pPlayer = adapter.handle.getPlayerPtr()
    expect(pPlayer).not.toBe(0)

    const pPlayerData = m.get(pPlayer, D2UnitStrc.pUnitData) >>> 0
    expect(pPlayerData).not.toBe(0)

    // Verify D2PlayerDataStrc pointers at +0x10..+0x18 (pQuestData[0..2]) and +0x1C..+0x24 (pWaypointData[0..2])
    const pQuestNorm = m.u32((pPlayerData + 0x10) >>> 0) >>> 0
    const pQuestNm = m.u32((pPlayerData + 0x14) >>> 0) >>> 0
    const pQuestHell = m.u32((pPlayerData + 0x18) >>> 0) >>> 0
    expect(pQuestNorm).toBe(adapter.bridge.getPlayerQuestRecordPtr(adapter.handle.clientId, 0))
    expect(pQuestNm).toBe(adapter.bridge.getPlayerQuestRecordPtr(adapter.handle.clientId, 1))
    expect(pQuestHell).toBe(adapter.bridge.getPlayerQuestRecordPtr(adapter.handle.clientId, 2))

    // Verify hydrated Nightmare quest states in D2BitBufferStrc
    expect(getQuestBitInKernelRecord(m, pQuestNm, 1, 2)).toBe(1) // word 1 bit 2 (0x0004)
    expect(getQuestBitInKernelRecord(m, pQuestNm, 6, 0)).toBe(1) // word 6 bit 0 (0x0001)
    expect(getQuestBitInKernelRecord(m, pQuestNm, 6, 13)).toBe(1) // word 6 bit 13 (0x2000)

    // Verify hydrated Nightmare waypoint states via 1.13c D2Common WAYPOINT_GetWaypointState113c
    const pWpNm = m.u32((pPlayerData + 0x20) >>> 0) >>> 0
    expect(pWpNm).toBe(adapter.bridge.getPlayerWaypointDataPtr(adapter.handle.clientId, 1))
    expect(WAYPOINT_GetWaypointState113c(m, pWpNm, 0)).not.toBe(0)
    expect(WAYPOINT_GetWaypointState113c(m, pWpNm, 9)).not.toBe(0)
    expect(WAYPOINT_GetWaypointState113c(m, pWpNm, 18)).toBe(0)

    // Also verify C2S 0x40 RequestQuestData streams 103B S2C 0x28 (updateType = 6, unitId = 0)
    adapter.bridge.drainUncompressedS2CPackets()
    adapter.bridge.feedC2SPacket(adapter.handle.clientId, new Uint8Array([0x40]))
    adapter.stepFrame()
    const logPkts = adapter.bridge.drainUncompressedS2CPackets().filter((p) => p.opcode === 0x28)
    expect(logPkts.length).toBe(1)
    expect(logPkts[0]!.bytes.byteLength).toBe(103)
    expect(logPkts[0]!.bytes[1]).toBe(6)

    // Mutate Nightmare quest & waypoint records directly in SparseMemory113c via 1.13c kernel functions
    QUESTRECORD_SetQuestState113c(m, pQuestNm, 14, 0) // Complete Nightmare A2Q6 (word 14 bit 0)
    WAYPOINT_ActivateWaypoint113c(m, pWpNm, 18) // Unlock Nightmare Kurast Docks (wpIdx 18)
    WAYPOINT_ActivateWaypoint113c(m, pWpNm, 26) // Unlock Nightmare Durance L2 (wpIdx 26)

    const exportedBytes = adapter.exportD2s()
    const reparsed = readD2sSave113c(exportedBytes)

    expect(reparsed.questsRaw.byteLength).toBe(298)
    expect(reparsed.waypointsRaw.byteLength).toBe(80)

    // Normal & Hell quest/waypoint records + Nightmare trailing 8 reserved bytes are preserved 100% losslessly
    expect(Array.from(reparsed.questsRaw.subarray(10, 106))).toEqual(
      Array.from(normalQuestsExpected),
    )
    expect(Array.from(reparsed.questsRaw.subarray(202, 298))).toEqual(
      Array.from(hellQuestsExpected),
    )
    expect(Array.from(reparsed.waypointsRaw.subarray(8, 32))).toEqual(Array.from(normalWpExpected))
    expect(Array.from(reparsed.waypointsRaw.subarray(56, 80))).toEqual(Array.from(hellWpExpected))
    expect(Array.from(reparsed.waypointsRaw.subarray(8 + 24 + 16, 8 + 48))).toEqual(
      Array.from(nightmareWpTrailingExpected),
    )

    // Nightmare quest & waypoint mutations were spliced cleanly into active difficulty slot
    expect(getRawQuestWord(reparsed.questsRaw, 1, 14) & 0x0001).toBe(0x0001)
    expect(getRawQuestWord(reparsed.questsRaw, 1, 6)).toBe(0x2001)
    expect(hasRawWaypointBit(reparsed.waypointsRaw, 1, 9)).toBe(true)
    expect(hasRawWaypointBit(reparsed.waypointsRaw, 1, 18)).toBe(true)
    expect(hasRawWaypointBit(reparsed.waypointsRaw, 1, 26)).toBe(true)

    adapter.close()
  })

  it('completes C2S 0x13 -> S2C 0x28 -> C2S 0x2F / 0x30 NPC handshake without ping-pong loops and supports walk-to-interact', () => {
    const questsRaw = createDefaultQuestData()
    setRawQuestWord(questsRaw, 0, 3, 0x0005) // A1Q3 active flags
    setRawQuestWord(questsRaw, 0, 5, 0x0008) // A1Q5 active flags

    const saveBytes = writeD2sSave113c({
      name: 'TownSpeaker',
      classId: 3, // Paladin
      level: 12,
      statusFlags: 0x20,
      activeDifficulty: 0,
      activeAct: 0,
      mapSeed: 0x11223344,
      questsRaw,
      waypointsRaw: createDefaultWaypointData(),
      attributes: {
        strength: 35,
        energy: 15,
        dexterity: 25,
        vitality: 40,
        statPts: 0,
        newSkills: 0,
        hitpointsFixed: 120 * FIXED_ONE_113C,
        maxHpFixed: 120 * FIXED_ONE_113C,
        manaFixed: 40 * FIXED_ONE_113C,
        maxManaFixed: 40 * FIXED_ONE_113C,
        staminaFixed: 100 * FIXED_ONE_113C,
        maxStaminaFixed: 100 * FIXED_ONE_113C,
        level: 12,
        experience: 90_000,
        gold: 5_000,
        goldBank: 0,
      },
      skills: new Uint8Array(30),
      items: [],
    })

    const clockState = { nowMs: 1000 }
    const adapter = new LocalKernelD2gsAdapter113c({ d2s: saveBytes })
    const session = new OnlineSession()
    session.attachGameServer(adapter)
    session.tick(40, clockState.nowMs)
    expect(session.phase).toBe('ingame')

    const bridge = adapter.bridge
    const pPlayer = adapter.handle.getPlayerPtr()
    const startX = UNITS_GetX113c(bridge.m, pPlayer) & 0xffff
    const startY = UNITS_GetY113c(bridge.m, pPlayer) & 0xffff

    // Spawn Charsi (154, non-healer vendor/artisan) adjacent to player
    const charsi = bridge.spawnMonsterInRoom({
      classId: 154,
      x: startX + 3,
      y: startY + 2,
    })

    // Deplete player HP slightly to confirm non-healer Charsi does NOT heal
    bridge.setPlayerStatAndSync(adapter.handle.clientId, 6, 70 * FIXED_ONE_113C)
    stepAdapterAndSession(adapter, session, clockState, 1)
    bridge.drainUncompressedS2CPackets()

    // OnlineSession sends C2S 0x13 Interact -> bridge emits 103B S2C 0x28 -> OnlineSession opens NPC interaction & sends C2S 0x2F NpcInit
    session.sendCommand({
      type: 'Interact',
      target: { unitType: 1, id: charsi.unitId },
    })
    stepAdapterAndSession(adapter, session, clockState, 2)

    const s2c28List = bridge.drainUncompressedS2CPackets().filter((p) => p.opcode === 0x28)
    expect(s2c28List.length).toBe(1) // Exactly 1 S2C 0x28 (zero infinite ping-pong loop!)
    expect(s2c28List[0]!.bytes.byteLength).toBe(103)
    expect(s2c28List[0]!.bytes[1]).toBe(1) // updateType = 1 (UNIT_MONSTER)
    expect(
      new DataView(s2c28List[0]!.bytes.buffer, s2c28List[0]!.bytes.byteOffset).getUint32(2, true),
    ).toBe(charsi.unitId)

    expect(session.world.npcInteraction.npcId).toBe(charsi.unitId)
    expect(session.world.quests[3]).toBe(0x0005)
    expect(session.world.quests[5]).toBe(0x0008)
    expect(session.world.self.life).toBe(70) // Non-healer leaves HP at 70

    // Send C2S 0x30 NpcCancel cleanly
    session.sendCommand({
      type: 'NpcCancel',
      target: { unitType: 1, id: charsi.unitId },
      npcId: charsi.unitId,
    })
    stepAdapterAndSession(adapter, session, clockState, 1)

    // Out-of-range walk-to-interact: spawn Kashya (150) 15 subtiles away and send C2S 0x13
    const kashya = bridge.spawnMonsterInRoom({
      classId: 150,
      x: startX + 15,
      y: startY,
    })
    bridge.drainUncompressedS2CPackets()

    session.sendCommand({
      type: 'Interact',
      target: { unitType: 1, id: kashya.unitId },
    })

    for (let step = 0; step < 30; step++) {
      stepAdapterAndSession(adapter, session, clockState, 1)
      if (session.world.npcInteraction.npcId === kashya.unitId) break
    }
    const afterWalkX = UNITS_GetX113c(bridge.m, pPlayer) & 0xffff
    const afterWalkY = UNITS_GetY113c(bridge.m, pPlayer) & 0xffff
    expect(Math.hypot(afterWalkX - (startX + 15), afterWalkY - startY)).toBeLessThanOrEqual(5)
    expect(session.world.npcInteraction.npcId).toBe(kashya.unitId)

    session.leaveGame()
  })

  it('restores HP, Mana, and Stamina to Max in SparseMemory113c and S2C sync for all 6 canonical 1.13c town healers', () => {
    const healers = [
      { classId: 148, name: 'Akara' },
      { classId: 176, name: 'Atma' },
      { classId: 178, name: 'Fara' },
      { classId: 255, name: 'Ormus' },
      { classId: 405, name: 'Jamella' },
      { classId: 513, name: 'Malah' },
    ] as const

    expect(TOWN_HEALER_CLASS_IDS_113C.size).toBe(6)
    for (const h of healers) {
      expect(TOWN_HEALER_CLASS_IDS_113C.has(h.classId)).toBe(true)
    }

    const bridge = new D2gsKernelBridge113c({
      spawnX: 5560,
      spawnY: 5920,
      initialPlayerStats: {
        6: 25 * FIXED_ONE_113C,
        7: 240 * FIXED_ONE_113C,
        8: 10 * FIXED_ONE_113C,
        9: 180 * FIXED_ONE_113C,
        10: 15 * FIXED_ONE_113C,
        11: 160 * FIXED_ONE_113C,
      },
    })
    const events: ServerEvent[] = []
    const connected = bridge.connectD2gsAdapter({
      onEvent: (ev) => events.push(ev),
    })
    const cid = connected.clientId
    const pPlayer = connected.handle.getPlayerPtr()

    for (let idx = 0; idx < healers.length; idx++) {
      const healer = healers[idx]!
      const spawned = bridge.spawnMonsterInRoom({
        classId: healer.classId,
        x: 5562,
        y: 5921,
      })

      // Deplete HP, Mana, and Stamina in SparseMemory113c prior to talking to healer
      bridge.setPlayerStatAndSync(cid, 6, (20 + idx) * FIXED_ONE_113C)
      bridge.setPlayerStatAndSync(cid, 8, (5 + idx) * FIXED_ONE_113C)
      bridge.setPlayerStatAndSync(cid, 10, (8 + idx) * FIXED_ONE_113C)
      bridge.drainUncompressedS2CPackets()
      events.length = 0

      // Alternate testing C2S 0x13 (even idx) and standalone C2S 0x2F (odd idx)
      if (idx % 2 === 0) {
        connected.adapter.send({
          type: 'Interact',
          target: { unitType: 1, id: spawned.unitId },
        })
      } else {
        connected.adapter.send({
          type: 'NpcInit',
          target: { unitType: 1, id: spawned.unitId },
        })
      }
      bridge.stepFrame()

      // Verify SparseMemory113c stats restored to Max
      expect(STATLIST_GetUnitStat113c(bridge.m, pPlayer, 6, 0)).toBe(240 * FIXED_ONE_113C)
      expect(STATLIST_GetUnitStat113c(bridge.m, pPlayer, 8, 0)).toBe(180 * FIXED_ONE_113C)
      expect(STATLIST_GetUnitStat113c(bridge.m, pPlayer, 10, 0)).toBe(160 * FIXED_ONE_113C)

      // Verify S2C 0x28 + S2C 0x1D..0x1F + S2C 0x95 were emitted
      const pkts = bridge.drainUncompressedS2CPackets()
      expect(pkts.some((p) => p.opcode === 0x28 && p.bytes.byteLength === 103)).toBe(true)
      expect(pkts.some((p) => p.opcode === 0x95)).toBe(true)
      expect(
        events.some(
          (ev) =>
            ev.type === 'LifeMana' && ev.life === 240 && ev.mana === 180 && ev.stamina === 160,
        ),
      ).toBe(true)
    }

    connected.handle.close()
  })

  it('activates waypoints on C2S 0x13 -> 21B S2C 0x63 and warps across same-Act & cross-Act areas via C2S 0x49 + exportD2s()', () => {
    expect(WAYPOINT_AREA_IDS_113C.length).toBe(39)

    const waypointsIn = createDefaultWaypointData()
    // Pre-unlock Rogue Encampment (0 -> area 1), Cold Plains (1 -> area 3), Lut Gholein (9 -> area 40),
    // Kurast Docks (18 -> area 75), Pandemonium Fortress (27 -> area 103), Harrogath (30 -> area 109)
    // Leave Stony Field (2 -> area 4) LOCKED!
    for (const wpIdx of [0, 1, 9, 18, 27, 30]) {
      setRawWaypointBit(waypointsIn, 0, wpIdx)
    }

    const initialSave = writeD2sSave113c({
      name: 'Wayfarer',
      classId: 0, // Amazon
      level: 60,
      statusFlags: 0x20,
      progression: 12,
      activeDifficulty: 0,
      activeAct: 0,
      mapSeed: 0x55667788,
      questsRaw: createDefaultQuestData(),
      waypointsRaw: waypointsIn,
      attributes: {
        strength: 85,
        energy: 30,
        dexterity: 120,
        vitality: 140,
        statPts: 0,
        newSkills: 0,
        hitpointsFixed: 40 * FIXED_ONE_113C, // Depleted HP to test Malah healer after warping to Act 5!
        maxHpFixed: 420 * FIXED_ONE_113C,
        manaFixed: 20 * FIXED_ONE_113C,
        maxManaFixed: 150 * FIXED_ONE_113C,
        staminaFixed: 30 * FIXED_ONE_113C,
        maxStaminaFixed: 260 * FIXED_ONE_113C,
        level: 60,
        experience: 120_000_000,
        gold: 100_000,
        goldBank: 500_000,
      },
      skills: new Uint8Array(30),
      items: [],
    })

    const { resolver, requestedAreas } = buildMultiAreaTestResolver()
    let savedAfterTour: Uint8Array | undefined
    const clockState = { nowMs: 2000 }
    const adapter = new LocalKernelD2gsAdapter113c({
      d2s: initialSave,
      resolveAreaBootstrap: resolver,
      onAutoSave: (bytes) => {
        savedAfterTour = bytes
      },
    })
    const session = new OnlineSession()
    session.attachGameServer(adapter)
    session.tick(40, clockState.nowMs)
    expect(session.phase).toBe('ingame')
    expect(session.world.areaId).toBe(1)
    expect(session.world.act).toBe(0)

    const bridge = adapter.bridge

    const findClientWaypointObject = () => {
      const objs = session.world.getUnitsByType('object')
      return objs.find((u) => u.classId >= 119)
    }

    const act1Wp = findClientWaypointObject()
    expect(act1Wp).toBeDefined()

    // 1. Interact with Rogue Encampment waypoint -> emits exact 21-byte S2C 0x63 OpenWaypoint
    bridge.drainUncompressedS2CPackets()
    session.sendCommand({
      type: 'Interact',
      target: { unitType: 2, id: act1Wp!.id },
    })
    stepAdapterAndSession(adapter, session, clockState, 1)

    const wpOpenPkts = bridge.drainUncompressedS2CPackets().filter((p) => p.opcode === 0x63)
    expect(wpOpenPkts.length).toBe(1)
    expect(wpOpenPkts[0]!.bytes.byteLength).toBe(21)
    expect(wpOpenPkts[0]!.bytes[5]).toBe(0x02)
    expect(wpOpenPkts[0]!.bytes[6]).toBe(0x01)
    expect(session.world.waypointOpen).toBe(true)
    expect(session.world.waypoints.has(0)).toBe(true) // Rogue Encampment
    expect(session.world.waypoints.has(1)).toBe(true) // Cold Plains
    expect(session.world.waypoints.has(2)).toBe(false) // Stony Field (locked)
    expect(session.world.waypoints.has(30)).toBe(true) // Harrogath

    // 2. Attempting C2S 0x49 to a LOCKED waypoint (Stony Field areaId = 4) is safely rejected
    session.sendCommand({
      type: 'WaypointGo',
      waypointId: act1Wp!.id,
      destAreaId: 4,
    })
    stepAdapterAndSession(adapter, session, clockState, 1)
    expect(bridge.currentAreaId).toBe(1)
    expect(session.world.areaId).toBe(1)

    // Re-open waypoint and test destAreaId === 0 close
    session.sendCommand({
      type: 'Interact',
      target: { unitType: 2, id: act1Wp!.id },
    })
    stepAdapterAndSession(adapter, session, clockState, 1)
    session.sendCommand({
      type: 'WaypointGo',
      waypointId: act1Wp!.id,
      destAreaId: 0,
    })
    stepAdapterAndSession(adapter, session, clockState, 1)
    expect(bridge.currentAreaId).toBe(1)

    // 3. Re-open waypoint and warp within Act 1 to Cold Plains (areaId = 3)
    session.sendCommand({
      type: 'Interact',
      target: { unitType: 2, id: act1Wp!.id },
    })
    stepAdapterAndSession(adapter, session, clockState, 1)
    bridge.drainUncompressedS2CPackets()

    session.sendCommand({
      type: 'WaypointGo',
      waypointId: act1Wp!.id,
      destAreaId: 3,
    })
    stepAdapterAndSession(adapter, session, clockState, 1)

    expect(bridge.currentAreaId).toBe(3)
    expect(bridge.currentAct).toBe(0)
    expect(session.world.areaId).toBe(3)
    expect(requestedAreas).toContain(3)

    // Unset Cold Plains bit in SparseMemory113c and spawn an unlit waypoint (mode = 0) to verify C2S 0x13 unlocks & lights it!
    const pWpData = bridge.getPlayerWaypointDataPtr(adapter.handle.clientId, 0)
    bridge.m.setU8((pWpData + 2) >>> 0, bridge.m.u8((pWpData + 2) >>> 0) & ~0x02) // Clear bit 1 (Cold Plains)
    expect(WAYPOINT_GetWaypointState113c(bridge.m, pWpData, 1)).toBe(0)

    const unlitWp = bridge.spawnObjectInRoom({
      classId: 119,
      x: (UNITS_GetX113c(bridge.m, adapter.handle.getPlayerPtr()) & 0xffff) + 2,
      y: UNITS_GetY113c(bridge.m, adapter.handle.getPlayerPtr()) & 0xffff,
      mode: 0,
    })
    bridge.drainUncompressedS2CPackets()

    session.sendCommand({
      type: 'Interact',
      target: { unitType: 2, id: unlitWp.unitId },
    })
    stepAdapterAndSession(adapter, session, clockState, 1)

    const activatePkts = bridge.drainUncompressedS2CPackets()
    expect(WAYPOINT_GetWaypointState113c(bridge.m, pWpData, 1)).not.toBe(0) // Re-unlocked by clicking!
    expect(activatePkts.some((p) => p.opcode === 0x0e && p.bytes.byteLength === 12)).toBe(true)
    expect(activatePkts.some((p) => p.opcode === 0x63 && p.bytes.byteLength === 21)).toBe(true)

    // 4. Cross-Act tour: Cold Plains (Act 1) -> Lut Gholein (40, Act 2) -> Kurast Docks (75, Act 3) -> Pandemonium Fortress (103, Act 4) -> Harrogath (109, Act 5)
    for (const hop of [
      { destAreaId: 40, expectedAct: 1, healerClassId: 178 },
      { destAreaId: 75, expectedAct: 2, healerClassId: 255 },
      { destAreaId: 103, expectedAct: 3, healerClassId: 405 },
      { destAreaId: 109, expectedAct: 4, healerClassId: 513 },
    ] as const) {
      const curWp = session.world.getUnitsByType('object').find((u) => u.classId >= 119)
      expect(curWp).toBeDefined()

      session.sendCommand({
        type: 'Interact',
        target: { unitType: 2, id: curWp!.id },
      })
      stepAdapterAndSession(adapter, session, clockState, 1)
      bridge.drainUncompressedS2CPackets()

      session.sendCommand({
        type: 'WaypointGo',
        waypointId: curWp!.id,
        destAreaId: hop.destAreaId,
      })
      stepAdapterAndSession(adapter, session, clockState, 1)

      const hopPkts = bridge.drainUncompressedS2CPackets()
      expect(hopPkts.some((p) => p.opcode === 0x03 && p.bytes.byteLength === 12)).toBe(true)
      expect(hopPkts.some((p) => p.opcode === 0x53 && p.bytes.byteLength === 10)).toBe(true)
      expect(hopPkts.some((p) => p.opcode === 0x07 && p.bytes.byteLength === 6)).toBe(true)
      expect(hopPkts.some((p) => p.opcode === 0x15 && p.bytes.byteLength === 11)).toBe(true)

      expect(bridge.currentAreaId).toBe(hop.destAreaId)
      expect(bridge.currentAct).toBe(hop.expectedAct)
      expect(session.world.areaId).toBe(hop.destAreaId)
      expect(session.world.act).toBe(hop.expectedAct)

      const townHealer = session.world
        .getUnitsByType('monster')
        .find((u) => u.classId === hop.healerClassId)
      expect(townHealer).toBeDefined()
    }

    // 5. Talk to Malah (513) in Harrogath (Act 5) -> heals depleted 40/420 HP, 20/150 Mana, 30/260 Stamina to full!
    const malah = session.world.getUnitsByType('monster').find((u) => u.classId === 513)!
    expect(session.world.self.life).toBe(40)
    session.sendCommand({
      type: 'Interact',
      target: { unitType: 1, id: malah.id },
    })
    stepAdapterAndSession(adapter, session, clockState, 2)

    expect(session.world.npcInteraction.npcId).toBe(malah.id)
    expect(session.world.self.life).toBe(420)
    expect(session.world.self.mana).toBe(150)
    expect(session.world.self.stamina).toBe(260)

    // 6. Leave game -> auto-saves .d2s with activeAct = 4 (Act 5), full vitals, and Cold Plains waypoint unlocked;
    //    re-entering game spawns directly in Harrogath (areaId = 109, act = 4)!
    session.leaveGame()
    expect(savedAfterTour).toBeDefined()
    const parsedAfterTour = readD2sSave113c(savedAfterTour!)
    expect(parsedAfterTour.activeAct).toBe(4)
    expect(parsedAfterTour.attributes.hitpointsFixed).toBe(420 * FIXED_ONE_113C)
    expect(parsedAfterTour.attributes.manaFixed).toBe(150 * FIXED_ONE_113C)
    expect(parsedAfterTour.attributes.staminaFixed).toBe(260 * FIXED_ONE_113C)
    expect(hasRawWaypointBit(parsedAfterTour.waypointsRaw, 0, 1)).toBe(true)

    const adapter2 = new LocalKernelD2gsAdapter113c({
      d2s: savedAfterTour!,
      resolveAreaBootstrap: resolver,
    })
    const session2 = new OnlineSession()
    session2.attachGameServer(adapter2)
    session2.tick(40, 9000)
    expect(session2.world.act).toBe(4)
    expect(session2.world.areaId).toBe(109)
    expect(session2.world.self.life).toBe(420)
    session2.leaveGame()
  })
})

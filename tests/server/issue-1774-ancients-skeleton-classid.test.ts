/**
 * Issue #1774 — Arreat Summit (`areaId 120`) Ancients fight monster `classId` / appearance /
 * resistance corruption & `skeleton1` (`hcIdx 0`, NM/Hell `ResPo = 75%`) non-fabrication sweep.
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { clientUnitToMonsterTargetInfo } from '../../src/client/ui-model/hud-item-adapter.ts'
import {
  MONSTATS_113C_ROWS,
  getMonsterKindByHcIdx,
  getSuperUniqueByIndex,
  getSuperUniqueIndexById,
} from '../../src/common/units/monsters-data.ts'
import {
  TsFramer,
  createMemoryStreamPair,
  decodeD2gsS2cPacket,
  serverEventToS2cPackets,
  type ServerEvent,
} from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { QUEST_FLAG_COMPLETED_113C, questWordIndex113c } from '../../src/server/engine/quests-113c.ts'
import { MultiClientRoomHost } from '../../src/server/room-host.ts'

describe('issue #1774 — 1.13c MonStats / SuperUniques ground truth for Ancients vs skeleton1', () => {
  it('verifies skeleton1 (hcIdx 0) has ResPo [50, 75, 75] while Ancients 540..542 have Normal ResPo 70 / 0 / 70', () => {
    const skel0 = MONSTATS_113C_ROWS[0]!
    expect(skel0.id).toBe('skeleton1')
    expect(skel0.code).toBe('SK')
    expect(skel0.resPo).toEqual([50, 75, 75])

    const talic = MONSTATS_113C_ROWS[540]!
    const madawc = MONSTATS_113C_ROWS[541]!
    const korlic = MONSTATS_113C_ROWS[542]!
    expect(talic.id).toBe('ancientbarb1')
    expect(talic.code).toBe('0D')
    expect(talic.resPo).toEqual([70, 70, 50])

    expect(madawc.id).toBe('ancientbarb2')
    expect(madawc.code).toBe('0F')
    expect(madawc.resPo).toEqual([0, 0, 50])

    expect(korlic.id).toBe('ancientbarb3')
    expect(korlic.code).toBe('0E')
    expect(korlic.resPo).toEqual([70, 70, 50])

    expect(getMonsterKindByHcIdx(540, 0)?.resistances.poison).toBe(70)
    expect(getMonsterKindByHcIdx(541, 0)?.resistances.poison).toBe(0)
    expect(getMonsterKindByHcIdx(542, 0)?.resistances.poison).toBe(70)
    expect(getMonsterKindByHcIdx(0, 1)?.resistances.poison).toBe(75)
    expect(getMonsterKindByHcIdx(0, 2)?.resistances.poison).toBe(75)

    expect(getSuperUniqueIndexById('Ancient Barbarian 1')).toBe(43)
    expect(getSuperUniqueIndexById('Ancient Barbarian 2')).toBe(44)
    expect(getSuperUniqueIndexById('Ancient Barbarian 3')).toBe(45)
    expect(getSuperUniqueByIndex(43)?.monsterId).toBe('ancientbarb1')
    expect(getSuperUniqueByIndex(44)?.monsterId).toBe('ancientbarb2')
    expect(getSuperUniqueByIndex(45)?.monsterId).toBe('ancientbarb3')
  })
})

describe('issue #1774 — non-spawn packets and partial updates never fabricate skeleton1/skeleton2', () => {
  it('drops out-of-order and post-removal monster packets without fabricating classId 0 or 1', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'GameFlags',
      difficulty: 0,
      hardcore: false,
      expansion: true,
      ladder: false,
    })

    const unseenId = 7701
    const nonSpawnEvents: ServerEvent[] = [
      {
        type: 'UnitMove',
        unitType: 1,
        id: unseenId,
        mode: 'run',
        to: { x: 120, y: 130 },
      },
      {
        type: 'UnitMode',
        unitType: 1,
        id: unseenId,
        mode: 4,
        lifePct: 120,
      },
      {
        type: 'UnitReassign',
        unitType: 1,
        id: unseenId,
        at: { x: 122, y: 132 },
        snap: true,
      },
      {
        type: 'StatSet',
        unit: { unitType: 1, id: unseenId },
        stat: 6,
        value: 500,
      },
      {
        type: 'StateSet',
        unit: { unitType: 1, id: unseenId },
        state: 138, // Shout
      },
      {
        type: 'StateSkillEffect',
        unit: { unitType: 1, id: unseenId },
        skillId: 138,
      },
      {
        type: 'StateEnd',
        unit: { unitType: 1, id: unseenId },
        state: 138,
      },
      {
        type: 'NpcState',
        unitId: unseenId,
        state: 1,
        x: 120,
        y: 130,
        lifePct: 100,
      } as unknown as ServerEvent,
      {
        type: 'Npc',
        kind: 'assign',
        npcId: unseenId,
        x: 120,
        y: 130,
      } as unknown as ServerEvent,
    ]

    for (const ev of nonSpawnEvents) {
      world.applyEvent(ev)
      expect(world.getUnit('monster', unseenId)).toBeUndefined()
    }

    // Spawn Talic (540), remove via 0x0A UnitRemove, then replay late combat/state packets:
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: unseenId,
        classId: 540,
        x: 100,
        y: 100,
        mode: 1,
        lifePct: 128,
        flags: 0x02,
        isSuperUnique: true,
        superUniqueId: 43,
      },
    } as ServerEvent)
    expect(world.getUnit('monster', unseenId)?.classId).toBe(540)

    world.applyEvent({
      type: 'UnitRemove',
      unitType: 1,
      id: unseenId,
      unitId: unseenId,
    } as ServerEvent)
    expect(world.getUnit('monster', unseenId)).toBeUndefined()

    for (const ev of nonSpawnEvents) {
      world.applyEvent(ev)
      expect(world.getUnit('monster', unseenId)).toBeUndefined()
    }
  })

  it('preserves existing Ancient classId when partial EntitySpawn / AssignNpc / UnitAssign omits classId', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 8801,
        classId: 540,
        x: 200,
        y: 210,
        mode: 1,
        lifePct: 128,
        flags: 0x02,
        isSuperUnique: true,
        superUniqueId: 43,
      },
    } as ServerEvent)

    world.applyEvent({
      type: 'EntitySpawn',
      unitType: 1,
      unitId: 8801,
      x: 202,
      y: 212,
      lifePct: 100,
    } as unknown as ServerEvent)
    expect(world.getUnit('monster', 8801)?.classId).toBe(540)

    world.applyEvent({
      type: 'AssignNpc',
      unitId: 8801,
      x: 204,
      y: 214,
      lifePct: 96,
    } as unknown as ServerEvent)
    expect(world.getUnit('monster', 8801)?.classId).toBe(540)

    const targetInfo = clientUnitToMonsterTargetInfo(world.getUnit('monster', 8801)!, 0)
    expect(targetInfo.hcIdx).toBe(540)
    expect(targetInfo.rank).toBe('superunique')
    expect(targetInfo.resistances?.poison).toBe(70)
  })
})

describe('issue #1774 — unitId reuse & 0xAC AssignNPC wire round-trip', () => {
  it('replaces stale skeleton/unique/pet state on 0xAC AssignNPC reuse without leaking classId, bossMods, or pet ownership', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'GameFlags',
      difficulty: 0,
      hardcore: false,
      expansion: true,
      ladder: false,
    })

    // 1) unitId 9001 starts as a Unique skeleton1 (classId 0) with Poison Enchanted (mod 29) & nameSeed:
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 9001,
        classId: 0,
        x: 50,
        y: 50,
        mode: 1,
        lifePct: 128,
        flags: 0x08,
        isUnique: true,
        bossMods: [29, 8],
        nameSeed: 0x4321,
      },
    } as ServerEvent)
    world.applyEvent({
      type: 'StateSet',
      unit: { unitType: 1, id: 9001 },
      state: 2,
    })
    expect(world.getUnit('monster', 9001)?.classId).toBe(0)

    // Also register unitId 9001 in world.pets as a Necromancer skeleton (363) to verify pet table eviction:
    world.applyEvent({
      type: 'Merc',
      kind: 'assign',
      isSummonAction: true,
      summonAction: 1,
      petType: 3,
      mercId: 9001,
      ownerId: 1,
      classId: 363,
    } as ServerEvent)
    expect(world.pets.has(9001)).toBe(true)

    // 2) Encode an authoritative Ancient (Talic 540, SuperUnique 43) UnitAssign through 0xAC wire packets and decode back:
    const assignTalicEvent: ServerEvent = {
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 9001,
        classId: 540,
        x: 150,
        y: 160,
        mode: 1,
        lifePct: 128,
        flags: 0x02,
        isSuperUnique: true,
        superUniqueId: 43,
      },
    }
    const wirePkts = serverEventToS2cPackets(assignTalicEvent)
    expect(wirePkts).toHaveLength(1)
    expect(wirePkts[0]![0]).toBe(0xac)

    const decoded = decodeD2gsS2cPacket(wirePkts[0]!)
    world.applyEvent(decoded)

    const unit = world.getUnit('monster', 9001)!
    expect(unit).toBeDefined()
    expect(unit.classId).toBe(540)
    expect(unit.isSuperUnique).toBe(true)
    expect(unit.superUniqueId).toBe(43)
    expect(Boolean(unit.isUnique)).toBe(false)
    expect(unit.bossMods).toBeUndefined()
    expect(unit.nameSeed).not.toBe(0x4321)
    expect(unit.states.has(2)).toBe(false)
    expect(world.pets.has(9001)).toBe(false)

    const hudInfo = clientUnitToMonsterTargetInfo(unit, world.difficulty)
    expect(hudInfo.hcIdx).toBe(540)
    expect(hudInfo.rank).toBe('superunique')
    expect(hudInfo.name).toBe('Talic')
    expect(hudInfo.resistances?.poison).toBe(70)
  })
})

describe('issue #1774 — world.difficulty synchronization on GameLogonAck & GameFlags', () => {
  it('resets stale Nightmare/Hell difficulty to Normal (0) when entering a Normal GameInstance', () => {
    const world = new ClientWorld()
    // Simulate previous Nightmare/Hell session leaving world.difficulty = 2:
    world.applyEvent({
      type: 'GameFlags',
      difficulty: 2,
      hardcore: false,
      expansion: true,
      ladder: false,
    })
    expect(world.difficulty).toBe(2)

    // GameLogonAck alone updates difficulty:
    world.applyEvent({
      type: 'GameLogonAck',
      playerUnitId: 1,
      mapSeed: 1234,
      difficulty: 0,
    })
    expect(world.difficulty).toBe(0)

    // And GameInstance.connectPlayer emits both GameLogonAck and GameFlags (0x01 wire round-trip):
    world.applyEvent({
      type: 'GameFlags',
      difficulty: 1,
      hardcore: false,
      expansion: true,
      ladder: false,
    })
    expect(world.difficulty).toBe(1)

    const game = new GameInstance({ seed: 177401, difficulty: 0, areaId: 120 })
    const pid = game.connectPlayer({ charClass: 'bar', name: 'Conan', x: 50, y: 50, areaId: 120, level: 35 })
    const connectEvents = game.drainEvents(pid)
    expect(connectEvents.some((e) => e.type === 'GameFlags')).toBe(true)

    for (const ev of connectEvents) {
      for (const pkt of serverEventToS2cPackets(ev)) {
        if (pkt[0] === 0x04) continue
        world.applyEvent(decodeD2gsS2cPacket(pkt))
      }
    }
    expect(world.difficulty).toBe(0)
  })
})

describe('issue #1774 — Arreat Summit (areaId 120) Ancients AOI re-entry, Town Portal reset & WSK gate', () => {
  it('preserves Ancient classId across RoomHost AOI exit/re-entry, resets statues on Town Portal, and unlocks Gate 547 on victory', () => {
    const host = new MultiClientRoomHost({
      seed: 177402,
      difficulty: 0,
      act: 5,
      areaId: 120,
      aoiRadius: 20,
    })
    const game = host.gameInstance
    const [clientStream, serverStream] = createMemoryStreamPair()
    const framer = new TsFramer<ServerEvent>()
    const world = new ClientWorld()
    // Pre-seed stale Hell difficulty on ClientWorld to prove connect resets it to Normal (0):
    world.applyEvent({
      type: 'GameFlags',
      difficulty: 2,
      hardcore: false,
      expansion: true,
      ladder: false,
    })

    const receivedEvents: ServerEvent[] = []
    clientStream.onMessage((chunk) => {
      for (const ev of framer.push(chunk)) {
        receivedEvents.push(ev)
        world.applyEvent(ev)
      }
    })

    const playerId = host.connectClient(serverStream, {
      protocol: 'ts',
      charClass: 'bar',
      name: 'SummitHero',
      x: 100,
      y: 100,
      areaId: 120,
      level: 35,
    })

    // Spawn Arreat Summit statues (475 Talic, 476 Madawc, 474 Korlic), Altar (546), and WSK Gate (547):
    const statueTalic = game.spawnObject({ classId: 475, x: 102, y: 98, areaId: 120 })
    const statueMadawc = game.spawnObject({ classId: 476, x: 104, y: 100, areaId: 120 })
    const statueKorlic = game.spawnObject({ classId: 474, x: 102, y: 102, areaId: 120 })
    const altarId = game.spawnObject({ classId: 546, x: 101, y: 100, areaId: 120 })
    const gateId = game.spawnObject({ classId: 547, x: 99, y: 100, areaId: 120 })

    host.stepFrames(2)
    expect(world.difficulty).toBe(0)

    const objectsMap = (game as unknown as {
      objects: Map<number, { classId: number; mode: number }>
      monsters: Map<number, { unitId: number; classId: number; superUniqueId?: string; umodIds: number[]; x: number; y: number }>
      players: Map<number, { x: number; y: number; items: unknown[]; questFlags: Uint16Array }>
    })

    // 1) Before completing a5q5, Worldstone Keep Gate (547) refuses to open and emits reject sound 19:
    receivedEvents.length = 0
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: gateId })
    host.stepFrames(2)
    expect(objectsMap.objects.get(gateId)?.mode).toBe(0)
    expect(
      receivedEvents.some(
        (e) => e.type === 'PlaySound' && (e as { sound?: number }).sound === 19,
      ),
    ).toBe(true)

    // 2) Operate Ancients Altar (546): Altar -> mode 2, Statues -> mode 4, Ancients 540/541/542 spawn with 0 random mods in Normal:
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: altarId })
    host.stepFrames(2)

    expect(objectsMap.objects.get(altarId)?.mode).toBe(2)
    expect(objectsMap.objects.get(statueTalic)?.mode).toBe(4)
    expect(objectsMap.objects.get(statueMadawc)?.mode).toBe(4)
    expect(objectsMap.objects.get(statueKorlic)?.mode).toBe(4)

    const spawnedAncients = [...objectsMap.monsters.values()].filter((m) =>
      m.superUniqueId?.startsWith('Ancient Barbarian'),
    )
    expect(spawnedAncients).toHaveLength(3)
    for (const m of spawnedAncients) {
      expect(m.umodIds).toHaveLength(0)
      const clientUnit = world.getUnit('monster', m.unitId)!
      expect(clientUnit).toBeDefined()
      expect(clientUnit.classId).toBe(m.classId)
      expect([540, 541, 542]).toContain(clientUnit.classId)
    }

    const madawcSrv = spawnedAncients.find((m) => m.classId === 541)!
    const talicSrv = spawnedAncients.find((m) => m.classId === 540)!
    expect(clientUnitToMonsterTargetInfo(world.getUnit('monster', madawcSrv.unitId)!, world.difficulty)).toMatchObject({
      hcIdx: 541,
      name: 'Madawc',
      rank: 'superunique',
    })
    expect(
      clientUnitToMonsterTargetInfo(world.getUnit('monster', madawcSrv.unitId)!, world.difficulty).resistances?.poison,
    ).toBe(0)
    expect(
      clientUnitToMonsterTargetInfo(world.getUnit('monster', talicSrv.unitId)!, world.difficulty).resistances?.poison,
    ).toBe(70)

    // 3) AOI Exit -> UnitRemove, followed by AOI Re-Entry -> authoritative UnitAssign before movement/state:
    const srvPlayer = objectsMap.players.get(playerId)!
    srvPlayer.x = 200
    srvPlayer.y = 200
    // Trigger a spatial broadcast from Madawc outside AOI (dist > 20) so RoomHost culls Madawc with UnitRemove:
    ;(game as unknown as { broadcastToArea: (area: number, ev: ServerEvent) => void }).broadcastToArea(120, {
      type: 'UnitMove',
      unitType: 1,
      id: madawcSrv.unitId,
      mode: 'run',
      x: madawcSrv.x,
      y: madawcSrv.y,
      to: { x: madawcSrv.x, y: madawcSrv.y },
    })
    host.stepFrames(1)
    expect(world.getUnit('monster', madawcSrv.unitId)).toBeUndefined()

    // Move player back into AOI range and broadcast Madawc movement + Shout StateSet:
    srvPlayer.x = 100
    srvPlayer.y = 100
    receivedEvents.length = 0
    ;(game as unknown as { broadcastToArea: (area: number, ev: ServerEvent) => void }).broadcastToArea(120, {
      type: 'UnitMove',
      unitType: 1,
      id: madawcSrv.unitId,
      mode: 'run',
      x: madawcSrv.x + 1,
      y: madawcSrv.y,
      to: { x: madawcSrv.x + 1, y: madawcSrv.y },
    })
    ;(game as unknown as { broadcastToArea: (area: number, ev: ServerEvent) => void }).broadcastToArea(120, {
      type: 'StateSet',
      unit: { unitType: 1, id: madawcSrv.unitId },
      state: 138,
    })
    host.stepFrames(1)

    const reEnteredMadawc = world.getUnit('monster', madawcSrv.unitId)!
    expect(reEnteredMadawc).toBeDefined()
    expect(reEnteredMadawc.classId).toBe(541)
    expect(reEnteredMadawc.isSuperUnique).toBe(true)
    expect(reEnteredMadawc.superUniqueId).toBe(44)
    const reEnteredHud = clientUnitToMonsterTargetInfo(reEnteredMadawc, world.difficulty)
    expect(reEnteredHud.name).toBe('Madawc')
    expect(reEnteredHud.resistances?.poison).toBe(0)

    // 4) Town Portal mid-fight on areaId 120 re-petrifies all Ancients and resets Altar + Statues to mode 0:
    srvPlayer.items.push({
      unitId: 9901,
      code: 'tsc',
      name: 'Scroll of Town Portal',
      quality: 2,
      level: 1,
      location: 'inventory',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      areaId: 120,
      ownerId: playerId,
      bodyLoc: 0,
      storePage: 0,
      cost: 0,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 0,
      maxDurability: 0,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    })
    game.enqueueCommand(playerId, { type: 'TownPortal' })
    host.stepFrames(2)

    expect(
      [...objectsMap.monsters.values()].filter((m) => m.superUniqueId?.startsWith('Ancient Barbarian')),
    ).toHaveLength(0)
    expect(world.getUnit('monster', madawcSrv.unitId)).toBeUndefined()
    expect(objectsMap.objects.get(altarId)?.mode).toBe(0)
    expect(objectsMap.objects.get(statueTalic)?.mode).toBe(0)
    expect(objectsMap.objects.get(statueMadawc)?.mode).toBe(0)
    expect(objectsMap.objects.get(statueKorlic)?.mode).toBe(0)

    // 5) Re-activate Altar (546), defeat all 3 Ancients -> statues mode 2, a5q5 completed, Gate 547 opens:
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: altarId })
    host.stepFrames(2)
    const respawned = [...objectsMap.monsters.values()].filter((m) =>
      m.superUniqueId?.startsWith('Ancient Barbarian'),
    )
    expect(respawned).toHaveLength(3)
    for (const m of respawned) {
      game.applyDamageToMonster(m.unitId, 1_000_000, playerId)
    }
    host.stepFrames(2)

    expect(srvPlayer.questFlags[questWordIndex113c('a5q5')!]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
    expect(objectsMap.objects.get(statueTalic)?.mode).toBe(2)
    expect(objectsMap.objects.get(statueMadawc)?.mode).toBe(2)
    expect(objectsMap.objects.get(statueKorlic)?.mode).toBe(2)

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: gateId })
    host.stepFrames(80)
    expect(objectsMap.objects.get(gateId)?.mode).toBe(2)
  })

  it('rolls 2 random boss modifiers on Hell difficulty Ancients and emits pet monster hcIdx in 0x7A summon events', () => {
    const hellGame = new GameInstance({ seed: 177403, difficulty: 2, areaId: 120 })
    const pid = hellGame.connectPlayer({
      charClass: 'nec',
      name: 'NecroHero',
      x: 50,
      y: 50,
      areaId: 120,
      level: 80,
    })
    const altar = hellGame.spawnObject({ classId: 546, x: 51, y: 50, areaId: 120 })
    hellGame.enqueueCommand(pid, { type: 'OperateObject', objectId: altar })
    hellGame.stepFrames(1)

    const monsters = [
      ...(hellGame as unknown as {
        monsters: Map<number, { superUniqueId?: string; umodIds: number[] }>
      }).monsters.values(),
    ].filter((m) => m.superUniqueId?.startsWith('Ancient Barbarian'))
    expect(monsters).toHaveLength(3)
    for (const m of monsters) {
      expect(m.umodIds.length).toBeGreaterThanOrEqual(2)
    }

    // Verify summonPet emits pet monster hcIdx (Clay Golem = 289, skillId = 75) in Merc { isSummonAction: true }:
    hellGame.drainEvents(pid)
    const outcome = hellGame.summonPet(pid, { skillId: 75, slvl: 5, x: 52, y: 50 })
    expect(outcome.created).toBe(true)
    const summonEvents = hellGame.drainEvents(pid)
    const mercAssign = summonEvents.find(
      (e) => e.type === 'Merc' && (e as { isSummonAction?: boolean }).isSummonAction === true,
    ) as { classId?: number; summonAction?: number; mercId?: number } | undefined
    expect(mercAssign).toBeDefined()
    expect(mercAssign?.summonAction).toBe(1)
    expect(mercAssign?.classId).toBe(289) // claygolem hcIdx 289, NOT skillId 75

    hellGame.unsummonPetAt(pid, outcome.pet!.x, outcome.pet!.y)
    const unsummonEvents = hellGame.drainEvents(pid)
    const mercRemove = unsummonEvents.find(
      (e) => e.type === 'Merc' && (e as { isSummonAction?: boolean }).isSummonAction === true,
    ) as { classId?: number; summonAction?: number } | undefined
    expect(mercRemove).toBeDefined()
    expect(mercRemove?.summonAction).toBe(0)
    expect(mercRemove?.classId).toBe(289)
  })

  it('includes 16-bit nameSeed on in-memory UnitAssign snapshots for SuperUnique, Unique, and Champion monsters without noUniqueShift', () => {
    const game = new GameInstance({ seed: 177404, difficulty: 0, areaId: 114 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'RiverTester',
      x: 80,
      y: 80,
      areaId: 114,
      level: 40,
    })
    const world = new ClientWorld()
    for (const ev of game.drainEvents(pid)) {
      world.applyEvent(ev)
    }

    // Frozenstein (`hcIdx 449`, SuperUnique `"Frozenstein"`, `noUniqueShift = 0`) + random Unique + Champion:
    const frozensteinId = game.spawnMonster({
      classId: 449,
      superUniqueId: 'Frozenstein',
      rank: 'superunique',
      x: 82,
      y: 80,
      areaId: 114,
    })
    const uniqueSkeletonId = game.spawnMonster({
      classId: 0,
      rank: 'unique',
      umodIds: [5, 18],
      nameSeed: 0x1234,
      x: 84,
      y: 80,
      areaId: 114,
    })
    const championSkeletonId = game.spawnMonster({
      classId: 0,
      rank: 'champion',
      umodIds: [16],
      x: 86,
      y: 80,
      areaId: 114,
    })

    // Apply raw LocalLoopbackAdapter ServerEvents directly without 0xAC wire re-encode:
    for (const ev of game.drainEvents(pid)) {
      expect(() => world.applyEvent(ev)).not.toThrow()
    }

    const frozenstein = world.getUnit('monster', frozensteinId)!
    expect(frozenstein.classId).toBe(449)
    expect(frozenstein.isSuperUnique).toBe(true)
    expect(frozenstein.nameSeed).toBe(0)
    expect(frozenstein.paletteIndex).toBeGreaterThanOrEqual(2)

    const uniqueSkel = world.getUnit('monster', uniqueSkeletonId)!
    expect(uniqueSkel.classId).toBe(0)
    expect(uniqueSkel.isUnique).toBe(true)
    expect(uniqueSkel.nameSeed).toBe(0x1234)
    expect(uniqueSkel.paletteIndex).toBeGreaterThanOrEqual(8)

    const champSkel = world.getUnit('monster', championSkeletonId)!
    expect(champSkel.classId).toBe(0)
    expect(champSkel.isChampion).toBe(true)
    expect(typeof champSkel.nameSeed).toBe('number')
    expect(champSkel.paletteIndex).toBeGreaterThanOrEqual(8)
  })
})

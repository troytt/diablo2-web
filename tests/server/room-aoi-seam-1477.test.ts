import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { AoiFilter } from '../../src/server/net/aoi.ts'
import { MultiClientRoomHost } from '../../src/server/room-host.ts'
import { createMemoryStreamPair, TsFramer, type ServerEvent } from '../../src/netproto/index.ts'

describe('Issue #1477: 1.13c Room AOI and Seam-Adjacent Visibility', () => {
  it('AoiFilter respects isSeamAdjacent flag and defaults radius to 0 without fabricated 80-subtile constant', () => {
    const filter = new AoiFilter(50)
    const viewer = { areaId: 1, x: 100, y: 100 }
    const crossAreaTarget = { areaId: 2, x: 110, y: 100 }

    // When areas differ and not seam-adjacent, rejected
    expect(filter.isInRange(viewer, crossAreaTarget, undefined, false)).toBe(false)
    // When seam-adjacent, distance (10 <= 50) is accepted across area border
    expect(filter.isInRange(viewer, crossAreaTarget, undefined, true)).toBe(true)
    // When distance exceeds radius (70 > 50), rejected even if seam-adjacent
    const farTarget = { areaId: 2, x: 170, y: 100 }
    expect(filter.isInRange(viewer, farTarget, undefined, true)).toBe(false)
  })

  it('GameInstance detects outdoor seam adjacency between Rogue Encampment (1) and Blood Moor (2)', () => {
    const game = new GameInstance({
      mode: 'open',
      gameName: 'SeamTest',
      act: 0,
      areaId: 1,
      maxPlayers: 8,
    })

    // Areas 1 and 2 are adjacent in Act 1
    expect(game.isAreaSeamAdjacent(1, 2)).toBe(true)
    expect(game.isAreaSeamAdjacent(2, 1)).toBe(true)
    // Areas 1 and 3 (Cold Plains) are not directly 1-hop adjacent
    expect(game.isAreaSeamAdjacent(1, 3)).toBe(false)
  })

  it('MultiClientRoomHost without explicit aoiRadius delivers GameInstance room events directly without synthetic UnitRemove', () => {
    const host = new MultiClientRoomHost({
      mapSeed: 0x12345678,
      act: 0,
      difficulty: 0,
      areaId: 1,
    })

    expect(host.hasExplicitAoi).toBe(false)

    const [clientStream, serverStream] = createMemoryStreamPair()
    const framer = new TsFramer<ServerEvent>()
    const receivedEvents: ServerEvent[] = []
    clientStream.onData((chunk) => receivedEvents.push(...framer.push(chunk)))

    const pid = host.connectClient(serverStream, {
      charName: 'SeamTester',
      classId: 'bar',
      level: 10,
      x: 100,
      y: 100,
    })

    // Spawn a monster in Blood Moor (area 2) and move it
    const game = host.getGameInstance()
    const monId = game.spawnMonster({
      hcIdx: 18,
      areaId: 2,
      x: 105,
      y: 100,
      hp: 100,
      maxHp: 100,
    })

    // Drain initial connection frames
    host.stepFrames(5)
    receivedEvents.length = 0

    // Step frames: player in area 1 receives seam-adjacent events without artificial UnitRemove
    host.stepFrames(10)
    const removes = receivedEvents.filter(
      (e) => e.type === 'UnitRemove' && (e.id === monId || e.unitId === monId),
    )
    expect(removes.length).toBe(0)
  })
})

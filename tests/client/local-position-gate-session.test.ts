/**
 * Local player server positions in `OnlineSession` (D2Client 1.13c).
 *
 * `0x18` / `0x95` / `0x96` (LifeMana with a position) and a `0x0D` stop of the local player go
 * through the position gate 0x6FADA1B0: the player is never moved toward them, and when the
 * drift is out of tolerance the client sends C2S `0x5F` with its own sub-tile. `0x15` moves the
 * player directly. A `.d2cap` replay has no server to answer `0x5F`, so it takes the captured
 * positions as they are.
 */

import { describe, expect, it } from 'vitest'
import type { MapService } from '../../src/client/map/map-service.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'
import { formatD2CapHeader, type ClientCommand, type ServerEvent } from '../../src/netproto/index.ts'

const ROGUE_ENCAMPMENT = 1
const BLOOD_MOOR = 2

/** A map service whose only loaded level is `areaId`, covering every sub-tile (or none). */
function stubMapService(areaId: number | null): MapService {
  return {
    onLoadActPacket: () => null,
    onAddRoomDataPacket: () => null,
    onRemoveRoomDataPacket: () => null,
    getActiveLevelView: () => null,
    getTileAtlas: () => null,
    findLevelViewAtWorldSubTile: (_x: number, _y: number, areaIds: Iterable<number>) =>
      areaId !== null && [...areaIds].includes(areaId) ? { areaId } : null,
  } as unknown as MapService
}

/** A session with the local player (id 1) assigned at (5000, 5000) in `areaId`. */
function sessionInLevel(areaId: number, loadedLevel: number | null = areaId): OnlineSession {
  const session = new OnlineSession({
    settingsStore: createSettingsStore(),
    mapService: stubMapService(loadedLevel),
  })
  session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId })
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: { unitType: 'player', id: 1, classId: 1, name: 'gate', x: 5000, y: 5000 },
    isSelf: true,
  })
  return session
}

function lifeMana(x: number, y: number, vx = 0, vy = 0): ServerEvent {
  return { type: 'LifeMana', life: 100, mana: 100, stamina: 100, at: { x, y }, vx, vy }
}

function resyncRequests(session: OnlineSession): ClientCommand[] {
  return session.getSentCommands().filter(cmd => cmd.type === 'UpdatePlayerPos')
}

describe('OnlineSession local player position gate (D2Client 0x6FADA1B0)', () => {
  it('asks for a resync with its own sub-tile when a 0x95 position is out of tolerance', () => {
    const session = sessionInLevel(BLOOD_MOOR)
    session.handleServerEvent(lifeMana(5003, 5000)) // NU tolerance 3
    expect(resyncRequests(session)).toEqual([])

    session.handleServerEvent(lifeMana(5004, 5000))
    expect(resyncRequests(session)).toEqual([{ type: 'UpdatePlayerPos', x: 5000, y: 5000 }])
    expect(session.predictor.getSnapshot()).toMatchObject({ logicalX: 5000, logicalY: 5000 })
  })

  it('uses the town standing tolerance (TN 5) in a town level', () => {
    const session = sessionInLevel(ROGUE_ENCAMPMENT)
    session.handleServerEvent(lifeMana(5005, 4995))
    expect(resyncRequests(session)).toEqual([])
    session.handleServerEvent(lifeMana(5006, 5000))
    expect(resyncRequests(session)).toEqual([{ type: 'UpdatePlayerPos', x: 5000, y: 5000 }])
  })

  it('widens the tolerance by the 0x8F round trip: (rtt + 50) >> 7', () => {
    const session = sessionInLevel(BLOOD_MOOR)
    session.handleServerEvent({ type: 'Pong', rttMs: 78, tickCount: 0 })
    session.handleServerEvent(lifeMana(5004, 5000)) // 3 + 1
    expect(resyncRequests(session)).toEqual([])
    session.handleServerEvent(lifeMana(5005, 5000))
    expect(resyncRequests(session)).toHaveLength(1)
  })

  it('does not ask while the client leads the server along its motion vector', () => {
    const session = sessionInLevel(BLOOD_MOOR)
    // The server is 5 sub-tiles behind but heading toward the client.
    session.handleServerEvent(lifeMana(4995, 5000, 3, 0))
    expect(resyncRequests(session)).toEqual([])
    session.handleServerEvent(lifeMana(4995, 5000, -3, 0))
    expect(resyncRequests(session)).toHaveLength(1)
  })

  it('checks a 0x0D stop of the local player with the flag-1 tolerance of 10', () => {
    const session = sessionInLevel(BLOOD_MOOR)
    const stop = (x: number): ServerEvent => ({
      type: 'UnitMove',
      unitType: 'player',
      id: 1,
      mode: 'stop',
      to: { x, y: 5000 },
    })
    session.handleServerEvent(stop(5010))
    expect(resyncRequests(session)).toEqual([])
    session.handleServerEvent(stop(5011))
    expect(resyncRequests(session)).toEqual([{ type: 'UpdatePlayerPos', x: 5000, y: 5000 }])
    expect(session.predictor.getSnapshot().logicalX).toBe(5000)
  })

  it('skips the check while no loaded level contains the player', () => {
    const session = sessionInLevel(BLOOD_MOOR, null)
    session.handleServerEvent(lifeMana(5100, 5100))
    expect(resyncRequests(session)).toEqual([])
    expect(session.predictor.getSnapshot()).toMatchObject({ logicalX: 5000, logicalY: 5000 })
  })

  it('fails fast on a LifeMana position without its motion vector', () => {
    const session = sessionInLevel(BLOOD_MOOR)
    expect(() =>
      session.handleServerEvent({ type: 'LifeMana', life: 1, mana: 1, stamina: 1, at: { x: 5004, y: 5000 } }),
    ).toThrow(/vx\/vy/)
  })

  it('moves the player directly on 0x15 and keeps its facing', () => {
    const session = sessionInLevel(BLOOD_MOOR)
    session.predictor.setDirection(40)
    session.handleServerEvent({
      type: 'UnitReassign',
      unitType: 'player',
      id: 1,
      at: { x: 5100, y: 5120 },
      snap: false,
    })
    expect(session.predictor.getSnapshot()).toMatchObject({ logicalX: 5100, logicalY: 5120, dir64: 40 })
    expect(resyncRequests(session)).toEqual([])
  })

  it('follows captured positions in a .d2cap replay, which has no server to answer 0x5F', () => {
    const session = new OnlineSession({
      settingsStore: createSettingsStore(),
      mapService: stubMapService(BLOOD_MOOR),
    })
    session.loadD2CapReplay(
      formatD2CapHeader({
        format: 'd2cap-v1',
        createdAt: '2026-10-02T00:00:00Z',
        server: '127.0.0.1',
        account: 'gate',
        character: 'gate',
      }),
    )
    expect(session.phase).toBe('replay')
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: BLOOD_MOOR })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 'player', id: 1, classId: 1, name: 'gate', x: 5000, y: 5000 },
      isSelf: true,
    })
    session.handleServerEvent(lifeMana(5040, 5010, 4, 1))
    expect(session.predictor.getSnapshot()).toMatchObject({ logicalX: 5040, logicalY: 5010 })
    expect(resyncRequests(session)).toEqual([])
  })
})

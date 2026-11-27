/**
 * OnlineSession wiring of the 1.13c quest special ambient lights (#826, `QuestFxLight`): S2C 0x5E and
 * 0x89 (D2Client 0x6fb5c090 / 0x6fb5bfa0), the state set-function dispatch 0x6fb22530 of S2C 0xA8 /
 * 0xAA for units the client knows, the quest-FX tick of the 25 Hz frame (0x6fb03720 @0x6faf4ab1) and
 * the room ambient of the lighting pass (`CLIENT_GetAmbientLight` with the special lights, prefill
 * 0x6fb59c90: the player room and its near rooms).
 *
 * Den intensities: tests/fixtures/lighting/quest-fx-826-vectors.txt (DEN, t = 1 → 79, t = 29 → 4).
 */

import { describe, expect, it } from 'vitest'
import type { LevelView } from '../../src/client/map/level-view.ts'
import type { MapService } from '../../src/client/map/map-service.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { resolveLevelAmbient, type AmbientLight } from '../../src/common/world/ambient-light.ts'
import { packet0xA7, packet0xA8, packet0xAA, type StatPair } from '../fixtures/lighting/state-packets.ts'

const SELF_ID = 1
const STONY_FIELD = 4
const DEN_OF_EVIL = 8
const RIVER_OF_FLAME = 107
const CLOAK_OF_SHADOWS = 153
/** objects.txt Id 17 `StoneAlpha`. */
const STONE_ALPHA = 17
const PLAYER_X = 5000
const PLAYER_Y = 5000

interface Rect {
  readonly worldSubX: number
  readonly worldSubY: number
  readonly subW: number
  readonly subH: number
}

/** The local player's room, its one revealed near room, and a room of the level that is not near it. */
const PLAYER_ROOM: Rect = { worldSubX: 4960, worldSubY: 4960, subW: 80, subH: 80 }
const NEAR_ROOM: Rect = { worldSubX: 5040, worldSubY: 4960, subW: 80, subH: 80 }
const FAR_ROOM: Rect = { worldSubX: 5200, worldSubY: 4960, subW: 80, subH: 80 }

function inside(room: Rect, x: number, y: number): boolean {
  return x >= room.worldSubX && x < room.worldSubX + room.subW && y >= room.worldSubY && y < room.worldSubY + room.subH
}

/**
 * A level of three rooms, served by a MapService stub: `findLevelViewAtWorldSubTile` finds it under any
 * of its rooms and `getRevealedNearRooms` throws like MapWorkerEngine when the sub-tile is not in the
 * player's room (the only room whose near rooms the stub knows).
 */
function stubLevel(levelId: number, act: number): { readonly mapService: MapService; readonly view: LevelView } {
  const rooms = [PLAYER_ROOM, NEAR_ROOM, FAR_ROOM].map(room => ({ ...room, areaId: levelId, revealed: true }))
  const view = {
    act,
    areaId: levelId,
    subOriginX: 4900,
    subOriginY: 4900,
    subWidth: 400,
    subHeight: 200,
    isoOriginX: 0,
    isoOriginY: 0,
    cellsX: 80,
    cellsY: 40,
    gridWidth: 400,
    blocked: new Uint8Array(400 * 200),
    collisionMasks: new Uint16Array(400 * 200),
    rooms,
    floors: [],
    shadows: [],
    walls: [],
    roofs: [],
    warps: [],
  } as unknown as LevelView
  const mapService = {
    onLoadActPacket: () => null,
    onAddRoomDataPacket: () => null,
    onRemoveRoomDataPacket: () => null,
    getActiveLevelView: () => null,
    getTileAtlas: () => null,
    findLevelViewAtWorldSubTile: (x: number, y: number, areaIds: Iterable<number>) =>
      [...areaIds].includes(levelId) && rooms.some(room => inside(room, Math.floor(x), Math.floor(y))) ? view : null,
    getRevealedNearRooms: (areaId: number, x: number, y: number) => {
      if (areaId !== levelId || !inside(PLAYER_ROOM, Math.floor(x), Math.floor(y))) {
        throw new Error(`stub: level ${String(areaId)} has no room at (${String(x)}, ${String(y)})`)
      }
      return [rooms[1]]
    },
  } as unknown as MapService
  return { mapService, view }
}

/** A session after 0x03 LoadAct whose local player stands in PLAYER_ROOM of level `levelId` (act 0-based). */
function sessionIn(levelId: number, act = 0): OnlineSession {
  const { mapService, view } = stubLevel(levelId, act)
  const session = new OnlineSession({
    settingsStore: createSettingsStore({ storage: null, syncGlobalLang: false }),
    mapService,
    weatherRng: new D2Rng(1, 0x5eed),
  })
  session.handleServerEvent({ type: 'LoadAct', act, mapSeed: 0x1234, areaId: levelId })
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: { unitType: 'player', id: SELF_ID, classId: 6, name: 'fx', x: PLAYER_X, y: PLAYER_Y },
    isSelf: true,
  })
  session.predictor.setPosition(PLAYER_X, PLAYER_Y)
  expect(mapService.findLevelViewAtWorldSubTile(PLAYER_X, PLAYER_Y, [levelId])).toBe(view)
  return session
}

/** S2C 0x5E: pkt[1..37] is the availability copy; pkt[2] (byte 1) is A1Q1. */
function packet0x5E(a1q1: number): Uint8Array {
  const pkt = new Uint8Array(38)
  pkt[0] = 0x5e
  pkt[2] = a1q1
  return pkt
}

function packet0x89(eventId: number): Uint8Array {
  return Uint8Array.of(0x89, eventId)
}

/** S2C 0x53 (10 bytes): u32 cycle index @1, i32 ticks @5, u8 eclipse @9. */
function packet0x53(cycleIndex: number, ticks: number): Uint8Array {
  const pkt = new Uint8Array(10)
  const view = new DataView(pkt.buffer)
  pkt[0] = 0x53
  view.setUint32(1, cycleIndex, true)
  view.setInt32(5, ticks, true)
  return pkt
}

function cloakStats(slvl: number): StatPair[] {
  return [
    [350, 264],
    [351, slvl],
  ]
}

function denLight(intensity: number): AmbientLight {
  return { intensity, red: 255, green: 64, blue: 48, source: 'den' }
}

function sceneAmbient(session: OnlineSession): { playerRoom: AmbientLight; near: AmbientLight[] } {
  const ambient = session.sceneSource.buildLightingInputs('auto').ambient
  if (!ambient) throw new Error('no scene ambient')
  return { playerRoom: ambient.playerRoom, near: ambient.nearRooms.map(room => room.ambient) }
}

describe('OnlineSession quest special lights (#826)', () => {
  it('S2C 0x5E lights the Den of Evil rooms red while A1Q1 is live; 0x89 event 0 fades them on the 25 Hz tick', () => {
    const session = sessionIn(DEN_OF_EVIL)
    session.handleS2cPacket(packet0x5E(1))
    expect(session.disconnectReason).toBeNull()
    expect(sceneAmbient(session)).toEqual({ playerRoom: denLight(80), near: [denLight(80)] })

    session.handleS2cPacket(packet0x89(0))
    expect(session.questFxLight.snapshot().denTimer).toBe(0)
    let now = 1000
    session.tick(40, (now += 40))
    expect(sceneAmbient(session).playerRoom).toEqual(denLight(79))
    for (let n = 2; n <= 29; n += 1) session.tick(40, (now += 40))
    expect(sceneAmbient(session).playerRoom).toEqual(denLight(4))
    session.tick(40, (now += 40))
    expect(session.questFxLight.snapshot().denDone).toBe(true)
    const levels: AmbientLight = { intensity: 0, red: 255, green: 255, blue: 255, source: 'levels' }
    expect(sceneAmbient(session)).toEqual({ playerRoom: levels, near: [levels] })
  })

  it('S2C 0xAA state 153 with its modifierlist stats starts the global fade for the unit room level', () => {
    const session = sessionIn(STONY_FIELD)
    session.handleS2cPacket(packet0xAA(0, SELF_ID, [{ state: 105 }, { state: CLOAK_OF_SHADOWS, stats: cloakStats(1) }]))
    expect(session.disconnectReason).toBeNull()
    expect(session.questFxLight.snapshot().fade).toMatchObject({
      active: true,
      rampIn: 5,
      hold: 120,
      rampOut: 80,
      end: 205,
      levelId: STONY_FIELD,
    })
    // The first FadeTick gives T, the player room's act-clock light sampled before #10135.
    const base = resolveLevelAmbient(STONY_FIELD, session.environment)
    session.tick(40, 1040)
    const fade: AmbientLight = { ...base, source: 'fade' }
    expect(sceneAmbient(session)).toEqual({ playerRoom: fade, near: [fade] })
  })

  it('a known monster in the level fades the light too (no local-player filter)', () => {
    const session = sessionIn(STONY_FIELD)
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 42, classId: 5, x: 5210, y: 5000 },
    })
    session.handleS2cPacket(packet0xA8(1, 42, CLOAK_OF_SHADOWS, cloakStats(20)))
    expect(session.questFxLight.snapshot().fade).toMatchObject({
      active: true,
      hold: 405,
      rampOut: 270,
      end: 680,
      levelId: STONY_FIELD,
    })
  })

  it('0xA8 dispatches only after the 0x1ff terminator; 0xA7, statless sets and unknown units never fade', () => {
    const session = sessionIn(STONY_FIELD)
    const fadeActive = (): boolean => session.questFxLight.snapshot().fade.active
    session.handleS2cPacket(packet0xA8(1, 99, CLOAK_OF_SHADOWS, cloakStats(1)))
    expect(fadeActive(), 'unit unknown to the client').toBe(false)
    session.handleS2cPacket(packet0xA7(0, SELF_ID, CLOAK_OF_SHADOWS))
    expect(fadeActive(), '0xA7').toBe(false)
    session.handleS2cPacket(packet0xAA(0, SELF_ID, [{ state: CLOAK_OF_SHADOWS }]))
    expect(fadeActive(), '0xAA without stats').toBe(false)
    session.handleS2cPacket(packet0xA8(0, SELF_ID, CLOAK_OF_SHADOWS, [...cloakStats(1), [359, 0]]))
    expect(fadeActive(), '0xA8 stat bail-out').toBe(false)
    expect(session.disconnectReason).toBeNull()
    session.handleS2cPacket(packet0xA8(0, SELF_ID, CLOAK_OF_SHADOWS, cloakStats(1)))
    expect(fadeActive()).toBe(true)
  })

  it('special quest event 1 starts the Cairn Stones fade only with a StoneAlpha in the player or a near room', () => {
    const session = sessionIn(STONY_FIELD)
    const fade = () => session.questFxLight.snapshot().fade
    const assignObject = (id: number, classId: number, x: number, y: number): void => {
      session.handleServerEvent({ type: 'UnitAssign', unit: { unitType: 'object', id, classId, x, y } })
    }
    session.handleS2cPacket(packet0x89(1))
    expect(fade().active, 'no object').toBe(false)
    assignObject(60, STONE_ALPHA + 1, PLAYER_X + 5, PLAYER_Y)
    assignObject(61, STONE_ALPHA, FAR_ROOM.worldSubX + 10, FAR_ROOM.worldSubY + 10)
    session.handleS2cPacket(packet0x89(1))
    expect(fade().active, 'StoneAlpha only in a room that is not near').toBe(false)
    assignObject(62, STONE_ALPHA, NEAR_ROOM.worldSubX + 10, NEAR_ROOM.worldSubY + 10)
    session.handleS2cPacket(packet0x89(1))
    expect(session.disconnectReason).toBeNull()
    expect(fade()).toMatchObject({ active: true, rampIn: 40, hold: 220, rampOut: 40, end: 300, levelId: STONY_FIELD })
  })

  it('S2C 0x89 events 12 and 13 switch the River of Flame red light; the flag clears 30 ticks after event 13', () => {
    const session = sessionIn(RIVER_OF_FLAME, 3)
    const levels: AmbientLight = { intensity: 120, red: 255, green: 255, blue: 255, source: 'levels' }
    const red: AmbientLight = { intensity: 160, red: 255, green: 64, blue: 48, source: 'act4' }
    expect(sceneAmbient(session).playerRoom).toEqual(levels)
    session.handleS2cPacket(packet0x89(12))
    expect(sceneAmbient(session)).toEqual({ playerRoom: red, near: [red] })
    session.handleS2cPacket(packet0x89(13))
    expect(sceneAmbient(session).playerRoom).toEqual(levels)
    let now = 1000
    for (let n = 1; n <= 29; n += 1) session.tick(40, (now += 40))
    expect(session.questFxLight.snapshot()).toMatchObject({ act4Red: true, act4RedCountdown: 29 })
    session.tick(40, (now += 40))
    expect(session.questFxLight.snapshot()).toMatchObject({ act4Red: false, act4RedCountdown: -1 })
    expect(sceneAmbient(session).playerRoom).toEqual(levels)
    expect(session.disconnectReason).toBeNull()
  })

  it('runs the quest-FX tick before #10135: the fade takes the colour the frame starts with', () => {
    const session = sessionIn(STONY_FIELD)
    // #10358 leaves the act-clock colour stale until the next #10135 (docs/environment_daynight_113c.md §7).
    session.handleS2cPacket(packet0x53(0, 0))
    session.handleS2cPacket(packet0xA8(0, SELF_ID, CLOAK_OF_SHADOWS, cloakStats(1)))
    const before = resolveLevelAmbient(STONY_FIELD, session.environment)
    session.tick(40, 1040)
    const after = resolveLevelAmbient(STONY_FIELD, session.environment)
    expect(session.disconnectReason).toBeNull()
    expect([after.red, after.green, after.blue]).not.toEqual([before.red, before.green, before.blue])
    expect(session.questFxLight.special(STONY_FIELD)).toEqual({
      intensity: before.intensity,
      red: before.red,
      green: before.green,
      blue: before.blue,
      source: 'fade',
    })
  })
})

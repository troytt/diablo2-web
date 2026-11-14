/**
 * `OnlineSession` weather wiring (D2Client 1.13c).
 *
 * A local-player S2C `0x15` reaches the weather 0x6fb31720 (call site 0x6fb58012) unless 0x6fb57e20
 * returns first: the dead flag `[unit+0xC4] & 0x10000` (0x6fb57e80) or player mode 0 / 17
 * (0x6fb57eb4). The arg is the packet byte `@0x0A`, zeroed (0x6fb57efe) when the used skill has
 * Skills.txt `warp`. The session reads all of this before `ClientWorld` applies the packet, which
 * clears the cast and revives a dead local player. Other units' `0x15` never reach the weather.
 *
 * NOT 1.13c: the `weatherOverride` client setting drives `WeatherController.setOverride`.
 */

import { describe, expect, it, vi } from 'vitest'
import type { MapService } from '../../src/client/map/map-service.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { createSettingsStore, type SettingsStore } from '../../src/client/settings/settings-store.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'

const BLOOD_MOOR = 2
const SELF_ID = 1
/** Skills.txt rows: Teleport (`warp` = 1) and Fire Bolt (`warp` = 0). */
const TELEPORT = 54
const FIRE_BOLT = 36

function stubMapService(): MapService {
  return {
    onLoadActPacket: () => null,
    onAddRoomDataPacket: () => null,
    onRemoveRoomDataPacket: () => null,
    getActiveLevelView: () => null,
    getTileAtlas: () => null,
    findLevelViewAtWorldSubTile: (_x: number, _y: number, areaIds: Iterable<number>) =>
      [...areaIds].includes(BLOOD_MOOR) ? { areaId: BLOOD_MOOR } : null,
  } as unknown as MapService
}

function newStore(): SettingsStore {
  return createSettingsStore({ storage: null, syncGlobalLang: false })
}

/** A session whose local sorceress (id 1) stands at (5000, 5000) in the Blood Moor. */
function sessionInBloodMoor(settingsStore: SettingsStore = newStore()): OnlineSession {
  const session = new OnlineSession({
    settingsStore,
    mapService: stubMapService(),
    weatherRng: new D2Rng(1, 0x5eed),
  })
  session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: BLOOD_MOOR })
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: { unitType: 'player', id: SELF_ID, classId: 1, name: 'weather', x: 5000, y: 5000 },
    isSelf: true,
  })
  return session
}

function reassign(id: number, snap: boolean, unitType: 'player' | 'monster' = 'player'): ServerEvent {
  return { type: 'UnitReassign', unitType, id, at: { x: 5040, y: 5020 }, snap }
}

function castAt(skillId: number): ServerEvent {
  return {
    type: 'SkillCast',
    caster: { unitType: 'player', id: SELF_ID },
    skill: skillId,
    level: 1,
    target: { x: 5040, y: 5020 },
  }
}

describe('OnlineSession weather on S2C 0x15 (D2Client 0x6fb57e20)', () => {
  it('passes the packet byte for the local player', () => {
    const session = sessionInBloodMoor()
    const spy = vi.spyOn(session.weather, 'onLocalReassign')
    session.handleServerEvent(reassign(SELF_ID, true))
    session.handleServerEvent(reassign(SELF_ID, false))
    expect(spy.mock.calls).toEqual([[1], [0]])
  })

  it('zeroes the arg while the used skill has Skills.txt warp', () => {
    const session = sessionInBloodMoor()
    const spy = vi.spyOn(session.weather, 'onLocalReassign')
    session.handleServerEvent(castAt(TELEPORT))
    expect(session.world.self.castState?.skillId).toBe(TELEPORT)
    session.handleServerEvent(reassign(SELF_ID, true))
    expect(spy.mock.calls).toEqual([[0]])
  })

  it('keeps the arg for a used skill without warp', () => {
    const session = sessionInBloodMoor()
    const spy = vi.spyOn(session.weather, 'onLocalReassign')
    session.handleServerEvent(castAt(FIRE_BOLT))
    expect(session.world.self.castState?.skillId).toBe(FIRE_BOLT)
    session.handleServerEvent(reassign(SELF_ID, true))
    expect(spy.mock.calls).toEqual([[1]])
  })

  it('returns before the weather call for a dead local player', () => {
    const session = sessionInBloodMoor()
    const spy = vi.spyOn(session.weather, 'onLocalReassign')
    session.handleServerEvent({ type: 'UnitMode', unitType: 'player', id: SELF_ID, mode: 0 })
    expect(session.world.isSelfDead).toBe(true)
    session.handleServerEvent(reassign(SELF_ID, true))
    expect(spy).not.toHaveBeenCalled()
  })

  it('never calls the weather for another unit', () => {
    const session = sessionInBloodMoor()
    const spy = vi.spyOn(session.weather, 'onLocalReassign')
    session.handleServerEvent(reassign(2, true))
    session.handleServerEvent(reassign(77, true, 'monster'))
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('OnlineSession weather override setting (NOT 1.13c)', () => {
  it('starts with the stored override and follows later changes', () => {
    const store = newStore()
    store.set({ weatherOverride: 'rain' })
    const session = sessionInBloodMoor(store)
    expect(session.weather.override).toBe('rain')

    store.set({ weatherOverride: 'snow' })
    expect(session.weather.override).toBe('snow')
    expect(session.weather.sim.override).toBe('snow')

    store.set({ weatherOverride: 'off' })
    expect(session.weather.override).toBe('off')
    expect(session.weather.sim.override).toBe('off')
  })
})

/** Skills.txt rows: 57 Thunder Storm (cltprgfunc1 84), 49 Lightning (none), 254 Tiger Strike (progressive). */
const THUNDER_STORM = 57
const LIGHTNING = 49
const TIGER_STRIKE = 254
const MONSTER_ID = 42

/** S2C 0xA3: `u8 flag, i16 skill, i16 level, u8 casterType, u32 casterId, u8 targetType, u32 targetId, u32 x, u32 y`. */
function packet0xA3(o: { skill: number; casterType?: number; casterId?: number; targetType?: number; targetId?: number }): Uint8Array {
  const p = new Uint8Array(24)
  const dv = new DataView(p.buffer)
  p[0] = 0xa3
  dv.setInt16(2, o.skill, true)
  dv.setInt16(4, 20, true)
  p[6] = o.casterType ?? 0
  dv.setUint32(7, o.casterId ?? SELF_ID, true)
  p[11] = o.targetType ?? 1
  dv.setUint32(12, o.targetId ?? MONSTER_ID, true)
  return p
}

function sessionWithMonster(): OnlineSession {
  const session = sessionInBloodMoor()
  session.handleServerEvent({
    type: 'UnitAssign',
    unit: { unitType: 'monster', id: MONSTER_ID, classId: 5, x: 5210, y: 5000 },
  })
  return session
}

describe('OnlineSession lightning on S2C 0xA3 (0x6fb5efb0 → 0x6fb51b10 → fn #84 ForceLightning)', () => {
  it('a Thunder Storm strike from a known caster on a known target forces the lightning', () => {
    const session = sessionWithMonster()
    const spy = vi.spyOn(session.weather, 'forceLightning')
    session.handleS2cPacket(packet0xA3({ skill: THUNDER_STORM }))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(session.weather.sim.snapshot()).toMatchObject({
      lightningEnabled: 1,
      lightningTrigger: 1,
      flashState: 0,
      thunderArmed: 0,
    })
  })

  it('any known caster counts (no local-player filter); a strike while the lightning is on changes nothing', () => {
    const session = sessionWithMonster()
    session.handleS2cPacket(packet0xA3({ skill: THUNDER_STORM, casterType: 1, casterId: MONSTER_ID, targetType: 0, targetId: SELF_ID }))
    expect(session.weather.sim.snapshot()).toMatchObject({ lightningEnabled: 1, lightningTrigger: 1 })
    // White-box: as if the driver had consumed the trigger; ForceLightning then returns early.
    ;(session.weather.sim as unknown as { lightning: { trigger: number } }).lightning.trigger = 0
    session.handleS2cPacket(packet0xA3({ skill: THUNDER_STORM }))
    expect(session.weather.sim.snapshot()).toMatchObject({ lightningEnabled: 1, lightningTrigger: 0 })
  })

  it('ignores unknown casters, other client functions, progressive skills, non-rows and unknown targets', () => {
    const session = sessionWithMonster()
    const spy = vi.spyOn(session.weather, 'forceLightning')
    for (const p of [
      packet0xA3({ skill: THUNDER_STORM, casterId: 999 }), // caster lookup fails (0x6fb5efd7)
      packet0xA3({ skill: LIGHTNING }), // cltprgfunc1 0
      packet0xA3({ skill: TIGER_STRIKE }), // progressive → 0x6fb52950
      packet0xA3({ skill: 357 }), // >= rows (0x6fb5f01d)
      packet0xA3({ skill: -1 }), // < 0 (0x6fb5f012)
      packet0xA3({ skill: THUNDER_STORM, targetId: 43 }), // no path target (port divergence, see docs)
      packet0xA3({ skill: THUNDER_STORM, targetType: 7 }), // raw type beyond 5 (UNVERIFIED lookup)
    ]) {
      session.handleS2cPacket(p)
    }
    expect(spy).not.toHaveBeenCalled()
    expect(session.weather.sim.snapshot()).toMatchObject({ lightningEnabled: 0 })
  })

  it('spawns cltmissilea thunderstorm1 at (target.x, target.y) with altitude=280, zDelta=-40/tick, Range=9 and attaches prgoverlay lightning on target (0x6fb24350)', () => {
    const session = sessionWithMonster()
    session.handleS2cPacket(packet0xA3({ skill: THUNDER_STORM }))

    const missiles = session.world.listUnits().filter((u) => u.unitType === 'missile')
    expect(missiles).toHaveLength(1)
    const bolt = missiles[0]!
    expect(bolt.missileKey).toBe('thunderstorm1')
    expect(bolt.classId).toBe(166)
    expect(bolt.x).toBe(5210)
    expect(bolt.y).toBe(5000)
    expect(bolt.vx).toBe(0)
    expect(bolt.vy).toBe(0)
    expect(bolt.altitude).toBe(280)
    expect(bolt.verticalDescentPerTick).toBe(40)
    expect(bolt.maxTicks).toBe(9)

    const target = session.world.getUnit('monster', MONSTER_ID)!
    expect(target.overlays.map((ov) => ov.token.toLowerCase())).toContain('lightning')
    expect(target.overlays.map((ov) => ov.overlayId)).toContain(1)

    // Step 7 ticks: altitude descends by 40 px/tick from 280 down to 0 without horizontal drift
    const altitudes: number[] = []
    for (let t = 0; t < 7; t++) {
      session.world.tick(40)
      altitudes.push(bolt.altitude ?? -1)
      expect(bolt.x).toBe(5210)
      expect(bolt.y).toBe(5000)
    }
    expect(altitudes).toEqual([240, 200, 160, 120, 80, 40, 0])

    // Tick 8: still alive at altitude 0; Tick 9: expires (Range = 9)
    session.world.tick(40)
    expect(session.world.listUnits().filter((u) => u.unitType === 'missile')).toHaveLength(1)
    session.world.tick(40)
    expect(session.world.listUnits().filter((u) => u.unitType === 'missile')).toHaveLength(0)
  })

  it('does not spontaneously spawn thunderstorm1 from state 38 during client ticks without S2C 0xA3', () => {
    const session = sessionWithMonster()
    const selfUnit = session.world.getUnit('player', SELF_ID)!
    selfUnit.x = 5205
    selfUnit.y = 5000
    selfUnit.states.add(38)

    for (let t = 0; t < 50; t++) {
      session.world.tick(40)
    }
    const missiles = session.world.listUnits().filter((u) => u.unitType === 'missile')
    expect(missiles).toHaveLength(0)
  })
})

/**
 * Diablo II v1.13c generic object lights (#827).
 *
 * - `src/common/world/objects-txt-113c.ts` is the reproducible output of `npm run extract:objects-txt`.
 * - SetObjectLight 0x6fad4920 and its five call sites: object init after S2C 0x51 (0x6fad564e), the EnvEffect switch
 *   (0x6fad5311 / 0x6fad538c, covered by env-effect-113c.test.ts), the client auto transition 1 → 2 of the 25 Hz
 *   animation tick 0x6fad5660 (0x6fad57c5) and S2C 0x0E event 3 on a non-door (0x6fad5af9).
 * - LightUpdate 0x6fb59b50 easing (±1 sub-tile per light-grid build, one build per new game frame, 0x6fb3b1ac).
 * - The golden vectors GV1..GV20 of the #827 spec, driven through a real OnlineSession with real S2C packets.
 *
 * Non-`Sync` objects roll their animation speed from a unit seed the port does not model (UNVERIFIED stand-in in
 * object-light.ts), so their 1 → 2 tick is checked against the 1.13c window and against the exact formula for the
 * speed the unit actually got.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readObjectsTxtRows, renderObjectsTxt } from '../../src/baker/extract/gen-objects-txt.ts'
import { getSharedMountedArchives } from '../../src/baker/mpq-archive-source.ts'
import type { PointLightInput } from '../../src/client/scene/lighting-presets.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'
import { buildSceneDrawables } from '../../src/client/view/unit-drawables.ts'
import type { ClientUnit } from '../../src/client/world/client-unit.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  OBJECT_LIGHT_MAX_RADIUS,
  easeObjectLight,
  objectLightRadius,
  objectLightRenderInput,
  objectLitForMode,
  resetObjectAnim,
  setObjectLight,
  tickObjectAnim,
  type ObjectLightUnit,
} from '../../src/client/world/object-light.ts'
import {
  SEED_InitLowSeed,
  SEED_InitSeed,
  SEED_RollLimitedRandomNumber,
  SEED_RollRandomNumber,
  type D2SeedStrc,
} from '../../src/common/rng/d2-rng.ts'
import { parseTable } from '../../src/common/world/acts.ts'
import {
  OBJECTS_TXT_113C,
  getObjectsTxtRecord113c,
  type ObjectsTxtRecord113c,
} from '../../src/common/world/objects-txt-113c.ts'
import { decode0x0ESetObjectState } from '../../src/netproto/d2gs/s2c/units.ts'

const GENERATED = readFileSync(new URL('../../src/common/world/objects-txt-113c.ts', import.meta.url), 'utf8')

/** S2C 0x51 AssignObject (14 bytes, little-endian). */
function packet0x51(id: number, classId: number, x: number, y: number, mode: number): Uint8Array {
  const pkt = new Uint8Array(14)
  const view = new DataView(pkt.buffer)
  pkt[0] = 0x51
  pkt[1] = 2
  view.setUint32(2, id, true)
  view.setUint16(6, classId, true)
  view.setUint16(8, x, true)
  view.setUint16(10, y, true)
  pkt[12] = mode
  return pkt
}

/** S2C 0x0E SetObjectState (12 bytes): `[6]` event code, `[7]` flag, `[8..11]` mode. */
function packet0x0E(id: number, eventCode: number, flag: number, mode: number): Uint8Array {
  const pkt = new Uint8Array(12)
  const view = new DataView(pkt.buffer)
  pkt[0] = 0x0e
  pkt[1] = 2
  view.setUint32(2, id, true)
  pkt[6] = eventCode
  pkt[7] = flag
  view.setUint32(8, mode, true)
  return pkt
}

/** S2C 0x0A RemoveObject (6 bytes). */
function packet0x0A(id: number): Uint8Array {
  const pkt = new Uint8Array(6)
  pkt[0] = 0x0a
  pkt[1] = 2
  new DataView(pkt.buffer).setUint32(2, id, true)
  return pkt
}

/**
 * Ticks from a mode-1 #10595 reset to the auto transition 1 → 2 (spec §4.3): `1 + ceil((FrameCnt1 - 1 - Start1) *
 * 256 / speed)`, 1 when the last frame is already reached, `null` when it never happens.
 */
function autoTransitionTicks(record: ObjectsTxtRecord113c, speed8: number): number | null {
  const fc = record.frameCnt[1]! << 8
  if (fc === 0x100 || record.cycleAnim[1] !== 0) return null
  const remaining = fc - 0x100 - (record.start[1]! << 8)
  if (remaining <= 0) return 1
  if (speed8 === 0) return null
  return 1 + Math.ceil(remaining / speed8)
}

/** #10595 speed range: exact for `Sync`, `FD - (FD >> 4) + [0, (FD >> 3) - 1]` otherwise. */
function speedWindow(record: ObjectsTxtRecord113c, mode: number): readonly [number, number] {
  const fd = record.frameDelta[mode]!
  if (record.sync !== 0) return [fd, fd]
  const base = fd - (fd >> 4)
  return [base, base + Math.max(0, (fd >> 3) - 1)]
}

/** A bare OnlineSession fed with real S2C packets: the production wiring of the object light. */
class LightSession {
  readonly session = new OnlineSession({ settingsStore: createSettingsStore() })
  private nowMs = 10_000

  assign(id: number, classId: number, mode: number, x = 100, y = 200): ClientUnit {
    this.session.handleS2cPacket(packet0x51(id, classId, x, y, mode))
    expect(this.session.disconnectReason).toBeNull()
    return this.object(id)
  }

  setMode(id: number, mode: number, eventCode = 3, flag = 0): void {
    this.session.handleS2cPacket(packet0x0E(id, eventCode, flag, mode))
  }

  remove(id: number): void {
    this.session.handleS2cPacket(packet0x0A(id))
  }

  /** One 25 Hz game frame. */
  tick(): void {
    this.nowMs += 40
    this.session.tick(40, this.nowMs)
  }

  /** One rendered frame: the scene's unit build (eases at most once per new game frame) and its point lights. */
  build(): readonly PointLightInput[] {
    return buildSceneDrawables(this.session.buildRenderableUnits()).pointLights
  }

  /** The light drawn at the unit's sub-tile by one build, or null. */
  lightAt(unit: ClientUnit): PointLightInput | null {
    const lights = this.build().filter((l) => l.subTileX === unit.x && l.subTileY === unit.y)
    expect(lights.length).toBeLessThanOrEqual(1)
    return lights[0] ?? null
  }

  /** Ticks (and builds once per tick) until the unit leaves `mode`; returns the tick count (null after `max`). */
  ticksUntilModeChange(unit: ClientUnit, mode: number, max: number): number | null {
    for (let n = 1; n <= max; n++) {
      this.tick()
      if (unit.mode !== mode) return n
    }
    return null
  }

  object(id: number): ClientUnit {
    const unit = this.session.world.getUnit('object', id)
    if (unit === undefined) throw new Error(`object ${String(id)} is not in the world`)
    return unit
  }

  destroy(): void {
    this.session.destroy()
  }
}

function withSession(run: (s: LightSession) => void): void {
  const s = new LightSession()
  try {
    run(s)
  } finally {
    s.destroy()
  }
}

function light(unit: ClientUnit, radius: number, r: number, g: number, b: number): PointLightInput {
  return { subTileX: unit.x, subTileY: unit.y, radius, intensity: 255, r, g, b }
}

/** Checks a non-`Sync` 1 → 2 tick count against the spec window and against the formula for the rolled speed. */
function expectRolledTransition(unit: ClientUnit, record: ObjectsTxtRecord113c, ticks: number | null, window: readonly [number, number], speed8: number): void {
  const [minSpeed, maxSpeed] = speedWindow(record, 1)
  expect(speed8).toBeGreaterThanOrEqual(minSpeed)
  expect(speed8).toBeLessThanOrEqual(maxSpeed)
  expect(ticks).toBe(autoTransitionTicks(record, speed8))
  expect(ticks).toBeGreaterThanOrEqual(window[0])
  expect(ticks).toBeLessThanOrEqual(window[1])
  expect(unit.mode).toBe(2)
}

describe('Objects.txt 1.13c table (generated)', () => {
  it('is byte-identical to the generator output from the mounted MPQs', async () => {
    const archives = await getSharedMountedArchives()
    const table = parseTable(await archives.read('data\\global\\excel\\objects.txt'))
    expect(GENERATED).toBe(renderObjectsTxt(readObjectsTxtRows(table)))
  }, 60_000)

  it('has the 573 compiled records, 225 of them lit, and throws past the table', () => {
    expect(OBJECTS_TXT_113C).toHaveLength(573)
    expect(OBJECTS_TXT_113C.filter((r) => r.lit.some((v) => v !== 0))).toHaveLength(225)
    expect(OBJECTS_TXT_113C.flatMap((r, i) => (r.envEffect !== 0 ? [i] : []))).toEqual([39, 45, 71, 72])
    // Records 410..412: the index is the record number after the dropped `Expansion` row, not the Id column.
    expect([409, 410, 411, 412].map((c) => getObjectsTxtRecord113c(c).name)).toEqual(['Dummy', 'Siege Control', 'ptox', 'pyox'])
    expect(() => getObjectsTxtRecord113c(573)).toThrow(RangeError)
    expect(() => getObjectsTxtRecord113c(-1)).toThrow(RangeError)
    // No lit record is a door (the door paths never touch a light).
    expect(OBJECTS_TXT_113C.filter((r) => r.isDoor !== 0 && r.lit.some((v) => v !== 0))).toEqual([])
  })
})

describe('SetObjectLight 0x6fad4920 and LightUpdate 0x6fb59b50', () => {
  const synthetic = (lit: number): ObjectsTxtRecord113c => ({
    ...getObjectsTxtRecord113c(2),
    name: 'synthetic',
    lit: [lit, lit, lit, lit, lit, lit, lit, lit],
    red: 1,
    green: 2,
    blue: 3,
  })
  const makeSeed = (): D2SeedStrc => {
    const s: D2SeedStrc = { lo: 1, hi: 666 }
    SEED_InitSeed(s)
    return s
  }
  const unit = (): ObjectLightUnit => ({ id: 1, classId: 2, seed: makeSeed(), mode: 0, objectLight: null })

  it('GV16: Lit 40 is clamped to radius 18 by Alloc and by SetRadius', () => {
    const u = unit()
    setObjectLight(u, synthetic(40), 40)
    expect(u.objectLight).toEqual({ targetR8: 144, currentR8: 144, red: 1, green: 2, blue: 3 })
    u.objectLight!.targetR8 = 8
    u.objectLight!.currentR8 = 8
    setObjectLight(u, synthetic(40), 40)
    expect(u.objectLight!.targetR8).toBe(OBJECT_LIGHT_MAX_RADIUS * 8)
  })

  it('GV17: Lit 1 (radius 0) never allocates and leaves an existing target alone', () => {
    const u = unit()
    setObjectLight(u, synthetic(1), 1)
    expect(u.objectLight).toBeNull()
    setObjectLight(u, synthetic(17), 17)
    setObjectLight(u, synthetic(1), 1)
    expect(u.objectLight).toEqual({ targetR8: 64, currentR8: 64, red: 1, green: 2, blue: 3 })
  })

  it('a new light starts at full radius, a change moves the target only, Lit 0 frees at once; colour is kept', () => {
    const u = unit()
    setObjectLight(u, getObjectsTxtRecord113c(376), 13)
    const allocated = u.objectLight
    expect(allocated).toEqual({ targetR8: 48, currentR8: 48, red: 255, green: 236, blue: 176 })
    setObjectLight(u, synthetic(17), 17) // other record colour: never rewritten on an existing light
    expect(u.objectLight).toBe(allocated)
    expect(u.objectLight).toEqual({ targetR8: 64, currentR8: 48, red: 255, green: 236, blue: 176 })
    setObjectLight(u, synthetic(0), 0)
    expect(u.objectLight).toBeNull()
    expect(() => setObjectLight(u, synthetic(0), 256)).toThrow(RangeError)
    expect(() => setObjectLight(u, synthetic(0), -1)).toThrow(RangeError)
    expect(() => objectLitForMode(synthetic(0), 8)).toThrow(RangeError)
  })

  it('eases ±1 sub-tile per build toward the target and draws current >> 3', () => {
    const l = { targetR8: 72, currentR8: 48, red: 0, green: 0, blue: 0 }
    const radii: number[] = []
    for (let i = 0; i < 4; i++) {
      easeObjectLight(l)
      radii.push(objectLightRadius(l))
    }
    expect(radii).toEqual([7, 8, 9, 9])
    l.targetR8 = 56
    easeObjectLight(l)
    expect(objectLightRadius(l)).toBe(8)
    expect(objectLightRenderInput(null)).toBeUndefined()
    expect(objectLightRenderInput(l)).toEqual({ radius: 8, r: 0, g: 0, b: 0 })
  })

  it('every record and mode: radius min(Lit >> 1, 18) with the record colour, none for Lit 0 / 1', () => {
    OBJECTS_TXT_113C.forEach((record, classId) => {
      for (let mode = 0; mode < 8; mode++) {
        const u: ObjectLightUnit = { id: 1, classId, seed: makeSeed(), mode, objectLight: null }
        const lit = objectLitForMode(record, mode)
        setObjectLight(u, record, lit)
        const radius = Math.min(lit >> 1, 18)
        expect(objectLightRenderInput(u.objectLight), `${String(classId)}/${String(mode)}`).toEqual(
          radius > 0 ? { radius, r: record.red, g: record.green, b: record.blue } : undefined,
        )
      }
    })
  })

  it('every non-door record: the auto 1 → 2 happens on the tick of the §4.3 formula and sets Lit[2]', () => {
    let transitions = 0
    OBJECTS_TXT_113C.forEach((record, classId) => {
      // Class 12 plays backwards and class 189 has its own steps; both are covered by the generic stepping rules.
      if (classId === 12 || classId === 189) return
      const u: ObjectLightUnit = { id: 1000 + classId, classId, seed: makeSeed(), mode: 1, objectLight: null }
      setObjectLight(u, record, objectLitForMode(record, 1))
      resetObjectAnim(u, record)
      const speed8 = u.objectAnim!.speed8
      const [minSpeed, maxSpeed] = speedWindow(record, 1)
      expect(speed8, `${String(classId)} speed`).toBeGreaterThanOrEqual(Math.max(0, minSpeed))
      expect(speed8, `${String(classId)} speed`).toBeLessThanOrEqual(maxSpeed)
      const before = u.objectLight === null ? null : { ...u.objectLight }
      const expected = record.isDoor !== 0 ? null : autoTransitionTicks(record, speed8)
      let ticks: number | null = null
      for (let n = 1; n <= (expected ?? 300) && ticks === null; n++) {
        if (tickObjectAnim(u, record, n * 40)) ticks = n
      }
      expect(ticks, `${String(classId)} ticks`).toBe(expected)
      if (ticks === null) {
        expect(u.mode, `${String(classId)} mode`).toBe(1)
        return
      }
      transitions++
      expect(u.mode).toBe(2)
      const lit2 = objectLitForMode(record, 2)
      if (lit2 === 0) expect(u.objectLight, `${String(classId)} light`).toBeNull()
      else if (lit2 >> 1 === 0) expect(u.objectLight, `${String(classId)} light`).toEqual(before)
      else expect(u.objectLight?.targetR8, `${String(classId)} light`).toBe(Math.min(lit2 >> 1, 18) * 8)
    })
    expect(transitions).toBeGreaterThan(0)
  })
})

describe('1.13c room seed -> unit seed -> #10595 object anim speed roll (#874)', () => {
  it('resetObjectAnim fails fast when unit.seed is missing', () => {
    const broken = { id: 1, classId: 29, mode: 1, objectLight: null } as unknown as ObjectLightUnit
    expect(() => resetObjectAnim(broken, getObjectsTxtRecord113c(29))).toThrow(/missing a valid D2SeedStrc unit\.seed/)
  })

  it('derives each object unit.seed from the active room seed (pRoom1->pSeed, 0x6fb57475..0x6fb574bd) and rolls #10595 speed from unit.seed (not unit.id)', () => {
    const roomInitSeed = 0x1357_2468
    const oracleRoomSeed: D2SeedStrc = { lo: 1, hi: 666 }
    SEED_InitLowSeed(oracleRoomSeed, roomInitSeed)

    // Oracle roll for 1st object in the room (classId 29 Brazier, Sync=0, FrameDelta[1]=128):
    const unit1InitLo = SEED_RollRandomNumber(oracleRoomSeed) >>> 0
    const oracleUnit1Seed: D2SeedStrc = { lo: 1, hi: 666 }
    SEED_InitLowSeed(oracleUnit1Seed, unit1InitLo)
    const brazierRecord = getObjectsTxtRecord113c(29)
    const fd1 = brazierRecord.frameDelta[1]!
    const expectedSpeed1 = fd1 - (fd1 >> 4) + SEED_RollLimitedRandomNumber(oracleUnit1Seed, fd1 >> 3)

    // Oracle roll for 2nd object in the same room:
    const unit2InitLo = SEED_RollRandomNumber(oracleRoomSeed) >>> 0
    const oracleUnit2Seed: D2SeedStrc = { lo: 1, hi: 666 }
    SEED_InitLowSeed(oracleUnit2Seed, unit2InitLo)
    const expectedSpeed2 = fd1 - (fd1 >> 4) + SEED_RollLimitedRandomNumber(oracleUnit2Seed, fd1 >> 3)

    const world = new ClientWorld()
    world.apply({ type: 'RoomReveal', areaId: 1, tileX: 20, tileY: 40, roomSeed: roomInitSeed })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 999, classId: 29, x: 105, y: 205, mode: 1 },
    })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 1000, classId: 29, x: 110, y: 210, mode: 1 },
    })

    const obj1 = world.getUnit('object', 999)!
    const obj2 = world.getUnit('object', 1000)!
    expect(obj1.initSeed).toBe(unit1InitLo)
    expect(obj1.seed).toEqual(oracleUnit1Seed)
    expect(obj1.objectAnim?.speed8).toBe(expectedSpeed1)

    expect(obj2.initSeed).toBe(unit2InitLo)
    expect(obj2.seed).toEqual(oracleUnit2Seed)
    expect(obj2.objectAnim?.speed8).toBe(expectedSpeed2)

    // Changing unit.id does not change the rolled speed (no unit-id hash stand-in):
    const worldOtherId = new ClientWorld()
    worldOtherId.apply({ type: 'RoomReveal', areaId: 1, tileX: 20, tileY: 40, roomSeed: roomInitSeed })
    worldOtherId.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 42, classId: 29, x: 105, y: 205, mode: 1 },
    })
    expect(worldOtherId.getUnit('object', 42)!.objectAnim?.speed8).toBe(expectedSpeed1)
  })

  it('ObjectSetMode (0x6fad59f0): mode change rolls #10595 in #11090 (0x6fad5a1b) and again in the tail (0x6fad5b05); same-mode 0x0E rolls only in the tail', () => {
    const world = new ClientWorld()
    world.apply({ type: 'RoomReveal', areaId: 1, tileX: 20, tileY: 40, roomSeed: 0xdead_beef })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 10, classId: 376, x: 105, y: 205, mode: 0 },
    })
    const forge = world.getUnit('object', 10)!
    const record = getObjectsTxtRecord113c(376) // Hellforge, Sync=0, FrameDelta=[184, 184, ...]
    const fd = record.frameDelta[1]!

    // Snapshot unit.seed right after UnitAssign (and its 1st tick in mode 0 which does not roll #10595):
    const oracleSeed: D2SeedStrc = { lo: forge.seed.lo, hi: forge.seed.hi }

    // Mode change 0 -> 1 via S2C 0x0E event 3:
    // #11090 (0x6fad5a1b) rolls once, then tail #10595 (0x6fad5b05) rolls a second time.
    SEED_RollLimitedRandomNumber(oracleSeed, fd >> 3)
    const expectedAfterModeChange = fd - (fd >> 4) + SEED_RollLimitedRandomNumber(oracleSeed, fd >> 3)

    world.apply({ type: 'UnitMode', unitType: 2, id: 10, mode: 1, eventCode: 3, eventFlag: 0 })
    world.tick(40)
    expect(forge.mode).toBe(1)
    expect(forge.objectAnim?.speed8).toBe(expectedAfterModeChange)
    expect(forge.seed).toEqual(oracleSeed)

    // Same-mode 1 -> 1 via S2C 0x0E event 3:
    // #11090 sees prevMode === newMode (no-op), so only tail #10595 (0x6fad5b05) rolls once.
    const expectedAfterSameMode = fd - (fd >> 4) + SEED_RollLimitedRandomNumber(oracleSeed, fd >> 3)
    world.apply({ type: 'UnitMode', unitType: 2, id: 10, mode: 1, eventCode: 3, eventFlag: 0 })
    world.tick(40)
    expect(forge.objectAnim?.speed8).toBe(expectedAfterSameMode)
    expect(forge.seed).toEqual(oracleSeed)
  })
})

describe('S2C 0x0E event code and per-unit packet queue unit+0xd8 (0x6fb5c630 / 0x6fb5bc20 / 0x6fad5ce0)', () => {
  it('decodes pkt[6] as the event code and pkt[7] as the flag', () => {
    expect(decode0x0ESetObjectState(packet0x0E(77, 3, 1, 2))).toMatchObject({ type: 'UnitMode', id: 77, mode: 2, eventCode: 3, eventFlag: 1 })
    expect(decode0x0ESetObjectState(packet0x0E(77, 0x15, 9, 0))).toMatchObject({ eventCode: 0x15, eventFlag: 9 })
  })

  it('drops S2C 0x0E when the unit is not in ClientWorld (0x6fb5c630 -> D2Client_FindUnit null)', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitMode', unitType: 2, id: 999, mode: 1, eventCode: 3, eventFlag: 0 })
    expect(world.getUnit('object', 999)).toBeUndefined()
    world.tick(40)
    expect(world.getUnit('object', 999)).toBeUndefined()
  })

  it('queues S2C 0x0E on unit.queuedPackets (unit+0xd8) and drains in FIFO order at the end of the 25 Hz tick; event 0x15 keeps mode/light and unknown events throw on drain', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 2, id: 5, classId: 2, x: 100, y: 100, mode: 0 } })
    const shrine = world.getUnit('object', 5)!

    // Packet arrival only enqueues on unit+0xd8: mode and light remain unchanged before tick().
    world.apply({ type: 'UnitMode', unitType: 2, id: 5, mode: 1, eventCode: 3, eventFlag: 0 })
    expect(shrine.queuedPackets).toHaveLength(1)
    expect(shrine.mode).toBe(0)
    expect(shrine.objectLight).toBeNull()

    // Drain on the next 25 Hz tick:
    world.tick(40)
    expect(shrine.queuedPackets).toHaveLength(0)
    expect(shrine.mode).toBe(1)
    expect(shrine.objectLight).toEqual({ targetR8: 64, currentR8: 64, red: 255, green: 255, blue: 255 })

    // Multiple 0x0E packets in the same frame drain in FIFO order on the next tick:
    world.apply({ type: 'UnitMode', unitType: 2, id: 5, mode: 2, eventCode: 3, eventFlag: 0 })
    world.apply({ type: 'UnitMode', unitType: 2, id: 5, mode: 1, eventCode: 3, eventFlag: 0 })
    world.apply({ type: 'UnitMode', unitType: 2, id: 5, mode: 0, eventCode: 0x15, eventFlag: 1 })
    expect(shrine.queuedPackets).toHaveLength(3)
    world.tick(40)
    expect(shrine.queuedPackets).toHaveLength(0)
    expect(shrine.mode).toBe(1)
    expect(shrine.objectLight).toEqual({ targetR8: 64, currentR8: 64, red: 255, green: 255, blue: 255 })

    // Invalid eventCode is queued on arrival and throws when drained by ObjectEvent 0x6fad5ce0:
    world.apply({ type: 'UnitMode', unitType: 2, id: 5, mode: 0, eventCode: 7, eventFlag: 0 })
    expect(() => world.tick(40)).toThrow(/event 7 is not 3 or 0x15/)
  })

  it('runs tickObjectAnim (0x6fad5660) BEFORE draining unit.queuedPackets (0x6fb5bc20) on the same 25 Hz tick', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 2, id: 5, classId: 2, x: 100, y: 100, mode: 1 } })
    const shrine = world.getUnit('object', 5)!
    setObjectLight(shrine, getObjectsTxtRecord113c(2), objectLitForMode(getObjectsTxtRecord113c(2), 1))

    // Advance 40 ticks in mode 1 so the 41st tick's tickObjectAnim will auto-transition 1 -> 2 (freeing the light).
    for (let i = 0; i < 40; i++) world.tick(40)
    expect(shrine.mode).toBe(1)
    expect(shrine.objectLight).not.toBeNull()

    // Queue S2C 0x0E (mode 1) BEFORE the 41st tick: on tick 41, tickObjectAnim runs first (1 -> 2, freeing light),
    // and then 0x6fb5bc20 drains the queued 0x0E (setting mode back to 1 and re-allocating Lit[1]).
    world.apply({ type: 'UnitMode', unitType: 2, id: 5, mode: 1, eventCode: 3, eventFlag: 0 })
    world.tick(40)
    expect(shrine.mode).toBe(1)
    expect(shrine.objectAnim?.frame8).toBe(0)
    expect(shrine.objectLight).toEqual({ targetR8: 64, currentR8: 64, red: 255, green: 255, blue: 255 })
  })

  it('a UnitMode without an event code (S2C 0x98, 0x76, port remaps) never touches the light', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 2, id: 6, classId: 2, x: 100, y: 100, mode: 0 } })
    world.apply({ type: 'UnitMode', unitType: 2, id: 6, mode: 1 })
    const shrine = world.getUnit('object', 6)!
    expect(shrine.mode).toBe(1)
    expect(shrine.objectLight).toBeNull()
    expect(shrine.modeDurationMs).toBeUndefined()
  })

  it('doors take DoorSetMode (no light) and keep the timed 1 → 2 of the port', () => {
    const doorClass = OBJECTS_TXT_113C.findIndex((r) => r.isDoor !== 0)
    expect(doorClass).toBeGreaterThan(0)
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 2, id: 8, classId: doorClass, x: 100, y: 100, mode: 0 } })
    world.apply({ type: 'UnitMode', unitType: 2, id: 8, mode: 1, eventCode: 3, eventFlag: 0 })
    const door = world.getUnit('object', 8)!
    expect(door.mode).toBe(0)
    world.tick(40)
    expect(door.mode).toBe(1)
    expect(door.objectLight).toBeNull()
    expect(door.modeDurationMs).toBeGreaterThan(0)
  })
})

describe('golden vectors through OnlineSession (spec §10)', () => {
  it('GV1: 29 Brazier 0x51 mode 1 → r9 at once; the auto 1 → 2 (24..27 ticks) keeps r9', () => {
    withSession((s) => {
      const u = s.assign(1, 29, 1)
      expect(s.lightAt(u)).toEqual(light(u, 9, 255, 236, 176))
      const speed8 = u.objectAnim!.speed8
      expectRolledTransition(u, getObjectsTxtRecord113c(29), s.ticksUntilModeChange(u, 1, 100), [24, 27], speed8)
      expect(s.lightAt(u)).toEqual(light(u, 9, 255, 236, 176))
    })
  })

  it('GV2: 2 Shrine dark in mode 0; 0x0E mode 1 queues on unit+0xd8 -> r8 on drain tick; freed exactly 41 ticks later, absent from that build', () => {
    withSession((s) => {
      const u = s.assign(1, 2, 0)
      expect(s.lightAt(u)).toBeNull()
      s.setMode(1, 1)
      expect(u.mode).toBe(0)
      expect(s.lightAt(u)).toBeNull()
      s.tick() // drains 0x0E at the end of the tick
      expect(u.mode).toBe(1)
      expect(s.lightAt(u)).toEqual(light(u, 8, 255, 255, 255))
      for (let n = 1; n <= 40; n++) {
        s.tick()
        expect(s.lightAt(u), `tick ${String(n)}`).toEqual(light(u, 8, 255, 255, 255))
      }
      s.tick()
      expect(u.mode).toBe(2)
      expect(s.lightAt(u)).toBeNull()
    })
  })

  it('GV3: 376 Hellforge eases r6 → r8 in mode 1, r9 after the auto 1 → 2 (41..46 ticks), r7 in mode 3 (held), r6 in mode 4', () => {
    withSession((s) => {
      const u = s.assign(1, 376, 0)
      expect(s.lightAt(u)).toEqual(light(u, 6, 255, 236, 176))
      s.setMode(1, 1)
      expect(s.lightAt(u)?.radius).toBe(6) // 0x0E still queued on unit+0xd8 before the next game frame
      s.tick() // drains 0x0E at the end of the tick (targetR8 = 64); build for this frame eases 48 -> 56 (r7)
      const speed8 = u.objectAnim!.speed8
      expect(s.lightAt(u)?.radius).toBe(7)
      expect(s.lightAt(u)?.radius).toBe(7) // a second build in the same game frame does not ease
      s.tick() // 1st animation tick of mode 1; build eases 56 -> 64 (r8)
      expect(s.lightAt(u)?.radius).toBe(8)
      const rest = s.ticksUntilModeChange(u, 1, 100)
      expectRolledTransition(u, getObjectsTxtRecord113c(376), rest === null ? null : rest + 1, [41, 46], speed8)
      expect(u.objectLight?.targetR8).toBe(72)
      expect(s.lightAt(u)?.radius).toBe(9)
      s.setMode(1, 3)
      s.tick()
      expect(s.lightAt(u)?.radius).toBe(8)
      s.tick()
      expect(s.lightAt(u)?.radius).toBe(7)
      expect(s.ticksUntilModeChange(u, 3, 100)).toBeNull()
      s.setMode(1, 4)
      s.tick()
      expect(s.lightAt(u)).toEqual(light(u, 6, 255, 236, 176))
    })
  })

  it('GV4: 546 ancientsaltar 0x0E mode 1 → r7 on drain tick; after 29..32 ticks t9: r8, r9', () => {
    withSession((s) => {
      const u = s.assign(1, 546, 0)
      expect(s.lightAt(u)).toBeNull()
      s.setMode(1, 1)
      expect(s.lightAt(u)).toBeNull()
      s.tick() // drains 0x0E
      expect(s.lightAt(u)).toEqual(light(u, 7, 255, 255, 255))
      const speed8 = u.objectAnim!.speed8
      const ticks = s.ticksUntilModeChange(u, 1, 100)
      expectRolledTransition(u, getObjectsTxtRecord113c(546), ticks, [29, 32], speed8)
      expect(s.lightAt(u)?.radius).toBe(8)
      s.tick()
      expect(s.lightAt(u)?.radius).toBe(9)
    })
  })

  it('GV5: 26 Gibbet r2; mode 1 t5: r3, r4, r5; auto after exactly 78 mode-1 ticks t2: r4, r3, r2', () => {
    withSession((s) => {
      const u = s.assign(1, 26, 0)
      expect(s.lightAt(u)?.radius).toBe(2)
      s.setMode(1, 1)
      const radii: number[] = []
      for (let n = 0; n < 3; n++) {
        s.tick()
        radii.push(s.lightAt(u)!.radius)
      }
      expect(radii).toEqual([3, 4, 5])
      const rest = s.ticksUntilModeChange(u, 1, 100)
      // Tick 1 drained 0x0E at the end of the tick; ticks 2 and 3 ran 2 mode-1 animation steps.
      expect(rest === null ? null : rest + 2).toBe(78)
      radii.length = 0
      radii.push(s.lightAt(u)!.radius)
      for (let n = 0; n < 2; n++) {
        s.tick()
        radii.push(s.lightAt(u)!.radius)
      }
      expect(radii).toEqual([4, 3, 2])
    })
  })

  it('GV6: 59 / 60 / 119 0x51 mode 1 → r9 at once; auto 1 → 2 after 18..21 / 19 / 19 ticks keeps r9', () => {
    for (const [classId, rgb, window] of [
      [59, [120, 120, 255], [18, 21]],
      [60, [255, 120, 120], [19, 19]],
      [119, [100, 100, 255], [19, 19]],
    ] as const) {
      withSession((s) => {
        const u = s.assign(1, classId, 1)
        expect(s.lightAt(u)).toEqual(light(u, 9, rgb[0], rgb[1], rgb[2]))
        const speed8 = u.objectAnim!.speed8
        expectRolledTransition(u, getObjectsTxtRecord113c(classId), s.ticksUntilModeChange(u, 1, 100), window, speed8)
        expect(s.lightAt(u)).toEqual(light(u, 9, rgb[0], rgb[1], rgb[2]))
      })
    }
  })

  it('GV7 / GV8: Cairn stones are dark in mode 1; the auto 1 → 2 creates r8 at full radius (3rd / 1st tick)', () => {
    for (const [classId, ticks] of [
      [17, 3],
      [22, 1],
    ] as const) {
      withSession((s) => {
        const u = s.assign(1, classId, 0)
        s.setMode(1, 1)
        s.tick() // drains 0x0E into mode 1
        expect(u.mode).toBe(1)
        expect(s.lightAt(u)).toBeNull()
        expect(s.ticksUntilModeChange(u, 1, 10)).toBe(ticks)
        expect(u.objectLight).toEqual({ targetR8: 64, currentR8: 64, red: 255, green: 255, blue: 255 })
        expect(s.lightAt(u)).toEqual(light(u, 8, 255, 255, 255))
      })
    }
  })

  it('GV9: 152 orifice r12 in modes 0, 1 and 2 and never auto-transitions', () => {
    withSession((s) => {
      const u = s.assign(1, 152, 0)
      expect(s.lightAt(u)).toEqual(light(u, 12, 255, 255, 255))
      s.setMode(1, 1)
      s.tick()
      expect(s.ticksUntilModeChange(u, 1, 100)).toBeNull()
      expect(s.lightAt(u)).toEqual(light(u, 12, 255, 255, 255))
      s.setMode(1, 2)
      s.tick()
      expect(s.lightAt(u)).toEqual(light(u, 12, 255, 255, 255))
    })
  })

  it('GV10: 354 horadric cube chest r6 blue in mode 0; 0x0E mode 1 (Lit1 0) frees it on the drain tick', () => {
    withSession((s) => {
      const u = s.assign(1, 354, 0)
      expect(s.lightAt(u)).toEqual(light(u, 6, 100, 100, 255))
      s.setMode(1, 1)
      expect(u.objectLight).not.toBeNull()
      s.tick()
      expect(u.objectLight).toBeNull()
      expect(s.lightAt(u)).toBeNull()
    })
  })

  it('GV11: 259 skeleton spawn: mode changes without 0x0E event 3 never light it; 0x0E mode 1 → r1 on drain tick, freed after 62..70 ticks', () => {
    withSession((s) => {
      const u = s.assign(1, 259, 0)
      s.session.handleServerEvent({ type: 'UnitMode', unitType: 2, id: 1, mode: 1 })
      expect(s.lightAt(u)).toBeNull()
      expect(s.ticksUntilModeChange(u, 1, 100)).not.toBeNull()
      expect(u.objectLight).toBeNull()
      s.session.handleServerEvent({ type: 'UnitMode', unitType: 2, id: 1, mode: 0 })
      expect(s.lightAt(u)).toBeNull()
      s.setMode(1, 1)
      s.tick() // drains 0x0E
      expect(s.lightAt(u)).toEqual(light(u, 1, 255, 125, 125))
      const speed8 = u.objectAnim!.speed8
      expectRolledTransition(u, getObjectsTxtRecord113c(259), s.ticksUntilModeChange(u, 1, 100), [62, 70], speed8)
      expect(s.lightAt(u)).toBeNull()
    })
  })

  it('GV12: a removed Hellforge is gone from the next build, mid-easing (no fade)', () => {
    withSession((s) => {
      const u = s.assign(1, 376, 0)
      s.setMode(1, 1)
      s.tick()
      expect(s.lightAt(u)?.radius).toBe(7)
      s.remove(1)
      expect(s.build().filter((l) => l.subTileX === u.x && l.subTileY === u.y)).toEqual([])
    })
  })

  it('GV13: a duplicate 0x51 while easing replaces the light at full Lit[mode] >> 1', () => {
    withSession((s) => {
      const u = s.assign(1, 376, 0)
      s.setMode(1, 1)
      s.tick()
      expect(s.lightAt(u)?.radius).toBe(7)
      const again = s.assign(1, 376, 1)
      expect(again.objectLight).toEqual({ targetR8: 64, currentR8: 64, red: 255, green: 236, blue: 176 })
      expect(s.lightAt(again)?.radius).toBe(8)
    })
  })

  it('GV15: 38 Torch2 Wall 0x51 mode 1 → r9; mode 1 loops, so it never auto-transitions', () => {
    withSession((s) => {
      const u = s.assign(1, 38, 1)
      expect(s.lightAt(u)).toEqual(light(u, 9, 255, 236, 176))
      expect(s.ticksUntilModeChange(u, 1, 100)).toBeNull()
      expect(s.lightAt(u)).toEqual(light(u, 9, 255, 236, 176))
    })
  })

  it('GV18 / GV19: records 409..412 and 116 light from their own record (index, not Id column)', () => {
    withSession((s) => {
      const expected: ReadonlyArray<readonly [number, PointLightInput | null]> = [
        [409, { subTileX: 10, subTileY: 20, radius: 8, intensity: 255, r: 255, g: 255, b: 255 }],
        [410, null],
        [411, { subTileX: 30, subTileY: 20, radius: 9, intensity: 255, r: 255, g: 255, b: 255 }],
        [412, { subTileX: 40, subTileY: 20, radius: 9, intensity: 255, r: 255, g: 255, b: 255 }],
        [116, { subTileX: 50, subTileY: 20, radius: 5, intensity: 255, r: 255, g: 190, b: 0 }],
      ]
      expected.forEach(([classId, want], i) => {
        const u = s.assign(i + 1, classId, 0, 10 * (i + 1), 20)
        expect(s.lightAt(u), String(classId)).toEqual(want)
      })
    })
  })

  it('GV20: a second 0x0E mode 1 re-applies Lit1 and restarts the animation on its drain tick: freed 41 ticks after it', () => {
    withSession((s) => {
      const u = s.assign(1, 2, 0)
      s.setMode(1, 1)
      s.tick() // drains 1st 0x0E
      for (let n = 0; n < 20; n++) s.tick()
      const lit = u.objectLight
      s.setMode(1, 1)
      s.tick() // drains 2nd 0x0E and resets animation at the end of this tick
      expect(u.objectLight).toBe(lit)
      expect(s.lightAt(u)).toEqual(light(u, 8, 255, 255, 255))
      expect(s.ticksUntilModeChange(u, 1, 100)).toBe(41)
      expect(s.lightAt(u)).toBeNull()
    })
  })

  it('the scene draws no light for an object input without one, and contains a malformed radius (Issue #955)', () => {
    expect(buildSceneDrawables([{ id: 7, kind: 'object', classId: 37, x: 100, y: 100, mode: 1 }]).pointLights).toEqual([])
    // A bad radius is skipped with a one-shot reportMissingArt instead of throwing —
    // a per-frame throw aborted the whole render loop for every following frame.
    expect(
      buildSceneDrawables([
        { id: 7, kind: 'object', classId: 37, x: 100, y: 100, mode: 1, objectPointLight: { radius: 0, r: 1, g: 2, b: 3 } },
      ]).pointLights,
    ).toEqual([])
  })
})

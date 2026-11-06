/**
 * 1.13c EnvEffect objects (Objects.txt `EnvEffect` = 1): the day/night switch of D2Client.
 *
 * Ground truth (1.13c binaries, see docs/environment_daynight_113c.md and src/client/world/env-effect.ts):
 * - 0x6fad5280: Day → an object in mode 1/2 goes to mode 0; Dusk/Night/Dawn → mode 0 goes to mode 1; the
 *   return value is 1 when it acted (always at night, only on a change by day); other periods assert.
 * - 0x6fad4920: object light = `Lit[mode]`, radius `min(Lit >> 1, 18)` (0x6fb58c20 refuses radius 0),
 *   intensity 255, Objects.txt Red/Green/Blue.
 * - 0x6fad53d0 (ClientFn 14): the switch when `GetTickCount() > unit[0xd4]`, then `unit[0xd4] = now + 500`.
 * - 0x6fb56680: the switch on every object once the period differs from `[0x6fbd3420]` (starts at Day,
 *   never reset); run by the 25 Hz frame after #10135 reports a change, and by the S2C 0x53 handler.
 * - 0x6fb57400 → 0x6fad5490: every S2C 0x51 builds a new unit and applies the switch (no refresh check).
 * - Real 1.13c captures: the Rogue Encampment campfire (class 39) is assigned in mode 0 at noon.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { fileSource } from '../../src/baker/io/file-source.ts'
import { decodeCapturedGameS2cPacket, OnlineSession } from '../../src/client/session/online-session.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'
import { buildSceneDrawables } from '../../src/client/view/unit-drawables.ts'
import { ClientUnit } from '../../src/client/world/client-unit.ts'
import {
  applyEnvEffect,
  ENV_EFFECT_OBJECTS,
  ENV_EFFECT_POLL_CLIENT_FN,
  ENV_EFFECT_POLL_INTERVAL_MS,
  EnvEffectController,
  envEffectTargetMode,
} from '../../src/client/world/env-effect.ts'
import { objectLightRenderInput } from '../../src/client/world/object-light.ts'
import { MpqArchive } from '../../src/common/mpq/archive.ts'
import { MountedArchives } from '../../src/common/mpq/mount.ts'
import { loadObjectsTable, type ObjectsTable } from '../../src/common/units/objects.ts'
import { cell } from '../../src/common/world/acts.ts'
import { PeriodOfDay } from '../../src/common/world/environment.ts'

const CAMPFIRE = 39
const ALL_PERIODS = [PeriodOfDay.Day, PeriodOfDay.Dusk, PeriodOfDay.Night, PeriodOfDay.Dawn] as const
const CAPTURE_TEXT = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/netproto/02-d2gs-town-walk-chat.d2cap'),
  'utf8',
)

function objectUnit(classId: number, mode: number, id = 1): ClientUnit {
  return new ClientUnit({ unitType: 'object', id, classId, x: 5000, y: 5000, mode })
}

/** A 0x53 packet (10 bytes, little-endian). */
function packet0x53(cycleIndex: number, ticks: number, eclipse: number): Uint8Array {
  const pkt = new Uint8Array(10)
  const view = new DataView(pkt.buffer)
  pkt[0] = 0x53
  view.setUint32(1, cycleIndex, true)
  view.setUint32(5, ticks >>> 0, true)
  pkt[9] = eclipse
  return pkt
}

/** A 0x51 AssignObject packet (14 bytes, little-endian). */
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
  pkt[13] = 0
  return pkt
}

describe('EnvEffect rows against the 1.13c Objects.txt', () => {
  const dir = existsSync('samples/d2/Patch_D2.mpq')
    ? 'samples/d2'
    : (process.env.D2_DATA_DIR ?? 'samples/d2')
  let objects: ObjectsTable
  /** Raw Objects.txt rows by record index (the class id of S2C 0x51), filtered like `loadObjectsTable`. */
  let rawById: ReadonlyArray<readonly string[]>

  beforeAll(async () => {
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`${dir}/${name}`)))
    }
    objects = await loadObjectsTable(archives)
    const raws: Array<readonly string[]> = []
    for (const raw of objects.table.rows) {
      const id = cell(objects.table, raw, 'Id').trim()
      const name = cell(objects.table, raw, 'Name').trim()
      if (id === '' || name.toLowerCase() === 'expansion') continue
      raws.push(raw)
    }
    rawById = raws
  })

  it('pairs every raw row with its loaded record', () => {
    expect(rawById).toHaveLength(objects.rows.length)
    rawById.forEach((raw, id) => expect(cell(objects.table, raw, 'Name')).toBe(objects.rows[id]!.name))
  })

  it('EnvEffect = 1 is set on exactly the objects the port switches (39, 45, 71, 72)', () => {
    const envEffectIds = rawById.flatMap((raw, id) => (cell(objects.table, raw, 'EnvEffect').trim() === '1' ? [id] : []))
    expect(envEffectIds).toEqual([...ENV_EFFECT_OBJECTS.keys()].sort((a, b) => a - b))
  })

  it('Lit0..Lit7, Red/Green/Blue and ClientFn match Objects.txt; Selectable0..2 are 0', () => {
    for (const def of ENV_EFFECT_OBJECTS.values()) {
      const row = objects.byId.get(def.classId)
      const raw = rawById[def.classId]
      if (row === undefined || raw === undefined) throw new Error(`Objects.txt has no row ${String(def.classId)}`)
      const num = (column: string): number => Number(cell(objects.table, raw, column).trim() || '0')
      expect(row.lit, `class ${String(def.classId)} Lit`).toEqual(def.lit)
      expect([num('Red'), num('Green'), num('Blue')], `class ${String(def.classId)} RGB`).toEqual([def.red, def.green, def.blue])
      expect(num('ClientFn'), `class ${String(def.classId)} ClientFn`).toBe(def.clientFn)
      // A mode change copies Selectable[mode] into unit flag 0x2; these rows never change it.
      expect(row.selectable.slice(0, 3), `class ${String(def.classId)} Selectable`).toEqual([0, 0, 0])
    }
    expect(ENV_EFFECT_OBJECTS.get(CAMPFIRE)?.clientFn).toBe(ENV_EFFECT_POLL_CLIENT_FN)
  })
})

describe('EnvEffect switch 0x6fad5280', () => {
  it('Day turns modes 1 and 2 into 0 and leaves every other mode alone', () => {
    expect(Array.from({ length: 8 }, (_, mode) => envEffectTargetMode(mode, PeriodOfDay.Day))).toEqual([
      null, 0, 0, null, null, null, null, null,
    ])
  })

  it('Dusk, Night and Dawn turn mode 0 into 1 and leave every other mode alone', () => {
    for (const period of [PeriodOfDay.Dusk, PeriodOfDay.Night, PeriodOfDay.Dawn]) {
      expect(Array.from({ length: 8 }, (_, mode) => envEffectTargetMode(mode, period)), `period ${String(period)}`).toEqual([
        1, null, null, null, null, null, null, null,
      ])
    }
  })

  it('asserts on a value that is not a period of day', () => {
    expect(() => envEffectTargetMode(0, 4 as PeriodOfDay)).toThrow(RangeError)
    expect(() => envEffectTargetMode(0, -1 as PeriodOfDay)).toThrow(RangeError)
  })

  it('returns whether it acted and restarts the mode animation on a change', () => {
    const lit = objectUnit(CAMPFIRE, 1)
    lit.modeStartedAtMs = 10
    lit.animStartedAtMs = 10
    lit.modeElapsedMs = 123
    lit.modeUntilMs = 999
    lit.modeDurationMs = 999
    lit.animStepSpeed256 = 256
    lit.animEffRate = 128
    expect(applyEnvEffect(lit, PeriodOfDay.Day, 5000)).toBe(true)
    expect({
      mode: lit.mode,
      modeStartedAtMs: lit.modeStartedAtMs,
      animStartedAtMs: lit.animStartedAtMs,
      modeElapsedMs: lit.modeElapsedMs,
      modeUntilMs: lit.modeUntilMs,
      modeDurationMs: lit.modeDurationMs,
      animStepSpeed256: lit.animStepSpeed256,
      animEffRate: lit.animEffRate,
    }).toEqual({
      mode: 0,
      modeStartedAtMs: 5000,
      animStartedAtMs: 5000,
      modeElapsedMs: 0,
      modeUntilMs: undefined,
      modeDurationMs: undefined,
      animStepSpeed256: undefined,
      animEffRate: undefined,
    })

    // By day without a change: returns 0 and touches nothing.
    expect(applyEnvEffect(lit, PeriodOfDay.Day, 6000)).toBe(false)
    expect(lit.modeStartedAtMs).toBe(5000)

    // At night it always returns 1; mode 0 lights up, mode 1 keeps its animation running.
    expect(applyEnvEffect(lit, PeriodOfDay.Night, 7000)).toBe(true)
    expect(lit.mode).toBe(1)
    expect(lit.modeStartedAtMs).toBe(7000)
    expect(applyEnvEffect(lit, PeriodOfDay.Dawn, 8000)).toBe(true)
    expect(lit.mode).toBe(1)
    expect(lit.modeStartedAtMs).toBe(7000)
  })

  it('ignores objects without EnvEffect', () => {
    const torch = objectUnit(1, 0)
    for (const period of ALL_PERIODS) {
      expect(applyEnvEffect(torch, period, 1000)).toBe(false)
      expect(torch.mode).toBe(0)
    }
  })
})

describe('EnvEffect object light 0x6fad4920', () => {
  it('the switch leaves the campfire dark in mode 0 and gives it a radius 19 >> 1 = 9 light in modes 1 and 2', () => {
    const fire = objectUnit(CAMPFIRE, 0)
    expect(applyEnvEffect(fire, PeriodOfDay.Night, 1000)).toBe(true)
    const light = { targetR8: 72, currentR8: 72, red: 255, green: 236, blue: 176 }
    expect(fire.mode).toBe(1)
    expect(fire.objectLight).toEqual(light)
    fire.mode = 2
    expect(applyEnvEffect(fire, PeriodOfDay.Dusk, 2000)).toBe(true)
    expect(fire.objectLight).toEqual(light)
    // By day modes 1 and 2 become 0, whose Lit0 = 0 frees the light at once.
    expect(applyEnvEffect(fire, PeriodOfDay.Day, 3000)).toBe(true)
    expect(fire.mode).toBe(0)
    expect(fire.objectLight).toBeNull()
    for (const mode of [3, 4, 5, 6, 7]) {
      const other = objectUnit(CAMPFIRE, mode)
      expect(applyEnvEffect(other, PeriodOfDay.Night, 1000)).toBe(true)
      expect(other.objectLight).toBeNull()
    }
  })

  it('the other EnvEffect rows (Lit 0 in every mode) never light', () => {
    for (const classId of [45, 71, 72]) {
      for (const period of ALL_PERIODS) {
        for (let mode = 0; mode < 8; mode++) {
          const unit = objectUnit(classId, mode)
          applyEnvEffect(unit, period, 1000)
          expect(unit.objectLight, `${String(classId)}/${String(period)}/${String(mode)}`).toBeNull()
        }
      }
    }
  })

  it('leaves objects without EnvEffect unlit and throws on a mode outside 0..7 once it acts', () => {
    const torch = objectUnit(1, 1)
    expect(applyEnvEffect(torch, PeriodOfDay.Night, 1000)).toBe(false)
    expect(torch.objectLight).toBeNull()
    expect(() => applyEnvEffect(objectUnit(CAMPFIRE, 8), PeriodOfDay.Night, 1000)).toThrow(RangeError)
    expect(() => applyEnvEffect(objectUnit(CAMPFIRE, 1.5), PeriodOfDay.Night, 1000)).toThrow(RangeError)
  })

  it('buildSceneDrawables pushes the light the object carries at its sub-tile, and none without one', () => {
    const fire = objectUnit(CAMPFIRE, 0)
    applyEnvEffect(fire, PeriodOfDay.Night, 1000)
    const lit = buildSceneDrawables([
      {
        id: 7,
        kind: 'object',
        classId: CAMPFIRE,
        x: 120,
        y: 80,
        mode: fire.mode,
        direction: 0,
        hpRatio: 1,
        isCorpse: false,
        isHovered: false,
        objectPointLight: objectLightRenderInput(fire.objectLight),
      },
    ])
    expect(lit.pointLights).toEqual([{ subTileX: 120, subTileY: 80, radius: 9, intensity: 255, r: 255, g: 236, b: 176 }])
    // The light is unit state, not a function of the mode: an input without it draws nothing, whatever its mode.
    const dark = buildSceneDrawables([
      { id: 7, kind: 'object', classId: CAMPFIRE, x: 120, y: 80, mode: 1, direction: 0, hpRatio: 1, isCorpse: false, isHovered: false },
    ])
    expect(dark.pointLights).toEqual([])
  })
})

describe('EnvEffectController (ClientFn 14 poll, refresh cache, object init)', () => {
  it('polls only ClientFn 14 objects, when now is strictly past the 500 ms deadline', () => {
    const controller = new EnvEffectController()
    const campfire = objectUnit(CAMPFIRE, 0, 1)
    const other = objectUnit(45, 0, 2)
    const objects = [campfire, other]

    // A new unit's deadline is 0: the first poll runs.
    controller.poll(objects, PeriodOfDay.Night, 1000)
    expect(campfire.mode).toBe(1)
    expect(other.mode).toBe(0)

    // The server puts the fire out (e.g. a mode packet); the poll waits for its deadline.
    campfire.mode = 0
    controller.poll(objects, PeriodOfDay.Night, 1000 + ENV_EFFECT_POLL_INTERVAL_MS)
    expect(campfire.mode).toBe(0)
    controller.poll(objects, PeriodOfDay.Night, 1000 + ENV_EFFECT_POLL_INTERVAL_MS + 1)
    expect(campfire.mode).toBe(1)
    expect(other.mode).toBe(0)
  })

  it('the refresh cache starts at Day, so a day refresh does nothing until the period changes', () => {
    const controller = new EnvEffectController()
    const campfire = objectUnit(CAMPFIRE, 1)
    expect(controller.refreshedPeriod).toBe(PeriodOfDay.Day)
    controller.refresh([campfire], PeriodOfDay.Day, 1000)
    expect(campfire.mode).toBe(1)

    controller.refresh([campfire], PeriodOfDay.Dusk, 2000)
    expect(controller.refreshedPeriod).toBe(PeriodOfDay.Dusk)
    expect(campfire.mode).toBe(1)

    // Same period again: skipped even though the fire was put out meanwhile.
    campfire.mode = 0
    controller.refresh([campfire], PeriodOfDay.Dusk, 3000)
    expect(campfire.mode).toBe(0)
    controller.refresh([campfire], PeriodOfDay.Night, 4000)
    expect(campfire.mode).toBe(1)
    controller.refresh([campfire], PeriodOfDay.Day, 5000)
    expect(campfire.mode).toBe(0)
    expect(controller.refreshedPeriod).toBe(PeriodOfDay.Day)
  })

  it('object init applies the switch regardless of the cache and restarts the poll deadline', () => {
    const controller = new EnvEffectController()
    const campfire = objectUnit(CAMPFIRE, 0)
    controller.onObjectCreated(campfire, PeriodOfDay.Night, 1000)
    expect(campfire.mode).toBe(1)
    expect(controller.refreshedPeriod).toBe(PeriodOfDay.Day)

    controller.poll([campfire], PeriodOfDay.Night, 1001)
    campfire.mode = 0
    controller.poll([campfire], PeriodOfDay.Night, 1200)
    expect(campfire.mode).toBe(0)
    // A new 0x51 for the object: the deadline starts over at 0.
    controller.onObjectCreated(campfire, PeriodOfDay.Day, 1300)
    expect(campfire.mode).toBe(0)
    controller.poll([campfire], PeriodOfDay.Night, 1301)
    expect(campfire.mode).toBe(1)
  })
})

describe('EnvEffect objects through OnlineSession (real 1.13c capture)', () => {
  function replayedSession(): OnlineSession {
    const session = new OnlineSession({ settingsStore: createSettingsStore() })
    session.loadD2CapReplay(CAPTURE_TEXT)
    session.replayAllD2Cap()
    expect(session.disconnectReason).toBeNull()
    return session
  }

  function campfireOf(session: OnlineSession): ClientUnit {
    const fires = session.world.getUnitsByType('object').filter((u) => u.classId === CAMPFIRE)
    expect(fires).toHaveLength(1)
    return fires[0]!
  }

  it('the captured campfire stays dark at noon; a 0x53 night sync lights it (radius 9 light)', () => {
    const session = replayedSession()
    try {
      const fire = campfireOf(session)
      expect(fire.mode).toBe(0)
      // The captured town torches (class 37, mode 2: Lit2 19, same colour) light too, so select the campfire's sub-tile.
      const lightsOf = () =>
        buildSceneDrawables(session.buildRenderableUnits()).pointLights.filter(
          (l) => l.subTileX === fire.x && l.subTileY === fire.y,
        )
      expect(lightsOf()).toEqual([])

      session.handleS2cPacket(packet0x53(5, 25600, 0))
      expect(session.disconnectReason).toBeNull()
      expect(fire.mode).toBe(1)
      expect(lightsOf()).toEqual([{ subTileX: fire.x, subTileY: fire.y, radius: 9, intensity: 255, r: 255, g: 236, b: 176 }])

      // A re-assigned campfire (new unit in mode 0) is lit by its init switch.
      session.handleS2cPacket(packet0x51(fire.id, CAMPFIRE, fire.x, fire.y, 0))
      expect(campfireOf(session).mode).toBe(1)

      // Back to noon: the refresh puts it out again.
      session.handleS2cPacket(packet0x53(2, 0, 0))
      expect(campfireOf(session).mode).toBe(0)
    } finally {
      session.destroy()
    }
  })

  it('the 25 Hz tick lights the campfire on the frame the clock reaches dusk (160 degrees)', () => {
    const session = replayedSession()
    try {
      // Noon row one tick before the 160-degree boundary (20480 ticks): still Day, so no refresh.
      session.handleS2cPacket(packet0x53(2, 160 * 128, 0))
      const fire = campfireOf(session)
      expect(fire.mode).toBe(0)
      session.tick(40, 100_000)
      expect(session.environment.period).toBe(PeriodOfDay.Dusk)
      expect(session.environment.cycleIndex).toBe(3)
      expect(fire.mode).toBe(1)
    } finally {
      session.destroy()
    }
  })

  it('disconnects on an EnvEffect object assigned before 0x03 LoadAct (its switch reads a null act)', () => {
    const session = new OnlineSession({ settingsStore: createSettingsStore() })
    try {
      session.loadD2CapReplay(CAPTURE_TEXT)
      while (session.world.selfId === 0) {
        if (session.stepD2CapReplay() === null) throw new Error('capture ended before 0x59 AssignPlayer')
      }
      // A non-EnvEffect object (class 1) is accepted; the campfire is not.
      session.handleServerEvent(decodeCapturedGameS2cPacket(packet0x51(900, 1, 5000, 5000, 0)))
      expect(session.disconnectReason).toBeNull()
      session.handleServerEvent(decodeCapturedGameS2cPacket(packet0x51(901, CAMPFIRE, 5000, 5000, 0)))
      expect(session.disconnectReason).toContain('0x51 UnitAssign of EnvEffect object class 39 before 0x03 LoadAct')
    } finally {
      session.destroy()
    }
  })
})

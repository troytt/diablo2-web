/**
 * Event Wheel Subsystem Vectors (`EVTWHEEL`, Plan §3.6.2, Gitea Milestone 31 [K0]).
 *
 * Vector record format (32 bytes):
 *   [0..3]   initial_frame: uint32
 *   [4..7]   event_count: uint32
 *   [8..11]  advance_frames: uint32
 *   [12..15] fired_count: uint32
 *   [16..19] cancelled_count: uint32
 *   [20..23] final_frame: uint32
 *   [24..27] checksum: uint32 (FNV-1a hash of fired event frames, unit IDs/types, event types & args)
 *   [28..31] reserved: uint32 (0)
 */

import { parseVectorHeader, writeVectorHeader } from './vector-format.ts'
import {
  D2GameStrc,
  D2GameStrc_SIZE,
  D2UnitStrc,
  D2UnitStrc_SIZE,
  EVENT_DeleteEventByType113c,
  EVENT_InitTimerQueue113c,
  EVENT_RemoveUnitEvents113c,
  EVENT_SetEventFull113c,
  EVENT_SetPersistentEventFull113c,
  EVENT_UpdateTimers113c,
  SparseMemory113c,
} from '../../../src/d2kern-113c/index.ts'

export const EVTWHEEL_RECORD_SIZE = 32
export const EVTWHEEL_DEFAULT_SEED = 0xd2113ce7

const ACT_NONE = 0
const ACT_SELF_DELETE_BY_TYPE = 1
const ACT_DELETE_UNIT_TYPE = 2
const ACT_REMOVE_UNIT = 3
const ACT_SPAWN_TIMED = 4

const CUSTOM_HANDLER_TAG = 0x77770001

export interface EventWheelRecord {
  initialFrame: number
  eventCount: number
  advanceFrames: number
  firedCount: number
  cancelledCount: number
  finalFrame: number
  checksum: number
  reserved: number
}

export function encodeEventWheelRecord(rec: EventWheelRecord, target: Uint8Array, offset: number): void {
  const view = new DataView(target.buffer, target.byteOffset + offset, EVTWHEEL_RECORD_SIZE)
  view.setUint32(0, rec.initialFrame >>> 0, true)
  view.setUint32(4, rec.eventCount >>> 0, true)
  view.setUint32(8, rec.advanceFrames >>> 0, true)
  view.setUint32(12, rec.firedCount >>> 0, true)
  view.setUint32(16, rec.cancelledCount >>> 0, true)
  view.setUint32(20, rec.finalFrame >>> 0, true)
  view.setUint32(24, rec.checksum >>> 0, true)
  view.setUint32(28, rec.reserved >>> 0, true)
}

export function decodeEventWheelRecord(source: Uint8Array, offset: number): EventWheelRecord {
  const view = new DataView(source.buffer, source.byteOffset + offset, EVTWHEEL_RECORD_SIZE)
  return {
    initialFrame: view.getUint32(0, true),
    eventCount: view.getUint32(4, true),
    advanceFrames: view.getUint32(8, true),
    firedCount: view.getUint32(12, true),
    cancelledCount: view.getUint32(16, true),
    finalFrame: view.getUint32(20, true),
    checksum: view.getUint32(24, true),
    reserved: view.getUint32(28, true),
  }
}

function packAction(kind: number, p1: number, p2: number): number {
  return ((kind & 0xff) | ((p1 & 0xff) << 8) | ((p2 & 0xffff) << 16)) >>> 0
}

/**
 * Runs deterministic scenario `scenarioId` against `src/d2kern-113c/game/timer-wheel.ts`,
 * mirroring `tools/oracle/vectors/eventwheel-emitter.c` step for step.
 */
export function runEventWheelScenario113c(
  scenarioId: number,
  masterSeed: number = EVTWHEEL_DEFAULT_SEED,
): EventWheelRecord {
  const m = new SparseMemory113c()
  const pGame = m.alloc(D2GameStrc_SIZE)
  const units: number[] = []
  for (let u = 0; u < 16; u++) {
    const pUnit = m.alloc(D2UnitStrc_SIZE)
    m.set(pUnit, D2UnitStrc.dwUnitType, u % 5)
    m.set(pUnit, D2UnitStrc.dwUnitId, 100 + u)
    units.push(pUnit)
  }

  let eventCount = 0
  let firedCount = 0
  let cancelledCount = 0
  let checksum = 0x811c9dc5

  const fnvMix = (v: number): void => {
    checksum = Math.imul((checksum ^ (v >>> 0)) >>> 0, 0x01000193) >>> 0
  }

  let gen = ((masterSeed >>> 0) ^ Math.imul((scenarioId + 1) >>> 0, 0x9e3779b9)) >>> 0
  const nextRand = (): number => {
    gen = (Math.imul(gen, 1103515245) + 12345) >>> 0
    return gen
  }

  const family = (scenarioId >>> 6) & 3
  const sub = scenarioId & 63

  const baseFrames = [0, 1, 31, 62, 63, 64, 65, 127, 128, 511, 789, 820, 1023, 2048, 4095, 8192]
  const wrapDelays = [-5, -2, 0, 1, 2, 3, 62, 63, 64, 65, 66, 126, 127, 128, 129, 192]

  let initialFrame = 0
  let advanceFrames = 64

  if (family === 0) {
    initialFrame = (baseFrames[sub & 15]! + (sub >>> 4) * 7) >>> 0
    advanceFrames = 140 + (sub % 70)
  } else if (family === 1) {
    initialFrame = (100 + scenarioId * 3) >>> 0
    advanceFrames = 72
  } else if (family === 2) {
    initialFrame = (780 + sub) >>> 0
    advanceFrames = 80
  } else {
    initialFrame = (200 + sub * 11) >>> 0
    advanceFrames = sub < 8 ? 48 : 96
  }

  m.set(pGame, D2GameStrc.dwGameFrame, initialFrame)
  EVENT_InitTimerQueue113c(m, pGame)

  if (family === 0) {
    const numEvents = 16 + (sub % 16)
    for (let e = 0; e < numEvents; e++) {
      const r = nextRand()
      const uIdx = r % 17
      const pUnit = uIdx < 16 ? units[uIdx]! : 0
      const evType = (r >>> 8) % 14
      const d = wrapDelays[(e + (r >>> 16)) & 15]!
      let targetSigned = (initialFrame | 0) + d
      if (targetSigned === -1) targetSigned = -2
      EVENT_SetEventFull113c(m, pGame, pUnit, evType, targetSigned >>> 0, CUSTOM_HANDLER_TAG, e + 1, 0)
      eventCount++
    }
  } else if (family === 1) {
    const numPersist = 4 + (sub % 7)
    for (let p = 0; p < numPersist; p++) {
      const r = nextRand()
      const pUnit = units[r & 15]!
      const evType = (r >>> 4) % 14
      const act = (r >>> 12) & 1 ? packAction(ACT_SELF_DELETE_BY_TYPE, 0, 0) : 0
      EVENT_SetPersistentEventFull113c(m, pGame, pUnit, evType, CUSTOM_HANDLER_TAG, 0x100 + p, act)
      eventCount++
    }
    const sameSlotOffsets = [1, 2, 65, 66]
    const numTimed = 18 + (sub % 15)
    for (let e = 0; e < numTimed; e++) {
      const r = nextRand()
      const uIdx = r % 17
      const pUnit = uIdx < 16 ? units[uIdx]! : 0
      const evType = (r >>> 5) % 14
      const targetFrame = (initialFrame + sameSlotOffsets[(r >>> 10) & 3]!) >>> 0
      EVENT_SetEventFull113c(m, pGame, pUnit, evType, targetFrame, CUSTOM_HANDLER_TAG, 0x200 + e, 0)
      eventCount++
    }
    if ((sub & 1) !== 0) {
      EVENT_DeleteEventByType113c(m, pGame, units[sub & 15]!, sub % 14, CUSTOM_HANDLER_TAG)
      cancelledCount++
    }
    if ((sub & 2) !== 0) {
      EVENT_RemoveUnitEvents113c(m, pGame, units[(sub + 5) & 15]!)
      cancelledCount++
    }
  } else if (family === 2) {
    const numPersist = 5 + (sub % 6)
    for (let p = 0; p < numPersist; p++) {
      const r = nextRand()
      const uIdx = r & 15
      const evType = (r >>> 4) % 14
      const actChoice = (r >>> 8) & 3
      let act = 0
      if (actChoice === 0) act = packAction(ACT_SELF_DELETE_BY_TYPE, 0, 0)
      else if (actChoice === 1) act = packAction(ACT_DELETE_UNIT_TYPE, (uIdx + 1) & 15, evType)
      else if (actChoice === 2) act = packAction(ACT_REMOVE_UNIT, (uIdx + 3) & 15, 0)
      else act = packAction(ACT_SPAWN_TIMED, (uIdx + 2) & 15, 1 + ((r >>> 16) & 65))
      EVENT_SetPersistentEventFull113c(m, pGame, units[uIdx]!, evType, CUSTOM_HANDLER_TAG, 0x300 + p, act)
      eventCount++
    }
    const numTimed = 24 + (sub % 16)
    for (let e = 0; e < numTimed; e++) {
      const r = nextRand()
      const uIdx = r & 15
      const evType = (r >>> 4) % 6
      const delay = ((r >>> 10) & 3) === 0 ? 64 + ((r >>> 12) & 3) : 1 + ((r >>> 12) & 7)
      const actKind = (r >>> 16) % 5
      const act = packAction(actKind, (r >>> 20) & 15, (r >>> 24) & 0x7f)
      EVENT_SetEventFull113c(
        m,
        pGame,
        units[uIdx]!,
        evType,
        (initialFrame + delay) >>> 0,
        CUSTOM_HANDLER_TAG,
        0x400 + e,
        act,
      )
      eventCount++
    }
  } else {
    const totalInitial = sub < 8 ? 650 + sub * 40 : 32 + (sub % 48)
    for (let e = 0; e < totalInitial; e++) {
      const r = nextRand()
      const uIdx = r % 17
      const pUnit = uIdx < 16 ? units[uIdx]! : 0
      const evType = (r >>> 5) % 14
      if ((r & 15) === 0 && pUnit !== 0) {
        const act = packAction(ACT_SELF_DELETE_BY_TYPE, 0, 0)
        EVENT_SetPersistentEventFull113c(m, pGame, pUnit, evType, CUSTOM_HANDLER_TAG, 0x500 + e, act)
      } else {
        const delay = (r >>> 10) % 132
        let actKind = ((r >>> 20) & 7) < 4 ? (r >>> 20) & 3 : (r >>> 20) === 4 ? ACT_SPAWN_TIMED : ACT_NONE
        if (pUnit === 0 && actKind === ACT_SELF_DELETE_BY_TYPE) actKind = ACT_NONE
        const act = packAction(actKind, (r >>> 24) & 15, (r >>> 16) & 0x7f)
        let targetFrame = (initialFrame + delay) >>> 0
        if (targetFrame === 0xffffffff) targetFrame = 0
        EVENT_SetEventFull113c(m, pGame, pUnit, evType, targetFrame, CUSTOM_HANDLER_TAG, 0x600 + e, act)
      }
      eventCount++
    }
  }

  let curFrame = initialFrame
  for (let step = 0; step < advanceFrames; step++) {
    curFrame = (curFrame + 1) >>> 0
    m.set(pGame, D2GameStrc.dwGameFrame, curFrame)
    EVENT_UpdateTimers113c(m, pGame, (_mem, g, pUnit, evType, arg14, arg18) => {
      const cf = m.get(g, D2GameStrc.dwGameFrame) >>> 0
      const uType = pUnit !== 0 ? m.get(pUnit, D2UnitStrc.dwUnitType) >>> 0 : 6
      const uId = pUnit !== 0 ? m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0 : 0xffffffff

      firedCount++
      fnvMix(cf)
      fnvMix(uType)
      fnvMix(uId)
      fnvMix(evType & 0xff)
      fnvMix(arg14 >>> 0)
      fnvMix(arg18 >>> 0)

      const actKind = arg18 & 0xff
      const actParam1 = (arg18 >>> 8) & 0xff
      const actParam2 = (arg18 >>> 16) & 0xffff

      if (actKind === ACT_SELF_DELETE_BY_TYPE) {
        if (pUnit !== 0) {
          EVENT_DeleteEventByType113c(m, g, pUnit, evType & 0xff, CUSTOM_HANDLER_TAG)
          cancelledCount++
        }
      } else if (actKind === ACT_DELETE_UNIT_TYPE) {
        const targetUnit = units[actParam1 & 15]!
        const targetType = actParam2 % 14
        EVENT_DeleteEventByType113c(m, g, targetUnit, targetType, CUSTOM_HANDLER_TAG)
        cancelledCount++
      } else if (actKind === ACT_REMOVE_UNIT) {
        const targetUnit = units[actParam1 & 15]!
        EVENT_RemoveUnitEvents113c(m, g, targetUnit)
        cancelledCount++
      } else if (actKind === ACT_SPAWN_TIMED) {
        const targetUnit = units[actParam1 & 15]!
        const delay = actParam2 & 0xff
        let targetFrame = (cf + delay) >>> 0
        if (targetFrame === 0xffffffff) targetFrame = 0
        const nextType = (evType + 1) % 14
        EVENT_SetEventFull113c(
          m,
          g,
          targetUnit,
          nextType,
          targetFrame,
          CUSTOM_HANDLER_TAG,
          (arg14 + 0x10000) >>> 0,
          0,
        )
        eventCount++
      }
    })
  }

  return {
    initialFrame,
    eventCount,
    advanceFrames,
    firedCount,
    cancelledCount,
    finalFrame: curFrame,
    checksum,
    reserved: 0,
  }
}

export function generateEventWheelVectors(count: number = 256, masterSeed: number = EVTWHEEL_DEFAULT_SEED): Uint8Array {
  const totalSize = 32 + count * EVTWHEEL_RECORD_SIZE
  const buffer = new Uint8Array(totalSize)
  const header = writeVectorHeader('EVTWHEEL', EVTWHEEL_RECORD_SIZE, count, BigInt(masterSeed >>> 0))
  buffer.set(header, 0)

  for (let i = 0; i < count; i++) {
    const rec = runEventWheelScenario113c(i, masterSeed)
    encodeEventWheelRecord(rec, buffer, 32 + i * EVTWHEEL_RECORD_SIZE)
  }
  return buffer
}

export function verifyEventWheelVectors(vectorBytes: Uint8Array): {
  passed: number
  total: number
  totalFired: number
  errors: string[]
} {
  const header = parseVectorHeader(vectorBytes)
  if (header.kind !== 'EVTWHEEL') {
    throw new Error(`Unexpected kind: ${header.kind} (expected EVTWHEEL)`)
  }
  if (header.recordSize !== EVTWHEEL_RECORD_SIZE) {
    throw new Error(`Mismatched record size: ${header.recordSize} != ${EVTWHEEL_RECORD_SIZE}`)
  }

  const masterSeed = Number(header.seed & 0xffffffffn) >>> 0
  const errors: string[] = []
  let passed = 0
  let totalFired = 0

  for (let i = 0; i < header.recordCount; i++) {
    const expected = decodeEventWheelRecord(vectorBytes, 32 + i * EVTWHEEL_RECORD_SIZE)
    const actual = runEventWheelScenario113c(i, masterSeed)
    totalFired += actual.firedCount

    if (
      actual.initialFrame !== expected.initialFrame ||
      actual.eventCount !== expected.eventCount ||
      actual.advanceFrames !== expected.advanceFrames ||
      actual.firedCount !== expected.firedCount ||
      actual.cancelledCount !== expected.cancelledCount ||
      actual.finalFrame !== expected.finalFrame ||
      actual.checksum !== expected.checksum
    ) {
      errors.push(
        `Scenario #${i} (family ${i >>> 6}) mismatch: ` +
          `expected [events=${expected.eventCount}, fired=${expected.firedCount}, cancel=${expected.cancelledCount}, end=${expected.finalFrame}, csum=0x${expected.checksum.toString(16)}], ` +
          `got [events=${actual.eventCount}, fired=${actual.firedCount}, cancel=${actual.cancelledCount}, end=${actual.finalFrame}, csum=0x${actual.checksum.toString(16)}]`,
      )
      if (errors.length >= 10) break
    } else {
      passed++
    }
  }

  return { passed, total: header.recordCount, totalFired, errors }
}

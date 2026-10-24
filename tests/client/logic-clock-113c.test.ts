/**
 * Issue #808 Step 3 — the browser main loop follows the Diablo II 1.13c D2Client tick schedule.
 *
 * Ground truth (D2Client.dll 1.13c, remote-game branch of the main-loop pass):
 *  - tick length `[0x6FBA4318]` = 40 ms;
 *  - elapsed < 40 → no tick (`jb` @0x6FAF4C8B);
 *  - normal pass: one tick, then `lastTick = oldLastTick + 40` (0x6FAF4D67..0x6FAF4D79), so
 *    missed time is caught up tick by tick with the draw skipped;
 *  - while `now < [0x6FBC981C]`: one tick, `lastTick = now - min(elapsed - 40, 39)`
 *    (0x6FAF4CA2..0x6FAF4CB1), the rest of the debt is dropped;
 *  - `[0x6FBC981C]` only rises: 0x03 LoadAct → `now + 10000` (0x6FAF40A4), 0x15 Reassign of the
 *    local player → `now + 3000` (0x6FB5F717);
 *  - the tick body 0x6FAF4A80 re-reads GetTickCount into `[0x6FBC97EC]` first (0x6FAF4A81..89),
 *    so every tick runs on real time.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  D2_LOGIC_TICK_MS,
  LOAD_ACT_NO_CATCH_UP_MS,
  LOCAL_REASSIGN_NO_CATCH_UP_MS,
  LogicClock,
  MAX_CATCH_UP_TICKS,
  NO_CATCH_UP_MAX_CARRY_MS,
  runOwedTicks,
} from '../../src/client/loop/logic-clock.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('#808 LogicClock — D2Client 1.13c tick schedule (0x6FAF4C6F..0x6FAF4D79)', () => {
  it('uses the binary constants: 40 ms tick, 39 ms window carry, 10 s / 3 s windows', () => {
    expect(D2_LOGIC_TICK_MS).toBe(40)
    expect(NO_CATCH_UP_MAX_CARRY_MS).toBe(39)
    expect(LOAD_ACT_NO_CATCH_UP_MS).toBe(0x2710)
    expect(LOCAL_REASSIGN_NO_CATCH_UP_MS).toBe(0xbb8)
  })

  it('runs no tick before 40 ms and then one tick, lastTick = lastTick + 40', () => {
    const clock = new LogicClock(1000)
    expect(clock.advance(1000)).toBe(0)
    expect(clock.advance(1039)).toBe(0)
    expect(clock.advance(1040)).toBe(1)
    expect(clock.getLastTickMs()).toBe(1040)
    expect(clock.advance(1079.9)).toBe(0)
  })

  it('keeps the debt: a 100 ms frame runs two ticks and the 20 ms remainder carries over', () => {
    const clock = new LogicClock(1000)
    expect(clock.advance(1100)).toBe(2)
    expect(clock.getLastTickMs()).toBe(1080)
    // Only 20 ms later, the carried 20 ms makes the next tick due (the old loop dropped it).
    expect(clock.advance(1120)).toBe(1)
    expect(clock.getLastTickMs()).toBe(1120)
  })

  it('catches up a 1 s stall with 25 ticks and a 10 s stall with 250 (no 100/200 ms clamp)', () => {
    const clock = new LogicClock(1000)
    expect(clock.advance(2000)).toBe(25)
    expect(clock.getLastTickMs()).toBe(2000)
    expect(clock.advance(12000)).toBe(250)
    expect(clock.getLastTickMs()).toBe(12000)
  })

  it('caps extreme background-tab/sleep stalls (> 10 s) at MAX_CATCH_UP_TICKS (250) while preserving sub-tick phase', () => {
    const clock = new LogicClock(1000)
    // 60 s background tab throttling + 15 ms sub-tick remainder
    expect(clock.advance(61_015)).toBe(MAX_CATCH_UP_TICKS)
    expect(clock.getLastTickMs()).toBe(61_000)
    // Only 25 ms later, the preserved 15 ms remainder triggers the next 40 ms tick
    expect(clock.advance(61_040)).toBe(1)
    expect(clock.getLastTickMs()).toBe(61_040)
  })

  it('inside a no-catch-up window runs one tick per frame and keeps at most 39 ms of debt', () => {
    const clock = new LogicClock(1000)
    clock.suppressCatchUp(5000)
    // elapsed 1000: one tick; lastTick = now - min(960, 39).
    expect(clock.advance(2000)).toBe(1)
    expect(clock.getLastTickMs()).toBe(1961)
    // The 39 ms carry makes the very next millisecond due; the carry is min(0, 39) = 0.
    expect(clock.advance(2001)).toBe(1)
    expect(clock.getLastTickMs()).toBe(2001)
    // A 45 ms frame in the window carries the 5 ms excess (min(5, 39)).
    expect(clock.advance(2046)).toBe(1)
    expect(clock.getLastTickMs()).toBe(2041)
  })

  it('leaves the window at exactly the deadline (jae @0x6FAF4CA0) and catches up again', () => {
    const clock = new LogicClock(1000)
    clock.suppressCatchUp(2000)
    expect(clock.advance(1999)).toBe(1)
    expect(clock.getLastTickMs()).toBe(1960)
    // now == deadline: normal pass, debt kept.
    expect(clock.advance(2000)).toBe(1)
    expect(clock.getLastTickMs()).toBe(2000)
    expect(clock.advance(2200)).toBe(5)
    expect(clock.getLastTickMs()).toBe(2200)
  })

  it('suppressCatchUp only ever raises the deadline (cmp eax,ecx ; jbe)', () => {
    const clock = new LogicClock(0)
    expect(clock.getNoCatchUpUntilMs()).toBe(0)
    clock.suppressCatchUp(5000)
    clock.suppressCatchUp(3000)
    expect(clock.getNoCatchUpUntilMs()).toBe(5000)
    clock.suppressCatchUp(8000)
    expect(clock.getNoCatchUpUntilMs()).toBe(8000)
  })

  it('treats a frame timestamp behind the last tick as no tick due', () => {
    const clock = new LogicClock(1000)
    expect(clock.advance(999.5)).toBe(0)
    expect(clock.getLastTickMs()).toBe(1000)
  })

  it('reset() restarts the schedule with no debt', () => {
    const clock = new LogicClock(0)
    clock.reset(50_000)
    expect(clock.advance(50_039)).toBe(0)
    expect(clock.advance(50_040)).toBe(1)
  })

  it('fails fast on non-finite times', () => {
    expect(() => new LogicClock(Number.NaN)).toThrow(RangeError)
    const clock = new LogicClock(0)
    expect(() => clock.advance(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => clock.reset(Number.NaN)).toThrow(RangeError)
    expect(() => clock.suppressCatchUp(Number.NaN)).toThrow(RangeError)
  })

  it('runOwedTicks runs each owed 40 ms tick on the real now (GetTickCount @0x6FAF4A81)', () => {
    const clock = new LogicClock(1000)
    const calls: Array<[number, number]> = []
    const tick = (dtMs: number, nowMs: number): void => {
      calls.push([dtMs, nowMs])
    }
    expect(runOwedTicks(clock, 1130, tick)).toBe(3)
    expect(calls).toEqual([
      [40, 1130],
      [40, 1130],
      [40, 1130],
    ])
    expect(runOwedTicks(clock, 1135, tick)).toBe(0)
    expect(calls).toHaveLength(3)
  })
})

describe('#808 OnlineSession raises the no-catch-up deadline like D2Client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function sessionWithSelf(): OnlineSession {
    const session = new OnlineSession({ world: new ClientWorld() })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000, direction: 0 },
    })
    return session
  }

  it('0x03 LoadAct → now + 10000 (0x6FB5DB50 → 0x6FAF3F90 → 0x6FAF40A4)', () => {
    const session = sessionWithSelf()
    vi.spyOn(performance, 'now').mockReturnValue(70_000)
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
    expect(session.logicClock.getNoCatchUpUntilMs()).toBe(80_000)
  })

  it('0x15 Reassign of the local player → now + 3000 (0x6FB5F6EC / 0x6FB5F717)', () => {
    const session = sessionWithSelf()
    vi.spyOn(performance, 'now').mockReturnValue(90_000)
    session.handleServerEvent({
      type: 'UnitReassign',
      unitType: 'player',
      id: 1,
      at: { x: 5100, y: 5120 },
      snap: false,
    })
    expect(session.logicClock.getNoCatchUpUntilMs()).toBe(93_000)
  })

  it('0x15 Reassign of any other unit leaves the deadline alone', () => {
    const session = sessionWithSelf()
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 300, classId: 19, x: 5010, y: 5010, direction: 0, mode: 1, lifePct: 128 },
    })
    const before = session.logicClock.getNoCatchUpUntilMs()
    vi.spyOn(performance, 'now').mockReturnValue(90_000)
    session.handleServerEvent({
      type: 'UnitReassign',
      unitType: 'monster',
      id: 300,
      at: { x: 5020, y: 5020 },
      snap: false,
    })
    expect(session.logicClock.getNoCatchUpUntilMs()).toBe(before)
  })

  it('a 1 s stall outside any window runs 25 session ticks; inside the LoadAct window only one', () => {
    const session = sessionWithSelf()
    const sessionTick = vi.spyOn(session, 'tick')
    const tick = (dtMs: number, nowMs: number): void => {
      session.tick(dtMs, nowMs)
    }
    session.logicClock.reset(100_000)
    expect(runOwedTicks(session.logicClock, 101_000, tick)).toBe(25)
    expect(sessionTick).toHaveBeenCalledTimes(25)
    expect(sessionTick).toHaveBeenLastCalledWith(40, 101_000)

    vi.spyOn(performance, 'now').mockReturnValue(101_000)
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
    sessionTick.mockClear()
    expect(runOwedTicks(session.logicClock, 102_000, tick)).toBe(1)
    expect(sessionTick).toHaveBeenCalledTimes(1)
  })
})

import { describe, expect, it } from 'vitest'
import {
  CLIENTFN_KEEPER_SOUND,
  CLIENTFN_NPCALERT_OVERLAY,
  runObjectClientFn113c,
  type ClientFnObject,
} from '../../src/client/world/object-client-fn-113c.ts'
import { OBJECTS_TXT_113C } from '../../src/common/world/objects-txt-113c.ts'

function obj(classId: number, mode = 0, seed = { lo: 12345, hi: 666 }): ClientFnObject {
  return { classId, mode, seed: { ...seed }, clientFnTimer: 0, clientFnInit: 0 }
}
const ctx = (nowMs: number, dist = 0) => ({ nowMs, distanceToLocalPlayer: () => dist })

describe('Objects.txt ClientFn handlers (D2Client 0x6fba54e8, #1518..#1522)', () => {
  it('Objects.txt binds the ported handlers to the documented objects', () => {
    expect(OBJECTS_TXT_113C[558]!.clientFn).toBe(15)
    for (const id of [67, 68, 69, 70]) expect(OBJECTS_TXT_113C[id]!.clientFn).toBe(2)
    expect(OBJECTS_TXT_113C[259]!.clientFn).toBe(7)
    expect(OBJECTS_TXT_113C[373]!.clientFn).toBe(7)
    expect(OBJECTS_TXT_113C[478]!.clientFn).toBe(9)
    expect(OBJECTS_TXT_113C[528]!.clientFn).toBe(10)
    expect(OBJECTS_TXT_113C[568]!.clientFn).toBe(18)
  })

  it('ClientFn 15 (Frozen Anya, 0x6fad5890): npcalert while in mode 0, every 500 ms', () => {
    const u = obj(558, 0)
    expect(runObjectClientFn113c(u, 15, ctx(1000))).toEqual([{ kind: 'addOverlay', overlay: CLIENTFN_NPCALERT_OVERLAY }])
    expect(u.clientFnTimer).toBe(1500)
    expect(runObjectClientFn113c(u, 15, ctx(1500))).toEqual([])
    u.mode = 1
    expect(runObjectClientFn113c(u, 15, ctx(1501))).toEqual([{ kind: 'removeOverlay', overlay: CLIENTFN_NPCALERT_OVERLAY }])
  })

  it('ClientFn 2 (light rays, 0x6fad4870): seeded 0..63 frame delay, 0 -> 1, and 2 -> 0 with a new delay', () => {
    const u = obj(67, 0)
    let first = -1
    for (let frame = 0; frame < 70 && first < 0; frame += 1) {
      const fx = runObjectClientFn113c(u, 2, ctx(frame * 40))
      if (fx.some((e) => e.kind === 'setMode')) first = frame
    }
    expect(first).toBeGreaterThanOrEqual(0)
    expect(u.mode).toBe(1)
    u.mode = 2 // the one-shot mode-1 animation ended (0x6fad5660)
    const back = runObjectClientFn113c(u, 2, ctx(5000))
    expect(back).toEqual([{ kind: 'setMode', mode: 0 }])
    expect(u.mode).toBe(0)
  })

  it('ClientFn 7 (0x6fad4da0): mode 1 after 10 s, back to 0 after 4.5..7.5 s', () => {
    const u = obj(259, 0)
    expect(runObjectClientFn113c(u, 7, ctx(1))).toEqual([{ kind: 'setMode', mode: 1 }])
    expect(u.clientFnTimer).toBe(10001)
    expect(runObjectClientFn113c(u, 7, ctx(10001))).toEqual([])
    expect(runObjectClientFn113c(u, 7, ctx(10002))).toEqual([{ kind: 'setMode', mode: 0 }])
    expect(u.clientFnTimer - 10002).toBeGreaterThanOrEqual(0x1194)
    expect(u.clientFnTimer - 10002).toBeLessThan(0x1d4c)
  })

  it('ClientFn 10 (shrub, 0x6fad4d10): mode 1 after 3 s, back after 2.5..7.5 s', () => {
    const u = obj(528, 0)
    runObjectClientFn113c(u, 10, ctx(1))
    expect(u.mode).toBe(1)
    expect(u.clientFnTimer).toBe(3001)
    runObjectClientFn113c(u, 10, ctx(3002))
    expect(u.mode).toBe(0)
    expect(u.clientFnTimer - 3002).toBeGreaterThanOrEqual(0x9c4)
  })

  it('ClientFn 9 (clientsmoke, 0x6fad58f0): removed after > 1 s once farther than 25', () => {
    const u = obj(478)
    expect(runObjectClientFn113c(u, 9, ctx(100, 40))).toEqual([])
    expect(runObjectClientFn113c(u, 9, ctx(1100, 40))).toEqual([])
    expect(runObjectClientFn113c(u, 9, ctx(1101, 25))).toEqual([])
    expect(u.clientFnTimer).toBe(1101)
    expect(runObjectClientFn113c(u, 9, ctx(2200, 26))).toEqual([{ kind: 'removeUnit' }])
  })

  it('ClientFn 18 (Keeper, 0x6fad49e0): 10 % chance of sound 2505, next check in 0..59 s', () => {
    let plays = 0
    const u = obj(568)
    let now = 1
    for (let i = 0; i < 2000; i += 1) {
      const fx = runObjectClientFn113c(u, 18, ctx(now))
      if (fx.length > 0) {
        expect(fx).toEqual([{ kind: 'playSound', soundId: CLIENTFN_KEEPER_SOUND }])
        plays += 1
      }
      expect((u.clientFnTimer - now) % 1000).toBe(0)
      expect(u.clientFnTimer - now).toBeLessThan(60000)
      now = u.clientFnTimer + 1
    }
    expect(plays).toBeGreaterThan(100)
    expect(plays).toBeLessThan(320)
  })
})

/**
 * Refs #916 — S2C 0x76 and D2GS listener-error parity.
 *
 * Ground truth (1.13c):
 * - S2C 0x76 (D2Client.dll 0x6FB5D370, 6 bytes `76 type id32`): looks the unit up (0x6FB54E20) and frees its
 *   overhead hover message at unit+0xA4 (D2Common #10422 CHAT_FreeHoverMsg). It never touches mode, HP or
 *   UNITFLAG_ISDEAD. The server (D2MOO `sub_6FCC5FA0`) sends it when a unit's hover text expired or was freed
 *   at death (`sub_6FC63E80`). The port used to decode it as `UnitMode mode=1`, which stood dead units back up.
 * - D2gsAdapter must not silently swallow exceptions thrown while a listener applies an event (AGENTS.md
 *   anti-silent-failure): they are counted and reported via console.error, and later packets still apply.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { D2gsAdapter } from '../../src/netproto/d2gs/adapter.ts'
import type { D2gsSession } from '../../src/netproto/d2gs/session.ts'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'
import type { ServerEvent } from '../../src/netproto/domain/server-event.ts'

const u32 = (v: number): number[] => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]
const u16 = (v: number): number[] => [v & 255, (v >>> 8) & 255]

const pkt76 = (type: number, id: number): Uint8Array => new Uint8Array([0x76, type, ...u32(id)])
const pkt69 = (id: number, cmd: number, x: number, y: number): Uint8Array =>
  new Uint8Array([0x69, ...u32(id), cmd, ...u16(x), ...u16(y), 0, 0])

describe('S2C 0x76 HoverTextClear (D2Client 0x6FB5D370)', () => {
  it('decodes real bytes to a hover-text clear, not a mode change', () => {
    const ev = decodeD2gsS2cPacket(pkt76(1, 0x12345678))
    expect(ev).toEqual({ type: 'UnitHoverTextClear', rawUnitType: 1, id: 0x12345678 })
    expect('mode' in ev).toBe(false)
  })

  it('rejects a wrong-sized packet (fixed 6-byte handler)', () => {
    expect(() => decodeD2gsS2cPacket(new Uint8Array([0x76, 1, 0, 0, 0, 0, 0]))).toThrow()
  })

  it('a dead monster stays dead (DT/DD, ISDEAD) after 0x76 and only loses its overhead text', () => {
    const w = new ClientWorld()
    w.applyEvent(
      { type: 'UnitAssign', unit: { unitType: 1, id: 77, classId: 235, x: 5000, y: 5000, mode: 1, lifePct: 128, direction: 0 } } as never,
      0,
    )
    w.applyEvent(decodeD2gsS2cPacket(pkt69(77, 0x08, 5000, 5000)), 40)
    const u = w.getUnit(1 as never, 77)!
    expect(u.dead).toBe(true)
    expect(u.mode).toBe(0)
    u.overheadText = 'zakarum'

    w.applyEvent(decodeD2gsS2cPacket(pkt76(1, 77)), 80)
    expect(u.dead).toBe(true)
    expect(u.mode).toBe(0)
    expect(u.lifePct).toBe(0)
    expect(u.overheadText).toBeUndefined()

    w.applyEvent(decodeD2gsS2cPacket(pkt69(77, 0x09, 5000, 5000)), 120)
    w.applyEvent(decodeD2gsS2cPacket(pkt76(1, 77)), 160)
    expect(u.dead).toBe(true)
    expect(u.mode).toBe(12)
  })

  it('a dead player stays in DD (17) after 0x76', () => {
    const w = new ClientWorld()
    w.applyEvent(
      { type: 'UnitAssign', unit: { unitType: 0, id: 5, classId: 1, x: 5000, y: 5000, mode: 17, lifePct: 0, name: 'Corpse' } } as never,
      0,
    )
    const p = w.getUnit(0 as never, 5)!
    expect(p.mode).toBe(17)
    p.overheadText = 'help'
    w.applyEvent(decodeD2gsS2cPacket(pkt76(0, 5)), 40)
    expect(p.mode).toBe(17)
    expect(p.overheadText).toBeUndefined()
  })

  it('ignores unknown units and the no-unit form (type 6 / id 0xFFFFFFFF)', () => {
    const w = new ClientWorld()
    expect(() => w.applyEvent(decodeD2gsS2cPacket(pkt76(6, 0xffffffff)), 0)).not.toThrow()
    expect(() => w.applyEvent(decodeD2gsS2cPacket(pkt76(1, 999)), 0)).not.toThrow()
    expect(w.getUnit(1 as never, 999)).toBeUndefined()
  })
})

function makeFakeSession(): { session: D2gsSession; push: (pkt: Uint8Array) => void } {
  let cb: ((pkt: Uint8Array) => void) | null = null
  const session = {
    onPacket(fn: (pkt: Uint8Array) => void) {
      cb = fn
      return () => {
        cb = null
      }
    },
    rttMs: 0,
    state: 'ingame',
    stats: { rttMs: 0, bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 },
  } as unknown as D2gsSession
  return { session, push: (pkt) => cb?.(pkt) }
}

describe('D2gsAdapter listener errors are reported, not swallowed', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports a throwing listener via console.error (opcode, hex, stack), counts it, and keeps dispatching', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { session, push } = makeFakeSession()
    const adapter = new D2gsAdapter({ session, tables: {} as never })
    const seen: ServerEvent[] = []
    adapter.onEvent((ev) => {
      if (ev.type === 'UnitMode') throw new Error('boom while applying death')
      seen.push(ev)
    })

    push(pkt69(77, 0x08, 5000, 5000))
    push(pkt76(1, 77))

    expect(adapter.listenerErrors).toBe(1)
    expect(adapter.stats.protocolErrors).toBe(1)
    expect(errSpy).toHaveBeenCalledTimes(1)
    const msg = String(errSpy.mock.calls[0]![0])
    expect(msg).toContain('S2C 0x69')
    expect(msg).toContain('listener (UnitMode)')
    expect(msg).toContain('69 4d 00 00 00 08')
    expect(msg).toContain('boom while applying death')
    expect(msg).toMatch(/at /) // stack trace
    expect(seen.map((e) => e.type)).toEqual(['UnitHoverTextClear'])
  })

  it('reports listener errors for events buffered before the first listener attached', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { session, push } = makeFakeSession()
    const adapter = new D2gsAdapter({ session, tables: {} as never })
    push(pkt76(1, 77))
    expect(() =>
      adapter.onEvent(() => {
        throw new Error('early boom')
      }),
    ).not.toThrow()
    expect(adapter.listenerErrors).toBe(1)
    expect(String(errSpy.mock.calls[0]![0])).toContain('S2C 0x76')
  })

  it('reports decode failures loudly too', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { session, push } = makeFakeSession()
    const adapter = new D2gsAdapter({ session, tables: {} as never })
    adapter.onEvent(() => {})
    push(new Uint8Array([0x69, 1, 2]))
    expect(adapter.stats.protocolErrors).toBe(1)
    expect(adapter.listenerErrors).toBe(0)
    expect(String(errSpy.mock.calls[0]![0])).toContain('S2C 0x69 decode failed')
  })
})

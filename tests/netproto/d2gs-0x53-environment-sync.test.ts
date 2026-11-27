/**
 * S2C 0x53 EnvironmentSync (1.13c): the game server's act environment clock.
 *
 * Ground truth (1.13c binaries, see docs/environment_daynight_113c.md):
 * - D2Client handler 0x6fb5e9c0 reads `u32 cycleIndex @1`, `i32 ticks @5`, `u8 eclipse @9` and, when the
 *   client act is the player's act (`player->pAct` at 0x6fb5e9c5, no null check), calls D2Common #10358
 *   `InitializeEnvironment(gpAct, GetRoom(player), cycleIndex, ticks, eclipse)` (0x6fd87920) and then
 *   the EnvEffect refresh 0x6fb56680.
 * - Packet size 10 (`D2GS_S2C_PACKET_SIZES[0x53]`).
 * - Every real 1.13c capture under tests/fixtures/netproto sends it right after 0x03 LoadAct with the
 *   fresh act clock of a new game: `53 02000000 00000000 00` (noon row, tick 0, no eclipse).
 */

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PeriodOfDay } from '../../src/common/world/environment.ts'
import { decodeCapturedGameS2cPacket, OnlineSession } from '../../src/client/session/online-session.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'
import { ProtocolError } from '../../src/netproto/core/errors.ts'
import { parseD2CapJsonl } from '../../src/netproto/core/packet-tap.ts'
import { D2GS_S2C_REGISTRY, decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'
import type { ServerEvent } from '../../src/netproto/domain/server-event.ts'

type EnvironmentSyncEvent = Extract<ServerEvent, { type: 'EnvironmentSync' }>

const FIXTURE_DIR = resolve(process.cwd(), 'tests/fixtures/netproto')
const CAPTURES: ReadonlyArray<{ readonly name: string; readonly text: string }> = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith('.d2cap'))
  .sort()
  .map((name) => ({ name, text: readFileSync(resolve(FIXTURE_DIR, name), 'utf8') }))

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** The raw game S2C packets of a capture, in wire order. */
function gameS2cPackets(text: string): Uint8Array[] {
  const out: Uint8Array[] = []
  for (const record of parseD2CapJsonl(text).records) {
    if (record.conn === 'game' && record.dir === 's2c') out.push(hexToBytes(record.hex))
  }
  return out
}

/** A 0x53 packet with the given fields (little-endian, 10 bytes). */
function packet0x53(cycleIndex: number, ticks: number, eclipseByte: number): Uint8Array {
  const pkt = new Uint8Array(10)
  const view = new DataView(pkt.buffer)
  pkt[0] = 0x53
  view.setUint32(1, cycleIndex >>> 0, true)
  view.setUint32(5, ticks >>> 0, true)
  pkt[9] = eclipseByte
  return pkt
}

function sync(cycleIndex: number, ticks: number, eclipse: boolean): EnvironmentSyncEvent {
  return { type: 'EnvironmentSync', cycleIndex, ticks, eclipse }
}

describe('S2C 0x53 EnvironmentSync decoder (1.13c)', () => {
  it('is registered as EnvironmentSync on the 1.13c handler 0x6fb5e9c0', () => {
    expect(D2GS_S2C_REGISTRY[0x53]?.name).toBe('EnvironmentSync')
    expect(D2GS_S2C_REGISTRY[0x53]?.d2ClientHandlerVa).toBe('0x6fb5e9c0')
  })

  it('decodes the captured 1.13c packet to the new-game clock (cycle 2, tick 0, no eclipse)', () => {
    const captured = hexToBytes('53020000000000000000')
    expect(decodeD2gsS2cPacket(captured)).toEqual(sync(2, 0, false))
    expect(decodeCapturedGameS2cPacket(captured)).toEqual(sync(2, 0, false))
  })

  it('decodes the cycle index, the signed tick count and the eclipse byte', () => {
    // Night row at 200 degrees (200 * 128 = 25600 ticks).
    expect(decodeD2gsS2cPacket(packet0x53(5, 25600, 0))).toEqual(sync(5, 25600, false))
    // Eclipse night row at 120 degrees.
    expect(decodeD2gsS2cPacket(packet0x53(3, 15360, 1))).toEqual(sync(3, 15360, true))
    // The tick field is an int: 0xFFFFFFFF is -1 (the session then rejects it).
    expect(decodeD2gsS2cPacket(packet0x53(2, -1, 0))).toEqual(sync(2, -1, false))
    // The eclipse byte is tested for non-zero.
    expect(decodeD2gsS2cPacket(packet0x53(0, 0, 2))).toEqual(sync(0, 0, true))
    // The cycle index is a u32 and is decoded as such (range checks belong to InitializeEnvironment).
    expect(decodeD2gsS2cPacket(packet0x53(6, 0, 0))).toEqual(sync(6, 0, false))
  })

  it('rejects a 0x53 whose length differs from the 10-byte 1.13c size', () => {
    expect(() => decodeD2gsS2cPacket(new Uint8Array(9).fill(0x53, 0, 1))).toThrow(ProtocolError)
    expect(() => decodeD2gsS2cPacket(new Uint8Array(11).fill(0x53, 0, 1))).toThrow(ProtocolError)
  })

  it('every real capture sends exactly one 0x53, right after 0x03 LoadAct, with the new-game clock', () => {
    let gameCaptures = 0
    for (const { name, text } of CAPTURES) {
      const packets = gameS2cPackets(text)
      if (packets.length === 0) continue
      gameCaptures += 1
      const syncIndices = packets.flatMap((pkt, i) => (pkt[0] === 0x53 ? [i] : []))
      expect(syncIndices, name).toHaveLength(1)
      const index = syncIndices[0]!
      expect(packets[index - 1]?.[0], `${name}: packet before 0x53`).toBe(0x03)
      expect(decodeCapturedGameS2cPacket(packets[index]!), name).toEqual(sync(2, 0, false))
    }
    expect(gameCaptures).toBeGreaterThan(0)
  })
})

describe('S2C 0x53 EnvironmentSync through OnlineSession', () => {
  it('replays every real capture: the client act clock is initialized to noon, tick 0, intensity 128', () => {
    for (const { name, text } of CAPTURES) {
      if (gameS2cPackets(text).length === 0) continue
      const session = new OnlineSession({ settingsStore: createSettingsStore() })
      try {
        const syncs: EnvironmentSyncEvent[] = []
        session.onServerEvent((ev) => {
          if (ev.type === 'EnvironmentSync') syncs.push(ev)
        })
        session.loadD2CapReplay(text)
        session.replayAllD2Cap()
        expect(syncs, name).toEqual([sync(2, 0, false)])
        expect(session.disconnectReason, name).toBeNull()
        const env = session.environment
        expect(
          {
            cycleIndex: env.cycleIndex,
            period: env.period,
            ticks: env.ticks,
            intensity: env.intensity,
            rgb: [env.red, env.green, env.blue],
            eclipse: env.eclipse,
          },
          name,
        ).toEqual({ cycleIndex: 2, period: PeriodOfDay.Day, ticks: 0, intensity: 128, rgb: [255, 255, 255], eclipse: false })
      } finally {
        session.destroy()
      }
    }
  })

  it('applies a later 0x53 to the same client act (night row, then an eclipse sync)', () => {
    const session = new OnlineSession({ settingsStore: createSettingsStore() })
    try {
      session.loadD2CapReplay(CAPTURES.find((c) => c.name.startsWith('02-'))!.text)
      session.replayAllD2Cap()

      session.handleS2cPacket(packet0x53(5, 25600, 0))
      expect(session.disconnectReason).toBeNull()
      expect(session.environment.cycleIndex).toBe(5)
      expect(session.environment.period).toBe(PeriodOfDay.Night)
      expect(session.environment.ticks).toBe(25600)
      // sin(200 deg) * 0.5 * 128 + 128 + 0.5 truncated (InitializeEnvironment computes the intensity once).
      expect(session.environment.intensity).toBe(106)

      // Eclipse: the first intensity pass still runs with the old (non-eclipse) flag on the received
      // ticks (sin 7.8125 deg → 145), then ticks snap to the eclipse row (120 deg) and the eclipse decay
      // subtracts 8; the colour comes from the eclipse table.
      session.handleS2cPacket(packet0x53(3, 1000, 1))
      expect(session.disconnectReason).toBeNull()
      expect(session.environment.eclipse).toBe(true)
      expect(session.environment.period).toBe(PeriodOfDay.Night)
      expect(session.environment.ticks).toBe(120 * 128)
      expect(session.environment.intensity).toBe(137)
      expect([session.environment.red, session.environment.green, session.environment.blue]).toEqual([0, 30, 243])
    } finally {
      session.destroy()
    }
  })

  it('disconnects on a 0x53 before 0x59 AssignPlayer (the handler dereferences the player unit)', () => {
    const session = new OnlineSession({ settingsStore: createSettingsStore() })
    try {
      expect(session.world.selfId).toBe(0)
      session.handleServerEvent(sync(2, 0, false))
      expect(session.disconnectReason).toContain('0x53 EnvironmentSync before 0x59 AssignPlayer')
    } finally {
      session.destroy()
    }
  })

  it('disconnects on a 0x53 after 0x59 but before 0x03 LoadAct (no client act)', () => {
    const session = new OnlineSession({ settingsStore: createSettingsStore() })
    try {
      session.loadD2CapReplay(CAPTURES.find((c) => c.name.startsWith('02-'))!.text)
      while (session.world.selfId === 0) {
        const frame = session.stepD2CapReplay()
        if (frame === null) throw new Error('capture ended before 0x59 AssignPlayer')
        expect(frame.conn === 'game' && frame.dir === 's2c' && frame.opcode === 0x03).toBe(false)
      }
      session.handleServerEvent(sync(2, 0, false))
      expect(session.disconnectReason).toContain('0x53 EnvironmentSync before 0x03 LoadAct')
    } finally {
      session.destroy()
    }
  })

  for (const [label, ev, message] of [
    ['cycle index 6', sync(6, 0, false), 'cycle index 6 out of 0..5'],
    ['a negative tick count', sync(2, -1, false), 'negative tick count -1'],
  ] as const) {
    it(`disconnects on a 0x53 with ${label} (InitializeEnvironment would index past its tables)`, () => {
      const session = new OnlineSession({ settingsStore: createSettingsStore() })
      try {
        session.loadD2CapReplay(CAPTURES.find((c) => c.name.startsWith('02-'))!.text)
        session.replayAllD2Cap()
        expect(session.disconnectReason).toBeNull()
        session.handleServerEvent(ev)
        expect(session.disconnectReason).toContain('0x53 EnvironmentSync rejected')
        expect(session.disconnectReason).toContain(message)
      } finally {
        session.destroy()
      }
    })
  }

  it('a 0x03 LoadAct allocates a fresh act clock (noon, tick 0) that the next 0x53 syncs', () => {
    const session = new OnlineSession({ settingsStore: createSettingsStore() })
    try {
      const text = CAPTURES.find((c) => c.name.startsWith('02-'))!.text
      session.loadD2CapReplay(text)
      session.replayAllD2Cap()
      session.handleS2cPacket(packet0x53(5, 25600, 0))
      expect(session.environment.period).toBe(PeriodOfDay.Night)

      const loadAct = gameS2cPackets(text).find((pkt) => pkt[0] === 0x03)!
      session.handleS2cPacket(loadAct)
      expect(session.disconnectReason).toBeNull()
      expect(session.environment.cycleIndex).toBe(2)
      expect(session.environment.period).toBe(PeriodOfDay.Day)
      expect(session.environment.ticks).toBe(0)
      expect(session.environment.intensity).toBe(128)
    } finally {
      session.destroy()
    }
  })
})

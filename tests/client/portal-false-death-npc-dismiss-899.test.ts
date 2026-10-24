/**
 * Issue #899 — Fix false death, transient DT animation, and instant NPC dialog dismissal
 * after returning to town via Town Portal / Waypoint (1.13c 0x0D PlayerStop & 0x6faf83b0 parity).
 *
 * Ground Truth:
 * 1. `D2Game.dll 0x6fd22ce0` (`stru_6FD30708`) & `D2Client.dll 0x6fac9830`:
 *    - `rawCode = 0x00` is Walk-to-Unit (`PLRMODE_WALK` / `PLRMODE_TOWNWALK` unit-target code `d3 = 0x00`);
 *      on `0x0D PlayerStop` (`0x6fac9963 -> 0x6fac98fa`), it transitions to Neutral (`5` TN in town, `1` NU outside),
 *      NEVER `PLRMODE_DEATH (0)`.
 *    - Only `rawCode = 0x08` maps to `PLRMODE_DEATH (0)` and `rawCode = 0x09` maps to `PLRMODE_DEAD (17)`.
 * 2. `D2Client.dll 0x6fb5f590 / 0x6fb5f5d6`:
 *    - Byte 12 (`pkt[0xc]`) of `0x0D PlayerStop` only updates `pRoster->dwPartyLife`; it is frequently `0x00`
 *      during portal/waypoint transitions (`11-d2gs-waypoint-teleport.d2cap` lines 229 & 317) and must NEVER
 *      mark a living player dead (`isSelfDead` / `unit.dead`).
 * 3. `D2Client.dll 0x6faf83b0` (`NPC_PerTickUpdate`):
 *    - Cancels an open NPC menu only when `gpPlayerUnit` is genuinely dead (`PLRMODE_DEAD = 17` / `isSelfDead`)
 *      or the NPC is dead (`MONMODE_DEAD = 12`).
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  decode0x0DPlayerStop,
  map0x0DCodeToPlrMode,
} from '../../src/netproto/d2gs/s2c/movement.ts'
import { decodeD2gsServerPacket } from '../../src/netproto/d2gs/registry.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { D2StatId } from '../../src/client/world/stat-list.ts'
import { replayD2CapFile } from '../../tools/netproto-replay.ts'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function build0x0DPacket(params: {
  unitType?: number
  id?: number
  rawCode: number
  x: number
  y: number
  unk?: number
  lifePct?: number
}): Uint8Array {
  const pkt = new Uint8Array(13)
  const view = new DataView(pkt.buffer)
  pkt[0] = 0x0d
  pkt[1] = params.unitType ?? 0
  view.setUint32(2, params.id ?? 1, true)
  pkt[6] = params.rawCode & 0xff
  view.setUint16(7, params.x & 0xffff, true)
  view.setUint16(9, params.y & 0xffff, true)
  pkt[11] = (params.unk ?? 0) & 0xff
  pkt[12] = (params.lifePct ?? 0) & 0xff
  return pkt
}

describe('Issue #899 — 1.13c 0x0D PlayerStop rawCode mapping & Byte 12 lifePct guard', () => {
  it('map0x0DCodeToPlrMode maps rawCode 0x00 (walk-to-unit stop) to Neutral (1/5), and only 0x08 -> 0 (DT), 0x09 -> 17 (DD)', () => {
    // 0x00 = Walk to Target Unit stop (e.g. clicking Town Portal or NPC)
    expect(map0x0DCodeToPlrMode(0x00, false)).toBe(1)
    expect(map0x0DCodeToPlrMode(0x00, true)).toBe(5)

    // 0x01 = Walk to Location stop, 0x07 = Neutral
    expect(map0x0DCodeToPlrMode(0x01, false)).toBe(1)
    expect(map0x0DCodeToPlrMode(0x01, true)).toBe(5)
    expect(map0x0DCodeToPlrMode(0x07, false)).toBe(1)
    expect(map0x0DCodeToPlrMode(0x07, true)).toBe(5)

    // Explicit death / dead / hit / block / knockback / skill1 codes
    expect(map0x0DCodeToPlrMode(0x08)).toBe(0) // PLRMODE_DEATH (DT)
    expect(map0x0DCodeToPlrMode(0x09)).toBe(17) // PLRMODE_DEAD (DD)
    expect(map0x0DCodeToPlrMode(0x06)).toBe(4) // PLRMODE_GETHIT (GH)
    expect(map0x0DCodeToPlrMode(0x12)).toBe(9) // PLRMODE_BLOCK (BL)
    expect(map0x0DCodeToPlrMode(0x13)).toBe(19) // PLRMODE_KNOCKBACK (KB)
    expect(map0x0DCodeToPlrMode(0x14)).toBe(19) // PLRMODE_KNOCKBACK (KB)
    expect(map0x0DCodeToPlrMode(0x19)).toBe(13) // PLRMODE_SKILL1 (S1)

    // Invalid command codes (such as 0x11 = 17 decimal) must NEVER map to PLRMODE_DEAD (17) or PLRMODE_DEATH (0)
    expect(map0x0DCodeToPlrMode(0x11, false)).toBe(1)
    expect(map0x0DCodeToPlrMode(0x11, true)).toBe(5)

    // decode0x0DPlayerStop with rawCode = 0x00 and lifePct = 0x00
    const decoded = decode0x0DPlayerStop(
      build0x0DPacket({ rawCode: 0x00, x: 5641, y: 5496, lifePct: 0x00 }),
    )
    expect(decoded).toEqual({
      type: 'UnitMode',
      unitType: 0,
      id: 1,
      mode: 1,
      at: { x: 5641, y: 5496 },
      lifePct: 0,
    })
  })

  it('0x0D PlayerStop with rawCode=0x00/0x01 and Byte 12 lifePct=0x00 never marks a living player dead, while updating party roster lifePct', () => {
    const session = new OnlineSession()
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 1 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 5640, y: 5495 },
    })
    session.handleServerEvent({
      type: 'StatSet',
      stat: D2StatId.MaxHp,
      value: 60 << 8,
    })
    session.handleServerEvent({
      type: 'StatSet',
      stat: D2StatId.HitPoints,
      value: 60 << 8,
    })
    // Register roster entry for player 1 to verify D2Client.dll 0x6fb5f5d6 roster sync
    session.handleServerEvent({
      type: 'Party',
      kind: 'roster',
      unitId: 1,
      charName: 'Hero',
      charClass: 1,
      charLevel: 5,
      partyId: 1,
      lifePct: 100,
    })

    // Exact wire packet from 11-d2gs-waypoint-teleport.d2cap line 317: `0d000100000001091678150000`
    const wire0d = hexToBytes('0d000100000001091678150000')
    session.handleServerEvent(decodeD2gsServerPacket(wire0d))

    const selfUnit = session.world.getUnit('player', 1)!
    expect(session.world.isSelfDead).toBe(false)
    expect(session.world.isDead).toBe(false)
    expect(selfUnit.dead).toBe(false)
    expect(selfUnit.lifePct).toBeGreaterThan(0)
    expect(selfUnit.mode).toBe(5) // TownNeutral in Rogue Encampment (areaId = 1)
    expect(session.world.party.get(1)?.lifePct).toBe(0)

    // Also test rawCode = 0x00 (Walk to Unit stop, e.g. walking to Town Portal) with lifePct = 0x00
    session.handleServerEvent(
      decodeD2gsServerPacket(
        build0x0DPacket({ rawCode: 0x00, x: 5641, y: 5496, lifePct: 0x00 }),
      ),
    )
    expect(session.world.isSelfDead).toBe(false)
    expect(selfUnit.dead).toBe(false)
    expect(selfUnit.mode).toBe(5)

    // Genuine death (rawCode = 0x08 -> PLRMODE_DEATH 0) still marks the player dead
    session.handleServerEvent(
      decodeD2gsServerPacket(
        build0x0DPacket({ rawCode: 0x08, x: 5641, y: 5496, lifePct: 0x00 }),
      ),
    )
    expect(session.world.isSelfDead).toBe(true)
    expect(selfUnit.dead).toBe(true)
    expect(selfUnit.mode).toBe(0)
  })
})

describe('Issue #899 — Town Portal return to town: zero DT flash & persistent NPC dialog', () => {
  it('returning from Blood Moor to Rogue Encampment via Town Portal never renders DT/DD and keeps Akara NPC dialog open across ticks', () => {
    const session = new OnlineSession()
    session.hudManager.resize(800, 600)

    // 1. Player starts in Blood Moor (areaId = 2) with full HP
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 1, name: 'Sorceress', x: 5200, y: 5200 },
    })
    session.handleServerEvent({ type: 'StatSet', stat: D2StatId.MaxHp, value: 80 << 8 })
    session.handleServerEvent({ type: 'StatSet', stat: D2StatId.HitPoints, value: 80 << 8 })

    const assertNoDeathRender = (stage: string, nowMs: number) => {
      const renderables = session.buildRenderableUnits(nowMs)
      const selfRenderable = renderables.find((u) => u.kind === 'player' && u.id === 1)
      expect(selfRenderable, stage).toBeDefined()
      expect(selfRenderable!.mode, `${stage} mode`).not.toBe(0)
      expect(selfRenderable!.mode, `${stage} mode`).not.toBe(17)
      expect(selfRenderable!.isCorpse, `${stage} isCorpse`).toBe(false)
      expect(session.world.isSelfDead, `${stage} isSelfDead`).toBe(false)
    }

    assertNoDeathRender('in Blood Moor', 1000)

    // 2. Player walks to Town Portal object (unit target -> server sends 0x0D with rawCode=0x00, lifePct=0x00)
    session.handleServerEvent(
      decodeD2gsServerPacket(
        build0x0DPacket({ rawCode: 0x00, x: 5204, y: 5202, lifePct: 0x00 }),
      ),
    )
    assertNoDeathRender('stopped at Town Portal in Blood Moor', 1040)

    // 3. Player steps through Town Portal into Rogue Encampment (areaId = 1):
    //    Server reveals town room, sends 0x0D PlayerStop (rawCode=0x01 or 0x00, lifePct=0x00), then 0x15 UnitReassign
    const townX = 5641 // tileX = floor(5641 / 5) = 1128 (room 1120..1128)
    const townY = 5496 // tileY = floor(5496 / 5) = 1099 (room 1096..1104)
    session.handleServerEvent({
      type: 'RoomReveal',
      areaId: 1,
      tileX: Math.floor(townX / 5) & ~7,
      tileY: Math.floor(townY / 5) & ~7,
    })
    session.handleServerEvent(
      decodeD2gsServerPacket(
        build0x0DPacket({ rawCode: 0x00, x: townX, y: townY, lifePct: 0x00 }),
      ),
    )
    assertNoDeathRender('after 0x0D in town before 0x15', 1080)

    session.handleServerEvent({
      type: 'UnitReassign',
      unitType: 0,
      id: 1,
      at: { x: townX, y: townY },
      snap: true,
    })
    assertNoDeathRender('after 0x15 UnitReassign in town', 1120)

    const selfUnit = session.world.getUnit('player', 1)!
    expect(session.world.areaId).toBe(1)
    expect(selfUnit.mode).toBe(5) // PLRMODE_TOWNNEUTRAL
    expect(selfUnit.dead).toBe(false)
    expect(selfUnit.lifePct).toBeGreaterThan(0)

    // 4. Spawn Akara (classId = 148) next to player and click her to open NPC dialog
    const akaraId = 148
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: akaraId,
        classId: 148,
        name: 'Akara',
        x: townX + 3,
        y: townY,
        lifePct: 128,
        mode: 1,
      },
    })
    const akara = session.world.getUnit('monster', akaraId)!

    const record = session.commandMapper.triggerPrimaryWorldAction(akara.x, akara.y, akara, 1200)
    expect(record?.command).toEqual({ type: 'NpcInit', target: { unitType: 1, id: akaraId } })
    expect(session.world.npcInteraction.npcId).toBe(akaraId)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)

    // 5. Advance 30 ticks (1.2s at 25 Hz): dialog MUST remain open without flashing closed!
    const sentBeforeTicks = session.getSentCommands().length
    let now = 1200
    for (let i = 0; i < 30; i++) {
      now += 40
      session.tick(40, now)
      assertNoDeathRender(`tick ${i + 1}`, now)
    }

    expect(session.world.npcInteraction.npcId).toBe(akaraId)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)
    expect(
      session
        .getSentCommands()
        .slice(sentBeforeTicks)
        .filter((c) => c.type === 'NpcCancel'),
    ).toEqual([])
  })

  it('replaying 11-d2gs-waypoint-teleport.d2cap keeps local player alive after 0x0D lifePct=0x00 packets', () => {
    const capPath = path.resolve(__dirname, '../fixtures/netproto/11-d2gs-waypoint-teleport.d2cap')
    const replay = replayD2CapFile(capPath, { strict: true })
    expect(replay.unknownPackets).toBe(0)

    const session = new OnlineSession()
    session.hudManager.resize(800, 600)
    for (const ev of replay.events) {
      session.handleServerEvent(ev)
    }

    expect(session.world.isSelfDead).toBe(false)
    expect(session.world.isDead).toBe(false)
    const selfUnit = session.world.getUnit('player', session.world.selfId)
    expect(selfUnit).toBeDefined()
    expect(selfUnit!.dead).toBe(false)
    expect(selfUnit!.mode).not.toBe(0)
    expect(selfUnit!.mode).not.toBe(17)
  })
})

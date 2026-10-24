/**
 * Issue #890 — an NPC dialog (`npcMenu` / `npcSpeech`) sometimes closed one 25 Hz frame after it opened.
 *
 * Root cause: the per-tick NPC guard re-checked the player–NPC distance with the D2MOO melee table
 * plus a "target is moving" bonus. Clicking a walking NPC at the edge of that range opened the dialog;
 * the NPC then stopped (walk → neutral) when its menu opened, the bonus disappeared and the guard sent
 * `C2S 0x30 NpcCancel` on the next tick. Drift between the predicted and the server position (the
 * deferred `arrivedViaServer` path) closed the dialog the same way.
 *
 * 1.13c ground truth (D2Client.dll):
 * - Per-tick guard 0x6faf83b0 (runs only while `UI_NPCMENU` is open) cancels only when the player is
 *   NULL / in mode 17 or the NPC lookup fails / the NPC is in mode 12. It never checks the distance.
 * - ProcessClick 0x6facafea: interacts at once when `#10407(npc, player) <= 2` (MonStats `interact`)
 *   or `<= 5` (other monsters), else walks and queues the interaction.
 * - Deferred interaction 0x6fac9ef0: interacts when `#10407(npc, player) <= 2`.
 * - `#10407` (D2Common 0x6FDCFCD0) uses the 8×8 table 0x6FDDABC0.
 */

import { describe, expect, it } from 'vitest'
import {
  MONSTER_CLICK_INTERACT_DISTANCE_113C,
  NPC_ARRIVAL_INTERACT_DISTANCE_113C,
  NPC_CLICK_INTERACT_DISTANCE_113C,
  PLAYER_SIZE_X_113C,
  isNpcInInteractRange113c,
  monsterHasInteractFlag113c,
  npcInteractDistance113c,
} from '../../src/client/input/click-rules-113c.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { MONSTATS_TXT_RECORD_COUNT } from '../../src/common/path/monster-path-data.ts'
import { D2Common_10399, D2Common_10399_AtSubtiles } from '../../src/common/path/step.ts'
import { UNIT_MONSTER, UNIT_PLAYER, type PathUnit } from '../../src/common/path/types.ts'
import { getMonsterSizeXByHcIdx } from '../../src/common/units/monster-mapping.ts'

const AKARA_CLASS_ID = 148 // MonStats `interact`, MonStats2 SizeX = 2

/** `#10407` between a size-2 NPC at `(5000 + dx, 5000 + dy)` and the size-2 player at `(5000, 5000)`. */
function dist22(dx: number, dy: number): number {
  return D2Common_10399_AtSubtiles(5000 + dx, 5000 + dy, 2, 5000, 5000, PLAYER_SIZE_X_113C)
}

/** Offsets `(dx, dy)`, `dx, dy >= 0`, with `#10407 <= 2` for two size-2 units (0x6FDDABC0). */
const IN_RANGE_2_FOR_SIZE_2: ReadonlySet<string> = new Set([
  ...[0, 1, 2, 3, 4].map((dx) => `${dx},0`),
  ...[0, 1, 2, 3, 4].map((dx) => `${dx},1`),
  ...[0, 1, 2, 3].map((dx) => `${dx},2`),
  ...[0, 1, 2, 3].map((dx) => `${dx},3`),
  ...[0, 1].map((dx) => `${dx},4`),
])

describe('Issue #890 — #10407 table distance (D2Common_10399_AtSubtiles, 1.13c 0x6FDCFCD0 / 0x6FDDABC0)', () => {
  it('returns the 0x6FDDABC0 near-branch values for two size-2 units, for every sign of the deltas', () => {
    const cases: readonly [number, number, number][] = [
      [0, 0, 0], // table -1 -> 0
      [1, 0, 0],
      [3, 0, 0],
      [4, 0, 2],
      [5, 0, 4],
      [4, 1, 2],
      [4, 2, 3],
      [3, 3, 2],
      [1, 4, 2],
      [2, 4, 3],
      [7, 7, 11],
    ]
    for (const [dx, dy, expected] of cases) {
      for (const [sx, sy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ] as const) {
        expect(dist22(sx * dx, sy * dy), `(${sx * dx}, ${sy * dy})`).toBe(expected)
        expect(D2Common_10399_AtSubtiles(5000, 5000, 2, 5000 + sx * dx, 5000 + sy * dy, 2)).toBe(expected)
      }
    }
  })

  it('applies the size-3 (-1, clamped at 0) and size<=1 (+1) adjustments after a non-negative table entry', () => {
    // size 3 (e.g. Malachai 408) next to the size-2 player
    expect(D2Common_10399_AtSubtiles(5005, 5000, 3, 5000, 5000, 2)).toBe(3)
    expect(D2Common_10399_AtSubtiles(5004, 5002, 3, 5000, 5000, 2)).toBe(2)
    expect(D2Common_10399_AtSubtiles(5003, 5000, 3, 5000, 5000, 2)).toBe(0)
    // size 1 / size 0: +1
    expect(D2Common_10399_AtSubtiles(5003, 5000, 1, 5000, 5000, 2)).toBe(1)
    expect(D2Common_10399_AtSubtiles(5004, 5000, 1, 5000, 5000, 2)).toBe(3)
    expect(D2Common_10399_AtSubtiles(5003, 5000, 0, 5000, 5000, 2)).toBe(1)
    // a negative table entry returns 0 before any adjustment
    expect(D2Common_10399_AtSubtiles(5000, 5000, 1, 5000, 5000, 2)).toBe(0)
    expect(D2Common_10399_AtSubtiles(5001, 5001, 0, 5000, 5000, 2)).toBe(0)
    // size 3 and size 1 together: -1 then +1
    expect(D2Common_10399_AtSubtiles(5005, 5000, 3, 5000, 5000, 1)).toBe(4)
  })

  it('uses the far branch (subtract the half sizes, then 2*max + min) for deltas >= 8 or a size >= 4', () => {
    expect(dist22(8, 0)).toBe(12)
    expect(dist22(10, 3)).toBe(17)
    expect(dist22(0, -9)).toBe(14)
    // size 4: far branch even for small deltas; half sizes 2 + 1 = 3
    expect(D2Common_10399_AtSubtiles(5003, 5000, 4, 5000, 5000, 2)).toBe(0)
    expect(D2Common_10399_AtSubtiles(5005, 5000, 4, 5000, 5000, 2)).toBe(4)
    expect(D2Common_10399_AtSubtiles(5005, 5004, 4, 5000, 5000, 2)).toBe(5)
  })

  it('agrees with D2Common_10399 on PathUnits (player SizeX 2, monster MonStats2 SizeX)', () => {
    const makeUnit = (dwUnitType: number, dwClassId: number, x: number, y: number): PathUnit =>
      ({ dwUnitType, dwClassId, pDynamicPath: { wPosX: x, wPosY: y } }) as unknown as PathUnit
    const player = makeUnit(UNIT_PLAYER, 1, 5000, 5000)
    // Akara (size 2), Malachai (size 3), chicken (size 0), maggot egg (size 1)
    const classSizes: readonly [number, number][] = [
      [148, 2],
      [408, 3],
      [149, 0],
      [190, 1],
    ]
    for (const [classId, size] of classSizes) {
      expect(getMonsterSizeXByHcIdx(classId)).toBe(size)
      for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -10; dx <= 10; dx++) {
          const npc = makeUnit(UNIT_MONSTER, classId, 5000 + dx, 5000 + dy)
          expect(D2Common_10399_AtSubtiles(5000 + dx, 5000 + dy, size, 5000, 5000, 2)).toBe(
            D2Common_10399(npc, player),
          )
        }
      }
    }
  })

  it('fails fast on non-integer coordinates and on sizes that are not non-negative integers', () => {
    expect(() => D2Common_10399_AtSubtiles(5000.5, 5000, 2, 5000, 5000, 2)).toThrow(RangeError)
    expect(() => D2Common_10399_AtSubtiles(5000, 5000, 2, 5000, Number.NaN, 2)).toThrow(RangeError)
    expect(() => D2Common_10399_AtSubtiles(5000, 5000, -1, 5000, 5000, 2)).toThrow(RangeError)
    expect(() => D2Common_10399_AtSubtiles(5000, 5000, 2, 5000, 5000, 1.5)).toThrow(RangeError)
  })
})

describe('Issue #890 — D2Client NPC interaction range (ProcessClick 0x6facafea / deferred 0x6fac9ef0)', () => {
  it('uses #10407 <= 2 for MonStats interact NPCs and <= 5 for other monsters on click, and <= 2 on arrival', () => {
    expect(NPC_CLICK_INTERACT_DISTANCE_113C).toBe(2)
    expect(MONSTER_CLICK_INTERACT_DISTANCE_113C).toBe(5)
    expect(NPC_ARRIVAL_INTERACT_DISTANCE_113C).toBe(2)
    expect(npcInteractDistance113c('click', true)).toBe(2)
    expect(npcInteractDistance113c('click', false)).toBe(5)
    expect(npcInteractDistance113c('arrival', true)).toBe(2)
    expect(npcInteractDistance113c('arrival', false)).toBe(2)
  })

  it('reads MonStats interact (dwMonStatsFlags bit 9) and fails fast outside MonStats.txt', () => {
    for (const classId of [146, 147, 148, 150, 154]) {
      expect(monsterHasInteractFlag113c(classId), `classId ${classId}`).toBe(true)
    }
    for (const classId of [0, 149, 152, 179]) {
      expect(monsterHasInteractFlag113c(classId), `classId ${classId}`).toBe(false)
    }
    expect(() => monsterHasInteractFlag113c(-1)).toThrow()
    expect(() => monsterHasInteractFlag113c(MONSTATS_TXT_RECORD_COUNT)).toThrow()
  })

  it('a size-2 NPC is in range (threshold 2) exactly on the #10407 <= 2 region, whether it walks or not', () => {
    for (let dy = 0; dy <= 7; dy++) {
      for (let dx = 0; dx <= 7; dx++) {
        const expected = IN_RANGE_2_FOR_SIZE_2.has(`${dx},${dy}`)
        expect(dist22(dx, dy) <= 2).toBe(expected)
        for (const phase of ['click', 'arrival'] as const) {
          const input = { phase, interact: true, playerX: 5000, playerY: 5000, npcX: 5000 + dx, npcY: 5000 + dy, npcSizeX: 2 }
          expect(isNpcInInteractRange113c(input), `${phase} (${dx}, ${dy})`).toBe(expected)
          expect(isNpcInInteractRange113c({ ...input, npcX: 5000 - dx, npcY: 5000 - dy })).toBe(expected)
        }
      }
    }
  })

  it('a monster without interact is in click range up to #10407 <= 5, but arrival still needs <= 2', () => {
    const base = { interact: false, playerX: 5000, playerY: 5000, npcSizeX: 2 } as const
    const at = (phase: 'click' | 'arrival', dx: number, dy: number) =>
      isNpcInInteractRange113c({ ...base, phase, npcX: 5000 + dx, npcY: 5000 + dy })
    expect(at('click', 5, 0)).toBe(true) // 4
    expect(at('click', 5, 2)).toBe(true) // 5
    expect(at('click', 4, 4)).toBe(true) // 5
    expect(at('click', 6, 0)).toBe(false) // 6
    expect(at('click', 6, 1)).toBe(false) // 6
    expect(at('click', 5, 4)).toBe(false) // 6
    expect(at('arrival', 4, 0)).toBe(true) // 2
    expect(at('arrival', 5, 0)).toBe(false) // 4
  })
})

describe('Issue #890 — an open NPC dialog is not closed by the per-tick guard (1.13c 0x6faf83b0)', () => {
  function createSessionWithAkara(npcX: number, npcY: number, npcMode = 1) {
    const selfX = 5000
    const selfY = 5000
    const session = new OnlineSession()
    session.hudManager.resize(800, 600)
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: selfX, y: selfY },
    })
    const akaraId = 148
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: akaraId,
        classId: AKARA_CLASS_ID,
        name: 'Akara',
        x: npcX,
        y: npcY,
        lifePct: 128,
        mode: npcMode,
      },
    })
    const camera = session.camera as unknown as {
      subtileToScreen: (x: number, y: number) => { x: number; y: number }
      screenToSubtile: (x: number, y: number) => { x: number; y: number }
    }
    camera.subtileToScreen = (x: number, y: number) => ({ x: 400 + (x - selfX) * 16, y: 300 + (y - selfY) * 8 })
    camera.screenToSubtile = (x: number, y: number) => ({
      x: Math.round(selfX + (x - 400) / 16),
      y: Math.round(selfY + (y - 300) / 8),
    })
    const akara = session.world.getUnit('monster', akaraId)!
    return { session, akaraId, akara }
  }

  function sentTypesSince(session: OnlineSession, from: number): string[] {
    return session
      .getSentCommands()
      .slice(from)
      .map((c) => c.type)
  }

  function expectDialogOpen(session: OnlineSession, akaraId: number): void {
    expect(session.world.npcInteraction.npcId).toBe(akaraId)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(akaraId)
  }

  function runTicks(session: OnlineSession, fromMs: number, count: number): number {
    let now = fromMs
    for (let i = 0; i < count; i++) {
      now += 40
      session.tick(40, now)
    }
    return now
  }

  it('A. clicking a walking NPC at (4,0) opens the dialog, and it stays open after the NPC stops when its menu opens', () => {
    const { session, akaraId, akara } = createSessionWithAkara(5004, 5000, 2)
    expect(akara.mode).toBe(2)

    const before = session.getSentCommands().length
    const record = session.commandMapper.triggerPrimaryWorldAction(akara.x, akara.y, akara, 1000)
    expect(record?.command).toEqual({ type: 'NpcInit', target: { unitType: 1, id: akaraId } })
    expect(sentTypesSince(session, before)).not.toContain('MoveToUnit')
    expectDialogOpen(session, akaraId)

    // D2GS stops the NPC when the interaction starts: S2C mode change walk (2) -> neutral (1)
    session.handleServerEvent({ type: 'UnitMode', unitType: 1, id: akaraId, mode: 1 })
    expect(akara.mode).toBe(1)
    expect(akara.moving).toBe(false)
    const afterOpen = session.getSentCommands().length
    runTicks(session, 1000, 10)
    expect(akara.mode).toBe(1)
    expect([akara.x, akara.y]).toEqual([5004, 5000])
    expectDialogOpen(session, akaraId)
    expect(sentTypesSince(session, afterOpen)).not.toContain('NpcCancel')
  })

  it('B. a stationary NPC inside #10407 <= 2 opens at once; outside it the click walks and defers the interaction', () => {
    for (const [dx, dy] of [
      [4, 0],
      [4, 1],
      [3, 3],
      [1, 4],
    ] as const) {
      const { session, akaraId, akara } = createSessionWithAkara(5000 + dx, 5000 + dy)
      const before = session.getSentCommands().length
      const record = session.commandMapper.triggerPrimaryWorldAction(akara.x, akara.y, akara, 1000)
      expect(record?.command, `(${dx}, ${dy})`).toEqual({ type: 'NpcInit', target: { unitType: 1, id: akaraId } })
      expect(sentTypesSince(session, before)).not.toContain('MoveToUnit')
      runTicks(session, 1000, 5)
      expectDialogOpen(session, akaraId)
    }

    for (const [dx, dy] of [
      [5, 0],
      [4, 2],
      [2, 4],
    ] as const) {
      const { session, akaraId, akara } = createSessionWithAkara(5000 + dx, 5000 + dy)
      const before = session.getSentCommands().length
      session.commandMapper.triggerPrimaryWorldAction(akara.x, akara.y, akara, 1000)
      const sent = sentTypesSince(session, before)
      expect(sent, `(${dx}, ${dy})`).toContain('MoveToUnit')
      expect(sent).not.toContain('NpcInit')
      expect(session.commandMapper.getPendingNpcInteractId()).toBe(akaraId)
      expect(session.world.npcInteraction.npcId).toBeNull()
    }
  })

  it('C. predicted-position drift after the dialog opened never cancels it', () => {
    const { session, akaraId, akara } = createSessionWithAkara(5003, 5000)
    session.commandMapper.triggerPrimaryWorldAction(akara.x, akara.y, akara, 1000)
    expectDialogOpen(session, akaraId)
    const afterOpen = session.getSentCommands().length

    session.predictor.setPosition(4998, 5000) // dx = 5: #10407 = 4
    let now = runTicks(session, 1000, 3)
    expectDialogOpen(session, akaraId)

    session.predictor.setPosition(4990, 4990) // far branch
    now = runTicks(session, now, 3)
    expectDialogOpen(session, akaraId)
    expect(sentTypesSince(session, afterOpen)).not.toContain('NpcCancel')
  })

  it('D. a deferred interaction that arrives through the server position (arrivedViaServer) keeps the dialog open', () => {
    const { session, akaraId, akara } = createSessionWithAkara(5008, 5000)
    session.commandMapper.triggerPrimaryWorldAction(akara.x, akara.y, akara, 1000)
    expect(session.commandMapper.getPendingNpcInteractId()).toBe(akaraId)
    expect(session.world.npcInteraction.npcId).toBeNull()

    // The predictor stopped at dx = 5 (#10407 = 4 > 2) while the server put the player at dx = 3 (#10407 = 0).
    session.predictor.setPosition(5003, 5000)
    session.predictor.stop()
    session.world.self.x = 5005
    session.world.self.y = 5000
    let now = 1500
    for (let i = 0; i < 10 && session.world.npcInteraction.npcId === null; i++) {
      now += 40
      session.commandMapper.tick(now)
    }
    expectDialogOpen(session, akaraId)
    expect(session.commandMapper.getPendingNpcInteractId()).toBeNull()

    // Later ticks see the predicted position (dx = 5) again: the dialog must stay open.
    const afterOpen = session.getSentCommands().length
    runTicks(session, now, 10)
    expect(session.predictor.getSnapshot().x).toBe(5003)
    expectDialogOpen(session, akaraId)
    expect(sentTypesSince(session, afterOpen)).not.toContain('NpcCancel')
  })

  it('E. the guard still cancels the session when the NPC dies (mode 12) or the player dies (mode 17)', () => {
    const deaths: readonly { readonly unitType: 0 | 1; readonly mode: number }[] = [
      { unitType: 1, mode: 12 }, // MONMODE_DEAD
      { unitType: 0, mode: 17 }, // PLRMODE_DEAD
    ]
    for (const death of deaths) {
      const { session, akaraId, akara } = createSessionWithAkara(5003, 5000)
      session.commandMapper.triggerPrimaryWorldAction(akara.x, akara.y, akara, 1000)
      expectDialogOpen(session, akaraId)
      const before = session.getSentCommands().length
      session.handleServerEvent({
        type: 'UnitMode',
        unitType: death.unitType,
        id: death.unitType === 1 ? akaraId : 1,
        mode: death.mode,
      })
      expectDialogOpen(session, akaraId)
      runTicks(session, 1000, 1)
      expect(session.world.npcInteraction.npcId, `unitType ${death.unitType}`).toBeNull()
      expect(session.hudManager.worldPanels.npcMenu).toBeNull()
      expect(
        session
          .getSentCommands()
          .slice(before)
          .filter((c) => c.type === 'NpcCancel'),
      ).toEqual([{ type: 'NpcCancel', target: { unitType: 1, id: akaraId } }])
    }
  })
})

/**
 * Issue #1473 — 1.13c Shrine Buff Duration & Reset Time Table Parity (`Shrines.txt` + `D2Game.dll` `0x6fc8da00`)
 * plus Class-of-Bug Sweep for `Objects.txt` / `Missiles.txt` Quest Object Timers.
 *
 * Ground truth:
 * - `samples/d2/D2Game.dll` (`0x6fc8da00` `OperateFn 2`, `0x6fc8ab60` / `0x6fc8abb0` / `0x6fc8ac30` / `0x6fc8ace0`)
 * - `data\global\excel\shrines.txt` (`D2Common.#10629` `DATATBLS_GetShrinesTxtRecord`, `0x118`-byte `D2ShrinesTxt`):
 *   - `+0x0C` `dwDurationInFrames` (`Duration in frames`)
 *   - `+0x10` `nResetTimeInMinutes` (`reset time in minutes`)
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import {
  CANONICAL_113C_SHRINES,
  getShrineMeta113c,
} from '../../src/common/world/objects-meta.ts'
import {
  computeShrineResetFrame113c,
  getObjectOperatingTicks113c,
} from '../../src/common/world/object-operate-113c.ts'
import { getObjectsTxtRecord113c } from '../../src/common/world/objects-txt-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('Issue #1473: 1.13c Shrines.txt durationFrames and resetTimeMinutes parity', () => {
  it('matches all 23 Shrines.txt rows (Code 0..22) for Duration in frames (+0x0C) and reset time in minutes (+0x10)', () => {
    const expected: ReadonlyArray<readonly [code: number, durationFrames: number, resetTimeMinutes: number]> = [
      [0, 0, 2],    // Shrine (Null fallback)
      [1, 0, 2],    // Refilling Shrine
      [2, 0, 5],    // Health Shrine
      [3, 0, 5],    // Mana Shrine
      [4, 0, 0],    // Health Exchange Shrine
      [5, 0, 0],    // Mana Exchange Shrine
      [6, 2400, 5], // Armor Shrine
      [7, 2400, 5], // Combat Shrine
      [8, 3600, 5], // Resist Fire Shrine
      [9, 3600, 5], // Resist Cold Shrine
      [10, 3600, 5], // Resist Lightning Shrine
      [11, 3600, 5], // Resist Poison Shrine
      [12, 2400, 5], // Skill Shrine
      [13, 2400, 5], // Mana Recharge Shrine
      [14, 4800, 5], // Stamina Shrine
      [15, 3600, 0], // Experience Shrine
      [16, 0, 0],   // Enirhs Shrine
      [17, 0, 0],   // Portal Shrine
      [18, 0, 0],   // Gem Shrine
      [19, 0, 0],   // Fire Shrine
      [20, 0, 0],   // Monster Shrine
      [21, 0, 0],   // Exploding Shrine
      [22, 0, 0],   // Poison Shrine
    ]

    for (const [code, durationFrames, resetTimeMinutes] of expected) {
      const meta = CANONICAL_113C_SHRINES[code]
      expect(meta, `Shrines.txt Code ${code}`).toBeDefined()
      expect(meta!.durationFrames, `Code ${code} durationFrames`).toBe(durationFrames)
      expect(meta!.resetTimeMinutes, `Code ${code} resetTimeMinutes`).toBe(resetTimeMinutes)
    }

    // D2Game 0x6fc8db06..0x6fc8db2b: Code 0 or out-of-range falls back to Code 1 (Refilling Shrine).
    expect(getShrineMeta113c(0)).toBe(CANONICAL_113C_SHRINES[1])
    expect(getShrineMeta113c(-1)).toBe(CANONICAL_113C_SHRINES[1])
    expect(getShrineMeta113c(99)).toBe(CANONICAL_113C_SHRINES[1])
  })

  it('computes shrine reset frames via currentFrame + resetTimeMinutes * 1200 + 1 only when resetTimeMinutes > 0 (D2Game 0x6fc8db60..0x6fc8db7e)', () => {
    // 2-minute shrines (Code 0, 1): 2 * 1200 + 1 = 2401 frames
    expect(computeShrineResetFrame113c(0, 100)).toBe(2501)
    expect(computeShrineResetFrame113c(1, 100)).toBe(2501)

    // 5-minute shrines (Code 2, 3, 6..14): 5 * 1200 + 1 = 6001 frames
    for (const code of [2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
      expect(computeShrineResetFrame113c(code, 50), `Code ${code}`).toBe(6051)
    }

    // One-shot shrines (resetTimeMinutes === 0: Code 4, 5, 15, 16..22): 0 (never resets)
    for (const code of [4, 5, 15, 16, 17, 18, 19, 20, 21, 22]) {
      expect(computeShrineResetFrame113c(code, 50), `Code ${code}`).toBe(0)
    }
  })

  it('Code 14 (Stamina Shrine) buff lasts 4800 frames (not 2400) and resets at frame 6001 (D2Game 0x6fc8ac30 / 0x6fc8da00)', () => {
    const game = new GameInstance({ mode: 'singlePlayer', seed: 147301 })
    const playerId = game.addPlayer({ name: 'StaminaRunner', classId: 0 })
    const player = game.getPlayerState(playerId)!
    const shrineId = game.spawnObject({
      classId: 2,
      x: player.x + 1,
      y: player.y,
      areaId: 1,
      shrineType: 14,
    })

    const internal = game as unknown as {
      players: Map<number, {
        stamina: number
        maxStamina: number
        staminaFixed: number
        maxStaminaFixed: number
        states: Set<number>
      }>
      objects: Map<number, { mode: number; shrineResetFrame: number }>
    }
    const p = internal.players.get(playerId)!
    p.stamina = 5
    p.staminaFixed = 5 << 8

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1) // currentFrame advances 0 -> 1

    const obj = internal.objects.get(shrineId)!
    expect(obj.mode).toBe(2)
    expect(obj.shrineResetFrame).toBe(6001)
    expect(p.stamina).toBe(p.maxStamina)
    expect(p.states.has(136)).toBe(true)

    // Still active past 2400 frames and up to 4799 frames:
    game.stepFrames(2400) // currentFrame = 2401
    expect(p.states.has(136)).toBe(true)

    game.stepFrames(2398) // currentFrame = 4799 (4799 ticks elapsed since buff applied)
    expect(p.states.has(136)).toBe(true)

    // Expires on the 4800th tick of the buff:
    game.stepFrames(1) // currentFrame = 4800
    expect(p.states.has(136)).toBe(false)
    // Shrine object is still in OBJMODE_OPENED (2) until frame 6001:
    expect(obj.mode).toBe(2)

    game.stepFrames(1200) // currentFrame = 6000
    expect(obj.mode).toBe(2)

    game.stepFrames(1) // currentFrame = 6001 -> resets to OBJMODE_NEUTRAL (0)
    expect(obj.mode).toBe(0)
    expect(obj.shrineResetFrame).toBe(0)
  })

  it('Code 1 (Refilling Shrine, reset time = 2) recovers after 2401 frames and can be operated again', () => {
    const game = new GameInstance({ mode: 'singlePlayer', seed: 147302 })
    const playerId = game.addPlayer({ name: 'RefillHero', classId: 1 })
    const player = game.getPlayerState(playerId)!
    const shrineId = game.spawnObject({
      classId: 2,
      x: player.x + 1,
      y: player.y,
      areaId: 1,
      shrineType: 1,
    })

    const internal = game as unknown as {
      players: Map<number, { hp: number; maxHp: number; hpFixed: number; mana: number; maxMana: number; manaFixed: number }>
      objects: Map<number, { mode: number; shrineResetFrame: number }>
    }
    const p = internal.players.get(playerId)!
    p.hp = 10
    p.hpFixed = 10 << 8
    p.mana = 5
    p.manaFixed = 5 << 8

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1) // operated at frame 0; currentFrame is now 1

    const obj = internal.objects.get(shrineId)!
    expect(obj.mode).toBe(2)
    expect(obj.shrineResetFrame).toBe(2401)
    expect(p.hp).toBe(p.maxHp)
    expect(p.mana).toBe(p.maxMana)

    // At frame 2400 (2399 more frames), still in OBJMODE_OPENED (2):
    game.stepFrames(2399)
    expect(game.frame).toBe(2400)
    expect(obj.mode).toBe(2)

    // At frame 2401 (1 more frame), resets to OBJMODE_NEUTRAL (0):
    game.stepFrames(1)
    expect(game.frame).toBe(2401)
    expect(obj.mode).toBe(0)
    expect(obj.shrineResetFrame).toBe(0)

    // Can be operated a second time:
    p.hp = 12
    p.hpFixed = 12 << 8
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)
    expect(p.hp).toBe(p.maxHp)
    expect(obj.mode).toBe(2)
    expect(obj.shrineResetFrame).toBe(2401 + 2401)
  })

  it('one-shot shrines (reset time = 0: Codes 4, 5, 15, 16..22) never schedule a reset and stay in mode 2 permanently', () => {
    const oneShotCodes = [4, 5, 15, 16, 17, 18, 19, 20, 21, 22] as const
    for (const code of oneShotCodes) {
      const game = new GameInstance({ mode: 'singlePlayer', seed: 147310 + code })
      const playerId = game.addPlayer({ name: 'Hero', classId: 2 })
      const player = game.getPlayerState(playerId)!
      const shrineId = game.spawnObject({
        classId: 2,
        x: player.x + 1,
        y: player.y,
        areaId: 1,
        shrineType: code,
      })

      const internal = game as unknown as {
        objects: Map<number, { mode: number; shrineResetFrame: number }>
      }

      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
      game.stepFrames(1)

      const obj = internal.objects.get(shrineId)!
      expect(obj.mode, `Code ${code} mode after operate`).toBe(2)
      expect(obj.shrineResetFrame, `Code ${code} shrineResetFrame`).toBe(0)

      // Advance past 5 minutes (6005 frames): must still be mode 2.
      game.stepFrames(6005)
      expect(obj.mode, `Code ${code} mode after 6005 frames`).toBe(2)
      expect(obj.shrineResetFrame, `Code ${code} shrineResetFrame after 6005 frames`).toBe(0)
    }
  })

  it('derives Compelling Orb (404), Durance Stairs (386), and Horadric Orifice (152) timers from Objects.txt / Missiles.txt', () => {
    const orbRec = getObjectsTxtRecord113c(404)
    expect(orbRec.frameCnt[1]).toBe(29)
    expect(orbRec.frameDelta[1]).toBe(128)
    expect(getObjectOperatingTicks113c(404)).toBe(58)

    const stairsRec = getObjectsTxtRecord113c(386)
    expect(stairsRec.frameCnt[1]).toBe(9)
    expect(stairsRec.frameDelta[1]).toBe(120)
    expect(getObjectOperatingTicks113c(386)).toBe(19)

    const registry = getSharedDataRegistry()
    const orbMist = registry.getMissileById(368)!
    expect(orbMist.name).toBe('orbmist')
    expect(orbMist.vel).toBe(2)
    expect(orbMist.range).toBe(400)

    const horadricStaff = registry.getMissileById(338)!
    expect(horadricStaff.name).toBe('horadricstaff')
    expect(horadricStaff.range).toBe(440)
    // D2Game 0x6fce9dae..0x6fce9dcd: (dwRange - 75) / 20 = (440 - 75) / 20 = 18 ticks
    expect(Math.trunc((horadricStaff.range - 75) / 20)).toBe(18)
  })
})

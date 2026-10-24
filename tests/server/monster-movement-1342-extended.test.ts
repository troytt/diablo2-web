/**
 * Issue #1342 — run mode, full UnitMove payload, idle wander and occupancy.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function connect(game: GameInstance, x: number, y: number): number {
  return game.connectPlayer({ charClass: 'bar', name: 'Target', x, y, areaId: 1 })
}

describe('issue #1342 monster movement follow-up', () => {
  it('broadcasts MONMODE_RUN (15), not MONMODE_GETHIT (3), when running', () => {
    const game = new GameInstance({ seed: 1342, areaId: 1 })
    const playerId = connect(game, 30, 10)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 10,
      y: 10,
      areaId: 1,
      velocity: 6,
      runSpeed: 6,
      aggroRadius: 40,
      hp: 500,
      maxHp: 500,
    })
    game.drainEvents(playerId)
    game.stepFrames(1)
    const moves = game.drainEvents(playerId).filter((e) => e.type === 'UnitMove')
    expect(moves.length).toBeGreaterThan(0)
    const move = moves[0] as {
      mode?: string
      currentX?: number
      targetX?: number
      from?: { x: number; y: number }
      to?: { x: number; y: number }
    }
    expect(move.mode).toBe('run')
    expect(game.getMonster(monsterId)!.mode).toBe(15)
    expect(move.currentX).toBeDefined()
    expect(move.targetX).toBe(30)
    expect(move.from).toBeDefined()
    expect(move.to).toBeDefined()
  })

  it('idles by wandering around its spawn anchor when no hostile is in range', () => {
    const game = new GameInstance({ seed: 1343, areaId: 1 })
    connect(game, 10, 10)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 70,
      y: 10,
      areaId: 1,
      aggroRadius: 5,
      hp: 500,
      maxHp: 500,
    })
    game.stepFrames(200)
    const monster = game.getMonster(monsterId)!
    expect(Math.hypot(monster.x - 70, monster.y - 10)).toBeGreaterThan(0.5)
    expect(Math.hypot(monster.x - 70, monster.y - 10)).toBeLessThan(12)
  })

  it('fills the 0x68 NPC command payload when an NPC moves', () => {
    const game = new GameInstance({ seed: 1346, areaId: 1 })
    const playerId = connect(game, 20, 10)
    const npcId = game.spawnMonster({ defId: 'fallen1', x: 10, y: 10, areaId: 1, isNpc: true })
    const internal = game as unknown as {
      monsters: Map<number, unknown>
      moveMonsterToward: (m: unknown, x: number, y: number, run: boolean) => number
    }
    game.drainEvents(playerId)
    internal.moveMonsterToward(internal.monsters.get(npcId), 15, 10, false)
    const move = game.drainEvents(playerId).find((e) => e.type === 'UnitMove') as
      | { npc?: { opcode: number; s: readonly unknown[] } }
      | undefined
    expect(move?.npc?.opcode).toBe(0x67)
    expect(move?.npc?.s).toHaveLength(7)
  })

  it('blocks only the destination cell and lets stacked units separate', () => {
    const game = new GameInstance({ seed: 1344, areaId: 1 })
    const a = game.spawnMonster({ defId: 'fallen1', x: 10, y: 10, areaId: 1, hp: 500, maxHp: 500 })
    game.spawnMonster({ defId: 'fallen1', x: 11, y: 10, areaId: 1, hp: 500, maxHp: 500 })
    const internal = game as unknown as {
      monsters: Map<number, unknown>
      isMonsterCellOccupied: (monster: unknown, x: number, y: number) => boolean
    }
    const monster = internal.monsters.get(a)
    expect(internal.isMonsterCellOccupied(monster, 11, 10)).toBe(true)
    expect(internal.isMonsterCellOccupied(monster, 12, 10)).toBe(false)

    // Stacked units may step apart even though they share the current cell.
    const stacked = new GameInstance({ seed: 1345, areaId: 1 })
    const b = stacked.spawnMonster({ defId: 'fallen1', x: 10, y: 10, areaId: 1, hp: 500, maxHp: 500 })
    stacked.spawnMonster({ defId: 'fallen1', x: 10, y: 10, areaId: 1, hp: 500, maxHp: 500 })
    // Third-party bystander at (10.5, 10) must still block even while b is stacked at (10, 10).
    stacked.spawnMonster({ defId: 'fallen1', x: 9.5, y: 10, areaId: 1, hp: 500, maxHp: 500 })
    const stackedInternal = stacked as unknown as {
      monsters: Map<number, unknown>
      isMonsterCellOccupied: (monster: unknown, x: number, y: number) => boolean
    }
    const stackedMonster = stackedInternal.monsters.get(b)
    expect(stackedInternal.isMonsterCellOccupied(stackedMonster, 10.5, 10)).toBe(false)
    expect(stackedInternal.isMonsterCellOccupied(stackedMonster, 9.5, 10)).toBe(true)
  })

  it('populates S2C 0x67 velocityPercent (s[4]) for normal and Extra Fast monsters and blocks closed doors without terrain callback', () => {
    const game = new GameInstance({ seed: 1347, areaId: 1 })
    const playerId = connect(game, 25, 10)
    const fastId = game.spawnMonster({
      defId: 'fallen1',
      x: 10,
      y: 10,
      areaId: 1,
      velocity: 6,
      runSpeed: 9,
      aggroRadius: 40,
      umodIds: [6], // Extra Fast (+50%)
      hp: 500,
      maxHp: 500,
    })
    game.drainEvents(playerId)
    game.stepFrames(1)
    const move = game.drainEvents(playerId).find((e) => e.type === 'UnitMove') as
      | { velocityPercent?: number; npc?: { opcode: number; cmd: number; s: readonly number[] } }
      | undefined
    expect(game.getMonster(fastId)!.x).toBeGreaterThan(10)
    expect(move?.velocityPercent).toBe(150)
    expect(move?.npc?.opcode).toBe(0x67)
    expect(move?.npc?.cmd).toBe(0x17)
    expect(move?.npc?.s[4]).toBe(150)

    // Closed door (Objects.txt classId 13 = Door, mode 0 = closed) blocks step & path even without terrainWalkableCheck
    const doorGame = new GameInstance({ seed: 1348, areaId: 1 })
    connect(doorGame, 20, 10)
    const walkerId = doorGame.spawnMonster({
      defId: 'fallen1',
      x: 10.8,
      y: 10,
      areaId: 1,
      velocity: 6,
      runSpeed: 6,
    })
    // Spawn a closed door directly at (11, 10)
    doorGame.spawnObject({ classId: 13, x: 11, y: 10, areaId: 1, mode: 0 })
    const dgInternal = doorGame as unknown as {
      monsters: Map<number, { x: number; y: number; path: readonly { x: number; y: number }[] }>
      moveMonsterToward: (m: unknown, x: number, y: number, run: boolean) => number
    }
    const walker = dgInternal.monsters.get(walkerId)!
    // Force a cached waypoint onto the closed door cell (11, 10) and verify moveMonsterToward rejects it
    walker.path = [{ x: 11, y: 10 }]
    ;(walker as unknown as { pathIndex: number; pathTargetX: number; pathTargetY: number }).pathIndex = 0
    ;(walker as unknown as { pathTargetX: number }).pathTargetX = 11
    ;(walker as unknown as { pathTargetY: number }).pathTargetY = 10
    dgInternal.moveMonsterToward(walker, 11, 10, false)
    expect(walker.x).toBe(10.8)
    expect(walker.y).toBe(10)
    expect(walker.path).toHaveLength(0)
  })
})

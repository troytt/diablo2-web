/**
 * Pack-aware monster placement.
 *
 * The property that matters is the one the old round-robin spawner could not
 * give: members of a pack must land near each other, and packs must land away
 * from each other. These tests measure both distances rather than eyeballing a
 * screenshot.
 */
import { describe, expect, it } from 'vitest'
import { createWorld, spawnMonsterPacks, spawnMonsters } from '../src/server/ai/monster-ai.ts'
import type { CombatTerrain, MonsterPack, MonsterStats } from '../src/server/ai/monster-ai.ts'

/** Open ground everywhere. */
const OPEN: CombatTerrain = { overlap: () => 0 }

/** A wall down the middle of the spawn area. */
const WALLED: CombatTerrain = {
  overlap: (x: number) => (x > 900 && x < 1100 ? 1 : 0),
}

/**
 * A monster definition.
 *
 * @param id - its id.
 * @param hp - its health.
 * @returns the stats.
 */
function stats(id: string, hp = 30): MonsterStats {
  return { id, name: id, hp, damage: 5, cooldownTicks: 25, reach: 40, aggroRadius: 200, speed: 100, xp: 10 }
}

/**
 * A pack of one kind.
 *
 * @param id - the monster id.
 * @param count - how many members.
 * @returns the pack.
 */
function pack(id: string, count: number): MonsterPack {
  return { members: Array.from({ length: count }, (_, i) => stats(id, 30 + i)) }
}

/**
 * Distance between two monsters.
 *
 * @param a - one.
 * @param b - the other.
 * @returns the distance in pixels.
 */
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

describe('spawnMonsterPacks', () => {
  it('places every member of every pack on open ground', () => {
    const world = createWorld(1000, 1000)
    const placed = spawnMonsterPacks(world, [pack('fallen1', 4), pack('zombie1', 2)], { x: 1000, y: 1000 }, 600, OPEN)
    expect(placed).toBe(6)
    expect(world.monsters).toHaveLength(6)
  })

  it('keeps a pack together', () => {
    const world = createWorld(1000, 1000)
    spawnMonsterPacks(world, [pack('fallen1', 5)], { x: 1000, y: 1000 }, 600, OPEN)
    const members = world.monsters
    expect(members).toHaveLength(5)
    // Every member is within a camp's radius of the leader.
    const leader = members[0]!
    for (const member of members.slice(1)) {
      expect(distance(leader, member)).toBeLessThanOrEqual(96)
    }
  })

  it('keeps packs apart', () => {
    const world = createWorld(1000, 1000)
    spawnMonsterPacks(world, [pack('fallen1', 3), pack('zombie1', 3), pack('quillrat1', 3)], { x: 1000, y: 1000 }, 800, OPEN)
    const camps = new Map<string, { x: number; y: number }>()
    for (const monster of world.monsters) {
      if (!camps.has(monster.stats.id)) camps.set(monster.stats.id, { x: monster.x, y: monster.y })
    }
    const centres = [...camps.values()]
    expect(centres).toHaveLength(3)
    for (let i = 0; i < centres.length; i += 1) {
      for (let j = i + 1; j < centres.length; j += 1) {
        expect(distance(centres[i]!, centres[j]!)).toBeGreaterThan(96)
      }
    }
  })

  it('clusters far tighter than the flat spawner does', () => {
    // This is the regression the function exists to prevent: passing the same
    // monsters through `spawnMonsters` spreads them over the whole level.
    const spreadOut = createWorld(1000, 1000)
    spawnMonsters(spreadOut, [stats('fallen1')], 6, { x: 1000, y: 1000 }, 600, OPEN)
    const clustered = createWorld(1000, 1000)
    spawnMonsterPacks(clustered, [pack('fallen1', 6)], { x: 1000, y: 1000 }, 600, OPEN)

    const spanOf = (monsters: readonly { x: number; y: number }[]): number => {
      let max = 0
      for (let i = 0; i < monsters.length; i += 1) {
        for (let j = i + 1; j < monsters.length; j += 1) max = Math.max(max, distance(monsters[i]!, monsters[j]!))
      }
      return max
    }
    expect(spanOf(clustered.monsters)).toBeLessThan(spanOf(spreadOut.monsters) / 2)
  })

  it('gives each member its own rolled health rather than sharing one', () => {
    const world = createWorld(1000, 1000)
    spawnMonsterPacks(world, [pack('fallen1', 4)], { x: 1000, y: 1000 }, 600, OPEN)
    expect(new Set(world.monsters.map(monster => monster.hp)).size).toBe(4)
  })

  it('refuses blocked ground rather than nudging monsters into it', () => {
    const world = createWorld(1000, 1000)
    const placed = spawnMonsterPacks(world, [pack('fallen1', 4), pack('zombie1', 4)], { x: 1000, y: 1000 }, 600, WALLED)
    expect(world.monsters.every(monster => WALLED.overlap(monster.x, monster.y) === 0)).toBe(true)
    expect(placed).toBe(world.monsters.length)
  })

  it('is deterministic', () => {
    const encode = (): string => {
      const world = createWorld(1000, 1000)
      spawnMonsterPacks(world, [pack('fallen1', 3), pack('zombie1', 4)], { x: 1000, y: 1000 }, 500, OPEN)
      return world.monsters.map(monster => `${monster.stats.id}@${monster.x.toFixed(3)},${monster.y.toFixed(3)}`).join('|')
    }
    expect(encode()).toBe(encode())
  })

  it('indexes monsters consecutively so the renderer can address them', () => {
    const world = createWorld(1000, 1000)
    spawnMonsterPacks(world, [pack('fallen1', 3), pack('zombie1', 2)], { x: 1000, y: 1000 }, 500, OPEN)
    expect(world.monsters.map(monster => monster.index)).toEqual([0, 1, 2, 3, 4])
  })

  it('appends to a world that already has monsters', () => {
    const world = createWorld(1000, 1000)
    spawnMonsters(world, [stats('existing')], 2, { x: 1000, y: 1000 }, 200, OPEN)
    spawnMonsterPacks(world, [pack('fallen1', 3)], { x: 1000, y: 1000 }, 500, OPEN)
    expect(world.monsters).toHaveLength(5)
    expect(world.monsters.map(monster => monster.index)).toEqual([0, 1, 2, 3, 4])
  })

  it('places nothing when given nothing', () => {
    const world = createWorld(1000, 1000)
    expect(spawnMonsterPacks(world, [], { x: 1000, y: 1000 }, 500, OPEN)).toBe(0)
    expect(spawnMonsterPacks(world, [{ members: [] }], { x: 1000, y: 1000 }, 500, OPEN)).toBe(0)
  })

  it('starts every monster idle and undamaged', () => {
    const world = createWorld(1000, 1000)
    spawnMonsterPacks(world, [pack('fallen1', 3)], { x: 1000, y: 1000 }, 500, OPEN)
    for (const monster of world.monsters) {
      expect(monster.state).toBe('idle')
      expect(monster.hp).toBe(monster.stats.hp)
      expect(monster.cooldown).toBe(0)
      expect(monster.corpseTicks).toBe(0)
    }
  })
})

import { describe, it, expect } from 'vitest'
import { computeLockstepHash } from '../src/server/engine/state-hash.ts'

describe('computeLockstepHash', () => {
  it('detects changes in inventory', () => {
    const world = { tick: 1, kills: 0, players: [], monsters: [] }
    const ground: import('../src/server/engine/state-hash.ts').HashableGroundItem[] = []
    const quests: import('../src/server/engine/state-hash.ts').HashableQuest[] = []
    
    const inv1 = { width: 10, height: 4, contents: [
      { x: 0, y: 0, item: { name: 'A', stack: 1, value: 5 } }
    ]}
    
    const inv2 = { width: 10, height: 4, contents: [
      { x: 0, y: 0, item: { name: 'B', stack: 1, value: 5 } }
    ]}
    
    const hash1 = computeLockstepHash(world, [inv1], ground, quests)
    const hash2 = computeLockstepHash(world, [inv2], ground, quests)
    
    expect(hash1).not.toBe(hash2)
  })

  it('detects changes in quest progress', () => {
    const world = { tick: 1, kills: 0, players: [], monsters: [] }
    const inv = { width: 10, height: 4, contents: [] }
    const ground: import('../src/server/engine/state-hash.ts').HashableGroundItem[] = []
    
    const quests1 = [ { def: { id: 'q1' }, status: 'active', kills: 0 } ]
    const quests2 = [ { def: { id: 'q1' }, status: 'completed', kills: 0 } ]
    
    const hash1 = computeLockstepHash(world, [inv], ground, quests1)
    const hash2 = computeLockstepHash(world, [inv], ground, quests2)
    
    expect(hash1).not.toBe(hash2)
  })

  it('detects changes in ground items', () => {
    const world = { tick: 1, kills: 0, players: [], monsters: [] }
    const inv = { width: 10, height: 4, contents: [] }
    const quests: import('../src/server/engine/state-hash.ts').HashableQuest[] = []
    
    const ground1 = [ { x: 5, y: 5, item: { name: 'Gold' } } ]
    const ground2 = [ { x: 5, y: 5, item: { name: 'Potion' } } ]
    
    const hash1 = computeLockstepHash(world, [inv], ground1, quests)
    const hash2 = computeLockstepHash(world, [inv], ground2, quests)
    
    expect(hash1).not.toBe(hash2)
  })

  it('produces identical hashes for identical states', () => {
    const world = { tick: 1, kills: 0, players: [], monsters: [] }
    const inv = { width: 10, height: 4, contents: [
      { x: 1, y: 1, item: { name: 'Sword', stack: 1, value: 100 } }
    ]}
    const ground = [ { x: 5, y: 5, item: { name: 'Gold' } } ]
    const quests = [ { def: { id: 'q1' }, status: 'active', kills: 0 } ]
    
    const hash1 = computeLockstepHash(world, [inv], ground, quests)
    
    // Deep clone to ensure stability across new references
    const world2 = JSON.parse(JSON.stringify(world))
    const inv2 = JSON.parse(JSON.stringify(inv))
    const ground2 = JSON.parse(JSON.stringify(ground))
    const quests2 = JSON.parse(JSON.stringify(quests))
    
    const hash2 = computeLockstepHash(world2, [inv2], ground2, quests2)
    
    expect(hash1).toBe(hash2)
  })
})

import { describe, it, expect } from 'vitest'
import { parseSnapshot } from '../src/server/save/save.ts'

describe('parseSnapshot', () => {
  it('rejects malformed placed items in inventory', () => {
    const badSnapshot = {
      version: 1,
      rngState: 0,
      world: {
        tick: 0,
        player: {},
        monsters: [],
      },
      inventory: {
        width: 10,
        height: 4,
        placed: [
          { x: 1, y: 1 }, // Missing item
        ]
      },
      quests: [],
      ground: []
    }
    
    expect(() => parseSnapshot(JSON.stringify(badSnapshot))).toThrow('inventory placed item [0] has no item')
  })
})

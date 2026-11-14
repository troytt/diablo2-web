import { describe, it, expect } from 'vitest'
import {
  DUNGEON_CheckRoomIsTown113c,
  SparseMemory113c,
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
} from '../../../src/d2kern-113c/index.ts'

describe('M6 Pathfinding - Town Check', () => {
  it('should identify valid town level IDs', () => {
    const m = new SparseMemory113c()
    const D2LevelStrc_SIZE = 0x230
    
    const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
    const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
    const pLevel = m.alloc(D2LevelStrc_SIZE)

    m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
    m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)

    // Valid towns
    const towns = [1, 40, 75, 103, 109]
    for (const levelId of towns) {
      m.setU32(pLevel + 0x1d0, levelId)
      expect(DUNGEON_CheckRoomIsTown113c(m, pRoom)).toBe(1)
    }

    // Invalid towns
    const nonTowns = [2, 74, 110, 0]
    for (const levelId of nonTowns) {
      m.setU32(pLevel + 0x1d0, levelId)
      expect(DUNGEON_CheckRoomIsTown113c(m, pRoom)).toBe(0)
    }
  })

  it('should return 0 for null pointers', () => {
    const m = new SparseMemory113c()
    const D2LevelStrc_SIZE = 0x230
    
    // pRoom = 0
    expect(DUNGEON_CheckRoomIsTown113c(m, 0)).toBe(0)

    const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
    // pRoomEx = 0
    m.set(pRoom, D2ActiveRoomStrc.pRoomEx, 0)
    expect(DUNGEON_CheckRoomIsTown113c(m, pRoom)).toBe(0)

    const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
    m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
    // pLevel = 0
    m.set(pRoomEx, D2RoomExStrc.pLevel, 0)
    expect(DUNGEON_CheckRoomIsTown113c(m, pRoom)).toBe(0)
  })
})

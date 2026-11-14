import { describe, expect, it } from 'vitest'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  CLIENTS_GetPlayerUnit113c,
  CLIENTS_UpdatePlayerRoom113c,
  GAME_ClearAllActRoomUpdateLists113c,
  MONSTER_ApplyModeVelocityOverride113c,
  MONSTER_StartModeWalk113c,
  OBJECTS_SpawnDensityWithSecondaryTorch113c,
  PLAYER_StepModeWalkOrRun113c,
  ROOM_DeactivateAnyUnitInRoom113c,
  SUNIT_FreeUnit113c,
  SUNIT_SendRemovePortalsInAdjacentRooms113c,
  SUNIT_SyncAdjacentRoomUnitsToClient113c,
} from '../../../src/d2kern-113c/game/replay-final11-113c.ts'

function createTestMem(): SparseMemory113c {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(0x6fdd6000, 0x20000, 0)
  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  const pObjectsTxt = m.alloc(200 * 0x1c0)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 200)
  const pAnimDataTable = m.alloc(0x420)
  const pEmptyBucket = m.alloc(16)
  for (let i = 0; i < 256; i++) {
    m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  }
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  return m
}

describe('K1R14-LaneK: Final 11 D2Game.dll Functions (2,308 B)', () => {
  it('ports CLIENTS_GetPlayerUnit113c (0x6FC6AD10) fast-path and server-unit verification', () => {
    const m = createTestMem()
    const pGame = m.alloc(0x2000)
    const pClient = m.alloc(0x400)
    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 7)

    m.setU32(pClient + 0x16c, 0)
    m.setU32(pClient + 0x170, 7)
    m.setU32(pClient + 0x174, pPlayer)
    m.setU32(pClient + 0x1a8, pGame)
    m.setU8(pClient + 0x3d4, 0)

    // With bSkipVerify != 0, returns pClient->pPlayerUnit without hash lookup
    expect(CLIENTS_GetPlayerUnit113c(m, pClient, 1)).toBe(pPlayer)

    // With flag bit 0 set on +0x3D4, returns pClient->pPlayerUnit directly
    m.setU8(pClient + 0x3d4, 1)
    expect(CLIENTS_GetPlayerUnit113c(m, pClient, 0)).toBe(pPlayer)

    // When unverified and not registered in server hash table, clears +0x174 to 0
    m.setU8(pClient + 0x3d4, 0)
    expect(CLIENTS_GetPlayerUnit113c(m, pClient, 0)).toBe(0)
    expect(m.u32(pClient + 0x174)).toBe(0)

    // Register player in pGame->pUnitLists[0][7 & 0x7F] (+0x1120 + 7*4)
    m.setU32(pGame + 0x1120 + 7 * 4, pPlayer)
    m.setU32(pClient + 0x174, pPlayer)
    expect(CLIENTS_GetPlayerUnit113c(m, pClient, 0)).toBe(pPlayer)
  })

  it('ports SUNIT_SendRemovePortalsInAdjacentRooms113c (0x6FCBD780) and SUNIT_SyncAdjacentRoomUnitsToClient113c (0x6FCBDEC0)', () => {
    const m = createTestMem()
    const pGame = m.alloc(0x2000)
    const pAct = m.alloc(0x80)
    m.setU32(pGame + 0xbc, pAct)
    m.setU32(pAct, 1)

    const pRoom = m.alloc(0x80)
    const pAdjRoom = m.alloc(0x80)
    const pAdjArr = m.alloc(8)
    m.setU32(pAdjArr, pAdjRoom)
    m.setU32(pRoom, pAdjArr) // ppRoomsNear (+0x00)
    m.setU32(pRoom + 0x24, 1) // nRoomsNear (+0x24)

    const pPortalNode = m.alloc(0x10)
    m.setU32(pPortalNode, 2) // object
    m.setU32(pPortalNode + 4, 0x42)
    m.setU32(pPortalNode + 8, 0)
    m.setU32(pAdjRoom + 0x18, pPortalNode) // pPortalNodes (+0x18)

    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 1)

    const pClient = m.alloc(0x400)
    const pQueue = m.alloc(0x410)
    m.setU8(pClient + 0x1ac, 0)
    m.setU8(pClient + 0x3d4, 1)
    m.setU32(pClient + 0x174, pPlayer)
    m.setU32(pClient + 0x1bc, pQueue)

    SUNIT_SendRemovePortalsInAdjacentRooms113c(m, pRoom, pClient)
    expect(m.u32(pQueue + 0x04)).toBe(6)
    expect(m.u8(pQueue + 0x08)).toBe(0x0a)
    expect(m.u8(pQueue + 0x09)).toBe(2)
    expect(m.u32(pQueue + 0x0a)).toBe(0x42)

    SUNIT_SyncAdjacentRoomUnitsToClient113c(m, pRoom, pClient, pGame)
    m.setU32(pAct, 0)
    SUNIT_SyncAdjacentRoomUnitsToClient113c(m, pRoom, pClient, pGame)
  })

  it('ports CLIENTS_UpdatePlayerRoom113c (0x6FC6B400) and GAME_ClearAllActRoomUpdateLists113c (0x6FCBD850)', () => {
    const m = createTestMem()
    const pGame = m.alloc(0x2000)
    const pArena = m.alloc(0x20)
    m.setU32(pArena + 8, 0x0401)
    m.setU32(pGame + 0x1d28, pArena)

    const pAct = m.alloc(0x80)
    const pRoom = m.alloc(0x100)
    m.setU32(pAct, 1)
    m.setU32(pAct + 4, pRoom)
    m.setU32(pGame + 0xbc, pAct)

    const pPlayer = m.alloc(0x100)
    const pPath = m.alloc(0x80)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 1)
    m.setU32(pPlayer + 0x2c, pPath)
    m.setU32(pPath + 0x1c, pRoom)

    const pClient = m.alloc(0x400)
    m.setU8(pClient + 0x3d4, 1)
    m.setU32(pClient + 0x174, pPlayer)
    m.setU32(pClient + 0x1b0, 10)
    m.setU32(pClient + 0x1b4, pRoom)

    CLIENTS_UpdatePlayerRoom113c(m, pClient, pGame)
    expect(m.u32(pClient + 0x1b0)).toBe(11)

    GAME_ClearAllActRoomUpdateLists113c(m, pGame)
    expect(m.u32(pAct)).toBe(0)
    expect(m.u32(pArena + 8)).toBe(0x0001)
  })

  it('ports MONSTER_StartModeWalk113c (0x6FC94C60) and MONSTER_ApplyModeVelocityOverride113c (0x6FC94CE0)', () => {
    const m = createTestMem()
    const pGame = m.alloc(0x2000)
    const pUnit = m.alloc(0x100)
    const pPath = m.alloc(0x200)
    const pAnimData = m.alloc(0x80)
    m.setU32(pUnit, 1)
    m.setU32(pUnit + 0x0c, 12)
    m.setU32(pUnit + 0x2c, pPath)
    m.setU32(pUnit + 0x3c, pAnimData)

    const pModeArgs = m.alloc(0x30)
    m.setU32(pModeArgs + 0x04, pUnit)
    m.setU32(pModeArgs + 0x10, 0)

    expect(MONSTER_StartModeWalk113c(m, pGame, pModeArgs)).toBe(0)
    m.setU32(pPath + 0x28, 3) // dwPathPoints (+0x28)
    expect(MONSTER_StartModeWalk113c(m, pGame, pModeArgs)).toBe(1)
    expect(m.u32(pUnit + 0x10)).toBe(2)

    // No-op when velocity override == 0
    MONSTER_ApplyModeVelocityOverride113c(m, pModeArgs, pUnit)
    expect(m.u32(pUnit + 0x5c)).toBe(0)

    // Allocates 0x4004 statlist and sets STAT_VELOCITYPERCENT (0x43) when velocity != 0
    const pStatListEx = m.alloc(0x80)
    m.setU32(pStatListEx + 0x10, 0x80000000)
    m.setU32(pUnit + 0x5c, pStatListEx)
    m.setU32(pModeArgs + 0x10, 50)
    MONSTER_ApplyModeVelocityOverride113c(m, pModeArgs, pUnit)
    expect(m.u32(pStatListEx + 0x48)).toBeGreaterThan(0)
  })

  it('ports PLAYER_StepModeWalkOrRun113c (0x6FC99B90)', () => {
    const m = createTestMem()
    const pGame = m.alloc(0x2000)
    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x200)
    const pPath = m.alloc(0x200)
    const pAnimData = m.alloc(0x80)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x10, 2)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x2c, pPath)
    m.setU32(pPlayer + 0x3c, pAnimData)
    m.setU16(pPath + 0x02, 5100)
    m.setU16(pPath + 0x06, 5200)

    m.setU32(0x6fd18d10, 100)
    m.setU32(pPlayerData + 0xa4, 0)

    const res = PLAYER_StepModeWalkOrRun113c(m, pGame, pPlayer)
    expect(res).toBe(2)
    expect(m.u32(pPlayerData + 0xa4)).toBe(100)
    expect(m.u8(pPlayerData + 0xa0)).toBe(1)
    expect(m.u32(pPlayerData + 0xa8)).toBe(5100)
    expect(m.u32(pPlayerData + 0xac)).toBe(5200)
  })

  it('ports OBJECTS_SpawnDensityWithSecondaryTorch113c (0x6FC53260), ROOM_DeactivateAnyUnitInRoom113c (0x6FC409B0), and SUNIT_FreeUnit113c (0x6FD020A0)', () => {
    const m = createTestMem()
    const pGame = m.alloc(0x2000)
    const pObjCtrl = m.alloc(0x40)
    m.setU32(pGame + 0x10f0, pObjCtrl)
    const pRoom = m.alloc(0x100)
    expect(OBJECTS_SpawnDensityWithSecondaryTorch113c(m, pGame, pRoom, 0, 1, 0)).toBe(0)

    const pTileUnit = m.alloc(0x100)
    m.setU32(pTileUnit, 5)
    m.setU32(pTileUnit + 0x0c, 99)
    const pNode74 = m.alloc(0x10)
    m.setU32(pTileUnit + 0x74, pNode74)

    SUNIT_FreeUnit113c(m, pGame, pTileUnit)
    expect(m.u32(pTileUnit + 0x74)).toBe(0)

    const pItemUnit = m.alloc(0x100)
    m.setU32(pItemUnit, 4)
    m.setU32(pItemUnit + 0x0c, 100)
    ROOM_DeactivateAnyUnitInRoom113c(m, pItemUnit, pGame)
  })
})

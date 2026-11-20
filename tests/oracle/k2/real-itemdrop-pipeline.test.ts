import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLLISION_CheckSubtileMask113c } from '../../../src/d2kern-113c/common/collision.ts'
import { DRLG_GetLevel113c } from '../../../src/d2kern-113c/common/drlg/drlg.ts'
import {
  DRLG_InitLevelRooms113c,
  DRLGROOM_EnsureRoomAndGetRoom1_113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.ts'
import { DRLG_GetRoomExFromCoordinates113c } from '../../../src/d2kern-113c/common/dungeon.ts'
import {
  ITEMS_GetCommandFlags113c,
  ITEMS_GetItemFormat113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemSeed113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { STATLIST_GetUnitStat113c, STATLIST_SetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import {
  UNIT_ITEM,
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITS_GetRoom113c,
  UNITS_GetX113c,
  UNITS_GetY113c,
} from '../../../src/d2kern-113c/common/unit.ts'
import {
  ITEMS_ApplyItemDurabilityLoss113c,
  ITEMS_ExpireGroundItemsInAct113c,
  ITEMS_FinalizeCreatedItem113c,
  ITEMS_GenerateMagicOrRareAffixes113c,
  ITEMS_RollItemQuality113c,
  MONSTER_DropDeathItems113c,
  SUNIT_GetServerUnitFromHash113c,
} from '../../../src/d2kern-113c/game/combat-a1c-113c.ts'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  SUNIT_ClearItemPerTickCommandFlags_6FD00986_113c,
  buildGroundItemPacket9C_6FCAD3D0_113c,
  dropMonsterDeathItemsOnMemory113c,
} from '../../../src/d2kern-113c/game/k2-real-itemdrop-113c.ts'
import {
  ITEMS_RollRarePrefixId_6FC34210_113c,
  ITEMS_RollRareSuffixId_6FC34370_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c.ts'
import { SUNIT_AllocUnitData113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { D2ActiveRoomStrc, D2GameStrc, D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import type { Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { SEED_InitLowSeed113c } from '../../../src/d2kern-113c/prng.ts'
import {
  bootFromSnapshot113c,
  loadSnapshotFile113c,
  REPO_ROOT_113C,
} from '../../../tools/oracle/kern-replay/replay-113c.ts'

function snapPath(scenario: string): string {
  return join(REPO_ROOT_113C, 'tests/fixtures/oracle/k1/replay', `${scenario}.snap-f002.ndjson.gz`)
}

function readStaticCoords(m: Memory113c, pItem: number): [number, number] {
  const pPath = m.get(pItem, D2UnitStrc.pPath)
  return [m.u32((pPath + 0x0c) >>> 0) | 0, m.u32((pPath + 0x10) >>> 0) | 0]
}

function setUnitCoords(m: Memory113c, pUnit: number, x: number, y: number): void {
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  m.setU16((pPath + 0x02) >>> 0, x & 0xffff)
  m.setU16((pPath + 0x06) >>> 0, y & 0xffff)
  m.setU32((pPath + 0x0c) >>> 0, x >>> 0)
  m.setU32((pPath + 0x10) >>> 0, y >>> 0)
}

function roomContainsUnit(m: Memory113c, pRoom: number, targetUnit: number): boolean {
  let cur = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst)
  while (cur !== 0) {
    if (cur === targetUnit) return true
    cur = m.get(cur, D2UnitStrc.pRoomUnitNext)
  }
  return false
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0')
  }
  return out
}

function spawnMonsterAtCoords(
  m: Memory113c,
  pGame: number,
  classId: number,
  x: number,
  y: number,
): number {
  const pAct0 = m.u32((pGame + 0xbc) >>> 0) >>> 0
  const pDrlg = m.u32((pAct0 + 0x48) >>> 0) >>> 0
  const pLvl2 = DRLG_GetLevel113c(m, pDrlg, 2)
  if (m.u32((pLvl2 + 0x10) >>> 0) === 0) {
    DRLG_InitLevelRooms113c(m, pLvl2)
  }
  const pRoomEx = DRLG_GetRoomExFromCoordinates113c(
    m,
    pLvl2,
    Math.floor(x / 5),
    Math.floor(y / 5),
  )
  expect(pRoomEx).not.toBe(0)
  const pBmRoom = DRLGROOM_EnsureRoomAndGetRoom1_113c(m, pRoomEx)
  expect(pBmRoom).not.toBe(0)
  const pMon = SUNIT_AllocUnitData113c(m, UNIT_MONSTER, classId, x, y, pGame, pBmRoom, 1, 1, 0)
  expect(pMon).not.toBe(0)
  STATLIST_SetUnitStat113c(m, pMon, 12, 1, 0)
  setUnitCoords(m, pMon, x, y)
  return pMon
}

describe('[K2] Real 1:1 D2Game Monster Drop -> TC -> CreateItemEx -> Affix -> Ground Spiral -> Durability Pipeline', () => {
  it('reproduces a1-bloodmoor-melee F1106 mon#10 death drop (#9 Leather Gloves + S2C 0x9C packet) & Buckler #2 durability 12 -> 11', () => {
    const { m, pGame } = bootFromSnapshot113c(loadSnapshotFile113c(snapPath('a1-bloodmoor-melee')))
    const pPlayer = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_PLAYER, 1)
    expect(pPlayer).not.toBe(0)
    const pMon10 = spawnMonsterAtCoords(m, pGame, 5, 5662, 5794)

    // Advance world to exact F1106 pre-drop state recorded by Wine D2Game.dll
    m.set(pGame, D2GameStrc.dwGameFrame, 1106)
    m.set(pGame, D2GameStrc.seedLo, 1944981566)
    m.set(pGame, D2GameStrc.seedHi, 1245284809)
    m.set(pMon10, D2UnitStrc.seedLo, 3019715145)
    m.set(pMon10, D2UnitStrc.seedHi, 1178123501)

    const packets9C: string[] = []
    dropMonsterDeathItemsOnMemory113c(m, pGame, pMon10, pPlayer, {
      onWorldItemAction9C: (_pItem, pkt) => {
        packets9C.push(toHex(pkt))
      },
    })

    // Exact post-drop monster & game PRNG seeds
    expect([m.get(pMon10, D2UnitStrc.seedLo) >>> 0, m.get(pMon10, D2UnitStrc.seedHi) >>> 0]).toEqual([
      3522362615, 1791108674,
    ])
    expect([m.get(pGame, D2GameStrc.seedLo) >>> 0, m.get(pGame, D2GameStrc.seedHi) >>> 0]).toEqual([
      1604951332, 1158190472,
    ])
    expect(m.get(pGame, D2GameStrc.dwLastUnitId, UNIT_ITEM)).toBe(9)

    // Verify UNIT_ITEM #9 in pGame->pUnitHash list 3 (UNIT_ITEM), room unit list, and 0x200 (COLLIDE_ITEM) subtile collision
    const pItem9 = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_ITEM, 9)
    expect(pItem9).not.toBe(0)
    expect(m.get(pItem9, D2UnitStrc.dwClassId)).toBe(344) // Leather Gloves ('tgl')
    expect(m.get(pItem9, D2UnitStrc.dwAnimMode)).toBe(3) // IMODE_ONGROUND
    expect(readStaticCoords(m, pItem9)).toEqual([5664, 5797])

    const pItemData9 = m.get(pItem9, D2UnitStrc.pUnitData)
    expect(ITEMS_GetItemQuality113c(m, pItem9)).toBe(2)
    expect(m.u32((pItemData9 + 0x0c) >>> 0) >>> 0).toBe(0xffffffff) // dwOwnerGUID = -1
    // Before 0x6FD00986 end-of-frame cleanup, 0x2000 (ITEMCMD_NEWITEM) stays set alongside 0x80010 for S2C 0x9C
    expect(m.u32((pItemData9 + 0x18) >>> 0) >>> 0).toBe(0x82010)
    expect(m.u32((pItemData9 + 0x2c) >>> 0) >>> 0).toBe(1) // dwItemLevel = 1
    expect(ITEMS_GetItemFormat113c(m, pItem9)).toBe(101)
    expect(m.u8((pItemData9 + 0x45) >>> 0)).toBe(0xff) // nItemPage = 0xFF

    expect(STATLIST_GetUnitStat113c(m, pItem9, 31, 0)).toBe(2) // ARMORCLASS = 2
    expect(STATLIST_GetUnitStat113c(m, pItem9, 72, 0)).toBe(7) // DURABILITY = 7
    expect(STATLIST_GetUnitStat113c(m, pItem9, 73, 0)).toBe(12) // MAXDURABILITY = 12

    const pRoom9 = UNITS_GetRoom113c(m, pItem9)
    expect(pRoom9).not.toBe(0)
    expect(roomContainsUnit(m, pRoom9, pItem9)).toBe(true)
    expect(COLLISION_CheckSubtileMask113c(m, pRoom9, 5664, 5797, 0x200)).toBe(0x200)

    // Bit-exact 29-byte S2C 0x9C ground drop packet recorded in Wine D2Game.dll
    expect(packets9C).toEqual(['9c001d100900000010208000650cc4a2d4824d8c0d040181010c07fe03'])
    expect(toHex(buildGroundItemPacket9C_6FCAD3D0_113c(m, pGame, pItem9, 0))).toBe(
      '9c001d100900000010208000650cc4a2d4824d8c0d040181010c07fe03',
    )

    // End-of-frame 0x6FD00986 clears 0x2000 -> post-frame t4 dwCommandFlags == 0x80010 (524304)
    SUNIT_ClearItemPerTickCommandFlags_6FD00986_113c(m, pItem9)
    expect(m.u32((pItemData9 + 0x18) >>> 0) >>> 0).toBe(0x80010)

    // Verify Buckler #2 durability loss 12 -> 11 via ITEMS_ApplyItemDurabilityLoss113c (0x6FC32EE0)
    const pBuckler2 = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_ITEM, 2)
    expect(pBuckler2).not.toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pBuckler2, 72, 0)).toBe(12)
    // Seed pOwner->tSeed (+0x20) where next lo % 100 == 5 < 10 (10% armor durability loss hit)
    SEED_InitLowSeed113c(m, (pPlayer + 0x20) >>> 0, 27)
    ITEMS_ApplyItemDurabilityLoss113c(m, pGame, pPlayer, pBuckler2, 0)
    expect(STATLIST_GetUnitStat113c(m, pBuckler2, 72, 0)).toBe(11)
  })

  it('reproduces p52-dot-ticks F808 (#8 Leather Gloves) and F883 (#9 Gold pile) via MONSTER_DropDeathItems113c', () => {
    const { m, pGame } = bootFromSnapshot113c(loadSnapshotFile113c(snapPath('p52-dot-ticks')))
    const pPlayer = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_PLAYER, 1)
    const pMon10 = spawnMonsterAtCoords(m, pGame, 5, 5662, 5794)
    const pMon9 = spawnMonsterAtCoords(m, pGame, 5, 5664, 5795)

    // 1. F808 mon#10 death -> Item #8 Leather Gloves (class=344, (5664, 5797), stats=[(31,0,2),(72,0,11),(73,0,12)])
    m.set(pGame, D2GameStrc.dwGameFrame, 808)
    m.set(pGame, D2GameStrc.seedLo, 227515971)
    m.set(pGame, D2GameStrc.seedHi, 1402514428)
    m.set(pMon10, D2UnitStrc.seedLo, 3019715145)
    m.set(pMon10, D2UnitStrc.seedHi, 1178123501)

    MONSTER_DropDeathItems113c(m, pGame, pMon10, pPlayer)

    expect([m.get(pMon10, D2UnitStrc.seedLo) >>> 0, m.get(pMon10, D2UnitStrc.seedHi) >>> 0]).toEqual([
      3522362615, 1791108674,
    ])
    expect([m.get(pGame, D2GameStrc.seedLo) >>> 0, m.get(pGame, D2GameStrc.seedHi) >>> 0]).toEqual([
      1944981566, 1245284809,
    ])

    const pItem8 = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_ITEM, 8)
    expect(pItem8).not.toBe(0)
    expect(m.get(pItem8, D2UnitStrc.dwClassId)).toBe(344)
    expect(m.get(pItem8, D2UnitStrc.dwAnimMode)).toBe(3)
    expect(readStaticCoords(m, pItem8)).toEqual([5664, 5797])
    expect(STATLIST_GetUnitStat113c(m, pItem8, 31, 0)).toBe(2)
    expect(STATLIST_GetUnitStat113c(m, pItem8, 72, 0)).toBe(11)
    expect(STATLIST_GetUnitStat113c(m, pItem8, 73, 0)).toBe(12)
    expect(toHex(buildGroundItemPacket9C_6FCAD3D0_113c(m, pGame, pItem8, 0))).toBe(
      '9c001d100800000010208000650cc4a2d4824d8c0d040181010c0bfe03',
    )
    SUNIT_ClearItemPerTickCommandFlags_6FD00986_113c(m, pItem8)

    // 2. F883 mon#9 death -> Item #9 Gold (class=523, (5666, 5798), stats=[(14,0,2)])
    // Note: in F883 mon#9 ticked 1 AI PRNG roll ([3960767045, 763762509] -> [3052611174, 1652005710]) before poison tick death
    m.set(pGame, D2GameStrc.dwGameFrame, 883)
    m.set(pGame, D2GameStrc.seedLo, 2358520858)
    m.set(pGame, D2GameStrc.seedHi, 607534822)
    m.set(pMon9, D2UnitStrc.seedLo, 3052611174)
    m.set(pMon9, D2UnitStrc.seedHi, 1652005710)

    MONSTER_DropDeathItems113c(m, pGame, pMon9, pPlayer)

    expect([m.get(pMon9, D2UnitStrc.seedLo) >>> 0, m.get(pMon9, D2UnitStrc.seedHi) >>> 0]).toEqual([
      454133708, 1273220827,
    ])
    expect([m.get(pGame, D2GameStrc.seedLo) >>> 0, m.get(pGame, D2GameStrc.seedHi) >>> 0]).toEqual([
      995237092, 973733985,
    ])

    const pItem9 = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_ITEM, 9)
    expect(pItem9).not.toBe(0)
    expect(m.get(pItem9, D2UnitStrc.dwClassId)).toBe(523)
    expect(m.get(pItem9, D2UnitStrc.dwAnimMode)).toBe(3)
    expect(readStaticCoords(m, pItem9)).toEqual([5666, 5798])
    expect(STATLIST_GetUnitStat113c(m, pItem9, 14, 0)).toBe(2)
    expect(toHex(buildGroundItemPacket9C_6FCAD3D0_113c(m, pGame, pItem9, 0))).toBe(
      '9c001810090000001020a000654cc4c2d4e28c8d0c840000',
    )
    SUNIT_ClearItemPerTickCommandFlags_6FD00986_113c(m, pItem9)
  })

  it('reproduces p52-item-defense F781 (#13 Arrows), F837 (NoDrop), F1129 (#14 Gold), & Hwanin Refuge #8 durability 32 -> 31', () => {
    const { m, pGame } = bootFromSnapshot113c(loadSnapshotFile113c(snapPath('p52-item-defense')))
    const pPlayer = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_PLAYER, 1)
    const pMon9 = spawnMonsterAtCoords(m, pGame, 5, 5664, 5794)
    const pMon10 = spawnMonsterAtCoords(m, pGame, 5, 5660, 5795)
    const pMon11 = spawnMonsterAtCoords(m, pGame, 5, 5644, 5790)

    // 1. F781 mon#9 -> Item #13 Arrows (class=528, (5666, 5797), stats=[(70,0,68)])
    // Pre-drop seed after 3 MONMODE_ATTACK1 melee rolls (toHit+dmg+crit) before dying to retaliation
    m.set(pGame, D2GameStrc.dwGameFrame, 781)
    m.set(pGame, D2GameStrc.seedLo, 3088963594)
    m.set(pGame, D2GameStrc.seedHi, 403133626)
    m.set(pMon9, D2UnitStrc.seedLo, 3838293264)
    m.set(pMon9, D2UnitStrc.seedHi, 108443040)

    MONSTER_DropDeathItems113c(m, pGame, pMon9, pPlayer)

    expect([m.get(pMon9, D2UnitStrc.seedLo) >>> 0, m.get(pMon9, D2UnitStrc.seedHi) >>> 0]).toEqual([
      242456963, 1396510939,
    ])
    expect([m.get(pGame, D2GameStrc.seedLo) >>> 0, m.get(pGame, D2GameStrc.seedHi) >>> 0]).toEqual([
      3677897155, 1429275358,
    ])

    const pItem13 = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_ITEM, 13)
    expect(pItem13).not.toBe(0)
    expect(m.get(pItem13, D2UnitStrc.dwClassId)).toBe(528)
    expect(m.get(pItem13, D2UnitStrc.dwAnimMode)).toBe(3)
    expect(readStaticCoords(m, pItem13)).toEqual([5666, 5797])
    expect(STATLIST_GetUnitStat113c(m, pItem13, 70, 0)).toBe(68)
    expect(toHex(buildGroundItemPacket9C_6FCAD3D0_113c(m, pGame, pItem13, 0))).toBe(
      '9c001a100d00000010208000654cc4a2d4622cce0e040181c87f',
    )
    SUNIT_ClearItemPerTickCommandFlags_6FD00986_113c(m, pItem13)

    // 2. F837 mon#10 -> NoDrop (gs unchanged; pre-drop seed after 3 MONMODE_ATTACK1 melee rolls)
    m.set(pGame, D2GameStrc.dwGameFrame, 837)
    m.set(pMon10, D2UnitStrc.seedLo, 2161042683)
    m.set(pMon10, D2UnitStrc.seedHi, 1590111614)

    MONSTER_DropDeathItems113c(m, pGame, pMon10, pPlayer)

    expect([m.get(pMon10, D2UnitStrc.seedLo) >>> 0, m.get(pMon10, D2UnitStrc.seedHi) >>> 0]).toEqual([
      3874263717, 901354412,
    ])
    expect([m.get(pGame, D2GameStrc.seedLo) >>> 0, m.get(pGame, D2GameStrc.seedHi) >>> 0]).toEqual([
      3677897155, 1429275358,
    ])
    expect(m.get(pGame, D2GameStrc.dwLastUnitId, UNIT_ITEM)).toBe(13)

    // 3. F1129 mon#11 -> Item #14 Gold (class=523, (5646, 5793), stats=[(14,0,2)])
    m.set(pGame, D2GameStrc.dwGameFrame, 1129)
    m.set(pMon11, D2UnitStrc.seedLo, 3344521355)
    m.set(pMon11, D2UnitStrc.seedHi, 468469343)

    MONSTER_DropDeathItems113c(m, pGame, pMon11, pPlayer)

    expect([m.get(pMon11, D2UnitStrc.seedLo) >>> 0, m.get(pMon11, D2UnitStrc.seedHi) >>> 0]).toEqual([
      3472726358, 1394974335,
    ])
    expect([m.get(pGame, D2GameStrc.seedLo) >>> 0, m.get(pGame, D2GameStrc.seedHi) >>> 0]).toEqual([
      4219837463, 498891475,
    ])

    const pItem14 = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_ITEM, 14)
    expect(pItem14).not.toBe(0)
    expect(m.get(pItem14, D2UnitStrc.dwClassId)).toBe(523)
    expect(m.get(pItem14, D2UnitStrc.dwAnimMode)).toBe(3)
    expect(readStaticCoords(m, pItem14)).toEqual([5646, 5793])
    expect(STATLIST_GetUnitStat113c(m, pItem14, 14, 0)).toBe(2)
    expect(toHex(buildGroundItemPacket9C_6FCAD3D0_113c(m, pGame, pItem14, 0))).toBe(
      '9c0018100e0000001020a00065ccc122d4e28c8d0c840000',
    )
    SUNIT_ClearItemPerTickCommandFlags_6FD00986_113c(m, pItem14)

    // 4. Hwanin's Refuge #8 durability loss 32 -> 31 via 0x6FC32EE0
    const pArmor8 = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_ITEM, 8)
    expect(pArmor8).not.toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pArmor8, 72, 0)).toBe(32)
    SEED_InitLowSeed113c(m, (pPlayer + 0x20) >>> 0, 27)
    ITEMS_ApplyItemDurabilityLoss113c(m, pGame, pPlayer, pArmor8, 0)
    expect(STATLIST_GetUnitStat113c(m, pArmor8, 72, 0)).toBe(31)
  })

  it('exercises standalone 0x6FC34370 RareSuffix, 0x6FC30A20 Magic/Rare/Ethereal/Socket item creation, 0x6FC2FC40 quality roll, & 0x6FC2FB70 ground expiration', () => {
    const { m, pGame } = bootFromSnapshot113c(loadSnapshotFile113c(snapPath('a1-bloodmoor-melee')))
    const pPlayer = SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_PLAYER, 1)
    const pRoom = UNITS_GetRoom113c(m, pPlayer)
    const dropX = (UNITS_GetX113c(m, pPlayer) + 1) | 0
    const dropY = (UNITS_GetY113c(m, pPlayer) + 1) | 0
    expect(COLLISION_CheckSubtileMask113c(m, pRoom, dropX, dropY, 0x200)).toBe(0)

    // 1. Create a Rare Leather Armor (classId = 314, ilvl = 35, quality = 6, forced Ethereal + Sockets)
    const pDrop = m.alloc(0x84)
    m.fill(pDrop, 0x84, 0)
    m.setU32((pDrop + 0x08) >>> 0, pGame)
    m.setU32((pDrop + 0x0c) >>> 0, 35)
    m.setU32((pDrop + 0x14) >>> 0, 314) // Quilted / Leather Armor family
    m.setU32((pDrop + 0x18) >>> 0, 3) // IMODE_ONGROUND
    m.setU32((pDrop + 0x1c) >>> 0, dropX >>> 0)
    m.setU32((pDrop + 0x20) >>> 0, dropY >>> 0)
    m.setU32((pDrop + 0x24) >>> 0, pRoom)
    m.setU16((pDrop + 0x28) >>> 0, 1)
    m.setU16((pDrop + 0x2a) >>> 0, 101)
    m.setU32((pDrop + 0x30) >>> 0, 6) // ITEMQUAL_RARE
    m.setU32((pDrop + 0x80) >>> 0, 0x04) // Force Ethereal bit

    const pRareItem = ITEMS_FinalizeCreatedItem113c(m, pGame, pDrop, 0)
    expect(pRareItem).toBeGreaterThan(0)
    expect(ITEMS_GetItemQuality113c(m, pRareItem)).toBe(6)

    const pRareData = m.get(pRareItem, D2UnitStrc.pUnitData)
    const wRarePrefix = m.u16((pRareData + 0x32) >>> 0)
    const wRareSuffix = m.u16((pRareData + 0x34) >>> 0)
    expect(wRarePrefix).toBeGreaterThan(0)
    expect(wRareSuffix).toBeGreaterThan(0)
    expect(ITEMS_GetCommandFlags113c(m, pRareItem) & 0x400000).not.toBe(0) // ITEMFLAG_ETHEREAL

    // Verify 0x6FC34370 (RareSuffix) rolls standalone from RareAffix table (+0x08/+0x0C)
    SEED_InitLowSeed113c(m, ITEMS_GetItemSeed113c(m, pRareItem), 123456)
    const preId = ITEMS_RollRarePrefixId_6FC34210_113c(m, 1, pRareItem)
    SEED_InitLowSeed113c(m, ITEMS_GetItemSeed113c(m, pRareItem), 123456)
    const sufId = ITEMS_RollRareSuffixId_6FC34370_113c(m, 0, pRareItem)
    expect(preId).toBeGreaterThan(0)
    expect(sufId).toBeGreaterThan(0)
    expect(sufId).not.toBe(preId)

    // 2. Create a Normal Broad Sword with forced Sockets (dwFlags2 = 0x10)
    const pSockDrop = m.alloc(0x84)
    m.fill(pSockDrop, 0x84, 0)
    m.setU32((pSockDrop + 0x08) >>> 0, pGame)
    m.setU32((pSockDrop + 0x0c) >>> 0, 25)
    m.setU32((pSockDrop + 0x14) >>> 0, 30) // Broad Sword ('bsd')
    m.setU32((pSockDrop + 0x18) >>> 0, 4)
    m.setU16((pSockDrop + 0x2a) >>> 0, 101)
    m.setU32((pSockDrop + 0x30) >>> 0, 2)
    m.setU32((pSockDrop + 0x80) >>> 0, 0x10) // Force socket roll = 0 (< 33)

    const pSword = D2GAME_CreateItemEx_6FC31490_113c(m, pGame, pSockDrop, 0)
    expect(pSword).toBeGreaterThan(0)
    expect(ITEMS_GetCommandFlags113c(m, pSword) & 0x800).not.toBe(0) // ITEMFLAG_SOCKETED
    expect(STATLIST_GetUnitStat113c(m, pSword, 194, 0)).toBeGreaterThanOrEqual(1)

    // 3. Roll Magic affixes via ITEMS_GenerateMagicOrRareAffixes113c (0x6FC30A20) on Ring ('rin', classId = 522)
    const pMagicDrop = m.alloc(0x84)
    m.fill(pMagicDrop, 0x84, 0)
    m.setU32((pMagicDrop + 0x08) >>> 0, pGame)
    m.setU32((pMagicDrop + 0x0c) >>> 0, 25)
    m.setU32((pMagicDrop + 0x14) >>> 0, 522) // Ring ('rin')
    m.setU32((pMagicDrop + 0x18) >>> 0, 4)
    m.setU16((pMagicDrop + 0x2a) >>> 0, 101)
    m.setU32((pMagicDrop + 0x30) >>> 0, 4) // Magic
    const pMagicRing = D2GAME_CreateItemEx_6FC31490_113c(m, pGame, pMagicDrop, 0)
    expect(pMagicRing).toBeGreaterThan(0)
    expect(ITEMS_GenerateMagicOrRareAffixes113c(m, pGame, pMagicRing, pMagicDrop)).toBe(1)
    expect(ITEMS_GetItemQuality113c(m, pMagicRing)).toBe(4)

    // 4. Roll item quality via 0x6FC2FC40 with high TC factors -> Magic/Rare/Set/Unique
    const pFactors = m.alloc(16)
    m.setU32(pFactors + 0x00, 950)
    m.setU32(pFactors + 0x04, 950)
    m.setU32(pFactors + 0x08, 950)
    m.setU32(pFactors + 0x0c, 1024)
    const rolledQual = ITEMS_RollItemQuality113c(
      m,
      pGame,
      pPlayer,
      (pPlayer + 0x20) >>> 0,
      30,
      30,
      pFactors,
    )
    expect(rolledQual).toBeGreaterThanOrEqual(4)

    // 5. Ground expiration sweep via ITEMS_ExpireGroundItemsInAct113c (0x6FC2FB70)
    const rareUnitId = m.get(pRareItem, D2UnitStrc.dwUnitId)
    expect(SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_ITEM, rareUnitId)).toBe(pRareItem)
    expect(COLLISION_CheckSubtileMask113c(m, pRoom, dropX, dropY, 0x200)).toBe(0x200)
    const expireFrame = m.u32((pRareData + 0x24) >>> 0) >>> 0
    expect(expireFrame).toBeGreaterThan(0)
    const pAct0 = m.u32((pGame + 0xbc) >>> 0) >>> 0
    m.set(pGame, D2GameStrc.dwGameFrame, (expireFrame + 1) >>> 0)
    ITEMS_ExpireGroundItemsInAct113c(m, pGame, pAct0)
    expect(SUNIT_GetServerUnitFromHash113c(m, pGame, UNIT_ITEM, rareUnitId)).toBe(0)
    expect(COLLISION_CheckSubtileMask113c(m, pRoom, dropX, dropY, 0x200)).toBe(0)
  })
})

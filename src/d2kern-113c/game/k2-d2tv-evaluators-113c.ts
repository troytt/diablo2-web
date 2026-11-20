/**
 * Pure Diablo II v1.13c binary-exact kernel evaluators for Milestone 33 [K2]
 * D2TV vector suites: MONSPAWN, TCDROP, and ITEMGEN.
 *
 * Operates exclusively on Memory113c and canonical DATATBLS tables without
 * runtime I/O, host globals, or callgraph VA bindings.
 */

import { UNITS_GetMonStats2ComponentChoice113c } from '../common/drlg/out-jung.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../common/inline-helpers.ts'
import { imul32, mulDiv113c, sar32, sdiv32 } from '../common/int-math.ts'
import {
  checkIfThrowItemMem113c,
  ITEMMODS_ApplyPropertyById113c,
  ITEMS_ApplyEtherealBonusStats113c,
  ITEMS_CanItemLoseDurability113c,
  ITEMS_CheckAffixAssignableToItem113c,
  ITEMS_CheckItemTypeIdMem113c,
  ITEMS_CheckQualityItemMatch113c,
  ITEMS_EvalItemPropertyList113c,
  ITEMS_GetClassOfClassSpecificItem113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetComponentByte113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemFormat113c,
  ITEMS_GetItemLevel113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemSeed113c,
  ITEMS_GetMagicPrefix113c,
  ITEMS_GetMagicSuffix113c,
  ITEMS_GetMaxSockets113c,
  ITEMS_GetMaxSocketsFromItemType113c,
  ITEMS_GetMissileWeaponVelocity113c,
  ITEMS_GetOwnerGuid113c,
  ITEMS_GetRarePrefix113c,
  ITEMS_GetRareSuffix113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_IsRareQualityAllowed113c,
  ITEMS_IsTome113c,
  ITEMS_SetItemQuality113c,
  ITEMS_SetMagicPrefix113c,
  ITEMS_SetMagicSuffix113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetRarePrefix113c,
  ITEMS_SetRareSuffix113c,
} from '../common/items.ts'
import { MONSTERS_GetHirelingTypeId113c } from '../common/missile.ts'
import {
  SKILLS_AllocSkillList113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../common/skills.ts'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  ITEMS_SetItemCell113c,
  MONSTERS_ApplyClassicConversionStats113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  DATATBLS_GetBeltsTxtRecord113c,
  DATATBLS_GetBeltsTxtRecordCountPtr113c,
  DATATBLS_GetItemRatioTxtRecord113c,
  DATATBLS_GetLevelMonsterLevel113c,
  DATATBLS_GetMagicAffixTxtRecord113c,
  ITEMS_GetBaseLevel113c,
} from '../tables/datatbls-113c.ts'
import { DATATBLS_GetItemsTxtRecordMemPort113c } from '../common/k0-d2common-memports.ts'
import {
  DATATBLS_GetItemIdFromItemCode113c,
  DATATBLS_GetMagicAffixDataTables113c,
  DATATBLS_GetRareAffixDataTables113c,
} from '../tables/item-tbls-113c.ts'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c.ts'
import { DATATBLS_GetTreasureClassExRecordFromIdAndLevel113c } from '../tables/monster-tbls-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  D2GAME_PLAYER_EXP_BONUS_TABLE_VA_113C,
  D2GAME_PLAYER_HP_BONUS_TABLE_VA_113C,
  GAME_GetEffectivePlayerCount113c,
  initD2GameGlobalsInMem113c,
  MONPROP_GetRecordPtrFromClassId113c,
  MONSTATS2_CheckFlagBit113c,
  MONSTATS2_CheckModeBit113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_CheckFlagBit113c,
  MONSTATS_GetRecordPtr113c,
  MONSTER_ChooseMonsterClass113c,
  MONSTER_RollPackRarityType113c,
  REGPOP_UsesPartyBossGroup113c,
  SEED_RollLimitedFast113c,
} from './regpop-spawn-113c.ts'

export interface MonSpawnVectorInput113c {
  readonly initSeedLo: number
  readonly initSeedHi: number
  readonly levelId: number
  readonly difficulty: number
  readonly bExpansion: number
  readonly nPlayers: number
  readonly roomsVisited: number
  readonly totalRooms: number
  readonly spawnedBosses: number
  readonly bossMode: number
  readonly superPct: number
}

export interface MonSpawnVectorOutput113c {
  readonly poolCount: number
  readonly totalRarity: number
  readonly slot0ClassId: number
  readonly packRarityType: number
  readonly packCount: number
  readonly chosenClassId: number
  readonly monFlags: number
  readonly umods: readonly [number, number, number, number, number, number]
  readonly mlvl: number
  readonly maxHp: number
  readonly exp: number
  readonly ac: number
  readonly fireRes: number
  readonly lightRes: number
  readonly coldRes: number
  readonly hpRegen: number
  readonly outSeedLo: number
  readonly outSeedHi: number
}

function sx8(v: number): number {
  return (v << 24) >> 24
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function stepSeed64(m: Memory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed >>> 0, newLo)
  m.setU32((pSeed + 4) >>> 0, newHi)
  return newLo
}

function rollSeedLimited(m: Memory113c, pSeed: number, nMax: number): number {
  const maxS = nMax | 0
  if (maxS <= 0) return 0
  const newLo = stepSeed64(m, pSeed)
  const maxU = maxS >>> 0
  if ((maxU & ((maxU - 1) >>> 0)) === 0) {
    return (newLo & ((maxU - 1) >>> 0)) | 0
  }
  return ((newLo >>> 0) % maxU) | 0
}

export function bindK2KernelGlobals113c(m: Memory113c): void {
  const pSgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  initD2GameGlobalsInMem113c(m, pSgpt)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pMasks)
}

function checkMonsterMonTypeMask113c(m: Memory113c, pUnit: number, nExcludedType: number): number {
  if (pUnit === 0) return 0
  if ((m.u32(pUnit >>> 0) | 0) !== 1) return 0
  const nClassId = m.u32((pUnit + 4) >>> 0) | 0
  if (nClassId < 0) return 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nClassId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return 0
  const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + imul32(nClassId, 0x1a8)) >>> 0
  if (pMonStats === 0) return 0
  const monType = sx16(m.u16((pMonStats + 0x1c) >>> 0))
  const nMonTypeCount = m.u32((pTables + 0xc40) >>> 0) | 0
  if (monType < 0 || monType >= nMonTypeCount) return 0
  const excl = nExcludedType | 0
  if (excl < 0 || excl >= nMonTypeCount) return 0
  const wordsPerRow = m.u32((pTables + 0xc48) >>> 0) | 0
  const pNested = m.u32((pTables + 0xc44) >>> 0) >>> 0
  const wordIdx = (imul32(wordsPerRow, excl) + sar32(monType, 5)) | 0
  const rowWord = m.u32((pNested + wordIdx * 4) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
  const bitMask = m.u32((pMasks + (monType & 0x1f) * 4) >>> 0)
  return (rowWord & bitMask) >>> 0
}

function checkMonUModEligible113c(
  m: Memory113c,
  pUnit: number,
  pUModRec: number,
  dwExpansion: number,
): number {
  if (m.u8((pUModRec + 6) >>> 0) === 0) return 0
  if (dwExpansion === 0 && m.u16((pUModRec + 4) >>> 0) >= 100) return 0
  for (let i = 0; i < 2; i++) {
    const excl = sx16(m.u16((pUModRec + 0x0a + i * 2) >>> 0))
    if (excl > 0 && checkMonsterMonTypeMask113c(m, pUnit, excl) !== 0) {
      return 0
    }
  }
  const fPick = m.u8((pUModRec + 9) >>> 0)
  const nClassId = pUnit !== 0 ? m.u32((pUnit + 4) >>> 0) | 0 : -1
  if (fPick === 1) {
    return MONSTATS2_CheckModeBit113c(m, nClassId, 4) !== 0 ? 1 : 0
  }
  if (fPick === 2) {
    if (pUnit !== 0 && nClassId >= 0) {
      const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
      if (nClassId < (m.u32((pTables + 0xa80) >>> 0) | 0)) {
        const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + imul32(nClassId, 0x1a8)) >>> 0
        if (pMonStats !== 0) {
          const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
          if ((m.u8((pMonStats + 0x0c) >>> 0) & m.u32((pMasks + 4) >>> 0)) !== 0) {
            return 0
          }
        }
      }
    }
    return MONSTATS_CheckFlagBit113c(m, nClassId, 0x11) === 0 ? 1 : 0
  }
  if (fPick === 3) {
    return MONSTATS2_CheckModeBit113c(m, nClassId, 2) !== 0 ? 1 : 0
  }
  return 1
}

function appendMonsterUMod113c(m: Memory113c, pUnit: number, umodId: number): void {
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 1) return
  const pMonData = m.u32((pUnit + 0x14) >>> 0)
  if (pMonData === 0) return
  for (let i = 0; i < 9; i++) {
    if (m.u8((pMonData + 0x1c + i) >>> 0) === 0) {
      m.setU8((pMonData + 0x1c + i) >>> 0, umodId & 0xff)
      return
    }
  }
}

function rollChampionUMod113c(m: Memory113c, pGame: number, pUnit: number): number {
  if (pGame === 0) return 0
  const diff = m.u8((pGame + 0x6d) >>> 0)
  if (diff >= 3) return 0
  const dwExpansion = m.u32((pGame + 0x70) >>> 0)
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const nUModCount = m.u32((pTables + 0xc54) >>> 0) | 0
  if (nUModCount <= 0) return 0
  const pUModBase = m.u32((pTables + 0xc50) >>> 0) >>> 0
  if (pUModBase === 0) return 0

  const ids = new Int32Array(256)
  const weights = new Int32Array(256)
  let count = 0
  let totalWeight = 0
  const cpickOff = (diff * 2 + 0x0e) | 0

  for (let idx = 0; idx < nUModCount; idx++) {
    const pRec = (pUModBase + idx * 0x20) >>> 0
    const w = sx16(m.u16((pRec + cpickOff) >>> 0))
    if (w > 0 && m.u8((pRec + 8) >>> 0) !== 0) {
      if (checkMonUModEligible113c(m, pUnit, pRec, dwExpansion) !== 0) {
        ids[count] = idx
        weights[count] = w
        totalWeight = (totalWeight + w) | 0
        count++
        if (count >= 256) break
      }
    }
  }

  let rem = rollSeedLimited(m, (pUnit + 0x20) >>> 0, totalWeight)
  for (let i = 0; i < count; i++) {
    const w = weights[i]!
    if (rem < w) return ids[i]!
    rem = (rem - w) | 0
  }
  return 0
}

function rollUniqueUMod113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  used: Uint8Array,
): number {
  if (pGame === 0) return 0
  const diff = m.u8((pGame + 0x6d) >>> 0)
  if (diff >= 3) return 0
  const dwExpansion = m.u32((pGame + 0x70) >>> 0)
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const nUModCount = m.u32((pTables + 0xc54) >>> 0) | 0
  const pUModBase = nUModCount > 0 ? m.u32((pTables + 0xc50) >>> 0) >>> 0 : 0

  const ids = new Int32Array(256)
  const weights = new Int32Array(256)
  let count = 0
  let totalWeight = 0
  const upickOff = (diff * 2 + 0x14) | 0

  for (let idx = 0; idx < nUModCount; idx++) {
    const pRec = (pUModBase + idx * 0x20) >>> 0
    const w = sx16(m.u16((pRec + upickOff) >>> 0))
    if (w > 0 && m.u8((pRec + 8) >>> 0) === 0) {
      if (checkMonUModEligible113c(m, pUnit, pRec, dwExpansion) !== 0 && used[idx] === 0) {
        ids[count] = idx
        weights[count] = w
        totalWeight = (totalWeight + w) | 0
        count++
        if (count >= 256) break
      }
    }
  }

  let rem = totalWeight > 0 ? rollSeedLimited(m, (pUnit + 0x20) >>> 0, totalWeight) : 0
  for (let i = 0; i < count; i++) {
    const w = weights[i]!
    if (rem < w) return ids[i]!
    rem = (rem - w) | 0
  }
  return 0
}

function rollChampionOrUniqueMods113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  bAllowChampion: number,
): void {
  if (pGame === 0 || m.u8((pGame + 0x6d) >>> 0) >= 3) return
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 1) return
  const pMonData = m.u32((pUnit + 0x14) >>> 0)
  if (pMonData === 0) return

  let existing = 0
  while (existing < 9 && m.u8((pMonData + 0x1c + existing) >>> 0) !== 0) {
    existing++
  }
  if (existing >= 8) return

  const pUnitSeed = (pUnit + 0x20) >>> 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const nUModCount = m.u32((pTables + 0xc54) >>> 0) | 0
  const pUModBase = nUModCount > 0 ? m.u32((pTables + 0xc50) >>> 0) >>> 0 : 0

  if (bAllowChampion !== 0) {
    const champChance = pUModBase !== 0 ? m.u32((pUModBase + 0x1c) >>> 0) | 0 : 0
    const roll100 = rollSeedLimited(m, pUnitSeed, 100)
    if (roll100 < champChance) {
      m.setU8((pMonData + 0x16) >>> 0, (m.u8((pMonData + 0x16) >>> 0) | 4) & 0xff)
      const champMod = rollChampionUMod113c(m, pGame, pUnit)
      appendMonsterUMod113c(m, pUnit, champMod)
      return
    }
  }

  /* 0x6FC43D83: rollSeedLimited(pUnitSeed, 1) steps PRNG once and returns 0 */
  const zeroRoll = rollSeedLimited(m, pUnitSeed, 1)
  const diff = m.u8((pGame + 0x6d) >>> 0)
  let toAdd = (zeroRoll + 1 + diff) | 0
  if (toAdd + existing >= 9) {
    toAdd = (9 - existing) | 0
  }

  const used = new Uint8Array(Math.max(256, nUModCount + 1))
  for (let i = 0; i < existing; i++) {
    used[m.u8((pMonData + 0x1c + i) >>> 0)] = 1
  }
  let writeOff = (pMonData + 0x1c + existing) >>> 0
  while (toAdd > 0) {
    const mod = rollUniqueUMod113c(m, pGame, pUnit, used)
    if (mod === 0) break
    toAdd--
    m.setU8(writeOff, mod & 0xff)
    writeOff = (writeOff + 1) >>> 0
    used[mod] = 1
  }
}

function selectLevelMonsters113c(
  m: Memory113c,
  bIsNmOrHell: number,
  pSeed: number,
  pLevelsTxt: number,
  pMonReg: number,
): void {
  let maxSelect = m.u8((pLevelsTxt + 0x32) >>> 0)
  if (maxSelect > 13) maxSelect = 13
  let poolLen =
    bIsNmOrHell !== 0 ? m.u8((pLevelsTxt + 0x34) >>> 0) : m.u8((pLevelsTxt + 0x33) >>> 0)
  if (maxSelect > poolLen) maxSelect = poolLen

  const pool = new Int16Array(32)
  const srcOff = bIsNmOrHell !== 0 ? 0x68 : 0x36
  for (let i = 0; i < poolLen; i++) {
    pool[i] = sx16(m.u16((pLevelsTxt + srcOff + i * 2) >>> 0))
  }

  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const nMonStatsCount = m.u32((pTables + 0xa80) >>> 0) | 0
  const pMonStatsBase = m.u32((pTables + 0xa78) >>> 0) >>> 0
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
  const maskRangedSpawn = m.u8((pMasks + 0x10) >>> 0)
  const maskIsSpawn = m.u8(pMasks)

  let outPtr = (pMonReg + 0x14) >>> 0
  for (let slot = 0; slot < maxSelect; slot++) {
    if (poolLen <= 0) break
    let pickIdx = rollSeedLimited(m, pSeed, poolLen)
    let pickedId = pool[pickIdx]!

    if (slot === 0 && m.u8((pLevelsTxt + 0x31) >>> 0) !== 0) {
      let tries = 0
      while (tries < 20) {
        let isRanged = false
        if (pickedId >= 0 && pickedId < nMonStatsCount && pMonStatsBase !== 0) {
          const pRec = (pMonStatsBase + imul32(pickedId, 0x1a8)) >>> 0
          if ((m.u8((pRec + 0x0f) >>> 0) & maskRangedSpawn) !== 0) {
            isRanged = true
          }
        }
        if (isRanged) break
        pickIdx = rollSeedLimited(m, pSeed, poolLen)
        pickedId = pool[pickIdx]!
        tries++
      }
    }

    poolLen--
    for (let k = pickIdx; k < poolLen; k++) {
      pool[k] = pool[k + 1]!
    }

    if (pickedId >= 0 && pickedId < nMonStatsCount && pMonStatsBase !== 0) {
      const pRec = (pMonStatsBase + imul32(pickedId, 0x1a8)) >>> 0
      if ((m.u8((pRec + 0x0c) >>> 0) & maskIsSpawn) !== 0) {
        const rarity = m.u8((pRec + 0x2e) >>> 0)
        m.setU16(outPtr, pickedId & 0xffff)
        m.setU8((outPtr + 2) >>> 0, rarity)
        m.setU8((pMonReg + 0x11) >>> 0, (m.u8((pMonReg + 0x11) >>> 0) + rarity) & 0xff)
        m.setU8((pMonReg + 0x12) >>> 0, (m.u8((pMonReg + 0x12) >>> 0) + 1) & 0xff)
        m.setU8((pMonReg + 0x10) >>> 0, (m.u8((pMonReg + 0x10) >>> 0) + 1) & 0xff)
        outPtr = (outPtr + 0x34) >>> 0
      }
    }
  }
}

function initMonsterStatsExact113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nLevelId: number,
  pScratch: number,
): void {
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 1) return
  const nClassId = m.u32((pUnit + 4) >>> 0) | 0
  const pMonData = m.u32((pUnit + 0x14) >>> 0)
  if (pMonData === 0) return
  const pMonStats = m.u32(pMonData) >>> 0
  if (pMonStats === 0) return
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, nClassId)
  if (pMonStats2 === 0) return

  const pUnitSeed = (pUnit + 0x20) >>> 0

  /* 0x6FCCF730 with pOutfit == 0: roll 16 component choices on pUnit->seed */
  for (let comp = 0; comp < 16; comp++) {
    const cnt = UNITS_GetMonStats2ComponentChoice113c(m, pUnit, comp) | 0
    const choice = cnt > 0 ? rollSeedLimited(m, pUnitSeed, cnt) & 0xff : 0
    m.setU8((pMonData + 4 + comp) >>> 0, choice)
  }

  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const nMonStatsCount = m.u32((pTables + 0xa80) >>> 0) | 0
  const validClass = nClassId >= 0 && nClassId < nMonStatsCount ? nClassId : -1
  if (validClass === 0x137) {
    const r = rollSeedLimited(m, pUnitSeed, 4) & 0xff
    m.setU8((pMonData + 0x0e) >>> 0, r)
  } else if (validClass === 0x138) {
    const r = rollSeedLimited(m, pUnitSeed, 4) & 0xff
    m.setU8((pMonData + 0x0e) >>> 0, r)
    m.setU8((pMonData + 0x0f) >>> 0, r)
  }

  /* 0x6FCCF840: player-count HP/EXP bonus (only when bAlign == 0) + DifficultyLevels skill bonus */
  let nPlayers = 1
  let nHpBonus = 0
  let nExpBonus = 0
  if (m.u8((pMonStats + 0x4c) >>> 0) === 0) {
    nPlayers = GAME_GetEffectivePlayerCount113c(m, pGame)
    if (nPlayers < 1) nPlayers = 1
    nHpBonus =
      nPlayers < 9
        ? m.u32((D2GAME_PLAYER_HP_BONUS_TABLE_VA_113C + nPlayers * 4) >>> 0) | 0
        : imul32((nPlayers - 2) | 0, 50)
    nExpBonus =
      nPlayers < 9
        ? m.u32((D2GAME_PLAYER_EXP_BONUS_TABLE_VA_113C + nPlayers * 4) >>> 0) | 0
        : ((nPlayers * 5 + 0x82) << 1) | 0
  }

  const rawGameDiff = m.u8((pGame + 0x6d) >>> 0)
  const diffClamped = rawGameDiff > 2 ? 2 : rawGameDiff
  const pDiffBase = m.u32((pTables + 0xac8) >>> 0) >>> 0
  const skillBonus =
    pDiffBase !== 0 ? m.u32((pDiffBase + diffClamped * 0x58 + 0x10) >>> 0) | 0 : 0

  let nDiff = diffClamped | 0
  if (MONSTERS_GetHirelingTypeId113c(m, pUnit) !== 0) {
    nDiff = 0
  }

  const dwExpansion = m.u32((pGame + 0x70) >>> 0)
  let mlvl = sx16(m.u16((pMonStats + nDiff * 2 + 0xaa) >>> 0))
  if (dwExpansion !== 0 && nDiff > 0) {
    const bFlags0 = m.u8((pMonStats + 0x0c) >>> 0)
    const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
    if (
      (bFlags0 & m.u32((pMasks + 0x08) >>> 0)) === 0 &&
      (bFlags0 & m.u32((pMasks + 0x18) >>> 0)) === 0
    ) {
      mlvl = DATATBLS_GetLevelMonsterLevel113c(m, nLevelId, nDiff, dwExpansion) | 0
    }
  }

  STATLIST_CreateEx113c(m, pUnit, 0, pGame)
  STATLIST_SetUnitStat113c(m, pUnit, 0x0c, mlvl, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x64, nPlayers, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x24, sx16(m.u16((pMonStats + nDiff * 2 + 0x144) >>> 0)), 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x25, sx16(m.u16((pMonStats + nDiff * 2 + 0x14a) >>> 0)), 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x27, sx16(m.u16((pMonStats + nDiff * 2 + 0x150) >>> 0)), 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x29, sx16(m.u16((pMonStats + nDiff * 2 + 0x156) >>> 0)), 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x2b, sx16(m.u16((pMonStats + nDiff * 2 + 0x15c) >>> 0)), 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x2d, sx16(m.u16((pMonStats + nDiff * 2 + 0x162) >>> 0)), 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x14, m.u8((pMonStats + nDiff + 0xa3) >>> 0), 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x44, 0x64, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x43, 0x4b, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x45, 0x64, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x160, 0x80, 0)

  const bGameExp =
    m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0 ? 1 : 0
  m.fill(pScratch, 0x38, 0)
  DATATBLS_CalculateMonsterStatsByLevel113c(m, nClassId, bGameExp, nDiff, mlvl, 7, pScratch)

  const minHp = m.u32(pScratch) | 0
  const maxHp = m.u32((pScratch + 4) >>> 0) | 0
  const rolledHp = (minHp + SEED_RollLimitedFast113c(m, pUnitSeed, (maxHp - minHp + 1) | 0)) | 0
  let scaledHp = (rolledHp + mulDiv113c(nHpBonus, rolledHp, 100)) | 0
  if (scaledHp >= 0x800000) scaledHp = 0x7fffff
  const hp256 = (scaledHp << 8) | 0

  STATLIST_SetUnitStat113c(m, pUnit, 7, hp256, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 6, hp256, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 0x1f, m.u32((pScratch + 8) >>> 0) | 0, 0)

  const baseExp = m.u32((pScratch + 0x10) >>> 0) | 0
  const scaledExp = (baseExp + mulDiv113c(nExpBonus, baseExp, 100)) | 0
  STATLIST_SetUnitStat113c(m, pUnit, 0x0d, scaledExp, 0)

  const regenFactor = m.u32((pMonStats + 0x1a0) >>> 0) | 0
  let hpRegen = 0
  if (regenFactor !== 0) {
    const limit = sdiv32(0x7fffffff, regenFactor)
    if (hp256 > limit) {
      hpRegen = imul32(sar32(hp256, 12), regenFactor)
    } else {
      hpRegen = sar32(imul32(regenFactor, hp256), 12)
    }
  }
  STATLIST_SetUnitStat113c(m, pUnit, 0x4a, hpRegen, 0)

  let prevMaxHp = STATLIST_GetUnitStat113c(m, pUnit, 7, 0) | 0
  MONSTERS_ApplyClassicConversionStats113c(m, pUnit, dwExpansion, m.u8((pGame + 0x6d) >>> 0))
  {
    const curMaxHp = STATLIST_GetUnitStat113c(m, pUnit, 7, 0) | 0
    if (curMaxHp !== prevMaxHp && prevMaxHp > 0 && regenFactor !== 0) {
      const newRegen = sar32(imul32(sar32(curMaxHp, 8), regenFactor), 4)
      STATLIST_SetUnitStat113c(m, pUnit, 0x4a, newRegen, 0)
    }
    prevMaxHp = curMaxHp
  }

  const pSubList = STATLIST_AllocList113c(
    m,
    m.u32((pGame + 0x1c) >>> 0),
    1,
    0,
    1,
    m.u32((pUnit + 0x0c) >>> 0),
  )
  if (pSubList !== 0) {
    STATLIST_MergeStatLists113c(m, pUnit, pSubList, 1)
  }

  SKILLS_AllocSkillList113c(m, pUnit)
  for (let i = 0; i < 8; i++) {
    const skillId = sx16(m.u16((pMonStats + 0x170 + i * 2) >>> 0))
    const baseSlvl = sx8(m.u8((pMonStats + 0x198 + i) >>> 0))
    if (skillId >= 0 && baseSlvl > 0) {
      const slvl = (baseSlvl + skillBonus) | 0
      SKILLS_SetSkillLevelOnUnit113c(m, pUnit, skillId, slvl, 1, 0, 0)
      SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, skillId)
    }
  }

  if (MONSTATS2_CheckFlagBit113c(m, nClassId, 9) !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 4) >>> 0)
  }

  const pMonProp = MONPROP_GetRecordPtrFromClassId113c(m, nClassId)
  if (pMonProp !== 0) {
    const propBaseOff = nDiff * 0x60
    for (let s = 0; s < 6; s++) {
      const pEntry = (pMonProp + propBaseOff + s * 0x10 + 4) >>> 0
      if ((m.u32(pEntry) | 0) < 0) break
      const chance = m.u8((pMonProp + nDiff * 6 + s + 0x124) >>> 0)
      if (chance === 0 || (stepSeed64(m, pUnitSeed) >>> 0) % 100 < chance) {
        ITEMMODS_ApplyPropertyById113c(m, 0, 0, pUnit, 0, 0, 0, pEntry, 0, 0x40, 0)
        const curMaxHp = STATLIST_GetUnitStat113c(m, pUnit, 7, 0) | 0
        if (curMaxHp !== prevMaxHp && prevMaxHp > 0 && regenFactor !== 0) {
          const newRegen = sar32(imul32(sar32(curMaxHp, 8), regenFactor), 4)
          STATLIST_SetUnitStat113c(m, pUnit, 0x4a, newRegen, 0)
        }
        prevMaxHp = curMaxHp
      }
    }
  }
}

export function evaluateMonSpawnVector113c(
  m: Memory113c,
  input: MonSpawnVectorInput113c,
): MonSpawnVectorOutput113c {
  const scratchBase = m.alloc(0x2500) >>> 0
  m.fill(scratchBase, 0x2500, 0)

  const pGame = scratchBase
  const pMonReg = (scratchBase + 0x1e00) >>> 0
  const pRoom = (scratchBase + 0x2100) >>> 0
  const pRoomEx = (scratchBase + 0x2180) >>> 0
  const pDrlgLevel = (scratchBase + 0x2200) >>> 0
  const pUnit = (scratchBase + 0x2400) >>> 0
  const pMonData = (scratchBase + 0x2490) >>> 0
  const pOutMonStatsPtr = (scratchBase + 0x24f0) >>> 0
  const pSeedTmp = (scratchBase + 0x24f8) >>> 0

  const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, input.levelId) >>> 0

  m.setU8((pGame + 0x6a) >>> 0, input.bExpansion & 0xff)
  m.setU8((pGame + 0x6d) >>> 0, input.difficulty & 0xff)
  m.setU32((pGame + 0x70) >>> 0, input.bExpansion !== 0 ? 1 : 0)
  m.setU32((pGame + 0x1d20) >>> 0, input.nPlayers >>> 0)

  m.setU8(pMonReg, m.u8((pLevelsTxt + 3) >>> 0))
  m.setU32((pMonReg + 0x04) >>> 0, input.roomsVisited >>> 0)
  m.setU32((pMonReg + 0x0c) >>> 0, input.totalRooms >>> 0)
  m.setU32((pMonReg + 0x2b8) >>> 0, m.u32((pLevelsTxt + 0x1c + input.difficulty * 4) >>> 0))
  m.setU8((pMonReg + 0x2bc) >>> 0, m.u8((pLevelsTxt + 0x28 + input.difficulty) >>> 0))
  m.setU8((pMonReg + 0x2bd) >>> 0, m.u8((pLevelsTxt + 0x2b + input.difficulty) >>> 0))
  m.setU8((pMonReg + 0x2c8) >>> 0, input.spawnedBosses & 0xff)
  m.setU32((pMonReg + 0x2c0) >>> 0, input.levelId >>> 0)

  m.setU32((pDrlgLevel + 0x1d0) >>> 0, input.levelId >>> 0)
  m.setU32((pRoomEx + 0x58) >>> 0, pDrlgLevel)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)

  m.setU32(pSeedTmp, input.initSeedLo >>> 0)
  m.setU32((pSeedTmp + 4) >>> 0, input.initSeedHi >>> 0)

  /* 1. SelectLevelMonsters (0x6FCEA760) */
  selectLevelMonsters113c(
    m,
    input.difficulty !== 0 ? 1 : 0,
    pSeedTmp,
    pLevelsTxt,
    pMonReg,
  )
  const poolCount = m.u8((pMonReg + 0x10) >>> 0)
  const totalRarity = m.u8((pMonReg + 0x11) >>> 0)
  const slot0ClassId = poolCount > 0 ? sx16(m.u16((pMonReg + 0x14) >>> 0)) : -1

  /* 2. RollPackRarityType (0x6FCFF080) */
  m.setU32((pRoom + 0x6c) >>> 0, m.u32(pSeedTmp))
  m.setU32((pRoom + 0x70) >>> 0, m.u32((pSeedTmp + 4) >>> 0))
  const packRarityType = MONSTER_RollPackRarityType113c(m, pMonReg, pRoom) & 0xff
  m.setU32(pSeedTmp, m.u32((pRoom + 0x6c) >>> 0))
  m.setU32((pSeedTmp + 4) >>> 0, m.u32((pRoom + 0x70) >>> 0))

  /* 3. ChooseMonsterClass (0x6FCFF4A0) */
  const bElite = input.bossMode !== 0 || packRarityType === 0 ? 1 : 0
  const chosenClassId = sx16(
    MONSTER_ChooseMonsterClass113c(
      m,
      bElite,
      pRoom,
      pMonReg,
      pGame,
      pOutMonStatsPtr,
      input.superPct,
    ) & 0xffff,
  )
  m.setU32(pSeedTmp, m.u32((pRoom + 0x6c) >>> 0))
  m.setU32((pSeedTmp + 4) >>> 0, m.u32((pRoom + 0x70) >>> 0))

  const pMonStats = m.u32(pOutMonStatsPtr) >>> 0
  if (pMonStats === 0 || chosenClassId < 0) {
    return {
      poolCount,
      totalRarity,
      slot0ClassId,
      packRarityType,
      packCount: 0,
      chosenClassId,
      monFlags: 0,
      umods: [0, 0, 0, 0, 0, 0],
      mlvl: 0,
      maxHp: 0,
      exp: 0,
      ac: 0,
      fireRes: 0,
      lightRes: 0,
      coldRes: 0,
      hpRegen: 0,
      outSeedLo: m.u32(pSeedTmp) >>> 0,
      outSeedHi: m.u32((pSeedTmp + 4) >>> 0) >>> 0,
    }
  }

  /* 4. Pack member count (0x6FC67BAD..0x6FC67C2D + 0x6FC67700) */
  let packCount = 1
  if (bElite === 0) {
    let minGrp = 1
    let maxGrp = 1
    if (REGPOP_UsesPartyBossGroup113c(m, chosenClassId) === 0) {
      minGrp = m.u8((pMonStats + 0x2f) >>> 0)
      maxGrp = m.u8((pMonStats + 0x30) >>> 0)
    }
    const sparse = m.u8((pMonStats + 0x31) >>> 0)
    let skipPack = false
    if (sparse !== 0) {
      const rem100 = (stepSeed64(m, pSeedTmp) >>> 0) % 100
      if (rem100 > sparse) {
        skipPack = true
      }
    }
    if (skipPack || minGrp === 0 || maxGrp === 0 || maxGrp < minGrp) {
      packCount = 0
    } else {
      const extra = SEED_RollLimitedFast113c(m, pSeedTmp, (maxGrp - minGrp + 1) | 0)
      packCount = (minGrp + extra) & 0xff
    }
  }

  /* 5. Champion/Unique umods (0x6FC43CA0) + InitStats (0x6FCCFDB0) */
  m.setU32(pUnit, 1)
  m.setU32((pUnit + 4) >>> 0, chosenClassId >>> 0)
  m.setU32((pUnit + 0x0c) >>> 0, 1)
  m.setU32((pUnit + 0x14) >>> 0, pMonData)
  m.setU32((pUnit + 0x20) >>> 0, m.u32(pSeedTmp))
  m.setU32((pUnit + 0x24) >>> 0, m.u32((pSeedTmp + 4) >>> 0))
  m.setU32((pUnit + 0x80) >>> 0, pGame)
  m.setU32(pMonData, pMonStats)

  if (bElite !== 0) {
    const bAllowChampion = input.bossMode === 2 ? 0 : 1
    m.setU8((pMonData + 0x16) >>> 0, 0x08)
    rollChampionOrUniqueMods113c(m, pGame, pUnit, bAllowChampion)
    if ((m.u8((pMonData + 0x16) >>> 0) & 0x04) !== 0) {
      m.setU8((pMonData + 0x16) >>> 0, m.u8((pMonData + 0x16) >>> 0) & ~0x08)
    }
  }

  const monFlags = m.u8((pMonData + 0x16) >>> 0)
  const umods: [number, number, number, number, number, number] = [
    m.u8((pMonData + 0x1c) >>> 0),
    m.u8((pMonData + 0x1d) >>> 0),
    m.u8((pMonData + 0x1e) >>> 0),
    m.u8((pMonData + 0x1f) >>> 0),
    m.u8((pMonData + 0x20) >>> 0),
    m.u8((pMonData + 0x21) >>> 0),
  ]

  const pCalcScratch = m.alloc(0x40) >>> 0
  initMonsterStatsExact113c(m, pUnit, pGame, input.levelId, pCalcScratch)

  return {
    poolCount,
    totalRarity,
    slot0ClassId,
    packRarityType,
    packCount,
    chosenClassId,
    monFlags,
    umods,
    mlvl: (STATLIST_GetUnitStat113c(m, pUnit, 12, 0) >>> 0) & 0xffff,
    maxHp: STATLIST_GetUnitStat113c(m, pUnit, 7, 0) | 0,
    exp: STATLIST_GetUnitStat113c(m, pUnit, 13, 0) | 0,
    ac: sx16(STATLIST_GetUnitStat113c(m, pUnit, 31, 0) & 0xffff),
    fireRes: sx16(STATLIST_GetUnitStat113c(m, pUnit, 39, 0) & 0xffff),
    lightRes: sx16(STATLIST_GetUnitStat113c(m, pUnit, 41, 0) & 0xffff),
    coldRes: sx16(STATLIST_GetUnitStat113c(m, pUnit, 43, 0) & 0xffff),
    hpRegen: STATLIST_GetUnitStat113c(m, pUnit, 74, 0) | 0,
    outSeedLo: m.u32((pUnit + 0x20) >>> 0) >>> 0,
    outSeedHi: m.u32((pUnit + 0x24) >>> 0) >>> 0,
  }
}

export interface TcDropVectorInput113c {
  readonly initSeedLo: number
  readonly initSeedHi: number
  readonly tcId: number
  readonly monsterLevel: number
  readonly difficulty: number
  readonly mfBonus: number
  readonly bExpansion: number
  readonly nPartyFactor: number
  readonly bSkipNoDrop: number
  readonly maxDrops: number
}

export interface TcDropVectorOutput113c {
  readonly resolvedGroup: number
  readonly resolvedLevel: number
  readonly initPicks: number
  readonly rootEffectiveNoDrop: number
  readonly droppedCount: number
  readonly dropClassIds: readonly [number, number, number, number, number, number]
  readonly dropQualities: readonly [number, number, number, number, number, number]
  readonly dropFlags: readonly [number, number, number, number, number, number]
  readonly firstUniqueSetIdx: number
  readonly outSeedLo: number
  readonly outSeedHi: number
}

function readS32(m: Memory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

/**
 * D2Game:0x6FC2E130 — diminishing MF scaling:
 *   if (totalMf <= 110) return totalMf
 *   return 100 + sdiv32((totalMf - 100) * capFactor, totalMf + capFactor - 100)
 */
function computeDiminishingMf_6FC2E130(totalMf: number, capFactor: number): number {
  const mf = totalMf | 0
  if (mf <= 110) {
    return mf
  }
  const num = imul32((mf - 100) | 0, capFactor | 0)
  const den = (mf + capFactor - 100) | 0
  if (den === 0) {
    return mf
  }
  return (100 + sdiv32(num, den)) | 0
}

/**
 * D2Game:0x6FC32534..0x6FC325E9 — effective NoDrop scaling for party factor > 1.
 */
function computeEffectiveNoDrop113c(
  noDrop: number,
  prob: number,
  nPartyFactor: number,
): number {
  const nd = noDrop | 0
  const pr = prob | 0
  const pf = nPartyFactor | 0
  if (nd <= 0 || pr <= 0) {
    return 0
  }
  if (pf <= 1) {
    return nd
  }
  const baseRatio = nd / (nd + pr)
  let ratioPow = baseRatio
  for (let i = 1; i < pf; i++) {
    ratioPow *= baseRatio
  }
  const denom = 1.0 - ratioPow
  if (denom < 0.0001) {
    return 0
  }
  return Math.trunc((ratioPow / denom) * pr) | 0
}

function getItemTypeFromItemId113c(m: Memory113c, nItemId: number): number {
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pItemsTxt === 0) {
    return -1
  }
  return sx16(m.u16((pItemsTxt + 0x11e) >>> 0))
}

function checkItemTypeClassOnly113c(m: Memory113c, itemType: number): number {
  const t = itemType | 0
  if (t < 0) {
    return 0
  }
  const pSgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  if (pSgpt === 0) {
    return 0
  }
  const count = readS32(m, (pSgpt + 0xbfc) >>> 0)
  if (t >= count) {
    return 0
  }
  const pItemTypesTxt = (m.u32((pSgpt + 0xbf8) >>> 0) + imul32(t, 0xe4)) >>> 0
  if (pItemTypesTxt === 0) {
    return 0
  }
  return m.u8((pItemTypesTxt + 0x10) >>> 0)
}

/**
 * D2Game:0x6FC2FC40 — ITEMS_RollItemQualityForDrop
 */
function rollItemQualityForDrop_6FC2FC40_113c(
  m: Memory113c,
  nItemId: number,
  nItemLevel: number,
  difficulty: number,
  mfBonus: number,
  pSeed: number,
  factors: readonly [number, number, number, number, number, number],
): number {
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pItemsTxt === 0) {
    return 0
  }
  const itemType = getItemTypeFromItemId113c(m, nItemId) | 0
  if (itemType < 0) {
    return 0
  }
  const pSgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  if (pSgpt === 0) {
    return 0
  }
  const itemTypesCount = readS32(m, (pSgpt + 0xbfc) >>> 0)
  if (itemType >= itemTypesCount) {
    return 0
  }
  const pItemTypesBase = m.u32((pSgpt + 0xbf8) >>> 0) >>> 0
  const pItemTypesTxt = (pItemTypesBase + imul32(itemType, 0xe4)) >>> 0
  if (pItemTypesTxt === 0) {
    return 0
  }

  /* +0x16 = bNormal -> ITEMQUAL_NORMAL (2) */
  if (m.u8((pItemTypesTxt + 0x16) >>> 0) !== 0) {
    return 2
  }
  /* pItemsTxt + 0x129 = bUnique -> ITEMQUAL_UNIQUE (7) */
  if (m.u8((pItemsTxt + 0x129) >>> 0) !== 0) {
    return 7
  }
  /* pItemTypesTxt + 0x14 (bMagic) && pItemsTxt + 0x12A (bQuest) -> ITEMQUAL_UNIQUE (7) */
  if (
    m.u8((pItemTypesTxt + 0x14) >>> 0) !== 0 &&
    m.u8((pItemsTxt + 0x12a) >>> 0) !== 0
  ) {
    return 7
  }

  const pRatio = DATATBLS_GetItemRatioTxtRecord113c(m, nItemId, difficulty & 0xff, 100) >>> 0
  if (pRatio === 0) {
    return 2
  }

  const baseQlvl = m.u8((pItemsTxt + 0xfd) >>> 0)
  const lvlDiff = (nItemLevel - baseQlvl) | 0
  const mf = mfBonus | 0

  if (mf === 0 || mf > -100) {
    const hasPositiveMf = mf !== 0 ? 1 : 0
    const totalMf = (mf + 100) | 0

    /* 1. Unique (ITEMQUAL_UNIQUE = 7) */
    {
      let chance =
        ((readS32(m, (pRatio + 0x00) >>> 0) -
          sdiv32(lvlDiff, readS32(m, (pRatio + 0x04) >>> 0))) <<
          7) |
        0
      if (hasPositiveMf !== 0) {
        const effMf = computeDiminishingMf_6FC2E130(totalMf, 250)
        if (effMf !== 0) {
          chance = sdiv32(imul32(chance, 100), effMf)
        }
      }
      const minChance = readS32(m, (pRatio + 0x08) >>> 0)
      if (chance <= minChance) {
        chance = minChance
      }
      chance = (chance - sdiv32(imul32(factors[3], chance), 1024)) | 0
      if (chance <= 0 || (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80) {
        return 7
      }
    }

    /* 2. Set (ITEMQUAL_SET = 5) */
    {
      let chance =
        ((readS32(m, (pRatio + 0x18) >>> 0) -
          sdiv32(lvlDiff, readS32(m, (pRatio + 0x1c) >>> 0))) <<
          7) |
        0
      if (hasPositiveMf !== 0) {
        const effMf = computeDiminishingMf_6FC2E130(totalMf, 500)
        if (effMf !== 0) {
          chance = sdiv32(imul32(chance, 100), effMf)
        }
      }
      const minChance = readS32(m, (pRatio + 0x20) >>> 0)
      if (chance <= minChance) {
        chance = minChance
      }
      chance = (chance - sdiv32(imul32(factors[2], chance), 1024)) | 0
      if (chance <= 0 || (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80) {
        return 5
      }
    }

    /* 3. Rare (ITEMQUAL_RARE = 6) if ItemTypes.bRare (+0x15) != 0 */
    if (m.u8((pItemTypesTxt + 0x15) >>> 0) !== 0) {
      let chance =
        ((readS32(m, (pRatio + 0x0c) >>> 0) -
          sdiv32(lvlDiff, readS32(m, (pRatio + 0x10) >>> 0))) <<
          7) |
        0
      if (hasPositiveMf !== 0) {
        const effMf = computeDiminishingMf_6FC2E130(totalMf, 600)
        if (effMf !== 0) {
          chance = sdiv32(imul32(chance, 100), effMf)
        }
      }
      const minChance = readS32(m, (pRatio + 0x14) >>> 0)
      if (chance <= minChance) {
        chance = minChance
      }
      chance = (chance - sdiv32(imul32(factors[1], chance), 1024)) | 0
      if (chance <= 0 || (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80) {
        return 6
      }
    }

    /* 4. Magic (ITEMQUAL_MAGIC = 4) */
    if (m.u8((pItemTypesTxt + 0x14) >>> 0) !== 0) {
      return 4
    }
    {
      let chance =
        ((readS32(m, (pRatio + 0x24) >>> 0) -
          sdiv32(lvlDiff, readS32(m, (pRatio + 0x28) >>> 0))) <<
          7) |
        0
      if (hasPositiveMf !== 0) {
        chance = sdiv32(imul32(chance, 100), totalMf)
      }
      const minChance = readS32(m, (pRatio + 0x2c) >>> 0)
      if (chance <= minChance) {
        chance = minChance
      }
      chance = (chance - sdiv32(imul32(factors[0], chance), 1024)) | 0
      if (chance <= 0 || (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80) {
        return 4
      }
    }
  }

  /* 5. Superior (ITEMQUAL_SUPERIOR = 3) */
  {
    const chance =
      ((readS32(m, (pRatio + 0x30) >>> 0) -
        sdiv32(lvlDiff, readS32(m, (pRatio + 0x34) >>> 0))) <<
        7) |
      0
    if (chance <= 0 || (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80) {
      return 3
    }
  }

  /* 6. Normal (2) vs Low Quality (1) */
  {
    const chance =
      ((readS32(m, (pRatio + 0x38) >>> 0) -
        sdiv32(lvlDiff, readS32(m, (pRatio + 0x3c) >>> 0))) <<
        7) |
      0
    if (chance <= 0) {
      return 2
    }
    return (SEED_RollLimitedFast113c(m, pSeed, chance) >>> 0) < 0x80 ? 2 : 1
  }
}

interface TcStackSlot113c {
  pTc: number
  picksRemaining: number
  factors: [number, number, number, number, number, number]
}

/**
 * Pure v1.13c evaluator for TCDROP D2TV records (D2Game:0x6FC32380 + 0x6FC2FC40).
 */
export function evaluateTcdropVector113c(
  m: Memory113c,
  input: TcDropVectorInput113c,
): TcDropVectorOutput113c {
  const pRootTc = DATATBLS_GetTreasureClassExRecordFromIdAndLevel113c(
    m,
    input.tcId & 0xffff,
    0,
  ) >>> 0
  if (pRootTc === 0) {
    return {
      resolvedGroup: 0,
      resolvedLevel: 0,
      initPicks: 0,
      rootEffectiveNoDrop: 0,
      droppedCount: 0,
      dropClassIds: [-1, -1, -1, -1, -1, -1],
      dropQualities: [0, 0, 0, 0, 0, 0],
      dropFlags: [0, 0, 0, 0, 0, 0],
      firstUniqueSetIdx: 0,
      outSeedLo: input.initSeedLo >>> 0,
      outSeedHi: input.initSeedHi >>> 0,
    }
  }

  const resolvedGroup = m.u16((pRootTc + 0x00) >>> 0)
  const resolvedLevel = m.u16((pRootTc + 0x02) >>> 0)
  const rootPicksS32 = readS32(m, (pRootTc + 0x10) >>> 0)
  const initPicks = sx16(rootPicksS32 & 0xffff)
  const bExp = input.bExpansion !== 0 ? 1 : 0
  const bSkipNoDrop = input.bSkipNoDrop !== 0 ? 1 : 0
  const nPartyFactor = input.nPartyFactor | 0
  const maxDrops = input.maxDrops > 0 ? input.maxDrops | 0 : 6

  const rootProb = bExp !== 0 ? readS32(m, (pRootTc + 0x0c) >>> 0) : readS32(m, (pRootTc + 0x08) >>> 0)
  const rootNoDropRaw = readS32(m, (pRootTc + 0x14) >>> 0)
  const rootEffectiveNoDrop =
    bSkipNoDrop === 0 && rootPicksS32 >= 0
      ? computeEffectiveNoDrop113c(rootNoDropRaw, rootProb, nPartyFactor)
      : 0

  const pSeed = m.alloc(8) >>> 0
  m.setU32(pSeed, input.initSeedLo >>> 0)
  m.setU32((pSeed + 4) >>> 0, input.initSeedHi >>> 0)

  const stack: TcStackSlot113c[] = []
  for (let i = 0; i < 64; i++) {
    stack.push({
      pTc: 0,
      picksRemaining: 0,
      factors: [0, 0, 0, 0, 0, 0],
    })
  }

  const absRootPicks = rootPicksS32 < 0 ? -rootPicksS32 : rootPicksS32
  stack[0]!.pTc = pRootTc
  stack[0]!.picksRemaining = absRootPicks > 1 ? absRootPicks : 1
  for (let k = 0; k < 6; k++) {
    stack[0]!.factors[k] = m.u16((pRootTc + 0x1a + k * 2) >>> 0)
  }

  let sp = 0
  let classRetryCount = 0
  let droppedCount = 0
  const dropClassIds: [number, number, number, number, number, number] = [-1, -1, -1, -1, -1, -1]
  const dropQualities: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0]
  const dropFlags: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0]
  let firstUniqueSetIdx = 0

  outer: while (true) {
    const slot = stack[sp]!
    const pTc = slot.pTc >>> 0
    if (pTc === 0) {
      if (sp === 0) break
      sp--
      continue
    }
    const prob = bExp !== 0 ? readS32(m, (pTc + 0x0c) >>> 0) : readS32(m, (pTc + 0x08) >>> 0)
    if (prob === 0 || slot.picksRemaining === 0) {
      if (sp === 0) break
      sp--
      continue
    }

    while (stack[sp]!.picksRemaining !== 0) {
      const curSlot = stack[sp]!
      const curTc = curSlot.pTc >>> 0
      const curProb =
        bExp !== 0 ? readS32(m, (curTc + 0x0c) >>> 0) : readS32(m, (curTc + 0x08) >>> 0)
      if (curProb === 0) {
        break
      }
      const nPicks = readS32(m, (curTc + 0x10) >>> 0)
      let roll = 0

      if (nPicks >= 0) {
        const rawNoDrop = readS32(m, (curTc + 0x14) >>> 0)
        const effNoDrop = computeEffectiveNoDrop113c(rawNoDrop, curProb, nPartyFactor)
        const rollRange = bSkipNoDrop !== 0 ? curProb : (curProb + effNoDrop) | 0
        roll = rollSeedLimited(m, pSeed, rollRange)
        if (bSkipNoDrop === 0) {
          if (roll < effNoDrop) {
            curSlot.picksRemaining = (curSlot.picksRemaining - 1) | 0
            continue
          }
          roll = (roll - effNoDrop) | 0
        }
      } else {
        roll = (-nPicks - curSlot.picksRemaining) | 0
        if (roll >= curProb) {
          break
        }
      }

      const picksAfter = (curSlot.picksRemaining - 1) | 0
      curSlot.picksRemaining = picksAfter

      const nItemNums = readS32(m, (curTc + 0x04) >>> 0)
      const pNodes = m.u32((curTc + 0x28) >>> 0) >>> 0
      let nodeIdx = 0

      if (bExp !== 0) {
        let lo = 0
        let hi = nItemNums
        let foundExact = false
        if (hi > 0) {
          while (lo < hi) {
            const mid = (lo + ((hi - lo) >> 1)) | 0
            const pref = readS32(m, (pNodes + imul32(mid, 0x1c) + 0x04) >>> 0)
            if (roll > pref) {
              lo = (mid + 1) | 0
            } else if (roll < pref) {
              hi = mid
            } else {
              nodeIdx = mid
              foundExact = true
              break
            }
          }
          if (!foundExact) {
            const c = (lo - 1) | 0
            nodeIdx = c < 0 ? 0 : c
          }
        } else {
          nodeIdx = 0
        }
      } else {
        nodeIdx = 0
        if (nItemNums > 0) {
          while (nodeIdx < nItemNums) {
            const pNodeCur = (pNodes + imul32(nodeIdx, 0x1c)) >>> 0
            const bFlags = m.u8((pNodeCur + 0x0c) >>> 0)
            if ((bFlags & 0x10) === 0) {
              if (nodeIdx >= nItemNums - 1) {
                break
              }
              const nextClassicPref = readS32(m, (pNodeCur + 0x1c) >>> 0)
              if (nextClassicPref > roll) {
                break
              }
            }
            nodeIdx = (nodeIdx + 1) | 0
          }
        }
      }

      if (nodeIdx >= nItemNums) {
        continue
      }

      const pNode = (pNodes + imul32(nodeIdx, 0x1c)) >>> 0
      const nodeFlags = m.u8((pNode + 0x0c) >>> 0)

      /* Sub-TC branch (bFlags & 0x04) */
      if ((nodeFlags & 0x04) !== 0) {
        const childTcId = m.u16((pNode + 0x08) >>> 0)
        const pChildTc = DATATBLS_GetTreasureClassExRecordFromIdAndLevel113c(
          m,
          childTcId,
          0,
        ) >>> 0
        const oldSp = sp
        if (picksAfter > 0) {
          sp = (sp + 1) | 0
          if (sp >= 64) {
            break outer
          }
        }
        const newSlot = stack[sp]!
        newSlot.pTc = pChildTc
        if (pChildTc !== 0) {
          const childPicks = readS32(m, (pChildTc + 0x10) >>> 0)
          const absChild = childPicks < 0 ? -childPicks : childPicks
          newSlot.picksRemaining = absChild > 1 ? absChild : 1
          const oldFactors = stack[oldSp]!.factors
          const nextFactors: [number, number, number, number, number, number] = [
            oldFactors[0],
            oldFactors[1],
            oldFactors[2],
            oldFactors[3],
            oldFactors[4],
            oldFactors[5],
          ]
          for (let k = 0; k < 6; k++) {
            const cf = m.u16((pChildTc + 0x1a + k * 2) >>> 0)
            if (nextFactors[k]! === 0 || cf > nextFactors[k]!) {
              nextFactors[k] = cf
            }
          }
          newSlot.factors = nextFactors
        } else {
          newSlot.picksRemaining = 0
        }
        continue
      }

      /* Leaf item branch */
      let wItemId = m.u16((pNode + 0x08) >>> 0)
      if (wItemId === 0xffff) {
        continue
      }

      if (bExp === 0) {
        const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, wItemId) >>> 0
        if (pItemsTxt === 0 || m.u16((pItemsTxt + 0xf6) >>> 0) >= 100) {
          continue
        }
        for (let k = 0; k < 6; k++) {
          const nf = m.u16((pNode + 0x0e + k * 2) >>> 0)
          if ( nf > curSlot.factors[k]!) {
            curSlot.factors[k] = nf
          }
        }
      }

      let uniqueSetIdx = 0
      let quality = 0
      if ((nodeFlags & 0x01) !== 0) {
        uniqueSetIdx = (m.u16((pNode + 0x0a) >>> 0) + 1) & 0xffff
        quality = 7
      } else if ((nodeFlags & 0x02) !== 0) {
        uniqueSetIdx = (m.u16((pNode + 0x0a) >>> 0) + 1) & 0xffff
        quality = 5
      } else {
        quality = rollItemQualityForDrop_6FC2FC40_113c(
          m,
          wItemId,
          input.monsterLevel,
          input.difficulty,
          input.mfBonus,
          pSeed,
          curSlot.factors,
        )
      }

      let flags = 0
      if (curSlot.factors[4] > 0) {
        const lo = stepSeed64(m, pSeed)
        if ((lo & 0x3ff) < curSlot.factors[4]) {
          flags = 0x04
        }
      }
      if (curSlot.factors[5] > 0) {
        const lo = stepSeed64(m, pSeed)
        if ((lo & 0x3ff) < curSlot.factors[5]) {
          flags |= 0x10
        }
      }

      if (bExp === 0) {
        const itemType = getItemTypeFromItemId113c(m, wItemId)
        if (checkItemTypeClassOnly113c(m, itemType) !== 0) {
          const prevRetries = classRetryCount
          classRetryCount = (classRetryCount + 1) | 0
          if (prevRetries < 10) {
            curSlot.picksRemaining = (curSlot.picksRemaining + 1) | 0
            continue
          }
          wItemId = DATATBLS_GetItemIdFromItemCode113c(m, 0x2064736c) & 0xffff
        }
      }

      if (droppedCount < 6) {
        dropClassIds[droppedCount] = sx16(wItemId & 0xffff)
        dropQualities[droppedCount] = quality & 0xff
        dropFlags[droppedCount] = flags & 0xff
      }
      if (firstUniqueSetIdx === 0 && uniqueSetIdx > 0) {
        firstUniqueSetIdx = uniqueSetIdx & 0xffff
      }
      droppedCount = (droppedCount + 1) | 0
      if (droppedCount >= maxDrops) {
        break outer
      }
    }

    if (sp === 0) {
      break
    }
    sp = (sp - 1) | 0
  }

  return {
    resolvedGroup,
    resolvedLevel,
    initPicks,
    rootEffectiveNoDrop,
    droppedCount,
    dropClassIds,
    dropQualities,
    dropFlags,
    firstUniqueSetIdx,
    outSeedLo: m.u32(pSeed) >>> 0,
    outSeedHi: m.u32((pSeed + 4) >>> 0) >>> 0,
  }
}

export const evaluateTcDropVector113c = evaluateTcdropVector113c

export interface ItemGenVectorInput113c {
  readonly initSeedLo: number
  readonly initSeedHi: number
  readonly itemId: number
  readonly ilvl: number
  readonly quality: number
  readonly difficulty: number
  readonly dropFlags: number
  readonly itemFormat: number
}

export interface ItemGenVectorOutput113c {
  readonly itemFlags: number
  readonly fileIndex: number
  readonly magicPrefix: readonly [number, number, number]
  readonly magicSuffix: readonly [number, number, number]
  readonly rarePrefix: number
  readonly rareSuffix: number
  readonly defense: number
  readonly durability: number
  readonly maxDurability: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly secMinDamage: number
  readonly secMaxDamage: number
  readonly finalQuality: number
  readonly sockets: number
  readonly outSeedLo: number
  readonly outSeedHi: number
}

/**
 * D2Game:0x6FC2E860 — sets base weapon damage stats (21, 22, 23, 24, 159, 160) from Items.txt.
 */
function setBaseWeaponDamageStats_6FC2E860_113c(m: Memory113c, pItem: number): void {
  const itemId = m.u32((pItem + 0x04) >>> 0) | 0
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, itemId) >>> 0
  if (pItemsTxt === 0) return

  const maxDmg = m.u8((pItemsTxt + 0xff) >>> 0)
  if (maxDmg !== 0) {
    STATLIST_SetUnitStat113c(m, pItem, 22, maxDmg, 0)
  }
  const minDmg = m.u8((pItemsTxt + 0xfe) >>> 0)
  if (minDmg !== 0) {
    STATLIST_SetUnitStat113c(m, pItem, 21, minDmg, 0)
  }
  const secMinDmg = m.u8((pItemsTxt + 0x102) >>> 0)
  if (secMinDmg !== 0) {
    STATLIST_SetUnitStat113c(m, pItem, 23, secMinDmg, 0)
  }
  const secMaxDmg = m.u8((pItemsTxt + 0x103) >>> 0)
  if (secMaxDmg !== 0) {
    STATLIST_SetUnitStat113c(m, pItem, 24, secMaxDmg, 0)
  }
  const thrMaxDmg = m.u8((pItemsTxt + 0x101) >>> 0)
  if (thrMaxDmg !== 0) {
    const thrMinDmg = m.u8((pItemsTxt + 0x100) >>> 0)
    STATLIST_SetUnitStat113c(m, pItem, 159, thrMinDmg, 0)
    STATLIST_SetUnitStat113c(m, pItem, 160, thrMaxDmg, 0)
  }
}

/**
 * D2Game:0x6FC2F700 — rolls base defense (stat 31) on `pItem + 0x20` when item matches type 2.
 */
function rollBaseDefense_6FC2F700_113c(m: Memory113c, pItem: number): void {
  if (ITEMS_CheckItemTypeIdMem113c(m, pItem, 2) === 0) return
  const itemId = m.u32((pItem + 0x04) >>> 0) | 0
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort1113cSafe(m, itemId)
  if (pItemsTxt === 0) return
  const minAc = readS32(m, (pItemsTxt + 0xcc) >>> 0)
  const maxAc = readS32(m, (pItemsTxt + 0xd0) >>> 0)
  const ac = (minAc + rollSeedLimited(m, (pItem + 0x20) >>> 0, (maxAc - minAc + 1) | 0)) | 0
  STATLIST_SetUnitStat113c(m, pItem, 31, ac, 0)
}

function DATATBLS_GetItemsTxtRecordMemPort1113cSafe(m: Memory113c, itemId: number): number {
  return DATATBLS_GetItemsTxtRecordMemPort113c(m, itemId) >>> 0
}

/**
 * D2Game:0x6FC34AF0 (0x6FC33E60 Exp / 0x6FC337F0 Classic) — Low Quality item roll.
 */
function rollLowQuality_6FC34AF0_113c(m: Memory113c, pItem: number): void {
  const bExpFormat = (ITEMS_GetItemFormat113c(m, pItem) & 0xffff) >= 1
  const pSeed = ITEMS_GetItemSeed113c(m, pItem)
  const idx = rollSeedLimited(m, pSeed, 4)
  ITEMS_SetItemCell113c(m, pItem, idx)

  if (ITEMS_CanItemLoseDurability113c(m, pItem) !== 0) {
    const itemId = m.u32((pItem + 0x04) >>> 0) | 0
    const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, itemId) >>> 0
    const baseDur = pItemsTxt !== 0 ? m.u8((pItemsTxt + 0x112) >>> 0) : 0
    let maxDur = bExpFormat ? sdiv32(imul32(baseDur, 33), 100) : sdiv32(baseDur, 3)
    if (maxDur < 1) maxDur = 1
    const halfDur = maxDur >>> 1
    let dur = (halfDur + rollSeedLimited(m, (pItem + 0x20) >>> 0, halfDur)) | 0
    if (dur === 0) dur = 1
    STATLIST_SetUnitStat113c(m, pItem, 72, dur, 0)
    STATLIST_SetUnitStat113c(m, pItem, 73, maxDur, 0)
  }

  const scale75 = (statId: number, minVal: number): void => {
    const baseVal = STATLIST_GetUnitBaseStat113c(m, pItem, statId, 0) | 0
    let scaled = sdiv32(imul32(baseVal, 75), 100)
    if (scaled < minVal) scaled = minVal
    STATLIST_SetUnitStat113c(m, pItem, statId, scaled, 0)
  }

  if (ITEMS_CheckItemTypeIdMem113c(m, pItem, 0x2d) !== 0) {
    scale75(22, 2)
    scale75(21, 1)
    scale75(24, 2)
    scale75(23, 1)
    if (checkIfThrowItemMem113c(m, pItem) !== 0) {
      scale75(159, 2)
      scale75(160, 1)
    }
  } else if (ITEMS_CheckItemTypeIdMem113c(m, pItem, 0x32) !== 0) {
    scale75(31, 1)
  }
}

/**
 * D2Game:0x6FC340B0 — Superior Quality item roll (with 0x6FD960B0 and 0x6FC33DE0 hooked to no-ops in emitter).
 */
function rollSuperiorQuality_6FC340B0_113c(m: Memory113c, pItem: number): number {
  const pCountPtr = DATATBLS_GetBeltsTxtRecordCountPtr113c(m) >>> 0
  let nRows = readS32(m, pCountPtr)
  const itemId = m.u32((pItem + 0x04) >>> 0) | 0
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, itemId) >>> 0
  if (
    checkIfThrowItemMem113c(m, pItem) !== 0 ||
    (pItemsTxt !== 0 && m.u8((pItemsTxt + 0x113) >>> 0) !== 0)
  ) {
    nRows = 4
  }
  if (nRows <= 0) return 0

  const tried = new Uint8Array(Math.max(16, nRows))
  const pSeed = ITEMS_GetItemSeed113c(m, pItem)
  while (true) {
    const idx = rollSeedLimited(m, pSeed, nRows)
    if (tried[idx] === 0) {
      const pRec = DATATBLS_GetBeltsTxtRecord113c(m, idx) >>> 0
      if (pRec === 0) return 0
      if (ITEMS_CheckQualityItemMatch113c(m, pItem, pRec) !== 0) {
        ITEMS_SetItemCell113c(m, pItem, idx)
        return 1
      }
      tried[idx] = 1
      let hasUntried = false
      for (let k = 0; k < nRows; k++) {
        if (tried[k] === 0) {
          hasUntried = true
          break
        }
      }
      if (!hasUntried) return 0
    }
  }
}

/**
 * D2Game:0x6FC331E0 — checks whether `pItem` already has a magic prefix or suffix in `nGroup`.
 */
function hasAffixGroupOnItem_6FC331E0_113c(m: Memory113c, pItem: number, nGroup: number): number {
  const grp = nGroup | 0
  for (let i = 0; i < 3; i++) {
    const prefId = ITEMS_GetMagicPrefix113c(m, pItem, i) & 0xffff
    const pRec = DATATBLS_GetMagicAffixTxtRecord113c(m, prefId) >>> 0
    if (pRec !== 0 && readS32(m, (pRec + 0x5c) >>> 0) === grp) {
      return 1
    }
  }
  for (let i = 0; i < 3; i++) {
    const suffId = ITEMS_GetMagicSuffix113c(m, pItem, i) & 0xffff
    const pRec = DATATBLS_GetMagicAffixTxtRecord113c(m, suffId) >>> 0
    if (pRec !== 0 && readS32(m, (pRec + 0x5c) >>> 0) === grp) {
      return 1
    }
  }
  return 0
}

/**
 * D2Game:0x6FC344D0 — Expansion Magic/Rare affix roller (`wItemFormat >= 1`).
 */
function rollMagicAffixExp_6FC344D0_113c(
  m: Memory113c,
  pItem: number,
  bRequired: number,
  bRare: number,
  bIsPrefix: number,
): number {
  const pTbl = DATATBLS_GetMagicAffixDataTables113c(m) >>> 0
  const pStart =
    bIsPrefix !== 0 ? m.u32((pTbl + 0x0c) >>> 0) >>> 0 : m.u32((pTbl + 0x08) >>> 0) >>> 0
  const pEnd =
    bIsPrefix !== 0 ? m.u32((pTbl + 0x10) >>> 0) >>> 0 : m.u32((pTbl + 0x0c) >>> 0) >>> 0
  if (pStart === 0) return 0

  const pBase = m.u32((pTbl + 0x04) >>> 0) >>> 0
  const nCount = sdiv32((pEnd - pStart) | 0, 0x90)
  const baseIndex = sdiv32((pStart - pBase) | 0, 0x90)

  const pSeed = ITEMS_GetItemSeed113c(m, pItem)
  const coin = stepSeed64(m, pSeed) & 1
  const wFormat = ITEMS_GetItemFormat113c(m, pItem) & 0xffff
  const baseQlvl = ITEMS_GetBaseLevel113c(m, pItem) & 0xff

  if (coin === 0 && bRequired === 0) {
    return 0
  }

  let ilvl = ITEMS_GetItemLevel113c(m, pItem) | 0
  if (ilvl >= 99) ilvl = 99
  if (ilvl <= baseQlvl) ilvl = baseQlvl

  const itemId = m.u32((pItem + 0x04) >>> 0) | 0
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, itemId) >>> 0
  const magicLvl = pItemsTxt !== 0 ? m.u8((pItemsTxt + 0x140) >>> 0) : 0

  let alvl = 0
  if (magicLvl !== 0) {
    alvl = (ilvl + magicLvl) | 0
  } else {
    const halfQlvl = sar32(baseQlvl, 1)
    const threshold = (99 - halfQlvl) | 0
    if (ilvl < threshold) {
      alvl = (ilvl - halfQlvl) | 0
    } else {
      alvl = (ilvl * 2 - halfQlvl - threshold) | 0
    }
  }
  if (alvl <= 1) alvl = 1
  else if (alvl >= 99) alvl = 99

  const candIdx = new Int32Array(512)
  const candRec = new Uint32Array(512)
  let candCount = 0
  let totalWeight = 0

  for (let i = 0; i < nCount; i++) {
    const pRec = (pStart + imul32(i, 0x90)) >>> 0
    if (bRare !== 0 && m.u8((pRec + 0x54) >>> 0) === 0) continue
    if (m.u16((pRec + 0x22) >>> 0) >= 100 && wFormat < 100) continue
    const reqAlvl = readS32(m, (pRec + 0x58) >>> 0)
    if (reqAlvl > alvl) continue
    const maxAlvl = readS32(m, (pRec + 0x60) >>> 0)
    if (maxAlvl !== 0 && maxAlvl < alvl) continue
    if (m.u8((pRec + 0x64) >>> 0) === 0) {
      const q = ITEMS_GetItemQuality113c(m, pItem) | 0
      if (q === 6 || (q > 7 && q <= 9)) continue
    }
    if (ITEMS_EvalItemPropertyList113c(m, pItem, pRec) === 0) continue
    const freq = m.u8((pRec + 0x82) >>> 0)
    if (freq === 0) continue
    const affixClass = m.u8((pRec + 0x66) >>> 0)
    if (affixClass !== 0xff) {
      const itemClass = ITEMS_GetClassOfClassSpecificItem113c(m, pItem) | 0
      if (itemClass !== 7 && itemClass !== affixClass) continue
    }
    const group = readS32(m, (pRec + 0x5c) >>> 0)
    if (hasAffixGroupOnItem_6FC331E0_113c(m, pItem, group) !== 0) continue

    if (candCount < 511) {
      candIdx[candCount] = (baseIndex + i) | 0
      candRec[candCount] = pRec
      candCount++
    }
    const w = magicLvl !== 0 ? imul32(freq, reqAlvl) : freq
    totalWeight = (totalWeight + w) | 0
  }

  if (candCount <= 0) return 0

  let roll = rollSeedLimited(m, pSeed, (totalWeight + 1) | 0)
  let chosenIdx = -1
  for (let k = 0; k < candCount; k++) {
    chosenIdx = candIdx[k]!
    const pRec = candRec[k]!
    const freq = m.u8((pRec + 0x82) >>> 0)
    const reqAlvl = readS32(m, (pRec + 0x58) >>> 0)
    const w = magicLvl !== 0 ? imul32(freq, reqAlvl) : freq
    roll = (roll - w) | 0
    if (roll < 0) break
  }
  return (chosenIdx + 1) & 0xffff
}

/**
 * D2Game:0x6FC348A0 — Classic Magic/Rare affix roller (`wItemFormat == 0`).
 */
function rollMagicAffixClassic_6FC348A0_113c(
  m: Memory113c,
  pItem: number,
  bRequired: number,
  bRare: number,
  bIsPrefix: number,
): number {
  const pTbl = DATATBLS_GetMagicAffixDataTables113c(m) >>> 0
  const pStart =
    bIsPrefix !== 0 ? m.u32((pTbl + 0x0c) >>> 0) >>> 0 : m.u32((pTbl + 0x08) >>> 0) >>> 0
  const pEnd =
    bIsPrefix !== 0 ? m.u32((pTbl + 0x10) >>> 0) >>> 0 : m.u32((pTbl + 0x0c) >>> 0) >>> 0
  if (pStart === 0) return 0

  const pBase = m.u32((pTbl + 0x04) >>> 0) >>> 0
  const nCount = sdiv32((pEnd - pStart) | 0, 0x90)
  const baseIndex = sdiv32((pStart - pBase) | 0, 0x90)

  const pSeed = ITEMS_GetItemSeed113c(m, pItem)
  const coin = stepSeed64(m, pSeed) & 1
  const wFormat = ITEMS_GetItemFormat113c(m, pItem) & 0xffff

  if (coin === 0 && bRequired === 0) {
    return 0
  }

  let alvl = (ITEMS_GetItemLevel113c(m, pItem) + 2) | 0
  if (alvl <= 1) alvl = 1
  else if (alvl >= 99) alvl = 99

  const candIdx = new Int32Array(512)
  let candCount = 0

  for (let i = 0; i < nCount; i++) {
    const pRec = (pStart + imul32(i, 0x90)) >>> 0
    if (bRare !== 0 && m.u8((pRec + 0x54) >>> 0) === 0) continue
    if (m.u16((pRec + 0x22) >>> 0) >= 100 && wFormat < 100) continue
    if (readS32(m, (pRec + 0x58) >>> 0) > alvl) continue
    if (ITEMS_EvalItemPropertyList113c(m, pItem, pRec) === 0) continue
    if (candCount < 511) {
      candIdx[candCount] = (baseIndex + i) | 0
      candCount++
    }
  }

  if (candCount <= 0) return 0
  const pick = rollSeedLimited(m, pSeed, candCount)
  return (candIdx[pick]! + 1) & 0xffff
}

function rollMagicAffixDispatch113c(
  m: Memory113c,
  pItem: number,
  bRequired: number,
  bRare: number,
  bIsPrefix: number,
): number {
  if ((ITEMS_GetItemFormat113c(m, pItem) & 0xffff) >= 1) {
    return rollMagicAffixExp_6FC344D0_113c(m, pItem, bRequired, bRare, bIsPrefix)
  }
  return rollMagicAffixClassic_6FC348A0_113c(m, pItem, bRequired, bRare, bIsPrefix)
}

/**
 * D2Game:0x6FC303C0 — Magic Quality item roll (`wMagicPrefix[0]`, `wMagicSuffix[0]`, clear 0x10).
 */
function rollMagicQuality_6FC303C0_113c(m: Memory113c, pItem: number): void {
  const prefixId = rollMagicAffixDispatch113c(m, pItem, 0, 1, 1)
  ITEMS_SetMagicPrefix113c(m, pItem, prefixId, 0)
  const bReqSuffix = prefixId === 0 ? 1 : 0
  const suffixId = rollMagicAffixDispatch113c(m, pItem, bReqSuffix, 1, 0)
  ITEMS_SetMagicSuffix113c(m, pItem, suffixId, 0)
  if (prefixId !== 0 || suffixId !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x10, 0)
  }
}

/**
 * D2Game:0x6FC34210 / 0x6FC34370 — Rare prefix/suffix name roller.
 */
function rollRareName_6FC34210_113c(m: Memory113c, pItem: number, bIsPrefix: number): number {
  const pRareTbl = DATATBLS_GetRareAffixDataTables113c(m) >>> 0
  const pStart =
    bIsPrefix !== 0 ? m.u32((pRareTbl + 0x0c) >>> 0) >>> 0 : m.u32((pRareTbl + 0x08) >>> 0) >>> 0
  if (pStart === 0) return 0

  const pBase = m.u32((pRareTbl + 0x04) >>> 0) >>> 0
  const baseIndex = sdiv32((pStart - pBase) | 0, 0x48)
  const nCount =
    bIsPrefix !== 0
      ? sdiv32(((pBase + imul32(readS32(m, pRareTbl), 0x48)) - pStart) | 0, 0x48)
      : sdiv32((m.u32((pRareTbl + 0x0c) >>> 0) - m.u32((pRareTbl + 0x08) >>> 0)) | 0, 0x48)

  const candIdx = new Int32Array(512)
  let candCount = 0
  for (let i = 0; i < nCount; i++) {
    const pRec = (pStart + imul32(i, 0x48)) >>> 0
    if (ITEMS_CheckAffixAssignableToItem113c(m, pItem, pRec) !== 0 && candCount < 511) {
      candIdx[candCount++] = (baseIndex + i) | 0
    }
  }
  if (candCount <= 0) return 0
  const pSeed = ITEMS_GetItemSeed113c(m, pItem)
  const pick = rollSeedLimited(m, pSeed, candCount)
  return (candIdx[pick]! + 1) & 0xffff
}

/** D2Game:0x6FD1D058 — Expansion Rare affix count lookup table (`[0..7]`). */
const RARE_AFFIX_COUNT_TABLE_113C = [3, 4, 4, 5, 5, 5, 6, 6] as const

/**
 * D2Game:0x6FC354F0 (0x6FC35240 Exp / 0x6FC34F20 Classic) — Rare Quality item roll.
 */
function rollRareQuality_6FC354F0_113c(m: Memory113c, pItem: number, _pDrop: number): void {
  if (ITEMS_IsRareQualityAllowed113c(m, pItem) === 0) {
    return
  }

  const bExpFormat = (ITEMS_GetItemFormat113c(m, pItem) & 0xffff) >= 1
  const pSeed = ITEMS_GetItemSeed113c(m, pItem)

  for (let i = 0; i < 3; i++) {
    ITEMS_SetMagicPrefix113c(m, pItem, 0, i)
    ITEMS_SetMagicSuffix113c(m, pItem, 0, i)
  }

  const rarePrefix = rollRareName_6FC34210_113c(m, pItem, 1)
  const rareSuffix = rollRareName_6FC34210_113c(m, pItem, 0)
  if (rarePrefix === 0 || rareSuffix === 0) return

  ITEMS_SetRarePrefix113c(m, pItem, rarePrefix)
  ITEMS_SetRareSuffix113c(m, pItem, rareSuffix)

  const itemId = m.u32((pItem + 0x04) >>> 0) | 0
  const wType1 = ITEMS_IsTome113c(m, itemId) | 0

  let nAffixes: number
  if (wType1 === 0x3a) {
    nAffixes = ((stepSeed64(m, pSeed) & 1) + 3) | 0
  } else if (bExpFormat) {
    nAffixes = RARE_AFFIX_COUNT_TABLE_113C[stepSeed64(m, pSeed) & 7]!
  } else {
    nAffixes = (((stepSeed64(m, pSeed) >>> 0) % 3) + 4) | 0
  }

  let nPrefixes = 0
  let nSuffixes = 0

  if (bExpFormat) {
    let bPrefixExhausted = 0
    let bSuffixExhausted = 0

    for (let i = 0; i < nAffixes; i++) {
      if (bPrefixExhausted !== 0 && bSuffixExhausted !== 0) break

      let tryPrefix = false
      if (bPrefixExhausted === 0) {
        if (bSuffixExhausted !== 0) {
          tryPrefix = true
        } else {
          const coin = stepSeed64(m, pSeed) & 1
          tryPrefix = coin === 0
        }
      }

      if (tryPrefix) {
        if (nPrefixes >= 3) break
        const affixId = rollMagicAffixDispatch113c(m, pItem, 1, 1, 1)
        if (affixId > 0) {
          ITEMS_SetMagicPrefix113c(m, pItem, affixId, nPrefixes)
          nPrefixes++
          if (nPrefixes >= 3) bPrefixExhausted = 1
        } else {
          bPrefixExhausted = 1
          i--
        }
      } else {
        if (nSuffixes >= 3) break
        const affixId = rollMagicAffixDispatch113c(m, pItem, 1, 1, 0)
        if (affixId > 0) {
          ITEMS_SetMagicSuffix113c(m, pItem, affixId, nSuffixes)
          nSuffixes++
          if (nSuffixes >= 3) bSuffixExhausted = 1
        } else {
          bSuffixExhausted = 1
          i--
        }
      }
    }
  } else {
    for (let rem = nAffixes; rem > 0; rem--) {
      const coin = stepSeed64(m, pSeed) & 1
      const tryPrefix = nPrefixes < 3 && (nSuffixes === 3 || coin === 0)
      if (tryPrefix) {
        for (let tries = 0; ; tries++) {
          const affixId = rollMagicAffixDispatch113c(m, pItem, 1, 1, 1)
          if (affixId <= 0) break
          let dup = false
          const pNewRec = DATATBLS_GetMagicAffixTxtRecord113c(m, affixId) >>> 0
          const newGrp = pNewRec !== 0 ? readS32(m, (pNewRec + 0x5c) >>> 0) : 0
          for (let k = 0; k < 3; k++) {
            const exId = ITEMS_GetMagicPrefix113c(m, pItem, k) & 0xffff
            const pExRec = DATATBLS_GetMagicAffixTxtRecord113c(m, exId) >>> 0
            if (pExRec !== 0) {
              if (exId === affixId || readS32(m, (pExRec + 0x5c) >>> 0) === newGrp) {
                dup = true
                break
              }
            }
          }
          if (!dup) {
            ITEMS_SetMagicPrefix113c(m, pItem, affixId, nPrefixes)
            nPrefixes++
            break
          }
          if (tries > 250) {
            ITEMS_SetMagicPrefix113c(m, pItem, 0, nPrefixes)
            break
          }
        }
      } else {
        for (let tries = 0; ; tries++) {
          const affixId = rollMagicAffixDispatch113c(m, pItem, 1, 1, 0)
          if (affixId <= 0) break
          let dup = false
          const pNewRec = DATATBLS_GetMagicAffixTxtRecord113c(m, affixId) >>> 0
          const newGrp = pNewRec !== 0 ? readS32(m, (pNewRec + 0x5c) >>> 0) : 0
          for (let k = 0; k < 3; k++) {
            const exId = ITEMS_GetMagicSuffix113c(m, pItem, k) & 0xffff
            const pExRec = DATATBLS_GetMagicAffixTxtRecord113c(m, exId) >>> 0
            if (pExRec !== 0) {
              if (exId === affixId || readS32(m, (pExRec + 0x5c) >>> 0) === newGrp) {
                dup = true
                break
              }
            }
          }
          if (!dup) {
            ITEMS_SetMagicSuffix113c(m, pItem, affixId, nSuffixes)
            nSuffixes++
            break
          }
          if (tries > 250) {
            ITEMS_SetMagicSuffix113c(m, pItem, 0, nSuffixes)
            break
          }
        }
      }
    }
  }

  if (nPrefixes !== 0 || nSuffixes !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x10, 0)
  }
}

/**
 * D2Game:0x6FC2EBB0 — Ethereal roll and stat bonus application.
 */
function rollEthereal_6FC2EBB0_113c(m: Memory113c, pItem: number, pDrop: number): void {
  if ((m.u8((pDrop + 0x80) >>> 0) & 0x02) !== 0) return
  if (
    ITEMS_CheckItemTypeIdMem113c(m, pItem, 0x2d) === 0 &&
    ITEMS_CheckItemTypeIdMem113c(m, pItem, 0x32) === 0
  ) {
    return
  }
  if (ITEMS_CanItemLoseDurability113c(m, pItem) === 0) return
  const q = ITEMS_GetItemQuality113c(m, pItem) | 0
  if (q === 1 || q === 5) return
  if (ITEMS_GetComponentByte113c(m, pItem) !== 0) return

  const pSeed = ITEMS_GetItemSeed113c(m, pItem)
  const roll = rollSeedLimited(m, pSeed, 100)
  let makeEth = roll < 5 ? 1 : 0
  if ((m.u32((pDrop + 0x44) >>> 0) & 0x400000) !== 0) {
    makeEth = 1
  }
  if ((m.u8((pDrop + 0x80) >>> 0) & 0x04) === 0 && makeEth === 0) return

  ITEMS_ApplyEtherealBonusStats113c(m, pItem)
  if (ITEMS_CanItemLoseDurability113c(m, pItem) !== 0) {
    const baseMaxDur = STATLIST_GetUnitBaseStat113c(m, pItem, 73, 0) | 0
    const newMaxDur = (sdiv32(baseMaxDur, 2) + 1) | 0
    STATLIST_SetUnitStat113c(m, pItem, 73, newMaxDur, 0)
    const totMaxDur = STATLIST_GetUnitStat113c(m, pItem, 73, 0) | 0
    STATLIST_SetUnitStat113c(m, pItem, 72, totMaxDur, 0)
  }
}

/**
 * D2Game:0x6FC2EC90 — Socket roll and clamping.
 */
function rollSockets_6FC2EC90_113c(m: Memory113c, pItem: number, pDrop: number): void {
  if ((ITEMS_GetItemQuality113c(m, pItem) | 0) < 2) return
  if (ITEMS_GetSubTypeFromItem113c(m, pItem) === 0) return
  if (ITEMS_GetTwoHandedFlag113c(m, pItem) !== 0) return
  if ((ITEMS_GetMaxSocketsFromItemType113c(m, pItem) & 0xff) === 0) return

  let maxSock = ITEMS_GetMaxSocketsFromItemType113c(m, pItem) & 0xff
  const pGame = m.u32((pDrop + 0x04) >>> 0) >>> 0
  const diff = m.u8((pGame + 0x6d) >>> 0)
  if (diff === 0) {
    if (maxSock >= 3) maxSock = 3
  } else if (diff === 1) {
    if (maxSock >= 4) maxSock = 4
  } else if (diff === 2) {
    if (maxSock >= 6) maxSock = 6
  }
  if (maxSock <= 0) return

  if ((ITEMS_GetItemFormat113c(m, pItem) & 0xffff) < 100) {
    if (ITEMS_CheckItemTypeIdMem113c(m, pItem, 3) !== 0) return
  }

  const pSeed = ITEMS_GetItemSeed113c(m, pItem)
  let roll100 = rollSeedLimited(m, pSeed, 100)
  const dwFlags2 = m.u32((pDrop + 0x80) >>> 0) >>> 0
  if ((dwFlags2 & 0x08) !== 0) return
  if ((dwFlags2 & 0x10) !== 0) roll100 = 0
  if ((m.u32((pDrop + 0x44) >>> 0) & 0x800) === 0 && roll100 >= 33) return

  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x800, 1)
  if ((ITEMS_GetItemFormat113c(m, pItem) & 0xffff) >= 1) {
    const ownerGuid = ITEMS_GetOwnerGuid113c(m, pItem) >>> 0
    const nSockets = ((ownerGuid % (maxSock >>> 0)) + 1) | 0
    ITEMS_GetMissileWeaponVelocity113c(m, pItem, nSockets)
  } else {
    if (maxSock > 3) maxSock = 3
    if (ITEMS_CheckItemTypeIdMem113c(m, pItem, 0x25) !== 0 && maxSock > 2) {
      maxSock = 2
    }
    ITEMS_GetMissileWeaponVelocity113c(m, pItem, maxSock)
  }
}

/**
 * Pure v1.13c evaluator for ITEMGEN D2TV records (D2Game:0x6FC2EDB0 pipeline).
 */
export function evaluateItemgenVector113c(
  m: Memory113c,
  input: ItemGenVectorInput113c,
): ItemGenVectorOutput113c {
  const scratchBase = m.alloc(0x2600) >>> 0
  m.fill(scratchBase, 0x2600, 0)

  const pGame = scratchBase
  const pDrop = (scratchBase + 0x2000) >>> 0
  const pUnit = (scratchBase + 0x2100) >>> 0
  const pItemData = (scratchBase + 0x2300) >>> 0

  let itemSeedLo = (input.initSeedLo ^ 0xa5a5a5a5) >>> 0
  const itemSeedHi = (input.initSeedHi ^ 0x5a5a5a5a) >>> 0
  if (itemSeedLo === 0) itemSeedLo = 1

  const bExpansion = input.itemFormat >= 100 ? 1 : 0
  m.setU16((pGame + 0x28) >>> 0, input.itemFormat & 0xffff)
  m.setU8((pGame + 0x6d) >>> 0, input.difficulty & 0xff)
  m.setU32((pGame + 0x70) >>> 0, bExpansion)

  m.setU32((pUnit + 0x00) >>> 0, 4)
  m.setU32((pUnit + 0x04) >>> 0, input.itemId >>> 0)
  m.setU32((pUnit + 0x0c) >>> 0, 1)
  m.setU32((pUnit + 0x14) >>> 0, pItemData)
  m.setU32((pUnit + 0x20) >>> 0, input.initSeedLo >>> 0)
  m.setU32((pUnit + 0x24) >>> 0, input.initSeedHi >>> 0)
  m.setU32((pUnit + 0x28) >>> 0, input.initSeedLo >>> 0)

  STATLIST_CreateEx113c(m, pUnit, 0, pGame)

  m.setU32((pItemData + 0x00) >>> 0, input.quality >>> 0)
  m.setU32((pItemData + 0x04) >>> 0, itemSeedLo)
  m.setU32((pItemData + 0x08) >>> 0, itemSeedHi)
  m.setU32((pItemData + 0x0c) >>> 0, input.initSeedLo >>> 0)
  m.setU32((pItemData + 0x10) >>> 0, input.initSeedLo >>> 0)
  m.setU32((pItemData + 0x14) >>> 0, 0)
  m.setU32((pItemData + 0x18) >>> 0, 0)
  m.setU32((pItemData + 0x28) >>> 0, 0xffffffff)
  m.setU32((pItemData + 0x2c) >>> 0, input.ilvl >>> 0)
  m.setU16((pItemData + 0x30) >>> 0, input.itemFormat & 0xffff)

  let dwDropItemFlags = 0
  let dwDropFlags2 = 0
  if ((input.dropFlags & 2) !== 0) {
    dwDropItemFlags |= 0x800
    dwDropFlags2 |= 0x10
  }
  if ((input.dropFlags & 4) !== 0) {
    dwDropItemFlags |= 0x400000
    dwDropFlags2 |= 0x04
  }
  m.setU32((pDrop + 0x04) >>> 0, pGame)
  m.setU32((pDrop + 0x08) >>> 0, pGame)
  m.setU32((pDrop + 0x0c) >>> 0, input.ilvl >>> 0)
  m.setU32((pDrop + 0x14) >>> 0, input.itemId >>> 0)
  m.setU16((pDrop + 0x2a) >>> 0, input.itemFormat & 0xffff)
  m.setU32((pDrop + 0x30) >>> 0, input.quality >>> 0)
  m.setU32((pDrop + 0x44) >>> 0, dwDropItemFlags >>> 0)
  m.setU32((pDrop + 0x80) >>> 0, dwDropFlags2 >>> 0)

  /* Step 1: Base weapon damage, durability, and armor defense */
  setBaseWeaponDamageStats_6FC2E860_113c(m, pUnit)
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, input.itemId) >>> 0
  if (
    pItemsTxt !== 0 &&
    m.u8((pItemsTxt + 0x113) >>> 0) === 0 &&
    m.u8((pItemsTxt + 0x112) >>> 0) !== 0
  ) {
    const baseDur = m.u8((pItemsTxt + 0x112) >>> 0)
    STATLIST_SetUnitStat113c(m, pUnit, 73, baseDur, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 72, baseDur, 0)
  }
  if (ITEMS_CheckItemTypeIdMem113c(m, pUnit, 2) !== 0) {
    rollBaseDefense_6FC2F700_113c(m, pUnit)
  }

  /* Step 2: Quality branch */
  switch (input.quality | 0) {
    case 1:
      rollLowQuality_6FC34AF0_113c(m, pUnit)
      m.setU32((pItemData + 0x18) >>> 0, (m.u32((pItemData + 0x18) >>> 0) | 0x10) >>> 0)
      break
    case 2:
      m.setU32((pItemData + 0x18) >>> 0, (m.u32((pItemData + 0x18) >>> 0) | 0x10) >>> 0)
      break
    case 3:
      rollSuperiorQuality_6FC340B0_113c(m, pUnit)
      m.setU32((pItemData + 0x18) >>> 0, (m.u32((pItemData + 0x18) >>> 0) | 0x10) >>> 0)
      break
    case 4:
      rollMagicQuality_6FC303C0_113c(m, pUnit)
      break
    case 6:
      rollRareQuality_6FC354F0_113c(m, pUnit, pDrop)
      break
    default:
      break
  }

  /* Step 3: Ethereal roll for Expansion (`itemFormat >= 100`) */
  if (input.itemFormat >= 100) {
    rollEthereal_6FC2EBB0_113c(m, pUnit, pDrop)
  }

  /* Step 4: Socket roll */
  if ((input.dropFlags & 1) !== 0 && (input.quality <= 3 || (input.dropFlags & 2) !== 0)) {
    rollSockets_6FC2EC90_113c(m, pUnit, pDrop)
  }

  return {
    itemFlags: ITEMS_GetCommandFlags113c(m, pUnit) >>> 0,
    fileIndex: ITEMS_GetItemCell113c(m, pUnit) | 0,
    magicPrefix: [
      ITEMS_GetMagicPrefix113c(m, pUnit, 0) & 0xffff,
      ITEMS_GetMagicPrefix113c(m, pUnit, 1) & 0xffff,
      ITEMS_GetMagicPrefix113c(m, pUnit, 2) & 0xffff,
    ],
    magicSuffix: [
      ITEMS_GetMagicSuffix113c(m, pUnit, 0) & 0xffff,
      ITEMS_GetMagicSuffix113c(m, pUnit, 1) & 0xffff,
      ITEMS_GetMagicSuffix113c(m, pUnit, 2) & 0xffff,
    ],
    rarePrefix: ITEMS_GetRarePrefix113c(m, pUnit) & 0xffff,
    rareSuffix: ITEMS_GetRareSuffix113c(m, pUnit) & 0xffff,
    defense: sx16(STATLIST_GetUnitBaseStat113c(m, pUnit, 31, 0) & 0xffff),
    durability: sx16(STATLIST_GetUnitBaseStat113c(m, pUnit, 72, 0) & 0xffff),
    maxDurability: sx16(STATLIST_GetUnitBaseStat113c(m, pUnit, 73, 0) & 0xffff),
    minDamage: sx16(STATLIST_GetUnitBaseStat113c(m, pUnit, 21, 0) & 0xffff),
    maxDamage: sx16(STATLIST_GetUnitBaseStat113c(m, pUnit, 22, 0) & 0xffff),
    secMinDamage: sx16(STATLIST_GetUnitBaseStat113c(m, pUnit, 23, 0) & 0xffff),
    secMaxDamage: sx16(STATLIST_GetUnitBaseStat113c(m, pUnit, 24, 0) & 0xffff),
    finalQuality: (ITEMS_GetItemQuality113c(m, pUnit) >>> 0) & 0xff,
    sockets: (STATLIST_GetUnitBaseStat113c(m, pUnit, 194, 0) >>> 0) & 0xff,
    outSeedLo: (m.u32((pItemData + 0x04) >>> 0) ^ m.u32((pUnit + 0x20) >>> 0)) >>> 0,
    outSeedHi: (m.u32((pItemData + 0x08) >>> 0) ^ m.u32((pUnit + 0x24) >>> 0)) >>> 0,
  }
}

export const evaluateItemGenVector113c = evaluateItemgenVector113c

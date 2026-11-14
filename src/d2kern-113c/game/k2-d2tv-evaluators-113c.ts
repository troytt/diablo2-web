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
import { ITEMMODS_ApplyPropertyById113c } from '../common/items.ts'
import { MONSTERS_GetHirelingTypeId113c } from '../common/missile.ts'
import {
  SKILLS_AllocSkillList113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../common/skills.ts'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  MONSTERS_ApplyClassicConversionStats113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { DATATBLS_GetLevelMonsterLevel113c } from '../tables/datatbls-113c.ts'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c.ts'
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

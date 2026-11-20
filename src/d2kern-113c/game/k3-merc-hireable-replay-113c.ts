/**
 * @file src/d2kern-113c/game/k3-merc-hireable-replay-113c.ts
 * Milestone 34 ([K3]) Hireling / Mercenary longitudinal replay bridge (`p52-paladin-merc-aura`):
 * - Hydrates unloaded snapshot `D2PlayerDataStrc` breadcrumb tail, owner `D2PetListStrc` slot `7`,
 *   and `Hireling.txt` skills on boot.
 * - Routes every hireling AI think, move, skill cast, attack step, velocity override, breadcrumb,
 *   and kill XP split through its single canonical manifest-bound `tsSymbol` function.
 *
 * Strictly pure `src/d2kern-113c/` imports only.
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { MONSTER_GetMissileIdForAnimMode113c } from '../common/drlg/drlg-ver.ts'
import { imul32 } from '../common/int-math.ts'
import { SKILLS_GetUsedSkillMemPort113c } from '../common/k0-d2common-memports.ts'
import { PATH_GetTargetUnit113c } from '../common/path.ts'
import {
  SKILLS_AllocSkillList113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_SetSkillLevelOnUnit113c,
  SKILLS_SetSkillSlotIndex113c,
} from '../common/skills.ts'
import { STATLIST_GetUnitStat113c } from '../common/statlist.ts'
import { UNIT_MONSTER, UNIT_PLAYER, UNITS_GetRoom113c } from '../common/unit.ts'
import {
  D2AiGeneralStrc,
  D2MonsterDataStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c } from '../tables/monster-tbls-113c.ts'
import {
  ARENA_ProcessKillScoreUpdate113c,
  QUESTS_OnMonsterKill113c,
  SKILLS_StartUsedSkill113c,
} from './a1c-post150-f786-f1040-113c.ts'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  MONSTER_AdvanceAttackOrSkillStep113c,
  MONSTER_StartAttackOrCast113c,
} from './ai-fallen-113c.ts'
import {
  MONSTER_GetHirelingLevelBonusFactor113c,
  OBJECT_SendUpdatePacketsToClient113c,
} from './boot-init-gap-a-113c.ts'
import { bindK2KernelGlobals113c } from './k2-d2tv-evaluators-113c.ts'
import type { K2GapMeleeDotHooks113c } from './k2-gap-melee-dot-113c.ts'
import {
  type MonsterSliceWorldLike113c,
  SUNITDMG_DistributeExperience113c,
} from './k2-real-s2c-combat-113c.ts'
import { MONSTER_IsPlayerInteractInTradeState113c } from './k2-sunit-spawn-w1-113c.ts'
import { AI_ThinkMercenaryMain_6FC3DD40_113c } from './k2-w12b1-113c.ts'
import { NET_SendPacket9E9FA0_StatValue_6FCABC20_113c } from './k2-w4b4-113c.ts'
import { PETS_SendPetOrMercAssignPacket_6FCB66E0_113c } from './k2-w4b5-113c.ts'
import { SKILLS_SrvSt32_EnsureWeaponOrQuiverOrStartCast_6FC6C840_113c } from './k2-w5b1-113c.ts'
import { NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c } from './k2-w5b10-113c.ts'
import {
  NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c,
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c,
} from './k2-w6b2-113c.ts'
import { ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c } from './k2-w7b3-113c.ts'
import { SKILLS_DoUsedSkillActionK3_113c } from './k3-p52-sorc-handlers-113c.ts'
import { resolveKillerPlayerForMonsterDeathK3_113c } from './k3-summon-curse-replay-113c.ts'
import { SUNIT_IsDeadOrDying113c } from './monster-events.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS_GetRecordPtr113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_ValidatePathTargetUnit113c,
} from './regpop-spawn-113c.ts'
import {
  MONSTER_ApplyModeVelocityOverride113c,
  PLAYER_StepModeWalkOrRun113c,
} from './replay-final11-113c.ts'
import {
  type FallenSliceWorld113c,
  getDifficultyIdx113c,
  SUNITDMG_ExecuteMissileOrMeleeDmg113c,
  syncActRoomsAndUnitsIntoWorld113c,
} from './replay-kernel-113c.ts'
import type { MonStatsRow113c } from './tables-bootstrap-113c.ts'

export const VA_AI_HIREABLE_113C = 0x6fc3dd40

const K3_MERC_HEAP_BASE = 0x7e180000
let k3MercHeapPtr = K3_MERC_HEAP_BASE

function sx16(v: number): number {
  return (v << 16) >> 16
}

function sx8(v: number): number {
  return (v << 24) >> 24
}

function ensureMercAddrZeroedIfUnloaded(m: Memory113c, baseAddr: number, byteLen: number): void {
  const memInternal = m as unknown as { known?: Map<number, Uint8Array> }
  const known = memInternal.known
  if (known === undefined) return
  for (let i = 0; i < byteLen; i += 1) {
    const addr = (baseAddr + i) >>> 0
    const kp = known.get(addr >>> 12)
    if (kp === undefined || kp[addr & 0xfff] === 0) {
      m.setU8(addr, 0)
    }
  }
}

function resolveHydratedOwnerClientK3_113c(m: Memory113c, pGame: number, pOwner: number): number {
  if (pOwner === 0 || (m.u32(pOwner >>> 0) | 0) !== UNIT_PLAYER) return 0
  const pOwnerData = UNITS_GetPlayerData113c(m, pOwner) >>> 0
  const rawClient = pOwnerData !== 0 ? (m.u32((pOwnerData + 0x9c) >>> 0) >>> 0) : 0
  const pClient = rawClient !== 0 ? rawClient : (pGame !== 0 ? (m.u32((pGame + 0x88) >>> 0) >>> 0) : 0)
  if (pClient !== 0) {
    ensureMercAddrZeroedIfUnloaded(m, (pClient + 0x3d4) >>> 0, 4)
    ensureMercAddrZeroedIfUnloaded(m, (pClient + 0x16c) >>> 0, 12)
    ensureMercAddrZeroedIfUnloaded(m, (pClient + 0x1a8) >>> 0, 4)
    if (m.u32((pClient + 0x174) >>> 0) === 0) {
      m.setU32((pClient + 0x16c) >>> 0, 0)
      m.setU32((pClient + 0x170) >>> 0, m.u32((pOwner + 0x0c) >>> 0))
      m.setU32((pClient + 0x174) >>> 0, pOwner >>> 0)
    }
    if (pGame !== 0 && m.u32((pClient + 0x1a8) >>> 0) === 0) {
      m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
    }
  }
  return pClient
}

function readSgptDataTables113c(m: Memory113c): number {
  const ptr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (ptr === 0) return 0
  return m.u32(ptr) >>> 0
}

/**
 * Returns `true` when `pMonster` is a hireling unit (`pfnThink === 0x6FC3DD40` or `classId` in `{271, 338, 359, 560, 561}`).
 */
export function isHireableMonsterK3_113c(m: Memory113c, pMonster: number): boolean {
  if (pMonster === 0 || m.get(pMonster, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return false
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) | 0
  if (
    classId === 0x10f ||
    classId === 0x152 ||
    classId === 0x167 ||
    classId === 0x230 ||
    classId === 0x231
  ) {
    return true
  }
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return false
  const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGen === 0) return false
  return (m.get(pAiGen, D2AiGeneralStrc.pfnThink) >>> 0) === VA_AI_HIREABLE_113C
}

/**
 * Delegates hireling mode velocity override (`0x6FC94CE0`) to canonical `MONSTER_ApplyModeVelocityOverride113c`.
 */
export function applyHireableModeVelocityOverrideK3_113c(
  m: Memory113c,
  pMonster: number,
  pAiCtrl: number,
): boolean {
  if (pAiCtrl === 0 || !isHireableMonsterK3_113c(m, pMonster)) return false
  MONSTER_ApplyModeVelocityOverride113c(m, pAiCtrl, pMonster)
  return true
}

/**
 * Hydrates unloaded player breadcrumb tail (`+0xA0..+0x16B`), owner `D2PetListStrc` (`+0x44` slot `7`),
 * and `Hireling.txt` skills for `F2` snapshot worlds containing a hireling.
 */
export function hydrateMercHireableSnapshotStateK3_113c(
  world: FallenSliceWorld113c,
  saveBytes?: Uint8Array,
): void {
  const { m, pGame } = world
  k3MercHeapPtr = K3_MERC_HEAP_BASE

  const memInternal = m as unknown as { known?: Map<number, Uint8Array> }
  const isAddrLoaded = (addr: number): boolean => {
    const a = addr >>> 0
    if (a === 0) return false
    const kp = memInternal.known !== undefined ? memInternal.known.get(a >>> 12) : undefined
    return kp !== undefined && kp[a & 0xfff] !== 0
  }

  bindK2KernelGlobals113c(m)

  for (const pPlr of world.playerById.values()) {
    if (!isAddrLoaded((pPlr + 0x80) >>> 0) || m.u32((pPlr + 0x80) >>> 0) === 0) {
      m.setU32((pPlr + 0x80) >>> 0, pGame >>> 0)
    }
    const pPlrData = m.u32((pPlr + 0x14) >>> 0) >>> 0
    if (pPlrData === 0) continue
    for (let off = 0xa0; off < 0x16c; off += 1) {
      const addr = (pPlrData + off) >>> 0
      if (!isAddrLoaded(addr)) {
        m.setU8(addr, 0)
      }
    }
    const pExistingPets = m.u32((pPlrData + 0x44) >>> 0) >>> 0
    const petsLoaded =
      pExistingPets !== 0 &&
      isAddrLoaded(pExistingPets) &&
      isAddrLoaded(m.u32(pExistingPets) >>> 0)
    if (!petsLoaded) {
      const pPetWrap = k3MercHeapPtr
      const pSlotsArray = (pPetWrap + 0x10) >>> 0
      k3MercHeapPtr = (pSlotsArray + 0x180) >>> 0
      m.fill(pPetWrap, 0x190, 0)
      m.setU32((pPlrData + 0x44) >>> 0, pPetWrap)
      m.setU32(pPetWrap, pSlotsArray)
    }
  }

  if ((m.u32((pGame + 0xa8) >>> 0) | 0) <= 2) {
    for (let b = 0; b < 128; b += 1) {
      const bucketAddr = (pGame + 0x1520 + b * 4) >>> 0
      if (isAddrLoaded(bucketAddr) && m.u32(bucketAddr) !== 0) {
        OBJECT_SendUpdatePacketsToClient113c(m, 0, 0)
        break
      }
    }
  }

  let hasMerc = false
  for (const pMon of world.monsterById.values()) {
    if (isHireableMonsterK3_113c(m, pMon)) {
      hasMerc = true
      break
    }
  }
  if (!hasMerc) return

  MONSTER_GetHirelingLevelBonusFactor113c(m, pGame, 0)

  let wMercNameId = 0
  let dwMercSeed = 0
  let wMercType = 1
  if (saveBytes !== undefined && saveBytes.length >= 0xc0) {
    const dv = new DataView(saveBytes.buffer, saveBytes.byteOffset, saveBytes.byteLength)
    dwMercSeed = dv.getUint32(0xb3, true) >>> 0
    wMercNameId = dv.getUint16(0xb7, true)
    const rawType = dv.getUint16(0xb9, true)
    if (rawType > 0) {
      wMercType = rawType
    }
  }

  for (const [monId, pMon] of world.monsterById) {
    if (!isHireableMonsterK3_113c(m, pMon)) continue

    const pInv = m.u32((pMon + 0x60) >>> 0) >>> 0
    if (pInv !== 0 && !isAddrLoaded(pInv)) {
      const pHydratedInv = k3MercHeapPtr
      k3MercHeapPtr = (pHydratedInv + 0x40) >>> 0
      m.fill(pHydratedInv, 0x40, 0)
      m.setU32(pHydratedInv, 0x01020304)
      m.setU32((pHydratedInv + 0x04) >>> 0, m.u32((pGame + 0x1c) >>> 0))
      m.setU32((pHydratedInv + 0x08) >>> 0, pMon >>> 0)
      m.setU32((pHydratedInv + 0x1c) >>> 0, 0xffffffff)
      m.setU32((pMon + 0x60) >>> 0, pHydratedInv)
    }
    const pSkills = m.u32((pMon + 0xa8) >>> 0) >>> 0
    if (pSkills !== 0 && !isAddrLoaded(pSkills)) {
      m.setU32((pMon + 0xa8) >>> 0, 0)
    }

    const pMonData = m.get(pMon, D2UnitStrc.pUnitData)
    if (pMonData !== 0) {
      ensureMercAddrZeroedIfUnloaded(m, (pMonData + 0x30) >>> 0, 4)
      const pInteract = m.u32((pMonData + 0x30) >>> 0) >>> 0
      if (pInteract !== 0) {
        ensureMercAddrZeroedIfUnloaded(m, pInteract, 4)
      }
      ensureMercAddrZeroedIfUnloaded(m, (pMonData + 0x3c) >>> 0, 12)
    }
    const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
    let pOwner = 0
    if (pAiGen !== 0 && m.u32((pAiGen + 0x28) >>> 0) !== 0) {
      const ownerGuid = m.u32((pAiGen + 0x2c) >>> 0) >>> 0
      const ownerType = m.u32((pAiGen + 0x30) >>> 0) | 0
      if (ownerType === UNIT_PLAYER) {
        const found = world.playerById.get(ownerGuid)
        pOwner = found !== undefined ? found : 0
      }
    }

    if (pOwner !== 0) {
      const sm = m as SparseMemory113c
      const pClient = resolveHydratedOwnerClientK3_113c(m, pGame, pOwner)
      const pOwnerData = m.u32((pOwner + 0x14) >>> 0) >>> 0
      const pPetWrap = pOwnerData !== 0 ? (m.u32((pOwnerData + 0x44) >>> 0) >>> 0) : 0
      const pSlotsArray = pPetWrap !== 0 ? (m.u32(pPetWrap) >>> 0) : 0
      if (pSlotsArray !== 0 && m.u32((pSlotsArray + 0x54) >>> 0) === 0) {
        const pPetNode = k3MercHeapPtr
        k3MercHeapPtr = (pPetNode + 0x20) >>> 0
        m.fill(pPetNode, 0x20, 0)
        m.setU32((pSlotsArray + 0x54) >>> 0, pPetNode)
        m.setU32((pSlotsArray + 0x58) >>> 0, 1)

        m.setU32(pPetNode, 0)
        m.setU32((pPetNode + 0x04) >>> 0, monId >>> 0)
        m.setU32((pPetNode + 0x08) >>> 0, wMercNameId >>> 0)
        m.setU32((pPetNode + 0x0c) >>> 0, dwMercSeed >>> 0)
        m.setU32((pPetNode + 0x10) >>> 0, wMercType >>> 0)
        m.setU32((pPetNode + 0x14) >>> 0, 0)
      }
      const pAssignCtx = k3MercHeapPtr
      k3MercHeapPtr = (pAssignCtx + 0x20) >>> 0
      m.fill(pAssignCtx, 0x20, 0)
      m.setU32(pAssignCtx, m.u32((pOwner + 0x0c) >>> 0))
      m.setU32((pAssignCtx + 0x04) >>> 0, monId >>> 0)
      m.setU16((pAssignCtx + 0x08) >>> 0, wMercNameId & 0xffff)
      m.setU32((pAssignCtx + 0x0c) >>> 0, 7)
      m.setU32((pAssignCtx + 0x10) >>> 0, dwMercSeed !== 0 ? dwMercSeed : 1)
      m.setU32((pAssignCtx + 0x14) >>> 0, wMercType >>> 0)
      PETS_SendPetOrMercAssignPacket_6FCB66E0_113c(sm, pOwner, pAssignCtx)
      MONSTER_IsPlayerInteractInTradeState113c(m, pMon, pOwner)
      if (pClient !== 0) {
        const savedMonInv = m.u32((pMon + 0x60) >>> 0) >>> 0
        if (savedMonInv === 0) {
          const pTmpInv = k3MercHeapPtr
          k3MercHeapPtr = (pTmpInv + 0x40) >>> 0
          m.fill(pTmpInv, 0x40, 0)
          m.setU32(pTmpInv, 0x01020304)
          m.setU32((pMon + 0x60) >>> 0, pTmpInv)
          try {
            ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c(sm, 0, pGame, pMon, pClient)
          } finally {
            m.setU32((pMon + 0x60) >>> 0, 0)
          }
        } else {
          ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c(sm, 0, pGame, pMon, pClient)
        }
        NET_SendPacket9E9FA0_StatValue_6FCABC20_113c(
          sm,
          0x0d,
          pMon,
          pClient,
          STATLIST_GetUnitStat113c(m, pMon, 0x0d, 0) >>> 0,
        )
      }
    }

    if (m.u32((pMon + 0xa8) >>> 0) === 0) {
      m.setU32(
        (pMon + 0xa8) >>> 0,
        SKILLS_AllocSkillList113c(m, m.u32((pGame + 0x1c) >>> 0)) >>> 0,
      )
      const nClassId = m.get(pMon, D2UnitStrc.dwClassId) | 0
      const pMonStats = MONSTATS_GetRecordPtr113c(m, nClassId) >>> 0
      if (pMonStats !== 0) {
        for (let i = 0; i < 8; i += 1) {
          const wSkill = sx16(m.u16((pMonStats + 0x170 + i * 2) >>> 0))
          if (wSkill < 0) continue
          const bBaseLvl = sx8(m.u8((pMonStats + 0x198 + i) >>> 0))
          if (bBaseLvl <= 0) continue
          SKILLS_SetSkillLevelOnUnit113c(m, pMon, wSkill, bBaseLvl, 0, 0x6fd1b980, 0x112a)
          const bSlot = sx8(m.u8((pMonStats + 0x180 + i) >>> 0))
          if (bSlot >= 0) {
            const pSk = SKILLS_GetSkillById113c(m, pMon, wSkill, 0xffffffff) >>> 0
            if (pSk !== 0) {
              SKILLS_SetSkillSlotIndex113c(m, pSk, bSlot)
            }
          }
        }
      }
      const mercLvl = STATLIST_GetUnitStat113c(m, pMon, 0x0c, 0) | 0
      const bExpansion = m.u32((pGame + 0x70) >>> 0) | 0
      const pHirelingTxt =
        DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(m, bExpansion, wMercType, mercLvl) >>> 0
      const pTables = readSgptDataTables113c(m)
      const nSkillsCount = pTables !== 0 ? (m.u32((pTables + 0xba0) >>> 0) | 0) : 0
      if (pHirelingTxt !== 0 && nSkillsCount > 0) {
        const baseLvl = m.u32((pHirelingTxt + 0x1c) >>> 0) | 0
        const lvlDelta = (mercLvl - baseLvl) | 0
        for (let slot = 0; slot < 6; slot += 1) {
          const skillId = m.u32((pHirelingTxt + 0x78 + slot * 4) >>> 0) | 0
          if (skillId <= 0 || skillId >= nSkillsCount) break
          const bMode = m.u8((pHirelingTxt + 0xc0 + slot) >>> 0)
          if (bMode >= 0x10) break
          const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
          if (pSkillsTxt === 0) continue
          const reqLvl = sx16(m.u16((pSkillsTxt + 0x174) >>> 0))
          if (mercLvl < reqLvl) continue
          const lvlPerLvl = sx8(m.u8((pHirelingTxt + 0xcc + slot) >>> 0))
          const baseSlvl = sx8(m.u8((pHirelingTxt + 0xc6 + slot) >>> 0))
          let slvl = (((imul32(lvlPerLvl, lvlDelta) >> 5) | 0) + baseSlvl) | 0
          if (slvl < 0) slvl = 0
          else if (slvl > 32) slvl = 32
          if (slvl > 0) {
            SKILLS_SetSkillLevelOnUnit113c(m, pMon, skillId, slvl, 0, 0x6fd1b980, 0x112a)
          }
        }
      }
    }
  }
}

/**
 * Routes player walk/run breadcrumb recording through canonical `PLAYER_StepModeWalkOrRun113c` (`0x6FC99B90`).
 */
export function recordPlayerWalkBreadcrumbK3_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): void {
  if (pGame === 0 || pPlayer === 0) return
  PLAYER_StepModeWalkOrRun113c(m, pGame, pPlayer, true)
}

/**
 * Routes monster skill-mode start (`0x6FC95510`) through canonical `MONSTER_StartAttackOrCast113c`.
 */
export function onMonsterStartSkillModeK3_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
): void {
  const pUsed = SKILLS_GetUsedSkillMemPort113c(m, pMonster) >>> 0
  if (pUsed === 0) return
  bindK2KernelGlobals113c(m)
  MONSTER_StartAttackOrCast113c(
    m,
    pGame,
    pMonster,
    {
      onSkillDoStart(mem, pUnit, pg) {
        const used = SKILLS_GetUsedSkillMemPort113c(mem, pUnit) >>> 0
        if (used === 0) return 0
        const skId = SKILLS_GetSkillIdFromSkill113c(mem, used, 0, 0) | 0
        const pSkTxt = skId >= 0 ? SKILLS_GetRecordPtrFast113c(mem, skId) : 0
        const wSrvSt = pSkTxt !== 0 ? sx16(mem.u16((pSkTxt + 0x2c) >>> 0)) : 0
        if (wSrvSt === 4 || wSrvSt === 32) {
          SKILLS_SrvSt32_EnsureWeaponOrQuiverOrStartCast_6FC6C840_113c(mem, pg, pUnit)
        }
        return SKILLS_StartUsedSkill113c(mem, pUnit, pg)
      },
    },
    true,
  )
  const pOwner = AIGENERAL_GetPackLeaderUnit113c(m, pMonster) >>> 0
  const pClient =
    pOwner !== 0
      ? resolveHydratedOwnerClientK3_113c(m, pGame, pOwner)
      : (m.u32((pGame + 0x88) >>> 0) >>> 0)
  if (pClient !== 0) {
    ensureMercAddrZeroedIfUnloaded(m, (pClient + 0x1a8) >>> 0, 4)
    if (m.u32((pClient + 0x1a8) >>> 0) === 0) {
      m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
    }
    const pPath = m.get(pMonster, D2UnitStrc.pPath) >>> 0
    const pTarget = pPath !== 0 ? (PATH_GetTargetUnit113c(m, pPath) >>> 0) : 0
    const pTargetRoom = pTarget !== 0 ? (UNITS_GetRoom113c(m, pTarget) >>> 0) : 0
    let boundTmpRoomClient = false
    let savedClientsPtr = 0
    let savedClientsCnt = 0
    if (pTargetRoom !== 0) {
      ensureMercAddrZeroedIfUnloaded(m, (pTargetRoom + 0x48) >>> 0, 4)
      ensureMercAddrZeroedIfUnloaded(m, (pTargetRoom + 0x78) >>> 0, 4)
      if (m.u32((pTargetRoom + 0x78) >>> 0) === 0) {
        savedClientsPtr = m.u32((pTargetRoom + 0x48) >>> 0) >>> 0
        savedClientsCnt = m.u32((pTargetRoom + 0x78) >>> 0) >>> 0
        const pTmpArr = k3MercHeapPtr
        m.setU32(pTmpArr, pClient)
        m.setU32((pTargetRoom + 0x48) >>> 0, pTmpArr)
        m.setU32((pTargetRoom + 0x78) >>> 0, 1)
        boundTmpRoomClient = true
      }
    }
    try {
      NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c(
        m as SparseMemory113c,
        pMonster,
        pClient,
        pTarget,
      )
    } finally {
      if (boundTmpRoomClient && pTargetRoom !== 0) {
        m.setU32((pTargetRoom + 0x48) >>> 0, savedClientsPtr)
        m.setU32((pTargetRoom + 0x78) >>> 0, savedClientsCnt)
      }
    }
  }
}

/**
 * Routes hireling AI think (`0x6FC3DD40`) directly to canonical `AI_ThinkMercenaryMain_6FC3DD40_113c`.
 */
export function runHireableAiThinkK3_113c(
  world: MonsterSliceWorldLike113c,
  pMerc: number,
): void {
  const { m, pGame } = world
  const pMonData = pMerc !== 0 ? m.get(pMerc, D2UnitStrc.pUnitData) : 0
  if (pMonData !== 0) {
    ensureMercAddrZeroedIfUnloaded(m, (pMonData + 0x3c) >>> 0, 12)
  }
  AI_ThinkMercenaryMain_6FC3DD40_113c(
    world as FallenSliceWorld113c & SparseMemory113c,
    pMerc,
  )
  const pOwner = AIGENERAL_GetPackLeaderUnit113c(m, pMerc) >>> 0
  if (pOwner !== 0) {
    const pClient = resolveHydratedOwnerClientK3_113c(m, pGame, pOwner)
    if (pClient !== 0) {
      NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c(
        m as SparseMemory113c,
        pClient,
        pMerc,
      )
    }
  }
}

/**
 * Routes monster attack / skill / missile step (`0x6FC95CE0` -> `0x6FC95C60` / `0x6FC97790`)
 * through canonical `MONSTER_AdvanceAttackOrSkillStep113c`.
 */
export function stepMonsterAttackOrSkillActionK3_113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  arg14: number,
  hooks: K2GapMeleeDotHooks113c,
): void {
  const { m, pGame } = world
  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, pMonster) >>> 0
  if (pUsedSkill !== 0) {
    if (arg14 === 1 || arg14 === 2) {
      bindK2KernelGlobals113c(m)
      MONSTER_AdvanceAttackOrSkillStep113c(m, pGame, pMonster, world, {
        onSkillDoStep(mem, pUnit, pg) {
          SKILLS_DoUsedSkillActionK3_113c(mem, pUnit, pg, hooks)
          return 1
        },
      })
      syncActRoomsAndUnitsIntoWorld113c(world)
    }
    return
  }

  const modeMissileId = MONSTER_GetMissileIdForAnimMode113c(m, pMonster, 0) | 0
  if (modeMissileId >= 0) {
    if (arg14 === 1 || arg14 === 2) {
      bindK2KernelGlobals113c(m)
      MONSTER_AdvanceAttackOrSkillStep113c(m, pGame, pMonster, world, {
        onSpawnModeMissile(mem, pg, mid, pUnit, _pTarget, lvl) {
          SUNIT_ValidatePathTargetUnit113c(mem, pUnit, pg)
          const useUnitLvl = ((mem.get(pUnit, D2UnitStrc.dwFlags) >>> 9) & 1) !== 0
          let projLvl = lvl | 0
          if (!useUnitLvl) {
            const diff = getDifficultyIdx113c(mem, pg)
            const pTables = readSgptDataTables113c(mem)
            const pGameLvl = pTables !== 0 ? (mem.u32((pTables + 0xbc0) >>> 0) >>> 0) : 0
            projLvl = pGameLvl !== 0 ? ((mem.u32((pGameLvl + diff * 0x10 + 0x10) >>> 0) | 0) + 1) | 0 : 1
          }
          return SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
            mem,
            pg,
            mid,
            pUnit,
            0,
            projLvl,
            0,
            0,
            0,
            0,
            1,
          )
        },
      })
      syncActRoomsAndUnitsIntoWorld113c(world)
    }
    return
  }

  if (arg14 === 1) {
    if (isSgptDataTablesReadyForMonsterStep(m)) {
      MONSTER_AdvanceAttackOrSkillStep113c(m, pGame, pMonster, world)
    } else {
      const pPath = m.get(pMonster, D2UnitStrc.pPath)
      const pDef = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) : 0
      if (pDef !== 0 && pDef !== pMonster && SUNIT_IsDeadOrDying113c(m, pDef) === 0) {
        SUNITDMG_ExecuteMissileOrMeleeDmg113c(world, pMonster, pDef)
      }
    }
  }
}

function isSgptDataTablesReadyForMonsterStep(m: Memory113c): boolean {
  const memInternal = m as unknown as { known?: Map<number, Uint8Array> }
  if (memInternal.known === undefined) return false
  const a = D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0
  const kp = memInternal.known.get(a >>> 12)
  if (kp === undefined || kp[a & 0xfff] === 0) return false
  return readSgptDataTables113c(m) !== 0
}

/**
 * Routes monster kill XP award (`0x6FCFEEE0` -> `0x6FC977F0` -> `0x6FCFEA00` -> `0x6FCFC030` ->
 * `0x6FCFAA40` + `0x6FCFFA60` + `0x6FCFDCB0` + `0x6FCFE6D0`) through canonical `SUNITDMG_DistributeExperience113c`.
 */
export function awardMonsterKillExperienceWithMercK3_113c(
  world: MonsterSliceWorldLike113c,
  pMonster: number,
  pKiller: number,
  _row: MonStatsRow113c,
): void {
  const { m, pGame } = world
  if (pKiller === 0 || pMonster === 0) return
  bindK2KernelGlobals113c(m)
  AIGENERAL_GetPackLeaderUnit113c(m, pMonster)
  if (m.get(pKiller, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) {
    const pOwnerPlayer = resolveKillerPlayerForMonsterDeathK3_113c(m, pGame, pKiller)
    if (pOwnerPlayer !== 0) {
      QUESTS_OnMonsterKill113c(m, pGame, pOwnerPlayer, pMonster)
      ARENA_ProcessKillScoreUpdate113c(m, pGame, pOwnerPlayer, pMonster)
    }
  }
  SUNITDMG_DistributeExperience113c(m, pGame, pKiller, pMonster, true)
}

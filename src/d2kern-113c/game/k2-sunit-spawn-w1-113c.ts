/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 1 (`Lane K2-B`) routines across
 * `0x6FC60000..0x6FC6FFFF` and `0x6FD00000..0x6FD17FFF` (`SUNIT`, `REGPOP`,
 * `MONSTER` NPC interaction state, `SKILLS` summon/curse helpers, `CLIENTS`
 * progression, `ACT3` quest callbacks/filters, and `PARTY` player relations).
 *
 * Every `@va`-annotated export is a direct instruction-faithful translation of
 * its corresponding `D2Game.dll` v1.13c machine-code routine operating on
 * `Memory113c` (`SparseMemory113c`).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon.ts'
import { imul32, sdiv32 } from '../common/int-math.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items.ts'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record.ts'
import { UNITS_GetRoom113c } from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { seedNext, type D2SeedStrc } from '../prng.ts'
import { DATATBLS_GetMonLvlTxtRecord113c } from '../tables/datatbls-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS_CheckFlagBit113c,
} from './regpop-spawn-113c.ts'

/**
 * `D2Game.dll` `.data` `0x6FD2D8C0..0x6FD2D922` (`11` rows x `9` bytes):
 * Necromancer skeleton equipment component variant table indexed by clamped tier `0..10`.
 */
const SKELETON_COMP_TABLE_6FD2D8C0: ReadonlyArray<readonly number[]> = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1],
  [0, 1, 0, 0, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 0, 0, 1, 1, 2],
  [1, 1, 0, 0, 0, 0, 1, 1, 2],
  [1, 1, 1, 0, 0, 1, 1, 1, 3],
  [2, 2, 1, 0, 0, 1, 1, 1, 3],
  [2, 2, 1, 0, 0, 1, 1, 2, 4],
  [2, 3, 1, 0, 0, 1, 2, 2, 4],
  [2, 3, 1, 0, 0, 1, 2, 2, 4],
]

const SKELETON_COMP_TABLE_VA_113C = 0x6fd2d8c0

let k2SunitSpawnStackPtr = 0x7ef90000

function sx16(v: number): number {
  return (v << 16) >> 16
}

function readSkeletonCompByte113c(m: Memory113c, tier: number, col: number): number {
  if (tier >= 0 && tier <= 10) {
    return SKELETON_COMP_TABLE_6FD2D8C0[tier]![col]!
  }
  return m.u8((SKELETON_COMP_TABLE_VA_113C + imul32(tier, 9) + col) >>> 0)
}

function writeMonsterDataByteIfMonster113c(
  m: Memory113c,
  pMonster: number,
  offset: number,
  val: number,
): void {
  if (pMonster === 0) return
  if (m.u32(pMonster >>> 0) !== 1) return
  const pMonsterData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return
  m.setU8((pMonsterData + offset) >>> 0, val & 0xff)
}

function getMonsterInteractPtr113c(m: Memory113c, pMonster: number): number {
  if (pMonster === 0) return 0
  if (m.u32(pMonster >>> 0) !== 1) return 0
  const pMonsterData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return 0
  return m.u32((pMonsterData + 0x30) >>> 0) >>> 0
}

function findQuestNodeInGame113c(m: Memory113c, pGame: number, nQuestNo: number): number {
  if (pGame === 0) return 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  const target = nQuestNo >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) >>> 0) === target) {
      return pQuest
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  return 0
}

function findPlayerRelationNodeInList113c(
  m: Memory113c,
  pPlayerData: number,
  pOwnerUnit: number,
  pTargetUnit: number,
): number {
  const targetGuid = pTargetUnit !== 0 ? m.u32((pTargetUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
  if ((pOwnerUnit >>> 0) === (pTargetUnit >>> 0)) return 0
  if (pPlayerData === 0) return 0
  let pNode = m.u32((pPlayerData + 0x38) >>> 0) >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) >>> 0) === targetGuid) {
      return pNode
    }
    pNode = m.u32((pNode + 0x10) >>> 0) >>> 0
  }
  return 0
}

/**
 * Deducts up to `nAmount` (`eax`) from signed 32-bit pool `*pPool` (`[edx]`):
 * - When `nAmount <= *pPool`, subtracts `nAmount` in place and returns `0`.
 * - When `nAmount > *pPool`, zeroes `*pPool = 0` and returns `(nAmount - oldPool) | 0`.
 *
 * @va D2Game:0x6FC645E0
 */
export function SKILLS_DeductFromStatPool113c(
  m: Memory113c,
  nAmount: number,
  pPool: number,
): number {
  const addr = pPool >>> 0
  const cur = m.u32(addr) | 0
  const amt = nAmount | 0
  if (amt <= cur) {
    m.setU32(addr, ((cur - amt) | 0) >>> 0)
    return 0
  }
  m.setU32(addr, 0)
  return (amt - cur) | 0
}

/**
 * Checks whether preset monster `nClassId` (`eax`) may spawn accompanying pack minions:
 * validates `0 <= nClassId < sgptDataTables->nMonStatsTxtRecordCount` (`+0xA80`, normalizing
 * out-of-range IDs to `-1`), and returns `0` for `0xE5` (`229`), `0x11C..0x120` (`284..288`),
 * and `0x188..0x189` (`392..393`), or `1` otherwise.
 *
 * @va D2Game:0x6FC66D90
 */
export function REGPOP_CanSpawnPresetMinionPack113c(
  m: Memory113c,
  nClassId: number,
): number {
  let id = nClassId | 0
  if (id >= 0) {
    const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)
    const pDataTables = m.u32(pSgptPtr)
    const nMonStatsCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
    if (id >= nMonStatsCount) {
      id = -1
    }
  } else {
    id = -1
  }
  const idx = (id - 0xe5) >>> 0
  if (idx > 0xa4) {
    return 1
  }
  if (id === 0xe5 || (id >= 0x11c && id <= 0x120) || id === 0x188 || id === 0x189) {
    return 0
  }
  return 1
}

/**
 * Remaps directional wall/trap preset monster `nClassId` (`eax`) according to preset orientation
 * `nOrientation` (`edi`) and `MonStatsTxt[nClassId].wBaseId` (`+0x02`):
 * - `wBaseId == 0x3A` (`58`): `6, 7 -> 0x3B` (`59`); `12, 16 -> 0x3C` (`60`) (or `-1` if `nMonStatsCount` is too small).
 * - `wBaseId == 0x13` (`19`): `6 -> 0x14` (`20`); `7, 12, 16 -> 0x15` (`21`) (or `-1` if `nMonStatsCount` is too small).
 * - Otherwise returns `nClassId` unchanged.
 *
 * @va D2Game:0x6FC66E80
 */
export function REGPOP_RemapDirectionalMonsterClassId113c(
  m: Memory113c,
  nClassId: number,
  nOrientation: number,
): number {
  const id = nClassId | 0
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)
  let baseId = id
  if (id >= 0) {
    const pDataTables = m.u32(pSgptPtr)
    const nMonStatsCount0 = m.u32((pDataTables + 0xa80) >>> 0) | 0
    if (id < nMonStatsCount0) {
      const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
      const pRec = (pMonStatsBase + imul32(id, 0x1a8)) >>> 0
      if (pRec !== 0) {
        baseId = sx16(m.u16((pRec + 0x02) >>> 0))
      }
    }
  }
  if (baseId < 0) {
    return id
  }
  const pDataTables2 = m.u32(pSgptPtr)
  const nMonStatsCount = m.u32((pDataTables2 + 0xa80) >>> 0) | 0
  if (baseId >= nMonStatsCount) {
    return id
  }
  const orientIdx = ((nOrientation | 0) - 6) >>> 0
  if (baseId === 0x13) {
    if (orientIdx > 0x0a) return id
    if (orientIdx === 0) {
      return nMonStatsCount > 0x14 ? 0x14 : -1
    }
    if (orientIdx === 1 || orientIdx === 6 || orientIdx === 10) {
      return nMonStatsCount > 0x15 ? 0x15 : -1
    }
    return id
  }
  if (baseId === 0x3a) {
    if (orientIdx > 0x0a) return id
    if (orientIdx === 0 || orientIdx === 1) {
      return nMonStatsCount > 0x3b ? 0x3b : -1
    }
    if (orientIdx === 6 || orientIdx === 10) {
      return nMonStatsCount > 0x3c ? 0x3c : -1
    }
    return id
  }
  return id
}

/**
 * Walks the singly-linked NPC interaction list at `[pInteract + 0x00]` (`eax = pInteract`,
 * next pointer at `+0x08`) and returns `1` if any node has `pPlayerUnit != 0` (`[pNode + 0x00]`),
 * or `0` otherwise.
 *
 * @va D2Game:0x6FC68370
 */
export function MONSTER_HasAnyInteractingPlayer113c(
  m: Memory113c,
  pInteract: number,
): number {
  if (pInteract === 0) return 0
  let pNode = m.u32(pInteract >>> 0) >>> 0
  while (pNode !== 0) {
    if (m.u32(pNode) !== 0) {
      return 1
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  return 0
}

/**
 * Counts how many nodes in the singly-linked NPC interaction list at `[pInteract + 0x00]`
 * (`ecx = pInteract`, next pointer at `+0x08`) have a non-NULL `pPlayerUnit` (`[pNode + 0x00]`).
 *
 * @va D2Game:0x6FC68390
 */
export function MONSTER_CountInteractingPlayers113c(
  m: Memory113c,
  pInteract: number,
): number {
  if (pInteract === 0) return 0
  let pNode = m.u32(pInteract >>> 0) >>> 0
  let count = 0
  while (pNode !== 0) {
    if (m.u32(pNode) !== 0) {
      count = (count + 1) | 0
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  return count
}

/**
 * Checks `pMonster`'s (`eax`) NPC interaction list (`pMonsterData + 0x30`) for `pPlayer` (`edx`):
 * - Returns `0` if `pMonster` is NULL, not `UNIT_MONSTER (1)`, lacks `pMonsterData`, or lacks `pInteract`.
 * - Returns `(pNode->nInteractState >= 1) ? 1 : 0` (signed `+0x04`) when `pPlayer` is found,
 *   or `1` if `pPlayer` is not in the interaction list.
 *
 * @va D2Game:0x6FC684F0
 */
export function MONSTER_CheckPlayerInteractUnlocked113c(
  m: Memory113c,
  pMonster: number,
  pPlayer: number,
): number {
  const pInteract = getMonsterInteractPtr113c(m, pMonster)
  if (pInteract === 0) return 0
  let pNode = m.u32(pInteract) >>> 0
  const targetPlayer = pPlayer >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) >>> 0) === targetPlayer) {
      const state = m.u32((pNode + 0x04) >>> 0) | 0
      return state >= 1 ? 1 : 0
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  return 1
}

/**
 * Returns `1` if `pPlayer` (`ecx`) has an active interaction node on `pMonster` (`eax`)
 * whose `nInteractState` (`+0x04`) equals `2` (trade/gamble open), or `0` otherwise.
 *
 * @va D2Game:0x6FC686D0
 */
export function MONSTER_IsPlayerInteractInTradeState113c(
  m: Memory113c,
  pMonster: number,
  pPlayer: number,
): number {
  const pInteract = getMonsterInteractPtr113c(m, pMonster)
  if (pInteract === 0) return 0
  let pNode = m.u32(pInteract) >>> 0
  const targetPlayer = pPlayer >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) >>> 0) === targetPlayer) {
      return (m.u32((pNode + 0x04) >>> 0) >>> 0) === 2 ? 1 : 0
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  return 0
}

/**
 * Searches `pMonster`'s (`eax`) NPC interaction list for `pPlayer` (`ecx`) and promotes
 * `pNode->nInteractState` (`+0x04`) from `1` to `2` when `pNode->nInteractState == 1`.
 *
 * @va D2Game:0x6FC68710
 */
export function MONSTER_PromotePlayerInteractToTradeState113c(
  m: Memory113c,
  pMonster: number,
  pPlayer: number,
): void {
  const pInteract = getMonsterInteractPtr113c(m, pMonster)
  if (pInteract === 0) return
  let pNode = m.u32(pInteract) >>> 0
  const targetPlayer = pPlayer >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) >>> 0) === targetPlayer) {
      if ((m.u32((pNode + 0x04) >>> 0) >>> 0) === 1) {
        m.setU32((pNode + 0x04) >>> 0, 2)
      }
      return
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
}

/**
 * Records last interaction target `(nInteractType, dwTargetGuid)` into `pMonsterData + 0x38 / +0x34`
 * (`esi = pMonster`, `ebx = nInteractType`, `[esp+4] = dwTargetGuid`, `ret 0x4`) when `pMonster` is
 * `UNIT_MONSTER (1)`, `nInteractType < 5` (signed), and `MonStatsTxt.dwFlags` bit `0x10` is set.
 *
 * @va D2Game:0x6FC68750
 */
export function MONSTER_SetLastInteractTarget113c(
  m: Memory113c,
  pMonster: number,
  nInteractType: number,
  dwTargetGuid: number,
): number {
  if (pMonster === 0) return 0
  const dwUnitType = m.u32(pMonster >>> 0) >>> 0
  if (dwUnitType !== 1) return 0
  if ((nInteractType | 0) >= 5) return 0
  const nClassId = m.u32((pMonster + 0x04) >>> 0) | 0
  if (MONSTATS_CheckFlagBit113c(m, nClassId, 0x10) === 0) return 0
  const pMonsterData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return 0
  m.setU32((pMonsterData + 0x38) >>> 0, nInteractType >>> 0)
  m.setU32((pMonsterData + 0x34) >>> 0, dwTargetGuid >>> 0)
  return 1
}

/**
 * Updates the character progression title field (`bits 8..12`) in `pClient->wClientFlags` (`+0x0A`,
 * `esi = pClient`, `edx = nDifficulty`, `edi = nActProgression`), using `4` acts/difficulty for
 * Classic (`(flags & 0x20) == 0`) or `5` acts/difficulty for Expansion (`(flags & 0x20) != 0`).
 *
 * @va D2Game:0x6FC6A2D0
 */
export function CLIENTS_UpdateCharacterProgression113c(
  m: Memory113c,
  pClient: number,
  nDifficulty: number,
  nActProgression: number,
): void {
  if (pClient === 0) return
  const flagsAddr = (pClient + 0x0a) >>> 0
  const wFlags0 = m.u16(flagsAddr)
  const actsPerDiff = (((wFlags0 & 0x20) | 0x80) >>> 5) | 0
  const targetProg = (imul32(actsPerDiff, nDifficulty | 0) + (nActProgression | 0)) | 0
  const curProg = (wFlags0 >>> 8) & 0x1f
  if (targetProg < curProg) return
  const wFlags1 = m.u16(flagsAddr)
  const updated = ((imul32(nDifficulty | 0, actsPerDiff) + (nActProgression | 0)) << 8) | (wFlags1 & 0xe0ff)
  m.setU16(flagsAddr, updated & 0xffff)
}

/**
 * Looks up `DATATBLS_GetMonLvlTxtRecord113c(nLevelByte & 0xFF)` (`al = nLevelByte`, `esi = nValue`)
 * and returns signed `nValue / pMonLvlTxt->dwField1C` (`+0x1C`) when non-zero, else `nValue`.
 *
 * @va D2Game:0x6FC6DF60
 */
export function SKILLS_DivideValueByMonLvlHp113c(
  m: Memory113c,
  nLevelByte: number,
  nValue: number,
): number {
  const val = nValue | 0
  const pMonLvl = DATATBLS_GetMonLvlTxtRecord113c(m, nLevelByte & 0xff) >>> 0
  if (pMonLvl === 0) return val
  const divisor = m.u32((pMonLvl + 0x1c) >>> 0) | 0
  if (divisor === 0) return val
  return sdiv32(val, divisor)
}

/**
 * Returns `1` if `nStateId` (`eax`) is `0x17` (`23`, Dim Vision) or `0x38` (`56`, Terror), else `0`.
 *
 * @va D2Game:0x6FC6DF80
 */
export function SKILLS_IsDimVisionOrTerrorState113c(
  _m: Memory113c,
  nStateId: number,
): number {
  const id = nStateId | 0
  if (id === 0x17) return 1
  return id === 0x38 ? 1 : 0
}

/**
 * `Skills.txt` `SrvStFunc = 18` start-phase handler (`0x6FD27380`): unconditionally returns `1`
 * (`edx = pGame`, `ecx = pUnit`, `[esp+4] = nSkillId`, `[esp+8] = nSkillLevel`, `ret 0x8`).
 *
 * @va D2Game:0x6FC6DFD0
 */
export function SKILLS_SrvSt18_ReturnOne113c(
  _m: Memory113c,
  _pGame: number,
  _pUnit: number,
  _nSkillId: number,
  _nSkillLevel: number,
): number {
  return 1
}

/**
 * Populates Necromancer Skeleton / Skeletal Mage visual component bytes on `pMonster` (`ecx`)
 * from `0x6FD2D8C0[min(nTier, 10)]` (`eax = nTier`, `edi = pOwnerUnit`, `[esp+4] = bHasShield`,
 * `[esp+8] = bIsMage`, `ret 0x8`). When `bIsMage != 0`, steps `pOwnerUnit->pSeed` (`+0x20/+0x24`),
 * assigns `elem = newLo & 3` to `pMonsterData + 0x0F` and `+0x10`, and initializes
 * `pMonsterData->pAiGeneral` (`+0x28`) fields `+0x14 = 1`, `+0x18 = 0`.
 *
 * @va D2Game:0x6FC6E390
 */
export function SKILLS_SetNecroSkeletonComponents113c(
  m: Memory113c,
  nTier: number,
  pMonster: number,
  pOwnerUnit: number,
  bHasShield: number,
  bIsMage: number,
): void {
  let tier = nTier | 0
  if (tier > 10) {
    tier = 10
  }

  writeMonsterDataByteIfMonster113c(m, pMonster, 0x04, readSkeletonCompByte113c(m, tier, 0))
  writeMonsterDataByteIfMonster113c(m, pMonster, 0x05, readSkeletonCompByte113c(m, tier, 2))
  writeMonsterDataByteIfMonster113c(m, pMonster, 0x0c, readSkeletonCompByte113c(m, tier, 3))
  writeMonsterDataByteIfMonster113c(m, pMonster, 0x0d, readSkeletonCompByte113c(m, tier, 4))
  writeMonsterDataByteIfMonster113c(m, pMonster, 0x06, readSkeletonCompByte113c(m, tier, 5))
  writeMonsterDataByteIfMonster113c(m, pMonster, 0x07, readSkeletonCompByte113c(m, tier, 6))
  writeMonsterDataByteIfMonster113c(m, pMonster, 0x08, readSkeletonCompByte113c(m, tier, 7))

  if ((bHasShield | 0) !== 0) {
    writeMonsterDataByteIfMonster113c(m, pMonster, 0x0b, readSkeletonCompByte113c(m, tier, 1))
  }

  if ((bIsMage | 0) !== 0) {
    const seed: D2SeedStrc = {
      lo: m.u32((pOwnerUnit + 0x20) >>> 0),
      hi: m.u32((pOwnerUnit + 0x24) >>> 0),
    }
    const nextLo = seedNext(seed) >>> 0
    m.setU32((pOwnerUnit + 0x20) >>> 0, seed.lo)
    m.setU32((pOwnerUnit + 0x24) >>> 0, seed.hi)
    const elem = nextLo & 3
    if (pMonster === 0) return
    writeMonsterDataByteIfMonster113c(m, pMonster, 0x0f, elem)
    writeMonsterDataByteIfMonster113c(m, pMonster, 0x10, elem)
    if (m.u32(pMonster >>> 0) === 1) {
      const pMonsterData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      if (pMonsterData !== 0) {
        const pAiGeneral = m.u32((pMonsterData + 0x28) >>> 0) >>> 0
        if (pAiGeneral !== 0) {
          m.setU32((pAiGeneral + 0x14) >>> 0, 1)
          m.setU32((pAiGeneral + 0x18) >>> 0, 0)
        }
      }
    }
    return
  }

  writeMonsterDataByteIfMonster113c(m, pMonster, 0x09, readSkeletonCompByte113c(m, tier, 8))
}

/**
 * Checks whether `pOwner` (`esi`) can target its own minion `pTarget` (`eax`) with skill `nSkillId`
 * (`ecx`): verifies `SkillsTxt[nSkillId]` byte `+0x07` bit `1` (`0x02`) via `gdwBitMasks[1]` and
 * matches `pTarget->pMonsterData->pAiGeneral` owner `(dwOwnerType == 0, dwOwnerId == pOwner->dwUnitId)`.
 *
 * @va D2Game:0x6FD00210
 */
export function SUNIT_CanTargetOwnPetWithSkill113c(
  m: Memory113c,
  pOwner: number,
  pTarget: number,
  nSkillId: number,
): number {
  if (pOwner === 0 || pTarget === 0) return 0
  if (m.u32(pOwner >>> 0) !== 0 && m.u32(pTarget >>> 0) !== 1) return 0

  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)
  const pDataTables = m.u32(pSgptPtr)
  const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (skillId >= nSkillsCount) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsRec = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsRec === 0) return 0

  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
  const flagByte = m.u8((pSkillsRec + 0x07) >>> 0)
  const maskByte = m.u8((pMasks + 0x04) >>> 0)
  if ((flagByte & maskByte) === 0) return 0

  if (m.u32(pTarget >>> 0) !== 1) return 0
  const pMonsterData = m.u32((pTarget + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return 0
  const pAiGeneral = m.u32((pMonsterData + 0x28) >>> 0) >>> 0
  if (pAiGeneral === 0 || m.u32((pAiGeneral + 0x28) >>> 0) === 0) return 0

  const outOwnerId = m.u32((pAiGeneral + 0x2c) >>> 0) >>> 0
  const outOwnerType = m.u32((pAiGeneral + 0x30) >>> 0) >>> 0
  if (outOwnerType !== 0) return 0
  return outOwnerId === (m.u32((pOwner + 0x0c) >>> 0) >>> 0) ? 1 : 0
}

/**
 * Resolves `pUnit`'s (`eax`) owner unit in `pGame` (`[esp+4]`, `ret 0x4`) when
 * `pUnit->dwFlagEx` (`+0xC8`) bit `10` (`0x0400`) is set, via `SUNIT_GetServerUnit113c`
 * on `(pUnit->dwOwnerType (+0x94), pUnit->dwOwnerId (+0x98))`.
 *
 * @va D2Game:0x6FD00A20
 */
export function SUNIT_GetOwnerUnit113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): number {
  if (pUnit === 0) return 0
  const hasOwner = (m.u32((pUnit + 0xc8) >>> 0) >>> 10) & 1
  if (hasOwner === 0) return 0
  const dwOwnerId = m.u32((pUnit + 0x98) >>> 0)
  const dwOwnerType = m.u32((pUnit + 0x94) >>> 0)
  return SUNIT_GetServerUnit113c(m, pGame, dwOwnerType, dwOwnerId)
}

/**
 * Act 3 Quest 0 `pfActiveFilter` (`+0xEC` in `0x6FD05920`): unconditionally returns `0` (`ret 0xC`).
 *
 * @va D2Game:0x6FD028A0
 */
export function ACT3Q0_ActiveFilter113c(
  _m: Memory113c,
  _pQuest: number,
  _nNpcId: number,
  _pPlayer: number,
  _pQuestFlags: number,
  _pNpcUnit: number,
): number {
  return 0
}

/**
 * Act 3 Quest 0 `pfStatusFilter` (`+0xE8` in `0x6FD05920`): unconditionally returns `0` (`ret 0xC`).
 *
 * @va D2Game:0x6FD028B0
 */
export function ACT3Q0_StatusFilter113c(
  _m: Memory113c,
  _pQuest: number,
  _pPlayer: number,
  _pGlobalFlags: number,
  _pPlayerFlags: number,
  _pOutStatus: number,
): number {
  return 0
}

/**
 * Act 3 Quest 6 (The Guardian / Mephisto, `dwQuestNo = 0x16`) `pfActiveFilter` (`+0xEC`):
 * returns `1` if quest `0x16` state `0` is clear, `nNpcId == 0xFF`, and `pQuest->bLastState (+0x0C) == 1`;
 * otherwise returns `1` iff quest `0x16` state `0x0B` is set (`ret 0xC`).
 *
 * @va D2Game:0x6FD028C0
 */
export function ACT3Q6_MephistoActiveFilter113c(
  m: Memory113c,
  pQuest: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit: number,
): number {
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0) === 0) {
    if ((nNpcId | 0) === 0xff && m.u8((pQuest + 0x0c) >>> 0) === 1) {
      return 1
    }
  }
  return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0b) !== 0 ? 1 : 0
}

/**
 * Checks whether entering Durance of Hate is blocked for `pUnit` (`[esp+4]`) in `pGame` (`eax`, `ret 0x4`):
 * returns `0` when `pUnit`'s room is in level `0x65` (`101`, Durance of Hate Level 2) or quest `0x13` is
 * absent; otherwise returns `1` iff `pQuest13->pQuestDataEx[+0x0C] == 0`.
 *
 * @va D2Game:0x6FD02900
 */
export function ACT3Q5_IsDuranceEntryBlocked113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  const pQuest13 = findQuestNodeInGame113c(m, pGame, 0x13)
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (pRoom !== 0) {
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
    if (nLevelId === 0x65) {
      return 0
    }
  }
  if (pQuest13 === 0) {
    return 0
  }
  const pQuestDataEx = m.u32((pQuest13 + 0x18) >>> 0) >>> 0
  return m.u8((pQuestDataEx + 0x0c) >>> 0) === 0 ? 1 : 0
}

/**
 * Checks whether the Compelling Orb in quest `0x13` is still intact in `pGame` (`eax`):
 * returns `1` if quest `0x13` is absent or `pQuest13->pQuestDataEx[+0x0C] == 0`, else `0`.
 *
 * @va D2Game:0x6FD02960
 */
export function ACT3Q5_IsCompellingOrbIntact113c(
  m: Memory113c,
  pGame: number,
): number {
  const pQuest13 = findQuestNodeInGame113c(m, pGame, 0x13)
  if (pQuest13 === 0) {
    return 1
  }
  const pQuestDataEx = m.u32((pQuest13 + 0x18) >>> 0) >>> 0
  return m.u8((pQuestDataEx + 0x0c) >>> 0) === 0 ? 1 : 0
}

/**
 * Act 3 Quest 5 (The Blackened Temple, `dwQuestNo = 0x15`) `pfActiveFilter` (`+0xEC`, `ret 0xC`):
 * returns `0` if quest `0x15` state `0` is set; for Ormus (`0xFF`) returns `pQuest->bLastState == 1`;
 * for Cain (`0xF5`) returns `1` iff quest `0x15` state `4` is set and `pQuestDataEx[+0x0C] == 0`.
 *
 * @va D2Game:0x6FD02AB0
 */
export function ACT3Q5_BlackenedTempleActiveFilter113c(
  m: Memory113c,
  pQuest: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit: number,
): number {
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0) !== 0) {
    return 0
  }
  const npc = nNpcId | 0
  if (npc === 0xff) {
    return m.u8((pQuest + 0x0c) >>> 0) === 1 ? 1 : 0
  }
  if (npc !== 0xf5) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 4) === 0) {
    return 0
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  return m.u8((pQuestDataEx + 0x0c) >>> 0) === 0 ? 1 : 0
}

/**
 * Clears `pQuest12->pQuestDataEx[+0x00] = 0` on quest node `0x12` in `pGame` (`eax`).
 *
 * @va D2Game:0x6FD02B10
 */
export function ACT3Q4_ClearOrmusNpcWaitFlag113c(
  m: Memory113c,
  pGame: number,
): void {
  const pQuest12 = findQuestNodeInGame113c(m, pGame, 0x12)
  if (pQuest12 === 0) return
  const pQuestDataEx = m.u32((pQuest12 + 0x18) >>> 0) >>> 0
  m.setU8(pQuestDataEx, 0)
}

/**
 * Returns `1` iff quest node `0x12` exists in `pGame` (`eax`) and `pQuest12->pQuestDataEx[+0x00] != 0`.
 *
 * @va D2Game:0x6FD02B40
 */
export function ACT3Q4_CheckOrmusNpcWaitFlag113c(
  m: Memory113c,
  pGame: number,
): number {
  const pQuest12 = findQuestNodeInGame113c(m, pGame, 0x12)
  if (pQuest12 === 0) return 0
  const pQuestDataEx = m.u32((pQuest12 + 0x18) >>> 0) >>> 0
  return m.u8(pQuestDataEx) !== 0 ? 1 : 0
}

/**
 * Copies Hratli target coordinates `(dwX, dwY)` from `pQuest11->pQuestDataEx + 0x10 / +0x14`
 * into `[pOutCoords + 0x00 / +0x04]` (`eax = pGame`, `ecx = pOutCoords`) and returns `1`
 * when quest node `0x11` exists and `pQuestDataEx[+0x06] != 0`, else `0`.
 *
 * @va D2Game:0x6FD02C40
 */
export function ACT3Q1_GetHratliTargetCoords113c(
  m: Memory113c,
  pGame: number,
  pOutCoords: number,
): number {
  const pQuest11 = findQuestNodeInGame113c(m, pGame, 0x11)
  if (pQuest11 === 0) return 0
  const pQuestDataEx = m.u32((pQuest11 + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x06) >>> 0) === 0) return 0
  const outAddr = pOutCoords >>> 0
  m.setU32(outAddr, m.u32((pQuestDataEx + 0x10) >>> 0))
  m.setU32((outAddr + 0x04) >>> 0, m.u32((pQuestDataEx + 0x14) >>> 0))
  return 1
}

/**
 * Returns `pQuest11->pQuestDataEx[+0x04]` (`uint8`) for quest node `0x11` in `pGame` (`eax`),
 * or `0` if quest node `0x11` is not present.
 *
 * @va D2Game:0x6FD02CD0
 */
export function ACT3Q1_GetQuestDataByte04_113c(
  m: Memory113c,
  pGame: number,
): number {
  const pQuest11 = findQuestNodeInGame113c(m, pGame, 0x11)
  if (pQuest11 === 0) return 0
  const pQuestDataEx = m.u32((pQuest11 + 0x18) >>> 0) >>> 0
  return m.u8((pQuestDataEx + 0x04) >>> 0)
}

/**
 * Adds `nDelta` (`[esp+4]`, `ret 0x4`) to `pQuest10->pQuestDataEx[+0x1C]` and sets
 * `pQuestDataEx[+0x27] = 1` on quest node `0x10` in `pGame` (`eax`).
 *
 * @va D2Game:0x6FD02DB0
 */
export function ACT3Q2_AddQuestDataCount1C_113c(
  m: Memory113c,
  pGame: number,
  nDelta: number,
): void {
  const pQuest10 = findQuestNodeInGame113c(m, pGame, 0x10)
  if (pQuest10 === 0) return
  const pQuestDataEx = m.u32((pQuest10 + 0x18) >>> 0) >>> 0
  const updated = ((m.u32((pQuestDataEx + 0x1c) >>> 0) | 0) + (nDelta | 0)) >>> 0
  m.setU8((pQuestDataEx + 0x27) >>> 0, 1)
  m.setU32((pQuestDataEx + 0x1c) >>> 0, updated)
}

/**
 * Act 3 Quest 7 `pfCallback11` (`+0xC8` in `0x6FD07CE0`): single-byte `ret` no-op.
 *
 * @va D2Game:0x6FD02EF0
 */
export function ACT3Q7_Callback11_Noop113c(
  _m: Memory113c,
  _pQuest: number,
  _pQuestArg: number,
): void {}

/**
 * Act 3 Hratli intro (`dwQuestNo = 0x10` in `0x6FD06660`) `pfActiveFilter` (`+0xEC`, `ret 0xC`):
 * returns `1` iff `nNpcId == 0xFD` (`253`, Hratli) and quest `0x10` state `0` is clear.
 *
 * @va D2Game:0x6FD03000
 */
export function ACT3Q1_HratliIntroActiveFilter113c(
  m: Memory113c,
  _pQuest: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit: number,
): number {
  if ((nNpcId | 0) !== 0xfd) return 0
  return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x10, 0) === 0 ? 1 : 0
}

/**
 * Act 3 Hratli intro (`0x6FD06660`) `pfStatusFilter` (`+0xE8`, `ret 0xC`): returns `0`.
 *
 * @va D2Game:0x6FD03030
 */
export function ACT3Q1_HratliIntroStatusFilter113c(
  _m: Memory113c,
  _pQuest: number,
  _pPlayer: number,
  _pGlobalFlags: number,
  _pPlayerFlags: number,
  _pOutStatus: number,
): number {
  return 0
}

/**
 * Act 3 Dark Wanderer (`0x6FD06700`, `dwQuestNo = 0x2A`) `pfStatusFilter` (`+0xE8`, `ret 0xC`):
 * writes `*pOutStatus = 0` and returns `0`.
 *
 * @va D2Game:0x6FD03040
 */
export function ACT3Q2_DarkWandererStatusFilter113c(
  m: Memory113c,
  _pQuest: number,
  _pPlayer: number,
  _pGlobalFlags: number,
  _pPlayerFlags: number,
  pOutStatus: number,
): number {
  m.setU8(pOutStatus >>> 0, 0)
  return 0
}

/**
 * Player iteration callback (`0x6FCFFCC0`: `ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * when `pPlayer` is in Act 3 (`actNo == 2`) and quest `0x20` state `0` is clear, sets quest `0x20` state `0`.
 *
 * @va D2Game:0x6FD030C0
 */
export function ACT3Q0_MarkWandererSeenCallback113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x20, 0) === 0) {
    const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
    if (pRoom !== 0) {
      const pRoom2 = UNITS_GetRoom113c(m, pPlayer) >>> 0
      const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom2) | 0
      if (nLevelId !== 0) {
        const actNo = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
        if (actNo === 2) {
          QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x20, 0)
        }
      }
    }
  }
  return 0
}

/**
 * Party iteration callback (`0x6FCBC160`: `ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * for party members in Act 3 (`actNo == 2`) who do not yet have quest `0x15` state `0` or `4` set,
 * sets quest `0x15` state `0` (if quest `0x12` state `0` is set) or `4` (otherwise), plus state `0x0D`.
 *
 * @va D2Game:0x6FD037D0
 */
export function ACT3Q5_CompleteCouncilPartyCallback113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): void {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 4) === 1) return
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) return
  const actNo = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (actNo !== 2) return
  const nPrimaryState = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0) !== 0 ? 0 : 4
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, nPrimaryState)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 0x0d)
}

/**
 * Player iteration callback (`0x6FCFFCC0`: `ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * when quest `0x15` state `0` is not `1` on `pPlayer` and quest node `0x13` exists in `pGame`,
 * sets quest `0x15` state `2` if `pQuest13->bLastState` (`+0x0C`) is `2..3`, and state `3` if
 * `pQuest13->pQuestDataEx[+0x05] != 0`.
 *
 * @va D2Game:0x6FD03A80
 */
export function ACT3Q5_SyncCouncilQuestFlagsCallback113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0) === 1) return 0
  const pQuest13 = findQuestNodeInGame113c(m, pGame, 0x13)
  if (pQuest13 === 0) return 0
  const bState = m.u8((pQuest13 + 0x0c) >>> 0)
  if (bState >= 2 && bState <= 3) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 2)
  }
  const pQuestDataEx = m.u32((pQuest13 + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x05) >>> 0) !== 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 3)
  }
  return 0
}

/**
 * Marks the Lam Esen's Tome quest unit (`pUnit` in `ecx`) as deactivated on `pQuest` (`eax`):
 * when `pQuest->pQuestDataEx[+0x02] == 1` and `pQuestDataEx->dwUnitGuid (+0x04)` matches
 * `pUnit ? pUnit->dwUnitId : 0xFFFFFFFF`, clears `+0x02 = 0` and sets `+0x01 = 1`.
 *
 * @va D2Game:0x6FD03B00
 */
export function ACT3Q4_OnQuestUnitDeactivate113c(
  m: Memory113c,
  pQuest: number,
  pUnit: number,
): void {
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x02) >>> 0) !== 1) return
  const unitGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
  if ((m.u32((pQuestDataEx + 0x04) >>> 0) >>> 0) === unitGuid) {
    m.setU8((pQuestDataEx + 0x02) >>> 0, 0)
    m.setU8((pQuestDataEx + 0x01) >>> 0, 1)
  }
}

/**
 * Party iteration callback (`0x6FCBC160`: `ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * looks up quest node `0x12` in `pGame` and, if quest `0x14` states `0` and `1` are both `0` on `pPlayer`,
 * sets quest `0x14` state `pQuest12->pQuestDataEx->nCompletionState` (`+0x18`).
 *
 * @va D2Game:0x6FD03C70
 */
export function ACT3Q4_SyncTomePartyQuestStateCallback113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): void {
  const pQuest12 = findQuestNodeInGame113c(m, pGame, 0x12)
  if (pQuest12 === 0) return
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0) !== 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 1) !== 0) return
  const pQuestDataEx = m.u32((pQuest12 + 0x18) >>> 0) >>> 0
  const nState = m.u32((pQuestDataEx + 0x18) >>> 0) | 0
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x14, nState)
}

/**
 * Updates Khalim relic item counters on quest node `0x10` when `pPlayer` (`eax`) transmutes
 * Khalim's Will (`"qf2 "`) in `pGame` (`ecx`): decrements `pQuestDataEx` dwords `+0x10`, `+0x18`,
 * `+0x14`, and `+0x1C` by `1` and increments `+0x20` by `1`.
 *
 * @va D2Game:0x6FD04900
 */
export function ACT3Q3_OnKhalimsWillCubed113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): void {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0) === 0) {
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 1)
  }
  const pQuest10 = findQuestNodeInGame113c(m, pGame, 0x10)
  if (pQuest10 === 0) return
  const pQuestDataEx = m.u32((pQuest10 + 0x18) >>> 0) >>> 0
  const c10 = ((m.u32((pQuestDataEx + 0x10) >>> 0) | 0) - 1) >>> 0
  const c18 = ((m.u32((pQuestDataEx + 0x18) >>> 0) | 0) - 1) >>> 0
  const c14 = ((m.u32((pQuestDataEx + 0x14) >>> 0) | 0) - 1) >>> 0
  const c1c = ((m.u32((pQuestDataEx + 0x1c) >>> 0) | 0) - 1) >>> 0
  m.setU32((pQuestDataEx + 0x10) >>> 0, c10)
  const c20 = ((m.u32((pQuestDataEx + 0x20) >>> 0) | 0) + 1) >>> 0
  m.setU32((pQuestDataEx + 0x18) >>> 0, c18)
  m.setU32((pQuestDataEx + 0x14) >>> 0, c14)
  m.setU32((pQuestDataEx + 0x1c) >>> 0, c1c)
  m.setU32((pQuestDataEx + 0x20) >>> 0, c20)
}

/**
 * Act 3 Quest 7 (`0x6FD07CE0`) `pfCallback14` (`+0xD4`, `ecx = pQuest`, `edx = pQuestArg`):
 * if quest `0x12` state `0` is clear on `pQuestArg->pPlayer` (`+0x0C`), promotes `pQuest + 0x0C = 2`
 * and `pQuest + 0x0B = 7` when quest `0x12` state `7` or `2` is set or the sum of the four relic
 * counters at `pQuest->pQuestDataEx + 0x10..+0x1C` is non-zero.
 *
 * @va D2Game:0x6FD049E0
 */
export function ACT3Q7_Callback14_PlayerJoined113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0) !== 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 7) !== 0) {
    m.setU8((pQuest + 0x0c) >>> 0, 2)
    m.setU8((pQuest + 0x0b) >>> 0, 7)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 2) !== 0) {
    m.setU8((pQuest + 0x0c) >>> 0, 2)
    m.setU8((pQuest + 0x0b) >>> 0, 7)
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const c18 = m.u32((pQuestDataEx + 0x18) >>> 0) | 0
  const c1c = m.u32((pQuestDataEx + 0x1c) >>> 0) | 0
  const c14 = m.u32((pQuestDataEx + 0x14) >>> 0) | 0
  const c10 = m.u32((pQuestDataEx + 0x10) >>> 0) | 0
  const sum = (((c1c + c18) | 0) + c14 + c10) | 0
  if (sum !== 0) {
    m.setU8((pQuest + 0x0c) >>> 0, 2)
    m.setU8((pQuest + 0x0b) >>> 0, 7)
  }
}

/**
 * Builds the 6-byte `0x5D` quest state notification packet `[0x5D, 0x10, pQuest->bByte14, nSubState, 0, 0]`
 * (`eax = pQuest`, `dl = nSubState`, `[esp+4] = pQuestArg`, `ret 0x4`) and queues it to
 * `pQuestArg->pPlayer->pPlayerData->pNetClient` (`+0x9C`) via `NET_QueuePacketToClientBuffer113c`.
 *
 * @va D2Game:0x6FD04A50
 */
export function ACT3Q7_SendQuestUpdatePacket5D_113c(
  m: Memory113c,
  pQuest: number,
  nSubState: number,
  pQuestArg: number,
): void {
  const bQuestByte14 = m.u8((pQuest + 0x14) >>> 0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  let pClient = 0
  if (pPlayer !== 0 && m.u32(pPlayer) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  const savedSp = k2SunitSpawnStackPtr
  const pPkt = savedSp
  k2SunitSpawnStackPtr = (savedSp + 8) >>> 0
  try {
    m.setU8(pPkt, 0x5d)
    m.setU8((pPkt + 1) >>> 0, 0x10)
    m.setU8((pPkt + 2) >>> 0, bQuestByte14)
    m.setU8((pPkt + 3) >>> 0, nSubState & 0xff)
    m.setU16((pPkt + 4) >>> 0, 0)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 6)
  } finally {
    k2SunitSpawnStackPtr = savedSp
  }
}

/**
 * Player iteration callback (`0x6FCFFCC0`: `ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * sets quest `0x11` (Gidbinn) state `0x0E` when states `0` and `1` are both not `1`.
 *
 * @va D2Game:0x6FD05230
 */
export function ACT3Q6_SetGidbinnState0ECallback113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0) === 1) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 1) === 1) return 0
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x11, 0x0e)
  return 0
}

/**
 * Player iteration callback (`0x6FCFFCC0`: `ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * when quest `0x11` states `0` and `1` are both not `1` and quest node `0x0F` in `pGame` has
 * `bLastState` (`+0x0C`) equal to `2` or `3`, sets quest `0x11` state `2`.
 *
 * @va D2Game:0x6FD05370
 */
export function ACT3Q6_SyncGidbinnState02Callback113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0) === 1) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 1) === 1) return 0
  const pQuest0F = findQuestNodeInGame113c(m, pGame, 0x0f)
  if (pQuest0F === 0) return 0
  const bState = m.u8((pQuest0F + 0x0c) >>> 0)
  if (bState === 2 || bState === 3) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x11, 2)
  }
  return 0
}

/**
 * Walks `pOwnerUnit->pPlayerData->pPlayerRelation` (`+0x38`, next at `+0x10`) for `pTargetUnit`
 * (`edi = pOwnerUnit`, `esi = pTargetUnit`, matching `pTargetUnit ? pTargetUnit->dwUnitId : 0xFFFFFFFF`)
 * and returns the `D2PlrRelationStrc*` node pointer, or `0` when `pOwnerUnit == pTargetUnit` or absent.
 *
 * @va D2Game:0x6FD10060
 */
export function PARTY_FindPlayerRelationNode113c(
  m: Memory113c,
  pOwnerUnit: number,
  pTargetUnit: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pOwnerUnit) >>> 0
  return findPlayerRelationNodeInList113c(m, pPlayerData, pOwnerUnit, pTargetUnit)
}

/**
 * Returns the hostility toggle cooldown tick (`uint32`) for `(pOwnerUnit, pTargetUnit)`
 * (`edi = pOwnerUnit`, `esi = pTargetUnit`):
 * - When `pTargetUnit == 0` and `pPlayerData != 0`, returns `pPlayerData->dwHostileDelayTick` (`+0x160`).
 * - Otherwise locates `pTargetUnit`'s relation node on `pPlayerData + 0x38` and returns `pNode->dwHostileTick` (`+0x08`), or `0`.
 *
 * @va D2Game:0x6FD100E0
 */
export function PARTY_GetHostileCooldownTick113c(
  m: Memory113c,
  pOwnerUnit: number,
  pTargetUnit: number,
): number {
  if ((pTargetUnit >>> 0) === 0) {
    const pPlayerData0 = UNITS_GetPlayerData113c(m, pOwnerUnit) >>> 0
    if (pPlayerData0 !== 0) {
      return m.u32((pPlayerData0 + 0x160) >>> 0) >>> 0
    }
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pOwnerUnit) >>> 0
  const pNode = findPlayerRelationNodeInList113c(m, pPlayerData, pOwnerUnit, pTargetUnit)
  if (pNode === 0) return 0
  return m.u32((pNode + 0x08) >>> 0) >>> 0
}

/**
 * Returns the 16-bit party relation state (`uint16`) between `pOwnerUnit` (`edi`) and `pTargetUnit` (`esi`):
 * - Returns `1` when `pOwnerUnit == pTargetUnit`.
 * - Returns `pNode->wRelationState` (`+0x0C`) when a relation node exists on `pPlayerData + 0x38`, else `0`.
 *
 * @va D2Game:0x6FD101D0
 */
export function PARTY_GetPlayerRelationState113c(
  m: Memory113c,
  pOwnerUnit: number,
  pTargetUnit: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pOwnerUnit) >>> 0
  const pNode = findPlayerRelationNodeInList113c(m, pPlayerData, pOwnerUnit, pTargetUnit)
  if ((pOwnerUnit >>> 0) === (pTargetUnit >>> 0)) return 1
  if (pNode === 0) return 0
  return m.u16((pNode + 0x0c) >>> 0)
}

/**
 * Masks `pNode->dwRelationFlags` (`+0x04`) with `dwFlagMask` (`[esp+4]`, `ret 0x4`) for
 * `(pOwnerUnit, pTargetUnit)` (`edi = pOwnerUnit`, `esi = pTargetUnit`), returning `0` when
 * `pOwnerUnit == pTargetUnit` or no matching relation node exists.
 *
 * @va D2Game:0x6FD102A0
 */
export function PARTY_TestPlayerRelationFlags113c(
  m: Memory113c,
  pOwnerUnit: number,
  pTargetUnit: number,
  dwFlagMask: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pOwnerUnit) >>> 0
  const pNode = findPlayerRelationNodeInList113c(m, pPlayerData, pOwnerUnit, pTargetUnit)
  if ((pOwnerUnit >>> 0) === (pTargetUnit >>> 0) || pNode === 0) return 0
  return (m.u32((pNode + 0x04) >>> 0) & dwFlagMask) >>> 0
}

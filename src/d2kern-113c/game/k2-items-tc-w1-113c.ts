/**
 * Diablo II v1.13c `D2Game.dll` Core & Combat Pipeline (`[K2]` Wave 1 Lane A):
 * 45 `ITEMS`, `AI`, `AIGENERAL`, `MONUMOD`, `GAME`, `OBJECTS`, `QUESTS`, `SUNIT`, and `PLAYER`
 * functions (`0x6FC331E0 .. 0x6FC57940`, image base `0x6FC20000`).
 *
 * Every exported function is a 1:1 binary-isomorphic `Memory113c` port of the exact
 * `objdump -d -M intel` instruction stream of `D2Game.dll` v1.13c, with zero array
 * ordering helpers, zero nullish coalescing, zero Node/DOM globals, and zero cross-layer imports.
 */
import { UNITS_GetField7C_113c, UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon.ts'
import { imul32 } from '../common/int-math.ts'
import { INVENTORY_GetCursorItem113c } from '../common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetMagicPrefix113c,
  ITEMS_GetMagicSuffix113c,
} from '../common/items.ts'
import { DATATBLS_GetItemsTxtRecordMemPort113c } from '../common/k0-d2common-memports.ts'
import { QUESTRECORD_CopyRecordToBuffer113c } from '../common/quest-record.ts'
import { SKILLS_GetSkillById113c } from '../common/skills.ts'
import { TEXT_AddNodeToTextList113c } from '../common/text.ts'
import { DATATBLS_GetObjectsTxtRecord113c, UNITS_GetRoom113c } from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  DATATBLS_GetMagicAffixTxtRecord113c,
  DATATBLS_GetQualityItemsTxtRecordCountPtr113c,
  MONSTERS_IsDead113c,
} from '../tables/datatbls-113c.ts'
import { QUESTS_GuidListRemove113c } from './a1c-post150-f150-f276-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS_CheckFlagBit113c,
} from './regpop-spawn-113c.ts'

/** `D2Game.dll` `.rdata` `0x6FD1CEE8`: Shadow Master init `(nSkillSlot, dwParam)` 2-entry table (`{2, 0}, {4, 0}`). */
export const D2GAME_SHADOW_MASTER_INIT_SLOTS_VA_113C = 0x6fd1cee8

/** `D2Game.dll` `.data` `0x6FD2E354`: global deterministic `-seed` override dword (`D2Game.#10017`). */
export const D2GAME_GLOBAL_SEED_OVERRIDE_VA_113C = 0x6fd2e354

/** `D2Game.dll` `.data` `0x6FD2E550`: `monUModTable[0..42]` (`uint32[43]`). */
export const D2GAME_MONUMOD_TABLE_VA_113C = 0x6fd2e550

/** `D2Game.dll` `.data` `0x6FD2F448`: `monUModCallbackMatrixTable[0..42][0..5]` (`43 * 24` bytes). */
export const D2GAME_MONUMOD_CALLBACK_MATRIX_VA_113C = 0x6fd2f448

/** Isolated reentrant scratch stack pointer for outbound packet assembly on `Memory113c`. */
let k2ItemsTcW1StackPtr = 0x7ed00000

/** Optional callback hooks for indirect function table entries not yet in kernel closure. */
export interface K2ItemsTcW1Hooks113c {
  readonly onMonUMod?: (
    m: Memory113c,
    pfn: number,
    pUnit: number,
    nUModId: number,
    bBoss: number,
  ) => void
  readonly onMonUModMatrixCallback?: (
    m: Memory113c,
    pfn: number,
    pGame: number,
    pTargetOrMonster: number,
    nUModId: number,
    bBoss: number,
  ) => void
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function stepSeed64At113c(m: Memory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, newHi)
  m.setU32(pSeed >>> 0, newLo)
  return newLo
}

/**
 * Exact 1.13c `D2Game 0x6FC468E0` (`ecx = pGame`, `edx = pMonster`, `[esp+4] = pTarget`, `[esp+8] = nSlot`)
 * `monUModCallbackMatrixTable` (`0x6FD2F448`) dispatcher invoked by `0x6FC41880` (`nSlot = 5`) and `0x6FC469B0` (`nSlot = 2`).
 */
function dispatchMonUModMatrix6FC468E0(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pTarget: number,
  nSlot: number,
  hooks?: K2ItemsTcW1Hooks113c,
): void {
  let bBoss = 0
  if (pMonster !== 0 && (m.u32(pMonster >>> 0) >>> 0) === 1) {
    const pMonData0 = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData0 !== 0) {
      bBoss = (m.u8((pMonData0 + 0x16) >>> 0) >>> 3) & 1
    }
  }
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pUMods = (pMonData + 0x1c) >>> 0
  if (pUMods === 0) return
  if (m.u8(pUMods) === 0) return

  if ((nSlot | 0) === 5) {
    for (let i = 0; i < 9; i++) {
      const uMod = m.u8((pUMods + i) >>> 0)
      const pfn = m.u32((0x6fd2f45c + uMod * 24) >>> 0) >>> 0
      if (pfn !== 0 && hooks !== undefined && hooks.onMonUModMatrixCallback !== undefined) {
        hooks.onMonUModMatrixCallback(m, pfn, pGame >>> 0, pTarget >>> 0, uMod, bBoss)
      }
    }
    return
  }

  for (let i = 0; i < 9; i++) {
    const uMod = m.u8((pUMods + i) >>> 0)
    const idx = ((uMod * 6 + (nSlot | 0)) << 2) >>> 0
    const pfn = m.u32((D2GAME_MONUMOD_CALLBACK_MATRIX_VA_113C + idx) >>> 0) >>> 0
    if (pfn !== 0 && hooks !== undefined && hooks.onMonUModMatrixCallback !== undefined) {
      hooks.onMonUModMatrixCallback(m, pfn, pGame >>> 0, pMonster >>> 0, uMod, bBoss)
    }
  }
}

/**
 * Exact 1.13c `D2Game 0x6FCAA3E0` (`eax = pClient`, `[esp+4] = pPacket`, `[esp+8] = nSize`, `ret 8`)
 * S2C `0x208`-byte `D2PacketDataStrc` queue append (`+0x1B8` head, `+0x1BC` tail, `+0x1C0` free list).
 */
function queuePacketToClient6FCAA3E0(
  m: Memory113c,
  pClient: number,
  pPacket: number,
  nSize: number,
): void {
  if (pClient === 0) return
  const len = nSize | 0
  let pNode = m.u32((pClient + 0x1bc) >>> 0) >>> 0
  let curLen = pNode !== 0 ? (m.u32(pNode) | 0) : 0
  if (((curLen + len) | 0) > 0x200 || pNode === 0) {
    const pFree = m.u32((pClient + 0x1c0) >>> 0) >>> 0
    if (pFree !== 0) {
      const pNextFree = m.u32((pFree + 0x204) >>> 0) >>> 0
      m.setU32((pClient + 0x1c0) >>> 0, pNextFree)
      pNode = pFree
    } else {
      pNode = m.alloc(0x208) >>> 0
    }
    m.fill(pNode, 0x208, 0)
    const pPrevTail = m.u32((pClient + 0x1bc) >>> 0) >>> 0
    if (pPrevTail === 0) {
      m.setU32((pClient + 0x1b8) >>> 0, pNode)
    } else {
      m.setU32((pPrevTail + 0x204) >>> 0, pNode)
    }
    m.setU32((pClient + 0x1bc) >>> 0, pNode)
    curLen = 0
  }
  const dstBase = (pNode + 4 + curLen) >>> 0
  for (let i = 0; i < len; i++) {
    m.setU8((dstBase + i) >>> 0, m.u8((pPacket + i) >>> 0))
  }
  m.setU32(pNode, ((m.u32(pNode) | 0) + len) >>> 0)
}

// ============================================================================
// 1. ITEMS (`0x6FC331E0 .. 0x6FC332A0`)
// ============================================================================

/**
 * Checks whether `pItem` (`edi`) already carries any magic prefix (`0..2`) or magic suffix (`0..2`)
 * whose `MagicAffixTxt.dwGroup` (`+0x5C`) equals `dwAffixGroup` (`ebx`).
 * Note: per `0x6FC331F5` / `0x6FC33216`, a `NULL` `DATATBLS_GetMagicAffixTxtRecord` breaks out of the
 * respective prefix/suffix loop immediately.
 *
 * @va D2Game:0x6FC331E0
 */
export function ITEMS_HasAffixGroupOnItem113c(
  m: Memory113c,
  pItem: number,
  dwAffixGroup: number,
): number {
  const targetGroup = dwAffixGroup >>> 0
  for (let i = 0; i < 3; i++) {
    const wPrefix = ITEMS_GetMagicPrefix113c(m, pItem, i) & 0xffff
    const pAffixTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, wPrefix) >>> 0
    if (pAffixTxt === 0) {
      break
    }
    if ((m.u32((pAffixTxt + 0x5c) >>> 0) >>> 0) === targetGroup) {
      return 1
    }
  }
  for (let i = 0; i < 3; i++) {
    const wSuffix = ITEMS_GetMagicSuffix113c(m, pItem, i) & 0xffff
    const pAffixTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, wSuffix) >>> 0
    if (pAffixTxt === 0) {
      return 0
    }
    if ((m.u32((pAffixTxt + 0x5c) >>> 0) >>> 0) === targetGroup) {
      return 1
    }
  }
  return 0
}

/**
 * Computes `max(nMinValue, trunc32(imul32(nValue, nPercent) / 100))` (`eax = nValue`, `esi = nMinValue`,
 * `[esp+4] = nPercent`, `ret 4`) via exact signed 64-bit magic reciprocal `0x51EB851F`.
 *
 * @va D2Game:0x6FC33230
 */
export function ITEMS_ScaleStatByPercentWithMin113c(
  m: Memory113c,
  nValue: number,
  nMinValue: number,
  nPercent: number,
): number {
  void m
  const prod32 = imul32(nValue | 0, nPercent | 0)
  const hi = Number((BigInt(prod32 | 0) * 0x51eb851fn) >> 32n) | 0
  const scaled = ((hi >> 5) + (hi >>> 31)) | 0
  const floorVal = nMinValue | 0
  return scaled < floorVal ? floorVal : scaled
}

/**
 * Scans `QualityItemsTxt` (`DATATBLS_GetQualityItemsTxtRecordCountPtr113c`, stride `0x20`) for the first
 * record matching `ItemsTxt[pItem->dwClassId].dwCode` (`+0x80`) against `+0x18` (when `bCheckField18 != 0`)
 * or `+0x1C` (when `bCheckField18 == 0`), returning the record index (`0..nCount-1`), `nCount` if not found
 * or `ItemsTxt == NULL`, or `-1` if the table descriptor pointer is `NULL` (`eax = pItem`, `ebx = bCheckField18`).
 *
 * @va D2Game:0x6FC332A0
 */
export function ITEMS_FindSuperiorQualityRecordIndex113c(
  m: Memory113c,
  pItem: number,
  bCheckField18: number,
): number {
  const pCountDesc = DATATBLS_GetQualityItemsTxtRecordCountPtr113c(m) >>> 0
  const nClassId = pItem === 0 ? -1 : m.u32((pItem + 0x04) >>> 0) | 0
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nClassId) >>> 0
  if (pCountDesc === 0) {
    return -1
  }
  if (pItemsTxt === 0) {
    return m.u32(pCountDesc) | 0
  }
  const pTable = m.u32((pCountDesc + 0x04) >>> 0) >>> 0
  if (pTable === 0) {
    return m.u32(pCountDesc) | 0
  }
  const nCount = m.u32(pCountDesc) | 0
  if (nCount <= 0) {
    return nCount
  }
  let pField1C = (pTable + 0x1c) >>> 0
  for (let idx = 0; idx < nCount; idx++) {
    const dwCode = m.u32((pItemsTxt + 0x80) >>> 0) >>> 0
    const dwCand =
      bCheckField18 !== 0 ? m.u32((pField1C - 0x04) >>> 0) >>> 0 : m.u32(pField1C) >>> 0
    if (dwCode === dwCand) {
      return idx >= 0 ? idx : nCount
    }
    pField1C = (pField1C + 0x20) >>> 0
  }
  return nCount
}

// ============================================================================
// 2. MONSTER & PET AI INIT / SUMMONER HELPERS (`0x6FC35520 .. 0x6FC35730`)
// ============================================================================

/**
 * `gpMonsterAiFunctionTable[59].pfnAiInit` (`ecx = pGame`, `edx = pMonster`, `[esp+4] = pAiTickParam`, `ret 4`):
 * zeroes `pAiTickParam->pAiControl->dwAiParam3` (`+0x1C`).
 *
 * @va D2Game:0x6FC35520
 */
export function AI_InitMonsterClearAiParam3_113c(
  m: Memory113c,
  _pGame: number,
  _pMonster: number,
  pAiTickParam: number,
): void {
  const pAiCtrl = m.u32(pAiTickParam >>> 0) >>> 0
  m.setU32((pAiCtrl + 0x1c) >>> 0, 0)
}

/**
 * `gpMonsterAiFunctionTable[122].pfnAiInit` (`ecx = pGame`, `edx = pMonster`, `[esp+4] = pAiTickParam`, `ret 4`):
 * sets `pAiTickParam->pAiControl->dwAiState` (`+0x14`) to `-1` (`0xFFFFFFFF`).
 *
 * @va D2Game:0x6FC35530
 */
export function AI_InitMonsterResetAiStateNeg1_113c(
  m: Memory113c,
  _pGame: number,
  _pMonster: number,
  pAiTickParam: number,
): void {
  const pAiCtrl = m.u32(pAiTickParam >>> 0) >>> 0
  m.setU32((pAiCtrl + 0x14) >>> 0, 0xffffffff)
}

/**
 * `gpMonsterAiFunctionTable[129].pfnAiInit` (`ecx = pGame`, `edx = pMonster`, `[esp+4] = pAiTickParam`, `ret 4`):
 * initializes `pAiControl->dwAiState (+0x14) = pGame->dwGameFrame (+0xA8)`, `+0x18 = 0`, and `+0x3C = -1`.
 *
 * @va D2Game:0x6FC35540
 */
export function AI_InitBaalMinionSpawnState113c(
  m: Memory113c,
  pGame: number,
  _pMonster: number,
  pAiTickParam: number,
): void {
  const pAiCtrl1 = m.u32(pAiTickParam >>> 0) >>> 0
  const dwFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
  m.setU32((pAiCtrl1 + 0x14) >>> 0, dwFrame)
  m.setU32((pAiCtrl1 + 0x18) >>> 0, 0)
  const pAiCtrl2 = m.u32(pAiTickParam >>> 0) >>> 0
  m.setU32((pAiCtrl2 + 0x3c) >>> 0, 0xffffffff)
}

/**
 * Minion-list callback (`ecx = pMinion`, `edx = pOutHasDead`, `[esp+4] = _dwUnused`, `ret 4`):
 * sets `*pOutHasDead = 1` when `pMinion == NULL` or `MONSTERS_IsDead113c(pMinion) != 0`.
 *
 * @va D2Game:0x6FC35570
 */
export function AI_CheckAnyMinionDeadCallback113c(
  m: Memory113c,
  pMinion: number,
  pOutHasDead: number,
  _dwUnused = 0,
): void {
  if (pMinion === 0 || MONSTERS_IsDead113c(m, pMinion) !== 0) {
    m.setU32(pOutHasDead >>> 0, 1)
  }
}

/**
 * `gpHirelingAndPetAiFunctionTable[16].pfnAiInit` (`ecx = pGame`, `edx = pMonster`, `[esp+4] = pAiTickParam`, `ret 4`):
 * steps `pMonster->tSeed` (`+0x20`), probes the two Shadow Master skill-slot pairs at `0x6FD1CEE8`
 * (`(newLo & 1)` toggled modulo 2), and stores `(dwSlot, dwExtra)` (or `(0, 0)` if neither skill exists)
 * into `pAiControl + 0x18` and `pAiControl + 0x1C`.
 *
 * @va D2Game:0x6FC355C0
 */
export function AI_InitShadowMasterSkillSlot113c(
  m: Memory113c,
  _pGame: number,
  pMonster: number,
  pAiTickParam: number,
): void {
  const newLo = stepSeed64At113c(m, (pMonster + 0x20) >>> 0)
  let edi = newLo & 1
  for (let attempt = 0; attempt < 2; attempt++) {
    edi = (edi + 1) & 1
    const nSlot = m.u32((D2GAME_SHADOW_MASTER_INIT_SLOTS_VA_113C + edi * 8) >>> 0) | 0
    const pMonStats = m.u32((pAiTickParam + 0x1c) >>> 0) >>> 0
    const nSkillId = sx16(m.u16((pMonStats + nSlot * 2 + 0x170) >>> 0))
    const pSkill = SKILLS_GetSkillById113c(m, pMonster, nSkillId, -1) >>> 0
    if (pSkill !== 0) {
      const pAiCtrl1 = m.u32(pAiTickParam >>> 0) >>> 0
      const dwVal18 = m.u32((D2GAME_SHADOW_MASTER_INIT_SLOTS_VA_113C + edi * 8) >>> 0) >>> 0
      m.setU32((pAiCtrl1 + 0x18) >>> 0, dwVal18)
      const dwVal1C = m.u32((D2GAME_SHADOW_MASTER_INIT_SLOTS_VA_113C + 4 + edi * 8) >>> 0) >>> 0
      const pAiCtrl2 = m.u32(pAiTickParam >>> 0) >>> 0
      m.setU32((pAiCtrl2 + 0x1c) >>> 0, dwVal1C)
      return
    }
  }
  const pAiCtrl1 = m.u32(pAiTickParam >>> 0) >>> 0
  m.setU32((pAiCtrl1 + 0x18) >>> 0, 0)
  const pAiCtrl2 = m.u32(pAiTickParam >>> 0) >>> 0
  m.setU32((pAiCtrl2 + 0x1c) >>> 0, 0)
}

/**
 * `gpMonsterAiFunctionTable[84].pfnAiInit` (`ecx = pGame`, `edx = pMonster`, `[esp+4] = pAiTickParam`, `ret 4`):
 * when `pMonStatsTxt != NULL` and `wSkill[0] (+0x170) > 0`, sets `pAiControl->dwAiState (+0x14)` to
 * `pGame->dwGameFrame (+0xA8) + SkillsTxt[wSkill0].dwDelay (+0x14C)` (or `+ 0` if `wSkill0` is out of bounds).
 *
 * @va D2Game:0x6FC356C0
 */
export function AI_InitMonsterSkillDelayFrame113c(
  m: Memory113c,
  pGame: number,
  _pMonster: number,
  pAiTickParam: number,
): void {
  const pAiCtrl = m.u32(pAiTickParam >>> 0) >>> 0
  const pMonStats = m.u32((pAiTickParam + 0x1c) >>> 0) >>> 0
  if (pMonStats === 0) return
  const wSkill0 = sx16(m.u16((pMonStats + 0x170) >>> 0))
  if (wSkill0 <= 0) return

  let nDelay = 0
  if (wSkill0 >= 0) {
    const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
    const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
    if (wSkill0 < nSkillsCount) {
      const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
      const pSkillTxt = (pSkillsBase + imul32(wSkill0, 0x23c)) >>> 0
      if (pSkillTxt !== 0) {
        nDelay = m.u32((pSkillTxt + 0x14c) >>> 0) | 0
      }
    }
  }
  const dwFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  m.setU32((pAiCtrl + 0x14) >>> 0, (dwFrame + nDelay) >>> 0)
}

/**
 * Selects a spawnable monster class ID from `pGame->pMonReg[nAct]` (`+0xF0 + nAct * 4`, stride `0x34` at `+0x14`)
 * that has `MonStatsTxt` flag bit `0x15` (`21`), falling back to a linear scan of the `pMonReg` table or
 * class ID `0x1F0` (`496`, clamped to `-1` if `nMonStatsCount <= 0x1F0`), writing `*pOutClassId` and returning `1`
 * (`ecx = pMonster`, `[esp+4] = pGame`, `[esp+8] = pOutClassId`, `ret 8`).
 *
 * @va D2Game:0x6FC35730
 */
export function AI_SelectBaalThroneSpawnClassId113c(
  m: Memory113c,
  pMonster: number,
  pGame: number,
  pOutClassId: number,
): number {
  let pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables0 = m.u32(pSgptPtr) >>> 0
  const nMonCount0 = m.u32((pDataTables0 + 0xa80) >>> 0) | 0
  const initFallback = nMonCount0 > 0x1c5 ? 0x1c5 : -1
  m.setU32(pOutClassId >>> 0, initFallback >>> 0)

  let nActIdx = 0
  if (pMonster !== 0 && (m.u32(pMonster >>> 0) >>> 0) === 1) {
    const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      nActIdx = m.u32((pMonData + 0x58) >>> 0) >>> 0
    }
  }

  const pMonReg = m.u32((pGame + ((nActIdx << 2) >>> 0) + 0xf0) >>> 0) >>> 0
  const nEntries = m.u8((pMonReg + 0x10) >>> 0)
  let rollIdx = 0
  if (nEntries > 0) {
    const newLo = stepSeed64At113c(m, (pMonster + 0x20) >>> 0)
    if ((nEntries & (nEntries - 1)) !== 0) {
      rollIdx = ((newLo >>> 0) % (nEntries >>> 0)) >>> 0
    } else {
      rollIdx = (newLo & (nEntries - 1)) >>> 0
    }
    pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  }

  const nPickedId = sx16(m.u16((pMonReg + imul32(rollIdx | 0, 0x34) + 0x14) >>> 0))
  if (nPickedId >= 0) {
    const pDataTables1 = m.u32(pSgptPtr) >>> 0
    if (nPickedId < (m.u32((pDataTables1 + 0xa80) >>> 0) | 0)) {
      if (MONSTATS_CheckFlagBit113c(m, nPickedId, 0x15) !== 0) {
        m.setU32(pOutClassId >>> 0, nPickedId >>> 0)
        return 1
      }
    }
  }

  const nScanCount = m.u8((pMonReg + 0x10) >>> 0)
  let pEntry = (pMonReg + 0x14) >>> 0
  for (let i = 0; i < nScanCount; i++) {
    const nCandId = sx16(m.u16(pEntry))
    if (nCandId >= 0) {
      const pDT = m.u32(pSgptPtr) >>> 0
      if (nCandId < (m.u32((pDT + 0xa80) >>> 0) | 0)) {
        const pMonStatsBase = m.u32((pDT + 0xa78) >>> 0) >>> 0
        const pRec = (pMonStatsBase + imul32(nCandId, 0x1a8)) >>> 0
        if (pRec !== 0) {
          const bFlags2 = m.u8((pRec + 0x0e) >>> 0)
          const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
          const dwMask = m.u32((pMasks + 0x14) >>> 0) >>> 0
          if ((bFlags2 & dwMask) !== 0) {
            m.setU32(pOutClassId >>> 0, nCandId >>> 0)
            return 1
          }
        }
      }
    }
    pEntry = (pEntry + 0x34) >>> 0
  }

  const pDTFinal = m.u32(pSgptPtr) >>> 0
  const nMonCountFinal = m.u32((pDTFinal + 0xa80) >>> 0) | 0
  const finalFallback = nMonCountFinal > 0x1f0 ? 0x1f0 : -1
  m.setU32(pOutClassId >>> 0, finalFallback >>> 0)
  return 1
}

// ============================================================================
// 3. AIGENERAL & MONUMOD (`0x6FC40C60 .. 0x6FC469B0`)
// ============================================================================

/**
 * Returns `AIGENERAL_GetAiGeneralFromUnit(pUnit)->dwField3C` (`ecx = pUnit`, plain `ret`).
 * Preserves the exact binary behavior (`mov eax, [eax + 0x3C]` on `pAiGeneral == 0` when `pUnit` is not a monster).
 *
 * @va D2Game:0x6FC40C60
 */
export function AIGENERAL_GetField3C_113c(m: Memory113c, pUnit: number): number {
  let pAiGeneral = 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
    }
  }
  return m.u32((pAiGeneral + 0x3c) >>> 0) >>> 0
}

/**
 * Returns `&AIGENERAL_GetAiGeneralFromUnit(pUnit)->pQuestData` (`+0x38`, i.e. `0x38` when `pAiGeneral == 0`;
 * `eax = pUnit`, plain `ret`).
 *
 * @va D2Game:0x6FC40DE0
 */
export function AIGENERAL_GetQuestDataPtr38_113c(m: Memory113c, pUnit: number): number {
  let pAiGeneral = 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
    }
  }
  return (pAiGeneral + 0x38) >>> 0
}

/**
 * Minion UMod broadcast callback (`ecx = pMinion`, `edx = nUModId`, `[esp+4] = bBoss`, `ret 4`):
 * looks up `pfn = monUModTable[nUModId]` (`0x6FD2E550 + nUModId * 4`) and invokes `pfn(pMinion, nUModId, bBoss)`
 * when non-NULL (natively dispatching `0x6FC43020` for `nUModId == 1`).
 *
 * @va D2Game:0x6FC41840
 */
export function MONUMOD_ApplyToMinionCallback113c(
  m: Memory113c,
  pMinion: number,
  nUModId: number,
  bBoss: number,
  hooks?: K2ItemsTcW1Hooks113c,
): void {
  const pfn = m.u32((D2GAME_MONUMOD_TABLE_VA_113C + imul32(nUModId | 0, 4)) >>> 0) >>> 0
  if (pfn === 0) return
  if (pfn === 0x6fc43020) {
    MONUMOD_RollBossOrMinionNameSeed113c(m, pMinion, nUModId, bBoss)
    return
  }
  if (hooks !== undefined && hooks.onMonUMod !== undefined) {
    hooks.onMonUMod(m, pfn, pMinion, nUModId, bBoss)
  }
}

/**
 * Counts active non-zero UMod bytes in `pUModBytes` (`uint8[9]`, `ecx = pUModBytes`, plain `ret`),
 * stopping at the first `0` byte or capping at `9`.
 *
 * @va D2Game:0x6FC41860
 */
export function MONUMOD_CountUnitUMods113c(m: Memory113c, pUModBytes: number): number {
  let count = 0
  let ptr = pUModBytes >>> 0
  while (m.u8(ptr) !== 0) {
    ptr = (ptr + 1) >>> 0
    count++
    if (count >= 9) {
      return 9
    }
  }
  return count
}

/**
 * Dispatches `monUModCallbackMatrixTable` column `5` (`onKill` / target event) for `pMonster` (`edx`)
 * against `pTarget` (`eax`) when `pMonster` is a valid monster (`dwUnitType == 1`) and `pTarget != NULL`
 * (`[esp+4] = pGame`, `ret 4`).
 *
 * @va D2Game:0x6FC41880
 */
export function MONUMOD_DispatchOnKillEvent5_113c(
  m: Memory113c,
  pTarget: number,
  pMonster: number,
  pGame: number,
  hooks?: K2ItemsTcW1Hooks113c,
): void {
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  if (pTarget === 0) return
  dispatchMonUModMatrix6FC468E0(m, pGame, pMonster, pTarget, 5, hooks)
}

/**
 * Resolves the minion monster class ID (`MonStatsTxt.wMinion[0]` at `+0x26`) for boss `pUnit` (`eax`),
 * returning `-1` if `pUnit == NULL`, `wMinion[0]` when in `[0, nMonStatsCount)`, or `pUnit->dwClassId` otherwise.
 *
 * @va D2Game:0x6FC41F60
 */
export function MONUMOD_GetMinionClassIdForBoss113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return -1
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  if (nClassId < 0) return nClassId
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  const nMonCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
  if (nClassId >= nMonCount) return nClassId
  const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
  const pRec = (pMonStatsBase + imul32(nClassId, 0x1a8)) >>> 0
  if (pRec === 0) return nClassId
  const wMinion0 = sx16(m.u16((pRec + 0x26) >>> 0))
  if (wMinion0 < 0 || wMinion0 >= nMonCount) return nClassId
  return wMinion0
}

/**
 * Reads `MonUModTxt[nConstIndex].dwConstants` (`+0x1C`, stride `0x20` from `sgptDataTables + 0xC50`,
 * count at `+0xC54`; `eax = nConstIndex`, plain `ret`), returning `0` when out of bounds or unallocated.
 *
 * @va D2Game:0x6FC41FB0
 */
export function MONUMOD_GetConstantValue113c(m: Memory113c, nConstIndex: number): number {
  const idx = nConstIndex | 0
  if (idx < 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  const nCount = m.u32((pDataTables + 0xc54) >>> 0) | 0
  if (idx >= nCount) return 0
  const pBase = m.u32((pDataTables + 0xc50) >>> 0) >>> 0
  const pRec = (pBase + ((idx << 5) >>> 0)) >>> 0
  if (pRec === 0) return 0
  return m.u32((pRec + 0x1c) >>> 0) | 0
}

/**
 * Appends `nUModId` (`uint8`, `[esp+4]`) to the first free (`0`) slot in `pMonster->pMonsterData->nMonUMod[0..8]`
 * (`+0x1C`, `eax = pMonster`, `ret 4`).
 *
 * @va D2Game:0x6FC42920
 */
export function MONUMOD_AppendUModToMonster113c(
  m: Memory113c,
  pMonster: number,
  nUModId: number,
): void {
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  for (let i = 0; i < 9; i++) {
    if (m.u8((pMonData + 0x1c + i) >>> 0) === 0) {
      m.setU8((pMonData + 0x1c + i) >>> 0, nUModId & 0xff)
      return
    }
  }
}

/**
 * Sets `pMonster->pMonsterData->wSuperUniqueId` (`+0x26`) to `wSuperUniqueId` (`eax = pMonster`,
 * `[esp+4] = wSuperUniqueId`, `ret 4`).
 *
 * @va D2Game:0x6FC42A10
 */
export function MONUMOD_SetSuperUniqueId113c(
  m: Memory113c,
  pMonster: number,
  wSuperUniqueId: number,
): void {
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  m.setU16((pMonData + 0x26) >>> 0, wSuperUniqueId & 0xffff)
}

/**
 * Returns `&pMonster->pMonsterData->nMonUMod[0]` (`pMonData + 0x1C`) when `pMonster` is a valid monster
 * with non-NULL `pMonsterData`, or `0` otherwise (`eax = pMonster`, plain `ret`).
 *
 * @va D2Game:0x6FC42AF0
 */
export function MONUMOD_GetUModListPtr113c(m: Memory113c, pMonster: number): number {
  if (pMonster === 0) return 0
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return 0
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return 0
  return (pMonData + 0x1c) >>> 0
}

/**
 * `monUModTable[1]` (`0x6FD2E554`, `MONUMOD_RNDNAME`, `ecx = pMonster`, `edx = _nUModId`, `[esp+4] = bBoss`, `ret 4`):
 * when `pMonster != NULL` and `bBoss != 0`, steps `pMonster->tSeed` (`+0x20`) and stores the low 16 bits into
 * `pMonster->pMonsterData->wNameSeed` (`+0x14`).
 *
 * @va D2Game:0x6FC43020
 */
export function MONUMOD_RollBossOrMinionNameSeed113c(
  m: Memory113c,
  pMonster: number,
  _nUModId: number,
  bBoss: number,
): void {
  if (pMonster === 0) return
  if ((bBoss | 0) === 0) return
  const newLo = stepSeed64At113c(m, (pMonster + 0x20) >>> 0)
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  m.setU16((pMonData + 0x14) >>> 0, newLo & 0xffff)
}

/**
 * Copies minion-eligible UMods (`MonUModTxt.fMin != 0` at `+0x07`) from boss `pBoss` (`eax`) onto minion
 * `pMinion` (`ecx`), appending after existing UMods when `bOverwrite == 0` (`[esp+4]`, `ret 4`).
 *
 * @va D2Game:0x6FC43060
 */
export function MONUMOD_CopyMinionEligibleUMods113c(
  m: Memory113c,
  pBoss: number,
  pMinion: number,
  bOverwrite: number,
): void {
  let pSrc = 0
  if (pBoss !== 0 && (m.u32(pBoss >>> 0) >>> 0) === 1) {
    const pBossData = m.u32((pBoss + 0x14) >>> 0) >>> 0
    if (pBossData !== 0) {
      pSrc = (pBossData + 0x1c) >>> 0
    }
  }
  let pDst = 0
  if (pMinion !== 0 && (m.u32(pMinion >>> 0) >>> 0) === 1) {
    const pMinionData = m.u32((pMinion + 0x14) >>> 0) >>> 0
    if (pMinionData !== 0) {
      pDst = (pMinionData + 0x1c) >>> 0
    }
  }
  if (pSrc === 0 || pDst === 0) return

  let esi = 0
  if ((bOverwrite | 0) === 0) {
    esi = 9
    for (let k = 0; k < 9; k++) {
      if (m.u8((pDst + k) >>> 0) === 0) {
        esi = k
        break
      }
    }
  }
  let edi = (pDst + esi) >>> 0
  if (esi >= 9) return

  let ebp = pSrc
  while (esi < 9) {
    const uMod = m.u8(ebp)
    if (uMod === 0) break
    const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
    const nCount = m.u32((pDataTables + 0xc54) >>> 0) | 0
    if (uMod >= nCount) break
    const pBase = m.u32((pDataTables + 0xc50) >>> 0) >>> 0
    const pRec = (pBase + ((uMod << 5) >>> 0)) >>> 0
    if (pRec === 0) break
    if (m.u8((pRec + 0x07) >>> 0) !== 0) {
      m.setU8(edi, uMod)
      edi = (edi + 1) >>> 0
    }
    ebp = (ebp + 1) >>> 0
    esi++
  }
}

/**
 * Increments `pGame->pMonReg[nAct]->dwUniqueCount` (`+0x2C8`) if `pMonster` does not yet have boss flag `0x08`
 * (`pMonsterData + 0x16`), and sets `pMonsterData->nTypeFlags |= 0x08` (`eax = pMonster`, `esi = pGame`, plain `ret`).
 *
 * @va D2Game:0x6FC43260
 */
export function MONUMOD_MarkBossAndIncrementUniqueCount113c(
  m: Memory113c,
  pMonster: number,
  pGame: number,
): void {
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  const pMonData0 = m.u32((pMonster + 0x14) >>> 0) >>> 0
  const nActIdx = pMonData0 !== 0 ? m.u32((pMonData0 + 0x58) >>> 0) >>> 0 : 0
  const pMonReg = m.u32((pGame + ((nActIdx << 2) >>> 0) + 0xf0) >>> 0) >>> 0
  if (pMonReg !== 0) {
    const pMonData1 = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData1 === 0 || (m.u8((pMonData1 + 0x16) >>> 0) & 0x08) === 0) {
      m.setU32((pMonReg + 0x2c8) >>> 0, (m.u32((pMonReg + 0x2c8) >>> 0) + 1) >>> 0)
    }
  }
  if ((m.u32(pMonster >>> 0) >>> 0) === 1) {
    const pMonData2 = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData2 !== 0) {
      m.setU8((pMonData2 + 0x16) >>> 0, (m.u8((pMonData2 + 0x16) >>> 0) | 0x08) & 0xff)
    }
  }
}

/**
 * `monsterEventFunctionsTable[7]` (`0x6FD1BC30`, `ecx = pGame`, `edx = pMonster`, `[esp+4] = dwArg14`,
 * `[esp+8] = dwArg18`, `ret 8`): overwrites stack args with `(0, 2)` and tail-jumps to `0x6FC468E0`
 * (`monUModCallbackMatrixTable` column `2`).
 *
 * @va D2Game:0x6FC469B0
 */
export function MONSTER_Event7_MonUModEvent2_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  _dwArg14 = 0,
  _dwArg18 = 0,
  hooks?: K2ItemsTcW1Hooks113c,
): void {
  dispatchMonUModMatrix6FC468E0(m, pGame, pMonster, 0, 2, hooks)
}

// ============================================================================
// 4. GAME & OBJECTS (`0x6FC4A0C0 .. 0x6FC4E9F0`)
// ============================================================================

/**
 * Callback for `CLIENTS_ForEachInGameClient` (`ecx = pClient`, `edx = pOutClientPtr`, plain `ret`):
 * stores `pClient` into `*pOutClientPtr` iff `*pOutClientPtr == 0`.
 *
 * @va D2Game:0x6FC4A0C0
 */
export function CLIENTS_CaptureFirstInGameClientCallback113c(
  m: Memory113c,
  pClient: number,
  pOutClientPtr: number,
): void {
  if (m.u32(pOutClientPtr >>> 0) === 0) {
    m.setU32(pOutClientPtr >>> 0, pClient >>> 0)
  }
}

/**
 * `D2Game.#10017` (`[esp+4] = dwSeed`, `ret 4`): sets the global deterministic `-seed` override dword
 * at `0x6FD2E354`.
 *
 * @va D2Game:0x6FC4A210
 */
export function GAME_SetGlobalSeed113c(m: Memory113c, dwSeed: number): void {
  m.setU32(D2GAME_GLOBAL_SEED_OVERRIDE_VA_113C, dwSeed >>> 0)
}

/**
 * Looks up `UNITS_GetField7C_113c(pUnit)` (`ecx = pUnit`) and, when non-NULL, writes `dwValue` (`[esp+4]`)
 * to `+0x04` (`ret 4`).
 *
 * @va D2Game:0x6FC4E4F0
 */
export function OBJECTS_SetUnitField7CDword4_113c(
  m: Memory113c,
  pUnit: number,
  dwValue: number,
): void {
  const pField7C = UNITS_GetField7C_113c(m, pUnit) >>> 0
  if (pField7C !== 0) {
    m.setU32((pField7C + 0x04) >>> 0, dwValue >>> 0)
  }
}

/**
 * `0x6FD2E300[1]` level object hook callback (`ecx = pGame`, `edx = pRoom`, `[esp+4] = pRoomCoords`, `ret 4`):
 * unconditionally returns `1`.
 *
 * @va D2Game:0x6FC4E5C0
 */
export function OBJECTS_LevelHookAlwaysTrue113c(
  m: Memory113c,
  _pGame = 0,
  _pRoom = 0,
  _pRoomCoords = 0,
): number {
  void m
  return 1
}

/**
 * `0x6FD2E050[5]` (`ObjectsTxt.nInitFn == 5`, `ecx = pInitParam`, plain `ret`): no-op object initializer.
 *
 * @va D2Game:0x6FC4E720
 */
export function OBJECTS_InitFn05_NoOp113c(m: Memory113c, _pInitParam = 0): void {
  void m
}

/**
 * `0x6FD2E050[16]` (`ObjectsTxt.nInitFn == 16`, `ecx = pInitParam`, plain `ret`):
 * sets `pObject->pObjectData->uSubType (+0x04) = (pObjectsTxt->nAct (+0x180) << 1) & 0xFF`.
 *
 * @va D2Game:0x6FC4E760
 */
export function OBJECTS_InitFn16_DoubleActToSubType113c(
  m: Memory113c,
  pInitParam: number,
): void {
  const pObjectsTxt = m.u32((pInitParam + 0x10) >>> 0) >>> 0
  const doubled = (m.u8((pObjectsTxt + 0x180) >>> 0) << 1) & 0xff
  const pObject = m.u32((pInitParam + 0x04) >>> 0) >>> 0
  const pObjectData = m.u32((pObject + 0x14) >>> 0) >>> 0
  m.setU8((pObjectData + 0x04) >>> 0, doubled)
}

/**
 * Replaces `pObject->dwClassId (+0x04)` (`esi = pObject`, plain `ret`) with `ObjectsTxt.dwParm[0]` (`+0x17C`)
 * when `dwParm0 != 0 && dwParm0 < 0x23D`, or with `0x54` (`84`) otherwise.
 *
 * @va D2Game:0x6FC4E8B0
 */
export function OBJECTS_SubstituteObjectClassIdFromParm0_113c(
  m: Memory113c,
  pObject: number,
): void {
  const nObjId = pObject === 0 ? -1 : m.u32((pObject + 0x04) >>> 0) | 0
  const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjId) >>> 0
  const dwParm0 = m.u32((pObjectsTxt + 0x17c) >>> 0) | 0
  if (dwParm0 !== 0 && dwParm0 < 0x23d) {
    m.setU32((pObject + 0x04) >>> 0, dwParm0 >>> 0)
  } else {
    m.setU32((pObject + 0x04) >>> 0, 0x54)
  }
}

/**
 * `0x6FD2E050[27]` (`ObjectsTxt.nInitFn == 27`, `ecx = pInitParam`, plain `ret`):
 * steps `pInitParam->pObjectControl->tSeed` (`+0x0C -> +0x00`), sets `pObject->pObjectData->uSubType (+0x04)`
 * to `3` when `(newLo % 1000) < 333` (`0x14D`), else `0`.
 *
 * @va D2Game:0x6FC4E9F0
 */
export function OBJECTS_InitFn27_RollSubType3_113c(m: Memory113c, pInitParam: number): void {
  const pObjCtrl = m.u32((pInitParam + 0x0c) >>> 0) >>> 0
  const newLo = stepSeed64At113c(m, pObjCtrl)
  const rem = (newLo >>> 0) % 1000
  const uSubType = (rem | 0) < 0x14d ? 3 : 0
  const pObject = m.u32((pInitParam + 0x04) >>> 0) >>> 0
  const pObjectData = m.u32((pObject + 0x14) >>> 0) >>> 0
  m.setU8((pObjectData + 0x04) >>> 0, uSubType)
}

// ============================================================================
// 5. QUESTS (`0x6FC537D0 .. 0x6FC54C00`)
// ============================================================================

/**
 * Checks whether `dwGuid` (`esi`) is present in `pQuestData->tPlayerGuids` (`edx + 0x1C`, `wCount` at `edx + 0x9C`),
 * returning `1` if found or `0` otherwise (`edx = pQuestData`, `esi = dwGuid`, plain `ret`).
 *
 * @va D2Game:0x6FC537D0
 */
export function QUESTS_HasPlayerGuidInQuest113c(
  m: Memory113c,
  pQuestData: number,
  dwGuid: number,
): number {
  const count = m.u16((pQuestData + 0x9c) >>> 0)
  if (count <= 0) return 0
  const target = dwGuid >>> 0
  for (let i = 0; i < count; i++) {
    if (m.u32((pQuestData + 0x1c + i * 4) >>> 0) === target) {
      return 1
    }
  }
  return 0
}

/**
 * Checks whether `dwGuid` (`esi`) is present in standalone `D2QuestGuidListStrc` `pGuidList` (`edx + 0x00`,
 * `wCount` at `edx + 0x80`), returning `1` if found or `0` otherwise (plain `ret`).
 *
 * @va D2Game:0x6FC53800
 */
export function QUESTS_GuidListContains113c(
  m: Memory113c,
  pGuidList: number,
  dwGuid: number,
): number {
  const count = m.u16((pGuidList + 0x80) >>> 0)
  if (count <= 0) return 0
  const target = dwGuid >>> 0
  for (let i = 0; i < count; i++) {
    if (m.u32((pGuidList + i * 4) >>> 0) === target) {
      return 1
    }
  }
  return 0
}

/**
 * Appends `dwGuid` (`esi`) to `D2QuestGuidListStrc` `pGuidList` (`eax`) when `wCount (+0x80) < 32` (`0x20`)
 * and `dwGuid` is not already present (plain `ret`).
 *
 * @va D2Game:0x6FC53880
 */
export function QUESTS_GuidListAdd113c(
  m: Memory113c,
  pGuidList: number,
  dwGuid: number,
): void {
  const count = m.u16((pGuidList + 0x80) >>> 0)
  if (count >= 0x20) return
  const target = dwGuid >>> 0
  if (count > 0) {
    let i = 0
    while (true) {
      if (m.u32((pGuidList + i * 4) >>> 0) === target) {
        return
      }
      const curCount = m.u16((pGuidList + 0x80) >>> 0)
      i++
      if (i >= curCount) break
    }
  }
  m.setU32((pGuidList + count * 4) >>> 0, target)
  m.setU16((pGuidList + 0x80) >>> 0, (m.u16((pGuidList + 0x80) >>> 0) + 1) & 0xffff)
}

/**
 * Walks `pQuestData->pNpcMessages[nMsgTableIdx]` (`+0xDC`, stride `0xC4`, count at `+0xC0`, 12-byte entries)
 * and appends matching `nNpcClassId` dialog strings via `TEXT_AddNodeToTextList113c` (mapping `nMenu == 1` to `0`;
 * `ecx = pQuestData`, `eax = nMsgTableIdx`, `[esp+4] = pTextHeader`, `[esp+8] = nNpcClassId`, `ret 8`).
 *
 * @va D2Game:0x6FC53EB0
 */
export function QUESTS_AddNpcDialogTextNodes113c(
  m: Memory113c,
  pQuestData: number,
  nMsgTableIdx: number,
  pTextHeader: number,
  nNpcClassId: number,
): void {
  const pMsgTables = m.u32((pQuestData + 0xdc) >>> 0) >>> 0
  const pTable = (pMsgTables + imul32(nMsgTableIdx | 0, 0xc4)) >>> 0
  let nCount = m.u32((pTable + 0xc0) >>> 0) | 0
  if (nCount <= 0) return
  const targetNpc = nNpcClassId >>> 0
  let pEntry = pTable
  for (let i = 0; i < nCount; i++) {
    if ((m.u32(pEntry) >>> 0) === targetNpc) {
      const rawMenu = m.u32((pEntry + 0x08) >>> 0) >>> 0
      const nMenuIdx = rawMenu === 1 ? 0 : rawMenu | 0
      const wStringId = m.u16((pEntry + 0x04) >>> 0)
      TEXT_AddNodeToTextList113c(m, pTextHeader, wStringId, nMenuIdx)
    }
    nCount = m.u32((pTable + 0xc0) >>> 0) | 0
    pEntry = (pEntry + 0x0c) >>> 0
  }
}

/**
 * If player `[pQuestArg + 0x0C]` (`ebx`) has both quest state `1` and quest state `0` set on quest
 * `pQuestData->dwQuestNo` (`esi + 0xE0`) in `pGame->nDifficulty` (`+0x6D`) and `pQuestData->wGuidCount (+0x9C) > 0`,
 * removes the player's GUID from `pQuestData->tPlayerGuids` (`+0x1C`) via `QUESTS_GuidListRemove113c`
 * (`esi = pQuestData`, `ebx = pQuestArg`, plain `ret`).
 *
 * @va D2Game:0x6FC540C0
 */
export function QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(
  m: Memory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  const pPlayer0 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const nQuest0 = m.u32((pQuestData + 0xe0) >>> 0) | 0
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuest0, 1) !== 1) return
  const nQuest1 = m.u32((pQuestData + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuest1, 0) === 0) return
  if (m.u16((pQuestData + 0x9c) >>> 0) === 0) return
  const pPlayer1 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const dwGuid = pPlayer1 === 0 ? 0xffffffff : m.u32((pPlayer1 + 0x0c) >>> 0) >>> 0
  QUESTS_GuidListRemove113c(m, (pQuestData + 0x1c) >>> 0, dwGuid)
}

/**
 * Sends 6-byte D2GS `0x5D` (`[0x5D, uQuestId, 0x00, 0x0C, 0x00, 0x00]`) to `pPlayer`'s client when
 * `UNITS_GetRoom(pPlayer)` is `NULL` or in a non-zero level whose act (`DRLG_GetActNoFromLevelId`) is `>= uMinAct`
 * (`esi = pPlayer`, `[esp+4] = uQuestId`, `[esp+8] = uMinAct`, `ret 8`).
 *
 * @va D2Game:0x6FC54AA0
 */
export function QUESTS_SendQuestStateAlert5D_113c(
  m: Memory113c,
  pPlayer: number,
  uQuestId: number,
  uMinAct: number,
): void {
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
  if (pRoom !== 0) {
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
    if (nLevelId === 0) return
    const uAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
    if (uAct < (uMinAct & 0xff)) return
  }
  let pClient = 0
  if (pPlayer !== 0 && (m.u32(pPlayer >>> 0) >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  const sp = k2ItemsTcW1StackPtr
  k2ItemsTcW1StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU8(sp, 0x5d)
    m.setU8((sp + 1) >>> 0, uQuestId & 0xff)
    m.setU8((sp + 2) >>> 0, 0x00)
    m.setU8((sp + 3) >>> 0, 0x0c)
    m.setU16((sp + 4) >>> 0, 0)
    queuePacketToClient6FCAA3E0(m, pClient, sp, 6)
  } finally {
    k2ItemsTcW1StackPtr = sp
  }
}

/**
 * Sends 6-byte D2GS `0x5D` (`[0x5D, uQuestId, 0x02, 0x00, 0x00, 0x00]`) to `pPlayer`'s client
 * (`eax = pPlayer`, `[esp+4] = uQuestId`, `ret 4`).
 *
 * @va D2Game:0x6FC54B20
 */
export function QUESTS_SendQuestItemState2_5D_113c(
  m: Memory113c,
  pPlayer: number,
  uQuestId: number,
): void {
  let pClient = 0
  if (pPlayer !== 0 && (m.u32(pPlayer >>> 0) >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  const sp = k2ItemsTcW1StackPtr
  k2ItemsTcW1StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU8(sp, 0x5d)
    m.setU8((sp + 1) >>> 0, uQuestId & 0xff)
    m.setU8((sp + 2) >>> 0, 0x02)
    m.setU8((sp + 3) >>> 0, 0x00)
    m.setU16((sp + 4) >>> 0, 0)
    queuePacketToClient6FCAA3E0(m, pClient, sp, 6)
  } finally {
    k2ItemsTcW1StackPtr = sp
  }
}

/**
 * Builds and queues 40-byte (`0x28`) D2GS `0x27` single-message info packet for object unit `pObject` (`ecx`,
 * unit type `2`, `dwGuid = pObject ? pObject->dwUnitId : -1`, `nCount = 1`, `wMessageId` at `+10`) to `pPlayer` (`eax`)
 * (`[esp+4] = wMessageId`, `ret 4`).
 *
 * @va D2Game:0x6FC54B80
 */
export function QUESTS_SendNpcMessagePacket27_113c(
  m: Memory113c,
  pPlayer: number,
  pObject: number,
  wMessageId: number,
): void {
  let pClient = 0
  if (pPlayer !== 0 && (m.u32(pPlayer >>> 0) >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  const dwGuid = pObject === 0 ? 0xffffffff : m.u32((pObject + 0x0c) >>> 0) >>> 0
  const sp = k2ItemsTcW1StackPtr
  k2ItemsTcW1StackPtr = (sp + 0x30) >>> 0
  try {
    m.fill(sp, 0x28, 0)
    m.setU8(sp, 0x27)
    m.setU8((sp + 0x01) >>> 0, 0x02)
    m.setU32((sp + 0x02) >>> 0, dwGuid)
    m.setU8((sp + 0x06) >>> 0, 0x01)
    m.setU8((sp + 0x08) >>> 0, 0x00)
    m.setU16((sp + 0x0a) >>> 0, wMessageId & 0xffff)
    queuePacketToClient6FCAA3E0(m, pClient, sp, 0x28)
  } finally {
    k2ItemsTcW1StackPtr = sp
  }
}

/**
 * Serializes `pPlayer`'s 96-byte (`0x60`) `D2QuestRecordStrc` for `pGame->nDifficulty` (`+0x6D`) into a
 * 103-byte (`0x67`) D2GS `0x28` quest-log update packet (`[0x28, 0x06, 0, 0, 0, 0, 0, ...96B]`) and queues
 * it to `pPlayer`'s client (`eax = pPlayer`, `[esp+4] = pGame`, `ret 4`).
 *
 * @va D2Game:0x6FC54C00
 */
export function QUESTS_SendPlayerQuestLogPacket28_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): void {
  const pPlayerData0 = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRecord = m.u32((pPlayerData0 + nDiff * 4 + 0x10) >>> 0) >>> 0
  let pClient = 0
  if (pPlayer !== 0 && (m.u32(pPlayer >>> 0) >>> 0) === 0) {
    const pPlayerData1 = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    pClient = m.u32((pPlayerData1 + 0x9c) >>> 0) >>> 0
  }
  const sp = k2ItemsTcW1StackPtr
  k2ItemsTcW1StackPtr = (sp + 0x70) >>> 0
  try {
    m.setU8(sp, 0x28)
    m.setU8((sp + 0x01) >>> 0, 0x06)
    m.setU32((sp + 0x02) >>> 0, 0)
    m.setU8((sp + 0x06) >>> 0, 0x00)
    QUESTRECORD_CopyRecordToBuffer113c(m, pQuestRecord, (sp + 0x07) >>> 0, 0x60, 0)
    queuePacketToClient6FCAA3E0(m, pClient, sp, 0x67)
  } finally {
    k2ItemsTcW1StackPtr = sp
  }
}

// ============================================================================
// 6. SUNIT & PLAYER ITEM / SKILL HOTKEY / HOSTILITY (`0x6FC570E0 .. 0x6FC57940`)
// ============================================================================

/**
 * Walks `pUnit->pItemEventList` (`+0x90`, `pNext` at `+0x1C`) and returns the first node matching
 * `nEventType` (`+0x04` == `edx`), `dwItemGuid` (`+0x08` == `edi`), and `dwParam0C` (`+0x0C` == `esi`),
 * or `0` if `pUnit == NULL` or not found (`eax = pUnit`, plain `ret`).
 *
 * @va D2Game:0x6FC570E0
 */
export function SUNIT_FindItemEventNode113c(
  m: Memory113c,
  pUnit: number,
  nEventType: number,
  dwItemGuid: number,
  dwParam0C: number,
): number {
  if (pUnit === 0) return 0
  let cur = m.u32((pUnit + 0x90) >>> 0) >>> 0
  const targetEvent = nEventType >>> 0
  const targetGuid = dwItemGuid >>> 0
  const targetParam = dwParam0C >>> 0
  while (cur !== 0) {
    const next = m.u32((cur + 0x1c) >>> 0) >>> 0
    if (
      m.u32((cur + 0x04) >>> 0) === targetEvent &&
      m.u32((cur + 0x08) >>> 0) === targetGuid &&
      m.u32((cur + 0x0c) >>> 0) === targetParam
    ) {
      return cur
    }
    cur = next
  }
  return 0
}

/**
 * Checks whether player `pPlayer` (`esi`) is busy (`pPlayer + 0x6C != 0`, holding a cursor item in `pInventory`,
 * or `pPlayerData->bBusy (+0x4C) != 0`), returning `0` if `pPlayer == NULL` or `dwUnitType != 0` (plain `ret`).
 *
 * @va D2Game:0x6FC57680
 */
export function PLAYER_IsBusyWithCursorOrNpcInteract113c(m: Memory113c, pPlayer: number): number {
  if (pPlayer === 0) return 0
  if ((m.u32(pPlayer >>> 0) >>> 0) !== 0) return 0
  if (m.u8((pPlayer + 0x6c) >>> 0) !== 0) return 1
  const pInv = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  if (INVENTORY_GetCursorItem113c(m, pInv) !== 0) return 1
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  return m.u32((pPlayerData + 0x4c) >>> 0) >>> 0
}

/**
 * Writes `{wSkillId (+0x3DC), bLeftHand (+0x3DE), dwItemGuid (+0x3E0)}` into `pClient`'s skill hotkey slot
 * `nSlot` (stride `8` bytes on `UNITS_GetPlayerData(pPlayer)->pClient` at `+0x9C`), returning `1` on success
 * or `0` if `pPlayer` is not a player with a valid `pClient` (`eax = pPlayer`, `esi = nSlot`, `[esp+4..0xC]`, `ret 0xC`).
 *
 * @va D2Game:0x6FC57890
 */
export function PLAYER_SetClientSkillHotkeySlot113c(
  m: Memory113c,
  pPlayer: number,
  nSlot: number,
  wSkillId: number,
  bLeftHand: number,
  dwItemGuid: number,
): number {
  if (pPlayer === 0) return 0
  if ((m.u32(pPlayer >>> 0) >>> 0) !== 0) return 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  if (pClient === 0) return 0
  const slotAddr = (pClient + imul32(nSlot | 0, 8)) >>> 0
  m.setU16((slotAddr + 0x3dc) >>> 0, wSkillId & 0xffff)
  m.setU8((slotAddr + 0x3de) >>> 0, bLeftHand & 0xff)
  m.setU32((slotAddr + 0x3e0) >>> 0, dwItemGuid >>> 0)
  return 1
}

/**
 * Living-player iteration callback (`ecx = _pGame`, `edx = pIterPlayer`, `[esp+4] = pCtx`, `ret 4`):
 * searches `UNITS_GetPlayerData(pCtx->pSubject (+0x04))->pPlayerHostileList (+0x38, next at +0x10)` for
 * `pIterPlayer->dwUnitId` (`pIterPlayer != pSubject`), and sets `*pCtx = 1` when `(node->dwFlags (+0x04) & 0x08) != 0`.
 *
 * @va D2Game:0x6FC57940
 */
export function PLAYER_CheckHostilePlayerCallback113c(
  m: Memory113c,
  _pGame: number,
  pIterPlayer: number,
  pCtx: number,
): void {
  const pSubject = m.u32((pCtx + 0x04) >>> 0) >>> 0
  const pSubjectData = UNITS_GetPlayerData113c(m, pSubject) >>> 0
  const dwIterGuid =
    pIterPlayer === 0 ? 0xffffffff : m.u32((pIterPlayer + 0x0c) >>> 0) >>> 0

  let pFound = 0
  if ((pSubject >>> 0) !== (pIterPlayer >>> 0)) {
    let cur = m.u32((pSubjectData + 0x38) >>> 0) >>> 0
    while (cur !== 0) {
      if (m.u32(cur) === dwIterGuid) {
        pFound = cur
        break
      }
      cur = m.u32((cur + 0x10) >>> 0) >>> 0
    }
  }
  if ((pSubject >>> 0) !== (pIterPlayer >>> 0) && pFound !== 0) {
    if ((m.u32((pFound + 0x04) >>> 0) & 0x08) !== 0) {
      m.setU32(pCtx >>> 0, 1)
    }
  }
}

/**
 * Diablo II v1.13c `D2Common.dll` formatted trace logging helper (`0x6FD62AF0`, image base `0x6FD50000`).
 *
 * Binary evidence (`objdump -d -M intel` on 1.13c `D2Common.dll`):
 * - `0x6FD62AF0`: `LOGGING_WriteFormattedEntry` (`__stdcall(a0, a1, a2, a3, szFile, nLine, szFormat, vaList)`, `ret 0x20`)
 *   - `0x6FD62AF0`: `mov eax, ds:0x6FDF1474; sub esp, 0x204; test eax, eax; je 0x6FD62BF4`
 *   - When `bLogEnabled (0x6FDF1474) != 0`, formats timestamp via `GetLocalTime` + `sprintf`,
 *     formats `(a0, a1, a2, a3, szFile, nLine)` via `sprintf(..., "%01d\t%01d\t%01d\t%02d\t%.50s\t%.5d\t", ...)` (`0x6FDE5F24`),
 *     formats `szFormat` + `vaList` via `vsprintf`, appends `"\n"`, and writes to the host CRT `FILE*` (`fwrite` + `fflush`).
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2COMMON_SGPT_DATATABLES_VA_113C,
  SEED_RollLimitedRandomNumberInline113c,
} from './inline-helpers.ts'
import {
  ITEMS_ResetBaseDamageOrACStatFromTxt113c,
  ITEMS_RollItemOrUnitSeedRange113c,
} from './items.ts'
import { ITEMS_AddOrSetStatOnStatList113c } from './statlist.ts'
import { UNIT_ITEM } from './unit.ts'

export const D2COMMON_LOG_LOCK_VA_113C = 0x6fdf1470
export const D2COMMON_LOG_ENABLED_VA_113C = 0x6fdf1474

/**
 * `@va D2Common:0x6FD62AF0` (`LOGGING_WriteFormattedEntry`,
 * stdcall `[esp+4..0x20] = (a0, a1, a2, a3, szFile, nLine, szFormat, vaList)`, `ret 0x20`, void).
 */
export function LOGGING_WriteFormattedEntry113c(
  m: Memory113c,
  _a0: number,
  _a1: number,
  _a2: number,
  _a3: number,
  szFile: number,
  _nLine: number,
  szFormat: number,
  vaList: number,
): void {
  const bLogEnabled = m.u32(D2COMMON_LOG_ENABLED_VA_113C)
  if (bLogEnabled === 0) return

  let pFile = szFile >>> 0
  for (let i = 0; i < 50; i++) {
    if (m.u8((pFile + i) >>> 0) === 0) break
  }

  let pFmt = szFormat >>> 0
  let pVa = vaList >>> 0
  while (true) {
    const ch = m.u8(pFmt)
    pFmt = (pFmt + 1) >>> 0
    if (ch === 0) break
    if (ch === 0x25) {
      const spec = m.u8(pFmt)
      if (spec === 0) break
      pFmt = (pFmt + 1) >>> 0
      if (spec !== 0x25 && pVa !== 0) {
        m.u32(pVa)
        pVa = (pVa + 4) >>> 0
      }
    }
  }
}

/**
 * `@va D2Common:0x6FD62C00` (`D2Common.#10570` `LOGGING_WriteLockedEntry`,
 * cdecl `[esp+4..0x20] = (a0, a1, a2, a3, szFile, nLine, szFormat, ...vaArgs)`, plain `ret`, void).
 *
 * Checks `ds:[0x6FDF1470] != 0` (`bLogLockEnabled`), acquires/releases critical section `0x6FDF13E0`
 * (`Fog.#10050` / `LeaveCriticalSection`), and forwards `(a0, a1, a2, a3, szFile, nLine, szFormat, pVaList)`
 * to `0x6FD62AF0` (`LOGGING_WriteFormattedEntry113c`).
 */
export function LOGGING_WriteLockedEntry113c(
  m: Memory113c,
  a0: number,
  a1: number,
  a2: number,
  a3: number,
  szFile: number,
  nLine: number,
  szFormat: number,
  pVaList = 0,
): void {
  if (m.u32(D2COMMON_LOG_LOCK_VA_113C) === 0) return
  m.u32(D2COMMON_LOG_LOCK_VA_113C)
  LOGGING_WriteFormattedEntry113c(m, a0, a1, a2, a3, szFile, nLine, szFormat, pVaList)
}

export {
  ITEMS_ApplyElemMasteryOrPierceMaxOnly113c,
  ITEMS_ApplyElemMasteryOrPierceMinToMax113c,
} from './statlist.ts'

function resolveItemOrUnitSeedPtr113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u !== 0 && m.u32(u) === UNIT_ITEM) {
    const pData = m.u32((u + 0x14) >>> 0)
    return pData !== 0 ? (pData + 0x04) >>> 0 : 0
  }
  return (u + 0x20) >>> 0
}

function rollPropRangeWithSeed113c(m: Memory113c, pProp: number, pUnit: number): number {
  const minRaw = m.u32((pProp + 0x08) >>> 0) | 0
  const maxRaw = m.u32((pProp + 0x0c) >>> 0) | 0
  if (minRaw === maxRaw) return minRaw
  let lo = minRaw
  let hi = maxRaw
  if (maxRaw < minRaw) {
    lo = maxRaw
    hi = minRaw
  }
  const pSeed = resolveItemOrUnitSeedPtr113c(m, pUnit)
  return SEED_RollLimitedRandomNumberInline113c(m, pSeed, lo, hi)
}

/**
 * `@va D2Common:0x6FD98100` (`ITEMMODS_ApplyPropertySkillOnHit`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertySkillOnHit113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  _nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const layer = rollPropRangeWithSeed113c(m, prop, pUnit)
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    pUnit,
    bSetStat,
    wStatId,
    layer,
    m.u32((prop + 0x04) >>> 0),
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD98190` (`ITEMMODS_ApplyPropertyAura`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyAura113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  _nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const val = rollPropRangeWithSeed113c(m, prop, pUnit)
  const layer = m.u16((prop + 0x04) >>> 0)
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    pUnit,
    bSetStat,
    wStatId,
    layer,
    val,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD98220` (`ITEMMODS_ApplyPropertyClassSkill`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyClassSkill113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  nParam: number,
  _nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const layer = rollPropRangeWithSeed113c(m, prop, pUnit)
  const val = (nParam << 16) >> 16
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    pUnit,
    bSetStat,
    wStatId,
    layer,
    val,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD982B0` (`ITEMMODS_ApplyPropertySingleSkill`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertySingleSkill113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  nParam: number,
  _nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const val = rollPropRangeWithSeed113c(m, prop, pUnit)
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    pUnit,
    bSetStat,
    wStatId,
    nParam,
    val,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD98470` (`ITEMMODS_ApplyPropertyClassSkillTab`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyClassSkillTab113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  let val = nValue | 0
  if (val === 0) {
    val = ITEMS_RollItemOrUnitSeedRange113c(
      m,
      m.u32((prop + 0x0c) >>> 0),
      m.u32((prop + 0x08) >>> 0),
      pUnit,
    ) | 0
    if (val === 0) return 0
  }
  const tabRaw = m.u32((prop + 0x04) >>> 0) | 0
  const q = (tabRaw / 3) | 0
  const rem = (tabRaw % 3) | 0
  const layer = (rem + q * 8) | 0
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    pUnit,
    bSetStat,
    wStatId,
    layer,
    val,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD984F0` (`ITEMMODS_ApplyPropertySimpleStat`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertySimpleStat113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  let val = nValue | 0
  if (val === 0) {
    val = ITEMS_RollItemOrUnitSeedRange113c(
      m,
      m.u32((prop + 0x0c) >>> 0),
      m.u32((prop + 0x08) >>> 0),
      pUnit,
    ) | 0
  }
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    pUnit,
    bSetStat,
    wStatId,
    m.u32((prop + 0x04) >>> 0),
    val,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD98550` (`ITEMMODS_ApplyPropertyOskill`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyOskill113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  let val = nValue | 0
  if (val === 0) {
    val = ITEMS_RollItemOrUnitSeedRange113c(
      m,
      m.u32((prop + 0x0c) >>> 0),
      m.u32((prop + 0x08) >>> 0),
      pUnit,
    ) | 0
    if (val === 0) return 0
  }
  const skillId = m.u32((prop + 0x04) >>> 0) | 0
  if (skillId < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (skillId >= (m.u32((sgpt + 0xba0) >>> 0) | 0)) return 0
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    pUnit,
    bSetStat,
    wStatId,
    skillId,
    val,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD985D0` (`ITEMMODS_ApplyPropertySimpleLayer0`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertySimpleLayer0_113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  let val = nValue | 0
  if (val === 0) {
    val = ITEMS_RollItemOrUnitSeedRange113c(
      m,
      m.u32((prop + 0x0c) >>> 0),
      m.u32((prop + 0x08) >>> 0),
      pUnit,
    ) | 0
  }
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    pUnit,
    bSetStat,
    wStatId,
    0,
    val,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD98960` (`ITEMMODS_ApplyPropertyResetAndRoll`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyResetAndRoll113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const u = pUnit >>> 0
  if (u !== 0 && m.u32(u) === UNIT_ITEM) {
    ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, u, (wStatId << 16) >> 16)
  }
  let val = nValue | 0
  if (val === 0) {
    val = ITEMS_RollItemOrUnitSeedRange113c(
      m,
      m.u32((prop + 0x0c) >>> 0),
      m.u32((prop + 0x08) >>> 0),
      u,
    ) | 0
  }
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    u,
    bSetStat,
    wStatId,
    0,
    val,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD989D0` (`ITEMMODS_ApplyPropertyCondResetAndRoll`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyCondResetAndRoll113c(
  m: Memory113c,
  bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const u = pUnit >>> 0
  if (u !== 0 && m.u32(u) === UNIT_ITEM && (bForceReset | 0) === 1) {
    ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, u, (wStatId << 16) >> 16)
  }
  let val = nValue | 0
  if (val === 0) {
    val = ITEMS_RollItemOrUnitSeedRange113c(
      m,
      m.u32((prop + 0x0c) >>> 0),
      m.u32((prop + 0x08) >>> 0),
      u,
    ) | 0
  }
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    u,
    bSetStat,
    wStatId,
    0,
    val,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD98A40` (`ITEMMODS_ApplyPropertyResetAndSeedRoll`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyResetAndSeedRoll113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  _nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const u = pUnit >>> 0
  if (u !== 0 && m.u32(u) === UNIT_ITEM) {
    ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, u, (wStatId << 16) >> 16)
  }
  const val = rollPropRangeWithSeed113c(m, prop, u)
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    u,
    bSetStat,
    wStatId,
    0,
    val,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD98AE0` (`ITEMMODS_ApplyPropertyCondResetAndSeedRoll`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyCondResetAndSeedRoll113c(
  m: Memory113c,
  bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  _nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused?: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const u = pUnit >>> 0
  if (u !== 0 && m.u32(u) === UNIT_ITEM && (bForceReset | 0) === 1) {
    ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, u, (wStatId << 16) >> 16)
  }
  const val = rollPropRangeWithSeed113c(m, prop, u)
  return ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    u,
    bSetStat,
    wStatId,
    0,
    val,
    nStateId,
    fStatListFlags,
  )
}



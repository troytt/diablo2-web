/**
 * Diablo II v1.13c `D2Common.dll` register-convention inline helpers (LTCG copies of table / seed / player
 * accessors at the start of `.text`, `0x6FD51000..0x6FD515DD`).
 *
 * These are leaf functions that the compiler emitted with custom register conventions (argument in
 * `eax` / `ecx` / `esi` / `edi`, `ret` without stack cleanup unless noted). Each TS port takes the register
 * arguments as explicit parameters and reads every value through `Memory113c` at its real address, so
 * a replay against the real DLL sees the same reads and writes.
 *
 * Binary evidence (`objdump -d -M intel ~/d2-data/D2Common.dll`, image base `0x6FD50000`):
 * - `sgptDataTables` is the `.data` dword at `0x6FDE9E1C` (initialised to the static block `0x6FDEFED8`,
 *   never written by code). Every Txt lookup below starts with `mov ecx, ds:0x6FDE9E1C`.
 * - The Txt record pointer / count pairs inside the data-tables block (signed bounds `test eax,eax; jl` +
 *   `cmp eax,[ecx+count]; jge`, stride from `imul eax, eax, imm32`):
 *   MonStats `+0xA78/+0xA80` (0x6FD512B2/0x6FD512AA), MonStats2 `+0xA90/+0xA98` (0x6FD513DF/0x6FD513D7),
 *   Missiles `+0xB64/+0xB6C` (0x6FD51162/0x6FD5115A), SkillDesc `+0xB8C/+0xB94` (0x6FD51537/0x6FD5152F),
 *   Skills `+0xB98/+0xBA0` (0x6FD51262/0x6FD5125A), CharStats `+0xBC4/+0xBC8` (0x6FD512E2/0x6FD512DA),
 *   ItemTypes `+0xBF8/+0xBFC` (0x6FD51312/0x6FD5130A) and the ItemTypes equivalence matrix
 *   `+0xC00` (dwords per type, 0x6FD6E9E8) / `+0xC04` (bit matrix, 0x6FD6E9EE).
 *   The block is a static `.data` object with no allocation-size immediate, so its offsets live here as
 *   constants instead of in `docs/oracle/route2-layout.json`.
 * - `gdwBitMasks` (Fog data, `1 << i` table) is read through D2Common's IAT slot `0x6FDD90B0`
 *   (`mov eax, ds:0x6FDD90B0` at 0x6FD51453 / 0x6FD514C0).
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2CharStatsTxt_SIZE,
  D2ItemStatCostTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2MissilesTxt_SIZE,
  D2MonStats2Txt,
  D2MonStats2Txt_SIZE,
  D2MonStatsTxt,
  D2MonStatsTxt_SIZE,
  D2PlayerDataStrc,
  D2SetItemsTxt_SIZE,
  D2SetsTxt_SIZE,
  D2SkillsTxt,
  D2SkillsTxt_SIZE,
  D2StatesTxt_SIZE,
  D2UniqueItemsTxt_SIZE,
  D2UnitStrc,
  type FieldLayout113c,
} from '../mem/layout.generated.ts'
import { seedNext, type D2SeedStrc } from '../prng.ts'
import { imul32, sar32, umod32 } from './int-math.ts'

/** `D2Common` `.data` dword holding `sgptDataTables` (`mov ecx, ds:0x6FDE9E1C` at 0x6FD51154). */
export const D2COMMON_SGPT_DATATABLES_VA_113C = 0x6fde9e1c
/** `D2Common` IAT slot of Fog's `gdwBitMasks` table pointer (`mov eax, ds:0x6FDD90B0` at 0x6FD51453). */
export const D2COMMON_GDWBITMASKS_IAT_VA_113C = 0x6fdd90b0

/** Byte offsets inside the data-tables block pointed to by `sgptDataTables` (evidence in the file header). */
export const DATATABLES_OFF_113C = {
  pStatesTxt: 0xbc,
  nStatesTxtRecordCount: 0xc4,
  fStateMasksDC: 0xdc,
  fStateMasksAura: 0xf8,
  fStateMasksExp: 0xfc,
  fStateMasksOnCurse: 0x144,
  pMonStatsTxt: 0xa78,
  nMonStatsTxtRecordCount: 0xa80,
  pMonStats2Txt: 0xa90,
  nMonStats2TxtRecordCount: 0xa98,
  pMissilesTxt: 0xb64,
  nMissilesTxtRecordCount: 0xb6c,
  pSkillDescTxt: 0xb8c,
  nSkillDescTxtRecordCount: 0xb94,
  pSkillsTxt: 0xb98,
  nSkillsTxtRecordCount: 0xba0,
  pCharStatsTxt: 0xbc4,
  nCharStatsTxtRecordCount: 0xbc8,
  pItemStatCostTxt: 0xbcc,
  nItemStatCostTxtRecordCount: 0xbd4,
  pItemTypesTxt: 0xbf8,
  nItemTypesTxtRecordCount: 0xbfc,
  nItemTypesEquivDwords: 0xc00,
  pItemTypesEquiv: 0xc04,
  pSetsTxt: 0xc0c,
  nSetsTxtRecordCount: 0xc10,
  pSetItemsTxt: 0xc18,
  nSetItemsTxtRecordCount: 0xc1c,
  pUniqueItemsTxt: 0xc24,
  nUniqueItemsTxtRecordCount: 0xc28,
} as const

/** Assertion error thrown when a `D2Common.dll` function hits `FOG.#10023` (`FOG_DisplayAssert`). */
export class D2CommonAssertError extends Error {
  readonly file: string
  readonly line: number

  constructor(file: string, line: number) {
    super(`D2Common assertion failed at ${file}:${line}`)
    this.name = 'D2CommonAssertError'
    this.file = file
    this.line = line
  }
}

/** SkillDesc record stride `0x120`: `lea eax, [eax+eax*8]; shl eax, 5` at 0x6FD5153D..0x6FD51540. */
export const SKILLDESC_TXT_STRIDE_113C = 0x120

/** Default returned by 0x6FD514D0 when the skill id is out of range or `maxlvl <= 0` (`mov eax, 0x14`). */
export const SKILLS_DEFAULT_MAX_LEVEL_113C = 20

/** Seed layout read by 0x6FD51100 / 0x6FD51180: `lo` at `[ecx]` (0x6FD51113), `hi` at `[ecx+4]` (0x6FD5110E). */
const SEED_OFF_LO = 0x0
const SEED_OFF_HI = 0x4

const UNIT_PLAYER = 0

function s16(v: number): number {
  return (v << 16) >> 16
}

/** `sgptDataTables` as the inline helpers load it (`mov ecx, ds:0x6FDE9E1C`). */
export function DATATBLS_GetDataTablesPtr113c(m: Memory113c): number {
  return m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
}

/**
 * Shared shape of the 36-byte record lookups (`test eax,eax; jl null; mov ecx,[sgpt]; cmp eax,[ecx+cnt];
 * jge null; mov edx,[ecx+ptr]; imul eax,eax,stride; add eax,edx; ret`).
 */
function lookupTxtRecord(m: Memory113c, id: number, offPtr: number, offCount: number, stride: number): number {
  const n = id | 0
  if (n < 0) return 0
  const dt = DATATBLS_GetDataTablesPtr113c(m)
  if (n >= (m.u32(dt + offCount) | 0)) return 0
  return (m.u32(dt + offPtr) + imul32(n, stride)) >>> 0
}

/** One LCG step on the seed in memory (`mul edx; add eax,edi; adc edx,ebx`), stored back. Returns the new `lo`. */
function seedStepInMemory(m: Memory113c, pSeed: number, writeHiFirst: boolean): number {
  const seed: D2SeedStrc = { hi: m.u32(pSeed + SEED_OFF_HI), lo: m.u32(pSeed + SEED_OFF_LO) }
  seedNext(seed)
  if (writeHiFirst) {
    m.setU32(pSeed + SEED_OFF_HI, seed.hi)
    m.setU32(pSeed + SEED_OFF_LO, seed.lo)
  } else {
    m.setU32(pSeed + SEED_OFF_LO, seed.lo)
    m.setU32(pSeed + SEED_OFF_HI, seed.hi)
  }
  return seed.lo
}

/**
 * Roll in `[0, range)` for `range > 0`: power of two (`test esi, eax` with `eax = esi - 1`) masks the new `lo`
 * (`and ecx, eax` at 0x6FD5113E), otherwise unsigned `div esi` remainder (0x6FD51129).
 */
function seedRollRange(m: Memory113c, pSeed: number, range: number): number {
  if ((range & (range - 1)) !== 0) {
    const lo = seedStepInMemory(m, pSeed, true)
    return umod32(lo, range)
  }
  const lo = seedStepInMemory(m, pSeed, false)
  return (lo & (range - 1)) >>> 0
}

/**
 * `@va D2Common:0x6FD51000` (`PLAYER_SetPlayerData150Params`, `eax = pUnit`, 3 stack args, `ret 0xC`).
 *
 * Only caller is the fastcall export 0x6FDCF670 (`ecx = pUnit`, `edx`, 2 stack args), which pushes
 * `[arg1, arg0, edx]`. If `pUnit != NULL && pUnit->dwUnitType == 0 (player) && pUnit->pUnitData != NULL`
 * it stores `1` to `pPlayerData+0x150` and the three arguments to `+0x154/+0x158/+0x15C`, re-reading
 * `pUnit->pUnitData` (`mov edx, [eax+0x14]`) before every store (0x6FD5101A / 0x6FD51027 / 0x6FD51034).
 */
export function PLAYER_SetPlayerData150Params113c(
  m: Memory113c,
  pUnit: number,
  nArg0: number,
  nArg1: number,
  nArg2: number,
): void {
  if (pUnit === 0) return
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) return
  m.set(pPlayerData, D2PlayerDataStrc.dwField150, 1)
  m.set(m.get(pUnit, D2UnitStrc.pUnitData), D2PlayerDataStrc.dwField154, nArg0 >>> 0)
  m.set(m.get(pUnit, D2UnitStrc.pUnitData), D2PlayerDataStrc.dwField158, nArg1 >>> 0)
  m.set(m.get(pUnit, D2UnitStrc.pUnitData), D2PlayerDataStrc.dwField15C, nArg2 >>> 0)
}

/**
 * `@va D2Common:0x6FD51100` (`SEED_RollRandomNumberInline`, `ecx = pSeed`, `esi = nMax` -> `eax`).
 *
 * Register twin of `SEED_RollRandomNumber` (0x6FD510B0, `eax = nMax`): `test esi,esi; jg` (signed) else
 * return 0 without advancing the seed; otherwise one LCG step and a power-of-two mask or unsigned remainder.
 */
export function SEED_RollRandomNumberInline113c(m: Memory113c, pSeed: number, nMax: number): number {
  const max = nMax | 0
  if (max <= 0) return 0
  return seedRollRange(m, pSeed, max)
}

/**
 * `@va D2Common:0x6FD51180` (`SEED_RollLimitedRandomNumberInline`, `ecx = pSeed`, `edi = nMin`, `eax = nMax`
 * -> `eax`).
 *
 * `cmp edi, esi; jl` (signed): if `!(nMin < nMax)` return `nMin`; `range = nMax - nMin + 1` (32-bit wrap,
 * `sub esi,edi; inc esi`); if `range <= 0` return `nMin` (`lea eax,[edx+edi]` with `edx = 0`), else
 * `nMin + roll(range)` (`lea eax, [edx+edi]`).
 */
export function SEED_RollLimitedRandomNumberInline113c(
  m: Memory113c,
  pSeed: number,
  nMin: number,
  nMax: number,
): number {
  const min = nMin | 0
  const max = nMax | 0
  if (!(min < max)) return min
  const range = (max - min + 1) | 0
  if (range <= 0) return min
  return (seedRollRange(m, pSeed, range) + min) | 0
}

/** `@va D2Common:0x6FD51150` (`DATATBLS_GetMissilesTxtRecordInline`, `eax = nMissileId` -> record or 0). */
export function DATATBLS_GetMissilesTxtRecordInline113c(m: Memory113c, nMissileId: number): number {
  return lookupTxtRecord(
    m,
    nMissileId,
    DATATABLES_OFF_113C.pMissilesTxt,
    DATATABLES_OFF_113C.nMissilesTxtRecordCount,
    D2MissilesTxt_SIZE,
  )
}

/** `@va D2Common:0x6FD51250` (`DATATBLS_GetSkillsTxtRecordInline`, `eax = nSkillId` -> record or 0). */
export function DATATBLS_GetSkillsTxtRecordInline113c(m: Memory113c, nSkillId: number): number {
  return lookupTxtRecord(
    m,
    nSkillId,
    DATATABLES_OFF_113C.pSkillsTxt,
    DATATABLES_OFF_113C.nSkillsTxtRecordCount,
    D2SkillsTxt_SIZE,
  )
}

/**
 * `@va D2Common:0x6FD51280` (`DATATBLS_ValidateMonStatsIdInline`, `eax = nMonStatsId` -> id or -1).
 * `test eax,eax; jl` / `cmp eax,[ecx+0xA80]; jl ok` else `or eax, 0xFFFFFFFF`.
 */
export function DATATBLS_ValidateMonStatsIdInline113c(m: Memory113c, nMonStatsId: number): number {
  const n = nMonStatsId | 0
  if (n < 0) return -1
  const dt = DATATBLS_GetDataTablesPtr113c(m)
  if (n < (m.u32(dt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) | 0)) return n
  return -1
}

/** `@va D2Common:0x6FD512A0` (`DATATBLS_GetMonStatsTxtRecordInline`, `eax = nMonStatsId` -> record or 0). */
export function DATATBLS_GetMonStatsTxtRecordInline113c(m: Memory113c, nMonStatsId: number): number {
  return lookupTxtRecord(
    m,
    nMonStatsId,
    DATATABLES_OFF_113C.pMonStatsTxt,
    DATATABLES_OFF_113C.nMonStatsTxtRecordCount,
    D2MonStatsTxt_SIZE,
  )
}

/**
 * `@va D2Common:0x6FD512D0` (`DATATBLS_GetCharStatsTxtRecordInline`, `eax = nClassId` -> record or 0).
 * Called from `EvalStatWithOps` (0x6FD8995E / 0x6FD899DA) with `eax = pUnit->dwClassId`.
 */
export function DATATBLS_GetCharStatsTxtRecordInline113c(m: Memory113c, nClassId: number): number {
  return lookupTxtRecord(
    m,
    nClassId,
    DATATABLES_OFF_113C.pCharStatsTxt,
    DATATABLES_OFF_113C.nCharStatsTxtRecordCount,
    D2CharStatsTxt_SIZE,
  )
}

/** `@va D2Common:0x6FD51300` (`DATATBLS_GetItemTypesTxtRecordInline`, `eax = nItemType` -> record or 0). */
export function DATATBLS_GetItemTypesTxtRecordInline113c(m: Memory113c, nItemType: number): number {
  return lookupTxtRecord(
    m,
    nItemType,
    DATATABLES_OFF_113C.pItemTypesTxt,
    DATATABLES_OFF_113C.nItemTypesTxtRecordCount,
    D2ItemTypesTxt_SIZE,
  )
}

/**
 * MonStats2 record for a MonStats id, as inlined at 0x6FD513B0 / 0x6FD51400 / 0x6FD51470: the MonStats record
 * is not NULL-tested (`movsx eax, word [edx+eax+0x18]`), `wMonStatsEx` is sign-extended and bounds-checked
 * (signed) against `nMonStats2TxtRecordCount`.
 */
function monStats2FromMonStatsId(m: Memory113c, nMonStatsId: number): number {
  const n = nMonStatsId | 0
  if (n < 0) return 0
  const dt = DATATBLS_GetDataTablesPtr113c(m)
  if (n >= (m.u32(dt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) | 0)) return 0
  const pMonStats = (m.u32(dt + DATATABLES_OFF_113C.pMonStatsTxt) + imul32(n, D2MonStatsTxt_SIZE)) >>> 0
  const ex = s16(m.get(pMonStats, D2MonStatsTxt.wMonStatsEx))
  if (ex < 0) return 0
  if (ex >= (m.u32(dt + DATATABLES_OFF_113C.nMonStats2TxtRecordCount) | 0)) return 0
  return (m.u32(dt + DATATABLES_OFF_113C.pMonStats2Txt) + imul32(ex, D2MonStats2Txt_SIZE)) >>> 0
}

/**
 * `@va D2Common:0x6FD513B0` (`DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline`, `eax = nMonStatsId`
 * -> MonStats2 record or 0). KB: `kb/combat/d2game-gethit-recovery-113c.md` (HitClass at `+0x14`).
 */
export function DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c(m: Memory113c, nMonStatsId: number): number {
  return monStats2FromMonStatsId(m, nMonStatsId)
}

/**
 * Bit test shared by 0x6FD51400 / 0x6FD51470: `if (rec == 0) return 0` (explicit `test eax,eax` after the add),
 * then `gdwBitMasks[idx & 7] & byte[rec + off + (idx sar 3)]` (`movzx` byte read first, then the IAT load).
 * Returns the mask value, not a boolean.
 */
function monStats2BitTest(m: Memory113c, nMonStatsId: number, nBitIndex: number, off: number): number {
  const rec = monStats2FromMonStatsId(m, nMonStatsId)
  if (rec === 0) return 0
  const idx = nBitIndex | 0
  const byte = m.u8((rec + off + sar32(idx, 3)) >>> 0)
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  return (m.u32((pBitMasks + (idx & 7) * 4) >>> 0) & byte) >>> 0
}

/**
 * `@va D2Common:0x6FD51400` (`DATATBLS_CheckMonStats2ModeFlagInline`, `eax = nMonStatsId`, `edx = nMode`
 * -> `gdwBitMasks[nMode & 7] & MonStats2.dwModeFlags.byte[nMode sar 3]`; `movzx edx, byte [edx+eax+0xF0]`
 * at 0x6FD5144B).
 */
export function DATATBLS_CheckMonStats2ModeFlagInline113c(m: Memory113c, nMonStatsId: number, nMode: number): number {
  return monStats2BitTest(m, nMonStatsId, nMode, D2MonStats2Txt.dwModeFlags.off)
}

/**
 * `@va D2Common:0x6FD51470` (`DATATBLS_CheckMonStats2FlagInline`, `eax = nMonStatsId`, `edx = nFlag`
 * -> `gdwBitMasks[nFlag & 7] & MonStats2.dwFlags.byte[nFlag sar 3]`; `movzx edx, byte [edx+eax+0x4]`
 * at 0x6FD514BB).
 */
export function DATATBLS_CheckMonStats2FlagInline113c(m: Memory113c, nMonStatsId: number, nFlag: number): number {
  return monStats2BitTest(m, nMonStatsId, nFlag, D2MonStats2Txt.dwFlags.off)
}

/**
 * `@va D2Common:0x6FD514D0` (`DATATBLS_GetSkillsTxtMaxLvlInline`, `eax = nSkillId` -> `maxlvl` or 20).
 *
 * Out-of-range id -> `20`; the record is not NULL-tested; `w = (int16) SkillsTxt[+0x12C]` (`movsx` at
 * 0x6FD514EE; skills.bin `+0x12C` equals the Skills.txt `maxlvl` column for all 357 rows); `w > 0` (signed
 * `jg`) returns `w`, else `20`.
 */
export function DATATBLS_GetSkillsTxtMaxLvlInline113c(m: Memory113c, nSkillId: number): number {
  const n = nSkillId | 0
  if (n < 0) return SKILLS_DEFAULT_MAX_LEVEL_113C
  const dt = DATATBLS_GetDataTablesPtr113c(m)
  if (n >= (m.u32(dt + DATATABLES_OFF_113C.nSkillsTxtRecordCount) | 0)) return SKILLS_DEFAULT_MAX_LEVEL_113C
  const pSkill = (m.u32(dt + DATATABLES_OFF_113C.pSkillsTxt) + imul32(n, D2SkillsTxt_SIZE)) >>> 0
  const w = s16(m.get(pSkill, D2SkillsTxt.wMaxLvl))
  return w > 0 ? w : SKILLS_DEFAULT_MAX_LEVEL_113C
}

/**
 * `@va D2Common:0x6FD51500` (`DATATBLS_GetSkillDescTxtRecordFromSkillIdInline`, `eax = nSkillId` -> record or 0).
 *
 * Skills record (NULL-tested, `test eax,eax; je` at 0x6FD51520), `d = (int16) wSkillDesc (+0x194)`, signed
 * bounds against `nSkillDescTxtRecordCount (+0xB94)`, `pSkillDescTxt (+0xB8C) + d * 0x120`.
 */
export function DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c(m: Memory113c, nSkillId: number): number {
  const pSkill = DATATBLS_GetSkillsTxtRecordInline113c(m, nSkillId)
  if (pSkill === 0) return 0
  const dt = DATATBLS_GetDataTablesPtr113c(m)
  const d = s16(m.get(pSkill, D2SkillsTxt.wSkillDesc))
  if (d < 0) return 0
  if (d >= (m.u32(dt + DATATABLES_OFF_113C.nSkillDescTxtRecordCount) | 0)) return 0
  return (m.u32(dt + DATATABLES_OFF_113C.pSkillDescTxt) + imul32(d, SKILLDESC_TXT_STRIDE_113C)) >>> 0
}

/** `rec = SkillsRec(id); return rec ? *(u32*)(rec + off) : 0` (0x6FD51550 / 0x6FD51580 / 0x6FD515B0). */
function skillsParam(m: Memory113c, nSkillId: number, field: FieldLayout113c): number {
  const pSkill = DATATBLS_GetSkillsTxtRecordInline113c(m, nSkillId)
  if (pSkill === 0) return 0
  return m.get(pSkill, field)
}

/** `@va D2Common:0x6FD51550` (`DATATBLS_GetSkillsTxtParam1Inline`, `eax = nSkillId` -> `Param1 (+0x148)` or 0). */
export function DATATBLS_GetSkillsTxtParam1Inline113c(m: Memory113c, nSkillId: number): number {
  return skillsParam(m, nSkillId, D2SkillsTxt.dwParam1)
}

/** `@va D2Common:0x6FD51580` (`DATATBLS_GetSkillsTxtParam2Inline`, `eax = nSkillId` -> `Param2 (+0x14C)` or 0). */
export function DATATBLS_GetSkillsTxtParam2Inline113c(m: Memory113c, nSkillId: number): number {
  return skillsParam(m, nSkillId, D2SkillsTxt.dwParam2)
}

/** `@va D2Common:0x6FD515B0` (`DATATBLS_GetSkillsTxtParam3Inline`, `eax = nSkillId` -> `Param3 (+0x150)` or 0). */
export function DATATBLS_GetSkillsTxtParam3Inline113c(m: Memory113c, nSkillId: number): number {
  return skillsParam(m, nSkillId, D2SkillsTxt.dwParam3)
}

/** `@va D2Common:0x6FD515E0` (`DATATBLS_GetSkillsTxtParam4Inline`, internal LTCG helper, `eax = nSkillId` -> `Param4 (+0x154)` or 0). */
export function DATATBLS_GetSkillsTxtParam4Inline113c(m: Memory113c, nSkillId: number): number {
  return skillsParam(m, nSkillId, D2SkillsTxt.dwParam4)
}

/** `@va D2Common:0x6FD51610` (`DATATBLS_GetSkillsTxtParam5Inline`, internal LTCG helper, `eax = nSkillId` -> `Param5 (+0x158)` or 0). */
export function DATATBLS_GetSkillsTxtParam5Inline113c(m: Memory113c, nSkillId: number): number {
  return skillsParam(m, nSkillId, D2SkillsTxt.dwParam5)
}

/** `@va D2Common:0x6FD51640` (`DATATBLS_GetSkillsTxtParam6Inline`, internal LTCG helper, `eax = nSkillId` -> `Param6 (+0x15C)` or 0). */
export function DATATBLS_GetSkillsTxtParam6Inline113c(m: Memory113c, nSkillId: number): number {
  return skillsParam(m, nSkillId, D2SkillsTxt.dwParam6)
}

/**
 * Shared linear skill parameter interpolation (`0x6FD51670 / 0x6FD516B0 / 0x6FD516F0 / 0x6FD51730`):
 * `eax = nSkillId`, `edx = nLevel`; if record is NULL or `nLevel <= 0`, returns 0; otherwise
 * `base + (nLevel - 1) * perLvl` (`lea eax, [edx-1]; imul eax, [ecx+perLvl]; add eax, [ecx+base]`).
 */
function skillsLinearParam(
  m: Memory113c,
  nSkillId: number,
  nLevel: number,
  baseField: FieldLayout113c,
  perLvlField: FieldLayout113c,
): number {
  const pSkill = DATATBLS_GetSkillsTxtRecordInline113c(m, nSkillId)
  const lvl = nLevel | 0
  if (pSkill === 0 || lvl <= 0) return 0
  const perLvl = m.get(pSkill, perLvlField) | 0
  const base = m.get(pSkill, baseField) | 0
  return (base + imul32((lvl - 1) | 0, perLvl)) | 0
}

/**
 * `@va D2Common:0x6FD51670` (`DATATBLS_CalcSkillLinearParam12Inline`, internal LTCG helper,
 * `eax = nSkillId`, `edx = nLevel` -> `dwParam1 + (nLevel - 1) * dwParam2` or 0).
 */
export function DATATBLS_CalcSkillLinearParam12Inline113c(m: Memory113c, nSkillId: number, nLevel: number): number {
  return skillsLinearParam(m, nSkillId, nLevel, D2SkillsTxt.dwParam1, D2SkillsTxt.dwParam2)
}

/**
 * `@va D2Common:0x6FD516B0` (`DATATBLS_CalcSkillLinearParam34Inline`, internal LTCG helper,
 * `eax = nSkillId`, `edx = nLevel` -> `dwParam3 + (nLevel - 1) * dwParam4` or 0).
 */
export function DATATBLS_CalcSkillLinearParam34Inline113c(m: Memory113c, nSkillId: number, nLevel: number): number {
  return skillsLinearParam(m, nSkillId, nLevel, D2SkillsTxt.dwParam3, D2SkillsTxt.dwParam4)
}

/**
 * `@va D2Common:0x6FD516F0` (`DATATBLS_CalcSkillLinearParam56Inline`, internal LTCG helper,
 * `eax = nSkillId`, `edx = nLevel` -> `dwParam5 + (nLevel - 1) * dwParam6` or 0).
 */
export function DATATBLS_CalcSkillLinearParam56Inline113c(m: Memory113c, nSkillId: number, nLevel: number): number {
  return skillsLinearParam(m, nSkillId, nLevel, D2SkillsTxt.dwParam5, D2SkillsTxt.dwParam6)
}

/**
 * `@va D2Common:0x6FD51730` (`DATATBLS_CalcSkillLinearParam78Inline`, internal LTCG helper,
 * `eax = nSkillId`, `edx = nLevel` -> `dwParam7 + (nLevel - 1) * dwParam8` or 0).
 */
export function DATATBLS_CalcSkillLinearParam78Inline113c(m: Memory113c, nSkillId: number, nLevel: number): number {
  return skillsLinearParam(m, nSkillId, nLevel, D2SkillsTxt.dwParam7, D2SkillsTxt.dwParam8)
}

/** `@va D2Common:0x6FD51770` (`DATATBLS_GetStatesTxtRecordInline`, internal LTCG helper, `eax = nStateId` -> record or 0). */
export function DATATBLS_GetStatesTxtRecordInline113c(m: Memory113c, nStateId: number): number {
  return lookupTxtRecord(
    m,
    nStateId,
    DATATABLES_OFF_113C.pStatesTxt,
    DATATABLES_OFF_113C.nStatesTxtRecordCount,
    D2StatesTxt_SIZE,
  )
}

/** `@va D2Common:0x6FD517A0` (`DATATBLS_GetItemStatCostTxtRecordInline`, internal LTCG helper, `eax = nStatId` -> record or 0). */
export function DATATBLS_GetItemStatCostTxtRecordInline113c(m: Memory113c, nStatId: number): number {
  return lookupTxtRecord(
    m,
    nStatId,
    DATATABLES_OFF_113C.pItemStatCostTxt,
    DATATABLES_OFF_113C.nItemStatCostTxtRecordCount,
    D2ItemStatCostTxt_SIZE,
  )
}

/** `@va D2Common:0x6FD517D0` (`DATATBLS_GetSetsTxtRecordInline`, internal LTCG helper, `eax = nSetId` -> record or 0). */
export function DATATBLS_GetSetsTxtRecordInline113c(m: Memory113c, nSetId: number): number {
  return lookupTxtRecord(
    m,
    nSetId,
    DATATABLES_OFF_113C.pSetsTxt,
    DATATABLES_OFF_113C.nSetsTxtRecordCount,
    D2SetsTxt_SIZE,
  )
}

/** `@va D2Common:0x6FD51800` (`DATATBLS_GetSetItemsTxtRecordInline`, internal LTCG helper, `eax = nSetItemId` -> record or 0). */
export function DATATBLS_GetSetItemsTxtRecordInline113c(m: Memory113c, nSetItemId: number): number {
  return lookupTxtRecord(
    m,
    nSetItemId,
    DATATABLES_OFF_113C.pSetItemsTxt,
    DATATABLES_OFF_113C.nSetItemsTxtRecordCount,
    D2SetItemsTxt_SIZE,
  )
}

/** `@va D2Common:0x6FD51830` (`DATATBLS_GetUniqueItemsTxtRecordInline`, internal LTCG helper, `eax = nUniqueItemId` -> record or 0). */
export function DATATBLS_GetUniqueItemsTxtRecordInline113c(m: Memory113c, nUniqueItemId: number): number {
  return lookupTxtRecord(
    m,
    nUniqueItemId,
    DATATABLES_OFF_113C.pUniqueItemsTxt,
    DATATABLES_OFF_113C.nUniqueItemsTxtRecordCount,
    D2UniqueItemsTxt_SIZE,
  )
}

/**
 * `@va D2Common:0x6FD51860` (`MONSTERS_GetBaseIdFromMonsterUnitInline`, internal LTCG helper, `eax = pUnit` -> `eax`).
 *
 * Returns `-1` when `pUnit == NULL` or `pUnit->dwUnitType != 1` (UNIT_MONSTER). Otherwise loads
 * `ecx = pUnit->dwClassId`; if `ecx < 0 || ecx >= nMonStatsTxtRecordCount || pMonStats == NULL`,
 * returns `ecx` (`mov eax, ecx; ret` at 0x6FD5188E); otherwise returns `movsx eax, word ptr [pMonStats+2]` (`wBaseId`).
 */
export function MONSTERS_GetBaseIdFromMonsterUnitInline113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return -1
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== 1) return -1
  const nClassId = m.get(pUnit, D2UnitStrc.dwClassId) | 0
  const pMonStats = DATATBLS_GetMonStatsTxtRecordInline113c(m, nClassId)
  if (pMonStats === 0) return nClassId
  return s16(m.get(pMonStats, D2MonStatsTxt.wBaseId))
}

/**
 * `@va D2Common:0x6FD518A0` (`DATATBLS_CheckMonStatsFlagInline`, internal LTCG helper,
 * `eax = nMonStatsId`, `edx = nFlag` -> `gdwBitMasks[nFlag & 7] & MonStats.dwMonStatsFlags.byte[nFlag sar 3]`).
 */
export function DATATBLS_CheckMonStatsFlagInline113c(m: Memory113c, nMonStatsId: number, nFlag: number): number {
  const pMonStats = DATATBLS_GetMonStatsTxtRecordInline113c(m, nMonStatsId)
  if (pMonStats === 0) return 0
  const idx = nFlag | 0
  const byte = m.u8((pMonStats + D2MonStatsTxt.dwMonStatsFlags.off + sar32(idx, 3)) >>> 0)
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  return (m.u32((pBitMasks + (idx & 7) * 4) >>> 0) & byte) >>> 0
}

/**
 * `@va D2Common:0x6FD518F0` (`DATATBLS_HasValidSkillDescInline`, internal LTCG helper,
 * `eax = nSkillId` -> `1` if `0 <= wSkillDesc < nSkillDescTxtRecordCount`, else `0`).
 */
export function DATATBLS_HasValidSkillDescInline113c(m: Memory113c, nSkillId: number): number {
  const n = nSkillId | 0
  if (n < 0) return 0
  const dt = DATATBLS_GetDataTablesPtr113c(m)
  if (n >= (m.u32(dt + DATATABLES_OFF_113C.nSkillsTxtRecordCount) | 0)) return 0
  const pSkill = (m.u32(dt + DATATABLES_OFF_113C.pSkillsTxt) + imul32(n, D2SkillsTxt_SIZE)) >>> 0
  if (pSkill === 0) return 0
  const d = s16(m.get(pSkill, D2SkillsTxt.wSkillDesc))
  if (d < 0) return 0
  return d < (m.u32(dt + DATATABLES_OFF_113C.nSkillDescTxtRecordCount) | 0) ? 1 : 0
}

/**
 * `@va D2Common:0x6FD51930` (`DATATBLS_WalkMonsterClassChainInline`, internal LTCG helper,
 * `ecx = nMonStatsId`, `ebx = nSteps` -> `eax`).
 *
 * Looks up `MonStatsTxt[nMonStatsId]`; if NULL returns `-1`. Reads `eax = (int16) rec->wBaseId (+0x02)`;
 * if `nSteps > 0`, walks `wNextInClass (+0x04)` up to `nSteps` times, stopping early and returning `eax`
 * if `eax < 0 || eax >= nMonStatsTxtRecordCount` or `pMonStatsTxt + eax * 0x1A8 == 0`.
 */
export function DATATBLS_WalkMonsterClassChainInline113c(
  m: Memory113c,
  nMonStatsId: number,
  nSteps: number,
): number {
  const rec0 = DATATBLS_GetMonStatsTxtRecordInline113c(m, nMonStatsId)
  if (rec0 === 0) return -1
  let eax = s16(m.get(rec0, D2MonStatsTxt.wBaseId))
  const steps = nSteps | 0
  if (steps <= 0) return eax
  const dt = DATATBLS_GetDataTablesPtr113c(m)
  const count = m.u32(dt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) | 0
  const base = m.u32(dt + DATATABLES_OFF_113C.pMonStatsTxt)
  let rec = rec0
  for (let i = 0; i < steps; i++) {
    eax = s16(m.get(rec, D2MonStatsTxt.wNextInClass))
    if (eax < 0 || eax >= count) return eax
    rec = (base + imul32(eax, D2MonStatsTxt_SIZE)) >>> 0
    if (rec === 0) return eax
  }
  return eax
}


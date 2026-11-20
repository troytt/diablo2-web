import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { DATATBLS_GetSkillsTxtRecordInline113c } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { imul32 } from '../../../src/d2kern-113c/common/int-math.ts'
import {
  SKILLS_AllocSkillList113c,
  SKILLS_EvaluateManaCost256ths113c,
  SKILLS_EvaluateSkillFormula113c,
  SKILLS_EvaluateSkillManaCost113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillCalcFieldById113c,
  SKILLS_GetSkillElemMaxDamage113c,
  SKILLS_GetSkillElemMinDamage113c,
  SKILLS_GetSkillLevel113c,
  SKILLS_GetSkillLevelByIdWithBonus113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_GetSkillPhysMaxDamage113c,
  SKILLS_GetSkillPhysMinDamage113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_GetUnitSkillBonusBySkillId113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c.ts'
import { D2UnitStrc_SIZE } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { type Memory113c, SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  D2TV_KIND_SKILLCALC,
  parseVectorHeader,
  type VectorHeader,
} from './vector-format.ts'

export const SKILLCALC_INPUT_BYTES = 22
export const SKILLCALC_OUTPUT_BYTES = 42
export const SKILLCALC_RECORD_SIZE = 64

export interface SkillCalcVectorInput113c {
  readonly skillId: number
  readonly charClass: number
  readonly baseSlvl: number
  readonly synSkillId: readonly [number, number, number]
  readonly synBaseLvl: readonly [number, number, number]
  readonly allSkillsBonus: number
  readonly packedSkillBonuses: number
  readonly elemMasteryPct: number
  readonly unitFlags: number
  readonly calcFieldCode: number
  readonly calcSlotOff: number
  readonly weapMinDmg: number
  readonly charLvl: number
}

export interface SkillCalcVectorOutput113c {
  readonly effSlvl: number
  readonly bonusSlvl: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly formulaVal: number
  readonly calcFieldVal: number
  readonly physMinDmg: number
  readonly physMaxDmg: number
  readonly elemMinDmg: number
  readonly elemMaxDmg: number
  readonly elemLength: number
  readonly toHitBonus: number
}

export interface SkillCalcVectorRecord
  extends SkillCalcVectorInput113c,
    SkillCalcVectorOutput113c {
  readonly index: number
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function deriveUnitSeedLo(input: SkillCalcVectorInput113c): number {
  const s =
    (0x9e3779b9 ^
      imul32(input.skillId >>> 0, 0x85ebca6b) ^
      imul32(input.baseSlvl >>> 0, 0xc2b2ae35) ^
      imul32(input.charLvl >>> 0, 0x27d4eb2f) ^
      ((input.calcFieldCode & 0xff) << 16) ^
      (input.calcSlotOff & 0xffff)) >>>
    0
  return s === 0 ? 1 : s
}

function deriveUnitSeedHi(input: SkillCalcVectorInput113c): number {
  return (
    (0x0000029a +
      imul32(input.charClass >>> 0, 7919) +
      imul32(input.packedSkillBonuses >>> 0, 31337) +
      imul32(input.elemMasteryPct >>> 0, 131)) >>>
    0
  )
}

export function createSkillCalcSparseMemory113c(repoRoot?: string): SparseMemory113c {
  const root = repoRoot !== undefined ? repoRoot : resolve(import.meta.dirname, '../../..')
  const imgPath = resolve(root, 'tests/fixtures/oracle/k1/d2game-datatbls-113c.img.gz')
  const raw = gunzipSync(readFileSync(imgPath))
  const hdr = parseVectorHeader(raw)
  if (hdr.kind !== 'PAGEIMG' || hdr.recordSize !== 4100) {
    throw new Error(`Invalid PAGEIMG header in ${imgPath}: kind=${hdr.kind} rec=${hdr.recordSize}`)
  }
  const mem = new SparseMemory113c()
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  let off = 32
  for (let i = 0; i < hdr.recordCount; i++) {
    const va = view.getUint32(off, true) >>> 0
    mem.loadBlock(va, raw.subarray(off + 4, off + 4 + 4096))
    off += 4100
  }
  bindK2KernelGlobals113c(mem)
  return mem
}

export function evaluateSkillCalcVector113c(
  m: Memory113c,
  input: SkillCalcVectorInput113c,
  unitGuid: number = 1,
): SkillCalcVectorOutput113c {
  const pUnit = m.alloc(D2UnitStrc_SIZE) >>> 0
  m.setU32(pUnit, 0) /* UNIT_PLAYER */
  m.setU32((pUnit + 0x04) >>> 0, input.charClass >>> 0)
  m.setU32((pUnit + 0x0c) >>> 0, unitGuid >>> 0)

  const seedLo = deriveUnitSeedLo(input)
  const seedHi = deriveUnitSeedHi(input)
  m.setU32((pUnit + 0x20) >>> 0, seedLo)
  m.setU32((pUnit + 0x24) >>> 0, seedHi)
  m.setU32((pUnit + 0x28) >>> 0, seedLo)

  STATLIST_CreateEx113c(m, pUnit, 0, 0)

  const weapMaxDmg = (input.weapMinDmg + 5 + ((input.unitFlags >>> 5) & 0x07) * 12) | 0
  STATLIST_SetUnitStat113c(m, pUnit, 0, (30 + Math.trunc(input.charLvl / 2)) | 0, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 1, (25 + Math.trunc(input.charLvl / 3)) | 0, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 2, (25 + input.charLvl) | 0, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 3, (25 + Math.trunc(input.charLvl / 2)) | 0, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 12, input.charLvl | 0, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 21, input.weapMinDmg | 0, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 22, weapMaxDmg, 0)

  const pBonus = STATLIST_AllocList113c(m, 0x40, 0, unitGuid >>> 0, 0, 0)
  STATLIST_SetStat113c(m, pBonus, 0, (10 + (input.baseSlvl % 15)) | 0, 0)
  STATLIST_SetStat113c(m, pBonus, 2, (10 + (input.charLvl % 20)) | 0, 0)
  if (input.allSkillsBonus > 0) {
    STATLIST_SetStat113c(m, pBonus, 127, input.allSkillsBonus | 0, 0)
  }

  const clsBonus = input.packedSkillBonuses & 0x03
  const tabBonus = (input.packedSkillBonuses >>> 2) & 0x07
  const sngBonus = (input.packedSkillBonuses >>> 5) & 0x07
  if (clsBonus > 0) {
    STATLIST_SetStat113c(m, pBonus, 83, clsBonus, input.charClass | 0)
  }
  if (tabBonus > 0) {
    for (let tab = 0; tab < 3; tab++) {
      STATLIST_SetStat113c(m, pBonus, 188, tabBonus, (input.charClass * 8 + tab) | 0)
    }
  }
  if (sngBonus > 0) {
    const statId = (input.unitFlags & 0x01) !== 0 ? 97 : 107
    STATLIST_SetStat113c(m, pBonus, statId, sngBonus, input.skillId | 0)
  }
  if ((input.unitFlags & 0x04) !== 0) {
    STATLIST_SetStat113c(m, pBonus, 126, 2, 1)
  }
  if (input.elemMasteryPct > 0) {
    STATLIST_SetStat113c(m, pBonus, 329, input.elemMasteryPct | 0, 0)
    STATLIST_SetStat113c(m, pBonus, 330, input.elemMasteryPct | 0, 0)
    STATLIST_SetStat113c(m, pBonus, 331, input.elemMasteryPct | 0, 0)
    STATLIST_SetStat113c(m, pBonus, 332, input.elemMasteryPct | 0, 0)
  }
  STATLIST_MergeStatLists113c(m, pUnit, pBonus, 1)

  if ((input.unitFlags & 0x02) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, 134, 1)
  }

  const pSkillList = SKILLS_AllocSkillList113c(m, 0)
  m.setU32((pUnit + 0xa8) >>> 0, pSkillList)
  SKILLS_SetSkillLevelOnUnit113c(m, pUnit, input.skillId, input.baseSlvl, 0, 0, 0)
  for (let k = 0; k < 3; k++) {
    const synId = input.synSkillId[k]!
    const synLvl = input.synBaseLvl[k]!
    if (synId !== 0xffff && synId !== input.skillId && synLvl > 0) {
      SKILLS_SetSkillLevelOnUnit113c(m, pUnit, synId, synLvl, 0, 0, 0)
    }
  }

  const pSkill = SKILLS_GetSkillById113c(m, pUnit, input.skillId, 0xffffffff)
  const effSlvl = SKILLS_GetSkillLevel113c(m, pUnit, pSkill, 1) | 0
  const effSlvlById = SKILLS_GetSkillLevelByIdWithBonus113c(m, pUnit, input.skillId) | 0
  if (effSlvl !== effSlvlById) {
    throw new Error(
      `SKILLS_GetSkillLevel113c (${effSlvl}) !== SKILLS_GetSkillLevelByIdWithBonus113c (${effSlvlById}) for skillId=${input.skillId}`,
    )
  }
  const bonusSlvl = SKILLS_GetUnitSkillBonusBySkillId113c(m, pUnit, input.skillId) | 0
  const manaCost = SKILLS_EvaluateSkillManaCost113c(m, input.skillId, effSlvl) | 0
  const manaCost256 = SKILLS_EvaluateManaCost256ths113c(m, input.skillId, effSlvl) | 0

  const pSkTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, input.skillId) >>> 0
  const dwCalcOff = pSkTxt !== 0 ? m.u32((pSkTxt + input.calcSlotOff) >>> 0) : 0xffffffff
  const formulaVal = SKILLS_EvaluateSkillFormula113c(m, pUnit, dwCalcOff, input.skillId, effSlvl) | 0
  const calcFieldVal =
    SKILLS_GetSkillCalcFieldById113c(m, pUnit, input.calcFieldCode, input.skillId, effSlvl) | 0

  const bIncludeSrcDmg = (input.unitFlags & 0x10) !== 0 ? 1 : 0
  const physMinDmg =
    SKILLS_GetSkillPhysMinDamage113c(m, pUnit, input.skillId, effSlvl, bIncludeSrcDmg) | 0
  const physMaxDmg =
    SKILLS_GetSkillPhysMaxDamage113c(m, pUnit, input.skillId, effSlvl, bIncludeSrcDmg) | 0

  const bApplyMastery = (input.unitFlags & 0x08) !== 0 ? 1 : 0
  const elemMinDmg =
    SKILLS_GetSkillElemMinDamage113c(m, pUnit, input.skillId, effSlvl, bApplyMastery) | 0
  const elemMaxDmg =
    SKILLS_GetSkillElemMaxDamage113c(m, pUnit, input.skillId, effSlvl, bApplyMastery) | 0

  const elemLength =
    SKILLS_GetSkillPeriodicDelayOrLength113c(m, pUnit, input.skillId, effSlvl, 0) | 0
  const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, pUnit, input.skillId, effSlvl) | 0

  return {
    effSlvl: sx16(effSlvl),
    bonusSlvl: sx16(bonusSlvl),
    manaCost: sx16(manaCost),
    manaCost256,
    formulaVal,
    calcFieldVal,
    physMinDmg,
    physMaxDmg,
    elemMinDmg,
    elemMaxDmg,
    elemLength,
    toHitBonus,
  }
}

export function parseSkillCalcVectors(rawBuffer: Uint8Array): {
  header: VectorHeader
  records: SkillCalcVectorRecord[]
} {
  const header = parseVectorHeader(rawBuffer)
  if (header.kind !== D2TV_KIND_SKILLCALC) {
    throw new Error(`Expected D2TV kind '${D2TV_KIND_SKILLCALC}', got '${header.kind}'`)
  }
  if (header.recordSize !== SKILLCALC_RECORD_SIZE) {
    throw new Error(
      `Expected ${D2TV_KIND_SKILLCALC} recordSize ${SKILLCALC_RECORD_SIZE}, got ${header.recordSize}`,
    )
  }
  const view = new DataView(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength)
  const records: SkillCalcVectorRecord[] = []
  let off = 32
  for (let i = 0; i < header.recordCount; i++) {
    records.push({
      index: i,
      skillId: view.getUint16(off + 0, true),
      charClass: rawBuffer[off + 2]!,
      baseSlvl: rawBuffer[off + 3]!,
      synSkillId: [
        view.getUint16(off + 4, true),
        view.getUint16(off + 6, true),
        view.getUint16(off + 8, true),
      ],
      synBaseLvl: [rawBuffer[off + 10]!, rawBuffer[off + 11]!, rawBuffer[off + 12]!],
      allSkillsBonus: rawBuffer[off + 13]!,
      packedSkillBonuses: rawBuffer[off + 14]!,
      elemMasteryPct: rawBuffer[off + 15]!,
      unitFlags: rawBuffer[off + 16]!,
      calcFieldCode: rawBuffer[off + 17]!,
      calcSlotOff: view.getUint16(off + 18, true),
      weapMinDmg: rawBuffer[off + 20]!,
      charLvl: rawBuffer[off + 21]!,
      effSlvl: view.getInt16(off + 22, true),
      bonusSlvl: view.getInt16(off + 24, true),
      manaCost: view.getInt16(off + 26, true),
      manaCost256: view.getInt32(off + 28, true),
      formulaVal: view.getInt32(off + 32, true),
      calcFieldVal: view.getInt32(off + 36, true),
      physMinDmg: view.getInt32(off + 40, true),
      physMaxDmg: view.getInt32(off + 44, true),
      elemMinDmg: view.getInt32(off + 48, true),
      elemMaxDmg: view.getInt32(off + 52, true),
      elemLength: view.getInt32(off + 56, true),
      toHitBonus: view.getInt32(off + 60, true),
    })
    off += SKILLCALC_RECORD_SIZE
  }
  return { header, records }
}

export const readSkillCalcVectors = parseSkillCalcVectors

export interface SkillCalcMismatch {
  readonly index: number
  readonly field: string
  readonly expected: number
  readonly actual: number
  readonly record: SkillCalcVectorRecord
}

export function verifySkillCalcVectors(
  rawBuffer: Uint8Array,
  mem?: Memory113c,
): {
  header: VectorHeader
  totalRecords: number
  mismatches: SkillCalcMismatch[]
} {
  const { header, records } = parseSkillCalcVectors(rawBuffer)
  const m = mem !== undefined ? mem : createSkillCalcSparseMemory113c()
  const mismatches: SkillCalcMismatch[] = []

  const check = (
    rec: SkillCalcVectorRecord,
    field: string,
    expected: number,
    actual: number,
  ): void => {
    if (expected !== actual) {
      mismatches.push({ index: rec.index, field, expected, actual, record: rec })
    }
  }

  for (const rec of records) {
    const out = evaluateSkillCalcVector113c(m, rec, rec.index + 1)
    check(rec, 'effSlvl', rec.effSlvl, out.effSlvl)
    check(rec, 'bonusSlvl', rec.bonusSlvl, out.bonusSlvl)
    check(rec, 'manaCost', rec.manaCost, out.manaCost)
    check(rec, 'manaCost256', rec.manaCost256, out.manaCost256)
    check(rec, 'formulaVal', rec.formulaVal, out.formulaVal)
    check(rec, 'calcFieldVal', rec.calcFieldVal, out.calcFieldVal)
    check(rec, 'physMinDmg', rec.physMinDmg, out.physMinDmg)
    check(rec, 'physMaxDmg', rec.physMaxDmg, out.physMaxDmg)
    check(rec, 'elemMinDmg', rec.elemMinDmg, out.elemMinDmg)
    check(rec, 'elemMaxDmg', rec.elemMaxDmg, out.elemMaxDmg)
    check(rec, 'elemLength', rec.elemLength, out.elemLength)
    check(rec, 'toHitBonus', rec.toHitBonus, out.toHitBonus)
  }

  return { header, totalRecords: records.length, mismatches }
}

/**
 * Milestone #37 ([K6] Wave 1) Real-DLL `D2Game.dll` Function Differential Vector Suite:
 * Replays all 159 NDJSON vectors emitted by `tools/oracle/k6/k6-w1-d2game-emitter.c`
 * (`tests/fixtures/oracle/k6/k6-w1-d2game-vectors.ndjson.gz`, 53 previously uncovered
 * `D2Game.dll` v1.13c functions x 3 non-degenerate inputs each) against our TypeScript
 * ports in `src/d2kern-113c/game/`, asserting 100% bit-exact agreement on:
 *   1. Return value `(ret >>> 0) & retMask === expectedEax`
 *   2. Post-call memory arena (`workHex` byte-for-byte equality)
 *   3. `Fog.#10024` assertion line (`D2CommonAssertError.line === expectedAssert.line`)
 *   4. Runtime VA trace (`beginVaTrace113c` / `endVaTrace113c` records `D2Game:0xVA`)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  AIGENERAL_GetField3C_113c,
  AIGENERAL_GetQuestDataPtr38_113c,
  AI_InitBaalMinionSpawnState113c,
  AI_InitMonsterClearAiParam3_113c,
  AI_InitMonsterResetAiStateNeg1_113c,
  AI_InitMonsterSkillDelayFrame113c,
  ITEMS_ScaleStatByPercentWithMin113c,
  MONUMOD_AppendUModToMonster113c,
  MONUMOD_CopyMinionEligibleUMods113c,
  MONUMOD_CountUnitUMods113c,
  MONUMOD_GetConstantValue113c,
  MONUMOD_GetMinionClassIdForBoss113c,
  MONUMOD_GetUModListPtr113c,
  MONUMOD_MarkBossAndIncrementUniqueCount113c,
  MONUMOD_RollBossOrMinionNameSeed113c,
  MONUMOD_SetSuperUniqueId113c,
  OBJECTS_InitFn16_DoubleActToSubType113c,
  OBJECTS_InitFn27_RollSubType3_113c,
  QUESTS_GuidListContains113c,
  QUESTS_HasPlayerGuidInQuest113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts'
import {
  CHARSTATS_GetRecordPtrFast_6FC210A0_113c,
  CHECKSUM_ComputeCrc32_6FC2B470_113c,
  DATATBLS_GetTableWordAE0_6FC21830_113c,
  MONLVL_GetRecordPtrFast_6FC21E90_113c,
  MONSTATS_FollowSubClassChain_6FC21D30_113c,
  MONSTER_GetAiGeneralPtr_6FC218E0_113c,
  MONSTER_GetInteractDataPtr_6FC21370_113c,
  MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c,
  MONSTER_GetMonsterDataField2C_6FC21DD0_113c,
  MONSTER_TestUnitMonTypeFlag_6FC22790_113c,
  MONTYPE_TestNestedBit_6FC21620_113c,
  OBJRGN_CheckCoordSpacing20_6FC2B700_113c,
  OBJRGN_CheckCoordSpacing40_6FC2B670_113c,
  OVERLAY_GetRecordPtrFast_6FC21AE0_113c,
  PETTYPE_GetRecordPtrFast_6FC21B60_113c,
  SEED_StepSeed64Fast_6FC21160_113c,
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  SKILLS_EvalLinearParam34_6FC21A40_113c,
  SKILLS_EvalLinearParam56_6FC21A90_113c,
  SKILLS_GetMaxSkillLevel_6FC21740_113c,
  SKILLS_GetParam1Fast_6FC21B90_113c,
  SKILLS_GetParam2Fast_6FC21BC0_113c,
  SKILLS_GetParam3Fast_6FC21BF0_113c,
  SKILLS_GetParam4Fast_6FC21C20_113c,
  SKILLS_GetParam5Fast_6FC21C50_113c,
  SKILLS_GetParam6Fast_6FC21EC0_113c,
  SKILLS_GetParam7Fast_6FC21EF0_113c,
  STORM_TSArrayCalcChunkSize_6FC225F0_113c,
  STORM_TSHashTableLookup_6FC22130_113c,
  STORM_TSListInitDefault_6FC224B0_113c,
  STORM_TSListInitFromPrototype_6FC22740_113c,
  STORM_TSListUnlinkAll_6FC22180_113c,
  UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c,
} from '../../../src/d2kern-113c/game/k2-laneH-0x6fc2-w1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import { REPO_ROOT_113C, loadManifest113c } from '../../../tools/oracle/kern-replay/replay-113c.ts'

interface TablesHeaderRow {
  readonly k: 'tables'
  readonly arenaBase: string
  readonly workBase: string
  readonly tablesHex: string
}

interface K6VectorRow {
  readonly va: string
  readonly name: string
  readonly caseIndex: number
  readonly inputs: {
    readonly args: readonly string[]
    readonly workHex: string
  }
  readonly expectedAssert?: {
    readonly line: number
  }
  readonly outputs: {
    readonly eax: string
    readonly retMask: string
    readonly workHex: string
  }
}

type TsTargetFn = (m: Memory113c, ...args: number[]) => number | void

const TARGET_BY_VA: Readonly<Record<string, TsTargetFn>> = {
  '0x6FC210A0': (m, a0) => CHARSTATS_GetRecordPtrFast_6FC210A0_113c(m, a0!),
  '0x6FC21160': (m, a0) => SEED_StepSeed64Fast_6FC21160_113c(m, a0!),
  '0x6FC21370': (m, a0) => MONSTER_GetInteractDataPtr_6FC21370_113c(m, a0!),
  '0x6FC21540': (m, a0) => MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(m, a0!),
  '0x6FC21620': (m, a0, a1) => MONTYPE_TestNestedBit_6FC21620_113c(m, a0!, a1!),
  '0x6FC216F0': (m, a0) => UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c(m, a0!),
  '0x6FC21740': (m, a0) => SKILLS_GetMaxSkillLevel_6FC21740_113c(m, a0!),
  '0x6FC21830': (m, a0) => DATATBLS_GetTableWordAE0_6FC21830_113c(m, a0!),
  '0x6FC218E0': (m, a0) => MONSTER_GetAiGeneralPtr_6FC218E0_113c(m, a0!),
  '0x6FC21A40': (m, a0, a1) => SKILLS_EvalLinearParam34_6FC21A40_113c(m, a0!, a1!),
  '0x6FC21A90': (m, a0, a1) => SKILLS_EvalLinearParam56_6FC21A90_113c(m, a0!, a1!),
  '0x6FC21AE0': (m, a0) => OVERLAY_GetRecordPtrFast_6FC21AE0_113c(m, a0!),
  '0x6FC21B10': (m, a0, a1) => SKILLS_EvalLinearParam12_6FC21B10_113c(m, a0!, a1!),
  '0x6FC21B60': (m, a0) => PETTYPE_GetRecordPtrFast_6FC21B60_113c(m, a0!),
  '0x6FC21B90': (m, a0) => SKILLS_GetParam1Fast_6FC21B90_113c(m, a0!),
  '0x6FC21BC0': (m, a0) => SKILLS_GetParam2Fast_6FC21BC0_113c(m, a0!),
  '0x6FC21BF0': (m, a0) => SKILLS_GetParam3Fast_6FC21BF0_113c(m, a0!),
  '0x6FC21C20': (m, a0) => SKILLS_GetParam4Fast_6FC21C20_113c(m, a0!),
  '0x6FC21C50': (m, a0) => SKILLS_GetParam5Fast_6FC21C50_113c(m, a0!),
  '0x6FC21D30': (m, a0, a1) => MONSTATS_FollowSubClassChain_6FC21D30_113c(m, a0!, a1!),
  '0x6FC21DD0': (m, a0) => MONSTER_GetMonsterDataField2C_6FC21DD0_113c(m, a0!),
  '0x6FC21E90': (m, a0) => MONLVL_GetRecordPtrFast_6FC21E90_113c(m, a0!),
  '0x6FC21EC0': (m, a0) => SKILLS_GetParam6Fast_6FC21EC0_113c(m, a0!),
  '0x6FC21EF0': (m, a0) => SKILLS_GetParam7Fast_6FC21EF0_113c(m, a0!),
  '0x6FC22130': (m, a0, a1) => STORM_TSHashTableLookup_6FC22130_113c(m, a0!, a1!),
  '0x6FC22180': (m, a0) => STORM_TSListUnlinkAll_6FC22180_113c(m, a0!),
  '0x6FC224B0': (m, a0) => STORM_TSListInitDefault_6FC224B0_113c(m, a0!),
  '0x6FC225F0': (m, a0, a1) => STORM_TSArrayCalcChunkSize_6FC225F0_113c(m, a0!, a1!),
  '0x6FC22740': (m, a0, a1) => STORM_TSListInitFromPrototype_6FC22740_113c(m, a0!, a1!),
  '0x6FC22790': (m, a0, a1) => MONSTER_TestUnitMonTypeFlag_6FC22790_113c(m, a0!, a1!),
  '0x6FC2B470': (m, a0, a1) => CHECKSUM_ComputeCrc32_6FC2B470_113c(m, a0!, a1!),
  '0x6FC2B670': (m, a0, a1, a2, a3) => OBJRGN_CheckCoordSpacing40_6FC2B670_113c(m, a0!, a1!, a2!, a3!),
  '0x6FC2B700': (m, a0, a1, a2, a3) => OBJRGN_CheckCoordSpacing20_6FC2B700_113c(m, a0!, a1!, a2!, a3!),
  '0x6FC33230': (m, a0, a1, a2) => ITEMS_ScaleStatByPercentWithMin113c(m, a0!, a1!, a2!),
  '0x6FC35520': (m, a0, a1, a2) => AI_InitMonsterClearAiParam3_113c(m, a0!, a1!, a2!),
  '0x6FC35530': (m, a0, a1, a2) => AI_InitMonsterResetAiStateNeg1_113c(m, a0!, a1!, a2!),
  '0x6FC35540': (m, a0, a1, a2) => AI_InitBaalMinionSpawnState113c(m, a0!, a1!, a2!),
  '0x6FC356C0': (m, a0, a1, a2) => AI_InitMonsterSkillDelayFrame113c(m, a0!, a1!, a2!),
  '0x6FC40C60': (m, a0) => AIGENERAL_GetField3C_113c(m, a0!),
  '0x6FC40DE0': (m, a0) => AIGENERAL_GetQuestDataPtr38_113c(m, a0!),
  '0x6FC41860': (m, a0) => MONUMOD_CountUnitUMods113c(m, a0!),
  '0x6FC41F60': (m, a0) => MONUMOD_GetMinionClassIdForBoss113c(m, a0!),
  '0x6FC41FB0': (m, a0) => MONUMOD_GetConstantValue113c(m, a0!),
  '0x6FC42920': (m, a0, a1) => MONUMOD_AppendUModToMonster113c(m, a0!, a1!),
  '0x6FC42A10': (m, a0, a1) => MONUMOD_SetSuperUniqueId113c(m, a0!, a1!),
  '0x6FC42AF0': (m, a0) => MONUMOD_GetUModListPtr113c(m, a0!),
  '0x6FC43020': (m, a0, a1, a2) => MONUMOD_RollBossOrMinionNameSeed113c(m, a0!, a1!, a2!),
  '0x6FC43060': (m, a0, a1, a2) => MONUMOD_CopyMinionEligibleUMods113c(m, a0!, a1!, a2!),
  '0x6FC43260': (m, a0, a1) => MONUMOD_MarkBossAndIncrementUniqueCount113c(m, a0!, a1!),
  '0x6FC4E760': (m, a0) => OBJECTS_InitFn16_DoubleActToSubType113c(m, a0!),
  '0x6FC4E9F0': (m, a0) => OBJECTS_InitFn27_RollSubType3_113c(m, a0!),
  '0x6FC537D0': (m, a0, a1) => QUESTS_HasPlayerGuidInQuest113c(m, a0!, a1!),
  '0x6FC53800': (m, a0, a1) => QUESTS_GuidListContains113c(m, a0!, a1!),
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >>> 1)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function dumpHex(m: SparseMemory113c, addr: number, len: number): string {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += m.u8((addr + i) >>> 0).toString(16).padStart(2, '0')
  }
  return out
}

const FIXTURE_PATH = join(REPO_ROOT_113C, 'tests/fixtures/oracle/k6/k6-w1-d2game-vectors.ndjson.gz')
const rawLines = gunzipSync(readFileSync(FIXTURE_PATH))
  .toString('utf8')
  .split('\n')
  .filter((l) => l.trim().length > 0)

const header = JSON.parse(rawLines[0]!) as TablesHeaderRow
const vectors = rawLines.slice(1).map((l) => JSON.parse(l) as K6VectorRow)
const arenaBase = Number.parseInt(header.arenaBase, 16) >>> 0
const workBase = Number.parseInt(header.workBase, 16) >>> 0
const staticTableBytes = hexToBytes(header.tablesHex)

describe('[K6] Wave 1 real-DLL D2Game.dll differential vectors (53 functions, 159 vectors)', () => {
  it('covers 53 distinct manifest D2Game VAs with >= 3 non-degenerate vectors each', () => {
    expect(header.k).toBe('tables')
    expect(Object.keys(TARGET_BY_VA).length).toBe(53)
    expect(vectors.length).toBe(159)

    const manifest = loadManifest113c()
    const byVa = new Map<string, string[]>()
    for (const row of vectors) {
      const key = `D2Game:${row.va}`
      expect(manifest.has(key), `${key} missing from manifest-113c.json`).toBe(true)
      let arr = byVa.get(row.va)
      if (arr === undefined) {
        arr = []
        byVa.set(row.va, arr)
      }
      arr.push(`${row.expectedAssert?.line ?? -1}:${row.outputs.eax}:${row.outputs.workHex}`)
    }
    expect(byVa.size).toBe(53)
    for (const [va, sigs] of byVa) {
      expect(sigs.length, `${va} must have >= 3 vectors`).toBeGreaterThanOrEqual(3)
      expect(new Set(sigs).size, `${va} outputs must be non-degenerate`).toBeGreaterThanOrEqual(2)
    }
  })

  for (const va of Object.keys(TARGET_BY_VA)) {
    const vaCases = vectors.filter((v) => v.va === va)
    it(`${va} (${vaCases[0]?.name ?? 'unknown'}): matches real D2Game.dll across all ${vaCases.length} cases`, () => {
      const fn = TARGET_BY_VA[va]!
      expect(vaCases.length).toBeGreaterThanOrEqual(3)

      for (const row of vaCases) {
        const m = new SparseMemory113c()
        m.loadBlock(arenaBase, staticTableBytes)
        // Bind D2Game IAT globals identically to install_iat_hooks() in k6-w1-d2game-emitter.c
        m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, D2COMMON_SGPT_DATATABLES_VA_113C)
        m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, arenaBase) // ARENA_SGPT == arenaBase
        m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, (arenaBase + 0x0e00) >>> 0)

        const preWorkBytes = hexToBytes(row.inputs.workHex)
        m.loadBlock(workBase, preWorkBytes)

        const numArgs = row.inputs.args.map((a) => Number.parseInt(a, 16) >>> 0)

        beginVaTrace113c()
        let caughtAssert: D2CommonAssertError | null = null
        let retVal = 0
        let traced: Set<string>
        try {
          try {
            const rawRet = fn(m, ...numArgs)
            retVal = typeof rawRet === 'number' ? rawRet >>> 0 : 0
          } catch (err) {
            if (err instanceof D2CommonAssertError) {
              caughtAssert = err
            } else {
              throw err
            }
          }
        } finally {
          traced = endVaTrace113c()
        }

        expect(traced.has(`D2Game:${va}`), `${va} case ${row.caseIndex} did not record VA hit`).toBe(true)

        if (row.expectedAssert !== undefined) {
          expect(caughtAssert, `${va} case ${row.caseIndex} expected Fog.#10024 assert`).not.toBeNull()
          expect(caughtAssert!.line).toBe(row.expectedAssert.line)
        } else {
          expect(caughtAssert, `${va} case ${row.caseIndex} threw unexpected assert`).toBeNull()
          const retMask = Number.parseInt(row.outputs.retMask, 16) >>> 0
          const expEax = Number.parseInt(row.outputs.eax, 16) >>> 0
          expect(((retVal >>> 0) & retMask) >>> 0, `${va} case ${row.caseIndex} eax mismatch`).toBe(expEax)
        }

        const actualWorkHex = dumpHex(m, workBase, preWorkBytes.length)
        expect(actualWorkHex, `${va} case ${row.caseIndex} post-call memory mismatch`).toBe(
          row.outputs.workHex,
        )
      }
    })
  }
})

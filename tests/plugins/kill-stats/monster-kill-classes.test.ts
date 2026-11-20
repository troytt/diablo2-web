import { beforeAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import { MountedArchives } from '../../../src/common/mpq/mount.ts'
import { MpqArchive } from '../../../src/common/mpq/archive.ts'
import { fileSource } from '../../../src/baker/io/file-source.ts'
import { cell, parseTable, type D2Table } from '../../../src/common/world/acts.ts'
import { getMonsterKindByClassId } from '../../../src/common/units/monsters-data.ts'
import { resolveTblKey } from '../../../src/common/data/canonical-tbl-strings.ts'
import {
  MONSTATS_ALIGN_NONZERO_HCIDX,
  MONSTATS_MAX_HCIDX,
  MONSTATS_NEVER_COUNT_HCIDX,
  isCountableBossClass,
  isCountableKillClass,
} from '../../../plugins/kill-stats/monster-kill-classes.ts'

const d2Dir = fs.existsSync('samples/d2/Patch_D2.mpq')
  ? 'samples/d2'
  : process.env.D2_DATA_DIR && fs.existsSync(`${process.env.D2_DATA_DIR}/Patch_D2.mpq`)
    ? process.env.D2_DATA_DIR
    : null

describe('1.13c Monster Kill Classes (MonStats.txt Ground Truth)', () => {
  it('has exact expected sizes for Align !== 0 (115) and neverCount !== 0 (77)', () => {
    expect(MONSTATS_ALIGN_NONZERO_HCIDX.size).toBe(115)
    expect(MONSTATS_NEVER_COUNT_HCIDX.size).toBe(77)
  })

  it('spot-checks friendly/summon, neverCount, and countable hostile classes', () => {
    // 363 = necroskeleton (Align=1, neverCount=1) -> excluded
    expect(MONSTATS_ALIGN_NONZERO_HCIDX.has(363)).toBe(true)
    expect(MONSTATS_NEVER_COUNT_HCIDX.has(363)).toBe(true)
    expect(isCountableKillClass(363)).toBe(false)

    // 338 = act2hire (Align=1) -> excluded
    expect(MONSTATS_ALIGN_NONZERO_HCIDX.has(338)).toBe(true)
    expect(isCountableKillClass(338)).toBe(false)

    // 340 = boneprison1 (neverCount=1) -> excluded
    expect(MONSTATS_NEVER_COUNT_HCIDX.has(340)).toBe(true)
    expect(isCountableKillClass(340)).toBe(false)

    // 156 = andariel, 544 = baalcrab, 19 = fallen1 -> countable
    expect(getMonsterKindByClassId(19)?.id).toBe('fallen1')
    expect(isCountableKillClass(19)).toBe(true)
    expect(isCountableKillClass(156)).toBe(true)
    expect(isCountableBossClass(156)).toBe(true)
    expect(isCountableKillClass(544)).toBe(true)
    expect(isCountableBossClass(544)).toBe(true)

    // Out-of-range / non-integer -> false
    expect(isCountableKillClass(-1)).toBe(false)
    expect(isCountableKillClass(734)).toBe(false)
    expect(isCountableKillClass(1.5)).toBe(false)
  })

  it('resolves TBL names in both CHI and ENG for all 559 countable monster rows', () => {
    let countable = 0
    for (let hcIdx = 0; hcIdx <= MONSTATS_MAX_HCIDX; hcIdx++) {
      if (!isCountableKillClass(hcIdx)) continue
      countable++
      const kind = getMonsterKindByClassId(hcIdx)
      expect(kind).toBeDefined()
      expect(kind!.nameKey.length).toBeGreaterThan(0)
      const zh = resolveTblKey(kind!.nameKey, 'CHI')
      const en = resolveTblKey(kind!.nameKey, 'ENG')
      expect(zh, `Missing CHI tbl key ${kind!.nameKey} for hcIdx ${hcIdx}`).toBeDefined()
      expect(en, `Missing ENG tbl key ${kind!.nameKey} for hcIdx ${hcIdx}`).toBeDefined()
      expect(en!.trim().length).toBeGreaterThan(0)
    }
    expect(countable).toBe(559)
  })

  describe.skipIf(!d2Dir)('MPQ MonStats.txt row-by-row parity', () => {
    let monTable: D2Table

    beforeAll(async () => {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`${d2Dir}/${name}`)))
      }
      const bytes = await archives.read('data\\global\\excel\\MonStats.txt')
      monTable = parseTable(bytes)
    })

    it('matches Align !== 0 (115 rows) and neverCount !== 0 (77 rows) row-by-row against MPQ MonStats.txt', () => {
      const mpqAlign = new Set<number>()
      const mpqNeverCount = new Set<number>()
      let validRows = 0

      for (const row of monTable.rows) {
        const id = cell(monTable, row, 'Id').trim()
        const hcIdxRaw = cell(monTable, row, 'hcIdx').trim()
        if (!id || hcIdxRaw === '') continue
        validRows++
        const hcIdx = Number(hcIdxRaw)
        const align = Number(cell(monTable, row, 'Align').trim() || '0')
        const neverCount = Number(cell(monTable, row, 'neverCount').trim() || '0')
        const killable = (cell(monTable, row, 'killable').trim() || '0') !== '0'

        if (align !== 0) mpqAlign.add(hcIdx)
        if (neverCount !== 0) mpqNeverCount.add(hcIdx)

        const expectedCountable = killable && align === 0 && neverCount === 0
        expect(isCountableKillClass(hcIdx)).toBe(expectedCountable)
      }

      expect(validRows).toBe(734)
      expect([...MONSTATS_ALIGN_NONZERO_HCIDX].sort((a, b) => a - b)).toEqual(
        [...mpqAlign].sort((a, b) => a - b),
      )
      expect([...MONSTATS_NEVER_COUNT_HCIDX].sort((a, b) => a - b)).toEqual(
        [...mpqNeverCount].sort((a, b) => a - b),
      )
    })
  })
})

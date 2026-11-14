/**
 * src/client/world/quest-fx-data-113c.ts must be exactly what `npm run extract:quest-fx-data` derives
 * from the 1.13c MPQs (re-derived from the mounted archives, no skip), and the generator must refuse
 * .bin twins that disagree with the .txt rows (D2Common loads the .bin files).
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  extractQuestFxData,
  readQuestFxSourceFiles,
  renderQuestFxData,
  type QuestFxSourceFiles,
} from '../../src/baker/extract/gen-quest-fx-data.ts'
import { getSharedMountedArchives } from '../../src/baker/mpq-archive-source.ts'

const STATES_BIN_RECORD = 0x3c
const CLOAK_OF_SHADOWS_STATE = 153

async function sourceFiles(): Promise<QuestFxSourceFiles> {
  const archives = await getSharedMountedArchives()
  return readQuestFxSourceFiles(member => archives.read(member))
}

/** A copy of `files` whose states.bin record `state` has byte `offset` replaced by `value`. */
function withStatesBinByte(
  files: QuestFxSourceFiles,
  state: number,
  offset: number,
  value: number,
): QuestFxSourceFiles {
  const statesBin = files.statesBin.slice()
  statesBin[4 + state * STATES_BIN_RECORD + offset] = value
  return { ...files, statesBin }
}

describe('quest-fx-data-113c.ts parity with the 1.13c MPQs', () => {
  it('is byte-identical to the generator output', async () => {
    const data = extractQuestFxData(await sourceFiles())
    expect(readFileSync('src/client/world/quest-fx-data-113c.ts', 'utf8')).toBe(renderQuestFxData(data))
  }, 60_000)

  it('rejects a states.bin setfunc that disagrees with States.txt', async () => {
    const files = await sourceFiles()
    expect(() => extractQuestFxData(withStatesBinByte(files, CLOAK_OF_SHADOWS_STATE, 0x1a, 0))).toThrow(
      /states\.bin record 153: state 153 setfunc 0, States\.txt setfunc 2/,
    )
  }, 60_000)

  it('rejects a setfunc 2 state whose statlist would survive a re-set (states.bin +0x14 bit 0x10)', async () => {
    const files = await sourceFiles()
    expect(() => extractQuestFxData(withStatesBinByte(files, CLOAK_OF_SHADOWS_STATE, 0x14, 0x10))).toThrow(
      /states\.bin record 153 \(cloak_of_shadows\): byte \+0x14 = 0x10/,
    )
  }, 60_000)
})

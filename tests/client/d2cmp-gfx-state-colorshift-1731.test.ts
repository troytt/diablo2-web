import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RED_TRANSFORM_113C,
  DEFAULT_REVIVE_TRANSFORM_113C,
} from '../../src/common/formats/pl2.ts'
import { colormapPaletteRow, extraColormapTables } from '../../src/client/render/colormap-rows.ts'
import {
  STATE_COLOR_SHIFTS,
  STATES_TXT_COLOR_SHIFT_ROWS_113C,
  buildSceneDrawables,
  resolveStateColorshiftPaletteRow113c,
} from '../../src/client/view/unit-drawables.ts'

describe('Issue #1731 (D2CMP-GFX-1): States.txt colorshift resolution (D2Client 0x6FB22130 / 0x6FB1C5F8 / D2Win #10164)', () => {
  it('registers all 7 States.txt colorshift rows with their exact colorpri, colorshift, and light-r/g/b', () => {
    expect(STATES_TXT_COLOR_SHIFT_ROWS_113C).toEqual([
      { stateId: 1, state: 'freeze', colorpri: 100, colorshift: 108, lightRgb: [150, 215, 255] },
      { stateId: 2, state: 'poison', colorpri: 95, colorshift: 104, lightRgb: [128, 255, 128] },
      { stateId: 11, state: 'cold', colorpri: 100, colorshift: 108, lightRgb: [150, 215, 255] },
      { stateId: 44, state: 'holywindcold', colorpri: 100, colorshift: 108, lightRgb: [150, 215, 255] },
      { stateId: 90, state: 'blue', colorpri: 100, colorshift: 108, lightRgb: [150, 215, 255] },
      { stateId: 91, state: 'red', colorpri: 70, colorshift: 100, lightRgb: [255, 255, 255] },
      { stateId: 96, state: 'revive', colorpri: 85, colorshift: 73, lightRgb: [255, 255, 255] },
    ])
  })

  it('maps red (state 91, colorshift 100 -> hueVariations[99]) and revive (state 96, colorshift 73 -> hueVariations[72]) to dedicated colormap rows with tintColor=null', () => {
    const redRow = colormapPaletteRow(DEFAULT_RED_TRANSFORM_113C)
    const reviveRow = colormapPaletteRow(DEFAULT_REVIVE_TRANSFORM_113C)

    expect(redRow).toBeGreaterThanOrEqual(17)
    expect(reviveRow).toBeGreaterThanOrEqual(17)
    expect(redRow).not.toBe(reviveRow)
    expect(resolveStateColorshiftPaletteRow113c(100)).toBe(redRow)
    expect(resolveStateColorshiftPaletteRow113c(73)).toBe(reviveRow)
    expect(extraColormapTables()).toContain(DEFAULT_RED_TRANSFORM_113C)
    expect(extraColormapTables()).toContain(DEFAULT_REVIVE_TRANSFORM_113C)

    const redDrawable = buildSceneDrawables([
      {
        id: 100,
        kind: 'monster',
        classId: 0,
        x: 50,
        y: 50,
        mode: 1,
        direction: 0,
        hpRatio: 1,
        isCorpse: false,
        states: [91],
      },
    ]).unitDrawables[0]
    expect(redDrawable?.paletteRow).toBe(redRow)
    expect(redDrawable?.tintColor).toBeNull()

    const reviveDrawable = buildSceneDrawables([
      {
        id: 101,
        kind: 'monster',
        classId: 0,
        x: 52,
        y: 50,
        mode: 1,
        direction: 0,
        hpRatio: 1,
        isCorpse: false,
        states: [96],
      },
    ]).unitDrawables[0]
    expect(reviveDrawable?.paletteRow).toBe(reviveRow)
    expect(reviveDrawable?.tintColor).toBeNull()
  })

  it('breaks equal-priority ties by ascending stateId (D2Client 0x6FB22130 strict > over 0..nStates-1)', () => {
    expect(STATE_COLOR_SHIFTS[1]?.priority).toBe(100)
    expect(STATE_COLOR_SHIFTS[44]?.priority).toBe(100)
    const res = buildSceneDrawables([
      {
        id: 102,
        kind: 'monster',
        classId: 0,
        x: 54,
        y: 50,
        mode: 1,
        direction: 0,
        hpRatio: 1,
        isCorpse: false,
        states: [91, 96], // red (70) + revive (85) -> revive wins
      },
    ])
    expect(res.unitDrawables[0]?.paletteRow).toBe(STATE_COLOR_SHIFTS[96]!.paletteRow)
    expect(res.unitDrawables[0]?.tintColor).toBeNull()
  })
})

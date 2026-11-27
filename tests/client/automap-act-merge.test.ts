import { describe, expect, it } from 'vitest'
import { AutomapView, formatAutomapExitLabel } from '../../src/client/automap/automap-view.ts'
import type { LevelView } from '../../src/client/map/level-view.ts'
import {
  getAct2StaffTombLevelId,
  getAct2TombLevelsFromSeed,
} from '../../src/common/drlg/drlg-drlg.ts'
import { levelDisplayName } from '../../src/common/world/level-names-zh.ts'

/**
 * Regression tests for issue #845: in `'act'` reveal mode the sibling levels'
 * automap cells must be placed by their WORLD tile-origin delta at the authentic
 * automap per-cell scale ((cellX-cellY)*8, (cellX+cellY)*4), never by the
 * per-level local render origins `isoOriginX/Y` (which previously stacked every
 * revealed level on top of the current one).
 */

interface FakeCell {
  readonly cellNo: number
  readonly cellX: number
  readonly cellY: number
  readonly xPixel: number
  readonly yPixel: number
}

function makeFakeView(overrides: {
  readonly areaId: number
  readonly tileOriginX: number
  readonly tileOriginY: number
  readonly isoOriginX: number
  readonly isoOriginY: number
  readonly floors: readonly FakeCell[]
  readonly entrances?: { readonly x: number; readonly y: number; readonly toLevelId: number }[]
}): LevelView {
  const cellsX = 8
  const cellsY = 8
  return {
    id: overrides.areaId,
    areaId: overrides.areaId,
    levelId: overrides.areaId,
    act: 1,
    seed: 1,
    difficulty: 0,
    originX: overrides.tileOriginX * 5,
    originY: overrides.tileOriginY * 5,
    subOriginX: overrides.tileOriginX * 5,
    subOriginY: overrides.tileOriginY * 5,
    tileOriginX: overrides.tileOriginX,
    tileOriginY: overrides.tileOriginY,
    tileWidth: cellsX,
    tileHeight: cellsY,
    isoOriginX: overrides.isoOriginX,
    isoOriginY: overrides.isoOriginY,
    widthPx: 640,
    heightPx: 320,
    cellsX,
    cellsY,
    gridWidth: cellsX * 5,
    gridHeight: cellsY * 5,
    subWidth: cellsX * 5,
    subHeight: cellsY * 5,
    blocked: new Uint8Array(cellsX * 5 * cellsY * 5),
    collision: new Uint16Array(cellsX * 5 * cellsY * 5),
    collisionMasks: new Uint16Array(cellsX * 5 * cellsY * 5),
    walkable: new Uint8Array(cellsX * 5 * cellsY * 5),
    rooms: [],
    entrances: overrides.entrances ?? [],
    automap: {
      floors: [...overrides.floors],
      walls: [],
      objects: [],
      extras: [],
    },
  } as unknown as LevelView
}

describe('AutomapView act-mode merge offsets (issue #845)', () => {
  it('places sibling-level automap cells at the world tile-origin delta using the 8/4 per-cell scale', () => {
    // Current level A: world tile origin (100, 90).
    const viewA = makeFakeView({
      areaId: 1,
      tileOriginX: 100,
      tileOriginY: 90,
      isoOriginX: 0,
      isoOriginY: 0,
      floors: [{ cellNo: 1, cellX: 3, cellY: 2, xPixel: (3 - 2) * 8, yPixel: (3 + 2) * 4 }],
    })
    // Sibling level B: world tile origin (150, 120) -> delta (50, 30).
    // Misleading local iso origins must be ignored entirely.
    const viewB = makeFakeView({
      areaId: 2,
      tileOriginX: 150,
      tileOriginY: 120,
      isoOriginX: 7777,
      isoOriginY: 8888,
      floors: [
        { cellNo: 1, cellX: 1, cellY: 1, xPixel: (1 - 1) * 8, yPixel: (1 + 1) * 4 },
        { cellNo: 1, cellX: 4, cellY: 1, xPixel: (4 - 1) * 8, yPixel: (4 + 1) * 4 },
      ],
      entrances: [{ x: 5, y: 5, toLevelId: 3 }],
    })

    const automap = new AutomapView({
      initialMode: 'act',
      actRevealLevelIds: { 1: [2], 2: [], 3: [], 4: [], 5: [] },
    })
    automap.setContext(0x113c, 0, 1, viewA)
    automap.syncActiveLevel(2, viewB)
    automap.syncActiveLevel(1, viewA)

    const level = automap.getLevel(1)
    // dCell = (50, 30) -> dxPixel = (50-30)*8 = 160, dyPixel = (50+30)*4 = 320.
    const shifted = level.automap.floors.filter(
      c => c.cellX === 1 + 50 || c.cellX === 4 + 50,
    )
    expect(shifted).toHaveLength(2)
    for (const c of shifted) {
      const localCellX = c.cellX - 50
      const localCellY = c.cellY - 30
      expect(c.xPixel).toBe((localCellX - localCellY) * 8 + 160)
      expect(c.yPixel).toBe((localCellX + localCellY) * 4 + 320)
    }

    // The current level's own cells stay untouched.
    const own = level.automap.floors.find(c => c.cellX === 3 && c.cellY === 2)
    expect(own).toBeDefined()
    expect(own!.xPixel).toBe(8)
    expect(own!.yPixel).toBe(20)

    // Cross-level entrance markers carry the world cell delta too.
    const marker = level.markers.find(m => m.kind === 'exit')
    expect(marker).toBeDefined()
    expect(marker!.cellX).toBe(5 + 50)
    expect(marker!.cellY).toBe(5 + 30)
  })

  it('classifies player corpses as corpse, excludes monster corpses, and draws live mercs/summons as ally (#1245)', () => {
    const viewA = makeFakeView({
      areaId: 1,
      tileOriginX: 100,
      tileOriginY: 90,
      isoOriginX: 0,
      isoOriginY: 0,
      floors: [{ cellNo: 1, cellX: 3, cellY: 2, xPixel: (3 - 2) * 8, yPixel: (3 + 2) * 4 }],
    })
    const automap = new AutomapView({ initialMode: 'level' })
    automap.setContext(0x113c, 0, 1, viewA)

    const snap = automap.buildSnapshot([
      { kind: 'player', id: 1, classId: 1, x: 10, y: 10, mode: 1, lifePct: 100, name: 'AllySorceress' },
      { kind: 'player', id: 2, classId: 1, x: 12, y: 10, mode: 17, isCorpse: true, lifePct: 0, name: 'DeadPlayer' },
      { kind: 'monster', id: 3, classId: 0, x: 14, y: 10, mode: 12, isCorpse: true, lifePct: 0, name: 'DeadSkeleton' },
      { kind: 'monster', id: 4, classId: 0, x: 16, y: 10, mode: 1, lifePct: 100, name: 'HostileSkeleton' },
      { kind: 'monster', id: 5, classId: 338, x: 18, y: 10, mode: 1, lifePct: 100, ownerType: 'player', name: 'Mercenary' },
      { kind: 'monster', id: 6, classId: 357, x: 20, y: 10, mode: 1, lifePct: 100, ownerType: 'player', name: 'Valkyrie' },
      { kind: 'monster', id: 7, classId: 148, x: 22, y: 10, mode: 1, lifePct: 100, isNpc: true, name: 'Akara' },
    ])

    expect(snap.entityDots).toEqual([
      expect.objectContaining({ name: 'AllySorceress', kind: 'ally' }),
      expect.objectContaining({ name: 'DeadPlayer', kind: 'corpse' }),
      expect.objectContaining({ name: 'Mercenary', kind: 'ally' }),
      expect.objectContaining({ name: 'Valkyrie', kind: 'ally' }),
      expect.objectContaining({ name: 'Akara', kind: 'npc' }),
    ])
  })

  it('marks the True Tomb of Tal Rasha in Canyon of the Magi when Automap Reveal is enabled and preserves vanilla labels when disabled', () => {
    const seed = 0x113c2026
    const { staffTombLevel, bossTombLevel } = getAct2TombLevelsFromSeed(seed)
    expect(staffTombLevel).toBeGreaterThanOrEqual(66)
    expect(staffTombLevel).toBeLessThanOrEqual(72)
    expect(bossTombLevel).toBeGreaterThanOrEqual(66)
    expect(bossTombLevel).toBeLessThanOrEqual(72)
    expect(staffTombLevel).not.toBe(bossTombLevel)
    expect(getAct2StaffTombLevelId(seed)).toBe(staffTombLevel)

    const canyonView = makeFakeView({
      areaId: 46,
      tileOriginX: 200,
      tileOriginY: 200,
      isoOriginX: 0,
      isoOriginY: 0,
      floors: [{ cellNo: 1, cellX: 4, cellY: 4, xPixel: 0, yPixel: 32 }],
      entrances: [
        { x: 10, y: 10, toLevelId: 66 },
        { x: 20, y: 10, toLevelId: 67 },
        { x: 30, y: 10, toLevelId: 68 },
        { x: 40, y: 10, toLevelId: 69 },
        { x: 50, y: 10, toLevelId: 70 },
        { x: 60, y: 10, toLevelId: 71 },
        { x: 70, y: 10, toLevelId: 72 },
      ],
    })

    // 1. Vanilla mode ('off' with all radar flags disabled): no True Tomb marker
    const automapOff = new AutomapView({ initialMode: 'off' })
    automapOff.setContext(seed, 0, 46, canyonView)
    const levelOff = automapOff.buildMinimapLevel('CHI', 46)
    expect(levelOff.markers.filter(m => m.kind === 'exit')).toHaveLength(7)
    expect(levelOff.markers.some(m => m.isTrueTalRashaTomb)).toBe(false)
    for (const m of levelOff.markers) {
      expect(m.labelColor).toBeUndefined()
      expect(m.targetName).toBe(levelDisplayName(m.toLevelId!, 'CHI'))
    }

    // 2. Automap Reveal active ('level' mode): exactly 1 tomb entrance is marked [真] / [True] in green
    const automapReveal = new AutomapView({ initialMode: 'level' })
    automapReveal.setContext(seed, 0, 46, canyonView)
    const levelChi = automapReveal.buildMinimapLevel('CHI', 46)
    const trueMarkersChi = levelChi.markers.filter(m => m.isTrueTalRashaTomb)
    expect(trueMarkersChi).toHaveLength(1)
    expect(trueMarkersChi[0]!.toLevelId).toBe(staffTombLevel)
    expect(trueMarkersChi[0]!.labelColor).toBe('green')
    expect(trueMarkersChi[0]!.targetName).toBe(
      `* ${levelDisplayName(staffTombLevel, 'CHI')} [真] *`,
    )

    const falseMarkersChi = levelChi.markers.filter(m => !m.isTrueTalRashaTomb)
    expect(falseMarkersChi).toHaveLength(6)
    for (const m of falseMarkersChi) {
      expect(m.labelColor).toBeUndefined()
      expect(m.targetName).toBe(levelDisplayName(m.toLevelId!, 'CHI'))
    }

    const levelEng = automapReveal.buildMinimapLevel('ENG', 46)
    const trueMarkersEng = levelEng.markers.filter(m => m.isTrueTalRashaTomb)
    expect(trueMarkersEng).toHaveLength(1)
    expect(trueMarkersEng[0]!.toLevelId).toBe(staffTombLevel)
    expect(trueMarkersEng[0]!.labelColor).toBe('green')
    expect(trueMarkersEng[0]!.targetName).toBe(
      `* ${levelDisplayName(staffTombLevel, 'ENG')} [True] *`,
    )

    // 3. Server S2C 0x50 override (0..6 offset or 66..72 levelId) updates the marked tomb
    const overrideTombId = staffTombLevel === 72 ? 66 : staffTombLevel + 1
    automapReveal.setStaffTombLevelOverride(overrideTombId - 66)
    const levelOverridden = automapReveal.buildMinimapLevel('CHI', 46)
    const overriddenTrue = levelOverridden.markers.filter(m => m.isTrueTalRashaTomb)
    expect(overriddenTrue).toHaveLength(1)
    expect(overriddenTrue[0]!.toLevelId).toBe(overrideTombId)
    expect(formatAutomapExitLabel(overrideTombId, 'CHI', overrideTombId, true)).toBe(
      `* ${levelDisplayName(overrideTombId, 'CHI')} [真] *`,
    )
  })
})

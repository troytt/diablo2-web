/**
 * Regression & 1.13c Parity Tests for Shrine Overhead Icons (SubClass=1) (Issue #859).
 *
 * Ground truth (Diablo II v1.13c `Shrines.txt`, `Overlay.txt` rows 57..68, and
 * `D2Client.dll @ 0x6fb82f60` `gShrineClientTbl` / `0x6fad5950` `InitBoosterShrineOverlays`):
 * - Only `Code 6..15` (10 Booster shrines) have `pfnInit = 0x6fad5950` and attach TWO overhead
 *   overlays (`nOverlay1` icon + `nOverlay2` shimmer) when `modeIdx === 0` (`NU`):
 *   - `6` (Armor): `shrine_armor` (59) + `shrine_shimmer00` (57)
 *   - `7` (Combat): `shrine_combat` (60) + `shrine_shimmer00` (57)
 *   - `8` (Resist Fire): `shrine_resist_fire` (62) + `shrine_shimmer00` (57)
 *   - `9` (Resist Cold): `shrine_resist_cold` (63) + `shrine_shimmer01` (58)
 *   - `10` (Resist Lightning): `shrine_resist_lightning` (61) + `shrine_shimmer01` (58)
 *   - `11` (Resist Poison): `shrine_resist_poison` (64) + `shrine_shimmer01` (58)
 *   - `12` (Skill): `shrine_skill` (65) + `shrine_shimmer00` (57)
 *   - `13` (Mana Recharge): `shrine_mana_regen` (66) + `shrine_shimmer01` (58)
 *   - `14` (Stamina): `shrine_stamina` (67) + `shrine_shimmer01` (58)
 *   - `15` (Experience): `shrine_experience` (68) + `shrine_shimmer00` (57)
 * - `Code 0..5` (including `Code = 3` Mana Shrine / Mana Well) and `Code 16..22` (including
 *   `Code = 19` Fire Shrine, `20` Monster Shrine, `21` Exploding Shrine, `22` Poison Shrine)
 *   have `pfnInit = NULL, nOverlay1 = -1, nOverlay2 = -1` -> ZERO overhead icons.
 * - Zero name-guessing (`resolvedName`), zero `meta.parm0` fallbacks, and zero default
 *   `'shrine_shimmer00'` fallbacks.
 * - All 12 shrine overlays (`Overlay.txt` rows 57..68) use `AnimRate = 8`, `Trans = 3` (`trans50`),
 *   and `Height4 = -60` (`yOffset = -60`).
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { MapService } from '../../src/client/map/map-service.ts'
import type { AtlasFrame } from '../../src/client/render/atlas.ts'
import { AUTHENTIC_113C_OVERLAYS, OVERLAY_METAS } from '../../src/client/render/overlays-meta.ts'
import type { AtlasHandle, SpriteRenderer } from '../../src/client/render/renderer.ts'
import type { LoadedObjectArt } from '../../src/client/scene/entity-art-loader.ts'
import type { LoadedOverlayArt } from '../../src/client/scene/missile-overlay-renderer.ts'
import {
  drawSceneUnitDrawable,
  type SceneSourceRenderContext,
} from '../../src/client/scene/world-renderer.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'
import {
  buildSceneDrawables,
  type SceneUnitDrawable,
} from '../../src/client/view/unit-drawables.ts'
import {
  CANONICAL_113C_OBJECTS,
  SHRINE_CODE_TO_OVERLAYS_113C,
  SHRINE_CODE_TO_OVERLAY_TOKEN,
  resolveShrineOverlayToken,
  resolveShrineOverlays113c,
  type ShrineOverlayPair113c,
} from '../../src/common/world/objects-meta.ts'

const EXPECTED_BOOSTER_SHRINE_OVERLAYS: Readonly<Record<number, ShrineOverlayPair113c>> =
  Object.freeze({
    6: { icon: 'shrine_armor', shimmer: 'shrine_shimmer00' },
    7: { icon: 'shrine_combat', shimmer: 'shrine_shimmer00' },
    8: { icon: 'shrine_resist_fire', shimmer: 'shrine_shimmer00' },
    9: { icon: 'shrine_resist_cold', shimmer: 'shrine_shimmer01' },
    10: { icon: 'shrine_resist_lightning', shimmer: 'shrine_shimmer01' },
    11: { icon: 'shrine_resist_poison', shimmer: 'shrine_shimmer01' },
    12: { icon: 'shrine_skill', shimmer: 'shrine_shimmer00' },
    13: { icon: 'shrine_mana_regen', shimmer: 'shrine_shimmer01' },
    14: { icon: 'shrine_stamina', shimmer: 'shrine_shimmer01' },
    15: { icon: 'shrine_experience', shimmer: 'shrine_shimmer00' },
  })

const NON_BOOSTER_CODES = [0, 1, 2, 3, 4, 5, 16, 17, 18, 19, 20, 21, 22] as const

function createMockShrineObjectArt(token = 'SR'): LoadedObjectArt {
  const makeGroup = (groupIdx: number): AtlasFrame[] => [
    { x: groupIdx * 100, y: 0, width: 70, height: 118, anchorX: -35, anchorY: -98 },
  ]
  return {
    token,
    slug: token.toLowerCase(),
    handle: 10 as unknown as AtlasHandle,
    groups: [makeGroup(0), makeGroup(1), makeGroup(2)],
    blendMode: 'normal',
    directions: 1,
    standOffset: 0,
    standFrames: 1,
    clips: {
      nu: { group: 0, directions: 1, frames: 1, speed: 256, loop: false, events: [] },
      op: { group: 1, directions: 1, frames: 1, speed: 256, loop: false, events: [] },
      on: { group: 2, directions: 1, frames: 1, speed: 256, loop: false, events: [] },
    },
    start: [0, 0, 0, 0, 0, 0, 0, 0],
    frameCnt: [1, 1, 1, 0, 0, 0, 0, 0],
    frameDelta: [256, 256, 256, 0, 0, 0, 0, 0],
    cycleAnim: [false, false, false, false, false, false, false, false],
  }
}

function createMockOverlayArt(name: string, handleId: number): LoadedOverlayArt {
  const meta = OVERLAY_METAS[name]
  if (!meta) {
    throw new Error(`Missing OVERLAY_METAS[${name}]`)
  }
  const frames: AtlasFrame[] = meta.groups[0]!.map((tuple) => ({
    x: tuple[0],
    y: tuple[1],
    width: tuple[2],
    height: tuple[3],
    anchorX: tuple[4],
    anchorY: tuple[5],
  }))
  return {
    meta,
    handle: handleId as unknown as AtlasHandle,
    frames: [frames],
  }
}

function createMockSpriteRenderer() {
  const drawnCalls: Array<{
    frame: AtlasFrame
    x: number
    y: number
    atlas: AtlasHandle | undefined
    blendMode: string | undefined
  }> = []
  const renderer = {
    addAtlas: vi.fn(() => 1 as unknown as AtlasHandle),
    addIndexedAtlas: vi.fn(() => 1 as unknown as AtlasHandle),
    draw: vi.fn(
      (
        frame: AtlasFrame,
        x: number,
        y: number,
        opts?: { atlas?: AtlasHandle; blendMode?: string },
      ) => {
        drawnCalls.push({ frame, x, y, atlas: opts?.atlas, blendMode: opts?.blendMode })
      },
    ),
    setBlendMode: vi.fn(),
  } as unknown as SpriteRenderer
  return { renderer, drawnCalls }
}

function makeShrineDrawable(
  classId: number,
  mode: number,
  options?: {
    token?: string
    interactType?: number
    shrineType?: number
    flags?: number
    name?: string
    worldX?: number
    worldY?: number
  },
): SceneUnitDrawable {
  const token = options?.token ?? CANONICAL_113C_OBJECTS[classId]?.token ?? 'SR'
  return {
    drawableKind: 'unit',
    unitKind: 'object',
    id: 1000 + classId,
    unitId: 1000 + classId,
    classId,
    token,
    mode,
    direction: 0,
    frame: 0,
    subX: 5000,
    subY: 5000,
    worldX: options?.worldX ?? 400,
    worldY: options?.worldY ?? 300,
    sortY: 300,
    blendMode: 'normal',
    lifePct: 128,
    name: options?.name ?? 'Shrine',
    isHovered: false,
    isCorpse: false,
    tintColor: null,
    overlays: [],
    ...(options?.interactType !== undefined ? { interactType: options.interactType } : {}),
    ...(options?.shrineType !== undefined ? { shrineType: options.shrineType } : {}),
    ...(options?.flags !== undefined ? { flags: options.flags } : {}),
  }
}

describe('Issue #859: Strict 1.13c Shrine Overhead Icons (SubClass=1) per Shrines.txt & D2Client.dll 0x6fb82f60', () => {
  it('1. Exhaustively verifies all 23 Shrines.txt codes (0..22) against D2Client.dll @ 0x6fb82f60', () => {
    const shrineClassId = 2 // classId=2 (Shrine, SubClass=1)
    expect(CANONICAL_113C_OBJECTS[shrineClassId]?.isShrine).toBe(true)

    for (let code = 0; code <= 22; code++) {
      const expected = EXPECTED_BOOSTER_SHRINE_OVERLAYS[code]
      expect(SHRINE_CODE_TO_OVERLAYS_113C[code], `Code=${code}`).toEqual(expected)
      expect(SHRINE_CODE_TO_OVERLAY_TOKEN[code], `Code=${code} primary token`).toBe(expected?.icon)
      expect(resolveShrineOverlays113c(shrineClassId, code), `resolveShrineOverlays113c(${code})`).toEqual(
        expected,
      )
      expect(resolveShrineOverlayToken(shrineClassId, code), `resolveShrineOverlayToken(${code})`).toBe(
        expected?.icon,
      )
    }

    // Explicit regression assertions for Code 3 (Mana Shrine), Code 8 (Resist Fire), Code 13 (Mana Recharge), Code 19 (Fire Shrine)
    expect(resolveShrineOverlays113c(shrineClassId, 3)).toBeUndefined()
    expect(resolveShrineOverlays113c(shrineClassId, 8)).toEqual({
      icon: 'shrine_resist_fire',
      shimmer: 'shrine_shimmer00',
    })
    expect(resolveShrineOverlays113c(shrineClassId, 13)).toEqual({
      icon: 'shrine_mana_regen',
      shimmer: 'shrine_shimmer01',
    })
    expect(resolveShrineOverlays113c(shrineClassId, 19)).toBeUndefined()
  })

  it('2. Rejects all name-guessing, meta.parm0 fallbacks, default shimmer00 fallbacks, and non-shrine objects', () => {
    // Parm0 = 2 Mana Shrine / Mana Well objects (Objects.txt Id = 164..168, 173, 249, 281, 302, 320, 343)
    const manaWellClassIds = [164, 165, 166, 167, 168, 173, 249, 281, 302, 320, 343] as const
    for (const classId of manaWellClassIds) {
      expect(CANONICAL_113C_OBJECTS[classId]?.isShrine, `classId=${classId} isShrine`).toBe(true)
      expect(CANONICAL_113C_OBJECTS[classId]?.parm0, `classId=${classId} parm0`).toBe(2)

      // Missing interactType & flags -> strictly undefined (NO parm0=2 -> shrine_mana_regen or shimmer00 fallback)
      expect(resolveShrineOverlays113c(classId, undefined, undefined)).toBeUndefined()
      expect(resolveShrineOverlayToken(classId, undefined, undefined)).toBeUndefined()

      // Even if a misleading hover name is passed, resolveShrineOverlayToken never guesses by name
      expect(
        resolveShrineOverlayToken(classId, undefined, undefined, 'Mana Recharge Shrine'),
      ).toBeUndefined()
      expect(resolveShrineOverlayToken(classId, 3, undefined, '法力補充神殿')).toBeUndefined()
    }

    // Parm0 = 1 Health Shrine objects (e.g. classId=83, 134) with no interactType -> strictly undefined
    expect(resolveShrineOverlays113c(83, undefined, undefined)).toBeUndefined()
    expect(resolveShrineOverlayToken(83, undefined, undefined, 'Resist Fire Shrine')).toBeUndefined()

    // Authoritative S2C 0x51 byte 13 flags fallback works ONLY for Booster shrines (Code 6..15)
    expect(resolveShrineOverlays113c(2, undefined, 13)).toEqual({
      icon: 'shrine_mana_regen',
      shimmer: 'shrine_shimmer01',
    })
    expect(resolveShrineOverlays113c(2, undefined, 8)).toEqual({
      icon: 'shrine_resist_fire',
      shimmer: 'shrine_shimmer00',
    })
    expect(resolveShrineOverlays113c(2, undefined, 3)).toBeUndefined()
    expect(resolveShrineOverlays113c(2, undefined, 19)).toBeUndefined()

    // Out-of-range or negative codes -> strictly undefined
    expect(resolveShrineOverlays113c(2, -1)).toBeUndefined()
    expect(resolveShrineOverlays113c(2, 23)).toBeUndefined()
    expect(resolveShrineOverlays113c(2, 255)).toBeUndefined()

    // Non-shrine objects (subClass !== 1, e.g. classId=7 Barrel, classId=30 Tree of Inifuss) -> undefined
    expect(resolveShrineOverlays113c(7, 8)).toBeUndefined()
    expect(resolveShrineOverlays113c(30, 13)).toBeUndefined()
  })

  it('3. Verifies baked shrine_shimmer01 (ShrineShimmer01.dcc, Overlay ID 58) metadata and public overlay assets', () => {
    const meta = OVERLAY_METAS['shrine_shimmer01']
    expect(meta).toBeDefined()
    expect(OVERLAY_METAS['shrineshimmer01']).toBe(meta)
    expect(meta?.celFile).toBe('ShrineShimmer01')
    expect(meta?.directions).toBe(1)
    expect(meta?.framesPerDirection).toBe(17)
    expect(meta?.animRate).toBe(8)
    expect(meta?.trans).toBe(3)
    expect(meta?.anchor).toBe('head')
    expect(meta?.yOffset).toBe(-60)

    const auth = AUTHENTIC_113C_OVERLAYS['shrine_shimmer01']
    expect(auth).toBeDefined()
    expect(auth?.filename).toBe('ShrineShimmer01')
    expect(auth?.animRate).toBe(8)
    expect(auth?.trans).toBe(3)
    expect(auth?.height4).toBe(-60)

    const publicDir = path.resolve(process.cwd(), 'public/overlays')
    expect(fs.existsSync(path.join(publicDir, 'shrine_shimmer01.png'))).toBe(true)
    expect(fs.existsSync(path.join(publicDir, 'shrine_shimmer01.json'))).toBe(true)
    const bakedJson = JSON.parse(
      fs.readFileSync(path.join(publicDir, 'shrine_shimmer01.json'), 'utf8'),
    ) as { name: string; celFile: string; animRate: number; trans: number; yOffset: number }
    expect(bakedJson.name).toBe('shrine_shimmer01')
    expect(bakedJson.celFile).toBe('ShrineShimmer01')
    expect(bakedJson.animRate).toBe(8)
    expect(bakedJson.trans).toBe(3)
    expect(bakedJson.yOffset).toBe(-60)
  })

  it('4. Propagates S2C 0x51 interactType (byte 13) and flags through OnlineSession.buildRenderableUnits() and buildSceneDrawables()', () => {
    const stubMap: MapService = {
      onLoadActPacket: () => null,
      onAddRoomDataPacket: () => null,
      onRemoveRoomDataPacket: () => null,
      getActiveLevelView: () => null,
      getTileAtlas: () => null,
      findLevelViewAtWorldSubTile: () => ({ areaId: 2 }),
    } as unknown as MapService

    const session = new OnlineSession({
      settingsStore: createSettingsStore(),
      mapService: stubMap,
    })
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 2 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Sorceress',
        x: 5000,
        y: 5000,
      },
    })

    // Assign a Resist Fire Shrine (Code = 8) and a Fire Shrine (Code = 19)
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 801,
        classId: 2,
        x: 5004,
        y: 5000,
        mode: 0,
        interactType: 8,
        flags: 8,
      },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 802,
        classId: 2,
        x: 5008,
        y: 5000,
        mode: 0,
        interactType: 19,
        flags: 19,
      },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 803,
        classId: 2,
        x: 5012,
        y: 5000,
        mode: 0,
        flags: 13,
      },
    })

    const renderableUnits = session.buildRenderableUnits(1000)
    const resistFireUnit = renderableUnits.find((u) => u.id === 801)
    const fireShrineUnit = renderableUnits.find((u) => u.id === 802)
    const manaRechargeUnit = renderableUnits.find((u) => u.id === 803)

    expect(resistFireUnit).toBeDefined()
    expect(resistFireUnit?.interactType).toBe(8)
    expect(resistFireUnit?.flags).toBe(8)
    expect(resistFireUnit?.name).toBe('Resist Fire Shrine')

    expect(fireShrineUnit).toBeDefined()
    expect(fireShrineUnit?.interactType).toBe(19)
    expect(fireShrineUnit?.flags).toBe(19)
    expect(fireShrineUnit?.name).toBe('Fire Shrine')

    expect(manaRechargeUnit).toBeDefined()
    expect(manaRechargeUnit?.interactType).toBeUndefined()
    expect(manaRechargeUnit?.flags).toBe(13)
    expect(manaRechargeUnit?.name).toBe('Mana Recharge Shrine')

    const drawables = buildSceneDrawables(renderableUnits)
    const resistFireDrawable = drawables.unitDrawables.find((d) => d.unitId === 801)
    const fireShrineDrawable = drawables.unitDrawables.find((d) => d.unitId === 802)
    const manaRechargeDrawable = drawables.unitDrawables.find((d) => d.unitId === 803)
    expect(resistFireDrawable?.interactType).toBe(8)
    expect(resistFireDrawable?.flags).toBe(8)
    expect(fireShrineDrawable?.interactType).toBe(19)
    expect(fireShrineDrawable?.flags).toBe(19)
    expect(manaRechargeDrawable?.flags).toBe(13)
  })

  it('5. Renders dual-layer (icon + shimmer) with blendMode trans50, AnimRate=8, and yOffset=-60 ONLY for Code 6..15 in Mode 0 (NU)', () => {
    const objArt = createMockShrineObjectArt('SF')
    const objectArtMap = new Map<string, LoadedObjectArt>([['sf', objArt]])

    const overlayNames = [
      'shrine_armor',
      'shrine_combat',
      'shrine_resist_fire',
      'shrine_resist_cold',
      'shrine_resist_lightning',
      'shrine_resist_poison',
      'shrine_skill',
      'shrine_mana_regen',
      'shrine_stamina',
      'shrine_experience',
      'shrine_shimmer00',
      'shrine_shimmer01',
    ] as const

    const overlayArtMap = new Map<string, LoadedOverlayArt>()
    const handleByToken = new Map<string, AtlasHandle>()
    overlayNames.forEach((name, idx) => {
      const art = createMockOverlayArt(name, 100 + idx)
      overlayArtMap.set(name, art)
      handleByToken.set(name, art.handle)
    })

    const ctx: SceneSourceRenderContext = {
      source: {} as any,
      lightingPreset: 'auto',
      objectArtMap,
      overlayArtMap,
    }

    // All 13 non-Booster codes (0..5 and 16..22, including Code 3 Mana Shrine and Code 19 Fire Shrine):
    // ONLY 1 draw call (the shrine base object sprite), ZERO overhead overlay draw calls!
    for (const code of NON_BOOSTER_CODES) {
      const { renderer, drawnCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(
        renderer,
        makeShrineDrawable(2, 0, { interactType: code }),
        ctx,
        0,
        1,
      )
      expect(drawnCalls, `Non-booster Code=${code} should have 0 overhead icons`).toHaveLength(1)
      expect(drawnCalls[0]?.atlas).toBe(objArt.handle)
    }

    // All 10 Booster codes (6..15) in Mode 0 (NU):
    // 3 draw calls: [0] shrine object, [1] primary icon (trans50), [2] shimmer00/01 (trans50)
    for (let code = 6; code <= 15; code++) {
      const expected = EXPECTED_BOOSTER_SHRINE_OVERLAYS[code]!
      const { renderer, drawnCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(
        renderer,
        makeShrineDrawable(2, 0, { interactType: code, worldX: 400, worldY: 300 }),
        ctx,
        0,
        1,
      )
      expect(drawnCalls, `Booster Code=${code} should draw base + icon + shimmer`).toHaveLength(3)
      expect(drawnCalls[0]?.atlas).toBe(objArt.handle)
      expect(drawnCalls[1]?.atlas).toBe(handleByToken.get(expected.icon))
      expect(drawnCalls[1]?.blendMode).toBe('additive')
      expect(drawnCalls[2]?.atlas).toBe(handleByToken.get(expected.shimmer))
      expect(drawnCalls[2]?.blendMode).toBe('additive')

      // Verify Height4 = -60 yOffset positioning: worldY (300) + objYOffset (0) + yOffset (-60) + anchorY
      const iconArt = overlayArtMap.get(expected.icon)!
      const shimmerArt = overlayArtMap.get(expected.shimmer)!
      expect(drawnCalls[1]?.y).toBe(300 - 60 + iconArt.frames[0]![0]!.anchorY!)
      expect(drawnCalls[2]?.y).toBe(300 - 60 + shimmerArt.frames[0]![0]!.anchorY!)
    }

    // Verify AnimRate = 8 (stepSpeed256 = 128 -> advances 1 frame every 80ms = 2 game ticks at 25fps)
    const { renderer: r80, drawnCalls: calls80 } = createMockSpriteRenderer()
    drawSceneUnitDrawable(
      r80,
      makeShrineDrawable(2, 0, { interactType: 13 }),
      ctx,
      80,
      1,
    )
    expect(calls80).toHaveLength(3)
    expect(calls80[1]?.frame).toBe(overlayArtMap.get('shrine_mana_regen')!.frames[0]![1])
    expect(calls80[2]?.frame).toBe(overlayArtMap.get('shrine_shimmer01')!.frames[0]![1])

    // Mode 1 (OP) and Mode 2 (ON) (activated/spent shrine): ZERO overhead overlays drawn!
    for (const mode of [1, 2]) {
      for (const code of [8, 13]) {
        const { renderer, drawnCalls } = createMockSpriteRenderer()
        drawSceneUnitDrawable(
          renderer,
          makeShrineDrawable(2, mode, { interactType: code }),
          ctx,
          0,
          1,
        )
        expect(drawnCalls, `Mode=${mode} Code=${code} must suppress overhead overlays`).toHaveLength(1)
        expect(drawnCalls[0]?.atlas).toBe(objArt.handle)
      }
    }
  })
})

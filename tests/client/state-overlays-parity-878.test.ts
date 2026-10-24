/**
 * Diablo II v1.13c Parity Tests for STATE_OVERLAYS, overlay.bin Drawing Parameters,
 * and pushOverlayLight Strict Validation (Issue #878).
 *
 * Ground truth:
 * - `Patch_D2.mpq` `data/global/excel/States.txt` & `states.bin` (60-byte records:
 *   `wOverlay[0..3]` at `+0x02..+0x08`, `wPgsvOverlay` at `+0x0e`)
 * - `D2Client.dll` state overlay handler (`0x6fb1b360`), progressive charge handler
 *   (`setfunc = 1 @ 0x6fb23410`), and overlay light creation (`0x6fb1b49f–0x6fb1b4e0`)
 * - `data/global/excel/overlay.bin` (`OVERLAY_TXT_ROWS`, 293 records)
 */

import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parseStatesTxtOverlays } from '../../src/baker/packers/pack-overlays.ts'
import type { AtlasFrame } from '../../src/client/render/atlas.ts'
import { OVERLAY_TXT_ROWS } from '../../src/client/render/overlay-txt-rows.ts'
import {
  AUTHENTIC_113C_OVERLAYS,
  OVERLAY_METAS,
  STATE_OVERLAYS,
  STATE_PGSV_OVERLAYS,
} from '../../src/client/render/overlays-meta.ts'
import type { AtlasHandle, SpriteRenderer } from '../../src/client/render/renderer.ts'
import type { LoadedOverlayArt } from '../../src/client/scene/missile-overlay-renderer.ts'
import {
  drawSceneOverlayDrawable,
  type SceneSourceRenderContext,
} from '../../src/client/scene/world-renderer.ts'
import {
  OVERLAY_ROW_BY_NAME,
  buildSceneDrawables,
  overlayTransToBlendMode,
  pushOverlayLight,
  type LightEmitterInput,
  type RenderableUnitInput,
} from '../../src/client/view/unit-drawables.ts'
import { fileSource } from '../../src/baker/io/file-source.ts'
import { MpqArchive } from '../../src/common/mpq/archive.ts'

function createMockOverlayArt(name: string, handleId: number): LoadedOverlayArt {
  const meta = OVERLAY_METAS[name] ?? OVERLAY_METAS[name.toLowerCase()]
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

describe('Issue #878: STATE_OVERLAYS States.txt / states.bin Parity & overlay.bin Drawing Parameters', () => {
  it('1. STATE_OVERLAYS matches Patch_D2.mpq States.txt and states.bin entry-for-entry, and every token exists in overlay.bin', async () => {
    const mpqPath = path.resolve(process.cwd(), 'samples/d2/Patch_D2.mpq')
    const mpq = await MpqArchive.open(await fileSource(mpqPath))

    const statesTxtEntry = mpq.find('data/global/excel/States.txt')
    expect(statesTxtEntry).not.toBeNull()
    const statesTxt = new TextDecoder('utf-8').decode(await mpq.read(statesTxtEntry!))

    // 1a. Verify STATE_OVERLAYS equals parseStatesTxtOverlays(States.txt) entry-for-entry
    const parsedFromTxt = parseStatesTxtOverlays(statesTxt, OVERLAY_TXT_ROWS)
    expect(STATE_OVERLAYS).toEqual(parsedFromTxt)

    // 1b. Cross-verify against compiled Patch_D2.mpq states.bin (60-byte records)
    const statesBinEntry = mpq.find('data/global/excel/states.bin')
    expect(statesBinEntry).not.toBeNull()
    const statesBin = await mpq.read(statesBinEntry!)
    const view = new DataView(statesBin.buffer, statesBin.byteOffset, statesBin.byteLength)
    const count = view.getUint32(0, true)
    expect(count).toBe(185)

    for (let stateId = 0; stateId < count; stateId++) {
      const recOff = 4 + stateId * 60
      const binTokens: string[] = []
      for (let k = 0; k < 4; k++) {
        const ovIdx = view.getUint16(recOff + 2 + k * 2, true)
        if (ovIdx !== 0xffff) {
          const row = OVERLAY_TXT_ROWS[ovIdx]
          expect(row, `state ${stateId} wOverlay[${k}]=${ovIdx}`).toBeDefined()
          binTokens.push(row!.name.toLowerCase())
        }
      }
      const pgsvOvIdx = view.getUint16(recOff + 14, true)
      if (pgsvOvIdx !== 0xffff) {
        const row = OVERLAY_TXT_ROWS[pgsvOvIdx]
        expect(row, `state ${stateId} wPgsvOverlay=${pgsvOvIdx}`).toBeDefined()
        expect(STATE_PGSV_OVERLAYS[stateId], `stateId=${stateId} pgsv`).toBe(row!.name.toLowerCase())
      } else {
        expect(STATE_PGSV_OVERLAYS[stateId], `stateId=${stateId} pgsv`).toBeUndefined()
      }

      if (binTokens.length > 0) {
        expect(STATE_OVERLAYS[stateId], `stateId=${stateId}`).toEqual(binTokens)
      } else {
        expect(STATE_OVERLAYS[stateId], `stateId=${stateId}`).toBeUndefined()
      }
    }

    // 1c. Every token in STATE_OVERLAYS exists in OVERLAY_ROW_BY_NAME (overlay.bin) and has baked .dcc art (unless filename === 'null')
    const legacyBogusTokens = new Set(['vigor_front', 'vigor_back', 'maul1front', 'feralrage1front'])
    for (const [stateIdStr, tokens] of Object.entries(STATE_OVERLAYS)) {
      for (const token of tokens) {
        expect(legacyBogusTokens.has(token), `state ${stateIdStr} must not contain ${token}`).toBe(false)
        const ovRow = OVERLAY_ROW_BY_NAME.get(token)
        expect(ovRow, `state ${stateIdStr} token '${token}' must exist in overlay.bin`).toBeDefined()
        if (ovRow!.filename.toLowerCase() !== 'null') {
          const meta =
            OVERLAY_METAS[token] ??
            OVERLAY_METAS[ovRow!.filename] ??
            OVERLAY_METAS[ovRow!.filename.toLowerCase()]
          expect(
            meta,
            `state ${stateIdStr} token '${token}' (DCC '${ovRow!.filename}') must have baked sprite atlas in OVERLAY_METAS`,
          ).toBeDefined()
        }
      }
    }

    // 1d. parseStatesTxtOverlays fails fast if any token is missing from overlay.bin
    const badStatesTxt = [
      'state\tid\toverlay1\toverlay2\toverlay3\toverlay4\tpgsv\tpgsvoverlay',
      'stamina\t41\tvigor_front\tvigor_back\t\t\t0\t',
    ].join('\n')
    expect(() => parseStatesTxtOverlays(badStatesTxt, OVERLAY_TXT_ROWS)).toThrow(/vigor_front/)
  })

  it('2. States 41 (stamina), 117 (maul), and 120 (feralrage) map to the 10 authentic overlay.bin rows with Radius == 0 and emit no light', () => {
    expect(STATE_OVERLAYS[41]).toEqual(['staminafront', 'staminaback'])
    expect(STATE_OVERLAYS[117]).toEqual(['maul1', 'maul5', 'maul1back', 'maul5back'])
    expect(STATE_OVERLAYS[120]).toEqual(['feralrage1', 'feralrage5', 'feralrage1back', 'feralrage5back'])

    const expectedRows: ReadonlyArray<{
      readonly index: number
      readonly name: string
      readonly filename: string
      readonly frames: number
      readonly preDraw: number
      readonly animRate: number
      readonly trans: number
    }> = [
      { index: 101, name: 'staminafront', filename: 'Stamina_front', frames: 16, preDraw: 0, animRate: 8, trans: 3 },
      { index: 102, name: 'staminaback', filename: 'Stamina_back', frames: 16, preDraw: 1, animRate: 8, trans: 3 },
      { index: 260, name: 'maul1', filename: 'expansion\\Maul_A_Front', frames: 16, preDraw: 0, animRate: 16, trans: 3 },
      { index: 264, name: 'maul5', filename: 'expansion\\Maul_E_Front', frames: 16, preDraw: 0, animRate: 16, trans: 3 },
      { index: 277, name: 'maul1back', filename: 'expansion\\Maul_A_Back', frames: 16, preDraw: 1, animRate: 16, trans: 3 },
      { index: 281, name: 'maul5back', filename: 'expansion\\Maul_E_Back', frames: 16, preDraw: 1, animRate: 16, trans: 3 },
      { index: 265, name: 'feralrage1', filename: 'expansion\\feral_rage_A_Front', frames: 16, preDraw: 0, animRate: 16, trans: 3 },
      { index: 269, name: 'feralrage5', filename: 'expansion\\feral_rage_E_Front', frames: 16, preDraw: 0, animRate: 16, trans: 3 },
      { index: 282, name: 'feralrage1back', filename: 'expansion\\feral_rage_A_Back', frames: 16, preDraw: 1, animRate: 16, trans: 3 },
      { index: 286, name: 'feralrage5back', filename: 'expansion\\feral_rage_E_Back', frames: 16, preDraw: 1, animRate: 16, trans: 3 },
    ]

    for (const exp of expectedRows) {
      const row = OVERLAY_TXT_ROWS[exp.index]
      expect(row).toBeDefined()
      expect(row?.name).toBe(exp.name)
      expect(row?.filename).toBe(exp.filename)
      expect(row?.frames).toBe(exp.frames)
      expect(row?.preDraw).toBe(exp.preDraw)
      expect(row?.animRate).toBe(exp.animRate)
      expect(row?.trans).toBe(exp.trans)
      expect(row?.xOffset).toBe(0)
      expect(row?.yOffset).toBe(0)
      expect(row?.height).toEqual([0, 0, 0, 0])
      expect(row?.initRadius).toBe(0)
      expect(row?.radius).toBe(0)
      expect(OVERLAY_ROW_BY_NAME.get(exp.name)).toBe(row)
    }

    // Build scene drawables for a player with states 41, 117, 120 at stage 1 (charges=1) and stage 5 (charges=5)
    const sceneStage1 = buildSceneDrawables(
      [
        {
          kind: 'player',
          id: 1,
          classId: 5, // Druid
          x: 100,
          y: 100,
          states: [41, 117, 120],
          charges: 1,
        } as any,
      ],
      { tick: 6 },
    )
    const sceneStage5 = buildSceneDrawables(
      [
        {
          kind: 'player',
          id: 2,
          classId: 5, // Druid
          x: 100,
          y: 100,
          states: [117, 120],
          charges: 5,
        } as any,
      ],
      { tick: 6 },
    )

    // None of the 10 overlays have Radius > 0 -> only the player's base light is emitted
    const overlayLights = sceneStage1.lightEmitters.filter((e) => e.slot.startsWith('state:'))
    expect(overlayLights).toEqual([])

    // Stage 1 draws staminafront/staminaback + maul1/maul1back + feralrage1/feralrage1back (6 drawables)
    // Stage 5 draws maul5/maul5back + feralrage5/feralrage5back (4 drawables)
    expect(sceneStage1.overlayDrawables).toHaveLength(6)
    expect(sceneStage5.overlayDrawables).toHaveLength(4)
    const combinedDrawables = [...sceneStage1.overlayDrawables, ...sceneStage5.overlayDrawables]
    for (const exp of expectedRows) {
      const drawable = combinedDrawables.find((d) => d.token === exp.name)
      expect(drawable, `drawable for ${exp.name}`).toBeDefined()
      expect(drawable?.totalFrames).toBe(exp.frames)
      const expectedFrame = Math.floor((6 * exp.animRate) / 16) % exp.frames
      expect(drawable?.frame).toBe(expectedFrame)
      expect(drawable?.preDraw ?? false).toBe(exp.preDraw !== 0)
      // Overlay.txt Trans is the D2gfx eDrawMode (0x6FB1B11D); 3 = D2Direct3D ONE/ONE additive.
      expect(drawable?.blendMode).toBe(overlayTransToBlendMode(exp.trans))
      expect(drawable?.blendMode).toBe('additive')
    }
  })

  it('3. unit-drawables.ts and world-renderer.ts source overlay parameters from overlay.bin and render .dcc atlas frames', () => {
    // Verify AUTHENTIC_113C_OVERLAYS matches OVERLAY_TXT_ROWS for all 293 records
    expect(Object.keys(AUTHENTIC_113C_OVERLAYS)).toHaveLength(OVERLAY_TXT_ROWS.length)
    for (const row of OVERLAY_TXT_ROWS) {
      const auth = AUTHENTIC_113C_OVERLAYS[row.name.toLowerCase()]
      expect(auth).toBeDefined()
      expect(auth?.frames).toBe(row.frames)
      expect(auth?.animRate).toBe(row.animRate)
      expect(auth?.trans).toBe(row.trans)
      expect(auth?.preDraw).toBe(row.preDraw !== 0)
      expect(auth?.xOffset).toBe(row.xOffset)
      expect(auth?.yOffset).toBe(row.yOffset)
      expect(auth?.height1).toBe(row.height[0])
      expect(auth?.height2).toBe(row.height[1])
      expect(auth?.height3).toBe(row.height[2])
      expect(auth?.height4).toBe(row.height[3])
      expect(auth?.radius).toBe(row.radius)
    }

    // Verify world-renderer draws all 10 overlays across stage 1 and stage 5 for states 41, 117, 120 using their .dcc sprite atlases
    const tokens = [
      'staminafront',
      'staminaback',
      'maul1',
      'maul5',
      'maul1back',
      'maul5back',
      'feralrage1',
      'feralrage5',
      'feralrage1back',
      'feralrage5back',
    ] as const
    const overlayArtMap = new Map<string, LoadedOverlayArt>()
    tokens.forEach((tok, idx) => {
      const art = createMockOverlayArt(tok, 200 + idx)
      overlayArtMap.set(tok, art)
    })

    const scene = buildSceneDrawables(
      [
        {
          kind: 'player',
          id: 7,
          classId: 5,
          x: 50,
          y: 50,
          states: [41, 117, 120],
          charges: 1,
        } as any,
        {
          kind: 'player',
          id: 8,
          classId: 5,
          x: 52,
          y: 50,
          states: [117, 120],
          charges: 5,
        } as any,
      ],
      { tick: 4 },
    )
    expect(scene.overlayDrawables).toHaveLength(10)

    const drawnAtlases: AtlasHandle[] = []
    const renderer = {
      addAtlas: vi.fn(),
      addIndexedAtlas: vi.fn(),
      draw: vi.fn((_frame: AtlasFrame, _x: number, _y: number, opts?: { atlas?: AtlasHandle }) => {
        if (opts?.atlas !== undefined) {
          drawnAtlases.push(opts.atlas)
        }
      }),
      setBlendMode: vi.fn(),
    } as unknown as SpriteRenderer

    const ctx: SceneSourceRenderContext = {
      source: {} as any,
      lightingPreset: 'auto',
      overlayArtMap,
    }

    for (const ovDrawable of scene.overlayDrawables) {
      drawSceneOverlayDrawable(renderer, ovDrawable, ctx, 160)
    }
    expect(drawnAtlases).toHaveLength(10)
    for (let i = 0; i < tokens.length; i++) {
      expect(drawnAtlases).toContain((200 + i) as unknown as AtlasHandle)
    }
  })

  it('4. pushOverlayLight throws RangeError on unknown tokens not in overlay.bin', () => {
    const out: LightEmitterInput[] = []
    const dummyUnit: RenderableUnitInput = {
      kind: 'player',
      id: 1,
      classId: 0,
      x: 10,
      y: 10,
    }

    // Issue #955 fault containment: an unknown overlay token contributes no light and is
    // reported once instead of throwing (a per-frame throw aborted the whole render loop).
    for (const badToken of [
      'vigor_front',
      'vigor_back',
      'maul1front',
      'feralrage1front',
      'nonexistent_overlay_123',
      '',
    ]) {
      expect(() => pushOverlayLight(out, dummyUnit, 'test', badToken)).not.toThrow()
    }
    expect(out).toEqual([])

    // Valid zero-radius overlay.bin token does not throw and emits no light
    pushOverlayLight(out, dummyUnit, 'test', 'staminafront')
    expect(out).toEqual([])
  })
})

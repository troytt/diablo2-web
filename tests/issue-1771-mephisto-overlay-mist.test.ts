/**
 * Issue #1771: Mephisto (`hcIdx 242`) & Uber Mephisto (`hcIdx 704`) swirling white mist (`Overlay.txt` #122
 * `mephisto` -> `Data\Global\Overlays\MephistoOverlay.DC6`) + 734-monster `D2Client.dll` overlay sweep.
 *
 * Ground truth (`kb/monsters/d2client-monster-overlays-mephisto-113c.md`):
 * 1. `Data\Global\Overlays\MephistoOverlay.DC6` in `d2data.mpq` (loaded via `0x6FB1E628 -> 0x6FB1D800 -> D2CMP!#10005`):
 *    1 direction, 26 frames, `AnimRate = 16`, `Trans = 3` (`additive`), `PreDraw = 0` (`false`), frame 0 `217x190`
 *    at `offsetX = -106, offsetY = 52` (`anchorX = -106, anchorY = -137`).
 * 2. `D2Client.dll` `0x6FB570C0` (`ClientMonster_InitSpecial`) & `0x6FAFD610` (`ClientMonster_SetupClassData`):
 *    - `242` (`mephisto`) & `704` (`ubermephisto`): loop `#122` (`mephisto`),
 *    - `543` (`baalthrone`): loop `#275` (`baal_on_throne`), cleared on `StateSet` `#142` (`changeclass` -> `559`),
 *    - `527` (`drehyaiced`): static `#227` (`ice_cage`),
 *    - `351..353` (`hydra1..3`): `#172..174` (`hydra_start1..3`) -> `#175..177` (`hydra_loop1..3`),
 *    - `333` (`diabloclone`): one-shot `#186` (`light_cast_2`),
 *    - `417..418` (`shadowwarrior`, `shadowmaster`): one-shot `#270` (`shadowwarriorappear`).
 * 3. `D2Client.dll` `0x6FAFE3DF` (`MONMODE_DEATH`) & `0x6FAFE847` (`MONMODE_DEAD`):
 *    - Mephisto keeps `#122` during `DT` (`mode = 0`),
 *    - `mephistodonotdraw` (`#306`, `Range = 70`) `MissCltHitFunc[34]` (`0x6FB607E0`) sets `owner.clientNoDraw = true`,
 *      suppressing both Mephisto's unit sprite and all unit overlays (`buildUnitDrawables`) so mist never lingers,
 *    - Entering `DD` (`mode = 12`) runs `FreeAllUnitOverlays` (`0x6FB19610`), clearing Uber Mephisto's mist on corpse,
 *    - Hydra `DT` clears `hydra_start/loop` and plays `hydra_end1..3` (`#178..180`); Shadow `DT` plays `shadowwarriordeath` (`#271`).
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { fileSource } from '../src/baker/io/file-source.ts'
import { celFileArtKey } from '../src/client/render/cel-file-key.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import { OVERLAY_METAS } from '../src/client/render/overlays-meta.ts'
import type { AtlasHandle, SpriteRenderer } from '../src/client/render/renderer.ts'
import type { LoadedOverlayArt } from '../src/client/scene/missile-overlay-renderer.ts'
import {
  clearMissingArtEntries,
  drawSceneOverlayDrawable,
  getMissingArtEntries,
} from '../src/client/scene/world-renderer.ts'
import { OnlineSession } from '../src/client/session/online-session.ts'
import { buildSceneDrawables as buildUnitDrawables } from '../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { decodeDc6 } from '../src/common/formats/dc6.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'

const D2_DATA_DIR = process.env.D2_DATA_DIR ?? join(homedir(), 'd2-data')

function buildOverlayArtMapForTest(): Map<string, LoadedOverlayArt> {
  const map = new Map<string, LoadedOverlayArt>()
  let nextHandle = 1
  for (const [key, meta] of Object.entries(OVERLAY_METAS)) {
    const handle = (nextHandle++) as unknown as AtlasHandle
    const frames = meta.groups.map(group =>
      group.map(([x, y, width, height, anchorX, anchorY]) => ({
        x,
        y,
        width,
        height,
        anchorX,
        anchorY,
      })),
    )
    const entry: LoadedOverlayArt = { meta, handle, frames }
    map.set(key, entry)
    map.set(key.toLowerCase(), entry)
    if (meta.celFile && meta.celFile.toLowerCase() !== 'null') {
      map.set(celFileArtKey(meta.celFile), entry)
    }
  }
  return map
}

function decodeRgbaPng(png: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let width = 0
  let height = 0
  const idatChunks: Uint8Array[] = []
  let offset = 8
  while (offset + 8 <= png.byteLength) {
    const length = view.getUint32(offset, false)
    const type = String.fromCharCode(
      png[offset + 4]!,
      png[offset + 5]!,
      png[offset + 6]!,
      png[offset + 7]!,
    )
    const payload = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8, false)
      height = view.getUint32(offset + 12, false)
    } else if (type === 'IDAT') {
      idatChunks.push(payload)
    }
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idatChunks))
  const stride = width * 4
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const rowIn = y * (1 + stride)
    const filter = raw[rowIn]!
    const rowOut = y * stride
    for (let x = 0; x < stride; x++) {
      const b = raw[rowIn + 1 + x]!
      const left = x >= 4 ? pixels[rowOut + x - 4]! : 0
      const up = y > 0 ? pixels[rowOut - stride + x]! : 0
      const upLeft = y > 0 && x >= 4 ? pixels[rowOut - stride + x - 4]! : 0
      if (filter === 0) {
        pixels[rowOut + x] = b
      } else if (filter === 1) {
        pixels[rowOut + x] = (b + left) & 0xff
      } else if (filter === 2) {
        pixels[rowOut + x] = (b + up) & 0xff
      } else if (filter === 3) {
        pixels[rowOut + x] = (b + ((left + up) >>> 1)) & 0xff
      } else {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
        pixels[rowOut + x] = (b + pr) & 0xff
      }
    }
  }
  return { width, height, pixels }
}

function readPngChunkTypes(png: Uint8Array): string[] {
  const chunks: string[] = []
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let offset = 8
  while (offset + 8 <= png.byteLength) {
    const length = view.getUint32(offset, false)
    const type = String.fromCharCode(
      png[offset + 4]!,
      png[offset + 5]!,
      png[offset + 6]!,
      png[offset + 7]!,
    )
    chunks.push(type)
    offset += 12 + length
  }
  return chunks
}

describe('Issue #1771: Mephisto white mist (Overlay #122 MephistoOverlay.DC6) & 734-monster overlay sweep', () => {
  it('decodes Data\\Global\\Overlays\\MephistoOverlay.DC6 from d2data.mpq into OVERLAY_METAS with exact 1.13c anchors & additive blend', async () => {
    const row122 = OVERLAY_TXT_ROWS[122]
    expect(row122).toBeDefined()
    expect(row122!.name).toBe('mephisto')
    expect(row122!.filename).toBe('MephistoOverlay')
    expect(row122!.frames).toBe(26)
    expect(row122!.animRate).toBe(16)
    expect(row122!.trans).toBe(3)
    expect(row122!.preDraw).toBe(0)

    const meta = OVERLAY_METAS['mephisto']
    expect(meta).toBeDefined()
    expect(OVERLAY_METAS['MephistoOverlay']).toBe(meta)
    expect(OVERLAY_METAS['mephistooverlay']).toBe(meta)
    expect(meta!.celFile).toBe('MephistoOverlay')
    expect(meta!.directions).toBe(1)
    expect(meta!.frames).toBe(26)
    expect(meta!.framesPerDirection).toBe(26)
    expect(meta!.animRate).toBe(16)
    expect(meta!.trans).toBe(3)
    expect(meta!.blendMode).toBe('additive')
    expect(meta!.preDraw).toBe(false)
    expect(meta!.lightRadius).toBe(0)
    expect(meta!.lightColor).toEqual([255, 255, 255])
    expect(meta!.box).toEqual({ left: -108, top: -137, width: 224, height: 190 })
    expect(meta!.groups.length).toBe(1)
    expect(meta!.groups[0]!.length).toBe(26)

    // Frame 0 in MephistoOverlay.DC6: width=217, height=190, offsetX=-106, offsetY=52 -> anchor (-106, -137)
    const f0 = meta!.groups[0]![0]!
    expect([f0[2], f0[3], f0[4], f0[5]]).toEqual([217, 190, -106, -137])

    const d2dataPath = join(D2_DATA_DIR, 'd2data.mpq')
    if (existsSync(d2dataPath)) {
      const mpq = await MpqArchive.open(await fileSource(d2dataPath))
      const entry = mpq.find('data/global/overlays/MephistoOverlay.dc6')
      expect(entry).not.toBeNull()
      const dc6 = decodeDc6(await mpq.read(entry!))
      expect(dc6.header.directions).toBe(1)
      expect(dc6.header.framesPerDirection).toBe(26)
      for (let i = 0; i < 26; i++) {
        const srcFrame = dc6.groups[0]!.frames[i]!
        const bakedTuple = meta!.groups[0]![i]!
        expect(bakedTuple[2]).toBe(srcFrame.width)
        expect(bakedTuple[3]).toBe(srcFrame.height)
        expect(bakedTuple[4]).toBe(srcFrame.offsetX)
        expect(bakedTuple[5]).toBe(srcFrame.offsetY - srcFrame.height + 1)
      }
    }

    const publicPngPath = join(__dirname, '..', 'public', 'overlays', 'mephisto.png')
    if (existsSync(publicPngPath)) {
      const pngBytes = new Uint8Array(readFileSync(publicPngPath))
      expect(new Set(readPngChunkTypes(pngBytes))).toEqual(new Set(['IHDR', 'IDAT', 'IEND']))
      const decoded = decodeRgbaPng(pngBytes)
      // Palette index 0 at top-left corner of frame 0 must remain fully transparent (alpha = 0, no black box)
      expect(decoded.pixels[3]).toBe(0)
      let nonZeroMistPixels = 0
      for (let p = 0; p < decoded.pixels.length; p += 4) {
        if (decoded.pixels[p + 3]! > 0) nonZeroMistPixels++
      }
      expect(nonZeroMistPixels).toBeGreaterThan(500000)
    }
  })

  it('renders swirling white mist post-overlay across NU, WL, A1, A2, GH, and DT for both mephisto (242) and ubermephisto (704)', () => {
    const overlayArtMap = buildOverlayArtMapForTest()
    const modes = [1, 2, 4, 5, 3, 0] // NU, WL, A1, A2, GH, DT

    for (const classId of [242, 704]) {
      for (const mode of modes) {
        clearMissingArtEntries()
        const scene = buildUnitDrawables(
          [
            {
              kind: 'monster',
              id: 500 + classId,
              classId,
              x: 120,
              y: 120,
              mode,
              lifePct: mode === 0 ? 0 : 128,
            },
          ],
          { tick: 10 },
        )
        expect(scene.unitDrawables.length).toBe(1)
        const mistOverlays = scene.overlayDrawables.filter(o => o.token === 'mephisto')
        expect(mistOverlays.length).toBe(1)
        const mist = mistOverlays[0]!
        expect(mist.overlayId).toBe(122)
        expect(mist.totalFrames).toBe(26)
        expect(mist.frame).toBe(10 % 26)
        expect(mist.loop).toBe(true)
        expect(mist.blendMode).toBe('additive')
        expect(mist.preDraw).toBeUndefined()

        // Post-draw overlay must sort AFTER Mephisto's unit body
        const unitIdx = scene.sortedDrawables.findIndex(d => d.drawableKind === 'unit')
        const ovIdx = scene.sortedDrawables.findIndex(d => d.drawableKind === 'overlay')
        expect(unitIdx).toBeGreaterThanOrEqual(0)
        expect(ovIdx).toBeGreaterThan(unitIdx)

        const drawnCalls: Array<{ x: number; y: number; blendMode?: string | undefined }> = []
        const mockRenderer = {
          draw: (_frame: unknown, drawX: number, drawY: number, opts?: { blendMode?: string }) => {
            drawnCalls.push({ x: drawX, y: drawY, blendMode: opts?.blendMode })
          },
        } as unknown as SpriteRenderer
        drawSceneOverlayDrawable(
          mockRenderer,
          mist,
          { overlayArtMap } as unknown as Parameters<typeof drawSceneOverlayDrawable>[2],
          0,
        )
        expect(getMissingArtEntries()).toEqual([])
        expect(drawnCalls.length).toBe(1)
        const expectedFrame = OVERLAY_METAS['mephisto']!.groups[0]![mist.frame]!
        expect(drawnCalls[0]!.x).toBe(mist.worldX + expectedFrame[4])
        expect(drawnCalls[0]!.y).toBe(mist.worldY + expectedFrame[5])
        expect(drawnCalls[0]!.blendMode).toBe('additive')
      }
    }
  })

  it('keeps mist during Mephisto death show ticks 0..69 and suppresses both body and mist on tick 70 when mephistodonotdraw expires (MissCltHitFunc[34] 0x6FB607E0)', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 2420,
        classId: 242,
        name: 'mephisto',
        x: 200,
        y: 200,
        mode: 1,
        lifePct: 128,
      },
    })

    const mephisto = world.getUnit('monster', 2420)!
    expect(mephisto.overlays.map(o => o.token)).toEqual(['mephisto'])
    expect(mephisto.overlays[0]!.loop).toBe(true)

    // Enter MONMODE_DEATH (mode 0) -> spawns mephistodeathcontrol (#299), mephistoholedelay (#358), mephistodonotdraw (#306, Range=70)
    world.applyEvent({
      type: 'UnitMode',
      unitType: 'monster',
      id: 2420,
      mode: 0,
      lifePct: 0,
    })

    const deathMissiles = world.getUnitsByType('missile').map(m => m.missileKey)
    expect(deathMissiles).toContain('mephistodeathcontrol')
    expect(deathMissiles).toContain('mephistoholedelay')
    expect(deathMissiles).toContain('mephistodonotdraw')

    // Ticks 1..69: mist stays active during DT; at elapsed=15 (tick 16), 4 corpseexplosions spawn
    let sawFourCorpseExplosions = false
    for (let t = 1; t <= 69; t++) {
      world.tick()
      expect(mephisto.clientNoDraw).toBeFalsy()
      const sceneDuringDt = buildUnitDrawables([mephisto as any], { tick: t })
      expect(sceneDuringDt.unitDrawables.length).toBe(1)
      expect(sceneDuringDt.overlayDrawables.filter(o => o.token === 'mephisto').length).toBe(1)
      const ceCount = world.getUnitsByType('missile').filter(m => m.missileKey === 'corpseexplosion').length
      if (ceCount === 4) sawFourCorpseExplosions = true
    }
    expect(sawFourCorpseExplosions).toBe(true)

    // Tick 70: mephistodonotdraw reaches Range=70 -> MissCltHitFunc[34] (0x6FB607E0) sets clientNoDraw = true
    world.tick()
    expect(mephisto.clientNoDraw).toBe(true)

    const sceneAfterDoNotDraw = buildUnitDrawables([mephisto as any], { tick: 70 })
    expect(sceneAfterDoNotDraw.unitDrawables).toEqual([])
    expect(sceneAfterDoNotDraw.overlayDrawables).toEqual([])
    expect(sceneAfterDoNotDraw.sortedDrawables).toEqual([])

    // D2Client 0x6FB1B363: while clientNoDraw is set, no new unit overlays may be attached
    world.attachUnitOverlay(mephisto, 'healing', false)
    world.attachServerOverlay(mephisto, 122)
    const sceneStillHidden = buildUnitDrawables([mephisto as any], { tick: 71 })
    expect(sceneStillHidden.overlayDrawables).toEqual([])
  })

  it('OnlineSession.buildRenderableUnits & CommandMapper suppress Mephisto corpse, mist overlay, and corpse-skill targeting once clientNoDraw is set at tick 70', () => {
    const session = new OnlineSession()
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 2,
        name: 'Necro',
        x: 5000,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 2421,
        classId: 242,
        name: 'mephisto',
        x: 5004,
        y: 5004,
        mode: 1,
        lifePct: 128,
      },
    })

    const mephisto = session.world.getUnit('monster', 2421)!
    const aliveScene = buildUnitDrawables(session.buildRenderableUnits(), { tick: 5 })
    expect(aliveScene.unitDrawables.some(u => u.id === 2421)).toBe(true)
    expect(aliveScene.overlayDrawables.some(o => o.ownerUnitId === 2421 && o.token === 'mephisto')).toBe(true)

    // Mephisto dies (mode 0) -> spawns mephistodonotdraw (Range = 70)
    session.handleServerEvent({
      type: 'UnitMode',
      unitType: 'monster',
      id: 2421,
      mode: 0,
      lifePct: 0,
    })

    for (let t = 1; t <= 69; t++) {
      session.tick(40, t * 40)
    }
    expect(mephisto.clientNoDraw).toBeFalsy()
    const midDtUnits = session.buildRenderableUnits(69 * 40)
    expect(midDtUnits.some(u => u.id === 2421)).toBe(true)
    const midDtScene = buildUnitDrawables(midDtUnits, { tick: 69 })
    expect(midDtScene.unitDrawables.some(u => u.id === 2421)).toBe(true)
    expect(midDtScene.overlayDrawables.some(o => o.ownerUnitId === 2421 && o.token === 'mephisto')).toBe(true)

    // Tick 70: mephistodonotdraw expires -> clientNoDraw = true; OnlineSession.buildRenderableUnits omits Mephisto & his mist
    session.tick(40, 70 * 40)
    expect(mephisto.clientNoDraw).toBe(true)

    const postNoDrawUnits = session.buildRenderableUnits(70 * 40)
    expect(postNoDrawUnits.some(u => u.id === 2421)).toBe(false)
    const postNoDrawScene = buildUnitDrawables(postNoDrawUnits, { tick: 70 })
    expect(postNoDrawScene.unitDrawables.some(u => u.id === 2421)).toBe(false)
    expect(postNoDrawScene.overlayDrawables.some(o => o.ownerUnitId === 2421)).toBe(false)

    // Corpse-skill targeting (e.g. Corpse Explosion #74, Desecrate/Find Item) must reject clientNoDraw corpse
    expect(session.commandMapper.isMonsterCorpse(mephisto)).toBe(false)
    expect(session.commandMapper.findNearestValidCorpseForSkill(5004, 5004, 74)).toBeNull()

    session.destroy()
  })

  it('clears Uber Mephisto (704) mist upon entering MONMODE_DEAD (mode 12, 0x6FAFE847 FreeAllUnitOverlays)', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 7040,
        classId: 704,
        name: 'ubermephisto',
        x: 150,
        y: 150,
        mode: 1,
        lifePct: 128,
      },
    })
    const uberMephisto = world.getUnit('monster', 7040)!
    expect(uberMephisto.overlays.map(o => o.token)).toEqual(['mephisto'])

    // During DT (mode 0), mist stays active
    world.applyEvent({
      type: 'UnitMode',
      unitType: 'monster',
      id: 7040,
      mode: 0,
      lifePct: 0,
    })
    expect(uberMephisto.overlays.map(o => o.token)).toEqual(['mephisto'])

    // Entering DD (mode 12) frees all overlays on corpse
    world.applyEvent({
      type: 'UnitMode',
      unitType: 'monster',
      id: 7040,
      mode: 12,
      lifePct: 0,
    })
    expect(uberMephisto.overlays).toEqual([])
    const corpseScene = buildUnitDrawables([uberMephisto as any], { tick: 30 })
    expect(corpseScene.overlayDrawables).toEqual([])
  })

  it('never attaches Mephisto mist to minions or non-Mephisto monsters', () => {
    const world = new ClientWorld()
    const nonMephistoClasses = [131, 212, 345, 346, 347, 243, 544] // vampire, bonefetish, council, diablo, baalcrab
    for (let i = 0; i < nonMephistoClasses.length; i++) {
      const classId = nonMephistoClasses[i]!
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: 9000 + i,
          classId,
          x: 100 + i * 3,
          y: 100,
          mode: 1,
          lifePct: 128,
          isMinion: true,
          ownerType: 'monster',
          ownerId: 2420,
        },
      })
      const mon = world.getUnit('monster', 9000 + i)!
      expect(mon.overlays.some(o => o.token === 'mephisto')).toBe(false)
      const scene = buildUnitDrawables([mon as any], { tick: 5 })
      expect(scene.overlayDrawables.some(o => o.token === 'mephisto')).toBe(false)
    }
  })

  it('734-monster sweep: attaches & transitions baalthrone (543), drehyaiced (527), hydra1..3 (351..353), diabloclone (333), and shadowwarrior/master (417..418) per D2Client.dll', () => {
    const world = new ClientWorld()

    // 1. Baal on Throne (543): loops baal_on_throne (#275), freed on state 142 changeclass -> 559 (baalcrabstairs)
    world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 5430, classId: 543, x: 100, y: 100, mode: 1, lifePct: 128 },
    })
    const baalThrone = world.getUnit('monster', 5430)!
    expect(baalThrone.overlays.map(o => o.token)).toEqual(['baal_on_throne'])
    expect(baalThrone.overlays[0]!.loop).toBe(true)

    world.applyEvent({
      type: 'StateSet',
      unit: { unitType: 'monster', id: 5430 },
      state: 142,
      stats: [{ statId: 355, param: 0, value: 559 }],
    })
    expect(baalThrone.classId).toBe(559)
    expect(baalThrone.overlays).toEqual([])

    // 2. Frozen Anya (drehyaiced, 527): static ice_cage (#227, animRate=0, holds frame 0)
    world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 5270, classId: 527, x: 110, y: 100, mode: 1, lifePct: 128 },
    })
    const frozenAnya = world.getUnit('monster', 5270)!
    expect(frozenAnya.overlays.map(o => o.token)).toEqual(['ice_cage'])
    world.tick()
    world.tick()
    expect(frozenAnya.overlays[0]!.frame).toBe(0)

    // 3. Hydra heads (351..353): hydra_start1..3 -> hydra_loop1..3 -> on DT clears loop & plays hydra_end1..3
    for (const hydraClassId of [351, 352, 353]) {
      const idx = hydraClassId - 350
      const unitId = 3500 + hydraClassId
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: unitId,
          classId: hydraClassId,
          x: 120 + idx * 2,
          y: 100,
          mode: 1,
          lifePct: 128,
          ownerType: 'player',
          ownerId: 1,
        },
      })
      const hydra = world.getUnit('monster', unitId)!
      expect(hydra.overlays.map(o => o.token)).toEqual([`hydra_start${idx}`])
      expect(hydra.overlays[0]!.loop).toBe(false)
    }

    // Advance 16 ticks so hydra_start1..3 (16 frames, animRate 16) chain via onExpire into hydra_loop1..3
    for (let t = 0; t < 16; t++) {
      world.tick()
    }
    for (const hydraClassId of [351, 352, 353]) {
      const idx = hydraClassId - 350
      const hydra = world.getUnit('monster', 3500 + hydraClassId)!
      expect(hydra.overlays.map(o => o.token)).toEqual([`hydra_loop${idx}`])
      expect(hydra.overlays[0]!.loop).toBe(true)

      // Enter DT (mode 0): clears hydra_loop and attaches one-shot hydra_end
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: 3500 + hydraClassId,
        mode: 0,
        lifePct: 0,
      })
      expect(hydra.overlays.map(o => o.token)).toEqual([`hydra_end${idx}`])
      expect(hydra.overlays[0]!.loop).toBe(false)
    }

    // 4. Diablo Clone (333): one-shot light_cast_2 (#186)
    world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 3330, classId: 333, x: 140, y: 100, mode: 1, lifePct: 128 },
    })
    const dclone = world.getUnit('monster', 3330)!
    expect(dclone.overlays.map(o => o.token)).toEqual(['light_cast_2'])
    expect(dclone.overlays[0]!.loop).toBe(false)

    // 5. Shadow Warrior (417) & Shadow Master (418): shadowwarriorappear (#270) on spawn, shadowwarriordeath (#271) on DT
    for (const shadowClassId of [417, 418]) {
      const unitId = 4000 + shadowClassId
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: unitId,
          classId: shadowClassId,
          x: 150,
          y: 100,
          mode: 1,
          lifePct: 128,
          ownerType: 'player',
          ownerId: 1,
        },
      })
      const shadow = world.getUnit('monster', unitId)!
      expect(shadow.overlays.map(o => o.token)).toEqual(['shadowwarriorappear'])
      world.applyEvent({
        type: 'UnitMode',
        unitType: 'monster',
        id: unitId,
        mode: 0,
        lifePct: 0,
      })
      expect(shadow.overlays.some(o => o.token === 'shadowwarriordeath')).toBe(true)
    }
  })
})

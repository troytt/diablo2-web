import { describe, expect, it } from 'vitest'
import { scaleSoundEnvironEaxPreset113c } from '../../src/client/audio/sound-environ-113c.ts'
import { WebAudioSoundVoices } from '../../src/client/audio/sound-voices-webaudio.ts'
import { RemoteEntityInterpolator } from '../../src/client/motion/interpolate.ts'
import {
  EntityArtCache,
  type PackedEntityCatalogIndex,
} from '../../src/client/scene/entity-art-loader.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { hudRepaintUnchanged } from '../../src/client/ui/hud-world-overlays.ts'
import type { AtlasFrame } from '../../src/client/render/atlas.ts'
import type { AtlasHandle, SpriteRenderer } from '../../src/client/render/renderer.ts'
import {
  layoutGroundItemLabels,
  resolveGroundItemMetadata,
  type GroundItemLabelInput,
} from '../../src/common/items/ground-items.ts'
import { FakeAudioBuffer, FakeAudioContext, reaches } from '../audio/e2e/webaudio-fake.ts'

describe('Ground item & lobby performance regressions', () => {
  it('caches ground item metadata and preserves exact vertical collision placement', () => {
    const m1 = resolveGroundItemMetadata({ code: 'rin', quality: 7 })
    const m2 = resolveGroundItemMetadata({ code: 'rin', quality: 7 })
    expect(m2).toBe(m1)

    const inputs: GroundItemLabelInput[] = Array.from({ length: 12 }, (_, idx) => ({
      id: idx + 1,
      text: `Item ${idx + 1}`,
      color: '#c4a060',
      screenX: 400 + (idx % 3) * 10,
      screenY: 300,
      width: 96,
      height: 18,
      isHovered: idx === 5,
    }))
    const boxes = layoutGroundItemLabels(inputs, 800, 600)
    expect(boxes).toHaveLength(12)
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!
        const b = boxes[j]!
        const xOverlap = a.x < b.x + b.width + 2 && a.x + a.width + 2 > b.x
        const yOverlap = a.y < b.y + b.height + 2 && a.y + a.height + 2 > b.y
        expect(xOverlap && yOverlap).toBe(false)
      }
    }
  })

  it('tracks and removes RemoteEntityInterpolator entries using 36-bit numeric keys without unitType collision', () => {
    const interp = new RemoteEntityInterpolator()
    interp.spawnOrSnap({ unitType: 1, unitId: 42, x: 100, y: 200 })
    interp.spawnOrSnap({ unitType: 4, unitId: 42, x: 300, y: 400 })
    expect(interp.getAllStates()).toHaveLength(2)
    expect(interp.getEntityState(1, 42)?.x).toBe(100)
    expect(interp.getEntityState(4, 42)?.x).toBe(300)

    expect(interp.removeEntity(4, 42)).toBe(true)
    expect(interp.getEntityState(1, 42)?.x).toBe(100)
    expect(interp.getEntityState(4, 42)).toBeNull()

    interp.clear()
    expect(interp.getAllStates()).toHaveLength(0)
  })

  it('clears world units, ground items, interpolator, and HUD overlays on leaveGame while preserving hero identity and difficulty', async () => {
    const session = new OnlineSession()
    session.hudManager.resize(800, 600)
    session.world.difficulty = 2
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 1 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 1, name: 'FrostHero', x: 5100, y: 5100 },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 4, id: 9001, classId: 10, x: 5104, y: 5104 },
    })
    session.interpolator.spawnOrSnap({ unitType: 1, unitId: 77, x: 5100, y: 5100 })
    session.hudManager.groundItemLabelBoxes = [
      {
        id: 9001,
        text: 'Cap',
        label: 'Cap',
        color: '#ffffff',
        x: 380,
        y: 280,
        width: 50,
        height: 18,
        isHovered: false,
      },
    ]

    expect(session.world.units.size).toBeGreaterThan(0)
    expect(session.interpolator.getAllStates()).toHaveLength(1)

    await session.leaveGame()

    expect(session.world.units.size).toBe(0)
    expect(session.world.containers.ground.size).toBe(0)
    expect(session.interpolator.getAllStates()).toHaveLength(0)
    expect(session.hudManager.groundItemLabelBoxes).toHaveLength(0)
    expect(session.world.self.name).toBe('FrostHero')
    expect(session.world.self.charClass).toBe(1)
    expect(session.world.difficulty).toBe(2)
  })

  it('disconnects EAX ConvolverNode wet path and frees impulse buffers on game exit, then reconnects on re-entry', () => {
    const ctx = new FakeAudioContext()
    const busGain = ctx.createGain()
    busGain.connect(ctx.destination)
    const sampleBuf = new FakeAudioBuffer(1, 22050, 22050)
    const voices = new WebAudioSoundVoices(
      () => ({ ctx: ctx as unknown as AudioContext, node: busGain as unknown as GainNode }),
      () => ({ buffer: sampleBuf as unknown as AudioBuffer, sourceSampleRate: 22050 }),
    )

    voices.set3DSoundEnabled(true)
    const cavePreset = scaleSoundEnvironEaxPreset113c(4)
    voices.setEaxPreset(cavePreset, 4)
    voices.setReverbMix(0, 1)
    voices.start(0, 87, false, 0)

    const convolvers = ctx.convolvers()
    expect(convolvers).toHaveLength(1)
    expect(convolvers[0]!.buffer).not.toBeNull()
    expect(reaches(convolvers[0]!, ctx.destination)).toBe(true)

    voices.stopAll()
    voices.setEaxPreset(null, 0)
    expect(convolvers[0]!.buffer).toBeNull()
    expect(reaches(convolvers[0]!, ctx.destination)).toBe(false)

    // Re-entering a cave in the next game reconnects the reverb bus cleanly
    voices.setEaxPreset(cavePreset, 4)
    expect(convolvers[0]!.buffer).not.toBeNull()
    expect(reaches(convolvers[0]!, ctx.destination)).toBe(true)
  })

  it('deletes unique GPU atlas handles across single-page and multi-page entity packs on EntityArtCache.clear()', () => {
    const deleted: AtlasHandle[] = []
    const renderer = {
      addIndexedAtlas: () => ({ id: 1 }) as unknown as AtlasHandle,
      addAtlas: () => ({ id: 2 }) as unknown as AtlasHandle,
      deleteAtlas: (h: AtlasHandle) => {
        deleted.push(h)
      },
    } as unknown as SpriteRenderer

    const cache = new EntityArtCache({
      renderer,
      initialCatalog: {
        monsterByClassId: { '146': { token: 'DC', key: 'dc-hth' } },
      } as unknown as PackedEntityCatalogIndex,
    })
    const h0 = { page: 0 } as unknown as AtlasHandle
    const h1 = { page: 1 } as unknown as AtlasHandle
    cache.setMonsterArt(146, {
      token: 'DC',
      handle: h0,
      groups: [
        [
          { x: 0, y: 0, width: 16, height: 16, atlas: h0 } as unknown as AtlasFrame,
          { x: 0, y: 0, width: 16, height: 16, atlas: h1 } as unknown as AtlasFrame,
        ],
      ],
      blendMode: 'normal',
      directions: 8,
      walkOffset: 0,
      standOffset: 0,
      walkFrames: 8,
      standFrames: 8,
      layerFailures: [],
    })

    cache.clear()
    expect(deleted).toEqual([h0, h1])
    expect(cache.isIndexLoaded).toBe(true)
  })

  it('allows HUD idle repaint skip when stationary Alt ground labels are shown and invalidates on movement or hover', () => {
    const hudCanvas = { width: 800, height: 600, clientWidth: 800, clientHeight: 600, style: {} } as HTMLCanvasElement
    const cursorCanvas = { width: 800, height: 600, clientWidth: 800, clientHeight: 600, style: {} } as HTMLCanvasElement
    const hud = new HudManager(hudCanvas, {}, cursorCanvas)
    hud.currentClass = 'sor'
    hud.syncPlayerContext()
    hud.showGroundLabels = true
    hud.groundItemLabelBoxes = [
      {
        id: 101,
        text: 'Shako',
        label: 'Shako',
        color: '#c4a060',
        x: 360,
        y: 260,
        width: 64,
        height: 18,
        isHovered: false,
      },
    ]

    const internal = hud as unknown as { lastFullHudRepaintMs: number }
    expect(hudRepaintUnchanged(hud, 1000)).toBe(false)
    internal.lastFullHudRepaintMs = 1000
    expect(hudRepaintUnchanged(hud, 1040)).toBe(true)

    // Camera/item screen position shift invalidates immediately
    hud.groundItemLabelBoxes = [
      {
        ...hud.groundItemLabelBoxes[0]!,
        x: 364,
      },
    ]
    expect(hudRepaintUnchanged(hud, 1080)).toBe(false)
    internal.lastFullHudRepaintMs = 1080
    expect(hudRepaintUnchanged(hud, 1120)).toBe(true)

    // Toggling Alt off invalidates immediately
    hud.showGroundLabels = false
    expect(hudRepaintUnchanged(hud, 1160)).toBe(false)
  })
})

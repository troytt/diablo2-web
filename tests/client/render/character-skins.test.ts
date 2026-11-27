import { deflateRawSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import { characterSkinsPlugin } from '../../../plugins/character-skins/index.ts'
import { BUILTIN_PLUGINS } from '../../../plugins/index.ts'
import { validatePublicAssetRoots } from '../../../src/baker/io/asset-manifest.ts'
import {
  buildStoreZipArchive,
  computeZipCrc32,
  extractZipArchive,
} from '../../../src/common/formats/zip-reader.ts'
import {
  resolveMinionClipKey,
  resolveMinionKeyForMonsterClassId,
  resolveNecromageElementGlowTint,
  resolvePlayerClassTokenForUnit,
  resolveRgbaPaletteRowTint,
  resolveSkinClipKey,
  shouldMinionSkinApply,
  shouldSkinOverrideMorph,
  SKINNABLE_MINIONS_BY_CLASS,
  validateCharacterSkinManifest,
  type CharacterSkinManifest,
} from '../../../src/common/units/character-skin.ts'
import { resolveMonsterTitleAndColor } from '../../../src/client/ui/panels/escape-monster-tooltip.ts'
import { PLR_MODES } from '../../../src/common/units/plr-mode.ts'
import {
  containsCjkCharacters,
  validatePluginRegistry,
  type PluginSessionView,
} from '../../../src/client/plugin-host/api.ts'
import { PluginConfigStore } from '../../../src/client/plugin-host/plugin-config-store.ts'
import { PluginHost } from '../../../src/client/plugin-host/plugin-host.ts'
import { CharacterSkinService } from '../../../src/client/render/character-skin-cache.ts'
import type { AtlasFrame } from '../../../src/client/render/atlas.ts'
import type { AtlasHandle, DrawOptions, SpriteRenderer } from '../../../src/client/render/renderer.ts'
import { drawSceneUnitDrawable } from '../../../src/client/scene/world-renderer.ts'
import type { SceneUnitDrawable } from '../../../src/client/view/unit-drawables.ts'
import { packCharacterSkinBundle } from '../../../tools/skin-baker/pack-skin.ts'

function createSyntheticTestSkinBundle(id = 'ne-kelthuzad', targetClass: 'ne' | 'ba' = 'ne') {
  const mkFrame = (r: number, g: number, b: number, glowB: number) => {
    const width = 32
    const height = 40
    const pixels = new Uint8Array(width * height * 4)
    const glowPixels = new Uint8Array(width * height * 4)
    for (let y = 4; y < 36; y += 1) {
      for (let x = 6; x < 26; x += 1) {
        const o = (y * width + x) * 4
        pixels[o] = r
        pixels[o + 1] = g
        pixels[o + 2] = b
        pixels[o + 3] = 255
        if (glowB > 0 && y < 18) {
          glowPixels[o] = 80
          glowPixels[o + 1] = 210
          glowPixels[o + 2] = glowB
          glowPixels[o + 3] = 220
        }
      }
    }
    return { width, height, pixels, glowPixels, footX: 16, footY: 36 }
  }

  return packCharacterSkinBundle({
    id,
    name: { zh: '巫妖克尔苏加德', en: "Kel'Thuzad (Archlich)" },
    targetClass,
    directions: 8,
    renderScale: 0.5,
    floating: true,
    shadowOffsetY: 10,
    shadowScale: 0.72,
    respectMorph: false,
    clips: [
      {
        key: 'nu',
        speed: 128,
        loop: true,
        directions: Array.from({ length: 8 }, () => [mkFrame(90, 50, 140, 255), mkFrame(95, 55, 145, 255)]),
      },
      {
        key: 'wl',
        speed: 256,
        loop: true,
        directions: Array.from({ length: 8 }, () => [mkFrame(100, 60, 150, 240), mkFrame(105, 65, 155, 240)]),
      },
      {
        key: 'sc',
        speed: 256,
        loop: false,
        directions: Array.from({ length: 8 }, () => [mkFrame(120, 80, 180, 255), mkFrame(130, 90, 190, 255)]),
      },
      {
        key: 'dt',
        speed: 176,
        loop: false,
        directions: Array.from({ length: 8 }, (_, d) => [
          mkFrame(80 + d, 40, 100, 120),
          mkFrame(140 + d, 220, 255, 255), // final frame = Phylactery!
        ]),
      },
    ],
  })
}

function buildDeflateSingleFileZip(path: string, rawBytes: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(path)
  const compressed = new Uint8Array(deflateRawSync(rawBytes))
  const crc = computeZipCrc32(rawBytes)

  const local = new Uint8Array(30 + nameBytes.byteLength)
  const lv = new DataView(local.buffer)
  lv.setUint32(0, 0x04034b50, true)
  lv.setUint16(4, 20, true)
  lv.setUint16(6, 0x0800, true)
  lv.setUint16(8, 8, true) // DEFLATE
  lv.setUint32(14, crc, true)
  lv.setUint32(18, compressed.byteLength, true)
  lv.setUint32(22, rawBytes.byteLength, true)
  lv.setUint16(26, nameBytes.byteLength, true)
  local.set(nameBytes, 30)

  const central = new Uint8Array(46 + nameBytes.byteLength)
  const cv = new DataView(central.buffer)
  cv.setUint32(0, 0x02014b50, true)
  cv.setUint16(4, 20, true)
  cv.setUint16(6, 20, true)
  cv.setUint16(8, 0x0800, true)
  cv.setUint16(10, 8, true) // DEFLATE
  cv.setUint32(16, crc, true)
  cv.setUint32(20, compressed.byteLength, true)
  cv.setUint32(24, rawBytes.byteLength, true)
  cv.setUint16(28, nameBytes.byteLength, true)
  cv.setUint32(42, 0, true)
  central.set(nameBytes, 46)

  const cdOffset = local.byteLength + compressed.byteLength
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, 1, true)
  ev.setUint16(10, 1, true)
  ev.setUint32(12, central.byteLength, true)
  ev.setUint32(16, cdOffset, true)

  const out = new Uint8Array(cdOffset + central.byteLength + eocd.byteLength)
  out.set(local, 0)
  out.set(compressed, local.byteLength)
  out.set(central, cdOffset)
  out.set(eocd, cdOffset + central.byteLength)
  return out
}

function createStubRenderer() {
  const draws: { frame: AtlasFrame; x: number; y: number; options: DrawOptions }[] = []
  const quads: { frame: AtlasFrame; coords: number[]; options: DrawOptions }[] = []
  const allocated = new Set<AtlasHandle>()
  const deleted: AtlasHandle[] = []
  let texSeq = 0

  const renderer = {
    isDisposed: false,
    addAtlas(_src: unknown, width = 64, height = 64): AtlasHandle {
      texSeq += 1
      const h: AtlasHandle = {
        texture: { id: texSeq } as unknown as WebGLTexture,
        width,
        height,
      }
      allocated.add(h)
      return h
    },
    deleteAtlas(h: AtlasHandle): boolean {
      if (!allocated.has(h)) return false
      allocated.delete(h)
      deleted.push(h)
      return true
    },
    draw(frame: AtlasFrame, x: number, y: number, options: DrawOptions = {}): void {
      draws.push({ frame, x, y, options })
    },
    drawQuad(
      frame: AtlasFrame,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      options: DrawOptions = {},
    ): void {
      quads.push({ frame, coords: [x0, y0, x1, y1, x2, y2, x3, y3], options })
    },
  } as unknown as SpriteRenderer

  return { renderer, draws, quads, allocated, deleted }
}

function makePlayerUnit(overrides: Partial<SceneUnitDrawable> = {}): SceneUnitDrawable {
  return {
    drawableKind: 'unit',
    unitKind: 'player',
    id: 1,
    unitId: 1,
    classId: 2, // Necromancer
    token: 'ne',
    mode: 1, // NU
    direction: 0,
    frame: 0,
    subX: 10,
    subY: 10,
    worldX: 400,
    worldY: 300,
    sortY: 300,
    blendMode: 'normal',
    lifePct: 100,
    overlays: [],
    isLocalPlayer: true,
    ...overrides,
  } as SceneUnitDrawable
}

describe('Character Skins Engine, KelThuzad Morph Override, & .d2skin.zip Pipeline', () => {
  it('registers public/skins/ cleanly in INTENTIONALLY_UNCACHED_PUBLIC_DIRS for hot deployment', () => {
    const res = validatePublicAssetRoots()
    expect(res.uncachedDirs.map((d) => d.toLowerCase())).toContain('skins/')
  })

  it('validates manifests fail-fast and resolves all 18 PlrMode tokens without gaps', () => {
    const bundle = createSyntheticTestSkinBundle()
    expect(bundle.manifest.id).toBe('ne-kelthuzad')
    expect(bundle.manifest.floating).toBe(true)

    expect(() =>
      validateCharacterSkinManifest({
        ...bundle.manifest,
        pages: [{ file: '../evil.png', width: 64, height: 64 }],
      }),
    ).toThrow(/Invalid character skin/)

    for (const mode of PLR_MODES) {
      if (mode.token === 'SQ') continue
      const resolved = resolveSkinClipKey('ne', mode.token, bundle.manifest.clips)
      expect(resolved, `mode ${mode.code} (${mode.token}) must resolve`).not.toBeNull()
      expect(bundle.manifest.clips[resolved!]).toBeDefined()
    }
  })

  it('roundtrips STORE & DEFLATE .d2skin.zip archives and blocks zip-slip paths', async () => {
    const bundle = createSyntheticTestSkinBundle('ba-custom-test', 'ba')
    const extracted = await extractZipArchive(bundle.zipBytes)
    expect(extracted.has('skin.json')).toBe(true)

    const payload = new TextEncoder().encode('{"hello":"kelthuzad"}')
    const deflatedZip = buildDeflateSingleFileZip('nested/test.json', payload)
    const deflatedMap = await extractZipArchive(deflatedZip)
    expect(new TextDecoder().decode(deflatedMap.get('nested/test.json'))).toBe('{"hello":"kelthuzad"}')

    expect(() =>
      buildStoreZipArchive([{ path: '../outside.json', bytes: payload }]),
    ).toThrow(/Unsafe path/)
  })

  it('issues zero network fetches and zero GPU uploads when skin plugin is disabled', () => {
    const fetchSpy = vi.fn()
    const skinService = new CharacterSkinService({
      fetchFn: fetchSpy as unknown as typeof fetch,
      disableIndexedDb: true,
    })
    const { renderer, allocated } = createStubRenderer()
    const vanillaHandle: AtlasHandle = {
      texture: { id: 999 } as unknown as WebGLTexture,
      width: 128,
      height: 128,
      indexed: true,
    }
    const vanillaChar = {
      handle: vanillaHandle,
      groups: [[{ x: 0, y: 0, width: 32, height: 64, anchorX: -16, anchorY: -58 }]],
      directions: 1,
      walk: 0,
      stand: 0,
      members: 1,
      clips: { nu: { group: 0, directions: 1, frames: 1, speed: 128, loop: true, events: [] } },
    }

    drawSceneUnitDrawable(
      renderer,
      makePlayerUnit(),
      {
        source: null as never,
        lightingPreset: 'auto',
        characterSkinService: skinService,
        characterArtByToken: new Map([['ne', vanillaChar]]),
      },
      1000,
      1,
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(allocated.size).toBe(0)
  })

  it('renders KelThuzad RGBA + additive glow + floating shadow, overrides Trang-Oul Vampire morph, applies Cold/Poison RGBA tints, and freezes corpse on Phylactery frame', async () => {
    const bundle = createSyntheticTestSkinBundle('ne-kelthuzad', 'ne')
    const skinService = new CharacterSkinService({
      disableIndexedDb: true,
      decodeImageBytes: async (_bytes, width, height) => ({
        source: { pixels: new Uint8Array(width * height * 4), width, height },
        width,
        height,
      }),
    })

    await skinService.importSkinZip(bundle.zipBytes, { activateForClass: true })
    skinService.setConfig({
      enabled: true,
      scope: 'self',
      morphPolicy: 'keep-skin',
      selectedByClass: { ne: 'ne-kelthuzad' },
    })

    const { renderer, draws, quads, allocated } = createStubRenderer()
    await skinService.ensureCharacterSkinArt(renderer, 'ne-kelthuzad')
    expect(allocated.size).toBe(2) // 1 RGBA diffuse page + 1 additive glow page

    // 1. Necromancer wearing full Trang-Oul's Avatar (`token = 'tg'`, `classId = 2`) with Cold (`paletteRow = 1`):
    // Must NOT morph into vampire — keeps Kel'Thuzad skin and receives icy RGBA Cold tint!
    expect(resolvePlayerClassTokenForUnit(2, 'tg')).toBe('ne')
    expect(shouldSkinOverrideMorph(bundle.manifest as CharacterSkinManifest, 'keep-skin')).toBe(true)

    drawSceneUnitDrawable(
      renderer,
      makePlayerUnit({ token: 'tg', classId: 2, paletteRow: 1, isLocalPlayer: true }),
      {
        source: null as never,
        lightingPreset: 'auto',
        characterSkinService: skinService,
      },
      0,
      1,
    )

    expect(quads.length).toBe(1) // Floating ground shadow drawn
    expect(draws.length).toBe(2) // Main RGBA draw + Additive Frost Glow draw
    expect(draws[0]!.options.tint).toEqual([
      resolveRgbaPaletteRowTint(1)![0],
      resolveRgbaPaletteRowTint(1)![1],
      resolveRgbaPaletteRowTint(1)![2],
      1.0,
    ])
    expect(draws[1]!.options.blendMode).toBe('additive')
    expect(draws[0]!.options.width).toBe(10) // 20px cropped * 0.5 HD renderScale = 10px

    // 2. Scope 'self' skips remote Necromancers (`isLocalPlayer: false`)
    draws.length = 0
    const vanillaHandle: AtlasHandle = {
      texture: { id: 777 } as unknown as WebGLTexture,
      width: 64,
      height: 64,
      indexed: true,
    }
    drawSceneUnitDrawable(
      renderer,
      makePlayerUnit({ unitId: 99, isLocalPlayer: false }),
      {
        source: null as never,
        lightingPreset: 'auto',
        characterSkinService: skinService,
        activePlayerUnitId: 1,
        characterArtByToken: new Map([
          [
            'ne',
            {
              handle: vanillaHandle,
              groups: [[{ x: 0, y: 0, width: 24, height: 48 }]],
              directions: 1,
              walk: 0,
              stand: 0,
              members: 1,
              clips: { nu: { group: 0, directions: 1, frames: 1, speed: 128, loop: true, events: [] } },
            },
          ],
        ]),
      },
      0,
      1,
    )
    expect(draws.length).toBe(1)
    expect(draws[0]!.options.atlas).toBe(vanillaHandle)

    // 3. Corpse (`dd`, mode 17) freezes on final frame of `dt` (Phylactery) with no standing shadow
    draws.length = 0
    quads.length = 0
    drawSceneUnitDrawable(
      renderer,
      makePlayerUnit({ mode: 17, isCorpse: true, isLocalPlayer: true }),
      {
        source: null as never,
        lightingPreset: 'auto',
        characterSkinService: skinService,
      },
      5000,
      1,
    )
    expect(quads.length).toBe(0)
    expect(draws.length).toBe(2)
    const dtClip = bundle.manifest.clips.dt!
    const lastDtFrameX = bundle.manifest.groups[dtClip.group]![1]![0]
    expect(draws[0]!.frame.x).toBe(lastDtFrameX)
  })

  it('wires character-skins plugin into PluginHost and cleanly releases GPU atlases on disable', async () => {
    expect(BUILTIN_PLUGINS).toContain(characterSkinsPlugin)
    expect(() => validatePluginRegistry([characterSkinsPlugin])).not.toThrow()
    expect(characterSkinsPlugin.defaultEnabled).toBe(false)
    expect(
      containsCjkCharacters(characterSkinsPlugin.name.en) ||
        containsCjkCharacters(characterSkinsPlugin.description.en),
    ).toBe(false)

    const bundle = createSyntheticTestSkinBundle('ne-kelthuzad', 'ne')
    const skinService = new CharacterSkinService({
      disableIndexedDb: true,
      decodeImageBytes: async (_bytes, width, height) => ({
        source: { pixels: new Uint8Array(width * height * 4), width, height },
        width,
        height,
      }),
    })
    await skinService.importSkinZip(bundle.zipBytes, { activateForClass: false })

    const { renderer, allocated, deleted } = createStubRenderer()
    const storageMap = new Map<string, string>()
    const host = new PluginHost({
      plugins: [characterSkinsPlugin],
      configStore: new PluginConfigStore([characterSkinsPlugin], {
        storage: {
          getItem: (k) => storageMap.get(k) ?? null,
          setItem: (k, v) => void storageMap.set(k, v),
          removeItem: (k) => void storageMap.delete(k),
        },
      }),
      session: {
        phase: 'lobby',
        world: {},
        loginHost: null,
        getSnapshot: () => ({}),
        onServerEvent: () => () => {},
        onStateChange: () => () => {},
      } as unknown as PluginSessionView,
      toolbar: { setPluginsButtonState() {}, addContribution: () => () => {} },
      autoStart: false,
      characterSkins: {
        getConfig: () => skinService.getConfig(),
        setConfig: (p) => skinService.setConfig(p),
        resetToVanilla: () => skinService.resetToVanilla(),
        getCatalog: () => skinService.getCatalog(),
        ensureCatalogLoaded: () => skinService.ensureCatalogLoaded(),
        importSkinZip: (z, o) => skinService.importSkinZip(z, o),
        removeCustomSkin: (id) => skinService.removeCustomSkin(id),
        subscribe: (fn) => skinService.subscribe(fn),
        openManagerModal: () => {},
      },
    })

    await host.start()
    expect(skinService.getConfig().enabled).toBe(false)

    await host.setEnabled('character-skins', true)
    expect(skinService.getConfig().enabled).toBe(true)
    expect(skinService.getSelectedSkinId('ne')).toBe('ne-wow-undead')
    expect(skinService.getConfig().morphPolicy).toBe('keep-skin')

    await skinService.ensureCharacterSkinArt(renderer, 'ne-kelthuzad')
    expect(allocated.size).toBe(2)

    // Disabling the plugin must automatically release claims, revert to vanilla, and delete GPU atlases!
    await host.setEnabled('character-skins', false)
    expect(skinService.getConfig().enabled).toBe(false)
    expect(skinService.getSelectedSkinId('ne')).toBeNull()
    expect(allocated.size).toBe(0)
    expect(deleted.length).toBe(2)

    await host.destroy()
  })

  it('validates bundled minions fail-fast (rejecting unknown keys & missing core clips) and resolves all 16 monster modes cleanly', () => {
    expect(SKINNABLE_MINIONS_BY_CLASS.ne).toEqual({
      necroskeleton: 363,
      necromage: 364,
      claygolem: 289,
      bloodgolem: 290,
      irongolem: 291,
      firegolem: 292,
    })

    const baseBundle = createSyntheticTestSkinBundle('ne-kelthuzad', 'ne')
    const validMinionSpec = {
      name: { zh: '食尸鬼', en: 'Ghoul' },
      directions: 8,
      renderScale: 0.68,
      portraitFile: 'portrait-ghoul.png',
      pages: [{ file: 'minion-ghoul.png', width: 256, height: 256 }],
      clips: {
        nu: { group: 0, directions: 8, frames: 2, speed: 128, loop: true, events: [] },
        wl: { group: 0, directions: 8, frames: 2, speed: 224, loop: true, events: [] },
        a1: { group: 0, directions: 8, frames: 2, speed: 256, loop: false, events: [] },
        gh: { group: 0, directions: 8, frames: 2, speed: 256, loop: false, events: [] },
        dt: { group: 0, directions: 8, frames: 2, speed: 176, loop: false, events: [] },
      },
      groups: Array.from({ length: 8 }, () => [
        [0, 0, 20, 32, -10, -28] as const,
        [22, 0, 20, 32, -10, -28] as const,
      ]),
    }

    const withMinion = validateCharacterSkinManifest({
      ...baseBundle.manifest,
      minions: { necroskeleton: validMinionSpec },
    })
    expect(withMinion.minions?.necroskeleton?.name.zh).toBe('食尸鬼')

    // Reject cross-class or unknown minion keys
    expect(() =>
      validateCharacterSkinManifest({
        ...baseBundle.manifest,
        minions: { valkyrie: validMinionSpec },
      }),
    ).toThrow(/not an allowed summon/)

    // Reject minion missing any of the 5 core clips (nu, wl, a1, gh, dt)
    const { dt: _omitDt, ...incompleteClips } = validMinionSpec.clips
    expect(() =>
      validateCharacterSkinManifest({
        ...baseBundle.manifest,
        minions: { necroskeleton: { ...validMinionSpec, clips: incompleteClips } },
      }),
    ).toThrow(/missing required core clip "dt"/)

    // Every canonical monster mode token resolves cleanly; s1 falls back to nu (not a1) when omitted
    for (const token of ['dt', 'nu', 'wl', 'gh', 'a1', 'a2', 'bl', 'sc', 's1', 's2', 's3', 's4', 'dd', 'xx', 'rn']) {
      const resolved = resolveMinionClipKey(token, validMinionSpec.clips)
      expect(resolved).not.toBeNull()
      expect(validMinionSpec.clips[resolved as keyof typeof validMinionSpec.clips]).toBeDefined()
    }
    expect(resolveMinionClipKey('s1', validMinionSpec.clips)).toBe('nu')
  })

  it('enforces all 4 summon applicability rules (hostile, Revive State 96, cross-class item Golem, self/class scope) and renders lazy WC3 summons + 4-way Necromage glow + HUD portrait/title', async () => {
    const mkMinionFrames = (r: number, g: number, b: number) => ({
      width: 28,
      height: 36,
      pixels: (() => {
        const buf = new Uint8Array(28 * 36 * 4)
        for (let i = 0; i < 28 * 36; i += 1) {
          buf[i * 4] = r
          buf[i * 4 + 1] = g
          buf[i * 4 + 2] = b
          buf[i * 4 + 3] = 255
        }
        return buf
      })(),
      glowPixels: (() => {
        const buf = new Uint8Array(28 * 36 * 4)
        for (let i = 0; i < 28 * 10; i += 1) {
          buf[i * 4] = 255
          buf[i * 4 + 1] = 255
          buf[i * 4 + 2] = 255
          buf[i * 4 + 3] = 240
        }
        return buf
      })(),
      footX: 14,
      footY: 32,
    })

    const minionClips = ['nu', 'wl', 'a1', 's1', 'gh', 'dt'].map((key) => ({
      key,
      speed: 200,
      loop: key === 'nu' || key === 'wl',
      directions: Array.from({ length: 8 }, () => [mkMinionFrames(130, 145, 130), mkMinionFrames(140, 155, 140)]),
    }))

    const portraitPixels = new Uint8Array(92 * 82 * 4).fill(200)
    const baseHero = createSyntheticTestSkinBundle('ne-kelthuzad', 'ne')
    const fullBundle = packCharacterSkinBundle({
      id: 'ne-kelthuzad',
      name: baseHero.manifest.name,
      targetClass: 'ne',
      directions: 8,
      renderScale: 0.5,
      clips: [
        {
          key: 'nu',
          speed: 128,
          loop: true,
          directions: Array.from({ length: 8 }, () => [mkMinionFrames(90, 50, 140)]),
        },
      ],
      minions: {
        necroskeleton: {
          name: { zh: '食尸鬼', en: 'Ghoul' },
          directions: 8,
          renderScale: 0.5,
          clips: minionClips,
          portraitRgba: { width: 92, height: 82, pixels: portraitPixels },
        },
        necromage: {
          name: { zh: '亡灵巫师', en: 'Necromancer' },
          directions: 8,
          renderScale: 0.5,
          clips: minionClips,
          portraitRgba: { width: 92, height: 82, pixels: portraitPixels },
        },
        claygolem: {
          name: { zh: '憎恶', en: 'Abomination' },
          directions: 8,
          renderScale: 0.5,
          clips: minionClips,
          portraitRgba: { width: 92, height: 82, pixels: portraitPixels },
        },
      },
    })

    // Serve from simulated HTTP fetch to verify per-minion lazy network requests
    const fetchedUrls: string[] = []
    const skinService = new CharacterSkinService({
      skinsBaseUrl: '/skins',
      disableIndexedDb: true,
      fetchFn: (async (url: string | URL | Request) => {
        const u = String(url)
        fetchedUrls.push(u)
        if (u.endsWith('/skins/index.json')) {
          return new Response(
            JSON.stringify({
              schema: 1,
              skins: [
                {
                  id: 'ne-kelthuzad',
                  name: fullBundle.manifest.name,
                  targetClass: 'ne',
                  source: 'builtin',
                  manifestPath: 'ne-kelthuzad/skin.json',
                },
              ],
            }),
            { status: 200 },
          )
        }
        const prefix = '/skins/ne-kelthuzad/'
        if (u.startsWith(prefix)) {
          const rel = u.slice(prefix.length)
          const bytes = fullBundle.files[rel]
          if (bytes) {
            const copy = new Uint8Array(bytes.byteLength)
            copy.set(bytes)
            return new Response(copy, { status: 200 })
          }
        }
        return new Response('Not found', { status: 404 })
      }) as typeof fetch,
      decodeImageBytes: async (_bytes, width, height) => ({
        source: { pixels: new Uint8Array(width * height * 4), width, height },
        width,
        height,
      }),
    })

    skinService.setConfig({
      enabled: true,
      scope: 'self',
      morphPolicy: 'keep-skin',
      minionsEnabled: true,
      selectedByClass: { ne: 'ne-kelthuzad' },
    })

    const { renderer, draws, allocated } = createStubRenderer()
    await skinService.ensureCharacterSkinArt(renderer, 'ne-kelthuzad')
    // Hero loaded -> ZERO minion-*.png or portrait-*.png fetched before any summon appears!
    expect(fetchedUrls.some((u) => u.includes('minion-'))).toBe(false)
    expect(fetchedUrls.some((u) => u.includes('portrait-'))).toBe(false)
    expect(allocated.size).toBe(2) // Hero diffuse + glow only

    // Rule checks:
    // (a) Hostile skeleton (`ownerType: undefined`) -> null
    expect(
      shouldMinionSkinApply({
        config: skinService.getConfig(),
        monsterClassId: 363,
        ownerType: undefined,
        ownerId: undefined,
        localPlayerId: 1,
        ownerClassToken: null,
      }),
    ).toBeNull()
    // (b) Revived monster (`State 96`, even if monsterClassId === 363 and owned by local Necro!) -> null
    expect(
      shouldMinionSkinApply({
        config: skinService.getConfig(),
        monsterClassId: 363,
        ownerType: 'player',
        ownerId: 1,
        localPlayerId: 1,
        ownerClassToken: 'ne',
        isRevive: true,
      }),
    ).toBeNull()
    // (c) Paladin with Stone runeword Clay Golem charges (`ownerClassToken: 'pa'`) -> null
    expect(
      shouldMinionSkinApply({
        config: skinService.getConfig(),
        monsterClassId: 289,
        ownerType: 'player',
        ownerId: 1,
        localPlayerId: 1,
        ownerClassToken: 'pa',
      }),
    ).toBeNull()
    // (d) Foreign Necromancer (`ownerId: 77`) in `scope: 'self'` -> null; in `scope: 'class'` -> matched!
    expect(
      shouldMinionSkinApply({
        config: skinService.getConfig(),
        monsterClassId: 363,
        ownerType: 'player',
        ownerId: 77,
        localPlayerId: 1,
        ownerClassToken: 'ne',
      }),
    ).toBeNull()
    expect(
      shouldMinionSkinApply({
        config: { ...skinService.getConfig(), scope: 'class' },
        monsterClassId: 363,
        ownerType: 'player',
        ownerId: 77,
        localPlayerId: 1,
        ownerClassToken: 'ne',
      })?.minionKey,
    ).toBe('necroskeleton')

    // Preload necromage only ->claygolem must still remain 0 fetches!
    await skinService.ensureMinionSkinArt(renderer, 'ne-kelthuzad', 'necromage')
    expect(fetchedUrls.some((u) => u.includes('minion-necromage-'))).toBe(true)
    expect(fetchedUrls.some((u) => u.includes('minion-claygolem-'))).toBe(false)
    expect(allocated.size).toBe(4) // Hero (2) + Necromage (2)

    // Render Cold Skeletal Mage (`classId = 364`, `compVariants[11] = 1` Cold) -> additive glow gets Cold cyan tint!
    const coldComp = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
    const mageUnit: SceneUnitDrawable = makePlayerUnit({
      id: 501,
      unitId: 501,
      unitKind: 'monster',
      classId: 364,
      token: 'SK',
      mode: 4, // A1 attack
      direction: 0,
      isLocalPlayer: false,
      isCorpse: false,
      isHovered: false,
      ownerType: 'player',
      ownerId: 1,
      compVariants: coldComp,
    })
    drawSceneUnitDrawable(
      renderer,
      mageUnit,
      {
        source: null as never,
        lightingPreset: 'auto',
        characterSkinService: skinService,
        activePlayerUnitId: 1,
        localPlayerClassToken: 'ne',
      },
      250,
      1,
    )
    expect(draws.length).toBe(2)
    expect(draws[1]!.options.blendMode).toBe('additive')
    const expectedColdGlow = resolveNecromageElementGlowTint(coldComp)
    expect(draws[1]!.options.tint).toEqual([
      expectedColdGlow[0],
      expectedColdGlow[1],
      expectedColdGlow[2],
      1.0,
    ])

    // Verify HUD portrait lazy load & customDisplayName bypasses .tbl "Ghoul" collision
    const portrait = await skinService.ensureMinionPortraitImage('ne-kelthuzad', 'necroskeleton')
    expect(portrait).not.toBeNull()
    expect(portrait!.width).toBe(92)
    expect(portrait!.height).toBe(82)
    expect(resolveMinionKeyForMonsterClassId('ne', 363)).toBe('necroskeleton')

    const titleZh = resolveMonsterTitleAndColor(
      {
        name: 'Skeleton',
        nameKey: 'Skeleton',
        customDisplayName: { zh: '食尸鬼', en: 'Ghoul' },
        hp: 128,
        maxHp: 128,
      },
      'zh',
    )
    const titleEn = resolveMonsterTitleAndColor(
      {
        name: 'Skeleton',
        nameKey: 'Skeleton',
        customDisplayName: { zh: '食尸鬼', en: 'Ghoul' },
        hp: 128,
        maxHp: 128,
      },
      'en',
    )
    expect(titleZh.displayName).toBe('食尸鬼')
    expect(titleEn.displayName).toBe('Ghoul')

    // Turning `minionsEnabled: false` keeps Hero GPU atlases (2) while evicting Minion GPU atlases (2)!
    skinService.setConfig({ minionsEnabled: false })
    expect(allocated.size).toBe(2)
  })
})

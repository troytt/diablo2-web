import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  LEVEL_PORTAL_NEIGHBOR_AREAS_113C,
  LEVEL_SCRIPTED_MONSTERS_113C,
  MONSTER_RELATED_SPAWNS_113C,
  SUPERUNIQUE_MONSTER_HCINDICES_113C,
  expandMonsterPreloadClosure113c,
  getScriptedMonstersForLevel113c,
  isMonsterArtNull113c,
} from '../../src/common/drlg/level-scripted-monsters-113c.ts'
import {
  CANONICAL_BOSS_MINIONS,
  getCanonicalSuperUniques,
} from '../../src/common/units/monsters-data.ts'
import { MONSTATS_113C_ROWS } from '../../src/common/units/monstats-113c-data.ts'
import { BAAL_THRONE_WAVES_113C } from '../../src/server/ai/monster-ai.ts'
import {
  EntityArtCache,
  type PackedEntityCatalogIndex,
} from '../../src/client/scene/entity-art-loader.ts'
import {
  clearMissingArtEntries,
  clearPreloadMissEntries,
  getMissingArtEntries,
  getPreloadMissEntries,
} from '../../src/client/scene/missing-art.ts'
import {
  drawSceneUnitDrawable,
  type SceneSourceRenderContext,
} from '../../src/client/scene/world-renderer.ts'
import type { AtlasFrame } from '../../src/client/render/atlas.ts'
import type { AtlasHandle, DrawOptions, SpriteRenderer } from '../../src/client/render/renderer.ts'
import type { SceneUnitDrawable } from '../../src/client/view/unit-drawables.ts'

describe('Issue #1775 — 136-Level Scripted Monster Preload, Priority Queue & Loading Silhouette', () => {
  beforeEach(() => {
    clearMissingArtEntries()
    clearPreloadMissEntries()
  })

  describe('1. Canonical 1.13c Scripted, SuperUnique & Boss-Wave Monster Closure', () => {
    it('covers all 66 SuperUniques.txt entries + CANONICAL_BOSS_MINIONS + Baal Throne Waves without null-art monsters', () => {
      const idToHcIdx = new Map<string, number>()
      const entityIdxPath = path.resolve(process.cwd(), 'public/entities/index.json')
      if (fs.existsSync(entityIdxPath)) {
        const raw = JSON.parse(fs.readFileSync(entityIdxPath, 'utf8')) as {
          monsterByClassId?: Record<string, { id: string; file: string | null }>
        }
        for (const [k, v] of Object.entries(raw.monsterByClassId ?? {})) {
          idToHcIdx.set(v.id.toLowerCase(), Number(k))
        }
      }

      const superUniques = getCanonicalSuperUniques()
      expect(superUniques).toHaveLength(66)
      for (let rowIdx = 0; rowIdx < superUniques.length; rowIdx++) {
        const su = superUniques[rowIdx]!
        const suIdx = su.index ?? rowIdx
        const mapped = SUPERUNIQUE_MONSTER_HCINDICES_113C[suIdx]
        expect(mapped, `Missing SUPERUNIQUE_MONSTER_HCINDICES_113C[${suIdx}] (${su.id})`).toBeDefined()
        expect(mapped!.length).toBeGreaterThan(0)
        if (idToHcIdx.size > 0 && su.classId) {
          const bossHcIdx = idToHcIdx.get(su.classId.toLowerCase())
          expect(mapped).toContain(bossHcIdx)
          for (const minId of CANONICAL_BOSS_MINIONS[su.id] ?? []) {
            const minHcIdx = idToHcIdx.get(minId.toLowerCase())
            if (minHcIdx !== undefined && !isMonsterArtNull113c(minHcIdx)) {
              expect(
                expandMonsterPreloadClosure113c(mapped!),
                `SuperUnique ${suIdx} (${su.id}) missing minion ${minId} (#${minHcIdx})`,
              ).toContain(minHcIdx)
            }
          }
        }
      }

      // Verify all 5 Baal Throne waves (`BAAL_THRONE_WAVES_113C`, suIdx 61..65) are in Throne of Destruction (#131)
      expect(BAAL_THRONE_WAVES_113C).toHaveLength(5)
      const throneClosure = expandMonsterPreloadClosure113c(getScriptedMonstersForLevel113c(131))
      // Baal on throne (543), Baal walking to stairs (559), Wave 1 Colenzo (62 + 23,642),
      // Wave 2 Achmel (105 + 381), Wave 3 Bartuc (557 + Hydra 351), Wave 4 Ventar (558), Wave 5 Lister (571)
      expect(throneClosure).toEqual(
        expect.arrayContaining([543, 559, 62, 23, 642, 105, 381, 557, 351, 558, 571]),
      )

      // Verify zero null-art monster IDs (`106..109, 158, 197, 320`) appear in any level's closure
      for (const [areaStr, list] of Object.entries(LEVEL_SCRIPTED_MONSTERS_113C)) {
        const areaId = Number(areaStr)
        expect(areaId).toBeGreaterThanOrEqual(1)
        expect(areaId).toBeLessThanOrEqual(136)
        const closure = expandMonsterPreloadClosure113c(list)
        for (const hcIdx of closure) {
          expect(isMonsterArtNull113c(hcIdx), `Area ${areaId} included null-art monster ${hcIdx}`).toBe(false)
          expect(MONSTATS_113C_ROWS[hcIdx], `Invalid hcIdx ${hcIdx} in area ${areaId}`).toBeDefined()
        }
      }
      for (const children of Object.values(MONSTER_RELATED_SPAWNS_113C)) {
        for (const c of children) {
          expect(isMonsterArtNull113c(c)).toBe(false)
        }
      }
    })

    it('populates current & 1-hop neighbor preload plans across Throne (130/131/132), Chaos (108), Travincal (83), Arcane (74), Tombs (66..73), Arreat (120), Nihlathak (124), and Uber Tristram (133..136) while preserving neighborAreaIds seam invariant', async () => {
      const packedDir = path.resolve(process.cwd(), 'public/act-packs/tiles')
      if (!fs.existsSync(path.join(packedDir, 'drlg-bundle.json'))) return

      await import('../../tools/lib/node-map-loader.ts')
      const { MapService } = await import('../../src/client/map/map-service.ts')
      const svc = await MapService.fromPackedDir('public/act-packs/tiles')

      // Act 5: Worldstone Keep Level 3 (130) -> Throne of Destruction (131) -> Worldstone Chamber (132)
      svc.loadAct({ act: 4, seed: 0x55aa1775, difficulty: 2, areaId: 130, revealMode: 'all' })
      const wsk3Plan = svc.getLevelPreloadPlan(130)!
      expect(wsk3Plan).not.toBeNull()
      expect(wsk3Plan.neighborAreaIds).toContain(131)
      // Entering WSK3 (130) already pre-warms Lister (571) and all 5 Baal waves in 1-hop neighborMonsterHcIndices!
      expect(wsk3Plan.neighborMonsterHcIndices).toEqual(
        expect.arrayContaining([543, 559, 62, 23, 105, 381, 557, 558, 571]),
      )

      // Enter Throne of Destruction (131): all 5 waves + Lister (571) are current, Worldstone Chamber (132) Baal + Clone + Tentacles + Tyrael are 1-hop neighbors!
      const thronePlan = svc.getLevelPreloadPlan(131)!
      expect(thronePlan.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([543, 559, 62, 23, 642, 105, 381, 557, 351, 558, 571]),
      )
      expect(thronePlan.neighborMonsterHcIndices).toEqual(
        expect.arrayContaining([544, 570, 562, 563, 564, 565, 566, 521]),
      )

      // Worldstone Chamber (132): Baal (544), Clone (570), Tentacles (562..566), Tyrael (521)
      const chamberPlan = svc.getLevelPreloadPlan(132)!
      expect(chamberPlan.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([544, 570, 562, 563, 564, 565, 566, 521]),
      )

      // Arreat Summit (120): Statues (537..539) + Ancients (540..542)
      const summitPlan = svc.getLevelPreloadPlan(120)!
      expect(summitPlan.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([537, 538, 539, 540, 541, 542]),
      )

      // Halls of Vaught (124): Nihlathak (526) + Ice Spawn (453) + Frenzied Ice Spawn (461)
      const vaughtPlan = svc.getLevelPreloadPlan(124)!
      expect(vaughtPlan.currentMonsterHcIndices).toEqual(expect.arrayContaining([526, 453, 461]))

      // Frozen River (114): Frozenstein (449) + Frozen Anya (527)
      const riverPlan = svc.getLevelPreloadPlan(114)!
      expect(riverPlan.currentMonsterHcIndices).toEqual(expect.arrayContaining([449, 527]))

      // Harrogath (109): Town NPCs + red portal lookahead to Pindleskin (440) WITHOUT polluting neighborAreaIds with 121
      const harrogathPlan = svc.getLevelPreloadPlan(109)!
      expect(harrogathPlan.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([511, 512, 513, 514, 515, 520]),
      )
      expect(harrogathPlan.neighborMonsterHcIndices).toEqual(expect.arrayContaining([440, 438]))
      expect(harrogathPlan.neighborAreaIds).not.toContain(121)

      // Pandemonium & Uber Tristram (133..136)
      expect(svc.getLevelPreloadPlan(133)!.currentMonsterHcIndices).toContain(707)
      expect(svc.getLevelPreloadPlan(134)!.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([708, 227]),
      )
      expect(svc.getLevelPreloadPlan(135)!.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([706, 724, 712]),
      )
      expect(svc.getLevelPreloadPlan(136)!.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([704, 705, 709, 712, 725, 726, 727, 728, 729, 730, 731, 732, 340]),
      )

      // Act 4 Chaos Sanctuary (108): 3 seal bosses + minions + Diablo (243) + Bone Prison (340..343)
      const chaosPlan = svc.getLevelPreloadPlan(108)!
      expect(chaosPlan.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([306, 312, 310, 699, 362, 243, 333, 340]),
      )

      // Act 3 Travincal (83) & Durance 3 (102)
      expect(svc.getLevelPreloadPlan(83)!.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([345, 346, 351, 261, 258]),
      )
      expect(svc.getLevelPreloadPlan(102)!.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([242, 346, 347, 351]),
      )

      // Act 2 Arcane Sanctuary (74) & Tal Rasha's Tomb (66 -> Duriel 73 portal lookahead without seam pollution)
      expect(svc.getLevelPreloadPlan(74)!.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([250, 371]),
      )
      const tombPlan = svc.getLevelPreloadPlan(66)!
      expect(tombPlan.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([103, 228, 96, 327, 328]),
      )
      expect(tombPlan.neighborMonsterHcIndices).toEqual(expect.arrayContaining([211, 227, 251]))
      expect(tombPlan.neighborAreaIds).not.toContain(73)

      // Act 1 Stony Field (4 -> Tristram 38 portal lookahead without seam pollution) & Cow Level (39)
      const stonyPlan = svc.getLevelPreloadPlan(4)!
      expect(stonyPlan.currentMonsterHcIndices).toEqual(expect.arrayContaining([20, 21]))
      expect(stonyPlan.neighborMonsterHcIndices).toEqual(expect.arrayContaining([365, 146]))
      expect(stonyPlan.neighborAreaIds).not.toContain(38)
      expect(svc.getLevelPreloadPlan(39)!.currentMonsterHcIndices).toContain(391)
      expect(Object.keys(LEVEL_PORTAL_NEIGHBOR_AREAS_113C).length).toBeGreaterThanOrEqual(14)

      // Full 136-level sweep: every valid areaId 1..136 returns a valid plan with zero null-art monsters
      for (let areaId = 1; areaId <= 136; areaId++) {
        const plan = svc.getLevelPreloadPlan(areaId)
        expect(plan, `Missing preload plan for areaId ${areaId}`).not.toBeNull()
        for (const hcIdx of plan!.currentMonsterHcIndices) {
          expect(isMonsterArtNull113c(hcIdx)).toBe(false)
        }
        for (const hcIdx of plan!.neighborMonsterHcIndices) {
          expect(isMonsterArtNull113c(hcIdx)).toBe(false)
        }
      }
    }, 30000)
  })

  describe('2. EntityArtCache Priority Queue, Concurrency Cap & In-Place Urgent Promotion', () => {
    function makeDeferredCatalog(ids: readonly number[]): PackedEntityCatalogIndex {
      const monsterByClassId: Record<string, { hcIdx: number; id: string; token: string; key: string }> = {}
      for (const id of ids) {
        monsterByClassId[String(id)] = {
          hcIdx: id,
          id: `mon_${id}`,
          token: `T${id}`,
          key: `spec-${id}`,
        }
      }
      return { monsterByClassId } as unknown as PackedEntityCatalogIndex
    }

    function createMockAtlasRenderer(): SpriteRenderer {
      let nextHandle = 1
      return {
        addIndexedAtlas: () => nextHandle++ as unknown as AtlasHandle,
        deleteAtlas: () => {},
      } as unknown as SpriteRenderer
    }

    it('caps background preload concurrency, prioritizes current over neighbor, and dispatches urgent live-unit fetches immediately (including promoting already-queued background packs)', async () => {
      const startedSpecs: string[] = []
      const resolvers = new Map<string, () => void>()

      const fetchFn = (async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input)
        const match = url.match(/monster-(spec-\d+)\.(json|r8)$/)
        if (!match) {
          return new Response(null, { status: 404 })
        }
        const specKey = match[1]!
        const ext = match[2]!
        if (ext === 'json' && !startedSpecs.includes(specKey)) {
          startedSpecs.push(specKey)
        }
        await new Promise<void>(resolve => {
          const prev = resolvers.get(specKey)
          resolvers.set(specKey, () => {
            prev?.()
            resolve()
          })
        })
        if (ext === 'json') {
          return new Response(
            JSON.stringify({
              token: '43',
              width: 4,
              height: 4,
              directions: 1,
              standOffset: 0,
              standFrames: 1,
              groups: [[[0, 0, 4, 4, -2, -4]]],
              clips: { nu: { group: 0, frames: 1, directions: 1, speed: 256 } },
            }),
            { status: 200 },
          )
        }
        return new Response(new Uint8Array(16), { status: 200 })
      }) as typeof fetch

      const catalog = makeDeferredCatalog([101, 102, 103, 104, 201, 202, 571])
      const cache = new EntityArtCache({
        renderer: createMockAtlasRenderer(),
        initialCatalog: catalog,
        fetchFn,
        maxBackgroundConcurrency: 2,
      })

      // Queue 4 neighbor preloads and 2 current-level preloads
      cache.preloadEntities({ monsterClassIds: [201, 202, 571, 104], priority: 'neighbor' })
      cache.preloadEntities({ monsterClassIds: [101, 102, 103], priority: 'current' })

      // Only the first 2 background tasks (`201`, `202`) started immediately; rest are queued!
      expect(startedSpecs).toEqual(['spec-201', 'spec-202'])
      expect(cache.getQueueStats()).toEqual({
        activeUrgent: 0,
        activeBackground: 2,
        queuedUrgent: 0,
        queuedBackground: 5,
      })

      // Live unit Lister (#571) spawns on screen while `571` was sitting at the back of the neighbor queue!
      // Calling `getMonsterVariantArt(571)` promotes `spec-571` to `'urgent'` and dispatches it IMMEDIATELY!
      const listerRes = cache.getMonsterVariantArt(571, undefined, 5)
      expect(listerRes).toBe('loading')
      expect(startedSpecs).toEqual(['spec-201', 'spec-202', 'spec-571'])
      expect(cache.getQueueStats().activeUrgent).toBe(1)

      // While urgent `spec-571` is active, finishing `spec-201` must NOT start a new background pack that competes with `spec-571`!
      resolvers.get('spec-201')?.()
      await new Promise(r => setTimeout(r, 0))
      expect(startedSpecs).toEqual(['spec-201', 'spec-202', 'spec-571'])

      // Finish urgent `spec-571` + remaining active `spec-202`: `preload-current` (`101`, `102`) must start AHEAD of `preload-neighbor` (`104`)!
      resolvers.get('spec-571')?.()
      resolvers.get('spec-202')?.()
      await new Promise(r => setTimeout(r, 5))
      expect(cache.getMonsterVariantArt(571, undefined, 5)).not.toBe('loading')
      expect(startedSpecs.slice(3, 5)).toEqual(['spec-101', 'spec-102'])

      // Drain remaining tasks and verify waitForInflight settles cleanly
      const drainInterval = setInterval(() => {
        for (const [k, fn] of [...resolvers.entries()]) {
          resolvers.delete(k)
          fn()
        }
      }, 2)
      await cache.waitForInflight()
      clearInterval(drainInterval)

      expect(cache.getQueueStats()).toEqual({
        activeUrgent: 0,
        activeBackground: 0,
        queuedUrgent: 0,
        queuedBackground: 0,
      })
      expect(getMissingArtEntries()).toEqual([])
    })
  })

  describe('3. WorldRenderer Loading Silhouette Placeholder & Preload-Miss Observability', () => {
    interface SolidCall {
      readonly kind: 'solid' | 'solidQuad' | 'sprite'
      readonly color?: readonly [number, number, number, number] | undefined
      readonly blendMode?: string | undefined
      readonly width?: number | undefined
      readonly height?: number | undefined
    }

    function createRecordingRenderer(): { renderer: SpriteRenderer; calls: SolidCall[] } {
      const calls: SolidCall[] = []
      let nextAtlas = 1
      const renderer = {
        addIndexedAtlas: () => nextAtlas++ as unknown as AtlasHandle,
        deleteAtlas: () => {},
        draw: (frame: AtlasFrame) => {
          calls.push({ kind: 'sprite', width: frame.width, height: frame.height })
        },
        drawQuad: () => {
          calls.push({ kind: 'solidQuad' })
        },
        drawSolid: (
          _x: number,
          _y: number,
          width: number,
          height: number,
          color: readonly [number, number, number, number],
          options?: DrawOptions,
        ) => {
          calls.push({ kind: 'solid', width, height, color, blendMode: options?.blendMode ?? 'normal' })
        },
        drawSolidQuad: (
          _x0: number,
          _y0: number,
          _x1: number,
          _y1: number,
          _x2: number,
          _y2: number,
          _x3: number,
          _y3: number,
          color: readonly [number, number, number, number],
          options?: DrawOptions,
        ) => {
          calls.push({ kind: 'solidQuad', color, blendMode: options?.blendMode ?? 'normal' })
        },
      } as unknown as SpriteRenderer
      return { renderer, calls }
    }

    function makeMonsterDrawable(overrides: Partial<SceneUnitDrawable> = {}): SceneUnitDrawable {
      return {
        drawableKind: 'unit',
        unitKind: 'monster',
        id: 77,
        unitId: 77,
        classId: 571, // Lister / Minion of Destruction
        token: '43',
        mode: 1, // NU
        direction: 0,
        frame: 0,
        subX: 100,
        subY: 100,
        worldX: 0,
        worldY: 0,
        sortY: 0,
        blendMode: 'normal',
        lifePct: 128,
        name: 'Lister the Tormentor',
        isHovered: false,
        isCorpse: false,
        tintColor: null,
        overlays: [],
        ...overrides,
      }
    }

    it('renders ground shadow + COF-sized silhouette while loading, records __d2PreloadMisses without touching __d2MissingArt, skips corpses/invisible controllers, and switches to exact sprite frame once loaded', async () => {
      const { renderer, calls } = createRecordingRenderer()
      let releaseFetch!: () => void
      const fetchGate = new Promise<void>(r => {
        releaseFetch = r
      })

      const cache = new EntityArtCache({
        renderer,
        initialCatalog: {
          monsterByClassId: {
            '571': { hcIdx: 571, id: 'baalminion1', token: '43', key: '43-hth' },
            '545': { hcIdx: 545, id: 'baaltaunt', token: 'K9', key: 'k9-hth' },
          },
        } as unknown as PackedEntityCatalogIndex,
        fetchFn: (async (input: RequestInfo | URL): Promise<Response> => {
          await fetchGate
          if (String(input).endsWith('.json')) {
            return new Response(
              JSON.stringify({
                token: '43',
                width: 8,
                height: 8,
                directions: 1,
                standOffset: 0,
                standFrames: 1,
                groups: [[[0, 0, 96, 128, -48, -120]]],
                clips: { nu: { group: 0, frames: 1, directions: 1, speed: 256 } },
              }),
              { status: 200 },
            )
          }
          return new Response(new Uint8Array(64), { status: 200 })
        }) as typeof fetch,
      })

      const ctx: SceneSourceRenderContext = {
        source: {} as SceneSourceRenderContext['source'],
        lightingPreset: {} as SceneSourceRenderContext['lightingPreset'],
        entityArtCache: cache,
      }

      // 1. Frame 1 while `571` (`43-hth`) is `'loading'`: draws shadow + tapered silhouette + additive core!
      const listerUnit = makeMonsterDrawable({ isSuperUnique: true } as Partial<SceneUnitDrawable>)
      drawSceneUnitDrawable(renderer, listerUnit, ctx, 1000, 5)
      expect(calls.length).toBeGreaterThanOrEqual(3)
      expect(calls.some(c => c.kind === 'solidQuad')).toBe(true)
      expect(calls.some(c => c.blendMode === 'additive')).toBe(true)
      expect(calls.some(c => c.kind === 'sprite')).toBe(false)

      // Observability: recorded in `__d2PreloadMisses`, ZERO entries in `__d2MissingArt`!
      expect(getMissingArtEntries()).toEqual([])
      const misses = getPreloadMissEntries()
      expect(misses).toHaveLength(1)
      expect(misses[0]).toMatchObject({
        kind: 'loading-not-preloaded',
        category: 'monster',
        id: '571',
        framesLoading: 1,
      })
      expect(misses[0]!.resolvedAt).toBeUndefined()

      // 2. Corpses (`isCorpse: true`), `STATE_INVIS = 146`, and `K9` invisible controllers (`545` baaltaunt) NEVER draw silhouettes
      calls.length = 0
      drawSceneUnitDrawable(renderer, makeMonsterDrawable({ isCorpse: true, mode: 12 }), ctx, 1040, 5)
      drawSceneUnitDrawable(renderer, makeMonsterDrawable({ hasInvisState: true } as Partial<SceneUnitDrawable>), ctx, 1040, 5)
      drawSceneUnitDrawable(renderer, makeMonsterDrawable({ classId: 545, token: 'K9' }), ctx, 1040, 5)
      expect(calls).toEqual([])

      // 3. Complete `.r8` decode: next frame immediately draws exact sprite frame and resolves `PreloadMissEntry`!
      releaseFetch()
      await cache.waitForInflight()

      calls.length = 0
      drawSceneUnitDrawable(renderer, listerUnit, ctx, 1080, 5)
      expect(calls.some(c => c.kind === 'sprite' && c.width === 96 && c.height === 128)).toBe(true)
      expect(calls.some(c => c.blendMode === 'additive')).toBe(false)
      expect(getPreloadMissEntries()[0]!.resolvedAt).toBeTypeOf('number')
      expect(getMissingArtEntries()).toEqual([])
    })
  })
})

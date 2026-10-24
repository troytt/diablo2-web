import { describe, expect, it } from 'vitest'
import { automapRevealPlugin } from '../plugins/automap-reveal/index.ts'
import { PluginConfigStore } from '../src/client/plugin-host/plugin-config-store.ts'
import { PluginHost, type PluginHostToolbarPort } from '../src/client/plugin-host/plugin-host.ts'
import type { AtlasFrame } from '../src/client/render/atlas.ts'
import type { AtlasHandle, SpriteRenderer } from '../src/client/render/renderer.ts'
import type { LoadedOverlayArt } from '../src/client/scene/missile-overlay-renderer.ts'
import {
  buildAutomapShrineDescriptor,
  classifyAutomapMonsterMarker,
} from '../src/client/scene/world-renderer.ts'
import { OnlineSession } from '../src/client/session/online-session.ts'
import { SettingsStore } from '../src/client/settings/settings-store.ts'
import {
  AUTOMAP_CROSSHAIR_COLORS,
  AUTOMAP_MONSTER_COLORS,
  AUTOMAP_SHRINE_BADGES,
  AUTOMAP_WAYPOINT_HIGHLIGHT_SCALE,
  AUTOMAP_WAYPOINT_HIGHLIGHT_TINT,
  Minimap,
  type MinimapLevel,
  resolveAutomapShrineBadge,
} from '../src/client/ui/minimap.ts'
import { Toolbar } from '../src/client/toolbar/toolbar.ts'
import {
  computeAutomapObjectPixelCoords,
  computeAutomapTilePixelCoords,
} from '../src/common/formats/automap-table.ts'

class MemoryStorage {
  private readonly map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }
}

interface RecordedSpriteDraw {
  readonly kind: 'sprite'
  readonly frame: AtlasFrame
  readonly x: number
  readonly y: number
  readonly atlas?: AtlasHandle
  readonly width?: number
  readonly height?: number
  readonly tint?: readonly [number, number, number, number]
}

interface RecordedQuadDraw {
  readonly kind: 'quad'
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly x3: number
  readonly y3: number
  readonly color: readonly [number, number, number, number]
}

type RecordedDraw = RecordedSpriteDraw | RecordedQuadDraw

function createMockRenderer(): {
  renderer: SpriteRenderer
  draws: RecordedDraw[]
} {
  const draws: RecordedDraw[] = []
  const renderer = {
    gl: null,
    flush() {},
    draw(
      frame: AtlasFrame,
      x: number,
      y: number,
      options?: {
        atlas?: AtlasHandle
        width?: number
        height?: number
        tint?: readonly [number, number, number, number]
      },
    ) {
      draws.push({
        kind: 'sprite',
        frame,
        x,
        y,
        ...(options?.atlas ? { atlas: options.atlas } : {}),
        ...(options?.width !== undefined ? { width: options.width } : {}),
        ...(options?.height !== undefined ? { height: options.height } : {}),
        ...(options?.tint ? { tint: options.tint } : {}),
      })
    },
    drawSolid() {},
    drawSolidQuad(
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      color: readonly [number, number, number, number],
    ) {
      draws.push({ kind: 'quad', x0, y0, x1, y1, x2, y2, x3, y3, color })
    },
  } as unknown as SpriteRenderer
  return { renderer, draws }
}

function makeRadarTestLevel(): MinimapLevel {
  const cellsX = 24
  const cellsY = 24
  const gridWidth = cellsX * 5
  const blocked = new Uint8Array(gridWidth * cellsY * 5)
  const nearCoords = computeAutomapTilePixelCoords(4, 4, 0)
  return {
    key: 'radar-test-level',
    cellsX,
    cellsY,
    blocked,
    gridWidth,
    markers: [],
    automap: {
      layerId: 1,
      levelTypeId: 1,
      floors: [
        {
          cellNo: 5,
          xPixel: nearCoords.xPixel,
          yPixel: nearCoords.yPixel,
          cellX: 4,
          cellY: 4,
          fSaved: 0,
          weight: 0,
        },
      ],
      walls: [],
      objects: [],
      extras: [],
    },
    levelId: 2,
    levelName: 'Blood Moor',
    difficulty: 'Hell',
  }
}

describe('Automap Reveal Plugin — Monster & Shrine Radar (Issue #881)', () => {
  it('registers showMonsters and showShrines settings (default true when enabled) and reverts to 1.13c false when disabled', async () => {
    const settingsStore = new SettingsStore({
      storage: new MemoryStorage(),
      defaultLang: 'en',
      syncGlobalLang: false,
    })
    const toolbar = new Toolbar({ store: settingsStore })
    const session = new OnlineSession({ settingsStore })

    // Before plugin starts, native 1.13c defaults are false
    expect(settingsStore.get().automapShowMonsters).toBe(false)
    expect(settingsStore.get().automapShowShrines).toBe(false)
    expect(settingsStore.get().automapShowWaypoints).toBe(false)
    expect(session.automapView.getShowWaypoints()).toBe(false)
    expect(session.automapView.getRadarConfig()).toEqual({
      automapShowMonsters: false,
      automapShowShrines: false,
    })

    const configStore = new PluginConfigStore([automapRevealPlugin], {
      storage: new MemoryStorage(),
    })
    const toolbarPort: PluginHostToolbarPort = {
      setPluginsButtonState() {},
      addContribution: (spec) => toolbar.addContribution(spec),
      getAllowedViewports: () => toolbar.getAllowedViewports(),
      setAllowedViewports: (vps) => toolbar.setAllowedViewports(vps),
    }

    const host = new PluginHost({
      plugins: [automapRevealPlugin],
      configStore,
      session,
      toolbar: toolbarPort,
      settingsStore,
      enforceClientDefaults: true,
      autoStart: false,
    })

    await host.start()

    // Plugin enabled by default -> showMonsters, showShrines, and showWaypoints default to true
    expect(host.getSetting('automap-reveal', 'showMonsters')).toBe(true)
    expect(host.getSetting('automap-reveal', 'showShrines')).toBe(true)
    expect(host.getSetting('automap-reveal', 'showWaypoints')).toBe(true)
    expect(settingsStore.get().automapShowMonsters).toBe(true)
    expect(settingsStore.get().automapShowShrines).toBe(true)
    expect(settingsStore.get().automapShowWaypoints).toBe(true)
    expect(session.automapView.getShowWaypoints()).toBe(true)
    expect(session.automapView.getRadarConfig()).toEqual({
      automapShowMonsters: true,
      automapShowShrines: true,
    })

    // Toggle individual settings
    host.setSetting('automap-reveal', 'showMonsters', false)
    expect(settingsStore.get().automapShowMonsters).toBe(false)
    expect(settingsStore.get().automapShowShrines).toBe(true)
    expect(settingsStore.get().automapShowWaypoints).toBe(true)
    expect(session.automapView.getRadarConfig()).toEqual({
      automapShowMonsters: false,
      automapShowShrines: true,
    })

    host.setSetting('automap-reveal', 'showShrines', false)
    expect(settingsStore.get().automapShowShrines).toBe(false)
    expect(session.automapView.getRadarConfig()).toEqual({
      automapShowMonsters: false,
      automapShowShrines: false,
    })

    host.setSetting('automap-reveal', 'showWaypoints', false)
    expect(settingsStore.get().automapShowWaypoints).toBe(false)
    expect(session.automapView.getShowWaypoints()).toBe(false)

    host.setSetting('automap-reveal', 'showMonsters', true)
    host.setSetting('automap-reveal', 'showShrines', true)
    host.setSetting('automap-reveal', 'showWaypoints', true)
    expect(session.automapView.getShowWaypoints()).toBe(true)
    expect(session.automapView.getRadarConfig()).toEqual({
      automapShowMonsters: true,
      automapShowShrines: true,
    })

    // Disabling automap-reveal strictly reverts to 100% vanilla 1.13c (all false)
    await host.setEnabled('automap-reveal', false)
    expect(settingsStore.get().automapReveal).toBe('off')
    expect(settingsStore.get().automapShowMonsters).toBe(false)
    expect(settingsStore.get().automapShowShrines).toBe(false)
    expect(settingsStore.get().automapShowWaypoints).toBe(false)
    expect(session.automapView.getShowWaypoints()).toBe(false)
    expect(session.automapView.getRadarConfig()).toEqual({
      automapShowMonsters: false,
      automapShowShrines: false,
    })

    // Re-enabling restores persisted plugin preferences
    await host.setEnabled('automap-reveal', true)
    expect(settingsStore.get().automapShowMonsters).toBe(true)
    expect(settingsStore.get().automapShowShrines).toBe(true)
    expect(settingsStore.get().automapShowWaypoints).toBe(true)
    expect(session.automapView.getShowWaypoints()).toBe(true)
  })

  it('classifies Normal, Minion, Champion, Unique, and SuperUnique/Boss monsters and filters corpses, noMap, NPCs, pets, and statues', () => {
    const baseMonster = {
      classId: 0, // skeleton1 (Normal monster, noMap=0, killable=true)
      worldX: 160,
      worldY: 320,
      mode: 1, // NU (alive)
      lifePct: 100,
      isCorpse: false,
      isNpc: false,
      flags: 0,
      isChampion: false,
      isUnique: false,
      isSuperUnique: false,
      superUniqueId: undefined as number | undefined,
      ownerType: undefined as string | undefined,
      ownerId: undefined as number | undefined,
      name: undefined as string | undefined,
      nameZh: undefined as string | undefined,
    }

    // 1. Vanilla 1.13c mode (showMonsters = false): hostile monsters return null
    expect(classifyAutomapMonsterMarker(baseMonster, false, true)).toBeNull()

    // 2. Hostile Monster Tiers when showMonsters = true
    expect(classifyAutomapMonsterMarker(baseMonster, true, true)?.kind).toBe('monsterNormal')
    expect(
      classifyAutomapMonsterMarker({ ...baseMonster, flags: 0x10 }, true, true)?.kind,
    ).toBe('monsterMinion')
    expect(
      classifyAutomapMonsterMarker({ ...baseMonster, isChampion: true }, true, true)?.kind,
    ).toBe('monsterChampion')
    expect(
      classifyAutomapMonsterMarker({ ...baseMonster, flags: 0x04 }, true, true)?.kind,
    ).toBe('monsterChampion')
    expect(
      classifyAutomapMonsterMarker({ ...baseMonster, isUnique: true }, true, true)?.kind,
    ).toBe('monsterUnique')
    expect(
      classifyAutomapMonsterMarker({ ...baseMonster, flags: 0x08 }, true, true)?.kind,
    ).toBe('monsterUnique')

    // SuperUnique (Bishibosh, superUniqueId = 0) and Act Boss (Andariel, classId = 156)
    const bishibosh = classifyAutomapMonsterMarker(
      { ...baseMonster, classId: 59, isSuperUnique: true, superUniqueId: 0, name: 'Bishibosh' },
      true,
      true,
    )
    expect(bishibosh?.kind).toBe('monsterSuperUnique')
    expect(bishibosh?.name).toBe('Bishibosh')

    const andariel = classifyAutomapMonsterMarker(
      { ...baseMonster, classId: 156 },
      true,
      true,
    )
    expect(andariel?.kind).toBe('monsterSuperUnique')
    expect(andariel?.name).toBeTruthy()

    // 3. Strict Exclusions: corpses, DT(0)/DD(12), lifePct<=0, Ancients statues (537..539), MonStats2 noMap=1 (149 chicken, 411 lightning sentry, 351 hydra1)
    expect(classifyAutomapMonsterMarker({ ...baseMonster, isCorpse: true }, true, true)).toBeNull()
    expect(classifyAutomapMonsterMarker({ ...baseMonster, mode: 0 }, true, true)).toBeNull()
    expect(classifyAutomapMonsterMarker({ ...baseMonster, mode: 12 }, true, true)).toBeNull()
    expect(classifyAutomapMonsterMarker({ ...baseMonster, lifePct: 0 }, true, true)).toBeNull()
    expect(classifyAutomapMonsterMarker({ ...baseMonster, classId: 537 }, true, true)).toBeNull()
    expect(classifyAutomapMonsterMarker({ ...baseMonster, classId: 538 }, true, true)).toBeNull()
    expect(classifyAutomapMonsterMarker({ ...baseMonster, classId: 539 }, true, true)).toBeNull()
    expect(classifyAutomapMonsterMarker({ ...baseMonster, classId: 149 }, true, true)).toBeNull() // chicken (noMap=1)
    expect(classifyAutomapMonsterMarker({ ...baseMonster, classId: 411 }, true, true)).toBeNull() // chargeboltsentry (noMap=1)
    expect(classifyAutomapMonsterMarker({ ...baseMonster, classId: 351 }, true, true)).toBeNull() // hydra1 (noMap=1)

    // 4. Town NPCs and Player Pets/Mercenaries keep 1.13c friendly markers regardless of showMonsters
    const akara = classifyAutomapMonsterMarker({ ...baseMonster, classId: 148 }, false, true)
    expect(akara?.kind).toBe('npc')
    expect(akara?.name).toBe('Akara')

    const ownMerc = classifyAutomapMonsterMarker(
      { ...baseMonster, classId: 338, ownerType: 'player', ownerId: 1 },
      true,
      true,
      1,
    )
    expect(ownMerc?.kind).toBe('mercenary')

    const partyMerc = classifyAutomapMonsterMarker(
      { ...baseMonster, classId: 338, ownerType: 'player', ownerId: 2 },
      true,
      true,
      1,
    )
    expect(partyMerc?.kind).toBe('partyPet')

    const valkyrie = classifyAutomapMonsterMarker(
      { ...baseMonster, classId: 357, ownerType: 'player', ownerId: 1 },
      true,
      true,
      1,
    )
    expect(valkyrie?.kind).toBe('summon')
    expect(valkyrie?.classId).toBe(357)
  })

  it('builds Shrine descriptors for Shrines.txt Code 0..22 with localized badges and overlay icons, excluding non-shrines', () => {
    for (let code = 0; code <= 22; code++) {
      const badge = resolveAutomapShrineBadge(code)
      expect(badge.code).toBe(code)
      expect(badge.shortEn.length).toBeGreaterThan(0)
      expect(badge.shortZh.length).toBeGreaterThan(0)
    }
    expect(AUTOMAP_SHRINE_BADGES[15]?.shortEn).toBe('Exp')
    expect(AUTOMAP_SHRINE_BADGES[15]?.shortZh).toBe('经验')
    expect(AUTOMAP_SHRINE_BADGES[12]?.shortEn).toBe('Skill')
    expect(AUTOMAP_SHRINE_BADGES[18]?.shortEn).toBe('Gem')
    expect(AUTOMAP_SHRINE_BADGES[19]?.isDanger).toBe(true)

    const mockAtlasHandle = { texture: 'ov-tex' as unknown as WebGLTexture, width: 64, height: 64 }
    const mockFrame: AtlasFrame = { x: 0, y: 0, width: 28, height: 32, anchorX: -14, anchorY: -16 }
    const overlayMap = new Map<string, LoadedOverlayArt>([
      [
        'shrine_experience',
        {
          handle: mockAtlasHandle,
          frames: [[mockFrame]],
          meta: { width: 28, height: 32, yOffset: -60 },
        } as unknown as LoadedOverlayArt,
      ],
    ])

    // ClassId 2 = Shrine (isShrine = true)
    const expShrineEn = buildAutomapShrineDescriptor(
      {
        classId: 2,
        worldX: 200,
        worldY: 300,
        mode: 0,
        interactType: 15,
        shrineType: undefined,
        flags: undefined,
      },
      true,
      overlayMap,
    )
    expect(expShrineEn).not.toBeNull()
    expect(expShrineEn?.shrineCode).toBe(15)
    expect(expShrineEn?.mode).toBe(0)
    expect(expShrineEn?.shortLabel).toBe('Exp')
    expect(expShrineEn?.labelColor).toBe('gold')
    expect(expShrineEn?.overlayAtlas).toBe(mockAtlasHandle)
    expect(expShrineEn?.overlayFrame).toBe(mockFrame)

    const expShrineZh = buildAutomapShrineDescriptor(
      {
        classId: 2,
        worldX: 200,
        worldY: 300,
        mode: 2,
        interactType: 15,
        shrineType: undefined,
        flags: undefined,
      },
      false,
      overlayMap,
    )
    expect(expShrineZh?.shortLabel).toBe('经验')
    expect(expShrineZh?.mode).toBe(2)

    // Non-shrine object (Stash = 267) returns null
    expect(
      buildAutomapShrineDescriptor(
        {
          classId: 267,
          worldX: 200,
          worldY: 300,
          mode: 0,
          interactType: 0,
          shrineType: undefined,
          flags: undefined,
        },
        true,
        overlayMap,
      ),
    ).toBeNull()
  })

  it('renders monster tier crosshairs and active vs depleted shrines across both Corner Minimap (divisor=20) and Full Automap (divisor=10)', () => {
    const minimap = new Minimap()
    const level = makeRadarTestLevel()
    minimap.reveal(level, 4, 4, 0, 320, true)

    const mockAtlasHandle = { texture: 'ov-tex' as unknown as WebGLTexture, width: 64, height: 64 }
    const mockFrame: AtlasFrame = { x: 0, y: 0, width: 28, height: 32 }

    for (const bMinimap of [true, false] as const) {
      minimap.bMinimap = bMinimap
      minimap.showNames = true
      const { renderer, draws } = createMockRenderer()

      minimap.draw(
        renderer,
        level,
        4,
        4,
        { x: 0, y: 0, zoom: 1 },
        { width: 800, height: 600 },
        {
          playerWorldX: 0,
          playerWorldY: 320,
          entities: [
            { x: 10, y: 320, kind: 'monsterNormal', alive: true },
            { x: 20, y: 320, kind: 'monsterMinion', alive: true },
            { x: 30, y: 320, kind: 'monsterChampion', alive: true },
            { x: 40, y: 320, kind: 'monsterUnique', alive: true },
            { x: 50, y: 320, kind: 'monsterSuperUnique', name: 'Bishibosh', alive: true },
          ],
          shrines: [
            {
              x: -20,
              y: 320,
              shrineCode: 15,
              mode: 0, // Active Experience Shrine
              shortLabel: 'Exp',
              labelColor: 'gold',
              markerColor: AUTOMAP_SHRINE_BADGES[15]!.markerColor,
              overlayAtlas: mockAtlasHandle,
              overlayFrame: mockFrame,
            },
            {
              x: -40,
              y: 320,
              shrineCode: 12,
              mode: 2, // Depleted/recharging Skill Shrine
              shortLabel: 'Skill',
              labelColor: 'orange',
              markerColor: AUTOMAP_SHRINE_BADGES[12]!.markerColor,
              overlayAtlas: mockAtlasHandle,
              overlayFrame: mockFrame,
            },
          ],
        },
      )

      expect(minimap.lastRenderStats.divisor).toBe(bMinimap ? 20 : 10)
      expect(minimap.lastRenderStats.crosshairsDrawn.monsters).toBe(5)
      expect(minimap.lastRenderStats.crosshairsDrawn.bosses).toBe(2) // Unique + SuperUnique
      expect(minimap.lastRenderStats.crosshairsDrawn.player).toBe(1)
      expect(minimap.lastRenderStats.spritesDrawn.shrines).toBe(2)

      // Verify all 5 MapHack monster tier colors were drawn
      const quadDraws = draws.filter((d): d is RecordedQuadDraw => d.kind === 'quad')
      expect(
        quadDraws.some(
          (q) =>
            q.color[0] === AUTOMAP_MONSTER_COLORS.monsterNormal[0] &&
            q.color[1] === AUTOMAP_MONSTER_COLORS.monsterNormal[1] &&
            q.color[2] === AUTOMAP_MONSTER_COLORS.monsterNormal[2],
        ),
      ).toBe(true)
      expect(
        quadDraws.some(
          (q) =>
            q.color[0] === AUTOMAP_MONSTER_COLORS.monsterMinion[0] &&
            q.color[1] === AUTOMAP_MONSTER_COLORS.monsterMinion[1] &&
            q.color[2] === AUTOMAP_MONSTER_COLORS.monsterMinion[2],
        ),
      ).toBe(true)
      expect(
        quadDraws.some(
          (q) =>
            q.color[0] === AUTOMAP_MONSTER_COLORS.monsterChampion[0] &&
            q.color[1] === AUTOMAP_MONSTER_COLORS.monsterChampion[1] &&
            q.color[2] === AUTOMAP_MONSTER_COLORS.monsterChampion[2],
        ),
      ).toBe(true)
      expect(
        quadDraws.some(
          (q) =>
            q.color[0] === AUTOMAP_MONSTER_COLORS.monsterUnique[0] &&
            q.color[1] === AUTOMAP_MONSTER_COLORS.monsterUnique[1] &&
            q.color[2] === AUTOMAP_MONSTER_COLORS.monsterUnique[2],
        ),
      ).toBe(true)
      expect(
        quadDraws.some(
          (q) =>
            q.color[0] === AUTOMAP_MONSTER_COLORS.monsterSuperUnique[0] &&
            q.color[1] === AUTOMAP_MONSTER_COLORS.monsterSuperUnique[1] &&
            q.color[2] === AUTOMAP_MONSTER_COLORS.monsterSuperUnique[2],
        ),
      ).toBe(true)
      expect(
        quadDraws.some((q) => q.color[2] === AUTOMAP_CROSSHAIR_COLORS.player[2]),
      ).toBe(true)

      // SuperUnique name label is recorded with purple Font6 color
      expect(minimap.lastRenderStats.entityLabels).toEqual([
        expect.objectContaining({
          text: 'Bishibosh',
          color: 'purple',
          kind: 'entity',
        }),
      ])

      // Active shrine (mode=0) draws full-alpha overlay icon (alpha=1.0) and pushes 'Exp' badge;
      // Depleted shrine (mode=2) draws dimmed overlay icon (alpha=0.35) and hides 'Skill' badge!
      const shrineOverlayDraws = draws.filter(
        (d): d is RecordedSpriteDraw => d.kind === 'sprite' && d.atlas === mockAtlasHandle,
      )
      expect(shrineOverlayDraws).toHaveLength(2)
      expect(shrineOverlayDraws.some((s) => s.tint?.[3] === 1.0)).toBe(true)
      expect(shrineOverlayDraws.some((s) => s.tint?.[3] === 0.35)).toBe(true)

      const shrineLabels = minimap.lastRenderStats.warpLabels.filter((l) => l.kind === 'shrine')
      expect(shrineLabels).toHaveLength(1)
      expect(shrineLabels[0]?.text).toBe('Exp')
      expect(shrineLabels[0]?.color).toBe('gold')
    }
  })

  it('draws 2x scaled, bright-tinted top-layer waypoint icons in both Corner Minimap and Full Automap when highlightWaypoints is enabled', () => {
    const cellsX = 24
    const cellsY = 24
    const gridWidth = cellsX * 5
    const blocked = new Uint8Array(gridWidth * cellsY * 5)
    const floorWpCoords = computeAutomapTilePixelCoords(4, 4, 0)
    const objWpCoords = computeAutomapObjectPixelCoords(5 * 5 + 2, 4 * 5 + 2)
    const level: MinimapLevel = {
      key: 'waypoint-highlight-test',
      cellsX,
      cellsY,
      blocked,
      gridWidth,
      markers: [
        {
          cellX: 6,
          cellY: 4,
          kind: 'waypoint',
        },
      ],
      automap: {
        layerId: 1,
        levelTypeId: 1,
        floors: [
          {
            cellNo: 307,
            xPixel: floorWpCoords.xPixel,
            yPixel: floorWpCoords.yPixel,
            cellX: 4,
            cellY: 4,
            fSaved: 0,
            weight: 0,
          },
        ],
        walls: [],
        objects: [
          {
            cellNo: 307,
            xPixel: objWpCoords.xPixel,
            yPixel: objWpCoords.yPixel,
            cellX: 5,
            cellY: 4,
            fSaved: 0,
            weight: 0,
          },
        ],
        extras: [],
      },
      levelId: 2,
    }

    for (const bMinimap of [true, false]) {
      const minimap = new Minimap()
      minimap.bMinimap = bMinimap
      const sheetName = bMinimap ? 'MaxiMapS' : 'MaxiMap'
      const mockAtlasHandle = { id: `mock-${sheetName}` } as unknown as AtlasHandle
      minimap.setAtlasHandle(sheetName, mockAtlasHandle)
      minimap.reveal(level, 4, 4, 0, 320, true)

      const wpFrame = minimap.getSheetMeta(sheetName).frames[307]!
      expect(wpFrame.width).toBe(bMinimap ? 8 : 16)
      expect(wpFrame.height).toBe(bMinimap ? 16 : 32)

      // 1. Default 1.13c (highlightWaypoints = false): draws 1x floor + 1x object, 0 top-layer waypoints
      const passDefault = createMockRenderer()
      minimap.draw(
        passDefault.renderer,
        level,
        4,
        4,
        { x: 0, y: 0, zoom: 1 },
        { width: 800, height: 600 },
        { playerWorldX: 0, playerWorldY: 320, highlightWaypoints: false },
      )
      expect(minimap.lastRenderStats.spritesDrawn.waypoints).toBe(0)
      expect(minimap.lastRenderStats.warpLabels).toHaveLength(0)

      // 2. Highlighted (highlightWaypoints = true): draws 3 top-layer 2x bright-tinted waypoint sprites (floor + object + marker)
      const passHighlight = createMockRenderer()
      minimap.draw(
        passHighlight.renderer,
        level,
        4,
        4,
        { x: 0, y: 0, zoom: 1 },
        { width: 800, height: 600 },
        { playerWorldX: 0, playerWorldY: 320, highlightWaypoints: true },
      )
      expect(minimap.lastRenderStats.spritesDrawn.waypoints).toBe(3)
      expect(minimap.lastRenderStats.warpLabels).toHaveLength(0)

      const highlightedDraws = passHighlight.draws.filter(
        (d): d is RecordedSpriteDraw =>
          d.kind === 'sprite' &&
          d.width === wpFrame.width * AUTOMAP_WAYPOINT_HIGHLIGHT_SCALE &&
          d.height === wpFrame.height * AUTOMAP_WAYPOINT_HIGHLIGHT_SCALE,
      )
      expect(highlightedDraws).toHaveLength(3)
      for (const d of highlightedDraws) {
        expect(d.tint).toEqual([
          AUTOMAP_WAYPOINT_HIGHLIGHT_TINT[0],
          AUTOMAP_WAYPOINT_HIGHLIGHT_TINT[1],
          AUTOMAP_WAYPOINT_HIGHLIGHT_TINT[2],
          bMinimap ? 1.0 : 0.25,
        ])
      }
    }
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  createGroundItemBeamPlugin,
  groundItemBeamPlugin,
  type GroundItemBeamPluginInstance,
} from '../../plugins/ground-item-beam/index.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { PluginHost } from '../../src/client/plugin-host/plugin-host.ts'
import {
  renderSceneSourceFrame,
  resolveGroundItemLootBeamQuality,
} from '../../src/client/scene/world-renderer.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import type { SceneUnitDrawable } from '../../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
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

interface MockCanvasGradient {
  readonly stops: Array<{ readonly offset: number; readonly color: string }>
  addColorStop: ReturnType<typeof vi.fn>
}

function createMockHudCanvas(): {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  readonly gradients: MockCanvasGradient[]
  readonly fillRectStyles: string[]
} {
  const gradients: MockCanvasGradient[] = []
  const fillRectStyles: string[] = []
  const ctx = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(function (this: { fillStyle: string | MockCanvasGradient }) {
      if (typeof this.fillStyle === 'string') {
        fillRectStyles.push(this.fillStyle)
      }
    }),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    createLinearGradient: vi.fn(() => {
      const grad: MockCanvasGradient = {
        stops: [],
        addColorStop: vi.fn((offset: number, color: string) => {
          grad.stops.push({ offset, color })
        }),
      }
      gradients.push(grad)
      return grad
    }),
    createRadialGradient: vi.fn(() => {
      const grad: MockCanvasGradient = {
        stops: [],
        addColorStop: vi.fn((offset: number, color: string) => {
          grad.stops.push({ offset, color })
        }),
      }
      gradients.push(grad)
      return grad
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D

  const canvas = {
    width: 800,
    height: 600,
    style: {},
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    getContext: () => ctx,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement

  return { canvas, ctx, gradients, fillRectStyles }
}

function makeItemDrawable(overrides: Partial<SceneUnitDrawable> & { unitId: number }): SceneUnitDrawable {
  return {
    drawableKind: 'unit',
    unitKind: 'item',
    classId: 100,
    mode: 3, // ITEMMODE_ON_GROUND
    subX: 0,
    subY: 0,
    worldX: 0,
    worldY: 0,
    sortY: 0,
    direction: 0,
    frame: 0,
    frameCount: 1,
    atlas: null,
    isLocalPlayer: false,
    isHovered: false,
    isCorpse: false,
    ...overrides,
  } as SceneUnitDrawable
}

describe('Ground Item Display Enhancements Plugin (`ground-item-beam`, Issue #957)', () => {
  it('activates with default enabled enhancements, syncs individual toggles, and reverts to 1.13c vanilla on deactivate', async () => {
    const settingsStorage = new MemoryStorage()
    const pluginStorage = new MemoryStorage()
    const settingsStore = new SettingsStore({
      storage: settingsStorage,
      syncGlobalLang: false,
    })
    const session = new OnlineSession({ settingsStore })

    // 1. Vanilla 1.13c baseline before plugin host starts
    expect(settingsStore.get().showUniqueSetBeams).toBe(false)
    expect(settingsStore.get().alwaysShowUniqueSetLabels).toBe(false)
    expect(session.hudManager.getGroundItemEnhancements()).toEqual({
      showUniqueSetBeams: false,
      alwaysShowUniqueSetLabels: false,
    })

    const host = new PluginHost({
      plugins: [createGroundItemBeamPlugin()],
      session,
      settingsStore,
      enforceClientDefaults: true,
      storageOptions: { storage: pluginStorage },
    })
    await host.whenStarted()

    // 2. Plugin is defaultEnabled: true -> both enhancements active
    expect(settingsStore.get().showUniqueSetBeams).toBe(true)
    expect(settingsStore.get().alwaysShowUniqueSetLabels).toBe(true)
    expect(session.hudManager.getGroundItemEnhancements()).toEqual({
      showUniqueSetBeams: true,
      alwaysShowUniqueSetLabels: true,
    })

    const inst = host.getInstance<GroundItemBeamPluginInstance>(groundItemBeamPlugin.id)
    expect(inst?.getConfig()).toEqual({
      showUniqueSetBeams: true,
      alwaysShowUniqueSetLabels: true,
    })

    const snap1 = host.list().find((p) => p.id === groundItemBeamPlugin.id)!
    expect(snap1.active).toBe(true)
    expect(snap1.status.level).toBe('ok')
    expect(snap1.status.text.zh).toContain('掉落光柱')
    expect(snap1.status.text.zh).toContain('名字常驻')
    expect(snap1.status.text.en).toContain('Loot Beams')
    expect(snap1.status.text.en).toContain('Permanent Labels')

    // 3. Toggle individual setting: disable showUniqueSetBeams only
    host.setSetting('ground-item-beam', 'showUniqueSetBeams', false)
    expect(settingsStore.get().showUniqueSetBeams).toBe(false)
    expect(settingsStore.get().alwaysShowUniqueSetLabels).toBe(true)
    expect(session.hudManager.getGroundItemEnhancements()).toEqual({
      showUniqueSetBeams: false,
      alwaysShowUniqueSetLabels: true,
    })
    expect(host.getStatus('ground-item-beam').text).toEqual({
      zh: '已启用：名字常驻',
      en: 'Active: Permanent Labels',
    })

    // 4. Disable both settings while plugin remains active -> status reports vanilla display
    inst?.setConfig({ alwaysShowUniqueSetLabels: false })
    expect(settingsStore.get().alwaysShowUniqueSetLabels).toBe(false)
    expect(host.getStatus('ground-item-beam').text).toEqual({
      zh: '当前：已全部关闭（原版显示）',
      en: 'Active: None (Vanilla display)',
    })

    // Re-enable both settings
    inst?.setConfig({ showUniqueSetBeams: true, alwaysShowUniqueSetLabels: true })
    expect(session.hudManager.getGroundItemEnhancements()).toEqual({
      showUniqueSetBeams: true,
      alwaysShowUniqueSetLabels: true,
    })

    // 5. Disable the entire plugin -> strictly reverts both flags to 1.13c vanilla false
    await host.setEnabled('ground-item-beam', false)
    expect(settingsStore.get().showUniqueSetBeams).toBe(false)
    expect(settingsStore.get().alwaysShowUniqueSetLabels).toBe(false)
    expect(session.hudManager.getGroundItemEnhancements()).toEqual({
      showUniqueSetBeams: false,
      alwaysShowUniqueSetLabels: false,
    })

    // 6. Re-enable plugin -> restores persisted settings
    await host.setEnabled('ground-item-beam', true)
    expect(settingsStore.get().showUniqueSetBeams).toBe(true)
    expect(settingsStore.get().alwaysShowUniqueSetLabels).toBe(true)

    await host.destroy()
    session.destroy()
  })

  it('classifies only genuine Unique (quality=7) and Set (quality=5) items while excluding gold, quest items, and other qualities', () => {
    expect(
      resolveGroundItemLootBeamQuality(
        makeItemDrawable({ unitId: 1, code: 'uap', itemQuality: 7 }),
        'uap',
      ),
    ).toBe('unique')
    expect(
      resolveGroundItemLootBeamQuality(
        makeItemDrawable({ unitId: 2, code: 'uar', itemQuality: 5 }),
        'uar',
      ),
    ).toBe('set')

    // Normal (2), Superior (3), Magic (4), Rare (6), Crafted (8) -> null
    for (const q of [1, 2, 3, 4, 6, 8]) {
      expect(
        resolveGroundItemLootBeamQuality(
          makeItemDrawable({ unitId: 10 + q, code: 'rin', itemQuality: q }),
          'rin',
        ),
      ).toBeNull()
    }

    // Gold ('gld') and canonical quest items ('bks', 'box', 'hst', 'msf') colored gold in 1.13c -> null
    expect(
      resolveGroundItemLootBeamQuality(
        makeItemDrawable({ unitId: 20, code: 'gld', itemQuality: 7, itemColor: '#c4a060' }),
        'gld',
      ),
    ).toBeNull()
    for (const questCode of ['bks', 'box', 'hst', 'vip', 'msf', 'j34', 'g34', 'mss', 'bbb']) {
      expect(
        resolveGroundItemLootBeamQuality(
          makeItemDrawable({ unitId: 30, code: questCode, itemQuality: 7, itemColor: '#c4a060' }),
          questCode,
        ),
      ).toBeNull()
    }
  })

  it('renders Diablo III-style loot beams (with 2:1 isometric elliptical base) and permanent ground labels for Unique & Set items without holding Alt', () => {
    const { canvas, ctx, gradients, fillRectStyles } = createMockHudCanvas()
    const hudManager = new HudManager(canvas)
    hudManager.showGroundLabels = false // Player is NOT holding Alt
    hudManager.setGroundItemEnhancements({
      showUniqueSetBeams: true,
      alwaysShowUniqueSetLabels: true,
    })

    const uniqueShako = makeItemDrawable({
      unitId: 101,
      code: 'uap',
      name: 'Harlequin Crest',
      nameZh: '谐角之冠',
      itemQuality: 7,
      itemColor: '#c4a060',
      worldX: -40,
      worldY: 0,
      mode: 3,
    })
    const setTalArmor = makeItemDrawable({
      unitId: 102,
      code: 'uth',
      name: "Tal Rasha's Guardianship",
      nameZh: '塔拉夏的守护',
      itemQuality: 5,
      itemColor: '#00fc00',
      worldX: 50,
      worldY: 10,
      mode: 3,
    })
    const rareRing = makeItemDrawable({
      unitId: 103,
      code: 'rin',
      name: 'Raven Spiral',
      nameZh: '乌鸦螺旋',
      itemQuality: 6,
      itemColor: '#ffff00',
      worldX: 0,
      worldY: 20,
      mode: 3,
    })
    const airborneUnique = makeItemDrawable({
      unitId: 104,
      code: 'ulc',
      name: 'Arachnid Mesh',
      nameZh: '蜘蛛之网',
      itemQuality: 7,
      itemColor: '#c4a060',
      worldX: 20,
      worldY: 0,
      mode: 5, // ITEMMODE_DROPPING (airborne flippy) -> must be suppressed
    })
    const horadricCubeQuest = makeItemDrawable({
      unitId: 105,
      code: 'box',
      name: 'Horadric Cube',
      nameZh: '赫拉迪姆方块',
      itemQuality: 7,
      itemColor: '#c4a060',
      worldX: -80,
      worldY: 0,
      mode: 3,
    })

    renderSceneSourceFrame({
      hudManager,
      viewportProfile: hudManager.viewportProfile,
      cameraX: 0,
      cameraY: 0,
      nowMs: 1200,
      unitDrawables: [uniqueShako, setTalArmor, rareRing, airborneUnique, horadricCubeQuest],
    } as any)

    // 1. Only landed Unique (101) and Set (102) items emit loot beams
    expect(hudManager.groundItemBeams.map((b) => ({ id: b.id, quality: b.quality }))).toEqual([
      { id: 101, quality: 'unique' },
      { id: 102, quality: 'set' },
    ])

    // 2. Only landed Unique (101) and Set (102) items produce permanent ground label boxes when Alt is not held
    expect(hudManager.groundItemLabelBoxes.map((b) => b.id)).toEqual([101, 102])
    expect(hudManager.groundItemLabelBoxes[0]?.color).toBe('#c4a060')
    expect(hudManager.groundItemLabelBoxes[1]?.color).toBe('#00fc00')

    // 3. Canvas 2:1 isometric perspective (`ctx.scale(1, 0.5)`) and vertical beam gradients were rendered
    expect(ctx.scale).toHaveBeenCalledWith(1, 0.5)
    expect(ctx.createLinearGradient).toHaveBeenCalled()
    expect(ctx.createRadialGradient).toHaveBeenCalled()
    expect(gradients.length).toBeGreaterThanOrEqual(8)

    // Unhovered permanent label plaque uses semi-transparent black background (`rgba(0, 0, 0, 0.5)`)
    expect(fillRectStyles).toContain('rgba(0, 0, 0, 0.5)')
    expect(fillRectStyles).not.toContain('rgba(16, 36, 104, 0.85)')

    // 4. Hovering the Unique item highlights its permanent label box with 1.13c blue hover background
    fillRectStyles.length = 0
    renderSceneSourceFrame({
      hudManager,
      viewportProfile: hudManager.viewportProfile,
      cameraX: 0,
      cameraY: 0,
      nowMs: 1240,
      hoveredUnit: { id: 101 },
      unitDrawables: [uniqueShako, setTalArmor, rareRing],
    } as any)
    expect(hudManager.groundItemLabelBoxes.find((b) => b.id === 101)?.isHovered).toBe(true)
    expect(fillRectStyles).toContain('rgba(16, 36, 104, 0.85)')

    // 5. Clicking a permanent ground item label box when Alt is NOT held resolves the item unit in CommandMapper
    const world = new ClientWorld()
    world.selfId = 1
    world.self.unitId = 1
    world.self.x = 100
    world.self.y = 100
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 4,
        id: 101,
        classId: 100,
        name: 'Harlequin Crest',
        x: 102,
        y: 102,
        lifePct: 128,
        mode: 3,
      },
    })
    const mapper = new CommandMapper({
      world,
      hudManager,
      sendCommand: () => {},
    })
    const shakoBox = hudManager.groundItemLabelBoxes.find((b) => b.id === 101)!
    const target = mapper.resolvePointerTarget(
      shakoBox.x + shakoBox.width / 2,
      shakoBox.y + shakoBox.height / 2,
    )
    expect(target.hoveredUnit?.unitType).toBe('item')
    expect(target.hoveredUnit?.id).toBe(101)

    // 6. Disabling ground item enhancements restores 100% 1.13c vanilla (no beams or labels without Alt/hover)
    hudManager.setGroundItemEnhancements({
      showUniqueSetBeams: false,
      alwaysShowUniqueSetLabels: false,
    })
    renderSceneSourceFrame({
      hudManager,
      viewportProfile: hudManager.viewportProfile,
      cameraX: 0,
      cameraY: 0,
      nowMs: 1300,
      unitDrawables: [uniqueShako, setTalArmor, rareRing],
    } as any)
    expect(hudManager.groundItemBeams).toEqual([])
    expect(hudManager.groundItemLabelBoxes).toEqual([])
  })

  it('preserves authentic ground item flippy sprites for Set/Unique items (including Infernal Torch & Torch of Iro) and keeps beam base center transparent so ground icons are not occluded', async () => {
    const { resolveGroundItemFlippyKey } = await import('../../src/client/ui/inventory.ts')
    const { onlineItemDataToUiInventoryItem } = await import('../../src/common/items/item-bridge.ts')
    const { getEmbeddedDropTables } = await import('../../src/common/items/embedded-drop-tables.ts')
    const tables = getEmbeddedDropTables()

    // 1. Set Grim Wand "Infernal Torch" (code='gwn', setItemId=33) must resolve to wand flippy ('flpgwn_lyel'), NOT 'flptrch'
    const infernalTorchUi = onlineItemDataToUiInventoryItem(
      {
        id: 1,
        code: 'gwn',
        quality: 5,
        identified: true,
        setItemId: 33,
      } as any,
      undefined,
      tables,
    )
    expect(infernalTorchUi.name).toBe('Infernal Torch')
    expect(resolveGroundItemFlippyKey(infernalTorchUi)).toBe('flpgwn_lyel')

    // 2. Unique Wand "Torch of Iro" / "Iros Torch" (code='wnd', uniqueItemId=10) must resolve to 'flpwnd', NOT 'flptrch'
    const torchOfIroUi = onlineItemDataToUiInventoryItem(
      {
        id: 2,
        code: 'wnd',
        quality: 7,
        identified: true,
        uniqueItemId: 10,
      } as any,
      undefined,
      tables,
    )
    expect(resolveGroundItemFlippyKey(torchOfIroUi)).toBe('flpwnd')

    // 3. Genuine Hellfire Torch (code='cm2', uniqueItemId=399) still resolves to 'flptrch'
    const hellfireTorchUi = onlineItemDataToUiInventoryItem(
      {
        id: 3,
        code: 'cm2',
        quality: 7,
        identified: true,
        uniqueItemId: 399,
      } as any,
      undefined,
      tables,
    )
    expect(resolveGroundItemFlippyKey(hellfireTorchUi)).toBe('flptrch')

    // 4. Beam base radial gradient has alpha=0 at center (stop 0) and core filament starts 12px above item anchor
    const { canvas, ctx, gradients } = createMockHudCanvas()
    const hudManager = new HudManager(canvas)
    hudManager.setGroundItemEnhancements({
      showUniqueSetBeams: true,
      alwaysShowUniqueSetLabels: true,
    })
    hudManager.groundItemBeams = [
      { id: 1, screenX: 400, screenY: 300, quality: 'unique', isHovered: false },
    ]
    hudManager.renderGroundItemBeams(ctx, 1000)

    const radialGrad = gradients[0]!
    expect(radialGrad.stops[0]?.offset).toBe(0)
    expect(radialGrad.stops[0]?.color).toContain(', 0)')
  })
})

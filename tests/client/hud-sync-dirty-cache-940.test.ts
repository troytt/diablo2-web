import { describe, expect, it, vi } from 'vitest'
import { AutomapView } from '../../src/client/automap/automap-view.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { D2StatId } from '../../src/client/world/stat-list.ts'
import type { ClientCommand, ItemData, ServerEvent } from '../../src/netproto/index.ts'

function makeTestItem(overrides: Partial<ItemData> & { id: number; code: string }): ItemData {
  return {
    id: overrides.id,
    itemId: overrides.id,
    opcode: 0x9c,
    action: overrides.action ?? 0x04,
    category: overrides.category ?? 0,
    flags: overrides.flags ?? 0x10,
    rawFlags: overrides.rawFlags ?? 0x10,
    version: 101,
    location: overrides.location ?? 0,
    container: overrides.container ?? 'inventory',
    bodyLoc: overrides.bodyLoc ?? 0,
    equippedSlot: overrides.equippedSlot ?? 0,
    gridX: overrides.gridX ?? 0,
    gridY: overrides.gridY ?? 0,
    storePage: overrides.storePage ?? 0,
    storagePage: overrides.storagePage ?? 0,
    worldX: overrides.worldX ?? 0,
    worldY: overrides.worldY ?? 0,
    x: overrides.x ?? overrides.gridX ?? 0,
    y: overrides.y ?? overrides.gridY ?? 0,
    code: overrides.code,
    rawCode: `${overrides.code} `,
    compact: overrides.compact ?? false,
    simple: overrides.simple ?? false,
    identified: overrides.identified ?? true,
    socketed: overrides.socketed ?? false,
    ethereal: overrides.ethereal ?? false,
    runeword: overrides.runeword ?? false,
    personalized: overrides.personalized ?? false,
    isEar: overrides.isEar ?? false,
    newItem: overrides.newItem ?? false,
    starterItem: overrides.starterItem ?? false,
    broken: overrides.broken ?? false,
    inSocket: overrides.inSocket ?? false,
    equipped: overrides.equipped ?? false,
    socketedChildCount: overrides.socketedChildCount ?? 0,
    usedSockets: overrides.usedSockets ?? 0,
    totalSockets: overrides.totalSockets ?? 0,
    quality: overrides.quality ?? 2,
    invWidth: overrides.invWidth ?? 1,
    invHeight: overrides.invHeight ?? 1,
    curDurability: overrides.curDurability ?? 20,
    maxDurability: overrides.maxDurability ?? 20,
    stats: overrides.stats ?? [],
    setBonusStats: overrides.setBonusStats ?? [],
    runewordStats: overrides.runewordStats ?? [],
  } as ItemData
}

function createHudFixture() {
  const world = new ClientWorld()
  const hudManager = new HudManager()
  const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
  const automap = new AutomapView()
  const commands: ClientCommand[] = []
  const hudModel = new HudModel({
    world,
    hudManager,
    predictor,
    automap,
    onCommand: (cmd) => commands.push(cmd),
  })

  world.apply({
    type: 'UnitAssign',
    unit: {
      unitType: 0,
      id: 1,
      classId: 1,
      name: 'PerfHero',
      x: 5000,
      y: 5000,
    },
    isSelf: true,
  })
  world.apply({ type: 'StatSet', stat: D2StatId.Level, value: 24 })
  world.apply({ type: 'StatSet', stat: D2StatId.MaxHp, value: 200 << 8 })
  world.apply({ type: 'StatSet', stat: D2StatId.MaxMana, value: 150 << 8 })
  world.apply({ type: 'StatSet', stat: D2StatId.MaxStamina, value: 120 << 8 })
  world.apply({
    type: 'LifeMana',
    life: 200,
    mana: 150,
    stamina: 120,
    at: { x: 5000, y: 5000 },
  })

  return { world, hudManager, hudModel, commands }
}

describe('Issue #940 — HUD sync event grading, hudRevision, and O(1) container caching', () => {
  it('increments hudRevision only on HUD container mutations, not on ground item churn', () => {
    const { world } = createHudFixture()
    const containers = world.containers as typeof world.containers & {
      hudRevision: number
      revision: number
    }
    const baseRev = containers.revision
    const baseHudRev = containers.hudRevision

    world.apply({
      type: 'ItemEvent',
      item: makeTestItem({
        id: 501,
        code: 'hp1',
        action: 0x00,
        container: 'ground',
        location: 3,
        worldX: 5010,
        worldY: 5010,
      }) as Extract<ServerEvent, { type: 'ItemEvent' }>['item'],
    })
    expect(containers.revision).toBeGreaterThan(baseRev)
    expect(containers.hudRevision).toBe(baseHudRev)

    containers.removeGroundItemById(501)
    expect(containers.hudRevision).toBe(baseHudRev)

    world.apply({
      type: 'ItemEvent',
      item: makeTestItem({
        id: 502,
        code: 'cap',
        action: 0x04,
        container: 'inventory',
        storagePage: 0,
        gridX: 0,
        gridY: 0,
      }) as Extract<ServerEvent, { type: 'ItemEvent' }>['item'],
    })
    expect(containers.hudRevision).toBeGreaterThan(baseHudRev)
    const afterBagHudRev = containers.hudRevision

    ;(containers.stash as Map<number, ItemData>).set(
      503,
      makeTestItem({ id: 503, code: 'rin', container: 'stash', storagePage: 4, gridX: 1, gridY: 1 }),
    )
    expect(containers.hudRevision).toBeGreaterThan(afterBagHudRev)
  })

  it('reuses gridItems, stashItems, cubeItems, and UiInventoryItem references across clean syncFromWorld calls', () => {
    const { world, hudManager, hudModel } = createHudFixture()

    world.apply({
      type: 'ItemEvent',
      item: makeTestItem({
        id: 601,
        code: 'cap',
        action: 0x04,
        container: 'inventory',
        storagePage: 0,
        gridX: 0,
        gridY: 0,
        curDurability: 12,
        maxDurability: 12,
      }) as Extract<ServerEvent, { type: 'ItemEvent' }>['item'],
    })
    world.apply({
      type: 'ItemEvent',
      item: makeTestItem({
        id: 602,
        code: 'rin',
        action: 0x04,
        container: 'stash',
        storagePage: 4,
        gridX: 2,
        gridY: 2,
      }) as Extract<ServerEvent, { type: 'ItemEvent' }>['item'],
    })
    world.apply({
      type: 'ItemEvent',
      item: makeTestItem({
        id: 603,
        code: 'amu',
        action: 0x04,
        container: 'cube',
        storagePage: 3,
        gridX: 0,
        gridY: 0,
      }) as Extract<ServerEvent, { type: 'ItemEvent' }>['item'],
    })

    const gridItemsRef1 = hudManager.inventory.gridItems
    const stashItemsRef1 = hudManager.worldPanels.stashItems
    const cubeItemsRef1 = hudManager.worldPanels.cubeItems
    const capUiItem1 = gridItemsRef1[0]!.item

    hudModel.syncFromWorld()
    expect(hudManager.inventory.gridItems).toBe(gridItemsRef1)
    expect(hudManager.worldPanels.stashItems).toBe(stashItemsRef1)
    expect(hudManager.worldPanels.cubeItems).toBe(cubeItemsRef1)
    expect(hudManager.inventory.gridItems[0]!.item).toBe(capUiItem1)

    world.apply({
      type: 'ItemEvent',
      item: makeTestItem({
        id: 699,
        code: 'gld',
        action: 0x00,
        container: 'ground',
        location: 3,
        worldX: 5004,
        worldY: 5004,
      }) as Extract<ServerEvent, { type: 'ItemEvent' }>['item'],
    })
    expect(hudManager.inventory.gridItems).toBe(gridItemsRef1)
    expect(hudManager.worldPanels.stashItems).toBe(stashItemsRef1)
    expect(hudManager.worldPanels.cubeItems).toBe(cubeItemsRef1)

    world.apply({
      type: 'StatSet',
      unit: { unitType: 4, id: 601 },
      stat: 72,
      value: 7,
      param: 0,
    })
    expect(hudManager.inventory.gridItems).not.toBe(gridItemsRef1)
    expect(hudManager.inventory.gridItems[0]!.item.durability?.current).toBe(7)
    expect(hudManager.worldPanels.stashItems[0]!.item).toBe(stashItemsRef1[0]!.item)
  })

  it('grades LifeMana, vital StatSet, town NPC idle, and monster events onto fast paths without full syncFromWorld', () => {
    const { world, hudManager, hudModel } = createHudFixture()
    const fullSyncSpy = vi.spyOn(hudModel, 'syncFromWorld')
    const vitalsSpy = vi.spyOn(hudModel, 'syncVitalsFromWorld')
    const monsterTargetSpy = vi.spyOn(hudModel, 'syncTargetMonsterFromWorld')

    world.apply({
      type: 'LifeMana',
      life: 165,
      mana: 110,
      stamina: 95,
      at: { x: 0, y: 0 },
    })
    expect(vitalsSpy).toHaveBeenCalledTimes(1)
    expect(fullSyncSpy).not.toHaveBeenCalled()
    expect(hudManager.hp).toBe(165)
    expect(hudManager.mana).toBe(110)
    expect(hudManager.stamina).toBe(95)

    world.apply({
      type: 'StatSet',
      stat: D2StatId.HitPoints,
      value: 140 << 8,
    })
    expect(vitalsSpy).toHaveBeenCalledTimes(2)
    expect(fullSyncSpy).not.toHaveBeenCalled()
    expect(hudManager.hp).toBe(140)

    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 9001,
        classId: 147,
        x: 5020,
        y: 5020,
        lifePct: 128,
      },
    })
    world.apply({
      type: 'UnitMove',
      unitType: 1,
      id: 9001,
      to: { x: 5025, y: 5025 },
      from: { x: 5020, y: 5020 },
      mode: 'walk',
    } as unknown as ServerEvent)
    world.apply({
      type: 'Npc',
      kind: 'wantsInteract',
      npcId: 9001,
    } as unknown as ServerEvent)
    world.apply({
      type: 'PlaySound',
      unitType: 1,
      unitId: 9001,
      soundId: 42,
    } as unknown as ServerEvent)

    expect(fullSyncSpy).not.toHaveBeenCalled()
    expect(monsterTargetSpy).toHaveBeenCalledTimes(4)
  })
})

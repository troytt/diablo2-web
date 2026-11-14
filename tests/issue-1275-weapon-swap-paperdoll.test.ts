import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../src/client/session/online-session.ts'
import { computeEquipmentSkillBonus } from '../src/client/ui-model/hud-skill-bonuses.ts'
import { transactionCostContextFromWorld } from '../src/client/ui-model/transaction-cost-input.ts'
import { type ItemData } from '../src/client/world/inventory.ts'
import { resolveEquipmentSlotsToAppearanceInput } from '../src/common/units/char-appearance.ts'

function makeEquippedItem(
  id: number,
  code: string,
  bodyLoc: number,
  action = 0x06,
  stats: ItemData['stats'] = [],
): ItemData {
  return {
    id,
    itemId: id,
    code,
    name: code,
    action,
    location: 1,
    container: 'equipment',
    bodyLoc,
    equippedSlot: bodyLoc,
    equipped: true,
    identified: true,
    quality: 2,
    stats,
  } as unknown as ItemData
}

describe('[Issue #1275] Weapon switch (0x9D action=0x17 + weaponSet=1) avoids double-swapping slots 4/5 vs 11/12', () => {
  it('updates paperdoll appearance to the newly active weapon in slot 4/5 after 0x9D (0x17) + WeaponSwitch', () => {
    const session = new OnlineSession()
    session.world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Sorc', x: 100, y: 100 },
    })
    session.predictor.setPosition(100, 100)

    // Initial state (weaponSet = 0): Short Sword ('ssd') in slot 4, Short Bow ('sbw') in swap slot 11
    const swordIn4 = makeEquippedItem(101, 'ssd', 4, 0x06)
    const bowIn11 = makeEquippedItem(102, 'sbw', 11, 0x06)
    session.world.apply({ type: 'ItemEvent', action: 0x06, item: swordIn4, container: 'equipment' })
    session.world.apply({ type: 'ItemEvent', action: 0x06, item: bowIn11, container: 'equipment' })

    const beforeSwap = session.buildRenderableUnits().find(u => u.kind === 'player' && u.isLocalPlayer)
    expect(beforeSwap?.equipmentAppearance?.wclass).toBe('1hs')
    expect(beforeSwap?.equipmentAppearance?.layers.rh.variant).toBe('ssd')

    // Server processes C2S 0x60 SwapWeapons: sends 0x9D (0x17) moving sword -> 11 and bow -> 4, plus 0x97 WeaponSwitch
    const swordTo11 = makeEquippedItem(101, 'ssd', 11, 0x17)
    const bowTo4 = makeEquippedItem(102, 'sbw', 4, 0x17)
    session.world.apply({ type: 'ItemEvent', action: 0x17, item: swordTo11, container: 'equipment' })
    session.world.apply({ type: 'ItemEvent', action: 0x17, item: bowTo4, container: 'equipment' })
    session.world.apply({ type: 'WeaponSwitch' })

    expect(session.world.self.weaponSet).toBe(1)
    expect(session.world.containers.equipmentBySlot.get(4)?.code).toBe('sbw')
    expect(session.world.containers.equipmentBySlot.get(11)?.code).toBe('ssd')

    const afterSwap = session.buildRenderableUnits().find(u => u.kind === 'player' && u.isLocalPlayer)
    expect(afterSwap?.equipmentAppearance?.wclass).toBe('bow')
    expect(afterSwap?.equipmentAppearance?.layers.lh.variant).toBe('sbw')
    expect(afterSwap?.equipmentAppearance?.layers.rh.variant).toBeNull()
  })

  it('reads skill bonuses and reduced vendor prices from active slots 4/5 when weaponSet=1 after 0x9D swap', () => {
    const session = new OnlineSession()
    session.world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Sorc', x: 100, y: 100 },
    })

    // After 0x9D swap to weaponSet=1: slot 4 has Gheed/Edge bow (-15% vendor prices, +2 Fire Bolt),
    // while inactive slot 11 has old weapon (+1 Fire Bolt)
    const activeBowIn4 = makeEquippedItem(201, 'sbw', 4, 0x17, [
      { statId: 107, param: 36, value: 2 },
      { statId: 87, param: 0, value: 15 },
    ])
    const inactiveStaffIn11 = makeEquippedItem(202, 'sst', 11, 0x17, [
      { statId: 107, param: 36, value: 1 },
      { statId: 87, param: 0, value: 5 },
    ])
    session.world.apply({ type: 'ItemEvent', action: 0x17, item: activeBowIn4, container: 'equipment' })
    session.world.apply({ type: 'ItemEvent', action: 0x17, item: inactiveStaffIn11, container: 'equipment' })
    session.world.apply({ type: 'WeaponSwitch' })
    expect(session.world.self.weaponSet).toBe(1)

    expect(
      computeEquipmentSkillBonus(36, 'sor', session.world.containers, session.world.self.stats, 1),
    ).toBe(2)
    expect(transactionCostContextFromWorld(session.world, 154).playerReducedPricesPct).toBe(15)
  })

  it('falls back to slots 11/12 when weaponSet=1 and slots 4/5 are empty in static unit tests', () => {
    const staticSlots = new Map<number, ItemData>([
      [11, makeEquippedItem(301, 'ssd', 11, 0x06)],
    ])
    const resolved = resolveEquipmentSlotsToAppearanceInput(staticSlots, 1)
    expect((resolved.weapon1 as { code?: string })?.code).toBe('ssd')
  })
})

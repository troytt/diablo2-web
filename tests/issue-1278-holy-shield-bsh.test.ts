import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../src/client/session/online-session.ts'
import { type ItemData } from '../src/client/world/inventory.ts'
import { SELF_BUFF_SKILL_STATES } from '../src/client/world/world-skill-state-tables.ts'
import {
  resolveCharacterAppearance,
  resolveEquipmentSlotsToAppearanceInput,
} from '../src/common/units/char-appearance.ts'

function makeShieldItem(id = 501, code = 'buc'): ItemData {
  return {
    id,
    itemId: id,
    code,
    name: 'Buckler',
    action: 0x06,
    location: 1,
    container: 'equipment',
    bodyLoc: 5,
    equippedSlot: 5,
    equipped: true,
    identified: true,
    quality: 2,
    defense: 6,
    stats: [],
  } as unknown as ItemData
}

describe('[Issue #1278 / #1307] Paladin Holy Shield (#117 / State #101) StateSetFunc[11] sh=hsh override & cache invalidation', () => {
  it('overrides sh layer to hsh (transform=0, color=null) when hasHolyShield=true or state 101 is active', () => {
    const baseSpec = resolveCharacterAppearance('pa', { weapon1: 'ssd', weapon2: 'buc' })
    expect(baseSpec.layers.sh.variant).toBe('buc')

    const hsViaInput = resolveCharacterAppearance('pa', {
      weapon1: 'ssd',
      weapon2: 'buc',
      hasHolyShield: true,
    })
    expect(hsViaInput.layers.sh).toEqual({ variant: 'hsh', transform: 0, color: null })
    expect(hsViaInput.shieldTint).toBeNull()

    const hsViaStates = resolveCharacterAppearance('pa', { weapon1: 'ssd', weapon2: 'buc' }, undefined, [101])
    expect(hsViaStates.layers.sh).toEqual({ variant: 'hsh', transform: 0, color: null })
    expect(hsViaStates.shieldTint).toBeNull()
  })

  it('forwards hasHolyShield through resolveEquipmentSlotsToAppearanceInput', () => {
    const map = new Map<number, ItemData>([[5, makeShieldItem()]]) as Map<number, ItemData> & {
      hasHolyShield?: boolean
    }
    map.hasHolyShield = true
    const input = resolveEquipmentSlotsToAppearanceInput(map, 0)
    expect(input.hasHolyShield).toBe(true)
    const spec = resolveCharacterAppearance('pa', input)
    expect(spec.layers.sh).toEqual({ variant: 'hsh', transform: 0, color: null })
  })

  it('invalidates selfAppearanceCache when state 101 toggles and updates paperdoll sh layer to hsh', () => {
    const session = new OnlineSession()
    session.world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 3, name: 'Paladin', x: 100, y: 100 },
    })
    session.predictor.setPosition(100, 100)
    session.world.apply({
      type: 'ItemEvent',
      action: 0x06,
      item: makeShieldItem(),
      container: 'equipment',
    })

    const before = session.buildRenderableUnits().find(u => u.kind === 'player' && u.isLocalPlayer)
    expect(before?.equipmentAppearance?.layers.sh.variant).toBe('buc')
    expect(before?.appearanceKey).toContain('sh=buc:0:-')

    // Activate Holy Shield state 101 without mutating equipment containers
    session.world.apply({
      type: 'StateSet',
      unit: { unitType: 0, id: 1 },
      state: 101,
    })

    const during = session.buildRenderableUnits().find(u => u.kind === 'player' && u.isLocalPlayer)
    expect(during?.equipmentAppearance).not.toBe(before?.equipmentAppearance)
    expect(during?.equipmentAppearance?.layers.sh).toEqual({ variant: 'hsh', transform: 0, color: null })
    expect(during?.appearanceKey).toContain('sh=hsh:0:-')

    // Expire Holy Shield state 101 -> reverts back to equipped buckler
    session.world.apply({
      type: 'StateEnd',
      unit: { unitType: 0, id: 1 },
      state: 101,
    })

    const after = session.buildRenderableUnits().find(u => u.kind === 'player' && u.isLocalPlayer)
    expect(after?.equipmentAppearance?.layers.sh.variant).toBe('buc')
    expect(after?.appearanceKey).toContain('sh=buc:0:-')
  })

  it('sets state 101 when casting skill #117 (Holy Shield)', () => {
    expect(SELF_BUFF_SKILL_STATES[117]).toBe(101)
    const session = new OnlineSession()
    session.world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 3, name: 'Paladin', x: 100, y: 100 },
    })
    const caster = session.world.getUnit('player', 1)!
    ;(session.world as any).spawnMissilesForSkill(caster, 117, caster.x, caster.y, 5)
    expect(caster.states.has(101)).toBe(true)
    expect(session.world.self.states.has(101)).toBe(true)
  })
})

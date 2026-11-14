import { describe, expect, it } from 'vitest'

/**
 * Issue #289: an item's charged skill (`stat 204`) and the player's own learned skill of the same id are separate
 * 1.13c skill nodes (`dwOwnerGUID` = item GUID vs `-1`). F-key bindings carry `(skillId, owner)`, so a hotkey on the
 * learned skill casts the learned skill, and depleting the item's charges never breaks it.
 */
describe('issue #289: charged skill vs learned skill are separate hotkey entries', { timeout: 60_000 }, () => {
  const SPIRIT_OF_BARBS = 238
  const RING_ID = 4242

  async function setup(learnedLevel: number) {
    const { ClientWorld } = await import('../../src/client/world/client-world.ts')
    const { HudManager } = await import('../../src/client/ui/hud-manager.ts')
    const { HudModel } = await import('../../src/client/ui-model/hud-model.ts')

    const world = new ClientWorld()
    world.self.unitId = 1
    world.self.charClass = 5 // Druid
    world.self.level = 60
    world.self.weaponSet = 0
    if (learnedLevel > 0) {
      ;(world.self.skillEntries as Map<number, any>).set(SPIRIT_OF_BARBS, {
        skillId: SPIRIT_OF_BARBS,
        skill: SPIRIT_OF_BARBS,
        level: learnedLevel,
        baseLevel: learnedLevel,
        bonus: 0,
      })
      ;(world.self.skills as Map<number, number>).set(SPIRIT_OF_BARBS, learnedLevel)
    }
    const eqMap = world.containers.equipment as Map<number, any>
    const setRingCharges = (charges: number) => {
      eqMap.set(RING_ID, {
        id: RING_ID,
        code: 'rin',
        name: 'Ring of Barbs',
        quality: 4,
        identified: true,
        location: 1,
        bodyLoc: 6,
        equippedSlot: 6,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        stats: [{ statId: 204, param: (SPIRIT_OF_BARBS << 6) | 2, value: (11 << 8) | charges }],
      })
    }
    setRingCharges(11)

    const hudManager = new HudManager()
    const hudModel = new HudModel({ world, hudManager })
    const emitted: any[] = []
    ;(hudModel as any).emitCommand = (cmd: any) => {
      emitted.push(cmd)
    }
    const selected: { side: string; skillId: number; itemId: number | undefined }[] = []
    hudManager.hotkeys.onSelectSkill = (side, skillId, itemId) => {
      selected.push({ side, skillId, itemId })
    }
    hudModel.syncFromWorld()
    return { world, hudManager, hudModel, eqMap, setRingCharges, emitted, selected }
  }

  it('shows two entries: the learned skill (no charges, no itemId) and the ring copy (charges + itemId)', async () => {
    const { hudManager } = await setup(10)
    const entries = hudManager.hotkeys.availableSkills.filter(s => s.skillId === SPIRIT_OF_BARBS)
    expect(entries).toHaveLength(2)
    const native = entries.find(s => s.itemId === undefined)!
    const charged = entries.find(s => s.itemId === RING_ID)!
    expect(native.isItemSkill).not.toBe(true)
    expect(native.charges).toBeUndefined()
    expect(native.level).toBe(10)
    expect(charged.isItemSkill).toBe(true)
    expect(charged.charges).toBe(11)
    expect(charged.maxCharges).toBe(11)
    expect(charged.level).toBe(2)
    expect(hudManager.hotkeys.getSkillCharges(SPIRIT_OF_BARBS, 0xffffffff)).toBeUndefined()
    expect(hudManager.hotkeys.getSkillCharges(SPIRIT_OF_BARBS, RING_ID)).toBe(11)
  })

  it('F1 bound to the learned skill selects the learned skill (owner 0xFFFFFFFF), not the ring charges', async () => {
    const { hudManager, selected } = await setup(10)
    hudManager.hotkeys.bindHotkey('F1', 'right', SPIRIT_OF_BARBS)
    expect(hudManager.hotkeys.bindings.get('F1')?.itemId).toBeUndefined()
    hudManager.hotkeys.triggerFunctionKey('F1')
    expect(selected.at(-1)).toEqual({ side: 'right', skillId: SPIRIT_OF_BARBS, itemId: undefined })

    hudManager.hotkeys.bindHotkey('F2', 'right', SPIRIT_OF_BARBS, RING_ID)
    hudManager.hotkeys.triggerFunctionKey('F2')
    expect(selected.at(-1)).toEqual({ side: 'right', skillId: SPIRIT_OF_BARBS, itemId: RING_ID })
    // Both slots coexist: native and charged copies dedupe independently.
    expect(hudManager.hotkeys.bindings.get('F1')?.itemId).toBeUndefined()
  })

  it('depleted ring charges remove only the charged entry; the learned skill keeps working on its hotkey', async () => {
    const { hudManager, hudModel, setRingCharges, selected } = await setup(10)
    hudManager.hotkeys.bindHotkey('F1', 'right', SPIRIT_OF_BARBS)
    hudManager.hotkeys.bindHotkey('F2', 'right', SPIRIT_OF_BARBS, RING_ID)

    setRingCharges(0)
    hudModel.syncFromWorld()
    const entries = hudManager.hotkeys.availableSkills.filter(s => s.skillId === SPIRIT_OF_BARBS)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.itemId).toBeUndefined()
    expect(entries[0]!.isItemSkill).not.toBe(true)
    expect(entries[0]!.charges).toBeUndefined()

    hudManager.hotkeys.triggerFunctionKey('F1')
    expect(selected.at(-1)).toEqual({ side: 'right', skillId: SPIRIT_OF_BARBS, itemId: undefined })
    // The slot bound to the ring copy falls back to the learned skill instead of going dead.
    hudManager.hotkeys.triggerFunctionKey('F2')
    expect(selected.at(-1)).toEqual({ side: 'right', skillId: SPIRIT_OF_BARBS, itemId: undefined })
  })

  it('a hand holding the depleted ring copy is re-selected to the learned skill', async () => {
    const { world, hudModel, setRingCharges, emitted } = await setup(10)
    world.self.rightSkill = SPIRIT_OF_BARBS
    world.self.rightSkillItemId = RING_ID
    setRingCharges(0)
    hudModel.syncFromWorld()
    expect(world.self.rightSkill).toBe(SPIRIT_OF_BARBS)
    expect(world.self.rightSkillItemId).toBeUndefined()
    expect(emitted).toContainEqual({ type: 'SelectSkill', hand: 'right', skill: SPIRIT_OF_BARBS, itemId: 0xffffffff })
  })

  it('without the learned skill the ring copy is the only owner and is dropped when depleted', async () => {
    const { hudManager, hudModel, setRingCharges, selected } = await setup(0)
    hudManager.hotkeys.bindHotkey('F1', 'right', SPIRIT_OF_BARBS)
    expect(hudManager.hotkeys.bindings.get('F1')?.itemId).toBe(RING_ID)
    hudManager.hotkeys.triggerFunctionKey('F1')
    expect(selected.at(-1)).toEqual({ side: 'right', skillId: SPIRIT_OF_BARBS, itemId: RING_ID })

    setRingCharges(0)
    hudModel.syncFromWorld()
    expect(hudManager.hotkeys.availableSkills.some(s => s.skillId === SPIRIT_OF_BARBS)).toBe(false)
    const before = selected.length
    expect(hudManager.hotkeys.triggerFunctionKey('F1')).toBeNull()
    expect(selected.length).toBe(before)
  })
})

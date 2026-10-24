/**
 * Issue #941 — session adapter self-appearance cache.
 *
 * `buildRenderableUnits` used to run the full item-bridge equipment → appearance
 * resolution (`resolveEquipmentSlotsToAppearanceInput`, incl.
 * `onlineItemDataToUiInventoryItem` for helm/armor/both hands) on every rendered
 * frame just to recompute an unchanged `appearanceKey` — the same regression
 * shape as the pre-005ce07f player-light equipment walk. The result is now
 * cached against (4 slot item identities + weaponSet + container revision);
 * any inventory mutation bumps the revision and invalidates.
 */
import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { ClientInventoryManager, type ItemData } from '../../src/client/world/inventory.ts'

function makeSessionWithSelfPlayer(): OnlineSession {
  const session = new OnlineSession()
  session.world.apply({
    type: 'UnitAssign',
    isSelf: true,
    unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 100, y: 100 },
  })
  session.predictor.setPosition(100, 100)
  return session
}

function equipHelm(containers: ClientInventoryManager, code: string, id: number): void {
  containers.applyItemEvent(0x02, { id, code, location: 1, container: 'equipment' } as unknown as ItemData, 'equipment', 1)
}

describe('[#941 self appearance cache]', () => {
  it('1. reuses the same resolved appearance object across frames while equipment is unchanged', () => {
    const session = makeSessionWithSelfPlayer()
    equipHelm(session.world.containers as unknown as ClientInventoryManager, 'cap', 8001)
    const first = session.buildRenderableUnits()
    const self1 = first.find(u => u.kind === 'player' && u.isLocalPlayer)
    expect(self1).toBeDefined()
    const second = session.buildRenderableUnits()
    const self2 = second.find(u => u.kind === 'player' && u.isLocalPlayer)
    // A fresh resolution would build a new appearance object every call; the
    // cache returns the identical reference.
    expect(self2!.equipmentAppearance).toBe(self1!.equipmentAppearance)
    expect(self2!.appearanceKey).toBe(self1!.appearanceKey)
  })

  it('2. invalidates when the helm slot item is replaced (same slots, new object)', () => {
    const session = makeSessionWithSelfPlayer()
    const containers = session.world.containers as unknown as ClientInventoryManager
    equipHelm(containers, 'cap', 8001)
    const before = session.buildRenderableUnits().find(u => u.kind === 'player' && u.isLocalPlayer)
    equipHelm(containers, 'helm', 8002)
    const after = session.buildRenderableUnits().find(u => u.kind === 'player' && u.isLocalPlayer)
    expect(after!.equipmentAppearance).not.toBe(before!.equipmentAppearance)
  })

  it('3. bumps the container revision on every mutating entry point', () => {
    const containers = new ClientInventoryManager()
    const rev0 = containers.revision
    equipHelm(containers, 'cap', 9001)
    const rev1 = containers.revision
    expect(rev1).toBeGreaterThan(rev0)
    containers.removeItemById(9001)
    expect(containers.revision).toBeGreaterThan(rev1)
    containers.clear()
    expect(containers.revision).toBeGreaterThan(rev1 + 1)
    // untouched containers keep the revision stable
    const stable = containers.revision
    void containers.equipmentBySlot.size
    void containers.allById.size
    expect(containers.revision).toBe(stable)
  })
})

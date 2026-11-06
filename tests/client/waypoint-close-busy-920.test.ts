/**
 * Issue #920 — the cursor "sticks": ground items cannot be picked up and shrines cannot be used,
 * while walking still works; opening the inventory and picking an item up / putting it down cures it.
 *
 * Ground truth (D2Game, D2MOO `PlrMsg.cpp` / `ItemMode.cpp` / `ObjMode.cpp` / `Player.cpp`):
 * - C2S 0x16 pick-up (`D2GAME_PickupItem_6FC43340` / `D2GAME_PickupItemEx_6FC42B80`) returns
 *   silently while `PLAYER_IsBusy(player)`; C2S 0x13 on an object reaches `OBJECTS_OperateHandler`
 *   (`0x6FC789C0`), which does nothing while the player has interact info. Walking (0x01..0x04) is
 *   not gated by either. `PLAYER_IsBusy` = interact info set || cursor item || `bBusy`.
 * - Operating a waypoint (`OBJECTS_OperateFunction23_Waypoint`) sends S2C 0x63 and calls
 *   `SUNIT_SetInteractInfo(player, UNIT_OBJECT, waypoint)`; only C2S 0x49 resets it
 *   (`D2GAME_WAYPOINT_Unk_6FC79600` / `Rcv0x49` -> `SUNIT_ResetInteractInfo`).
 * - C2S 0x19 (pick an item up from the inventory) runs `sub_6FC7C3A0`, which resets the interact
 *   info when the interact unit no longer exists (the waypoint's room was released after the player
 *   walked away) — exactly the "pick an item up in the inventory" cure the reporter found.
 * - 1.13c D2Client closes the waypoint UI through `0x6fb5a380` on EVERY close path: when the
 *   "0x49 already sent" flag (`0x6fbacdd5`) is clear and the player has a room (#10331), it sends
 *   `0x49 { [0x6fbacdcd] waypoint GUID, level 0 }` — the stored GUID survives level changes.
 *
 * The port's HudModel closed the waypoint panel without 0x49 when `ClientWorld` dropped
 * `waypointOpen` on a level change (`ClientWorld.areaId` setter), leaving the server's waypoint
 * interaction open and the player permanently "busy".
 */
import { describe, expect, it } from 'vitest'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

function setup(): { world: ClientWorld; hudManager: HudManager; hudModel: HudModel; commands: ClientCommand[] } {
  const world = new ClientWorld()
  const hudManager = new HudManager()
  const commands: ClientCommand[] = []
  const hudModel = new HudModel({ world, hudManager, onCommand: (cmd) => commands.push(cmd) })
  world.apply({
    type: 'UnitAssign',
    unit: { unitType: 0, id: 1, classId: 1, name: 'Jaina', x: 5000, y: 5000 },
    isSelf: true,
  })
  // Cold Plains (3): the player stands at its waypoint.
  world.areaId = 3
  return { world, hudManager, hudModel, commands }
}

const waypointGos = (commands: readonly ClientCommand[]) =>
  commands.filter((c): c is Extract<ClientCommand, { type: 'WaypointGo' }> => c.type === 'WaypointGo')

describe('#920 waypoint UI close always tells the server (D2Client 0x6fb5a380)', () => {
  it('sends 0x49 {waypoint, 0} when the panel closes because the player walked into another level', () => {
    const { world, hudManager, hudModel, commands } = setup()
    world.apply({ type: 'WaypointMenu', unitId: 77, open: [1, 3] })
    expect(hudManager.leftPanel).toBe('waypoint')
    expect(waypointGos(commands)).toEqual([])

    // The player walks from Cold Plains into the Burial Grounds with the waypoint UI still open:
    // the session re-resolves the active level from the player position and re-syncs the HUD.
    world.areaId = 17
    hudModel.syncFromWorld()

    expect(hudManager.leftPanel).toBe('none')
    expect(waypointGos(commands)).toEqual([{ type: 'WaypointGo', waypointId: 77, destAreaId: 0 }])

    // Exactly once (0x6fbacdd5 "already sent" flag).
    hudModel.syncFromWorld()
    hudManager.closeAllPanels()
    expect(waypointGos(commands)).toHaveLength(1)
  })

  it('does not send a second 0x49 after a teleport was requested', () => {
    const { world, hudManager, hudModel, commands } = setup()
    world.apply({ type: 'WaypointMenu', unitId: 77, open: [1, 3] })
    hudModel.teleportToLevel(1)
    world.areaId = 1
    hudModel.syncFromWorld()
    expect(hudManager.leftPanel).toBe('none')
    expect(waypointGos(commands)).toEqual([{ type: 'WaypointGo', waypointId: 77, destAreaId: 1 }])
  })

  it('still sends exactly one 0x49 {waypoint, 0} when the panel is closed by hand', () => {
    const { world, hudManager, commands } = setup()
    world.apply({ type: 'WaypointMenu', unitId: 77, open: [1, 3] })
    hudManager.closeAllPanels()
    expect(waypointGos(commands)).toEqual([{ type: 'WaypointGo', waypointId: 77, destAreaId: 0 }])
  })
})

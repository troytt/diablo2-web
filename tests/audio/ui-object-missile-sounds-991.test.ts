/**
 * Regression tests for Issue #991 (1.13c audio parity):
 * 1. Picking an item up from a container / belt / paperdoll plays item_pickup (235) once (S2C cursor event,
 *    D2Client.dll 0x6fb328d9), never an extra optimistic copy from the HUD click.
 * 2. Store buy: the 0x32 request remembers the store item's dropsound ([0x6fbc9753], 0x6faf709c) and the S2C 0x2A
 *    result-0 reply plays it (0x6fafb694..0x6fafb6ae).
 * 3. Repair / Repair All play cursor_repair_item (15) (0x6faf6f36..0x6faf6f48); store buttons play their mousedown
 *    sound (0x6fb4c32c..0x6fb4c341, Sounds.txt 1).
 * 4. Object mode sounds (D2Client.dll 0x6fad37e0 + table 0x6fba6c58): every door class opens / closes with its sound.
 * 5. Andariel's death fire: missile-destroy is never dropped by the sound queue, missile-tick is coalesced, every
 *    removed missile with a started travel sound is stopped, and andyfirewallmaker spawns andyfirewall (#309).
 */

import { describe, expect, it, vi } from 'vitest'
import { AudioRuntime113c } from '../../src/client/audio/audio-runtime-113c.ts'
import { resolveItemDropSoundId113c } from '../../src/client/audio/item-drop-sound-113c.ts'
import { vendorBuyImpl, vendorRepairAllImpl, vendorRepairItemImpl } from '../../src/client/ui-model/hud-command-actions.ts'
import { forwardGridClick } from '../../src/client/ui/hud-input-router.ts'
import { VENDOR_BUTTON_PRESS_SOUND_ID } from '../../src/client/ui/panels/left-dock-renderer.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  objectModeOneShotSound113c,
  updateObjectModeSound113c,
  type ObjectSoundEmit113c,
  type ObjectSoundUnit113c,
} from '../../src/client/world/object-sound-113c.ts'
import { OBJECT_SOUNDS_113C } from '../../src/common/audio/object-sounds-113c.ts'
import { getSoundIdByName113c } from '../../src/common/audio/sounds-113c.ts'
import { getObjectsTxtRecord113c } from '../../src/common/world/objects-txt-113c.ts'

function objectUnit(classId: number, mode: number): ObjectSoundUnit113c & { mode: number } {
  return { classId, mode }
}

/** Runs the handler for each successive mode and returns the emitted sounds per step. */
function walkModes(classId: number, modes: readonly number[]): ObjectSoundEmit113c[][] {
  const record = getObjectsTxtRecord113c(classId)
  const unit = objectUnit(classId, modes[0]!)
  return modes.map(m => {
    unit.mode = m
    return updateObjectModeSound113c(unit, record)
  })
}

describe('Issue #991 — 1.13c UI / object / missile sound parity', () => {
  describe('1. item_pickup plays once', () => {
    it('a container grid pick-up only asks the server (the S2C cursor event plays 235)', () => {
      const played: number[] = []
      const pickupItemToCursor = vi.fn()
      const hud = {
        commandSink: { pickupItemToCursor },
        pendingIdentifyScrollId: null,
        inventory: { cursorItem: null },
        onPlayUiSound: (id: number) => played.push(id),
      }
      forwardGridClick(hud as never, 0, 1, 1, { id: '7', itemId: 7, code: 'hax' } as never, false)
      expect(pickupItemToCursor).toHaveBeenCalledOnce()
      expect(played).not.toContain(235)
    })

    it('ClientWorld plays 235 exactly once when the server moves the item to the cursor', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'ItemAction',
        action: 0x05,
        container: 'cursor',
        item: { id: 77, code: 'hax', location: 4 },
      } as never)
      const reqs = world.drainWorldSoundRequests().filter(r => r.soundId === 235)
      expect(reqs).toHaveLength(1)
    })
  })

  describe('2./3. store sounds', () => {
    function storeModel(overrides: Record<string, unknown> = {}) {
      const sounds: number[] = []
      const model: Record<string, any> = {
        uiSound: (id: number) => sounds.push(id),
        requireOpenStore: () => ({ npcId: 9, gamble: false, ctx: {} }),
        requireVendorPrice: () => () => 100,
        isThrottled: () => false,
        world: {
          containers: {
            shop: new Map([[5, { id: 5, code: 'hax' }]]),
            cursor: null,
          },
        },
        buyFromNpc: vi.fn(),
        repairItemAtNpc: vi.fn(),
        repairAllAtNpc: vi.fn(),
        requirePlayerItem: () => ({ id: 6, code: 'hax', curDurability: 3, maxDurability: 10 }),
        pendingVendorBuySoundId: 0,
        ...overrides,
      }
      return { model, sounds }
    }

    it('a buy remembers the store item dropsound for the 0x2A result-0 reply', () => {
      const { model, sounds } = storeModel()
      expect(vendorBuyImpl(model, 5, false)).toBe(true)
      const expected = resolveItemDropSoundId113c({ code: 'hax' })
      expect(expected).toBeGreaterThan(0)
      expect(model.pendingVendorBuySoundId).toBe(expected)
      expect(sounds).toEqual([]) // nothing until the server confirms
    })

    it('repair and repair all play cursor_repair_item (15) when the request is issued', () => {
      const a = storeModel()
      expect(vendorRepairItemImpl(a.model, 6)).toBe(true)
      expect(a.sounds).toEqual([15])
      expect(a.model.repairItemAtNpc).toHaveBeenCalledOnce()

      const b = storeModel()
      expect(vendorRepairAllImpl(b.model)).toBe(true)
      expect(b.sounds).toEqual([15])
      expect(b.model.repairAllAtNpc).toHaveBeenCalledWith(9)
    })

    it('a full-durability item is not repaired and plays nothing', () => {
      const { model, sounds } = storeModel({
        requirePlayerItem: () => ({ id: 6, code: 'hax', curDurability: 10, maxDurability: 10 }),
      })
      expect(vendorRepairItemImpl(model, 6)).toBe(false)
      expect(sounds).toEqual([])
    })

    it('store buttons use Sounds.txt 1 (cursor_pass) on mousedown', () => {
      expect(VENDOR_BUTTON_PRESS_SOUND_ID).toBe(1)
      expect(getSoundIdByName113c('cursor_pass')).toBe(1)
      expect(getSoundIdByName113c('cursor_repair_item')).toBe(15)
    })
  })

  describe('4. object / door mode sounds (0x6fad37e0, table 0x6fba6c58)', () => {
    it('extracts the full 573-entry table', () => {
      expect(OBJECT_SOUNDS_113C).toHaveLength(573)
      expect(OBJECT_SOUNDS_113C.filter(Boolean)).toHaveLength(453)
    })

    const DOORS: readonly [string, readonly number[], number, number][] = [
      // [label, classIds, open sound, close sound]
      ['metal doors', [13, 14, 290, 291, 292, 293], 2563, 2564],
      ['wood doors', [15, 16, 62, 63, 64, 75, 294, 295], 2568, 2569],
      ['gates', [23, 24, 25, 47], 2559, 2560],
    ]
    for (const [label, ids, open, close] of DOORS) {
      it(`${label}: open ${open}, close ${close}, nothing on first sight`, () => {
        for (const id of ids) {
          const [first, opened, closed] = walkModes(id, [0, 2, 0])
          expect(first, `#${id} first sight`).toEqual([])
          expect(opened!.map(s => s.soundId), `#${id} open`).toContain(open)
          expect(closed!.map(s => s.soundId), `#${id} close`).toContain(close)
        }
      })
    }

    it('doors with an opening / closing animation play the intermediate mode sound (DoorSetMode 0x6fad5040)', () => {
      // Tomb stone doors: M0 / M1 2567.
      for (const id of [91, 92, 98, 99]) {
        const [, opened, closed] = walkModes(id, [0, 2, 0])
        expect(opened!.map(s => s.soundId)).toContain(2567)
        expect(closed!.map(s => s.soundId)).toContain(2567)
      }
      // Maggot lair slime doors: M1 / M3 2566.
      for (const id of [229, 230]) {
        const [, opened, closed] = walkModes(id, [0, 2, 0])
        expect(opened!.map(s => s.soundId)).toContain(2566)
        expect(closed!.map(s => s.soundId)).toContain(2566)
      }
    })

    it('special doors / portals', () => {
      expect(objectModeOneShotSound113c(100, 1, 0)).toBe(2558) // Duriel's lair
      expect(objectModeOneShotSound113c(153, 1, 0)).toBe(2558)
      expect(objectModeOneShotSound113c(129, 1, 0)).toBe(2565) // secret door
      expect(objectModeOneShotSound113c(74, 2, 0)).toBe(2568) // trap door
      expect(objectModeOneShotSound113c(298, 1, 0)).toBe(2556) // arcane portal
      expect(objectModeOneShotSound113c(342, 1, 0)).toBe(2561) // hell gate
      expect(objectModeOneShotSound113c(449, 1, 0)).toBe(2662) // Harrogath gate
      expect(objectModeOneShotSound113c(508, 1, 0)).toBe(2652) // pen door
      expect(objectModeOneShotSound113c(547, 1, 0)).toBe(2650) // ancients door
      // Summit door: non-looping mode-bound sound 2654 in mode 1.
      expect(walkModes(564, [0, 1])[1]!.map(s => s.soundId)).toEqual([2654])
    })

    it('town portal (class 59) plays its open sound even on first sight', () => {
      expect(walkModes(59, [1])[0]!.map(s => s.soundId)).toEqual([2633])
    })

    it('wells skip the one-shot when the mode goes down (descriptor 0x6fba6988)', () => {
      expect(walkModes(130, [0, 1, 0]).map(step => step.map(s => s.soundId))).toEqual([[], [2644], []])
    })

    it('looping mode-bound sounds (torches, braziers, portals, cairn stones) emit unit-loop-start / unit-loop-stop (#998)', () => {
      // Torch (class 37, loopModeA = 8 every mode): starts 2578 once on first mode and does not restart on 0 -> 1 -> 2.
      expect(walkModes(37, [0, 1, 2])).toEqual([
        [{ kind: 'unit-loop-start', soundId: 2578 }],
        [],
        [],
      ])
      // Brazier (class 39, loopSound 2574 in modes 1 & 2, none in mode 0): starts on 0 -> 1, stays on 1 -> 2, stops on 2 -> 0.
      expect(walkModes(39, [0, 1, 2, 0])).toEqual([
        [],
        [{ kind: 'unit-loop-start', soundId: 2574 }],
        [],
        [{ kind: 'unit-loop-stop', soundId: 0 }],
      ])
      // Cairn stone (class 61): mode 1 starts loop 413; mode 6 stops loop and plays one-shot 418 (cairn_success).
      expect(walkModes(61, [0, 1, 6])).toEqual([
        [],
        [{ kind: 'unit-loop-start', soundId: 413 }],
        [{ kind: 'unit-loop-stop', soundId: 0 }, { soundId: 418 }],
      ])
      // Arcane portal (class 298): mode 1 plays one-shot 2556; mode 2 starts loop 2557; mode 0 stops loop.
      expect(walkModes(298, [0, 1, 2, 0])).toEqual([
        [],
        [{ soundId: 2556 }],
        [{ kind: 'unit-loop-start', soundId: 2557 }],
        [{ kind: 'unit-loop-stop', soundId: 0 }],
      ])
    })

    it('ClientWorld plays the door open / close sounds from S2C 0x0E', () => {
      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 28 })
      world.apply({ type: 'UnitAssign', unit: { unitType: 'object', id: 501, classId: 15, x: 100, y: 100, mode: 0 } })
      world.tick(40)
      expect(world.drainWorldSoundRequests().filter(r => r.soundId === 2568 || r.soundId === 2569)).toEqual([])

      world.apply({ type: 'UnitMode', unitType: 2, id: 501, mode: 2, eventCode: 3, eventFlag: 0 })
      world.tick(40)
      world.tick(40)
      const openReqs = world.drainWorldSoundRequests().filter(r => r.soundId === 2568)
      expect(openReqs).toHaveLength(1)
      expect(openReqs[0]!.unit).toMatchObject({ unitType: 'object', id: 501 })

      world.apply({ type: 'UnitMode', unitType: 2, id: 501, mode: 0, eventCode: 3, eventFlag: 0 })
      world.tick(40)
      world.tick(40)
      expect(world.drainWorldSoundRequests().filter(r => r.soundId === 2569)).toHaveLength(1)
    })
  })

  describe('5. missile travel sounds always stop', () => {
    it('missile-destroy survives a flood of missile-tick requests and ticks are coalesced per missile', () => {
      const world = new ClientWorld()
      world.pushSoundRequest({ kind: 'missile-spawn', missileId: 69, entityId: 1, soundId: 2577 })
      world.pushSoundRequest({ kind: 'missile-destroy', entityId: 1 })
      for (let round = 0; round < 3; round += 1) {
        for (let id = 100; id < 300; id += 1) world.pushSoundRequest({ kind: 'missile-tick', entityId: id, x: round, y: 0 })
      }
      const reqs = world.drainWorldSoundRequests()
      expect(reqs.filter(r => r.kind === 'missile-destroy' && r.entityId === 1)).toHaveLength(1)
      const ticks = reqs.filter(r => r.kind === 'missile-tick')
      expect(new Set(ticks.map(t => t.entityId)).size).toBe(ticks.length)
    })

    it('a missile removed without its own missile-destroy is stopped at the next drain', () => {
      const world = new ClientWorld()
      world.pushSoundRequest({ kind: 'missile-spawn', missileId: 311, entityId: 4242, soundId: 450 })
      // No missile unit 4242 exists (removed by a collision / cleanup path).
      const reqs = world.drainWorldSoundRequests()
      expect(reqs.map(r => r.kind)).toEqual(['missile-spawn', 'missile-destroy'])
      expect(world.drainWorldSoundRequests()).toEqual([])
    })

    it('andyfirewallmaker drops andyfirewall (#309), never the Sorceress firewall / firemedium', () => {
      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 37 })
      const w = world as unknown as {
        spawnMissileByKey: (k: string, x: number, y: number, tx: number, ty: number, o?: object) => { missileKey?: string }
        _units: Map<string, { unitType: string; missileKey?: string }>
      }
      w.spawnMissileByKey('andyfirewallmaker', 100, 100, 112, 100, { maxTicks: 20 })
      for (let i = 0; i < 12; i += 1) world.tick(40)
      const keys = [...w._units.values()].filter(u => u.unitType === 'missile').map(u => u.missileKey)
      expect(keys).toContain('andyfirewall')
      expect(keys).not.toContain('firewall')
      expect(keys).not.toContain('firemedium')
    })

    it('#999: mephistofirewallmaker (#300) drops mephistofirewall (#301, Range 25), never firewall / firemedium', () => {
      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 37 })
      const w = world as unknown as {
        spawnMissileByKey: (k: string, x: number, y: number, tx: number, ty: number, o?: object) => { missileKey?: string }
        _units: Map<string, { unitType: string; missileKey?: string; maxTicks?: number }>
      }
      w.spawnMissileByKey('mephistofirewallmaker', 100, 100, 112, 100, { maxTicks: 24 })
      for (let i = 0; i < 12; i += 1) world.tick(40)
      const missiles = [...w._units.values()].filter(u => u.unitType === 'missile')
      const keys = missiles.map(u => u.missileKey)
      expect(keys).toContain('mephistofirewall')
      expect(keys).not.toContain('firewall')
      expect(keys).not.toContain('firemedium')
      for (const m of missiles.filter(u => u.missileKey === 'mephistofirewall')) expect(m.maxTicks).toBe(25)
    })
  })

  describe('6. #998 unit-bound object loop sound lifecycle (0x6fad37e0 / 0x6fad25d0 / 0x6fad3070 / 0x6fb38c20)', () => {
    it('Compound=-1 torch loop (2578) is shared across multiple torches and only stops when the last torch detaches', () => {
      const runtime = new AudioRuntime113c({
        listenerPos: () => ({ x: 100, y: 100 }),
      })
      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 1 })
      world.apply({ type: 'RoomReveal', areaId: 1, tileX: 20, tileY: 20 })
      world.apply({ type: 'UnitAssign', unit: { unitType: 'object', id: 701, classId: 37, x: 102, y: 100, mode: 1 } })
      world.apply({ type: 'UnitAssign', unit: { unitType: 'object', id: 702, classId: 37, x: 104, y: 100, mode: 1 } })
      world.tick(40)

      const startReqs = world.drainWorldSoundRequests()
      expect(startReqs.filter(r => r.kind === 'unit-loop-start' && r.soundId === 2578)).toHaveLength(2)
      const handles = runtime.drainWorldRequests(startReqs)
      expect(handles).toHaveLength(2)
      // Compound=-1 reuses the same sound record handle for both torches (0x6fb38ac8).
      expect(handles[0]).toBe(handles[1])
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 701 }, 2578)).toBe(true)
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 702 }, 2578)).toBe(true)
      expect(runtime.records.record(handles[0]!)?.units).toHaveLength(2)

      // Removing torch 701 via S2C 0x0A UnitRemove detaches 701, but 702 keeps the Compound record alive (0x6fb38cb6).
      world.apply({ type: 'UnitRemove', unitType: 'object', id: 701 })
      const stopFirstReqs = world.drainWorldSoundRequests()
      expect(stopFirstReqs).toEqual([
        { kind: 'unit-loop-stop', unit: { unitType: 'object', id: 701 } },
      ])
      runtime.drainWorldRequests(stopFirstReqs)
      runtime.records.update()
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 701 }, 2578)).toBe(false)
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 702 }, 2578)).toBe(true)
      expect(runtime.records.record(handles[0]!)?.stop).toBe(false)

      // Hiding the room removes torch 702 and stops the record once no units remain attached.
      world.apply({ type: 'RoomHide', areaId: 1, tileX: 20, tileY: 20 })
      const stopSecondReqs = world.drainWorldSoundRequests()
      expect(stopSecondReqs).toEqual([
        { kind: 'unit-loop-stop', unit: { unitType: 'object', id: 702 } },
      ])
      runtime.drainWorldRequests(stopSecondReqs)
      runtime.records.update()
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 702 }, 2578)).toBe(false)
      expect(runtime.records.record(handles[0]!)).toBeUndefined()
    })

    it('stops object loop sounds on mode change (0x6fad3070), S2C 0x51 replacement, LoadAct area transition, and reset()', () => {
      const runtime = new AudioRuntime113c({
        listenerPos: () => ({ x: 100, y: 100 }),
      })
      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 4 })
      // Brazier (class 39) in mode 1 (loop 2574)
      world.apply({ type: 'UnitAssign', unit: { unitType: 'object', id: 801, classId: 39, x: 100, y: 100, mode: 1 } })
      world.tick(40)
      runtime.drainWorldRequests(world.drainWorldSoundRequests())
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 801 }, 2574)).toBe(true)

      // Mode change 1 -> 0 stops the loop (0x6fad3070)
      world.apply({ type: 'UnitMode', unitType: 2, id: 801, mode: 0 })
      world.tick(40)
      const modeStopReqs = world.drainWorldSoundRequests()
      expect(modeStopReqs.some(r => r.kind === 'unit-loop-stop' && r.unit?.id === 801)).toBe(true)
      runtime.drainWorldRequests(modeStopReqs)
      runtime.records.update()
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 801 }, 2574)).toBe(false)

      // Mode 0 -> 1 restarts, then S2C 0x51 replacing 801 in mode 0 stops the prior loop
      world.apply({ type: 'UnitMode', unitType: 2, id: 801, mode: 1 })
      world.tick(40)
      runtime.drainWorldRequests(world.drainWorldSoundRequests())
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 801 }, 2574)).toBe(true)

      world.apply({ type: 'UnitAssign', unit: { unitType: 'object', id: 801, classId: 39, x: 100, y: 100, mode: 0 } })
      world.tick(40)
      runtime.drainWorldRequests(world.drainWorldSoundRequests())
      runtime.records.update()
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 801 }, 2574)).toBe(false)

      // LoadAct area transition prunes non-self units and emits unit-loop-stop
      world.apply({ type: 'UnitAssign', unit: { unitType: 'object', id: 802, classId: 37, x: 100, y: 100, mode: 1 } })
      world.tick(40)
      runtime.drainWorldRequests(world.drainWorldSoundRequests())
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 802 }, 2578)).toBe(true)

      world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 5 })
      runtime.drainWorldRequests(world.drainWorldSoundRequests())
      runtime.records.update()
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 802 }, 2578)).toBe(false)

      // reset() stops any remaining object loops and unit-loop-stop survives queue overflow
      world.apply({ type: 'UnitAssign', unit: { unitType: 'object', id: 803, classId: 37, x: 100, y: 100, mode: 1 } })
      world.tick(40)
      runtime.drainWorldRequests(world.drainWorldSoundRequests())
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 803 }, 2578)).toBe(true)

      world.reset()
      for (let i = 0; i < 100; i += 1) {
        world.pushSoundRequest({ soundId: 4, x: 0, y: 0 })
      }
      const resetReqs = world.drainWorldSoundRequests()
      expect(resetReqs.some(r => r.kind === 'unit-loop-stop' && r.unit?.id === 803)).toBe(true)
      runtime.drainWorldRequests(resetReqs)
      runtime.records.update()
      expect(runtime.records.isUnitSoundPlaying({ unitType: 'object', id: 803 }, 2578)).toBe(false)
    })
  })
})

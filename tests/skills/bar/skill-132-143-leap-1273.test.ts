import { describe, expect, it } from 'vitest'
import { decode0xA5StateSkillEffect } from '../../../src/netproto/d2gs/s2c/misc.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import { LocalMovementPredictor } from '../../../src/client/motion/predictor.ts'
import { tickSessionFrame } from '../../../src/client/session/session-render-builder.ts'

describe('Issue #1273: Barbarian Leap (#132) & Leap Attack (#143) S2C 0xA5 StateSkillEffect & displacement sync', () => {
  it('1. decode0xA5StateSkillEffect decodes bytes 6..7 as skillId into StateSkillEffect (not StateSet)', () => {
    // 0xA5, unitType=0 (player), id=1, skillId=132 (Leap)
    const pkt = new Uint8Array([0xa5, 0x00, 0x01, 0x00, 0x00, 0x00, 132 & 0xff, (132 >>> 8) & 0xff])
    const ev = decode0xA5StateSkillEffect(pkt)
    expect(ev).toEqual({
      type: 'StateSkillEffect',
      unit: { unitType: 0, id: 1 },
      skillId: 132,
    })
  })

  it('2. ClientWorld StateSkillEffect (0xA5) ends Leap/Leap Attack castState, removes state 18, and attaches landing dust without adding state 132 (shrine_resist_cold)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 4, name: 'Barb', x: 5000, y: 5000 },
    })
    const barb = world.getUnit('player', 1)!
    barb.states.add(18)
    ;(world.self.states as Set<number>).add(18)
    ;(world as any).applySkillCastToUnit(barb, 132, 5012, 5000, 1, false, 1000)
    expect(barb.castState?.skillId).toBe(132)

    const pkt132 = new Uint8Array([0xa5, 0x00, 0x01, 0x00, 0x00, 0x00, 132, 0])
    world.apply(decode0xA5StateSkillEffect(pkt132))

    expect(barb.castState).toBeUndefined()
    expect(barb.states.has(18)).toBe(false)
    expect(world.self.states.has(18)).toBe(false)
    // Must NEVER add state 132 (shrine_resist_cold)
    expect(barb.states.has(132)).toBe(false)
    expect(world.self.states.has(132)).toBe(false)
    expect(barb.overlays.some((o) => o.token === 'dust')).toBe(true)
  })

  it('3. tickSessionFrame preserves Leap (#132) & Leap Attack (#143) displacement and syncs predictor & camera', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 4, name: 'Barb', x: 5000, y: 5000 },
    })
    const barb = world.getUnit('player', 1)!
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
    let camX = 5000
    let camY = 5000
    const host: any = {
      tickCounter: 0,
      commandMapper: {
        tick: () => {},
        assists: { tick: () => {} },
        checkPendingMeleeChaseArrival: () => false,
      },
      world,
      predictor,
      camera: {
        update: (x: number, y: number) => {
          camX = x
          camY = y
        },
      },
      isSubTileInTown: () => false,
      interpolator: {
        getEntityState: () => undefined,
        update: () => {},
        getAllStates: () => [],
      },
      drainWorldSoundRequests: () => {},
      syncActiveAreaFromPlayerPosition: () => null,
      clientActLoaded: false,
      automapView: {
        getLevelView: () => null,
      },
      enforceActiveInteractionRange113c: () => {},
    }

    ;(world as any).applySkillCastToUnit(barb, 143, 5012, 5000, 1, true, 1000)
    tickSessionFrame(host, 40, 1040)

    expect(barb.x).toBeGreaterThan(5000)
    expect(world.self.x).toBe(barb.x)
    expect(predictor.getSnapshot().x).toBe(barb.x)
    expect(camX).toBe(barb.x)
    expect(camY).toBe(barb.y)
  })

  it('4. [Issue #1307] LifeMana packet during active Leap (#132) flight updates vitals without snapping position backward', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 4, name: 'Barb', x: 5000, y: 5000 },
    })
    const barb = world.getUnit('player', 1)!
    ;(world as any).applySkillCastToUnit(barb, 132, 5012, 5000, 1, true, 1000)
    expect(barb.states.has(18)).toBe(true)

    // Leap 2 ticks forward
    world.tick(40, 1040)
    world.tick(40, 1080)
    const midLeapX = barb.x
    expect(midLeapX).toBeGreaterThan(5000)

    // Server sends lagging LifeMana packet with coordinates (5000, 5000)
    world.apply({
      type: 'LifeMana',
      life: 600,
      mana: 150,
      stamina: 250,
      at: { x: 5000, y: 5000 },
    })

    // Vitals update, but position does not revert to 5000
    expect(world.self.life).toBe(600)
    expect(world.self.mana).toBe(150)
    expect(barb.x).toBe(midLeapX)
    expect(world.self.x).toBe(midLeapX)
  })
})

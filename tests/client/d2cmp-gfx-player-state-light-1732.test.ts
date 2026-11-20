import { describe, expect, it } from 'vitest'
import { ClientWorldSceneSource } from '../../src/client/view/scene-source.ts'
import { resolveStateLightColor113c } from '../../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { STAT_LIGHTCOLOR } from '../../src/common/units/char-anim-speed.ts'

describe('issue #1732 (D2CMP-GFX-2): local player light colour from States.txt light-r/g/b', () => {
  it('resolves States.txt light-r/g/b for the highest-priority active colorshift state (0x6FB22130)', () => {
    expect(resolveStateLightColor113c(() => false)).toBeUndefined()
    // state 2 (poison, colorpri=95): light-r/g/b = 128, 255, 128 (0x80ff80)
    expect(resolveStateLightColor113c((id) => id === 2)).toBe(0x80ff80)
    // state 11 (cold, colorpri=100): light-r/g/b = 150, 215, 255 (0x96d7ff)
    expect(resolveStateLightColor113c((id) => id === 11)).toBe(0x96d7ff)
    // cold (100) beats poison (95)
    expect(resolveStateLightColor113c((id) => id === 2 || id === 11)).toBe(0x96d7ff)
    // state 91 (red, colorpri=70) & state 96 (revive, colorpri=85): light-r/g/b = 255, 255, 255 (0xffffff)
    expect(resolveStateLightColor113c((id) => id === 91)).toBe(0xffffff)
    expect(resolveStateLightColor113c((id) => id === 96)).toBe(0xffffff)
  })

  it('recolours the local player light on state changes in ClientWorld without affecting remote players (0x6FB221E3)', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 0,
      name: 'Hero',
      x: 100,
      y: 100,
    })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'player', id: 2, classId: 1, x: 104, y: 100 },
      classId: 1,
      x: 104,
      y: 100,
      name: 'Ally',
    })

    expect(world.resolvePlayerLightColor(1)).toBe(0)

    const selfUnit = world.getUnit('player', 1)!
    const remoteUnit = world.getUnit('player', 2)!

    // Poison state (2) on local player immediately sets light to 0x80ff80 (invalidating cache)
    selfUnit.states.add(2)
    expect(world.resolvePlayerLightColor(1)).toBe(0x80ff80)

    // Cold state (11, colorpri=100) overrides poison (colorpri=95) -> 0x96d7ff
    selfUnit.states.add(11)
    expect(world.resolvePlayerLightColor(1)).toBe(0x96d7ff)

    // Removing cold falls back to poison -> 0x80ff80
    selfUnit.states.remove(11)
    expect(world.resolvePlayerLightColor(1)).toBe(0x80ff80)

    // Removing poison resets to STAT_LIGHTCOLOR (or 0 = white 255,255,255 per 0x6FB22225)
    selfUnit.stats.set(STAT_LIGHTCOLOR, 0xffaa44)
    selfUnit.states.remove(2)
    expect(world.resolvePlayerLightColor(1)).toBe(0xffaa44)

    // Remote player does not receive D2Client_GetPlayerUnit()-scoped state light colour (0x6FB221E3)
    remoteUnit.states.add(2)
    expect(world.resolvePlayerLightColor(2)).toBe(0)
  })

  it('ClientWorldSceneSource.buildLightingInputs applies local player state light colour', () => {
    let activeStates: number[] = [2]
    const dummyLevelView = {
      act: 0,
      areaId: 1,
      seed: 1,
      subOriginX: 0,
      subOriginY: 0,
      subWidth: 100,
      subHeight: 100,
      cellsX: 20,
      cellsY: 20,
      isoOriginX: 0,
      isoOriginY: 0,
      gridWidth: 100,
      blocked: new Uint8Array(100 * 100),
      collisionMasks: new Uint16Array(100 * 100),
      rooms: [{ x: 0, y: 0, width: 20, height: 20 }],
      floors: [],
      shadows: [],
      walls: [],
      roofs: [],
    } as any
    const source = new ClientWorldSceneSource(() => ({
      playerSubX: 50,
      playerSubY: 50,
      playerUnitId: 1,
      ambient: null,
      units: [
        {
          id: 1,
          kind: 'player',
          classId: 0,
          name: 'Hero',
          x: 50,
          y: 50,
          isLocalPlayer: true,
          states: activeStates,
        },
      ],
      levelView: dummyLevelView,
      tileAtlas: null,
    }))

    expect(source.buildLightingInputs('auto').playerLightColor).toBe(0x80ff80)

    activeStates = [1, 2]
    expect(source.buildLightingInputs('auto').playerLightColor).toBe(0x96d7ff)

    activeStates = []
    expect(source.buildLightingInputs('auto').playerLightColor).toBe(0)
  })
})

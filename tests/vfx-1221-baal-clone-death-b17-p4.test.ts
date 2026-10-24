/**
 * Issue #1221 (B17-19, B17-p4): Baal Clone (MonStats 570) death VFX 1.13c parity.
 *
 * Ground truth:
 * - D2Client.dll 0x6fafe588 -> 0x6fafe717 (hcIdx / nBaseId 0x23a = 570 `baalclone`):
 *   - Calls `0x6fb5ff10(unit, 0x266, x, y, 0, 1)` where `0x266` = 614 `baalclonedeath`.
 *   - Sets `or [ebp+0xc8], 0x40000` (`corpseSuppressed = true`), `or [ebp+0xc4], 0x20`, and
 *     `mov edi, 0xc; call 0x6fada6c0` (`unit.mode = 12` `MONMODE_DEAD`).
 * - 1.13c `Missiles.txt` row #614 `baalclonedeath`:
 *   - `Id = 614`, `pCltDoFunc = 1`, `pSrvDoFunc = 1`, `Range = 20`, `Vel = 0`, `MaxVel = 0`
 *   - `CelFile = Expansion\Baalteleport`, `AnimLen = 20`, `AnimSpeed = 24`, `LoopAnim = 0`, `NumDirections = 1`
 *   - `Light = 3`, `Red = 128`, `Green = 64`, `Blue = 64`, `Trans = 1`, `TravelSound = baal_teleport`
 * - No invented `'baal clone death'` clientAlias exists in `CANONICAL_113C_MISSILES` or `MISSILE_METAS`.
 */

import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { CANONICAL_113C_MISSILES, getMissileTxtData } from '../src/common/skills/missiles-data.ts'
import { getBossDeathFxSpec, isBaalCloneMonster } from '../src/common/units/monster-death-fx.ts'

describe('Issue #1221 (B17-19): Baal Clone (MonStats 570) Death VFX 1.13c Ground Truth', () => {
  it('removes fake alias "baal clone death" and matches 1.13c Missiles.txt #614 baalclonedeath', () => {
    const legacyAlias = ['baal', 'clone', 'death'].join(' ')
    expect(CANONICAL_113C_MISSILES[legacyAlias]).toBeUndefined()
    expect(MISSILE_METAS[legacyAlias]).toBeUndefined()

    const row = getMissileTxtData('baalclonedeath')
    expect(row).toMatchObject({
      name: 'baalclonedeath',
      id: 614,
      pCltDoFunc: 1,
      pSrvDoFunc: 1,
      vel: 0,
      maxVel: 0,
      range: 20,
      levRange: 0,
      celFile: 'Expansion\\Baalteleport',
      animLen: 20,
      animSpeed: 24,
      loopAnim: 0,
      numDirections: 1,
      light: 3,
      red: 128,
      green: 64,
      blue: 64,
      trans: 1,
    })
    expect((row as unknown as Record<string, unknown>)['clientAlias']).toBeUndefined()

    const meta = MISSILE_METAS['baalclonedeath']
    expect(meta).toBeDefined()
    expect(meta).toMatchObject({
      name: 'baalclonedeath',
      celFile: 'Expansion/Baalteleport',
      directions: 1,
      framesPerDirection: 20,
      animSpeed: 24,
      trans: 1,
      blendMode: 'lighter',
    })
  })

  it('spawns real baalclonedeath (#614, Range=20) on baalclone (classId 570) death, sets mode 12 & suppresses corpse (D2Client 0x6fafe717)', () => {
    expect(isBaalCloneMonster(570, 'baalclone')).toBe(true)
    expect(isBaalCloneMonster(544, 'baalcrab')).toBe(false)
    // baalclone (570) is not in D2Client 0x6fad0fb0 questcomplete switch
    expect(getBossDeathFxSpec(570, 'baalclone')).toBeNull()

    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 57001,
        classId: 570,
        name: 'baalclone',
        x: 150,
        y: 160,
        mode: 1,
        lifePct: 100,
      },
    } as never)
    world.applyEvent({
      type: 'UnitMode',
      unitType: 'monster',
      id: 57001,
      mode: 0,
      lifePct: 0,
    } as never)

    const cloneUnit = world.getUnit('monster', 57001)!
    expect(cloneUnit.dead).toBe(true)
    expect(cloneUnit.mode).toBe(12)
    expect(cloneUnit.corpseSuppressed).toBe(true)

    const missiles = world.getUnitsByType('missile')
    expect(missiles).toHaveLength(1)
    const deathMissile = missiles[0]!
    expect(deathMissile.missileKey).toBe('baalclonedeath')
    expect(deathMissile.classId).toBe(614)
    expect(deathMissile.x).toBe(150)
    expect(deathMissile.y).toBe(160)
    expect(deathMissile.vx).toBe(0)
    expect(deathMissile.vy).toBe(0)
    expect(deathMissile.maxTicks).toBe(20)
    expect(deathMissile.loopAnim).toBe(false)

    // Scene drawables: dead baalclone corpse is suppressed; baalclonedeath missile is rendered with light=3 RGB(128,64,64)
    const scene = buildSceneDrawables([cloneUnit, ...missiles])
    expect(scene.unitDrawables.some(u => u.id === 57001)).toBe(false)
    expect(scene.missileDrawables).toHaveLength(1)
    expect(scene.missileDrawables[0]).toMatchObject({
      missileClassId: 614,
      missileKey: 'baalclonedeath',
      celFile: 'Expansion\\Baalteleport',
      totalFrames: 20,
      loopAnim: false,
      blendMode: 'additive',
      lightRadius: 3,
      lightColor: [128, 64, 64],
    })

    // Step 19 ticks: still alive; 20th tick: expires at Range = 20
    for (let t = 0; t < 19; t++) {
      world.tick()
    }
    expect(world.getUnitsByType('missile')).toHaveLength(1)
    world.tick()
    expect(world.getUnitsByType('missile')).toHaveLength(0)
  })
})

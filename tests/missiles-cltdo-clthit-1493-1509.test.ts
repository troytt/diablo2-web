import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { QuestFxLight } from '../src/client/world/quest-fx-light.ts'
import {
  ANYA_CENTER_MISSILE,
  ANYA_ICEMAGIC_MISSILE,
  ANYA_STEAM1_MISSILE,
  BAALFX_CONTROL_MISSILE,
  BAALFX_HEAD1_MISSILE,
  BAALFX_HEAD2_MISSILE,
  BAALFX_HEAD3_MISSILE,
  BAALFX_HEAD_APPEAR_MISSILE,
  BAALFX_SPIRIT1_MISSILE,
  BAALFX_TIMELINE_113C,
  FROZEN_ANYA_OBJECT_CLASS,
  TAINTED_SUN_ALTAR_LIGHT,
  TAINTED_SUN_ALTAR_OBJECT_CLASS,
  TAINTED_SUN_ALTAR_OVERLAY,
  TAINTED_SUN_BALL_MISSILE,
  TAINTED_SUN_CONTROL_MISSILE,
  TAINTED_SUN_FLASH_MISSILE,
  TAINTED_SUN_TIMELINE_113C,
  anyaCenterTick,
  baalFxControlTick,
  taintedSunControlTick,
} from '../src/client/world/quest-fx-tainted-anya-baal-113c.ts'
import { SEED_InitLowSeed, type D2SeedStrc } from '../src/common/rng/d2-rng.ts'

function makeSeed(lo: number): D2SeedStrc {
  const s: D2SeedStrc = { lo: 1, hi: 666 }
  SEED_InitLowSeed(s, lo)
  return s
}

describe('1.13c Missile CltDo/CltHit Parity (#1493, #1494, #1501, #1507, #1508, #1509)', () => {
  it('#1493: Event 6 (0x6fb02c50) + CltDo33 (0x6fb64760) + CltHit38 (0x6fb645d0) + CltDo34 (0x6fb61fc0) Tainted Sun show', () => {
    expect(TAINTED_SUN_TIMELINE_113C).toHaveLength(5)
    const fx = new QuestFxLight()
    let triggered = false
    fx.onSpecialQuestEvent(6, {
      findStoneAlpha: () => null,
      spawnTaintedSunShowIfAltarNear: () => {
        triggered = true
      },
    })
    expect(triggered).toBe(true)

    const world = new ClientWorld()
    world.selfId = 1
    world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 100, y: 100, mode: 1, lifePct: 100 },
      isSelf: true,
    })
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 50,
        classId: TAINTED_SUN_ALTAR_OBJECT_CLASS,
        x: 104,
        y: 104,
        mode: 0,
        lifePct: 100,
      },
    })
    const altar = world.getUnit('object', 50)!
    const ctl = world.spawnTaintedSunShowAtAltar(altar)
    expect(ctl.classId).toBe(TAINTED_SUN_CONTROL_MISSILE)
    expect(ctl.cltCountdown).toBe(50)
    expect(ctl.cltCountdownY).toBe(1)

    // Step 15 frames so the first flash (spawned at rem=300, Range=12) expires via CltHit38 and spawns taintedsunball (#352)
    for (let i = 0; i < 15; i++) {
      world.tick(40)
    }
    const unitsMid = world.listUnits()
    const flashes = unitsMid.filter((u) => u.missileKey === 'taintedsunflash' || u.classId === TAINTED_SUN_FLASH_MISSILE)
    const balls = unitsMid.filter((u) => u.missileKey === 'taintedsunball' || u.classId === TAINTED_SUN_BALL_MISSILE)
    expect(flashes.length + balls.length).toBeGreaterThan(0)
    expect(balls.length).toBeGreaterThan(0)

    // Step to the end of taintedsuncontrol (Range=300) so rem <= 1 attaches overlay 182 and white light (radius=60) to altar
    const seed = makeSeed(12345)
    const finishTick = taintedSunControlTick(1, 104, 104, seed)
    expect(finishTick.finishAltar).toBe(true)
    expect(finishTick.nextPhase).toBe(3)

    for (let i = 0; i < 290; i++) {
      world.tick(40)
    }
    expect(altar.objectLight).toEqual({
      targetR8: 18 * 8,
      currentR8: 18 * 8,
      red: TAINTED_SUN_ALTAR_LIGHT.r,
      green: TAINTED_SUN_ALTAR_LIGHT.g,
      blue: TAINTED_SUN_ALTAR_LIGHT.b,
    })
    expect(altar.overlays?.some((o) => o.token === 'horadric_light')).toBe(true)
  })

  it('#1494: Event 16 (0x6fb02b70) + CltDo54 (0x6fb69c10) Anya rescue show', () => {
    const fx = new QuestFxLight()
    let triggered = false
    fx.onSpecialQuestEvent(16, {
      findStoneAlpha: () => null,
      spawnAnyaRescueShowIfAnyaNear: () => {
        triggered = true
      },
    })
    expect(triggered).toBe(true)

    const seed = makeSeed(99)
    const tick0 = anyaCenterTick(0, 200, 200, seed)
    expect(tick0.spawnCenterIceMagic).toBe(true)
    expect(tick0.steamPuffs).toHaveLength(8)
    const tick5 = anyaCenterTick(5, 200, 200, seed)
    expect(tick5.shake).toBe(true)

    const world = new ClientWorld()
    world.selfId = 1
    world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 200, y: 200, mode: 1, lifePct: 100 },
      isSelf: true,
    })
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 77,
        classId: FROZEN_ANYA_OBJECT_CLASS,
        x: 202,
        y: 202,
        mode: 0,
        lifePct: 100,
      },
    })
    const anya = world.getUnit('object', 77)!
    const ctl = world.spawnAnyaRescueShowAtAnya(anya)
    expect(ctl.classId).toBe(ANYA_CENTER_MISSILE)
    expect(ctl.cltCountdown).toBe(77)
    expect(ctl.cltCountdownY).toBe(25)

    for (let i = 0; i < 8; i++) {
      world.tick(40)
    }
    const units = world.listUnits()
    expect(units.some((u) => u.classId === ANYA_ICEMAGIC_MISSILE || u.missileKey === 'anya icemagic')).toBe(true)
    expect(units.some((u) => u.classId === ANYA_STEAM1_MISSILE || u.missileKey === 'anyasteam1')).toBe(true)
  })

  it('#1501: CltDo64 (0x6fb69ff0) baalfx control timeline + CltDo65 (0x6fb61d10) baalfx spirit 1..5', () => {
    expect(BAALFX_TIMELINE_113C).toHaveLength(5)
    const seed = makeSeed(777)
    expect(baalFxControlTick(450, 100, 100, seed).headAppearMissile?.missileId).toBe(BAALFX_HEAD_APPEAR_MISSILE)
    expect(baalFxControlTick(425, 100, 100, seed).headAppearMissile?.missileId).toBe(BAALFX_HEAD1_MISSILE)
    expect(baalFxControlTick(375, 100, 100, seed).headAppearMissile?.missileId).toBe(BAALFX_HEAD2_MISSILE)
    expect(baalFxControlTick(325, 100, 100, seed).headAppearMissile?.missileId).toBe(BAALFX_HEAD3_MISSILE)
    expect(baalFxControlTick(200, 100, 100, seed).nextPhaseY).toBe(2)

    const world = new ClientWorld()
    const ctl = world.spawnMissileByKey('baalfx control', 100, 100, 100, 100, {
      classId: BAALFX_CONTROL_MISSILE,
      ownerType: 'player',
      ownerId: 1,
    })
    expect(ctl.maxTicks).toBe(650)
    // Advance 235 frames (rem goes from 650 down to 415, crossing rem=450, rem=425, and spirit cadence at rem<=420)
    for (let i = 0; i < 235; i++) {
      world.tick(40)
    }
    const units = world.listUnits()
    expect(units.some((u) => u.classId === BAALFX_SPIRIT1_MISSILE || u.missileKey === 'baalfx spirit 1')).toBe(true)
    expect(units.some((u) => u.classId === BAALFX_HEAD_APPEAR_MISSILE || u.missileKey === 'baalfx baal head appear')).toBe(true)
    expect(units.some((u) => u.classId === BAALFX_HEAD1_MISSILE || u.missileKey === 'baalfx baal head 1')).toBe(true)
  })

  it('#1507: CltDo46 (0x6fb67880) perpendicular sub-tile trails + CltHit51 (0x6fb6a9a0) radial burst on lightingtrailingjavalin / advlighttrailingjav', () => {
    const world = new ClientWorld()
    const jav = world.spawnMissileByKey('advlighttrailingjav', 100, 100, 120, 100, {
      classId: 438,
      ownerType: 'player',
      ownerId: 1,
      maxTicks: 4,
    })
    jav.alwaysExplode = true
    for (let i = 0; i < 4; i++) {
      world.tick(40)
    }
    const units = world.listUnits()
    const trails = units.filter((u) => u.missileKey === 'advlighttrailingjav2')
    const explodes = units.filter((u) => u.missileKey === 'advlightjavexplode')
    expect(trails.length).toBeGreaterThanOrEqual(2)
    expect(explodes.length).toBe(18)
    expect(explodes.some((e) => (e.pathWaypoints?.length ?? 0) > 0)).toBe(true)
  })

  it('#1508: CltDo43 (0x6fb62890), CltDo44 (0x6fb62790 distraction), CltDo45 (0x6fb6b500 distraction fog), CltHit53 (0x6fb65a10 moltenboulderemerge)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'player', id: 1, classId: 6, name: 'Sin', x: 50, y: 50, mode: 1, lifePct: 100 },
      isSelf: true,
    })
    const player = world.getUnit('player', 1)!
    world.spawnMissileByKey('distraction', 50, 50, 55, 50, {
      classId: 393,
      ownerType: 'player',
      ownerId: 1,
    })
    player.x = 52
    player.y = 50
    world.tick(40)
    const afterStep = world.listUnits()
    expect(afterStep.some((u) => u.missileKey === 'distraction fog')).toBe(true)

    // Test moltenboulderemerge (#453, pCltHitFunc=53) chaining into moltenboulder on range expiry
    const emerge = world.spawnMissileByKey('moltenboulderemerge', 60, 60, 70, 60, {
      classId: 453,
      ownerType: 'player',
      ownerId: 1,
      maxTicks: 2,
    })
    expect(emerge.missileKey).toBe('moltenboulderemerge')
    world.tick(40)
    world.tick(40)
    expect(world.listUnits().some((u) => u.missileKey === 'moltenboulder')).toBe(true)
  })

  it('#1509: CltHit40 (0x6fb60570) healingbolt only collides with the owner player mercenary', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'player', id: 1, classId: 3, name: 'Pal', x: 100, y: 100, mode: 1, lifePct: 100 },
      isSelf: true,
    })
    // Hostile monster in path at (102, 100)
    world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 200, classId: 1, x: 102, y: 100, mode: 1, lifePct: 100 },
    })
    // Owner's mercenary at (108, 100)
    world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 300, classId: 338, x: 108, y: 100, mode: 1, lifePct: 100 },
    })
    const merc = world.getUnit('monster', 300)!
    merc.ownerType = 'player'
    merc.ownerId = 1

    const bolt = world.spawnMissileByKey('healingbolt', 100, 100, 112, 100, {
      classId: 357,
      ownerType: 'player',
      ownerId: 1,
    })
    // Step past hostile monster at (102, 100) — healingbolt must NOT collide with hostile monster
    world.tick(40)
    world.tick(40)
    world.tick(40)
    expect(world.getUnit('missile', bolt.id)).toBeDefined()

    // Step until reaching owner's mercenary at (108, 100) — healingbolt MUST collide and terminate
    for (let i = 0; i < 15; i++) {
      world.tick(40)
    }
    expect(world.getUnit('missile', bolt.id)).toBeUndefined()
  })
})

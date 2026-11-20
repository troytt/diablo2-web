/**
 * Regression tests for Issue #1457:
 * 1.13c `D2Game.dll` `gpMissileSrvHitFnTable` (`0x6FD2DA48`) explosion / splash / bounce search radius:
 * - Reads `Missiles.txt` `sHitPar1` (`+0x4C`, or `sHitPar2` `+0x50` for `SrvHit09` / `SrvHit20` bolt cap).
 * - When `<= 0`, falls back to `max(1, evalSkillCalc(skill[calcField]))` in sub-tiles (`1 sub-tile = 20 flat px`):
 *   - `SrvHit01` (`0x6FC5B990`, `fireball` #62 `sHitPar1 = 4`): `sHitPar1` or `Skills.txt` `calc1` (`+0x138`)
 *   - `SrvHit03` (`0x6FC5BB60`, `explosivepotion` #45 `sHitPar1 = 3`) & `SrvHit44` (`0x6FC5B5F0`, `explodingjavalin` #429 `sHitPar1 = 2`): `sHitPar1` or `auraRangeCalc` (`+0x64`)
 *   - `SrvHit04` (`0x6FC5F220`, `explodingarrow` #41 / `freezingarrow` #87) & `SrvHit09` (`0x6FC5E0B0`, `immolationarrow` #85): `sHitPar1`/`sHitPar2` or `calc1`/`calc2` (4 sub-tiles = 80 px)
 *   - `SrvHit12` (`0x6FC5D020`, `chainlightning` #93 `sHitPar1 = 0`, `chainlightning2` #267 `sHitPar1 = 10`): `sHitPar1` or `auraRangeCalc` (`par1 = 20` sub-tiles = 400 px)
 *   - `SrvHit13` (`0x6FC5B3E0`, `glacialspike` #96 `sHitPar1 = 0`): `sHitPar1` or `auraRangeCalc` (`ln12 = 4` sub-tiles = 80 px)
 *   - `SrvHit14` (`0x6FC5DEF0`, `meteorcenter` #101 `sHitPar1 = 0`): `sHitPar1` or `auraRangeCalc` (`ln12 = 6` sub-tiles = 120 px)
 *   - `SrvHit20` (`0x6FC5DD60`, `lightningfury` #206 `sHitPar1 = 0, sHitPar2 = 0`): `sHitPar1` or `auraRangeCalc` (`par3 = 15` sub-tiles = 300 px), max bolts `sHitPar2` or `calc1` (`ln12 = 1 + slvl`)
 *   - `SrvHit22` (`0x6FC5DB30`, `fistoftheheavensdelay` #233 `sHitPar1 = 0`): `sHitPar1` or `auraRangeCalc` (`20` sub-tiles = 400 px)
 *   - `SrvHit47` (`0x6FC5D8C0`, `moltenboulder` #452 `sHitPar1 = 0`): `sHitPar1` or `auraRangeCalc` (`par1 = 7` sub-tiles = 140 px)
 * - All radial distance checks (`sub_6FCC0C70` @ `0x6FCC0C70`, `sub_6FCC0F40` @ `0x6FCC0F40`) operate in
 *   2:1 isometric-corrected ground space: `Math.hypot(dx, dy / ISO_GROUND_ASPECT_RATIO)`.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/common/data/data-registry.ts'
import type { CombatUnitContext, SUnitDmgPacket } from '../src/server/engine/combat-pipeline.ts'
import {
  ISO_GROUND_ASPECT_RATIO,
  MISSILE_SUBTILE_FLAT_PX,
  MissileEngine,
} from '../src/server/engine/missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'

const registry = getSharedDataRegistry()

function makeUnit(
  id: string,
  unitType: CombatUnitContext['unitType'] = 'monster',
  opts?: { hp?: number; isBoss?: boolean },
): CombatUnitContext {
  const statList = new UnitStatList(registry)
  const hp = opts?.hp ?? 1000
  statList.setBaseStat('level', 20)
  statList.setBaseStat('maxhp', hp * FIXED_ONE)
  statList.setHp256(hp * FIXED_ONE)
  const stateBus = new StateBus(statList, registry)
  return {
    id,
    name: id,
    unitType,
    statList,
    stateBus,
    ...(opts?.isBoss ? { isBoss: true, rank: 'boss' as const } : {}),
  }
}

function makeSpellDmgPacket(skillId: number, elemType: SUnitDmgPacket['elemType'] = 'fire', dmg = 50): SUnitDmgPacket {
  return {
    skillId,
    slvl: 5,
    attackKind: 'spell',
    srcDam: 0,
    elemType,
    elemMin256: dmg * FIXED_ONE,
    elemMax256: dmg * FIXED_ONE,
    autoHit: true,
  }
}

describe('Issue #1457: 1.13c SrvHit explosion/splash/bounce radius (sHitPar1 / skill calc) & isometric ground distance', () => {
  it('1. fireball (pSrvHitFunc=1, sHitPar1=4 -> 80px) hits splash targets at (4 subtiles, 0) and (0, 4 subtiles iso) and misses at 5 subtiles', () => {
    const fbRec = registry.getMissileByName('fireball')!
    expect(fbRec.pSrvHitFunc).toBe(1)
    expect(fbRec.sHitPar1).toBe(4)

    const engine = new MissileEngine(registry)
    const caster = makeUnit('sorc', 'player')
    const primary = makeUnit('primary')
    const splashEast4 = makeUnit('splash_east_4') // +4 subtiles X: dx = 80, dy = 0
    const splashSouth4 = makeUnit('splash_south_4') // +4 subtiles iso-Y: dx = 0, dy = 4 * 20 * 0.5 = 40
    const missEast5 = makeUnit('miss_east_5') // +5 subtiles X: dx = 100, dy = 0
    const missSouth5 = makeUnit('miss_south_5') // +5 subtiles iso-Y: dx = 0, dy = 5 * 20 * 0.5 = 50

    const m = engine.spawnMissile({
      missileNameOrId: 'fireball',
      sourceSkillId: 47,
      slvl: 5,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: makeSpellDmgPacket(47, 'fire', 50),
    })!

    expect(engine.resolveSrvHitRadiusSubtiles(m, 'calc1', { fallbackSubtiles: 4 })).toBe(4)
    expect(engine.resolveSrvHitRadiusPx(m, 'calc1', { fallbackSubtiles: 4 })).toBe(4 * MISSILE_SUBTILE_FLAT_PX)

    const impactX = 15
    const impactY = 0
    const targets = [primary, splashEast4, splashSouth4, missEast5, missSouth5]
    const positions = new Map([
      [primary.id, { x: impactX, y: impactY }],
      [splashEast4.id, { x: impactX + 4 * MISSILE_SUBTILE_FLAT_PX, y: impactY }],
      [splashSouth4.id, { x: impactX, y: impactY + 4 * MISSILE_SUBTILE_FLAT_PX * ISO_GROUND_ASPECT_RATIO }],
      [missEast5.id, { x: impactX + 5 * MISSILE_SUBTILE_FLAT_PX, y: impactY }],
      [missSouth5.id, { x: impactX, y: impactY + 5 * MISSILE_SUBTILE_FLAT_PX * ISO_GROUND_ASPECT_RATIO }],
    ])

    const out = engine.tick(1, targets, positions)
    const hitIds = new Set(out.hits.map((h) => h.targetId))
    expect(hitIds.has(primary.id)).toBe(true)
    expect(hitIds.has(splashEast4.id)).toBe(true)
    expect(hitIds.has(splashSouth4.id)).toBe(true)
    expect(hitIds.has(missEast5.id)).toBe(false)
    expect(hitIds.has(missSouth5.id)).toBe(false)
  })

  it('2. glacialspike (pSrvHitFunc=13, sHitPar1=0, aurarangecalc=ln12 -> 4 subtiles = 80px) reads aurarangecalc and scales with skill calc', () => {
    const gsRec = registry.getMissileByName('glacialspike')!
    const gsSkill = registry.getSkillById(55)!
    expect(gsRec.pSrvHitFunc).toBe(13)
    expect(gsRec.sHitPar1).toBe(0)
    expect(gsSkill.auraRangeCalc).toBe('ln12')
    expect(gsSkill.param1).toBe(4)
    expect(gsSkill.param2).toBe(0)

    const engine = new MissileEngine(registry)
    const caster = makeUnit('sorc', 'player')
    const primary = makeUnit('primary')
    const at75Px = makeUnit('at_75px') // 3.75 subtiles (> old hardcoded 64px, <= 80px)
    const atIso4 = makeUnit('at_iso_4') // 4 subtiles along iso-Y (dy = 40 -> flat 80px)
    const at5Subtiles = makeUnit('at_5_subtiles') // 5 subtiles (dx = 100 > 80px)

    engine.spawnMissile({
      missileNameOrId: 'glacialspike',
      sourceSkillId: 55,
      slvl: 5,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: makeSpellDmgPacket(55, 'cold', 40),
    })

    const impactX = 12
    const impactY = 0
    const positions = new Map([
      [primary.id, { x: impactX, y: impactY }],
      [at75Px.id, { x: impactX + 75, y: impactY }],
      [atIso4.id, { x: impactX, y: impactY + 40 }],
      [at5Subtiles.id, { x: impactX + 100, y: impactY }],
    ])

    const out = engine.tick(1, [primary, at75Px, atIso4, at5Subtiles], positions)
    const hitIds = new Set(out.hits.map((h) => h.targetId))
    expect(hitIds.has(primary.id)).toBe(true)
    expect(hitIds.has(at75Px.id)).toBe(true)
    expect(hitIds.has(atIso4.id)).toBe(true)
    expect(hitIds.has(at5Subtiles.id)).toBe(false)
    expect(at75Px.stateBus.hasState('freeze')).toBe(true)
    expect(atIso4.stateBus.hasState('freeze')).toBe(true)

    // Verify dynamic scaling when Skills.txt Param2 (ln12 = Param1 + (slvl - 1) * Param2) is modified
    const origParam2 = gsSkill.param2
    try {
      ;(gsSkill as { param2: number }).param2 = 1 // at slvl 5 -> 4 + 4*1 = 8 subtiles (160px)
      const primary2 = makeUnit('primary2')
      const at7Subtiles = makeUnit('at_7_subtiles') // dx = 140 <= 160px
      engine.spawnMissile({
        missileNameOrId: 'glacialspike',
        sourceSkillId: 55,
        slvl: 5,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
        dmgPacket: makeSpellDmgPacket(55, 'cold', 40),
      })
      const outScaled = engine.tick(
        2,
        [primary2, at7Subtiles],
        new Map([
          [primary2.id, { x: impactX, y: impactY }],
          [at7Subtiles.id, { x: impactX + 140, y: impactY }],
        ]),
      )
      expect(outScaled.hits.some((h) => h.targetId === at7Subtiles.id)).toBe(true)
    } finally {
      ;(gsSkill as { param2: number }).param2 = origParam2
    }
  })

  it('3. modifying Missiles.txt sHitPar1 dynamically changes splash/search radius across SrvHit 1, 3, 4/9, 12, 13, 14, 20, 22, 47', () => {
    const engine = new MissileEngine(registry)
    const caster = makeUnit('caster', 'player')

    // (a) SrvHit01 (fireball): override sHitPar1 from 4 -> 2 (40px)
    const fbRec = registry.getMissileByName('fireball')!
    const origFbHitPar1 = fbRec.sHitPar1
    try {
      ;(fbRec as { sHitPar1: number }).sHitPar1 = 2
      const p = makeUnit('fb_p')
      const near = makeUnit('fb_near') // 35px (<= 40px)
      const mid = makeUnit('fb_mid') // 60px (> 40px, would have hit at default 80px)
      engine.spawnMissile({
        missileNameOrId: 'fireball',
        sourceSkillId: 47,
        slvl: 1,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
        dmgPacket: makeSpellDmgPacket(47, 'fire', 30),
      })
      const out = engine.tick(
        1,
        [p, near, mid],
        new Map([
          [p.id, { x: 10, y: 0 }],
          [near.id, { x: 45, y: 0 }],
          [mid.id, { x: 70, y: 0 }],
        ]),
      )
      expect(out.hits.some((h) => h.targetId === near.id)).toBe(true)
      expect(out.hits.some((h) => h.targetId === mid.id)).toBe(false)
    } finally {
      ;(fbRec as { sHitPar1: number }).sHitPar1 = origFbHitPar1
    }

    // (b) SrvHit03 (explosivepotion, sHitPar1=3 -> 60px; override to 6 -> 120px)
    const epRec = registry.getMissileByName('explosivepotion')!
    expect(epRec.pSrvHitFunc).toBe(3)
    expect(epRec.sHitPar1).toBe(3)
    const origEpHitPar1 = epRec.sHitPar1
    try {
      const tAt100 = makeUnit('ep_100')
      const mDefault = engine.spawnMissile({
        missileNameOrId: 'explosivepotion',
        sourceSkillId: 0,
        slvl: 1,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        maxRangeTicks: 1,
        dmgPacket: makeSpellDmgPacket(0, 'fire', 25),
      })!
      expect(engine.resolveSrvHitRadiusPx(mDefault, 'auraRangeCalc', { fallbackSubtiles: 3 })).toBe(60)
      const outDefault = engine.tick(2, [tAt100], new Map([[tAt100.id, { x: 100, y: 0 }]]))
      expect(outDefault.hits.some((h) => h.targetId === tAt100.id)).toBe(false)

      ;(epRec as { sHitPar1: number }).sHitPar1 = 6 // 120px
      engine.spawnMissile({
        missileNameOrId: 'explosivepotion',
        sourceSkillId: 0,
        slvl: 1,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        maxRangeTicks: 1,
        dmgPacket: makeSpellDmgPacket(0, 'fire', 25),
      })
      const outExpanded = engine.tick(3, [tAt100], new Map([[tAt100.id, { x: 100, y: 0 }]]))
      expect(outExpanded.hits.some((h) => h.targetId === tAt100.id)).toBe(true)
    } finally {
      ;(epRec as { sHitPar1: number }).sHitPar1 = origEpHitPar1
    }

    // (c) SrvHit04 / SrvHit09 (explodingarrow / immolationarrow): override sHitPar1 from 0 -> 7 (140px)
    const eaRec = registry.getMissileByName('explodingarrow')!
    const origEaHitPar1 = eaRec.sHitPar1
    try {
      ;(eaRec as { sHitPar1: number }).sHitPar1 = 7 // 140px
      const tAt120 = makeUnit('ea_120')
      engine.spawnMissile({
        missileNameOrId: 'explodingarrow',
        sourceSkillId: 16,
        slvl: 5,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        maxRangeTicks: 1,
        dmgPacket: makeSpellDmgPacket(16, 'fire', 40),
      })
      const outEa = engine.tick(4, [tAt120], new Map([[tAt120.id, { x: 0, y: 60 }]])) // dy=60 -> iso flat 120px <= 140px
      expect(outEa.hits.some((h) => h.targetId === tAt120.id)).toBe(true)
    } finally {
      ;(eaRec as { sHitPar1: number }).sHitPar1 = origEaHitPar1
    }

    // (d) SrvHit12 (chainlightning #93 sHitPar1=0 -> 20 subtiles = 400px; chainlightning2 #267 sHitPar1=10 -> 200px)
    const cl2Rec = registry.getMissileByName('chainlightning2')!
    expect(cl2Rec.pSrvHitFunc).toBe(12)
    expect(cl2Rec.sHitPar1).toBe(10)
    const mCl2 = engine.spawnMissile({
      missileNameOrId: 'chainlightning2',
      sourceSkillId: 53,
      slvl: 5,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: makeSpellDmgPacket(53, 'ltng', 40),
    })!
    expect(engine.resolveSrvHitRadiusPx(mCl2, 'auraRangeCalc', { fallbackSubtiles: 20 })).toBe(200)
    const clPrimary = makeUnit('cl2_p')
    const clOutOf10Subtiles = makeUnit('cl2_300') // 300px > 200px (10 subtiles)
    const outCl2 = engine.tick(
      5,
      [clPrimary, clOutOf10Subtiles],
      new Map([
        [clPrimary.id, { x: 10, y: 0 }],
        [clOutOf10Subtiles.id, { x: 310, y: 0 }],
      ]),
    )
    expect(outCl2.subMissilesSpawned).not.toContain('chainlightning2')

    // (e) SrvHit14 (meteorcenter #101: default 6 subtiles = 120px; override sHitPar1 = 2 -> 40px)
    const mcRec = registry.getMissileByName('meteorcenter')!
    const origMcHitPar1 = mcRec.sHitPar1
    try {
      ;(mcRec as { sHitPar1: number }).sHitPar1 = 2 // 40px
      const mNear = makeUnit('mc_near') // 30px <= 40px
      const mFar = makeUnit('mc_far') // 100px > 40px (would have hit at default 120px)
      engine.spawnMissile({
        missileNameOrId: 'meteorcenter',
        sourceSkillId: 56,
        slvl: 5,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        maxRangeTicks: 1,
        dmgPacket: makeSpellDmgPacket(56, 'fire', 80),
      })
      const outMc = engine.tick(
        6,
        [mNear, mFar],
        new Map([
          [mNear.id, { x: 30, y: 0 }],
          [mFar.id, { x: 100, y: 0 }],
        ]),
      )
      expect(outMc.hits.some((h) => h.targetId === mNear.id && h.missileName === 'meteorexplode')).toBe(true)
      expect(outMc.hits.some((h) => h.targetId === mFar.id && h.missileName === 'meteorexplode')).toBe(false)
    } finally {
      ;(mcRec as { sHitPar1: number }).sHitPar1 = origMcHitPar1
    }

    // (f) SrvHit20 (lightningfury #206) & SrvHit22 (fistoftheheavensdelay #233) & SrvHit47 (moltenboulder #452)
    const lfRec = registry.getMissileByName('lightningfury')!
    const fohRec = registry.getMissileByName('fistoftheheavensdelay')!
    const mbRec = registry.getMissileByName('moltenboulder')!
    expect(mbRec.pSrvHitFunc).toBe(47)
    const origLf = lfRec.sHitPar1
    const origFoh = fohRec.sHitPar1
    const origMb = mbRec.sHitPar1
    try {
      ;(lfRec as { sHitPar1: number }).sHitPar1 = 3 // 60px
      ;(fohRec as { sHitPar1: number }).sHitPar1 = 4 // 80px
      ;(mbRec as { sHitPar1: number }).sHitPar1 = 2 // 40px

      const mLf = engine.spawnMissile({
        missileNameOrId: 'lightningfury',
        sourceSkillId: 35,
        slvl: 5,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        maxRangeTicks: 1,
      })!
      const mFoh = engine.spawnMissile({
        missileNameOrId: 'fistoftheheavensdelay',
        sourceSkillId: 121,
        slvl: 5,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        maxRangeTicks: 1,
      })!
      const mMb = engine.spawnMissile({
        missileNameOrId: 'moltenboulder',
        sourceSkillId: 229,
        slvl: 5,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        maxRangeTicks: 1,
      })!

      expect(engine.resolveSrvHitRadiusPx(mLf, 'auraRangeCalc', { fallbackSubtiles: 15 })).toBe(60)
      expect(engine.resolveSrvHitRadiusPx(mFoh, 'auraRangeCalc', { fallbackSubtiles: 20 })).toBe(80)
      expect(engine.resolveSrvHitRadiusPx(mMb, 'auraRangeCalc', { fallbackSubtiles: 7 })).toBe(40)
    } finally {
      ;(lfRec as { sHitPar1: number }).sHitPar1 = origLf
      ;(fohRec as { sHitPar1: number }).sHitPar1 = origFoh
      ;(mbRec as { sHitPar1: number }).sHitPar1 = origMb
    }
  })
})

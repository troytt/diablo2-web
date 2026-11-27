/**
 * Regression tests for Issue #1458:
 * Remove permissive fallbacks in MissileEngine:
 * 1. `spawnMissile` throws when `missileNameOrId` is missing from `Missiles.txt`
 *    (1.13c `D2Game.dll` `0x6FC5F550` `MISSILES_CreateMissileFromParams` / `0x6FC60BD0` `MISSMODE_GetMissilesTxtRecord`).
 * 2. Empty `Missiles.txt` `ExplosionMissile` / `SubMissile1` / `HitSubMissile1` columns are never replaced with
 *    fabricated missile names (`meteorcenter`, `frozenorb`, `blizzard1..4`, `armageddoncontrol`, `armageddonrock`,
 *    `moltenboulder`, `moltenboulderemerge`, `immolationarrow`, `icearrow`, `explosivepotion`, `explodingjavalin`).
 * 3. Missing target positions are skipped via `resolveUnitPosition` instead of assuming `{ x: 0, y: 120 }` or `{ x: m.x, y: m.y }`.
 * 4. `blizzardcenter` (`pSrvDoFunc = 10` @ `0x6FC613D0`) reads cadence/radius from `Skills.txt` `calc2`/`calc1`
 *    and `hurricaneswoosh` reads chill length from `Skills.txt` `eLen`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/common/data/data-registry.ts'
import type { CombatUnitContext, SUnitDmgPacket } from '../src/server/engine/combat-pipeline.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'

const registry = getSharedDataRegistry()

function makeUnit(
  id: string,
  unitType: CombatUnitContext['unitType'] = 'monster',
  opts?: { hp?: number; x?: number; y?: number; isBoss?: boolean },
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
    ...(opts?.x !== undefined ? { x: opts.x } : {}),
    ...(opts?.y !== undefined ? { y: opts.y } : {}),
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

describe('Issue #1458: MissileEngine strict Missiles.txt lookup, empty sub-missile columns, and target position resolution', () => {
  it('1. spawnMissile throws when missileNameOrId is not found in Missiles.txt (0x6FC5F550 / 0x6FC60BD0)', () => {
    const engine = new MissileEngine(registry)
    const caster = makeUnit('caster', 'player')

    expect(() =>
      engine.spawnMissile({
        missileNameOrId: 'nonexistent_fabricated_missile',
        sourceSkillId: 0,
        slvl: 1,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
      }),
    ).toThrow(/Missiles\.txt row 'nonexistent_fabricated_missile' not found/)

    expect(() =>
      engine.spawnMissile({
        missileNameOrId: 'icearrowexplode',
        sourceSkillId: 21,
        slvl: 1,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
      }),
    ).toThrow(/Missiles\.txt row 'icearrowexplode' not found/)

    expect(() =>
      engine.spawnMissile({
        missileNameOrId: 99999,
        sourceSkillId: 0,
        slvl: 1,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
      }),
    ).toThrow(/Missiles\.txt row '99999' not found/)
  })

  it('2. meteorcenter, frozenorb, and blizzard1..4 do not spawn meteorexplode, frozenorbexplode, or blizzardexplode1 when ExplosionMissile is empty', () => {
    const caster = makeUnit('sorc', 'player')

    // (a) meteorcenter (#101): ExplosionMissile = '', HitSubMissile1 = 'meteorfire'
    const mcRec = registry.getMissileByName('meteorcenter')!
    expect(mcRec.explosionMissile).toBe('')
    expect(mcRec.hitSubMissile1).toBe('meteorfire')
    const engineMc = new MissileEngine(registry)
    engineMc.spawnMissile({
      missileNameOrId: 'meteorcenter',
      sourceSkillId: 56,
      slvl: 1,
      owner: caster,
      startX: 200,
      startY: 200,
      targetX: 200,
      targetY: 200,
      maxRangeTicks: 1,
      dmgPacket: makeSpellDmgPacket(56, 'fire', 80),
    })
    const outMc = engineMc.tick(1)
    expect(outMc.subMissilesSpawned).not.toContain('meteorexplode')
    expect(outMc.subMissilesSpawned.filter((n) => n === 'meteorfire')).toHaveLength(18)

    // (b) frozenorb (#260): ExplosionMissile = '', HitSubMissile1 = 'frozenorbnova', sHitPar1 = 4
    const foRec = registry.getMissileByName('frozenorb')!
    expect(foRec.explosionMissile).toBe('')
    expect(foRec.hitSubMissile1).toBe('frozenorbnova')
    expect(foRec.sHitPar1).toBe(4)
    const engineFo = new MissileEngine(registry)
    engineFo.spawnMissile({
      missileNameOrId: 'frozenorb',
      sourceSkillId: 64,
      slvl: 1,
      owner: caster,
      startX: 200,
      startY: 200,
      targetX: 300,
      targetY: 200,
      maxRangeTicks: 1,
      dmgPacket: makeSpellDmgPacket(64, 'cold', 40),
    })
    const outFo = engineFo.tick(1)
    expect(outFo.subMissilesSpawned).not.toContain('frozenorbexplode')
    expect(outFo.subMissilesSpawned.filter((n) => n === 'frozenorbnova')).toHaveLength(16)

    // (c) blizzard1 (#159): ExplosionMissile = ''
    const b1Rec = registry.getMissileByName('blizzard1')!
    expect(b1Rec.explosionMissile).toBe('')
    const engineBliz = new MissileEngine(registry)
    engineBliz.spawnMissile({
      missileNameOrId: 'blizzard1',
      sourceSkillId: 59,
      slvl: 1,
      owner: caster,
      startX: 200,
      startY: 200,
      targetX: 200,
      targetY: 200,
      maxRangeTicks: 1,
      dmgPacket: makeSpellDmgPacket(59, 'cold', 40),
    })
    const outBliz = engineBliz.tick(1)
    expect(outBliz.subMissilesSpawned).not.toContain('blizzardexplode1')
  })

  it('3. armageddoncontrol (pSrvDoFunc=1, pSrvHitFunc=56) does not spawn armageddonrock in tick() and spawns HitSubMissile1 (armageddonfire) on expiry', () => {
    const acRec = registry.getMissileByName('armageddoncontrol')!
    expect(acRec.pSrvDoFunc).toBe(1)
    expect(acRec.pSrvHitFunc).toBe(56)
    expect(acRec.sHitPar1).toBe(3)
    expect(acRec.subMissile1).toBe('')
    expect(acRec.hitSubMissile1).toBe('armageddonfire')

    const engine = new MissileEngine(registry)
    const druid = makeUnit('druid', 'player', { x: 100, y: 100 })
    const nearEnemy = makeUnit('near_enemy', 'monster')
    const farEnemy = makeUnit('far_enemy', 'monster')
    const positions = new Map([
      [nearEnemy.id, { x: 140, y: 100 }], // 40px <= 3 subtiles (60px)
      [farEnemy.id, { x: 200, y: 100 }], // 100px > 3 subtiles (60px)
    ])

    const m = engine.spawnMissile({
      missileNameOrId: 'armageddoncontrol',
      sourceSkillId: 249,
      slvl: 5,
      owner: druid,
      startX: 100,
      startY: 100,
      targetX: 100,
      targetY: 100,
      dmgPacket: makeSpellDmgPacket(249, 'fire', 60),
    })!
    expect(m.maxRangeTicks).toBe(25)

    for (let t = 1; t < 25; t++) {
      const step = engine.tick(t, [nearEnemy, farEnemy], positions)
      expect(step.subMissilesSpawned).toEqual([])
      expect(step.hits).toEqual([])
    }

    const expiryStep = engine.tick(25, [nearEnemy, farEnemy], positions)
    expect(expiryStep.subMissilesSpawned).toEqual(['armageddonfire'])
    expect(expiryStep.hits.map((h) => h.targetId)).toEqual([nearEnemy.id])
  })

  it('4. moltenboulder, armageddonrock, immolationarrow, explosivepotion, explodingjavalin, and icearrow respect exact Missiles.txt sub-missile columns', () => {
    const caster = makeUnit('caster', 'player')

    // (a) moltenboulder (#452): ExplosionMissile = '' -> does not spawn moltenboulderexplode on expiry
    const engineMb = new MissileEngine(registry)
    engineMb.spawnMissile({
      missileNameOrId: 'moltenboulder',
      sourceSkillId: 229,
      slvl: 1,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      maxRangeTicks: 1,
    })
    expect(engineMb.tick(1).subMissilesSpawned).not.toContain('moltenboulderexplode')

    // (b) armageddonrock (#578): ExplosionMissile = '', HitSubMissile1 = '' -> spawns neither on server expiry
    const engineAr = new MissileEngine(registry)
    engineAr.spawnMissile({
      missileNameOrId: 'armageddonrock',
      sourceSkillId: 249,
      slvl: 1,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      maxRangeTicks: 1,
    })
    expect(engineAr.tick(1).subMissilesSpawned).toEqual([])

    // (c) immolationarrow (#85): ExplosionMissile = '', HitSubMissile1 = 'immolationfire'
    const engineIa = new MissileEngine(registry)
    engineIa.spawnMissile({
      missileNameOrId: 'immolationarrow',
      sourceSkillId: 27,
      slvl: 1,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      maxRangeTicks: 1,
    })
    const outIa = engineIa.tick(1)
    expect(outIa.subMissilesSpawned).toEqual(['immolationfire'])

    // (d) explosivepotion (#45): ExplosionMissile = '', HitSubMissile1 = '' -> no fireexplode spawned
    const engineEp = new MissileEngine(registry)
    engineEp.spawnMissile({
      missileNameOrId: 'explosivepotion',
      sourceSkillId: 0,
      slvl: 1,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      maxRangeTicks: 1,
    })
    expect(engineEp.tick(1).subMissilesSpawned).toEqual([])

    // (e) explodingjavalin (#429, pSrvHitFunc = 44): ExplosionMissile = 'explodingjavalinexp', HitSubMissile1 = '' -> no armageddonfire spawned
    const engineEj = new MissileEngine(registry)
    engineEj.spawnMissile({
      missileNameOrId: 'explodingjavalin',
      sourceSkillId: 0,
      slvl: 1,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      maxRangeTicks: 1,
    })
    expect(engineEj.tick(1).subMissilesSpawned).toEqual(['explodingjavalinexp'])

    // (f) icearrow (#28): ExplosionMissile = 'iceexplode'
    const engineIce = new MissileEngine(registry)
    const target = makeUnit('mon_ice', 'monster')
    engineIce.spawnMissile({
      missileNameOrId: 'icearrow',
      sourceSkillId: 21,
      slvl: 1,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: makeSpellDmgPacket(21, 'cold', 20),
    })
    const outIce = engineIce.tick(1, [target], new Map([[target.id, { x: 10, y: 0 }]]))
    expect(outIce.subMissilesSpawned).toContain('iceexplode')
  })

  it('5. targets without positions in targetPositions or unit.x/y are skipped instead of assumed at (0, 120) or (m.x, m.y)', () => {
    const engine = new MissileEngine(registry)
    const caster = makeUnit('caster', 'player', { x: 500, y: 500 })
    const unpositionedMonster = makeUnit('ghost_mon', 'monster') // no x/y and not in targetPositions

    // Spawn meteorcenter right at (0, 120) where the old fallback placed missing targets
    engine.spawnMissile({
      missileNameOrId: 'meteorcenter',
      sourceSkillId: 56,
      slvl: 5,
      owner: caster,
      startX: 0,
      startY: 120,
      targetX: 0,
      targetY: 120,
      maxRangeTicks: 1,
      dmgPacket: makeSpellDmgPacket(56, 'fire', 100),
    })
    // Spawn hurricaneswoosh on caster at (500, 500) where the old fallback used { x: m.x, y: m.y }
    engine.spawnMissile({
      missileNameOrId: 'hurricaneswoosh',
      sourceSkillId: 250,
      slvl: 5,
      owner: caster,
      startX: 500,
      startY: 500,
      targetX: 500,
      targetY: 500,
      maxRangeTicks: 40,
      dmgPacket: makeSpellDmgPacket(250, 'cold', 50),
    })

    const step = engine.tick(1, [unpositionedMonster], new Map())
    expect(step.hits).toEqual([])
    expect(unpositionedMonster.stateBus.hasState('chill')).toBe(false)

    // Verify source file contains zero occurrences of "{ x: 0, y: 120 }" or "defaultmissile"
    const srcPath = path.resolve(__dirname, '../src/server/engine/missile-engine.ts')
    const srcText = fs.readFileSync(srcPath, 'utf8')
    expect(srcText).not.toContain('x: 0, y: 120')
    expect(srcText).not.toContain('defaultmissile')
  })

  it('6. blizzardcenter (pSrvDoFunc=10) reads cadence from Skills.txt calc2 and hurricaneswoosh reads chill duration from Skills.txt eLen', () => {
    const engine = new MissileEngine(registry)
    const caster = makeUnit('druid_sorc', 'player', { x: 100, y: 100 })
    const enemy = makeUnit('chill_target', 'monster', { x: 120, y: 100 })

    // Hurricane (#250): Skills.txt eLen = 50
    const skill250 = registry.getSkillById(250)!
    expect(skill250.eLen).toBe(50)
    const packetWithoutDuration: SUnitDmgPacket = {
      skillId: 250,
      slvl: 5,
      attackKind: 'spell',
      srcDam: 0,
      elemType: 'cold',
      elemMin256: 40 * FIXED_ONE,
      elemMax256: 40 * FIXED_ONE,
      autoHit: true,
    }
    engine.spawnMissile({
      missileNameOrId: 'hurricaneswoosh',
      sourceSkillId: 250,
      slvl: 5,
      owner: caster,
      startX: 100,
      startY: 100,
      targetX: 100,
      targetY: 100,
      maxRangeTicks: 40,
      dmgPacket: packetWithoutDuration,
    })
    engine.tick(1, [enemy], new Map())
    expect(enemy.stateBus.getState('chill')?.durationFrames).toBe(skill250.eLen)

    // Blizzard (#59): Skills.txt calc2 = 'par3' (param3 = 4)
    const skill59 = registry.getSkillById(59)!
    expect(skill59.calc2).toBe('par3')
    expect(skill59.param3).toBe(4)
    const origParam3 = skill59.param3
    try {
      ;(skill59 as { param3: number }).param3 = 6
      const engineBliz = new MissileEngine(registry)
      engineBliz.spawnMissile({
        missileNameOrId: 'blizzardcenter',
        sourceSkillId: 59,
        slvl: 1,
        owner: caster,
        startX: 200,
        startY: 200,
        targetX: 200,
        targetY: 200,
        maxRangeTicks: 15,
      })
      const spawnTicks: number[] = []
      for (let t = 1; t <= 12; t++) {
        const res = engineBliz.tick(t)
        if (res.subMissilesSpawned.length > 0) spawnTicks.push(t)
      }
      // 0x6FC5D1E0 checks remaining % nFrames === 0 (remaining = 15 - t -> t = 3 (rem 12), t = 9 (rem 6))
      expect(spawnTicks).toEqual([3, 9])
    } finally {
      ;(skill59 as { param3: number }).param3 = origParam3
    }
  })
})

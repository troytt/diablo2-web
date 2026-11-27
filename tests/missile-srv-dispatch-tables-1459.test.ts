import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/common/data/data-registry.ts'
import type { CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'
import {
  MISSILE_SRV_DMG_TABLE_113C,
  MISSILE_SRV_DO_TABLE_113C,
  MISSILE_SRV_HIT_TABLE_113C,
  MissileEngine,
} from '../src/server/engine/missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'

const registry = getSharedDataRegistry()

function makeUnit(
  id: string,
  unitType: 'player' | 'monster',
  hp: number = 1000,
  opts?: { isUndead?: boolean; isDemon?: boolean; isBoss?: boolean; damageResist?: number },
): CombatUnitContext {
  const statList = new UnitStatList(registry)
  statList.setBaseStat('hitpoints', hp * FIXED_ONE)
  statList.setBaseStat('maxhp', hp * FIXED_ONE)
  statList.setBaseStat('level', 50)
  statList.setBaseStat('dexterity', 100)
  if (opts?.damageResist !== undefined) {
    statList.setBaseStat('damageresist', opts.damageResist)
  }
  const stateBus = new StateBus(statList, registry)
  return {
    id,
    name: id,
    unitType,
    statList,
    stateBus,
    ...(opts?.isUndead ? { isUndead: true } : {}),
    ...(opts?.isDemon ? { isDemon: true } : {}),
    ...(opts?.isBoss ? { isBoss: true } : {}),
  }
}

describe('Issue #1459: 1.13c D2Game pSrvDoFunc / pSrvHitFunc / pSrvDmgFunc table dispatch', () => {

  it('1. exports complete 1.13c D2Game function tables (38 SrvDo, 65 SrvHit, 16 SrvDmg) covering all 680 Missiles.txt rows', () => {
    expect(MISSILE_SRV_DO_TABLE_113C).toHaveLength(38)
    expect(MISSILE_SRV_HIT_TABLE_113C).toHaveLength(65)
    expect(MISSILE_SRV_DMG_TABLE_113C).toHaveLength(16)

    for (let i = 0; i < 38; i++) {
      expect(MISSILE_SRV_DO_TABLE_113C[i]?.funcId).toBe(i)
      expect(MISSILE_SRV_DO_TABLE_113C[i]?.handlerVa).toBeGreaterThanOrEqual(0)
    }
    for (let i = 0; i < 65; i++) {
      expect(MISSILE_SRV_HIT_TABLE_113C[i]?.funcId).toBe(i)
      expect(MISSILE_SRV_HIT_TABLE_113C[i]?.handlerVa).toBeGreaterThanOrEqual(0)
    }
    for (let i = 0; i < 16; i++) {
      expect(MISSILE_SRV_DMG_TABLE_113C[i]?.funcId).toBe(i)
      expect(MISSILE_SRV_DMG_TABLE_113C[i]?.handlerVa).toBeGreaterThanOrEqual(0)
    }

    for (let id = 0; id < 680; id++) {
      const m = registry.getMissileById(id)
      if (!m) continue
      expect(MISSILE_SRV_DO_TABLE_113C[m.pSrvDoFunc]).toBeDefined()
      expect(MISSILE_SRV_HIT_TABLE_113C[m.pSrvHitFunc]).toBeDefined()
      expect(MISSILE_SRV_DMG_TABLE_113C[m.pSrvDmgFunc]).toBeDefined()
    }
  })

  it('2. removes all m.name and sourceSkillId behavioral branches and isTurret flags from MissileEngine', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/server/engine/missile-engine.ts'),
      'utf8',
    )
    const startIdx = src.indexOf('export class MissileEngine')
    const endIdx = src.indexOf('export function spawnNovaRing')
    expect(startIdx).toBeGreaterThan(0)
    expect(endIdx).toBeGreaterThan(startIdx)

    const engineBody = src.slice(startIdx, endIdx)
    expect(engineBody).not.toMatch(/m\.name\s*===/u)
    expect(engineBody).not.toMatch(/m\.name\s*!==/u)
    expect(engineBody).not.toMatch(/m\.name\.startsWith/u)
    expect(engineBody).not.toMatch(/m\.name\.includes/u)
    expect(engineBody).not.toMatch(/sourceSkillId\s*===/u)
    expect(engineBody).not.toMatch(/sourceSkillId\s*!==/u)
    expect(engineBody).not.toMatch(/\bisTurret\b/u)
  })

  it('3. pSrvDoFunc=15 (MISSMODE_SrvDo15_FrozenOrb @ 0x6FC60CA0) and pSrvHitFunc=29 (@ 0x6FC5C850) fire SubMissile1 (frozenorbbolt) and HitSubMissile1 (frozenorbnova) via Missiles.txt', () => {
    const engine = new MissileEngine(registry)
    const caster = makeUnit('sorc-1', 'player', 500)

    const orb = engine.spawnMissile({
      missileNameOrId: 'frozenorb',
      sourceSkillId: 64,
      slvl: 10,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 400,
      targetY: 0,
      dmgPacket: {
        skillId: 64,
        slvl: 10,
        attackKind: 'spell',
        elemType: 'cold',
        elemMin256: 50 * 256,
        elemMax256: 60 * 256,
        autoHit: true,
      },
    })
    expect(orb).toBeDefined()
    expect(orb!.record.pSrvDoFunc).toBe(15)
    expect(orb!.record.pSrvHitFunc).toBe(29)

    let flightBolts = 0
    let finalNovaBolts = 0
    for (let t = 1; t <= 45; t++) {
      const step = engine.tick(t, [], new Map())
      flightBolts += step.subMissilesSpawned.filter((s) => s === 'frozenorbbolt').length
      finalNovaBolts += step.subMissilesSpawned.filter((s) => s === 'frozenorbnova').length
    }
    expect(flightBolts).toBeGreaterThan(0)
    expect(finalNovaBolts).toBe(16)
  })

  it('4. pSrvDoFunc=1/32 Hurricane aura missile (#581 hurricaneswoosh) pulses cold damage + chill every Param3 (20) frames', () => {
    const engine = new MissileEngine(registry)
    const druid = makeUnit('druid-1', 'player', 500)
    const enemy = makeUnit('mon-1', 'monster', 2000)

    const m = engine.spawnMissile({
      missileNameOrId: 'hurricaneswoosh',
      sourceSkillId: 250,
      slvl: 10,
      owner: druid,
      startX: 200,
      startY: 200,
      targetX: 200,
      targetY: 200,
      dmgPacket: {
        skillId: 250,
        slvl: 10,
        attackKind: 'spell',
        elemType: 'cold',
        elemMin256: 100 * 256,
        elemMax256: 100 * 256,
        autoHit: true,
      },
    })
    expect(m).toBeDefined()
    expect(m!.record.pSrvDoFunc).toBe(1)

    const posMap = new Map([
      [druid.id, { x: 200, y: 200 }],
      [enemy.id, { x: 260, y: 200 }],
    ])
    const step1 = engine.tick(1, [enemy], posMap)
    expect(step1.hits).toHaveLength(1)
    expect(enemy.stateBus.hasState('chill')).toBe(true)

    for (let t = 2; t <= 19; t++) {
      const s = engine.tick(t, [enemy], posMap)
      expect(s.hits).toHaveLength(0)
    }
    const step20 = engine.tick(20, [enemy], posMap)
    expect(step20.hits).toHaveLength(1)
  })

  it('5. pSrvHitFunc=7 (MISSMODE_SrvHit07_HolyBolt @ 0x6FC59FD0) heals friendly ally when Missiles.txt Skill is Holy Bolt (#55) and skips ally on fistoftheheavensbolt (#234)', () => {
    const engine = new MissileEngine(registry)
    const paladin = makeUnit('pal-1', 'player', 600)
    paladin.statList.setBaseSkillLevel(99, 10) // Prayer blvl = 10 (+150% heal synergy)

    const ally = makeUnit('ally-1', 'player', 500)
    ally.statList.setHp256(100 * 256)
    const posMap = new Map([[ally.id, { x: 18, y: 0 }]])

    // 1. holybolt (#55, Skill='Holy Bolt', sHitPar1=1) heals friendly ally
    engine.spawnMissile({
      missileNameOrId: 'holybolt',
      sourceSkillId: 101,
      slvl: 10,
      owner: paladin,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: {
        skillId: 101,
        slvl: 10,
        attackKind: 'spell',
        elemType: 'mag',
        elemMin256: 50 * 256,
        elemMax256: 60 * 256,
        autoHit: true,
      },
    })
    engine.tick(1, [ally], posMap)
    expect(ally.statList.getHp256()).toBeGreaterThan(100 * 256)

    // 2. fistoftheheavensbolt (#234, Skill='') does NOT heal friendly ally
    const hpAfterHolyBolt = ally.statList.getHp256()
    engine.spawnMissile({
      missileNameOrId: 'fistoftheheavensbolt',
      sourceSkillId: 121,
      slvl: 10,
      owner: paladin,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: {
        skillId: 121,
        slvl: 10,
        attackKind: 'spell',
        elemType: 'mag',
        elemMin256: 50 * 256,
        elemMax256: 60 * 256,
        autoHit: true,
      },
    })
    engine.tick(2, [ally], posMap)
    expect(ally.statList.getHp256()).toBe(hpAfterHolyBolt)
  })

  it('6. pSrvHitFunc=22 (MISSMODE_SrvHit22_FistOfTheHeavens @ 0x6FC5DB30) spawns fistoftheheavensbolt with Missiles.txt #234 row damage + Holy Bolt synergy', () => {
    const engine = new MissileEngine(registry)
    const paladin = makeUnit('pal-foh', 'player', 600)
    paladin.statList.setBaseSkillLevel(101, 10) // Holy Bolt blvl = 10 (+150% synergy on Missiles.txt #234)
    const undeadEnemy = makeUnit('undead-1', 'monster', 5000, { isUndead: true })
    const posMap = new Map([[undeadEnemy.id, { x: 100, y: 0 }]])

    engine.spawnMissile({
      missileNameOrId: 'fistoftheheavensdelay',
      sourceSkillId: 121,
      slvl: 10,
      owner: paladin,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      dmgPacket: {
        skillId: 121,
        slvl: 10,
        attackKind: 'spell',
        elemType: 'ltng',
        elemMin256: 150 * 256,
        elemMax256: 200 * 256,
        autoHit: true,
      },
    })

    let spawnedBolt = false
    for (let t = 1; t <= 12; t++) {
      const step = engine.tick(t, [undeadEnemy], posMap)
      if (step.subMissilesSpawned.includes('fistoftheheavensbolt')) {
        spawnedBolt = true
        break
      }
    }
    expect(spawnedBolt).toBe(true)
    const activeBolt = engine
      .getActiveMissiles()
      .find((m) => m.name === 'fistoftheheavensbolt')
    expect(activeBolt).toBeDefined()
    // Missiles.txt #234 at slvl 10 with 10 Holy Bolt blvl (+150%): min256 > 200 * 256
    expect(activeBolt!.dmgPacket.elemMin256).toBeGreaterThan(200 * 256)
  })

  it('7. pSrvDmgFunc=7 (MISSMODE_SrvDmg07_Warcry_ShockWaveStun @ 0x6FC59600) evaluates Shock Wave stun length without any 250-frame cap', () => {
    const engine = new MissileEngine(registry)
    const bear = makeUnit('bear-1', 'player', 1000)
    const target = makeUnit('mon-sw', 'monster', 2000)
    const posMap = new Map([[target.id, { x: 18, y: 0 }]])

    engine.spawnMissile({
      missileNameOrId: 'shockwave',
      sourceSkillId: 243,
      slvl: 20,
      owner: bear,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: {
        skillId: 243,
        slvl: 20,
        attackKind: 'spell',
        flatPhysMin256: 50 * 256,
        flatPhysMax256: 60 * 256,
        autoHit: true,
      },
    })

    // Skills.txt #243 Shock Wave: Param1=40, Param2=15 -> 40 + 19*15 = 325 frames (> 250!)
    engine.tick(1, [target], posMap)
    const stunState = target.stateBus.getState('stun')
    expect(stunState).toBeDefined()
    expect(stunState!.durationFrames).toBe(325)
  })

  it('8. pSrvDmgFunc=1 (MISSMODE_SrvDmg01_ArrowPhysToElemConvert @ 0x6FC59CE0) converts physical damage to fire on firearrow (#12) via DmgCalc1', () => {
    const engine = new MissileEngine(registry)
    const amazon = makeUnit('ama-1', 'player', 500)
    const target = makeUnit('mon-phys-immune', 'monster', 2000, {
      damageResist: 100, // Physical immune, 0% fire resist
    })
    const posMap = new Map([[target.id, { x: 24, y: 0 }]])

    // firearrow (#12) has pSrvDmgFunc=1, DmgCalc1='dl12' (dParam1=3, dParam2=2 -> at slvl 10: 21% physical converted to fire)
    engine.spawnMissile({
      missileNameOrId: 'firearrow',
      sourceSkillId: 7,
      slvl: 10,
      owner: amazon,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: {
        skillId: 7,
        slvl: 10,
        attackKind: 'missile',
        srcDam: 0,
        flatPhysMin256: 100 * 256,
        flatPhysMax256: 100 * 256,
        elemType: 'fire',
        elemMin256: 0,
        elemMax256: 0,
        autoHit: true,
      },
    })

    const step = engine.tick(1, [target], posMap)
    expect(step.hits).toHaveLength(1)
    // Even though target has 100% physical resist and initial elemMin256=0, pSrvDmgFunc=1 converted 21% of 100 phys to 21 fire damage!
    expect(step.hits[0]!.damage).toBe(21)
  })
})


describe('Issue #1460: 1.13c D2Game SrvDo10 blizzardcenter, SrvDo08 monblizcenter, SrvDo16 frozenorbnova, and SrvDo/SrvHit/SrvDmg VA parity', () => {
  it('1. pins exact 1.13c D2Game.dll handlerVa entries across gMissileSrvDoFuncTable (0x6FD2D970), gpMissileSrvHitFnTable (0x6FD2DA48), and gpMissileSrvDmgFnTable (0x6FD2DB68)', () => {
    const expectedSrvDoVas = [
      0x00000000, 0x6fc5f540, 0x6fc61b80, 0x6fc61ae0, 0x00000000, 0x6fc61980,
      0x6fc61850, 0x6fc61710, 0x6fc61670, 0x6fc61520, 0x6fc613d0, 0x6fc61240,
      0x6fc61110, 0x6fc60eb0, 0x6fc60e10, 0x6fc60ca0, 0x6fc60bd0, 0x6fc60b20,
      0x6fc608d0, 0x6fc5f6d0, 0x6fc60860, 0x6fc61eb0, 0x6fc606d0, 0x6fc605e0,
      0x6fc605e0, 0x6fc604d0, 0x6fc60420, 0x6fc60280, 0x6fc60070, 0x6fc5fed0,
      0x6fc5fb40, 0x6fc5f9f0, 0x6fc61de0, 0x6fc5fd30, 0x6fc61c30, 0x6fc5f890,
      0x6fc5f670, 0x6fc5f550,
    ]
    const expectedSrvHitVas = [
      0x00000000, 0x6fc5b990, 0x6fc5e330, 0x6fc5bb60, 0x6fc5f220, 0x6fc5c700,
      0x6fc5bd10, 0x6fc59fd0, 0x6fc59f70, 0x6fc5e0b0, 0x6fc5b140, 0x6fc5f120,
      0x6fc5d020, 0x6fc5b3e0, 0x6fc5def0, 0x6fc5cdd0, 0x6fc5ec10, 0x6fc5eae0,
      0x6fc5ea60, 0x6fc5e8a0, 0x6fc5dd60, 0x6fc5abd0, 0x6fc5db30, 0x6fc59da0,
      0x6fc5b7c0, 0x6fc5da60, 0x6fc5c990, 0x6fc58ec0, 0x6fc5e740, 0x6fc5c850,
      0x00000000, 0x6fc5a920, 0x6fc5be70, 0x6fc58ea0, 0x00000000, 0x6fc5e670,
      0x6fc5ab30, 0x6fc58e90, 0x6fc5c5b0, 0x6fc5bc00, 0x6fc5c490, 0x00000000,
      0x00000000, 0x6fc59e30, 0x6fc5b5f0, 0x6fc5c3b0, 0x00000000, 0x6fc5d8c0,
      0x6fc5c260, 0x00000000, 0x6fc591a0, 0x6fc5c160, 0x6fc5c030, 0x6fc5f7d0,
      0x6fc5bc80, 0x6fc596e0, 0x6fc5b210, 0x6fc5bbb0, 0x6fc5bed0, 0x6fc5d800,
      0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
    ]
    const expectedSrvDmgVas = [
      0x00000000, 0x6fc59ce0, 0x6fc59080, 0x6fc59670, 0x6fc58e70, 0x6fc5a790,
      0x6fc59c80, 0x6fc59600, 0x6fc58ff0, 0x6fc59560, 0x6fc59040, 0x6fc59bd0,
      0x6fc5a850, 0x6fc5aaa0, 0x6fc59a40, 0x00000000,
    ]

    expect(MISSILE_SRV_DO_TABLE_113C.map((e) => e.handlerVa)).toEqual(expectedSrvDoVas)
    expect(MISSILE_SRV_HIT_TABLE_113C.map((e) => e.handlerVa)).toEqual(expectedSrvHitVas)
    expect(MISSILE_SRV_DMG_TABLE_113C.map((e) => e.handlerVa)).toEqual(expectedSrvDmgVas)

    // Verify no stale wrong SrvDo VAs remain in missile-engine.ts comments
    const src = readFileSync(
      resolve(process.cwd(), 'src/server/engine/missile-engine.ts'),
      'utf8',
    )
    expect(src).not.toContain('0x6FC58E10')
    expect(src).not.toContain('0x6FC58F30')
    expect(src).not.toContain('0x6FC591C0')
    expect(src).not.toContain('0x6FC594B0')
    expect(src).not.toContain('0x6FC598D0')
    expect(src).not.toContain('0x6FC5C740')
  })

  it('2. pSrvDoFunc=10 (MISSMODE_SrvDo10_BlizzardCenter @ 0x6FC613D0 -> 0x6FC5D1E0) spawns only SubMissile1 (blizzard1) via pMissile->pSeed (x + remaining) in [-6, +5] subtiles', () => {
    const engine = new MissileEngine(registry)
    const caster = makeUnit('sorc-bliz', 'player', 500)

    const bliz = engine.spawnMissile({
      missileNameOrId: 'blizzardcenter',
      sourceSkillId: 59,
      slvl: 10,
      owner: caster,
      startX: 300,
      startY: 300,
      targetX: 300,
      targetY: 300,
      dmgPacket: {
        skillId: 59,
        slvl: 10,
        attackKind: 'spell',
        elemType: 'cold',
        elemMin256: 100 * 256,
        elemMax256: 120 * 256,
        autoHit: true,
      },
    })
    expect(bliz).toBeDefined()
    expect(bliz!.record.pSrvDoFunc).toBe(10)
    expect(bliz!.record.subMissile1).toBe('blizzard1')

    const spawnedNames: string[] = []
    const shardCoords: Array<{ x: number; y: number }> = []
    for (let t = 1; t <= 100; t++) {
      const step = engine.tick(t, [], new Map())
      for (const s of step.subMissilesSpawned) {
        spawnedNames.push(s)
      }
      for (const m of engine.getActiveMissiles()) {
        if (m.name === 'blizzard1' && m.ageTicks === 0) {
          shardCoords.push({ x: m.x, y: m.y })
        }
      }
    }

    // 100 frames / 4-frame cadence = 25 shards; all must be SubMissile1 ('blizzard1'), never blizzard2..4
    expect(spawnedNames).toHaveLength(25)
    expect(new Set(spawnedNames)).toEqual(new Set(['blizzard1']))

    // Each shard offset is rand(2 * (7 - 1)) - (7 - 1) = [-6, +5] subtiles
    for (const pt of shardCoords) {
      const offSubX = (pt.x - 300) / 20
      const offSubY = (pt.y - 300) / 10
      expect(offSubX).toBeGreaterThanOrEqual(-6)
      expect(offSubX).toBeLessThanOrEqual(5)
      expect(offSubY).toBeGreaterThanOrEqual(-6)
      expect(offSubY).toBeLessThanOrEqual(5)
    }
  })

  it('3. pSrvDoFunc=8 (MISSMODE_SrvDo08_MonBlizzCenter @ 0x6FC61670 -> 0x6FC5D1E0) spawns SubMissile1 (monbliz1) using Param1..Param3 and slvl', () => {
    const engine = new MissileEngine(registry)
    const monster = makeUnit('zakarum-priest', 'monster', 800)

    const monBliz = engine.spawnMissile({
      missileNameOrId: 'monblizcenter',
      sourceSkillId: 59,
      slvl: 12,
      owner: monster,
      startX: 200,
      startY: 200,
      targetX: 200,
      targetY: 200,
    })
    expect(monBliz).toBeDefined()
    expect(monBliz!.record.pSrvDoFunc).toBe(8)
    expect(monBliz!.record.subMissile1).toBe('monbliz1')

    const spawned: string[] = []
    for (let t = 1; t <= 40; t++) {
      const step = engine.tick(t, [], new Map())
      spawned.push(...step.subMissilesSpawned)
    }
    expect(spawned.length).toBeGreaterThan(0)
    expect(new Set(spawned)).toEqual(new Set(['monbliz1']))
  })

  it('4. pSrvDoFunc=16 (MISSMODE_SrvDo16_FrozenOrbNova @ 0x6FC60BD0) rotates stored target offset via (a-b)/2, (a+b)/2 without decaying scalar speed', () => {
    const engine = new MissileEngine(registry)
    const caster = makeUnit('sorc-orb', 'player', 500)

    const bolt = engine.spawnMissile({
      missileNameOrId: 'frozenorbnova',
      sourceSkillId: 64,
      slvl: 10,
      owner: caster,
      startX: 100,
      startY: 100,
      targetX: 100 + 30 * 20,
      targetY: 100,
    })
    expect(bolt).toBeDefined()
    expect(bolt!.record.pSrvDoFunc).toBe(16)
    expect(bolt!.record.param1).toBe(6)
    expect(bolt!.record.param2).toBe(2)
    expect(bolt!.maxRangeTicks).toBe(25)

    // Initialize stored target offset (30, 0) as SrvHit29 (0x6FC5C850) does via MISSILE_SetTargetX/Y
    bolt!.targetOffsetX = 30
    bolt!.targetOffsetY = 0
    const initialSpeed = bolt!.speed
    const initialAngle = bolt!.angleRad

    // Range is 20 ticks:
    // t=1..14 -> remaining=19..6 (no rotation yet because remaining >= Param1=6)
    for (let t = 1; t <= 19; t++) {
      engine.tick(t, [], new Map())
    }
    expect(bolt!.targetOffsetX).toBe(30)
    expect(bolt!.targetOffsetY).toBe(0)
    expect(bolt!.angleRad).toBeCloseTo(initialAngle, 6)
    expect(bolt!.speed).toBe(initialSpeed)

    // t=15 -> remaining=5 (5 < 6, 5 % 2 !== 0 -> no rotation)
    engine.tick(20, [], new Map())
    expect(bolt!.targetOffsetX).toBe(30)
    expect(bolt!.targetOffsetY).toBe(0)

    // t=16 -> remaining=4 (4 < 6, 4 % 2 === 0 -> rotates (30, 0) -> ((30-0)/2, (30+0)/2) = (15, 15))
    engine.tick(21, [], new Map())
    expect(bolt!.targetOffsetX).toBe(15)
    expect(bolt!.targetOffsetY).toBe(15)
    expect(bolt!.angleRad).toBeCloseTo(Math.PI / 4, 5)
    expect(bolt!.speed).toBe(initialSpeed)
    expect(Math.hypot(bolt!.vx, bolt!.vy)).toBeCloseTo(initialSpeed, 5)

    // t=17 -> remaining=3 (no rotation)
    engine.tick(22, [], new Map())
    expect(bolt!.targetOffsetX).toBe(15)
    expect(bolt!.targetOffsetY).toBe(15)

    // t=18 -> remaining=2 (rotates (15, 15) -> ((15-15)/2, (15+15)/2) = (0, 15))
    engine.tick(23, [], new Map())
    expect(bolt!.targetOffsetX).toBe(0)
    expect(bolt!.targetOffsetY).toBe(15)
    expect(bolt!.angleRad).toBeCloseTo(Math.PI / 2, 5)
    expect(bolt!.speed).toBe(initialSpeed)
    expect(Math.hypot(bolt!.vx, bolt!.vy)).toBeCloseTo(initialSpeed, 5)
  })
})

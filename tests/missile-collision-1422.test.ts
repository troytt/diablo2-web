import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/common/data/data-registry.ts'
import {
  MISSILE_COLLIDE_TABLE_113C,
  MissileEngine,
  areUnitsEnemies113c,
  canMissileCollideWithUnit113c,
  checkMissileSegmentFootprintOverlap113c,
  checkMissileSizeFootprintOverlap113c,
  getMissileCollideEntry113c,
  resolveUnitSubtileSize113c,
  stepMissileSubtileRay113c,
  type MissileTerrainCollision,
} from '../src/server/engine/missile-engine.ts'
import type { CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'

const registry = getSharedDataRegistry()

function makeUnit(
  id: string,
  unitType: CombatUnitContext['unitType'],
  opts?: {
    hp?: number
    maxHp?: number
    hcIdx?: number
    isUndead?: boolean
    isDemon?: boolean
  },
): CombatUnitContext {
  const statList = new UnitStatList()
  const maxHp = opts?.maxHp ?? 500
  const hp = opts?.hp ?? maxHp
  statList.setBaseStat('level', 20)
  statList.setBaseStat('maxhp', maxHp * FIXED_ONE)
  statList.setHp256(hp * FIXED_ONE)
  if (opts?.hcIdx !== undefined) {
    statList.setBaseStat('hcIdx', opts.hcIdx)
  }
  const stateBus = new StateBus(statList, registry)
    return {
    id,
    name: id,
    unitType,
    statList,
    stateBus,
    isUndead: opts?.isUndead,
    isDemon: opts?.isDemon,
    ...(opts?.hcIdx !== undefined ? { hcIdx: opts.hcIdx } : {}),
  } as CombatUnitContext
}

describe('Issue #1422: 1.13c Missile CollideType table, enemy/ally filter, and Size subtile footprint', () => {
  it('matches D2Game.dll 0x6FD2D928 g_aMissileCollideTypes[9] masks and callbacks', () => {
    expect(MISSILE_COLLIDE_TABLE_113C).toHaveLength(9)
    expect(getMissileCollideEntry113c(0)).toEqual({
      collideType: 0,
      callbackVa: 0x00000000,
      collisionMask: 0x0000,
      terrainMask: 0x00,
      unitTypeMask: 0x0000,
      collidesWithPlayers: false,
      collidesWithMonsters: false,
      collidesWithMissiles: false,
    })
    expect(getMissileCollideEntry113c(1)).toEqual({
      collideType: 1,
      callbackVa: 0x6fc5ad70,
      collisionMask: 0x0084,
      terrainMask: 0x04,
      unitTypeMask: 0x0080,
      collidesWithPlayers: true,
      collidesWithMonsters: false,
      collidesWithMissiles: false,
    })
    expect(getMissileCollideEntry113c(2)).toEqual({
      collideType: 2,
      callbackVa: 0x6fc5add0,
      collisionMask: 0x0104,
      terrainMask: 0x04,
      unitTypeMask: 0x0100,
      collidesWithPlayers: false,
      collidesWithMonsters: true,
      collidesWithMissiles: false,
    })
    expect(getMissileCollideEntry113c(3)).toEqual({
      collideType: 3,
      callbackVa: 0x6fc5ad30,
      collisionMask: 0x0184,
      terrainMask: 0x04,
      unitTypeMask: 0x0180,
      collidesWithPlayers: true,
      collidesWithMonsters: true,
      collidesWithMissiles: false,
    })
    expect(getMissileCollideEntry113c(4)).toEqual({
      collideType: 4,
      callbackVa: 0x00000000,
      collisionMask: 0x0000,
      terrainMask: 0x00,
      unitTypeMask: 0x0000,
      collidesWithPlayers: false,
      collidesWithMonsters: false,
      collidesWithMissiles: false,
    })
    expect(getMissileCollideEntry113c(5)).toEqual({
      collideType: 5,
      callbackVa: 0x6fc5add0,
      collisionMask: 0x0104,
      terrainMask: 0x04,
      unitTypeMask: 0x0100,
      collidesWithPlayers: false,
      collidesWithMonsters: true,
      collidesWithMissiles: false,
    })
    expect(getMissileCollideEntry113c(6)).toEqual({
      collideType: 6,
      callbackVa: 0x00000000,
      collisionMask: 0x0004,
      terrainMask: 0x04,
      unitTypeMask: 0x0000,
      collidesWithPlayers: false,
      collidesWithMonsters: false,
      collidesWithMissiles: false,
    })
    expect(getMissileCollideEntry113c(7)).toEqual({
      collideType: 7,
      callbackVa: 0x6fc59510,
      collisionMask: 0x0040,
      terrainMask: 0x00,
      unitTypeMask: 0x0000,
      collidesWithPlayers: false,
      collidesWithMonsters: false,
      collidesWithMissiles: true,
    })
    expect(getMissileCollideEntry113c(8)).toEqual({
      collideType: 8,
      callbackVa: 0x6fc5ad30,
      collisionMask: 0x0185,
      terrainMask: 0x05,
      unitTypeMask: 0x0180,
      collidesWithPlayers: true,
      collidesWithMonsters: true,
      collidesWithMissiles: false,
    })
  })

  it('prevents monster arrow (CollideType=3, CollideFriend=0) from hitting other monsters while hitting players', () => {
    const engine = new MissileEngine(registry)
    const archerMonster = makeUnit('mon_archer', 'monster')
    const fellowMonster = makeUnit('mon_ally', 'monster')
    const enemyPlayer = makeUnit('player_1', 'player')

    engine.spawnMissile({
      missileNameOrId: 'arrow',
      sourceSkillId: 0,
      slvl: 1,
      owner: archerMonster,
      startX: 0,
      startY: 0,
      targetX: 200,
      targetY: 0,
      dmgPacket: {
        skillId: 0,
        attackKind: 'missile',
        srcDam: 0,
        flatPhysMin256: 50 * FIXED_ONE,
        flatPhysMax256: 50 * FIXED_ONE,
        autoHit: true,
      },
    })

    // Place another monster directly in front at x=18 (within 1 subtile) and player behind at x=50
    const positions = new Map([
      [fellowMonster.id, { x: 18, y: 0 }],
      [enemyPlayer.id, { x: 50, y: 0 }],
    ])

    const tick1 = engine.tick(1, [fellowMonster, enemyPlayer], positions)
    expect(tick1.hits.some((h) => h.targetId === fellowMonster.id)).toBe(false)
    expect(fellowMonster.statList.getHp()).toBe(500)

    const tick2 = engine.tick(2, [fellowMonster, enemyPlayer], positions)
    expect(tick2.hits.some((h) => h.targetId === enemyPlayer.id)).toBe(true)
    expect(enemyPlayer.statList.getHp()).toBe(450)
  })

  it('prevents player fireball (CollideType=3, CollideFriend=0) from hitting allies/party on contact or splash', () => {
    const engine = new MissileEngine(registry)
    const casterPlayer = makeUnit('player_caster', 'player')
    const partyAlly = makeUnit('player_ally', 'player')
    const friendlyMerc = makeUnit('merc_1', 'mercenary')
    const hostileMonster = makeUnit('mon_target', 'monster')

    engine.spawnMissile({
      missileNameOrId: 'fireball',
      sourceSkillId: 47,
      slvl: 5,
      owner: casterPlayer,
      startX: 0,
      startY: 0,
      targetX: 200,
      targetY: 0,
      dmgPacket: {
        skillId: 47,
        slvl: 5,
        attackKind: 'spell',
        srcDam: 0,
        elemType: 'fire',
        elemMin256: 60 * FIXED_ONE,
        elemMax256: 60 * FIXED_ONE,
        autoHit: true,
      },
    })

    // Party ally stands directly in front of caster at x=12; monster is at x=24 with merc next to monster (within 85px splash)
    const positions = new Map([
      [partyAlly.id, { x: 12, y: 0 }],
      [hostileMonster.id, { x: 24, y: 0 }],
      [friendlyMerc.id, { x: 30, y: 0 }],
    ])

    let monsterHit = false
    for (let i = 1; i <= 4; i++) {
      const res = engine.tick(i, [partyAlly, friendlyMerc, hostileMonster], positions)
      expect(res.hits.some((h) => h.targetId === partyAlly.id)).toBe(false)
      expect(res.hits.some((h) => h.targetId === friendlyMerc.id)).toBe(false)
      if (res.hits.some((h) => h.targetId === hostileMonster.id)) {
        monsterHit = true
      }
    }

    expect(monsterHit).toBe(true)
    expect(partyAlly.statList.getHp()).toBe(500)
    expect(friendlyMerc.statList.getHp()).toBe(500)
    expect(hostileMonster.statList.getHp()).toBeLessThan(500)
  })

  it('enforces CollideType=1 (0x0084 player/ally unit mask only) for monster missiles like pantherjav5 / arcanelightningbolt', () => {
    const pantherJav5 = registry.getMissileByName('pantherjav5')!
    expect(pantherJav5.collideType).toBe(1)

    const monsterOwner = makeUnit('mon_caster', 'monster')
    const playerOwner = makeUnit('player_caster', 'player')
    const playerTarget = makeUnit('player_target', 'player')
    const monsterTarget = makeUnit('mon_target', 'monster')

    // Monster owner firing CollideType=1 hits hostile player (0x0080), never hits monsters
    expect(canMissileCollideWithUnit113c(pantherJav5, monsterOwner, playerTarget)).toBe(true)
    expect(canMissileCollideWithUnit113c(pantherJav5, monsterOwner, monsterTarget)).toBe(false)
    // Player owner firing CollideType=1 cannot hit monsters because unitTypeMask=0x0080 excludes monsters (0x0100)
    expect(canMissileCollideWithUnit113c(pantherJav5, playerOwner, monsterTarget)).toBe(false)
  })

  it('enforces CollideType=6 (0x0004 terrain barrier only, pfnUnitCallback=NULL): never collides with units in flight', () => {
    const engine = new MissileEngine(registry)
    const oilPotion = registry.getMissileByName('oilpotion')!
    expect(oilPotion.collideType).toBe(6)

    const player = makeUnit('player_thrower', 'player')
    const monsterInPath = makeUnit('mon_in_path', 'monster')

    expect(canMissileCollideWithUnit113c(oilPotion, player, monsterInPath)).toBe(false)

    engine.spawnMissile({
      missileNameOrId: 'oilpotion',
      sourceSkillId: 0,
      slvl: 1,
      owner: player,
      startX: 0,
      startY: 0,
      targetX: 200,
      targetY: 0,
      maxRangeTicks: 5,
      dmgPacket: {
        skillId: 0,
        attackKind: 'spell',
        srcDam: 0,
        elemType: 'fire',
        elemMin256: 40 * FIXED_ONE,
        elemMax256: 40 * FIXED_ONE,
        autoHit: true,
      },
    })

    // Monster stands right on the trajectory at x=18: CollideType=6 flies over without direct unit contact hit
    const positions = new Map([[monsterInPath.id, { x: 18, y: 0 }]])
    const tick1 = engine.tick(1, [monsterInPath], positions)
    expect(tick1.hits).toHaveLength(0)
    expect(engine.getActiveMissiles().some((m) => m.name === 'oilpotion')).toBe(true)
  })

  it('distinguishes CollideType=8 (0x0185 floor-hugging: stops on 0x01 walk-block) from CollideType=3 (0x0184: flies over 0x01, stops on 0x04)', () => {
    // Terrain cell at x >= 15 has walk-block (0x01) only, and at x >= 50 has missile-barrier (0x04)
    const terrain: MissileTerrainCollision = {
      isMissileBlocked(x, _y, _fromX, _fromY, mask = 0x04) {
        let cellFlags = 0
        if (x >= 15 && x < 50) cellFlags |= 0x01 // walk-only obstacle (low wall / river / puddle)
        if (x >= 50) cellFlags |= 0x04 // full missile barrier (tall wall / closed door)
        return (cellFlags & mask) !== 0
      },
    }

    const engine = new MissileEngine(registry, terrain)
    const player = makeUnit('player_1', 'player')

    // Spawn CollideType=8 (`firewallmaker` / `moltenboulder`) and CollideType=3 (`arrow`)
    engine.spawnMissile({
      missileNameOrId: 'firewallmaker',
      sourceSkillId: 51,
      slvl: 1,
      owner: player,
      startX: 0,
      startY: 0,
      targetX: 200,
      targetY: 0,
      dmgPacket: { skillId: 51, attackKind: 'spell', srcDam: 0 },
    })
    engine.spawnMissile({
      missileNameOrId: 'arrow',
      sourceSkillId: 0,
      slvl: 1,
      owner: player,
      startX: 0,
      startY: 0,
      targetX: 200,
      targetY: 0,
      dmgPacket: { skillId: 0, attackKind: 'missile', srcDam: 0 },
    })

    // Step 2 frames: firewallmaker (CollideType=8, mask 0x05) is blocked at x >= 15 (0x01),
    // while arrow (CollideType=3, mask 0x04) flies over x=15..49 and only stops at x >= 50 (0x04).
    engine.tick(1, [], new Map())
    engine.tick(2, [], new Map())

    const activeAfterLowObstacle = engine.getActiveMissiles()
    expect(activeAfterLowObstacle.some((m) => m.name === 'firewallmaker')).toBe(false)
    expect(activeAfterLowObstacle.some((m) => m.name === 'arrow')).toBe(true)

    // Step until arrow reaches x >= 50 (missile barrier 0x04)
    engine.tick(3, [], new Map())
    expect(engine.getActiveMissiles().some((m) => m.name === 'arrow')).toBe(false)
  })

  it('implements D2Common.#10389 (0x6FDCF6A0) 9-case Size footprint overlap and 0x6FD5D580 subtile halving ray step', () => {
    // Case (1, 1): dx == 0 && dy == 0 (dx < 1 && dy < 1)
    expect(checkMissileSizeFootprintOverlap113c(0, 0, 1, 1)).toBe(true)
    expect(checkMissileSizeFootprintOverlap113c(1, 0, 1, 1)).toBe(false)

    // Case (1, 2) / (2, 1): dx + dy <= 1
    expect(checkMissileSizeFootprintOverlap113c(1, 0, 1, 2)).toBe(true)
    expect(checkMissileSizeFootprintOverlap113c(0, 1, 2, 1)).toBe(true)
    expect(checkMissileSizeFootprintOverlap113c(1.5, 0, 1, 2)).toBe(false) // 30px > 20px (1 subtile) -> misses!

    // Case (1, 3) / (3, 1): dx <= 1 && dy <= 1
    expect(checkMissileSizeFootprintOverlap113c(1, 1, 1, 3)).toBe(true)
    expect(checkMissileSizeFootprintOverlap113c(1.5, 0, 1, 3)).toBe(false)

    // Case (2, 2): dx + dy <= 2
    expect(checkMissileSizeFootprintOverlap113c(2, 0, 2, 2)).toBe(true)
    expect(checkMissileSizeFootprintOverlap113c(1, 1, 2, 2)).toBe(true)
    expect(checkMissileSizeFootprintOverlap113c(2, 1, 2, 2)).toBe(false) // dx + dy == 3 > 2 -> false

    // Case (3, 2) / (2, 3): (dx <= 2 && dy <= 1) || (dy <= 2 && dx <= 1)
    expect(checkMissileSizeFootprintOverlap113c(2, 1, 3, 2)).toBe(true)
    expect(checkMissileSizeFootprintOverlap113c(1, 2, 2, 3)).toBe(true)
    expect(checkMissileSizeFootprintOverlap113c(2, 1.5, 3, 2)).toBe(false)
    expect(checkMissileSizeFootprintOverlap113c(1.5, 2, 2, 3)).toBe(false)

    // Case (3, 3): dx <= 2 && dy <= 2
    expect(checkMissileSizeFootprintOverlap113c(2, 2, 3, 3)).toBe(true)
    expect(checkMissileSizeFootprintOverlap113c(2.1, 2, 3, 3)).toBe(false)

    // Subtile halving ray step (0x6FD5D580):
    const steps = stepMissileSubtileRay113c(0, 0, 60, 0, 20)
    // 60px = 3 subtiles -> halved twice (3 -> 1.5 -> 0.75 <= 1 subtile = 15px step) -> 4 steps
    expect(steps.length).toBe(5)
    expect(steps[0]).toEqual({ x: 0, y: 0 })
    expect(steps[steps.length - 1]).toEqual({ x: 60, y: 0 })

    // Verify segment footprint overlap: arrow (Size=1) passing at y=30px (1.5 subtiles) from Size=2 unit misses
    // (previously hit under fabricated max(24, size*14) + targetRadius = 40px!)
    expect(checkMissileSegmentFootprintOverlap113c(0, 30, 100, 30, 50, 0, 1, 2, 20)).toBe(false)
    // While at y=18px (0.9 subtiles <= 1), it hits:
    expect(checkMissileSegmentFootprintOverlap113c(0, 18, 100, 18, 50, 0, 1, 2, 20)).toBe(true)
  })

  it('resolves unit Size from MonStats2.txt SizeX (D2Common.#10336 PATH_GetSize)', () => {
    const player = makeUnit('p1', 'player')
    expect(resolveUnitSubtileSize113c(player)).toBe(2)

    // hcIdx 0 = Skeleton (SizeX = 2), hcIdx 156 = Andariel (SizeX = 3)
    const skel = makeUnit('skel', 'monster', { hcIdx: 0 })
    const andariel = makeUnit('andy', 'monster', { hcIdx: 156 })
    expect(resolveUnitSubtileSize113c(skel)).toBe(2)
    expect(resolveUnitSubtileSize113c(andariel)).toBe(3)
    expect(areUnitsEnemies113c(player, skel)).toBe(true)
  })

  it('enforces CollideType=7 (0x0040 COLLIDE_MISSILE) warcry destroying CanDestroy=1 missiles in flight', () => {
    const engine = new MissileEngine(registry)
    const barb = makeUnit('barb', 'player')
    const archer = makeUnit('archer', 'monster')

    // Monster fires an arrow (CanDestroy = 1) at (10, 0)
    engine.spawnMissile({
      missileNameOrId: 'arrow',
      sourceSkillId: 0,
      slvl: 1,
      owner: archer,
      startX: 10,
      startY: 0,
      targetX: 0,
      targetY: 0,
      dmgPacket: { skillId: 0, attackKind: 'missile', srcDam: 0 },
    })
    // Barb emits battlecry (CollideType = 7) at (0, 0)
    engine.spawnMissile({
      missileNameOrId: 'battlecry',
      sourceSkillId: 146,
      slvl: 1,
      owner: barb,
      startX: 0,
      startY: 0,
      targetX: 10,
      targetY: 0,
      dmgPacket: { skillId: 146, attackKind: 'spell', srcDam: 0 },
    })

    engine.tick(1, [barb, archer], new Map([[barb.id, { x: 0, y: 0 }], [archer.id, { x: 10, y: 0 }]]))
    expect(engine.getActiveMissiles().some((m) => m.name === 'arrow')).toBe(false)
  })

  it('delegates Holy Bolt (SrvHit07 @ 0x6FC5E220) friendly heal and undead-only damage through CollideFriend=1', () => {
    const engine = new MissileEngine(registry)
    const paladin = makeUnit('paladin', 'player')
    const woundedAlly = makeUnit('ally_merc', 'mercenary', { hp: 200, maxHp: 500 })
    const demonEnemy = makeUnit('demon_1', 'monster', { isDemon: true, isUndead: false })
    const undeadEnemy = makeUnit('undead_1', 'monster', { isUndead: true })

    // 1. Heal friendly merc via CollideFriend = 1 (slvl 5: min = 1 + 4*2 = 9, max = 6 + 4*4 = 22 -> avg = 15)
    engine.spawnMissile({
      missileNameOrId: 'holybolt',
      sourceSkillId: 101,
      slvl: 5,
      owner: paladin,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: {
        skillId: 101,
        slvl: 5,
        attackKind: 'spell',
        srcDam: 0,
        elemType: 'mag',
        elemMin256: 40 * FIXED_ONE,
        elemMax256: 40 * FIXED_ONE,
        autoHit: true,
      },
    })
    engine.tick(1, [woundedAlly], new Map([[woundedAlly.id, { x: 12, y: 0 }]]))
    expect(woundedAlly.statList.getHp()).toBe(215)
    expect(engine.getActiveMissiles()).toHaveLength(0)

    // 2. Non-undead enemy (demon) collides and consumes Holy Bolt without taking damage
    engine.spawnMissile({
      missileNameOrId: 'holybolt',
      sourceSkillId: 101,
      slvl: 5,
      owner: paladin,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: {
        skillId: 101,
        slvl: 5,
        attackKind: 'spell',
        srcDam: 0,
        elemType: 'mag',
        elemMin256: 40 * FIXED_ONE,
        elemMax256: 40 * FIXED_ONE,
        autoHit: true,
      },
    })
    // 2. Non-undead enemy (demon): SrvHit07 returns 0 (passes through without dealing damage)
    const demonTick = engine.tick(
      2,
      [demonEnemy, undeadEnemy],
      new Map([
        [demonEnemy.id, { x: 12, y: 0 }],
        [undeadEnemy.id, { x: 14, y: 0 }],
      ]),
    )
    expect(demonTick.hits).toHaveLength(1)
    expect(demonTick.hits[0]?.targetId).toBe(undeadEnemy.id)
    expect(demonEnemy.statList.getHp()).toBe(500)
    expect(undeadEnemy.statList.getHp()).toBe(460)
  })
})

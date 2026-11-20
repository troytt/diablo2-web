/**
 * Issue #1997 — 1.13c `Missiles.txt` `Activate` unit-collision arming gate (`D2Game.dll` `0x6FC8FCE8` & `0x6FC5F413`)
 * and `MonUMod #20` (`Scarab`) `#225 buglightning` `77`-frame lifetime cap (`0x6FC61F64..0x6FC61F77`).
 */

import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { MON_UMOD } from '../../src/common/units/monster-death-fx.ts'
import {
  SCARAB_BUGLIGHTNING_MAX_FRAMES_113C,
  SCARAB_BUGLIGHTNING_MISSILE_ID_113C,
} from '../../src/server/ai/monumod-113c.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  MissileEngine,
  type MissileTerrainCollision,
} from '../../src/server/engine/missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'

const registry = getSharedDataRegistry()

function makeUnit(
  id: string,
  unitType: CombatUnitContext['unitType'],
  opts?: {
    hp?: number
    maxHp?: number
    isUndead?: boolean
  },
): CombatUnitContext {
  const statList = new UnitStatList()
  const maxHp = opts?.maxHp ?? 500
  const hp = opts?.hp ?? maxHp
  statList.setBaseStat('level', 20)
  statList.setBaseStat('maxhp', maxHp * FIXED_ONE)
  statList.setHp256(hp * FIXED_ONE)
  const stateBus = new StateBus(statList, registry)
  return {
    id,
    name: id,
    unitType,
    statList,
    stateBus,
    isUndead: opts?.isUndead,
  } as CombatUnitContext
}

describe('Issue #1997 — 1.13c Missiles.txt Activate arming gate & Scarab #225 77-frame lifetime cap', () => {
  it('parses exact 1.13c Activate values across all 6 Missiles.txt rows with Activate >= 2', () => {
    expect(registry.getMissileById(195)?.activate).toBe(3) // lightunique
    expect(registry.getMissileById(215)?.activate).toBe(3) // chargedstrikebolt
    expect(registry.getMissileById(225)?.activate).toBe(3) // buglightning
    expect(registry.getMissileById(234)?.activate).toBe(2) // fistoftheheavensbolt
    expect(registry.getMissileById(502)?.activate).toBe(30) // death mauler
    expect(registry.getMissileById(516)?.activate).toBe(2) // rabiescontagion
  })

  it('GameInstance.stepMissiles: caps Scarab #225 buglightning to 77 frames, prevents tick 1..2 point-blank shotgunning, and arms on tick 3', () => {
    expect(SCARAB_BUGLIGHTNING_MAX_FRAMES_113C).toBe(77)

    const game = new GameInstance({ seed: 199701, difficulty: 0, areaId: 62 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'MaggotTeleporter',
      level: 20,
      x: 30,
      y: 30,
      areaId: 62,
    })
    const scarabId = game.spawnMonster({
      hcIdx: 92,
      defId: 'scarab2',
      rank: 'minion',
      umodIds: [MON_UMOD.SCARAB],
      level: 18,
      hp: 150,
      maxHp: 150,
      x: 30,
      y: 30,
      areaId: 62,
    })

    const internal = game as unknown as {
      players: Map<number, { x: number; y: number; hp: number; hpFixed: number }>
      missiles: Map<
        number,
        {
          missileId: number
          x: number
          y: number
          vx: number
          vy: number
          remainingFrames: number
          ticksElapsed?: number
        }
      >
    }
    const playerRec = internal.players.get(pid)!
    playerRec.x = 30
    playerRec.y = 30
    const hpBeforeBurst = playerRec.hp

    // Slay the Scarab at exact player overlap (30, 30): emits 8 radial #225 buglightning bolts
    game.applyDamageToMonster(scarabId, 200, pid, 36, 'fire', 'player', { autoHit: true })
    const initialBolts = [...internal.missiles.values()].filter(
      (m) => m.missileId === SCARAB_BUGLIGHTNING_MISSILE_ID_113C,
    )
    expect(initialBolts).toHaveLength(8)
    expect(initialBolts.every((b) => b.remainingFrames === SCARAB_BUGLIGHTNING_MAX_FRAMES_113C)).toBe(
      true,
    )

    // Ticks 1 & 2 (`ticksElapsed < 3`): bolts move outward without colliding with the overlapping player
    game.stepFrames(2)
    const afterTick2Bolts = [...internal.missiles.values()].filter(
      (m) => m.missileId === SCARAB_BUGLIGHTNING_MISSILE_ID_113C,
    )
    expect(afterTick2Bolts).toHaveLength(8)
    expect(afterTick2Bolts.every((b) => b.ticksElapsed === 2 && b.remainingFrames === 75)).toBe(true)
    expect(playerRec.hp).toBe(hpBeforeBurst)

    // Move player directly onto one outward bolt's tick-3 path: tick 3 (`ticksElapsed === 3 >= Activate`) arms & hits
    const targetBolt = afterTick2Bolts[0]!
    playerRec.x = targetBolt.x + targetBolt.vx
    playerRec.y = targetBolt.y + targetBolt.vy
    game.stepFrames(1)

    const afterTick3Bolts = [...internal.missiles.values()].filter(
      (m) => m.missileId === SCARAB_BUGLIGHTNING_MISSILE_ID_113C,
    )
    expect(afterTick3Bolts.length).toBeLessThan(8)
    expect(playerRec.hp).toBeLessThan(hpBeforeBurst)
  })

  it('GameInstance.stepMissiles: prevents MonUMod #17 (#195 lightunique, Activate = 3) point-blank shotgunning on ticks 1..2', () => {
    const game = new GameInstance({ seed: 199702, difficulty: 0, areaId: 62 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'LeOverlapTester',
      level: 20,
      x: 30,
      y: 30,
      areaId: 62,
    })
    const leBossId = game.spawnMonster({
      defId: 'fallen1',
      rank: 'unique',
      umodIds: [MON_UMOD.LIGHTNING],
      level: 18,
      minDmg: 0,
      maxDmg: 0,
      hp: 1000,
      maxHp: 1000,
      x: 30,
      y: 30,
      areaId: 62,
    })

    const internal = game as unknown as {
      players: Map<number, { x: number; y: number; hp: number }>
      missiles: Map<number, { missileId: number; ticksElapsed?: number }>
    }
    const playerRec = internal.players.get(pid)!
    playerRec.x = 30
    playerRec.y = 30
    const hpBefore = playerRec.hp

    // Non-lethal GetHit (600 dmg >= 50% maxHp) on LE boss spawns 8 #195 lightunique bolts at (30, 30) while boss is in GetHit recovery
    game.applyDamageToMonster(leBossId, 600, pid, 36, 'fire', 'player', { autoHit: true })
    expect([...internal.missiles.values()].filter((m) => m.missileId === 195)).toHaveLength(8)

    game.stepFrames(2)
    const boltsTick2 = [...internal.missiles.values()].filter((m) => m.missileId === 195)
    expect(boltsTick2).toHaveLength(8)
    expect(playerRec.hp).toBe(hpBefore)
  })

  it('MissileEngine.tick: enforces Activate on #234 fistoftheheavensbolt (2) and #502 death mauler (30) while preserving terrain collision', () => {
    const engine = new MissileEngine(registry)
    const paladin = makeUnit('paladin_caster', 'player')
    const undeadClose = makeUnit('undead_tick1', 'monster', { isUndead: true })
    const undeadArmed = makeUnit('undead_tick2', 'monster', { isUndead: true })

    // 1. #234 fistoftheheavensbolt (`Activate = 2`)
    const fohBolt = engine.spawnMissile({
      missileNameOrId: 234,
      sourceSkillId: 121,
      slvl: 5,
      owner: paladin,
      startX: 0,
      startY: 0,
      targetX: 200,
      targetY: 0,
      dmgPacket: {
        skillId: 121,
        attackKind: 'spell',
        srcDam: 0,
        elemType: 'mag',
        elemMin256: 50 * FIXED_ONE,
        elemMax256: 50 * FIXED_ONE,
        autoHit: true,
      },
    })!
    expect(fohBolt.record.activate).toBe(2)

    const fohTick1Pos = { x: fohBolt.x + fohBolt.vx, y: fohBolt.y + fohBolt.vy }
    // Tick 1 (`ageTicks = 1 < 2`): passes right through undeadClose without colliding
    const fohTick1 = engine.tick(
      1,
      [undeadClose],
      new Map([[undeadClose.id, fohTick1Pos]]),
    )
    expect(fohTick1.hits).toHaveLength(0)

    // Tick 2 (`ageTicks = 2 >= 2`): arms and hits undeadArmed
    const fohTick2Pos = { x: fohBolt.x + fohBolt.vx, y: fohBolt.y + fohBolt.vy }
    const fohTick2 = engine.tick(
      2,
      [undeadArmed],
      new Map([[undeadArmed.id, fohTick2Pos]]),
    )
    expect(fohTick2.hits.some((h) => h.targetId === undeadArmed.id)).toBe(true)

    // 2. #502 death mauler (`Activate = 30`): unarmed on ticks 1..29, arms on tick 30
    const engineMauler = new MissileEngine(registry)
    const maulerOwner = makeUnit('death_mauler_mon', 'monster')
    const victimPlayer = makeUnit('victim_player', 'player')
    const maulerMissile = engineMauler.spawnMissile({
      missileNameOrId: 502,
      sourceSkillId: 0,
      slvl: 1,
      owner: maulerOwner,
      startX: 0,
      startY: 0,
      targetX: 600,
      targetY: 0,
      dmgPacket: {
        skillId: 0,
        attackKind: 'missile',
        srcDam: 0,
        elemType: 'fire',
        elemMin256: 30 * FIXED_ONE,
        elemMax256: 30 * FIXED_ONE,
        autoHit: true,
      },
    })!
    expect(maulerMissile.record.activate).toBe(30)

    for (let t = 1; t <= 29; t++) {
      const nextX = maulerMissile.x + maulerMissile.vx
      const nextY = maulerMissile.y + maulerMissile.vy
      const res = engineMauler.tick(t, [victimPlayer], new Map([[victimPlayer.id, { x: nextX, y: nextY }]]))
      expect(res.hits).toHaveLength(0)
    }
    const armedX = maulerMissile.x + maulerMissile.vx
    const armedY = maulerMissile.y + maulerMissile.vy
    const resTick30 = engineMauler.tick(
      30,
      [victimPlayer],
      new Map([[victimPlayer.id, { x: armedX, y: armedY }]]),
    )
    expect(resTick30.hits.some((h) => h.targetId === victimPlayer.id)).toBe(true)

    // 3. Terrain barrier (`0x04`) still blocks and expires `#225 buglightning` on tick 1 (`ageTicks = 1 < 3`)
    const wallClose: MissileTerrainCollision = {
      isMissileBlocked(x, y, _fromX, _fromY, mask = 0x04) {
        return (mask & 0x04) !== 0 && Math.hypot(x, y) >= 2
      },
    }
    const wallEngine = new MissileEngine(registry, wallClose)
    const scarabOwner = makeUnit('scarab_mon', 'monster')
    wallEngine.spawnMissile({
      missileNameOrId: 225,
      sourceSkillId: 38,
      slvl: 10,
      owner: scarabOwner,
      startX: 0,
      startY: 0,
      targetX: 200,
      targetY: 0,
      dmgPacket: {
        skillId: 38,
        attackKind: 'spell',
        srcDam: 0,
        elemType: 'ltng',
        elemMin256: 10 * FIXED_ONE,
        elemMax256: 10 * FIXED_ONE,
        autoHit: true,
      },
    })
    wallEngine.tick(1, [], new Map())
    expect(wallEngine.getActiveMissiles().some((m) => m.record.id === 225)).toBe(false)
  })
})

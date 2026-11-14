/**
 * Issue #1989 — 1.13c Poison DoT (`STATE_POISON = 2`), `D2Common#10413` monster missile damage,
 * `GreaterMummy` (`0x6FCA843A`) range check & `#192 PrimePoisonNova`, and curative/utility potions
 * (`yps` Antidote, `wms` Thawing, `vps` Stamina).
 */

import { describe, expect, it } from 'vitest'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import {
  computeMissileElementalLength113c,
  evaluateMonsterMissileDamage113c,
  scaleMonStatsPoisonRider113c,
} from '../src/server/ai/monster-missile-damage-113c.ts'
import { GameInstance, type ServerItemEntry } from '../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../src/server/engine/stat-list.ts'

function makeBeltPotion(unitId: number, code: string, ownerId: number, slot: number): ServerItemEntry {
  return {
    unitId,
    code,
    name: code,
    quality: 2,
    level: 1,
    location: 'belt',
    x: slot,
    y: 0,
    width: 1,
    height: 1,
    areaId: 1,
    ownerId,
    bodyLoc: 0,
    storePage: 0,
    cost: 25,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 0,
    maxDurability: 0,
    quantity: 1,
    stats: new Map(),
    socketedItems: [],
  }
}

describe('issue #1989 D2Common#10413 monster missile damage & MonStats poison rider scaling', () => {
  const registry = new GameInstance({ seed: 1, areaId: 1 }).registry

  it('does NOT inherit monster physical damage when Missiles.txt SrcDamage == 0 (mummy1, unholybolt1)', () => {
    const rng = new D2Rng(1989)
    const mummy1 = registry.getMissileByName('mummy1')!
    expect(mummy1.srcDamage).toBe(0)
    expect(mummy1.eType).toBe('pois')

    const mummyEval = evaluateMonsterMissileDamage113c({
      registry,
      missile: mummy1,
      slvl: 16,
      difficulty: 0,
      monsterMinPhys: 45,
      monsterMaxPhys: 65,
      attackMode: 'A2',
      rng,
    })
    expect(mummyEval.physDamage).toBe(0)
    expect(mummyEval.element).toBe('pois')
    expect(mummyEval.elemDamage).toBeGreaterThan(0)
    expect(mummyEval.elemDurationFrames).toBe(computeMissileElementalLength113c(mummy1, 16))
    expect(mummyEval.elemDurationFrames).toBe(100)

    const mummy4 = registry.getMissileByName('mummy4')!
    expect(computeMissileElementalLength113c(mummy4, 16)).toBe(400)

    const unholyBolt = registry.getMissileByName('unholybolt1')!
    expect(unholyBolt.srcDamage).toBe(0)
    const boltEval = evaluateMonsterMissileDamage113c({
      registry,
      missile: unholyBolt,
      slvl: 16,
      difficulty: 0,
      monsterMinPhys: 50,
      monsterMaxPhys: 80,
      rng,
    })
    expect(boltEval.physDamage).toBe(0)
    expect(boltEval.element).toBe('mag')
    expect(boltEval.elemDamage).toBeGreaterThan(0)
  })

  it('respects HitShift == 0 fixed-point rows (tentaclegoo, primepoisoncloud) without << 8 inflation', () => {
    const rng = new D2Rng(42)
    const tentacleGoo = registry.getMissileByName('tentaclegoo')!
    expect(tentacleGoo.hitShift).toBe(0)
    expect(tentacleGoo.srcDamage).toBe(0)

    const gooEval = evaluateMonsterMissileDamage113c({
      registry,
      missile: tentacleGoo,
      slvl: 1,
      difficulty: 0,
      monsterMinPhys: 100,
      monsterMaxPhys: 100,
      rng,
    })
    expect(gooEval.physDamage).toBe(0)
    expect(gooEval.element).toBe('pois')
    expect(gooEval.elemDurationFrames).toBe(800)
    // EMin=11..EMax=18, HitShift=0, ELen=800 -> cumul256 = 8800..14400 -> 34..56 HP (NOT << 8 = 8800..14400 HP!)
    expect(gooEval.elemDamage).toBeGreaterThanOrEqual(34)
    expect(gooEval.elemDamage).toBeLessThanOrEqual(56)

    const primeCloud = registry.getMissileByName('primepoisoncloud')!
    expect(primeCloud.hitShift).toBe(0)
    expect(primeCloud.eLen).toBe(300)
    const cloudEval = evaluateMonsterMissileDamage113c({
      registry,
      missile: primeCloud,
      slvl: 4,
      difficulty: 0,
      monsterMinPhys: 80,
      monsterMaxPhys: 120,
      rng,
    })
    expect(cloudEval.physDamage).toBe(0)
    expect(cloudEval.element).toBe('pois')
    // ELen=300, ELevLen1=20 -> at slvl 4: 300 + 3*20 = 360 frames
    expect(cloudEval.elemDurationFrames).toBe(360)
    // EMin=10, MinELev1=5 -> at slvl 4: bitrate256 = 25, cumul256 = 25 * 360 = 9000 -> 35 HP
    expect(cloudEval.elemDamage).toBe(Math.round((25 * 360) / FIXED_ONE))
  })

  it('inherits monster physical & MonStats El1..3 riders when SrcDamage == 128 (arrow)', () => {
    const rng = new D2Rng(7)
    const arrow = registry.getMissileByName('arrow')!
    expect(arrow.srcDamage).toBe(128)

    const arrowEval = evaluateMonsterMissileDamage113c({
      registry,
      missile: arrow,
      slvl: 5,
      difficulty: 0,
      monsterMinPhys: 12,
      monsterMaxPhys: 12,
      attackMode: 'A1',
      elementalAttacks: [
        { mode: 'A1', type: 'pois', chancePct: 100, minDamage: 4, maxDamage: 4, durationFrames: 50 },
      ],
      rng,
    })
    expect(arrowEval.physDamage).toBe(12)
    expect(arrowEval.element).toBe('pois')
    // ElDur=50 -> 100 frames; bitrate256 = 4 * 10 = 40 -> cumul256 = 4000 -> 16 HP
    expect(arrowEval.elemDurationFrames).toBe(100)
    expect(arrowEval.elemDamage).toBe(Math.round((40 * 100) / FIXED_ONE))
  })

  it('scales MonStats El1..3 poison riders via 0x6FC97695 (* 10 bitrate, * 2 duration)', () => {
    const scaled = scaleMonStatsPoisonRider113c(5, 5, 50)
    expect(scaled.durationFrames).toBe(100)
    expect(scaled.minBitrate256).toBe(50)
    expect(scaled.maxBitrate256).toBe(50)
    expect(scaled.minCumulHp).toBe(Math.round(5000 / FIXED_ONE))
  })
})

describe('issue #1989 GreaterMummy AI (0x6FCA843A) & #192 PrimePoisonNova', () => {
  it('restricts GreaterMummy MissA2 poison breath to distance < 5 and fires PrimePoisonNova as 16 poison clouds', () => {
    const game = new GameInstance({ seed: 1989, areaId: 49 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'TestSorc', x: 10, y: 10, areaId: 49 })
    const radId = game.spawnMonster({ hcIdx: 229, defId: 'radament', x: 20, y: 10, areaId: 49, hp: 200, maxHp: 500 })

    const internal = game as unknown as {
      monsters: Map<
        number,
        {
          hp: number
          maxHp: number
          x: number
          y: number
          cooldown: number
          skillCooldown: number
          skills: { slot: number; skill: string; skillId: number; mode: string; level: number }[]
        }
      >
    }
    const rad = internal.monsters.get(radId)!

    // Force skill list to ONLY #192 PrimePoisonNova at distance 10 (<= 18)
    rad.skills = [{ slot: 1, skill: 'PrimePoisonNova', skillId: 192, mode: 'S1', level: 4 }]
    rad.cooldown = 0
    rad.skillCooldown = 0
    const hpBefore = rad.hp
    game.drainEvents(playerId)
    game.stepFrames(5)

    const novaEvents = game.drainEvents(playerId)
    const cloudShots = novaEvents.filter(
      (e) => e.type === 'CreateMissile' && (e as { skillId?: number }).skillId === 192,
    )
    expect(cloudShots.length).toBe(16)
    // PrimePoisonNova MUST NOT heal Radament!
    expect(rad.hp).toBe(hpBefore)

    // Now test GreaterMummy MissA2 (`mummy1..4`): with skills on cooldown at distance 10 (>= 5), it must NOT fire mummy breath
    const gameFar = new GameInstance({ seed: 1990, areaId: 49 })
    const pidFar = gameFar.connectPlayer({ charClass: 'sor', name: 'FarSorc', x: 10, y: 10, areaId: 49 })
    const mumFarId = gameFar.spawnMonster({ hcIdx: 101, defId: 'unraveler1', x: 20, y: 10, areaId: 49 })
    const mumFar = (gameFar as unknown as typeof internal).monsters.get(mumFarId)!
    mumFar.skills = []
    mumFar.cooldown = 0
    mumFar.skillCooldown = 999
    gameFar.drainEvents(pidFar)
    gameFar.stepFrames(5)
    const farShots = gameFar.drainEvents(pidFar).filter((e) => e.type === 'CreateMissile')
    expect(farShots.length).toBe(0)

    // At distance 3.5 (< 5), GreaterMummy DOES fire MissA2 (`mummy1`)!
    const gameClose = new GameInstance({ seed: 1991, areaId: 49 })
    const pidClose = gameClose.connectPlayer({ charClass: 'sor', name: 'CloseSorc', x: 10, y: 10, areaId: 49 })
    const mumCloseId = gameClose.spawnMonster({ hcIdx: 101, defId: 'unraveler1', x: 13.5, y: 10, areaId: 49 })
    const mumClose = (gameClose as unknown as typeof internal).monsters.get(mumCloseId)!
    mumClose.skills = []
    mumClose.cooldown = 0
    mumClose.skillCooldown = 999
    ;(gameClose as unknown as { rng: { rand: (n: number) => number } }).rng.rand = () => 0
    gameClose.drainEvents(pidClose)
    gameClose.stepFrames(2)
    const closeShots = gameClose.drainEvents(pidClose).filter((e) => e.type === 'CreateMissile')
    expect(closeShots.length).toBeGreaterThan(0)
  })
})

describe('issue #1989 Poison DoT ticking, 1 HP floor, single-highest-bitrate, and death purge', () => {
  it('applies pure poison missile damage as STATE_POISON (2) DoT without instant burst, clamps player at 1 HP, and respects highest bitrate', () => {
    const game = new GameInstance({ seed: 2026, areaId: 2 })
    const playerId = game.connectPlayer({
      charClass: 'sor',
      name: 'PoisonTarget',
      x: 10,
      y: 10,
      areaId: 2,
      hp: 30,
      maxHp: 100,
    })
    const monId = game.spawnMonster({ defId: 'fallen1', x: 25, y: 25, areaId: 2, aiDisabled: true })

    const internal = game as unknown as {
      players: Map<
        number,
        {
          hp: number
          hpFixed: number
          dead: boolean
          states: Set<number>
          stateTimers: Map<number, number>
          items: ServerItemEntry[]
        }
      >
      missiles: Map<number, unknown>
      playerCombat: Map<
        number,
        {
          statList: { getAccruedStat: (name: string) => number }
          stateBus: { hasState: (id: number | string) => boolean }
        }
      >
      killPlayer: (p: unknown) => void
    }

    const player = internal.players.get(playerId)!
    game.drainEvents(playerId)

    // Inject a pure poison monster missile right on top of the player: 50 poison damage over 50 frames (1 HP/frame = 256/frame)
    internal.missiles.set(9001, {
      unitId: 9001,
      missileId: 220,
      skillId: 192,
      ownerType: 'monster',
      ownerId: monId,
      areaId: 2,
      x: 10,
      y: 10,
      vx: 0,
      vy: 0,
      damage: 50,
      remainingFrames: 5,
      collideType: 3,
      size: 2,
      pierce: false,
      nextHit: false,
      nextDelay: 0,
      element: 'pois',
      physDamage: 0,
      elemDamage: 50,
      elemDurationFrames: 50,
      hitCooldowns: new Map(),
      guaranteedHit: true,
    })

    // Step 1 frame: missile hits -> 0 instant burst, STATE_POISON (2) applied, 1 frame of DoT ticks (30 -> 29 HP)
    game.stepFrames(1)
    expect(player.states.has(2)).toBe(true)
    expect(player.hp).toBeGreaterThanOrEqual(29)

    const combat = internal.playerCombat.get(playerId)!
    const strongRegen = combat.statList.getAccruedStat('hpregen')
    expect(strongRegen).toBeLessThan(0)

    // Inject a weaker poison missile (5 poison damage over 100 frames) -> must NOT overwrite stronger bitrate!
    internal.missiles.set(9002, {
      unitId: 9002,
      missileId: 220,
      skillId: 192,
      ownerType: 'monster',
      ownerId: monId,
      areaId: 2,
      x: 10,
      y: 10,
      vx: 0,
      vy: 0,
      damage: 5,
      remainingFrames: 5,
      collideType: 3,
      size: 2,
      pierce: false,
      nextHit: false,
      nextDelay: 0,
      element: 'pois',
      physDamage: 0,
      elemDamage: 5,
      elemDurationFrames: 100,
      hitCooldowns: new Map(),
      guaranteedHit: true,
    })
    game.stepFrames(1)
    expect(combat.statList.getAccruedStat('hpregen')).toBe(strongRegen)

    // Step 60 frames: total poison (50 HP) exceeds player's 30 HP, but 1.13c clamps player at 1 HP (`hpFixed == 256`), never killing!
    game.stepFrames(60)
    expect(player.dead).toBe(false)
    expect(player.hp).toBe(1)
    expect(player.hpFixed).toBe(256)
    // After 50 frames total, STATE_POISON (2) has expired
    expect(player.states.has(2)).toBe(false)
    expect(combat.stateBus.hasState(2)).toBe(false)

    // Re-apply poison and verify killPlayer purges all active states/debuffs on death
    internal.missiles.set(9003, {
      unitId: 9003,
      missileId: 220,
      skillId: 192,
      ownerType: 'monster',
      ownerId: monId,
      areaId: 2,
      x: 10,
      y: 10,
      vx: 0,
      vy: 0,
      damage: 40,
      remainingFrames: 5,
      collideType: 3,
      size: 2,
      pierce: false,
      nextHit: false,
      nextDelay: 0,
      element: 'pois',
      physDamage: 0,
      elemDamage: 40,
      elemDurationFrames: 100,
      hitCooldowns: new Map(),
      guaranteedHit: true,
    })
    game.stepFrames(1)
    expect(player.states.has(2)).toBe(true)
    internal.killPlayer(player)
    expect(player.states.has(2)).toBe(false)
    expect(combat.stateBus.hasState(2)).toBe(false)
    expect(combat.statList.getAccruedStat('hpregen')).toBe(0)
  })

  it('suppresses mercenary natural regen while poisoned, clamps merc at 1 HP in Town, and kills merc outside Town', () => {
    // 1. In Town (`areaId = 1`): merc clamps at 1 HP
    const townGame = new GameInstance({ seed: 3001, areaId: 1 })
    const townPid = townGame.connectPlayer({ charClass: 'sor', name: 'TownOwner', x: 10, y: 10, areaId: 1 })
    const townMercId = townGame.hireMercenary(townPid, {
      act: 2,
      subType: 0,
      level: 15,
      difficulty: 1,
      hp: 20,
      maxHp: 200,
      x: 11,
      y: 10,
    })
    const townInternal = townGame as unknown as {
      mercenaries: Map<
        number,
        {
          unitId: number
          hp: number
          maxHp: number
          alive: boolean
          areaId: number
          states: Set<number>
          stateTimers: Map<number, number>
        }
      >
      mercCombat: Map<
        number,
        {
          stateBus: {
            applyState: (spec: {
              stateNameOrId: number
              sourceUnitId: string
              durationFrames: number
              currentFrame: number
              stats: Record<string, number>
            }) => void
          }
        }
      >
      applyUnitState: (
        states: Set<number>,
        timers: Map<number, number>,
        unitType: 'monster',
        unitId: number,
        areaId: number,
        stateId: number,
        dur: number,
      ) => void
    }
    const townMerc = townInternal.mercenaries.get(townMercId)!
    const townMercCtx = (townGame as unknown as { mercCombatContext: (m: unknown) => { stateBus: { applyState: (s: unknown) => void } } }).mercCombatContext(townMerc)
    townMercCtx.stateBus.applyState({
      stateNameOrId: 2,
      sourceUnitId: 'mon_1',
      durationFrames: 80,
      currentFrame: 0,
      stats: { hpregen: -512 }, // -2 HP/frame
    })
    townInternal.applyUnitState(townMerc.states, townMerc.stateTimers, 'monster', townMerc.unitId, 1, 2, 80)

    townGame.stepFrames(30)
    expect(townMerc.alive).toBe(true)
    expect(townMerc.hp).toBe(1)

    // 2. Outside Town (`areaId = 2`): poison suppresses natural regen and CAN kill the mercenary
    const wildGame = new GameInstance({ seed: 3002, areaId: 2 })
    const wildPid = wildGame.connectPlayer({ charClass: 'sor', name: 'WildOwner', x: 10, y: 10, areaId: 2 })
    const wildMercId = wildGame.hireMercenary(wildPid, {
      act: 2,
      subType: 0,
      level: 15,
      difficulty: 1,
      hp: 10,
      maxHp: 200,
      x: 11,
      y: 10,
    })
    const wildInternal = wildGame as unknown as typeof townInternal
    const wildMerc = wildInternal.mercenaries.get(wildMercId)!
    const wildMercCtx = (wildGame as unknown as { mercCombatContext: (m: unknown) => { stateBus: { applyState: (s: unknown) => void } } }).mercCombatContext(wildMerc)
    wildMercCtx.stateBus.applyState({
      stateNameOrId: 2,
      sourceUnitId: 'mon_2',
      durationFrames: 80,
      currentFrame: 0,
      stats: { hpregen: -512 },
    })
    wildInternal.applyUnitState(wildMerc.states, wildMerc.stateTimers, 'monster', wildMerc.unitId, 2, 2, 80)

    wildGame.stepFrames(15)
    expect(wildMerc.alive).toBe(false)
    expect(wildMerc.hp).toBe(0)
  })
})

describe('issue #1989 curative & utility potions (yps Antidote, wms Thawing, vps Stamina)', () => {
  it('cures debuffs and stacks +750 frames (+30s) buffs on both player and mercenary', () => {
    const game = new GameInstance({ seed: 4001, areaId: 2 })
    const playerId = game.connectPlayer({
      charClass: 'sor',
      name: 'PotionTester',
      x: 10,
      y: 10,
      areaId: 2,
      hp: 80,
      maxHp: 100,
      stamina: 10,
      maxStamina: 100,
    })
    const mercId = game.hireMercenary(playerId, {
      act: 2,
      subType: 0,
      level: 15,
      difficulty: 1,
      hp: 100,
      maxHp: 200,
      x: 11,
      y: 10,
    })

    const internal = game as unknown as {
      players: Map<
        number,
        {
          unitId: number
          areaId: number
          staminaFixed: number
          staminaExhausted: boolean
          states: Set<number>
          stateTimers: Map<number, number>
          items: ServerItemEntry[]
        }
      >
      mercenaries: Map<
        number,
        {
          unitId: number
          areaId: number
          states: Set<number>
          stateTimers: Map<number, number>
        }
      >
      playerCombatContext: (p: unknown) => {
        statList: { getAccruedStat: (s: string) => number }
        stateBus: {
          applyState: (s: unknown) => void
          hasState: (id: number | string) => boolean
        }
      }
      mercCombatContext: (m: unknown) => {
        statList: { getAccruedStat: (s: string) => number }
        stateBus: {
          applyState: (s: unknown) => void
          hasState: (id: number | string) => boolean
        }
      }
      applyUnitState: (
        states: Set<number>,
        timers: Map<number, number>,
        unitType: 'player' | 'monster',
        unitId: number,
        areaId: number,
        stateId: number,
        dur: number,
      ) => void
      handleBeltUse: (p: unknown, itemId: number, useOnMerc?: boolean) => void
    }

    const player = internal.players.get(playerId)!
    const merc = internal.mercenaries.get(mercId)!
    const pCtx = internal.playerCombatContext(player)
    const mCtx = internal.mercCombatContext(merc)

    // Apply poison (2) and cold (11) + freeze (1) to player, plus stamina exhaustion
    pCtx.stateBus.applyState({
      stateNameOrId: 2,
      sourceUnitId: 'mon_1',
      durationFrames: 200,
      currentFrame: 0,
      stats: { hpregen: -256 },
    })
    internal.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, 2, 2, 200)
    internal.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, 2, 11, 200)
    internal.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, 2, 1, 200)
    player.staminaFixed = 0
    player.staminaExhausted = true

    const basePoisRes = pCtx.statList.getAccruedStat('poisonresist')
    const baseMaxPoisRes = pCtx.statList.getAccruedStat('maxpoisonresist')
    const baseColdRes = pCtx.statList.getAccruedStat('coldresist')
    const baseMaxColdRes = pCtx.statList.getAccruedStat('maxcoldresist')

    // Drink 2x Antidote ('yps'), 2x Thawing ('wms'), 2x Stamina ('vps') on player
    player.items.push(
      makeBeltPotion(5001, 'yps', playerId, 0),
      makeBeltPotion(5002, 'yps', playerId, 1),
      makeBeltPotion(5003, 'wms', playerId, 2),
      makeBeltPotion(5004, 'wms', playerId, 3),
      makeBeltPotion(5005, 'vps', playerId, 4),
      makeBeltPotion(5006, 'vps', playerId, 5),
      makeBeltPotion(5007, 'yps', playerId, 6),
      makeBeltPotion(5008, 'yps', playerId, 7),
      makeBeltPotion(5009, 'wms', playerId, 8),
    )

    internal.handleBeltUse(player, 5001, false)
    expect(player.states.has(2)).toBe(false)
    expect(pCtx.stateBus.hasState(2)).toBe(false)
    expect(player.states.has(178)).toBe(true)
    expect(player.stateTimers.get(178)).toBe(750)
    expect(pCtx.statList.getAccruedStat('poisonresist')).toBe(basePoisRes + 50)
    expect(pCtx.statList.getAccruedStat('maxpoisonresist')).toBe(baseMaxPoisRes + 10)

    internal.handleBeltUse(player, 5002, false)
    expect(player.stateTimers.get(178)).toBe(1500)

    internal.handleBeltUse(player, 5003, false)
    expect(player.states.has(1)).toBe(false)
    expect(player.states.has(11)).toBe(false)
    expect(player.states.has(179)).toBe(true)
    expect(player.stateTimers.get(179)).toBe(750)
    expect(pCtx.statList.getAccruedStat('coldresist')).toBe(baseColdRes + 50)
    expect(pCtx.statList.getAccruedStat('maxcoldresist')).toBe(baseMaxColdRes + 10)

    internal.handleBeltUse(player, 5004, false)
    expect(player.stateTimers.get(179)).toBe(1500)

    internal.handleBeltUse(player, 5005, false)
    expect(player.staminaExhausted).toBe(false)
    expect(player.staminaFixed).toBeGreaterThan(0)
    expect(player.states.has(180)).toBe(true)
    expect(player.stateTimers.get(180)).toBe(750)
    expect(pCtx.statList.getAccruedStat('staminarecoverybonus')).toBeGreaterThanOrEqual(5000)

    internal.handleBeltUse(player, 5006, false)
    expect(player.stateTimers.get(180)).toBe(1500)

    // Mercenary Antidote ('yps') & Thawing ('wms')
    mCtx.stateBus.applyState({
      stateNameOrId: 2,
      sourceUnitId: 'mon_1',
      durationFrames: 200,
      currentFrame: 0,
      stats: { hpregen: -256 },
    })
    internal.applyUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, 2, 2, 200)
    internal.applyUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, 2, 11, 200)
    const mercBasePois = mCtx.statList.getAccruedStat('poisonresist')
    const mercBaseCold = mCtx.statList.getAccruedStat('coldresist')

    internal.handleBeltUse(player, 5007, true)
    expect(merc.states.has(2)).toBe(false)
    expect(mCtx.stateBus.hasState(2)).toBe(false)
    expect(merc.states.has(178)).toBe(true)
    expect(merc.stateTimers.get(178)).toBe(750)
    expect(mCtx.statList.getAccruedStat('poisonresist')).toBe(mercBasePois + 50)
    expect(mCtx.statList.getAccruedStat('maxpoisonresist')).toBe(10)

    internal.handleBeltUse(player, 5008, true)
    expect(merc.stateTimers.get(178)).toBe(1500)

    internal.handleBeltUse(player, 5009, true)
    expect(merc.states.has(11)).toBe(false)
    expect(merc.states.has(179)).toBe(true)
    expect(merc.stateTimers.get(179)).toBe(750)
    expect(mCtx.statList.getAccruedStat('coldresist')).toBe(mercBaseCold + 50)
    expect(mCtx.statList.getAccruedStat('maxcoldresist')).toBe(10)
  })
})

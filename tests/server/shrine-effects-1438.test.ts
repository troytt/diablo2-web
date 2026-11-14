/**
 * Issue #1438 — 1.13c Shrine effect dispatch parity (`D2Game.dll` `0x6fc8da00` & `0x6fd1a5f8`).
 *
 * Verifies every `Shrines.txt` `Code 0..22` effect handler against the 24-entry
 * `D2Game.dll` dispatch table at `0x6fd1a5f8` (`count = 24` at `0x6fd27d4c`).
 */
import { describe, expect, it } from 'vitest'
import { CANONICAL_113C_SHRINES } from '../../src/common/world/objects-meta.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'

interface TestPlayer {
  unitId: number
  name: string
  level: number
  hp: number
  maxHp: number
  hpFixed: number
  maxHpFixed: number
  mana: number
  maxMana: number
  manaFixed: number
  maxManaFixed: number
  stamina: number
  maxStamina: number
  staminaFixed: number
  maxStaminaFixed: number
  staminaExhausted: boolean
  states: Set<number>
  stateTimers: Map<number, number>
  items: Array<Record<string, unknown>>
}

interface TestMonster {
  unitId: number
  hcIdx: number
  defId: string
  rank: string
  isBoss: boolean
  level: number
  hp: number
  maxHp: number
  baseXp: number
  modifiers: readonly string[]
  umodIds: readonly number[]
}

function getInternal(game: GameInstance): {
  players: Map<number, TestPlayer>
  monsters: Map<number, TestMonster>
  objects: Map<number, { mode: number; shrineType: number; shrineResetFrame: number }>
  missiles: Map<number, { missileId: number; x: number; y: number; vx: number; vy: number; remainingFrames: number }>
  playerCombatContext: (player: TestPlayer) => {
    statList: {
      getModifierBonus: (stat: string | number) => number
      getAccruedStat: (stat: string | number) => number
    }
  }
} {
  return game as unknown as ReturnType<typeof getInternal>
}

describe('issue #1438 D2Game 0x6fd1a5f8 shrine effect table parity', () => {
  it('bakes exact Shrines.txt Arg0/Arg1/Duration/ResetTime/Phrase and 0x6fd1a5f8 statId/stateId for Code 0..22', () => {
    expect(Object.keys(CANONICAL_113C_SHRINES)).toHaveLength(23)
    expect(CANONICAL_113C_SHRINES[1]).toMatchObject({
      name: 'Refilling Shrine',
      arg0: 100,
      arg1: 100,
      durationFrames: 0,
      resetTimeMinutes: 2,
      phrase: 'All Stats refilled',
      statId: -1,
      stateId: 0,
    })
    expect(CANONICAL_113C_SHRINES[2]).toMatchObject({
      name: 'Health Shrine',
      arg0: 200,
      arg1: 400,
      durationFrames: 0,
      resetTimeMinutes: 5,
      phrase: 'All your wounds are healed',
      statId: -1,
      stateId: 0,
    })
    expect(CANONICAL_113C_SHRINES[4]).toMatchObject({
      name: 'Health Exchange Shrine',
      arg0: 50,
      arg1: 500,
      durationFrames: 0,
      resetTimeMinutes: 0,
      phrase: 'Life into Mana',
      statId: -1,
      stateId: 0,
    })
    expect(CANONICAL_113C_SHRINES[5]).toMatchObject({
      name: 'Mana Exchange Shrine',
      arg0: 50,
      arg1: 500,
      durationFrames: 0,
      resetTimeMinutes: 0,
      phrase: 'Mana into Life',
      statId: -1,
      stateId: 0,
    })
    expect(CANONICAL_113C_SHRINES[14]).toMatchObject({
      name: 'Stamina Shrine',
      arg0: 200,
      arg1: 0,
      durationFrames: 4800,
      resetTimeMinutes: 5,
      phrase: 'Run like the wind',
      statId: 162,
      stateId: 136,
    })
    expect(CANONICAL_113C_SHRINES[15]).toMatchObject({
      name: 'Experience Shrine',
      arg0: 50,
      arg1: 50,
      durationFrames: 3600,
      resetTimeMinutes: 0,
      phrase: 'Wisdom is its own reward',
      statId: 85,
      stateId: 137,
    })
    expect(CANONICAL_113C_SHRINES[19]).toMatchObject({
      name: 'Fire Shrine',
      arg0: 50,
      arg1: 2000,
      durationFrames: 0,
      resetTimeMinutes: 0,
      phrase: 'Burned by the Spirits',
      statId: -1,
      stateId: 0,
    })
    expect(CANONICAL_113C_SHRINES[21]).toMatchObject({
      name: 'Exploding Shrine',
      arg0: 5,
      arg1: 10,
      durationFrames: 0,
      resetTimeMinutes: 0,
      phrase: 'Boom',
      statId: -1,
      stateId: 0,
    })
    expect(CANONICAL_113C_SHRINES[22]).toMatchObject({
      name: 'Poison Shrine',
      arg0: 5,
      arg1: 10,
      durationFrames: 0,
      resetTimeMinutes: 0,
      phrase: 'Choking fumes',
      statId: -1,
      stateId: 0,
    })
  })

  it('Code 1 Refilling Shrine (0x6fc89c00) and Code 0 fallback restore 100% HP and Mana without modifying Stamina', () => {
    for (const code of [0, 1]) {
      const game = new GameInstance({ seed: 14380 + code, areaId: 1 })
      const playerId = game.connectPlayer({ charClass: 'sor', name: 'Hero', x: 50, y: 50, areaId: 1 })
      const internal = getInternal(game)
      const player = internal.players.get(playerId)!
      player.hpFixed = 5 * FIXED_ONE
      player.hp = 5
      player.manaFixed = 3 * FIXED_ONE
      player.mana = 3
      player.staminaFixed = 7 * FIXED_ONE
      player.stamina = 7

      const shrineId = game.spawnObject({
        classId: 2,
        x: 50,
        y: 50,
        areaId: 1,
        isShrine: true,
        shrineType: code,
      })
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
      game.stepFrames(1)

      expect(player.hpFixed).toBe(player.maxHpFixed)
      expect(player.hp).toBe(player.maxHp)
      expect(player.manaFixed).toBe(player.maxManaFixed)
      expect(player.mana).toBe(player.maxMana)
      // 0x6fc89c00 only writes STAT_HITPOINTS (6) and STAT_MANA (8), never STAT_STAMINA (10).
      expect(player.stamina).toBeLessThan(player.maxStamina)
    }
  })

  it('Code 2 Health Shrine (0x6fc898a0) restores 100% full life (not half life) and Code 3 Mana Shrine (0x6fc89860) restores 100% full mana', () => {
    const game = new GameInstance({ seed: 14382, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'Barb', x: 50, y: 50, areaId: 1 })
    const internal = getInternal(game)
    const player = internal.players.get(playerId)!
    player.hpFixed = FIXED_ONE
    player.hp = 1
    player.manaFixed = FIXED_ONE
    player.mana = 1

    const healthShrineId = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 2,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: healthShrineId })
    game.stepFrames(1)
    expect(player.hpFixed).toBe(player.maxHpFixed)
    expect(player.hp).toBe(player.maxHp)
    expect(player.mana).toBe(1)

    const manaShrineId = game.spawnObject({
      classId: 2,
      x: 51,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 3,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: manaShrineId })
    game.stepFrames(1)
    expect(player.manaFixed).toBe(player.maxManaFixed)
    expect(player.mana).toBe(player.maxMana)
  })

  it('Code 4 Health Exchange (0x6fc89800) takes 50% of whole HP and adds 500% (5x) to Mana', () => {
    const game = new GameInstance({ seed: 14384, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'ExchH', x: 50, y: 50, areaId: 1 })
    const internal = getInternal(game)
    const player = internal.players.get(playerId)!
    player.maxHp = 200
    player.maxHpFixed = 200 * FIXED_ONE
    player.hp = 40
    player.hpFixed = 40 * FIXED_ONE
    player.maxMana = 300
    player.maxManaFixed = 300 * FIXED_ONE
    player.mana = 10
    player.manaFixed = 10 * FIXED_ONE

    const shrineId = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 4,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)

    // 50% of 40 HP = 20 HP taken -> 20 HP remaining; 20 * 500% = +100 Mana -> 110 Mana
    expect(Math.floor(player.hpFixed / FIXED_ONE)).toBe(20)
    expect(player.mana).toBe(110)
    expect(internal.objects.get(shrineId)!.shrineResetFrame).toBe(0)
  })

  it('Code 5 Mana Exchange (0x6fc897a0) takes 50% of fixed Mana and adds 500% (5x) to HP', () => {
    const game = new GameInstance({ seed: 14385, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'ExchM', x: 50, y: 50, areaId: 1 })
    const internal = getInternal(game)
    const player = internal.players.get(playerId)!
    player.maxHp = 300
    player.maxHpFixed = 300 * FIXED_ONE
    player.hp = 20
    player.hpFixed = 20 * FIXED_ONE
    player.maxMana = 200
    player.maxManaFixed = 200 * FIXED_ONE
    player.mana = 30
    player.manaFixed = 30 * FIXED_ONE

    const shrineId = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 5,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)

    // 50% of 30 Mana = 15 Mana taken -> 15 Mana remaining; 15 * 500% = +75 HP -> 95 HP
    expect(player.mana).toBe(15)
    expect(Math.floor(player.hpFixed / FIXED_ONE)).toBe(95)
    expect(internal.objects.get(shrineId)!.shrineResetFrame).toBe(0)
  })

  it.each([
    { code: 6, stateId: 128, duration: 2400, statKey: 'skill_armor_percent', expectedBonus: 100 },
    { code: 7, stateId: 129, duration: 2400, statKey: 'damagepercent', expectedBonus: 200 },
    { code: 8, stateId: 131, duration: 3600, statKey: 'fireresist', expectedBonus: 75 },
    { code: 9, stateId: 132, duration: 3600, statKey: 'coldresist', expectedBonus: 75 },
    { code: 10, stateId: 130, duration: 3600, statKey: 'lightresist', expectedBonus: 75 },
    { code: 11, stateId: 133, duration: 3600, statKey: 'poisonresist', expectedBonus: 75 },
    { code: 12, stateId: 134, duration: 2400, statKey: 'item_allskills', expectedBonus: 2 },
    { code: 13, stateId: 135, duration: 2400, statKey: 'manarecoverybonus', expectedBonus: 400 },
    { code: 14, stateId: 136, duration: 4800, statKey: 'skill_staminapercent', expectedBonus: 200 },
    { code: 15, stateId: 137, duration: 3600, statKey: 'item_addexperience', expectedBonus: 50 },
  ])(
    'Code $code booster shrine applies state $stateId for $duration frames with $statKey = +$expectedBonus',
    ({ code, stateId, duration, statKey, expectedBonus }) => {
      const game = new GameInstance({ seed: 143800 + code, areaId: 1 })
      const playerId = game.connectPlayer({ charClass: 'pal', name: 'Booster', x: 50, y: 50, areaId: 1 })
      const internal = getInternal(game)
      const player = internal.players.get(playerId)!
      player.staminaFixed = 2 * FIXED_ONE
      player.stamina = 2

      const shrineId = game.spawnObject({
        classId: 2,
        x: 50,
        y: 50,
        areaId: 1,
        isShrine: true,
        shrineType: code,
      })
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
      game.stepFrames(1)

      expect(player.states.has(stateId)).toBe(true)
      expect(player.stateTimers.get(stateId)).toBe(duration - 1)
      const statList = internal.playerCombatContext(player).statList
      expect(statList.getModifierBonus(statKey)).toBe(expectedBonus)
      if (code === 14) {
        // 0x6fc8ac30 + 0x6FD895D0 (op = 1: skill_staminapercent = +200% -> accrued maxstamina = 3x base):
        // refills staminaFixed to accrued maxstamina and sets staminarecoverybonus = 1000.
        expect(player.staminaFixed).toBe(statList.getAccruedStat('maxstamina'))
        expect(player.stamina).toBe(player.maxStamina)
        expect(statList.getModifierBonus('staminarecoverybonus')).toBe(1000)
      }
    },
  )

  it('clears previous shrine state (0x6fc8a960) when activating a different booster shrine', () => {
    const game = new GameInstance({ seed: 14386, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'SwapBuff', x: 50, y: 50, areaId: 1 })
    const internal = getInternal(game)
    const player = internal.players.get(playerId)!

    const armorShrine = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 6,
    })
    const skillShrine = game.spawnObject({
      classId: 2,
      x: 51,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 12,
    })

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: armorShrine })
    game.stepFrames(1)
    expect(player.states.has(128)).toBe(true)

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: skillShrine })
    game.stepFrames(1)
    expect(player.states.has(128)).toBe(false)
    expect(player.states.has(134)).toBe(true)
    expect(internal.playerCombatContext(player).statList.getModifierBonus('skill_armor_percent')).toBe(0)
    expect(internal.playerCombatContext(player).statList.getModifierBonus('item_allskills')).toBe(2)
  })

  it('Code 16 Enirhs Shrine (0x6fc89770) reverses player name and does NOT refill HP, Mana, or Stamina', () => {
    const game = new GameInstance({ seed: 143816, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'ama', name: 'Deckard', x: 50, y: 50, areaId: 1 })
    const internal = getInternal(game)
    const player = internal.players.get(playerId)!
    player.hpFixed = 4 * FIXED_ONE
    player.hp = 4
    player.manaFixed = 3 * FIXED_ONE
    player.mana = 3
    player.staminaFixed = 2 * FIXED_ONE
    player.stamina = 2

    const shrineId = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 16,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)

    expect(player.name).toBe('drakceD')
    expect(player.hp).toBe(4)
    expect(player.mana).toBe(3)
    expect(player.stamina).toBe(2)
  })

  it('Code 18 Gem Shrine (0x6fc8b430) skips Perfect gems (BetterGem == non) to upgrade a non-perfect gem, or drops a chipped gem when only Perfect gems are carried', () => {
    const game = new GameInstance({ seed: 143818, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Miner', x: 50, y: 50, areaId: 1 })
    const internal = getInternal(game)
    const player = internal.players.get(playerId)!

    const perfectRuby = {
      unitId: 9101,
      code: 'gpr',
      name: 'Perfect Ruby',
      quality: 0,
      level: 1,
      location: 'inventory',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      areaId: 1,
      ownerId: playerId,
      bodyLoc: 0,
      storePage: 0,
      cost: 0,
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
    const flawlessSapphire = {
      ...perfectRuby,
      unitId: 9102,
      code: 'glb',
      name: 'Flawless Sapphire',
      x: 1,
    }
    player.items.push(perfectRuby, flawlessSapphire)

    const shrine1 = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 18,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrine1 })
    game.stepFrames(1)

    // Perfect Ruby stays untouched, Flawless Sapphire upgrades to Perfect Sapphire (gpb)
    expect(perfectRuby.code).toBe('gpr')
    expect(flawlessSapphire.code).toBe('gpb')
    expect(game.getGroundItems()).toHaveLength(0)

    // Second Gem Shrine when inventory only has Perfect gems -> drops a chipped gem (0x6fc8b554)
    const shrine2 = game.spawnObject({
      classId: 2,
      x: 51,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 18,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrine2 })
    game.stepFrames(1)

    expect(game.getGroundItems()).toHaveLength(1)
    expect(['gcw', 'gcr', 'gcg', 'gcb', 'gcy', 'gcv']).toContain(
      game.getGroundItems()[0]!.code.toLowerCase(),
    )
  })

  it('Code 19 Fire Shrine (0x6fc8c900) cuts current HP of nearby players and monsters within radius 14 by 50% (min 1 HP) and launches fireball missiles (62)', () => {
    const game = new GameInstance({ seed: 143819, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'Pyro', x: 50, y: 50, areaId: 2 })
    const internal = getInternal(game)
    const player = internal.players.get(playerId)!
    player.hp = 60
    player.hpFixed = 60 * FIXED_ONE

    const nearMonId = game.spawnMonster({ defId: 'fallen1', x: 54, y: 50, areaId: 2, hp: 40, maxHp: 40 })
    const farMonId = game.spawnMonster({ defId: 'fallen1', x: 130, y: 130, areaId: 2, hp: 40, maxHp: 40 })
    const nearMon = internal.monsters.get(nearMonId)!
    const farMon = internal.monsters.get(farMonId)!

    const shrineId = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 2,
      isShrine: true,
      shrineType: 19,
    })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)

    expect(player.hp).toBe(30)
    expect(player.hpFixed).toBe(30 * FIXED_ONE)
    expect(nearMon.hp).toBe(20)
    expect(farMon.hp).toBe(40)

    const events = game.drainEvents(playerId)
    const fireballEvents = events.filter(
      (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 62,
    )
    expect(fireballEvents.length).toBe(36)
  })

  it('Code 20 Monster Shrine (0x6fc8b8a0) upgrades the nearest normal monster in place to Champion or Unique without spawning a new fallen1', () => {
    const game = new GameInstance({ seed: 143820, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hunter', x: 50, y: 50, areaId: 2 })
    const internal = getInternal(game)

    const nearId = game.spawnMonster({ defId: 'zombie1', x: 53, y: 50, areaId: 2 })
    const farId = game.spawnMonster({ defId: 'zombie1', x: 75, y: 75, areaId: 2 })
    const nearBefore = internal.monsters.get(nearId)!
    const origMaxHp = nearBefore.maxHp
    const origLevel = nearBefore.level
    const monsterCountBefore = internal.monsters.size

    const shrineId = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 2,
      isShrine: true,
      shrineType: 20,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)

    // Never spawns an extra fallen1
    expect(internal.monsters.size).toBe(monsterCountBefore)
    expect(['champion', 'unique']).toContain(nearBefore.rank)
    expect(nearBefore.maxHp).toBeGreaterThan(origMaxHp)
    expect(nearBefore.hp).toBe(nearBefore.maxHp)
    expect(nearBefore.level).toBeGreaterThan(origLevel)
    expect(nearBefore.modifiers.length).toBeGreaterThan(0)
    expect(internal.monsters.get(farId)!.rank).toBe('normal')
  })

  it('Code 21 Exploding Shrine (0x6fc8c580) drops 5..9 opm potions and spawns 6 explosivepotion (45) missiles without direct player damage', () => {
    const game = new GameInstance({ seed: 143821, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'Bomber', x: 50, y: 50, areaId: 2 })
    const internal = getInternal(game)
    const player = internal.players.get(playerId)!
    const fullHpFixed = player.hpFixed

    const shrineId = game.spawnObject({
      classId: 2,
      x: 52,
      y: 50,
      areaId: 2,
      isShrine: true,
      shrineType: 21,
    })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)

    expect(player.hpFixed).toBe(fullHpFixed)
    const groundItems = game.getGroundItems()
    expect(groundItems.length).toBeGreaterThanOrEqual(5)
    expect(groundItems.length).toBeLessThanOrEqual(9)
    for (const item of groundItems) {
      expect(item.code.toLowerCase()).toBe('opm')
    }
    const events = game.drainEvents(playerId)
    const missiles = events.filter(
      (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 45,
    )
    expect(missiles).toHaveLength(6)
  })

  it('Code 22 Poison Shrine (0x6fc8c200) drops 5..9 gpm potions and spawns 6 chokinggaspoition (48) missiles without directly poisoning the player', () => {
    const game = new GameInstance({ seed: 143822, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'nec', name: 'Chemist', x: 50, y: 50, areaId: 2 })
    const internal = getInternal(game)
    const player = internal.players.get(playerId)!

    const shrineId = game.spawnObject({
      classId: 2,
      x: 52,
      y: 50,
      areaId: 2,
      isShrine: true,
      shrineType: 22,
    })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)

    expect(player.states.has(2)).toBe(false)
    const groundItems = game.getGroundItems()
    expect(groundItems.length).toBeGreaterThanOrEqual(5)
    expect(groundItems.length).toBeLessThanOrEqual(9)
    for (const item of groundItems) {
      expect(item.code.toLowerCase()).toBe('gpm')
    }
    const events = game.drainEvents(playerId)
    const missiles = events.filter(
      (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 48,
    )
    expect(missiles).toHaveLength(6)
  })
})

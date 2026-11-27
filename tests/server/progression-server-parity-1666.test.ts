import { describe, expect, it } from 'vitest'
import { CHAR_STATS_SCALING_113C, FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import { computePlayerVitalTotals113c, GameEngine } from '../../src/server/engine/game-engine.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { CANONICAL_CHARSTATS } from '../../src/common/units/classes.ts'

describe('1.13c Progression Server Parity (#1666, #1667, #1669, #1671, #1672..#1677)', () => {
  it('#1674: Barbarian staminaPerVitality is 4 in CHAR_STATS_SCALING_113C (CharStats.txt)', () => {
    expect(CHAR_STATS_SCALING_113C.bar?.staminaPerVitality).toBe(4)
  })

  it('#1673: GameEngine combines per-level and per-stat-point vital gains in 1/256 fixed-point without premature integer truncation', () => {
    // Necromancer: baseLife=45, lifePerLevel=1.5, lifePerVitality=2
    const necStats = CANONICAL_CHARSTATS.nec
    // Level 2 -> +1.5 life -> floor(45 + 1.5) = 46
    expect(computePlayerVitalTotals113c(necStats, 2, 0, 0).maxHp).toBe(46)
    // Level 3 -> +3.0 total life -> floor(45 + 3.0) = 48 (NOT 46 + 1 = 47!)
    expect(computePlayerVitalTotals113c(necStats, 3, 0, 0).maxHp).toBe(48)

    const engine = new GameEngine('nec')
    expect(engine.world.player.maxHp).toBe(45)
    // Grant enough XP for level 2 (500 XP)
    engine.grantExperience(500)
    expect(engine.world.player.level).toBe(2)
    expect(engine.world.player.maxHp).toBe(46)
    // Grant enough XP for level 3 (+1000 XP -> 1500 XP)
    engine.grantExperience(1000)
    expect(engine.world.player.level).toBe(3)
    expect(engine.world.player.maxHp).toBe(48)
  })

  it('#1676: GameInstance.connectPlayer without .d2s derives level-scaled statPts, newSkills, and 1/256 pools', () => {
    const instance = new GameInstance({ seed: 1676, areaId: 1 })
    const pid = instance.connectPlayer({
      name: 'BoostedSorc',
      charClass: 'sor',
      level: 10,
    })
    const g = instance as unknown as Record<string, any>
    const p1 = g.players.get(pid)
    // Level 10 without .d2s -> 9 levels gained -> 45 statPts, 9 newSkills
    expect(p1.statPts).toBe(45)
    expect(p1.newSkills).toBe(9)
    // Sorc baseLife=40, lifePerLevel=1 -> 49 * 256
    expect(p1.maxHpFixed).toBe(49 * FIXED_ONE)
    expect(p1.hp).toBe(49)
    // Sorc baseMana=35, manaPerLevel=2 -> (35 + 18) * 256 = 53 * 256
    expect(p1.maxManaFixed).toBe(53 * FIXED_ONE)
    expect(p1.mana).toBe(53)
  })

  it('#1666: GameInstance.handleAllocateStat adds incremental 1/256 gain to current pools without full refill', () => {
    const instance = new GameInstance({ seed: 1666, areaId: 1 })
    const pid = instance.connectPlayer({
      name: 'StatAllocPal',
      charClass: 'pal',
      level: 5,
    })
    const g = instance as unknown as Record<string, any>
    const player = g.players.get(pid)
    // Damage player's HP, Mana, Stamina to partial values
    player.hpFixed = 10 * FIXED_ONE
    player.hp = 10
    player.manaFixed = 5 * FIXED_ONE
    player.mana = 5
    player.staminaFixed = 8 * FIXED_ONE
    player.stamina = 8
    player.staminaExhausted = true

    const prevMaxHpFixed = player.maxHpFixed
    // Allocate 1 point to Vitality (statId = 3): Paladin gets +3 Life (+768 fixed) and +1 Stamina (+256 fixed)
    g.processPlayerCommand(player, {
      type: 'AllocateStat',
      statId: 3,
      points: 1,
    })
    expect(player.maxHpFixed).toBe(prevMaxHpFixed + 3 * FIXED_ONE)
    expect(player.hpFixed).toBe(13 * FIXED_ONE) // 10 + 3, NOT full refill!
    expect(player.staminaFixed).toBe(9 * FIXED_ONE) // 8 + 1, NOT full refill!
    expect(player.staminaExhausted).toBe(true) // Not cleared by AllocateStat!
  })

  it('#1667 & #1675: UnitStatList ownerType/charClass and itemStatList accrue item Vita/Enr, flat maxhp/maxmana, %maxhp/%maxmana, and per-level pools', () => {
    const instance = new GameInstance({ seed: 1667, areaId: 1 })
    const pid = instance.connectPlayer({
      name: 'ItemPoolBarb',
      charClass: 'bar',
      level: 20,
    })
    const g = instance as unknown as Record<string, any>
    const player = g.players.get(pid)
    const baseMaxHpFixed = player.maxHpFixed
    // Equip a ring with +10 Vitality (stat 3), +20 Max Life (stat 7 = 20 * 256), and +10% Max Life (stat 76)
    player.items.push({
      unitId: 9001,
      code: 'rin',
      name: 'Vitality Ring',
      baseType: 'ring',
      location: 'equipped',
      bodyLoc: 6,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      areaId: 1,
      ownerId: player.unitId,
      level: 20,
      quality: 4,
      identified: true,
      ethereal: false,
      socketed: false,
      sockets: 0,
      defense: 0,
      durability: 0,
      maxDurability: 0,
      quantity: 1,
      reqStr: 0,
      reqDex: 0,
      reqLvl: 1,
      properties: [],
      stats: new Map([
        [3, 10], // +10 Vitality (on itemStatList -> +40 Life for Barb!)
        [7, 20 * FIXED_ONE], // +20 flat Life (256-fixed)
        [76, 10], // +10% Max Life
      ]),
      socketedItems: [],
    })
    const accruedMaxHpFixed = g.getPlayerAccruedMaxHpFixed(player)
    // In 1.13c, %maxhp (76) scales (baseMaxHpFixed + flatItemMaxHpFixed) BEFORE item Vitality * 4 is added:
    const expectedBeforeItemVit = Math.floor(((baseMaxHpFixed + 20 * FIXED_ONE) * 110) / 100)
    const expectedTotal = expectedBeforeItemVit + 10 * 4 * FIXED_ONE
    expect(accruedMaxHpFixed).toBe(expectedTotal)
  })

  it('#1669: ClickButton 0x13 (WithdrawGold) and 0x14 (DepositGold) transfer gold with 1.13c caps', () => {
    const instance = new GameInstance({ seed: 1669, areaId: 1 })
    const pid = instance.connectPlayer({
      name: 'GoldBanker',
      charClass: 'ama',
      level: 10,
      gold: 50000,
    })
    const g = instance as unknown as Record<string, any>
    const player = g.players.get(pid)
    player.goldBank = 20000
    // Deposit 30,000 gold from inventory to stash (0x14, arg = (30000 >>> 16) | ((30000 & 0xffff) << 16))
    const depositAmount = 30000
    const depositArg = ((depositAmount >>> 16) & 0xffff) | ((depositAmount & 0xffff) << 16)
    g.processPlayerCommand(player, {
      type: 'ClickButton',
      buttonId: 0x14,
      complement: depositArg >>> 0,
    })
    expect(player.gold).toBe(20000)
    expect(player.goldBank).toBe(50000)

    // Withdraw 15,000 gold from stash to inventory (0x13)
    const withdrawAmount = 15000
    const withdrawArg = ((withdrawAmount >>> 16) & 0xffff) | ((withdrawAmount & 0xffff) << 16)
    g.processPlayerCommand(player, {
      type: 'ClickButton',
      buttonId: 0x13,
      complement: withdrawArg >>> 0,
    })
    expect(player.gold).toBe(35000)
    expect(player.goldBank).toBe(35000)
  })

  it('#1671: stepMercenaries ticks natural mercenary HP regeneration (maxHp*256/2000 + stat 74 per frame)', () => {
    const instance = new GameInstance({ seed: 1671, areaId: 1 })
    const pid = instance.connectPlayer({
      name: 'MercMaster',
      charClass: 'pal',
      level: 20,
    })
    const g = instance as unknown as Record<string, any>
    const player = g.players.get(pid)
    // Move player out of town so stepMercenaries runs active combat/regen loop
    player.areaId = 2
    const mercMap = g.mercenaries as Map<number, any>
    mercMap.set(5001, {
      unitId: 5001,
      ownerPlayerId: player.unitId,
      areaId: 2,
      hp: 100,
      maxHp: 1000,
      alive: true,
      regenCarry256: 0,
      x: player.x,
      y: player.y,
      cooldown: 10,
      equipment: [],
      state: 'idle',
      name: 'Merc',
      hcIdx: 271,
      level: 20,
      exp: 0,
      str: 80,
      dex: 60,
      minDmg: 10,
      maxDmg: 20,
      ar: 500,
      defense: 200,
      resistances: { fire: 30, cold: 30, light: 30, poison: 30 },
    })
    // At maxHp = 1000, natural regen per frame = floor(1000 * 256 / 2000) = 128 (0.5 HP/frame).
    // After 2 frames, merc should gain +1 HP (101).
    g.stepMercenaries()
    expect(mercMap.get(5001)!.hp).toBe(100)
    g.stepMercenaries()
    expect(mercMap.get(5001)!.hp).toBe(101)
  })

  it('#1672 & #1677: grantExperience does not revive dead players on level-up and syncs Stat 30 (nextexp)', () => {
    const instance = new GameInstance({ seed: 1672, areaId: 1 })
    const pid = instance.connectPlayer({
      name: 'DeadLeveler',
      charClass: 'sor',
      level: 1,
    })
    const g = instance as unknown as Record<string, any>
    const player = g.players.get(pid)
    // Simulate dead player (hpFixed = 0, dead = true) gaining level-up XP
    player.hpFixed = 0
    player.hp = 0
    player.dead = true
    g.outbox.set(player.unitId, [])

    g.grantExperience(player, 600)

    expect(player.level).toBe(2)
    // Must NOT refill HP when dead / hpFixed <= 0!
    expect(player.hpFixed).toBe(0)
    expect(player.hp).toBe(0)
    // Mana and Stamina still refill
    expect(player.mana).toBeGreaterThan(0)

    // Verify Stat 30 (nextexp) was emitted
    const events = g.outbox.get(player.unitId) as Array<any>
    const nextExpUpdate = events.find(
      (ev) => ev?.type === 'UnitStatUpdate' && ev?.statId === 30,
    )
    expect(nextExpUpdate).toBeDefined()
  })
})

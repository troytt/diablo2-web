import { describe, expect, it } from 'vitest'
import {
  computeBlockRate113c,
  evaluateAvoidanceAndBlock,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { resolveArmorBlock113c } from '../../src/common/units/char-anim-speed.ts'
import { CANONICAL_CHARSTATS } from '../../src/common/units/classes.ts'
import { chanceToBlock } from '../../src/client/ui-model/combat-stats.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { MONMODE_BLOCK } from '../../src/common/path/types.ts'

function makeUnit(params: {
  unitType: 'player' | 'monster' | 'mercenary' | 'minion'
  charClass?: string
  hasShield?: boolean
  isMoving?: boolean
  isWalking?: boolean
  isRunning?: boolean
  isDualClaw?: boolean
  stats?: Record<string, number>
}): CombatUnitContext {
  const statList = new UnitStatList()
  for (const [k, v] of Object.entries(params.stats ?? {})) {
    statList.setBaseStat(k, v)
  }
  const stateBus = new StateBus(statList)
  return {
    id: `${params.unitType}_1`,
    name: params.charClass ?? params.unitType,
    ...(params.charClass !== undefined ? { charClass: params.charClass } : {}),
    unitType: params.unitType,
    statList,
    stateBus,
    ...(params.hasShield !== undefined ? { hasShield: params.hasShield } : {}),
    ...(params.isMoving !== undefined ? { isMoving: params.isMoving } : {}),
    ...(params.isWalking !== undefined ? { isWalking: params.isWalking } : {}),
    ...(params.isRunning !== undefined ? { isRunning: params.isRunning } : {}),
    ...(params.isDualClaw !== undefined ? { isDualClaw: params.isDualClaw } : {}),
  }
}

describe('Issue #1416: 1.13c D2Common#10212 block rate, running 1/3 penalty, monster block & BL mode', () => {
  it('resolves canonical Armor.txt shield base block (D2Common.dll 0x6FD6FF40)', () => {
    expect(resolveArmorBlock113c('buc')).toBe(0) // Buckler: Armor.txt block = 0
    expect(resolveArmorBlock113c('sml')).toBe(5) // Small Shield: Armor.txt block = 5
    expect(resolveArmorBlock113c('lrg')).toBe(12) // Large Shield: Armor.txt block = 12
    expect(resolveArmorBlock113c('kit')).toBe(8) // Kite Shield: Armor.txt block = 8
    expect(resolveArmorBlock113c('tow')).toBe(24) // Tower Shield: Armor.txt block = 24
    expect(resolveArmorBlock113c('uit')).toBe(22) // Monarch: Armor.txt block = 22
    expect(resolveArmorBlock113c('pab')).toBe(30) // Sacred Targe: Armor.txt block = 30
  })

  it('computes Paladin clvl=30 DEX=75 with Kite Shield (block=8) -> 38% and DEX=15 -> 0% (D2Common#10212 0x6FD81D20)', () => {
    const kiteBlock = resolveArmorBlock113c('kit')
    expect(kiteBlock).toBe(8)

    const pal75 = makeUnit({
      unitType: 'player',
      charClass: 'pal',
      hasShield: true,
      stats: {
        level: 30,
        dexterity: 75,
        toblock: kiteBlock,
      },
    })
    // ((8 + 30) * (75 - 15)) / (2 * 30) = (38 * 60) / 60 = 38%
    expect(computeBlockRate113c(pal75)).toBe(38)

    const pal15 = makeUnit({
      unitType: 'player',
      charClass: 'pal',
      hasShield: true,
      stats: {
        level: 30,
        dexterity: 15,
        toblock: kiteBlock,
      },
    })
    expect(computeBlockRate113c(pal15)).toBe(0)

    const palNoShield = makeUnit({
      unitType: 'player',
      charClass: 'pal',
      hasShield: false,
      stats: {
        level: 30,
        dexterity: 150,
        toblock: 50,
      },
    })
    expect(computeBlockRate113c(palNoShield)).toBe(0)
  })

  it('applies exact CharStats.txt BlockFactor for all 7 classes without pre-clamping (armorBlock + BlockFactor + toblock) to 75', () => {
    const expectedFactors: Record<string, number> = {
      ama: 25,
      sor: 20,
      nec: 20,
      pal: 30,
      bar: 25,
      dru: 20,
      ass: 25,
    }
    for (const [code, factor] of Object.entries(expectedFactors)) {
      expect(CANONICAL_CHARSTATS[code as keyof typeof CANONICAL_CHARSTATS].blockFactor).toBe(factor)
      const unit = makeUnit({
        unitType: 'player',
        charClass: code,
        hasShield: true,
        stats: {
          level: 30,
          dexterity: 75, // (75 - 15) / (2 * 30) = 1.0
          toblock: 10,
        },
      })
      expect(computeBlockRate113c(unit)).toBe(10 + factor)
    }

    // Paladin with Sacred Targe (30) + BlockFactor (30) + Holy Shield (+35) + Guardian Angel (+20) = 115 totalShieldBlock
    // At clvl=80, DEX=95: floor(115 * 80 / 160) = 57% (would be wrongly capped at floor(75 * 80 / 160) = 37% if pre-clamped)
    const highShieldPal = makeUnit({
      unitType: 'player',
      charClass: 'pal',
      hasShield: true,
      stats: {
        level: 80,
        dexterity: 95,
        toblock: 30 + 35 + 20,
      },
    })
    expect(computeBlockRate113c(highShieldPal)).toBe(57)
    expect(
      chanceToBlock({
        charClass: 'pal',
        hasShield: true,
        shieldBlock: 30,
        toBlock: 55,
        clvl: 80,
        dexterity: 95,
      }),
    ).toBe(57)
  })

  it('divides player block rate by 3 when running (mode=3) and keeps full block rate when walking (mode=2) (D2Game.dll 0x6FCFB790)', () => {
    const rngZero = { rand: () => 0 }
    const kiteBlock = resolveArmorBlock113c('kit')

    const standingPal = makeUnit({
      unitType: 'player',
      charClass: 'pal',
      hasShield: true,
      isMoving: false,
      stats: { level: 30, dexterity: 75, toblock: kiteBlock },
    })
    expect(
      evaluateAvoidanceAndBlock({
        defender: standingPal,
        attackKind: 'melee',
        rng: rngZero,
        shieldBlockRoll100: 37,
      }).avoided,
    ).toBe(true)
    expect(
      evaluateAvoidanceAndBlock({
        defender: standingPal,
        attackKind: 'melee',
        rng: rngZero,
        shieldBlockRoll100: 38,
      }).avoided,
    ).toBe(false)

    // Walking (mode = 2): retains full 38%
    const walkingPal = makeUnit({
      unitType: 'player',
      charClass: 'pal',
      hasShield: true,
      isMoving: true,
      isWalking: true,
      isRunning: false,
      stats: { level: 30, dexterity: 75, toblock: kiteBlock },
    })
    expect(
      evaluateAvoidanceAndBlock({
        defender: walkingPal,
        attackKind: 'melee',
        rng: rngZero,
        shieldBlockRoll100: 37,
      }).avoided,
    ).toBe(true)

    // Running (mode = 3): floor(38 / 3) = 12%
    const runningPal = makeUnit({
      unitType: 'player',
      charClass: 'pal',
      hasShield: true,
      isMoving: true,
      isWalking: false,
      isRunning: true,
      stats: { level: 30, dexterity: 75, toblock: kiteBlock },
    })
    expect(
      evaluateAvoidanceAndBlock({
        defender: runningPal,
        attackKind: 'melee',
        rng: rngZero,
        shieldBlockRoll100: 11,
      }).avoided,
    ).toBe(true)
    expect(
      evaluateAvoidanceAndBlock({
        defender: runningPal,
        attackKind: 'melee',
        rng: rngZero,
        shieldBlockRoll100: 12,
      }).avoided,
    ).toBe(false)
  })

  it('does not artificially cap Assassin Weapon Block at 65% or Amazon Dodge/Avoid/Evade at 75% (D2Game.dll 0x6FCFA540 & 0x6FCFB030)', () => {
    const rngZero = { rand: () => 0 }
    const ass = makeUnit({
      unitType: 'player',
      charClass: 'ass',
      isDualClaw: true,
      stats: { passive_weaponblock: 68 },
    })
    expect(
      evaluateAvoidanceAndBlock({
        defender: ass,
        attackKind: 'melee',
        rng: rngZero,
        weaponBlockRoll100: 67,
      }),
    ).toEqual({ avoided: true, reason: 'weapon_block' })

    const ama = makeUnit({
      unitType: 'player',
      charClass: 'ama',
      isMoving: false,
      stats: { passive_dodge: 78 },
    })
    expect(
      evaluateAvoidanceAndBlock({
        defender: ama,
        attackKind: 'melee',
        rng: rngZero,
        dodgeRoll100: 77,
      }),
    ).toEqual({ avoided: true, reason: 'dodge' })
  })

  it('enables monster block for skeleton1 (10% in Normal, MonStats2.mBL=1) and dispatches MONMODE_BLOCK (6) & PLRMODE_BLOCK (9) UnitMode events', () => {
    const game = new GameInstance({ difficulty: 0, mapSeed: 12345 })

    const palId = game.addPlayer({
      name: 'Paladin_1416',
      classId: 3,
      level: 30,
      strength: 80,
      dexterity: 75,
      vitality: 80,
      energy: 40,
      areaId: 3,
      x: 100,
      y: 100,
    })
    const playerRec = (game as unknown as { players: Map<number, Record<string, unknown>> }).players.get(palId)!
    // Equip a Kite Shield ('kit', Armor.txt block = 8) on left arm (bodyLoc = 5)
    ;(playerRec.items as Array<Record<string, unknown>>).push({
      unitId: 9001,
      code: 'kit',
      name: 'Kite Shield',
      quality: 2,
      level: 10,
      location: 'equipped',
      bodyLoc: 5,
      x: 0,
      y: 0,
      width: 2,
      height: 3,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 30,
      maxDurability: 30,
      quantity: 1,
      cost: 100,
      stats: new Map<number, number>(),
      socketedItems: [],
    })

    // Spawn skeleton1 (hcIdx = 0): MonStats.txt ToBlock = 10, Skeletons MonStats2.txt mBL = 1 -> Normal toBlock = 10%
    const skelId = game.spawnMonster({ classId: 0, x: 101, y: 100, areaId: 3 })
    const skelRec = (game as unknown as { monsters: Map<number, Record<string, unknown>> }).monsters.get(skelId)!
    expect(skelRec.toBlock).toBe(10)

    // Force RNG: hit roll = 0 (hits), block roll = 9 (< 10% -> skeleton blocks!)
    const rng = (game as unknown as { rng: { rand: (max: number) => number } }).rng
    const origRand = rng.rand.bind(rng)
    const rolls = [0, 9]
    rng.rand = (max: number) => (rolls.length > 0 ? rolls.shift()! : origRand(max))

    const outbox = (game as unknown as { outbox: Map<number, Array<Record<string, unknown>>> }).outbox
    outbox.set(palId, [])
    const dealt = (
      game as unknown as {
        applyDamageToMonster: (
          attacker: unknown,
          monster: unknown,
          damage: number,
          skillId?: number,
          channel?: string,
        ) => boolean
      }
    ).applyDamageToMonster(playerRec, skelRec, 25, 0, 'phys')

    expect(dealt).toBe(false)
    expect(skelRec.mode).toBe(MONMODE_BLOCK)
    const monEvents = outbox.get(palId) ?? []
    const monBlockEvent = monEvents.find(
      (e) => e.type === 'UnitMode' && e.unitType === 1 && e.id === skelId,
    )
    expect(monBlockEvent?.mode).toBe(MONMODE_BLOCK)

    // Now test monster attacking standing Paladin (blockChance = 38%):
    // Roll 0 (hits), Roll 37 (< 38% -> Paladin blocks -> mode = 9 PLRMODE_BLOCK)
    playerRec.mode = 1
    outbox.set(palId, [])
    rolls.push(0, 37)
    ;(
      game as unknown as {
        resolveMonsterAttackOnPlayer: (monster: unknown, player: unknown) => void
      }
    ).resolveMonsterAttackOnPlayer(skelRec, playerRec)

    expect(playerRec.mode).toBe(9)
    const plrEvents = outbox.get(palId) ?? []
    const plrBlockEvent = plrEvents.find(
      (e) => e.type === 'UnitMode' && e.unitType === 0 && e.id === palId,
    )
    expect(plrBlockEvent?.mode).toBe(9)

    // Now test monster attacking running Paladin (mode = 3 -> blockChance = floor(38 / 3) = 12%):
    // Roll 0 (hits), Roll 12 (>= 12% -> NOT blocked when running!)
    playerRec.mode = 3
    const hpBefore = playerRec.hp as number
    rolls.push(12, 0)
    ;(
      game as unknown as {
        resolveMonsterAttackOnPlayer: (monster: unknown, player: unknown) => void
      }
    ).resolveMonsterAttackOnPlayer(skelRec, playerRec)
    expect((playerRec.hp as number) < hpBefore).toBe(true)

    rng.rand = origRand
  })
})

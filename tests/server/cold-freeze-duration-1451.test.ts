/**
 * Issue #1451: 1.13c cold (`STATE_COLD` 11, `SUNITDMG_ApplyCold` `0x6FCFC780`) and freeze
 * (`STATE_FREEZE` 1, `SUNITDMG_ApplyFreeze` `0x6FCFDAC0`) durations on monsters:
 * - Evaluates `Skills.txt` `ELen + ELevLen1..3` scaled by `ELenSymPerCalc` (`D2Common_11035`),
 *   or `auraLenCalc` on Glacial Spike (#55), or `calc1` on Frozen Armor (#40), or `Missiles.txt`
 *   `ELen + ELevLen1..3` on Phoenix Strike (#280 charge 3 `royalstrikechaosice`).
 * - Adds weapon `STAT_COLDLENGTH` (`56`, `D2Game.dll` `0x6FCFD8A6`) on weapon-carrying attacks.
 * - Divides monster durations by `DifficultyLevels.txt` `MonsterColdDivisor` (`+0x18`, `1 / 2 / 4`)
 *   and `MonsterFreezeDivisor` (`+0x14`, `1 / 2 / 4`) loaded at `D2Common.dll` `0x6FDB03F0`.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import type { ItemData } from '../../src/netproto/index.ts'
import {
  difficultyMonsterColdDivisor,
  difficultyMonsterFreezeDivisor,
} from '../../src/server/engine/difficulty-resist-penalty.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import { writeD2sSave113c } from '../../src/server/save/d2s-writer.ts'
import { createSampleD2sCharacterData } from '../e2e/server-reuse/helpers.ts'

function createTestSorceressBytes(
  name = 'ColdSorc',
  items: readonly ItemData[] = [],
): Uint8Array {
  return writeD2sSave113c(
    createSampleD2sCharacterData({
      name,
      charClass: 1,
      level: 30,
      skillLevels: new Uint8Array(30),
      items,
      attributesOverrides: {
        maxManaFixed: 5000 * FIXED_ONE,
        manaFixed: 5000 * FIXED_ONE,
      },
    }),
  )
}

function createEquippedMagicColdSword(coldLengthFrames: number): ItemData {
  return {
    id: 9001,
    itemId: 9001,
    opcode: 0x9c,
    action: 0,
    category: 0,
    ownerType: 0,
    ownerId: 1,
    flags: 0x00000010,
    rawFlags: 0x00000010,
    version: 101,
    location: 1,
    container: 'equipment',
    bodyLoc: 4,
    equippedSlot: 4,
    gridX: 0,
    gridY: 0,
    storePage: 0,
    storagePage: 0,
    worldX: 0,
    worldY: 0,
    x: 0,
    y: 0,
    code: 'ssd',
    rawCode: 'ssd ',
    compact: false,
    simple: false,
    identified: true,
    socketed: false,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: true,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    ilvl: 10,
    quality: 4,
    graphicIndex: 0,
    magicPrefixId: 1,
    magicSuffixId: 0,
    durability: 24,
    curDurability: 24,
    maxDurability: 24,
    quantity: 1,
    invWidth: 1,
    invHeight: 3,
    stats: [
      { statId: 54, param: 0, value: 3 }, // coldmindam
      { statId: 55, param: 0, value: 6 }, // coldmaxdam
      { statId: 56, param: 0, value: coldLengthFrames }, // coldlength
    ],
    setBonusStats: [],
    runewordStats: [],
  }
}

describe('Issue #1451: 1.13c monster cold/freeze duration from Skills.txt ELen/ELevLen and DifficultyLevels divisors', async () => {
  const registry = await getSharedDataRegistry()

  it('reads MonsterFreezeDivisor (+0x14) and MonsterColdDivisor (+0x18) = 1 / 2 / 4 from DifficultyLevels.txt', () => {
    expect(difficultyMonsterFreezeDivisor(0)).toBe(1)
    expect(difficultyMonsterFreezeDivisor(1)).toBe(2)
    expect(difficultyMonsterFreezeDivisor(2)).toBe(4)

    expect(difficultyMonsterColdDivisor(0)).toBe(1)
    expect(difficultyMonsterColdDivisor(1)).toBe(2)
    expect(difficultyMonsterColdDivisor(2)).toBe(4)
  })

  it('applies Ice Bolt (#39) ELen=150 (+35/lvl) divided by MonsterColdDivisor (150 Normal, 75 Nightmare, 37 Hell, 290 at slvl 5)', () => {
    const cases: readonly [0 | 1 | 2, number, number][] = [
      [0, 1, 150], // Normal: 150 / 1 = 150 frames (6s)
      [1, 1, 75], // Nightmare: 150 / 2 = 75 frames (3s)
      [2, 1, 37], // Hell: trunc(150 / 4) = 37 frames (1.48s)
      [0, 5, 290], // Normal slvl 5: (150 + 4 * 35) / 1 = 290 frames (11.6s)
    ]

    for (const [difficulty, slvl, expectedFrames] of cases) {
      const game = new GameInstance({
        registry,
        seed: 0x1451_39 + difficulty * 10 + slvl,
        difficulty,
        areaId: 2,
      })
      const playerId = game.connectPlayer({
        d2sBytes: createTestSorceressBytes(),
        x: 100,
        y: 100,
        areaId: 2,
        skills: { 39: slvl },
      })
      const monId = game.spawnMonster({
        defId: 'fallen1',
        x: 102,
        y: 100,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
        aiDisabled: true,
      })

      game.enqueueCommand(playerId, {
        type: 'CastSkillAtLocation',
        skillId: 39,
        x: 102,
        y: 100,
        hand: 'right',
      })
      // Missiles.txt icebolt (Vel=12 -> 0.75 subtile/frame, Size=1) reaches fallen1 footprint [101, 103]
      // on frame 2 (100 + 2 * 0.75 = 101.5), and stepUnitStates() ticks state 11 once on that frame.
      game.stepFrames(2)
      const monAfterHit = game.getMonster(monId)!
      expect(monAfterHit.states.has(11)).toBe(true)

      // State 11 remains active for (expectedFrames - 2) additional ticks, then expires on the next tick.
      game.stepFrames(expectedFrames - 2)
      expect(game.getMonster(monId)!.states.has(11)).toBe(true)
      game.stepFrames(1)
      expect(game.getMonster(monId)!.states.has(11)).toBe(false)
    }
  })

  it('applies Frost Nova (#44) ELen=200 (+25/lvl) divided by MonsterColdDivisor (200 Normal, 250 at slvl 3, 100 Nightmare, 50 Hell)', () => {
    const cases: readonly [0 | 1 | 2, number, number][] = [
      [0, 1, 200],
      [0, 3, 250],
      [1, 1, 100],
      [2, 1, 50],
    ]

    for (const [difficulty, slvl, expectedFrames] of cases) {
      const game = new GameInstance({
        registry,
        seed: 0x1451_44 + difficulty * 10 + slvl,
        difficulty,
        areaId: 2,
      })
      const playerId = game.connectPlayer({
        d2sBytes: createTestSorceressBytes(),
        x: 100,
        y: 100,
        areaId: 2,
        skills: { 44: slvl },
      })
      const monId = game.spawnMonster({
        defId: 'fallen1',
        x: 102,
        y: 100,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
        aiDisabled: true,
      })

      game.applyDamageToMonster(monId, 10, playerId, 44, 'cold')
      const mon = game.getMonster(monId)!
      expect(mon.states.has(11)).toBe(true)

      game.stepFrames(expectedFrames - 1)
      expect(game.getMonster(monId)!.states.has(11)).toBe(true)
      game.stepFrames(1)
      expect(game.getMonster(monId)!.states.has(11)).toBe(false)
    }
  })

  it('applies equipped weapon STAT_COLDLENGTH (56) on normal attack (skillId = 0) and divides by MonsterColdDivisor', () => {
    for (const [difficulty, expectedFrames] of [
      [0, 100],
      [2, 25],
    ] as const) {
      const game = new GameInstance({
        registry,
        seed: 0x1451_56 + difficulty,
        difficulty,
        areaId: 2,
      })
      const playerId = game.connectPlayer({
        d2sBytes: createTestSorceressBytes('ColdSwordSorc', [createEquippedMagicColdSword(100)]),
        x: 100,
        y: 100,
        areaId: 2,
      })
      const monId = game.spawnMonster({
        defId: 'fallen1',
        x: 101,
        y: 100,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        ac: 0,
        toBlock: 0,
        resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
        aiDisabled: true,
      })

      const hit = game.applyDamageToMonster(monId, 15, playerId, 0, 'phys', 'player', {
        attackKind: 'melee',
        autoHit: true,
        unblockable: true,
      })
      expect(hit).toBe(true)
      expect(game.getMonster(monId)!.states.has(11)).toBe(true)

      game.stepFrames(expectedFrames - 1)
      expect(game.getMonster(monId)!.states.has(11)).toBe(true)
      game.stepFrames(1)
      expect(game.getMonster(monId)!.states.has(11)).toBe(false)
    }
  })

  it('applies STATE_FREEZE (1) for Ice Blast (#45, ELen=75 + Glacial Spike synergy) and Glacial Spike (#55, auraLenCalc=50 + Blizzard synergy) divided by MonsterFreezeDivisor, and does not chill on Firestorm (#225)', () => {
    const game = new GameInstance({
      registry,
      seed: 0x1451_45,
      difficulty: 1,
      areaId: 2,
    }) // Nightmare: divisor = 2
    const playerId = game.connectPlayer({
      d2sBytes: createTestSorceressBytes(),
      x: 100,
      y: 100,
      areaId: 2,
      // Ice Blast slvl 1 (75 frames) + Glacial Spike blvl 4 (+40% -> floor(75 * 140 / 100) = 105 frames; /2 in NM = 52 frames)
      skills: { 45: 1, 55: 4, 225: 1 },
    })
    const monIceBlast = game.spawnMonster({
      defId: 'fallen1',
      x: 102,
      y: 100,
      areaId: 2,
      hp: 1000,
      maxHp: 1000,
      resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
      aiDisabled: true,
    })
    const monGlacialSpike = game.spawnMonster({
      defId: 'fallen1',
      x: 104,
      y: 100,
      areaId: 2,
      hp: 1000,
      maxHp: 1000,
      resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
      aiDisabled: true,
    })
    const monFirestorm = game.spawnMonster({
      defId: 'fallen1',
      x: 106,
      y: 100,
      areaId: 2,
      hp: 1000,
      maxHp: 1000,
      resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
      aiDisabled: true,
    })

    // Firestorm (#225, EType=fire) must NOT apply STATE_COLD (11) or STATE_FREEZE (1)
    game.applyDamageToMonster(monFirestorm, 20, playerId, 225, 'fire')
    expect(game.getMonster(monFirestorm)!.states.has(11)).toBe(false)
    expect(game.getMonster(monFirestorm)!.states.has(1)).toBe(false)

    // Ice Blast (#45): 105 raw frames / 2 (Nightmare MonsterFreezeDivisor) = 52 frames of STATE_FREEZE (1)
    game.applyDamageToMonster(monIceBlast, 20, playerId, 45, 'cold')
    expect(game.getMonster(monIceBlast)!.states.has(1)).toBe(true)

    // Glacial Spike (#55) at slvl 4 (50 + 3 * 3 = 59 raw frames) / 2 = 29 frames of STATE_FREEZE (1)
    game.applyDamageToMonster(monGlacialSpike, 20, playerId, 55, 'cold')
    expect(game.getMonster(monGlacialSpike)!.states.has(1)).toBe(true)

    game.stepFrames(28)
    expect(game.getMonster(monGlacialSpike)!.states.has(1)).toBe(true)
    game.stepFrames(1)
    expect(game.getMonster(monGlacialSpike)!.states.has(1)).toBe(false)

    // Ice Blast still has 52 - 29 = 23 frames left
    expect(game.getMonster(monIceBlast)!.states.has(1)).toBe(true)
    game.stepFrames(22)
    expect(game.getMonster(monIceBlast)!.states.has(1)).toBe(true)
    game.stepFrames(1)
    expect(game.getMonster(monIceBlast)!.states.has(1)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { clientUnitToMonsterTargetInfo } from '../../src/client/ui-model/hud-item-adapter.ts'
import { ClientUnit } from '../../src/client/world/client-unit.ts'
import {
  applyMonsterUModResistances,
  getMonsterKindByHcIdx,
  resolveMonsterStats,
} from '../../src/common/units/monsters-data.ts'
import {
  isPhysicalOrWeaponMonsterHit113c,
  rollEnchantedAttackBonus113c,
} from '../../src/server/ai/monumod-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'

interface InternalPlayerView {
  unitId: number
  hp: number
  hpFixed: number
  maxHp: number
  maxHpFixed: number
  mana: number
  manaFixed: number
  maxMana: number
  maxManaFixed: number
  dexterity: number
  states: Set<number>
  stateTimers: Map<number, number>
  items: Array<{
    unitId: number
    code: string
    name: string
    quality: number
    location: 'equipped' | 'inventory'
    bodyLoc?: number
    x: number
    y: number
    width: number
    height: number
    identified: boolean
    stats: Map<number, number>
  }>
}

interface InternalMonsterView {
  unitId: number
  resistances: {
    phys: number
    magic: number
    fire: number
    light: number
    cold: number
    poison: number
  }
}

function getInternal(game: GameInstance): {
  players: Map<number, InternalPlayerView>
  monsters: Map<number, InternalMonsterView>
  resolveMonsterAttackOnPlayer: (
    monster: InternalMonsterView,
    player: InternalPlayerView,
    swing?: {
      minDmg: number
      maxDmg: number
      skillMode: 'A1' | 'A2' | 'S1'
      attackKind?: 'melee' | 'missile'
      fromMissile?: boolean
      elementType?: 'phys' | 'fire' | 'ltng' | 'cold' | 'pois' | 'mag'
      elemMin?: number
      elemMax?: number
      autoHit?: boolean
    },
  ) => boolean
} {
  return game as unknown as ReturnType<typeof getInternal>
}

describe('Issue #2003 — 1.13c MonUMod Minion Resistances, 0x6FC41BE0 2-Immunity Gate, and Physical/Weapon Rider Parity', () => {
  it('suppresses boss-only MonUMod resistances on rank === "minion" across resolveMonsterStats, GameInstance.spawnMonster, and clientUnitToMonsterTargetInfo (D2Game.dll 0x6FC41BFD)', () => {
    const councilKind = getMonsterKindByHcIdx(345, 'normal')!
    const transferredMods = ['fire', 'cold', 'lightning', 'resist', 'stoneskin', 'manahit', 'spectralhit']

    const bossStats = resolveMonsterStats(councilKind, {
      difficulty: 'normal',
      rank: 'unique',
      modifiers: ['fire', 'stoneskin'],
    })
    const minionStats = resolveMonsterStats(councilKind, {
      difficulty: 'normal',
      rank: 'minion',
      modifiers: transferredMods,
    })

    expect(bossStats.resistances?.fire).toBe((councilKind.resistances.fire ?? 0) + 75)
    expect(bossStats.resistances?.physical).toBe((councilKind.resistances.physical ?? 0) + 50)
    expect(minionStats.resistances).toEqual(councilKind.resistances)

    // Verify GameInstance.spawnMonster leaves minion resistances untouched by transferred boss UMods
    const game = new GameInstance({ seed: 20031, areaId: 83 })
    const minionUnitId = game.spawnMonster({
      defId: 'councilmember1',
      hcIdx: 345,
      x: 5140,
      y: 1808,
      areaId: 83,
      rank: 'minion',
      modifiers: transferredMods,
      umodIds: [9, 17, 18, 8, 25, 27, 28],
    })
    const spawnedMinion = getInternal(game).monsters.get(minionUnitId)!
    expect(spawnedMinion.resistances.fire).toBe(councilKind.resistances.fire)
    expect(spawnedMinion.resistances.cold).toBe(councilKind.resistances.cold)
    expect(spawnedMinion.resistances.light).toBe(councilKind.resistances.lightning)
    expect(spawnedMinion.resistances.phys).toBe(councilKind.resistances.physical)
    expect(spawnedMinion.resistances.magic).toBe(councilKind.resistances.magic)

    // Verify client HUD target bar adapter does NOT apply boss UMod immunities to minions (flags 0x10)
    const minionClientUnit = new ClientUnit({
      unitType: 1,
      id: 901,
      classId: 345,
      x: 5140,
      y: 1808,
      lifePct: 128,
      flags: 0x10,
      bossMods: [9, 18, 28],
    })
    const hudInfo = clientUnitToMonsterTargetInfo(minionClientUnit, 0)
    expect(hudInfo.rank).toBe('minion')
    expect(hudInfo.resistances).toEqual(councilKind.resistances)
  })

  it('enforces D2Game.dll 0x6FC41BE0 6-stat 2-immunity gate, #23 Poison Enchanted (+75%), and Cold -> Fire -> Lightning order on #8 and #27', () => {
    // #23 Poison Enchanted adds +75 poison when immunities < 2
    const poisRes = applyMonsterUModResistances(
      { physical: 0, magic: 0, fire: 0, lightning: 0, cold: 0, poison: 30 },
      [23],
    )
    expect(poisRes.poison).toBe(105)

    // #8 Magic Resistant skips already-immune stats (< 100 check) and proceeds Cold -> Fire -> Lightning
    const mrOrder = applyMonsterUModResistances(
      { physical: 100, magic: 0, fire: 80, lightning: 80, cold: 70, poison: 0 },
      [8],
    )
    // physical = 100 (1 immunity). Cold: 70 + 40 = 110 (now 2 immunities!). Fire & Lightning stay 80.
    expect(mrOrder.cold).toBe(110)
    expect(mrOrder.fire).toBe(80)
    expect(mrOrder.lightning).toBe(80)

    // #27 Spectral Hit checks < 75 and immunities < 2 in Cold -> Fire -> Lightning order
    const shOrder = applyMonsterUModResistances(
      { physical: 100, magic: 0, fire: 85, lightning: 60, cold: 85, poison: 0 },
      [27],
    )
    // Cold >= 75 (skipped), Fire >= 75 (skipped), Lightning 60 < 75 -> 80
    expect(shOrder.cold).toBe(85)
    expect(shOrder.fire).toBe(85)
    expect(shOrder.lightning).toBe(80)
  })

  it('prevents pure elemental spell missiles (e.g. Council Hydra bolts) from proccing #7 Cursed, #18 Cold Enchanted, #25 Mana Burn, and #27 Spectral Hit', () => {
    expect(
      isPhysicalOrWeaponMonsterHit113c({
        fromMissile: true,
        physMax: 0,
        elemMax: 30,
        elementType: 'fire',
      }),
    ).toBe(false)
    expect(
      isPhysicalOrWeaponMonsterHit113c({
        fromMissile: true,
        physMax: 15,
        elemMax: 0,
      }),
    ).toBe(true)
    expect(isPhysicalOrWeaponMonsterHit113c({ fromMissile: false, physMax: 20 })).toBe(true)

    const game = new GameInstance({ seed: 20032, areaId: 83 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'Tester', x: 40, y: 40, areaId: 83 })
    const internal = getInternal(game)
    const player = internal.players.get(pid)!
    player.maxHp = 2000
    player.maxHpFixed = 2000 * FIXED_ONE
    player.hp = 2000
    player.hpFixed = 2000 * FIXED_ONE
    player.maxMana = 500
    player.maxManaFixed = 500 * FIXED_ONE
    player.mana = 500
    player.manaFixed = 500 * FIXED_ONE
    player.dexterity = 1

    const councilId = game.spawnMonster({
      defId: 'councilmember1',
      hcIdx: 345,
      x: 42,
      y: 40,
      areaId: 83,
      rank: 'unique',
      level: 28,
      minDmg: 25,
      maxDmg: 35,
      ar: 100000,
      umodIds: [7, 18, 25, 27],
    })
    const council = internal.monsters.get(councilId)!

    // Fire 10 pure-fire Hydra bolts: MUST NOT apply Amplify Damage (9), Chill (11), or Mana Burn!
    for (let i = 0; i < 10; i++) {
      internal.resolveMonsterAttackOnPlayer(council, player, {
        minDmg: 0,
        maxDmg: 0,
        skillMode: 'S1',
        attackKind: 'missile',
        fromMissile: true,
        elementType: 'fire',
        elemMin: 20,
        elemMax: 20,
      })
    }
    expect(player.states.has(9)).toBe(false)
    expect(player.states.has(11)).toBe(false)
    expect(player.mana).toBe(500)
    expect(2000 - player.hp).toBe(200)
  })

  it('implements 1.13c #18 Cold Enchanted (66..100% cold + 100 + 5*mlvl chill mitigated by cold res / CBF) and #27 Spectral Hit 1-of-5 single-element roll', () => {
    const ceBoss = rollEnchantedAttackBonus113c({
      umodIds: [18],
      isMinion: false,
      mlvl: 25,
      baseMinDmg: 100,
      baseMaxDmg: 100,
      rollInt: (lo, hi) => {
        expect(lo).toBe(66)
        expect(hi).toBe(100)
        return 80
      },
    })
    expect(ceBoss.coldDmg).toBe(80)
    expect(ceBoss.chillFrames).toBe(100 + 5 * 25)

    // Spectral Hit rolls 1-of-5 single element (never 3 elements simultaneously)
    for (let idx = 0; idx < 5; idx++) {
      let call = 0
      const sh = rollEnchantedAttackBonus113c({
        umodIds: [27],
        isMinion: false,
        mlvl: 30,
        baseMinDmg: 100,
        baseMaxDmg: 100,
        rollInt: (lo, hi) => {
          call++
          if (call === 1) {
            expect(lo).toBe(0)
            expect(hi).toBe(4)
            return idx
          }
          expect(lo).toBe(66)
          expect(hi).toBe(100)
          return 75
        },
      })
      const nonZeroChannels = [
        sh.fireDmg,
        sh.lightDmg,
        sh.magicDmg,
        sh.coldDmg,
        sh.poisonDmg,
      ].filter((v) => v > 0)
      expect(nonZeroChannels).toEqual([75])
      if (idx === 3) expect(sh.chillFrames).toBe(40)
      if (idx === 4) expect(sh.poisonFrames).toBe(40)
    }

    // Cannot Be Frozen (stat 153) blocks Cold Enchanted melee chill completely
    const game = new GameInstance({ seed: 20033, areaId: 2 })
    const pid = game.connectPlayer({ charClass: 'bar', name: 'Unfrozen', x: 40, y: 40, areaId: 2 })
    const internal = getInternal(game)
    const player = internal.players.get(pid)!
    player.maxHp = 2000
    player.maxHpFixed = 2000 * FIXED_ONE
    player.hp = 2000
    player.hpFixed = 2000 * FIXED_ONE
    player.dexterity = 1
    player.items.push({
      unitId: 777,
      code: 'rin',
      name: 'Raven Frost',
      quality: 7,
      location: 'equipped',
      bodyLoc: 6,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      identified: true,
      stats: new Map([[153, 1]]),
    })

    const mid = game.spawnMonster({
      defId: 'zombie1',
      x: 41,
      y: 40,
      areaId: 2,
      rank: 'unique',
      level: 20,
      minDmg: 20,
      maxDmg: 20,
      ar: 100000,
      umodIds: [18],
    })
    internal.resolveMonsterAttackOnPlayer(internal.monsters.get(mid)!, player, {
      minDmg: 20,
      maxDmg: 20,
      skillMode: 'A1',
      attackKind: 'melee',
    })
    expect(player.states.has(11)).toBe(false)
  })
})

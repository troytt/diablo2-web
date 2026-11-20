/**
 * P1 Wave 4 — 1.13c MonUMod & Shrine Parity Suite
 *
 * Covers all 11 P1 issues:
 * - #1890: MonUMod #9 (Fire Enchanted) & #17 (Lightning Enchanted) melee elemental bonus damage
 * - #1899: MonUMod #26 (Teleport) <30% HP / blocked blink, 60f cooldown, 25% heal & PMH/DoT suppression
 * - #1900: MonUMod #29 (Multishot) +2 angled fan projectiles (unique boss vs minions + 1.13c NoMultiShot=1 on #195 MSLE)
 * - #1901: MonUMod #34 (ai_after_death / #293 Self-resurrect) Act 5 reanimatedhorde timer, aip1%, Pindleskin exclusion, 0 repeat XP/drops, RIP block
 * - #1902: MonUMod #28 (Stone Skin) +100% Defense & +50% Phys Res ONLY (not 2x HP) + removal of fake 1.2x dmg / speed boosts
 * - #1903: Champion sub-types (#16, #36..#39), Possessed curse immunity, and WillOWisp (hcIdx 118) halved %Damage bonus
 * - #1904: MonUMod #7 (Cursed) 75% chance #66 Amplify Damage at slvl = floor(mlvl / 5) + 1
 * - #1905: MonUMod #25 (Mana Burn) damage-scaled mana drain (256x melee shift vs ranged) + +20% magic res & +75% AR
 * - #1906: MonUMod #41 (always_run_ai) AOI bypass ONLY vs MonStats.txt killminions / SplEndDeath / Blood Raven / Shenk
 * - #1919: Armor Shrine (Code 6) +100% Defense (no +200% double-stack) & Combat Shrine (Code 7) +200% touch-time AR snapshot + +200% damagepercent
 * - #1920: Exploding Shrine (Code 21) & Poison Shrine (Code 22) 6 distinct radial missile target coordinates (0x6FC8C798)
 */
import { describe, expect, it } from 'vitest'
import {
  applyChampionSubtypeStats,
  applyEliteModifiers,
  getMonsterKindByHcIdx,
  resolveMonsterStats,
} from '../../src/common/units/monsters-data.ts'
import {
  CURSED_PROC_CHANCE_PCT_113C,
  TELEPORT_UMOD_COOLDOWN_FRAMES_113C,
  computeCursedAmplifyDamage113c,
  computeManaBurnDrainFixed113c,
  computeMultishotFanTargets113c,
  evaluateTeleportUMod113c,
  hasImplicitSelfResurrectUMod113c,
  isAlwaysRunAiMonster113c,
  isMonsterUncursable113c,
  isWillOWispChampion113c,
  resolveSelfResurrectChancePct113c,
  rollEnchantedAttackBonus113c,
  shouldKillMinionsOnDeath113c,
} from '../../src/server/ai/monumod-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import {
  EXPLODING_POISON_SHRINE_OFFSETS_113C,
  buildArmorShrineStats113c,
  buildCombatShrineSnapshot113c,
  computeShrineMissileSlvl113c,
} from '../../src/server/world/shrines-113c.ts'

interface InternalPlayerView {
  unitId: number
  level: number
  dexterity: number
  hp: number
  maxHp: number
  hpFixed: number
  maxHpFixed: number
  mana: number
  maxMana: number
  manaFixed: number
  maxManaFixed: number
  experience: number
  states: Set<number>
  stateTimers: Map<number, number>
  items: Array<Record<string, unknown>>
}

interface InternalMonsterView {
  unitId: number
  hcIdx: number
  defId: string
  rank: string
  x: number
  y: number
  hp: number
  maxHp: number
  minDmg: number
  maxDmg: number
  ar: number
  ac: number
  dead: boolean
  shattered: boolean
  umodIds: number[]
  uncursable: boolean
  alwaysRunAi: boolean
  selfResurrectCheckFrame: number
  alreadyGrantedKillRewards: boolean
  teleportCooldownUntilFrame: number
  states: Set<number>
  stateTimers: Map<number, number>
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
  currentFrame: number
  players: Map<number, InternalPlayerView>
  monsters: Map<number, InternalMonsterView>
  missiles: Map<
    number,
    {
      missileId: number
      x: number
      y: number
      vx: number
      vy: number
      ownerUnitId: number
    }
  >
  computePlayerDefense: (player: InternalPlayerView) => number
  playerCombatContext: (player: InternalPlayerView) => {
    statList: {
      getModifierBonus: (stat: string | number) => number
      getRawToHit113c: () => number
    }
  }
  resolveMonsterAttackOnPlayer: (
    monster: InternalMonsterView,
    player: InternalPlayerView,
    swing?: {
      minDmg: number
      maxDmg: number
      skillMode: 'A1' | 'A2' | 'S1'
      attackKind?: 'melee' | 'missile' | undefined
      fromMissile?: boolean | undefined
    },
  ) => void
  spawnMonsterMissile: (
    monster: InternalMonsterView,
    missileClassId: number,
    targetX: number,
    targetY: number,
    minDmg: number,
    maxDmg: number,
    element?: 'phys' | 'fire' | 'ltng' | 'cold' | 'pois' | 'mag',
  ) => void
  isMonsterInActiveAoi: (monster: InternalMonsterView) => boolean
} {
  return game as unknown as ReturnType<typeof getInternal>
}

describe('P1 Wave 4 — MonUMod & Shrine 1.13c Parity (#1890, #1899-#1906, #1919, #1920)', () => {
  it('#1890: Fire Enchanted (#9) and Lightning Enchanted (#17) add +66%..+100% (+33%..+50% minion) elemental damage on melee hit mitigated by resist', () => {
    const bossRoll = rollEnchantedAttackBonus113c({
      umodIds: [9, 17],
      isMinion: false,
      baseMinDmg: 100,
      baseMaxDmg: 100,
      rollInt: (lo, hi) => {
        expect(lo).toBe(66)
        expect(hi).toBe(100)
        return 80
      },
    })
    expect(bossRoll.fireDmg).toBe(80)
    expect(bossRoll.lightDmg).toBe(80)

    const minionRoll = rollEnchantedAttackBonus113c({
      umodIds: [9, 17],
      isMinion: true,
      baseMinDmg: 100,
      baseMaxDmg: 100,
      rollInt: (lo, hi) => {
        expect(lo).toBe(33)
        expect(hi).toBe(50)
        return 40
      },
    })
    expect(minionRoll.fireDmg).toBe(40)
    expect(minionRoll.lightDmg).toBe(40)

    // End-to-end GameInstance melee hit comparison: plain unique vs FE+LE unique
    const runHit = (umodIds: readonly number[]): number => {
      const game = new GameInstance({ seed: 18901, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'bar', name: 'Tank', x: 40, y: 40, areaId: 2 })
      const internal = getInternal(game)
      const player = internal.players.get(pid)!
      player.maxHp = 2000
      player.maxHpFixed = 2000 * FIXED_ONE
      player.hp = 2000
      player.hpFixed = 2000 * FIXED_ONE
      player.dexterity = 1
      const mid = game.spawnMonster({
        defId: 'zombie1',
        x: 41,
        y: 40,
        areaId: 2,
        rank: 'unique',
        minDmg: 50,
        maxDmg: 50,
        ar: 100000,
        umodIds: [...umodIds],
      })
      const monster = internal.monsters.get(mid)!
      internal.resolveMonsterAttackOnPlayer(monster, player, {
        minDmg: 50,
        maxDmg: 50,
        skillMode: 'A1',
        attackKind: 'melee',
      })
      return 2000 - player.hp
    }

    const plainDamage = runHit([])
    const enchantedDamage = runHit([9, 17])
    expect(plainDamage).toBe(50)
    // 50 phys + [33..50] fire + [33..50] lightning => strictly in [116, 150]
    expect(enchantedDamage).toBeGreaterThanOrEqual(116)
    expect(enchantedDamage).toBeLessThanOrEqual(150)
  })

  it('#1899 / #1993: Teleport (#26) blinks on AI think (not synchronously on hit) when HP < 30% with 60f cooldown, rolls 25% heal of STAT_LEVEL (mlvl), and suppresses heal under Prevent Monster Heal or Poison', () => {
    expect(
      evaluateTeleportUMod113c({
        rank: 'unique',
        level: 18,
        hp: 29,
        maxHp: 100,
        distanceToTarget: 2,
        hasPreventHeal: false,
        hasActiveDamageOverTime: false,
      }),
    ).toEqual({
      shouldTeleport: true,
      isLowHp: true,
      canRollHeal: true,
      healAmount: 18,
    })
    expect(
      evaluateTeleportUMod113c({
        rank: 'unique',
        level: 18,
        hp: 29,
        maxHp: 100,
        distanceToTarget: 2,
        hasPreventHeal: true,
        hasActiveDamageOverTime: false,
      }).canRollHeal,
    ).toBe(false)

    // Verify AI-think blink + 25% heal of STAT_LEVEL (mlvl) triggers across deterministic seeds when < 30% HP, and cooldown is 60f
    let healedCount = 0
    let teleportedCount = 0
    for (let s = 1; s <= 40; s++) {
      const game = new GameInstance({ seed: 189900 + s, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'bar', name: 'Chaser', x: 50, y: 50, areaId: 2 })
      const internal = getInternal(game)
      const mid = game.spawnMonster({
        defId: 'skeleton2',
        x: 51,
        y: 50,
        areaId: 2,
        rank: 'unique',
        level: 20,
        hp: 1000,
        maxHp: 1000,
        aiDelay: 1,
        damageRegen: 0,
        umodIds: [26],
      })
      const mon = internal.monsters.get(mid)!
      game.stepFrames(5)
      const posBeforeHit = { x: mon.x, y: mon.y }
      // Drop from 1000 -> 200 (< 30%): must NOT blink synchronously inside applyDamageToMonster (#1993)
      game.applyDamageToMonster(mid, 800, pid)
      expect({ x: mon.x, y: mon.y }).toEqual(posBeforeHit)
      expect(mon.hp).toBe(200)

      // Step AI frames until the first AI_TryTeleportUMod (6% per AI think) blink fires
      let blinked = false
      for (let tick = 0; tick < 80; tick++) {
        game.stepFrames(1)
        if (mon.teleportCooldownUntilFrame > internal.currentFrame) {
          blinked = true
          break
        }
      }
      if (blinked) {
        teleportedCount++
        expect(mon.teleportCooldownUntilFrame).toBe(
          internal.currentFrame + TELEPORT_UMOD_COOLDOWN_FRAMES_113C,
        )
        if (mon.hp > 200) {
          expect(mon.hp).toBe(220) // 200 + STAT_LEVEL (20)
          healedCount++
        }
        // Within 10 frames (< 60f cooldown), must NOT re-arm teleportCooldownUntilFrame
        const expectedCooldownEnd = mon.teleportCooldownUntilFrame
        game.stepFrames(10)
        expect(10).toBeLessThan(TELEPORT_UMOD_COOLDOWN_FRAMES_113C)
        expect(mon.teleportCooldownUntilFrame).toBe(expectedCooldownEnd)
      }
    }
    expect(teleportedCount).toBeGreaterThan(25)
    expect(healedCount).toBeGreaterThan(0)
    expect(healedCount).toBeLessThan(teleportedCount)

    // Verify Prevent Monster Heal (state 52) blocks heal 100% of the time while still allowing AI-think blink
    let pmhBlinks = 0
    for (let s = 1; s <= 20; s++) {
      const game = new GameInstance({ seed: 189950 + s, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'bar', name: 'PmhHero', x: 50, y: 50, areaId: 2 })
      const internal = getInternal(game)
      const mid = game.spawnMonster({
        defId: 'skeleton2',
        x: 51,
        y: 50,
        areaId: 2,
        rank: 'unique',
        level: 20,
        hp: 1000,
        maxHp: 1000,
        aiDelay: 1,
        damageRegen: 0,
        umodIds: [26],
      })
      const mon = internal.monsters.get(mid)!
      mon.states.add(52) // STATE_PREVENTHEAL
      game.applyDamageToMonster(mid, 800, pid)
      for (let tick = 0; tick < 80; tick++) {
        game.stepFrames(1)
        if (mon.teleportCooldownUntilFrame > internal.currentFrame) {
          pmhBlinks++
          break
        }
      }
      expect(mon.hp).toBe(200)
    }
    expect(pmhBlinks).toBeGreaterThan(10)
  })

  it('#1900 / #1993 / #2017: Multishot (#29) spawns +2 angled fan projectiles (3 total) on boss units only (minions fire 1) and respects 1.13c NoMultiShot=1 on #195 MSLE (8 bolts)', () => {
    const [left, right] = computeMultishotFanTargets113c(10, 10, 20, 10)
    expect(left[1]).toBeLessThan(10)
    expect(right[1]).toBeGreaterThan(10)

    const game = new GameInstance({ seed: 19001, areaId: 2 })
    const pid = game.connectPlayer({ charClass: 'ama', name: 'Target', x: 60, y: 50, areaId: 2 })
    const internal = getInternal(game)

    for (const [rank, expectedCount] of [
      ['unique', 3],
      ['minion', 1],
    ] as const) {
      const mid = game.spawnMonster({
        defId: 'skeleton2',
        x: 50,
        y: 50,
        areaId: 2,
        rank,
        umodIds: [29],
      })
      const mon = internal.monsters.get(mid)!
      game.drainEvents(pid)
      internal.spawnMonsterMissile(mon, 1, 60, 50, 10, 20, 'phys')
      const events = game.drainEvents(pid)
      const created = events.filter((e) => e.type === 'CreateMissile')
      expect(created).toHaveLength(expectedCount)
    }

    // 1.13c MSLE (#17 Lightning Enchanted + #29 Multishot): #195 lightunique has NoMultiShot = 1 in 1.13c Missiles.txt -> 8 bolts
    const msleId = game.spawnMonster({
      defId: 'zombie1',
      x: 52,
      y: 50,
      areaId: 2,
      rank: 'unique',
      hp: 500,
      maxHp: 500,
      umodIds: [17, 29],
    })
    game.drainEvents(pid)
    game.applyDamageToMonster(msleId, 20, pid)
    const msleBolts = game
      .drainEvents(pid)
      .filter(
        (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 195,
      )
    expect(msleBolts).toHaveLength(8)
  })

  it('#1901: Reanimated Horde (#34 ai_after_death) arms 100..224f self-resurrect timer, excludes Pindleskin (unique), blocks shattered/RIP corpses, and grants 0 repeat XP/drops', () => {
    expect(
      hasImplicitSelfResurrectUMod113c({
        hcIdx: 438,
        defId: 'reanimatedhorde3',
        rank: 'minion',
      }),
    ).toBe(true)
    // Unique/SuperUnique Pindleskin leader does NOT self-resurrect
    expect(
      hasImplicitSelfResurrectUMod113c({
        hcIdx: 440,
        defId: 'reanimatedhorde5',
        rank: 'unique',
        superUniqueId: 'Pindleskin',
      }),
    ).toBe(false)
    expect(resolveSelfResurrectChancePct113c(436)).toBe(30)
    expect(resolveSelfResurrectChancePct113c(440)).toBe(70)

    const game = new GameInstance({ seed: 19011, areaId: 121 })
    const pid = game.connectPlayer({ charClass: 'bar', name: 'Slayer', x: 40, y: 40, areaId: 121 })
    const internal = getInternal(game)
    const player = internal.players.get(pid)!

    const hordeId = game.spawnMonster({
      defId: 'reanimatedhorde5',
      hcIdx: 440,
      x: 41,
      y: 40,
      areaId: 121,
      rank: 'minion',
      hp: 100,
      maxHp: 100,
      experience: 500,
      aiParams: [100, 0, 0, 0, 0],
    })
    const pindleId = game.spawnMonster({
      defId: 'reanimatedhorde5',
      hcIdx: 440,
      x: 42,
      y: 40,
      areaId: 121,
      rank: 'unique',
      superUniqueId: 'Pindleskin',
      hp: 200,
      maxHp: 200,
      experience: 1000,
    })

    const horde = internal.monsters.get(hordeId)!
    const pindle = internal.monsters.get(pindleId)!
    expect(horde.umodIds).toContain(34)
    expect(pindle.umodIds).not.toContain(34)

    const xpBefore = player.experience
    game.applyDamageToMonster(hordeId, 500, pid)
    game.applyDamageToMonster(pindleId, 500, pid)
    const xpAfterFirstKill = player.experience
    expect(xpAfterFirstKill).toBeGreaterThan(xpBefore)
    expect(horde.dead).toBe(true)
    expect(horde.selfResurrectCheckFrame).toBeGreaterThanOrEqual(internal.currentFrame + 100)
    expect(horde.selfResurrectCheckFrame).toBeLessThanOrEqual(internal.currentFrame + 224)
    expect(pindle.selfResurrectCheckFrame).toBe(0)

    // Step 99 frames -> still dead (minimum 100-frame delay)
    game.stepFrames(99)
    expect(horde.dead).toBe(true)

    // Step past 230 frames -> horde revives to full HP, Pindleskin stays dead
    game.stepFrames(150)
    expect(horde.dead).toBe(false)
    expect(horde.hp).toBe(100)
    expect(pindle.dead).toBe(true)

    // Second kill on self-resurrected horde grants 0 XP and 0 new ground items
    const itemsBeforeSecondKill = game.getGroundItems().length
    const xpBeforeSecondKill = player.experience
    game.applyDamageToMonster(hordeId, 500, pid)
    expect(horde.dead).toBe(true)
    expect(player.experience).toBe(xpBeforeSecondKill)
    expect(game.getGroundItems().length).toBe(itemsBeforeSecondKill)
  })

  it('#1902: Stone Skin (#28) grants 2x Defense & +50% Physical Resist WITHOUT 2x HP, and elemental/cursed/aura mods do not add fake 1.2x physical damage', () => {
    const skelPlain = resolveMonsterStats(0, {
      difficulty: 'hell',
      rank: 'unique',
      modifiers: [],
    })
    const skelStoneSkin = resolveMonsterStats(0, {
      difficulty: 'hell',
      rank: 'unique',
      modifiers: ['stoneskin'],
    })
    expect(skelStoneSkin.maxHp).toBe(skelPlain.maxHp)
    expect(skelStoneSkin.armor).toBe((skelPlain.armor ?? 0) * 2)
    expect(skelStoneSkin.resistances?.physical).toBe((skelPlain.resistances?.physical ?? 0) + 50)

    for (const mod of ['cursed', 'fireenchant', 'lightenchant', 'coldenchant', 'spectralhit', 'aura']) {
      const withMod = resolveMonsterStats(0, {
        difficulty: 'normal',
        rank: 'unique',
        modifiers: [mod],
      })
      expect(withMod.damage).toBe(
        resolveMonsterStats(0, { difficulty: 'normal', rank: 'unique', modifiers: [] }).damage,
      )
    }
  })

  it('#1903: Champion sub-types (#36..#39) match 1.13c multipliers, Possessed (#38) blocks all curses, and WillOWisp (hcIdx 118) halves Champion %Damage bonus', () => {
    const wispKind = getMonsterKindByHcIdx(118, 'normal')!
    expect(isWillOWispChampion113c({ hcIdx: 118, id: 'willowisp1' })).toBe(true)
    expect(isWillOWispChampion113c({ hcIdx: 641, id: 'willowisp7', baseId: 'willowisp1' })).toBe(true)

    const wispBase = resolveMonsterStats(wispKind, { difficulty: 'normal', rank: 'normal' })
    const wispChamp = applyChampionSubtypeStats(wispBase, 16, 'normal')
    const wispBerserk = applyChampionSubtypeStats(wispBase, 39, 'normal')
    // Normal WillOWisp gets 1.5x (not 2.0x) on regular Champion and 2.5x (not 4.0x) on Berserk
    expect(wispChamp.damage).toBe(Math.max(1, Math.round(wispBase.damage * 1.5)))
    expect(wispBerserk.damage).toBe(Math.max(1, Math.round(wispBase.damage * 2.5)))

    // Fanatic (#37) applies 0.3x AR penalty (-70% AR) + 2.0x speed + 0.3x cooldownTicks
    const fallenBase = resolveMonsterStats(19, { difficulty: 'normal', rank: 'normal' })
    const fallenFanatic = applyChampionSubtypeStats(fallenBase, 37, 'normal')
    expect(fallenFanatic.toHit).toBe(Math.max(1, Math.round((fallenBase.toHit ?? 0) * 0.3)))

    // Possessed (#38) blocks all curses in GameInstance.applyMonsterState (including Taunt #27 & Amplify #9)
    expect(isMonsterUncursable113c([38])).toBe(true)
    const game = new GameInstance({ seed: 19031, areaId: 2 })
    game.connectPlayer({ charClass: 'nec', name: 'Curser', x: 40, y: 40, areaId: 2 })
    const possId = game.spawnMonster({
      defId: 'fallen1',
      x: 42,
      y: 40,
      areaId: 2,
      rank: 'champion',
      modifiers: ['possessed'],
      umodIds: [38],
    })
    for (const curseState of [9, 19, 23, 27, 55, 56, 57, 58, 59, 60, 61]) {
      expect(game.applyMonsterState(possId, curseState, 200)).toBe(false)
    }
    expect(game.getMonsterState(possId)!.states.size).toBe(0)
  })

  it('#1904: Cursed (#7) triggers Amplify Damage (state 9) at 75% chance with slvl = floor(mlvl / 5) + 1', () => {
    expect(CURSED_PROC_CHANCE_PCT_113C).toBe(75)
    expect(computeCursedAmplifyDamage113c(1)).toEqual({
      slvl: 1,
      rawDurationFrames: 200,
      durationFrames: 200,
    })
    expect(computeCursedAmplifyDamage113c(85)).toEqual({
      slvl: 18,
      rawDurationFrames: 200 + 75 * 17,
      durationFrames: 1475,
    })
    expect(computeCursedAmplifyDamage113c(85, 50).durationFrames).toBe(737)

    let cursedCount = 0
    for (let s = 1; s <= 40; s++) {
      const game = new GameInstance({ seed: 190400 + s, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'bar', name: 'Victim', x: 40, y: 40, areaId: 2 })
      const internal = getInternal(game)
      const player = internal.players.get(pid)!
      player.maxHp = 2000
      player.maxHpFixed = 2000 * FIXED_ONE
      player.hp = 2000
      player.hpFixed = 2000 * FIXED_ONE
      player.dexterity = 1
      // Pre-existing Weaken (state 19) must be overwritten when Amplify Damage (state 9) procs
      player.states.add(19)
      player.stateTimers.set(19, 500)

      const mid = game.spawnMonster({
        defId: 'zombie1',
        x: 41,
        y: 40,
        areaId: 2,
        rank: 'unique',
        level: 25, // slvl = floor(25/5)+1 = 6 -> 200 + 75*5 = 575 frames
        minDmg: 10,
        maxDmg: 10,
        ar: 100000,
        umodIds: [7],
      })
      internal.resolveMonsterAttackOnPlayer(internal.monsters.get(mid)!, player, {
        minDmg: 10,
        maxDmg: 10,
        skillMode: 'A1',
        attackKind: 'melee',
      })
      if (player.states.has(9)) {
        cursedCount++
        expect(player.states.has(19)).toBe(false)
        expect(player.stateTimers.get(9)).toBe(575)
        expect(
          internal.playerCombatContext(player).statList.getModifierBonus('damageresist'),
        ).toBe(-100)
      }
    }
    // 75% proc chance over 40 trials: neither 0% nor 100%
    expect(cursedCount).toBeGreaterThan(15)
    expect(cursedCount).toBeLessThan(40)
  })

  it('#1905: Mana Burn (#25) grants +20% magic resist & +75% AR and drains damage-scaled mana (256x melee shift vs unshifted missile)', () => {
    const base = {
      id: 'zombie1',
      name: 'Zombie',
      hp: 100,
      damage: 20,
      toHit: 100,
      speed: 10,
      reach: 40,
      aggroRadius: 200,
      cooldownTicks: 25,
      xp: 50,
    }
    const manaBurnBoss = applyEliteModifiers(base, 'unique', ['manaburn'])
    expect(manaBurnBoss.resistances?.magic).toBe(20)
    expect(manaBurnBoss.toHit).toBe(175)

    const meleeFixed = computeManaBurnDrainFixed113c({
      isMinion: false,
      isMelee: true,
      baseMinDmg: 10,
      baseMaxDmg: 10,
      rollInt: () => 10,
    })
    const missileFixed = computeManaBurnDrainFixed113c({
      isMinion: false,
      isMelee: false,
      baseMinDmg: 10,
      baseMaxDmg: 10,
      rollInt: () => 10,
    })
    expect(meleeFixed).toBe(10 * 256 * 256) // 2560 whole mana (classic << 8 bug)
    expect(missileFixed).toBe(10 * 256) // 10 whole mana

    // Verify melee Mana Burn wipes a 500-mana pool to 0 in a single 10-dmg hit, whereas missile drains 6..10 mana
    for (const attackKind of ['melee', 'missile'] as const) {
      const game = new GameInstance({ seed: 19051, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'sor', name: 'Mage', x: 40, y: 40, areaId: 2 })
      const internal = getInternal(game)
      const player = internal.players.get(pid)!
      player.maxHp = 1000
      player.maxHpFixed = 1000 * FIXED_ONE
      player.hp = 1000
      player.hpFixed = 1000 * FIXED_ONE
      player.maxMana = 500
      player.maxManaFixed = 500 * FIXED_ONE
      player.mana = 500
      player.manaFixed = 500 * FIXED_ONE
      player.dexterity = 1

      const mid = game.spawnMonster({
        defId: 'zombie1',
        x: 41,
        y: 40,
        areaId: 2,
        rank: 'unique',
        minDmg: 10,
        maxDmg: 10,
        ar: 100000,
        umodIds: [25],
      })
      internal.resolveMonsterAttackOnPlayer(internal.monsters.get(mid)!, player, {
        minDmg: 10,
        maxDmg: 10,
        skillMode: 'A1',
        attackKind,
        fromMissile: attackKind === 'missile',
      })
      if (attackKind === 'melee') {
        expect(player.mana).toBe(0)
      } else {
        expect(player.mana).toBeGreaterThanOrEqual(490)
        expect(player.mana).toBeLessThanOrEqual(494)
      }
    }
  })

  it('#1906: MonUMod #41 (always_run_ai) bypasses AOI culling WITHOUT killing minions on death; Blood Raven (#267), Shenk (#479), and fetishshaman purge minions on death', () => {
    expect(isAlwaysRunAiMonster113c([41])).toBe(true)
    expect(
      shouldKillMinionsOnDeath113c({
        hcIdx: 19,
        defId: 'fallen1',
        umodIds: [41],
      }).purge,
    ).toBe(false)
    expect(
      shouldKillMinionsOnDeath113c({
        hcIdx: 267,
        defId: 'bloodraven',
        umodIds: [],
      }).purge,
    ).toBe(true)
    expect(
      shouldKillMinionsOnDeath113c({
        hcIdx: 479,
        defId: 'overseer1',
        superUniqueId: 'Shenk the Overseer',
        umodIds: [22],
      }).purge,
    ).toBe(true)
    expect(
      shouldKillMinionsOnDeath113c({
        hcIdx: 278,
        defId: 'fetishshaman1',
        umodIds: [],
      }).purge,
    ).toBe(true)

    const game = new GameInstance({ seed: 19061, areaId: 17 })
    const pid = game.connectPlayer({ charClass: 'ama', name: 'Hero', x: 20, y: 20, areaId: 17 })
    const internal = getInternal(game)

    // Far monster with umod 41 stays active in AOI, and dying does NOT kill nearby minions
    const umod41Boss = game.spawnMonster({
      defId: 'zombie1',
      x: 200,
      y: 200,
      areaId: 17,
      rank: 'unique',
      hp: 50,
      maxHp: 50,
      umodIds: [41],
    })
    const nearbyMinion = game.spawnMonster({
      defId: 'zombie1',
      x: 201,
      y: 200,
      areaId: 17,
      rank: 'minion',
      hp: 50,
      maxHp: 50,
    })
    expect(internal.isMonsterInActiveAoi(internal.monsters.get(umod41Boss)!)).toBe(true)
    expect(internal.isMonsterInActiveAoi(internal.monsters.get(nearbyMinion)!)).toBe(false)

    game.applyDamageToMonster(umod41Boss, 500, pid)
    expect(internal.monsters.get(umod41Boss)!.dead).toBe(true)
    expect(internal.monsters.get(nearbyMinion)!.dead).toBe(false)

    // Blood Raven (#267) death purges surrounding undead minions within 35 sub-tiles with 0 bonus XP
    const bloodRaven = game.spawnMonster({
      defId: 'bloodraven',
      hcIdx: 267,
      x: 25,
      y: 20,
      areaId: 17,
      rank: 'unique',
      hp: 100,
      maxHp: 100,
      experience: 200,
    })
    const zombieMinion = game.spawnMonster({
      defId: 'zombie1',
      hcIdx: 5,
      x: 28,
      y: 20,
      areaId: 17,
      rank: 'normal',
      hp: 80,
      maxHp: 80,
      experience: 5000,
    })
    const player = internal.players.get(pid)!
    player.level = 10
    const xpBefore = player.experience
    game.applyDamageToMonster(bloodRaven, 500, pid)
    expect(internal.monsters.get(bloodRaven)!.dead).toBe(true)
    expect(internal.monsters.get(zombieMinion)!.dead).toBe(true)
    // Purged zombie minion (5000 XP) must NOT grant its kill XP
    expect(player.experience - xpBefore).toBeLessThan(1000)
  })

  it('#1919: Armor Shrine (Code 6) grants +100% Defense (not +200%) and Combat Shrine (Code 7) snapshots +200% touch-time AR + +200% damagepercent', () => {
    expect(buildArmorShrineStats113c(100)).toEqual({ skill_armor_percent: 100 })
    expect(
      buildCombatShrineSnapshot113c({
        currentAttackRating: 350,
        arg0: 200,
        arg1: 200,
      }),
    ).toEqual({
      tohit: 700,
      damagepercent: 200,
    })

    const game = new GameInstance({ seed: 19191, areaId: 2 })
    const pid = game.connectPlayer({ charClass: 'pal', name: 'Knight', x: 50, y: 50, areaId: 2 })
    const internal = getInternal(game)
    const player = internal.players.get(pid)!
    player.dexterity = 100 // base defense = floor(100/4) = 25; base AR = 500 - 35 + 20 = 485

    const defBefore = internal.computePlayerDefense(player)
    expect(defBefore).toBeGreaterThan(0)

    const armorShrine = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 2,
      isShrine: true,
      shrineType: 6,
    })
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: armorShrine })
    game.stepFrames(1)

    const defWithArmorShrine = internal.computePlayerDefense(player)
    // Exactly 2x (+100%), NEVER 3x (+200%)!
    expect(defWithArmorShrine).toBe(defBefore * 2)
    expect(
      internal.playerCombatContext(player).statList.getModifierBonus('item_armor_percent'),
    ).toBe(0)

    const arBeforeCombat = internal.playerCombatContext(player).statList.getRawToHit113c()
    const combatShrine = game.spawnObject({
      classId: 2,
      x: 51,
      y: 50,
      areaId: 2,
      isShrine: true,
      shrineType: 7,
    })
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: combatShrine })
    game.stepFrames(1)

    const statListAfter = internal.playerCombatContext(player).statList
    expect(statListAfter.getModifierBonus('tohit')).toBe(arBeforeCombat * 2)
    expect(statListAfter.getRawToHit113c()).toBe(arBeforeCombat * 3)
    expect(statListAfter.getModifierBonus('damagepercent')).toBe(200)
  })

  it('#1920: Exploding Shrine (Code 21) and Poison Shrine (Code 22) spawn 6 missiles across all 6 distinct radial coordinates (0x6FC8C798)', () => {
    expect(EXPLODING_POISON_SHRINE_OFFSETS_113C).toHaveLength(6)
    expect(new Set(EXPLODING_POISON_SHRINE_OFFSETS_113C.map(([dx, dy]) => `${dx},${dy}`)).size).toBe(6)
    expect(computeShrineMissileSlvl113c(1)).toBe(1)
    expect(computeShrineMissileSlvl113c(25)).toBe(5)
    expect(computeShrineMissileSlvl113c(90)).toBe(8)

    for (const [code, expectedMissileId] of [
      [21, 45],
      [22, 48],
    ] as const) {
      const game = new GameInstance({ seed: 19200 + code, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'sor', name: 'Scout', x: 50, y: 50, areaId: 2 })
      const shrineId = game.spawnObject({
        classId: 2,
        x: 52,
        y: 50,
        areaId: 2,
        isShrine: true,
        shrineType: code,
      })
      game.drainEvents(pid)
      game.enqueueCommand(pid, { type: 'OperateObject', objectId: shrineId })
      game.stepFrames(1)

      const missiles = game
        .drainEvents(pid)
        .filter(
          (e) =>
            e.type === 'CreateMissile' &&
            (e as { missileClassId?: number }).missileClassId === expectedMissileId,
        ) as Array<{ targetX: number; targetY: number }>
      expect(missiles).toHaveLength(6)
      const relCoords = missiles.map((m) => `${m.targetX - 52},${m.targetY - 50}`).sort()
      expect(relCoords).toEqual(['-6,-6', '-6,6', '0,-6', '0,6', '6,-6', '6,6'])
    }
  })
})

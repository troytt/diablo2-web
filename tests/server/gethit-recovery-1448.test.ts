import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { resolveWeaponBase113c } from '../../src/common/units/char-anim-speed.ts'
import {
  executeSUnitDmg,
  resolveHitClassCode113c,
  resolveHitClassDivisor113c,
  shouldEnterGetHit113c,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'

describe('Issue #1448: 1.13c GetHit recovery thresholds, HitClass divisors, and player GetHit (0x6FCFB910 / 0x6FCFD0FC)', () => {
  it('resolves HitClass.txt codes to 1..13 and maps divisors 8 / 16 / 32 / 64 per 0x6FCFB94A..0x6FCFBA04', () => {
    expect(resolveHitClassCode113c('hth')).toBe(1)
    expect(resolveHitClassCode113c('1hss')).toBe(2)
    expect(resolveHitClassCode113c('1hsl')).toBe(3)
    expect(resolveHitClassCode113c('2hss')).toBe(4)
    expect(resolveHitClassCode113c('2hsl')).toBe(5)
    expect(resolveHitClassCode113c('1ht')).toBe(6)
    expect(resolveHitClassCode113c('2ht')).toBe(7)
    expect(resolveHitClassCode113c('club')).toBe(8)
    expect(resolveHitClassCode113c('staf')).toBe(9)
    expect(resolveHitClassCode113c('bow')).toBe(10)
    expect(resolveHitClassCode113c('xbow')).toBe(11)
    expect(resolveHitClassCode113c('claw')).toBe(12)
    expect(resolveHitClassCode113c('over')).toBe(13)

    // Jump table 0x6FCFBA04 divisors:
    // 2 (1hss), 6 (1ht), 10 (bow), 11 (xbow) -> 8
    for (const hc of [2, 6, 10, 11, '1hss', '1ht', 'bow', 'xbow'] as const) {
      expect(resolveHitClassDivisor113c(hc)).toBe(8)
    }
    // 1 (hth), 3 (1hsl), 7 (2ht), 9 (staf), 12 (claw), 0/default -> 16
    for (const hc of [0, 1, 3, 7, 9, 12, 13, 'hth', '1hsl', '2ht', 'staf', 'claw'] as const) {
      expect(resolveHitClassDivisor113c(hc)).toBe(16)
    }
    // 4 (2hss), 8 (club) -> 32
    for (const hc of [4, 8, '2hss', 'club'] as const) {
      expect(resolveHitClassDivisor113c(hc)).toBe(32)
    }
    // 5 (2hsl) -> 64
    expect(resolveHitClassDivisor113c(5)).toBe(64)
    expect(resolveHitClassDivisor113c('2hsl')).toBe(64)

    // DataRegistry parses HitClass.txt Code column and Weapons.txt `hit class` column
    const registry = getSharedDataRegistry()
    expect(registry.getMissileByName('arrow')?.hitClass).toBe(10) // bow
    expect(resolveWeaponBase113c('lax')?.hitClass).toBe('2hsl')
    expect(resolveWeaponBase113c('wnd')?.hitClass).toBe('1hss')
    expect(resolveWeaponBase113c('dgr')?.hitClass).toBe('1ht')
    expect(resolveWeaponBase113c('ssd')?.hitClass).toBe('1hsl')
    expect(resolveWeaponBase113c('clb')?.hitClass).toBe('club')
  })

  it('reproduces SUNITDMG_CheckSkipGetHit (0x6FCFB910) probability tiers for maxHP = 160 and default HitClass (d = 16)', () => {
    const maxHp256 = 160 * FIXED_ONE // 40960
    const defender = { maxHp256, unitType: 'monster' as const, hasModeGH: true }
    const trials = 10_000

    // Damage 9 (< 160/16 = 10): 0% GetHit, 0 RNG calls
    {
      const rng = new D2Rng(0x12345678)
      const seedBefore = { lo: rng.lo, hi: rng.hi }
      let count = 0
      for (let i = 0; i < 100; i++) {
        if (shouldEnterGetHit113c(defender, 9 * FIXED_ONE, 0, rng)) count++
      }
      expect(count).toBe(0)
      expect({ lo: rng.lo, hi: rng.hi }).toEqual(seedBefore)
    }

    // Damage 10..19 ([160/16, 160/8)): 3/8 = 37.5% GetHit via rand(2) then rand(4)
    for (const dmg of [10, 15, 19]) {
      const rng = new D2Rng(0xCAFEBABE + dmg)
      let hits = 0
      for (let i = 0; i < trials; i++) {
        if (shouldEnterGetHit113c(defender, dmg * FIXED_ONE, 0, rng)) hits++
      }
      const rate = hits / trials
      expect(rate).toBeGreaterThan(0.355)
      expect(rate).toBeLessThan(0.395)
    }

    // Damage 20..39 ([160/8, 160/4)): 3/4 = 75% GetHit via single rand(4)
    for (const dmg of [20, 30, 39]) {
      const rng = new D2Rng(0xDEADBEEF + dmg)
      let hits = 0
      for (let i = 0; i < trials; i++) {
        if (shouldEnterGetHit113c(defender, dmg * FIXED_ONE, 0, rng)) hits++
      }
      const rate = hits / trials
      expect(rate).toBeGreaterThan(0.73)
      expect(rate).toBeLessThan(0.77)
    }

    // Damage >= 40 (>= 160/4): 100% GetHit and consumes 0 RNG rolls
    {
      const rng = new D2Rng(0x42424242)
      const seedBefore = { lo: rng.lo, hi: rng.hi }
      let hits = 0
      for (let i = 0; i < 100; i++) {
        if (shouldEnterGetHit113c(defender, 40 * FIXED_ONE, 0, rng)) hits++
      }
      expect(hits).toBe(100)
      expect({ lo: rng.lo, hi: rng.hi }).toEqual(seedBefore)
    }
  })

  it('scales thresholds by HitClass divisor (2hsl d=64 triggers 100% at >= 1/16 maxHP; bow d=8 requires >= 1/2 maxHP)', () => {
    const maxHp256 = 160 * FIXED_ONE
    const defender = { maxHp256, unitType: 'monster' as const, hasModeGH: true }
    const rng = new D2Rng(777)

    // 2hsl (d = 64): 4/64 = 1/16 of 160 = 10 HP is 100% GetHit without RNG rolls
    const seedBefore = { lo: rng.lo, hi: rng.hi }
    expect(shouldEnterGetHit113c(defender, 10 * FIXED_ONE, '2hsl', rng)).toBe(true)
    expect({ lo: rng.lo, hi: rng.hi }).toEqual(seedBefore)

    // bow (d = 8): 1/8 of 160 = 20 HP; 19 HP is below 1/8 and is 0% GetHit
    expect(shouldEnterGetHit113c(defender, 19 * FIXED_ONE, 'bow', rng)).toBe(false)
    expect({ lo: rng.lo, hi: rng.hi }).toEqual(seedBefore)
    // bow (d = 8): 4/8 = 1/2 of 160 = 80 HP is 100% GetHit
    expect(shouldEnterGetHit113c(defender, 80 * FIXED_ONE, 'bow', rng)).toBe(true)
    expect({ lo: rng.lo, hi: rng.hi }).toEqual(seedBefore)
  })

  it('enforces 0x6FCFB910 & 0x6FCFD0FC gates: <256 damage, freeze state 1, pure poison, stun state 21, and MonStats2.mGH', () => {
    const rng = new D2Rng(999)
    const maxHp256 = 160 * FIXED_ONE

    // < 256 (< 1 HP) never triggers GetHit even if maxHp256 is tiny
    expect(
      shouldEnterGetHit113c({ maxHp256: 512, unitType: 'player' }, 255, '2hsl', rng),
    ).toBe(false)

    // Freeze (state 1) suppresses GetHit even at 100% max life damage
    expect(
      shouldEnterGetHit113c(
        { maxHp256, states: new Set([1]), unitType: 'monster', hasModeGH: true },
        160 * FIXED_ONE,
        '2hsl',
        rng,
      ),
    ).toBe(false)

    // Pure poison (DmgTypes === 0x20) suppresses GetHit
    expect(
      shouldEnterGetHit113c(
        { maxHp256, isPurePoison: true, unitType: 'player' },
        160 * FIXED_ONE,
        'hth',
        rng,
      ),
    ).toBe(false)

    // STATE_STUNNED (21) forces unconditional GetHit on any >= 1 HP non-poison damage (0x6FCFD0FC)
    expect(
      shouldEnterGetHit113c(
        { maxHp256, states: new Set([21]), unitType: 'monster', hasModeGH: true },
        1 * FIXED_ONE,
        'bow',
        rng,
      ),
    ).toBe(true)

    // MonStats2.mGH == 0 suppresses GetHit on monsters without GH mode (e.g., Act bosses)
    expect(
      shouldEnterGetHit113c(
        { maxHp256, unitType: 'monster', hasModeGH: false },
        160 * FIXED_ONE,
        '2hsl',
        rng,
      ),
    ).toBe(false)
  })

  it('integrates HitClass and 0x6FCFB910 into executeSUnitDmg (combat-pipeline.ts)', () => {
    const attackerStats = new UnitStatList()
    attackerStats.setBaseStat('level', 20)
    const defenderStats = new UnitStatList()
    defenderStats.setBaseStat('level', 20)
    defenderStats.setBaseStat('maxhp', 160 * FIXED_ONE)
    defenderStats.setHp256(160 * FIXED_ONE)

    const attacker: CombatUnitContext = {
      id: 'att',
      name: 'Attacker',
      unitType: 'player',
      statList: attackerStats,
      stateBus: new StateBus(attackerStats),
      weaponHitClass: '2hsl',
    }
    const defender: CombatUnitContext = {
      id: 'def',
      name: 'Defender',
      unitType: 'monster',
      statList: defenderStats,
      stateBus: new StateBus(defenderStats),
    }

    // With 2hsl (d = 64), 10 damage (>= 160 / 16) is 100% GetHit
    const out = executeSUnitDmg(
      attacker,
      defender,
      {
        skillId: 0,
        attackKind: 'melee',
        srcDam: 128,
        flatPhysMin256: 10 * FIXED_ONE,
        flatPhysMax256: 10 * FIXED_ONE,
        autoHit: true,
        unblockable: true,
      },
      new D2Rng(1234),
    )
    expect(out.hit).toBe(true)
    expect(out.hitClass).toBe(5)
    expect(
      shouldEnterGetHit113c(
        { maxHp256: 160 * FIXED_ONE, stateBus: defender.stateBus, unitType: 'monster' },
        out.totalDamage256,
        out.hitClass,
        new D2Rng(1234),
      ),
    ).toBe(true)
  })

  it('puts player into PLRMODE_GETHIT (mode = 4), broadcasts UnitMode, scales recovery ticks with FHR (stat 99), and blocks movement/casting during recovery', () => {
    // 1. Baseline 0% FHR Sorceress (Ama/Sor GH frames -> 15 ticks at 0 FHR)
    const game0 = new GameInstance({ seed: 101 })
    const pid0 = game0.connectPlayer({
      name: 'SorcNoFhr',
      charClass: 'sor',
      level: 20,
      hp: 160,
      maxHp: 160,
      x: 100,
      y: 100,
    })
    game0.drainEvents(pid0)

    // Deal 40 damage (>= 1/4 of 160 maxHp -> 100% GetHit with default HitClass d=16)
    game0.applyDamageToPlayer(pid0, 40)
    const events0 = game0.drainEvents(pid0)
    const unitMode0 = events0.find(
      (ev) => ev.type === 'UnitMode' && ev.unitType === 0 && ev.id === pid0,
    )
    expect(unitMode0).toBeDefined()
    expect(unitMode0?.type === 'UnitMode' ? unitMode0.mode : -1).toBe(4)
    expect(game0.getPlayerState(pid0)?.mode).toBe(4)

    // Attempt to move and cast while in GetHit recovery: must be blocked
    const posBefore = {
      x: game0.getPlayerState(pid0)!.x,
      y: game0.getPlayerState(pid0)!.y,
    }
    const manaBefore = game0.getPlayerState(pid0)!.mana
    game0.enqueueCommand(pid0, { type: 'RunToLocation', x: 120, y: 120 })
    game0.enqueueCommand(pid0, {
      type: 'CastSkillAtLocation',
      skillId: 36, // Fire Bolt
      x: 110,
      y: 110,
    })
    game0.stepFrame()
    expect(game0.getPlayerState(pid0)?.x).toBe(posBefore.x)
    expect(game0.getPlayerState(pid0)?.y).toBe(posBefore.y)
    expect(game0.getPlayerState(pid0)?.mana).toBe(manaBefore)
    expect(game0.getPlayerState(pid0)?.mode).toBe(4)

    // Count remaining frames until player recovers to neutral (mode 1 or 5)
    let ticks0 = 1
    while (game0.getPlayerState(pid0)?.mode === 4 && ticks0 < 40) {
      game0.stepFrame()
      ticks0++
    }
    expect(game0.getPlayerState(pid0)?.mode).not.toBe(4)

    // 2. Sorceress with +86% FHR (statId 99) -> faster recovery (fewer ticks than 0% FHR)
    const gameFhr = new GameInstance({ seed: 101 })
    const pidFhr = gameFhr.connectPlayer({
      name: 'SorcWithFhr',
      charClass: 'sor',
      level: 20,
      hp: 160,
      maxHp: 160,
      x: 100,
      y: 100,
    })
    const playerRec = (
      gameFhr as unknown as { players: Map<number, { items: unknown[] }> }
    ).players.get(pidFhr)!
    playerRec.items.push({
      unitId: 9001,
      code: 'qui',
      name: 'FHR Armor',
      quality: 4,
      level: 20,
      location: 'equipped',
      x: 0,
      y: 0,
      width: 2,
      height: 3,
      areaId: 1,
      ownerId: pidFhr,
      bodyLoc: 3,
      storePage: 0,
      cost: 100,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 20,
      maxDurability: 20,
      quantity: 1,
      stats: new Map([[99, 86]]),
      socketedItems: [],
    })
    gameFhr.drainEvents(pidFhr)
    gameFhr.applyDamageToPlayer(pidFhr, 40)
    expect(gameFhr.getPlayerState(pidFhr)?.mode).toBe(4)

    let ticksFhr = 0
    while (gameFhr.getPlayerState(pidFhr)?.mode === 4 && ticksFhr < 40) {
      gameFhr.stepFrame()
      ticksFhr++
    }
    expect(ticksFhr).toBeGreaterThan(0)
    expect(ticksFhr).toBeLessThan(ticks0)

    // After recovery completes, player can move again
    gameFhr.enqueueCommand(pidFhr, { type: 'RunToLocation', x: 115, y: 100 })
    gameFhr.stepFrames(5)
    expect(gameFhr.getPlayerState(pidFhr)!.x).toBeGreaterThan(100)
  })

  it('allows Unique/SuperUnique/Act bosses with mGH=1 to enter GetHit while mGH=0 monsters (e.g. Diablo hcIdx=243) do not', () => {
    const game = new GameInstance({ seed: 202 })
    const pid = game.connectPlayer({
      name: 'BarbTester',
      charClass: 'bar',
      level: 60,
      hp: 1000,
      maxHp: 1000,
      x: 100,
      y: 100,
    })

    // Unique zombie (`hcIdx = 1` has `mGH = 1` in MonStats2.txt, `isBoss = true` due to rank = 'unique')
    const uniqueZombieId = game.spawnMonster({
      hcIdx: 1,
      rank: 'unique',
      x: 102,
      y: 100,
      areaId: 1,
      hp: 200,
      maxHp: 200,
    })
    // Diablo (`hcIdx = 243` has `mGH = 0` in MonStats2.txt)
    const diabloId = game.spawnMonster({
      hcIdx: 243,
      rank: 'boss',
      x: 104,
      y: 100,
      areaId: 1,
      hp: 400,
      maxHp: 400,
    })
    game.drainEvents(pid)

    // Deal >= 1/4 max life to both
    game.applyDamageToMonster(uniqueZombieId, 60, pid, 0, 'mag', 'player', {
      attackKind: 'spell',
      autoHit: true,
      unblockable: true,
    })
    game.applyDamageToMonster(diabloId, 120, pid, 0, 'mag', 'player', {
      attackKind: 'spell',
      autoHit: true,
      unblockable: true,
    })

    expect(game.getMonsterState(uniqueZombieId)?.mode).toBe(3) // MONMODE_GETHIT
    expect(game.getMonsterState(diabloId)?.mode).not.toBe(3) // mGH == 0 skips GetHit
  })
})

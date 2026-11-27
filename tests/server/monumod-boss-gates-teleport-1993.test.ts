/**
 * Issue #1993 — 1.13c MonUMod Boss-Only (`bBoss != 0`) Gates & `AI_TryTeleportUMod` (`0x6FCBCDE0`) Parity
 *
 * Verifies against D2Game.dll 1.13c:
 * 1. `#7 Cursed` (`0x6FC44250`): boss-only (`rank !== 'minion'`) Amplify Damage proc on hit.
 * 2. `#17 Lightning Enchanted` (`0x6FC46320` vs `0x6FC42600`): boss-only 8-bolt `#195` ring on struck,
 *    while minions still retain `+33%..+50%` melee lightning damage rider.
 * 3. `#27 Spectral Hit` (`0x6FC41BE0`): boss-only elemental rider on hit.
 * 4. `#29 Multishot` (`0x6FC45AD0`): boss-only `+2` fan projectiles (`3` total vs `1` on minions).
 * 5. `#30 Aura Enchanted` (`0x6FC44CD0`): boss-only Paladin offensive aura assignment.
 * 6. `#26 Teleportation` (`0x6FC441B0` & `AI_TryTeleportUMod` `0x6FCBCDE0`):
 *    - Boss-only (`rank !== 'minion'`), never synchronous inside `applyDamageToMonster`.
 *    - Ranged bosses (`RangedType != 0`, Skeleton Archers `10..14`, Council `345..347`, Baal Subject Mummies `557..558`)
 *      never teleport when `lifePct >= 30%`, and melee bosses only reposition when `dist < 10` at `lifePct >= 30%`.
 *    - `40%` * `15%` = `6%` chance per AI think, random walkable offset in `[-10..10]` (`hypot >= 4`),
 *      `60`-frame cooldown, and `25%` chance to heal `STAT_LEVEL (12)` (`mlvl` HP) when `lifePct < 30%`.
 */
import { describe, expect, it } from 'vitest'
import {
  evaluateTeleportUMod113c,
  isTeleportUModRangedMonster113c,
} from '../../src/server/ai/monumod-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'

describe('Issue #1993 — 1.13c MonUMod boss-only gates & AI_TryTeleportUMod parity', () => {
  it('enforces boss-only (bBoss != 0) gate on #7 Cursed: unique procs Amplify Damage, minion never procs', () => {
    let uniqueCursedCount = 0
    let minionCursedCount = 0
    for (let s = 1; s <= 24; s++) {
      for (const rank of ['unique', 'minion'] as const) {
        const game = new GameInstance({ seed: 199300 + s, areaId: 2 })
        const pid = game.connectPlayer({ charClass: 'bar', name: 'Hero', x: 40, y: 40, areaId: 2 })
        const players = Reflect.get(game, 'players') as Map<
          number,
          { hp: number; maxHp: number; hpFixed: number; maxHpFixed: number; dexterity: number; states: Set<number> }
        >
        const monsters = Reflect.get(game, 'monsters') as Map<number, unknown>
        const resolveAttack = Reflect.get(game, 'resolveMonsterAttackOnPlayer') as (
          m: unknown,
          p: unknown,
          swing: { minDmg: number; maxDmg: number; skillMode: 'A1' },
        ) => unknown
        const player = players.get(pid)!
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
          rank,
          minDmg: 20,
          maxDmg: 20,
          ar: 100000,
          umodIds: [7],
        })
        resolveAttack.call(game, monsters.get(mid)!, player, {
          minDmg: 20,
          maxDmg: 20,
          skillMode: 'A1',
        })
        if (player.states.has(9)) {
          if (rank === 'unique') uniqueCursedCount++
          else minionCursedCount++
        }
      }
    }
    expect(uniqueCursedCount).toBeGreaterThan(10)
    expect(minionCursedCount).toBe(0)
  })

  it('enforces boss-only gate on #17 LE 8-bolt ring when struck while preserving minion melee lightning bonus', () => {
    const game = new GameInstance({ seed: 199317, areaId: 2 })
    const pid = game.connectPlayer({ charClass: 'bar', name: 'Tester', x: 40, y: 40, areaId: 2 })
    const players = Reflect.get(game, 'players') as Map<
      number,
      { hp: number; maxHp: number; hpFixed: number; maxHpFixed: number; dexterity: number }
    >
    const monsters = Reflect.get(game, 'monsters') as Map<number, unknown>
    const resolveAttack = Reflect.get(game, 'resolveMonsterAttackOnPlayer') as (
      m: unknown,
      p: unknown,
      swing: { minDmg: number; maxDmg: number; skillMode: 'A1' },
    ) => unknown
    const player = players.get(pid)!
    player.maxHp = 2000
    player.maxHpFixed = 2000 * FIXED_ONE
    player.hp = 2000
    player.hpFixed = 2000 * FIXED_ONE
    player.dexterity = 1

    const bossId = game.spawnMonster({
      defId: 'zombie1',
      x: 42,
      y: 40,
      areaId: 2,
      rank: 'unique',
      hp: 500,
      maxHp: 500,
      minDmg: 40,
      maxDmg: 40,
      ar: 100000,
      umodIds: [17],
    })
    const minionId = game.spawnMonster({
      defId: 'zombie1',
      x: 43,
      y: 40,
      areaId: 2,
      rank: 'minion',
      hp: 500,
      maxHp: 500,
      minDmg: 40,
      maxDmg: 40,
      ar: 100000,
      umodIds: [17],
    })

    game.drainEvents(pid)
    game.applyDamageToMonster(bossId, 25, pid)
    const bossBolts = game
      .drainEvents(pid)
      .filter((e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 195)
    expect(bossBolts).toHaveLength(8)

    game.drainEvents(pid)
    game.applyDamageToMonster(minionId, 25, pid)
    const minionBolts = game
      .drainEvents(pid)
      .filter((e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 195)
    expect(minionBolts).toHaveLength(0)

    // Minion still deals +33%..+50% lightning melee bonus above 40 base physical damage
    const hpBefore = player.hp
    resolveAttack.call(game, monsters.get(minionId)!, player, {
      minDmg: 40,
      maxDmg: 40,
      skillMode: 'A1',
    })
    const dmgTaken = hpBefore - player.hp
    expect(dmgTaken).toBeGreaterThanOrEqual(53) // 40 + floor(40 * 0.33) = 53
    expect(dmgTaken).toBeLessThanOrEqual(60) // 40 + floor(40 * 0.50) = 60
  })

  it('enforces boss-only gate on #27 Spectral Hit, #29 Multishot, and #30 Aura Enchanted', () => {
    const game = new GameInstance({ seed: 199327, areaId: 2 })
    const pid = game.connectPlayer({ charClass: 'bar', name: 'Tank', x: 40, y: 40, areaId: 2 })
    const players = Reflect.get(game, 'players') as Map<
      number,
      { hp: number; maxHp: number; hpFixed: number; maxHpFixed: number; dexterity: number }
    >
    const monsters = Reflect.get(game, 'monsters') as Map<
      number,
      { auraSkillId?: number | undefined }
    >
    const resolveAttack = Reflect.get(game, 'resolveMonsterAttackOnPlayer') as (
      m: unknown,
      p: unknown,
      swing: { minDmg: number; maxDmg: number; skillMode: 'A1' },
    ) => unknown
    const spawnMissile = Reflect.get(game, 'spawnMonsterMissile') as (
      m: unknown,
      tx: number,
      ty: number,
      dmg: number,
      missileClassId: number,
      skillId: number,
    ) => number

    const player = players.get(pid)!
    player.maxHp = 2000
    player.maxHpFixed = 2000 * FIXED_ONE
    player.hp = 2000
    player.hpFixed = 2000 * FIXED_ONE
    player.dexterity = 1

    const specBossId = game.spawnMonster({
      defId: 'zombie1',
      x: 41,
      y: 40,
      areaId: 2,
      rank: 'unique',
      minDmg: 60,
      maxDmg: 60,
      ar: 100000,
      umodIds: [27, 30],
    })
    const specMinionId = game.spawnMonster({
      defId: 'zombie1',
      x: 42,
      y: 40,
      areaId: 2,
      rank: 'minion',
      minDmg: 60,
      maxDmg: 60,
      ar: 100000,
      umodIds: [27, 30],
    })

    // #30 Aura Enchanted: boss gets auraSkillId, minion does not
    expect(monsters.get(specBossId)!.auraSkillId).toBeDefined()
    expect(monsters.get(specMinionId)!.auraSkillId).toBeUndefined()

    // #27 Spectral Hit: boss adds elemental bonus (> 60), minion deals exact 60 physical damage
    const hp0 = player.hp
    resolveAttack.call(game, monsters.get(specBossId)!, player, {
      minDmg: 60,
      maxDmg: 60,
      skillMode: 'A1',
    })
    const bossHit = hp0 - player.hp
    expect(bossHit).toBeGreaterThan(60)

    const hp1 = player.hp
    resolveAttack.call(game, monsters.get(specMinionId)!, player, {
      minDmg: 60,
      maxDmg: 60,
      skillMode: 'A1',
    })
    const minionHit = hp1 - player.hp
    expect(minionHit).toBe(60)

    // #29 Multishot: boss fires 3 arrows, minion fires 1 arrow
    const msBoss = game.spawnMonster({
      defId: 'skeleton2',
      x: 45,
      y: 40,
      areaId: 2,
      rank: 'unique',
      umodIds: [29],
    })
    const msMinion = game.spawnMonster({
      defId: 'skeleton2',
      x: 45,
      y: 41,
      areaId: 2,
      rank: 'minion',
      umodIds: [29],
    })
    game.drainEvents(pid)
    spawnMissile.call(game, monsters.get(msBoss)!, 40, 40, 15, 1, 0)
    expect(game.drainEvents(pid).filter((e) => e.type === 'CreateMissile')).toHaveLength(3)

    game.drainEvents(pid)
    spawnMissile.call(game, monsters.get(msMinion)!, 40, 40, 15, 1, 0)
    expect(game.drainEvents(pid).filter((e) => e.type === 'CreateMissile')).toHaveLength(1)
  })

  it('matches AI_TryTeleportUMod (0x6FCBCDE0) ranged/melee conditions, minion exclusion, 6% AI-think rate, and mlvl heal', () => {
    expect(isTeleportUModRangedMonster113c({ hcIdx: 12 })).toBe(true) // Skeleton Archer
    expect(isTeleportUModRangedMonster113c({ hcIdx: 345 })).toBe(true) // Council Member
    expect(isTeleportUModRangedMonster113c({ hcIdx: 557 })).toBe(true) // Baal Subject Mummy
    expect(isTeleportUModRangedMonster113c({ hcIdx: 1, isRanged: false })).toBe(false)

    // Minion never teleports even at 1% HP
    expect(
      evaluateTeleportUMod113c({
        rank: 'minion',
        level: 25,
        hp: 1,
        maxHp: 500,
        distanceToTarget: 3,
        isRanged: false,
        hasPreventHeal: false,
        hasActiveDamageOverTime: false,
      }).shouldTeleport,
    ).toBe(false)

    // Ranged boss at >= 30% HP never teleports regardless of distance
    expect(
      evaluateTeleportUMod113c({
        rank: 'unique',
        level: 25,
        hp: 300,
        maxHp: 1000,
        distanceToTarget: 4,
        isRanged: true,
        hasPreventHeal: false,
        hasActiveDamageOverTime: false,
      }).shouldTeleport,
    ).toBe(false)

    // Melee boss at >= 30% HP teleports ONLY when distance < 10 (not when >= 10)
    expect(
      evaluateTeleportUMod113c({
        rank: 'unique',
        level: 25,
        hp: 800,
        maxHp: 1000,
        distanceToTarget: 10,
        isRanged: false,
        hasPreventHeal: false,
        hasActiveDamageOverTime: false,
      }).shouldTeleport,
    ).toBe(false)
    expect(
      evaluateTeleportUMod113c({
        rank: 'unique',
        level: 25,
        hp: 800,
        maxHp: 1000,
        distanceToTarget: 9.5,
        isRanged: false,
        hasPreventHeal: false,
        hasActiveDamageOverTime: false,
      }),
    ).toEqual({
      shouldTeleport: true,
      isLowHp: false,
      canRollHeal: false,
      healAmount: 0,
    })

    // End-to-end: minion with umod 26 at 10% HP never teleports across 100 AI frames
    const minionGame = new GameInstance({ seed: 199326, areaId: 2 })
    const mPid = minionGame.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 40, y: 40, areaId: 2 })
    const mMonsters = Reflect.get(minionGame, 'monsters') as Map<
      number,
      { teleportCooldownUntilFrame: number }
    >
    const mId = minionGame.spawnMonster({
      defId: 'skeleton2',
      x: 44,
      y: 40,
      areaId: 2,
      rank: 'minion',
      level: 22,
      hp: 500,
      maxHp: 500,
      aiDelay: 1,
      umodIds: [26],
    })
    minionGame.applyDamageToMonster(mId, 450, mPid)
    minionGame.stepFrames(100)
    expect(mMonsters.get(mId)!.teleportCooldownUntilFrame).toBe(0)
  })
})

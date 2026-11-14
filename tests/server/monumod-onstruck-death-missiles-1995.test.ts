/**
 * Issue #1995 — 1.13c MonUMod on-struck & death missile handlers parity (`D2Game.dll` `0x6FD2F448`):
 * - `#17` (`lightning` / Lightning Enchanted): `col1` (`0x6FC41AD0`) & `col4` (`0x6FC468C0`) -> `0x6FC46320`
 *   boss-only 10-frame cooldown (`dwLastLeFrame`), `#195 lightunique` (`2 * slvl - 1` ltng at `slvl = max(1, floor(mlvl / 2))`),
 *   `!isGroundFire` gate, and 1.13c `Missiles.txt` `NoMultiShot = 1` (`8` bolts even with `Multishot` `#29`).
 * - `#20` (`scarab`): `col1` (`0x6FC41B00`, `col4 = 0`) -> `0x6FC460D0`
 *   all-ranks `#225 buglightning` radial 8-way burst on `MONMODE_GETHIT` (`mode = 3`) AND `MONMODE_DEATH` (`mode = 0`),
 *   `slvl = mlvl`, `1 + floor((mlvl - 1) / 2)` ltng damage, and client `ClientWorld` minion Scarab GetHit/Death parity.
 * - `#10` (`poisondead`): `col1` (`0x6FC41A90`, `mode = 0`) -> `0x6FC46230`
 *   stationary `#155 corpsepoisoncloud` (`Range = 80`, `ELen = 175`, `HitShift = 1`) dealing real 175-frame poison DoT.
 * - `#42` (`novadeath`): `col1` (`0x6FC41A90`, `mode = 0`) -> `0x6FC46520` -> `0x6FCC2800`
 *   boss-only 64-bolt `#90 nova` (`Skill = 48 Nova`, `Range = 13`) ring dealing lightning damage on death.
 */

import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { MON_UMOD } from '../../src/common/units/monster-death-fx.ts'
import {
  LIGHTNING_UMOD_COOLDOWN_FRAMES_113C,
  NOVADEATH_MISSILE_ID_113C,
  POISONDEAD_CLOUD_DURATION_FRAMES_113C,
  POISONDEAD_CLOUD_MISSILE_ID_113C,
  SCARAB_BUGLIGHTNING_MISSILE_ID_113C,
  computeLightningEnchantedBoltSlvl113c,
  computeLightningUniqueBoltDamage113c,
  computeNovaDeathDamageRange113c,
  computePoisonDeadCloudDamage113c,
  computeScarabBugLightningDamage113c,
  computeScarabChargedBoltSlvl113c,
} from '../../src/server/ai/monumod-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('Issue #1995 — 1.13c MonUMod #17, #20, #10 & #42 on-struck and death missile parity', () => {
  it('MonUMod #17 (Lightning Enchanted): enforces 10-frame cooldown, Missiles.txt #195 2*slvl-1 damage, ground-fire exclusion, and 1.13c NoMultiShot=1 8-bolt cap on MSLE', () => {
    expect(LIGHTNING_UMOD_COOLDOWN_FRAMES_113C).toBe(10)
    expect(computeLightningEnchantedBoltSlvl113c(1)).toBe(1)
    expect(computeLightningEnchantedBoltSlvl113c(18)).toBe(9)
    expect(computeLightningUniqueBoltDamage113c(18)).toBe(17) // 2 * 9 - 1

    const game = new GameInstance({ seed: 199501, difficulty: 0, areaId: 62 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'Tester',
      level: 20,
      x: 40,
      y: 30,
      areaId: 62,
    })
    const leBossId = game.spawnMonster({
      defId: 'fallen1',
      rank: 'unique',
      umodIds: [MON_UMOD.LIGHTNING],
      level: 18,
      minDmg: 80,
      maxDmg: 120,
      hp: 1000,
      maxHp: 1000,
      x: 30,
      y: 30,
      areaId: 62,
    })

    const internal = game as unknown as {
      missiles: Map<number, { missileId: number; physDamage: number; elemDamage: number }>
    }

    // Hit 1 at frame 0 -> 8 #195 bolts with exact 17 lightning damage (NOT 80..120 monster melee damage!)
    game.drainEvents(pid)
    game.applyDamageToMonster(leBossId, 5, pid, 36, 'fire', 'player', { autoHit: true })
    const hit1Bolts = [...internal.missiles.values()].filter((m) => m.missileId === 195)
    expect(hit1Bolts).toHaveLength(8)
    expect(hit1Bolts.every((b) => b.physDamage === 0 && b.elemDamage === 17)).toBe(true)

    // Hit 2 after 5 frames (< 10-frame cooldown) -> 0 additional bolts
    internal.missiles.clear()
    game.stepFrames(5)
    game.applyDamageToMonster(leBossId, 5, pid, 36, 'fire', 'player', { autoHit: true })
    expect([...internal.missiles.values()].filter((m) => m.missileId === 195)).toHaveLength(0)

    // Ground fire hit after 10 frames (`isGroundFire: true`) -> 0 bolts and does not consume cooldown
    game.stepFrames(5)
    game.applyDamageToMonster(leBossId, 5, pid, 51, 'fire', 'player', {
      autoHit: true,
      isGroundFire: true,
    })
    expect([...internal.missiles.values()].filter((m) => m.missileId === 195)).toHaveLength(0)

    // Direct hit at >= 10 frames -> 8 new #195 bolts
    game.applyDamageToMonster(leBossId, 5, pid, 36, 'fire', 'player', { autoHit: true })
    expect([...internal.missiles.values()].filter((m) => m.missileId === 195)).toHaveLength(8)

    // 1.13c MSLE (`#17 + #29 Multishot`): `#195 lightunique` has `NoMultiShot = 1` in 1.13c `Missiles.txt`
    // (`0x6FC45B67..0x6FC45B72`), capping the on-struck burst at 8 `#195` bolts instead of 1.09's 24
    const msleBossId = game.spawnMonster({
      defId: 'fallen1',
      rank: 'unique',
      umodIds: [MON_UMOD.LIGHTNING, MON_UMOD.MULTISHOT],
      level: 18,
      hp: 1000,
      maxHp: 1000,
      x: 35,
      y: 35,
      areaId: 62,
    })
    internal.missiles.clear()
    game.applyDamageToMonster(msleBossId, 5, pid, 36, 'fire', 'player', { autoHit: true })
    expect([...internal.missiles.values()].filter((m) => m.missileId === 195)).toHaveLength(8)
  })

  it('MonUMod #20 (Scarab): emits 8 radial #225 buglightning bolts on GetHit & Death across all ranks with 1+floor((mlvl-1)/2) damage', () => {
    expect(computeScarabChargedBoltSlvl113c(17)).toBe(17)
    expect(computeScarabBugLightningDamage113c(1)).toBe(1)
    expect(computeScarabBugLightningDamage113c(17)).toBe(9) // 1 + floor(16 / 2)

    const game = new GameInstance({ seed: 199502, difficulty: 0, areaId: 62 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'MaggotRunner',
      level: 18,
      x: 42,
      y: 30,
      areaId: 62,
    })
    // Minion Scarab with Multishot parent mod: minions still fire Scarab #225 on GetHit and Death, never Multishot-tripled
    const minionScarabId = game.spawnMonster({
      hcIdx: 92,
      defId: 'scarab2',
      rank: 'minion',
      umodIds: [MON_UMOD.SCARAB, MON_UMOD.MULTISHOT],
      level: 17,
      minDmg: 50,
      maxDmg: 75,
      hp: 200,
      maxHp: 200,
      x: 30,
      y: 30,
      areaId: 62,
    })

    const internal = game as unknown as {
      missiles: Map<
        number,
        { missileId: number; vx: number; vy: number; physDamage: number; elemDamage: number }
      >
    }

    // 1 damage (< 200/16 = 12.5) -> no GetHit recovery -> 0 Scarab bolts
    internal.missiles.clear()
    game.applyDamageToMonster(minionScarabId, 1, pid, 36, 'fire', 'player', { autoHit: true })
    expect(
      [...internal.missiles.values()].filter((m) => m.missileId === SCARAB_BUGLIGHTNING_MISSILE_ID_113C),
    ).toHaveLength(0)

    // 120 damage (>= 50% maxHp) -> guaranteed MONMODE_GETHIT -> 8 radial #225 bolts with elemDamage = 9
    internal.missiles.clear()
    game.applyDamageToMonster(minionScarabId, 120, pid, 36, 'fire', 'player', { autoHit: true })
    const ghBolts = [...internal.missiles.values()].filter(
      (m) => m.missileId === SCARAB_BUGLIGHTNING_MISSILE_ID_113C,
    )
    expect(ghBolts).toHaveLength(8)
    expect(ghBolts.every((b) => b.physDamage === 0 && b.elemDamage === 9)).toBe(true)
    expect(ghBolts.some((b) => b.vx < 0)).toBe(true)
    expect(ghBolts.some((b) => b.vx > 0)).toBe(true)

    // Lethal blow -> MONMODE_DEATH -> another 8 radial #225 bolts!
    internal.missiles.clear()
    game.drainEvents(pid)
    game.applyDamageToMonster(minionScarabId, 500, pid, 36, 'fire', 'player', { autoHit: true })
    const deathBolts = [...internal.missiles.values()].filter(
      (m) => m.missileId === SCARAB_BUGLIGHTNING_MISSILE_ID_113C,
    )
    expect(deathBolts).toHaveLength(8)

    // ClientWorld parity: minion Scarab spawns 8 buglightning on D2GS mode=3 and mode=0, and does NOT duplicate on SP mode=12
    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 7701,
        classId: 92,
        name: 'scarab2',
        level: 17,
        isMinion: true,
        x: 100,
        y: 100,
        mode: 1,
        lifePct: 100,
      },
    } as never)
    world.applyEvent({
      type: 'UnitMode',
      unitType: 'monster',
      id: 7701,
      mode: 3,
      lifePct: 40,
    } as never)
    const cltGh = world.getUnitsByType('missile').filter((m) => m.missileKey === 'buglightning')
    expect(cltGh).toHaveLength(8)
    expect(cltGh[0]?.skillLevel).toBe(17)

    // Raw D2GS 0xAC (without explicit `level` field): D2Client.dll 0x6FAFD1EC seeds STAT_LEVEL(12) from MonStats.txt Level[0] = 16
    const worldD2gsDefaultLvl = new ClientWorld()
    worldD2gsDefaultLvl.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 7704,
        classId: 92,
        x: 100,
        y: 100,
        mode: 1,
        lifePct: 100,
      },
    } as never)
    expect(worldD2gsDefaultLvl.getUnit('monster', 7704)?.stats.get(12)).toBe(16)

    const worldDeathMode0 = new ClientWorld()
    worldDeathMode0.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 7702,
        classId: 92,
        name: 'scarab2',
        level: 17,
        isMinion: true,
        x: 100,
        y: 100,
        mode: 1,
        lifePct: 100,
      },
    } as never)
    worldDeathMode0.applyEvent({
      type: 'UnitMode',
      unitType: 'monster',
      id: 7702,
      mode: 0,
      lifePct: 0,
    } as never)
    expect(
      worldDeathMode0.getUnitsByType('missile').filter((m) => m.missileKey === 'buglightning'),
    ).toHaveLength(8)

    const worldSpMode12 = new ClientWorld()
    worldSpMode12.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 7703,
        classId: 92,
        name: 'scarab2',
        level: 17,
        isMinion: true,
        x: 100,
        y: 100,
        mode: 1,
        lifePct: 100,
      },
    } as never)
    worldSpMode12.applyEvent({
      type: 'UnitMode',
      unitType: 'monster',
      id: 7703,
      mode: 12,
      lifePct: 0,
    } as never)
    expect(
      worldSpMode12.getUnitsByType('missile').filter((m) => m.missileKey === 'buglightning'),
    ).toHaveLength(0)
  })

  it('MonUMod #10 (PoisonDead): spawns #155 corpsepoisoncloud on death and drains real poison HP over 175 frames (including walk-over)', () => {
    const spec = computePoisonDeadCloudDamage113c(20)
    expect(spec.durationFrames).toBe(POISONDEAD_CLOUD_DURATION_FRAMES_113C)
    expect(spec.bitrate256).toBe(42) // (2 + 19) << 1
    expect(spec.totalPoisonHp).toBe(28) // floor(42 * 175 / 256)

    const game = new GameInstance({ seed: 199503, difficulty: 0, areaId: 60, maxPlayers: 2 })
    const meleePid = game.connectPlayer({
      charClass: 'bar',
      name: 'MeleeGuy',
      level: 20,
      hp: 200,
      maxHp: 200,
      x: 31,
      y: 30,
      areaId: 60,
    })
    const walkerPid = game.connectPlayer({
      charClass: 'sor',
      name: 'Walker',
      level: 20,
      hp: 200,
      maxHp: 200,
      x: 42,
      y: 30,
      areaId: 60,
    })
    const mummyId = game.spawnMonster({
      hcIdx: 9,
      defId: 'zombie5',
      level: 20,
      hp: 50,
      maxHp: 50,
      x: 30,
      y: 30,
      areaId: 60,
    })

    game.drainEvents(meleePid)
    game.applyDamageToMonster(mummyId, 200, meleePid, 0, 'phys', 'player', { autoHit: true })
    const events = game.drainEvents(meleePid)
    expect(
      events.some(
        (e) =>
          e.type === 'CreateMissile' &&
          (e as { missileClassId?: number }).missileClassId === POISONDEAD_CLOUD_MISSILE_ID_113C,
      ),
    ).toBe(true)

    // Melee player immediately enters STATE_POISON (2) and loses real HP as frames step
    expect(game.getPlayerState(meleePid)!.states.has(2)).toBe(true)
    const hpBefore = game.getPlayerState(meleePid)!.hp
    game.stepFrames(50)
    expect(game.getPlayerState(meleePid)!.hp).toBeLessThan(hpBefore - 4)

    // Second player walks onto the lingering 80-frame corpsepoisoncloud at frame 50 and also gets poisoned!
    expect(game.getPlayerState(walkerPid)!.states.has(2)).toBe(false)
    game.movePlayer(walkerPid, 30, 30)
    game.stepFrames(5)
    expect(game.getPlayerState(walkerPid)!.states.has(2)).toBe(true)
    const walkerHpBefore = game.getPlayerState(walkerPid)!.hp
    game.stepFrames(40)
    expect(game.getPlayerState(walkerPid)!.hp).toBeLessThan(walkerHpBefore - 3)
  })

  it('MonUMod #42 (NovaDeath): spawns boss-only 64-bolt #90 nova ring on death and deals lightning damage to nearby player', () => {
    const range = computeNovaDeathDamageRange113c(1)
    expect(range).toEqual({ slvl: 1, minLtng: 1, maxLtng: 20 })

    const game = new GameInstance({ seed: 199504, difficulty: 0, areaId: 74 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'NearBoss',
      level: 22,
      hp: 200,
      maxHp: 200,
      x: 33,
      y: 30,
      areaId: 74,
    })

    // Minion with umod 42 does NOT emit NovaDeath
    const minionId = game.spawnMonster({
      defId: 'fallen1',
      rank: 'minion',
      umodIds: [MON_UMOD.NOVADEATH],
      level: 20,
      hp: 50,
      maxHp: 50,
      x: 30,
      y: 40,
      areaId: 74,
    })
    game.drainEvents(pid)
    game.applyDamageToMonster(minionId, 200, pid, 36, 'fire', 'player', { autoHit: true })
    expect(
      game
        .drainEvents(pid)
        .filter(
          (e) =>
            e.type === 'CreateMissile' &&
            (e as { missileClassId?: number }).missileClassId === NOVADEATH_MISSILE_ID_113C,
        ),
    ).toHaveLength(0)

    // Unique boss with umod 42 emits 64 #90 nova bolts and damages nearby player
    const bossId = game.spawnMonster({
      defId: 'fallen1',
      rank: 'unique',
      umodIds: [MON_UMOD.NOVADEATH],
      level: 20,
      hp: 50,
      maxHp: 50,
      x: 30,
      y: 30,
      areaId: 74,
    })
    const hpBefore = game.getPlayerState(pid)!.hp
    game.drainEvents(pid)
    game.applyDamageToMonster(bossId, 200, pid, 36, 'fire', 'player', { autoHit: true })
    const novaCreateEvents = game
      .drainEvents(pid)
      .filter(
        (e) =>
          e.type === 'CreateMissile' &&
          (e as { missileClassId?: number }).missileClassId === NOVADEATH_MISSILE_ID_113C,
      )
    expect(novaCreateEvents).toHaveLength(64)
    game.stepFrames(6)
    expect(game.getPlayerState(pid)!.hp).toBeLessThan(hpBefore)
  })
})

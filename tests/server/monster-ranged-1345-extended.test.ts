/**
 * Issue #1345 — 1.13c monster ranged attacks and Skill1..8.
 *
 * Covers the gaps left by the first fix: projectile skills are released through
 * the skill registry, Missiles.txt lifetime/size/EType are honoured, terrain
 * collision follows CollideType, and projectile hits use executeSUnitDmg.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { getMissileTxtData } from '../../src/common/skills/missiles-data.ts'

function connectPlayer(game: GameInstance, x: number, y: number): number {
  return game.connectPlayer({ charClass: 'bar', name: 'Target', x, y, areaId: 2 })
}

function missileEvents(
  events: readonly { type: string }[],
): readonly { missileClassId?: number; skillId?: number }[] {
  return events.filter((e) => e.type === 'CreateMissile') as readonly {
    missileClassId?: number
    skillId?: number
  }[]
}

describe('issue #1345 monster skills and missile physics', () => {
  it('casts MonStats Skill2 ShamanFire instead of the generic missile row', () => {
    const game = new GameInstance({ seed: 1345, areaId: 2 })
    const playerId = connectPlayer(game, 10, 10)
    game.spawnMonster({ hcIdx: 58, defId: 'fallenshaman1', x: 18, y: 10, areaId: 2 })
    game.drainEvents(playerId)

    game.stepFrames(60)
    const shots = missileEvents(game.drainEvents(playerId))
    expect(shots.some((e) => e.skillId === 160)).toBe(true)
    expect(shots.some((e) => e.missileClassId === getMissileTxtData('shafire1').id)).toBe(true)
  })

  it('casts ZakarumLightning (Skill2) for a Zakarum Priest', () => {
    const game = new GameInstance({ seed: 1346, areaId: 2 })
    const playerId = connectPlayer(game, 10, 10)
    game.spawnMonster({ hcIdx: 238, defId: 'cantor1', x: 18, y: 10, areaId: 2 })
    game.drainEvents(playerId)

    game.stepFrames(60)
    const shots = missileEvents(game.drainEvents(playerId))
    expect(shots.some((e) => e.skillId === 332)).toBe(true)
    expect(shots.some((e) => e.missileClassId === getMissileTxtData('monsterlight').id)).toBe(true)
  })


  it('summons a Hydra via a monster summon skill', () => {
    const game = new GameInstance({ seed: 2103, areaId: 2 })
    connectPlayer(game, 10, 10)
    const casterId = game.spawnMonster({ defId: 'cantor1', x: 18, y: 10, areaId: 2 })
    const internal = game as unknown as {
      monsters: Map<number, { skills: unknown[]; skillCooldown: number }>
      tryCastMonsterUtilitySkill: (m: unknown, t: { x: number; y: number }, d: number) => boolean
    }
    const caster = internal.monsters.get(casterId)!
    caster.skills = [{ slot: 1, skill: 'Hydra', skillId: 62, mode: 'S1', level: 2 }]
    const before = internal.monsters.size
    expect(internal.tryCastMonsterUtilitySkill(caster, { x: 12, y: 10 }, 8)).toBe(true)
    expect(internal.monsters.size).toBeGreaterThan(before)
  })

  it('sweeps the whole missile segment so fast projectiles cannot tunnel walls', () => {
    const game = new GameInstance({ seed: 2101, areaId: 2 })
    connectPlayer(game, 20, 10)
    const monsterId = game.spawnMonster({ defId: 'fallen1', x: 2, y: 10, areaId: 2, aiDisabled: true })
    const internal = game as unknown as {
      monsters: Map<number, unknown>
      missiles: Map<number, unknown>
    }
    game.setTerrainWalkableCheck((_areaId, x) => Math.round(x) !== 7)
    internal.missiles.set(999, {
      unitId: 999, missileId: 0, skillId: 0, ownerType: 'monster',
      ownerId: monsterId, areaId: 2, x: 5, y: 10, vx: 5, vy: 0,
      damage: 1, remainingFrames: 10, collideType: 3, size: 1,
      pierce: false, nextHit: false, nextDelay: 0, element: 'phys',
      physDamage: 1, elemDamage: 0, elemDurationFrames: 0,
      hitCooldowns: new Map(), guaranteedHit: false,
    })
    game.stepFrames(1)
    expect(internal.missiles.has(999)).toBe(false)
  })

  it('broadcasts a cast animation for Oblivion Knight curses', () => {
    const game = new GameInstance({ seed: 2102, areaId: 2 })
    const playerId = connectPlayer(game, 10, 10)
    const knightId = game.spawnMonster({ hcIdx: 312, defId: 'doomknight3', x: 15, y: 10, areaId: 2 })
    game.drainEvents(playerId)
    game.stepFrames(40)
    const events = game.drainEvents(playerId)
    expect(
      events.some(
        (e) =>
          e.type === 'UnitMode' &&
          (e as { id?: number }).id === knightId &&
          (e as { mode?: number }).mode === 8,
      ),
    ).toBe(true)
  })

  it('casts non-projectile heal and teleport utility skills', () => {
    const game = new GameInstance({ seed: 2100, areaId: 2 })
    connectPlayer(game, 10, 10)
    const monsterId = game.spawnMonster({ defId: 'cantor1', x: 18, y: 10, areaId: 2, hp: 50, maxHp: 500 })
    const internal = game as unknown as {
      monsters: Map<number, { hp: number; x: number; skills: unknown[]; skillCooldown: number }>
      tryCastMonsterUtilitySkill: (m: unknown, t: { x: number; y: number }, d: number) => boolean
    }
    const monster = internal.monsters.get(monsterId)!
    monster.skills = [{ slot: 1, skill: 'ZakarumHeal', skillId: 179, mode: 'S1', level: 1 }]
    expect(internal.tryCastMonsterUtilitySkill(monster, { x: 10, y: 10 }, 8)).toBe(true)
    expect(monster.hp).toBeGreaterThan(50)

    monster.skills = [{ slot: 1, skill: 'MonTeleport', skillId: 184, mode: 'S1', level: 1 }]
    const beforeX = monster.x
    expect(internal.tryCastMonsterUtilitySkill(monster, { x: 10, y: 10 }, 8)).toBe(true)
    expect(monster.x).toBeLessThan(beforeX)
  })

  it('evaluates projectile skills for shaman, priest, knight and act bosses without throwing', () => {
    for (const [hcIdx, defId] of [
      [58, 'fallenshaman1'],
      [238, 'cantor1'],
      [312, 'doomknight3'],
      [242, 'mephisto'],
      [156, 'andariel'],
      [278, 'fetishshaman1'],
      [345, 'councilmember1'],
    ] as const) {
      const game = new GameInstance({ seed: 2000 + hcIdx, areaId: 2 })
      connectPlayer(game, 10, 10)
      game.spawnMonster({ hcIdx, defId, x: 16, y: 10, areaId: 2 })
      expect(() => game.stepFrames(90)).not.toThrow()
    }
  })
  it('uses Missiles.txt range for lifetime and EType for the damage channel', () => {
    const game = new GameInstance({ seed: 1347, areaId: 2 })
    connectPlayer(game, 10, 10)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 10,
      y: 10,
      areaId: 2,
      aiDisabled: true,
    })
    const internal = game as unknown as {
      monsters: Map<number, unknown>
      spawnMonsterMissile: (
        monster: unknown,
        x: number,
        y: number,
        damage: number,
        missileClassId: number,
        skillId: number,
      ) => number
      missiles: Map<number, { remainingFrames: number; element: string; size: number }>
    }
    const missileId = internal.spawnMonsterMissile(
      internal.monsters.get(monsterId),
      10,
      11.5,
      9,
      getMissileTxtData('coldunique').id,
      194,
    )
    const missile = internal.missiles.get(missileId)!
    expect(missile.remainingFrames).toBe(getMissileTxtData('coldunique').range)
    expect(missile.element).toBe('cold')
    expect(missile.size).toBe(1)
  })

  it('stops a non-zero CollideType projectile on a blocked sub-tile', () => {
    const game = new GameInstance({ seed: 1348, areaId: 2 })
    connectPlayer(game, 10, 20)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 5,
      y: 5,
      areaId: 2,
      aiDisabled: true,
    })
    // Only the corridor x=12..14 is a wall.
    game.setTerrainWalkableCheck((_areaId, x) => x < 12 || x > 14)
    const internal = game as unknown as {
      monsters: Map<number, unknown>
      spawnMonsterMissile: (
        monster: unknown,
        x: number,
        y: number,
        damage: number,
        missileClassId: number,
        skillId: number,
      ) => number
      missiles: Map<number, unknown>
      stepFrames: (n: number) => void
    }
    const missileId = internal.spawnMonsterMissile(
      internal.monsters.get(monsterId),
      25,
      5,
      1,
      getMissileTxtData('arrow').id,
      0,
    )
    expect(internal.missiles.has(missileId)).toBe(true)
    game.stepFrames(6)
    expect(internal.missiles.has(missileId)).toBe(false)
  })


  it('routes a monster projectile hit on a mercenary through executeSUnitDmg', () => {
    const game = new GameInstance({ seed: 1350, areaId: 2 })
    const playerId = connectPlayer(game, 10, 30)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 5,
      y: 10,
      areaId: 2,
      level: 99,
      ar: 100_000,
      minDmg: 10,
      maxDmg: 10,
      aiDisabled: true,
    })
    const internal = game as unknown as {
      monsters: Map<number, unknown>
      applyMonsterMissileToDefender: (
        monster: unknown,
        missile: unknown,
        defender: unknown,
      ) => number
    }
    const monster = internal.monsters.get(monsterId)
    const missile = {
      skillId: 0,
      physDamage: 10,
      elemDamage: 0,
      element: 'phys',
      elemDurationFrames: 0,
    }
    let hp = 500
    for (let i = 0; i < 8 && hp === 500; i++) {
      hp = internal.applyMonsterMissileToDefender(monster, missile, {
        id: `merc_${i}`,
        name: 'Mercenary',
        unitType: 'mercenary',
        level: 1,
        hp: 500,
        maxHp: 500,
      })
    }
    expect(hp).toBeLessThan(500)
  })


  it('piercing arrows continue past the first player and can hit a second target', () => {
    const game = new GameInstance({ seed: 1351, areaId: 2, maxPlayers: 8 })
    const nearId = game.connectPlayer({ charClass: 'bar', name: 'Near', x: 10, y: 10, areaId: 2 })
    const farId = game.connectPlayer({ charClass: 'bar', name: 'Far', x: 14, y: 10, areaId: 2 })
    const nearStart = game.getPlayerState(nearId)!.hp
    const farStart = game.getPlayerState(farId)!.hp
    game.spawnMonster({
      hcIdx: 160,
      defId: 'cr_archer1',
      x: 5,
      y: 10,
      areaId: 2,
      level: 99,
      ar: 100_000,
      minDmg: 5,
      maxDmg: 5,
    })
    game.stepFrames(120)
    expect(game.getPlayerState(nearId)!.hp).toBeLessThan(nearStart)
    expect(game.getPlayerState(farId)!.hp).toBeLessThan(farStart)
  })

  it('rotates through multiple Skill1..8 projectile slots', () => {
    const game = new GameInstance({ seed: 1352, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 2, level: 99, hp: 5000, maxHp: 5000 })
    game.spawnMonster({ hcIdx: 242, defId: 'mephisto', x: 20, y: 10, areaId: 2 })
    game.drainEvents(playerId)
    game.stepFrames(400)
    const skillIds = new Set(
      missileEvents(game.drainEvents(playerId))
        .map((e) => e.skillId)
        .filter((id): id is number => id !== undefined && id > 0),
    )
    expect(skillIds.size).toBeGreaterThan(1)
  })
  it('routes a monster projectile hit through executeSUnitDmg events', () => {
    const game = new GameInstance({ seed: 1349, areaId: 2 })
    const playerId = connectPlayer(game, 10, 10)
    const startHp = game.getPlayerState(playerId)!.hp
    game.spawnMonster({ hcIdx: 58, defId: 'fallenshaman1', x: 14, y: 10, areaId: 2, minDmg: 8, maxDmg: 8 })
    game.drainEvents(playerId)

    game.stepFrames(60)
    const events = game.drainEvents(playerId)
    expect(game.getPlayerState(playerId)!.hp).toBeLessThan(startHp)
    expect(events.some((e) => e.type === 'UnitStatUpdate' && e.statId === 6)).toBe(true)
    expect(events.some((e) => e.type === 'LifeMana')).toBe(true)
  })

  it('blocks a monster projectile on a closed door (COLLIDE_DOOR) and lets it pass when opened', () => {
    const game = new GameInstance({ seed: 1353, areaId: 2 })
    connectPlayer(game, 25, 10)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 5,
      y: 10,
      areaId: 2,
      aiDisabled: true,
    })
    // Object classId 13 (Doorby1, isDoor = 1 in Objects.txt) closed (mode 0) at (12, 10).
    const doorId = game.spawnObject({ classId: 13, x: 12, y: 10, areaId: 2, mode: 0 })
    const internal = game as unknown as {
      monsters: Map<number, unknown>
      objects: Map<number, { mode: number }>
      spawnMonsterMissile: (
        monster: unknown,
        x: number,
        y: number,
        damage: number,
        missileClassId: number,
        skillId: number,
      ) => number
      missiles: Map<number, unknown>
    }
    const blockedMissileId = internal.spawnMonsterMissile(
      internal.monsters.get(monsterId),
      25,
      10,
      5,
      getMissileTxtData('arrow').id,
      0,
    )
    game.stepFrames(10)
    expect(internal.missiles.has(blockedMissileId)).toBe(false)

    // Open the door (mode 2) and verify the arrow passes through x=12.
    internal.objects.get(doorId)!.mode = 2
    const openMissileId = internal.spawnMonsterMissile(
      internal.monsters.get(monsterId),
      25,
      10,
      5,
      getMissileTxtData('arrow').id,
      0,
    )
    game.stepFrames(6)
    expect(internal.missiles.has(openMissileId)).toBe(true)
  })

  it('broadcasts UnitMode for ranged MissA1/A2/S1 attacks and aims at the target coordinate instead of fixed 12', () => {
    const game = new GameInstance({ seed: 1354, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'FarTarget', x: 30, y: 10, areaId: 2 })
    const archerId = game.spawnMonster({
      hcIdx: 160,
      defId: 'cr_archer1',
      x: 10,
      y: 10,
      areaId: 2,
      aggroRadius: 40,
    })
    game.drainEvents(playerId)
    game.stepFrames(30)
    const events = game.drainEvents(playerId)
    expect(
      events.some(
        (e) =>
          e.type === 'UnitMode' &&
          (e as { id?: number }).id === archerId &&
          (e as { mode?: number }).mode === 4,
      ),
    ).toBe(true)
    const shot = events.find((e) => e.type === 'CreateMissile') as
      | { targetX?: number; targetY?: number }
      | undefined
    expect(shot).toBeDefined()
    expect(shot!.targetX).toBe(30)
    expect(shot!.targetY).toBe(10)
  })

  it('emits UnitStatUpdate and UnitRemove when a monster missile kills a summon and ignores summons in other areas', () => {
    const game = new GameInstance({ seed: 1355, areaId: 2, maxPlayers: 8 })
    const sameAreaDruid = game.connectPlayer({
      charClass: 'dru',
      name: 'SameAreaDruid',
      x: 25,
      y: 10,
      areaId: 2,
      level: 30,
    })
    const otherAreaDruid = game.connectPlayer({
      charClass: 'dru',
      name: 'OtherAreaDruid',
      x: 10,
      y: 10,
      areaId: 4,
      level: 30,
    })
    const sameWolf = game.summonPet(sameAreaDruid, { skillId: 227, slvl: 1, x: 10, y: 10 })
    const otherWolf = game.summonPet(otherAreaDruid, { skillId: 227, slvl: 1, x: 10, y: 10 })
    expect(sameWolf.created).toBe(true)
    expect(otherWolf.created).toBe(true)
    const otherPetBeforeHp = game.getPetsForOwner(otherAreaDruid)[0]!.hp

    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 6,
      y: 10,
      areaId: 2,
      level: 99,
      ar: 100_000,
      aiDisabled: true,
    })
    game.drainEvents(sameAreaDruid)
    const internal = game as unknown as {
      monsters: Map<number, unknown>
      spawnMonsterMissile: (
        monster: unknown,
        x: number,
        y: number,
        damage: number,
        missileClassId: number,
        skillId: number,
        opts?: Record<string, unknown>,
      ) => number
    }
    internal.spawnMonsterMissile(
      internal.monsters.get(monsterId),
      15,
      10,
      500,
      getMissileTxtData('arrow').id,
      0,
      { physDamage: 500, guaranteed: true },
    )
    game.stepFrames(6)
    const events = game.drainEvents(sameAreaDruid)
    expect(events.some((e) => e.type === 'UnitStatUpdate' && e.statId === 6)).toBe(true)
    expect(events.some((e) => e.type === 'UnitRemove')).toBe(true)
    expect(game.getPetsForOwner(sameAreaDruid)).toHaveLength(0)
    // Summon in area 4 must be completely untouched by a missile in area 2.
    expect(game.getPetsForOwner(otherAreaDruid)).toHaveLength(1)
    expect(game.getPetsForOwner(otherAreaDruid)[0]!.hp).toBe(otherPetBeforeHp)
  })

  it('applies Amazon Avoid (skill 18) and player physical damage reduction (stat 36/34) to monster missiles', () => {
    const game = new GameInstance({ seed: 1356, areaId: 2 })
    const amaId = game.connectPlayer({
      charClass: 'ama',
      name: 'Zon',
      x: 10,
      y: 10,
      areaId: 2,
      hp: 500,
      maxHp: 500,
    })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          skills: Map<number, number>
          items: { location: string; bodyLoc: number; stats: Map<number, number> }[]
        }
      >
      monsters: Map<number, unknown>
      resolveMonsterAttackOnPlayer: (
        monster: unknown,
        player: unknown,
        swing: Record<string, unknown>,
      ) => void
    }
    const ama = internal.players.get(amaId)!
    // Skill 18 = Avoid (stationary missile avoidance) at slvl 20 (~65% chance)
    ama.skills.set(18, 20)
    // Equip 50% physical DR (stat 36) + 5 flat DR (stat 34)
    ama.items.push({
      location: 'equipped',
      bodyLoc: 3,
      stats: new Map([
        [36, 50],
        [34, 5],
      ]),
    })
    const monsterId = game.spawnMonster({
      defId: 'cr_archer1',
      x: 14,
      y: 10,
      areaId: 2,
      level: 80,
      ar: 100_000,
      aiDisabled: true,
    })
    const monster = internal.monsters.get(monsterId)
    let hitsLanded = 0
    for (let i = 0; i < 20; i++) {
      const before = game.getPlayerState(amaId)!.hp
      internal.resolveMonsterAttackOnPlayer(monster, ama, {
        minDmg: 20,
        maxDmg: 20,
        skillMode: 'A1',
        attackKind: 'missile',
        skillId: 0,
        fromMissile: true,
        autoHit: true,
      })
      const after = game.getPlayerState(amaId)!.hp
      if (after < before) {
        hitsLanded += 1
        // 20 raw phys - 5 flat DR = 15, then 50% damageresist -> floor(15 * 0.5) = 7 damage
        expect(before - after).toBe(7)
      }
    }
    // Avoid (~65%) must avoid a significant portion of the 20 shots, while non-avoided shots take mitigated damage.
    expect(hitsLanded).toBeGreaterThan(0)
    expect(hitsLanded).toBeLessThan(20)
  })
})
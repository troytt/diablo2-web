import { describe, expect, it } from 'vitest'
import {
  isNonMeleeMonsterAi113c,
  isPassiveMonsterAi113c,
  monaiProfile113c,
} from '../../src/common/units/monai-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface TestMonsterView {
  readonly unitId: number
  readonly hcIdx: number
  readonly ai: string
  readonly align: 0 | 1 | 2
  readonly monsterPlayerCount: number
  x: number
  y: number
  hp: number
  maxHp: number
  dead: boolean
  mode: number
  nextAiFrame: number
  spiritAttackedOnce: boolean
  trappedSoulState: number
  pendingAttack: unknown
}

interface TestPlayerView {
  readonly unitId: number
  x: number
  y: number
  hp: number
  maxHp: number
  mana: number
  maxMana: number
  rightSkill: number
  skills: Map<number, number>
}

function getMonsters(game: GameInstance): Map<number, TestMonsterView> {
  return (game as unknown as { monsters: Map<number, TestMonsterView> }).monsters
}

function getPlayers(game: GameInstance): Map<number, TestPlayerView> {
  return (game as unknown as { players: Map<number, TestPlayerView> }).players
}

describe('Issue #2005: 1.13c Spirit one-shot, TrappedSoul fidget, Idle/non-melee stationary AI guards, and MonStats Align faction rules', () => {
  it('enforces AITHINK_Fn097_Spirit (0x6FC360B0) one-shot melee latch on #401 mephistospirit', () => {
    const game = new GameInstance({ seed: 200501, areaId: 102, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'DuranceSorc',
      x: 11.5,
      y: 10,
      areaId: 102,
      hp: 5000,
      maxHp: 5000,
    })
    const spiritId = game.spawnMonster({
      hcIdx: 401,
      defId: 'mephistospirit',
      x: 10,
      y: 10,
      areaId: 102,
      hp: 500,
      maxHp: 500,
    })
    const monsters = getMonsters(game)
    const spirit = monsters.get(spiritId)!
    expect(spirit.spiritAttackedOnce).toBe(false)
    game.drainEvents(pid)

    let mode4Swings = 0
    for (let f = 0; f < 30; f += 1) {
      game.stepFrames(1)
      for (const ev of game.drainEvents(pid)) {
        if (
          ev.type === 'UnitMode' &&
          (ev as { id?: number; mode?: number }).id === spiritId &&
          ((ev as { mode?: number }).mode === 4 || (ev as { mode?: number }).mode === 5)
        ) {
          mode4Swings += 1
        }
      }
    }

    expect(spirit.spiritAttackedOnce).toBe(true)
    expect(mode4Swings).toBe(1)

    const hpAfterFirstSwing = getPlayers(game).get(pid)!.hp
    let subsequentSwings = 0
    for (let f = 0; f < 250; f += 1) {
      game.stepFrames(1)
      for (const ev of game.drainEvents(pid)) {
        if (
          ev.type === 'UnitMode' &&
          (ev as { id?: number; mode?: number }).id === spiritId &&
          ((ev as { mode?: number }).mode === 4 || (ev as { mode?: number }).mode === 5)
        ) {
          subsequentSwings += 1
        }
      }
    }
    expect(subsequentSwings).toBe(0)
    expect(getPlayers(game).get(pid)!.hp).toBe(hpAfterFirstSwing)
    expect(spirit.x).toBe(10)
    expect(spirit.y).toBe(10)
  })

  it('enforces AITHINK_Fn099_TrappedSoul (0x6FCC5580) proximity fidget modes without dealing melee damage while remaining killable', () => {
    const game = new GameInstance({ seed: 200502, areaId: 104, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'SoulRunner',
      x: 11.5, // < 5 subtiles
      y: 10,
      areaId: 104,
      hp: 4000,
      maxHp: 4000,
    })
    const s1 = game.spawnMonster({ hcIdx: 403, defId: 'trappedsoul1', x: 10, y: 10, areaId: 104 })
    const s2 = game.spawnMonster({ hcIdx: 404, defId: 'trappedsoul2', x: 10, y: 11, areaId: 104 })
    const monsters = getMonsters(game)
    const soul1 = monsters.get(s1)!
    const soul2 = monsters.get(s2)!
    expect(soul1.align).toBe(0)
    expect(soul2.align).toBe(0)
    game.drainEvents(pid)

    const seenModes = new Set<number>()
    for (let f = 0; f < 200; f += 1) {
      game.stepFrames(1)
      for (const ev of game.drainEvents(pid)) {
        if (ev.type === 'UnitMode' && (ev as { id?: number }).id === s1) {
          seenModes.add((ev as { mode: number }).mode)
        }
      }
    }
    expect(soul1.trappedSoulState).toBe(1)
    expect(seenModes.has(9)).toBe(true) // MONMODE_SKILL2 wake
    expect(seenModes.has(4) || seenModes.has(5)).toBe(true) // visual fidget
    expect(getPlayers(game).get(pid)!.hp).toBe(4000) // zero melee damage!
    expect(soul1.x).toBe(10)
    expect(soul1.y).toBe(10)

    // Move player >= 5 subtiles away -> returns to rest via MONMODE_SKILL1 (8)
    game.movePlayer(pid, 22, 10)
    let sawRestMode8 = false
    for (let f = 0; f < 50; f += 1) {
      game.stepFrames(1)
      for (const ev of game.drainEvents(pid)) {
        if (
          ev.type === 'UnitMode' &&
          (ev as { id?: number; mode?: number }).id === s1 &&
          (ev as { mode?: number }).mode === 8
        ) {
          sawRestMode8 = true
        }
      }
    }
    expect(soul1.trappedSoulState).toBe(0)
    expect(sawRestMode8).toBe(true)

    // Player attacks can still damage and kill Trapped Souls
    const killed = game.applyDamageToMonster(pid, s1, 50000, 47, 'fire', 'player', {
      attackKind: 'spell',
      autoHit: true,
      unblockable: true,
    })
    expect(killed || soul1.dead).toBe(true)
  })

  it('prevents Idle props/doors and non-melee traps/turrets/spawners/controllers from chasing or melee-swinging while preserving #354 Trap-Melee and evil #62 Hydra turrets', () => {
    for (const ai of ['Idle', 'None', 'BoneWall', 'DarkWanderer', 'AncientStatue', 'InvisoSpawner']) {
      expect(isPassiveMonsterAi113c(ai)).toBe(true)
      expect(isNonMeleeMonsterAi113c(ai)).toBe(true)
    }
    for (const ai of [
      'Trap-Missile',
      'Trap-RightArrow',
      'Trap-LeftArrow',
      'Trap-Poison',
      'Trap-Nova',
      'ArcaneTower',
      'DesertTurret',
      'Hydra',
      'EvilHole',
      'MinionSpawner',
      'CatapultSpotter',
      'BaalTaunt',
      'HellMeteor',
    ]) {
      expect(isNonMeleeMonsterAi113c(ai)).toBe(true)
    }
    for (const ai of ['DarkWanderer', 'BaalTaunt', 'HellMeteor', 'CatapultSpotter']) {
      expect(monaiProfile113c(ai).family).toBe('stationary')
    }
    expect(isNonMeleeMonsterAi113c('Trap-Melee')).toBe(false)

    const game = new GameInstance({ seed: 200503, areaId: 110, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'bar',
      name: 'SiegeTester',
      x: 20,
      y: 20,
      areaId: 110,
      hp: 8000,
      maxHp: 8000,
    })

    const nonMeleeRows: ReadonlyArray<{ hcIdx: number; defId: string }> = [
      { hcIdx: 340, defId: 'boneprison1' },
      { hcIdx: 432, defId: 'barricadedoor1' },
      { hcIdx: 434, defId: 'prisondoor' },
      { hcIdx: 524, defId: 'barricadewall1' },
      { hcIdx: 392, defId: 'window1' },
      { hcIdx: 574, defId: 'worldstoneeffect' },
      { hcIdx: 368, defId: 'darkwanderer' },
      { hcIdx: 326, defId: 'trap-firebolt' },
      { hcIdx: 327, defId: 'trap-horzmissile' },
      { hcIdx: 371, defId: 'lightningspire' },
      { hcIdx: 372, defId: 'firetower' },
      { hcIdx: 321, defId: 'evilhole1' },
      { hcIdx: 484, defId: 'minionspawner1' },
      { hcIdx: 516, defId: 'catapultspotter1' },
      { hcIdx: 545, defId: 'baaltaunt' },
      { hcIdx: 153, defId: 'hellmeteor' },
    ]
    const spawnedNonMeleeIds = nonMeleeRows.map((spec) =>
      game.spawnMonster({
        hcIdx: spec.hcIdx,
        defId: spec.defId,
        x: 21.5, // adjacent to player (1.5 subtiles)
        y: 20,
        areaId: 110,
      }),
    )

    const monsters = getMonsters(game)
    let sawAnyPendingMelee = false
    for (let f = 0; f < 120; f += 1) {
      game.stepFrames(1)
      for (const id of spawnedNonMeleeIds) {
        const m = monsters.get(id)!
        if (m.pendingAttack !== undefined) {
          sawAnyPendingMelee = true
        }
        expect(m.x).toBe(21.5)
        expect(m.y).toBe(20)
      }
    }
    expect(sawAnyPendingMelee).toBe(false)

    // Conversely, #354 trap-melee (`Trap-Melee` @ 0x6FC9BF50) DOES initiate melee attacks adjacent to player
    const gameMeleeTrap = new GameInstance({ seed: 200504, areaId: 79, difficulty: 0 })
    gameMeleeTrap.connectPlayer({
      charClass: 'sor',
      name: 'TrapToucher',
      x: 11.5,
      y: 10,
      areaId: 79,
      hp: 5000,
      maxHp: 5000,
    })
    const meleeTrapId = gameMeleeTrap.spawnMonster({
      hcIdx: 354,
      defId: 'trap-melee',
      x: 10,
      y: 10,
      areaId: 79,
      minDmg: 25,
      maxDmg: 35,
      ar: 5000,
    })
    const trapMonsters = getMonsters(gameMeleeTrap)
    let sawMeleeTrapAttack = false
    for (let f = 0; f < 60; f += 1) {
      gameMeleeTrap.stepFrames(1)
      if (trapMonsters.get(meleeTrapId)!.pendingAttack !== undefined) {
        sawMeleeTrapAttack = true
      }
    }
    expect(sawMeleeTrapAttack).toBe(true)

    // Evil Council #62 Hydra spawns #351 hydra1 with align = 0 and fires ranged bolts even at d = 1.5 without melee
    const gameHydra = new GameInstance({ seed: 200505, areaId: 83, difficulty: 0 })
    const hPid = gameHydra.connectPlayer({
      charClass: 'sor',
      name: 'HydraTarget',
      x: 11.5,
      y: 10,
      areaId: 83,
      hp: 5000,
      maxHp: 5000,
    })
    const hydraId = gameHydra.spawnMonster({
      hcIdx: 351,
      defId: 'hydra1',
      x: 10,
      y: 10,
      areaId: 83,
      hp: 400,
      maxHp: 400,
    })
    const hydra = getMonsters(gameHydra).get(hydraId)!
    expect(hydra.align).toBe(0)
    gameHydra.drainEvents(hPid)
    let sawHydraMelee = false
    let sawHydraBolt = false
    for (let f = 0; f < 60; f += 1) {
      gameHydra.stepFrames(1)
      if (hydra.pendingAttack !== undefined) sawHydraMelee = true
      for (const ev of gameHydra.drainEvents(hPid)) {
        if (ev.type === 'SkillCast') {
          sawHydraBolt = true
        }
      }
    }
    expect(sawHydraMelee).toBe(false)
    expect(sawHydraBolt).toBe(true)
  })

  it('enforces MonStats Align = 1/2 friendly & neutral faction immunity vs players/mercs/pets/auras while NpcBarb fights evil monsters', () => {
    const game = new GameInstance({ seed: 200506, areaId: 111, difficulty: 0 })
    game.setPlayersX(8)
    const pid = game.connectPlayer({
      charClass: 'pal',
      name: 'HighlandsPal',
      x: 20,
      y: 20,
      areaId: 111,
      level: 30,
      hp: 5000,
      maxHp: 5000,
      mana: 1000,
      maxMana: 1000,
    })
    const pal = getPlayers(game).get(pid)!
    pal.skills.set(118, 10) // #118 Holy Shock radial damage aura
    pal.skills.set(48, 10) // #48 Nova
    pal.rightSkill = 118

    game.hireMercenary(pid, { act: 2, level: 28 })
    game.summonPet(pid, { petType: 3, skillId: 70, slvl: 10, x: 20.5, y: 20.5 }) // NecroSkeleton

    const barb1Id = game.spawnMonster({ hcIdx: 522, defId: 'act5barb1', x: 21, y: 20, areaId: 111, hp: 600, maxHp: 600 })
    const barb3Id = game.spawnMonster({ hcIdx: 535, defId: 'act5barb3', x: 21, y: 21, areaId: 111, hp: 600, maxHp: 600 })
    const powId = game.spawnMonster({ hcIdx: 534, defId: 'act5pow', x: 19, y: 20, areaId: 111, hp: 600, maxHp: 600 })
    const ratId = game.spawnMonster({ hcIdx: 151, defId: 'rat', x: 19, y: 21, areaId: 111, hp: 50, maxHp: 50 })
    const cowId = game.spawnMonster({ hcIdx: 179, defId: 'cow', x: 20, y: 21.5, areaId: 111, hp: 200, maxHp: 200 })

    const monsters = getMonsters(game)
    expect(monsters.get(barb1Id)!.align).toBe(1)
    expect(monsters.get(barb3Id)!.align).toBe(1)
    expect(monsters.get(powId)!.align).toBe(1)
    expect(monsters.get(ratId)!.align).toBe(1)
    expect(monsters.get(cowId)!.align).toBe(2)
    // Friendly/neutral units ignore /players 8 monsterPlayerCount scaling
    expect(monsters.get(barb1Id)!.monsterPlayerCount).toBe(1)
    expect(monsters.get(cowId)!.monsterPlayerCount).toBe(1)

    // Direct player damage, Nova cast, Holy Shock pulse, mercenary AI, and pet AI must all deal 0 damage to align != 0
    for (const fid of [barb1Id, barb3Id, powId, ratId, cowId]) {
      const killed = game.applyDamageToMonster(pid, fid, 9999, 48, 'ltng', 'player', {
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
      })
      expect(killed).toBe(false)
    }
    game.enqueueCommand(pid, {
      type: 'CastSkillAtLocation',
      skillId: 48,
      hand: 'left',
      x: 20,
      y: 20,
    })

    for (let f = 0; f < 100; f += 1) {
      game.stepFrames(1)
    }

    expect(monsters.get(barb1Id)!.hp).toBe(600)
    expect(monsters.get(barb3Id)!.hp).toBe(600)
    expect(monsters.get(powId)!.hp).toBe(600)
    expect(monsters.get(ratId)!.hp).toBe(50)
    expect(monsters.get(cowId)!.hp).toBe(200)
    expect(pal.hp).toBe(5000)

    // Now spawn an evil Act 5 monster (`#453 imp1`, align = 0) next to `act5barb1` (`NpcBarb`) on an isolated battlefield
    const duelGame = new GameInstance({ seed: 200507, areaId: 111, difficulty: 0 })
    duelGame.connectPlayer({
      charClass: 'sor',
      name: 'Observer',
      x: 45, // within AOI, far outside aggro range
      y: 20,
      areaId: 111,
      hp: 5000,
      maxHp: 5000,
    })
    const soldierId = duelGame.spawnMonster({
      hcIdx: 522,
      defId: 'act5barb1',
      x: 10,
      y: 20,
      areaId: 111,
      hp: 2000,
      maxHp: 2000,
      minDmg: 40,
      maxDmg: 60,
      ar: 8000,
      ac: 0,
    })
    const impId = duelGame.spawnMonster({
      hcIdx: 453,
      defId: 'imp1',
      x: 13,
      y: 20,
      areaId: 111,
      hp: 2000,
      maxHp: 2000,
      minDmg: 25,
      maxDmg: 35,
      ar: 8000,
      ac: 0,
    })
    const duelMonsters = getMonsters(duelGame)
    const soldier = duelMonsters.get(soldierId)!
    const imp = duelMonsters.get(impId)!
    expect(soldier.align).toBe(1)
    expect(imp.align).toBe(0)

    for (let f = 0; f < 100; f += 1) {
      duelGame.stepFrames(1)
    }

    // Both NpcBarb soldier and evil monster close into melee and damage each other!
    expect(imp.hp).toBeLessThan(2000)
    expect(soldier.hp).toBeLessThan(2000)
  })
})

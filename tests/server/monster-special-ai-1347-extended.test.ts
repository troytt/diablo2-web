/**
 * Issue #1347 follow-up — resurrection action frame and Mind Blast conversion.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function connect(game: GameInstance, x = 80, y = 80): number {
  return game.connectPlayer({ charClass: 'bar', name: 'Target', x, y, areaId: 1 })
}

describe('issue #1347 special AI follow-up', () => {
  it('revives on the S1 action frame, not on the cast frame', () => {
    const game = new GameInstance({ seed: 1347, areaId: 1 })
    const playerId = connect(game)
    game.spawnMonster({
      defId: 'fallenshaman1',
      x: 30,
      y: 30,
      areaId: 1,
      aiParams: [45, 60, 100, 24, 15],
    })
    const corpse = game.spawnMonster({
      defId: 'fallen1',
      x: 31,
      y: 30,
      areaId: 1,
      maxHp: 50,
      hp: 50,
    })
    game.applyDamageToMonster(corpse, 1000, playerId)
    game.drainEvents(playerId)

    game.stepFrames(1)
    expect(game.getMonsterState(corpse)!.dead).toBe(true)
    game.stepFrames(8)
    expect(game.getMonsterState(corpse)!.dead).toBe(false)
  })

  it('Mind Blast converts its targets to the caster while stunned', () => {
    const game = new GameInstance({ seed: 1348, areaId: 2 })
    const playerId = game.connectPlayer({
      charClass: 'ass',
      name: 'Sin',
      x: 100,
      y: 100,
      areaId: 2,
      level: 30,
      skills: { 273: 5 },
    })
    const targetId = game.spawnMonster({
      defId: 'fallen1',
      x: 101,
      y: 100,
      areaId: 2,
      hp: 5000,
      maxHp: 5000,
      damageRegen: 0,
    })
    game.enqueueCommand(playerId, {
      type: 'CastSkillAtLocation',
      skillId: 273,
      x: 101,
      y: 100,
      hand: 'right',
    })
    const pRec = (game as unknown as {
      players: Map<number, { skills: Map<number, number>; mana: number; manaFixed: number }>
    }).players.get(playerId)!
    expect([...pRec.skills.keys()]).toContain(273)
    pRec.mana = 500
    pRec.manaFixed = 500 * 256
    ;(pRec as unknown as { rightSkill: number }).rightSkill = 273
    game.stepFrames(5)
    const internal = game as unknown as {
      monsters: Map<
        number,
        { convertedUntilFrame: number; convertedByPlayerId: number; states: Set<number> }
      >
    }
    const target = internal.monsters.get(targetId)!
    expect(game.getMonsterState(targetId)!.states.has(21)).toBe(true)
    expect(target.convertedByPlayerId).toBe(playerId)
    expect(target.convertedUntilFrame).toBeGreaterThan(game.frame)
  })

  it('does not treat SkeletonRaise (158) on skeletons or fetishes as a corpse-resurrecting caster skill', () => {
    const game = new GameInstance({ seed: 1349, areaId: 1 })
    const playerId = connect(game)
    const skeleton = game.spawnMonster({
      defId: 'skeleton1',
      x: 30,
      y: 30,
      areaId: 1,
    })
    const fetish = game.spawnMonster({
      defId: 'fetish1',
      x: 30,
      y: 32,
      areaId: 1,
    })
    const deadSkeleton = game.spawnMonster({
      defId: 'skeleton1',
      x: 31,
      y: 30,
      areaId: 1,
      maxHp: 40,
      hp: 40,
    })
    const deadFetish = game.spawnMonster({
      defId: 'fetish1',
      x: 31,
      y: 32,
      areaId: 1,
      maxHp: 40,
      hp: 40,
    })
    game.applyDamageToMonster(deadSkeleton, 1000, playerId)
    game.applyDamageToMonster(deadFetish, 1000, playerId)
    game.stepFrames(30)
    expect(game.getMonsterState(skeleton)!.dead).toBe(false)
    expect(game.getMonsterState(fetish)!.dead).toBe(false)
    expect(game.getMonsterState(deadSkeleton)!.dead).toBe(true)
    expect(game.getMonsterState(deadFetish)!.dead).toBe(true)
  })

  it('GreaterMummy uses aip5 as resurrection search radius and does not resurrect other unravelers', () => {
    const game = new GameInstance({ seed: 1350, areaId: 1 })
    const playerId = connect(game)
    // aip4 = 60 (UnHolyBolt chance), aip5 = 5 (search radius)
    game.spawnMonster({
      defId: 'unraveler1',
      x: 30,
      y: 30,
      areaId: 1,
      aiParams: [70, 30, 40, 60, 5],
    })
    const farMummyCorpse = game.spawnMonster({
      defId: 'mummy1',
      x: 45,
      y: 30,
      areaId: 1,
      maxHp: 50,
      hp: 50,
    })
    const nearUnravelerCorpse = game.spawnMonster({
      defId: 'unraveler1',
      x: 31,
      y: 30,
      areaId: 1,
      maxHp: 50,
      hp: 50,
    })
    game.applyDamageToMonster(farMummyCorpse, 1000, playerId)
    game.applyDamageToMonster(nearUnravelerCorpse, 1000, playerId)
    game.stepFrames(15)
    expect(game.getMonsterState(farMummyCorpse)!.dead).toBe(true)
    expect(game.getMonsterState(nearUnravelerCorpse)!.dead).toBe(true)
  })

  it('credits the Attract caster when a normal monster kills an Attracted target even if another player is closer', () => {
    const game = new GameInstance({ seed: 1351, areaId: 1, maxPlayers: 8 })
    const attractCasterId = game.connectPlayer({
      charClass: 'nec',
      name: 'Curser',
      x: 90,
      y: 90,
      areaId: 1,
    })
    const bystanderId = game.connectPlayer({
      charClass: 'bar',
      name: 'Bystander',
      x: 35,
      y: 30,
      areaId: 1,
    })
    game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      maxHp: 500,
      hp: 500,
      minDmg: 80,
      maxDmg: 80,
      ar: 100000,
      damageRegen: 0,
    })
    const attractedVictim = game.spawnMonster({
      defId: 'fallen1',
      x: 31,
      y: 30,
      areaId: 1,
      maxHp: 40,
      hp: 40,
      minDmg: 1,
      maxDmg: 1,
      ac: 0,
      damageRegen: 0,
    })
    game.applyMonsterState(attractedVictim, 57, 300, { sourcePlayerId: attractCasterId })
    const casterXpBefore = game.getPlayerState(attractCasterId)!.experience
    const bystanderXpBefore = game.getPlayerState(bystanderId)!.experience

    game.stepFrames(60)
    expect(game.getMonsterState(attractedVictim)!.dead).toBe(true)
    expect(game.getPlayerState(attractCasterId)!.experience).toBeGreaterThan(casterXpBefore)
    expect(game.getPlayerState(bystanderId)!.experience).toBe(bystanderXpBefore)
  })

  it('confused/converted spellcasters and archers fire projectiles at monster targets and respect resistances', () => {
    const game = new GameInstance({ seed: 1352, areaId: 1 })
    const playerId = connect(game, 32, 30)
    const shaman = game.spawnMonster({
      defId: 'fallenshaman1',
      x: 30,
      y: 30,
      areaId: 1,
      maxHp: 500,
      hp: 500,
      velocity: 0,
      runSpeed: 0,
      damageRegen: 0,
    })
    const fireVulnerableTarget = game.spawnMonster({
      defId: 'fallen1',
      x: 35,
      y: 30,
      areaId: 1,
      maxHp: 200,
      hp: 200,
      velocity: 0,
      runSpeed: 0,
      resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
      damageRegen: 0,
    })
    // Convert the shaman to fight for playerId; its ShamanFire projectile must pass over the
    // allied player at (32, 30) without hurting them and damage the hostile monster at (35, 30).
    game.applyMonsterState(shaman, 53, 300, { sourcePlayerId: playerId })
    const playerHpBefore = game.getPlayerState(playerId)!.hp
    game.stepFrames(25)
    expect(game.getPlayerState(playerId)!.hp).toBe(playerHpBefore)
    expect(game.getMonsterState(fireVulnerableTarget)!.hp).toBeLessThan(200)

    // Repeat against a 100% fire-immune monster: ShamanFire deals 0 damage.
    const gameImmune = new GameInstance({ seed: 1352, areaId: 1 })
    const player2 = connect(gameImmune, 32, 30)
    const shaman2 = gameImmune.spawnMonster({
      defId: 'fallenshaman1',
      x: 30,
      y: 30,
      areaId: 1,
      maxHp: 500,
      hp: 500,
      velocity: 0,
      runSpeed: 0,
      damageRegen: 0,
    })
    const fireImmuneTarget = gameImmune.spawnMonster({
      defId: 'fallen1',
      x: 35,
      y: 30,
      areaId: 1,
      maxHp: 200,
      hp: 200,
      velocity: 0,
      runSpeed: 0,
      resistances: { phys: 0, magic: 0, fire: 100, light: 0, cold: 0, poison: 0 },
      damageRegen: 0,
    })
    gameImmune.applyMonsterState(shaman2, 53, 300, { sourcePlayerId: player2 })
    gameImmune.stepFrames(25)
    expect(gameImmune.getMonsterState(fireImmuneTarget)!.hp).toBe(200)
  })

  it('Overseer casts Overseer Whip (295) to apply bloodlust (140) to a nearby minion instead of spawning suicideminion1', () => {
    const game = new GameInstance({ seed: 1353, areaId: 1 })
    connect(game, 38, 30)
    game.spawnMonster({
      defId: 'overseer1',
      x: 30,
      y: 30,
      areaId: 1,
      maxHp: 500,
      hp: 500,
    })
    const minion = game.spawnMonster({
      defId: 'minion1',
      x: 32,
      y: 30,
      areaId: 1,
      maxHp: 200,
      hp: 200,
    })
    // First utility cast rallies minion (Cry Help 290); once rallied and cooldown clears, Overseer Whip (295) applies state 140.
    game.stepFrames(120)
    expect(game.getMonsterState(minion)!.states.has(140)).toBe(true)
  })
})
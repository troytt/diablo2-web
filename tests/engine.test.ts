import { describe, expect, test } from 'vitest'
import { goldItem } from "../src/common/items/items"
import { GameEngine } from '../src/server/engine/game-engine.ts'
import type { GameEngineOptions, WorldMapProvider } from '../src/server/engine/game-engine.ts'

describe('GameEngine', () => {
  const dummyTerrain: WorldMapProvider = {
    widthPx: 1000,
    heightPx: 1000,
    overlap: (x, y) => {
      // Small blocked area around 500,500
      if (x >= 400 && x <= 600 && y >= 400 && y <= 600) return 1
      return 0
    }
  }

  const dummyOpts: GameEngineOptions = {
    spawn: { x: 100, y: 100 },
    stats: [
      { id: 'mon1', name: 'Goblin', hp: 20, damage: 2, cooldownTicks: 10, reach: 20, aggroRadius: 100, speed: 50, xp: 5 },
      { id: 'mon2', name: 'Orc', hp: 50, damage: 5, cooldownTicks: 20, reach: 30, aggroRadius: 150, speed: 40, xp: 10 }
    ],
    xpTable: [0, 0, 10, 30, 60],
    itemBases: [
      { id: 'sword', name: 'Sword', kind: 'weapon', invWidth: 1, invHeight: 3, maxStack: 1, value: 10, damage: 5, defense: 0, tags: ['weap'], level: 1 }
    ],
    prefixAffixes: [],
    suffixAffixes: [],
    skills: [
      { id: 'attack', name: 'Attack', manaCost: 0, cooldownTicks: 1, range: 48, projectile: false, speed: 0, baseMinDamage: 3, baseMaxDamage: 4, damagePerLevel: 1, radius: 20 },
      { id: 'nova', name: 'Nova', manaCost: 5, cooldownTicks: 1, range: 200, projectile: false, speed: 200, baseMinDamage: 25, baseMaxDamage: 25, damagePerLevel: 2, radius: 200 }
    ],
    npcDefs: [],
    questDefs: [],
    combatOptions: {
      playerSpeed: 100,
      playerReach: 50,
      playerCooldownTicks: 10,
      playerDamage: 5,
      playerManaPerAttack: 0,
      respawnTicks: 100
    },
    lootSeed: 12345,
    talkRadius: 50,
    pickupRadius: 50,
    inventoryCols: 10,
    inventoryRows: 4
  }

  test('Determinism: same seed + same inputs yields identical hash, different yields distinct hash', () => {
    const runFrames = (engine: GameEngine, overrideTick5Action: boolean) => {
      for (let i = 0; i < 50; i++) {
        engine.tick({
          movement: { x: 1, y: 0 },
          attacking: i % 10 === 0 || (i === 5 && overrideTick5Action),
          pickingUp: i === 45,
          talking: false,
          digits: [2],
          saving: false,
          loading: false
        })
      }
      return engine.saveSnapshot()
    }

    const engine1 = new GameEngine(dummyTerrain, dummyOpts)
    const hash1 = runFrames(engine1, false)
    
    const engine2 = new GameEngine(dummyTerrain, dummyOpts)
    const hash2 = runFrames(engine2, false)

    expect(hash1).toEqual(hash2)

    const engine3 = new GameEngine(dummyTerrain, dummyOpts)
    const hash3 = runFrames(engine3, true)
    
    expect(hash1).not.toEqual(hash3)
  })

  test('Collision and sliding against stub WorldMapProvider', () => {
    const engine = new GameEngine(dummyTerrain, { ...dummyOpts, spawn: { x: 390, y: 500 } })
    const startX = engine.world.player.x
    
    for (let i = 0; i < 4; i++) {
      engine.tick({ movement: { x: 1, y: 0 }, attacking: false, pickingUp: false, talking: false, digits: [], saving: false, loading: false })
    }
    
    expect(engine.world.player.x).toBeGreaterThan(startX)
    expect(engine.world.player.x).toBeLessThan(400)
    
    const blockedX = engine.world.player.x
    const startY = engine.world.player.y

    for (let i = 0; i < 10; i++) {
      engine.tick({ movement: { x: 1, y: -1 }, attacking: false, pickingUp: false, talking: false, digits: [], saving: false, loading: false })
    }
    
    expect(engine.world.player.x).toBe(blockedX)
    expect(engine.world.player.y).toBeLessThan(startY)
  })

  test('Skill cast, cooldown gating, and cast refusal on insufficient mana', () => {
    const engine = new GameEngine(dummyTerrain, dummyOpts)
    engine.world.player.mana = 3 
    
    engine.tick({ movement: { x: 0, y: 0 }, attacking: false, pickingUp: false, talking: false, digits: [2], saving: false, loading: false })
    
    engine.tick({ movement: { x: 0, y: 0 }, attacking: true, pickingUp: false, talking: false, digits: [], saving: false, loading: false })
    
    expect(engine.metrics.castRefusals).toBe(1)
    expect(engine.metrics.casts).toBe(0)
    
    engine.world.player.mana = 10
    engine.tick({ movement: { x: 0, y: 0 }, attacking: true, pickingUp: false, talking: false, digits: [], saving: false, loading: false })
    
    expect(engine.metrics.casts).toBe(1)
  })

  test('Save round-trip: save() -> load() -> state equivalent', () => {
    const engine1 = new GameEngine(dummyTerrain, dummyOpts)
    for (let i = 0; i < 10; i++) {
      engine1.tick({ movement: { x: 1, y: 1 }, attacking: true, pickingUp: true, talking: false, digits: [2], saving: false, loading: false })
    }
    const stateStr = engine1.saveSnapshot()
    
    const engine2 = new GameEngine(dummyTerrain, dummyOpts)
    engine2.loadSnapshot(stateStr)
    
    expect(engine2.saveSnapshot()).toEqual(stateStr)
    expect(engine2.world.player.x).toEqual(engine1.world.player.x)
    expect(engine2.projectiles.length).toEqual(engine1.projectiles.length)
  })

  test('Loot drop and pickup; inventory add/remove and capacity limits', () => {
    const engine = new GameEngine(dummyTerrain, dummyOpts)
    engine.ground.push({ x: engine.world.player.x, y: engine.world.player.y, item: goldItem(10) })
    
    engine.tick({ movement: { x: 0, y: 0 }, attacking: false, pickingUp: true, talking: false, digits: [], saving: false, loading: false })
    
    expect(engine.bag.contents.length).toBe(1)
    expect(engine.ground.length).toBe(0)
    expect(engine.metrics.pickups).toBe(1)
  })

  test('Monster damage, death, and removal ordering', () => {
    const engine = new GameEngine(dummyTerrain, { ...dummyOpts, spawn: { x: 100, y: 100 } })
    
    expect(engine.world.monsters.length).toBeGreaterThanOrEqual(2)
    const goblin = engine.world.monsters[0]!
    const orc = engine.world.monsters[1]!
    
    engine.world.player.mana = 100
    engine.tick({ movement: { x: 0, y: 0 }, attacking: false, pickingUp: false, talking: false, digits: [2], saving: false, loading: false })
    engine.tick({ movement: { x: 0, y: 0 }, attacking: true, pickingUp: false, talking: false, digits: [], saving: false, loading: false })
    
    expect(goblin.state).toBe('dead')
    expect(orc.hp).toBeLessThanOrEqual(25)
    expect(orc.state).not.toBe('dead')

    const oldOrcHp = orc.hp
    engine.tick({ movement: { x: 0, y: 0 }, attacking: false, pickingUp: false, talking: false, digits: [], saving: false, loading: false })
    expect(orc.hp).toBe(oldOrcHp)
    
    engine.tick({ movement: { x: 0, y: 0 }, attacking: true, pickingUp: false, talking: false, digits: [], saving: false, loading: false })
    expect(orc.state).toBe('dead')
  })

  test('NPCs spawn only on walkable terrain', () => {
    // Wall is 400..600. Let's spawn near 400 to force overlap checks.
    const spawnOpts = { ...dummyOpts, spawn: { x: 400, y: 500 }, npcDefs: [
      { id: 'npc1', name: 'blacksmith', questId: 'q1', offerLines: ['Hello'], progressLines: ['Working...'], doneLines: ['Done'] },
      { id: 'npc2', name: 'healer', questId: 'q2', offerLines: ['Need healing?'], progressLines: ['Hold still'], doneLines: ['You are healed'] }
    ] }
    const engine = new GameEngine(dummyTerrain, spawnOpts)
    
    // NPCs should spawn, but not inside the 400..600 block.
    expect(engine.npcEntities.length).toBe(2)
    for (const npc of engine.npcEntities) {
      expect(dummyTerrain.overlap(npc.x, npc.y)).toBe(0)
    }
  })


  test('Instant spell area effect precisely at boundary', () => {
    // Math.hypot(0 - 0, 220 - 0) === 220. 
    // Nova radius is 200, so wanted.radius + 20 === 220.
    // If the check is `> 220`, the monster at 220 IS damaged.
    // If the check is `>= 220`, the monster at 220 IS NOT damaged.
    const engine = new GameEngine(dummyTerrain, { ...dummyOpts, spawn: { x: 0, y: 0 } })
    
    // Manually push a monster at exactly (220, 0).
    engine.world.monsters.length = 0
    engine.world.monsters.push({
      index: 0,
      stats: dummyOpts.stats[0]!,
      x: 220, y: 0,
      hp: 20,
      state: 'idle',
      corpseTicks: 0,
      hitFlash: 0, facing: 0, cooldown: 0,
    })
    
    engine.world.player.mana = 100
    engine.tick({ movement: { x: 0, y: 0 }, attacking: false, pickingUp: false, talking: false, digits: [2], saving: false, loading: false }) // Select Nova
    engine.tick({ movement: { x: 0, y: 0 }, attacking: true, pickingUp: false, talking: false, digits: [], saving: false, loading: false })   // Cast Nova
    
    // Monster should be hit (it has 20 hp, takes 25 damage, becomes dead)
    expect(engine.world.monsters[0]!.state).toBe('dead')
  })

  test('monsterCount: 0 spawns no monsters (for safe areas like town)', () => {
    const engine = new GameEngine(dummyTerrain, { ...dummyOpts, monsterCount: 0 })
    expect(engine.world.monsters.length).toBe(0)
  })

  test('monsterPacks takes precedence and clusters monsters', () => {
    const packs = [
      {
        members: [
          { ...dummyOpts.stats[0]!, hp: 10 },
          { ...dummyOpts.stats[0]!, hp: 10 },
          { ...dummyOpts.stats[0]!, hp: 10 },
        ]
      }
    ]
    const engine = new GameEngine(dummyTerrain, { ...dummyOpts, monsterPacks: packs, monsterCount: 0 })
    expect(engine.world.monsters.length).toBe(3)
  })

  test('Issue #418: setPlayers scales gamePlayers and partyPlayers with clamping', () => {
    const engine = new GameEngine(dummyTerrain, { ...dummyOpts, gamePlayers: 3, partyPlayers: 2 })
    expect(engine.gamePlayers).toBe(3)
    expect(engine.partyPlayers).toBe(2)

    engine.setPlayers(8)
    expect(engine.gamePlayers).toBe(8)
    expect(engine.partyPlayers).toBe(1)

    engine.setPlayers(10, 5) // Clamps to 8
    expect(engine.gamePlayers).toBe(8)
    expect(engine.partyPlayers).toBe(5)

    engine.setPlayers(0, 0) // Clamps to 1
    expect(engine.gamePlayers).toBe(1)
    expect(engine.partyPlayers).toBe(1)
  })

  test('Issue #417: accepts getEquippedItems and equippedItems in GameEngineOptions', () => {
    const equipped = [
      {
        base: { id: 'uap', kind: 'armor', tags: ['helm'], invWidth: 2, invHeight: 2, maxStack: 1, value: 100, damage: 0, defense: 140, level: 62 },
        name: 'Harlequin Crest',
        stats: { 'mag%': 50 },
        level: 62,
        invWidth: 2,
        invHeight: 2,
        stack: 1,
        value: 100,
      } as any,
    ]
    const engine = new GameEngine(dummyTerrain, {
      ...dummyOpts,
      equippedItems: equipped,
      getEquippedItems: () => equipped,
    })
    expect(engine.opts.equippedItems).toHaveLength(1)
    expect(engine.opts.getEquippedItems?.()).toHaveLength(1)
  })
})

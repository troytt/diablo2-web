import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { loadDropTables, type DropTables } from '../src/common/items/drop-tables.ts'
import { GameEngine, type GameEngineOptions, type WorldMapProvider } from '../src/server/engine/game-engine.ts'
import type { SkillDef } from '../src/server/skills/skills.ts'
import { damageMonster, type Monster } from '../src/server/ai/monster-ai.ts'
import { DEMO_EXPERIENCE, DEMO_NPCS, DEMO_QUESTS } from '../src/common/data/demo-data.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('Combat Kill Event Lifecycle & Single-Drop Gate (Issue #404)', () => {
  let dropTables: DropTables

  beforeAll(async () => {
    if (!hasD2) {
      throw new Error('samples/d2 MPQ files required for Combat Kill Lifecycle test')
    }
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
    }
    dropTables = await loadDropTables(archives)
  })

  const dummyTerrain: WorldMapProvider = {
    widthPx: 1000,
    heightPx: 1000,
    overlap: () => 0,
    isMissileBlocked: () => false,
  }

  const DUMMY_INPUT = {
    movement: { x: 0, y: 0 },
    attacking: false,
    pickingUp: false,
    talking: false,
    digits: [],
    saving: false,
    loading: false,
  }

  function createMonster(index: number, x: number, y: number, hp = 20): Monster {
    return {
      index,
      stats: {
        id: 'fallen1',
        name: 'Fallen',
        hp,
        damage: 2,
        cooldownTicks: 25,
        reach: 30,
        aggroRadius: 100,
        speed: 60,
        xp: 20,
        rank: 'normal',
        level: 5,
      },
      x,
      y,
      hp,
      cooldown: 0,
      state: 'idle',
      facing: 0,
      hitFlash: 0,
      corpseTicks: 0,
      dropRolled: false,
    }
  }

  function createTestEngine(): GameEngine {
    const engineOpts: GameEngineOptions = {
      spawn: { x: 100, y: 100 },
      stats: [
        {
          id: 'fallen1',
          name: 'Fallen',
          hp: 20,
          damage: 2,
          cooldownTicks: 25,
          reach: 30,
          aggroRadius: 100,
          speed: 60,
          xp: 20,
        },
      ],
      xpTable: DEMO_EXPERIENCE,
      dropTables,
      difficulty: 'normal',
      monsterKinds: dropTables.monsterKinds,
      skills: [
        {
          id: 'attack',
          name: 'Attack',
          manaCost: 0,
          cooldownTicks: 1,
          range: 48,
          projectile: false,
          speed: 0,
          baseMinDamage: 10,
          baseMaxDamage: 20,
          damagePerLevel: 2,
          radius: 48,
        },
      ],
      npcDefs: DEMO_NPCS,
      questDefs: DEMO_QUESTS,
      combatOptions: {
        playerSpeed: 100,
        playerReach: 60,
        playerCooldownTicks: 1,
        playerDamage: 50,
        playerManaPerAttack: 0,
        respawnTicks: 100,
      },
      talkRadius: 80,
      pickupRadius: 64,
      inventoryCols: 10,
      inventoryRows: 4,
      monsterCount: 1,
      monsterSpread: 50,
    }

    const engine = new GameEngine(dummyTerrain, engineOpts)
    engine.world.player.maxHp = 100
    engine.world.player.hp = 100
    engine.world.player.maxMana = 100
    engine.world.player.mana = 100
    engine.world.monsters = [createMonster(0, 110, 100, 20)]
    return engine
  }

  // --- Case 1: Pre-tick melee attack kill produces drops ---
  it('Case 1: Pre-tick melee attack kill produces drops', () => {
    const engine = createTestEngine()
    const targetMonster = engine.world.monsters[0]!
    expect(targetMonster.state).toBe('idle')
    expect(targetMonster.dropRolled).toBe(false)

    // Execute pre-tick lethal melee damage via damageMonster
    const killed = damageMonster(engine.world, targetMonster.index, 100, engine.world.player)
    expect(killed).toBe(true)
    expect(targetMonster.state).toBe('dead')
    expect(engine.world.pendingKills?.length).toBe(1)

    const initialDropsRolled = engine.metrics.dropsRolled

    // Run tick to process drops
    engine.tick(DUMMY_INPUT)

    // Drops must have rolled and monster.dropRolled must be true
    expect(engine.metrics.dropsRolled).toBe(initialDropsRolled + 1)
    expect(targetMonster.dropRolled).toBe(true)
    expect(engine.world.events.some(e => e.kind === 'kill' && e.monsterIndex === targetMonster.index)).toBe(true)
  })

  // --- Case 2: Pre-tick instant AoE skill kill (Frost Nova / Nova) produces drops ---
  it('Case 2: Pre-tick instant AoE skill kill (Frost Nova / Nova) produces drops', () => {
    const engine = createTestEngine()
    // Spawn 3 monsters around player
    engine.world.monsters = [
      createMonster(0, 120, 100, 20),
      createMonster(1, 80, 100, 20),
      createMonster(2, 100, 120, 20),
    ]

    // Configure Nova (instant AoE skill)
    const novaDef: SkillDef = {
      id: 'nova',
      name: 'Nova',
      manaCost: 0,
      cooldownTicks: 1,
      range: 80,
      projectile: false,
      speed: 0,
      baseMinDamage: 50,
      baseMaxDamage: 50,
      damagePerLevel: 0,
      radius: 80,
    }
    engine.opts = {
      ...engine.opts,
      skills: [...engine.opts.skills, novaDef],
    }
    engine.selectedSkill = engine.opts.skills.length - 1

    const initialDropsRolled = engine.metrics.dropsRolled

    // Tick with attacking = true to trigger instant skill cast
    engine.tick({
      ...DUMMY_INPUT,
      attacking: true,
    })

    // All 3 monsters must be killed and have drops rolled
    expect(engine.world.monsters[0]!.state).toBe('dead')
    expect(engine.world.monsters[1]!.state).toBe('dead')
    expect(engine.world.monsters[2]!.state).toBe('dead')

    expect(engine.world.monsters[0]!.dropRolled).toBe(true)
    expect(engine.world.monsters[1]!.dropRolled).toBe(true)
    expect(engine.world.monsters[2]!.dropRolled).toBe(true)

    expect(engine.metrics.dropsRolled).toBe(initialDropsRolled + 3)
    const killEvents = engine.world.events.filter(e => e.kind === 'kill')
    expect(killEvents.length).toBe(3)
  })

  // --- Case 3: Missile projectile kill (direct & splash) produces drops ---
  it('Case 3: Missile projectile kill (direct & splash) produces drops', () => {
    const engine = createTestEngine()
    // Direct target at (150, 100) and splash target nearby at (160, 100)
    const directTarget = createMonster(0, 150, 100, 20)
    const splashTarget = createMonster(1, 160, 100, 20)
    engine.world.monsters = [directTarget, splashTarget]

    // Spawn a projectile with aoeRadius targeting (150, 100)
    engine.projectiles.push({
      skillId: '36',
      x: 148,
      y: 100,
      vx: 4,
      vy: 0,
      damage: 50,
      ttl: 10,
      fromPlayer: true,
      missileType: 'firebolt',
      pierce: false,
      aoeRadius: 40,
    })

    const initialDropsRolled = engine.metrics.dropsRolled

    // Advance 1 tick: missile collides with directTarget and splashes to splashTarget
    engine.tick(DUMMY_INPUT)

    expect(directTarget.state).toBe('dead')
    expect(splashTarget.state).toBe('dead')

    expect(directTarget.dropRolled).toBe(true)
    expect(splashTarget.dropRolled).toBe(true)

    expect(engine.metrics.dropsRolled).toBe(initialDropsRolled + 2)
    const killEvents = engine.world.events.filter(e => e.kind === 'kill')
    expect(killEvents.length).toBe(2)
  })

  // --- Case 4: Periodic aura pulse kill (Holy Freeze / Holy Fire) produces drops ---
  it('Case 4: Periodic aura pulse kill (Holy Freeze / Holy Fire) produces drops', () => {
    const engine = createTestEngine()
    engine.levelId = 2 // Blood Moor (wilderness, not town)
    const targetMonster = createMonster(0, 130, 100, 5) // 5 HP
    engine.world.monsters = [targetMonster]

    // Activate Holy Freeze aura (skill 114) at slvl 20
    engine.updateActiveAura(114, 20)

    // Advance tick to 49 so next tick is 50 (50 % 50 === 0 aura pulse)
    engine.world.tick = 49

    const initialDrops = engine.metrics.dropsRolled

    engine.tick(DUMMY_INPUT)

    expect(engine.world.tick).toBe(50)
    expect(targetMonster.state).toBe('dead')
    expect(targetMonster.dropRolled).toBe(true)
    expect(engine.metrics.dropsRolled).toBe(initialDrops + 1)
    expect(engine.world.events.some(e => e.kind === 'kill' && e.monsterIndex === targetMonster.index)).toBe(true)
  })

  // --- Case 5: Multi-damage concurrent hits & resurrected monster drop idempotency (drops strictly once) ---
  it('Case 5: Multi-damage concurrent hits & resurrected monster drop idempotency (drops strictly once)', () => {
    const engine = createTestEngine()
    const monster = createMonster(0, 110, 100, 20)
    engine.world.monsters = [monster]

    const initialDrops = engine.metrics.dropsRolled

    // 1. Concurrent hits: hit 1 kills monster, hit 2 strikes dead monster on same tick
    const hit1Killed = damageMonster(engine.world, monster.index, 30, engine.world.player)
    expect(hit1Killed).toBe(true)
    expect(monster.state).toBe('dead')

    // Hit 2 against already dead monster returns false and does not queue extra kill
    const hit2Killed = damageMonster(engine.world, monster.index, 30, engine.world.player)
    expect(hit2Killed).toBe(false)

    // Tick to resolve drops
    engine.tick(DUMMY_INPUT)

    expect(engine.metrics.dropsRolled).toBe(initialDrops + 1)
    expect(monster.dropRolled).toBe(true)

    // 2. Resurrect the monster (e.g. by Shaman)
    monster.state = 'idle'
    monster.hp = 20
    // Notice: monster.dropRolled remains true (1.13c UNITFLAG_NOITEM parity)
    expect(monster.dropRolled).toBe(true)

    // Kill resurrected monster a second time
    const killedAgain = damageMonster(engine.world, monster.index, 50, engine.world.player)
    expect(killedAgain).toBe(true)
    expect(monster.state).toBe('dead')

    // Advance tick: drop loop must skip drops because monster.dropRolled is already true
    engine.tick(DUMMY_INPUT)

    // dropsRolled must NOT have increased!
    expect(engine.metrics.dropsRolled).toBe(initialDrops + 1)
  })
})

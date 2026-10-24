/**
 * The save/load loop, as a pure simulation.
 *
 * This replaces `scripts/browser/checks/map-save-load.js`, which drove the
 * retired `map.html` sandbox with synthetic key events and compared four
 * snapshots of `window.__d2webMap`. That check was slow, needed a headless
 * browser and a WebGL context, and — because the sandbox did its `localStorage`
 * I/O *outside* `engine.tick` — it never actually exercised the
 * `EngineInput.saving` / `EngineInput.loading` path the real scene uses.
 *
 * The assertions here are the same ones: fight for a while, save, keep playing
 * so the state drifts, load, and require that position, kills, gold, ground
 * items and level all come back to the save point. Driving the engine directly
 * makes them deterministic and instant.
 */
import { describe, expect, it } from 'vitest'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import type { EngineInput, GameEngineOptions, SnapshotStore, WorldMapProvider } from '../src/server/engine/game-engine.ts'

/** Open ground. Collision has its own tests; this one is about persistence. */
const openTerrain: WorldMapProvider = { widthPx: 2000, heightPx: 2000, overlap: () => 0 }

/**
 * A snapshot store backed by a variable, standing in for `localStorage`.
 *
 * @returns the store plus a peek at what it holds.
 */
function memoryStore(): SnapshotStore & { readonly slot: () => string | null } {
  let saved: string | null = null
  return {
    read: () => saved,
    write: (data: string) => { saved = data },
    slot: () => saved,
  }
}

/**
 * Engine options with enough monsters and loot to make the save interesting.
 *
 * @param store - where snapshots go.
 * @returns the options.
 */
function optionsWith(store: SnapshotStore | undefined): GameEngineOptions {
  return {
    spawn: { x: 1000, y: 1000 },
    stats: [
      { id: 'mon1', name: 'Goblin', hp: 12, damage: 1, cooldownTicks: 10, reach: 20, aggroRadius: 400, speed: 60, xp: 40 },
    ],
    xpTable: [0, 0, 10, 30, 60, 100],
    itemBases: [
      { id: 'sword', name: 'Sword', kind: 'weapon', invWidth: 1, invHeight: 3, maxStack: 1, value: 10, damage: 5, defense: 0, tags: ['weap'], level: 1 },
    ],
    prefixAffixes: [],
    suffixAffixes: [],
    skills: [
      { id: 'attack', name: 'Attack', manaCost: 0, cooldownTicks: 1, range: 48, projectile: false, speed: 0, baseMinDamage: 3, baseMaxDamage: 4, damagePerLevel: 1, radius: 20 },
    ],
    npcDefs: [],
    questDefs: [],
    combatOptions: {
      playerSpeed: 100,
      playerReach: 60,
      playerCooldownTicks: 4,
      playerDamage: 9,
      playerManaPerAttack: 0,
      respawnTicks: 100,
    },
    lootSeed: 0x5eed,
    talkRadius: 50,
    pickupRadius: 50,
    inventoryCols: 10,
    inventoryRows: 4,
    monsterCount: 6,
    monsterSpread: 120,
    // `exactOptionalPropertyTypes` is on, so "no store" has to be an absent
    // property, not a present `undefined` one.
    ...(store === undefined ? {} : { snapshotStore: store }),
  }
}

/** Neutral input, so each test only has to name the field it cares about. */
const idle: EngineInput = {
  movement: { x: 0, y: 0 },
  attacking: false,
  pickingUp: false,
  talking: false,
  digits: [],
  saving: false,
  loading: false,
}

/**
 * The state the browser check used to compare across four sample points.
 *
 * @param engine - the engine to read.
 * @returns a plain, comparable object.
 */
function snapshotOf(engine: GameEngine): Record<string, unknown> {
  return {
    tick: engine.world.tick,
    x: Math.round(engine.world.player.x),
    y: Math.round(engine.world.player.y),
    level: engine.world.player.level,
    xp: engine.world.player.xp,
    kills: engine.world.kills,
    gold: engine.bag.gold,
    ground: engine.ground.length,
    hp: engine.world.player.hp,
  }
}

/**
 * Walk and swing for a while, the way the browser check tapped D and Space.
 *
 * @param engine - the engine to drive.
 * @param ticks - how many ticks to run.
 */
function fight(engine: GameEngine, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) {
    engine.tick({ ...idle, movement: { x: i % 40 < 20 ? 1 : 0, y: i % 40 < 20 ? 0 : 1 }, attacking: true, pickingUp: i % 7 === 0 })
  }
}

describe('save and load through the tick', () => {
  it('restores the save point after the state has drifted', () => {
    const store = memoryStore()
    const engine = new GameEngine(openTerrain, optionsWith(store))

    fight(engine, 120)
    expect(engine.world.kills).toBeGreaterThan(0)

    engine.tick({ ...idle, saving: true })
    const savedAt = snapshotOf(engine)
    expect(engine.metrics.saves).toBe(1)
    expect(engine.metrics.saveError).toBeNull()

    fight(engine, 120)
    const drifted = snapshotOf(engine)
    expect(drifted).not.toEqual(savedAt)

    engine.tick({ ...idle, loading: true })
    expect(engine.metrics.loads).toBe(1)
    expect(engine.metrics.saveError).toBeNull()

    // `handleSaveLoad` runs last, so the loading tick itself advanced the world
    // by one before restoring — compare the fields the player cares about.
    const after = snapshotOf(engine)
    expect(after.x).toBe(savedAt.x)
    expect(after.y).toBe(savedAt.y)
    expect(after.kills).toBe(savedAt.kills)
    expect(after.gold).toBe(savedAt.gold)
    expect(after.ground).toBe(savedAt.ground)
    expect(after.level).toBe(savedAt.level)
    expect(after.xp).toBe(savedAt.xp)
    expect(after.hp).toBe(savedAt.hp)
  })

  it('saves once per press, not once per tick', () => {
    const store = memoryStore()
    const engine = new GameEngine(openTerrain, optionsWith(store))

    // A key held for half a second is 12 ticks at 25 Hz.
    for (let i = 0; i < 12; i += 1) engine.tick({ ...idle, saving: true })
    expect(engine.metrics.saves).toBe(1)

    engine.tick(idle)
    engine.tick({ ...idle, saving: true })
    expect(engine.metrics.saves).toBe(2)
  })

  it('loads once per press, so a held key does not pin the player', () => {
    const store = memoryStore()
    const engine = new GameEngine(openTerrain, optionsWith(store))

    engine.tick({ ...idle, saving: true })
    const savedX = engine.world.player.x

    for (let i = 0; i < 12; i += 1) {
      engine.tick({ ...idle, movement: { x: 1, y: 0 }, loading: true })
    }

    expect(engine.metrics.loads).toBe(1)
    // The first tick restored; the other eleven were free to walk away.
    expect(engine.world.player.x).toBeGreaterThan(savedX)
  })

  it('reports an empty slot as nothing to load rather than an error', () => {
    const store = memoryStore()
    const engine = new GameEngine(openTerrain, optionsWith(store))

    engine.tick({ ...idle, loading: true })

    expect(engine.metrics.loads).toBe(0)
    expect(engine.metrics.saveError).toBeNull()
    expect(store.slot()).toBeNull()
  })

  it('survives a store that throws, because a full quota must not kill the loop', () => {
    const throwing: SnapshotStore = {
      read: () => { throw new Error('access denied') },
      write: () => { throw new Error('quota exceeded') },
    }
    const engine = new GameEngine(openTerrain, optionsWith(throwing))

    engine.tick({ ...idle, saving: true })
    expect(engine.metrics.saves).toBe(0)
    expect(engine.metrics.saveError).toBe('quota exceeded')

    engine.tick(idle)
    engine.tick({ ...idle, loading: true })
    expect(engine.metrics.loads).toBe(0)
    expect(engine.metrics.saveError).toBe('access denied')

    // Still simulating.
    const before = engine.world.tick
    engine.tick(idle)
    expect(engine.world.tick).toBeGreaterThan(before)
  })

  it('leaves the inputs inert when no store is configured', () => {
    const engine = new GameEngine(openTerrain, optionsWith(undefined))

    engine.tick({ ...idle, saving: true })
    engine.tick({ ...idle, loading: true })

    expect(engine.metrics.saves).toBe(0)
    expect(engine.metrics.loads).toBe(0)
    expect(engine.metrics.saveError).toBeNull()
  })
})

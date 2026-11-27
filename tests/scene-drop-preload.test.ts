import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { getSharedDropTables } from '../src/common/world/scene-population.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import { DEMO_EXPERIENCE, DEMO_SKILLS, DEMO_NPCS, DEMO_QUESTS } from '../src/common/data/demo-data.ts'
import { loadDropTables, type DropTables } from '../src/common/items/drop-tables.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('Scene DropTables Preload & Decoupling (Issue #117)', () => {
  let dropTables: DropTables

  beforeAll(async () => {
    if (!hasD2) return
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
    }
    dropTables = await loadDropTables(archives)
  })

  it('getSharedDropTables caches promise as a singleton to prevent repeated MPQ mounting', () => {
    const p1 = getSharedDropTables(['samples/d2'])
    const p2 = getSharedDropTables(['samples/d2'])
    expect(p1).toBe(p2)
  })

  it('GameEngine allows starting with dropTables undefined on frame 0 and injecting later via setDropTables', () => {
    const dummyTerrain = {
      widthPx: 1000,
      heightPx: 1000,
      overlap: () => 0,
      raycast: () => null,
      findPath: () => [],
    }

    // Initialize GameEngine without dropTables (simulating instant frame-0 map display)
    const engine = new GameEngine(dummyTerrain, {
      spawn: { x: 100, y: 100 },
      stats: [],
      xpTable: DEMO_EXPERIENCE,
      difficulty: 'normal',
      skills: DEMO_SKILLS,
      npcDefs: DEMO_NPCS,
      questDefs: DEMO_QUESTS,
      combatOptions: {
        playerSpeed: 4,
        playerReach: 50,
        playerCooldownTicks: 10,
        playerDamage: 10,
        playerManaPerAttack: 1,
        respawnTicks: 100,
        disableMonsterAggro: true,
      },
      talkRadius: 50,
      pickupRadius: 50,
      inventoryCols: 10,
      inventoryRows: 4,
      monsterCount: 0,
    })

    expect(engine.opts.dropTables).toBeUndefined()
    expect(engine.opts.monsterKinds).toBeUndefined()

    // Simulate background promise resolution
    if (dropTables) {
      engine.setDropTables(dropTables)
      expect(engine.opts.dropTables).toBe(dropTables)
      expect(engine.opts.monsterKinds).toBe(dropTables.monsterKinds)
    }
  })
})

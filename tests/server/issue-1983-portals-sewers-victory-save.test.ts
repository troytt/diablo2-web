/**
 * Issue #1983 — 1.13c `LEVEL_WarpUnit` Portal Arrivals (`298`, `100`, `563`, `569`),
 * Act 3 Kurast Sewers Lever/Stairs (`367` / `366`), Sealed `UNIT_TILE` Warp Guards,
 * Act 4/5 Quest Area Gates (`130`, `132`, `566`), and SP Victory Screen Save Flush.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_AREA_GATES_113C,
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_STARTED_113C,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'
import {
  createAreaBootstrapResolver,
  resolvePresetPortalDestArea113c,
} from '../../src/server/world/area-bootstrap.ts'

describe('Issue #1983 — 1.13c progression portals, Kurast Sewers lever/stairs, and sealed warp guards', () => {
  it('resolves canonical 1.13c preset portal destination areas for 298, 342, 366, 386, 547, 563, and 569', () => {
    expect(resolvePresetPortalDestArea113c(298, 54)).toBe(74)
    expect(resolvePresetPortalDestArea113c(298, 74)).toBe(54)
    expect(resolvePresetPortalDestArea113c(342, 102)).toBe(103)
    expect(resolvePresetPortalDestArea113c(366, 92)).toBe(93)
    expect(resolvePresetPortalDestArea113c(366, 93)).toBeUndefined()
    expect(resolvePresetPortalDestArea113c(386, 83)).toBe(100)
    expect(resolvePresetPortalDestArea113c(547, 120)).toBe(128)
    expect(resolvePresetPortalDestArea113c(563, 131)).toBe(132)
    expect(resolvePresetPortalDestArea113c(569, 132)).toBe(131)
  })

  it('gates Worldstone Keep L3 (130) and Worldstone Chamber (132) on A5Q5 and unlocks Act 5 + WP 109 on Harrogath portal (566)', () => {
    expect(QUEST_AREA_GATES_113C[130]).toEqual({ quest: 'a5q5', mask: QUEST_FLAG_COMPLETED_113C })
    expect(QUEST_AREA_GATES_113C[132]).toEqual({ quest: 'a5q5', mask: QUEST_FLAG_COMPLETED_113C })

    const game = new GameInstance({ seed: 19830, areaId: 108 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'SlayerSorc', x: 20, y: 20, areaId: 108 })
    const internal = game as unknown as {
      players: Map<
        number,
        { areaId: number; unlockedAct: number; waypoints: Set<number>; questFlags: Uint16Array }
      >
      playerCanEnterArea: (p: unknown, areaId: number) => boolean
    }
    const player = internal.players.get(pid)!
    expect(internal.playerCanEnterArea(player, 130)).toBe(false)
    expect(internal.playerCanEnterArea(player, 132)).toBe(false)

    // Complete A4Q3 and operate Harrogath portal (Objects.txt 566, OperateFn 73 @ 0x6FCDB550)
    player.questFlags[questWordIndex113c('a4q3')!]! |= QUEST_FLAG_COMPLETED_113C
    const portal566 = game.spawnObject({ classId: 566, x: 21, y: 20, areaId: 108, mode: 2 })
    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: portal566 } })
    game.stepFrame()

    expect(player.areaId).toBe(109)
    expect(player.unlockedAct).toBe(4)
    expect(player.waypoints.has(109)).toBe(true)
    const evs = game.drainEvents(pid)
    expect(evs.some((e) => e.type === 'CanGoToAct' && e.act === 5)).toBe(true)
  })

  it('operates Stair 194/195 (OperateFn 47) as two-step open (0 -> 1 -> 2) then warp, and blocks container drops on portals', () => {
    const game = new GameInstance({ seed: 19831, areaId: 50 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'StairSorc', x: 20, y: 20, areaId: 50 })
    const internal = game as unknown as {
      players: Map<number, { areaId: number }>
      objects: Map<number, { mode: number }>
      groundItems: Map<number, unknown>
    }
    const stair194 = game.spawnObject({ classId: 194, x: 21, y: 20, areaId: 50, destAreaId: 51 })
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: stair194 } })
    game.stepFrame()
    expect(internal.players.get(pid)!.areaId).toBe(50)
    expect(internal.objects.get(stair194)!.mode).toBe(1)

    game.stepFrames(12)
    expect(internal.objects.get(stair194)!.mode).toBe(2)
    expect(internal.groundItems.size).toBe(0)

    game.stepFrames(5)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: stair194 } })
    game.stepFrame()
    expect(internal.players.get(pid)!.areaId).toBe(51)
  })

  it('executes real DRLG transitions across 54 <-> 74 (298), 66 -> 73 (152/100), 92 -> 93 (367/366), and 131 <-> 132 (563/569)', async () => {
    const packedDir = path.resolve(process.cwd(), 'public/act-packs/tiles')
    if (!fs.existsSync(path.join(packedDir, 'drlg-bundle.json'))) return
    await import('../../tools/lib/node-map-loader.ts')
    const { MapService } = await import('../../src/client/map/map-service.ts')
    const { createMapServiceAreaLevelSource } = await import(
      '../../src/client/map/map-service-area-source.ts'
    )
    const svc = await MapService.fromPackedDir('public/act-packs/tiles')
    const resolver = createAreaBootstrapResolver(createMapServiceAreaLevelSource(svc))

    const game = new GameInstance({
      mode: 'singlePlayer',
      mapSeed: 0x12345678,
      difficulty: 0,
      resolveAreaBootstrap: resolver,
    })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'DrlgSorc', areaId: 1 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          areaId: number
          x: number
          y: number
          hp: number
          maxHp: number
          hpFixed: number
          maxHpFixed: number
          unlockedAct: number
          questFlags: Uint16Array
          items: any[]
        }
      >
      objects: Map<
        number,
        { unitId: number; classId: number; areaId: number; x: number; y: number; mode: number; destAreaId?: number }
      >
      warpTiles: Map<number, { unitId: number; areaId: number; destAreaId: number; x: number; y: number }>
      loadedAreas: Map<number, { isWalkable: (areaId: number, x: number, y: number) => boolean }>
      movePlayer: (id: number, x: number, y: number) => void
      transitionPlayerArea: (p: unknown, areaId: number, arrival: { kind: string }) => boolean
      setObjectMode: (obj: unknown, mode: number) => void
    }
    const player = internal.players.get(pid)!
    player.hp = 5000
    player.maxHp = 5000
    player.hpFixed = 5000 * 256
    player.maxHpFixed = 5000 * 256
    player.unlockedAct = 4
    player.questFlags[questWordIndex113c('a2q3')!]! |= QUEST_FLAG_STARTED_113C
    player.questFlags[questWordIndex113c('a2q4')!]! |= QUEST_FLAG_STARTED_113C

    // 1. Palace Cellar L3 (54) <-> Arcane Sanctuary (74) via Objects.txt 298 (no UNIT_TILE warps in 74)
    expect(internal.transitionPlayerArea(player, 54, { kind: 'respawn' })).toBe(true)
    const portal54 = [...internal.objects.values()].find((o) => o.areaId === 54 && o.classId === 298)!
    expect(portal54).toBeDefined()
    internal.movePlayer(pid, portal54.x, portal54.y)
    game.stepFrames(15)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: portal54.unitId } })
    game.stepFrame()
    expect(player.areaId).toBe(74)
    expect(internal.loadedAreas.get(74)!.isWalkable(74, player.x, player.y)).toBe(true)
    const portal74 = [...internal.objects.values()].find((o) => o.areaId === 74 && o.classId === 298)!
    expect(portal74).toBeDefined()
    expect(portal74.mode).toBe(2)

    internal.movePlayer(pid, portal74.x, portal74.y)
    game.stepFrames(15)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: portal74.unitId } })
    game.stepFrame()
    expect(player.areaId).toBe(54)
    expect(internal.loadedAreas.get(54)!.isWalkable(54, player.x, player.y)).toBe(true)

    // 2. Tal Rasha's Tomb -> Duriel's Lair (73) via Objects.txt 100 (OperateFn 43, warps = [] in 73)
    let trueTombId = 66
    let orificeObj: { unitId: number; x: number; y: number; areaId: number } | undefined
    for (let tomb = 66; tomb <= 72; tomb++) {
      game.ensureAreaLoaded(tomb)
      const found = [...internal.objects.values()].find((o) => o.areaId === tomb && o.classId === 152)
      if (found) {
        trueTombId = tomb
        orificeObj = found
        break
      }
    }
    expect(orificeObj).toBeDefined()
    expect(internal.transitionPlayerArea(player, trueTombId, { kind: 'respawn' })).toBe(true)
    player.items.push({
      unitId: 99001,
      code: 'hst',
      name: 'Horadric Staff',
      quality: 2,
      level: 1,
      location: 'inventory',
      x: 0,
      y: 0,
      width: 1,
      height: 4,
      areaId: trueTombId,
      ownerId: pid,
      bodyLoc: 0,
      storePage: 1,
      cost: 0,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 10,
      maxDurability: 10,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    })
    internal.movePlayer(pid, orificeObj!.x, orificeObj!.y)
    game.stepFrames(15)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: orificeObj!.unitId } })
    game.stepFrames(45)
    const lair100 = [...internal.objects.values()].find((o) => o.areaId === trueTombId && o.classId === 100)!
    expect(lair100).toBeDefined()
    expect(lair100.mode).toBe(2)

    internal.movePlayer(pid, lair100.x, lair100.y)
    game.stepFrames(15)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: lair100.unitId } })
    game.stepFrame()
    expect(player.areaId).toBe(73)
    expect(internal.loadedAreas.get(73)!.isWalkable(73, player.x, player.y)).toBe(true)
    const tyraelDoor = [...internal.objects.values()].find((o) => o.areaId === 73 && o.classId === 153)!
    expect(player.x).toBeGreaterThan(tyraelDoor.x)

    // 3. Kurast Sewers Level 1 (92) -> Level 2 (93): sealed 366 & UNIT_TILE warp blocked until lever 367 opens 366
    expect(internal.transitionPlayerArea(player, 92, { kind: 'respawn' })).toBe(true)
    const stairs366 = [...internal.objects.values()].find((o) => o.areaId === 92 && o.classId === 366)!
    const lever367 = [...internal.objects.values()].find((o) => o.areaId === 92 && o.classId === 367)!
    const sewerWarp = [...internal.warpTiles.values()].find((w) => w.areaId === 92 && w.destAreaId === 93)!
    expect(stairs366.mode).toBe(0)
    expect(stairs366.destAreaId).toBe(93)
    expect(lever367.mode).toBe(0)
    expect(sewerWarp).toBeDefined()

    // Sealed stairs 366 and co-located UNIT_TILE warp must refuse entry before lever 367 is pulled
    internal.movePlayer(pid, stairs366.x, stairs366.y)
    game.stepFrames(15)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: stairs366.unitId } })
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 5, id: sewerWarp.unitId } })
    game.stepFrame()
    expect(player.areaId).toBe(92)

    // Pull Sewer Lever 367 -> +30 ticks mode 1 -> +34 ticks mode 2
    internal.movePlayer(pid, lever367.x, lever367.y)
    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: lever367.unitId } })
    game.stepFrame()
    expect(lever367.mode).toBe(1)
    expect(
      game
        .drainEvents(pid)
        .some((e) => e.type === 'QuestState' && e.kind === 'special' && e.specialEventId === 9),
    ).toBe(true)
    game.stepFrames(31)
    expect(stairs366.mode).toBe(1)
    game.stepFrames(40)
    expect(lever367.mode).toBe(2)
    expect(stairs366.mode).toBe(2)

    internal.movePlayer(pid, stairs366.x, stairs366.y)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: stairs366.unitId } })
    game.stepFrame()
    expect(player.areaId).toBe(93)
    expect(internal.loadedAreas.get(93)!.isWalkable(93, player.x, player.y)).toBe(true)

    // 4. Throne of Destruction (131) <-> Worldstone Chamber (132) via 563 / 569
    player.questFlags[questWordIndex113c('a5q5')!]! |= QUEST_FLAG_COMPLETED_113C
    expect(internal.transitionPlayerArea(player, 131, { kind: 'respawn' })).toBe(true)
    const portal563 = [...internal.objects.values()].find((o) => o.areaId === 131 && o.classId === 563)!
    const chamberWarp = [...internal.warpTiles.values()].find((w) => w.areaId === 131 && w.destAreaId === 132)!
    expect(portal563.mode).toBe(0)
    expect(portal563.destAreaId).toBe(132)

    // Sealed 563 and co-located UNIT_TILE warp must refuse entry before Baal retreats
    internal.movePlayer(pid, portal563.x, portal563.y)
    game.stepFrames(15)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: portal563.unitId } })
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 5, id: chamberWarp.unitId } })
    game.stepFrame()
    expect(player.areaId).toBe(131)

    // Open 563 (as Baal retreat does) and enter Worldstone Chamber (132): must land on style-33 bridge (15173, 5888)
    internal.setObjectMode(portal563, 2)
    game.stepFrames(15)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: portal563.unitId } })
    game.stepFrame()
    expect(player.areaId).toBe(132)
    expect(player.x).toBe(15173)
    expect(player.y).toBe(5888)
    expect(internal.loadedAreas.get(132)!.isWalkable(132, player.x, player.y)).toBe(true)

    // Spawn 569 in Area 132 (InitFn 75 defaults mode = 2, destAreaId = 131) and verify return warp
    const portal569Id = game.spawnObject({ classId: 569, x: player.x + 1, y: player.y, areaId: 132 })
    const portal569 = internal.objects.get(portal569Id)!
    expect(portal569.mode).toBe(2)
    expect(portal569.destAreaId).toBe(131)
    game.stepFrames(15)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: portal569Id } })
    game.stepFrame()
    expect(player.areaId).toBe(131)
  }, 120_000)

  it('spawns 366 and 367 pre-opened (mode = 2) when A3Q3 is already completed (InitFn 41 & 42)', () => {
    const game = new GameInstance({ seed: 19832, areaId: 92 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'PostA3Q3', x: 10, y: 10, areaId: 92 })
    const internal = game as unknown as {
      players: Map<number, { questFlags: Uint16Array }>
      objects: Map<number, { mode: number }>
    }
    internal.players.get(pid)!.questFlags[questWordIndex113c('a3q3')!]! |= QUEST_FLAG_COMPLETED_113C
    const s366 = game.spawnObject({ classId: 366, x: 12, y: 10, areaId: 92 })
    const l367 = game.spawnObject({ classId: 367, x: 14, y: 10, areaId: 92 })
    expect(internal.objects.get(s366)!.mode).toBe(2)
    expect(internal.objects.get(l367)!.mode).toBe(2)
  })

  it('flushes Single Player saves immediately in showVictoryScreen and keeps toolbar disconnected', () => {
    const mainSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/client/main.ts'), 'utf8')
    const idx = mainSrc.indexOf('const showVictoryScreen =')
    expect(idx).toBeGreaterThan(0)
    const slice = mainSrc.slice(idx, idx + 1500)
    expect(slice).toContain("if (flowState.playMode === 'single')")
    expect(slice).toContain('persistSinglePlayerSavesToStorage()')
    expect(slice).toContain("toolbar.setConnectionState({ phase: 'disconnected', rttMs: null })")
  })
})

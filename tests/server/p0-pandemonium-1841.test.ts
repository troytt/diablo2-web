/**
 * Issue #1841 — 1.13c Pandemonium Event (`Uber Tristram` & Mini-Uber Realms `133..136`).
 *
 * Verifies:
 * 1. Hell key drops (`pk1` Countess, `pk2` Summoner, `pk3` Nihlathak) vs Normal/NM zero keys.
 * 2. Cube recipes (`pk1+pk2+pk3` -> non-duplicate `{133, 134, 135}`, `dhn+bey+mbr` -> `136`) in Hell Expansion Harrogath (`109`),
 *    rejection in NM / non-109 / Classic, non-overlapping red portal placement, permanent bidirectional `109 <-> 133..136`
 *    `classId=60` portals, and `D2Game.dll` `0x6FCCF4B5` Town Portal restriction inside `136` (`Uber Tristram`).
 * 3. Real DRLG bootstrap of areas `133..136` (`397` / `402` / `26, 268, 269` stripped, normal preset monsters
 *    suppressed in `136`, and `#704..#709` spawned on standable floor).
 * 4. All 6 Pandemonium Bosses (`#704..#709`): `mlvl=110`, resistances, `damageRegen=4` (+ PMH suppression),
 *    innate auras (`#704` lvl 20 Conviction, `#708` lvl 14 Holy Freeze), boss skills (`#704` offensive spells,
 *    `#705` Diablogeddon, `#706` Chilling Armor + MonTeleport + Frost Nova, `#707` 9-bolt AndrialSpray,
 *    `#709` Chilling Armor & zero `#570` clone), and Uber Prime Evil minion spawning (`15/30`, `4/10`, `7/15` caps, `0` XP, `0` drops).
 * 5. Guaranteed organ drops (`dhn`, `bey`, `mbr`), Uber Tristram 3-boss finale tracker (`1` Unique `cm2` `Hellfire Torch`
 *    `id=400`, `ilvl=110`, `+3` class `0..6` `statId=83`, `10..20` stats & all-res, `+8` light, `5%` CtC Firestorm,
 *    Level 30 `Hydra` `10/10` charges + `N` × `Standard of Heroes` `std` `ilvl=90`), minion despawn, and `carry1=1` pickup guard.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DRLG_GetActNoFromLevelId } from '../../src/common/drlg/drlg-drlg.ts'
import { decodeStat204ChargedSkill113c } from '../../src/common/items/charged-skill.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { rolledPropsToItemStats } from '../../src/common/items/item-bridge.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import { GameInstance, type ServerItemEntry } from '../../src/server/engine/game-instance.ts'
import {
  executePendingMonsterDrop113c,
  resolveMonsterDropPending113c,
} from '../../src/server/items/drop-pipeline.ts'
import { createAreaBootstrapResolver } from '../../src/server/world/area-bootstrap.ts'
import { computeUberPrimeMinionCap113c } from '../../src/server/world/pandemonium-113c.ts'

interface InternalMonsterView {
  unitId: number
  hcIdx: number
  level: number
  hp: number
  maxHp: number
  dead: boolean
  damageRegen: number
  auraSkillId?: number | undefined
  auraLevel?: number | undefined
  resistances: {
    phys: number
    magic: number
    fire: number
    light: number
    cold: number
    poison: number
  }
  states: Set<number>
  isUberSummonedMinion: boolean
  experience: number
  x: number
  y: number
}

interface InternalPlayerView {
  unitId: number
  areaId: number
  act: number
  x: number
  y: number
  targetX: number
  targetY: number
  hp: number
  maxHp: number
  hpFixed: number
  maxHpFixed: number
  experience: number
  lastWarpInteractFrame: number
  statusFlags?: number | undefined
  items: ServerItemEntry[]
}

interface InternalObjectView {
  unitId: number
  classId: number
  areaId: number
  x: number
  y: number
  destAreaId?: number | undefined
  linkedPortalId?: number | undefined
}

interface InternalGameView {
  players: Map<number, InternalPlayerView>
  monsters: Map<number, InternalMonsterView>
  objects: Map<number, InternalObjectView>
  groundItems: Map<number, ServerItemEntry>
}

function viewGame(game: GameInstance): InternalGameView {
  return game as unknown as InternalGameView
}

function giveItemToContainer(
  game: GameInstance,
  pid: number,
  code: string,
  container: 'inventory' | 'cube',
  gridX: number,
  gridY: number,
): number {
  const player = viewGame(game).players.get(pid)!
  const itemId = game.spawnGroundItem({
    code,
    x: player.x,
    y: player.y,
    areaId: player.areaId,
  })
  game.enqueueCommand(pid, { type: 'ItemPickup', itemId, toCursor: true })
  game.stepFrame()
  const buffer = container === 'cube' ? 3 : 0
  game.enqueueCommand(pid, { type: 'ItemPlace', itemId, x: gridX, y: gridY, buffer })
  game.stepFrame()
  game.drainEvents(pid)
  return itemId
}

function addCubeAndIngredients(
  game: GameInstance,
  pid: number,
  codes: readonly string[],
): void {
  const player = viewGame(game).players.get(pid)!
  if (!player.items.some((i) => i.code.trim().toLowerCase() === 'box' && i.location === 'inventory')) {
    giveItemToContainer(game, pid, 'box', 'inventory', 0, 0)
  }
  codes.forEach((code, idx) => {
    giveItemToContainer(game, pid, code, 'cube', idx % 3, Math.floor(idx / 3) * 2)
  })
}

describe('Issue #1841 — 1.13c Pandemonium Event (Keys, Organs, Red Portals, 6 Uber Bosses & Hellfire Torch)', () => {
  it('drops pk1/pk2/pk3 from Countess, Summoner, and Nihlathak in Hell only (never Normal/NM)', () => {
    const tables = getEmbeddedDropTables()
    const keySources = [
      {
        label: 'The Countess',
        subjectId: 'corruptrogue3',
        superUniqueId: 'The Countess',
        monsterRank: 'unique' as const,
        mlvl: 82,
        expectedKey: 'pk1',
      },
      {
        label: 'The Summoner',
        subjectId: 'summoner',
        superUniqueId: 'The Summoner',
        monsterRank: 'unique' as const,
        mlvl: 83,
        expectedKey: 'pk2',
      },
      {
        label: 'Nihlathak',
        subjectId: 'nihlathakboss',
        superUniqueId: 'Nihlathak Boss',
        monsterRank: 'unique' as const,
        mlvl: 95,
        expectedKey: 'pk3',
      },
    ]

    for (const src of keySources) {
      const pendingHell = resolveMonsterDropPending113c(
        undefined,
        {
          kind: 'kill',
          subjectId: src.subjectId,
          superUniqueId: src.superUniqueId,
          monsterRank: src.monsterRank,
          monsterLevel: src.mlvl,
          x: 10,
          y: 10,
        },
        {
          dropTables: tables,
          difficulty: 'hell',
          gamePlayers: 8,
          partyPlayers: 8,
        },
      )!
      expect(pendingHell).toBeTruthy()

      let hellKeyCount = 0
      for (let i = 1; i <= 120; i++) {
        const drops = executePendingMonsterDrop113c(tables, pendingHell, 'hell', 0x1841_0000 + i * 7919)
        hellKeyCount += drops.filter((d) => d.base.id === src.expectedKey).length
      }
      expect(hellKeyCount, `${src.label} should drop ${src.expectedKey} in Hell`).toBeGreaterThan(0)

      for (const diff of ['normal', 'nightmare'] as const) {
        const pendingLow = resolveMonsterDropPending113c(
          undefined,
          {
            kind: 'kill',
            subjectId: src.subjectId,
            superUniqueId: src.superUniqueId,
            monsterRank: src.monsterRank,
            monsterLevel: src.mlvl,
            x: 10,
            y: 10,
          },
          {
            dropTables: tables,
            difficulty: diff,
            gamePlayers: 8,
            partyPlayers: 8,
          },
        )!
        expect(pendingLow).toBeTruthy()
        for (let i = 1; i <= 80; i++) {
          const drops = executePendingMonsterDrop113c(tables, pendingLow, diff, 0x2841_0000 + i * 6151)
          expect(
            drops.some((d) => d.base.id === 'pk1' || d.base.id === 'pk2' || d.base.id === 'pk3'),
            `${src.label} must never drop keys in ${diff}`,
          ).toBe(false)
        }
      }
    }
  })

  it('opens non-duplicate non-overlapping bidirectional red portals (133..136) in Hell Expansion Harrogath and blocks TP in 136', () => {
    // 1. Rejects key set in Nightmare Harrogath (difficulty = 1) and Hell Rogue Encampment (areaId = 1) and Classic (statusFlags = 0)
    const nmGame = new GameInstance({ seed: 0x1841_01, difficulty: 1, areaId: 109 })
    const nmPid = nmGame.connectPlayer({ charClass: 'pal', name: 'NmPal', level: 85, areaId: 109, x: 50, y: 50 })
    nmGame.drainEvents(nmPid)
    addCubeAndIngredients(nmGame, nmPid, ['pk1', 'pk2', 'pk3'])
    nmGame.enqueueCommand(nmPid, { type: 'ClickButton', buttonId: 0x18 })
    nmGame.stepFrame()
    const nmEvents = nmGame.drainEvents(nmPid)
    expect(nmEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(viewGame(nmGame).players.get(nmPid)!.items.filter((i) => i.location === 'cube')).toHaveLength(3)

    const act1Game = new GameInstance({ seed: 0x1841_02, difficulty: 2, areaId: 1 })
    const act1Pid = act1Game.connectPlayer({ charClass: 'pal', name: 'Act1Pal', level: 85, areaId: 1, x: 50, y: 50 })
    act1Game.drainEvents(act1Pid)
    addCubeAndIngredients(act1Game, act1Pid, ['pk1', 'pk2', 'pk3'])
    act1Game.enqueueCommand(act1Pid, { type: 'ClickButton', buttonId: 0x18 })
    act1Game.stepFrame()
    expect(act1Game.drainEvents(act1Pid).some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)

    const classicGame = new GameInstance({ seed: 0x1841_03, difficulty: 2, areaId: 109 })
    const classicPid = classicGame.connectPlayer({
      charClass: 'pal',
      name: 'ClassicPal',
      level: 85,
      areaId: 109,
      x: 50,
      y: 50,
      statusFlags: 0x00,
    })
    classicGame.drainEvents(classicPid)
    addCubeAndIngredients(classicGame, classicPid, ['pk1', 'pk2', 'pk3'])
    classicGame.enqueueCommand(classicPid, { type: 'ClickButton', buttonId: 0x18 })
    classicGame.stepFrame()
    expect(classicGame.drainEvents(classicPid).some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)

    // 2. Hell Expansion Harrogath (areaId = 109, difficulty = 2): 3 key sets open {133, 134, 135} with zero duplicates
    const game = new GameInstance({ seed: 0x1841_109, difficulty: 2, areaId: 109 })
    const pid = game.connectPlayer({ charClass: 'pal', name: 'Paladin', level: 85, areaId: 109, x: 50, y: 50 })
    game.drainEvents(pid)
    const v = viewGame(game)
    const player = v.players.get(pid)!
    expect(player.areaId).toBe(109)

    for (let i = 0; i < 3; i++) {
      addCubeAndIngredients(game, pid, ['pk1', 'pk2', 'pk3'])
      game.enqueueCommand(pid, { type: 'ClickButton', buttonId: 0x18 })
      game.stepFrame()
      game.drainEvents(pid)
    }

    const townRedPortalsAfterKeys = [...v.objects.values()].filter(
      (o) => o.areaId === 109 && o.classId === 60,
    )
    expect(townRedPortalsAfterKeys).toHaveLength(3)
    expect(townRedPortalsAfterKeys.map((o) => o.destAreaId!).sort((a, b) => a - b)).toEqual([133, 134, 135])

    // 4th key set in the same game must be rejected (PlaySound 19) without consuming keys
    addCubeAndIngredients(game, pid, ['pk1', 'pk2', 'pk3'])
    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'ClickButton', buttonId: 0x18 })
    game.stepFrame()
    const fourthKeyEvents = game.drainEvents(pid)
    expect(fourthKeyEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(
      player.items
        .filter((i) => i.location === 'cube')
        .map((i) => i.code.trim())
        .sort(),
    ).toEqual(['pk1', 'pk2', 'pk3'])
    player.items = player.items.filter((i) => i.location !== 'cube')

    // Transmute dhn + bey + mbr -> opens permanent red portal to 136 (Uber Tristram)
    addCubeAndIngredients(game, pid, ['dhn', 'bey', 'mbr'])
    game.enqueueCommand(pid, { type: 'ClickButton', buttonId: 0x18 })
    game.stepFrame()
    game.drainEvents(pid)

    // 2nd organ set in the same game must also be rejected (PlaySound 19) without consuming organs
    addCubeAndIngredients(game, pid, ['dhn', 'bey', 'mbr'])
    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'ClickButton', buttonId: 0x18 })
    game.stepFrame()
    expect(game.drainEvents(pid).some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(player.items.filter((i) => i.location === 'cube')).toHaveLength(3)
    player.items = player.items.filter((i) => i.location !== 'cube')

    const allTownRedPortals = [...v.objects.values()].filter(
      (o) => o.areaId === 109 && o.classId === 60,
    )
    expect(allTownRedPortals).toHaveLength(4)
    expect(allTownRedPortals.map((o) => o.destAreaId!).sort((a, b) => a - b)).toEqual([133, 134, 135, 136])

    // All 4 town portals must be on distinct non-overlapping coordinates (>= 3 sub-tiles apart)
    for (let i = 0; i < allTownRedPortals.length; i++) {
      for (let j = i + 1; j < allTownRedPortals.length; j++) {
        const a = allTownRedPortals[i]!
        const b = allTownRedPortals[j]!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2.99)
      }
    }

    // Every town portal has a paired permanent classId=60 return portal in its destination area (133..136)
    for (const townPortal of allTownRedPortals) {
      expect(townPortal.linkedPortalId).toBeDefined()
      const retPortal = v.objects.get(townPortal.linkedPortalId!)
      expect(retPortal).toBeDefined()
      expect(retPortal!.classId).toBe(60)
      expect(retPortal!.areaId).toBe(townPortal.destAreaId)
      expect(retPortal!.destAreaId).toBe(109)
      expect(retPortal!.linkedPortalId).toBe(townPortal.unitId)
    }

    const snapToPortal = (portal: InternalObjectView): void => {
      player.x = portal.x
      player.y = portal.y
      player.targetX = portal.x
      player.targetY = portal.y
      player.lastWarpInteractFrame = -100
    }

    // Travel 109 -> 133 -> 109 -> 136 -> 109 via Interact and verify neither portal closes!
    const portal133 = allTownRedPortals.find((o) => o.destAreaId === 133)!
    snapToPortal(portal133)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: portal133.unitId } })
    game.stepFrame()
    game.drainEvents(pid)
    expect(player.areaId).toBe(133)
    expect(v.objects.has(portal133.unitId)).toBe(true)

    // Town Portal IS allowed inside prelude area 133 (Matron's Den) via ItemUse 'tsc'
    const tsc133Id = giveItemToContainer(game, pid, 'tsc', 'inventory', 4, 0)
    game.enqueueCommand(pid, { type: 'ItemUse', itemId: tsc133Id, at: { x: player.x, y: player.y } })
    game.stepFrame()
    game.drainEvents(pid)
    expect([...v.objects.values()].some((o) => o.areaId === 133 && o.classId === 59)).toBe(true)

    // Return 133 -> 109 via linked red portal
    const ret133 = v.objects.get(portal133.linkedPortalId!)!
    snapToPortal(ret133)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: ret133.unitId } })
    game.stepFrame()
    game.drainEvents(pid)
    expect(player.areaId).toBe(109)
    expect(v.objects.has(ret133.unitId)).toBe(true)

    // Enter 136 (Uber Tristram) via red portal
    const portal136 = allTownRedPortals.find((o) => o.destAreaId === 136)!
    snapToPortal(portal136)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: portal136.unitId } })
    game.stepFrame()
    game.drainEvents(pid)
    expect(player.areaId).toBe(136)
    expect(v.objects.has(portal136.unitId)).toBe(true)

    // Town Portal MUST BE REJECTED inside 136 (D2Game.dll 0x6FCCF4B5) for both ItemUse 'tsc' and TownPortal command!
    const tsc136Id = giveItemToContainer(game, pid, 'tsc', 'inventory', 5, 0)
    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'ItemUse', itemId: tsc136Id, at: { x: player.x, y: player.y } })
    game.stepFrame()
    const tpItemUseEvents = game.drainEvents(pid)
    expect(tpItemUseEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(player.items.some((i) => i.unitId === tsc136Id)).toBe(true)
    expect([...v.objects.values()].some((o) => o.areaId === 136 && o.classId === 59)).toBe(false)

    game.enqueueCommand(pid, { type: 'TownPortal' })
    game.stepFrame()
    const tpCmdEvents = game.drainEvents(pid)
    expect(tpCmdEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(player.items.some((i) => i.unitId === tsc136Id)).toBe(true)
    expect([...v.objects.values()].some((o) => o.areaId === 136 && o.classId === 59)).toBe(false)

    // Return 136 -> 109 via permanent red portal
    const ret136 = v.objects.get(portal136.linkedPortalId!)!
    snapToPortal(ret136)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: ret136.unitId } })
    game.stepFrame()
    game.drainEvents(pid)
    expect(player.areaId).toBe(109)
    expect(v.objects.has(ret136.unitId)).toBe(true)
  })

  it('bootstraps real DRLG levels 133..136 with exact preset object removals and Uber Boss placements', async () => {
    const packedDir = path.resolve(process.cwd(), 'public/act-packs/tiles')
    if (!fs.existsSync(path.join(packedDir, 'drlg-bundle.json'))) return
    await import('../../tools/lib/node-map-loader.ts')
    const { MapService } = await import('../../src/client/map/map-service.ts')
    const { createMapServiceAreaLevelSource } = await import('../../src/client/map/map-service-area-source.ts')
    const svc = await MapService.fromPackedDir('public/act-packs/tiles')
    const resolver = createAreaBootstrapResolver(createMapServiceAreaLevelSource(svc))

    const b133 = resolver({ act: DRLG_GetActNoFromLevelId(133), areaId: 133, mapSeed: 0x1841_5555, difficulty: 2 })!
    expect(b133).toBeTruthy()
    expect(b133.objects.some((o) => o.classId === 397)).toBe(false)
    const lilith = b133.monsters.find((m) => m.classId === 707)
    expect(lilith).toBeDefined()
    expect(b133.isWalkable(133, lilith!.x, lilith!.y)).toBe(true)

    const b134 = resolver({ act: DRLG_GetActNoFromLevelId(134), areaId: 134, mapSeed: 0x1841_5555, difficulty: 2 })!
    expect(b134).toBeTruthy()
    expect(b134.objects.some((o) => o.classId === 402 || o.isWaypoint)).toBe(false)
    const uberDuriel = b134.monsters.find((m) => m.classId === 708)
    expect(uberDuriel).toBeDefined()
    expect(b134.isWalkable(134, uberDuriel!.x, uberDuriel!.y)).toBe(true)

    const b135 = resolver({ act: DRLG_GetActNoFromLevelId(135), areaId: 135, mapSeed: 0x1841_5555, difficulty: 2 })!
    expect(b135).toBeTruthy()
    expect(b135.objects.some((o) => o.classId === 397)).toBe(false)
    const uberIzual = b135.monsters.find((m) => m.classId === 706)
    expect(uberIzual).toBeDefined()
    expect(b135.isWalkable(135, uberIzual!.x, uberIzual!.y)).toBe(true)

    const b136 = resolver({ act: DRLG_GetActNoFromLevelId(136), areaId: 136, mapSeed: 0x1841_5555, difficulty: 2 })!
    expect(b136).toBeTruthy()
    expect(b136.objects.some((o) => o.classId === 26 || o.classId === 268 || o.classId === 269)).toBe(false)
    expect(b136.monsters.map((m) => m.classId).sort((a, b) => a - b)).toEqual([704, 705, 709])
    for (const boss of b136.monsters) {
      expect(b136.isWalkable(136, boss.x, boss.y)).toBe(true)
    }
  }, 60_000)

  it('enforces mlvl=110, resistances, DamageRegen=4, innate auras, boss skills, and proximity minion caps across #704..#709', () => {
    // 1. Proximity minion cap helper (`D2Game.dll` `0x6FCD0C40`: <= 25 sub-tiles halves/reduces cap)
    const mephClose = [
      { unitId: 1, hcIdx: 704, x: 20, y: 20 },
      { unitId: 2, hcIdx: 705, x: 35, y: 20 }, // 15 <= 25
    ]
    const mephIsolated = [
      { unitId: 1, hcIdx: 704, x: 20, y: 20 },
      { unitId: 2, hcIdx: 705, x: 60, y: 20 }, // 40 > 25
    ]
    expect(computeUberPrimeMinionCap113c(704, 1, 20, 20, mephClose)).toBe(15)
    expect(computeUberPrimeMinionCap113c(704, 1, 20, 20, mephIsolated)).toBe(30)
    expect(computeUberPrimeMinionCap113c(705, 2, 35, 20, mephClose)).toBe(4)
    expect(computeUberPrimeMinionCap113c(705, 2, 60, 20, mephIsolated)).toBe(10)
    expect(computeUberPrimeMinionCap113c(709, 3, 25, 20, mephClose)).toBe(7)
    expect(computeUberPrimeMinionCap113c(709, 3, 90, 20, mephIsolated)).toBe(15)

    // 2. Spawn all 6 bosses in Hell GameInstance and verify stats, innate auras, and DamageRegen=4
    const game = new GameInstance({ seed: 0x1841_704, difficulty: 2, areaId: 136 })
    const pid = game.connectPlayer({
      charClass: 'pal',
      name: 'Zealot',
      level: 90,
      areaId: 136,
      x: 20,
      y: 20,
      hp: 50000,
      maxHp: 50000,
    })
    game.drainEvents(pid)
    const v = viewGame(game)

    const m704 = v.monsters.get(game.spawnMonster({ classId: 704, hcIdx: 704, x: 28, y: 20, areaId: 136 }))!
    const m705 = v.monsters.get(game.spawnMonster({ classId: 705, hcIdx: 705, x: 20, y: 28, areaId: 136 }))!
    const m706 = v.monsters.get(game.spawnMonster({ classId: 706, hcIdx: 706, x: 34, y: 20, areaId: 135 }))!
    const m707 = v.monsters.get(game.spawnMonster({ classId: 707, hcIdx: 707, x: 30, y: 20, areaId: 133 }))!
    const m708 = v.monsters.get(game.spawnMonster({ classId: 708, hcIdx: 708, x: 30, y: 20, areaId: 134 }))!
    const m709 = v.monsters.get(game.spawnMonster({ classId: 709, hcIdx: 709, x: 26, y: 26, areaId: 136 }))!

    for (const boss of [m704, m705, m706, m707, m708, m709]) {
      expect(boss.level).toBe(110)
      expect(boss.damageRegen).toBe(4)
    }
    expect({
      ltng: m704.resistances.light,
      pois: m704.resistances.poison,
      aura: m704.auraSkillId,
      alvl: m704.auraLevel,
    }).toEqual({
      ltng: 110,
      pois: 110,
      aura: 123,
      alvl: 20,
    })
    expect(m705.resistances.fire).toBe(110)
    expect(m706.resistances.cold).toBe(110)
    expect({ phys: m707.resistances.phys, pois: m707.resistances.poison }).toEqual({ phys: 66, pois: 110 })
    expect({
      phys: m708.resistances.phys,
      fire: m708.resistances.fire,
      aura: m708.auraSkillId,
      alvl: m708.auraLevel,
    }).toEqual({
      phys: 50,
      fire: 75,
      aura: 114,
      alvl: 14,
    })
    expect(m709.resistances.cold).toBe(110)

    // DamageRegen=4 heals each tick when un-poisoned, and stops under Prevent Monster Heal (state 52)
    m704.hp = m704.maxHp - 5000
    const beforeRegen = m704.hp
    game.stepFrame()
    expect(m704.hp).toBeGreaterThan(beforeRegen)
    m704.states.add(52) // STATE_PREVENTHEAL
    const frozenHp = m704.hp
    game.stepFrame()
    expect(m704.hp).toBe(frozenHp)
    m704.states.delete(52)

    // Step Area 136 for 80 ticks: verify Uber Mephisto casts spells & summons 0-XP undead,
    // Uber Diablo casts Diablogeddon & summons Pit Lords, Uber Baal casts Chilling Armor & summons Specters/Vampires (and NO #570 clone!)
    const events136: ServerEvent[] = []
    const playerRec = v.players.get(pid)!
    for (let t = 0; t < 80; t++) {
      playerRec.hp = 50000
      playerRec.hpFixed = 50000 * 256
      game.stepFrame()
      events136.push(...game.drainEvents(pid))
    }
    const castSkills136 = new Set(
      events136
        .filter((e): e is Extract<ServerEvent, { type: 'SkillCast' }> => e.type === 'SkillCast')
        .map((e) => e.skillId ?? e.skill),
    )
    expect(castSkills136.has(349)).toBe(true) // Diablogeddon
    expect(castSkills136.has(60)).toBe(true) // Baal Chilling Armor
    expect(
      [334, 185, 186, 192, 346, 59].some((sid) => castSkills136.has(sid)),
      'Uber Mephisto must cast offensive spells',
    ).toBe(true)

    const uberMinions = [...v.monsters.values()].filter((m) => m.isUberSummonedMinion)
    expect(uberMinions.length).toBeGreaterThanOrEqual(3)
    for (const min of uberMinions) {
      expect(min.experience).toBe(0)
      expect([712, 725, 726, 727, 728, 729, 730, 731, 732]).toContain(min.hcIdx)
    }
    expect([...v.monsters.values()].some((m) => m.hcIdx === 570)).toBe(false)

    // Verify #706 Uber Izual (Chilling Armor #60 + MonTeleport #184 + Frost Nova #44)
    const izGame = new GameInstance({ seed: 0x1841_706, difficulty: 2, areaId: 135 })
    const izPid = izGame.connectPlayer({
      charClass: 'sor',
      name: 'Sorc',
      level: 90,
      areaId: 135,
      x: 20,
      y: 20,
      hp: 50000,
      maxHp: 50000,
    })
    izGame.drainEvents(izPid)
    const izView = viewGame(izGame)
    const izId = izGame.spawnMonster({ classId: 706, hcIdx: 706, x: 38, y: 20, areaId: 135 })
    const izEvents: ServerEvent[] = []
    for (let t = 0; t < 160; t++) {
      const p = izView.players.get(izPid)!
      p.hp = 50000
      p.hpFixed = 50000 * 256
      izGame.stepFrame()
      izEvents.push(...izGame.drainEvents(izPid))
    }
    const izRec = izView.monsters.get(izId)!
    expect(izRec.states.has(20)).toBe(true) // Chilling Armor
    const izSkills = new Set(
      izEvents
        .filter((e): e is Extract<ServerEvent, { type: 'SkillCast' }> => e.type === 'SkillCast')
        .map((e) => e.skillId ?? e.skill),
    )
    expect(izSkills.has(184)).toBe(true) // MonTeleport onto player
    expect(izSkills.has(44)).toBe(true) // Frost Nova after blinking close

    // Verify #707 Lilith (#164 AndrialSpray 9-bolt #32 fan)
    const lilGame = new GameInstance({ seed: 0x1841_707, difficulty: 2, areaId: 133 })
    const lilPid = lilGame.connectPlayer({
      charClass: 'sor',
      name: 'LilSorc',
      level: 90,
      areaId: 133,
      x: 20,
      y: 20,
      hp: 50000,
      maxHp: 50000,
    })
    lilGame.drainEvents(lilPid)
    const lilView = viewGame(lilGame)
    lilGame.spawnMonster({ classId: 707, hcIdx: 707, x: 28, y: 20, areaId: 133 })
    const lilEvents: ServerEvent[] = []
    for (let t = 0; t < 90; t++) {
      const p = lilView.players.get(lilPid)!
      p.hp = 50000
      p.hpFixed = 50000 * 256
      lilGame.stepFrame()
      lilEvents.push(...lilGame.drainEvents(lilPid))
    }
    const sprayMissiles = lilEvents.filter(
      (e): e is Extract<ServerEvent, { type: 'CreateMissile' }> =>
        e.type === 'CreateMissile' && e.missileClassId === 32,
    )
    expect(sprayMissiles.length).toBeGreaterThanOrEqual(9) // 9-bolt AndrialSpray fan
  })

  it('drops guaranteed organs (dhn/bey/mbr), awards 0 XP/drops for Uber minions, drops Hellfire Torch + N Standards ONLY on the 3rd Uber Prime Evil kill, and enforces carry1=1', () => {
    // 1. Guaranteed organ drops from #707 (dhn), #708 (bey), #706 (mbr)
    const tables = getEmbeddedDropTables()
    for (const [id, organ] of [
      ['uberandariel', 'dhn'],
      ['uberduriel', 'bey'],
      ['uberizual', 'mbr'],
    ] as const) {
      const pending = resolveMonsterDropPending113c(
        undefined,
        {
          kind: 'kill',
          subjectId: id,
          monsterRank: 'boss',
          monsterLevel: 110,
          x: 20,
          y: 20,
        },
        {
          dropTables: tables,
          difficulty: 'hell',
          gamePlayers: 1,
          partyPlayers: 1,
        },
      )!
      expect(pending).toBeTruthy()
      const drops = executePendingMonsterDrop113c(tables, pending, 'hell', 0x1841_0999)
      expect(drops.map((d) => d.base.id)).toEqual([organ])
    }

    // Also verify real GameInstance kills in 133/134/135 drop dhn/bey/mbr on the ground
    for (const [areaId, hcIdx, organ] of [
      [133, 707, 'dhn'],
      [134, 708, 'bey'],
      [135, 706, 'mbr'],
    ] as const) {
      const subGame = new GameInstance({ seed: 0x1841_1000 + areaId, difficulty: 2, areaId })
      const sp = subGame.connectPlayer({ charClass: 'pal', name: 'Smiter', level: 90, areaId, x: 20, y: 20 })
      const bossId = subGame.spawnMonster({ classId: hcIdx, hcIdx, x: 22, y: 20, areaId })
      subGame.applyDamageToMonster(bossId, 99_999_999, sp, 97, 'phys', 'player', {
        attackKind: 'melee',
        autoHit: true,
        unblockable: true,
      })
      subGame.stepFrames(180)
      const groundCodes = [...viewGame(subGame).groundItems.values()].map((g) => g.code.trim())
      expect(groundCodes).toContain(organ)
    }

    // 2. Full GameInstance 3-player Uber Tristram finale verification
    const game = new GameInstance({ mode: 'realm', seed: 0x1841_136, difficulty: 2, areaId: 136 })
    const p1 = game.connectPlayer({ charClass: 'pal', name: 'Smiter', level: 90, areaId: 136, x: 20, y: 20 })
    const p2 = game.connectPlayer({ charClass: 'bar', name: 'Barb', level: 90, areaId: 136, x: 21, y: 20 })
    const p3 = game.connectPlayer({ charClass: 'sor', name: 'Sorc', level: 90, areaId: 136, x: 20, y: 21 })
    game.drainEvents(p1)
    game.drainEvents(p2)
    game.drainEvents(p3)
    const v = viewGame(game)

    const mephId = game.spawnMonster({ classId: 704, hcIdx: 704, x: 22, y: 20, areaId: 136 })
    const diabId = game.spawnMonster({ classId: 705, hcIdx: 705, x: 23, y: 20, areaId: 136 })
    const baalId = game.spawnMonster({ classId: 709, hcIdx: 709, x: 24, y: 20, areaId: 136 })
    const minionA = game.spawnMonster({
      classId: 712,
      hcIdx: 712,
      x: 25,
      y: 20,
      areaId: 136,
      experience: 0,
      bossUnitId: diabId,
      isUberSummonedMinion: true,
    })
    const minionB = game.spawnMonster({
      classId: 725,
      hcIdx: 725,
      x: 25,
      y: 22,
      areaId: 136,
      experience: 0,
      bossUnitId: mephId,
      isUberSummonedMinion: true,
    })

    // Freeze bosses while testing deterministic kill order so they don't spawn extra minions mid-step
    for (const id of [mephId, diabId, baalId, minionA, minionB]) {
      const m = v.monsters.get(id)! as InternalMonsterView & { cooldown?: number; nextAiFrame?: number }
      m.cooldown = 99999
      m.nextAiFrame = 99999
    }

    const killMonsterAndFlushDrops = (monId: number): void => {
      // #712 Pit Lord is immune to all 5 non-physical channels (ResMa/Fi/Li/Co/Po >= 100);
      // Paladin #97 Smite ('phys', autoHit, unblockable) pierces defense/block and damages every Uber unit.
      const landed = game.applyDamageToMonster(monId, 99_999_999, p1, 97, 'phys', 'player', {
        attackKind: 'melee',
        autoHit: true,
        unblockable: true,
      })
      expect(landed).toBe(true)
      expect(v.monsters.get(monId)?.dead).toBe(true)
      game.stepFrames(320)
    }

    // Killing summoned Uber minion A grants 0 XP and 0 ground items!
    const xpBeforeMinion = v.players.get(p1)!.experience
    killMonsterAndFlushDrops(minionA)
    expect(v.players.get(p1)!.experience).toBe(xpBeforeMinion)
    expect(v.groundItems.size).toBe(0)

    // Kill 1st Uber Prime Evil (#704 Uber Mephisto) -> 0 finale drops, minionB still alive!
    killMonsterAndFlushDrops(mephId)
    expect(v.groundItems.size).toBe(0)
    expect(v.monsters.has(minionB)).toBe(true)

    // Kill 2nd Uber Prime Evil (#705 Uber Diablo) -> 0 finale drops, minionB still alive!
    killMonsterAndFlushDrops(diabId)
    expect(v.groundItems.size).toBe(0)
    expect(v.monsters.has(minionB)).toBe(true)

    // Kill 3rd (last) Uber Prime Evil (#709 Uber Baal) -> minionB immediately despawns, and 1 Hellfire Torch + 3 Standards drop!
    killMonsterAndFlushDrops(baalId)
    expect(v.monsters.has(minionB)).toBe(false)

    const ground = [...v.groundItems.values()]
    const torches = ground.filter((g) => g.code.trim() === 'cm2' && g.quality === 7)
    const standards = ground.filter((g) => g.code.trim() === 'std')
    expect(torches).toHaveLength(1)
    expect(standards).toHaveLength(3)

    const torch = torches[0]!
    expect(torch.level).toBe(110)
    expect(torch.rawItemData?.ilvl).toBe(110)
    expect(torch.rawItemData?.uniqueItemId).toBe(400)
    expect(tables.uniques.getById(400)?.levelreq).toBe(75)
    expect(tables.uniques.getById(400)?.carry1).toBe(true)

    const torchStats = torch.rawItemData?.stats ?? []
    // +3 to a random class (0..6) via statId 83
    const classSkillStat = torchStats.find((s) => s.statId === 83)
    expect(classSkillStat).toBeDefined()
    expect(classSkillStat!.value).toBe(3)
    expect(classSkillStat!.param).toBeGreaterThanOrEqual(0)
    expect(classSkillStat!.param).toBeLessThanOrEqual(6)
    // +10..20 attributes (statIds 0, 1, 2, 3) & +10..20 all resistances (statIds 39, 41, 43, 45)
    for (const attrStatId of [0, 1, 2, 3, 39, 41, 43, 45]) {
      const st = torchStats.find((s) => s.statId === attrStatId)
      expect(st, `statId ${attrStatId} on Hellfire Torch`).toBeDefined()
      expect(st!.value).toBeGreaterThanOrEqual(10)
      expect(st!.value).toBeLessThanOrEqual(20)
    }
    // +8 to light radius (statId 89) & 5% CtC Level 10 Firestorm (#197) on striking (statId 198)
    expect(torchStats.find((s) => s.statId === 89)?.value).toBe(8)
    expect(torchStats.some((s) => s.statId === 198 && s.value === 5)).toBe(true)
    // Level 30 Hydra (skill 62) 10/10 full charges via statId 204
    const chargedStat = torchStats.find((s) => s.statId === 204)
    expect(chargedStat).toBeDefined()
    const decodedCharges = decodeStat204ChargedSkill113c({
      statId: 204,
      param: chargedStat!.param ?? 0,
      value: chargedStat!.value,
    })
    expect(decodedCharges).toMatchObject({
      skillId: 62,
      level: 30,
      charges: 10,
      maxCharges: 10,
    })

    const stdBase = tables.getBase('std')!
    expect((stdBase as { readonly levelreq?: number }).levelreq).toBe(90)
    for (const std of standards) {
      expect(std.level).toBe(90)
      expect(std.rawItemData?.ilvl).toBe(90)
    }

    // 3. `carry1 = 1` enforcement: p1 picks up the dropped Hellfire Torch; a second dropped Torch is rejected for p1 (PlaySound 19)
    //    and remains on the ground so p2 can pick it up!
    game.drainEvents(p1)
    game.enqueueCommand(p1, { type: 'ItemPickup', itemId: torch.unitId, toCursor: false })
    game.stepFrame()
    expect(v.players.get(p1)!.items.some((i) => i.unitId === torch.unitId)).toBe(true)

    const secondTorchId = game.spawnGroundItem({ code: 'cm2', x: 20, y: 20, areaId: 136 })
    const secondTorch = v.groundItems.get(secondTorchId)!
    secondTorch.quality = 7
    if (secondTorch.rawItemData !== undefined) {
      secondTorch.rawItemData = { ...secondTorch.rawItemData, quality: 7, uniqueItemId: 400 }
    }
    game.drainEvents(p1)
    game.enqueueCommand(p1, { type: 'ItemPickup', itemId: secondTorchId, toCursor: false })
    game.stepFrame()
    expect(game.drainEvents(p1).some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(v.groundItems.has(secondTorchId)).toBe(true)

    game.enqueueCommand(p2, { type: 'ItemPickup', itemId: secondTorchId, toCursor: false })
    game.stepFrame()
    expect(v.players.get(p2)!.items.some((i) => i.unitId === secondTorchId)).toBe(true)

    // 4. Verify rolledPropsToItemStats backward-compatibility with legacy { param: undefined, min: 0, max: 6, value: 4 }
    const compatStats = rolledPropsToItemStats([{ code: 'randclassskill', min: 0, max: 6, value: 4 }])
    expect(compatStats).toEqual([{ statId: 83, param: 4, value: 3 }])
  })
})

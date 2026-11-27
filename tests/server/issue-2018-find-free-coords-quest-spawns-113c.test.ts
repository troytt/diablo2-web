import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { createAreaBootstrapResolver } from '../../src/server/world/area-bootstrap.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  hasQuestFlag113c,
  setQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'
import type { LocalAreaLevelGeometry, LocalAreaLevelSource } from '../../src/netproto/index.ts'

interface InternalUnitView {
  readonly unitId: number
  readonly hcIdx?: number
  readonly classId?: number
  readonly superUniqueId?: string
  readonly x: number
  readonly y: number
  readonly areaId: number
  readonly mode?: number
  readonly dead?: boolean
}

function makeCustomGeometry(spec: {
  readonly areaId: number
  readonly originX: number
  readonly originY: number
  readonly subWidth: number
  readonly subHeight: number
  readonly isWalkableCoord: (x: number, y: number) => boolean
  readonly spawnSubX: number
  readonly spawnSubY: number
}): LocalAreaLevelGeometry {
  const blocked = new Uint8Array(spec.subWidth * spec.subHeight)
  for (let sy = 0; sy < spec.subHeight; sy++) {
    for (let sx = 0; sx < spec.subWidth; sx++) {
      const wx = spec.originX + sx
      const wy = spec.originY + sy
      blocked[sy * spec.subWidth + sx] = spec.isWalkableCoord(wx, wy) ? 0 : 1
    }
  }
  return {
    areaId: spec.areaId,
    originX: spec.originX,
    originY: spec.originY,
    subWidth: spec.subWidth,
    subHeight: spec.subHeight,
    blocked,
    spawnTileX: Math.floor(spec.spawnSubX / 5),
    spawnTileY: Math.floor(spec.spawnSubY / 5),
    rooms: [
      {
        areaId: spec.areaId,
        tileX: Math.floor(spec.originX / 5),
        tileY: Math.floor(spec.originY / 5),
      },
    ],
    roomRects: [
      {
        index: 0,
        x: spec.originX,
        y: spec.originY,
        w: spec.subWidth,
        h: spec.subHeight,
        seed: 201800 + spec.areaId,
      },
    ],
    presetUnits: [],
    warps: [],
    adjacentAreaIds: [],
  }
}

describe('Issue #2018: D2GAME_FindFreeCoords (0x6FC54130) maxRadius=100 quest/boss/portal coordinate snapping', () => {
  it('snaps Lord De Seis (Seal 394) + all 5 Doom Knight minions onto walkable North wing hall when West-seal DS1 puts raw (-39, +33) 33 subtiles in void, unlocking Diablo (#243)', () => {
    // Reproduce exact Chaos Sanctuary North Wing Variant B (West-seal) geometry:
    // Walkable hall spans x in [7766, 7815], y in [5145, 5320]; x < 7766 is lava void!
    // Seal 394 is on the West edge at (7773, 5155) -> raw = (7773 - 39, 5155 + 33) = (7734, 5188),
    // which is 33 subtiles West of the nearest 3x3 standable floor at (7767, 5188).
    const isWalkable108 = (x: number, y: number): boolean =>
      x >= 7766 && x <= 7815 && y >= 5145 && y <= 5320
    const source: LocalAreaLevelSource = (req) => {
      if (req.areaId !== 108) return null
      return makeCustomGeometry({
        areaId: 108,
        originX: 7720,
        originY: 5140,
        subWidth: 110,
        subHeight: 190,
        isWalkableCoord: isWalkable108,
        spawnSubX: 60,
        spawnSubY: 20,
      })
    }
    const game = new GameInstance({
      seed: 201801,
      areaId: 108,
      difficulty: 0,
      resolveAreaBootstrap: createAreaBootstrapResolver(source),
    })
    const player = game.connectPlayer({
      charClass: 'sor',
      name: 'ChaosSorc',
      level: 28,
      x: 7775,
      y: 5155,
      areaId: 108,
    })

    // Place all 5 seals (392..396) and Pentagram (255) in Area 108; pre-open 392, 393, 395, 396
    // and mark Vizier & Infector already slain so Seal 394 (Lord De Seis) is the decisive seal!
    const s392 = game.spawnObject({ classId: 392, x: 7785, y: 5250, areaId: 108, mode: 0 })
    const s393 = game.spawnObject({ classId: 393, x: 7785, y: 5255, areaId: 108, mode: 0 })
    const s394 = game.spawnObject({ classId: 394, x: 7773, y: 5155, areaId: 108, mode: 0 })
    const s395 = game.spawnObject({ classId: 395, x: 7795, y: 5260, areaId: 108, mode: 0 })
    const s396 = game.spawnObject({ classId: 396, x: 7775, y: 5270, areaId: 108, mode: 0 })
    game.spawnObject({ classId: 255, x: 7792, y: 5292, areaId: 108, mode: 0 })

    const internal = game as unknown as {
      players: Map<number, { x: number; y: number; areaId: number; questFlags: Uint16Array }>
      monsters: Map<number, InternalUnitView>
      objects: Map<number, InternalUnitView>
    }
    const pRec = internal.players.get(player)!

    for (const sid of [s392, s393, s395, s396, s394]) {
      const sealObj = internal.objects.get(sid)!
      pRec.x = sealObj.x
      pRec.y = sealObj.y
      game.enqueueCommand(player, { type: 'OperateObject', objectId: sid })
      game.stepFrames(1)
    }

    const deSeis = [...internal.monsters.values()].find(
      (m) => m.areaId === 108 && m.superUniqueId === 'Lord De Seis',
    )
    expect(deSeis).toBeDefined()
    expect(isWalkable108(Math.round(deSeis!.x), Math.round(deSeis!.y))).toBe(true)
    expect(deSeis!.x).toBe(7767)
    expect(deSeis!.y).toBeGreaterThanOrEqual(5146)
    expect(deSeis!.y).toBeLessThanOrEqual(5188)

    // Every spawned Chaos seal boss + minion must be strictly on walkable floor (zero void spawns)
    const chaosMonsters = [...internal.monsters.values()].filter((m) => m.areaId === 108)
    expect(chaosMonsters.length).toBeGreaterThanOrEqual(3 + 12)
    for (const mon of chaosMonsters) {
      expect(
        isWalkable108(Math.round(mon.x), Math.round(mon.y)),
        `Monster ${mon.unitId} (${mon.superUniqueId ?? mon.hcIdx}) spawned in void at (${mon.x}, ${mon.y})`,
      ).toBe(true)
    }

    // Kill all 3 seal bosses -> after 125 frames, Diablo (#243) spawns on walkable floor!
    for (const bossId of ['Grand Vizier of Chaos', 'Lord De Seis', 'Infector of Souls']) {
      const boss = [...internal.monsters.values()].find(
        (m) => m.areaId === 108 && m.superUniqueId === bossId && !m.dead,
      )
      expect(boss, `Expected seal boss ${bossId}`).toBeDefined()
      game.applyDamageToMonster(boss!.unitId, 100_000, player)
    }
    game.stepFrames(130)

    const diablo = [...internal.monsters.values()].find(
      (m) => m.areaId === 108 && m.hcIdx === 243 && !m.dead,
    )
    expect(diablo).toBeDefined()
    expect(isWalkable108(Math.round(diablo!.x), Math.round(diablo!.y))).toBe(true)
  })

  it('snaps Baal (#544) death tyrael3 (#521) & Destruction\'s End (#565) onto walkable bridge floor in Worldstone Chamber (Area 132) and snaps Pandemonium Fortress Harrogath portal (#566)', () => {
    // Worldstone Chamber (132): walkable bridge only at x in [5100, 5130], y in [5080, 5120].
    // Baal dies at West chasm edge (5101, 5081), so raw tyrael = (5096, 5076) is in chasm void!
    const isWalkable132 = (x: number, y: number): boolean =>
      x >= 5100 && x <= 5130 && y >= 5080 && y <= 5120
    // Pandemonium Fortress (103): walkable plaza x in [5040, 5070], y in [5040, 5070].
    // Tyrael (#367) stands near East wall (5068, 5055), so raw portal = (5073, 5055) is in void!
    const isWalkable103 = (x: number, y: number): boolean =>
      x >= 5040 && x <= 5070 && y >= 5040 && y <= 5070

    const source: LocalAreaLevelSource = (req) => {
      if (req.areaId === 132) {
        return makeCustomGeometry({
          areaId: 132,
          originX: 5080,
          originY: 5060,
          subWidth: 70,
          subHeight: 80,
          isWalkableCoord: isWalkable132,
          spawnSubX: 30,
          spawnSubY: 30,
        })
      }
      if (req.areaId === 103) {
        return makeCustomGeometry({
          areaId: 103,
          originX: 5030,
          originY: 5030,
          subWidth: 60,
          subHeight: 60,
          isWalkableCoord: isWalkable103,
          spawnSubX: 25,
          spawnSubY: 25,
        })
      }
      return null
    }

    const game = new GameInstance({
      seed: 201802,
      areaId: 132,
      difficulty: 0,
      resolveAreaBootstrap: createAreaBootstrapResolver(source),
    })
    const player = game.connectPlayer({
      charClass: 'sor',
      name: 'SlayerSorc',
      level: 32,
      x: 5105,
      y: 5085,
      areaId: 132,
    })
    const baalId = game.spawnMonster({
      defId: 'baalcrab',
      classId: 544,
      x: 5101,
      y: 5081,
      areaId: 132,
      hp: 50,
      maxHp: 50,
    })
    game.applyDamageToMonster(baalId, 50_000, player)

    const internal = game as unknown as {
      players: Map<number, { x: number; y: number; areaId: number; questFlags: Uint16Array }>
      monsters: Map<number, InternalUnitView>
      objects: Map<number, InternalUnitView>
      loadArea: (areaId: number) => unknown
    }

    const tyrael3 = [...internal.monsters.values()].find(
      (m) => m.areaId === 132 && m.hcIdx === 521 && !m.dead,
    )
    const lastPortal = [...internal.objects.values()].find(
      (o) => o.areaId === 132 && o.classId === 565,
    )
    expect(tyrael3).toBeDefined()
    expect(lastPortal).toBeDefined()
    expect(lastPortal!.mode).toBe(2)
    expect(isWalkable132(Math.round(tyrael3!.x), Math.round(tyrael3!.y))).toBe(true)
    expect(isWalkable132(Math.round(lastPortal!.x), Math.round(lastPortal!.y))).toBe(true)
    expect(
      Math.round(tyrael3!.x) !== Math.round(lastPortal!.x) ||
        Math.round(tyrael3!.y) !== Math.round(lastPortal!.y),
    ).toBe(true)

    // Verify Act 4 Pandemonium Fortress (103) Tyrael (#367) -> Harrogath portal (#566) snaps out of East wall void
    internal.loadArea(103)
    const pRec = internal.players.get(player)!
    // Mark a4q3 completed and move player to Area 103 beside Tyrael (#367) at East edge (5068, 5055)
    setQuestFlag113c(pRec.questFlags, 'a4q3', QUEST_FLAG_COMPLETED_113C)
    expect(hasQuestFlag113c(pRec.questFlags, 'a4q3', QUEST_FLAG_COMPLETED_113C)).toBe(true)
    pRec.areaId = 103
    pRec.x = 5067
    pRec.y = 5055
    const tyrael2Id = game.spawnMonster({
      classId: 367,
      defId: 'tyrael2',
      x: 5068,
      y: 5055,
      areaId: 103,
      isNpc: true,
    })
    game.enqueueCommand(player, {
      type: 'NpcInit',
      target: { unitType: 'monster', id: tyrael2Id },
    } as never)
    game.stepFrames(1)

    const harrogathPortal = [...internal.objects.values()].find(
      (o) => o.areaId === 103 && o.classId === 566,
    )
    expect(harrogathPortal).toBeDefined()
    expect(harrogathPortal!.mode).toBe(2)
    expect(isWalkable103(Math.round(harrogathPortal!.x), Math.round(harrogathPortal!.y))).toBe(true)
  })

  it('snaps SuperUnique Baal Wave 2 (Achmel the Cursed, index 62) and places all 15 minions on walkable floor even near pillars/walls', () => {
    // Walkable throne floor at x in [15090, 15120], y in [5025, 5065]; spawn requested at blocked wall (15080, 5030)
    const isWalkable131 = (x: number, y: number): boolean =>
      x >= 15090 && x <= 15120 && y >= 5025 && y <= 5065
    const source: LocalAreaLevelSource = (req) => {
      if (req.areaId !== 131) return null
      return makeCustomGeometry({
        areaId: 131,
        originX: 15075,
        originY: 5020,
        subWidth: 55,
        subHeight: 55,
        isWalkableCoord: isWalkable131,
        spawnSubX: 25,
        spawnSubY: 25,
      })
    }
    const game = new GameInstance({
      seed: 201803,
      areaId: 131,
      difficulty: 0,
      resolveAreaBootstrap: createAreaBootstrapResolver(source),
    })
    game.connectPlayer({
      charClass: 'sor',
      name: 'ThroneSorc',
      level: 32,
      x: 15100,
      y: 5040,
      areaId: 131,
    })

    const ids = game.spawnSuperUnique({
      superUniqueIndex: 62,
      x: 15080,
      y: 5030,
      areaId: 131,
    })
    // 1 boss (Achmel) + 3 Greater Mummy minions (SuperUniques.txt MinGrp=3/MaxGrp=3) + 10 Burning Dead Cold Mages (#381) = 14 units
    expect(ids.length).toBe(14)

    const internal = game as unknown as {
      monsters: Map<number, InternalUnitView>
    }
    for (const id of ids) {
      const m = internal.monsters.get(id)!
      expect(m).toBeDefined()
      expect(isWalkable131(Math.round(m.x), Math.round(m.y))).toBe(true)
    }
  })
})

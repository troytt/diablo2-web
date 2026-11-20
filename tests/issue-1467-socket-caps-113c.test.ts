import { describe, expect, it } from 'vitest'
import {
  getMaxSockets113c,
  rollItemEtherealAndSockets,
  rollRandomItemSockets113c,
} from '../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { generateVendorStoreItem } from '../src/common/items/vendor-generator.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { VendorNpcId } from '../src/common/units/npc-table.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_REWARD_PENDING_113C,
  questWordIndex113c,
  setQuestFlag113c,
} from '../src/server/engine/quests-113c.ts'

describe('Issue #1467: 1.13c socket cap ilvl thresholds (<=25 / <=40), difficulty caps (3/4/6), no low-quality sockets, and Larzuk parity', () => {
  const tables = getEmbeddedDropTables()
  const crsBase = tables.getBase('crs')! // Crystal Sword: gemsockets = 6, type = 'swor' (maxSock 3 / 4 / 6)
  const crnBase = tables.getBase('crn')! // Crown: gemsockets = 3, type = 'helm' (maxSock 2 / 2 / 3)
  const sworType = tables.itemTypes.byCode.get('swor')!
  const helmType = tables.itemTypes.byCode.get('helm')!

  it('1. getMaxSockets113c enforces D2Common.dll #11151 (0x6FD74610) ilvl <= 25 / <= 40 / >= 41 thresholds', () => {
    expect(getMaxSockets113c(crsBase as never, sworType, 1)).toBe(3)
    expect(getMaxSockets113c(crsBase as never, sworType, 25)).toBe(3)
    expect(getMaxSockets113c(crsBase as never, sworType, 26)).toBe(4)
    expect(getMaxSockets113c(crsBase as never, sworType, 40)).toBe(4)
    expect(getMaxSockets113c(crsBase as never, sworType, 41)).toBe(6)
    expect(getMaxSockets113c(crsBase as never, sworType, 85)).toBe(6)

    expect(getMaxSockets113c(crnBase as never, helmType, 25)).toBe(2)
    expect(getMaxSockets113c(crnBase as never, helmType, 40)).toBe(2)
    expect(getMaxSockets113c(crnBase as never, helmType, 41)).toBe(3)

    // Stackable bases always return 0
    expect(getMaxSockets113c({ gemsockets: 4, stackable: true }, sworType, 85)).toBe(0)
  })

  it('2. D2Game.dll 0x6FC2EC90: low quality (quality < 2) never rolls sockets on drop or vendor items', () => {
    for (let s = 1; s <= 200; s++) {
      const dropRoll = rollItemEtherealAndSockets(crsBase, 'low', 85, new D2Rng(s), {
        itemTypes: tables.itemTypes,
        difficulty: 'hell',
        forceSocket: true,
      })
      expect(dropRoll.sockets).toBe(0)

      const vendorItem = generateVendorStoreItem({
        base: crsBase,
        vendorId: VendorNpcId.CHARSI,
        qualityTier: 'low',
        cLvl: 80,
        nItemLevel: 85,
        difficulty: 2,
        permStore: false,
        tables,
        rng: new D2Rng(s),
      })
      expect(vendorItem?.totalSockets ?? 0).toBe(0)
    }
  })

  it('3. D2Game.dll 0x6FC2EC90 (0x6FC2ECD7..0x6FC2ED08): enforces difficulty socket caps (Normal <= 3, Nightmare <= 4, Hell <= 6)', () => {
    let maxNormal = 0
    let maxNightmare = 0
    let maxHell = 0

    for (let s = 1; s <= 300; s++) {
      const normalSocks = rollRandomItemSockets113c(crsBase, 'normal', 85, new D2Rng(s), {
        itemTypes: tables.itemTypes,
        difficulty: 'normal',
      })
      const nightmareSocks = rollRandomItemSockets113c(crsBase, 'normal', 85, new D2Rng(s), {
        itemTypes: tables.itemTypes,
        difficulty: 'nightmare',
      })
      const hellSocks = rollRandomItemSockets113c(crsBase, 'normal', 85, new D2Rng(s), {
        itemTypes: tables.itemTypes,
        difficulty: 'hell',
      })
      maxNormal = Math.max(maxNormal, normalSocks)
      maxNightmare = Math.max(maxNightmare, nightmareSocks)
      maxHell = Math.max(maxHell, hellSocks)
    }

    expect(maxNormal).toBe(3)
    expect(maxNightmare).toBe(4)
    expect(maxHell).toBe(6)

    // Vendor generator shares rollRandomItemSockets113c and enforces difficulty caps
    for (let s = 1; s <= 150; s++) {
      const normalVendor = generateVendorStoreItem({
        base: crsBase,
        vendorId: VendorNpcId.LARZUK,
        qualityTier: 'normal',
        cLvl: 80,
        nItemLevel: 85,
        difficulty: 0,
        permStore: false,
        tables,
        rng: new D2Rng(s),
      })
      expect(normalVendor?.totalSockets ?? 0).toBeLessThanOrEqual(3)

      const nightmareVendor = generateVendorStoreItem({
        base: crsBase,
        vendorId: VendorNpcId.LARZUK,
        qualityTier: 'normal',
        cLvl: 80,
        nItemLevel: 85,
        difficulty: 1,
        permStore: false,
        tables,
        rng: new D2Rng(s),
      })
      expect(nightmareVendor?.totalSockets ?? 0).toBeLessThanOrEqual(4)
    }
  })

  it('4. D2Game.dll 0x6FC2EC90 (0x6FC2ED8E..0x6FC2EDAE): Classic (isExpansion = false) uses fixed cap (3 for weapons/armor, 2 for helms)', () => {
    const classicSwordSockets = rollRandomItemSockets113c(crsBase, 'normal', 85, new D2Rng(42), {
      itemTypes: tables.itemTypes,
      difficulty: 'hell',
      isExpansion: false,
      forceSocket: true,
    })
    expect(classicSwordSockets).toBe(3)

    const classicHelmSockets = rollRandomItemSockets113c(crnBase, 'normal', 85, new D2Rng(42), {
      itemTypes: tables.itemTypes,
      difficulty: 'hell',
      isExpansion: false,
      forceSocket: true,
    })
    expect(classicHelmSockets).toBe(2)
  })

  it('5. D2Game.dll 0x6FCE0630..0x6FCE06D4: Larzuk add_sockets uses 1.13c ilvl thresholds without gridArea clamp and rolls magic sockets from item seed', () => {
    const runLarzukOnItem = (opts: {
      code: string
      level: number
      quality: number
      width?: number
      height?: number
      seed?: number
    }) => {
      const game = new GameInstance({ areaId: 109, act: 4, seed: 12345 })
      const playerId = game.connectPlayer({ name: 'Hero', classId: 4, level: 80, areaId: 109, x: 5100, y: 5050 })
      const larzukId = game.spawnMonster({
        hcIdx: 511,
        areaId: 109,
        x: 5101,
        y: 5050,
        isNpc: true,
        isVendor: true,
      })
      const internalPlayer = (game as unknown as { players: Map<number, {
        questFlags: Uint16Array
        items: Array<Record<string, unknown>>
      }> }).players.get(playerId)!
      setQuestFlag113c(internalPlayer.questFlags, 'a5q1', QUEST_FLAG_REWARD_PENDING_113C)

      const itemId = 9001
      internalPlayer.items.push({
        unitId: itemId,
        code: opts.code,
        name: opts.code,
        quality: opts.quality,
        level: opts.level,
        location: 'inventory',
        x: 0,
        y: 0,
        width: opts.width ?? 2,
        height: opts.height ?? 3,
        areaId: 109,
        ownerId: playerId,
        bodyLoc: 0,
        storePage: 1,
        cost: 100,
        gamble: false,
        identified: true,
        ethereal: false,
        socketed: false,
        totalSockets: 0,
        durability: 20,
        maxDurability: 20,
        quantity: 1,
        stats: new Map(),
        socketedItems: [],
        seed: opts.seed ?? 777,
      })

      const rngBefore = (game as unknown as { rng: D2Rng }).rng.getSeed()
      const ok = (game as unknown as {
        handleArtisanService: (p: unknown, npcId: number, itemId: number) => boolean
      }).handleArtisanService(internalPlayer, larzukId, itemId)
      const rngAfter = (game as unknown as { rng: D2Rng }).rng.getSeed()

      expect(ok).toBe(true)
      const updated = internalPlayer.items.find(i => i.unitId === itemId)!
      return {
        sockets: Number(updated.totalSockets),
        rngBefore,
        rngAfter,
        a5q1Word: internalPlayer.questFlags[questWordIndex113c('a5q1')!]!,
      }
    }

    // Crystal Sword (normal quality): ilvl 25 -> 3, ilvl 26 -> 4, ilvl 40 -> 4, ilvl 41 -> 6
    expect(runLarzukOnItem({ code: 'crs', level: 25, quality: 2 }).sockets).toBe(3)
    expect(runLarzukOnItem({ code: 'crs', level: 26, quality: 2 }).sockets).toBe(4)
    expect(runLarzukOnItem({ code: 'crs', level: 40, quality: 2 }).sockets).toBe(4)
    expect(runLarzukOnItem({ code: 'crs', level: 41, quality: 2 }).sockets).toBe(6)

    // Even if item entry width/height were 1x1, Larzuk uses D2Common #11151 without gridArea clamp
    expect(runLarzukOnItem({ code: 'crs', level: 41, quality: 2, width: 1, height: 1 }).sockets).toBe(6)

    // Magic quality (4): uses item seed (not game.rng) and rolls 1 + itemSeedRng.rand(min(maxSockets, 2))
    const magic1 = runLarzukOnItem({ code: 'crs', level: 85, quality: 4, seed: 101 })
    const magic2 = runLarzukOnItem({ code: 'crs', level: 85, quality: 4, seed: 102 })
    expect(magic1.rngAfter).toEqual(magic1.rngBefore)
    expect(magic1.sockets).toBe(1 + new D2Rng(101).rand(2))
    expect(magic2.sockets).toBe(1 + new D2Rng(102).rand(2))
  })
})

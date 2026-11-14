/**
 * Wave 4 P1: Horadric Cube & Item Generation 1.13c Parity (#1907-#1914, #1916):
 * - #1907: Cube high-rune upgrade catalyst gem & ladder flag enforcement (Rows 100..122).
 * - #1908: Cube normal-item socketing recipes (Rows 123..126) 1..6 uniform roll & ilvl/type clamp.
 * - #1909: Cube ethereal normal armor socketing ebug 1.5x defense & preserved base defense.
 * - #1910: SetItems.txt add func = 1 partner bitmask & Sets.txt min..max random roll (protecting NON_RANDOM_RANGE_CODES).
 * - #1911: Ethereal armor with %ED (maxac + 1 -> eth 1.5x -> %ED) & server local ac% scaling.
 * - #1912: StaffMods forbidden item-type filter (Skills.txt itypea1..3), Low Quality tier <= 4 / +1 cap, & strict > thresholds.
 * - #1913: Superior QualityItems.txt 8-row selection, nodurability rows 0..3 filter, & dmg-max = 1 fallback.
 * - #1914: Low Quality 75% weapon damage, 75% defense, & [maxDur >> 1, maxDur - 1] initial durability.
 * - #1916: Gambling exceptional/elite upgrade (* 90 + 1 / * 33 + 1, uber before ultra) & shared spawnedUniqueIds.
 */
import { describe, expect, it } from 'vitest'
import {
  CANONICAL_QUALITY_ITEMS_113C,
  createDroppedItem,
  rollStaffMods,
  scaleLowQualityWeaponBand113c,
} from '../../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { itemToUiInventoryItem, onlineItemDataToUiInventoryItem } from '../../src/common/items/item-bridge.ts'
import { formatItemTooltip } from '../../src/common/items/item-tooltip.ts'
import { ItemQuality } from '../../src/common/items/items.ts'
import {
  createSocketableItem,
  createSocketedBaseItem,
  transmuteCubeItems,
} from '../../src/common/items/runeword-socket.ts'
import { resolveActiveSetBonuses } from '../../src/common/items/set-items.ts'
import { resolveGambledItem } from '../../src/common/items/vendor-generator.ts'
import { SKILLS_BY_ID } from '../../src/common/data/skills-catalog.ts'
import { D2Rng, Rng } from '../../src/common/rng/d2-rng.ts'
import {
  ITEM_FLAG_ETHEREAL,
  ITEM_FLAG_IDENTIFIED,
  type ItemData,
} from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  executeCubeTransmute113c,
  executeSocketItem113c,
} from '../../src/server/items/cube-engine-113c.ts'
import {
  computeEquippedArmorPieceDefense113c,
  domainItemToItemData113c,
  finalizeDroppedItem113c,
} from '../../src/server/items/server-item-data.ts'

function makeWireItem(overrides: Partial<ItemData> & { readonly code: string; readonly id: number }): ItemData {
  const { id, code, ...rest } = overrides
  return {
    opcode: 0x9c,
    action: 0x04,
    category: 0,
    id,
    itemId: id,
    ownerType: 'player',
    ownerId: 1,
    equipped: false,
    inSocket: false,
    identified: true,
    broken: false,
    socketed: false,
    newItem: false,
    compact: false,
    isEar: false,
    starterItem: false,
    simple: false,
    ethereal: false,
    personalized: false,
    runeword: false,
    flags: ITEM_FLAG_IDENTIFIED,
    rawFlags: ITEM_FLAG_IDENTIFIED,
    version: 101,
    location: 0,
    container: 'cube',
    equippedSlot: 0,
    bodyLoc: 0,
    gridX: 0,
    gridY: 0,
    worldX: 0,
    worldY: 0,
    x: 0,
    y: 0,
    storagePage: 3,
    storePage: 3,
    code,
    rawCode: code,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    ilvl: 85,
    quality: 2,
    invWidth: 1,
    invHeight: 1,
    stats: [],
    setBonusStats: [],
    runewordStats: [],
    ...rest,
  }
}

describe('#1907 — Horadric Cube high-rune upgrade catalyst gems & ladder gating (CubeMain.txt Rows 100..122)', () => {
  const GEMMED_RUNE_RECIPES: readonly [number, number, string, boolean][] = [
    [10, 3, 'gcy', false],
    [11, 3, 'gcv', false],
    [12, 3, 'gcb', false],
    [13, 3, 'gcr', false],
    [14, 3, 'gcg', true],
    [15, 3, 'gcw', true],
    [16, 3, 'gfy', true],
    [17, 3, 'gfv', true],
    [18, 3, 'gfb', true],
    [19, 3, 'gfr', true],
    [20, 3, 'gfg', true],
    [21, 2, 'gfw', true],
    [22, 2, 'gsy', true],
    [23, 2, 'gsv', true],
    [24, 2, 'gsb', true],
    [25, 2, 'gsr', true],
    [26, 2, 'gsg', true],
    [27, 2, 'gsw', true],
    [28, 2, 'gly', true],
    [29, 2, 'gzv', true],
    [30, 2, 'glb', true],
    [31, 2, 'glr', true],
    [32, 2, 'glg', true],
  ]

  it('enforces exact rune count, required gem catalyst, and ladder flag across all 23 gemmed rune recipes in both client & server cube engines', () => {
    for (const [runeNum, count, gemCode, ladderOnly] of GEMMED_RUNE_RECIPES) {
      const rCode = `r${String(runeNum).padStart(2, '0')}`
      const nextCode = `r${String(runeNum + 1).padStart(2, '0')}`
      const wrongGem = gemCode === 'gcv' ? 'gcy' : 'gcv'

      // 1) Missing catalyst gem must fail
      const noGemUi = Array.from({ length: count }, (_, i) => ({
        item: itemToUiInventoryItem(createSocketableItem(rCode)),
        col: i,
        row: 0,
      }))
      expect(transmuteCubeItems(noGemUi, new Rng(1), { isLadder: true }).matched).toBe(false)

      // 2) Wrong catalyst gem must fail
      const wrongGemUi = [
        ...noGemUi,
        { item: itemToUiInventoryItem(createSocketableItem(wrongGem)), col: 0, row: 1 },
      ]
      expect(transmuteCubeItems(wrongGemUi, new Rng(1), { isLadder: true }).matched).toBe(false)

      // 3) Correct gem on Ladder succeeds
      const validUi = [
        ...noGemUi,
        { item: itemToUiInventoryItem(createSocketableItem(gemCode)), col: 0, row: 1 },
      ]
      const ladderRes = transmuteCubeItems(validUi, new Rng(1), { isLadder: true })
      expect(ladderRes.matched).toBe(true)
      expect(ladderRes.resultItems[0]?.item.code).toBe(nextCode)

      // 4) Non-ladder blocks r14..r32 (Rows 104..122) while allowing r10..r13 (Rows 100..103)
      const nonLadderRes = transmuteCubeItems(validUi, new Rng(1), { isLadder: false })
      expect(nonLadderRes.matched).toBe(!ladderOnly)

      // 5) Server executeCubeTransmute113c parity
      let nextId = 100
      const wireInputs = [
        ...Array.from({ length: count }, (_, i) => makeWireItem({ id: i + 1, code: rCode, compact: true, simple: true })),
        makeWireItem({ id: 50, code: gemCode, compact: true, simple: true }),
      ]
      const srvNoGem = executeCubeTransmute113c({
        cubeItems: wireInputs.slice(0, count),
        rng: new D2Rng(1),
        playerLevel: 80,
        playerClassCode: 'pal',
        difficulty: 2,
        areaId: 1,
        isLadder: true,
        allocateUnitId: () => ++nextId,
      })
      expect(srvNoGem.matched).toBe(false)

      const srvLadder = executeCubeTransmute113c({
        cubeItems: wireInputs,
        rng: new D2Rng(1),
        playerLevel: 80,
        playerClassCode: 'pal',
        difficulty: 2,
        areaId: 1,
        isLadder: true,
        allocateUnitId: () => ++nextId,
      })
      expect(srvLadder.matched).toBe(true)
      expect(srvLadder.createdItems[0]?.item.code.trim()).toBe(nextCode)

      const srvNonLadder = executeCubeTransmute113c({
        cubeItems: wireInputs,
        rng: new D2Rng(1),
        playerLevel: 80,
        playerClassCode: 'pal',
        difficulty: 2,
        areaId: 1,
        isLadder: false,
        allocateUnitId: () => ++nextId,
      })
      expect(srvNonLadder.matched).toBe(!ladderOnly)
    }
  })
})

describe('#1908 — Horadric Cube socketing recipes (Rows 123..126) 1..6 roll & ilvl/type clamp', () => {
  it('rolls 1..6 uniformly and clamps Monarch (4os max) to ~50% 4os and Mage Plate (3os max) to ~66.7% 3os', () => {
    let monarch4 = 0
    let magePlate3 = 0
    const trials = 600
    let nextId = 1000

    for (let s = 1; s <= trials; s++) {
      // Server Monarch (uit, ilvl 85): Tal (r07) + Amn (r11) + Perfect Ruby (gpr)
      const srvMonarch = executeCubeTransmute113c({
        cubeItems: [
          makeWireItem({ id: 1, code: 'uit', ilvl: 85, defense: 148 }),
          makeWireItem({ id: 2, code: 'r07', compact: true, simple: true }),
          makeWireItem({ id: 3, code: 'r11', compact: true, simple: true }),
          makeWireItem({ id: 4, code: 'gpr', compact: true, simple: true }),
        ],
        rng: new D2Rng(s * 977),
        playerLevel: 85,
        playerClassCode: 'sor',
        difficulty: 2,
        areaId: 1,
        isLadder: true,
        allocateUnitId: () => ++nextId,
      })
      expect(srvMonarch.matched).toBe(true)
      const mSock = srvMonarch.createdItems[0]!.item.totalSockets
      expect(mSock).toBeGreaterThanOrEqual(1)
      expect(mSock).toBeLessThanOrEqual(4)
      if (mSock === 4) monarch4++

      // Client Mage Plate (xtp, ilvl 85): Tal (r07) + Thul (r10) + Perfect Topaz (gpy)
      const mpUi = itemToUiInventoryItem(createSocketedBaseItem('xtp', 0, { ilvl: 85 }))
      const cliMp = transmuteCubeItems(
        [
          { item: mpUi, col: 0, row: 0 },
          { item: itemToUiInventoryItem(createSocketableItem('r07')), col: 2, row: 0 },
          { item: itemToUiInventoryItem(createSocketableItem('r10')), col: 2, row: 1 },
          { item: itemToUiInventoryItem(createSocketableItem('gpy')), col: 2, row: 2 },
        ],
        new Rng(s * 1301),
      )
      expect(cliMp.matched).toBe(true)
      const mpSock = cliMp.resultItems[0]!.item.sockets ?? 0
      expect(mpSock).toBeGreaterThanOrEqual(1)
      expect(mpSock).toBeLessThanOrEqual(3)
      if (mpSock === 3) magePlate3++
    }

    // 3/6 = 50% (expect ~300 +/- 55), 4/6 = 66.7% (expect ~400 +/- 55)
    expect(monarch4).toBeGreaterThan(245)
    expect(monarch4).toBeLessThan(355)
    expect(magePlate3).toBeGreaterThan(345)
    expect(magePlate3).toBeLessThan(455)
  })

  it('clamps Crystal Sword sockets by ilvl tier (<=25 -> 3, 26..40 -> 4, 41+ -> 6) and rejects Superior/Low Quality', () => {
    let nextId = 5000
    const seenIlvl20 = new Set<number>()
    const seenIlvl30 = new Set<number>()
    const seenIlvl50 = new Set<number>()

    for (let s = 1; s <= 120; s++) {
      for (const [ilvl, bucket] of [
        [20, seenIlvl20],
        [30, seenIlvl30],
        [50, seenIlvl50],
      ] as const) {
        const res = executeCubeTransmute113c({
          cubeItems: [
            makeWireItem({ id: 1, code: 'crs', ilvl }),
            makeWireItem({ id: 2, code: 'r08', compact: true, simple: true }),
            makeWireItem({ id: 3, code: 'r11', compact: true, simple: true }),
            makeWireItem({ id: 4, code: 'gpv', compact: true, simple: true }),
          ],
          rng: new D2Rng(s * 733),
          playerLevel: 80,
          playerClassCode: 'bar',
          difficulty: 2,
          areaId: 1,
          isLadder: true,
          allocateUnitId: () => ++nextId,
        })
        expect(res.matched).toBe(true)
        bucket.add(res.createdItems[0]!.item.totalSockets)
      }
    }

    expect(Math.max(...seenIlvl20)).toBe(3)
    expect(Math.max(...seenIlvl30)).toBe(4)
    expect(Math.max(...seenIlvl50)).toBe(6)

    // Reject Superior (quality = 3) and Low Quality (quality = 1)
    for (const q of [1, 3]) {
      const badSrv = executeCubeTransmute113c({
        cubeItems: [
          makeWireItem({ id: 1, code: 'crs', ilvl: 85, quality: q as 1 | 3 }),
          makeWireItem({ id: 2, code: 'r08', compact: true, simple: true }),
          makeWireItem({ id: 3, code: 'r11', compact: true, simple: true }),
          makeWireItem({ id: 4, code: 'gpv', compact: true, simple: true }),
        ],
        rng: new D2Rng(42),
        playerLevel: 80,
        playerClassCode: 'bar',
        difficulty: 2,
        areaId: 1,
        isLadder: true,
        allocateUnitId: () => ++nextId,
      })
      expect(badSrv.matched).toBe(false)

      const badUi = itemToUiInventoryItem(
        createSocketedBaseItem('crs', 0, {
          ilvl: 85,
          quality: q === 3 ? ItemQuality.SUPERIOR : ItemQuality.LOW,
        }),
      )
      const badCli = transmuteCubeItems([
        { item: badUi, col: 0, row: 0 },
        { item: itemToUiInventoryItem(createSocketableItem('r08')), col: 2, row: 0 },
        { item: itemToUiInventoryItem(createSocketableItem('r11')), col: 2, row: 1 },
        { item: itemToUiInventoryItem(createSocketableItem('gpv')), col: 2, row: 2 },
      ])
      expect(badCli.matched).toBe(false)
    }
  })
})

describe('#1909 — Horadric Cube ethereal normal armor ebug 1.5x defense & preserved rolled defense', () => {
  it('preserves rolled non-eth defense (never resets to minac) and applies 2nd floor(def * 3 / 2) ebug on ethereal normal armor', () => {
    let nextId = 8000

    // 1) Non-eth Archon Plate with rolled defense 512 (minac = 410, maxac = 524) -> stays 512
    const nonEthSrv = executeCubeTransmute113c({
      cubeItems: [
        makeWireItem({ id: 1, code: 'utp', ilvl: 85, defense: 512 }),
        makeWireItem({ id: 2, code: 'r07', compact: true, simple: true }),
        makeWireItem({ id: 3, code: 'r10', compact: true, simple: true }),
        makeWireItem({ id: 4, code: 'gpy', compact: true, simple: true }),
      ],
      rng: new D2Rng(77),
      playerLevel: 85,
      playerClassCode: 'pal',
      difficulty: 2,
      areaId: 1,
      isLadder: true,
      allocateUnitId: () => ++nextId,
    })
    expect(nonEthSrv.matched).toBe(true)
    expect(nonEthSrv.createdItems[0]!.item.defense).toBe(512)

    // 2) Ethereal Archon Plate with defense 786 (floor(524 * 3 / 2)) -> ebug 1179 (floor(786 * 3 / 2))
    const ethSrv = executeCubeTransmute113c({
      cubeItems: [
        makeWireItem({
          id: 1,
          code: 'utp',
          ilvl: 85,
          defense: 786,
          ethereal: true,
          flags: ITEM_FLAG_IDENTIFIED | ITEM_FLAG_ETHEREAL,
          rawFlags: ITEM_FLAG_IDENTIFIED | ITEM_FLAG_ETHEREAL,
        }),
        makeWireItem({ id: 2, code: 'r07', compact: true, simple: true }),
        makeWireItem({ id: 3, code: 'r10', compact: true, simple: true }),
        makeWireItem({ id: 4, code: 'gpy', compact: true, simple: true }),
      ],
      rng: new D2Rng(77),
      playerLevel: 85,
      playerClassCode: 'pal',
      difficulty: 2,
      areaId: 1,
      isLadder: true,
      allocateUnitId: () => ++nextId,
    })
    expect(ethSrv.matched).toBe(true)
    expect(ethSrv.createdItems[0]!.item.defense).toBe(1179)

    // Client transmuteCubeItems parity: 786 -> 1179
    const ethApUi = itemToUiInventoryItem(
      createSocketedBaseItem('utp', 0, { ilvl: 85, ethereal: true, rolledBaseDefense: 786 }),
    )
    expect(ethApUi.defense).toBe(786)
    const ethCli = transmuteCubeItems(
      [
        { item: ethApUi, col: 0, row: 0 },
        { item: itemToUiInventoryItem(createSocketableItem('r07')), col: 2, row: 0 },
        { item: itemToUiInventoryItem(createSocketableItem('r10')), col: 2, row: 1 },
        { item: itemToUiInventoryItem(createSocketableItem('gpy')), col: 2, row: 2 },
      ],
      new Rng(77),
    )
    expect(ethCli.matched).toBe(true)
    expect(ethCli.resultItems[0]!.item.defense).toBe(1179)

    // 3) Rare armor socketing recipe (Row 63: 3 Perfect Skulls + 1 Rare Armor + SoJ, sock=1) does NOT ebug
    const tables = getEmbeddedDropTables()
    const soj = tables.uniques.all.find((u) => u.index === 'The Stone of Jordan')!
    const rareEthSrv = executeCubeTransmute113c({
      cubeItems: [
        makeWireItem({
          id: 1,
          code: 'utp',
          ilvl: 85,
          quality: 6,
          defense: 786,
          ethereal: true,
          flags: ITEM_FLAG_IDENTIFIED | ITEM_FLAG_ETHEREAL,
          rawFlags: ITEM_FLAG_IDENTIFIED | ITEM_FLAG_ETHEREAL,
        }),
        makeWireItem({ id: 2, code: 'skz', compact: true, simple: true }),
        makeWireItem({ id: 3, code: 'skz', compact: true, simple: true }),
        makeWireItem({ id: 4, code: 'skz', compact: true, simple: true }),
        makeWireItem({ id: 5, code: 'rin', quality: 7, uniqueItemId: soj.id }),
      ],
      rng: new D2Rng(77),
      playerLevel: 85,
      playerClassCode: 'pal',
      difficulty: 2,
      areaId: 1,
      isLadder: true,
      allocateUnitId: () => ++nextId,
    })
    expect(rareEthSrv.matched).toBe(true)
    expect(rareEthSrv.createdItems[0]!.item.totalSockets).toBe(1)
    expect(rareEthSrv.createdItems[0]!.item.defense).toBe(786)
  })
})

describe('#1910 — SetItems.txt add func = 1 partner bitmask & Sets.txt min..max roll', () => {
  it("activates Civerb's Ward (add func = 1) mana ONLY with Civerb's Icon and poison resist ONLY with Civerb's Cudgel across common & server", () => {
    const tables = getEmbeddedDropTables()
    const ward = tables.sets.items.getByIndex("Civerb's Ward")! // [0] lrg shield
    const icon = tables.sets.items.getByIndex("Civerb's Icon")! // [1] amu
    const cudgel = tables.sets.items.getByIndex("Civerb's Cudgel")! // [2] gsc
    const setDef = tables.sets.sets.get("Civerb's Vestments")!

    // Common resolveActiveSetBonuses
    const withIcon = resolveActiveSetBonuses(ward, setDef, 2, {
      siblingMask: 0b011,
      setItemsTable: tables.sets.items,
      rng: new D2Rng(101),
    })
    expect(withIcon.aprops.map((p) => p.code)).toEqual(['mana'])
    expect(withIcon.aprops[0]!.min).toBeGreaterThanOrEqual(21)
    expect(withIcon.aprops[0]!.min).toBeLessThanOrEqual(22)

    const withCudgel = resolveActiveSetBonuses(ward, setDef, 2, {
      siblingMask: 0b101,
      setItemsTable: tables.sets.items,
      rng: new D2Rng(101),
    })
    expect(withCudgel.aprops.map((p) => p.code)).toEqual(['res-pois'])
    expect(withCudgel.aprops[0]!.min).toBeGreaterThanOrEqual(25)
    expect(withCudgel.aprops[0]!.min).toBeLessThanOrEqual(26)

    // Server GameInstance equipped stat evaluation
    const game = new GameInstance({ seed: 2026, areaId: 1 })
    const pid = game.connectPlayer({ charClass: 'pal', name: 'SetTester', x: 100, y: 100, areaId: 1, level: 30 })
    game.drainEvents(pid)
    const baseState = game.getPlayerState(pid)!

    const wardDomain = finalizeDroppedItem113c(
      createDroppedItem(tables.getBase(ward.item)!, 'set', { ilvl: 30, dwInitSeed: 11, setItem: ward }),
    )
    const iconDomain = finalizeDroppedItem113c(
      createDroppedItem(tables.getBase(icon.item)!, 'set', { ilvl: 30, dwInitSeed: 22, setItem: icon }),
    )
    const cudgelDomain = finalizeDroppedItem113c(
      createDroppedItem(tables.getBase(cudgel.item)!, 'set', { ilvl: 30, dwInitSeed: 33, setItem: cudgel }),
    )

    const pInternal = (game as unknown as { players: Map<number, any> }).players.get(pid)!
    const toEquippedEntry = (domItem: ReturnType<typeof finalizeDroppedItem113c>, unitId: number, bodyLoc: number) => {
      const wire = domainItemToItemData113c(domItem, tables, {
        unitId,
        compactSave: false,
      })
      const statsMap = new Map<number, number>()
      for (const st of wire.stats ?? []) {
        statsMap.set(st.statId, (statsMap.get(st.statId) ?? 0) + st.value)
      }
      return {
        unitId,
        code: (domItem.code ?? domItem.base.id).trim(),
        location: 'equipped',
        bodyLoc,
        x: 0,
        y: 0,
        areaId: 1,
        ownerId: pid,
        quality: 5,
        identified: true,
        ethereal: false,
        stats: statsMap,
        socketedItems: [],
        rawItemData: wire,
      }
    }

    const sumStat = (id: number) =>
      (game as unknown as { sumPlayerItemStat(p: any, s: number): number }).sumPlayerItemStat(pInternal, id)
    const sumPool256 = (id: number) =>
      (game as unknown as { sumPlayerItemPoolStat256(p: any, s: number): number }).sumPlayerItemPoolStat256(
        pInternal,
        id,
      )

    // Equip Ward (bodyLoc 5) + Icon (bodyLoc 2) -> Ward mana (21..22 * 256) active, poison resist NOT active
    pInternal.items = [
      toEquippedEntry(wardDomain, 501, 5),
      toEquippedEntry(iconDomain, 502, 2),
    ]
    expect(sumPool256(9)).toBeGreaterThanOrEqual(21 * 256)
    expect(sumPool256(9)).toBeLessThanOrEqual(22 * 256)
    expect(sumStat(45)).toBe(0)

    // Equip Ward (bodyLoc 5) + Cudgel (bodyLoc 4) -> poison resist (25..26) active, Ward mana NOT active
    pInternal.items = [
      toEquippedEntry(wardDomain, 501, 5),
      toEquippedEntry(cudgelDomain, 503, 4),
    ]
    expect(sumPool256(9)).toBe(0)
    const poisResCudgel = sumStat(45)
    expect(poisResCudgel).toBeGreaterThanOrEqual(25)
    expect(poisResCudgel).toBeLessThanOrEqual(26)
    void baseState
  })

  it("preserves Cow King's Leathers FCode5 gethit-skill (25% chance, slvl 5) without midpoint corruption and rolls variable min..max set bonuses", () => {
    const tables = getEmbeddedDropTables()
    const cowHat = tables.sets.items.getByIndex("Cow King's Horns")!
    const cowSet = tables.sets.sets.get("Cow King's Leathers")!
    const fullBonuses = resolveActiveSetBonuses(cowHat, cowSet, 3, {
      rng: new D2Rng(42),
    })
    const gethit = fullBonuses.fCodes.find((p) => p.code === 'gethit-skill')!
    expect(gethit).toBeDefined()
    expect(gethit.min).toBe(25)
    expect(gethit.max).toBe(5)

    // Variable min..max pCode/fCode rolls across [min, max] with RNG rather than fixed midpoint
    const cowGold = fullBonuses.fCodes.find((p) => p.code === 'gold%')
    if (cowGold) {
      expect(cowGold.min).toBe(cowGold.max)
    }
    const syntheticSet = {
      ...cowSet,
      pCodes: [{ code: 'str', min: 10, max: 20, threshold: 2, slot: 'a' as const }],
    }
    const rolledVals = new Set<number>()
    for (let s = 1; s <= 40; s++) {
      const b = resolveActiveSetBonuses(cowHat, syntheticSet, 2, { rng: new D2Rng(s * 97) })
      const strBonus = b.pCodes[0]!
      expect(strBonus.min).toBe(strBonus.max)
      expect(strBonus.min).toBeGreaterThanOrEqual(10)
      expect(strBonus.min).toBeLessThanOrEqual(20)
      rolledVals.add(strBonus.min)
    }
    expect(rolledVals.size).toBeGreaterThan(5)
  })
})

describe('#1911 — Ethereal armor with %ED (maxac + 1 -> eth 1.5x -> %ED) & server local ac% scaling', () => {
  it('computes 759 defense (wireBase = 253) on Ethereal 200% ED Herald of Zakarum and 378 (wireBase = 189) on Ethereal 100% ED Vampire Gaze across server & client', () => {
    const tables = getEmbeddedDropTables()
    const hozDef = tables.uniques.all.find((u) => u.index === 'Herald of Zakarum')!
    const pa9Base = tables.getBase(hozDef.code)! // Gilded Shield (pa9): maxac = 168 -> (168 + 1) * 3 / 2 = 253 -> * 3 = 759
    const hozItem = finalizeDroppedItem113c(
      createDroppedItem(pa9Base, 'unique', {
        ilvl: 85,
        dwInitSeed: 123,
        ethereal: true,
        uniqueItem: hozDef,
        rolledProps: [{ code: 'ac%', min: 150, max: 200, value: 200 }],
      }),
    )
    expect(hozItem.defense).toBe(759)
    expect((hozItem as unknown as { wireBaseDefense?: number }).wireBaseDefense).toBe(253)

    const hozWire = domainItemToItemData113c(hozItem, tables, { unitId: 901, compactSave: false })
    expect(hozWire.defense).toBe(253)
    expect(onlineItemDataToUiInventoryItem(hozWire).defense).toBe(253)

    const hozUi = onlineItemDataToUiInventoryItem({ ...hozWire, identified: true })
    expect(hozUi.defense).toBe(759)
    expect(formatItemTooltip(hozItem).defense).toBe(759)

    const hozPieceDef = computeEquippedArmorPieceDefense113c(
      { code: hozDef.code, rawItemData: { ...hozWire, identified: true } },
      undefined,
    )
    expect(hozPieceDef).toBe(759)

    // Ethereal 100% ED Grim Helm (xh9: maxac = 125 -> (125 + 1) * 3 / 2 = 189 -> * 2 = 378)
    const xh9Base = tables.getBase('xh9')!
    const gazeDef = tables.uniques.all.find((u) => u.index === 'Vampiregaze')!
    const gazeItem = finalizeDroppedItem113c(
      createDroppedItem(xh9Base, 'unique', {
        ilvl: 85,
        dwInitSeed: 456,
        ethereal: true,
        uniqueItem: gazeDef,
        rolledProps: [{ code: 'ac%', min: 100, max: 100, value: 100 }],
      }),
    )
    expect(gazeItem.defense).toBe(378)
    expect((gazeItem as unknown as { wireBaseDefense?: number }).wireBaseDefense).toBe(189)
    const gazeWire = domainItemToItemData113c(gazeItem, tables, { unitId: 902, compactSave: false })
    expect(gazeWire.defense).toBe(189)
    expect(onlineItemDataToUiInventoryItem(gazeWire).defense).toBe(189)
    expect(onlineItemDataToUiInventoryItem({ ...gazeWire, identified: true }).defense).toBe(378)
    expect(
      computeEquippedArmorPieceDefense113c({ code: 'xh9', rawItemData: { ...gazeWire, identified: true } }, undefined),
    ).toBe(378)
  })

  it('scales server player armor defense by Fortitude runeword (+200% ED + 15 flat) and socketed Pul rune (+30% ED)', () => {
    // 1) Socket Pul (r21 -> +30% ED in armor) into 500-defense 1os Archon Plate
    let host = makeWireItem({
      id: 700,
      code: 'utp',
      defense: 500,
      socketed: true,
      totalSockets: 1,
      usedSockets: 0,
    })
    const pul = makeWireItem({ id: 701, code: 'r21', compact: true, simple: true })
    const pulSock = executeSocketItem113c({
      host,
      filler: pul,
      rng: new D2Rng(1),
      playerLevel: 85,
      isHostEquipped: false,
      isLadder: true,
    })
    expect(pulSock.ok).toBe(true)
    if (pulSock.ok) {
      expect(computeEquippedArmorPieceDefense113c({ code: 'utp', rawItemData: pulSock.hostItem }, undefined)).toBe(650)
    }

    // 2) Build Fortitude (El r01 + Sol r12 + Dol r14 + Lo r28 -> +200% ED in runewordStats + 15 flat Defense) in 500-def 4os Archon Plate
    let fortHost = makeWireItem({
      id: 800,
      code: 'utp',
      defense: 500,
      socketed: true,
      totalSockets: 4,
      usedSockets: 0,
    })
    let step = 0
    for (const rCode of ['r01', 'r12', 'r14', 'r28']) {
      step++
      const res = executeSocketItem113c({
        host: fortHost,
        filler: makeWireItem({ id: 800 + step, code: rCode, compact: true, simple: true }),
        rng: new D2Rng(step),
        playerLevel: 85,
        isHostEquipped: false,
        isLadder: true,
      })
      expect(res.ok).toBe(true)
      if (res.ok) fortHost = res.hostItem
    }
    expect(fortHost.runeword).toBe(true)

    const game = new GameInstance({ seed: 99, areaId: 1 })
    const pid = game.connectPlayer({ charClass: 'pal', name: 'FortHero', x: 100, y: 100, areaId: 1, level: 85 })
    game.drainEvents(pid)
    const pInternal = (game as unknown as { players: Map<number, any> }).players.get(pid)!
    const computeDef = () =>
      (game as unknown as { computePlayerDefense(p: any): number }).computePlayerDefense(pInternal)
    const nakedDef = computeDef()

    const fortEntry = (
      game as unknown as {
        itemDataToServerEntry(d: ItemData, ownerId: number, areaId: number): any
      }
    ).itemDataToServerEntry({ ...fortHost, equipped: true, location: 1, bodyLoc: 3 }, pid, 1)
    fortEntry.location = 'equipped'
    fortEntry.bodyLoc = 3
    pInternal.items = [fortEntry]
    const fortDef = computeDef()
    // 500 * (100 + 200) / 100 + 15 flat Defense (El Rune) = 1515
    expect(fortDef - nakedDef).toBe(1515)
  })
})

describe('#1912 — StaffMods forbidden item-type filter, Low Quality cap, & strict > thresholds', () => {
  it('never rolls Smite (#97) or Holy Shield (#117) on Paladin Scepters or Poison Dagger (#73) on Shrunken Heads/Wands', () => {
    const tables = getEmbeddedDropTables()
    const wsp = tables.getBase('wsp')! // War Scepter
    const uh9 = tables.getBase('uh9') ?? tables.getBase('ne1')! // Shrunken Head
    const wnd = tables.getBase('wnd')! // Wand

    let totalScepterMods = 0
    let totalNecroMods = 0
    for (let s = 1; s <= 1500; s++) {
      const scepterMods = rollStaffMods(wsp, 1 + (s % 85), tables.itemTypes, new D2Rng(s * 997), {
        isA: tables.isA,
      })
      for (const m of scepterMods) {
        totalScepterMods++
        expect(m.param).not.toBe(97)
        expect(m.param).not.toBe(117)
      }

      const headMods = rollStaffMods(uh9, 1 + (s % 85), tables.itemTypes, new D2Rng(s * 1009), {
        isA: tables.isA,
      })
      const wandMods = rollStaffMods(wnd, 1 + (s % 85), tables.itemTypes, new D2Rng(s * 1013), {
        isA: tables.isA,
      })
      for (const m of [...headMods, ...wandMods]) {
        totalNecroMods++
        expect(m.param).not.toBe(73)
      }
    }
    expect(totalScepterMods).toBeGreaterThan(500)
    expect(totalNecroMods).toBeGreaterThan(1000)
  })

  it('caps Low Quality StaffMods to tier <= 4 (reqlevel <= 18) and +1 bonus, and uses strict > count thresholds (30/70/90)', () => {
    const tables = getEmbeddedDropTables()
    const wsp = tables.getBase('wsp')!

    let lowModsSeen = 0
    for (let s = 1; s <= 400; s++) {
      const mods = rollStaffMods(wsp, 99, tables.itemTypes, new D2Rng(s * 503), {
        isA: tables.isA,
        quality: 'low',
      })
      for (const m of mods) {
        lowModsSeen++
        expect(m.value).toBe(1)
        const sk = SKILLS_BY_ID[Number(m.param)]!
        expect(sk.reqlevel).toBeLessThanOrEqual(18)
      }
    }
    expect(lowModsSeen).toBeGreaterThan(100)

    // Verify strict > thresholds: rCount = 30 -> 0 mods, 31 -> 1 mod, 70 -> 1 mod, 71 -> 2 mods, 90 -> 2 mods, 91 -> 3 mods
    const sst = tables.getBase('sst')! // Sorceress Short Staff (5 valid tier-1 skills: 36..40)
    const checkCountForRoll = (rCount: number): number => {
      // Per slot: tierShiftRoll (rand(100)), skillIdx (rand(5)), bonusRoll (rand(100))
      const seq = [rCount, 50, 0, 0, 50, 1, 0, 50, 2, 0]
      let idx = 0
      const mockRng = { rand: () => seq[idx++] ?? 0 } as unknown as D2Rng
      return rollStaffMods(sst, 1, tables.itemTypes, mockRng, { isA: tables.isA }).length
    }
    expect(checkCountForRoll(30)).toBe(0)
    expect(checkCountForRoll(31)).toBe(1)
    expect(checkCountForRoll(70)).toBe(1)
    expect(checkCountForRoll(71)).toBe(2)
    expect(checkCountForRoll(90)).toBe(2)
    expect(checkCountForRoll(91)).toBe(3)
  })
})

describe('#1913 — Superior QualityItems.txt 8-row selection, nodurability filter, & dmg-max = 1 fallback', () => {
  it('never rolls dur% on nodurability Phase Blade (7cr), samples non-ED rows on durable items, and converts 0-truncating weapon dmg% into dmg-max = 1', () => {
    expect(CANONICAL_QUALITY_ITEMS_113C).toHaveLength(8)
    const tables = getEmbeddedDropTables()
    const pb = tables.getBase('7cr')! // Phase Blade: nodurability = 1
    const monarch = tables.getBase('uit')!
    const wand = tables.getBase('wnd')! // mindam 2, maxdam 4 -> 5..15% ED truncates 4 * 15 / 100 = 0

    for (let s = 1; s <= 400; s++) {
      const supPb = createDroppedItem(pb, 'superior', {
        ilvl: 85,
        dwInitSeed: s * 617,
        itemTypes: tables.itemTypes,
      })
      expect(supPb.rolledProps?.some((p) => p.code === 'dur%')).toBe(false)
      expect((supPb.rolledProps ?? []).length).toBeGreaterThan(0)
    }

    let sawArmorDurOnly = false
    let sawArmorEdOnly = false
    let sawArmorBoth = false
    for (let s = 1; s <= 300; s++) {
      const supMon = createDroppedItem(monarch, 'superior', {
        ilvl: 85,
        dwInitSeed: s * 719,
        itemTypes: tables.itemTypes,
      })
      const hasEd = supMon.rolledProps?.some((p) => p.code === 'ac%') ?? false
      const hasDur = supMon.rolledProps?.some((p) => p.code === 'dur%') ?? false
      if (hasDur && !hasEd) sawArmorDurOnly = true
      if (hasEd && !hasDur) sawArmorEdOnly = true
      if (hasEd && hasDur) sawArmorBoth = true
    }
    expect(sawArmorDurOnly).toBe(true)
    expect(sawArmorEdOnly).toBe(true)
    expect(sawArmorBoth).toBe(true)

    let sawDmgMaxFallback = false
    for (let s = 1; s <= 200; s++) {
      const supWand = createDroppedItem(wand, 'superior', {
        ilvl: 20,
        dwInitSeed: s * 811,
        itemTypes: tables.itemTypes,
      })
      if (supWand.rolledProps?.some((p) => p.code === 'dmg-max' && p.value === 1)) {
        sawDmgMaxFallback = true
        expect(supWand.rolledProps.some((p) => p.code === 'dmg%')).toBe(false)
      }
    }
    expect(sawDmgMaxFallback).toBe(true)
  })
})

describe('#1914 — Low Quality 75% weapon damage, 75% defense, & [maxDur >> 1, maxDur - 1] initial durability', () => {
  it('scales 1H/2H/throw weapon damage to 75% without tooltip double-penalty and rolls durability in [maxDur >> 1, maxDur - 1]', () => {
    expect(scaleLowQualityWeaponBand113c(12, 32)).toEqual({ min: 9, max: 24 })
    expect(scaleLowQualityWeaponBand113c(21, 49)).toEqual({ min: 15, max: 36 })
    expect(scaleLowQualityWeaponBand113c(1, 2)).toEqual({ min: 1, max: 2 })

    const tables = getEmbeddedDropTables()
    const btx = tables.getBase('btx')! // 2H 12..32, dur 40
    const jav = tables.getBase('jav')! // 1H 1..5, throw 6..14
    const seenInitialDurs = new Set<number>()

    for (let s = 1; s <= 150; s++) {
      const lowAxe = createDroppedItem(btx, 'low', {
        ilvl: 25,
        dwInitSeed: s * 401,
      })
      expect((lowAxe.base as any).twoHandedMindam).toBe(9)
      expect((lowAxe.base as any).twoHandedMaxdam).toBe(24)

      // maxDur = trunc(40 * 33 / 100) = 13 -> initial durability in [6, 12]
      expect(lowAxe.maxDurability).toBe(13)
      expect(lowAxe.durability).toBeGreaterThanOrEqual(6)
      expect(lowAxe.durability).toBeLessThanOrEqual(12)
      seenInitialDurs.add(lowAxe.durability!)

      const tip = formatItemTooltip(lowAxe)
      expect(tip.twoHandDamage?.min).toBe(9)
      expect(tip.twoHandDamage?.max).toBe(24)
    }
    expect(seenInitialDurs.size).toBeGreaterThanOrEqual(3)

    const lowJav = createDroppedItem(jav, 'low', { ilvl: 10, dwInitSeed: 777 })
    expect((lowJav.base as any).mindam).toBe(1)
    expect((lowJav.base as any).maxdam).toBe(3)
    expect((lowJav.base as any).minMisDam).toBe(4)
    expect((lowJav.base as any).maxMisDam).toBe(10)
    const javTip = formatItemTooltip(lowJav)
    expect(javTip.throwDamage?.min).toBe(4)
    expect(javTip.throwDamage?.max).toBe(10)

    // Verify server GameInstance resolvePlayerWeaponDamage applies 75% base damage on quality = 1 weapon
    const game = new GameInstance({ seed: 42, areaId: 1 })
    const pid = game.connectPlayer({ charClass: 'bar', name: 'LowWeap', x: 100, y: 100, areaId: 1, level: 30 })
    game.drainEvents(pid)
    const pInternal = (game as unknown as { players: Map<number, any> }).players.get(pid)!
    pInternal.strength = 0
    pInternal.dexterity = 0

    const resolveDmg = (quality: number) => {
      pInternal.items = [
        {
          unitId: 600,
          code: 'btx',
          location: 'equipped',
          bodyLoc: 4,
          x: 0,
          y: 0,
          areaId: 1,
          ownerId: pid,
          quality,
          identified: true,
          ethereal: false,
          stats: new Map<number, number>(),
          socketedItems: [],
          rawItemData: makeWireItem({ id: 600, code: 'btx', quality: quality as 1 | 2 }),
        },
      ]
      return (
        game as unknown as {
          resolvePlayerWeaponDamage(p: any): { min: number; max: number }
        }
      ).resolvePlayerWeaponDamage(pInternal)
    }

    const normalDmg = resolveDmg(2)
    const lowDmg = resolveDmg(1)
    expect(normalDmg).toEqual({ min: 12, max: 32 })
    expect(lowDmg).toEqual({ min: 9, max: 24 })
  })
})

describe('#1916 — Gambling upgrade formula (* 90 + 1 / * 33 + 1, uber before ultra) & shared spawnedUniqueIds', () => {
  it('rolls uber at exact 1/10000 when ilvl === uberQlvl, checks uber before ultra, and skips upgrade rolls when ilvl < uberQlvl', () => {
    const tables = getEmbeddedDropTables()
    const hax = tables.getBase('hax')! // Hand Axe -> uber '9ha' (Hatchet, qlvl 31) -> ultra '7ha' (Tomahawk, qlvl 54)
    const hatchet = tables.getBase(hax.ubercode!)!
    const tomahawk = tables.getBase(hax.ultracode!)!

    const makeMystery = (ilvl: number) =>
      ({
        base: hax,
        ilvl,
        level: ilvl,
        code: 'hax',
        name: hax.name,
        stats: {},
        invWidth: hax.invWidth,
        invHeight: hax.invHeight,
        stack: 1,
        value: 1000,
        rawFlags: 0,
        flags: {},
        version: 0x65,
        quality: 4,
        rarity: 'magic',
        uniqueId: 1,
        isGambleMystery: true,
        identified: false,
      }) as any

    // 1) At ilvl === hatchet.level: chanceUber = 1. Roll 0 upgrades to '9ha'; Roll 1 stays 'hax'!
    let idx0 = 0
    const seq0 = [0, 50000, 123]
    const upgHit = resolveGambledItem({
      mysteryItem: makeMystery(hatchet.level),
      cLvl: hatchet.level,
      tables,
      rng: { rand: () => seq0[idx0++] ?? 0 } as unknown as D2Rng,
    })
    expect((upgHit.code ?? upgHit.base.id).trim()).toBe(hatchet.id)

    let idx1 = 0
    const seq1 = [1, 50000, 123]
    const upgMiss = resolveGambledItem({
      mysteryItem: makeMystery(hatchet.level),
      cLvl: hatchet.level,
      tables,
      rng: { rand: () => seq1[idx1++] ?? 0 } as unknown as D2Rng,
    })
    expect((upgMiss.code ?? upgMiss.base.id).trim()).toBe('hax')

    // 2) At ilvl === tomahawk.level: if uber misses (9999) and ultra hits (0), upgrades to '7ha'
    let idxUltra = 0
    const seqUltra = [9999, 0, 50000, 123]
    const ultraHit = resolveGambledItem({
      mysteryItem: makeMystery(tomahawk.level),
      cLvl: tomahawk.level,
      tables,
      rng: { rand: () => seqUltra[idxUltra++] ?? 0 } as unknown as D2Rng,
    })
    expect((ultraHit.code ?? ultraHit.base.id).trim()).toBe(tomahawk.id)

    // 3) At ilvl === tomahawk.level: if uber hits (0), selects '9ha' immediately WITHOUT consuming a 2nd rand(10000)
    const callsUberFirst: number[] = []
    const seqUberFirst = [0, 50000, 123]
    let idxUberFirst = 0
    const uberFirstItem = resolveGambledItem({
      mysteryItem: makeMystery(tomahawk.level),
      cLvl: tomahawk.level,
      tables,
      rng: {
        rand: (n: number) => {
          callsUberFirst.push(n)
          return seqUberFirst[idxUberFirst++] ?? 0
        },
      } as unknown as D2Rng,
    })
    expect((uberFirstItem.code ?? uberFirstItem.base.id).trim()).toBe(hatchet.id)
    expect(callsUberFirst[0]).toBe(10000)
    expect(callsUberFirst[1]).toBe(100000)

    // 4) Shared spawnedUniqueIds prevents gambling the same Unique twice in one game (downgrades 2nd to triple-durability Rare)
    const spawnedUniqueIds = new Set<number>()
    let idxUniq1 = 0
    // ilvl < hatchet.level -> no upgrade roll; qualityRoll < 50 -> unique!
    const seqUniq = [10, 0, 12345]
    const firstGamble = resolveGambledItem({
      mysteryItem: makeMystery(20),
      cLvl: 20,
      tables,
      rng: { rand: () => seqUniq[idxUniq1++] ?? 0 } as unknown as D2Rng,
      spawnedUniqueIds,
    })
    expect(firstGamble.rarity).toBe('unique')
    expect(spawnedUniqueIds.size).toBe(1)

    let idxUniq2 = 0
    const secondGamble = resolveGambledItem({
      mysteryItem: makeMystery(20),
      cLvl: 20,
      tables,
      rng: { rand: () => seqUniq[idxUniq2++] ?? 0 } as unknown as D2Rng,
      spawnedUniqueIds,
    })
    expect(secondGamble.rarity).toBe('rare')
  })
})

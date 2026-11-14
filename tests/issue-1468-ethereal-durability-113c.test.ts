import { describe, expect, it } from 'vitest'
import {
  computeEtherealMaxDurability113c,
  createDroppedItem,
  executeDropPipeline,
  imbueItem113c,
  rollItemEthereal113c,
  rollItemEtherealAndSockets,
} from '../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { formatItemTooltip } from '../src/common/items/item-tooltip.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { domainItemToItemData113c, finalizeDroppedItem113c } from '../src/server/items/server-item-data.ts'

describe('Issue #1468: 1.13c Ethereal durability halving (maxdur/2+1), low/set/quest exclusion, and 0x6FC2EBB0 roll parity', () => {
  const tables = getEmbeddedDropTables()
  const pltBase = tables.getBase('plt')! // Plate Mail: durability = 60
  const uitBase = tables.getBase('uit')! // Monarch: durability = 86
  const chnBase = tables.getBase('chn')! // Chain Mail: durability = 45
  const ssdBase = tables.getBase('ssd')! // Short Sword: durability = 24
  const haxBase = tables.getBase('hax')! // Hand Axe: durability = 28

  it('1. D2Game.dll 0x6FC2EC56..0x6FC2EC7F: halves Ethereal maxDurability to trunc(maxdur / 2) + 1 (Plate Mail 60 -> 31)', () => {
    expect((pltBase as unknown as { durability: number }).durability).toBe(60)
    expect(computeEtherealMaxDurability113c(60)).toBe(31)
    expect(computeEtherealMaxDurability113c(86)).toBe(44)
    expect(computeEtherealMaxDurability113c(45)).toBe(23)
    expect(computeEtherealMaxDurability113c(24)).toBe(13)
    expect(computeEtherealMaxDurability113c(28)).toBe(15)

    // Direct createDroppedItem on Plate Mail (durability 60)
    const ethPlate = createDroppedItem(pltBase, 'normal', {
      ethereal: true,
      ilvl: 30,
      dwInitSeed: 12345,
      itemTypes: tables.itemTypes,
    })
    expect(ethPlate.ethereal).toBe(true)
    expect(ethPlate.maxDurability).toBe(31)
    expect(ethPlate.durability).toBe(31)

    const nonEthPlate = createDroppedItem(pltBase, 'normal', {
      ethereal: false,
      ilvl: 30,
      dwInitSeed: 12345,
      itemTypes: tables.itemTypes,
    })
    expect(nonEthPlate.ethereal).toBeUndefined()
    expect(nonEthPlate.maxDurability).toBe(60)
    expect(nonEthPlate.durability).toBe(60)

    // End-to-end executeDropPipeline on Plate Mail ('plt') with forceEthereal
    const droppedEthPlates = executeDropPipeline(tables, {
      tcName: 'plt',
      nLevel: 30,
      difficulty: 'normal',
      forcedQuality: 'normal',
      forceEthereal: true,
      monsterRng: 777,
    })
    expect(droppedEthPlates).toHaveLength(1)
    expect(droppedEthPlates[0]!.ethereal).toBe(true)
    expect(droppedEthPlates[0]!.maxDurability).toBe(31)
    expect(droppedEthPlates[0]!.durability).toBe(31)

    // Wire conversion (domainItemToItemData113c) + tooltip preserves maxDurability = 31
    const finalized = finalizeDroppedItem113c(droppedEthPlates[0]!)
    const wire = domainItemToItemData113c(finalized, tables, { unitId: 1, compactSave: false })
    expect(wire.ethereal).toBe(true)
    expect(wire.maxDurability).toBe(31)
    expect(wire.durability).toBe(31)

    const tip = formatItemTooltip(finalized)
    expect(tip.durability?.max).toBe(31)
    expect(tip.durability?.current).toBe(31)
  })

  it('2. D2Game.dll 0x6FC2EC5B & 0x6FC30D9C: Failed Unique -> Rare (3x) and Failed Set -> Magic (2x) apply after Ethereal durability halving', () => {
    // Plate Mail ('plt', base durability = 60):
    // Ethereal base durability = trunc(60 / 2) + 1 = 31
    // Failed Unique (3x) -> min(255, 31 * 3) = 93
    // Failed Set (2x) -> min(255, 31 * 2) = 62
    const failedUniqueEthPlate = createDroppedItem(pltBase, 'rare', {
      ethereal: true,
      durabilityMultiplier: 3,
      ilvl: 10,
      dwInitSeed: 42,
      itemTypes: tables.itemTypes,
    })
    expect(failedUniqueEthPlate.rarity).toBe('rare')
    expect(failedUniqueEthPlate.ethereal).toBe(true)
    expect(failedUniqueEthPlate.maxDurability).toBe(93)
    expect(failedUniqueEthPlate.durability).toBe(93)

    const failedSetEthPlate = createDroppedItem(pltBase, 'magic', {
      ethereal: true,
      durabilityMultiplier: 2,
      ilvl: 10,
      dwInitSeed: 42,
      itemTypes: tables.itemTypes,
    })
    expect(failedSetEthPlate.rarity).toBe('magic')
    expect(failedSetEthPlate.ethereal).toBe(true)
    expect(failedSetEthPlate.maxDurability).toBe(62)
    expect(failedSetEthPlate.durability).toBe(62)

    // Execute full drop pipeline for Plate Mail ('plt') with forcedQuality: 'unique' at nLevel = 1
    // (Boneflesh is qlvl 35, so Unique fails -> degrades to Rare with 3x durability).
    const pipelineFailedUniqueEth = executeDropPipeline(tables, {
      tcName: 'plt',
      nLevel: 1,
      difficulty: 'normal',
      forcedQuality: 'unique',
      forceEthereal: true,
      monsterRng: 2024,
    })
    expect(pipelineFailedUniqueEth).toHaveLength(1)
    expect(pipelineFailedUniqueEth[0]!.rarity).toBe('rare')
    expect(pipelineFailedUniqueEth[0]!.ethereal).toBe(true)
    expect(pipelineFailedUniqueEth[0]!.maxDurability).toBe(93)
    expect(pipelineFailedUniqueEth[0]!.durability).toBe(93)

    // Verify 255 cap when (trunc(rawDur / 2) + 1) * 3 > 255
    const highDurBase = { ...pltBase, durability: 180 } as typeof pltBase
    const cappedEthRare = createDroppedItem(highDurBase, 'rare', {
      ethereal: true,
      durabilityMultiplier: 3,
      ilvl: 50,
      dwInitSeed: 99,
      itemTypes: tables.itemTypes,
    })
    // trunc(180 / 2) + 1 = 91; 91 * 3 = 273 -> capped at 255
    expect(cappedEthRare.maxDurability).toBe(255)
    expect(cappedEthRare.durability).toBe(255)
  })

  it('3. D2Game.dll 0x6FC2EBE8..0x6FC2EBF7: Low Quality (1) and Set (5) items never spawn Ethereal under any seed', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const lowRng = new D2Rng(seed)
      const lowSeedBefore = lowRng.getSeed()
      expect(
        rollItemEthereal113c(pltBase, 'low', lowRng, {
          itemTypes: tables.itemTypes,
          isA: tables.isA,
          forceEthereal: true,
        }),
      ).toBe(false)
      // Must return before consuming itemRng
      expect(lowRng.getSeed()).toEqual(lowSeedBefore)

      const setRng = new D2Rng(seed)
      const setSeedBefore = setRng.getSeed()
      expect(
        rollItemEthereal113c(pltBase, 'set', setRng, {
          itemTypes: tables.itemTypes,
          isA: tables.isA,
          forceEthereal: true,
        }),
      ).toBe(false)
      expect(setRng.getSeed()).toEqual(setSeedBefore)

      const lowAndSock = rollItemEtherealAndSockets(pltBase, 'low', 85, new D2Rng(seed), {
        itemTypes: tables.itemTypes,
        isA: tables.isA,
        forceEthereal: true,
      })
      expect(lowAndSock.ethereal).toBe(false)
      expect(lowAndSock.sockets).toBe(0)

      const setAndSock = rollItemEtherealAndSockets(pltBase, 'set', 85, new D2Rng(seed), {
        itemTypes: tables.itemTypes,
        isA: tables.isA,
        forceEthereal: true,
      })
      expect(setAndSock.ethereal).toBe(false)
      expect(setAndSock.sockets).toBe(0)
    }

    // Even if createDroppedItem is called with ethereal: true on 'low' or 'set', ethereal is forced false
    const lowDropped = createDroppedItem(pltBase, 'low', {
      ethereal: true,
      ilvl: 20,
      dwInitSeed: 1,
    })
    expect(lowDropped.ethereal).toBeUndefined()
    expect(lowDropped.flags?.ethereal).toBe(false)
    expect(lowDropped.maxDurability).toBe(Math.floor(60 / 3))

    const sigonShelter = tables.sets.items.entries.find(s => s.item === 'plt')!
    const setDropped = createDroppedItem(pltBase, 'set', {
      setItem: sigonShelter,
      ethereal: true,
      ilvl: 40,
      dwInitSeed: 1,
    })
    expect(setDropped.ethereal).toBeUndefined()
    expect(setDropped.flags?.ethereal).toBe(false)
    expect(setDropped.maxDurability).toBe(60)
  })

  it('4. D2Game.dll 0x6FC2EBFE (D2Common #10176) & 0x6FC2EBB0: Quest items, Classic items, Indestructible uniques, and forbidEthereal never roll Ethereal', () => {
    // Quest weapons with ItemsTxt.nQuest != 0 (D2Common #10176 @ 0x6FD72BC0)
    for (const questCode of ['leg', 'hfh', 'qf1', 'qf2', 'msf', 'hst']) {
      const questBase = tables.getBase(questCode)!
      expect(Number(questBase.quest)).toBeGreaterThan(0)
      for (let seed = 1; seed <= 100; seed++) {
        expect(
          rollItemEthereal113c(questBase, 'normal', new D2Rng(seed), {
            itemTypes: tables.itemTypes,
            isA: tables.isA,
            forceEthereal: true,
          }),
        ).toBe(false)
      }
    }

    // Classic mode (isExpansion: false) never rolls random Ethereal (0x6FC30C7C: cmp ax, 0x64; jb)
    for (let seed = 1; seed <= 200; seed++) {
      expect(
        rollItemEthereal113c(pltBase, 'normal', new D2Rng(seed), {
          itemTypes: tables.itemTypes,
          isA: tables.isA,
          isExpansion: false,
          forceEthereal: true,
        }),
      ).toBe(false)
    }

    // forbidEthereal (wInitFlags & 0x2 at 0x6FC2EBB0) blocks Ethereal even when forceEthereal is set
    for (let seed = 1; seed <= 200; seed++) {
      expect(
        rollItemEthereal113c(pltBase, 'rare', new D2Rng(seed), {
          itemTypes: tables.itemTypes,
          isA: tables.isA,
          forbidEthereal: true,
          forceEthereal: true,
        }),
      ).toBe(false)
    }

    // Indestructible uniques without fixed 'ethereal' (e.g. Stormshield 'uit') never spawn Ethereal,
    // while fixed 'ethereal' + 'indestruct' uniques (e.g. Ethereal Edge '7ba', Shadowkiller '7cs') always spawn Ethereal.
    const stormshield = tables.uniques.byIndex.get('Stormshield')!
    const shadowkiller = tables.uniques.byIndex.get('Shadowkiller')!
    const sevenCsBase = tables.getBase('7cs')!
    for (let seed = 1; seed <= 200; seed++) {
      expect(
        rollItemEthereal113c(uitBase, 'unique', new D2Rng(seed), {
          uniqueItem: stormshield,
          itemTypes: tables.itemTypes,
          isA: tables.isA,
          forceEthereal: true,
        }),
      ).toBe(false)
      expect(
        rollItemEthereal113c(sevenCsBase, 'unique', new D2Rng(seed), {
          uniqueItem: shadowkiller,
          itemTypes: tables.itemTypes,
          isA: tables.isA,
        }),
      ).toBe(true)
    }
  })

  it('5. D2Game.dll 0x6FC2EC12..0x6FC2EC1F: uses itemRng.rand(100) < 5 and Charsi Imbue preserves halved Ethereal durability', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const expected = new D2Rng(seed).rand(100) < 5
      const actual = rollItemEthereal113c(pltBase, 'normal', new D2Rng(seed), {
        itemTypes: tables.itemTypes,
        isA: tables.isA,
      })
      expect(actual).toBe(expected)
    }

    // Charsi Imbue on Ethereal Plate Mail ('plt', durability 60) -> Rare with maxDurability = 31
    const imbuedEth = imbueItem113c(
      { code: 'plt', quality: 'normal', sockets: 0, identified: true, ethereal: true },
      { playerLevel: 30, seed: 12345, dropTables: tables },
    )
    expect(imbuedEth.ethereal).toBe(true)
    expect(imbuedEth.maxDurability).toBe(31)
    expect(imbuedEth.durability).toBe(31)

    // Charsi Imbue on non-Ethereal Plate Mail ('plt', durability 60) -> Rare with maxDurability = 60
    const imbuedNonEth = imbueItem113c(
      { code: 'plt', quality: 'normal', sockets: 0, identified: true, ethereal: false },
      { playerLevel: 30, seed: 12345, dropTables: tables },
    )
    expect(imbuedNonEth.ethereal).toBeFalsy()
    expect(imbuedNonEth.maxDurability).toBe(60)
    expect(imbuedNonEth.durability).toBe(60)

    // Also verify across 5 other base items (uit, chn, ssd, hax)
    for (const [base, expectedEthDur] of [
      [uitBase, 44],
      [chnBase, 23],
      [ssdBase, 13],
      [haxBase, 15],
    ] as const) {
      const item = createDroppedItem(base, 'normal', {
        ethereal: true,
        ilvl: 50,
        dwInitSeed: 999,
        itemTypes: tables.itemTypes,
      })
      expect(item.maxDurability).toBe(expectedEthDur)
      expect(item.durability).toBe(expectedEthDur)
    }
  })
})

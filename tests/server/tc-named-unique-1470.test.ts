/**
 * Issue #1470 — 1.13c TC Named Unique / Set Item Resolution (`ROP (H)` / `ROP (N)` `Annihilus`) & Unclamped Drop `ilvl`
 *
 * Ground truth references (`samples/d2/D2Common.dll` ImageBase `0x6FD50000`, `samples/d2/D2Game.dll` ImageBase `0x6FC20000`):
 * - `D2Common.dll` `0x6FDA4430` (`DATATBLS_ParseTreasureClassExItem`):
 *   - `0x6FDA4540..0x6FDA4580`: Resolves `Item1..Item10` against `pUniqueItemsLinker` (`UniqueItems.txt` `index` column).
 *     Sets `nFlags |= 0x11` (`TCFLAG_UNIQUE | TCFLAG_EXPANSION`), `wItemId = pUniqueTxt->dwCode` (`'cm1'` for `Annihilus`),
 *     and `wUniqueOrSetId = uniqueRowIndex` (`382` for `Annihilus`).
 *   - `0x6FDA4582..0x6FDA45C2`: Resolves `Item1..Item10` against `pSetItemsLinker` (`SetItems.txt` `index` column).
 *     Sets `nFlags |= 0x12` (`TCFLAG_SET | TCFLAG_EXPANSION`), `wItemId = pSetItemsTxt->dwCode`, and `wUniqueOrSetId = setRowIndex`.
 * - `D2Game.dll` `0x6FC328C8..0x6FC32925` (`ITEMS_RollTreasureClass`) & `0x6FC2F40A..0x6FC2F45A` (`ITEMS_RollUniqueItem`):
 *   - Leaf with `TCFLAG_UNIQUE` forces `nQuality = 7` (`ITEMQUAL_UNIQUE`) and selects the exact `UniqueItems.txt` row
 *     (verifying `pUniqueTxt->dwCode == pItemsTxt->dwCode`) without rarity weighting or `lvl <= ilvl` filtering.
 * - `D2Game.dll` `0x6FC32D60` (`ITEMS_DropMonsterTreasureClass`), `0x6FC2E5D0` (`ITEMS_GetDropItemLevel`), `0x6FC315A0` (`ITEMS_CreateItem`):
 *   - Only clamps drop `ilvl` lower bound to `>= 1`; does NOT cap at `99` (`diabloclone` and Pandemonium Ubers have `Level(H) = 110`).
 */
import * as fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { executeDropPipeline } from '../../src/common/items/drop-tables.ts'
import { ItemQuality } from '../../src/common/items/items.ts'
import {
  parseTreasureClassTable,
  resolveNamedUniqueOrSetFromTcItem,
  type TreasureClassNode,
} from '../../src/common/items/treasure-class.ts'
import { rollTreasureClass } from '../../src/common/items/treasure-engine.ts'
import { parseTable } from '../../src/common/world/acts.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import {
  executePendingMonsterDrop113c,
  resolveMonsterDropPending113c,
} from '../../src/server/items/drop-pipeline.ts'

describe('Issue #1470 — 1.13c TC Named Unique / Set Resolution (ROP Annihilus & Unclamped ilvl 110)', () => {
  const dropTables = getEmbeddedDropTables()

  it('resolves UniqueItems.txt and SetItems.txt index entries in TreasureClassEx.txt without hardcoded Annihilus checks (D2Common!0x6FDA4430)', () => {
    const tcSrc = fs.readFileSync('src/common/items/treasure-class.ts', 'utf8')
    const engineSrc = fs.readFileSync('src/common/items/treasure-engine.ts', 'utf8')
    expect(tcSrc).not.toContain('Annihilus')
    expect(engineSrc).not.toContain('Annihilus')

    // ROP (H): Picks=1, Unique=1024, Item1=Annihilus, Prob1=1
    const ropH = dropTables.tcTable.get('ROP (H)')
    expect(ropH).toBeDefined()
    expect(ropH!.picks).toBe(1)
    expect(ropH!.unique).toBe(1024)
    expect(ropH!.items).toHaveLength(1)
    expect(ropH!.items[0]).toMatchObject({
      item: 'Annihilus',
      prob: 1,
      kind: 'unique-item',
      uniqueIndex: 381,
      baseCode: 'cm1',
      isClassic: false,
    })

    // ROP (N): Picks=1, Item1=Diablo (N) (Prob1=4), Item2=Annihilus (Prob2=1)
    const ropN = dropTables.tcTable.get('ROP (N)')
    expect(ropN).toBeDefined()
    expect(ropN!.picks).toBe(1)
    expect(ropN!.items).toHaveLength(2)
    expect(ropN!.items[0]).toMatchObject({
      item: 'Diablo (N)',
      prob: 4,
      kind: 'tc',
    })
    expect(ropN!.items[1]).toMatchObject({
      item: 'Annihilus',
      prob: 1,
      kind: 'unique-item',
      uniqueIndex: 381,
      baseCode: 'cm1',
      isClassic: false,
    })

    // Verify general UniqueItems.txt and SetItems.txt index resolution
    expect(resolveNamedUniqueOrSetFromTcItem("Gheed's Fortune")).toEqual({
      kind: 'unique-item',
      uniqueIndex: 359,
      baseCode: 'cm3',
    })
    expect(resolveNamedUniqueOrSetFromTcItem('The Stone of Jordan')).toEqual({
      kind: 'unique-item',
      uniqueIndex: 122,
      baseCode: 'rin',
    })
    expect(resolveNamedUniqueOrSetFromTcItem("Tal Rasha's Adjudication")).toEqual({
      kind: 'set-item',
      setIndex: 77,
      baseCode: 'amu',
    })
  })

  it('drops 1 Unique cm1 (Annihilus, ilvl=110) from ROP (H) at nLevel=110 without throwing (D2Game!0x6FC328C8 & 0x6FC2E5D0)', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const drops = executeDropPipeline(dropTables, {
        tcName: 'ROP (H)',
        nLevel: 110,
        difficulty: 'hell',
        monsterRng: seed * 7919,
      })
      expect(drops).toHaveLength(1)
      const item = drops[0]!
      expect(item.base.id).toBe('cm1')
      expect(item.code?.trim()).toBe('cm1')
      expect(item.quality).toBe(ItemQuality.UNIQUE)
      expect(item.rarity).toBe('unique')
      expect(item.uniqueItemDef).toBeDefined()
      expect(item.uniqueItemDef!.id).toBe(381)
      expect(item.uniqueItemDef!.index).toBe('Annihilus')
      expect(item.ilvl).toBe(110)
      expect(item.level).toBe(110)
    }

    // Also verify end-to-end monster death drop resolution for diabloclone (Level(H) = 110, TC = ROP (H))
    const diabloClone = dropTables.monsterKinds.get('diabloclone')
    expect(diabloClone).toBeDefined()
    expect(diabloClone!.level[2]).toBe(110)
    expect(diabloClone!.getTreasureClass?.('hell', 1)).toBe('ROP (H)')

    const pending = resolveMonsterDropPending113c(
      undefined,
      {
        type: 'death',
        subjectId: 'diabloclone',
        monsterLevel: 110,
        monsterRank: 'boss',
        x: 100,
        y: 100,
      } as any,
      {
        dropTables,
        difficulty: 'hell',
      },
    )
    expect(pending).not.toBeNull()
    expect(pending!.tcName).toBe('ROP (H)')
    expect(pending!.monsterLevel).toBe(110)

    const cloneDrops = executePendingMonsterDrop113c(dropTables, pending!, 'hell', 0x12345678)
    expect(cloneDrops).toHaveLength(1)
    expect(cloneDrops[0]!.base.id).toBe('cm1')
    expect(cloneDrops[0]!.rarity).toBe('unique')
    expect(cloneDrops[0]!.uniqueItemDef?.index).toBe('Annihilus')
    expect(cloneDrops[0]!.ilvl).toBe(110)
  })

  it('expands ROP (N) into Diablo (N) and Annihilus with 4:1 probability weights (Prob1=4, Prob2=1)', () => {
    const rng = new D2Rng(0xCAFEBABE)
    const trials = 10000
    let annihilusRolls = 0
    let diabloSubTcRolls = 0

    // Replace Diablo (N) with a 1-pick deterministic sentinel leaf so we count exact top-level ROP (N) branch selections
    const sentinelDiabloNode: TreasureClassNode = {
      name: 'Diablo (N)',
      level: 40,
      picks: 1,
      unique: 0,
      set: 0,
      rare: 0,
      magic: 0,
      noDrop: 0,
      items: [{ item: 'rin', prob: 1, kind: 'base-item', isDangling: true, isClassic: true }],
      totalProbClassic: 1,
      totalProbExpansion: 1,
      cumulativeProbExpansion: [1],
    }
    const customTcTable = {
      ...dropTables.tcTable,
      get: (name: string) =>
        name === 'Diablo (N)' ? sentinelDiabloNode : dropTables.tcTable.get(name),
    }

    for (let i = 0; i < trials; i++) {
      const leaves = rollTreasureClass('ROP (N)', {
        rng,
        tcTable: customTcTable,
        gamePlayers: 1,
        partyPlayers: 1,
      })
      expect(leaves).toHaveLength(1)
      if (leaves[0]!.item === 'Annihilus') {
        expect(leaves[0]!.code).toBe('cm1')
        expect(leaves[0]!.uniqueIndex).toBe(381)
        expect(leaves[0]!.forcedUnique).toBe(true)
        annihilusRolls++
      } else {
        expect(leaves[0]!.code).toBe('rin')
        diabloSubTcRolls++
      }
    }

    const anniRate = annihilusRolls / trials
    // Expected: 1 / (4 + 1) = 0.20 (20% Annihilus, 80% Diablo (N))
    expect(anniRate).toBeGreaterThan(0.185)
    expect(anniRate).toBeLessThan(0.215)
    expect(diabloSubTcRolls + annihilusRolls).toBe(trials)

    // Execute full drop pipeline on ROP (N) at Nightmare diabloclone level (nLevel = 70) across seeds:
    // When Annihilus is picked on ROP (N), direct uniqueIndex selection (D2Game!0x6FC2F40A..0x6FC2F45A)
    // spawns Annihilus even though nLevel (70) < Annihilus.lvl (110).
    let spawnedAnniInPipeline = 0
    let spawnedDiabloDropsInPipeline = 0
    for (let seed = 1; seed <= 100; seed++) {
      const drops = executeDropPipeline(dropTables, {
        tcName: 'ROP (N)',
        nLevel: 70,
        difficulty: 'nightmare',
        monsterRng: seed * 104729,
      })
      if (drops.length === 1 && drops[0]!.uniqueItemDef?.index === 'Annihilus') {
        expect(drops[0]!.base.id).toBe('cm1')
        expect(drops[0]!.rarity).toBe('unique')
        expect(drops[0]!.ilvl).toBe(70)
        spawnedAnniInPipeline++
      } else {
        spawnedDiabloDropsInPipeline++
      }
    }
    expect(spawnedAnniInPipeline).toBeGreaterThan(5)
    expect(spawnedDiabloDropsInPipeline).toBeGreaterThan(50)
  })

  it('selects the exact named UniqueItem or SetItem by index without rarity weighting (D2Game!0x6FC2F40A & 0x6FC33CF6)', () => {
    // Parse a synthetic TreasureClassEx table containing named Unique ("The Stone of Jordan", id=122, code='rin')
    // and named Set ("Angelic Halo", id=35, item='rin')
    const tsv = [
      'Treasure Class\tgroup\tlevel\tPicks\tUnique\tSet\tRare\tMagic\tNoDrop\tItem1\tProb1',
      'NamedSojTC\t\t\t1\t1024\t0\t0\t0\t0\tThe Stone of Jordan\t1',
      'NamedHaloTC\t\t\t1\t0\t1024\t0\t0\t0\tAngelic Halo\t1',
    ].join('\r\n')
    const customTcTable = parseTreasureClassTable(parseTable(new TextEncoder().encode(tsv)))
    const customDropTables = { ...dropTables, tcTable: customTcTable }

    // Even though Nagelring (rarity 15) and Manald Heal (rarity 15) share base 'rin' with SoJ (rarity 1),
    // NamedSojTC always spawns The Stone of Jordan (id 122), even at nLevel=1 (< SoJ lvl 39).
    for (let seed = 1; seed <= 20; seed++) {
      const sojDrops = executeDropPipeline(customDropTables, {
        tcName: 'NamedSojTC',
        nLevel: 1,
        difficulty: 'normal',
        monsterRng: seed,
      })
      expect(sojDrops).toHaveLength(1)
      expect(sojDrops[0]!.base.id).toBe('rin')
      expect(sojDrops[0]!.rarity).toBe('unique')
      expect(sojDrops[0]!.uniqueItemDef?.id).toBe(122)
      expect(sojDrops[0]!.uniqueItemDef?.index).toBe('The Stone of Jordan')

      const haloDrops = executeDropPipeline(customDropTables, {
        tcName: 'NamedHaloTC',
        nLevel: 1,
        difficulty: 'normal',
        monsterRng: seed,
      })
      expect(haloDrops).toHaveLength(1)
      expect(haloDrops[0]!.base.id).toBe('rin')
      expect(haloDrops[0]!.rarity).toBe('set')
      expect(haloDrops[0]!.setItemDef?.index).toBe('Angelic Halo')
    }
  })
})

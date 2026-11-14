/**
 * Issue #1432 — 1.13c Once-Per-Game Unique Spawn Bitmap (`pGame + 0x1b24`) & `nolimit` / `quest` Bypass
 *
 * Ground truth references (`samples/d2/D2Game.dll` ImageBase `0x6FC20000`, `samples/d2/Patch_D2.mpq`):
 * - `0x6FC4C388` / `0x6FC4C670`: Zero-initializes 4096-bit bitmap at `pGame + 0x1b24` (`0x80` dwords).
 * - `0x6FC2E250` (`ITEMS_CheckUniqueSpawned`): Tests `pGame->uniqueSpawnedBitmap[nUniqueId >> 5] & (1 << (nUniqueId & 31))`.
 * - `0x6FC2EDC0` (`ITEMS_RegisterUniqueSpawned`):
 *   - Checks `pUniqueTxt->nFlags & 0x04` (`nolimit` column in `UniqueItems.txt` @ `0x6FC2EE16`): if set, returns `1` without setting the bitmap bit.
 *   - Checks `pItemsTxt->nQuest` (`quest` column in `Weapons.txt`/`Armor.txt`/`Misc.txt` @ `0x6FC2EE1F`): if non-zero, bypasses the already-spawned check.
 *   - Otherwise sets bit `nUniqueId` in `pGame + 0x1b24` (`0x6FC2EE53`).
 * - `0x6FC2F370` (`ITEMS_RollUniqueItem`, Expansion branch `0x6FC2F533..0x6FC2F6FB`):
 *   - Builds weighted candidate pool from all enabled `UniqueItems.txt` rows with `code == base.code` and `lvl <= ilvl` (`0x6FC2F550..0x6FC2F5ED`) WITHOUT pre-filtering by `pGame + 0x1b24`.
 *   - Picks one candidate `nUniqueId` by `rarity` weight (`0x6FC2F635`), then checks `0x6FC2E250(pGame, nUniqueId)` if `pItemsTxt->nQuest == 0` (`0x6FC2F65C..0x6FC2F673`).
 *   - If already spawned in this game, returns `0` (`0x6FC2F6E6`), causing `0x6FC30A20` (`0x6FC30D5C..0x6FC30DF5`) to downgrade the item to a Failed Unique (3x durability Rare if `CanBeRare`, else 3x durability Magic).
 */
import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { executeDropPipeline } from '../../src/common/items/drop-tables.ts'
import { resolveGambledItem } from '../../src/common/items/vendor-generator.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { executePendingMonsterDrop113c } from '../../src/server/items/drop-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('Issue #1432 — 1.13c Once-Per-Game Unique Spawn Bitmap (pGame+0x1b24 / nolimit / quest)', () => {
  const dropTables = getEmbeddedDropTables()

  it('spawns a non-nolimit unique once per game and degrades the second roll to 3x-durability Rare (D2Game!0x6FC2F370 & 0x6FC30A20)', () => {
    // Hand Axe ('hax', base durability 28) -> The Gnasher (id = 0, lvl = 7, nolimit = false)
    const hax = dropTables.getBase('hax') as unknown as { durability?: number }
    expect(hax.durability).toBe(28)
    const gnasher = dropTables.uniques.byIndex.get('The Gnasher')!
    expect(gnasher.id).toBe(0)
    expect(gnasher.lvl).toBe(7)
    expect(gnasher.nolimit).toBe(false)

    const spawnedUniqueIds = new Set<number>()

    // First roll in the game: succeeds as Unique ('The Gnasher') and records id 0 in spawnedUniqueIds
    const firstDrop = executeDropPipeline(dropTables, {
      tcName: 'hax',
      nLevel: 10,
      difficulty: 'normal',
      forcedQuality: 'unique',
      monsterRng: 101,
      spawnedUniqueIds,
    })
    expect(firstDrop).toHaveLength(1)
    expect(firstDrop[0]!.rarity).toBe('unique')
    expect(firstDrop[0]!.uniqueItemDef?.id).toBe(0)
    expect(firstDrop[0]!.uniqueItemDef?.index).toBe('The Gnasher')
    expect(spawnedUniqueIds.has(0)).toBe(true)

    // Second roll in the same game: fails unique check and degrades to Rare with 3x durability (28 * 3 = 84)
    const secondDrop = executeDropPipeline(dropTables, {
      tcName: 'hax',
      nLevel: 10,
      difficulty: 'normal',
      forcedQuality: 'unique',
      monsterRng: 202,
      spawnedUniqueIds,
    })
    expect(secondDrop).toHaveLength(1)
    expect(secondDrop[0]!.rarity).toBe('rare')
    expect(secondDrop[0]!.uniqueItemDef).toBeUndefined()
    expect(secondDrop[0]!.maxDurability).toBe(28 * 3)
    expect(secondDrop[0]!.durability).toBe(28 * 3)
  })

  it("degrades a duplicate non-rareable unique (cm3 Gheed's Fortune) to Magic on the second roll in the same game", () => {
    // Grand Charm ('cm3') -> Gheed's Fortune (id = 359, lvl = 70, nolimit = false); charms cannot be Rare
    const gheeds = dropTables.uniques.byIndex.get("Gheed's Fortune")!
    expect(gheeds.id).toBe(359)
    expect(gheeds.code).toBe('cm3')
    expect(gheeds.nolimit).toBe(false)

    const spawnedUniqueIds = new Set<number>()

    const firstDrop = executeDropPipeline(dropTables, {
      tcName: 'cm3',
      nLevel: 85,
      difficulty: 'hell',
      forcedQuality: 'unique',
      monsterRng: 303,
      spawnedUniqueIds,
    })
    expect(firstDrop).toHaveLength(1)
    expect(firstDrop[0]!.rarity).toBe('unique')
    expect(firstDrop[0]!.uniqueItemDef?.id).toBe(359)
    expect(spawnedUniqueIds.has(359)).toBe(true)

    const secondDrop = executeDropPipeline(dropTables, {
      tcName: 'cm3',
      nLevel: 85,
      difficulty: 'hell',
      forcedQuality: 'unique',
      monsterRng: 404,
      spawnedUniqueIds,
    })
    expect(secondDrop).toHaveLength(1)
    expect(secondDrop[0]!.rarity).toBe('magic')
    expect(secondDrop[0]!.uniqueItemDef).toBeUndefined()
  })

  it('allows the same unique to spawn again in a new game (fresh spawnedUniqueIds set)', () => {
    const game1Spawned = new Set<number>()
    const game2Spawned = new Set<number>()

    const drop1 = executeDropPipeline(dropTables, {
      tcName: 'hax',
      nLevel: 10,
      difficulty: 'normal',
      forcedQuality: 'unique',
      monsterRng: 111,
      spawnedUniqueIds: game1Spawned,
    })
    const drop2 = executeDropPipeline(dropTables, {
      tcName: 'hax',
      nLevel: 10,
      difficulty: 'normal',
      forcedQuality: 'unique',
      monsterRng: 111,
      spawnedUniqueIds: game2Spawned,
    })

    expect(drop1[0]!.rarity).toBe('unique')
    expect(drop2[0]!.rarity).toBe('unique')
    expect(drop1[0]!.uniqueItemDef?.index).toBe('The Gnasher')
    expect(drop2[0]!.uniqueItemDef?.index).toBe('The Gnasher')
  })

  it('bypasses the once-per-game bitmap for UniqueItems.txt rows with nolimit = 1 (D2Game!0x6FC2EDC0 @ 0x6FC2EE16)', () => {
    // Construct a custom UniqueItemsTable where The Gnasher ('hax', id = 0) has nolimit = true
    const gnasher = dropTables.uniques.byIndex.get('The Gnasher')!
    const nolimitGnasher = { ...gnasher, nolimit: true }
    const customTables = {
      ...dropTables,
      uniques: {
        ...dropTables.uniques,
        getEnabledByCode: (code: string) =>
          code === 'hax' ? [nolimitGnasher] : dropTables.uniques.getEnabledByCode(code),
      },
    }

    const spawnedUniqueIds = new Set<number>()

    const firstDrop = executeDropPipeline(customTables, {
      tcName: 'hax',
      nLevel: 10,
      difficulty: 'normal',
      forcedQuality: 'unique',
      monsterRng: 501,
      spawnedUniqueIds,
    })
    const secondDrop = executeDropPipeline(customTables, {
      tcName: 'hax',
      nLevel: 10,
      difficulty: 'normal',
      forcedQuality: 'unique',
      monsterRng: 502,
      spawnedUniqueIds,
    })

    expect(firstDrop[0]!.rarity).toBe('unique')
    expect(firstDrop[0]!.uniqueItemDef?.id).toBe(0)
    expect(secondDrop[0]!.rarity).toBe('unique')
    expect(secondDrop[0]!.uniqueItemDef?.id).toBe(0)
    // nolimit = 1 returns early in 0x6FC2EDC0 without setting the bit in pGame + 0x1b24
    expect(spawnedUniqueIds.has(0)).toBe(false)
  })

  it('bypasses the already-spawned check for quest base items with ItemsTxt.nQuest != 0 (D2Game!0x6FC2F370 @ 0x6FC2F65C)', () => {
    // Khalim's Flail ('qf1', quest = 21 in Weapons.txt, UniqueItems.txt id = 127 has nolimit = false)
    const qf1Base = dropTables.getBase('qf1')!
    expect(qf1Base.quest).toBeGreaterThan(0)
    const khalimFlail = dropTables.uniques.getEnabledByCode('qf1')[0]!
    expect(khalimFlail.id).toBe(127)
    expect(khalimFlail.nolimit).toBe(false)

    const spawnedUniqueIds = new Set<number>()

    const firstDrop = executeDropPipeline(dropTables, {
      tcName: 'qf1',
      nLevel: 25,
      difficulty: 'normal',
      forcedQuality: 'unique',
      monsterRng: 601,
      spawnedUniqueIds,
    })
    const secondDrop = executeDropPipeline(dropTables, {
      tcName: 'qf1',
      nLevel: 25,
      difficulty: 'normal',
      forcedQuality: 'unique',
      monsterRng: 602,
      spawnedUniqueIds,
    })

    expect(firstDrop[0]!.rarity).toBe('unique')
    expect(firstDrop[0]!.uniqueItemDef?.id).toBe(127)
    expect(secondDrop[0]!.rarity).toBe('unique')
    expect(secondDrop[0]!.uniqueItemDef?.id).toBe(127)
  })

  it('selects multi-candidate uniques (e.g. rin rings) by rarity weight BEFORE checking spawnedUniqueIds (D2Game!0x6FC2F548..0x6FC2F673)', () => {
    // At ilvl = 30, eligible unique rings ('rin') are Nagelring (id 120, rarity 15),
    // Manald Heal (id 121, rarity 15), and The Stone of Jordan (id 122, rarity 1).
    const nagel = dropTables.uniques.byIndex.get('Nagelring')!
    const manald = dropTables.uniques.byIndex.get('Manald Heal')!
    expect(nagel.id).toBe(120)
    expect(manald.id).toBe(121)

    // Pre-mark ONLY Nagelring (122) as already spawned in this game.
    // In 1.13c, Nagelring is NOT removed from the weighted roll before rolling:
    // seeds that roll Nagelring fail to Rare, while seeds that roll Manald Heal succeed as Unique.
    let failedWhenRollingNagel = 0
    let succeededWhenRollingManald = 0
    for (let seed = 1; seed <= 60; seed++) {
      const freshSet = new Set<number>()
      const baseline = executeDropPipeline(dropTables, {
        tcName: 'rin',
        nLevel: 30,
        difficulty: 'normal',
        forcedQuality: 'unique',
        monsterRng: seed,
        spawnedUniqueIds: freshSet,
      })[0]!
      expect(baseline.rarity).toBe('unique')

      const withNagelSpawned = new Set<number>([nagel.id])
      const actual = executeDropPipeline(dropTables, {
        tcName: 'rin',
        nLevel: 30,
        difficulty: 'normal',
        forcedQuality: 'unique',
        monsterRng: seed,
        spawnedUniqueIds: withNagelSpawned,
      })[0]!

      if (baseline.uniqueItemDef?.id === nagel.id) {
        expect(actual.rarity).toBe('rare')
        expect(actual.uniqueItemDef).toBeUndefined()
        failedWhenRollingNagel++
      } else if (baseline.uniqueItemDef?.id === manald.id) {
        expect(actual.rarity).toBe('unique')
        expect(actual.uniqueItemDef?.id).toBe(manald.id)
        succeededWhenRollingManald++
      }
    }
    expect(failedWhenRollingNagel).toBeGreaterThan(0)
    expect(succeededWhenRollingManald).toBeGreaterThan(0)
  })

  it('enforces the once-per-game unique bitmap in resolveGambledItem and executePendingMonsterDrop113c', () => {
    const spawnedUniqueIds = new Set<number>()
    const haxBase = dropTables.getBase('hax')!
    const mysteryItem = {
      base: haxBase,
      ilvl: 20,
      level: 20,
      name: 'Hand Axe',
      stats: {},
      invWidth: haxBase.invWidth,
      invHeight: haxBase.invHeight,
      stack: 1,
      value: haxBase.value,
      isGambleMystery: true,
    } as any

    // Find a seed where resolveGambledItem rolls Unique (qRoll < 50) without upgrading base.
    // For 'hax' at ilvl 20, ubercode '9ha' has qlvl > 20, so 1.13c NPC_RollGambleUpgrade
    // skips rand(10000) and advances straight to rand(100000).
    let uniqueGambleSeed = -1
    for (let s = 1; s < 500000; s++) {
      const rng = new D2Rng(s)
      const uber = haxBase.ubercode ? dropTables.getBase(haxBase.ubercode) : undefined
      let upgraded = false
      if (uber && 20 >= uber.level) {
        const chanceUber = (20 - uber.level) * 90 + 1
        if (rng.rand(10000) < chanceUber) {
          upgraded = true
        } else {
          const ultra = haxBase.ultracode ? dropTables.getBase(haxBase.ultracode) : undefined
          if (ultra && 20 >= ultra.level && rng.rand(10000) < (20 - ultra.level) * 33 + 1) {
            upgraded = true
          }
        }
      }
      const qRoll = rng.rand(100000)
      if (!upgraded && qRoll < 50) {
        uniqueGambleSeed = s
        break
      }
    }
    expect(uniqueGambleSeed).toBeGreaterThan(0)

    const gambled1 = resolveGambledItem({
      mysteryItem,
      cLvl: 20,
      tables: dropTables,
      rng: new D2Rng(uniqueGambleSeed),
      spawnedUniqueIds,
    })
    expect(gambled1.rarity).toBe('unique')
    expect(gambled1.uniqueItemDef?.id).toBe(0)
    expect(spawnedUniqueIds.has(0)).toBe(true)

    // Second gamble roll of the same unique in the same game degrades to 3x-durability Rare
    const gambled2 = resolveGambledItem({
      mysteryItem,
      cLvl: 20,
      tables: dropTables,
      rng: new D2Rng(uniqueGambleSeed),
      spawnedUniqueIds,
    })
    expect(gambled2.rarity).toBe('rare')
    expect(gambled2.maxDurability).toBe(28 * 3)

    // Subsequent monster drop of 'hax' in the same game also sees id 0 in spawnedUniqueIds
    const pendingDrop = executePendingMonsterDrop113c(
      dropTables,
      {
        monsterIndex: 1,
        subjectId: 'skeleton1',
        monsterLevel: 20,
        monsterRank: 'normal',
        monsterType: 1,
        x: 100,
        y: 100,
        tcName: 'hax',
        isBoss: false,
        isNoRatio: false,
        seed: 777,
        killerContext: { playerMf: 0, playerGf: 0, gamePlayers: 1, partyPlayers: 1 },
      },
      'normal',
      777,
      spawnedUniqueIds,
    )
    expect(pendingDrop).toHaveLength(1)
    expect(pendingDrop[0]!.rarity).not.toBe('unique')

    // Verify GameInstance initializes an empty per-game spawnedUniqueIds set
    const game = new GameInstance({ difficulty: 0, seed: 42 })
    expect((game as unknown as { spawnedUniqueIds: Set<number> }).spawnedUniqueIds.size).toBe(0)
  })
})

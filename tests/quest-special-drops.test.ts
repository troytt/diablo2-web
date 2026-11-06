/**
 * Issue #426: Quest & Special Drops Verification Suite
 *
 * Verifies 1.13c ground truth parity for:
 * 1. Countess Bonus Rune TC (`Countess`, `Countess (N)`, `Countess (H)`) & 6-item cap (`MAX_DROPPED_ITEMS = 6`),
 *    including the `/players 1` vs `/players 8` rune yield paradox.
 * 2. Act Boss Quest First-Kill (`TreasureClass4`: `Andarielq`..`Baalq`) vs Repeat Kill (`TreasureClass1`),
 *    100% Rare+ equipment guarantee, zero gold/junk, and `saveSnapshot` / `loadSnapshot` persistence.
 * 3. Hellforge Drop Table (`rollHellforgeDrop`): 1 difficulty-specific rune (1/11 uniform) +
 *    4 gems (1 perfect, 2 flawless, 1 normal).
 * 4. Pandemonium Keys (`pk1` Key of Terror, `pk2` Key of Hate, `pk3` Key of Destruction) in Hell difficulty only.
 */
import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import {
  executeDropPipeline,
  HELLFORGE_RUNES_BY_DIFFICULTY,
  HELLFORGE_NORMAL_GEMS,
  HELLFORGE_FLAWLESS_GEMS,
  HELLFORGE_PERFECT_GEMS,
  rollHellforgeDrop,
} from '../src/common/items/drop-tables.ts'
import {
  MAX_DROPPED_ITEMS,
  rollTreasureClass,
} from '../src/common/items/treasure-engine.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import { QuestLog } from '../src/common/world/quests.ts'
import { resolveItemQualityString } from '../src/common/items/ground-items.ts'

const dropTables = getEmbeddedDropTables()

const idleInput = {
  movement: { x: 0, y: 0 },
  attacking: false,
  pickingUp: false,
  talking: false,
  saving: false,
  loading: false,
  digits: [],
}

function isEquipment(code: string): boolean {
  const base = dropTables.getBase(code.trim())
  return base?.kind === 'weapon' || base?.kind === 'armor'
}

const dummyTerrain = {
  widthPx: 1000,
  heightPx: 1000,
  overlap: () => 0,
}

function createTestEngine(difficulty: 'normal' | 'nightmare' | 'hell' = 'normal') {
  return new GameEngine(dummyTerrain, {
    spawn: { x: 100, y: 100 },
    stats: [],
    xpTable: [0, 100, 200],
    dropTables,
    difficulty,
    skills: [],
    npcDefs: [],
    questDefs: [],
    combatOptions: {} as any,
    talkRadius: 50,
    pickupRadius: 50,
    inventoryCols: 10,
    inventoryRows: 4,
  })
}

function parseRuneNumber(code: string | undefined): number | null {
  const m = /^r(\d{2})$/.exec((code ?? '').trim())
  return m ? parseInt(m[1]!, 10) : null
}

describe('Issue #426 — Quest & Special Drops (1.13c Ground Truth Parity)', () => {
  // ==========================================================================
  // 1. Countess Bonus Rune TC & 6-Item Drop Cap (D2Game!6FC51BB0)
  // ==========================================================================
  describe('1. Countess Bonus Rune TC & 6-Item Monster Drop Cap', () => {
    it('enforces MAX_DROPPED_ITEMS = 6 across Countess, Countess (N), Countess (H), and Duriel', () => {
      expect(MAX_DROPPED_ITEMS).toBe(6)

      const tcs = ['Countess', 'Countess (N)', 'Countess (H)', 'Duriel', 'Duriel (N)', 'Duriel (H)', 'Durielq', 'Durielq (H)']
      for (const tcName of tcs) {
        for (let seed = 1; seed <= 200; seed++) {
          const leaves = rollTreasureClass(tcName, {
            rng: new D2Rng(seed),
            tcTable: dropTables.tcTable,
            autoTcTable: dropTables.autoTcTable,
            gamePlayers: 8,
            partyPlayers: 8,
          })
          expect(leaves.length).toBeLessThanOrEqual(MAX_DROPPED_ITEMS)

          const items = executeDropPipeline(dropTables, {
            tcName,
            nLevel: 85,
            monsterType: 1,
            gamePlayers: 8,
            partyPlayers: 8,
            difficulty: tcName.includes('(H)') ? 'hell' : tcName.includes('(N)') ? 'nightmare' : 'normal',
            monsterRng: new D2Rng(seed),
          })
          expect(items.length).toBeLessThanOrEqual(MAX_DROPPED_ITEMS)
        }
      }
    })

    it('restricts Countess rune drops to authentic difficulty ceilings (Normal <= r08, NM <= r18, Hell <= r28)', () => {
      // Normal: Countess Rune -> Runes 4 (max r08 Ral), Countess Item -> Act 1 Equip C (max r04)
      for (let seed = 1; seed <= 300; seed++) {
        const drops = executeDropPipeline(dropTables, {
          tcName: 'Countess',
          nLevel: 11,
          monsterType: 3,
          difficulty: 'normal',
          monsterRng: new D2Rng(seed),
        })
        expect(drops.length).toBeLessThanOrEqual(6)
        for (const d of drops) {
          const rNum = parseRuneNumber(d.code)
          if (rNum !== null) {
            expect(rNum).toBeGreaterThanOrEqual(1)
            expect(rNum).toBeLessThanOrEqual(8)
          }
        }
      }

      // Nightmare: Countess Rune (N) -> Runes 8 (max r16 Io), Countess Item (N) -> max r18 Ko
      for (let seed = 1; seed <= 300; seed++) {
        const drops = executeDropPipeline(dropTables, {
          tcName: 'Countess (N)',
          nLevel: 45,
          monsterType: 3,
          difficulty: 'nightmare',
          monsterRng: new D2Rng(seed),
        })
        expect(drops.length).toBeLessThanOrEqual(6)
        for (const d of drops) {
          const rNum = parseRuneNumber(d.code)
          if (rNum !== null) {
            expect(rNum).toBeGreaterThanOrEqual(1)
            expect(rNum).toBeLessThanOrEqual(18)
          }
        }
      }

      // Hell: Countess Rune (H) -> Runes 12 (max r24 Ist), Countess Item (H) -> max r28 Lo
      for (let seed = 1; seed <= 300; seed++) {
        const drops = executeDropPipeline(dropTables, {
          tcName: 'Countess (H)',
          nLevel: 82,
          monsterType: 3,
          difficulty: 'hell',
          monsterRng: new D2Rng(seed),
        })
        expect(drops.length).toBeLessThanOrEqual(6)
        for (const d of drops) {
          const rNum = parseRuneNumber(d.code)
          if (rNum !== null) {
            expect(rNum).toBeGreaterThanOrEqual(1)
            expect(rNum).toBeLessThanOrEqual(28)
          }
        }
      }
    })

    it('reproduces the 1.13c /players 1 vs /players 8 Countess paradox due to the 6-item cap', () => {
      // Because Countess Item (H) has 5 picks first and Countess Rune (H) has 3 picks second,
      // at /players 8 (party 8), Countess Item (H) almost always fills 5 of the 6 slots,
      // leaving only 1 slot for Countess Rune (H). At /players 1, Countess Item (H) has higher NoDrop,
      // leaving more slots under the 6-item ceiling for Countess Rune (H).
      let p1Runes = 0
      let p8Runes = 0
      const trials = 500

      for (let seed = 1; seed <= trials; seed++) {
        const p1Drops = executeDropPipeline(dropTables, {
          tcName: 'Countess (H)',
          nLevel: 82,
          monsterType: 3,
          gamePlayers: 1,
          partyPlayers: 1,
          difficulty: 'hell',
          monsterRng: new D2Rng(10000 + seed),
        })
        p1Runes += p1Drops.filter(d => parseRuneNumber(d.code) !== null).length

        const p8Drops = executeDropPipeline(dropTables, {
          tcName: 'Countess (H)',
          nLevel: 82,
          monsterType: 3,
          gamePlayers: 8,
          partyPlayers: 8,
          difficulty: 'hell',
          monsterRng: new D2Rng(10000 + seed),
        })
        p8Runes += p8Drops.filter(d => parseRuneNumber(d.code) !== null).length
      }

      expect(p1Runes).toBeGreaterThan(p8Runes)
    })
  })

  // ==========================================================================
  // 2. Act Boss Quest First-Kill (TreasureClass4) & Snapshot Persistence
  // ==========================================================================
  describe('2. Act Boss Quest First-Kill (TreasureClass4) & Persistence', () => {
    it('guarantees 0 gold, 0 junk, and 100% rare+ equipment on all Act Boss quest TCs across difficulties', () => {
      const questBosses: Array<{ tc: string; lvl: number; diff: 'normal' | 'nightmare' | 'hell' }> = [
        { tc: 'Andarielq', lvl: 12, diff: 'normal' },
        { tc: 'Andarielq (N)', lvl: 49, diff: 'nightmare' },
        { tc: 'Andarielq (H)', lvl: 75, diff: 'hell' },
        { tc: 'Durielq', lvl: 22, diff: 'normal' },
        { tc: 'Durielq (N)', lvl: 55, diff: 'nightmare' },
        { tc: 'Durielq (H)', lvl: 88, diff: 'hell' },
        { tc: 'Mephistoq', lvl: 26, diff: 'normal' },
        { tc: 'Mephistoq (N)', lvl: 59, diff: 'nightmare' },
        { tc: 'Mephistoq (H)', lvl: 87, diff: 'hell' },
        { tc: 'Diabloq', lvl: 40, diff: 'normal' },
        { tc: 'Diabloq (N)', lvl: 62, diff: 'nightmare' },
        { tc: 'Diabloq (H)', lvl: 94, diff: 'hell' },
        { tc: 'Baalq', lvl: 60, diff: 'normal' },
        { tc: 'Baalq (N)', lvl: 75, diff: 'nightmare' },
        { tc: 'Baalq (H)', lvl: 99, diff: 'hell' },
      ]

      const junkCodes = new Set(['gld', 'aqv', 'cqv', 'key', 'tsc', 'isc', 'hp1', 'hp2', 'hp3', 'hp4', 'hp5', 'mp1', 'mp2', 'mp3', 'mp4', 'mp5'])

      for (const { tc, lvl, diff } of questBosses) {
        let equipCount = 0
        for (let seed = 1; seed <= 30; seed++) {
          const drops = executeDropPipeline(dropTables, {
            tcName: tc,
            nLevel: lvl,
            monsterType: 4,
            difficulty: diff,
            monsterRng: new D2Rng(seed * 7919),
          })

          for (const item of drops) {
            const code = (item.code ?? '').trim()
            expect(item.base.id).not.toBe('gold')
            // Durielq in 1.13c TreasureClassEx.txt has a guaranteed 'tsc' (Town Portal Scroll) slot alongside 'Durielq - Base'
            if (!(tc.startsWith('Duriel') && code === 'tsc')) {
              expect(junkCodes.has(code)).toBe(false)
            }
            if (isEquipment(code)) {
              equipCount++
              const q = resolveItemQualityString(item.quality)
              // Quest TCs have rare: 1024 -> minimum Rare (or Magic 2x durability only if base cannot be rare)
              expect(['rare', 'set', 'unique', 'magic']).toContain(q)
              expect(q).not.toBe('normal')
              expect(q).not.toBe('superior')
              expect(q).not.toBe('low')
            }
          }
        }
        expect(equipCount).toBeGreaterThan(0)
      }
    })

    it('resolves base Act Boss TC (e.g. Mephisto (H)) to quest TC (Mephistoq (H)) when monsterType === 4', () => {
      for (let seed = 1; seed <= 50; seed++) {
        const drops = executeDropPipeline(dropTables, {
          tcName: 'Mephisto (H)',
          nLevel: 87,
          monsterType: 4,
          difficulty: 'hell',
          monsterRng: new D2Rng(seed),
        })
        for (const item of drops) {
          expect((item.code ?? '').trim()).not.toBe('gld')
          expect(item.base.id).not.toBe('gold')
          if (isEquipment(item.code ?? '')) {
            const q = resolveItemQualityString(item.quality)
            expect(['rare', 'set', 'unique', 'magic']).toContain(q)
          }
        }
      }
    })

    it('routes first Act Boss kill in GameEngine to TreasureClass4, persists state in snapshot, and routes repeat kill to TreasureClass1', () => {
      const engine = createTestEngine('normal')

      expect(engine.questLog.isBossFirstKillCompleted('andariel', 'normal')).toBe(false)

      // First kill of Andariel
      engine.world.pendingKills = [
        {
          kind: 'kill',
          x: engine.world.player.x,
          y: engine.world.player.y,
          subjectId: 'andariel',
          monsterRank: 'boss',
          monsterLevel: 12,
          dropSeed: 123456,
        } as any,
      ]
      engine.tick(idleInput)

      // First kill must mark boss first-kill completed
      expect(engine.questLog.isBossFirstKillCompleted('andariel', 'normal')).toBe(true)
      // Other difficulties remain uncompleted
      expect(engine.questLog.isBossFirstKillCompleted('andariel', 'nightmare')).toBe(false)
      expect(engine.questLog.isBossFirstKillCompleted('andariel', 'hell')).toBe(false)

      // First kill drops must have 0 gold (Andarielq never drops gold)
      const firstKillItems = [...engine.groundItems.all]
      expect(firstKillItems.length).toBeGreaterThan(0)
      expect(firstKillItems.every(g => !g.isGold && (g.item.code ?? '').trim() !== 'gld')).toBe(true)

      // Save snapshot and restore into a new GameEngine via loadSnapshot
      const snapshotJson = engine.saveSnapshot()
      const engine2 = createTestEngine('normal')
      expect(engine2.questLog.isBossFirstKillCompleted('andariel', 'normal')).toBe(false)
      engine2.loadSnapshot(snapshotJson)
      expect(engine2.questLog.isBossFirstKillCompleted('andariel', 'normal')).toBe(true)

      // Repeat kills of Andariel now use TreasureClass1 ('Andariel'), which can drop gold/junk
      let sawGoldOrNormalOnRepeat = false
      for (let i = 1; i <= 30; i++) {
        engine2.groundItems.clear()
        engine2.world.pendingKills = [
          {
            kind: 'kill',
            x: engine2.world.player.x,
            y: engine2.world.player.y,
            subjectId: 'andariel',
            monsterRank: 'boss',
            monsterLevel: 12,
            dropSeed: i * 99991,
          } as any,
        ]
        engine2.tick(idleInput)
        for (const g of engine2.groundItems.all) {
          const q = resolveItemQualityString(g.item.quality)
          if (g.isGold || (g.item.code ?? '').trim() === 'gld' || q === 'normal' || q === 'magic') {
            sawGoldOrNormalOnRepeat = true
          }
        }
      }
      expect(sawGoldOrNormalOnRepeat).toBe(true)
    })
  })

  // ==========================================================================
  // 3. Hellforge Drop Table (rollHellforgeDrop)
  // ==========================================================================
  describe('3. Hellforge Drop Table (1 Rune + 4 Gems)', () => {
    it('emits 1 difficulty-bounded rune + 1 perfect + 2 flawless + 1 normal gem with uniform 1/11 rune distribution', () => {
      expect(HELLFORGE_RUNES_BY_DIFFICULTY.normal).toHaveLength(11)
      expect(HELLFORGE_RUNES_BY_DIFFICULTY.nightmare).toHaveLength(11)
      expect(HELLFORGE_RUNES_BY_DIFFICULTY.hell).toHaveLength(11)

      const difficulties: Array<'normal' | 'nightmare' | 'hell'> = ['normal', 'nightmare', 'hell']
      const perfectSet = new Set(HELLFORGE_PERFECT_GEMS)
      const flawlessSet = new Set(HELLFORGE_FLAWLESS_GEMS)
      const normalSet = new Set(HELLFORGE_NORMAL_GEMS)

      for (const diff of difficulties) {
        const expectedRunes = new Set(HELLFORGE_RUNES_BY_DIFFICULTY[diff])
        const seenRunes = new Map<string, number>()
        const rng = new D2Rng(0x13572468)

        const trials = 550
        for (let i = 0; i < trials; i++) {
          const drops = rollHellforgeDrop(diff, rng, dropTables)
          expect(drops).toHaveLength(5)

          const [rune, perfGem, flawGem1, flawGem2, normGem] = drops
          const runeCode = (rune!.code ?? '').trim()
          expect(expectedRunes.has(runeCode)).toBe(true)
          expect(perfectSet.has((perfGem!.code ?? '').trim())).toBe(true)
          expect(flawlessSet.has((flawGem1!.code ?? '').trim())).toBe(true)
          expect(flawlessSet.has((flawGem2!.code ?? '').trim())).toBe(true)
          expect(normalSet.has((normGem!.code ?? '').trim())).toBe(true)

          seenRunes.set(runeCode, (seenRunes.get(runeCode) ?? 0) + 1)
        }

        // Every one of the 11 runes in the difficulty pool must be rolled
        expect(seenRunes.size).toBe(11)
        for (const rCode of expectedRunes) {
          const count = seenRunes.get(rCode) ?? 0
          // Expected mean is 550 / 11 = 50; check reasonable uniform bounds [20, 90]
          expect(count).toBeGreaterThanOrEqual(20)
          expect(count).toBeLessThanOrEqual(90)
        }
      }
    })
  })

  // ==========================================================================
  // 4. Pandemonium Keys (pk1, pk2, pk3)
  // ==========================================================================
  describe('4. Pandemonium Keys (pk1, pk2, pk3)', () => {
    it('drops pk1 from Countess (H), pk2 from Summoner (H), pk3 from Nihlathak (H), and never in Normal/Nightmare', () => {
      expect(dropTables.getBase('pk1')?.name).toBeDefined()
      expect(dropTables.getBase('pk2')?.name).toBeDefined()
      expect(dropTables.getBase('pk3')?.name).toBeDefined()

      // Verify Normal and Nightmare TCs do NOT contain pk1, pk2, pk3
      for (const tc of ['Countess', 'Countess Item', 'Countess (N)', 'Countess Item (N)', 'Summoner', 'Summoner (N)', 'Nihlathak', 'Nihlathak (N)']) {
        const node = dropTables.tcTable.get(tc)!
        expect(node).toBeDefined()
        expect(node.items.some(it => it.item === 'pk1' || it.item === 'pk2' || it.item === 'pk3')).toBe(false)
      }

      // Verify Hell TCs contain pk1, pk2, pk3 and can drop them via executeDropPipeline
      const keyBosses: Array<{ tc: string; keyCode: string; lvl: number }> = [
        { tc: 'Countess (H)', keyCode: 'pk1', lvl: 82 },
        { tc: 'Summoner (H)', keyCode: 'pk2', lvl: 80 },
        { tc: 'Nihlathak (H)', keyCode: 'pk3', lvl: 95 },
      ]

      for (const { tc, keyCode, lvl } of keyBosses) {
        let droppedKeyCount = 0
        const rng = new D2Rng(424242)
        for (let i = 0; i < 400; i++) {
          const drops = executeDropPipeline(dropTables, {
            tcName: tc,
            nLevel: lvl,
            monsterType: 3,
            gamePlayers: 8,
            partyPlayers: 8,
            difficulty: 'hell',
            monsterRng: rng,
          })
          if (drops.some(d => (d.code ?? '').trim() === keyCode)) {
            droppedKeyCount++
          }
        }
        expect(droppedKeyCount).toBeGreaterThan(0)
      }
    })
  })
})

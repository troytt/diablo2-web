/**
 * #913 — belt potion grid size must follow the equipped belt exactly as 1.13c does.
 *
 * Ground truth (1.13c MPQ, re-derived here from the mounted archives, no skip):
 * - `Armor.txt` `belt` column = row index into `Belts.txt` (7 rows per resolution set; the second set,
 *   after the `Expansion` separator row, carries the 800x600 box coordinates with identical `numboxes`).
 * - `Belts.txt` `numboxes`: belt 12, sash 8, default 4, girdle 16, light belt 8, heavy belt 12, uber belt 16.
 * - rows = numboxes / 4. No belt equipped = `default` (4 boxes, 1 row).
 *
 * Regression: a fresh HUD belt model reported 4 rows (16 slots) until the first HUD publish
 * re-snapshotted the equipped belt, and unknown codes silently resolved to 4 rows.
 */
import { describe, expect, it } from 'vitest'
import { getSharedMountedArchives } from '../../src/baker/mpq-archive-source.ts'
import {
  BELT_CODE_TO_ROWS,
  BELT_COLS,
  BeltModel,
  NO_BELT_ROWS,
  getBeltRowsForCode,
} from '../../src/common/items/belt-model.ts'
import type { UiInventoryItem } from '../../src/common/items/inventory-model.ts'
import { parseTable } from '../../src/common/world/acts.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'

const BELTS_MEMBER = 'data\\global\\excel\\Belts.txt'
const ARMOR_MEMBER = 'data\\global\\excel\\Armor.txt'
/** `Belts.txt` row index of the `default` (no belt) entry. */
const BELTS_DEFAULT_INDEX = 2

describe('#913 belt rows parity with 1.13c Armor.txt + Belts.txt', () => {
  it('BELT_CODE_TO_ROWS equals numboxes/4 of every Armor.txt belt, in both resolution sets', async () => {
    const archives = await getSharedMountedArchives()
    const belts = parseTable(await archives.read(BELTS_MEMBER))
    const armor = parseTable(await archives.read(ARMOR_MEMBER))

    const bName = belts.header.indexOf('name')
    const bBoxes = belts.header.indexOf('numboxes')
    const sets: number[][] = [[], []]
    let set = 0
    for (const row of belts.rows) {
      if (row[bName] === 'Expansion') {
        set = 1
        continue
      }
      sets[set]!.push(Number(row[bBoxes]))
    }
    expect(sets[0]).toHaveLength(7)
    expect(sets[1]).toHaveLength(7)
    expect(sets[1]).toEqual(sets[0])
    expect(sets[0]![BELTS_DEFAULT_INDEX]! / BELT_COLS).toBe(NO_BELT_ROWS)

    const aCode = armor.header.indexOf('code')
    const aType = armor.header.indexOf('type')
    const aBelt = armor.header.indexOf('belt')
    const expected: Record<string, number> = {}
    for (const row of armor.rows) {
      if (row[aType] !== 'belt') continue
      const idx = Number(row[aBelt])
      const boxes = sets[0]![idx]
      expect(boxes, `Belts.txt row ${idx} for ${row[aCode]}`).toBeDefined()
      expect(boxes! % BELT_COLS).toBe(0)
      expected[row[aCode]!] = boxes! / BELT_COLS
    }
    expect(Object.keys(expected)).toHaveLength(15)
    expect({ ...BELT_CODE_TO_ROWS }).toEqual(expected)
    // The issue body's mapping, verified: Sash/Light Belt 2, Belt/Heavy Belt 3, Girdle + all exc/elite 4.
    expect([expected.lbl, expected.vbl, expected.mbl, expected.tbl, expected.hbl]).toEqual([2, 2, 3, 3, 4])
  }, 60_000)

  it('unknown belt codes fail fast instead of granting a 16-slot belt', () => {
    expect(getBeltRowsForCode(null)).toBe(1)
    expect(() => getBeltRowsForCode('xyz')).toThrow(/not an Armor\.txt belt code/)
    expect(() => new BeltModel().setEquippedBelt('xyz')).toThrow()
  })
})

describe('#913 HUD belt grid follows the equipped belt live', () => {
  const beltItem = (code: string): UiInventoryItem => ({ id: `b-${code}`, code } as unknown as UiInventoryItem)

  it('fresh HUD with no belt shows 1 row (4 slots), not 4 rows', () => {
    const hud = new HudManager()
    expect(hud.belt.maxRows).toBe(1)
    hud.belt.lockedOpen = true
    expect(hud.belt.isExpanded).toBe(false)
    expect(hud.belt.activeRows).toBe(1)
  })

  it('rows track inventory.equipped.belt without a publish step (mbl 3, zmb 4, unequip 1)', () => {
    const hud = new HudManager()
    hud.belt.lockedOpen = true

    hud.inventory.equipped.belt = beltItem('mbl')
    expect(hud.belt.maxRows).toBe(3)
    expect(hud.belt.activeRows).toBe(3)
    // Hit-testing must not reach a 4th row on a 12-box belt.
    const box3 = hud.belt.getBeltSlotBox(0, 3)
    expect(hud.belt.slotAtPoint(box3.x + 2, box3.y + 2)).toBeNull()
    const box2 = hud.belt.getBeltSlotBox(0, 2)
    expect(hud.belt.slotAtPoint(box2.x + 2, box2.y + 2)).toEqual({ row: 2, col: 0 })

    hud.inventory.equipped.belt = beltItem('lbl')
    expect(hud.belt.maxRows).toBe(2)

    hud.inventory.equipped.belt = beltItem('zmb') // Mesh Belt shares invmbl art but is a 16-box uber belt
    expect(hud.belt.maxRows).toBe(4)

    delete hud.inventory.equipped.belt
    expect(hud.belt.maxRows).toBe(1)
  })

  it('local placement respects the equipped capacity', () => {
    const hud = new HudManager()
    hud.inventory.equipped.belt = beltItem('vbl') // 8 boxes
    let placed = 0
    for (let i = 0; i < 16; i++) if (hud.belt.autoPlacePotion({ id: `p${i}`, code: 'hp1' })) placed++
    expect(placed).toBe(8) // exactly Belts.txt `light belt` numboxes; the 9th potion stays out of the belt
    expect(hud.belt.countTotalPotions()).toBe(8)
  })
})

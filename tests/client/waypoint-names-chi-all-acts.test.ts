/**
 * Chinese locale: every waypoint name (Acts I..V) must resolve to CHI `.tbl` text, never the ENG fallback.
 *
 * Act 5 `LevelName` keys live in `expansionstring.tbl`, which the 1.13c MPQ set ships without a CHI copy;
 * `pack-canonical-tbl.ts` previously fell through to the ENG value, so all nine Act 5 waypoints
 * (Harrogath .. Worldstone Keep Level 2) rendered in English under `lang=CHI`.
 */

import { describe, expect, it } from 'vitest'
import { ACT_WAYPOINTS, resolveWaypointName } from '../../src/client/ui/panels/quest-waypoint-data.ts'

const HAS_CJK = /[\u4e00-\u9fff]/

describe('waypoint names under CHI locale', () => {
  for (let act = 1; act <= 5; act++) {
    for (const wp of ACT_WAYPOINTS[act]!) {
      it(`Act ${act} #${wp.index} levelId=${wp.levelId} (${wp.nameEn}) is Chinese`, () => {
        const zh = resolveWaypointName(wp.levelId, 'CHI')
        expect(zh).toMatch(HAS_CJK)
        expect(zh).not.toBe(resolveWaypointName(wp.levelId, 'ENG'))
        expect(wp.nameZh).toBe(zh)
      })
    }
  }

  it('Act 5 waypoint names match the canonical Traditional Chinese level names', () => {
    expect(ACT_WAYPOINTS[5]!.map(wp => resolveWaypointName(wp.levelId, 'CHI'))).toEqual([
      '哈洛加斯',
      '冰凍高地',
      '亞瑞特高原',
      '水晶通道',
      '冰河路徑',
      '痛苦之廳',
      '冰凍苔原',
      '遠古之路',
      '世界之石要塞第二層',
    ])
  })
})

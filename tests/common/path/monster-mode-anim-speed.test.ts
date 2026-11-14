import { describe, expect, it } from 'vitest'
import { getMonsterModeBaseAnimSpeed256, getMonsterPathRecord } from '../../../src/common/path/units.ts'

/**
 * Issue #852 (NPC half): every NPC/monster's per-mode animation base speed must come
 * from its OWN AnimData.d2 record (`DATATBLS_GetAnimDataRecord`, AnimTbls.cpp:86) —
 * NOT a flat 256. The old flat default forced Gheed's 96-speed idle and the camp
 * guards' 128-speed idle to run at 256 (up to 2.7x too fast).
 */
describe('monster per-mode AnimData base speeds (#852)', () => {
  it('town NPC idle speeds match their AnimData records', () => {
    // Gheed (GH): GHNUHTH speed 96
    expect(getMonsterModeBaseAnimSpeed256(147, 1)).toBe(96)
    // Charsi (CI): CINUHTH speed 176
    expect(getMonsterModeBaseAnimSpeed256(154, 1)).toBe(176)
    // Rogue guard (CW): CWNUHTH speed 128
    expect(getMonsterModeBaseAnimSpeed256(179, 1)).toBe(128)
    // Akara (PS): PSNUHTH speed 256 — genuinely 256
    expect(getMonsterModeBaseAnimSpeed256(148, 1)).toBe(256)
  })

  it('walk mirrors the velocity-scaled walkAnimSpeed and run maps to runAnimSpeed', () => {
    const gheed = getMonsterPathRecord(147)
    expect(getMonsterModeBaseAnimSpeed256(147, 2)).toBe(gheed.walkAnimSpeed)
    expect(getMonsterModeBaseAnimSpeed256(147, 15)).toBe(gheed.runAnimSpeed)
    // KB(13) uses the walk speed (npc-motion MONMODE_KNOCKBACK branch)
    expect(getMonsterModeBaseAnimSpeed256(147, 13)).toBe(gheed.walkAnimSpeed)
  })

  it('unknown modes fall back to the engine default record speed (256)', () => {
    expect(getMonsterModeBaseAnimSpeed256(147, 14)).toBe(256)
    expect(getMonsterModeBaseAnimSpeed256(147, 99)).toBe(256)
  })
})

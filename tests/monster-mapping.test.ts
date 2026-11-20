import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveMonsterArtSpec, MONSTER_ART_MAP, ACT_MONSTER_SPECS } from '../src/common/units/monster-mapping.ts'
import {
  CANONICAL_CHI_TBL_DICT,
  CANONICAL_ENG_TBL_DICT,
  resolveTblKey,
} from '../src/common/data/canonical-tbl-strings.ts'

describe('monster-mapping', () => {
  it('resolves standard Act 1 monsters', () => {
    expect(resolveMonsterArtSpec('fallen1')).toEqual({ token: 'FA', weapon: 'hth' })
    expect(resolveMonsterArtSpec('zombie1')).toEqual({ token: 'ZM', weapon: 'hth' })
    expect(resolveMonsterArtSpec('quillrat1')).toEqual({ token: 'SI', weapon: 'hth' })
    expect(resolveMonsterArtSpec('corruptrogue1')).toEqual({ token: 'CR', weapon: '1hs' })
    expect(resolveMonsterArtSpec('cr_archer1')).toEqual({ token: 'CR', weapon: 'bow' })
  })

  it('resolves numbered variants through exact or base lookup without prefix iteration order', () => {
    expect(resolveMonsterArtSpec('fallen3')?.token).toBe('FA')
    expect(resolveMonsterArtSpec('zombie5')?.token).toBe('ZM')
    expect(resolveMonsterArtSpec('quillrat6')?.token).toBe('SI')
    // Suffix with arbitrary letters must not prefix-match
    expect(resolveMonsterArtSpec('fallen_fake')).toBeNull()
  })

  it('resolves hellbovine to EC token instead of CW', () => {
    expect(resolveMonsterArtSpec('hellbovine')).toEqual({ token: 'EC', weapon: 'hth' })
    expect(MONSTER_ART_MAP.hellbovine).toEqual({ token: 'EC', weapon: 'hth' })
  })

  it('does not leak cut monsters while resolving Act 5 Minion of Destruction (minion1..11) to token XX', () => {
    const cutMonsters = ['bloodmage1', 'darkguard1', 'lightningbeast', 'spiritmummy']
    for (const id of cutMonsters) {
      expect(resolveMonsterArtSpec(id)).toBeNull()
    }
    for (let i = 1; i <= 11; i += 1) {
      expect(resolveMonsterArtSpec(`minion${i}`)).toEqual({ token: 'XX', weapon: 'hth' })
    }
  })

  it('ACT_MONSTER_SPECS includes token XX only in Act 5 (Minion of Destruction)', () => {
    for (const [act, specs] of Object.entries(ACT_MONSTER_SPECS)) {
      if (Number(act) === 5) {
        expect(specs).toContainEqual({ token: 'XX', weapon: 'hth' })
      } else {
        for (const spec of specs) {
          expect(spec.token, `Act ${act} contains invalid token ${spec.token}`).not.toBe('XX')
        }
      }
    }
  })

  it('returns null for unknown monsters', () => {
    expect(resolveMonsterArtSpec('non_existent_monster_xyz')).toBeNull()
  })

  it('has zero whitespace-only CHI .tbl strings when ENG is non-blank and packs token XX for minion1..11 (#1246)', () => {
    let blankChiCount = 0
    for (const [k, cv] of Object.entries(CANONICAL_CHI_TBL_DICT)) {
      const ev = CANONICAL_ENG_TBL_DICT[k] ?? ''
      if (cv.trim() === '' && ev.trim() !== '') {
        blankChiCount += 1
      }
    }
    expect(blankChiCount).toBe(0)
    expect(resolveTblKey('Dominus', 'CHI')).toBe('女妖')
    expect(resolveTblKey('Imp1', 'CHI')).toBe('恶魔小鬼')
    expect(resolveTblKey('Minionexp', 'CHI')).toBe('奴隶')
    expect(resolveTblKey('Megaflow Rectifier', 'CHI')).toBe('矫正者怪异')
    expect(resolveTblKey('dr1', 'CHI')).toBe('狼头')
    expect(resolveTblKey('ob1', 'CHI')).toBe('鹰眼法珠')
    expect(resolveTblKey('WeaponDescH2H', 'CHI')).toBe('爪等级')

    const packEntityAssetsSrc = readFileSync('src/baker/packers/pack-entity-assets.ts', 'utf8')
    expect(packEntityAssetsSrc).not.toContain("token !== 'XX'")
  })
})


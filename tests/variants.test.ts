import { describe, expect, test } from 'vitest'
import {
  findMatchingVariant,
  getDefaultTownVariant,
  oppositeSide,
  variantOrientation,
} from '../src/common/rng/variants.ts'

describe('固定地图变体与朝向匹配 (Issue #42)', () => {
  test('解析变体方向标识符', () => {
    expect(variantOrientation({ label: '1-act-1-town-townn1' })).toBe('north')
    expect(variantOrientation({ label: '1-act-1-town-towne1' })).toBe('east')
    expect(variantOrientation({ label: '1-act-1-town-towns1' })).toBe('south')
    expect(variantOrientation({ label: '1-act-1-town-townw1' })).toBe('west')

    expect(variantOrientation({ ds1: 'data\\global\\tiles\\Act2\\Town\\LutN.ds1' })).toBe('north')
    expect(variantOrientation({ ds1: 'data\\global\\tiles\\Act2\\Town\\LutW.ds1' })).toBe('west')

    expect(variantOrientation({ label: '27-act-1-courtyard-1-courte' })).toBe('east')
    expect(variantOrientation({ label: '27-act-1-courtyard-1-courtn' })).toBe('north')
    expect(variantOrientation({ label: '27-act-1-courtyard-1-courtw' })).toBe('west')

    expect(variantOrientation({ label: '8-act-1-cave-1-var1' })).toBeUndefined()
  })

  test('朝向互逆函数计算', () => {
    expect(oppositeSide('north')).toBe('south')
    expect(oppositeSide('south')).toBe('north')
    expect(oppositeSide('east')).toBe('west')
    expect(oppositeSide('west')).toBe('east')
  })

  test('依据相邻区域出口朝向自动匹配互逆的城镇变体', () => {
    const act1TownVariants = [
      { label: '1-act-1-town-townn1', levelId: 1 },
      { label: '1-act-1-town-towne1', levelId: 1 },
      { label: '1-act-1-town-towns1', levelId: 1 },
      { label: '1-act-1-town-townw1', levelId: 1 },
    ]

    // 鲜血荒地（Level 2）在北侧大门离开（fromSide: 'north'），进入城镇要求城镇出口在南侧（'south'）
    const matchedSouth = findMatchingVariant(act1TownVariants, oppositeSide('north'))
    expect(matchedSouth?.label).toBe('1-act-1-town-towns1')

    // 若鲜血荒地在西侧大门离开（fromSide: 'west'），进入城镇要求城镇出口在东侧（'east'）
    const matchedEast = findMatchingVariant(act1TownVariants, oppositeSide('west'))
    expect(matchedEast?.label).toBe('1-act-1-town-towne1')

    // 鲁高因（Level 40）变体匹配
    const act2TownVariants = [
      { label: '40-act-2-town-lutw', ds1: 'LutW.ds1', levelId: 40 },
      { label: '40-act-2-town-lutn', ds1: 'LutN.ds1', levelId: 40 },
    ]

    // 碎石荒地在南侧离开（fromSide: 'south'），进入鲁高因要求北门（'north'）
    const matchedLutN = findMatchingVariant(act2TownVariants, oppositeSide('south'))
    expect(matchedLutN?.label).toBe('40-act-2-town-lutn')
  })

  test('默认城镇变体与生成预置缝合对齐', () => {
    const act1TownVariants = [
      { label: '1-act-1-town-townn1', slug: '1-act-1-town', act: 1 },
      { label: '1-act-1-town-towne1', slug: '1-act-1-town', act: 1 },
      { label: '1-act-1-town-towns1', slug: '1-act-1-town', act: 1 },
      { label: '1-act-1-town-townw1', slug: '1-act-1-town', act: 1 },
    ]

    // Act 1 鲜血荒地默认采用 Town S Transition（在荒地北边界），因此默认城镇应选择 TownS1
    const defaultAct1 = getDefaultTownVariant(act1TownVariants, 1)
    expect(defaultAct1?.label).toBe('1-act-1-town-towns1')

    const act2TownVariants = [
      { label: '40-act-2-town-lutw', slug: '40-act-2-town', act: 2 },
      { label: '40-act-2-town-lutn', slug: '40-act-2-town', act: 2 },
    ]
    // Act 2 碎石荒地默认在南边界衔接城镇，因此默认鲁高因应选择 LutN
    const defaultAct2 = getDefaultTownVariant(act2TownVariants, 2)
    expect(defaultAct2?.label).toBe('40-act-2-town-lutn')
  })
})

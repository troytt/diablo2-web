import { describe, expect, it } from 'vitest'
import { characterBuild, describeBuild } from '../../src/common/items/character-build.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { appraiseItem, type AppraisalContext } from '../../src/common/items/loot-appraisal.ts'
import { runewordsFor } from '../../src/common/items/runeword-advice.ts'
import type { ItemData } from '../../src/netproto/index.ts'

const uniqueId = (name: string): number => getEmbeddedDropTables().uniques.all.find((u) => u.index === name)!.id
const item = (fields: Partial<ItemData> & { readonly code: string }): ItemData =>
  ({ id: 1, itemId: 1, rawCode: fields.code, quality: 2, identified: false, stats: [], runewordStats: [], setBonusStats: [], totalSockets: 0, usedSockets: 0, socketedChildCount: 0, runeword: false, invWidth: 1, invHeight: 1, bodyLoc: 0, equippedSlot: 0, flags: 0, rawFlags: 0, container: 'ground', ...fields }) as ItemData

const coldSorc = characterBuild({ classIndex: 1, level: 30, strength: 40, dexterity: 30, skillPoints: new Map([[39, 5], [45, 1], [59, 10], [64, 8]]) })
const zealot = characterBuild({ classIndex: 3, level: 40, strength: 90, dexterity: 70, skillPoints: new Map([[106, 20], [122, 15]]) })
const bowazon = characterBuild({ classIndex: 0, level: 50, strength: 80, dexterity: 120, skillPoints: new Map([[26, 20], [6, 5], [12, 10]]) })
const skeleMancer = characterBuild({ classIndex: 2, level: 25, strength: 30, dexterity: 30, skillPoints: new Map([[70, 15], [69, 5]]) })
const context = (build = coldSorc, extra: Partial<AppraisalContext> = {}): AppraisalContext => ({ build, equipped: [], owned: [], ...extra })

describe('character build', () => {
  it('reads the play style and elements from where the skill points went', () => {
    expect(describeBuild(coldSorc)).toBe('cold caster Sorceress')
    expect(describeBuild(zealot)).toBe('melee Paladin')
    expect([describeBuild(bowazon), bowazon.weaponKind]).toEqual(['ranged Amazon', 'bow'])
    expect(describeBuild(skeleMancer)).toBe('summoner Necromancer')
    expect(characterBuild({ classIndex: 4, level: 1, strength: 30, dexterity: 20, skillPoints: new Map() }).style).toBe('melee')
  })

  it('suggests runewords that suit the build', () => {
    const names = (build = coldSorc) => runewordsFor(build).map((rw) => rw.name)
    expect(names()).toContain('Spirit')
    expect(names()).not.toContain('Harmony')
    expect(names(bowazon)).toContain('Harmony')
    expect(names(zealot)).not.toContain('Harmony')
    expect(runewordsFor(coldSorc).find((rw) => rw.name === 'Insight')?.forMerc).toBe(true)
  })
})

describe('keeping only what the character will use', () => {
  const helm = (id: number, life: number) => item({ id, code: 'cap', quality: 4, identified: true, stats: [{ statId: 7, param: 0, value: life }] })

  it('treats only the best carried piece for a slot as the upgrade', () => {
    const [weak, strong] = [helm(10, 20), helm(11, 40)]
    const ctx = context(coldSorc, { carried: [weak, strong], owned: [weak, strong] })
    expect(appraiseItem(strong, ctx).upgradeSlot).toBe('helm')
    expect(appraiseItem(weak, ctx).upgradeSlot).toBeUndefined()
  })

  it('keeps one runeword base, not every match', () => {
    const [first, second] = [item({ id: 20, code: 'crs', totalSockets: 4 }), item({ id: 21, code: 'crs', totalSockets: 4 })]
    expect(appraiseItem(second, context(coldSorc, { owned: [first, second] })).tier).toBe('junk')
    expect(appraiseItem(first, context(coldSorc, { owned: [first, second] })).tier).toBe('good')
    expect(appraiseItem(item({ id: 22, code: 'crs', totalSockets: 4 }), context(coldSorc, { owned: [first] })).tier).toBe('junk')
  })
})

describe('loot appraisal', () => {
  it('tracks runeword progress for runes the character can use', () => {
    expect(appraiseItem(item({ code: 'r07' }), context(coldSorc, { owned: [item({ code: 'r10' }), item({ code: 'r09' })] }))).toMatchObject({ tier: 'good', reason: 'For Spirit · 3/4 runes' })
    expect(appraiseItem(item({ code: 'r11' }), context(coldSorc, { owned: [item({ code: 'r07' }), item({ code: 'r10' }), item({ code: 'r09' })] }))).toMatchObject({ tier: 'great', reason: 'For Spirit · 4/4 runes' })
    expect(appraiseItem(item({ code: 'r31' }), context())).toMatchObject({ tier: 'great' })
    expect(['r01', 'r03'].map((code) => appraiseItem(item({ code }), context({ ...coldSorc, level: 70 })).tier)).toEqual(['junk', 'junk'])
  })

  it("keeps a good imbue base only while Charsi's reward is waiting", () => {
    const crown = item({ code: 'xrn', identified: true, invWidth: 2, invHeight: 2 })
    expect(appraiseItem(crown, context(coldSorc, { imbueReady: true }))).toMatchObject({ tier: 'keep', reason: "Good base for Charsi's imbue" })
    expect(appraiseItem(crown, context()).tier).toBe('junk')
    expect(appraiseItem(item({ code: 'cap', identified: true }), context(coldSorc, { imbueReady: true })).tier).toBe('junk')
    expect(appraiseItem(item({ code: 'xrn', identified: true, totalSockets: 2 }), context(coldSorc, { imbueReady: true })).tier).toBe('junk')
  })

  it('says where a gem helps most', () => {
    expect(appraiseItem(item({ code: 'gpw' }), context())).toMatchObject({ tier: 'good', kind: 'gem', reason: 'In your shield: All Resistances +19' })
    expect(appraiseItem(item({ code: 'skz' }), context(zealot)).reason).toContain('In your weapon')
    expect(appraiseItem(item({ code: 'gcr' }), context()).tier).toBe('junk')
  })

  it('values unidentified uniques by their known stats and fame', () => {
    expect(appraiseItem(item({ code: 'uap', quality: 7, uniqueItemId: uniqueId('Harlequin Crest') }), context())).toMatchObject({ tier: 'great', reason: 'Sought-after find' })
    const lateSorc = { ...coldSorc, level: 70 }
    expect(appraiseItem(item({ code: 'hax', quality: 7, uniqueItemId: uniqueId('The Gnasher') }), context(lateSorc))).toMatchObject({ tier: 'junk', reason: 'Outgrown' })
    expect(appraiseItem(item({ code: 'hax', quality: 7, uniqueItemId: uniqueId('The Gnasher') }), context({ ...zealot, level: 12 })).tier).not.toBe('junk')
  })

  it('compares identified gear with what the character wears', () => {
    const wornHelm = item({ id: 5, code: 'cap', quality: 4, identified: true, bodyLoc: 1, container: 'equipment', stats: [{ statId: 7, param: 0, value: 10 }] })
    const better = item({ code: 'skp', quality: 6, identified: true, stats: [{ statId: 83, param: 1, value: 2 }, { statId: 105, param: 0, value: 20 }] })
    const judged = appraiseItem(better, context(coldSorc, { equipped: [wornHelm] }))
    expect(judged).toMatchObject({ tier: 'great', upgradeSlot: 'helm' })
    expect(judged.reason).toContain('Upgrade for your helm')
    const worse = item({ code: 'cap', quality: 4, identified: true, stats: [{ statId: 7, param: 0, value: 3 }] })
    expect(appraiseItem(worse, context(coldSorc, { equipped: [wornHelm] })).tier).toBe('junk')
  })

  it('knows class items, skillers and runeword bases', () => {
    expect(appraiseItem(item({ code: 'ob1', quality: 4 }), context()).tier).toBe('keep')
    expect(appraiseItem(item({ code: 'ne1', quality: 4 }), context())).toMatchObject({ tier: 'junk', reason: 'Made for another class' })
    expect(appraiseItem(item({ code: 'cm3', quality: 4, identified: true, stats: [{ statId: 188, param: (1 << 3) | 2, value: 1 }] }), context())).toMatchObject({ tier: 'great', reason: '+1 to your Cold Spells', locked: true })
    expect(appraiseItem(item({ code: 'crs', totalSockets: 4 }), context())).toMatchObject({ tier: 'good', reason: 'Base for Spirit · 4 sockets' })
    expect(appraiseItem(item({ code: 'crs' }), context()).tier).toBe('junk')
  })

  it('never offers supplies, quest items or gold up for clearing out', () => {
    expect(['hp5', 'tbk', 'key', 'gld', 'bks'].map((code) => appraiseItem(item({ code }), context()).locked)).toEqual([true, true, true, true, true])
  })
})

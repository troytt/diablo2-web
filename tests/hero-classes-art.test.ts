import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HERO_SPECS } from '../src/baker/packers/pack-characters.ts'
import { HERO_CLASSES, normalizeHeroToken } from '../src/common/world/scene-population.ts'

describe('7 Playable Character Classes Artwork & Selection Parity', () => {
  const packRoot = join(process.cwd(), 'public', 'packs')
  const globalDir = join(process.cwd(), 'public', 'entities')
  const hasGlobalEntities = existsSync(globalDir)
  const hasActEntityPngs = existsSync(join(packRoot, 'act1', 'entities', 'char-so.png'))

  it('verifies all 7 hero classes are defined in HERO_CLASSES with 1.13c ground truth stats', () => {
    expect(HERO_SPECS).toHaveLength(7)
    for (const spec of HERO_SPECS) {
      const hero = HERO_CLASSES[spec.token]
      expect(hero).toBeDefined()
      expect(hero.token).toBe(spec.token)
      expect(hero.code).toBe(spec.code)
      expect(hero.nameZh).toBe(spec.nameZh)
      expect(hero.nameEn).toBe(spec.nameEn)
      expect(hero.charIdentity.str).toBeGreaterThan(0)
      expect(hero.charIdentity.dex).toBeGreaterThan(0)
      expect(hero.charIdentity.vit).toBeGreaterThan(0)
      expect(hero.charIdentity.ene).toBeGreaterThan(0)
      expect(hero.charIdentity.baseMaxHp).toBeGreaterThan(0)
      expect(hero.charIdentity.baseMaxMana).toBeGreaterThan(0)
      expect(hero.defaultLeftSkill).toBeGreaterThanOrEqual(0)
      expect(hero.defaultRightSkill).toBeGreaterThanOrEqual(0)
    }
  })

  it('normalizes various class identifiers (token, code, names, aliases) correctly', () => {
    // Sorceress
    expect(normalizeHeroToken('so')).toBe('so')
    expect(normalizeHeroToken('sor')).toBe('so')
    expect(normalizeHeroToken('Sorceress')).toBe('so')
    expect(normalizeHeroToken('sorceress')).toBe('so')
    expect(normalizeHeroToken('SO')).toBe('so')

    // Amazon
    expect(normalizeHeroToken('am')).toBe('am')
    expect(normalizeHeroToken('ama')).toBe('am')
    expect(normalizeHeroToken('Amazon')).toBe('am')

    // Necromancer
    expect(normalizeHeroToken('ne')).toBe('ne')
    expect(normalizeHeroToken('nec')).toBe('ne')
    expect(normalizeHeroToken('Necromancer')).toBe('ne')

    // Paladin
    expect(normalizeHeroToken('pa')).toBe('pa')
    expect(normalizeHeroToken('pal')).toBe('pa')
    expect(normalizeHeroToken('Paladin')).toBe('pa')

    // Barbarian
    expect(normalizeHeroToken('ba')).toBe('ba')
    expect(normalizeHeroToken('bar')).toBe('ba')
    expect(normalizeHeroToken('Barbarian')).toBe('ba')

    // Druid (both canonical 'dz' and common alias 'dr')
    expect(normalizeHeroToken('dz')).toBe('dz')
    expect(normalizeHeroToken('dru')).toBe('dz')
    expect(normalizeHeroToken('dr')).toBe('dz')
    expect(normalizeHeroToken('Druid')).toBe('dz')

    // Assassin (both canonical 'ai' and common alias 'as')
    expect(normalizeHeroToken('ai')).toBe('ai')
    expect(normalizeHeroToken('ass')).toBe('ai')
    expect(normalizeHeroToken('as')).toBe('ai')
    expect(normalizeHeroToken('Assassin')).toBe('ai')

    // Unknown fallback to 'so'
    expect(normalizeHeroToken('unknown')).toBe('so')
    expect(normalizeHeroToken('')).toBe('so')
  })

  it.skipIf(!hasGlobalEntities)('validates global Schema 2 raw R8 textures for all 7 hero classes', () => {
    for (const spec of HERO_SPECS) {
      const jsonPath = join(globalDir, `char-${spec.token}.json`)
      const r8Path = join(globalDir, `char-${spec.token}.r8`)

      expect(existsSync(jsonPath), `missing json for ${spec.token}`).toBe(true)
      expect(existsSync(r8Path), `missing r8 for ${spec.token}`).toBe(true)

      const meta = JSON.parse(readFileSync(jsonPath, 'utf8'))
      expect(meta.schema).toBe(2)
      expect(meta.file).toBe(`char-${spec.token}.r8`)
      expect(meta.format).toBe('r8')
      expect(meta.directions).toBe(16)
      expect([0, 8, 10]).toContain(meta.walk)
      expect(meta.walkOffset).toBe(0)
      expect(meta.standOffset).toBe(16)
      expect(meta.members).toBeGreaterThanOrEqual(14)
      // All 18 player modes baked from 1.13c MPQs (ba and ai have 17 modes * 16 dirs = 272 groups; others have 15 modes * 16 dirs = 240 groups)
      const expectedGroups = spec.token === 'ba' || spec.token === 'ai' ? 272 : 240
      expect(meta.groups.length).toBe(expectedGroups)

      // Standard player modes present
      expect(meta.clips).toBeDefined()
      expect(meta.clips.nu).toBeDefined()
      expect(meta.clips.wl).toBeDefined()
      expect(meta.clips.rn).toBeDefined()
      expect(meta.clips.a1).toBeDefined()
      expect(meta.clips.gh).toBeDefined()
      expect(meta.clips.dt).toBeDefined()

      const r8 = readFileSync(r8Path)
      expect(r8.byteLength).toBe(meta.width * meta.height)

      let nonZero = 0
      for (let i = 0; i < r8.length; i += 1) {
        if (r8[i] !== 0) nonZero += 1
      }
      expect(nonZero).toBeGreaterThan(0)
    }
  })

  it.skipIf(!hasActEntityPngs)('validates per-Act fallback PNG atlases for all 7 hero classes across Acts 1..5', () => {
    for (let act = 1; act <= 5; act += 1) {
      const actDir = join(packRoot, `act${act}`, 'entities')
      for (const spec of HERO_SPECS) {
        const jsonPath = join(actDir, `char-${spec.token}.json`)
        const pngPath = join(actDir, `char-${spec.token}.png`)

        expect(existsSync(jsonPath), `missing act${act} json for ${spec.token}`).toBe(true)
        expect(existsSync(pngPath), `missing act${act} png for ${spec.token}`).toBe(true)

        const meta = JSON.parse(readFileSync(jsonPath, 'utf8'))
        expect(meta.schema).toBe(2)
        expect(meta.file).toBe(`char-${spec.token}.png`)
        expect(meta.directions).toBe(16)
        const expectedGroups = spec.token === 'ai' ? 160 : 176
        expect(meta.groups.length).toBe(expectedGroups)

        const png = readFileSync(pngPath)
        expect(png[0]).toBe(137)
        expect(png[1]).toBe(80) // P
        expect(png[2]).toBe(78) // N
        expect(png[3]).toBe(71) // G
      }
    }
  })
})

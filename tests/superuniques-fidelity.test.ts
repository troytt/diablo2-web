import { describe, expect, test } from 'vitest'
import {
  readSuperUniques,
  CANONICAL_SUPERUNIQUES_TABLE,
  CANONICAL_SUPER_UNIQUE_LANDMARKS,
  CANONICAL_SUPER_UNIQUES_BY_LEVEL,
} from '../src/common/units/monsters-data.ts'
import {
  MONSTER_ART_MAP,
  resolveMonsterArtSpec,
} from '../src/common/units/monster-mapping.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { parseTable } from '../src/common/world/acts.ts'

describe('SuperUniques Fidelity & Art Packaging (Issue #115)', () => {
  const d2DataDir = process.env.D2_DATA_DIR ?? 'samples/d2'

  test('CANONICAL_SUPER_UNIQUE_LANDMARKS contains valid and corrected minion IDs', () => {
    // 10 previously mistyped minions must match correct IDs
    const landmarkMap = new Map(CANONICAL_SUPER_UNIQUE_LANDMARKS.map(l => [l.id, l]))

    expect(landmarkMap.get('Beetleburst')?.minionMonsterId).toBe('scarab2')
    expect(landmarkMap.get('Dark Elder')?.minionMonsterId).toBe('zombie5')
    expect(landmarkMap.get('Bloodwitch the Wild')?.minionMonsterId).toBe('pantherwoman1')
    expect(landmarkMap.get('Sszark the Burning')?.minionMonsterId).toBe('arach4')
    expect(landmarkMap.get('Witch Doctor Endugu')?.minionMonsterId).toBe('fetish4')
    expect(landmarkMap.get('Battlemaid Sarina')?.minionMonsterId).toBe('corruptrogue5')
    expect(landmarkMap.get('Dac Farren')?.minionMonsterId).toBe('imp3')
    expect(landmarkMap.get('Shenk the Overseer')?.minionMonsterId).toBe('minion1')
    expect(landmarkMap.get('Frozenstein')?.minionMonsterId).toBe('snowyeti4')
    expect(landmarkMap.get('Nihlathak')?.minionMonsterId).toBe('minion6')
  })

  test('CANONICAL_SUPERUNIQUES_TABLE parses with corrected Class entries', () => {
    const parsed = readSuperUniques(CANONICAL_SUPERUNIQUES_TABLE)
    const map = new Map(parsed.map(p => [p.id, p]))

    expect(map.get('Beetleburst')?.monsterId).toBe('scarab2')
    expect(map.get('Dark Elder')?.monsterId).toBe('zombie5')
    expect(map.get('Bloodwitch the Wild')?.monsterId).toBe('pantherwoman1')
    expect(map.get('Sszark the Burning')?.monsterId).toBe('arach4')
    expect(map.get('Witch Doctor Endugu')?.monsterId).toBe('fetishshaman4')
    expect(map.get('Battlemaid Sarina')?.monsterId).toBe('corruptrogue5')
    expect(map.get('Dac Farren')?.monsterId).toBe('imp3')
    expect(map.get('Frozenstein')?.monsterId).toBe('snowyeti4')
  })

  test('MONSTER_ART_MAP correctly maps critical SuperUnique boss tokens for each Act', () => {
    // Act 1: Griswold (GZ), The Smith (5P)
    expect(MONSTER_ART_MAP.griswold?.token).toBe('GZ')
    expect(MONSTER_ART_MAP.smith?.token).toBe('5P')

    // Act 2: Radament (RD), Coldworm (MQ), The Summoner (SU)
    expect(MONSTER_ART_MAP.radament?.token).toBe('RD')
    expect(MONSTER_ART_MAP.maggotqueen1?.token).toBe('MQ')
    expect(MONSTER_ART_MAP.summoner?.token).toBe('SU')

    // Act 3: High Council members (HP)
    expect(MONSTER_ART_MAP.councilmember1?.token).toBe('HP')
    expect(MONSTER_ART_MAP.councilmember2?.token).toBe('HP')
    expect(MONSTER_ART_MAP.councilmember3?.token).toBe('HP')

    // Act 4: Hephasto the Armorer (5P)
    expect(MONSTER_ART_MAP.hephasto?.token).toBe('5P')

    // Act 5: Nihlathak (XU), Baal Subject 5 (43)
    expect(MONSTER_ART_MAP.nihlathakboss?.token).toBe('XU')
    expect(MONSTER_ART_MAP.baalminion1?.token).toBe('43')
  })

  test('All 66 SuperUniques in game data verify boss class and minion resolution', async () => {
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      try {
        const archive = await MpqArchive.open(await fileSource(`${d2DataDir}/${name}`))
        archives.add(name, archive)
      } catch {
        // If data dir unavailable in test runner, skip archive loading portion
        return
      }
    }

    const suData = await archives.read('data\\global\\excel\\SuperUniques.txt')
    const suTable = parseTable(suData)
    const superUniques = readSuperUniques(suTable)

    expect(superUniques.length).toBe(66)

    for (const su of superUniques) {
      expect(su.id).toBeTruthy()
      expect(su.monsterId).toBeTruthy()

      // Boss class must resolve to an authentic art spec (including minion1 -> token 'XX')
      const bossArt = resolveMonsterArtSpec(su.monsterId)
      expect(bossArt).not.toBeNull()
      expect(bossArt?.token).toBeTruthy()
      if (su.monsterId === 'minion1') {
        expect(bossArt).toEqual({ token: 'XX', weapon: 'hth' })
      } else {
        expect(bossArt?.token.toLowerCase()).not.toBe('xx')
      }
    }
  })

  test('Act 5 Minion of Destruction (minion1..11) resolve to token XX while unknown/empty IDs resolve to null', () => {
    // minion1..minion11 have authentic D2exp.mpq art under data\global\monsters\XX\
    for (let i = 1; i <= 11; i += 1) {
      const art = resolveMonsterArtSpec(`minion${i}`)
      expect(art).toEqual({ token: 'XX', weapon: 'hth' })
    }
    // Unknown or empty IDs
    expect(resolveMonsterArtSpec('xx')).toBeNull()
    expect(resolveMonsterArtSpec('')).toBeNull()
  })

  test('CANONICAL_SUPER_UNIQUES_BY_LEVEL builds without undefined errors', () => {
    expect(Object.keys(CANONICAL_SUPER_UNIQUES_BY_LEVEL).length).toBeGreaterThan(0)
    for (const [lvl, specOrSpecs] of Object.entries(CANONICAL_SUPER_UNIQUES_BY_LEVEL)) {
      const specs = Array.isArray(specOrSpecs) ? specOrSpecs : [specOrSpecs]
      for (const s of specs) {
        expect(s.id).toBeTruthy()
        expect(s.monsterId).toBeTruthy()
        expect(s.minionMonsterId).toBeTruthy()
      }
    }
  })
})

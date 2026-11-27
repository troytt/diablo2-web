import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  D2LANG_NO_EXPANSION_FALLBACK_INDEX,
  D2LANG_NOT_XLATED_SUFFIX,
  D2LANG_OUT_OF_RANGE_FALLBACK_INDEX,
  decodeTbl,
  lookupTbl113c,
  lookupTblByIndex113c,
  lookupTblFast,
  TblError,
  tblHash,
  tblLookup,
} from '../src/common/formats/tbl.ts'
import { requireTbl } from '../src/client/i18n/lang.ts'
import { resolveTblKey } from '../src/common/data/canonical-tbl-strings.ts'
import { encodeTbl } from '../src/baker/io/tbl-writer.ts'
import type { TblEntry } from '../src/baker/io/tbl-writer.ts'
import {
  decodeLevelNamesFromTbl,
  setActiveLevelNames,
  sceneNameZh,
  LEVEL_NAMES_ZH,
} from '../src/common/world/level-names-zh.ts'
import type { D2Table } from '../src/common/world/acts.ts'

const fixturePath = join(__dirname, '../samples/fixtures/tbl/patchstring_113c_eng.tbl')
const fixtureData = readFileSync(fixturePath)

describe('TBL Decoder', () => {
  test('Header parse and Layout invariant', () => {
    const data = fixtureData
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const crc = view.getUint16(0, true)
    const numElements = view.getUint16(2, true)
    const hashTableSize = view.getUint32(4, true)
    const version = view.getUint8(8)
    const stringOffset = view.getUint32(9, true)
    const maxTries = view.getUint32(13, true)
    const fileSize = view.getUint32(17, true)
    
    expect(crc).toBe(23974)
    expect(numElements).toBe(1169)
    expect(hashTableSize).toBe(1171)
    expect(version).toBe(1)
    expect(stringOffset).toBe(22266)
    expect(maxTries).toBe(1058)
    expect(fileSize).toBe(52523)
    
    expect(21 + numElements * 2 + hashTableSize * 17).toBe(stringOffset)
    expect(fileSize).toBe(data.byteLength)
  })

  test('Entry count and dictionary', () => {
    const decoded = decodeTbl(fixtureData)
    let count = 0; decoded.forEach(v => { if (v !== undefined) count++ }); expect(count).toBe(1169)
  })

  test('Known strings', () => {
    const decoded = decodeTbl(fixtureData)
    expect(decoded.dict.get('Party1X')).toBe('%s permits you to loot his corpse.')
    expect(decoded.dict.get('D2bnetHelp16b')).toBe('/unignore <*accountname>')
    expect(decoded.dict.get('skillxld66')).toBe(' ')
  })
  
  test('Fast lookup matches full decode', () => {
    expect(lookupTblFast(fixtureData, 'Party1X')).toBe('%s permits you to loot his corpse.')
    expect(lookupTblFast(fixtureData, 'D2bnetHelp16b')).toBe('/unignore <*accountname>')
    expect(lookupTblFast(fixtureData, 'skillxld66')).toBe(' ')
  })

  test('Hash self-check', () => {
    const data = fixtureData
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const numElements = view.getUint16(2, true)
    const hashTableSize = view.getUint32(4, true)
    
    const nodesStart = 21 + numElements * 2
    let checkedCount = 0
    
    for (let i = 0; i < hashTableSize; i++) {
        const base = nodesStart + i * 17
        const isActive = view.getUint8(base)
        if (!isActive) continue
        
        const hashValue = view.getUint32(base + 3, true)
        const keyOffset = view.getUint32(base + 7, true)
        
        let end = keyOffset
        while (data[end] !== 0) end++
        const keyBuf = data.subarray(keyOffset, end)
        
        const computed = tblHash(keyBuf, hashTableSize)
        expect(computed).toBe(hashValue)
        
        checkedCount++
    }
    
    expect(checkedCount).toBe(1169)
  })

  test('Round-trip encoding', () => {
    const entries: TblEntry[] = [
      { key: "Stamina Potion", value: "Stamina Potion" },
      { key: "Empty", value: "" },
      null,
      { key: "Tome", value: "Tome of Town Portal" },
      null,
      { key: "CJK", value: "完美宝石" },
      { key: "Latin", value: "Straße" },
      null,
      { key: "Emoji", value: "🌀 Emoji beyond the BMP" },
      { key: "Long", value: 'x'.repeat(300) },
    ]
    
    // Add enough entities to force collisions
    for (let i = 0; i < 200; i++) {
      entries.push({ key: `CollC${i}`, value: `ValC${i}` })
    }
    
    // Duplicate-ish keys differing by case
    entries.push({ key: "Apple", value: "Uppercase" })
    entries.push({ key: "apple", value: "Lowercase" })
    
    const encoded = encodeTbl(entries)
    const decoded = decodeTbl(encoded, 'utf-8')
    
    expect(decoded.dict.get("Empty")).toBe("")
    expect(decoded.dict.get("Latin")).toBe("Straße")
    expect(decoded.dict.get("CJK")).toBe("完美宝石")
    expect(decoded.dict.get("Apple")).toBe("Uppercase")
    expect(decoded.dict.get("apple")).toBe("Lowercase")
    expect(decoded.dict.get("CollC199")).toBe("ValC199")
    
    // Also test fast lookup
    expect(lookupTblFast(encoded, "Latin", "utf-8")).toBe("Straße")
  })

  test('Malformed input: truncated buffer', () => {
    const shortBuf = new Uint8Array(20)
    expect(() => decodeTbl(shortBuf)).toThrowError(TblError)
    expect(() => decodeTbl(shortBuf)).toThrowError(/too short/)
  })

  test('Malformed input: stringOffset past EOF', () => {
    const buf = new Uint8Array(fixtureData)
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    // Make stringOffset larger than file length
    view.setUint32(9, buf.length + 10, true)
    
    expect(() => decodeTbl(buf)).toThrowError(TblError)
    expect(() => decodeTbl(buf)).toThrowError(/stringOffset/)
  })

  test('Malformed input: node offset out of range', () => {
    const buf = new Uint8Array(fixtureData)
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    
    // Get the first active node and corrupt its key offset
    const numElements = view.getUint16(2, true)
    const nodesStart = 21 + numElements * 2
    view.setUint32(nodesStart + 7, buf.length + 5, true) // key offset is at +7
    
    expect(() => decodeTbl(buf)).toThrowError(TblError)
    expect(() => decodeTbl(buf)).toThrowError(/keyOffset/)
  })

  test('tblHash sign-extends bytes >= 0x80 and lookupTblFast skips inactive slots without checking stored hash (Issue #1744, D2Lang.dll 0x6FC08FE0 & 0x6FC09360)', () => {
    // 1. D2Lang.dll 0x6FC08FF0: movsx ecx, cl on byte 0x80 (-128):
    // Step 0: h = ((0 << 4) + (-128)) >>> 0 = 0xFFFFFF80; high = 0xF0000000 (high >>> 24 = 0xF0) -> (0xFFFFFF80 ^ 0xF0) & 0x0FFFFFFF = 0x0FFFFF70 (vs unsigned 0x80 -> 128)
    const highByteKey = new Uint8Array([0x80])
    expect(tblHash(highByteKey, 1000)).toBe(0x0fffff70 % 1000)

    // 2. D2Lang.dll 0x6FC09360: probe loop skips unused slots (isActive !== 1) and compares key by strcmp without checking stored nodeHash
    const encoded = encodeTbl([
      { key: 'AlphaKey', value: 'First' },
      { key: 'BetaKey', value: 'Second' },
    ])
    const view = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength)
    const numElements = view.getUint16(2, true)
    const hashTableSize = view.getUint32(4, true)
    const nodesStart = 21 + numElements * 2

    // Locate the active node for 'BetaKey', move it 1 slot forward past an inactive (0) slot, and overwrite its stored nodeHash
    const betaHash = tblHash(new TextEncoder().encode('BetaKey'), hashTableSize)
    const origBase = nodesStart + betaHash * 17
    const nextBucket = (betaHash + 1) % hashTableSize
    const nextBase = nodesStart + nextBucket * 17
    // Ensure maxTries >= 2 so probing reaches nextBucket
    view.setUint32(13, Math.max(2, view.getUint32(13, true)), true)
    encoded.copyWithin(nextBase, origBase, origBase + 17)
    encoded.fill(0, origBase, origBase + 17) // origBucket is now inactive (isActive = 0)
    view.setUint32(nextBase + 3, 0xdeadbeef, true) // corrupt stored nodeHash at +3

    expect(lookupTblFast(encoded, 'BetaKey', 'utf-8')).toBe('Second')
  })

  test('out-of-range string indices fall back to entry 500 and missing expansion rewrites >=20000 to 11078 (Issue #1742, D2Lang.dll 0x6FC09050 & 0x6FC09450)', () => {
    const decoded = decodeTbl(fixtureData)
    const lookup = tblLookup(decoded)
    expect(D2LANG_OUT_OF_RANGE_FALLBACK_INDEX).toBe(500)
    expect(D2LANG_NO_EXPANSION_FALLBACK_INDEX).toBe(11078)
    expect(decoded[500]).toBe(' ')
    expect(lookup.get(9999)).toBe(decoded[500])

    const strTable = new Array<string | undefined>(600)
    strTable[10] = 'Base10'
    strTable[500] = 'AshearaGossip9'
    const patchTable = decoded
    const expTable = new Array<string | undefined>(600)
    expTable[500] = 'Ith'

    expect(lookupTblByIndex113c(9999, { string: strTable, patch: patchTable, expansion: expTable })).toBe(
      'AshearaGossip9',
    )
    expect(lookupTblByIndex113c(19999, { string: strTable, patch: patchTable, expansion: expTable })).toBe(
      patchTable[500],
    )
    expect(lookupTblByIndex113c(29999, { string: strTable, patch: patchTable, expansion: expTable })).toBe('Ith')
    expect(lookupTblByIndex113c(22747, { string: strTable, patch: patchTable, expansion: null })).toBe(
      patchTable[1078],
    )

    expect(resolveTblKey('expansionstring#500', 'ENG')).toBe('Ith')
    expect(resolveTblKey('expansionstring#99999', 'ENG')).toBe('Ith')
    expect(resolveTblKey('string#99999', 'ENG')).toBe(resolveTblKey('string#500', 'ENG'))
    expect(resolveTblKey('patchstring#9999', 'ENG')).toBe(resolveTblKey('patchstring#500', 'ENG'))
  })

  test('exact key matching without trimming, whitespace-only CHI preservation, and "-not xlated call ken w" fallback (Issue #1743, D2Lang.dll 0x6FC0A7B0 & 0x6FC09FB0)', () => {
    expect(D2LANG_NOT_XLATED_SUFFIX).toBe(' -not xlated call ken w')
    // 1. Empty key returns ""
    expect(resolveTblKey('', 'ENG')).toBe('')
    expect(resolveTblKey('', 'CHI')).toBe('')
    expect(lookupTbl113c('', 'ENG')).toBe('')
    expect(requireTbl('', 'ENG')).toBe('')

    // 2. Keys with stray leading/trailing whitespace are NOT trimmed (exact strcmp per 0x6FC09360)
    expect(resolveTblKey('strClose', 'ENG')).toBeDefined()
    expect(resolveTblKey(' strClose ', 'ENG')).toBeUndefined()
    expect(lookupTbl113c(' strClose ', 'ENG')).toBe(' strClose  -not xlated call ken w')

    // 3. Whitespace-only CHI strings (e.g. patchstring#500 = " ") are preserved verbatim rather than substituted with ENG
    expect(resolveTblKey('patchstring#500', 'CHI')).toBe(' ')
    expect(lookupTbl113c('patchstring#500', 'CHI')).toBe(' ')

    // 4. Missing key returns "<key> -not xlated call ken w" in lookupTbl113c and requireTbl({ fallback113c: true })
    expect(lookupTbl113c('missingKey113c', 'ENG')).toBe('missingKey113c -not xlated call ken w')
    expect(requireTbl('missingKey113c', 'ENG', { fallback113c: true })).toBe(
      'missingKey113c -not xlated call ken w',
    )
  })
})

describe('decodeLevelNamesFromTbl', () => {
  test('decodes level names from Map<string, string> with graceful fallback', () => {
    const customZh = new Map<string, string>([
      ['Rogue Encampment', '萝格宿营地'],
      ['Blood Moor', '鲜血苔原'],
      ['Cathedral', '圣堂'],
    ])

    const names = decodeLevelNamesFromTbl(customZh)
    expect(names.get(1)).toBe('萝格宿营地')
    expect(names.get(2)).toBe('鲜血苔原')
    expect(names.get(33)).toBe('圣堂')
    // Fallback for untouched levels
    expect(names.get(3)).toBe(LEVEL_NAMES_ZH[3])
    expect(names.get(110)).toBe(LEVEL_NAMES_ZH[110])
  })

  test('decodes level names from DecodedTbl using encodeTbl round-trip', () => {
    const entries: TblEntry[] = [
      { key: 'Rogue Encampment', value: '罗格新营地' },
      { key: 'Cathedral', value: '宏伟教堂' },
      { key: 'Chaos Sanctuary', value: '混沌神殿' },
    ]
    const encoded = encodeTbl(entries)
    const decoded = decodeTbl(encoded, 'utf-8')

    const names = decodeLevelNamesFromTbl(decoded)
    expect(names.get(1)).toBe('罗格新营地')
    expect(names.get(33)).toBe('宏伟教堂')
    expect(names.get(108)).toBe('混沌神殿')
    // Level without custom string falls back to LEVEL_NAMES_ZH
    expect(names.get(2)).toBe(LEVEL_NAMES_ZH[2])
  })

  test('resolves level names using Levels.txt table structure', () => {
    const mockLevelsTable: D2Table = {
      header: ['Name', 'Id', 'LevelName'],
      rows: [
        ['Act 1 - Town', '1', 'Rogue Encampment'],
        ['Act 1 - Wilderness 1', '2', 'Blood Moor'],
        ['Act 1 - Cathedral 1', '33', 'Cathedral'],
        ['Custom Mod Level', '200', 'Modded Domain'],
      ],
    }

    const tblMap = new Map<string, string>([
      ['Rogue Encampment', '罗格营地(官方)'],
      ['Modded Domain', '模组领域'],
    ])

    const names = decodeLevelNamesFromTbl(tblMap, mockLevelsTable)
    expect(names.get(1)).toBe('罗格营地(官方)')
    expect(names.get(2)).toBe(LEVEL_NAMES_ZH[2]) // fallback to LEVEL_NAMES_ZH
    expect(names.get(33)).toBe(LEVEL_NAMES_ZH[33]) // fallback to LEVEL_NAMES_ZH
    expect(names.get(200)).toBe('模组领域') // custom mod row
  })

  test('falls back gracefully to LEVEL_NAMES_ZH or English key when tbl is empty or null', () => {
    const fromNull = decodeLevelNamesFromTbl(null)
    expect(fromNull.get(1)).toBe(LEVEL_NAMES_ZH[1])
    expect(fromNull.get(40)).toBe(LEVEL_NAMES_ZH[40])

    const fromEmpty = decodeLevelNamesFromTbl(new Map())
    expect(fromEmpty.get(1)).toBe(LEVEL_NAMES_ZH[1])
    expect(fromEmpty.get(75)).toBe(LEVEL_NAMES_ZH[75])
  })

  test('sceneNameZh works with active decoded level names and custom override', () => {
    try {
      setActiveLevelNames(new Map([[1, '罗格基地']]))
      expect(sceneNameZh('1-act-1-rogue-encampment', 'Rogue Encampment')).toBe('罗格基地')
      expect(sceneNameZh('2-act-1-blood-moor', 'Blood Moor')).toBe(LEVEL_NAMES_ZH[2])

      // Custom override in sceneNameZh
      expect(
        sceneNameZh('1-act-1-rogue-encampment', 'Rogue Encampment', new Map([[1, '营地覆盖']])),
      ).toBe('营地覆盖')
    } finally {
      setActiveLevelNames(null)
    }
  })
})


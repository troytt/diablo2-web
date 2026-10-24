import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeTbl, TblError, tblHash, lookupTblFast } from '../src/common/formats/tbl.ts'
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


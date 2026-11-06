/**
 * DT1 tile library loader and D2CMP.#10078..#10088 shims, matching
 * tools/d2moo-oracle/src/stubs.cpp 1:1.
 */

import { getD2SeedTraceSink } from '../rng/d2-rng.ts'
import { normalizeDrlgPath } from './drlg-source.ts'
import type { DrlgEnv } from './drlg-types.ts'

const DT1_HEADER_SIZE = 0x114
const DT1_TILE_HEADER_SIZE = 96
const TILE_SLOTS = 32

export interface D2TileLibraryEntryStrc {
  nLightDirection: number
  nRoofHeight: number
  nFlags: number
  nTotalHeight: number
  nWidth: number
  nHeightToBottom: number
  nType: number
  nStyle: number
  nSequence: number
  nRarity_Frame: number
  nSubtileFlags: Uint8Array
  /** Port identity (not a D2CMP field): normalized DT1 path of the owning library (= D2TileLibraryStrc.szPath). */
  readonly szLibrary: string
  /** Port identity (not a D2CMP field): index of this tile header inside its DT1 file. */
  readonly nIndex: number
}

export interface D2TileLibraryStrc {
  readonly szPath: string
  readonly tiles: readonly D2TileLibraryEntryStrc[]
}

function parseDt1Library(szPath: string, bytes: Uint8Array): D2TileLibraryStrc {
  if (bytes.byteLength < DT1_HEADER_SIZE) {
    throw new Error(`${szPath}: truncated DT1 header`)
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const nVersion1 = view.getInt32(0x00, true)
  const nVersion2 = view.getInt32(0x04, true)
  const nTiles = view.getInt32(0x10c, true)
  const nTileStart = view.getInt32(0x110, true)
  if (nVersion1 !== 7 || nVersion2 !== 6) {
    throw new Error(`${szPath}: unsupported DT1 version ${nVersion1}.${nVersion2}`)
  }
  if (nTiles < 0 || nTileStart < 0 || nTileStart + nTiles * DT1_TILE_HEADER_SIZE > bytes.byteLength) {
    throw new Error(`${szPath}: ${nTiles} tile headers at 0x${nTileStart.toString(16)} exceed the file`)
  }

  const tiles: D2TileLibraryEntryStrc[] = []
  for (let i = 0; i < nTiles; i += 1) {
    const nBase = nTileStart + i * DT1_TILE_HEADER_SIZE
    const nSubtileFlags = bytes.slice(nBase + 0x28, nBase + 0x28 + 25)
    tiles.push({
      nLightDirection: view.getInt32(nBase + 0x00, true),
      nRoofHeight: view.getUint16(nBase + 0x04, true),
      nFlags: view.getUint16(nBase + 0x06, true),
      nTotalHeight: view.getInt32(nBase + 0x08, true),
      nWidth: view.getInt32(nBase + 0x0c, true),
      nHeightToBottom: view.getInt32(nBase + 0x10, true),
      nType: view.getInt32(nBase + 0x14, true),
      nStyle: view.getInt32(nBase + 0x18, true),
      nSequence: view.getInt32(nBase + 0x1c, true),
      nRarity_Frame: view.getInt32(nBase + 0x20, true),
      nSubtileFlags,
      szLibrary: szPath,
      nIndex: i,
    })
  }
  return { szPath, tiles }
}

function loadTileLibrary(env: DrlgEnv, szFileName: string): D2TileLibraryStrc {
  const key = normalizeDrlgPath(szFileName)
  const cached = env.dt1Cache.get(key)
  if (cached) return cached
  const bytes = env.data.readFile(szFileName)
  const lib = parseDt1Library(key, bytes)
  env.dt1Cache.set(key, lib)
  return lib
}

//D2Cmp.#10087 (1.13c D2CMP.dll 0x6fe25480)
export function D2CMP_10087_LoadTileLibrarySlot(
  env: DrlgEnv,
  ppTileLibraryHash: D2TileLibraryStrc[],
  szFileName: string,
): void {
  const pLibrary = loadTileLibrary(env, szFileName)
  if (ppTileLibraryHash.length >= TILE_SLOTS) {
    throw new Error(`no free tile library slot for ${pLibrary.szPath}`)
  }
  ppTileLibraryHash.push(pLibrary)
}

//D2Cmp.#10088
export function D2CMP_10088_GetTiles(
  ppTileLibraryHash: readonly D2TileLibraryStrc[],
  nType: number,
  nStyle: number,
  nSequence: number,
  pTileList: D2TileLibraryEntryStrc[],
  nTileListSize: number,
): number {
  let nCount = 0
  let nRaritySum = 0
  for (let i = 0; i < ppTileLibraryHash.length && i < TILE_SLOTS; i += 1) {
    const pLib = ppTileLibraryHash[i]!
    for (let j = 0; j < pLib.tiles.length; j += 1) {
      const pTile = pLib.tiles[j]!
      if (pTile.nType !== nType || pTile.nStyle !== nStyle || pTile.nSequence !== nSequence) {
        continue
      }
      if (nCount >= nTileListSize) {
        throw new Error(`D2CMP_10088_GetTiles(${nType},${nStyle},${nSequence}): more than ${nTileListSize} matching tiles`)
      }
      pTileList[nCount] = pTile
      nCount += 1
      nRaritySum = (nRaritySum + pTile.nRarity_Frame) | 0
    }
  }
  const sink = getD2SeedTraceSink()
  if (sink && sink.tile) {
    sink.tile(nType, nStyle, nSequence, nCount, nRaritySum)
  }
  return nCount
}

//D2Cmp.#10078
export function D2CMP_10078_GetTileStyle(pTileLibraryEntry: D2TileLibraryEntryStrc): number {
  return pTileLibraryEntry.nStyle
}

//D2Cmp.#10079
export function D2CMP_10079_GetTileFlags(pTileLibraryEntry: D2TileLibraryEntryStrc): number {
  return pTileLibraryEntry.nFlags
}

//D2Cmp.#10081
export function D2CMP_10081_GetTileRarity(pTileLibraryEntry: D2TileLibraryEntryStrc): number {
  return pTileLibraryEntry.nRarity_Frame
}

//D2Cmp.#10082
export function D2CMP_10082_GetTileSequence(pTileLibraryEntry: D2TileLibraryEntryStrc): number {
  return pTileLibraryEntry.nSequence
}

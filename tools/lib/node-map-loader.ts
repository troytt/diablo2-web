import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
  PackedDrlgBundleManifest,
  PackedTileCatalogIndex,
} from '../../src/common/pack-contract/index.ts'
import { MapService, type PackedTileBundleAssets } from '../../src/client/map/map-service.ts'

export async function loadPackedTileBundleFromDir(
  dirPath = 'public/act-packs/tiles',
): Promise<PackedTileBundleAssets> {
  const resolvedDir = path.resolve(dirPath)
  const indexJsonPath = path.join(resolvedDir, 'index.json')
  const manifestPath = path.join(resolvedDir, 'drlg-bundle.json')
  const bundleBinPath = path.join(resolvedDir, 'drlg-bundle.bin')

  const catalogIndex = JSON.parse(
    fs.readFileSync(indexJsonPath, 'utf8'),
  ) as PackedTileCatalogIndex
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8'),
  ) as PackedDrlgBundleManifest
  const bundleBuf = fs.readFileSync(bundleBinPath)
  const bundleBytes = new Uint8Array(bundleBuf.buffer, bundleBuf.byteOffset, bundleBuf.byteLength)

  return {
    manifest,
    bundleBytes,
    catalogIndex,
  }
}

export async function loadMapServiceFromDir(
  dirPath = 'public/act-packs/tiles',
): Promise<MapService> {
  return MapService.fromLoader(() => loadPackedTileBundleFromDir(dirPath))
}

MapService.registerPackedDirLoader(loadPackedTileBundleFromDir)

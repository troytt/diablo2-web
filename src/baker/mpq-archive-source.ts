import { homedir } from 'node:os'
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { MpqArchive } from '../common/mpq/archive.ts'
import { MountedArchives } from '../common/mpq/mount.ts'
import type { MpqSource } from '../common/mpq/source.ts'
import {
  D2DataRegistry,
  MPQ_LOAD_ORDER,
  PET_SUB_SKILL_IDS,
  UNIVERSAL_PLAYER_SKILL_IDS,
  getSharedDataRegistry as getCommonSharedDataRegistry,
  getSharedMountedArchives as getCommonSharedMountedArchives,
  resetSharedDataRegistryCache as resetCommonSharedDataRegistryCache,
  type ArchiveSource,
  type CharStatsRecord,
  type D2DataRegistryParams,
  type ItemStatCostRecord,
  type MissileRecord,
  type MonStats2LightingRecord,
  type MonStatsRecord,
  type OverlayRecord,
  type PetTypeRecord,
  type SkillRecord,
  type StateRecord,
} from '../common/data/data-registry.ts'

export {
  D2DataRegistry,
  MPQ_LOAD_ORDER,
  PET_SUB_SKILL_IDS,
  UNIVERSAL_PLAYER_SKILL_IDS,
  type ArchiveSource,
  type CharStatsRecord,
  type D2DataRegistryParams,
  type ItemStatCostRecord,
  type MissileRecord,
  type MonStats2LightingRecord,
  type MonStatsRecord,
  type OverlayRecord,
  type PetTypeRecord,
  type SkillRecord,
  type StateRecord,
}

function resolveDefaultNodeMpqDir(): string {
  if (process.env.D2_DATA_DIR && existsSync(process.env.D2_DATA_DIR)) {
    return process.env.D2_DATA_DIR
  }
  const candidates = [
    'samples/d2',
    resolve(import.meta.dirname, '..', '..', 'samples', 'd2'),
    resolve(import.meta.dirname, '..', '..', '..', '..', 'samples', 'd2'),
    join(homedir(), 'diablo2-web', 'samples', 'd2'),
    join(homedir(), 'd2-data'),
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'd2data.mpq'))) {
      return candidate
    }
  }
  return process.env.D2_DATA_DIR ?? 'samples/d2'
}

export const DEFAULT_NODE_MPQ_DIR = resolveDefaultNodeMpqDir()

export function syncNodeFileSource(filePath: string): MpqSource & { close(): void } {
  if (!existsSync(filePath)) {
    throw new Error(`MPQ archive not found at ${filePath}`)
  }
  const size = statSync(filePath).size
  const fd = openSync(filePath, 'r')
  const readRangeSync = (offset: number, length: number): Uint8Array => {
    if (offset < 0 || length < 0 || offset + length > size) {
      throw new RangeError(
        `${filePath}: read [${String(offset)}, ${String(offset + length)}) out of bounds (size ${String(size)})`,
      )
    }
    const out = new Uint8Array(length)
    let filled = 0
    while (filled < length) {
      const got = readSync(fd, out, filled, length - filled, offset + filled)
      if (got === 0) {
        throw new Error(`${filePath}: unexpected EOF at ${String(offset + filled)}`)
      }
      filled += got
    }
    return out
  }
  return {
    label: filePath,
    size,
    readSync: readRangeSync,
    async read(offset: number, length: number): Promise<Uint8Array> {
      return readRangeSync(offset, length)
    },
    close() {
      closeSync(fd)
    },
  }
}

export function mountNodeArchives(mpqDir = DEFAULT_NODE_MPQ_DIR): MountedArchives {
  if (!existsSync(mpqDir)) {
    throw new Error(`MPQ directory does not exist: ${mpqDir}`)
  }
  const mounted = new MountedArchives()
  for (const name of MPQ_LOAD_ORDER) {
    const fullPath = join(mpqDir, name)
    const src = syncNodeFileSource(fullPath)
    mounted.add(name, MpqArchive.openSync(src))
  }
  return mounted
}

export function createNodeMpqArchiveSource(mpqDir = DEFAULT_NODE_MPQ_DIR): MountedArchives {
  return mountNodeArchives(mpqDir)
}

export function createMpqArchiveSource(mpqDir = DEFAULT_NODE_MPQ_DIR): MountedArchives {
  return mountNodeArchives(mpqDir)
}

export class NodeMpqArchiveSource implements ArchiveSource {
  readonly mounted: MountedArchives

  constructor(mpqDir = DEFAULT_NODE_MPQ_DIR) {
    this.mounted = mountNodeArchives(mpqDir)
  }

  has(mpqRelativePath: string): boolean {
    return this.mounted.has(mpqRelativePath)
  }

  read(mpqRelativePath: string): Promise<Uint8Array> {
    return this.mounted.read(mpqRelativePath)
  }

  readSync(mpqRelativePath: string): Uint8Array {
    return this.mounted.readSync(mpqRelativePath)
  }

  readFile(mpqRelativePath: string): Uint8Array | null {
    return this.mounted.readFile(mpqRelativePath)
  }

  readBytes(mpqRelativePath: string): Uint8Array {
    return this.mounted.readBytes(mpqRelativePath)
  }

  readText(mpqRelativePath: string): string {
    return this.mounted.readText(mpqRelativePath)
  }
}

let cachedNodeMounted: MountedArchives | null = null
let cachedNodeRegistry: D2DataRegistry | null = null

export function resetSharedDataRegistryCache(): void {
  cachedNodeMounted = null
  cachedNodeRegistry = null
  resetCommonSharedDataRegistryCache()
}

export function getSharedMountedArchives(
  baseDirOrSource: string | ArchiveSource | MountedArchives = DEFAULT_NODE_MPQ_DIR,
): MountedArchives {
  if (typeof baseDirOrSource === 'object' && baseDirOrSource !== null) {
    return getCommonSharedMountedArchives(baseDirOrSource)
  }
  if (cachedNodeMounted !== null) return cachedNodeMounted
  const mounted = mountNodeArchives(baseDirOrSource)
  getCommonSharedMountedArchives(mounted)
  cachedNodeMounted = mounted
  return mounted
}

export function getSharedDataRegistry(
  baseDirOrSource: string | ArchiveSource | MountedArchives = DEFAULT_NODE_MPQ_DIR,
): D2DataRegistry {
  if (typeof baseDirOrSource === 'object' && baseDirOrSource !== null) {
    return getCommonSharedDataRegistry(baseDirOrSource)
  }
  if (cachedNodeRegistry !== null) return cachedNodeRegistry
  const mounted = getSharedMountedArchives(baseDirOrSource)
  const reg = getCommonSharedDataRegistry(mounted)
  cachedNodeRegistry = reg
  return reg
}


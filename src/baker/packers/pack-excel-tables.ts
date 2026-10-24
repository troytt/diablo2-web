import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { REGISTRY_FILES, REGISTRY_PACK_DIR } from '../../common/data/registry-files.ts'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { fileSource } from '../io/file-source.ts'

const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const

export async function bakeExcelTables(archiveDir = 'samples/d2', outDir = 'public'): Promise<number> {
  const archives = new MountedArchives()
  for (const name of MOUNTS) archives.add(name, await MpqArchive.open(await fileSource(join(archiveDir, name))))
  const dir = join(outDir, REGISTRY_PACK_DIR)
  await mkdir(dir, { recursive: true })
  await Promise.all([...REGISTRY_FILES].map(async ([file, path]) => writeFile(join(dir, file), await archives.read(path))))
  return REGISTRY_FILES.size
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [archiveDir = 'samples/d2', outDir = 'public'] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  bakeExcelTables(archiveDir, outDir).then(
    (count) => console.log(`wrote ${count} data tables to ${join(outDir, REGISTRY_PACK_DIR)}`),
    (error: unknown) => {
      console.error('Failed to bake the data tables:', error)
      process.exit(1)
    },
  )
}

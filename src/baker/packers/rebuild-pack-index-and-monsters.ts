import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { cell, loadActTables } from '../../common/world/acts.ts'
import { decodePl2 } from '../../common/formats/pl2.ts'
import { planLevelMonsters } from '../../common/units/monsters-data.ts'
import { bakeEntities } from './pack-entity-assets.ts'

const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
const PLAYER_WALK_SPEED_PX = 170

function levelSeed(ds1Name: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < ds1Name.length; i += 1) {
    hash ^= ds1Name.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

async function main() {
  const archiveDir = 'samples/d2'
  const outDir = 'public/packs'
  const archives = new MountedArchives()
  for (const name of MOUNTS) {
    archives.add(name, await MpqArchive.open(await fileSource(join(archiveDir, name))))
  }
  const tables = await loadActTables(archives)

  const palettes: Record<string, number[]> = {}
  for (let act = 1; act <= 5; act += 1) {
    const pl2 = decodePl2(await archives.read(`data\\global\\palette\\act${String(act)}\\pal.pl2`))
    palettes[`act${String(act)}`] = [...pl2.rgb]
  }

  const levelsList: Array<{
    act: number
    levelId: number
    kind: string
    slug: string
    label: string
    levelName: string
    ds1: string
    path: string
    cells: string
    frames: number
    objects: number
    npcs: number
    pages: number
    objectPages: number
    missingTiles: number
    bytes: number
  }> = []

  let updatedMonstersCount = 0

  for (let act = 1; act <= 5; act += 1) {
    const actDir = join(outDir, `act${String(act)}`)
    let entries: string[] = []
    try {
      entries = await readdir(actDir)
    } catch {
      continue
    }

    for (const label of entries.sort()) {
      if (label === 'entities') continue
      const dirPath = join(actDir, label)
      const scenePath = join(dirPath, 'scene.json')
      let raw: string
      try {
        raw = await readFile(scenePath, 'utf8')
      } catch {
        continue
      }

      const scene = JSON.parse(raw)
      const levelId = Number(scene.levelId ?? 1)
      const levelRow = tables.levels.rows.find(r => Number(cell(tables.levels, r, 'Id')) === levelId)
      const drlg = levelRow ? Number(cell(tables.levels, levelRow, 'DrlgType')) : 2
      const kind = drlg === 2 ? 'preset' : drlg === 1 ? 'maze' : 'wilderness'

      // Determine seed matching pack-act-assets.ts
      let seed = levelSeed(scene.ds1 ?? label)
      const varMatch = label.match(/-var(\d+)$/)
      if (varMatch) {
        const v = Number(varMatch[1])
        seed = (kind === 'maze' ? 0x5eed_0000 : 0x5eed_1000) + levelId * 10 + v
      }

      // Re-plan monsters using latest planLevelMonsters
      const population = planLevelMonsters(
        tables,
        levelId,
        (scene.cellsX ?? 80) * (scene.cellsY ?? 80),
        seed,
        PLAYER_WALK_SPEED_PX,
      )

      scene.monsters = {
        types: population.types,
        budget: population.budget,
        packs: population.packs,
      }
      if (scene.stats) {
        scene.stats.monsters = population.packs.reduce((sum, pack) => sum + pack.members.length, 0)
        scene.stats.monsterPacks = population.packs.length
      }

      updatedMonstersCount += 1
      const sceneBytes = new TextEncoder().encode(JSON.stringify(scene))
      await writeFile(scenePath, sceneBytes)

      // Update manifest.json if present
      const manifestPath = join(dirPath, 'manifest.json')
      try {
        const mRaw = await readFile(manifestPath, 'utf8')
        const manifest = JSON.parse(mRaw)
        manifest.sceneBytes = sceneBytes.byteLength
        manifest.sceneSha256 = createHash('sha256').update(sceneBytes).digest('hex')
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
      } catch {
        // ignore if no manifest
      }

      // Determine slug from levelId + levelName
      const cleanName = String(scene.levelName ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      const slug = `${String(levelId)}-${cleanName}`

      // Compute total bytes (scene.json + PNG pages)
      let pngBytes = 0
      const filesInDir = await readdir(dirPath)
      for (const f of filesInDir) {
        if (f.endsWith('.png')) {
          const st = await readFile(join(dirPath, f))
          pngBytes += st.byteLength
        }
      }

      levelsList.push({
        act: scene.act ?? act,
        levelId,
        kind,
        slug,
        label,
        levelName: scene.levelName,
        ds1: scene.ds1 ?? label,
        path: `act${String(act)}/${label}`,
        cells: `${String(scene.cellsX)}x${String(scene.cellsY)}`,
        frames: Array.isArray(scene.frames) ? scene.frames.length : 0,
        objects: Array.isArray(scene.objects) ? scene.objects.length : 0,
        npcs: Array.isArray(scene.npcs) ? scene.npcs.length : 0,
        pages: Array.isArray(scene.pages) ? scene.pages.length : 0,
        objectPages: Array.isArray(scene.objectPages) ? scene.objectPages.length : 0,
        missingTiles: scene.missingTiles ?? 0,
        bytes: pngBytes + sceneBytes.byteLength,
      })
    }
  }

  levelsList.sort((a, b) => a.act - b.act || a.levelId - b.levelId || a.label.localeCompare(b.label))

  const index = {
    version: 1,
    generated: new Date().toISOString(),
    archiveDir,
    pageSize: 2048,
    palettes,
    levels: levelsList,
  }

  await writeFile(join(outDir, 'index.json'), JSON.stringify(index, null, 1))
  console.log(`Rebuilt public/packs/index.json with ${levelsList.length} map variants across Acts 1..5, updated ${updatedMonstersCount} scene monster plans.`)

  // Now bake all entity atlases for Acts 1..5
  await bakeEntities(archiveDir, 'public')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

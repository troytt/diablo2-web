/**
 * Audit (issue #1009): how many walkable sub-tiles lie under a type-15 roof, per outdoor level.
 *
 * 1.13c never hides or fades a roof (D2Client 0x6fb2a72e -> 0x6fb29d30, roof pass 0x6fac3a00 only skips
 * dwFlags & 0x408), so a roof over a walkable cell hides the player completely.
 *
 * Usage: npx tsx tools/audit-roof-walkable.ts [--seed=0x...] [--levels=80,81,82,83] [--archives=DIR]
 */
import { join } from 'node:path'
import { decodeDt1, type Dt1 } from '../src/common/formats/dt1.ts'
import { parseTable } from '../src/common/world/acts.ts'
import { buildIsoMapScene } from '../src/common/world/d2map.ts'
import { DRLG_GetActNoFromLevelId } from '../src/common/drlg/drlg-drlg.ts'
import { dumpAct1 } from '../src/common/drlg/drlg-dump.ts'
import { buildDrlgLevelMap, drlgLevelInputFromDump, outdoorLevelIds } from '../src/common/drlg/drlg-map.ts'
import { createDrlgEnv } from '../src/common/drlg/drlg-source.ts'
import { SUB_TILES_PER_TILE } from '../src/common/world/map.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { drlgLevelDt1s, drlgSuperUniqueIds, loadDrlgMpqData, loadDrlgMpqTables } from '../src/baker/io/drlg-mpq-source.ts'

const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
const arg = (name: string): string | undefined => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const archiveDir = arg('archives') ?? process.env.D2_DATA_DIR ?? join(process.env.HOME ?? '', 'd2-data')
const seed = Number(arg('seed') ?? '0x5eed0300') >>> 0
const levelsArg = arg('levels')

const archives = new MountedArchives()
for (const name of MOUNTS) archives.add(name, await MpqArchive.open(await fileSource(join(archiveDir, name))))
const baseTables = await loadDrlgMpqTables(member => archives.read(member))
const superUniqueIds = drlgSuperUniqueIds(parseTable(await archives.read('data\\global\\excel\\SuperUniques.txt')), baseTables)
const targets = levelsArg ? levelsArg.split(',').map(Number) : outdoorLevelIds(baseTables)
const acts = [...new Set(targets.map(id => DRLG_GetActNoFromLevelId(id)))].sort((a, b) => a - b)
const dt1Cache = new Map<string, Dt1>()
let total = 0
for (const actNo of acts) {
  const data = await loadDrlgMpqData(member => archives.read(member), actNo + 1)
  const actLevels = outdoorLevelIds(data.tables, actNo)
  const dump = dumpAct1(createDrlgEnv(data.source, data.tables), seed, actLevels, { difficulty: 0, isolated: false, act: actNo })
  const library = (name: string): Dt1 => {
    let dt1 = dt1Cache.get(name)
    if (dt1 === undefined) {
      dt1 = decodeDt1(data.source.readFile(name))
      dt1Cache.set(name, dt1)
    }
    return dt1
  }
  for (const levelId of targets.filter(id => DRLG_GetActNoFromLevelId(id) === actNo)) {
    const input = drlgLevelInputFromDump(dump, levelId, data.tables)
    const map = buildDrlgLevelMap(input, { tables: data.tables, dt1: drlgLevelDt1s(input, data.source, dt1Cache), superUniqueIds })
    const scene = buildIsoMapScene(map.ds1, map.dt1Names.map(library), 0)
    const roofCells = new Set(scene.roofs.map(r => `${String(r.cellX)},${String(r.cellY)}`))
    // Connected components of walkable sub-tiles (8-neighbour); the largest is the reachable main region.
    const W = scene.gridWidth
    const H = scene.gridHeight
    const comp = new Int32Array(W * H).fill(-1)
    const sizes: number[] = []
    const stack: number[] = []
    for (let i = 0; i < W * H; i++) {
      if (scene.blocked[i] !== 0 || comp[i] !== -1) continue
      const id = sizes.length
      let size = 0
      comp[i] = id
      stack.push(i)
      while (stack.length > 0) {
        const p = stack.pop()!
        size++
        const px = p % W
        const py = (p - px) / W
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = px + dx
            const ny = py + dy
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
            const q = ny * W + nx
            if (scene.blocked[q] === 0 && comp[q] === -1) {
              comp[q] = id
              stack.push(q)
            }
          }
        }
      }
      sizes.push(size)
    }
    const main = sizes.indexOf(Math.max(...sizes))
    let reachable = 0
    let walkable = 0
    const samples: string[] = []
    for (const key of roofCells) {
      const [cx, cy] = key.split(',').map(Number) as [number, number]
      let cellWalk = 0
      let cellReach = 0
      for (let sy = 0; sy < SUB_TILES_PER_TILE; sy++) {
        for (let sx = 0; sx < SUB_TILES_PER_TILE; sx++) {
          const gx = cx * SUB_TILES_PER_TILE + sx
          const gy = cy * SUB_TILES_PER_TILE + sy
          const gi = gy * scene.gridWidth + gx
          if (gx < scene.gridWidth && gy < scene.gridHeight && scene.blocked[gi] === 0) {
            cellWalk++
            if (comp[gi] === main) cellReach++
          }
        }
      }
      walkable += cellWalk
      reachable += cellReach
      if (cellReach > 0 && samples.length < 6) samples.push(`${key}(${String(cellReach)})`)
    }
    total += reachable
    console.log(`level ${String(levelId)}: roofCells=${String(roofCells.size)} walkableUnderRoof=${String(walkable)} reachableUnderRoof=${String(reachable)} mainRegion=${String(sizes[main] ?? 0)} ${samples.join(' ')}`)
  }
}
console.log(`total reachable sub-tiles under roofs: ${String(total)}`)

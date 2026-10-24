import { existsSync } from 'node:fs'
import { getSharedMountedArchives } from '../src/common/data/data-registry.ts'
import { createNodeMpqArchiveSource, DEFAULT_NODE_MPQ_DIR } from '../src/baker/mpq-archive-source.ts'
import '../tools/lib/node-map-loader.ts'

if (existsSync(DEFAULT_NODE_MPQ_DIR)) {
  getSharedMountedArchives(createNodeMpqArchiveSource(DEFAULT_NODE_MPQ_DIR))
}

/**
 * Every NPC baked into a pack must carry usable art.
 *
 * This is the guard that was missing when four NPCs — Jamella and the three
 * Injured Barbarians — were written into `scene.json` with a null `member`. The
 * unit tests could not catch it: the failure lived in the packer's art lookup,
 * where `monsterMembers` is keyed upper-cased but `monstats.txt` hands back
 * `ja` / `6z` / `7i` / `7j` in lower case, so `map.get(token)` missed and the
 * entry was baked art-less instead of failing.
 *
 * The packer now refuses to emit an NPC without art (it counts them as
 * `Skipped no-art NPCs` instead), so the invariant below is: whatever reaches a
 * `scene.json` is drawable.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * Guarded on the index file this suite actually opens, not on the `samples/d2`
 * archive directory: those are different resources, and keying the guard on the
 * wrong one is what previously left three suites silently unrunnable.
 */
const PACK_ROOT = 'public/packs'
const PACK_INDEX = join(PACK_ROOT, 'index.json')
const hasPacks = existsSync(PACK_INDEX)

interface PackedNpc {
  readonly token?: string
  readonly name?: string
  readonly member?: string | null
  readonly frame?: { readonly page: number } | null
}
interface PackedScene { readonly npcs?: readonly PackedNpc[] }
interface PackIndex { readonly levels: readonly { readonly act: number; readonly path: string }[] }

describe('packed NPC art', () => {
  test.skipIf(!hasPacks)('every baked NPC has both a COF member and a sprite frame', () => {
    const index = JSON.parse(readFileSync(PACK_INDEX, 'utf8')) as PackIndex
    const broken: string[] = []
    let total = 0

    for (const level of index.levels) {
      const scenePath = join(PACK_ROOT, level.path, 'scene.json')
      if (!existsSync(scenePath)) continue
      const scene = JSON.parse(readFileSync(scenePath, 'utf8')) as PackedScene
      for (const npc of scene.npcs ?? []) {
        total += 1
        if (npc.member === undefined || npc.member === null || npc.frame === undefined || npc.frame === null) {
          broken.push(`${level.path}: token=${npc.token ?? '?'} name=${npc.name ?? '?'}`)
        }
      }
    }

    // Named so a failure reports which NPCs lost their art, not just a count.
    expect(broken).toEqual([])
    expect(total).toBeGreaterThan(0)
  })

  test.skipIf(!hasPacks)('an NPC token is never emitted under two different spellings', () => {
    const index = JSON.parse(readFileSync(PACK_INDEX, 'utf8')) as PackIndex
    const spellings = new Map<string, Set<string>>()

    for (const level of index.levels) {
      const scenePath = join(PACK_ROOT, level.path, 'scene.json')
      if (!existsSync(scenePath)) continue
      const scene = JSON.parse(readFileSync(scenePath, 'utf8')) as PackedScene
      for (const npc of scene.npcs ?? []) {
        const token = npc.token ?? ''
        if (token === '') continue
        const bucket = spellings.get(token.toUpperCase()) ?? new Set<string>()
        bucket.add(token)
        spellings.set(token.toUpperCase(), bucket)
      }
    }

    const inconsistent = [...spellings.entries()]
      .filter(([, seen]) => seen.size > 1)
      .map(([canonical, seen]) => `${canonical} -> ${[...seen].join(', ')}`)
    expect(inconsistent).toEqual([])
  })
})

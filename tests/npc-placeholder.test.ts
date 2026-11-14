import { test, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hasPackedSprite } from '../src/common/world/npc.ts'

const PACK_ROOT = 'public/packs'
const PACK_INDEX = join(PACK_ROOT, 'index.json')
/** Guard on the exact file these tests open, not on the directory above it. */
const noPack = !existsSync(PACK_INDEX)

interface PackedNpc {
  readonly token?: string
  readonly frame?: unknown
}

interface IndexLevel {
  readonly path: string
  readonly label: string
  readonly npcs: number
}

function readLevels(): readonly IndexLevel[] {
  const index = JSON.parse(readFileSync(PACK_INDEX, 'utf8')) as { readonly levels: readonly IndexLevel[] }
  return index.levels
}

function readNpcs(levelPath: string): readonly PackedNpc[] {
  const scene = JSON.parse(readFileSync(join(PACK_ROOT, levelPath, 'scene.json'), 'utf8')) as {
    readonly npcs?: readonly PackedNpc[]
  }
  return scene.npcs ?? []
}

test('hasPackedSprite treats a missing or null frame as art-less', () => {
  expect(hasPackedSprite({ frame: { page: 0 } })).toBe(true)
  expect(hasPackedSprite({ frame: null })).toBe(false)
  expect(hasPackedSprite({})).toBe(false)
})

test('hasPackedSprite narrows frame so callers need no second check', () => {
  const entry: { readonly frame?: { readonly page: number } | null } = { frame: { page: 7 } }
  if (!hasPackedSprite(entry)) throw new Error('expected the guard to admit this entry')
  // Reading .page without a null check is the whole point of the guard: if the
  // predicate ever stops narrowing, this line stops compiling.
  expect(entry.frame.page).toBe(7)
})

/**
 * The placeholder box and the sprite are drawn by two separate passes that both
 * branch on `hasPackedSprite`. Running every real packed NPC through it proves
 * the partition is total — each NPC lands in exactly one pass, never both and
 * never neither — which is what keeps a green box off finished art.
 */
test.skipIf(noPack)('every packed NPC is classified into exactly one render pass', () => {
  let total = 0
  let withSprite = 0
  const artless: string[] = []

  for (const level of readLevels()) {
    if (level.npcs === 0) continue
    for (const npc of readNpcs(level.path)) {
      total += 1
      if (hasPackedSprite(npc)) withSprite += 1
      else artless.push(`${level.path}:${npc.token ?? '?'}`)
    }
  }

  expect(total).toBeGreaterThan(0)
  // The packer already refuses to bake an art-less NPC, so a survivor here would
  // mean a placeholder box is being drawn where real art was expected.
  expect(artless).toEqual([])
  expect(withSprite).toBe(total)
})

test.skipIf(noPack)('act 1 town carries its full NPC roster', () => {
  const townLevels = readLevels().filter(l => l.label.includes('act-1-town'))
  expect(townLevels.length).toBe(1)

  const tokensSeen = new Set<string>()
  for (const level of townLevels) {
    for (const npc of readNpcs(level.path)) {
      if (npc.token !== undefined) tokensSeen.add(npc.token)
    }
  }

  // Regression guard for the reported 'npc不全': before DS1 type-1 entries were
  // resolved through MonPreset, only Cain (DC) survived in the Rogue Encampment.
  for (const token of ['WA', 'RC', 'PS', 'CI', 'GH', 'DC']) {
    expect(tokensSeen.has(token)).toBe(true)
  }
})

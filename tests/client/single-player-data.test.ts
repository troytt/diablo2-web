import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { bakeExcelTables } from '../../src/baker/packers/pack-excel-tables.ts'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { REGISTRY_FILES } from '../../src/common/data/registry-files.ts'
import { loadSinglePlayerData, type FileFetch } from '../../src/client/session/single-player-data.ts'

const MPQS = 'samples/d2'
const served = (dir: string): FileFetch => (url) => {
  const path = join(dir, url.split('/').at(-1)!)
  const found = existsSync(path)
  return Promise.resolve({ ok: found, status: found ? 200 : 404, headers: new Headers({ 'content-type': 'text/plain' }), arrayBuffer: () => Promise.resolve(found ? new Uint8Array(readFileSync(path)).buffer : new ArrayBuffer(0)) })
}

describe('Single Player data tables', () => {
  it('reports the missing bake instead of failing the game', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const spa: FileFetch = () => Promise.resolve({ ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })
    expect(await loadSinglePlayerData(spa)).toBe(false)
    expect(warn.mock.calls[0]?.[0]).toContain('npm run bake -- excel')
    warn.mockRestore()
  })

  it.skipIf(!existsSync(join(MPQS, 'd2data.mpq')))('bakes the tables the engine needs and loads them so skills resolve', { timeout: 60_000 }, async () => {
    const out = mkdtempSync(join(tmpdir(), 'excel-'))
    expect(await bakeExcelTables(MPQS, out)).toBe(REGISTRY_FILES.size)
    expect(await loadSinglePlayerData(served(join(out, 'packs', 'excel')))).toBe(true)
    expect(getSharedDataRegistry().getSkillById(47)?.skill).toBe('Fire Ball')
  })
})

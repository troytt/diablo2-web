import { describe, expect, it } from 'vitest'
import { extractAssetResourceType, type BootProgressSnapshot } from '../../src/client/ui/boot-progress.ts'
import { LOADING_TIPS, loadingStatus } from '../../src/client/ui/loading-screen.ts'
import { pageTitle } from '../../src/client/ui/page-title.ts'

const snap = (currentFile: string, status: BootProgressSnapshot['status'] = 'loading') => ({ currentFile, status }) as BootProgressSnapshot
const HAN = /\p{Script=Han}/u

describe('loading screen', () => {
  it('names every resource type in English and falls back for new ones', () => {
    const urls = ['/ui/font16.png', '/ui/automap/a.png', '/skills/x.png', '/ui/items/a.png', '/missiles/a.png', '/overlays/a.png', '/chars/a.png', '/entities/a.png', '/act-packs/a.bin', '/ui/frontend/a.png', '/ui/hud/a.png', '/asset-manifest.json', '/anim/a.png', '/x.bin']
    const statuses = urls.map((url) => loadingStatus(snap(extractAssetResourceType(url))))
    expect(statuses.filter((text) => HAN.test(text))).toEqual([])
    expect(loadingStatus(snap('新的资源'))).toBe('Loading game files')
    expect(loadingStatus(snap('', 'completed'))).toBe('Entering Sanctuary')
    expect(LOADING_TIPS.filter((tip) => HAN.test(tip))).toEqual([])
  })

  it('titles the tab with the area and level while in game', () => {
    expect(pageTitle({ areaId: 2, level: 7 })).toBe('Blood Moor · Level 7 · Diablo II')
    expect(pageTitle(null)).toBe('Diablo II · in your browser')
  })
})

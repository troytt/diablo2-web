import { describe, expect, it } from 'vitest'
import { AudioRuntime113c } from '../../src/client/audio/audio-runtime-113c.ts'
import { SfxChunkLoader } from '../../src/client/audio/sfx-chunk-loader.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { SFX_PACKS_113C } from '../../src/common/audio/sfx-pack-index-113c.ts'
import { resolveMonsterSoundId113c } from '../../src/common/audio/mon-sounds-113c.ts'
import { FakeAudioContext, FakePackServer, installFakeAudioContext, flushAsync } from './e2e/webaudio-fake.ts'

describe('Issue #948 Regression: Cross-act summon sounds', () => {
  const uninstall = installFakeAudioContext()
  const server = new FakePackServer(SFX_PACKS_113C)

  const createRuntime = (act: number) => {
    const loader = new SfxChunkLoader({
      fetchPack: async (packId: string, url: string) => {
        // Only allow core, combat, skill-common, mon-global, and the allowed Act's monster pack
        if (packId.startsWith('sfx-mon-act') && !packId.startsWith('sfx-mon-act' + String(act))) {
          throw new Error('Pack ' + packId + ' was wrongly requested in Act ' + String(act) + ' for a cross-act summon!');
        }
        return server.fetchPack(packId, url)
      },
      getContext: () => (FakeAudioContext.instances.at(-1) as any) ?? null,
    })
    const rt = new AudioRuntime113c({
      rng: new D2Rng(1, 1),
      listenerPos: () => ({ x: 0, y: 0 }),
      loader,
    })
    rt.unlock()
    rt.gameInit()
    rt.preloadMonsterPacksForAct(act) // CORRECT METHOD
    return { rt, loader }
  }

  it('plays Necromancer skeleton and golem sounds correctly in Act 5 without loading Act 1 packs', async () => {
    const { loader } = createRuntime(5)
    
    // We use loader.loadSoundBuffer directly to ensure promise rejections aren't swallowed.
    await loader.loadSoundBuffer(resolveMonsterSoundId113c('skeleton', 'attack1'))
    await loader.loadSoundBuffer(resolveMonsterSoundId113c('golemclay', 'hitSound'))
    await loader.loadSoundBuffer(resolveMonsterSoundId113c('golemfire', 'deathSound'))
    
    await flushAsync(5)
    expect(true).toBe(true)
  })

  it('plays Druid wolf and bear sounds correctly in Act 1 without loading Act 5 packs', async () => {
    const { loader } = createRuntime(1)
    await loader.loadSoundBuffer(resolveMonsterSoundId113c('druidwolf', 'attack1'))
    await loader.loadSoundBuffer(resolveMonsterSoundId113c('druidbear', 'deathSound'))
    await loader.loadSoundBuffer(resolveMonsterSoundId113c('druidbear', 'neutral'))
    
    await flushAsync(5)
    expect(true).toBe(true)
  })

  it('plays Act 2 mercenary sounds correctly in Act 5 without loading Act 2 packs', async () => {
    const { loader } = createRuntime(5)
    await loader.loadSoundBuffer(resolveMonsterSoundId113c('act2hire', 'hitSound'))
    await loader.loadSoundBuffer(resolveMonsterSoundId113c('act2hire', 'deathSound'))
    
    await flushAsync(5)
    expect(true).toBe(true)
  })

  it('plays Act 3 mercenary sounds correctly in Act 1 without loading Act 3 packs', async () => {
    const { loader } = createRuntime(1)
    await loader.loadSoundBuffer(resolveMonsterSoundId113c('act3hire', 'hitSound'))
    await loader.loadSoundBuffer(resolveMonsterSoundId113c('act3hire', 'deathSound'))
    
    await flushAsync(5)
    expect(true).toBe(true)
  })
})

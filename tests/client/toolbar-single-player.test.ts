import { describe, expect, it } from 'vitest'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import { Toolbar } from '../../src/client/toolbar/toolbar.ts'

const memory = () => {
  const items = new Map<string, string>()
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value), removeItem: (key: string) => void items.delete(key) }
}

describe('toolbar status', () => {
  it('says Single Player instead of a server connection when playing offline', () => {
    const toolbar = new Toolbar({ store: new SettingsStore({ storage: memory(), defaultLang: 'en', syncGlobalLang: false }) })
    toolbar.setConnectionState({ phase: 'local', rttMs: 0 })
    expect(toolbar.getSnapshot()).toMatchObject({ statusLabel: 'Single Player', rttLabel: '' })
    toolbar.setConnectionState({ phase: 'd2gs', rttMs: 40 })
    expect(toolbar.getSnapshot()).toMatchObject({ statusLabel: 'In-Game (D2GS)', rttLabel: '40 ms' })
  })
})

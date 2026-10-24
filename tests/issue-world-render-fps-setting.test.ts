/**
 * `worldRenderFps` setting (30 | 60, default 60): drives the in-game world
 * render-rate cap in the main loop; 60 = uncapped (follows display refresh),
 * 30 = ~half the GPU raster with the 2ms rAF-slack cap (an exact 33.3ms
 * threshold otherwise flaps at the 60Hz frame boundary and delivers ~22fps).
 */
import { describe, expect, it } from 'vitest'
import {
  createDefaultClientSettings,
  parseClientSettingsJson,
  sanitizeClientSettings,
} from '../src/client/settings/client-settings.ts'

describe('[world render fps setting]', () => {
  it('1. defaults to 60 (uncapped)', () => {
    expect(createDefaultClientSettings().worldRenderFps).toBe(60)
  })

  it('2. sanitize accepts 30/60 and falls back to default otherwise', () => {
    expect(sanitizeClientSettings({ worldRenderFps: 30 }).worldRenderFps).toBe(30)
    expect(sanitizeClientSettings({ worldRenderFps: 60 }).worldRenderFps).toBe(60)
    // Unknown / legacy persisted payloads without the key keep the default.
    expect(sanitizeClientSettings({}).worldRenderFps).toBe(60)
    expect(sanitizeClientSettings({ worldRenderFps: 25 }).worldRenderFps).toBe(60)
    expect(sanitizeClientSettings({ worldRenderFps: '30' }).worldRenderFps).toBe(60)
  })

  it('3. round-trips through persisted JSON', () => {
    const saved = sanitizeClientSettings({ worldRenderFps: 30 })
    const restored = parseClientSettingsJson(JSON.stringify(saved))
    expect(restored.worldRenderFps).toBe(30)
  })
})

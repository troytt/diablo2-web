import { readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  automapRevealPlugin,
  type AutomapRevealPluginInstance,
} from '../../plugins/automap-reveal/index.ts'
import { DROP_I18N, dropTrackerPlugin } from '../../plugins/drop-tracker/index.ts'
import { extendedViewportsPlugin } from '../../plugins/extended-viewports/index.ts'
import { PD2_SGD2FREERES_VIEWPORT_RESOLUTIONS } from '../../src/client/view/viewport-profile.ts'
import { groundItemBeamPlugin } from '../../plugins/ground-item-beam/index.ts'
import { hudEnhancementsPlugin } from '../../plugins/hud-enhancements/index.ts'
import { BUILTIN_PLUGINS } from '../../plugins/index.ts'
import {
  createKillStatsPlugin,
  killStatsPlugin,
} from '../../plugins/kill-stats/index.ts'
import {
  localizeKillSkipReason,
  STATS_I18N,
} from '../../plugins/kill-stats/stats-i18n.ts'
import {
  containsCjkCharacters,
  createPluginI18n,
  isValidLocalizedText,
  validatePluginI18nDictionary,
  validatePluginRegistry,
  type D2WebPlugin,
  type LocalizedText,
  type PluginActionSpec,
  type PluginSessionView,
  type PluginSettingSpec,
  type WeatherOverrideSetting,
} from '../../src/client/plugin-host/api.ts'
import { PluginConfigStore } from '../../src/client/plugin-host/plugin-config-store.ts'
import {
  PluginHost,
  type PluginHostToolbarPort,
} from '../../src/client/plugin-host/plugin-host.ts'
import {
  OnlineSession,
  type OnlineSessionLobbySnapshot,
  type OnlineSessionPhase,
} from '../../src/client/session/online-session.ts'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import { Toolbar } from '../../src/client/toolbar/toolbar.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import { MemoryKillStatsRepository } from './kill-stats/memory-repository.ts'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

describe('BUILTIN_PLUGINS Registry & Built-In Plugin Lifecycles', () => {
  it('validates BUILTIN_PLUGINS and ensures every plugins/<id>/ directory is registered', () => {
    expect(() => validatePluginRegistry(BUILTIN_PLUGINS)).not.toThrow()

    const pluginsDir = resolve(process.cwd(), 'plugins')
    const dirIds = readdirSync(pluginsDir)
      .filter((name) => statSync(resolve(pluginsDir, name)).isDirectory())
      .sort()
    const registeredIds = BUILTIN_PLUGINS.map((p) => p.id).sort()
    expect(registeredIds).toEqual(dirIds)
    expect(BUILTIN_PLUGINS).toContain(killStatsPlugin)
    expect(BUILTIN_PLUGINS).toContain(dropTrackerPlugin)
    expect(BUILTIN_PLUGINS).toContain(automapRevealPlugin)
    expect(BUILTIN_PLUGINS).toContain(extendedViewportsPlugin)
    expect(BUILTIN_PLUGINS).toContain(hudEnhancementsPlugin)
    expect(BUILTIN_PLUGINS).toContain(groundItemBeamPlugin)
  })

  it('manages #d2-toolbar-plugin-kill-stats-open shortcut, reports mid-game warn/recording/ready statuses, and flushes pending kills on deactivate', async () => {
    const repository = new MemoryKillStatsRepository({
      initialReplicaId: '11111111-1111-4111-8111-111111111111',
    })
    const plugin = createKillStatsPlugin({
      repository,
    })

    const baseSnapshot = new OnlineSession().getSnapshot()
    let phase: OnlineSessionPhase = 'disconnected'
    const eventListeners = new Set<(ev: ServerEvent) => void>()
    const stateListeners = new Set<(snapshot: OnlineSessionLobbySnapshot) => void>()
    const world = new ClientWorld()
    world.difficulty = 2
    world.hardcore = true
    world.expansion = true
    world.ladder = true
    world.self.unitId = 1
    world.self.charClass = 1
    world.self.level = 90
    world.self.name = 'SorcHero'

    const getSnapshot = (): OnlineSessionLobbySnapshot => ({
      ...baseSnapshot,
      phase,
      username: 'DeckardCain',
      selectedRealm: {
        id: 1,
        title: 'D2CS',
        description: 'Realm',
      },
      realms: [],
      characters: [
        {
          name: 'SorcHero',
          charClass: 1,
          level: 90,
          act: 1,
          difficulty: 2,
          hardcore: true,
          expansion: true,
          ladder: true,
          dead: false,
          expiresAt: 0,
          equipmentGraphics: new Uint8Array(0),
          rawStatString: new Uint8Array(0),
        },
      ],
      selectedChar: 'SorcHero',
    })

    const session: PluginSessionView = {
      get phase() {
        return phase
      },
      loginHost: 'www.laiseek.xyz',
      getSnapshot,
      world,
      onServerEvent(cb) {
        eventListeners.add(cb)
        return () => eventListeners.delete(cb)
      },
      onStateChange(cb) {
        stateListeners.add(cb)
        return () => stateListeners.delete(cb)
      },
    }

    const toolbarLinks = new Map<string, string>()
    const toolbarPort: PluginHostToolbarPort = {
      setPluginsButtonState() {},
      addContribution(spec) {
        if (spec.kind === 'link') {
          toolbarLinks.set(spec.domId, spec.href)
        }
        return () => {
          toolbarLinks.delete(spec.domId)
        }
      },
    }

    const configStore = new PluginConfigStore([plugin], {
      storage: new MemoryStorage(),
    })
    const host = new PluginHost({
      plugins: [plugin],
      configStore,
      session,
      toolbar: toolbarPort,
      autoStart: false,
    })

    await host.start()

    // 1. Default enabled + showToolbarShortcut = true -> link registered, status Ready (not in game)
    expect(toolbarLinks.get('d2-toolbar-plugin-kill-stats-open')).toBe(
      'plugins/kill-stats/index.html',
    )
    expect(host.list()[0]?.status).toEqual({
      level: 'ok',
      text: {
        zh: '就绪（未在游戏中）',
        en: 'Ready (not in game)',
      },
    })

    // 2. Toggle showToolbarShortcut off and back on
    host.setSetting('kill-stats', 'showToolbarShortcut', false)
    expect(toolbarLinks.has('d2-toolbar-plugin-kill-stats-open')).toBe(false)
    host.setSetting('kill-stats', 'showToolbarShortcut', true)
    expect(toolbarLinks.has('d2-toolbar-plugin-kill-stats-open')).toBe(true)

    // 3. Enter game before GameFlags (0x01) arrives -> status is 'warn' (Waiting for next game)
    phase = 'ingame'
    for (const cb of stateListeners) cb(getSnapshot())
    expect(host.list()[0]?.status.level).toBe('warn')
    expect(host.list()[0]?.status.text.zh).toContain('等待下一局')

    // 4. Emit GameFlags (0x01) -> status transitions to 'ok' (Recording / 记录中)
    for (const cb of eventListeners) {
      cb({
        type: 'GameFlags',
        difficulty: 2,
        hardcore: true,
        expansion: true,
        ladder: true,
      })
    }
    expect(host.list()[0]?.status).toEqual({
      level: 'ok',
      text: {
        zh: '记录中',
        en: 'Recording',
      },
    })

    // 5. Record a kill (unflushed in 2s batch buffer), then disable plugin -> deactivate() flushes immediately!
    for (const cb of eventListeners) {
      cb({
        type: 'UnitAssign',
        unit: {
          unitType: 1,
          id: 500,
          classId: 156, // Andariel
          x: 5000,
          y: 5000,
          lifePct: 128,
          mode: 1,
        },
      })
      cb({
        type: 'UnitMode',
        unitType: 1,
        id: 500,
        mode: 0,
      })
    }

    await host.setEnabled('kill-stats', false)
    expect(toolbarLinks.has('d2-toolbar-plugin-kill-stats-open')).toBe(false)

    const snap = await repository.loadAll()
    expect(snap.characters).toHaveLength(1)
    expect(snap.tallies.map((t) => `${t.kind}:${t.subject}=${t.count}`).sort()).toEqual([
      'boss:156=1',
      'monster:156=1',
    ])

    // Verify setting, action, and exact localized label declarations
    const settingSpecs: readonly PluginSettingSpec[] = plugin.settings ?? []
    const actionSpecs: readonly PluginActionSpec[] = plugin.actions ?? []
    expect(plugin.name).toEqual({
      zh: '击杀统计',
      en: 'Kill Stats',
    })
    expect(settingSpecs.map((s) => s.key)).toEqual(['showToolbarShortcut'])
    expect(settingSpecs[0]?.label).toEqual({
      zh: '在工具栏显示快捷入口',
      en: 'Show shortcut in toolbar',
    })
    expect(actionSpecs.map((a) => a.id)).toEqual(['open-page'])
    expect(actionSpecs[0]?.label).toEqual({
      zh: '打开统计页',
      en: 'Open Stats Page',
    })

    await host.destroy()
  })

  it('automap-reveal (#714, merged lightingPreset & weatherOverride) and extended-viewports (#716) synchronize with SettingsStore without adding toolbar selects; disabling restores vanilla automap defaults and keeps the PD2 viewport list', async () => {
    const settingsStore = new SettingsStore({
      storage: new MemoryStorage(),
      defaultLang: 'en',
      syncGlobalLang: false,
    })
    const toolbar = new Toolbar({ store: settingsStore })
    const session = new OnlineSession({ settingsStore })

    const plugins = [
      automapRevealPlugin,
      extendedViewportsPlugin,
    ] as const
    const configStore = new PluginConfigStore(plugins, {
      storage: new MemoryStorage(),
    })

    const registeredSelects = new Map<string, { getValue(): string; onChange(val: string): void }>()
    const toolbarPort: PluginHostToolbarPort = {
      setPluginsButtonState() {},
      addContribution(spec) {
        const dispose = toolbar.addContribution(spec)
        if (spec.kind === 'select') {
          registeredSelects.set(spec.selectDomId, {
            getValue: spec.getValue,
            onChange: spec.onChange,
          })
          return () => {
            dispose()
            registeredSelects.delete(spec.selectDomId)
          }
        }
        return dispose
      },
      getAllowedViewports: () => toolbar.getAllowedViewports(),
      setAllowedViewports: (vps) => toolbar.setAllowedViewports(vps),
    }

    const host = new PluginHost({
      plugins,
      configStore,
      session,
      toolbar: toolbarPort,
      settingsStore,
      enforceClientDefaults: true,
      autoStart: false,
    })

    await host.start()

    // 1. Both plugins start enabled by default:
    //    - NO toolbar <select> dropdowns are registered by automap-reveal (dropdowns live in PluginMenu modal only)
    //    - the toolbar offers the PD2 SGD2FreeRes list (640x480..1424x800), starting at its 1068x600 default
    expect(registeredSelects.size).toBe(0)
    expect(toolbar.getAllowedViewports()).toEqual(PD2_SGD2FREERES_VIEWPORT_RESOLUTIONS)
    expect(settingsStore.get().viewport).toBe('1068x600')

    // 2. Automap Reveal (#714) manages mode, lightingPreset, weatherOverride, showMonsters, showShrines
    const inst = host.getInstance<AutomapRevealPluginInstance>('automap-reveal')
    expect(inst).toBeDefined()
    expect(inst?.getMode()).toBe('off')
    expect(inst?.getLightingPreset()).toBe('auto')
    expect(inst?.getWeatherOverride()).toBe('off')
    expect(inst?.getShowMonsters()).toBe(true)
    expect(inst?.getShowShrines()).toBe(true)

    host.setSetting('automap-reveal', 'mode', 'act')
    expect(settingsStore.get().automapReveal).toBe('act')
    expect(inst?.getMode()).toBe('act')

    inst?.setMode('level')
    expect(settingsStore.get().automapReveal).toBe('level')
    expect(host.getSetting('automap-reveal', 'mode')).toBe('level')

    host.setSetting('automap-reveal', 'lightingPreset', 'fullbright')
    expect(settingsStore.get().lightingPreset).toBe('fullbright')
    expect(inst?.getLightingPreset()).toBe('fullbright')

    inst?.setLightingPreset('torch')
    expect(settingsStore.get().lightingPreset).toBe('torch')
    expect(host.getSetting('automap-reveal', 'lightingPreset')).toBe('torch')

    host.setSetting('automap-reveal', 'weatherOverride', 'rain')
    expect(settingsStore.get().weatherOverride).toBe('rain')
    expect(session.weather.override).toBe('rain')
    expect(inst?.getWeatherOverride()).toBe('rain')

    inst?.setWeatherOverride('snow')
    expect(settingsStore.get().weatherOverride).toBe('snow')
    expect(session.weather.override).toBe('snow')
    expect(host.getSetting('automap-reveal', 'weatherOverride')).toBe('snow')

    expect(
      host.list().find((p) => p.id === 'automap-reveal')?.status,
    ).toEqual({
      level: 'ok',
      text: {
        zh: '当前：本层全开 · 光照：火炬 (地牢暖火) · 天气：强制降雪',
        en: 'Mode: Current Level · Light: Torch (Dungeon Warmth) · Weather: Force Snow',
      },
    })

    // 3. Disabling automap-reveal releases all claims and restores 1.13c vanilla defaults
    await host.setEnabled('automap-reveal', false)
    expect(settingsStore.get().automapReveal).toBe('off')
    expect(settingsStore.get().lightingPreset).toBe('auto')
    expect(settingsStore.get().weatherOverride).toBe('off')
    expect(session.weather.override).toBe('off')
    expect(settingsStore.get().automapShowMonsters).toBe(false)
    expect(settingsStore.get().automapShowShrines).toBe(false)

    // Re-enabling restores persisted plugin settings
    await host.setEnabled('automap-reveal', true)
    expect(settingsStore.get().automapReveal).toBe('level')
    expect(settingsStore.get().lightingPreset).toBe('torch')
    expect(settingsStore.get().weatherOverride).toBe('snow')
    expect(session.weather.override).toBe('snow')
    expect(settingsStore.get().automapShowMonsters).toBe(true)
    expect(settingsStore.get().automapShowShrines).toBe(true)

    // 4. Extended Viewports (#716) no longer gates anything (PD2 is the only default, no 1.13c switch):
    //    disabling it keeps the PD2 SGD2FreeRes list and the chosen resolution.
    toolbar.setViewport('1280x720')
    expect(settingsStore.get().viewport).toBe('1280x720')

    await host.setEnabled('extended-viewports', false)
    expect(toolbar.getAllowedViewports()).toEqual(PD2_SGD2FREERES_VIEWPORT_RESOLUTIONS)
    expect(settingsStore.get().viewport).toBe('1280x720')

    await host.setEnabled('extended-viewports', true)
    expect(toolbar.getAllowedViewports()).toEqual(PD2_SGD2FREERES_VIEWPORT_RESOLUTIONS)
    expect(settingsStore.get().viewport).toBe('1280x720')

    await host.destroy()
    session.destroy()
    toolbar.destroy()
  })

  it('automap-reveal weatherOverride claim replaces stale weatherOverride on start and rejects invalid weatherOverride from misbehaving plugins', async () => {
    const settingsStore = new SettingsStore({
      storage: new MemoryStorage(),
      defaultLang: 'en',
      syncGlobalLang: false,
    })
    // A stale override from an earlier session: nothing claims it until the plugin starts.
    settingsStore.set({ weatherOverride: 'snow' })
    const toolbar = new Toolbar({ store: settingsStore })
    const session = new OnlineSession({ settingsStore })
    expect(session.weather.override).toBe('snow')

    const badPlugin: D2WebPlugin = {
      id: 'bad-weather',
      name: { zh: '坏天气', en: 'Bad Weather' },
      description: { zh: '测试', en: 'Test' },
      defaultEnabled: false,
      activate(ctx) {
        ctx.client.setWeatherOverride('fog' as WeatherOverrideSetting)
        return { deactivate() {} }
      },
    }
    const plugins = [automapRevealPlugin, badPlugin] as const
    const configStore = new PluginConfigStore(plugins, { storage: new MemoryStorage() })
    const toolbarPort: PluginHostToolbarPort = {
      setPluginsButtonState() {},
      addContribution(spec) {
        return toolbar.addContribution(spec)
      },
    }
    const host = new PluginHost({
      plugins,
      configStore,
      session,
      toolbar: toolbarPort,
      settingsStore,
      enforceClientDefaults: true,
      autoStart: false,
    })
    await host.start()

    // 1. Enabled by default in Default (1.13c) mode: the stale override is replaced by the plugin's 'off'.
    expect(settingsStore.get().weatherOverride).toBe('off')
    expect(session.weather.override).toBe('off')

    // 2. Two-way sync via client settingsStore -> plugin setting
    settingsStore.set({ weatherOverride: 'snow' })
    expect(host.getSetting('automap-reveal', 'weatherOverride')).toBe('snow')
    expect(session.weather.override).toBe('snow')

    // 3. An invalid mode is rejected by the host and isolated as a plugin error.
    await host.setEnabled('bad-weather', true)
    const bad = host.list().find((p) => p.id === 'bad-weather')
    expect(bad?.error).toMatch(/Invalid weatherOverride "fog" from plugin "bad-weather"/)
    expect(settingsStore.get().weatherOverride).toBe('snow')

    await host.destroy()
    session.destroy()
    toolbar.destroy()
  })

  it('enforces Unified Plugin Bilingual (zh / en) i18n Specification across all BUILTIN_PLUGINS descriptors, dictionaries, runtime statuses, and toolbar updates', async () => {
    const assertPureLocalizedText = (label: string, text: LocalizedText): void => {
      expect(isValidLocalizedText(text), `${label} must be valid LocalizedText`).toBe(true)
      expect(
        containsCjkCharacters(text.en),
        `${label}.en must not contain CJK characters: "${text.en}"`,
      ).toBe(false)
    }

    // 1. Audit all BUILTIN_PLUGINS static descriptors (name, description, settings, options, actions)
    for (const plugin of BUILTIN_PLUGINS) {
      assertPureLocalizedText(`${plugin.id}.name`, plugin.name)
      assertPureLocalizedText(`${plugin.id}.description`, plugin.description)
      for (const setting of plugin.settings ?? []) {
        assertPureLocalizedText(`${plugin.id}.setting.${setting.key}`, setting.label)
        if (setting.kind === 'select') {
          for (const opt of setting.options) {
            assertPureLocalizedText(
              `${plugin.id}.setting.${setting.key}.option.${opt.value}`,
              opt.label,
            )
          }
        }
      }
      for (const action of plugin.actions ?? []) {
        assertPureLocalizedText(`${plugin.id}.action.${action.id}`, action.label)
      }
    }

    // 2. Audit standalone plugin dictionaries (STATS_I18N & DROP_I18N)
    expect(() => validatePluginI18nDictionary('kill-stats', STATS_I18N)).not.toThrow()
    expect(() => validatePluginI18nDictionary('drop-tracker', DROP_I18N)).not.toThrow()

    // 3. Verify createPluginI18n interpolation and fail-fast validation on CJK in en
    const sampleT = createPluginI18n('sample', {
      greeting: {
        zh: '已点亮 {lit}/{total}',
        en: 'Lit {lit}/{total}',
      },
    })
    expect(sampleT('greeting', 'zh', { lit: 3, total: 10 })).toBe('已点亮 3/10')
    expect(sampleT('greeting', 'en', { lit: 3, total: 10 })).toBe('Lit 3/10')
    expect(() =>
      createPluginI18n('bad-dict', {
        mixed: {
          zh: '中文',
          en: 'English (中文)',
        },
      }),
    ).toThrow(/has CJK characters in en translation/)

    // 4. Verify localizeKillSkipReason translates known skip reasons without leaking English into zh or CJK into en
    for (const reason of [
      'incomplete character identity (host, realm, account, charName)',
      'GameFlags (0x01) difficulty has not been received in this game',
      'missing or invalid character class (expected integer 0..6)',
      'missing or invalid character level (expected finite integer >= 1)',
      'missing authoritative world mode flags (hardcore, expansion, ladder)',
    ]) {
      const localized = localizeKillSkipReason(reason)
      assertPureLocalizedText(`skipReason(${reason})`, localized)
      expect(containsCjkCharacters(localized.zh)).toBe(true)
    }

    // 5. Verify runtime getStatus() across all BUILTIN_PLUGINS and fail-fast validation on invalid getStatus()/toolbar update
    const settingsStore = new SettingsStore({
      storage: new MemoryStorage(),
      defaultLang: 'zh',
      syncGlobalLang: false,
    })
    const toolbar = new Toolbar({ store: settingsStore })
    const session = new OnlineSession({ settingsStore })
    const badStatusPlugin: D2WebPlugin = {
      id: 'bad-status',
      name: { zh: '坏状态', en: 'Bad Status' },
      description: { zh: '测试', en: 'Test' },
      defaultEnabled: true,
      activate(ctx) {
        const handle = ctx.toolbar.addButton({
          id: 'btn',
          label: { zh: '按钮', en: 'Button' },
          onClick() {},
        })
        expect(() =>
          handle.update?.({ label: { zh: '', en: 'Empty zh' } }),
        ).toThrow(/toolbar update must provide non-empty localized label/)
        return {
          getStatus() {
            return { level: 'ok', text: { zh: '正常', en: '' } }
          },
          deactivate() {},
        }
      },
    }
    const allPlugins = [...BUILTIN_PLUGINS, badStatusPlugin] as const
    const configStore = new PluginConfigStore(allPlugins, { storage: new MemoryStorage() })
    const host = new PluginHost({
      plugins: allPlugins,
      configStore,
      session,
      toolbar: {
        setPluginsButtonState() {},
        addContribution: (spec) => toolbar.addContribution(spec),
      },
      settingsStore,
      enforceClientDefaults: false,
      autoStart: false,
      // Production main.ts always wires the Quick Cast port (Issue #952); mirror that here
      // so the quick-cast plugin activates cleanly instead of fail-fast on a missing port.
      quickCast: {
        isEnabled: () => false,
        setEnabled() {},
      },
      ...Object.fromEntries(
        ['dragInteract', 'stashDepositAll', 'xpBar', 'autoGoldPickup', 'upgradeHints', 'monsterResists'].map((name) => [name, { isEnabled: () => false, setEnabled() {} }]),
      ),
      autoCombat: { getKey: () => null, setKey() {} },
      autoPotion: { getThresholds: () => null, setThresholds() {} },
      itemInfo: { getConfig: () => null, setConfig() {} },
    })
    await host.start()

    for (const plugin of BUILTIN_PLUGINS) {
      const status = host.getStatus(plugin.id)
      assertPureLocalizedText(`${plugin.id}.getStatus()`, status.text)
    }

    const badStatus = host.getStatus('bad-status')
    expect(badStatus.level).toBe('error')
    expect(badStatus.text.en).toMatch(/getStatus\(\) must return/)

    await host.destroy()
    session.destroy()
    toolbar.destroy()
  })
})



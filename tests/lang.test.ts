import { afterEach, describe, expect, it } from 'vitest'
import {
  CHINESE_ENTRY_PAGES,
  DEFAULT_GAME_LANG,
  DEFAULT_TBL_LANG,
  ENGLISH_ENTRY_PAGES,
  detectInitialLang,
  detectLangFromUrl,
  getGameLang,
  getTblLang,
  onGameLangChange,
  onLangChange,
  onTblLangChange,
  resolveLangFromPathname,
  setGameLang,
  setLang,
  setTblLang,
} from '../src/client/i18n/lang.ts'

describe('i18n lang.ts — URL path resolution & fail-fast listener error propagation (Issue #712)', () => {
  afterEach(() => {
    setGameLang(null)
  })

  it('exports canonical entry page lists and resolves pathname deterministically', () => {
    expect(DEFAULT_GAME_LANG).toBe('zh')
    expect(DEFAULT_TBL_LANG).toBe('CHI')
    expect(ENGLISH_ENTRY_PAGES).toContain('acts-en.html')
    expect(ENGLISH_ENTRY_PAGES).toContain('bnet.html')
    expect(CHINESE_ENTRY_PAGES).toContain('acts-zh.html')
    expect(CHINESE_ENTRY_PAGES).toContain('acts.html')

    expect(resolveLangFromPathname('/acts-en.html')).toBe('en')
    expect(resolveLangFromPathname('/arena-en.html')).toBe('en')
    expect(resolveLangFromPathname('/bnet.html')).toBe('en')
    expect(resolveLangFromPathname('/play-en.html')).toBe('en')

    expect(resolveLangFromPathname('/acts-zh.html')).toBe('zh')
    expect(resolveLangFromPathname('/arena-zh.html')).toBe('zh')
    expect(resolveLangFromPathname('/acts.html')).toBe('zh')
    expect(resolveLangFromPathname('/arena.html')).toBe('zh')
    expect(resolveLangFromPathname('/index.html')).toBe('zh')
    expect(resolveLangFromPathname('index.html')).toBe('zh')

    expect(resolveLangFromPathname('/plugins/kill-stats/index.html')).toBeNull()
    expect(resolveLangFromPathname('/plugins/drop-tracker/index.html')).toBeNull()
    expect(resolveLangFromPathname('/drops.html')).toBeNull()
    expect(resolveLangFromPathname('/stats.html')).toBeNull()
    expect(resolveLangFromPathname('/play.html')).toBeNull()
    expect(resolveLangFromPathname('/unknown-route')).toBeNull()
  })

  it('resolves detectLangFromUrl across query params, entry pages, and backward-compatible default', () => {
    expect(detectLangFromUrl('http://localhost/acts-en.html')).toBe('ENG')
    expect(detectLangFromUrl('http://localhost/acts-zh.html')).toBe('CHI')
    expect(detectLangFromUrl('http://localhost/acts.html')).toBe('CHI')
    expect(detectLangFromUrl('http://localhost/acts.html?lang=en')).toBe('ENG')
    expect(detectLangFromUrl('http://localhost/acts-en.html?lang=zh')).toBe('CHI')
    expect(detectLangFromUrl('http://localhost/unrecognized.html')).toBe('CHI')
    expect(detectInitialLang()).toBe('zh')
  })

  it('synchronizes plugin pages (/plugins/*/index.html, /drops.html, /stats.html) with main controller d2web.settings.v1 lang', () => {
    const prevWin = (globalThis as { window?: unknown }).window
    try {
      for (const pathname of [
        '/plugins/kill-stats/index.html',
        '/plugins/drop-tracker/index.html',
        '/drops.html',
        '/stats.html',
      ]) {
        ;(globalThis as { window?: unknown }).window = {
          location: { pathname, search: '' },
          localStorage: {
            getItem: (k: string) =>
              k === 'd2web.settings.v1' ? JSON.stringify({ lang: 'en' }) : null,
          },
        }
        expect(detectInitialLang({ preferStoredSetting: true })).toBe('en')
        expect(detectInitialLang()).toBe('en')

        ;(globalThis as { window?: unknown }).window = {
          location: { pathname, search: '' },
          localStorage: {
            getItem: (k: string) =>
              k === 'd2web.settings.v1' ? JSON.stringify({ lang: 'zh' }) : null,
          },
        }
        expect(detectInitialLang({ preferStoredSetting: true })).toBe('zh')
      }
    } finally {
      ;(globalThis as { window?: unknown }).window = prevWin
    }
  })

  it('propagates a single listener error fail-fast instead of silently swallowing it', () => {
    const unsub = onLangChange((lang) => {
      throw new Error(`Font atlas reload failed for ${lang}`)
    })
    try {
      expect(() => setLang('en')).toThrow('Font atlas reload failed for en')
      expect(getGameLang()).toBe('en')
      expect(getTblLang()).toBe('ENG')
    } finally {
      unsub()
    }
  })

  it('notifies all remaining listeners and throws AggregateError when multiple listeners fail', () => {
    const seen: string[] = []
    const unsub1 = onTblLangChange((tbl) => {
      seen.push(`tbl:${tbl}`)
      throw new Error('First tbl listener failure')
    })
    const unsub2 = onGameLangChange((lang) => {
      seen.push(`game:${lang}`)
      throw new Error('Second gameLang listener failure')
    })
    const unsub3 = onGameLangChange((lang) => {
      seen.push(`ok:${lang}`)
    })

    try {
      let caught: unknown = null
      try {
        setTblLang('ENG')
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(AggregateError)
      const agg = caught as AggregateError
      expect(agg.errors).toHaveLength(2)
      expect((agg.errors[0] as Error).message).toBe('First tbl listener failure')
      expect((agg.errors[1] as Error).message).toBe('Second gameLang listener failure')
      // All 3 listeners must have been invoked despite earlier listener throws
      expect(seen).toEqual(['tbl:ENG', 'game:en', 'ok:en'])
    } finally {
      unsub1()
      unsub2()
      unsub3()
    }
  })
})

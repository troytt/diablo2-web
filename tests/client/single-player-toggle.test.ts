import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createSiteConfigHttpMiddleware,
  parseExplicitBooleanFlag,
  resolveServerSiteConfig,
} from '../../src/baker/io/site-config.ts'
import { shouldRedirectUnknownPageToHome } from '../../src/baker/io/server-status-probe.ts'
import { loadSiteConfig, parseSinglePlayerFlag } from '../../src/client/config/site-config.ts'
import { createInitialFlowState } from '../../src/client/frontend/flow-state.ts'
import {
  FrontendRenderer,
  type FrontendManifest,
} from '../../src/client/frontend/frontend-renderer.ts'
import { shouldBypassCache } from '../../src/client/sw/sw.ts'
import {
  INTENTIONALLY_UNCACHED_PUBLIC_FILES,
  isCacheableAssetPath,
} from '../../src/common/pack-contract/index.ts'

function invokeMiddleware(
  mw: (req: IncomingMessage, res: ServerResponse, next: () => void) => void,
  method: string,
  url: string,
): { statusCode: number; headers: Record<string, string>; body: string; passedThrough: boolean } {
  let passedThrough = false
  let body = ''
  const headers: Record<string, string> = {}
  const req = { method, url } as unknown as IncomingMessage
  const res = {
    statusCode: 200,
    setHeader(name: string, val: string) {
      headers[name.toLowerCase()] = String(val)
    },
    end(chunk?: string) {
      if (chunk) body += chunk
    },
  } as unknown as ServerResponse

  mw(req, res, () => {
    passedThrough = true
  })
  return { statusCode: res.statusCode, headers, body, passedThrough }
}

describe('Single Player Deployment Switch (default disabled & unavailable)', () => {
  const manifestPath = join(process.cwd(), 'public', 'ui', 'frontend', 'manifest.json')
  const fullManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FrontendManifest

  function createMenuRenderer(state = createInitialFlowState()): FrontendRenderer {
    const fakeCanvas = {
      getContext: () => ({ imageSmoothingEnabled: false }),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement
    const renderer = new FrontendRenderer(fakeCanvas, state)
    renderer.manifest = fullManifest
    renderer.ready = true
    return renderer
  }

  it('defaults flowState.singlePlayerEnabled to false and keeps Single Player button disabled even when onSinglePlayer is wired', () => {
    const state = createInitialFlowState()
    expect(state.singlePlayerEnabled).toBe(false)

    const renderer = createMenuRenderer(state)
    const onSinglePlayer = vi.fn()
    renderer.setAsyncHandlers({ onSinglePlayer })

    const spBtn = renderer.getActiveButtons().find((b) => b.id === 'single_player')
    expect(spBtn).toBeDefined()
    expect(spBtn?.disabled).toBe(true)

    spBtn?.onClick()
    expect(onSinglePlayer).not.toHaveBeenCalled()
    expect(state.stage).toBe('main_menu')
    expect(state.playMode).toBe('bnet')
  })

  it('keeps Single Player button disabled when singlePlayerEnabled is true but no onSinglePlayer handler is registered', () => {
    const state = createInitialFlowState()
    state.singlePlayerEnabled = true
    const renderer = createMenuRenderer(state)

    const spBtn = renderer.getActiveButtons().find((b) => b.id === 'single_player')
    expect(spBtn?.disabled).toBe(true)
    spBtn?.onClick()
    expect(state.stage).toBe('main_menu')
  })

  it('enables Single Player button and transitions into Single Player flow only when both singlePlayerEnabled and onSinglePlayer are active', () => {
    const state = createInitialFlowState()
    state.singlePlayerEnabled = true
    const renderer = createMenuRenderer(state)
    const onSinglePlayer = vi.fn()
    renderer.setAsyncHandlers({ onSinglePlayer })

    const spBtn = renderer.getActiveButtons().find((b) => b.id === 'single_player')
    expect(spBtn?.disabled).toBe(false)

    spBtn?.onClick()
    expect(onSinglePlayer).toHaveBeenCalledTimes(1)
    expect(state.playMode).toBe('single')
    expect(state.stage).toBe('char_create')
  })

  it('loadSiteConfig fails closed (singlePlayerEnabled: false) on 404, malformed JSON, network failure, or missing flag', async () => {
    const notFound = await loadSiteConfig({
      buildEnvSinglePlayer: undefined,
      fetchFn: async () => new Response('Not Found', { status: 404 }),
    })
    expect(notFound).toEqual({ singlePlayerEnabled: false })

    const invalidJson = await loadSiteConfig({
      buildEnvSinglePlayer: undefined,
      fetchFn: async () => new Response('{bad-json', { status: 200 }),
    })
    expect(invalidJson).toEqual({ singlePlayerEnabled: false })

    const emptyObject = await loadSiteConfig({
      buildEnvSinglePlayer: undefined,
      fetchFn: async () => new Response('{}', { status: 200 }),
    })
    expect(emptyObject).toEqual({ singlePlayerEnabled: false })

    const networkErr = await loadSiteConfig({
      buildEnvSinglePlayer: undefined,
      fetchFn: async () => {
        throw new Error('offline')
      },
    })
    expect(networkErr).toEqual({ singlePlayerEnabled: false })
  })

  it('loadSiteConfig respects remote site-config.json over build env and falls back to VITE_ENABLE_SINGLE_PLAYER when 404', async () => {
    const remoteEnabled = await loadSiteConfig({
      buildEnvSinglePlayer: 'false',
      fetchFn: async (_url, init) => {
        expect(init?.cache).toBe('no-store')
        return new Response(JSON.stringify({ singlePlayerEnabled: true }), { status: 200 })
      },
    })
    expect(remoteEnabled).toEqual({ singlePlayerEnabled: true })

    const remoteDisabledOverridesBuild = await loadSiteConfig({
      buildEnvSinglePlayer: 'true',
      fetchFn: async () =>
        new Response(JSON.stringify({ singlePlayerEnabled: false }), { status: 200 }),
    })
    expect(remoteDisabledOverridesBuild).toEqual({ singlePlayerEnabled: false })

    const buildFallbackEnabled = await loadSiteConfig({
      buildEnvSinglePlayer: 'true',
      fetchFn: async () => new Response('Not Found', { status: 404 }),
    })
    expect(buildFallbackEnabled).toEqual({ singlePlayerEnabled: true })

    expect(parseSinglePlayerFlag('1')).toBe(true)
    expect(parseSinglePlayerFlag('0')).toBe(false)
    expect(parseSinglePlayerFlag('unexpected')).toBeUndefined()
    expect(parseExplicitBooleanFlag(true)).toBe(true)
    expect(parseExplicitBooleanFlag(false)).toBe(false)
  })

  it('createSiteConfigHttpMiddleware hot-reads public/site-config.json, prioritizes VITE_ENABLE_SINGLE_PLAYER, and sets no-store headers', () => {
    const tmpPublic = mkdtempSync(join(tmpdir(), 'd2w-site-cfg-'))
    try {
      const mwDefault = createSiteConfigHttpMiddleware({ publicDir: tmpPublic, env: {} })
      const resDefault = invokeMiddleware(mwDefault, 'GET', '/site-config.json')
      expect(resDefault.passedThrough).toBe(false)
      expect(resDefault.statusCode).toBe(200)
      expect(resDefault.headers['cache-control']).toContain('no-store')
      expect(JSON.parse(resDefault.body)).toEqual({ singlePlayerEnabled: false })

      writeFileSync(
        join(tmpPublic, 'site-config.json'),
        JSON.stringify({ singlePlayerEnabled: true }),
        'utf8',
      )
      const resSubpath = invokeMiddleware(mwDefault, 'GET', '/diablo2/site-config.json?ts=1')
      expect(JSON.parse(resSubpath.body)).toEqual({ singlePlayerEnabled: true })

      const mwEnvDisabled = createSiteConfigHttpMiddleware({
        publicDir: tmpPublic,
        env: { VITE_ENABLE_SINGLE_PLAYER: 'false' },
      })
      expect(
        resolveServerSiteConfig({
          publicDir: tmpPublic,
          env: { VITE_ENABLE_SINGLE_PLAYER: 'false' },
        }),
      ).toEqual({ singlePlayerEnabled: false })
      expect(
        JSON.parse(invokeMiddleware(mwEnvDisabled, 'GET', '/site-config.json').body),
      ).toEqual({ singlePlayerEnabled: false })

      const passOther = invokeMiddleware(mwDefault, 'GET', '/play.html')
      expect(passOther.passedThrough).toBe(true)
    } finally {
      rmSync(tmpPublic, { recursive: true, force: true })
    }
  })

  it('excludes site-config.json from Service Worker cache-first, asset-manifest roots, and unknown-page home redirect', () => {
    expect(INTENTIONALLY_UNCACHED_PUBLIC_FILES).toContain('site-config.json')
    expect(isCacheableAssetPath('/site-config.json')).toBe(false)
    expect(isCacheableAssetPath('/diablo2/site-config.json')).toBe(false)
    expect(
      shouldBypassCache(
        new Request('https://example.com/site-config.json'),
        'https://example.com',
      ),
    ).toBe(true)
    expect(
      shouldRedirectUnknownPageToHome('/site-config.json', { rootDir: process.cwd() }),
    ).toBe(false)
    expect(
      shouldRedirectUnknownPageToHome('/diablo2/site-config.json', { rootDir: process.cwd() }),
    ).toBe(false)
    expect(readFileSync(join(process.cwd(), '.gitignore'), 'utf8')).toContain(
      'public/site-config.json',
    )
  })
})

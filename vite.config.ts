import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { refreshAssetManifestPublicSubdirs } from './src/baker/io/asset-manifest.ts'
import { createBugReportHttpMiddleware } from './src/baker/io/bug-report-store.ts'
import { createPlayLogHttpMiddleware } from './src/baker/io/play-log-store.ts'
import { createSiteConfigHttpMiddleware } from './src/baker/io/site-config.ts'
import {
  createHomeFallbackHttpMiddleware,
  createServerStatusHttpMiddleware,
} from './src/baker/io/server-status-probe.ts'
import { createSidecarAssetHttpMiddleware } from './src/baker/io/sidecar-compression.ts'
import type { AssetManifest } from './src/common/pack-contract/index.ts'
import { createK0ShowcaseHttpMiddleware } from './tools/oracle/k0-showcase-server.ts'
import { createK1ShowcaseHttpMiddleware } from './tools/oracle/k1-showcase-server.ts'
import { createK2ShowcaseHttpMiddleware } from './tools/oracle/k2-showcase-server.ts'
import { createK3ShowcaseHttpMiddleware } from './tools/oracle/k3-showcase-server.ts'
import { createK4ShowcaseHttpMiddleware } from './tools/oracle/k4-showcase-server.ts'
import { createK5ShowcaseHttpMiddleware } from './tools/oracle/k5-showcase-server.ts'
import { createK6ShowcaseHttpMiddleware } from './tools/oracle/k6-showcase-server.ts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = process.env.D2_VITE_PUBLIC_DIR
  ? resolve(process.env.D2_VITE_PUBLIC_DIR)
  : resolve(__dirname, 'public')

function discoverPluginHtmlEntries(rootDir: string): Record<string, string> {
  const pluginsDir = resolve(rootDir, 'plugins')
  if (!existsSync(pluginsDir)) return {}
  const entries: Record<string, string> = {}
  for (const name of readdirSync(pluginsDir).sort()) {
    const pluginDir = resolve(pluginsDir, name)
    if (!statSync(pluginDir).isDirectory()) continue
    const htmlPath = resolve(pluginDir, 'index.html')
    if (existsSync(htmlPath)) {
      entries[`plugin-${name}`] = htmlPath
    }
  }
  return entries
}

/**
 * Vite configuration for the Diablo II web client (`play.html`, `plugins/<id>/index.html`) and the
 * standalone kernel showcase pages (`showcase/k1/index.html`, `showcase/k2/index.html`, which are not game plugins).
 */
export default defineConfig({
  publicDir: PUBLIC_DIR,
  plugins: [
    {
      name: 'd2-sidecar-asset-compression',
      configureServer(server) {
        server.middlewares.use(
          createSidecarAssetHttpMiddleware({ publicDir: PUBLIC_DIR }),
        )
      },
      configurePreviewServer(server) {
        server.middlewares.use(
          createSidecarAssetHttpMiddleware({ publicDir: PUBLIC_DIR }),
        )
      },
    },
    {
      name: 'd2-bug-report-api',
      configureServer(server) {
        server.middlewares.use(
          createBugReportHttpMiddleware({ bugsDir: resolve(__dirname, 'bugs') }),
        )
      },
      configurePreviewServer(server) {
        server.middlewares.use(
          createBugReportHttpMiddleware({ bugsDir: resolve(__dirname, 'bugs') }),
        )
      },
    },
    {
      name: 'd2-play-log-api',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use(createPlayLogHttpMiddleware(resolve(__dirname, 'scratch/play-logs')))
      },
    },
    {
      name: 'd2-server-status-api',
      configureServer(server) {
        server.middlewares.use(createServerStatusHttpMiddleware())
      },
      configurePreviewServer(server) {
        server.middlewares.use(createServerStatusHttpMiddleware())
      },
    },
    {
      name: 'd2-site-config-api',
      configureServer(server) {
        server.middlewares.use(
          createSiteConfigHttpMiddleware({ publicDir: PUBLIC_DIR }),
        )
      },
      configurePreviewServer(server) {
        server.middlewares.use(
          createSiteConfigHttpMiddleware({ publicDir: PUBLIC_DIR }),
        )
      },
    },
    {
      name: 'd2-k0-showcase-api',
      configureServer(server) {
        server.middlewares.use(createK0ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
      configurePreviewServer(server) {
        server.middlewares.use(createK0ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
    },
    {
      name: 'd2-k1-showcase-api',
      configureServer(server) {
        server.middlewares.use(createK1ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
      configurePreviewServer(server) {
        server.middlewares.use(createK1ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
    },
    {
      name: 'd2-k2-showcase-api',
      configureServer(server) {
        server.middlewares.use(createK2ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
      configurePreviewServer(server) {
        server.middlewares.use(createK2ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
    },
    {
      name: 'd2-k3-showcase-api',
      configureServer(server) {
        server.middlewares.use(createK3ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
      configurePreviewServer(server) {
        server.middlewares.use(createK3ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
    },
    {
      name: 'd2-k4-showcase-api',
      configureServer(server) {
        server.middlewares.use(createK4ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
      configurePreviewServer(server) {
        server.middlewares.use(createK4ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
    },
    {
      name: 'd2-k5-showcase-api',
      configureServer(server) {
        server.middlewares.use(createK5ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
      configurePreviewServer(server) {
        server.middlewares.use(createK5ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
    },
    {
      name: 'd2-k6-showcase-api',
      configureServer(server) {
        server.middlewares.use(createK6ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
      configurePreviewServer(server) {
        server.middlewares.use(createK6ShowcaseHttpMiddleware({ rootDir: __dirname }))
      },
    },
    {
      name: 'd2web-sw-dev-alias',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && /^\/(?:diablo2\/)?sw\.js(?:\?.*)?$/.test(req.url)) {
            req.url = '/src/client/sw/sw.ts'
            next()
            return
          }
          if (
            req.method === 'GET' &&
            req.url &&
            /^\/(?:diablo2\/)?asset-manifest\.json(?:\?.*)?$/.test(req.url)
          ) {
            try {
              const publicDir = PUBLIC_DIR
              const manifestFile = resolve(publicDir, 'asset-manifest.json')
              const baseManifest = existsSync(manifestFile)
                ? (JSON.parse(readFileSync(manifestFile, 'utf8')) as AssetManifest)
                : null
              const fresh = refreshAssetManifestPublicSubdirs({
                baseManifest,
                publicDir,
                subdirs: ['ui', 'overlays'],
              })
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.setHeader('Cache-Control', 'no-store')
              res.end(`${JSON.stringify(fresh)}\n`)
              return
            } catch {
              // Fall through to static file serving if refresh fails
            }
          }
          next()
        })
      },
    },
    {
      name: 'd2-home-and-routes',
      configureServer(server) {
        const homeFallback = createHomeFallbackHttpMiddleware({ rootDir: __dirname })
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url?.startsWith('/?')) {
            req.url = `/index.html${req.url.slice(1)}`
          } else if (req.url === '/drops.html' || req.url?.startsWith('/drops.html?')) {
            req.url = `/plugins/drop-tracker/index.html${req.url.slice('/drops.html'.length)}`
          } else if (req.url === '/trade.html' || req.url?.startsWith('/trade.html?')) {
            req.url = `/plugins/trade-hall/index.html${req.url.slice('/trade.html'.length)}`
          } else if (req.url === '/k0-showcase.html' || req.url?.startsWith('/k0-showcase.html?')) {
            req.url = `/showcase/k0/index.html${req.url.slice('/k0-showcase.html'.length)}`
          } else if (req.url === '/k1-showcase.html' || req.url?.startsWith('/k1-showcase.html?')) {
            req.url = `/showcase/k1/index.html${req.url.slice('/k1-showcase.html'.length)}`
          } else if (req.url === '/k2-showcase.html' || req.url?.startsWith('/k2-showcase.html?')) {
            req.url = `/showcase/k2/index.html${req.url.slice('/k2-showcase.html'.length)}`
          } else if (req.url === '/k3-showcase.html' || req.url?.startsWith('/k3-showcase.html?')) {
            req.url = `/showcase/k3/index.html${req.url.slice('/k3-showcase.html'.length)}`
          } else if (req.url === '/k4-showcase.html' || req.url?.startsWith('/k4-showcase.html?')) {
            req.url = `/showcase/k4/index.html${req.url.slice('/k4-showcase.html'.length)}`
          } else if (req.url === '/k5-showcase.html' || req.url?.startsWith('/k5-showcase.html?')) {
            req.url = `/showcase/k5/index.html${req.url.slice('/k5-showcase.html'.length)}`
          } else if (req.url === '/k6-showcase.html' || req.url?.startsWith('/k6-showcase.html?')) {
            req.url = `/showcase/k6/index.html${req.url.slice('/k6-showcase.html'.length)}`
          } else if (req.url === '/ui/fonts/D2Exocet.ttf' || req.url?.startsWith('/ui/fonts/D2Exocet.ttf?')) {
            req.url = '/ui/fonts/ExocetBlizzardMedium.otf'
          } else if (req.url === '/ui/fonts/D2Formal436.ttf' || req.url?.startsWith('/ui/fonts/D2Formal436.ttf?')) {
            req.url = '/ui/fonts/Formal436BT.ttf'
          }
          homeFallback(req, res, next)
        })
      },
      configurePreviewServer(server) {
        const homeFallback = createHomeFallbackHttpMiddleware({ rootDir: __dirname })
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url?.startsWith('/?')) {
            req.url = `/index.html${req.url.slice(1)}`
          } else if (req.url === '/drops.html' || req.url?.startsWith('/drops.html?')) {
            req.url = `/plugins/drop-tracker/index.html${req.url.slice('/drops.html'.length)}`
          } else if (req.url === '/trade.html' || req.url?.startsWith('/trade.html?')) {
            req.url = `/plugins/trade-hall/index.html${req.url.slice('/trade.html'.length)}`
          } else if (req.url === '/k0-showcase.html' || req.url?.startsWith('/k0-showcase.html?')) {
            req.url = `/showcase/k0/index.html${req.url.slice('/k0-showcase.html'.length)}`
          } else if (req.url === '/k1-showcase.html' || req.url?.startsWith('/k1-showcase.html?')) {
            req.url = `/showcase/k1/index.html${req.url.slice('/k1-showcase.html'.length)}`
          } else if (req.url === '/k2-showcase.html' || req.url?.startsWith('/k2-showcase.html?')) {
            req.url = `/showcase/k2/index.html${req.url.slice('/k2-showcase.html'.length)}`
          } else if (req.url === '/k3-showcase.html' || req.url?.startsWith('/k3-showcase.html?')) {
            req.url = `/showcase/k3/index.html${req.url.slice('/k3-showcase.html'.length)}`
          } else if (req.url === '/k4-showcase.html' || req.url?.startsWith('/k4-showcase.html?')) {
            req.url = `/showcase/k4/index.html${req.url.slice('/k4-showcase.html'.length)}`
          } else if (req.url === '/k5-showcase.html' || req.url?.startsWith('/k5-showcase.html?')) {
            req.url = `/showcase/k5/index.html${req.url.slice('/k5-showcase.html'.length)}`
          } else if (req.url === '/k6-showcase.html' || req.url?.startsWith('/k6-showcase.html?')) {
            req.url = `/showcase/k6/index.html${req.url.slice('/k6-showcase.html'.length)}`
          } else if (req.url === '/ui/fonts/D2Exocet.ttf' || req.url?.startsWith('/ui/fonts/D2Exocet.ttf?')) {
            req.url = '/ui/fonts/ExocetBlizzardMedium.otf'
          } else if (req.url === '/ui/fonts/D2Formal436.ttf' || req.url?.startsWith('/ui/fonts/D2Formal436.ttf?')) {
            req.url = '/ui/fonts/Formal436BT.ttf'
          }
          homeFallback(req, res, next)
        })
      },
    },
    {
      name: 'd2-drops-html-build-alias',
      enforce: 'post',
      generateBundle(_options, bundle) {
        const dropHtmlAsset = bundle['plugins/drop-tracker/index.html']
        if (dropHtmlAsset && dropHtmlAsset.type === 'asset') {
          this.emitFile({
            type: 'asset',
            fileName: 'drops.html',
            source: dropHtmlAsset.source,
          })
        }
        const tradeHtmlAsset = bundle['plugins/trade-hall/index.html']
        if (tradeHtmlAsset && tradeHtmlAsset.type === 'asset') {
          this.emitFile({
            type: 'asset',
            fileName: 'trade.html',
            source: tradeHtmlAsset.source,
          })
        }
        for (const kId of ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6'] as const) {
          const asset = bundle[`showcase/${kId}/index.html`]
          if (asset && asset.type === 'asset') {
            this.emitFile({
              type: 'asset',
              fileName: `${kId}-showcase.html`,
              source: asset.source,
            })
          }
        }
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    ...(process.env.VITE_ALLOWED_HOSTS
      ? {
          allowedHosts: process.env.VITE_ALLOWED_HOSTS.split(',')
            .map(h => h.trim())
            .filter(Boolean),
        }
      : {}),
    watch: {
      followSymlinks: false,
      ignored: [
        '**/node_modules/**',
        '**/samples/**',
        '**/public/**',
        '**/bugs/**',
        '**/.worktrees/**',
        '**/dist/**',
        '**/.git/**',
      ],
    },
    proxy: {
      '/d2net': {
        target: 'wss://www.laiseek.xyz',
        ws: true,
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
        ...discoverPluginHtmlEntries(__dirname),
        'showcase-k0': resolve(__dirname, 'showcase/k0/index.html'),
        'showcase-k1': resolve(__dirname, 'showcase/k1/index.html'),
        'showcase-k2': resolve(__dirname, 'showcase/k2/index.html'),
        'showcase-k3': resolve(__dirname, 'showcase/k3/index.html'),
        'showcase-k4': resolve(__dirname, 'showcase/k4/index.html'),
        'showcase-k5': resolve(__dirname, 'showcase/k5/index.html'),
        'showcase-k6': resolve(__dirname, 'showcase/k6/index.html'),
        sw: resolve(__dirname, 'src/client/sw/sw.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js',
      },
    },
  },
})

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { refreshAssetManifestPublicSubdirs } from './src/baker/io/asset-manifest.ts'
import { createBugReportHttpMiddleware } from './src/baker/io/bug-report-store.ts'
import { createPlayLogHttpMiddleware } from './src/baker/io/play-log-store.ts'
import {
  createHomeFallbackHttpMiddleware,
  createServerStatusHttpMiddleware,
} from './src/baker/io/server-status-probe.ts'
import type { AssetManifest } from './src/common/pack-contract/index.ts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

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
 * Vite configuration for the Diablo II web client (`play.html` and `plugins/<id>/index.html`).
 */
export default defineConfig({
  plugins: [
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
              const publicDir = resolve(__dirname, 'public')
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
        sw: resolve(__dirname, 'src/client/sw/sw.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js',
      },
    },
  },
})

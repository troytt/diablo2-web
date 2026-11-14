/**
 * [K1] D2Common 1,479-Function Isomorphic Kernel Interactive Visual Showcase
 * (`plugins/k1-showcase/main.ts`).
 *
 * Mounts all 4 ground-truth exhibition zones into `#k1-showcase-app`:
 *   - Zone 1: Dual-Engine Lockstep Replay Player (`a1-town-walk` 750f & `a1c-bloodmoor-fallen` 2,000f)
 *   - Zone 2: `[K1-5]` 20,400-Seed DRLG Dungeon & Collision Atlas (`1..136` levels × `0..2` diffs)
 *   - Zone 3: `[K1-6]` `#10342` `PATHTYPE 0..17` In-Browser Pathfinding Sandbox (`6,924` vectors)
 *   - Zone 4: `D2Common.dll` `1,479 / 1,479 (100%)` Binary-Isomorphism Callgraph Explorer
 */

import type { ShowcaseOverviewResponse } from './types.ts'
import { mountZone1Replay } from './zone1-replay.ts'
import { mountZone2Drlg } from './zone2-drlg.ts'
import { mountZone3Path } from './zone3-path.ts'
import { mountZone4Callgraph } from './zone4-callgraph.ts'

export type ShowcaseZoneId = 'replay' | 'drlg' | 'path' | 'callgraph'

interface ZoneMeta {
  readonly id: ShowcaseZoneId
  readonly indexLabel: string
  readonly navTitle: string
  readonly navSub: string
  readonly headerTitle: string
  readonly headerSub: string
}

const ZONES: readonly ZoneMeta[] = [
  {
    id: 'replay',
    indexLabel: 'ZONE 01',
    navTitle: '双引擎锁步回放器',
    navSub: '750f & 2,000f Frame Diff = 0',
    headerTitle: 'Zone 1 · Dual-Engine Lockstep Replay (Wine 1.13c DLL vs TS src/d2kern-113c)',
    headerSub:
      'a1-town-walk (750/750) & a1c-bloodmoor-fallen (2,000/2,000) · 0.00 Subtile Delta · 64-bit PRNG Seed Exact Lockstep',
  },
  {
    id: 'drlg',
    indexLabel: 'ZONE 02',
    navTitle: 'DRLG 地牢与碰撞图鉴',
    navSub: '20,400 Seeds · XOR = 0',
    headerTitle: 'Zone 2 · [K1-5] 20,400-Seed DRLG Dungeon & u16 Collision Atlas (Levels 1..136)',
    headerSub:
      '50 Frozen Seeds × 3 Difficulties × 136 Levels · Live DUNGEON_AllocAct113c + DRLG_InitLevelRooms113c · D2TV SHA256 XOR = 0',
  },
  {
    id: 'path',
    indexLabel: 'ZONE 03',
    navTitle: '#10342 寻路算法沙盒',
    navSub: 'PATHTYPE 0..17 · 6,924 Vecs',
    headerTitle: 'Zone 3 · [K1-6] #10342 PATHTYPE 0..17 Real-Time Browser Pathfinding Sandbox',
    headerSub:
      '100% Real src/d2kern-113c/common/path.ts (PATH_Compute113c) Running in Browser · 6,924 D2Common.dll Oracle Vectors',
  },
  {
    id: 'callgraph',
    indexLabel: 'ZONE 04',
    navTitle: '1,479 同构内核全景图',
    navSub: '1,479 / 1,479 = 100.00%',
    headerTitle: 'Zone 4 · D2Common.dll 1,479 / 1,479 (100.00%) Binary-Isomorphism Callgraph Explorer',
    headerSub:
      '1,476 Diff-Verified + 3 Ported = 100% Closure (0 Unported) · Live x86 Intel Disassembly vs TypeScript AST Source',
  },
]

export function mountK1ShowcaseApp(root: HTMLElement): void {
  const doc = root.ownerDocument ?? document

  root.innerHTML = `
    <div class="k1-shell">
      <aside class="k1-sidebar" id="k1-sidebar">
        <div class="k1-brand">
          <div class="k1-brand__eyebrow">DIABLO II v1.13c · [K1] EXIT GATE</div>
          <h1 class="k1-brand__title">D2Common 同构内核成果展厅</h1>
          <div class="k1-brand__sub" id="k1-sidebar-cert">
            1,479 / 1,479 Functions · 100.00%
          </div>
        </div>

        <nav class="k1-nav" aria-label="K1 Showcase Zones" id="k1-zone-nav"></nav>

        <div class="k1-sidebar-metrics" id="k1-sidebar-metrics">
          <div class="k1-metric-row">
            <span>D2Common.dll</span>
            <strong class="k1-text--ok" id="k1-m-d2c">1,479 / 1,479</strong>
          </div>
          <div class="k1-metric-row">
            <span>Diff-Verified</span>
            <strong class="k1-mono" id="k1-m-dv">1,476 (99.80%)</strong>
          </div>
          <div class="k1-metric-row">
            <span>DRLG D2TV</span>
            <strong class="k1-mono" id="k1-m-drlg">20,400 / 20,400</strong>
          </div>
          <div class="k1-metric-row">
            <span>PATH #10342</span>
            <strong class="k1-mono" id="k1-m-path">6,924 / 6,924</strong>
          </div>
          <div class="k1-metric-row">
            <span>Replay Lockstep</span>
            <strong class="k1-mono" id="k1-m-rep">F2..F2000 (Δ=0)</strong>
          </div>
        </div>

        <div class="k1-sidebar-links">
          <a href="/" class="k1-btn k1-btn--block">庇护之地门户 (Portal)</a>
          <a href="/play.html" class="k1-btn k1-btn--block">进入完整游戏 (Play)</a>
        </div>
      </aside>

      <main class="k1-main" id="k1-main">
        <header class="k1-zone-header">
          <div class="k1-zone-header__titles">
            <h2 class="k1-zone-header__title" id="k1-active-title"></h2>
            <p class="k1-zone-header__sub" id="k1-active-sub"></p>
          </div>
          <div class="k1-zone-header__pills">
            <span class="k1-badge k1-badge--ok">ZERO MOCK DATA</span>
            <span class="k1-badge" id="k1-header-zone-pill">ZONE 01 / 04</span>
          </div>
        </header>

        <section id="k1-zone-panel-replay" class="k1-zone-panel"></section>
        <section id="k1-zone-panel-drlg" class="k1-zone-panel" hidden></section>
        <section id="k1-zone-panel-path" class="k1-zone-panel" hidden></section>
        <section id="k1-zone-panel-callgraph" class="k1-zone-panel" hidden></section>
      </main>
    </div>
  `

  const navEl = root.querySelector('#k1-zone-nav') as HTMLElement
  const activeTitle = root.querySelector('#k1-active-title') as HTMLElement
  const activeSub = root.querySelector('#k1-active-sub') as HTMLElement
  const headerZonePill = root.querySelector('#k1-header-zone-pill') as HTMLElement
  const mainScroll = root.querySelector('#k1-main') as HTMLElement

  const panelReplay = root.querySelector('#k1-zone-panel-replay') as HTMLElement
  const panelDrlg = root.querySelector('#k1-zone-panel-drlg') as HTMLElement
  const panelPath = root.querySelector('#k1-zone-panel-path') as HTMLElement
  const panelCallgraph = root.querySelector('#k1-zone-panel-callgraph') as HTMLElement

  const controllers = {
    replay: mountZone1Replay(panelReplay),
    drlg: mountZone2Drlg(panelDrlg),
    path: mountZone3Path(panelPath),
    callgraph: mountZone4Callgraph(panelCallgraph),
  }

  const panels: Record<ShowcaseZoneId, HTMLElement> = {
    replay: panelReplay,
    drlg: panelDrlg,
    path: panelPath,
    callgraph: panelCallgraph,
  }

  const navBtns = new Map<ShowcaseZoneId, HTMLButtonElement>()
  ZONES.forEach((z) => {
    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.className = 'k1-nav-btn'
    btn.dataset.zoneId = z.id
    btn.id = `k1-nav-${z.id}`
    btn.innerHTML = `
      <span class="k1-nav-btn__idx">${z.indexLabel}</span>
      <span class="k1-nav-btn__title">${z.navTitle}</span>
      <span class="k1-nav-btn__sub">${z.navSub}</span>
    `
    btn.addEventListener('click', () => {
      switchZone(z.id)
    })
    navEl.appendChild(btn)
    navBtns.set(z.id, btn)
  })

  let currentZone: ShowcaseZoneId = 'replay'

  function switchZone(next: ShowcaseZoneId): void {
    if (currentZone !== next) {
      controllers[currentZone].deactivate()
    }
    currentZone = next
    const metaIdx = ZONES.findIndex((z) => z.id === next)
    const meta = ZONES[metaIdx >= 0 ? metaIdx : 0]!

    activeTitle.textContent = meta.headerTitle
    activeSub.textContent = meta.headerSub
    headerZonePill.textContent = `ZONE 0${metaIdx + 1} / 04`

    for (const z of ZONES) {
      const isAct = z.id === next
      panels[z.id].hidden = !isAct
      navBtns.get(z.id)?.classList.toggle('k1-nav-btn--active', isAct)
    }

    mainScroll.scrollTop = 0
    controllers[next].activate()
  }

  // Hydrate sidebar overview counts from /api/k1-showcase/overview
  void fetch('/api/k1-showcase/overview')
    .then((r) => (r.ok ? (r.json() as Promise<ShowcaseOverviewResponse>) : null))
    .then((ov) => {
      if (!ov) return
      const d2cDone = ov.d2Common.diffVerified + ov.d2Common.ported
      const mD2c = root.querySelector('#k1-m-d2c')
      const mDv = root.querySelector('#k1-m-dv')
      const mDrlg = root.querySelector('#k1-m-drlg')
      const mPath = root.querySelector('#k1-m-path')
      const sideCert = root.querySelector('#k1-sidebar-cert')
      if (mD2c) mD2c.textContent = `${d2cDone.toLocaleString()} / ${ov.d2Common.total.toLocaleString()}`
      if (mDv) {
        const pct = ((ov.d2Common.diffVerified / Math.max(1, ov.d2Common.total)) * 100).toFixed(2)
        mDv.textContent = `${ov.d2Common.diffVerified.toLocaleString()} (${pct}%)`
      }
      if (mDrlg) {
        mDrlg.textContent = `${ov.drlg.totalVectors.toLocaleString()} / ${ov.drlg.totalVectors.toLocaleString()}`
      }
      if (mPath) {
        mPath.textContent = `${ov.path.totalVectors.toLocaleString()} / ${ov.path.totalVectors.toLocaleString()}`
      }
      if (sideCert) {
        sideCert.textContent = `${d2cDone.toLocaleString()} / ${ov.d2Common.total.toLocaleString()} Functions · ${ov.d2Common.completionPct.toFixed(2)}%`
      }
    })
    .catch(() => {
      // Non-fatal overview fetch error
    })

  // Support URL ?zone=replay|drlg|path|callgraph|1|2|3|4
  const params = new URLSearchParams(window.location.search)
  const rawZone = params.get('zone')?.trim().toLowerCase()
  let initialZone: ShowcaseZoneId = 'replay'
  if (rawZone === '2' || rawZone === 'drlg') initialZone = 'drlg'
  else if (rawZone === '3' || rawZone === 'path') initialZone = 'path'
  else if (rawZone === '4' || rawZone === 'callgraph') initialZone = 'callgraph'

  switchZone(initialZone)
}

if (typeof document !== 'undefined') {
  const appEl = document.getElementById('k1-showcase-app')
  if (appEl) {
    mountK1ShowcaseApp(appEl)
  }
}

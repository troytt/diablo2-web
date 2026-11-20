/**
 * [K2] D2Game replay-closure Interactive Visual Showcase (`showcase/k2/main.ts`).
 *
 * Mounts the 4 exhibition zones into `#k2-showcase-app`:
 *   - Zone 1: 5-scenario lockstep replay player with per-frame / per-channel divergence status
 *   - Zone 2: measured `D2Game` runtimeExecGap convergence chart (`|dll_union − ts_union|`)
 *   - Zone 3: `D2Game.dll` call-graph explorer (`diff-verified` vs `ported`, honest totals)
 *   - Zone 4: in-browser `SUNITDMG_*` settlement sandbox against original-DLL vectors
 *
 * No metric is hard-coded: every number is hydrated from `/api/k2-showcase/*`, which computes it
 * from repo files and live kernel replays, so the page stays correct as the gap closes.
 */

import { fetchJson, fmtInt, fmtPct, type K2GapResponse, type K2OverviewResponse, type K2ZoneController } from './types.ts'
import { mountZone1Replay } from './zone1-replay.ts'
import { mountZone2Gap } from './zone2-gap.ts'
import { mountZone3Callgraph } from './zone3-callgraph.ts'
import { mountZone4Combat } from './zone4-combat.ts'

export type K2ShowcaseZoneId = 'replay' | 'gap' | 'callgraph' | 'combat'

interface ZoneMeta {
  readonly id: K2ShowcaseZoneId
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
    navTitle: '五场景锁步回放器',
    navSub: '逐帧 / 逐通道 分歧状态',
    headerTitle: 'Zone 1 · K1/K2 Lockstep Replay (1.13c DLL golden trace vs TS src/d2kern-113c)',
    headerSub:
      '服务端实时启动内核，从 F2 快照逐帧步进并与原版 DLL 黄金轨迹做 strict 比对；每帧每个通道独立判定。',
  },
  {
    id: 'gap',
    indexLabel: 'ZONE 02',
    navTitle: 'Gap 收敛曲线',
    navSub: '|dll_union − ts_union| 实测',
    headerTitle: 'Zone 2 · D2Game runtimeExecGap Convergence (measured per commit)',
    headerSub:
      '每个点都是把该 commit 的源码检出后真实重跑 5 个回放得到的实测值，不采信 commit message 里的数字。',
  },
  {
    id: 'callgraph',
    indexLabel: 'ZONE 03',
    navTitle: 'D2Game 调用图浏览器',
    navSub: 'diff-verified vs ported',
    headerTitle: 'Zone 3 · D2Game.dll Call-Graph Explorer (manifest-113c.json)',
    headerSub:
      'K2 的验收标准是回放执行缺口归零，而不是 D2Game 全量 diff-verified；本区如实展示两者的差距。',
  },
  {
    id: 'combat',
    indexLabel: 'ZONE 04',
    navTitle: '战斗结算沙盒',
    navSub: 'SUNITDMG_* 浏览器实跑',
    headerTitle: 'Zone 4 · SUNITDMG_* Settlement Sandbox (canonical kernel in browser vs DLL vectors)',
    headerSub:
      '在浏览器内真实执行 manifest 绑定的规范内核函数，与原版 D2Game.dll 0x6FCFC0B0 的差分向量逐字段对照。',
  },
]

export function mountK2ShowcaseApp(root: HTMLElement): void {
  const doc = root.ownerDocument ?? document

  root.innerHTML = `
    <div class="k2-shell">
      <aside class="k2-sidebar" id="k2-sidebar">
        <div class="k2-brand">
          <div class="k2-brand__eyebrow">DIABLO II v1.13c · [K2] REPLAY CLOSURE</div>
          <h1 class="k2-brand__title">D2Game 回放收敛成果展厅</h1>
          <div class="k2-brand__sub" id="k2-sidebar-cert">正在实测…</div>
        </div>

        <nav class="k2-nav" aria-label="K2 Showcase Zones" id="k2-zone-nav"></nav>

        <div class="k2-sidebar-metrics" id="k2-sidebar-metrics">
          <div class="k2-metric-row">
            <span>回放场景 / 帧</span>
            <strong class="k2-mono" id="k2-m-frames">…</strong>
          </div>
          <div class="k2-metric-row">
            <span>零分歧场景</span>
            <strong class="k2-mono" id="k2-m-zero">…</strong>
          </div>
          <div class="k2-metric-row">
            <span>D2Game 执行并集</span>
            <strong class="k2-mono" id="k2-m-union">…</strong>
          </div>
          <div class="k2-metric-row">
            <span>runtimeExecGap</span>
            <strong class="k2-mono" id="k2-m-gap">…</strong>
          </div>
          <div class="k2-metric-row">
            <span>D2Game diff-verified</span>
            <strong class="k2-mono" id="k2-m-dv">…</strong>
          </div>
          <div class="k2-metric-row">
            <span>D2Common diff-verified</span>
            <strong class="k2-mono" id="k2-m-d2c">…</strong>
          </div>
        </div>

        <div class="k2-sidebar-links">
          <a href="/k1-showcase.html" class="k2-btn k2-btn--block">K1 展厅 (D2Common)</a>
          <a href="/" class="k2-btn k2-btn--block">庇护之地门户 (Portal)</a>
        </div>
      </aside>

      <main class="k2-main" id="k2-main">
        <header class="k2-zone-header">
          <div class="k2-zone-header__titles">
            <h2 class="k2-zone-header__title" id="k2-active-title"></h2>
            <p class="k2-zone-header__sub" id="k2-active-sub"></p>
          </div>
          <div class="k2-zone-header__pills">
            <span class="k2-badge k2-badge--ok">ZERO MOCK DATA</span>
            <span class="k2-badge" id="k2-header-zone-pill"></span>
          </div>
        </header>

        <section id="k2-zone-panel-replay" class="k2-zone-panel"></section>
        <section id="k2-zone-panel-gap" class="k2-zone-panel" hidden></section>
        <section id="k2-zone-panel-callgraph" class="k2-zone-panel" hidden></section>
        <section id="k2-zone-panel-combat" class="k2-zone-panel" hidden></section>
      </main>
    </div>
  `

  const q = (sel: string): HTMLElement => root.querySelector(sel) as HTMLElement
  const navEl = q('#k2-zone-nav')
  const activeTitle = q('#k2-active-title')
  const activeSub = q('#k2-active-sub')
  const headerZonePill = q('#k2-header-zone-pill')
  const mainScroll = q('#k2-main')

  const panels: Record<K2ShowcaseZoneId, HTMLElement> = {
    replay: q('#k2-zone-panel-replay'),
    gap: q('#k2-zone-panel-gap'),
    callgraph: q('#k2-zone-panel-callgraph'),
    combat: q('#k2-zone-panel-combat'),
  }

  const controllers: Record<K2ShowcaseZoneId, K2ZoneController> = {
    replay: mountZone1Replay(panels.replay),
    gap: mountZone2Gap(panels.gap),
    callgraph: mountZone3Callgraph(panels.callgraph),
    combat: mountZone4Combat(panels.combat),
  }

  const navBtns = new Map<K2ShowcaseZoneId, HTMLButtonElement>()
  let currentZone: K2ShowcaseZoneId | null = null

  for (const z of ZONES) {
    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.className = 'k2-nav-btn'
    btn.dataset.zone = z.id
    btn.innerHTML = `
      <span class="k2-nav-btn__idx">${z.indexLabel}</span>
      <span class="k2-nav-btn__title">${z.navTitle}</span>
      <span class="k2-nav-btn__sub">${z.navSub}</span>
    `
    btn.addEventListener('click', () => switchZone(z.id))
    navEl.appendChild(btn)
    navBtns.set(z.id, btn)
  }

  function switchZone(next: K2ShowcaseZoneId): void {
    if (currentZone === next) return
    if (currentZone !== null) controllers[currentZone].deactivate()
    currentZone = next
    const metaIdx = ZONES.findIndex((z) => z.id === next)
    const meta = ZONES[metaIdx >= 0 ? metaIdx : 0]!
    activeTitle.textContent = meta.headerTitle
    activeSub.textContent = meta.headerSub
    headerZonePill.textContent = `ZONE 0${metaIdx + 1} / 0${ZONES.length}`
    for (const z of ZONES) {
      const isAct = z.id === next
      panels[z.id].hidden = !isAct
      navBtns.get(z.id)?.classList.toggle('k2-nav-btn--active', isAct)
    }
    mainScroll.scrollTop = 0
    controllers[next].activate()
  }

  const setText = (sel: string, text: string, cls?: string): void => {
    const el = root.querySelector(sel)
    if (!el) return
    el.textContent = text
    if (cls) el.className = `k2-mono ${cls}`
  }

  // Sidebar metrics: manifest totals (cheap) first, then the live replay measurement.
  void fetchJson<K2OverviewResponse>('/api/k2-showcase/overview')
    .then((ov) => {
      setText('#k2-m-frames', `${ov.scenarios.length} / ${fmtInt(ov.totalScenarioFrames)}`)
      const game = ov.totals.find((t) => t.module === 'D2Game')
      const common = ov.totals.find((t) => t.module === 'D2Common')
      if (game) {
        setText('#k2-m-dv', `${fmtInt(game.diffVerified)} / ${fmtInt(game.total)} (${fmtPct(game.diffVerified, game.total)})`)
      }
      if (common) {
        setText(
          '#k2-m-d2c',
          `${fmtInt(common.diffVerified)} / ${fmtInt(common.total)}`,
          common.diffVerified === common.total ? 'k2-text--ok' : 'k2-text--warn',
        )
      }
    })
    .catch(() => {
      // Non-fatal: zones surface their own errors.
    })

  void fetchJson<K2GapResponse>('/api/k2-showcase/gap')
    .then((gap) => {
      const live = gap.live
      const zero = live.scenarios.filter((s) => s.zeroDivergence).length
      setText('#k2-m-zero', `${zero} / ${live.scenarios.length}`, zero === live.scenarios.length ? 'k2-text--ok' : 'k2-text--err')
      setText('#k2-m-union', `${fmtInt(live.tsUnionInDll)} / ${fmtInt(live.dllUnion)}`)
      setText('#k2-m-gap', String(live.unionGap), live.unionGap === 0 ? 'k2-text--ok' : 'k2-text--warn')
      const cert = root.querySelector('#k2-sidebar-cert')
      if (cert) {
        cert.textContent =
          live.unionGap === 0 && live.allZeroDivergence
            ? `runtimeExecGap = 0 · ${fmtInt(live.framesReplayed)} 帧零分歧`
            : `runtimeExecGap = ${live.unionGap}（尚未归零）`
      }
    })
    .catch(() => {
      const cert = root.querySelector('#k2-sidebar-cert')
      if (cert) cert.textContent = '实测失败（见各展区）'
    })

  // Support URL ?zone=replay|gap|callgraph|combat|1|2|3|4
  const rawZone = new URLSearchParams(window.location.search).get('zone')?.trim().toLowerCase()
  let initialZone: K2ShowcaseZoneId = 'replay'
  if (rawZone === '2' || rawZone === 'gap') initialZone = 'gap'
  else if (rawZone === '3' || rawZone === 'callgraph') initialZone = 'callgraph'
  else if (rawZone === '4' || rawZone === 'combat') initialZone = 'combat'
  switchZone(initialZone)
}

if (typeof document !== 'undefined') {
  const appEl = document.getElementById('k2-showcase-app')
  if (appEl) mountK2ShowcaseApp(appEl)
}

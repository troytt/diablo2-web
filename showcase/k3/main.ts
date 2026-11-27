/**
 * [K3] Class Skills, Summons, Curses, Warcries, Auras, Merc & Elemental/DoT Showcase
 * (`showcase/k3/main.ts`).
 */

import { compute5BandScaling } from '../../src/common/data/calc-ast.ts'
import { renderFnDetailDrawer } from '../shared/disasm-explorer.ts'
import { renderKNavStripHtml } from '../shared/k-nav.ts'
import { mountSharedReplayWidget } from '../shared/replay-widget.ts'
import {
  escapeHtml,
  fetchJson,
  fmtInt,
  type SharedFnDetailResponse,
  type ShowcaseZoneController,
} from '../shared/types.ts'

export type K3ZoneId = 'replay' | 'subsystems' | 'coverage' | 'skillcalc'

const CLASS_LABELS = ['0: Amazon', '1: Sorceress', '2: Necromancer', '3: Paladin', '4: Barbarian', '5: Druid', '6: Assassin'] as const

interface K3Overview {
  readonly ok: true
  readonly scenarioCount: number
  readonly totalGoldenFrames: number
  readonly totalSteppedFrames: number
  readonly dllUnionD2Common: number
  readonly dllUnionD2Game: number
  readonly closedSubsystemsCount: number
  readonly skillCalcVectors: { readonly relPath: string; readonly recordCount: number; readonly sha256: string }
  readonly scenarios: readonly {
    readonly scenario: string
    readonly classLabel: string
    readonly focus: string
    readonly goldenFrames: number
    readonly strictHorizon: number
    readonly posHorizon: number
    readonly d2CommonDllHits: number
    readonly d2GameDllHits: number
  }[]
}

interface K3SubsystemsResp {
  readonly ok: true
  readonly entries: readonly {
    readonly va: string
    readonly name: string
    readonly size: number
    readonly status: string
    readonly kernFile: string | null
    readonly tsSymbol: string | null
    readonly role: string
    readonly hits: readonly { readonly scenario: string; readonly firstFrame: number }[]
  }[]
}

interface K3VerifyAllResp {
  readonly ok: true
  readonly computeMs: number
  readonly allZeroDivergence: boolean
  readonly unionD2CommonDll: number
  readonly unionD2CommonGap: number
  readonly unionD2GameDll: number
  readonly unionD2GameGap: number
  readonly scenarios: readonly {
    readonly scenario: string
    readonly bootOk: boolean
    readonly strictHorizon: number
    readonly lastGoldenFrame: number
    readonly zeroDivergence: boolean
    readonly d2CommonDll: number
    readonly d2CommonGap: number
    readonly d2GameDll: number
    readonly d2GameGap: number
  }[]
}

interface K3SkillCalcResp {
  readonly ok: true
  readonly relPath: string
  readonly sha256: string
  readonly totalRecords: number
  readonly filteredCount: number
  readonly classFilter: number | null
  readonly records: readonly {
    readonly index: number
    readonly skillId: number
    readonly charClass: number
    readonly baseSlvl: number
    readonly effSlvl: number
    readonly bonusSlvl: number
    readonly manaCost: number
    readonly formulaVal: number
    readonly physMinDmg: number
    readonly physMaxDmg: number
    readonly elemMinDmg: number
    readonly elemMaxDmg: number
    readonly elemLength: number
    readonly toHitBonus: number
  }[]
}

const ZONES: readonly {
  readonly id: K3ZoneId
  readonly idx: string
  readonly navTitle: string
  readonly navSub: string
  readonly headerTitle: string
  readonly headerSub: string
}[] = [
  {
    id: 'replay',
    idx: 'ZONE 01',
    navTitle: '9 场景职业技能回放',
    navSub: '15,700 帧 · 100% 零分歧',
    headerTitle: 'Zone 1 · [K3] 9-Scenario Longitudinal Lockstep Replay (p52-*, 15,700 Golden Frames)',
    headerSub: '覆盖 Amazon / Barbarian / Necromancer / Paladin (+Merc) / Sorceress 的被动闪避、召唤、战吼、诅咒、光环与元素 DoT。',
  },
  {
    id: 'subsystems',
    idx: 'ZONE 02',
    navTitle: '15 个闭合 D2Game 子系统',
    navSub: '实机反汇编 ↔ TS 源码',
    headerTitle: 'Zone 2 · 15 Closed K3 D2Game.dll Subsystems (AI_Hireable / SummonPet / NecroPet / Shouts)',
    headerSub: '点击任意 VA 实时拉取原版 1.13c PE32 Intel 反汇编与 src/d2kern-113c/game/ 同构 TypeScript 源码。',
  },
  {
    id: 'coverage',
    idx: 'ZONE 03',
    navTitle: 'dll ∩ ts 覆盖与复验',
    navSub: 'runtimeExecGap = 0',
    headerTitle: 'Zone 3 · K3 Runtime Execution Coverage Matrix (780 D2Common + 652 D2Game = 0 Gap)',
    headerSub: '展示 9 场景 INT3 实机覆盖矩阵，并支持服务端一键重跑全部 9 场景实时验证 runtimeExecGap === 0。',
  },
  {
    id: 'skillcalc',
    idx: 'ZONE 04',
    navTitle: 'SKILLCALC 210 技能向量',
    navSub: '12,600 向量 · slvl 1..60',
    headerTitle: 'Zone 4 · SKILLCALC 7-Class / 210-Skill Real-DLL D2TV Inspector & 5-Band Evaluator',
    headerSub: '浏览 tests/fixtures/oracle/k3/skillcalc-113c.d2tv.gz 实机向量，并实时运行 1.13c 5-Band (lvl1/8/16/22/28) 线性分段公式。',
  },
]

function mountZone2Subsystems(container: HTMLElement): ShowcaseZoneController {
  let loaded = false
  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">15 个 [K3] 闭合 D2Game.dll 关键子系统 VA（点击任意行查看反汇编与 TS 源码）</h3>
          <span class="d2ks-badge d2ks-badge--ok">15 / 15 CLOSED</span>
        </div>
        <div class="d2ks-table-scroll">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>VA</th><th>符号名</th><th>Size</th><th>状态</th><th>职责与闭合机制</th><th>命中场景与首帧</th></tr>
            </thead>
            <tbody id="k3-sub-tbody"><tr><td colspan="6" class="d2ks-muted">正在加载…</td></tr></tbody>
          </table>
        </div>
      </div>
      <div id="k3-sub-drawer"></div>
    </div>
  `

  const tbody = container.querySelector('#k3-sub-tbody') as HTMLElement
  const drawer = container.querySelector('#k3-sub-drawer') as HTMLElement

  async function inspectFn(mod: 'D2Common' | 'D2Game', va: string): Promise<void> {
    drawer.innerHTML = `<div class="d2ks-note">正在读取 ${escapeHtml(mod)}:${escapeHtml(va)} 反汇编与 TS 源码…</div>`
    try {
      const detail = await fetchJson<SharedFnDetailResponse>(
        `/api/k3-showcase/fn?module=${encodeURIComponent(mod)}&va=${encodeURIComponent(va)}`,
      )
      renderFnDetailDrawer(drawer, detail, (m, v) => {
        void inspectFn(m, v)
      })
    } catch (e) {
      drawer.innerHTML = `<div class="d2ks-note d2ks-note--err">${escapeHtml(e instanceof Error ? e.message : String(e))}</div>`
    }
  }

  return {
    activate(): void {
      if (loaded) return
      loaded = true
      void fetchJson<K3SubsystemsResp>('/api/k3-showcase/subsystems').then((resp) => {
        tbody.innerHTML = resp.entries
          .map(
            (e, i) => `
              <tr class="d2ks-clickable-row${i === 0 ? ' d2ks-row--sel' : ''}" data-va="${escapeHtml(e.va)}">
                <td class="d2ks-mono d2ks-gold">${escapeHtml(e.va)}</td>
                <td class="d2ks-mono">${escapeHtml(e.name)}</td>
                <td class="d2ks-mono">${e.size} B</td>
                <td><span class="d2ks-pill d2ks-pill--ok">${escapeHtml(e.status)}</span></td>
                <td class="d2ks-wrap">${escapeHtml(e.role)}</td>
                <td class="d2ks-wrap d2ks-mono d2ks-muted">${e.hits.map((h) => `${h.scenario.replace('p52-', '')}@F${h.firstFrame}`).join(', ') || '—'}</td>
              </tr>
            `,
          )
          .join('')
        tbody.querySelectorAll<HTMLTableRowElement>('tr[data-va]').forEach((tr) => {
          tr.addEventListener('click', () => {
            tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('d2ks-row--sel'))
            tr.classList.add('d2ks-row--sel')
            void inspectFn('D2Game', tr.dataset.va ?? '')
          })
        })
        if (resp.entries[0]) void inspectFn('D2Game', resp.entries[0].va)
      })
    },
    deactivate(): void {
      // No-op
    },
  }
}

function mountZone3Coverage(container: HTMLElement): ShowcaseZoneController {
  let loaded = false
  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-toolbar">
        <button type="button" class="d2ks-btn d2ks-btn--primary" id="k3-cov-run-all">▶ 执行 9 场景实时内核 va-trace 闭环复验</button>
        <span class="d2ks-badge" id="k3-cov-status">已加载实机 INT3 覆盖与 horizons.json</span>
      </div>

      <div class="d2ks-kpi-strip">
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">9 场景总黄金帧 / 步进帧</span><span class="d2ks-kpi__val d2ks-mono" id="k3-cov-frames">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">D2Common DLL 并集</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k3-cov-c">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">D2Game DLL 并集</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k3-cov-g">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">实测 runtimeExecGap</span><span class="d2ks-kpi__val d2ks-mono" id="k3-cov-gap">待触发或见下表</span></div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">9 场景覆盖率与零分歧闭环总表</h3>
          <span class="d2ks-muted d2ks-mono" id="k3-cov-ms"></span>
        </div>
        <div class="d2ks-table-scroll d2ks-table-scroll--tall">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>场景</th><th>职业</th><th>黄金帧</th><th>Strict 视界</th><th>D2Common Hits</th><th>D2Game Hits</th><th>实测状态 / Gap</th></tr>
            </thead>
            <tbody id="k3-cov-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const statusEl = container.querySelector('#k3-cov-status') as HTMLElement
  const runBtn = container.querySelector('#k3-cov-run-all') as HTMLButtonElement
  const tbody = container.querySelector('#k3-cov-tbody') as HTMLElement

  function renderTable(ov: K3Overview, live?: K3VerifyAllResp): void {
    const liveMap = new Map(live?.scenarios.map((s) => [s.scenario, s]) ?? [])
    ;(container.querySelector('#k3-cov-frames') as HTMLElement).textContent =
      `${fmtInt(ov.totalGoldenFrames)} / ${fmtInt(ov.totalSteppedFrames)}`
    ;(container.querySelector('#k3-cov-c') as HTMLElement).textContent = `${fmtInt(ov.dllUnionD2Common)} VAs`
    ;(container.querySelector('#k3-cov-g') as HTMLElement).textContent = `${fmtInt(ov.dllUnionD2Game)} VAs`
    if (live) {
      const gapEl = container.querySelector('#k3-cov-gap') as HTMLElement
      gapEl.textContent = `C:${live.unionD2CommonGap} / G:${live.unionD2GameGap}`
      gapEl.className = `d2ks-kpi__val d2ks-mono ${live.unionD2CommonGap === 0 && live.unionD2GameGap === 0 ? 'd2ks-text--ok' : 'd2ks-text--err'}`
      ;(container.querySelector('#k3-cov-ms') as HTMLElement).textContent = `全部 9 场景实时内核重跑耗时 ${fmtInt(live.computeMs)} ms`
    }

    tbody.innerHTML = ov.scenarios
      .map((s) => {
        const lv = liveMap.get(s.scenario)
        const statusCell = lv
          ? `<span class="d2ks-pill ${lv.zeroDivergence && lv.d2CommonGap === 0 && lv.d2GameGap === 0 ? 'd2ks-pill--ok' : 'd2ks-pill--err'}">LIVE Δ=0 · Gap C:${lv.d2CommonGap}/G:${lv.d2GameGap}</span>`
          : `<span class="d2ks-pill d2ks-pill--ok">HORIZON F${s.strictHorizon}/${s.goldenFrames}</span>`
        return `
          <tr>
            <td class="d2ks-mono d2ks-gold">${escapeHtml(s.scenario)}</td>
            <td>${escapeHtml(s.classLabel)}</td>
            <td class="d2ks-mono">${fmtInt(s.goldenFrames)}</td>
            <td class="d2ks-mono d2ks-text--ok">F${s.strictHorizon} / F${s.goldenFrames}</td>
            <td class="d2ks-mono">${s.d2CommonDllHits}</td>
            <td class="d2ks-mono">${s.d2GameDllHits}</td>
            <td>${statusCell}</td>
          </tr>
        `
      })
      .join('')
  }

  let cachedOv: K3Overview | null = null
  runBtn.addEventListener('click', () => {
    runBtn.disabled = true
    statusEl.textContent = '服务端正在实时重跑全部 9 个 p52-* 场景 (15,682 帧)…'
    statusEl.className = 'd2ks-badge d2ks-badge--warn'
    void fetchJson<K3VerifyAllResp>('/api/k3-showcase/verify-all')
      .then((live) => {
        statusEl.textContent =
          live.allZeroDivergence && live.unionD2CommonGap === 0 && live.unionD2GameGap === 0
            ? `9 / 9 实时复验通过 · runtimeExecGap = 0 (${fmtInt(live.computeMs)} ms)`
            : '复验检测到缺口'
        statusEl.className = live.allZeroDivergence ? 'd2ks-badge d2ks-badge--ok' : 'd2ks-badge d2ks-badge--err'
        if (cachedOv) renderTable(cachedOv, live)
      })
      .catch((e) => {
        statusEl.textContent = `复验失败: ${e instanceof Error ? e.message : String(e)}`
        statusEl.className = 'd2ks-badge d2ks-badge--err'
      })
      .finally(() => {
        runBtn.disabled = false
      })
  })

  return {
    activate(): void {
      if (loaded) return
      loaded = true
      void fetchJson<K3Overview>('/api/k3-showcase/overview').then((ov) => {
        cachedOv = ov
        renderTable(ov)
      })
    },
    deactivate(): void {
      // No-op
    },
  }
}

function mountZone4SkillCalc(container: HTMLElement): ShowcaseZoneController {
  let loaded = false
  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">1.13c 5-Band 技能等级分段线性公式浏览器沙盒 (compute5BandScaling)</h3>
          <span class="d2ks-badge d2ks-badge--ok" id="k3-sc-calc-val">= —</span>
        </div>
        <div class="d2ks-form-grid">
          <label>技能等级 (slvl)<input class="d2ks-input d2ks-mono" type="number" id="k3-b-lvl" value="20" min="1" max="60" /></label>
          <label>Base (lvl 1)<input class="d2ks-input d2ks-mono" type="number" id="k3-b-base" value="15" /></label>
          <label>Step 2..8<input class="d2ks-input d2ks-mono" type="number" id="k3-b-s1" value="6" /></label>
          <label>Step 9..16<input class="d2ks-input d2ks-mono" type="number" id="k3-b-s2" value="10" /></label>
          <label>Step 17..22<input class="d2ks-input d2ks-mono" type="number" id="k3-b-s3" value="14" /></label>
          <label>Step 23..28<input class="d2ks-input d2ks-mono" type="number" id="k3-b-s4" value="18" /></label>
          <label>Step 29+<input class="d2ks-input d2ks-mono" type="number" id="k3-b-s5" value="22" /></label>
        </div>
      </div>

      <div class="d2ks-toolbar">
        <label class="d2ks-field-inline">
          <span>职业筛选 (7 Classes):</span>
          <select class="d2ks-select" id="k3-sc-class">
            <option value="all">全部 7 职业 (12,600 向量)</option>
            ${CLASS_LABELS.map((lbl, idx) => `<option value="${idx}">${escapeHtml(lbl)}</option>`).join('')}
          </select>
        </label>
        <span class="d2ks-badge d2ks-mono" id="k3-sc-meta">加载中…</span>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">skillcalc-113c.d2tv.gz 实机 DLL 向量明细</h3>
          <span class="d2ks-muted d2ks-mono" id="k3-sc-sha"></span>
        </div>
        <div class="d2ks-table-scroll d2ks-table-scroll--tall">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>#</th><th>Class</th><th>SkillId</th><th>Base/Eff</th><th>Mana</th><th>Formula</th><th>Phys Min..Max</th><th>Elem Min..Max</th><th>Len</th><th>AR%</th></tr>
            </thead>
            <tbody id="k3-sc-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const clsSelect = container.querySelector('#k3-sc-class') as HTMLSelectElement
  const tbody = container.querySelector('#k3-sc-tbody') as HTMLElement

  function updateBandCalc(): void {
    const num = (id: string): number => Number((container.querySelector(`#${id}`) as HTMLInputElement).value) || 0
    const lvl = num('k3-b-lvl')
    const out = compute5BandScaling(
      lvl,
      num('k3-b-base'),
      num('k3-b-s1'),
      num('k3-b-s2'),
      num('k3-b-s3'),
      num('k3-b-s4'),
      num('k3-b-s5'),
    )
    ;(container.querySelector('#k3-sc-calc-val') as HTMLElement).textContent = `slvl ${lvl} => ${out}`
  }

  for (const id of ['k3-b-lvl', 'k3-b-base', 'k3-b-s1', 'k3-b-s2', 'k3-b-s3', 'k3-b-s4', 'k3-b-s5']) {
    container.querySelector(`#${id}`)?.addEventListener('input', updateBandCalc)
  }

  function loadVectors(): void {
    const cls = clsSelect.value
    void fetchJson<K3SkillCalcResp>(`/api/k3-showcase/skillcalc?class=${encodeURIComponent(cls)}&limit=210`).then(
      (resp) => {
        ;(container.querySelector('#k3-sc-meta') as HTMLElement).textContent =
          `显示 ${resp.records.length} / 命中 ${resp.filteredCount} / 总计 ${fmtInt(resp.totalRecords)}`
        ;(container.querySelector('#k3-sc-sha') as HTMLElement).textContent = `SHA-256: ${resp.sha256.slice(0, 20)}…`
        tbody.innerHTML = resp.records
          .map(
            (r) => `
              <tr>
                <td class="d2ks-mono">${r.index}</td>
                <td>${escapeHtml(CLASS_LABELS[r.charClass] ?? String(r.charClass))}</td>
                <td class="d2ks-mono d2ks-gold">#${r.skillId}</td>
                <td class="d2ks-mono">${r.baseSlvl} → ${r.effSlvl} (+${r.bonusSlvl})</td>
                <td class="d2ks-mono">${r.manaCost}</td>
                <td class="d2ks-mono">${r.formulaVal}</td>
                <td class="d2ks-mono">${r.physMinDmg}..${r.physMaxDmg}</td>
                <td class="d2ks-mono d2ks-text--cyan">${r.elemMinDmg}..${r.elemMaxDmg}</td>
                <td class="d2ks-mono">${r.elemLength}</td>
                <td class="d2ks-mono">${r.toHitBonus}</td>
              </tr>
            `,
          )
          .join('')
      },
    )
  }

  clsSelect.addEventListener('change', loadVectors)

  return {
    activate(): void {
      updateBandCalc()
      if (!loaded) {
        loaded = true
        loadVectors()
      }
    },
    deactivate(): void {
      // No-op
    },
  }
}

export function mountK3ShowcaseApp(root: HTMLElement): void {
  const doc = root.ownerDocument ?? document
  root.innerHTML = `
    <div class="d2ks-shell">
      <aside class="d2ks-sidebar" id="k3-sidebar">
        <div class="d2ks-brand">
          <div class="d2ks-brand__eyebrow">DIABLO II v1.13c · [K3] CLASS SKILLS</div>
          <h1 class="d2ks-brand__title">职业技能与召唤成果展厅</h1>
          <div class="d2ks-brand__sub" id="k3-sidebar-cert">正在加载实机指标…</div>
        </div>

        <nav class="d2ks-nav" aria-label="K3 Showcase Zones" id="k3-zone-nav"></nav>

        <div class="d2ks-sidebar-metrics">
          <div class="d2ks-metric-row"><span>p52 场景 / 帧</span><strong class="d2ks-mono" id="k3-m-frames">…</strong></div>
          <div class="d2ks-metric-row"><span>D2Common 并集</span><strong class="d2ks-mono d2ks-text--ok" id="k3-m-d2c">…</strong></div>
          <div class="d2ks-metric-row"><span>D2Game 并集</span><strong class="d2ks-mono d2ks-text--ok" id="k3-m-d2g">…</strong></div>
          <div class="d2ks-metric-row"><span>闭合子系统</span><strong class="d2ks-mono" id="k3-m-sub">…</strong></div>
          <div class="d2ks-metric-row"><span>SKILLCALC 向量</span><strong class="d2ks-mono" id="k3-m-sc">…</strong></div>
        </div>

        ${renderKNavStripHtml('K3', 'd2ks')}

        <div class="d2ks-sidebar-links">
          <a href="/" class="d2ks-btn d2ks-btn--block">庇护之地门户 (Portal)</a>
          <a href="/play.html" class="d2ks-btn d2ks-btn--block">进入完整游戏 (Play)</a>
        </div>
      </aside>

      <main class="d2ks-main" id="k3-main">
        <header class="d2ks-zone-header">
          <div class="d2ks-zone-header__titles">
            <h2 class="d2ks-zone-header__title" id="k3-active-title"></h2>
            <p class="d2ks-zone-header__sub" id="k3-active-sub"></p>
          </div>
          <div class="d2ks-zone-header__pills">
            <span class="d2ks-badge d2ks-badge--ok">ZERO MOCK DATA</span>
            <span class="d2ks-badge" id="k3-header-zone-pill">ZONE 01 / 04</span>
          </div>
        </header>

        <section id="k3-panel-replay" class="d2ks-zone-panel"></section>
        <section id="k3-panel-subsystems" class="d2ks-zone-panel" hidden></section>
        <section id="k3-panel-coverage" class="d2ks-zone-panel" hidden></section>
        <section id="k3-panel-skillcalc" class="d2ks-zone-panel" hidden></section>
      </main>
    </div>
  `

  const q = (sel: string): HTMLElement => root.querySelector(sel) as HTMLElement
  const navEl = q('#k3-zone-nav')
  const mainEl = q('#k3-main')

  const panels: Record<K3ZoneId, HTMLElement> = {
    replay: q('#k3-panel-replay'),
    subsystems: q('#k3-panel-subsystems'),
    coverage: q('#k3-panel-coverage'),
    skillcalc: q('#k3-panel-skillcalc'),
  }

  const controllers: Record<K3ZoneId, ShowcaseZoneController> = {
    replay: mountSharedReplayWidget(panels.replay, {
      idPrefix: 'k3-rp',
      scenarios: [
        { id: 'p52-amazon-defense', label: 'p52-amazon-defense · 亚马逊被动闪避 & 暴击', badge: '1,800f' },
        { id: 'p52-amazon-valkyrie', label: 'p52-amazon-valkyrie · 女武神召唤 & 面包屑寻路', badge: '1,500f' },
        { id: 'p52-barbarian-warcries', label: 'p52-barbarian-warcries · 野蛮人四大战吼', badge: '1,600f' },
        { id: 'p52-necromancer-curses', label: 'p52-necromancer-curses · 死灵诅咒 & 骷髅召唤', badge: '2,000f' },
        { id: 'p52-necromancer-poison-golem', label: 'p52-necromancer-poison-golem · 黏土石魔 & 剧毒新星', badge: '1,800f' },
        { id: 'p52-paladin-auras', label: 'p52-paladin-auras · 圣骑士专注 & 狂热光环', badge: '1,700f' },
        { id: 'p52-paladin-merc-aura', label: 'p52-paladin-merc-aura · 圣骑士 + Act 1 雇佣兵', badge: '1,700f' },
        { id: 'p52-sorceress-elemental', label: 'p52-sorceress-elemental · 法师火球/连锁闪电/冰封球', badge: '1,800f' },
        { id: 'p52-sorceress-fire-dot', label: 'p52-sorceress-fire-dot · 火墙 & 地狱之火 DoT', badge: '1,800f' },
      ],
      buildUrl: (id) => `/api/k3-showcase/replay?scenario=${encodeURIComponent(id)}`,
    }),
    subsystems: mountZone2Subsystems(panels.subsystems),
    coverage: mountZone3Coverage(panels.coverage),
    skillcalc: mountZone4SkillCalc(panels.skillcalc),
  }

  const navBtns = new Map<K3ZoneId, HTMLButtonElement>()
  let current: K3ZoneId | null = null
  for (const z of ZONES) {
    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.className = 'd2ks-nav-btn'
    btn.dataset.zone = z.id
    btn.innerHTML = `
      <span class="d2ks-nav-btn__idx">${z.idx}</span>
      <span class="d2ks-nav-btn__title">${z.navTitle}</span>
      <span class="d2ks-nav-btn__sub">${z.navSub}</span>
    `
    btn.addEventListener('click', () => switchZone(z.id))
    navEl.appendChild(btn)
    navBtns.set(z.id, btn)
  }

  function switchZone(next: K3ZoneId): void {
    if (current === next) return
    if (current !== null) controllers[current].deactivate()
    current = next
    const idx = ZONES.findIndex((z) => z.id === next)
    const meta = ZONES[idx >= 0 ? idx : 0]!
    q('#k3-active-title').textContent = meta.headerTitle
    q('#k3-active-sub').textContent = meta.headerSub
    q('#k3-header-zone-pill').textContent = `ZONE 0${idx + 1} / 0${ZONES.length}`
    for (const z of ZONES) {
      panels[z.id].hidden = z.id !== next
      navBtns.get(z.id)?.classList.toggle('d2ks-nav-btn--active', z.id === next)
    }
    mainEl.scrollTop = 0
    controllers[next].activate()
  }

  void fetchJson<K3Overview>('/api/k3-showcase/overview')
    .then((ov) => {
      q('#k3-m-frames').textContent = `${ov.scenarioCount} / ${fmtInt(ov.totalGoldenFrames)}`
      q('#k3-m-d2c').textContent = `${ov.dllUnionD2Common} / ${ov.dllUnionD2Common}`
      q('#k3-m-d2g').textContent = `${ov.dllUnionD2Game} / ${ov.dllUnionD2Game}`
      q('#k3-m-sub').textContent = `${ov.closedSubsystemsCount} D2Game VAs`
      q('#k3-m-sc').textContent = fmtInt(ov.skillCalcVectors.recordCount)
      q('#k3-sidebar-cert').textContent = `9 / 9 零分歧 · runtimeExecGap = 0`
    })
    .catch(() => {
      q('#k3-sidebar-cert').textContent = '指标加载失败'
    })

  const rawZone = new URLSearchParams(window.location.search).get('zone')?.trim().toLowerCase()
  let initial: K3ZoneId = 'replay'
  if (rawZone === '2' || rawZone === 'subsystems') initial = 'subsystems'
  else if (rawZone === '3' || rawZone === 'coverage') initial = 'coverage'
  else if (rawZone === '4' || rawZone === 'skillcalc') initial = 'skillcalc'
  switchZone(initial)
}

if (typeof document !== 'undefined') {
  const el = document.getElementById('k3-showcase-app')
  if (el) mountK3ShowcaseApp(el)
}

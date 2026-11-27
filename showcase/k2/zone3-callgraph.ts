/**
 * Zone 3 — `D2Game.dll` call-graph explorer (`showcase/k2/zone3-callgraph.ts`).
 *
 * Every `D2Game` function of `tools/oracle/callgraph/manifest-113c.json` as one heat-map cell
 * (VA order), coloured by verification tier (`diff-verified` vs `ported`) or by live replay
 * execution. Clicking a cell shows VA, name, `tsSymbol`, `kernFile`, `diffEvidence` and its
 * callers / callees. Totals are computed from the manifest — K2's bar is replay-gap closure,
 * NOT full `D2Game` differential verification, and this zone states the difference plainly.
 */

import {
  escapeHtml,
  fetchJson,
  fmtInt,
  fmtPct,
  type K2CallgraphNode,
  type K2CallgraphResponse,
  type K2FunctionDetailResponse,
  type K2FunctionEdge,
  type K2ZoneController,
} from './types.ts'

type ColorMode = 'tier' | 'replay'
type StatusFilter = 'all' | 'diff-verified' | 'ported' | 'unported'
type ExecFilter = 'all' | 'both' | 'gap' | 'none'

const TIER_COLORS: Readonly<Record<string, string>> = {
  'diff-verified': '#38d9a9',
  ported: '#d9a23a',
  unported: '#ff6b6b',
}
const EXEC_COLORS = ['#3a3327', '#38d9a9', '#ff6b6b'] as const
const EXEC_LABELS = ['5 场景中 DLL 未执行', 'DLL 与 TS 都执行', 'DLL 执行但 TS 未执行（缺口）'] as const
const TABLE_LIMIT = 150

export function mountZone3Callgraph(container: HTMLElement): K2ZoneController {
  let data: K2CallgraphResponse | null = null
  let filtered: K2CallgraphNode[] = []
  let matchSet = new Set<string>()
  let colorMode: ColorMode = 'tier'
  let statusFilter: StatusFilter = 'all'
  let execFilter: ExecFilter = 'all'
  let search = ''
  let selectedVa: string | null = null
  let cols = 1
  let cell = 6
  let active = false
  let loading = false
  let detailToken = 0
  const detailCache = new Map<string, K2FunctionDetailResponse>()

  container.innerHTML = `
    <div class="k2-zone-stack">
      <div class="k2-note" id="k2-cg-honest">正在读取 manifest…</div>

      <div class="k2-kpi-strip">
        <div class="k2-kpi"><span class="k2-kpi__label">D2Game diff-verified / 总数</span><span class="k2-kpi__val k2-mono" id="k2-cg-kpi-dv">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">D2Game ported / unported</span><span class="k2-kpi__val k2-mono" id="k2-cg-kpi-ported">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">回放闭包内 (dll_union) diff-verified</span><span class="k2-kpi__val k2-mono" id="k2-cg-kpi-closure">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">D2Common diff-verified / 总数</span><span class="k2-kpi__val k2-mono" id="k2-cg-kpi-d2c">…</span></div>
      </div>

      <div class="k2-toolbar">
        <div class="k2-btn-group" role="group" aria-label="Color mode">
          <button type="button" class="k2-btn k2-btn--active" data-cg-color="tier">按验证等级着色</button>
          <button type="button" class="k2-btn" data-cg-color="replay">按回放执行着色</button>
        </div>
        <label class="k2-field-inline"><span>等级:</span>
          <select id="k2-cg-status" class="k2-select k2-input">
            <option value="all">全部</option>
            <option value="diff-verified">diff-verified</option>
            <option value="ported">ported</option>
            <option value="unported">unported</option>
          </select>
        </label>
        <label class="k2-field-inline"><span>回放:</span>
          <select id="k2-cg-exec" class="k2-select k2-input">
            <option value="all">全部</option>
            <option value="both">DLL 与 TS 都执行</option>
            <option value="gap">DLL 执行但 TS 未执行</option>
            <option value="none">DLL 未执行</option>
          </select>
        </label>
        <input id="k2-cg-search" type="search" class="k2-input" placeholder="搜索 VA / 函数名 / tsSymbol / kernFile…" style="min-width: 180px; flex: 1 1 160px" />
        <span class="k2-badge k2-mono" id="k2-cg-match">…</span>
      </div>

      <div class="k2-split-panels k2-split-panels--heatmap">
        <div class="k2-canvas-card">
          <div class="k2-canvas-card__hdr">
            <span>D2Game.dll 函数热力图（按 VA 升序，一格一个函数，点击查看）</span>
            <div class="k2-legend-row" id="k2-cg-legend"></div>
          </div>
          <canvas class="k2-heatmap" id="k2-cg-heatmap"></canvas>
        </div>
        <div class="k2-panel">
          <div class="k2-panel__hdr">
            <h3 class="k2-panel__title">函数明细</h3>
            <span class="k2-badge" id="k2-cg-detail-badge">未选择</span>
          </div>
          <dl class="k2-kv" id="k2-cg-detail-kv"><dt>提示</dt><dd>点击热力图格子或下方表格行。</dd></dl>
          <div id="k2-cg-detail-edges"></div>
        </div>
      </div>

      <div class="k2-panel">
        <div class="k2-panel__hdr">
          <h3 class="k2-panel__title">筛选结果</h3>
          <span class="k2-muted" id="k2-cg-table-note"></span>
        </div>
        <div class="k2-table-scroll" style="max-height: 280px">
          <table class="k2-table k2-table--compact">
            <thead><tr><th>VA</th><th>manifest 名称</th><th>等级</th><th>回放</th><th>size</th><th>tsSymbol</th><th>kernFile</th></tr></thead>
            <tbody id="k2-cg-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const q = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T
  const heatmap = q<HTMLCanvasElement>('#k2-cg-heatmap')

  function applyFilter(): void {
    if (!data) return
    const needle = search.trim().toLowerCase()
    filtered = data.functions.filter((fn) => {
      if (statusFilter !== 'all' && fn.status !== statusFilter) return false
      if (execFilter === 'both' && fn.exec !== 1) return false
      if (execFilter === 'gap' && fn.exec !== 2) return false
      if (execFilter === 'none' && fn.exec !== 0) return false
      if (needle.length > 0) {
        const kf = fn.kf >= 0 ? (data!.kernFiles[fn.kf] ?? '') : ''
        const hay = `${fn.va} ${fn.name} ${fn.tsSymbol ?? ''} ${kf}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    matchSet = new Set(filtered.map((f) => f.va))
  }

  function colorOf(fn: K2CallgraphNode): string {
    if (colorMode === 'replay') return EXEC_COLORS[fn.exec]
    return TIER_COLORS[fn.status] ?? '#868e96'
  }

  function drawHeatmap(): void {
    if (!data) return
    const n = data.functions.length
    const rect = heatmap.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    cell = Math.max(4, Math.min(11, Math.floor(Math.sqrt((w * 300) / Math.max(1, n)))))
    cols = Math.max(1, Math.floor(w / cell))
    const rows = Math.ceil(n / cols)
    const h = rows * cell
    const dpr = window.devicePixelRatio || 1
    heatmap.style.height = `${h}px`
    heatmap.width = Math.floor(w * dpr)
    heatmap.height = Math.floor(h * dpr)
    const ctx = heatmap.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0b0907'
    ctx.fillRect(0, 0, w, h)
    const filtering = matchSet.size !== n
    data.functions.forEach((fn, i) => {
      const x = (i % cols) * cell
      const y = Math.floor(i / cols) * cell
      ctx.globalAlpha = filtering && !matchSet.has(fn.va) ? 0.13 : 1
      ctx.fillStyle = colorOf(fn)
      ctx.fillRect(x, y, cell - 1, cell - 1)
      if (fn.va === selectedVa) {
        ctx.globalAlpha = 1
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.strokeRect(x - 0.5, y - 0.5, cell, cell)
      }
    })
    ctx.globalAlpha = 1
  }

  function renderLegend(): void {
    if (!data) return
    const legend = q<HTMLElement>('#k2-cg-legend')
    if (colorMode === 'tier') {
      const game = data.totals.find((t) => t.module === 'D2Game')
      legend.innerHTML = [
        ['diff-verified', game?.diffVerified ?? 0],
        ['ported', game?.ported ?? 0],
        ['unported', game?.unported ?? 0],
      ]
        .map(([k, c]) => `<span class="k2-legend-chip"><i style="background: ${TIER_COLORS[k as string]}"></i>${k} · ${fmtInt(c as number)}</span>`)
        .join('')
    } else {
      const counts = [0, 0, 0]
      for (const fn of data.functions) counts[fn.exec]!++
      legend.innerHTML = EXEC_LABELS.map(
        (label, i) => `<span class="k2-legend-chip"><i style="background: ${EXEC_COLORS[i]}"></i>${label} · ${fmtInt(counts[i]!)}</span>`,
      ).join('')
    }
  }

  function renderTable(): void {
    if (!data) return
    q<HTMLElement>('#k2-cg-match').textContent = `${fmtInt(filtered.length)} / ${fmtInt(data.functions.length)}`
    q<HTMLElement>('#k2-cg-table-note').textContent =
      filtered.length > TABLE_LIMIT ? `显示前 ${TABLE_LIMIT} 行（共 ${fmtInt(filtered.length)} 行，缩小筛选可看更多）` : `${fmtInt(filtered.length)} 行`
    q<HTMLElement>('#k2-cg-table-body').innerHTML = filtered
      .slice(0, TABLE_LIMIT)
      .map((fn) => {
        const kf = fn.kf >= 0 ? (data!.kernFiles[fn.kf] ?? '') : ''
        return `<tr class="k2-clickable-row ${fn.va === selectedVa ? 'k2-row--sel' : ''}" data-va="${fn.va}">
          <td class="k2-mono">${fn.va}</td>
          <td>${escapeHtml(fn.name)}</td>
          <td style="color: ${TIER_COLORS[fn.status] ?? '#868e96'}">${escapeHtml(fn.status)}</td>
          <td style="color: ${fn.exec === 0 ? '#968a74' : EXEC_COLORS[fn.exec]}">${fn.exec === 1 ? 'DLL∩TS' : fn.exec === 2 ? '缺口' : '—'}</td>
          <td class="k2-mono">${fn.size}</td>
          <td class="k2-mono">${escapeHtml(fn.tsSymbol ?? '—')}</td>
          <td class="k2-mono">${escapeHtml(kf.replace('src/d2kern-113c/', '') || '—')}</td>
        </tr>`
      })
      .join('')
    for (const row of container.querySelectorAll<HTMLTableRowElement>('#k2-cg-table-body tr')) {
      row.addEventListener('click', () => void selectFn(row.dataset.va ?? ''))
    }
  }

  function renderSummary(): void {
    if (!data) return
    const game = data.totals.find((t) => t.module === 'D2Game')
    const common = data.totals.find((t) => t.module === 'D2Common')
    const closureDv = data.replayClosureByStatus['diff-verified'] ?? 0
    if (game) {
      q<HTMLElement>('#k2-cg-kpi-dv').textContent = `${fmtInt(game.diffVerified)} / ${fmtInt(game.total)} (${fmtPct(game.diffVerified, game.total)})`
      q<HTMLElement>('#k2-cg-kpi-ported').textContent = `${fmtInt(game.ported)} / ${fmtInt(game.unported)}`
    }
    q<HTMLElement>('#k2-cg-kpi-closure').textContent = `${fmtInt(closureDv)} / ${fmtInt(data.replay.dllUnion)} (${fmtPct(closureDv, data.replay.dllUnion)})`
    if (common) {
      const el = q<HTMLElement>('#k2-cg-kpi-d2c')
      el.textContent = `${fmtInt(common.diffVerified)} / ${fmtInt(common.total)} (${fmtPct(common.diffVerified, common.total)})`
      el.className = `k2-kpi__val k2-mono ${common.diffVerified === common.total ? 'k2-text--ok' : ''}`
    }
    const honest = q<HTMLElement>('#k2-cg-honest')
    if (game) {
      const full = game.diffVerified === game.total
      honest.className = `k2-note ${full ? 'k2-note--ok' : ''}`
      honest.innerHTML =
        `<strong>如实说明：</strong>K2 的验收标准是「5 个回放场景 strict 零分歧 + <code>D2Game</code> runtimeExecGap = 0」，<strong>不是</strong> <code>D2Game</code> 全量差分验证。` +
        `按 <code>${escapeHtml(data.manifestPath)}</code> 统计，<code>D2Game</code> 共 ${fmtInt(game.total)} 个函数，其中 <code>diff-verified</code> 仅 ${fmtInt(
          game.diffVerified,
        )} 个（${fmtPct(game.diffVerified, game.total)}），其余 ${fmtInt(game.ported)} 个为 <code>ported</code>（已移植、尚无原版 DLL 差分证据）` +
        `${game.unported > 0 ? `，${fmtInt(game.unported)} 个 <code>unported</code>` : ''}。` +
        `原版 DLL 在 5 个场景里实际执行到的 <code>D2Game</code> 函数只有 ${fmtInt(data.replay.dllUnion)} 个（占 ${fmtPct(
          data.replay.dllUnion,
          game.total,
        )}），K2 的缺口指标只覆盖这一部分；当前其中 ${fmtInt(data.replay.tsUnionInDll)} 个已被 TS 回放执行，缺口 ${data.replay.unionGap}。` +
        (common
          ? ` 对照：<code>D2Common</code> 为 ${fmtInt(common.diffVerified)} / ${fmtInt(common.total)} <code>diff-verified</code>。`
          : '') +
        ` 另外，许多 <code>diff-verified</code> 条目的证据是「回放中被执行且整帧零分歧」，这只证明回放输入范围内行为一致，不等于逐函数全输入域等价（参见 Zone 4 的向量实测）。`
    }
  }

  function edgeList(title: string, edges: readonly K2FunctionEdge[]): string {
    if (edges.length === 0) return `<div class="k2-ev-sec"><div class="k2-ev-sec__lbl">${title} (0)</div></div>`
    return `<div class="k2-ev-sec"><div class="k2-ev-sec__lbl">${title} (${edges.length})</div><div class="k2-chip-wrap">${edges
      .map((e) => {
        const isGame = e.key.startsWith('D2Game:')
        const va = e.key.slice(e.key.indexOf(':') + 1)
        const color = TIER_COLORS[e.status] ?? '#868e96'
        return `<span class="k2-fn-chip ${isGame ? 'k2-clickable-row' : ''}" ${isGame ? `data-edge-va="${va}"` : ''} style="border-color: ${color}" title="${escapeHtml(
          `${e.key} · ${e.status}`,
        )}">${escapeHtml(e.name)}</span>`
      })
      .join('')}</div></div>`
  }

  function renderDetail(d: K2FunctionDetailResponse): void {
    const badge = q<HTMLElement>('#k2-cg-detail-badge')
    badge.textContent = d.status
    badge.className = `k2-badge ${d.status === 'diff-verified' ? 'k2-badge--ok' : 'k2-badge--warn'}`
    q<HTMLElement>('#k2-cg-detail-kv').innerHTML = `
      <dt>VA</dt><dd class="k2-mono">${escapeHtml(d.module)}:${escapeHtml(d.va)}</dd>
      <dt>name</dt><dd>${escapeHtml(d.name)}</dd>
      <dt>tsSymbol</dt><dd class="k2-mono">${escapeHtml(d.tsSymbol ?? '—')}</dd>
      <dt>kernFile</dt><dd class="k2-mono">${escapeHtml(d.kernFile ?? '—')}</dd>
      <dt>status</dt><dd style="color: ${TIER_COLORS[d.status] ?? '#868e96'}">${escapeHtml(d.status)}</dd>
      <dt>回放执行</dt><dd style="color: ${d.exec === 0 ? '#968a74' : EXEC_COLORS[d.exec]}">${EXEC_LABELS[d.exec]}</dd>
      <dt>size / topo / scc</dt><dd class="k2-mono">${d.size} B / L${d.topoLevel} / #${d.sccId}</dd>
      <dt>diffEvidence</dt><dd>${d.diffEvidence ? escapeHtml(d.diffEvidence) : '<span class="k2-muted">（manifest 中无差分证据）</span>'}</dd>
      <dt>externalDeps</dt><dd class="k2-mono">${d.externalDeps.length === 0 ? '—' : d.externalDeps.map(escapeHtml).join('<br />')}</dd>
    `
    const edges = q<HTMLElement>('#k2-cg-detail-edges')
    edges.innerHTML = edgeList('callers', d.callers) + edgeList('callees', d.callees)
    for (const chip of edges.querySelectorAll<HTMLElement>('[data-edge-va]')) {
      chip.addEventListener('click', () => void selectFn(chip.dataset.edgeVa ?? ''))
    }
  }

  async function selectFn(va: string): Promise<void> {
    if (!va || !data) return
    selectedVa = va
    drawHeatmap()
    renderTable()
    const token = ++detailToken
    const badge = q<HTMLElement>('#k2-cg-detail-badge')
    try {
      let d = detailCache.get(va)
      if (!d) {
        badge.textContent = '加载中…'
        d = await fetchJson<K2FunctionDetailResponse>(`/api/k2-showcase/fn?va=${encodeURIComponent(va)}`)
        detailCache.set(va, d)
      }
      if (token === detailToken) renderDetail(d)
    } catch (e) {
      if (token !== detailToken) return
      badge.textContent = '加载失败'
      badge.className = 'k2-badge k2-badge--err'
      q<HTMLElement>('#k2-cg-detail-kv').innerHTML = `<dt>错误</dt><dd>${escapeHtml(e instanceof Error ? e.message : String(e))}</dd>`
    }
  }

  function refresh(): void {
    applyFilter()
    renderLegend()
    drawHeatmap()
    renderTable()
  }

  async function load(): Promise<void> {
    if (loading || data) return
    loading = true
    try {
      data = await fetchJson<K2CallgraphResponse>('/api/k2-showcase/callgraph')
      renderSummary()
      refresh()
      // Default selection: the first function still in the replay gap, else the frame root.
      const first = data.functions.find((f) => f.exec === 2) ?? data.functions.find((f) => f.exec === 1) ?? data.functions[0]
      if (first) void selectFn(first.va)
    } catch (e) {
      const honest = q<HTMLElement>('#k2-cg-honest')
      honest.className = 'k2-note k2-note--err'
      honest.textContent = `加载失败: ${e instanceof Error ? e.message : String(e)}`
    } finally {
      loading = false
    }
  }

  for (const btn of container.querySelectorAll<HTMLButtonElement>('[data-cg-color]')) {
    btn.addEventListener('click', () => {
      colorMode = btn.dataset.cgColor as ColorMode
      for (const b of container.querySelectorAll<HTMLButtonElement>('[data-cg-color]')) {
        b.classList.toggle('k2-btn--active', b === btn)
      }
      refresh()
    })
  }
  q<HTMLSelectElement>('#k2-cg-status').addEventListener('change', (ev) => {
    statusFilter = (ev.target as HTMLSelectElement).value as StatusFilter
    refresh()
  })
  q<HTMLSelectElement>('#k2-cg-exec').addEventListener('change', (ev) => {
    execFilter = (ev.target as HTMLSelectElement).value as ExecFilter
    refresh()
  })
  q<HTMLInputElement>('#k2-cg-search').addEventListener('input', (ev) => {
    search = (ev.target as HTMLInputElement).value
    refresh()
  })
  heatmap.addEventListener('click', (ev) => {
    if (!data) return
    const rect = heatmap.getBoundingClientRect()
    const cx = Math.floor((ev.clientX - rect.left) / cell)
    const cy = Math.floor((ev.clientY - rect.top) / cell)
    if (cx < 0 || cx >= cols) return
    const fn = data.functions[cy * cols + cx]
    if (fn) void selectFn(fn.va)
  })

  const onResize = (): void => {
    if (active && data) drawHeatmap()
  }

  return {
    activate(): void {
      active = true
      window.addEventListener('resize', onResize)
      if (data) drawHeatmap()
      else void load()
    },
    deactivate(): void {
      active = false
      window.removeEventListener('resize', onResize)
    },
  }
}

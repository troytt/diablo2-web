/**
 * Zone 2 — `D2Game` runtimeExecGap convergence chart (`showcase/k2/zone2-gap.ts`).
 *
 * Plots the MEASURED gap of every commit that touched the replay gap reports / coverage ratchet
 * (`showcase/k2/data/gap-history.json`, produced by `tools/oracle/k2-showcase-gen.ts` re-running
 * that commit's own replays) plus a live measurement of the tree currently being served.
 *
 * Two definitions are plotted and labelled separately because they differ:
 *   - union gap           = |dll_union − ts_union|   (the coverage-ratchet definition, primary line)
 *   - ∪ per-scenario gaps = |∪ (dll_s − ts_s)|       (what the per-scenario gap reports add up to)
 */

import {
  escapeHtml,
  fetchJson,
  fmtInt,
  fmtPct,
  type K2CallgraphResponse,
  type K2GapHistoryPoint,
  type K2GapMeasure,
  type K2GapResponse,
  type K2ZoneController,
} from './types.ts'

interface ChartPoint {
  readonly label: string
  readonly isLive: boolean
  readonly history: K2GapHistoryPoint | null
  readonly measure: K2GapMeasure
  readonly ceiling: number | null
  readonly mdUnion: number | null
}

interface Hitbox {
  readonly x: number
  readonly idx: number
}

export function mountZone2Gap(container: HTMLElement): K2ZoneController {
  let data: K2GapResponse | null = null
  let points: ChartPoint[] = []
  let selected = -1
  let hitboxes: Hitbox[] = []
  let active = false
  let loading = false
  const vaNames = new Map<string, string>()

  container.innerHTML = `
    <div class="k2-zone-stack">
      <div class="k2-note" id="k2-gap-verdict">正在重跑 5 个回放并实测当前工作树…</div>

      <div class="k2-kpi-strip">
        <div class="k2-kpi"><span class="k2-kpi__label">实时 union gap = |dll_union − ts_union|</span><span class="k2-kpi__val k2-mono" id="k2-gap-kpi-gap">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">TS 已执行 / DLL 执行并集 (D2Game VA)</span><span class="k2-kpi__val k2-mono" id="k2-gap-kpi-union">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">实时 |∪ (dll_s − ts_s)|（逐场景缺口并集）</span><span class="k2-kpi__val k2-mono" id="k2-gap-kpi-scn">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">零分歧场景 / 回放帧数</span><span class="k2-kpi__val k2-mono" id="k2-gap-kpi-zero">…</span></div>
      </div>

      <div class="k2-canvas-card">
        <div class="k2-canvas-card__hdr">
          <span>逐 commit 实测收敛曲线（点击数据点查看明细）</span>
          <div class="k2-legend-row">
            <span class="k2-legend-chip"><i style="background: #f0dc9c"></i>union gap = |dll_union − ts_union|</span>
            <span class="k2-legend-chip"><i style="background: #ffa94d"></i>|∪ (dll_s − ts_s)|</span>
            <span class="k2-legend-chip"><i style="background: #868e96"></i>测试文件里的 ratchet 上限</span>
            <span class="k2-legend-chip"><i style="background: #38d9a9"></i>LIVE 当前工作树</span>
          </div>
        </div>
        <canvas class="k2-chart" id="k2-gap-chart"></canvas>
      </div>

      <div class="k2-note" id="k2-gap-definitions"></div>

      <div class="k2-split-panels">
        <div class="k2-panel">
          <div class="k2-panel__hdr">
            <h3 class="k2-panel__title">选中数据点明细</h3>
            <span class="k2-badge" id="k2-gap-sel-badge">—</span>
          </div>
          <dl class="k2-kv" id="k2-gap-sel-kv"></dl>
          <div class="k2-table-scroll">
            <table class="k2-table k2-table--compact">
              <thead><tr><th>场景</th><th>DLL 执行</th><th>TS∩DLL</th><th>缺口</th><th>strict 视界</th><th>零分歧</th></tr></thead>
              <tbody id="k2-gap-sel-scenarios"></tbody>
            </table>
          </div>
        </div>
        <div class="k2-panel">
          <div class="k2-panel__hdr">
            <h3 class="k2-panel__title">当前工作树剩余缺口函数（DLL 执行过、TS 5 个回放都未执行）</h3>
            <span class="k2-badge" id="k2-gap-left-badge">—</span>
          </div>
          <div class="k2-table-scroll">
            <table class="k2-table k2-table--compact">
              <thead><tr><th>VA</th><th>manifest 名称</th></tr></thead>
              <tbody id="k2-gap-left-body"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="k2-panel">
        <div class="k2-panel__hdr">
          <h3 class="k2-panel__title">全部实测数据点</h3>
          <span class="k2-muted" id="k2-gap-table-note"></span>
        </div>
        <div class="k2-table-scroll" style="max-height: 300px">
          <table class="k2-table k2-table--compact">
            <thead>
              <tr>
                <th>commit</th><th>提交时间 (UTC+8)</th><th>union gap</th><th>|∪ 场景缺口|</th>
                <th>报告 md 并集</th><th>ratchet 上限</th><th>D2Game diff-verified</th><th>零分歧</th><th>commit 标题</th>
              </tr>
            </thead>
            <tbody id="k2-gap-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const q = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T
  const chart = q<HTMLCanvasElement>('#k2-gap-chart')

  function beijing(iso: string): string {
    const t = Date.parse(iso)
    if (!Number.isFinite(t)) return iso
    const d = new Date(t + 8 * 3600 * 1000)
    const p = (n: number): string => String(n).padStart(2, '0')
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
  }

  function buildPoints(resp: K2GapResponse): ChartPoint[] {
    const out: ChartPoint[] = []
    for (const p of resp.history?.points ?? []) {
      if (p.measured === null) continue
      out.push({
        label: p.shortSha,
        isLive: false,
        history: p,
        measure: p.measured,
        ceiling: p.ratchetCeiling,
        mdUnion: p.reportMd.unionOfScenarioGaps,
      })
    }
    out.push({ label: 'LIVE', isLive: true, history: null, measure: resp.live, ceiling: null, mdUnion: null })
    return out
  }

  function draw(): void {
    const rect = chart.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    const dpr = window.devicePixelRatio || 1
    chart.width = Math.floor(w * dpr)
    chart.height = Math.floor(h * dpr)
    const ctx = chart.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0b0907'
    ctx.fillRect(0, 0, w, h)
    hitboxes = []
    if (points.length === 0) return

    const padL = 44
    const padR = 16
    const padT = 18
    const padB = 46
    const plotW = w - padL - padR
    const plotH = h - padT - padB
    let maxY = 1
    for (const p of points) {
      maxY = Math.max(maxY, p.measure.unionGap, p.measure.unionOfScenarioGaps, p.ceiling ?? 0, p.mdUnion ?? 0)
    }
    const step = maxY > 200 ? 100 : maxY > 80 ? 50 : maxY > 20 ? 10 : maxY > 8 ? 5 : 1
    const top = Math.ceil(maxY / step) * step
    const xAt = (i: number): number => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
    const yAt = (v: number): number => padT + plotH - (v / top) * plotH

    ctx.font = '10px ui-monospace, monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let v = 0; v <= top; v += step) {
      const y = yAt(v)
      ctx.strokeStyle = v === 0 ? '#755f3b' : '#221c14'
      ctx.beginPath()
      ctx.moveTo(padL, y + 0.5)
      ctx.lineTo(w - padR, y + 0.5)
      ctx.stroke()
      ctx.fillStyle = '#968a74'
      ctx.fillText(String(v), padL - 6, y)
    }

    const line = (color: string, dash: number[], value: (p: ChartPoint) => number | null, width: number): void => {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.setLineDash(dash)
      ctx.beginPath()
      let started = false
      points.forEach((p, i) => {
        const v = value(p)
        if (v === null) {
          started = false
          return
        }
        if (!started) {
          ctx.moveTo(xAt(i), yAt(v))
          started = true
        } else ctx.lineTo(xAt(i), yAt(v))
      })
      ctx.stroke()
      ctx.setLineDash([])
    }
    line('#868e96', [2, 3], (p) => p.ceiling, 1)
    line('#ffa94d', [5, 4], (p) => p.measure.unionOfScenarioGaps, 1.5)
    line('#f0dc9c', [], (p) => p.measure.unionGap, 2)

    ctx.textAlign = 'center'
    points.forEach((p, i) => {
      const x = xAt(i)
      const y = yAt(p.measure.unionGap)
      hitboxes.push({ x, idx: i })
      if (i === selected) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + 0.5, padT)
        ctx.lineTo(x + 0.5, padT + plotH)
        ctx.stroke()
      }
      if (p.ceiling !== null) {
        ctx.fillStyle = '#868e96'
        ctx.fillRect(x - 2, yAt(p.ceiling) - 2, 4, 4)
      }
      ctx.fillStyle = '#ffa94d'
      ctx.beginPath()
      ctx.arc(x, yAt(p.measure.unionOfScenarioGaps), 2.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = p.isLive ? '#38d9a9' : '#f0dc9c'
      ctx.beginPath()
      ctx.arc(x, y, p.isLive ? 5 : 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = p.isLive ? '#38d9a9' : '#f0dc9c'
      ctx.textBaseline = 'bottom'
      ctx.fillText(String(p.measure.unionGap), x, y - 6)
      // X labels: rotate short SHAs when crowded.
      ctx.save()
      ctx.translate(x, padT + plotH + 8)
      ctx.rotate(-Math.PI / 4)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = p.isLive ? '#38d9a9' : '#968a74'
      ctx.fillText(p.label, 0, 0)
      ctx.restore()
    })
  }

  function renderSelected(): void {
    const p = points[selected]
    if (!p) return
    const m = p.measure
    const badge = q<HTMLElement>('#k2-gap-sel-badge')
    badge.textContent = p.isLive ? 'LIVE 当前工作树' : p.label
    badge.className = `k2-badge ${m.unionGap === 0 ? 'k2-badge--ok' : ''}`
    const hist = p.history
    const rows: string[] = []
    if (hist) {
      rows.push(`<dt>commit</dt><dd class="k2-mono">${escapeHtml(hist.sha)}</dd>`)
      rows.push(`<dt>提交时间</dt><dd class="k2-mono">${escapeHtml(beijing(hist.committedAt))} (UTC+8)</dd>`)
      rows.push(`<dt>commit 标题</dt><dd>${escapeHtml(hist.subject)} <span class="k2-muted">（原文照录，其中数字未被采信）</span></dd>`)
    } else if (data) {
      rows.push(`<dt>HEAD</dt><dd class="k2-mono">${escapeHtml(data.liveHeadSha ?? '（非 git 工作树）')}</dd>`)
      rows.push(`<dt>测量方式</dt><dd>本次请求时服务端对当前源码实时重跑 5 个回放</dd>`)
    }
    rows.push(`<dt>union gap</dt><dd class="k2-mono">${m.unionGap} = |dll_union(${m.dllUnion}) − ts_union|</dd>`)
    rows.push(`<dt>|∪ 场景缺口|</dt><dd class="k2-mono">${m.unionOfScenarioGaps}</dd>`)
    if (hist) {
      rows.push(`<dt>报告 md 并集</dt><dd class="k2-mono">${hist.reportMd.unionOfScenarioGaps ?? 'n/a'}（该 commit 提交的 gap-*.md 表格）</dd>`)
      rows.push(`<dt>ratchet 上限</dt><dd class="k2-mono">${hist.ratchetCeiling ?? 'n/a（当时测试文件尚无并集上限）'}</dd>`)
      if (hist.manifest) {
        rows.push(
          `<dt>manifest</dt><dd class="k2-mono">D2Game diff-verified ${fmtInt(hist.manifest.d2GameDiffVerified)} / ${fmtInt(
            hist.manifest.d2GameTotal,
          )}，ported ${fmtInt(hist.manifest.d2GamePorted)}，unported ${fmtInt(hist.manifest.d2GameUnported)}</dd>`,
        )
      }
    }
    q<HTMLElement>('#k2-gap-sel-kv').innerHTML = rows.join('')
    q<HTMLElement>('#k2-gap-sel-scenarios').innerHTML = m.scenarios
      .map((s) =>
        s.error !== null
          ? `<tr><td>${escapeHtml(s.scenario)}</td><td colspan="5" class="k2-cell--err">${escapeHtml(s.error)}</td></tr>`
          : `<tr>
              <td>${escapeHtml(s.scenario)}</td><td>${s.dllExecuted}</td><td>${s.tsExecutedInDll}</td>
              <td class="${s.gap === 0 ? 'k2-cell--ok' : ''}">${s.gap}</td>
              <td>F${s.strictHorizon} / F${s.lastGoldenFrame}</td>
              <td class="${s.zeroDivergence ? 'k2-cell--ok' : 'k2-cell--err'}">${s.zeroDivergence ? '✓' : '✗'}</td>
            </tr>`,
      )
      .join('')
  }

  function renderAll(): void {
    if (!data) return
    const live = data.live
    const zero = live.scenarios.filter((s) => s.zeroDivergence).length

    const verdict = q<HTMLElement>('#k2-gap-verdict')
    const closed = live.unionGap === 0 && live.allZeroDivergence
    verdict.className = `k2-note ${closed ? 'k2-note--ok' : ''}`
    verdict.innerHTML = closed
      ? `<strong>K2 验收条件已满足（实测）：</strong>${live.scenarios.length} 个场景共 ${fmtInt(
          live.framesReplayed,
        )} 帧 strict 零分歧，<code>D2Game</code> runtimeExecGap = <code>0</code>（${fmtInt(live.tsUnionInDll)} / ${fmtInt(live.dllUnion)}）。`
      : `<strong>K2 验收条件尚未满足（实测）：</strong>当前工作树 <code>D2Game</code> runtimeExecGap = <code>${live.unionGap}</code>（TS 已执行 ${fmtInt(
          live.tsUnionInDll,
        )} / DLL 执行并集 ${fmtInt(live.dllUnion)}，覆盖 ${fmtPct(live.tsUnionInDll, live.dllUnion)}）；零分歧场景 ${zero} / ${
          live.scenarios.length
        }。验收线是缺口 = 0 且 5 个场景全部零分歧。`

    const gapEl = q<HTMLElement>('#k2-gap-kpi-gap')
    gapEl.textContent = String(live.unionGap)
    gapEl.className = `k2-kpi__val k2-mono ${live.unionGap === 0 ? 'k2-text--ok' : 'k2-text--warn'}`
    q<HTMLElement>('#k2-gap-kpi-union').textContent = `${fmtInt(live.tsUnionInDll)} / ${fmtInt(live.dllUnion)} (${fmtPct(
      live.tsUnionInDll,
      live.dllUnion,
    )})`
    q<HTMLElement>('#k2-gap-kpi-scn').textContent = String(live.unionOfScenarioGaps)
    const zeroEl = q<HTMLElement>('#k2-gap-kpi-zero')
    zeroEl.textContent = `${zero} / ${live.scenarios.length} · ${fmtInt(live.framesReplayed)} 帧`
    zeroEl.className = `k2-kpi__val k2-mono ${zero === live.scenarios.length ? 'k2-text--ok' : 'k2-text--err'}`

    // Definitions + honest caveats, all derived from the payload.
    const hist = data.history
    const unmeasured = hist ? hist.points.filter((p) => p.measured === null) : []
    const mismatchCeil = hist
      ? hist.points.filter((p) => p.measured !== null && p.ratchetCeiling !== null && p.ratchetCeiling !== p.measured.unionGap)
      : []
    const mismatchMd = hist
      ? hist.points.filter(
          (p) =>
            p.measured !== null &&
            p.reportMd.unionOfScenarioGaps !== null &&
            p.reportMd.unionOfScenarioGaps !== p.measured.unionOfScenarioGaps,
        )
      : []
    const defs: string[] = []
    defs.push(
      `<strong>口径说明：</strong>主曲线 <code>union gap = |dll_union − ts_union|</code>，即原版 DLL 在 5 个场景任意一个里执行过、而 TS 在 5 个实时回放里一次都没执行的 <code>D2Game</code> VA 数（覆盖率 ratchet 测试使用的口径）。` +
        `橙色虚线 <code>|∪ (dll_s − ts_s)|</code> 是逐场景缺口的并集，恒 ≥ 主曲线；两个口径不同，不能混用。`,
    )
    if (hist) {
      defs.push(
        `历史数据由 <code>${escapeHtml(hist.generator)}</code> 生成：对每个 commit 用 <code>git archive</code> 检出当时的源码并真实重跑它自己的回放，共 ${
          hist.points.length
        } 个 commit，其中 ${hist.points.length - unmeasured.length} 个可实测。`,
      )
      if (unmeasured.length > 0) {
        defs.push(
          `另有 ${unmeasured.length} 个更早的 commit 无法实测（首个原因：<code>${escapeHtml(
            unmeasured[0]!.measureError ?? 'n/a',
          )}</code>），不在图上，也没有用任何推算值代替。`,
        )
      }
      if (mismatchCeil.length > 0) {
        defs.push(
          `测试文件写的 ratchet 上限与实测 union gap 不相等的 commit：${mismatchCeil
            .map((p) => `<code>${p.shortSha}</code>（上限 ${p.ratchetCeiling} / 实测 ${p.measured!.unionGap}）`)
            .join('、')}。`,
        )
      }
      if (mismatchMd.length > 0) {
        defs.push(
          `提交的 <code>gap-*.md</code> 并集与实测逐场景并集不相等的 commit：${mismatchMd
            .map((p) => `<code>${p.shortSha}</code>（md ${p.reportMd.unionOfScenarioGaps} / 实测 ${p.measured!.unionOfScenarioGaps}）`)
            .join('、')}。`,
        )
      }
      if (!data.liveMatchesHistoryHead) {
        defs.push(
          `历史文件生成时的 HEAD 为 <code>${escapeHtml(hist.headSha.slice(0, 8))}</code>，当前服务的 HEAD 为 <code>${escapeHtml(
            (data.liveHeadSha ?? 'n/a').slice(0, 8),
          )}</code>；最右侧 LIVE 点始终是当前源码的实时测量。`,
        )
      }
    } else {
      defs.push(`<span class="k2-text--err">历史数据不可用：${escapeHtml(data.historyError ?? 'n/a')}</span>；图上只有 LIVE 实时点。`)
    }
    q<HTMLElement>('#k2-gap-definitions').innerHTML = defs.join('<br />')

    // Remaining gap functions.
    const leftBadge = q<HTMLElement>('#k2-gap-left-badge')
    leftBadge.textContent = `${live.unionGapVas.length} 个`
    leftBadge.className = `k2-badge ${live.unionGapVas.length === 0 ? 'k2-badge--ok' : 'k2-badge--warn'}`
    q<HTMLElement>('#k2-gap-left-body').innerHTML =
      live.unionGapVas.length === 0
        ? `<tr><td colspan="2" class="k2-cell--ok">无 — 缺口已归零</td></tr>`
        : live.unionGapVas
            .map((k) => {
              const va = k.slice(k.indexOf(':') + 1)
              return `<tr><td class="k2-mono">${escapeHtml(va)}</td><td>${escapeHtml(vaNames.get(va) ?? '…')}</td></tr>`
            })
            .join('')

    // Table.
    q<HTMLElement>('#k2-gap-table-note').textContent = `${points.length} 个点（含 LIVE）`
    q<HTMLElement>('#k2-gap-table-body').innerHTML = points
      .map((p, i) => {
        const m = p.measure
        const h = p.history
        return `<tr class="k2-clickable-row ${i === selected ? 'k2-row--sel' : ''}" data-idx="${i}">
          <td class="k2-mono">${escapeHtml(p.label)}</td>
          <td class="k2-mono">${h ? escapeHtml(beijing(h.committedAt)) : '实时'}</td>
          <td class="k2-mono ${m.unionGap === 0 ? 'k2-cell--ok' : ''}">${m.unionGap} / ${m.dllUnion}</td>
          <td class="k2-mono">${m.unionOfScenarioGaps}</td>
          <td class="k2-mono">${p.mdUnion ?? '—'}</td>
          <td class="k2-mono">${p.ceiling ?? '—'}</td>
          <td class="k2-mono">${h?.manifest ? `${fmtInt(h.manifest.d2GameDiffVerified)} / ${fmtInt(h.manifest.d2GameTotal)}` : '—'}</td>
          <td class="${m.allZeroDivergence ? 'k2-cell--ok' : 'k2-cell--err'}">${m.allZeroDivergence ? '✓' : '✗'}</td>
          <td>${h ? escapeHtml(h.subject.length > 70 ? `${h.subject.slice(0, 70)}…` : h.subject) : '当前工作树'}</td>
        </tr>`
      })
      .join('')
    for (const row of container.querySelectorAll<HTMLTableRowElement>('#k2-gap-table-body tr')) {
      row.addEventListener('click', () => select(Number.parseInt(row.dataset.idx ?? '0', 10)))
    }
    draw()
    renderSelected()
  }

  function select(idx: number): void {
    if (idx < 0 || idx >= points.length) return
    selected = idx
    renderAll()
  }

  async function load(): Promise<void> {
    if (loading || data) return
    loading = true
    try {
      data = await fetchJson<K2GapResponse>('/api/k2-showcase/gap')
      points = buildPoints(data)
      selected = points.length - 1
      renderAll()
      // Function names for the remaining-gap table (same manifest the call-graph zone uses).
      if (data.live.unionGapVas.length > 0) {
        try {
          const cg = await fetchJson<K2CallgraphResponse>('/api/k2-showcase/callgraph')
          for (const fn of cg.functions) vaNames.set(fn.va, fn.name)
          renderAll()
        } catch {
          // Names are optional decoration.
        }
      }
    } catch (e) {
      const verdict = q<HTMLElement>('#k2-gap-verdict')
      verdict.className = 'k2-note k2-note--err'
      verdict.textContent = `实测失败: ${e instanceof Error ? e.message : String(e)}`
    } finally {
      loading = false
    }
  }

  chart.addEventListener('click', (ev) => {
    if (hitboxes.length === 0) return
    const rect = chart.getBoundingClientRect()
    const x = ev.clientX - rect.left
    let best = hitboxes[0]!
    for (const hb of hitboxes) if (Math.abs(hb.x - x) < Math.abs(best.x - x)) best = hb
    select(best.idx)
  })

  const onResize = (): void => {
    if (active && data) draw()
  }

  return {
    activate(): void {
      active = true
      window.addEventListener('resize', onResize)
      if (data) draw()
      else void load()
    },
    deactivate(): void {
      active = false
      window.removeEventListener('resize', onResize)
    },
  }
}

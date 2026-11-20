/**
 * Zone 4 — `SUNITDMG_*` combat settlement sandbox (`showcase/k2/zone4-combat.ts`).
 *
 * LIVE in-browser execution (not precomputed): the canonical manifest-bound kernel port of
 * `D2Game.dll` `0x6FCFC0B0` is bundled into this page (`combat-browser-engine.ts`) and run on every
 * original-DLL damage-pipeline vector of `tests/fixtures/oracle/formulas/dmg.ndjson`. Inputs,
 * TS kernel output and expected DLL output are shown side by side; pass / fail counts are whatever
 * the kernel actually produces on this page load.
 */

import {
  K2_COMBAT_FIELDS,
  judgeSettlement,
  runCombatSettlement,
  settlementFeatures,
  type K2CombatField,
  type K2CombatRunResult,
  type K2CombatVerdict,
} from './combat-browser-engine.ts'
import {
  escapeHtml,
  fetchJson,
  fmtInt,
  fmtPct,
  type K2CallgraphResponse,
  type K2CombatExpected,
  type K2CombatResponse,
  type K2ZoneController,
} from './types.ts'

type VerdictFilter = 'all' | 'mismatch' | 'match'
type DefenderFilter = 'all' | 'player' | 'monster'

const FIELD_LABEL: Readonly<Record<K2CombatField, string>> = {
  phys: 'dwPhysDamage (+0x08)',
  elem: '元素通道伤害',
  total: 'dwDmgTotal (+0x4C)',
  absorb: 'dwAbsorbLife (+0x48)',
}
const DIFF_LABEL = ['Normal', 'Nightmare', 'Hell'] as const
const TABLE_LIMIT = 200
const SWEEP_CHUNK = 250

export function mountZone4Combat(container: HTMLElement): K2ZoneController {
  let data: K2CombatResponse | null = null
  let results: K2CombatRunResult[] = []
  let verdicts: K2CombatVerdict[] = []
  let sweepDone = false
  let sweepMs = 0
  let selected = -1
  let verdictFilter: VerdictFilter = 'all'
  let defenderFilter: DefenderFilter = 'all'
  let channelFilter = -1
  let loading = false
  const vaNames = new Map<string, string>()
  const indexByKey = new Map<string, number>()

  container.innerHTML = `
    <div class="k2-zone-stack">
      <div class="k2-note" id="k2-cb-verdict">正在加载 DLL 向量并在浏览器内执行规范内核…</div>

      <div class="k2-kpi-strip">
        <div class="k2-kpi"><span class="k2-kpi__label">结算全字段一致 / 结算总数（浏览器实跑）</span><span class="k2-kpi__val k2-mono" id="k2-cb-kpi-settle">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">字段一致 / DLL 采样字段</span><span class="k2-kpi__val k2-mono" id="k2-cb-kpi-fields">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">向量解码交叉校验（服务端闭式公式）</span><span class="k2-kpi__val k2-mono" id="k2-cb-kpi-decode">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">浏览器内核执行耗时</span><span class="k2-kpi__val k2-mono" id="k2-cb-kpi-ms">…</span></div>
      </div>

      <div class="k2-note" id="k2-cb-method"></div>

      <div class="k2-split-panels">
        <div class="k2-panel">
          <div class="k2-panel__hdr">
            <h3 class="k2-panel__title">输入 · TS 内核输出 · DLL 期望输出</h3>
            <span class="k2-badge" id="k2-cb-sel-badge">未选择</span>
          </div>
          <div class="k2-form-grid" id="k2-cb-form"></div>
          <div class="k2-btn-group">
            <button type="button" class="k2-btn k2-btn--primary" id="k2-cb-run">在浏览器内执行内核</button>
            <button type="button" class="k2-btn" id="k2-cb-next-bad">下一条不一致向量</button>
            <button type="button" class="k2-btn" id="k2-cb-next-ok">下一条一致向量</button>
          </div>
          <div class="k2-table-scroll">
            <table class="k2-table k2-table--compact">
              <thead><tr><th>输出字段</th><th>TS 内核（浏览器实跑）</th><th>DLL 期望</th><th>Δ (TS − DLL)</th><th>结果</th></tr></thead>
              <tbody id="k2-cb-out-body"></tbody>
            </table>
          </div>
          <div class="k2-muted" id="k2-cb-out-note"></div>
        </div>
        <div class="k2-panel">
          <div class="k2-panel__hdr">
            <h3 class="k2-panel__title">本次结算实际执行到的内核函数链（VA trace）</h3>
            <span class="k2-badge k2-mono" id="k2-cb-chain-count">—</span>
          </div>
          <div class="k2-table-scroll">
            <table class="k2-table k2-table--compact">
              <thead><tr><th>Module:VA</th><th>manifest 名称</th></tr></thead>
              <tbody id="k2-cb-chain-body"></tbody>
            </table>
          </div>
          <div class="k2-panel__hdr">
            <h3 class="k2-panel__title">不一致分布（按输入特征分桶，一条向量可落入多桶）</h3>
          </div>
          <div class="k2-table-scroll">
            <table class="k2-table k2-table--compact">
              <thead><tr><th>输入特征</th><th>结算数</th><th>全字段一致</th><th>不一致</th></tr></thead>
              <tbody id="k2-cb-feat-body"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="k2-panel">
        <div class="k2-panel__hdr">
          <h3 class="k2-panel__title">DLL 差分向量列表</h3>
          <div class="k2-inline-controls">
            <select id="k2-cb-filter-verdict" class="k2-select k2-input">
              <option value="all">全部</option>
              <option value="mismatch">仅不一致</option>
              <option value="match">仅一致</option>
            </select>
            <select id="k2-cb-filter-def" class="k2-select k2-input">
              <option value="all">防御方：全部</option>
              <option value="player">防御方：玩家</option>
              <option value="monster">防御方：怪物</option>
            </select>
            <select id="k2-cb-filter-ch" class="k2-select k2-input"><option value="-1">通道：全部</option></select>
            <span class="k2-muted" id="k2-cb-table-note"></span>
          </div>
        </div>
        <div class="k2-table-scroll" style="max-height: 280px">
          <table class="k2-table k2-table--compact">
            <thead>
              <tr>
                <th>#</th><th>防御方</th><th>难度</th><th>通道</th><th>phys256</th><th>elem256</th><th>rate54</th>
                <th>DR</th><th>MDR</th><th>physRes</th><th>res</th><th>maxRes</th><th>absPct</th><th>absFlat</th><th>pierce</th>
                <th>phys</th><th>elem</th><th>total</th><th>absorb</th>
              </tr>
            </thead>
            <tbody id="k2-cb-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const q = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T

  function fixtureOpts(trace: boolean) {
    return { playerBaseStats: data!.playerBaseStats, channels: data!.channels, trace }
  }

  function readForm(): number[] {
    const out: number[] = []
    for (const input of container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('#k2-cb-form [data-arg]')) {
      const idx = Number.parseInt(input.dataset.arg ?? '0', 10)
      const v = Number.parseInt(input.value, 10)
      out[idx] = Number.isFinite(v) ? v : 0
    }
    return out
  }

  function writeForm(a: readonly number[]): void {
    for (const input of container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('#k2-cb-form [data-arg]')) {
      const idx = Number.parseInt(input.dataset.arg ?? '0', 10)
      input.value = String(a[idx] ?? 0)
    }
  }

  function buildForm(): void {
    if (!data) return
    const names = data.argNames
    q<HTMLElement>('#k2-cb-form').innerHTML = names
      .map((name, i) => {
        if (name === 'defIsPlayer') {
          return `<label>防御方<select class="k2-input" data-arg="${i}"><option value="1">玩家</option><option value="0">怪物</option></select></label>`
        }
        if (name === 'difficulty') {
          return `<label>难度<select class="k2-input" data-arg="${i}">${DIFF_LABEL.map((d, k) => `<option value="${k}">${d}</option>`).join('')}</select></label>`
        }
        if (name === 'channel') {
          return `<label>元素通道<select class="k2-input" data-arg="${i}">${data!.channels
            .map((c, k) => `<option value="${k}">${escapeHtml(c.elemType)} (+0x${c.off.toString(16).toUpperCase()})</option>`)
            .join('')}</select></label>`
        }
        return `<label>${escapeHtml(name)}<input type="number" class="k2-input k2-mono" data-arg="${i}" value="0" /></label>`
      })
      .join('')
    q<HTMLSelectElement>('#k2-cb-filter-ch').innerHTML =
      `<option value="-1">通道：全部</option>` +
      data.channels.map((c, k) => `<option value="${k}">通道：${escapeHtml(c.elemType)}</option>`).join('')
  }

  function renderRun(a: readonly number[], exp: K2CombatExpected | null, vectorIdx: number): void {
    if (!data) return
    const r = runCombatSettlement(a, fixtureOpts(true))
    const badge = q<HTMLElement>('#k2-cb-sel-badge')
    const rows: string[] = []
    let verdictText = '自定义输入（无 DLL 向量）'
    let badgeCls = 'k2-badge'
    if (exp !== null) {
      const v = judgeSettlement(r, exp)
      verdictText = v.allMatch ? `向量 #${vectorIdx + 1} · 全字段一致` : `向量 #${vectorIdx + 1} · ${v.sampled - v.matched} / ${v.sampled} 字段不一致`
      badgeCls = `k2-badge ${v.allMatch ? 'k2-badge--ok' : 'k2-badge--err'}`
    }
    badge.textContent = verdictText
    badge.className = badgeCls
    for (const f of K2_COMBAT_FIELDS) {
      const want = exp ? exp[f] : null
      const got = r[f]
      const label = f === 'elem' ? `${FIELD_LABEL.elem} (+0x${(data.channels[a[3] ?? 0]?.off ?? 0).toString(16).toUpperCase()})` : FIELD_LABEL[f]
      if (want === null) {
        rows.push(`<tr><td>${label}</td><td class="k2-mono">${fmtInt(got)}</td><td class="k2-muted">${exp ? 'DLL 未采样' : '无向量'}</td><td>—</td><td>—</td></tr>`)
      } else {
        const ok = r.error === null && got === want
        rows.push(
          `<tr><td>${label}</td><td class="k2-mono ${ok ? 'k2-cell--ok' : 'k2-cell--err'}">${fmtInt(got)}</td><td class="k2-mono">${fmtInt(
            want,
          )}</td><td class="k2-mono">${got - want > 0 ? '+' : ''}${fmtInt(got - want)}</td><td class="${ok ? 'k2-cell--ok' : 'k2-cell--err'}">${ok ? '✓' : '✗'}</td></tr>`,
        )
      }
    }
    q<HTMLElement>('#k2-cb-out-body').innerHTML = rows.join('')
    const feats = settlementFeatures(a)
    q<HTMLElement>('#k2-cb-out-note').innerHTML =
      (r.error !== null ? `<span class="k2-text--err">内核抛出异常：${escapeHtml(r.error)}</span><br />` : '') +
      `数值为 1/256 生命定点。输入特征：${feats.length > 0 ? feats.map(escapeHtml).join('、') : '（无特殊特征）'}`
    q<HTMLElement>('#k2-cb-chain-count').textContent = `${r.chain.length} 个 VA`
    q<HTMLElement>('#k2-cb-chain-body').innerHTML = r.chain
      .map((key) => {
        const va = key.slice(key.indexOf(':') + 1)
        const name = key.startsWith('D2Game:') ? (vaNames.get(va) ?? '…') : '（D2Common，见 K1 展厅）'
        return `<tr><td class="k2-mono">${escapeHtml(key)}</td><td>${escapeHtml(name)}</td></tr>`
      })
      .join('')
  }

  function selectVector(idx: number): void {
    if (!data) return
    const s = data.settlements[idx]
    if (!s) return
    selected = idx
    writeForm(s.a)
    renderRun(s.a, s.exp, idx)
    renderTable()
  }

  function mark(v: boolean | null): string {
    if (v === null) return '<td class="k2-muted">—</td>'
    return v ? '<td class="k2-cell--ok">✓</td>' : '<td class="k2-cell--err">✗</td>'
  }

  function renderTable(): void {
    if (!data) return
    const rows: string[] = []
    let shown = 0
    let total = 0
    data.settlements.forEach((s, i) => {
      const v = verdicts[i]
      if (defenderFilter === 'player' && s.a[0] === 0) return
      if (defenderFilter === 'monster' && s.a[0] !== 0) return
      if (channelFilter >= 0 && s.a[3] !== channelFilter) return
      if (verdictFilter !== 'all') {
        if (!v) return
        if (verdictFilter === 'mismatch' && v.allMatch) return
        if (verdictFilter === 'match' && !v.allMatch) return
      }
      total++
      if (shown >= TABLE_LIMIT) return
      shown++
      const a = s.a
      rows.push(`<tr class="k2-clickable-row ${i === selected ? 'k2-row--sel' : ''}" data-idx="${i}">
        <td class="k2-mono">${i + 1}</td><td>${a[0] !== 0 ? '玩家' : '怪物'}</td><td>${DIFF_LABEL[a[1] ?? 0] ?? a[1]}</td>
        <td>${escapeHtml(data!.channels[a[3] ?? 0]?.elemType ?? String(a[3]))}</td>
        ${[2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((k) => `<td class="k2-mono">${a[k]}</td>`).join('')}
        ${v ? K2_COMBAT_FIELDS.map((f) => mark(v.fields[f])).join('') : '<td colspan="4" class="k2-muted">执行中…</td>'}
      </tr>`)
    })
    q<HTMLElement>('#k2-cb-table-body').innerHTML = rows.join('')
    q<HTMLElement>('#k2-cb-table-note').textContent = total > shown ? `显示前 ${shown} 行（共 ${fmtInt(total)} 行）` : `${fmtInt(total)} 行`
    for (const row of container.querySelectorAll<HTMLTableRowElement>('#k2-cb-table-body tr')) {
      row.addEventListener('click', () => selectVector(Number.parseInt(row.dataset.idx ?? '0', 10)))
    }
  }

  function renderSummary(): void {
    if (!data) return
    const n = data.settlements.length
    const done = verdicts.length
    let allMatch = 0
    let sampled = 0
    let matched = 0
    let errors = 0
    const feat = new Map<string, { total: number; ok: number }>()
    for (let i = 0; i < done; i++) {
      const v = verdicts[i]!
      if (v.allMatch) allMatch++
      sampled += v.sampled
      matched += v.matched
      if (results[i]!.error !== null) errors++
      const feats = settlementFeatures(data.settlements[i]!.a)
      for (const f of feats.length > 0 ? feats : ['（无特殊特征）']) {
        let e = feat.get(f)
        if (!e) {
          e = { total: 0, ok: 0 }
          feat.set(f, e)
        }
        e.total++
        if (v.allMatch) e.ok++
      }
    }
    const settleEl = q<HTMLElement>('#k2-cb-kpi-settle')
    settleEl.textContent = sweepDone ? `${fmtInt(allMatch)} / ${fmtInt(n)} (${fmtPct(allMatch, n)})` : `执行中 ${fmtInt(done)} / ${fmtInt(n)}`
    settleEl.className = `k2-kpi__val k2-mono ${sweepDone ? (allMatch === n ? 'k2-text--ok' : 'k2-text--err') : ''}`
    const fieldsEl = q<HTMLElement>('#k2-cb-kpi-fields')
    fieldsEl.textContent = `${fmtInt(matched)} / ${fmtInt(sampled)}${sampled > 0 ? ` (${fmtPct(matched, sampled)})` : ''}`
    fieldsEl.className = `k2-kpi__val k2-mono ${sweepDone ? (matched === sampled ? 'k2-text--ok' : 'k2-text--err') : ''}`
    const dec = data.decodeCheck
    const decEl = q<HTMLElement>('#k2-cb-kpi-decode')
    decEl.textContent = `${fmtInt(dec.matched)} / ${fmtInt(dec.lines)}`
    decEl.className = `k2-kpi__val k2-mono ${dec.matched === dec.lines ? 'k2-text--ok' : 'k2-text--err'}`
    q<HTMLElement>('#k2-cb-kpi-ms').textContent = sweepDone ? `${fmtInt(Math.round(sweepMs))} ms` : '…'

    const verdict = q<HTMLElement>('#k2-cb-verdict')
    if (!sweepDone) {
      verdict.className = 'k2-note'
      verdict.textContent = `浏览器正在执行规范内核：${fmtInt(done)} / ${fmtInt(n)} 条结算…`
    } else if (allMatch === n) {
      verdict.className = 'k2-note k2-note--ok'
      verdict.innerHTML = `<strong>实测结果：</strong>规范内核 <code>${escapeHtml(data.kernSymbol ?? '')}</code> 在浏览器内对全部 ${fmtInt(
        n,
      )} 条原版 DLL 结算向量（${fmtInt(sampled)} 个采样字段）逐字段一致。`
    } else {
      verdict.className = 'k2-note k2-note--err'
      verdict.innerHTML =
        `<strong>实测结果（如实展示，未做任何修饰）：</strong>规范内核 <code>${escapeHtml(data.kernSymbol ?? '')}</code>（manifest 状态 <code>${escapeHtml(
          data.kernStatus ?? 'n/a',
        )}</code>）在浏览器内对 ${fmtInt(n)} 条原版 DLL 结算向量只有 ${fmtInt(allMatch)} 条全字段一致，${fmtInt(n - allMatch)} 条存在不一致` +
        `（字段级 ${fmtInt(matched)} / ${fmtInt(sampled)} 一致${errors > 0 ? `，${fmtInt(errors)} 条内核抛异常` : ''}）。` +
        `同一批向量经服务端闭式公式解码校验为 ${fmtInt(dec.matched)} / ${fmtInt(dec.lines)}` +
        (dec.matched === dec.lines
          ? `，说明向量解码口径无误；剩余差异来自规范内核函数链（以及本展厅构造的内存夹具）在这些输入上的行为与原版 DLL 不同。`
          : `，解码校验本身未满分，差异归因需谨慎。`) +
        `这与 K2 回放零分歧并不矛盾：回放只证明回放输入范围内一致。`
    }

    const featRows = [...feat.entries()]
    featRows.sort((x, y) => y[1].total - y[1].ok - (x[1].total - x[1].ok))
    q<HTMLElement>('#k2-cb-feat-body').innerHTML = featRows
      .map(
        ([name, e]) =>
          `<tr><td>${escapeHtml(name)}</td><td class="k2-mono">${fmtInt(e.total)}</td><td class="k2-mono">${fmtInt(e.ok)}</td><td class="k2-mono ${
            e.total - e.ok === 0 ? 'k2-cell--ok' : 'k2-cell--err'
          }">${fmtInt(e.total - e.ok)}</td></tr>`,
      )
      .join('')
  }

  function renderMethod(): void {
    if (!data) return
    q<HTMLElement>('#k2-cb-method').innerHTML =
      `<strong>执行方式：浏览器内实时执行（非预计算）。</strong>本页打包了 <code>${escapeHtml(data.kernFile ?? '')}</code> 中绑定到 <code>D2Game.dll ${escapeHtml(
        data.dllVa,
      )}</code>（<code>${escapeHtml(data.dllName)}</code>）的规范内核函数及其调用链，在 <code>SparseMemory113c</code> 上逐条运行。` +
      `期望值来自 <code>${escapeHtml(data.vectorPath)}</code>（<code>${escapeHtml(data.schema)}</code>，seed ${data.seed}，${fmtInt(
        data.vectorLines,
      )} 行 → ${fmtInt(data.settlements.length)} 条不同输入的结算；每条结算 DLL 只采样了部分输出字段）。` +
      `<br /><strong>内存夹具说明：</strong>单位 / 属性表 / <code>D2DamageStrc</code> 由本展厅按向量参数构造（玩家基础属性取自向量文件头，<code>sgptDataTables</code> 为空表），并非 DLL 测试时的完整游戏内存镜像；` +
      `各输入的含义为 <code>[${data.argNames.map(escapeHtml).join(', ')}]</code>，伤害为 1/256 定点。`
  }

  function runSweepChunk(start: number, t0: number): void {
    if (!data) return
    const end = Math.min(data.settlements.length, start + SWEEP_CHUNK)
    for (let i = start; i < end; i++) {
      const s = data.settlements[i]!
      const r = runCombatSettlement(s.a, fixtureOpts(false))
      results.push(r)
      verdicts.push(judgeSettlement(r, s.exp))
    }
    if (end < data.settlements.length) {
      renderSummary()
      window.setTimeout(() => runSweepChunk(end, t0), 0)
      return
    }
    sweepMs = performance.now() - t0
    sweepDone = true
    renderSummary()
    renderTable()
    // Default selection: first mismatching vector if any, else the first vector.
    const firstBad = verdicts.findIndex((v) => !v.allMatch)
    selectVector(firstBad >= 0 ? firstBad : 0)
  }

  function step(dir: 'bad' | 'ok'): void {
    if (!data || verdicts.length === 0) return
    const n = verdicts.length
    for (let k = 1; k <= n; k++) {
      const i = (Math.max(0, selected) + k) % n
      if ((dir === 'bad') === !verdicts[i]!.allMatch) {
        selectVector(i)
        return
      }
    }
  }

  async function load(): Promise<void> {
    if (loading || data) return
    loading = true
    try {
      data = await fetchJson<K2CombatResponse>('/api/k2-showcase/combat')
      data.settlements.forEach((s, i) => indexByKey.set(s.a.join(','), i))
      buildForm()
      renderMethod()
      renderSummary()
      renderTable()
      window.setTimeout(() => runSweepChunk(0, performance.now()), 0)
      void fetchJson<K2CallgraphResponse>('/api/k2-showcase/callgraph')
        .then((cg) => {
          for (const fn of cg.functions) vaNames.set(fn.va, fn.name)
          if (selected >= 0) selectVector(selected)
        })
        .catch(() => {
          // Names are optional decoration.
        })
    } catch (e) {
      const verdict = q<HTMLElement>('#k2-cb-verdict')
      verdict.className = 'k2-note k2-note--err'
      verdict.textContent = `加载失败: ${e instanceof Error ? e.message : String(e)}`
    } finally {
      loading = false
    }
  }

  q<HTMLButtonElement>('#k2-cb-run').addEventListener('click', () => {
    if (!data) return
    const a = readForm()
    const idx = indexByKey.get(a.join(','))
    if (idx !== undefined) {
      selectVector(idx)
    } else {
      selected = -1
      renderRun(a, null, -1)
      renderTable()
    }
  })
  q<HTMLButtonElement>('#k2-cb-next-bad').addEventListener('click', () => step('bad'))
  q<HTMLButtonElement>('#k2-cb-next-ok').addEventListener('click', () => step('ok'))
  q<HTMLSelectElement>('#k2-cb-filter-verdict').addEventListener('change', (ev) => {
    verdictFilter = (ev.target as HTMLSelectElement).value as VerdictFilter
    renderTable()
  })
  q<HTMLSelectElement>('#k2-cb-filter-def').addEventListener('change', (ev) => {
    defenderFilter = (ev.target as HTMLSelectElement).value as DefenderFilter
    renderTable()
  })
  q<HTMLSelectElement>('#k2-cb-filter-ch').addEventListener('change', (ev) => {
    channelFilter = Number.parseInt((ev.target as HTMLSelectElement).value, 10)
    renderTable()
  })

  return {
    activate(): void {
      if (!data) void load()
    },
    deactivate(): void {
      // The sweep keeps its results; nothing to tear down.
    },
  }
}

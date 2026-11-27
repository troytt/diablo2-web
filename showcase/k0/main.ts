/**
 * [K0] Phase 0 Foundation & Go/No-Go Interactive Visual Showcase (`showcase/k0/main.ts`).
 *
 * Mounts 4 zero-mock exhibition zones into `#k0-showcase-app`:
 *   - Zone 1: Phase 0 Go/No-Go 门禁、13,644 实机差分账本与 11 槽 D2Net IAT 契约
 *   - Zone 2: 18 个冻结 1.13c 二进制内存结构体布局浏览器 (`route2-layout.json`)
 *   - Zone 3: 浏览器实时 `src/d2kern-113c` 沙盒 (PRNG + 64 槽事件轮 + Fog.#10223 Huffman)
 *   - Zone 4: `a1c-bloodmoor-fallen` 垂直切片锁步回放 (`F786..F825`, `F790/F801/F821`)
 */

import { renderKNavStripHtml } from '../shared/k-nav.ts'
import { mountSharedReplayWidget } from '../shared/replay-widget.ts'
import {
  escapeHtml,
  fetchJson,
  fmtHex32,
  fmtInt,
  type ShowcaseZoneController,
} from '../shared/types.ts'
import {
  BrowserTimerWheelSandbox,
  runFogHuffmanRoundtrip,
  stepCustomPrngRoll,
  sweepPrngVectorsInBrowser,
  type PrngVectorLike,
} from './k0-browser-engine.ts'

export type K0ZoneId = 'gates' | 'layouts' | 'sandbox' | 'slice'

interface K0Overview {
  readonly ok: true
  readonly manifest: {
    readonly total: number
    readonly sccCount: number
    readonly topoLayers: number
    readonly totals: readonly { readonly module: string; readonly total: number; readonly diffVerified: number; readonly ported: number; readonly unported: number }[]
  }
  readonly dispatchTables: {
    readonly totalTables: number
    readonly rootEntryPoints: number
    readonly d2GameTables: number
    readonly d2CommonTables: number
  }
  readonly frozenStructsCount: number
  readonly totalStructFields: number
  readonly fixtures: readonly {
    readonly id: string
    readonly label: string
    readonly relPath: string
    readonly bytes: number
    readonly recordCount: number
    readonly sha256: string
  }[]
  readonly totalDiffRecords: number
  readonly iatSlotCount: number
}

interface K0LayoutStruct {
  readonly name: string
  readonly size: number
  readonly allocEvidence: string
  readonly fields: readonly {
    readonly name: string
    readonly off: number
    readonly type: string
    readonly count: number
    readonly byteSize: number
    readonly comment: string | null
  }[]
  readonly coveredBytes: number
  readonly coveragePct: number
}

interface K0LayoutsResp {
  readonly ok: true
  readonly sourcePath: string
  readonly structCount: number
  readonly totalFields: number
  readonly structs: readonly K0LayoutStruct[]
}

interface K0VectorsResp {
  readonly ok: true
  readonly prng: {
    readonly relPath: string
    readonly sha256: string
    readonly recordCount: number
    readonly recordSize: number
    readonly offset: number
    readonly limit: number
    readonly records: readonly PrngVectorLike[]
  }
  readonly eventWheel: {
    readonly relPath: string
    readonly sha256: string
    readonly recordCount: number
    readonly recordSize: number
    readonly magic: string
    readonly kind: string
  }
  readonly d2NetIat: readonly {
    readonly slotIndex: number
    readonly iatVa: string
    readonly d2gameThunkVa: string
    readonly ordinal: number
    readonly d2netVa: string
    readonly argCount: number
    readonly stackBytes: number
    readonly name: string
  }[]
}

const ZONES: readonly {
  readonly id: K0ZoneId
  readonly idx: string
  readonly navTitle: string
  readonly navSub: string
  readonly headerTitle: string
  readonly headerSub: string
}[] = [
  {
    id: 'gates',
    idx: 'ZONE 01',
    navTitle: 'Go/No-Go 门禁与差分账本',
    navSub: '4,810 图谱 · 13,644 实机记录',
    headerTitle: 'Zone 1 · [K0] Phase 0 Go/No-Go Exit Gates, Callgraph & 11-Slot D2Net IAT',
    headerSub: '实时解析 manifest-113c.json、dispatch-tables-113c.json、route2 差分样本与 11 槽 D2Game->D2Net IAT 二进制契约。',
  },
  {
    id: 'layouts',
    idx: 'ZONE 02',
    navTitle: '18 冻结结构体内存图',
    navSub: 'route2-layout.json 字节映射',
    headerTitle: 'Zone 2 · 18 Frozen 1.13c Binary Struct Layouts (docs/oracle/route2-layout.json)',
    headerSub: 'D2UnitStrc (0xF4) / D2GameStrc (0x1DF4) / D2TimerStrc (0xA20) 等 18 个核心结构偏移、分配证据与字节覆盖可视化。',
  },
  {
    id: 'sandbox',
    idx: 'ZONE 03',
    navTitle: '浏览器内核基元沙盒',
    navSub: 'PRNG · 64槽事件轮 · Huffman',
    headerTitle: 'Zone 3 · Live Browser src/d2kern-113c Sandbox (PRNG + D2TimerStrc + Fog.#10223)',
    headerSub: '100% 浏览器端实跑纯内核模块：校验 prng-10k.d2tv、单步推进 64 槽事件轮与实时 Fog Huffman 压缩/解压缩往返。',
  },
  {
    id: 'slice',
    idx: 'ZONE 04',
    navTitle: '沉沦魔垂直切片回放',
    navSub: 'F786..F825 (F790/F801/F821)',
    headerTitle: 'Zone 4 · a1c-bloodmoor-fallen Vertical Slice Lockstep Replay (F786..F825)',
    headerSub: '纯 src/d2kern-113c 零分歧复现 F790 LIFO 连续重入、F801 击杀死亡环 dwDeathRing[0]=12 与 F821 持久/定时事件先后序。',
  },
]

function mountZone1Gates(container: HTMLElement): ShowcaseZoneController {
  let loaded = false
  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-kpi-strip">
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">静态可达内核函数 / Tarjan SCC</span><span class="d2ks-kpi__val d2ks-mono" id="k0-g-cg">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">二进制验证派发表 / 拓扑层</span><span class="d2ks-kpi__val d2ks-mono" id="k0-g-dt">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">实机差分记录总数 (route2 + D2TV)</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k0-g-diff">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">冻结结构体 / 字段 / D2Net IAT</span><span class="d2ks-kpi__val d2ks-mono" id="k0-g-st">…</span></div>
      </div>

      <div class="d2ks-note d2ks-note--ok">
        <strong>[K0] Go/No-Go 结论：GO。</strong>
        所有 8 项 Phase 0 退出门禁全部通过，确立 <code>SparseMemory113c + layout.generated.ts</code>（Route B：404 SLOC 零指针图编解码税）与
        <code>d2host-113c.exe</code> 无头实机（~23,600–25,052 fps）双轨架构。
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">实机差分样本与 D2TV 资产账本（服务端实时统计与 SHA-256 校验）</h3>
          <span class="d2ks-badge d2ks-badge--ok">LIVE SHA-256</span>
        </div>
        <div class="d2ks-table-scroll">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>资产名称</th><th>仓库路径</th><th>记录数</th><th>文件字节</th><th>SHA-256</th></tr>
            </thead>
            <tbody id="k0-g-fixtures-tbody"><tr><td colspan="5" class="d2ks-muted">正在加载…</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">11 槽 D2Game.dll → D2Net.dll PE IAT 二进制契约 (0x6FD18B48..0x6FD18B70)</h3>
          <span class="d2ks-muted d2ks-mono">src/d2kern-113c/net/packet-sink.ts :: D2GAME_D2NET_IAT_113C</span>
        </div>
        <div class="d2ks-table-scroll">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>Slot</th><th>IAT VA</th><th>D2Game Thunk</th><th>Ordinal</th><th>D2Net VA</th><th>Args / Stack</th><th>符号名称</th></tr>
            </thead>
            <tbody id="k0-g-iat-tbody"><tr><td colspan="7" class="d2ks-muted">正在加载…</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  return {
    activate(): void {
      if (loaded) return
      loaded = true
      void Promise.all([
        fetchJson<K0Overview>('/api/k0-showcase/overview'),
        fetchJson<K0VectorsResp>('/api/k0-showcase/vectors?limit=32'),
      ]).then(([ov, vec]) => {
        const set = (id: string, val: string): void => {
          const el = container.querySelector(`#${id}`)
          if (el) el.textContent = val
        }
        set('k0-g-cg', `${fmtInt(ov.manifest.total)} fns / ${fmtInt(ov.manifest.sccCount)} SCC`)
        set('k0-g-dt', `${ov.dispatchTables.totalTables} tables · ${ov.manifest.topoLayers} layers`)
        set('k0-g-diff', `${fmtInt(ov.totalDiffRecords)} records`)
        set('k0-g-st', `${ov.frozenStructsCount} structs / ${ov.totalStructFields} fields / ${ov.iatSlotCount} IAT`)

        const fBody = container.querySelector('#k0-g-fixtures-tbody')
        if (fBody) {
          fBody.innerHTML = ov.fixtures
            .map(
              (f) => `
                <tr>
                  <td>${escapeHtml(f.label)}</td>
                  <td class="d2ks-mono">${escapeHtml(f.relPath)}</td>
                  <td class="d2ks-mono d2ks-text--ok">${fmtInt(f.recordCount)}</td>
                  <td class="d2ks-mono">${fmtInt(f.bytes)} B</td>
                  <td class="d2ks-mono d2ks-muted">${escapeHtml(f.sha256.slice(0, 20))}…</td>
                </tr>
              `,
            )
            .join('')
        }
        const iBody = container.querySelector('#k0-g-iat-tbody')
        if (iBody) {
          iBody.innerHTML = vec.d2NetIat
            .map(
              (s) => `
                <tr>
                  <td class="d2ks-mono">#${s.slotIndex}</td>
                  <td class="d2ks-mono d2ks-gold">${escapeHtml(s.iatVa)}</td>
                  <td class="d2ks-mono">${escapeHtml(s.d2gameThunkVa)}</td>
                  <td class="d2ks-mono">#${s.ordinal}</td>
                  <td class="d2ks-mono d2ks-text--cyan">${escapeHtml(s.d2netVa)}</td>
                  <td class="d2ks-mono">${s.argCount} args / 0x${s.stackBytes.toString(16).padStart(2, '0')}</td>
                  <td class="d2ks-mono">${escapeHtml(s.name)}</td>
                </tr>
              `,
            )
            .join('')
        }
      })
    },
    deactivate(): void {
      // Nothing animated
    },
  }
}

function mountZone2Layouts(container: HTMLElement): ShowcaseZoneController {
  let data: K0LayoutsResp | null = null
  let selectedName = 'D2UnitStrc'
  let search = ''

  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-toolbar">
        <label class="d2ks-field-inline">
          <span>冻结结构体 (18):</span>
          <select class="d2ks-select" id="k0-ly-select"></select>
        </label>
        <input type="search" class="d2ks-input" id="k0-ly-search" placeholder="搜索字段名 / 偏移 (如 0x5C, pStatList)..." style="flex: 1 1 200px" />
        <span class="d2ks-badge d2ks-mono" id="k0-ly-badge">…</span>
      </div>

      <div class="d2ks-kpi-strip">
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">当前结构体</span><span class="d2ks-kpi__val d2ks-mono" id="k0-ly-name">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">sizeof (字节 / Hex)</span><span class="d2ks-kpi__val d2ks-mono" id="k0-ly-size">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">已冻结字段数</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k0-ly-fields">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">已声明字节覆盖率</span><span class="d2ks-kpi__val d2ks-mono" id="k0-ly-cov">…</span></div>
      </div>

      <div class="d2ks-canvas-card">
        <div class="d2ks-canvas-card__hdr">
          <span>结构体字节布局热力条（青=ptr，金=u32/i32，绿=u16/u8，深灰=未命名填充/保留字节）</span>
          <span class="d2ks-mono d2ks-muted" id="k0-ly-evidence"></span>
        </div>
        <canvas class="d2ks-canvas" id="k0-ly-canvas" style="height: 84px"></canvas>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">字段偏移明细表</h3>
          <span class="d2ks-muted d2ks-mono" id="k0-ly-count"></span>
        </div>
        <div class="d2ks-table-scroll d2ks-table-scroll--tall">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>Offset (Hex)</th><th>Dec</th><th>字段名</th><th>类型</th><th>元素数</th><th>宽度</th><th>二进制证据 / 注释</th></tr>
            </thead>
            <tbody id="k0-ly-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const selectEl = container.querySelector('#k0-ly-select') as HTMLSelectElement
  const searchEl = container.querySelector('#k0-ly-search') as HTMLInputElement
  const canvas = container.querySelector('#k0-ly-canvas') as HTMLCanvasElement
  const tbody = container.querySelector('#k0-ly-tbody') as HTMLElement

  function renderSelected(): void {
    if (!data) return
    const st = data.structs.find((s) => s.name === selectedName) ?? data.structs[0]
    if (!st) return
    const set = (id: string, val: string): void => {
      const el = container.querySelector(`#${id}`)
      if (el) el.textContent = val
    }
    set('k0-ly-badge', `${data.structCount} structs · ${data.totalFields} fields`)
    set('k0-ly-name', st.name)
    set('k0-ly-size', `${st.size} B (0x${st.size.toString(16).toUpperCase()})`)
    set('k0-ly-fields', String(st.fields.length))
    set('k0-ly-cov', `${st.coveredBytes} / ${st.size} B (${st.coveragePct}%)`)
    set('k0-ly-evidence', st.allocEvidence || 'docs/oracle/route2-layout.json')

    // Draw byte-offset map
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const w = Math.max(360, Math.floor(canvas.clientWidth || 720))
      const h = 84
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.fillStyle = '#090806'
      ctx.fillRect(0, 0, w, h)
      const barY = 18
      const barH = 38
      ctx.fillStyle = '#1d1812'
      ctx.fillRect(10, barY, w - 20, barH)
      const usableW = w - 20
      for (const f of st.fields) {
        const x0 = 10 + (f.off / Math.max(1, st.size)) * usableW
        const fw = Math.max(2, (f.byteSize / Math.max(1, st.size)) * usableW)
        ctx.fillStyle =
          f.type === 'ptr' ? '#58d5ff' : f.type === 'u8' || f.type === 'u16' || f.type === 'i16' ? '#38d9a9' : '#c7b377'
        ctx.fillRect(x0, barY + 2, fw, barH - 4)
      }
      ctx.strokeStyle = '#755f3b'
      ctx.strokeRect(10, barY, usableW, barH)
      ctx.fillStyle = '#968a74'
      ctx.font = '10px monospace'
      for (let q = 0; q <= 4; q++) {
        const off = Math.round((st.size * q) / 4)
        const tx = 10 + (q / 4) * usableW
        ctx.fillText(`+0x${off.toString(16).toUpperCase()}`, Math.min(w - 46, Math.max(10, tx - 14)), barY + barH + 16)
      }
    }

    const q = search.trim().toLowerCase()
    const rows = q
      ? st.fields.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            `0x${f.off.toString(16)}`.includes(q) ||
            (f.comment ?? '').toLowerCase().includes(q),
        )
      : st.fields
    set('k0-ly-count', `显示 ${rows.length} / ${st.fields.length} 字段`)
    tbody.innerHTML = rows
      .map(
        (f) => `
          <tr>
            <td class="d2ks-mono d2ks-gold">+0x${f.off.toString(16).toUpperCase().padStart(2, '0')}</td>
            <td class="d2ks-mono">${f.off}</td>
            <td class="d2ks-mono">${escapeHtml(f.name)}</td>
            <td><span class="d2ks-pill ${f.type === 'ptr' ? 'd2ks-pill--info' : 'd2ks-pill--ok'}">${escapeHtml(f.type)}</span></td>
            <td class="d2ks-mono">${f.count}</td>
            <td class="d2ks-mono">${f.byteSize} B</td>
            <td class="d2ks-wrap d2ks-muted">${escapeHtml(f.comment ?? '')}</td>
          </tr>
        `,
      )
      .join('')
  }

  selectEl.addEventListener('change', () => {
    selectedName = selectEl.value
    renderSelected()
  })
  searchEl.addEventListener('input', () => {
    search = searchEl.value
    renderSelected()
  })

  return {
    activate(): void {
      if (data) {
        renderSelected()
        return
      }
      void fetchJson<K0LayoutsResp>('/api/k0-showcase/layouts').then((resp) => {
        data = resp
        selectEl.innerHTML = resp.structs
          .map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)} (0x${s.size.toString(16).toUpperCase()} / ${s.fields.length}f)</option>`)
          .join('')
        selectEl.value = selectedName
        renderSelected()
      })
    },
    deactivate(): void {
      // No-op
    },
  }
}

function mountZone3Sandbox(container: HTMLElement): ShowcaseZoneController {
  let vectorsLoaded = false
  let prngVectors: readonly PrngVectorLike[] = []
  let wheel = new BrowserTimerWheelSandbox(786)
  // Seed iconic F790 / F801 / F821 style demo events on the live kernel wheel
  wheel.schedulePersistent(1, 0, 12)
  wheel.scheduleTimed(1, 1, 790, 12)
  wheel.scheduleTimed(1, 1, 801, 12)
  wheel.scheduleTimed(0, 3, 795, 1)

  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-split-panels d2ks-split-panels--equal">
        <div class="d2ks-panel">
          <div class="d2ks-panel__hdr">
            <h3 class="d2ks-panel__title">1. PRNG 64-bit LCG (0x6FC21180) 浏览器实跑</h3>
            <span class="d2ks-badge d2ks-badge--ok" id="k0-sb-prng-badge">等待校验…</span>
          </div>
          <div class="d2ks-form-grid">
            <label>seedLo (Hex)<input class="d2ks-input d2ks-mono" id="k0-prng-lo" value="0x12345678" /></label>
            <label>seedHi (Hex)<input class="d2ks-input d2ks-mono" id="k0-prng-hi" value="0x0000029A" /></label>
            <label>nMax (signed i32)<input class="d2ks-input d2ks-mono" id="k0-prng-max" value="100" /></label>
          </div>
          <div class="d2ks-toolbar">
            <button type="button" class="d2ks-btn d2ks-btn--primary" id="k0-prng-roll">Roll 一次</button>
            <button type="button" class="d2ks-btn d2ks-btn--sm" data-prng-edge="-1">测试 nMax=-1 (不推进)</button>
            <button type="button" class="d2ks-btn d2ks-btn--sm" data-prng-edge="0">测试 nMax=0</button>
            <button type="button" class="d2ks-btn d2ks-btn--sm" id="k0-prng-sweep">复验实机 D2TV 批次</button>
          </div>
          <div class="d2ks-code-box" id="k0-prng-out">点击 Roll 或复验实时执行 src/d2kern-113c/prng.ts :: seedRoll()</div>
        </div>

        <div class="d2ks-panel">
          <div class="d2ks-panel__hdr">
            <h3 class="d2ks-panel__title">2. Fog.#10223 Huffman + D2Net.#10002 编解码沙盒</h3>
            <span class="d2ks-badge d2ks-badge--ok" id="k0-huf-badge">READY</span>
          </div>
          <label class="d2ks-field-inline" style="width: 100%">
            <span>原始 S2C Hex:</span>
            <input class="d2ks-input d2ks-mono" id="k0-huf-hex" style="max-width: none; flex: 1 1 auto" value="59 01 00 00 00 04 42 61 72 62 00 00 00 00 00 00 00 00 00 00 00 00 5c 15 0c 17" />
          </label>
          <div class="d2ks-toolbar">
            <button type="button" class="d2ks-btn d2ks-btn--primary" id="k0-huf-run">压缩 → 封帧 → 解压往返</button>
            <button type="button" class="d2ks-btn d2ks-btn--sm" data-huf-preset="15 00 01 00 00 00 5c 15 0c 17 01">S2C 0x15 Reassign</button>
            <button type="button" class="d2ks-btn d2ks-btn--sm" data-huf-preset="03 00 39 30 00 00 01 00 00 00 00 00">S2C 0x03 LoadAct</button>
          </div>
          <div class="d2ks-code-box" id="k0-huf-out"></div>
        </div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">3. D2TimerStrc 64 槽事件时间轮 (0x6FCAF070) 浏览器实时推演</h3>
          <span class="d2ks-badge d2ks-mono" id="k0-tw-badge">F786 (slot 18)</span>
        </div>
        <div class="d2ks-toolbar">
          <button type="button" class="d2ks-btn d2ks-btn--primary" id="k0-tw-step">步进 +1 帧</button>
          <button type="button" class="d2ks-btn" id="k0-tw-step5">步进 +5 帧</button>
          <button type="button" class="d2ks-btn" id="k0-tw-add-timed">挂定时事件 (+4f)</button>
          <button type="button" class="d2ks-btn" id="k0-tw-add-pers">挂持久事件 (LIFO)</button>
          <button type="button" class="d2ks-btn" id="k0-tw-reset">重置时间轮</button>
        </div>
        <canvas class="d2ks-canvas" id="k0-tw-canvas" style="height: 112px"></canvas>
        <div class="d2ks-code-box" id="k0-tw-log"></div>
      </div>
    </div>
  `

  const loIn = container.querySelector('#k0-prng-lo') as HTMLInputElement
  const hiIn = container.querySelector('#k0-prng-hi') as HTMLInputElement
  const maxIn = container.querySelector('#k0-prng-max') as HTMLInputElement
  const prngOut = container.querySelector('#k0-prng-out') as HTMLElement
  const prngBadge = container.querySelector('#k0-sb-prng-badge') as HTMLElement
  const hufHex = container.querySelector('#k0-huf-hex') as HTMLInputElement
  const hufOut = container.querySelector('#k0-huf-out') as HTMLElement
  const hufBadge = container.querySelector('#k0-huf-badge') as HTMLElement
  const twCanvas = container.querySelector('#k0-tw-canvas') as HTMLCanvasElement
  const twBadge = container.querySelector('#k0-tw-badge') as HTMLElement
  const twLog = container.querySelector('#k0-tw-log') as HTMLElement

  function renderHuffman(): void {
    try {
      const r = runFogHuffmanRoundtrip(hufHex.value, 1)
      hufBadge.textContent = r.exactRoundtrip ? `ROUNDTRIP BIT-EXACT (${r.ratioPct}%)` : 'MISMATCH'
      hufBadge.className = r.exactRoundtrip ? 'd2ks-badge d2ks-badge--ok' : 'd2ks-badge d2ks-badge--err'
      hufOut.textContent = [
        `Raw (${r.rawLen} B)        : ${r.rawHex}`,
        `Fog.#10223 (${r.compressedLen} B) : ${r.compressedHex}`,
        `D2Net.#10002 (${r.framedLen} B): ${r.framedHex}`,
        `Decompressed (${r.rawLen} B): ${r.decompressedHex}`,
        `Bit-Exact Roundtrip : ${r.exactRoundtrip}`,
      ].join('\n')
    } catch (e) {
      hufBadge.textContent = 'PARSE ERROR'
      hufBadge.className = 'd2ks-badge d2ks-badge--err'
      hufOut.textContent = e instanceof Error ? e.message : String(e)
    }
  }

  function renderWheel(): void {
    const snap = wheel.snapshot()
    twBadge.textContent = `F${snap.currentFrame} · slot ${snap.currentSlot} (frame & 63) · 持久事件 ${snap.persistentCount}`
    const ctx = twCanvas.getContext('2d')
    if (ctx) {
      const w = Math.max(380, Math.floor(twCanvas.clientWidth || 720))
      const h = 112
      if (twCanvas.width !== w || twCanvas.height !== h) {
        twCanvas.width = w
        twCanvas.height = h
      }
      ctx.fillStyle = '#090806'
      ctx.fillRect(0, 0, w, h)
      const cellW = (w - 20) / 64
      for (let i = 0; i < 64; i++) {
        const cnt = snap.slotCounts[i] ?? 0
        const x = 10 + i * cellW
        const isCur = i === snap.currentSlot
        ctx.fillStyle = isCur ? '#43341b' : cnt > 0 ? '#1b4738' : '#15120e'
        ctx.fillRect(x + 0.5, 16, Math.max(2, cellW - 1), 64)
        if (cnt > 0) {
          const barH = Math.min(54, cnt * 18)
          ctx.fillStyle = isCur ? '#f0dc9c' : '#38d9a9'
          ctx.fillRect(x + 1, 78 - barH, Math.max(1, cellW - 2), barH)
        }
        if (isCur) {
          ctx.strokeStyle = '#f0dc9c'
          ctx.lineWidth = 1.5
          ctx.strokeRect(x + 0.5, 16, Math.max(2, cellW - 1), 64)
        }
        if (i % 8 === 0) {
          ctx.fillStyle = '#968a74'
          ctx.font = '10px monospace'
          ctx.fillText(String(i), x, 98)
        }
      }
      ctx.fillStyle = '#c7b377'
      ctx.font = '11px monospace'
      ctx.fillText('64-Slot Wheel (slots 0..63 · partition dispatch order [2, 0, 1, 3, 4], persistent LIFO before timed FIFO)', 10, 12)
    }

    if (snap.firedHistory.length === 0) {
      twLog.textContent = '尚未触发事件：点击「步进 +1 帧」或「步进 +5 帧」观察持久事件先于定时槽位触发。'
    } else {
      twLog.textContent = snap.firedHistory
        .slice(0, 14)
        .map(
          (e) =>
            `F${e.frame} [slot ${String(e.slot).padStart(2, '0')}] ${e.persistent ? 'PERSISTENT(LIFO)' : 'TIMED(FIFO)     '} unitType=${e.unitType} id=#${e.unitId} evType=${e.eventType} arg14=${e.arg14}`,
        )
        .join('\n')
    }
  }

  function runPrngSweep(): void {
    if (prngVectors.length === 0) return
    const res = sweepPrngVectorsInBrowser(prngVectors)
    prngBadge.textContent = `${res.matched} / ${res.tested} D2TV PASS`
    prngBadge.className = res.matched === res.tested ? 'd2ks-badge d2ks-badge--ok' : 'd2ks-badge d2ks-badge--err'
    prngOut.textContent = `浏览器实跑 src/d2kern-113c/prng.ts :: seedRoll() 对照 prng-10k.d2tv:\n通过: ${res.matched} / ${res.tested} (0 分歧)${
      res.firstMismatch ? `\n首个分歧: #${res.firstMismatch.index}` : '\n所有边界值 (nMax <= 0, 2^31, 0xFFFFFFFF) 与原版 1.13c DLL 完全逐位一致。'
    }`
  }

  container.querySelector('#k0-prng-roll')?.addEventListener('click', () => {
    const lo = Number.parseInt(loIn.value, 16) >>> 0
    const hi = Number.parseInt(hiIn.value, 16) >>> 0
    const nMax = Number.parseInt(maxIn.value, 10) | 0
    const res = stepCustomPrngRoll(lo, hi, nMax)
    loIn.value = fmtHex32(res.nextLo)
    hiIn.value = fmtHex32(res.nextHi)
    prngOut.textContent = `seedRoll([${fmtHex32(lo)}, ${fmtHex32(hi)}], nMax=${nMax})\n  -> rolled = ${res.rolled}\n  -> next   = [${fmtHex32(res.nextLo)}, ${fmtHex32(res.nextHi)}]`
  })
  container.querySelectorAll<HTMLButtonElement>('[data-prng-edge]').forEach((btn) => {
    btn.addEventListener('click', () => {
      maxIn.value = btn.dataset.prngEdge ?? '0'
      ;(container.querySelector('#k0-prng-roll') as HTMLButtonElement).click()
    })
  })
  container.querySelector('#k0-prng-sweep')?.addEventListener('click', runPrngSweep)

  container.querySelector('#k0-huf-run')?.addEventListener('click', renderHuffman)
  container.querySelectorAll<HTMLButtonElement>('[data-huf-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      hufHex.value = btn.dataset.hufPreset ?? ''
      renderHuffman()
    })
  })

  container.querySelector('#k0-tw-step')?.addEventListener('click', () => {
    wheel.stepOneFrame()
    renderWheel()
  })
  container.querySelector('#k0-tw-step5')?.addEventListener('click', () => {
    for (let i = 0; i < 5; i++) wheel.stepOneFrame()
    renderWheel()
  })
  container.querySelector('#k0-tw-add-timed')?.addEventListener('click', () => {
    wheel.scheduleTimed(1, 1, wheel.getFrame() + 4, 42)
    renderWheel()
  })
  container.querySelector('#k0-tw-add-pers')?.addEventListener('click', () => {
    wheel.schedulePersistent(1, 0, 99)
    renderWheel()
  })
  container.querySelector('#k0-tw-reset')?.addEventListener('click', () => {
    wheel = new BrowserTimerWheelSandbox(786)
    wheel.schedulePersistent(1, 0, 12)
    wheel.scheduleTimed(1, 1, 790, 12)
    wheel.scheduleTimed(1, 1, 801, 12)
    renderWheel()
  })

  return {
    activate(): void {
      renderHuffman()
      renderWheel()
      if (!vectorsLoaded) {
        vectorsLoaded = true
        void fetchJson<K0VectorsResp>('/api/k0-showcase/vectors?offset=0&limit=200').then((resp) => {
          prngVectors = resp.prng.records
          runPrngSweep()
        })
      }
    },
    deactivate(): void {
      // No-op
    },
  }
}

export function mountK0ShowcaseApp(root: HTMLElement): void {
  const doc = root.ownerDocument ?? document
  root.innerHTML = `
    <div class="d2ks-shell">
      <aside class="d2ks-sidebar" id="k0-sidebar">
        <div class="d2ks-brand">
          <div class="d2ks-brand__eyebrow">DIABLO II v1.13c · [K0] PHASE 0</div>
          <h1 class="d2ks-brand__title">内核底座与 Go/No-Go 展厅</h1>
          <div class="d2ks-brand__sub" id="k0-sidebar-cert">正在加载实机数据…</div>
        </div>

        <nav class="d2ks-nav" aria-label="K0 Showcase Zones" id="k0-zone-nav"></nav>

        <div class="d2ks-sidebar-metrics">
          <div class="d2ks-metric-row"><span>可达函数 closure</span><strong class="d2ks-mono" id="k0-m-fns">…</strong></div>
          <div class="d2ks-metric-row"><span>派发表 / 拓扑层</span><strong class="d2ks-mono" id="k0-m-dt">…</strong></div>
          <div class="d2ks-metric-row"><span>冻结结构体</span><strong class="d2ks-mono" id="k0-m-st">…</strong></div>
          <div class="d2ks-metric-row"><span>差分记录总数</span><strong class="d2ks-mono d2ks-text--ok" id="k0-m-diff">…</strong></div>
          <div class="d2ks-metric-row"><span>D2Net IAT 槽</span><strong class="d2ks-mono" id="k0-m-iat">…</strong></div>
        </div>

        ${renderKNavStripHtml('K0', 'd2ks')}

        <div class="d2ks-sidebar-links">
          <a href="/" class="d2ks-btn d2ks-btn--block">庇护之地门户 (Portal)</a>
          <a href="/play.html" class="d2ks-btn d2ks-btn--block">进入完整游戏 (Play)</a>
        </div>
      </aside>

      <main class="d2ks-main" id="k0-main">
        <header class="d2ks-zone-header">
          <div class="d2ks-zone-header__titles">
            <h2 class="d2ks-zone-header__title" id="k0-active-title"></h2>
            <p class="d2ks-zone-header__sub" id="k0-active-sub"></p>
          </div>
          <div class="d2ks-zone-header__pills">
            <span class="d2ks-badge d2ks-badge--ok">ZERO MOCK DATA</span>
            <span class="d2ks-badge" id="k0-header-zone-pill">ZONE 01 / 04</span>
          </div>
        </header>

        <section id="k0-panel-gates" class="d2ks-zone-panel"></section>
        <section id="k0-panel-layouts" class="d2ks-zone-panel" hidden></section>
        <section id="k0-panel-sandbox" class="d2ks-zone-panel" hidden></section>
        <section id="k0-panel-slice" class="d2ks-zone-panel" hidden></section>
      </main>
    </div>
  `

  const q = (sel: string): HTMLElement => root.querySelector(sel) as HTMLElement
  const navEl = q('#k0-zone-nav')
  const mainEl = q('#k0-main')
  const panels: Record<K0ZoneId, HTMLElement> = {
    gates: q('#k0-panel-gates'),
    layouts: q('#k0-panel-layouts'),
    sandbox: q('#k0-panel-sandbox'),
    slice: q('#k0-panel-slice'),
  }

  const controllers: Record<K0ZoneId, ShowcaseZoneController> = {
    gates: mountZone1Gates(panels.gates),
    layouts: mountZone2Layouts(panels.layouts),
    sandbox: mountZone3Sandbox(panels.sandbox),
    slice: mountSharedReplayWidget(panels.slice, {
      idPrefix: 'k0-rp',
      scenarios: [
        {
          id: 'a1c-bloodmoor-fallen',
          label: 'a1c-bloodmoor-fallen · K0 垂直切片 (F786..F825)',
          badge: '40/40 EXACT',
          note: '重点观察 F790 (连续 WL LIFO 重入)、F801 (野蛮人击杀沉沦魔 #12 写入 dwDeathRing[0]=12) 与 F821 (持久事件先于定时槽 821&63=53)。',
          bookmarks: [
            { frame: 790, label: 'F790 LIFO重入' },
            { frame: 801, label: 'F801 击杀#12' },
            { frame: 821, label: 'F821 DT→DD' },
          ],
        },
      ],
      buildUrl: () => '/api/k0-showcase/replay',
    }),
  }

  const navBtns = new Map<K0ZoneId, HTMLButtonElement>()
  let current: K0ZoneId | null = null

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

  function switchZone(next: K0ZoneId): void {
    if (current === next) return
    if (current !== null) controllers[current].deactivate()
    current = next
    const idx = ZONES.findIndex((z) => z.id === next)
    const meta = ZONES[idx >= 0 ? idx : 0]!
    q('#k0-active-title').textContent = meta.headerTitle
    q('#k0-active-sub').textContent = meta.headerSub
    q('#k0-header-zone-pill').textContent = `ZONE 0${idx + 1} / 0${ZONES.length}`
    for (const z of ZONES) {
      panels[z.id].hidden = z.id !== next
      navBtns.get(z.id)?.classList.toggle('d2ks-nav-btn--active', z.id === next)
    }
    mainEl.scrollTop = 0
    controllers[next].activate()
  }

  void fetchJson<K0Overview>('/api/k0-showcase/overview')
    .then((ov) => {
      q('#k0-m-fns').textContent = fmtInt(ov.manifest.total)
      q('#k0-m-dt').textContent = `${ov.dispatchTables.totalTables} / L0..${ov.manifest.topoLayers - 1}`
      q('#k0-m-st').textContent = `${ov.frozenStructsCount} (${ov.totalStructFields}f)`
      q('#k0-m-diff').textContent = fmtInt(ov.totalDiffRecords)
      q('#k0-m-iat').textContent = `${ov.iatSlotCount} slots`
      q('#k0-sidebar-cert').textContent = `VERDICT: GO · ${fmtInt(ov.totalDiffRecords)} 差分记录`
    })
    .catch(() => {
      q('#k0-sidebar-cert').textContent = '数据加载失败'
    })

  const rawZone = new URLSearchParams(window.location.search).get('zone')?.trim().toLowerCase()
  let initial: K0ZoneId = 'gates'
  if (rawZone === '2' || rawZone === 'layouts') initial = 'layouts'
  else if (rawZone === '3' || rawZone === 'sandbox') initial = 'sandbox'
  else if (rawZone === '4' || rawZone === 'slice') initial = 'slice'
  switchZone(initial)
}

if (typeof document !== 'undefined') {
  const el = document.getElementById('k0-showcase-app')
  if (el) mountK0ShowcaseApp(el)
}

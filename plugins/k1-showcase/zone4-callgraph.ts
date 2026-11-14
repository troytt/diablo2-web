/**
 * Zone 4 — `D2Common.dll` `1,479 / 1,479 (100%)` Binary-Isomorphism Callgraph Explorer
 * (`plugins/k1-showcase/zone4-callgraph.ts`).
 */

import {
  SUBSYSTEM_COLORS,
  type CallgraphSubsystem,
  type ShowcaseCallgraphNode,
  type ShowcaseCallgraphResponse,
  type ShowcaseFunctionDetailResponse,
} from './types.ts'

export interface CallgraphZoneController {
  activate(): void
  deactivate(): void
}

interface GraphClickHitbox {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export function mountZone4Callgraph(container: HTMLElement): CallgraphZoneController {
  const doc = container.ownerDocument ?? document

  let cgData: ShowcaseCallgraphResponse | null = null
  let filteredFns: ShowcaseCallgraphNode[] = []
  let selectedDetail: ShowcaseFunctionDetailResponse | null = null
  const detailCache = new Map<string, ShowcaseFunctionDetailResponse>()

  let moduleFilter: 'D2Common' | 'D2Game' | 'all' = 'D2Common'
  let subsystemFilter: CallgraphSubsystem | 'all' = 'all'
  let statusFilter: 'all' | 'diff-verified' | 'ported' | 'unported' = 'all'
  let colorMode: 'subsystem' | 'tier' = 'subsystem'
  let searchQuery = ''
  let selectedKey = 'D2Common:0x6FD86230' // #10342 PATH_Compute default showcase root

  let heatmapCellCols = 60
  let heatmapCellW = 14
  let heatmapCellH = 9
  let neighborhoodHitboxes: GraphClickHitbox[] = []

  container.innerHTML = `
    <div class="k1-zone-stack">
      <div class="k1-toolbar">
        <div class="k1-btn-group" role="group" aria-label="Module">
          <button type="button" class="k1-btn k1-btn--active" data-cg-mod="D2Common" id="k1-cg-mod-d2c">
            D2Common.dll (1,479 / 1,479 = 100%)
          </button>
          <button type="button" class="k1-btn" data-cg-mod="D2Game" id="k1-cg-mod-d2g">
            D2Game.dll (3,331)
          </button>
          <button type="button" class="k1-btn" data-cg-mod="all">
            All (4,810)
          </button>
        </div>

        <label class="k1-field-inline">
          <span>Subsystem:</span>
          <select id="k1-cg-subsystem-select" class="k1-select">
            <option value="all">全部子系统 (All)</option>
          </select>
        </label>

        <label class="k1-field-inline">
          <span>Tier:</span>
          <select id="k1-cg-status-select" class="k1-select">
            <option value="all">全部层级</option>
            <option value="diff-verified">diff-verified (实机差分验证)</option>
            <option value="ported">ported (纯内核同构移植)</option>
            <option value="unported">unported (待移植)</option>
          </select>
        </label>

        <div class="k1-btn-group" role="group" aria-label="Heatmap Color">
          <button type="button" class="k1-btn k1-btn--active" data-cg-color="subsystem">按子系统着色</button>
          <button type="button" class="k1-btn" data-cg-color="tier">按验证等级着色</button>
        </div>

        <input
          id="k1-cg-search"
          type="search"
          class="k1-input"
          placeholder="搜索 VA (0x6FD86230) / 函数名 (PATH_Compute) / 文件..."
          style="min-width: 210px; flex: 1 1 180px"
        />
      </div>

      <div class="k1-kpi-strip">
        <div class="k1-kpi">
          <span class="k1-kpi__label">D2Common.dll 收官进度</span>
          <span class="k1-kpi__val k1-text--ok" id="k1-cg-kpi-d2c">1,479 / 1,479 (100.00%)</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">分层统计 (Diff-Verified / Ported / Unported)</span>
          <span class="k1-kpi__val k1-mono" id="k1-cg-kpi-tiers">1,476 / 3 / 0</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">PE 虚拟地址覆盖区间</span>
          <span class="k1-kpi__val k1-mono" id="k1-cg-kpi-va">0x6FD51000 .. 0x6FDD61A0</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">当前筛选命中 / 选中符号</span>
          <span class="k1-kpi__val k1-mono" id="k1-cg-kpi-sel">--</span>
        </div>
      </div>

      <div class="k1-split-panels k1-split-panels--heatmap">
        <div class="k1-canvas-card">
          <div class="k1-canvas-card__hdr">
            <span id="k1-cg-heatmap-title">PE Virtual Address Heatmap (0x6FD50000..0x6FDEFFFF · Linear VA Order)</span>
            <span class="k1-mono k1-muted" id="k1-cg-heatmap-hover">Click any VA block to inspect x86 vs TS</span>
          </div>
          <canvas id="k1-cg-heatmap-canvas" class="k1-canvas" width="600" height="240"></canvas>
          <div class="k1-legend-row" id="k1-cg-legend"></div>
        </div>

        <div class="k1-canvas-card">
          <div class="k1-canvas-card__hdr">
            <span>调用邻域拓扑图 (Callers → Target → Callees)</span>
            <span class="k1-mono k1-muted" id="k1-cg-graph-meta">Click neighbor node to jump</span>
          </div>
          <canvas id="k1-cg-graph-canvas" class="k1-canvas" width="380" height="240"></canvas>
        </div>
      </div>

      <!-- 3-Column Binary-Isomorphism Comparison Drawer -->
      <div class="k1-panel">
        <div class="k1-panel__hdr">
          <h3 class="k1-panel__title" id="k1-cg-drawer-title">
            三栏二进制同构对照抽屉 (1.13c x86 Intel Disassembly | src/d2kern-113c TypeScript | Oracle Diff & Callgraph)
          </h3>
          <span class="k1-badge k1-badge--ok" id="k1-cg-drawer-badge">diff-verified</span>
        </div>

        <div class="k1-drawer-3col">
          <div class="k1-drawer-col">
            <div class="k1-drawer-col__hdr">
              <span>1. 1.13c x86 Intel 机器码反汇编 (objdump)</span>
              <span class="k1-mono k1-muted" id="k1-cg-asm-meta">--</span>
            </div>
            <pre class="k1-code-pre k1-mono" id="k1-cg-asm-pre">Loading disassembly...</pre>
          </div>

          <div class="k1-drawer-col">
            <div class="k1-drawer-col__hdr">
              <span>2. src/d2kern-113c 纯函数同构源码</span>
              <span class="k1-mono k1-muted" id="k1-cg-ts-meta">--</span>
            </div>
            <pre class="k1-code-pre k1-mono" id="k1-cg-ts-pre">Loading TypeScript port...</pre>
          </div>

          <div class="k1-drawer-col">
            <div class="k1-drawer-col__hdr">
              <span>3. Oracle 差分实证 & 上下游调用链</span>
              <span class="k1-mono k1-muted" id="k1-cg-ev-meta">--</span>
            </div>
            <div class="k1-evidence-box" id="k1-cg-ev-box"></div>
          </div>
        </div>
      </div>
    </div>
  `

  const modBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-cg-mod]')]
  const colorBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-cg-color]')]
  const subSelect = container.querySelector('#k1-cg-subsystem-select') as HTMLSelectElement
  const statusSelect = container.querySelector('#k1-cg-status-select') as HTMLSelectElement
  const searchInput = container.querySelector('#k1-cg-search') as HTMLInputElement
  const kpiD2c = container.querySelector('#k1-cg-kpi-d2c') as HTMLElement
  const kpiTiers = container.querySelector('#k1-cg-kpi-tiers') as HTMLElement
  const kpiVa = container.querySelector('#k1-cg-kpi-va') as HTMLElement
  const kpiSel = container.querySelector('#k1-cg-kpi-sel') as HTMLElement
  const heatmapTitle = container.querySelector('#k1-cg-heatmap-title') as HTMLElement
  const heatmapHover = container.querySelector('#k1-cg-heatmap-hover') as HTMLElement
  const heatmapCanvas = container.querySelector('#k1-cg-heatmap-canvas') as HTMLCanvasElement
  const legendEl = container.querySelector('#k1-cg-legend') as HTMLElement
  const graphMeta = container.querySelector('#k1-cg-graph-meta') as HTMLElement
  const graphCanvas = container.querySelector('#k1-cg-graph-canvas') as HTMLCanvasElement
  const drawerTitle = container.querySelector('#k1-cg-drawer-title') as HTMLElement
  const drawerBadge = container.querySelector('#k1-cg-drawer-badge') as HTMLElement
  const asmMeta = container.querySelector('#k1-cg-asm-meta') as HTMLElement
  const asmPre = container.querySelector('#k1-cg-asm-pre') as HTMLElement
  const tsMeta = container.querySelector('#k1-cg-ts-meta') as HTMLElement
  const tsPre = container.querySelector('#k1-cg-ts-pre') as HTMLElement
  const evMeta = container.querySelector('#k1-cg-ev-meta') as HTMLElement
  const evBox = container.querySelector('#k1-cg-ev-box') as HTMLElement

  function nodeColor(fn: ShowcaseCallgraphNode): string {
    if (colorMode === 'tier') {
      if (fn.status === 'diff-verified') return '#38d9a9'
      if (fn.status === 'ported') return '#ebd594'
      return '#495057'
    }
    return SUBSYSTEM_COLORS[fn.subsystem] ?? '#938873'
  }

  function renderLegend(): void {
    legendEl.textContent = ''
    if (colorMode === 'tier') {
      const items: ReadonlyArray<[string, string]> = [
        ['diff-verified (实机差分验证)', '#38d9a9'],
        ['ported (同构移植)', '#ebd594'],
        ['unported (待移植)', '#495057'],
      ]
      for (const [lbl, col] of items) {
        const chip = doc.createElement('span')
        chip.className = 'k1-legend-chip'
        chip.innerHTML = `<i style="background:${col}"></i>${lbl}`
        legendEl.appendChild(chip)
      }
      return
    }
    const mainSubs: readonly CallgraphSubsystem[] = [
      'drlg',
      'path',
      'collision',
      'statlist',
      'unit',
      'items',
      'missile',
      'datatbls',
      'skills',
      'monsters',
      'inventory',
      'prng',
    ]
    for (const s of mainSubs) {
      const chip = doc.createElement('span')
      chip.className = 'k1-legend-chip'
      chip.innerHTML = `<i style="background:${SUBSYSTEM_COLORS[s]}"></i>${s}`
      legendEl.appendChild(chip)
    }
  }

  function applyFiltersAndRenderHeatmap(): void {
    if (!cgData) return
    const q = searchQuery.trim().toLowerCase()
    filteredFns = cgData.functions.filter((f) => {
      if (moduleFilter !== 'all' && f.module !== moduleFilter) return false
      if (subsystemFilter !== 'all' && f.subsystem !== subsystemFilter) return false
      if (statusFilter !== 'all' && f.status !== statusFilter) return false
      if (!q) return true
      return (
        f.va.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        (f.tsSymbol ?? '').toLowerCase().includes(q) ||
        (f.kernFile ?? '').toLowerCase().includes(q)
      )
    })

    const d2c = cgData.summary.d2Common
    kpiD2c.textContent = `${d2c.diffVerified + d2c.ported} / ${d2c.total} (${d2c.completionPct.toFixed(2)}%)`
    const activeStats =
      moduleFilter === 'D2Common'
        ? cgData.summary.d2Common
        : moduleFilter === 'D2Game'
          ? cgData.summary.d2Game
          : {
              diffVerified: cgData.summary.d2Common.diffVerified + cgData.summary.d2Game.diffVerified,
              ported: cgData.summary.d2Common.ported + cgData.summary.d2Game.ported,
              unported: cgData.summary.d2Common.unported + cgData.summary.d2Game.unported,
              minVa: cgData.summary.d2Game.minVa,
              maxVa: cgData.summary.d2Common.maxVa,
            }
    kpiTiers.textContent = `${activeStats.diffVerified} diff-verified · ${activeStats.ported} ported · ${activeStats.unported} unported`
    kpiVa.textContent = `${activeStats.minVa} .. ${activeStats.maxVa}`
    kpiSel.textContent = `${filteredFns.length} matched · ${selectedKey}`
    heatmapTitle.textContent =
      moduleFilter === 'D2Common'
        ? `D2Common.dll PE Virtual Address Heatmap (0x6FD50000..0x6FDEFFFF · ${filteredFns.length} fns)`
        : `${moduleFilter} PE Virtual Address Heatmap (${filteredFns.length} fns)`

    const ctx = heatmapCanvas.getContext('2d')
    if (!ctx) return
    const cw = heatmapCanvas.width
    const ch = heatmapCanvas.height
    ctx.fillStyle = '#070605'
    ctx.fillRect(0, 0, cw, ch)

    const n = Math.max(1, filteredFns.length)
    // Choose grid columns so all filtered functions pack cleanly inside the canvas without clipping
    heatmapCellCols = Math.max(16, Math.ceil(Math.sqrt((n * cw) / ch)))
    const rows = Math.max(1, Math.ceil(n / heatmapCellCols))
    heatmapCellW = cw / heatmapCellCols
    heatmapCellH = ch / rows

    for (let i = 0; i < filteredFns.length; i++) {
      const fn = filteredFns[i]!
      const col = i % heatmapCellCols
      const row = Math.floor(i / heatmapCellCols)
      const x = col * heatmapCellW
      const y = row * heatmapCellH
      ctx.fillStyle = nodeColor(fn)
      ctx.globalAlpha = fn.status === 'unported' ? 0.32 : 0.92
      ctx.fillRect(
        x + 0.5,
        y + 0.5,
        Math.max(1, heatmapCellW - 1),
        Math.max(1, heatmapCellH - 1),
      )

      if (fn.key === selectedKey) {
        ctx.globalAlpha = 1
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(2, heatmapCellW - 1), Math.max(2, heatmapCellH - 1))
      }
    }
    ctx.globalAlpha = 1
    renderLegend()
  }

  function renderNeighborhoodGraph(detail: ShowcaseFunctionDetailResponse): void {
    const ctx = graphCanvas.getContext('2d')
    if (!ctx) return
    const cw = graphCanvas.width
    const ch = graphCanvas.height
    ctx.fillStyle = '#070605'
    ctx.fillRect(0, 0, cw, ch)
    neighborhoodHitboxes = []

    const callers = detail.callers.slice(0, 7)
    const callees = detail.callees.slice(0, 7)
    graphMeta.textContent = `${detail.callers.length} callers · ${detail.callees.length} callees`

    const centerX = cw * 0.5
    const centerY = ch * 0.5
    const boxW = 112
    const boxH = 24

    const drawNodeBox = (
      fn: ShowcaseCallgraphNode,
      cx: number,
      cy: number,
      isCenter: boolean,
    ): void => {
      const x = cx - boxW * 0.5
      const y = cy - boxH * 0.5
      ctx.fillStyle = isCenter ? '#282012' : '#13100c'
      ctx.fillRect(x, y, boxW, boxH)
      ctx.strokeStyle = isCenter ? '#ebd594' : SUBSYSTEM_COLORS[fn.subsystem]
      ctx.lineWidth = isCenter ? 2 : 1.2
      ctx.strokeRect(x, y, boxW, boxH)

      ctx.fillStyle = isCenter ? '#ebd594' : '#d9d0be'
      ctx.font = isCenter ? 'bold 9.5px monospace' : '9px monospace'
      const shortName = fn.name.length > 15 ? `${fn.name.slice(0, 14)}…` : fn.name
      ctx.fillText(shortName, x + 5, y + 11)
      ctx.fillStyle = '#938873'
      ctx.font = '8.5px monospace'
      ctx.fillText(fn.va, x + 5, y + 20)

      neighborhoodHitboxes.push({ key: fn.key, x, y, w: boxW, h: boxH })
    }

    // Inbound caller edges (left -> center)
    callers.forEach((caller, idx) => {
      const ny = ((idx + 1) / (callers.length + 1)) * ch
      const nx = 62
      ctx.beginPath()
      ctx.moveTo(nx + boxW * 0.5, ny)
      ctx.bezierCurveTo(cw * 0.34, ny, cw * 0.34, centerY, centerX - boxW * 0.5, centerY)
      ctx.strokeStyle = 'rgba(116, 192, 252, 0.45)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      drawNodeBox(caller, nx, ny, false)
    })

    // Outbound callee edges (center -> right)
    callees.forEach((callee, idx) => {
      const ny = ((idx + 1) / (callees.length + 1)) * ch
      const nx = cw - 62
      ctx.beginPath()
      ctx.moveTo(centerX + boxW * 0.5, centerY)
      ctx.bezierCurveTo(cw * 0.66, centerY, cw * 0.66, ny, nx - boxW * 0.5, ny)
      ctx.strokeStyle = 'rgba(56, 217, 169, 0.48)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      drawNodeBox(callee, nx, ny, false)
    })

    drawNodeBox(detail.fn, centerX, centerY, true)
  }

  function renderDrawer(detail: ShowcaseFunctionDetailResponse): void {
    const { fn } = detail
    drawerTitle.textContent = `${fn.module} ${fn.va} · ${fn.name} (${fn.size}B · topo L${fn.topoLevel} · ${fn.subsystem})`
    drawerBadge.className =
      fn.status === 'diff-verified'
        ? 'k1-badge k1-badge--ok'
        : fn.status === 'ported'
          ? 'k1-badge'
          : 'k1-badge k1-badge--warn'
    drawerBadge.textContent = fn.status

    asmMeta.textContent = `${detail.disassembly.binaryName} · ${detail.disassembly.instructionCount} insns`
    asmPre.textContent = detail.disassembly.text || '; (No instructions in range)'

    if (detail.tsSource.code) {
      tsMeta.textContent = `${detail.tsSource.kernFile ?? ''}:L${detail.tsSource.startLine ?? 1}..L${detail.tsSource.endLine ?? 1}`
      tsPre.textContent = detail.tsSource.code
    } else {
      tsMeta.textContent = fn.kernFile ?? 'unported'
      tsPre.textContent = detail.tsReference
        ? `// Symbol reference: ${detail.tsReference}`
        : '// Not yet ported to src/d2kern-113c'
    }

    evMeta.textContent = `SCC #${fn.sccId} · ${detail.callers.length} in / ${detail.callees.length} out`
    evBox.textContent = ''

    const addSection = (label: string, bodyText: string): void => {
      const sec = doc.createElement('div')
      sec.className = 'k1-ev-sec'
      const h = doc.createElement('div')
      h.className = 'k1-ev-sec__lbl'
      h.textContent = label
      const p = doc.createElement('div')
      p.className = 'k1-ev-sec__val k1-mono'
      p.textContent = bodyText
      sec.appendChild(h)
      sec.appendChild(p)
      evBox.appendChild(sec)
    }

    addSection(
      'Differential Verification Evidence (Oracle 差分证据)',
      detail.diffEvidence ?? (fn.status === 'ported' ? 'Ported in src/d2kern-113c (pure kernel closure)' : 'Unported'),
    )
    addSection(
      'Kernel Module & Symbol',
      `${fn.tsSymbol ?? '(none)'} @ ${fn.kernFile ?? '(none)'}`,
    )
    if (detail.externalDeps.length > 0) {
      addSection('External IAT Imports (Fog / Storm / D2CMP)', detail.externalDeps.join(', '))
    }

    const addChipList = (title: string, nodes: readonly ShowcaseCallgraphNode[]): void => {
      const sec = doc.createElement('div')
      sec.className = 'k1-ev-sec'
      const h = doc.createElement('div')
      h.className = 'k1-ev-sec__lbl'
      h.textContent = `${title} (${nodes.length})`
      sec.appendChild(h)

      const wrap = doc.createElement('div')
      wrap.className = 'k1-chip-wrap'
      if (nodes.length === 0) {
        const empty = doc.createElement('span')
        empty.className = 'k1-muted'
        empty.textContent = 'None (Leaf / Root)'
        wrap.appendChild(empty)
      } else {
        for (const n of nodes.slice(0, 24)) {
          const btn = doc.createElement('button')
          btn.type = 'button'
          btn.className = 'k1-fn-chip k1-mono'
          btn.textContent = `${n.va} ${n.name}`
          btn.addEventListener('click', () => {
            void selectFunctionByKey(n.key)
          })
          wrap.appendChild(btn)
        }
      }
      sec.appendChild(wrap)
      evBox.appendChild(sec)
    }

    addChipList('Inbound Callers (上游调用方)', detail.callers)
    addChipList('Outbound Callees (下游被调方)', detail.callees)
  }

  async function selectFunctionByKey(key: string): Promise<void> {
    selectedKey = key
    applyFiltersAndRenderHeatmap()

    const cached = detailCache.get(key)
    if (cached) {
      selectedDetail = cached
      renderNeighborhoodGraph(cached)
      renderDrawer(cached)
      return
    }

    const [mod, va] = key.split(':', 2)
    const resp = await fetch(
      `/api/k1-showcase/fn-detail?module=${encodeURIComponent(mod ?? 'D2Common')}&va=${encodeURIComponent(va ?? key)}`,
    )
    if (!resp.ok) return
    const detail = (await resp.json()) as ShowcaseFunctionDetailResponse
    detailCache.set(key, detail)
    selectedDetail = detail
    renderNeighborhoodGraph(detail)
    renderDrawer(detail)
  }

  async function ensureLoaded(): Promise<void> {
    if (cgData) {
      applyFiltersAndRenderHeatmap()
      if (selectedDetail) {
        renderNeighborhoodGraph(selectedDetail)
        renderDrawer(selectedDetail)
      }
      return
    }

    const resp = await fetch('/api/k1-showcase/callgraph')
    if (!resp.ok) throw new Error(`Callgraph load failed: HTTP ${resp.status}`)
    cgData = (await resp.json()) as ShowcaseCallgraphResponse

    subSelect.textContent = ''
    const allSubOpt = doc.createElement('option')
    allSubOpt.value = 'all'
    allSubOpt.textContent = '全部子系统 (All Subsystems)'
    subSelect.appendChild(allSubOpt)
    for (const s of cgData.subsystems) {
      if (s.d2CommonCount + s.d2GameCount === 0) continue
      const opt = doc.createElement('option')
      opt.value = s.subsystem
      opt.textContent = `${s.subsystem} (D2Common: ${s.d2CommonCount}, D2Game: ${s.d2GameCount})`
      subSelect.appendChild(opt)
    }

    applyFiltersAndRenderHeatmap()
    await selectFunctionByKey(selectedKey)
  }

  for (const btn of modBtns) {
    btn.addEventListener('click', () => {
      const m = btn.dataset.cgMod
      moduleFilter = m === 'D2Game' ? 'D2Game' : m === 'all' ? 'all' : 'D2Common'
      for (const b of modBtns) b.classList.toggle('k1-btn--active', b === btn)
      applyFiltersAndRenderHeatmap()
      if (filteredFns.length > 0 && !filteredFns.some((f) => f.key === selectedKey)) {
        void selectFunctionByKey(filteredFns[0]!.key)
      }
    })
  }

  for (const btn of colorBtns) {
    btn.addEventListener('click', () => {
      colorMode = btn.dataset.cgColor === 'tier' ? 'tier' : 'subsystem'
      for (const b of colorBtns) b.classList.toggle('k1-btn--active', b === btn)
      applyFiltersAndRenderHeatmap()
    })
  }

  subSelect.addEventListener('change', () => {
    const v = subSelect.value
    subsystemFilter = v === 'all' ? 'all' : (v as CallgraphSubsystem)
    applyFiltersAndRenderHeatmap()
    if (filteredFns.length > 0 && !filteredFns.some((f) => f.key === selectedKey)) {
      void selectFunctionByKey(filteredFns[0]!.key)
    }
  })

  statusSelect.addEventListener('change', () => {
    const v = statusSelect.value
    statusFilter =
      v === 'diff-verified' || v === 'ported' || v === 'unported' ? v : 'all'
    applyFiltersAndRenderHeatmap()
    if (filteredFns.length > 0 && !filteredFns.some((f) => f.key === selectedKey)) {
      void selectFunctionByKey(filteredFns[0]!.key)
    }
  })

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value
    applyFiltersAndRenderHeatmap()
  })

  heatmapCanvas.addEventListener('pointermove', (ev) => {
    if (filteredFns.length === 0) return
    const rect = heatmapCanvas.getBoundingClientRect()
    const cx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * heatmapCanvas.width
    const cy = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * heatmapCanvas.height
    const col = Math.floor(cx / heatmapCellW)
    const row = Math.floor(cy / heatmapCellH)
    const idx = row * heatmapCellCols + col
    const fn = filteredFns[idx]
    if (fn) {
      heatmapHover.textContent = `${fn.module} ${fn.va} · ${fn.name} (${fn.size}B · ${fn.subsystem} · ${fn.status})`
    }
  })

  heatmapCanvas.addEventListener('click', (ev) => {
    if (filteredFns.length === 0) return
    const rect = heatmapCanvas.getBoundingClientRect()
    const cx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * heatmapCanvas.width
    const cy = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * heatmapCanvas.height
    const col = Math.floor(cx / heatmapCellW)
    const row = Math.floor(cy / heatmapCellH)
    const idx = row * heatmapCellCols + col
    const fn = filteredFns[idx]
    if (fn) {
      void selectFunctionByKey(fn.key)
    }
  })

  graphCanvas.addEventListener('click', (ev) => {
    const rect = graphCanvas.getBoundingClientRect()
    const cx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * graphCanvas.width
    const cy = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * graphCanvas.height
    for (const hb of neighborhoodHitboxes) {
      if (cx >= hb.x && cx <= hb.x + hb.w && cy >= hb.y && cy <= hb.y + hb.h) {
        if (hb.key !== selectedKey) {
          void selectFunctionByKey(hb.key)
        }
        break
      }
    }
  })

  return {
    activate(): void {
      void ensureLoaded()
    },
    deactivate(): void {
      // No active RAF timers to cancel
    },
  }
}

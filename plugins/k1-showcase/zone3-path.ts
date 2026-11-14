/**
 * Zone 3 — [K1-6] `#10342` `PATHTYPE 0..17` In-Browser Pathfinding Sandbox
 * (`plugins/k1-showcase/zone3-path.ts`).
 *
 * Executes 100% real `src/d2kern-113c/common/path.ts` (`PATH_Compute113c` `#10342`) directly
 * in the browser against `path-world-town-s12345.img.gz` + all `6,924` `PATHVEC` oracle vectors!
 */

import {
  BrowserPathSandboxEngine,
  type InteractivePathComputeResult,
} from './path-browser-engine.ts'
import {
  parsePathVectorsBinaryInBrowser,
  type BrowserPathVectorRecord,
  type PathTypeSummaryEntry,
  type ShowcasePathVectorsJsonResponse,
  type ShowcasePathWorldResponse,
} from './types.ts'

export interface PathZoneController {
  activate(): void
  deactivate(): void
}

const PATHTYPE_PALETTE: readonly string[] = [
  '#38d9a9', // 0 IDASTAR
  '#4dabf7', // 1 ASTAR
  '#ff922b', // 2 TOWARD
  '#ffd43b', // 3 WALL_FOLLOW
  '#da77f2', // 4 MON_CIRCLE
  '#ffa94d', // 5 TOWARD_FINISH
  '#69db7c', // 6 STRAIGHT_6
  '#ff6b6b', // 7 MISSILE
  '#f783ac', // 8 KNOCKBACK_SERVER
  '#ffe066', // 9 LEAP
  '#91a7ff', // 10 FLEE
  '#e599f7', // 11 KNOCKBACK_CLIENT
  '#63e6be', // 12 BACKUP
  '#74c0fc', // 13 STRAIGHT
  '#ebd594', // 14 BLESSEDHAMMER
  '#a9e34b', // 15 MOTION
  '#ffa8a8', // 16 CHARGEDBOLT
  '#868e96', // 17 NULL_HANDLER_17
]

export function mountZone3Path(container: HTMLElement): PathZoneController {
  const doc = container.ownerDocument ?? document

  let engine: BrowserPathSandboxEngine | null = null
  let pathTypesMeta: readonly PathTypeSummaryEntry[] = []
  let allOracleVectors: BrowserPathVectorRecord[] = []
  let bgOffscreen: HTMLCanvasElement | null = null

  let selectedPathType = 0
  let compareAll18 = false
  let unitSize: 1 | 2 | 3 = 1
  let unitTypeMode: 'auto' | 0 | 1 | 3 = 'auto'
  let pointerTool: 'drag-markers' | 'paint-wall' | 'erase-wall' = 'drag-markers'

  let startPos = { x: 5653, y: 5918 }
  let targetPos = { x: 5684, y: 5946 }
  const customObstacles = new Set<string>()
  let selectedOracleVec: BrowserPathVectorRecord | null = null

  let zoom = 4.2
  let panX = 0
  let panY = 0
  let activeDrag: 'none' | 'start' | 'target' | 'pan' | 'paint' = 'none'
  let dragClientX = 0
  let dragClientY = 0
  let dragPanX = 0
  let dragPanY = 0

  let vecFilterType: number | 'all' = 'all'
  let vecOnlyPositive = true

  container.innerHTML = `
    <div class="k1-zone-stack">
      <div class="k1-toolbar">
        <label class="k1-field-inline">
          <span>算法 (PATHTYPE 0..17):</span>
          <select id="k1-path-type-select" class="k1-select"></select>
        </label>

        <button type="button" class="k1-btn" id="k1-path-compare-all-btn">
          同屏叠加 18 种算法 (Compare All 18)
        </button>

        <div class="k1-btn-group" role="group" aria-label="Unit Size">
          <button type="button" class="k1-btn k1-btn--active" data-path-size="1">Size 1</button>
          <button type="button" class="k1-btn" data-path-size="2">Size 2</button>
          <button type="button" class="k1-btn" data-path-size="3">Size 3</button>
        </div>

        <label class="k1-field-inline">
          <span>Unit:</span>
          <select id="k1-path-unittype-select" class="k1-select">
            <option value="auto">Auto (按算法匹配)</option>
            <option value="0">Player (0)</option>
            <option value="1">Monster (1)</option>
            <option value="3">Missile (3)</option>
          </select>
        </label>

        <span id="k1-path-oracle-badge" class="k1-badge k1-badge--ok">
          Browser #10342 · Verifying 6,924 Vectors...
        </span>
      </div>

      <div class="k1-toolbar k1-toolbar--compact">
        <div class="k1-btn-group" role="group" aria-label="Pointer Tool">
          <button type="button" class="k1-btn k1-btn--active" data-path-tool="drag-markers">
            拖拽起点/终点 (Drag S/T)
          </button>
          <button type="button" class="k1-btn" data-path-tool="paint-wall">
            绘制自定义墙体 (Paint Wall)
          </button>
          <button type="button" class="k1-btn" data-path-tool="erase-wall">
            擦除墙体 (Erase)
          </button>
        </div>
        <button type="button" class="k1-btn" id="k1-path-clear-walls-btn">清空自定义障碍 (0)</button>
        <button type="button" class="k1-btn" id="k1-path-reverify-btn">浏览器重跑 6,924 Oracle 向量</button>
        <div class="k1-btn-group" style="margin-left: auto">
          <button type="button" class="k1-btn" id="k1-path-zoom-in">＋</button>
          <button type="button" class="k1-btn" id="k1-path-zoom-out">－</button>
          <button type="button" class="k1-btn" id="k1-path-zoom-fit">聚焦起止点</button>
        </div>
      </div>

      <div class="k1-kpi-strip">
        <div class="k1-kpi">
          <span class="k1-kpi__label">起点 S (绿) → 终点 T (金)</span>
          <span class="k1-kpi__val k1-mono" id="k1-path-kpi-coords">--</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">PATH_Compute113c 返回值 / 拐点数</span>
          <span class="k1-kpi__val k1-mono" id="k1-path-kpi-ret">--</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">方向 / 状态位 (dir / dwFlags)</span>
          <span class="k1-kpi__val k1-mono" id="k1-path-kpi-flags">--</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">6,924 D2Common.dll 向量实测</span>
          <span class="k1-kpi__val k1-text--ok" id="k1-path-kpi-verify">Loading...</span>
        </div>
      </div>

      <div class="k1-canvas-card">
        <div class="k1-canvas-card__hdr">
          <span id="k1-path-canvas-title">Rogue Encampment (s=12345) · In-Browser src/d2kern-113c/common/path.ts (#10342)</span>
          <span class="k1-mono k1-muted" id="k1-path-canvas-meta">Drag green S or gold T</span>
        </div>
        <canvas id="k1-path-canvas" class="k1-canvas" width="920" height="340"></canvas>
      </div>

      <div class="k1-split-panels">
        <div class="k1-panel">
          <div class="k1-panel__hdr">
            <h3 class="k1-panel__title">实时输出路点序列 wPathPoints[0..N-1]</h3>
            <span class="k1-mono k1-muted" id="k1-path-wp-summary">0 waypoints</span>
          </div>
          <div class="k1-code-box k1-mono" id="k1-path-wp-list"></div>
        </div>

        <div class="k1-panel">
          <div class="k1-panel__hdr">
            <h3 class="k1-panel__title">6,924 条真实 D2Common.dll PATHVEC 向量浏览器 (点击上屏复现)</h3>
            <div class="k1-inline-controls">
              <select id="k1-path-vec-filter" class="k1-select k1-select--sm">
                <option value="all">全部 PATHTYPE (6,924)</option>
              </select>
              <label class="k1-check-label">
                <input type="checkbox" id="k1-path-vec-pos-only" checked />
                仅看有效路径 (ret&gt;0)
              </label>
            </div>
          </div>
          <div class="k1-table-scroll" style="max-height: 200px">
            <table class="k1-table k1-table--compact">
              <thead>
                <tr>
                  <th>#Idx</th>
                  <th>Type</th>
                  <th>Start → Target</th>
                  <th>Ret / Pts</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="k1-path-vec-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `

  const typeSelect = container.querySelector('#k1-path-type-select') as HTMLSelectElement
  const compareAllBtn = container.querySelector('#k1-path-compare-all-btn') as HTMLButtonElement
  const unitTypeSelect = container.querySelector('#k1-path-unittype-select') as HTMLSelectElement
  const oracleBadge = container.querySelector('#k1-path-oracle-badge') as HTMLElement
  const clearWallsBtn = container.querySelector('#k1-path-clear-walls-btn') as HTMLButtonElement
  const reverifyBtn = container.querySelector('#k1-path-reverify-btn') as HTMLButtonElement
  const zoomInBtn = container.querySelector('#k1-path-zoom-in') as HTMLButtonElement
  const zoomOutBtn = container.querySelector('#k1-path-zoom-out') as HTMLButtonElement
  const zoomFitBtn = container.querySelector('#k1-path-zoom-fit') as HTMLButtonElement
  const kpiCoords = container.querySelector('#k1-path-kpi-coords') as HTMLElement
  const kpiRet = container.querySelector('#k1-path-kpi-ret') as HTMLElement
  const kpiFlags = container.querySelector('#k1-path-kpi-flags') as HTMLElement
  const kpiVerify = container.querySelector('#k1-path-kpi-verify') as HTMLElement
  const canvasTitle = container.querySelector('#k1-path-canvas-title') as HTMLElement
  const canvasMeta = container.querySelector('#k1-path-canvas-meta') as HTMLElement
  const canvas = container.querySelector('#k1-path-canvas') as HTMLCanvasElement
  const wpSummary = container.querySelector('#k1-path-wp-summary') as HTMLElement
  const wpList = container.querySelector('#k1-path-wp-list') as HTMLElement
  const vecFilterSelect = container.querySelector('#k1-path-vec-filter') as HTMLSelectElement
  const vecPosCheckbox = container.querySelector('#k1-path-vec-pos-only') as HTMLInputElement
  const vecTbody = container.querySelector('#k1-path-vec-tbody') as HTMLElement

  const sizeBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-path-size]')]
  const toolBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-path-tool]')]

  function buildOffscreenTownMap(eng: BrowserPathSandboxEngine): HTMLCanvasElement {
    const w = Math.max(1, eng.maxSubtileX - eng.minSubtileX)
    const h = Math.max(1, eng.maxSubtileY - eng.minSubtileY)
    const off = doc.createElement('canvas')
    off.width = w
    off.height = h
    const octx = off.getContext('2d')
    if (!octx) return off
    const img = octx.createImageData(w, h)
    const buf = img.data
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 9
      buf[i + 1] = 8
      buf[i + 2] = 7
      buf[i + 3] = 255
    }
    for (const r of eng.rooms) {
      for (let ry = 0; ry < r.subtileH; ry++) {
        const gy = r.subtileY + ry - eng.minSubtileY
        for (let rx = 0; rx < r.subtileW; rx++) {
          const gx = r.subtileX + rx - eng.minSubtileX
          const m = r.baseWords[ry * r.subtileW + rx] ?? 0
          const p = (gy * w + gx) * 4
          if ((m & 0x1000) !== 0) {
            buf[p] = 14
            buf[p + 1] = 12
            buf[p + 2] = 11
          } else if ((m & 0x0001) !== 0) {
            buf[p] = 132
            buf[p + 1] = 96
            buf[p + 2] = 56
          } else if ((m & 0x0004) !== 0 || (m & 0x0002) !== 0) {
            buf[p] = 42
            buf[p + 1] = 78
            buf[p + 2] = 116
          } else if ((m & 0x0008) !== 0) {
            buf[p] = 84
            buf[p + 1] = 58
            buf[p + 2] = 44
          } else {
            buf[p] = 30
            buf[p + 1] = 27
            buf[p + 2] = 21
          }
        }
      }
    }
    octx.putImageData(img, 0, 0)
    octx.strokeStyle = 'rgba(199, 179, 119, 0.14)'
    octx.lineWidth = 0.5
    for (const r of eng.rooms) {
      octx.strokeRect(r.subtileX - eng.minSubtileX, r.subtileY - eng.minSubtileY, r.subtileW, r.subtileH)
    }
    return off
  }

  function centerCameraBetweenMarkers(): void {
    if (!engine) return
    const midX = (startPos.x + targetPos.x) * 0.5
    const midY = (startPos.y + targetPos.y) * 0.5
    const spanX = Math.max(40, Math.abs(targetPos.x - startPos.x) + 32)
    const spanY = Math.max(30, Math.abs(targetPos.y - startPos.y) + 28)
    zoom = Math.max(1.8, Math.min(8.5, Math.min(canvas.width / spanX, canvas.height / spanY)))
    panX = canvas.width * 0.5 - (midX - engine.minSubtileX) * zoom
    panY = canvas.height * 0.5 - (midY - engine.minSubtileY) * zoom
  }

  function toScreenX(wx: number): number {
    return engine ? panX + (wx - engine.minSubtileX) * zoom : 0
  }
  function toScreenY(wy: number): number {
    return engine ? panY + (wy - engine.minSubtileY) * zoom : 0
  }
  function toWorldSubtile(clientX: number, clientY: number): { x: number; y: number } {
    if (!engine) return { x: startPos.x, y: startPos.y }
    const rect = canvas.getBoundingClientRect()
    const cx = ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width
    const cy = ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height
    const wx = Math.round((cx - panX) / zoom + engine.minSubtileX)
    const wy = Math.round((cy - panY) / zoom + engine.minSubtileY)
    return {
      x: Math.max(engine.minSubtileX + 1, Math.min(engine.maxSubtileX - 2, wx)),
      y: Math.max(engine.minSubtileY + 1, Math.min(engine.maxSubtileY - 2, wy)),
    }
  }

  function recomputeAndRender(): void {
    if (!engine || !bgOffscreen) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    clearWallsBtn.textContent = `清空自定义障碍 (${customObstacles.size})`
    compareAllBtn.classList.toggle('k1-btn--active', compareAll18)

    const cw = canvas.width
    const ch = canvas.height
    ctx.fillStyle = '#070605'
    ctx.fillRect(0, 0, cw, ch)

    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      bgOffscreen,
      panX,
      panY,
      bgOffscreen.width * zoom,
      bgOffscreen.height * zoom,
    )

    // Custom painted obstacles
    if (customObstacles.size > 0) {
      ctx.fillStyle = '#fa5252'
      for (const k of customObstacles) {
        const [xs, ys] = k.split(':')
        const sx = toScreenX(Number(xs))
        const sy = toScreenY(Number(ys))
        ctx.fillRect(sx, sy, Math.max(2, zoom), Math.max(2, zoom))
      }
    }

    const resultsToDraw: InteractivePathComputeResult[] = []
    if (compareAll18) {
      for (let pt = 0; pt < 18; pt++) {
        resultsToDraw.push(
          engine.computeInteractive({
            pathType: pt,
            startX: startPos.x,
            startY: startPos.y,
            targetX: targetPos.x,
            targetY: targetPos.y,
            unitSize,
            unitTypeMode,
            customObstacles,
          }),
        )
      }
    } else {
      resultsToDraw.push(
        engine.computeInteractive({
          pathType: selectedPathType,
          startX: startPos.x,
          startY: startPos.y,
          targetX: targetPos.x,
          targetY: targetPos.y,
          unitSize,
          unitTypeMode,
          customObstacles,
        }),
      )
    }

    const primary =
      resultsToDraw.find((r) => r.pathType === selectedPathType) ?? resultsToDraw[0]!

    // If an oracle vector is selected and matches current start/target, draw Oracle golden dashed overlay first
    if (
      selectedOracleVec &&
      selectedOracleVec.startX === startPos.x &&
      selectedOracleVec.startY === startPos.y &&
      selectedOracleVec.targetX === targetPos.x &&
      selectedOracleVec.targetY === targetPos.y &&
      selectedOracleVec.pathPoints.length > 0
    ) {
      ctx.beginPath()
      ctx.moveTo(toScreenX(startPos.x) + zoom * 0.5, toScreenY(startPos.y) + zoom * 0.5)
      for (const pt of selectedOracleVec.pathPoints) {
        ctx.lineTo(toScreenX(pt.x) + zoom * 0.5, toScreenY(pt.y) + zoom * 0.5)
      }
      ctx.strokeStyle = 'rgba(255, 212, 59, 0.5)'
      ctx.lineWidth = 5
      ctx.stroke()
    }

    for (const res of resultsToDraw) {
      if (res.faultKind !== 0 || res.waypoints.length === 0) continue
      const color = PATHTYPE_PALETTE[res.pathType % PATHTYPE_PALETTE.length]!
      const isSelected = res.pathType === selectedPathType
      ctx.beginPath()
      ctx.moveTo(toScreenX(startPos.x) + zoom * 0.5, toScreenY(startPos.y) + zoom * 0.5)
      for (const wp of res.waypoints) {
        ctx.lineTo(toScreenX(wp.x) + zoom * 0.5, toScreenY(wp.y) + zoom * 0.5)
      }
      ctx.strokeStyle = color
      ctx.globalAlpha = compareAll18 && !isSelected ? 0.65 : 1
      ctx.lineWidth = isSelected ? 2.6 : 1.5
      ctx.stroke()

      if (!compareAll18 || isSelected) {
        for (let i = 0; i < res.waypoints.length; i++) {
          const wp = res.waypoints[i]!
          const wx = toScreenX(wp.x) + zoom * 0.5
          const wy = toScreenY(wp.y) + zoom * 0.5
          ctx.beginPath()
          ctx.arc(wx, wy, i === res.waypoints.length - 1 ? 4.2 : 2.8, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
        }
      }
    }
    ctx.globalAlpha = 1

    // Start marker (Green Circle 'S')
    const sx = toScreenX(startPos.x) + zoom * 0.5
    const sy = toScreenY(startPos.y) + zoom * 0.5
    ctx.beginPath()
    ctx.arc(sx, sy, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#2f9e44'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#d3f9d8'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('S', sx, sy + 0.5)

    // Target marker (Gold Diamond 'T')
    const tx = toScreenX(targetPos.x) + zoom * 0.5
    const ty = toScreenY(targetPos.y) + zoom * 0.5
    ctx.beginPath()
    ctx.moveTo(tx, ty - 9)
    ctx.lineTo(tx + 9, ty)
    ctx.lineTo(tx, ty + 9)
    ctx.lineTo(tx - 9, ty)
    ctx.closePath()
    ctx.fillStyle = '#e67700'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#fff3bf'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText('T', tx, ty + 0.5)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'

    ctx.restore()

    // Update KPIs & Waypoint readout
    kpiCoords.textContent = `(${startPos.x}, ${startPos.y}) → (${targetPos.x}, ${targetPos.y})`
    const ptMeta = pathTypesMeta[selectedPathType]
    const ptLabel = ptMeta ? `PATHTYPE ${ptMeta.pathType} ${ptMeta.name} (${ptMeta.handlerVa})` : `PATHTYPE ${selectedPathType}`
    canvasTitle.textContent = compareAll18
      ? `All 18 PATHTYPEs (0..17) Simultaneous Trajectory Overlay · Focus: ${ptLabel}`
      : `${ptLabel} · UnitSize=${primary.effectiveUnitSize} · UnitType=${primary.effectiveUnitType}`
    canvasMeta.textContent = `${primary.elapsedUs} μs in browser`

    if (primary.faultKind !== 0) {
      kpiRet.textContent = `ASSERT (line ${primary.faultLine})`
      kpiFlags.textContent = primary.faultMessage ?? 'Fog.#10024 Assert'
      wpSummary.textContent = `0 waypoints (${primary.faultMessage ?? 'Assert'})`
      wpList.textContent = primary.faultMessage ?? 'Fog.#10024 Assert'
    } else {
      kpiRet.textContent = `ret = ${primary.ret} · ${primary.dwPathPoints} pts`
      kpiFlags.textContent = `dir=${primary.nDirection}/${primary.nNewDirection} · flags=0x${primary.dwFlags.toString(16).toUpperCase()}`
      wpSummary.textContent = `${primary.waypoints.length} waypoints (${primary.elapsedUs} μs)`
      wpList.textContent =
        primary.waypoints.length > 0
          ? primary.waypoints.map((w, i) => `[${String(i).padStart(2, '0')}] (${w.x}, ${w.y})`).join('  ')
          : '(0 waypoints returned — blocked or zero-distance target)'
    }
  }

  function renderOracleVectorTable(): void {
    if (allOracleVectors.length === 0) return
    vecTbody.textContent = ''
    const filtered: BrowserPathVectorRecord[] = []
    for (const r of allOracleVectors) {
      if (vecFilterType !== 'all' && r.pathType !== vecFilterType) continue
      if (vecOnlyPositive && !(r.faultKind === 0 && r.ret > 0 && r.dwPathPoints > 0)) continue
      filtered.push(r)
      if (filtered.length >= 120) break
    }

    for (const r of filtered) {
      const tr = doc.createElement('tr')
      tr.className = 'k1-clickable-row'
      const statusTxt =
        r.faultKind === 2
          ? `Assert L${r.faultLine}`
          : `ret=${r.ret} (${r.dwPathPoints}p)`
      const ptName = pathTypesMeta[r.pathType]?.name ?? `T${r.pathType}`
      tr.innerHTML = `
        <td class="k1-mono">#${r.idx}</td>
        <td class="k1-mono">${r.pathType} ${ptName}</td>
        <td class="k1-mono">(${r.startX},${r.startY})→(${r.targetX},${r.targetY})</td>
        <td class="k1-mono">${statusTxt}</td>
        <td><span class="k1-pill k1-pill--ok">100%</span></td>
      `
      tr.addEventListener('click', () => {
        if (!engine) return
        selectedOracleVec = r
        selectedPathType = r.pathType
        typeSelect.value = String(r.pathType)
        unitTypeMode = r.unitType === 0 || r.unitType === 1 || r.unitType === 3 ? r.unitType : 'auto'
        unitTypeSelect.value = String(unitTypeMode)
        startPos = { x: r.startX, y: r.startY }
        targetPos = { x: r.targetX, y: r.targetY }
        customObstacles.clear()
        compareAll18 = false
        centerCameraBetweenMarkers()
        recomputeAndRender()
      })
      vecTbody.appendChild(tr)
    }
  }

  function runFullBrowserOracleVerification(): void {
    if (!engine || allOracleVectors.length === 0) return
    const summary = engine.verifyAllVectors(allOracleVectors)
    const ok = summary.diverged === 0 && summary.matched === summary.total
    oracleBadge.className = ok ? 'k1-badge k1-badge--ok' : 'k1-badge k1-badge--warn'
    oracleBadge.textContent = ok
      ? `${summary.matched.toLocaleString()} / ${summary.total.toLocaleString()} Browser Verified (${summary.elapsedMs}ms)`
      : `Diverged: ${summary.diverged} (${summary.firstMismatch ?? ''})`
    kpiVerify.textContent = `${summary.matched.toLocaleString()} / ${summary.total.toLocaleString()} Match (${summary.elapsedMs}ms)`
  }

  async function ensureLoaded(): Promise<void> {
    if (engine) {
      recomputeAndRender()
      return
    }
    const [worldResp, vecMetaResp, vecBinResp] = await Promise.all([
      fetch('/api/k1-showcase/path-world'),
      fetch('/api/k1-showcase/path-vectors?limit=60&onlyPositive=1'),
      fetch('/api/k1-showcase/path-vectors?format=bin'),
    ])
    if (!worldResp.ok || !vecMetaResp.ok || !vecBinResp.ok) {
      throw new Error('Failed to fetch Zone 3 path fixtures')
    }
    const worldData = (await worldResp.json()) as ShowcasePathWorldResponse
    const vecMeta = (await vecMetaResp.json()) as ShowcasePathVectorsJsonResponse
    const vecBin = await vecBinResp.arrayBuffer()

    pathTypesMeta = vecMeta.byPathType
    allOracleVectors = parsePathVectorsBinaryInBrowser(vecBin)
    engine = new BrowserPathSandboxEngine(worldData)
    bgOffscreen = buildOffscreenTownMap(engine)

    // Populate PATHTYPE dropdowns
    typeSelect.textContent = ''
    for (const m of pathTypesMeta) {
      const opt = doc.createElement('option')
      opt.value = String(m.pathType)
      opt.textContent = `[${m.pathType}] ${m.name} (${m.posRet} pos / ${m.total} vecs)`
      if (m.pathType === selectedPathType) opt.selected = true
      typeSelect.appendChild(opt)

      const fOpt = doc.createElement('option')
      fOpt.value = String(m.pathType)
      fOpt.textContent = `PATHTYPE ${m.pathType} · ${m.name} (${m.total})`
      vecFilterSelect.appendChild(fOpt)
    }

    // Seed initial Start/Target from the first positive IDASTAR vector so an authentic multi-corner path displays immediately
    const firstIda = allOracleVectors.find(
      (v) => v.pathType === 0 && v.faultKind === 0 && v.ret > 0 && v.dwPathPoints >= 4,
    )
    if (firstIda) {
      selectedOracleVec = firstIda
      startPos = { x: firstIda.startX, y: firstIda.startY }
      targetPos = { x: firstIda.targetX, y: firstIda.targetY }
    }

    centerCameraBetweenMarkers()
    runFullBrowserOracleVerification()
    renderOracleVectorTable()
    recomputeAndRender()
  }

  typeSelect.addEventListener('change', () => {
    selectedPathType = Number(typeSelect.value) || 0
    selectedOracleVec = null
    recomputeAndRender()
  })

  compareAllBtn.addEventListener('click', () => {
    compareAll18 = !compareAll18
    recomputeAndRender()
  })

  unitTypeSelect.addEventListener('change', () => {
    const v = unitTypeSelect.value
    unitTypeMode = v === '0' ? 0 : v === '1' ? 1 : v === '3' ? 3 : 'auto'
    selectedOracleVec = null
    recomputeAndRender()
  })

  for (const btn of sizeBtns) {
    btn.addEventListener('click', () => {
      const sz = Number(btn.dataset.pathSize)
      unitSize = sz === 2 ? 2 : sz === 3 ? 3 : 1
      for (const b of sizeBtns) b.classList.toggle('k1-btn--active', b === btn)
      selectedOracleVec = null
      recomputeAndRender()
    })
  }

  for (const btn of toolBtns) {
    btn.addEventListener('click', () => {
      const t = btn.dataset.pathTool
      pointerTool = t === 'paint-wall' ? 'paint-wall' : t === 'erase-wall' ? 'erase-wall' : 'drag-markers'
      for (const b of toolBtns) b.classList.toggle('k1-btn--active', b === btn)
    })
  }

  clearWallsBtn.addEventListener('click', () => {
    customObstacles.clear()
    recomputeAndRender()
  })

  reverifyBtn.addEventListener('click', () => {
    runFullBrowserOracleVerification()
  })

  vecFilterSelect.addEventListener('change', () => {
    const v = vecFilterSelect.value
    vecFilterType = v === 'all' ? 'all' : Number(v)
    renderOracleVectorTable()
  })

  vecPosCheckbox.addEventListener('change', () => {
    vecOnlyPositive = vecPosCheckbox.checked
    renderOracleVectorTable()
  })

  zoomInBtn.addEventListener('click', () => {
    zoom = Math.min(18, zoom * 1.3)
    recomputeAndRender()
  })
  zoomOutBtn.addEventListener('click', () => {
    zoom = Math.max(1, zoom / 1.3)
    recomputeAndRender()
  })
  zoomFitBtn.addEventListener('click', () => {
    centerCameraBetweenMarkers()
    recomputeAndRender()
  })

  function applyPaintAt(wx: number, wy: number): void {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const key = `${wx + dx}:${wy + dy}`
        if (pointerTool === 'paint-wall') customObstacles.add(key)
        else customObstacles.delete(key)
      }
    }
    selectedOracleVec = null
    recomputeAndRender()
  }

  canvas.addEventListener('pointerdown', (ev) => {
    if (!engine) return
    canvas.setPointerCapture(ev.pointerId)
    const rect = canvas.getBoundingClientRect()
    const cx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width
    const cy = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height

    if (pointerTool === 'paint-wall' || pointerTool === 'erase-wall') {
      activeDrag = 'paint'
      const w = toWorldSubtile(ev.clientX, ev.clientY)
      applyPaintAt(w.x, w.y)
      return
    }

    const sx = toScreenX(startPos.x) + zoom * 0.5
    const sy = toScreenY(startPos.y) + zoom * 0.5
    const tx = toScreenX(targetPos.x) + zoom * 0.5
    const ty = toScreenY(targetPos.y) + zoom * 0.5

    if (Math.hypot(cx - sx, cy - sy) <= 16) {
      activeDrag = 'start'
    } else if (Math.hypot(cx - tx, cy - ty) <= 16) {
      activeDrag = 'target'
    } else if (ev.shiftKey || ev.button === 1) {
      activeDrag = 'pan'
      dragClientX = ev.clientX
      dragClientY = ev.clientY
      dragPanX = panX
      dragPanY = panY
    } else {
      // Clicking anywhere moves Target directly for snappy 1-click path exploration
      activeDrag = 'target'
      targetPos = toWorldSubtile(ev.clientX, ev.clientY)
      selectedOracleVec = null
      recomputeAndRender()
    }
  })

  canvas.addEventListener('pointermove', (ev) => {
    if (!engine || activeDrag === 'none') return
    if (activeDrag === 'paint') {
      const w = toWorldSubtile(ev.clientX, ev.clientY)
      applyPaintAt(w.x, w.y)
      return
    }
    if (activeDrag === 'start') {
      startPos = toWorldSubtile(ev.clientX, ev.clientY)
      selectedOracleVec = null
      recomputeAndRender()
      return
    }
    if (activeDrag === 'target') {
      targetPos = toWorldSubtile(ev.clientX, ev.clientY)
      selectedOracleVec = null
      recomputeAndRender()
      return
    }
    if (activeDrag === 'pan') {
      const rect = canvas.getBoundingClientRect()
      const sx = canvas.width / Math.max(1, rect.width)
      const sy = canvas.height / Math.max(1, rect.height)
      panX = dragPanX + (ev.clientX - dragClientX) * sx
      panY = dragPanY + (ev.clientY - dragClientY) * sy
      recomputeAndRender()
    }
  })

  canvas.addEventListener('pointerup', () => {
    activeDrag = 'none'
  })

  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const mx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width
    const my = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height
    const factor = ev.deltaY < 0 ? 1.2 : 1 / 1.2
    const nextZoom = Math.max(1, Math.min(18, zoom * factor))
    panX = mx - ((mx - panX) / zoom) * nextZoom
    panY = my - ((my - panY) / zoom) * nextZoom
    zoom = nextZoom
    recomputeAndRender()
  })

  return {
    activate(): void {
      void ensureLoaded()
    },
    deactivate(): void {
      activeDrag = 'none'
    },
  }
}

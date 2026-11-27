/**
 * Reusable Dual-Engine Lockstep Replay Player Widget (`showcase/shared/replay-widget.ts`).
 *
 * Powers live server replay inspection across K0 (vertical slice), K3 (`9 x p52-*`),
 * K4 (`5 x k4-act{1..5}-quest`), and K6 (`23 x k6/k6-s2/k6-s3`).
 */

import {
  SHARED_CHANNEL_LABELS,
  escapeHtml,
  fetchJson,
  fmtHex32,
  fmtInt,
  type SharedReplayFrame,
  type SharedReplayPayload,
  type SharedReplayRoom,
  type SharedReplayUnitTuple,
  type ShowcaseZoneController,
} from './types.ts'

const UNIT_TYPE_LABEL: Readonly<Record<number, string>> = { 0: '玩家', 1: '怪物/NPC', 3: '投射物' }
const SPEEDS = [1, 2, 4, 8, 16] as const

export interface ReplayScenarioOption {
  readonly id: string
  readonly label: string
  readonly suite?: string
  readonly badge?: string
  readonly note?: string
  readonly bookmarks?: readonly { readonly frame: number; readonly label: string }[]
}

export interface SharedReplayWidgetConfig {
  readonly idPrefix: string
  readonly scenarios: readonly ReplayScenarioOption[]
  readonly suites?: readonly { readonly id: string; readonly label: string }[]
  readonly buildUrl: (scenarioId: string) => string
  readonly statLabels?: Readonly<Record<string, string>>
  readonly onPayloadLoaded?: (payload: SharedReplayPayload) => void
}

interface DecodedRoom {
  readonly room: SharedReplayRoom
  readonly cells: Uint16Array
}

function decodeRoom(room: SharedReplayRoom): DecodedRoom {
  const bin = atob(room.mapBase64)
  const cells = new Uint16Array(bin.length >> 1)
  for (let i = 0; i < cells.length; i++) {
    cells[i] = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)
  }
  return { room, cells }
}

export function mountSharedReplayWidget(
  container: HTMLElement,
  cfg: SharedReplayWidgetConfig,
): ShowcaseZoneController {
  const p = cfg.idPrefix
  const cache = new Map<string, SharedReplayPayload>()
  let payload: SharedReplayPayload | null = null
  let rooms: DecodedRoom[] = []
  let activeSuite = cfg.suites?.[0]?.id ?? 'all'
  let scenarioId = cfg.scenarios[0]!.id
  let frameIdx = 0
  let playing = false
  let speedIdx = 1
  let rafId = 0
  let lastTick = 0
  let active = false
  let loadToken = 0

  const suiteToolbar =
    cfg.suites && cfg.suites.length > 0
      ? `<div class="d2ks-btn-group" id="${p}-suites">${cfg.suites
          .map(
            (s, i) =>
              `<button type="button" class="d2ks-btn d2ks-btn--sm${i === 0 ? ' d2ks-btn--active' : ''}" data-suite="${escapeHtml(s.id)}">${escapeHtml(s.label)}</button>`,
          )
          .join('')}</div>`
      : ''

  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-toolbar">
        ${suiteToolbar}
        <label class="d2ks-field-inline" style="flex: 1 1 240px">
          <span>回放场景:</span>
          <select class="d2ks-select" id="${p}-scenario-select" style="max-width: 360px; flex: 1 1 auto"></select>
        </label>
        <div class="d2ks-btn-group" id="${p}-bookmarks"></div>
        <span class="d2ks-badge" id="${p}-status">待加载</span>
      </div>

      <div class="d2ks-note d2ks-note--ok" id="${p}-scenario-note" hidden></div>

      <div class="d2ks-kpi-strip">
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">strict 零分歧视界 / 末帧</span><span class="d2ks-kpi__val d2ks-mono" id="${p}-kpi-horizon">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">已比对帧 / 分歧帧</span><span class="d2ks-kpi__val d2ks-mono" id="${p}-kpi-frames">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">DLL∩TS 覆盖 / C2S 输入</span><span class="d2ks-kpi__val d2ks-mono" id="${p}-kpi-exec">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">服务端实时内核耗时</span><span class="d2ks-kpi__val d2ks-mono" id="${p}-kpi-ms">…</span></div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">逐通道 strict 校验汇总（原版 1.13c DLL 黄金轨迹 ↔ 纯 TS src/d2kern-113c）</h3>
          <span class="d2ks-muted d2ks-mono" id="${p}-window-label"></span>
        </div>
        <div class="d2ks-ch-strip" id="${p}-channel-totals"></div>
      </div>

      <div class="d2ks-scrubber-bar">
        <button type="button" class="d2ks-btn d2ks-btn--primary" id="${p}-play">▶ 播放</button>
        <button type="button" class="d2ks-btn" id="${p}-prev">◀ 帧</button>
        <button type="button" class="d2ks-btn" id="${p}-next">帧 ▶</button>
        <button type="button" class="d2ks-btn" id="${p}-speed">×2</button>
        <button type="button" class="d2ks-btn" id="${p}-jump-c2s">下个 C2S 帧</button>
        <input type="range" class="d2ks-range" id="${p}-range" min="0" max="0" value="0" />
        <span class="d2ks-badge d2ks-mono" id="${p}-frame-label">F—</span>
      </div>
      <canvas class="d2ks-timeline" id="${p}-timeline" title="绿色=strict 零分歧，红色=分歧，金色竖线=C2S 输入包；点击跳转"></canvas>

      <div class="d2ks-split-panels">
        <div class="d2ks-canvas-card">
          <div class="d2ks-canvas-card__hdr">
            <span>活动房间碰撞图 + 单位位置（金色空心 = 1.13c DLL，青色实心 = TS 内核）</span>
            <span class="d2ks-mono d2ks-muted" id="${p}-room-label">0 rooms</span>
          </div>
          <canvas class="d2ks-canvas" id="${p}-map" style="height: 320px"></canvas>
        </div>

        <div class="d2ks-panel">
          <div class="d2ks-panel__hdr">
            <h3 class="d2ks-panel__title">当前帧 · 逐通道与 PRNG / C2S 检查</h3>
            <span class="d2ks-badge" id="${p}-frame-verdict">—</span>
          </div>
          <div class="d2ks-ch-strip" id="${p}-frame-channels"></div>
          <dl class="d2ks-kv" id="${p}-frame-kv"></dl>
          <div class="d2ks-code-box" id="${p}-frame-diff" hidden></div>
        </div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">当前帧单位逐行对照（DLL 黄金轨迹 ↔ TS 内核）</h3>
          <span class="d2ks-muted d2ks-mono" id="${p}-unit-count"></span>
        </div>
        <div class="d2ks-table-scroll">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr>
                <th>类型</th><th>ID</th><th>Class</th>
                <th>DLL Mode</th><th>TS Mode</th>
                <th>DLL (x, y)</th><th>TS (x, y)</th>
                <th>DLL HP</th><th>TS HP</th><th>结果</th>
              </tr>
            </thead>
            <tbody id="${p}-unit-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const q = <T extends HTMLElement>(id: string): T => container.querySelector(`#${p}-${id}`) as T
  const scenarioSelect = q<HTMLSelectElement>('scenario-select')
  const bookmarksEl = q<HTMLElement>('bookmarks')
  const statusEl = q<HTMLElement>('status')
  const noteEl = q<HTMLElement>('scenario-note')
  const kpiHorizon = q<HTMLElement>('kpi-horizon')
  const kpiFrames = q<HTMLElement>('kpi-frames')
  const kpiExec = q<HTMLElement>('kpi-exec')
  const kpiMs = q<HTMLElement>('kpi-ms')
  const windowLabel = q<HTMLElement>('window-label')
  const chTotalsEl = q<HTMLElement>('channel-totals')
  const playBtn = q<HTMLButtonElement>('play')
  const prevBtn = q<HTMLButtonElement>('prev')
  const nextBtn = q<HTMLButtonElement>('next')
  const speedBtn = q<HTMLButtonElement>('speed')
  const jumpC2sBtn = q<HTMLButtonElement>('jump-c2s')
  const rangeEl = q<HTMLInputElement>('range')
  const frameLabel = q<HTMLElement>('frame-label')
  const timelineCanvas = q<HTMLCanvasElement>('timeline')
  const mapCanvas = q<HTMLCanvasElement>('map')
  const roomLabel = q<HTMLElement>('room-label')
  const frameVerdict = q<HTMLElement>('frame-verdict')
  const frameChEl = q<HTMLElement>('frame-channels')
  const frameKvEl = q<HTMLElement>('frame-kv')
  const frameDiffEl = q<HTMLElement>('frame-diff')
  const unitCountEl = q<HTMLElement>('unit-count')
  const unitTbody = q<HTMLElement>('unit-tbody')

  function visibleScenarios(): readonly ReplayScenarioOption[] {
    if (!cfg.suites || activeSuite === 'all') return cfg.scenarios
    return cfg.scenarios.filter((s) => s.suite === activeSuite)
  }

  function populateScenarioSelect(): void {
    const list = visibleScenarios()
    scenarioSelect.innerHTML = list
      .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.label)}${s.badge ? ` [${escapeHtml(s.badge)}]` : ''}</option>`)
      .join('')
    if (!list.some((s) => s.id === scenarioId) && list[0]) {
      scenarioId = list[0].id
    }
    scenarioSelect.value = scenarioId
    renderBookmarks()
  }

  function renderBookmarks(): void {
    const opt = cfg.scenarios.find((s) => s.id === scenarioId)
    if (opt?.note) {
      noteEl.hidden = false
      noteEl.textContent = opt.note
    } else {
      noteEl.hidden = true
    }
    const bms = opt?.bookmarks ?? []
    if (bms.length === 0) {
      bookmarksEl.innerHTML = ''
      return
    }
    bookmarksEl.innerHTML = bms
      .map(
        (b) =>
          `<button type="button" class="d2ks-btn d2ks-btn--sm" data-bm-frame="${b.frame}">${escapeHtml(b.label)}</button>`,
      )
      .join('')
    bookmarksEl.querySelectorAll<HTMLButtonElement>('[data-bm-frame]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = Number(btn.dataset.bmFrame)
        jumpToFrameNumber(target)
      })
    })
  }

  function jumpToFrameNumber(frameNo: number): void {
    if (!payload) return
    const idx = payload.frames.findIndex((f) => f.frame >= frameNo)
    if (idx >= 0) {
      playing = false
      updatePlayButton()
      frameIdx = idx
      renderFrame()
    }
  }

  function updatePlayButton(): void {
    playBtn.textContent = playing ? '❚❚ 暂停' : '▶ 播放'
  }

  function drawTimeline(): void {
    const ctx = timelineCanvas.getContext('2d')
    if (!ctx || !payload || payload.frames.length === 0) return
    const w = Math.max(240, Math.floor(timelineCanvas.clientWidth || 640))
    const h = 26
    if (timelineCanvas.width !== w || timelineCanvas.height !== h) {
      timelineCanvas.width = w
      timelineCanvas.height = h
    }
    ctx.fillStyle = '#0b0907'
    ctx.fillRect(0, 0, w, h)
    const n = payload.frames.length
    for (let i = 0; i < n; i++) {
      const f = payload.frames[i]!
      const x0 = Math.floor((i / n) * w)
      const x1 = Math.max(x0 + 1, Math.floor(((i + 1) / n) * w))
      ctx.fillStyle = f.diff === null ? '#1e6e53' : '#9c2d2d'
      ctx.fillRect(x0, 5, x1 - x0, h - 10)
      if (f.c2s.length > 0) {
        ctx.fillStyle = '#f0dc9c'
        ctx.fillRect(x0, 1, Math.max(2, x1 - x0), 4)
      }
    }
    const cx = Math.floor(((frameIdx + 0.5) / n) * w)
    ctx.fillStyle = '#f0dc9c'
    ctx.fillRect(Math.max(0, cx - 1), 0, 2, h)
  }

  function drawMap(frame: SharedReplayFrame): void {
    const ctx = mapCanvas.getContext('2d')
    if (!ctx) return
    const w = Math.max(320, Math.floor(mapCanvas.clientWidth || 540))
    const h = 320
    if (mapCanvas.width !== w || mapCanvas.height !== h) {
      mapCanvas.width = w
      mapCanvas.height = h
    }
    ctx.fillStyle = '#070605'
    ctx.fillRect(0, 0, w, h)

    // Compute bounding box from active rooms + units
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const expand = (x: number, y: number): void => {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
    for (const r of rooms) {
      expand(r.room.subtileX, r.room.subtileY)
      expand(r.room.subtileX + r.room.subtileW, r.room.subtileY + r.room.subtileH)
    }
    for (const u of frame.wine) {
      if (u[4] > 0 && u[5] > 0) expand(u[4], u[5])
    }
    for (const u of frame.ts) {
      if (u[4] > 0 && u[5] > 0) expand(u[4], u[5])
    }
    if (!Number.isFinite(minX)) {
      ctx.fillStyle = '#968a74'
      ctx.font = '12px monospace'
      ctx.fillText('No active room coordinates on this frame', 16, 28)
      return
    }
    const pad = 6
    minX -= pad
    minY -= pad
    maxX += pad
    maxY += pad
    const spanX = Math.max(1, maxX - minX)
    const spanY = Math.max(1, maxY - minY)
    const scale = Math.min((w - 16) / spanX, (h - 16) / spanY)
    const ox = (w - spanX * scale) * 0.5
    const oy = (h - spanY * scale) * 0.5
    const sx = (wx: number): number => ox + (wx - minX) * scale
    const sy = (wy: number): number => oy + (wy - minY) * scale

    // Draw room collision tiles
    for (const dr of rooms) {
      const { subtileX, subtileY, subtileW, subtileH } = dr.room
      const rx = sx(subtileX)
      const ry = sy(subtileY)
      const rw = subtileW * scale
      const rh = subtileH * scale
      ctx.fillStyle = '#14110c'
      ctx.fillRect(rx, ry, rw, rh)
      const step = scale < 2 ? 2 : 1
      ctx.fillStyle = '#33291d'
      for (let ty = 0; ty < subtileH; ty += step) {
        for (let tx = 0; tx < subtileW; tx += step) {
          const flags = dr.cells[ty * subtileW + tx] ?? 0
          if ((flags & 0x0001) !== 0) {
            ctx.fillRect(sx(subtileX + tx), sy(subtileY + ty), Math.max(1, step * scale), Math.max(1, step * scale))
          }
        }
      }
      ctx.strokeStyle = 'rgba(117, 95, 59, 0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(rx, ry, rw, rh)
    }

    // Draw Wine golden units (hollow gold rings)
    for (const u of frame.wine) {
      if (u[4] <= 0 && u[5] <= 0) continue
      const cx = sx(u[4])
      const cy = sy(u[5])
      const radius = u[0] === 0 ? 7 : u[0] === 3 ? 3.5 : 5
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = u[0] === 0 ? '#f0dc9c' : u[0] === 3 ? '#ffa94d' : '#c7b377'
      ctx.lineWidth = u[0] === 0 ? 2 : 1.5
      ctx.stroke()
    }

    // Draw TS kernel units (solid teal/cyan/orange dots)
    for (const u of frame.ts) {
      if (u[4] <= 0 && u[5] <= 0) continue
      const cx = sx(u[4])
      const cy = sy(u[5])
      const radius = u[0] === 0 ? 4.2 : u[0] === 3 ? 2.2 : 3
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = u[0] === 0 ? '#38d9a9' : u[0] === 3 ? '#ff922b' : '#58d5ff'
      ctx.fill()
      if (u[0] === 0) {
        ctx.fillStyle = '#f0dc9c'
        ctx.font = '10px monospace'
        ctx.fillText(`P#${u[1]} (${u[4]},${u[5]})`, cx + 9, cy + 3)
      }
    }
  }

  function renderFrame(): void {
    if (!payload || payload.frames.length === 0) return
    frameIdx = Math.max(0, Math.min(payload.frames.length - 1, frameIdx))
    const f = payload.frames[frameIdx]!
    rangeEl.value = String(frameIdx)
    frameLabel.textContent = `F${f.frame} / F${payload.windowEndFrame}`

    frameVerdict.textContent = f.diff === null ? 'STRICT MATCH (Δ=0)' : `DIVERGED (${f.diff.key}.${f.diff.field})`
    frameVerdict.className = f.diff === null ? 'd2ks-badge d2ks-badge--ok' : 'd2ks-badge d2ks-badge--err'

    frameChEl.innerHTML = payload.channelKeys
      .map((k, i) => {
        const st = f.ch[i] ?? 0
        const cls = st === 1 ? 'd2ks-ch-pill--ok' : st === 2 ? 'd2ks-ch-pill--err' : 'd2ks-ch-pill--na'
        const counts = st === 0 ? '—' : `${f.nWine[i]}↔${f.nTs[i]}`
        return `<span class="d2ks-ch-pill ${cls}">${SHARED_CHANNEL_LABELS[k]} ${counts}</span>`
      })
      .join('')

    const gsWineStr = f.gsWine ? `[${fmtHex32(f.gsWine[0])}, ${fmtHex32(f.gsWine[1])}]` : '—'
    const gsTsStr = f.gsTs ? `[${fmtHex32(f.gsTs[0])}, ${fmtHex32(f.gsTs[1])}]` : '—'
    const gsOk = f.gsWine && f.gsTs && f.gsWine[0] === f.gsTs[0] && f.gsWine[1] === f.gsTs[1]
    const c2sHtml =
      f.c2s.length > 0
        ? f.c2s.map((h) => `<span class="d2ks-pill d2ks-pill--warn">${escapeHtml(h)}</span>`).join(' ')
        : '<span class="d2ks-muted">(无 C2S 输入)</span>'

    let extraStatsRow = ''
    if (f.playerStats && Object.keys(f.playerStats).length > 0) {
      const chips = Object.entries(f.playerStats)
        .map(([sid, val]) => {
          const lbl = cfg.statLabels?.[sid] ?? `stat#${sid}`
          return `<span class="d2ks-pill d2ks-pill--info">${escapeHtml(lbl)}=${val}</span>`
        })
        .join(' ')
      extraStatsRow = `<dt>关键 Stat</dt><dd class="d2ks-chip-wrap">${chips}</dd>`
    }

    frameKvEl.innerHTML = `
      <dt>帧号</dt><dd class="d2ks-mono">F${f.frame} (boot=F${payload.bootFrame})</dd>
      <dt>DLL PRNG (gs)</dt><dd class="d2ks-mono">${gsWineStr}</dd>
      <dt>TS PRNG (gs)</dt><dd class="d2ks-mono ${gsOk ? 'd2ks-text--ok' : ''}">${gsTsStr}</dd>
      <dt>C2S 输入包</dt><dd>${c2sHtml}</dd>
      ${extraStatsRow}
    `

    if (f.diff !== null) {
      frameDiffEl.hidden = false
      frameDiffEl.textContent = JSON.stringify(f.diff, null, 2)
    } else {
      frameDiffEl.hidden = true
    }

    // Unit comparison table
    const wineMap = new Map<string, SharedReplayUnitTuple>()
    const tsMap = new Map<string, SharedReplayUnitTuple>()
    for (const u of f.wine) wineMap.set(`${u[0]}:${u[1]}`, u)
    for (const u of f.ts) tsMap.set(`${u[0]}:${u[1]}`, u)
    const keys = [...new Set([...wineMap.keys(), ...tsMap.keys()])].sort((a, b) => {
      const [ta, ia] = a.split(':').map(Number)
      const [tb, ib] = b.split(':').map(Number)
      return ta! - tb! || ia! - ib!
    })
    unitCountEl.textContent = `DLL ${f.wine.length} / TS ${f.ts.length} 单位`
    unitTbody.innerHTML = keys
      .slice(0, 60)
      .map((k) => {
        const w = wineMap.get(k)
        const t = tsMap.get(k)
        const same =
          w !== undefined &&
          t !== undefined &&
          w[2] === t[2] &&
          w[3] === t[3] &&
          w[4] === t[4] &&
          w[5] === t[5] &&
          w[6] === t[6] &&
          w[7] === t[7]
        const uType = (w ?? t)![0]
        const uId = (w ?? t)![1]
        const clsId = (w ?? t)![2]
        return `
          <tr>
            <td>${UNIT_TYPE_LABEL[uType] ?? `T${uType}`}</td>
            <td class="d2ks-mono">#${uId}</td>
            <td class="d2ks-mono">${clsId}</td>
            <td class="d2ks-mono">${w ? w[3] : '—'}</td>
            <td class="d2ks-mono">${t ? t[3] : '—'}</td>
            <td class="d2ks-mono">${w ? `(${w[4]}, ${w[5]})` : '—'}</td>
            <td class="d2ks-mono">${t ? `(${t[4]}, ${t[5]})` : '—'}</td>
            <td class="d2ks-mono">${w ? `${w[6]}/${w[7]}` : '—'}</td>
            <td class="d2ks-mono">${t ? `${t[6]}/${t[7]}` : '—'}</td>
            <td><span class="d2ks-pill ${same ? 'd2ks-pill--ok' : 'd2ks-pill--err'}">${same ? 'MATCH' : 'DIFF'}</span></td>
          </tr>
        `
      })
      .join('')

    drawTimeline()
    drawMap(f)
  }

  async function loadScenario(id: string): Promise<void> {
    scenarioId = id
    scenarioSelect.value = id
    renderBookmarks()
    playing = false
    updatePlayButton()
    const token = ++loadToken
    statusEl.textContent = '服务端内核回放中…'
    statusEl.className = 'd2ks-badge d2ks-badge--warn'

    try {
      let data = cache.get(id)
      if (!data) {
        data = await fetchJson<SharedReplayPayload>(cfg.buildUrl(id))
        cache.set(id, data)
      }
      if (token !== loadToken) return
      payload = data
      rooms = data.rooms.map(decodeRoom)
      frameIdx = 0
      rangeEl.min = '0'
      rangeEl.max = String(Math.max(0, data.frames.length - 1))
      rangeEl.value = '0'

      const zero = data.divergedFrames === 0 && data.firstStrictDivergence === null
      statusEl.textContent = zero ? '100% STRICT ZERO DIVERGENCE' : `DIVERGED @ F${data.firstStrictDivergence?.frame ?? '?'}`
      statusEl.className = zero ? 'd2ks-badge d2ks-badge--ok' : 'd2ks-badge d2ks-badge--err'

      kpiHorizon.textContent = `F${data.strictHorizon} / F${data.lastGoldenFrame}`
      kpiHorizon.className = `d2ks-kpi__val d2ks-mono ${zero ? 'd2ks-text--ok' : 'd2ks-text--err'}`
      kpiFrames.textContent = `${fmtInt(data.framesCompared)} / ${fmtInt(data.divergedFrames)}`
      kpiFrames.className = `d2ks-kpi__val d2ks-mono ${data.divergedFrames === 0 ? 'd2ks-text--ok' : 'd2ks-text--err'}`
      kpiExec.textContent = data.runtimeExec
        ? `C:${data.runtimeExec.d2CommonDll - data.runtimeExec.d2CommonGap}/${data.runtimeExec.d2CommonDll} G:${data.runtimeExec.d2GameDll - data.runtimeExec.d2GameGap}/${data.runtimeExec.d2GameDll} · ${data.inputCount} C2S`
        : `${data.inputCount} C2S · ${data.rooms.length} 房间`
      kpiMs.textContent = `${fmtInt(data.computeMs)} ms`
      roomLabel.textContent = `${data.rooms.length} active rooms`
      windowLabel.textContent =
        data.windowStartFrame > data.bootFrame || data.windowEndFrame < data.lastGoldenFrame
          ? `展示切片 F${data.windowStartFrame}..F${data.windowEndFrame}（已校验 F${data.bootFrame}..F${data.windowEndFrame}）`
          : `全帧 F${data.bootFrame}..F${data.lastGoldenFrame}`

      chTotalsEl.innerHTML = data.channelTotals
        .map((c) => {
          const cls =
            c.recorded === 0
              ? 'd2ks-ch-pill--na'
              : c.matched === c.recorded
                ? 'd2ks-ch-pill--ok'
                : 'd2ks-ch-pill--err'
          return `<span class="d2ks-ch-pill ${cls}">${SHARED_CHANNEL_LABELS[c.key]}: ${fmtInt(c.matched)} / ${fmtInt(c.recorded)}</span>`
        })
        .join('')

      cfg.onPayloadLoaded?.(data)
      renderFrame()
    } catch (e) {
      if (token !== loadToken) return
      statusEl.textContent = `加载失败: ${e instanceof Error ? e.message : String(e)}`
      statusEl.className = 'd2ks-badge d2ks-badge--err'
    }
  }

  function tick(ts: number): void {
    if (!active) return
    if (playing && payload && payload.frames.length > 1) {
      const intervalMs = 40 / SPEEDS[speedIdx]!
      if (ts - lastTick >= intervalMs) {
        lastTick = ts
        frameIdx = (frameIdx + 1) % payload.frames.length
        renderFrame()
      }
    }
    rafId = requestAnimationFrame(tick)
  }

  // Event wiring
  container.querySelectorAll<HTMLButtonElement>(`#${p}-suites [data-suite]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSuite = btn.dataset.suite ?? 'all'
      container.querySelectorAll<HTMLButtonElement>(`#${p}-suites [data-suite]`).forEach((b) => {
        b.classList.toggle('d2ks-btn--active', b === btn)
      })
      populateScenarioSelect()
      void loadScenario(scenarioSelect.value)
    })
  })

  scenarioSelect.addEventListener('change', () => {
    void loadScenario(scenarioSelect.value)
  })

  playBtn.addEventListener('click', () => {
    playing = !playing
    lastTick = performance.now()
    updatePlayButton()
  })
  prevBtn.addEventListener('click', () => {
    playing = false
    updatePlayButton()
    frameIdx = Math.max(0, frameIdx - 1)
    renderFrame()
  })
  nextBtn.addEventListener('click', () => {
    playing = false
    updatePlayButton()
    if (payload) frameIdx = Math.min(payload.frames.length - 1, frameIdx + 1)
    renderFrame()
  })
  speedBtn.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length
    speedBtn.textContent = `×${SPEEDS[speedIdx]}`
  })
  jumpC2sBtn.addEventListener('click', () => {
    if (!payload) return
    const next = payload.frames.findIndex((f, i) => i > frameIdx && f.c2s.length > 0)
    const fallback = payload.frames.findIndex((f) => f.c2s.length > 0)
    const idx = next >= 0 ? next : fallback
    if (idx >= 0) {
      playing = false
      updatePlayButton()
      frameIdx = idx
      renderFrame()
    }
  })
  rangeEl.addEventListener('input', () => {
    playing = false
    updatePlayButton()
    frameIdx = Number(rangeEl.value)
    renderFrame()
  })
  timelineCanvas.addEventListener('click', (ev) => {
    if (!payload || payload.frames.length === 0) return
    const rect = timelineCanvas.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / Math.max(1, rect.width)))
    playing = false
    updatePlayButton()
    frameIdx = Math.min(payload.frames.length - 1, Math.floor(frac * payload.frames.length))
    renderFrame()
  })

  populateScenarioSelect()

  return {
    activate(): void {
      active = true
      if (!payload) {
        void loadScenario(scenarioId)
      } else {
        renderFrame()
      }
      lastTick = performance.now()
      rafId = requestAnimationFrame(tick)
    },
    deactivate(): void {
      active = false
      playing = false
      updatePlayButton()
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    },
  }
}

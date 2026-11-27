/**
 * Zone 1 — K1/K2 5-scenario lockstep replay player (`showcase/k2/zone1-replay.ts`).
 *
 * The backend boots `src/d2kern-113c` from the recorded F2 snapshot, steps it frame by frame with
 * the scenario's C2S inputs and compares every frame against the original 1.13c DLL golden trace.
 * This zone only visualises that payload: unit positions of both engines, a per-frame divergence
 * timeline and the independent strict status of every channel (`t0`/`t1`/`t3`/`t4`/`gs`/`s2c`).
 */

import {
  K2_CHANNEL_LABELS,
  K2_SCENARIOS,
  escapeHtml,
  fetchJson,
  fmtInt,
  type K2ReplayFrame,
  type K2ReplayPayload,
  type K2ReplayRoom,
  type K2ReplayUnitTuple,
  type K2ScenarioId,
  type K2ZoneController,
} from './types.ts'

const UNIT_TYPE_LABEL: Readonly<Record<number, string>> = { 0: '玩家', 1: '怪物', 3: '投射物' }
const SPEEDS = [1, 2, 4, 8, 16] as const

interface DecodedRoom {
  readonly room: K2ReplayRoom
  readonly cells: Uint16Array
}

function decodeRoom(room: K2ReplayRoom): DecodedRoom {
  const bin = atob(room.mapBase64)
  const cells = new Uint16Array(bin.length >> 1)
  for (let i = 0; i < cells.length; i++) {
    cells[i] = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)
  }
  return { room, cells }
}

export function mountZone1Replay(container: HTMLElement): K2ZoneController {
  let payload: K2ReplayPayload | null = null
  let rooms: DecodedRoom[] = []
  let scenario: K2ScenarioId = K2_SCENARIOS[0]
  const cache = new Map<K2ScenarioId, K2ReplayPayload>()
  let frameIdx = 0
  let playing = false
  let speedIdx = 1
  let rafId = 0
  let lastTick = 0
  let active = false
  let loadToken = 0

  container.innerHTML = `
    <div class="k2-zone-stack">
      <div class="k2-toolbar">
        <div class="k2-btn-group" role="group" aria-label="Scenario" id="k2-rp-scenarios">
          ${K2_SCENARIOS.map((s) => `<button type="button" class="k2-btn" data-scenario="${s}">${s}</button>`).join('')}
        </div>
        <span class="k2-badge" id="k2-rp-status">加载中…</span>
      </div>

      <div class="k2-kpi-strip">
        <div class="k2-kpi"><span class="k2-kpi__label">strict 零分歧视界 / 黄金轨迹末帧</span><span class="k2-kpi__val k2-mono" id="k2-rp-kpi-horizon">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">比对帧数 / 分歧帧数</span><span class="k2-kpi__val k2-mono" id="k2-rp-kpi-frames">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">C2S 输入包 / 活动房间</span><span class="k2-kpi__val k2-mono" id="k2-rp-kpi-inputs">…</span></div>
        <div class="k2-kpi"><span class="k2-kpi__label">服务端内核回放耗时</span><span class="k2-kpi__val k2-mono" id="k2-rp-kpi-ms">…</span></div>
      </div>

      <div class="k2-panel">
        <div class="k2-panel__hdr">
          <h3 class="k2-panel__title">逐通道累计（黄金轨迹记录了该通道的帧数 → 其中 strict 一致的帧数）</h3>
        </div>
        <div class="k2-ch-strip" id="k2-rp-channel-totals"></div>
      </div>

      <div class="k2-scrubber-bar">
        <button type="button" class="k2-btn k2-btn--primary" id="k2-rp-play">▶ 播放</button>
        <button type="button" class="k2-btn" id="k2-rp-prev">◀ 帧</button>
        <button type="button" class="k2-btn" id="k2-rp-next">帧 ▶</button>
        <button type="button" class="k2-btn" id="k2-rp-speed">×2</button>
        <button type="button" class="k2-btn" id="k2-rp-jump-div">跳到首个分歧帧</button>
        <input type="range" class="k2-range" id="k2-rp-range" min="0" max="0" value="0" style="flex: 1 1 160px" />
        <span class="k2-badge k2-mono" id="k2-rp-frame-label">F—</span>
      </div>
      <canvas class="k2-timeline" id="k2-rp-timeline" title="每帧 strict 比对结果：绿=零分歧，红=分歧。点击定位。"></canvas>

      <div class="k2-replay-grid">
        <div class="k2-canvas-card">
          <div class="k2-canvas-card__hdr">
            <span>碰撞图 + 单位位置（金色空心 = 原版 DLL 黄金轨迹，青色实心 = TS 内核）</span>
          </div>
          <canvas class="k2-canvas" id="k2-rp-map" style="height: 330px"></canvas>
        </div>
        <div class="k2-panel">
          <div class="k2-panel__hdr">
            <h3 class="k2-panel__title">当前帧 · 逐通道 strict 状态</h3>
            <span class="k2-badge" id="k2-rp-frame-verdict">—</span>
          </div>
          <div class="k2-ch-strip" id="k2-rp-frame-channels"></div>
          <dl class="k2-kv" id="k2-rp-frame-kv"></dl>
          <div class="k2-code-box" id="k2-rp-frame-diff" hidden></div>
        </div>
      </div>

      <div class="k2-panel">
        <div class="k2-panel__hdr">
          <h3 class="k2-panel__title">单位逐行对照（DLL 黄金轨迹 ↔ TS 内核）</h3>
          <span class="k2-muted" id="k2-rp-unit-count"></span>
        </div>
        <div class="k2-table-scroll">
          <table class="k2-table k2-table--compact">
            <thead>
              <tr>
                <th>类型</th><th>id</th><th>class</th>
                <th>DLL mode</th><th>TS mode</th>
                <th>DLL (x, y)</th><th>TS (x, y)</th>
                <th>DLL HP</th><th>TS HP</th><th>结果</th>
              </tr>
            </thead>
            <tbody id="k2-rp-unit-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const q = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T
  const statusEl = q<HTMLElement>('#k2-rp-status')
  const rangeEl = q<HTMLInputElement>('#k2-rp-range')
  const playBtn = q<HTMLButtonElement>('#k2-rp-play')
  const speedBtn = q<HTMLButtonElement>('#k2-rp-speed')
  const mapCanvas = q<HTMLCanvasElement>('#k2-rp-map')
  const timelineCanvas = q<HTMLCanvasElement>('#k2-rp-timeline')

  function fitCanvas(canvas: HTMLCanvasElement): { w: number; h: number; ctx: CanvasRenderingContext2D } | null {
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return { w, h, ctx }
  }

  function currentFrame(): K2ReplayFrame | null {
    return payload ? (payload.frames[frameIdx] ?? null) : null
  }

  function drawTimeline(): void {
    const fit = fitCanvas(timelineCanvas)
    if (!fit) return
    const { w, h, ctx } = fit
    ctx.fillStyle = '#0b0907'
    ctx.fillRect(0, 0, w, h)
    if (!payload || payload.frames.length === 0) return
    const n = payload.frames.length
    // One column per pixel; a column is red when ANY frame mapped to it diverged.
    for (let x = 0; x < w; x++) {
      const from = Math.floor((x / w) * n)
      const to = Math.max(from + 1, Math.floor(((x + 1) / w) * n))
      let bad = false
      let hasInput = false
      for (let i = from; i < to && i < n; i++) {
        const f = payload.frames[i]!
        if (f.diff !== null) bad = true
        if (f.c2s.length > 0) hasInput = true
      }
      ctx.fillStyle = bad ? '#ff6b6b' : '#1f7a5c'
      ctx.fillRect(x, 6, 1, h - 6)
      if (hasInput) {
        ctx.fillStyle = '#f0dc9c'
        ctx.fillRect(x, 0, 1, 5)
      }
    }
    const cx = Math.round((frameIdx / Math.max(1, n - 1)) * (w - 1))
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(cx, 0, 1, h)
  }

  function drawMap(): void {
    const fit = fitCanvas(mapCanvas)
    if (!fit) return
    const { w, h, ctx } = fit
    ctx.fillStyle = '#070605'
    ctx.fillRect(0, 0, w, h)
    const frame = currentFrame()
    if (!payload || !frame) return

    // Camera: centre on the first player of the golden frame, fall back to the room bounds.
    const player = frame.wine.find((u) => u[0] === 0) ?? frame.wine[0]
    let cx = 0
    let cy = 0
    if (player) {
      cx = player[4]
      cy = player[5]
    } else if (rooms.length > 0) {
      cx = rooms[0]!.room.subtileX
      cy = rooms[0]!.room.subtileY
    }
    const scale = Math.max(2, Math.min(w, h) / 96)
    const sx = (x: number): number => (x - cx) * scale + w / 2
    const sy = (y: number): number => (y - cy) * scale + h / 2

    for (const { room, cells } of rooms) {
      const x0 = sx(room.subtileX)
      const y0 = sy(room.subtileY)
      if (x0 > w || y0 > h || x0 + room.subtileW * scale < 0 || y0 + room.subtileH * scale < 0) continue
      ctx.fillStyle = '#1a1610'
      ctx.fillRect(x0, y0, room.subtileW * scale, room.subtileH * scale)
      ctx.fillStyle = '#3a2f1e'
      for (let yy = 0; yy < room.subtileH; yy++) {
        for (let xx = 0; xx < room.subtileW; xx++) {
          // Bit 0 of the 1.13c u16 collision cell = blocks walking.
          if ((cells[yy * room.subtileW + xx]! & 0x0001) !== 0) {
            ctx.fillRect(x0 + xx * scale, y0 + yy * scale, scale, scale)
          }
        }
      }
      ctx.strokeStyle = 'rgba(117, 95, 59, 0.5)'
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, room.subtileW * scale, room.subtileH * scale)
    }

    const drawUnits = (units: readonly K2ReplayUnitTuple[], isTs: boolean): void => {
      for (const u of units) {
        const px = sx(u[4]) + scale / 2
        const py = sy(u[5]) + scale / 2
        if (px < -10 || py < -10 || px > w + 10 || py > h + 10) continue
        const r = u[0] === 0 ? 5 : u[0] === 1 ? 4 : 2.5
        ctx.beginPath()
        if (isTs) {
          ctx.arc(px, py, r * 0.55, 0, Math.PI * 2)
          ctx.fillStyle = u[0] === 0 ? '#63e6ff' : u[0] === 1 ? '#3bc9db' : '#99e9f2'
          ctx.fill()
        } else {
          ctx.arc(px, py, r, 0, Math.PI * 2)
          ctx.lineWidth = 1.5
          ctx.strokeStyle = u[0] === 0 ? '#f0dc9c' : u[0] === 1 ? '#ffa94d' : '#c7b377'
          ctx.stroke()
        }
      }
    }
    drawUnits(frame.wine, false)
    drawUnits(frame.ts, true)

    ctx.fillStyle = 'rgba(7, 6, 5, 0.78)'
    ctx.fillRect(6, 6, 232, 20)
    ctx.fillStyle = '#dfd5c2'
    ctx.font = '11px ui-monospace, monospace'
    ctx.fillText(`F${frame.frame} · 镜头 (${cx}, ${cy}) · ${rooms.length} 房间`, 12, 20)
  }

  function renderFrame(): void {
    const frame = currentFrame()
    if (!payload || !frame) return
    rangeEl.value = String(frameIdx)
    q<HTMLElement>('#k2-rp-frame-label').textContent = `F${frame.frame} / F${payload.lastGoldenFrame}`

    const verdict = q<HTMLElement>('#k2-rp-frame-verdict')
    verdict.textContent = frame.diff === null ? 'strict 零分歧' : `分歧 @ ${frame.diff.key}`
    verdict.className = `k2-badge ${frame.diff === null ? 'k2-badge--ok' : 'k2-badge--err'}`

    q<HTMLElement>('#k2-rp-frame-channels').innerHTML = payload.channelKeys
      .map((key, i) => {
        const st = frame.ch[i] ?? 0
        const cls = st === 1 ? 'k2-ch-pill--ok' : st === 2 ? 'k2-ch-pill--err' : 'k2-ch-pill--na'
        const mark = st === 1 ? '✓' : st === 2 ? '✗' : '—'
        const counts = st === 0 ? '未记录' : `DLL ${frame.nWine[i]} / TS ${frame.nTs[i]}`
        return `<span class="k2-ch-pill ${cls}" title="${escapeHtml(K2_CHANNEL_LABELS[key])}">${mark} ${escapeHtml(K2_CHANNEL_LABELS[key])} · ${counts}</span>`
      })
      .join('')

    const hex = (v: number): string => `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
    const gs = (g: readonly [number, number] | null): string => (g ? `${hex(g[0])} : ${hex(g[1])}` : '—')
    q<HTMLElement>('#k2-rp-frame-kv').innerHTML = `
      <dt>DLL 游戏种子</dt><dd class="k2-mono">${gs(frame.gsWine)}</dd>
      <dt>TS 游戏种子</dt><dd class="k2-mono">${gs(frame.gsTs)}</dd>
      <dt>本帧 C2S 输入</dt><dd class="k2-mono">${
        frame.c2s.length === 0 ? '（无）' : frame.c2s.map((p) => escapeHtml(p)).join('<br />')
      }</dd>
    `
    const diffBox = q<HTMLElement>('#k2-rp-frame-diff')
    if (frame.diff === null) {
      diffBox.hidden = true
      diffBox.textContent = ''
    } else {
      diffBox.hidden = false
      diffBox.textContent = JSON.stringify(frame.diff, null, 1)
    }

    // Unit table: join golden and TS rows by (type, id).
    const tsByKey = new Map<string, K2ReplayUnitTuple>()
    for (const u of frame.ts) tsByKey.set(`${u[0]}:${u[1]}`, u)
    const seen = new Set<string>()
    const rows: string[] = []
    let mismatched = 0
    const cell = (a: string, b: string): string =>
      a === b ? `<td>${a}</td><td>${b}</td>` : `<td class="k2-cell--err">${a}</td><td class="k2-cell--err">${b}</td>`
    for (const g of frame.wine) {
      const key = `${g[0]}:${g[1]}`
      seen.add(key)
      const t = tsByKey.get(key)
      const same = t !== undefined && t[2] === g[2] && t[3] === g[3] && t[4] === g[4] && t[5] === g[5] && t[6] === g[6]
      if (!same) mismatched++
      rows.push(`<tr>
        <td>${UNIT_TYPE_LABEL[g[0]] ?? g[0]}</td><td>${g[1]}</td><td>${g[2]}</td>
        ${cell(String(g[3]), t ? String(t[3]) : '缺失')}
        ${cell(`(${g[4]}, ${g[5]})`, t ? `(${t[4]}, ${t[5]})` : '缺失')}
        ${cell(g[0] === 3 ? '—' : String(g[6]), t ? (t[0] === 3 ? '—' : String(t[6])) : '缺失')}
        <td class="${same ? 'k2-cell--ok' : 'k2-cell--err'}">${same ? '✓' : '✗'}</td>
      </tr>`)
    }
    for (const t of frame.ts) {
      const key = `${t[0]}:${t[1]}`
      if (seen.has(key)) continue
      mismatched++
      rows.push(`<tr>
        <td>${UNIT_TYPE_LABEL[t[0]] ?? t[0]}</td><td>${t[1]}</td><td>${t[2]}</td>
        ${cell('缺失', String(t[3]))}${cell('缺失', `(${t[4]}, ${t[5]})`)}${cell('缺失', String(t[6]))}
        <td class="k2-cell--err">✗</td>
      </tr>`)
    }
    q<HTMLElement>('#k2-rp-unit-body').innerHTML = rows.join('')
    q<HTMLElement>('#k2-rp-unit-count').textContent =
      `DLL ${frame.wine.length} 单位 / TS ${frame.ts.length} 单位 · 不一致 ${mismatched}`

    drawMap()
    drawTimeline()
  }

  function renderSummary(): void {
    if (!payload) return
    const p = payload
    const zero = p.firstStrictDivergence === null && p.strictHorizon === p.lastGoldenFrame
    statusEl.textContent = zero
      ? `${p.scenario}: strict 零分歧 F${p.bootFrame}..F${p.lastGoldenFrame}`
      : `${p.scenario}: 首个分歧 F${p.firstStrictDivergence?.frame ?? '?'}`
    statusEl.className = `k2-badge ${zero ? 'k2-badge--ok' : 'k2-badge--err'}`
    const horizon = q<HTMLElement>('#k2-rp-kpi-horizon')
    horizon.textContent = `F${p.strictHorizon} / F${p.lastGoldenFrame}`
    horizon.className = `k2-kpi__val k2-mono ${zero ? 'k2-text--ok' : 'k2-text--err'}`
    const framesEl = q<HTMLElement>('#k2-rp-kpi-frames')
    framesEl.textContent = `${fmtInt(p.framesCompared)} / ${fmtInt(p.divergedFrames)}`
    framesEl.className = `k2-kpi__val k2-mono ${p.divergedFrames === 0 ? 'k2-text--ok' : 'k2-text--err'}`
    q<HTMLElement>('#k2-rp-kpi-inputs').textContent = `${fmtInt(p.inputCount)} / ${p.rooms.length}`
    q<HTMLElement>('#k2-rp-kpi-ms').textContent = `${fmtInt(p.computeMs)} ms`
    q<HTMLElement>('#k2-rp-channel-totals').innerHTML = p.channelTotals
      .map((c) => {
        if (c.recorded === 0) {
          return `<span class="k2-ch-pill k2-ch-pill--na">— ${escapeHtml(K2_CHANNEL_LABELS[c.key])} · 黄金轨迹未记录</span>`
        }
        const ok = c.matched === c.recorded
        return `<span class="k2-ch-pill ${ok ? 'k2-ch-pill--ok' : 'k2-ch-pill--err'}">${ok ? '✓' : '✗'} ${escapeHtml(
          K2_CHANNEL_LABELS[c.key],
        )} · ${fmtInt(c.matched)} / ${fmtInt(c.recorded)}</span>`
      })
      .join('')
    q<HTMLButtonElement>('#k2-rp-jump-div').disabled = p.divergedFrames === 0
    rangeEl.max = String(Math.max(0, p.frames.length - 1))
    for (const btn of container.querySelectorAll<HTMLButtonElement>('[data-scenario]')) {
      btn.classList.toggle('k2-btn--active', btn.dataset.scenario === p.scenario)
    }
  }

  function setPlaying(next: boolean): void {
    playing = next && payload !== null
    playBtn.textContent = playing ? '⏸ 暂停' : '▶ 播放'
    if (playing && rafId === 0) {
      lastTick = 0
      rafId = requestAnimationFrame(tick)
    }
  }

  function tick(ts: number): void {
    rafId = 0
    if (!playing || !active || !payload) return
    // 25 game frames per second at ×1.
    const interval = 40 / SPEEDS[speedIdx]!
    if (lastTick === 0) lastTick = ts
    let advanced = false
    while (ts - lastTick >= interval) {
      lastTick += interval
      if (frameIdx < payload.frames.length - 1) {
        frameIdx++
        advanced = true
      } else {
        setPlaying(false)
        break
      }
    }
    if (advanced) renderFrame()
    if (playing) rafId = requestAnimationFrame(tick)
  }

  async function load(next: K2ScenarioId): Promise<void> {
    const token = ++loadToken
    scenario = next
    setPlaying(false)
    statusEl.textContent = `${next}: 服务端内核回放中…`
    statusEl.className = 'k2-badge'
    try {
      let data = cache.get(next)
      if (!data) {
        data = await fetchJson<K2ReplayPayload>(`/api/k2-showcase/replay?scenario=${encodeURIComponent(next)}`)
        cache.set(next, data)
      }
      if (token !== loadToken) return
      payload = data
      rooms = data.rooms.map(decodeRoom)
      frameIdx = 0
      renderSummary()
      renderFrame()
    } catch (e) {
      if (token !== loadToken) return
      payload = null
      statusEl.textContent = `加载失败: ${e instanceof Error ? e.message : String(e)}`
      statusEl.className = 'k2-badge k2-badge--err'
    }
  }

  for (const btn of container.querySelectorAll<HTMLButtonElement>('[data-scenario]')) {
    btn.addEventListener('click', () => void load(btn.dataset.scenario as K2ScenarioId))
  }
  playBtn.addEventListener('click', () => {
    if (payload && !playing && frameIdx >= payload.frames.length - 1) frameIdx = 0
    setPlaying(!playing)
  })
  q<HTMLButtonElement>('#k2-rp-prev').addEventListener('click', () => {
    setPlaying(false)
    frameIdx = Math.max(0, frameIdx - 1)
    renderFrame()
  })
  q<HTMLButtonElement>('#k2-rp-next').addEventListener('click', () => {
    setPlaying(false)
    if (payload) frameIdx = Math.min(payload.frames.length - 1, frameIdx + 1)
    renderFrame()
  })
  speedBtn.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length
    speedBtn.textContent = `×${SPEEDS[speedIdx]}`
  })
  q<HTMLButtonElement>('#k2-rp-jump-div').addEventListener('click', () => {
    if (!payload) return
    const idx = payload.frames.findIndex((f) => f.diff !== null)
    if (idx >= 0) {
      setPlaying(false)
      frameIdx = idx
      renderFrame()
    }
  })
  rangeEl.addEventListener('input', () => {
    setPlaying(false)
    frameIdx = Number.parseInt(rangeEl.value, 10) || 0
    renderFrame()
  })
  timelineCanvas.addEventListener('click', (ev) => {
    if (!payload) return
    const rect = timelineCanvas.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (ev.clientX - rect.left) / Math.max(1, rect.width)))
    setPlaying(false)
    frameIdx = Math.round(ratio * (payload.frames.length - 1))
    renderFrame()
  })

  const onResize = (): void => {
    if (active && payload) renderFrame()
  }

  return {
    activate(): void {
      active = true
      window.addEventListener('resize', onResize)
      if (payload === null) void load(scenario)
      else renderFrame()
    },
    deactivate(): void {
      active = false
      setPlaying(false)
      window.removeEventListener('resize', onResize)
    },
  }
}

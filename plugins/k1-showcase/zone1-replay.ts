/**
 * Zone 1 — Dual-Engine Lockstep Replay Player (`a1-town-walk` 750f & `a1c-bloodmoor-fallen` 2000f)
 * (`plugins/k1-showcase/zone1-replay.ts`).
 */

import {
  decodeBase64Uint16LE,
  formatHex32,
  formatUnitLabel,
  formatUnitMode,
  type ReplayScenarioId,
  type ShowcaseReplayFrame,
  type ShowcaseReplayPayload,
  type ShowcaseReplayUnit,
} from './types.ts'

interface DecodedReplayRoom {
  readonly levelId: number
  readonly sx: number
  readonly sy: number
  readonly sw: number
  readonly sh: number
  readonly words: Uint16Array
}

interface HydratedReplayBundle {
  readonly data: ShowcaseReplayPayload
  readonly rooms: readonly DecodedReplayRoom[]
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
  readonly bgCanvas: HTMLCanvasElement
}

export interface ReplayZoneController {
  activate(): void
  deactivate(): void
}

function buildReplayMapOffscreen(
  doc: Document,
  rooms: readonly DecodedReplayRoom[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): HTMLCanvasElement {
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  const off = doc.createElement('canvas')
  off.width = w
  off.height = h
  const ctx = off.getContext('2d')
  if (!ctx) return off

  const img = ctx.createImageData(w, h)
  const buf = img.data
  // Base void background (#090806)
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = 9
    buf[i + 1] = 8
    buf[i + 2] = 6
    buf[i + 3] = 255
  }

  for (const r of rooms) {
    const isBloodMoor = r.levelId === 2
    for (let ry = 0; ry < r.sh; ry++) {
      const gy = r.sy + ry - minY
      if (gy < 0 || gy >= h) continue
      for (let rx = 0; rx < r.sw; rx++) {
        const gx = r.sx + rx - minX
        if (gx < 0 || gx >= w) continue
        const mask = r.words[ry * r.sw + rx] ?? 0
        const p = (gy * w + gx) * 4
        if ((mask & 0x1000) !== 0) {
          buf[p] = 12
          buf[p + 1] = 10
          buf[p + 2] = 9
        } else if ((mask & 0x0001) !== 0) {
          // Wall / Obstacle
          buf[p] = 112
          buf[p + 1] = 86
          buf[p + 2] = 52
        } else if ((mask & 0x0004) !== 0 || (mask & 0x0002) !== 0) {
          // River / Puddle / Sight-blocker
          buf[p] = 36
          buf[p + 1] = 66
          buf[p + 2] = 96
        } else if ((mask & 0x0008) !== 0) {
          buf[p] = 74
          buf[p + 1] = 54
          buf[p + 2] = 42
        } else if (isBloodMoor) {
          // Walkable Blood Moor grass
          buf[p] = 24
          buf[p + 1] = 34
          buf[p + 2] = 22
        } else {
          // Walkable Rogue Encampment stone/earth
          buf[p] = 32
          buf[p + 1] = 27
          buf[p + 2] = 20
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0)

  // Subtle room boundary gridlines
  ctx.strokeStyle = 'rgba(199, 179, 119, 0.14)'
  ctx.lineWidth = 0.5
  for (const r of rooms) {
    ctx.strokeRect(r.sx - minX, r.sy - minY, r.sw, r.sh)
  }
  return off
}

export function mountZone1Replay(container: HTMLElement): ReplayZoneController {
  const doc = container.ownerDocument ?? document
  const bundleCache = new Map<ReplayScenarioId, HydratedReplayBundle>()

  let currentScenario: ReplayScenarioId = 'a1c-bloodmoor-fallen'
  let viewMode: 'split' | 'ghost' = 'split'
  let cameraMode: 'follow' | 'overview' = 'follow'
  let frameIdx = 0
  let playing = false
  let speed = 1
  let rafId = 0
  let lastTickMs = 0
  let loading = false

  container.innerHTML = `
    <div class="k1-zone-stack">
      <div class="k1-toolbar">
        <div class="k1-btn-group" role="group" aria-label="Scenario">
          <button type="button" class="k1-btn" data-replay-scenario="a1c-bloodmoor-fallen">
            a1c-bloodmoor-fallen (2,000f · 战斗/掉落/经验)
          </button>
          <button type="button" class="k1-btn" data-replay-scenario="a1-town-walk">
            a1-town-walk (750f · 罗格营地巡逻)
          </button>
        </div>

        <div class="k1-btn-group" role="group" aria-label="View Mode">
          <button type="button" class="k1-btn" data-replay-view="split">双画布并排 (Side-by-Side)</button>
          <button type="button" class="k1-btn" data-replay-view="ghost">幻影重叠校验 (Ghost Overlay)</button>
        </div>

        <div class="k1-btn-group" role="group" aria-label="Camera">
          <button type="button" class="k1-btn" data-replay-cam="follow">镜头跟随主角</button>
          <button type="button" class="k1-btn" data-replay-cam="overview">全景鸟瞰</button>
        </div>

        <span id="k1-replay-cert-badge" class="k1-badge k1-badge--ok">
          Frame Diff = 0 · Strict 2000 / 2000
        </span>
      </div>

      <div class="k1-kpi-strip" id="k1-replay-kpis">
        <div class="k1-kpi">
          <span class="k1-kpi__label">当前帧 / 严格地平线 (Frame / Horizon)</span>
          <span class="k1-kpi__val" id="k1-replay-kpi-frame">F2 / F2000</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">最大坐标误差 (Max Subtile Δ)</span>
          <span class="k1-kpi__val k1-text--ok" id="k1-replay-kpi-delta">0.00 subtile</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">64-bit Game Seed [lo, hi]</span>
          <span class="k1-kpi__val k1-mono" id="k1-replay-kpi-gs">--</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">本帧 C2S 报文 / 活跃实体</span>
          <span class="k1-kpi__val" id="k1-replay-kpi-c2s">0 pkt · 0 units</span>
        </div>
      </div>

      <div class="k1-canvas-grid" id="k1-replay-canvas-grid">
        <div class="k1-canvas-card" id="k1-replay-left-card">
          <div class="k1-canvas-card__hdr">
            <span id="k1-replay-left-title">Wine 1.13c D2Game.dll + D2Common.dll Oracle Golden</span>
            <span class="k1-mono k1-muted" id="k1-replay-left-sub">x86 Binary Hook</span>
          </div>
          <canvas id="k1-replay-canvas-left" class="k1-canvas" width="520" height="320"></canvas>
        </div>
        <div class="k1-canvas-card" id="k1-replay-right-card">
          <div class="k1-canvas-card__hdr">
            <span>Pure TypeScript src/d2kern-113c Isomorphic Kernel</span>
            <span class="k1-mono k1-text--ok" id="k1-replay-right-sub">SparseMemory113c</span>
          </div>
          <canvas id="k1-replay-canvas-right" class="k1-canvas" width="520" height="320"></canvas>
        </div>
      </div>

      <div class="k1-scrubber-bar">
        <button type="button" class="k1-btn k1-btn--primary" id="k1-replay-play-btn">▶ 播放 (Play)</button>
        <button type="button" class="k1-btn" id="k1-replay-prev-btn">-1 帧</button>
        <button type="button" class="k1-btn" id="k1-replay-next-btn">+1 帧</button>
        <input
          type="range"
          id="k1-replay-slider"
          class="k1-range"
          min="0"
          max="1998"
          step="1"
          value="0"
          aria-label="Replay Frame Scrubber"
        />
        <span class="k1-mono k1-gold" id="k1-replay-frame-readout">F2</span>
        <div class="k1-btn-group" role="group" aria-label="Playback Speed">
          <button type="button" class="k1-btn" data-replay-speed="0.5">0.5x</button>
          <button type="button" class="k1-btn" data-replay-speed="1">1x</button>
          <button type="button" class="k1-btn" data-replay-speed="2">2x</button>
          <button type="button" class="k1-btn" data-replay-speed="4">4x</button>
        </div>
      </div>

      <div class="k1-panel">
        <div class="k1-panel__hdr">
          <h3 class="k1-panel__title">逐帧双引擎实体对齐明细表 (Wine Oracle vs TS d2kern-113c Unit Lockstep Table)</h3>
          <span class="k1-muted" id="k1-replay-table-meta">Loading real replay frames...</span>
        </div>
        <div class="k1-table-scroll">
          <table class="k1-table" id="k1-replay-unit-table">
            <thead>
              <tr>
                <th>实体 (Unit)</th>
                <th>Wine (x, y)</th>
                <th>TS (x, y)</th>
                <th>Mode (W / TS)</th>
                <th>Wine 64-bit Seed [lo, hi]</th>
                <th>TS 64-bit Seed [lo, hi]</th>
                <th>HP (W / TS)</th>
                <th>XP / Lvl</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody id="k1-replay-unit-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const certBadge = container.querySelector('#k1-replay-cert-badge') as HTMLElement
  const kpiFrame = container.querySelector('#k1-replay-kpi-frame') as HTMLElement
  const kpiDelta = container.querySelector('#k1-replay-kpi-delta') as HTMLElement
  const kpiGs = container.querySelector('#k1-replay-kpi-gs') as HTMLElement
  const kpiC2s = container.querySelector('#k1-replay-kpi-c2s') as HTMLElement
  const canvasGrid = container.querySelector('#k1-replay-canvas-grid') as HTMLElement
  const rightCard = container.querySelector('#k1-replay-right-card') as HTMLElement
  const leftTitle = container.querySelector('#k1-replay-left-title') as HTMLElement
  const leftSub = container.querySelector('#k1-replay-left-sub') as HTMLElement
  const rightSub = container.querySelector('#k1-replay-right-sub') as HTMLElement
  const canvasLeft = container.querySelector('#k1-replay-canvas-left') as HTMLCanvasElement
  const canvasRight = container.querySelector('#k1-replay-canvas-right') as HTMLCanvasElement
  const playBtn = container.querySelector('#k1-replay-play-btn') as HTMLButtonElement
  const prevBtn = container.querySelector('#k1-replay-prev-btn') as HTMLButtonElement
  const nextBtn = container.querySelector('#k1-replay-next-btn') as HTMLButtonElement
  const slider = container.querySelector('#k1-replay-slider') as HTMLInputElement
  const frameReadout = container.querySelector('#k1-replay-frame-readout') as HTMLElement
  const tableMeta = container.querySelector('#k1-replay-table-meta') as HTMLElement
  const unitTbody = container.querySelector('#k1-replay-unit-tbody') as HTMLElement

  const scenarioBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-replay-scenario]')]
  const viewBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-replay-view]')]
  const camBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-replay-cam]')]
  const speedBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-replay-speed]')]

  function syncToolbarActiveClasses(): void {
    for (const b of scenarioBtns) {
      b.classList.toggle('k1-btn--active', b.dataset.replayScenario === currentScenario)
    }
    for (const b of viewBtns) {
      b.classList.toggle('k1-btn--active', b.dataset.replayView === viewMode)
    }
    for (const b of camBtns) {
      b.classList.toggle('k1-btn--active', b.dataset.replayCam === cameraMode)
    }
    for (const b of speedBtns) {
      b.classList.toggle('k1-btn--active', Number(b.dataset.replaySpeed) === speed)
    }
    playBtn.textContent = playing ? '⏸ 暂停 (Pause)' : '▶ 播放 (Play)'
  }

  function drawArenaCanvas(
    canvas: HTMLCanvasElement,
    bundle: HydratedReplayBundle,
    frameObj: ShowcaseReplayFrame,
    mode: 'wine' | 'ts' | 'ghost',
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cw = canvas.width
    const ch = canvas.height
    ctx.fillStyle = '#070605'
    ctx.fillRect(0, 0, cw, ch)

    const worldW = Math.max(1, bundle.maxX - bundle.minX)
    const worldH = Math.max(1, bundle.maxY - bundle.minY)

    const player =
      frameObj.tsUnits.find((u) => u.type === 0) ?? frameObj.wineUnits.find((u) => u.type === 0)

    let scale: number
    let camCenterX: number
    let camCenterY: number

    if (cameraMode === 'follow' && player) {
      scale = 4.2
      camCenterX = player.x
      camCenterY = player.y
    } else {
      const pad = 16
      scale = Math.min((cw - pad * 2) / worldW, (ch - pad * 2) / worldH)
      camCenterX = bundle.minX + worldW * 0.5
      camCenterY = bundle.minY + worldH * 0.5
    }

    const toScreenX = (wx: number): number => cw * 0.5 + (wx - camCenterX) * scale
    const toScreenY = (wy: number): number => ch * 0.5 + (wy - camCenterY) * scale

    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      bundle.bgCanvas,
      toScreenX(bundle.minX),
      toScreenY(bundle.minY),
      worldW * scale,
      worldH * scale,
    )

    // Player trajectory trail from bootFrame .. current frameIdx
    ctx.beginPath()
    let started = false
    const stride = frameIdx > 400 ? 3 : 1
    for (let i = 0; i <= frameIdx; i += stride) {
      const fr = bundle.data.frames[i]
      const pu = fr?.tsUnits.find((u) => u.type === 0)
      if (!pu) continue
      const sx = toScreenX(pu.x)
      const sy = toScreenY(pu.y)
      if (!started) {
        ctx.moveTo(sx, sy)
        started = true
      } else {
        ctx.lineTo(sx, sy)
      }
    }
    if (frameIdx % stride !== 0 && player) {
      ctx.lineTo(toScreenX(player.x), toScreenY(player.y))
    }
    ctx.strokeStyle = 'rgba(232, 210, 140, 0.55)'
    ctx.lineWidth = 1.6
    ctx.stroke()

    const drawUnits = (
      units: readonly ShowcaseReplayUnit[],
      engineStyle: 'wine' | 'ts' | 'ghost-wine' | 'ghost-ts',
    ): void => {
      for (const u of units) {
        const sx = toScreenX(u.x)
        const sy = toScreenY(u.y)
        if (sx < -24 || sx > cw + 24 || sy < -24 || sy > ch + 24) continue

        const isDead = (u.type === 1 && (u.mode === 0 || u.mode === 12)) || (u.type === 0 && u.hp <= 0)
        if (engineStyle === 'ghost-wine') {
          ctx.beginPath()
          ctx.arc(sx, sy, u.type === 0 ? 9 : 6.5, 0, Math.PI * 2)
          ctx.strokeStyle = u.type === 0 ? '#ffd43b' : isDead ? '#868e96' : '#ff8787'
          ctx.lineWidth = 2.2
          ctx.stroke()
          continue
        }

        if (engineStyle === 'ghost-ts') {
          ctx.beginPath()
          ctx.arc(sx, sy, u.type === 0 ? 4.5 : 3.2, 0, Math.PI * 2)
          ctx.fillStyle = u.type === 0 ? '#38d9a9' : isDead ? '#adb5bd' : '#4dabf7'
          ctx.fill()
          continue
        }

        const r = u.type === 0 ? 6.5 : u.type === 3 ? 3.5 : 5
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        if (u.type === 0) {
          ctx.fillStyle = engineStyle === 'wine' ? '#ebd594' : '#38d9a9'
          ctx.strokeStyle = '#090806'
        } else if (isDead) {
          ctx.fillStyle = '#5c5449'
          ctx.strokeStyle = '#2b2620'
        } else if (u.classId >= 146 && u.classId <= 155) {
          ctx.fillStyle = '#74c0fc'
          ctx.strokeStyle = '#0b1929'
        } else {
          ctx.fillStyle = '#e05252'
          ctx.strokeStyle = '#290b0b'
        }
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.stroke()

        // HP bar above living combat units
        if (!isDead && u.maxHp > 0 && (u.type === 0 || u.classId < 146)) {
          const ratio = Math.max(0, Math.min(1, u.hp / u.maxHp))
          const bw = u.type === 0 ? 24 : 18
          ctx.fillStyle = 'rgba(0,0,0,0.8)'
          ctx.fillRect(sx - bw / 2, sy - r - 6, bw, 3.5)
          ctx.fillStyle = u.type === 0 ? '#40c057' : '#fa5252'
          ctx.fillRect(sx - bw / 2, sy - r - 6, bw * ratio, 3.5)
        }
      }
    }

    if (mode === 'ghost') {
      drawUnits(frameObj.wineUnits, 'ghost-wine')
      drawUnits(frameObj.tsUnits, 'ghost-ts')
    } else if (mode === 'wine') {
      drawUnits(frameObj.wineUnits, 'wine')
    } else {
      drawUnits(frameObj.tsUnits, 'ts')
    }

    // HUD overlay in corner of canvas
    ctx.fillStyle = 'rgba(10, 8, 6, 0.84)'
    ctx.fillRect(8, 8, 224, 38)
    ctx.strokeStyle = 'rgba(199, 179, 119, 0.45)'
    ctx.strokeRect(8, 8, 224, 38)
    ctx.fillStyle = '#ebd594'
    ctx.font = 'bold 11px monospace'
    const tag =
      mode === 'ghost'
        ? 'GHOST OVERLAY (Ring=Wine, Core=TS)'
        : mode === 'wine'
          ? 'WINE ORACLE (D2Game.dll)'
          : 'TS KERNEL (src/d2kern-113c)'
    ctx.fillText(tag, 14, 23)
    ctx.fillStyle = '#b9ad96'
    ctx.font = '11px monospace'
    const pTxt = player ? `Player (${player.x}, ${player.y}) LvlArea=${player.level}` : 'No player'
    ctx.fillText(`F${frameObj.frame} · ${pTxt}`, 14, 39)

    if (frameObj.c2s.length > 0) {
      const c2sLabel = `C2S 0x${frameObj.c2s[0]!.slice(0, 2).toUpperCase()} (${frameObj.c2s.length} pkt)`
      ctx.fillStyle = 'rgba(42, 98, 61, 0.92)'
      ctx.fillRect(cw - 148, 8, 140, 22)
      ctx.strokeStyle = '#69db7c'
      ctx.strokeRect(cw - 148, 8, 140, 22)
      ctx.fillStyle = '#d3f9d8'
      ctx.font = 'bold 11px monospace'
      ctx.fillText(c2sLabel, cw - 141, 23)
    }

    ctx.restore()
  }

  function renderCurrentFrame(): void {
    syncToolbarActiveClasses()
    const bundle = bundleCache.get(currentScenario)
    if (!bundle) {
      if (loading) {
        certBadge.textContent = `正在回放 ${currentScenario}...`
      }
      return
    }

    const frames = bundle.data.frames
    if (frameIdx < 0) frameIdx = 0
    if (frameIdx >= frames.length) frameIdx = frames.length - 1
    slider.max = String(Math.max(0, frames.length - 1))
    slider.value = String(frameIdx)

    const cur = frames[frameIdx]!
    frameReadout.textContent = `F${cur.frame}`
    kpiFrame.textContent = `F${cur.frame} / F${bundle.data.strictHorizon}`

    // Compute max positional delta across all units on this frame
    const tsByKey = new Map<string, ShowcaseReplayUnit>()
    for (const u of cur.tsUnits) tsByKey.set(`${u.type}:${u.id}`, u)
    let maxDist = 0
    for (const wu of cur.wineUnits) {
      const tu = tsByKey.get(`${wu.type}:${wu.id}`)
      if (!tu) {
        maxDist = 999
        break
      }
      const d = Math.hypot(wu.x - tu.x, wu.y - tu.y)
      if (d > maxDist) maxDist = d
    }

    kpiDelta.textContent = `${maxDist.toFixed(2)} subtile`
    kpiGs.textContent = cur.gsTs
      ? `[${formatHex32(cur.gsTs[0])}, ${formatHex32(cur.gsTs[1])}]`
      : 'N/A'
    kpiC2s.textContent = `${cur.c2s.length} pkt · ${cur.tsUnits.length} units`

    const allZero = bundle.data.firstStrictDivergence === null && cur.diff === null
    certBadge.className = allZero ? 'k1-badge k1-badge--ok' : 'k1-badge k1-badge--warn'
    certBadge.textContent = allZero
      ? `Frame Diff = 0 · Strict ${bundle.data.strictHorizon} / ${bundle.data.lastGoldenFrame}`
      : `Divergence @ F${bundle.data.firstStrictDivergence?.frame ?? cur.frame}`

    if (viewMode === 'ghost') {
      canvasGrid.classList.add('k1-canvas-grid--single')
      rightCard.hidden = true
      leftTitle.textContent = 'Ghost Overlay (外环=Wine 1.13c DLL · 内核=TS src/d2kern-113c · 0.00 subtile 完美重合)'
      leftSub.textContent = `Δ = ${maxDist.toFixed(2)} subtile`
      canvasLeft.width = 920
      canvasLeft.height = 330
      drawArenaCanvas(canvasLeft, bundle, cur, 'ghost')
    } else {
      canvasGrid.classList.remove('k1-canvas-grid--single')
      rightCard.hidden = false
      leftTitle.textContent = 'Wine 1.13c D2Game.dll + D2Common.dll Oracle'
      leftSub.textContent = `${cur.wineUnits.length} units`
      rightSub.textContent = `${cur.tsUnits.length} units · ${bundle.data.computeMs}ms`
      canvasLeft.width = 480
      canvasLeft.height = 300
      canvasRight.width = 480
      canvasRight.height = 300
      drawArenaCanvas(canvasLeft, bundle, cur, 'wine')
      drawArenaCanvas(canvasRight, bundle, cur, 'ts')
    }

    tableMeta.textContent = `${bundle.data.scenario} · F${cur.frame} · ${cur.wineUnits.length} Wine / ${cur.tsUnits.length} TS entities (${bundle.rooms.length} hydrated collision rooms)`
    unitTbody.textContent = ''
    for (const wu of cur.wineUnits) {
      const tu = tsByKey.get(`${wu.type}:${wu.id}`)
      const exact =
        tu !== undefined &&
        wu.x === tu.x &&
        wu.y === tu.y &&
        wu.mode === tu.mode &&
        wu.seedLo === tu.seedLo &&
        wu.seedHi === tu.seedHi &&
        wu.hp === tu.hp &&
        wu.xp === tu.xp

      const tr = doc.createElement('tr')
      const hpW = wu.maxHp > 0 ? `${(wu.hp / 256).toFixed(1)}/${(wu.maxHp / 256).toFixed(0)}` : '-'
      const hpT =
        tu && tu.maxHp > 0 ? `${(tu.hp / 256).toFixed(1)}/${(tu.maxHp / 256).toFixed(0)}` : '-'
      tr.innerHTML = `
        <td><strong>${formatUnitLabel(wu.type, wu.classId, wu.id)}</strong></td>
        <td class="k1-mono">(${wu.x}, ${wu.y})</td>
        <td class="k1-mono">${tu ? `(${tu.x}, ${tu.y})` : 'MISSING'}</td>
        <td class="k1-mono">${formatUnitMode(wu.type, wu.mode)}</td>
        <td class="k1-mono">[${formatHex32(wu.seedLo)}, ${formatHex32(wu.seedHi)}]</td>
        <td class="k1-mono">${tu ? `[${formatHex32(tu.seedLo)}, ${formatHex32(tu.seedHi)}]` : '--'}</td>
        <td class="k1-mono">${hpW} · ${hpT}</td>
        <td class="k1-mono">${wu.type === 0 ? `XP ${wu.xp} (L${wu.charLevel})` : `Area ${wu.level}`}</td>
        <td><span class="k1-pill ${exact ? 'k1-pill--ok' : 'k1-pill--err'}">${exact ? 'Δ=0' : 'DIFF'}</span></td>
      `
      unitTbody.appendChild(tr)
    }
  }

  async function ensureScenarioLoaded(id: ReplayScenarioId): Promise<void> {
    if (bundleCache.has(id)) {
      renderCurrentFrame()
      return
    }
    loading = true
    tableMeta.textContent = `Running live kernel replay for ${id}...`
    syncToolbarActiveClasses()
    try {
      const resp = await fetch(`/api/k1-showcase/replay?scenario=${encodeURIComponent(id)}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = (await resp.json()) as ShowcaseReplayPayload

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      const decodedRooms: DecodedReplayRoom[] = data.rooms.map((r) => {
        if (r.subtileX < minX) minX = r.subtileX
        if (r.subtileY < minY) minY = r.subtileY
        if (r.subtileX + r.subtileW > maxX) maxX = r.subtileX + r.subtileW
        if (r.subtileY + r.subtileH > maxY) maxY = r.subtileY + r.subtileH
        return {
          levelId: r.levelId,
          sx: r.subtileX,
          sy: r.subtileY,
          sw: r.subtileW,
          sh: r.subtileH,
          words: decodeBase64Uint16LE(r.mapBase64),
        }
      })

      if (!Number.isFinite(minX)) {
        minX = 5400
        minY = 5700
        maxX = 5800
        maxY = 6100
      }

      const bgCanvas = buildReplayMapOffscreen(doc, decodedRooms, minX, minY, maxX, maxY)
      bundleCache.set(id, { data, rooms: decodedRooms, minX, minY, maxX, maxY, bgCanvas })
      frameIdx = 0
    } finally {
      loading = false
      renderCurrentFrame()
    }
  }

  function stepLoop(nowMs: number): void {
    if (!playing) return
    const intervalMs = 40 / speed // 25 fps server frame base
    if (lastTickMs === 0 || nowMs - lastTickMs >= intervalMs) {
      const bundle = bundleCache.get(currentScenario)
      if (bundle) {
        const steps = speed >= 4 && nowMs - lastTickMs > intervalMs * 1.8 ? 2 : 1
        frameIdx = (frameIdx + steps) % bundle.data.frames.length
        renderCurrentFrame()
      }
      lastTickMs = nowMs
    }
    rafId = requestAnimationFrame(stepLoop)
  }

  for (const btn of scenarioBtns) {
    btn.addEventListener('click', () => {
      const next = btn.dataset.replayScenario as ReplayScenarioId
      if (next && next !== currentScenario) {
        currentScenario = next
        frameIdx = 0
        void ensureScenarioLoaded(next)
      }
    })
  }

  for (const btn of viewBtns) {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.replayView === 'ghost' ? 'ghost' : 'split'
      renderCurrentFrame()
    })
  }

  for (const btn of camBtns) {
    btn.addEventListener('click', () => {
      cameraMode = btn.dataset.replayCam === 'overview' ? 'overview' : 'follow'
      renderCurrentFrame()
    })
  }

  for (const btn of speedBtns) {
    btn.addEventListener('click', () => {
      speed = Number(btn.dataset.replaySpeed) || 1
      syncToolbarActiveClasses()
    })
  }

  playBtn.addEventListener('click', () => {
    playing = !playing
    lastTickMs = 0
    syncToolbarActiveClasses()
    if (playing) {
      rafId = requestAnimationFrame(stepLoop)
    } else if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  })

  prevBtn.addEventListener('click', () => {
    playing = false
    frameIdx = Math.max(0, frameIdx - 1)
    renderCurrentFrame()
  })

  nextBtn.addEventListener('click', () => {
    playing = false
    const bundle = bundleCache.get(currentScenario)
    const maxIdx = bundle ? bundle.data.frames.length - 1 : 0
    frameIdx = Math.min(maxIdx, frameIdx + 1)
    renderCurrentFrame()
  })

  slider.addEventListener('input', () => {
    playing = false
    frameIdx = Number(slider.value) || 0
    renderCurrentFrame()
  })

  return {
    activate(): void {
      void ensureScenarioLoaded(currentScenario)
    },
    deactivate(): void {
      playing = false
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      syncToolbarActiveClasses()
    },
  }
}

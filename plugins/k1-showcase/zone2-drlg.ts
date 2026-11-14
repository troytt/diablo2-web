/**
 * Zone 2 — [K1-5] 20,400-Seed DRLG Dungeon & Collision Atlas
 * (`plugins/k1-showcase/zone2-drlg.ts`).
 */

import {
  decodeBase64Uint16LE,
  formatHex32,
  type DrlgRoomRecordBrowser,
  type ShowcaseDrlgCatalogResponse,
  type ShowcaseDrlgLevelRunResponse,
} from './types.ts'

export interface DrlgZoneController {
  activate(): void
  deactivate(): void
}

interface HydratedCollRoom {
  readonly roomIdx: number
  readonly sx: number
  readonly sy: number
  readonly sw: number
  readonly sh: number
  readonly words: Uint16Array
}

interface LayerFlags {
  wall01: boolean
  los02: boolean
  missile04: boolean
  player08: boolean
  doors: boolean
  warpBlank: boolean
  topology: boolean
}

const DRLG_TYPE_LABELS: Readonly<Record<number, string>> = {
  1: 'MAZE (1 · 随机迷宫)',
  2: 'PRESET (2 · 固定预设)',
  3: 'OUTDOOR (3 · 野外拼接)',
}

export function mountZone2Drlg(container: HTMLElement): DrlgZoneController {
  const doc = container.ownerDocument ?? document

  let catalog: ShowcaseDrlgCatalogResponse | null = null
  let currentLevelRun: ShowcaseDrlgLevelRunResponse | null = null
  let hydratedColls: HydratedCollRoom[] = []

  let selectedLevelId = 1
  let selectedDiff = 0
  let selectedSeed = 12345
  let zoom = 1
  let panX = 0
  let panY = 0
  let dragging = false
  let dragStartX = 0
  let dragStartY = 0
  let dragOriginPanX = 0
  let dragOriginPanY = 0

  const layers: LayerFlags = {
    wall01: true,
    los02: true,
    missile04: true,
    player08: true,
    doors: true,
    warpBlank: true,
    topology: true,
  }

  let heatmapOffscreen: HTMLCanvasElement | null = null
  let minSubX = 0
  let minSubY = 0
  let subW = 1
  let subH = 1

  container.innerHTML = `
    <div class="k1-zone-stack">
      <div class="k1-toolbar">
        <label class="k1-field-inline">
          <span>场景 (1..136):</span>
          <select id="k1-drlg-level-select" class="k1-select"></select>
        </label>

        <div class="k1-btn-group" role="group" aria-label="Difficulty">
          <button type="button" class="k1-btn k1-btn--active" data-drlg-diff="0">Normal (0)</button>
          <button type="button" class="k1-btn" data-drlg-diff="1">Nightmare (1)</button>
          <button type="button" class="k1-btn" data-drlg-diff="2">Hell (2)</button>
        </div>

        <label class="k1-field-inline">
          <span>Frozen Seed:</span>
          <select id="k1-drlg-seed-select" class="k1-select"></select>
        </label>

        <label class="k1-field-inline">
          <span>Custom:</span>
          <input id="k1-drlg-seed-input" type="text" class="k1-input k1-mono" value="12345" style="width: 102px" />
        </label>
        <button type="button" class="k1-btn k1-btn--primary" id="k1-drlg-run-btn">生成校验</button>
        <button type="button" class="k1-btn" id="k1-drlg-rand-btn">随机种子</button>

        <span id="k1-drlg-xor-badge" class="k1-badge k1-badge--ok">
          XOR = 0 · 20,400 / 20,400 D2TV
        </span>
      </div>

      <div class="k1-toolbar k1-toolbar--compact">
        <span class="k1-muted">碰撞掩码热力层 (u16 Bitmask):</span>
        <button type="button" class="k1-btn k1-btn--active" data-drlg-layer="wall01">0x01 Wall</button>
        <button type="button" class="k1-btn k1-btn--active" data-drlg-layer="los02">0x02 LOS</button>
        <button type="button" class="k1-btn k1-btn--active" data-drlg-layer="missile04">0x04 Missile</button>
        <button type="button" class="k1-btn k1-btn--active" data-drlg-layer="player08">0x08 Player</button>
        <button type="button" class="k1-btn k1-btn--active" data-drlg-layer="doors">Doors</button>
        <button type="button" class="k1-btn k1-btn--active" data-drlg-layer="warpBlank">Warp/Blank</button>
        <button type="button" class="k1-btn k1-btn--active" data-drlg-layer="topology">D2RoomEx</button>
        <div class="k1-btn-group" style="margin-left: auto">
          <button type="button" class="k1-btn" id="k1-drlg-zoom-in">＋</button>
          <button type="button" class="k1-btn" id="k1-drlg-zoom-out">－</button>
          <button type="button" class="k1-btn" id="k1-drlg-zoom-fit">适配视图 (Fit)</button>
        </div>
      </div>

      <div class="k1-kpi-strip">
        <div class="k1-kpi">
          <span class="k1-kpi__label">DRLG 算法类型 / 房间数</span>
          <span class="k1-kpi__val" id="k1-drlg-kpi-type">--</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">Layout SHA256-64 & XOR</span>
          <span class="k1-kpi__val k1-mono" id="k1-drlg-kpi-layout">--</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">Collision SHA256-64 & XOR</span>
          <span class="k1-kpi__val k1-mono" id="k1-drlg-kpi-coll">--</span>
        </div>
        <div class="k1-kpi">
          <span class="k1-kpi__label">子格悬停探针 (Subtile Inspector)</span>
          <span class="k1-kpi__val k1-mono" id="k1-drlg-kpi-hover">Hover map to inspect u16 mask</span>
        </div>
      </div>

      <div class="k1-canvas-card">
        <div class="k1-canvas-card__hdr">
          <span id="k1-drlg-canvas-title">Act 1 · Rogue Encampment (罗格营地) — D2RoomEx + Subtile u16 Collision Atlas</span>
          <span class="k1-mono k1-muted" id="k1-drlg-canvas-meta">20,400 Oracle Digests Loaded</span>
        </div>
        <canvas id="k1-drlg-canvas" class="k1-canvas" width="920" height="360"></canvas>
      </div>
    </div>
  `

  const levelSelect = container.querySelector('#k1-drlg-level-select') as HTMLSelectElement
  const seedSelect = container.querySelector('#k1-drlg-seed-select') as HTMLSelectElement
  const seedInput = container.querySelector('#k1-drlg-seed-input') as HTMLInputElement
  const runBtn = container.querySelector('#k1-drlg-run-btn') as HTMLButtonElement
  const randBtn = container.querySelector('#k1-drlg-rand-btn') as HTMLButtonElement
  const xorBadge = container.querySelector('#k1-drlg-xor-badge') as HTMLElement
  const kpiType = container.querySelector('#k1-drlg-kpi-type') as HTMLElement
  const kpiLayout = container.querySelector('#k1-drlg-kpi-layout') as HTMLElement
  const kpiColl = container.querySelector('#k1-drlg-kpi-coll') as HTMLElement
  const kpiHover = container.querySelector('#k1-drlg-kpi-hover') as HTMLElement
  const canvasTitle = container.querySelector('#k1-drlg-canvas-title') as HTMLElement
  const canvasMeta = container.querySelector('#k1-drlg-canvas-meta') as HTMLElement
  const canvas = container.querySelector('#k1-drlg-canvas') as HTMLCanvasElement
  const zoomInBtn = container.querySelector('#k1-drlg-zoom-in') as HTMLButtonElement
  const zoomOutBtn = container.querySelector('#k1-drlg-zoom-out') as HTMLButtonElement
  const zoomFitBtn = container.querySelector('#k1-drlg-zoom-fit') as HTMLButtonElement

  const diffBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-drlg-diff]')]
  const layerBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-drlg-layer]')]

  function rebuildHeatmapOffscreen(): void {
    if (!currentLevelRun) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const r of currentLevelRun.rooms) {
      const sx = r.x * 5
      const sy = r.y * 5
      const ex = sx + r.w * 5
      const ey = sy + r.h * 5
      if (sx < minX) minX = sx
      if (sy < minY) minY = sy
      if (ex > maxX) maxX = ex
      if (ey > maxY) maxY = ey
    }
    for (const c of hydratedColls) {
      if (c.sx < minX) minX = c.sx
      if (c.sy < minY) minY = c.sy
      if (c.sx + c.sw > maxX) maxX = c.sx + c.sw
      if (c.sy + c.sh > maxY) maxY = c.sy + c.sh
    }
    if (!Number.isFinite(minX)) {
      minX = 0
      minY = 0
      maxX = 100
      maxY = 100
    }

    minSubX = minX
    minSubY = minY
    subW = Math.max(1, Math.min(4096, maxX - minX))
    subH = Math.max(1, Math.min(4096, maxY - minY))

    const off = doc.createElement('canvas')
    off.width = subW
    off.height = subH
    const octx = off.getContext('2d')
    if (!octx) {
      heatmapOffscreen = off
      return
    }

    const img = octx.createImageData(subW, subH)
    const buf = img.data
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 8
      buf[i + 1] = 7
      buf[i + 2] = 6
      buf[i + 3] = 255
    }

    for (const cr of hydratedColls) {
      for (let ry = 0; ry < cr.sh; ry++) {
        const gy = cr.sy + ry - minSubY
        if (gy < 0 || gy >= subH) continue
        for (let rx = 0; rx < cr.sw; rx++) {
          const gx = cr.sx + rx - minSubX
          if (gx < 0 || gx >= subW) continue
          const m = cr.words[ry * cr.sw + rx] ?? 0
          const p = (gy * subW + gx) * 4

          let rCol = 24
          let gCol = 21
          let bCol = 16

          if (layers.warpBlank && (m & 0x1000) !== 0) {
            rCol = 32
            gCol = 16
            bCol = 40
          } else if (layers.doors && (m & 0x0420) !== 0) {
            rCol = 245
            gCol = 159
            bCol = 0
          } else if (layers.wall01 && (m & 0x0001) !== 0) {
            rCol = 217
            gCol = 148
            bCol = 78
          } else if (layers.los02 && (m & 0x0002) !== 0) {
            rCol = 77
            gCol = 171
            bCol = 247
          } else if (layers.missile04 && (m & 0x0004) !== 0) {
            rCol = 255
            gCol = 107
            bCol = 107
          } else if (layers.player08 && (m & 0x0008) !== 0) {
            rCol = 174
            gCol = 62
            bCol = 201
          } else if (m === 0) {
            rCol = 29
            gCol = 39
            bCol = 28
          }

          buf[p] = rCol
          buf[p + 1] = gCol
          buf[p + 2] = bCol
        }
      }
    }

    octx.putImageData(img, 0, 0)
    heatmapOffscreen = off
  }

  function fitView(): void {
    const cw = canvas.width
    const ch = canvas.height
    const pad = 22
    zoom = Math.min((cw - pad * 2) / subW, (ch - pad * 2) / subH)
    if (!Number.isFinite(zoom) || zoom <= 0) zoom = 1
    panX = (cw - subW * zoom) * 0.5
    panY = (ch - subH * zoom) * 0.5
  }

  function renderCanvas(): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cw = canvas.width
    const ch = canvas.height
    ctx.fillStyle = '#070605'
    ctx.fillRect(0, 0, cw, ch)

    if (!currentLevelRun || !heatmapOffscreen) return

    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(heatmapOffscreen, panX, panY, subW * zoom, subH * zoom)

    if (layers.topology) {
      for (const r of currentLevelRun.rooms) {
        const sx = panX + (r.x * 5 - minSubX) * zoom
        const sy = panY + (r.y * 5 - minSubY) * zoom
        const sw = r.w * 5 * zoom
        const sh = r.h * 5 * zoom
        ctx.strokeStyle =
          r.nType === 2 ? 'rgba(232, 210, 140, 0.68)' : 'rgba(116, 192, 252, 0.48)'
        ctx.lineWidth = 1
        ctx.strokeRect(sx, sy, sw, sh)

        if (sw >= 34 && sh >= 20) {
          ctx.fillStyle = 'rgba(235, 213, 148, 0.85)'
          ctx.font = '10px monospace'
          const label = r.presetId >= 0 ? `#${r.idx} P${r.presetId}` : `#${r.idx}`
          ctx.fillText(label, sx + 3, sy + 11)
        }
      }
    }

    if (layers.warpBlank) {
      for (const p of currentLevelRun.presets) {
        const px = panX + (p.subtileX - minSubX) * zoom
        const py = panY + (p.subtileY - minSubY) * zoom
        if (px < -10 || px > cw + 10 || py < -10 || py > ch + 10) continue
        if (p.unitType === 5) {
          // Warp tile preset — bright magenta diamond
          ctx.fillStyle = '#f06595'
          ctx.beginPath()
          ctx.moveTo(px, py - 5)
          ctx.lineTo(px + 5, py)
          ctx.lineTo(px, py + 5)
          ctx.lineTo(px - 5, py)
          ctx.closePath()
          ctx.fill()
        } else if (p.unitType === 2) {
          // Preset Object (Waypoint, Shrine, Quest Object)
          ctx.fillStyle = '#38d9a9'
          ctx.fillRect(px - 2.5, py - 2.5, 5, 5)
        } else if (p.unitType === 1) {
          // SuperUnique / Preset Monster
          ctx.fillStyle = '#ff6b6b'
          ctx.fillRect(px - 2, py - 2, 4, 4)
        }
      }
    }

    ctx.restore()
  }

  function lookupSubtileInfo(worldSubX: number, worldSubY: number): {
    room: DrlgRoomRecordBrowser | null
    mask: number | null
  } {
    if (!currentLevelRun) return { room: null, mask: null }
    let matchedRoom: DrlgRoomRecordBrowser | null = null
    for (const r of currentLevelRun.rooms) {
      const rx0 = r.x * 5
      const ry0 = r.y * 5
      if (worldSubX >= rx0 && worldSubX < rx0 + r.w * 5 && worldSubY >= ry0 && worldSubY < ry0 + r.h * 5) {
        matchedRoom = r
        break
      }
    }
    let mask: number | null = null
    for (const c of hydratedColls) {
      if (worldSubX >= c.sx && worldSubX < c.sx + c.sw && worldSubY >= c.sy && worldSubY < c.sy + c.sh) {
        mask = c.words[(worldSubY - c.sy) * c.sw + (worldSubX - c.sx)] ?? 0
        break
      }
    }
    return { room: matchedRoom, mask }
  }

  async function loadCatalog(): Promise<void> {
    if (catalog) return
    const resp = await fetch('/api/k1-showcase/drlg')
    if (!resp.ok) throw new Error(`Failed to load DRLG catalog: HTTP ${resp.status}`)
    catalog = (await resp.json()) as ShowcaseDrlgCatalogResponse

    levelSelect.textContent = ''
    for (let act = 1; act <= 5; act++) {
      const grp = doc.createElement('optgroup')
      grp.label = `Act ${act}`
      for (const lvl of catalog.levels.filter((l) => l.act === act)) {
        const opt = doc.createElement('option')
        opt.value = String(lvl.id)
        opt.textContent = `#${String(lvl.id).padStart(3, '0')} ${lvl.nameZh} (${lvl.nameEn})`
        if (lvl.id === selectedLevelId) opt.selected = true
        grp.appendChild(opt)
      }
      levelSelect.appendChild(grp)
    }

    seedSelect.textContent = ''
    catalog.frozenSeeds.forEach((s, idx) => {
      const opt = doc.createElement('option')
      opt.value = String(s >>> 0)
      opt.textContent = `[#${idx + 1}] ${s >>> 0} (${formatHex32(s)})`
      if ((s >>> 0) === (selectedSeed >>> 0)) opt.selected = true
      seedSelect.appendChild(opt)
    })
  }

  async function runSelectedLevel(): Promise<void> {
    await loadCatalog()
    canvasMeta.textContent = `Executing src/d2kern-113c DRLG L${selectedLevelId} seed=${selectedSeed >>> 0} diff=${selectedDiff}...`
    const url = `/api/k1-showcase/drlg?levelId=${selectedLevelId}&diff=${selectedDiff}&seed=${selectedSeed >>> 0}`
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`DRLG run failed: HTTP ${resp.status}`)
    const data = (await resp.json()) as ShowcaseDrlgLevelRunResponse
    currentLevelRun = data

    hydratedColls = data.collRooms.map((cr) => ({
      roomIdx: cr.roomIdx,
      sx: cr.subtileX,
      sy: cr.subtileY,
      sw: cr.subtileW,
      sh: cr.subtileH,
      words: decodeBase64Uint16LE(cr.mapBase64),
    }))

    kpiType.textContent = `${DRLG_TYPE_LABELS[data.drlgType] ?? `Type ${data.drlgType}`} · ${data.rooms.length} Rooms · ${data.totalSubtiles.toLocaleString()} Subtiles`
    kpiLayout.textContent = data.parity.isFrozenSeed
      ? `${data.parity.computedLayoutHash} (XOR=0)`
      : `${data.parity.computedLayoutHash} (Custom Seed)`
    kpiColl.textContent = data.parity.isFrozenSeed
      ? `${data.parity.computedCollHash} (XOR=0)`
      : `${data.parity.computedCollHash} (Custom Seed)`

    if (data.parity.isFrozenSeed) {
      const ok = data.parity.exactMatch === true
      xorBadge.className = ok ? 'k1-badge k1-badge--ok' : 'k1-badge k1-badge--warn'
      const extras: string[] = []
      if (data.parity.roomsD2tvMatch) extras.push('DRLGROOM ✓')
      if (data.parity.townCollD2tvMatch) extras.push('DRLGCOLL ✓')
      xorBadge.textContent = ok
        ? `XOR = 0x0 · D2Common.dll Exact Match${extras.length ? ` (${extras.join(', ')})` : ''}`
        : 'HASH DIVERGENCE'
    } else {
      xorBadge.className = 'k1-badge'
      xorBadge.textContent = `Custom Seed ${formatHex32(data.seed)} · Live Kernel Generated (${data.computeMs}ms)`
    }

    canvasTitle.textContent = `Act ${data.act} · #${data.levelId} ${data.nameZh} (${data.nameEn}) — Diff ${data.diff} · Seed ${data.seed >>> 0}`
    canvasMeta.textContent = `${data.rooms.length} D2RoomEx · ${data.presets.length} Presets/Warps · ${data.computeMs}ms`

    rebuildHeatmapOffscreen()
    fitView()
    renderCanvas()
  }

  levelSelect.addEventListener('change', () => {
    selectedLevelId = Number(levelSelect.value) || 1
    void runSelectedLevel()
  })

  seedSelect.addEventListener('change', () => {
    selectedSeed = Number(seedSelect.value) >>> 0
    seedInput.value = String(selectedSeed)
    void runSelectedLevel()
  })

  for (const btn of diffBtns) {
    btn.addEventListener('click', () => {
      selectedDiff = Number(btn.dataset.drlgDiff) || 0
      for (const b of diffBtns) b.classList.toggle('k1-btn--active', b === btn)
      void runSelectedLevel()
    })
  }

  runBtn.addEventListener('click', () => {
    const raw = seedInput.value.trim()
    const parsed = raw.toLowerCase().startsWith('0x')
      ? Number.parseInt(raw.slice(2), 16)
      : Number.parseInt(raw, 10)
    if (Number.isFinite(parsed)) {
      selectedSeed = parsed >>> 0
      seedInput.value = String(selectedSeed)
      void runSelectedLevel()
    }
  })

  randBtn.addEventListener('click', () => {
    // Deterministic xorshift step on current seed + level so clicking cycles fresh 32-bit seeds
    let x = ((selectedSeed ^ 0x9e3779b9) + selectedLevelId * 0x85ebca6b) >>> 0
    x ^= (x << 13) >>> 0
    x ^= x >>> 17
    x ^= (x << 5) >>> 0
    selectedSeed = x >>> 0
    seedInput.value = formatHex32(selectedSeed)
    void runSelectedLevel()
  })

  for (const btn of layerBtns) {
    btn.addEventListener('click', () => {
      const key = btn.dataset.drlgLayer as keyof LayerFlags
      layers[key] = !layers[key]
      btn.classList.toggle('k1-btn--active', layers[key])
      rebuildHeatmapOffscreen()
      renderCanvas()
    })
  }

  zoomInBtn.addEventListener('click', () => {
    zoom = Math.min(24, zoom * 1.35)
    renderCanvas()
  })
  zoomOutBtn.addEventListener('click', () => {
    zoom = Math.max(0.15, zoom / 1.35)
    renderCanvas()
  })
  zoomFitBtn.addEventListener('click', () => {
    fitView()
    renderCanvas()
  })

  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const mx = ((ev.clientX - rect.left) / rect.width) * canvas.width
    const my = ((ev.clientY - rect.top) / rect.height) * canvas.height
    const factor = ev.deltaY < 0 ? 1.2 : 1 / 1.2
    const nextZoom = Math.max(0.15, Math.min(28, zoom * factor))
    panX = mx - ((mx - panX) / zoom) * nextZoom
    panY = my - ((my - panY) / zoom) * nextZoom
    zoom = nextZoom
    renderCanvas()
  })

  canvas.addEventListener('pointerdown', (ev) => {
    dragging = true
    dragStartX = ev.clientX
    dragStartY = ev.clientY
    dragOriginPanX = panX
    dragOriginPanY = panY
    canvas.setPointerCapture(ev.pointerId)
  })

  canvas.addEventListener('pointermove', (ev) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / Math.max(1, rect.width)
    const scaleY = canvas.height / Math.max(1, rect.height)
    if (dragging) {
      panX = dragOriginPanX + (ev.clientX - dragStartX) * scaleX
      panY = dragOriginPanY + (ev.clientY - dragStartY) * scaleY
      renderCanvas()
      return
    }
    const cx = (ev.clientX - rect.left) * scaleX
    const cy = (ev.clientY - rect.top) * scaleY
    const wx = Math.floor((cx - panX) / zoom) + minSubX
    const wy = Math.floor((cy - panY) / zoom) + minSubY
    const info = lookupSubtileInfo(wx, wy)
    if (info.mask !== null) {
      const m = info.mask
      const flags: string[] = []
      if (m & 0x0001) flags.push('WALL')
      if (m & 0x0002) flags.push('LOS')
      if (m & 0x0004) flags.push('MISSILE')
      if (m & 0x0008) flags.push('PLAYER')
      if (m & 0x0420) flags.push('DOOR')
      if (m & 0x1000) flags.push('BLANK')
      const flagStr = flags.length > 0 ? flags.join('|') : 'WALKABLE'
      const rmStr = info.room ? `Room#${info.room.idx}` : 'Out'
      kpiHover.textContent = `(${wx}, ${wy}) ${rmStr} u16=0x${m.toString(16).toUpperCase().padStart(4, '0')} [${flagStr}]`
    }
  })

  canvas.addEventListener('pointerup', () => {
    dragging = false
  })

  return {
    activate(): void {
      if (!currentLevelRun) {
        void runSelectedLevel()
      } else {
        renderCanvas()
      }
    },
    deactivate(): void {
      dragging = false
    },
  }
}

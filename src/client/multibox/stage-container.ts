/**
 * Scoped DOM stage container factory (`StageContainerRefs`) for single-Tab
 * multi-instance (`multibox`) architecture (#1362).
 *
 * Isolates each game instance's DOM subtree (`wrapperEl`, `stageEl`, `bnetShell`,
 * `bnetCanvas`, `playCanvas`, `hudCanvas`, `cursorCanvas`, `bootOverlay`,
 * `disconnectBannerEl`, and IME elements) inside `#play-workspace` so up to 8
 * instances can coexist in a single browser tab without global DOM ID collisions.
 */

export interface StageContainerRefs {
  readonly slotId: number;
  readonly wrapperEl: HTMLElement;
  readonly stageWrapperEl: HTMLElement;
  readonly stageEl: HTMLElement;
  readonly bnetShell: HTMLElement;
  readonly bnetCanvas: HTMLCanvasElement;
  readonly playCanvas: HTMLCanvasElement;
  readonly viewCanvas: HTMLCanvasElement;
  readonly hudCanvas: HTMLCanvasElement;
  readonly cursorCanvas: HTMLCanvasElement;
  readonly cursorLayerCanvas: HTMLCanvasElement | null;
  readonly bootOverlay: HTMLElement | null;
  readonly disconnectBannerEl: HTMLElement | null;
  readonly disconnectBanner: HTMLElement | null;
  setVisible(visible: boolean): void;
  destroy(): void;
}

/**
 * Adopts the existing `#play-stage-wrapper` for Slot 1 (if present and unclaimed)
 * or constructs a fresh scoped `.play-stage-wrapper[data-d2-slot-id="N"]` inside
 * `#play-workspace`.
 */
export function createStageContainer(
  slotId: number,
  workspaceEl?: HTMLElement | null,
): StageContainerRefs {
  const workspace =
    workspaceEl ??
    (typeof document !== 'undefined' ? document.getElementById('play-workspace') : null);

  if (slotId === 1 && typeof document !== 'undefined') {
    const existingWrapper = document.getElementById('play-stage-wrapper');
    if (existingWrapper && !existingWrapper.hasAttribute('data-d2-slot-id')) {
      existingWrapper.setAttribute('data-d2-slot-id', '1');
      existingWrapper.classList.add('play-stage-wrapper');

      const stageEl =
        (existingWrapper.querySelector('#play-stage, .play-stage') as HTMLElement | null) ??
        existingWrapper;
      stageEl.classList.add('play-stage');

      const bnetShell =
        (stageEl.querySelector('#bnet-shell, .bnet-shell') as HTMLElement | null) ??
        createFallbackBnetShell(stageEl);
      bnetShell.classList.add('bnet-shell');

      const bnetCanvas =
        (bnetShell.querySelector('#bnet-canvas, .bnet-canvas') as HTMLCanvasElement | null) ??
        createFallbackCanvas(bnetShell, 'bnet-canvas', 800, 600);
      bnetCanvas.classList.add('bnet-canvas');

      const playCanvas =
        (stageEl.querySelector(
          '#view, #play-view-canvas, .play-view-canvas',
        ) as HTMLCanvasElement | null) ??
        createFallbackCanvas(stageEl, 'play-view-canvas', 800, 600);
      playCanvas.classList.add('play-view-canvas');

      const hudCanvas =
        (stageEl.querySelector('#d2-hud-canvas, .d2-hud-canvas') as HTMLCanvasElement | null) ??
        createFallbackCanvas(stageEl, 'd2-hud-canvas', 800, 600);
      hudCanvas.classList.add('d2-hud-canvas');

      const cursorCanvas =
        (stageEl.querySelector('#d2-cursor-canvas, .d2-cursor-canvas') as HTMLCanvasElement | null) ??
        createFallbackCanvas(stageEl, 'd2-cursor-canvas', 800, 600);
      cursorCanvas.classList.add('d2-cursor-canvas');

      const bootOverlay = stageEl.querySelector(
        '#d2-boot-loading, .d2-boot-loading',
      ) as HTMLElement | null;
      if (bootOverlay) {
        bootOverlay.classList.add('d2-boot-loading');
      }

      const disconnectBannerEl = stageEl.querySelector(
        '#play-disconnect-banner, .play-disconnect-banner',
      ) as HTMLElement | null;
      if (disconnectBannerEl) {
        disconnectBannerEl.classList.add('play-disconnect-banner');
      }

      return {
        slotId: 1,
        wrapperEl: existingWrapper,
        stageWrapperEl: existingWrapper,
        stageEl,
        bnetShell,
        bnetCanvas,
        playCanvas,
        viewCanvas: playCanvas,
        hudCanvas,
        cursorCanvas,
        cursorLayerCanvas: cursorCanvas,
        bootOverlay,
        disconnectBannerEl,
        disconnectBanner: disconnectBannerEl,
        setVisible(visible: boolean): void {
          existingWrapper.style.display = visible ? 'flex' : 'none';
          if (existingWrapper.dataset) {
            existingWrapper.dataset.d2SlotActive = visible ? '1' : '0';
          }
        },
        destroy(): void {
          existingWrapper.removeAttribute('data-d2-slot-id');
        },
      };
    }
  }

  const suffix = slotId === 1 ? '' : `-slot-${String(slotId)}`;

  // Dynamic creation for Slot 2..8 (or when #play-stage-wrapper is not present in DOM)
  const wrapperEl = document.createElement('div');
  wrapperEl.id = `play-stage-wrapper${suffix}`;
  wrapperEl.className = 'play-stage-wrapper';
  wrapperEl.setAttribute('data-d2-slot-id', String(slotId));

  const stageEl = document.createElement('div');
  stageEl.id = `play-stage${suffix}`;
  stageEl.className = 'play-stage';
  wrapperEl.appendChild(stageEl);

  // Scoped boot loading overlay
  const bootOverlay = document.createElement('div');
  bootOverlay.id = `d2-boot-loading${suffix}`;
  bootOverlay.className = 'd2-boot-loading';
  bootOverlay.innerHTML = `
    <div class="d2-boot-panel">
      <div class="d2-boot-title">DIABLO II: LORD OF DESTRUCTION</div>
      <div class="d2-boot-subtitle">正在下载游戏资源 · LOADING RESOURCES</div>
      <div class="d2-boot-bar-bg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="d2-boot-bar-fill" style="width: 0%"></div>
        <div class="d2-boot-pct">0%</div>
      </div>
      <div class="d2-boot-meta">
        <span class="d2-boot-file-label">正在下载:</span>
        <span class="d2-boot-phase">正在初始化...</span>
        <span class="d2-boot-progress-count">(0/0)</span>
      </div>
    </div>
  `;
  stageEl.appendChild(bootOverlay);

  // Scoped bnet-shell + bnet-canvas
  const bnetShell = document.createElement('div');
  bnetShell.id = `bnet-shell${suffix}`;
  bnetShell.className = 'bnet-shell';
  const bnetCanvas = document.createElement('canvas');
  bnetCanvas.id = `bnet-canvas${suffix}`;
  bnetCanvas.className = 'bnet-canvas';
  bnetCanvas.width = 800;
  bnetCanvas.height = 600;
  bnetShell.appendChild(bnetCanvas);
  stageEl.appendChild(bnetShell);

  // Scoped play-view-canvas (WebGL2)
  const playCanvas = document.createElement('canvas');
  playCanvas.id = `view${suffix}`;
  playCanvas.className = 'play-view-canvas';
  playCanvas.width = 800;
  playCanvas.height = 600;
  stageEl.appendChild(playCanvas);

  // Scoped d2-hud-canvas (2D HUD)
  const hudCanvas = document.createElement('canvas');
  hudCanvas.id = `d2-hud-canvas${suffix}`;
  hudCanvas.className = 'd2-hud-canvas';
  hudCanvas.width = 800;
  hudCanvas.height = 600;
  stageEl.appendChild(hudCanvas);

  // Scoped d2-cursor-canvas (Software cursor)
  const cursorCanvas = document.createElement('canvas');
  cursorCanvas.id = `d2-cursor-canvas${suffix}`;
  cursorCanvas.className = 'd2-cursor-canvas';
  cursorCanvas.width = 800;
  cursorCanvas.height = 600;
  stageEl.appendChild(cursorCanvas);

  // Scoped disconnect banner
  const disconnectBannerEl = document.createElement('div');
  disconnectBannerEl.id = `play-disconnect-banner${suffix}`;
  disconnectBannerEl.className = 'play-disconnect-banner';
  disconnectBannerEl.hidden = true;
  stageEl.appendChild(disconnectBannerEl);

  if (workspace) {
    workspace.appendChild(wrapperEl);
  }

  return {
    slotId,
    wrapperEl,
    stageWrapperEl: wrapperEl,
    stageEl,
    bnetShell,
    bnetCanvas,
    playCanvas,
    viewCanvas: playCanvas,
    hudCanvas,
    cursorCanvas,
    cursorLayerCanvas: cursorCanvas,
    bootOverlay,
    disconnectBannerEl,
    disconnectBanner: disconnectBannerEl,
    setVisible(visible: boolean): void {
      wrapperEl.style.display = visible ? 'flex' : 'none';
      if (wrapperEl.dataset) {
        wrapperEl.dataset.d2SlotActive = visible ? '1' : '0';
      }
    },
    destroy(): void {
      wrapperEl.remove();
    },
  };
}

function createFallbackBnetShell(stageEl: HTMLElement): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'bnet-shell';
  stageEl.appendChild(shell);
  return shell;
}

function createFallbackCanvas(
  parentEl: HTMLElement,
  className: string,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.width = width;
  canvas.height = height;
  parentEl.appendChild(canvas);
  return canvas;
}

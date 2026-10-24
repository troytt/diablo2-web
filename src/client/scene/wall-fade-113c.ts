/**
 * Diablo II 1.13c upper-wall occlusion fade (`D2Client.dll`, ImageBase `0x6fab0000`) and
 * preset building POPS roof / wall fade & cutaway reveal (`D2Common.dll`, ImageBase `0x6fd50000`).
 *
 * Ground truth (issues #919, #1009):
 * 1. **Upper-wall occlusion fade (`0x6fb2a340` -> `0x6fb29f20`)**:
 *    - Per frame the client stores the local player's cell (`0x6fbc3b18 = pathX / 5`, `0x6fbc3b20 = pathY / 5`) and the
 *      `nIndex` of the logical-room coord list under the player (`0x6fbc3b1c = D2Common.#10916(room, x, y)`) —
 *      `0x6fb2ab9c..0x6fb2ac51`.
 *    - The upper-wall draw-entry builder `0x6fb2a340` runs the fade test `0x6fb29f20` for every wall tile whose
 *      `dwFlags & MAPTILE_TREES (0x4)` is clear. `0x6fb29f20` takes its first branch unconditionally (the gate
 *      `0x6fb924f4` is a static `1` with no writer in the image):
 *        `pList = tile->unk0x10; if (!pList || pList->nIndex == player index) return 0;`
 *        `return playerCellX < pList->pBox[0].nPosX || playerCellY < pList->pBox[0].nPosY`.
 *    - On a new fade the wall ramps alpha `0xff -> 0x80` (`[tile+0x29] = 0xff`, `[tile+0x2a] = 0x80`, flags `|= 3`); when
 *      the test turns false it ramps back `0x80 -> 0xff` (flags `= (flags & ~1) | 2`). The ramp end time is
 *      `GetTickCount() + 500`, shortened by `(alpha - from) * 500 / 127` when the ramp starts mid-way.
 * 2. **Preset building POPS (`D2Common.#10562` -> `DRLGPRESET_UpdatePops` `0x6fd5a6a0` -> `DRLGPRESET_TogglePopsVisibility` `0x6fd5a180`)**:
 *    - DS1 special tiles with orientation `8..11` (`((prop1 >> 2) & 0x3f) - 4 == nPopsIndex`, `prop3 == nPopsSubIndex`)
 *      define POPS bounding boxes `pPopsLocation[k]` on `D2DrlgMapStrc` (`0x6fd5a480`).
 *    - `DRLGPRESET_UpdatePops` (`0x6fd5a6a0`) checks whether the player's level-local sub-tile `(x, y)` falls inside
 *      `[5 * box.x, 5 * (box.x + box.width) + pad) x [5 * box.y, 5 * (box.y + box.height) + pad)` (first match wins,
 *      setting `activePopIndex = pPopsIndex[k]`). Every pop entry `j` in the map with `pPopsIndex[j] == activePopIndex`
 *      transitions to `bVisible = 0` (popped); all others transition to `bVisible = 1` (unpopped).
 *    - `DRLGPRESET_TogglePopsVisibility` (`0x6fd5a180`) iterates all wall/roof tiles in the 1-cell expanded box
 *      `[box.x - 1, box.x + box.width] x [box.y - 1, box.y + box.height]`:
 *      - Cutaway interior wall caps (`dwFlags & 0x200`, `revealHidden`):
 *        - `bVisible == 0` (popped): `unk0x24 &= ~4`, `dwFlags &= ~8` (immediately visible at alpha `0xff`).
 *        - `bVisible == 1` (unpopped): `unk0x24 |= 4`, `unk0x2C = now + 500` (stays visible for 500ms while the roof/wall
 *          fades back in, then `0x6fb4ec5f` / `0x6fb4ef9f` sets `dwFlags |= 8` and clears bit 2 once `now >= unk0x2C`).
 *      - Roofs (`nTileType == 15`) and pop-walls (`!(dwFlags & 0x300) && pTile->nStyle == pPopsSubIndex[j]`):
 *        - `bVisible == 0` (popped): `unk0x24 |= 2`, `from = 0xff`, `to = 0x00`, `end = now + 500 + cdiv(500 * (alpha - 255), 255)`.
 *        - `bVisible == 1` (unpopped): `dwFlags &= ~0x400`, `unk0x24 |= 2`, `from = 0x00`, `to = 0xff`, `end = now + 500 - cdiv(500 * alpha, 255)`.
 * 3. **Render passes (`0x6fac3a00` roofs, `0x6fb4ec10` lower walls, `0x6fb4ee90` upper walls)**:
 *    - Advance `[tile+0x28]` when `unk0x24 & 2`; set `dwFlags |= 0x400` when `alpha == 0` (`dwFlags &= ~0x400` when `alpha != 0`).
 *    - Set `dwFlags |= 0x8` when `(unk0x24 & 4) && now >= unk0x2C`.
 *    - Skip drawing when `(dwFlags & 0x408) != 0`.
 */

/** Opaque wall alpha (`[tile+0x28]` initial value, D2Common `0x6fd7e16b`). */
export const WALL_ALPHA_OPAQUE = 0xff
/** Faded wall alpha (`0x6fb2a3d4`: `mov byte [esi+0x2a], 0x80`). */
export const WALL_ALPHA_FADED = 0x80
/** Ramp duration in milliseconds (`0x6fb2a3a1` / `0x6fd5a6b7`: `GetTickCount() + 0x1f4`). */
export const WALL_FADE_RAMP_MS = 500

/** `[tile+0x24]` bit 0: the wall is (fading to) faded (`0x6fb8eef8` light table). */
const FADE_FLAG_FADED = 0x1
/** `[tile+0x24]` bit 1: an alpha ramp is in progress. */
const FADE_FLAG_RAMP = 0x2
/** `[tile+0x24]` bit 2: `0x200` cutaway wall 500ms delayed hide is in progress (`0x6fd5a22c`). */
const FADE_FLAG_REVEAL_HIDE = 0x4

/** The coord-list fields `0x6fb29f20` reads (`nIndex`, `pBox[0].nPosX/nPosY`). */
export interface WallFadeBoxInput {
  readonly index: number
  readonly x: number
  readonly y: number
}

/** The local player's fade inputs (`0x6fbc3b18`, `0x6fbc3b20`, `0x6fbc3b1c`). */
export interface WallFadePlayerInput {
  readonly cellX: number
  readonly cellY: number
  readonly logicalIndex: number
}

/** POPS bounding box input (`D2DrlgMapStrc::pPopsLocation` / `pPopsIndex` / `pPopsSubIndex` / `dwPopPad`). */
export interface PopBoxInput {
  readonly mapIndex: number
  readonly index: number
  readonly subIndex: number
  readonly pad: number
  readonly box: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
}

/** Tile quad fields read by `DRLGPRESET_TogglePopsVisibility` (`0x6fd5a180`). */
export interface PopTileInput {
  readonly cellX: number
  readonly cellY: number
  readonly library: number
  readonly tile: number
  readonly type?: number | undefined
  readonly style?: number | undefined
  readonly revealHidden?: boolean | undefined
  readonly popLinkage?: boolean | undefined
}

/** Result of advancing a POPS-controlled roof or wall tile for drawing. */
export interface PopTileSample {
  /** `true` when `(dwFlags & 0x408) === 0` (`0x6fac3b2f` / `0x6fb4ec65` / `0x6fb4efa9`). */
  readonly visible: boolean
  /** Draw alpha `0..255` (`[tile+0x28]`). */
  readonly alpha: number
}

/** C integer division (truncates toward zero), as the compiler's magic-number sequences do. */
function cdiv(a: number, b: number): number {
  return Math.trunc(a / b)
}

/**
 * `0x6fb29f20` (first branch): should this wall be faded for the player's current position?
 *
 * @param box - the wall's coord list (`tile->unk0x10`), `undefined` for NULL.
 * @param player - the local player's cell and logical-room index.
 */
export function wallOccludesPlayer113c(box: WallFadeBoxInput | undefined, player: WallFadePlayerInput): boolean {
  if (box === undefined) return false
  if (box.index === player.logicalIndex) return false
  return player.cellX < box.x || player.cellY < box.y
}

/** Persistent per-wall fade state: `[tile+0x24]` flags, `+0x28` alpha, `+0x29` from, `+0x2a` to, `+0x2c` end. */
export interface WallFadeState {
  flags: number
  alpha: number
  from: number
  to: number
  endMs: number
}

/** Persistent per-tile POPS state (`[tile+0x14]` hidden bits `0x408`, `[tile+0x24..0x2c]`). */
interface PopTileState {
  popped: boolean
  hidden: boolean
  flags: number
  alpha: number
  from: number
  to: number
  endMs: number
}

/** Per-pop-box trigger state (`D2DrlgMapStrc::pPops[j]`). */
interface PopBoxState {
  popped: boolean
  toggledAtMs: number
}

/** Result of advancing a wall's ramp for drawing. */
export interface WallFadeSample {
  /** Draw alpha `0..255` (`[tile+0x28]`). */
  readonly alpha: number
  /** `[tile+0x24] & 1`: use the faded wall light table `0x6fb8eef8`. */
  readonly faded: boolean
}

function advanceRampAlpha(st: { flags: number; alpha: number; from: number; to: number; endMs: number }, nowMs: number, ramp: boolean): void {
  if ((st.flags & FADE_FLAG_RAMP) === 0) return
  if (ramp && nowMs < st.endMs) {
    st.alpha = (st.from + cdiv((st.to - st.from) * (nowMs - st.endMs + WALL_FADE_RAMP_MS), WALL_FADE_RAMP_MS)) & 0xff
  } else {
    st.flags &= ~FADE_FLAG_RAMP
    st.alpha = st.to
  }
}

/**
 * Per-wall alpha state of the 1.13c occlusion fade and preset POPS visibility tracker.
 * One tracker per level view; call {@link reset} when the level changes (D2 rebuilds the tile data,
 * whose fade fields start at `0xff` / flags `0`).
 */
export class WallFadeTracker113c {
  private readonly states = new Map<string, WallFadeState>()
  private readonly popTileStates = new Map<string, PopTileState>()
  private popBoxesState: PopBoxState[] = []

  /** Forget every wall and POPS state (new level / act). */
  reset(): void {
    this.states.clear()
    this.popTileStates.clear()
    this.popBoxesState = []
  }

  /** Number of walls with non-default state (diagnostics / tests). */
  get size(): number {
    return this.states.size
  }

  /** Current state of a wall, if it was ever touched. */
  peek(key: string): Readonly<WallFadeState> | undefined {
    return this.states.get(key)
  }

  /**
   * `0x6fb2a3b6..0x6fb2a454`: feed this frame's fade test result for a wall (only for walls without
   * `MAPTILE_TREES`).
   */
  update(key: string, occludes: boolean, nowMs: number): void {
    let st = this.states.get(key)
    const end = nowMs + WALL_FADE_RAMP_MS
    if (occludes) {
      if (st !== undefined && (st.flags & FADE_FLAG_FADED) !== 0) return
      if (st === undefined) {
        st = { flags: 0, alpha: WALL_ALPHA_OPAQUE, from: WALL_ALPHA_OPAQUE, to: WALL_ALPHA_OPAQUE, endMs: 0 }
        this.states.set(key, st)
      }
      st.from = WALL_ALPHA_OPAQUE
      st.to = WALL_ALPHA_FADED
      st.endMs = st.alpha === WALL_ALPHA_OPAQUE ? end : cdiv((st.alpha - WALL_ALPHA_OPAQUE) * WALL_FADE_RAMP_MS, 127) + end
      st.flags |= FADE_FLAG_FADED | FADE_FLAG_RAMP
      return
    }
    if (st === undefined || (st.flags & FADE_FLAG_FADED) === 0) return
    st.from = WALL_ALPHA_FADED
    st.to = WALL_ALPHA_OPAQUE
    st.endMs = st.alpha === WALL_ALPHA_FADED ? end : cdiv((WALL_ALPHA_FADED - st.alpha) * WALL_FADE_RAMP_MS, 127) + end
    st.flags = (st.flags & ~FADE_FLAG_FADED) | FADE_FLAG_RAMP
  }

  /**
   * `0x6fb4ef21..0x6fb4ef7e`: advance the wall's ramp to `nowMs` and return its draw alpha.
   *
   * @param ramp - `true` in the 3D renderers (`0x6fba17c8 >= 4`); otherwise the target is applied at once.
   */
  sample(key: string, nowMs: number, ramp = true): WallFadeSample {
    const st = this.states.get(key)
    if (st === undefined) return { alpha: WALL_ALPHA_OPAQUE, faded: false }
    advanceRampAlpha(st, nowMs, ramp)
    return { alpha: st.alpha, faded: (st.flags & FADE_FLAG_FADED) !== 0 }
  }

  /**
   * `DRLGPRESET_UpdatePops` (`D2Common.dll` `0x6fd5a6a0`): evaluate all POPS boxes in the level against
   * the local player's level-local sub-tile coordinates `(playerSubX, playerSubY)`.
   */
  updatePops(
    pops: readonly PopBoxInput[] | undefined,
    playerSubX: number,
    playerSubY: number,
    nowMs: number,
  ): void {
    if (!pops || pops.length === 0) {
      if (this.popBoxesState.length > 0) {
        this.popBoxesState = []
      }
      return
    }
    const isInitial = this.popBoxesState.length !== pops.length
    if (isInitial) {
      this.popBoxesState = pops.map(() => ({ popped: false, toggledAtMs: -Infinity }))
    }

    // 0x6fd5a6f8..0x6fd5a755: find the first pop box containing the player's sub-tile.
    let activeMapIndex = -1
    let activePopIndex = 0
    for (let k = 0; k < pops.length; k++) {
      const p = pops[k]!
      const b = p.box
      const pad = p.pad
      const minSubX = b.x * 5
      const minSubY = b.y * 5
      const maxSubX = (b.x + b.width) * 5 + pad
      const maxSubY = (b.y + b.height) * 5 + pad
      if (playerSubX >= minSubX && playerSubY >= minSubY && playerSubX < maxSubX && playerSubY < maxSubY) {
        activeMapIndex = p.mapIndex
        activePopIndex = p.index
        break
      }
    }

    // 0x6fd5a7a6..0x6fd5a8c4: toggle any pop entry whose active state changed (all entries in the same
    // preset map sharing `p.index === activePopIndex` pop together).
    // When spawning directly inside a POPS box on initial level load (`isInitial`), record
    // `toggledAtMs = -Infinity` so the building starts immediately popped on frame 0 without a
    // 500ms roof fade-out flash (#1330).
    for (let j = 0; j < pops.length; j++) {
      const p = pops[j]!
      const nextPopped = activePopIndex !== 0 && p.mapIndex === activeMapIndex && p.index === activePopIndex
      const st = this.popBoxesState[j]!
      if (st.popped !== nextPopped) {
        st.popped = nextPopped
        st.toggledAtMs = isInitial ? -Infinity : nowMs
      }
    }
  }

  /**
   * `DRLGPRESET_TogglePopsVisibility` (`D2Common.dll` `0x6fd5a180`) + render-pass advancement
   * (`0x6fac3ac2..0x6fac3b36` / `0x6fb4ec39..0x6fb4ec78` / `0x6fb4ef21..0x6fb4efb5`).
   *
   * Returns `null` when `tile` is not controlled by POPS (so normal rendering / `0x6fb2a340` wall fade applies).
   */
  samplePopTile(
    tile: PopTileInput,
    pops: readonly PopBoxInput[] | undefined,
    nowMs: number,
    ramp = true,
  ): PopTileSample | null {
    const isRevealHidden = tile.revealHidden === true
    if (!pops || pops.length === 0) {
      return isRevealHidden ? { visible: false, alpha: 0 } : null
    }

    let matched = false
    let isPopped = false
    let activeToggleMs = -Infinity
    let latestUnpopToggleMs = -Infinity

    for (let j = 0; j < pops.length; j++) {
      const p = pops[j]!
      const b = p.box
      // 0x6fd5a1ae..0x6fd5a29f: expanded box `[b.x - 1, b.x + b.width] x [b.y - 1, b.y + b.height]`.
      if (
        tile.cellX < b.x - 1 ||
        tile.cellX > b.x + b.width ||
        tile.cellY < b.y - 1 ||
        tile.cellY > b.y + b.height
      ) {
        continue
      }
      if (!isRevealHidden) {
        // 0x6fd5a24d..0x6fd5a263: `!(dwFlags & 0x300) && pTile->nStyle == subIndex`.
        if (tile.popLinkage === true || tile.style === undefined || tile.style !== p.subIndex) {
          continue
        }
      }
      matched = true
      const boxSt = this.popBoxesState[j]
      if (boxSt !== undefined) {
        if (boxSt.popped) {
          isPopped = true
          if (boxSt.toggledAtMs > activeToggleMs) {
            activeToggleMs = boxSt.toggledAtMs
          }
        } else if (boxSt.toggledAtMs > latestUnpopToggleMs) {
          latestUnpopToggleMs = boxSt.toggledAtMs
        }
      }
    }

    if (!matched) {
      return isRevealHidden ? { visible: false, alpha: 0 } : null
    }

    const key = wallFadeKey(tile)
    let st = this.popTileStates.get(key)
    if (!isPopped && st === undefined) {
      return isRevealHidden ? { visible: false, alpha: 0 } : { visible: true, alpha: WALL_ALPHA_OPAQUE }
    }

    if (st === undefined) {
      if (isPopped && !Number.isFinite(activeToggleMs)) {
        st = {
          popped: true,
          hidden: !isRevealHidden,
          flags: 0,
          alpha: isRevealHidden ? WALL_ALPHA_OPAQUE : 0,
          from: isRevealHidden ? WALL_ALPHA_OPAQUE : 0,
          to: isRevealHidden ? WALL_ALPHA_OPAQUE : 0,
          endMs: 0,
        }
        this.popTileStates.set(key, st)
        return { visible: !st.hidden, alpha: st.alpha }
      }
      st = {
        popped: false,
        hidden: isRevealHidden,
        flags: 0,
        alpha: WALL_ALPHA_OPAQUE,
        from: WALL_ALPHA_OPAQUE,
        to: WALL_ALPHA_OPAQUE,
        endMs: 0,
      }
      this.popTileStates.set(key, st)
    }

    if (st.popped !== isPopped) {
      const toggleMs = isPopped
        ? (Number.isFinite(activeToggleMs) ? activeToggleMs : nowMs)
        : (Number.isFinite(latestUnpopToggleMs) ? latestUnpopToggleMs : nowMs)
      advanceRampAlpha(st, toggleMs, ramp)
      const end = toggleMs + WALL_FADE_RAMP_MS
      if (isRevealHidden) {
        if (isPopped) {
          // 0x6fd5a23a..0x6fd5a246 (`bVisible == 0`): `unk0x24 &= ~4; dwFlags &= ~8`.
          st.flags &= ~FADE_FLAG_REVEAL_HIDE
          st.hidden = false
          st.alpha = WALL_ALPHA_OPAQUE
        } else {
          // 0x6fd5a225..0x6fd5a232 (`bVisible == 1`): `unk0x24 |= 4; unk0x2C = now + 500`.
          st.flags |= FADE_FLAG_REVEAL_HIDE
          st.endMs = end
        }
      } else if (isPopped) {
        // 0x6fd5a2f5..0x6fd5a334 (`bVisible == 0`): ramp `255 -> 0` over 500ms.
        st.flags |= FADE_FLAG_RAMP
        st.from = WALL_ALPHA_OPAQUE
        st.to = 0
        st.endMs =
          st.alpha === WALL_ALPHA_OPAQUE
            ? end
            : end + cdiv(WALL_FADE_RAMP_MS * (st.alpha - WALL_ALPHA_OPAQUE), 255)
      } else {
        // 0x6fd5a2b9..0x6fd5a2f3 & 0x6fd5a338 (`bVisible == 1`): clear `0x400`, ramp `0 -> 255` over 500ms.
        st.hidden = false
        st.flags |= FADE_FLAG_RAMP
        st.from = 0
        st.to = WALL_ALPHA_OPAQUE
        st.endMs =
          st.alpha === 0
            ? end
            : end - cdiv(WALL_FADE_RAMP_MS * st.alpha, 255)
      }
      st.popped = isPopped
    }

    if (isRevealHidden) {
      // 0x6fb4ec5f / 0x6fb4ef8a..0x6fb4efa7: `if ((unk0x24 & 4) && now >= unk0x2C) { dwFlags |= 8; unk0x24 &= ~4; }`
      if ((st.flags & FADE_FLAG_REVEAL_HIDE) !== 0 && (!ramp || nowMs >= st.endMs)) {
        st.hidden = true
        st.flags &= ~FADE_FLAG_REVEAL_HIDE
      }
      return { visible: !st.hidden, alpha: st.hidden ? 0 : WALL_ALPHA_OPAQUE }
    }

    // 0x6fac3ac2..0x6fac3b2c / 0x6fb4ef21..0x6fb4ef88: advance ramp; `dwFlags |= 0x400` iff `alpha == 0`.
    advanceRampAlpha(st, nowMs, ramp)
    st.hidden = st.alpha === 0
    return { visible: !st.hidden, alpha: st.alpha }
  }
}

/** Stable per-wall key within one level view (cell, DT1 tile and orientation). */
export function wallFadeKey(w: { readonly cellX: number; readonly cellY: number; readonly library: number; readonly tile: number; readonly type?: number | undefined }): string {
  return `${String(w.cellX)},${String(w.cellY)},${String(w.library)},${String(w.tile)},${String(w.type ?? -1)}`
}

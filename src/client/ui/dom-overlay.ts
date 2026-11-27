/**
 * Modal DOM overlay lifecycle, compositor teardown, and keyboard/input isolation (`#1964`).
 *
 * Every full-screen modal overlay (`[data-d2-modal-overlay]`, `.d2-mods-overlay`,
 * `.d2-plugin-menu-overlay`, `.d2-toolbar-modal-overlay`) sits at `position: fixed; inset: 0; z-index: 2000`
 * above both `#view` (WebGL scene) and `#d2-hud-canvas` (2D HUD).
 *
 * Closing an overlay must atomically set `hidden = true` AND inline compositor-teardown styles
 * (`display: none`, `visibility: hidden`, `pointer-events: none`, `opacity: 0`, `background: none`,
 * `backdrop-filter: none`, `-webkit-backdrop-filter: none`) so Chromium's compositor never retains
 * a stale `backdrop-filter` dimming/desaturation surface over the game scene and HUD.
 */

export interface ModalOverlayStyleLike {
  display?: string
  visibility?: string
  pointerEvents?: string
  opacity?: string
  background?: string
  backdropFilter?: string
  webkitBackdropFilter?: string
  setProperty?: ((property: string, value: string, priority?: string) => void) | undefined
  removeProperty?: ((property: string) => string) | undefined
}

export interface ModalOverlayElementLike {
  id?: string | undefined
  className?: string | undefined
  hidden?: boolean | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parentNode?: { removeChild?: ((child: any) => unknown) | undefined } | null | undefined
  children?: ArrayLike<unknown> | readonly unknown[] | undefined
  style?: object | undefined
  getAttribute?: ((name: string) => string | null) | undefined
  setAttribute?: ((name: string, value: string) => void) | undefined
  removeAttribute?: ((name: string) => void) | undefined
}

export interface ModalOverlayOwner {
  readonly element: HTMLElement | ModalOverlayElementLike | null | undefined
  readonly isOpen: () => boolean
  readonly close: () => void
}

export interface ReconcileModalDomOverlaysOptions {
  readonly doc?: Document | null | undefined
  readonly owners?: readonly ModalOverlayOwner[] | undefined
  readonly removeUnowned?: boolean | undefined
}

const MODAL_OVERLAY_CLASSES = new Set([
  'd2-mods-overlay',
  'd2-plugin-menu-overlay',
  'd2-toolbar-modal-overlay',
])

const MODAL_OVERLAY_IDS = new Set([
  'd2-plugin-menu-overlay',
  'd2-config-modal-overlay',
  'd2-bug-modal-overlay',
])

const DYNAMIC_BODY_OVERLAY_CLASSES = new Set([
  'd2-mods-overlay',
  'd2-plugin-menu-overlay',
])

const MODAL_DIALOG_CLASSES = new Set([
  'd2-mods',
  'd2-plugin-menu',
  'd2-toolbar-modal',
])

function ensureStyleBag(el: ModalOverlayElementLike): ModalOverlayStyleLike | null {
  if (el.style && typeof el.style === 'object') {
    return el.style as ModalOverlayStyleLike
  }
  try {
    const created: ModalOverlayStyleLike = {}
    ;(el as { style?: ModalOverlayStyleLike }).style = created
    return created
  } catch {
    return null
  }
}

function hasAnyClass(className: unknown, targetSet: ReadonlySet<string>): boolean {
  if (typeof className !== 'string' || className.length === 0) return false
  for (const token of className.split(/\s+/)) {
    if (token && targetSet.has(token)) return true
  }
  return false
}

export function isModalOverlayElement(node: unknown): node is ModalOverlayElementLike {
  if (!node || typeof node !== 'object') return false
  const el = node as ModalOverlayElementLike
  if (typeof el.getAttribute === 'function' && el.getAttribute('data-d2-modal-overlay') !== null) {
    return true
  }
  if (hasAnyClass(el.className, MODAL_OVERLAY_CLASSES)) {
    return true
  }
  return typeof el.id === 'string' && MODAL_OVERLAY_IDS.has(el.id)
}

/**
 * Open a modal DOM overlay by clearing inline suppression styles and revealing it so stylesheet
 * rules (`.d2-mods-overlay:not([hidden])`, `.d2-toolbar-modal-overlay:not([hidden])`) apply cleanly.
 */
export function openModalDomOverlay(
  el: HTMLElement | ModalOverlayElementLike | null | undefined,
): void {
  if (!el) return
  el.hidden = false
  if (typeof el.removeAttribute === 'function') {
    el.removeAttribute('hidden')
  }
  if (typeof el.setAttribute === 'function') {
    el.setAttribute('aria-hidden', 'false')
  }
  const style = ensureStyleBag(el)
  if (!style) return
  style.display = ''
  style.visibility = ''
  style.pointerEvents = ''
  style.opacity = ''
  style.background = ''
  style.backdropFilter = ''
  style.webkitBackdropFilter = ''
  if (typeof style.removeProperty === 'function') {
    style.removeProperty('display')
    style.removeProperty('visibility')
    style.removeProperty('pointer-events')
    style.removeProperty('opacity')
    style.removeProperty('background')
    style.removeProperty('backdrop-filter')
    style.removeProperty('-webkit-backdrop-filter')
  }
}

/**
 * Close a modal DOM overlay and immediately tear down any GPU `backdrop-filter` / dim background
 * compositing surface in addition to setting `hidden = true`.
 */
export function closeModalDomOverlay(
  el: HTMLElement | ModalOverlayElementLike | null | undefined,
): void {
  if (!el) return
  el.hidden = true
  if (typeof el.setAttribute === 'function') {
    el.setAttribute('aria-hidden', 'true')
  }
  const style = ensureStyleBag(el)
  if (!style) return
  style.display = 'none'
  style.visibility = 'hidden'
  style.pointerEvents = 'none'
  style.opacity = '0'
  style.background = 'none'
  style.backdropFilter = 'none'
  style.webkitBackdropFilter = 'none'
  if (typeof style.setProperty === 'function') {
    style.setProperty('display', 'none')
    style.setProperty('visibility', 'hidden')
    style.setProperty('pointer-events', 'none')
    style.setProperty('opacity', '0')
    style.setProperty('background', 'none')
    style.setProperty('backdrop-filter', 'none')
    style.setProperty('-webkit-backdrop-filter', 'none')
  }
}

/**
 * Remove any pre-existing overlay with the same `id` inside `container` (or `doc`) before
 * mounting a replacement so re-initialization never leaves orphaned `.d2-mods-overlay` nodes.
 */
export function removeStaleModalOverlayById(
  id: string,
  container?: HTMLElement | ModalOverlayElementLike | null,
  doc: Document | null = typeof document !== 'undefined' ? document : null,
): void {
  const candidates = new Set<ModalOverlayElementLike>()
  if (doc) {
    for (const found of collectModalDomOverlays(doc)) {
      if (found.id === id) candidates.add(found)
    }
    if (typeof doc.getElementById === 'function') {
      const byId = doc.getElementById(id) as ModalOverlayElementLike | null
      if (byId) candidates.add(byId)
    }
  }
  if (container && container.children) {
    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as ModalOverlayElementLike | undefined
      if (child && child.id === id) candidates.add(child)
    }
  }
  for (const stale of candidates) {
    closeModalDomOverlay(stale)
    if (stale.parentNode && typeof stale.parentNode.removeChild === 'function') {
      stale.parentNode.removeChild(stale)
    }
  }
}

/**
 * Collect all modal DOM overlays present in `doc` (compatible with both real browser DOM
 * and lightweight unit-test mock documents without full CSS selector engines).
 */
export function collectModalDomOverlays(
  doc: Document | null = typeof document !== 'undefined' ? document : null,
): HTMLElement[] {
  if (!doc) return []
  const seen = new Set<HTMLElement>()
  const visitRoot = (root: unknown): void => {
    if (!root || typeof root !== 'object') return
    const stack: unknown[] = [root]
    while (stack.length > 0) {
      const cur = stack.pop()
      if (!cur || typeof cur !== 'object') continue
      if (isModalOverlayElement(cur)) {
        seen.add(cur as unknown as HTMLElement)
      }
      const children = (cur as ModalOverlayElementLike).children
      if (children && typeof children.length === 'number') {
        for (let i = children.length - 1; i >= 0; i--) {
          stack.push(children[i])
        }
      }
    }
  }

  const docAny = doc as unknown as {
    documentElement?: unknown
    body?: unknown
    querySelectorAll?: ((selector: string) => ArrayLike<Element>) | undefined
  }
  if (docAny.documentElement) {
    visitRoot(docAny.documentElement)
  } else if (docAny.body) {
    visitRoot(docAny.body)
  }

  if (typeof docAny.querySelectorAll === 'function') {
    try {
      const matched = docAny.querySelectorAll(
        '[data-d2-modal-overlay], .d2-mods-overlay, .d2-plugin-menu-overlay, .d2-toolbar-modal-overlay',
      )
      for (let i = 0; i < matched.length; i++) {
        const item = matched[i]
        if (item) seen.add(item as HTMLElement)
      }
    } catch {
      // Ignore unsupported compound selector syntax in minimal test doubles
    }
  }

  return [...seen]
}

function isOverlayElementVisiblyOpen(el: ModalOverlayElementLike): boolean {
  if (el.hidden) return false
  if (typeof el.getAttribute === 'function' && el.getAttribute('hidden') !== null) {
    return false
  }
  const style = el.style as ModalOverlayStyleLike | undefined
  if (style && typeof style === 'object') {
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false
    }
  }
  return true
}

function hasIntactModalDialog(overlay: ModalOverlayElementLike): boolean {
  const children = overlay.children
  if (!children || typeof children.length !== 'number') {
    return true
  }
  if (children.length === 0) {
    return false
  }
  for (let i = 0; i < children.length; i++) {
    const rawChild = children[i]
    if (!rawChild || typeof rawChild !== 'object') continue
    const child = rawChild as ModalOverlayElementLike
    const isDialog =
      (typeof child.getAttribute === 'function' && child.getAttribute('role') === 'dialog') ||
      hasAnyClass(child.className, MODAL_DIALOG_CLASSES)
    if (isDialog) {
      return isOverlayElementVisiblyOpen(child)
    }
  }
  return true
}

export function isModalDomOverlayOpen(
  doc: Document | null = typeof document !== 'undefined' ? document : null,
): boolean {
  if (!doc) return false
  if (typeof doc.querySelector === 'function') {
    const matched = doc.querySelector('[data-d2-modal-overlay]:not([hidden])') as ModalOverlayElementLike | null
    if (matched !== null && isOverlayElementVisiblyOpen(matched)) {
      return true
    }
  }
  for (const overlay of collectModalDomOverlays(doc)) {
    if (isOverlayElementVisiblyOpen(overlay as unknown as ModalOverlayElementLike)) {
      return true
    }
  }
  return false
}

/**
 * Reconcile all modal overlays in `doc` against live `owners` (used on `visibilitychange`,
 * `window.blur`, `window.focus`, `pageshow`, and room transitions):
 * - Unowned/orphaned overlays are force-closed (`closeModalDomOverlay`) and dynamic body overlays
 *   (`.d2-mods-overlay`, `.d2-plugin-menu-overlay`, `#d2-plugin-menu-overlay`) are removed from DOM.
 * - Owned overlays whose owner reports `isOpen() === false` have `closeModalDomOverlay` re-asserted
 *   so no stale `backdrop-filter` or desynced `hidden` state can persist.
 * - Owned overlays whose inner `[role="dialog"]` was hidden/removed while the backdrop stayed open
 *   are closed through their owner.
 */
export function reconcileModalDomOverlays(options: ReconcileModalDomOverlaysOptions = {}): number {
  const doc = options.doc !== undefined ? options.doc : typeof document !== 'undefined' ? document : null
  const owners = options.owners ?? []
  let cleaned = 0

  for (const owner of owners) {
    if (!owner.isOpen() && owner.element) {
      if (isOverlayElementVisiblyOpen(owner.element)) {
        cleaned++
      }
      closeModalDomOverlay(owner.element)
    }
  }

  for (const rawOverlay of collectModalDomOverlays(doc)) {
    const overlay = rawOverlay as unknown as ModalOverlayElementLike
    const owner = owners.find((entry) => entry.element === rawOverlay || entry.element === overlay)
    if (!owner) {
      if (isOverlayElementVisiblyOpen(overlay)) {
        cleaned++
      }
      closeModalDomOverlay(overlay)
      const isDynamicBodyOverlay =
        overlay.id === 'd2-plugin-menu-overlay' ||
        hasAnyClass(overlay.className, DYNAMIC_BODY_OVERLAY_CLASSES)
      if (
        (options.removeUnowned === true || isDynamicBodyOverlay) &&
        overlay.parentNode &&
        typeof overlay.parentNode.removeChild === 'function'
      ) {
        overlay.parentNode.removeChild(overlay)
      }
      continue
    }

    if (!owner.isOpen()) {
      if (isOverlayElementVisiblyOpen(overlay)) {
        cleaned++
      }
      closeModalDomOverlay(overlay)
      continue
    }

    if (!hasIntactModalDialog(overlay)) {
      cleaned++
      owner.close()
      closeModalDomOverlay(overlay)
    }
  }

  return cleaned
}

/**
 * Unconditionally close all owned modal controllers and force-hide/purge every modal overlay in `doc`.
 */
export function dismissAllModalDomOverlays(
  doc: Document | null = typeof document !== 'undefined' ? document : null,
  owners: readonly ModalOverlayOwner[] = [],
): void {
  for (const owner of owners) {
    owner.close()
    if (owner.element) {
      closeModalDomOverlay(owner.element)
    }
  }
  reconcileModalDomOverlays({ doc, owners })
  for (const overlay of collectModalDomOverlays(doc)) {
    closeModalDomOverlay(overlay)
  }
}

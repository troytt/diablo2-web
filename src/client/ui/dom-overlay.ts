/**
 * Modal DOM overlay detection for keyboard and input isolation (`[data-d2-modal-overlay]`).
 *
 * When any `[data-d2-modal-overlay]:not([hidden])` element is present in the document,
 * game canvas keyboard listeners (`src/client/main.ts`) must ignore key events so modal
 * interactions (such as `Escape` or hotkeys) never leak into `FrontendRenderer`,
 * `CommandMapper`, or `HudManager`.
 */

export function isModalDomOverlayOpen(doc: Document | null = typeof document !== 'undefined' ? document : null): boolean {
  if (!doc || typeof doc.querySelector !== 'function') {
    return false
  }
  return doc.querySelector('[data-d2-modal-overlay]:not([hidden])') !== null
}

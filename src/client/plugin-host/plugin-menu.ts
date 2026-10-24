/**
 * DOM Modal Configuration Menu for Plugins (`src/client/plugin-host/plugin-menu.ts`).
 *
 * Mounts a centered modal overlay on `document.body` (`[data-d2-modal-overlay="plugins"]`)
 * with Diablo II dark theme, gold borders, `D2Exocet` / `D2Formal436` typography,
 * isolated scrollable plugin card list (`overflow-y: auto`), and strict capture-phase
 * keyboard isolation so `Escape` and hotkeys never leak into the game canvas or `HudManager`.
 */

import { getGameLang, onLangChange, type GameLang } from '../i18n/lang.ts'
import type { PluginHost, PluginHostToolbarPort } from './plugin-host.ts'
import { buildPluginMenuViewModel } from './plugin-menu-model.ts'

export interface PluginMenuOptions {
  readonly host: PluginHost
  readonly toolbar?: PluginHostToolbarPort | null | undefined
  readonly container?: HTMLElement | null | undefined
}

export class PluginMenu {
  private readonly host: PluginHost
  private readonly toolbar: PluginHostToolbarPort | null
  private readonly container: HTMLElement | null
  private readonly unsubHost: () => void
  private readonly unsubLang: () => void
  private overlayEl: HTMLElement | null = null
  private dialogEl: HTMLElement | null = null
  private titleEl: HTMLElement | null = null
  private subtitleEl: HTMLElement | null = null
  private closeBtnEl: HTMLButtonElement | null = null
  private alertEl: HTMLElement | null = null
  private bodyEl: HTMLElement | null = null
  private navEl: HTMLElement | null = null
  private listEl: HTMLElement | null = null
  private resetBtnEl: HTMLButtonElement | null = null
  private selectedPluginId: string | null = null
  private openState = false

  private readonly handleWindowKeyDown = (e: KeyboardEvent): void => {
    if (!this.openState) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopImmediatePropagation()
      this.close()
      return
    }
    e.stopImmediatePropagation()
  }

  private readonly handleWindowKeyUp = (e: KeyboardEvent): void => {
    if (!this.openState) return
    e.stopImmediatePropagation()
  }

  constructor(options: PluginMenuOptions) {
    this.host = options.host
    this.toolbar = options.toolbar ?? null
    this.container =
      options.container !== undefined
        ? options.container
        : typeof document !== 'undefined'
          ? document.body
          : null

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      this.mountDom()
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', this.handleWindowKeyDown, true)
      window.addEventListener('keyup', this.handleWindowKeyUp, true)
    }

    this.unsubHost = this.host.subscribe(() => {
      this.render()
      this.syncToolbarOpenState()
    })

    this.unsubLang = onLangChange(() => {
      this.render()
    })
  }

  isOpen(): boolean {
    return this.openState
  }

  open(): void {
    if (this.openState) return
    this.openState = true
    if (this.overlayEl) {
      this.overlayEl.hidden = false
    }
    this.render()
    this.syncToolbarOpenState()
    this.closeBtnEl?.focus()
  }

  close(): void {
    if (!this.openState) return
    this.openState = false
    if (this.overlayEl) {
      this.overlayEl.hidden = true
    }
    this.syncToolbarOpenState()
    if (typeof document !== 'undefined') {
      const btn = document.getElementById('d2-toolbar-plugins-btn')
      if (btn && typeof btn.focus === 'function') {
        btn.focus()
      }
    }
  }

  toggle(): boolean {
    if (this.openState) {
      this.close()
    } else {
      this.open()
    }
    return this.openState
  }

  getElement(): HTMLElement | null {
    return this.overlayEl
  }

  getSelectedPluginId(): string | null {
    return this.selectedPluginId
  }

  selectPlugin(id: string): void {
    const exists = this.host.list().some((snap) => snap.plugin.id === id)
    if (!exists) return
    this.selectedPluginId = id
    this.render()
  }

  destroy(): void {
    this.unsubHost()
    this.unsubLang()
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('keydown', this.handleWindowKeyDown, true)
      window.removeEventListener('keyup', this.handleWindowKeyUp, true)
    }
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl)
    }
    this.overlayEl = null
  }

  private syncToolbarOpenState(): void {
    this.toolbar?.setPluginsButtonState({
      ready: this.host.isReady(),
      hasWarning: this.host.hasErrorOrCorruption(),
      open: this.openState,
    })
  }

  private ensureStyles(doc: Document): void {
    if (!doc.head || doc.getElementById('d2-plugin-menu-styles')) return
    const styleEl = doc.createElement('style')
    styleEl.id = 'd2-plugin-menu-styles'
    styleEl.textContent = `
.d2-plugin-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
  background: rgba(4, 3, 2, 0.78);
  font-family: var(--font-body, "D2Formal436", "Noto Serif SC", "PingFang SC", Georgia, serif);
  color: #e6d6b0;
}
.d2-plugin-menu-overlay[hidden] {
  display: none !important;
}
.d2-plugin-menu {
  width: 720px;
  max-width: 96vw;
  height: 480px;
  max-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #17130d 0%, #0b0906 100%);
  border: 1px solid #9c7c42;
  border-radius: 4px;
  box-shadow: 0 12px 42px rgba(0, 0, 0, 0.95), inset 0 0 18px rgba(156, 124, 66, 0.14);
  overflow: hidden;
}
.d2-plugin-menu__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  border-bottom: 1px solid #4a3c24;
  background: rgba(27, 21, 14, 0.92);
  flex: 0 0 auto;
}
.d2-plugin-menu__title {
  margin: 0;
  font-family: var(--font-display, "D2Exocet", "Cinzel", Georgia, serif);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #dfc478;
}
.d2-plugin-menu__close {
  height: 26px;
  padding: 0 10px;
  background: linear-gradient(180deg, #2b2316 0%, #17120b 100%);
  border: 1px solid #6b5632;
  border-radius: 2px;
  color: #dfc991;
  font-family: var(--font-display, "D2Exocet", Georgia, serif);
  font-size: 11px;
  cursor: pointer;
}
.d2-plugin-menu__close:hover {
  border-color: #d4b46a;
  color: #fff5d6;
}
.d2-plugin-menu__subtitle {
  margin: 0;
  padding: 8px 16px;
  font-size: 12px;
  color: #b5a178;
  background: rgba(16, 13, 9, 0.9);
  border-bottom: 1px solid #2e2517;
  flex: 0 0 auto;
}
.d2-plugin-menu__alert {
  margin: 10px 16px 0;
  padding: 8px 12px;
  background: rgba(58, 16, 14, 0.95);
  border: 1px solid #c94a4a;
  border-radius: 3px;
  color: #ffd6d1;
  font-size: 12px;
  line-height: 1.4;
  flex: 0 0 auto;
}
.d2-plugin-menu__alert[hidden] {
  display: none !important;
}
.d2-plugin-menu__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}
.d2-plugin-menu__sidebar {
  width: 220px;
  flex: 0 0 220px;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0;
  border-right: 1px solid #4a3c24;
  background: rgba(14, 11, 8, 0.96);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.d2-plugin-menu__sidebar[hidden] {
  display: none !important;
}
.d2-plugin-menu__nav-item {
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-left: 3px solid transparent;
  background: transparent;
  color: #bfa97a;
  font-family: var(--font-display, "D2Exocet", "Noto Serif SC", Georgia, serif);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 9px;
  box-sizing: border-box;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.d2-plugin-menu__nav-item:hover {
  background: rgba(156, 124, 66, 0.12);
  color: #ebd396;
}
.d2-plugin-menu__nav-item--active {
  border-left-color: #dfc478;
  background: linear-gradient(90deg, rgba(156, 124, 66, 0.28) 0%, rgba(156, 124, 66, 0.06) 100%);
  color: #fff2c6;
}
.d2-plugin-menu__nav-item--error {
  color: #ff9c9c;
}
.d2-plugin-menu__nav-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 7px;
  background: #6e624d;
}
.d2-plugin-menu__nav-dot--ok {
  background: #5cd685;
  box-shadow: 0 0 5px rgba(92, 214, 133, 0.55);
}
.d2-plugin-menu__nav-dot--warn {
  background: #f5c26b;
}
.d2-plugin-menu__nav-dot--error {
  background: #ff6b6b;
  box-shadow: 0 0 6px rgba(255, 107, 107, 0.7);
}
.d2-plugin-menu__nav-dot--disabled {
  background: #594f3e;
}
.d2-plugin-menu__nav-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.d2-plugin-menu__list {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.d2-plugin-card {
  padding: 14px 16px;
  background: rgba(22, 18, 13, 0.94);
  border: 1px solid #4a3c24;
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.d2-plugin-card[hidden] {
  display: none !important;
}
.d2-plugin-card--error {
  border-color: #b83b3b;
}
.d2-plugin-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.d2-plugin-card__title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.d2-plugin-card__name {
  font-family: var(--font-display, "D2Exocet", Georgia, serif);
  font-size: 15px;
  font-weight: 700;
  color: #ebd396;
}
.d2-plugin-card__status {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 2px;
  font-size: 11px;
  border: 1px solid #4a3c24;
  background: #14110d;
  color: #c9b68a;
}
.d2-plugin-card__status--ok {
  border-color: #2f6e46;
  color: #7ee2a0;
}
.d2-plugin-card__status--warn {
  border-color: #9e6b24;
  color: #f5c26b;
}
.d2-plugin-card__status--error {
  border-color: #b83b3b;
  color: #ff9c9c;
}
.d2-plugin-card__status--disabled {
  border-color: #463d30;
  color: #948771;
}
.d2-plugin-card__toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #dfc991;
  cursor: pointer;
  user-select: none;
}
.d2-plugin-card__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid #2e2517;
}
.d2-plugin-card__section-title {
  margin: 0;
  font-family: var(--font-display, "D2Exocet", Georgia, serif);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #9c8456;
}
.d2-plugin-card__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #b8a57e;
}
.d2-plugin-card__empty-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: #877657;
  font-style: italic;
}
.d2-plugin-card__controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.d2-plugin-card__setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: #d8c598;
}
.d2-plugin-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.d2-plugin-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 10px;
  background: linear-gradient(180deg, #2b2316 0%, #17120b 100%);
  border: 1px solid #6b5632;
  border-radius: 2px;
  color: #e6d19a;
  font-size: 11px;
  text-decoration: none;
  cursor: pointer;
}
.d2-plugin-card__action:hover {
  border-color: #d4b46a;
  color: #fff5d6;
}
.d2-plugin-menu__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 16px;
  border-top: 1px solid #4a3c24;
  background: rgba(20, 16, 11, 0.94);
  flex: 0 0 auto;
}
`
    doc.head.appendChild(styleEl)
  }

  private mountDom(): void {
    const doc = document
    this.ensureStyles(doc)

    const overlay = doc.createElement('div')
    overlay.id = 'd2-plugin-menu-overlay'
    overlay.className = 'd2-plugin-menu-overlay'
    overlay.setAttribute('data-d2-modal-overlay', 'plugins')
    overlay.hidden = true
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close()
      }
    })

    const dialog = doc.createElement('div')
    dialog.id = 'd2-plugin-menu'
    dialog.className = 'd2-plugin-menu'
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-labelledby', 'd2-plugin-menu-title')

    const header = doc.createElement('div')
    header.className = 'd2-plugin-menu__header'

    const title = doc.createElement('h2')
    title.id = 'd2-plugin-menu-title'
    title.className = 'd2-plugin-menu__title'

    const closeBtn = doc.createElement('button')
    closeBtn.type = 'button'
    closeBtn.id = 'd2-plugin-menu-close'
    closeBtn.className = 'd2-plugin-menu__close'
    closeBtn.addEventListener('click', () => {
      this.close()
    })

    header.appendChild(title)
    header.appendChild(closeBtn)

    const subtitle = doc.createElement('p')
    subtitle.id = 'd2-plugin-menu-subtitle'
    subtitle.className = 'd2-plugin-menu__subtitle'

    const alertBanner = doc.createElement('div')
    alertBanner.id = 'd2-plugin-menu-alert'
    alertBanner.className = 'd2-plugin-menu__alert'
    alertBanner.setAttribute('role', 'alert')
    alertBanner.hidden = true

    const body = doc.createElement('div')
    body.id = 'd2-plugin-menu-body'
    body.className = 'd2-plugin-menu__body'

    const nav = doc.createElement('div')
    nav.id = 'd2-plugin-menu-nav'
    nav.className = 'd2-plugin-menu__sidebar'
    nav.setAttribute('role', 'tablist')
    nav.setAttribute('aria-orientation', 'vertical')

    const list = doc.createElement('div')
    list.id = 'd2-plugin-menu-list'
    list.className = 'd2-plugin-menu__list'

    body.appendChild(nav)
    body.appendChild(list)

    const footer = doc.createElement('div')
    footer.className = 'd2-plugin-menu__footer'

    const resetBtn = doc.createElement('button')
    resetBtn.type = 'button'
    resetBtn.id = 'd2-plugin-menu-reset'
    resetBtn.className = 'd2-plugin-card__action'
    resetBtn.addEventListener('click', () => {
      void this.host.resetAllToDefaults()
    })
    footer.appendChild(resetBtn)

    dialog.appendChild(header)
    dialog.appendChild(subtitle)
    dialog.appendChild(alertBanner)
    dialog.appendChild(body)
    dialog.appendChild(footer)
    overlay.appendChild(dialog)

    if (this.container) {
      this.container.appendChild(overlay)
    }

    this.overlayEl = overlay
    this.dialogEl = dialog
    this.titleEl = title
    this.subtitleEl = subtitle
    this.closeBtnEl = closeBtn
    this.alertEl = alertBanner
    this.bodyEl = body
    this.navEl = nav
    this.listEl = list
    this.resetBtnEl = resetBtn

    this.render()
  }

  render(lang: GameLang = getGameLang()): void {
    if (!this.overlayEl || !this.listEl || !this.navEl) return
    const doc = this.overlayEl.ownerDocument
    const vm = buildPluginMenuViewModel(this.host, lang, this.selectedPluginId)
    this.selectedPluginId = vm.selectedPluginId

    if (this.titleEl) {
      this.titleEl.textContent = vm.title
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = vm.subtitle
    }
    if (this.closeBtnEl) {
      this.closeBtnEl.textContent = vm.closeLabel
    }
    if (this.resetBtnEl) {
      this.resetBtnEl.textContent = vm.resetAllLabel
    }
    if (this.alertEl) {
      if (vm.alertText !== null) {
        this.alertEl.hidden = false
        this.alertEl.textContent = vm.alertText
      } else {
        this.alertEl.hidden = true
        this.alertEl.textContent = ''
      }
    }

    this.navEl.innerHTML = ''
    this.listEl.innerHTML = ''
    if (vm.cards.length === 0) {
      this.navEl.hidden = true
      const emptyEl = doc.createElement('p')
      emptyEl.className = 'd2-plugin-card__desc'
      emptyEl.textContent = vm.emptyText
      this.listEl.appendChild(emptyEl)
      return
    }

    this.navEl.hidden = false
    const activeId = vm.selectedPluginId

    for (const card of vm.cards) {
      const isSelected = card.id === activeId

      // Left column navigation item
      const navItem = doc.createElement('button')
      navItem.type = 'button'
      const navClasses = ['d2-plugin-menu__nav-item']
      if (isSelected) navClasses.push('d2-plugin-menu__nav-item--active')
      if (card.statusLevel === 'error') navClasses.push('d2-plugin-menu__nav-item--error')
      navItem.className = navClasses.join(' ')
      navItem.setAttribute('role', 'tab')
      navItem.setAttribute('aria-selected', isSelected ? 'true' : 'false')
      navItem.setAttribute('data-plugin-nav', card.id)
      navItem.addEventListener('click', () => {
        this.selectPlugin(card.id)
      })

      const navDot = doc.createElement('span')
      navDot.className = `d2-plugin-menu__nav-dot d2-plugin-menu__nav-dot--${card.statusLevel}`
      navDot.setAttribute('aria-hidden', 'true')

      const navName = doc.createElement('span')
      navName.className = 'd2-plugin-menu__nav-name'
      navName.textContent = card.name

      navItem.appendChild(navDot)
      navItem.appendChild(navName)
      this.navEl.appendChild(navItem)

      // Right column detail panel
      const cardEl = doc.createElement('div')
      cardEl.className =
        card.statusLevel === 'error'
          ? 'd2-plugin-card d2-plugin-card--error'
          : 'd2-plugin-card'
      cardEl.setAttribute('role', 'tabpanel')
      cardEl.setAttribute('data-plugin-id', card.id)
      cardEl.hidden = !isSelected

      const topRow = doc.createElement('div')
      topRow.className = 'd2-plugin-card__top'

      const titleGroup = doc.createElement('div')
      titleGroup.className = 'd2-plugin-card__title-group'

      const nameEl = doc.createElement('span')
      nameEl.className = 'd2-plugin-card__name'
      nameEl.textContent = card.name

      const statusBadge = doc.createElement('span')
      statusBadge.className = `d2-plugin-card__status d2-plugin-card__status--${card.statusLevel}`
      statusBadge.setAttribute('data-plugin-status', card.id)
      statusBadge.textContent = card.statusText

      titleGroup.appendChild(nameEl)
      titleGroup.appendChild(statusBadge)

      const toggleLabel = doc.createElement('label')
      toggleLabel.className = 'd2-plugin-card__toggle-label'

      const toggleInput = doc.createElement('input')
      toggleInput.type = 'checkbox'
      toggleInput.checked = card.enabled
      toggleInput.setAttribute('data-plugin-toggle', card.id)
      toggleInput.addEventListener('change', () => {
        void this.host.setEnabled(card.id, toggleInput.checked)
      })

      const toggleText = doc.createElement('span')
      toggleText.textContent = card.toggleLabel

      toggleLabel.appendChild(toggleInput)
      toggleLabel.appendChild(toggleText)

      topRow.appendChild(titleGroup)
      topRow.appendChild(toggleLabel)

      // Description section
      const descSection = doc.createElement('div')
      descSection.className = 'd2-plugin-card__section'

      const descTitle = doc.createElement('h3')
      descTitle.className = 'd2-plugin-card__section-title'
      descTitle.textContent = vm.descriptionHeader

      const descEl = doc.createElement('p')
      descEl.className = 'd2-plugin-card__desc'
      descEl.textContent = card.description

      descSection.appendChild(descTitle)
      descSection.appendChild(descEl)

      // Settings & actions section
      const settingsSection = doc.createElement('div')
      settingsSection.className = 'd2-plugin-card__section'

      const settingsTitle = doc.createElement('h3')
      settingsTitle.className = 'd2-plugin-card__section-title'
      settingsTitle.textContent = vm.settingsHeader
      settingsSection.appendChild(settingsTitle)

      if (!card.enabled) {
        const disabledHintEl = doc.createElement('p')
        disabledHintEl.className = 'd2-plugin-card__empty-hint'
        disabledHintEl.textContent = vm.disabledHintText
        settingsSection.appendChild(disabledHintEl)
      } else if (card.settings.length === 0 && card.actions.length === 0) {
        const noSettingsEl = doc.createElement('p')
        noSettingsEl.className = 'd2-plugin-card__empty-hint'
        noSettingsEl.textContent = vm.noSettingsText
        settingsSection.appendChild(noSettingsEl)
      } else {
        const controlsEl = doc.createElement('div')
        controlsEl.className = 'd2-plugin-card__controls'

        for (const setting of card.settings) {
          const settingRow = doc.createElement('label')
          settingRow.className = 'd2-plugin-card__setting'

          const labelSpan = doc.createElement('span')
          labelSpan.textContent = setting.label
          settingRow.appendChild(labelSpan)

          if (setting.kind === 'boolean') {
            const checkbox = doc.createElement('input')
            checkbox.type = 'checkbox'
            checkbox.checked = setting.value
            checkbox.setAttribute('data-plugin-setting', `${card.id}:${setting.key}`)
            checkbox.addEventListener('change', () => {
              this.host.setSetting(card.id, setting.key, checkbox.checked)
            })
            settingRow.appendChild(checkbox)
          } else {
            const select = doc.createElement('select')
            select.className = 'd2-toolbar__select'
            select.setAttribute('data-plugin-setting', `${card.id}:${setting.key}`)
            for (const opt of setting.options) {
              const optEl = doc.createElement('option')
              optEl.value = opt.value
              optEl.textContent = opt.label
              select.appendChild(optEl)
            }
            select.value = setting.value
            select.addEventListener('change', () => {
              this.host.setSetting(card.id, setting.key, select.value)
            })
            settingRow.appendChild(select)
          }

          controlsEl.appendChild(settingRow)
        }

        if (card.actions.length > 0) {
          const actionsRow = doc.createElement('div')
          actionsRow.className = 'd2-plugin-card__actions'

          for (const action of card.actions) {
            if (action.kind === 'link') {
              const link = doc.createElement('a')
              link.className = 'd2-plugin-card__action'
              link.href = action.href
              link.target = '_blank'
              link.rel = 'noopener'
              link.setAttribute('data-plugin-action', `${card.id}:${action.id}`)
              link.textContent = action.label
              actionsRow.appendChild(link)
            } else {
              const btn = doc.createElement('button')
              btn.type = 'button'
              btn.className = 'd2-plugin-card__action'
              btn.setAttribute('data-plugin-action', `${card.id}:${action.id}`)
              btn.textContent = action.label
              btn.addEventListener('click', () => {
                this.host.runAction(card.id, action.id)
              })
              actionsRow.appendChild(btn)
            }
          }

          controlsEl.appendChild(actionsRow)
        }

        settingsSection.appendChild(controlsEl)
      }

      cardEl.appendChild(topRow)
      cardEl.appendChild(descSection)
      cardEl.appendChild(settingsSection)

      this.listEl.appendChild(cardEl)
    }
  }
}

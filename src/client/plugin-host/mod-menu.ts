import { getGameLang, onLangChange, type GameLang } from '../i18n/lang.ts'
import { menuSections, menuText, NO_LAYOUT, plainCard, type MenuLayout } from './mod-menu-text.ts'
import type { PluginHost, PluginHostToolbarPort } from './plugin-host.ts'
import { buildPluginMenuViewModel, type PluginMenuCardViewModel } from './plugin-menu-model.ts'

export interface ModMenuOptions {
  readonly host: PluginHost
  readonly toolbar?: PluginHostToolbarPort | null | undefined
  readonly container?: HTMLElement | null | undefined
  readonly layout?: MenuLayout | undefined
}

interface Parts {
  readonly overlay: HTMLElement
  readonly title: HTMLElement
  readonly subtitle: HTMLElement
  readonly search: HTMLInputElement
  readonly close: HTMLButtonElement
  readonly alert: HTMLElement
  readonly list: HTMLElement
  readonly detail: HTMLElement
  readonly count: HTMLElement
  readonly reset: HTMLButtonElement
}

type Props = Readonly<Record<string, string | boolean>>

export class ModMenu {
  private readonly host: PluginHost
  private readonly toolbar: PluginHostToolbarPort | null
  private readonly layout: MenuLayout
  private readonly parts: Parts | null
  private readonly unsubscribe: readonly (() => void)[]
  private selectedId: string | null = null
  private query = ''
  private renderedLayout: string | null = null
  private openState = false

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.openState) return
    e.stopImmediatePropagation()
    if (e.key !== 'Escape') return
    e.preventDefault()
    if (this.query.length > 0) this.setQuery('')
    else this.close()
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (this.openState) e.stopImmediatePropagation()
  }

  constructor(options: ModMenuOptions) {
    this.host = options.host
    this.toolbar = options.toolbar ?? null
    this.layout = options.layout ?? NO_LAYOUT
    const container = options.container !== undefined ? options.container : typeof document !== 'undefined' ? document.body : null
    this.parts = typeof document !== 'undefined' ? this.mount(document, container) : null
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', this.onKeyDown, true)
      window.addEventListener('keyup', this.onKeyUp, true)
    }
    this.unsubscribe = [
      this.host.subscribe(() => {
        this.render()
        this.syncToolbar()
      }),
      onLangChange(() => {
        this.render()
      }),
    ]
    this.render()
  }

  isOpen(): boolean {
    return this.openState
  }

  open(): void {
    if (this.openState) return
    this.openState = true
    if (this.parts) this.parts.overlay.hidden = false
    this.render()
    this.syncToolbar()
    this.parts?.search.focus()
  }

  close(): void {
    if (!this.openState) return
    this.openState = false
    if (this.parts) this.parts.overlay.hidden = true
    this.syncToolbar()
    if (typeof document !== 'undefined') document.getElementById('d2-toolbar-plugins-btn')?.focus()
  }

  toggle(): boolean {
    if (this.openState) this.close()
    else this.open()
    return this.openState
  }

  getElement(): HTMLElement | null {
    return this.parts?.overlay ?? null
  }

  getSelectedPluginId(): string | null {
    return this.selectedId
  }

  selectPlugin(id: string): void {
    if (!this.host.list().some((snap) => snap.plugin.id === id)) return
    this.selectedId = id
    this.render()
    this.parts?.list.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' })
  }

  setQuery(query: string): void {
    this.query = query
    if (this.parts && this.parts.search.value !== query) this.parts.search.value = query
    this.render()
  }

  destroy(): void {
    this.unsubscribe.forEach((unsubscribe) => {
      unsubscribe()
    })
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('keydown', this.onKeyDown, true)
      window.removeEventListener('keyup', this.onKeyUp, true)
    }
    this.parts?.overlay.parentNode?.removeChild(this.parts.overlay)
  }

  private syncToolbar(): void {
    this.toolbar?.setPluginsButtonState({ ready: this.host.isReady(), hasWarning: this.host.hasErrorOrCorruption(), open: this.openState })
  }

  private mount(doc: Document, container: HTMLElement | null): Parts {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, props: Props = {}, ...children: HTMLElement[]): HTMLElementTagNameMap[K] => {
      const node = doc.createElement(tag)
      node.className = className
      Object.entries(props).forEach(([name, value]) => {
        if (name === 'id') node.id = String(value)
        else node.setAttribute(name, String(value))
      })
      children.forEach((child) => node.appendChild(child))
      return node
    }
    const title = el('h2', 'd2-mods__title', { id: 'd2-plugin-menu-title' })
    const subtitle = el('p', 'd2-mods__subtitle', { id: 'd2-plugin-menu-subtitle' })
    const search = el('input', 'd2-mods__search', { id: 'd2-plugin-menu-search', type: 'search', spellcheck: 'false', autocomplete: 'off' })
    const close = el('button', 'd2-mods__close', { id: 'd2-plugin-menu-close', type: 'button' })
    const alert = el('div', 'd2-mods__alert', { id: 'd2-plugin-menu-alert', role: 'alert' })
    const list = el('nav', 'd2-mods__list', { id: 'd2-plugin-menu-nav', role: 'tablist', 'aria-orientation': 'vertical' })
    const detail = el('section', 'd2-mods__detail', { id: 'd2-plugin-menu-list' })
    const count = el('span', 'd2-mods__count')
    const reset = el('button', 'd2-mods__button', { id: 'd2-plugin-menu-reset', type: 'button' })
    const header = el('header', 'd2-mods__header', {}, el('div', 'd2-mods__heading', {}, title, subtitle), search, close)
    const dialog = el(
      'div',
      'd2-mods d2-plugin-menu',
      { id: 'd2-plugin-menu', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'd2-plugin-menu-title' },
      header,
      alert,
      el('div', 'd2-mods__body', { id: 'd2-plugin-menu-body' }, list, detail),
      el('footer', 'd2-mods__footer', {}, count, reset),
    )
    const overlay = el('div', 'd2-mods-overlay d2-plugin-menu-overlay', { id: 'd2-plugin-menu-overlay', 'data-d2-modal-overlay': 'plugins' }, dialog)
    overlay.hidden = true
    alert.hidden = true
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close()
    })
    overlay.addEventListener('wheel', (e) => {
      e.stopPropagation()
    })
    search.addEventListener('input', () => {
      this.setQuery(search.value)
    })
    close.addEventListener('click', () => {
      this.close()
    })
    reset.addEventListener('click', () => {
      void this.host.resetAllToDefaults()
    })
    container?.appendChild(overlay)
    return { overlay, title, subtitle, search, close, alert, list, detail, count, reset }
  }

  render(lang: GameLang = getGameLang()): void {
    const parts = this.parts
    if (!parts) return
    const vm = buildPluginMenuViewModel(this.host, lang, this.selectedId)
    const cards = vm.cards.map((card) => plainCard(card, lang, this.layout))
    const sections = menuSections(cards, lang, this.query, this.layout)
    const shown = sections.flatMap((section) => section.cards)
    const selected = shown.find((card) => card.id === this.selectedId) ?? shown[0] ?? null
    if (selected) this.selectedId = selected.id
    parts.title.textContent = menuText('title', lang)
    parts.subtitle.textContent = menuText('subtitle', lang)
    parts.search.placeholder = menuText('search', lang)
    parts.close.textContent = menuText('close', lang)
    parts.reset.textContent = menuText('reset', lang)
    parts.count.textContent = menuText('count', lang, { on: cards.filter((card) => card.enabled).length, all: cards.length })
    parts.alert.hidden = vm.alertText === null
    parts.alert.textContent = vm.alertText ?? ''
    const layout = JSON.stringify({ lang, query: this.query, selected: selected?.id, sections: sections.map((section) => [section.title, section.cards.map((card) => ({ ...card, statusText: '', statusLevel: '' }))]) })
    if (layout === this.renderedLayout) {
      shown.forEach((card) => this.refreshStatus(card))
      return
    }
    this.renderedLayout = layout
    const doc = parts.overlay.ownerDocument
    const scroll = { list: parts.list.scrollTop, detail: parts.detail.scrollTop, id: this.selectedId }
    parts.list.innerHTML = ''
    parts.detail.innerHTML = ''
    sections.forEach((section) => {
      parts.list.appendChild(this.sectionHeader(doc, section.title, section.cards))
      section.cards.forEach((card) => parts.list.appendChild(this.row(doc, card, card.id === selected?.id, lang)))
    })
    const note = (text: string) => Object.assign(doc.createElement('p'), { className: 'd2-mods__note', textContent: text })
    if (selected) parts.detail.appendChild(this.details(doc, selected, lang))
    else parts.detail.appendChild(note(cards.length === 0 ? menuText('empty', lang) : menuText('nothing', lang, { q: this.query.trim() })))
    parts.list.scrollTop = scroll.list
    parts.detail.scrollTop = scroll.id === this.selectedId ? scroll.detail : 0
  }

  private refreshStatus(card: PluginMenuCardViewModel): void {
    const root = this.parts?.overlay
    const isError = card.statusLevel === 'error'
    const flag = (node: HTMLElement | null | undefined) => {
      if (node) node.className = [...node.className.split(' ').filter((name) => name !== 'is-error'), ...(isError ? ['is-error'] : [])].join(' ')
    }
    const status = root?.querySelector<HTMLElement>(`[data-plugin-status="${card.id}"]`)
    if (status) Object.assign(status, { className: `d2-mods__status d2-mods__status--${card.statusLevel}`, textContent: card.statusText })
    const row = root?.querySelector<HTMLElement>(`[data-plugin-nav="${card.id}"]`)
    flag(row)
    flag(root?.querySelector<HTMLElement>(`[data-plugin-id="${card.id}"]`))
    const dot = row?.querySelector<HTMLElement>('.d2-mods__dot')
    if (dot) dot.className = `d2-mods__dot d2-mods__dot--${card.statusLevel}`
  }

  private sectionHeader(doc: Document, title: string, cards: readonly PluginMenuCardViewModel[]): HTMLElement {
    const header = Object.assign(doc.createElement('div'), { className: 'd2-mods__group' })
    header.setAttribute('data-plugin-group', title)
    header.appendChild(Object.assign(doc.createElement('span'), { textContent: title }))
    header.appendChild(Object.assign(doc.createElement('span'), { className: 'd2-mods__group-count', textContent: `${String(cards.filter((card) => card.enabled).length)}/${String(cards.length)}` }))
    return header
  }

  private switchFor(doc: Document, card: PluginMenuCardViewModel, lang: GameLang, big = false): HTMLElement {
    const input = Object.assign(doc.createElement('input'), { type: 'checkbox', checked: card.enabled, className: big ? 'd2-mods__switch d2-mods__switch--big' : 'd2-mods__switch' })
    input.setAttribute('data-plugin-toggle', card.id)
    input.setAttribute('aria-label', `${card.name}: ${menuText(card.enabled ? 'on' : 'off', lang)}`)
    input.addEventListener('click', (e) => {
      e.stopPropagation()
    })
    input.addEventListener('change', () => {
      void this.host.setEnabled(card.id, input.checked)
    })
    return input
  }

  private row(doc: Document, card: PluginMenuCardViewModel, selected: boolean, lang: GameLang): HTMLElement {
    const row = Object.assign(doc.createElement('div'), { className: ['d2-mods__row', selected ? 'is-selected' : '', card.statusLevel === 'error' ? 'is-error' : '', card.enabled ? '' : 'is-off'].filter(Boolean).join(' ') })
    row.setAttribute('role', 'tab')
    row.setAttribute('aria-selected', String(selected))
    row.setAttribute('data-plugin-nav', card.id)
    row.addEventListener('click', () => {
      this.selectPlugin(card.id)
    })
    row.appendChild(Object.assign(doc.createElement('span'), { className: `d2-mods__dot d2-mods__dot--${card.statusLevel}` }))
    row.appendChild(Object.assign(doc.createElement('span'), { className: 'd2-mods__name', textContent: card.name }))
    row.appendChild(this.switchFor(doc, card, lang))
    return row
  }

  private details(doc: Document, card: PluginMenuCardViewModel, lang: GameLang): HTMLElement {
    const panel = Object.assign(doc.createElement('div'), { className: card.statusLevel === 'error' ? 'd2-mods__card is-error' : 'd2-mods__card' })
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('data-plugin-id', card.id)
    const head = Object.assign(doc.createElement('div'), { className: 'd2-mods__card-head' })
    const name = Object.assign(doc.createElement('h3'), { className: 'd2-mods__card-name', textContent: card.name })
    const status = Object.assign(doc.createElement('span'), { className: `d2-mods__status d2-mods__status--${card.statusLevel}`, textContent: card.statusText })
    status.setAttribute('data-plugin-status', card.id)
    const switchLabel = Object.assign(doc.createElement('label'), { className: 'd2-mods__switch-label' })
    switchLabel.appendChild(Object.assign(doc.createElement('span'), { textContent: menuText(card.enabled ? 'on' : 'off', lang) }))
    switchLabel.appendChild(this.switchFor(doc, card, lang, true))
    const titles = Object.assign(doc.createElement('div'), { className: 'd2-mods__card-titles' })
    titles.appendChild(name)
    titles.appendChild(status)
    head.appendChild(titles)
    head.appendChild(switchLabel)
    panel.appendChild(head)
    if (card.author) {
      const credit = Object.assign(doc.createElement('p'), {
        className: 'd2-mods__author',
        textContent: menuText('authorCredit', lang, { author: card.author }),
      })
      credit.setAttribute('data-plugin-author', card.author)
      panel.appendChild(credit)
    }
    panel.appendChild(Object.assign(doc.createElement('p'), { className: 'd2-mods__desc', textContent: card.description }))
    const hint = !card.enabled ? menuText('disabled', lang) : card.settings.length === 0 && card.actions.length === 0 ? menuText('noSettings', lang) : null
    if (hint !== null) panel.appendChild(Object.assign(doc.createElement('p'), { className: 'd2-mods__note', textContent: hint }))
    else panel.appendChild(this.controls(doc, card))
    return panel
  }

  private controls(doc: Document, card: PluginMenuCardViewModel): HTMLElement {
    const box = Object.assign(doc.createElement('div'), { className: 'd2-mods__settings' })
    card.settings.forEach((setting) => {
      const row = Object.assign(doc.createElement('label'), { className: 'd2-mods__setting' })
      row.appendChild(Object.assign(doc.createElement('span'), { textContent: setting.label }))
      if (setting.kind === 'boolean') {
        const input = Object.assign(doc.createElement('input'), { type: 'checkbox', checked: setting.value, className: 'd2-mods__switch' })
        input.setAttribute('data-plugin-setting', `${card.id}:${setting.key}`)
        input.addEventListener('change', () => {
          this.host.setSetting(card.id, setting.key, input.checked)
        })
        row.appendChild(input)
      } else {
        const select = Object.assign(doc.createElement('select'), { className: 'd2-mods__select' })
        select.setAttribute('data-plugin-setting', `${card.id}:${setting.key}`)
        setting.options.forEach((option) => select.appendChild(Object.assign(doc.createElement('option'), { value: option.value, textContent: option.label })))
        select.value = setting.value
        select.addEventListener('change', () => {
          this.host.setSetting(card.id, setting.key, select.value)
        })
        row.appendChild(select)
      }
      box.appendChild(row)
    })
    if (card.actions.length > 0) {
      const actions = Object.assign(doc.createElement('div'), { className: 'd2-mods__actions' })
      card.actions.forEach((action) => {
        const button =
          action.kind === 'link'
            ? Object.assign(doc.createElement('a'), { className: 'd2-mods__button', href: action.href, target: '_blank', rel: 'noopener', textContent: action.label })
            : Object.assign(doc.createElement('button'), { className: 'd2-mods__button', type: 'button', textContent: action.label })
        button.setAttribute('data-plugin-action', `${card.id}:${action.id}`)
        if (action.kind === 'button')
          button.addEventListener('click', () => {
            this.host.runAction(card.id, action.id)
          })
        actions.appendChild(button)
      })
      box.appendChild(actions)
    }
    return box
  }
}

import { getLevelNames } from '../../common/world/level-names-zh.ts'

export interface PageTitleState {
  readonly areaId: number
  readonly level: number
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dd96"/><stop offset=".55" stop-color="#d4762a"/><stop offset="1" stop-color="#8a2410"/></linearGradient></defs><rect width="32" height="32" rx="7" fill="#140c07"/><path d="M16 4c3 5 8 8.5 8 14.5a8 8 0 0 1-16 0c0-3.2 1.6-5.4 3.6-7.2 0 3 1.4 4.6 3 5.2-1.1-4.2.1-8.4 1.4-12.5Z" fill="url(#g)"/></svg>`

export const pageTitle = (state: PageTitleState | null): string =>
  state && state.areaId > 0 ? `${getLevelNames(state.areaId).nameEn} · Level ${state.level} · Diablo II` : 'Diablo II · in your browser'

export function startPageTitle(read: () => PageTitleState | null, doc: Document = document): void {
  const icon = Object.assign(doc.createElement('link'), { rel: 'icon', type: 'image/svg+xml', href: `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}` })
  doc.head.append(icon)
  const update = () => {
    const title = pageTitle(read())
    if (doc.title !== title) doc.title = title
  }
  update()
  setInterval(update, 1000)
}

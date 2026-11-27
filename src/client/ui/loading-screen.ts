import type { BootProgressSnapshot } from './boot-progress.ts'

const RESOURCE_NAMES: Readonly<Record<string, string>> = {
  字体资源: 'fonts',
  小地图资源: 'the automap',
  技能图标资源: 'skill icons',
  物品图标资源: 'item graphics',
  投射物特效资源: 'missiles',
  光环与状态特效: 'auras and effects',
  角色美术资源: 'characters',
  怪物美术资源: 'monsters',
  地图地形资源: 'map tiles',
  主菜单与大厅界面: 'menus',
  游戏界面资源: 'the interface',
  资源配置数据: 'data tables',
  美术贴图资源: 'artwork',
}

export const LOADING_TIPS: readonly string[] = [
  'Hold Shift to attack without moving.',
  'Press Alt to see the names of items on the ground.',
  'Shift-click a potion in your inventory to put it on your belt.',
  'Hold Shift and press a belt key to give that potion to your mercenary.',
  'Ethereal items hit harder but can never be repaired.',
  'Deckard Cain identifies your items for free once you rescue him.',
  'The Countess drops runes on every difficulty.',
  'Press Tab to show or hide the automap.',
  'Gheed, Elzix, Alkor, Jamella and Anya will let you gamble.',
  'Insight works in a staff or polearm, which makes it a great mercenary runeword.',
  'Turn on Auto-Fight in Plugins, then press E to let your character fight.',
  'Green arrows on loot mean it beats what you are wearing.',
]

const EMBERS = 14

export const loadingStatus = ({ status, currentFile }: BootProgressSnapshot): string =>
  status === 'completed' ? 'Entering Sanctuary' : `Loading ${RESOURCE_NAMES[currentFile] ?? 'game files'}`

const emberStyle = (i: number) => `--x: ${(i * 37) % 100}%; --delay: ${(-((i * 1.7) % 9)).toFixed(1)}s; --drift: ${((i * 13) % 9) - 4}vw; --life: ${7 + (i % 4)}s`

export function decorateLoadingScreen(tracker: { subscribe(listener: (snap: BootProgressSnapshot) => void): () => void }, doc: Document = document): void {
  const root = doc.getElementById('d2-boot-loading')
  const status = doc.getElementById('d2-boot-progress-file')
  if (!root || !status) return
  const embers = Object.assign(doc.createElement('div'), { className: 'd2-loading__embers', ariaHidden: 'true' })
  embers.innerHTML = Array.from({ length: EMBERS }, (_, i) => `<span class="d2-loading__ember" style="${emberStyle(i)}"></span>`).join('')
  const tip = Object.assign(doc.createElement('p'), { className: 'd2-loading__tip' })
  root.prepend(embers)
  root.append(tip)
  let tipIndex = Math.floor(Math.random() * LOADING_TIPS.length)
  const showTip = () => (tip.textContent = LOADING_TIPS[tipIndex++ % LOADING_TIPS.length]!)
  showTip()
  tip.addEventListener('animationiteration', showTip)
  const unsubscribe = tracker.subscribe((snap) => {
    status.textContent = loadingStatus(snap)
    status.title = status.textContent
    if (snap.status === 'completed') unsubscribe()
  })
}

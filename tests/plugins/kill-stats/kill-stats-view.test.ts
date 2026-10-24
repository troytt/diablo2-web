import { describe, expect, it, vi } from 'vitest'
import {
  computeCharKey,
  computeTallyId,
  type KillCharacterRecord,
  type KillStatsSnapshot,
  type KillTallyRecord,
} from '../../../plugins/kill-stats/kill-stats-model.ts'
import {
  BOSS_SU_BOARD_ROW_COUNT,
  buildKillStatsViewModel,
  getBossSuperUniqueBoardCatalog,
  resolveCharacterClassName,
  resolveLocalizedMonsterName,
} from '../../../plugins/kill-stats/kill-stats-view.ts'
import { bootStatsApp } from '../../../plugins/kill-stats/page-main.ts'
import { KillStatsPage } from '../../../plugins/kill-stats/stats-page.ts'
import type {
  GameLang,
  PluginPageContext,
} from '../../../src/client/plugin-host/api.ts'
import { MemoryKillStatsRepository } from './memory-repository.ts'


const REPLICA_A = '11111111-1111-4111-8111-111111111111'
const REPLICA_B = '22222222-2222-4222-8222-222222222222'

function makeChar(overrides: Partial<KillCharacterRecord> & {
  host: string
  realm: string
  account: string
  charName: string
}): KillCharacterRecord {
  const charKey = computeCharKey(
    overrides.host,
    overrides.realm,
    overrides.account,
    overrides.charName,
  )
  return {
    charKey,
    host: overrides.host,
    realm: overrides.realm,
    account: overrides.account,
    charName: overrides.charName,
    charClass: overrides.charClass ?? 1,
    level: overrides.level ?? 85,
    hardcore: overrides.hardcore ?? true,
    expansion: overrides.expansion ?? true,
    ladder: overrides.ladder ?? true,
    firstSeenAt: overrides.firstSeenAt ?? 1000,
    lastSeenAt: overrides.lastSeenAt ?? 2000,
  }
}

function makeTally(params: {
  replicaId?: string
  charKey: string
  kind: 'monster' | 'boss' | 'superunique'
  difficulty: 0 | 1 | 2
  subject: number
  count: number
  soloCount: number
  firstAt?: number
  lastAt?: number
}): KillTallyRecord {
  const replicaId = params.replicaId ?? REPLICA_A
  return {
    id: computeTallyId(
      replicaId,
      params.charKey,
      params.kind,
      params.difficulty,
      params.subject,
    ),
    replicaId,
    charKey: params.charKey,
    kind: params.kind,
    difficulty: params.difficulty,
    subject: params.subject,
    count: params.count,
    soloCount: params.soloCount,
    firstAt: params.firstAt ?? 1000,
    lastAt: params.lastAt ?? 2000,
  }
}

describe('kill-stats-view (Pure View Model & 86-Row Boss/SU Board)', () => {
  it('derives the exact 86-row Boss & SuperUnique catalog (20 standalone bosses + 66 SuperUniques with 4 merged overlaps)', () => {
    const catalog = getBossSuperUniqueBoardCatalog()
    expect(catalog).toHaveLength(BOSS_SU_BOARD_ROW_COUNT)

    const bossRows = catalog.filter((r) => r.rowKind === 'boss')
    const suRows = catalog.filter((r) => r.rowKind === 'superunique')
    expect(bossRows).toHaveLength(20)
    expect(suRows).toHaveLength(66)

    // Verify the 4 overlap boss hcIdx values are NOT present as standalone boss rows
    const standaloneBossSubjects = new Set(bossRows.map((r) => r.subject))
    expect(standaloneBossSubjects.has(229)).toBe(false) // radament -> SU10
    expect(standaloneBossSubjects.has(250)).toBe(false) // summoner -> SU18
    expect(standaloneBossSubjects.has(365)).toBe(false) // griswold -> SU5
    expect(standaloneBossSubjects.has(526)).toBe(false) // nihlathakboss -> SU60

    // Verify they are merged into SU5, SU10, SU18, SU60
    const mergedSu = suRows
      .filter((r) => r.mergedBossHcIdx !== null)
      .map((r) => ({ suIdx: r.subject, id: r.canonicalId, mergedBossHcIdx: r.mergedBossHcIdx }))
    expect(mergedSu).toEqual([
      { suIdx: 5, id: 'Griswold', mergedBossHcIdx: 365 },
      { suIdx: 10, id: 'Radament', mergedBossHcIdx: 229 },
      { suIdx: 18, id: 'The Summoner', mergedBossHcIdx: 250 },
      { suIdx: 60, id: 'Nihlathak Boss', mergedBossHcIdx: 526 },
    ])
  })

  it('disambiguates the 12 duplicate-name Boss rows with canonicalId subtitles in both zh and en', () => {
    const emptySnapshot: KillStatsSnapshot = {
      replicaId: REPLICA_A,
      characters: [],
      tallies: [],
    }

    const expectedDupCanonicalIds = [
      'baalclone',
      'baalcrab',
      'diablo',
      'diabloclone',
      'duriel',
      'izual',
      'mephisto',
      'uberbaal',
      'uberdiablo',
      'uberduriel',
      'uberizual',
      'ubermephisto',
    ]

    for (const lang of ['zh', 'en'] as const) {
      const vm = buildKillStatsViewModel(emptySnapshot, { lang, showUnkilled: true })
      expect(vm.boardRows).toHaveLength(86)
      const withSubtitle = vm.boardRows
        .filter((r) => r.subtitle !== null)
        .map((r) => r.subtitle!)
        .sort()
      expect(withSubtitle).toEqual(expectedDupCanonicalIds)

      // Unique names like Andariel and Pindleskin have null subtitle
      const andariel = vm.boardRows.find((r) => r.canonicalId === 'andariel')
      const pindleskin = vm.boardRows.find((r) => r.canonicalId === 'Pindleskin')
      expect(andariel?.subtitle).toBeNull()
      expect(pindleskin?.subtitle).toBeNull()
    }
  })

  it('merges tallies for the 4 overlapping Boss/SuperUnique rows (SU5/365, SU10/229, SU18/250, SU60/526) without double-counting summary totals', () => {
    const char = makeChar({
      host: 'www.laiseek.xyz',
      realm: 'D2CS',
      account: 'acct1',
      charName: 'SorcA',
    })

    const snapshot: KillStatsSnapshot = {
      replicaId: REPLICA_A,
      characters: [char],
      tallies: [
        // Radament killed once as boss/229 in Normal, and once as superunique/10 in Hell
        makeTally({
          charKey: char.charKey,
          kind: 'monster',
          difficulty: 0,
          subject: 229,
          count: 1,
          soloCount: 1,
          lastAt: 1500,
        }),
        makeTally({
          charKey: char.charKey,
          kind: 'boss',
          difficulty: 0,
          subject: 229,
          count: 1,
          soloCount: 1,
          lastAt: 1500,
        }),
        makeTally({
          charKey: char.charKey,
          kind: 'monster',
          difficulty: 2,
          subject: 229,
          count: 2,
          soloCount: 1,
          lastAt: 3500,
        }),
        makeTally({
          charKey: char.charKey,
          kind: 'superunique',
          difficulty: 2,
          subject: 10,
          count: 2,
          soloCount: 1,
          lastAt: 3500,
        }),
      ],
    }

    const vm = buildKillStatsViewModel(snapshot, { showUnkilled: false })
    // Summary cards sum ONLY kind === 'monster'
    expect(vm.summary).toEqual({
      normal: 1,
      nightmare: 0,
      hell: 2,
      total: 3,
    })

    // Board has only SU10 (Radament) with Normal=1, Hell=2, Total=3, lastAt=3500
    expect(vm.boardRows).toHaveLength(1)
    expect(vm.boardRows[0]).toMatchObject({
      key: 'superunique:10',
      canonicalId: 'Radament',
      normal: 1,
      nightmare: 0,
      hell: 2,
      total: 3,
      lastAt: 3500,
    })
  })

  it('supports All / Account / Character scopes, cross-replica summation, and soloOnly filtering', () => {
    const char1 = makeChar({
      host: 'www.laiseek.xyz',
      realm: 'D2CS',
      account: 'Alpha',
      charName: 'SorcOne',
      charClass: 1,
      level: 90,
    })
    const char2 = makeChar({
      host: 'www.laiseek.xyz',
      realm: 'D2CS',
      account: 'Alpha',
      charName: 'PalTwo',
      charClass: 3,
      level: 82,
    })
    const char3 = makeChar({
      host: 'www.laiseek.xyz',
      realm: 'D2CS',
      account: 'Beta',
      charName: 'BarbThree',
      charClass: 4,
      level: 75,
    })

    const snapshot: KillStatsSnapshot = {
      replicaId: REPLICA_A,
      characters: [char1, char2, char3],
      tallies: [
        // char1 on replica A & replica B: Andariel (156) in Hell
        makeTally({
          replicaId: REPLICA_A,
          charKey: char1.charKey,
          kind: 'monster',
          difficulty: 2,
          subject: 156,
          count: 3,
          soloCount: 2,
        }),
        makeTally({
          replicaId: REPLICA_B,
          charKey: char1.charKey,
          kind: 'monster',
          difficulty: 2,
          subject: 156,
          count: 4,
          soloCount: 4,
        }),
        // char2 on replica A: Fallen (19) in Normal (party only: soloCount = 0)
        makeTally({
          replicaId: REPLICA_A,
          charKey: char2.charKey,
          kind: 'monster',
          difficulty: 0,
          subject: 19,
          count: 10,
          soloCount: 0,
        }),
        // char3 on replica A: Baal (544) in Nightmare
        makeTally({
          replicaId: REPLICA_A,
          charKey: char3.charKey,
          kind: 'monster',
          difficulty: 1,
          subject: 544,
          count: 5,
          soloCount: 5,
        }),
      ],
    }

    // 1. All scope, soloOnly = false
    const allVm = buildKillStatsViewModel(snapshot, { scope: { kind: 'all' }, soloOnly: false })
    expect(allVm.totalAllAccountsKills).toBe(3 + 4 + 10 + 5)
    expect(allVm.summary).toEqual({
      normal: 10,
      nightmare: 5,
      hell: 7,
      total: 22,
    })
    expect(allVm.accounts).toHaveLength(2)
    expect(allVm.accounts[0]?.account).toBe('Alpha')
    expect(allVm.accounts[0]?.totalKills).toBe(17)
    expect(allVm.accounts[1]?.account).toBe('Beta')
    expect(allVm.accounts[1]?.totalKills).toBe(5)

    // 2. Account scope ('Alpha'), soloOnly = false
    const acctVm = buildKillStatsViewModel(snapshot, {
      scope: { kind: 'account', host: 'www.laiseek.xyz', realm: 'D2CS', account: 'Alpha' },
      soloOnly: false,
    })
    expect(acctVm.summary).toEqual({
      normal: 10,
      nightmare: 0,
      hell: 7,
      total: 17,
    })

    // 3. Account scope ('Alpha'), soloOnly = true -> char2's party-only Fallen kills drop to 0
    const acctSoloVm = buildKillStatsViewModel(snapshot, {
      scope: { kind: 'account', host: 'www.laiseek.xyz', realm: 'D2CS', account: 'Alpha' },
      soloOnly: true,
    })
    expect(acctSoloVm.summary).toEqual({
      normal: 0,
      nightmare: 0,
      hell: 6,
      total: 6,
    })
    // Fallen (19) had soloCount = 0 so it should not appear in monsterRows when soloOnly = true
    expect(acctSoloVm.monsterRows.map((r) => r.hcIdx)).toEqual([156])

    // 4. Character scope (char1)
    const charVm = buildKillStatsViewModel(snapshot, {
      scope: { kind: 'character', charKey: char1.charKey },
      soloOnly: false,
    })
    expect(charVm.selectedCharacter?.charName).toBe('SorcOne')
    expect(charVm.summary).toEqual({
      normal: 0,
      nightmare: 0,
      hell: 7,
      total: 7,
    })
  })

  it('resolves bilingual names (trimming Act 5 space-padded CHI entries) and supports sorting and search on the monster table', () => {
    // hcIdx 440 = reanimatedhorde5 (NameStr = DefiledWarrior, which is space-padded in CHI .tbl)
    const zh440 = resolveLocalizedMonsterName('DefiledWarrior', 'reanimatedhorde5', 'zh')
    const en440 = resolveLocalizedMonsterName('DefiledWarrior', 'reanimatedhorde5', 'en')
    expect(zh440.trim().length).toBeGreaterThan(0)
    expect(en440).toBe('Defiled Warrior')

    expect(resolveCharacterClassName(1, 'zh')).toBe('法師')
    expect(resolveCharacterClassName(1, 'en')).toBe('Sorceress')

    const char = makeChar({
      host: 'www.laiseek.xyz',
      realm: 'D2CS',
      account: 'acct',
      charName: 'Hero',
    })
    const snapshot: KillStatsSnapshot = {
      replicaId: REPLICA_A,
      characters: [char],
      tallies: [
        makeTally({
          charKey: char.charKey,
          kind: 'monster',
          difficulty: 0,
          subject: 19, // fallen1
          count: 25,
          soloCount: 25,
        }),
        makeTally({
          charKey: char.charKey,
          kind: 'monster',
          difficulty: 2,
          subject: 156, // andariel
          count: 5,
          soloCount: 5,
        }),
        makeTally({
          charKey: char.charKey,
          kind: 'monster',
          difficulty: 1,
          subject: 544, // baalcrab
          count: 12,
          soloCount: 12,
        }),
      ],
    }

    // Sort by total desc (default)
    const byTotalDesc = buildKillStatsViewModel(snapshot)
    expect(byTotalDesc.monsterRows.map((r) => r.hcIdx)).toEqual([19, 544, 156])

    // Sort by hcIdx asc
    const byHcIdxAsc = buildKillStatsViewModel(snapshot, {
      monsterSort: { column: 'hcIdx', direction: 'asc' },
    })
    expect(byHcIdxAsc.monsterRows.map((r) => r.hcIdx)).toEqual([19, 156, 544])

    // Search by Chinese name ('安達利爾'), English name ('andariel'), or canonical ID ('fallen1')
    const searchZh = buildKillStatsViewModel(snapshot, { monsterSearch: '安達利爾' })
    expect(searchZh.monsterRows.map((r) => r.hcIdx)).toEqual([156])

    const searchEn = buildKillStatsViewModel(snapshot, { monsterSearch: 'ANDARIEL' })
    expect(searchEn.monsterRows.map((r) => r.hcIdx)).toEqual([156])

    const searchId = buildKillStatsViewModel(snapshot, { monsterSearch: 'fallen1' })
    expect(searchId.monsterRows.map((r) => r.hcIdx)).toEqual([19])
  })
})

class StatsFakeClassList {
  private readonly classes = new Set<string>()
  constructor(private readonly owner: StatsFakeElement) {}
  syncFrom(className: string): void {
    this.classes.clear()
    for (const part of className.split(/\s+/)) {
      if (part) this.classes.add(part)
    }
  }
  private flush(): void {
    this.owner.syncClassName([...this.classes].join(' '))
  }
  add(...tokens: string[]): void {
    for (const t of tokens) if (t) this.classes.add(t)
    this.flush()
  }
  remove(...tokens: string[]): void {
    for (const t of tokens) this.classes.delete(t)
    this.flush()
  }
  toggle(token: string, force?: boolean): boolean {
    const next = force !== undefined ? force : !this.classes.has(token)
    if (next) this.classes.add(token)
    else this.classes.delete(token)
    this.flush()
    return next
  }
  contains(token: string): boolean {
    return this.classes.has(token)
  }
}

class StatsFakeElement {
  readonly tagName: string
  readonly ownerDocument: StatsFakeDocument
  readonly dataset: Record<string, string> = {}
  readonly style: Record<string, string> = {}
  readonly classList: StatsFakeClassList
  readonly children: StatsFakeElement[] = []
  parentNode: StatsFakeElement | null = null
  id = ''
  type = ''
  checked = false
  disabled = false
  value = ''
  placeholder = ''
  href = ''
  download = ''
  accept = ''
  colSpan = 1
  lang = ''
  hidden = false
  private rawClassName = ''
  private text = ''
  private readonly attrs = new Map<string, string>()
  private readonly listeners = new Map<string, ((ev: { type: string }) => void)[]>()

  constructor(tagName: string, ownerDocument: StatsFakeDocument) {
    this.tagName = tagName.toLowerCase()
    this.ownerDocument = ownerDocument
    this.classList = new StatsFakeClassList(this)
  }

  get className(): string {
    return this.rawClassName
  }

  set className(val: string) {
    this.rawClassName = val
    this.classList.syncFrom(val)
  }

  syncClassName(val: string): void {
    this.rawClassName = val
  }

  get firstChild(): StatsFakeElement | null {
    return this.children[0] ?? null
  }

  get textContent(): string {
    if (this.children.length === 0) return this.text
    return this.text + this.children.map((c) => c.textContent).join('')
  }

  set textContent(val: string | null) {
    this.children.length = 0
    this.text = val ?? ''
  }

  setAttribute(name: string, val: string): void {
    if (name === 'id') this.id = val
    this.attrs.set(name, val)
  }

  getAttribute(name: string): string | null {
    if (name === 'id' && this.id) return this.id
    return this.attrs.get(name) ?? null
  }

  appendChild(child: StatsFakeElement): StatsFakeElement {
    if (child.parentNode) {
      child.parentNode.removeChild(child)
    }
    child.parentNode = this
    this.children.push(child)
    return child
  }

  append(...nodes: StatsFakeElement[]): void {
    for (const node of nodes) {
      this.appendChild(node)
    }
  }

  removeChild(child: StatsFakeElement): StatsFakeElement {
    const idx = this.children.indexOf(child)
    if (idx >= 0) {
      this.children.splice(idx, 1)
      child.parentNode = null
    }
    return child
  }

  addEventListener(type: string, cb: (ev: { type: string }) => void): void {
    const list = this.listeners.get(type) ?? []
    list.push(cb)
    this.listeners.set(type, list)
  }

  dispatchEvent(ev: { type: string }): void {
    for (const cb of [...(this.listeners.get(ev.type) ?? [])]) {
      cb(ev)
    }
  }

  click(): void {
    this.dispatchEvent({ type: 'click' })
  }

  findById(id: string): StatsFakeElement | null {
    if (this.id === id) return this
    for (const child of this.children) {
      const found = child.findById(id)
      if (found) return found
    }
    return null
  }
}

class StatsFakeDocument {
  readonly documentElement: StatsFakeElement
  readonly body: StatsFakeElement
  title = ''

  constructor() {
    this.documentElement = new StatsFakeElement('html', this)
    this.body = new StatsFakeElement('body', this)
    this.documentElement.appendChild(this.body)
  }

  createElement(tagName: string): StatsFakeElement {
    return new StatsFakeElement(tagName, this)
  }

  getElementById(id: string): StatsFakeElement | null {
    return this.documentElement.findById(id)
  }
}

function makeFakePageContext(initialLang: GameLang = 'zh', initialEnabled = true): {
  pageContext: PluginPageContext
  setEnabledExternal(enabled: boolean): void
} {
  let lang: GameLang = initialLang
  let enabled = initialEnabled
  const langSubs = new Set<(l: GameLang) => void>()
  const enabledSubs = new Set<(e: boolean) => void>()
  const settingsSubs = new Set<(key: string) => void>()
  const settings: Record<string, boolean | string> = { showToolbarShortcut: true }

  const pageContext: PluginPageContext = {
    pluginId: 'kill-stats',
    getLang: () => lang,
    setLang(next) {
      lang = next
      for (const cb of langSubs) cb(lang)
    },
    subscribeLang(cb) {
      langSubs.add(cb)
      return () => langSubs.delete(cb)
    },
    isEnabled: () => enabled,
    subscribeEnabled(cb) {
      enabledSubs.add(cb)
      return () => enabledSubs.delete(cb)
    },
    getSetting: <T extends boolean | string = boolean | string>(key: string): T =>
      settings[key] as T,
    setSetting(key, val) {
      settings[key] = val
      for (const cb of settingsSubs) cb(key)
    },
    subscribeSettings(cb) {
      settingsSubs.add(cb)
      return () => settingsSubs.delete(cb)
    },
    destroy() {
      langSubs.clear()
      enabledSubs.clear()
      settingsSubs.clear()
    },
  }

  return {
    pageContext,
    setEnabledExternal(next: boolean) {
      enabled = next
      for (const cb of enabledSubs) cb(enabled)
    },
  }
}

describe('KillStatsPage & bootStatsApp (DOM Controller, Live Banner & Failure Paths)', () => {
  it('mounts DOM, renders KPI cards, toggles solo/language/disabled-banner, exports/imports JSON, and deletes/clears with confirmation', async () => {
    const fakeDoc = new StatsFakeDocument()
    const root = fakeDoc.createElement('div')
    root.id = 'd2-stats-app'
    fakeDoc.body.appendChild(root)

    const repository = new MemoryKillStatsRepository({
      initialReplicaId: REPLICA_A,
    })
    const char = makeChar({
      host: 'www.laiseek.xyz',
      realm: 'D2CS',
      account: 'DeckardCain',
      charName: 'SorcHero',
      charClass: 1,
      level: 88,
      hardcore: true,
      expansion: true,
      ladder: true,
    })
    await repository.applyBatch(
      char,
      [
        {
          charKey: char.charKey,
          kind: 'monster',
          difficulty: 2,
          subject: 156,
          count: 4,
          soloCount: 3,
          firstAt: 1000,
          lastAt: 2000,
        },
        {
          charKey: char.charKey,
          kind: 'boss',
          difficulty: 2,
          subject: 156,
          count: 4,
          soloCount: 3,
          firstAt: 1000,
          lastAt: 2000,
        },
      ],
      2000,
    )

    const { pageContext, setEnabledExternal } = makeFakePageContext('zh', true)
    let confirmResult = true

    const page = new KillStatsPage({
      root: root as unknown as HTMLElement,
      repository,
      pageContext,
      confirmFn: () => confirmResult,
    })
    await page.init()

    expect(fakeDoc.getElementById('d2-stats-val-hell')?.textContent).toBe('4')
    expect(fakeDoc.getElementById('d2-stats-val-total')?.textContent).toBe('4')
    expect(fakeDoc.getElementById('d2-stats-disabled-notice')?.hidden).toBe(true)

    // Toggle solo-only filter -> Hell count updates from 4 to 3
    const soloCheckbox = fakeDoc.getElementById('d2-stats-solo-only')!
    soloCheckbox.checked = true
    soloCheckbox.dispatchEvent({ type: 'change' })
    expect(fakeDoc.getElementById('d2-stats-val-hell')?.textContent).toBe('3')
    soloCheckbox.checked = false
    soloCheckbox.dispatchEvent({ type: 'change' })
    expect(fakeDoc.getElementById('d2-stats-val-hell')?.textContent).toBe('4')

    // Live cross-tab plugin disable updates #d2-stats-disabled-notice immediately
    setEnabledExternal(false)
    expect(fakeDoc.getElementById('d2-stats-disabled-notice')?.hidden).toBe(false)
    setEnabledExternal(true)
    expect(fakeDoc.getElementById('d2-stats-disabled-notice')?.hidden).toBe(true)

    // Toggle language zh -> en (pure English DOM, zero CJK characters)
    fakeDoc.getElementById('d2-stats-lang-toggle')!.click()
    expect(pageContext.getLang()).toBe('en')
    expect(fakeDoc.documentElement.lang).toBe('en')
    expect(/[\u4e00-\u9fff]/.test(root.textContent)).toBe(false)

    // Export JSON, clear all, then re-import JSON
    const exported = await page.handleExportJson()
    expect(page.getLastExportJson()).toBe(exported)

    // Cancelled confirmation prevents clearAll
    confirmResult = false
    expect(await page.handleClearAll()).toBe(false)
    expect(fakeDoc.getElementById('d2-stats-val-total')?.textContent).toBe('4')

    // Confirmed clearAll wipes data and shows empty state
    confirmResult = true
    expect(await page.handleClearAll()).toBe(true)
    expect(fakeDoc.getElementById('d2-stats-val-total')?.textContent).toBe('0')
    expect(fakeDoc.getElementById('d2-stats-empty-state')?.hidden).toBe(false)

    // Invalid import displays role="alert" error banner
    const badSummary = await page.handleImportJsonText('{"version": 999}')
    expect(badSummary).toBeNull()
    const errBanner = fakeDoc.getElementById('d2-stats-error-banner')!
    expect(errBanner.hidden).toBe(false)
    expect(errBanner.getAttribute('role')).toBe('alert')

    // Valid import restores all tallies and clears error banner
    const goodSummary = await page.handleImportJsonText(exported)
    expect(goodSummary?.addedTallies).toBe(2)
    expect(errBanner.hidden).toBe(true)
    expect(fakeDoc.getElementById('d2-stats-val-total')?.textContent).toBe('4')

    // Delete single character
    expect(await page.handleDeleteSelectedCharacter()).toBe(true)
    expect(fakeDoc.getElementById('d2-stats-val-total')?.textContent).toBe('0')

    page.destroy()
  })

  it('logs console.error, renders role="alert" error banner, rejects page.init() on loadAll() failure, and sets window.__d2StatsApp.ready = false in bootStatsApp()', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fakeDoc = new StatsFakeDocument()
    const root = fakeDoc.createElement('div')
    root.id = 'd2-stats-app'
    fakeDoc.body.appendChild(root)

    const failingRepository = new MemoryKillStatsRepository()
    vi.spyOn(failingRepository, 'loadAll').mockRejectedValue(
      new Error('Simulated IndexedDB open failure'),
    )

    const { pageContext } = makeFakePageContext('en', true)
    const page = new KillStatsPage({
      root: root as unknown as HTMLElement,
      repository: failingRepository,
      pageContext,
    })

    await expect(page.init()).rejects.toThrow('Simulated IndexedDB open failure')
    expect(errSpy).toHaveBeenCalledWith(
      '[kill-stats] Failed to load kill stats snapshot:',
      expect.any(Error),
    )

    const errBanner = fakeDoc.getElementById('d2-stats-error-banner')
    expect(errBanner).not.toBeNull()
    expect(errBanner?.hidden).toBe(false)
    expect(errBanner?.getAttribute('role')).toBe('alert')
    expect(errBanner?.textContent).toContain('Simulated IndexedDB open failure')
    page.destroy()

    // Also verify bootStatsApp() catches init() failure (when IndexedDB is unavailable in Node) and exposes window.__d2StatsApp.ready === false
    const prevDoc = (globalThis as { document?: unknown }).document
    const prevWin = (globalThis as { window?: unknown }).window
    const bootDoc = new StatsFakeDocument()
    const bootRoot = bootDoc.createElement('div')
    bootRoot.id = 'd2-stats-app'
    bootDoc.body.appendChild(bootRoot)
    const bootWin: Record<string, unknown> = {}

    ;(globalThis as unknown as { document: unknown }).document = bootDoc
    ;(globalThis as unknown as { window: unknown }).window = bootWin
    try {
      await bootStatsApp()
      const app = bootWin.__d2StatsApp as { ready: boolean; page: KillStatsPage } | undefined
      expect(app).toBeDefined()
      expect(app?.ready).toBe(false)
      const bootBanner = bootDoc.getElementById('d2-stats-error-banner')
      expect(bootBanner?.hidden).toBe(false)
      expect(bootBanner?.getAttribute('role')).toBe('alert')
      app?.page.destroy()
    } finally {
      ;(globalThis as unknown as { document: unknown }).document = prevDoc
      ;(globalThis as unknown as { window: unknown }).window = prevWin
      errSpy.mockRestore()
    }
  })

  it('synchronizes KillStatsPage with main controller d2web.settings.v1 on /plugins/kill-stats/index.html without overwriting stored en setting', async () => {
    const prevWin = (globalThis as { window?: unknown }).window
    const storeMap = new Map<string, string>([
      ['d2web.settings.v1', JSON.stringify({ version: 1, lang: 'en' })],
    ])
    const storageListeners: Array<(ev: { key: string | null }) => void> = []

    ;(globalThis as { window?: unknown }).window = {
      location: {
        pathname: '/plugins/kill-stats/index.html',
        search: '',
        protocol: 'http:',
      },
      localStorage: {
        getItem: (k: string) => storeMap.get(k) ?? null,
        setItem: (k: string, v: string) => storeMap.set(k, v),
        removeItem: (k: string) => storeMap.delete(k),
      },
      addEventListener(type: string, cb: (ev: { key: string | null }) => void) {
        if (type === 'storage') storageListeners.push(cb)
      },
      removeEventListener() {},
    }

    try {
      const fakeDoc = new StatsFakeDocument()
      const root = fakeDoc.createElement('div')
      root.id = 'd2-stats-app'
      fakeDoc.body.appendChild(root)

      const repository = new MemoryKillStatsRepository({
        initialReplicaId: REPLICA_A,
      })
      const page = new KillStatsPage({
        root: root as unknown as HTMLElement,
        repository,
      })
      await page.init()

      // Must preserve 'en' from main controller settings and render in English
      expect(fakeDoc.documentElement.lang).toBe('en')
      const storedAfterBoot = JSON.parse(storeMap.get('d2web.settings.v1')!) as { lang: string }
      expect(storedAfterBoot.lang).toBe('en')

      // Simulate main controller changing language to 'zh' via storage event
      storeMap.set('d2web.settings.v1', JSON.stringify({ version: 1, lang: 'zh' }))
      for (const fn of storageListeners) {
        fn({ key: 'd2web.settings.v1' })
      }
      expect(fakeDoc.documentElement.lang).toBe('zh-CN')

      page.destroy()
    } finally {
      ;(globalThis as { window?: unknown }).window = prevWin
    }
  })
})



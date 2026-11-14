/**
 * M21-P2 (#944) — F10 re-wired integration points (the parts with binding contracts today):
 * audio mute/volume settings and the D2GS 0x2C / 0xA4 guard in `ClientWorld`.
 *
 * Sources:
 * - Request R2 ("audio mute/volume settings"), PROJECT.md D8 + reland_plan §E.2 hook surfaces:
 *   `ClientSettings.audioMuted` (default false), `ClientSettings.masterVolume` 0..1 (default 0.8),
 *   both in the settings store's change detection; `ClientWorld.drainWorldSoundRequests()`.
 * - D8 guard: 0xA4 MonsterSpecialSkill decodes to `{type:'PlaySound', sound: classId}` without a unit;
 *   D2Client handler `0x6fb5d760` plays NO sound → it must never become a sound request.
 * - D24 (my finding `finding_0x2c_sound_codes.md`, made binding 15:00Z): the u16 of 0x2C is a sound
 *   EVENT CODE routed through D2Client `0x6fad3f20`; the raw code is never a Sounds.txt row. Literal
 *   cases encoded here: 10 → 2673 `shrine_refill` (volume 120), 13 → 2634 `object_trap_trigger`,
 *   14 → 2635 `object_trap_release`, 93 → 2553 `object_corpse_loot`; a non-player unit with a
 *   non-switch code plays nothing.
 * UI/panel/item hook ids and the end-to-end 0x2C → runtime path are added once the #944 scope fixes
 * those surfaces (DRAFT; see TEST_READY.md).
 */
import { describe, expect, it, vi } from 'vitest'
import { PRODUCT, loadProductModule, requireExport } from './harness-113c.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F10 = '#944 F10 integration points'

// ── Contracts ────────────────────────────────────────────────────────────────────────────────────
interface SettingsC {
  readonly audioMuted: boolean
  readonly masterVolume: number
  readonly [k: string]: unknown
}
interface SettingsModuleC {
  createDefaultClientSettings(lang?: string): SettingsC
  readonly DEFAULT_CLIENT_SETTINGS: SettingsC
  sanitizeClientSettings(raw: unknown, o?: Record<string, unknown>): SettingsC
  parseClientSettingsJson(raw: string | null, o?: Record<string, unknown>): SettingsC
}
interface StoreC {
  get(): SettingsC
  set(patch: Record<string, unknown>): SettingsC
  subscribe(l: (next: SettingsC, prev: SettingsC, changed: readonly string[]) => void): () => void
}
interface StoreModuleC {
  createSettingsStore(o?: Record<string, unknown>): StoreC
}
interface WorldC {
  apply(ev: unknown, nowMs?: number): void
  drainWorldSoundRequests(): unknown[]
}
type WorldCtor = new () => WorldC
type Decode = (pkt: Uint8Array) => unknown

async function settingsModule(): Promise<SettingsModuleC> {
  const m = await loadProductModule(PRODUCT.clientSettings, F10)
  for (const n of ['createDefaultClientSettings', 'DEFAULT_CLIENT_SETTINGS', 'sanitizeClientSettings', 'parseClientSettingsJson']) requireExport(m, n, PRODUCT.clientSettings, F10)
  return m as unknown as SettingsModuleC
}
async function storeModule(): Promise<StoreModuleC> {
  const m = await loadProductModule(PRODUCT.settingsStore, F10)
  requireExport(m, 'createSettingsStore', PRODUCT.settingsStore, F10)
  return m as unknown as StoreModuleC
}
async function world(): Promise<WorldC> {
  const m = await loadProductModule(PRODUCT.clientWorld, F10)
  const W = requireExport<WorldCtor>(m, 'ClientWorld', PRODUCT.clientWorld, F10)
  const w = new W()
  if (typeof (w as Partial<WorldC>).drainWorldSoundRequests !== 'function') {
    throw new Error(`[${F10}] ClientWorld has no drainWorldSoundRequests() (reland_plan §E.2 hook surface)`)
  }
  w.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 1 })
  return w
}
async function decoders(): Promise<{ playSound: Decode; monsterSpecial: Decode }> {
  const m = await loadProductModule(PRODUCT.netprotoMisc, F10)
  return {
    playSound: requireExport<Decode>(m, 'decode0x2CPlaySound', PRODUCT.netprotoMisc, F10),
    monsterSpecial: requireExport<Decode>(m, 'decode0xA4MonsterSpecial', PRODUCT.netprotoMisc, F10),
  }
}

/** Raw S→C 0x2C bytes: opcode, u8 unitType, u32 unitId, u16 code (D2Client 0x6fb5d740 reads [+1], [+2], [+6]). */
function pkt2C(unitType: number, unitId: number, code: number): Uint8Array {
  const b = new Uint8Array(8)
  const dv = new DataView(b.buffer)
  b[0] = 0x2c
  b[1] = unitType
  dv.setUint32(2, unitId, true)
  dv.setUint16(6, code, true)
  return b
}
function pktA4(classId: number): Uint8Array {
  const b = new Uint8Array(3)
  b[0] = 0xa4
  new DataView(b.buffer).setUint16(1, classId, true)
  return b
}

const memStorage = (): { data: Map<string, string>; getItem(k: string): string | null; setItem(k: string, v: string): void } => {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

/** The numeric Sounds.txt id a drained request names, if it names one (field `soundId`). */
const soundIdOf = (r: unknown): number | undefined => {
  const v = (r as { soundId?: unknown }).soundId
  return typeof v === 'number' ? v : undefined
}

describe('M21-P2 #944 — F10 audio settings (audioMuted / masterVolume)', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F10-01] defaults: audioMuted = false, masterVolume = 0.8 (createDefaultClientSettings and DEFAULT_CLIENT_SETTINGS)', async () => {
      const s = await settingsModule()
      expect(s.createDefaultClientSettings()).toMatchObject({ audioMuted: false, masterVolume: 0.8 })
      expect(s.DEFAULT_CLIENT_SETTINGS).toMatchObject({ audioMuted: false, masterVolume: 0.8 })
    })

    it('[T1-F10-02] valid values survive sanitize and a JSON round trip', async () => {
      const s = await settingsModule()
      const v = s.sanitizeClientSettings({ ...s.createDefaultClientSettings(), audioMuted: true, masterVolume: 0.35 })
      expect([v.audioMuted, v.masterVolume]).toEqual([true, 0.35])
      const back = s.parseClientSettingsJson(JSON.stringify(v))
      expect([back.audioMuted, back.masterVolume]).toEqual([true, 0.35])
    })

    it('[T1-F10-03] the settings store detects, notifies and persists a change of ONLY masterVolume or ONLY audioMuted (COMPARE_KEYS)', async () => {
      const st = await storeModule()
      const storage = memStorage()
      const store = st.createSettingsStore({ storage, syncGlobalLang: false, pageProtocol: 'https:' })
      const seen: string[][] = []
      store.subscribe((_n, _p, changed) => seen.push([...changed]))
      store.set({ masterVolume: 0.42 })
      store.set({ audioMuted: true })
      expect(seen).toEqual([['masterVolume'], ['audioMuted']])
      const again = st.createSettingsStore({ storage, syncGlobalLang: false, pageProtocol: 'https:' })
      expect([again.get().masterVolume, again.get().audioMuted], 'restored from storage').toEqual([0.42, true])
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F10-01] invalid inputs fall back to the defaults; out-of-range volumes never leave [0, 1]; in-range edges are kept', async () => {
      const s = await settingsModule()
      const d = s.createDefaultClientSettings()
      const vol = (v: unknown): number => s.sanitizeClientSettings({ ...d, masterVolume: v }).masterVolume
      const mute = (v: unknown): boolean => s.sanitizeClientSettings({ ...d, audioMuted: v }).audioMuted
      for (const bad of ['loud', Number.NaN, Number.POSITIVE_INFINITY, null, {}, '0.5']) expect(vol(bad), `masterVolume ${String(bad)}`).toBe(0.8)
      for (const bad of ['yes', 1, 0, null, 'true']) expect(mute(bad), `audioMuted ${String(bad)}`).toBe(false)
      expect([1, 0.8]).toContain(vol(1.5))
      expect([0, 0.8]).toContain(vol(-0.2))
      expect([vol(0), vol(1), vol(0.5)]).toEqual([0, 1, 0.5])
      expect(s.parseClientSettingsJson('{not json').masterVolume, 'corrupt storage → default').toBe(0.8)
    })

    it('[T2-F10-02] no spurious notifications: setting the same volume again notifies nothing; toggling mute reports only audioMuted', async () => {
      const st = await storeModule()
      const store = st.createSettingsStore({ storage: memStorage(), syncGlobalLang: false, pageProtocol: 'https:' })
      store.set({ masterVolume: 0.6 })
      const seen: string[][] = []
      store.subscribe((_n, _p, changed) => seen.push([...changed]))
      store.set({ masterVolume: 0.6 })
      expect(seen).toEqual([])
      store.set({ audioMuted: true })
      store.set({ audioMuted: false })
      expect(seen).toEqual([['audioMuted'], ['audioMuted']])
    })
  })
})

describe('M21-P2 #944 — F10 D2GS 0x2C (sound event codes, D24) and 0xA4 guard in ClientWorld', () => {
  const OBJECT = 2 // D2 unit type 2 = object (the 0x2C byte)
  const MONSTER = 1
  const assign = (w: WorldC, unitType: 'object' | 'monster', id: number, classId: number): void =>
    w.apply({ type: 'UnitAssign', unit: { unitType, id, classId, x: 5000, y: 5000, mode: 1 } })

  describe('Tier 1 — feature', () => {
    it('[T1-F10-04] 0xA4 MonsterSpecialSkill (decoded from real bytes) never becomes a sound request — D2Client 0x6fb5d760 plays nothing', async () => {
      const w = await world()
      const { monsterSpecial } = await decoders()
      for (const classId of [4, 13, 271, 700]) w.apply(monsterSpecial(pktA4(classId)))
      expect(w.drainWorldSoundRequests()).toEqual([])
    })

    it('[T1-F10-05] 0x2C code 13 on a known object queues pure-data requests that never name row 13; a named row is 2634 object_trap_trigger (0x6fad4195); the queue drains', async () => {
      const w = await world()
      const { playSound } = await decoders()
      assign(w, 'object', 901, 3)
      w.apply(playSound(pkt2C(OBJECT, 901, 13)))
      const reqs = w.drainWorldSoundRequests()
      expect(reqs.length, 'the event is not silently dropped').toBeGreaterThan(0)
      expect(JSON.parse(JSON.stringify(reqs)), 'requests are plain data').toEqual(reqs)
      for (const r of reqs) {
        const id = soundIdOf(r)
        expect(id, 'raw event code used as a Sounds.txt id (D24)').not.toBe(13)
        if (id !== undefined) expect(id).toBe(2634)
      }
      expect(w.drainWorldSoundRequests(), 'drained once').toEqual([])
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F10-03] codes 10 / 14 / 93 map like D2Client: 2673 shrine_refill, 2635 object_trap_release, 2553 object_corpse_loot — never rows 10 / 14 / 93', async () => {
      const { playSound } = await decoders()
      for (const [code, row] of [[10, 2673], [14, 2635], [93, 2553]] as const) {
        const w = await world()
        assign(w, 'object', 902, 2)
        w.apply(playSound(pkt2C(OBJECT, 902, code)))
        const reqs = w.drainWorldSoundRequests()
        expect(reqs.length, `code ${String(code)} is not dropped`).toBeGreaterThan(0)
        for (const r of reqs) {
          const id = soundIdOf(r)
          expect(id, `code ${String(code)} used as a row id`).not.toBe(code)
          if (id !== undefined) expect(id, `code ${String(code)}`).toBe(row)
        }
      }
    })

    it('[T2-F10-04] a non-player unit with a code outside the 0x6fad3f20 switch plays nothing (default path is player-only)', async () => {
      const w = await world()
      const { playSound } = await decoders()
      assign(w, 'monster', 903, 5)
      for (const code of [1, 50, 120]) w.apply(playSound(pkt2C(MONSTER, 903, code)))
      const named = w.drainWorldSoundRequests().map(soundIdOf).filter((x) => x !== undefined)
      expect(named, 'no Sounds.txt row may be requested').toEqual([])
    })
  })
})

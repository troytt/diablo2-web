import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { D2sItemInput } from '../src/server/save/d2s-reader.ts'
import type { ItemStat } from '../src/netproto/index.ts'
import { writeD2s } from '../src/server/save/d2s-writer.ts'
import { FIXED_ONE } from '../src/server/engine/stat-list.ts'
import { QUEST_FLAG_COMPLETED_113C, QUEST_FLAG_REWARD_PENDING_113C, QUEST_INFO_BY_ID_113C } from '../src/server/engine/quests-113c.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { propStats, type ItemProp } from '../src/common/items/item-score.ts'
import { SKILLS_CATALOG } from '../src/common/data/skills-catalog.ts'
import { EXPERIENCE_TABLE_BY_CLASS } from '../src/common/skills/formulas.ts'
import { CANONICAL_CHARSTATS, CHARACTER_CLASS_CODES, CHARACTER_CLASS_NAMES, calculateVitalsAtLevel } from '../src/common/units/classes.ts'
import SPECS from './test-characters.json'

export interface ItemSpec {
  readonly unique?: string
  readonly set?: string
  readonly item?: string
  readonly identified?: boolean
  readonly quantity?: number
  readonly sockets?: number
}

export interface CharacterSpec {
  readonly class: string
  readonly level: number
  readonly attributes: { readonly strength: number; readonly dexterity: number; readonly vitality: number; readonly energy: number }
  readonly gold: number
  readonly stashGold: number
  readonly skills: Readonly<Record<string, number>>
  readonly leftSkill: string
  readonly rightSkill: string
  readonly quests: Readonly<Record<string, 'completed' | 'reward pending'>>
  readonly equipped: Readonly<Record<string, ItemSpec>>
  readonly belt: readonly ItemSpec[]
  readonly inventory: readonly ItemSpec[]
  readonly stash: readonly ItemSpec[]
}

export const TEST_CHARACTERS: Readonly<Record<string, CharacterSpec>> = SPECS as Readonly<Record<string, CharacterSpec>>

const BODY_LOCS = ['Head', 'Neck', 'Torso', 'Right Arm', 'Left Arm', 'Right Ring', 'Left Ring', 'Belt', 'Feet', 'Gloves']
const QUALITY = { normal: 2, set: 5, unique: 7 }
const LOCATION = { stored: 0, equipped: 1, belt: 2 }
const PAGE = { inventory: 1, stash: 5 }
const GRIDS = { inventory: { width: 10, height: 4 }, stash: { width: 6, height: 8 } }
const BELT_COLUMNS = 4
const QUEST_FLAGS = { completed: QUEST_FLAG_COMPLETED_113C, 'reward pending': QUEST_FLAG_REWARD_PENDING_113C }
const QUEST_WORDS = 48
const SKILL_SLOTS = 30

interface BaseRecord {
  readonly code: string
  readonly name: string
  readonly invWidth: number
  readonly invHeight: number
  readonly defense?: number
  readonly durability?: number
}

interface NamedRecord {
  readonly id: number
  readonly index: string
  readonly props: readonly ItemProp[]
}

const tables = getEmbeddedDropTables()
const bases = [tables.weapons, tables.armor, tables.misc].flatMap((table) => [...(table as unknown as { all: readonly BaseRecord[] }).all])
const BASE_BY_NAME = new Map(bases.map((base) => [base.name, base]))
const UNIQUES = new Map((tables.uniques.all as unknown as readonly (NamedRecord & { code: string })[]).map((record) => [record.index, record]))
const SET_ITEMS = new Map((Object.values(tables.sets.items) as unknown as readonly ((NamedRecord & { item: string }) | undefined)[]).flatMap((record) => (record ? [[record.index, record] as const] : [])))
const QUEST_BY_TITLE = new Map([...QUEST_INFO_BY_ID_113C.values()].map((info) => [info.titleEn, info.wordIndex]))

const lookup = <V>(map: ReadonlyMap<string, V>, name: string, what: string): V => {
  const value = map.get(name)
  if (value === undefined) throw new Error(`unknown ${what} "${name}"`)
  return value
}

const STAT_CHAINS: ReadonlyMap<number, readonly number[]> = new Map([[17, [18]], [48, [49]], [50, [51]], [52, [53]], [54, [55, 56]], [57, [58, 59]]])
const FOLLOWERS = new Set([...STAT_CHAINS.values()].flat())
const COLD_LENGTH = 56
const DEFAULT_COLD_FRAMES = 50

function chainStats(stats: readonly ItemStat[]): ItemStat[] {
  const byId = new Map(stats.map((stat) => [stat.statId, stat]))
  return stats.filter((stat) => !FOLLOWERS.has(stat.statId) || ![...STAT_CHAINS].some(([leader, chain]) => chain.includes(stat.statId) && byId.has(leader))).flatMap((stat) => [
    stat,
    ...(STAT_CHAINS.get(stat.statId) ?? []).map((id) => byId.get(id) ?? { statId: id, param: 0, value: id === COLD_LENGTH ? DEFAULT_COLD_FRAMES : stat.value }),
  ])
}

const baseByCode =(code: string): BaseRecord => tables.getBase(code) as unknown as BaseRecord

export function itemFields(spec: ItemSpec): D2sItemInput {
  const named = spec.unique !== undefined ? { record: lookup(UNIQUES, spec.unique, 'unique'), quality: QUALITY.unique } : spec.set !== undefined ? { record: lookup(SET_ITEMS, spec.set, 'set item'), quality: QUALITY.set } : undefined
  const base = named ? baseByCode('code' in named.record ? named.record.code : named.record.item) : lookup(BASE_BY_NAME, spec.item ?? '', 'item')
  const identified = spec.identified ?? true
  return {
    code: base.code,
    quality: named?.quality ?? QUALITY.normal,
    identified,
    ilvl: 85,
    ...(named?.quality === QUALITY.unique ? { uniqueItemId: named.record.id } : named ? { setItemId: named.record.id } : {}),
    stats: named && identified ? chainStats(propStats(named.record.props)) : [],
    ...(base.defense ? { defense: base.defense } : {}),
    ...(base.durability ? { durability: base.durability, curDurability: base.durability, maxDurability: base.durability } : {}),
    ...(spec.quantity !== undefined ? { quantity: spec.quantity } : {}),
    ...(spec.sockets !== undefined ? { totalSockets: spec.sockets, socketed: true } : {}),
    invWidth: base.invWidth,
    invHeight: base.invHeight,
  }
}

function packGrid(specs: readonly ItemSpec[], grid: { readonly width: number; readonly height: number }, page: number): D2sItemInput[] {
  const taken = new Set<string>()
  const fits = (x: number, y: number, w: number, h: number) => x + w <= grid.width && y + h <= grid.height && Array.from({ length: w * h }, (_, i) => `${x + (i % w)},${y + Math.floor(i / w)}`).every((cell) => !taken.has(cell))
  const area = (item: D2sItemInput) => (item.invWidth ?? 1) * (item.invHeight ?? 1)
  return specs.map((spec) => ({ spec, item: itemFields(spec) })).sort((a, b) => area(b.item) - area(a.item)).map(({ spec, item }) => {
    const [w, h] = [item.invWidth ?? 1, item.invHeight ?? 1]
    const spot = Array.from({ length: grid.width * grid.height }, (_, i) => ({ x: Math.floor(i / grid.height), y: i % grid.height })).find(({ x, y }) => fits(x, y, w, h))
    if (!spot) throw new Error(`no room for ${spec.unique ?? spec.set ?? spec.item}`)
    Array.from({ length: w * h }, (_, i) => taken.add(`${spot.x + (i % w)},${spot.y + Math.floor(i / w)}`))
    return { ...item, location: LOCATION.stored, panel: page, storePage: page, gridX: spot.x, gridY: spot.y, x: spot.x, y: spot.y }
  })
}

function skillLevels(classCode: string, skills: Readonly<Record<string, number>>): Uint8Array {
  const own = SKILLS_CATALOG.filter((skill) => skill.classCode === classCode)
  const first = Math.min(...own.map((skill) => skill.id))
  const levels = new Uint8Array(SKILL_SLOTS)
  Object.entries(skills).forEach(([name, points]) => (levels[lookup(new Map(own.map((skill) => [skill.name, skill.id])), name, `${classCode} skill`) - first] = points))
  return levels
}

const skillId = (name: string): number => lookup(new Map(SKILLS_CATALOG.map((skill) => [skill.name, skill.id])), name, 'skill')

function questData(quests: CharacterSpec['quests']): [Uint16Array, Uint16Array, Uint16Array] {
  const normal = new Uint16Array(QUEST_WORDS)
  Object.entries(quests).forEach(([title, state]) => (normal[lookup(QUEST_BY_TITLE, title, 'quest')] |= QUEST_FLAGS[state]))
  return [normal, new Uint16Array(QUEST_WORDS), new Uint16Array(QUEST_WORDS)]
}

export function buildTestCharacter(name: string, spec: CharacterSpec): Uint8Array {
  const classIndex = CHARACTER_CLASS_NAMES.indexOf(spec.class as (typeof CHARACTER_CLASS_NAMES)[number])
  if (classIndex < 0) throw new Error(`unknown class "${spec.class}"`)
  const classCode = CHARACTER_CLASS_CODES[classIndex]!
  const equipped = Object.entries(spec.equipped).map(([loc, item]) => {
    const bodyLoc = BODY_LOCS.indexOf(loc) + 1
    if (bodyLoc === 0) throw new Error(`unknown body location "${loc}"`)
    return { ...itemFields(item), location: LOCATION.equipped, equipped: true, bodyLoc, equippedSlot: bodyLoc }
  })
  const belt = spec.belt.map((item, slot) => ({ ...itemFields(item), location: LOCATION.belt, gridX: slot, gridY: 0, x: slot % BELT_COLUMNS, y: Math.floor(slot / BELT_COLUMNS) }))
  const experience = EXPERIENCE_TABLE_BY_CLASS[spec.class.toLowerCase()]?.[spec.level] ?? 0
  const [left, right] = [skillId(spec.leftSkill), skillId(spec.rightSkill)]
  const stats = CANONICAL_CHARSTATS[classCode]
  const vitals = calculateVitalsAtLevel(stats, spec.level, { vitality: spec.attributes.vitality - stats.baseAttributes.vitality, energy: spec.attributes.energy - stats.baseAttributes.energy })
  const [life, mana, stamina] = [vitals.life, vitals.mana, vitals.stamina].map((value) => Math.floor(value) * FIXED_ONE) as [number, number, number]
  return writeD2s({
    name,
    classId: classIndex,
    level: spec.level,
    isExpansion: true,
    progression: 0,
    mapSeed: 0x5eed0000 + classIndex,
    hotkeys: [left, right],
    leftRightSkills: [left, right, left, right],
    quests: questData(spec.quests),
    attributes: { ...spec.attributes, level: spec.level, experience, gold: spec.gold, goldBank: spec.stashGold, statPts: 0, skillPts: 0, hitpointsFixed: life, maxHpFixed: life, manaFixed: mana, maxManaFixed: mana, staminaFixed: stamina, maxStaminaFixed: stamina },
    skillLevels: skillLevels(classCode, spec.skills),
    items: [...equipped, ...belt, ...packGrid(spec.inventory, GRIDS.inventory, PAGE.inventory), ...packGrid(spec.stash, GRIDS.stash, PAGE.stash)],
  })
}

export const testCharacterSaves = (): ReadonlyMap<string, Uint8Array> => new Map(Object.entries(TEST_CHARACTERS).map(([name, spec]) => [name, buildTestCharacter(name, spec)]))

export const singlePlayerStorage = (): string => JSON.stringify(Object.fromEntries([...testCharacterSaves()].map(([name, bytes]) => [name, Buffer.from(bytes).toString('base64')])))

function main(args: readonly string[]): void {
  const out = args[args.indexOf('--out') + 1]
  if (args.includes('--storage')) return void process.stdout.write(`${singlePlayerStorage()}\n`)
  if (!args.includes('--out') || !out) throw new Error('usage: test-characters.ts --out <dir> | --storage')
  mkdirSync(resolve(out), { recursive: true })
  testCharacterSaves().forEach((bytes, name) => writeFileSync(join(resolve(out), `${name}.d2s`), bytes))
  console.log(`wrote ${testCharacterSaves().size} characters to ${out}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2))

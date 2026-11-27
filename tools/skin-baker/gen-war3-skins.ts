/**
 * Built-in mesh skin packer (`tools/skin-baker/gen-war3-skins.ts`).
 *
 * Builds the built-in real-time mesh skins (one Warcraft III hero per class, see `WAR3_SKINS`;
 * `ne-kelthuzad` also replaces the Necromancer's summons): converts the Warcraft III models to `.glb`
 * (`convert_war3_mdx_to_glb.py`), content-hashes every file, and writes schema 2
 * (`format: 'mesh'`) manifests into `public/skins/`.
 *
 * The Warcraft III source assets are not part of this repository. They are read from
 * `WAR3_MPQ_DIR`, or `<home>/d2-data/war3-mpq` when that variable is unset; without them the
 * script fails rather than emitting a placeholder.
 *
 * Skins with `source: 'wow'` are converted from World of Warcraft 3.3.5 archives instead
 * (`convert_wow_m2_to_glb.py`, read from `WOW_335_DIR` or `<home>/d2-data/wow-335`); their model
 * carries a paper-doll, so the look follows the equipment worn in game.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildStoreZipArchive } from '../../src/common/formats/zip-reader.ts'
import type { PlayerClassToken } from '../../src/common/units/char-appearance.ts'
import { validateCharacterSkinManifest } from '../../src/common/units/character-skin.ts'
import { parseMeshSkinModel } from '../../src/common/units/mesh-skin-model.ts'
import { writeSkinBundleToPublicSkinsDir, type PackedCharacterSkinBundle } from './pack-skin.ts'

interface ConvertedClip {
  readonly durationMs: number
  readonly loop: boolean
  readonly source: string
  readonly moveSpeed: number
  readonly actionAt?: number
}

interface ConvertedUnit {
  readonly glb: string
  /** Portrait image; shape-shift forms have none. */
  readonly portrait?: string
  readonly pxPerUnit: number
  readonly box: { readonly width: number; readonly height: number; readonly footX: number; readonly footY: number }
  readonly clips: Readonly<Record<string, ConvertedClip>>
  /** Extra clip keys that play another converted clip (weapon options sharing a stance). */
  readonly aliases?: Readonly<Record<string, string>>
}

interface ConvertedUnits {
  readonly preview: string
  readonly units: Readonly<Record<string, ConvertedUnit>>
  /** Shape-shift forms by Diablo II morph token (`40` werewolf, `tg` werebear). */
  readonly morphs?: Readonly<Record<string, ConvertedUnit>>
}

interface LocalizedText {
  readonly zh: string
  readonly en: string
}

interface War3SkinDef {
  readonly id: string
  readonly targetClass: PlayerClassToken
  readonly name: LocalizedText
  readonly description: LocalizedText
  readonly floating: boolean
  readonly shadowOffsetY: number
  readonly shadowScale: number
  /** Art source and converter; Warcraft III when omitted. */
  readonly source?: 'war3' | 'wow'
  /** Diablo II modes that reuse another converted clip of the hero. */
  readonly heroClipAliases: Readonly<Record<string, string>>
  readonly minions: Readonly<Record<string, { readonly name: LocalizedText; readonly shadowScale: number }>>
}

export const WAR3_SKINS: readonly War3SkinDef[] = [
  {
    id: 'ne-kelthuzad',
    targetClass: 'ne',
    name: { zh: '巫妖克尔苏加德', en: "Kel'Thuzad (Archlich)" },
    description: {
      zh: '《魔兽争霸3》天灾军团实时 3D 骨骼模型：巫妖浮空飘行、护命匣阵亡形态，并同步把死灵召唤物替换为食尸鬼、亡灵巫师、岩石傀儡、憎恶、血肉傀儡与地狱火，附专属头像。',
      en: "Real-time Warcraft III Scourge models: hovering Archlich Kel'Thuzad with a Frost Phylactery death form, plus Ghoul, Necromancer, Rock Golem, Abomination, Flesh Golem and Infernal summons with their own portraits.",
    },
    floating: true,
    shadowOffsetY: 10,
    shadowScale: 0.72,
    heroClipAliases: { rn: 'wl' },
    minions: {
      necroskeleton: { name: { zh: '食尸鬼', en: 'Ghoul' }, shadowScale: 0.78 },
      necromage: { name: { zh: '亡灵巫师', en: 'Necromancer' }, shadowScale: 0.85 },
      claygolem: { name: { zh: '岩石傀儡', en: 'Rock Golem' }, shadowScale: 0.96 },
      bloodgolem: { name: { zh: '憎恶', en: 'Abomination' }, shadowScale: 0.96 },
      irongolem: { name: { zh: '血肉傀儡', en: 'Flesh Golem' }, shadowScale: 0.96 },
      firegolem: { name: { zh: '地狱火', en: 'Infernal' }, shadowScale: 0.98 },
    },
  },
  {
    id: 'so-jaina',
    targetClass: 'so',
    name: { zh: '吉安娜·普罗德摩尔', en: 'Jaina Proudmoore' },
    description: {
      zh: '《魔兽争霸3》吉安娜·普罗德摩尔实时 3D 骨骼模型：手持法杖的大法师外观，含待机、行走、施法、攻击与阵亡动作。',
      en: 'Real-time Warcraft III model of Jaina Proudmoore: the staff-wielding Archmage with idle, walk, cast, attack and death animations.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: { rn: 'wl' },
    minions: {},
  },
  {
    id: 'am-sylvanas',
    targetClass: 'am',
    name: { zh: '黑暗游侠希尔瓦娜斯', en: 'Sylvanas (Dark Ranger)' },
    description: {
      zh: '《魔兽争霸3》黑暗游侠希尔瓦娜斯·风行者实时 3D 骨骼模型：持弓的被遗忘者女王外观。',
      en: 'Real-time Warcraft III model of Sylvanas Windrunner as the Dark Ranger, bow in hand.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: { rn: 'wl' },
    minions: {},
  },
  {
    id: 'pa-arthas',
    targetClass: 'pa',
    name: { zh: '阿尔萨斯王子', en: 'Arthas (Paladin)' },
    description: {
      zh: '《魔兽争霸3》圣骑士时期的阿尔萨斯·米奈希尔实时 3D 骨骼模型：手持战锤的洛丹伦王子。',
      en: 'Real-time Warcraft III model of Arthas Menethil as a paladin, the hammer-wielding prince of Lordaeron.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: { rn: 'wl' },
    minions: {},
  },
  {
    id: 'ba-grom',
    targetClass: 'ba',
    name: { zh: '格罗姆·地狱咆哮', en: 'Grom Hellscream' },
    description: {
      zh: '《魔兽争霸3》格罗姆·地狱咆哮实时 3D 骨骼模型：手持血吼的战歌氏族酋长，战吼使用其胜利咆哮动作。',
      en: 'Real-time Warcraft III model of Grom Hellscream, chieftain of the Warsong clan with Gorehowl; war cries use his victory roar.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: { rn: 'wl' },
    minions: {},
  },
  {
    id: 'dz-malfurion',
    targetClass: 'dz',
    name: { zh: '玛法里奥·怒风', en: 'Malfurion Stormrage' },
    description: {
      zh: '《魔兽争霸3》玛法里奥·怒风（步行形态）实时 3D 骨骼模型：头生鹿角的大德鲁伊。',
      en: 'Real-time Warcraft III model of Malfurion Stormrage on foot, the antlered Archdruid.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: { rn: 'wl' },
    minions: {},
  },
  {
    id: 'ai-maiev',
    targetClass: 'ai',
    name: { zh: '守望者玛维', en: 'Maiev Shadowsong (Warden)' },
    description: {
      zh: '《魔兽争霸3》守望者玛维·影歌实时 3D 骨骼模型：手持月刃的守望者。',
      en: 'Real-time Warcraft III model of Maiev Shadowsong, the Warden with her crescent blade.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: { rn: 'wl' },
    minions: {},
  },
  {
    id: 'so-wow-human-mage',
    targetClass: 'so',
    source: 'wow',
    name: { zh: '人类女法师（随装备换装）', en: 'Human Mage (follows equipment)' },
    description: {
      zh: '《魔兽世界》人类女性实时 3D 骨骼模型，带简化纸娃娃：各类武器与盾牌、11 类头盔和 8 类衣服（普通 / 扩展 / 精英三阶各有外观）都会随身上装备实时更换，魔法及以上品质的武器和盾牌带品质色泛光。',
      en: 'Real-time World of Warcraft human female model with a simplified paper-doll: every weapon family and shield shape, eleven helmet families and eight body armour families (one look per normal / exceptional / elite tier) follow the equipment worn; weapons and shields of magic quality or better glow in their quality colour.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: {},
    minions: {},
  },
  {
    id: 'dz-wow-nightelf',
    targetClass: 'dz',
    source: 'wow',
    name: { zh: '暗夜精灵德鲁伊（随装备换装）', en: 'Night Elf Druid (follows equipment)' },
    description: {
      zh: '《魔兽世界》暗夜精灵女性实时 3D 骨骼模型，武器、盾牌、头盔和衣服随身上装备实时更换；变身狼人时显示银松森林狼人，变身熊人时显示冬泉谷熊怪。',
      en: 'Real-time World of Warcraft night elf female model whose weapons, shield, helmet and body armour follow the equipment worn; Werewolf shows a Silverpine worgen and Werebear a Winterspring furbolg.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: {},
    minions: {},
  },
  {
    id: 'am-wow-bloodelf',
    targetClass: 'am',
    source: 'wow',
    name: { zh: '血精灵游侠（随装备换装）', en: 'Blood Elf Ranger (follows equipment)' },
    description: {
      zh: '《魔兽世界》血精灵女性实时 3D 骨骼模型，武器、盾牌、头盔和衣服随身上装备实时更换。',
      en: 'Real-time World of Warcraft blood elf female model whose weapons, shield, helmet and body armour follow the equipment worn.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: {},
    minions: {},
  },
  {
    id: 'ne-wow-undead',
    targetClass: 'ne',
    source: 'wow',
    name: { zh: '亡灵死灵法师（随装备换装）', en: 'Undead Necromancer (follows equipment)' },
    description: {
      zh: '《魔兽世界》亡灵男性实时 3D 骨骼模型，武器、盾牌、头盔和衣服随身上装备实时更换；召唤物保持原版外观。',
      en: 'Real-time World of Warcraft undead male model whose weapons, shield, helmet and body armour follow the equipment worn; summons keep their original look.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: {},
    minions: {},
  },
  {
    id: 'pa-wow-dwarf',
    targetClass: 'pa',
    source: 'wow',
    name: { zh: '矮人圣骑士（随装备换装）', en: 'Dwarf Paladin (follows equipment)' },
    description: {
      zh: '《魔兽世界》矮人男性实时 3D 骨骼模型，武器、盾牌、头盔和衣服随身上装备实时更换。',
      en: 'Real-time World of Warcraft dwarf male model whose weapons, shield, helmet and body armour follow the equipment worn.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: {},
    minions: {},
  },
  {
    id: 'ba-wow-orc',
    targetClass: 'ba',
    source: 'wow',
    name: { zh: '兽人战士（随装备换装，可双持）', en: 'Orc Warrior (follows equipment, dual wield)' },
    description: {
      zh: '《魔兽世界》兽人男性实时 3D 骨骼模型，武器、盾牌、头盔和衣服随身上装备实时更换；双持时左手武器同样显示。',
      en: 'Real-time World of Warcraft orc male model whose weapons, shield, helmet and body armour follow the equipment worn; a second weapon shows in the left hand.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: {},
    minions: {},
  },
  {
    id: 'ai-wow-draenei',
    targetClass: 'ai',
    source: 'wow',
    name: { zh: '德莱尼刺客（随装备换装，可双持）', en: 'Draenei Assassin (follows equipment, dual wield)' },
    description: {
      zh: '《魔兽世界》德莱尼女性实时 3D 骨骼模型，武器、盾牌、头盔和衣服随身上装备实时更换；双持爪时左手爪同样显示。',
      en: 'Real-time World of Warcraft draenei female model whose weapons, shield, helmet and body armour follow the equipment worn; a second claw shows in the left hand.',
    },
    floating: false,
    shadowOffsetY: 0,
    shadowScale: 0.9,
    heroClipAliases: {},
    minions: {},
  },
]

function resolveWar3MpqDir(): string {
  const dir = process.env.WAR3_MPQ_DIR ?? join(homedir(), 'd2-data', 'war3-mpq')
  if (!existsSync(join(dir, 'units', 'undead', 'herolich', 'herolich.mdx'))) {
    throw new Error(
      'Warcraft III source assets not found. Set WAR3_MPQ_DIR to an extracted War3.mpq tree ' +
        '(expected units/undead/herolich/herolich.mdx inside it).',
    )
  }
  return dir
}

function resolveWow335Dir(): string {
  const dir = process.env.WOW_335_DIR ?? join(homedir(), 'd2-data', 'wow-335')
  if (!existsSync(join(dir, 'Data', 'common.MPQ')) && !existsSync(join(dir, 'common.MPQ'))) {
    throw new Error(
      'World of Warcraft 3.3.5 archives not found. Set WOW_335_DIR to a directory containing ' +
        'Data/common.MPQ and the other base archives.',
    )
  }
  return dir
}

function hashedName(stem: string, ext: string, bytes: Uint8Array): string {
  const hash8 = createHash('sha256').update(bytes).digest('hex').slice(0, 8)
  return `${stem}-${hash8}.${ext}`
}

function meshSpec(unit: ConvertedUnit, file: string, aliases: Readonly<Record<string, string>> = {}) {
  const clips: Record<string, unknown> = {}
  const add = (key: string, source: string): void => {
    const c = unit.clips[source]
    if (!c) throw new Error(`Converted unit is missing clip "${source}"`)
    clips[key] = {
      anim: source,
      loop: c.loop,
      durationMs: c.durationMs,
      ...(c.moveSpeed > 0 ? { moveSpeed: c.moveSpeed } : {}),
      ...(c.actionAt !== undefined ? { actionAt: c.actionAt } : {}),
    }
  }
  for (const key of Object.keys(unit.clips)) add(key, key)
  for (const [key, source] of Object.entries(aliases)) add(key, source)
  return { file, pxPerUnit: unit.pxPerUnit, box: unit.box, clips }
}

/** Directory (next to the skins) of the shared unique weapon models the WoW skins attach. */
export const WOW_WEAPON_PACK_ID = 'wow-weapons'

/**
 * Convert and write the shared weapon pack: `<outRoot>/wow-weapons/weapons.json` plus one
 * content-hashed GLB per unique weapon. Returns the number of weapons and their total size.
 */
export function packWowWeaponPack(outRoot: string): { readonly count: number; readonly bytes: number } {
  const here = dirname(fileURLToPath(import.meta.url))
  const tmpDir = mkdtempSync(join(tmpdir(), 'd2w-weapon-glb-'))
  try {
    execFileSync(
      'python3',
      [join(here, 'convert_wow_m2_to_glb.py'), '--wow-dir', resolveWow335Dir(), '--weapon-pack', '--verify', '--out-dir', tmpDir],
      { stdio: 'inherit' },
    )
    const converted = JSON.parse(readFileSync(join(tmpDir, 'weapons.json'), 'utf8')) as {
      readonly pack: string
      readonly weapons: Readonly<Record<string, { readonly glb: string; readonly hand: 'right' | 'left' }>>
    }
    if (converted.pack !== WOW_WEAPON_PACK_ID) throw new Error(`Unexpected weapon pack id "${converted.pack}"`)
    const outDir = join(outRoot, WOW_WEAPON_PACK_ID)
    rmSync(outDir, { recursive: true, force: true })
    mkdirSync(outDir, { recursive: true })
    const weapons: Record<string, { file: string; hand: 'right' | 'left' }> = {}
    let bytes = 0
    for (const [id, entry] of Object.entries(converted.weapons)) {
      const glb = new Uint8Array(readFileSync(join(tmpDir, entry.glb)))
      const file = hashedName(`u-${id}`, 'glb', glb)
      writeFileSync(join(outDir, file), glb)
      weapons[id] = { file, hand: entry.hand }
      bytes += glb.byteLength
    }
    writeFileSync(join(outDir, 'weapons.json'), `${JSON.stringify({ schema: 1, weapons }, null, 1)}\n`)
    return { count: Object.keys(weapons).length, bytes }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

export function generateWar3SkinBundle(def: War3SkinDef): PackedCharacterSkinBundle {
  const here = dirname(fileURLToPath(import.meta.url))
  const converterArgs =
    def.source === 'wow'
      ? [join(here, 'convert_wow_m2_to_glb.py'), '--wow-dir', resolveWow335Dir()]
      : [join(here, 'convert_war3_mdx_to_glb.py'), '--war3-dir', resolveWar3MpqDir()]
  const tmpDir = mkdtempSync(join(tmpdir(), 'd2w-skin-glb-'))
  try {
    execFileSync('python3', [...converterArgs, '--out-dir', tmpDir, '--skin', def.id, '--verify'], {
      stdio: 'inherit',
    })
    const converted = JSON.parse(readFileSync(join(tmpDir, 'units.json'), 'utf8')) as ConvertedUnits
    const files: Record<string, Uint8Array> = {}
    const read = (name: string): Uint8Array => new Uint8Array(readFileSync(join(tmpDir, name)))

    const addModel = (unitKey: string, stem: string): { readonly unit: ConvertedUnit; readonly file: string } => {
      const unit = converted.units[unitKey]
      if (!unit) throw new Error(`Converter output is missing unit "${unitKey}"`)
      return addUnit(unit, stem)
    }
    const addUnit = (unit: ConvertedUnit, stem: string): { readonly unit: ConvertedUnit; readonly file: string } => {
      const bytes = read(unit.glb)
      // Fail here, not in the browser, if the model cannot be loaded by the runtime parser.
      const model = parseMeshSkinModel(bytes)
      for (const clipKey of Object.keys(unit.clips)) {
        if (!model.clips[clipKey]) throw new Error(`${unit.glb} is missing animation "${clipKey}"`)
      }
      const file = hashedName(stem, 'glb', bytes)
      files[file] = bytes
      return { unit, file }
    }

    const hero = addModel('hero', 'hero')
    const previewBytes = read(converted.preview)
    const previewFile = hashedName('preview', 'png', previewBytes)
    files[previewFile] = previewBytes

    const minions: Record<string, unknown> = {}
    for (const [key, meta] of Object.entries(def.minions)) {
      const m = addModel(key, `minion-${key}`)
      if (m.unit.portrait === undefined) throw new Error(`Converted minion "${key}" has no portrait`)
      const portraitBytes = read(m.unit.portrait)
      const portraitFile = hashedName(`portrait-${key}`, 'png', portraitBytes)
      files[portraitFile] = portraitBytes
      minions[key] = {
        name: meta.name,
        directions: 64,
        shadowScale: meta.shadowScale,
        portraitFile,
        mesh: meshSpec(m.unit, m.file),
      }
    }

    const morphs: Record<string, unknown> = {}
    for (const [token, unit] of Object.entries(converted.morphs ?? {})) {
      const m = addUnit(unit, `morph-${token}`)
      morphs[token] = { shadowScale: 1, mesh: meshSpec(m.unit, m.file) }
    }

    const manifest = validateCharacterSkinManifest({
      schema: 2,
      id: def.id,
      name: def.name,
      description: def.description,
      targetClass: def.targetClass,
      format: 'mesh',
      directions: 64,
      floating: def.floating,
      shadowOffsetY: def.shadowOffsetY,
      shadowScale: def.shadowScale,
      respectMorph: false,
      previewFile,
      mesh: meshSpec(hero.unit, hero.file, { ...(hero.unit.aliases ?? {}), ...def.heroClipAliases }),
      ...(Object.keys(minions).length > 0 ? { minions } : {}),
      ...(Object.keys(morphs).length > 0 ? { morphs } : {}),
    })
    files['skin.json'] = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`)

    const zipBytes = buildStoreZipArchive(
      Object.keys(files)
        .sort()
        .map((path) => ({ path, bytes: files[path]! })),
    )
    return { manifest, files, zipBytes }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const outRoot = process.argv[2] ? resolve(process.argv[2]) : resolve(process.cwd(), 'public', 'skins')
  // Optional second argument: pack only the skin with this id.
  const only = process.argv[3]
  if (only !== undefined && only !== WOW_WEAPON_PACK_ID && !WAR3_SKINS.some((def) => def.id === only)) {
    throw new Error(
      `Unknown skin id "${only}" (known: ${[...WAR3_SKINS.map((def) => def.id), WOW_WEAPON_PACK_ID].join(', ')})`,
    )
  }
  // The shared weapon pack is packed with everything, or alone when asked for by its id.
  if (only === undefined || only === WOW_WEAPON_PACK_ID) {
    const pack = packWowWeaponPack(outRoot)
    console.log(
      `Packed ${WOW_WEAPON_PACK_ID} -> ${outRoot}/${WOW_WEAPON_PACK_ID} (${String(pack.count)} weapons, ${(pack.bytes / 1024).toFixed(1)} KB)`,
    )
  }
  for (const def of WAR3_SKINS) {
    if (only !== undefined && def.id !== only) continue
    const bundle = generateWar3SkinBundle(def)
    writeSkinBundleToPublicSkinsDir(bundle, outRoot, true)
    const totalBytes = Object.values(bundle.files).reduce((sum, b) => sum + b.byteLength, 0)
    console.log(
      `Packed ${bundle.manifest.id} -> ${outRoot}/${bundle.manifest.id} (${String(Object.keys(bundle.files).length)} files, ${(totalBytes / 1024).toFixed(1)} KB)`,
    )
  }
}

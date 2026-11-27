/**
 * Generates src/common/audio/object-sounds-113c.ts from the 1.13c D2Client.dll object sound table.
 *
 * D2Client.dll 0x6fba6c58 is a 573-entry (`cmp eax, 0x23d`, 0x6fad24f5 / 0x6fad2575) pointer table indexed by the
 * object class id (Objects.txt record index). Each non-null pointer is a 0x30-byte descriptor in .data:
 *   +0x00..+0x1c  int32 modeSound[0..7]   one-shot sound played on entering object mode N (0x6fad2570)
 *   +0x20 / +0x24 int32 loopSoundA / loopModeA  mode-bound sound (0x6fad24f0; loopMode 8 = every mode)
 *   +0x28 / +0x2c int32 loopSoundB / loopModeB
 * Special cases baked as flags:
 *   - descriptor 0x6fba6988 (wells): 0x6fad258c..0x6fad2597 skip the one-shot when the new mode < the previous one;
 *   - class 61 (cairn stones, 0x3d): 0x6fad250c..0x6fad2511 take the mode-bound sound from 0x6fba5998[mode].
 *
 * Usage: npm run extract:object-sounds   (D2Client.dll from D2_DATA_DIR or samples/d2)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DEFAULT_NODE_MPQ_DIR } from '../mpq-archive-source.ts'

const IMAGE_BASE = 0x6fab0000
const TABLE_VA = 0x6fba6c58
const RECORD_COUNT = 0x23d
const WELL_DESCRIPTOR_VA = 0x6fba6988
const CAIRN_CLASS_ID = 0x3d
const CAIRN_TABLE_VA = 0x6fba5998

interface PeSection {
  readonly va: number
  readonly vsize: number
  readonly raw: number
  readonly rawSize: number
}

/** One decoded descriptor (raw table values). */
export interface ObjectSoundDescriptor113c {
  readonly modeSounds: readonly number[]
  readonly loopSoundA: number
  readonly loopModeA: number
  readonly loopSoundB: number
  readonly loopModeB: number
  readonly wellGuard: boolean
}

function readSections(dll: Uint8Array): PeSection[] {
  const view = new DataView(dll.buffer, dll.byteOffset, dll.byteLength)
  const peOff = view.getUint32(0x3c, true)
  if (view.getUint32(peOff, true) !== 0x00004550) throw new Error('D2Client.dll: missing PE signature')
  const sectionCount = view.getUint16(peOff + 6, true)
  const optSize = view.getUint16(peOff + 20, true)
  const imageBase = view.getUint32(peOff + 24 + 28, true)
  if (imageBase !== IMAGE_BASE) {
    throw new Error(`D2Client.dll image base 0x${imageBase.toString(16)} != 0x${IMAGE_BASE.toString(16)} (not 1.13c?)`)
  }
  const sections: PeSection[] = []
  let off = peOff + 24 + optSize
  for (let i = 0; i < sectionCount; i += 1, off += 40) {
    sections.push({
      vsize: view.getUint32(off + 8, true),
      va: IMAGE_BASE + view.getUint32(off + 12, true),
      rawSize: view.getUint32(off + 16, true),
      raw: view.getUint32(off + 20, true),
    })
  }
  return sections
}

/** Decodes the whole 0x6fba6c58 table: index = object class id, `null` = no sound descriptor. */
export function readObjectSoundTable(dll: Uint8Array): (ObjectSoundDescriptor113c | null)[] {
  const view = new DataView(dll.buffer, dll.byteOffset, dll.byteLength)
  const sections = readSections(dll)
  const fileOffset = (va: number): number => {
    const s = sections.find(sec => va >= sec.va && va < sec.va + Math.max(sec.vsize, sec.rawSize))
    if (!s || va - s.va >= s.rawSize) throw new Error(`D2Client.dll: VA 0x${va.toString(16)} is not file-backed`)
    return s.raw + (va - s.va)
  }
  const i32 = (va: number): number => view.getInt32(fileOffset(va), true)
  const u32 = (va: number): number => view.getUint32(fileOffset(va), true)

  const out: (ObjectSoundDescriptor113c | null)[] = []
  for (let classId = 0; classId < RECORD_COUNT; classId += 1) {
    const ptr = u32(TABLE_VA + classId * 4)
    if (ptr === 0) {
      out.push(null)
      continue
    }
    const modeSounds: number[] = []
    for (let m = 0; m < 8; m += 1) modeSounds.push(i32(ptr + m * 4))
    out.push({
      modeSounds,
      loopSoundA: i32(ptr + 0x20),
      loopModeA: i32(ptr + 0x24),
      loopSoundB: i32(ptr + 0x28),
      loopModeB: i32(ptr + 0x2c),
      wellGuard: ptr === WELL_DESCRIPTOR_VA,
    })
  }
  // Anchors from the 1.13c binary (doors / town portal), so a different build fails loudly.
  const anchors: readonly [number, number, number][] = [
    [13, 0, 2564], // Door D1: close object_door_metal_close
    [13, 2, 2563], // Door D1: open object_door_metal_open
    [15, 2, 2568], // Door D3: open object_door_wood_open
    [23, 2, 2559], // Door D5: open object_door_gate_open
    [59, 1, 2633], // Portal: object_townportal
  ]
  for (const [classId, mode, expected] of anchors) {
    const got = out[classId]?.modeSounds[mode]
    if (got !== expected) {
      throw new Error(`D2Client.dll object sound table [${classId}].mode${mode} = ${String(got)}, expected ${expected}`)
    }
  }
  return out
}

/** Reads the cairn stone mode-bound sounds (0x6fba5998[0..7]). */
export function readCairnModeSounds(dll: Uint8Array): number[] {
  const view = new DataView(dll.buffer, dll.byteOffset, dll.byteLength)
  const sections = readSections(dll)
  const s = sections.find(sec => CAIRN_TABLE_VA >= sec.va && CAIRN_TABLE_VA < sec.va + sec.rawSize)
  if (!s) throw new Error('D2Client.dll: cairn table not file-backed')
  const base = s.raw + (CAIRN_TABLE_VA - s.va)
  const sounds: number[] = []
  for (let m = 0; m < 8; m += 1) sounds.push(view.getInt32(base + m * 4, true))
  return sounds
}

export function renderObjectSoundTable(
  table: readonly (ObjectSoundDescriptor113c | null)[],
  cairn: readonly number[],
): string {
  const rows = table.map((d, classId) => {
    if (d === null) return `  null, // ${classId}`
    const fields = [
      `[${d.modeSounds.join(', ')}]`,
      String(d.loopSoundA),
      String(d.loopModeA),
      String(d.loopSoundB),
      String(d.loopModeB),
      d.wellGuard ? 'true' : 'false',
    ]
    return `  d(${fields.join(', ')}), // ${classId}`
  })
  return [
    '/**',
    ' * Diablo II v1.13c client object sound table (D2Client.dll 0x6fba6c58), indexed by object class id.',
    ' * GENERATED by src/baker/extract/gen-object-sounds.ts (`npm run extract:object-sounds`). Do not edit by hand.',
    ' *',
    ' * Read by the object mode sound handler 0x6fad37e0 (called each object update, 0x6fad5b60, and by the',
    ' * door / object mode setters 0x6fad4f8a, 0x6fad502a, 0x6fad5aff):',
    ' * - `modeSounds[mode]` (0x6fad2570): one-shot played when the object enters `mode` (not on first sight,',
    ' *   except class 59 town portal); `wellGuard` descriptors skip it when the new mode < the previous mode;',
    ' * - `loopSoundA/B` + `loopModeA/B` (0x6fad24f0): sound bound to a mode (8 = every mode), started when the',
    ' *   object enters that mode and stopped (0x6fad3070) when it enters a mode without one.',
    ' */',
    '',
    '/** One 0x30-byte descriptor of the 0x6fba6c58 table. */',
    'export interface ObjectSoundDescriptor113c {',
    '  /** +0x00..+0x1c: one-shot Sounds.txt row per object mode 0..7 (0 = none). */',
    '  readonly modeSounds: readonly number[]',
    '  /** +0x20: mode-bound sound A. */',
    '  readonly loopSoundA: number',
    '  /** +0x24: mode of sound A (8 = every mode). */',
    '  readonly loopModeA: number',
    '  /** +0x28: mode-bound sound B. */',
    '  readonly loopSoundB: number',
    '  /** +0x2c: mode of sound B (8 = every mode). */',
    '  readonly loopModeB: number',
    '  /** Descriptor 0x6fba6988 (wells): the one-shot only plays when the new mode >= the previous mode. */',
    '  readonly wellGuard: boolean',
    '}',
    '',
    'function d(',
    '  modeSounds: readonly number[],',
    '  loopSoundA: number,',
    '  loopModeA: number,',
    '  loopSoundB: number,',
    '  loopModeB: number,',
    '  wellGuard: boolean,',
    '): ObjectSoundDescriptor113c {',
    '  return Object.freeze({ modeSounds: Object.freeze(modeSounds), loopSoundA, loopModeA, loopSoundB, loopModeB, wellGuard })',
    '}',
    '',
    `/** All ${table.length} entries of D2Client.dll 0x6fba6c58 (\`null\` = the class has no sound descriptor). */`,
    'export const OBJECT_SOUNDS_113C: readonly (ObjectSoundDescriptor113c | null)[] = Object.freeze([',
    ...rows,
    '])',
    '',
    `/** Class ${CAIRN_CLASS_ID} (cairn stones): mode-bound sound comes from D2Client.dll 0x6fba5998[mode] (0x6fad250c). */`,
    `export const CAIRN_STONE_CLASS_ID_113C = ${CAIRN_CLASS_ID}`,
    `export const CAIRN_STONE_MODE_SOUNDS_113C: readonly number[] = Object.freeze([${cairn.join(', ')}])`,
    '',
    '/**',
    ' * D2Client.dll 0x6fb82f60 (23-entry shrine client table, 0x14 bytes/entry, +0x10 soundId; read by 0x6fad4a70):',
    ' * Indexed by Shrines.txt Code (0..22).',
    ' */',
    'export const SHRINE_SOUNDS_113C: readonly number[] = Object.freeze([',
    '  0, // 0: None',
    '  2673, // 1: Refill (shrine_refill)',
    '  2673, // 2: Health Boost (shrine_refill)',
    '  2672, // 3: Mana Boost (shrine_recharge)',
    '  2666, // 4: Health Exchange (shrine_exchange)',
    '  2666, // 5: Mana Exchange (shrine_exchange)',
    '  2664, // 6: Armor Boost (shrine_armorboost)',
    '  2665, // 7: Combat Boost (shrine_combatboost)',
    '  2675, // 8: Resist Fire Boost (shrine_resistfire)',
    '  2674, // 9: Resist Cold Boost (shrine_resistcold)',
    '  2676, // 10: Resist Lightning Boost (shrine_resistlightning)',
    '  2677, // 11: Resist Poison Boost (shrine_resistpoison)',
    '  2679, // 12: Skill Boost (shrine_skill)',
    '  2672, // 13: Recharge Boost (shrine_recharge)',
    '  2672, // 14: Stamina Boost (shrine_recharge)',
    '  2667, // 15: Experience Boost (shrine_experience)',
    '  2678, // 16: Shrine of Enirhs (shrine_ofenirhs)',
    '  2671, // 17: Portal Shrine (shrine_portal)',
    '  2669, // 18: Gem Shrine (shrine_gemupgrade)',
    '  2680, // 19: Storm Shrine (shrine_storm)',
    '  2671, // 20: Monster Shrine (shrine_portal)',
    '  2668, // 21: Exploding Shrine (shrine_exploding)',
    '  2670, // 22: Poison Shrine (shrine_poison)',
    '])',
    '',
  ].join('\n')
}

function main(): void {
  const dllPath = join(DEFAULT_NODE_MPQ_DIR, 'D2Client.dll')
  if (!existsSync(dllPath)) throw new Error(`D2Client.dll not found at ${dllPath} (set D2_DATA_DIR)`)
  const dll = new Uint8Array(readFileSync(dllPath))
  const target = resolve('src/common/audio/object-sounds-113c.ts')
  writeFileSync(target, renderObjectSoundTable(readObjectSoundTable(dll), readCairnModeSounds(dll)))
  console.log(`wrote ${target} from ${dllPath}`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}

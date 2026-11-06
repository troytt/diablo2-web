// object-lookup.ts — DS1 对象 `(act, type, id)` → 实际 token/mode 的查找（移植自 OpenDiablo2）
//
// 为什么需要这一层：DS1 记录里的对象 `id` **不是** `Objects.txt` 的行号，而是"该 act 的对象
// 表索引"，那层映射硬编码在游戏里，凭表推不出来。OpenDiablo2 把它整理成了数据表
// （`d2core/d2records/object_lookup_record_data.go`，7,891 行），并在
// `d2mapstamp/stamp.go` 里这样用：
//
//     lookup := records.LookupObject(act, object.Type, object.ID)
//     objectRecord := records.Object.Details[lookup.ObjectsTxtId]
//
// 本模块把那 3,615 条物体记录（`ObjectTypeItem`；怪物/NPC 行不移植——本项目没有怪物）
// 装箱进 `object-lookup-data.ts`，在这里解析成查表 API。
//
// 与 `Objects.txt` 的关系（实测，见 `npm run verify:objects`）：
// 表里的 `token` **优先于** `Objects.txt` 的 `Token` 列——后者在 26 处写的是占位符
// （`SS`/`XX`/`SL`），而表里是真 token（例如 act 2 的 jerhyn 是 `JE`、act 3 的楼梯是 `9C`）。
// 表里有 750 条能直接对到 `Objects.txt` 行号，另外 2,665 条只给了 token/mode
// （例如 act 1 的 `id 155 → L1/OP`「LargeChestR」），这些要靠 token 反查元数据。
//
// 编码与出处见 `object-lookup-data.ts` 的头部（由 `npm run port:object-lookup` 生成）。

import { OBJECT_LOOKUP_ROWS } from './object-lookup-data.ts'

/** DS1 对象 `type`：怪物/NPC（`MonPreset.txt` 索引）。 */
export const OBJECT_TYPE_MONSTER = 1
/** DS1 对象 `type`：可交互物体（本模块查的就是这一类）。 */
export const OBJECT_TYPE_OBJECT = 2

/** 一条查找结果。 */
export interface ObjectLookupEntry {
  /** `Levels.txt` 的 act 号，1..5。 */
  readonly act: number
  /** DS1 记录里的 `id`（该 act 对象表的索引）。 */
  readonly ds1Id: number
  /** `Objects.txt` 行号；-1 表示这份表没给出行号（要靠 token 反查）。 */
  readonly objectsTxtId: number
  /** 实际使用的 token（目录名），空串表示该对象没有美术。 */
  readonly token: string
  /** 引擎放置该对象时用的动画模式 token（`NU`/`OP`/…），空串表示未知。 */
  readonly mode: string
  /** 固定朝向；-1 表示未指定（用 0）。 */
  readonly direction: number
  /** `Base` 指向 `Monsters` 而不是 `Objects`（表里有 11 条这种异常记录）。 */
  readonly baseIsMonsters: boolean
}

/** 解析后的每 act 表：ds1Id → 记录。 */
const CACHE = new Map<number, Map<number, ObjectLookupEntry>>()

/** 这份数据表里除 token 之外的统计，用于文档与验证脚本。 */
export interface ObjectLookupStats {
  /** 已移植的 act 号。 */
  readonly acts: readonly number[]
  /** 记录总数。 */
  readonly rows: number
  /** 有 token（有美术可查）的记录数。 */
  readonly withArt: number
  /** token 为空的记录数（不可见/占位对象）。 */
  readonly withoutArt: number
  /** 能直接对到 `Objects.txt` 行号的记录数。 */
  readonly withRow: number
}

/**
 * 解析一个 act 的记录串。
 *
 * @param act - act 号, for error messages.
 * @param packed - `;`-separated `id:obj:token:mode[:d⟨dir⟩][:m]` records.
 * @returns the parsed map.
 */
function parseAct(act: number, packed: string): Map<number, ObjectLookupEntry> {
  const out = new Map<number, ObjectLookupEntry>()
  for (const record of packed.split(';')) {
    if (record === '') continue
    const parts = record.split(':')
    const [idText, objText, token = '', mode = ''] = parts
    const id = Number(idText)
    const objectsTxtId = Number(objText)
    if (!Number.isFinite(id) || !Number.isFinite(objectsTxtId)) {
      throw new Error(`object lookup act ${String(act)}: malformed record "${record}"`)
    }
    let direction = -1
    let baseIsMonsters = false
    for (const flag of parts.slice(4)) {
      if (flag === 'm') baseIsMonsters = true
      else if (flag.startsWith('d')) direction = Number(flag.slice(1))
    }
    out.set(id, { act, ds1Id: id, objectsTxtId, token, mode, direction, baseIsMonsters })
  }
  return out
}

/**
 * 取一个 act 的查找表（解析一次后缓存）。
 *
 * @param act - act 号.
 * @returns the map, or null when this act is not in the table.
 */
function tableFor(act: number): Map<number, ObjectLookupEntry> | null {
  const cached = CACHE.get(act)
  if (cached !== undefined) return cached
  const packed = OBJECT_LOOKUP_ROWS[act]
  if (packed === undefined) return null
  const parsed = parseAct(act, packed)
  CACHE.set(act, parsed)
  return parsed
}

/**
 * 查一个 DS1 物体。
 *
 * @param act - act 号 (1..5)。
 * @param type - DS1 object `type`；只有 {@link OBJECT_TYPE_OBJECT} 会命中本表。
 * @param id - DS1 object `id`。
 * @returns the entry, or null when the table has no such record.
 */
export function lookupObject(act: number, type: number, id: number): ObjectLookupEntry | null {
  if (type !== OBJECT_TYPE_OBJECT) return null
  return tableFor(act)?.get(id) ?? null
}

/**
 * 按 token 反查一个 {@link ObjectLookupEntry}（大小写不敏感）。
 *
 * 有些记录没有 `Objects.txt` 行号，但 token 是真的；调用方可以拿 token 去 `Objects.txt`
 * 里找元数据（名称、尺寸、可选性）。
 *
 * @param act - act 号。
 * @param token - the token to search for.
 * @returns the first entry with that token, or null.
 */
export function lookupByToken(act: number, token: string): ObjectLookupEntry | null {
  const table = tableFor(act)
  if (table === null) return null
  const wanted = token.trim().toLowerCase()
  for (const entry of table.values()) {
    if (entry.token.toLowerCase() === wanted) return entry
  }
  return null
}

/**
 * 数据表的统计，用于文档与验证脚本。
 *
 * @returns the stats.
 */
export function objectLookupStats(): ObjectLookupStats {
  const acts = Object.keys(OBJECT_LOOKUP_ROWS).map(Number).sort((left, right) => left - right)
  let rows = 0
  let withArt = 0
  let withoutArt = 0
  let withRow = 0
  for (const act of acts) {
    for (const entry of tableFor(act)?.values() ?? []) {
      rows += 1
      if (entry.token === '') withoutArt += 1
      else withArt += 1
      if (entry.objectsTxtId >= 0) withRow += 1
    }
  }
  return { acts, rows, withArt, withoutArt, withRow }
}

/**
 * Objects.txt 中全部 16 种 Waypoint 对象行号（OperateFn = 23）。
 */
export const WAYPOINT_OBJECTS_TXT_IDS: ReadonlySet<number> = new Set([
  119, 145, 156, 157, 237, 238, 288, 323, 324, 398, 402, 429, 494, 496, 511, 539,
])

/**
 * 全部 Waypoint 对象的 Token 集合。
 */
export const WAYPOINT_TOKENS: ReadonlySet<string> = new Set([
  'WP', 'WI', 'WM', 'WN', 'WZ', 'WV', 'W7', 'QM', 'QL', 'YG', 'YI', 'YY', '8Y', '5A', '5O', '3P',
])

/**
 * 判断 Objects.txt 行号是否对应一个小站。
 */
export function isWaypointObjectsTxtId(objectsTxtId: number | null | undefined): boolean {
  if (objectsTxtId === null || objectsTxtId === undefined || objectsTxtId < 0) return false
  return WAYPOINT_OBJECTS_TXT_IDS.has(objectsTxtId)
}

/**
 * 判断 DS1 中的 (type, id) 是否在指定 act 中解析为小站。
 */
export function isWaypointDs1Object(act: number, type: number, id: number): boolean {
  if (type !== OBJECT_TYPE_OBJECT) return false
  const entry = lookupObject(act, type, id)
  if (entry !== null && entry.token !== '') {
    if (entry.objectsTxtId >= 0 && WAYPOINT_OBJECTS_TXT_IDS.has(entry.objectsTxtId)) return true
    if (WAYPOINT_TOKENS.has(entry.token.toUpperCase())) return true
    return false
  }
  // 容错与单元测试支持：若无艺术 token（或未查到记录），但 id 本身直接传入了 Objects.txt 行号（如 mock 对象直接声明 id: 119）
  return WAYPOINT_OBJECTS_TXT_IDS.has(id)
}

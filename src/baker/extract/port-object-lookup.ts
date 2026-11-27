// port-object-lookup.ts — 把 OpenDiablo2 的"DS1 对象 id → Objects.txt"硬编码表转成本项目的紧凑数据模块
//
// 背景（为什么需要它）：DS1 里对象的 `id` **不是** `Objects.txt` 的行号，而是"该 act 的对象表
// 索引"，这张表硬编码在游戏里。OpenDiablo2 把它整理成了
// `d2core/d2records/object_lookup_record_data.go`（7,891 行，来源是一份社区整理的表格），
// 并在 `d2mapstamp/stamp.go` 里用它做查找：
//
//     lookup := records.LookupObject(act, object.Type, object.ID)
//     objectRecord := records.Object.Details[lookup.ObjectsTxtId]
//
// 本脚本只做机械转换：读那份 Go 数据表 → 生成 `src/game/object-lookup-data.ts`
// （每个 act 一串 `id:obj:token:mode` 记录），运行时有解析器。
//
//   node scripts/port-object-lookup.ts [--source=samples/od2/object_lookup_record_data.go]
//
// 退出码非 0 表示源文件与预期不符（换了版本就必须重新核对，而不是默默接受）。

export {}

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

/** OpenDiablo2 的数据表（已保存在 samples/od2 下，见 samples/od2/MANIFEST.md）。 */
const SOURCE = process.argv.find(argument => argument.startsWith('--source='))?.slice('--source='.length)
  ?? 'samples/od2/object_lookup_record_data.go'
/** 生成物。 */
const TARGET = 'src/common/units/object-lookup-data.ts'
/** 源文件里应有的记录行数；不符就说明源换了版本。 */
const EXPECTED_ROWS = 7891
/** 只移植 `ObjectTypeItem`（物体）；`ObjectTypeCharacter` 是怪物/NPC，本项目无怪物。 */
const WANTED_TYPE = 'Item'

/** 一条解析出来的记录。 */
interface LookupRow {
  act: number
  id: number
  objectsTxtId: number
  token: string
  mode: string
  direction: number
  base: string
}

/**
 * 从一行 Go 结构体字面量里取一个字符串字段。
 *
 * @param line - the source line.
 * @param name - field name.
 * @returns the value without quotes, or null when absent.
 */
function stringField(line: string, name: string): string | null {
  const match = new RegExp(`\\b${name}: "([^"]*)"`).exec(line)
  return match?.[1] ?? null
}

/**
 * 从一行 Go 结构体字面量里取一个数字字段。
 *
 * @param line - the source line.
 * @param name - field name.
 * @returns the value, or null when absent.
 */
function numberField(line: string, name: string): number | null {
  const match = new RegExp(`\\b${name}: (-?\\d+)`).exec(line)
  return match?.[1] === undefined ? null : Number(match[1])
}

/**
 * 解析整个 Go 数据表。
 *
 * @param text - file contents.
 * @returns the rows worth porting, in source order.
 */
function parse(text: string): { rows: LookupRow[]; total: number } {
  const rows: LookupRow[] = []
  let total = 0
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('{Act:')) continue
    total += 1
    const type = /Type: d2enum\.ObjectType(\w+)/.exec(line)?.[1]
    if (type !== WANTED_TYPE) continue
    const act = numberField(line, 'Act')
    const id = numberField(line, 'Id')
    const objectsTxtId = numberField(line, 'ObjectsTxtId')
    if (act === null || id === null || objectsTxtId === null) continue
    rows.push({
      act,
      id,
      objectsTxtId,
      token: stringField(line, 'Token') ?? '',
      mode: stringField(line, 'Mode') ?? '',
      direction: numberField(line, 'Direction') ?? -1,
      base: stringField(line, 'Base') ?? '',
    })
  }
  return { rows, total }
}

/**
 * 把一条记录压成 `id:obj:token:mode` 串，非默认字段追加在后面。
 *
 * 编码规则（解析器在 `src/game/object-lookup.ts`）：
 * `id:obj:token:mode[:d⟨direction⟩][:m]`，其中 `m` 表示 Base 指向 Monsters 而不是 Objects。
 *
 * @param row - the record.
 * @returns the packed record.
 */
function pack(row: LookupRow): string {
  const parts = [String(row.id), String(row.objectsTxtId), row.token, row.mode]
  if (row.direction !== -1) parts.push(`d${String(row.direction)}`)
  if (/monsters/i.test(row.base)) parts.push('m')
  return parts.join(':')
}

/**
 * 主流程。
 */
function main(): void {
  const text = readFileSync(SOURCE, 'utf8')
  const sha256 = createHash('sha256').update(text).digest('hex')
  const { rows, total } = parse(text)
  if (total !== EXPECTED_ROWS) {
    throw new Error(`${SOURCE}: parsed ${String(total)} rows, expected ${String(EXPECTED_ROWS)} — the table changed, re-verify before porting`)
  }

  // 运行时按 (act, ds1Id) 建 Map，所以重复的 id 会互相覆盖；这里就按同样的规则去重，
  // 让"生成物里的统计量"与"运行时解析出来的记录数"严格相等（实测有 1 条重复）。
  const byAct = new Map<number, Map<number, string>>()
  for (const row of rows) {
    let bucket = byAct.get(row.act)
    if (bucket === undefined) { bucket = new Map<number, string>(); byAct.set(row.act, bucket) }
    bucket.set(row.id, pack(row))
  }
  const deduped = [...byAct.values()].reduce((sum, bucket) => sum + bucket.size, 0)
  // 有 token 才有美术：token 空的行是不可见/占位 id，Objects.txt 行号有没有都不影响这一条。
  const unique: LookupRow[] = []
  for (const bucket of byAct.values()) {
    for (const packedRecord of bucket.values()) {
      const found = rows.find(row => pack(row) === packedRecord)
      if (found !== undefined) unique.push(found)
    }
  }
  const withArt = unique.filter(row => row.token !== '').length
  const artless = unique.length - withArt
  const withRow = unique.filter(row => row.objectsTxtId >= 0).length

  const lines: string[] = []
  lines.push('// object-lookup-data.ts — 由 scripts/port-object-lookup.ts 生成，请勿手改。')
  lines.push('//')
  lines.push('// 数据来源：OpenDiablo2，d2core/d2records/object_lookup_record_data.go')
  lines.push(`//   sha256 ${sha256}`)
  lines.push(`//   共 ${String(total)} 行，其中 ObjectTypeItem ${String(rows.length)} 行、去重后 ${String(deduped)} 条`)
  lines.push('//   （怪物/NPC 行未移植：本项目没有怪物）')
  lines.push('//')
  lines.push('// 含义：DS1 里 `(act, type=Object, id)` → `Objects.txt` 行号 + 引擎用的 token/mode。')
  lines.push('// DS1 的 id 是"该 act 的对象表索引"，不是 Objects.txt 的行号，这张表就是那层映射。')
  lines.push('//')
  lines.push('// 编码：`<ds1Id>:<objectsTxtId>:<token>:<mode>[:d<direction>][:m]`，多条用 `;` 连接；')
  lines.push('// `objectsTxtId` 为 -1 表示该 id 在 Objects.txt 里没有行（不可见/占位对象）；')
  lines.push('// `m` 表示 Base 指向 /Data/Global/Monsters 而不是 /Data/Global/Objects。')
  lines.push('')
  lines.push('/** 每个 act 的物体查找表，值是打包后的记录串。 */')
  lines.push('export const OBJECT_LOOKUP_ROWS: Readonly<Record<number, string>> = {')
  for (const [act, bucket] of [...byAct].sort((left, right) => left[0] - right[0])) {
    lines.push(`  ${String(act)}: '${[...bucket.values()].join(';')}',`)
  }
  lines.push('}')
  lines.push('')
  lines.push('/** 表里带 token（= 有美术可查）的记录数。 */')
  lines.push(`export const OBJECT_LOOKUP_WITH_ART = ${String(withArt)}`)
  lines.push('')
  lines.push('/** 表里 token 为空的记录数：这些是不可见/占位对象，画不出来是对的。 */')
  lines.push(`export const OBJECT_LOOKUP_WITHOUT_ART = ${String(artless)}`)
  lines.push('')
  lines.push('/** 表里能对到 `Objects.txt` 行的记录数（其余只有 token/mode，没有名称与尺寸等元数据）。 */')
  lines.push(`export const OBJECT_LOOKUP_WITH_ROW = ${String(withRow)}`)
  lines.push('')

  writeFileSync(TARGET, lines.join('\n'))
  console.log(`${TARGET}: ${String(rows.length)} 行原始记录 → 去重后 ${String(deduped)} 条（有 token ${String(withArt)}，无 token ${String(artless)}，有 Objects.txt 行 ${String(withRow)}）`)
  console.log(`acts: ${[...byAct.keys()].sort((a, b) => a - b).join(', ')}`)
}

main()

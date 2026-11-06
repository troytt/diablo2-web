// verify-object-lookup.ts — 验收"DS1 对象 id → 实际 token/mode"这层查找
//
// 这一层是移植来的（OpenDiablo2 的 object_lookup_record_data.go），所以它必须与**另一个独立
// 来源**对得上才能算数：拿表里的 `objectsTxtId` 去 `Objects.txt` 查 Token，两者应当一致；
// 不一致的地方要**逐条列出来**并写清为什么（实测正好 26 条，全是 `Objects.txt` 写了占位符
// `SS`/`XX`/`SL`/`QO` 而表里是真 token 的情况）。
//
//   node scripts/verify-object-lookup.ts [--dir=samples/d2]
//
// 退出码非 0 表示有断言没过。

export {}

import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { loadObjectsTable } from '../src/common/units/objects.ts'
import type { ObjectsTable } from '../src/common/units/objects.ts'
import { OBJECT_LOOKUP_WITH_ART, OBJECT_LOOKUP_WITH_ROW, OBJECT_LOOKUP_WITHOUT_ART } from '../src/common/units/object-lookup-data.ts'
import { lookupObject, objectLookupStats } from '../src/common/units/object-lookup.ts'

/** 归档目录。 */
const DIR = process.argv.find(argument => argument.startsWith('--dir='))?.slice('--dir='.length) ?? 'samples/d2'

/**
 * `Objects.txt` 的 Token 列与查找表不一致、且**以查找表为准**的记录。
 *
 * 这些行的 `Objects.txt` Token 是占位符（`SS`/`XX`/`SL`/`QO`/`5F`/`6T`/…），而表里是引擎真正
 * 使用的 token（例如 act 2 的 jerhyn 是 `JE`）。上一轮"有美术但 Objects.txt 里没有对应行"的
 * 那串 token（`5I 5J 5M 5N 5O 9C …`）正是这批。表是这三条来源里唯一的真值，所以这里是白名单
 * 而不是失败项；但**必须逐条固定**，任何新增都会让断言失败，逼人重新核对。
 */
const TOKEN_OVERRIDES: readonly string[] = [
  '1/110/385:DC',
  '1/113/0:29',
  '2/16/121:JE',
  '2/17/122:JE',
  '2/102/133:AZ',
  '3/13/194:9C',
  '3/93/361:XO',
  '3/109/378:HR',
  '3/110/379:HR',
  '4/19/363:XQ',
  '4/46/255:DI',
  '4/64/408:98',
  '4/65/409:99',
  '5/31/419:YO',
  '5/33/425:YU',
  '5/53/459:XS',
  '5/54/460:2N',
  '5/55/461:0J',
  '5/56/462:0J',
  '5/92/509:5M',
  '5/103/511:5O',
  '5/107/504:5I',
  '5/108/505:5J',
  '5/111/510:5N',
  '5/125/542:XR',
  '5/126/543:XR',
]

/** 断言结果。 */
const checks: { name: string; ok: boolean; detail: string }[] = []

/**
 * 记录一条断言。
 *
 * @param name - what was checked.
 * @param ok - whether it held.
 * @param detail - evidence.
 */
function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`)
}

/**
 * 主流程。
 */
async function main(): Promise<void> {
  const stats = objectLookupStats()
  console.log(`lookup: acts ${stats.acts.join(',')}，记录 ${String(stats.rows)}，有 token ${String(stats.withArt)}，无 token ${String(stats.withoutArt)}，有 Objects.txt 行 ${String(stats.withRow)}\n`)

  check('五个 act 都有查找表', stats.acts.join(',') === '1,2,3,4,5', stats.acts.join(','))
  check('记录数与生成物一致', stats.rows === OBJECT_LOOKUP_WITH_ART + OBJECT_LOOKUP_WITHOUT_ART,
    `${String(stats.rows)} = ${String(OBJECT_LOOKUP_WITH_ART)} + ${String(OBJECT_LOOKUP_WITHOUT_ART)}`)
  check('有 token 的记录数稳定', stats.withArt === OBJECT_LOOKUP_WITH_ART && stats.withRow === OBJECT_LOOKUP_WITH_ROW,
    `withArt=${String(stats.withArt)} withRow=${String(stats.withRow)}`)
  check('记录数 = 3,615（每个 DS1 id 唯一）', stats.rows === 3615, `${String(stats.rows)} 条`)
  check('无 token 的记录数 = 193（不可见/占位对象）', stats.withoutArt === 193, `${String(stats.withoutArt)} 条`)

  // 具体点位：这些名字是从社区表里读出来的，写成断言是为了让"表换了版本"立刻暴露。
  const spots: readonly [number, number, string, string, string][] = [
    [1, 0, 'FN', 'NU', 'rogue fountain'],
    [1, 1, 'TO', 'ON', 'torch 1 tiki'],
    [1, 2, 'RB', 'ON', 'Fire, rogue camp'],
    [1, 5, 'L1', 'NU', 'Chest, R Large'],
    [2, 17, 'JE', 'NU', 'jerhyn'],
    [3, 104, '1Y', 'ON', 'mephisto red portal'],
    [5, 0, 'AO', 'NU', 'act 5 first object'],
  ]
  for (const [act, id, token, mode, label] of spots) {
    const entry = lookupObject(act, 2, id)
    check(`act ${String(act)} id ${String(id)} → ${token}/${mode}（${label}）`,
      entry !== null && entry.token === token && entry.mode === mode,
      entry === null ? '查不到' : `${entry.token}/${entry.mode}`)
  }
  check('怪物类型不命中本表', lookupObject(1, 1, 0) === null, 'type 1 走 MonPreset，不是本表')
  check('表里没有的 act 返回 null', lookupObject(9, 2, 0) === null, 'act 9 不存在')

  // 与 Objects.txt 交叉核对。
  const archives = new MountedArchives()
  for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    archives.add(name, await MpqArchive.open(await fileSource(`${DIR}/${name}`)))
  }
  const tables: ObjectsTable = await loadObjectsTable(archives)
  let same = 0
  let diffToken = 0
  let emptyToken = 0
  let missingRow = 0
  const unexpected: string[] = []
  const missingOverrides: string[] = []
  const seenOverrides = new Set<string>()
  const missingRowTokens: string[] = []
  for (const act of stats.acts) {
    for (const entry of lookupObjectRows(act)) {
      // 表说"没有 token"的记录（193 条）是不可见/占位对象：画不出来是对的。
      if (entry.token === '') { emptyToken += 1; continue }
      // 表给了 token 却没给行号：靠 token 反查元数据，下面单独断言。
      if (entry.objectsTxtId < 0) continue
      const row = tables.byId.get(entry.objectsTxtId)
      if (row === undefined) {
        // 社区表是对着另一版 Objects.txt 做的：有 3 条行号在 1.13c 里不存在。
        missingRow += 1
        missingRowTokens.push(entry.token)
        continue
      }
      const tableToken = row.token.trim().toUpperCase()
      const lookupToken = entry.token.toUpperCase()
      if (lookupToken === tableToken) { same += 1; continue }
      diffToken += 1
      const key = `${String(act)}/${String(entry.ds1Id)}/${String(entry.objectsTxtId)}:${lookupToken}`
      seenOverrides.add(key)
      if (!TOKEN_OVERRIDES.includes(key)) {
        unexpected.push(`${key}（Objects.txt 写的是 "${tableToken}"，name "${row.name}"）`)
      }
    }
  }
  for (const key of TOKEN_OVERRIDES) if (!seenOverrides.has(key)) missingOverrides.push(key)
  console.log(`\n   与 Objects.txt 交叉核对：一致 ${String(same)}，表覆盖占位符 ${String(diffToken)}，表说无 token ${String(emptyToken)}，行号在 1.13c 里不存在 ${String(missingRow)}`)
  check('不一致的记录恰好是那批占位符 token', unexpected.length === 0,
    unexpected.length === 0 ? `${String(TOKEN_OVERRIDES.length)} 条全部对上` : unexpected.slice(0, 5).join(' | '))
  check('覆盖条数 = 26', diffToken === TOKEN_OVERRIDES.length, `${String(diffToken)} 条`)
  check('白名单没有过期条目', missingOverrides.length === 0,
    missingOverrides.length === 0 ? '全部仍然有效' : missingOverrides.slice(0, 5).join(' | '))
  check('与 Objects.txt 完全一致的记录数 = 528', same === 528, `${String(same)} 条`)
  check('表说无 token 的记录数 = 193', emptyToken === 193, `${String(emptyToken)} 条`)
  check('行号缺失的 3 条仍然带真 token', missingRow === 3 && missingRowTokens.sort().join(',') === '7C,PX,PY',
    `缺失行号的 token：${missingRowTokens.join(',')}`)

  const passed = checks.filter(entry => entry.ok).length
  console.log(`\n${String(passed)}/${String(checks.length)} passed`)
  if (passed !== checks.length) process.exitCode = 1
}

/**
 * 枚举一个 act 的全部记录（`lookupObject` 是单点查询，这里要遍历）。
 *
 * @param act - act 号.
 * @returns the entries of that act.
 */
function lookupObjectRows(act: number): { ds1Id: number; objectsTxtId: number; token: string }[] {
  const out: { ds1Id: number; objectsTxtId: number; token: string }[] = []
  for (let id = 0; id < 4000; id += 1) {
    const entry = lookupObject(act, 2, id)
    if (entry !== null) out.push(entry)
  }
  return out
}

await main()

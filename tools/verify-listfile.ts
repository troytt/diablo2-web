// verify-listfile.ts — 用社区 listfile 把"归档里到底有没有这个成员"变成可判定的事实
//
// 背景：`d2data.mpq`/`Patch_D2.mpq` 都没有 `(listfile)`，Storm 的名字是**加密存的**，所以
// 原先 `listFiles()` 只能对能列目录的归档给出名字。1.13c 的社区 listfile
// （`samples/d2/listfile_113c.txt`，39551 行）补齐了这一点：拿它的每个名字去归档里做
// hash 查找，查到就是真成员。`MpqArchive.open` 的 `listfile` 选项就是为此存在的。
//
//   node scripts/verify-listfile.ts [--dir=samples/d2]
//
// 退出码非 0 表示有断言没过。

export {}

import { readFileSync } from 'node:fs'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'

/** 归档目录，`--dir=` 可覆盖。 */
const DIR = process.argv.find(argument => argument.startsWith('--dir='))?.slice('--dir='.length) ?? 'samples/d2'
/** listfile 文件（社区提供，1.13c）。 */
const LISTFILE = `${DIR}/listfile_113c.txt`

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
 * 主流程：读 listfile，逐个归档做名字解析，最后核对物体美术的结论。
 */
async function main(): Promise<void> {
  const names = readFileSync(LISTFILE, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0)
  const lower = new Set(names.map(name => name.toLowerCase()))
  check('listfile 非空', names.length > 30000, `${String(names.length)} 行`)
  check('listfile 去重后无重复', lower.size === names.length, `${String(lower.size)} 个不同名字`)
  check('listfile 带 (listfile) 自身', lower.has('(listfile)'), '社区 listfile 保留了归档管理成员')

  /** 每个归档期望的最低命中数，来自实测；低于它说明 listfile 或归档换了版本。 */
  const expectations: Record<string, { min: number; objects: number }> = {
    'Patch_D2.mpq': { min: 200, objects: 0 },
    'd2data.mpq': { min: 10700, objects: 2400 },
    'd2exp.mpq': { min: 9800, objects: 800 },
  }

  const resolvedByArchive = new Map<string, string[]>()
  for (const [file, want] of Object.entries(expectations)) {
    const archive = await MpqArchive.open(await fileSource(`${DIR}/${file}`), { listfile: names })
    const found = names.filter(name => archive.find(name) !== undefined)
    resolvedByArchive.set(file, found)
    const objects = found.filter(name => /objects[\\/]/i.test(name))
    console.log(`\n=== ${file} ===`)
    check(`${file} 名字命中数 ≥ ${String(want.min)}`, found.length >= want.min,
      `${String(found.length)} / ${String(names.length)}`)
    check(`${file} objects 成员数 ≈ ${String(want.objects)}`, Math.abs(objects.length - want.objects) <= 20,
      `${String(objects.length)} 个 objects 成员`)
  }

  // 1.13c 的关卡表就在 Patch_D2 里：解析器读的就是这些名字，名字错一个字节就全盘皆错。
  const patch = await MpqArchive.open(await fileSource(`${DIR}/Patch_D2.mpq`), { listfile: names })
  for (const table of ['Levels.txt', 'LvlMaze.txt', 'LvlPrest.txt', 'LvlSub.txt', 'LvlTypes.txt']) {
    const member = `data\\global\\excel\\${table}`
    const file = patch.find(member)
    check(`Patch_D2 有 ${table}`, file !== undefined, file === undefined ? '未找到' : `${String(file.fileSize)} 字节`)
  }
  console.log(`\n   Patch_D2 里 objects 目录：${String((resolvedByArchive.get('Patch_D2.mpq') ?? []).filter(name => /objects[\\/]/i.test(name)).length)}`
    + '（补丁归档不含可破坏物品美术，这是实测结论而不是猜测）')

  // 物体美术的关键结论：哪些 token 在全部归档里根本没有美术。
  const all = [...resolvedByArchive.values()].flat()
  for (const [token, expected] of [['9b', 4], ['tp', 12], ['ta', 0]] as const) {
    const hits = all.filter(name => new RegExp(`objects[\\\\/]${token}[\\\\/]`, 'i').test(name))
    check(`token ${token.toUpperCase()} 的成员数 = ${String(expected)}`, hits.length === expected, `${String(hits.length)} 个`)
  }

  const passed = checks.filter(entry => entry.ok).length
  console.log(`\n${String(passed)}/${String(checks.length)} passed`)
  if (passed !== checks.length) process.exitCode = 1
}

await main()

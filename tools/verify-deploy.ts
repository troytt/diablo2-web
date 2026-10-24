// verify-deploy.ts — 线上部署自检（不需要浏览器）
//
// 检查 https://www.laiseek.xyz/diablo2/ 这一套入口是否真的可用：页面、资源包索引、
// 图集分页、以及按 HTTP range 读 .mpq 的 206；同时确认旧入口 /acts* 已经下线（410）。
// 默认打公网域名，`--host=http://127.0.0.1` 可以改成打本机（跳过 TLS）。
//
//   node scripts/verify-deploy.ts
//   node scripts/verify-deploy.ts --host=https://www.laiseek.xyz
//
// 退出码非 0 表示有断言没过。

export {}

/** 公网入口，可用 `--host=` 覆盖。 */
const HOST = process.argv.find(argument => argument.startsWith('--host='))?.slice('--host='.length)
  ?? 'https://www.laiseek.xyz'

/** 一个断言的结果。 */
interface Check {
  readonly name: string
  readonly ok: boolean
  readonly detail: string
}

/** 已跑过的断言。 */
const checks: Check[] = []

/**
 * 记录一条断言。
 *
 * @param name - what was checked.
 * @param ok - whether it held.
 * @param detail - human-readable evidence.
 */
function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`)
}

/**
 * 取一个 URL，返回状态码、头与正文长度；网络错误也算作结果，不抛出。
 *
 * @param path - path on the host, starting with `/`.
 * @param init - extra fetch options.
 * @returns the response facts.
 */
async function probe(path: string, init?: RequestInit): Promise<{ status: number; headers: Headers; text: string }> {
  try {
    const response = await fetch(`${HOST}${path}`, { redirect: 'manual', ...init })
    const text = init?.method === 'HEAD' ? '' : await response.text()
    return { status: response.status, headers: response.headers, text }
  } catch (err) {
    return { status: 0, headers: new Headers(), text: (err as Error).message }
  }
}

/**
 * 线上自检主流程。
 */
async function main(): Promise<void> {
  console.log(`host: ${HOST}\n`)

  // 页面：入口要 200，且引用的资源都带 /diablo2/ 前缀（base 配错会立刻在这里暴露）
  const page = await probe('/diablo2/')
  check('/diablo2/ 200', page.status === 200, `HTTP ${String(page.status)}`)
  const assetPaths = [...page.text.matchAll(/(?:src|href)="(\/diablo2\/assets\/[^"]+)"/g)].map(match => match[1]!)
  check('页面引用 /diablo2/assets/*', assetPaths.length > 0, `${String(assetPaths.length)} 个资源引用`)
  // 三级选择器：章节 / 场景 / 细分场景。断言三个 id 都在，多了会漏、少了会错位。
  const selectors = ['id="act"', 'id="scene"', 'id="variant"']
  check('页面是地图页（含三级选择器）', selectors.every(id => page.text.includes(id)),
    `acts.html 已被入口 rewrite 命中；选择器 ${selectors.filter(id => page.text.includes(id)).length}/3`)
  check('header 上没有多余站内链接', !/<header[^>]*>[\s\S]*?<a\s/.test(page.text), 'header 只留标题与 HUD')
  if (assetPaths[0] !== undefined) {
    const asset = await probe(assetPaths[0], { method: 'HEAD' })
    check('首个资源可达', asset.status === 200, `${assetPaths[0]} → HTTP ${String(asset.status)}`)
  }

  // 资源包索引：条数、调色板、每条 path 都有 scene.json
  const index = await probe('/diablo2/packs/index.json')
  check('资源包索引 200', index.status === 200, `HTTP ${String(index.status)}`)
  let levels: { act: number; path: string; label: string }[] = []
  let palettes: Record<string, number[]> = {}
  try {
    const parsed = JSON.parse(index.text) as { levels?: typeof levels; palettes?: typeof palettes }
    levels = parsed.levels ?? []
    palettes = parsed.palettes ?? {}
  } catch (err) {
    check('索引是 JSON', false, (err as Error).message)
  }
  check('索引是 JSON', levels.length > 0, `${String(levels.length)} 个地图块`)
  check('索引带 act 调色板', Object.keys(palettes).length >= 5,
    `${String(Object.keys(palettes).length)} 组，每组 ${String(palettes.act1?.length ?? 0)} 字节`)
  const actCounts = new Map<number, number>()
  for (const level of levels) actCounts.set(level.act, (actCounts.get(level.act) ?? 0) + 1)
  check('五个 act 都有地图', actCounts.size === 5,
    [...actCounts].sort((left, right) => left[0] - right[0]).map(([act, count]) => `act${String(act)}:${String(count)}`).join(' '))

  // 抽第一个和最后一个地图块，确认 scene.json 与第一页 PNG 真的在
  for (const entry of [levels[0], levels[levels.length - 1]]) {
    if (entry === undefined) continue
    const scene = await probe(`/diablo2/packs/${entry.path}/scene.json`)
    check(`scene.json 200（${entry.label}）`, scene.status === 200, `HTTP ${String(scene.status)}`)
    let page0: string | null = null
    try {
      const parsed = JSON.parse(scene.text) as { pages?: { file: string }[] }
      page0 = parsed.pages?.[0]?.file ?? null
    } catch { /* 上面那条断言已经失败，这里只补详情 */ }
    if (page0 !== null) {
      const png = await probe(`/diablo2/packs/${entry.path}/${page0}`, { method: 'HEAD' })
      check(`首屏图集 200（${entry.label}）`, png.status === 200, `${page0} → HTTP ${String(png.status)}`)
    }
  }

  // 归档：只暴露 .mpq，且必须支持 Range（否则页面回退到整文件下载）
  const range = await probe('/diablo2/data/d2char.mpq', { headers: { Range: 'bytes=0-1023' } })
  check('d2char.mpq Range 206', range.status === 206, `HTTP ${String(range.status)} ${range.headers.get('content-range') ?? ''}`)
  const traversal = await probe('/diablo2/data/..%2f..%2fetc%2fpasswd')
  check('归档路径穿越被拒', traversal.status !== 200, `HTTP ${String(traversal.status)}`)

  // 旧入口下线：页面、资源包、归档三条都不该再服务内容
  for (const path of ['/acts/', '/acts-packs/index.json', '/acts-data/d2char.mpq']) {
    const gone = await probe(path)
    check(`旧入口下线 ${path}`, gone.status === 410, `HTTP ${String(gone.status)}`)
  }

  const passed = checks.filter(entry => entry.ok).length
  console.log(`\n${String(passed)}/${String(checks.length)} passed`)
  if (passed !== checks.length) process.exitCode = 1
}

await main()

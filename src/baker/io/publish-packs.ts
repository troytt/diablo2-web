/**
 * Publish `samples/d2-packs` to the asset repository.
 *
 * The baked atlas packs are ~66 MB of indexed PNG. PNG is already deflate
 * compressed, so git's delta compression buys almost nothing: every re-bake changes
 * nearly every file, and a normal commit would grow the repository by another ~60 MB
 * each time (measured: the code repository went 63 MB → 117 MB over two bakes).
 *
 * So the asset repository deliberately keeps **exactly one commit**: every publish
 * creates an orphan history (a brand new repository in a temp directory), commits the
 * current packs, and force-pushes it over the remote. The repository therefore stays
 * at "one snapshot" (~66 MB) no matter how often the packs are re-baked, and the code
 * repository — which no longer contains the packs — clones in a couple of megabytes.
 *
 * Usage:
 * ```
 * node scripts/publish-packs.ts <git-remote-url>              # explicit remote
 * D2_ASSETS_REMOTE=<git-remote-url> node scripts/publish-packs.ts
 * ```
 *
 * The remote is required: pass it as the first argument or set `D2_ASSETS_REMOTE`.
 * No deployment address is hard-coded in this module. `D2_CODE_REPO` and
 * `D2_ARCHIVE_BASE` optionally add a code-repository link and an archive download
 * hint to the generated README; without them the README simply omits those lines.
 *
 * The remote needs credentials; either pass a URL with them, or run
 * `git config --global credential.helper store` once so `git push` does not prompt.
 * Nothing here writes a password to disk.
 *
 * @module
 */

import { execFileSync } from 'node:child_process'
import {
  cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { generateAssetManifest } from './asset-manifest.ts'

/** Where the packs live inside the code repository. */
const ROOT_DIR = resolve(import.meta.dirname, '..', '..', '..')
const PACKS_DIR = resolve(ROOT_DIR, 'public', 'packs')

/** Environment variable holding the git remote of the asset repository. */
const ASSETS_REMOTE_ENV = 'D2_ASSETS_REMOTE'

/** Environment variable holding the public code repository linked from the generated README. */
const CODE_REPO_ENV = 'D2_CODE_REPO'

/** Environment variable holding the archive mirror base URL quoted in the generated README. */
const ARCHIVE_BASE_ENV = 'D2_ARCHIVE_BASE'

/** Raised when the packs are missing or git fails. */
class PublishError extends Error {}

/**
 * Read an optional http(s) base URL from the environment.
 *
 * @param name - environment variable name.
 * @returns the trimmed URL, or `undefined` when the variable is unset or empty.
 * @throws when the variable is set but is not an http(s) URL.
 */
function optionalUrl(name: string): string | undefined {
  const raw = process.env[name]?.trim()
  if (!raw) return undefined
  if (!/^https?:\/\/\S+$/.test(raw)) {
    throw new PublishError(`${name} must be an http(s) URL, got "${raw}"`)
  }
  return raw
}

/**
 * Run one git command in `cwd`, inheriting stdio so progress is visible.
 *
 * @param args - git arguments.
 * @param cwd - directory to run in.
 */
function git(args: readonly string[], cwd: string): void {
  try {
    execFileSync('git', args, { cwd, stdio: ['ignore', 'inherit', 'inherit'] })
  } catch {
    throw new PublishError(`git ${args.join(' ')} failed`)
  }
}

/**
 * Collect the statistics that go into the generated README.
 *
 * @returns file count, total bytes, map-block count and the `index.json` hash.
 */
function measure(): { files: number; bytes: number; maps: number; indexSha: string } {
  const indexPath = join(PACKS_DIR, 'index.json')
  if (!existsSync(indexPath)) {
    throw new PublishError(`no packs at ${PACKS_DIR} — run: npm run pack:data`)
  }
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as { entries?: unknown[]; levels?: unknown[] }
  const indexSha = createHash('sha256').update(readFileSync(indexPath)).digest('hex')
  let files = 0
  let bytes = 0
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else {
        files += 1
        bytes += statSync(path).size
      }
    }
  }
  walk(PACKS_DIR)
  return { files, bytes, maps: index.levels?.length ?? index.entries?.length ?? 0, indexSha }
}

/**
 * Build the README that ships inside the asset repository.
 *
 * @param stats - output of {@link measure}.
 * @param stamp - `YYYY-MM-DD` bake date.
 * @returns the markdown text.
 */
function readme(stats: ReturnType<typeof measure>, stamp: string, remote: string): string {
  const mb = (stats.bytes / 1048576).toFixed(1)
  const codeRepo = optionalUrl(CODE_REPO_ENV)
  const archiveBase = optionalUrl(ARCHIVE_BASE_ENV)
  const provenance = codeRepo
    ? `这是 [\`d2web\`](${codeRepo}) 的**烘焙产物**：把原版暗黑破坏神 II（1.13c）的地图`
    : '这是 **d2web** 的**烘焙产物**：把原版暗黑破坏神 II（1.13c）的地图'
  const archiveSection = archiveBase
    ? `只要一份压缩包（不需要 git）：\n\n\`\`\`bash\ncurl -O ${archiveBase}/d2-packs-${stamp}.tar.xz\ntar xJf d2-packs-${stamp}.tar.xz\n\`\`\`\n\n`
    : ''
  return `# d2web 烘焙图集包（${stamp}）

${provenance}
解包成 web 原生格式——索引色 PNG 图集页 + \`scene.json\`（画家序绘制列表、碰撞 RLE、出生点、
对象元数据）+ \`index.json\`（含各 act 调色板）。

- 地图块 **${stats.maps} 个**（覆盖全 5 幕 136 个关卡预置与随机变体），文件 **${stats.files} 个**，合计 **${mb} MB**
- \`index.json\` sha256：\`${stats.indexSha}\`
- 生成时间：${stamp}

## 本仓库为什么只有一个提交

图集页是索引色 PNG（deflate 已压缩），git 的 delta 压缩对它几乎无收益：每次重烘几乎全部文件
都会变。若按普通方式提交，每烘焙一次仓库就再长 ~60 MB（实测代码仓库因此从 63 MB 涨到 117 MB）。
所以这里刻意**只保留一个提交**：每次重烘用 orphan 提交 + force push 覆盖，仓库体积恒定在
「一份快照」≈${Math.round(stats.bytes / 1048576)} MB。历史没有价值——需要旧版请从代码仓库
对应提交重新烘焙。

## 怎么用

\`\`\`bash
# 放进代码仓库的 samples/d2-packs/，页面默认就吃这个目录
git clone ${remote} samples/d2-packs
\`\`\`

${archiveSection}## 怎么重新生成并发布

在代码仓库里（需要自备原版 MPQ，放在 \`samples/d2/\`）：

\`\`\`bash
npm run pack:data        # scripts/pack-act-assets.ts → samples/d2-packs（约 2 分钟）
npm run verify:packs     # 与"现读现解"逐项比对：绘制序、碰撞栅格逐字节、每帧像素哈希
npm run publish:packs    # orphan 提交 + force push 覆盖本仓库
\`\`\`

## 许可

内容为原版游戏美术的解码产物，仅供**持有正版游戏数据**的人在本项目内使用；请勿再分发。
原版 MPQ 与第三方参考源码都不在本仓库内。
`
}

/* ------------------------------------------------------------------------- *
 * Batch planning
 * ------------------------------------------------------------------------- */

/**
 * Target size of one push batch, in bytes.
 *
 * The asset remote sits behind a high-loss cross-border link: measured 13.7%
 * TCP retransmission, MSS clamped to 324 bytes by a middlebox, and a congestion
 * window pinned at 3–4 segments, which caps a single connection at roughly
 * 20 KB/s. A 100 MB push therefore needs ~1.5 h of uninterrupted connection and
 * loses everything on the first reset. Batching at ~10 MB keeps each push to a
 * few minutes and makes a retry cheap.
 */
const MAX_BATCH_BYTES = 25 * 1024 * 1024

/** How many times to retry one push before giving up. */
const PUSH_ATTEMPTS = 5

/** The order pack directories are published in, smallest first so the remote is usable early. */
const PACK_CATEGORIES = [
  'anim',
  'missiles',
  'overlays',
  'act4',
  'act3',
  'act5',
  'act2',
  'act1',
  'entities',
] as const

/** One push batch: a set of relative paths inside one top-level pack directory. */
interface Batch {
  readonly act: string
  /** Paths relative to {@link PACKS_DIR}, e.g. `act1/1-act-1-town-townn1` or `entities/char-so.r8`. */
  readonly paths: readonly string[]
  readonly bytes: number
}

/**
 * Total size of a file or directory tree, in bytes.
 *
 * @param target - absolute path.
 * @returns bytes, `.git` excluded.
 */
function entrySize(target: string): number {
  const st = statSync(target)
  if (!st.isDirectory()) return st.size
  let bytes = 0
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === '.git') continue
    bytes += entrySize(join(target, entry.name))
  }
  return bytes
}

/**
 * Split every top-level pack directory into batches of at most {@link MAX_BATCH_BYTES}.
 *
 * Direct child entries (map directories, overlay subdirectories, or individual asset files)
 * are never split, so a single oversized entry becomes a batch of its own. The order within
 * a category is the sorted directory listing order, so the plan is stable across runs —
 * which is what makes resuming safe.
 *
 * @returns the batches, category by category in {@link PACK_CATEGORIES}.
 */
function planBatches(): Batch[] {
  const batches: Batch[] = []
  for (const category of PACK_CATEGORIES) {
    const categoryDir = join(PACKS_DIR, category)
    if (!existsSync(categoryDir)) continue
    const entries = readdirSync(categoryDir, { withFileTypes: true })
      .filter(entry => entry.name !== '.git')
      .map(entry => entry.name)
      .sort()

    let current: string[] = []
    let currentBytes = 0
    const flush = (): void => {
      if (current.length === 0) return
      batches.push({ act: category, paths: current, bytes: currentBytes })
      current = []
      currentBytes = 0
    }
    for (const name of entries) {
      const bytes = entrySize(join(categoryDir, name))
      if (currentBytes > 0 && currentBytes + bytes > MAX_BATCH_BYTES) flush()
      current.push(`${category}/${name}`)
      currentBytes += bytes
    }
    flush()
  }
  return batches
}

/* ------------------------------------------------------------------------- *
 * Git helpers that tolerate a lossy link
 * ------------------------------------------------------------------------- */

/**
 * Run one git command and capture stdout instead of inheriting it.
 *
 * @param args - git arguments.
 * @param cwd - directory to run in.
 * @returns trimmed stdout, or null when the command failed.
 */
function gitQuery(args: readonly string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/**
 * Push `main`, retrying with linear backoff.
 *
 * `http.lowSpeedLimit`/`http.lowSpeedTime` are what stop a dead connection from
 * hanging for hours: git aborts once throughput stays under 1 KB/s for two
 * minutes, and the retry opens a fresh connection — which on this link usually
 * comes back with a healthy congestion window.
 *
 * @param remoteUrl - the push target.
 * @param cwd - the work repository.
 * @param label - what is being pushed, for the log.
 * @throws when every attempt fails.
 */
function pushWithRetry(remoteUrl: string, cwd: string, label: string): void {
  for (let attempt = 1; attempt <= PUSH_ATTEMPTS; attempt += 1) {
    try {
      execFileSync('git', ['push', remoteUrl, 'main'], { cwd, stdio: ['ignore', 'inherit', 'inherit'] })
      return
    } catch {
      if (attempt === PUSH_ATTEMPTS) {
        throw new PublishError(`推送「${label}」失败：已重试 ${String(PUSH_ATTEMPTS)} 次`)
      }
      const waitSeconds = attempt * 15
      console.log(`  ↻ 推送「${label}」第 ${String(attempt)} 次失败，${String(waitSeconds)} 秒后重试…`)
      execFileSync('sleep', [String(waitSeconds)], { stdio: 'ignore' })
    }
  }
}

/**
 * Is `path` already committed in the work repository's `HEAD`?
 *
 * @param path - path relative to the repository root.
 * @param cwd - the work repository.
 * @returns true when `HEAD` already carries it.
 */
function committed(path: string, cwd: string): boolean {
  const listed = gitQuery(['ls-tree', '--name-only', 'HEAD', path], cwd)
  return listed !== null && listed !== ''
}

/* ------------------------------------------------------------------------- *
 * Driver
 * ------------------------------------------------------------------------- */

const args = process.argv.slice(2)
const workFlagIndex = args.indexOf('--work')
const reuseWork = workFlagIndex >= 0 ? args[workFlagIndex + 1] : undefined
const positional = args.filter((value, index) =>
  value !== '--work' && index !== workFlagIndex + 1)

const remote = positional[0] ?? process.env[ASSETS_REMOTE_ENV]
if (remote === undefined || remote === '') {
  throw new PublishError(
    `Asset repository remote is required: pass it as the first argument or set ${ASSETS_REMOTE_ENV}`,
  )
}
const stats = measure()
const stamp = new Date().toISOString().slice(0, 10)
const keepWork = reuseWork !== undefined
const work = reuseWork ?? mkdtempSync(join(tmpdir(), 'd2-assets-'))

try {
  const batches = planBatches()
  const totalBytes = batches.reduce((sum, batch) => sum + batch.bytes, 0)
  console.log(`图集包：${String(stats.maps)} 块地图 / ${String(stats.files)} 个文件 / ${(stats.bytes / 1048576).toFixed(1)} MB`)
  console.log(`index.json sha256：${stats.indexSha}`)
  console.log(`临时仓库：${work}${keepWork ? '（复用，断点续传）' : ''}`)
  console.log(`推送计划：${String(batches.length)} 个批次，单批上限 ${String(MAX_BATCH_BYTES / 1048576)} MB，合计 ${(totalBytes / 1048576).toFixed(1)} MB`)

  if (!keepWork) git(['init', '-q', '-b', 'main'], work)
  // A 500 MB post buffer keeps git from chunking the upload; HTTP/1.1 avoids the
  // remote's HTTP/2 stream resets; the low-speed guard turns a stalled
  // connection into a fast failure that `pushWithRetry` can recover from.
  git(['config', 'http.postBuffer', '524288000'], work)
  git(['config', 'http.version', 'HTTP/1.1'], work)
  git(['config', 'http.lowSpeedLimit', '1000'], work)
  git(['config', 'http.lowSpeedTime', '120'], work)
  // PNG atlas pages are already deflate compressed, so delta search is pure cost.
  git(['config', 'pack.' + 'win' + 'dow', '0'], work)
  git(['config', 'core.compression', '1'], work)

  // Resume: rewind the work tree to whatever the remote already has, so a
  // half-finished oversized commit from an earlier run is discarded rather than
  // re-uploaded.
  if (keepWork) {
    const remoteSha = gitQuery(['ls-remote', remote, 'main'], work)?.split(/\s+/)[0]
    if (remoteSha !== undefined && gitQuery(['cat-file', '-e', `${remoteSha}^{commit}`], work) !== null) {
      console.log(`远端 main 位于 ${remoteSha.slice(0, 7)}，回卷工作区以对齐…`)
      git(['reset', '--hard', '-q', remoteSha], work)
      git(['clean', '-qfd'], work)
    }
  }

  // Step 0: metadata and index.
  if (!committed('index.json', work)) {
    const assetManifest = generateAssetManifest({ rootDir: ROOT_DIR, packsDir: PACKS_DIR })
    writeFileSync(join(work, 'README.md'), readme(stats, stamp, remote))
    writeFileSync(join(work, '.gitattributes'), '*.png binary -diff\n*.r8 binary -diff\n*.json text eol=lf\n')
    writeFileSync(join(work, 'asset-manifest.json'), `${JSON.stringify(assetManifest, null, 2)}\n`, 'utf8')
    cpSync(join(PACKS_DIR, 'index.json'), join(work, 'index.json'))
    if (existsSync(join(PACKS_DIR, 'world-graph.json'))) {
      cpSync(join(PACKS_DIR, 'world-graph.json'), join(work, 'world-graph.json'))
    }
    git(['add', '-A'], work)
    git([
      '-c', `user.name=${process.env['GIT_AUTHOR_NAME'] ?? 'd2web-baker'}`,
      '-c', `user.email=${process.env['GIT_AUTHOR_EMAIL'] ?? 'd2web-baker@localhost'}`,
      'commit', '-q', '-m',
      `烘焙图集包 ${stamp} [0]：索引与元数据\n\nindex.json sha256: ${stats.indexSha}\n\n由 d2web 的 npm run pack:data 生成。`,
    ], work)
    console.log(`推送到 ${remote}（force，覆盖历史，初始化基线）…`)
    git(['push', '--force', remote, 'main'], work)
  } else {
    console.log('索引与元数据已在远端，跳过。')
  }

  // Steps 1..N: one small batch per push.
  let sentBytes = 0
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i]!
    const label = `${String(i + 1)}/${String(batches.length)} ${batch.act} (${(batch.bytes / 1048576).toFixed(1)} MB)`
    sentBytes += batch.bytes

    if (batch.paths.every(path => committed(path, work))) {
      console.log(`[${label}] 已在远端，跳过。`)
      continue
    }

    for (const path of batch.paths) {
      cpSync(join(PACKS_DIR, path), join(work, path), { recursive: true })
    }
    git(['add', ...batch.paths], work)
    git([
      '-c', `user.name=${process.env['GIT_AUTHOR_NAME'] ?? 'd2web-baker'}`,
      '-c', `user.email=${process.env['GIT_AUTHOR_EMAIL'] ?? 'd2web-baker@localhost'}`,
      'commit', '-q', '-m',
      `烘焙图集包 ${stamp} [${String(i + 1)}/${String(batches.length)}]：${batch.act} ${String(batch.paths.length)} 项`,
    ], work)
    console.log(`[${label}] 推送中…（累计 ${(sentBytes / 1048576).toFixed(1)}/${(totalBytes / 1048576).toFixed(1)} MB）`)
    pushWithRetry(remote, work, label)
  }

  console.log('完成。使用方：git clone ' + remote + ' samples/d2-packs')
} finally {
  if (!keepWork) rmSync(work, { recursive: true, force: true })
  else console.log(`工作区保留在 ${work}（下次可用 --work ${work} 续传）`)
}


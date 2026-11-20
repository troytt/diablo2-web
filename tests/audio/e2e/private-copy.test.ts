import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mirrorRepoWithCopies } from './harness-113c.ts'
import { copyPrivate, materializeSymlinks } from './private-copy.ts'

function assertNoSymlinksAnywhere(root: string): void {
  const st = lstatSync(root)
  expect(st.isSymbolicLink(), `${root} must not be a symlink`).toBe(false)
  if (st.isDirectory()) {
    for (const name of readdirSync(root)) {
      assertNoSymlinksAnywhere(join(root, name))
    }
  }
}

describe('copyPrivate & materializeSymlinks (#1619): tamper mirrors never write through symlinks', () => {
  const dirs: string[] = []
  const tempDir = (prefix = 'private-copy-'): string => {
    const d = mkdtempSync(join(tmpdir(), prefix))
    dirs.push(d)
    return d
  }

  afterEach(() => {
    for (const d of dirs.splice(0)) {
      // Restore write bits before cleanup in case a test created 0o555/0o444 fixtures.
      const makeWritable = (p: string): void => {
        const lst = lstatSync(p, { throwIfNoEntry: false })
        if (!lst || lst.isSymbolicLink()) return
        if (lst.isDirectory()) {
          chmodSync(p, 0o755)
          for (const child of readdirSync(p)) makeWritable(join(p, child))
        } else {
          chmodSync(p, 0o644)
        }
      }
      makeWritable(d)
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('materializes nested absolute and relative file & directory symlinks across distinct temp trees', () => {
    const srcTree = tempDir('private-copy-src-')
    const dstTree = tempDir('private-copy-dst-')

    mkdirSync(join(srcTree, 'shared', 'sub'), { recursive: true })
    writeFileSync(join(srcTree, 'shared', 'pack-abs.bin'), 'D2SP-abs-original')
    writeFileSync(join(srcTree, 'shared', 'pack-rel.bin'), 'D2SP-rel-original')
    writeFileSync(join(srcTree, 'shared', 'sub', 'deep.bin'), 'deep-original')

    // Real directory whose entries mix absolute and relative symlinks into the shared store.
    const packsDir = join(srcTree, 'checkout', 'public', 'sound', 'packs')
    mkdirSync(packsDir, { recursive: true })
    symlinkSync(join(srcTree, 'shared', 'pack-abs.bin'), join(packsDir, 'pack-abs.bin'))
    symlinkSync(relative(packsDir, join(srcTree, 'shared', 'pack-rel.bin')), join(packsDir, 'pack-rel.bin'))
    symlinkSync(relative(packsDir, join(srcTree, 'shared', 'sub')), join(packsDir, 'sub'))

    const mirrorDir = join(dstTree, 'mirror', 'packs')
    copyPrivate(packsDir, mirrorDir)

    assertNoSymlinksAnywhere(mirrorDir)
    expect(statSync(join(mirrorDir, 'pack-abs.bin')).ino).not.toBe(statSync(join(srcTree, 'shared', 'pack-abs.bin')).ino)
    expect(statSync(join(mirrorDir, 'pack-rel.bin')).ino).not.toBe(statSync(join(srcTree, 'shared', 'pack-rel.bin')).ino)

    writeFileSync(join(mirrorDir, 'pack-abs.bin'), 'tampered-abs')
    writeFileSync(join(mirrorDir, 'pack-rel.bin'), 'tampered-rel')
    writeFileSync(join(mirrorDir, 'sub', 'deep.bin'), 'tampered-deep')

    expect(readFileSync(join(srcTree, 'shared', 'pack-abs.bin'), 'utf8')).toBe('D2SP-abs-original')
    expect(readFileSync(join(srcTree, 'shared', 'pack-rel.bin'), 'utf8')).toBe('D2SP-rel-original')
    expect(readFileSync(join(srcTree, 'shared', 'sub', 'deep.bin'), 'utf8')).toBe('deep-original')
  })

  it('materializes chained multi-hop symlinks, symlinks nested inside symlinked directories, and diamond directory links', () => {
    const d = tempDir()
    mkdirSync(join(d, 'vault'), { recursive: true })
    mkdirSync(join(d, 'shared', 'sub'), { recursive: true })
    mkdirSync(join(d, 'hops'), { recursive: true })
    mkdirSync(join(d, 'packs'), { recursive: true })

    writeFileSync(join(d, 'vault', 'leaf.bin'), 'vault-leaf-original')
    writeFileSync(join(d, 'shared', 'sub', 'shared-file.bin'), 'shared-sub-original')
    // Symlink inside a directory that is itself reached through a directory symlink.
    symlinkSync(relative(join(d, 'shared', 'sub'), join(d, 'vault', 'leaf.bin')), join(d, 'shared', 'sub', 'nested-link.bin'))

    // 3-hop chain: packs/chained.bin -> ../hops/hop2.bin -> hop1.bin -> /abs/.../vault/leaf.bin
    symlinkSync(join(d, 'vault', 'leaf.bin'), join(d, 'hops', 'hop1.bin'))
    symlinkSync('hop1.bin', join(d, 'hops', 'hop2.bin'))
    symlinkSync(relative(join(d, 'packs'), join(d, 'hops', 'hop2.bin')), join(d, 'packs', 'chained.bin'))

    // Diamond sibling directory symlinks pointing to the same shared directory.
    symlinkSync(join(d, 'shared', 'sub'), join(d, 'packs', 'dir-a'))
    symlinkSync(relative(join(d, 'packs'), join(d, 'shared', 'sub')), join(d, 'packs', 'dir-b'))

    const mirror = join(d, 'mirror')
    copyPrivate(join(d, 'packs'), mirror)
    assertNoSymlinksAnywhere(mirror)

    writeFileSync(join(mirror, 'chained.bin'), 'tampered-chain')
    writeFileSync(join(mirror, 'dir-a', 'nested-link.bin'), 'tampered-dir-a-leaf')
    writeFileSync(join(mirror, 'dir-a', 'shared-file.bin'), 'tampered-dir-a-shared')

    // Sibling diamond copy `dir-b` and all shared originals remain untouched.
    expect(readFileSync(join(mirror, 'dir-b', 'nested-link.bin'), 'utf8')).toBe('vault-leaf-original')
    expect(readFileSync(join(mirror, 'dir-b', 'shared-file.bin'), 'utf8')).toBe('shared-sub-original')
    expect(readFileSync(join(d, 'vault', 'leaf.bin'), 'utf8')).toBe('vault-leaf-original')
    expect(readFileSync(join(d, 'shared', 'sub', 'shared-file.bin'), 'utf8')).toBe('shared-sub-original')
  })

  it('omits nested broken/dangling symlinks so copyPrivate neither crashes nor leaves dangling write-through links', () => {
    const d = tempDir()
    mkdirSync(join(d, 'shared'), { recursive: true })
    mkdirSync(join(d, 'packs'), { recursive: true })
    writeFileSync(join(d, 'shared', 'live.bin'), 'live-original')

    // Live symlink alongside two broken/dangling symlinks (one pointing into an existing shared parent dir!).
    const uncreatedSharedFile = join(d, 'shared', 'uncreated.bin')
    symlinkSync(join(d, 'shared', 'live.bin'), join(d, 'packs', 'live.bin'))
    symlinkSync(uncreatedSharedFile, join(d, 'packs', 'dangling.bin'))
    symlinkSync(join(d, 'no-such-dir', 'ghost.bin'), join(d, 'packs', 'ghost.bin'))

    const mirror = join(d, 'mirror')
    copyPrivate(join(d, 'packs'), mirror)
    assertNoSymlinksAnywhere(mirror)
    expect(existsSync(join(mirror, 'dangling.bin'))).toBe(false)
    expect(existsSync(join(mirror, 'ghost.bin'))).toBe(false)

    // Writing to `dangling.bin` in the mirror creates a private regular file and NEVER creates `shared/uncreated.bin`.
    writeFileSync(join(mirror, 'dangling.bin'), 'created-locally')
    expect(lstatSync(join(mirror, 'dangling.bin')).isSymbolicLink()).toBe(false)
    expect(existsSync(uncreatedSharedFile)).toBe(false)
    expect(readFileSync(join(d, 'shared', 'live.bin'), 'utf8')).toBe('live-original')

    // materializeSymlinks on an existing tree also removes broken symlinks and materializes live ones.
    const rawTree = join(d, 'raw-tree')
    mkdirSync(rawTree)
    symlinkSync(join(d, 'shared', 'live.bin'), join(rawTree, 'live.bin'))
    symlinkSync(uncreatedSharedFile, join(rawTree, 'dangling.bin'))
    materializeSymlinks(rawTree)
    assertNoSymlinksAnywhere(rawTree)
    expect(lstatSync(join(rawTree, 'dangling.bin'), { throwIfNoEntry: false })).toBeUndefined()
    writeFileSync(join(rawTree, 'live.bin'), 'edited-raw-tree')
    expect(readFileSync(join(d, 'shared', 'live.bin'), 'utf8')).toBe('live-original')
  })

  it('replaces a pre-existing symlink at dst without writing through to its target, and makes read-only store copies writable', () => {
    const d = tempDir()
    mkdirSync(join(d, 'readonly-store', 'sub'), { recursive: true })
    mkdirSync(join(d, 'innocent'), { recursive: true })
    const roFile = join(d, 'readonly-store', 'sub', 'pack.bin')
    const innocentFile = join(d, 'innocent', 'do-not-touch.bin')
    writeFileSync(roFile, 'readonly-original')
    writeFileSync(innocentFile, 'innocent-original')
    chmodSync(roFile, 0o444)
    chmodSync(join(d, 'readonly-store', 'sub'), 0o555)

    // Pre-existing symlink at `dst` pointing to `innocentFile`.
    const dstFile = join(d, 'out-pack.bin')
    symlinkSync(innocentFile, dstFile)
    copyPrivate(roFile, dstFile)
    expect(lstatSync(dstFile).isSymbolicLink()).toBe(false)
    writeFileSync(dstFile, 'tampered-writable')
    expect(readFileSync(innocentFile, 'utf8')).toBe('innocent-original')
    expect(readFileSync(roFile, 'utf8')).toBe('readonly-original')

    // Copy of the read-only directory is also writable for tamper tests.
    const dstDir = join(d, 'out-dir')
    symlinkSync(join(d, 'innocent'), dstDir)
    copyPrivate(join(d, 'readonly-store'), dstDir)
    assertNoSymlinksAnywhere(dstDir)
    writeFileSync(join(dstDir, 'sub', 'pack.bin'), 'tampered-in-dir')
    expect(readFileSync(roFile, 'utf8')).toBe('readonly-original')
  })

  it('fails closed on missing/broken top-level src, same-path copy, and symlink cycles', () => {
    const d = tempDir()
    mkdirSync(join(d, 'cycle-dir'), { recursive: true })
    symlinkSync('..', join(d, 'cycle-dir', 'back'))
    expect(() => copyPrivate(join(d, 'cycle-dir'), join(d, 'out-cycle'))).toThrow(/cycle/i)

    symlinkSync(join(d, 'loop-b'), join(d, 'loop-a'))
    symlinkSync(join(d, 'loop-a'), join(d, 'loop-b'))
    expect(() => copyPrivate(join(d, 'loop-a'), join(d, 'out-loop'))).toThrow(/cycle/i)

    symlinkSync(join(d, 'missing-target'), join(d, 'top-broken'))
    expect(() => copyPrivate(join(d, 'top-broken'), join(d, 'out-broken'))).toThrow()
    expect(() => copyPrivate(join(d, 'does-not-exist'), join(d, 'out-missing'))).toThrow()

    const sameFile = join(d, 'same.bin')
    writeFileSync(sameFile, 'same')
    expect(() => copyPrivate(sameFile, sameFile)).toThrow(/same/i)
  })

  it('mirrorRepoWithCopies materializes copied subtrees with zero symlinks and cleans up temp dir if tamper throws', () => {
    const mirror = mirrorRepoWithCopies(['src/common/audio'], (root) => {
      assertNoSymlinksAnywhere(join(root, 'src', 'common', 'audio'))
    })
    rmSync(mirror, { recursive: true, force: true })

    let leakedDir = ''
    expect(() =>
      mirrorRepoWithCopies(['src/common/audio'], (root) => {
        leakedDir = root
        throw new Error('simulated tamper failure')
      }),
    ).toThrow(/simulated tamper failure/)
    expect(leakedDir).not.toBe('')
    expect(existsSync(leakedDir)).toBe(false)
  })
})

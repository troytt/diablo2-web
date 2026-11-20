/**
 * Private file and directory copies with zero retained symlinks (#1619).
 *
 * Node 22 `cpSync(src, dst, { recursive: true, dereference: true })` only dereferences the
 * top-level `src`: any symlink nested inside a copied directory is copied verbatim as a symlink.
 * That has two failure modes:
 * 1. Relative symlinks break (or resolve against the wrong directory) when `dst` is under `tmpdir()`.
 * 2. Checkouts that keep `public/sound/packs/` (or `public/packs/`) as symlinks into a shared asset
 *    store still point at the shared files, so a tamper test's `writeFileSync` writes straight
 *    through into the shared store.
 *
 * `copyPrivate` walks `src` directly, resolving symlinks against their real source parent directory,
 * omitting nested broken/dangling symlinks so no symlink ever enters `dst`, guarding against symlink
 * cycles, unlinking any pre-existing symlink at `dst`, and ensuring owner write permissions on the
 * materialized copies.
 */

import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'

function isMissingTargetError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

function isSymlinkLoopError(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === 'ELOOP'
}

function ensureDirWritable(dirPath: string): void {
  const mode = statSync(dirPath).mode & 0o777
  if ((mode & 0o700) !== 0o700) {
    chmodSync(dirPath, mode | 0o700)
  }
}

function copyResolved(realSrc: string, dst: string, activeRealDirs: Set<string>): void {
  const st = statSync(realSrc)
  if (st.isDirectory()) {
    if (activeRealDirs.has(realSrc)) {
      throw new Error(`copyPrivate: directory symlink cycle detected at ${realSrc}`)
    }
    activeRealDirs.add(realSrc)
    try {
      mkdirSync(dst, { recursive: true, mode: 0o755 })
      ensureDirWritable(dst)
      for (const name of readdirSync(realSrc)) {
        copyEntry(join(realSrc, name), join(dst, name), false, activeRealDirs)
      }
    } finally {
      activeRealDirs.delete(realSrc)
    }
    return
  }
  if (st.isFile()) {
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(realSrc, dst)
    const mode = st.mode & 0o777
    if ((mode & 0o600) !== 0o600) {
      chmodSync(dst, mode | 0o600)
    }
  }
}

function copyEntry(src: string, dst: string, isTopLevel: boolean, activeRealDirs: Set<string>): void {
  const lst = lstatSync(src, { throwIfNoEntry: false })
  if (!lst) {
    if (isTopLevel) {
      // Surface standard Node ENOENT when the explicitly requested top-level source is missing.
      lstatSync(src)
    }
    return
  }

  let realSrc: string
  try {
    realSrc = realpathSync(src)
  } catch (err) {
    if (isSymlinkLoopError(err)) {
      throw new Error(`copyPrivate: symlink cycle detected at ${src}`)
    }
    if (!isTopLevel && lst.isSymbolicLink() && isMissingTargetError(err)) {
      // Omit broken/dangling nested symlinks so `dst` never contains a symlink that could write through.
      return
    }
    throw err
  }

  copyResolved(realSrc, dst, activeRealDirs)
}

/** Replaces every symlink at or below `path` with an independent real copy (removing broken symlinks). */
export function materializeSymlinks(path: string, activeRealDirs: Set<string> = new Set()): void {
  const lst = lstatSync(path, { throwIfNoEntry: false })
  if (!lst) return

  if (lst.isSymbolicLink()) {
    let target: string
    try {
      target = realpathSync(path)
    } catch (err) {
      if (isSymlinkLoopError(err)) {
        rmSync(path, { force: true })
        throw new Error(`materializeSymlinks: symlink cycle detected at ${path}`)
      }
      if (isMissingTargetError(err)) {
        rmSync(path, { force: true })
        return
      }
      throw err
    }
    rmSync(path, { force: true })
    copyResolved(target, path, activeRealDirs)
    return
  }

  if (lst.isDirectory()) {
    ensureDirWritable(path)
    const realDir = realpathSync(path)
    if (activeRealDirs.has(realDir)) {
      throw new Error(`materializeSymlinks: directory cycle detected at ${realDir}`)
    }
    activeRealDirs.add(realDir)
    try {
      for (const name of readdirSync(path)) {
        materializeSymlinks(join(path, name), activeRealDirs)
      }
    } finally {
      activeRealDirs.delete(realDir)
    }
  }
}

/**
 * Copies `src` to `dst` recursively with every symlink (top-level, nested, chained, or relative)
 * materialized into independent writable files and directories.
 */
export function copyPrivate(src: string, dst: string): void {
  if (resolve(src) === resolve(dst)) {
    throw new Error(`copyPrivate: src and dst resolve to the same path: ${resolve(src)}`)
  }

  // Validate top-level source before touching `dst`.
  let realSrc: string
  try {
    realSrc = realpathSync(src)
  } catch (err) {
    if (isSymlinkLoopError(err)) {
      throw new Error(`copyPrivate: symlink cycle detected at ${src}`)
    }
    throw err
  }

  const dstLstat = lstatSync(dst, { throwIfNoEntry: false })
  if (dstLstat) {
    if (!dstLstat.isSymbolicLink() && realpathSync(dst) === realSrc) {
      throw new Error(`copyPrivate: src and dst refer to the same real path: ${realSrc}`)
    }
    // Remove pre-existing destination (especially if `dst` itself was a symlink) so writes never escape.
    rmSync(dst, { recursive: true, force: true })
  }

  copyResolved(realSrc, dst, new Set())
}

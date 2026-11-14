/**
 * Several MPQ archives mounted as one namespace.
 *
 * Diablo II does not read one archive, it reads a stack. The game data lives in
 * `d2data.mpq`, the expansion overrides parts of it in `d2exp.mpq`, and the 1.13
 * patch overrides both from `Patch_D2.mpq`; character art sits in `d2char.mpq`.
 * The rule is overlay semantics: **the last archive mounted wins**, so a caller
 * mounts in load order (`d2data`, `d2exp`, `Patch_D2`) and never has to ask
 * which archive a file came from.
 *
 * Lookups go through the name, not the block table index, because an encrypted
 * member's key is derived from its name: a member reached as "block 5383" would
 * decrypt to noise. `d2exp.mpq` alone has 585 such members.
 */
import type { MpqArchive, MpqFile } from './archive.ts'

/** One mounted archive and the label it is known by. */
export interface MountEntry {
  /** Human-readable identity, e.g. the file name. */
  readonly label: string
  /** The open archive. */
  readonly archive: MpqArchive
}

/** A member resolved to the archive that will serve it. */
export interface MountedFile {
  /** The archive that won the lookup. */
  readonly entry: MountEntry
  /** The member within it. */
  readonly file: MpqFile
}

/** A stack of archives searched last-to-first. */
export class MountedArchives {
  private readonly entries: MountEntry[] = []
  /** Cached union of every archive's name list, invalidated on `add`. */
  private names: string[] | null = null

  /**
   * Mount an archive on top of the stack.
   *
   * @param label - identity for diagnostics.
   * @param archive - the open archive.
   */
  add(label: string, archive: MpqArchive): void {
    this.entries.push({ label, archive })
    this.names = null
  }

  /** The mounted archives, in load order. */
  get mounted(): readonly MountEntry[] {
    return this.entries
  }

  /** How many archives are mounted. */
  get size(): number {
    return this.entries.length
  }

  /**
   * Find a member, preferring the most recently mounted archive.
   *
   * @param name - member name, either separator.
   * @returns the winning archive and member, or undefined.
   */
  find(name: string): MountedFile | undefined {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index]!
      const file = entry.archive.find(name)
      if (file !== undefined) return { entry, file }
    }
    return undefined
  }

  /**
   * Whether any mounted archive has a member.
   *
   * @param name - member name.
   * @returns true when present.
   */
  has(name: string): boolean {
    return this.find(name) !== undefined
  }

  /**
   * Read and decode a member.
   *
   * @param name - member name.
   * @returns the decoded bytes.
   */
  async read(name: string): Promise<Uint8Array> {
    const found = this.find(name)
    if (found === undefined) throw new Error(`mounted archives have no member ${name}`)
    return found.entry.archive.read(found.file)
  }

  /**
   * Synchronously read and decode a member, throwing when absent.
   */
  readSync(name: string): Uint8Array {
    const found = this.find(name)
    if (found === undefined) throw new Error(`mounted archives have no member ${name}`)
    return found.entry.archive.readSync(found.file)
  }

  /**
   * Synchronously read and decode a member, returning `null` when absent.
   */
  readFile(name: string): Uint8Array | null {
    const found = this.find(name)
    if (found === undefined) return null
    return found.entry.archive.readSync(found.file)
  }

  /**
   * Synchronously read and decode raw bytes of a member, throwing when absent.
   */
  readBytes(name: string): Uint8Array {
    return this.readSync(name)
  }

  /**
   * Synchronously read and decode a Latin-1 text member, throwing when absent.
   */
  readText(name: string): string {
    return new TextDecoder('latin1').decode(this.readSync(name))
  }

  /**
   * Every member name across the stack, deduplicated.
   *
   * A name is only listed once: with overlay semantics the archive that wins the
   * lookup is the one that matters, and duplicate entries would make pickers and
   * listings lie about it.
   *
   * @returns the name list, sorted.
   */
  async listFiles(): Promise<string[]> {
    if (this.names !== null) return this.names
    const seen = new Set<string>()
    for (const entry of this.entries) {
      let names: readonly string[]
      try {
        names = await entry.archive.listFiles()
      } catch {
        // An archive whose (listfile) cannot be decoded contributes no names;
        // its members are still reachable by explicit name.
        continue
      }
      for (const name of names) seen.add(name)
    }
    this.names = [...seen].sort()
    return this.names
  }

  /**
   * A description of the stack, for HUDs and reports.
   *
   * @returns one line per archive plus a total.
   */
  describe(): string[] {
    const lines = this.entries.map(entry => `${entry.label}: ${String(entry.archive.files().length)} block slots`)
    lines.push(`total: ${String(this.entries.length)} archives`)
    return lines
  }
}

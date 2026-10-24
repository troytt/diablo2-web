/**
 * MPQ inspection CLI (Node-side tooling).
 *
 * Usage:
 *   node scripts/inspect-mpq.ts <archive> [header|list|hist|extract <name> <out>]
 *
 * `header` prints the parsed v1 header, `list` the name list, `hist` the
 * compression masks the archive actually uses (which decoders are required),
 * and `extract` decodes one member to disk for external verification.
 */
import { writeFile } from 'node:fs/promises'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'

const [path, command = 'header', ...rest] = process.argv.slice(2)

if (path === undefined) {
  console.error('usage: node scripts/inspect-mpq.ts <archive> [header|list|hist|extract <name> <out>]')
  process.exit(2)
}

const archive = await MpqArchive.open(await fileSource(path))

switch (command) {
  case 'header': {
    const h = archive.header
    console.log(`archive      ${path}`)
    console.log(`headerSize   ${String(h.headerSize)}`)
    console.log(`archiveSize  ${String(h.archiveSize)}`)
    console.log(`format       v${String(h.formatVersion + 1)}`)
    console.log(`sectorSize   ${String(h.sectorSize)}`)
    console.log(`hashTable    @${String(h.hashTableOffset)} (${String(h.hashTableEntries)} entries)`)
    console.log(`blockTable   @${String(h.blockTableOffset)} (${String(h.blockTableEntries)} entries)`)
    const occupied = archive.files().length
    console.log(`files        ${String(occupied)} occupied block slots`)
    for (const [flag, count] of archive.flagHistogram()) {
      console.log(`  ${flag.padEnd(12)} ${String(count)}`)
    }
    break
  }
  case 'list': {
    const names = await archive.listFiles()
    console.log(`${String(names.length)} names`)
    for (const name of names.slice(0, 40)) console.log(`  ${name}`)
    if (names.length > 40) console.log(`  … ${String(names.length - 40)} more`)
    break
  }
  case 'hist': {
    const hist = await archive.compressionHistogram(await archive.nameIndex())
    const total = [...hist.values()].reduce((a, b) => a + b, 0)
    console.log(`compression masks over ${String(total)} files`)
    for (const [mask, count] of [...hist].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(6)}  ${mask}`)
    }
    break
  }
  case 'extract': {
    const [name, out] = rest
    if (name === undefined || out === undefined) {
      console.error('usage: … extract <name> <out>')
      process.exit(2)
    }
    const file = archive.find(name)
    if (file === undefined) {
      console.error(`no such file: ${name}`)
      process.exit(1)
    }
    const data = await archive.read(file)
    await writeFile(out, data)
    console.log(`wrote ${out} (${String(data.byteLength)} bytes, expected ${String(file.fileSize)})`)
    break
  }
  default: {
    console.error(`unknown command: ${command}`)
    process.exit(2)
  }
}

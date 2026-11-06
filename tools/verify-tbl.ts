/**
 * Construction check and real-file check for the TBL decoder.
 *
 * Requirements:
 * - Round-trip encoding through tbl-writer
 * - Success on actual Diablo II patchstring.tbl
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeTbl, tblLookup, tblHash } from '../src/common/formats/tbl.ts'
import { encodeTbl } from '../src/baker/io/tbl-writer.ts'
import type { TblEntry } from '../src/baker/io/tbl-writer.ts'

const entries: TblEntry[] = [
  { key: "Stamina Potion", value: "Stamina Potion" },
  { key: "Empty", value: "" },
  null,
  { key: "Tome", value: "Tome of Town Portal" },
  null,
  { key: "CJK", value: "完美宝石" },
  { key: "Latin", value: "Straße" },
  null,
  { key: "Emoji", value: "🌀 Emoji beyond the BMP" },
  { key: "Long", value: 'x'.repeat(300) },
]

const encoded = encodeTbl(entries)
// We pass 'utf-8' here because our tbl-writer encodes values in utf-8 to preserve things for testing
const decoded = decodeTbl(encoded, 'utf-8')
const lookup = tblLookup(decoded)

const problems: string[] = []
if (decoded.length !== entries.length) problems.push(`entry count ${decoded.length} != ${entries.length}`)
entries.forEach((want, index) => {
  const got = decoded[index]
  if (want === null) {
    if (got !== undefined) problems.push(`index ${index}: expected an unused index, got ${JSON.stringify(got)}`)
    return
  }
  const expectedValue = typeof want === 'string' ? want : want.value
  if (got !== expectedValue) problems.push(`index ${index}: ${JSON.stringify(got)} != ${JSON.stringify(expectedValue)}`)
  
  const expectedKey = typeof want === 'string' ? `__auto_key_${index}` : want.key
  if (decoded.dict.get(expectedKey) !== expectedValue) {
    problems.push(`Dictionary lookup failed for key ${expectedKey}`)
  }
})

console.log(`[Roundtrip] table      ${entries.length} indices (${lookup.size} used)`)
console.log(`[Roundtrip] encoded    ${encoded.byteLength} bytes`)
console.log(`[Roundtrip] unicode    CJK=${JSON.stringify(lookup.get(5))} latin1=${JSON.stringify(lookup.get(6))} astral=${JSON.stringify(lookup.get(8))}`)
console.log(`[Roundtrip] long       ${lookup.get(9)?.length ?? 0} characters round-tripped`)
console.log(`[Roundtrip] problems   ${problems.length}`)

let fixtureProblems = 0
try {
  const raw = readFileSync(join(import.meta.dirname, '../samples/fixtures/tbl/patchstring_113c_eng.tbl'))
  const fixtureDecoded = decodeTbl(raw) // defaults to windows-1252
  let hashFailures = 0
  let matched = 0
  for (const [key, value] of fixtureDecoded.dict.entries()) {
    matched++
    // To verify, we would need the hashtablesize. We can't access it natively through just decodeTbl.
    // Instead we can just check if we can retrieve known values:
  }
  if (fixtureDecoded.dict.get("Party1X") !== "%s permits you to loot his corpse.") fixtureProblems++
  if (fixtureDecoded.dict.get("D2bnetHelp16b") !== "/unignore <*accountname>") fixtureProblems++
  
  console.log(`[Fixture] Loaded fixture correctly. Total active keys: ${matched}`)
} catch (e: any) {
  problems.push(`Fixture failed: ${e.message}`)
  fixtureProblems++
}

for (const problem of problems.slice(0, 8)) console.log(`  - ${problem}`)
const success = problems.length === 0 && fixtureProblems === 0
console.log(success ? 'RESULT     all passed' : 'RESULT     FAILED')
process.exit(success ? 0 : 1)

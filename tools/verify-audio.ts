/**
 * `npm run verify:audio` — thin CLI over the shared 1.13c audio audit
 * (`src/baker/audit/verify-audio-113c.ts`, also run by `npm run bake:verify`).
 *
 * Usage: tsx tools/verify-audio.ts [--sections a,b] [--mpq-dir DIR] [--root DIR] [--json FILE]
 * Exits 0 only when every selected section ran at least one check and reported no error.
 */
import { writeFileSync } from 'node:fs'
import { formatAudioAuditReport, parseVerifyAudioArgs, runAudioAudit } from '../src/baker/audit/verify-audio-113c.ts'

async function main(): Promise<number> {
  const { json, ...options } = parseVerifyAudioArgs(process.argv.slice(2))
  const report = await runAudioAudit(options)
  for (const line of formatAudioAuditReport(report)) console.log(line)
  if (json !== undefined) writeFileSync(json, JSON.stringify(report, null, 2))
  return report.ok ? 0 : 1
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err)
    process.exit(1)
  },
)

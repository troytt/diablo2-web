/**
 * Test helper: the ORIGINAL 1.13c WAV facts of Sounds.txt rows, read from the MPQs through the full audio
 * mount chain (`AUDIO_ARCHIVE_LOAD_ORDER_113C`) and parsed with the product `parseWavPcm16`. Nothing here is
 * hard-coded: every frame count and sample rate comes from the archive bytes.
 */
import { join } from 'node:path'
import { AUDIO_ARCHIVE_LOAD_ORDER_113C } from '../../src/baker/audit/verify-audio-113c.ts'
import { DEFAULT_NODE_MPQ_DIR, syncNodeFileSource } from '../../src/baker/mpq-archive-source.ts'
import type { SoundSampleFacts113c } from '../../src/client/audio/sound-records-113c.ts'
import { buildSoundMpqPath113c } from '../../src/common/audio/sounds-113c.ts'
import { parseWavPcm16 } from '../../src/common/formats/wav.ts'
import { MpqArchive } from '../../src/common/mpq/archive.ts'
import { MountedArchives } from '../../src/common/mpq/mount.ts'

let mounted: MountedArchives | undefined

/** The 9-archive 1.13c audio chain (opened once per test file). */
export function audioArchives113c(): MountedArchives {
  if (mounted === undefined) {
    const archives = new MountedArchives()
    for (const name of AUDIO_ARCHIVE_LOAD_ORDER_113C) {
      archives.add(name, MpqArchive.openSync(syncNodeFileSource(join(DEFAULT_NODE_MPQ_DIR, name))))
    }
    mounted = archives
  }
  return mounted
}

/** PCM facts of each id's WAV (BuildSoundPath 0x6fb0db30 member). Throws for a none.wav row or an absent member. */
export function mpqSampleFacts113c(ids: readonly number[]): Map<number, SoundSampleFacts113c> {
  const archives = audioArchives113c()
  const out = new Map<number, SoundSampleFacts113c>()
  for (const id of ids) {
    const path = buildSoundMpqPath113c(id)
    if (path === null) throw new Error(`mpqSampleFacts113c: row ${String(id)} has no WAV (none.wav)`)
    const wav = parseWavPcm16(archives.readSync(path), path)
    out.set(id, { kind: 'pcm', sampleRate: wav.sampleRate, frames: wav.frames, channels: wav.channels })
  }
  return out
}

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SOUNDS_113C,
  buildSoundMpqPath113c,
  type SoundsRow113c,
} from '../../common/audio/sounds-113c.ts';
import { parseWavPcm16 } from '../../common/formats/wav.ts';
import { generateAssetManifest } from '../io/asset-manifest.ts';
import { DEFAULT_NODE_MPQ_DIR } from '../mpq-archive-source.ts';
import { mountAudioArchives, probeFfmpegOpus113c } from './pack-sfx.ts';

export const SPEECH_FIRST_SOUND_ID_113C = 2934;
export const SPEECH_LAST_SOUND_ID_113C = 4656;
export const SPEECH_ID_MIN_113C = SPEECH_FIRST_SOUND_ID_113C;
export const SPEECH_ID_MAX_113C = SPEECH_LAST_SOUND_ID_113C;
export const SPEECH_MIN_BITRATE_BPS_113C = 24_000;
export const SPEECH_OPUS_BITRATE_BPS_113C = SPEECH_MIN_BITRATE_BPS_113C;
export const D16_SPEECH_MAX_TOTAL_BYTES_113C = 45_000_000;
export const SPEECH_MAX_TOTAL_BYTES_113C = D16_SPEECH_MAX_TOTAL_BYTES_113C;
export const SPEECH_TOTAL_SIZE_CAP_BYTES_113C = D16_SPEECH_MAX_TOTAL_BYTES_113C;
export const SPEECH_INDEX_TS_FILE = 'src/common/audio/speech-index-113c.ts';

export type SpeechActTag113c =
  | 'act1'
  | 'act2'
  | 'act3'
  | 'act4'
  | 'act5'
  | 'char'
  | 'misc';

export interface SpeechMetadata113c {
  readonly id: number;
  readonly sound: string;
  readonly fileName: string;
  readonly url: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly durationSec: number;
  readonly sampleRate: number;
  readonly frames: number;
  readonly channels: 1;
  readonly solo: boolean;
}

export interface PackSpeechOptions {
  readonly mpqDir?: string;
  readonly outputDir?: string;
  readonly indexTsOutPath?: string;
  readonly rootDir?: string;
  readonly publicDir?: string;
  readonly bitrateBps?: number;
  readonly concurrency?: number;
  readonly force?: boolean;
  readonly writeFiles?: boolean;
}

export interface PackSpeechSummary {
  readonly outputDir: string;
  readonly indexTsPath: string;
  readonly totalRowsInRange: number;
  readonly shippedRows: number;
  readonly uniqueWebmCount: number;
  readonly noneWavIds: readonly number[];
  readonly unshippedIds: readonly number[];
  readonly totalBytes: number;
  readonly entries: readonly SpeechMetadata113c[];
  readonly speechIndexTsText: string;
}

export interface WebmOpusSpeechInspection113c {
  readonly channels: number;
  readonly version: number;
  readonly preSkip: number;
  readonly inputSampleRate: number;
  readonly audioPackets: number;
  readonly audioPacketBytes: number;
  readonly durationSec: number;
}

const OPUS_FRAME_TENTHS_MS: readonly number[] = [
  100, 200, 400, 600, 100, 200, 400, 600, 100, 200, 400, 600,
  100, 200, 100, 200,
  25, 50, 100, 200, 25, 50, 100, 200, 25, 50, 100, 200, 25, 50, 100, 200,
];

function opusPacketSamples48k(p: Uint8Array, what: string): number {
  if (p.length < 1) throw new Error(`${what}: empty Opus packet`);
  const toc = p[0]!;
  const tenths = OPUS_FRAME_TENTHS_MS[toc >> 3]!;
  const code = toc & 3;
  let frames: number;
  if (code === 0) frames = 1;
  else if (code === 1 || code === 2) frames = 2;
  else {
    if (p.length < 2) throw new Error(`${what}: code-3 Opus packet without frame-count byte`);
    frames = p[1]! & 0x3f;
    if (frames === 0) throw new Error(`${what}: code-3 Opus packet with 0 frames`);
  }
  if (frames * tenths > 1200) throw new Error(`${what}: Opus packet longer than 120 ms`);
  return (frames * tenths * 48) / 10;
}

function readEbmlVint(
  bytes: Uint8Array,
  at: number,
  keepMarker: boolean,
  what: string,
): { value: number; next: number; unknownSize: boolean } {
  if (at >= bytes.length) throw new Error(`${what}: unexpected EOF reading VINT at ${String(at)}`);
  const b0 = bytes[at]!;
  if (b0 === 0) throw new Error(`${what}: invalid 0x00 VINT leading byte at ${String(at)}`);
  let width = 1;
  let mask = 0x80;
  while ((b0 & mask) === 0) {
    width += 1;
    mask >>= 1;
  }
  if (at + width > bytes.length) {
    throw new Error(`${what}: truncated ${String(width)}-byte VINT at ${String(at)}`);
  }
  let val = keepMarker ? b0 : b0 & (mask - 1);
  let allOnes = (b0 & (mask - 1)) === mask - 1;
  for (let i = 1; i < width; i += 1) {
    const bi = bytes[at + i]!;
    val = val * 256 + bi;
    if (bi !== 0xff) allOnes = false;
  }
  return { value: val, next: at + width, unknownSize: !keepMarker && allOnes };
}

function parseMatroskaBlockFrames(
  block: Uint8Array,
  what: string,
  packets: number[],
  samples: number[],
): void {
  const trackVint = readEbmlVint(block, 0, false, `${what} block track`);
  const headerEnd = trackVint.next + 3;
  if (headerEnd > block.length) throw new Error(`${what}: truncated Block header`);
  const flags = block[trackVint.next + 2]!;
  const lacing = (flags >> 1) & 0x03;
  const payload = block.subarray(headerEnd);
  if (lacing === 0) {
    packets.push(payload.length);
    samples.push(opusPacketSamples48k(payload, `${what} packet ${String(packets.length)}`));
    return;
  }
  if (payload.length < 1) throw new Error(`${what}: laced block missing frame count`);
  const frameCount = payload[0]! + 1;
  let pos = 1;
  const frameSizes: number[] = [];
  if (lacing === 2) {
    const rem = payload.length - 1;
    if (rem % frameCount !== 0) throw new Error(`${what}: fixed-size lacing remainder`);
    const sz = rem / frameCount;
    for (let i = 0; i < frameCount; i += 1) frameSizes.push(sz);
  } else if (lacing === 1) {
    let sum = 0;
    for (let i = 0; i < frameCount - 1; i += 1) {
      let sz = 0;
      while (pos < payload.length) {
        const b = payload[pos++]!;
        sz += b;
        if (b < 255) break;
      }
      frameSizes.push(sz);
      sum += sz;
    }
    frameSizes.push(payload.length - pos - sum);
  } else {
    let sum = 0;
    let prev = 0;
    for (let i = 0; i < frameCount - 1; i += 1) {
      const startPos = pos;
      const v = readEbmlVint(payload, pos, false, `${what} ebml lace`);
      pos = v.next;
      if (i === 0) prev = v.value;
      else {
        const widthBytes = pos - startPos;
        const bias = Math.pow(2, 7 * widthBytes - 1) - 1;
        prev += v.value - bias;
      }
      frameSizes.push(prev);
      sum += prev;
    }
    frameSizes.push(payload.length - pos - sum);
  }
  for (const sz of frameSizes) {
    if (sz <= 0 || pos + sz > payload.length) {
      throw new Error(`${what}: invalid laced frame size ${String(sz)}`);
    }
    const frame = payload.subarray(pos, pos + sz);
    pos += sz;
    packets.push(frame.length);
    samples.push(opusPacketSamples48k(frame, `${what} packet ${String(packets.length)}`));
  }
}

export function inspectWebmOpusSpeech113c(
  bytes: Uint8Array,
  what: string,
): WebmOpusSpeechInspection113c {
  if (
    bytes.byteLength < 32 ||
    bytes[0] !== 0x1a ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0xdf ||
    bytes[3] !== 0xa3
  ) {
    throw new Error(`${what}: missing WebM EBML header magic (0x1A45DFA3)`);
  }
  let docType = '';
  let codecId = '';
  let opusHead: Uint8Array | null = null;
  const packets: number[] = [];
  const samples: number[] = [];
  const MASTER_IDS = new Set([0x1a45dfa3, 0x18538067, 0x1654ae6b, 0xae, 0xe1, 0x1f43b675, 0xa0]);

  function walk(start: number, end: number): void {
    let at = start;
    while (at < end) {
      const id = readEbmlVint(bytes, at, true, `${what} id`);
      const sz = readEbmlVint(bytes, id.next, false, `${what} size`);
      const bodyStart = sz.next;
      const bodyEnd = sz.unknownSize ? end : bodyStart + sz.value;
      if (bodyEnd > end) {
        throw new Error(`${what}: element 0x${id.value.toString(16)} at ${String(at)} extends past ${String(end)}`);
      }
      if (MASTER_IDS.has(id.value)) {
        walk(bodyStart, bodyEnd);
      } else if (id.value === 0x4282) {
        docType = Buffer.from(bytes.subarray(bodyStart, bodyEnd)).toString('ascii').replace(/\0+$/, '');
      } else if (id.value === 0x86) {
        codecId = Buffer.from(bytes.subarray(bodyStart, bodyEnd)).toString('ascii').replace(/\0+$/, '');
      } else if (id.value === 0x63a2) {
        opusHead = bytes.subarray(bodyStart, bodyEnd);
      } else if (id.value === 0xa3 || id.value === 0xa1) {
        parseMatroskaBlockFrames(bytes.subarray(bodyStart, bodyEnd), what, packets, samples);
      }
      at = bodyEnd;
    }
  }

  walk(0, bytes.byteLength);
  if (docType !== 'webm' && docType !== 'matroska') {
    throw new Error(`${what}: unexpected EBML DocType "${docType}" (expected "webm")`);
  }
  if (codecId !== 'A_OPUS') {
    throw new Error(`${what}: unexpected Track CodecID "${codecId}" (expected "A_OPUS")`);
  }
  if (opusHead === null) {
    throw new Error(`${what}: missing CodecPrivate OpusHead`);
  }
  const headBytes: Uint8Array = opusHead;
  if (headBytes.length < 19 || String.fromCharCode(...headBytes.subarray(0, 8)) !== 'OpusHead') {
    throw new Error(`${what}: invalid CodecPrivate OpusHead`);
  }
  const version = headBytes[8]!;
  const channels = headBytes[9]!;
  if (version !== 1) {
    throw new Error(`${what}: OpusHead version ${String(version)} (expected 1)`);
  }
  if (channels !== 1) {
    throw new Error(`${what}: OpusHead channels ${String(channels)} (expected mono=1)`);
  }
  if (packets.length === 0) {
    throw new Error(`${what}: WebM stream contains 0 Opus audio packets`);
  }
  const headDv = new DataView(headBytes.buffer, headBytes.byteOffset, headBytes.byteLength);
  const preSkip = headDv.getUint16(10, true);
  const inputSampleRate = headDv.getUint32(12, true);
  const totalSamples48k = samples.reduce((a, b) => a + b, 0);
  return {
    channels,
    version,
    preSkip,
    inputSampleRate,
    audioPackets: packets.length,
    audioPacketBytes: packets.reduce((a, b) => a + b, 0),
    durationSec: Math.max(0, (totalSamples48k - preSkip) / 48_000),
  };
}

export function isSpeechRow113c(row: SoundsRow113c): boolean {
  return (
    row.id >= SPEECH_FIRST_SOUND_ID_113C &&
    row.id <= SPEECH_LAST_SOUND_ID_113C &&
    row.fileName.trim().toLowerCase() !== 'none.wav'
  );
}

export function speechFileNameToWebmUrl113c(fileName: string): string {
  const rel = fileName
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/\.wav$/i, '.webm');
  return `/sound/speech/${rel}`;
}

const CHAR_SPEECH_PREFIXES = new Set([
  'ama',
  'ass',
  'bar',
  'dru',
  'nec',
  'pal',
  'sor',
]);

export function classifySpeechPath113c(fileName: string): {
  readonly act: SpeechActTag113c;
  readonly npc: string;
  readonly isQuestSpeech: boolean;
} {
  const rel = fileName.replace(/\\/g, '/').toLowerCase();
  const parts = rel.split('/');
  const folder = parts[1] ?? 'misc';
  if (
    folder === 'act1' ||
    folder === 'act2' ||
    folder === 'act3' ||
    folder === 'act4' ||
    folder === 'act5'
  ) {
    const npc = parts.length >= 4 ? (parts[2] ?? folder) : folder;
    return {
      act: folder,
      npc,
      isQuestSpeech: true,
    };
  }
  if (CHAR_SPEECH_PREFIXES.has(folder)) {
    return {
      act: 'char',
      npc: folder,
      isQuestSpeech: false,
    };
  }
  return {
    act: 'misc',
    npc: folder,
    isQuestSpeech: false,
  };
}

function transcodeWavFileToOpusWebmAsync(
  inWavPath: string,
  outWebmPath: string,
  bitrateBps: number,
  ffmpegBin: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegBin,
      [
        '-y',
        '-v',
        'error',
        '-i',
        inWavPath,
        '-map_metadata',
        '-1',
        '-vn',
        '-ac',
        '1',
        '-c:a',
        'libopus',
        '-b:a',
        String(bitrateBps),
        '-vbr',
        'off',
        '-compression_level',
        '10',
        '-frame_duration',
        '20',
        '-application',
        'audio',
        '-f',
        'webm',
        '-bitexact',
        outWebmPath,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          reject(
            new Error(
              `ffmpeg speech Opus/WebM transcode failed for ${inWavPath}: ${stderr || err.message}`,
            ),
          );
          return;
        }
        resolve();
      },
    );
  });
}

export function generateSpeechIndexTsSource(
  entries: readonly SpeechMetadata113c[],
  noneWavIds: readonly number[],
  unshippedSpeechIds: readonly number[],
): string {
  const uniqueUrls = new Set(entries.map((e) => e.url));
  const allUnshipped = [1595, 1596, 1597, 1598, ...unshippedSpeechIds].sort(
    (a, b) => a - b,
  );
  const lines: string[] = [];
  lines.push('// AUTO-GENERATED by src/baker/packers/pack-speech.ts — DO NOT EDIT');
  lines.push('// Source: Diablo II v1.13c Sounds.txt rows 2934..4656 (Stream = 1 speech)');
  lines.push('');
  lines.push(
    "export type SpeechActTag113c = 'act1' | 'act2' | 'act3' | 'act4' | 'act5' | 'char' | 'misc';",
  );
  lines.push('');
  lines.push('export interface SpeechEntry113c {');
  lines.push('  readonly id: number;');
  lines.push('  readonly sound: string;');
  lines.push('  readonly fileName: string;');
  lines.push('  readonly url: string;');
  lines.push('  readonly bytes: number;');
  lines.push('  readonly sha256: string;');
  lines.push('  readonly durationSec: number;');
  lines.push('  readonly sampleRate: number;');
  lines.push('  readonly frames: number;');
  lines.push('  readonly channels: 1;');
  lines.push('  readonly solo: boolean;');
  lines.push('}');
  lines.push('');
  lines.push(`export const SPEECH_MIN_BITRATE_BPS_113C = ${SPEECH_MIN_BITRATE_BPS_113C} as const;`);
  lines.push(`export const SPEECH_MAX_TOTAL_BYTES_113C = ${D16_SPEECH_MAX_TOTAL_BYTES_113C} as const;`);
  lines.push(`export const D16_SPEECH_MAX_TOTAL_BYTES_113C = ${D16_SPEECH_MAX_TOTAL_BYTES_113C} as const;`);
  lines.push(`export const SPEECH_FIRST_SOUND_ID_113C = ${SPEECH_FIRST_SOUND_ID_113C} as const;`);
  lines.push(`export const SPEECH_LAST_SOUND_ID_113C = ${SPEECH_LAST_SOUND_ID_113C} as const;`);
  lines.push(`export const SPEECH_SOUND_ID_MIN_113C = ${SPEECH_FIRST_SOUND_ID_113C} as const;`);
  lines.push(`export const SPEECH_SOUND_ID_MAX_113C = ${SPEECH_LAST_SOUND_ID_113C} as const;`);
  lines.push(
    `export const SPEECH_TOTAL_ROWS_113C = ${SPEECH_LAST_SOUND_ID_113C - SPEECH_FIRST_SOUND_ID_113C + 1} as const;`,
  );
  lines.push(`export const SPEECH_SHIPPED_ROW_COUNT_113C = ${entries.length} as const;`);
  lines.push(`export const SPEECH_UNIQUE_WEBM_COUNT_113C = ${uniqueUrls.size} as const;`);
  lines.push('');
  lines.push(
    `export const SPEECH_NONE_WAV_IDS_113C: readonly number[] = Object.freeze([${noneWavIds.join(', ')}]);`,
  );
  lines.push('export const SPEECH_NONE_WAV_ROW_IDS_113C = SPEECH_NONE_WAV_IDS_113C;');
  lines.push('');
  lines.push(
    'export const UNSHIPPED_MONSTER_SOUND_IDS_113C: readonly number[] = Object.freeze([1595, 1596, 1597, 1598]);',
  );
  lines.push(
    `export const UNSHIPPED_SPEECH_SOUND_IDS_113C: readonly number[] = Object.freeze([${unshippedSpeechIds.join(', ')}]);`,
  );
  lines.push(
    `export const UNSHIPPED_SOUND_IDS_113C: readonly number[] = Object.freeze([${allUnshipped.join(', ')}]);`,
  );
  lines.push('export const D9_UNSHIPPED_MONSTER_SOUND_IDS_113C = UNSHIPPED_MONSTER_SOUND_IDS_113C;');
  lines.push('export const D9_UNSHIPPED_SPEECH_SOUND_IDS_113C = UNSHIPPED_SPEECH_SOUND_IDS_113C;');
  lines.push('export const D9_UNSHIPPED_SPEECH_IDS_113C = UNSHIPPED_SPEECH_SOUND_IDS_113C;');
  lines.push('export const D9_UNSHIPPED_SOUND_IDS_113C = UNSHIPPED_SOUND_IDS_113C;');
  lines.push('export const UNSHIPPED_WAV_IDS_113C = UNSHIPPED_SOUND_IDS_113C;');
  lines.push('export const D9_UNSHIPPED_WAV_IDS_113C = UNSHIPPED_SOUND_IDS_113C;');
  lines.push(
    'export const D9_UNSHIPPED_SOUND_IDS_SET_113C: ReadonlySet<number> = new Set<number>(UNSHIPPED_SOUND_IDS_113C);',
  );
  lines.push('');
  lines.push('export function isUnshippedSoundId113c(soundId: number): boolean {');
  lines.push('  return D9_UNSHIPPED_SOUND_IDS_SET_113C.has(soundId);');
  lines.push('}');
  lines.push('');
  lines.push('export const SPEECH_ENTRIES_113C: Readonly<Record<number, SpeechEntry113c>> = Object.freeze({');
  for (const e of entries) {
    lines.push(
      `  ${e.id}: { id: ${e.id}, sound: ${JSON.stringify(e.sound)}, fileName: ${JSON.stringify(e.fileName)}, url: ${JSON.stringify(e.url)}, bytes: ${e.bytes}, sha256: ${JSON.stringify(e.sha256)}, durationSec: ${e.durationSec}, sampleRate: ${e.sampleRate}, frames: ${e.frames}, channels: 1, solo: ${e.solo} },`,
    );
  }
  lines.push('});');
  lines.push('');
  lines.push('export const SPEECH_INDEX_113C = SPEECH_ENTRIES_113C;');
  lines.push('export const SPEECH_BY_ID_113C = SPEECH_ENTRIES_113C;');
  lines.push('export const SPEECH_STREAMS_113C = SPEECH_ENTRIES_113C;');
  lines.push('export const SPEECH_TABLE_113C = SPEECH_ENTRIES_113C;');
  lines.push('');
  lines.push('const SPEECH_BY_SOUND_MAP = new Map<string, SpeechEntry113c>();');
  lines.push('for (const entry of Object.values(SPEECH_ENTRIES_113C)) {');
  lines.push('  SPEECH_BY_SOUND_MAP.set(entry.sound.toLowerCase(), entry);');
  lines.push('}');
  lines.push('');
  lines.push(
    'export function resolveSpeechEntry113c(idOrName: number | string): SpeechEntry113c | undefined {',
  );
  lines.push("  if (typeof idOrName === 'number') {");
  lines.push('    return SPEECH_ENTRIES_113C[idOrName];');
  lines.push('  }');
  lines.push('  const trimmed = String(idOrName).trim().toLowerCase();');
  lines.push('  if (!trimmed) return undefined;');
  lines.push('  const asNum = Number(trimmed);');
  lines.push('  if (Number.isInteger(asNum) && SPEECH_ENTRIES_113C[asNum]) {');
  lines.push('    return SPEECH_ENTRIES_113C[asNum];');
  lines.push('  }');
  lines.push('  return SPEECH_BY_SOUND_MAP.get(trimmed);');
  lines.push('}');
  lines.push('');
  lines.push('export const getSpeechEntry113c = resolveSpeechEntry113c;');
  lines.push('');
  lines.push(
    'export function getSpeechUrl113c(idOrName: number | string): string | undefined {',
  );
  lines.push('  return resolveSpeechEntry113c(idOrName)?.url;');
  lines.push('}');
  lines.push('export const resolveSpeechUrl113c = getSpeechUrl113c;');
  lines.push('');
  return lines.join('\n');
}

export async function packSpeech113c(
  options: PackSpeechOptions = {},
): Promise<PackSpeechSummary> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const localMpqDir = path.join(rootDir, 'samples/d2');
  const mpqDir =
    options.mpqDir ??
    (fs.existsSync(path.join(localMpqDir, 'd2data.mpq'))
      ? localMpqDir
      : DEFAULT_NODE_MPQ_DIR);
  const publicDir = path.resolve(
    options.publicDir ?? path.join(rootDir, 'public'),
  );
  const outputDir =
    options.outputDir ?? path.join(publicDir, 'sound/speech');
  const indexTsOutPath =
    options.indexTsOutPath ??
    path.join(rootDir, SPEECH_INDEX_TS_FILE);
  const bitrateBps = options.bitrateBps ?? SPEECH_MIN_BITRATE_BPS_113C;
  const concurrency = Math.max(
    1,
    options.concurrency ?? Math.min(16, Math.max(4, os.cpus().length)),
  );
  const force = options.force ?? false;
  const writeFiles = options.writeFiles ?? true;

  const probe = probeFfmpegOpus113c(undefined, 'speech');
  const archives = mountAudioArchives(mpqDir);

  const speechRows: SoundsRow113c[] = [];
  for (let id = SPEECH_FIRST_SOUND_ID_113C; id <= SPEECH_LAST_SOUND_ID_113C; id++) {
    const row = SOUNDS_113C[id];
    if (!row) {
      throw new Error(`Missing SOUNDS_113C row at speech ID ${id}`);
    }
    speechRows.push(row);
  }

  const noneWavIds: number[] = [];
  const unshippedIds: number[] = [];
  const shippedRows: SoundsRow113c[] = [];

  const uniqueFiles = new Map<
    string,
    {
      readonly relWebmPath: string;
      readonly mpqPath: string;
      readonly outAbsPath: string;
    }
  >();

  for (const row of speechRows) {
    if (row.fileName.trim().toLowerCase() === 'none.wav') {
      noneWavIds.push(row.id);
      continue;
    }
    const mpqPath = buildSoundMpqPath113c(row.id);
    if (!mpqPath || !archives.has(mpqPath)) {
      unshippedIds.push(row.id);
      continue;
    }
    shippedRows.push(row);
    const relWebmPath = row.fileName
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\.wav$/i, '.webm')
      .toLowerCase();
    if (!uniqueFiles.has(relWebmPath)) {
      uniqueFiles.set(relWebmPath, {
        relWebmPath,
        mpqPath,
        outAbsPath: path.join(outputDir, relWebmPath),
      });
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-speech-bake-'));
  const fileStats = new Map<
    string,
    {
      readonly bytes: number;
      readonly sha256: string;
      readonly sampleRate: number;
      readonly frames: number;
      readonly durationSec: number;
    }
  >();

  try {
    const workItems = [...uniqueFiles.values()];
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const idx = cursor++;
        if (idx >= workItems.length) return;
        const item = workItems[idx]!;
        const rawWav = await archives.readBytes(item.mpqPath);
        const parsedWav = parseWavPcm16(rawWav, item.mpqPath);
        const durationSec = Number(
          (parsedWav.frames / parsedWav.sampleRate).toFixed(4),
        );

        if (writeFiles) {
          fs.mkdirSync(path.dirname(item.outAbsPath), { recursive: true });
        }
        const needsTranscode =
          force ||
          !fs.existsSync(item.outAbsPath) ||
          fs.statSync(item.outAbsPath).size <= 64;

        let webmBuf: Buffer;
        if (needsTranscode) {
          const tmpWavPath = path.join(tmpDir, `in-${idx}.wav`);
          const tmpWebmPath = path.join(tmpDir, `out-${idx}.webm`);
          fs.writeFileSync(tmpWavPath, rawWav);
          try {
            await transcodeWavFileToOpusWebmAsync(
              tmpWavPath,
              tmpWebmPath,
              bitrateBps,
              probe.ffmpegPath,
            );
            webmBuf = fs.readFileSync(tmpWebmPath);
            if (writeFiles) {
              fs.copyFileSync(tmpWebmPath, item.outAbsPath);
            }
          } finally {
            if (fs.existsSync(tmpWavPath)) fs.unlinkSync(tmpWavPath);
            if (fs.existsSync(tmpWebmPath)) fs.unlinkSync(tmpWebmPath);
          }
        } else {
          webmBuf = fs.readFileSync(item.outAbsPath);
        }

        inspectWebmOpusSpeech113c(webmBuf, item.outAbsPath);
        const sha256 = createHash('sha256').update(webmBuf).digest('hex');
        fileStats.set(item.relWebmPath, {
          bytes: webmBuf.byteLength,
          sha256,
          sampleRate: parsedWav.sampleRate,
          frames: parsedWav.frames,
          durationSec,
        });
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  let totalBytes = 0;
  for (const item of uniqueFiles.values()) {
    const st = fileStats.get(item.relWebmPath);
    if (!st) {
      throw new Error(`Missing file stats for ${item.relWebmPath}`);
    }
    totalBytes += st.bytes;
  }

  if (totalBytes > D16_SPEECH_MAX_TOTAL_BYTES_113C) {
    throw new Error(
      `Total speech WebM size ${totalBytes} exceeds cap ${D16_SPEECH_MAX_TOTAL_BYTES_113C}`,
    );
  }

  const entries: SpeechMetadata113c[] = [];
  for (const row of shippedRows) {
    const relWebmPath = row.fileName
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\.wav$/i, '.webm')
      .toLowerCase();
    const st = fileStats.get(relWebmPath);
    if (!st) {
      throw new Error(`Missing speech stats for ${row.sound} (${relWebmPath})`);
    }
    entries.push({
      id: row.id,
      sound: row.sound,
      fileName: row.fileName,
      url: `/sound/speech/${relWebmPath}`,
      bytes: st.bytes,
      sha256: st.sha256,
      durationSec: st.durationSec,
      sampleRate: st.sampleRate,
      frames: st.frames,
      channels: 1,
      solo: Boolean(row.solo),
    });
  }

  const speechIndexTsText = generateSpeechIndexTsSource(
    entries,
    noneWavIds,
    unshippedIds,
  );

  if (writeFiles) {
    fs.mkdirSync(path.dirname(indexTsOutPath), { recursive: true });
    fs.writeFileSync(indexTsOutPath, speechIndexTsText, 'utf8');
    generateAssetManifest({ publicDir });
  }

  return {
    outputDir,
    indexTsPath: indexTsOutPath,
    totalRowsInRange: speechRows.length,
    shippedRows: shippedRows.length,
    uniqueWebmCount: uniqueFiles.size,
    noneWavIds,
    unshippedIds,
    totalBytes,
    entries,
    speechIndexTsText,
  };
}

export const packSpeech = packSpeech113c;
export default packSpeech113c;

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  packSpeech113c()
    .then((summary) => {
      console.log(
        `[pack-speech] Transcoded ${summary.uniqueWebmCount} unique Opus/WebM speech files (${summary.shippedRows} shipped rows, ${summary.unshippedIds.length} D9 unshipped, ${summary.noneWavIds.length} none.wav, ${(summary.totalBytes / (1024 * 1024)).toFixed(2)} MB)`,
      );
    })
    .catch((err: unknown) => {
      console.error('[pack-speech] Failed:', err);
      process.exitCode = 1;
    });
}

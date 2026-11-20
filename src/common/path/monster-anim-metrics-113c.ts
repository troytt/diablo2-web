/**
 * 1.13c monster per-mode frame counts (`AnimData.d2` `framesPerDirection`), `monseq.txt` sequences,
 * and `MonStats.txt` / `Hireling.txt` skill-to-mode resolution.
 */

import { MONSTATS_TXT_RECORD_COUNT } from "./monster-path-data.ts"
import { getMonsterPathRecord } from "./units.ts"

export interface MonsterSequenceStep113c {
  readonly clip: string
  readonly frameIndex: number
  readonly event: number
}

export interface ResolvedMonsterSequenceFrame113c {
  readonly clipKey: string
  readonly frameIndex: number
  readonly sequenceStepIndex: number
  readonly totalSequenceFrames: number
  readonly event: number
}

/** 1.13c `monseq.txt` sequences keyed by lowercase sequence name. */
export const MONSTER_SEQUENCES_113C: Readonly<Record<string, readonly MonsterSequenceStep113c[]>> = Object.freeze({
  "seq_pinheadsmite": Object.freeze([{ clip: "a1", frameIndex: 0, event: 0 }, { clip: "a1", frameIndex: 1, event: 0 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 4, event: 0 }, { clip: "a1", frameIndex: 5, event: 0 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 8, event: 1 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 10, event: 0 }, { clip: "a1", frameIndex: 11, event: 0 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }, { clip: "a1", frameIndex: 14, event: 0 }]),
  "seq_serpentcharge": Object.freeze([{ clip: "wl", frameIndex: 0, event: 1 }, { clip: "wl", frameIndex: 2, event: 1 }, { clip: "wl", frameIndex: 4, event: 1 }, { clip: "wl", frameIndex: 6, event: 1 }, { clip: "wl", frameIndex: 8, event: 1 }, { clip: "wl", frameIndex: 10, event: 1 }, { clip: "wl", frameIndex: 12, event: 1 }, { clip: "wl", frameIndex: 14, event: 1 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 7, event: 1 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 11, event: 0 }]),
  "seq_summonerskill": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 4 }]),
  "seq_firehit": Object.freeze([{ clip: "a1", frameIndex: 0, event: 0 }, { clip: "a1", frameIndex: 1, event: 0 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 4, event: 0 }, { clip: "a1", frameIndex: 5, event: 1 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 8, event: 0 }, { clip: "a1", frameIndex: 9, event: 0 }]),
  "seq_scarabjab": Object.freeze([{ clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 4, event: 0 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 8, event: 1 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 15, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 6, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 9, event: 1 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 12, event: 0 }, { clip: "a2", frameIndex: 13, event: 0 }]),
  "seq_mummyres": Object.freeze([{ clip: "sc", frameIndex: 0, event: 0 }, { clip: "sc", frameIndex: 1, event: 0 }, { clip: "sc", frameIndex: 2, event: 0 }, { clip: "sc", frameIndex: 3, event: 0 }, { clip: "sc", frameIndex: 4, event: 0 }, { clip: "sc", frameIndex: 5, event: 0 }, { clip: "sc", frameIndex: 6, event: 0 }, { clip: "sc", frameIndex: 7, event: 0 }, { clip: "sc", frameIndex: 8, event: 0 }, { clip: "sc", frameIndex: 9, event: 0 }, { clip: "sc", frameIndex: 10, event: 0 }, { clip: "sc", frameIndex: 11, event: 0 }, { clip: "sc", frameIndex: 12, event: 0 }, { clip: "sc", frameIndex: 13, event: 2 }, { clip: "sc", frameIndex: 14, event: 0 }, { clip: "sc", frameIndex: 15, event: 0 }]),
  "seq_vileres": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 2 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 12, event: 0 }, { clip: "s1", frameIndex: 13, event: 0 }, { clip: "s1", frameIndex: 14, event: 0 }, { clip: "s1", frameIndex: 15, event: 0 }, { clip: "s1", frameIndex: 16, event: 0 }]),
  "seq_skeletonraise": Object.freeze([{ clip: "dt", frameIndex: 10, event: 0 }, { clip: "dt", frameIndex: 9, event: 0 }, { clip: "dt", frameIndex: 8, event: 0 }, { clip: "dt", frameIndex: 7, event: 0 }, { clip: "dt", frameIndex: 6, event: 0 }, { clip: "dt", frameIndex: 5, event: 0 }, { clip: "dt", frameIndex: 4, event: 0 }, { clip: "dt", frameIndex: 3, event: 0 }, { clip: "dt", frameIndex: 2, event: 0 }, { clip: "dt", frameIndex: 1, event: 0 }, { clip: "dt", frameIndex: 0, event: 0 }]),
  "seq_fetishres": Object.freeze([{ clip: "sc", frameIndex: 0, event: 0 }, { clip: "sc", frameIndex: 1, event: 0 }, { clip: "sc", frameIndex: 2, event: 0 }, { clip: "sc", frameIndex: 3, event: 0 }, { clip: "sc", frameIndex: 4, event: 0 }, { clip: "sc", frameIndex: 5, event: 0 }, { clip: "sc", frameIndex: 6, event: 0 }, { clip: "sc", frameIndex: 7, event: 0 }, { clip: "sc", frameIndex: 8, event: 0 }, { clip: "sc", frameIndex: 9, event: 0 }, { clip: "sc", frameIndex: 10, event: 0 }, { clip: "sc", frameIndex: 11, event: 0 }, { clip: "sc", frameIndex: 12, event: 0 }, { clip: "sc", frameIndex: 13, event: 2 }, { clip: "sc", frameIndex: 14, event: 0 }, { clip: "sc", frameIndex: 15, event: 0 }, { clip: "sc", frameIndex: 16, event: 0 }]),
  "seq_fethisraise": Object.freeze([{ clip: "dt", frameIndex: 17, event: 0 }, { clip: "dt", frameIndex: 16, event: 0 }, { clip: "dt", frameIndex: 15, event: 0 }, { clip: "dt", frameIndex: 14, event: 0 }, { clip: "dt", frameIndex: 13, event: 0 }, { clip: "dt", frameIndex: 12, event: 0 }, { clip: "dt", frameIndex: 11, event: 0 }, { clip: "dt", frameIndex: 10, event: 0 }, { clip: "dt", frameIndex: 9, event: 0 }, { clip: "dt", frameIndex: 8, event: 0 }, { clip: "dt", frameIndex: 7, event: 0 }, { clip: "dt", frameIndex: 6, event: 0 }, { clip: "dt", frameIndex: 5, event: 0 }, { clip: "dt", frameIndex: 4, event: 0 }, { clip: "dt", frameIndex: 3, event: 0 }, { clip: "dt", frameIndex: 2, event: 0 }, { clip: "dt", frameIndex: 1, event: 0 }, { clip: "dt", frameIndex: 0, event: 0 }]),
  "seq_maggotegg": Object.freeze([{ clip: "dt", frameIndex: 0, event: 0 }, { clip: "dt", frameIndex: 1, event: 0 }, { clip: "dt", frameIndex: 2, event: 0 }, { clip: "dt", frameIndex: 3, event: 0 }, { clip: "dt", frameIndex: 4, event: 0 }, { clip: "dt", frameIndex: 5, event: 0 }, { clip: "dt", frameIndex: 6, event: 0 }, { clip: "dt", frameIndex: 7, event: 0 }, { clip: "dt", frameIndex: 8, event: 0 }, { clip: "dt", frameIndex: 9, event: 4 }, { clip: "dt", frameIndex: 10, event: 0 }, { clip: "dt", frameIndex: 11, event: 0 }, { clip: "dt", frameIndex: 12, event: 0 }, { clip: "dt", frameIndex: 13, event: 0 }]),
  "seq_shamanresurrect": Object.freeze([{ clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 5, event: 0 }, { clip: "a2", frameIndex: 6, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 11, event: 0 }, { clip: "a2", frameIndex: 12, event: 2 }, { clip: "a2", frameIndex: 13, event: 0 }, { clip: "a2", frameIndex: 14, event: 0 }, { clip: "a2", frameIndex: 15, event: 0 }, { clip: "a2", frameIndex: 16, event: 0 }]),
  "seq_maggotup": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 11, event: 4 }]),
  "seq_maggotdown": Object.freeze([{ clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 0, event: 1 }]),
  "seq_maggotlay": Object.freeze([{ clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 9, event: 1 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }]),
  "seq_andarielspray": Object.freeze([{ clip: "sc", frameIndex: 0, event: 0 }, { clip: "sc", frameIndex: 1, event: 0 }, { clip: "sc", frameIndex: 2, event: 0 }, { clip: "sc", frameIndex: 3, event: 0 }, { clip: "sc", frameIndex: 4, event: 2 }, { clip: "sc", frameIndex: 5, event: 2 }, { clip: "sc", frameIndex: 6, event: 2 }, { clip: "sc", frameIndex: 7, event: 2 }, { clip: "sc", frameIndex: 8, event: 2 }, { clip: "sc", frameIndex: 9, event: 2 }, { clip: "sc", frameIndex: 10, event: 2 }, { clip: "sc", frameIndex: 11, event: 2 }, { clip: "sc", frameIndex: 12, event: 2 }, { clip: "sc", frameIndex: 13, event: 0 }, { clip: "sc", frameIndex: 14, event: 0 }, { clip: "sc", frameIndex: 15, event: 0 }, { clip: "sc", frameIndex: 16, event: 0 }, { clip: "sc", frameIndex: 17, event: 0 }]),
  "seq_leaperleap": Object.freeze([{ clip: "a1", frameIndex: 0, event: 0 }, { clip: "a1", frameIndex: 1, event: 1 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 4, event: 0 }, { clip: "a1", frameIndex: 5, event: 0 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 7, event: 2 }, { clip: "a1", frameIndex: 8, event: 0 }, { clip: "a1", frameIndex: 9, event: 1 }, { clip: "a1", frameIndex: 10, event: 0 }, { clip: "a1", frameIndex: 11, event: 1 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }, { clip: "a1", frameIndex: 14, event: 0 }, { clip: "a1", frameIndex: 15, event: 0 }, { clip: "a1", frameIndex: 16, event: 0 }, { clip: "a1", frameIndex: 17, event: 0 }, { clip: "a1", frameIndex: 18, event: 0 }, { clip: "a1", frameIndex: 19, event: 0 }]),
  "seq_swarmmove": Object.freeze([{ clip: "wl", frameIndex: 0, event: 0 }, { clip: "wl", frameIndex: 1, event: 0 }, { clip: "wl", frameIndex: 2, event: 0 }, { clip: "wl", frameIndex: 3, event: 0 }, { clip: "wl", frameIndex: 4, event: 0 }, { clip: "wl", frameIndex: 5, event: 0 }, { clip: "wl", frameIndex: 6, event: 0 }, { clip: "wl", frameIndex: 7, event: 4 }]),
  "seq_nestlay": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 12, event: 0 }, { clip: "s1", frameIndex: 13, event: 0 }, { clip: "s1", frameIndex: 14, event: 0 }, { clip: "s1", frameIndex: 15, event: 0 }, { clip: "s1", frameIndex: 16, event: 0 }, { clip: "s1", frameIndex: 17, event: 0 }, { clip: "s1", frameIndex: 18, event: 0 }, { clip: "s1", frameIndex: 19, event: 0 }, { clip: "s1", frameIndex: 20, event: 0 }, { clip: "s1", frameIndex: 21, event: 0 }, { clip: "s1", frameIndex: 22, event: 0 }, { clip: "s1", frameIndex: 23, event: 0 }, { clip: "s1", frameIndex: 24, event: 0 }, { clip: "s1", frameIndex: 25, event: 4 }, { clip: "s1", frameIndex: 26, event: 0 }, { clip: "s1", frameIndex: 27, event: 0 }, { clip: "s1", frameIndex: 28, event: 0 }, { clip: "s1", frameIndex: 29, event: 0 }, { clip: "s1", frameIndex: 30, event: 0 }]),
  "seq_bloodravencast": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 12, event: 0 }, { clip: "s1", frameIndex: 13, event: 0 }, { clip: "s1", frameIndex: 14, event: 0 }, { clip: "s1", frameIndex: 15, event: 4 }, { clip: "s1", frameIndex: 16, event: 0 }, { clip: "s1", frameIndex: 17, event: 0 }, { clip: "s1", frameIndex: 18, event: 0 }, { clip: "s1", frameIndex: 19, event: 0 }]),
  "seq_brquickstrike": Object.freeze([{ clip: "a1", frameIndex: 0, event: 0 }, { clip: "a1", frameIndex: 1, event: 0 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 4, event: 0 }, { clip: "a1", frameIndex: 5, event: 0 }, { clip: "a1", frameIndex: 6, event: 2 }]),
  "seq_gargoyletrap": Object.freeze([{ clip: "a1", frameIndex: 0, event: 4 }, { clip: "a1", frameIndex: 1, event: 0 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 4, event: 0 }]),
  "seq_desertturret": Object.freeze([{ clip: "a1", frameIndex: 0, event: 0 }, { clip: "a1", frameIndex: 1, event: 4 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 4, event: 0 }, { clip: "a1", frameIndex: 5, event: 0 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 8, event: 0 }]),
  "seq_arcanetower": Object.freeze([{ clip: "a1", frameIndex: 0, event: 0 }, { clip: "a1", frameIndex: 1, event: 0 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 4, event: 0 }, { clip: "a1", frameIndex: 5, event: 0 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 8, event: 0 }, { clip: "a1", frameIndex: 9, event: 4 }, { clip: "a1", frameIndex: 10, event: 0 }, { clip: "a1", frameIndex: 11, event: 0 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }, { clip: "a1", frameIndex: 14, event: 0 }, { clip: "a1", frameIndex: 15, event: 0 }, { clip: "a1", frameIndex: 16, event: 0 }]),
  "seq_tentaclesubmerge": Object.freeze([{ clip: "s1", frameIndex: 12, event: 1 }, { clip: "s1", frameIndex: 11, event: 1 }, { clip: "s1", frameIndex: 10, event: 1 }, { clip: "s1", frameIndex: 9, event: 1 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 3, event: 1 }, { clip: "s1", frameIndex: 2, event: 1 }, { clip: "s1", frameIndex: 1, event: 1 }, { clip: "s1", frameIndex: 0, event: 1 }]),
  "seq_tentheadsubmerge": Object.freeze([{ clip: "s1", frameIndex: 20, event: 1 }, { clip: "s1", frameIndex: 19, event: 1 }, { clip: "s1", frameIndex: 18, event: 1 }, { clip: "s1", frameIndex: 17, event: 1 }, { clip: "s1", frameIndex: 16, event: 0 }, { clip: "s1", frameIndex: 15, event: 0 }, { clip: "s1", frameIndex: 14, event: 0 }, { clip: "s1", frameIndex: 13, event: 0 }, { clip: "s1", frameIndex: 12, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 2, event: 1 }, { clip: "s1", frameIndex: 1, event: 1 }, { clip: "s1", frameIndex: 0, event: 1 }]),
  "seq_froghidden": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }]),
  "seq_diablorun": Object.freeze([{ clip: "rn", frameIndex: 0, event: 0 }, { clip: "rn", frameIndex: 1, event: 0 }, { clip: "rn", frameIndex: 2, event: 0 }, { clip: "rn", frameIndex: 3, event: 0 }, { clip: "rn", frameIndex: 4, event: 0 }, { clip: "rn", frameIndex: 5, event: 2 }, { clip: "rn", frameIndex: 6, event: 2 }, { clip: "rn", frameIndex: 7, event: 2 }, { clip: "rn", frameIndex: 8, event: 2 }, { clip: "rn", frameIndex: 9, event: 2 }, { clip: "rn", frameIndex: 10, event: 2 }, { clip: "rn", frameIndex: 11, event: 2 }, { clip: "rn", frameIndex: 12, event: 2 }, { clip: "rn", frameIndex: 13, event: 2 }, { clip: "rn", frameIndex: 14, event: 0 }, { clip: "rn", frameIndex: 15, event: 0 }, { clip: "rn", frameIndex: 16, event: 0 }, { clip: "rn", frameIndex: 17, event: 0 }, { clip: "rn", frameIndex: 18, event: 1 }, { clip: "rn", frameIndex: 19, event: 0 }, { clip: "rn", frameIndex: 20, event: 0 }, { clip: "rn", frameIndex: 21, event: 0 }]),
  "seq_diablofirewall": Object.freeze([{ clip: "s1", frameIndex: 17, event: 0 }, { clip: "s1", frameIndex: 16, event: 0 }, { clip: "s1", frameIndex: 15, event: 0 }, { clip: "s1", frameIndex: 14, event: 0 }, { clip: "s1", frameIndex: 13, event: 0 }, { clip: "s1", frameIndex: 12, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 8, event: 1 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 0, event: 0 }]),
  "seq_tightspotguard": Object.freeze([{ clip: "s1", frameIndex: 0, event: 4 }]),
  "seq_act2guardjab": Object.freeze([{ clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 4, event: 0 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 8, event: 0 }, { clip: "a1", frameIndex: 10, event: 0 }, { clip: "a1", frameIndex: 11, event: 1 }, { clip: "a1", frameIndex: 10, event: 0 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 10, event: 0 }, { clip: "a1", frameIndex: 11, event: 1 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }, { clip: "a1", frameIndex: 14, event: 0 }, { clip: "a1", frameIndex: 15, event: 0 }]),
  "seq_mummyspawn": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 12, event: 0 }, { clip: "s1", frameIndex: 13, event: 0 }, { clip: "s1", frameIndex: 14, event: 0 }, { clip: "s1", frameIndex: 15, event: 0 }, { clip: "s1", frameIndex: 16, event: 0 }, { clip: "s1", frameIndex: 17, event: 0 }, { clip: "s1", frameIndex: 18, event: 0 }, { clip: "s1", frameIndex: 19, event: 4 }]),
  "seq_mosquitoskill": Object.freeze([{ clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 5, event: 0 }, { clip: "a2", frameIndex: 6, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 11, event: 0 }, { clip: "a2", frameIndex: 12, event: 0 }, { clip: "a2", frameIndex: 13, event: 0 }, { clip: "a2", frameIndex: 14, event: 0 }, { clip: "a2", frameIndex: 15, event: 0 }, { clip: "a2", frameIndex: 16, event: 0 }, { clip: "a2", frameIndex: 17, event: 1 }, { clip: "a2", frameIndex: 18, event: 0 }, { clip: "a2", frameIndex: 19, event: 0 }, { clip: "a2", frameIndex: 20, event: 0 }, { clip: "a2", frameIndex: 21, event: 0 }, { clip: "a2", frameIndex: 22, event: 0 }, { clip: "a2", frameIndex: 23, event: 0 }, { clip: "a2", frameIndex: 24, event: 0 }, { clip: "a2", frameIndex: 25, event: 0 }]),
  "seq_mosquitonest": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 12, event: 1 }, { clip: "s1", frameIndex: 13, event: 0 }, { clip: "s1", frameIndex: 14, event: 0 }, { clip: "s1", frameIndex: 15, event: 0 }, { clip: "s1", frameIndex: 16, event: 0 }]),
  "seq_durielcharge": Object.freeze([{ clip: "wl", frameIndex: 0, event: 1 }, { clip: "wl", frameIndex: 1, event: 1 }, { clip: "wl", frameIndex: 2, event: 1 }, { clip: "wl", frameIndex: 3, event: 1 }, { clip: "wl", frameIndex: 4, event: 1 }, { clip: "wl", frameIndex: 5, event: 3 }, { clip: "wl", frameIndex: 6, event: 1 }, { clip: "wl", frameIndex: 7, event: 1 }, { clip: "wl", frameIndex: 8, event: 1 }, { clip: "wl", frameIndex: 9, event: 1 }, { clip: "wl", frameIndex: 10, event: 1 }, { clip: "wl", frameIndex: 11, event: 1 }, { clip: "wl", frameIndex: 12, event: 1 }, { clip: "wl", frameIndex: 13, event: 1 }, { clip: "wl", frameIndex: 14, event: 1 }, { clip: "wl", frameIndex: 15, event: 1 }, { clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 5, event: 0 }, { clip: "a2", frameIndex: 6, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 9, event: 1 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 11, event: 0 }, { clip: "a2", frameIndex: 12, event: 0 }, { clip: "a2", frameIndex: 13, event: 0 }, { clip: "a2", frameIndex: 14, event: 0 }]),
  "seq_durieljab": Object.freeze([{ clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 4, event: 3 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 7, event: 1 }, { clip: "a1", frameIndex: 8, event: 0 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 6, event: 3 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 9, event: 1 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 12, event: 0 }, { clip: "a2", frameIndex: 14, event: 1 }]),
  "seq_durielsmite": Object.freeze([{ clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 5, event: 0 }, { clip: "a2", frameIndex: 6, event: 0 }, { clip: "a2", frameIndex: 7, event: 1 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }]),
  "seq_undeadbestow": Object.freeze([{ clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 1, event: 0 }, { clip: "s2", frameIndex: 2, event: 0 }, { clip: "s2", frameIndex: 3, event: 0 }, { clip: "s2", frameIndex: 4, event: 0 }, { clip: "s2", frameIndex: 5, event: 0 }, { clip: "s2", frameIndex: 6, event: 0 }, { clip: "s2", frameIndex: 7, event: 0 }, { clip: "s2", frameIndex: 8, event: 0 }, { clip: "s2", frameIndex: 9, event: 0 }, { clip: "s2", frameIndex: 10, event: 0 }, { clip: "s2", frameIndex: 11, event: 1 }, { clip: "s2", frameIndex: 12, event: 0 }, { clip: "s2", frameIndex: 13, event: 0 }, { clip: "s2", frameIndex: 14, event: 0 }, { clip: "s2", frameIndex: 15, event: 0 }]),
  "seq_queendeath": Object.freeze([{ clip: "dt", frameIndex: 0, event: 0 }, { clip: "dt", frameIndex: 1, event: 0 }, { clip: "dt", frameIndex: 2, event: 0 }, { clip: "dt", frameIndex: 3, event: 0 }, { clip: "dt", frameIndex: 4, event: 0 }, { clip: "dt", frameIndex: 5, event: 0 }, { clip: "dt", frameIndex: 6, event: 0 }, { clip: "dt", frameIndex: 7, event: 0 }, { clip: "dt", frameIndex: 8, event: 0 }, { clip: "dt", frameIndex: 9, event: 0 }, { clip: "dt", frameIndex: 10, event: 0 }, { clip: "dt", frameIndex: 11, event: 0 }, { clip: "dt", frameIndex: 12, event: 0 }, { clip: "dt", frameIndex: 13, event: 0 }, { clip: "dt", frameIndex: 14, event: 0 }, { clip: "dt", frameIndex: 15, event: 0 }, { clip: "dt", frameIndex: 16, event: 0 }, { clip: "dt", frameIndex: 17, event: 0 }, { clip: "dt", frameIndex: 18, event: 0 }, { clip: "dt", frameIndex: 19, event: 0 }, { clip: "dt", frameIndex: 20, event: 0 }, { clip: "dt", frameIndex: 21, event: 0 }, { clip: "dt", frameIndex: 22, event: 1 }, { clip: "dt", frameIndex: 21, event: 0 }, { clip: "dt", frameIndex: 20, event: 0 }, { clip: "dt", frameIndex: 19, event: 0 }, { clip: "dt", frameIndex: 18, event: 0 }, { clip: "dt", frameIndex: 17, event: 0 }, { clip: "dt", frameIndex: 16, event: 0 }, { clip: "dt", frameIndex: 15, event: 0 }, { clip: "dt", frameIndex: 14, event: 0 }, { clip: "dt", frameIndex: 13, event: 0 }, { clip: "dt", frameIndex: 12, event: 0 }, { clip: "dt", frameIndex: 11, event: 0 }, { clip: "dt", frameIndex: 10, event: 0 }, { clip: "dt", frameIndex: 9, event: 0 }, { clip: "dt", frameIndex: 8, event: 0 }, { clip: "dt", frameIndex: 7, event: 0 }, { clip: "dt", frameIndex: 6, event: 1 }, { clip: "dt", frameIndex: 23, event: 0 }, { clip: "dt", frameIndex: 23, event: 0 }, { clip: "dt", frameIndex: 24, event: 0 }, { clip: "dt", frameIndex: 24, event: 0 }, { clip: "dt", frameIndex: 25, event: 0 }, { clip: "dt", frameIndex: 25, event: 0 }, { clip: "dt", frameIndex: 26, event: 0 }, { clip: "dt", frameIndex: 26, event: 0 }, { clip: "dt", frameIndex: 27, event: 0 }, { clip: "dt", frameIndex: 27, event: 0 }, { clip: "dt", frameIndex: 28, event: 0 }, { clip: "dt", frameIndex: 28, event: 0 }, { clip: "dt", frameIndex: 29, event: 0 }, { clip: "dt", frameIndex: 29, event: 0 }, { clip: "dt", frameIndex: 30, event: 1 }]),
  "seq_chargesentry": Object.freeze([{ clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 1, event: 0 }, { clip: "s2", frameIndex: 2, event: 1 }, { clip: "s2", frameIndex: 3, event: 0 }, { clip: "s2", frameIndex: 4, event: 0 }, { clip: "s2", frameIndex: 5, event: 0 }, { clip: "s2", frameIndex: 6, event: 0 }, { clip: "s2", frameIndex: 7, event: 0 }, { clip: "s2", frameIndex: 8, event: 0 }, { clip: "s2", frameIndex: 9, event: 0 }, { clip: "s2", frameIndex: 10, event: 0 }, { clip: "s2", frameIndex: 11, event: 0 }, { clip: "s2", frameIndex: 12, event: 0 }, { clip: "s2", frameIndex: 13, event: 0 }, { clip: "s2", frameIndex: 14, event: 0 }]),
  "seq_reanimatedcharge": Object.freeze([{ clip: "rn", frameIndex: 0, event: 1 }, { clip: "rn", frameIndex: 1, event: 1 }, { clip: "rn", frameIndex: 2, event: 1 }, { clip: "rn", frameIndex: 3, event: 1 }, { clip: "rn", frameIndex: 4, event: 1 }, { clip: "rn", frameIndex: 5, event: 1 }, { clip: "rn", frameIndex: 6, event: 1 }, { clip: "rn", frameIndex: 7, event: 1 }, { clip: "rn", frameIndex: 8, event: 1 }, { clip: "rn", frameIndex: 9, event: 1 }, { clip: "rn", frameIndex: 10, event: 1 }, { clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 4, event: 1 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 5, event: 0 }, { clip: "a2", frameIndex: 6, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 10, event: 0 }]),
  "seq_bearsmite": Object.freeze([{ clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 5, event: 0 }, { clip: "a2", frameIndex: 6, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 8, event: 1 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 11, event: 0 }, { clip: "a2", frameIndex: 12, event: 0 }, { clip: "a2", frameIndex: 13, event: 0 }, { clip: "a2", frameIndex: 14, event: 0 }, { clip: "a2", frameIndex: 15, event: 0 }, { clip: "a2", frameIndex: 16, event: 0 }]),
  "seq_horrorarcticblast": Object.freeze([{ clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 5, event: 0 }, { clip: "a2", frameIndex: 6, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 9, event: 1 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 11, event: 0 }, { clip: "a2", frameIndex: 12, event: 0 }, { clip: "a2", frameIndex: 13, event: 0 }]),
  "seq_deathmaulerdig": Object.freeze([{ clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 5, event: 0 }, { clip: "a2", frameIndex: 6, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 7, event: 1 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 8, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 9, event: 0 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 10, event: 0 }, { clip: "a2", frameIndex: 11, event: 0 }, { clip: "a2", frameIndex: 11, event: 0 }, { clip: "a2", frameIndex: 11, event: 0 }, { clip: "a2", frameIndex: 11, event: 0 }, { clip: "a2", frameIndex: 12, event: 0 }, { clip: "a2", frameIndex: 13, event: 0 }]),
  "seq_genericspawner": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 4 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 12, event: 0 }, { clip: "s1", frameIndex: 13, event: 0 }, { clip: "s1", frameIndex: 14, event: 0 }, { clip: "s1", frameIndex: 15, event: 0 }, { clip: "s1", frameIndex: 16, event: 0 }, { clip: "s1", frameIndex: 17, event: 0 }, { clip: "s1", frameIndex: 17, event: 0 }, { clip: "s1", frameIndex: 18, event: 0 }, { clip: "s1", frameIndex: 18, event: 0 }, { clip: "s1", frameIndex: 19, event: 0 }, { clip: "s1", frameIndex: 19, event: 0 }, { clip: "s1", frameIndex: 20, event: 0 }, { clip: "s1", frameIndex: 20, event: 0 }, { clip: "s1", frameIndex: 21, event: 0 }, { clip: "s1", frameIndex: 21, event: 0 }]),
  "seq_nihlathakarctic": Object.freeze([{ clip: "a1", frameIndex: 0, event: 0 }, { clip: "a1", frameIndex: 1, event: 0 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 4, event: 0 }, { clip: "a1", frameIndex: 5, event: 0 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 7, event: 1 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 11, event: 0 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }]),
  "seq_ancientwhirlwind": Object.freeze([{ clip: "a1", frameIndex: 0, event: 0 }, { clip: "a1", frameIndex: 1, event: 0 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 1 }, { clip: "a1", frameIndex: 4, event: 0 }, { clip: "a1", frameIndex: 5, event: 0 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 7, event: 1 }]),
  "seq_infernosentry": Object.freeze([{ clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 1, event: 1 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }]),
  "seq_swtigerfist": Object.freeze([{ clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 2, event: 0 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 4, event: 0 }, { clip: "a2", frameIndex: 5, event: 0 }, { clip: "a2", frameIndex: 6, event: 1 }, { clip: "s4", frameIndex: 3, event: 0 }, { clip: "s4", frameIndex: 4, event: 0 }, { clip: "s4", frameIndex: 5, event: 0 }, { clip: "s4", frameIndex: 6, event: 1 }, { clip: "s4", frameIndex: 7, event: 0 }, { clip: "s4", frameIndex: 8, event: 0 }, { clip: "s4", frameIndex: 9, event: 0 }, { clip: "s4", frameIndex: 10, event: 0 }, { clip: "s4", frameIndex: 11, event: 0 }]),
  "seq_swdragonbreath": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 8, event: 1 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 1 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 12, event: 1 }, { clip: "s1", frameIndex: 12, event: 0 }, { clip: "s1", frameIndex: 13, event: 1 }, { clip: "s1", frameIndex: 13, event: 0 }, { clip: "s1", frameIndex: 14, event: 0 }]),
  "seq_ancientleap": Object.freeze([{ clip: "s1", frameIndex: 0, event: 0 }, { clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 3, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 1 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 11, event: 1 }, { clip: "s1", frameIndex: 12, event: 0 }, { clip: "s1", frameIndex: 13, event: 1 }, { clip: "s1", frameIndex: 14, event: 1 }, { clip: "s1", frameIndex: 15, event: 0 }, { clip: "s1", frameIndex: 16, event: 0 }]),
  "seq_impinferno": Object.freeze([{ clip: "sc", frameIndex: 0, event: 0 }, { clip: "sc", frameIndex: 1, event: 0 }, { clip: "sc", frameIndex: 2, event: 0 }, { clip: "sc", frameIndex: 3, event: 0 }, { clip: "sc", frameIndex: 4, event: 0 }, { clip: "sc", frameIndex: 5, event: 0 }, { clip: "sc", frameIndex: 6, event: 0 }, { clip: "sc", frameIndex: 7, event: 0 }, { clip: "sc", frameIndex: 8, event: 0 }, { clip: "sc", frameIndex: 9, event: 0 }, { clip: "sc", frameIndex: 10, event: 0 }, { clip: "sc", frameIndex: 11, event: 0 }, { clip: "sc", frameIndex: 12, event: 4 }, { clip: "sc", frameIndex: 13, event: 0 }]),
  "seq_swdragonflight": Object.freeze([{ clip: "sc", frameIndex: 0, event: 0 }, { clip: "sc", frameIndex: 1, event: 0 }, { clip: "sc", frameIndex: 2, event: 0 }, { clip: "sc", frameIndex: 3, event: 0 }, { clip: "sc", frameIndex: 4, event: 0 }, { clip: "sc", frameIndex: 5, event: 0 }, { clip: "sc", frameIndex: 6, event: 0 }, { clip: "sc", frameIndex: 7, event: 0 }, { clip: "sc", frameIndex: 8, event: 0 }, { clip: "sc", frameIndex: 9, event: 1 }, { clip: "a1", frameIndex: 0, event: 0 }, { clip: "a1", frameIndex: 1, event: 0 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 4, event: 1 }, { clip: "a1", frameIndex: 5, event: 0 }, { clip: "a1", frameIndex: 6, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 8, event: 0 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 10, event: 0 }, { clip: "a1", frameIndex: 11, event: 0 }, { clip: "a1", frameIndex: 12, event: 0 }]),
  "seq_siegebeastcharge": Object.freeze([{ clip: "wl", frameIndex: 0, event: 1 }, { clip: "wl", frameIndex: 0, event: 1 }, { clip: "wl", frameIndex: 1, event: 1 }, { clip: "wl", frameIndex: 1, event: 1 }, { clip: "wl", frameIndex: 2, event: 1 }, { clip: "wl", frameIndex: 2, event: 1 }, { clip: "wl", frameIndex: 3, event: 1 }, { clip: "wl", frameIndex: 4, event: 1 }, { clip: "wl", frameIndex: 4, event: 1 }, { clip: "wl", frameIndex: 5, event: 1 }, { clip: "wl", frameIndex: 5, event: 1 }, { clip: "wl", frameIndex: 6, event: 1 }, { clip: "wl", frameIndex: 6, event: 1 }, { clip: "wl", frameIndex: 7, event: 1 }, { clip: "a2", frameIndex: 0, event: 0 }, { clip: "a2", frameIndex: 1, event: 0 }, { clip: "a2", frameIndex: 2, event: 3 }, { clip: "a2", frameIndex: 3, event: 0 }, { clip: "a2", frameIndex: 4, event: 1 }, { clip: "a2", frameIndex: 5, event: 0 }, { clip: "a2", frameIndex: 6, event: 0 }, { clip: "a2", frameIndex: 7, event: 0 }]),
  "seq_baalinferno": Object.freeze([{ clip: "s1", frameIndex: 1, event: 0 }, { clip: "s1", frameIndex: 2, event: 0 }, { clip: "s1", frameIndex: 4, event: 0 }, { clip: "s1", frameIndex: 5, event: 0 }, { clip: "s1", frameIndex: 6, event: 0 }, { clip: "s1", frameIndex: 7, event: 0 }, { clip: "s1", frameIndex: 8, event: 0 }, { clip: "s1", frameIndex: 9, event: 0 }, { clip: "s1", frameIndex: 10, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 11, event: 0 }, { clip: "s1", frameIndex: 11, event: 4 }, { clip: "s1", frameIndex: 12, event: 0 }, { clip: "s1", frameIndex: 13, event: 0 }, { clip: "s1", frameIndex: 14, event: 0 }, { clip: "s1", frameIndex: 15, event: 0 }]),
  "seq_swbladefury": Object.freeze([{ clip: "sc", frameIndex: 0, event: 0 }, { clip: "sc", frameIndex: 1, event: 0 }, { clip: "sc", frameIndex: 2, event: 0 }, { clip: "sc", frameIndex: 3, event: 0 }, { clip: "sc", frameIndex: 4, event: 0 }, { clip: "sc", frameIndex: 5, event: 0 }, { clip: "sc", frameIndex: 6, event: 0 }, { clip: "sc", frameIndex: 7, event: 0 }, { clip: "sc", frameIndex: 8, event: 0 }, { clip: "sc", frameIndex: 9, event: 1 }, { clip: "sc", frameIndex: 10, event: 0 }, { clip: "sc", frameIndex: 11, event: 0 }, { clip: "sc", frameIndex: 12, event: 0 }, { clip: "sc", frameIndex: 13, event: 0 }, { clip: "sc", frameIndex: 14, event: 0 }, { clip: "sc", frameIndex: 15, event: 0 }, { clip: "sc", frameIndex: 16, event: 0 }]),
  "seq_wakeofinferno": Object.freeze([{ clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 0, event: 0 }, { clip: "s2", frameIndex: 1, event: 1 }, { clip: "s2", frameIndex: 0, event: 0 }]),
  "seq_sandraiderflurry": Object.freeze([{ clip: "a1", frameIndex: 1, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 5, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 10, event: 1 }, { clip: "a1", frameIndex: 11, event: 0 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }, { clip: "a1", frameIndex: 14, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 11, event: 0 }, { clip: "a1", frameIndex: 10, event: 1 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 11, event: 0 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }, { clip: "a1", frameIndex: 14, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 11, event: 0 }, { clip: "a1", frameIndex: 10, event: 1 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 11, event: 0 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }, { clip: "a1", frameIndex: 14, event: 0 }]),
  "seq_crlancerjab": Object.freeze([{ clip: "a1", frameIndex: 0, event: 0 }, { clip: "a1", frameIndex: 1, event: 0 }, { clip: "a1", frameIndex: 2, event: 0 }, { clip: "a1", frameIndex: 3, event: 0 }, { clip: "a1", frameIndex: 5, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 11, event: 1 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 11, event: 1 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 7, event: 0 }, { clip: "a1", frameIndex: 9, event: 0 }, { clip: "a1", frameIndex: 11, event: 1 }, { clip: "a1", frameIndex: 10, event: 0 }, { clip: "a1", frameIndex: 12, event: 0 }, { clip: "a1", frameIndex: 13, event: 0 }, { clip: "a1", frameIndex: 14, event: 0 }, { clip: "a1", frameIndex: 15, event: 0 }, { clip: "a1", frameIndex: 16, event: 0 }, { clip: "a1", frameIndex: 17, event: 0 }]),
})

/** Monster `hcIdx` -> primary `monseq.txt` sequence and optional per-skill sequence overrides. */
export const MONSTER_CLASS_SEQUENCES_113C: Readonly<Record<number, { readonly defaultSeq: string; readonly bySkillId?: Readonly<Record<number, string>> }>> = Object.freeze({
  0: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  1: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  2: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  3: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  4: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  29: { defaultSeq: "seq_firehit", bySkillId: { 156: "seq_firehit" } },
  30: { defaultSeq: "seq_firehit", bySkillId: { 156: "seq_firehit" } },
  31: { defaultSeq: "seq_firehit", bySkillId: { 156: "seq_firehit" } },
  32: { defaultSeq: "seq_firehit", bySkillId: { 156: "seq_firehit" } },
  33: { defaultSeq: "seq_firehit", bySkillId: { 156: "seq_firehit" } },
  58: { defaultSeq: "seq_shamanresurrect", bySkillId: { 160: "seq_shamanresurrect", 181: "seq_shamanresurrect" } },
  59: { defaultSeq: "seq_shamanresurrect", bySkillId: { 160: "seq_shamanresurrect", 181: "seq_shamanresurrect" } },
  60: { defaultSeq: "seq_shamanresurrect", bySkillId: { 160: "seq_shamanresurrect", 181: "seq_shamanresurrect" } },
  61: { defaultSeq: "seq_shamanresurrect", bySkillId: { 160: "seq_shamanresurrect", 181: "seq_shamanresurrect" } },
  62: { defaultSeq: "seq_shamanresurrect", bySkillId: { 160: "seq_shamanresurrect", 181: "seq_shamanresurrect" } },
  68: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay" } },
  69: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay" } },
  70: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay" } },
  71: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay" } },
  72: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay" } },
  73: { defaultSeq: "seq_serpentcharge", bySkillId: { 352: "seq_serpentcharge" } },
  74: { defaultSeq: "seq_serpentcharge", bySkillId: { 352: "seq_serpentcharge" } },
  75: { defaultSeq: "seq_serpentcharge", bySkillId: { 352: "seq_serpentcharge" } },
  76: { defaultSeq: "seq_serpentcharge", bySkillId: { 352: "seq_serpentcharge" } },
  77: { defaultSeq: "seq_serpentcharge", bySkillId: { 352: "seq_serpentcharge" } },
  78: { defaultSeq: "seq_leaperleap", bySkillId: { 132: "seq_leaperleap" } },
  79: { defaultSeq: "seq_leaperleap", bySkillId: { 132: "seq_leaperleap" } },
  80: { defaultSeq: "seq_leaperleap", bySkillId: { 132: "seq_leaperleap" } },
  81: { defaultSeq: "seq_leaperleap", bySkillId: { 132: "seq_leaperleap" } },
  82: { defaultSeq: "seq_leaperleap", bySkillId: { 132: "seq_leaperleap" } },
  87: { defaultSeq: "seq_swarmmove", bySkillId: { 166: "seq_swarmmove" } },
  88: { defaultSeq: "seq_swarmmove", bySkillId: { 166: "seq_swarmmove" } },
  89: { defaultSeq: "seq_swarmmove", bySkillId: { 166: "seq_swarmmove" } },
  90: { defaultSeq: "seq_swarmmove", bySkillId: { 166: "seq_swarmmove" } },
  91: { defaultSeq: "seq_scarabjab", bySkillId: { 10: "seq_scarabjab" } },
  92: { defaultSeq: "seq_scarabjab", bySkillId: { 10: "seq_scarabjab" } },
  93: { defaultSeq: "seq_scarabjab", bySkillId: { 10: "seq_scarabjab" } },
  94: { defaultSeq: "seq_scarabjab", bySkillId: { 10: "seq_scarabjab" } },
  95: { defaultSeq: "seq_scarabjab", bySkillId: { 10: "seq_scarabjab" } },
  101: { defaultSeq: "seq_mummyres", bySkillId: { 157: "seq_mummyres", 182: "seq_mummyres", 327: "seq_mummyres" } },
  102: { defaultSeq: "seq_mummyres", bySkillId: { 157: "seq_mummyres", 182: "seq_mummyres", 327: "seq_mummyres" } },
  103: { defaultSeq: "seq_mummyres", bySkillId: { 157: "seq_mummyres", 182: "seq_mummyres", 327: "seq_mummyres" } },
  104: { defaultSeq: "seq_mummyres", bySkillId: { 157: "seq_mummyres", 182: "seq_mummyres", 327: "seq_mummyres" } },
  105: { defaultSeq: "seq_mummyres", bySkillId: { 157: "seq_mummyres", 182: "seq_mummyres", 327: "seq_mummyres" } },
  114: { defaultSeq: "seq_mosquitoskill", bySkillId: { 206: "seq_mosquitoskill" } },
  115: { defaultSeq: "seq_mosquitoskill", bySkillId: { 206: "seq_mosquitoskill" } },
  116: { defaultSeq: "seq_mosquitoskill", bySkillId: { 206: "seq_mosquitoskill" } },
  117: { defaultSeq: "seq_mosquitoskill", bySkillId: { 206: "seq_mosquitoskill" } },
  141: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  142: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  143: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  144: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  145: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  156: { defaultSeq: "seq_andarielspray", bySkillId: { 164: "seq_andarielspray" } },
  186: { defaultSeq: "seq_pinheadsmite", bySkillId: { 97: "seq_pinheadsmite" } },
  187: { defaultSeq: "seq_pinheadsmite", bySkillId: { 97: "seq_pinheadsmite" } },
  188: { defaultSeq: "seq_pinheadsmite", bySkillId: { 97: "seq_pinheadsmite" } },
  189: { defaultSeq: "seq_pinheadsmite", bySkillId: { 97: "seq_pinheadsmite" } },
  190: { defaultSeq: "seq_maggotegg", bySkillId: { 159: "seq_maggotegg" } },
  191: { defaultSeq: "seq_maggotegg", bySkillId: { 159: "seq_maggotegg" } },
  192: { defaultSeq: "seq_maggotegg", bySkillId: { 159: "seq_maggotegg" } },
  193: { defaultSeq: "seq_maggotegg", bySkillId: { 159: "seq_maggotegg" } },
  194: { defaultSeq: "seq_maggotegg", bySkillId: { 159: "seq_maggotegg" } },
  203: { defaultSeq: "seq_act2guardjab", bySkillId: { 10: "seq_act2guardjab" } },
  206: { defaultSeq: "seq_nestlay", bySkillId: { 167: "seq_nestlay" } },
  207: { defaultSeq: "seq_nestlay", bySkillId: { 167: "seq_nestlay" } },
  208: { defaultSeq: "seq_nestlay", bySkillId: { 167: "seq_nestlay" } },
  209: { defaultSeq: "seq_nestlay", bySkillId: { 167: "seq_nestlay" } },
  211: { defaultSeq: "seq_durielcharge", bySkillId: { 10: "seq_durieljab", 97: "seq_durielsmite", 107: "seq_durielcharge" } },
  228: { defaultSeq: "seq_mummyspawn", bySkillId: { 167: "seq_mummyspawn" } },
  229: { defaultSeq: "seq_mummyres", bySkillId: { 157: "seq_mummyres", 182: "seq_mummyres", 327: "seq_mummyres" } },
  234: { defaultSeq: "seq_pinheadsmite", bySkillId: { 107: "seq_pinheadsmite" } },
  243: { defaultSeq: "seq_diablorun", bySkillId: { 198: "seq_diablorun" } },
  247: { defaultSeq: "seq_froghidden", bySkillId: { 176: "seq_froghidden" } },
  248: { defaultSeq: "seq_froghidden", bySkillId: { 176: "seq_froghidden" } },
  249: { defaultSeq: "seq_froghidden", bySkillId: { 176: "seq_froghidden" } },
  258: { defaultSeq: "seq_tentaclesubmerge", bySkillId: { 176: "seq_tentaclesubmerge" } },
  259: { defaultSeq: "seq_tentaclesubmerge", bySkillId: { 176: "seq_tentaclesubmerge" } },
  260: { defaultSeq: "seq_tentaclesubmerge", bySkillId: { 176: "seq_tentaclesubmerge" } },
  261: { defaultSeq: "seq_tentheadsubmerge", bySkillId: { 176: "seq_tentheadsubmerge" } },
  262: { defaultSeq: "seq_tentheadsubmerge", bySkillId: { 176: "seq_tentheadsubmerge" } },
  263: { defaultSeq: "seq_tentheadsubmerge", bySkillId: { 176: "seq_tentheadsubmerge" } },
  267: { defaultSeq: "seq_bloodravencast", bySkillId: { 167: "seq_bloodravencast", 168: "seq_brquickstrike" } },
  273: { defaultSeq: "seq_gargoyletrap", bySkillId: { 172: "seq_gargoyletrap" } },
  274: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  275: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  276: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  277: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  278: { defaultSeq: "seq_fetishres", bySkillId: { 327: "seq_fetishres" } },
  279: { defaultSeq: "seq_fetishres", bySkillId: { 327: "seq_fetishres" } },
  280: { defaultSeq: "seq_fetishres", bySkillId: { 327: "seq_fetishres" } },
  281: { defaultSeq: "seq_fetishres", bySkillId: { 327: "seq_fetishres" } },
  282: { defaultSeq: "seq_fetishres", bySkillId: { 327: "seq_fetishres" } },
  284: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay", 216: "seq_queendeath" } },
  285: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay", 216: "seq_queendeath" } },
  286: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay", 216: "seq_queendeath" } },
  287: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay", 216: "seq_queendeath" } },
  288: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay", 216: "seq_queendeath" } },
  298: { defaultSeq: "seq_vileres", bySkillId: { 167: "seq_vileres" } },
  299: { defaultSeq: "seq_vileres", bySkillId: { 167: "seq_vileres" } },
  300: { defaultSeq: "seq_vileres", bySkillId: { 167: "seq_vileres" } },
  312: { defaultSeq: "seq_undeadbestow", bySkillId: { 182: "seq_undeadbestow" } },
  331: { defaultSeq: "seq_act2guardjab", bySkillId: { 10: "seq_act2guardjab" } },
  333: { defaultSeq: "seq_diablorun", bySkillId: { 198: "seq_diablorun" } },
  334: { defaultSeq: "seq_mosquitonest", bySkillId: { 167: "seq_mosquitonest" } },
  335: { defaultSeq: "seq_mosquitonest", bySkillId: { 167: "seq_mosquitonest" } },
  336: { defaultSeq: "seq_mosquitonest", bySkillId: { 167: "seq_mosquitonest" } },
  337: { defaultSeq: "seq_mosquitonest", bySkillId: { 167: "seq_mosquitonest" } },
  338: { defaultSeq: "seq_act2guardjab", bySkillId: { 10: "seq_act2guardjab" } },
  348: { defaultSeq: "seq_desertturret", bySkillId: { 203: "seq_desertturret" } },
  349: { defaultSeq: "seq_desertturret", bySkillId: { 203: "seq_desertturret" } },
  350: { defaultSeq: "seq_desertturret", bySkillId: { 203: "seq_desertturret" } },
  358: { defaultSeq: "seq_act2guardjab", bySkillId: { 10: "seq_act2guardjab" } },
  371: { defaultSeq: "seq_arcanetower", bySkillId: { 49: "seq_arcanetower", 204: "seq_arcanetower" } },
  372: { defaultSeq: "seq_desertturret", bySkillId: { 203: "seq_desertturret" } },
  377: { defaultSeq: "seq_act2guardjab", bySkillId: { 10: "seq_act2guardjab" } },
  378: { defaultSeq: "seq_act2guardjab", bySkillId: { 10: "seq_act2guardjab" } },
  379: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  380: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  381: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  382: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  383: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  384: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  385: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  386: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  387: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  388: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  389: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  390: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  396: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  397: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  398: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  399: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  400: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  407: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  411: { defaultSeq: "seq_chargesentry", bySkillId: { 306: "seq_chargesentry" } },
  412: { defaultSeq: "seq_chargesentry", bySkillId: { 313: "seq_chargesentry" } },
  415: { defaultSeq: "seq_infernosentry", bySkillId: { 311: "seq_infernosentry" } },
  416: { defaultSeq: "seq_chargesentry", bySkillId: { 312: "seq_chargesentry", 324: "seq_chargesentry" } },
  417: { defaultSeq: "seq_swtigerfist", bySkillId: { 259: "seq_swtigerfist", 260: "seq_swtigerfist", 266: "seq_swbladefury", 269: "seq_swtigerfist", 274: "seq_swtigerfist", 275: "seq_swdragonflight" } },
  418: { defaultSeq: "seq_swtigerfist", bySkillId: { 259: "seq_swtigerfist", 260: "seq_swtigerfist", 266: "seq_swbladefury", 269: "seq_swtigerfist", 274: "seq_swtigerfist", 275: "seq_swdragonflight" } },
  428: { defaultSeq: "seq_bearsmite", bySkillId: { 326: "seq_bearsmite" } },
  436: { defaultSeq: "seq_reanimatedcharge", bySkillId: { 107: "seq_reanimatedcharge" } },
  437: { defaultSeq: "seq_reanimatedcharge", bySkillId: { 107: "seq_reanimatedcharge" } },
  438: { defaultSeq: "seq_reanimatedcharge", bySkillId: { 107: "seq_reanimatedcharge" } },
  439: { defaultSeq: "seq_reanimatedcharge", bySkillId: { 107: "seq_reanimatedcharge" } },
  440: { defaultSeq: "seq_reanimatedcharge", bySkillId: { 107: "seq_reanimatedcharge" } },
  441: { defaultSeq: "seq_siegebeastcharge", bySkillId: { 107: "seq_siegebeastcharge" } },
  442: { defaultSeq: "seq_siegebeastcharge", bySkillId: { 107: "seq_siegebeastcharge" } },
  443: { defaultSeq: "seq_siegebeastcharge", bySkillId: { 107: "seq_siegebeastcharge" } },
  444: { defaultSeq: "seq_siegebeastcharge", bySkillId: { 107: "seq_siegebeastcharge" } },
  445: { defaultSeq: "seq_siegebeastcharge", bySkillId: { 107: "seq_siegebeastcharge" } },
  479: { defaultSeq: "seq_genericspawner", bySkillId: { 97: "seq_genericspawner" } },
  480: { defaultSeq: "seq_genericspawner", bySkillId: { 97: "seq_genericspawner" } },
  481: { defaultSeq: "seq_genericspawner", bySkillId: { 97: "seq_genericspawner" } },
  482: { defaultSeq: "seq_genericspawner", bySkillId: { 97: "seq_genericspawner" } },
  483: { defaultSeq: "seq_genericspawner", bySkillId: { 97: "seq_genericspawner" } },
  501: { defaultSeq: "seq_horrorarcticblast", bySkillId: { 323: "seq_horrorarcticblast" } },
  502: { defaultSeq: "seq_horrorarcticblast", bySkillId: { 323: "seq_horrorarcticblast" } },
  503: { defaultSeq: "seq_horrorarcticblast", bySkillId: { 323: "seq_horrorarcticblast" } },
  504: { defaultSeq: "seq_horrorarcticblast", bySkillId: { 323: "seq_horrorarcticblast" } },
  505: { defaultSeq: "seq_horrorarcticblast", bySkillId: { 323: "seq_horrorarcticblast" } },
  526: { defaultSeq: "seq_nihlathakarctic", bySkillId: { 323: "seq_nihlathakarctic" } },
  528: { defaultSeq: "seq_genericspawner", bySkillId: { 167: "seq_genericspawner" } },
  529: { defaultSeq: "seq_deathmaulerdig", bySkillId: { 308: "seq_deathmaulerdig" } },
  530: { defaultSeq: "seq_deathmaulerdig", bySkillId: { 308: "seq_deathmaulerdig" } },
  531: { defaultSeq: "seq_deathmaulerdig", bySkillId: { 308: "seq_deathmaulerdig" } },
  532: { defaultSeq: "seq_deathmaulerdig", bySkillId: { 308: "seq_deathmaulerdig" } },
  533: { defaultSeq: "seq_deathmaulerdig", bySkillId: { 308: "seq_deathmaulerdig" } },
  540: { defaultSeq: "seq_ancientwhirlwind", bySkillId: { 151: "seq_ancientwhirlwind" } },
  542: { defaultSeq: "seq_ancientleap", bySkillId: { 143: "seq_ancientleap" } },
  544: { defaultSeq: "seq_baalinferno", bySkillId: { 317: "seq_baalinferno" } },
  570: { defaultSeq: "seq_baalinferno", bySkillId: { 317: "seq_baalinferno" } },
  575: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  576: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  577: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  578: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  579: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  594: { defaultSeq: "seq_serpentcharge", bySkillId: { 107: "seq_serpentcharge" } },
  595: { defaultSeq: "seq_serpentcharge", bySkillId: { 107: "seq_serpentcharge" } },
  596: { defaultSeq: "seq_serpentcharge", bySkillId: { 107: "seq_serpentcharge" } },
  597: { defaultSeq: "seq_serpentcharge", bySkillId: { 107: "seq_serpentcharge" } },
  598: { defaultSeq: "seq_serpentcharge", bySkillId: { 107: "seq_serpentcharge" } },
  599: { defaultSeq: "seq_sandraiderflurry", bySkillId: { 156: "seq_sandraiderflurry" } },
  600: { defaultSeq: "seq_sandraiderflurry", bySkillId: { 156: "seq_sandraiderflurry" } },
  601: { defaultSeq: "seq_sandraiderflurry", bySkillId: { 156: "seq_sandraiderflurry" } },
  602: { defaultSeq: "seq_sandraiderflurry", bySkillId: { 156: "seq_sandraiderflurry" } },
  603: { defaultSeq: "seq_sandraiderflurry", bySkillId: { 156: "seq_sandraiderflurry" } },
  604: { defaultSeq: "seq_deathmaulerdig", bySkillId: { 308: "seq_deathmaulerdig" } },
  615: { defaultSeq: "seq_crlancerjab", bySkillId: { 10: "seq_crlancerjab" } },
  616: { defaultSeq: "seq_crlancerjab", bySkillId: { 10: "seq_crlancerjab" } },
  617: { defaultSeq: "seq_crlancerjab", bySkillId: { 10: "seq_crlancerjab" } },
  618: { defaultSeq: "seq_pinheadsmite", bySkillId: { 97: "seq_pinheadsmite" } },
  619: { defaultSeq: "seq_pinheadsmite", bySkillId: { 97: "seq_pinheadsmite" } },
  620: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  621: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  622: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  623: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  624: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  625: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  626: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  629: { defaultSeq: "seq_leaperleap", bySkillId: { 132: "seq_leaperleap" } },
  630: { defaultSeq: "seq_leaperleap", bySkillId: { 132: "seq_leaperleap" } },
  645: { defaultSeq: "seq_shamanresurrect", bySkillId: { 181: "seq_shamanresurrect", 348: "seq_shamanresurrect" } },
  646: { defaultSeq: "seq_shamanresurrect", bySkillId: { 181: "seq_shamanresurrect", 355: "seq_shamanresurrect" } },
  647: { defaultSeq: "seq_shamanresurrect", bySkillId: { 181: "seq_shamanresurrect", 355: "seq_shamanresurrect" } },
  648: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  649: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  654: { defaultSeq: "seq_scarabjab", bySkillId: { 10: "seq_scarabjab" } },
  655: { defaultSeq: "seq_scarabjab", bySkillId: { 10: "seq_scarabjab" } },
  656: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  657: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  658: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  659: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  660: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  661: { defaultSeq: "seq_fethisraise", bySkillId: { 158: "seq_fethisraise" } },
  662: { defaultSeq: "seq_fetishres", bySkillId: { 327: "seq_fetishres" } },
  663: { defaultSeq: "seq_fetishres", bySkillId: { 327: "seq_fetishres" } },
  664: { defaultSeq: "seq_fetishres", bySkillId: { 327: "seq_fetishres" } },
  667: { defaultSeq: "seq_mummyres", bySkillId: { 182: "seq_mummyres", 327: "seq_mummyres", 354: "seq_mummyres" } },
  668: { defaultSeq: "seq_mummyres", bySkillId: { 182: "seq_mummyres", 327: "seq_mummyres", 354: "seq_mummyres" } },
  669: { defaultSeq: "seq_mummyres", bySkillId: { 182: "seq_mummyres", 327: "seq_mummyres", 354: "seq_mummyres" } },
  670: { defaultSeq: "seq_mummyres", bySkillId: { 182: "seq_mummyres", 327: "seq_mummyres", 354: "seq_mummyres" } },
  675: { defaultSeq: "seq_vileres", bySkillId: { 167: "seq_vileres" } },
  676: { defaultSeq: "seq_vileres", bySkillId: { 167: "seq_vileres" } },
  679: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay" } },
  681: { defaultSeq: "seq_maggotegg", bySkillId: { 159: "seq_maggotegg" } },
  688: { defaultSeq: "seq_impinferno", bySkillId: { 282: "seq_impinferno" } },
  689: { defaultSeq: "seq_impinferno", bySkillId: { 282: "seq_impinferno" } },
  698: { defaultSeq: "seq_reanimatedcharge", bySkillId: { 107: "seq_reanimatedcharge" } },
  701: { defaultSeq: "seq_undeadbestow", bySkillId: { 182: "seq_undeadbestow" } },
  702: { defaultSeq: "seq_undeadbestow", bySkillId: { 182: "seq_undeadbestow" } },
  705: { defaultSeq: "seq_diablorun", bySkillId: { 198: "seq_diablorun" } },
  707: { defaultSeq: "seq_andarielspray", bySkillId: { 164: "seq_andarielspray" } },
  708: { defaultSeq: "seq_durielcharge", bySkillId: { 10: "seq_durieljab", 97: "seq_durielsmite", 107: "seq_durielcharge" } },
  709: { defaultSeq: "seq_baalinferno", bySkillId: { 317: "seq_baalinferno" } },
  713: { defaultSeq: "seq_undeadbestow", bySkillId: { 182: "seq_undeadbestow" } },
  714: { defaultSeq: "seq_impinferno", bySkillId: { 282: "seq_impinferno" } },
  715: { defaultSeq: "seq_swarmmove", bySkillId: { 166: "seq_swarmmove" } },
  716: { defaultSeq: "seq_maggotup", bySkillId: { 161: "seq_maggotup", 162: "seq_maggotdown", 163: "seq_maggotlay" } },
  718: { defaultSeq: "seq_scarabjab", bySkillId: { 10: "seq_scarabjab" } },
  723: { defaultSeq: "seq_crlancerjab", bySkillId: { 10: "seq_crlancerjab" } },
  724: { defaultSeq: "seq_genericspawner", bySkillId: { 97: "seq_genericspawner" } },
  725: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  726: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  727: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  728: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  729: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
  730: { defaultSeq: "seq_skeletonraise", bySkillId: { 158: "seq_skeletonraise" } },
})

/** Monster `hcIdx` -> (`skillId` -> `MONMODE_*` index) from 1.13c `MonStats.txt` (`Sk1mode..Sk8mode`) and `Hireling.txt` (`Mode1..Mode6`). */
export const MONSTER_CLASS_SKILL_MODES_113C: Readonly<Record<number, Readonly<Record<number, number>>>> = Object.freeze({
  0: { 158: 14 },
  1: { 158: 14 },
  2: { 158: 14 },
  3: { 158: 14 },
  4: { 158: 14 },
  29: { 156: 14 },
  30: { 156: 14 },
  31: { 156: 14 },
  32: { 156: 14 },
  33: { 156: 14 },
  45: { 321: 4 },
  58: { 160: 14, 181: 14 },
  59: { 160: 14, 181: 14 },
  60: { 160: 14, 181: 14 },
  61: { 160: 14, 181: 14 },
  62: { 160: 14, 181: 14 },
  68: { 161: 14, 162: 14, 163: 14 },
  69: { 161: 14, 162: 14, 163: 14 },
  70: { 161: 14, 162: 14, 163: 14 },
  71: { 161: 14, 162: 14, 163: 14 },
  72: { 161: 14, 162: 14, 163: 14 },
  73: { 352: 14 },
  74: { 352: 14 },
  75: { 352: 14 },
  76: { 352: 14 },
  77: { 352: 14 },
  78: { 132: 14 },
  79: { 132: 14 },
  80: { 132: 14 },
  81: { 132: 14 },
  82: { 132: 14 },
  87: { 166: 14 },
  88: { 166: 14 },
  89: { 166: 14 },
  90: { 166: 14 },
  91: { 10: 14 },
  92: { 10: 14 },
  93: { 10: 14 },
  94: { 10: 14 },
  95: { 10: 14 },
  101: { 157: 14, 182: 14, 327: 14 },
  102: { 157: 14, 182: 14, 327: 14 },
  103: { 157: 14, 182: 14, 327: 14 },
  104: { 157: 14, 182: 14, 327: 14 },
  105: { 157: 14, 182: 14, 327: 14 },
  114: { 206: 14 },
  115: { 206: 14 },
  116: { 206: 14 },
  117: { 206: 14 },
  118: { 53: 7 },
  119: { 53: 7 },
  120: { 53: 7 },
  121: { 53: 7 },
  122: { 173: 5 },
  123: { 173: 5 },
  124: { 173: 5 },
  125: { 173: 5 },
  126: { 173: 5 },
  127: { 215: 5 },
  128: { 215: 5 },
  129: { 215: 5 },
  130: { 215: 5 },
  131: { 169: 7, 170: 7, 171: 7, 333: 7 },
  132: { 169: 7, 170: 7, 171: 7, 333: 7 },
  133: { 169: 7, 170: 7, 171: 7, 333: 7 },
  134: { 169: 7, 170: 7, 171: 7, 333: 7 },
  135: { 169: 7, 170: 7, 171: 7, 333: 7 },
  141: { 158: 14 },
  142: { 158: 14 },
  143: { 158: 14 },
  144: { 158: 14 },
  145: { 158: 14 },
  153: { 213: 4 },
  156: { 164: 14, 201: 4 },
  186: { 97: 14 },
  187: { 97: 14 },
  188: { 97: 14 },
  189: { 97: 14 },
  190: { 159: 14 },
  191: { 159: 14 },
  192: { 159: 14 },
  193: { 159: 14 },
  194: { 159: 14 },
  203: { 10: 14 },
  206: { 167: 14 },
  207: { 167: 14 },
  208: { 167: 14 },
  209: { 167: 14 },
  211: { 10: 14, 97: 14, 107: 14, 114: 1 },
  228: { 167: 14 },
  229: { 157: 14, 182: 14, 327: 14 },
  234: { 107: 14 },
  238: { 179: 8, 184: 8, 205: 8, 332: 8 },
  239: { 179: 8, 184: 8, 205: 8, 332: 8 },
  240: { 179: 8, 184: 8, 205: 8, 332: 8 },
  241: { 179: 8, 184: 8, 205: 8, 332: 8 },
  242: { 59: 5, 185: 5, 186: 5, 192: 5, 334: 5, 346: 5 },
  243: { 188: 10, 193: 7, 194: 9, 195: 8, 197: 10, 198: 14, 199: 10 },
  247: { 176: 14, 180: 8 },
  248: { 176: 14, 180: 8 },
  249: { 176: 14, 180: 8 },
  250: { 44: 7, 47: 7, 55: 7, 72: 7, 170: 7 },
  256: { 44: 7 },
  258: { 176: 14, 180: 8 },
  259: { 176: 14, 180: 8 },
  260: { 176: 14, 180: 8 },
  261: { 176: 14, 180: 8 },
  262: { 176: 14, 180: 8 },
  263: { 176: 14, 180: 8 },
  267: { 167: 14, 168: 14 },
  271: { 7: 4, 8: 4, 11: 4, 336: 4 },
  273: { 172: 14 },
  274: { 158: 14 },
  275: { 158: 14 },
  276: { 158: 14 },
  277: { 158: 14 },
  278: { 177: 4, 178: 4, 327: 14 },
  279: { 177: 4, 178: 4, 327: 14 },
  280: { 177: 4, 178: 4, 327: 14 },
  281: { 177: 4, 178: 4, 327: 14 },
  282: { 177: 4, 178: 4, 327: 14 },
  284: { 161: 14, 162: 14, 163: 14, 216: 14 },
  285: { 161: 14, 162: 14, 163: 14, 216: 14 },
  286: { 161: 14, 162: 14, 163: 14, 216: 14 },
  287: { 161: 14, 162: 14, 163: 14, 216: 14 },
  288: { 161: 14, 162: 14, 163: 14, 216: 14 },
  290: { 85: 1 },
  298: { 167: 14 },
  299: { 167: 14 },
  300: { 167: 14 },
  304: { 196: 8 },
  305: { 196: 8 },
  306: { 196: 8 },
  307: { 214: 8 },
  308: { 214: 8 },
  309: { 214: 8 },
  311: { 210: 8, 211: 8, 335: 8 },
  312: { 87: 9, 182: 14, 210: 8, 211: 8, 212: 9, 335: 8 },
  321: { 167: 11 },
  322: { 167: 11 },
  323: { 167: 11 },
  324: { 167: 11 },
  325: { 167: 11 },
  327: { 200: 8, 207: 8 },
  328: { 200: 8, 208: 8 },
  329: { 192: 4 },
  331: { 10: 14 },
  333: { 188: 10, 193: 7, 194: 9, 195: 8, 197: 10, 198: 14, 199: 10, 349: 10 },
  334: { 167: 14 },
  335: { 167: 14 },
  336: { 167: 14 },
  337: { 167: 14 },
  338: { 10: 14, 98: 1, 99: 1, 103: 1, 104: 1, 108: 1, 114: 1 },
  344: { 78: 1 },
  345: { 62: 8, 179: 8 },
  346: { 62: 8, 179: 8 },
  347: { 62: 8, 179: 8 },
  348: { 203: 14 },
  349: { 203: 14 },
  350: { 203: 14 },
  351: { 337: 4 },
  352: { 337: 4 },
  353: { 337: 4 },
  358: { 10: 14 },
  360: { 319: 8 },
  361: { 319: 8 },
  362: { 319: 8 },
  364: { 338: 4 },
  369: { 353: 8 },
  371: { 49: 14, 204: 14 },
  372: { 203: 14 },
  377: { 10: 14 },
  378: { 10: 14 },
  379: { 158: 14 },
  380: { 158: 14 },
  381: { 158: 14 },
  382: { 158: 14 },
  383: { 158: 14 },
  384: { 158: 14 },
  385: { 158: 14 },
  386: { 158: 14 },
  387: { 158: 14 },
  388: { 158: 14 },
  389: { 158: 14 },
  390: { 158: 14 },
  396: { 158: 14 },
  397: { 158: 14 },
  398: { 158: 14 },
  399: { 158: 14 },
  400: { 158: 14 },
  407: { 158: 14 },
  410: { 281: 9 },
  411: { 256: 8, 306: 14 },
  412: { 313: 14 },
  413: { 257: 4 },
  415: { 262: 8, 311: 14 },
  416: { 312: 14, 324: 14 },
  417: { 0: 5, 259: 14, 260: 14, 266: 14, 269: 14, 274: 14, 275: 14 },
  418: { 0: 5, 259: 14, 260: 14, 266: 14, 269: 14, 274: 14, 275: 14 },
  419: { 221: 1 },
  420: { 292: 8 },
  421: { 292: 8, 314: 4 },
  425: { 294: 8 },
  426: { 307: 8 },
  427: { 325: 8 },
  428: { 326: 14 },
  436: { 107: 14, 293: 8 },
  437: { 107: 14, 293: 8 },
  438: { 107: 14, 293: 8 },
  439: { 107: 14, 293: 8 },
  440: { 107: 14, 293: 8 },
  441: { 107: 14, 301: 5 },
  442: { 107: 14, 301: 5 },
  443: { 107: 14, 301: 5 },
  444: { 107: 14, 301: 5 },
  445: { 107: 14, 301: 5 },
  469: { 309: 9, 310: 9, 345: 9 },
  470: { 309: 9, 310: 9, 345: 9 },
  471: { 309: 9, 310: 9, 345: 9 },
  472: { 309: 9, 310: 9, 345: 9 },
  473: { 309: 9, 310: 9, 345: 9 },
  474: { 66: 9, 72: 9, 309: 9, 310: 9, 345: 9 },
  475: { 66: 9, 72: 9, 309: 9, 310: 9, 345: 9 },
  476: { 66: 9, 72: 9, 309: 9, 310: 9, 345: 9 },
  477: { 66: 9, 72: 9, 309: 9, 310: 9, 345: 9 },
  478: { 66: 9, 72: 9, 309: 9, 310: 9, 345: 9 },
  479: { 97: 14, 290: 8, 291: 9, 295: 5 },
  480: { 97: 14, 290: 8, 291: 9, 295: 5 },
  481: { 97: 14, 290: 8, 291: 9, 295: 5 },
  482: { 97: 14, 290: 8, 291: 9, 295: 5 },
  483: { 97: 14, 290: 8, 291: 9, 295: 5 },
  484: { 302: 4 },
  485: { 302: 4 },
  486: { 302: 4 },
  487: { 302: 4 },
  488: { 302: 4 },
  489: { 302: 4 },
  490: { 302: 4 },
  491: { 302: 4 },
  492: { 282: 7, 283: 9, 299: 4, 322: 9, 330: 8 },
  493: { 282: 7, 283: 9, 299: 4, 322: 9, 330: 8 },
  494: { 282: 7, 283: 9, 299: 4, 322: 9, 330: 8 },
  495: { 282: 7, 283: 9, 299: 4, 322: 9, 330: 8 },
  496: { 282: 7, 283: 9, 299: 4, 322: 9, 330: 8 },
  501: { 323: 14 },
  502: { 323: 14 },
  503: { 323: 14 },
  504: { 323: 14 },
  505: { 323: 14 },
  506: { 328: 5 },
  507: { 328: 5 },
  508: { 328: 5 },
  509: { 328: 5 },
  510: { 328: 5 },
  516: { 287: 4, 288: 4, 303: 4, 304: 4, 305: 4 },
  517: { 287: 4, 288: 4, 303: 4, 304: 4, 305: 4 },
  518: { 287: 4, 288: 4, 303: 4, 304: 4, 305: 4 },
  519: { 287: 4, 288: 4, 303: 4, 304: 4, 305: 4 },
  526: { 295: 5, 302: 4, 323: 14, 330: 4, 351: 4 },
  528: { 167: 14 },
  529: { 308: 14 },
  530: { 308: 14 },
  531: { 308: 14 },
  532: { 308: 14 },
  533: { 308: 14 },
  537: { 302: 4 },
  538: { 302: 4 },
  539: { 302: 4 },
  540: { 151: 14 },
  541: { 138: 7 },
  542: { 143: 14 },
  543: { 87: 10, 285: 10, 309: 10, 310: 10 },
  544: { 309: 10, 310: 10, 315: 9, 316: 10, 317: 14, 318: 4, 329: 4 },
  545: { 284: 4 },
  546: { 300: 8 },
  547: { 300: 8 },
  548: { 300: 8 },
  549: { 300: 8 },
  550: { 300: 8 },
  557: { 62: 8, 179: 8 },
  558: { 319: 8 },
  570: { 309: 10, 310: 10, 315: 9, 316: 10, 317: 14, 318: 4, 331: 4 },
  571: { 97: 5 },
  572: { 97: 5 },
  573: { 97: 5 },
  574: { 284: 4 },
  575: { 158: 14 },
  576: { 158: 14 },
  577: { 158: 14 },
  578: { 158: 14 },
  579: { 158: 14 },
  594: { 107: 14 },
  595: { 107: 14 },
  596: { 107: 14 },
  597: { 107: 14 },
  598: { 107: 14 },
  599: { 156: 14 },
  600: { 156: 14 },
  601: { 156: 14 },
  602: { 156: 14 },
  603: { 156: 14 },
  604: { 308: 14 },
  609: { 215: 5 },
  613: { 339: 4, 340: 4, 342: 4 },
  614: { 339: 4, 341: 4, 343: 4 },
  615: { 10: 14, 344: 4 },
  616: { 10: 14, 347: 4 },
  617: { 10: 14, 344: 4 },
  618: { 97: 14 },
  619: { 97: 14 },
  620: { 158: 14 },
  621: { 158: 14 },
  622: { 158: 14 },
  623: { 158: 14 },
  624: { 158: 14 },
  625: { 158: 14 },
  626: { 158: 14 },
  629: { 132: 14 },
  630: { 132: 14 },
  634: { 309: 9, 310: 9, 345: 9 },
  635: { 309: 9, 310: 9, 345: 9 },
  636: { 66: 9, 72: 9, 309: 9, 310: 9, 345: 9 },
  637: { 66: 9, 72: 9, 309: 9, 310: 9, 345: 9 },
  638: { 66: 9, 72: 9, 309: 9, 310: 9, 345: 9 },
  639: { 53: 7 },
  640: { 53: 7 },
  641: { 53: 7 },
  645: { 181: 14, 348: 14 },
  646: { 181: 14, 355: 14 },
  647: { 181: 14, 355: 14 },
  648: { 158: 14 },
  649: { 158: 14 },
  652: { 328: 5 },
  653: { 328: 5 },
  654: { 10: 14 },
  655: { 10: 14 },
  656: { 158: 14 },
  657: { 158: 14 },
  658: { 158: 14 },
  659: { 158: 14 },
  660: { 158: 14 },
  661: { 158: 14 },
  662: { 177: 4, 178: 4, 327: 14 },
  663: { 177: 4, 178: 4, 327: 14 },
  664: { 177: 4, 178: 4, 327: 14 },
  667: { 182: 14, 327: 14, 354: 14 },
  668: { 182: 14, 327: 14, 354: 14 },
  669: { 182: 14, 327: 14, 354: 14 },
  670: { 182: 14, 327: 14, 354: 14 },
  673: { 179: 8, 184: 8, 205: 8, 332: 8 },
  674: { 179: 8, 184: 8, 205: 8, 332: 8 },
  675: { 167: 14 },
  676: { 167: 14 },
  679: { 161: 14, 162: 14, 163: 14 },
  681: { 159: 14 },
  685: { 173: 5 },
  686: { 319: 8 },
  687: { 319: 8 },
  688: { 282: 14, 283: 9, 322: 9, 330: 8, 356: 4 },
  689: { 282: 14, 283: 9, 322: 9, 330: 8, 356: 4 },
  692: { 196: 8 },
  693: { 196: 8 },
  694: { 214: 8 },
  695: { 169: 7, 170: 7, 171: 7, 333: 7 },
  696: { 169: 7, 170: 7, 171: 7, 333: 7 },
  697: { 169: 7, 170: 7, 171: 7, 333: 7 },
  698: { 107: 14, 293: 8 },
  701: { 87: 9, 182: 14, 210: 8, 211: 8, 212: 9, 335: 8 },
  702: { 87: 9, 182: 14, 210: 8, 211: 8, 212: 9, 335: 8 },
  704: { 59: 5, 185: 5, 186: 5, 192: 5, 334: 5, 346: 5 },
  705: { 188: 10, 193: 7, 194: 9, 195: 8, 197: 10, 198: 14, 199: 10, 349: 10 },
  706: { 44: 7, 60: 7, 184: 7 },
  707: { 164: 14, 201: 4 },
  708: { 10: 14, 97: 14, 107: 14, 114: 1 },
  709: { 60: 4, 309: 10, 310: 10, 315: 9, 316: 10, 317: 14, 318: 4, 329: 4 },
  710: { 302: 4 },
  711: { 167: 11 },
  712: { 319: 8 },
  713: { 87: 9, 182: 14, 210: 8, 211: 8, 212: 9, 335: 8 },
  714: { 282: 14, 283: 9, 322: 9, 330: 8, 356: 4 },
  715: { 166: 14 },
  716: { 161: 14, 162: 14, 163: 14 },
  717: { 173: 5 },
  718: { 10: 14 },
  719: { 309: 9, 310: 9, 345: 9 },
  720: { 66: 9, 72: 9, 309: 9, 310: 9, 345: 9 },
  722: { 339: 4, 341: 4, 343: 4 },
  723: { 10: 14, 344: 4 },
  724: { 97: 14, 290: 8, 291: 9, 295: 5 },
  725: { 158: 14 },
  726: { 158: 14 },
  727: { 158: 14 },
  728: { 158: 14 },
  729: { 158: 14 },
  730: { 158: 14 },
  731: { 169: 7, 170: 7, 171: 7, 333: 7 },
  733: { 53: 7 },
  359: { 38: 7, 40: 7, 41: 7, 45: 7, 47: 7, 49: 7, 55: 7 },
  561: { 126: 5, 139: 5 },
  560: { 126: 5, 139: 5 },
})

/**
 * Per `hcIdx` (`0..733`) * 16 modes (`0..15`): authoritative 1.13c `AnimData.d2` `framesPerDirection`
 * (with `MONMODE_SEQUENCE (14)` populated from the monster's primary `monseq.txt` sequence length).
 */
export const MONSTER_MODE_FRAME_COUNT_113C: readonly number[] = Object.freeze([
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 0 skeleton1
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 1 skeleton2
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 2 skeleton3
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 3 skeleton4
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 4 skeleton5
  19, 8, 12, 5, 16, 16, 6, 16, 16, 24, 12, 12, 1, 5, 16, 8, // 5 zombie1
  19, 8, 12, 5, 16, 16, 6, 16, 16, 24, 12, 12, 1, 5, 16, 8, // 6 zombie2
  19, 8, 12, 5, 16, 16, 6, 16, 16, 24, 12, 12, 1, 5, 16, 8, // 7 zombie3
  19, 8, 12, 5, 16, 16, 6, 16, 16, 24, 12, 12, 1, 5, 16, 8, // 8 zombie4
  19, 8, 12, 5, 16, 16, 6, 16, 16, 24, 12, 12, 1, 5, 16, 8, // 9 zombie5
  19, 8, 8, 8, 8, 10, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 10 bighead1
  19, 8, 8, 8, 8, 10, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 11 bighead2
  19, 8, 8, 8, 8, 10, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 12 bighead3
  19, 8, 8, 8, 8, 10, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 13 bighead4
  19, 8, 8, 8, 8, 10, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 14 bighead5
  23, 11, 8, 5, 11, 11, 6, 11, 12, 12, 12, 12, 1, 5, 11, 8, // 15 foulcrow1
  23, 11, 8, 5, 11, 11, 6, 11, 12, 12, 12, 12, 1, 5, 11, 8, // 16 foulcrow2
  23, 11, 8, 5, 11, 11, 6, 11, 12, 12, 12, 12, 1, 5, 11, 8, // 17 foulcrow3
  23, 11, 8, 5, 11, 11, 6, 11, 12, 12, 12, 12, 1, 5, 11, 8, // 18 foulcrow4
  20, 20, 10, 7, 10, 15, 5, 10, 24, 18, 12, 12, 1, 7, 10, 10, // 19 fallen1
  20, 20, 10, 7, 10, 15, 5, 10, 24, 18, 12, 12, 1, 7, 10, 10, // 20 fallen2
  20, 20, 10, 7, 10, 15, 5, 10, 24, 18, 12, 12, 1, 7, 10, 10, // 21 fallen3
  20, 20, 10, 7, 10, 15, 5, 10, 24, 18, 12, 12, 1, 7, 10, 10, // 22 fallen4
  20, 20, 10, 7, 10, 15, 5, 10, 24, 18, 12, 12, 1, 7, 10, 10, // 23 fallen5
  18, 8, 12, 6, 12, 18, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 24 brute2
  18, 8, 12, 6, 12, 18, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 25 brute3
  18, 8, 12, 6, 12, 18, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 26 brute4
  18, 8, 12, 6, 12, 18, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 27 brute5
  18, 8, 12, 6, 12, 18, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 28 brute1
  18, 15, 29, 10, 15, 15, 6, 15, 11, 12, 12, 12, 1, 10, 10, 29, // 29 sandraider1
  18, 15, 29, 10, 15, 15, 6, 15, 11, 12, 12, 12, 1, 10, 10, 29, // 30 sandraider2
  18, 15, 29, 10, 15, 15, 6, 15, 11, 12, 12, 12, 1, 10, 10, 29, // 31 sandraider3
  18, 15, 29, 10, 15, 15, 6, 15, 11, 12, 12, 12, 1, 10, 10, 29, // 32 sandraider4
  18, 15, 29, 10, 15, 15, 6, 15, 11, 12, 12, 12, 1, 10, 10, 29, // 33 sandraider5
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 34 gorgon1
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 35 gorgon2
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 36 gorgon3
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 37 gorgon4
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 38 wraith1
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 39 wraith2
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 40 wraith3
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 41 wraith4
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 42 wraith5
  24, 13, 12, 9, 16, 16, 7, 16, 12, 12, 12, 12, 1, 9, 16, 10, // 43 corruptrogue1
  24, 13, 12, 9, 16, 16, 7, 16, 12, 12, 12, 12, 1, 9, 16, 10, // 44 corruptrogue2
  24, 13, 12, 9, 16, 16, 7, 16, 12, 12, 12, 12, 1, 9, 16, 10, // 45 corruptrogue3
  24, 13, 12, 9, 16, 16, 7, 16, 12, 12, 12, 12, 1, 9, 16, 10, // 46 corruptrogue4
  24, 13, 12, 9, 16, 16, 7, 16, 12, 12, 12, 12, 1, 9, 16, 10, // 47 corruptrogue5
  16, 16, 10, 10, 12, 14, 6, 12, 12, 12, 12, 12, 1, 10, 12, 10, // 48 baboon1
  16, 16, 10, 10, 12, 14, 6, 12, 12, 12, 12, 12, 1, 10, 12, 10, // 49 baboon2
  16, 16, 10, 10, 12, 14, 6, 12, 12, 12, 12, 12, 1, 10, 12, 10, // 50 baboon3
  16, 16, 10, 10, 12, 14, 6, 12, 12, 12, 12, 12, 1, 10, 12, 10, // 51 baboon4
  16, 16, 10, 10, 12, 14, 6, 12, 12, 12, 12, 12, 1, 10, 12, 10, // 52 baboon5
  19, 10, 8, 6, 20, 16, 6, 20, 12, 12, 12, 12, 1, 6, 20, 8, // 53 goatman1
  19, 10, 8, 6, 20, 16, 6, 20, 12, 12, 12, 12, 1, 6, 20, 8, // 54 goatman2
  19, 10, 8, 6, 20, 16, 6, 20, 12, 12, 12, 12, 1, 6, 20, 8, // 55 goatman3
  19, 10, 8, 6, 20, 16, 6, 20, 12, 12, 12, 12, 1, 6, 20, 8, // 56 goatman4
  19, 10, 8, 6, 20, 16, 6, 20, 12, 12, 12, 12, 1, 6, 20, 8, // 57 goatman5
  21, 12, 14, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 14, // 58 fallenshaman1
  21, 12, 14, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 14, // 59 fallenshaman2
  21, 12, 14, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 14, // 60 fallenshaman3
  21, 12, 14, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 14, // 61 fallenshaman4
  21, 12, 14, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 14, // 62 fallenshaman5
  14, 8, 9, 6, 16, 13, 6, 16, 12, 12, 12, 12, 1, 6, 16, 9, // 63 quillrat1
  14, 8, 9, 6, 16, 13, 6, 16, 12, 12, 12, 12, 1, 6, 16, 9, // 64 quillrat2
  14, 8, 9, 6, 16, 13, 6, 16, 12, 12, 12, 12, 1, 6, 16, 9, // 65 quillrat3
  14, 8, 9, 6, 16, 13, 6, 16, 12, 12, 12, 12, 1, 6, 16, 9, // 66 quillrat4
  14, 8, 9, 6, 16, 13, 6, 16, 12, 12, 12, 12, 1, 6, 16, 9, // 67 quillrat5
  16, 8, 8, 6, 18, 10, 6, 18, 12, 12, 12, 12, 1, 6, 12, 8, // 68 sandmaggot1
  16, 8, 8, 6, 18, 10, 6, 18, 12, 12, 12, 12, 1, 6, 12, 8, // 69 sandmaggot2
  16, 8, 8, 6, 18, 10, 6, 18, 12, 12, 12, 12, 1, 6, 12, 8, // 70 sandmaggot3
  16, 8, 8, 6, 18, 10, 6, 18, 12, 12, 12, 12, 1, 6, 12, 8, // 71 sandmaggot4
  16, 8, 8, 6, 18, 10, 6, 18, 12, 12, 12, 12, 1, 6, 12, 8, // 72 sandmaggot5
  19, 8, 16, 5, 14, 13, 6, 14, 12, 12, 12, 12, 1, 5, 14, 16, // 73 clawviper1
  19, 8, 16, 5, 14, 13, 6, 14, 12, 12, 12, 12, 1, 5, 14, 16, // 74 clawviper2
  19, 8, 16, 5, 14, 13, 6, 14, 12, 12, 12, 12, 1, 5, 14, 16, // 75 clawviper3
  19, 8, 16, 5, 14, 13, 6, 14, 12, 12, 12, 12, 1, 5, 14, 16, // 76 clawviper4
  19, 8, 16, 5, 14, 13, 6, 14, 12, 12, 12, 12, 1, 5, 14, 16, // 77 clawviper5
  21, 11, 9, 16, 20, 9, 6, 20, 12, 12, 12, 12, 1, 16, 20, 9, // 78 sandleaper1
  21, 11, 9, 16, 20, 9, 6, 20, 12, 12, 12, 12, 1, 16, 20, 9, // 79 sandleaper2
  21, 11, 9, 16, 20, 9, 6, 20, 12, 12, 12, 12, 1, 16, 20, 9, // 80 sandleaper3
  21, 11, 9, 16, 20, 9, 6, 20, 12, 12, 12, 12, 1, 16, 20, 9, // 81 sandleaper4
  21, 11, 9, 16, 20, 9, 6, 20, 12, 12, 12, 12, 1, 16, 20, 9, // 82 sandleaper5
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 83 pantherwoman1
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 84 pantherwoman2
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 85 pantherwoman3
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 86 pantherwoman4
  15, 10, 10, 8, 20, 20, 6, 20, 12, 12, 12, 12, 1, 8, 8, 10, // 87 swarm1
  15, 10, 10, 8, 20, 20, 6, 20, 12, 12, 12, 12, 1, 8, 8, 10, // 88 swarm2
  15, 10, 10, 8, 20, 20, 6, 20, 12, 12, 12, 12, 1, 8, 8, 10, // 89 swarm3
  15, 10, 10, 8, 20, 20, 6, 20, 12, 12, 12, 12, 1, 8, 8, 10, // 90 swarm4
  20, 8, 14, 6, 16, 14, 6, 16, 12, 12, 12, 12, 1, 6, 13, 14, // 91 scarab1
  20, 8, 14, 6, 16, 14, 6, 16, 12, 12, 12, 12, 1, 6, 13, 14, // 92 scarab2
  20, 8, 14, 6, 16, 14, 6, 16, 12, 12, 12, 12, 1, 6, 13, 14, // 93 scarab3
  20, 8, 14, 6, 16, 14, 6, 16, 12, 12, 12, 12, 1, 6, 13, 14, // 94 scarab4
  20, 8, 14, 6, 16, 14, 6, 16, 12, 12, 12, 12, 1, 6, 13, 14, // 95 scarab5
  22, 14, 12, 6, 18, 16, 6, 18, 19, 12, 12, 12, 1, 6, 18, 12, // 96 mummy1
  22, 14, 12, 6, 18, 16, 6, 18, 19, 12, 12, 12, 1, 6, 18, 12, // 97 mummy2
  22, 14, 12, 6, 18, 16, 6, 18, 19, 12, 12, 12, 1, 6, 18, 12, // 98 mummy3
  22, 14, 12, 6, 18, 16, 6, 18, 19, 12, 12, 12, 1, 6, 18, 12, // 99 mummy4
  22, 14, 12, 6, 18, 16, 6, 18, 19, 12, 12, 12, 1, 6, 18, 12, // 100 mummy5
  20, 12, 18, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 101 unraveler1
  20, 12, 18, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 102 unraveler2
  20, 12, 18, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 103 unraveler3
  20, 12, 18, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 104 unraveler4
  20, 12, 18, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 105 unraveler5
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 106 chaoshorde1
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 107 chaoshorde2
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 108 chaoshorde3
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 109 chaoshorde4
  17, 16, 16, 7, 12, 12, 6, 12, 12, 12, 12, 12, 1, 7, 12, 16, // 110 vulture1
  17, 16, 16, 7, 12, 12, 6, 12, 12, 12, 12, 12, 1, 7, 12, 16, // 111 vulture2
  17, 16, 16, 7, 12, 12, 6, 12, 12, 12, 12, 12, 1, 7, 12, 16, // 112 vulture3
  17, 16, 16, 7, 12, 12, 6, 12, 12, 12, 12, 12, 1, 7, 12, 16, // 113 vulture4
  23, 10, 8, 7, 12, 26, 6, 12, 12, 12, 12, 12, 1, 7, 26, 8, // 114 mosquito1
  23, 10, 8, 7, 12, 26, 6, 12, 12, 12, 12, 12, 1, 7, 26, 8, // 115 mosquito2
  23, 10, 8, 7, 12, 26, 6, 12, 12, 12, 12, 12, 1, 7, 26, 8, // 116 mosquito3
  23, 10, 8, 7, 12, 26, 6, 12, 12, 12, 12, 12, 1, 7, 26, 8, // 117 mosquito4
  9, 9, 1, 5, 10, 10, 6, 9, 9, 12, 12, 12, 1, 5, 10, 1, // 118 willowisp1
  9, 9, 1, 5, 10, 10, 6, 9, 9, 12, 12, 12, 1, 5, 10, 1, // 119 willowisp2
  9, 9, 1, 5, 10, 10, 6, 9, 9, 12, 12, 12, 1, 5, 10, 1, // 120 willowisp3
  9, 9, 1, 5, 10, 10, 6, 9, 9, 12, 12, 12, 1, 5, 10, 1, // 121 willowisp4
  17, 13, 12, 7, 11, 13, 6, 11, 12, 12, 12, 12, 1, 7, 11, 12, // 122 arach1
  17, 13, 12, 7, 11, 13, 6, 11, 12, 12, 12, 12, 1, 7, 11, 12, // 123 arach2
  17, 13, 12, 7, 11, 13, 6, 11, 12, 12, 12, 12, 1, 7, 11, 12, // 124 arach3
  17, 13, 12, 7, 11, 13, 6, 11, 12, 12, 12, 12, 1, 7, 11, 12, // 125 arach4
  17, 13, 12, 7, 11, 13, 6, 11, 12, 12, 12, 12, 1, 7, 11, 12, // 126 arach5
  23, 12, 14, 4, 10, 16, 6, 10, 12, 12, 12, 12, 1, 4, 10, 14, // 127 thornhulk1
  23, 12, 14, 4, 10, 16, 6, 10, 12, 12, 12, 12, 1, 4, 10, 14, // 128 thornhulk2
  23, 12, 14, 4, 10, 16, 6, 10, 12, 12, 12, 12, 1, 4, 10, 14, // 129 thornhulk3
  23, 12, 14, 4, 10, 16, 6, 10, 12, 12, 12, 12, 1, 4, 10, 14, // 130 thornhulk4
  19, 15, 18, 4, 14, 14, 6, 15, 12, 12, 12, 12, 1, 4, 14, 18, // 131 vampire1
  19, 15, 18, 4, 14, 14, 6, 15, 12, 12, 12, 12, 1, 4, 14, 18, // 132 vampire2
  19, 15, 18, 4, 14, 14, 6, 15, 12, 12, 12, 12, 1, 4, 14, 18, // 133 vampire3
  19, 15, 18, 4, 14, 14, 6, 15, 12, 12, 12, 12, 1, 4, 14, 18, // 134 vampire4
  19, 15, 18, 4, 14, 14, 6, 15, 12, 12, 12, 12, 1, 4, 14, 18, // 135 vampire5
  16, 11, 8, 4, 10, 14, 6, 10, 12, 11, 11, 1, 1, 4, 10, 8, // 136 batdemon1
  16, 11, 8, 4, 10, 14, 6, 10, 12, 11, 11, 1, 1, 4, 10, 8, // 137 batdemon2
  16, 11, 8, 4, 10, 14, 6, 10, 12, 11, 11, 1, 1, 4, 10, 8, // 138 batdemon3
  16, 11, 8, 4, 10, 14, 6, 10, 12, 11, 11, 1, 1, 4, 10, 8, // 139 batdemon4
  16, 11, 8, 4, 10, 14, 6, 10, 12, 11, 11, 1, 1, 4, 10, 8, // 140 batdemon5
  18, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 18, 6, // 141 fetish1
  18, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 18, 6, // 142 fetish2
  18, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 18, 6, // 143 fetish3
  18, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 18, 6, // 144 fetish4
  18, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 18, 6, // 145 fetish5
  3, 16, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 146 cain1
  8, 8, 8, 8, 8, 8, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 147 gheed
  13, 13, 8, 13, 13, 13, 6, 13, 12, 12, 12, 12, 1, 13, 13, 8, // 148 akara
  12, 6, 8, 6, 10, 10, 6, 10, 9, 12, 12, 12, 1, 6, 10, 8, // 149 chicken
  12, 12, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 150 kashya
  1, 6, 4, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 4, // 151 rat
  17, 24, 13, 6, 15, 15, 6, 15, 21, 12, 12, 12, 1, 6, 15, 10, // 152 rogue1
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 153 hellmeteor
  12, 13, 8, 6, 10, 10, 6, 10, 129, 12, 12, 12, 1, 6, 10, 8, // 154 charsi
  12, 16, 12, 12, 12, 12, 6, 12, 108, 12, 12, 12, 1, 12, 12, 12, // 155 warriv1
  23, 16, 12, 6, 16, 16, 6, 18, 12, 12, 12, 12, 1, 6, 18, 12, // 156 andariel
  12, 1, 8, 6, 10, 10, 6, 10, 1, 12, 12, 12, 1, 6, 10, 8, // 157 bird1
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 158 bird2
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 159 bat
  24, 13, 12, 9, 13, 13, 6, 13, 20, 12, 12, 12, 1, 9, 13, 10, // 160 cr_archer1
  24, 13, 12, 9, 13, 13, 6, 13, 20, 12, 12, 12, 1, 9, 13, 10, // 161 cr_archer2
  24, 13, 12, 9, 13, 13, 6, 13, 20, 12, 12, 12, 1, 9, 13, 10, // 162 cr_archer3
  24, 13, 12, 9, 13, 13, 6, 13, 20, 12, 12, 12, 1, 9, 13, 10, // 163 cr_archer4
  24, 13, 12, 9, 13, 13, 6, 13, 20, 12, 12, 12, 1, 9, 13, 10, // 164 cr_archer5
  24, 13, 12, 9, 18, 18, 6, 18, 12, 12, 12, 12, 1, 9, 18, 10, // 165 cr_lancer1
  24, 13, 12, 9, 18, 18, 6, 18, 12, 12, 12, 12, 1, 9, 18, 10, // 166 cr_lancer2
  24, 13, 12, 9, 18, 18, 6, 18, 12, 12, 12, 12, 1, 9, 18, 10, // 167 cr_lancer3
  24, 13, 12, 9, 18, 18, 6, 18, 12, 12, 12, 12, 1, 9, 18, 10, // 168 cr_lancer4
  24, 13, 12, 9, 18, 18, 6, 18, 12, 12, 12, 12, 1, 9, 18, 10, // 169 cr_lancer5
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 16, 8, // 170 sk_archer1
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 16, 8, // 171 sk_archer2
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 16, 8, // 172 sk_archer3
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 16, 8, // 173 sk_archer4
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 16, 8, // 174 sk_archer5
  12, 8, 12, 6, 10, 10, 6, 10, 91, 12, 12, 12, 1, 6, 10, 12, // 175 warriv2
  7, 8, 8, 6, 10, 10, 6, 10, 81, 12, 12, 12, 1, 6, 10, 8, // 176 atma
  12, 8, 8, 6, 10, 10, 6, 10, 101, 12, 12, 12, 1, 6, 10, 8, // 177 drognan
  12, 12, 16, 6, 10, 10, 6, 10, 51, 12, 12, 12, 1, 6, 10, 16, // 178 fara
  12, 10, 10, 6, 10, 10, 6, 10, 10, 12, 12, 12, 1, 6, 10, 10, // 179 cow
  16, 8, 8, 6, 18, 10, 6, 12, 12, 12, 12, 12, 1, 6, 18, 8, // 180 maggotbaby1
  16, 8, 8, 6, 18, 10, 6, 12, 12, 12, 12, 12, 1, 6, 18, 8, // 181 maggotbaby2
  16, 8, 8, 6, 18, 10, 6, 12, 12, 12, 12, 12, 1, 6, 18, 8, // 182 maggotbaby3
  16, 8, 8, 6, 18, 10, 6, 12, 12, 12, 12, 12, 1, 6, 18, 8, // 183 maggotbaby4
  16, 8, 8, 6, 18, 10, 6, 12, 12, 12, 12, 12, 1, 6, 18, 8, // 184 maggotbaby5
  12, 12, 10, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 10, // 185 camel
  23, 8, 8, 7, 15, 15, 6, 15, 12, 12, 12, 12, 1, 7, 15, 8, // 186 blunderbore1
  23, 8, 8, 7, 15, 15, 6, 15, 12, 12, 12, 12, 1, 7, 15, 8, // 187 blunderbore2
  23, 8, 8, 7, 15, 15, 6, 15, 12, 12, 12, 12, 1, 7, 15, 8, // 188 blunderbore3
  23, 8, 8, 7, 15, 15, 6, 15, 12, 12, 12, 12, 1, 7, 15, 8, // 189 blunderbore4
  24, 16, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 14, 8, // 190 maggotegg1
  24, 16, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 14, 8, // 191 maggotegg2
  24, 16, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 14, 8, // 192 maggotegg3
  24, 16, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 14, 8, // 193 maggotegg4
  24, 16, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 14, 8, // 194 maggotegg5
  12, 6, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 195 act2male
  12, 6, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 196 act2female
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 197 act2child
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 198 greiz
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 199 elzix
  12, 12, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 200 geglash
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 201 jerhyn
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 202 lysander
  19, 8, 8, 8, 16, 16, 6, 16, 12, 12, 12, 12, 1, 8, 14, 13, // 203 act2guard1
  12, 6, 8, 6, 10, 10, 6, 10, 9, 12, 12, 12, 1, 6, 10, 8, // 204 act2vendor1
  12, 6, 8, 6, 10, 10, 6, 10, 9, 12, 12, 12, 1, 6, 10, 8, // 205 act2vendor2
  21, 21, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 31, 8, // 206 crownest1
  21, 21, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 31, 8, // 207 crownest2
  21, 21, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 31, 8, // 208 crownest3
  21, 21, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 31, 8, // 209 crownest4
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 210 meshif1
  25, 12, 16, 6, 10, 15, 6, 10, 12, 12, 12, 12, 1, 6, 31, 16, // 211 duriel
  15, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 12, 6, // 212 bonefetish1
  15, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 12, 6, // 213 bonefetish2
  15, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 12, 6, // 214 bonefetish3
  15, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 12, 6, // 215 bonefetish4
  15, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 12, 6, // 216 bonefetish5
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 217 darkguard1
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 218 darkguard2
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 219 darkguard3
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 220 darkguard4
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 221 darkguard5
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 222 bloodmage1
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 223 bloodmage2
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 224 bloodmage3
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 225 bloodmage4
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 226 bloodmage5
  1, 8, 6, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 6, // 227 maggot
  20, 1, 8, 6, 10, 10, 6, 10, 20, 12, 12, 12, 1, 6, 20, 8, // 228 sarcophagus
  20, 12, 18, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 229 radament
  1, 12, 12, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 12, // 230 firebeast
  1, 12, 12, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 12, // 231 iceglobe
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 232 lightningbeast
  1, 12, 12, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 12, // 233 poisonorb
  16, 8, 6, 6, 12, 12, 6, 12, 10, 12, 12, 12, 1, 6, 15, 6, // 234 flyingscimitar
  18, 10, 8, 5, 15, 11, 6, 15, 12, 12, 12, 12, 1, 5, 15, 8, // 235 zealot1
  18, 10, 8, 5, 15, 11, 6, 15, 12, 12, 12, 12, 1, 5, 15, 8, // 236 zealot2
  18, 10, 8, 5, 15, 11, 6, 15, 12, 12, 12, 12, 1, 5, 15, 8, // 237 zealot3
  23, 8, 8, 5, 14, 14, 6, 14, 10, 12, 12, 12, 1, 5, 14, 8, // 238 cantor1
  23, 8, 8, 5, 14, 14, 6, 14, 10, 12, 12, 12, 1, 5, 14, 8, // 239 cantor2
  23, 8, 8, 5, 14, 14, 6, 14, 10, 12, 12, 12, 1, 5, 14, 8, // 240 cantor3
  23, 8, 8, 5, 14, 14, 6, 14, 10, 12, 12, 12, 1, 5, 14, 8, // 241 cantor4
  25, 13, 13, 6, 18, 17, 6, 18, 12, 12, 12, 12, 1, 6, 18, 13, // 242 mephisto
  142, 12, 12, 6, 16, 20, 9, 17, 18, 16, 16, 15, 1, 6, 22, 22, // 243 diablo
  3, 16, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 244 cain2
  3, 16, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 245 cain3
  3, 16, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 246 cain4
  14, 7, 16, 4, 15, 13, 6, 15, 16, 12, 12, 12, 1, 4, 3, 16, // 247 frogdemon1
  14, 7, 16, 4, 15, 13, 6, 15, 16, 12, 12, 12, 1, 4, 3, 16, // 248 frogdemon2
  14, 7, 16, 4, 15, 13, 6, 15, 16, 12, 12, 12, 1, 4, 3, 16, // 249 frogdemon3
  16, 8, 8, 3, 10, 10, 6, 12, 8, 12, 12, 12, 1, 3, 10, 8, // 250 summoner
  3, 60, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 251 tyrael1
  12, 31, 10, 12, 12, 12, 6, 12, 71, 12, 12, 12, 1, 12, 12, 10, // 252 asheara
  12, 16, 10, 12, 12, 12, 6, 12, 12, 12, 12, 12, 1, 12, 12, 10, // 253 hratli
  12, 14, 8, 12, 12, 12, 6, 12, 16, 12, 12, 12, 1, 12, 12, 8, // 254 alkor
  12, 14, 8, 12, 12, 12, 6, 12, 16, 12, 12, 12, 1, 12, 12, 8, // 255 ormus
  20, 8, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 256 izual
  12, 12, 12, 6, 10, 10, 6, 10, 111, 12, 12, 12, 1, 6, 10, 12, // 257 halbu
  17, 12, 8, 4, 20, 20, 6, 20, 13, 12, 12, 12, 1, 4, 13, 8, // 258 tentacle1
  17, 12, 8, 4, 20, 20, 6, 20, 13, 12, 12, 12, 1, 4, 13, 8, // 259 tentacle2
  17, 12, 8, 4, 20, 20, 6, 20, 13, 12, 12, 12, 1, 4, 13, 8, // 260 tentacle3
  18, 13, 8, 6, 15, 15, 6, 15, 21, 12, 12, 12, 1, 6, 21, 8, // 261 tentaclehead1
  18, 13, 8, 6, 15, 15, 6, 15, 21, 12, 12, 12, 1, 6, 21, 8, // 262 tentaclehead2
  18, 13, 8, 6, 15, 15, 6, 15, 21, 12, 12, 12, 1, 6, 21, 8, // 263 tentaclehead3
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 264 meshif2
  12, 16, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 265 cain5
  17, 24, 13, 6, 15, 15, 6, 15, 21, 12, 12, 12, 1, 6, 15, 10, // 266 navi
  24, 13, 12, 9, 13, 13, 6, 13, 20, 12, 12, 12, 1, 9, 20, 10, // 267 bloodraven
  1, 5, 4, 6, 10, 10, 6, 10, 5, 12, 12, 12, 1, 6, 10, 4, // 268 bug
  1, 5, 5, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 5, // 269 scorpion
  17, 24, 13, 6, 15, 15, 6, 15, 21, 12, 12, 12, 1, 6, 15, 10, // 270 rogue2
  17, 24, 13, 6, 15, 15, 6, 15, 21, 12, 12, 12, 1, 6, 15, 10, // 271 roguehire
  17, 24, 13, 6, 15, 15, 6, 15, 21, 12, 12, 12, 1, 6, 15, 10, // 272 rogue3
  15, 1, 8, 6, 5, 5, 6, 5, 12, 12, 12, 12, 1, 6, 5, 8, // 273 gargoyletrap
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 274 skmage_pois1
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 275 skmage_pois2
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 276 skmage_pois3
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 277 skmage_pois4
  20, 12, 8, 10, 25, 25, 6, 17, 12, 12, 12, 12, 1, 10, 17, 8, // 278 fetishshaman1
  20, 12, 8, 10, 25, 25, 6, 17, 12, 12, 12, 12, 1, 10, 17, 8, // 279 fetishshaman2
  20, 12, 8, 10, 25, 25, 6, 17, 12, 12, 12, 12, 1, 10, 17, 8, // 280 fetishshaman3
  20, 12, 8, 10, 25, 25, 6, 17, 12, 12, 12, 12, 1, 10, 17, 8, // 281 fetishshaman4
  20, 12, 8, 10, 25, 25, 6, 17, 12, 12, 12, 12, 1, 10, 17, 8, // 282 fetishshaman5
  7, 11, 21, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 21, // 283 larva
  31, 21, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 12, 8, // 284 maggotqueen1
  31, 21, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 12, 8, // 285 maggotqueen2
  31, 21, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 12, 8, // 286 maggotqueen3
  31, 21, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 12, 8, // 287 maggotqueen4
  31, 21, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 12, 8, // 288 maggotqueen5
  16, 4, 8, 6, 16, 16, 6, 16, 16, 12, 12, 12, 1, 6, 16, 8, // 289 claygolem
  16, 4, 8, 6, 16, 16, 6, 16, 16, 12, 12, 12, 1, 6, 16, 8, // 290 bloodgolem
  20, 4, 8, 6, 16, 16, 6, 16, 15, 12, 12, 12, 1, 6, 16, 8, // 291 irongolem
  19, 8, 8, 6, 17, 17, 6, 17, 16, 12, 12, 12, 1, 6, 17, 8, // 292 firegolem
  12, 10, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 293 familiar
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 294 act3male
  16, 16, 10, 10, 12, 14, 6, 12, 12, 12, 12, 12, 1, 10, 12, 10, // 295 baboon6
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 296 act3female
  21, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 297 natalya
  21, 13, 17, 7, 17, 17, 6, 17, 17, 12, 12, 12, 1, 7, 17, 17, // 298 vilemother1
  21, 13, 17, 7, 17, 17, 6, 17, 17, 12, 12, 12, 1, 7, 17, 17, // 299 vilemother2
  21, 13, 17, 7, 17, 17, 6, 17, 17, 12, 12, 12, 1, 7, 17, 17, // 300 vilemother3
  12, 4, 9, 5, 10, 10, 6, 10, 12, 12, 12, 12, 1, 5, 10, 9, // 301 vilechild1
  12, 4, 9, 5, 10, 10, 6, 10, 12, 12, 12, 12, 1, 5, 10, 9, // 302 vilechild2
  12, 4, 9, 5, 10, 10, 6, 10, 12, 12, 12, 12, 1, 5, 10, 9, // 303 vilechild3
  20, 8, 10, 4, 14, 14, 6, 14, 14, 12, 12, 12, 1, 4, 14, 10, // 304 fingermage1
  20, 8, 10, 4, 14, 14, 6, 14, 14, 12, 12, 12, 1, 4, 14, 10, // 305 fingermage2
  20, 8, 10, 4, 14, 14, 6, 14, 14, 12, 12, 12, 1, 4, 14, 10, // 306 fingermage3
  20, 8, 12, 6, 16, 12, 6, 16, 12, 12, 12, 12, 1, 6, 16, 12, // 307 regurgitator1
  20, 8, 12, 6, 16, 12, 6, 16, 12, 12, 12, 12, 1, 6, 16, 12, // 308 regurgitator2
  20, 8, 12, 6, 16, 12, 6, 16, 12, 12, 12, 12, 1, 6, 16, 12, // 309 regurgitator3
  19, 8, 8, 6, 16, 16, 6, 16, 16, 16, 16, 12, 1, 6, 16, 8, // 310 doomknight1
  19, 8, 8, 6, 16, 16, 6, 16, 16, 16, 16, 12, 1, 6, 16, 8, // 311 doomknight2
  19, 8, 8, 6, 16, 16, 6, 16, 16, 16, 16, 12, 1, 6, 16, 8, // 312 doomknight3
  14, 8, 18, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 313 quillbear1
  14, 8, 18, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 314 quillbear2
  14, 8, 18, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 315 quillbear3
  14, 8, 18, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 316 quillbear4
  14, 8, 18, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 317 quillbear5
  1, 6, 14, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 14, // 318 snake
  12, 2, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 319 parrot
  12, 8, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 320 fish
  21, 1, 8, 6, 10, 10, 6, 10, 12, 12, 21, 21, 1, 6, 10, 8, // 321 evilhole1
  21, 1, 8, 6, 10, 10, 6, 10, 12, 12, 21, 21, 1, 6, 10, 8, // 322 evilhole2
  21, 1, 8, 6, 10, 10, 6, 10, 12, 12, 21, 21, 1, 6, 10, 8, // 323 evilhole3
  21, 1, 8, 6, 10, 10, 6, 10, 12, 12, 21, 21, 1, 6, 10, 8, // 324 evilhole4
  21, 1, 8, 6, 10, 10, 6, 10, 12, 12, 21, 21, 1, 6, 10, 8, // 325 evilhole5
  3, 2, 8, 6, 3, 3, 6, 3, 2, 2, 12, 12, 1, 6, 3, 8, // 326 trap-firebolt
  3, 2, 8, 6, 3, 3, 6, 3, 2, 2, 12, 12, 1, 6, 3, 8, // 327 trap-horzmissile
  3, 2, 8, 6, 3, 3, 6, 3, 2, 2, 12, 12, 1, 6, 3, 8, // 328 trap-vertmissile
  3, 2, 8, 6, 3, 3, 6, 3, 2, 2, 12, 12, 1, 6, 3, 8, // 329 trap-poisoncloud
  3, 2, 8, 6, 3, 3, 6, 3, 2, 2, 12, 12, 1, 6, 3, 8, // 330 trap-lightning
  19, 8, 8, 8, 16, 16, 6, 16, 12, 12, 12, 12, 1, 8, 14, 13, // 331 act2guard2
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 332 invisospawner
  142, 12, 12, 6, 16, 20, 9, 17, 18, 16, 16, 15, 1, 6, 22, 22, // 333 diabloclone
  17, 17, 8, 6, 10, 10, 6, 10, 17, 12, 12, 12, 1, 6, 17, 8, // 334 suckernest1
  17, 17, 8, 6, 10, 10, 6, 10, 17, 12, 12, 12, 1, 6, 17, 8, // 335 suckernest2
  17, 17, 8, 6, 10, 10, 6, 10, 17, 12, 12, 12, 1, 6, 17, 8, // 336 suckernest3
  17, 17, 8, 6, 10, 10, 6, 10, 17, 12, 12, 12, 1, 6, 17, 8, // 337 suckernest4
  19, 8, 8, 8, 16, 16, 6, 16, 12, 12, 12, 12, 1, 8, 14, 13, // 338 act2hire
  1, 13, 12, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 12, // 339 minispider
  11, 1, 8, 4, 10, 10, 6, 10, 14, 12, 12, 12, 1, 4, 10, 8, // 340 boneprison1
  11, 1, 8, 4, 10, 10, 6, 10, 14, 12, 12, 12, 1, 4, 10, 8, // 341 boneprison2
  11, 1, 8, 4, 10, 10, 6, 10, 14, 12, 12, 12, 1, 4, 10, 8, // 342 boneprison3
  11, 1, 8, 4, 10, 10, 6, 10, 14, 12, 12, 12, 1, 4, 10, 8, // 343 boneprison4
  15, 1, 8, 5, 10, 10, 6, 10, 24, 12, 12, 12, 1, 5, 10, 8, // 344 bonewall
  19, 7, 11, 4, 10, 10, 6, 10, 14, 12, 12, 12, 1, 4, 10, 11, // 345 councilmember1
  19, 7, 11, 4, 10, 10, 6, 10, 14, 12, 12, 12, 1, 4, 10, 11, // 346 councilmember2
  19, 7, 11, 4, 10, 10, 6, 10, 14, 12, 12, 12, 1, 4, 10, 11, // 347 councilmember3
  11, 1, 8, 6, 9, 9, 6, 9, 12, 12, 12, 12, 1, 6, 9, 8, // 348 turret1
  11, 1, 8, 6, 9, 9, 6, 9, 12, 12, 12, 12, 1, 6, 9, 8, // 349 turret2
  11, 1, 8, 6, 9, 9, 6, 9, 12, 12, 12, 12, 1, 6, 9, 8, // 350 turret3
  10, 12, 8, 6, 12, 12, 6, 12, 12, 12, 12, 12, 1, 6, 12, 8, // 351 hydra1
  10, 12, 8, 6, 12, 12, 6, 12, 12, 12, 12, 12, 1, 6, 12, 8, // 352 hydra2
  10, 12, 8, 6, 12, 12, 6, 12, 12, 12, 12, 12, 1, 6, 12, 8, // 353 hydra3
  10, 3, 8, 6, 17, 17, 6, 17, 12, 12, 12, 12, 1, 6, 17, 8, // 354 trap-melee
  3, 2, 8, 6, 3, 3, 6, 3, 2, 2, 12, 12, 1, 6, 3, 8, // 355 seventombs
  25, 1, 1, 1, 2, 2, 6, 2, 12, 12, 12, 12, 1, 1, 2, 1, // 356 dopplezon
  25, 1, 1, 1, 2, 2, 6, 2, 12, 12, 12, 12, 1, 1, 2, 1, // 357 valkyrie
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 14, 8, // 358 act2guard3
  23, 19, 12, 9, 15, 15, 6, 18, 12, 12, 12, 12, 1, 9, 15, 9, // 359 act3hire
  20, 8, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 360 megademon1
  20, 8, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 361 megademon2
  20, 8, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 362 megademon3
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 16, 8, // 363 necroskeleton
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 16, 8, // 364 necromage
  20, 6, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 365 griswold
  3, 2, 8, 6, 3, 3, 6, 3, 2, 2, 12, 12, 1, 6, 3, 8, // 366 compellingorb
  3, 60, 20, 12, 12, 12, 6, 12, 12, 12, 12, 12, 1, 12, 12, 20, // 367 tyrael2
  26, 16, 16, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 16, // 368 darkwanderer
  3, 2, 8, 6, 3, 3, 6, 3, 2, 2, 12, 12, 1, 6, 3, 8, // 369 trap-nova
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 370 spiritmummy
  11, 17, 8, 6, 17, 17, 6, 17, 12, 12, 12, 12, 1, 6, 17, 8, // 371 lightningspire
  11, 1, 8, 6, 9, 9, 6, 9, 12, 12, 12, 12, 1, 6, 9, 8, // 372 firetower
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 373 slinger1
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 374 slinger2
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 375 slinger3
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 376 slinger4
  19, 8, 8, 8, 16, 16, 6, 16, 12, 12, 12, 12, 1, 8, 14, 13, // 377 act2guard4
  19, 8, 8, 8, 16, 16, 6, 16, 12, 12, 12, 12, 1, 8, 14, 13, // 378 act2guard5
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 379 skmage_cold1
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 380 skmage_cold2
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 381 skmage_cold3
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 382 skmage_cold4
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 383 skmage_fire1
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 384 skmage_fire2
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 385 skmage_fire3
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 386 skmage_fire4
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 387 skmage_ltng1
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 388 skmage_ltng2
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 389 skmage_ltng3
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 390 skmage_ltng4
  14, 10, 8, 5, 19, 19, 6, 19, 12, 12, 12, 12, 1, 5, 19, 8, // 391 hellbovine
  13, 1, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 392 window1
  13, 1, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 393 window2
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 394 slinger5
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 395 slinger6
  18, 10, 6, 9, 15, 15, 6, 15, 12, 12, 12, 12, 1, 9, 18, 6, // 396 fetishblow1
  18, 10, 6, 9, 15, 15, 6, 15, 12, 12, 12, 12, 1, 9, 18, 6, // 397 fetishblow2
  18, 10, 6, 9, 15, 15, 6, 15, 12, 12, 12, 12, 1, 9, 18, 6, // 398 fetishblow3
  18, 10, 6, 9, 15, 15, 6, 15, 12, 12, 12, 12, 1, 9, 18, 6, // 399 fetishblow4
  18, 10, 6, 9, 15, 15, 6, 15, 12, 12, 12, 12, 1, 9, 18, 6, // 400 fetishblow5
  1, 2, 8, 6, 37, 37, 6, 37, 12, 12, 12, 12, 1, 6, 37, 8, // 401 mephistospirit
  20, 12, 12, 8, 14, 14, 6, 14, 12, 12, 12, 12, 1, 8, 14, 12, // 402 smith
  11, 21, 8, 6, 38, 38, 6, 38, 38, 11, 11, 12, 1, 6, 38, 8, // 403 trappedsoul1
  11, 38, 8, 6, 38, 38, 6, 38, 38, 11, 11, 12, 1, 6, 38, 8, // 404 trappedsoul2
  12, 12, 16, 6, 10, 10, 6, 10, 109, 130, 12, 12, 1, 6, 10, 16, // 405 jamella
  20, 20, 8, 6, 10, 10, 6, 10, 20, 12, 12, 12, 1, 6, 10, 8, // 406 izualghost
  18, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 18, 6, // 407 fetish11
  12, 24, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 408 malachai
  20, 12, 12, 8, 14, 14, 6, 14, 12, 12, 12, 12, 1, 8, 14, 12, // 409 hephasto
  25, 2, 8, 6, 15, 15, 6, 15, 15, 2, 12, 12, 1, 6, 15, 8, // 410 wakeofdestruction
  23, 15, 8, 6, 10, 10, 6, 10, 15, 15, 12, 12, 1, 6, 15, 8, // 411 chargeboltsentry
  23, 15, 8, 6, 10, 10, 6, 10, 15, 15, 12, 12, 1, 6, 15, 8, // 412 lightningsentry
  35, 21, 3, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 3, // 413 bladecreeper
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 414 invisopet
  25, 2, 8, 6, 15, 15, 6, 15, 15, 2, 12, 12, 1, 6, 14, 8, // 415 infernosentry
  23, 15, 8, 6, 10, 10, 6, 10, 15, 15, 12, 12, 1, 6, 15, 8, // 416 deathsentry
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 16, 2, // 417 shadowwarrior
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 16, 2, // 418 shadowmaster
  11, 12, 12, 6, 23, 23, 6, 23, 11, 12, 12, 12, 1, 6, 23, 12, // 419 druidhawk
  12, 20, 8, 7, 13, 15, 6, 13, 13, 12, 12, 12, 1, 7, 13, 8, // 420 spiritwolf
  12, 20, 8, 7, 13, 15, 6, 13, 13, 12, 12, 12, 1, 7, 13, 8, // 421 fenris
  14, 7, 7, 4, 10, 10, 6, 10, 12, 12, 12, 12, 1, 4, 10, 7, // 422 spiritofbarbs
  14, 7, 7, 4, 10, 10, 6, 10, 12, 12, 12, 12, 1, 4, 10, 7, // 423 heartofwolverine
  13, 7, 7, 4, 10, 10, 6, 10, 12, 12, 12, 12, 1, 4, 10, 7, // 424 oaksage
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 425 plaguepoppy
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 426 cycleoflife
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 427 vinecreature
  18, 12, 12, 5, 13, 17, 6, 13, 19, 12, 12, 12, 1, 5, 17, 12, // 428 druidbear
  23, 10, 8, 7, 12, 20, 7, 12, 12, 12, 12, 12, 1, 7, 12, 8, // 429 eagle
  12, 9, 8, 4, 13, 13, 5, 11, 16, 12, 10, 7, 1, 4, 13, 8, // 430 wolf
  12, 10, 8, 5, 12, 12, 5, 10, 16, 12, 10, 7, 1, 5, 12, 8, // 431 bear
  8, 1, 8, 8, 10, 10, 6, 10, 4, 12, 12, 12, 1, 8, 10, 8, // 432 barricadedoor1
  8, 1, 8, 8, 10, 10, 6, 10, 4, 12, 12, 12, 1, 8, 10, 8, // 433 barricadedoor2
  10, 1, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 434 prisondoor
  11, 1, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 435 barricadetower
  14, 11, 13, 6, 12, 12, 6, 12, 15, 12, 12, 12, 1, 6, 28, 11, // 436 reanimatedhorde1
  14, 11, 13, 6, 12, 12, 6, 12, 15, 12, 12, 12, 1, 6, 28, 11, // 437 reanimatedhorde2
  14, 11, 13, 6, 12, 12, 6, 12, 15, 12, 12, 12, 1, 6, 28, 11, // 438 reanimatedhorde3
  14, 11, 13, 6, 12, 12, 6, 12, 15, 12, 12, 12, 1, 6, 28, 11, // 439 reanimatedhorde4
  14, 11, 13, 6, 12, 12, 6, 12, 15, 12, 12, 12, 1, 6, 28, 11, // 440 reanimatedhorde5
  10, 10, 8, 4, 9, 9, 6, 9, 12, 12, 12, 12, 1, 4, 22, 8, // 441 siegebeast1
  10, 10, 8, 4, 9, 9, 6, 9, 12, 12, 12, 12, 1, 4, 22, 8, // 442 siegebeast2
  10, 10, 8, 4, 9, 9, 6, 9, 12, 12, 12, 12, 1, 4, 22, 8, // 443 siegebeast3
  10, 10, 8, 4, 9, 9, 6, 9, 12, 12, 12, 12, 1, 4, 22, 8, // 444 siegebeast4
  10, 10, 8, 4, 9, 9, 6, 9, 12, 12, 12, 12, 1, 4, 22, 8, // 445 siegebeast5
  18, 8, 12, 6, 12, 17, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 446 snowyeti1
  18, 8, 12, 6, 12, 17, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 447 snowyeti2
  18, 8, 12, 6, 12, 17, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 448 snowyeti3
  18, 8, 12, 6, 12, 17, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 449 snowyeti4
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 450 wolfrider1
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 451 wolfrider2
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 452 wolfrider3
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 453 minion1
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 454 minion2
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 455 minion3
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 456 minion4
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 457 minion5
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 458 minion6
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 459 minion7
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 460 minion8
  19, 8, 10, 6, 10, 10, 6, 10, 26, 12, 12, 12, 1, 6, 10, 10, // 461 suicideminion1
  19, 8, 10, 6, 10, 10, 6, 10, 26, 12, 12, 12, 1, 6, 10, 10, // 462 suicideminion2
  19, 8, 10, 6, 10, 10, 6, 10, 26, 12, 12, 12, 1, 6, 10, 10, // 463 suicideminion3
  19, 8, 10, 6, 10, 10, 6, 10, 26, 12, 12, 12, 1, 6, 10, 10, // 464 suicideminion4
  19, 8, 10, 6, 10, 10, 6, 10, 26, 12, 12, 12, 1, 6, 10, 10, // 465 suicideminion5
  19, 8, 10, 6, 10, 10, 6, 10, 26, 12, 12, 12, 1, 6, 10, 10, // 466 suicideminion6
  19, 8, 10, 6, 10, 10, 6, 10, 26, 12, 12, 12, 1, 6, 10, 10, // 467 suicideminion7
  19, 8, 10, 6, 10, 10, 6, 10, 26, 12, 12, 12, 1, 6, 10, 10, // 468 suicideminion8
  17, 9, 8, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 8, // 469 succubus1
  17, 9, 8, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 8, // 470 succubus2
  17, 9, 8, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 8, // 471 succubus3
  17, 9, 8, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 8, // 472 succubus4
  17, 9, 8, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 8, // 473 succubus5
  17, 9, 9, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 9, // 474 succubuswitch1
  17, 9, 9, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 9, // 475 succubuswitch2
  17, 9, 9, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 9, // 476 succubuswitch3
  17, 9, 9, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 9, // 477 succubuswitch4
  17, 9, 9, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 9, // 478 succubuswitch5
  18, 9, 10, 5, 14, 16, 6, 14, 16, 13, 12, 12, 1, 5, 33, 10, // 479 overseer1
  18, 9, 10, 5, 14, 16, 6, 14, 16, 13, 12, 12, 1, 5, 33, 10, // 480 overseer2
  18, 9, 10, 5, 14, 16, 6, 14, 16, 13, 12, 12, 1, 5, 33, 10, // 481 overseer3
  18, 9, 10, 5, 14, 16, 6, 14, 16, 13, 12, 12, 1, 5, 33, 10, // 482 overseer4
  18, 9, 10, 5, 14, 16, 6, 14, 16, 13, 12, 12, 1, 5, 33, 10, // 483 overseer5
  21, 21, 8, 6, 21, 21, 6, 21, 21, 12, 12, 12, 1, 6, 21, 8, // 484 minionspawner1
  21, 21, 8, 6, 21, 21, 6, 21, 21, 12, 12, 12, 1, 6, 21, 8, // 485 minionspawner2
  21, 21, 8, 6, 21, 21, 6, 21, 21, 12, 12, 12, 1, 6, 21, 8, // 486 minionspawner3
  21, 21, 8, 6, 21, 21, 6, 21, 21, 12, 12, 12, 1, 6, 21, 8, // 487 minionspawner4
  21, 21, 8, 6, 21, 21, 6, 21, 21, 12, 12, 12, 1, 6, 21, 8, // 488 minionspawner5
  21, 21, 8, 6, 21, 21, 6, 21, 21, 12, 12, 12, 1, 6, 21, 8, // 489 minionspawner6
  21, 21, 8, 6, 21, 21, 6, 21, 21, 12, 12, 12, 1, 6, 21, 8, // 490 minionspawner7
  21, 21, 8, 6, 21, 21, 6, 21, 21, 12, 12, 12, 1, 6, 21, 8, // 491 minionspawner8
  18, 10, 8, 5, 14, 14, 6, 14, 16, 14, 12, 12, 1, 5, 14, 8, // 492 imp1
  18, 10, 8, 5, 14, 14, 6, 14, 16, 14, 12, 12, 1, 5, 14, 8, // 493 imp2
  18, 10, 8, 5, 14, 14, 6, 14, 16, 14, 12, 12, 1, 5, 14, 8, // 494 imp3
  18, 10, 8, 5, 14, 14, 6, 14, 16, 14, 12, 12, 1, 5, 14, 8, // 495 imp4
  18, 10, 8, 5, 14, 14, 6, 14, 16, 14, 12, 12, 1, 5, 14, 8, // 496 imp5
  20, 14, 8, 6, 27, 27, 6, 27, 12, 12, 12, 12, 1, 6, 27, 8, // 497 catapult1
  20, 14, 8, 6, 27, 27, 6, 27, 12, 12, 12, 12, 1, 6, 27, 8, // 498 catapult2
  20, 14, 8, 6, 27, 27, 6, 27, 12, 12, 12, 12, 1, 6, 27, 8, // 499 catapult3
  13, 14, 8, 6, 27, 27, 6, 27, 12, 12, 12, 12, 1, 6, 27, 8, // 500 catapult4
  14, 6, 14, 6, 13, 14, 6, 13, 12, 12, 12, 12, 1, 6, 14, 14, // 501 frozenhorror1
  14, 6, 14, 6, 13, 14, 6, 13, 12, 12, 12, 12, 1, 6, 14, 14, // 502 frozenhorror2
  14, 6, 14, 6, 13, 14, 6, 13, 12, 12, 12, 12, 1, 6, 14, 14, // 503 frozenhorror3
  14, 6, 14, 6, 13, 14, 6, 13, 12, 12, 12, 12, 1, 6, 14, 14, // 504 frozenhorror4
  14, 6, 14, 6, 13, 14, 6, 13, 12, 12, 12, 12, 1, 6, 14, 14, // 505 frozenhorror5
  15, 8, 8, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 506 bloodlord1
  15, 8, 8, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 507 bloodlord2
  15, 8, 8, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 508 bloodlord3
  15, 8, 8, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 509 bloodlord4
  15, 8, 8, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 510 bloodlord5
  12, 8, 8, 6, 10, 10, 6, 10, 61, 12, 12, 12, 1, 6, 10, 8, // 511 larzuk
  12, 15, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 10, 8, // 512 drehya
  12, 16, 16, 6, 10, 10, 6, 10, 51, 12, 12, 12, 1, 6, 10, 16, // 513 malah
  12, 16, 8, 6, 10, 10, 6, 10, 75, 12, 12, 12, 1, 6, 10, 8, // 514 nihlathak
  12, 8, 8, 6, 10, 10, 6, 10, 36, 12, 12, 12, 1, 6, 10, 8, // 515 qual-kehk
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 516 catapultspotter1
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 517 catapultspotter2
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 518 catapultspotter3
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 519 catapultspotter4
  3, 16, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 520 cain6
  3, 60, 20, 12, 12, 12, 6, 12, 12, 12, 12, 12, 1, 12, 12, 20, // 521 tyrael3
  23, 12, 10, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 8, // 522 act5barb1
  23, 12, 10, 5, 16, 16, 6, 16, 12, 12, 12, 12, 1, 5, 16, 8, // 523 act5barb2
  9, 1, 8, 9, 10, 10, 6, 10, 12, 12, 12, 12, 1, 9, 10, 8, // 524 barricadewall1
  9, 1, 8, 9, 10, 10, 6, 10, 12, 12, 12, 12, 1, 9, 10, 8, // 525 barricadewall2
  16, 8, 8, 7, 14, 14, 6, 14, 12, 12, 12, 12, 1, 7, 15, 8, // 526 nihlathakboss
  12, 15, 8, 6, 10, 10, 6, 10, 31, 12, 12, 12, 1, 6, 10, 8, // 527 drehyaiced
  12, 22, 8, 11, 10, 10, 6, 10, 22, 12, 12, 12, 1, 11, 33, 8, // 528 evilhut
  14, 13, 13, 5, 11, 15, 6, 11, 12, 12, 12, 12, 1, 5, 35, 13, // 529 deathmauler1
  14, 13, 13, 5, 11, 15, 6, 11, 12, 12, 12, 12, 1, 5, 35, 13, // 530 deathmauler2
  14, 13, 13, 5, 11, 15, 6, 11, 12, 12, 12, 12, 1, 5, 35, 13, // 531 deathmauler3
  14, 13, 13, 5, 11, 15, 6, 11, 12, 12, 12, 12, 1, 5, 35, 13, // 532 deathmauler4
  14, 13, 13, 5, 11, 15, 6, 11, 12, 12, 12, 12, 1, 5, 35, 13, // 533 deathmauler5
  23, 18, 10, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 10, // 534 act5pow
  23, 12, 10, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 8, // 535 act5barb3
  23, 12, 10, 5, 16, 16, 6, 16, 12, 12, 12, 12, 1, 5, 16, 8, // 536 act5barb4
  20, 1, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 537 ancientstatue1
  20, 1, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 538 ancientstatue2
  20, 1, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 539 ancientstatue3
  14, 8, 8, 6, 16, 16, 4, 16, 12, 12, 12, 12, 1, 6, 8, 8, // 540 ancientbarb1
  14, 8, 8, 7, 16, 16, 6, 14, 12, 12, 12, 12, 1, 7, 16, 8, // 541 ancientbarb2
  14, 8, 8, 7, 19, 19, 6, 19, 18, 12, 12, 12, 1, 7, 17, 8, // 542 ancientbarb3
  12, 12, 8, 6, 10, 10, 6, 10, 12, 12, 23, 12, 1, 6, 10, 8, // 543 baalthrone
  200, 12, 12, 5, 19, 16, 6, 19, 16, 23, 23, 12, 1, 5, 16, 12, // 544 baalcrab
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 545 baaltaunt
  17, 9, 10, 5, 10, 10, 6, 10, 16, 16, 12, 12, 1, 5, 10, 10, // 546 putriddefiler1
  17, 9, 10, 5, 10, 10, 6, 10, 16, 16, 12, 12, 1, 5, 10, 10, // 547 putriddefiler2
  17, 9, 10, 5, 10, 10, 6, 10, 16, 16, 12, 12, 1, 5, 10, 10, // 548 putriddefiler3
  17, 9, 10, 5, 10, 10, 6, 10, 16, 16, 12, 12, 1, 5, 10, 10, // 549 putriddefiler4
  17, 9, 10, 5, 10, 10, 6, 10, 16, 16, 12, 12, 1, 5, 10, 10, // 550 putriddefiler5
  11, 5, 9, 4, 8, 8, 6, 8, 12, 12, 12, 12, 1, 4, 8, 9, // 551 painworm1
  11, 5, 9, 4, 8, 8, 6, 8, 12, 12, 12, 12, 1, 4, 8, 9, // 552 painworm2
  11, 5, 9, 4, 8, 8, 6, 8, 12, 12, 12, 12, 1, 4, 8, 9, // 553 painworm3
  11, 5, 9, 4, 8, 8, 6, 8, 12, 12, 12, 12, 1, 4, 8, 9, // 554 painworm4
  11, 5, 9, 4, 8, 8, 6, 8, 12, 12, 12, 12, 1, 4, 8, 9, // 555 painworm5
  1, 4, 6, 6, 10, 10, 6, 10, 4, 12, 12, 12, 1, 6, 10, 6, // 556 bunny
  19, 7, 11, 4, 10, 10, 6, 10, 14, 12, 12, 12, 1, 4, 10, 11, // 557 baalhighpriest
  20, 8, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 558 venomlord
  200, 12, 12, 5, 19, 16, 6, 19, 16, 23, 23, 12, 1, 5, 19, 12, // 559 baalcrabstairs
  23, 12, 10, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 8, // 560 act5hire1
  23, 12, 10, 5, 16, 16, 6, 16, 12, 12, 12, 12, 1, 5, 16, 8, // 561 act5hire2
  14, 11, 2, 7, 10, 10, 6, 10, 15, 12, 12, 12, 1, 7, 10, 2, // 562 baaltentacle1
  14, 11, 2, 7, 10, 10, 6, 10, 15, 12, 12, 12, 1, 7, 10, 2, // 563 baaltentacle2
  14, 11, 2, 7, 10, 10, 6, 10, 15, 12, 12, 12, 1, 7, 10, 2, // 564 baaltentacle3
  14, 11, 2, 7, 10, 10, 6, 10, 15, 12, 12, 12, 1, 7, 10, 2, // 565 baaltentacle4
  14, 11, 2, 7, 10, 10, 6, 10, 15, 12, 12, 12, 1, 7, 10, 2, // 566 baaltentacle5
  12, 6, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 567 injuredbarb1
  12, 6, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 568 injuredbarb2
  12, 6, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 10, 8, // 569 injuredbarb3
  200, 12, 12, 5, 19, 16, 6, 19, 16, 23, 23, 12, 1, 5, 16, 12, // 570 baalclone
  18, 12, 12, 6, 12, 13, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 571 baalminion1
  18, 12, 12, 6, 12, 13, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 572 baalminion2
  18, 12, 12, 6, 12, 13, 6, 12, 12, 12, 12, 12, 1, 6, 12, 12, // 573 baalminion3
  3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, // 574 worldstoneeffect
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 575 sk_archer6
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 576 sk_archer7
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 577 sk_archer8
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 578 sk_archer9
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 579 sk_archer10
  19, 8, 8, 8, 8, 10, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 580 bighead6
  19, 8, 8, 8, 8, 10, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 581 bighead7
  19, 8, 8, 8, 8, 10, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 582 bighead8
  19, 8, 8, 8, 8, 10, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 583 bighead9
  19, 8, 8, 8, 8, 10, 6, 8, 12, 12, 12, 12, 1, 8, 8, 8, // 584 bighead10
  19, 10, 8, 6, 20, 16, 6, 20, 12, 12, 12, 12, 1, 6, 20, 8, // 585 goatman6
  19, 10, 8, 6, 20, 16, 6, 20, 12, 12, 12, 12, 1, 6, 20, 8, // 586 goatman7
  19, 10, 8, 6, 20, 16, 6, 20, 12, 12, 12, 12, 1, 6, 20, 8, // 587 goatman8
  19, 10, 8, 6, 20, 16, 6, 20, 12, 12, 12, 12, 1, 6, 20, 8, // 588 goatman9
  19, 10, 8, 6, 20, 16, 6, 20, 12, 12, 12, 12, 1, 6, 20, 8, // 589 goatman10
  23, 11, 8, 5, 11, 11, 6, 11, 12, 12, 12, 12, 1, 5, 11, 8, // 590 foulcrow5
  23, 11, 8, 5, 11, 11, 6, 11, 12, 12, 12, 12, 1, 5, 11, 8, // 591 foulcrow6
  23, 11, 8, 5, 11, 11, 6, 11, 12, 12, 12, 12, 1, 5, 11, 8, // 592 foulcrow7
  23, 11, 8, 5, 11, 11, 6, 11, 12, 12, 12, 12, 1, 5, 11, 8, // 593 foulcrow8
  19, 8, 16, 5, 14, 13, 6, 14, 12, 12, 12, 12, 1, 5, 14, 16, // 594 clawviper6
  19, 8, 16, 5, 14, 13, 6, 14, 12, 12, 12, 12, 1, 5, 14, 16, // 595 clawviper7
  19, 8, 16, 5, 14, 13, 6, 14, 12, 12, 12, 12, 1, 5, 14, 16, // 596 clawviper8
  19, 8, 16, 5, 14, 13, 6, 14, 12, 12, 12, 12, 1, 5, 14, 16, // 597 clawviper9
  19, 8, 16, 5, 14, 13, 6, 14, 12, 12, 12, 12, 1, 5, 14, 16, // 598 clawviper10
  18, 15, 29, 10, 15, 15, 6, 15, 11, 12, 12, 12, 1, 10, 32, 29, // 599 sandraider6
  18, 15, 29, 10, 15, 15, 6, 15, 11, 12, 12, 12, 1, 10, 32, 29, // 600 sandraider7
  18, 15, 29, 10, 15, 15, 6, 15, 11, 12, 12, 12, 1, 10, 32, 29, // 601 sandraider8
  18, 15, 29, 10, 15, 15, 6, 15, 11, 12, 12, 12, 1, 10, 32, 29, // 602 sandraider9
  18, 15, 29, 10, 15, 15, 6, 15, 11, 12, 12, 12, 1, 10, 32, 29, // 603 sandraider10
  14, 13, 13, 5, 11, 15, 6, 11, 12, 12, 12, 12, 1, 5, 35, 13, // 604 deathmauler6
  14, 8, 9, 6, 16, 13, 6, 16, 12, 12, 12, 12, 1, 6, 16, 9, // 605 quillrat6
  14, 8, 9, 6, 16, 13, 6, 16, 12, 12, 12, 12, 1, 6, 16, 9, // 606 quillrat7
  14, 8, 9, 6, 16, 13, 6, 16, 12, 12, 12, 12, 1, 6, 16, 9, // 607 quillrat8
  17, 16, 16, 7, 12, 12, 6, 12, 12, 12, 12, 12, 1, 7, 12, 16, // 608 vulture5
  23, 12, 14, 4, 10, 16, 6, 10, 12, 12, 12, 12, 1, 4, 10, 14, // 609 thornhulk5
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 610 slinger7
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 611 slinger8
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 612 slinger9
  24, 13, 12, 9, 13, 13, 6, 13, 20, 12, 12, 12, 1, 9, 13, 10, // 613 cr_archer6
  24, 13, 12, 9, 13, 13, 6, 13, 20, 12, 12, 12, 1, 9, 13, 10, // 614 cr_archer7
  24, 13, 12, 9, 18, 18, 6, 18, 12, 12, 12, 12, 1, 9, 23, 10, // 615 cr_lancer6
  24, 13, 12, 9, 18, 18, 6, 18, 12, 12, 12, 12, 1, 9, 23, 10, // 616 cr_lancer7
  24, 13, 12, 9, 18, 18, 6, 18, 12, 12, 12, 12, 1, 9, 23, 10, // 617 cr_lancer8
  23, 8, 8, 7, 15, 15, 6, 15, 12, 12, 12, 12, 1, 7, 15, 8, // 618 blunderbore5
  23, 8, 8, 7, 15, 15, 6, 15, 12, 12, 12, 12, 1, 7, 15, 8, // 619 blunderbore6
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 620 skmage_fire5
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 621 skmage_fire6
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 622 skmage_ltng5
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 623 skmage_ltng6
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 624 skmage_cold5
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 625 skmage_pois5
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 626 skmage_pois6
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 627 pantherwoman5
  20, 9, 16, 10, 22, 22, 10, 22, 12, 12, 12, 12, 1, 10, 22, 16, // 628 pantherwoman6
  21, 11, 9, 16, 20, 9, 6, 20, 12, 12, 12, 12, 1, 16, 20, 9, // 629 sandleaper6
  21, 11, 9, 16, 20, 9, 6, 20, 12, 12, 12, 12, 1, 16, 20, 9, // 630 sandleaper7
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 631 wraith6
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 632 wraith7
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 633 wraith8
  17, 9, 8, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 8, // 634 succubus6
  17, 9, 8, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 8, // 635 succubus7
  17, 9, 9, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 9, // 636 succubuswitch6
  17, 9, 9, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 9, // 637 succubuswitch7
  17, 9, 9, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 9, // 638 succubuswitch8
  9, 9, 1, 5, 10, 10, 6, 9, 9, 12, 12, 12, 1, 5, 10, 1, // 639 willowisp5
  9, 9, 1, 5, 10, 10, 6, 9, 9, 12, 12, 12, 1, 5, 10, 1, // 640 willowisp6
  9, 9, 1, 5, 10, 10, 6, 9, 9, 12, 12, 12, 1, 5, 10, 1, // 641 willowisp7
  20, 20, 10, 7, 10, 15, 5, 10, 24, 18, 12, 12, 1, 7, 10, 10, // 642 fallen6
  20, 20, 10, 7, 10, 15, 5, 10, 24, 18, 12, 12, 1, 7, 10, 10, // 643 fallen7
  20, 20, 10, 7, 10, 15, 5, 10, 24, 18, 12, 12, 1, 7, 10, 10, // 644 fallen8
  21, 12, 14, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 14, // 645 fallenshaman6
  21, 12, 14, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 14, // 646 fallenshaman7
  21, 12, 14, 5, 17, 17, 6, 17, 12, 12, 12, 12, 1, 5, 17, 14, // 647 fallenshaman8
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 648 skeleton6
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 649 skeleton7
  16, 11, 8, 4, 10, 14, 6, 10, 12, 11, 11, 1, 1, 4, 10, 8, // 650 batdemon6
  16, 11, 8, 4, 10, 14, 6, 10, 12, 11, 11, 1, 1, 4, 10, 8, // 651 batdemon7
  15, 8, 8, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 652 bloodlord6
  15, 8, 8, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 653 bloodlord7
  20, 8, 14, 6, 16, 14, 6, 16, 12, 12, 12, 12, 1, 6, 13, 14, // 654 scarab6
  20, 8, 14, 6, 16, 14, 6, 16, 12, 12, 12, 12, 1, 6, 13, 14, // 655 scarab7
  18, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 18, 6, // 656 fetish6
  18, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 18, 6, // 657 fetish7
  18, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 18, 6, // 658 fetish8
  18, 10, 6, 9, 15, 15, 6, 15, 12, 12, 12, 12, 1, 9, 18, 6, // 659 fetishblow6
  18, 10, 6, 9, 15, 15, 6, 15, 12, 12, 12, 12, 1, 9, 18, 6, // 660 fetishblow7
  18, 10, 6, 9, 15, 15, 6, 15, 12, 12, 12, 12, 1, 9, 18, 6, // 661 fetishblow8
  20, 12, 8, 10, 25, 25, 6, 17, 12, 12, 12, 12, 1, 10, 17, 8, // 662 fetishshaman6
  20, 12, 8, 10, 25, 25, 6, 17, 12, 12, 12, 12, 1, 10, 17, 8, // 663 fetishshaman7
  20, 12, 8, 10, 25, 25, 6, 17, 12, 12, 12, 12, 1, 10, 17, 8, // 664 fetishshaman8
  16, 16, 10, 10, 12, 14, 6, 12, 12, 12, 12, 12, 1, 10, 12, 10, // 665 baboon7
  16, 16, 10, 10, 12, 14, 6, 12, 12, 12, 12, 12, 1, 10, 12, 10, // 666 baboon8
  20, 12, 18, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 667 unraveler6
  20, 12, 18, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 668 unraveler7
  20, 12, 18, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 669 unraveler8
  20, 12, 18, 6, 16, 20, 6, 16, 12, 12, 12, 12, 1, 6, 16, 18, // 670 unraveler9
  18, 10, 8, 5, 15, 11, 6, 15, 12, 12, 12, 12, 1, 5, 15, 8, // 671 zealot4
  18, 10, 8, 5, 15, 11, 6, 15, 12, 12, 12, 12, 1, 5, 15, 8, // 672 zealot5
  23, 8, 8, 5, 14, 14, 6, 14, 10, 12, 12, 12, 1, 5, 14, 8, // 673 cantor5
  23, 8, 8, 5, 14, 14, 6, 14, 10, 12, 12, 12, 1, 5, 14, 8, // 674 cantor6
  21, 13, 17, 7, 17, 17, 6, 17, 17, 12, 12, 12, 1, 7, 17, 17, // 675 vilemother4
  21, 13, 17, 7, 17, 17, 6, 17, 17, 12, 12, 12, 1, 7, 17, 17, // 676 vilemother5
  12, 4, 9, 5, 10, 10, 6, 10, 12, 12, 12, 12, 1, 5, 10, 9, // 677 vilechild4
  12, 4, 9, 5, 10, 10, 6, 10, 12, 12, 12, 12, 1, 5, 10, 9, // 678 vilechild5
  16, 8, 8, 6, 18, 10, 6, 18, 12, 12, 12, 12, 1, 6, 12, 8, // 679 sandmaggot6
  16, 8, 8, 6, 18, 10, 6, 12, 12, 12, 12, 12, 1, 6, 18, 8, // 680 maggotbaby6
  24, 16, 8, 6, 10, 10, 6, 10, 12, 12, 12, 12, 1, 6, 14, 8, // 681 maggotegg6
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 682 minion9
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 683 minion10
  15, 8, 8, 5, 9, 11, 6, 9, 12, 12, 12, 12, 1, 5, 9, 10, // 684 minion11
  17, 13, 12, 7, 11, 13, 6, 11, 12, 12, 12, 12, 1, 7, 11, 12, // 685 arach6
  20, 8, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 686 megademon4
  20, 8, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 687 megademon5
  18, 10, 8, 5, 14, 14, 6, 14, 16, 14, 12, 12, 1, 5, 14, 8, // 688 imp6
  18, 10, 8, 5, 14, 14, 6, 14, 16, 14, 12, 12, 1, 5, 14, 8, // 689 imp7
  15, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 12, 6, // 690 bonefetish6
  15, 12, 6, 10, 12, 12, 6, 12, 12, 12, 12, 12, 1, 10, 12, 6, // 691 bonefetish7
  20, 8, 10, 4, 14, 14, 6, 14, 14, 12, 12, 12, 1, 4, 14, 10, // 692 fingermage4
  20, 8, 10, 4, 14, 14, 6, 14, 14, 12, 12, 12, 1, 4, 14, 10, // 693 fingermage5
  20, 8, 12, 6, 16, 12, 6, 16, 12, 12, 12, 12, 1, 6, 16, 12, // 694 regurgitator4
  19, 15, 18, 4, 14, 14, 6, 15, 12, 12, 12, 12, 1, 4, 14, 18, // 695 vampire6
  19, 15, 18, 4, 14, 14, 6, 15, 12, 12, 12, 12, 1, 4, 14, 18, // 696 vampire7
  19, 15, 18, 4, 14, 14, 6, 15, 12, 12, 12, 12, 1, 4, 14, 18, // 697 vampire8
  14, 11, 13, 6, 12, 12, 6, 12, 15, 12, 12, 12, 1, 6, 28, 11, // 698 reanimatedhorde6
  19, 8, 8, 6, 16, 16, 6, 16, 16, 16, 16, 12, 1, 6, 16, 8, // 699 dkfig1
  19, 8, 8, 6, 16, 16, 6, 16, 16, 16, 16, 12, 1, 6, 16, 8, // 700 dkfig2
  19, 8, 8, 6, 16, 16, 6, 16, 16, 16, 16, 12, 1, 6, 16, 8, // 701 dkmag1
  19, 8, 8, 6, 16, 16, 6, 16, 16, 16, 16, 12, 1, 6, 16, 8, // 702 dkmag2
  22, 14, 12, 6, 18, 16, 6, 18, 19, 12, 12, 12, 1, 6, 18, 12, // 703 mummy6
  25, 13, 13, 6, 18, 17, 6, 18, 12, 12, 12, 12, 1, 6, 18, 13, // 704 ubermephisto
  142, 12, 12, 6, 16, 20, 9, 17, 18, 16, 16, 15, 1, 6, 22, 22, // 705 uberdiablo
  20, 8, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 706 uberizual
  23, 16, 12, 6, 16, 16, 6, 18, 12, 12, 12, 12, 1, 6, 18, 12, // 707 uberandariel
  25, 12, 16, 6, 10, 15, 6, 10, 12, 12, 12, 12, 1, 6, 31, 16, // 708 uberduriel
  200, 12, 12, 5, 19, 16, 6, 19, 16, 23, 23, 12, 1, 5, 16, 12, // 709 uberbaal
  21, 21, 8, 6, 21, 21, 6, 21, 21, 12, 12, 12, 1, 6, 21, 8, // 710 demonspawner
  21, 1, 8, 6, 10, 10, 6, 10, 12, 12, 21, 21, 1, 6, 10, 8, // 711 demonhole
  20, 8, 8, 6, 16, 16, 6, 16, 12, 12, 12, 12, 1, 6, 16, 8, // 712 megademon6
  19, 8, 8, 6, 16, 16, 6, 16, 16, 16, 16, 12, 1, 6, 16, 8, // 713 dkmag3
  18, 10, 8, 5, 14, 14, 6, 14, 16, 14, 12, 12, 1, 5, 14, 8, // 714 imp8
  15, 10, 10, 8, 20, 20, 6, 20, 12, 12, 12, 12, 1, 8, 8, 10, // 715 swarm5
  16, 8, 8, 6, 18, 10, 6, 18, 12, 12, 12, 12, 1, 6, 12, 8, // 716 sandmaggot7
  17, 13, 12, 7, 11, 13, 6, 11, 12, 12, 12, 12, 1, 7, 11, 12, // 717 arach7
  20, 8, 14, 6, 16, 14, 6, 16, 12, 12, 12, 12, 1, 6, 13, 14, // 718 scarab8
  17, 9, 8, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 8, // 719 succubus8
  17, 9, 9, 5, 8, 8, 6, 8, 12, 8, 12, 12, 1, 5, 8, 9, // 720 succubuswitch9
  24, 13, 12, 9, 16, 16, 7, 16, 12, 12, 12, 12, 1, 9, 16, 10, // 721 corruptrogue6
  24, 13, 12, 9, 13, 13, 6, 13, 20, 12, 12, 12, 1, 9, 13, 10, // 722 cr_archer8
  24, 13, 12, 9, 18, 18, 6, 18, 12, 12, 12, 12, 1, 9, 23, 10, // 723 cr_lancer8
  18, 9, 10, 5, 14, 16, 6, 14, 16, 13, 12, 12, 1, 5, 33, 10, // 724 overseer6
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 725 skeleton8
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 726 sk_archer11
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 727 skmage_fire7
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 728 skmage_ltng7
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 729 skmage_cold6
  19, 8, 8, 4, 16, 16, 4, 16, 12, 12, 12, 12, 1, 4, 11, 8, // 730 skmage_pois7
  19, 15, 18, 4, 14, 14, 6, 15, 12, 12, 12, 12, 1, 4, 14, 18, // 731 vampire9
  19, 12, 14, 8, 18, 18, 6, 16, 12, 12, 12, 12, 1, 8, 18, 14, // 732 wraith9
  9, 9, 1, 5, 10, 10, 6, 9, 9, 12, 12, 12, 1, 5, 10, 1, // 733 willowisp8
])

const DEFAULT_MONSTER_MODE_FRAMES: readonly number[] = [12, 8, 8, 6, 10, 10, 6, 12, 12, 12, 12, 12, 1, 6, 10, 8]

/**
 * Returns the 1.13c `monseq.txt` sequence steps for `(classId, skillId)` if defined.
 */
export function getMonsterSequenceSteps113c(
  classId: number,
  skillId?: number,
): readonly MonsterSequenceStep113c[] | undefined {
  const entry = MONSTER_CLASS_SEQUENCES_113C[classId | 0]
  if (!entry) return undefined
  const seqName = (skillId !== undefined ? entry.bySkillId?.[skillId | 0] : undefined) ?? entry.defaultSeq
  return MONSTER_SEQUENCES_113C[seqName]
}

/**
 * Resolves the current sub-clip and frame index for a monster in `MONMODE_SEQUENCE (14)` (`monseq.txt`).
 */
export function resolveMonsterSequenceFrame113c(
  classId: number,
  elapsedMs: number,
  stepSpeed256: number,
  skillId?: number,
): ResolvedMonsterSequenceFrame113c | undefined {
  const steps = getMonsterSequenceSteps113c(classId, skillId)
  if (!steps || steps.length === 0) return undefined
  const safeSpeed = stepSpeed256 > 0 ? stepSpeed256 : 256
  const safeTicks = Math.max(0, elapsedMs) / 40
  const rawStep = Math.floor((safeTicks * safeSpeed) / 256)
  const stepIdx = Math.min(steps.length - 1, Math.max(0, rawStep))
  const step = steps[stepIdx]!
  return {
    clipKey: step.clip,
    frameIndex: step.frameIndex,
    sequenceStepIndex: stepIdx,
    totalSequenceFrames: steps.length,
    event: step.event,
  }
}

/**
 * Returns the authoritative 1.13c base frame count (`dwFrames`) for `(classId, mode, skillId)`.
 */
export function getMonsterModeBaseFrameCount113c(
  classId: number,
  mode: number,
  skillId?: number,
): number {
  const m = mode | 0
  const c = classId | 0
  if (m === 14) {
    const seq = getMonsterSequenceSteps113c(c, skillId)
    if (seq && seq.length > 0) return seq.length
  }
  if (c >= 0 && c < MONSTATS_TXT_RECORD_COUNT && m >= 0 && m < 16) {
    const count = MONSTER_MODE_FRAME_COUNT_113C[c * 16 + m]
    if (count !== undefined && count > 0) return count
  }
  return DEFAULT_MONSTER_MODE_FRAMES[m] ?? 8
}

/**
 * Resolves the authoritative 1.13c monster animation mode (`MONMODE_*`) when `classId` casts `skillId`
 * (`0x4C` / `0x4D`), checking `Hireling.txt` (`Mode1..Mode6`), `MonStats.txt` (`Sk1mode..Sk8mode`),
 * and `MonStats2.dwModeFlags` (falling back to `MONMODE_ATTACK1 (4)` when `A2 (5)` / `SC (7)` is absent,
 * e.g. Necromancer Skeleton Mage `364` or Rogue Hireling `271`).
 */
export function resolveMonsterSkillAnimMode113c(
  classId: number,
  skillId: number,
  fallbackMode = 7,
): number {
  const c = classId | 0
  const sk = skillId | 0
  const classMap = MONSTER_CLASS_SKILL_MODES_113C[c]
  let mode = classMap?.[sk] ?? fallbackMode
  if (c >= 0 && c < MONSTATS_TXT_RECORD_COUNT && mode >= 0 && mode < 16 && mode !== 14) {
    const rec = getMonsterPathRecord(c)
    if ((rec.modeFlags & (1 << mode)) === 0 && (rec.modeFlags & (1 << 4)) !== 0) {
      mode = 4
    }
  }
  return mode
}

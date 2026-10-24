/**
 * Diablo II 1.13c Skills.txt Animation Mode Mapping & SequenceTbls.cpp Player Sequences.
 *
 * Maps every 1.13c skill ID to its player animation mode (PlrMode.txt, from Skills.txt anim),
 * monster animation mode (MonMode.txt, from Skills.txt monanim), sequence transition (seqtrans),
 * sequence table index (seqnum 1..23), and sequence hold input (seqinput).
 *
 * Parity Ground Truth:
 * - D2Common.dll / Skills.txt columns anim, monanim, seqtrans, seqnum, seqinput.
 * - D2Common/src/DataTbls/SequenceTbls.cpp gPlayerWeaponsSequenceTable[1..23].
 * - PlrMode: A1=7, A2=8, BL=9, SC=10, TH=11, KK=12, S1=13, S2=14, S3=15, S4=16, SQ=18.
 * - MonMode: A1=4, A2=5, BL=6, SC=7, S1=8, S2=9, S3=10, S4=11, OP=14.
 */

export interface SkillAnimModeEntry {
  readonly playerMode: number
  readonly monsterMode: number
  readonly anim: string
  readonly monanim: string
  readonly seqTrans: string
  readonly seqNum: number
  readonly seqInput: number
}

export interface PlayerSequenceFrameRecord {
  readonly mode: number
  readonly frame: number
  readonly dir: number
  readonly event: number
}

export interface ResolvedSkillSequenceFrame {
  readonly clipKey: string
  readonly mode: number
  readonly frameIndex: number
  readonly sequenceFrame: number
  readonly totalSequenceFrames: number
  readonly dir?: number | undefined
  readonly event: number
  readonly done: boolean
}

const PLR_MODE_NUM_TO_CLIP_KEY: Readonly<Record<number, string>> = Object.freeze({
  0: "dt",
  1: "nu",
  2: "wl",
  3: "rn",
  4: "gh",
  5: "tn",
  6: "tw",
  7: "a1",
  8: "a2",
  9: "bl",
  10: "sc",
  11: "th",
  12: "kk",
  13: "s1",
  14: "s2",
  15: "s3",
  16: "s4",
  17: "dd",
  18: "a1",
  19: "gh",
})

export const CANONICAL_SKILL_ANIM_MODES: Readonly<Record<number, SkillAnimModeEntry>> = Object.freeze({
  "0": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "1": {
    "playerMode": 12,
    "monsterMode": 4,
    "anim": "KK",
    "monanim": "XX",
    "seqTrans": "KK",
    "seqNum": 0,
    "seqInput": 0
  },
  "2": {
    "playerMode": 11,
    "monsterMode": 4,
    "anim": "TH",
    "monanim": "XX",
    "seqTrans": "TH",
    "seqNum": 0,
    "seqInput": 0
  },
  "3": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "4": {
    "playerMode": 16,
    "monsterMode": 7,
    "anim": "S4",
    "monanim": "XX",
    "seqTrans": "S4",
    "seqNum": 0,
    "seqInput": 0
  },
  "5": {
    "playerMode": 15,
    "monsterMode": 10,
    "anim": "S3",
    "monanim": "S3",
    "seqTrans": "S3",
    "seqNum": 0,
    "seqInput": 0
  },
  "6": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "7": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "8": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "9": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "10": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 1,
    "seqInput": 0
  },
  "11": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "12": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "13": {
    "playerMode": 13,
    "monsterMode": 7,
    "anim": "S1",
    "monanim": "XX",
    "seqTrans": "S1",
    "seqNum": 0,
    "seqInput": 0
  },
  "14": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "15": {
    "playerMode": 11,
    "monsterMode": 4,
    "anim": "TH",
    "monanim": "XX",
    "seqTrans": "TH",
    "seqNum": 0,
    "seqInput": 0
  },
  "16": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "17": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "18": {
    "playerMode": 13,
    "monsterMode": 7,
    "anim": "S1",
    "monanim": "XX",
    "seqTrans": "S1",
    "seqNum": 0,
    "seqInput": 0
  },
  "19": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 8,
    "seqInput": 0
  },
  "20": {
    "playerMode": 11,
    "monsterMode": 4,
    "anim": "TH",
    "monanim": "XX",
    "seqTrans": "TH",
    "seqNum": 0,
    "seqInput": 0
  },
  "21": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "22": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "23": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "24": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "25": {
    "playerMode": 11,
    "monsterMode": 4,
    "anim": "TH",
    "monanim": "XX",
    "seqTrans": "TH",
    "seqNum": 0,
    "seqInput": 0
  },
  "26": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 7,
    "seqInput": 0
  },
  "27": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "28": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "29": {
    "playerMode": 13,
    "monsterMode": 7,
    "anim": "S1",
    "monanim": "XX",
    "seqTrans": "S1",
    "seqNum": 0,
    "seqInput": 0
  },
  "30": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 9,
    "seqInput": 0
  },
  "31": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "32": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "33": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "34": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "35": {
    "playerMode": 11,
    "monsterMode": 4,
    "anim": "TH",
    "monanim": "XX",
    "seqTrans": "TH",
    "seqNum": 0,
    "seqInput": 0
  },
  "36": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "37": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "38": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "39": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "40": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "41": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 6,
    "seqInput": 10
  },
  "42": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "43": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "44": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "45": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "46": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "47": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "48": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "49": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 12,
    "seqInput": 0
  },
  "50": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "51": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "52": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "53": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 12,
    "seqInput": 0
  },
  "54": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "55": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "56": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "57": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "58": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "59": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "60": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "61": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "62": {
    "playerMode": 10,
    "monsterMode": 8,
    "anim": "SC",
    "monanim": "S1",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "63": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "64": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "65": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "66": {
    "playerMode": 10,
    "monsterMode": 9,
    "anim": "SC",
    "monanim": "S2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "67": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "68": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "69": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "70": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "71": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "72": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "73": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "74": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "75": {
    "playerMode": 10,
    "monsterMode": 8,
    "anim": "SC",
    "monanim": "S1",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "76": {
    "playerMode": 10,
    "monsterMode": 9,
    "anim": "SC",
    "monanim": "S2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "77": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "78": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "79": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "80": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "81": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "82": {
    "playerMode": 10,
    "monsterMode": 9,
    "anim": "SC",
    "monanim": "S2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "83": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "84": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "85": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "86": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "87": {
    "playerMode": 10,
    "monsterMode": 9,
    "anim": "SC",
    "monanim": "S2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "88": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "89": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "90": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "91": {
    "playerMode": 10,
    "monsterMode": 9,
    "anim": "SC",
    "monanim": "S2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "92": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "93": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "94": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "95": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "96": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 2,
    "seqInput": 0
  },
  "97": {
    "playerMode": 13,
    "monsterMode": 7,
    "anim": "S1",
    "monanim": "XX",
    "seqTrans": "S1",
    "seqNum": 0,
    "seqInput": 0
  },
  "98": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "99": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "100": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "101": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "102": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "103": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "104": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "105": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "106": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "107": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 4,
    "seqInput": 8
  },
  "108": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "109": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "110": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "111": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "112": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "113": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "114": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "115": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "116": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "117": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "118": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "119": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "120": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "121": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "122": {
    "playerMode": 10,
    "monsterMode": 8,
    "anim": "SC",
    "monanim": "S1",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "123": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 5,
    "seqInput": 0
  },
  "124": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "125": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "126": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "127": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "128": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "129": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "130": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "131": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "132": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 13,
    "seqInput": 0
  },
  "133": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 11,
    "seqInput": 0
  },
  "134": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "135": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "136": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "137": {
    "playerMode": 10,
    "monsterMode": 8,
    "anim": "SC",
    "monanim": "S1",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "138": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "139": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "140": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 15,
    "seqInput": 0
  },
  "141": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "142": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "143": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 14,
    "seqInput": 0
  },
  "144": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "145": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "146": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "147": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 11,
    "seqInput": 0
  },
  "148": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "149": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "150": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "151": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 10,
    "seqInput": 0
  },
  "152": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "153": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "154": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "155": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "156": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "157": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "158": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "159": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "160": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "161": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "162": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "163": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "164": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "165": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "166": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "167": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "168": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "169": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "170": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "171": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "172": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 18,
    "seqInput": 0
  },
  "173": {
    "playerMode": 18,
    "monsterMode": 5,
    "anim": "SQ",
    "monanim": "A2",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "174": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "175": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "176": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "177": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "178": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "179": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "180": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "181": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "182": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "183": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "184": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "185": {
    "playerMode": 18,
    "monsterMode": 5,
    "anim": "SQ",
    "monanim": "A2",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "186": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "187": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "188": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "189": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "190": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "191": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "192": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "193": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "194": {
    "playerMode": 18,
    "monsterMode": 9,
    "anim": "SQ",
    "monanim": "S2",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "195": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "196": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "197": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "198": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 22,
    "seqInput": 0
  },
  "199": {
    "playerMode": 18,
    "monsterMode": 10,
    "anim": "SQ",
    "monanim": "S3",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "200": {
    "playerMode": 10,
    "monsterMode": 8,
    "anim": "SC",
    "monanim": "S1",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "201": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "202": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "203": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 26,
    "seqInput": 0
  },
  "204": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 27,
    "seqInput": 0
  },
  "205": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "206": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 34,
    "seqInput": 0
  },
  "207": {
    "playerMode": 10,
    "monsterMode": 9,
    "anim": "SC",
    "monanim": "S2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "208": {
    "playerMode": 10,
    "monsterMode": 9,
    "anim": "SC",
    "monanim": "S2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "209": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "210": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "211": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "212": {
    "playerMode": 18,
    "monsterMode": 9,
    "anim": "SQ",
    "monanim": "S2",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "213": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "214": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "215": {
    "playerMode": 18,
    "monsterMode": 5,
    "anim": "SQ",
    "monanim": "A2",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "216": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 41,
    "seqInput": 0
  },
  "217": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "218": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "219": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "220": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "221": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "222": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "223": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 22,
    "seqInput": 0
  },
  "224": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "225": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "226": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "227": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "228": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 22,
    "seqInput": 0
  },
  "229": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "230": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 18,
    "seqInput": 10
  },
  "231": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "232": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "233": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "234": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "235": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "236": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "237": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "238": {
    "playerMode": 15,
    "monsterMode": 10,
    "anim": "S3",
    "monanim": "S3",
    "seqTrans": "S3",
    "seqNum": 0,
    "seqInput": 0
  },
  "239": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "240": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "241": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "242": {
    "playerMode": 15,
    "monsterMode": 10,
    "anim": "S3",
    "monanim": "S3",
    "seqTrans": "S3",
    "seqNum": 0,
    "seqInput": 0
  },
  "243": {
    "playerMode": 10,
    "monsterMode": 10,
    "anim": "SC",
    "monanim": "S3",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "244": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "245": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "246": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "247": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "248": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "249": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "250": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "251": {
    "playerMode": 14,
    "monsterMode": 9,
    "anim": "S2",
    "monanim": "S2",
    "seqTrans": "S2",
    "seqNum": 0,
    "seqInput": 0
  },
  "252": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "253": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "254": {
    "playerMode": 7,
    "monsterMode": 5,
    "anim": "A1",
    "monanim": "A2",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "255": {
    "playerMode": 12,
    "monsterMode": 4,
    "anim": "KK",
    "monanim": "A1",
    "seqTrans": "KK",
    "seqNum": 19,
    "seqInput": 0
  },
  "256": {
    "playerMode": 14,
    "monsterMode": 9,
    "anim": "S2",
    "monanim": "S2",
    "seqTrans": "S2",
    "seqNum": 0,
    "seqInput": 0
  },
  "257": {
    "playerMode": 14,
    "monsterMode": 9,
    "anim": "S2",
    "monanim": "S2",
    "seqTrans": "S2",
    "seqNum": 0,
    "seqInput": 0
  },
  "258": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "259": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 16,
    "seqInput": 0
  },
  "260": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 16,
    "seqInput": 0
  },
  "261": {
    "playerMode": 14,
    "monsterMode": 9,
    "anim": "S2",
    "monanim": "S2",
    "seqTrans": "S2",
    "seqNum": 0,
    "seqInput": 0
  },
  "262": {
    "playerMode": 14,
    "monsterMode": 9,
    "anim": "S2",
    "monanim": "S2",
    "seqTrans": "S2",
    "seqNum": 0,
    "seqInput": 0
  },
  "263": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "264": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "265": {
    "playerMode": 7,
    "monsterMode": 5,
    "anim": "A1",
    "monanim": "A2",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "266": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "A1",
    "seqNum": 23,
    "seqInput": 12
  },
  "267": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "268": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "269": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 16,
    "seqInput": 0
  },
  "270": {
    "playerMode": 12,
    "monsterMode": 4,
    "anim": "KK",
    "monanim": "A1",
    "seqTrans": "KK",
    "seqNum": 0,
    "seqInput": 0
  },
  "271": {
    "playerMode": 14,
    "monsterMode": 9,
    "anim": "S2",
    "monanim": "S2",
    "seqTrans": "S2",
    "seqNum": 0,
    "seqInput": 0
  },
  "272": {
    "playerMode": 14,
    "monsterMode": 9,
    "anim": "S2",
    "monanim": "S2",
    "seqTrans": "S2",
    "seqNum": 0,
    "seqInput": 0
  },
  "273": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "274": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 16,
    "seqInput": 0
  },
  "275": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 21,
    "seqInput": 0
  },
  "276": {
    "playerMode": 14,
    "monsterMode": 9,
    "anim": "S2",
    "monanim": "S2",
    "seqTrans": "S2",
    "seqNum": 0,
    "seqInput": 0
  },
  "277": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "278": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "279": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "280": {
    "playerMode": 7,
    "monsterMode": 5,
    "anim": "A1",
    "monanim": "A2",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "281": {
    "playerMode": 18,
    "monsterMode": 9,
    "anim": "SQ",
    "monanim": "S2",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "282": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "SC",
    "seqTrans": "SQ",
    "seqNum": 6,
    "seqInput": 0
  },
  "283": {
    "playerMode": 18,
    "monsterMode": 9,
    "anim": "SQ",
    "monanim": "S2",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "284": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "285": {
    "playerMode": 18,
    "monsterMode": 10,
    "anim": "SQ",
    "monanim": "S3",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "286": {
    "playerMode": 18,
    "monsterMode": 10,
    "anim": "SQ",
    "monanim": "S3",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "287": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "288": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "289": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "290": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "291": {
    "playerMode": 18,
    "monsterMode": 9,
    "anim": "SQ",
    "monanim": "S2",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "292": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "293": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "294": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "295": {
    "playerMode": 18,
    "monsterMode": 5,
    "anim": "SQ",
    "monanim": "A2",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "296": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "297": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "298": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "299": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "300": {
    "playerMode": 13,
    "monsterMode": 8,
    "anim": "S1",
    "monanim": "S1",
    "seqTrans": "S1",
    "seqNum": 0,
    "seqInput": 0
  },
  "301": {
    "playerMode": 8,
    "monsterMode": 5,
    "anim": "A2",
    "monanim": "A2",
    "seqTrans": "A2",
    "seqNum": 0,
    "seqInput": 0
  },
  "302": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "303": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "304": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "305": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "306": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "307": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "308": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "309": {
    "playerMode": 10,
    "monsterMode": 9,
    "anim": "SC",
    "monanim": "S2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "310": {
    "playerMode": 10,
    "monsterMode": 9,
    "anim": "SC",
    "monanim": "S2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "311": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "312": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "313": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "314": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "315": {
    "playerMode": 14,
    "monsterMode": 9,
    "anim": "S2",
    "monanim": "S2",
    "seqTrans": "S2",
    "seqNum": 0,
    "seqInput": 0
  },
  "316": {
    "playerMode": 15,
    "monsterMode": 10,
    "anim": "S3",
    "monanim": "S3",
    "seqTrans": "S3",
    "seqNum": 0,
    "seqInput": 0
  },
  "317": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "318": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "319": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "320": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "321": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "322": {
    "playerMode": 18,
    "monsterMode": 4,
    "anim": "SQ",
    "monanim": "A1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "323": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 18,
    "seqInput": 0
  },
  "324": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "325": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "326": {
    "playerMode": 13,
    "monsterMode": 7,
    "anim": "S1",
    "monanim": "XX",
    "seqTrans": "S1",
    "seqNum": 0,
    "seqInput": 0
  },
  "327": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "328": {
    "playerMode": 18,
    "monsterMode": 5,
    "anim": "SQ",
    "monanim": "A2",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "329": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "330": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "331": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "332": {
    "playerMode": 18,
    "monsterMode": 8,
    "anim": "SQ",
    "monanim": "S1",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "333": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "334": {
    "playerMode": 10,
    "monsterMode": 5,
    "anim": "SC",
    "monanim": "A2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "335": {
    "playerMode": 10,
    "monsterMode": 8,
    "anim": "SC",
    "monanim": "S1",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "336": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "337": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "SC",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "338": {
    "playerMode": 10,
    "monsterMode": 4,
    "anim": "SC",
    "monanim": "A1",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "339": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "340": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "341": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "342": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "343": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "344": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "345": {
    "playerMode": 10,
    "monsterMode": 9,
    "anim": "SC",
    "monanim": "S2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "346": {
    "playerMode": 10,
    "monsterMode": 5,
    "anim": "SC",
    "monanim": "A2",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "347": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  },
  "348": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "349": {
    "playerMode": 10,
    "monsterMode": 10,
    "anim": "SC",
    "monanim": "S3",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "350": {
    "playerMode": 10,
    "monsterMode": 1,
    "anim": "SC",
    "monanim": "NU",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "351": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "352": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "A1",
    "seqNum": 4,
    "seqInput": 0
  },
  "353": {
    "playerMode": 10,
    "monsterMode": 7,
    "anim": "SC",
    "monanim": "XX",
    "seqTrans": "SC",
    "seqNum": 0,
    "seqInput": 0
  },
  "354": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "355": {
    "playerMode": 18,
    "monsterMode": 7,
    "anim": "SQ",
    "monanim": "XX",
    "seqTrans": "SQ",
    "seqNum": 0,
    "seqInput": 0
  },
  "356": {
    "playerMode": 7,
    "monsterMode": 4,
    "anim": "A1",
    "monanim": "A1",
    "seqTrans": "A1",
    "seqNum": 0,
    "seqInput": 0
  }
})

export const PLAYER_SEQUENCES_113C: Readonly<
  Record<number, Readonly<Record<string, readonly PlayerSequenceFrameRecord[]>>>
> = Object.freeze({
  "1": {
    "hth": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 8,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 8,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 8,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 8,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 8,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 8,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 15,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "2": {
    "hth": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 8,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 8,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "3": {
    "hth": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 8,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "4": {
    "hth": [
      {
        "mode": 3,
        "frame": 0,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 1,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 3,
        "frame": 0,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 1,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 3,
        "frame": 0,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 1,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 3,
        "frame": 0,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 1,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 3,
        "frame": 0,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 1,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 3,
        "frame": 0,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 1,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 3,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 3
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "5": {
    "hth": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 8,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 8,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "6": {
    "hth": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1js": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1jt": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1ss": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1st": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "7": {
    "hth": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 18,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 19,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "8": {
    "hth": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 17,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "9": {
    "hth": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 12,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 17,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "10": {
    "hth": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "1ht": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "2ht": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "1hs": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "2hs": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "stf": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "1js": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "1jt": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "1ss": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "1st": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "ht1": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ],
    "ht2": [
      {
        "mode": 7,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      }
    ]
  },
  "11": {
    "hth": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1js": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1jt": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1ss": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1st": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 7,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "12": {
    "hth": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1js": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1jt": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1ss": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1st": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "13": {
    "hth": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "1ht": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "2ht": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "1hs": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "2hs": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "bow": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "xbw": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "stf": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "1js": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "1jt": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "1ss": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "1st": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "ht1": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ],
    "ht2": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 1
      }
    ]
  },
  "14": {
    "hth": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 17,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "1js": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1jt": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1ss": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1st": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 7,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 7,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "15": {
    "hth": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "1js": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "1jt": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "1ss": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "1st": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 11,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 11,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 15,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 15,
        "frame": 10,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "16": {
    "hth": [
      {
        "mode": 8,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 8,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 8,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 8,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 8,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 8,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 16,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 16,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 16,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 16,
        "frame": 6,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 16,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 16,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 16,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 16,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 16,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "17": {
    "hth": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 17,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 18,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "18": {
    "hth": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1js": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1jt": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1ss": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "1st": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "19": {
    "hth": [
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "20": {
    "hth": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "21": {
    "hth": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1js": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1jt": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1ss": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "1st": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 4,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 12,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 12,
        "frame": 12,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "22": {
    "hth": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "1js": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "1jt": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "1ss": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "1st": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 13,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 10,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 2,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 13,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 13,
        "frame": 0,
        "dir": 0,
        "event": 0
      }
    ]
  },
  "23": {
    "hth": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "1ht": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "2ht": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "1hs": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "2hs": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "bow": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "xbw": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "stf": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "1js": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "1jt": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "1ss": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "1st": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "ht1": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ],
    "ht2": [
      {
        "mode": 10,
        "frame": 0,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 1,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 2,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 3,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 4,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 5,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 6,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 7,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 8,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 9,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 10,
        "dir": 0,
        "event": 1
      },
      {
        "mode": 10,
        "frame": 11,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 12,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 13,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 14,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 15,
        "dir": 0,
        "event": 0
      },
      {
        "mode": 10,
        "frame": 16,
        "dir": 0,
        "event": 0
      }
    ]
  }
})

/**
 * Resolves the 1.13c sequence sub-mode and frame index for a sequence skill
 * (DATATBLS_GetSeqRecordFromUnit + DATATBLS_ComputeSequenceAnimation in SequenceTbls.cpp).
 */
export function resolveSkillSequenceFrame(
  skillId: number,
  weaponClass = "hth",
  elapsedTicks = 0,
  stepSpeed256 = 256,
): ResolvedSkillSequenceFrame | null {
  const entry = CANONICAL_SKILL_ANIM_MODES[skillId]
  // 1.13c D2Common UNITS_SetAnimStartFrame (0x6FD8368F: cmp esi, 0x12):
  // Only PLRMODE_SEQUENCE (mode 18 / anim === 'SQ') initializes sequence tables.
  // Non-SQ skills with leftover seqnum in Skills.txt (#123 Conviction, #223 Werewolf, #228 Werebear)
  // have anim === 'SC' (mode 10) and must NOT run sequence tables.
  if (
    !entry ||
    (entry.playerMode !== 18 && entry.anim !== "SQ") ||
    !entry.seqNum ||
    entry.seqNum <= 0
  ) {
    return null
  }
  const seqByWeapon = PLAYER_SEQUENCES_113C[entry.seqNum]
  if (!seqByWeapon) {
    return null
  }
  const normalizedWClass = (weaponClass || "hth").trim().toLowerCase()
  const frames =
    seqByWeapon[normalizedWClass] && seqByWeapon[normalizedWClass]!.length > 0
      ? seqByWeapon[normalizedWClass]!
      : seqByWeapon["hth"]
  if (!frames || frames.length === 0) {
    return null
  }
  const safeTicks = Math.max(0, Number.isFinite(elapsedTicks) ? elapsedTicks : 0)
  const safeSpeed = Math.max(
    1,
    Number.isFinite(stepSpeed256) && stepSpeed256 > 0 ? Math.trunc(stepSpeed256) : 256,
  )
  const rawSeqFrame = Math.floor((safeTicks * safeSpeed) / 256)
  // 1.13c SequenceTbls.cpp: continuous channeling sequence skills (#41 Inferno seqInput=10, #230 Arctic Blast seqInput=10)
  // hold on the outstretched channeling event frame while active instead of playing wind-down frames 11..14.
  const isContinuousChannelSeq = entry.seqInput > 0 && (skillId === 41 || skillId === 230)
  let done = rawSeqFrame >= frames.length
  let sequenceFrame = Math.max(0, Math.min(frames.length - 1, rawSeqFrame))
  if (skillId === 151 && frames.length > 3) {
    // 1.13c D2Client.dll SKILLS_CltDo45_Whirlwind (0x6FB76583: D2Common_10356(pUnit, 3); dwFrameCount = 0x500):
    // After the 3 startup frames (0..2), Whirlwind loops the 5 spinning sequence frames (3..7) continuously.
    if (rawSeqFrame >= frames.length) {
      sequenceFrame = 3 + ((rawSeqFrame - 3) % (frames.length - 3))
      done = false
    }
  } else if (isContinuousChannelSeq) {
    let holdSeqIdx = -1
    for (let i = 0; i < frames.length; i++) {
      if (frames[i]!.event === 1) {
        holdSeqIdx = i
        break
      }
    }
    if (holdSeqIdx < 0) {
      holdSeqIdx = Math.min(frames.length - 1, Math.max(0, entry.seqInput))
    }
    if (rawSeqFrame >= holdSeqIdx) {
      sequenceFrame = holdSeqIdx
      done = false
    }
  }
  const rec = frames[sequenceFrame]!
  const clipKey = PLR_MODE_NUM_TO_CLIP_KEY[rec.mode] ?? "a1"
  return {
    clipKey,
    mode: rec.mode,
    frameIndex: rec.frame,
    sequenceFrame,
    totalSequenceFrames: frames.length,
    dir: rec.dir,
    event: rec.event,
    done,
  }
}

/**
 * Resolves the 1.13c animation mode entry for a skill cast by player or monster.
 */
export function getSkillAnimModes(skillId: number): SkillAnimModeEntry {
  const entry = CANONICAL_SKILL_ANIM_MODES[skillId]
  if (entry) {
    return entry
  }
  return {
    playerMode: 10,
    monsterMode: 7,
    anim: "SC",
    monanim: "XX",
    seqTrans: "SC",
    seqNum: 0,
    seqInput: 0,
  }
}

/**
 * Resolves the lowercase character clip mode ("a1", "a2", "sc", "th", "kk", "s1".."s4", "rn", "bl")
 * for a player skill cast, expanding SQ (18) skills via 1.13c SequenceTbls.cpp.
 * Never returns "gh" (Get-Hit) for any skill cast.
 */
export function getSkillPlayerClipMode(
  skillId: number,
  weaponClass = "hth",
  elapsedTicks = 0,
  stepSpeed256 = 256,
): string {
  const entry = CANONICAL_SKILL_ANIM_MODES[skillId]
  if (!entry) {
    return skillId === 0 ? "a1" : "sc"
  }
  if (entry.playerMode === 18 || entry.anim === "SQ") {
    const seq = resolveSkillSequenceFrame(skillId, weaponClass, elapsedTicks, stepSpeed256)
    if (seq) {
      return seq.clipKey
    }
    const trans = (entry.seqTrans || "A1").toLowerCase()
    return trans !== "sq" && trans !== "gh" ? trans : "a1"
  }
  return PLR_MODE_NUM_TO_CLIP_KEY[entry.playerMode] ?? "sc"
}

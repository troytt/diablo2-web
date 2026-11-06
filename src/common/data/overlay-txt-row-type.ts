/**
 * One compiled Diablo II 1.13c `Overlay.txt` record (`D2OverlayTxt`, D2MOO `OverlayTbls.h:21-48`,
 * stride 0x84) plus its txt `overlay` name. Generated table: `overlay-txt-rows.ts`.
 */
export interface OverlayTxtRow {
  /** txt `overlay` column (NAMETOINDEX link key; not stored in the bin). */
  readonly name: string
  /** `szFilename` (+0x02). */
  readonly filename: string
  /** `wVersion` (+0x42). */
  readonly version: number
  /** `dwFrames` (+0x44). */
  readonly frames: number
  /** `nPreDraw` (+0x48). */
  readonly preDraw: number
  /** `dw1ofN` (+0x4C). */
  readonly oneOfN: number
  /** `nDir` (+0x50). */
  readonly dir: number
  /** `nOpen` (+0x51). */
  readonly open: number
  /** `nBeta` (+0x52). */
  readonly beta: number
  /** `dwOffsetX` (+0x54), signed. */
  readonly xOffset: number
  /** `dwOffsetY` (+0x58), signed. */
  readonly yOffset: number
  /** `dwHeight[4]` (+0x5C), signed. */
  readonly height: readonly [number, number, number, number]
  /** `dwAnimRate` (+0x6C). */
  readonly animRate: number
  /** `dwInitRadius` (+0x70). */
  readonly initRadius: number
  /** `dwRadius` (+0x74). */
  readonly radius: number
  /** `dwLoopWaitTime` (+0x78). */
  readonly loopWaitTime: number
  /** `nTrans` (+0x7C). */
  readonly trans: number
  /** `nRed` (+0x7D). */
  readonly red: number
  /** `nGreen` (+0x7E). */
  readonly green: number
  /** `nBlue` (+0x7F). */
  readonly blue: number
  /** `nNumDirections` (+0x80). */
  readonly numDirections: number
  /** `nLocalBlood` (+0x81). */
  readonly localBlood: number
}

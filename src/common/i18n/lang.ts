/**
 * Pure language state & `.tbl` lookup helpers (`src/common/i18n/lang.ts`).
 * Zero DOM or Node globals.
 */

import {
  getDefaultTblLang,
  isDefaultTblLangEn,
  lookupTbl,
  setDefaultTblLang,
  toGameLang,
  toTblLang,
  type GameLang,
  type TblLang,
} from '../formats/tbl.ts'

export {
  getDefaultTblLang,
  isDefaultTblLangEn,
  lookupTbl,
  setDefaultTblLang,
  toGameLang,
  toTblLang,
  type GameLang,
  type TblLang,
}

export function getTblLang(): TblLang {
  return getDefaultTblLang()
}

export function setTblLang(lang: TblLang | GameLang | string): void {
  setDefaultTblLang(lang)
}

export function getGameLang(): GameLang {
  return getDefaultTblLang() === 'ENG' ? 'en' : 'zh'
}

export function setGameLang(lang: GameLang | TblLang | string): void {
  setDefaultTblLang(lang)
}

export function getLang(): GameLang {
  return getGameLang()
}

export function setLang(lang: GameLang | TblLang | string): void {
  setDefaultTblLang(lang)
}

export function getCurrentLang(): GameLang {
  return getGameLang()
}

export function setCurrentLang(lang: GameLang | TblLang | string): void {
  setDefaultTblLang(lang)
}

export function isEn(): boolean {
  return isDefaultTblLangEn()
}

export function isEnglish(): boolean {
  return isDefaultTblLangEn()
}

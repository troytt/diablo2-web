import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'vitest'
import {
  agreeTermsOfUse,
  applyCreateAccountServerError,
  applyOnlineCharactersToFlowState,
  backspaceCreateAccountChar,
  cancelCreateAccount,
  cancelPleaseRead,
  clickBattleNetButton,
  clickSinglePlayerButton,
  confirmCharacterSelect,
  createInitialFlowState,
  cycleCreateAccountFocus,
  disagreeTermsOfUse,
  dismissPopupModal,
  filterAccountName,
  isValidAccountChar,
  mapCreateAccountServerStatus,
  openTermsOfUse,
  scrollTermsOfUse,
  selectCampfireClass,
  stepFlowFrame,
  submitCharacterCreate,
  submitCreateAccountForm,
  typeCreateAccountChar,
  validateNewAccountInputs,
} from '../src/client/frontend/flow-state.ts'
import { BncsCreateAccountStatus } from '../src/netproto/index.ts'

const ROOT_DIR = resolve(import.meta.dirname, '..')
const FRONTEND_DIR = resolve(ROOT_DIR, 'public/ui/frontend')
const MANIFEST_PATH = resolve(FRONTEND_DIR, 'manifest.json')

function readPngDimensions(filePath: string): { readonly width: number; readonly height: number } {
  const buf = readFileSync(filePath)
  assert.equal(buf[0], 0x89, 'PNG signature byte 0')
  assert.equal(buf[1], 0x50, 'PNG signature byte 1')
  assert.equal(buf[2], 0x4e, 'PNG signature byte 2')
  assert.equal(buf[3], 0x47, 'PNG signature byte 3')
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  }
}

describe('Battle.net Create New Account Frontend Assets & Flow State (R1, R2, R4)', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as {
    readonly strings: Record<string, unknown>
  }
  const strings = manifest.strings

  it('R1: packs terms-of-use-bg.png (593x451), scrollbar.png (72x14), btn-popup-small.png (192x32), and canonical .tbl strings', () => {
    const touBgPath = resolve(FRONTEND_DIR, 'terms-of-use-bg.png')
    const scrollbarPath = resolve(FRONTEND_DIR, 'scrollbar.png')
    const btnPopupPath = resolve(FRONTEND_DIR, 'btn-popup-small.png')

    assert.equal(existsSync(touBgPath), true, 'terms-of-use-bg.png should exist')
    assert.equal(existsSync(scrollbarPath), true, 'scrollbar.png should exist')
    assert.equal(existsSync(btnPopupPath), true, 'btn-popup-small.png should exist')

    const touPng = readPngDimensions(touBgPath)
    assert.equal(touPng.width, 593)
    assert.equal(touPng.height, 451)

    const sbPng = readPngDimensions(scrollbarPath)
    assert.equal(sbPng.width, 72)
    assert.equal(sbPng.height, 14)

    const btnPng = readPngDimensions(btnPopupPath)
    assert.equal(btnPng.width, 192)
    assert.equal(btnPng.height, 32)

    assert.equal(strings['5180'], 'Terms of Use')
    assert.equal(strings['5181'], 'AGREE')
    assert.equal(strings['5182'], 'DISAGREE')
    assert.equal(strings['5216'], 'Account name must be at least 2 characters.')
    assert.equal(strings['5217'], "Account name can't be more than 15 characters.")
    assert.equal(strings['5218'], "Passwords don't match.")
    assert.equal(strings['5219'], 'Password must be at least 2 characters.')
    assert.equal(strings['5220'], "Password can't be more than 15 characters.")
    assert.equal(strings['5221'], 'CREATE NEW ACCOUNT')
    assert.equal(strings['5222'], 'Create Battle.net Account')
    assert.equal(
      strings['5223'],
      'Enter the Name and Password for your new battle.net account.',
    )
    assert.equal(strings['5224'], 'Account Name')
    assert.equal(strings['5225'], 'Password')
    assert.equal(strings['5226'], 'Verify Password')
    assert.equal(strings['10834'], 'Verify Password')
    assert.equal(strings['5227'], 'PLEASE READ')
    assert.equal(strings['11127'], 'PLEASE WRITE DOWN YOUR PASSWORD.')
    assert.equal(strings['5249'], 'Unable to Create Account')
    assert.equal(
      typeof strings.termsOfUseText === 'string' && strings.termsOfUseText.length > 500,
      true,
      'termsOfUseText from license.txt must be non-empty',
    )
  })

  it('R2: transitions bnet_login -> bnet_terms_of_use, supports scrolling, DISAGREE -> bnet_login, and AGREE -> bnet_create_account', () => {
    const state = createInitialFlowState()
    state.stage = 'bnet_login'
    state.accountName = 'HeroAcct'
    state.accountPassword = 'oldpassword'
    state.accountVerifyPassword = 'oldpassword'

    openTermsOfUse(state)
    assert.equal(state.stage, 'bnet_terms_of_use')
    assert.equal(state.termsScrollLine, 0)
    assert.equal(state.popupModal, null)
    assert.equal(state.activeInput, null)

    scrollTermsOfUse(state, 5, 20)
    assert.equal(state.termsScrollLine, 5)
    assert.equal(state.termsScrollOffset, 5)

    scrollTermsOfUse(state, 50, 20)
    assert.equal(state.termsScrollLine, 20)

    scrollTermsOfUse(state, -100, 20)
    assert.equal(state.termsScrollLine, 0)

    disagreeTermsOfUse(state)
    assert.equal(state.stage, 'bnet_login')
    assert.equal(state.activeInput, 'accountPassword')

    openTermsOfUse(state)
    agreeTermsOfUse(state)
    assert.equal(state.stage, 'bnet_create_account')
    assert.equal(state.activeInput, 'accountName')
    assert.equal(state.accountPassword, '')
    assert.equal(state.accountVerifyPassword, '')
    assert.equal(state.accountName, 'HeroAcct')
  })

  it('R2: cycles focus across the 3 fields with Tab / Shift+Tab and filters characters per 0x6fa52630', () => {
    const state = createInitialFlowState()
    openTermsOfUse(state)
    agreeTermsOfUse(state)
    state.accountName = ''

    assert.equal(state.activeInput, 'accountName')
    cycleCreateAccountFocus(state)
    assert.equal(state.activeInput, 'accountPassword')
    cycleCreateAccountFocus(state)
    assert.equal(state.activeInput, 'accountVerifyPassword')
    cycleCreateAccountFocus(state)
    assert.equal(state.activeInput, 'accountName')

    cycleCreateAccountFocus(state, true)
    assert.equal(state.activeInput, 'accountVerifyPassword')
    cycleCreateAccountFocus(state, true)
    assert.equal(state.activeInput, 'accountPassword')
    cycleCreateAccountFocus(state, true)
    assert.equal(state.activeInput, 'accountName')

    // Verify 0x6fa52630 character filter (rejects <= 0x20, >= 0x7f, and " # % * , / < > ? \)
    for (const allowed of ['A', 'z', '0', '9', '-', '_', '.', '[', ']', ';', '(', ')']) {
      assert.equal(isValidAccountChar(allowed), true, `Expected '${allowed}' to be valid`)
    }
    for (const forbidden of [
      ' ',
      '\t',
      '\n',
      '"',
      '#',
      '%',
      '*',
      ',',
      '/',
      '<',
      '>',
      '?',
      '\\',
      '\x7f',
      'é',
    ]) {
      assert.equal(isValidAccountChar(forbidden), false, `Expected '${forbidden}' to be rejected`)
    }

    assert.equal(filterAccountName('Hero_1#bad/name*234567890'), 'Hero_1badname23')

    // Typing into accountName ignores invalid chars and caps at 15 chars
    for (const ch of 'My_Hero#*.[1]23456789') {
      typeCreateAccountChar(state, ch)
    }
    assert.equal(state.accountName, 'My_Hero.[1]2345')
    assert.equal(state.accountName.length, 15)

    backspaceCreateAccountChar(state)
    assert.equal(state.accountName, 'My_Hero.[1]234')
  })

  it('R2: enforces all 5 client-side validation error popups (5216..5220) in exact 0x6fa59880 priority order and dismisses modal', () => {
    const state = createInitialFlowState()
    openTermsOfUse(state)
    agreeTermsOfUse(state)

    // 1. Account name < 2 chars -> 5216
    state.accountName = 'a'
    state.accountPassword = 'secret'
    state.accountVerifyPassword = 'secret'
    assert.equal(submitCreateAccountForm(state, strings), false)
    assert.equal(state.stage, 'bnet_create_account')
    assert.equal(state.popupModal?.message, 'Account name must be at least 2 characters.')

    dismissPopupModal(state)
    assert.equal(Boolean(state.popupModal), false)

    // 2. Account name > 15 chars -> 5217
    state.accountName = '1234567890123456'
    assert.equal(submitCreateAccountForm(state, strings), false)
    assert.equal(state.popupModal?.message, "Account name can't be more than 15 characters.")
    dismissPopupModal(state)
    assert.equal(Boolean(state.popupModal), false)

    // 3. Passwords don't match (case-insensitive _stricmp) -> 5218
    // Note: checked BEFORE password length < 2 per 0x6fa59880!
    state.accountName = 'ValidHero'
    state.accountPassword = 'a'
    state.accountVerifyPassword = 'b'
    assert.equal(submitCreateAccountForm(state, strings), false)
    assert.equal(state.popupModal?.message, "Passwords don't match.")
    dismissPopupModal(state)
    assert.equal(Boolean(state.popupModal), false)

    // 4. Password < 2 chars (when matching) -> 5219
    state.accountPassword = 'a'
    state.accountVerifyPassword = 'A' // matches case-insensitively!
    assert.equal(submitCreateAccountForm(state, strings), false)
    assert.equal(state.popupModal?.message, 'Password must be at least 2 characters.')
    dismissPopupModal(state)
    assert.equal(Boolean(state.popupModal), false)

    // 5. Password > 15 chars (when matching) -> 5220
    state.accountPassword = '1234567890123456'
    state.accountVerifyPassword = '1234567890123456'
    const check5220 = validateNewAccountInputs(state, strings)
    assert.equal(check5220.valid, false)
    if (!check5220.valid) {
      assert.equal(check5220.tblId, 5220)
      assert.equal(check5220.message, "Password can't be more than 15 characters.")
    }
    assert.equal(submitCreateAccountForm(state, strings), false)
    assert.equal(state.popupModal?.message, "Password can't be more than 15 characters.")
    dismissPopupModal(state)
    assert.equal(Boolean(state.popupModal), false)

    // 6. Valid inputs (including case-insensitive password match) -> advances to bnet_please_read
    state.accountName = 'ValidHero'
    state.accountPassword = 'Secret123'
    state.accountVerifyPassword = 'secret123'
    assert.equal(submitCreateAccountForm(state, strings), true)
    assert.equal(state.stage, 'bnet_please_read')
    assert.equal(Boolean(state.popupModal), false)

    // Cancel on PLEASE READ returns to bnet_login
    cancelPleaseRead(state)
    assert.equal(state.stage, 'bnet_login')

    // Exit on Create Account also returns to bnet_login
    openTermsOfUse(state)
    agreeTermsOfUse(state)
    cancelCreateAccount(state)
    assert.equal(state.stage, 'bnet_login')
  })

  it('R4: maps all server-side BncsCreateAccountStatus codes (0x02..0x08 + default) to 5231..5239 with title 5249 and returns to bnet_create_account', () => {
    const cases: Array<{
      readonly status: number
      readonly expectedStrId: number
      readonly expectedSubstr: string
    }> = [
      {
        status: BncsCreateAccountStatus.INVALID_CHARS, // 0x02
        expectedStrId: 5232,
        expectedSubstr: 'illegal characters',
      },
      {
        status: BncsCreateAccountStatus.BANNED_WORD, // 0x03
        expectedStrId: 5233,
        expectedSubstr: 'disallowed words',
      },
      {
        status: BncsCreateAccountStatus.ALREADY_EXISTS, // 0x04
        expectedStrId: 5239,
        expectedSubstr: 'already exists',
      },
      {
        status: BncsCreateAccountStatus.STILL_PROCESSING, // 0x05
        expectedStrId: 5234,
        expectedSubstr: 'still being processed',
      },
      {
        status: BncsCreateAccountStatus.NOT_ENOUGH_ALPHANUM, // 0x06
        expectedStrId: 5235,
        expectedSubstr: 'alpha-numeric characters',
      },
      {
        status: BncsCreateAccountStatus.ADJACENT_PUNCT, // 0x07
        expectedStrId: 5236,
        expectedSubstr: 'adjacent punctuation',
      },
      {
        status: BncsCreateAccountStatus.TOO_MANY_PUNCT, // 0x08
        expectedStrId: 5237,
        expectedSubstr: 'too many punctuation',
      },
      {
        status: BncsCreateAccountStatus.TOO_SHORT, // 0x01 (default branch in 0x6fa58e40)
        expectedStrId: 5231,
        expectedSubstr: 'at least two characters',
      },
      {
        status: 0x99, // unknown non-zero status -> default branch 5231
        expectedStrId: 5231,
        expectedSubstr: 'at least two characters',
      },
    ]

    for (const c of cases) {
      const state = createInitialFlowState()
      state.stage = 'bnet_please_read'
      state.accountName = 'TakenHero'
      state.accountPassword = 'secret'
      state.accountVerifyPassword = 'secret'

      const mapped = mapCreateAccountServerStatus(c.status, strings)
      assert.equal(mapped.tblId, c.expectedStrId)
      assert.equal(mapped.title, 'Unable to Create Account')
      assert.equal(
        mapped.message.includes(c.expectedSubstr),
        true,
        `Status 0x${c.status.toString(16)} message "${mapped.message}" should include "${c.expectedSubstr}"`,
      )

      applyCreateAccountServerError(state, c.status, strings)
      assert.equal(state.stage, 'bnet_create_account')
      assert.equal(state.accountName, 'TakenHero', 'accountName must be preserved on server error')
      assert.equal(state.popupModal?.title, 'Unable to Create Account')
      assert.equal(state.popupModal?.message, mapped.message)
    }
  })

  it('R4: applyOnlineCharactersToFlowState with stayOnCharSelect keeps empty new account on char_select', () => {
    const state = createInitialFlowState()
    state.stage = 'bnet_please_read'
    applyOnlineCharactersToFlowState(state, [], { stayOnCharSelect: true })
    assert.equal(state.stage, 'char_select')
    assert.equal(state.roster.length, 0)
  })

  it('Single Player closed loop: main_menu -> single_player -> char_create / char_select -> door_loading -> in_game', () => {
    const state = createInitialFlowState()
    state.roster = []
    state.stage = 'main_menu'

    // 1. Empty roster: clicking Single Player goes directly to char_create with playMode='single' and isLadder=false
    clickSinglePlayerButton(state)
    assert.equal(state.playMode, 'single')
    assert.equal(state.stage, 'char_create')
    assert.equal(state.isLadder, false)

    // 2. Creating a character in Single Player transitions directly to door_loading -> in_game
    selectCampfireClass(state, 'so')
    state.charName = 'OfflineSorc'
    assert.ok(submitCharacterCreate(state))
    assert.equal(state.stage, 'door_loading')
    assert.equal(state.roster.length, 1)
    assert.equal(state.roster[0]?.name, 'OfflineSorc')
    assert.equal(state.roster[0]?.isLadder, false)

    state.sceneReady = true
    for (let t = 0; t <= 1600; t += 40) {
      stepFlowFrame(state, t)
    }
    assert.equal(state.stage, 'in_game')

    // 3. Returning to main_menu and clicking Single Player with existing character goes to char_select -> door_loading -> in_game
    state.stage = 'main_menu'
    clickSinglePlayerButton(state)
    assert.equal(state.playMode, 'single')
    assert.equal(state.stage, 'char_select')
    assert.ok(confirmCharacterSelect(state))
    assert.equal(state.stage, 'door_loading')

    // 4. Battle.net mode still transitions char_select -> bnet_lobby
    state.stage = 'main_menu'
    clickBattleNetButton(state)
    assert.equal(state.playMode, 'bnet')
    state.stage = 'char_select'
    assert.ok(confirmCharacterSelect(state))
    assert.equal(state.stage, 'bnet_lobby')
  })
})

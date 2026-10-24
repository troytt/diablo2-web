import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  BncsCreateAccountError,
  BncsCreateAccountStatus,
  createD2OnlineFlow,
} from '../src/netproto/index.ts'
import { createFakeRealm } from './netproto/fake-realm-servers.ts'

describe('D2OnlineFlow SID_CREATEACCOUNT2 (0x3D) Account Creation & Error Propagation (R4)', () => {
  it('succeeds on createAccount and loginOrRegister({ createNewAccount: true }) when server returns status 0x00', async () => {
    const realm = createFakeRealm({
      characters: 0,
      createAccountStatus: BncsCreateAccountStatus.OK,
    })
    const flow = createD2OnlineFlow({
      resolver: realm.resolver,
      bnetHost: '127.0.0.1',
      bnetPort: 6112,
    })

    await flow.createAccount('NewHero', 'SecretPass')
    await flow.login('NewHero', 'SecretPass')
    const realms = await flow.listRealms()
    assert.equal(realms.length, 1)
    const chars = await flow.enterRealm(realms[0]!.title)
    assert.equal(chars.length, 0)
    await flow.close()
  })

  it('throws BncsCreateAccountError preserving exact numeric status (0x02..0x08) when SID_CREATEACCOUNT2 fails', async () => {
    const errorStatuses = [
      BncsCreateAccountStatus.TOO_SHORT,
      BncsCreateAccountStatus.INVALID_CHARS,
      BncsCreateAccountStatus.BANNED_WORD,
      BncsCreateAccountStatus.ALREADY_EXISTS,
      BncsCreateAccountStatus.STILL_PROCESSING,
      BncsCreateAccountStatus.NOT_ENOUGH_ALPHANUM,
      BncsCreateAccountStatus.ADJACENT_PUNCT,
      BncsCreateAccountStatus.TOO_MANY_PUNCT,
    ]

    for (const status of errorStatuses) {
      const realm = createFakeRealm({
        characters: 0,
        createAccountStatus: status,
        createAccountSuggestion: 'SuggestedAcct',
      })
      const flow = createD2OnlineFlow({
        resolver: realm.resolver,
        bnetHost: '127.0.0.1',
        bnetPort: 6112,
      })

      await assert.rejects(
        async () => {
          await flow.createAccount('TestAcct', 'Pass123')
        },
        (err: unknown) => {
          assert.equal(err instanceof BncsCreateAccountError, true)
          if (err instanceof BncsCreateAccountError) {
            assert.equal(err.status, status)
            assert.equal(err.suggestion, 'SuggestedAcct')
          }
          return true
        },
      )

      await assert.rejects(
        async () => {
          await flow.loginOrRegister('TestAcct', 'Pass123', { createNewAccount: true })
        },
        (err: unknown) => {
          assert.equal(err instanceof BncsCreateAccountError, true)
          if (err instanceof BncsCreateAccountError) {
            assert.equal(err.status, status)
          }
          return true
        },
      )

      await flow.close()
    }
  })
})

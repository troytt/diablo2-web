import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  BncsCreateAccountError,
  BncsCreateAccountStatus,
  createD2OnlineFlow,
  ProtocolError,
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

  it('throws ProtocolError when MCP_CHARDELETE (0x0A, D2MCPClient.dll 0x6fa26250) or MCP_CHARUPGRADE (0x18, 0x6fa26230) returns non-zero status (#1760)', async () => {
    const realmFail = createFakeRealm({
      characters: 1,
      deleteCharStatus: 0x46,
      upgradeCharStatus: 0x46,
    })
    const flowFail = createD2OnlineFlow({
      resolver: realmFail.resolver,
      bnetHost: '127.0.0.1',
      bnetPort: 6112,
    })
    await flowFail.login('HeroAcct', 'Pass123')
    await flowFail.enterRealm('D2CS')

    await assert.rejects(
      async () => {
        await flowFail.deleteCharacter('d2webbot_sorc')
      },
      (err: unknown) => {
        assert.equal(err instanceof ProtocolError, true)
        assert.match((err as Error).message, /MCP_CHARDELETE failed for "d2webbot_sorc" with status=0x46/)
        return true
      },
    )

    await assert.rejects(
      async () => {
        await flowFail.upgradeCharacter('d2webbot_sorc')
      },
      (err: unknown) => {
        assert.equal(err instanceof ProtocolError, true)
        assert.match((err as Error).message, /MCP_CHARUPGRADE failed for "d2webbot_sorc" with status=0x46/)
        return true
      },
    )
    await flowFail.close()

    const realmOk = createFakeRealm({
      characters: 1,
      deleteCharStatus: 0,
      upgradeCharStatus: 0,
    })
    const flowOk = createD2OnlineFlow({
      resolver: realmOk.resolver,
      bnetHost: '127.0.0.1',
      bnetPort: 6112,
    })
    await flowOk.login('HeroAcct', 'Pass123')
    await flowOk.enterRealm('D2CS')
    await flowOk.deleteCharacter('d2webbot_sorc')
    await flowOk.upgradeCharacter('d2webbot_sorc')
    await flowOk.close()
  })

  it('rejects MCP_JOINGAME (0x04) when d2gsIpRaw == 0 with synthesized status 0x28 per D2MCPClient.dll 0x6fa264d0 and supports useTicketD2gsIp (#1763)', async () => {
    // 1. d2gsIpRaw == 0 with status == 0 -> synthesizes status 0x28 (Join Failed) per 0x6fa26502..0x6fa2651a
    const realmZeroIp = createFakeRealm({
      characters: 1,
      joinGameStatus: 0,
      joinGameD2gsIp: [0, 0, 0, 0],
    })
    const flowZeroIp = createD2OnlineFlow({
      resolver: realmZeroIp.resolver,
      bnetHost: '127.0.0.1',
      bnetPort: 6112,
    })
    await flowZeroIp.login('HeroAcct', 'Pass123')
    await flowZeroIp.enterRealm('D2CS')
    await flowZeroIp.selectCharacter('d2webbot_sorc')

    await assert.rejects(
      async () => {
        await flowZeroIp.joinGame('test-game')
      },
      (err: unknown) => {
        assert.equal(err instanceof ProtocolError, true)
        assert.match((err as Error).message, /MCP_JOINGAME failed for "test-game" with status=0x28/)
        return true
      },
    )
    await flowZeroIp.close()

    // 2. useTicketD2gsIp: true routes the game connection to ticket.d2gsIp (10.0.0.42) instead of bnetHost
    const realmCustomIp = createFakeRealm({
      characters: 1,
      joinGameStatus: 0,
      joinGameD2gsIp: [10, 0, 0, 42],
    })
    const flowCustomIp = createD2OnlineFlow({
      resolver: realmCustomIp.resolver,
      bnetHost: '127.0.0.1',
      bnetPort: 6112,
      useTicketD2gsIp: true,
    })
    await flowCustomIp.login('HeroAcct', 'Pass123')
    await flowCustomIp.enterRealm('D2CS')
    await flowCustomIp.selectCharacter('d2webbot_sorc')
    const adapter = await flowCustomIp.joinGame('test-game')
    assert.ok(adapter)
    assert.equal(realmCustomIp.latest('game').host, '10.0.0.42')
    await flowCustomIp.close()
  })
})

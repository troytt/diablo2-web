import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as w11b1 from '../../../src/d2kern-113c/game/k2-w11b1-113c';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SRC_PATH = resolve(__dirname, '../../../src/d2kern-113c/game/k2-w11b1-113c.ts');
const SRC_TEXT = readFileSync(SRC_PATH, 'utf8');

type AnyFn = (...args: any[]) => any;

function resolveExportByVa(vaHex: string): AnyFn {
  const escaped = vaHex.replace(/^0x/i, '');
  const re = new RegExp(
    `@va\\s+0x${escaped}[\\s\\S]*?export\\s+function\\s+([A-Za-z0-9_]+)`,
    'i',
  );
  const match = SRC_TEXT.match(re);
  if (!match?.[1]) {
    throw new Error(`Missing export for VA ${vaHex}`);
  }
  const fn = (w11b1 as Record<string, unknown>)[match[1]];
  if (typeof fn !== 'function') {
    throw new Error(`Export ${match[1]} is not a function`);
  }
  return fn as AnyFn;
}

function createTestMem(): SparseMemory113c {
  const m = new SparseMemory113c();
  m.fill(0x10000, 0x38000, 0);
  m.fill(0x7f9c4000, 0x4000, 0);
  m.setU32(0x10000 + 0xb8, 0x28000);
  m.setU32(0x38000, 0x38100);
  m.setU32(0x38100 + 0xc5c, 0x100);
  m.setU32(0x6fd1829c, 0x38000);
  m.setU32(0x6fde9e1c, 0x38100);
  m.setU32(0x6fdf0b38, 0x39000);
  return m;
}

describe('K2 Wave 11 Batch 1 (w11b1): 30 D2Game.dll 1.13c functions (0x6FC3CAE0..0x6FD01C00)', () => {
  it('1. 0x6FC3CAE0 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC3CAE0');
    const pGame = 0x10000;
    const pUnit = 0x12000;
    const pArgs = 0x13000;
    m.setU32(pArgs, 0x14000);
    m.setU32(pArgs + 0x1c, 0x15000);
    expect(() => fn(m, pGame, pUnit, pArgs)).not.toThrow();
  });

  it('2. 0x6FC3D3C0 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC3D3C0');
    const pGame = 0x10000;
    const pUnit = 0x12000;
    const pArgs = 0x13000;
    m.setU32(pArgs, 0x14000);
    m.setU32(pArgs + 0x1c, 0x15000);
    expect(() => fn(m, pGame, pUnit, pArgs)).not.toThrow();
  });

  it('3. 0x6FC44950 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC44950');
    expect(() => fn(m, 0x10000, 0x12000, 0x13000, 0, 0, 0)).not.toThrow();
  });

  it('4. 0x6FC48290 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC48290');
    expect(fn(m, 0x10000, 0x12000, -1, 1)).toBe(0);
  });

  it('5. 0x6FC49720 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC49720');
    expect(fn(m, 0x10000, 0x12000, -1, 1)).toBe(0);
  });

  it('6. 0x6FC58620 asserts on null pPlayerUnit per D2Game.dll (line 0x47)', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC58620');
    expect(() => fn(m, 0, 0, 0)).toThrow();
  });

  it('7. 0x6FC5EA60 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC5EA60');
    expect(() => fn(m, 0x10000, 0x12000, 0)).not.toThrow();
  });

  it('8. 0x6FC628F0 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC628F0');
    expect(fn(m, 0x10000, 0x12000, -1, 1)).toBe(0);
  });

  it('9. 0x6FC63450 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC63450');
    const pUnit = 0x12000;
    m.setU32(pUnit + 0x2c, 0x13000);
    expect(fn(m, 0x10000, pUnit, -1, 1)).toBe(0);
  });

  it('10. 0x6FC70070 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC70070');
    const pPet = 0x12000;
    const pOwner = 0x13000;
    m.setU32(pPet + 0x00, 1);
    m.setU32(pOwner + 0x00, 0);
    expect(() => fn(m, pPet, pOwner, 1, 0x10000, -1)).not.toThrow();
  });

  it('11. 0x6FC70800 executes safely on valid room without free coords', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC70800');
    const pMonster = 0x12000;
    const pPath = 0x12200;
    const pRoom = 0x12400;
    m.setU32(pMonster + 0x00, 1);
    m.setU32(pMonster + 0x2c, pPath);
    m.setU32(pPath + 0x1c, pRoom);
    expect(() => fn(m, pMonster, 0x10000)).not.toThrow();
  });

  it('12. 0x6FC7FB50 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC7FB50');
    const pQuest = 0x12000;
    expect(() => fn(m, pQuest)).not.toThrow();
  });

  it('13. 0x6FC8AB60 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC8AB60');
    const pGame = 0x10000;
    const pOperateArgs = 0x12000;
    const pShrineRecord = 0x13000;
    const pPlayer = 0x14000;
    const pObject = 0x15000;
    const pPlrData = 0x16000;
    m.setU32(pPlayer + 0x00, 0);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU32(pPlayer + 0x80, pGame);
    m.setU32(pObject + 0x00, 2);
    m.setU32(pOperateArgs + 0x00, pGame);
    m.setU32(pOperateArgs + 0x04, pObject);
    m.setU32(pOperateArgs + 0x08, pPlayer);
    m.setU8(pShrineRecord + 0x00, 14);
    m.setU32(pShrineRecord + 0x0c, 2400);
    expect(fn(m, pOperateArgs, pShrineRecord)).toBe(1);
  });

  it('14. 0x6FC8BB60 asserts line 0xfcd when target level has no spawn room', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC8BB60');
    const pGame = 0x10000;
    const pOperateArgs = 0x12000;
    const pPortalObj = 0x13000;
    const pObjData = 0x13200;
    const pPlayer = 0x14000;
    const pAct = 0x15000;
    const pDrlg = 0x16000;
    const pLevel = 0x17000;
    const pRoomEx = 0x18000;
    m.setU32(pPortalObj + 0x00, 2);
    m.setU32(pPortalObj + 0x04, 0x64);
    m.setU32(pPortalObj + 0x14, pObjData);
    m.setU32(pPlayer + 0x00, 0);
    m.setU32(pOperateArgs + 0x00, pGame);
    m.setU32(pOperateArgs + 0x04, pPortalObj);
    m.setU32(pOperateArgs + 0x08, pPlayer);
    m.setU32(pGame + 0xbc + 1 * 4, pAct);
    m.setU32(pAct + 0x48, pDrlg);
    m.setU32(pDrlg + 0x47c, pLevel);
    m.setU32(pLevel + 0x08, 1);
    m.setU32(pLevel + 0x10, pRoomEx);
    m.setU32(pLevel + 0x1b4, pDrlg);
    m.setU32(pLevel + 0x1d0, 0x49);
    m.setU32(pRoomEx + 0x28, 0x1100000);
    m.setU32(pRoomEx + 0x34, 100);
    m.setU32(pRoomEx + 0x38, 100);
    m.setU32(pRoomEx + 0x3c, 10);
    m.setU32(pRoomEx + 0x40, 10);
    expect(() => fn(m, pOperateArgs)).toThrow();
  });

  it('15. 0x6FC8BD60 executes safely on zeroed/valid structures', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC8BD60');
    expect(() => fn(m, 0x10000, 0x12000)).not.toThrow();
  });

  it('16. 0x6FC8D0F0 returns 0 cleanly when player is interacting', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FC8D0F0');
    const pOperateArgs = 0x12000;
    const pPlayer = 0x14000;
    const pPlrData = 0x14200;
    m.setU32(pPlayer + 0x00, 0);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU8(pPlayer + 0x6c, 1);
    m.setU32(pOperateArgs + 0x00, 0x10000);
    m.setU32(pOperateArgs + 0x08, pPlayer);
    expect(fn(m, pOperateArgs, 0)).toBe(0);
  });

  it('17. 0x6FCA9730 executes safely when pMonsterUnit is 0', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCA9730');
    expect(() => fn(m, 0, 0x10000)).not.toThrow();
  });

  it('18. 0x6FCB3680 returns 0 when skillId is out of range', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCB3680');
    expect(fn(m, 0x10000, 0x12000, -1, 1)).toBe(0);
  });

  it('19. 0x6FCB7E20 returns early when pPlayerPets is 0', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCB7E20');
    const pPlayer = 0x12000;
    const pPlrData = 0x13000;
    m.setU32(pPlayer + 0x00, 0);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU32(pPlrData + 0x44, 0);
    expect(() => fn(m, pPlayer, 0x10000, 0x14000, 1, 0x15000)).not.toThrow();
  });

  it('20. 0x6FCB7F50 returns 0 when pPlayerPets is 0', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCB7F50');
    const pPlayer = 0x12000;
    const pPlrData = 0x13000;
    m.setU32(pPlayer + 0x00, 0);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU32(pPlrData + 0x44, 0);
    expect(fn(m, 1, pPlayer, 0x10000, 0x14000, 3, 0x15000)).toBe(0);
  });

  it('21. 0x6FCBDF40 returns early when arena flags bit 1 is set', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCBDF40');
    const pGame = 0x10000;
    const pArena = 0x14000;
    m.setU32(pGame + 0x1d28, pArena);
    m.setU8(pArena + 0x08, 2);
    expect(() => fn(m, pGame, 0x12000, 1, 0)).not.toThrow();
  });

  it('22. 0x6FCC9D40 stalls monster when pOwner is 0', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCC9D40');
    const pGame = 0x10000;
    const pMonster = 0x12000;
    const pAiTickArgs = 0x13000;
    m.setU32(pMonster + 0x00, 1);
    m.setU32(pAiTickArgs + 0x08, 0);
    expect(() => fn(m, pGame, pMonster, pAiTickArgs)).not.toThrow();
  });

  it('23. 0x6FCD46B0 returns 0 when warp fails on empty room', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCD46B0');
    const pGame = 0x10000;
    const pMonster = 0x12000;
    m.setU32(pMonster + 0x00, 1);
    m.setU32(pMonster + 0x2c, 0x13000);
    expect(fn(m, pGame, pMonster, 0, 1)).toBe(0);
  });

  it('24. 0x6FCD4760 returns 0 when warp fails on empty room', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCD4760');
    const pGame = 0x10000;
    const pMonster = 0x12000;
    m.setU32(pMonster + 0x00, 1);
    m.setU32(pMonster + 0x2c, 0x13000);
    expect(fn(m, pGame, pMonster, 0, 1)).toBe(0);
  });

  it('25. 0x6FCE0DB0 returns early when NPC not found in hash bucket', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCE0DB0');
    const pGame = 0x10000;
    const pPlayer = 0x12000;
    const pPlrData = 0x13000;
    m.setU32(pPlayer + 0x00, 0);
    m.setU32(pPlayer + 0x14, pPlrData);
    expect(() => fn(m, 99, pGame, pPlayer)).not.toThrow();
  });

  it('26. 0x6FCE8990 sets handled=1, skipDefault=0 when quest 11 is absent', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCE8990');
    const pGame = 0x10000;
    const pNpc = 0x12000;
    const pSkip = 0x13000;
    const pHandled = 0x13004;
    fn(m, pGame, pNpc, pSkip, pHandled);
    expect(m.u32(pHandled)).toBe(1);
    expect(m.u32(pSkip)).toBe(0);
  });

  it('27. 0x6FCEDA20 returns 3 when packet length is not 3', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCEDA20');
    expect(fn(m, 0x10000, 0x12000, 0x13000, 5)).toBe(3);
  });

  it('28. 0x6FCEF0A0 returns 3 when packet length is not 0x11', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCEF0A0');
    expect(fn(m, 0x10000, 0x12000, 0x13000, 4)).toBe(3);
  });

  it('29. 0x6FCEFE40 returns 0 when warp fails on empty player', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FCEFE40');
    const pPlayer = 0x12000;
    m.setU32(pPlayer + 0x00, 0);
    m.setU32(pPlayer + 0x2c, 0x13000);
    expect(fn(m, 100, 100, pPlayer, 0x10000, 0)).toBe(0);
  });

  it('30. 0x6FD01C00 returns early when no warp portal unit is found', () => {
    const m = createTestMem();
    const fn = resolveExportByVa('0x6FD01C00');
    const pGame = 0x10000;
    const pPlayerUnit = 0x12000;
    const pSourceUnit = 0x14000;
    const pSrcStaticPath = 0x14200;
    const pSrcRoom = 0x15000;
    const pSrcRoomEx = 0x15200;
    const pTile = 0x15400;
    const pDestWarpTxt = 0x15600;
    const pTargetRoomEx = 0x16200;
    const pBackTile = 0x16400;
    const pBackWarpTxt = 0x16600;
    const pTargetRoom = 0x17000;
    m.setU32(pSourceUnit + 0x00, 5);
    m.setU32(pSourceUnit + 0x04, 10);
    m.setU32(pSourceUnit + 0x2c, pSrcStaticPath);
    m.setU32(pSrcStaticPath + 0x00, pSrcRoom);
    m.setU32(pSrcRoom + 0x10, pSrcRoomEx);
    m.setU32(pSrcRoomEx + 0x4c, pTile);
    m.setU32(pTile + 0x00, pTargetRoomEx);
    m.setU32(pTile + 0x10, pDestWarpTxt);
    m.setU32(pDestWarpTxt, 10);
    m.setU32(pTargetRoomEx + 0x30, pTargetRoom);
    m.setU32(pTargetRoomEx + 0x4c, pBackTile);
    m.setU32(pBackTile + 0x00, pSrcRoomEx);
    m.setU32(pBackTile + 0x10, pBackWarpTxt);
    m.setU32(pBackWarpTxt, 99);
    expect(() => fn(m, pSourceUnit, pPlayerUnit, pGame)).not.toThrow();
  });
});
